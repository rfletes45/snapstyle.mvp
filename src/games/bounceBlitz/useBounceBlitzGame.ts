/**
 * useBounceBlitzGame — React hook for BounceBlitz 2.0
 *
 * Owns the BounceBlitzEngine instance, drives the game loop via
 * requestAnimationFrame, and exposes state + actions for the screen.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  BALL_RADIUS,
  GAME_HEIGHT,
  GAME_WIDTH,
  MIN_AIM_ANGLE,
  SCALE,
} from "./BounceBlitzConfig";
import { BounceBlitzEngine } from "./BounceBlitzEngine";
import type {
  BounceBlitzResult,
  BounceBlitzSnapshot,
  TurnPhase,
} from "./BounceBlitzTypes";

// =============================================================================
// Hook Return Type
// =============================================================================

export interface UseBounceBlitzReturn {
  /** Current game snapshot for rendering */
  snapshot: BounceBlitzSnapshot;
  /** Start a new game */
  startGame: () => void;
  /** Handle aim move (absolute screen coordinates) */
  handleAimMove: (absX: number, absY: number) => void;
  /** Handle aim release — fires balls */
  handleAimRelease: () => void;
  /** Current aim angle (radians) for rendering aim line */
  aimAngle: number | null;
  /** Toggle speed 1x / 2x */
  toggleSpeed: () => void;
  /** Force retract all balls and end the current turn (anti-stuck) */
  forceRetractBalls: () => void;
  /** Game result (set on game over) */
  result: BounceBlitzResult | null;
  /** Whether a new high score was achieved */
  isNewBest: boolean;
  /** Debug collision points (DEV only) */
  debugCollisions: { x: number; y: number; t: number }[];
  /** Directly access phase */
  phase: TurnPhase;
}

/** Haptic trigger function type (compatible with useGameHaptics().trigger) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HapticTrigger = (type: any) => void;

// =============================================================================
// Hook
// =============================================================================

export function useBounceBlitzGame(
  /** Offset of the game area from the screen left edge (px) */
  gameAreaOffsetX: number,
  /** Offset of the game area from the top of the screen (px) */
  gameAreaOffsetY: number,
  /** Optional haptic trigger function from useGameHaptics().trigger */
  hapticTrigger?: HapticTrigger,
): UseBounceBlitzReturn {
  // Engine ref — lives for the lifetime of the component
  const engineRef = useRef<BounceBlitzEngine | null>(null);

  // State that triggers re-render
  const [snapshot, setSnapshot] = useState<BounceBlitzSnapshot>({
    phase: "idle",
    level: 0,
    score: 0,
    ballCount: 1,
    ballsReturned: 0,
    bricks: [],
    balls: [],
    launchX: GAME_WIDTH / 2,
    aimAngle: null,
    speedMultiplier: 1,
    bestScore: 0,
  });
  const [aimAngle, setAimAngle] = useState<number | null>(null);
  const [result, setResult] = useState<BounceBlitzResult | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  // Refs for animation loop
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<TurnPhase>("idle");

  // Stable ref for haptic trigger (avoids re-creating engine on haptic changes)
  const hapticRef = useRef(hapticTrigger);
  hapticRef.current = hapticTrigger;

  // Initialize engine
  useEffect(() => {
    const engine = new BounceBlitzEngine();
    engineRef.current = engine;

    engine.on({
      onGameOver: (r) => {
        phaseRef.current = "gameOver";
        setResult(r);
        setIsNewBest(r.isNewBest);
        // Stop animation loop
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        // Update snapshot one final time
        setSnapshot(engine.snapshot);
      },
      onStateChanged: () => {
        // State is synced via the game loop's setSnapshot(engine.snapshot)
      },
      onBrickHit: () => {
        hapticRef.current?.("brick_hit");
      },
      onBallPickup: () => {
        hapticRef.current?.("powerup_collect");
      },
      onBrickDestroyed: () => {
        hapticRef.current?.("brick_destroy");
      },
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      engine.destroy();
    };
  }, []);

  // Animation loop
  const gameLoop = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const needsRender = engine.step();
    if (needsRender) {
      setSnapshot(engine.snapshot);
    }

    // Sync phaseRef with engine phase to stop loop when turn ends
    phaseRef.current = engine.phase;

    if (phaseRef.current === "shooting") {
      rafRef.current = requestAnimationFrame(gameLoop);
    }
  }, []);

  // Start game
  const startGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    setResult(null);
    setIsNewBest(false);
    setAimAngle(null);
    engine.startGame();
    phaseRef.current = "aiming";
    setSnapshot(engine.snapshot);
  }, []);

  // Aim move handler (called from pan gesture)
  const handleAimMove = useCallback(
    (absX: number, absY: number) => {
      const engine = engineRef.current;
      if (!engine || engine.phase !== "aiming") return;

      // Convert absolute screen position to game-area-relative position
      const relX = absX - gameAreaOffsetX;
      const relY = absY - gameAreaOffsetY;

      // Calculate angle from launch point to touch position
      const launchY = GAME_HEIGHT - BALL_RADIUS * SCALE - 2;
      const dx = relX - engine.launchX;
      const dy = relY - launchY;

      // Only allow aiming upward (dy < 0 in screen coords)
      if (dy >= -10) return;

      let angle = Math.atan2(dy, dx);
      // Clamp to prevent near-horizontal shots
      angle = Math.max(
        -Math.PI + MIN_AIM_ANGLE,
        Math.min(-MIN_AIM_ANGLE, angle),
      );

      setAimAngle(angle);
    },
    [gameAreaOffsetX, gameAreaOffsetY],
  );

  // Aim release handler
  const handleAimRelease = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.phase !== "aiming") return;

    // Read latest aim angle from ref-like state
    setAimAngle((currentAngle) => {
      if (currentAngle !== null && engine.phase === "aiming") {
        engine.shoot(currentAngle);
        phaseRef.current = "shooting";
        setSnapshot(engine.snapshot);

        // Start animation loop
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(gameLoop);
      }
      return null; // clear aim angle
    });
  }, [gameLoop]);

  // Toggle speed
  const toggleSpeed = useCallback(() => {
    engineRef.current?.toggleSpeed();
  }, []);

  // Force retract all balls (anti-stuck mechanic)
  const forceRetractBalls = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.phase !== "shooting") return;
    engine.forceEndTurn();
    // The engine will call onGameOver or onAllBallsReturned as needed,
    // and the game loop will stop via phaseRef check.
  }, []);

  // Debug collisions (only in DEV)
  const debugCollisions = __DEV__
    ? (engineRef.current?.debugCollisions ?? [])
    : [];

  return {
    snapshot,
    startGame,
    handleAimMove,
    handleAimRelease,
    aimAngle,
    toggleSpeed,
    forceRetractBalls,
    result,
    isNewBest,
    debugCollisions,
    phase: snapshot.phase,
  };
}
