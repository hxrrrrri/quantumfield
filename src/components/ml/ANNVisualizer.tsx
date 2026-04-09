"use client";

import { useEffect, useMemo, useState } from "react";

interface Layer {
  size: number;
  activation: "relu" | "sigmoid" | "tanh" | "gelu";
}

interface ANNVisualizerProps {
  layers?: Layer[];
}

interface NodePoint {
  id: string;
  layerIndex: number;
  nodeIndex: number;
  x: number;
  y: number;
  label: string;
  role: string;
  activationName: string;
}

interface Link {
  id: string;
  from: NodePoint;
  to: NodePoint;
  offset: number;
}

const VIEW_W = 980;
const VIEW_H = 420;

const LAYER_CONTEXT = [
  {
    title: "INPUT LAYER",
    subtitle: "Field Sensors",
    description: "Reads force vectors, particle density, temperature gradient, and phase noise.",
    nodePrefix: "I",
  },
  {
    title: "HIDDEN LAYER A",
    subtitle: "Feature Extraction",
    description: "Builds latent features from local field interactions and wave collisions.",
    nodePrefix: "H1",
  },
  {
    title: "HIDDEN LAYER B",
    subtitle: "Dynamics Model",
    description: "Encodes temporal behavior and predicts short-horizon motion of particle clusters.",
    nodePrefix: "H2",
  },
  {
    title: "OUTPUT LAYER",
    subtitle: "Predicted Behavior",
    description: "Emits trajectory bias, color energy shift, and stability confidence.",
    nodePrefix: "O",
  },
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export default function ANNVisualizer({
  layers = [
    { size: 5, activation: "relu" },
    { size: 7, activation: "gelu" },
    { size: 6, activation: "tanh" },
    { size: 4, activation: "sigmoid" },
  ],
}: ANNVisualizerProps) {
  const [phase, setPhase] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<NodePoint | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase((p) => (p + 0.018) % 1);
    }, 42);
    return () => window.clearInterval(id);
  }, []);

  const layout = useMemo(() => {
    const safeLayers = layers.length >= 3 ? layers : [
      { size: 4, activation: "relu" },
      { size: 6, activation: "gelu" },
      { size: 3, activation: "sigmoid" },
    ];

    const left = 80;
    const right = VIEW_W - 80;
    const top = 64;
    const bottom = VIEW_H - 94;
    const xStep = (right - left) / Math.max(1, safeLayers.length - 1);

    const nodes: NodePoint[] = [];
    for (let l = 0; l < safeLayers.length; l++) {
      const count = Math.max(1, safeLayers[l]?.size ?? 1);
      const yStep = (bottom - top) / (count + 1);
      for (let n = 0; n < count; n++) {
        const x = left + xStep * l;
        const y = top + yStep * (n + 1);
        const ctx = LAYER_CONTEXT[Math.min(l, LAYER_CONTEXT.length - 1)] ?? LAYER_CONTEXT[0]!;
        nodes.push({
          id: `n-${l}-${n}`,
          layerIndex: l,
          nodeIndex: n,
          x,
          y,
          label: `${ctx.nodePrefix}${n + 1}`,
          role: `${ctx.subtitle} · channel ${n + 1}`,
          activationName: (safeLayers[l]?.activation ?? "relu").toUpperCase(),
        });
      }
    }

    const links: Link[] = [];
    for (let l = 0; l < safeLayers.length - 1; l++) {
      const from = nodes.filter((n) => n.layerIndex === l);
      const to = nodes.filter((n) => n.layerIndex === l + 1);
      let idx = 0;
      for (const a of from) {
        for (const b of to) {
          links.push({
            id: `e-${a.id}-${b.id}`,
            from: a,
            to: b,
            offset: ((idx * 0.071) + l * 0.17) % 1,
          });
          idx++;
        }
      }
    }

    return { safeLayers, nodes, links };
  }, [layers]);

  const layerMeta = layout.safeLayers.map((layer, i) => {
    const ctx = LAYER_CONTEXT[Math.min(i, LAYER_CONTEXT.length - 1)] ?? LAYER_CONTEXT[0]!;
    return {
      ...ctx,
      activation: layer.activation.toUpperCase(),
    };
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 320,
        display: "grid",
        gridTemplateRows: "1fr auto",
        background: "linear-gradient(160deg, rgba(0,10,18,0.85), rgba(0,3,8,0.88))",
      }}
      role="img"
      aria-label="Interactive artificial neural network diagram showing data flow across layers"
    >
      <div style={{ position: "relative", overflow: "hidden" }}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          style={{ width: "100%", height: "100%", display: "block" }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="ann-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(0,30,50,0.12)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.2)" />
            </linearGradient>
            <linearGradient id="ann-link" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(0,255,176,0.2)" />
              <stop offset="100%" stopColor="rgba(0,184,255,0.2)" />
            </linearGradient>
            <radialGradient id="ann-node-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(175,255,236,1)" />
              <stop offset="60%" stopColor="rgba(0,255,176,0.86)" />
              <stop offset="100%" stopColor="rgba(0,184,255,0.66)" />
            </radialGradient>
          </defs>

          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="url(#ann-bg)" />

          {layout.links.map((link) => (
            <line
              key={link.id}
              x1={link.from.x}
              y1={link.from.y}
              x2={link.to.x}
              y2={link.to.y}
              stroke="url(#ann-link)"
              strokeWidth={1}
              opacity={0.45}
            />
          ))}

          {layout.links.map((link) => {
            const travel = (phase + link.offset) % 1;
            const x = link.from.x + (link.to.x - link.from.x) * travel;
            const y = link.from.y + (link.to.y - link.from.y) * travel;
            return (
              <circle
                key={`pulse-${link.id}`}
                cx={x}
                cy={y}
                r={1.8}
                fill="rgba(255,255,255,0.95)"
                opacity={0.9}
              />
            );
          })}

          {layout.nodes.map((node) => {
            const activation = clamp(
              0.18 + 0.82 * Math.max(0, Math.sin((phase * 7 + node.layerIndex * 0.9 + node.nodeIndex * 0.43) * Math.PI)),
              0,
              1
            );
            const glowR = 11 + activation * 10;
            const coreR = 5 + activation * 3;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={glowR}
                  fill="rgba(0,255,176,0.18)"
                  opacity={activation * 0.85}
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={coreR}
                  fill="url(#ann-node-core)"
                  stroke="rgba(188,255,239,0.9)"
                  strokeWidth={1}
                />
                <text
                  x={node.x}
                  y={node.y + 18}
                  textAnchor="middle"
                  fontFamily="var(--font-jetbrains), monospace"
                  fontSize={9}
                  fill="rgba(178,255,239,0.86)"
                >
                  {node.label}
                </text>
              </g>
            );
          })}

          {layerMeta.map((layer, i) => {
            const x = 80 + ((VIEW_W - 160) / Math.max(1, layerMeta.length - 1)) * i;
            return (
              <g key={layer.title}>
                <text
                  x={x}
                  y={24}
                  textAnchor="middle"
                  fontFamily="var(--font-space-grotesk), sans-serif"
                  fontSize={11}
                  letterSpacing="1.5"
                  fill="rgba(0,255,176,0.85)"
                >
                  {layer.title}
                </text>
                <text
                  x={x}
                  y={40}
                  textAnchor="middle"
                  fontFamily="var(--font-jetbrains), monospace"
                  fontSize={9}
                  fill="rgba(168,211,255,0.8)"
                >
                  {layer.subtitle} · {layer.activation}
                </text>
              </g>
            );
          })}
        </svg>

        <div
          style={{
            position: "absolute",
            left: 12,
            top: 10,
            background: "rgba(0,10,18,0.78)",
            border: "1px solid rgba(0,255,176,0.2)",
            borderRadius: 5,
            padding: "7px 9px",
            maxWidth: 330,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: 10,
              letterSpacing: "0.14em",
              color: "rgba(0,255,176,0.92)",
              marginBottom: 4,
            }}
          >
            ANN DATA FLOW
          </div>
          <div
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 10,
              color: "rgba(166,219,255,0.84)",
              lineHeight: 1.45,
            }}
          >
            Forward pulses run left to right through weighted links. Node glow intensity represents activation
            firing probability under current field conditions.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 12,
            top: 10,
            minWidth: 290,
            background: "rgba(0,10,18,0.78)",
            border: "1px solid rgba(0,255,176,0.2)",
            borderRadius: 5,
            padding: "7px 9px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: 10,
              letterSpacing: "0.14em",
              color: "rgba(0,255,176,0.92)",
              marginBottom: 4,
            }}
          >
            NODE INSPECTOR
          </div>
          {hoveredNode ? (
            <>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "rgba(214,255,243,0.9)" }}>
                {hoveredNode.label} · {hoveredNode.role}
              </div>
              <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "rgba(147,201,255,0.78)", marginTop: 4 }}>
                Layer {hoveredNode.layerIndex + 1} · Activation {hoveredNode.activationName}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "rgba(147,201,255,0.78)" }}>
              Hover a node to inspect its role in the simulation pipeline.
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          padding: "8px 12px 10px",
          borderTop: "1px solid rgba(0,255,176,0.12)",
          background: "rgba(0,8,14,0.76)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: 10,
              letterSpacing: "0.14em",
              color: "rgba(0,255,176,0.92)",
              marginBottom: 4,
            }}
          >
            LEGEND
          </div>
          <div style={{ display: "grid", gap: 2 }}>
            {[
              "Lines: weighted neuron connections",
              "Traveling dots: direction of data propagation",
              "Bright nodes: high activation / firing",
              "Outer glow: confidence and salience",
            ].map((line) => (
              <div
                key={line}
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 10,
                  color: "rgba(154,215,255,0.83)",
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: 10,
              letterSpacing: "0.14em",
              color: "rgba(0,255,176,0.92)",
              marginBottom: 4,
            }}
          >
            PIPELINE
          </div>
          <div style={{ display: "grid", gap: 2 }}>
            {[
              "1) Field inputs sampled from live particle state",
              "2) Hidden layers extract geometric and temporal features",
              "3) Dynamics layer estimates near-future behavior",
              "4) Output layer predicts motion, energy, and stability",
            ].map((line) => (
              <div
                key={line}
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 10,
                  color: "rgba(154,215,255,0.83)",
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
