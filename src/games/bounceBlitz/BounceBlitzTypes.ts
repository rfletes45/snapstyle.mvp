/**
 * BounceBlitz 2.0 — Type Definitions
 *
 * Types for the Ballz-style game engine, separated from the
 * SnapStyle single-player state types (which stay in src/types/).
 */

// =============================================================================
// Physics/World State
// =============================================================================

/** Current phase of a single turn */
export type TurnPhase =
  | "idle" // waiting for first game start
  | "aiming" // player is dragging to aim
  | "shooting" // balls are in flight
  | "advancing" // end-of-turn: grid advancing, new row spawning
  | "gameOver"; // bricks reached bottom

/** A brick on the grid */
export interface Brick {
  id: number;
  row: number; // 0 = top row
  col: number; // 0–6
  hp: number; // hits remaining
  type: "normal" | "extra_ball";
}

/** A ball in play */
export interface BallState {
  id: number;
  x: number;
  y: number;
  active: boolean; // currently in flight
  returned: boolean; // hit the floor
}

/** Snapshot of the entire game state (for rendering) */
export interface BounceBlitzSnapshot {
  phase: TurnPhase;
  level: number; // current round (1-based)
  score: number; // = level reached
  ballCount: number; // total balls available this turn
  ballsReturned: number;
  bricks: Brick[];
  balls: BallState[];
  launchX: number; // X position for next launch
  aimAngle: number | null; // current aim angle (radians), null when not aiming
  speedMultiplier: number; // 1 or 2 (speed up)
  bestScore: number;
}

/** Stats emitted on game over (matches BounceBlitzStats in singlePlayerGames.ts) */
export interface BounceBlitzGameStats {
  gameType: "bounce_blitz";
  levelReached: number;
  blocksDestroyed: number;
  ballsLaunched: number; // peak ball count
  totalBounces: number;
}

/** Result of a completed game, ready for submission */
export interface BounceBlitzResult {
  score: number;
  isNewBest: boolean;
  stats: BounceBlitzGameStats;
}

/** Callback interface for engine events */
export interface BounceBlitzCallbacks {
  onBrickHit: (brickId: number, newHp: number) => void;
  onBrickDestroyed: (brickId: number) => void;
  onBallPickup: () => void;
  onBallReturned: (ballId: number, x: number, isFirst: boolean) => void;
  onAllBallsReturned: () => void;
  onGameOver: (result: BounceBlitzResult) => void;
  onStateChanged: (snapshot: BounceBlitzSnapshot) => void;
}
