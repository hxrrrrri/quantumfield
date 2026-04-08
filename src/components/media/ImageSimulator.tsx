/**
 * @fileoverview Image → Particles upload component.
 * Accepts image files, converts to particle array, hands off to engine.
 */
"use client";

import { useState, useCallback, useRef } from "react";
import { validateImageUpload } from "@/lib/security";
import { fileToParticles } from "@/lib/imageToParticles";
import type { ImageParticleOptions } from "@/types";

interface ImageSimulatorProps {
  onParticlesReady?: (
    positions: Float32Array,
    colors: Float32Array,
    masses: Float32Array,
    count: number
  ) => void;
  canvasW?: number;
  canvasH?: number;
}

export default function ImageSimulator({
  onParticlesReady,
  canvasW = 800,
  canvasH = 600,
}: ImageSimulatorProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [particleCount, setParticleCount] = useState(20000);
  const [samplingMode, setSamplingMode] = useState<"grid" | "poisson">("grid");
  const [colorFromImage, setColorFromImage] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setStatus("loading");

      const validation = await validateImageUpload(file);
      if (!validation.valid) {
        setError(validation.error ?? "Invalid file");
        setStatus("error");
        return;
      }

      const url = URL.createObjectURL(file);
      setPreview(url);

      try {
        const options: ImageParticleOptions = {
          density: particleCount,
          samplingMode,
          colorFromImage,
          massFromLuminance: true,
        };
        const result = await fileToParticles(file, options, particleCount, canvasW, canvasH);
        setStatus("ready");
        onParticlesReady?.(result.positions, result.colors, result.masses, result.count);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Processing failed");
        setStatus("error");
      }
    },
    [particleCount, samplingMode, colorFromImage, canvasW, canvasH, onParticlesReady]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  return (
    <div style={{ padding: "0 0 8px" }} role="region" aria-label="Image to particles converter">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1px dashed ${status === "ready" ? "rgba(0,212,255,0.5)" : "rgba(100,120,255,0.25)"}`,
          borderRadius: 6,
          padding: "12px 8px",
          textAlign: "center",
          cursor: "pointer",
          background: "rgba(0,212,255,0.03)",
          marginBottom: 8,
          position: "relative",
          overflow: "hidden",
          minHeight: 70,
          transition: "border-color 0.2s",
        }}
        role="button"
        tabIndex={0}
        aria-label="Drop image or click to upload"
        onKeyDown={(e) => { if (e.key === "Enter") inputRef.current?.click(); }}
      >
        {preview && (
          <img
            src={preview}
            alt="Preview"
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", opacity: 0.15,
            }}
          />
        )}
        <div style={{ position: "relative", zIndex: 1 }}>
          {status === "loading" ? (
            <div style={{ fontSize: 11, color: "#ffd166" }}>⟳ Processing...</div>
          ) : status === "ready" ? (
            <div style={{ fontSize: 11, color: "#00d4ff" }}>✓ Particles ready — click to reload</div>
          ) : (
            <>
              <div style={{ fontSize: 18, marginBottom: 4 }}>🖼</div>
              <div style={{ fontSize: 10, color: "#7080a8" }}>Drop image or click to upload</div>
              <div style={{ fontSize: 9, color: "#4a5480", marginTop: 2 }}>PNG, JPG, WebP, GIF, SVG · max 10MB</div>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          onChange={handleChange}
          style={{ display: "none" }}
          aria-label="Upload image file"
        />
      </div>

      {error && (
        <div style={{ fontSize: 10, color: "#ff6b35", marginBottom: 6, padding: "4px 6px", background: "rgba(255,107,53,0.08)", borderRadius: 4 }}>
          {error}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "#7080a8" }}>Density</span>
          <span style={{ fontSize: 10, color: "#00d4ff", fontFamily: "monospace" }}>{particleCount.toLocaleString()}</span>
        </div>
        <input
          type="range" min={1000} max={100000} step={1000}
          value={particleCount}
          onChange={(e) => setParticleCount(parseInt(e.target.value, 10))}
          aria-label="Particle density"
        />

        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setSamplingMode("grid")}
            style={{
              flex: 1, fontSize: 9, padding: "4px", borderRadius: 4, cursor: "pointer",
              border: `0.5px solid ${samplingMode === "grid" ? "rgba(0,212,255,0.5)" : "rgba(100,120,255,0.2)"}`,
              color: samplingMode === "grid" ? "#00d4ff" : "#7080a8",
              background: samplingMode === "grid" ? "rgba(0,212,255,0.06)" : "transparent",
            }}
            aria-pressed={samplingMode === "grid"}
          >
            Grid
          </button>
          <button
            onClick={() => setSamplingMode("poisson")}
            style={{
              flex: 1, fontSize: 9, padding: "4px", borderRadius: 4, cursor: "pointer",
              border: `0.5px solid ${samplingMode === "poisson" ? "rgba(0,212,255,0.5)" : "rgba(100,120,255,0.2)"}`,
              color: samplingMode === "poisson" ? "#00d4ff" : "#7080a8",
              background: samplingMode === "poisson" ? "rgba(0,212,255,0.06)" : "transparent",
            }}
            aria-pressed={samplingMode === "poisson"}
          >
            Poisson
          </button>
          <button
            onClick={() => setColorFromImage((v) => !v)}
            style={{
              flex: 1, fontSize: 9, padding: "4px", borderRadius: 4, cursor: "pointer",
              border: `0.5px solid ${colorFromImage ? "rgba(255,209,102,0.5)" : "rgba(100,120,255,0.2)"}`,
              color: colorFromImage ? "#ffd166" : "#7080a8",
              background: colorFromImage ? "rgba(255,209,102,0.06)" : "transparent",
            }}
            aria-pressed={colorFromImage}
          >
            Color
          </button>
        </div>
      </div>
    </div>
  );
}
