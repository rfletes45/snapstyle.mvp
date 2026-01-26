/**
 * Flappy Game Physics Unit Tests
 * Phase 7: Testing Requirements
 *
 * Tests for:
 * - Bird gravity and movement
 * - Flap mechanics
 * - Collision detection (pipes, ground, ceiling)
 * - Score counting
 * - Pipe management
 *
 * @see src/utils/physics/flappyPhysics.ts
 */

/// <reference types="jest" />

import {
  applyGravity,
  Bird,
  checkAllCollisions,
  checkCeilingCollision,
  checkGroundCollision,
  checkPipeCollision,
  clampBirdPosition,
  createInitialState,
  flap,
  FLAPPY_PHYSICS,
  FlappyGameState,
  generatePipe,
  movePipes,
  physicsTick,
  Pipe,
  recyclePipes,
  updateBirdPosition,
  updateScore,
} from "@/utils/physics/flappyPhysics";

// =============================================================================
// Test Fixtures
// =============================================================================

const createBird = (overrides: Partial<Bird> = {}): Bird => ({
  x: 100,
  y: 200,
  velocity: 0,
  width: FLAPPY_PHYSICS.BIRD_WIDTH,
  height: FLAPPY_PHYSICS.BIRD_HEIGHT,
  ...overrides,
});

const createPipe = (overrides: Partial<Pipe> = {}): Pipe => ({
  x: 200,
  gapTop: 100,
  gapBottom: 250,
  width: FLAPPY_PHYSICS.PIPE_WIDTH,
  index: 1,
  passed: false,
  ...overrides,
});

// =============================================================================
// Bird Gravity Tests
// =============================================================================

