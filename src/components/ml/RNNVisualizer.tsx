"use client";
import { useEffect, useRef, useCallback } from "react";

interface RNNVisualizerProps { width?: number; height?: number; }

export default function RNNVisualizer({ width = 600, height = 280 }: RNNVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "rgba(3,4,10,0.2)";
    ctx.fillRect(0, 0, width, height);
    const steps = 6;
    const stepX = (width - 80) / steps;
    const cy = height / 2;
    const activePulse = (t * 0.002) % 1;

    for (let s = 0; s < steps; s++) {
      const x = 40 + s * stepX;
      const pulse = Math.max(0, 1 - Math.abs(s / steps - activePulse) * 5);
      // Hidden state circle
      const r = 18 + pulse * 8;
      const grd = ctx.createRadialGradient(x, cy, 0, x, cy, r * 2);
      grd.addColorStop(0, `rgba(108,63,197,${0.3 + pulse * 0.6})`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(x, cy, r * 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(20,15,50,0.9)"; ctx.fill();
      ctx.strokeStyle = "rgba(108,63,197,0.5)"; ctx.lineWidth = 1; ctx.stroke();

      // Recurrent arrow
      if (s < steps - 1) {
        const nx = 40 + (s + 1) * stepX;
        ctx.beginPath();
        ctx.moveTo(x + r, cy);
        ctx.lineTo(nx - r, cy);
        ctx.strokeStyle = `rgba(0,212,255,${0.3 + pulse * 0.5})`;
        ctx.lineWidth = 1 + pulse;
        ctx.stroke();
      }
      // Vanishing gradient: fade older steps
      const vanish = Math.max(0, 1 - s * 0.15);
      ctx.fillStyle = `rgba(112,128,168,${vanish * 0.8})`;
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`t=${s}`, x, cy + 32);
    }

    // Cell state river
    ctx.beginPath();
    ctx.moveTo(40, cy - 45);
    for (let s = 0; s <= steps; s++) {
      const x = 40 + s * stepX;
      const wave = Math.sin(t * 0.003 + s * 0.8) * 5;
      if (s === 0) ctx.moveTo(x, cy - 40 + wave);
      else ctx.lineTo(x, cy - 40 + wave);
    }
    ctx.strokeStyle = "rgba(255,209,102,0.5)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "rgba(255,209,102,0.5)"; ctx.font = "9px monospace";
    ctx.textAlign = "left"; ctx.fillText("cell state →", 8, cy - 40);

    animRef.current = requestAnimationFrame(draw);
  }, [width, height]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  return (
    <div style={{ background: "#03040a", borderRadius: 8 }} role="img" aria-label="RNN/LSTM unrolled visualizer">
      <canvas ref={canvasRef} width={width} height={height} style={{ display: "block" }} />
    </div>
  );
}
