/**
 * BounceBlitz 2.0 — Configuration / Constants
 *
 * All tunable game constants in one place.
 * Physics world uses meters internally; we scale to screen pixels via SCALE.
 */

import { Dimensions } from "react-native";

// =============================================================================
// Screen / Layout
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/** Visible playfield width in pixels */
export const GAME_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);

/** Number of grid columns */
export const COLS = 7;

/** Number of visible grid rows (bricks occupy rows 0..ROWS-1) */
export const ROWS = 10;

/** One grid cell in pixels */
export const CELL_SIZE = GAME_WIDTH / COLS;

/** Total playfield height in pixels (rows + 1.5 rows for launch area) */
export const GAME_HEIGHT = CELL_SIZE * (ROWS + 1.5);

/** Padding inside each cell for brick rendering (px) */
export const BRICK_PADDING = 3;

/** Visual brick size (px) */
export const BRICK_SIZE = CELL_SIZE - BRICK_PADDING * 2;

// =============================================================================
// Physics – Planck.js World
// =============================================================================

/**
 * Pixels-to-meters scale factor.
 * Planck/Box2D works best with objects sized 0.1–10 m.
 * With SCALE=50, a 50px cell = 1 m, ball radius 6px = 0.12 m.
 */
export const SCALE = 50;

/** Convert px → meters */
export const px2m = (px: number) => px / SCALE;

/** Convert meters → px */
export const m2px = (m: number) => m * SCALE;

/** Ball radius in pixels */
export const BALL_RADIUS_PX = 6;

/** Ball radius in physics meters */
export const BALL_RADIUS = px2m(BALL_RADIUS_PX);

/** Ball launch speed in meters/sec (tuned for game feel) */
export const BALL_SPEED = 14; // m/s

/** Delay between consecutive ball launches (ms) */
export const BALL_STAGGER_MS = 80;

/** Physics timestep (seconds) – 60 Hz */
export const PHYSICS_DT = 1 / 60;

/** Max physics sub-steps per frame (Planck.js velocity/position iterations) */
export const VELOCITY_ITERATIONS = 8;
export const POSITION_ITERATIONS = 3;

/** Floor Y in pixels (bottom of playfield, where balls return) */
export const FLOOR_Y_PX = GAME_HEIGHT;

/** Ceiling Y in pixels */
export const CEILING_Y_PX = 0;

// =============================================================================
// Gameplay
// =============================================================================

/** Min bricks spawned per new row */
export const MIN_BRICKS_PER_ROW = 3;

/** Max bricks per row (out of COLS columns) */
export const MAX_BRICKS_PER_ROW = 5;

/** Probability of an extra-ball pickup per empty column in a new row */
export const PICKUP_CHANCE = 0.12;

/** Max pickups per row */
export const MAX_PICKUPS_PER_ROW = 2;

/** Minimum aim angle from horizontal (radians). Prevents near-horizontal shots. */
export const MIN_AIM_ANGLE = 0.17; // ~10°

/** Maximum aim angle from horizontal (radians). Prevents near-horizontal shots. */
export const MAX_AIM_ANGLE = Math.PI - 0.17; // ~170°

/** Safety timeout: auto-end turn if shooting takes longer than this (ms) */
export const SHOOTING_TIMEOUT_MS = 45_000;

// =============================================================================
// Visual / Colors
// =============================================================================

/** Brick colors by HP tier */
export const BRICK_COLOR_TIERS: { maxHp: number; color: string }[] = [
  { maxHp: 5, color: "#4CAF50" },
  { maxHp: 10, color: "#8BC34A" },
  { maxHp: 20, color: "#CDDC39" },
  { maxHp: 30, color: "#FFEB3B" },
  { maxHp: 50, color: "#FFC107" },
  { maxHp: 75, color: "#FF9800" },
  { maxHp: 100, color: "#FF5722" },
  { maxHp: Infinity, color: "#F44336" },
];

export function getBrickColor(hp: number): string {
  for (const tier of BRICK_COLOR_TIERS) {
    if (hp <= tier.maxHp) return tier.color;
  }
  return "#F44336";
}

/** Extra-ball pickup color */
export const PICKUP_COLOR = "#00E676";

/** Ball visual glow color */
export const BALL_GLOW_COLOR = "rgba(255,252,0,0.5)";

// =============================================================================
// Collision Categories (bitmasks for Planck.js fixture filters)
// =============================================================================

export const CAT_WALL = 0x0001;
export const CAT_BRICK = 0x0002;
export const CAT_BALL = 0x0004;
export const CAT_FLOOR = 0x0008;
export const CAT_PICKUP = 0x0010;
