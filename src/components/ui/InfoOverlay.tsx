"use client";
import { useSimulatorStore } from "@/store/simulatorStore";

const MODE_INFO: Record<string, { eq: string; label: string }> = {
  classical:  { eq: "F = Gm₁m₂/r²",              label: "NEWTONIAN GRAVITY"   },
  quantum:    { eq: "iℏ∂ψ/∂t = Ĥψ",              label: "QUANTUM WAVEFUNCTION" },
  relativity: { eq: "γ = 1/√(1−v²/c²)",           label: "SPECIAL RELATIVITY"  },
  fluid:      { eq: "ρ(r) = Σmⱼ·W(r−rⱼ,h)",      label: "SPH FLUID DYNAMICS"  },
  em:         { eq: "F = q(E + v×B)",              label: "LORENTZ EM FORCE"    },
  future:     { eq: "S = −1/(2α′)∫d²σ·∂Xᵘ∂Xᵤ",  label: "STRING THEORY"       },
};

export default function InfoOverlay() {
  const store = useSimulatorStore();
  const info = MODE_INFO[store.physicsMode] ?? MODE_INFO["classical"]!;
  if (!store.showStats) return null;

  return (
    <>
      {/* Left HUD — Gravitational Flux */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 52,
          bottom: 36,
          width: 178,
          zIndex: 15,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 10px",
          pointerEvents: "none",
        }}
        aria-label="Simulation telemetry"
      >
        {/* Telemetry panel */}
        <div
          style={{
            background: "rgba(13,14,19,0.55)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(143,245,255,0.07)",
            borderRadius: 6,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(143,245,255,0.45)",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            Gravitational Flux
            <span style={{ color: "var(--primary)", fontSize: 8 }}>
              {store.physicsMode.toUpperCase().slice(0, 6)}
            </span>
          </div>
          {[
            { key: "PARTICLES", val: store.fps > 0 ? "—" : "—", id: "hud-count", color: "var(--primary)" },
            { key: "FPS",       val: String(store.fps),          id: "hud-fps",   color: "var(--primary)" },
            { key: "KE",        val: store.kineticEnergy.toLocaleString(), id: "hud-ke", color: "var(--secondary)" },
            { key: "T_SIM",     val: store.simTime.toFixed(1) + "s", id: "hud-time", color: "var(--tertiary)" },
          ].map(({ key, val, id, color }) => (
            <div key={key} style={{ marginBottom: 5 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: 9,
                    color: "var(--text-dim)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {key}
                </span>
                <span
                  id={id}
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: 9,
                    color,
                    fontWeight: 500,
                  }}
                >
                  {val}
                </span>
              </div>
              <div
                style={{
                  height: 1,
                  background: "rgba(143,245,255,0.06)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    height: "100%",
                    width:
                      key === "FPS" ? `${Math.min(100, (store.fps / 60) * 100)}%` :
                      key === "KE"  ? `${Math.min(100, store.kineticEnergy / 500)}%` : "60%",
                    background: color,
                    opacity: 0.5,
                    transition: "width 0.6s",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Render engine panel */}
        <div
          style={{
            marginTop: "auto",
            background: "rgba(13,14,19,0.55)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(143,245,255,0.07)",
            borderRadius: 6,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(143,245,255,0.45)",
              marginBottom: 6,
            }}
          >
            Render Engine
          </div>
          {[
            { key: "MODE",  val: store.renderMode.toUpperCase(), color: "var(--tertiary)" },
            { key: "CMAP",  val: store.colormap.toUpperCase(),   color: "var(--secondary)" },
          ].map(({ key, val, color }) => (
            <div
              key={key}
              style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}
            >
              <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "var(--text-dim)" }}>
                {key}
              </span>
              <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color }}>
                {val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Equation overlay — bottom left */}
      {store.showEquation && (
        <div
          style={{
            position: "absolute",
            left: 190,
            bottom: 44,
            zIndex: 15,
            pointerEvents: "none",
          }}
          aria-live="polite"
        >
          <div
            style={{
              background: "rgba(13,14,19,0.55)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(143,245,255,0.08)",
              borderRadius: 4,
              padding: "6px 10px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--tertiary)",
                marginBottom: 2,
              }}
            >
              {info.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 11,
                color: "rgba(143,245,255,0.82)",
              }}
            >
              {info.eq}
            </div>
          </div>
        </div>
      )}

      {/* Bottom stats bar content injected from canvas engine via DOM */}
    </>
  );
}
