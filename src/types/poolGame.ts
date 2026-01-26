/**
 * 8-Ball Pool Game Types
 *
 * Complete type definitions for 8-Ball Pool including:
 * - Ball positions and states
 * - Shot parameters
 * - Foul types
 * - Game phases
 *
 * @see docs/07_GAMES_ARCHITECTURE.md Section 7
 */

import { TurnBasedPlayer } from "./turnBased";

// =============================================================================
// Ball Types
// =============================================================================

/**
 * Ball IDs in standard 8-ball pool
 * 0 = cue ball
 * 1-7 = solids
 * 8 = eight ball
 * 9-15 = stripes
 */
export type PoolBallId =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15;

/**
 * Ball type categories
 */
export type BallType = "cue" | "solid" | "stripe" | "eight";

/**
 * Get ball type from ID
 */
export function getBallType(id: PoolBallId): BallType {
  if (id === 0) return "cue";
  if (id >= 1 && id <= 7) return "solid";
  if (id === 8) return "eight";
  return "stripe";
}

/**
 * Ball colors for rendering
 */
export const BALL_COLORS: Record<PoolBallId, string> = {
  0: "#FFFFFF", // Cue - white
  1: "#FFD700", // Solid yellow
  2: "#0000FF", // Solid blue
  3: "#FF0000", // Solid red
  4: "#800080", // Solid purple
  5: "#FFA500", // Solid orange
  6: "#008000", // Solid green
  7: "#800000", // Solid maroon
  8: "#000000", // Eight - black
  9: "#FFD700", // Stripe yellow
  10: "#0000FF", // Stripe blue
  11: "#FF0000", // Stripe red
  12: "#800080", // Stripe purple
  13: "#FFA500", // Stripe orange
  14: "#008000", // Stripe green
  15: "#800000", // Stripe maroon
};

/**
 * Pool ball state
 */
export interface PoolBall {
  id: PoolBallId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
  pocketedBy?: PoolPlayerSide;
  pocketedAt?: number; // Timestamp
}

/**
 * Pool table pocket positions
 */
export interface PoolPocket {
  id:
    | "topLeft"
    | "topCenter"
    | "topRight"
    | "bottomLeft"
    | "bottomCenter"
    | "bottomRight";
  x: number;
  y: number;
  radius: number;
}

// =============================================================================
// Game State Types
// =============================================================================

/**
 * Pool player sides
 */
export type PoolPlayerSide = "player1" | "player2";

/**
 * Ball assignment for players
 */
export type BallAssignment = "solids" | "stripes" | null;

/**
 * Game phase
 */
export type PoolGamePhase =
  | "break" // First shot - break the rack
  | "open" // No assignment yet
  | "assigned" // Ball types assigned
  | "eight_ball" // One player cleared, shooting for 8
  | "finished"; // Game over

/**
 * Pool foul types
 */
export type PoolFoul =
  | "scratch" // Cue ball pocketed
  | "no_contact" // Didn't hit any ball
  | "wrong_ball_first" // Hit opponent's ball first
  | "no_rail" // No ball hit rail after contact
  | "ball_off_table" // Ball left the table
  | "foot_on_floor" // Foot not touching floor
  | "double_hit" // Cue hit ball twice
  | "push_shot" // Cue stayed in contact too long
  | "early_eight" // Pocketed 8-ball before clearing group
  | "wrong_pocket_eight"; // 8-ball in wrong pocket (call shot)

/**
 * Pool game end reasons
 */
export type PoolEndReason =
  | "eight_ball_potted" // Normal win
  | "opponent_foul_on_eight" // Opponent fouled on 8-ball
  | "scratch_on_eight" // Scratched while shooting 8
  | "early_eight" // Pocketed 8 before clearing
  | "wrong_pocket" // 8 went in wrong pocket
  | "resignation"
  | "timeout"
  | "disconnect";

/**
 * Full pool game state
 */
export interface PoolGameState {
  id: string;
  type: "8ball_pool";
  status: "invited" | "active" | "completed";

  // Players
  players: {
    player1: TurnBasedPlayer;
    player2: TurnBasedPlayer;
  };
  currentTurn: PoolPlayerSide;

  // Ball states
  balls: PoolBall[];

  // Game phase and assignments
  phase: PoolGamePhase;
  player1Assignment: BallAssignment;

