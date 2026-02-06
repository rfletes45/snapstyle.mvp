/**
 * Brick Breaker Logic
 *
 * Pure functions for the classic Breakout-style arcade game.
 * Handles physics, collision detection, power-ups, and level generation.
 *
 * Game Features:
 * - Ball physics with realistic bouncing
 * - Multiple brick types with different properties
 * - Power-up system with 8 different effects
 * - Multi-ball support (up to 5 balls)
 * - Laser shooting paddle
 * - 30 handcrafted levels
 *
 * Exported Functions:
 * - createBrickBreakerState(playerId) - Create new game at level 1
 * - createNextLevel(state) - Advance to next level
 * - updateBallPhysics(state) - Update ball positions and handle collisions
 * - updatePowerUps(state) - Update falling power-ups and active effects
 * - updateLasers(state) - Update laser projectiles
 * - movePaddle(state, x) - Move paddle to position
 * - launchBall(state) - Launch ball from paddle
 * - fireLaser(state) - Fire laser if power-up active
 * - isLevelComplete(state) - Check if all destroyable bricks cleared
 * - getDestroyableBrickCount(bricks) - Count remaining breakable bricks
 * - createBrickBreakerStats(state) - Create stats for session recording
 *
 * @see docs/06_GAMES.md Section 4 (Single-Player Games)
 */

import {
  BRICK_BREAKER_CONFIG,
  BrickBallState,
  BrickBreakerState,
  BrickBreakerStats,
  BrickPaddleState,
  BrickPowerUpType,
  BrickState,
  BrickType,
  FallingPowerUp,
  LaserState,
} from "@/types/singlePlayerGames";
import { generateId } from "@/utils/ids";

// =============================================================================
// Constants
// =============================================================================

export const CONFIG = BRICK_BREAKER_CONFIG;

/**
 * Brick colors by type
 */
export const BRICK_COLORS: Record<BrickType, string> = {
  standard: "#FF6B6B",
  silver: "#C0C0C0",
  gold: "#FFD700",
  indestructible: "#666666",
  explosive: "#FF8C00",
  mystery: "#9B59B6",
};

/**
 * Power-up colors and icons
 */
export const POWER_UP_INFO: Record<
  BrickPowerUpType,
  { color: string; icon: string; label: string }
> = {
  expand: { color: "#4CAF50", icon: "↔️", label: "Expand" },
  shrink: { color: "#F44336", icon: "↕️", label: "Shrink" },
  multi_ball: { color: "#2196F3", icon: "⚪", label: "Multi-Ball" },
  laser: { color: "#E91E63", icon: "🔫", label: "Laser" },
  slow: { color: "#00BCD4", icon: "🐢", label: "Slow" },
  fast: { color: "#FF5722", icon: "⚡", label: "Fast" },
  sticky: { color: "#FFEB3B", icon: "🍯", label: "Sticky" },
  extra_life: { color: "#E91E63", icon: "❤️", label: "Life" },
};

/**
 * Standard brick row colors (gradient from top)
 */
export const ROW_COLORS = [
  "#FF6B6B", // Red
  "#FF9F43", // Orange
  "#FECA57", // Yellow
  "#48DBFB", // Cyan
  "#1DD1A1", // Green
  "#5F27CD", // Purple
];

// =============================================================================
// Level Definitions
// =============================================================================

/**
 * Level configuration
 */
export interface LevelConfig {
  id: number;
  name: string;
  bricks: (BrickType | null)[][];
  powerUpChance: number;
  ballSpeed: number;
}

/**
 * Generate level grid pattern
 * Each level has different brick arrangements
 */
export function generateLevelBricks(level: number): BrickState[] {
  const pattern =
    LEVEL_PATTERNS[Math.min(level - 1, LEVEL_PATTERNS.length - 1)];
  const bricks: BrickState[] = [];

  const rows = pattern.length;
  const cols = pattern[0].length;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const type = pattern[row][col];
      if (type !== null) {
        bricks.push({
          id: `brick-${row}-${col}`,
          row,
          col,
          type,
          hitsRemaining: getHitsForBrickType(type),
          hasPowerUp: shouldHavePowerUp(type, level),
        });
      }
    }
  }

  return bricks;
}

/**
 * Get hits required to destroy brick type
 */
export function getHitsForBrickType(type: BrickType): number {
  switch (type) {
    case "standard":
    case "explosive":
    case "mystery":
      return 1;
    case "silver":
      return 2;
    case "gold":
      return 3;
    case "indestructible":
      return Infinity;
    default:
      return 1;
  }
}

/**
 * Determine if brick should have power-up
 */
function shouldHavePowerUp(type: BrickType, level: number): boolean {
  if (type === "mystery") return true;
  if (type === "indestructible") return false;

  // Base chance increases with level
  const baseChance = 0.1 + level * 0.01;
  return Math.random() < Math.min(baseChance, 0.25);
}

/**
 * Level patterns - 30 unique patterns
 * null = empty, s = standard, v = silver, g = gold, i = indestructible, x = explosive, m = mystery
 */
