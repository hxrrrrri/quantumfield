/**
 * @fileoverview Bridge to physics and ML Web Workers.
 * Manages worker lifecycle, SharedArrayBuffer, and message routing.
 */

interface WorkerBridgeOptions {
  onStep?: (ke: number, frameTime: number) => void;
  onError?: (err: ErrorEvent) => void;
}

export class WorkerBridge {
  private physicsWorker: Worker | null = null;
  private readonly options: WorkerBridgeOptions;
  private pendingStep = false;

  constructor(options: WorkerBridgeOptions = {}) {
    this.options = options;
  }

  /** Initialize physics worker */
  initPhysics(): void {
    if (typeof Worker === "undefined") return;
    try {
      this.physicsWorker = new Worker(
        new URL("./workers/physics.worker.ts", import.meta.url),
        { type: "module" }
      );
      this.physicsWorker.addEventListener("message", (e: MessageEvent) => {
        const { type, kineticEnergy, frameTime } = e.data as {
          type: string;
          kineticEnergy: number;
          frameTime: number;
        };
        if (type === "stepped") {
          this.pendingStep = false;
          this.options.onStep?.(kineticEnergy, frameTime);
        }
      });
      this.physicsWorker.addEventListener("error", (err) => {
        this.options.onError?.(err);
      });
    } catch (err) {
      console.warn("[WorkerBridge] Failed to init physics worker:", err);
    }
  }

  /** Check if SharedArrayBuffer is available */
  static get supportsSharedMemory(): boolean {
    return typeof SharedArrayBuffer !== "undefined";
  }

  /** Terminate all workers gracefully */
  terminate(): void {
    this.physicsWorker?.postMessage({ type: "shutdown" });
    setTimeout(() => {
      this.physicsWorker?.terminate();
      this.physicsWorker = null;
    }, 100);
  }
}
