/**
 * Pool Physics Unit Tests
 * Phase 7: Testing Requirements
 *
 * Tests for:
 * - Ball movement and friction
 * - Ball-ball collision detection and resolution
 * - Wall collision detection and resolution
 * - Pocket detection
 * - Shot simulation
 *
 * @see src/utils/physics/poolPhysics.ts
 */

import {
  applyFriction,
  applyShot,
  areAllBallsStopped,
  Ball,
  checkBallCollision,
  checkPocket,
  checkStop,
  checkWallCollision,
  createBall,
  createStandardTable,
  getBallSpeed,
  Pocket,
  POOL_PHYSICS,
  resolveBallCollision,
  resolveWallCollision,
  simulateShot,
  simulateTick,
  updateBallPosition,
} from "@/utils/physics/poolPhysics";

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestBall = (overrides: Partial<Ball> = {}): Ball => ({
  id: 1,
  x: 100,
  y: 100,
  vx: 0,
  vy: 0,
  radius: POOL_PHYSICS.BALL_RADIUS,
  mass: POOL_PHYSICS.BALL_MASS,
  isPocketed: false,
  type: "solid",
  ...overrides,
});

const testPockets: Pocket[] = [
  { x: 0, y: 0, radius: 15 },
  { x: 400, y: 0, radius: 15 },
  { x: 0, y: 200, radius: 15 },
  { x: 400, y: 200, radius: 15 },
];

// =============================================================================
// Ball Movement Tests
// =============================================================================

