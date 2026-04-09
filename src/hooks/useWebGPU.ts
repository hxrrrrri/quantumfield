/**
 * @fileoverview WebGPU detection and device initialization hook.
 * Falls back to WebGL2 if WebGPU is unavailable.
 */
"use client";

import { useState, useEffect, useRef } from "react";
import type { RenderMode } from "@/types";

interface WebGPUState {
  renderMode: RenderMode;
  device: GPUDevice | null;
  adapter: GPUAdapter | null;
  isReady: boolean;
  error: string | null;
}

/**
 * Detect WebGPU availability and initialize device.
 * Sets renderMode to "webgl2" if WebGPU is not supported.
 */
export function useWebGPU(): WebGPUState {
  const [state, setState] = useState<WebGPUState>({
    renderMode: "webgl2",
    device: null,
    adapter: null,
    isReady: false,
    error: null,
  });

  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      if (!navigator.gpu) {
        setState((s) => ({ ...s, renderMode: "webgl2", isReady: true }));
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: "high-performance",
        });

        if (!adapter) {
          setState((s) => ({
            ...s,
            renderMode: "webgl2",
            isReady: true,
            error: "No WebGPU adapter found",
          }));
          return;
        }

        const device = await adapter.requestDevice({
          requiredLimits: {
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
            maxComputeWorkgroupSizeX: 256,
          },
        });

        device.addEventListener("uncapturederror", (e: any) => {
          console.error("[WebGPU] Uncaptured error:", e);
        });

        setState({
          renderMode: "webgpu",
          device,
          adapter,
          isReady: true,
          error: null,
        });
      } catch (err) {
        setState({
          renderMode: "webgl2",
          device: null,
          adapter: null,
          isReady: true,
          error: err instanceof Error ? err.message : "WebGPU init failed",
        });
      }
    }

    void init();
  }, []);

  return state;
}
