/**
 * @fileoverview Special & General Relativity physics module.
 * Implements Lorentz factor, time dilation, length contraction,
 * Schwarzschild geodesics, and gravitational redshift.
 */

import type { PhysicsParams } from "@/types";

export const relativityModule = {
  name: "Special & General Relativity",
  equation: "γ = 1/√(1−v²/c²)",
  discoverer: "Albert Einstein",
  year: 1905,
  description:
    "Lorentz boost, relativistic mass, gravitational time dilation, and Schwarzschild geodesic paths.",
};

/**
 * Lorentz factor γ = 1/√(1−β²)
 */
export function lorentzFactor(v: number, c: number): number {
  const beta2 = (v * v) / (c * c);
  return 1 / Math.sqrt(Math.max(1 - beta2, 1e-6));
}

/**
 * Relativistic momentum p = γmv
 */
export function relativisticMomentum(
  mass: number,
  velocity: number,
  c: number
): number {
  return lorentzFactor(velocity, c) * mass * velocity;
}

/**
 * Relativistic kinetic energy KE = (γ−1)mc²
 */
export function relativisticKE(mass: number, velocity: number, c: number): number {
  return (lorentzFactor(velocity, c) - 1) * mass * c * c;
}

/**
 * Schwarzschild radius rs = 2GM/c²
 */
export function schwarzschildRadius(
  mass: number,
  G: number,
  c: number
): number {
  return (2 * G * mass) / (c * c);
}

/**
 * Gravitational time dilation near massive body.
 * τ/t = √(1 − rs/r)
 */
export function gravitationalTimeDilation(
  r: number,
  rs: number
): number {
  if (r <= rs) return 0;
  return Math.sqrt(Math.max(0, 1 - rs / r));
}

/**
 * Apply SR/GR forces: relativistic momentum update + Schwarzschild gravity.
 */
export function applyRelativity(
  pxArr: Float32Array,
  pyArr: Float32Array,
  pvxArr: Float32Array,
  pvyArr: Float32Array,
  pmArr: Float32Array,
  pcArr: Float32Array,
  palpha: Float32Array,
  count: number,
  dt: number,
  params: PhysicsParams,
  canvasW: number,
  canvasH: number,
  blackHoleMass: number
): void {
  const { c, G } = params;
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const rs = schwarzschildRadius(blackHoleMass, G, c);

  for (let i = 0; i < count; i++) {
    const x = pxArr[i] ?? 0;
    const y = pyArr[i] ?? 0;
    let vx = pvxArr[i] ?? 0;
    let vy = pvyArr[i] ?? 0;
    const m = pmArr[i] ?? 1;

    const speed = Math.sqrt(vx * vx + vy * vy);
    const gamma = lorentzFactor(speed, c);

    // Relativistic effective mass
    const mEff = m * gamma;

    // Gravitational force (Schwarzschild approximation)
    const dx = cx - x;
    const dy = cy - y;
    const r = Math.sqrt(dx * dx + dy * dy) + 0.1;
    const timeDil = gravitationalTimeDilation(r, rs);

    // GR correction: geodesic precession factor
    const grFactor = 1 + (3 * rs) / (2 * r);
    const gravF = (G * blackHoleMass * grFactor) / (r * r);
    const ax = (gravF * dx) / (r * mEff);
    const ay = (gravF * dy) / (r * mEff);

    // Update relativistic velocity: a = F/(γm)
    vx += ax * dt * timeDil;
    vy += ay * dt * timeDil;

    // Hard speed limit at 0.99c
    const newSpeed = Math.sqrt(vx * vx + vy * vy);
    if (newSpeed > c * 0.99) {
      const scale = (c * 0.99) / newSpeed;
      vx *= scale;
      vy *= scale;
    }

    pvxArr[i] = vx;
    pvyArr[i] = vy;

    // Proper time passes slower near black hole
    const properDt = dt * timeDil;
    let nx = x + vx * properDt;
    let ny = y + vy * properDt;

    // Boundary
    if (nx < 0) nx = canvasW;
    if (nx > canvasW) nx = 0;
    if (ny < 0) ny = canvasH;
    if (ny > canvasH) ny = 0;

    pxArr[i] = nx;
    pyArr[i] = ny;

    // Color by γ factor: high gamma = bright
    const gammaNew = lorentzFactor(
      Math.sqrt(vx * vx + vy * vy),
      c
    );
    pcArr[i] = Math.min(1, (gammaNew - 1) * 0.4);
    palpha[i] = 0.4 + Math.min(0.6, (gammaNew - 1) * 0.3);

    // Inside Schwarzschild radius → event horizon absorption
    if (r < rs * 1.2) {
      pcArr[i] = 1.0;
      palpha[i] = 0.2;
    }
  }
}

/**
 * Compute Minkowski spacetime interval: s² = c²Δt² − Δx² − Δy²
 */
export function minkowskiInterval(
  dt: number,
  dx: number,
  dy: number,
  c: number
): number {
  return c * c * dt * dt - dx * dx - dy * dy;
}

/**
 * Length contraction: L = L₀/γ along motion axis
 */
export function lengthContraction(
  L0: number,
  velocity: number,
  c: number
): number {
  return L0 / lorentzFactor(velocity, c);
}

/**
 * Time dilation: Δt' = γ·Δt
 */
export function timeDilation(
  properTime: number,
  velocity: number,
  c: number
): number {
  return lorentzFactor(velocity, c) * properTime;
}
