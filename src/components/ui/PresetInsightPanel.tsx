"use client";

import { useMemo } from "react";
import { useSimulatorStore } from "@/store/simulatorStore";
import type { PresetName } from "@/types";
import ANNVisualizer from "@/components/ml/ANNVisualizer";
import CNNVisualizer from "@/components/ml/CNNVisualizer";
import GANVisualizer from "@/components/ml/GANVisualizer";
import TransformerVisualizer from "@/components/ml/TransformerVisualizer";
import RNNVisualizer from "@/components/ml/RNNVisualizer";
import SolarSystemVisualizer from "@/components/physics/SolarSystemVisualizer";

type InsightMeta = {
  title: string;
  equation: string;
  description: string;
  pipeline: string[];
};

const PRESET_META: Record<PresetName, InsightMeta> = {
  bigbang: {
    title: "Big Bang Expansion",
    equation: "v = H0 · r",
    description: "Particles originate from a hot dense center and follow expansion vectors with residual turbulence.",
    pipeline: ["Singularity seed", "Radial expansion", "Velocity cooling", "Cluster emergence"],
  },
  galaxy: {
    title: "Galaxy Spiral",
    equation: "F = Gm1m2 / r^2",
    description: "Arm-aligned initial conditions plus gravity produce emergent spiral structure.",
    pipeline: ["Arm seeding", "Orbital drift", "Core attraction", "Spiral reinforcement"],
  },
  doubleslit: {
    title: "Double Slit Interference",
    equation: "P = |psi1 + psi2|^2",
    description: "Two coherent wavefront paths interfere constructively and destructively on the detector plane.",
    pipeline: ["Wave emission", "Slit split", "Phase accumulation", "Interference bands"],
  },
  blackhole: {
    title: "Black Hole Accretion",
    equation: "rs = 2GM / c^2",
    description: "Strong central gravity bends trajectories, causing high-density orbiting rings and in-fall.",
    pipeline: ["Accretion ring", "Angular momentum", "Relativistic drift", "Event horizon loss"],
  },
  electroncloud: {
    title: "Electron Cloud",
    equation: "psi_nlm = R_nl · Y_lm",
    description: "Particles approximate probability shells around a nucleus with shell-dependent motion.",
    pipeline: ["Shell sampling", "Angular phase", "Orbital drift", "Cloud resonance"],
  },
  plasma: {
    title: "Plasma Storm",
    equation: "F = q(E + v x B)",
    description: "Charged particles interact with electric and magnetic terms causing filament-like flow.",
    pipeline: ["Charge assignment", "Lorentz force", "Field coupling", "Filament dynamics"],
  },
  vortex: {
    title: "Fluid Vortex",
    equation: "omega = curl(v)",
    description: "Tangential velocity profiles generate coherent swirl structures around a rotating core.",
    pipeline: ["Spin injection", "Shear zone", "Vortex lock", "Energy dissipation"],
  },
  strings: {
    title: "String Modes",
    equation: "S = -Integral d^2sigma · partialX^2 / (2alpha')",
    description: "Particles trace vibrating strand-like trajectories with phase-coupled oscillations.",
    pipeline: ["Strand lattice", "Mode excitation", "Phase coupling", "Standing waves"],
  },
  bec: {
    title: "BEC Condensate",
    equation: "E = hbar * omega * (n + 1/2)",
    description: "Low-energy coherent packets condense into highly ordered synchronized clusters.",
    pipeline: ["Cooling", "Wave overlap", "Coherence lock", "Collective drift"],
  },
  supernova: {
    title: "Supernova Shock",
    equation: "L = 4piR^2sigmaT^4",
    description: "A compact core explodes into high-energy shells that expand and cool over time.",
    pipeline: ["Core ignition", "Shock front", "Ejecta expansion", "Remnant fade"],
  },
  cnn: {
    title: "CNN Architecture",
    equation: "y = conv(x, w) + b",
    description: "Convolution kernels stride over local windows, then pooling downsamples to robust feature maps.",
    pipeline: ["Input grid", "Kernel stride", "Convolution map", "Max pooling"],
  },
  transformer: {
    title: "Transformer Attention",
    equation: "Attn = softmax(QK^T / sqrt(d))V",
    description: "Tokens interact through multi-head attention to form context-aware embeddings.",
    pipeline: ["Tokenization", "Q/K/V projection", "Head attention", "Context fusion"],
  },
  anntraining: {
    title: "ANN Training",
    equation: "sigma(z) = 1 / (1 + e^-z)",
    description: "Forward activations and weighted links encode nonlinear mapping across hidden layers.",
    pipeline: ["Forward pass", "Activation fire", "Error signal", "Weight adaptation"],
  },
  gan: {
    title: "GAN Adversarial Loop",
    equation: "min_G max_D V(D,G)",
    description: "Generator and discriminator compete, improving realism via adversarial training feedback.",
    pipeline: ["Noise sample", "Synthetic output", "Discriminator score", "Gradient feedback"],
  },
  dna: {
    title: "DNA Dynamics",
    equation: "pitch = 3.4A per bp",
    description: "Helical strands and cross-links maintain structure while phase drift animates sequence flow.",
    pipeline: ["Double strand", "Base pairing", "Helical twist", "Temporal drift"],
  },
  solar: {
    title: "Solar System",
    equation: "T^2 proportional to a^3",
    description: "Planets orbit the sun at different angular velocities with moon sub-orbits on major bodies.",
    pipeline: ["Orbital radius", "Angular velocity", "Planet revolution", "Moon coupling"],
  },
  tunneling: {
    title: "Quantum Tunneling",
    equation: "T approximately e^(-2ka)",
    description: "Wave packets partially traverse classically forbidden barriers based on energy-width relation.",
    pipeline: ["Incident wave", "Barrier encounter", "Exponential decay", "Transmission tail"],
  },
  wavecollapse: {
    title: "Wave Collapse",
    equation: "Delta x Delta p >= hbar/2",
    description: "Probabilistic states transition to compact outcomes while preserving uncertainty constraints.",
    pipeline: ["Superposition", "Measurement impulse", "State reduction", "Post-collapse spread"],
  },
  darkmatter: {
    title: "Dark Matter Halo",
    equation: "Omega_DM approximately 0.27",
    description: "Visible tracers orbit in potential wells dominated by unseen mass components.",
    pipeline: ["Halo field", "Visible tracers", "Hidden influence", "Rotation anomaly"],
  },
  portrait: {
    title: "Portrait Reconstruction",
    equation: "Poisson-like spatial sampling",
    description: "Particles map luminance and edge density to reconstruct facial structure from stochastic seeds.",
    pipeline: ["Pixel sampling", "Edge emphasis", "Density map", "Morph fit"],
  },
};

