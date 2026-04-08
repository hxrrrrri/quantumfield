/**
 * @fileoverview Classical physics module — Newtonian gravity, EM forces,
 * SPH fluid, thermodynamics, springs, and rigid body collisions.
 * All apply() functions mutate Float32Array buffers directly for performance.
 */

import type { PhysicsParams } from "@/types";

export const classicalModule = {
  name: "Classical Physics",
  equation: "F = Gm₁m₂/r²",
  discoverer: "Isaac Newton",
  year: 1687,
  description:
    "Barnes-Hut tree gravity with Coulomb electrostatics, Lorentz force, SPH fluid, and thermodynamics.",
};

interface ParticleArrays {
  px: Float32Array;
  py: Float32Array;
  pvx: Float32Array;
  pvy: Float32Array;
  pm: Float32Array;
  pcharge: Float32Array;
  pax: Float32Array;
  pay: Float32Array;
  count: number;
}

/** Barnes-Hut quad-tree node */
interface BHNode {
  x: number;
  y: number;
  w: number;
  h: number;
  mass: number;
  cx: number;
  cy: number;
  children: (BHNode | null)[];
  particleIdx: number;
}

/**
 * Build a Barnes-Hut quad-tree for O(n log n) gravity.
 */
function buildBarnesHutTree(
  px: Float32Array,
  py: Float32Array,
  pm: Float32Array,
  count: number,
  bounds: { x: number; y: number; w: number; h: number }
): BHNode {
  const root: BHNode = {
    ...bounds,
    mass: 0,
    cx: 0,
    cy: 0,
    children: [null, null, null, null],
    particleIdx: -1,
  };

  for (let i = 0; i < count; i++) {
    insertBH(root, i, px[i] ?? 0, py[i] ?? 0, pm[i] ?? 1);
  }
  return root;
}

function insertBH(
  node: BHNode,
  idx: number,
  x: number,
  y: number,
  mass: number
): void {
  // Update center of mass
  node.cx = (node.cx * node.mass + x * mass) / (node.mass + mass);
  node.cy = (node.cy * node.mass + y * mass) / (node.mass + mass);
  node.mass += mass;

  if (node.particleIdx === -1 && node.children.every((c) => c === null)) {
    node.particleIdx = idx;
    return;
  }

  // Subdivide if needed
  if (node.particleIdx >= 0) {
    const px2 = node.cx;
    const py2 = node.cy;
    const pm2 = mass;
    node.particleIdx = -2;
    insertBH(node, node.particleIdx, px2, py2, pm2);
  }

  const qx = x >= node.x + node.w / 2 ? 1 : 0;
  const qy = y >= node.y + node.h / 2 ? 1 : 0;
  const qi = qy * 2 + qx;

  if (!node.children[qi]) {
    node.children[qi] = {
      x: node.x + qx * node.w / 2,
      y: node.y + qy * node.h / 2,
      w: node.w / 2,
      h: node.h / 2,
      mass: 0,
      cx: 0,
      cy: 0,
      children: [null, null, null, null],
      particleIdx: -1,
    };
  }
  insertBH(node.children[qi]!, idx, x, y, mass);
}

function computeBHForce(
  node: BHNode,
  x: number,
  y: number,
  G: number,
  theta: number,
  softening: number
): [number, number] {
  if (node.mass === 0) return [0, 0];
  const dx = node.cx - x;
  const dy = node.cy - y;
  const r2 = dx * dx + dy * dy + softening * softening;
  const r = Math.sqrt(r2);

  // Barnes-Hut criterion: s/d < theta
  const s = Math.max(node.w, node.h);
  if (s / r < theta || node.children.every((c) => c === null)) {
    const f = (G * node.mass) / r2;
    return [(f * dx) / r, (f * dy) / r];
  }

  let fx = 0,
    fy = 0;
  for (const child of node.children) {
    if (child) {
      const [cfx, cfy] = computeBHForce(child, x, y, G, theta, softening);
      fx += cfx;
      fy += cfy;
    }
  }
  return [fx, fy];
}

/**
 * Apply Newtonian gravity using Barnes-Hut tree (O(n log n)).
 */
export function applyGravity(
  arrays: ParticleArrays,
  params: PhysicsParams,
  canvasW: number,
  canvasH: number
): void {
  const { px, py, pm, pax, pay, count } = arrays;
  const { G } = params;
  const THETA = 0.8;
  const SOFTENING = 15;

  const tree = buildBarnesHutTree(px, py, pm, count, {
    x: 0,
    y: 0,
    w: canvasW,
    h: canvasH,
  });

  for (let i = 0; i < count; i++) {
    const [fx, fy] = computeBHForce(
      tree,
      px[i] ?? 0,
      py[i] ?? 0,
      G,
      THETA,
      SOFTENING
    );
    const m = pm[i] ?? 1;
    pax[i] = (pax[i] ?? 0) + fx / m;
    pay[i] = (pay[i] ?? 0) + fy / m;
  }
}

/**
 * Apply Coulomb electrostatic force between charged particles.
 * F = k·q1·q2/r²
 */
