/**
 * @fileoverview RAF loop hook with drift correction and FPS tracking.
 */
"use client";

import { useEffect, useRef, useCallback } from "react";

interface AnimFrameOptions {
  onFrame: (dt: number, elapsed: number) => void;
  targetFps?: number;
  enabled?: boolean;
}

/**
 * Runs a frame callback via requestAnimationFrame with drift-corrected dt.
 */
export function useAnimationFrame({
  onFrame,
  targetFps = 60,
  enabled = true,
}: AnimFrameOptions): void {
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const callbackRef = useRef(onFrame);
  callbackRef.current = onFrame;

  const loop = useCallback(
    (timestamp: number) => {
      if (!enabled) return;

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const rawDt = timestamp - lastTimeRef.current;
      // Clamp dt: min 1ms, max 100ms (handles tab blur/focus)
      const dt = Math.max(1, Math.min(rawDt, 100)) / (1000 / targetFps);
      lastTimeRef.current = timestamp;
      elapsedRef.current += rawDt;

      callbackRef.current(dt, elapsedRef.current);

      rafRef.current = requestAnimationFrame(loop);
    },
    [enabled, targetFps]
  );

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [loop, enabled]);
}
