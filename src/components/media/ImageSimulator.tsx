/**
 * @fileoverview Media uploader for image/video/json/bim/ifc to particle simulation.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { validateImageUpload } from "@/lib/security";

interface ImageSimulatorProps {
  canvasW?: number;
  canvasH?: number;
}

interface CloudPoint {
  x: number;
  y: number;
  z?: number;
  r?: number;
  g?: number;
  b?: number;
  a?: number;
  mass?: number;
}

interface ImageTransformState {
  zoom: number;
  rotateDeg: number;
  tiltDeg: number;
  panX: number;
  panY: number;
}

const DEFAULT_TRANSFORM: ImageTransformState = {
  zoom: 1,
  rotateDeg: 0,
  tiltDeg: 0,
  panX: 0,
  panY: 0,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function getFileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function mapPointsToCloud(points: CloudPoint[], canvasW: number, canvasH: number) {
  if (points.length === 0) {
    throw new Error("No usable points were found in the file");
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    const z = p.z ?? 0;
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }

  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const spanZ = Math.max(1e-6, maxZ - minZ);
  const pad = 0.08;
  const outW = canvasW * (1 - pad * 2);
  const outH = canvasH * (1 - pad * 2);

  const count = points.length;
  const positions = new Float32Array(count * 2);
  const colors = new Float32Array(count * 4);
  const masses = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const p = points[i]!;
    const nx = (p.x - minX) / spanX;
    const ny = (p.y - minY) / spanY;
    const nz = ((p.z ?? 0) - minZ) / spanZ;

    positions[i * 2] = canvasW * pad + nx * outW;
    positions[i * 2 + 1] = canvasH * pad + ny * outH;

    if (
      Number.isFinite(p.r) &&
      Number.isFinite(p.g) &&
      Number.isFinite(p.b)
    ) {
      const rr = p.r! > 1 ? p.r! / 255 : p.r!;
      const gg = p.g! > 1 ? p.g! / 255 : p.g!;
      const bb = p.b! > 1 ? p.b! / 255 : p.b!;
      colors[i * 4] = clamp(rr, 0, 1);
      colors[i * 4 + 1] = clamp(gg, 0, 1);
      colors[i * 4 + 2] = clamp(bb, 0, 1);
    } else {
      colors[i * 4] = clamp(0.25 + 0.65 * nz, 0, 1);
      colors[i * 4 + 1] = clamp(0.35 + 0.45 * (1 - nz), 0, 1);
      colors[i * 4 + 2] = clamp(0.7 + 0.25 * nz, 0, 1);
    }
    colors[i * 4 + 3] = clamp(p.a ?? 1, 0.15, 1);
    masses[i] = clamp(p.mass ?? 0.6 + nz * 1.2, 0.08, 8);
  }

  return { positions, colors, masses, count };
}

function toPointArray(input: unknown): CloudPoint[] {
  if (!Array.isArray(input)) return [];
  const points: CloudPoint[] = [];

  for (const row of input) {
    if (Array.isArray(row) && row.length >= 2) {
      const x = Number(row[0]);
      const y = Number(row[1]);
      const z = Number(row[2] ?? 0);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        points.push({ x, y, z });
      }
      continue;
    }

    if (row && typeof row === "object") {
      const obj = row as Record<string, unknown>;
      const x = Number(obj.x);
      const y = Number(obj.y);
      const z = Number(obj.z ?? 0);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      const point: CloudPoint = { x, y, z };
      if (Number.isFinite(Number(obj.r))) point.r = Number(obj.r);
      if (Number.isFinite(Number(obj.g))) point.g = Number(obj.g);
      if (Number.isFinite(Number(obj.b))) point.b = Number(obj.b);
      if (Number.isFinite(Number(obj.a))) point.a = Number(obj.a);
      if (Number.isFinite(Number(obj.mass))) point.mass = Number(obj.mass);
      points.push(point);
    }
  }

  return points;
}

function parseTriplesFromText(raw: string, limit = 40000): CloudPoint[] {
  const ifcMatches = [...raw.matchAll(/IFCCARTESIANPOINT\s*\(\(\s*([-+0-9.eE]+)\s*,\s*([-+0-9.eE]+)\s*,\s*([-+0-9.eE]+)\s*\)\)/gi)];
  const triples: CloudPoint[] = [];

  if (ifcMatches.length > 0) {
    const stride = Math.max(1, Math.floor(ifcMatches.length / limit));
    for (let i = 0; i < ifcMatches.length; i += stride) {
      const m = ifcMatches[i]!;
      const x = Number(m[1]);
      const y = Number(m[2]);
      const z = Number(m[3]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        triples.push({ x, y, z });
      }
      if (triples.length >= limit) break;
    }
    return triples;
  }

  const numeric = raw.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const maxValues = Math.min(numeric.length - (numeric.length % 3), limit * 3);
  for (let i = 0; i + 2 < maxValues; i += 3) {
    const x = Number(numeric[i]);
    const y = Number(numeric[i + 1]);
    const z = Number(numeric[i + 2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      triples.push({ x, y, z });
    }
  }
  return triples;
}

export default function ImageSimulator({ canvasW = 800, canvasH = 600 }: ImageSimulatorProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [targetCount, setTargetCount] = useState(18000);
  const [transform, setTransform] = useState<ImageTransformState>(DEFAULT_TRANSFORM);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("qf:imageTransform", { detail: transform }));
  }, [transform]);

  useEffect(() => {
    if (!isVideo || !preview) return;

    if (!streamCanvasRef.current) {
      streamCanvasRef.current = document.createElement("canvas");
    }
    const canvas = streamCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let lastTs = 0;
    const loop = (ts: number) => {
      frameRef.current = requestAnimationFrame(loop);
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      if (ts - lastTs < 1000 / 24) return;
      lastTs = ts;

      const vW = v.videoWidth || 320;
      const vH = v.videoHeight || 240;
      const scale = Math.min(220 / vW, 220 / vH, 1);
      const w = Math.max(2, Math.floor(vW * scale));
      const h = Math.max(2, Math.floor(vH * scale));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      ctx.drawImage(v, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      window.dispatchEvent(
        new CustomEvent("qf:imageData", {
          detail: {
            data: imageData,
            w,
            h,
            stream: true,
            exact: false,
            targetCount: Math.min(targetCount, 16000),
          },
        })
      );
    };

    window.dispatchEvent(new CustomEvent("qf:shapeChanged", { detail: "image" }));
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isVideo, preview, targetCount]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const setNextPreview = useCallback((url: string | null) => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const loadImageAsImageData = useCallback(async (file: File) => {
    const validation = await validateImageUpload(file, 50 * 1024 * 1024);
    if (!validation.valid) {
      throw new Error(validation.error ?? "Invalid image file");
    }

    const url = URL.createObjectURL(file);
    setNextPreview(url);
    setIsVideo(false);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.src = url;
    });

    const scale = Math.min(canvasW / Math.max(1, img.width), canvasH / Math.max(1, img.height), 1);
    const w = Math.max(2, Math.floor(img.width * scale));
    const h = Math.max(2, Math.floor(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Canvas 2D context is not available");
    }
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);

    window.dispatchEvent(new CustomEvent("qf:shapeChanged", { detail: "image" }));
    window.dispatchEvent(
      new CustomEvent("qf:imageData", {
        detail: {
          data,
          w,
          h,
          exact: false,
          targetCount,
        },
      })
    );
  }, [canvasH, canvasW, setNextPreview, targetCount]);

  const loadJson = useCallback(async (file: File) => {
    const raw = await file.text();
    const parsed = JSON.parse(raw) as unknown;

    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const width = Number(record.width);
      const height = Number(record.height);
      const flat = record.data;
      if (
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 1 &&
        height > 1 &&
        Array.isArray(flat)
      ) {
        const expected = Math.floor(width) * Math.floor(height) * 4;
        if (flat.length >= expected) {
          const rgba = new Uint8ClampedArray(expected);
          for (let i = 0; i < expected; i++) {
            rgba[i] = clamp(Number(flat[i] ?? 0), 0, 255);
          }
          const imageData = new ImageData(rgba, Math.floor(width), Math.floor(height));
          window.dispatchEvent(new CustomEvent("qf:shapeChanged", { detail: "image" }));
          window.dispatchEvent(
            new CustomEvent("qf:imageData", {
              detail: {
                data: imageData,
                w: Math.floor(width),
                h: Math.floor(height),
                exact: false,
                targetCount,
              },
            })
          );
          return;
        }
      }

      const directPoints = toPointArray(parsed);
      const objectPoints = toPointArray(record.points);
      const particlePoints = toPointArray(record.particles);
      const points = directPoints.length > 0
        ? directPoints
        : objectPoints.length > 0
          ? objectPoints
          : particlePoints;
      if (points.length > 0) {
        const cloud = mapPointsToCloud(points, canvasW, canvasH);
        window.dispatchEvent(new CustomEvent("qf:particleCloud", { detail: cloud }));
        return;
      }
    }

    throw new Error("JSON format not recognized. Use width/height/data or points[]");
  }, [canvasH, canvasW, targetCount]);

  const loadModelTextAsCloud = useCallback(async (file: File) => {
    const raw = await file.text();
    const points = parseTriplesFromText(raw, 35000);
    if (points.length < 16) {
      throw new Error("No geometry points detected in model file");
    }
    const cloud = mapPointsToCloud(points, canvasW, canvasH);
    window.dispatchEvent(new CustomEvent("qf:particleCloud", { detail: cloud }));
  }, [canvasH, canvasW]);

  const handleFile = useCallback(async (file: File) => {
    setStatus("loading");
    setError(null);

    try {
      const ext = getFileExtension(file.name);
      const isVideoFile = file.type.startsWith("video/") || ext === "mp4" || ext === "webm";
      const isImageFile = file.type.startsWith("image/");
      const isJson = file.type === "application/json" || ext === "json";
      const isModel = ext === "bim" || ext === "ifc";

      if (isVideoFile) {
        setIsVideo(true);
        setNextPreview(URL.createObjectURL(file));
        window.dispatchEvent(new CustomEvent("qf:shapeChanged", { detail: "image" }));
        setStatus("ready");
        return;
      }

      if (isImageFile) {
        await loadImageAsImageData(file);
        setStatus("ready");
        return;
      }

      if (isJson) {
        setIsVideo(false);
        setNextPreview(null);
        await loadJson(file);
        setStatus("ready");
        return;
      }

      if (isModel) {
        setIsVideo(false);
        setNextPreview(null);
        await loadModelTextAsCloud(file);
        setStatus("ready");
        return;
      }

      throw new Error("Unsupported file type. Use image, video, json, bim, or ifc");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unable to process file");
    }
  }, [loadImageAsImageData, loadJson, loadModelTextAsCloud, setNextPreview]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const previewTransform = useMemo(() => {
    const { panX, panY, zoom, rotateDeg, tiltDeg } = transform;
    return `translate(${panX}px, ${panY}px) scale(${zoom}) rotate(${rotateDeg}deg) skewX(${tiltDeg * 0.2}deg)`;
  }, [transform]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} role="region" aria-label="Media to particles uploader">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1px dashed ${status === "ready" ? "rgba(0,212,255,0.55)" : "rgba(120,145,205,0.3)"}`,
          borderRadius: 7,
          minHeight: 84,
          background: "rgba(0,212,255,0.03)",
          cursor: "pointer",
          overflow: "hidden",
          position: "relative",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: "12px 10px",
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload media"
        onKeyDown={(e) => {
          if (e.key === "Enter") inputRef.current?.click();
        }}
      >
        {preview && !isVideo && (
          <img
            src={preview}
            alt="Media preview"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: 0.2,
              transform: previewTransform,
              transformOrigin: "center center",
              pointerEvents: "none",
            }}
          />
        )}
        {preview && isVideo && (
          <video
            ref={videoRef}
            src={preview}
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: 0.2,
              transform: previewTransform,
              transformOrigin: "center center",
              pointerEvents: "none",
            }}
          />
        )}

        <div style={{ position: "relative", zIndex: 1 }}>
          {status === "loading" && <div style={{ fontSize: 11, color: "#ffd166" }}>Processing media...</div>}
          {status === "ready" && <div style={{ fontSize: 11, color: "#00d4ff" }}>Particles updated. Upload again to replace.</div>}
          {status !== "loading" && status !== "ready" && (
            <>
              <div style={{ fontSize: 11, color: "#7080a8" }}>Drop or click to upload</div>
              <div style={{ fontSize: 9, color: "#4a5480", marginTop: 4 }}>
                PNG JPG WEBP GIF SVG MP4 WEBM JSON BIM IFC
              </div>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,application/json,.json,.bim,.ifc"
          onChange={handleInput}
          style={{ display: "none" }}
          aria-label="Upload media"
        />
      </div>

      {error && (
        <div
          style={{
            fontSize: 10,
            color: "#ff6b35",
            padding: "6px 8px",
            borderRadius: 5,
            border: "1px solid rgba(255,107,53,0.32)",
            background: "rgba(255,107,53,0.08)",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
        <label style={{ fontSize: 10, color: "#7080a8" }}>Target particles</label>
        <span style={{ fontSize: 10, color: "#00d4ff", fontFamily: "monospace" }}>{targetCount.toLocaleString()}</span>
      </div>
      <input
        type="range"
        min={2000}
        max={100000}
        step={1000}
        value={targetCount}
        onChange={(e) => setTargetCount(parseInt(e.target.value, 10))}
        aria-label="Target particle count"
      />

      <div style={{ marginTop: 4, borderTop: "1px solid rgba(143,245,255,0.14)", paddingTop: 8 }}>
        <div style={{ fontSize: 10, color: "#8ab8d0", marginBottom: 6 }}>Image transform controls</div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ display: "grid", gridTemplateColumns: "70px 1fr 52px", gap: 8, alignItems: "center", fontSize: 10, color: "#7080a8" }}>
            Zoom
            <input
              type="range"
              min={0.2}
              max={3}
              step={0.01}
              value={transform.zoom}
              onChange={(e) => setTransform((t) => ({ ...t, zoom: Number(e.target.value) }))}
            />
            <span style={{ color: "#00d4ff", fontFamily: "monospace" }}>{transform.zoom.toFixed(2)}x</span>
          </label>

          <label style={{ display: "grid", gridTemplateColumns: "70px 1fr 52px", gap: 8, alignItems: "center", fontSize: 10, color: "#7080a8" }}>
            Rotate
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={transform.rotateDeg}
              onChange={(e) => setTransform((t) => ({ ...t, rotateDeg: Number(e.target.value) }))}
            />
            <span style={{ color: "#00d4ff", fontFamily: "monospace" }}>{Math.round(transform.rotateDeg)}d</span>
          </label>

          <label style={{ display: "grid", gridTemplateColumns: "70px 1fr 52px", gap: 8, alignItems: "center", fontSize: 10, color: "#7080a8" }}>
            Axis tilt
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={transform.tiltDeg}
              onChange={(e) => setTransform((t) => ({ ...t, tiltDeg: Number(e.target.value) }))}
            />
            <span style={{ color: "#00d4ff", fontFamily: "monospace" }}>{Math.round(transform.tiltDeg)}d</span>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 10, color: "#7080a8" }}>
              Pan X
              <input
                type="range"
                min={-220}
                max={220}
                step={1}
                value={transform.panX}
                onChange={(e) => setTransform((t) => ({ ...t, panX: Number(e.target.value) }))}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 10, color: "#7080a8" }}>
              Pan Y
              <input
                type="range"
                min={-220}
                max={220}
                step={1}
                value={transform.panY}
                onChange={(e) => setTransform((t) => ({ ...t, panY: Number(e.target.value) }))}
              />
            </label>
          </div>

          <button
            onClick={() => setTransform(DEFAULT_TRANSFORM)}
            style={{
              marginTop: 2,
              border: "1px solid rgba(143,245,255,0.25)",
              background: "rgba(143,245,255,0.07)",
              color: "#8ff5ff",
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              borderRadius: 4,
              padding: "6px 8px",
              cursor: "pointer",
            }}
          >
            Reset transform
          </button>
        </div>
      </div>
    </div>
  );
}
