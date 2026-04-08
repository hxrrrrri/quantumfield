"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";

const ParticleCanvas = dynamic(() => import("@/components/canvas/ParticleCanvas"), { ssr: false });
const CosmicSidebar = dynamic(() => import("@/components/ui/CosmicSidebar"),       { ssr: false });
const TopBar        = dynamic(() => import("@/components/ui/TopBar"),               { ssr: false });
const InfoOverlay   = dynamic(() => import("@/components/ui/InfoOverlay"),          { ssr: false });

function LoadingScreen() {
  return (
    <div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#0d0e13",zIndex:50,flexDirection:"column",gap:16}}>
      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700,letterSpacing:"0.15em",color:"#8ff5ff",textTransform:"uppercase"}}>
        QUANTUM_FIELD
      </div>
      <div style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.25em",color:"#75757b",textTransform:"uppercase"}}>
        BOOT_SEQUENCE · INITIALIZING PARTICLE ENGINE
      </div>
      <div style={{display:"flex",gap:5}}>
        {[0,1,2,3,4].map(i=>(
          <div key={i} style={{width:4,height:4,borderRadius:"50%",background:"#8ff5ff",opacity:0.4,animation:"qfpulse 1.2s ease-in-out infinite",animationDelay:`${i*0.18}s`}}/>
        ))}
      </div>
      <style>{`@keyframes qfpulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}`}</style>
    </div>
  );
}

export default function SimulatorPage() {
  return (
    <main
      style={{position:"relative",width:"100vw",height:"100vh",overflow:"hidden",background:"#0d0e13"}}
      aria-label="QuantumField Celestial Observer"
    >
      {/* Pure dark radial background — NO scanning line, NO white elements */}
      <div aria-hidden="true" style={{
        position:"absolute",inset:0,zIndex:0,pointerEvents:"none",
        background:"radial-gradient(ellipse at 50% 50%, rgba(172,137,255,0.05) 0%, #0d0e13 65%)",
      }}/>

      {/* Volumetric grid floor — subtle only */}
      <div aria-hidden="true" style={{
        position:"absolute",bottom:0,left:0,right:0,height:"35%",
        zIndex:0,pointerEvents:"none",
        backgroundImage:"linear-gradient(to right,rgba(143,245,255,0.025) 1px,transparent 1px),linear-gradient(to bottom,rgba(143,245,255,0.025) 1px,transparent 1px)",
        backgroundSize:"40px 40px",
        maskImage:"radial-gradient(ellipse 70% 60% at 50% 100%,#000 50%,transparent 100%)",
        WebkitMaskImage:"radial-gradient(ellipse 70% 60% at 50% 100%,#000 50%,transparent 100%)",
      }}/>

      <Suspense fallback={<LoadingScreen/>}>
        <ParticleCanvas/>
        <TopBar/>
        <CosmicSidebar/>
        <InfoOverlay/>

        {/* Bottom telemetry bar */}
        <div style={{
          position:"absolute",bottom:0,left:0,right:0,height:36,zIndex:20,
          display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",
          background:"rgba(13,14,19,0.82)",backdropFilter:"blur(12px)",
          borderTop:"1px solid rgba(143,245,255,0.06)",
        }} aria-label="Simulation statistics">
          <div style={{display:"flex",gap:20}}>
            {[{key:"PTS",id:"s-count",c:"#8ff5ff"},{key:"FPS",id:"s-fps",c:"#8ff5ff"},{key:"KE",id:"s-ke",c:"#ffc965"},{key:"T",id:"s-time",c:"#ac89ff"}].map(({key,id,c})=>(
              <div key={key} style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontFamily:"monospace",fontSize:8,color:"#75757b",letterSpacing:"0.1em"}}>{key}</span>
                <span id={id} style={{fontFamily:"monospace",fontSize:9,color:c,fontWeight:500}}>—</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:14}}>
            {["SPACE=EXPLODE","CLICK=ATTRACT","SHIFT=REPEL","R=RESET"].map(s=>(
              <span key={s} style={{fontFamily:"monospace",fontSize:8,color:"rgba(143,245,255,0.18)",letterSpacing:"0.08em"}}>{s}</span>
            ))}
          </div>
        </div>
      </Suspense>
    </main>
  );
}