export function applyCoulomb(
  arrays: ParticleArrays,
  params: PhysicsParams
): void {
  const { px, py, pcharge, pax, pay, count } = arrays;
  const { k } = params;
  const CUTOFF = 80;
  const CUTOFF2 = CUTOFF * CUTOFF;
  const SOFTENING2 = 16;

  for (let i = 0; i < count; i++) {
    const qi = pcharge[i] ?? 0;
    if (qi === 0) continue;
    for (let j = i + 1; j < count; j++) {
      const qj = pcharge[j] ?? 0;
      if (qj === 0) continue;
      const dx = (px[j] ?? 0) - (px[i] ?? 0);
      const dy = (py[j] ?? 0) - (py[i] ?? 0);
      const r2 = dx * dx + dy * dy + SOFTENING2;
      if (r2 > CUTOFF2) continue;
      const r = Math.sqrt(r2);
      const f = (k * qi * qj) / r2;
      const fx = (f * dx) / r;
      const fy = (f * dy) / r;
      const mi = arrays.pm[i] ?? 1;
      const mj = arrays.pm[j] ?? 1;
      pax[i] = (pax[i] ?? 0) - fx / mi;
      pay[i] = (pay[i] ?? 0) - fy / mi;
      pax[j] = (pax[j] ?? 0) + fx / mj;
      pay[j] = (pay[j] ?? 0) + fy / mj;
    }
  }
}

/**
 * Apply Lorentz force: F = q(E + v×B)
 * B field is uniform in z-direction.
 */
export function applyLorentz(
  arrays: ParticleArrays,
  params: PhysicsParams,
  Bz: number,
  Ex: number,
  Ey: number
): void {
  const { pvx, pvy, pcharge, pax, pay, pm, count } = arrays;
  for (let i = 0; i < count; i++) {
    const q = pcharge[i] ?? 0;
    if (q === 0) continue;
    const vx = pvx[i] ?? 0;
    const vy = pvy[i] ?? 0;
    const m = pm[i] ?? 1;
    // v×B in 2D: (vy*Bz, -vx*Bz)
    const fx = q * (Ex + vy * Bz);
    const fy = q * (Ey - vx * Bz);
    pax[i] = (pax[i] ?? 0) + fx / m;
    pay[i] = (pay[i] ?? 0) + fy / m;
  }
}

/**
 * Simplified SPH (Smoothed Particle Hydrodynamics) pressure + viscosity.
 */
export function applySPH(
  arrays: ParticleArrays,
  params: PhysicsParams,
  smoothingH: number,
  restDensity: number,
  pressureK: number,
  viscosity: number
): void {
  const { px, py, pvx, pvy, pm, pax, pay, count } = arrays;
  const h2 = smoothingH * smoothingH;
  const densities = new Float32Array(count);

  // Compute densities
  for (let i = 0; i < count; i++) {
    let density = 0;
    for (let j = 0; j < count; j++) {
      const dx = (px[j] ?? 0) - (px[i] ?? 0);
      const dy = (py[j] ?? 0) - (py[i] ?? 0);
      const r2 = dx * dx + dy * dy;
      if (r2 < h2) {
        const q = 1 - r2 / h2;
        density += (pm[j] ?? 1) * q * q * q;
      }
    }
    densities[i] = density;
  }

  // Compute pressure forces
  for (let i = 0; i < count; i++) {
    const pi = pressureK * (densities[i]! - restDensity);
    for (let j = i + 1; j < count; j++) {
      const dx = (px[j] ?? 0) - (px[i] ?? 0);
      const dy = (py[j] ?? 0) - (py[i] ?? 0);
      const r2 = dx * dx + dy * dy;
      if (r2 >= h2 || r2 < 0.001) continue;
      const r = Math.sqrt(r2);
      const pj = pressureK * (densities[j]! - restDensity);
      const w = (1 - r / smoothingH) ** 2;
      const pressureForce = (pi + pj) * w * 0.5;
      const viscForce =
        viscosity *
        ((pvx[j]! - pvx[i]!) * dx + (pvy[j]! - pvy[i]!) * dy) *
        w;

      const fx = ((pressureForce * dx) / r + viscForce) * 0.01;
      const fy = ((pressureForce * dy) / r + viscForce) * 0.01;
      const mi = pm[i] ?? 1;
      const mj = pm[j] ?? 1;
      pax[i] = (pax[i] ?? 0) - fx / mi;
      pay[i] = (pay[i] ?? 0) - fy / mi;
      pax[j] = (pax[j] ?? 0) + fx / mj;
      pay[j] = (pay[j] ?? 0) + fy / mj;
    }
  }
}

/**
 * Elastic collision response between two particles.
 * Returns updated velocities for both particles.
 */
export function elasticCollision(
  m1: number,
  v1x: number,
  v1y: number,
  m2: number,
  v2x: number,
  v2y: number,
  nx: number,
  ny: number,
  restitution = 1.0
): { v1x: number; v1y: number; v2x: number; v2y: number } {
  const relVx = v2x - v1x;
  const relVy = v2y - v1y;
  const dot = relVx * nx + relVy * ny;
  if (dot > 0) return { v1x, v1y, v2x, v2y };
  const j = (-(1 + restitution) * dot) / (1 / m1 + 1 / m2);
  return {
    v1x: v1x - (j * nx) / m1,
    v1y: v1y - (j * ny) / m1,
    v2x: v2x + (j * nx) / m2,
    v2y: v2y + (j * ny) / m2,
  };
}

/**
 * Maxwell-Boltzmann velocity distribution initializer.
 * Assigns velocities sampled from thermal distribution.
 */
export function initMaxwellBoltzmann(
  pvx: Float32Array,
  pvy: Float32Array,
  count: number,
  temperature: number,
  kB: number
): void {
  const sigma = Math.sqrt(kB * temperature);
  for (let i = 0; i < count; i++) {
    // Box-Muller transform for Gaussian sampling
    const u1 = Math.random();
    const u2 = Math.random();
    const mag = sigma * Math.sqrt(-2 * Math.log(u1 + 1e-10));
    pvx[i] = mag * Math.cos(2 * Math.PI * u2);
    pvy[i] = mag * Math.sin(2 * Math.PI * u2);
  }
}
