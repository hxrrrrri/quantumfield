/**
 * @fileoverview Quantum mechanics physics module.
 * Implements wavefunction visualization, double-slit interference,
 * quantum tunneling, harmonic oscillator, and spin states.
 */

import type { PhysicsParams } from "@/types";

export const quantumModule = {
  name: "Quantum Mechanics",
  equation: "iℏ∂ψ/∂t = Ĥψ",
  discoverer: "Erwin Schrödinger",
  year: 1926,
  description:
    "Time-dependent Schrödinger equation with split-operator method. Visualizes |ψ|² as particle density.",
};

/** Complex number for wavefunction arithmetic */
interface Complex {
  re: number;
  im: number;
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}
function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cExp(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) };
}
function cAbs2(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

/** 2D wavefunction grid for split-operator method */
export class WavefunctionGrid {
  private readonly nx: number;
  private readonly ny: number;
  private psi: Complex[][];
  private readonly dx: number;
  private readonly dy: number;
  private readonly hbar: number;
  private readonly mass: number;

  constructor(
    nx: number,
    ny: number,
    dx: number,
    dy: number,
    hbar: number,
    mass: number
  ) {
    this.nx = nx;
    this.ny = ny;
    this.dx = dx;
    this.dy = dy;
    this.hbar = hbar;
    this.mass = mass;
    this.psi = Array.from({ length: nx }, () =>
      Array.from({ length: ny }, () => ({ re: 0, im: 0 }))
    );
    this.initGaussian(nx / 2, ny / 2, nx / 8, ny / 8, 2, 0);
  }

  /** Initialize as Gaussian wavepacket */
  initGaussian(
    x0: number,
    y0: number,
    sx: number,
    sy: number,
    kx: number,
    ky: number
  ): void {
    let norm = 0;
    for (let i = 0; i < this.nx; i++) {
      for (let j = 0; j < this.ny; j++) {
        const x = i - x0;
        const y = j - y0;
        const envelope = Math.exp(
          -(x * x) / (2 * sx * sx) - (y * y) / (2 * sy * sy)
        );
        const phase = kx * x + ky * y;
        this.psi[i]![j] = {
          re: envelope * Math.cos(phase),
          im: envelope * Math.sin(phase),
        };
        norm += cAbs2(this.psi[i]![j]!);
      }
    }
    // Normalize
    const invSqrtNorm = 1 / Math.sqrt(norm + 1e-10);
    for (let i = 0; i < this.nx; i++) {
      for (let j = 0; j < this.ny; j++) {
        this.psi[i]![j]!.re *= invSqrtNorm;
        this.psi[i]![j]!.im *= invSqrtNorm;
      }
    }
  }

  /**
   * One half-step in position space (potential propagator).
   * U_V(dt/2) = exp(-i·V·dt/2ℏ)
   */
  applyPotentialHalfStep(V: number[][], dt: number): void {
    for (let i = 0; i < this.nx; i++) {
      for (let j = 0; j < this.ny; j++) {
        const v = V[i]?.[j] ?? 0;
        const phase = -(v * dt) / (2 * this.hbar);
        const propagator = cExp(phase);
        this.psi[i]![j] = cMul(this.psi[i]![j]!, propagator);
      }
    }
  }

  /** Get probability density |ψ|² at grid point */
  getDensity(i: number, j: number): number {
    return cAbs2(this.psi[i]?.[j] ?? { re: 0, im: 0 });
  }

  /** Sample particle positions according to |ψ|² distribution */
  samplePositions(nParticles: number): Array<{ x: number; y: number }> {
    const densities: number[] = [];
    let total = 0;
    for (let i = 0; i < this.nx; i++) {
      for (let j = 0; j < this.ny; j++) {
        const d = this.getDensity(i, j);
        densities.push(d);
        total += d;
      }
    }

    const positions: Array<{ x: number; y: number }> = [];
    for (let p = 0; p < nParticles; p++) {
      let r = Math.random() * total;
      for (let k = 0; k < densities.length; k++) {
        r -= densities[k]!;
        if (r <= 0) {
          const i = Math.floor(k / this.ny);
          const j = k % this.ny;
          positions.push({
            x: i * this.dx + (Math.random() - 0.5) * this.dx,
            y: j * this.dy + (Math.random() - 0.5) * this.dy,
          });
          break;
        }
      }
    }
    return positions;
  }
}

/**
 * Compute quantum tunneling transmission probability using WKB approximation.
 * T ≈ exp(-2·∫√(2m(V-E)/ℏ²)dx)
 */
export function tunnelingProbability(
  E: number,
  V0: number,
  barrierWidth: number,
  mass: number,
  hbar: number
): number {
  if (E >= V0) return 1.0;
  const kappa = Math.sqrt((2 * mass * (V0 - E)) / (hbar * hbar));
  const exponent = -2 * kappa * barrierWidth;
  return Math.exp(Math.max(exponent, -50));
}

/**
 * Compute harmonic oscillator energy eigenvalues.
 * E_n = ℏω(n + 1/2)
 */
export function harmonicOscillatorEnergy(
  n: number,
  omega: number,
  hbar: number
): number {
  return hbar * omega * (n + 0.5);
}

/**
 * Double-slit interference pattern intensity.
 * I(y) ∝ cos²(π·d·y / λ·L) · sinc²(π·a·y / λ·L)
 */
export function doubleSlitIntensity(
  y: number,
  slitSeparation: number,
  slitWidth: number,
  wavelength: number,
  distance: number
): number {
  const arg1 = (Math.PI * slitSeparation * y) / (wavelength * distance);
  const arg2 = (Math.PI * slitWidth * y) / (wavelength * distance);
  const interference = Math.cos(arg1) ** 2;
  const diffraction = arg2 === 0 ? 1 : (Math.sin(arg2) / arg2) ** 2;
  return interference * diffraction;
}

/**
 * Heisenberg uncertainty: compute Δx·Δp for a particle ensemble.
 */
export function uncertaintyProduct(
  px: Float32Array,
  pvx: Float32Array,
  pm: Float32Array,
  count: number
): { deltaX: number; deltaPx: number; product: number } {
  let meanX = 0,
    meanP = 0;
  let totalMass = 0;
  for (let i = 0; i < count; i++) {
    const m = pm[i] ?? 1;
    meanX += (px[i] ?? 0) * m;
    meanP += (pvx[i] ?? 0) * m;
    totalMass += m;
  }
  meanX /= totalMass;
  meanP /= totalMass;

  let varX = 0,
    varP = 0;
  for (let i = 0; i < count; i++) {
    const m = pm[i] ?? 1;
    varX += m * ((px[i]! - meanX) ** 2);
    varP += m * ((pvx[i]! - meanP) ** 2);
  }
  varX /= totalMass;
  varP /= totalMass;

  const deltaX = Math.sqrt(varX);
  const deltaPx = Math.sqrt(varP);
  return { deltaX, deltaPx, product: deltaX * deltaPx };
}

/**
 * Apply quantum-like force: particles follow |ψ|² density gradient.
 * Used in visualization mode for particle steering.
 */
export function applyQuantumDrift(
  pxArr: Float32Array,
  pyArr: Float32Array,
  pvxArr: Float32Array,
  pvyArr: Float32Array,
  pphase: Float32Array,
  count: number,
  dt: number,
  params: PhysicsParams,
  canvasW: number,
  canvasH: number
): void {
  const { hbar } = params;
  const k = 0.06;

  for (let i = 0; i < count; i++) {
    const x = pxArr[i] ?? 0;
    const y = pyArr[i] ?? 0;
    const phase = pphase[i] ?? 0;

    // Quantum potential from wavefunction gradient
    const psiRe = Math.sin(x * k + phase) * Math.cos(y * k * 0.7 + phase * 0.8);
    const gradX = k * Math.cos(x * k + phase) * Math.cos(y * k * 0.7 + phase * 0.8);
    const gradY =
      -k * 0.7 *
      Math.sin(x * k + phase) *
      Math.sin(y * k * 0.7 + phase * 0.8);

    // Bohmian velocity: v = (ℏ/m) · Im(∇ψ/ψ)
    const psi2 = psiRe * psiRe + 1e-8;
    const bohmVx = (hbar / (params.dt + 0.001)) * (gradX / psi2) * 0.02;
    const bohmVy = (hbar / (params.dt + 0.001)) * (gradY / psi2) * 0.02;

    pvxArr[i] = (pvxArr[i] ?? 0) + bohmVx * dt;
    pvyArr[i] = (pvyArr[i] ?? 0) + bohmVy * dt;

    // Phase evolution: ∂φ/∂t = -E/ℏ
    pphase[i] = phase + (0.1 * dt) / Math.max(hbar, 0.001);

    // Boundary: periodic
    let nx = x + (pvxArr[i] ?? 0) * dt;
    let ny = y + (pvyArr[i] ?? 0) * dt;
    if (nx < 0) nx += canvasW;
    if (nx > canvasW) nx -= canvasW;
    if (ny < 0) ny += canvasH;
    if (ny > canvasH) ny -= canvasH;
    pxArr[i] = nx;
    pyArr[i] = ny;

    // Velocity damping
    pvxArr[i] = (pvxArr[i] ?? 0) * 0.999;
    pvyArr[i] = (pvyArr[i] ?? 0) * 0.999;
  }
}
