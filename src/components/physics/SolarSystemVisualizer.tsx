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
  rings?: { inner: number; outer: number; color: string };
  atmosphereGlow?: string;
}

const PLANETS: PlanetDef[] = [
  { name: "Mercury", orbit: 52, radius: 2.4, speed: 4.15, color: "#d7d2c2", phase: 0.4, atmosphereGlow: "rgba(215,210,194,0.3)" },
  { name: "Venus", orbit: 74, radius: 3.4, speed: 1.62, color: "#d7b78b", phase: 1.2, atmosphereGlow: "rgba(215,183,139,0.5)" },
  { name: "Earth", orbit: 102, radius: 3.7, speed: 1.0, color: "#6cb7ff", phase: 2.4, atmosphereGlow: "rgba(108,183,255,0.6)", moons: [{ orbit: 8, radius: 1.1, speed: 9.2, color: "#dce6ef" }] },
  { name: "Mars", orbit: 130, radius: 2.8, speed: 0.53, color: "#db7e6c", phase: 3.1, atmosphereGlow: "rgba(219,126,108,0.4)" },
  { name: "Jupiter", orbit: 170, radius: 7.6, speed: 0.084, color: "#ddbe84", phase: 0.8, atmosphereGlow: "rgba(221,190,132,0.4)", moons: [{ orbit: 12, radius: 1.4, speed: 3.2, color: "#cfd7e2" }, { orbit: 16, radius: 1.2, speed: 2.4, color: "#d8dde8" }] },
  { name: "Saturn", orbit: 216, radius: 6.9, speed: 0.034, color: "#e4d6ad", phase: 4.7, atmosphereGlow: "rgba(228,214,173,0.4)", rings: { inner: 10, outer: 18, color: "rgba(226,205,156,0.35)" } },
  { name: "Uranus", orbit: 256, radius: 5.2, speed: 0.012, color: "#8ad7ef", phase: 5.2, atmosphereGlow: "rgba(138,215,239,0.5)", rings: { inner: 7, outer: 9, color: "rgba(138,215,239,0.2)" } },
  { name: "Neptune", orbit: 292, radius: 5.0, speed: 0.006, color: "#7897ff", phase: 2.2, atmosphereGlow: "rgba(120,151,255,0.6)" },
];

