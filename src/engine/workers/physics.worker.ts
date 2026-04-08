/**
 * @fileoverview Physics Web Worker — runs simulation off main thread.
 * Receives SharedArrayBuffer references for zero-copy data sharing.
 */

import type { PhysicsWorkerInput, PhysicsWorkerOutput } from "@/types";

// eslint-disable-next-line no-restricted-globals
const ctx = self as unknown as Worker;

function applyGravitySimple(
  px: Float32Array, py: Float32Array,
  pvx: Float32Array, pvy: Float32Array,
  pm: Float32Array,
  count: number, G: number, canvasW: number, canvasH: number,
  dt: number
): void {
  const cx = canvasW / 2, cy = canvasH / 2;
  const cellSize = 70;
  const gcx = Math.ceil(canvasW / cellSize) + 1;
  const gcy = Math.ceil(canvasH / cellSize) + 1;
  const gridMass = new Float32Array(gcx * gcy);
  const gridX = new Float32Array(gcx * gcy);
  const gridY = new Float32Array(gcx * gcy);

  for (let i = 0; i < count; i++) {
    const gx = Math.max(0, Math.min(gcx - 1, Math.floor((px[i] ?? 0) / cellSize)));
    const gy = Math.max(0, Math.min(gcy - 1, Math.floor((py[i] ?? 0) / cellSize)));
    const gi = gy * gcx + gx;
    gridMass[gi] = (gridMass[gi] ?? 0) + (pm[i] ?? 1);
    gridX[gi] = (gridX[gi] ?? 0) + (px[i] ?? 0) * (pm[i] ?? 1);
    gridY[gi] = (gridY[gi] ?? 0) + (py[i] ?? 0) * (pm[i] ?? 1);
  }

  for (let i = 0; i < count; i++) {
    let ax = 0, ay = 0;
    const gxi = Math.floor((px[i] ?? 0) / cellSize);
    const gyi = Math.floor((py[i] ?? 0) / cellSize);
    for (let dgx = -2; dgx <= 2; dgx++) {
      for (let dgy = -2; dgy <= 2; dgy++) {
        const nx = gxi + dgx, ny = gyi + dgy;
        if (nx < 0 || nx >= gcx || ny < 0 || ny >= gcy) continue;
        const gi = ny * gcx + nx;
        const mass = gridMass[gi] ?? 0;
        if (mass < 0.001) continue;
        const cmx = (gridX[gi] ?? 0) / mass;
        const cmy = (gridY[gi] ?? 0) / mass;
        const dx = cmx - (px[i] ?? 0);
        const dy = cmy - (py[i] ?? 0);
        const r2 = dx * dx + dy * dy + 200;
        const r = Math.sqrt(r2);
        const f = G * mass / r2;
        ax += f * dx / r;
        ay += f * dy / r;
      }
    }
    // Central attractor
    const dx = cx - (px[i] ?? 0), dy = cy - (py[i] ?? 0);
    const r2 = dx * dx + dy * dy + 400;
    const r = Math.sqrt(r2);
    ax += G * 0.4 * dx / r2;
    ay += G * 0.4 * dy / r2;

    pvx[i] = ((pvx[i] ?? 0) + ax * dt) * 0.9998;
    pvy[i] = ((pvy[i] ?? 0) + ay * dt) * 0.9998;
  }
}

ctx.addEventListener("message", (e: MessageEvent<PhysicsWorkerInput>) => {
  const start = performance.now();
  const { type, buffers, count, dt, mode, params, mouseX, mouseY,
    forceMode, forceRadius, forceStrength, canvasW, canvasH } = e.data;

  if (type !== "step") return;

  const px = new Float32Array(buffers.position);
  const py = new Float32Array(buffers.position).subarray(count);
  const pvx = new Float32Array(buffers.velocity);
  const pvy = new Float32Array(buffers.velocity).subarray(count);
  const pm = new Float32Array(buffers.properties);

  // Mouse force
  if (forceMode !== "none") {
    const r2Max = forceRadius * forceRadius;
    for (let i = 0; i < count; i++) {
      const dx = (px[i] ?? 0) - mouseX;
      const dy = (py[i] ?? 0) - mouseY;
      const r2 = dx * dx + dy * dy;
      if (r2 < r2Max && r2 > 1) {
        const r = Math.sqrt(r2);
        const f = (forceStrength * (1 - r / forceRadius)) / r;
        const sign = forceMode === "repel" ? 1 : -1;
        pvx[i] = (pvx[i] ?? 0) + sign * dx * f;
        pvy[i] = (pvy[i] ?? 0) + sign * dy * f;
      }
    }
  }

  if (mode === "classical") {
    applyGravitySimple(px, py, pvx, pvy, pm, count, params.G, canvasW, canvasH, dt);
  }

  // Integrate positions
  for (let i = 0; i < count; i++) {
    px[i] = (px[i] ?? 0) + (pvx[i] ?? 0) * dt;
    py[i] = (py[i] ?? 0) + (pvy[i] ?? 0) * dt;
    if (px[i]! < 0) px[i] = canvasW;
    else if (px[i]! > canvasW) px[i] = 0;
    if (py[i]! < 0) py[i] = canvasH;
    else if (py[i]! > canvasH) py[i] = 0;
  }

  let ke = 0;
  for (let i = 0; i < Math.min(count, 500); i++) {
    ke += 0.5 * (pm[i] ?? 1) * ((pvx[i] ?? 0) ** 2 + (pvy[i] ?? 0) ** 2);
  }
  ke *= count / Math.min(count, 500);

  const frameTime = performance.now() - start;
  const response: PhysicsWorkerOutput = { type: "stepped", count, kineticEnergy: ke, frameTime };
  ctx.postMessage(response);
});

// Graceful shutdown
globalThis.addEventListener?.("beforeunload", () => {
  ctx.postMessage({ type: "terminated" });
});
