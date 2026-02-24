/**
 * Breakout (Atari) — Configuration / Constants
 *
 * All tunable game constants in one place.
 * Physics world uses meters internally; we scale to screen pixels via SCALE.
 *
 * Rule reference: Wikipedia — Breakout (video game)
 * https://en.wikipedia.org/wiki/Breakout_(video_game)
 */

import { Dimensions } from "react-native";

// =============================================================================
// Screen / Layout
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/** Visible playfield width in pixels */
export const GAME_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);

/** Total playfield height in pixels */
export const GAME_HEIGHT = 640;

// =============================================================================
// Brick Grid
// =============================================================================

/** Number of brick columns */
export const BRICK_COLS = 14;

/** Number of brick rows (8 classic Breakout rows) */
export const BRICK_ROWS = 8;

/** Brick width in pixels */
export const BRICK_WIDTH = Math.floor(GAME_WIDTH / BRICK_COLS);

/** Brick height in pixels */
export const BRICK_HEIGHT = 14;

/** Padding between bricks in pixels */
export const BRICK_PADDING = 1;

/** Top offset for the first row of bricks in pixels */
export const BRICK_TOP_OFFSET = 100;

/** Gap below ceiling before first brick row */
export const BRICK_AREA_TOP = BRICK_TOP_OFFSET;

// =============================================================================
// Brick Colors & Scoring (bottom → top: yellow, green, orange, red)
// =============================================================================

export type BrickColor = "yellow" | "green" | "orange" | "red";

export interface BrickRowDef {
  color: BrickColor;
  points: number;
  fill: string;
}

/**
 * Row definitions, indexed 0–7 (bottom → top in the brick area).
 * Rows 0–1: yellow (1 pt), Rows 2–3: green (3 pt),
 * Rows 4–5: orange (5 pt), Rows 6–7: red (7 pt).
 */
export const ROW_DEFS: BrickRowDef[] = [
  { color: "yellow", points: 1, fill: "#FFD600" },
  { color: "yellow", points: 1, fill: "#FFD600" },
  { color: "green", points: 3, fill: "#4CAF50" },
  { color: "green", points: 3, fill: "#43A047" },
  { color: "orange", points: 5, fill: "#FF9800" },
  { color: "orange", points: 5, fill: "#FB8C00" },
  { color: "red", points: 7, fill: "#F44336" },
  { color: "red", points: 7, fill: "#E53935" },
];

/** Max score per wall: 14 bricks × (2×1 + 2×3 + 2×5 + 2×7) = 14 × 32 = 448 */
export const POINTS_PER_WALL = BRICK_COLS * (2 * 1 + 2 * 3 + 2 * 5 + 2 * 7);

/** Max total score (2 walls) */
export const MAX_SCORE = POINTS_PER_WALL * 2;

// =============================================================================
// Paddle
// =============================================================================

/** Paddle width in pixels (full size) */
export const PADDLE_WIDTH = 70;

/** Paddle width in pixels (after shrink) */
export const PADDLE_SHRUNK_WIDTH = 35;

/** Paddle height in pixels */
export const PADDLE_HEIGHT = 10;

/** Paddle Y position in pixels (distance from top) */
export const PADDLE_Y = GAME_HEIGHT - 50;

// =============================================================================
// Ball
// =============================================================================

/** Ball radius in pixels */
export const BALL_RADIUS_PX = 5;

// =============================================================================
// Physics – Planck.js World
// =============================================================================

/**
 * Pixels-to-meters scale factor.
 * Planck/Box2D works best with objects sized 0.1–10 m.
 * With SCALE=50, a 50px cell ≈ 1 m, ball radius 5px = 0.10 m.
 */
export const SCALE = 50;

/** Convert px → meters */
export const px2m = (px: number): number => px / SCALE;

/** Convert meters → px */
export const m2px = (m: number): number => m * SCALE;

/** Ball radius in physics meters */
export const BALL_RADIUS = px2m(BALL_RADIUS_PX);

/** Physics timestep (seconds) – 60 Hz */
export const PHYSICS_DT = 1 / 60;

/** Velocity iterations for Planck solver */
export const VELOCITY_ITERATIONS = 8;

/** Position iterations for Planck solver */
export const POSITION_ITERATIONS = 3;

// =============================================================================
// Ball Speed Tiers
// =============================================================================

/**
 * Base ball speed in meters/sec.
 * Tuned so the ball crosses the 640px (12.8m) field in ~1.5s.
 */
export const BALL_BASE_SPEED = 8.0;

/**
 * Speed multipliers — each trigger replaces the current multiplier
 * with the higher value. Applied as: speed = BALL_BASE_SPEED × multiplier.
 *
 * Trigger order (per Wikipedia):
 *   Tier 0: base speed (game start)
 *   Tier 1: after 4 brick hits
 *   Tier 2: after 12 brick hits
 *   Tier 3: after first orange-row contact
 *   Tier 4: after first red-row contact
 */
export const SPEED_TIERS = [
  { name: "base", multiplier: 1.0 },
  { name: "4_hits", multiplier: 1.2 },
  { name: "12_hits", multiplier: 1.4 },
  { name: "orange_contact", multiplier: 1.6 },
  { name: "red_contact", multiplier: 1.8 },
] as const;

/** Hit counts that trigger speed increases */
export const SPEED_TIER_HIT_4 = 4;
export const SPEED_TIER_HIT_12 = 12;

// =============================================================================
// Paddle Bounce Angle
// =============================================================================

/**
 * Max angle from vertical that the ball can leave the paddle (radians).
 * 65° = allows diagonal shots; PI/2 = horizontal (clamped below).
 */
export const MAX_BOUNCE_ANGLE = (65 * Math.PI) / 180;

/**
 * Minimum outgoing angle from horizontal (radians).
 * Prevents near-horizontal death crawl. 15° from horizontal = 75° from vertical.
 */
export const MIN_ANGLE_FROM_HORIZONTAL = (15 * Math.PI) / 180;

// =============================================================================
// Game Rules
// =============================================================================

/** Number of lives the player starts with */
export const STARTING_LIVES = 3;

/** Total walls (screens) to clear */
export const TOTAL_WALLS = 2;

// =============================================================================
// Collision Categories (bitmasks for Planck.js fixture filters)
// =============================================================================

export const CAT_WALL = 0x0001;
export const CAT_BRICK = 0x0002;
export const CAT_BALL = 0x0004;
export const CAT_PADDLE = 0x0008;
export const CAT_DRAIN = 0x0010;
export const CAT_CEILING = 0x0020;
