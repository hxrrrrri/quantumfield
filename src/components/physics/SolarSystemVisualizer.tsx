"use client";

import { useCallback, useEffect, useRef } from "react";

interface SolarSystemVisualizerProps {
  width?: number;
  height?: number;
}

interface PlanetDef {
  name: string;
  orbit: number;
  radius: number;
  speed: number;
  color: string;
  phase: number;
  moons?: Array<{ orbit: number; radius: number; speed: number; color: string }>;
}

const PLANETS: PlanetDef[] = [
  { name: "Mercury", orbit: 52, radius: 2.4, speed: 4.15, color: "#d7d2c2", phase: 0.4 },
  { name: "Venus", orbit: 74, radius: 3.4, speed: 1.62, color: "#d7b78b", phase: 1.2 },
  { name: "Earth", orbit: 102, radius: 3.7, speed: 1.0, color: "#6cb7ff", phase: 2.4, moons: [{ orbit: 8, radius: 1.1, speed: 9.2, color: "#dce6ef" }] },
  { name: "Mars", orbit: 130, radius: 2.8, speed: 0.53, color: "#db7e6c", phase: 3.1 },
  { name: "Jupiter", orbit: 170, radius: 7.6, speed: 0.084, color: "#ddbe84", phase: 0.8, moons: [{ orbit: 12, radius: 1.4, speed: 3.2, color: "#cfd7e2" }, { orbit: 16, radius: 1.2, speed: 2.4, color: "#d8dde8" }] },
  { name: "Saturn", orbit: 206, radius: 6.9, speed: 0.034, color: "#e4d6ad", phase: 4.7 },
  { name: "Uranus", orbit: 236, radius: 5.2, speed: 0.012, color: "#8ad7ef", phase: 5.2 },
  { name: "Neptune", orbit: 262, radius: 5.0, speed: 0.006, color: "#7897ff", phase: 2.2 },
];

export default function SolarSystemVisualizer({ width = 920, height = 360 }: SolarSystemVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const t = timestamp * 0.001;
    const cx = width * 0.38;
    const cy = height * 0.53;
    const yScale = 0.72;

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, width, height);

    // Orbit rings
    ctx.save();
    ctx.translate(cx, cy);
    for (const p of PLANETS) {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.orbit, p.orbit * yScale, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(126,158,214,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Sun
    const sunGlow = 18 + Math.sin(t * 1.8) * 2;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sunGlow);
    g.addColorStop(0, "rgba(255,230,138,0.96)");
    g.addColorStop(0.7, "rgba(255,182,82,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, sunGlow, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,215,120,0.96)";
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
    ctx.fill();

    // Planets and moons
    for (const p of PLANETS) {
      const a = t * p.speed + p.phase;
      const px = Math.cos(a) * p.orbit;
      const py = Math.sin(a) * p.orbit * yScale;

      if (p.name === "Saturn") {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a * 0.3);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius + 4.5, (p.radius + 4.5) * 0.42, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(226,205,156,0.7)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(px, py, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      if (p.moons) {
        for (let i = 0; i < p.moons.length; i++) {
          const m = p.moons[i]!;
          const ma = t * m.speed + p.phase + i;
          const mx = px + Math.cos(ma) * m.orbit;
          const my = py + Math.sin(ma) * m.orbit * 0.9;
          ctx.beginPath();
          ctx.arc(mx, my, m.radius, 0, Math.PI * 2);
          ctx.fillStyle = m.color;
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // Side legend with live orbital phase
    const legendX = width * 0.69;
    const rowH = 18;
    ctx.fillStyle = "rgba(9,14,24,0.88)";
    ctx.fillRect(legendX - 16, 32, width - legendX - 16, rowH * (PLANETS.length + 3));
    ctx.strokeStyle = "rgba(126,168,255,0.24)";
    ctx.strokeRect(legendX - 16, 32, width - legendX - 16, rowH * (PLANETS.length + 3));

    ctx.fillStyle = "rgba(164,222,255,0.95)";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("SOLAR ORBIT MODEL", legendX - 6, 50);

    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(136,178,222,0.95)";
    ctx.fillText("Relative angular velocity and elliptical projection", legendX - 6, 66);

    for (let i = 0; i < PLANETS.length; i++) {
      const p = PLANETS[i]!;
      const y = 84 + i * rowH;
      const phaseDeg = ((t * p.speed + p.phase) % (Math.PI * 2)) * (180 / Math.PI);
      ctx.fillStyle = p.color;
      ctx.fillRect(legendX - 6, y - 5, 8, 8);
      ctx.fillStyle = "rgba(202,224,244,0.95)";
      ctx.fillText(`${p.name.padEnd(8, " ")}  ω=${p.speed.toFixed(3)}  θ=${phaseDeg.toFixed(1)}°`, legendX + 8, y);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [height, width]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  return (
    <div style={{ background: "#000", borderRadius: 8 }} role="img" aria-label="Real-time solar system orbital simulation">
      <canvas ref={canvasRef} width={width} height={height} style={{ display: "block", width: "100%", height: "auto" }} />
    </div>
  );
}
