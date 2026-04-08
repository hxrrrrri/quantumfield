/**
 * @fileoverview Main simulator shell — full-screen canvas with
 * sidebar, top bar, stats overlay, and all physics/ML panels.
 */
"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Dynamically import heavy components to avoid SSR issues with WebGL/WebGPU
const ParticleCanvas = dynamic(
  () => import("@/components/canvas/ParticleCanvas"),
  { ssr: false }
);
const CosmicSidebar = dynamic(
  () => import("@/components/ui/CosmicSidebar"),
  { ssr: false }
);
const TopBar = dynamic(
  () => import("@/components/ui/TopBar"),
  { ssr: false }
);
const InfoOverlay = dynamic(
  () => import("@/components/ui/InfoOverlay"),
  { ssr: false }
);

function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-space-void z-50"
      role="status"
      aria-label="Loading QuantumField simulator"
    >
      <div className="text-center space-y-4">
        <div className="text-2xl font-semibold tracking-widest text-particle-white">
          QUANTUM<span className="text-plasma-cyan">FIELD</span>
        </div>
        <div className="text-xs text-muted-gray tracking-widest font-mono">
          INITIALIZING PARTICLE ENGINE...
        </div>
        <div className="flex gap-1 justify-center">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-plasma-cyan animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SimulatorPage() {
  return (
    <main
      className="relative w-screen h-screen overflow-hidden bg-space-void"
      aria-label="QuantumField Particle Simulator"
    >
      <Suspense fallback={<LoadingScreen />}>
        {/* Full-screen canvas */}
        <ParticleCanvas />

        {/* Top navigation bar */}
        <TopBar />

        {/* Right sidebar */}
        <CosmicSidebar />

        {/* Overlaid stats and equation display */}
        <InfoOverlay />
      </Suspense>
    </main>
  );
}
