"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSimulatorStore } from "@/store/simulatorStore";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useWebGPU } from "@/hooks/useWebGPU";
import { applyQuantumDrift } from "@/physics/quantum";
import { applyRelativity } from "@/physics/relativity";
import { applyFuturePhysics } from "@/physics/future";

interface EngineOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

interface ShapeCameraState {
  yaw: number;
  pitch: number;
  distance: number;
  minDistance: number;
  maxDistance: number;
  rotateSensitivity: number;
  zoomStep: number;
  dragging: boolean;
  lastX: number;
  lastY: number;
}

interface RenderTuningState {
  brightness: number;
  glow: number;
}

interface CursorFieldState {
  enabled: boolean;
  strength: number;
  radius: number;
}

interface AmbientField {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  alpha: Float32Array;
  size: Float32Array;
  hue: Float32Array;
  count: number;
}

interface RenderLayers {
  particleBuf: HTMLCanvasElement;
  particleCtx: CanvasRenderingContext2D;
  blurBuf: HTMLCanvasElement;
  blurCtx: CanvasRenderingContext2D;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function hash01(i: number, seed: number): number {
  const v = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/* ─── Colormaps ─────────────────────────────────────────────────────────── */
const CMAPS: Record<string, (t: number) => [number, number, number]> = {
  viridis:(t)=>interp([[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],t),
  inferno:(t)=>interp([[0,0,4],[120,28,109],[229,93,45],[252,255,164]],t),
  plasma: (t)=>interp([[13,8,135],[156,23,158],[237,121,83],[240,249,33]],t),
  turbo:  (t)=>interp([[48,18,59],[40,114,251],[43,210,110],[247,224,24],[210,48,5]],t),
  cyan:   (t)=>interp([[2,13,26],[0,63,92],[0,180,220],[143,245,255]],t),
  fire:   (t)=>interp([[16,0,0],[139,0,0],[255,69,0],[255,200,0]],t),
  magma:  (t)=>interp([[26,0,48],[85,0,170],[172,137,255],[232,208,255]],t),
  aurora: (t)=>interp([[9,18,46],[30,84,123],[42,163,125],[137,228,87],[198,255,170]],t),
  rainbow:(t)=>interp([[255,0,80],[255,100,0],[200,220,0],[0,220,80],[0,180,255],[150,0,255]],t),
  neon:   (t)=>interp([[0,255,200],[0,150,255],[200,0,255],[255,0,150],[255,200,0]],t),
};
function interp(s:[number,number,number][],t:number):[number,number,number]{
  const tt=Math.max(0,Math.min(1,t));
  const x=tt*(s.length-1);
  const i=Math.min(Math.floor(x),s.length-2);
  const f=x-i;
  const a=s[i]!,b=s[i+1]!;
  return[Math.round(a[0]+(b[0]-a[0])*f),Math.round(a[1]+(b[1]-a[1])*f),Math.round(a[2]+(b[2]-a[2])*f)];
}

function lerpRgb(a:[number,number,number], b:[number,number,number], t:number):[number,number,number]{
  const tt = clamp(t, 0, 1);
  return [
    Math.round(a[0] + (b[0] - a[0]) * tt),
    Math.round(a[1] + (b[1] - a[1]) * tt),
    Math.round(a[2] + (b[2] - a[2]) * tt),
  ];
}

function limitLuma(r:number, g:number, b:number, maxLuma = 226):[number,number,number]{
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (luma <= maxLuma) {
    return [r, g, b];
  }
  const scale = maxLuma / Math.max(1, luma);
  const rr = clamp(Math.round(r * scale), 0, 255);
  const gg = clamp(Math.round(g * scale), 0, 255);
  const bb = clamp(Math.round(b * scale), 0, 255);
  return [rr, gg, bb];
}

function get2DContext(canvas: HTMLCanvasElement, alpha = true): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { alpha, desynchronized: true }) ?? canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is not available");
  }
  return ctx;
}

function createScaledLayer(width: number, height: number, dpr: number, alpha = true): { buf: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const buf = document.createElement("canvas");
  buf.width = Math.max(1, Math.floor(width * dpr));
  buf.height = Math.max(1, Math.floor(height * dpr));
  const ctx = get2DContext(buf, alpha);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { buf, ctx };
}

/* ─── Particle arrays (SoA) ─────────────────────────────────────────────── */
interface Particles {
  px:Float32Array; py:Float32Array;
  pvx:Float32Array; pvy:Float32Array;
  pm:Float32Array; pc:Float32Array;
  palpha:Float32Array; pphase:Float32Array;
  pcharge:Float32Array;
  psize:Float32Array;
  // target positions for instant snap + spring blend
  tx:Float32Array; ty:Float32Array;
  tc:Float32Array; // target color
  // shape-space (3D) positions and targets
  sx:Float32Array; sy:Float32Array; sz:Float32Array;
  stx:Float32Array; sty:Float32Array; stz:Float32Array;
  svx:Float32Array; svy:Float32Array; svz:Float32Array;
  count:number;
}
function alloc(n:number):Particles{
  const psize = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    psize[i] = 0.55 + Math.random() * 1.2;
  }
  return{
    px:new Float32Array(n),py:new Float32Array(n),
    pvx:new Float32Array(n),pvy:new Float32Array(n),
    pm:new Float32Array(n).fill(1),pc:new Float32Array(n),
    palpha:new Float32Array(n).fill(1),pphase:new Float32Array(n),
    pcharge:new Float32Array(n),
    psize,
    tx:new Float32Array(n),ty:new Float32Array(n),tc:new Float32Array(n),
    sx:new Float32Array(n),sy:new Float32Array(n),sz:new Float32Array(n),
    stx:new Float32Array(n),sty:new Float32Array(n),stz:new Float32Array(n),
    svx:new Float32Array(n),svy:new Float32Array(n),svz:new Float32Array(n),
    count:n,
  };
}

function computeGalaxyTargets2D(
  n:number,
  W:number,
  H:number,
  tx:Float32Array,
  ty:Float32Array,
  tc:Float32Array
):void{
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.min(W, H) * 0.36;
  for (let i = 0; i < n; i++) {
    const arm = i % 4;
    const rnd = hash01(i, 3.1);
    const r = 12 + Math.pow(rnd, 0.58) * maxR;
    const swirl = arm * (Math.PI * 2 / 4) + r * 0.028;
    const jitterR = (hash01(i, 8.9) - 0.5) * 20;
    const jitterY = (hash01(i, 15.2) - 0.5) * 14;
    tx[i] = cx + Math.cos(swirl) * (r + jitterR);
    ty[i] = cy + Math.sin(swirl) * (r + jitterR) * 0.58 + jitterY;
    tc[i] = clamp(r / maxR, 0, 1);
  }
}

