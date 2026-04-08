/**
 * @fileoverview MediaPipe hand gesture controller component.
 * Renders webcam feed, landmark skeleton, gesture label, and applies
 * the detected gesture to the particle simulation.
 */
"use client";

import { useEffect, useCallback } from "react";
import { useSimulatorStore } from "@/store/simulatorStore";
import { useGesture } from "@/hooks/useGesture";

interface GestureControllerProps {
  onGestureForce?: (x: number, y: number, mode: "attract" | "repel") => void;
}

const GESTURE_ACTIONS: Record<string, string> = {
  open_palm: "Repel particles",
  fist: "Attract particles",
  pinch: "Grab cluster",
  peace: "Split particles",
  point: "Paint attractor",
  thumbs_up: "Next physics mode",
  unknown: "—",
  none: "—",
};

export default function GestureController({ onGestureForce }: GestureControllerProps) {
  const store = useSimulatorStore();
  const { gestureState, startTracking, stopTracking, videoRef } = useGesture();

  // Map gesture to simulation action
  useEffect(() => {
    if (!gestureState.palmCenter || !gestureState.gesture) return;

    const { palmCenter, gesture } = gestureState;
    const canvasW = window.innerWidth - 260;
    const canvasH = window.innerHeight;
    const mx = palmCenter.x * canvasW;
    const my = palmCenter.y * canvasH;

    switch (gesture) {
      case "open_palm":
        onGestureForce?.(mx, my, "repel");
        break;
      case "fist":
        onGestureForce?.(mx, my, "attract");
        break;
      case "thumbs_up":
        {
          const modes = ["classical", "quantum", "relativity", "fluid", "em", "future"] as const;
          const cur = modes.indexOf(store.physicsMode);
          store.setPhysicsMode(modes[(cur + 1) % modes.length]!);
        }
        break;
    }
  }, [gestureState, onGestureForce, store]);

  const handleToggle = useCallback(() => {
    if (gestureState.isOpen) {
      stopTracking();
      store.setGestureEnabled(false);
    } else {
      void startTracking();
      store.setGestureEnabled(true);
    }
  }, [gestureState.isOpen, startTracking, stopTracking, store]);

  return (
    <div role="region" aria-label="Hand gesture controls">
      <button
        onClick={handleToggle}
        style={{
          width: "100%",
          padding: "6px",
          marginBottom: 8,
          borderRadius: 6,
          fontSize: 10,
          cursor: "pointer",
          border: `0.5px solid ${gestureState.isOpen ? "rgba(0,212,255,0.4)" : "rgba(100,120,255,0.2)"}`,
          color: gestureState.isOpen ? "#00d4ff" : "#7080a8",
          background: gestureState.isOpen ? "rgba(0,212,255,0.06)" : "transparent",
        }}
        aria-label={gestureState.isOpen ? "Stop hand tracking" : "Start hand tracking"}
      >
        {gestureState.isOpen ? "🤚 Stop Tracking" : "✋ Enable Hand Control"}
      </button>

      {gestureState.gesture === "permission_denied" && (
        <div style={{ fontSize: 10, color: "#ff6b35", marginBottom: 6 }}>
          Camera permission denied. Please allow camera access.
        </div>
      )}

      {gestureState.isOpen && (
        <>
          {/* Video preview */}
          <div style={{ position: "relative", marginBottom: 6, borderRadius: 4, overflow: "hidden" }}>
            <video
              ref={videoRef}
              style={{ width: "100%", height: 80, objectFit: "cover", display: "block", transform: "scaleX(-1)" }}
              aria-label="Webcam feed for gesture detection"
              muted
              playsInline
            />
            {/* Landmark overlay would go here if canvas overlay implemented */}
          </div>

          {/* Gesture label */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#7080a8" }}>Gesture</span>
            <span style={{ fontSize: 10, color: "#ffd166", fontFamily: "monospace" }}>
              {gestureState.gesture ?? "—"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: "#7080a8" }}>Action</span>
            <span style={{ fontSize: 10, color: "#00d4ff" }}>
              {GESTURE_ACTIONS[gestureState.gesture ?? "none"] ?? "—"}
            </span>
          </div>

          {/* Confidence bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 9, color: "#4a5480" }}>Confidence</span>
              <span style={{ fontSize: 9, color: "#4a5480", fontFamily: "monospace" }}>
                {(gestureState.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div style={{ height: 2, background: "rgba(100,120,255,0.15)", borderRadius: 1 }}>
              <div
                style={{
                  height: "100%",
                  width: `${gestureState.confidence * 100}%`,
                  background: "#00d4ff",
                  borderRadius: 1,
                  transition: "width 0.1s",
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Gesture guide */}
      <div style={{ fontSize: 9, color: "#3a4060", lineHeight: 1.6, fontFamily: "monospace" }}>
        {[
          ["✊", "Attract"],
          ["🖐", "Repel"],
          ["🤌", "Pinch grab"],
          ["✌", "Split"],
          ["☝", "Attractor trail"],
          ["👍", "Next mode"],
        ].map(([icon, desc]) => (
          <div key={icon} style={{ display: "flex", gap: 6 }}>
            <span>{icon}</span><span>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
