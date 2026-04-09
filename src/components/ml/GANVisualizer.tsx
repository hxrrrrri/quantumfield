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
    
    // Smooth trailing effect
    ctx.fillStyle = "rgba(4, 8, 16, 0.4)";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "screen";

    const genX = width * 0.25, discX = width * 0.75;
    const cy = height / 2;

    // Draw Generator Network (Multi-layer nodes)
    const gNodes = [4, 6, 8, 6];
    for(let layer = 0; layer < gNodes.length; layer++) {
      const lx = genX - 40 + layer * 25;
      const count = gNodes[layer]!;
      for(let n = 0; n < count; n++) {
        const ny = cy - (count * 12)/2 + n * 12;
        ctx.beginPath(); ctx.arc(lx, ny, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 80, 255, ${0.4 + Math.sin(t*0.005 + layer)*0.4})`;
        ctx.fill();
        // connect to next layer
        if(layer < gNodes.length - 1) {
            const nextCount = gNodes[layer+1]!;
            for(let nn = 0; nn < nextCount; nn++) {
                const nny = cy - (nextCount * 12)/2 + nn * 12;
                ctx.beginPath(); ctx.moveTo(lx, ny); ctx.lineTo(genX - 40 + (layer+1)*25, nny);
                ctx.strokeStyle = `rgba(180, 80, 255, 0.05)`; ctx.stroke();
            }
        }
      }
    }

    // Generator Main Core
    ctx.beginPath(); ctx.arc(genX + 45, cy, 28, 0, Math.PI * 2);
    const pulse = Math.sin(t * 0.003) * 0.3 + 0.7;
    const gGrad = ctx.createRadialGradient(genX+45, cy, 0, genX+45, cy, 28);
    gGrad.addColorStop(0, `rgba(160,80,255,${pulse})`);
    gGrad.addColorStop(1, `rgba(60,20,120,0)`);
    ctx.fillStyle = gGrad; ctx.fill();
    ctx.strokeStyle = "rgba(180,100,255,0.6)"; ctx.lineWidth = 1; ctx.stroke();
    
    ctx.fillStyle = "#e8eaf6"; ctx.font = "bold 11px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("G-NET", genX + 45, cy);
    ctx.font = "9px monospace"; ctx.fillStyle = "#90a0c8";
    ctx.fillText("Generator Maps", genX + 45, cy + 45);

    // Noise latent vector input to G
    for (let n = 0; n < 20; n++) {
      const nx = genX - 80 + Math.random() * 20;
      const ny = cy - 40 + Math.random() * 80;
      const a = Math.sin(t * 0.01 + n) * 0.5 + 0.5;
      ctx.beginPath(); ctx.arc(nx, ny, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,240,255,${a})`; ctx.fill();
    }

    // Generated samples flowing to discriminator (Intense Particle Flow)
    const flowPhase = (t * 0.002) % 1;
    for (let s = 0; s < 40; s++) {
      const fp = (flowPhase + s / 40) % 1;
      const fx = genX + 75 + fp * (discX - genX - 120);
      const fy = cy + Math.sin(fp * Math.PI * 4 + s) * 15 * Math.sin(fp * Math.PI);
      const isFake = s % 3 !== 0; // mostly fakes from G
      ctx.beginPath(); ctx.arc(fx, fy, isFake ? 2.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isFake ? `rgba(255,80,180,${Math.sin(fp*Math.PI)})` : `rgba(0,255,180,${Math.sin(fp*Math.PI)})`;
      ctx.fill();
    }

    // Real Data Input flowing to Discriminator
    for (let s = 0; s < 15; s++) {
        const fp = (flowPhase + s / 15) % 1;
        const fx = discX - 45 - Math.cos(fp * Math.PI / 2) * 50;
        const fy = cy - 80 + fp * 80;
        ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,180,${fp})`; ctx.fill();
    }
    ctx.fillStyle = "#00ffb4"; ctx.font = "10px monospace";
    ctx.fillText("Real Data", discX - 60, cy - 90);

    // Draw Discriminator Network
    const dNodes = [8, 6, 4, 1];
    for(let layer = 0; layer < dNodes.length; layer++) {
      const lx = discX + 25 + layer * 20;
      const count = dNodes[layer]!;
      for(let n = 0; n < count; n++) {
        const ny = cy - (count * 12)/2 + n * 12;
        ctx.beginPath(); ctx.arc(lx, ny, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 200, 255, ${0.4 + Math.sin(t*0.005 + layer)*0.4})`;
        ctx.fill();
        if(layer < dNodes.length - 1) {
            const nextCount = dNodes[layer+1]!;
            for(let nn = 0; nn < nextCount; nn++) {
                const nny = cy - (nextCount * 12)/2 + nn * 12;
                ctx.beginPath(); ctx.moveTo(lx, ny); ctx.lineTo(discX + 25 + (layer+1)*20, nny);
                ctx.strokeStyle = `rgba(0, 200, 255, 0.05)`; ctx.stroke();
            }
        }
      }
    }

    // Discriminator Core
    ctx.beginPath(); ctx.arc(discX - 15, cy, 28, 0, Math.PI * 2);
    const dpulse = Math.sin(t * 0.004 + 1) * 0.3 + 0.7;
    const dGrad = ctx.createRadialGradient(discX-15, cy, 0, discX-15, cy, 28);
    dGrad.addColorStop(0, `rgba(0,200,255,${dpulse})`);
    dGrad.addColorStop(1, `rgba(0,50,100,0)`);
    ctx.fillStyle = dGrad; ctx.fill();
    ctx.strokeStyle = "rgba(0,255,255,0.6)"; ctx.lineWidth = 1; ctx.stroke();
    
    ctx.fillStyle = "#e8eaf6"; ctx.font = "bold 11px monospace";
    ctx.fillText("D-NET", discX - 15, cy);
    ctx.font = "9px monospace"; ctx.fillStyle = "#90a0c8";
    ctx.fillText("Discriminator", discX - 15, cy + 45);

    // Real/Fake Output Decision
    const decisionWave = Math.sin(t * 0.003);
    const decision = decisionWave > 0.2 ? "FAKE" : (decisionWave < -0.2 ? "REAL" : "THINKING...");
    ctx.fillStyle = decision === "FAKE" ? "#ff50b4" : (decision === "REAL" ? "#00ffb4" : "#ffffff");
    ctx.font = "bold 12px monospace"; ctx.textBaseline = "middle";
    ctx.fillText(decision, discX + 115, cy);

    ctx.globalCompositeOperation = "source-over";
    // Loss values with high-tech bars
    const gLoss = 0.5 + Math.sin(t * 0.002) * 0.3;
    const dLoss = 0.5 - Math.sin(t * 0.002) * 0.2;
    
    ctx.fillStyle = "rgba(10,20,30,0.8)";
    ctx.fillRect(genX - 15, cy + 65, 120, 30);
    ctx.fillRect(discX - 75, cy + 65, 120, 30);
    
    ctx.fillStyle = "#a050ff"; ctx.font = "10px monospace"; ctx.textAlign = "left";
    ctx.fillText(`G-Loss: ${gLoss.toFixed(3)}`, genX - 5, cy + 75);
    ctx.fillRect(genX - 5, cy + 82, gLoss * 80, 4);

    ctx.fillStyle = "#00d4ff";
    ctx.fillText(`D-Loss: ${dLoss.toFixed(3)}`, discX - 65, cy + 75);
    ctx.fillRect(discX - 65, cy + 82, dLoss * 80, 4);

    animRef.current = requestAnimationFrame(draw);
  }, [width, height]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  return (
    <div style={{ background: "#020408", borderRadius: 8, boxShadow: "0 0 20px rgba(100,50,255,0.15)" }} role="img" aria-label="GAN training visualizer">
      <canvas ref={canvasRef} width={width} height={height} style={{ display: "block" }} />
    </div>
  );
}