type BrickChar = "s" | "v" | "g" | "i" | "x" | "m" | null;

function parsePattern(rows: string[]): (BrickType | null)[][] {
  const charMap: Record<string, BrickType | null> = {
    ".": null,
    s: "standard",
    v: "silver",
    g: "gold",
    i: "indestructible",
    x: "explosive",
    m: "mystery",
  };

  return rows.map((row) => row.split("").map((char) => charMap[char] ?? null));
}

// 30 Level patterns
export const LEVEL_PATTERNS: (BrickType | null)[][][] = [
  // Level 1: Simple rows
  parsePattern([
    "ssssssss",
    "ssssssss",
    "ssssssss",
    "........",
    "........",
    "........",
  ]),

  // Level 2: Pyramid
  parsePattern([
    "...ss...",
    "..ssss..",
    ".ssssss.",
    "ssssssss",
    "........",
    "........",
  ]),

  // Level 3: Checkerboard
  parsePattern([
    "s.s.s.s.",
    ".s.s.s.s",
    "s.s.s.s.",
    ".s.s.s.s",
    "s.s.s.s.",
    "........",
  ]),

  // Level 4: Introducing silver
  parsePattern([
    "ssssssss",
    "svvvvvvs",
    "svvvvvvs",
    "ssssssss",
    "........",
    "........",
  ]),

  // Level 5: Diamond
  parsePattern([
    "...ss...",
    "..svvs..",
    ".svvvvs.",
    "..svvs..",
    "...ss...",
    "........",
  ]),

  // Level 6: Introducing gold
  parsePattern([
    "gssssssg",
    "svvvvvvs",
    "svvggvvs",
    "svvggvvs",
    "svvvvvvs",
    "gssssssg",
  ]),

  // Level 7: Introducing indestructible
  parsePattern([
    "i.ssss.i",
    "issvvssi",
    "issvvssi",
    "issssssi",
    "i......i",
    "........",
  ]),

  // Level 8: Cross pattern
  parsePattern([
    "...vv...",
    "...vv...",
    "vvvggvvv",
    "vvvggvvv",
    "...vv...",
    "...vv...",
  ]),

  // Level 9: Introducing explosive
  parsePattern([
    "ssxssxss",
    "svvvvvvs",
    "xvvvvvvx",
    "svvvvvvs",
    "ssxssxss",
    "........",
  ]),

  // Level 10: Fortress
  parsePattern([
    "igssssgi",
    "i.vvvv.i",
    "i.vggv.i",
    "i.vvvv.i",
    "igssssgi",
    "........",
  ]),

  // Level 11: Introducing mystery
  parsePattern([
    "smssssms",
    "ssvvvvss",
    "svvmmvvs",
    "svvmmvvs",
    "ssvvvvss",
    "smssssms",
  ]),

  // Level 12: Zigzag
  parsePattern([
    "sss.....",
    ".sss....",
    "..sss...",
    "...sss..",
    "....sss.",
    ".....sss",
  ]),

  // Level 13: Target
  parsePattern([
    "ssssssss",
    "s......s",
    "s.gggg.s",
    "s.gggg.s",
    "s......s",
    "ssssssss",
  ]),

  // Level 14: Arrow
  parsePattern([
    "...ss...",
    "..svvs..",
    ".svggvs.",
    "svvggvvs",
    "..svvs..",
    "...ss...",
  ]),

  // Level 15: Castle
  parsePattern([
    "gi....ig",
    "gi.gg.ig",
    "gisvvsig",
    "gisggsis",
    "gissssis",
    "gggggggg",
  ]),

  // Level 16: Spiral
  parsePattern([
    "ssssssss",
    ".......s",
    "sssss.ss",
    "s...s.s.",
    "s.sss.s.",
    "s.....s.",
  ]),

  // Level 17: Explosive chain
  parsePattern([
    "sxssssxs",
    "xsxssxsx",
    "sxsxxsxs",
    "xsxssxsx",
    "sxssssxs",
    "........",
  ]),

  // Level 18: Heart
  parsePattern([
    ".vv..vv.",
    "vvvvvvvv",
    "vvvvvvvv",
    ".vvvvvv.",
    "..vvvv..",
    "...vv...",
  ]),

  // Level 19: Maze
  parsePattern([
    "issssssi",
    "i..i..si",
    "i.ii..si",
    "i.....si",
    "iiiii.si",
    "i.....si",
  ]),

  // Level 20: Rainbow
  parsePattern([
    "ssssssss",
    "vvvvvvvv",
    "gggggggg",
    "mmmmmmmm",
    "xxxxxxxx",
    "ssssssss",
  ]),

  // Level 21: Invaders
  parsePattern([
    ".ss..ss.",
    "ssssssss",
    "ss.ss.ss",
    "ssssssss",
    ".ss..ss.",
    "s......s",
  ]),

  // Level 22: Blocks
  parsePattern([
    "gg..gg..",
    "gg..gg..",
    "..vv..vv",
    "..vv..vv",
    "ss..ss..",
    "ss..ss..",
  ]),

  // Level 23: X marks the spot
  parsePattern([
    "g......g",
    ".v....v.",
    "..xs.x..",
    "..xs.x..",
    ".v....v.",
    "g......g",
  ]),

  // Level 24: Mystery temple
  parsePattern([
    "msmsmsmm",
    "smsmsmss",
    "msmvvsmm",
    "smvggvss",
    "msmvvsmm",
    "smsmsmss",
  ]),

  // Level 25: Fortress 2
  parsePattern([
    "iigggii",
    "i.vvv.i",
    "g.vmv.g",
    "g.vvv.g",
    "i.....i",
    "iiiiiii",
  ]),

  // Level 26: Full grid
  parsePattern([
    "svsvsvs",
    "vgvgvgv",
    "svsvsvs",
    "vgvgvgv",
    "svsvsvs",
    "vgvgvgv",
  ]),

  // Level 27: Chaos
  parsePattern([
    "xmxmxmxm",
    "mxmxmxmx",
    "xmxgxmxm",
    "mxmxmxmx",
    "xmxmxmxm",
    "mxmxmxmx",
  ]),

  // Level 28: The wall
  parsePattern([
    "igigigig",
    "gigigigi",
    "igigigig",
    "gigigigi",
    "svsvsvs",
    "vsvsvsvs",
  ]),

  // Level 29: Ultimate test
  parsePattern([
    "gmsmgmsg",
    "iviivivi",
    "gxgxgxgg",
    "ivisiviv",
    "gvgvgvgv",
    "ssssssss",
  ]),

  // Level 30: Final boss
  parsePattern([
    "iggggggi",
    "gvvvvvvg",
    "gvmggmvg",
    "gvvggvvg",
    "gvvvvvvg",
    "iggggggi",
  ]),
];

