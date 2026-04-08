"use client";
import { useState, useEffect, useRef } from "react";
import { useSimulatorStore } from "@/store/simulatorStore";
import type { ColormapName, PresetName } from "@/types";

const SHAPES=[
  {id:"galaxy",label:"Galaxy"},{id:"sphere",label:"Sphere"},
  {id:"cylinder",label:"Cylinder"},{id:"torus",label:"Torus"},
  {id:"cube",label:"Cube"},{id:"dna",label:"DNA"},
  {id:"klein",label:"Klein"},{id:"mobius",label:"Möbius"},
  {id:"trefoil",label:"Trefoil"},{id:"heart",label:"Heart"},
  {id:"octahed",label:"Octa"},{id:"wave",label:"Wave"},
  {id:"spiral",label:"Spiral"},{id:"text",label:"Text→"},
  {id:"image",label:"Img→"},
] as const;

const COLORMAPS:[ColormapName,string][]=[
  ["viridis","linear-gradient(to right,#440154,#31688e,#35b779,#fde725)"],
  ["inferno","linear-gradient(to right,#000004,#7c2a8a,#e75c2d,#fcffa4)"],
  ["plasma","linear-gradient(to right,#0d0887,#9b179e,#ed7953,#f0f921)"],
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
  ["plasma","⌀","Plasma Storm","F=q(E+v×B)"],
  ["doubleslit","◈","Double Slit","P=|ψ₁+ψ₂|²"],
  ["solar","⊙","Solar System","T²∝a³"],
  ["bec","◻","BEC","E=ℏω(n+½)"],
  ["darkmatter","✦","Dark Matter","Ω≈0.27"],
  ["dna","⌇","DNA Helix","3.4Å/bp"],
  ["vortex","⟳","Fluid Vortex","∇×v=ω"],
  ["anntraining","⊛","Neural Net","σ(z)=1/(1+e⁻ᶻ)"],
  ["tunneling","⇝","Q.Tunneling","T≈e^{-2κa}"],
];

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
  const[activeShape,setActiveShape]=useState("galaxy");
  const[forceMode,setForceModeLocal]=useState<"attract"|"repel"|"orbit">("attract");
  const[morphSpeed,setMorphSpeed]=useState(0.08);
  const[imgPreview,setImgPreview]=useState<string|null>(null);
  const[imgLoading,setImgLoading]=useState(false);
  const imgInputRef=useRef<HTMLInputElement>(null);
  const dropRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const handler=(e:Event)=>setActiveShape((e as CustomEvent).detail as string);
    window.addEventListener("qf:shapeChanged",handler as EventListener);
    return()=>window.removeEventListener("qf:shapeChanged",handler as EventListener);
  },[]);

  const handleShape=(shape:string)=>{
    if(shape==="text"||shape==="image") return; // handled separately
    setActiveShape(shape);
    window.dispatchEvent(new CustomEvent("qf:loadShape",{detail:shape}));
  };

  const handleForce=(m:"attract"|"repel"|"orbit")=>{
    setForceModeLocal(m);
    store.setForceMode(m==="orbit"?"attract":m);
    window.dispatchEvent(new CustomEvent("qf:forceMode",{detail:m}));
  };

  const processImageFile=(file:File)=>{
    if(!file.type.startsWith("image/")) return;
    setImgLoading(true);
    const url=URL.createObjectURL(file);
    setImgPreview(url);
    const img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      // Render to offscreen canvas
      const maxDim=300;
      const scale=Math.min(maxDim/img.width,maxDim/img.height);
      const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
      const off=document.createElement("canvas");
      off.width=w; off.height=h;
      const oc=off.getContext("2d")!;
      oc.drawImage(img,0,0,w,h);
      const imageData=oc.getImageData(0,0,w,h);
      window.dispatchEvent(new CustomEvent("qf:imageData",{detail:{data:imageData,w,h}}));
      setActiveShape("image");
      setImgLoading(false);
    };
    img.onerror=()=>{setImgLoading(false);};
    img.src=URL.createObjectURL(file);
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
        <Slider label="Particles" value={store.particleCount} min={500} max={50000} step={500} format={v=>`${Math.round(v/1000)}k`} onChange={v=>{store.setParticleCount(Math.round(v));window.dispatchEvent(new CustomEvent("qf:particleCount",{detail:Math.round(v)}));}}/>
        <Slider label="Time Scale" value={store.timeScale} min={0.1} max={5} step={0.1} unit="×" onChange={store.setTimeScale}/>
        <Slider label="Gravity G" value={store.gravityG} min={0} max={5} step={0.1} onChange={store.setGravityG}/>
      </Section>

      <Section title="Shapes & 3D Morphing">
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,paddingBottom:8}}>
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
                style={{background:isActive?"rgba(172,137,255,0.12)":isSpecial?"rgba(255,201,101,0.06)":"rgba(18,19,25,0.8)",border:`1px solid ${isActive?"rgba(172,137,255,0.5)":isSpecial?"rgba(255,201,101,0.2)":"rgba(143,245,255,0.08)"}`,color:isActive?"var(--secondary)":isSpecial?"var(--tertiary)":"var(--text-dim)",fontFamily:"var(--font-space-grotesk),'Space Grotesk',sans-serif",fontSize:8,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",padding:"6px 2px",borderRadius:3,cursor:"pointer",textAlign:"center",transition:"all 0.12s"}}
                aria-pressed={isActive} aria-label={`Load ${s.label} shape`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <Slider label="Morph Speed" value={morphSpeed} min={0.01} max={0.25} step={0.01} onChange={v=>{setMorphSpeed(v);window.dispatchEvent(new CustomEvent("qf:morphSpeed",{detail:v}));}}/>
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
        {activeShape==="image"&&(
          <button onClick={()=>{setActiveShape("galaxy");setImgPreview(null);window.dispatchEvent(new CustomEvent("qf:loadShape",{detail:"galaxy"}));}} style={{width:"100%",padding:"5px",background:"rgba(255,107,53,0.07)",border:"1px solid rgba(255,107,53,0.25)",color:"#ff6b35",fontFamily:"monospace",fontSize:8,letterSpacing:"0.12em",textTransform:"uppercase",borderRadius:3,cursor:"pointer",transition:"all 0.15s"}}>
            ✕ Clear Image
          </button>
        )}
      </Section>

      <Section title="Rendering">
        <Slider label="Bloom" value={store.bloomIntensity} min={0} max={1} step={0.05} onChange={store.setBloom}/>
        <Slider label="Trail Decay" value={store.trailDecay} min={0.5} max={0.99} step={0.01} onChange={store.setTrailDecay}/>
        <Slider label="Particle Size" value={store.particleSize} min={0.4} max={6} step={0.1} onChange={store.setParticleSize}/>
        <div style={{display:"flex",gap:3,flexWrap:"wrap",paddingTop:4}}>
          {COLORMAPS.map(([id,gradient])=>(
            <div key={id} onClick={()=>store.setColormap(id)} style={{flex:1,minWidth:22,height:14,borderRadius:2,background:gradient,border:store.colormap===id?"1.5px solid rgba(255,255,255,0.8)":"1.5px solid transparent",cursor:"pointer",transition:"border-color 0.12s"}} role="button" aria-label={`${id} colormap`} aria-pressed={store.colormap===id}/>
          ))}
        </div>
      </Section>

      <Section title="Force Field">
        <div style={{display:"flex",gap:4,marginBottom:10}}>
          {btn("● Attract",forceMode==="attract",()=>handleForce("attract"),"primary")}
          {btn("○ Repel",forceMode==="repel",()=>handleForce("repel"),"secondary")}
          {btn("⊙ Orbit",forceMode==="orbit",()=>handleForce("orbit"),"tertiary")}
        </div>
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
            <div key={id} onClick={()=>{store.setActivePreset(id);window.dispatchEvent(new CustomEvent("qf:loadPreset",{detail:id}));setActiveShape("galaxy");}} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"){store.setActivePreset(id);window.dispatchEvent(new CustomEvent("qf:loadPreset",{detail:id}));}}} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:4,cursor:"pointer",border:`1px solid ${store.activePreset===id?"rgba(143,245,255,0.15)":"transparent"}`,background:store.activePreset===id?"rgba(143,245,255,0.04)":"transparent",transition:"all 0.12s"}} aria-pressed={store.activePreset===id}>
              <span style={{fontSize:11,width:14,textAlign:"center",color:store.activePreset===id?"var(--primary)":"var(--text-dim)"}}>{icon}</span>
              <span style={{fontFamily:"var(--font-space-grotesk),'Space Grotesk',sans-serif",fontSize:9,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:store.activePreset===id?"var(--primary)":"var(--text-muted)",flex:1}}>{label}</span>
              <span style={{fontFamily:"monospace",fontSize:8,color:"var(--text-dim)"}}>{eq}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shortcuts" open={false}>
        <div style={{display:"flex",flexDirection:"column",gap:3}}>
          {[["Space","Explode"],["R","Reset"],["P","Pause"],["S","Sidebar"],["←/→","Time scale"],["Click","Attract"],["Shift+Click","Repel"]].map(([k,v])=>(
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
