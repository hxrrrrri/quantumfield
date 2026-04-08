/**
 * @fileoverview Main simulation hook — orchestrates particle system,
 * physics updates, WebGL/WebGPU rendering, and worker communication.
 */
"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSimulatorStore } from "@/store/simulatorStore";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useWebGPU } from "@/hooks/useWebGPU";
import { applyTextSpringForces } from "@/lib/textToParticles";
import { applyQuantumDrift } from "@/physics/quantum";
import { applyRelativity } from "@/physics/relativity";
import { applyFuturePhysics } from "@/physics/future";

interface EngineOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

// Colormap lookup tables
const COLORMAPS: Record<string, (t: number) => [number, number, number]> = {
  viridis: (t) => {
    const stops: Array<[number, number, number]> = [
      [68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37],
    ];
    return interpStops(stops, t);
  },
  inferno: (t) => {
    const stops: Array<[number, number, number]> = [
      [0, 0, 4], [120, 28, 109], [229, 93, 45], [252, 255, 164],
    ];
    return interpStops(stops, t);
  },
  plasma: (t) => {
    const stops: Array<[number, number, number]> = [
      [13, 8, 135], [156, 23, 158], [237, 121, 83], [240, 249, 33],
    ];
    return interpStops(stops, t);
  },
  cyan: (t) => {
    const stops: Array<[number, number, number]> = [
      [2, 13, 26], [0, 63, 92], [0, 212, 255], [200, 240, 255],
    ];
    return interpStops(stops, t);
  },
  fire: (t) => {
    const stops: Array<[number, number, number]> = [
      [16, 0, 0], [139, 0, 0], [255, 69, 0], [255, 200, 0],
    ];
    return interpStops(stops, t);
  },
  aurora: (t) => {
    const stops: Array<[number, number, number]> = [
      [0, 26, 0], [0, 80, 40], [0, 255, 136], [136, 255, 255],
    ];
    return interpStops(stops, t);
  },
};

