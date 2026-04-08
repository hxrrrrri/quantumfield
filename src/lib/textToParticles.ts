/**
 * @fileoverview Convert text to particle positions via Canvas2D pixel sampling.
 * Supports morphing between two texts using optimal transport assignment.
 */

import type { TextParticleOptions } from "@/types";

export interface TextParticleResult {
  positions: Float32Array; // [x0,y0, x1,y1, ...]
  count: number;
}

/**
 * Render text to offscreen canvas and sample non-background pixels.
 */
export function textToParticles(
  options: TextParticleOptions,
  targetCount: number,
  canvasW: number,
  canvasH: number
): TextParticleResult {
  const { text, font, fontSize } = options;

  const offscreen = document.createElement("canvas");
  offscreen.width = canvasW;
  offscreen.height = canvasH;
  const ctx = offscreen.getContext("2d");
  if (!ctx) return { positions: new Float32Array(0), count: 0 };

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvasW, canvasH);

  const actualSize = Math.min(
    fontSize,
    canvasW / Math.max(1, text.length) * 1.7,
    canvasH * 0.7
  );

  ctx.fillStyle = "white";
  ctx.font = `bold ${actualSize}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvasW / 2, canvasH / 2);

  const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
  const pixels: Array<{ x: number; y: number }> = [];

  const step = Math.max(1, Math.floor(Math.sqrt((canvasW * canvasH) / targetCount) * 0.9));

  for (let y = 0; y < canvasH; y += step) {
    for (let x = 0; x < canvasW; x += step) {
      const idx = (y * canvasW + x) * 4;
      if ((imageData.data[idx] ?? 0) > 100) {
        pixels.push({
          x: x + (Math.random() - 0.5) * step,
          y: y + (Math.random() - 0.5) * step,
        });
      }
    }
  }

  const count = Math.min(pixels.length, targetCount);
  const positions = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    positions[i * 2] = pixels[i]!.x;
    positions[i * 2 + 1] = pixels[i]!.y;
  }

  return { positions, count };
}

/**
 * Compute greedy optimal transport assignment between two point sets.
 * Minimizes total travel distance for smooth morphing.
 */
export function greedyAssignment(
  sourcePositions: Float32Array,
  targetPositions: Float32Array,
  count: number
): Int32Array {
  const assignment = new Int32Array(count);
  const used = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    const sx = sourcePositions[i * 2] ?? 0;
    const sy = sourcePositions[i * 2 + 1] ?? 0;

    let bestJ = 0;
    let bestDist = Infinity;

    for (let j = 0; j < count; j++) {
      if (used[j]) continue;
      const tx = targetPositions[j * 2] ?? 0;
      const ty = targetPositions[j * 2 + 1] ?? 0;
      const dist = (sx - tx) ** 2 + (sy - ty) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestJ = j;
      }
    }

    assignment[i] = bestJ;
    used[bestJ] = 1;
  }

  return assignment;
}

/**
 * Apply spring forces pulling particles toward text target positions.
 */
export function applyTextSpringForces(
  pxArr: Float32Array,
  pyArr: Float32Array,
  pvxArr: Float32Array,
  pvyArr: Float32Array,
  targetPositions: Float32Array,
  count: number,
  dt: number,
  stiffness = 0.04,
  damping = 0.88
): void {
  const targetCount = targetPositions.length / 2;

  for (let i = 0; i < count; i++) {
    if (i < targetCount) {
      const tx = targetPositions[i * 2] ?? 0;
      const ty = targetPositions[i * 2 + 1] ?? 0;
      const dx = tx - (pxArr[i] ?? 0);
      const dy = ty - (pyArr[i] ?? 0);

      pvxArr[i] = ((pvxArr[i] ?? 0) + dx * stiffness * dt) * damping;
      pvyArr[i] = ((pvyArr[i] ?? 0) + dy * stiffness * dt) * damping;
    } else {
      // Extra particles drift
      pvxArr[i] = ((pvxArr[i] ?? 0)) * 0.95;
      pvyArr[i] = ((pvyArr[i] ?? 0) + 0.05 * dt) * 0.95;
    }

    pxArr[i] = (pxArr[i] ?? 0) + (pvxArr[i] ?? 0) * dt;
    pyArr[i] = (pyArr[i] ?? 0) + (pvyArr[i] ?? 0) * dt;
  }
}
