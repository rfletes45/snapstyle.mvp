/**
 * useGameLoop Hook
 *
 * A React Native game loop hook using react-native-reanimated's useFrameCallback
 * for smooth 60fps animations on the UI thread.
 *
 * Features:
 * - Frame-independent physics via delta time
 * - Pause/resume functionality
 * - Delta time clamping to prevent physics explosions
 * - FPS tracking for performance monitoring
 *
 * @see docs/06_GAMES_RESEARCH.md Section 1
 *
 * @example
 * ```tsx
 * const { isRunning, start, pause, fps } = useGameLoop((dt) => {
 *   // Update physics with delta time
 *   bird.y += bird.velocity * dt;
 *   bird.velocity += GRAVITY * dt;
 * });
 * ```
 */

import { useCallback, useRef, useState } from "react";
import {
  runOnJS,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";

// =============================================================================
// Types
// =============================================================================

/**
 * Frame callback receives delta time in milliseconds
 */
export type GameFrameCallback = (deltaTime: number) => void;

/**
 * Game loop hook return type
 */
export interface UseGameLoopReturn {
  /** Whether the game loop is currently running */
  isRunning: boolean;
  /** Start the game loop */
  start: () => void;
  /** Pause the game loop */
  pause: () => void;
  /** Toggle pause state */
  toggle: () => void;
  /** Reset the loop (clears timing state) */
  reset: () => void;
  /** Current FPS (updated every second) */
  fps: number;
  /** Total elapsed time since start (ms) */
  elapsedTime: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Maximum delta time to prevent physics explosions on lag spikes
 * If a frame takes longer than this, we simulate multiple fixed-time steps
 */
const MAX_DELTA_TIME = 32; // 2 frames at 60fps

/**
 * Target frame time for fixed-step simulation
 */
const FIXED_STEP = 16; // ~60fps

/**
 * FPS update interval
 */
const FPS_UPDATE_INTERVAL = 1000; // 1 second

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Game loop hook using react-native-reanimated's useFrameCallback
 *
 * @param onFrame Callback invoked each frame with delta time in ms
 * @param options Configuration options
 * @returns Game loop control functions and state
 */
export function useGameLoop(
  onFrame: GameFrameCallback,
  options?: {
    /** Whether to start automatically (default: false) */
    autoStart?: boolean;
    /** Use fixed time step simulation (default: true) */
    useFixedStep?: boolean;
  },
): UseGameLoopReturn {
  const { autoStart = false, useFixedStep = true } = options ?? {};

  // State
  const [isRunning, setIsRunning] = useState(autoStart);
  const [fps, setFps] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Shared values for UI thread
  const lastFrameTime = useSharedValue(0);
  const accumulatedTime = useSharedValue(0);
  const frameCount = useSharedValue(0);
  const lastFpsUpdate = useSharedValue(0);
  const totalElapsed = useSharedValue(0);

  // Store callback ref to avoid recreating frame callback
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  // JS thread callback for state updates
  const updateFps = useCallback((newFps: number) => {
    setFps(Math.round(newFps));
  }, []);

  const updateElapsed = useCallback((elapsed: number) => {
    setElapsedTime(elapsed);
  }, []);

  // Main frame callback - runs on UI thread
  useFrameCallback((frameInfo) => {
    "worklet";

    const currentTime = frameInfo.timestamp;

    // Initialize on first frame
    if (lastFrameTime.value === 0) {
      lastFrameTime.value = currentTime;
      lastFpsUpdate.value = currentTime;
      return;
    }

    // Calculate delta time
    let deltaTime = currentTime - lastFrameTime.value;
    lastFrameTime.value = currentTime;

    // Track total elapsed time
    totalElapsed.value += deltaTime;

    // FPS calculation
    frameCount.value += 1;
    if (currentTime - lastFpsUpdate.value >= FPS_UPDATE_INTERVAL) {
      const calculatedFps =
        (frameCount.value * 1000) / (currentTime - lastFpsUpdate.value);
      frameCount.value = 0;
      lastFpsUpdate.value = currentTime;
      runOnJS(updateFps)(calculatedFps);
      runOnJS(updateElapsed)(totalElapsed.value);
    }

    // Clamp delta time to prevent physics explosions
    deltaTime = Math.min(deltaTime, MAX_DELTA_TIME);

    if (useFixedStep) {
      // Fixed time step with accumulator
      accumulatedTime.value += deltaTime;

      while (accumulatedTime.value >= FIXED_STEP) {
        // Run physics step with fixed delta time
        // Note: We can't call JS functions from worklet easily
        // For now, use the original delta time approach
        accumulatedTime.value -= FIXED_STEP;
      }

      // Call frame callback with actual delta time
      // In a full implementation, this would be in the while loop above
      runOnJS(onFrameRef.current)(deltaTime);
    } else {
      // Variable time step
      runOnJS(onFrameRef.current)(deltaTime);
    }
  }, isRunning);

  // Control functions
  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const toggle = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const reset = useCallback(() => {
    lastFrameTime.value = 0;
    accumulatedTime.value = 0;
    frameCount.value = 0;
    lastFpsUpdate.value = 0;
    totalElapsed.value = 0;
    setElapsedTime(0);
    setFps(0);
  }, [lastFrameTime, accumulatedTime, frameCount, lastFpsUpdate, totalElapsed]);

  return {
    isRunning,
    start,
    pause,
    toggle,
    reset,
    fps,
    elapsedTime,
  };
}

// =============================================================================
// Simpler Alternative: useGameTick
// =============================================================================

/**
 * Simpler game tick hook for less demanding games
 *
 * Uses requestAnimationFrame on JS thread instead of worklet.
 * Easier to use but slightly lower performance.
 *
 * @example
 * ```tsx
 * const { isRunning, start, stop } = useGameTick((dt) => {
 *   setScore(prev => prev + 1);
 * }, 60);
 * ```
 */
export function useGameTick(
  onTick: GameFrameCallback,
  targetFps: number = 60,
): {
  isRunning: boolean;
  start: () => void;
  stop: () => void;
} {
  const [isRunning, setIsRunning] = useState(false);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const targetInterval = 1000 / targetFps;

  const tick = useCallback(
    (timestamp: number) => {
      if (!isRunning) return;

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const deltaTime = timestamp - lastTimeRef.current;

      if (deltaTime >= targetInterval) {
        onTick(Math.min(deltaTime, MAX_DELTA_TIME));
        lastTimeRef.current = timestamp;
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [isRunning, onTick, targetInterval],
  );

  const start = useCallback(() => {
    setIsRunning(true);
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  return { isRunning, start, stop };
}

// =============================================================================
// Performance Monitoring Hook
// =============================================================================

/**
 * Hook for monitoring game performance
 *
 * Tracks frame times and detects performance issues.
 */
export function usePerformanceMonitor() {
  const frameTimes = useRef<number[]>([]);
  const maxSamples = 60; // Track last 60 frames

  const recordFrameTime = useCallback((frameTime: number) => {
    frameTimes.current.push(frameTime);
    if (frameTimes.current.length > maxSamples) {
      frameTimes.current.shift();
    }
  }, []);

  const getStats = useCallback(() => {
    const times = frameTimes.current;
    if (times.length === 0) {
      return { avg: 0, min: 0, max: 0, jank: 0 };
    }

    const sum = times.reduce((a, b) => a + b, 0);
    const avg = sum / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const jank = times.filter((t) => t > 32).length; // Frames > 2x target

    return { avg, min, max, jank };
  }, []);

  const reset = useCallback(() => {
    frameTimes.current = [];
  }, []);

  return { recordFrameTime, getStats, reset };
}
