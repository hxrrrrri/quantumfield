/**
 * @fileoverview CNN Visualizer — shows convolutional layers, kernel sliding,
 * feature maps, and pooling as particle animations.
 */
"use client";

import { useEffect, useRef, useCallback } from "react";

interface CNNVisualizerProps {
  width?: number;
  height?: number;
}

const INPUT_SIZE = 14;
const KERNEL = 3;
const STRIDE = 2;
const CONV_SIZE = Math.floor((INPUT_SIZE - KERNEL) / STRIDE) + 1;
const POOL = 2;
const POOL_STRIDE = 2;
const POOL_SIZE = Math.floor((CONV_SIZE - POOL) / POOL_STRIDE) + 1;

type Matrix = number[][];

function buildMatrix(rows: number, cols: number, seed: number): Matrix {
  const out: Matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v =
        0.5 +
        0.25 * Math.sin((x + seed) * 0.72) +
        0.2 * Math.cos((y + seed) * 0.54) +
        0.15 * Math.sin((x + y + seed) * 0.45);
      out[y]![x] = Math.max(0, Math.min(1, v));
    }
  }
  return out;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function colorHeat(v: number): string {
  const n = Math.max(0, Math.min(1, v));
  const r = Math.round(lerp(18, 255, n));
  const g = Math.round(lerp(30, 180, n));
  const b = Math.round(lerp(80, 24, n));
  return `rgb(${r},${g},${b})`;
}

function drawMatrix(
  ctx: CanvasRenderingContext2D,
  matrix: Matrix,
  x0: number,
  y0: number,
  cell: number,
  title: string,
  subtitle?: string
): void {
  ctx.fillStyle = "rgba(8,14,26,0.95)";
  ctx.fillRect(x0 - 8, y0 - 28, matrix[0]!.length * cell + 16, matrix.length * cell + 40);
  ctx.strokeStyle = "rgba(110,170,255,0.35)";
  ctx.strokeRect(x0 - 8, y0 - 28, matrix[0]!.length * cell + 16, matrix.length * cell + 40);

  ctx.fillStyle = "rgba(179,224,255,0.9)";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title, x0, y0 - 16);
  if (subtitle) {
    ctx.fillStyle = "rgba(132,170,214,0.9)";
    ctx.font = "9px monospace";
    ctx.fillText(subtitle, x0, y0 - 4);
  }

  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[0]!.length; x++) {
      const v = matrix[y]![x] ?? 0;
      ctx.fillStyle = colorHeat(v);
      ctx.fillRect(x0 + x * cell, y0 + y * cell, cell - 1, cell - 1);
    }
  }
}

export default function CNNVisualizer({ width = 920, height = 360 }: CNNVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const inputRef = useRef<Matrix>(buildMatrix(INPUT_SIZE, INPUT_SIZE, 1.7));
  const kernelRef = useRef<Matrix>([
    [0.12, 0.34, -0.08],
    [0.28, 0.52, 0.22],
    [-0.14, 0.26, 0.18],
  ]);
  const convRef = useRef<Matrix>(Array.from({ length: CONV_SIZE }, () => Array.from({ length: CONV_SIZE }, () => 0.5)));
  const poolRef = useRef<Matrix>(Array.from({ length: POOL_SIZE }, () => Array.from({ length: POOL_SIZE }, () => 0.5)));

  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, width, height);

    const input = inputRef.current;
    const kernel = kernelRef.current;
    const conv = convRef.current;
    const pool = poolRef.current;

    const scanIdx = Math.floor((t * 0.0015) % (CONV_SIZE * CONV_SIZE));
    const outY = Math.floor(scanIdx / CONV_SIZE);
    const outX = scanIdx % CONV_SIZE;
    const inX = outX * STRIDE;
    const inY = outY * STRIDE;

    let sum = 0;
    for (let ky = 0; ky < KERNEL; ky++) {
      for (let kx = 0; kx < KERNEL; kx++) {
        const iv = input[inY + ky]?.[inX + kx] ?? 0;
        const kv = kernel[ky]?.[kx] ?? 0;
        sum += iv * kv;
      }
    }
    const act = Math.max(0, Math.tanh(sum * 1.8) * 0.5 + 0.5);
    conv[outY]![outX] = conv[outY]![outX] * 0.82 + act * 0.18;

    for (let py = 0; py < POOL_SIZE; py++) {
      for (let px = 0; px < POOL_SIZE; px++) {
        let maxV = 0;
        for (let yy = 0; yy < POOL; yy++) {
          for (let xx = 0; xx < POOL; xx++) {
            maxV = Math.max(maxV, conv[py * POOL_STRIDE + yy]?.[px * POOL_STRIDE + xx] ?? 0);
          }
        }
        pool[py]![px] = pool[py]![px] * 0.88 + maxV * 0.12;
      }
    }

    const inputX = 20;
    const matrixY = 58;
    const inputCell = 12;
    const kernelX = 238;
    const kernelY = 118;
    const convX = 324;
    const convY = 86;
    const convCell = 16;
    const poolX = 482;
    const poolY = 132;
    const poolCell = 24;

    drawMatrix(ctx, input, inputX, matrixY, inputCell, "INPUT MAP", "14x14 feature grid");
    drawMatrix(ctx, kernel, kernelX, kernelY, 18, "KERNEL", "3x3, stride=2");
    drawMatrix(ctx, conv, convX, convY, convCell, "CONV OUT", "ReLU activations 6x6");
    drawMatrix(ctx, pool, poolX, poolY, poolCell, "MAX POOL", "2x2 downsampling");

    ctx.strokeStyle = "rgba(255,199,97,0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      inputX + inX * inputCell,
      matrixY + inY * inputCell,
      KERNEL * inputCell,
      KERNEL * inputCell
    );

    const convTargetX = convX + outX * convCell + convCell * 0.5;
    const convTargetY = convY + outY * convCell + convCell * 0.5;
    const srcX = inputX + inX * inputCell + KERNEL * inputCell * 0.5;
    const srcY = matrixY + inY * inputCell + KERNEL * inputCell * 0.5;

    ctx.beginPath();
    ctx.moveTo(srcX, srcY);
    ctx.lineTo(convTargetX, convTargetY);
    ctx.strokeStyle = "rgba(80,175,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const travel = (t * 0.0022) % 1;
    const px = srcX + (convTargetX - srcX) * travel;
    const py = srcY + (convTargetY - srcY) * travel;
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(145,245,255,0.95)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(convTargetX, convTargetY, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,122,70,0.85)";
    ctx.fill();

    ctx.fillStyle = "rgba(178,220,255,0.9)";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`scan cell: (${inX}, ${inY})`, 20, 30);
    ctx.fillText(`kernel dot(x,w): ${sum.toFixed(3)}  ->  relu: ${act.toFixed(3)}`, 172, 30);
    ctx.fillText(`downsample ratio: ${(INPUT_SIZE / Math.max(1, POOL_SIZE)).toFixed(2)}x`, 494, 30);

    ctx.fillStyle = "rgba(120,170,210,0.9)";
    ctx.font = "9px monospace";
    ctx.fillText("Stride motion: kernel hops by 2 cells each step", 20, height - 18);
    ctx.fillText("Pooling: max(2x2) preserves strongest response", 292, height - 18);

    animRef.current = requestAnimationFrame(draw);
  }, [width, height]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  return (
    <div style={{ background: "#000", borderRadius: 8 }} role="img" aria-label="Detailed CNN architecture with kernel stride and pooling simulation">
      <canvas ref={canvasRef} width={width} height={height} style={{ display: "block", width: "100%", height: "auto" }} />
    </div>
  );
}