// =============================================================================
// State Creation
// =============================================================================

/**
 * Create initial brick breaker game state
 */
export function createBrickBreakerState(playerId: string): BrickBreakerState {
  const bricks = generateLevelBricks(1);

  return {
    gameType: "brick_breaker",
    category: "quick_play",
    playerId,
    sessionId: generateId(),

    score: 0,
    highScore: 0,
    status: "playing",
    startedAt: Date.now(),
    totalPauseDuration: 0,

    // Game objects
    paddle: createInitialPaddle(),
    balls: [createInitialBall()],
    bricks,
    powerUps: [],
    lasers: [],

    // Progress
    currentLevel: 1,
    lives: CONFIG.startingLives,
    maxLives: CONFIG.startingLives,

    // Active effects
    activeEffects: [],

    // Stats
    bricksDestroyed: 0,
    powerUpsCollected: 0,
    maxCombo: 0,
    perfectLevels: 0,

    // Phase
    phase: "ready",
  };
}

/**
 * Create initial paddle state
 */
export function createInitialPaddle(): BrickPaddleState {
  return {
    x: CONFIG.canvasWidth / 2 - CONFIG.paddleWidth / 2,
    width: CONFIG.paddleWidth,
    baseWidth: CONFIG.paddleWidth,
    hasSticky: false,
    hasLaser: false,
  };
}

/**
 * Create initial ball state
 */
export function createInitialBall(stuck = true): BrickBallState {
  return {
    id: generateId(),
    x: CONFIG.canvasWidth / 2,
    y: CONFIG.paddleY - CONFIG.ballRadius - 2,
    vx: 0,
    vy: 0,
    radius: CONFIG.ballRadius,
    isStuck: stuck,
  };
}

// =============================================================================
// Paddle Movement
// =============================================================================

/**
 * Move paddle to new X position
 */
export function movePaddle(
  state: BrickBreakerState,
  targetX: number,
): BrickBreakerState {
  const halfWidth = state.paddle.width / 2;
  const clampedX = Math.max(
    halfWidth,
    Math.min(CONFIG.canvasWidth - halfWidth, targetX),
  );
  const newPaddleX = clampedX - halfWidth;

  // Move stuck balls with paddle
  const newBalls = state.balls.map((ball) => {
    if (ball.isStuck) {
      return {
        ...ball,
        x: clampedX,
        y: CONFIG.paddleY - ball.radius - 2,
      };
    }
    return ball;
  });

  return {
    ...state,
    paddle: {
      ...state.paddle,
      x: newPaddleX,
    },
    balls: newBalls,
  };
}

// =============================================================================
// Ball Launch & Physics
// =============================================================================

/**
 * Launch the ball from paddle
 */
export function launchBall(state: BrickBreakerState): BrickBreakerState {
  const speedMultiplier = 1 + (state.currentLevel - 1) * 0.1;
  const baseSpeed = CONFIG.ballBaseSpeed * speedMultiplier;

  // Check for slow/fast effects
  let speed = baseSpeed;
  const slowEffect = state.activeEffects.find((e) => e.type === "slow");
  const fastEffect = state.activeEffects.find((e) => e.type === "fast");

  if (slowEffect) speed *= 0.7;
  if (fastEffect) speed *= 1.3;

  // Random angle between -45 and 45 degrees from vertical
  const angle = ((Math.random() - 0.5) * Math.PI) / 2 - Math.PI / 2;

  const newBalls = state.balls.map((ball) => {
    if (ball.isStuck) {
      return {
        ...ball,
        isStuck: false,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      };
    }
    return ball;
  });

  return {
    ...state,
    balls: newBalls,
    phase: "playing",
  };
}

