"use client";

import { useState } from "react";
import ImageSimulator from "./ImageSimulator";
import AdvancedDrawingPad from "@/components/studio/AdvancedDrawingPad";
import { useSimulatorStore } from "@/store/simulatorStore";

type StudioTab = "upload" | "draw";

export default function MediaStudio() {
  const [tab, setTab] = useState<StudioTab>("upload");
  const store = useSimulatorStore();

  const closeStudio = () => {
    store.toggleMediaStudio();
  };

  return (
    <section
      style={{
        position: "absolute",
        left: 14,
        right: 14,
        top: 64,
        maxWidth: 960,
        margin: "0 auto",
        zIndex: 30,
        background: "rgba(8, 10, 16, 0.82)",
        border: "1px solid rgba(143,245,255,0.15)",
        borderRadius: 10,
        boxShadow: "0 16px 56px rgba(0,0,0,0.55)",
        backdropFilter: "blur(20px)",
        overflow: "hidden",
      }}
      aria-label="Media Studio"
    >
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          borderBottom: "1px solid rgba(143,245,255,0.14)",
          alignItems: "stretch",
          minHeight: 48,
        }}
      >
        <button
          onClick={() => setTab("upload")}
          style={{
            border: "none",
            borderBottom: tab === "upload" ? "2px solid rgba(143,245,255,0.7)" : "2px solid transparent",
            background: tab === "upload" ? "rgba(143,245,255,0.09)" : "transparent",
            color: tab === "upload" ? "#8ff5ff" : "#8da6c0",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
          aria-pressed={tab === "upload"}
        >
          Upload and Convert
        </button>

        <button
          onClick={() => setTab("draw")}
          style={{
            border: "none",
            borderBottom: tab === "draw" ? "2px solid rgba(143,245,255,0.7)" : "2px solid transparent",
            background: tab === "draw" ? "rgba(143,245,255,0.09)" : "transparent",
            color: tab === "draw" ? "#8ff5ff" : "#8da6c0",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
          aria-pressed={tab === "draw"}
        >
          Drawing Canvas
        </button>

        <button
          onClick={closeStudio}
          style={{
            border: "none",
            background: "transparent",
            color: "#8da6c0",
            padding: "0 16px",
            fontSize: 20,
            cursor: "pointer",
          }}
          aria-label="Close studio"
        >
          x
        </button>
      </header>

      <div style={{ padding: 14 }}>
        {tab === "upload" && <ImageSimulator canvasW={800} canvasH={600} />}
        {tab === "draw" && (
          <AdvancedDrawingPad
            width={900}
            height={420}
            onClose={() => setTab("upload")}
            onConvert={() => {
              setTab("upload");
            }}
          />
        )}
      </div>
    </section>
  );
}