export default function SolarSystemVisualizer({ width = 920, height = 360 }: SolarSystemVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // Pre-generate starfield for background.
  const starfieldRef = useRef<HTMLCanvasElement | null>(null);
  
  useEffect(() => {
    const starCanvas = document.createElement("canvas");
    starCanvas.width = width;
    starCanvas.height = height;
    const sCtx = starCanvas.getContext("2d");
    if (sCtx) {
      sCtx.fillStyle = "#000005";
      sCtx.fillRect(0, 0, width, height);
      for (let i = 0; i < 600; i++) {
        sCtx.beginPath();
        const sx = Math.random() * width;
        const sy = Math.random() * height;
        const sr = Math.random() * 1.5;
        sCtx.arc(sx, sy, sr, 0, Math.PI * 2);
        sCtx.fillStyle = `rgba(255,255,255,${Math.random() * 0.7 + 0.1})`;
        sCtx.fill();
      }
    }
    starfieldRef.current = starCanvas;
  }, [width, height]);

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const t = timestamp * 0.001;
    const cx = width * 0.38;
    const cy = height * 0.53;
    const yScale = 0.55; // More extremely tilted perspective

    if (starfieldRef.current) {
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(starfieldRef.current, 0, 0);
    } else {
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.fillRect(0, 0, width, height);
    }
    
    // Slight trails
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "screen";

    // Draw orbital trails dynamically
    for (const p of PLANETS) {
        ctx.beginPath();
        for(let a=0; a <= Math.PI * 2; a+=0.05) {
            const rx = cx + Math.cos(a) * p.orbit;
            const ry = cy + Math.sin(a) * p.orbit * yScale;
            if(a===0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
        }
        ctx.strokeStyle = `rgba(${parseInt(p.color.slice(1,3),16)},${parseInt(p.color.slice(3,5),16)},${parseInt(p.color.slice(5,7),16)},0.07)`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Sun with massive bloom
    const sunPulse = Math.sin(t * 1.5) * 4;
    const sunGlowR = 40 + sunPulse;
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunGlowR);
    g.addColorStop(0, "rgba(255, 255, 255, 1)");
    g.addColorStop(0.1, "rgba(255, 230, 150, 0.95)");
    g.addColorStop(0.3, "rgba(255, 150, 50, 0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, sunGlowR, 0, Math.PI * 2);
    ctx.fill();
    
    // Core of Sun
    ctx.fillStyle = "rgba(255,230,200,1)";
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    // Draw planets with realistic shading
    for (const p of PLANETS) {
      const a = t * p.speed + p.phase;
      const px = cx + Math.cos(a) * p.orbit;
      const py = cy + Math.sin(a) * p.orbit * yScale;

      // Depth sorting logic could be added based on y scale, but 2d layered is ok for now.
      
      // Atmosphere glow
      if(p.atmosphereGlow) {
          ctx.beginPath();
          ctx.arc(px, py, p.radius * 1.6, 0, Math.PI * 2);
          ctx.fillStyle = p.atmosphereGlow;
          ctx.fill();
      }

      // Rings (drawing back half first, but for simplicity we draw full since we tilt)
      if (p.rings) {
        ctx.save();
        ctx.translate(px, py);
        // Tilt ring slightly compared to orbit
        ctx.rotate(a * 0.1 + Math.PI/8);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rings.outer, p.rings.outer * yScale * 0.5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = p.rings.color;
        ctx.lineWidth = p.rings.outer - p.rings.inner;
        ctx.stroke();
        ctx.restore();
      }

      // Planet body with spherical shading
      let ps = ctx.createRadialGradient(px - p.radius*0.3, py - p.radius*0.3, 0, px, py, p.radius);
      ps.addColorStop(0, "rgba(255,255,255,0.7)"); // Specular
      ps.addColorStop(0.2, p.color);
      ps.addColorStop(1, "rgba(0,0,0,0.8)"); // Shadow
      
      ctx.beginPath();
      ctx.arc(px, py, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = ps;
      ctx.fill();

      // Moons
      if (p.moons) {
        for (let i = 0; i < p.moons.length; i++) {
          const m = p.moons[i]!;
          const ma = t * m.speed * 4 + p.phase + i * Math.PI; // faster moon speeds
          const mx = px + Math.cos(ma) * m.orbit;
          const my = py + Math.sin(ma) * m.orbit *  yScale;
          
          ctx.beginPath();
          ctx.arc(mx, my, m.radius * 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(mx, my, m.radius, 0, Math.PI * 2);
          ctx.fillStyle = m.color;
          ctx.fill();
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";

    // Tech UI overlay
    const legendX = width * 0.69;
    const rowH = 18;
    ctx.fillStyle = "rgba(4, 9, 16, 0.85)";
    ctx.fillRect(legendX - 16, 32, width - legendX - 16, rowH * (PLANETS.length + 3));
    ctx.strokeStyle = "rgba(100, 150, 255, 0.3)";
    ctx.strokeRect(legendX - 16, 32, width - legendX - 16, rowH * (PLANETS.length + 3));

    ctx.fillStyle = "rgba(200, 240, 255, 0.95)";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("HELIOCENTRIC KINEMATICS", legendX - 6, 50);

    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(136, 178, 222, 0.8)";
    ctx.fillText("Real-time orbital tracking (Scale 1:1E9)", legendX - 6, 66);

    for (let i = 0; i < PLANETS.length; i++) {
      const p = PLANETS[i]!;
      const y = 84 + i * rowH;
      const phaseDeg = ((t * p.speed + p.phase) % (Math.PI * 2)) * (180 / Math.PI);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(legendX - 2, y - 1, 4, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "rgba(220, 240, 255, 0.9)";
      ctx.fillText(`${p.name.padEnd(8, " ")} ω=${p.speed.toFixed(3)} θ=${phaseDeg.toFixed(1).padStart(5, '0')}°`, legendX + 8, y);
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
    <div style={{ background: "#000", borderRadius: 8, boxShadow: "0 0 20px rgba(0,20,40,0.5)" }} role="img" aria-label="Real-time solar system orbital simulation">
      <canvas ref={canvasRef} width={width} height={height} style={{ display: "block", width: "100%", height: "auto" }} />
    </div>
  );
}
