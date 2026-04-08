/**
 * @fileoverview Main WebGL/WebGPU canvas component.
 * Handles mouse events, touch, keyboard shortcuts, and resize.
 */
"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSimulatorStore } from "@/store/simulatorStore";
import { useParticleEngine } from "./useParticleEngine";
import { textToParticles } from "@/lib/textToParticles";

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseDownRef = useRef(false);
  const shiftRef = useRef(false);

  const store = useSimulatorStore();
  const engine = useParticleEngine({ canvasRef });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          engine.explode();
          break;
        case "Shift":
          shiftRef.current = true;
          break;
        case "r":
        case "R":
          engine.reinitPreset(
            store.activePreset ?? "galaxy",
            canvasRef.current?.offsetWidth ?? 800,
            canvasRef.current?.offsetHeight ?? 600
          );
          break;
        case "p":
        case "P":
          store.setRunning(!store.isRunning);
          break;
        case "s":
        case "S":
          store.toggleSidebar();
          break;
        case "e":
        case "E":
          store.toggleEquation();
          break;
        case "ArrowRight":
          store.setTimeScale(Math.min(store.timeScale + 0.5, 10));
          break;
        case "ArrowLeft":
          store.setTimeScale(Math.max(store.timeScale - 0.5, 0.1));
          break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [engine, store]);

  // Canvas resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
      }
    });
    ro.observe(canvas.parentElement ?? canvas);
    return () => ro.disconnect();
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mouseDownRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      store.setForceMode(shiftRef.current ? "repel" : "attract");
      engine.applyMouseForce(mx, my);
    },
    [engine, store]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      mouseDownRef.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      engine.applyMouseForce(e.clientX - rect.left, e.clientY - rect.top);
    },
    [engine]
  );

  const handleMouseUp = useCallback(() => {
    mouseDownRef.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const rect = e.currentTarget.getBoundingClientRect();
      engine.applyMouseForce(touch.clientX - rect.left, touch.clientY - rect.top);
    },
    [engine]
  );

  return (
    <div ref={containerRef} className="absolute inset-0" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (!touch) return;
          const rect = e.currentTarget.getBoundingClientRect();
          engine.applyMouseForce(touch.clientX - rect.left, touch.clientY - rect.top);
        }}
        aria-label="Particle simulation canvas"
      />
    </div>
  );
}
