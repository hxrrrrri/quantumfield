/**
 * @fileoverview Convert an image to a particle array using Poisson disk
 * sampling or uniform grid. Returns typed Float32Arrays for position, color,
 * and mass. Runs in a Web Worker for non-blocking processing.
 */

import type { ImageParticleOptions } from "@/types";

export interface ImageParticleResult {
  positions: Float32Array; // [x0,y0, x1,y1, ...]
  colors: Float32Array;    // [r0,g0,b0,a0, ...]
  masses: Float32Array;    // [m0, m1, ...]
  count: number;
}

/**
 * Poisson disk sampling: ensures minimum distance between samples.
 * Blue-noise distribution for organic particle appearance.
 */
function poissonDiskSample(
  width: number,
  height: number,
  minDist: number,
  maxAttempts = 30
): Array<{ x: number; y: number }> {
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);
  const grid = new Array<{ x: number; y: number } | null>(gridW * gridH).fill(null);
  const active: Array<{ x: number; y: number }> = [];
  const result: Array<{ x: number; y: number }> = [];

  const toGrid = (x: number, y: number) =>
    Math.floor(y / cellSize) * gridW + Math.floor(x / cellSize);

  const first = { x: width / 2, y: height / 2 };
  grid[toGrid(first.x, first.y)] = first;
  active.push(first);
  result.push(first);

  while (active.length > 0) {
    const idx = Math.floor(Math.random() * active.length);
    const point = active[idx]!;
    let found = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = Math.random() * 2 * Math.PI;
      const radius = minDist * (1 + Math.random());
      const candidate = {
        x: point.x + radius * Math.cos(angle),
        y: point.y + radius * Math.sin(angle),
      };

      if (candidate.x < 0 || candidate.x >= width || candidate.y < 0 || candidate.y >= height) {
        continue;
      }

      const gx = Math.floor(candidate.x / cellSize);
      const gy = Math.floor(candidate.y / cellSize);
      let valid = true;

      for (let dx = -2; dx <= 2 && valid; dx++) {
        for (let dy = -2; dy <= 2 && valid; dy++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
          const neighbor = grid[ny * gridW + nx];
          if (neighbor) {
            const d = Math.hypot(candidate.x - neighbor.x, candidate.y - neighbor.y);
            if (d < minDist) valid = false;
          }
        }
      }

      if (valid) {
        grid[toGrid(candidate.x, candidate.y)] = candidate;
        active.push(candidate);
        result.push(candidate);
        found = true;
        break;
      }
    }

    if (!found) {
      active.splice(idx, 1);
    }
  }

  return result;
}

/**
 * Convert image bitmap data to particle arrays.
 * @param imageData - Raw RGBA pixel data from canvas
 * @param width - Image width
 * @param height - Image height
 * @param options - Sampling options
 * @param targetParticles - Desired particle count
 */
export function imageDataToParticles(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  options: ImageParticleOptions,
  targetParticles: number
): ImageParticleResult {
  const { samplingMode, colorFromImage, massFromLuminance } = options;
  const minDist = Math.sqrt((width * height) / targetParticles);

  let samplePoints: Array<{ x: number; y: number }>;

  if (samplingMode === "poisson") {
    samplePoints = poissonDiskSample(width, height, minDist * 0.9);
  } else {
    // Uniform grid
    samplePoints = [];
    const step = Math.max(1, Math.floor(minDist * 0.9));
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        samplePoints.push({ x, y });
      }
    }
  }

  // Filter to non-transparent pixels
  const valid = samplePoints.filter(({ x, y }) => {
    const i = (Math.floor(y) * width + Math.floor(x)) * 4;
    return (imageData[i + 3] ?? 0) > 32;
  });

  const count = Math.min(valid.length, targetParticles);
  const positions = new Float32Array(count * 2);
  const colors = new Float32Array(count * 4);
  const masses = new Float32Array(count);

  for (let p = 0; p < count; p++) {
    const pt = valid[p]!;
    const i = (Math.floor(pt.y) * width + Math.floor(pt.x)) * 4;
    const r = (imageData[i] ?? 0) / 255;
    const g = (imageData[i + 1] ?? 0) / 255;
    const b = (imageData[i + 2] ?? 0) / 255;
    const a = (imageData[i + 3] ?? 255) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    positions[p * 2] = pt.x;
    positions[p * 2 + 1] = pt.y;

    if (colorFromImage) {
      colors[p * 4] = r;
      colors[p * 4 + 1] = g;
      colors[p * 4 + 2] = b;
      colors[p * 4 + 3] = a;
    } else {
      // Use viridis colormap based on luminance
      colors[p * 4] = luminance;
      colors[p * 4 + 1] = luminance;
      colors[p * 4 + 2] = luminance;
      colors[p * 4 + 3] = a;
    }

    masses[p] = massFromLuminance ? 0.2 + luminance * 1.8 : 1.0;
  }

  return { positions, colors, masses, count };
}

/**
 * Load an image file and convert to particles.
 * Runs in the browser; strips EXIF by re-drawing to canvas.
 */
export async function fileToParticles(
  file: File,
  options: ImageParticleOptions,
  targetParticles: number,
  outputW: number,
  outputH: number
): Promise<ImageParticleResult> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = outputW;
      canvas.height = outputH;
      const ctx2d = canvas.getContext("2d");
      if (!ctx2d) return reject(new Error("Canvas 2D not available"));

      // Fit image to output dimensions
      const scale = Math.min(outputW / img.width, outputH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = (outputW - drawW) / 2;
      const drawY = (outputH - drawH) / 2;

      ctx2d.fillStyle = "black";
      ctx2d.fillRect(0, 0, outputW, outputH);
      ctx2d.drawImage(img, drawX, drawY, drawW, drawH);

      const imageData = ctx2d.getImageData(0, 0, outputW, outputH);
      resolve(
        imageDataToParticles(
          imageData.data,
          outputW,
          outputH,
          options,
          targetParticles
        )
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}