/**
 * Update ball position and handle collisions
 */
export function updateBallPhysics(state: BrickBreakerState): {
  newState: BrickBreakerState;
  events: GameEvent[];
} {
  const events: GameEvent[] = [];
  let newState = { ...state };
  let newBalls: BrickBallState[] = [];
  let bricksToRemove: string[] = [];
  let explosionBricks: string[] = [];
  let scoreIncrease = 0;
  let bricksDestroyed = 0;

  for (const ball of state.balls) {
    if (ball.isStuck) {
      newBalls.push(ball);
      continue;
    }

    let newBall = { ...ball };
    newBall.x += newBall.vx;
    newBall.y += newBall.vy;

    // Wall collisions
    if (newBall.x - newBall.radius <= 0) {
      newBall.x = newBall.radius;
      newBall.vx = Math.abs(newBall.vx);
      events.push({ type: "wall_hit" });
    } else if (newBall.x + newBall.radius >= CONFIG.canvasWidth) {
      newBall.x = CONFIG.canvasWidth - newBall.radius;
      newBall.vx = -Math.abs(newBall.vx);
      events.push({ type: "wall_hit" });
    }

    // Ceiling collision
    if (newBall.y - newBall.radius <= 0) {
      newBall.y = newBall.radius;
      newBall.vy = Math.abs(newBall.vy);
      events.push({ type: "wall_hit" });
    }

    // Paddle collision
    const paddleCollision = checkPaddleCollision(newBall, state.paddle);
    if (paddleCollision.hit) {
      if (state.paddle.hasSticky) {
        newBall.isStuck = true;
        newBall.y = CONFIG.paddleY - newBall.radius - 2;
        newBall.vx = 0;
        newBall.vy = 0;
        events.push({ type: "ball_stuck" });

        // Decrease sticky uses
        newState = decreaseStickyUses(newState);
      } else {
        newBall.vy = -Math.abs(newBall.vy);
        newBall.vx = paddleCollision.newVx;
        newBall.y = CONFIG.paddleY - newBall.radius - 2;
      }
      events.push({ type: "paddle_hit" });
    }

    // Ball fell off screen
    if (newBall.y + newBall.radius > CONFIG.canvasHeight) {
      events.push({ type: "ball_lost", ballId: ball.id });
      continue; // Don't add this ball to newBalls
    }

    // Brick collisions
    for (const brick of newState.bricks) {
      if (bricksToRemove.includes(brick.id)) continue;

      const collision = checkBrickCollision(newBall, brick);
      if (collision.hit) {
        // Apply bounce
        if (collision.side === "top" || collision.side === "bottom") {
          newBall.vy = -newBall.vy;
        } else {
          newBall.vx = -newBall.vx;
        }

        // Handle brick hit
        if (brick.type !== "indestructible") {
          const newHits = brick.hitsRemaining - 1;
          if (newHits <= 0) {
            bricksToRemove.push(brick.id);
            scoreIncrease += CONFIG.brickPoints[brick.type];
            bricksDestroyed++;

            if (brick.type === "explosive") {
              explosionBricks.push(brick.id);
            }

            if (brick.hasPowerUp) {
              const powerUp = createRandomPowerUp(brick);
              newState = {
                ...newState,
                powerUps: [...newState.powerUps, powerUp],
              };
            }

            events.push({
              type: "brick_destroyed",
              brickId: brick.id,
              brickType: brick.type,
            });
          } else {
            // Update brick hits
            newState = {
              ...newState,
              bricks: newState.bricks.map((b) =>
                b.id === brick.id ? { ...b, hitsRemaining: newHits } : b,
              ),
            };
            events.push({ type: "brick_hit", brickId: brick.id });
          }
        }

        break; // Only process one brick collision per frame
      }
    }

    newBalls.push(newBall);
  }

  // Handle explosive chain reactions
  if (explosionBricks.length > 0) {
    for (const explosiveId of explosionBricks) {
      const explosiveBrick = state.bricks.find((b) => b.id === explosiveId);
      if (explosiveBrick) {
        const adjacentBricks = getAdjacentBricks(
          explosiveBrick,
          newState.bricks,
        );
        for (const adjacent of adjacentBricks) {
          if (
            adjacent.type !== "indestructible" &&
            !bricksToRemove.includes(adjacent.id)
          ) {
            bricksToRemove.push(adjacent.id);
            scoreIncrease += CONFIG.brickPoints[adjacent.type];
            bricksDestroyed++;
            events.push({
              type: "brick_destroyed",
              brickId: adjacent.id,
              brickType: adjacent.type,
            });

            if (adjacent.hasPowerUp) {
              const powerUp = createRandomPowerUp(adjacent);
              newState = {
                ...newState,
                powerUps: [...newState.powerUps, powerUp],
              };
            }
          }
        }
      }
    }
  }

  // Remove destroyed bricks
  newState = {
    ...newState,
    bricks: newState.bricks.filter((b) => !bricksToRemove.includes(b.id)),
    balls: newBalls,
    score: newState.score + scoreIncrease,
    bricksDestroyed: newState.bricksDestroyed + bricksDestroyed,
  };

  return { newState, events };
}

