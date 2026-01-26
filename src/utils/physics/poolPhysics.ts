/**
 * Pool Game Physics
 *
 * Pure functions for 8-ball pool physics calculations.
 * Uses simplified 2D physics for mobile performance.
 *
 * @see __tests__/games/pool/poolPhysics.test.ts
 */

// =============================================================================
// Constants
// =============================================================================

export const POOL_PHYSICS = {
  /** Ball radius in game units */
  BALL_RADIUS: 10,
  /** Ball mass (uniform) */
  BALL_MASS: 1,
  /** Friction coefficient (velocity multiplier per frame) */
  FRICTION: 0.985,
  /** Wall bounce coefficient (velocity retained) */
  WALL_BOUNCE: 0.8,
  /** Ball-ball collision coefficient */
  BALL_BOUNCE: 0.95,
  /** Velocity threshold below which ball stops */
  VELOCITY_THRESHOLD: 0.5,
  /** Maximum shot power */
  MAX_POWER: 500,
  /** Pocket radius (for detection) */
  POCKET_RADIUS: 18,
  /** Default table width */
  TABLE_WIDTH: 400,
  /** Default table height */
  TABLE_HEIGHT: 200,
} as const;

// =============================================================================
// Types
// =============================================================================

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  isPocketed: boolean;
  type: "cue" | "solid" | "stripe" | "eight";
}

export interface Pocket {
  x: number;
  y: number;
  radius: number;
}

export interface Shot {
  /** Angle in radians */
  angle: number;
  /** Power (0-100) */
  power: number;
}

export interface PoolTable {
  width: number;
  height: number;
  pockets: Pocket[];
}

export interface CollisionResult {
  ball1: Ball;
  ball2: Ball;
  collided: boolean;
}

// =============================================================================
// Ball Movement
// =============================================================================

/**
 * Update ball position based on velocity
 * @param ball - Ball to update
 * @param deltaTimeMs - Time elapsed in milliseconds
 * @returns Updated ball
 */
export function updateBallPosition(ball: Ball, deltaTimeMs: number): Ball {
  if (ball.isPocketed) return ball;

  const dt = deltaTimeMs / 1000;
  return {
    ...ball,
    x: ball.x + ball.vx * dt,
    y: ball.y + ball.vy * dt,
  };
}

/**
 * Apply friction to ball velocity
 * @param ball - Ball to apply friction to
 * @returns Ball with reduced velocity
 */
export function applyFriction(ball: Ball): Ball {
  if (ball.isPocketed) return ball;

  return {
    ...ball,
    vx: ball.vx * POOL_PHYSICS.FRICTION,
    vy: ball.vy * POOL_PHYSICS.FRICTION,
  };
}

/**
 * Stop ball if velocity is below threshold
 * @param ball - Ball to check
 * @param threshold - Velocity threshold (default from constants)
 * @returns Ball (potentially with zero velocity)
 */
export function checkStop(
  ball: Ball,
  threshold: number = POOL_PHYSICS.VELOCITY_THRESHOLD,
): Ball {
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  if (speed < threshold) {
    return { ...ball, vx: 0, vy: 0 };
  }
  return ball;
}

/**
 * Apply a shot to the cue ball
 * @param cueBall - The cue ball
 * @param shot - Shot parameters (angle and power)
 * @returns Cue ball with applied velocity
 */
export function applyShot(cueBall: Ball, shot: Shot): Ball {
  const power = Math.min(shot.power, 100) / 100; // Normalize to 0-1
  const velocity = power * POOL_PHYSICS.MAX_POWER;

  return {
    ...cueBall,
    vx: Math.cos(shot.angle) * velocity,
    vy: Math.sin(shot.angle) * velocity,
  };
}

// =============================================================================
// Collision Detection
// =============================================================================

/**
 * Check if two balls are colliding
 * @param ball1 - First ball
 * @param ball2 - Second ball
 * @returns true if balls are overlapping
 */
export function checkBallCollision(ball1: Ball, ball2: Ball): boolean {
  if (ball1.isPocketed || ball2.isPocketed) return false;

  const dx = ball2.x - ball1.x;
  const dy = ball2.y - ball1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const minDistance = ball1.radius + ball2.radius;

  return distance < minDistance;
}

/**
 * Check if a ball is colliding with a wall
 * @param ball - Ball to check
 * @param tableWidth - Width of the table
 * @param tableHeight - Height of the table
 * @returns Object indicating which walls are hit
 */