/* ─── 3D Shape target generators ───────────────────────────────────────── */
function computeShapeTargets3D(
  shape:string,
  n:number,
  tx:Float32Array,
  ty:Float32Array,
  tz:Float32Array,
  tc:Float32Array
):void{
  switch(shape){
    case "sphere": {
      for(let i=0;i<n;i++){
        const phi = Math.acos(1 - 2 * ((i + 0.5) / n));
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(phi);
        tx[i] = x;
        ty[i] = y;
        tz[i] = z;
        tc[i] = clamp((z + 1) * 0.5, 0, 1);
      }
      break;
    }
    case "cylinder": {
      const radius = 0.58;
      const halfHeight = 1.08;
      const golden = Math.PI * (3 - Math.sqrt(5));
      const sideCount = Math.max(1, Math.floor(n * 0.42));
      const capCount = Math.max(2, Math.floor(n * 0.24));
      let idx = 0;

      // Side wall for a crisp cylindrical silhouette.
      for (; idx < sideCount && idx < n; idx++) {
        const t = (idx + 0.5) / sideCount;
        const theta = idx * golden;
        const y = (t * 2 - 1) * halfHeight;
        tx[idx] = Math.cos(theta) * radius;
        ty[idx] = y;
        tz[idx] = Math.sin(theta) * radius;
        tc[idx] = clamp((y + halfHeight) / (2 * halfHeight), 0, 1);
      }

      // Top and bottom caps so the cylinder is not hollow.
      for (let j = 0; j < capCount && idx < n; j++, idx++) {
        const rr = Math.sqrt(hash01(j, 13.3)) * radius;
        const theta = j * golden;
        const top = (j & 1) === 0;
        tx[idx] = Math.cos(theta) * rr;
        ty[idx] = top ? halfHeight : -halfHeight;
        tz[idx] = Math.sin(theta) * rr;
        tc[idx] = top ? 0.92 : 0.08;
      }

      // Fill interior volume for dense, seamless projection.
      for (let j = 0; idx < n; j++, idx++) {
        const theta = hash01(j, 23.2) * Math.PI * 2;
        const rr = Math.sqrt(hash01(j, 31.1)) * radius * 0.98;
        const y = (hash01(j, 42.5) * 2 - 1) * halfHeight;
        tx[idx] = Math.cos(theta) * rr;
        ty[idx] = y;
        tz[idx] = Math.sin(theta) * rr;
        tc[idx] = clamp((y + halfHeight) / (2 * halfHeight), 0, 1);
      }
      break;
    }
    case "torus": {
      const R1 = 0.95;
      const R2 = 0.34;
      for (let i = 0; i < n; i++) {
        const u = (i / n) * Math.PI * 2;
        const v = ((i * 7.21 / n) % 1) * Math.PI * 2;
        const x = (R1 + R2 * Math.cos(v)) * Math.cos(u);
        const y = R2 * Math.sin(v);
        const z = (R1 + R2 * Math.cos(v)) * Math.sin(u);
        tx[i] = x * 0.8;
        ty[i] = y * 0.8;
        tz[i] = z * 0.8;
        tc[i] = clamp((z + (R1 + R2)) / (2 * (R1 + R2)), 0, 1);
      }
      break;
    }
    case "cube": {
      const S = 0.96;
      const grid = Math.max(2, Math.ceil(Math.cbrt(n)));
      const step = (S * 2) / grid;
      const shellRatio = 0.36;
      for (let i = 0; i < n; i++) {
        const gx = i % grid;
        const gy = Math.floor(i / grid) % grid;
        const gz = Math.floor(i / (grid * grid));

        let x = -S + (gx + 0.5) * step + (hash01(i, 6.1) - 0.5) * step * 0.14;
        let y = -S + (gy + 0.5) * step + (hash01(i, 9.4) - 0.5) * step * 0.14;
        let z = -S + (gz + 0.5) * step + (hash01(i, 12.7) - 0.5) * step * 0.14;

        // Pull a portion of points to shell planes for sharp cube faces.
        if (hash01(i, 18.2) < shellRatio) {
          const axis = Math.floor(hash01(i, 21.8) * 3);
          const sign = hash01(i, 25.3) > 0.5 ? 1 : -1;
          if (axis === 0) x = sign * S;
          else if (axis === 1) y = sign * S;
          else z = sign * S;
        }

        tx[i] = clamp(x, -S, S);
        ty[i] = clamp(y, -S, S);
        tz[i] = clamp(z, -S, S);

        const edge = Math.max(Math.abs(tx[i] ?? 0), Math.abs(ty[i] ?? 0), Math.abs(tz[i] ?? 0)) / S;
        const vertical = ((ty[i] ?? 0) / S + 1) * 0.5;
        tc[i] = clamp(0.14 + edge * 0.56 + vertical * 0.3, 0, 1);
      }
      break;
    }
    case "trefoil": {
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const x0 = Math.sin(t) + 2 * Math.sin(2 * t);
        const y0 = Math.cos(t) - 2 * Math.cos(2 * t);
        const z0 = -Math.sin(3 * t);
        tx[i] = x0 * 0.32;
        ty[i] = y0 * 0.32;
        tz[i] = z0 * 0.5;
        tc[i] = clamp((z0 + 1) * 0.5, 0, 1);
      }
      break;
    }
    case "mobius": {
      for (let i = 0; i < n; i++) {
        const u = (i / n) * Math.PI * 2;
        const v = ((i * 11.0 / n) % 1 - 0.5) * 0.55;
        const x = (1 + v * Math.cos(u / 2)) * Math.cos(u);
        const y = (1 + v * Math.cos(u / 2)) * Math.sin(u);
        const z = v * Math.sin(u / 2) * 1.8;
        tx[i] = x * 0.78;
        ty[i] = y * 0.78;
        tz[i] = z * 0.78;
        tc[i] = clamp((y + 1) * 0.5, 0, 1);
      }
      break;
    }
    case "klein": {
      for (let i = 0; i < n; i++) {
        const u = (i / n) * Math.PI * 2;
        const v = ((i * 5.31 / n) % 1) * Math.PI * 2;
        let x:number;
        let y:number;
        if (u < Math.PI) {
          x = 3 * Math.cos(u) * (1 + Math.sin(u)) + 2 * (1 - Math.cos(u) / 2) * Math.cos(u) * Math.cos(v);
          y = 8 * Math.sin(u) + 2 * (1 - Math.cos(u) / 2) * Math.sin(u) * Math.cos(v);
        } else {
          x = 3 * Math.cos(u) * (1 + Math.sin(u)) + 2 * (1 - Math.cos(u) / 2) * Math.cos(v + Math.PI);
          y = 8 * Math.sin(u);
        }
        const z = 2 * (1 - Math.cos(u) / 2) * Math.sin(v);
        tx[i] = x * 0.16;
        ty[i] = y * 0.12;
        tz[i] = z * 0.55;
        tc[i] = clamp((z + 2) / 4, 0, 1);
      }
      break;
    }
    case "octahed": {
      const verts:([number,number,number])[]= [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      const faces:([number,number,number])[]= [[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,3,4],[1,5,3],[1,2,5]];
      const perFace = Math.max(1, Math.floor(n / faces.length));
      for(let i=0;i<n;i++){
        const face=Math.floor(i/perFace) % faces.length;
        const [ai,bi,ci]=faces[face]!;
        const a=verts[ai]!,b=verts[bi]!,c=verts[ci]!;
        const r1 = Math.sqrt(hash01(i, 4.1));
        const r2 = hash01(i, 5.2);
        const w0 = 1 - r1;
        const w1 = r1 * (1 - r2);
        const w2 = r1 * r2;
        const x = (a[0] * w0 + b[0] * w1 + c[0] * w2) * 0.95;
        const y = (a[1] * w0 + b[1] * w1 + c[1] * w2) * 0.95;
        const z = (a[2] * w0 + b[2] * w1 + c[2] * w2) * 0.95;
        tx[i]=x;
        ty[i]=y;
        tz[i]=z;
        tc[i]=clamp((z + 1) * 0.5, 0, 1);
      }
      break;
    }
    case "heart": {
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const x = 0.06 * 16 * Math.pow(Math.sin(t), 3);
        const y = -0.06 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const z = 0.28 * Math.cos(t) * Math.sin(t);
        tx[i] = x;
        ty[i] = y;
        tz[i] = z;
        tc[i] = clamp((z + 0.3) / 0.6, 0, 1);
      }
      break;
    }
    case "wave": {
      const cols = Math.ceil(Math.sqrt(n));
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const u = (col / cols - 0.5) * 2.2;
        const v = (row / cols - 0.5) * 2.2;
        const r = Math.sqrt(u * u + v * v);
        const z = Math.sin(r * 4.6) * (1 - clamp(r / 1.5, 0, 1)) * 0.38;
        tx[i] = u;
        ty[i] = v;
        tz[i] = z;
        tc[i] = clamp((z + 0.4) / 0.8, 0, 1);
      }
      break;
    }
    case "dna": {
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const y = (t - 0.5) * 2.2;
        const angle = t * Math.PI * 14;
        const strand = i % 3;
        let x = 0;
        let z = 0;
        if (strand < 2) {
          const offset = strand === 0 ? Math.PI / 2 : -Math.PI / 2;
          x = Math.cos(angle + offset) * 0.62;
          z = Math.sin(angle + offset) * 0.62;
          tc[i] = strand === 0 ? 0.2 : 0.78;
        } else {
          x = Math.cos(angle + Math.PI / 2) * (0.25 + hash01(i, 3.7) * 0.35);
          z = Math.sin(angle + Math.PI / 2) * (0.25 + hash01(i, 9.3) * 0.35);
          tc[i] = 0.5;
        }
        tx[i] = x;
        ty[i] = y;
        tz[i] = z;
      }
      break;
    }
    case "spiral": {
      for (let i = 0; i < n; i++) {
        const t = (i / n) * 6 * Math.PI;
        const radius = 1.1 * (1 - (i / n) * 0.72);
        const x = radius * Math.cos(t);
        const z = radius * Math.sin(t);
        const y = (i / n - 0.5) * 1.8;
        tx[i] = x;
        ty[i] = y;
        tz[i] = z;
        tc[i] = i / n;
      }
      break;
    }
    default: {
      for (let i = 0; i < n; i++) {
        const arm = i % 4;
        const t = i / n;
        const radius = Math.pow(hash01(i, 11.2), 0.55) * 1.45;
        const theta = arm * (Math.PI / 2) + radius * 3.0 + t * Math.PI * 2;
        const x = Math.cos(theta) * radius;
        const y = (hash01(i, 7.9) - 0.5) * 0.32;
        const z = Math.sin(theta) * radius * 0.38;
        tx[i] = x;
        ty[i] = y;
        tz[i] = z;
        tc[i] = clamp(radius / 1.45, 0, 1);
      }
    }
  }
}

interface ImagePoint {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

function extractOpaqueImagePoints(imageData: ImageData, srcW: number, srcH: number): { all: ImagePoint[]; edges: ImagePoint[] } {
  const all: ImagePoint[] = [];
  const edges: ImagePoint[] = [];
  const data = imageData.data;
  const alphaThreshold = 20;

  const alphaAt = (x: number, y: number): number => {
    if (x < 0 || x >= srcW || y < 0 || y >= srcH) return 0;
    return data[(y * srcW + x) * 4 + 3] ?? 0;
  };

  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const i = (y * srcW + x) * 4;
      const a = data[i + 3] ?? 0;
      if (a <= alphaThreshold) continue;

      const point: ImagePoint = {
        x,
        y,
        r: data[i] ?? 0,
        g: data[i + 1] ?? 0,
        b: data[i + 2] ?? 0,
        a,
      };
      all.push(point);

      const isEdge =
        alphaAt(x - 1, y) <= alphaThreshold ||
        alphaAt(x + 1, y) <= alphaThreshold ||
        alphaAt(x, y - 1) <= alphaThreshold ||
        alphaAt(x, y + 1) <= alphaThreshold;

      if (isEdge) {
        edges.push(point);
      }
    }
  }

  return { all, edges };
}

