"use client";
import { useState } from "react";
import { useSimulatorStore } from "@/store/simulatorStore";
import type { ColormapName, PresetName } from "@/types";

const PRESETS: Array<{ id: PresetName; label: string; icon: string }> = [
  { id: "bigbang", label: "Big Bang", icon: "💥" },
  { id: "galaxy", label: "Galaxy Spiral", icon: "🌌" },
  { id: "doubleslit", label: "Double Slit", icon: "◈" },
  { id: "blackhole", label: "Black Hole", icon: "⚫" },
  { id: "plasma", label: "Plasma Storm", icon: "⚡" },
  { id: "solar", label: "Solar System", icon: "☀" },
  { id: "dna", label: "DNA Helix", icon: "🧬" },
  { id: "tunneling", label: "Q. Tunneling", icon: "〜" },
  { id: "wavecollapse", label: "Wave Collapse", icon: "∿" },
  { id: "darkmatter", label: "Dark Matter", icon: "✦" },
  { id: "bec", label: "BEC Condensate", icon: "❄" },
  { id: "anntraining", label: "ANN Training", icon: "🧠" },
];

const COLORMAPS: Array<{ id: ColormapName; label: string; gradient: string }> = [
  { id: "viridis",  label: "Viridis",  gradient: "linear-gradient(to right,#440154,#31688e,#35b779,#fde725)" },
  { id: "inferno",  label: "Inferno",  gradient: "linear-gradient(to right,#000004,#7c2a8a,#e75c2d,#fcffa4)" },
  { id: "plasma",   label: "Plasma",   gradient: "linear-gradient(to right,#0d0887,#9b179e,#ed7953,#f0f921)" },
  { id: "cyan",     label: "Cyan",     gradient: "linear-gradient(to right,#020d1a,#003f5c,#00d4ff,#ffffff)" },
  { id: "fire",     label: "Fire",     gradient: "linear-gradient(to right,#100000,#8b0000,#ff4500,#ffff00)" },
  { id: "aurora",   label: "Aurora",   gradient: "linear-gradient(to right,#001a00,#006600,#00ff88,#88ffff)" },
];

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "0.5px solid rgba(100,120,255,0.15)" }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-widest text-left"
        style={{ color: "#7080a8", letterSpacing: "0.1em" }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {title}
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function Slider({
  label, value, min, max, step, unit = "",
  onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-2">
      <div className="flex justify-between mb-1">
        <span style={{ fontSize: 11, color: "#7080a8" }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: "var(--font-jetbrains)", color: "#00d4ff" }}>
          {value.toFixed(step < 1 ? 2 : 0)}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

export default function CosmicSidebar() {
  const store = useSimulatorStore();
  const [textInput, setTextInput] = useState("QUANTUM");

  if (!store.sidebarOpen) return null;

  return (
    <aside
      className="absolute top-0 right-0 h-full w-64 z-10 flex flex-col overflow-y-auto"
      style={{ background: "rgba(8,10,26,0.82)", backdropFilter: "blur(16px)", borderLeft: "0.5px solid rgba(100,120,255,0.18)" }}
      role="complementary"
      aria-label="Simulator controls"
    >
      <Section title="SIMULATION">
        <Slider label="Particles" value={store.particleCount} min={500} max={100000} step={500}
          onChange={store.setParticleCount} />
        <Slider label="Time Scale" value={store.timeScale} min={0.1} max={5} step={0.1} unit="×"
          onChange={store.setTimeScale} />
        <Slider label="Gravity G" value={store.gravityG} min={0} max={5} step={0.1}
          onChange={store.setGravityG} />
      </Section>

      <Section title="RENDERING">
        <Slider label="Bloom" value={store.bloomIntensity} min={0} max={1} step={0.05}
          onChange={store.setBloom} />
        <Slider label="Trail" value={store.trailDecay} min={0.5} max={0.99} step={0.01}
          onChange={store.setTrailDecay} />
        <Slider label="Particle Size" value={store.particleSize} min={0.5} max={5} step={0.1}
          onChange={store.setParticleSize} />
      </Section>

      <Section title="COLORMAP">
        <div className="grid grid-cols-3 gap-1.5">
          {COLORMAPS.map((cm) => (
            <button
              key={cm.id}
              onClick={() => store.setColormap(cm.id)}
              style={{
                height: 22, borderRadius: 4, background: cm.gradient,
                border: store.colormap === cm.id ? "2px solid #fff" : "1.5px solid transparent",
                cursor: "pointer",
              }}
              title={cm.label}
              aria-label={`Use ${cm.label} colormap`}
              aria-pressed={store.colormap === cm.id}
            />
          ))}
        </div>
      </Section>

      <Section title="FORCES">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => store.setForceMode("attract")}
            className="flex-1 py-1.5 rounded text-xs transition-all"
            style={{
              border: `0.5px solid ${store.forceMode === "attract" ? "#ffd166" : "rgba(255,107,53,0.3)"}`,
              color: store.forceMode === "attract" ? "#ffd166" : "#ff6b35",
              background: store.forceMode === "attract" ? "rgba(255,209,102,0.1)" : "rgba(255,107,53,0.06)",
            }}
            aria-pressed={store.forceMode === "attract"}
          >
            ● Attract
          </button>
          <button
            onClick={() => store.setForceMode("repel")}
            className="flex-1 py-1.5 rounded text-xs transition-all"
            style={{
              border: `0.5px solid ${store.forceMode === "repel" ? "#ffd166" : "rgba(108,63,197,0.3)"}`,
              color: store.forceMode === "repel" ? "#ffd166" : "#6c3fc5",
              background: store.forceMode === "repel" ? "rgba(255,209,102,0.1)" : "rgba(108,63,197,0.06)",
            }}
            aria-pressed={store.forceMode === "repel"}
          >
            ○ Repel
          </button>
        </div>
        <Slider label="Force Radius" value={store.forceRadius} min={20} max={300} step={5}
          onChange={store.setForceRadius} />
        <Slider label="Strength" value={store.forceStrength} min={0.1} max={10} step={0.1}
          onChange={store.setForceStrength} />
      </Section>

      <Section title="TEXT → PARTICLES">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value.slice(0, 30))}
          maxLength={30}
          placeholder="Type anything..."
          className="w-full text-xs px-2 py-1.5 rounded outline-none mb-2"
          style={{
            background: "rgba(0,212,255,0.05)",
            border: "0.5px solid rgba(100,120,255,0.2)",
            color: "#e8eaf6",
            fontFamily: "var(--font-jetbrains)",
          }}
          aria-label="Text to render as particles"
        />
        <button
          onClick={() => {
            // Signal to engine via custom event
            window.dispatchEvent(
              new CustomEvent("qf:textParticles", { detail: textInput || "QUANTUM" })
            );
          }}
          className="w-full py-1.5 rounded text-xs transition-all"
          style={{
            background: "rgba(0,212,255,0.08)",
            border: "0.5px solid rgba(0,212,255,0.25)",
            color: "#00d4ff",
          }}
          aria-label="Render text as particles"
        >
          Render as Particles ↗
        </button>
      </Section>

      <Section title="PRESETS" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                store.setActivePreset(p.id);
                window.dispatchEvent(
                  new CustomEvent("qf:loadPreset", { detail: p.id })
                );
              }}
              className="py-1.5 px-2 rounded text-xs transition-all text-left leading-tight"
              style={{
                background:
                  store.activePreset === p.id
                    ? "rgba(255,209,102,0.1)"
                    : "rgba(108,63,197,0.08)",
                border: `0.5px solid ${store.activePreset === p.id ? "#ffd166" : "rgba(108,63,197,0.25)"}`,
                color: store.activePreset === p.id ? "#ffd166" : "#e8eaf6",
              }}
              aria-pressed={store.activePreset === p.id}
              aria-label={`Load ${p.label} preset`}
            >
              <span className="mr-1" style={{ fontSize: 10 }}>{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="SHORTCUTS" defaultOpen={false}>
        <div className="space-y-1" style={{ fontSize: 10, color: "#4a5480", fontFamily: "var(--font-jetbrains)" }}>
          {[
            ["Space", "Explode"],
            ["R", "Reset preset"],
            ["P", "Pause/Play"],
            ["S", "Toggle sidebar"],
            ["E", "Toggle equation"],
            ["←/→", "Time scale"],
            ["Click+Drag", "Attract"],
            ["Shift+Drag", "Repel"],
          ].map(([key, action]) => (
            <div key={key} className="flex justify-between">
              <span style={{ color: "#00d4ff" }}>{key}</span>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </Section>
    </aside>
  );
}