export function checkWallCollision(
  ball: Ball,
  tableWidth: number = POOL_PHYSICS.TABLE_WIDTH,
  tableHeight: number = POOL_PHYSICS.TABLE_HEIGHT,
): { left: boolean; right: boolean; top: boolean; bottom: boolean } {
  if (ball.isPocketed) {
    return { left: false, right: false, top: false, bottom: false };
  }

  return {
    left: ball.x - ball.radius <= 0,
    right: ball.x + ball.radius >= tableWidth,
    top: ball.y - ball.radius <= 0,
    bottom: ball.y + ball.radius >= tableHeight,
  };
}

/**
 * Check if a ball is in a pocket
 * @param ball - Ball to check
 * @param pockets - Array of pockets
 * @returns true if ball center is within pocket radius
 */
export function checkPocket(ball: Ball, pockets: Pocket[]): boolean {
  if (ball.isPocketed) return false;

  for (const pocket of pockets) {
    const dx = ball.x - pocket.x;
    const dy = ball.y - pocket.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < pocket.radius) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// Collision Resolution
// =============================================================================

/**
 * Resolve elastic collision between two balls
 * Uses conservation of momentum and kinetic energy
 *
 * @param ball1 - First ball
 * @param ball2 - Second ball
 * @returns Updated balls after collision
 */
export function resolveBallCollision(
  ball1: Ball,
  ball2: Ball,
): CollisionResult {
  if (!checkBallCollision(ball1, ball2)) {
    return { ball1, ball2, collided: false };
  }

  // Calculate collision normal
  const dx = ball2.x - ball1.x;
  const dy = ball2.y - ball1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Normalize
  const nx = dx / distance;
  const ny = dy / distance;

  // Relative velocity
  const dvx = ball1.vx - ball2.vx;
  const dvy = ball1.vy - ball2.vy;

  // Relative velocity along collision normal
  const dvn = dvx * nx + dvy * ny;

  // Don't resolve if velocities are separating
  if (dvn < 0) {
    return { ball1, ball2, collided: false };
  }

  // Impulse scalar (equal mass simplification)
  const impulse = dvn * POOL_PHYSICS.BALL_BOUNCE;

  // Apply impulse
  const newBall1: Ball = {
    ...ball1,
    vx: ball1.vx - impulse * nx,
    vy: ball1.vy - impulse * ny,
  };

  const newBall2: Ball = {
    ...ball2,
    vx: ball2.vx + impulse * nx,
    vy: ball2.vy + impulse * ny,
  };

  // Separate overlapping balls
  const overlap = ball1.radius + ball2.radius - distance;
  if (overlap > 0) {
    const separationX = (overlap / 2) * nx;
    const separationY = (overlap / 2) * ny;
    newBall1.x -= separationX;
    newBall1.y -= separationY;
    newBall2.x += separationX;
    newBall2.y += separationY;
  }

  return { ball1: newBall1, ball2: newBall2, collided: true };
}

/**
 * Resolve wall collision for a ball
 * @param ball - Ball to resolve
 * @param wall - Which wall was hit
 * @param bounceCoeff - Bounce coefficient (default from constants)
 * @param tableWidth - Table width for position correction
 * @param tableHeight - Table height for position correction
 * @returns Ball with reflected velocity
 */
export function resolveWallCollision(
  ball: Ball,
  wall: "left" | "right" | "top" | "bottom",
  bounceCoeff: number = POOL_PHYSICS.WALL_BOUNCE,
  tableWidth: number = POOL_PHYSICS.TABLE_WIDTH,
  tableHeight: number = POOL_PHYSICS.TABLE_HEIGHT,
): Ball {
  let newBall = { ...ball };

  switch (wall) {
    case "left":
      newBall.vx = Math.abs(newBall.vx) * bounceCoeff;
      newBall.x = Math.max(newBall.x, newBall.radius);
      break;
    case "right":
      newBall.vx = -Math.abs(newBall.vx) * bounceCoeff;
      newBall.x = Math.min(newBall.x, tableWidth - newBall.radius);
      break;
    case "top":
      newBall.vy = Math.abs(newBall.vy) * bounceCoeff;
      newBall.y = Math.max(newBall.y, newBall.radius);
      break;
    case "bottom":
      newBall.vy = -Math.abs(newBall.vy) * bounceCoeff;
      newBall.y = Math.min(newBall.y, tableHeight - newBall.radius);
      break;
  }

  return newBall;
}

// =============================================================================
// Simulation
// =============================================================================

/**
 * Simulate one physics tick for all balls
 * @param balls - Array of balls
 * @param table - Table configuration
 * @param deltaTimeMs - Time elapsed in milliseconds
 * @returns Updated balls array
 */
export function simulateTick(
  balls: Ball[],
  table: PoolTable,
  deltaTimeMs: number,
): Ball[] {
  let updatedBalls = [...balls];

  // Update positions
  updatedBalls = updatedBalls.map((ball) =>
    updateBallPosition(ball, deltaTimeMs),
  );

  // Check ball-ball collisions
  for (let i = 0; i < updatedBalls.length; i++) {
    for (let j = i + 1; j < updatedBalls.length; j++) {
      const result = resolveBallCollision(updatedBalls[i], updatedBalls[j]);
      if (result.collided) {
        updatedBalls[i] = result.ball1;
        updatedBalls[j] = result.ball2;
      }
    }
  }

  // Check wall collisions
  updatedBalls = updatedBalls.map((ball) => {
    const walls = checkWallCollision(ball, table.width, table.height);
    let newBall = ball;
    if (walls.left)
      newBall = resolveWallCollision(
        newBall,
        "left",
        POOL_PHYSICS.WALL_BOUNCE,
        table.width,
        table.height,
      );
    if (walls.right)
      newBall = resolveWallCollision(
        newBall,
        "right",
        POOL_PHYSICS.WALL_BOUNCE,
        table.width,
        table.height,
      );
    if (walls.top)
      newBall = resolveWallCollision(
        newBall,
        "top",
        POOL_PHYSICS.WALL_BOUNCE,
        table.width,
        table.height,
      );
    if (walls.bottom)
      newBall = resolveWallCollision(
        newBall,
        "bottom",
        POOL_PHYSICS.WALL_BOUNCE,
        table.width,
        table.height,
      );
    return newBall;
  });

  // Check pockets
  updatedBalls = updatedBalls.map((ball) => {
    if (checkPocket(ball, table.pockets)) {
      return { ...ball, isPocketed: true, vx: 0, vy: 0 };
    }
    return ball;
  });

  // Apply friction
  updatedBalls = updatedBalls.map((ball) => applyFriction(ball));

  // Stop slow balls
  updatedBalls = updatedBalls.map((ball) => checkStop(ball));

  return updatedBalls;
}

/**
 * Simulate a complete shot until all balls stop
 * @param balls - Initial ball positions
 * @param shot - Shot to apply to cue ball
 * @param table - Table configuration
 * @param maxIterations - Maximum simulation iterations (safety)
 * @returns Final ball positions
 */
export function simulateShot(
  balls: Ball[],
  shot: Shot,
  table: PoolTable,
  maxIterations: number = 1000,
): Ball[] {
  // Find and shoot cue ball
  let simulatedBalls = balls.map((ball) =>
    ball.type === "cue" ? applyShot(ball, shot) : ball,
  );

  const dt = 16; // Simulate at ~60fps
  let iterations = 0;

  while (iterations < maxIterations) {
    simulatedBalls = simulateTick(simulatedBalls, table, dt);

    // Check if all balls have stopped
    const allStopped = simulatedBalls.every(
      (ball) =>
        ball.isPocketed ||
        (Math.abs(ball.vx) < POOL_PHYSICS.VELOCITY_THRESHOLD &&
          Math.abs(ball.vy) < POOL_PHYSICS.VELOCITY_THRESHOLD),
    );

    if (allStopped) break;
    iterations++;
  }

  return simulatedBalls;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create standard pool table with 6 pockets
 */
export function createStandardTable(): PoolTable {
  const width = POOL_PHYSICS.TABLE_WIDTH;
  const height = POOL_PHYSICS.TABLE_HEIGHT;
  const pocketRadius = POOL_PHYSICS.POCKET_RADIUS;

  return {
    width,
    height,
    pockets: [
      // Corners
      { x: 0, y: 0, radius: pocketRadius }, // Top-left
      { x: width, y: 0, radius: pocketRadius }, // Top-right
      { x: 0, y: height, radius: pocketRadius }, // Bottom-left
      { x: width, y: height, radius: pocketRadius }, // Bottom-right
      // Side pockets
      { x: width / 2, y: 0, radius: pocketRadius }, // Top-middle
      { x: width / 2, y: height, radius: pocketRadius }, // Bottom-middle
    ],
  };
}

/**
 * Create a ball with default properties
 */
export function createBall(
  id: number,
  x: number,
  y: number,
  type: Ball["type"],
): Ball {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: POOL_PHYSICS.BALL_RADIUS,
    mass: POOL_PHYSICS.BALL_MASS,
    isPocketed: false,
    type,
  };
}

/**
 * Check if all balls have stopped moving
 */
export function areAllBallsStopped(balls: Ball[]): boolean {
  return balls.every(
    (ball) =>
      ball.isPocketed ||
      (Math.abs(ball.vx) < POOL_PHYSICS.VELOCITY_THRESHOLD &&
        Math.abs(ball.vy) < POOL_PHYSICS.VELOCITY_THRESHOLD),
  );
}

/**
 * Get ball speed (magnitude of velocity)
 */
export function getBallSpeed(ball: Ball): number {
  return Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
}
