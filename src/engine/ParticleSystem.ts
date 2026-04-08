/**
 * @fileoverview Core particle system data structure.
 * Manages Structure-of-Arrays buffers and lifecycle.
 */

import type { PhysicsMode } from "@/types";
import { SpatialHash } from "./SpatialHash";

export interface ParticleSystemOptions {
  maxCount: number;
  canvasW: number;
  canvasH: number;
}

/** Full SoA particle data */
export class ParticleSystem {
  readonly maxCount: number;
  count: number;
  canvasW: number;
  canvasH: number;

  // Position
  readonly px: Float32Array;
  readonly py: Float32Array;

  // Velocity
  readonly pvx: Float32Array;
  readonly pvy: Float32Array;

  // Acceleration (cleared each frame)
  readonly pax: Float32Array;
  readonly pay: Float32Array;

  // Properties: mass, charge, spin, life
  readonly pm: Float32Array;
  readonly pcharge: Float32Array;
  readonly pspin: Float32Array;
  readonly plife: Float32Array;

  // Color [0,1] and alpha
  readonly pc: Float32Array;
  readonly palpha: Float32Array;

  // Phase (for QM)
  readonly pphase: Float32Array;

  // Flags
  readonly ptype: Uint8Array;
  readonly palive: Uint8Array;

  readonly spatialHash: SpatialHash;

  constructor({ maxCount, canvasW, canvasH }: ParticleSystemOptions) {
    this.maxCount = maxCount;
    this.count = 0;
    this.canvasW = canvasW;
    this.canvasH = canvasH;

    this.px = new Float32Array(maxCount);
    this.py = new Float32Array(maxCount);
    this.pvx = new Float32Array(maxCount);
    this.pvy = new Float32Array(maxCount);
    this.pax = new Float32Array(maxCount);
    this.pay = new Float32Array(maxCount);
    this.pm = new Float32Array(maxCount).fill(1);
    this.pcharge = new Float32Array(maxCount);
    this.pspin = new Float32Array(maxCount);
    this.plife = new Float32Array(maxCount).fill(1);
    this.pc = new Float32Array(maxCount);
    this.palpha = new Float32Array(maxCount).fill(1);
    this.pphase = new Float32Array(maxCount);
    this.ptype = new Uint8Array(maxCount);
    this.palive = new Uint8Array(maxCount).fill(1);

    // Cell size = 2× typical interaction radius
    this.spatialHash = new SpatialHash(canvasW, canvasH, 60, maxCount);
  }

  /** Integrate velocities and positions (Verlet) */
  integrate(dt: number, damping = 0.9998): void {
    for (let i = 0; i < this.count; i++) {
      if (!this.palive[i]) continue;
      this.pvx[i] = ((this.pvx[i] ?? 0) + (this.pax[i] ?? 0) * dt) * damping;
      this.pvy[i] = ((this.pvy[i] ?? 0) + (this.pay[i] ?? 0) * dt) * damping;
      this.px[i] = (this.px[i] ?? 0) + this.pvx[i] * dt;
      this.py[i] = (this.py[i] ?? 0) + this.pvy[i] * dt;
    }
  }

  /** Wrap particles at canvas boundaries */
  wrapBoundaries(): void {
    for (let i = 0; i < this.count; i++) {
      if (this.px[i]! < 0) this.px[i] = this.canvasW;
      else if (this.px[i]! > this.canvasW) this.px[i] = 0;
      if (this.py[i]! < 0) this.py[i] = this.canvasH;
      else if (this.py[i]! > this.canvasH) this.py[i] = 0;
    }
  }

  /** Bounce particles at canvas boundaries */
  bounceBoundaries(restitution = 0.8): void {
    for (let i = 0; i < this.count; i++) {
      if (this.px[i]! < 0) { this.px[i] = 0; this.pvx[i]! *= -restitution; }
      else if (this.px[i]! > this.canvasW) { this.px[i] = this.canvasW; this.pvx[i]! *= -restitution; }
      if (this.py[i]! < 0) { this.py[i] = 0; this.pvy[i]! *= -restitution; }
      else if (this.py[i]! > this.canvasH) { this.py[i] = this.canvasH; this.pvy[i]! *= -restitution; }
    }
  }

  /** Clear accelerations for next frame */
  clearAccelerations(): void {
    this.pax.fill(0);
    this.pay.fill(0);
  }

  /** Rebuild spatial hash */
  rebuildHash(): void {
    this.spatialHash.build(this.px, this.py, this.count);
  }

  /** Apply mouse force */
  applyMouseForce(
    mx: number,
    my: number,
    radius: number,
    strength: number,
    mode: "attract" | "repel"
  ): void {
    const r2Max = radius * radius;
    for (let i = 0; i < this.count; i++) {
      const dx = (this.px[i] ?? 0) - mx;
      const dy = (this.py[i] ?? 0) - my;
      const r2 = dx * dx + dy * dy;
      if (r2 < r2Max && r2 > 1) {
        const r = Math.sqrt(r2);
        const f = (strength * (1 - r / radius)) / r;
        const sign = mode === "repel" ? 1 : -1;
        this.pvx[i] = (this.pvx[i] ?? 0) + sign * dx * f;
        this.pvy[i] = (this.pvy[i] ?? 0) + sign * dy * f;
      }
    }
  }

  /** Compute total kinetic energy */
  kineticEnergy(): number {
    let ke = 0;
    for (let i = 0; i < this.count; i++) {
      const vx = this.pvx[i] ?? 0;
      const vy = this.pvy[i] ?? 0;
      ke += 0.5 * (this.pm[i] ?? 1) * (vx * vx + vy * vy);
    }
    return ke;
  }

  /** Resize to different canvas dimensions */
  resize(newW: number, newH: number): void {
    const scaleX = newW / this.canvasW;
    const scaleY = newH / this.canvasH;
    for (let i = 0; i < this.count; i++) {
      this.px[i] = (this.px[i] ?? 0) * scaleX;
      this.py[i] = (this.py[i] ?? 0) * scaleY;
    }
    this.canvasW = newW;
    this.canvasH = newH;
  }
}
