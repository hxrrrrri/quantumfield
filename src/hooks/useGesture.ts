/**
 * @fileoverview MediaPipe hand gesture detection hook.
 * Provides real-time hand landmark data from webcam.
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GestureState } from "@/types";

const GESTURE_DEBOUNCE_MS = 200;

function detectGesture(
  landmarks: number[][]
): { gesture: string; confidence: number } {
  if (!landmarks.length) return { gesture: "none", confidence: 0 };

  const thumb = landmarks[4]!;
  const index = landmarks[8]!;
  const middle = landmarks[12]!;
  const ring = landmarks[16]!;
  const pinky = landmarks[20]!;
  const wrist = landmarks[0]!;
  const palm = landmarks[9]!;

  // Fingertip y positions relative to wrist
  const tipY = [thumb, index, middle, ring, pinky].map((tip) => tip[1]! - wrist[1]!);
  const extended = tipY.map((y) => y < -0.05);

  // Open palm: all 5 fingers extended
  if (extended.every(Boolean)) {
    return { gesture: "open_palm", confidence: 0.9 };
  }

  // Closed fist: no fingers extended
  if (!extended.some(Boolean)) {
    return { gesture: "fist", confidence: 0.9 };
  }

  // Pinch: thumb + index close together, rest extended
  const pinchDist = Math.hypot(
    thumb[0]! - index[0]!,
    thumb[1]! - index[1]!
  );
  if (pinchDist < 0.06 && extended[2] && extended[3]) {
    return { gesture: "pinch", confidence: 0.85 };
  }

  // Peace/V sign: index + middle extended, others closed
  if (extended[1] && extended[2] && !extended[3] && !extended[4]) {
    return { gesture: "peace", confidence: 0.8 };
  }

  // Point: only index extended
  if (extended[1] && !extended[2] && !extended[3] && !extended[4]) {
    return { gesture: "point", confidence: 0.85 };
  }

  // Thumbs up: thumb extended upward, others closed
  if (extended[0] && !extended[1] && !extended[2] && !extended[3] && !extended[4]) {
    return { gesture: "thumbs_up", confidence: 0.8 };
  }

  return { gesture: "unknown", confidence: 0.5 };
}

/**
 * MediaPipe hands gesture tracking hook.
 * Returns gesture state and start/stop controls.
 */
export function useGesture(): {
  gestureState: GestureState;
  startTracking: () => void;
  stopTracking: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
} {
  const [gestureState, setGestureState] = useState<GestureState>({
    isOpen: false,
    landmarks: null,
    gesture: null,
    confidence: 0,
    palmCenter: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastGestureTime = useRef(0);
  const handsRef = useRef<unknown>(null);

  const stopTracking = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
    }
    setGestureState((s) => ({ ...s, isOpen: false, landmarks: null, gesture: null }));
  }, []);

  const startTracking = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Dynamic import to avoid SSR issues
      const { Hands } = await import("@mediapipe/hands");

      const hands = new Hands({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results: { multiHandLandmarks?: number[][][] }) => {
        if (!results.multiHandLandmarks?.length) {
          setGestureState((s) => ({
            ...s,
            landmarks: null,
            gesture: null,
            palmCenter: null,
          }));
          return;
        }

        const lm = results.multiHandLandmarks[0]!;
        const flatLm = lm.map((p) => [p[0]!, p[1]!, p[2] ?? 0]);
        const palm = flatLm[9]!;

        const now = Date.now();
        let gesture = gestureState.gesture;
        let confidence = gestureState.confidence;

        if (now - lastGestureTime.current > GESTURE_DEBOUNCE_MS) {
          const detected = detectGesture(flatLm);
          gesture = detected.gesture;
          confidence = detected.confidence;
          lastGestureTime.current = now;
        }

        setGestureState({
          isOpen: true,
          landmarks: flatLm,
          gesture,
          confidence,
          palmCenter: { x: palm[0]!, y: palm[1]! },
        });
      });

      handsRef.current = hands;
      setGestureState((s) => ({ ...s, isOpen: true }));
    } catch (err) {
      console.warn("[useGesture] Camera access denied:", err);
      setGestureState((s) => ({
        ...s,
        isOpen: false,
        gesture: "permission_denied",
      }));
    }
  }, [gestureState.gesture, gestureState.confidence]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return { gestureState, startTracking, stopTracking, videoRef };
}