function stratifiedSelectImagePoints(
  points: ImagePoint[],
  desired: number,
  srcW: number,
  srcH: number,
  seed: number
): ImagePoint[] {
  if (desired <= 0 || points.length === 0) return [];
  if (points.length <= desired) return points.slice();

  const cellSize = Math.max(1, Math.sqrt((srcW * srcH) / desired));
  const gridW = Math.max(1, Math.ceil(srcW / cellSize));
  const gridH = Math.max(1, Math.ceil(srcH / cellSize));
  const cellCount = gridW * gridH;
  const bestIdx = new Int32Array(cellCount).fill(-1);
  const bestScore = new Float32Array(cellCount).fill(Number.POSITIVE_INFINITY);

  for (let i = 0; i < points.length; i++) {
    const pt = points[i]!;
    const gx = Math.min(gridW - 1, Math.max(0, Math.floor(pt.x / cellSize)));
    const gy = Math.min(gridH - 1, Math.max(0, Math.floor(pt.y / cellSize)));
    const cell = gy * gridW + gx;
    const cx = (gx + 0.5) * cellSize;
    const cy = (gy + 0.5) * cellSize;
    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const score = dx * dx + dy * dy + hash01(i, seed) * cellSize * 0.11;
    if (score < (bestScore[cell] ?? Number.POSITIVE_INFINITY)) {
      bestScore[cell] = score;
      bestIdx[cell] = i;
    }
  }

  const selected: ImagePoint[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const idx = bestIdx[cell] ?? -1;
    if (idx >= 0) {
      selected.push(points[idx]!);
    }
  }

  if (selected.length > desired) {
    const reduced: ImagePoint[] = [];
    const step = selected.length / desired;
    let cursor = hash01(desired, seed * 1.13) * step;
    for (let i = 0; i < desired; i++) {
      reduced.push(selected[Math.floor(cursor) % selected.length]!);
      cursor += step;
    }
    return reduced;
  }

  if (selected.length < desired) {
    const fill = selected.slice();
    const needed = desired - selected.length;
    if (needed > 0) {
      const step = points.length / needed;
      let cursor = hash01(points.length, seed * 2.07) * points.length;
      for (let i = 0; i < needed; i++) {
        fill.push(points[Math.floor(cursor) % points.length]!);
        cursor += step;
      }
    }
    return fill;
  }

  return selected;
}

function buildAdaptiveImagePointSet(imageData: ImageData, srcW: number, srcH: number, targetCount: number): ImagePoint[] {
  if (targetCount <= 0) return [];
  const { all, edges } = extractOpaqueImagePoints(imageData, srcW, srcH);
  if (all.length === 0) return [];

  if (all.length <= targetCount) {
    const out = all.slice();
    while (out.length < targetCount) {
      const pick = Math.floor((out.length * 1.61803398875) % all.length);
      out.push(all[pick]!);
    }
    return out.slice(0, targetCount);
  }

  const edgeQuota = Math.min(edges.length, Math.floor(targetCount * 0.3));
  const outline = stratifiedSelectImagePoints(edges, edgeQuota, srcW, srcH, 17.9);
  const fillQuota = Math.max(0, targetCount - outline.length);
  const fill = stratifiedSelectImagePoints(all, fillQuota, srcW, srcH, 41.3);

  const merged = outline.concat(fill);
  if (merged.length >= targetCount) {
    return merged.slice(0, targetCount);
  }

  const remaining = targetCount - merged.length;
  const extra = stratifiedSelectImagePoints(all, remaining, srcW, srcH, 77.1);
  return merged.concat(extra).slice(0, targetCount);
}

function seedShapeSpaceFromScreen(p: Particles, W: number, H: number): void {
  const minDim = Math.max(1, Math.min(W, H));
  for (let i = 0; i < p.count; i++) {
    p.sx[i] = ((p.px[i] ?? W / 2) - W / 2) / minDim * 2.2;
    p.sy[i] = ((p.py[i] ?? H / 2) - H / 2) / minDim * 2.2;
    p.sz[i] = (hash01(i, 2.7) - 0.5) * 0.55;
    p.svx[i] = 0;
    p.svy[i] = 0;
    p.svz[i] = 0;
  }
}

function createAmbientField(W: number, H: number): AmbientField {
  const count = clamp(Math.floor((W * H) / 6400), 280, 1200);
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const vx = new Float32Array(count);
  const vy = new Float32Array(count);
  const alpha = new Float32Array(count);
  const size = new Float32Array(count);
  const hue = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    x[i] = Math.random() * W;
    y[i] = Math.random() * H;
    vx[i] = (Math.random() - 0.5) * 0.45;
    vy[i] = (Math.random() - 0.5) * 0.45;
    alpha[i] = 0.06 + Math.random() * 0.14;
    size[i] = 0.45 + Math.random() * 1.75;
    hue[i] = Math.random();
  }

  return { x, y, vx, vy, alpha, size, hue, count };
}

/* ─── Preset initializers ─────────────────────────────────────────────── */
type InitFn=(p:Particles,W:number,H:number)=>void;
const PRESET_INITS:Record<string,InitFn>={
  galaxy(p,W,H){
    computeGalaxyTargets2D(p.count,W,H,p.tx,p.ty,p.tc);
    for(let i=0;i<p.count;i++){
      p.px[i]=p.tx[i]!; p.py[i]=p.ty[i]!;
      p.pvx[i]=(Math.random()-0.5)*1; p.pvy[i]=(Math.random()-0.5)*1;
      p.pm[i]=0.5+Math.random()*1.5; p.pc[i]=p.tc[i]!; p.palpha[i]=0.7+Math.random()*0.3;
    }
  },
  bigbang(p,W,H){
    for(let i=0;i<p.count;i++){
      const a=Math.random()*Math.PI*2,sp=2+Math.random()*9;
      p.px[i]=W/2+(Math.random()-0.5)*8; p.py[i]=H/2+(Math.random()-0.5)*8;
      p.pvx[i]=Math.cos(a)*sp; p.pvy[i]=Math.sin(a)*sp;
      p.pm[i]=0.2+Math.random(); p.pc[i]=Math.random(); p.palpha[i]=0.9;
    }
  },
  blackhole(p,W,H){
    for(let i=0;i<p.count;i++){
      const r=50+Math.random()*Math.min(W,H)*0.4,a=Math.random()*Math.PI*2;
      p.px[i]=W/2+Math.cos(a)*r; p.py[i]=H/2+Math.sin(a)*r;
      const sp=Math.sqrt(4500/r)*0.7;
      p.pvx[i]=-Math.sin(a)*sp; p.pvy[i]=Math.cos(a)*sp;
      p.pm[i]=0.3+Math.random(); p.pc[i]=r/(Math.min(W,H)*0.4); p.palpha[i]=0.6+Math.random()*0.4;
    }
  },
  plasma(p,W,H){
    for(let i=0;i<p.count;i++){
      p.px[i]=Math.random()*W; p.py[i]=Math.random()*H;
      p.pvx[i]=(Math.random()-0.5)*3; p.pvy[i]=(Math.random()-0.5)*3;
      p.pm[i]=0.3+Math.random()*0.7;
      p.pcharge[i]=(Math.random()>0.5?1:-1)*(0.5+Math.random()*1.5);
      p.pphase[i]=Math.random()*Math.PI*2; p.pc[i]=Math.random(); p.palpha[i]=0.8;
    }
  },
  doubleslit(p,W,H){
    for(let i=0;i<p.count;i++){
      p.px[i]=20+Math.random()*25; p.py[i]=H/2+(Math.random()-0.5)*H*0.8;
      p.pvx[i]=1.5+Math.random()*0.5; p.pvy[i]=(Math.random()-0.5)*0.3;
      p.pm[i]=0.3; p.pphase[i]=Math.random()*Math.PI*2; p.pc[i]=Math.random(); p.palpha[i]=0.8;
    }
  },
  solar(p,W,H){
    const planets=[{r:60,n:180},{r:100,n:250},{r:145,n:350},{r:195,n:420},{r:250,n:500},{r:295,n:350},{r:330,n:280},{r:365,n:180}];
    let idx=0;
    for(let j=0;j<400&&idx<p.count;j++,idx++){
      const a=Math.random()*Math.PI*2,rad=Math.random()*16;
      p.px[idx]=W/2+Math.cos(a)*rad; p.py[idx]=H/2+Math.sin(a)*rad;
      p.pvx[idx]=(Math.random()-0.5)*0.2; p.pvy[idx]=(Math.random()-0.5)*0.2;
      p.pm[idx]=3; p.pc[idx]=0.95; p.palpha[idx]=1;
    }
    for(const pl of planets){
      const sp=Math.sqrt(1200/pl.r)*0.65;
      for(let j=0;j<pl.n&&idx<p.count;j++,idx++){
        const a=Math.random()*Math.PI*2,dr=(Math.random()-0.5)*12;
        p.px[idx]=W/2+Math.cos(a)*(pl.r+dr); p.py[idx]=H/2+Math.sin(a)*(pl.r+dr);
        p.pvx[idx]=-Math.sin(a)*sp+(Math.random()-0.5)*0.3; p.pvy[idx]=Math.cos(a)*sp+(Math.random()-0.5)*0.3;
        p.pm[idx]=0.4+Math.random(); p.pc[idx]=pl.r/400; p.palpha[idx]=0.6+Math.random()*0.4;
      }
    }
  },
  bec(p,W,H){
    for(let i=0;i<p.count;i++){
      const r=Math.random()*70,a=Math.random()*Math.PI*2;
      p.px[i]=W/2+Math.cos(a)*r+(Math.random()-0.5)*15; p.py[i]=H/2+Math.sin(a)*r+(Math.random()-0.5)*15;
      p.pvx[i]=(Math.random()-0.5)*0.4; p.pvy[i]=(Math.random()-0.5)*0.4;
      p.pm[i]=0.5; p.pc[i]=r/70; p.palpha[i]=0.6+Math.random()*0.4;
    }
  },
  darkmatter(p,W,H){
    for(let i=0;i<p.count;i++){
      const vis=Math.random()>0.2;
      if(vis){const r=30+Math.random()*Math.min(W,H)*0.4,a=Math.random()*Math.PI*2;p.px[i]=W/2+Math.cos(a)*r*(0.5+Math.random()*0.5);p.py[i]=H/2+Math.sin(a)*r*(0.5+Math.random()*0.5);}
      else{p.px[i]=(Math.random()-0.5)*W*1.2+W/2;p.py[i]=(Math.random()-0.5)*H*1.2+H/2;}
      const px = p.px[i] ?? W / 2;
      const py = p.py[i] ?? H / 2;
      const r2=Math.sqrt((px-W/2)**2+(py-H/2)**2)+1;
      const sp=Math.sqrt(1.5/r2)*r2*0.04,a2=Math.atan2(py-H/2,px-W/2);
      p.pvx[i]=-Math.sin(a2)*sp; p.pvy[i]=Math.cos(a2)*sp;
      p.pm[i]=0.3+Math.random(); p.pc[i]=vis?0.4+Math.random()*0.4:0.05; p.palpha[i]=vis?0.5+Math.random()*0.5:0.08;
    }
  },
  dna(p,W,H){
    for(let i=0;i<p.count;i++){
      const t2=i/p.count,z3=t2*H*1.05-H*0.025,angle=t2*Math.PI*14,strand=i%3;
      let rx=0,c=0;
      if(strand<2){rx=Math.cos(angle+(strand===0?1:-1)*Math.PI/2)*40;c=strand===0?0.2:0.75;}
      else{rx=Math.cos(angle+Math.PI/2)*40*(Math.random()*0.6+0.2);c=0.5;}
      p.px[i]=W/2+rx+(Math.random()-0.5)*4; p.py[i]=z3+(Math.random()-0.5)*4;
      p.pvx[i]=(Math.random()-0.5)*0.1; p.pvy[i]=(Math.random()-0.5)*0.1;
      p.pm[i]=0.6+Math.random()*0.4; p.pc[i]=c; p.palpha[i]=0.7+Math.random()*0.3;
    }
  },
  vortex(p,W,H){
    for(let i=0;i<p.count;i++){
      const r=20+Math.random()*Math.min(W,H)*0.38,a=Math.random()*Math.PI*2;
      p.px[i]=W/2+Math.cos(a)*r+(Math.random()-0.5)*20; p.py[i]=H/2+Math.sin(a)*r+(Math.random()-0.5)*20;
      const sp=1.5+r*0.01;
      p.pvx[i]=-Math.sin(a)*sp; p.pvy[i]=Math.cos(a)*sp;
      p.pm[i]=1; p.pc[i]=0.3+Math.random()*0.5; p.palpha[i]=0.7;
    }
  },
  anntraining(p,W,H){
    const layers=[6,8,8,6,4];
    const lx=layers.map((_,i)=>80+(i/(layers.length-1))*(W-160));
    let idx=0;
    for(let l=0;l<layers.length;l++){
      for(let j=0;j<(layers[l]??0);j++){
        const cx2=lx[l]??0,cy2=H/2+(j-((layers[l]??0)-1)/2)*(H*0.12);
        const batchN=Math.floor(p.count/(layers.reduce((a,b)=>a+b,0)));
        for(let k=0;k<batchN&&idx<p.count;k++,idx++){
          const a=Math.random()*Math.PI*2,r=Math.random()*28;
          p.px[idx]=cx2+Math.cos(a)*r; p.py[idx]=cy2+Math.sin(a)*r;
          p.pvx[idx]=(Math.random()-0.5)*0.3; p.pvy[idx]=(Math.random()-0.5)*0.3;
          p.pm[idx]=0.5; p.pc[idx]=l/(layers.length-1); p.palpha[idx]=0.7+Math.random()*0.3;
        }
      }
    }
  },
  tunneling(p,W,H){
    for(let i=0;i<p.count;i++){
      p.px[i]=20+Math.random()*W*0.3; p.py[i]=H*0.2+Math.random()*H*0.6;
      p.pvx[i]=1+Math.random()*2; p.pvy[i]=(Math.random()-0.5)*0.5;
      p.pm[i]=0.3+Math.random()*0.4; p.pphase[i]=Math.random()*Math.PI*2;
      p.pc[i]=Math.random(); p.palpha[i]=0.6+Math.random()*0.4;
    }
  },
};

