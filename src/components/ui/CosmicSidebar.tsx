"use client";
import { useState, useEffect, useRef } from "react";
import { useSimulatorStore } from "@/store/simulatorStore";
import type { ColormapName, PresetName } from "@/types";

const SHAPES=[
  {id:"sphere",label:"Sphere"},{id:"cube",label:"Cube"},
  {id:"helix",label:"Helix"},{id:"donut",label:"Donut"},
  {id:"cylinder",label:"Cylinder"},{id:"torus",label:"Torus"},
  {id:"dna",label:"DNA"},{id:"lissajous",label:"Lissa"},
  {id:"flower",label:"Flower"},{id:"crystal",label:"Crystal"},
  {id:"mobius",label:"Mobius"},{id:"klein",label:"Klein"},
  {id:"trefoil",label:"Trefoil"},{id:"octahed",label:"Octa"},
  {id:"wave",label:"Wave"},{id:"spiral",label:"Spiral"},
  {id:"heart",label:"Heart"},{id:"galaxy",label:"Galaxy"},
  {id:"text",label:"Text→"},
  {id:"image",label:"Img→"},
] as const;

const COLORMAPS:[ColormapName,string][]=[
  ["viridis","linear-gradient(to right,#440154,#31688e,#35b779,#fde725)"],
  ["inferno","linear-gradient(to right,#000004,#7c2a8a,#e75c2d,#fcffa4)"],
  ["plasma","linear-gradient(to right,#0d0887,#9b179e,#ed7953,#f0f921)"],
  ["turbo","linear-gradient(to right,#30123b,#2874f0,#2dcc70,#f8d52b,#d32f06)"],
  ["aurora","linear-gradient(to right,#09122e,#1e557b,#2ba37d,#89e457,#c6ffaa)"],
  ["cyan","linear-gradient(to right,#020d1a,#003f5c,#00d4ff,#8ff5ff)"],
  ["fire","linear-gradient(to right,#100000,#8b0000,#ff4500,#ffff00)"],
  ["magma","linear-gradient(to right,#1a0030,#5500aa,#ac89ff,#e8d0ff)"],
  ["rainbow","linear-gradient(to right,#ff0050,#ff6400,#c8dc00,#00dc50,#00b4ff,#9600ff)"],
  ["neon","linear-gradient(to right,#00ffc8,#0096ff,#c800ff,#ff0096,#ffc800)"],
];

const PRESETS:[PresetName,string,string,string][]=[
  ["galaxy","◎","Galaxy","F=Gm₁m₂/r²"],
  ["bigbang","◉","Big Bang","V=H₀·r"],
  ["blackhole","●","Black Hole","rs=2GM/c²"],
  ["supernova","✺","Supernova","L=4πR²σT⁴"],
  ["plasma","⌀","Plasma Storm","F=q(E+v×B)"],
  ["doubleslit","◈","Double Slit","P=|ψ₁+ψ₂|²"],
  ["electroncloud","⚛","Electron Cloud","ψnlm = Rnl·Ylm"],
  ["wavecollapse","∿","Wave Collapse","ΔxΔp≥ℏ/2"],
  ["solar","⊙","Solar System","T²∝a³"],
  ["bec","◻","BEC","E=ℏω(n+½)"],
  ["darkmatter","✦","Dark Matter","Ω≈0.27"],
  ["strings","≈","Strings","S=−∫d²σ·∂X²/2α′"],
  ["dna","⌇","DNA Helix","3.4Å/bp"],
  ["vortex","⟳","Fluid Vortex","∇×v=ω"],
  ["anntraining","⊛","Neural Net","σ(z)=1/(1+e⁻ᶻ)"],
  ["cnn","▦","CNN","conv(x,w)+b"],
  ["transformer","⇄","Transformer","Attn=softmax(QKᵀ/√d)V"],
  ["gan","⚖","GAN","min_G max_D V(D,G)"],
  ["portrait","◉","Portrait","Poisson sampling"],
  ["tunneling","⇝","Q.Tunneling","T≈e^{-2κa}"],
];

const PARTICLE_OPTIONS=[5000,10000,25000,50000,100000,150000,200000] as const;