/**
 * Game event type
 */
export interface GameEvent {
  type:
    | "wall_hit"
    | "paddle_hit"
    | "ball_stuck"
    | "ball_lost"
    | "brick_hit"
    | "brick_destroyed"
    | "powerup_collected"
    | "laser_hit"
    | "level_complete"
    | "game_over";
  ballId?: string;
  brickId?: string;
  brickType?: BrickType;
  powerUpType?: BrickPowerUpType;
}

// =============================================================================
// Collision Detection
// =============================================================================

/**
 * Check ball-paddle collision
 */
export function checkPaddleCollision(
  ball: BrickBallState,
  paddle: BrickPaddleState,
): { hit: boolean; newVx: number } {
  const paddleTop = CONFIG.paddleY;
  const paddleBottom = CONFIG.paddleY + CONFIG.paddleHeight;
  const paddleLeft = paddle.x;
  const paddleRight = paddle.x + paddle.width;

  // Check if ball is in paddle region
  if (
    ball.y + ball.radius >= paddleTop &&
    ball.y - ball.radius <= paddleBottom &&
    ball.x >= paddleLeft &&
    ball.x <= paddleRight &&
    ball.vy > 0 // Only when moving down
  ) {
    // Calculate bounce angle based on hit position
    const hitPos = (ball.x - paddleLeft) / paddle.width; // 0 to 1
    const normalizedHitPos = hitPos * 2 - 1; // -1 to 1

    // Max angle is 60 degrees
    const maxAngle = Math.PI / 3;
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    const newVx = normalizedHitPos * speed * Math.sin(maxAngle);

    return { hit: true, newVx };
  }

  return { hit: false, newVx: ball.vx };
}

/**
 * Check ball-brick collision
 */
export function checkBrickCollision(
  ball: BrickBallState,
  brick: BrickState,
): { hit: boolean; side: "top" | "bottom" | "left" | "right" | null } {
  const brickX =
    brick.col * (CONFIG.brickWidth + CONFIG.brickPadding) + CONFIG.brickPadding;
  const brickY =
    brick.row * (CONFIG.brickHeight + CONFIG.brickPadding) +
    CONFIG.brickTopOffset;
  const brickRight = brickX + CONFIG.brickWidth;
  const brickBottom = brickY + CONFIG.brickHeight;

  // AABB collision with ball's bounding box
  const ballLeft = ball.x - ball.radius;
  const ballRight = ball.x + ball.radius;
  const ballTop = ball.y - ball.radius;
  const ballBottom = ball.y + ball.radius;

  if (
    ballRight >= brickX &&
    ballLeft <= brickRight &&
    ballBottom >= brickY &&
    ballTop <= brickBottom
  ) {
    // Determine collision side
    const overlapLeft = ballRight - brickX;
    const overlapRight = brickRight - ballLeft;
    const overlapTop = ballBottom - brickY;
    const overlapBottom = brickBottom - ballTop;

    const minOverlap = Math.min(
      overlapLeft,
      overlapRight,
      overlapTop,
      overlapBottom,
    );

    if (minOverlap === overlapTop) return { hit: true, side: "top" };
    if (minOverlap === overlapBottom) return { hit: true, side: "bottom" };
    if (minOverlap === overlapLeft) return { hit: true, side: "left" };
    if (minOverlap === overlapRight) return { hit: true, side: "right" };
  }

  return { hit: false, side: null };
}

/**
 * Get adjacent bricks for explosive chain
 */
export function getAdjacentBricks(
  brick: BrickState,
  allBricks: BrickState[],
): BrickState[] {
  const adjacent: BrickState[] = [];
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];

  for (const [dr, dc] of directions) {
    const foundBrick = allBricks.find(
      (b) => b.row === brick.row + dr && b.col === brick.col + dc,
    );
    if (foundBrick) adjacent.push(foundBrick);
  }

  return adjacent;
}

// =============================================================================
// Power-Up System
// =============================================================================

/**
 * Create random power-up at brick position
 */
export function createRandomPowerUp(brick: BrickState): FallingPowerUp {
  const types: BrickPowerUpType[] = [
    "expand",
    "shrink",
    "multi_ball",
    "laser",
    "slow",
    "fast",
    "sticky",
    "extra_life",
  ];

  // Weighted selection - negative power-ups less likely
  const weights = [3, 1, 3, 2, 2, 1, 2, 1]; // shrink and fast are bad
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  let selectedType = types[0];
  for (let i = 0; i < types.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      selectedType = types[i];
      break;
    }
  }

  const brickX =
    brick.col * (CONFIG.brickWidth + CONFIG.brickPadding) +
    CONFIG.brickPadding +
    CONFIG.brickWidth / 2;
  const brickY =
    brick.row * (CONFIG.brickHeight + CONFIG.brickPadding) +
    CONFIG.brickTopOffset +
    CONFIG.brickHeight;

  return {
    id: generateId(),
    type: selectedType,
    x: brickX,
    y: brickY,
    vy: CONFIG.powerUpSpeed,
  };
}

