/**
 * Game Physics Utilities
 *
 * This file contains physics constants and utilities for all games:
 * - Ballz physics (trajectory, bouncing, energy loss)
 * - Collision detection algorithms
 *
 * @see docs/06_GAMES_RESEARCH.md for detailed physics research
 *
 * IMPORTANT: All physics calculations use delta time (dt) in milliseconds
 * to ensure frame-rate independent behavior.
 */

// =============================================================================
// Vector Types
// =============================================================================

/**
 * 2D Vector for position, velocity, etc.
 */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Create a new Vector2D
 */
export function vec2(x: number, y: number): Vector2D {
  return { x, y };
}

/**
 * Add two vectors
 */
export function vec2Add(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Subtract two vectors (a - b)
 */
export function vec2Sub(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * Scale a vector by a scalar
 */
export function vec2Scale(v: Vector2D, s: number): Vector2D {
  return { x: v.x * s, y: v.y * s };
}

/**
 * Get vector magnitude (length)
 */
export function vec2Magnitude(v: Vector2D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * Alias for vec2Magnitude
 */
export const vec2Length = vec2Magnitude;

/**
 * Normalize a vector (make length = 1)
 */
export function vec2Normalize(v: Vector2D): Vector2D {
  const mag = vec2Magnitude(v);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

/**
 * Dot product of two vectors
 */
export function vec2Dot(a: Vector2D, b: Vector2D): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Distance between two points
 */
export function vec2Distance(a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Squared distance (faster, no sqrt)
 */
export function vec2DistanceSquared(a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

// =============================================================================
// Bounce Blitz (Ballz) Physics
// =============================================================================

/**
 * Physics constants for Bounce Blitz
 *
 * Research notes:
 * - No gravity (balls maintain velocity)
 * - Elastic collisions with walls
 * - Slight energy loss on block hits
 *
 * @see docs/06_GAMES_RESEARCH.md Section 2.3
 */
export const BOUNCE_PHYSICS = {
  // Ball properties
  ballRadius: 8, // Ball radius in pixels
  ballSpeed: 0.5, // Ball speed (px/ms)
  releaseInterval: 80, // Ms between ball releases

  // Collision coefficients
  wallBounceCoeff: 1.0, // Perfect elastic for walls
  blockBounceCoeff: 0.98, // Slight energy loss on blocks

  // Grid
  gridColumns: 7,
  visibleRows: 8,
  blockSize: 45,
  blockPadding: 4,

  // Performance
  maxBallsInFlight: 200, // Performance limit
  velocityThreshold: 0.01, // Stop ball if slower
} as const;

/**
 * Bounce ball state
 */
export interface BounceBallState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

/**
 * Block state
 */
export interface BlockState {
  id: number;
  row: number;
  col: number;
  hp: number;
  type: "normal" | "ball" | "coin" | "stone";
}

/**
 * Calculate initial velocity from aim angle
 *
 * @param angle Angle in radians (0 = right, PI/2 = up)
 * @returns Velocity vector
 */
export function calculateLaunchVelocity(angle: number): Vector2D {
  // Angle is from horizontal, positive = upward
  // We want upward launch, so y should be negative (screen coords)
  return {
    x: Math.cos(angle) * BOUNCE_PHYSICS.ballSpeed,
    y: -Math.sin(angle) * BOUNCE_PHYSICS.ballSpeed,
  };
}

/**
 * Update ball position and handle wall bounces
 *
 * @param ball Ball state
 * @param dt Delta time
 * @param screenWidth Screen width
 * @param ceilingY Y position of ceiling
 * @param floorY Y position of floor (ball collection)
 * @returns Updated ball state
 */
export function updateBounceBall(
  ball: BounceBallState,
  dt: number,
  screenWidth: number,
  ceilingY: number,
  floorY: number,
): BounceBallState {
  if (!ball.active) return ball;

  // Update position
  let newX = ball.x + ball.vx * dt;
  let newY = ball.y + ball.vy * dt;
  let newVx = ball.vx;
  let newVy = ball.vy;

  // Left wall collision
  if (newX - BOUNCE_PHYSICS.ballRadius < 0) {
    newX = BOUNCE_PHYSICS.ballRadius;
    newVx = Math.abs(newVx) * BOUNCE_PHYSICS.wallBounceCoeff;
  }

  // Right wall collision
  if (newX + BOUNCE_PHYSICS.ballRadius > screenWidth) {
    newX = screenWidth - BOUNCE_PHYSICS.ballRadius;
    newVx = -Math.abs(newVx) * BOUNCE_PHYSICS.wallBounceCoeff;
  }

  // Ceiling collision
  if (newY - BOUNCE_PHYSICS.ballRadius < ceilingY) {
    newY = ceilingY + BOUNCE_PHYSICS.ballRadius;
    newVy = Math.abs(newVy) * BOUNCE_PHYSICS.wallBounceCoeff;
  }

  // Floor - ball collected
  if (newY + BOUNCE_PHYSICS.ballRadius > floorY) {
    return { ...ball, active: false };
  }

  return {
    ...ball,
    x: newX,
    y: newY,
    vx: newVx,
    vy: newVy,
  };
}

/**
 * Calculate trajectory preview points
 *
 * @param startX Starting X position
 * @param startY Starting Y position
 * @param angle Launch angle in radians
 * @param screenWidth Screen width
 * @param maxPoints Maximum points to calculate
 * @returns Array of trajectory points
 */
export function calculateTrajectory(
  startX: number,
  startY: number,
  angle: number,
  screenWidth: number,
  maxPoints: number = 50,
): Vector2D[] {
  const points: Vector2D[] = [{ x: startX, y: startY }];

  const velocity = calculateLaunchVelocity(angle);
  let x = startX;
  let y = startY;
  let vx = velocity.x;
  let vy = velocity.y;

  const stepSize = 5; // Pixels per step

  for (let i = 0; i < maxPoints; i++) {
    // Move along trajectory
    const speed = Math.sqrt(vx * vx + vy * vy);
    x += (vx / speed) * stepSize;
    y += (vy / speed) * stepSize;

    // Check wall bounces
    if (x < BOUNCE_PHYSICS.ballRadius) {
      x = BOUNCE_PHYSICS.ballRadius;
      vx = Math.abs(vx);
    }
    if (x > screenWidth - BOUNCE_PHYSICS.ballRadius) {
      x = screenWidth - BOUNCE_PHYSICS.ballRadius;
      vx = -Math.abs(vx);
    }
    if (y < BOUNCE_PHYSICS.ballRadius) {
      y = BOUNCE_PHYSICS.ballRadius;
      vy = Math.abs(vy);
    }

    points.push({ x, y });

    // Stop if going down past start
    if (y > startY + 100) break;
  }

  return points;
}

// =============================================================================
// Collision Detection
// =============================================================================

/**
 * Check circle-circle collision
 */
export function checkCircleCollision(
  c1: { x: number; y: number; radius: number },
  c2: { x: number; y: number; radius: number },
): boolean {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const distSquared = dx * dx + dy * dy;
  const radiusSum = c1.radius + c2.radius;
  return distSquared <= radiusSum * radiusSum;
}

/**
 * Check circle-rectangle collision
 *
 * @param cx Circle center X
 * @param cy Circle center Y
 * @param radius Circle radius
 * @param rx Rectangle X (top-left)
 * @param ry Rectangle Y (top-left)
 * @param rw Rectangle width
 * @param rh Rectangle height
 * @returns True if collision detected
 */
export function checkCircleRectCollision(
  cx: number,
  cy: number,
  radius: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  // Find closest point on rectangle to circle center
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));

  // Check if closest point is within circle
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Get collision side for ball-block collision
 *
 * Used to determine which direction to bounce the ball.
 */
export type CollisionSide = "top" | "bottom" | "left" | "right" | null;

export function getBlockCollisionSide(
  ballX: number,
  ballY: number,
  ballVx: number,
  ballVy: number,
  blockX: number,
  blockY: number,
  blockW: number,
  blockH: number,
): CollisionSide {
  // Calculate ball center relative to block center
  const blockCenterX = blockX + blockW / 2;
  const blockCenterY = blockY + blockH / 2;
  const relX = ballX - blockCenterX;
  const relY = ballY - blockCenterY;

  // Determine primary axis of collision
  const overlapX = blockW / 2 - Math.abs(relX);
  const overlapY = blockH / 2 - Math.abs(relY);

  if (overlapX < overlapY) {
    // Horizontal collision
    return relX > 0 ? "right" : "left";
  } else {
    // Vertical collision
    return relY > 0 ? "bottom" : "top";
  }
}

/**
 * Reflect velocity based on collision side
 */
export function reflectVelocity(
  vx: number,
  vy: number,
  side: CollisionSide,
  coefficient: number = 1.0,
): { vx: number; vy: number } {
  switch (side) {
    case "left":
    case "right":
      return { vx: -vx * coefficient, vy: vy * coefficient };
    case "top":
    case "bottom":
      return { vx: vx * coefficient, vy: -vy * coefficient };
    default:
      return { vx, vy };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Random number between min and max
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}
