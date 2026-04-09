// ============================================================
// QuantumField — Core Type Definitions
// ============================================================

/** Structure-of-Arrays particle data (cache-efficient) */
export interface ParticleBuffers {
  /** Position x,y,z — stride 3 */
  position: Float32Array;
  /** Velocity vx,vy,vz — stride 3 */
  velocity: Float32Array;
  /** Acceleration ax,ay,az — stride 3 */
  acceleration: Float32Array;
  /** mass, charge, spin, life — stride 4 */
  properties: Float32Array;
  /** color r,g,b,a — stride 4, normalized 0-1 */
  color: Float32Array;
  /** flags: alive(0/1), type, mode — stride 3 */
  flags: Uint8Array;
  /** Active particle count */
  count: number;
}

export type PhysicsMode =
  | "classical"
  | "quantum"
  | "relativity"
  | "fluid"
  | "em"
  | "future";

export type RenderMode = "webgpu" | "webgl2";

export type ColormapName =
  | "viridis"
  | "inferno"
  | "plasma"
  | "magma"
  | "turbo"
  | "cyan"
  | "fire"
  | "aurora"
  | "rainbow"
  | "neon";

export type PresetName =
  | "bigbang"
  | "galaxy"
  | "doubleslit"
  | "blackhole"
  | "electroncloud"
  | "plasma"
  | "vortex"
  | "strings"
  | "bec"
  | "supernova"
  | "cnn"
  | "transformer"
  | "anntraining"
  | "gan"
  | "dna"
  | "solar"
  | "tunneling"
  | "wavecollapse"
  | "darkmatter"
  | "portrait";

export interface ScenePreset {
  name: string;
  displayName: string;
  physics: PhysicsMode;
  particleCount: number;
  params: Record<string, number>;
  camera: {
    x: number;
    y: number;
    z: number;
    fov: number;
  };
  description: string;
  equation: string;
  discoverer: string;
  year: number;
}

export interface SimulatorState {
  physicsMode: PhysicsMode;
  renderMode: RenderMode;
  colormap: ColormapName;
  particleCount: number;
  timeScale: number;
  gravityG: number;
  bloomIntensity: number;
  trailDecay: number;
  particleSize: number;
  activePreset: PresetName | null;
  isRunning: boolean;
  fps: number;
  frameTime: number;
  kineticEnergy: number;
  simTime: number;
  forceMode: "attract" | "repel" | "none";
  forceRadius: number;
  forceStrength: number;
  sidebarOpen: boolean;
  gestureEnabled: boolean;
  showEquation: boolean;
  showStats: boolean;
  annPanelOpen: boolean;
}

export interface PhysicsParams {
  G: number;
  k: number;
  hbar: number;
  c: number;
  epsilon0: number;
  mu0: number;
  kB: number;
  dt: number;
  substeps: number;
}

export interface WorkerMessage<T = unknown> {
  type: string;
  payload: T;
  id?: number;
}

export interface PhysicsWorkerInput {
  type: "step";
  buffers: {
    position: SharedArrayBuffer;
    velocity: SharedArrayBuffer;
    acceleration: SharedArrayBuffer;
    properties: SharedArrayBuffer;
    flags: SharedArrayBuffer;
  };
  count: number;
  dt: number;
  mode: PhysicsMode;
  params: PhysicsParams;
  mouseX: number;
  mouseY: number;
  forceMode: "attract" | "repel" | "none";
  forceRadius: number;
  forceStrength: number;
  canvasW: number;
  canvasH: number;
}

export interface PhysicsWorkerOutput {
  type: "stepped";
  count: number;
  kineticEnergy: number;
  frameTime: number;
}

export interface NeuronLayer {
  size: number;
  activation: "relu" | "sigmoid" | "tanh" | "gelu";
}

export interface ANNConfig {
  layers: NeuronLayer[];
  learningRate: number;
  loss: "mse" | "crossentropy";
}

export interface ImageParticleOptions {
  density: number;
  samplingMode: "poisson" | "grid";
  colorFromImage: boolean;
  massFromLuminance: boolean;
}

export interface TextParticleOptions {
  font: string;
  fontSize: number;
  text: string;
  morphDuration: number;
}

export interface GestureState {
  isOpen: boolean;
  landmarks: number[][] | null;
  gesture: string | null;
  confidence: number;
  palmCenter: { x: number; y: number } | null;
}

// Security types
export interface UploadValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  dimensions?: { width: number; height: number };
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: number };