function GenericInsight({ meta }: { meta: InsightMeta }) {
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateRows: "1fr auto",
        background: "rgba(0,0,0,0.75)",
        border: "1px solid rgba(112,162,255,0.2)",
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div style={{ color: "rgba(165,211,255,0.9)", fontFamily: "monospace", fontSize: 11, lineHeight: 1.55 }}>
        {meta.description}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {meta.pipeline.map((step, i) => (
          <span
            key={step}
            style={{
              padding: "5px 8px",
              borderRadius: 4,
              border: "1px solid rgba(0,255,176,0.22)",
              background: `rgba(0,255,176,${0.08 + i * 0.02})`,
              color: "rgba(177,255,229,0.95)",
              fontFamily: "monospace",
              fontSize: 10,
            }}
          >
            {i + 1}. {step}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PresetInsightPanel() {
  const activePreset = useSimulatorStore((s) => s.activePreset);

  const meta = useMemo(() => {
    if (!activePreset) {
      return {
        title: "Shape Mode",
        equation: "No active preset",
        description: "Select a preset (CNN, GAN, Solar, etc.) to inspect detailed working simulations and internal flow.",
        pipeline: ["Choose preset", "Open insights", "Inspect internal stages", "Tune controls"],
      } satisfies InsightMeta;
    }
    return PRESET_META[activePreset];
  }, [activePreset]);

  let body: React.ReactNode;
  switch (activePreset) {
    case "anntraining":
      body = <ANNVisualizer />;
      break;
    case "cnn":
      body = <CNNVisualizer />;
      break;
    case "gan":
      body = <GANVisualizer />;
      break;
    case "transformer":
      body = <TransformerVisualizer />;
      break;
    case "dna":
    case "strings":
      body = <RNNVisualizer width={920} height={320} />;
      break;
    case "solar":
      body = <SolarSystemVisualizer />;
      break;
    default:
      body = <GenericInsight meta={meta} />;
      break;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 10,
        padding: 10,
        background: "rgba(0,0,0,0.55)",
      }}
      aria-label="Preset insight panel"
    >
      <div>
        <div style={{ color: "rgba(144,236,255,0.95)", fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 11, fontWeight: 700 }}>
          {meta.title}
        </div>
        <div style={{ color: "rgba(255,204,122,0.92)", fontFamily: "monospace", fontSize: 10, marginTop: 3 }}>
          {meta.equation}
        </div>
      </div>

      <div style={{ minHeight: 0, overflow: "hidden" }}>{body}</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {meta.pipeline.map((step, i) => (
          <span
            key={step}
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              color: "rgba(165,213,255,0.9)",
              border: "1px solid rgba(132,169,237,0.26)",
              background: "rgba(10,18,30,0.72)",
              padding: "4px 7px",
              borderRadius: 4,
            }}
          >
            {i + 1}. {step}
          </span>
        ))}
      </div>
    </div>
  );
}
