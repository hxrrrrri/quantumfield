/**
 * @fileoverview Global Zustand store for QuantumField simulator state.
 * All UI-driven mutations go through these actions.
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  SimulatorState,
  PhysicsMode,
  ColormapName,
  PresetName,
  RenderMode,
} from "@/types";

interface SimulatorActions {
  setPhysicsMode: (mode: PhysicsMode) => void;
  setRenderMode: (mode: RenderMode) => void;
  setColormap: (cm: ColormapName) => void;
  setParticleCount: (n: number) => void;
  setTimeScale: (t: number) => void;
  setGravityG: (g: number) => void;
  setBloom: (b: number) => void;
  setTrailDecay: (t: number) => void;
  setParticleSize: (s: number) => void;
  setActivePreset: (p: PresetName | null) => void;
  setRunning: (r: boolean) => void;
  setFps: (fps: number) => void;
  setFrameTime: (ft: number) => void;
  setKineticEnergy: (ke: number) => void;
  incrementSimTime: (dt: number) => void;
  setForceMode: (m: "attract" | "repel" | "none") => void;
  setForceRadius: (r: number) => void;
  setForceStrength: (s: number) => void;
  toggleSidebar: () => void;
  setGestureEnabled: (e: boolean) => void;
  toggleEquation: () => void;
  toggleStats: () => void;
  setANNPanelOpen: (open: boolean) => void;
  toggleANNPanel: () => void;
  toggleMediaStudio: () => void;
  reset: () => void;
}

const DEFAULT_STATE: SimulatorState = {
  physicsMode: "classical",
  renderMode: "webgl2",
  colormap: "viridis",
  particleCount: 50000,
  timeScale: 1.0,
  gravityG: 1.0,
  bloomIntensity: 0,
  trailDecay: 0.5,
  particleSize: 1.20,
  activePreset: null,
  isRunning: true,
  fps: 0,
  frameTime: 0,
  kineticEnergy: 0,
  simTime: 0,
  forceMode: "attract",
  forceRadius: 120,
  forceStrength: 2.0,
  sidebarOpen: true,
  gestureEnabled: false,
  showEquation: true,
  showStats: true,
  annPanelOpen: false,
  mediaStudioOpen: false,
};

export const useSimulatorStore = create<SimulatorState & SimulatorActions>()(
  subscribeWithSelector((set) => ({
    ...DEFAULT_STATE,
    setPhysicsMode: (mode) => set({ physicsMode: mode }),
    setRenderMode: (mode) => set({ renderMode: mode }),
    setColormap: (cm) => set({ colormap: cm }),
    setParticleCount: (n) =>
      set({ particleCount: Math.max(100, Math.min(2_000_000, n)) }),
    setTimeScale: (t) => set({ timeScale: Math.max(0.01, Math.min(10, t)) }),
    setGravityG: (g) => set({ gravityG: Math.max(0, Math.min(10, g)) }),
    setBloom: (b) => set({ bloomIntensity: Math.max(0, Math.min(2, b)) }),
    setTrailDecay: (t) => set({ trailDecay: Math.max(0.5, Math.min(0.99, t)) }),
    setParticleSize: (s) =>
      set({ particleSize: Math.max(0.5, Math.min(8, s)) }),
    setActivePreset: (p) => set({ activePreset: p }),
    setRunning: (r) => set({ isRunning: r }),
    setFps: (fps) => set({ fps }),
    setFrameTime: (ft) => set({ frameTime: ft }),
    setKineticEnergy: (ke) => set({ kineticEnergy: ke }),
    incrementSimTime: (dt) => set((s) => ({ simTime: s.simTime + dt })),
    setForceMode: (m) => set({ forceMode: m }),
    setForceRadius: (r) =>
      set({ forceRadius: Math.max(10, Math.min(500, r)) }),
    setForceStrength: (s) =>
      set({ forceStrength: Math.max(0.1, Math.min(20, s)) }),
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setGestureEnabled: (e) => set({ gestureEnabled: e }),
    toggleEquation: () => set((s) => ({ showEquation: !s.showEquation })),
    toggleStats: () => set((s) => ({ showStats: !s.showStats })),
    setANNPanelOpen: (open) => set({ annPanelOpen: open }),
    toggleANNPanel: () => set((s) => ({ annPanelOpen: !s.annPanelOpen })),
    toggleMediaStudio: () => set((s) => ({ mediaStudioOpen: !s.mediaStudioOpen })),
    reset: () => set(DEFAULT_STATE),
  }))
);
