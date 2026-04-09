"use client";

import { useEffect, useRef, useState } from "react";

type Tool = "brush" | "eraser" | "line" | "rect" | "circle";

interface AdvancedDrawingPadProps {
  onConvert: (positions: Float32Array, colors: Float32Array, masses: Float32Array, count: number) => void;
  width?: number;
  height?: number;
  onClose: () => void;
}

interface Point {
  x: number;
  y: number;
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(70,110,160,0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export default function AdvancedDrawingPad({
  onConvert,
  width = 760,
  height = 420,
  onClose,
}: AdvancedDrawingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#00d4ff");
  const [size, setSize] = useState(6);
  const [drawing, setDrawing] = useState(false);
  const startPosRef = useRef<Point | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    context.clearRect(0, 0, width, height);

    if (grid) {
      const gridCtx = grid.getContext("2d");
      if (gridCtx) {
        drawGrid(gridCtx, width, height);
      }
    }

    setCtx(context);
    historyRef.current = [context.getImageData(0, 0, width, height)];
  }, [height, width]);

  const saveHistory = () => {
    if (!ctx) return;
    historyRef.current.push(ctx.getImageData(0, 0, width, height));
    if (historyRef.current.length > 40) {
      historyRef.current.shift();
    }
  };

  const undo = () => {
    if (!ctx || historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const last = historyRef.current[historyRef.current.length - 1];
    if (last) {
      ctx.putImageData(last, 0, 0);
    }
  };

  const getPos = (clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect || !canvas) return { x: 0, y: 0 };
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: clamp((clientX - rect.left) * scaleX, 0, canvas.width),
      y: clamp((clientY - rect.top) * scaleY, 0, canvas.height),
    };
  };

  const beginDraw = (clientX: number, clientY: number) => {
    if (!ctx) return;
    setDrawing(true);
    const pos = getPos(clientX, clientY);
    startPosRef.current = pos;
    snapshotRef.current = ctx.getImageData(0, 0, width, height);

    if (tool === "brush" || tool === "eraser") {
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const drawMove = (clientX: number, clientY: number) => {
    if (!drawing || !ctx || !startPosRef.current) return;
    const pos = getPos(clientX, clientY);

    if (tool === "brush" || tool === "eraser") {
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      return;
    }

    if (!snapshotRef.current) return;

    ctx.globalCompositeOperation = "source-over";
    ctx.putImageData(snapshotRef.current, 0, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const start = startPosRef.current;
    if (tool === "line") {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      return;
    }

    if (tool === "rect") {
      ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
      return;
    }

    const radius = Math.hypot(pos.x - start.x, pos.y - start.y);
    ctx.beginPath();
    ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!drawing) return;
    setDrawing(false);
    startPosRef.current = null;
    snapshotRef.current = null;
    if (ctx) {
      ctx.globalCompositeOperation = "source-over";
    }
    ctx?.closePath();
    saveHistory();
  };

  const clear = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    saveHistory();
  };

  const instantiate = () => {
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, width, height);
    window.dispatchEvent(new CustomEvent("qf:shapeChanged", { detail: "image" }));
    window.dispatchEvent(
      new CustomEvent("qf:imageData", {
        detail: {
          data: imageData,
          w: width,
          h: height,
          exact: false,
          targetCount: 26000,
        },
      })
    );

    // Kept for compatibility with previous callback signature.
    onConvert(new Float32Array(), new Float32Array(), new Float32Array(), 0);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, max-content) 1fr max-content max-content max-content max-content",
          gap: 6,
          alignItems: "center",
          padding: "8px 10px",
          border: "1px solid rgba(143,245,255,0.15)",
          borderRadius: 6,
          background: "rgba(8,11,18,0.8)",
        }}
      >
        {(["brush", "eraser", "line", "rect", "circle"] as Tool[]).map((id) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            style={{
              border: `1px solid ${tool === id ? "rgba(143,245,255,0.6)" : "rgba(143,245,255,0.18)"}`,
              background: tool === id ? "rgba(143,245,255,0.12)" : "rgba(20,25,34,0.84)",
              color: tool === id ? "#8ff5ff" : "#8ca4c0",
              borderRadius: 4,
              padding: "6px 8px",
              fontSize: 10,
              fontFamily: "monospace",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
            aria-pressed={tool === id}
          >
            {id}
          </button>
        ))}

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Brush color"
        />

        <label style={{ fontSize: 10, color: "#8ca4c0", fontFamily: "monospace" }}>
          Size
        </label>
        <input
          type="range"
          min={1}
          max={70}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          aria-label="Brush size"
        />

        <button
          onClick={undo}
          style={{
            border: "1px solid rgba(255,201,101,0.35)",
            background: "rgba(255,201,101,0.1)",
            color: "#ffd166",
            borderRadius: 4,
            padding: "6px 8px",
            fontSize: 10,
            cursor: "pointer",
          }}
        >
          Undo
        </button>

        <button
          onClick={clear}
          style={{
            border: "1px solid rgba(255,107,53,0.35)",
            background: "rgba(255,107,53,0.1)",
            color: "#ff8458",
            borderRadius: 4,
            padding: "6px 8px",
            fontSize: 10,
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: width,
          height: "auto",
          borderRadius: 8,
          border: "1px solid rgba(143,245,255,0.3)",
          background: "#02060f",
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.5)",
        }}
      >
        <canvas
          ref={gridRef}
          width={width}
          height={height}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            borderRadius: 8,
          }}
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
            beginDraw(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => drawMove(e.clientX, e.clientY)}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            touchAction: "none",
            borderRadius: 8,
            cursor: tool === "eraser" ? "cell" : "crosshair",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <button
          onClick={onClose}
          style={{
            border: "1px solid rgba(143,245,255,0.22)",
            background: "rgba(20,25,34,0.9)",
            color: "#9ab0c7",
            borderRadius: 5,
            padding: "7px 10px",
            cursor: "pointer",
          }}
        >
          Back to upload
        </button>

        <button
          onClick={instantiate}
          style={{
            border: "1px solid rgba(0,212,255,0.46)",
            background: "rgba(0,212,255,0.16)",
            color: "#9ff0ff",
            borderRadius: 5,
            padding: "7px 10px",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: "pointer",
          }}
        >
          Convert drawing to particles
        </button>
      </div>
    </div>
  );
}