describe("Pool Physics", () => {
  describe("Ball Movement", () => {
    it("should apply velocity correctly", () => {
      const ball = createTestBall({ vx: 100, vy: 50 });
      const dt = 16; // 16ms

      const result = updateBallPosition(ball, dt);

      // x = 100 + 100 * 0.016 = 101.6
      expect(result.x).toBeCloseTo(100 + 100 * (dt / 1000));
      expect(result.y).toBeCloseTo(100 + 50 * (dt / 1000));
    });

    it("should not move pocketed ball", () => {
      const ball = createTestBall({ vx: 100, vy: 50, isPocketed: true });
      const dt = 16;

      const result = updateBallPosition(ball, dt);

      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it("should apply friction correctly", () => {
      const ball = createTestBall({ vx: 100, vy: 50 });

      const result = applyFriction(ball);

      expect(result.vx).toBeCloseTo(100 * POOL_PHYSICS.FRICTION);
      expect(result.vy).toBeCloseTo(50 * POOL_PHYSICS.FRICTION);
    });

    it("should stop ball when velocity is very small", () => {
      const ball = createTestBall({ vx: 0.3, vy: 0.2 });

      const result = checkStop(ball, POOL_PHYSICS.VELOCITY_THRESHOLD);

      expect(result.vx).toBe(0);
      expect(result.vy).toBe(0);
    });

    it("should not stop ball with significant velocity", () => {
      const ball = createTestBall({ vx: 10, vy: 10 });

      const result = checkStop(ball, POOL_PHYSICS.VELOCITY_THRESHOLD);

      expect(result.vx).toBe(10);
      expect(result.vy).toBe(10);
    });

    it("should apply shot to cue ball", () => {
      const cueBall = createTestBall({ type: "cue" });
      const shot = { angle: 0, power: 50 }; // 50% power, straight right

      const result = applyShot(cueBall, shot);

      expect(result.vx).toBeGreaterThan(0);
      expect(result.vy).toBeCloseTo(0);
    });

    it("should cap shot power at 100", () => {
      const cueBall = createTestBall({ type: "cue" });
      const shot = { angle: 0, power: 150 }; // Over max

      const result = applyShot(cueBall, shot);

      expect(result.vx).toBe(POOL_PHYSICS.MAX_POWER); // Capped at max
    });
  });

  // ===========================================================================
  // Collision Detection Tests
  // ===========================================================================

  describe("Collision Detection", () => {
    it("should detect ball-ball collision", () => {
      const ball1 = createTestBall({ x: 100, y: 100 });
      const ball2 = createTestBall({ x: 115, y: 100, id: 2 }); // 15px apart, radius 10 each

      expect(checkBallCollision(ball1, ball2)).toBe(true);
    });

    it("should not detect collision when balls are far apart", () => {
      const ball1 = createTestBall({ x: 100, y: 100 });
      const ball2 = createTestBall({ x: 150, y: 100, id: 2 }); // 50px apart

      expect(checkBallCollision(ball1, ball2)).toBe(false);
    });

    it("should not detect collision with pocketed ball", () => {
      const ball1 = createTestBall({ x: 100, y: 100 });
      const ball2 = createTestBall({ x: 105, y: 100, id: 2, isPocketed: true });

      expect(checkBallCollision(ball1, ball2)).toBe(false);
    });

    it("should detect ball touching ball exactly", () => {
      const ball1 = createTestBall({ x: 100, y: 100 });
      const ball2 = createTestBall({ x: 119.9, y: 100, id: 2 }); // Just under 2*radius apart

      expect(checkBallCollision(ball1, ball2)).toBe(true);
    });

    it("should detect wall collision on left", () => {
      const ball = createTestBall({ x: 5, y: 100 }); // Near left wall

      const walls = checkWallCollision(ball, 400, 200);

      expect(walls.left).toBe(true);
      expect(walls.right).toBe(false);
    });

    it("should detect wall collision on right", () => {
      const ball = createTestBall({ x: 395, y: 100 }); // Near right wall

      const walls = checkWallCollision(ball, 400, 200);

      expect(walls.right).toBe(true);
      expect(walls.left).toBe(false);
    });

    it("should detect wall collision on top", () => {
      const ball = createTestBall({ x: 100, y: 5 }); // Near top wall

      const walls = checkWallCollision(ball, 400, 200);

      expect(walls.top).toBe(true);
      expect(walls.bottom).toBe(false);
    });

    it("should detect wall collision on bottom", () => {
      const ball = createTestBall({ x: 100, y: 195 }); // Near bottom wall

      const walls = checkWallCollision(ball, 400, 200);

      expect(walls.bottom).toBe(true);
      expect(walls.top).toBe(false);
    });

    it("should detect corner collision (two walls)", () => {
      const ball = createTestBall({ x: 5, y: 5 }); // Top-left corner

      const walls = checkWallCollision(ball, 400, 200);

      expect(walls.left).toBe(true);
      expect(walls.top).toBe(true);
    });

    it("should detect ball in pocket", () => {
      const ball = createTestBall({ x: 5, y: 5 }); // Near top-left pocket

      expect(checkPocket(ball, testPockets)).toBe(true);
    });

    it("should not detect ball in pocket when far away", () => {
      const ball = createTestBall({ x: 200, y: 100 }); // Center of table

      expect(checkPocket(ball, testPockets)).toBe(false);
    });

    it("should not detect pocketed ball in pocket again", () => {
      const ball = createTestBall({ x: 5, y: 5, isPocketed: true });

      expect(checkPocket(ball, testPockets)).toBe(false);
    });
  });

  // ===========================================================================
  // Collision Resolution Tests
  // ===========================================================================

  describe("Collision Resolution", () => {
    it("should resolve ball-ball collision elastically", () => {
      const ball1 = createTestBall({ x: 100, y: 100, vx: 50, vy: 0 });
      const ball2 = createTestBall({ x: 118, y: 100, vx: 0, vy: 0, id: 2 });

      const result = resolveBallCollision(ball1, ball2);

      expect(result.collided).toBe(true);
      // Ball 1 should slow down
      expect(result.ball1.vx).toBeLessThan(50);
      // Ball 2 should speed up
      expect(result.ball2.vx).toBeGreaterThan(0);
    });

    it("should transfer momentum in head-on collision", () => {
      const ball1 = createTestBall({ x: 100, y: 100, vx: 50, vy: 0 });
      const ball2 = createTestBall({ x: 118, y: 100, vx: 0, vy: 0, id: 2 });

      const result = resolveBallCollision(ball1, ball2);

      // Total momentum should be approximately conserved
      const initialMomentum = 50 * ball1.mass;
      const finalMomentum =
        result.ball1.vx * ball1.mass + result.ball2.vx * ball2.mass;

      // Allow for some loss due to collision coefficient
      expect(finalMomentum).toBeCloseTo(
        initialMomentum * POOL_PHYSICS.BALL_BOUNCE,
        0,
      );
    });

    it("should separate overlapping balls", () => {
      const ball1 = createTestBall({ x: 100, y: 100, vx: 50, vy: 0 });
      const ball2 = createTestBall({ x: 115, y: 100, vx: 0, vy: 0, id: 2 }); // Overlapping

      const result = resolveBallCollision(ball1, ball2);

      const newDistance = Math.sqrt(
        Math.pow(result.ball2.x - result.ball1.x, 2) +
          Math.pow(result.ball2.y - result.ball1.y, 2),
      );

      expect(newDistance).toBeGreaterThanOrEqual(ball1.radius + ball2.radius);
    });

    it("should not resolve collision for separating balls", () => {
      const ball1 = createTestBall({ x: 100, y: 100, vx: -50, vy: 0 }); // Moving away
      const ball2 = createTestBall({ x: 118, y: 100, vx: 0, vy: 0, id: 2 });

      const result = resolveBallCollision(ball1, ball2);

      expect(result.collided).toBe(false);
    });

    it("should bounce off left wall correctly", () => {
      const ball = createTestBall({ x: 5, y: 100, vx: -50, vy: 10 });

      const result = resolveWallCollision(ball, "left");

      expect(result.vx).toBeGreaterThan(0); // Reversed
      expect(result.vx).toBeCloseTo(50 * POOL_PHYSICS.WALL_BOUNCE);
      expect(result.x).toBeGreaterThanOrEqual(ball.radius); // Pushed out
    });

    it("should bounce off right wall correctly", () => {
      const ball = createTestBall({ x: 395, y: 100, vx: 50, vy: 10 });

      const result = resolveWallCollision(
        ball,
        "right",
        POOL_PHYSICS.WALL_BOUNCE,
        400,
        200,
      );

      expect(result.vx).toBeLessThan(0); // Reversed
      expect(result.x).toBeLessThanOrEqual(400 - ball.radius); // Pushed in
    });

    it("should preserve tangential velocity on wall bounce", () => {
      const ball = createTestBall({ x: 5, y: 100, vx: -50, vy: 30 });

      const result = resolveWallCollision(ball, "left");

      expect(result.vy).toBe(30); // Y velocity unchanged
    });
  });

  // ===========================================================================
  // Simulation Tests
  // ===========================================================================

  describe("Simulation", () => {
    it("should simulate one tick correctly", () => {
      const table = createStandardTable();
      const balls = [createTestBall({ vx: 100, vy: 0, type: "cue" })];

      const result = simulateTick(balls, table, 16);

      // Ball should have moved
      expect(result[0].x).toBeGreaterThan(100);
      // Velocity should have decreased (friction)
      expect(Math.abs(result[0].vx)).toBeLessThan(100);
    });

    it("should complete pool physics simulation in reasonable time", () => {
      const table = createStandardTable();
      const balls = [
        createBall(0, 100, 100, "cue"),
        createBall(1, 200, 100, "solid"),
        createBall(2, 220, 90, "solid"),
        createBall(3, 220, 110, "solid"),
      ];
      const shot = { angle: 0, power: 80 };

      const start = performance.now();
      simulateShot(balls, shot, table);
      const duration = performance.now() - start;

      // Should complete in reasonable time (< 100ms for CI variability)
      expect(duration).toBeLessThan(100);
    });

    it("should pocket ball when it enters pocket", () => {
      const table = createStandardTable();
      // Ball heading toward top-left pocket
      const balls = [createTestBall({ x: 20, y: 20, vx: -50, vy: -50 })];

      const result = simulateTick(balls, table, 500); // Long tick to reach pocket

      expect(result[0].isPocketed).toBe(true);
    });

    it("should stop all balls eventually", () => {
      const table = createStandardTable();
      const balls = [createBall(0, 200, 100, "cue")];
      const shot = { angle: Math.PI / 4, power: 50 };

      const result = simulateShot(balls, shot, table, 2000);

      expect(areAllBallsStopped(result)).toBe(true);
    });
  });

  // ===========================================================================
  // Helper Function Tests
  // ===========================================================================

  describe("Helper Functions", () => {
    it("should create standard table with 6 pockets", () => {
      const table = createStandardTable();

      expect(table.pockets.length).toBe(6);
      expect(table.width).toBe(POOL_PHYSICS.TABLE_WIDTH);
      expect(table.height).toBe(POOL_PHYSICS.TABLE_HEIGHT);
    });

    it("should create ball with correct defaults", () => {
      const ball = createBall(1, 100, 100, "solid");

      expect(ball.id).toBe(1);
      expect(ball.x).toBe(100);
      expect(ball.y).toBe(100);
      expect(ball.type).toBe("solid");
      expect(ball.vx).toBe(0);
      expect(ball.vy).toBe(0);
      expect(ball.isPocketed).toBe(false);
    });

    it("should check if all balls stopped", () => {
      const stoppedBalls = [
        createTestBall({ vx: 0, vy: 0 }),
        createTestBall({ vx: 0, vy: 0, id: 2 }),
      ];

      expect(areAllBallsStopped(stoppedBalls)).toBe(true);

      const movingBalls = [
        createTestBall({ vx: 0, vy: 0 }),
        createTestBall({ vx: 10, vy: 0, id: 2 }),
      ];

      expect(areAllBallsStopped(movingBalls)).toBe(false);
    });

    it("should count pocketed balls as stopped", () => {
      const balls = [
        createTestBall({ vx: 0, vy: 0 }),
        createTestBall({ isPocketed: true, id: 2 }),
      ];

      expect(areAllBallsStopped(balls)).toBe(true);
    });

    it("should calculate ball speed correctly", () => {
      const ball = createTestBall({ vx: 3, vy: 4 });

      expect(getBallSpeed(ball)).toBe(5); // 3-4-5 triangle
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("Edge Cases", () => {
    it("should handle ball at exact corner", () => {
      const ball = createTestBall({ x: 0, y: 0, vx: -10, vy: -10 });

      const walls = checkWallCollision(ball, 400, 200);

      expect(walls.left).toBe(true);
      expect(walls.top).toBe(true);
    });

    it("should handle zero velocity", () => {
      const ball = createTestBall({ vx: 0, vy: 0 });
      const dt = 16;

      const result = updateBallPosition(ball, dt);

      expect(result.x).toBe(ball.x);
      expect(result.y).toBe(ball.y);
    });

    it("should handle very small delta time", () => {
      const ball = createTestBall({ vx: 100, vy: 100 });
      const dt = 0.001; // Very small

      const result = updateBallPosition(ball, dt);

      // Should still move, just very slightly
      expect(result.x).toBeGreaterThan(ball.x);
    });

    it("should handle multiple simultaneous collisions", () => {
      const table = createStandardTable();
      // Three balls in a row, cue hits first
      const balls = [
        createBall(0, 50, 100, "cue"),
        createBall(1, 75, 100, "solid"), // Very close
        createBall(2, 100, 100, "solid"), // Also close
      ];

      // Give cue ball velocity
      balls[0].vx = 200;

      // Simulate
      const result = simulateTick(balls, table, 16);

      // All balls should have some effect
      expect(result[2].vx).toBeGreaterThan(0); // Chain reaction
    });
  });
});