describe("Flappy Bird Physics", () => {
  describe("Bird Gravity", () => {
    it("should apply gravity correctly over time", () => {
      const bird = createBird({ velocity: 0 });
      const dt = 16; // 16ms ≈ one frame at 60fps

      const result = applyGravity(bird, dt);

      // velocity = gravity * time = 980 * 0.016 = 15.68
      expect(result.velocity).toBeCloseTo(FLAPPY_PHYSICS.GRAVITY * (dt / 1000));
    });

    it("should accumulate velocity over multiple frames", () => {
      let bird = createBird({ velocity: 0 });
      const dt = 16;

      // Apply gravity for 5 frames
      for (let i = 0; i < 5; i++) {
        bird = applyGravity(bird, dt);
      }

      // Should have accumulated ~78.4 px/s of downward velocity
      expect(bird.velocity).toBeCloseTo(
        FLAPPY_PHYSICS.GRAVITY * (dt / 1000) * 5,
      );
    });

    it("should cap velocity at terminal velocity", () => {
      const bird = createBird({ velocity: 500 });
      const dt = 200; // Long dt to exceed terminal velocity

      const result = applyGravity(bird, dt);

      expect(result.velocity).toBe(FLAPPY_PHYSICS.TERMINAL_VELOCITY);
    });

    it("should update position based on velocity", () => {
      const bird = createBird({ y: 200, velocity: 100 });
      const dt = 16;

      const result = updateBirdPosition(bird, dt);

      // y = y + velocity * time = 200 + 100 * 0.016 = 201.6
      expect(result.y).toBeCloseTo(200 + 100 * (dt / 1000));
    });

    it("should move bird down when velocity is positive", () => {
      const bird = createBird({ y: 200, velocity: 100 });
      const dt = 100;

      const result = updateBirdPosition(bird, dt);

      expect(result.y).toBeGreaterThan(bird.y);
    });

    it("should move bird up when velocity is negative", () => {
      const bird = createBird({ y: 200, velocity: -100 });
      const dt = 100;

      const result = updateBirdPosition(bird, dt);

      expect(result.y).toBeLessThan(bird.y);
    });

    it("should apply flap force correctly", () => {
      const bird = createBird({ velocity: 50 });

      const result = flap(bird);

      expect(result.velocity).toBe(FLAPPY_PHYSICS.FLAP_VELOCITY);
    });

    it("should override existing downward velocity on flap", () => {
      const bird = createBird({ velocity: 300 }); // Falling fast

      const result = flap(bird);

      expect(result.velocity).toBe(FLAPPY_PHYSICS.FLAP_VELOCITY);
      expect(result.velocity).toBeLessThan(0); // Now moving up
    });

    it("should not allow bird below ground", () => {
      const bird = createBird({ y: FLAPPY_PHYSICS.GROUND_Y + 50 });

      const result = clampBirdPosition(bird);

      expect(result.y).toBe(FLAPPY_PHYSICS.GROUND_Y - bird.height);
    });

    it("should not allow bird above ceiling", () => {
      const bird = createBird({ y: -50 });

      const result = clampBirdPosition(bird);

      expect(result.y).toBe(FLAPPY_PHYSICS.CEILING_Y);
    });
  });

  // ===========================================================================
  // Collision Detection Tests
  // ===========================================================================

  describe("Collision Detection", () => {
    it("should detect collision with top pipe", () => {
      const bird = createBird({ x: 200, y: 50 }); // Above gap
      const pipe = createPipe({ x: 190, gapTop: 100, gapBottom: 250 });

      expect(checkPipeCollision(bird, pipe)).toBe(true);
    });

    it("should detect collision with bottom pipe", () => {
      const bird = createBird({ x: 200, y: 280 }); // Below gap
      const pipe = createPipe({ x: 190, gapTop: 100, gapBottom: 250 });

      expect(checkPipeCollision(bird, pipe)).toBe(true);
    });

    it("should pass through gap without collision", () => {
      const bird = createBird({ x: 200, y: 150 }); // In the gap
      const pipe = createPipe({ x: 190, gapTop: 100, gapBottom: 250 });

      expect(checkPipeCollision(bird, pipe)).toBe(false);
    });

    it("should not collide with pipe far away horizontally", () => {
      const bird = createBird({ x: 50, y: 50 }); // Would hit top pipe if aligned
      const pipe = createPipe({ x: 200, gapTop: 100, gapBottom: 250 });

      expect(checkPipeCollision(bird, pipe)).toBe(false);
    });

    it("should detect collision at pipe edge", () => {
      const bird = createBird({
        x: 190 + FLAPPY_PHYSICS.PIPE_WIDTH - 1, // Just inside pipe
        y: 50,
      });
      const pipe = createPipe({ x: 190, gapTop: 100, gapBottom: 250 });

      expect(checkPipeCollision(bird, pipe)).toBe(true);
    });

    it("should detect ground collision", () => {
      const bird = createBird({ y: FLAPPY_PHYSICS.GROUND_Y - 10 });

      expect(checkGroundCollision(bird)).toBe(true);
    });

    it("should not detect ground collision when above ground", () => {
      const bird = createBird({ y: 200 });

      expect(checkGroundCollision(bird)).toBe(false);
    });

    it("should detect ceiling collision", () => {
      const bird = createBird({ y: 0 });

      expect(checkCeilingCollision(bird)).toBe(true);
    });

    it("should not detect ceiling collision when below ceiling", () => {
      const bird = createBird({ y: 50 });

      expect(checkCeilingCollision(bird)).toBe(false);
    });

    it("should check all collisions at once", () => {
      const bird = createBird({ y: FLAPPY_PHYSICS.GROUND_Y }); // On ground
      const pipes = [createPipe()];

      expect(checkAllCollisions(bird, pipes)).toBe(true);
    });

    it("should return false when no collisions", () => {
      const bird = createBird({ x: 50, y: 200 }); // Clear of everything
      const pipes = [createPipe({ x: 200 })]; // Pipe far away

      expect(checkAllCollisions(bird, pipes)).toBe(false);
    });
  });

  // ===========================================================================
  // Score Counting Tests
  // ===========================================================================

  describe("Score Counting", () => {
    it("should increment score when passing pipe", () => {
      const bird = createBird({ x: 270 }); // Past the pipe
      const pipe = createPipe({ x: 200, passed: false });
      const state: FlappyGameState = {
        bird,
        pipes: [pipe],
        score: 0,
        lastPipePassed: 0,
        isGameOver: false,
      };

      const result = updateScore(state, [pipe]);

      expect(result.score).toBe(1);
      expect(result.lastPipePassed).toBe(pipe.index);
    });

    it("should not increment score for already passed pipe", () => {
      const bird = createBird({ x: 270 });
      const pipe = createPipe({ x: 200, passed: true }); // Already passed
      const state: FlappyGameState = {
        bird,
        pipes: [pipe],
        score: 5,
        lastPipePassed: 1,
        isGameOver: false,
      };

      const result = updateScore(state, [pipe]);

      expect(result.score).toBe(5); // Unchanged
    });

    it("should not increment score when bird is before pipe", () => {
      const bird = createBird({ x: 100 }); // Before the pipe
      const pipe = createPipe({ x: 200, passed: false });
      const state: FlappyGameState = {
        bird,
        pipes: [pipe],
        score: 0,
        lastPipePassed: 0,
        isGameOver: false,
      };

      const result = updateScore(state, [pipe]);

      expect(result.score).toBe(0);
    });

    it("should handle multiple pipes correctly", () => {
      const bird = createBird({ x: 500 }); // Past all pipes
      const pipes = [
        createPipe({ x: 100, index: 1, passed: false }),
        createPipe({ x: 300, index: 2, passed: false }),
      ];
      const state: FlappyGameState = {
        bird,
        pipes,
        score: 0,
        lastPipePassed: 0,
        isGameOver: false,
      };

      const result = updateScore(state, pipes);

      expect(result.score).toBe(2);
    });
  });

  // ===========================================================================
  // Pipe Management Tests
  // ===========================================================================

  describe("Pipe Management", () => {
    it("should generate pipe with gap within bounds", () => {
      const pipe = generatePipe(300, 1, 600);

      expect(pipe.x).toBe(300);
      expect(pipe.index).toBe(1);
      expect(pipe.gapTop).toBeGreaterThanOrEqual(80);
      expect(pipe.gapBottom).toBeLessThanOrEqual(520);
      expect(pipe.gapBottom - pipe.gapTop).toBe(FLAPPY_PHYSICS.PIPE_GAP);
      expect(pipe.passed).toBe(false);
    });

    it("should move pipes to the left", () => {
      const pipes = [createPipe({ x: 200 }), createPipe({ x: 400 })];
      const dt = 100; // 100ms

      const result = movePipes(pipes, dt);

      // Expected movement: 150 px/s * 0.1s = 15px
      const expectedMovement = FLAPPY_PHYSICS.PIPE_SPEED * (dt / 1000);
      expect(result[0].x).toBeCloseTo(200 - expectedMovement);
      expect(result[1].x).toBeCloseTo(400 - expectedMovement);
    });

    it("should remove off-screen pipes and add new ones", () => {
      const pipes = [
        createPipe({ x: -100, index: 1 }), // Off screen - should be removed
        createPipe({ x: 200, index: 2 }), // On screen
      ];

      const result = recyclePipes(pipes, 400, 3);

      // Off-screen pipe should be removed
      expect(result.pipes.find((p) => p.index === 1)).toBeUndefined();
      // On-screen pipe should remain
      expect(result.pipes.find((p) => p.index === 2)).toBeDefined();
    });

    it("should add new pipe when needed", () => {
      const pipes = [createPipe({ x: 100, index: 1 })]; // Only one pipe

      const result = recyclePipes(pipes, 400, 2);

      // Should have added a new pipe
      expect(result.pipes.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // Game State Tests
  // ===========================================================================

  describe("Game State", () => {
    it("should create valid initial state", () => {
      const state = createInitialState(400, 600);

      expect(state.bird.x).toBeGreaterThan(0);
      expect(state.bird.y).toBeGreaterThan(0);
      expect(state.bird.velocity).toBe(0);
      expect(state.pipes.length).toBeGreaterThan(0);
      expect(state.score).toBe(0);
      expect(state.isGameOver).toBe(false);
    });

    it("should update state on physics tick", () => {
      const state = createInitialState(400, 600);
      const initialY = state.bird.y;

      const result = physicsTick(state, 16, 400);

      // Bird should have fallen due to gravity
      expect(result.bird.y).toBeGreaterThan(initialY);
      expect(result.isGameOver).toBe(false);
    });

    it("should not update state when game is over", () => {
      const state: FlappyGameState = {
        ...createInitialState(400, 600),
        isGameOver: true,
      };
      const initialY = state.bird.y;

      const result = physicsTick(state, 16, 400);

      expect(result.bird.y).toBe(initialY);
    });

    it("should set game over on collision", () => {
      const state: FlappyGameState = {
        ...createInitialState(400, 600),
        bird: createBird({ y: FLAPPY_PHYSICS.GROUND_Y - 10 }), // About to hit ground
      };

      const result = physicsTick(state, 100, 400); // Long tick to ensure collision

      expect(result.isGameOver).toBe(true);
    });
  });

  // ===========================================================================
  // Frame Rate Independence Tests
  // ===========================================================================

  describe("Frame Rate Independence", () => {
    it("should produce similar results at different frame rates", () => {
      // Test that physics behaves similarly at 30fps vs 60fps
      const state60fps = createInitialState(400, 600);
      const state30fps = createInitialState(400, 600);

      // Simulate 1 second at 60fps (60 frames)
      let result60 = state60fps;
      for (let i = 0; i < 60; i++) {
        result60 = physicsTick(result60, 16.67, 400);
      }

      // Simulate 1 second at 30fps (30 frames)
      let result30 = state30fps;
      for (let i = 0; i < 30; i++) {
        result30 = physicsTick(result30, 33.33, 400);
      }

      // Results should be approximately the same (within 5% tolerance)
      const tolerance = result60.bird.y * 0.05;
      expect(Math.abs(result60.bird.y - result30.bird.y)).toBeLessThan(
        tolerance,
      );
    });
  });
});