const COLOR_PRESETS=[
  {id:"ion",label:"Ion",start:"#00d4ff",end:"#53ffc7"},
  {id:"sun",label:"Solar",start:"#ffd166",end:"#ff5f00"},
  {id:"pulse",label:"Pulse",start:"#7b61ff",end:"#ff4d8d"},
  {id:"jade",label:"Jade",start:"#00e9a7",end:"#7dff7a"},
  {id:"arc",label:"Arc",start:"#49c8ff",end:"#ff4784"},
  {id:"mint",label:"Mint",start:"#98ffe0",end:"#17d9ff"},
] as const;

interface VisualStylePreset {
  id: string;
  label: string;
  gradient: string;
  colormap: ColormapName;
  brightness: number;
  glow: number;
  bloom: number;
  trailDecay: number;
  particleSize: number;
  palette?: { start: string; end: string };
}

const VISUAL_STYLES: VisualStylePreset[] = [
  {
    id: "spark",
    label: "Spark",
    gradient: "linear-gradient(135deg,#00d4ff,#53ffc7)",
    colormap: "neon",
    brightness: 1.08,
    glow: 1.16,
    bloom: 0.26,
    trailDecay: 0.84,
    particleSize: 1.9,
  },
  {
    id: "plasma",
    label: "Plasma",
    gradient: "linear-gradient(135deg,#ff7a00,#ff2f92)",
    colormap: "plasma",
    brightness: 1.2,
    glow: 1.34,
    bloom: 0.48,
    trailDecay: 0.82,
    particleSize: 2.0,
  },
  {
    id: "ink",
    label: "Ink",
    gradient: "linear-gradient(135deg,#1a1f2f,#5f6b7d)",
    colormap: "inferno",
    brightness: 0.72,
    glow: 0.3,
    bloom: 0.04,
    trailDecay: 0.95,
    particleSize: 1.2,
  },
  {
    id: "paint",
    label: "Paint",
    gradient: "linear-gradient(135deg,#ff0050,#ffc800,#00d96c)",
    colormap: "rainbow",
    brightness: 1.14,
    glow: 0.92,
    bloom: 0.18,
    trailDecay: 0.88,
    particleSize: 2.15,
  },
  {
    id: "steel",
    label: "Steel",
    gradient: "linear-gradient(135deg,#8a98a8,#f3f6ff)",
    colormap: "cyan",
    brightness: 0.92,
    glow: 0.54,
    bloom: 0.14,
    trailDecay: 0.91,
    particleSize: 1.55,
    palette: { start: "#8a98a8", end: "#f3f6ff" },
  },
  {
    id: "glass",
    label: "Glass",
    gradient: "linear-gradient(135deg,#7ce4ff,#d8f1ff)",
    colormap: "aurora",
    brightness: 1,
    glow: 0.62,
    bloom: 0.24,
    trailDecay: 0.9,
    particleSize: 1.45,
    palette: { start: "#7ce4ff", end: "#d8f1ff" },
  },
  {
    id: "vector",
    label: "Vector",
    gradient: "linear-gradient(135deg,#2d7dff,#44f59f)",
    colormap: "turbo",
    brightness: 0.98,
    glow: 0.2,
    bloom: 0.02,
    trailDecay: 0.97,
    particleSize: 1.08,
  },
];

function hexToRgb(hex:string):[number,number,number]{
  const raw=hex.replace("#","");
  const full=raw.length===3?raw.split("").map(ch=>`${ch}${ch}`).join(""):raw;
  const parsed=Number.parseInt(full,16);
  const r=(parsed>>16)&255;
  const g=(parsed>>8)&255;
  const b=parsed&255;
  return[r,g,b];
}

function Section({title,children,open=true}:{title:string;children:React.ReactNode;open?:boolean}){
  const[isOpen,setIsOpen]=useState(open);
  return(
    <div style={{borderBottom:"1px solid rgba(143,245,255,0.05)"}}>
      <button onClick={()=>setIsOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"var(--font-space-grotesk),'Space Grotesk',sans-serif",fontSize:8,fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(143,245,255,0.38)"}} aria-expanded={isOpen}>
        {title}<span style={{fontSize:8,transition:"transform 0.2s",transform:isOpen?"none":"rotate(-90deg)"}}>▼</span>
      </button>
      {isOpen&&<div style={{padding:"4px 14px 10px"}}>{children}</div>}
    </div>
  );
}

function Slider({label,value,min,max,step,unit="",format,onChange}:{label:string;value:number;min:number;max:number;step:number;unit?:string;format?:(v:number)=>string;onChange:(v:number)=>void;}){
  const display=format?format(value):`${value.toFixed(step<1?2:0)}${unit}`;
  return(
    <div style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:10,color:"var(--text-muted)"}}>{label}</span>
        <span style={{fontFamily:"monospace",fontSize:10,color:"var(--primary)"}}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))} aria-label={label}/>
    </div>
  );
}

