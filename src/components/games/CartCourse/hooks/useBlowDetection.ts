/**
 * useBlowDetection Hook (Phase 4)
 * Manages blow detection via microphone with tap fallback
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { BlowDetector, BlowDetectorConfig } from "../engine/BlowDetector";

// ============================================
// Hook Return Type
// ============================================

export interface UseBlowDetectionReturn {
  isBlowing: boolean;
  volume: number;
  hasPermission: boolean;
  isInitialized: boolean;
  isTapMode: boolean;
  startBlowing: () => void;
  stopBlowing: () => void;
  initialize: () => Promise<boolean>;
  cleanup: () => void;
}

// ============================================
// Hook Options
// ============================================

export interface UseBlowDetectionOptions {
  enabled?: boolean;
  autoInitialize?: boolean;
  config?: Partial<BlowDetectorConfig>;
  onBlowStart?: () => void;
  onBlowEnd?: () => void;
}

// ============================================
// useBlowDetection Hook
// ============================================

export function useBlowDetection(
  options: UseBlowDetectionOptions = {},
): UseBlowDetectionReturn {
  const {
    enabled = true,
    autoInitialize = true,
    config,
    onBlowStart,
    onBlowEnd,
  } = options;

  // State
  const [isBlowing, setIsBlowing] = useState(false);
  const [volume, setVolume] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTapMode, setIsTapMode] = useState(false);

  // Refs
  const detectorRef = useRef<BlowDetector | null>(null);
  const isBlowingRef = useRef(false);

  // Track blow state changes for callbacks
  useEffect(() => {
    if (isBlowing && !isBlowingRef.current) {
      isBlowingRef.current = true;
      onBlowStart?.();
    } else if (!isBlowing && isBlowingRef.current) {
      isBlowingRef.current = false;
      onBlowEnd?.();
    }
  }, [isBlowing, onBlowStart, onBlowEnd]);

  // Initialize detector
  const initialize = useCallback(async (): Promise<boolean> => {
    if (detectorRef.current) {
      return true;
    }

    try {
      const detector = new BlowDetector(config);
      detectorRef.current = detector;

      const initSuccess = await detector.initialize();
      setHasPermission(initSuccess);
      setIsTapMode(!initSuccess);

      if (initSuccess) {
        await detector.start(
          (blowing) => setIsBlowing(blowing),
          (vol) => setVolume(vol),
        );
      }

      setIsInitialized(true);
      return initSuccess;
    } catch (error) {
      console.error("useBlowDetection: Failed to initialize", error);
      setIsTapMode(true);
      setIsInitialized(true);
      return false;
    }
  }, [config]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (detectorRef.current) {
      detectorRef.current.stop();
      detectorRef.current = null;
    }
    setIsInitialized(false);
    setIsBlowing(false);
    setVolume(0);
  }, []);

  // Manual blow controls (for tap mode or testing)
  const startBlowing = useCallback(() => {
    if (detectorRef.current) {
      detectorRef.current.setTapActive(true);
    }
    setIsBlowing(true);
  }, []);

  const stopBlowing = useCallback(() => {
    if (detectorRef.current) {
      detectorRef.current.setTapActive(false);
    }
    setIsBlowing(false);
  }, []);

  // Auto-initialize
  useEffect(() => {
    if (enabled && autoInitialize) {
      initialize();
    }

    return () => {
      cleanup();
    };
  }, [enabled, autoInitialize, initialize, cleanup]);

  // Pause/resume based on enabled
  useEffect(() => {
    if (!detectorRef.current) return;

    if (enabled) {
      detectorRef.current.resume();
    } else {
      detectorRef.current.pause();
    }
  }, [enabled]);

  return {
    isBlowing,
    volume,
    hasPermission,
    isInitialized,
    isTapMode,
    startBlowing,
    stopBlowing,
    initialize,
    cleanup,
  };
}
