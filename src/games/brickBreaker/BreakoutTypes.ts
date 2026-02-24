/**
 * Breakout (Atari) — Type Definitions
 *
 * Types for the classic Breakout engine, separated from the
 * SnapStyle single-player state types (which stay in src/types/).
 */

import type { BrickColor } from "./BreakoutConfig";

// =============================================================================
// Game Phase
// =============================================================================

/** Current phase of the Breakout game */
export type BreakoutPhase =
  | "idle" // before first game
  | "serving" // ball on paddle, waiting for launch
  | "playing" // ball in flight
  | "lifeLost" // brief delay after losing a life
  | "wallCleared" // brief delay after clearing a wall
  | "gameOver" // all lives lost
  | "victory"; // both walls cleared

// =============================================================================
// Entities
// =============================================================================

/** A brick in the wall */
export interface BreakoutBrick {
  id: number;
  row: number; // 0 = bottom row (yellow), 7 = top row (red)
  col: number; // 0–13
  color: BrickColor;
  points: number;
  alive: boolean;
}

/** Ball state (for rendering) */
export interface BreakoutBallState {
  x: number; // px
  y: number; // px
}

/** Paddle state (for rendering) */
export interface BreakoutPaddleState {
  x: number; // center x, px
  width: number; // current width, px
}

// =============================================================================
// Speed Tier Flags
// =============================================================================

/** One-shot speed tier flags — each fires at most once per game */
export interface SpeedTierFlags {
  /** After 4 total brick hits */
  tier4Hits: boolean;
  /** After 12 total brick hits */
  tier12Hits: boolean;
  /** After first orange-row brick contact */
  tierOrangeContact: boolean;
  /** After first red-row brick contact */
  tierRedContact: boolean;
}

// =============================================================================
// Snapshot (Engine → Renderer)
// =============================================================================

/** Read-only snapshot of the entire game state for rendering */
export interface BreakoutSnapshot {
  phase: BreakoutPhase;
  ball: BreakoutBallState;
  paddle: BreakoutPaddleState;
  bricks: BreakoutBrick[];
  score: number;
  lives: number;
  wall: number; // 1 or 2
  speedTier: number; // 0–4 (index into SPEED_TIERS)
  paddleShrunk: boolean;
  totalBrickHits: number;

  /** Has the ball broken through the red row (touched a red brick)? */
  hasBreakthroughRed: boolean;
  /** Total bricks destroyed this game */
  bricksDestroyed: number;
  /** Best score ever (for display) */
  bestScore: number;
}

// =============================================================================
// Game Result
// =============================================================================

/** Stats emitted at game end (matches SnapStyle session recording) */
export interface BreakoutGameStats {
  gameType: "brick_breaker";
  wallsCleared: number;
  bricksDestroyed: number;
  maxSpeedTier: number;
  paddleShrinkTriggered: boolean;
  livesRemaining: number;
}

/** Result of a completed game */
export interface BreakoutResult {
  score: number;
  isNewBest: boolean;
  stats: BreakoutGameStats;
  outcome: "win" | "lose";
}

// =============================================================================
// Callbacks
// =============================================================================

/** Callback interface for engine events */
export interface BreakoutCallbacks {
  onBrickHit: (brickId: number) => void;
  onBrickDestroyed: (brickId: number, color: BrickColor) => void;
  onLifeLost: (livesRemaining: number) => void;
  onWallCleared: (wallNumber: number) => void;
  onSpeedTierChanged: (tier: number) => void;
  onPaddleShrink: () => void;
  onGameOver: (result: BreakoutResult) => void;
  onVictory: (result: BreakoutResult) => void;
  onStateChanged: (snapshot: BreakoutSnapshot) => void;
}

// =============================================================================
// Fixture UserData Tags
// =============================================================================

export interface WallUserData {
  kind: "wall";
}
export interface CeilingUserData {
  kind: "ceiling";
}
export interface BrickUserData {
  kind: "brick";
  brickId: number;
}
export interface PaddleUserData {
  kind: "paddle";
}
export interface DrainUserData {
  kind: "drain";
}
export interface BallUserData {
  kind: "ball";
}

export type FixtureUserData =
  | WallUserData
  | CeilingUserData
  | BrickUserData
  | PaddleUserData
  | DrainUserData
  | BallUserData;