  // Turn state
  cueBallInHand: boolean;
  cueBallPlacement?: "anywhere" | "behind_line"; // Behind line for break foul
  shotInProgress: boolean;

  // Current turn fouls
  currentTurnFouls: PoolFoul[];
  consecutiveFouls: {
    player1: number;
    player2: number;
  };

  // Called shot (for 8-ball)
  calledPocket?: string; // Pocket ID for 8-ball shot

  // Result
  winner?: {
    side: PoolPlayerSide;
    playerId: string;
    reason: PoolEndReason;
  };

  // Timing
  createdAt: number;
  updatedAt: number;
  lastMoveAt?: number;

  // Settings
  isRated: boolean;
  chatEnabled: boolean;
}

// =============================================================================
// Shot Types
// =============================================================================

/**
 * Shot parameters sent to server
 */
export interface PoolShot {
  angle: number; // Radians from positive x-axis
  power: number; // 0-1 normalized power
  english?: {
    // Spin applied to cue ball
    x: number; // -1 (left) to 1 (right)
    y: number; // -1 (bottom) to 1 (top)
  };
  timestamp: number;
}

/**
 * Shot result from server simulation
 */
export interface PoolShotResult {
  success: boolean;

  // Animation data for replay
  animation: PoolShotAnimation;

  // Final ball positions
  finalPositions: Array<{
    ballId: PoolBallId;
    x: number;
    y: number;
    pocketed: boolean;
    pocketId?: string;
  }>;

  // Fouls detected
  fouls: PoolFoul[];

  // Balls pocketed this shot
  pocketedBalls: PoolBallId[];

  // Next state
  nextTurn: PoolPlayerSide;
  cueBallInHand: boolean;

  // Game end
  gameEnded: boolean;
  winner?: PoolPlayerSide;
  endReason?: PoolEndReason;
}

/**
 * Shot animation keyframes for replay
 */
export interface PoolShotAnimation {
  duration: number; // Total animation time in ms
  keyframes: PoolAnimationKeyframe[];
}

/**
 * Single animation keyframe
 */
export interface PoolAnimationKeyframe {
  time: number; // ms from shot start
  balls: Array<{
    id: PoolBallId;
    x: number;
    y: number;
    visible: boolean; // False if pocketed
  }>;
  sounds?: PoolSoundEvent[];
}

/**
 * Sound events during animation
 */
export interface PoolSoundEvent {
  type: "hit_ball" | "hit_rail" | "pocket" | "scratch";
  ballId?: PoolBallId;
  volume: number; // 0-1
}

// =============================================================================
// Table Constants
// =============================================================================

/**
 * Standard pool table dimensions (scaled for mobile)
 */
export const POOL_TABLE = {
  // Table dimensions (playable area)
  width: 320,
  height: 160,

  // Rail width
  railWidth: 10,

  // Pocket radius
  pocketRadius: 12,

  // Ball radius
  ballRadius: 6,

  // Pocket positions
  pockets: [
    { id: "topLeft", x: 0, y: 0 },
    { id: "topCenter", x: 160, y: 0 },
    { id: "topRight", x: 320, y: 0 },
    { id: "bottomLeft", x: 0, y: 160 },
    { id: "bottomCenter", x: 160, y: 160 },
    { id: "bottomRight", x: 320, y: 160 },
  ] as const,

  // Head string position (for break placement)
  headStringX: 80,

  // Foot spot (where balls are racked)
  footSpotX: 240,
  footSpotY: 80,
};

/**
 * Initial ball positions for rack
 */
