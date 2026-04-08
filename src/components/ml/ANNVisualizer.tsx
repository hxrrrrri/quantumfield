/**
 * @fileoverview ANN Visualizer — renders a neural network as a particle simulation.
 * Neurons are particle clusters. Forward pass = activation wave. Backprop = red stream.
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Layer {
  size: number;
  activation: "relu" | "sigmoid" | "tanh" | "gelu";
}

interface ANNVisualizerProps {
  layers?: Layer[];
  learningRate?: number;
  width?: number;
  height?: number;
}

interface Neuron {
  x: number;
  y: number;
  activation: number;
  layer: number;
  index: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function relu(x: number): number {
  return Math.max(0, x);
}

function tanh(x: number): number {
  return Math.tanh(x);
}

function gelu(x: number): number {
  return x * 0.5 * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
}

const ACTIVATION_FNS: Record<string, (x: number) => number> = {
  relu, sigmoid, tanh, gelu,
};

export default function ANNVisualizer({
  layers = [
    { size: 4, activation: "relu" },
    { size: 6, activation: "relu" },
    { size: 6, activation: "tanh" },
    { size: 3, activation: "sigmoid" },
  ],
  learningRate = 0.01,
  width = 600,
  height = 400,
}: ANNVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const simTimeRef = useRef(0);
  const [lossHistory, setLossHistory] = useState<number[]>([]);
  const [isForwardPass, setIsForwardPass] = useState(true);
  const weightsRef = useRef<number[][][]>([]);

  // Initialize weights
  useEffect(() => {
    const weights: number[][][] = [];
    for (let l = 0; l < layers.length - 1; l++) {
      const w: number[][] = [];
      for (let i = 0; i < (layers[l]?.size ?? 0); i++) {
        const row: number[] = [];
        for (let j = 0; j < (layers[l + 1]?.size ?? 0); j++) {
          row.push((Math.random() - 0.5) * 2 / Math.sqrt(layers[l]?.size ?? 1));
        }
        w.push(row);
      }
      weights.push(w);
    }
    weightsRef.current = weights;
  }, [layers]);

  // Build neuron positions
  const buildNeurons = useCallback((): Neuron[] => {
    const neurons: Neuron[] = [];
    const lx = layers.map((_, i) => 60 + (i / (layers.length - 1)) * (width - 120));
    for (let l = 0; l < layers.length; l++) {
      const n = layers[l]?.size ?? 0;
      for (let j = 0; j < n; j++) {
        neurons.push({
          x: lx[l] ?? 0,
          y: height / 2 + (j - (n - 1) / 2) * (height * 0.12),
          activation: 0,
          layer: l,
          index: j,
        });
      }
    }
    return neurons;
  }, [layers, width, height]);

  // Draw frame
  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    simTimeRef.current = t;
    ctx.fillStyle = "rgba(3,4,10,0.3)";
    ctx.fillRect(0, 0, width, height);

    const neurons = buildNeurons();
    const forwardPhase = (t * 0.0015) % 1;
    const backPhase = ((t * 0.0015) % 1 + 0.5) % 1;

    // Draw connections
    for (let l = 0; l < layers.length - 1; l++) {
      const layerNeurons = neurons.filter((n) => n.layer === l);
      const nextNeurons = neurons.filter((n) => n.layer === l + 1);
      for (const n1 of layerNeurons) {
        for (const n2 of nextNeurons) {
          const w = weightsRef.current[l]?.[n1.index]?.[n2.index] ?? 0;
          const alpha = Math.abs(w) * 0.4;
          const color = w > 0 ? `rgba(0,212,255,${alpha})` : `rgba(255,107,53,${alpha})`;
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.abs(w) * 1.5;
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.stroke();
        }
      }
    }

    // Draw activation wave (forward pass)
    const waveLayerF = Math.floor(forwardPhase * layers.length);
    const waveFracF = (forwardPhase * layers.length) % 1;
    for (const n of neurons) {
      const dist = Math.abs(n.layer - waveLayerF) + waveFracF;
      const glow = Math.max(0, 1 - dist * 1.5);
      const baseR = 8;
      const r = baseR + glow * 10;

      // Glow
      const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 2);
      grd.addColorStop(0, `rgba(0,212,255,${glow * 0.6})`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 2, 0, Math.PI * 2);
      ctx.fill();

      // Neuron body
      ctx.beginPath();
      ctx.arc(n.x, n.y, baseR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.round(20 + glow * 235)}, ${Math.round(20 + glow * 192)}, ${Math.round(80 + glow * 175)}, 0.9)`;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,212,255,0.4)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Draw backprop stream (red/orange)
    const waveLayerB = layers.length - 1 - Math.floor(backPhase * layers.length);
    const waveFracB = (backPhase * layers.length) % 1;
    for (const n of neurons) {
      const dist = Math.abs(n.layer - waveLayerB) + waveFracB;
      const glow = Math.max(0, 1 - dist * 1.5);
      if (glow > 0.05) {
        const grd2 = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 16);
        grd2.addColorStop(0, `rgba(255,107,53,${glow * 0.5})`);
        grd2.addColorStop(1, "transparent");
        ctx.fillStyle = grd2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Layer labels
    ctx.font = "10px var(--font-jetbrains, monospace)";
    ctx.fillStyle = "rgba(112,128,168,0.8)";
    ctx.textAlign = "center";
    for (let l = 0; l < layers.length; l++) {
      const x = 60 + (l / (layers.length - 1)) * (width - 120);
      const label =
        l === 0 ? "INPUT" :
        l === layers.length - 1 ? "OUTPUT" :
        `H${l}·${layers[l]?.activation?.toUpperCase() ?? ""}`;
      ctx.fillText(label, x, height - 8);
    }

    // Simulated loss
    const loss = 1 / (1 + t * 0.001) + Math.sin(t * 0.05) * 0.05;
    setLossHistory((prev) => {
      const next = [...prev, loss].slice(-60);
      return next;
    });

    animRef.current = requestAnimationFrame(draw);
  }, [buildNeurons, layers, width, height]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <div
      style={{ background: "#03040a", borderRadius: 8, overflow: "hidden", position: "relative" }}
      role="img"
      aria-label="Animated neural network visualizer showing forward and backpropagation passes"
    >
      <canvas ref={canvasRef} width={width} height={height} style={{ display: "block" }} />
      {/* Mini loss chart */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "rgba(8,10,26,0.8)",
          border: "0.5px solid rgba(100,120,255,0.2)",
          borderRadius: 4,
          padding: "4px 8px",
        }}
      >
        <div style={{ fontSize: 9, color: "#7080a8", marginBottom: 2, fontFamily: "monospace" }}>
          LOSS
        </div>
        <svg width={80} height={30}>
          {lossHistory.length > 1 && (
            <polyline
              points={lossHistory
                .map((v, i) => `${(i / 59) * 80},${30 - v * 25}`)
                .join(" ")}
              fill="none"
              stroke="#ff6b35"
              strokeWidth={1}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
