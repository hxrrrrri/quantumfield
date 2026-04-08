"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSimulatorStore } from "@/store/simulatorStore";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useWebGPU } from "@/hooks/useWebGPU";
import { applyQuantumDrift } from "@/physics/quantum";
import { applyRelativity } from "@/physics/relativity";
import { applyFuturePhysics } from "@/physics/future";

interface EngineOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

/* ─── Colormaps ─────────────────────────────────────────────────────────── */
const CMAPS: Record<string, (t: number) => [number, number, number]> = {
  viridis:(t)=>interp([[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],t),
  inferno:(t)=>interp([[0,0,4],[120,28,109],[229,93,45],[252,255,164]],t),
  plasma: (t)=>interp([[13,8,135],[156,23,158],[237,121,83],[240,249,33]],t),
  cyan:   (t)=>interp([[2,13,26],[0,63,92],[0,180,220],[143,245,255]],t),
  fire:   (t)=>interp([[16,0,0],[139,0,0],[255,69,0],[255,200,0]],t),
  magma:  (t)=>interp([[26,0,48],[85,0,170],[172,137,255],[232,208,255]],t),
  rainbow:(t)=>interp([[255,0,80],[255,100,0],[200,220,0],[0,220,80],[0,180,255],[150,0,255]],t),
  neon:   (t)=>interp([[0,255,200],[0,150,255],[200,0,255],[255,0,150],[255,200,0]],t),
};
function interp(s:[number,number,number][],t:number):[number,number,number]{
  const tt=Math.max(0,Math.min(1,t));
  const x=tt*(s.length-1);
  const i=Math.min(Math.floor(x),s.length-2);
  const f=x-i;
  const a=s[i]!,b=s[i+1]!;
  return[Math.round(a[0]+(b[0]-a[0])*f),Math.round(a[1]+(b[1]-a[1])*f),Math.round(a[2]+(b[2]-a[2])*f)];
}

/* ─── Particle arrays (SoA) ─────────────────────────────────────────────── */
interface Particles {
  px:Float32Array; py:Float32Array;
  pvx:Float32Array; pvy:Float32Array;
  pm:Float32Array; pc:Float32Array;
  palpha:Float32Array; pphase:Float32Array;
  pcharge:Float32Array;
  // target positions for instant snap + spring blend
  tx:Float32Array; ty:Float32Array;
  tc:Float32Array; // target color
  count:number;
}
function alloc(n:number):Particles{
  return{
    px:new Float32Array(n),py:new Float32Array(n),
    pvx:new Float32Array(n),pvy:new Float32Array(n),
    pm:new Float32Array(n).fill(1),pc:new Float32Array(n),
    palpha:new Float32Array(n).fill(1),pphase:new Float32Array(n),
    pcharge:new Float32Array(n),
    tx:new Float32Array(n),ty:new Float32Array(n),tc:new Float32Array(n),
    count:n,
  };
}

/* ─── 3D Shape target generators (pre-compute all at once) ─────────────── */
function computeShapeTargets(
  shape:string, n:number, W:number, H:number,
  tx:Float32Array, ty:Float32Array, tc:Float32Array
):void{
  const cx=W/2, cy=H/2;
  const rY=0; // static snapshot — rotation handled in render loop via simTime

  switch(shape){
    case "sphere":{
      const R=Math.min(W,H)*0.27;
      for(let i=0;i<n;i++){
        const phi=Math.acos(1-2*(i+0.5)/n);
        const theta=Math.PI*(1+Math.sqrt(5))*i;
        const x3=R*Math.sin(phi)*Math.cos(theta);
        const y3=R*Math.sin(phi)*Math.sin(theta);
        const z3=R*Math.cos(phi);
        tx[i]=cx+x3; ty[i]=cy+y3*0.9+z3*0.15;
        tc[i]=Math.max(0,Math.min(1,(z3+R)/(2*R)));
      }break;
    }
    case "cylinder":{
      const R=Math.min(W,H)*0.18, H2=Math.min(W,H)*0.38;
      for(let i=0;i<n;i++){
        const t=i/n;
        const theta=t*Math.PI*2*Math.ceil(n/60);
        const u=(i%60)/60;
        const yy=(t-0.5)*H2;
        tx[i]=cx+R*Math.cos(theta);
        ty[i]=cy+yy+R*Math.sin(theta)*0.2;
        tc[i]=t;
      }break;
    }
    case "torus":{
      const R1=Math.min(W,H)*0.2,R2=Math.min(W,H)*0.09;
      for(let i=0;i<n;i++){
        const u=(i/n)*Math.PI*2, v=((i*7.0/n)%1)*Math.PI*2;
        const x3=(R1+R2*Math.cos(v))*Math.cos(u);
        const y3=R2*Math.sin(v);
        const z3=(R1+R2*Math.cos(v))*Math.sin(u);
        tx[i]=cx+x3; ty[i]=cy+y3*0.9+z3*0.18;
        tc[i]=Math.max(0,Math.min(1,(z3+R1+R2)/(2*(R1+R2))));
      }break;
    }
    case "cube":{
      const S=Math.min(W,H)*0.22;
      for(let i=0;i<n;i++){
        const face=Math.floor(i/(n/6));
        const tt2=(i%(Math.ceil(n/6)))/Math.ceil(n/6);
        const u2=((tt2*37)%1-0.5)*2*S, v2=((tt2*53)%1-0.5)*2*S;
        const facePos:([number,number,number])[]=[
          [u2,v2,S],[u2,v2,-S],[u2,S,v2],[u2,-S,v2],[S,u2,v2],[-S,u2,v2]
        ];
        const[x3,y3,z3]=facePos[face%6]!;
        tx[i]=cx+x3; ty[i]=cy+y3*0.9+z3*0.18;
        tc[i]=Math.max(0,Math.min(1,(z3+S*2)/(S*4)));
      }break;
    }
    case "trefoil":{
      for(let i=0;i<n;i++){
        const t2=(i/n)*Math.PI*4;
        const R=Math.min(W,H)*0.22;
        const x3=R*(Math.sin(t2)+2*Math.sin(2*t2));
        const y3=R*(Math.cos(t2)-2*Math.cos(2*t2));
        const z3=R*(-Math.sin(3*t2));
        tx[i]=cx+x3+(Math.random()-0.5)*3;
        ty[i]=cy+y3*0.9+z3*0.18+(Math.random()-0.5)*3;
        tc[i]=Math.max(0,Math.min(1,(z3+R*3)/(R*6)));
      }break;
    }
    case "mobius":{
      const R=Math.min(W,H)*0.22;
      for(let i=0;i<n;i++){
        const u=(i/n)*Math.PI*2, v=((i/n)*8%1-0.5)*0.4;
        const x3=(R+v*Math.cos(u/2))*Math.cos(u);
        const y3=(R+v*Math.cos(u/2))*Math.sin(u);
        const z3=v*Math.sin(u/2)*80;
        tx[i]=cx+x3; ty[i]=cy+y3*0.7+z3*0.25;
        tc[i]=Math.max(0,Math.min(1,(y3+R)/(2*R)));
      }break;
    }
    case "klein":{
      const R=Math.min(W,H)*0.13;
      for(let i=0;i<n;i++){
        const u=(i/n)*Math.PI*2, v2=((i*4.0/n)%1)*Math.PI*2;
        let x3:number,y3:number,z3:number;
        if(u<Math.PI){
          x3=3*R*Math.cos(u)*(1+Math.sin(u))+2*R*(1-Math.cos(u)/2)*Math.cos(u)*Math.cos(v2);
          y3=8*R*Math.sin(u)+(2*R*(1-Math.cos(u)/2))*Math.sin(u)*Math.cos(v2);
        }else{
          x3=3*R*Math.cos(u)*(1+Math.sin(u))+2*R*(1-Math.cos(u)/2)*Math.cos(v2+Math.PI);
          y3=8*R*Math.sin(u);
        }
        z3=2*R*(1-Math.cos(u)/2)*Math.sin(v2);
        x3/=3; y3/=3;
        tx[i]=cx+x3; ty[i]=cy+y3*0.7+z3*0.2;
        tc[i]=Math.max(0,Math.min(1,(z3+200)/400));
      }break;
    }
    case "octahed":{
      const S=Math.min(W,H)*0.22;
      const verts:([number,number,number])[]= [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      const faces:([number,number,number])[]= [[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,3,4],[1,5,3],[1,2,5]];
      for(let i=0;i<n;i++){
        const face=Math.floor(i/(n/8));
        const tt2=(i%(Math.ceil(n/8)))/Math.ceil(n/8);
        const u2=Math.sqrt(tt2), v2=tt2*Math.PI*4;
        const[ai,bi,ci]=faces[face%8]!;
        const a2=verts[ai]!,b2=verts[bi]!,c2=verts[ci]!;
        const ba=u2*Math.cos(v2),bb=u2*Math.sin(v2),bc=1-u2;
        const x3=(a2[0]*ba+b2[0]*bb+c2[0]*bc)*S;
        const y3=(a2[1]*ba+b2[1]*bb+c2[1]*bc)*S;
        const z3=(a2[2]*ba+b2[2]*bb+c2[2]*bc)*S;
        tx[i]=cx+x3; ty[i]=cy+y3*0.9+z3*0.18;
        tc[i]=Math.max(0,Math.min(1,(z3+S*2)/(S*4)));
      }break;
    }
    case "heart":{
      const R=Math.min(W,H)*0.1;
      for(let i=0;i<n;i++){
        const t2=(i/n)*Math.PI*2;
        const x3=R*16*Math.pow(Math.sin(t2),3);
        const y3=-R*(13*Math.cos(t2)-5*Math.cos(2*t2)-2*Math.cos(3*t2)-Math.cos(4*t2));
        const z3=R*8*Math.cos(t2)*Math.sin(t2);
        tx[i]=cx+x3+(Math.random()-0.5)*4;
        ty[i]=cy+y3*0.9+z3*0.18+(Math.random()-0.5)*4;
        tc[i]=Math.max(0,Math.min(1,(z3+200)/400));
      }break;
    }
    case "wave":{
      const cols=Math.ceil(Math.sqrt(n));
      for(let i=0;i<n;i++){
        const row=Math.floor(i/cols), col2=i%cols;
        const u2=(col2/cols-0.5)*Math.min(W,H)*0.68;
        const v2=(row/cols-0.5)*Math.min(W,H)*0.68;
        const r2=Math.sqrt(u2*u2+v2*v2);
        const z3=Math.sin(r2*0.04)*40*(1-r2/(Math.min(W,H)*0.5));
        tx[i]=cx+u2; ty[i]=cy+v2*0.8+z3*0.3;
        tc[i]=Math.max(0,Math.min(1,(z3+40)/80));
      }break;
    }
    case "dna":{
      for(let i=0;i<n;i++){
        const t2=i/n;
        const z3=t2*H*1.05-H*0.025;
        const angle=t2*Math.PI*14;
        const strand=i%3;
        let x3=0, c=0;
        if(strand<2){ x3=Math.cos(angle+(strand===0?1:-1)*Math.PI/2)*40; c=strand===0?0.2:0.75; }
        else{ x3=Math.cos(angle+Math.PI/2)*40*(Math.random()*0.5+0.25); c=0.5; }
        tx[i]=cx+x3+(Math.random()-0.5)*3; ty[i]=z3+(Math.random()-0.5)*3; tc[i]=c;
      }break;
    }
    case "spiral":{
      for(let i=0;i<n;i++){
        const t2=(i/n)*6*Math.PI;
        const R=Math.min(W,H)*0.28*(1-i/n*0.7);
        tx[i]=cx+R*Math.cos(t2)+(Math.random()-0.5)*4;
        ty[i]=cy+R*Math.sin(t2)*0.6+(i/n-0.5)*H*0.5+(Math.random()-0.5)*4;
        tc[i]=i/n;
      }break;
    }
    default:{ // galaxy fallback
      for(let i=0;i<n;i++){
        const arm=Math.floor(Math.random()*3);
        const r=10+Math.pow(Math.random(),0.6)*Math.min(W,H)*0.35;
        const theta=arm*(Math.PI*2/3)+r*0.025+Math.random()*0.4;
        tx[i]=cx+Math.cos(theta)*r+(Math.random()-0.5)*18;
        ty[i]=cy+Math.sin(theta)*r*0.55+(Math.random()-0.5)*12;
        tc[i]=Math.random();
      }
    }
  }
}

/* ─── Preset initializers ─────────────────────────────────────────────── */
type InitFn=(p:Particles,W:number,H:number)=>void;
const PRESET_INITS:Record<string,InitFn>={
  galaxy(p,W,H){
    computeShapeTargets("galaxy",p.count,W,H,p.tx,p.ty,p.tc);
    for(let i=0;i<p.count;i++){
      p.px[i]=p.tx[i]!; p.py[i]=p.ty[i]!;
      p.pvx[i]=(Math.random()-0.5)*1; p.pvy[i]=(Math.random()-0.5)*1;
      p.pm[i]=0.5+Math.random()*1.5; p.pc[i]=p.tc[i]!; p.palpha[i]=0.7+Math.random()*0.3;
    }
  },
  bigbang(p,W,H){
    for(let i=0;i<p.count;i++){
      const a=Math.random()*Math.PI*2,sp=2+Math.random()*9;
      p.px[i]=W/2+(Math.random()-0.5)*8; p.py[i]=H/2+(Math.random()-0.5)*8;
      p.pvx[i]=Math.cos(a)*sp; p.pvy[i]=Math.sin(a)*sp;
      p.pm[i]=0.2+Math.random(); p.pc[i]=Math.random(); p.palpha[i]=0.9;
    }
  },
  blackhole(p,W,H){
    for(let i=0;i<p.count;i++){
      const r=50+Math.random()*Math.min(W,H)*0.4,a=Math.random()*Math.PI*2;
      p.px[i]=W/2+Math.cos(a)*r; p.py[i]=H/2+Math.sin(a)*r;
      const sp=Math.sqrt(4500/r)*0.7;
      p.pvx[i]=-Math.sin(a)*sp; p.pvy[i]=Math.cos(a)*sp;
      p.pm[i]=0.3+Math.random(); p.pc[i]=r/(Math.min(W,H)*0.4); p.palpha[i]=0.6+Math.random()*0.4;
    }
  },
  plasma(p,W,H){
    for(let i=0;i<p.count;i++){
      p.px[i]=Math.random()*W; p.py[i]=Math.random()*H;
      p.pvx[i]=(Math.random()-0.5)*3; p.pvy[i]=(Math.random()-0.5)*3;
      p.pm[i]=0.3+Math.random()*0.7;
      p.pcharge[i]=(Math.random()>0.5?1:-1)*(0.5+Math.random()*1.5);
      p.pphase[i]=Math.random()*Math.PI*2; p.pc[i]=Math.random(); p.palpha[i]=0.8;
    }
  },
  doubleslit(p,W,H){
    for(let i=0;i<p.count;i++){
      p.px[i]=20+Math.random()*25; p.py[i]=H/2+(Math.random()-0.5)*H*0.8;
      p.pvx[i]=1.5+Math.random()*0.5; p.pvy[i]=(Math.random()-0.5)*0.3;
      p.pm[i]=0.3; p.pphase[i]=Math.random()*Math.PI*2; p.pc[i]=Math.random(); p.palpha[i]=0.8;
    }
  },
  solar(p,W,H){
    const planets=[{r:60,n:180},{r:100,n:250},{r:145,n:350},{r:195,n:420},{r:250,n:500},{r:295,n:350},{r:330,n:280},{r:365,n:180}];
    let idx=0;
    for(let j=0;j<400&&idx<p.count;j++,idx++){
      const a=Math.random()*Math.PI*2,rad=Math.random()*16;
      p.px[idx]=W/2+Math.cos(a)*rad; p.py[idx]=H/2+Math.sin(a)*rad;
      p.pvx[idx]=(Math.random()-0.5)*0.2; p.pvy[idx]=(Math.random()-0.5)*0.2;
      p.pm[idx]=3; p.pc[idx]=0.95; p.palpha[idx]=1;
    }
    for(const pl of planets){
      const sp=Math.sqrt(1200/pl.r)*0.65;
      for(let j=0;j<pl.n&&idx<p.count;j++,idx++){
        const a=Math.random()*Math.PI*2,dr=(Math.random()-0.5)*12;
        p.px[idx]=W/2+Math.cos(a)*(pl.r+dr); p.py[idx]=H/2+Math.sin(a)*(pl.r+dr);
        p.pvx[idx]=-Math.sin(a)*sp+(Math.random()-0.5)*0.3; p.pvy[idx]=Math.cos(a)*sp+(Math.random()-0.5)*0.3;
        p.pm[idx]=0.4+Math.random(); p.pc[idx]=pl.r/400; p.palpha[idx]=0.6+Math.random()*0.4;
      }
    }
  },
  bec(p,W,H){
    for(let i=0;i<p.count;i++){
      const r=Math.random()*70,a=Math.random()*Math.PI*2;
      p.px[i]=W/2+Math.cos(a)*r+(Math.random()-0.5)*15; p.py[i]=H/2+Math.sin(a)*r+(Math.random()-0.5)*15;
      p.pvx[i]=(Math.random()-0.5)*0.4; p.pvy[i]=(Math.random()-0.5)*0.4;
      p.pm[i]=0.5; p.pc[i]=r/70; p.palpha[i]=0.6+Math.random()*0.4;
    }
  },
  darkmatter(p,W,H){
    for(let i=0;i<p.count;i++){
      const vis=Math.random()>0.2;
      if(vis){const r=30+Math.random()*Math.min(W,H)*0.4,a=Math.random()*Math.PI*2;p.px[i]=W/2+Math.cos(a)*r*(0.5+Math.random()*0.5);p.py[i]=H/2+Math.sin(a)*r*(0.5+Math.random()*0.5);}
      else{p.px[i]=(Math.random()-0.5)*W*1.2+W/2;p.py[i]=(Math.random()-0.5)*H*1.2+H/2;}
      const r2=Math.sqrt((p.px[i]-W/2)**2+(p.py[i]-H/2)**2)+1;
      const sp=Math.sqrt(1.5/r2)*r2*0.04,a2=Math.atan2(p.py[i]-H/2,p.px[i]-W/2);
      p.pvx[i]=-Math.sin(a2)*sp; p.pvy[i]=Math.cos(a2)*sp;
      p.pm[i]=0.3+Math.random(); p.pc[i]=vis?0.4+Math.random()*0.4:0.05; p.palpha[i]=vis?0.5+Math.random()*0.5:0.08;
    }
  },
  dna(p,W,H){
    for(let i=0;i<p.count;i++){
      const t2=i/p.count,z3=t2*H*1.05-H*0.025,angle=t2*Math.PI*14,strand=i%3;
      let rx=0,c=0;
      if(strand<2){rx=Math.cos(angle+(strand===0?1:-1)*Math.PI/2)*40;c=strand===0?0.2:0.75;}
      else{rx=Math.cos(angle+Math.PI/2)*40*(Math.random()*0.6+0.2);c=0.5;}
      p.px[i]=W/2+rx+(Math.random()-0.5)*4; p.py[i]=z3+(Math.random()-0.5)*4;
      p.pvx[i]=(Math.random()-0.5)*0.1; p.pvy[i]=(Math.random()-0.5)*0.1;
      p.pm[i]=0.6+Math.random()*0.4; p.pc[i]=c; p.palpha[i]=0.7+Math.random()*0.3;
    }
  },
  vortex(p,W,H){
    for(let i=0;i<p.count;i++){
      const r=20+Math.random()*Math.min(W,H)*0.38,a=Math.random()*Math.PI*2;
      p.px[i]=W/2+Math.cos(a)*r+(Math.random()-0.5)*20; p.py[i]=H/2+Math.sin(a)*r+(Math.random()-0.5)*20;
      const sp=1.5+r*0.01;
      p.pvx[i]=-Math.sin(a)*sp; p.pvy[i]=Math.cos(a)*sp;
      p.pm[i]=1; p.pc[i]=0.3+Math.random()*0.5; p.palpha[i]=0.7;
    }
  },
  anntraining(p,W,H){
    const layers=[6,8,8,6,4];
    const lx=layers.map((_,i)=>80+(i/(layers.length-1))*(W-160));
    let idx=0;
    for(let l=0;l<layers.length;l++){
      for(let j=0;j<(layers[l]??0);j++){
        const cx2=lx[l]??0,cy2=H/2+(j-((layers[l]??0)-1)/2)*(H*0.12);
        const batchN=Math.floor(p.count/(layers.reduce((a,b)=>a+b,0)));
        for(let k=0;k<batchN&&idx<p.count;k++,idx++){
          const a=Math.random()*Math.PI*2,r=Math.random()*28;
          p.px[idx]=cx2+Math.cos(a)*r; p.py[idx]=cy2+Math.sin(a)*r;
          p.pvx[idx]=(Math.random()-0.5)*0.3; p.pvy[idx]=(Math.random()-0.5)*0.3;
          p.pm[idx]=0.5; p.pc[idx]=l/(layers.length-1); p.palpha[idx]=0.7+Math.random()*0.3;
        }
      }
    }
  },
  tunneling(p,W,H){
    for(let i=0;i<p.count;i++){
      p.px[i]=20+Math.random()*W*0.3; p.py[i]=H*0.2+Math.random()*H*0.6;
      p.pvx[i]=1+Math.random()*2; p.pvy[i]=(Math.random()-0.5)*0.5;
      p.pm[i]=0.3+Math.random()*0.4; p.pphase[i]=Math.random()*Math.PI*2;
      p.pc[i]=Math.random(); p.palpha[i]=0.6+Math.random()*0.4;
    }
  },
};

/* ─── Main hook ─────────────────────────────────────────────────────────── */
export function useParticleEngine({canvasRef}:EngineOptions){
  const store=useSimulatorStore();
  const {renderMode}=useWebGPU();
  const pRef=useRef<Particles|null>(null);
  const offRef=useRef<{buf:HTMLCanvasElement;ctx:CanvasRenderingContext2D}|null>(null);
  const textTargetsRef=useRef<Float32Array|null>(null);
  const imgTargetsRef=useRef<{tx:Float32Array;ty:Float32Array;tc:Float32Array;tr:Float32Array;tg:Float32Array;tb:Float32Array}|null>(null);
  const shapeModeRef=useRef(false);
  const imgModeRef=useRef(false);
  const currentShapeRef=useRef("galaxy");
  const forceModeRef=useRef<"attract"|"repel"|"orbit">("attract");
  const morphSpeedRef=useRef(0.08); // faster default
  const simTimeRef=useRef(0);
  const rotYRef=useRef(0); // running rotation angle
  const fpsRef=useRef({frames:0,acc:0,fps:0});
  const mouseRef=useRef({x:0,y:0,down:false,shift:false});
  // image colormap override (per-particle RGB when using image mode)
  const imgColorsRef=useRef<{r:Uint8Array;g:Uint8Array;b:Uint8Array}|null>(null);

  useEffect(()=>{store.setRenderMode(renderMode);},[renderMode]); // eslint-disable-line

  function getWH(){const c=canvasRef.current;return{W:c?.offsetWidth??800,H:c?.offsetHeight??600};}

  /* ── Instant shape snap: teleport particles to target positions ─────── */
  function snapToShape(shape:string){
    const{W,H}=getWH();
    let p=pRef.current;
    if(!p){p=alloc(store.particleCount);pRef.current=p;}
    const n=p.count;

    // Compute new targets
    computeShapeTargets(shape,n,W,H,p.tx,p.ty,p.tc);

    // INSTANT: teleport directly, zero velocity residual
    for(let i=0;i<n;i++){
      p.px[i]=p.tx[i]!+(Math.random()-0.5)*6;
      p.py[i]=p.ty[i]!+(Math.random()-0.5)*6;
      p.pvx[i]=(Math.random()-0.5)*0.5;
      p.pvy[i]=(Math.random()-0.5)*0.5;
      p.pc[i]=p.tc[i]!;
      p.palpha[i]=0.6+Math.random()*0.4;
    }
    textTargetsRef.current=null;
    imgModeRef.current=false;
    imgColorsRef.current=null;
    shapeModeRef.current=true;
    currentShapeRef.current=shape;
  }

  function initPreset(name:string){
    const{W,H}=getWH();
    const n=store.particleCount;
    const p=alloc(n);
    const fn=PRESET_INITS[name]??PRESET_INITS["galaxy"]!;
    fn(p,W,H);
    pRef.current=p;
    textTargetsRef.current=null;
    imgModeRef.current=false;
    imgColorsRef.current=null;
    shapeModeRef.current=false;
  }

  /* ── Text to particles ─────────────────────────────────────────────── */
  function buildTextTargets(text:string):Float32Array{
    const{W,H}=getWH();
    const off=document.createElement("canvas");
    off.width=W;off.height=H;
    const oc=off.getContext("2d")!;
    const fs=Math.min(160,W/Math.max(1,text.length)*1.8,H*0.65);
    oc.fillStyle="white";
    oc.font=`bold ${fs}px 'Space Grotesk',sans-serif`;
    oc.textAlign="center";oc.textBaseline="middle";
    oc.fillText(text,W/2,H/2);
    const imgData=oc.getImageData(0,0,W,H);
    const pts:number[]=[];
    const step=Math.max(2,Math.floor(Math.sqrt(W*H/store.particleCount)*0.9));
    for(let y=0;y<H;y+=step)for(let x=0;x<W;x+=step)
      if((imgData.data[(y*W+x)*4]??0)>100) pts.push(x+(Math.random()-0.5)*step,y+(Math.random()-0.5)*step);
    const nc=store.particleCount;
    const tgt=new Float32Array(nc*2);
    for(let i=0;i<nc;i++){tgt[i*2]=pts[(i*2)%pts.length]??W/2;tgt[i*2+1]=pts[(i*2+1)%pts.length]??H/2;}
    return tgt;
  }

  function activateText(text:string){
    const{W,H}=getWH();
    const tgt=buildTextTargets(text);
    const n=store.particleCount;
    const p=alloc(n);
    for(let i=0;i<n;i++){
      p.px[i]=Math.random()*W;p.py[i]=Math.random()*H;
      p.pvx[i]=(Math.random()-0.5)*8;p.pvy[i]=(Math.random()-0.5)*8;
      p.pm[i]=0.5+Math.random()*0.5;p.pc[i]=i/n;p.palpha[i]=0.9;
    }
    pRef.current=p;
    textTargetsRef.current=tgt;
    shapeModeRef.current=false;
    imgModeRef.current=false;
    imgColorsRef.current=null;
  }

  /* ── Image to particles ──────────────────────────────────────────────── */
  function activateImage(imageData:ImageData, srcW:number, srcH:number){
    const{W,H}=getWH();
    // Sample pixels
    const pts:{x:number;y:number;r:number;g:number;b:number}[]=[];
    const step=Math.max(2,Math.floor(Math.sqrt(srcW*srcH/store.particleCount)*0.9));
    const scaleX=W/srcW, scaleY=H/srcH;
    for(let y=0;y<srcH;y+=step){
      for(let x=0;x<srcW;x+=step){
        const idx=(y*srcW+x)*4;
        const r=imageData.data[idx]??0;
        const g=imageData.data[idx+1]??0;
        const b=imageData.data[idx+2]??0;
        const a=imageData.data[idx+3]??0;
        if(a>32) pts.push({
          x:x*scaleX+(Math.random()-0.5)*step*scaleX,
          y:y*scaleY+(Math.random()-0.5)*step*scaleY,
          r,g,b
        });
      }
    }
    const n=store.particleCount;
    const p=alloc(n);
    const itx=new Float32Array(n),ity=new Float32Array(n),itc=new Float32Array(n);
    const itr=new Float32Array(n),itg=new Float32Array(n),itb=new Float32Array(n);
    for(let i=0;i<n;i++){
      const src=pts[i%pts.length]!;
      p.px[i]=Math.random()*W; p.py[i]=Math.random()*H;
      p.pvx[i]=(Math.random()-0.5)*6; p.pvy[i]=(Math.random()-0.5)*6;
      p.pm[i]=0.5+Math.random()*0.5; p.palpha[i]=0.9;
      itx[i]=src.x; ity[i]=src.y;
      itr[i]=src.r; itg[i]=src.g; itb[i]=src.b;
      const lum=0.2126*src.r+0.7152*src.g+0.0722*src.b;
      p.pc[i]=lum/255; itc[i]=lum/255;
    }
    imgTargetsRef.current={tx:itx,ty:ity,tc:itc,tr:itr,tg:itg,tb:itb};
    const ir=new Uint8Array(n),ig=new Uint8Array(n),ib2=new Uint8Array(n);
    for(let i=0;i<n;i++){ir[i]=itr[i]!;ig[i]=itg[i]!;ib2[i]=itb[i]!;}
    imgColorsRef.current={r:ir,g:ig,b:ib2};
    pRef.current=p;
    shapeModeRef.current=false;
    imgModeRef.current=true;
    textTargetsRef.current=null;
  }

  /* ── Canvas setup ─────────────────────────────────────────────────── */
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas) return;
    const dpr=window.devicePixelRatio||1;
    canvas.width=canvas.offsetWidth*dpr; canvas.height=canvas.offsetHeight*dpr;
    const buf=document.createElement("canvas");
    buf.width=canvas.width; buf.height=canvas.height;
    const ctx=buf.getContext("2d")!;
    ctx.scale(dpr,dpr);
    offRef.current={buf,ctx};
    initPreset("galaxy");

    const ro=new ResizeObserver(()=>{
      const dpr2=window.devicePixelRatio||1;
      canvas.width=canvas.offsetWidth*dpr2; canvas.height=canvas.offsetHeight*dpr2;
      const b2=document.createElement("canvas");
      b2.width=canvas.width; b2.height=canvas.height;
      const c2=b2.getContext("2d")!; c2.scale(dpr2,dpr2);
      offRef.current={buf:b2,ctx:c2};
    });
    ro.observe(canvas);
    return()=>ro.disconnect();
  },[]);// eslint-disable-line

  /* ── Event bus ────────────────────────────────────────────────────── */
  useEffect(()=>{
    const onPreset=(e:Event)=>{const name=(e as CustomEvent).detail as string;store.setActivePreset(name as never);initPreset(name);};
    const onShape=(e:Event)=>{const s=(e as CustomEvent).detail as string;if(s==="galaxy"){initPreset("galaxy");shapeModeRef.current=false;}else snapToShape(s);};
    const onText=(e:Event)=>activateText((e as CustomEvent).detail as string);
    const onExplode=()=>{const p=pRef.current;if(!p)return;for(let i=0;i<p.count;i++){p.pvx[i]=(p.pvx[i]??0)+(Math.random()-0.5)*24;p.pvy[i]=(p.pvy[i]??0)+(Math.random()-0.5)*24;}};
    const onForce=(e:Event)=>{forceModeRef.current=(e as CustomEvent).detail as "attract"|"repel"|"orbit";};
    const onMorph=(e:Event)=>{morphSpeedRef.current=(e as CustomEvent).detail as number;};
    const onPCount=(e:Event)=>{store.setParticleCount((e as CustomEvent).detail as number);setTimeout(()=>initPreset(store.activePreset??"galaxy"),30);};
    const onPhysics=(e:Event)=>{store.setPhysicsMode((e as CustomEvent).detail as never);};
    const onImageData=(e:Event)=>{const{data,w,h}=(e as CustomEvent).detail as{data:ImageData;w:number;h:number};activateImage(data,w,h);};

    window.addEventListener("qf:loadPreset",onPreset);
    window.addEventListener("qf:loadShape",onShape);
    window.addEventListener("qf:textParticles",onText);
    window.addEventListener("qf:explode",onExplode);
    window.addEventListener("qf:forceMode",onForce);
    window.addEventListener("qf:morphSpeed",onMorph);
    window.addEventListener("qf:particleCount",onPCount);
    window.addEventListener("qf:physicsMode",onPhysics);
    window.addEventListener("qf:imageData",onImageData);
    return()=>{
      window.removeEventListener("qf:loadPreset",onPreset);
      window.removeEventListener("qf:loadShape",onShape);
      window.removeEventListener("qf:textParticles",onText);
      window.removeEventListener("qf:explode",onExplode);
      window.removeEventListener("qf:forceMode",onForce);
      window.removeEventListener("qf:morphSpeed",onMorph);
      window.removeEventListener("qf:particleCount",onPCount);
      window.removeEventListener("qf:physicsMode",onPhysics);
      window.removeEventListener("qf:imageData",onImageData);
    };
  });// eslint-disable-line

  /* ── Main frame loop ─────────────────────────────────────────────── */
  const onFrame=useCallback((dt:number)=>{
    const canvas=canvasRef.current;
    const off=offRef.current;
    const p=pRef.current;
    if(!canvas||!off||!p) return;

    const dpr=window.devicePixelRatio||1;
    const W=canvas.offsetWidth,H=canvas.offsetHeight;
    const DT=Math.min(dt,3)*store.timeScale;
    simTimeRef.current+=dt/60;
    rotYRef.current+=0.008*store.timeScale; // continuous rotation for shapes

    /* ── Mouse force ── */
    if(mouseRef.current.down){
      const{x:mx,y:my}=mouseRef.current;
      const r2Max=store.forceRadius**2;
      const fm=forceModeRef.current;
      const isOrb=fm==="orbit",isRep=mouseRef.current.shift||fm==="repel";
      for(let i=0;i<p.count;i++){
        const dx=(p.px[i]??0)-mx,dy=(p.py[i]??0)-my;
        const r2=dx*dx+dy*dy;
        if(r2<r2Max&&r2>1){
          const r=Math.sqrt(r2),f=(store.forceStrength*(1-r/store.forceRadius))/r;
          if(isOrb){p.pvx[i]=(p.pvx[i]??0)-dy*f*0.5;p.pvy[i]=(p.pvy[i]??0)+dx*f*0.5;}
          else if(isRep){p.pvx[i]=(p.pvx[i]??0)+dx*f*0.7;p.pvy[i]=(p.pvy[i]??0)+dy*f*0.7;}
          else{p.pvx[i]=(p.pvx[i]??0)-dx*f*0.7;p.pvy[i]=(p.pvy[i]??0)-dy*f*0.7;}
        }
      }
    }

    /* ── Shape morph: fast spring to pre-computed targets with rotation ── */
    if(shapeModeRef.current){
      const ms=Math.min(morphSpeedRef.current*DT,0.35); // clamp for stability
      const rY=rotYRef.current;
      const cosY=Math.cos(rY),sinY=Math.sin(rY);
      const{W:W2,H:H2}=getWH();
      // Re-compute targets with current rotation angle
      computeShapeTargets(currentShapeRef.current,p.count,W2,H2,p.tx,p.ty,p.tc);
      // Apply rotation to targets
      const cx=W2/2,cy=H2/2;
      for(let i=0;i<p.count;i++){
        const lx=(p.tx[i]??0)-cx,ly=(p.ty[i]??0)-cy;
        const rx=lx*cosY-ly*sinY*0.15+cx;
        const ry=lx*sinY*0.1+ly*cosY+cy;
        const dx=rx-(p.px[i]??0),dy=ry-(p.py[i]??0);
        p.pvx[i]=((p.pvx[i]??0)+dx*ms)*0.82;
        p.pvy[i]=((p.pvy[i]??0)+dy*ms)*0.82;
        p.px[i]=(p.px[i]??0)+(p.pvx[i]??0)*DT;
        p.py[i]=(p.py[i]??0)+(p.pvy[i]??0)*DT;
        p.pc[i]=p.tc[i]!;
        p.palpha[i]=0.75+Math.random()*0.25;
      }
    }
    /* ── Image morph ── */
    else if(imgModeRef.current&&imgTargetsRef.current){
      const{tx:itx,ty:ity}=imgTargetsRef.current;
      const ms=Math.min(0.08*DT,0.35);
      for(let i=0;i<p.count;i++){
        const dx=(itx[i]??0)-(p.px[i]??0),dy=(ity[i]??0)-(p.py[i]??0);
        p.pvx[i]=((p.pvx[i]??0)+dx*ms)*0.84;
        p.pvy[i]=((p.pvy[i]??0)+dy*ms)*0.84;
        p.px[i]=(p.px[i]??0)+(p.pvx[i]??0)*DT;
        p.py[i]=(p.py[i]??0)+(p.pvy[i]??0)*DT;
        p.px[i]=Math.max(0,Math.min(W,p.px[i]??0));
        p.py[i]=Math.max(0,Math.min(H,p.py[i]??0));
        p.palpha[i]=0.9;
      }
    }
    /* ── Text morph ── */
    else if(textTargetsRef.current){
      const tgt=textTargetsRef.current;
      const ms=Math.min(0.06*DT,0.3);
      for(let i=0;i<p.count;i++){
        const tx2=tgt[i*2]??W/2,ty2=tgt[i*2+1]??H/2;
        const dx=tx2-(p.px[i]??0),dy=ty2-(p.py[i]??0);
        p.pvx[i]=((p.pvx[i]??0)+dx*ms)*0.86;
        p.pvy[i]=((p.pvy[i]??0)+dy*ms)*0.86;
        p.px[i]=(p.px[i]??0)+(p.pvx[i]??0)*DT;
        p.py[i]=(p.py[i]??0)+(p.pvy[i]??0)*DT;
        p.px[i]=Math.max(0,Math.min(W,p.px[i]??0));
        p.py[i]=Math.max(0,Math.min(H,p.py[i]??0));
      }
    }
    /* ── Physics modes ── */
    else{
      const mode=store.physicsMode;
      if(mode==="quantum"){
        applyQuantumDrift(p.px,p.py,p.pvx,p.pvy,p.pphase,p.count,DT,
          {G:store.gravityG,k:8.99e9,hbar:1.055,c:299,epsilon0:8.85e-12,mu0:4*Math.PI*1e-7,kB:1.38e-23,dt:DT,substeps:1},W,H);
      }else if(mode==="relativity"){
        applyRelativity(p.px,p.py,p.pvx,p.pvy,p.pm,p.pc,p.palpha,p.count,DT,
          {G:store.gravityG,k:8.99e9,hbar:1.055,c:15,epsilon0:8.85e-12,mu0:4*Math.PI*1e-7,kB:1.38e-23,dt:DT,substeps:1},W,H,500000);
      }else if(mode==="future"){
        applyFuturePhysics(p.px,p.py,p.pvx,p.pvy,p.pm,p.pc,p.pphase,p.count,DT,"dark",simTimeRef.current,W,H);
      }else if(mode==="em"){
        const Bz=0.06,cx=W/2,cy=H/2;
        for(let i=0;i<p.count;i++){
          const q=p.pcharge[i]??0,vx=p.pvx[i]??0,vy=p.pvy[i]??0;
          const Ex=(cx-(p.px[i]??0))*0.002,Ey=(cy-(p.py[i]??0))*0.002;
          p.pvx[i]=(vx+q*(Ex+vy*Bz)/(p.pm[i]??1)*DT)*0.999;
          p.pvy[i]=(vy+q*(Ey-vx*Bz)/(p.pm[i]??1)*DT)*0.999;
          p.px[i]=(p.px[i]??0)+(p.pvx[i]??0)*DT;
          p.py[i]=(p.py[i]??0)+(p.pvy[i]??0)*DT;
          p.px[i]=Math.max(0,Math.min(W,p.px[i]??0));
          p.py[i]=Math.max(0,Math.min(H,p.py[i]??0));
          if((p.px[i]??0)<=0||(p.px[i]??0)>=W)p.pvx[i]=-(p.pvx[i]??0)*0.8;
          if((p.py[i]??0)<=0||(p.py[i]??0)>=H)p.pvy[i]=-(p.pvy[i]??0)*0.8;
          p.pc[i]=(q>0?0.1:0.6)+Math.sqrt((p.pvx[i]??0)**2+(p.pvy[i]??0)**2)*0.07;
        }
      }else{
        // Classical grid gravity
        const G=store.gravityG;
        const cellSize=70,gcx2=Math.ceil(W/cellSize)+1,gcy2=Math.ceil(H/cellSize)+1;
        const gM=new Float32Array(gcx2*gcy2),gX=new Float32Array(gcx2*gcy2),gY=new Float32Array(gcx2*gcy2);
        for(let i=0;i<p.count;i++){
          const gx=Math.max(0,Math.min(gcx2-1,Math.floor((p.px[i]??0)/cellSize)));
          const gy=Math.max(0,Math.min(gcy2-1,Math.floor((p.py[i]??0)/cellSize)));
          const gi=gy*gcx2+gx;
          gM[gi]=(gM[gi]??0)+(p.pm[i]??1);gX[gi]=(gX[gi]??0)+(p.px[i]??0)*(p.pm[i]??1);gY[gi]=(gY[gi]??0)+(p.py[i]??0)*(p.pm[i]??1);
        }
        for(let i=0;i<p.count;i++){
          let ax=0,ay=0;
          const gxi=Math.floor((p.px[i]??0)/cellSize),gyi=Math.floor((p.py[i]??0)/cellSize);
          for(let dgx=-2;dgx<=2;dgx++)for(let dgy=-2;dgy<=2;dgy++){
            const nx2=gxi+dgx,ny2=gyi+dgy;
            if(nx2<0||nx2>=gcx2||ny2<0||ny2>=gcy2)continue;
            const gi=ny2*gcx2+nx2,mass=gM[gi]??0;
            if(mass<0.001)continue;
            const cmx=(gX[gi]??0)/mass,cmy=(gY[gi]??0)/mass;
            const dx=cmx-(p.px[i]??0),dy=cmy-(p.py[i]??0);
            const r2=dx*dx+dy*dy+200,r=Math.sqrt(r2);
            const f=G*mass/r2;ax+=f*dx/r;ay+=f*dy/r;
          }
          const dcx=W/2-(p.px[i]??0),dcy=H/2-(p.py[i]??0);
          const rc2=dcx*dcx+dcy*dcy+400,rc=Math.sqrt(rc2);
          ax+=G*0.4*dcx/rc2;ay+=G*0.4*dcy/rc2;
          p.pvx[i]=((p.pvx[i]??0)+ax*DT)*0.9998;
          p.pvy[i]=((p.pvy[i]??0)+ay*DT)*0.9998;
          p.px[i]=(p.px[i]??0)+(p.pvx[i]??0)*DT;
          p.py[i]=(p.py[i]??0)+(p.pvy[i]??0)*DT;
          if((p.px[i]??0)<0)p.px[i]=W;else if((p.px[i]??0)>W)p.px[i]=0;
          if((p.py[i]??0)<0)p.py[i]=H;else if((p.py[i]??0)>H)p.py[i]=0;
          p.pc[i]=Math.min(1,Math.sqrt((p.pvx[i]??0)**2+(p.pvy[i]??0)**2)*0.15);
        }
      }
    }

    /* ── Render ───────────────────────────────────────────────────────── */
    const{ctx:oc,buf}=off;
    // Trail — no white flicker: always pure dark fill
    oc.fillStyle=`rgba(13,14,19,${1-store.trailDecay})`;
    oc.fillRect(0,0,W,H);

    const sz=store.particleSize;
    const bm=store.bloomIntensity;
    const cm=CMAPS[store.colormap]??CMAPS["viridis"]!;
    const useImgColor=imgModeRef.current&&!!imgColorsRef.current;
    const imgC=imgColorsRef.current;

    // Pre-build color string cache for this frame (optional small batch)
    for(let i=0;i<p.count;i++){
      const x=p.px[i]??0,y=p.py[i]??0;
      if(x<-8||x>W+8||y<-8||y>H+8) continue;

      let r:number,g:number,b:number;
      if(useImgColor&&imgC){
        r=imgC.r[i]??128; g=imgC.g[i]??128; b=imgC.b[i]??128;
      }else{
        const t=Math.min(1,Math.max(0,p.pc[i]??0));
        [r,g,b]=cm(t);
      }
      const a=Math.min(1,Math.max(0,p.palpha[i]??0.8));
      const mass=p.pm[i]??1;
      const s=sz*(0.55+mass*0.45);

      // Layer 1: large soft outer glow
      if(bm>0.1&&a>0.35){
        const glowR=s*5+3;
        const grd=oc.createRadialGradient(x,y,0,x,y,glowR);
        grd.addColorStop(0,`rgba(${r},${g},${b},${a*bm*0.25})`);
        grd.addColorStop(0.4,`rgba(${r},${g},${b},${a*bm*0.1})`);
        grd.addColorStop(1,"rgba(0,0,0,0)");
        oc.fillStyle=grd;
        oc.beginPath();oc.arc(x,y,glowR,0,Math.PI*2);oc.fill();
      }

      // Layer 2: medium glow halo
      if(bm>0.3&&a>0.5){
        const glowR2=s*2.5+1;
        const grd2=oc.createRadialGradient(x,y,0,x,y,glowR2);
        grd2.addColorStop(0,`rgba(${r},${g},${b},${a*bm*0.55})`);
        grd2.addColorStop(1,"rgba(0,0,0,0)");
        oc.fillStyle=grd2;
        oc.beginPath();oc.arc(x,y,glowR2,0,Math.PI*2);oc.fill();
      }

      // Layer 3: bright core dot
      oc.fillStyle=`rgba(${r},${g},${b},${a})`;
      oc.beginPath();oc.arc(x,y,Math.max(0.5,s),0,Math.PI*2);oc.fill();

      // Layer 4: specular highlight (tiny bright center)
      if(s>1.2&&a>0.6&&bm>0.2){
        const hr=Math.max(0.3,s*0.35);
        oc.fillStyle=`rgba(255,255,255,${a*0.55})`;
        oc.beginPath();oc.arc(x-s*0.2,y-s*0.2,hr,0,Math.PI*2);oc.fill();
      }
    }

    // Overlays
    if(store.activePreset==="doubleslit"){
      oc.strokeStyle="rgba(143,245,255,0.1)";oc.lineWidth=3;
      oc.strokeRect(W/2-5,0,10,H/2-40);oc.strokeRect(W/2-5,H/2+40,10,H/2-40);
      oc.fillStyle="rgba(255,201,101,0.05)";oc.fillRect(W/2-5,H/2-38,10,76);
    }
    if(store.activePreset==="blackhole"){
      const grd3=oc.createRadialGradient(W/2,H/2,0,W/2,H/2,55);
      grd3.addColorStop(0,"rgba(0,0,0,1)");grd3.addColorStop(1,"rgba(0,0,0,0)");
      oc.fillStyle=grd3;oc.beginPath();oc.arc(W/2,H/2,55,0,Math.PI*2);oc.fill();
    }
    // Mouse force ring
    if(mouseRef.current.down){
      const{x:mx,y:my}=mouseRef.current;
      const fm=forceModeRef.current;
      const[cr,cg,cb]=fm==="orbit"?[172,137,255]:fm==="repel"?[172,137,255]:[143,245,255];
      const mgrd=oc.createRadialGradient(mx,my,0,mx,my,store.forceRadius);
      mgrd.addColorStop(0,`rgba(${cr},${cg},${cb},0.15)`);mgrd.addColorStop(1,"transparent");
      oc.fillStyle=mgrd;oc.beginPath();oc.arc(mx,my,store.forceRadius,0,Math.PI*2);oc.fill();
      oc.strokeStyle=`rgba(${cr},${cg},${cb},0.25)`;oc.lineWidth=1;
      oc.beginPath();oc.arc(mx,my,store.forceRadius,0,Math.PI*2);oc.stroke();
    }

    // Blit to screen — no globalCompositeOperation changes to avoid flicker
    const mainCtx=canvas.getContext("2d")!;
    mainCtx.clearRect(0,0,W*dpr,H*dpr);
    mainCtx.drawImage(buf,0,0,W*dpr,H*dpr);

    // Stats update (every ~30 frames)
    const fpsCtr=fpsRef.current;
    fpsCtr.frames++;fpsCtr.acc+=dt;
    if(fpsCtr.acc>=30){
      const fps2=Math.round(fpsCtr.frames/(fpsCtr.acc/60));
      fpsCtr.fps=fps2;fpsCtr.frames=0;fpsCtr.acc=0;
      store.setFps(fps2);
      let ke=0;const sm=Math.min(p.count,300);
      for(let i=0;i<sm;i++) ke+=0.5*(p.pm[i]??1)*((p.pvx[i]??0)**2+(p.pvy[i]??0)**2);
      store.setKineticEnergy(Math.round(ke*(p.count/sm)));
      store.incrementSimTime(1);
      const cnt=p.count.toLocaleString();
      ["s-count","hud-count"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=cnt;});
      ["s-fps","hud-fps"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=String(fps2);});
      const keStr=store.kineticEnergy.toLocaleString();
      ["s-ke","hud-ke"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=keStr;});
      const tStr=simTimeRef.current.toFixed(1)+"s";
      ["s-time","hud-time"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=tStr;});
    }
  },[store]);// eslint-disable-line

  useAnimationFrame({onFrame,enabled:store.isRunning});

  return{
    mouseRef,
    reinit:(name:string)=>initPreset(name),
    explode:()=>{const p=pRef.current;if(!p)return;for(let i=0;i<p.count;i++){p.pvx[i]=(p.pvx[i]??0)+(Math.random()-0.5)*24;p.pvy[i]=(p.pvy[i]??0)+(Math.random()-0.5)*24;}},
  };
}
