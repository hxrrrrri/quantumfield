/**
 * @fileoverview Physics Panel — displays the active physics mode's equation,
 * historical note, and parameter sliders using KaTeX for math rendering.
 */
"use client";

import { useEffect, useRef } from "react";
import { useSimulatorStore } from "@/store/simulatorStore";
import type { PhysicsMode } from "@/types";

interface PhysicsInfo {
  equation: string;
  latex: string;
  discoverer: string;
  year: number;
  description: string;
  params: Array<{ key: string; label: string; min: number; max: number; step: number; unit?: string }>;
}

const PHYSICS_INFO: Record<PhysicsMode, PhysicsInfo> = {
  classical: {
    equation: "F = Gm₁m₂/r²",
    latex: "F = \\frac{Gm_1 m_2}{r^2}",
    discoverer: "Isaac Newton",
    year: 1687,
    description: "Universal gravitation: every mass attracts every other mass with force proportional to the product of their masses and inversely proportional to the square of the distance.",
    params: [
      { key: "gravityG", label: "G (gravity)", min: 0, max: 5, step: 0.1 },
    ],
  },
  quantum: {
    equation: "iℏ∂ψ/∂t = Ĥψ",
    latex: "i\\hbar\\frac{\\partial\\psi}{\\partial t} = \\hat{H}\\psi",
    discoverer: "Erwin Schrödinger",
    year: 1926,
    description: "The time-dependent Schrödinger equation governs how quantum states evolve. Particles are described by wavefunctions ψ whose squared modulus |ψ|² gives probability density.",
    params: [],
  },
  relativity: {
    equation: "γ = 1/√(1−v²/c²)",
    latex: "\\gamma = \\frac{1}{\\sqrt{1-v^2/c^2}}",
    discoverer: "Albert Einstein",
    year: 1905,
    description: "Special relativity: the Lorentz factor γ determines time dilation, length contraction, and relativistic mass increase as particles approach the speed of light.",
    params: [],
  },
  fluid: {
    equation: "ρ(r) = Σmⱼ·W(r−rⱼ,h)",
    latex: "\\rho(\\mathbf{r}) = \\sum_j m_j W(\\mathbf{r}-\\mathbf{r}_j, h)",
    discoverer: "Lucy, Gingold & Monaghan",
    year: 1977,
    description: "Smoothed Particle Hydrodynamics (SPH): fluid density is estimated by interpolating over neighboring particles using a kernel function W with smoothing length h.",
    params: [],
  },
  em: {
    equation: "F = q(E + v×B)",
    latex: "\\mathbf{F} = q(\\mathbf{E} + \\mathbf{v} \\times \\mathbf{B})",
    discoverer: "H.A. Lorentz",
    year: 1895,
    description: "The Lorentz force law: a charged particle in an electromagnetic field experiences both electric force qE and magnetic force qv×B perpendicular to its velocity.",
    params: [],
  },
  future: {
    equation: "S = −1/(2α′)∫d²σ·∂Xᵘ∂Xᵤ",
    latex: "S = -\\frac{1}{2\\pi\\alpha'} \\int d^2\\sigma\\, \\partial_a X^\\mu \\partial^a X_\\mu",
    discoverer: "Nambu, Nielsen, Susskind",
    year: 1970,
    description: "String theory Nambu-Goto action: particles are 1D vibrating strings. Different vibrational modes correspond to different particles. The string tension α′ sets the energy scale.",
    params: [],
  },
};

export default function PhysicsPanel() {
  const store = useSimulatorStore();
  const equationRef = useRef<HTMLDivElement>(null);
  const info = PHYSICS_INFO[store.physicsMode];

  useEffect(() => {
    if (!equationRef.current || !info) return;

    // Dynamic KaTeX render
    import("katex").then((katex) => {
      if (!equationRef.current) return;
      try {
        katex.default.render(info.latex, equationRef.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch {
        if (equationRef.current) {
          equationRef.current.textContent = info.equation;
        }
      }
    }).catch(() => {
      if (equationRef.current) {
        equationRef.current.textContent = info?.equation ?? "";
      }
    });
  }, [store.physicsMode, info]);

  if (!info) return null;

  return (
    <div role="region" aria-label={`${info.discoverer} physics information`}>
      {/* KaTeX equation */}
      <div
        ref={equationRef}
        className="katex-equation"
        style={{ marginBottom: 8 }}
        aria-label={`Equation: ${info.equation}`}
      >
        {info.equation}
      </div>

      {/* Historical note */}
      <div
        style={{
          fontSize: 9,
          color: "#4a5480",
          marginBottom: 6,
          fontFamily: "monospace",
          letterSpacing: "0.05em",
        }}
      >
        — {info.discoverer}, {info.year}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 10,
          color: "#7080a8",
          lineHeight: 1.55,
          marginBottom: 8,
        }}
      >
        {info.description}
      </div>

      {/* Parameter sliders */}
      {info.params.map((param) => (
        <div key={param.key} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 10, color: "#7080a8" }}>{param.label}</span>
            <span style={{ fontSize: 10, color: "#00d4ff", fontFamily: "monospace" }}>
              {store.gravityG.toFixed(1)}{param.unit ?? ""}
            </span>
          </div>
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={param.step}
            value={param.key === "gravityG" ? store.gravityG : 1}
            onChange={(e) => {
              if (param.key === "gravityG") store.setGravityG(parseFloat(e.target.value));
            }}
            aria-label={param.label}
          />
        </div>
      ))}
    </div>
  );
}