/* ─── Main hook ─────────────────────────────────────────────────────────── */
export function useParticleEngine({canvasRef}:EngineOptions){
  const isRunning = useSimulatorStore((s) => s.isRunning);
  const storeStateRef = useRef(useSimulatorStore.getState());
  useEffect(() => {
    return useSimulatorStore.subscribe((s) => {
      storeStateRef.current = s;
    });
  }, []);
  const {renderMode}=useWebGPU();
  const pRef=useRef<Particles|null>(null);
  const offRef=useRef<{buf:HTMLCanvasElement;ctx:CanvasRenderingContext2D}|null>(null);
  const layersRef=useRef<RenderLayers|null>(null);
  const screenCtxRef=useRef<CanvasRenderingContext2D|null>(null);
  const gradientCacheRef = useRef<{ atmosphere: CanvasGradient; grade: CanvasGradient; vignette: CanvasGradient; w: number; h: number } | null>(null);
  const colorLutRef = useRef<{ key: string; table: Uint8Array } | null>(null);
  const styleCacheRef = useRef<Map<number, string>>(new Map());
  const gravityGridRef = useRef<{ cells: number; mass: Float32Array; sumX: Float32Array; sumY: Float32Array }>({
    cells: 0,
    mass: new Float32Array(0),
    sumX: new Float32Array(0),
    sumY: new Float32Array(0),
  });
  const ambientRef = useRef<AmbientField | null>(null);
  const textTargetsRef=useRef<Float32Array|null>(null);
  const imgTargetsRef=useRef<{tx:Float32Array;ty:Float32Array}|null>(null);
  const shapeModeRef=useRef(false);
  const imgModeRef=useRef(false);
  const currentShapeRef=useRef("galaxy");
  const shapeCameraRef = useRef<ShapeCameraState>({
    yaw: 0,
    pitch: -0.18,
    distance: 2.7,
    minDistance: 1.55,
    maxDistance: 4.9,
    rotateSensitivity: 0.006,
    zoomStep: 0.2,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });
  const customPaletteRef = useRef<{ enabled: boolean; start: [number, number, number]; end: [number, number, number] }>({
    enabled: false,
    start: [0, 212, 255],
    end: [255, 84, 138],
  });
  const shapeAutoYawRef = useRef(0);
  const lastTextRef = useRef<string>("QUANTUM");
  const lastImageDataRef = useRef<{ data: ImageData; w: number; h: number; exact: boolean } | null>(null);
  const renderTuningRef = useRef<RenderTuningState>({ brightness: 1, glow: 1 });
  const cursorFieldRef = useRef<CursorFieldState>({ enabled: false, strength: 0.85, radius: 1 });
  const forceModeRef=useRef<"attract"|"repel"|"orbit">("attract");
  const morphSpeedRef=useRef(0.2);
  const simTimeRef=useRef(0);
  const fpsRef=useRef({frames:0,acc:0,fps:0});
  const mouseRef=useRef({x:0,y:0,down:false,rightDown:false,shift:false,isRotating:false,inside:false});
  // image colormap override (per-particle RGB when using image mode)
  const imgColorsRef=useRef<{r:Uint8Array;g:Uint8Array;b:Uint8Array}|null>(null);

  useEffect(()=>{storeStateRef.current.setRenderMode(renderMode);},[renderMode]);

  function getWH(){const c=canvasRef.current;return{W:c?.offsetWidth??800,H:c?.offsetHeight??600};}

  const refreshCursor = useCallback(() => {
    const c = canvasRef.current;
    if(!c) return;
    if(shapeCameraRef.current.dragging) c.style.cursor = "grabbing";
    else if(shapeModeRef.current) c.style.cursor = "grab";
    else c.style.cursor = "crosshair";
  }, [canvasRef]);

  function snapToShape(shape:string){
    const{W,H}=getWH();
    let p=pRef.current;
    if(!p){p=alloc(storeStateRef.current.particleCount);pRef.current=p;}
    const n=p.count;

    if (!shapeModeRef.current) {
      seedShapeSpaceFromScreen(p, W, H);
    }

    computeShapeTargets3D(shape,n,p.stx,p.sty,p.stz,p.tc);
    for(let i=0;i<n;i++){
      // Keep current positions as start state and let frame loop do smooth morphing.
      p.sx[i] = p.sx[i] ?? 0;
      p.sy[i] = p.sy[i] ?? 0;
      p.sz[i] = p.sz[i] ?? 0;
      p.svx[i] = 0;
      p.svy[i] = 0;
      p.svz[i] = 0;
      p.pvx[i] = 0;
      p.pvy[i] = 0;
      p.pc[i]=p.tc[i]!;
      p.palpha[i]=0.45 + hash01(i, 6.2) * 0.5;
      p.pm[i] = 0.6 + (p.psize[i] ?? 1) * 0.9;
    }

    textTargetsRef.current=null;
    imgTargetsRef.current=null;
    imgModeRef.current=false;
    imgColorsRef.current=null;
    if (!shapeModeRef.current) {
      shapeAutoYawRef.current = 0;
    }
    shapeModeRef.current=true;
    currentShapeRef.current=shape;
    storeStateRef.current.setActivePreset(null);
    window.dispatchEvent(new CustomEvent("qf:shapeChanged", { detail: shape }));
    refreshCursor();
  }

  function initPreset(name:string){
    const{W,H}=getWH();
    const n=storeStateRef.current.particleCount;
    const p=alloc(n);
    const fn=PRESET_INITS[name]??PRESET_INITS["galaxy"]!;
    fn(p,W,H);
    pRef.current=p;
    textTargetsRef.current=null;
    imgModeRef.current=false;
    imgTargetsRef.current=null;
    imgColorsRef.current=null;
    lastImageDataRef.current = null;
    shapeModeRef.current=false;
    shapeAutoYawRef.current=0;
    currentShapeRef.current="galaxy";
    window.dispatchEvent(new CustomEvent("qf:shapeChanged", { detail: "galaxy" }));
    refreshCursor();
  }

  /* ── Text to particles ─────────────────────────────────────────────── */
  function buildTextTargets(text:string):Float32Array{
    const{W,H}=getWH();
    const off=document.createElement("canvas");
    off.width=W;off.height=H;
    const oc=off.getContext("2d")!;
    const fs=Math.min(160,W/Math.max(1,text.length)*1.8,H*0.65);
    oc.fillStyle="white";
    oc.font=`bold ${fs}px 'Space Grotesk',sans-serif`;
    oc.textAlign="center";oc.textBaseline="middle";
    oc.fillText(text,W/2,H/2);
    const imgData=oc.getImageData(0,0,W,H);
    const pts:number[]=[];
    const step=Math.max(2,Math.floor(Math.sqrt(W*H/storeStateRef.current.particleCount)*0.9));
    for(let y=0;y<H;y+=step)for(let x=0;x<W;x+=step)
      if((imgData.data[(y*W+x)*4]??0)>100) pts.push(x+(Math.random()-0.5)*step,y+(Math.random()-0.5)*step);
    const nc=storeStateRef.current.particleCount;
    const tgt=new Float32Array(nc*2);
    for(let i=0;i<nc;i++){tgt[i*2]=pts[(i*2)%pts.length]??W/2;tgt[i*2+1]=pts[(i*2+1)%pts.length]??H/2;}
    return tgt;
  }

  function activateText(text:string){
    const{W,H}=getWH();
    const tgt=buildTextTargets(text);
    const n=storeStateRef.current.particleCount;
    const p=alloc(n);
    for(let i=0;i<n;i++){
      p.px[i]=Math.random()*W;p.py[i]=Math.random()*H;
      p.pvx[i]=(Math.random()-0.5)*8;p.pvy[i]=(Math.random()-0.5)*8;
      p.pm[i]=0.5+Math.random()*0.5;p.pc[i]=i/n;p.palpha[i]=0.9;
    }
    pRef.current=p;
    lastTextRef.current = text;
    textTargetsRef.current=tgt;
    shapeModeRef.current=false;
    imgModeRef.current=false;
    imgTargetsRef.current=null;
    imgColorsRef.current=null;
    refreshCursor();
  }

  /* ── Image to particles ──────────────────────────────────────────────── */
  function activateImage(imageData:ImageData, srcW:number, srcH:number, exactMode = false){
    const{W,H}=getWH();
    const exactPoints = exactMode ? extractOpaqueImagePoints(imageData, srcW, srcH).all : [];
    const sampledPoints = exactMode ? exactPoints : buildAdaptiveImagePointSet(imageData, srcW, srcH, storeStateRef.current.particleCount);
    const samples = sampledPoints.length > 0 ? sampledPoints : [{ x: srcW * 0.5, y: srcH * 0.5, r: 160, g: 180, b: 210, a: 255 }];
    const n = exactMode ? samples.length : storeStateRef.current.particleCount;
    const fitScale=Math.min(W/Math.max(1,srcW),H/Math.max(1,srcH));
    const drawW=srcW*fitScale;
    const drawH=srcH*fitScale;
    const offsetX=(W-drawW)*0.5;
    const offsetY=(H-drawH)*0.5;

    const p=alloc(n);
    const itx=new Float32Array(n),ity=new Float32Array(n);
    const itr=new Float32Array(n),itg=new Float32Array(n),itb=new Float32Array(n);

    for(let i=0;i<n;i++){
      const src=samples[i%samples.length]!;
      p.px[i]=Math.random()*W; p.py[i]=Math.random()*H;
      p.pvx[i]=(Math.random()-0.5)*(exactMode?2.8:4.5);
      p.pvy[i]=(Math.random()-0.5)*(exactMode?2.8:4.5);
      const alpha=(src.a??255)/255;
      p.palpha[i]=clamp(0.28+alpha*0.72,0,1);
      itx[i]=offsetX + (src.x + 0.5) * fitScale;
      ity[i]=offsetY + (src.y + 0.5) * fitScale;
      itr[i]=src.r; itg[i]=src.g; itb[i]=src.b;
      const lum=(0.2126*src.r+0.7152*src.g+0.0722*src.b)/255;
      p.pm[i]=0.35+alpha*0.35+(1-lum)*0.8;
      p.pc[i]=clamp(lum*0.9+alpha*0.1,0,1);
      const pxRadius=clamp(fitScale*0.52,0.45,3.4);
      p.psize[i]=exactMode?pxRadius:(0.55+Math.random()*0.9);
    }

    imgTargetsRef.current={tx:itx,ty:ity};
    const ir=new Uint8Array(n),ig=new Uint8Array(n),ib2=new Uint8Array(n);
    for(let i=0;i<n;i++){ir[i]=itr[i]!;ig[i]=itg[i]!;ib2[i]=itb[i]!;}
    imgColorsRef.current={r:ir,g:ig,b:ib2};
    lastImageDataRef.current = { data: imageData, w: srcW, h: srcH, exact: exactMode };
    pRef.current=p;
    shapeModeRef.current=false;
    imgModeRef.current=true;
    textTargetsRef.current=null;
    refreshCursor();
  }

  /* ── Canvas setup ─────────────────────────────────────────────────── */
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas) return;
    const buildLayers = (): void => {
      const width = Math.max(1, canvas.offsetWidth);
      const height = Math.max(1, canvas.offsetHeight);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));

      screenCtxRef.current = get2DContext(canvas, false);

      const mainLayer = createScaledLayer(width, height, dpr, false);
      const particleLayer = createScaledLayer(width, height, dpr, true);
      const blurLayer = createScaledLayer(width, height, dpr, true);

      offRef.current = { buf: mainLayer.buf, ctx: mainLayer.ctx };
      layersRef.current = {
        particleBuf: particleLayer.buf,
        particleCtx: particleLayer.ctx,
        blurBuf: blurLayer.buf,
        blurCtx: blurLayer.ctx,
      };
      gradientCacheRef.current = null;
      colorLutRef.current = null;
      ambientRef.current = createAmbientField(width, height);
    };

    buildLayers();
    initPreset("galaxy");

    const ro=new ResizeObserver(()=>{
      buildLayers();
    });
    ro.observe(canvas);
    return()=>ro.disconnect();
  },[]);// eslint-disable-line

  /* ── Pointer controls: left drag rotate, wheel zoom, right click force ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toLocal = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      const lx = clientX - r.left;
      const ly = clientY - r.top;
      const inside = lx >= 0 && lx <= r.width && ly >= 0 && ly <= r.height;
      mouseRef.current.inside = inside;
      mouseRef.current.x = clamp(lx, 0, r.width);
      mouseRef.current.y = clamp(ly, 0, r.height);
    };

    const onMouseDown = (e: MouseEvent) => {
      toLocal(e.clientX, e.clientY);
      if (e.button === 0 && shapeModeRef.current) {
        const cam = shapeCameraRef.current;
        cam.dragging = true;
        cam.lastX = e.clientX;
        cam.lastY = e.clientY;
        mouseRef.current.isRotating = true;
        mouseRef.current.down = false;
        refreshCursor();
        e.preventDefault();
        return;
      }

      if (e.button === 0 || e.button === 2) {
        mouseRef.current.down = true;
        mouseRef.current.rightDown = e.button === 2;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      toLocal(e.clientX, e.clientY);
      const cam = shapeCameraRef.current;
      if (!cam.dragging) return;

      const dx = e.clientX - cam.lastX;
      const dy = e.clientY - cam.lastY;
      cam.lastX = e.clientX;
      cam.lastY = e.clientY;
      cam.yaw += dx * cam.rotateSensitivity;
      cam.pitch = clamp(cam.pitch + dy * cam.rotateSensitivity, -1.2, 1.2);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        shapeCameraRef.current.dragging = false;
        mouseRef.current.isRotating = false;
      }
      if (e.button === 0 || e.button === 2) {
        mouseRef.current.down = false;
        mouseRef.current.rightDown = false;
      }
      refreshCursor();
    };

    const onWheel = (e: WheelEvent) => {
      if (!shapeModeRef.current) return;
      e.preventDefault();
      const cam = shapeCameraRef.current;
      const dir = Math.sign(e.deltaY);
      cam.distance = clamp(cam.distance + dir * cam.zoomStep, cam.minDistance, cam.maxDistance);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onMouseEnter = () => {
      mouseRef.current.inside = true;
    };

    const onMouseLeave = () => {
      mouseRef.current.inside = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      toLocal(touch.clientX, touch.clientY);
      mouseRef.current.inside = true;

      if (shapeModeRef.current) {
        const cam = shapeCameraRef.current;
        cam.dragging = true;
        cam.lastX = touch.clientX;
        cam.lastY = touch.clientY;
        mouseRef.current.isRotating = true;
        mouseRef.current.down = false;
        refreshCursor();
      } else {
        mouseRef.current.down = true;
      }
      e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      toLocal(touch.clientX, touch.clientY);

      const cam = shapeCameraRef.current;
      if (cam.dragging) {
        const dx = touch.clientX - cam.lastX;
        const dy = touch.clientY - cam.lastY;
        cam.lastX = touch.clientX;
        cam.lastY = touch.clientY;
        cam.yaw += dx * cam.rotateSensitivity;
        cam.pitch = clamp(cam.pitch + dy * cam.rotateSensitivity, -1.2, 1.2);
      }
      e.preventDefault();
    };

    const onTouchEnd = () => {
      shapeCameraRef.current.dragging = false;
      mouseRef.current.isRotating = false;
      mouseRef.current.down = false;
      mouseRef.current.inside = false;
      refreshCursor();
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseenter", onMouseEnter);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);

    refreshCursor();

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseenter", onMouseEnter);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [canvasRef, refreshCursor]);

  /* ── Event bus ────────────────────────────────────────────────────── */
  useEffect(()=>{
    const onPreset=(e:Event)=>{const name=(e as CustomEvent).detail as string;storeStateRef.current.setActivePreset(name as never);initPreset(name);};
    const onShape=(e:Event)=>{
      const s=(e as CustomEvent).detail as string;
      if(s==="galaxy"){
        initPreset("galaxy");
        shapeModeRef.current=false;
      }else{
        snapToShape(s);
      }
    };
    const onText=(e:Event)=>activateText((e as CustomEvent).detail as string);
    const onExplode=()=>{const p=pRef.current;if(!p)return;for(let i=0;i<p.count;i++){p.pvx[i]=(p.pvx[i]??0)+(Math.random()-0.5)*24;p.pvy[i]=(p.pvy[i]??0)+(Math.random()-0.5)*24;}};
    const onForce=(e:Event)=>{forceModeRef.current=(e as CustomEvent).detail as "attract"|"repel"|"orbit";};
    const onMorph=(e:Event)=>{morphSpeedRef.current=(e as CustomEvent).detail as number;};
    const onCustomPalette=(e:Event)=>{
      const detail=(e as CustomEvent).detail as {enabled:boolean;start:[number,number,number];end:[number,number,number]};
      customPaletteRef.current={
        enabled: !!detail?.enabled,
        start: detail?.start ?? customPaletteRef.current.start,
        end: detail?.end ?? customPaletteRef.current.end,
      };
    };
    const onRenderTuning=(e:Event)=>{
      const detail=(e as CustomEvent).detail as RenderTuningState;
      renderTuningRef.current={
        brightness: clamp(detail?.brightness ?? renderTuningRef.current.brightness, 0.4, 2.2),
        glow: clamp(detail?.glow ?? renderTuningRef.current.glow, 0, 2),
      };
    };
    const onCursorField=(e:Event)=>{
      const detail=(e as CustomEvent).detail as CursorFieldState;
      cursorFieldRef.current={
        enabled: !!detail?.enabled,
        strength: clamp(detail?.strength ?? cursorFieldRef.current.strength, 0.2, 2),
        radius: clamp(detail?.radius ?? cursorFieldRef.current.radius, 0.5, 2),
      };
    };
    const onPCount=(e:Event)=>{
      const next=(e as CustomEvent).detail as number;
      storeStateRef.current.setParticleCount(next);
      setTimeout(()=>{
        if(shapeModeRef.current&&currentShapeRef.current!=="galaxy"){
          snapToShape(currentShapeRef.current);
          return;
        }
        if(imgModeRef.current&&lastImageDataRef.current){
          const{data,w,h,exact}=lastImageDataRef.current;
          activateImage(data,w,h,exact);
          return;
        }
        if(textTargetsRef.current){
          activateText(lastTextRef.current||"QUANTUM");
          return;
        }
        initPreset(storeStateRef.current.activePreset??"galaxy");
      },30);
    };
    const onPhysics=(e:Event)=>{storeStateRef.current.setPhysicsMode((e as CustomEvent).detail as never);};
    const onImageData=(e:Event)=>{
      const{data,w,h,exact}=(e as CustomEvent).detail as{data:ImageData;w:number;h:number;exact?:boolean};
      activateImage(data,w,h,!!exact);
    };

    window.addEventListener("qf:loadPreset",onPreset);
    window.addEventListener("qf:loadShape",onShape);
    window.addEventListener("qf:textParticles",onText);
    window.addEventListener("qf:explode",onExplode);
    window.addEventListener("qf:forceMode",onForce);
    window.addEventListener("qf:morphSpeed",onMorph);
    window.addEventListener("qf:customPalette",onCustomPalette);
    window.addEventListener("qf:renderTuning",onRenderTuning);
    window.addEventListener("qf:cursorField",onCursorField);
    window.addEventListener("qf:particleCount",onPCount);
    window.addEventListener("qf:physicsMode",onPhysics);
    window.addEventListener("qf:imageData",onImageData);
    return()=>{
      window.removeEventListener("qf:loadPreset",onPreset);
      window.removeEventListener("qf:loadShape",onShape);
      window.removeEventListener("qf:textParticles",onText);
      window.removeEventListener("qf:explode",onExplode);
      window.removeEventListener("qf:forceMode",onForce);
      window.removeEventListener("qf:morphSpeed",onMorph);
      window.removeEventListener("qf:customPalette",onCustomPalette);
      window.removeEventListener("qf:renderTuning",onRenderTuning);
      window.removeEventListener("qf:cursorField",onCursorField);
      window.removeEventListener("qf:particleCount",onPCount);
      window.removeEventListener("qf:physicsMode",onPhysics);
      window.removeEventListener("qf:imageData",onImageData);
    };
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  /* ── Main frame loop ─────────────────────────────────────────────── */
  const onFrame=useCallback((dt:number)=>{
    const canvas=canvasRef.current;
    const off=offRef.current;
    const layers=layersRef.current;
    const screenCtx=screenCtxRef.current;
    const p=pRef.current;
    if(!canvas||!off||!layers||!screenCtx||!p) return;

    const store=storeStateRef.current;

    const W=canvas.offsetWidth,H=canvas.offsetHeight;
    const DT=Math.min(dt,3)*store.timeScale;
    simTimeRef.current+=dt/60;
    refreshCursor();

    /* ── Mouse force ── */
    const hoverForceActive = cursorFieldRef.current.enabled && mouseRef.current.inside && !mouseRef.current.isRotating;
    const forceActive = (mouseRef.current.down || hoverForceActive) && !mouseRef.current.isRotating;
    if(forceActive){
      const{x:mx,y:my}=mouseRef.current;
      const dynamicRadius=store.forceRadius*(hoverForceActive?cursorFieldRef.current.radius:1);
      const dynamicStrength=store.forceStrength*(hoverForceActive?cursorFieldRef.current.strength:1);
      const r2Max=dynamicRadius**2;
      const fm=forceModeRef.current;
      const isOrb=fm==="orbit",isRep=mouseRef.current.shift||fm==="repel";
      for(let i=0;i<p.count;i++){
        const dx=(p.px[i]??0)-mx,dy=(p.py[i]??0)-my;
        const r2=dx*dx+dy*dy;
        if(r2<r2Max&&r2>1){
          const r=Math.sqrt(r2),f=(dynamicStrength*(1-r/dynamicRadius))/r;
          if(isOrb){p.pvx[i]=(p.pvx[i]??0)-dy*f*0.5;p.pvy[i]=(p.pvy[i]??0)+dx*f*0.5;}
          else if(isRep){p.pvx[i]=(p.pvx[i]??0)+dx*f*0.7;p.pvy[i]=(p.pvy[i]??0)+dy*f*0.7;}
          else{p.pvx[i]=(p.pvx[i]??0)-dx*f*0.7;p.pvy[i]=(p.pvy[i]??0)-dy*f*0.7;}
        }
      }
    }

    /* ── Shape morph: stable camera + smooth local-space morph ── */
    if(shapeModeRef.current){
      const camera = shapeCameraRef.current;
      if(!camera.dragging){
        shapeAutoYawRef.current += 0.0022 * DT;
      }
      const cs = 1;
      const ss = 0;
      const totalYaw = camera.yaw + shapeAutoYawRef.current;
      const cy = Math.cos(totalYaw);
      const sy = Math.sin(totalYaw);
      const cp = Math.cos(camera.pitch);
      const sp = Math.sin(camera.pitch);
      const morphRate = clamp(0.03 + morphSpeedRef.current * 0.24, 0.02, 0.34);
      const blend = 1 - Math.pow(1 - morphRate, Math.min(3, DT));
      const projectionScale = Math.min(W, H) * 0.86;

      for(let i=0;i<p.count;i++){
        const dx = (p.stx[i] ?? 0) - (p.sx[i] ?? 0);
        const dy = (p.sty[i] ?? 0) - (p.sy[i] ?? 0);
        const dz = (p.stz[i] ?? 0) - (p.sz[i] ?? 0);
        p.sx[i] = (p.sx[i] ?? 0) + dx * blend;
        p.sy[i] = (p.sy[i] ?? 0) + dy * blend;
        p.sz[i] = (p.sz[i] ?? 0) + dz * blend;
        p.svx[i] = 0;
        p.svy[i] = 0;
        p.svz[i] = 0;

        const ox = (p.sx[i] ?? 0) * cs - (p.sz[i] ?? 0) * ss;
        const oz = (p.sx[i] ?? 0) * ss + (p.sz[i] ?? 0) * cs;
        const oy = p.sy[i] ?? 0;

        const xYaw = ox * cy - oz * sy;
        const zYaw = ox * sy + oz * cy;
        const yPitch = oy * cp - zYaw * sp;
        const zPitch = oy * sp + zYaw * cp;

        const depth = camera.distance - zPitch;
        const perspective = 1 / Math.max(0.32, depth);

        p.px[i] = W * 0.5 + xYaw * projectionScale * perspective;
        p.py[i] = H * 0.5 + yPitch * projectionScale * perspective;

        const depthMix = clamp((camera.maxDistance - depth) / (camera.maxDistance - camera.minDistance + 1.8), 0, 1);
        p.pc[i] = clamp((p.tc[i] ?? 0.5) * 0.86 + depthMix * 0.22, 0, 1);
        p.palpha[i] = 0.38 + depthMix * 0.58;
        p.pm[i] = 0.5 + (p.psize[i] ?? 1) * 0.85 + depthMix * 0.3;
      }
    }
    /* ── Image morph ── */
    else if(imgModeRef.current&&imgTargetsRef.current){
      const{tx:itx,ty:ity}=imgTargetsRef.current;
      const ms=Math.min(0.08*DT,0.35);
      for(let i=0;i<p.count;i++){
        const dx=(itx[i]??0)-(p.px[i]??0),dy=(ity[i]??0)-(p.py[i]??0);
        p.pvx[i]=((p.pvx[i]??0)+dx*ms)*0.84;
        p.pvy[i]=((p.pvy[i]??0)+dy*ms)*0.84;
        p.px[i]=(p.px[i]??0)+(p.pvx[i]??0)*DT;
        p.py[i]=(p.py[i]??0)+(p.pvy[i]??0)*DT;
        p.px[i]=Math.max(0,Math.min(W,p.px[i]??0));
        p.py[i]=Math.max(0,Math.min(H,p.py[i]??0));
        p.palpha[i]=0.9;
      }
    }
    /* ── Text morph ── */
    else if(textTargetsRef.current){
      const tgt=textTargetsRef.current;
      const ms=Math.min(0.06*DT,0.3);
      for(let i=0;i<p.count;i++){
        const tx2=tgt[i*2]??W/2,ty2=tgt[i*2+1]??H/2;
        const dx=tx2-(p.px[i]??0),dy=ty2-(p.py[i]??0);
        p.pvx[i]=((p.pvx[i]??0)+dx*ms)*0.86;
        p.pvy[i]=((p.pvy[i]??0)+dy*ms)*0.86;
        p.px[i]=(p.px[i]??0)+(p.pvx[i]??0)*DT;
        p.py[i]=(p.py[i]??0)+(p.pvy[i]??0)*DT;
        p.px[i]=Math.max(0,Math.min(W,p.px[i]??0));
        p.py[i]=Math.max(0,Math.min(H,p.py[i]??0));
      }
    }
    /* ── Physics modes ── */
    else{
      const mode=store.physicsMode;
      if(mode==="quantum"){
        applyQuantumDrift(p.px,p.py,p.pvx,p.pvy,p.pphase,p.count,DT,
          {G:store.gravityG,k:8.99e9,hbar:1.055,c:299,epsilon0:8.85e-12,mu0:4*Math.PI*1e-7,kB:1.38e-23,dt:DT,substeps:1},W,H);
      }else if(mode==="relativity"){
        applyRelativity(p.px,p.py,p.pvx,p.pvy,p.pm,p.pc,p.palpha,p.count,DT,
          {G:store.gravityG,k:8.99e9,hbar:1.055,c:15,epsilon0:8.85e-12,mu0:4*Math.PI*1e-7,kB:1.38e-23,dt:DT,substeps:1},W,H,500000);
      }else if(mode==="future"){
        applyFuturePhysics(p.px,p.py,p.pvx,p.pvy,p.pm,p.pc,p.pphase,p.count,DT,"dark",simTimeRef.current,W,H);
      }else if(mode==="em"){
        const Bz=0.06,cx=W/2,cy=H/2;
        for(let i=0;i<p.count;i++){
          const q=p.pcharge[i]??0,vx=p.pvx[i]??0,vy=p.pvy[i]??0;
          const Ex=(cx-(p.px[i]??0))*0.002,Ey=(cy-(p.py[i]??0))*0.002;
          p.pvx[i]=(vx+q*(Ex+vy*Bz)/(p.pm[i]??1)*DT)*0.999;
          p.pvy[i]=(vy+q*(Ey-vx*Bz)/(p.pm[i]??1)*DT)*0.999;
          p.px[i]=(p.px[i]??0)+(p.pvx[i]??0)*DT;
          p.py[i]=(p.py[i]??0)+(p.pvy[i]??0)*DT;
          p.px[i]=Math.max(0,Math.min(W,p.px[i]??0));
          p.py[i]=Math.max(0,Math.min(H,p.py[i]??0));
          if((p.px[i]??0)<=0||(p.px[i]??0)>=W)p.pvx[i]=-(p.pvx[i]??0)*0.8;
          if((p.py[i]??0)<=0||(p.py[i]??0)>=H)p.pvy[i]=-(p.pvy[i]??0)*0.8;
          p.pc[i]=(q>0?0.1:0.6)+Math.sqrt((p.pvx[i]??0)**2+(p.pvy[i]??0)**2)*0.07;
        }
      }else{
        // Classical grid gravity
        const G=store.gravityG;
        const cellSize=70,gcx2=Math.ceil(W/cellSize)+1,gcy2=Math.ceil(H/cellSize)+1;
        const cells=gcx2*gcy2;
        const grid=gravityGridRef.current;
        if(grid.cells!==cells){
          grid.cells=cells;
          grid.mass=new Float32Array(cells);
          grid.sumX=new Float32Array(cells);
          grid.sumY=new Float32Array(cells);
        }else{
          grid.mass.fill(0);
          grid.sumX.fill(0);
          grid.sumY.fill(0);
        }
        const gM=grid.mass,gX=grid.sumX,gY=grid.sumY;
        for(let i=0;i<p.count;i++){
          const gx=Math.max(0,Math.min(gcx2-1,Math.floor((p.px[i]??0)/cellSize)));
          const gy=Math.max(0,Math.min(gcy2-1,Math.floor((p.py[i]??0)/cellSize)));
          const gi=gy*gcx2+gx;
          gM[gi]=(gM[gi]??0)+(p.pm[i]??1);gX[gi]=(gX[gi]??0)+(p.px[i]??0)*(p.pm[i]??1);gY[gi]=(gY[gi]??0)+(p.py[i]??0)*(p.pm[i]??1);
        }
        for(let i=0;i<p.count;i++){
          let ax=0,ay=0;
          const gxi=Math.floor((p.px[i]??0)/cellSize),gyi=Math.floor((p.py[i]??0)/cellSize);
          for(let dgx=-2;dgx<=2;dgx++)for(let dgy=-2;dgy<=2;dgy++){
            const nx2=gxi+dgx,ny2=gyi+dgy;
            if(nx2<0||nx2>=gcx2||ny2<0||ny2>=gcy2)continue;
            const gi=ny2*gcx2+nx2,mass=gM[gi]??0;
            if(mass<0.001)continue;
            const cmx=(gX[gi]??0)/mass,cmy=(gY[gi]??0)/mass;
            const dx=cmx-(p.px[i]??0),dy=cmy-(p.py[i]??0);
            const r2=dx*dx+dy*dy+200,r=Math.sqrt(r2);
            const f=G*mass/r2;ax+=f*dx/r;ay+=f*dy/r;
          }
          const dcx=W/2-(p.px[i]??0),dcy=H/2-(p.py[i]??0);
          const rc2=dcx*dcx+dcy*dcy+400;
          ax+=G*0.4*dcx/rc2;ay+=G*0.4*dcy/rc2;
          p.pvx[i]=((p.pvx[i]??0)+ax*DT)*0.9998;
          p.pvy[i]=((p.pvy[i]??0)+ay*DT)*0.9998;
          p.px[i]=(p.px[i]??0)+(p.pvx[i]??0)*DT;
          p.py[i]=(p.py[i]??0)+(p.pvy[i]??0)*DT;
          if((p.px[i]??0)<0)p.px[i]=W;else if((p.px[i]??0)>W)p.px[i]=0;
          if((p.py[i]??0)<0)p.py[i]=H;else if((p.py[i]??0)>H)p.py[i]=0;
          p.pc[i]=Math.min(1,Math.sqrt((p.pvx[i]??0)**2+(p.pvy[i]??0)**2)*0.15);
        }
      }
    }

    /* ── Render ───────────────────────────────────────────────────────── */
    const{ctx:oc,buf}=off;
    oc.fillStyle=`rgba(2,5,9,${Math.max(0.03, 1-store.trailDecay)})`;
    oc.fillRect(0,0,W,H);

    let gradients = gradientCacheRef.current;
    if(!gradients || gradients.w !== W || gradients.h !== H){
      const atmosphere = oc.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.08, W * 0.5, H * 0.5, Math.min(W, H) * 0.78);
      atmosphere.addColorStop(0, "rgba(0,255,210,0.05)");
      atmosphere.addColorStop(0.35, "rgba(0,180,255,0.03)");
      atmosphere.addColorStop(0.7, "rgba(7,29,52,0.02)");
      atmosphere.addColorStop(1, "rgba(0,0,0,0)");

      const grade = oc.createLinearGradient(0, 0, 0, H);
      grade.addColorStop(0, "rgba(0,20,35,0.08)");
      grade.addColorStop(1, "rgba(0,4,10,0.18)");

      const vignette = oc.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.32, W * 0.5, H * 0.5, Math.min(W, H) * 0.72);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.62)");

      gradients = { atmosphere, grade, vignette, w: W, h: H };
      gradientCacheRef.current = gradients;
    }

    oc.fillStyle = gradients.atmosphere;
    oc.fillRect(0, 0, W, H);

    const ambient = ambientRef.current;
    if (ambient) {
      const ambientStep = p.count > 140000 ? 3 : p.count > 90000 ? 2 : 1;
      oc.save();
      oc.globalCompositeOperation = "lighter";
      for (let i = 0; i < ambient.count; i += ambientStep) {
        let x = ambient.x[i] ?? 0;
        let y = ambient.y[i] ?? 0;
        const driftX = (ambient.vx[i] ?? 0) + Math.sin(simTimeRef.current * 0.1 + i * 0.021) * 0.005;
        const driftY = (ambient.vy[i] ?? 0) + Math.cos(simTimeRef.current * 0.09 + i * 0.017) * 0.005;
        x += driftX * DT * 0.35;
        y += driftY * DT * 0.35;
        if (x < -6) x = W + 6;
        else if (x > W + 6) x = -6;
        if (y < -6) y = H + 6;
        else if (y > H + 6) y = -6;
        ambient.x[i] = x;
        ambient.y[i] = y;

        const hue = ambient.hue[i] ?? 0;
        const r = Math.round(24 + hue * 60);
        const g = Math.round(88 + hue * 140);
        const b = Math.round(158 + hue * 95);
        const a = (ambient.alpha[i] ?? 0.1) * (0.6 + 0.4 * Math.sin(simTimeRef.current * 0.4 + i * 0.013));
        const s = ambient.size[i] ?? 1;

        oc.fillStyle = `rgba(${r},${g},${b},${a * 0.35})`;
        oc.beginPath();
        oc.arc(x, y, s, 0, Math.PI * 2);
        oc.fill();
      }
      oc.restore();
    }

    const sz=store.particleSize;
    const tuning=renderTuningRef.current;
    const bm=store.bloomIntensity*tuning.glow;
    const useImgColor=imgModeRef.current&&!!imgColorsRef.current;
    const imgC=imgColorsRef.current;
    const customPalette=customPaletteRef.current;
    const shapeDensity = shapeModeRef.current ? clamp(24000 / Math.max(9000, p.count), 0.32, 1) : 1;
    const shapeSizeFactor = shapeModeRef.current ? (0.5 + shapeDensity * 0.42) : 1;
    const shapeAlphaFactor = shapeModeRef.current ? (0.38 + shapeDensity * 0.44) : 1;
    const luminanceCap = shapeModeRef.current ? 188 : 224;

    let colorTable: Uint8Array | null = null;
    if(!useImgColor){
      const lutKey = customPalette.enabled
        ? `custom:${customPalette.start.join("-")}:${customPalette.end.join("-")}:${tuning.brightness.toFixed(3)}:${luminanceCap}`
        : `${store.colormap}:${tuning.brightness.toFixed(3)}:${luminanceCap}`;
      if(!colorLutRef.current || colorLutRef.current.key !== lutKey){
        const table = new Uint8Array(256 * 3);
        const cm=CMAPS[store.colormap]??CMAPS["viridis"]!;
        for(let i=0;i<256;i++){
          const t = i / 255;
          let r:number;
          let g:number;
          let b:number;
          if(customPalette.enabled){
            [r,g,b]=lerpRgb(customPalette.start,customPalette.end,t);
          }else{
            [r,g,b]=cm(t);
          }
          r=clamp(Math.round(r*tuning.brightness),0,255);
          g=clamp(Math.round(g*tuning.brightness),0,255);
          b=clamp(Math.round(b*tuning.brightness),0,255);
          [r,g,b]=limitLuma(r,g,b,luminanceCap);
          const o=i*3;
          table[o]=r;
          table[o+1]=g;
          table[o+2]=b;
        }
        colorLutRef.current = { key: lutKey, table };
      }
      colorTable = colorLutRef.current.table;
    }

    const { particleCtx: pc, particleBuf, blurCtx, blurBuf } = layers;
    const particleComposite = (shapeModeRef.current || imgModeRef.current) ? "source-over" : "lighter";
    const styleCache = styleCacheRef.current;
    styleCache.clear();

    pc.clearRect(0, 0, W, H);
    pc.save();
    pc.globalCompositeOperation = particleComposite;

    for(let i=0;i<p.count;i++){
      const x=p.px[i]??0,y=p.py[i]??0;
      if(x<-8||x>W+8||y<-8||y>H+8) continue;

      let r:number,g:number,b:number;
      if(useImgColor&&imgC){
        r=imgC.r[i]??128; g=imgC.g[i]??128; b=imgC.b[i]??128;
      }else{
        const ti = Math.min(255, Math.max(0, Math.round((p.pc[i] ?? 0) * 255))) * 3;
        r=colorTable?.[ti]??128;
        g=colorTable?.[ti+1]??128;
        b=colorTable?.[ti+2]??128;
      }
      const baseA=Math.min(1,Math.max(0,p.palpha[i]??0.8));
      const a=Math.min(0.92,baseA*shapeAlphaFactor);
      const mass=p.pm[i]??1;
      const speed=Math.sqrt((p.pvx[i]??0)**2+(p.pvy[i]??0)**2);
      const s=imgModeRef.current
        ? Math.max(0.42,(p.psize[i]??1)*0.9*sz*0.72)
        : sz*(0.34 + (p.psize[i] ?? 1) * 0.95 + mass * 0.18 + Math.min(0.7, speed * 0.08))*shapeSizeFactor;

      const drawAlpha = clamp(a, 0, 1);
      if (drawAlpha <= 0.01) continue;
      const alphaByte = Math.round(drawAlpha * 255);
      const styleKey = (r << 24) | (g << 16) | (b << 8) | alphaByte;
      let style = styleCache.get(styleKey);
      if(!style){
        style = `rgba(${r},${g},${b},${drawAlpha})`;
        styleCache.set(styleKey, style);
      }
      pc.fillStyle = style;

      if(s <= 1.1){
        const q = Math.max(0.5, s);
        pc.fillRect(x - q * 0.5, y - q * 0.5, q, q);
      }else{
        pc.beginPath();
        pc.arc(x, y, s, 0, Math.PI * 2);
        pc.fill();
      }
    }

    pc.restore();

    oc.save();
    oc.globalCompositeOperation = particleComposite;
    oc.drawImage(particleBuf,0,0,W,H);
    oc.restore();

    // Screen-space bloom is far cheaper than per-particle radial gradients.
    if(!imgModeRef.current && bm>0.01){
      blurCtx.clearRect(0,0,W,H);
      blurCtx.drawImage(particleBuf,0,0,W,H);

      const blurBase = 0.75 + bm * 2.6;
      oc.save();
      oc.globalCompositeOperation = "lighter";
      oc.filter = `blur(${blurBase.toFixed(2)}px)`;
      oc.globalAlpha = clamp(0.14 + bm * 0.34, 0, 0.82);
      oc.drawImage(blurBuf,0,0,W,H);
      if(bm>0.55){
        oc.filter = `blur(${(blurBase * 1.9).toFixed(2)}px)`;
        oc.globalAlpha = clamp(0.05 + bm * 0.16, 0, 0.42);
        oc.drawImage(blurBuf,0,0,W,H);
      }
      oc.restore();
    }

    oc.fillStyle = gradients.grade;
    oc.fillRect(0, 0, W, H);

    oc.fillStyle = gradients.vignette;
    oc.fillRect(0, 0, W, H);

    // Overlays
    if(store.activePreset==="doubleslit"){
      oc.strokeStyle="rgba(143,245,255,0.1)";oc.lineWidth=3;
      oc.strokeRect(W/2-5,0,10,H/2-40);oc.strokeRect(W/2-5,H/2+40,10,H/2-40);
      oc.fillStyle="rgba(255,201,101,0.05)";oc.fillRect(W/2-5,H/2-38,10,76);
    }
    if(store.activePreset==="blackhole"){
      const grd3=oc.createRadialGradient(W/2,H/2,0,W/2,H/2,55);
      grd3.addColorStop(0,"rgba(0,0,0,1)");grd3.addColorStop(1,"rgba(0,0,0,0)");
      oc.fillStyle=grd3;oc.beginPath();oc.arc(W/2,H/2,55,0,Math.PI*2);oc.fill();
    }
    // Mouse force ring
    if(forceActive){
      const{x:mx,y:my}=mouseRef.current;
      const fm=forceModeRef.current;
      const[cr,cg,cb]=fm==="orbit"?[172,137,255]:fm==="repel"?[172,137,255]:[143,245,255];
      const ringRadius=store.forceRadius*(hoverForceActive?cursorFieldRef.current.radius:1);
      const mgrd=oc.createRadialGradient(mx,my,0,mx,my,ringRadius);
      mgrd.addColorStop(0,`rgba(${cr},${cg},${cb},0.15)`);mgrd.addColorStop(1,"transparent");
      oc.fillStyle=mgrd;oc.beginPath();oc.arc(mx,my,ringRadius,0,Math.PI*2);oc.fill();
      oc.strokeStyle=`rgba(${cr},${cg},${cb},0.25)`;oc.lineWidth=1;
      oc.beginPath();oc.arc(mx,my,ringRadius,0,Math.PI*2);oc.stroke();
    }

    // Blit to screen — no globalCompositeOperation changes to avoid flicker
    screenCtx.clearRect(0,0,canvas.width,canvas.height);
    screenCtx.drawImage(buf,0,0,canvas.width,canvas.height);

    // Stats update (every ~30 frames)
    const fpsCtr=fpsRef.current;
    fpsCtr.frames++;fpsCtr.acc+=dt;
    if(fpsCtr.acc>=30){
      const fps2=Math.round(fpsCtr.frames/(fpsCtr.acc/60));
      fpsCtr.fps=fps2;fpsCtr.frames=0;fpsCtr.acc=0;
      store.setFps(fps2);
      let ke=0;const sm=Math.min(p.count,300);
      for(let i=0;i<sm;i++) ke+=0.5*(p.pm[i]??1)*((p.pvx[i]??0)**2+(p.pvy[i]??0)**2);
      const keRounded=Math.round(ke*(p.count/sm));
      store.setKineticEnergy(keRounded);
      store.incrementSimTime(1);
      const cnt=p.count.toLocaleString();
      ["s-count","hud-count"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=cnt;});
      ["s-fps","hud-fps"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=String(fps2);});
      const keStr=keRounded.toLocaleString();
      ["s-ke","hud-ke"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=keStr;});
      const tStr=simTimeRef.current.toFixed(1)+"s";
      ["s-time","hud-time"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=tStr;});
    }
  },[refreshCursor]);// eslint-disable-line

  useAnimationFrame({onFrame,enabled:isRunning});

  return{
    mouseRef,
    reinit:(name:string)=>initPreset(name),
    explode:()=>{const p=pRef.current;if(!p)return;for(let i=0;i<p.count;i++){p.pvx[i]=(p.pvx[i]??0)+(Math.random()-0.5)*24;p.pvy[i]=(p.pvy[i]??0)+(Math.random()-0.5)*24;}},
  };
}