/**
 * Update power-ups (falling animation)
 */
export function updatePowerUps(state: BrickBreakerState): {
  newState: BrickBreakerState;
  events: GameEvent[];
} {
  const events: GameEvent[] = [];
  const newPowerUps: FallingPowerUp[] = [];

  for (const powerUp of state.powerUps) {
    const newY = powerUp.y + powerUp.vy;

    // Check paddle collision
    if (checkPowerUpPaddleCollision(powerUp, state.paddle)) {
      events.push({ type: "powerup_collected", powerUpType: powerUp.type });
      continue; // Don't add to newPowerUps
    }

    // Check if fell off screen
    if (newY > CONFIG.canvasHeight) {
      continue;
    }

    newPowerUps.push({ ...powerUp, y: newY });
  }

  return {
    newState: { ...state, powerUps: newPowerUps },
    events,
  };
}

/**
 * Check power-up collision with paddle
 */
function checkPowerUpPaddleCollision(
  powerUp: FallingPowerUp,
  paddle: BrickPaddleState,
): boolean {
  const halfSize = CONFIG.powerUpSize / 2;
  return (
    powerUp.y + halfSize >= CONFIG.paddleY &&
    powerUp.y - halfSize <= CONFIG.paddleY + CONFIG.paddleHeight &&
    powerUp.x + halfSize >= paddle.x &&
    powerUp.x - halfSize <= paddle.x + paddle.width
  );
}

/**
 * Apply collected power-up
 */
export function applyPowerUp(
  state: BrickBreakerState,
  powerUpType: BrickPowerUpType,
): BrickBreakerState {
  const now = Date.now();
  let newState = { ...state, powerUpsCollected: state.powerUpsCollected + 1 };

  switch (powerUpType) {
    case "expand":
      newState.paddle = {
        ...newState.paddle,
        width: CONFIG.expandedWidth,
      };
      newState.activeEffects = [
        ...newState.activeEffects.filter((e) => e.type !== "shrink"),
        { type: "expand", expiresAt: now + CONFIG.effectDurations.expand },
      ];
      break;

    case "shrink":
      newState.paddle = {
        ...newState.paddle,
        width: CONFIG.shrunkWidth,
      };
      newState.activeEffects = [
        ...newState.activeEffects.filter((e) => e.type !== "expand"),
        { type: "shrink", expiresAt: now + CONFIG.effectDurations.shrink },
      ];
      break;

    case "multi_ball":
      // Add 2 extra balls
      const newBalls = [...newState.balls];
      for (let i = 0; i < 2 && newBalls.length < CONFIG.maxBalls; i++) {
        const existingBall = newBalls.find((b) => !b.isStuck);
        if (existingBall) {
          const angle = ((Math.random() - 0.5) * Math.PI) / 3;
          const speed = Math.sqrt(existingBall.vx ** 2 + existingBall.vy ** 2);
          newBalls.push({
            id: generateId(),
            x: existingBall.x,
            y: existingBall.y,
            vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
            vy: -Math.abs(Math.sin(angle) * speed),
            radius: CONFIG.ballRadius,
            isStuck: false,
          });
        }
      }
      newState.balls = newBalls;
      break;

    case "laser":
      newState.paddle = {
        ...newState.paddle,
        hasLaser: true,
      };
      newState.activeEffects = [
        ...newState.activeEffects,
        { type: "laser", expiresAt: now + CONFIG.effectDurations.laser },
      ];
      break;

    case "slow":
      // Slow down all balls
      newState.balls = newState.balls.map((ball) => ({
        ...ball,
        vx: ball.vx * 0.7,
        vy: ball.vy * 0.7,
      }));
      newState.activeEffects = [
        ...newState.activeEffects.filter((e) => e.type !== "fast"),
        { type: "slow", expiresAt: now + CONFIG.effectDurations.slow },
      ];
      break;

    case "fast":
      // Speed up all balls
      newState.balls = newState.balls.map((ball) => ({
        ...ball,
        vx: ball.vx * 1.3,
        vy: ball.vy * 1.3,
      }));
      newState.activeEffects = [
        ...newState.activeEffects.filter((e) => e.type !== "slow"),
        { type: "fast", expiresAt: now + CONFIG.effectDurations.fast },
      ];
      break;

    case "sticky":
      newState.paddle = {
        ...newState.paddle,
        hasSticky: true,
      };
      newState.activeEffects = [
        ...newState.activeEffects,
        {
          type: "sticky",
          expiresAt: 0,
          usesRemaining: CONFIG.effectDurations.sticky,
        },
      ];
      break;

    case "extra_life":
      newState.lives = Math.min(newState.lives + 1, newState.maxLives + 2);
      break;
  }

  return newState;
}

