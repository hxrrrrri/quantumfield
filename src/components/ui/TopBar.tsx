"use client";
import { useSimulatorStore } from "@/store/simulatorStore";
import type { PhysicsMode } from "@/types";

const MODES: Array<{ id: PhysicsMode; label: string; icon: string }> = [
  { id: "classical", label: "Classical", icon: "⚛" },
  { id: "quantum", label: "Quantum", icon: "ψ" },
  { id: "relativity", label: "Relativity", icon: "γ" },
  { id: "fluid", label: "Fluid SPH", icon: "~" },
  { id: "em", label: "EM Field", icon: "∇" },
  { id: "future", label: "Future", icon: "∞" },
];

export default function TopBar() {
  const store = useSimulatorStore();
  return (
    <header
      className="absolute top-0 left-0 right-0 h-12 z-20 flex items-center px-4 gap-3"
      style={{ background: "rgba(8,10,26,0.82)", backdropFilter: "blur(12px)", borderBottom: "0.5px solid rgba(100,120,255,0.18)" }}
      role="navigation"
      aria-label="Physics mode selector"
    >
      <div className="text-sm font-semibold tracking-widest mr-2 text-particle-white select-none">
        QUANTUM<span className="text-plasma-cyan">FIELD</span>
      </div>
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => store.setPhysicsMode(m.id)}
          className={`px-3 py-1 rounded-full text-xs font-medium tracking-wide transition-all border ${
            store.physicsMode === m.id
              ? "border-plasma-cyan text-plasma-cyan bg-plasma-cyan/10"
              : "border-mist-gray/30 text-void-gray/60 hover:border-plasma-cyan/50 hover:text-plasma-cyan/70"
          }`}
          aria-pressed={store.physicsMode === m.id}
          aria-label={`Switch to ${m.label} physics mode`}
          style={{ color: store.physicsMode === m.id ? "#00d4ff" : "#7080a8" }}
        >
          <span className="mr-1">{m.icon}</span>{m.label}
        </button>
      ))}
      <div className="ml-auto flex gap-2">
        <button
          onClick={() => store.setRunning(!store.isRunning)}
          className="px-3 py-1 rounded text-xs border transition-all"
          style={{
            borderColor: store.isRunning ? "rgba(255,107,53,0.4)" : "rgba(0,212,255,0.4)",
            color: store.isRunning ? "#ff6b35" : "#00d4ff",
            background: store.isRunning ? "rgba(255,107,53,0.08)" : "rgba(0,212,255,0.08)",
          }}
          aria-label={store.isRunning ? "Pause simulation" : "Resume simulation"}
        >
          {store.isRunning ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          onClick={() => store.toggleSidebar()}
          className="px-3 py-1 rounded text-xs border transition-all"
          style={{ borderColor: "rgba(100,120,255,0.3)", color: "#7080a8" }}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
      </div>
    </header>
  );
}
