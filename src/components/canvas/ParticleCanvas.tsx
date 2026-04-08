"use client";
import { useRef, useEffect, useCallback } from "react";
import { useSimulatorStore } from "@/store/simulatorStore";
import { useParticleEngine } from "./useParticleEngine";

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useSimulatorStore();
  const { mouseRef, reinit, explode } = useParticleEngine({ canvasRef });

  // Global event bindings
  useEffect(() => {
    const onExplodeEvt = () => explode();
    const onPause = () => store.setRunning(!store.isRunning);
    window.addEventListener("qf:explode", onExplodeEvt);
    window.addEventListener("qf:pause",   onPause);
    return () => {
      window.removeEventListener("qf:explode", onExplodeEvt);
      window.removeEventListener("qf:pause",   onPause);
    };
  }, [explode, store]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Shift") mouseRef.current.shift = true;
      if (e.key === " ") { e.preventDefault(); explode(); }
      if (e.key === "r" || e.key === "R") reinit(store.activePreset ?? "galaxy");
      if (e.key === "p" || e.key === "P") store.setRunning(!store.isRunning);
      if (e.key === "s" || e.key === "S") store.toggleSidebar();
      if (e.key === "e" || e.key === "E") store.toggleEquation();
      if (e.key === "ArrowRight") store.setTimeScale(Math.min(store.timeScale + 0.5, 10));
      if (e.key === "ArrowLeft")  store.setTimeScale(Math.max(store.timeScale - 0.5, 0.1));
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") mouseRef.current.shift = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [explode, reinit, store, mouseRef]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    mouseRef.current.x = e.clientX - r.left;
    mouseRef.current.y = e.clientY - r.top;
  }, [mouseRef]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    mouseRef.current.x = touch.clientX - r.left;
    mouseRef.current.y = touch.clientY - r.top;
  }, [mouseRef]);

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", cursor: "crosshair", display: "block" }}
        onMouseMove={onMouseMove}
        onMouseDown={() => { mouseRef.current.down = true; }}
        onMouseUp={() => { mouseRef.current.down = false; }}
        onMouseLeave={() => { mouseRef.current.down = false; }}
        onTouchMove={onTouchMove}
        onTouchStart={(e) => {
          mouseRef.current.down = true;
          const touch = e.touches[0];
          if (!touch) return;
          const r = canvasRef.current?.getBoundingClientRect();
          if (!r) return;
          mouseRef.current.x = touch.clientX - r.left;
          mouseRef.current.y = touch.clientY - r.top;
        }}
        onTouchEnd={() => { mouseRef.current.down = false; }}
        aria-label="Particle simulation canvas"
      />
    </div>
  );
}