/**
 * Decrease sticky uses when ball sticks
 */
function decreaseStickyUses(state: BrickBreakerState): BrickBreakerState {
  const stickyEffect = state.activeEffects.find((e) => e.type === "sticky");
  if (!stickyEffect || !stickyEffect.usesRemaining) return state;

  const newUses = stickyEffect.usesRemaining - 1;
  if (newUses <= 0) {
    return {
      ...state,
      paddle: { ...state.paddle, hasSticky: false },
      activeEffects: state.activeEffects.filter((e) => e.type !== "sticky"),
    };
  }

  return {
    ...state,
    activeEffects: state.activeEffects.map((e) =>
      e.type === "sticky" ? { ...e, usesRemaining: newUses } : e,
    ),
  };
}

/**
 * Update active effects (expire old ones)
 */
export function updateActiveEffects(
  state: BrickBreakerState,
): BrickBreakerState {
  const now = Date.now();
  const expired: BrickPowerUpType[] = [];

  const newEffects = state.activeEffects.filter((effect) => {
    if (effect.expiresAt > 0 && effect.expiresAt <= now) {
      expired.push(effect.type);
      return false;
    }
    return true;
  });

  let newPaddle = { ...state.paddle };

  for (const type of expired) {
    switch (type) {
      case "expand":
      case "shrink":
        newPaddle.width = newPaddle.baseWidth;
        break;
      case "laser":
        newPaddle.hasLaser = false;
        break;
    }
  }

  return {
    ...state,
    activeEffects: newEffects,
    paddle: newPaddle,
  };
}

// =============================================================================
// Laser System
// =============================================================================

/**
 * Fire laser from paddle
 */
export function fireLaser(state: BrickBreakerState): BrickBreakerState {
  if (!state.paddle.hasLaser) return state;

  const paddleCenter = state.paddle.x + state.paddle.width / 2;

  const newLasers: LaserState[] = [
    {
      id: generateId(),
      x: paddleCenter - 8,
      y: CONFIG.paddleY - 5,
      vy: -10,
    },
    {
      id: generateId(),
      x: paddleCenter + 8,
      y: CONFIG.paddleY - 5,
      vy: -10,
    },
  ];

  return {
    ...state,
    lasers: [...state.lasers, ...newLasers],
  };
}

/**
 * Update lasers (movement and collision)
 */
export function updateLasers(state: BrickBreakerState): {
  newState: BrickBreakerState;
  events: GameEvent[];
} {
  const events: GameEvent[] = [];
  const newLasers: LaserState[] = [];
  let bricksToRemove: string[] = [];
  let scoreIncrease = 0;

  for (const laser of state.lasers) {
    const newY = laser.y + laser.vy;

    // Check if off screen
    if (newY < 0) continue;

    // Check brick collision
    let hitBrick = false;
    for (const brick of state.bricks) {
      if (bricksToRemove.includes(brick.id)) continue;

      const brickX =
        brick.col * (CONFIG.brickWidth + CONFIG.brickPadding) +
        CONFIG.brickPadding;
      const brickY =
        brick.row * (CONFIG.brickHeight + CONFIG.brickPadding) +
        CONFIG.brickTopOffset;

      if (
        laser.x >= brickX &&
        laser.x <= brickX + CONFIG.brickWidth &&
        newY >= brickY &&
        newY <= brickY + CONFIG.brickHeight
      ) {
        if (brick.type !== "indestructible") {
          bricksToRemove.push(brick.id);
          scoreIncrease += CONFIG.brickPoints[brick.type];
          events.push({ type: "laser_hit", brickId: brick.id });
        }
        hitBrick = true;
        break;
      }
    }

    if (!hitBrick) {
      newLasers.push({ ...laser, y: newY });
    }
  }

  return {
    newState: {
      ...state,
      lasers: newLasers,
      bricks: state.bricks.filter((b) => !bricksToRemove.includes(b.id)),
      score: state.score + scoreIncrease,
      bricksDestroyed: state.bricksDestroyed + bricksToRemove.length,
    },
    events,
  };
}

// =============================================================================
// Game State Management
// =============================================================================

/**
 * Handle ball lost
 */
export function handleBallLost(state: BrickBreakerState): BrickBreakerState {
  // If there are still active balls, continue
  if (state.balls.length > 1) {
    return state;
  }

  // Otherwise, lose a life
  const newLives = state.lives - 1;

  if (newLives <= 0) {
    return {
      ...state,
      lives: 0,
      phase: "gameOver",
      status: "gameOver",
      endedAt: Date.now(),
    };
  }

  // Reset ball to paddle
  return {
    ...state,
    lives: newLives,
    balls: [createInitialBall(true)],
    paddle: movePaddle(state, CONFIG.canvasWidth / 2).paddle,
    phase: "ready",
    // Clear temporary effects
    activeEffects: state.activeEffects.filter((e) => e.type === "extra_life"),
    powerUps: [],
    lasers: [],
  };
}

