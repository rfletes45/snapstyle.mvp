/**
 * useBreakoutGame — React hook for Atari Breakout
 *
 * Owns the BreakoutEngine instance, drives the game loop via
 * requestAnimationFrame, and exposes state + actions for the screen.
 *
 * Performance notes:
 * - Snapshot is stored in a ref and pushed to state once per rAF frame
 * - movePaddle() mutates the engine directly without triggering a React
 *   re-render during "playing" phase (the rAF loop handles that)
 * - During "serving" phase (no rAF loop), movePaddle triggers a
 *   lightweight render loop so the paddle visually tracks the finger
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { BALL_RADIUS_PX, GAME_WIDTH, PADDLE_Y } from "./BreakoutConfig";
import { BreakoutEngine } from "./BreakoutEngine";
import type {
  BreakoutPhase,
  BreakoutResult,
  BreakoutSnapshot,
} from "./BreakoutTypes";

// =============================================================================
// Hook Return Type
// =============================================================================

export interface UseBreakoutReturn {
  /** Current game snapshot for rendering */
  snapshot: BreakoutSnapshot;
  /** Start a new game */
  startGame: () => void;
  /** Launch ball from paddle */
  launchBall: () => void;
  /** Move paddle to absolute X (game pixels) */
  movePaddle: (x: number) => void;
  /** Game result (set on game over or victory) */
  result: BreakoutResult | null;
  /** Whether a new high score was achieved */
  isNewBest: boolean;
  /** Current phase for conditional rendering */
  phase: BreakoutPhase;
  /** Debug: ball speed, hit count, speed tier */
  debug: { ballSpeed: number; hitCount: number; speedTier: number };
  /** Debug collision points (DEV only) */
  debugCollisions: { x: number; y: number; t: number }[];
}

