/**
 * Brick Breaker — Type Definitions
 *
 * Shared types for the simulation core, adapters, and UI.
 *
 * @module gamesV4/games/brickBreaker/types
 */

// =============================================================================
// Brick Types
// =============================================================================

export interface BrickInfo {
  /** Hits to destroy. 0 = unbreakable (steel). -1 = empty. */
  hp: number;
  breakable: boolean;
  score: number;
  name: string;
}

export const BRICK_DEFS: Record<string, BrickInfo> = {
  ".": { hp: -1, breakable: false, score: 0, name: "empty" },
  " ": { hp: -1, breakable: false, score: 0, name: "empty" },
  N: { hp: 1, breakable: true, score: 10, name: "normal" },
  H: { hp: 2, breakable: true, score: 25, name: "hard" },
  V: { hp: 3, breakable: true, score: 60, name: "heavy" },
  S: { hp: 0, breakable: false, score: 0, name: "steel" },
  E: { hp: 1, breakable: true, score: 40, name: "explosive" },
  P: { hp: 1, breakable: true, score: 20, name: "power" },
  M: { hp: 1, breakable: true, score: 30, name: "moving" },
};

// =============================================================================
// Powerup Types
// =============================================================================

export type PowerupKind =
  | "expand"
  | "shrink"
  | "multiball"
  | "slow"
  | "fast"
  | "sticky"
  | "laser"
  | "shield"
  | "extraLife";

export const POWERUP_POOL: PowerupKind[] = [
  "expand",
  "shrink",
  "multiball",
  "slow",
  "fast",
  "sticky",
  "laser",
  "shield",
  "extraLife",
];

export const POWERUP_WEIGHTS: Record<PowerupKind, number> = {
  expand: 15,
  shrink: 10,
  multiball: 8,
  slow: 12,
  fast: 10,
  sticky: 5,
  laser: 5,
  shield: 8,
  extraLife: 3,
};

export const POWERUP_COLORS: Record<PowerupKind, string> = {
  expand: "#4CAF50",
  shrink: "#F44336",
  multiball: "#2196F3",
  slow: "#00BCD4",
  fast: "#FF5722",
  sticky: "#9C27B0",
  laser: "#FF9800",
  shield: "#3F51B5",
  extraLife: "#E91E63",
};

export const POWERUP_ICONS: Record<PowerupKind, string> = {
  expand: "↔",
  shrink: "→←",
  multiball: "●●●",
  slow: "🐢",
  fast: "⚡",
  sticky: "🧲",
  laser: "🔫",
  shield: "🛡",
  extraLife: "❤",
};

// =============================================================================
// Level Definition
// =============================================================================

export interface LevelDef {
  id: number;
  name: string;
  ballSpeed: number;
  paddle: number;
  powerRate: number;
  rows: string[];
}

// =============================================================================
// Input Samples (for replay)
// =============================================================================

export interface InputSample {
  /** Physics tick index (0-based, global across run). */
  tick: number;
  /** Paddle target X, normalized 0..1. */
  x: number;
  /** Optional action: 1=launch ball, 2=fire laser. */
  a?: number;
}

export const ACTION_LAUNCH = 1;
export const ACTION_FIRE_LASER = 2;

// =============================================================================
// Campaign / Run Stats
// =============================================================================

export interface CampaignStats {
  score: number;
  maxCombo: number;
  bricksDestroyed: number;
  powerupsUsed: number;
  levelsCleared: number;
  durationMs: number;
  livesRemaining: number;
  explosionBrickKills: number;
  laserBrickKills: number;
  maxBallsAtOnce: number;
  /** Level IDs cleared without missing a ball. */
  noMissLevels: number[];
}

// =============================================================================
// Public State (V4)
// =============================================================================

export interface BrickBreakerPublicState {
  phase: "idle" | "running" | "paused" | "finished";
  campaign: {
    currentLevelId: number;
    maxLevel: number;
    seed: number;
    lives: number;
    score: number;
    combo: number;
    maxCombo: number;
    bricksDestroyed: number;
    powerupsUsed: number;
    levelsCleared: number;
    startedAtMs: number;
    finishedAtMs: number | null;
    durationMs: number | null;
  };
  lastError?: string | null;
  integrity?: { replayVerified: boolean; verifierVersion: number };
}

// =============================================================================
// Physics / Sim Constants
// =============================================================================

export const SIM = {
  FIELD_W: 6.5,
  FIELD_H: 11.0,
  COLS: 13,
  ROWS: 10,
  BRICK_W: 0.5, // FIELD_W / COLS
  BRICK_H: 0.3,
  GRID_TOP_Y: 10.0, // top edge of row 0
  PADDLE_Y: 1.0,
  PADDLE_HW: 0.5, // half-width default (before level paddle scale)
  PADDLE_HH: 0.1,
  BALL_RADIUS: 0.12,
  BALL_SPEED: 5.0, // base speed (m/s)
  POWERUP_RADIUS: 0.13,
  POWERUP_FALL_SPEED: -2.0, // downward in world coords
  DT: 1 / 60,
  INPUT_HZ: 15,
  TICKS_PER_SAMPLE: 4, // 60 / 15 = 4
  MAX_PADDLE_SPEED: 30,
  DEFAULT_LIVES: 3,
  POWERUP_DURATION_TICKS: 600, // 10 seconds
  LASER_FIRE_INTERVAL: 20, // ticks between auto-fires
  LASER_TOTAL_SHOTS: 10,
  LASER_SPEED: 12,
  MAX_BOUNCE_ANGLE: (65 * Math.PI) / 180, // 65 degrees from vertical
  MOVING_BRICK_SPEED: 0.8,
  MOVING_BRICK_RANGE: 0.6, // oscillation half-range
} as const;

// =============================================================================
// Brick color palette for rendering
// =============================================================================

export const BRICK_COLORS: Record<string, string[]> = {
  N: ["#4FC3F7"], // normal: light blue
  H: ["#FFB74D", "#FF9800"], // hard: orange (2 hp states)
  V: ["#EF5350", "#F44336", "#D32F2F"], // heavy: red (3 hp states)
  S: ["#9E9E9E"], // steel: gray
  E: ["#FFEB3B"], // explosive: yellow
  P: ["#CE93D8"], // power: purple
  M: ["#81C784"], // moving: green
};