export default function CosmicSidebar(){
  const store=useSimulatorStore();
  const[textInput,setTextInput]=useState("QUANTUM");
  const[activeShape,setActiveShape]=useState("sphere");
  const[activeStyle,setActiveStyle]=useState("spark");
  const[forceMode,setForceModeLocal]=useState<"attract"|"repel"|"orbit">("attract");
  const[morphSpeed,setMorphSpeed]=useState(0.2);
  const[imgPreview,setImgPreview]=useState<string|null>(null);
  const[imgLoading,setImgLoading]=useState(false);
  const[customPaletteEnabled,setCustomPaletteEnabled]=useState(false);
  const[customStart,setCustomStart]=useState("#00d4ff");
  const[customEnd,setCustomEnd]=useState("#ff548a");
  const[colorBrightness,setColorBrightness]=useState(1.08);
  const[glowGain,setGlowGain]=useState(1.16);
  const[imageExactMode,setImageExactMode]=useState(true);
  const[cursorFieldEnabled,setCursorFieldEnabled]=useState(false);
  const[cursorFieldStrength,setCursorFieldStrength]=useState(0.85);
  const[cursorFieldRadius,setCursorFieldRadius]=useState(1);
  const imgInputRef=useRef<HTMLInputElement>(null);
  const dropRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const handler=(e:Event)=>setActiveShape((e as CustomEvent).detail as string);
    window.addEventListener("qf:shapeChanged",handler as EventListener);
    return()=>window.removeEventListener("qf:shapeChanged",handler as EventListener);
  },[]);

  useEffect(()=>{
    window.dispatchEvent(new CustomEvent("qf:customPalette",{
      detail:{
        enabled:customPaletteEnabled,
        start:hexToRgb(customStart),
        end:hexToRgb(customEnd),
      }
    }));
  },[customPaletteEnabled,customStart,customEnd]);

  useEffect(()=>{
    window.dispatchEvent(new CustomEvent("qf:renderTuning",{
      detail:{brightness:colorBrightness,glow:glowGain}
    }));
  },[colorBrightness,glowGain]);

  useEffect(()=>{
    window.dispatchEvent(new CustomEvent("qf:cursorField",{
      detail:{enabled:cursorFieldEnabled,strength:cursorFieldStrength,radius:cursorFieldRadius}
    }));
  },[cursorFieldEnabled,cursorFieldStrength,cursorFieldRadius]);

  useEffect(()=>()=>{
    if(imgPreview) URL.revokeObjectURL(imgPreview);
  },[imgPreview]);

  const handleShape=(shape:string)=>{
    if(shape==="text"||shape==="image") return; // handled separately
    setActiveShape(shape);
    window.dispatchEvent(new CustomEvent("qf:loadShape",{detail:shape}));
  };

  const applyVisualStyle=(styleId:string)=>{
    const style=VISUAL_STYLES.find((s)=>s.id===styleId);
    if(!style) return;
    setActiveStyle(style.id);
    setColorBrightness(style.brightness);
    setGlowGain(style.glow);
    store.setBloom(style.bloom);
    store.setTrailDecay(style.trailDecay);
    store.setParticleSize(style.particleSize);
    store.setColormap(style.colormap);
    if(style.palette){
      setCustomStart(style.palette.start);
      setCustomEnd(style.palette.end);
      setCustomPaletteEnabled(true);
    }else{
      setCustomPaletteEnabled(false);
    }
  };

  useEffect(()=>{
    applyVisualStyle("spark");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const handleForce=(m:"attract"|"repel"|"orbit")=>{
    setForceModeLocal(m);
    store.setForceMode(m==="orbit"?"attract":m);
    window.dispatchEvent(new CustomEvent("qf:forceMode",{detail:m}));
  };

  const applyParticleCount=(count:number)=>{
    const next=Math.max(1000,Math.min(200000,Math.round(count)));
    store.setParticleCount(next);
    window.dispatchEvent(new CustomEvent("qf:particleCount",{detail:next}));
  };

  const processImageFile=(file:File)=>{
    if(!file.type.startsWith("image/")) return;
    setImgLoading(true);
    const url=URL.createObjectURL(file);
    setImgPreview(prev=>{if(prev)URL.revokeObjectURL(prev);return url;});
    const img=new Image();
    img.onload=()=>{
      const particleBudget=Math.max(1000,store.particleCount);
      const sourceArea=Math.max(1,img.width*img.height);
      const densityBudget=imageExactMode?particleBudget:particleBudget*0.95;
      const scaleByBudget=Math.sqrt(densityBudget/sourceArea);
      const maxDim=720;
      const scaleByMax=Math.min(maxDim/img.width,maxDim/img.height,1);
      const scale=Math.max(0.04,Math.min(1,scaleByBudget,scaleByMax));
      const w=Math.max(2,Math.round(img.width*scale));
      const h=Math.max(2,Math.round(img.height*scale));
      const off=document.createElement("canvas");
      off.width=w; off.height=h;
      const oc=off.getContext("2d")!;
      oc.imageSmoothingEnabled=true;
      oc.imageSmoothingQuality="high";
      oc.drawImage(img,0,0,w,h);
      const imageData=oc.getImageData(0,0,w,h);
      window.dispatchEvent(new CustomEvent("qf:imageData",{detail:{data:imageData,w,h,exact:imageExactMode}}));
      setActiveShape("image");
      setImgLoading(false);
    };
    img.onerror=()=>{
      setImgLoading(false);
      setImgPreview(prev=>{if(prev)URL.revokeObjectURL(prev);return null;});
    };
    img.src=url;
  };

  const handleDrop=(e:React.DragEvent)=>{
    e.preventDefault();
    const file=e.dataTransfer.files[0];
    if(file) processImageFile(file);
  };

  if(!store.sidebarOpen) return null;

  const btn=(label:string,active:boolean,onClick:()=>void,color:"primary"|"secondary"|"tertiary"="primary")=>{
    const c={primary:"rgba(143,245,255",secondary:"rgba(172,137,255",tertiary:"rgba(255,201,101"}[color];
    return(
      <button onClick={onClick} style={{flex:1,padding:"5px 4px",background:active?`${c},0.08)`:"rgba(18,19,25,0.8)",border:`1px solid ${active?`${c},0.4)`:`${c},0.12)`}`,color:active?`${c.replace("rgba","rgb").replace(",0.08)",")")} ` :"var(--text-dim)",fontFamily:"var(--font-space-grotesk),'Space Grotesk',sans-serif",fontSize:8,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",borderRadius:3,cursor:"pointer",transition:"all 0.12s"}} aria-pressed={active}>
        {label}
      </button>
    );
  };

  return(
    <aside style={{position:"absolute",right:0,top:52,bottom:36,width:252,zIndex:15,display:"flex",flexDirection:"column",background:"rgba(13,14,19,0.82)",backdropFilter:"blur(24px)",borderLeft:"1px solid rgba(143,245,255,0.07)",overflowY:"auto",transition:"transform 0.3s ease"}} role="complementary" aria-label="Simulator controls">

      <div style={{padding:"10px 14px 8px",borderBottom:"1px solid rgba(143,245,255,0.07)"}}>
        <div style={{fontFamily:"var(--font-space-grotesk),'Space Grotesk',sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(143,245,255,0.5)"}}>Force Modulators</div>
        <div style={{fontFamily:"monospace",fontSize:8,color:"var(--text-dim)",marginTop:2}}>ENGINE_V3.1_CELESTIAL</div>
      </div>

      <Section title="Simulation">
        <Slider label="Particles" value={store.particleCount} min={1000} max={200000} step={1000} format={v=>v>=1000?`${(v/1000).toFixed(v<10000?1:0)}k`:`${Math.round(v)}`} onChange={applyParticleCount}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:8}}>
          {PARTICLE_OPTIONS.map((count)=>(
            <button
              key={count}
              onClick={()=>applyParticleCount(count)}
              style={{
                padding:"4px 2px",
                borderRadius:3,
                border:`1px solid ${store.particleCount===count?"rgba(143,245,255,0.5)":"rgba(143,245,255,0.1)"}`,
                background:store.particleCount===count?"rgba(143,245,255,0.08)":"rgba(18,19,25,0.78)",
                color:store.particleCount===count?"var(--primary)":"var(--text-dim)",
                fontFamily:"monospace",
                fontSize:8,
                cursor:"pointer",
              }}
              aria-label={`Set particles to ${count.toLocaleString()}`}
            >
              {count>=1000?`${Math.round(count/1000)}k`:count}
            </button>
          ))}
        </div>
        <Slider label="Time Scale" value={store.timeScale} min={0.1} max={5} step={0.1} unit="×" onChange={store.setTimeScale}/>
        <Slider label="Gravity G" value={store.gravityG} min={0} max={5} step={0.1} onChange={store.setGravityG}/>
      </Section>

      <Section title="Visual Styles">
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:6}}>
          {VISUAL_STYLES.map((style)=>(
            <button
              key={style.id}
              onClick={()=>applyVisualStyle(style.id)}
              style={{
                borderRadius:3,
                padding:"5px 2px",
                border:`1px solid ${activeStyle===style.id?"rgba(143,245,255,0.55)":"rgba(143,245,255,0.16)"}`,
                background:style.gradient,
                color:"rgba(6,10,18,0.9)",
                fontFamily:"var(--font-space-grotesk),'Space Grotesk',sans-serif",
                fontSize:8,
                fontWeight:700,
                letterSpacing:"0.08em",
                textTransform:"uppercase",
                cursor:"pointer",
                boxShadow:activeStyle===style.id?"0 0 14px rgba(143,245,255,0.25)":"none",
              }}
              aria-pressed={activeStyle===style.id}
              aria-label={`Apply ${style.label} visual style`}
            >
              {style.label}
            </button>
          ))}
        </div>
        <div style={{fontFamily:"monospace",fontSize:8,color:"rgba(143,245,255,0.4)",lineHeight:1.4}}>
          Style profiles tune bloom, trails, color response, and particle scale for distinct looks without changing simulation physics.
        </div>
      </Section>

      <Section title="Community / Local Shapes">
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,paddingBottom:8}}>
          {SHAPES.map(s=>{
            const isSpecial=s.id==="text"||s.id==="image";
            const isActive=activeShape===s.id;
            return(
              <button key={s.id}
                onClick={()=>{
                  if(s.id==="image"){imgInputRef.current?.click();}
                  else if(s.id==="text"){
                    const t=textInput||"QUANTUM";
                    window.dispatchEvent(new CustomEvent("qf:textParticles",{detail:t}));
                    setActiveShape("text");
                  } else handleShape(s.id);
                }}
                style={{background:isActive?"rgba(172,137,255,0.12)":isSpecial?"rgba(255,201,101,0.06)":"rgba(18,19,25,0.8)",border:`1px solid ${isActive?"rgba(172,137,255,0.5)":isSpecial?"rgba(255,201,101,0.2)":"rgba(143,245,255,0.08)"}`,color:isActive?"var(--secondary)":isSpecial?"var(--tertiary)":"var(--text-dim)",fontFamily:"var(--font-space-grotesk),'Space Grotesk',sans-serif",fontSize:7,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",padding:"6px 2px",borderRadius:3,cursor:"pointer",textAlign:"center",transition:"all 0.12s"}}
                aria-pressed={isActive} aria-label={`Load ${s.label} shape`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <Slider label="Morph Speed" value={morphSpeed} min={0.05} max={0.6} step={0.01} onChange={v=>{setMorphSpeed(v);window.dispatchEvent(new CustomEvent("qf:morphSpeed",{detail:v}));}}/>
        <input ref={imgInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)processImageFile(f);}}/>
      </Section>

      <Section title="Image → Particles">
        <div
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={e=>e.preventDefault()}
          onClick={()=>imgInputRef.current?.click()}
          style={{border:"1px dashed rgba(255,201,101,0.25)",borderRadius:5,padding:"10px 8px",textAlign:"center",cursor:"pointer",background:"rgba(255,201,101,0.03)",marginBottom:6,position:"relative",overflow:"hidden",minHeight:60,transition:"border-color 0.2s"}}
          role="button" tabIndex={0} aria-label="Drop image or click to upload"
          onKeyDown={e=>{if(e.key==="Enter")imgInputRef.current?.click();}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(255,201,101,0.5)";}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(255,201,101,0.25)";}}
        >
          {imgPreview&&(
            <img src={imgPreview} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.2}} aria-hidden="true"/>
          )}
          <div style={{position:"relative",zIndex:1}}>
            {imgLoading?(
              <div style={{fontSize:10,color:"var(--tertiary)"}}>Processing...</div>
            ):activeShape==="image"?(
              <div style={{fontSize:10,color:"var(--tertiary)"}}>✓ Active — click to change</div>
            ):(
              <>
                <div style={{fontSize:16,marginBottom:3}}>⬆</div>
                <div style={{fontSize:9,color:"var(--text-dim)"}}>Drop image or click</div>
                <div style={{fontSize:8,color:"rgba(143,245,255,0.3)",marginTop:1}}>PNG · JPG · WebP · GIF · SVG</div>
              </>
            )}
          </div>
        </div>
        <button
          onClick={()=>setImageExactMode(v=>!v)}
          style={{
            width:"100%",
            padding:"6px",
            marginBottom:6,
            borderRadius:4,
            border:`1px solid ${imageExactMode?"rgba(0,255,176,0.46)":"rgba(143,245,255,0.16)"}`,
            background:imageExactMode?"rgba(0,255,176,0.08)":"rgba(18,19,25,0.78)",
            color:imageExactMode?"#00ffb0":"var(--text-dim)",
            fontFamily:"monospace",
            fontSize:8,
            letterSpacing:"0.08em",
            textTransform:"uppercase",
            cursor:"pointer",
          }}
          aria-pressed={imageExactMode}
        >
          {imageExactMode?"Exact Image Mode: ON":"Exact Image Mode: OFF"}
        </button>
        <div style={{fontFamily:"monospace",fontSize:8,color:"rgba(143,245,255,0.42)",marginBottom:6,lineHeight:1.4}}>
          Exact mode maps particles directly to image pixels at processed resolution for photo-faithful reconstruction.
        </div>
        {activeShape==="image"&&(
          <button onClick={()=>{setActiveShape("sphere");setImgPreview(prev=>{if(prev)URL.revokeObjectURL(prev);return null;});window.dispatchEvent(new CustomEvent("qf:loadShape",{detail:"sphere"}));}} style={{width:"100%",padding:"5px",background:"rgba(255,107,53,0.07)",border:"1px solid rgba(255,107,53,0.25)",color:"#ff6b35",fontFamily:"monospace",fontSize:8,letterSpacing:"0.12em",textTransform:"uppercase",borderRadius:3,cursor:"pointer",transition:"all 0.15s"}}>
            ✕ Clear Image
          </button>
        )}
      </Section>

      <Section title="Rendering">
        <Slider label="Bloom" value={store.bloomIntensity} min={0} max={1} step={0.05} onChange={store.setBloom}/>
        <Slider label="Trail Decay" value={store.trailDecay} min={0.5} max={0.99} step={0.01} onChange={store.setTrailDecay}/>
        <Slider label="Particle Size" value={store.particleSize} min={0.4} max={6} step={0.1} onChange={store.setParticleSize}/>
        <Slider label="Color Brightness" value={colorBrightness} min={0.4} max={2} step={0.02} unit="×" onChange={setColorBrightness}/>
        <Slider label="Glow Gain" value={glowGain} min={0} max={2} step={0.02} unit="×" onChange={setGlowGain}/>
        <button
          onClick={()=>setCustomPaletteEnabled(v=>!v)}
          style={{
            width:"100%",
            padding:"6px",
            marginBottom:6,
            borderRadius:4,
            border:`1px solid ${customPaletteEnabled?"rgba(255,201,101,0.45)":"rgba(143,245,255,0.18)"}`,
            background:customPaletteEnabled?"rgba(255,201,101,0.08)":"rgba(18,19,25,0.8)",
            color:customPaletteEnabled?"var(--tertiary)":"var(--text-dim)",
            fontFamily:"monospace",
            fontSize:9,
            cursor:"pointer",
          }}
          aria-pressed={customPaletteEnabled}
        >
          {customPaletteEnabled?"Custom Palette: ON":"Custom Palette: OFF"}
        </button>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,marginBottom:6}}>
          {COLOR_PRESETS.map((preset)=>(
            <button
              key={preset.id}
              onClick={()=>{setCustomStart(preset.start);setCustomEnd(preset.end);setCustomPaletteEnabled(true);}}
              style={{
                padding:"4px 2px",
                borderRadius:3,
                border:"1px solid rgba(255,255,255,0.08)",
                background:`linear-gradient(135deg, ${preset.start}, ${preset.end})`,
                color:"rgba(5,8,15,0.85)",
                fontFamily:"monospace",
                fontSize:8,
                fontWeight:700,
                cursor:"pointer",
              }}
              aria-label={`Use ${preset.label} palette`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:6,marginBottom:6}}>
          <label style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:"var(--text-dim)",fontFamily:"monospace",flex:1}}>
            A
            <input type="color" value={customStart} onChange={e=>{setCustomStart(e.target.value);setCustomPaletteEnabled(true);}} style={{width:"100%",height:22,padding:0,border:"1px solid rgba(143,245,255,0.2)",background:"transparent",cursor:"pointer"}} aria-label="Custom palette start color"/>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:"var(--text-dim)",fontFamily:"monospace",flex:1}}>
            B
            <input type="color" value={customEnd} onChange={e=>{setCustomEnd(e.target.value);setCustomPaletteEnabled(true);}} style={{width:"100%",height:22,padding:0,border:"1px solid rgba(143,245,255,0.2)",background:"transparent",cursor:"pointer"}} aria-label="Custom palette end color"/>
          </label>
        </div>
        <div style={{display:"flex",gap:3,flexWrap:"wrap",paddingTop:4}}>
          {COLORMAPS.map(([id,gradient])=>(
            <div key={id} onClick={()=>{setCustomPaletteEnabled(false);store.setColormap(id);}} style={{flex:1,minWidth:22,height:14,borderRadius:2,background:gradient,border:store.colormap===id&&!customPaletteEnabled?"1.5px solid rgba(143,245,255,0.85)":"1.5px solid transparent",cursor:"pointer",transition:"border-color 0.12s"}} role="button" aria-label={`${id} colormap`} aria-pressed={store.colormap===id&&!customPaletteEnabled}/>
          ))}
        </div>
      </Section>

      <Section title="Force Field">
        <div style={{display:"flex",gap:4,marginBottom:10}}>
          {btn("● Attract",forceMode==="attract",()=>handleForce("attract"),"primary")}
          {btn("○ Repel",forceMode==="repel",()=>handleForce("repel"),"secondary")}
          {btn("⊙ Orbit",forceMode==="orbit",()=>handleForce("orbit"),"tertiary")}
        </div>
        <button
          onClick={()=>setCursorFieldEnabled(v=>!v)}
          style={{
            width:"100%",
            padding:"6px",
            marginBottom:8,
            borderRadius:4,
            border:`1px solid ${cursorFieldEnabled?"rgba(143,245,255,0.45)":"rgba(143,245,255,0.14)"}`,
            background:cursorFieldEnabled?"rgba(143,245,255,0.08)":"rgba(18,19,25,0.78)",
            color:cursorFieldEnabled?"var(--primary)":"var(--text-dim)",
            fontFamily:"monospace",
            fontSize:8,
            letterSpacing:"0.08em",
            textTransform:"uppercase",
            cursor:"pointer",
          }}
          aria-pressed={cursorFieldEnabled}
        >
          {cursorFieldEnabled?"Cursor Manipulation: ON":"Cursor Manipulation: OFF"}
        </button>
        {cursorFieldEnabled&&(
          <>
            <Slider label="Cursor Strength" value={cursorFieldStrength} min={0.2} max={2} step={0.05} unit="×" onChange={setCursorFieldStrength}/>
            <Slider label="Cursor Radius" value={cursorFieldRadius} min={0.5} max={2} step={0.05} unit="×" onChange={setCursorFieldRadius}/>
          </>
        )}
        <Slider label="Radius" value={store.forceRadius} min={20} max={350} step={5} onChange={store.setForceRadius}/>
        <Slider label="Strength" value={store.forceStrength} min={0.1} max={12} step={0.1} onChange={store.setForceStrength}/>
      </Section>

      <Section title="Text → Particles">
        <input value={textInput} onChange={e=>setTextInput(e.target.value.slice(0,24))} maxLength={24} placeholder="Type anything..." style={{background:"rgba(13,14,19,0.8)",border:"none",borderBottom:"1px solid rgba(143,245,255,0.2)",color:"var(--text)",fontFamily:"monospace",fontSize:10,padding:"5px 6px",width:"100%",outline:"none",marginBottom:6}} aria-label="Text for particles"/>
        <button onClick={()=>{window.dispatchEvent(new CustomEvent("qf:textParticles",{detail:textInput||"QUANTUM"}));setActiveShape("text");}} style={{width:"100%",padding:"7px",background:"rgba(143,245,255,0.05)",border:"1px solid rgba(143,245,255,0.2)",color:"var(--primary)",fontFamily:"var(--font-space-grotesk),'Space Grotesk',sans-serif",fontSize:8,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",borderRadius:3,cursor:"pointer",transition:"all 0.2s"}} aria-label="Render text as particles">
          → Render as Particles
        </button>
      </Section>

      <Section title="Scene Presets">
        <div style={{display:"flex",flexDirection:"column",gap:3}}>
          {PRESETS.map(([id,icon,label,eq])=>(
            <div key={id} onClick={()=>{store.setActivePreset(id);store.setANNPanelOpen(true);window.dispatchEvent(new CustomEvent("qf:loadPreset",{detail:id}));setActiveShape("galaxy");}} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"){store.setActivePreset(id);store.setANNPanelOpen(true);window.dispatchEvent(new CustomEvent("qf:loadPreset",{detail:id}));}}} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:4,cursor:"pointer",border:`1px solid ${store.activePreset===id?"rgba(143,245,255,0.15)":"transparent"}`,background:store.activePreset===id?"rgba(143,245,255,0.04)":"transparent",transition:"all 0.12s"}} aria-pressed={store.activePreset===id}>
              <span style={{fontSize:11,width:14,textAlign:"center",color:store.activePreset===id?"var(--primary)":"var(--text-dim)"}}>{icon}</span>
              <span style={{fontFamily:"var(--font-space-grotesk),'Space Grotesk',sans-serif",fontSize:9,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:store.activePreset===id?"var(--primary)":"var(--text-muted)",flex:1}}>{label}</span>
              <span style={{fontFamily:"monospace",fontSize:8,color:"var(--text-dim)"}}>{eq}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shortcuts" open={false}>
        <div style={{display:"flex",flexDirection:"column",gap:3}}>
          {[["Drag","Orbit rotate"],["Wheel","Zoom in/out"],["Right Click","Attract"],["Shift+Right Click","Repel"],["Space","Explode"],["R","Reset"],["P","Pause"],["S","Sidebar"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontFamily:"monospace",fontSize:9,color:"var(--primary)"}}>{k}</span>
              <span style={{fontFamily:"monospace",fontSize:9,color:"var(--text-dim)"}}>{v}</span>
            </div>
          ))}
        </div>
      </Section>

      <div style={{padding:"10px 14px"}}>
        <button onClick={()=>window.dispatchEvent(new CustomEvent("qf:explode"))} style={{width:"100%",padding:"9px",background:"linear-gradient(135deg,rgba(143,245,255,0.12),rgba(172,137,255,0.08))",border:"1px solid rgba(143,245,255,0.28)",color:"var(--primary)",fontFamily:"var(--font-space-grotesk),'Space Grotesk',sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",borderRadius:4,cursor:"pointer",transition:"all 0.25s"}}
          onMouseEnter={e=>{(e.target as HTMLElement).style.boxShadow="0 0 20px rgba(143,245,255,0.2)";(e.target as HTMLElement).style.background="rgba(143,245,255,0.18)";}}
          onMouseLeave={e=>{(e.target as HTMLElement).style.boxShadow="none";(e.target as HTMLElement).style.background="linear-gradient(135deg,rgba(143,245,255,0.12),rgba(172,137,255,0.08))";}}
          aria-label="Initiate particle collision">
          ⚡ INITIATE_COLLISION
        </button>
      </div>
    </aside>
  );
}
