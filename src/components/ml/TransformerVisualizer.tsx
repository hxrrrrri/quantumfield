/**
 * @fileoverview Transformer attention visualizer.
 * Shows tokenization, embeddings, multi-head attention weights,
 * and next-token probability as particle flows.
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface TransformerVisualizerProps {
  width?: number;
  height?: number;
}

const SAMPLE_TOKENS = ["The", "quick", "brown", "fox", "jumps"];
const HEAD_COLORS = ["#00d4ff", "#ffd166", "#ff6b35", "#6c3fc5", "#00ff88", "#ff66aa", "#88ddff", "#ffaa33"];

interface AttentionHead {
  weights: number[][];
  color: string;
}

function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const exps = arr.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

export default function TransformerVisualizer({
  width = 600,
  height = 360,
}: TransformerVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const [inputText, setInputText] = useState("The quick brown fox");
  const [tokens, setTokens] = useState<string[]>(SAMPLE_TOKENS);
  const [selectedHead, setSelectedHead] = useState<number | null>(null);
  const [numHeads] = useState(4);
  const headsRef = useRef<AttentionHead[]>([]);
  const tRef = useRef(0);

  // Generate random attention weights
  const generateHeads = useCallback((n: number): AttentionHead[] => {
    return Array.from({ length: numHeads }, (_, h) => ({
      color: HEAD_COLORS[h % HEAD_COLORS.length] ?? "#00d4ff",
      weights: Array.from({ length: n }, () =>
        softmax(Array.from({ length: n }, () => Math.random() * 4 - 2))
      ),
    }));
  }, [numHeads]);

  // Tokenize (simple whitespace)
  const tokenize = useCallback((text: string): string[] => {
    return text.trim().split(/\s+/).slice(0, 8);
  }, []);

  useEffect(() => {
    const toks = tokenize(inputText);
    setTokens(toks);
    headsRef.current = generateHeads(toks.length);
  }, [inputText, generateHeads, tokenize]);

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    tRef.current = timestamp;
    ctx.fillStyle = "rgba(3,4,10,0.25)";
    ctx.fillRect(0, 0, width, height);

    const n = tokens.length;
    if (n < 2) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    // Token positions (horizontal row)
    const tokenY = height * 0.35;
    const tokenX = tokens.map((_, i) => 40 + (i / (n - 1)) * (width - 80));

    // Draw token nodes
    for (let i = 0; i < n; i++) {
      const x = tokenX[i] ?? 0;
      // Pulsing glow
      const pulse = Math.sin(timestamp * 0.003 + i * 0.8) * 0.3 + 0.7;
      const grd = ctx.createRadialGradient(x, tokenY, 0, x, tokenY, 24);
      grd.addColorStop(0, `rgba(108,63,197,${pulse * 0.4})`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, tokenY, 24, 0, Math.PI * 2);
      ctx.fill();

      // Token circle
      ctx.beginPath();
      ctx.arc(x, tokenY, 14, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(30,20,60,0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(108,63,197,0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Token label
      ctx.font = `bold 10px var(--font-jetbrains, monospace)`;
      ctx.fillStyle = "#e8eaf6";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tokens[i] ?? "", x, tokenY);
    }

    // Draw attention arcs
    const headsToShow = selectedHead !== null ? [headsRef.current[selectedHead]].filter(Boolean) as AttentionHead[] : headsRef.current;

    for (const head of headsToShow) {
      for (let from = 0; from < n; from++) {
        for (let to = 0; to < n; to++) {
          if (from === to) continue;
          const w = head.weights[from]?.[to] ?? 0;
          if (w < 0.05) continue;

          const x1 = tokenX[from] ?? 0;
          const x2 = tokenX[to] ?? 0;
          const arcH = Math.abs(x2 - x1) * 0.5 + 20;
          const midX = (x1 + x2) / 2;
          const midY = tokenY - arcH;

          const alpha = w * (selectedHead !== null ? 0.9 : 0.4);
          ctx.beginPath();
          ctx.moveTo(x1, tokenY);
          ctx.quadraticCurveTo(midX, midY, x2, tokenY);
          ctx.strokeStyle = head.color.replace(")", `,${alpha})`).replace("rgb", "rgba");
          ctx.lineWidth = w * (selectedHead !== null ? 3 : 1.5);
          ctx.stroke();
        }
      }
    }

    // Next-token probability bars
    const barY = height * 0.72;
    ctx.font = "9px var(--font-jetbrains, monospace)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const probs = softmax(tokens.map((_, i) => Math.sin(timestamp * 0.001 + i) * 2));
    for (let i = 0; i < n; i++) {
      const x = tokenX[i] ?? 0;
      const p = probs[i] ?? 0;
      const barH = p * 60;
      ctx.fillStyle = `rgba(0,212,255,${0.3 + p * 0.7})`;
      ctx.fillRect(x - 12, barY - barH, 24, barH);
      ctx.fillStyle = "rgba(112,128,168,0.8)";
      ctx.fillText(`${(p * 100).toFixed(0)}%`, x, barY + 2);
    }

    // Labels
    ctx.fillStyle = "rgba(112,128,168,0.6)";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("ATTENTION", 8, tokenY - 50);
    ctx.fillText("NEXT TOKEN P", 8, barY - 30);

    animRef.current = requestAnimationFrame(draw);
  }, [tokens, width, height, selectedHead]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  return (
    <div style={{ background: "#03040a", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "6px 10px", borderBottom: "0.5px solid rgba(100,120,255,0.15)", display: "flex", gap: 6, alignItems: "center" }}>
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value.slice(0, 50))}
          style={{
            background: "rgba(0,212,255,0.05)",
            border: "0.5px solid rgba(0,212,255,0.2)",
            color: "#e8eaf6",
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 4,
            fontFamily: "monospace",
            flex: 1,
            outline: "none",
          }}
          placeholder="Type to tokenize..."
          aria-label="Transformer input text"
        />
        <div style={{ display: "flex", gap: 3 }}>
          {Array.from({ length: numHeads }, (_, h) => (
            <button
              key={h}
              onClick={() => setSelectedHead(selectedHead === h ? null : h)}
              style={{
                width: 18, height: 18, borderRadius: 3,
                background: HEAD_COLORS[h % HEAD_COLORS.length],
                border: selectedHead === h ? "2px solid #fff" : "1px solid transparent",
                cursor: "pointer", opacity: selectedHead === null || selectedHead === h ? 1 : 0.3,
              }}
              title={`Head ${h + 1}`}
              aria-label={`Toggle attention head ${h + 1}`}
              aria-pressed={selectedHead === h}
            />
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} width={width} height={height} style={{ display: "block" }} aria-label="Transformer attention visualization" />
    </div>
  );
}
