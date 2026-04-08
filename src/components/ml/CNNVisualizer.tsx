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

export default function CNNVisualizer({ width = 600, height = 340 }: CNNVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "rgba(3,4,10,0.2)";
    ctx.fillRect(0, 0, width, height);

    const layers = [
      { label: "Input", x: 30, w: 60, h: 60, depth: 1, color: "#6c3fc5" },
      { label: "Conv1", x: 130, w: 52, h: 52, depth: 3, color: "#00d4ff" },
      { label: "Pool1", x: 220, w: 26, h: 26, depth: 3, color: "#ffd166" },
      { label: "Conv2", x: 290, w: 22, h: 22, depth: 8, color: "#00d4ff" },
      { label: "Pool2", x: 360, w: 11, h: 11, depth: 8, color: "#ffd166" },
      { label: "FC", x: 430, w: 8, h: 60, depth: 1, color: "#ff6b35" },
      { label: "Out", x: 500, w: 8, h: 24, depth: 1, color: "#00ff88" },
    ];

    // Draw feature map stacks
    for (const layer of layers) {
      const stackN = Math.min(layer.depth, 4);
      for (let d = stackN - 1; d >= 0; d--) {
        const ox = d * 3;
        const oy = d * 2;
        const cy = height / 2 - layer.h / 2;
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(layer.x + ox, cy - oy, layer.w, layer.h);

        // Animated activation fill
        const activation = (Math.sin(t * 0.002 + layer.x * 0.05 + d * 0.5) + 1) / 2;
        ctx.fillStyle = layer.color.replace(")", `,${activation * 0.15})`).replace("rgb", "rgba");
        ctx.fillRect(layer.x + ox + 1, cy - oy + 1, layer.w - 2, layer.h - 2);
      }

      // Label
      ctx.fillStyle = "rgba(112,128,168,0.8)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(layer.label, layer.x + layer.w / 2, height - 10);
    }

    // Sliding kernel animation on Conv1
    const kx = 30 + ((t * 0.05) % 52) - 4;
    const ky = height / 2 - 26;
    ctx.strokeStyle = "rgba(255,165,0,0.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(130 + kx * 0.1, ky + 4, 10, 10);

    // Connection lines between layers
    for (let li = 0; li < layers.length - 1; li++) {
      const a = layers[li]!;
      const b = layers[li + 1]!;
      const x1 = a.x + a.w + (li < layers.length - 2 ? 3 : 0);
      const x2 = b.x;
      const y = height / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.strokeStyle = "rgba(100,120,255,0.2)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [width, height]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  return (
    <div style={{ background: "#03040a", borderRadius: 8 }} role="img" aria-label="CNN architecture visualizer">
      <canvas ref={canvasRef} width={width} height={height} style={{ display: "block" }} />
    </div>
  );
}
