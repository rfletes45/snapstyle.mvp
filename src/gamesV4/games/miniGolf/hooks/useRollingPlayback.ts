/**
 * Mini Golf — Rolling Playback Hook
 *
 * When publicState.phase === "rolling", this hook:
 *  1. Precomputes an array of per-frame ball positions by re-running the
 *     deterministic Planck sim from rolling.startPos with rolling.angleQ/powerQ.
 *  2. Drives a requestAnimationFrame loop that steps through the positions
 *     at 60 fps, exposing the current animated position.
 *  3. When playback completes (or after rollDurationMs + safety buffer),
 *     calls onFinishRoll so the screen can submit the finish_roll move.
 *
 * The hook is designed to be deterministic across clients — every client
 * replaying the same rolling payload will generate identical positions.
 *
 * @module gamesV4/games/miniGolf/hooks/useRollingPlayback
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { simulateShotPositions } from "../physics/sim";
import type { HoleDef, RollingPayload, Vec2 } from "../types";

// Safety: auto-finish this many ms after rollDurationMs
const FINISH_SAFETY_BUFFER_MS = 1500;
// Target frame duration for stepping (60 fps ≈ 16.67ms)
const FRAME_DT_MS = 1000 / 60;

export interface RollingPlaybackState {
  /** Whether a rolling animation is currently playing */
  isRolling: boolean;
  /** Animated ball position in world coordinates (null if not rolling) */
  animatedPos: Vec2 | null;
  /** Current playback progress [0..1] */
  progress: number;
  /** Current frame index */
  frameIndex: number;
  /** Total frames in the playback */
  totalFrames: number;
}

export function useRollingPlayback(
  rolling: RollingPayload | null | undefined,
  currentHole: HoleDef | null,
  onFinishRoll: (shotId: string) => void,
): RollingPlaybackState {
  const [animatedPos, setAnimatedPos] = useState<Vec2 | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);

  // Precomputed positions array
  const positionsRef = useRef<Vec2[]>([]);
  // Track the current shotId to avoid re-triggering
  const activeShotIdRef = useRef<string | null>(null);
  // Track whether we've already called onFinishRoll for this shot
  const finishedRef = useRef(false);
  // RAF handle
  const rafRef = useRef<number | null>(null);
  // Start timestamp for playback
  const startTimeRef = useRef(0);
  // onFinishRoll ref to avoid stale closures
  const onFinishRollRef = useRef(onFinishRoll);
  onFinishRollRef.current = onFinishRoll;

  // Cleanup
  const stopPlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsRolling(false);
    setAnimatedPos(null);
    setProgress(0);
    setFrameIndex(0);
    setTotalFrames(0);
    positionsRef.current = [];
  }, []);

  useEffect(() => {
    // If rolling is cleared or hole is missing, stop
    if (!rolling || !currentHole) {
      if (activeShotIdRef.current) {
        activeShotIdRef.current = null;
        stopPlayback();
      }
      return;
    }

    // If this is a new shot, start playback
    if (rolling.shotId === activeShotIdRef.current) {
      return; // already playing this shot
    }

    activeShotIdRef.current = rolling.shotId;
    finishedRef.current = false;

    if (__DEV__) {
      console.log(
        `[RollingPlayback] Starting playback for shot ${rolling.shotId}, ` +
          `steps=${rolling.totalSteps}, duration=${rolling.rollDurationMs}ms`,
      );
    }

    // Precompute positions
    const positions = simulateShotPositions(
      currentHole,
      rolling.startPos,
      rolling.angleQ,
      rolling.powerQ,
      rolling.totalSteps,
    );
    positionsRef.current = positions;
    setTotalFrames(positions.length);
    setIsRolling(true);

    if (positions.length === 0) {
      // Edge case: no steps to replay
      finishedRef.current = true;
      setIsRolling(false);
      onFinishRollRef.current(rolling.shotId);
      return;
    }

    // Set initial position
    setAnimatedPos(positions[0]);
    setFrameIndex(0);
    setProgress(0);

    // Start playback loop
    startTimeRef.current = performance.now();
    const safetyDeadline = rolling.rollDurationMs + FINISH_SAFETY_BUFFER_MS;

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const currentFrame = Math.min(
        Math.floor(elapsed / FRAME_DT_MS),
        positions.length - 1,
      );

      setAnimatedPos(positions[currentFrame]);
      setFrameIndex(currentFrame);
      setProgress(
        positions.length > 1 ? currentFrame / (positions.length - 1) : 1,
      );

      // Check if playback complete
      if (currentFrame >= positions.length - 1 || elapsed >= safetyDeadline) {
        // Set final position
        setAnimatedPos(positions[positions.length - 1]);
        setProgress(1);
        setFrameIndex(positions.length - 1);

        if (!finishedRef.current) {
          finishedRef.current = true;
          if (__DEV__) {
            console.log(
              `[RollingPlayback] Playback complete for shot ${rolling.shotId}, ` +
                `frame=${currentFrame}/${positions.length}, elapsed=${elapsed.toFixed(0)}ms`,
            );
          }
          // Small delay to let the final frame render before committing
          setTimeout(() => {
            onFinishRollRef.current(rolling.shotId);
          }, 100);
        }
        return; // stop RAF loop
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [rolling?.shotId, currentHole, stopPlayback]);

  // Extra safety: if rolling persists way too long, force finish
  useEffect(() => {
    if (!rolling || finishedRef.current) return;
    const timeout = setTimeout(
      () => {
        if (
          !finishedRef.current &&
          activeShotIdRef.current === rolling.shotId
        ) {
          finishedRef.current = true;
          if (__DEV__) {
            console.warn(
              `[RollingPlayback] SAFETY TIMEOUT for shot ${rolling.shotId}`,
            );
          }
          onFinishRollRef.current(rolling.shotId);
        }
      },
      rolling.rollDurationMs + FINISH_SAFETY_BUFFER_MS + 2000,
    );
    return () => clearTimeout(timeout);
  }, [rolling?.shotId, rolling?.rollDurationMs]);

  return {
    isRolling,
    animatedPos,
    progress,
    frameIndex,
    totalFrames,
  };
}