function interpStops(
  stops: Array<[number, number, number]>,
  t: number
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const s = clamped * (stops.length - 1);
  const i = Math.min(Math.floor(s), stops.length - 2);
  const f = s - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

// Particle SoA buffers
interface ParticleArrays {
  px: Float32Array;
  py: Float32Array;
  pvx: Float32Array;
  pvy: Float32Array;
  pm: Float32Array;
  pc: Float32Array;
  palpha: Float32Array;
  pphase: Float32Array;
  pcharge: Float32Array;
  ptype: Uint8Array;
  count: number;
}

function allocateParticles(n: number): ParticleArrays {
  return {
    px: new Float32Array(n),
    py: new Float32Array(n),
    pvx: new Float32Array(n),
    pvy: new Float32Array(n),
    pm: new Float32Array(n).fill(1),
    pc: new Float32Array(n),
    palpha: new Float32Array(n).fill(1),
    pphase: new Float32Array(n),
    pcharge: new Float32Array(n),
    ptype: new Uint8Array(n),
    count: n,
  };
}

type PresetInitFn = (arrays: ParticleArrays, W: number, H: number) => void;

const PRESET_INITS: Record<string, PresetInitFn> = {
  galaxy(arrays, W, H) {
    for (let i = 0; i < arrays.count; i++) {
      const arm = Math.floor(Math.random() * 3);
      const r = 10 + Math.pow(Math.random(), 0.6) * Math.min(W, H) * 0.38;
      const theta = arm * ((Math.PI * 2) / 3) + r * 0.025 + Math.random() * 0.4;
      arrays.px[i] = W / 2 + Math.cos(theta) * r + (Math.random() - 0.5) * 18;
      arrays.py[i] = H / 2 + Math.sin(theta) * r * 0.55 + (Math.random() - 0.5) * 12;
      const speed = Math.sqrt(1 / Math.max(r, 1)) * 0.9 + Math.random() * 0.3;
      arrays.pvx[i] = -Math.sin(theta) * speed;
      arrays.pvy[i] = Math.cos(theta) * speed * 0.55;
      arrays.pm[i] = 0.5 + Math.random() * 1.5;
      arrays.pc[i] = Math.random();
      arrays.palpha[i] = 0.6 + Math.random() * 0.4;
    }
  },
  bigbang(arrays, W, H) {
    for (let i = 0; i < arrays.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 10;
      arrays.px[i] = W / 2 + (Math.random() - 0.5) * 10;
      arrays.py[i] = H / 2 + (Math.random() - 0.5) * 10;
      arrays.pvx[i] = Math.cos(angle) * speed;
      arrays.pvy[i] = Math.sin(angle) * speed;
      arrays.pm[i] = 0.2 + Math.random();
      arrays.pc[i] = Math.random();
      arrays.palpha[i] = 0.8 + Math.random() * 0.2;
    }
  },
  blackhole(arrays, W, H) {
    for (let i = 0; i < arrays.count; i++) {
      const r = 50 + Math.random() * Math.min(W, H) * 0.42;
      const angle = Math.random() * Math.PI * 2;
      arrays.px[i] = W / 2 + Math.cos(angle) * r;
      arrays.py[i] = H / 2 + Math.sin(angle) * r;
      const orbitSpeed = Math.sqrt(4000 / r) * 0.7;
      arrays.pvx[i] = -Math.sin(angle) * orbitSpeed;
      arrays.pvy[i] = Math.cos(angle) * orbitSpeed;
      arrays.pm[i] = 0.3 + Math.random();
      arrays.pc[i] = r / (Math.min(W, H) * 0.42);
      arrays.palpha[i] = 0.5 + Math.random() * 0.5;
    }
  },
  plasma(arrays, W, H) {
    for (let i = 0; i < arrays.count; i++) {
      arrays.px[i] = Math.random() * W;
      arrays.py[i] = Math.random() * H;
      arrays.pvx[i] = (Math.random() - 0.5) * 3;
      arrays.pvy[i] = (Math.random() - 0.5) * 3;
      arrays.pm[i] = 0.3 + Math.random() * 0.7;
      arrays.pcharge[i] = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 1.5);
      arrays.pphase[i] = Math.random() * Math.PI * 2;
      arrays.pc[i] = Math.random();
      arrays.palpha[i] = 0.8;
    }
  },
  doubleslit(arrays, W, H) {
    for (let i = 0; i < arrays.count; i++) {
      arrays.px[i] = 30 + Math.random() * 20;
      arrays.py[i] = H / 2 + (Math.random() - 0.5) * H * 0.8;
      arrays.pvx[i] = 1.5 + Math.random() * 0.5;
      arrays.pvy[i] = (Math.random() - 0.5) * 0.3;
      arrays.pm[i] = 0.3;
      arrays.pphase[i] = Math.random() * Math.PI * 2;
      arrays.pc[i] = Math.random();
      arrays.palpha[i] = 0.7 + Math.random() * 0.3;
      arrays.ptype[i] = 1;
    }
  },
  solar(arrays, W, H) {
    const planets = [
      { r: 60, n: 200 }, { r: 100, n: 300 }, { r: 150, n: 400 },
      { r: 200, n: 500 }, { r: 260, n: 600 }, { r: 310, n: 400 },
      { r: 350, n: 300 }, { r: 390, n: 200 },
    ];
    let idx = 0;
    // Sun core
    for (let j = 0; j < 500 && idx < arrays.count; j++, idx++) {
      const a = Math.random() * Math.PI * 2;
      const rad = Math.random() * 18;
      arrays.px[idx] = W / 2 + Math.cos(a) * rad;
      arrays.py[idx] = H / 2 + Math.sin(a) * rad;
      arrays.pvx[idx] = (Math.random() - 0.5) * 0.2;
      arrays.pvy[idx] = (Math.random() - 0.5) * 0.2;
      arrays.pm[idx] = 3;
      arrays.pc[idx] = 0.95;
      arrays.palpha[idx] = 1;
      arrays.ptype[idx] = 2;
    }
    for (const pl of planets) {
      const speed = Math.sqrt(1200 / pl.r) * 0.65;
      for (let j = 0; j < pl.n && idx < arrays.count; j++, idx++) {
        const angle = Math.random() * Math.PI * 2;
        const dr = (Math.random() - 0.5) * 12;
        arrays.px[idx] = W / 2 + Math.cos(angle) * (pl.r + dr);
        arrays.py[idx] = H / 2 + Math.sin(angle) * (pl.r + dr);
        arrays.pvx[idx] = -Math.sin(angle) * speed + (Math.random() - 0.5) * 0.3;
        arrays.pvy[idx] = Math.cos(angle) * speed + (Math.random() - 0.5) * 0.3;
        arrays.pm[idx] = 0.4 + Math.random();
        arrays.pc[idx] = pl.r / 400;
        arrays.palpha[idx] = 0.6 + Math.random() * 0.4;
      }
    }
  },
  dna(arrays, W, H) {
    for (let i = 0; i < arrays.count; i++) {
      const t = i / arrays.count;
      const z = t * H * 1.2 - H * 0.1;
      const angle = t * Math.PI * 12;
      const strand = i % 3;
      let rx = 0, ry = 0;
      if (strand < 2) {
        const s = strand === 0 ? 1 : -1;
        rx = Math.cos(angle + s * Math.PI / 2) * 40;
        ry = Math.sin(angle + s * Math.PI / 2) * 12;
        arrays.pc[i] = strand === 0 ? 0.2 : 0.7;
      } else {
        const ba = (Math.floor(i / 3) / Math.floor(arrays.count / 3)) * Math.PI * 12;
        rx = Math.cos(ba + Math.PI / 2) * 40 * (Math.random() * 0.6 + 0.2);
        ry = Math.sin(ba + Math.PI / 2) * 12;
        arrays.pc[i] = 0.45;
      }
      arrays.px[i] = W / 2 + rx + (Math.random() - 0.5) * 4;
      arrays.py[i] = z + ry + (Math.random() - 0.5) * 4;
      arrays.pvx[i] = (Math.random() - 0.5) * 0.1;
      arrays.pvy[i] = (Math.random() - 0.5) * 0.1;
      arrays.pm[i] = 0.6 + Math.random() * 0.4;
      arrays.palpha[i] = 0.7 + Math.random() * 0.3;
    }
  },
};