export function getInitialBallPositions(): PoolBall[] {
  const { footSpotX, footSpotY, ballRadius } = POOL_TABLE;
  const spacing = ballRadius * 2 + 1; // Slight gap

  // Standard 8-ball rack pattern (triangle)
  // Row 1: 1 ball
  // Row 2: 2 balls
  // Row 3: 3 balls (8-ball in center)
  // Row 4: 4 balls
  // Row 5: 5 balls

  // Randomize ball positions except 8-ball in center
  const solidBalls: PoolBallId[] = [1, 2, 3, 4, 5, 6, 7];
  const stripeBalls: PoolBallId[] = [9, 10, 11, 12, 13, 14, 15];

  // Shuffle
  const shuffled = [...solidBalls, ...stripeBalls].sort(
    () => Math.random() - 0.5,
  );

  // Ensure corners have one solid and one stripe
  // Position indices: 10 (left corner), 14 (right corner)
  // This is a common rule variant

  const balls: PoolBall[] = [];

  // Cue ball
  balls.push({
    id: 0,
    x: POOL_TABLE.headStringX / 2,
    y: POOL_TABLE.height / 2,
    vx: 0,
    vy: 0,
    pocketed: false,
  });

  // Rack positions (relative to foot spot)
  const rackPositions: Array<{ row: number; col: number }> = [
    { row: 0, col: 0 }, // 1
    { row: 1, col: -1 }, // 2
    { row: 1, col: 1 }, // 3
    { row: 2, col: -2 }, // 4
    { row: 2, col: 0 }, // 5 (8-ball)
    { row: 2, col: 2 }, // 6
    { row: 3, col: -3 }, // 7
    { row: 3, col: -1 }, // 8
    { row: 3, col: 1 }, // 9
    { row: 3, col: 3 }, // 10
    { row: 4, col: -4 }, // 11
    { row: 4, col: -2 }, // 12
    { row: 4, col: 0 }, // 13
    { row: 4, col: 2 }, // 14
    { row: 4, col: 4 }, // 15
  ];

  // Calculate positions
  const rowSpacing = spacing * Math.cos(Math.PI / 6); // Horizontal between rows
  const colSpacing = spacing / 2; // Vertical between cols

  let shuffleIndex = 0;

  for (let i = 0; i < rackPositions.length; i++) {
    const { row, col } = rackPositions[i];

    let ballId: PoolBallId;
    if (i === 4) {
      // 8-ball always in center
      ballId = 8;
    } else {
      ballId = shuffled[shuffleIndex++] as PoolBallId;
    }

    balls.push({
      id: ballId,
      x: footSpotX + row * rowSpacing,
      y: footSpotY + col * colSpacing,
      vx: 0,
      vy: 0,
      pocketed: false,
    });
  }

  return balls;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if shot is valid for current game state
 */
export function validateShot(
  game: PoolGameState,
  shot: PoolShot,
): string | null {
  // Check power bounds
  if (shot.power < 0 || shot.power > 1) {
    return "Invalid shot power";
  }

  // Check english bounds
  if (shot.english) {
    if (Math.abs(shot.english.x) > 1 || Math.abs(shot.english.y) > 1) {
      return "Invalid english values";
    }
  }

  // Check angle bounds
  if (shot.angle < 0 || shot.angle > Math.PI * 2) {
    return "Invalid shot angle";
  }

  // Check game state
  if (game.status !== "active") {
    return "Game is not active";
  }

  if (game.shotInProgress) {
    return "Shot already in progress";
  }

  return null; // Valid
}

/**
 * Check if player has cleared their balls
 */
export function hasPlayerClearedBalls(
  game: PoolGameState,
  player: PoolPlayerSide,
): boolean {
  const assignment =
    player === "player1"
      ? game.player1Assignment
      : game.player1Assignment === "solids"
        ? "stripes"
        : "solids";

  if (!assignment) return false;

  const isSolids = assignment === "solids";
  const minId = isSolids ? 1 : 9;
  const maxId = isSolids ? 7 : 15;

  return game.balls
    .filter((b) => b.id >= minId && b.id <= maxId)
    .every((b) => b.pocketed);
}

/**
 * Get remaining ball count for player
 */
export function getRemainingBalls(
  game: PoolGameState,
  player: PoolPlayerSide,
): number {
  const assignment =
    player === "player1"
      ? game.player1Assignment
      : game.player1Assignment === "solids"
        ? "stripes"
        : "solids";

  if (!assignment) {
    // In open phase, count as all 7
    return 7;
  }

  const isSolids = assignment === "solids";
  const minId = isSolids ? 1 : 9;
  const maxId = isSolids ? 7 : 15;

  return game.balls.filter((b) => b.id >= minId && b.id <= maxId && !b.pocketed)
    .length;
}

// =============================================================================
// Move Type for History
// =============================================================================

/**
 * Pool move for history storage
 */
export interface PoolMove {
  player: PoolPlayerSide;
  shot: PoolShot;
  result: {
    pocketedBalls: PoolBallId[];
    fouls: PoolFoul[];
    nextTurn: PoolPlayerSide;
  };
  timestamp: number;
}
