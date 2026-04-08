"use client";
import { useEffect, useRef, useCallback } from "react";

interface GANVisualizerProps { width?: number; height?: number; }

export default function GANVisualizer({ width = 600, height = 280 }: GANVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "rgba(3,4,10,0.2)";
    ctx.fillRect(0, 0, width, height);

    const genX = width * 0.22, discX = width * 0.75;
    const cy = height / 2;

    // Generator
    ctx.beginPath(); ctx.arc(genX, cy, 36, 0, Math.PI * 2);
    const pulse = Math.sin(t * 0.003) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(108,63,197,${pulse * 0.3})`; ctx.fill();
    ctx.strokeStyle = "rgba(108,63,197,0.6)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#e8eaf6"; ctx.font = "bold 10px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("G", genX, cy);
    ctx.font = "9px monospace"; ctx.fillStyle = "#7080a8";
    ctx.fillText("Generator", genX, cy + 50);

    // Noise input
    for (let n = 0; n < 8; n++) {
      const nx = 20 + Math.random() * 30;
      const ny = cy - 30 + Math.random() * 60;
      const a = Math.sin(t * 0.005 + n) * 0.5 + 0.5;
      ctx.beginPath(); ctx.arc(nx, ny, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,200,255,${a})`; ctx.fill();
    }

    // Generated samples flowing to discriminator
    const flowPhase = (t * 0.001) % 1;
    for (let s = 0; s < 6; s++) {
      const fp = (flowPhase + s / 6) % 1;
      const fx = genX + 36 + fp * (discX - genX - 72);
      const fy = cy + Math.sin(fp * Math.PI * 2 + s) * 20;
      const isFake = s % 2 === 0;
      ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2);
      ctx.fillStyle = isFake ? "rgba(255,107,53,0.8)" : "rgba(0,212,255,0.8)";
      ctx.fill();
    }

    // Discriminator
    ctx.beginPath(); ctx.arc(discX, cy, 36, 0, Math.PI * 2);
    const dpulse = Math.sin(t * 0.003 + 1) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(0,212,255,${dpulse * 0.25})`; ctx.fill();
    ctx.strokeStyle = "rgba(0,212,255,0.5)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#e8eaf6"; ctx.font = "bold 10px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("D", discX, cy);
    ctx.font = "9px monospace"; ctx.fillStyle = "#7080a8";
    ctx.fillText("Discriminator", discX, cy + 50);

    // Real/Fake label
    const decision = Math.sin(t * 0.004) > 0 ? "FAKE" : "REAL";
    ctx.fillStyle = decision === "FAKE" ? "#ff6b35" : "#00ff88";
    ctx.font = "bold 11px monospace"; ctx.textBaseline = "middle";
    ctx.fillText(decision, discX + 55, cy);

    // Loss values
    const gLoss = 0.5 + Math.sin(t * 0.002) * 0.3;
    const dLoss = 0.5 - Math.sin(t * 0.002) * 0.2;
    ctx.fillStyle = "#6c3fc5"; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(`G loss: ${gLoss.toFixed(2)}`, genX, cy - 55);
    ctx.fillStyle = "#00d4ff";
    ctx.fillText(`D loss: ${dLoss.toFixed(2)}`, discX, cy - 55);

    animRef.current = requestAnimationFrame(draw);
  }, [width, height]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  return (
    <div style={{ background: "#03040a", borderRadius: 8 }} role="img" aria-label="GAN training visualizer">
      <canvas ref={canvasRef} width={width} height={height} style={{ display: "block" }} />
    </div>
  );
}
