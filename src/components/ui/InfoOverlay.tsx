"use client";
import { useSimulatorStore } from "@/store/simulatorStore";

const MODE_INFO: Record<string, { eq: string; label: string }> = {
  classical: { eq: "F = Gm₁m₂/r²", label: "NEWTONIAN GRAVITY" },
  quantum:   { eq: "iℏ∂ψ/∂t = Ĥψ", label: "QUANTUM WAVEFUNCTION" },
  relativity:{ eq: "γ = 1/√(1−v²/c²)", label: "SPECIAL RELATIVITY" },
  fluid:     { eq: "ρ(r) = Σmⱼ·W(r−rⱼ,h)", label: "SPH FLUID" },
  em:        { eq: "F = q(E + v×B)", label: "LORENTZ FORCE" },
  future:    { eq: "S = −1/(2α′)∫d²σ ∂Xᵘ∂Xᵤ", label: "STRING THEORY" },
};

export default function InfoOverlay() {
  const store = useSimulatorStore();
  const info = MODE_INFO[store.physicsMode] ?? MODE_INFO["classical"]!;

  if (!store.showStats) return null;

  return (
    <div
      className="absolute bottom-10 left-4 z-20 pointer-events-none select-none"
      aria-live="polite"
      aria-label="Simulation statistics"
    >
      {store.showEquation && (
        <div className="mb-2">
          <div className="text-xs font-semibold tracking-widest mb-0.5" style={{ color: "#ffd166" }}>
            {info.label}
          </div>
          <div className="font-mono text-sm" style={{ color: "rgba(0,212,255,0.8)" }}>
            {info.eq}
          </div>
        </div>
      )}
      <div className="flex gap-4 text-xs font-mono" style={{ color: "#4a5480" }}>
        <span>FPS <b style={{ color: "#00d4ff" }}>{store.fps}</b></span>
        <span>KE <b style={{ color: "#ffd166" }}>{store.kineticEnergy.toLocaleString()}</b></span>
        <span>t= <b style={{ color: "#6c3fc5" }}>{store.simTime.toFixed(0)}s</b></span>
        <span style={{ color: store.renderMode === "webgpu" ? "#00d4ff" : "#ff6b35" }}>
          {store.renderMode.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
