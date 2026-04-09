"use client";
import { useSimulatorStore } from "@/store/simulatorStore";
import type { PhysicsMode } from "@/types";

const MODES: Array<{ id: PhysicsMode; label: string }> = [
  { id: "classical",  label: "Classical"  },
  { id: "quantum",    label: "Quantum"    },
  { id: "relativity", label: "Relativity" },
  { id: "fluid",      label: "SPH Fluid"  },
  { id: "em",         label: "EM Field"   },
  { id: "future",     label: "Future"     },
];

export default function TopBar() {
  const store = useSimulatorStore();

  const handleMode = (id: PhysicsMode) => {
    store.setPhysicsMode(id);
    window.dispatchEvent(new CustomEvent("qf:physicsMode", { detail: id }));
  };

  return (
    <header
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 52,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        background: "rgba(13,14,19,0.7)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(143,245,255,0.07)",
      }}
      role="navigation"
      aria-label="Physics mode selector"
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "0.12em",
            color: "var(--primary)",
            textTransform: "uppercase",
          }}
        >
          QUANTUM_FIELD
        </span>
        <div style={{ width: 1, height: 14, background: "rgba(143,245,255,0.2)" }} />
        <span
          style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--text-dim)",
            textTransform: "uppercase",
          }}
        >
          CELESTIAL_OBSERVER_v3.0
        </span>
      </div>

      {/* Mode pills */}
      <nav
        style={{ display: "flex", gap: 4, alignItems: "center" }}
        aria-label="Physics modes"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => handleMode(m.id)}
            style={{
              background: store.physicsMode === m.id ? "rgba(143,245,255,0.08)" : "transparent",
              border: "none",
              borderBottom: store.physicsMode === m.id ? "1.5px solid var(--primary)" : "1.5px solid transparent",
              color: store.physicsMode === m.id ? "var(--primary)" : "var(--text-dim)",
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "6px 10px",
              cursor: "pointer",
              transition: "all 0.18s",
            }}
            aria-pressed={store.physicsMode === m.id}
            aria-label={`Switch to ${m.label} physics`}
          >
            {m.label}
          </button>
        ))}
      </nav>

      {/* Right controls */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          onClick={() => store.toggleMediaStudio()}
          style={{
            background: store.mediaStudioOpen ? "rgba(143,245,255,0.12)" : "rgba(143,245,255,0.05)",
            border: `1px solid ${store.mediaStudioOpen ? "rgba(143,245,255,0.6)" : "rgba(143,245,255,0.2)"}`,
            color: store.mediaStudioOpen ? "var(--primary)" : "rgba(143,245,255,0.7)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "5px 10px",
            borderRadius: 3,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          aria-pressed={store.mediaStudioOpen}
          aria-label="Toggle Media Studio"
        >
          STUDIO {store.mediaStudioOpen ? "ON" : "OFF"}
        </button>
        <button
          onClick={() => store.toggleANNPanel()}
          style={{
            background: store.annPanelOpen ? "rgba(0,255,176,0.12)" : "rgba(0,255,176,0.05)",
            border: `1px solid ${store.annPanelOpen ? "rgba(0,255,176,0.5)" : "rgba(0,255,176,0.26)"}`,
            color: store.annPanelOpen ? "#00ffb0" : "rgba(0,255,176,0.84)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "5px 10px",
            borderRadius: 3,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          aria-pressed={store.annPanelOpen}
          aria-label="Toggle preset insights panel"
        >
          INSIGHTS {store.annPanelOpen ? "ON" : "OFF"}
        </button>
        <button
          onClick={() => {
            store.setRunning(!store.isRunning);
            window.dispatchEvent(new CustomEvent("qf:pause"));
          }}
          style={{
            background: store.isRunning ? "rgba(255,107,53,0.08)" : "rgba(143,245,255,0.08)",
            border: `1px solid ${store.isRunning ? "rgba(255,107,53,0.3)" : "rgba(143,245,255,0.3)"}`,
            color: store.isRunning ? "#ff6b35" : "var(--primary)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            padding: "5px 10px",
            borderRadius: 3,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          aria-label={store.isRunning ? "Pause simulation" : "Resume simulation"}
        >
          {store.isRunning ? "⏸ Pause" : "▶ Resume"}
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("qf:explode"))}
          style={{
            background: "rgba(255,201,101,0.07)",
            border: "1px solid rgba(255,201,101,0.25)",
            color: "var(--tertiary)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            padding: "5px 10px",
            borderRadius: 3,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          aria-label="Explode particles"
        >
          ⚡ Initiate
        </button>
        <button
          onClick={() => store.toggleSidebar()}
          style={{
            background: "transparent",
            border: "1px solid rgba(143,245,255,0.12)",
            color: "var(--text-dim)",
            fontSize: 13,
            padding: "4px 8px",
            borderRadius: 3,
            cursor: "pointer",
            transition: "color 0.2s",
          }}
          aria-label="Toggle sidebar"
        >
          ⊟
        </button>
      </div>
    </header>
  );
}