/**
 * Check if level is complete
 */
export function isLevelComplete(state: BrickBreakerState): boolean {
  return state.bricks.every((b) => b.type === "indestructible");
}

/**
 * Advance to next level
 */
export function advanceToNextLevel(
  state: BrickBreakerState,
): BrickBreakerState {
  const newLevel = state.currentLevel + 1;
  const levelCompleteBonus = CONFIG.levelCompleteBonus * state.currentLevel;

  // Check for perfect level (no lives lost)
  const isPerfect = state.lives === state.maxLives;
  const perfectBonus = isPerfect ? CONFIG.noMissBonus : 0;

  if (newLevel > CONFIG.totalLevels) {
    // Game completed!
    return {
      ...state,
      score: state.score + levelCompleteBonus + perfectBonus,
      perfectLevels: state.perfectLevels + (isPerfect ? 1 : 0),
      phase: "gameOver",
      status: "gameOver",
      endedAt: Date.now(),
    };
  }

  const newBricks = generateLevelBricks(newLevel);

  return {
    ...state,
    currentLevel: newLevel,
    bricks: newBricks,
    balls: [createInitialBall(true)],
    powerUps: [],
    lasers: [],
    activeEffects: [],
    paddle: createInitialPaddle(),
    score: state.score + levelCompleteBonus + perfectBonus,
    perfectLevels: state.perfectLevels + (isPerfect ? 1 : 0),
    phase: "ready",
  };
}

// =============================================================================
// Scoring & Stats
// =============================================================================

/**
 * Calculate final score with bonuses
 */
export function calculateFinalScore(state: BrickBreakerState): number {
  let finalScore = state.score;

  // Level completion bonus
  finalScore += state.currentLevel * CONFIG.levelCompleteBonus;

  // Perfect levels bonus
  finalScore += state.perfectLevels * CONFIG.noMissBonus;

  return finalScore;
}

/**
 * Create stats for session recording
 */
export function createBrickBreakerStats(
  state: BrickBreakerState,
): BrickBreakerStats {
  const maxBalls = Math.max(...state.balls.map(() => 1), state.balls.length);

  return {
    gameType: "brick_breaker",
    levelsCompleted: state.currentLevel - 1,
    bricksDestroyed: state.bricksDestroyed,
    powerUpsCollected: state.powerUpsCollected,
    perfectLevels: state.perfectLevels,
    maxMultiBall: maxBalls,
  };
}

// =============================================================================
// Rendering Helpers
// =============================================================================

/**
 * Get brick position on screen
 */
export function getBrickPosition(brick: BrickState): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x:
      brick.col * (CONFIG.brickWidth + CONFIG.brickPadding) +
      CONFIG.brickPadding,
    y:
      brick.row * (CONFIG.brickHeight + CONFIG.brickPadding) +
      CONFIG.brickTopOffset,
    width: CONFIG.brickWidth,
    height: CONFIG.brickHeight,
  };
}

/**
 * Get brick color based on type and hits remaining
 */
export function getBrickColor(brick: BrickState): string {
  if (brick.type === "standard") {
    // Use row-based color
    return ROW_COLORS[brick.row % ROW_COLORS.length];
  }

  // For silver and gold, darken based on hits remaining
  const baseColor = BRICK_COLORS[brick.type];
  if (brick.type === "silver" && brick.hitsRemaining === 1) {
    return "#A0A0A0";
  }
  if (brick.type === "gold") {
    if (brick.hitsRemaining === 2) return "#E6C200";
    if (brick.hitsRemaining === 1) return "#CC9900";
  }

  return baseColor;
}

/**
 * Get power-up display info
 */
export function getPowerUpDisplay(type: BrickPowerUpType): {
  color: string;
  icon: string;
  label: string;
} {
  return POWER_UP_INFO[type];
}

// =============================================================================
// Multi-ball Helpers
// =============================================================================

/**
 * Get current number of active balls
 */
export function getActiveBallCount(state: BrickBreakerState): number {
  return state.balls.filter((b) => !b.isStuck).length;
}

/**
 * Check if any balls are stuck (ready to launch)
 */
export function hasStuckBalls(state: BrickBreakerState): boolean {
  return state.balls.some((b) => b.isStuck);
}

// =============================================================================
// Level Info Helpers
// =============================================================================

/**
 * Get total brick count for level (excluding indestructible)
 */
export function getDestroyableBrickCount(bricks: BrickState[]): number {
  return bricks.filter((b) => b.type !== "indestructible").length;
}

/**
 * Get bricks remaining (excluding indestructible)
 */
export function getBricksRemaining(state: BrickBreakerState): number {
  return getDestroyableBrickCount(state.bricks);
}

/**
 * Get level progress percentage
 */
export function getLevelProgress(
  state: BrickBreakerState,
  initialBrickCount: number,
): number {
  const remaining = getBricksRemaining(state);
  const destroyed = initialBrickCount - remaining;
  return Math.round((destroyed / initialBrickCount) * 100);
}