export function useParticleEngine({ canvasRef }: EngineOptions) {
  const store = useSimulatorStore();
  const arraysRef = useRef<ParticleArrays | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const offCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const textTargetsRef = useRef<Float32Array | null>(null);
  const fpsCounterRef = useRef({ frames: 0, last: 0 });
  const simTimeRef = useRef(0);

  const { device: gpuDevice } = useWebGPU();

  // Initialize / re-initialize particle system
  const initPreset = useCallback(
    (presetName: string, W: number, H: number) => {
      const n = store.particleCount;
      const arrays = allocateParticles(n);
      const initFn = PRESET_INITS[presetName] ?? PRESET_INITS["galaxy"]!;
      initFn(arrays, W, H);
      arraysRef.current = arrays;
      textTargetsRef.current = null;
    },
    [store.particleCount]
  );

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      offCtxRef.current = ctx;
      offscreenRef.current = offscreen;
    }
    initPreset(store.activePreset ?? "galaxy", canvas.offsetWidth, canvas.offsetHeight);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Physics step
  const physicsStep = useCallback(
    (arrays: ParticleArrays, dt: number, W: number, H: number) => {
      const ts = store.timeScale;
      const DT = dt * ts;
      const mode = store.physicsMode;
      const { px, py, pvx, pvy, pm, pc, palpha, pphase, pcharge } = arrays;
      const n = arrays.count;

      if (mode === "quantum") {
        applyQuantumDrift(
          px, py, pvx, pvy, pphase, n, DT,
          { G: store.gravityG, k: 8.99e9, hbar: 1.055, c: 299, epsilon0: 8.85e-12, mu0: 4 * Math.PI * 1e-7, kB: 1.38e-23, dt: DT, substeps: 1 },
          W, H
        );
      } else if (mode === "relativity") {
        applyRelativity(
          px, py, pvx, pvy, pm, pc, palpha, n, DT,
          { G: store.gravityG, k: 8.99e9, hbar: 1.055, c: 15, epsilon0: 8.85e-12, mu0: 4 * Math.PI * 1e-7, kB: 1.38e-23, dt: DT, substeps: 1 },
          W, H, 500000
        );
      } else if (mode === "future") {
        applyFuturePhysics(
          px, py, pvx, pvy, pm, pc, pphase, n, DT, "dark", simTimeRef.current, W, H
        );
      } else if (mode === "em") {
        // EM: Lorentz force
        const cx = W / 2, cy = H / 2;
        const Bz = 0.05;
        for (let i = 0; i < n; i++) {
          const q = pcharge[i] ?? 0;
          const vx = pvx[i] ?? 0, vy = pvy[i] ?? 0;
          const Ex = (cx - (px[i] ?? 0)) * 0.002;
          const Ey = (cy - (py[i] ?? 0)) * 0.002;
          pvx[i] = (vx + q * (Ex + vy * Bz) / (pm[i] ?? 1) * DT) * 0.999;
          pvy[i] = (vy + q * (Ey - vx * Bz) / (pm[i] ?? 1) * DT) * 0.999;
          px[i] = (px[i] ?? 0) + pvx[i] * DT;
          py[i] = (py[i] ?? 0) + pvy[i] * DT;
          if ((px[i] ?? 0) < 0 || (px[i] ?? 0) > W) pvx[i] = -(pvx[i] ?? 0);
          if ((py[i] ?? 0) < 0 || (py[i] ?? 0) > H) pvy[i] = -(pvy[i] ?? 0);
          px[i] = Math.max(0, Math.min(W, px[i] ?? 0));
          py[i] = Math.max(0, Math.min(H, py[i] ?? 0));
          const spd = Math.sqrt((pvx[i] ?? 0) ** 2 + (pvy[i] ?? 0) ** 2);
          pc[i] = (q > 0 ? 0.1 : 0.6) + spd * 0.06;
        }
      } else if (textTargetsRef.current) {
        applyTextSpringForces(px, py, pvx, pvy, textTargetsRef.current, n, DT);
      } else {
        // Classical gravity (grid approx)
        const G = store.gravityG;
        const cellSize = 70;
        const gcx = Math.ceil(W / cellSize) + 1;
        const gcy = Math.ceil(H / cellSize) + 1;
        const gridMass = new Float32Array(gcx * gcy);
        const gridX = new Float32Array(gcx * gcy);
        const gridY = new Float32Array(gcx * gcy);
        for (let i = 0; i < n; i++) {
          const gx = Math.max(0, Math.min(gcx - 1, Math.floor((px[i] ?? 0) / cellSize)));
          const gy = Math.max(0, Math.min(gcy - 1, Math.floor((py[i] ?? 0) / cellSize)));
          const gi = gy * gcx + gx;
          gridMass[gi] = (gridMass[gi] ?? 0) + (pm[i] ?? 1);
          gridX[gi] = (gridX[gi] ?? 0) + (px[i] ?? 0) * (pm[i] ?? 1);
          gridY[gi] = (gridY[gi] ?? 0) + (py[i] ?? 0) * (pm[i] ?? 1);
        }
        const cx = W / 2, cy = H / 2;
        for (let i = 0; i < n; i++) {
          let ax = 0, ay = 0;
          const gxi = Math.floor((px[i] ?? 0) / cellSize);
          const gyi = Math.floor((py[i] ?? 0) / cellSize);
          for (let dgx = -2; dgx <= 2; dgx++) {
            for (let dgy = -2; dgy <= 2; dgy++) {
              const nx2 = gxi + dgx, ny2 = gyi + dgy;
              if (nx2 < 0 || nx2 >= gcx || ny2 < 0 || ny2 >= gcy) continue;
              const gi = ny2 * gcx + nx2;
              const mass = gridMass[gi] ?? 0;
              if (mass < 0.001) continue;
              const cmx = (gridX[gi] ?? 0) / mass;
              const cmy = (gridY[gi] ?? 0) / mass;
              const dx = cmx - (px[i] ?? 0);
              const dy = cmy - (py[i] ?? 0);
              const r2 = dx * dx + dy * dy + 200;
              const r = Math.sqrt(r2);
              const f = G * mass / r2;
              ax += f * dx / r;
              ay += f * dy / r;
            }
          }
          const ddx = cx - (px[i] ?? 0);
          const ddy = cy - (py[i] ?? 0);
          const r2c = ddx * ddx + ddy * ddy + 400;
          const rc = Math.sqrt(r2c);
          ax += G * 0.4 * ddx / r2c;
          ay += G * 0.4 * ddy / r2c;
          pvx[i] = ((pvx[i] ?? 0) + ax * DT) * 0.9998;
          pvy[i] = ((pvy[i] ?? 0) + ay * DT) * 0.9998;
          px[i] = (px[i] ?? 0) + (pvx[i] ?? 0) * DT;
          py[i] = (py[i] ?? 0) + (pvy[i] ?? 0) * DT;
          if ((px[i] ?? 0) < 0) px[i] = W;
          else if ((px[i] ?? 0) > W) px[i] = 0;
          if ((py[i] ?? 0) < 0) py[i] = H;
          else if ((py[i] ?? 0) > H) py[i] = 0;
          const spd = Math.sqrt((pvx[i] ?? 0) ** 2 + (pvy[i] ?? 0) ** 2);
          pc[i] = Math.min(1, spd * 0.15);
        }
      }
    },
    [store.gravityG, store.physicsMode, store.timeScale]
  );

  // Main render + physics loop
  const onFrame = useCallback(
    (dt: number) => {
      const canvas = canvasRef.current;
      const offCtx = offCtxRef.current;
      const offscreen = offscreenRef.current;
      const arrays = arraysRef.current;
      if (!canvas || !offCtx || !offscreen || !arrays) return;

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;

      simTimeRef.current += dt * (1 / 60);

      // Physics
      physicsStep(arrays, dt, W, H);

      // Mouse force
      if (store.forceMode !== "none") {
        // handled via global mouse state
      }

      // Render
      offCtx.fillStyle = `rgba(3,4,10,${1 - store.trailDecay})`;
      offCtx.fillRect(0, 0, W, H);

      const { pc, palpha, px, py, pm } = arrays;
      const sz = store.particleSize;
      const cm = COLORMAPS[store.colormap] ?? COLORMAPS["viridis"]!;
      const bloom = store.bloomIntensity;

      for (let i = 0; i < arrays.count; i++) {
        const x = px[i] ?? 0, y = py[i] ?? 0;
        if (x < -5 || x > W + 5 || y < -5 || y > H + 5) continue;
        const t = Math.min(1, Math.max(0, pc[i] ?? 0));
        const [r, g, b] = cm(t);
        const a = Math.min(1, Math.max(0, palpha[i] ?? 0.8));
        const s = sz * (0.6 + (pm[i] ?? 1) * 0.4);

        if (bloom > 0.3 && a > 0.5) {
          const grd = offCtx.createRadialGradient(x, y, 0, x, y, s * 3 + 2);
          grd.addColorStop(0, `rgba(${r},${g},${b},${a * bloom * 0.3})`);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          offCtx.fillStyle = grd;
          offCtx.beginPath();
          offCtx.arc(x, y, s * 3 + 2, 0, Math.PI * 2);
          offCtx.fill();
        }

        offCtx.fillStyle = `rgba(${r},${g},${b},${a})`;
        offCtx.beginPath();
        offCtx.arc(x, y, Math.max(0.4, s), 0, Math.PI * 2);
        offCtx.fill();
      }

      // Copy to main canvas
      const mainCtx = canvas.getContext("2d");
      if (mainCtx) {
        mainCtx.clearRect(0, 0, W * dpr, H * dpr);
        mainCtx.drawImage(offscreen, 0, 0, W * dpr, H * dpr);
      }

      // FPS
      const fpsCtr = fpsCounterRef.current;
      fpsCtr.frames++;
      const now = performance.now();
      if (now - fpsCtr.last >= 1000) {
        store.setFps(fpsCtr.frames);
        fpsCtr.frames = 0;
        fpsCtr.last = now;

        // Kinetic energy sample
        let ke = 0;
        const sample = Math.min(arrays.count, 300);
        for (let i = 0; i < sample; i++) {
          ke += 0.5 * (arrays.pm[i] ?? 1) * ((arrays.pvx[i] ?? 0) ** 2 + (arrays.pvy[i] ?? 0) ** 2);
        }
        store.setKineticEnergy(Math.round(ke * (arrays.count / sample)));
        store.incrementSimTime(1);
      }
    },
    [physicsStep, store]
  );

  useAnimationFrame({ onFrame, enabled: store.isRunning });

  return {
    setTextTargets: (targets: Float32Array) => {
      textTargetsRef.current = targets;
    },
    reinitPreset: (name: string, W: number, H: number) => {
      initPreset(name, W, H);
    },
    explode: () => {
      const arrays = arraysRef.current;
      if (!arrays) return;
      for (let i = 0; i < arrays.count; i++) {
        arrays.pvx[i] = ((arrays.pvx[i] ?? 0) + (Math.random() - 0.5) * 20);
        arrays.pvy[i] = ((arrays.pvy[i] ?? 0) + (Math.random() - 0.5) * 20);
      }
    },
    applyMouseForce: (mx: number, my: number) => {
      const arrays = arraysRef.current;
      if (!arrays || store.forceMode === "none") return;
      const r2Max = store.forceRadius ** 2;
      for (let i = 0; i < arrays.count; i++) {
        const dx = (arrays.px[i] ?? 0) - mx;
        const dy = (arrays.py[i] ?? 0) - my;
        const r2 = dx * dx + dy * dy;
        if (r2 < r2Max && r2 > 1) {
          const r = Math.sqrt(r2);
          const f = (store.forceStrength * (1 - r / store.forceRadius)) / r;
          const sign = store.forceMode === "repel" ? 1 : -1;
          arrays.pvx[i] = (arrays.pvx[i] ?? 0) + sign * dx * f;
          arrays.pvy[i] = (arrays.pvy[i] ?? 0) + sign * dy * f;
        }
      }
    },
  };
}
