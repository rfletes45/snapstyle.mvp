/**
 * USE FACE DETECTION HOOK
 *
 * Provides real-time face detection via react-native-vision-camera-face-detector.
 * Converts MLKit face results into our internal DetectedFace format and provides
 * smooth face tracking with configurable jitter reduction.
 *
 * Usage:
 *   const { detectedFaces, isActive, faceDetectionOptions, handleFacesDetected }
 *     = useFaceDetection({ enabled: true });
 *
 *   // Pass faceDetectionOptions and handleFacesDetected to VisionCamera's
 *   // <Camera> component as faceDetectionOptions and faceDetectionCallback props.
 */

import {
  convertMLKitFaces,
  type MLKitFace,
} from "@/services/camera/nativeFaceDetection";
import type { DetectedFace } from "@/types/camera";
import { createLogger } from "@/utils/log";
import { useCallback, useRef, useState } from "react";

const logger = createLogger("hooks/camera/useFaceDetection");

// ─── Smoothing Configuration ─────────────────────────────────────────────────

/** Number of previous frames to average for position smoothing */
const SMOOTHING_WINDOW = 3;

/** Maximum jump (in px) before we snap instead of interpolate */
const MAX_JUMP_THRESHOLD = 80;

/** Lerp factor: 0 = no smoothing, 1 = instant. 0.35 feels natural. */
const LERP_FACTOR = 0.35;

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseFaceDetectionOptions {
  /** Whether face detection is active */
  enabled?: boolean;
  /** Smoothing window size (default: 3) */
  smoothingWindow?: number;
}

interface UseFaceDetectionReturn {
  /** Currently detected faces with smoothed positions */
  detectedFaces: DetectedFace[];
  /** Whether any face is currently detected */
  hasFaces: boolean;
  /** Whether detection is active */
  isActive: boolean;
  /** Number of faces detected */
  faceCount: number;
  /** The primary (largest) detected face, or null */
  primaryFace: DetectedFace | null;
  /** Face detection options to pass to VisionCamera */
  faceDetectionOptions: Record<string, any>;
  /** Callback to pass to VisionCamera's faceDetectionCallback */
  handleFacesDetected: (faces: any[], frame: any) => void;
  /** Manually clear detected faces */
  clearFaces: () => void;
}

// ─── Smoothing Helpers ───────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothFace(
  current: DetectedFace,
  history: DetectedFace[],
): DetectedFace {
  if (history.length === 0) return current;

  const prev = history[history.length - 1];

  // Detect large jumps → snap instantly (face re-appeared or new face)
  const dx = Math.abs(current.bounds.x - prev.bounds.x);
  const dy = Math.abs(current.bounds.y - prev.bounds.y);
  if (dx > MAX_JUMP_THRESHOLD || dy > MAX_JUMP_THRESHOLD) {
    return current;
  }

  // Smooth the bounding box
  const smoothedBounds = {
    x: lerp(prev.bounds.x, current.bounds.x, LERP_FACTOR),
    y: lerp(prev.bounds.y, current.bounds.y, LERP_FACTOR),
    width: lerp(prev.bounds.width, current.bounds.width, LERP_FACTOR),
    height: lerp(prev.bounds.height, current.bounds.height, LERP_FACTOR),
  };

  // Smooth landmark positions
  const smoothedLandmarks = { ...current.landmarks };
  const landmarkKeys = Object.keys(current.landmarks) as Array<
    keyof typeof current.landmarks
  >;
  for (const key of landmarkKeys) {
    smoothedLandmarks[key] = {
      x: lerp(prev.landmarks[key].x, current.landmarks[key].x, LERP_FACTOR),
      y: lerp(prev.landmarks[key].y, current.landmarks[key].y, LERP_FACTOR),
    };
  }

  // Smooth Euler angles
  const smoothedAngles = {
    eulerAngleX: lerp(prev.eulerAngleX, current.eulerAngleX, LERP_FACTOR),
    eulerAngleY: lerp(prev.eulerAngleY, current.eulerAngleY, LERP_FACTOR),
    eulerAngleZ: lerp(prev.eulerAngleZ, current.eulerAngleZ, LERP_FACTOR),
  };

  return {
    ...current,
    bounds: smoothedBounds,
    landmarks: smoothedLandmarks,
    ...smoothedAngles,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFaceDetection(
  options: UseFaceDetectionOptions = {},
): UseFaceDetectionReturn {
  const { enabled = true, smoothingWindow = SMOOTHING_WINDOW } = options;

  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);

  // History buffer per face trackingId for smoothing
  const faceHistory = useRef<Map<number, DetectedFace[]>>(new Map());

  // Throttle: only update React state every N ms to avoid excessive re-renders
  const lastUpdateTime = useRef(0);
  const UPDATE_INTERVAL_MS = 33; // ~30 FPS state updates

  // ─── Face detection options for VisionCamera ─────────────────────────

  const faceDetectionOptions = useRef({
    performanceMode: "fast" as const,
    landmarkMode: "all" as const,
    contourMode: "none" as const,
    classificationMode: "all" as const,
    minFaceSize: 0.15,
    trackingEnabled: true,
  }).current;

  // ─── Process detected faces from VisionCamera's callback ─────────────

  const handleFacesDetected = useCallback(
    (faces: any[], _frame: any) => {
      if (!enabled) return;

      const now = Date.now();
      if (now - lastUpdateTime.current < UPDATE_INTERVAL_MS) return;
      lastUpdateTime.current = now;

      if (!faces || faces.length === 0) {
        if (detectedFaces.length > 0) {
          setDetectedFaces([]);
          faceHistory.current.clear();
        }
        return;
      }

      // Convert MLKit faces to our internal format
      const result = convertMLKitFaces(faces as MLKitFace[]);

      // Apply smoothing per face
      const smoothedFaces = result.faces.map((face) => {
        const id = face.trackingId;
        const history = faceHistory.current.get(id) || [];

        const smoothed = smoothFace(face, history);

        // Update history buffer
        const newHistory = [...history, smoothed].slice(-smoothingWindow);
        faceHistory.current.set(id, newHistory);

        return smoothed;
      });

      // Clean up stale face histories (faces no longer detected)
      const currentIds = new Set(smoothedFaces.map((f) => f.trackingId));
      for (const id of faceHistory.current.keys()) {
        if (!currentIds.has(id)) {
          faceHistory.current.delete(id);
        }
      }

      setDetectedFaces(smoothedFaces);
    },
    [enabled, smoothingWindow, detectedFaces.length],
  );

  // ─── Clear faces (e.g., when disabling detection) ────────────────────

  const clearFaces = useCallback(() => {
    setDetectedFaces([]);
    faceHistory.current.clear();
  }, []);

  // ─── Derived state ───────────────────────────────────────────────────

  const hasFaces = detectedFaces.length > 0;
  const faceCount = detectedFaces.length;

  // Primary face = the one with the largest bounding box area
  const primaryFace =
    detectedFaces.length > 0
      ? detectedFaces.reduce((largest, face) =>
          face.bounds.width * face.bounds.height >
          largest.bounds.width * largest.bounds.height
            ? face
            : largest,
        )
      : null;

  return {
    detectedFaces,
    hasFaces,
    isActive: enabled,
    faceCount,
    primaryFace,
    faceDetectionOptions,
    handleFacesDetected,
    clearFaces,
  };
}
