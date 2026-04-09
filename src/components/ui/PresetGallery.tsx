/**
 * @fileoverview Preset gallery component with descriptions and preview info.
 */
"use client";

import { useSimulatorStore } from "@/store/simulatorStore";
import type { PresetName } from "@/types";

interface PresetMeta {
  id: PresetName;
  icon: string;
  label: string;
  physics: string;
  equation: string;
  particles: string;
}

const PRESETS: PresetMeta[] = [
  { id: "bigbang",     icon: "💥", label: "Big Bang",       physics: "Relativity",  equation: "V=H₀r",           particles: "30k" },
  { id: "galaxy",      icon: "🌌", label: "Galaxy Spiral",  physics: "Classical",   equation: "F=Gm₁m₂/r²",      particles: "50k" },
  { id: "doubleslit",  icon: "◈",  label: "Double Slit",    physics: "Quantum",     equation: "P=|ψ₁+ψ₂|²",      particles: "10k" },
  { id: "blackhole",   icon: "⚫", label: "Black Hole",     physics: "Relativity",  equation: "rs=2GM/c²",        particles: "25k" },
  { id: "electroncloud",icon:"⚛", label: "Electron Cloud", physics: "Quantum",     equation: "ψnlm = Rnl·Ylm",   particles: "20k" },
  { id: "plasma",      icon: "⚡", label: "Plasma Storm",   physics: "EM Field",    equation: "F=q(E+v×B)",       particles: "20k" },
  { id: "vortex",      icon: "🌀", label: "Fluid Vortex",   physics: "SPH Fluid",   equation: "∇×v=ω",            particles: "15k" },
  { id: "strings",     icon: "∿",  label: "String Theory",  physics: "Future",      equation: "S=−∫d²σ·∂X²/2α′", particles: "10k" },
  { id: "bec",         icon: "❄",  label: "BEC Condensate", physics: "Quantum",     equation: "E=ℏω(n+½)",        particles: "20k" },
  { id: "supernova",   icon: "💫", label: "Supernova",      physics: "Classical",   equation: "L=4πR²σT⁴",        particles: "40k" },
  { id: "anntraining", icon: "🧠", label: "Neural Training", physics: "ML",         equation: "σ(z)=1/(1+e⁻ᶻ)",  particles: "15k" },
  { id: "cnn",         icon: "🧩", label: "CNN Filters",     physics: "ML",          equation: "conv(x,w)+b",      particles: "14k" },
  { id: "transformer", icon: "🔀", label: "Transformer",    physics: "ML",          equation: "Attn=softmax(QKᵀ/√d)V", particles: "8k" },
  { id: "gan",         icon: "⚔",  label: "GAN Adversarial",physics: "ML",          equation: "min_G max_D V(D,G)", particles: "12k" },
  { id: "dna",         icon: "🧬", label: "DNA Helix",      physics: "Classical",   equation: "3.4Å/bp 10.5bp/turn", particles: "8k" },
  { id: "solar",       icon: "☀",  label: "Solar System",   physics: "Classical",   equation: "T²∝a³",             particles: "5k" },
  { id: "tunneling",   icon: "〜", label: "Q. Tunneling",   physics: "Quantum",     equation: "T≈e^{-2κa}",        particles: "10k" },
  { id: "wavecollapse",icon: "∿",  label: "Wave Collapse",  physics: "Quantum",     equation: "ΔxΔp≥ℏ/2",         particles: "15k" },
  { id: "darkmatter",  icon: "✦",  label: "Dark Matter",    physics: "Future",      equation: "Ω_DM≈0.27",         particles: "30k" },
  { id: "portrait",    icon: "🎨", label: "Image Portrait", physics: "Classical",   equation: "Poisson sampling",  particles: "50k" },
];

export default function PresetGallery() {
  const store = useSimulatorStore();

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}
      role="list"
      aria-label="Simulation presets"
    >
      {PRESETS.map((p) => (
        <button
          key={p.id}
          role="listitem"
          onClick={() => {
            store.setActivePreset(p.id);
            store.setANNPanelOpen(true);
            window.dispatchEvent(new CustomEvent("qf:loadPreset", { detail: p.id }));
          }}
          style={{
            padding: "5px 6px",
            borderRadius: 5,
            textAlign: "left",
            cursor: "pointer",
            border: `0.5px solid ${store.activePreset === p.id ? "#ffd166" : "rgba(108,63,197,0.22)"}`,
            background:
              store.activePreset === p.id
                ? "rgba(255,209,102,0.08)"
                : "rgba(108,63,197,0.06)",
            transition: "border-color 0.2s, background 0.2s",
          }}
          aria-pressed={store.activePreset === p.id}
          aria-label={`Load ${p.label} preset — ${p.physics}`}
          title={`${p.label}\n${p.equation}\n${p.particles} particles`}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 1 }}>
            <span style={{ fontSize: 11 }}>{p.icon}</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 500,
                color: store.activePreset === p.id ? "#ffd166" : "#e8eaf6",
                lineHeight: 1.2,
              }}
            >
              {p.label}
            </span>
          </div>
          <div
            style={{
              fontSize: 8,
              color: "#4a5480",
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {p.equation}
          </div>
        </button>
      ))}
    </div>
  );
}