/** Haptic trigger function type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HapticTrigger = (type: any) => void;

// =============================================================================
// Default snapshot
// =============================================================================

const DEFAULT_SNAPSHOT: BreakoutSnapshot = {
  phase: "idle",
  ball: { x: GAME_WIDTH / 2, y: PADDLE_Y - BALL_RADIUS_PX - 1 },
  paddle: { x: GAME_WIDTH / 2, width: 70 },
  bricks: [],
  score: 0,
  lives: 3,
  wall: 1,
  speedTier: 0,
  paddleShrunk: false,
  totalBrickHits: 0,
  hasBreakthroughRed: false,
  bricksDestroyed: 0,
  bestScore: 0,
};

// =============================================================================
// Hook
// =============================================================================

export function useBreakoutGame(
  /** Offset of the game area from the screen left edge (px) */
  gameAreaOffsetX: number,
  /** Offset of the game area from the top of the screen (px) */
  gameAreaOffsetY: number,
  /** Optional haptic trigger function from useGameHaptics().trigger */
  hapticTrigger?: HapticTrigger,
): UseBreakoutReturn {
  // Engine ref — lives for the lifetime of the component
  const engineRef = useRef<BreakoutEngine | null>(null);

  // State
  const [snapshot, setSnapshot] = useState<BreakoutSnapshot>(DEFAULT_SNAPSHOT);
  const [result, setResult] = useState<BreakoutResult | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  // Refs for animation loop
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<BreakoutPhase>("idle");

  // Keep offset ref always fresh (refs don't cause re-renders, so we
  // track the latest value via a ref that the gesture callback reads)
  const offsetXRef = useRef(gameAreaOffsetX);
  offsetXRef.current = gameAreaOffsetX;

  // Stable ref for haptic trigger
  const hapticRef = useRef(hapticTrigger);
  hapticRef.current = hapticTrigger;

  // Initialize engine
  useEffect(() => {
    const engine = new BreakoutEngine();
    engineRef.current = engine;

    engine.on({
      onGameOver: (r) => {
        phaseRef.current = "gameOver";
        setResult(r);
        setIsNewBest(r.isNewBest);
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setSnapshot(engine.snapshot);
      },
      onVictory: (r) => {
        phaseRef.current = "victory";
        setResult(r);
        setIsNewBest(r.isNewBest);
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setSnapshot(engine.snapshot);
      },
      onBrickHit: () => {
        hapticRef.current?.("brick_hit");
      },
      onBrickDestroyed: () => {
        hapticRef.current?.("brick_destroy");
      },
      onLifeLost: () => {
        hapticRef.current?.("life_lost");
      },
      onPaddleShrink: () => {
        hapticRef.current?.("paddle_shrink");
      },
      onSpeedTierChanged: () => {
        hapticRef.current?.("speed_up");
      },
      onWallCleared: () => {
        hapticRef.current?.("wall_cleared");
      },
      onStateChanged: () => {
        // Sync snapshot for engine-internal transitions (lifeLost→serving,
        // wallCleared→serving) that happen via setTimeout outside the rAF loop.
        setSnapshot(engine.snapshot);
        phaseRef.current = engine.phase;
      },
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      engine.destroy();
    };
  }, []);

  // Animation loop — single rAF loop drives both physics + rendering
  const gameLoop = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // Step physics (only does work during "playing" phase)
    engine.step();

    // Push one snapshot to React state per frame — this is the ONLY
    // place that triggers a re-render during active gameplay.
    setSnapshot(engine.snapshot);
    phaseRef.current = engine.phase;

    // Keep loop alive during active game phases
    const active =
      phaseRef.current === "playing" ||
      phaseRef.current === "lifeLost" ||
      phaseRef.current === "wallCleared";

    if (active) {
      rafRef.current = requestAnimationFrame(gameLoop);
    }
  }, []);

  // Start game
  const startGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    setResult(null);
    setIsNewBest(false);
    engine.startGame();
    phaseRef.current = "serving";
    setSnapshot(engine.snapshot);
  }, []);

  // Launch ball
  const launchBall = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.phase !== "serving") return;

    engine.launchBall();
    phaseRef.current = "playing";
    setSnapshot(engine.snapshot);

    // Start animation loop
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // Serving-phase render loop — lightweight loop just so the paddle
  // tracks the finger when no physics is running
  const servingLoopRef = useRef<number | null>(null);

  const startServingLoop = useCallback(() => {
    if (servingLoopRef.current) return; // already running
    const tick = () => {
      const engine = engineRef.current;
      if (!engine || engine.phase !== "serving") {
        servingLoopRef.current = null;
        return;
      }
      setSnapshot(engine.snapshot);
      servingLoopRef.current = requestAnimationFrame(tick);
    };
    servingLoopRef.current = requestAnimationFrame(tick);
  }, []);

  // Clean up serving loop on unmount
  useEffect(() => {
    return () => {
      if (servingLoopRef.current) cancelAnimationFrame(servingLoopRef.current);
    };
  }, []);

  // Move paddle (called from pan gesture — absolute screen X)
  const movePaddle = useCallback(
    (absX: number) => {
      const engine = engineRef.current;
      if (!engine) return;

      // Convert absolute screen position to game-area-relative position
      const relX = absX - offsetXRef.current;
      engine.movePaddle(relX);

      // During "serving" phase (no game loop running), kick off a
      // lightweight render loop so the paddle visually tracks the finger.
      // During "playing" phase the rAF game loop already renders every
      // frame, so we do NOT call setSnapshot here to avoid double-renders.
      if (engine.phase === "serving" && !servingLoopRef.current) {
        startServingLoop();
      }
    },
    [startServingLoop],
  );

  // Debug info
  const debug = {
    ballSpeed: engineRef.current?.debugBallSpeed ?? 0,
    hitCount: engineRef.current?.debugHitCount ?? 0,
    speedTier: engineRef.current?.debugSpeedTier ?? 0,
  };

  const debugCollisions = __DEV__
    ? (engineRef.current?.debugCollisions ?? [])
    : [];

  return {
    snapshot,
    startGame,
    launchBall,
    movePaddle,
    result,
    isNewBest,
    phase: snapshot.phase,
    debug,
    debugCollisions,
  };
}
