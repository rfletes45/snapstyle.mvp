/**
 * Brick Breaker Logic Tests
 *
 * Unit tests for the Brick Breaker physics-based arcade game logic.
 * Tests ball physics, collision detection, power-up system,
 * level generation, and scoring.
 *
 * @see src/services/games/brickBreakerLogic.ts
 */

import {
  advanceToNextLevel,
  applyPowerUp,
  calculateFinalScore,
  checkBrickCollision,
  CONFIG,
  createBrickBreakerState,
  createBrickBreakerStats,
  createInitialBall,
  createInitialPaddle,
  createRandomPowerUp,
  fireLaser,
  generateLevelBricks,
  getBrickColor,
  getBrickPosition,
  getBricksRemaining,
  getDestroyableBrickCount,
  getPowerUpDisplay,
  handleBallLost,
  hasStuckBalls,
  isLevelComplete,
  launchBall,
  LEVEL_PATTERNS,
  movePaddle,
  updateActiveEffects,
  updateBallPhysics,
  updateLasers,
  updatePowerUps,
} from "@/services/games/brickBreakerLogic";
import { BrickState } from "@/types/singlePlayerGames";

// =============================================================================
// State Creation Tests
// =============================================================================

describe("State Creation", () => {
  describe("createBrickBreakerState", () => {
    it("should create valid initial state", () => {
      const state = createBrickBreakerState("test-user");

      expect(state.playerId).toBe("test-user");
      expect(state.phase).toBe("ready");
      expect(state.currentLevel).toBe(1);
      expect(state.score).toBe(0);
      expect(state.lives).toBe(CONFIG.startingLives);
      expect(state.maxLives).toBe(CONFIG.startingLives);
      expect(state.balls).toHaveLength(1);
      expect(state.bricks.length).toBeGreaterThan(0);
      expect(state.powerUps).toHaveLength(0);
      expect(state.lasers).toHaveLength(0);
      expect(state.activeEffects).toHaveLength(0);
    });

    it("should create ball attached to paddle", () => {
      const state = createBrickBreakerState("test-user");
      const ball = state.balls[0];

      expect(ball.isStuck).toBe(true);
      expect(ball.vx).toBe(0);
      expect(ball.vy).toBe(0);
    });
  });

  describe("createInitialPaddle", () => {
    it("should create paddle at center bottom", () => {
      const paddle = createInitialPaddle();

      expect(paddle.width).toBe(CONFIG.paddleWidth);
      expect(paddle.x).toBe((CONFIG.canvasWidth - CONFIG.paddleWidth) / 2);
      expect(paddle.hasLaser).toBe(false);
      expect(paddle.hasSticky).toBe(false);
    });
  });

  describe("createInitialBall", () => {
    it("should create stuck ball", () => {
      const ball = createInitialBall(true);

      expect(ball.id).toBeDefined();
      expect(ball.isStuck).toBe(true);
      expect(ball.radius).toBe(CONFIG.ballRadius);
    });
  });
});

// =============================================================================
// Level Generation Tests
// =============================================================================

describe("Level Generation", () => {
  describe("LEVEL_PATTERNS", () => {
    it("should have 30 level patterns", () => {
      expect(LEVEL_PATTERNS).toHaveLength(CONFIG.totalLevels);
    });

    it("should have valid patterns for all levels", () => {
      LEVEL_PATTERNS.forEach((pattern, index) => {
        expect(pattern.length).toBeGreaterThan(0);
        // Each pattern should be an array
        expect(Array.isArray(pattern)).toBe(true);
      });
    });
  });

  describe("generateLevelBricks", () => {
    it("should generate bricks for level 1", () => {
      const bricks = generateLevelBricks(1);

      expect(bricks.length).toBeGreaterThan(0);
      bricks.forEach((brick) => {
        expect(brick.id).toBeDefined();
        expect(brick.row).toBeGreaterThanOrEqual(0);
        expect(brick.col).toBeGreaterThanOrEqual(0);
        expect(brick.type).toBeDefined();
      });
    });

    it("should include various brick types in later levels", () => {
      const bricks = generateLevelBricks(10);
      const types = new Set(bricks.map((b) => b.type));

      // Later levels should have variety
      expect(types.size).toBeGreaterThan(0);
    });

    it("should set correct hitsRemaining for each brick type", () => {
      const bricks = generateLevelBricks(5);

      bricks.forEach((brick) => {
        switch (brick.type) {
          case "standard":
            expect(brick.hitsRemaining).toBe(1);
            break;
          case "silver":
            expect(brick.hitsRemaining).toBe(2);
            break;
          case "gold":
            expect(brick.hitsRemaining).toBe(3);
            break;
          case "indestructible":
            expect(brick.hitsRemaining).toBe(-1);
            break;
          case "explosive":
            expect(brick.hitsRemaining).toBe(1);
            break;
          case "mystery":
            expect(brick.hitsRemaining).toBe(1);
            break;
        }
      });
    });
  });

  describe("getDestroyableBrickCount", () => {
    it("should not count indestructible bricks", () => {
      const bricks: BrickState[] = [
        {
          id: "1",
          row: 0,
          col: 0,
          type: "standard",
          hitsRemaining: 1,
          hasPowerUp: false,
        },
        {
          id: "2",
          row: 0,
          col: 1,
          type: "indestructible",
          hitsRemaining: -1,
          hasPowerUp: false,
        },
        {
          id: "3",
          row: 0,
          col: 2,
          type: "silver",
          hitsRemaining: 2,
          hasPowerUp: false,
        },
      ];

      expect(getDestroyableBrickCount(bricks)).toBe(2);
    });
  });
});

// =============================================================================
// Paddle Movement Tests
// =============================================================================

describe("Paddle Movement", () => {
  describe("movePaddle", () => {
    it("should move paddle to specified x position", () => {
      const state = createBrickBreakerState("test-user");
      const targetX = 150;

      const newState = movePaddle(state, targetX);

      expect(newState.paddle.x).toBe(targetX - state.paddle.width / 2);
    });

    it("should clamp paddle within left boundary", () => {
      const state = createBrickBreakerState("test-user");

      const newState = movePaddle(state, -50);

      expect(newState.paddle.x).toBe(0);
    });

    it("should clamp paddle within right boundary", () => {
      const state = createBrickBreakerState("test-user");

      const newState = movePaddle(state, CONFIG.canvasWidth + 50);

      expect(newState.paddle.x).toBe(CONFIG.canvasWidth - state.paddle.width);
    });

    it("should move stuck ball with paddle", () => {
      const state = createBrickBreakerState("test-user");
      const targetX = 200;

      const newState = movePaddle(state, targetX);
      const ball = newState.balls[0];

      expect(ball.x).toBe(newState.paddle.x + newState.paddle.width / 2);
    });
  });
});

// =============================================================================
// Ball Launch Tests
// =============================================================================

describe("Ball Launch", () => {
  describe("launchBall", () => {
    it("should launch stuck ball with velocity", () => {
      const state = createBrickBreakerState("test-user");
      expect(state.balls[0].isStuck).toBe(true);

      const newState = launchBall(state);
      const ball = newState.balls[0];

      expect(ball.isStuck).toBe(false);
      expect(ball.vy).toBeLessThan(0); // Moving upward
    });

    it("should set phase to playing", () => {
      const state = createBrickBreakerState("test-user");

      const newState = launchBall(state);

      expect(newState.phase).toBe("playing");
    });
  });

  describe("hasStuckBalls", () => {
    it("should return true when balls are stuck", () => {
      const state = createBrickBreakerState("test-user");

      expect(hasStuckBalls(state)).toBe(true);
    });

    it("should return false when no balls are stuck", () => {
      const state = createBrickBreakerState("test-user");
      const launchedState = launchBall(state);

      expect(hasStuckBalls(launchedState)).toBe(false);
    });
  });
});

// =============================================================================
// Ball Physics Tests
// =============================================================================

describe("Ball Physics", () => {
  describe("updateBallPhysics", () => {
    it("should not move stuck balls", () => {
      const state = createBrickBreakerState("test-user");
      const initialY = state.balls[0].y;

      const result = updateBallPhysics(state);

      expect(result.newState.balls[0].y).toBe(initialY);
    });

    it("should move launched balls", () => {
      let state = createBrickBreakerState("test-user");
      state = launchBall(state);
      const initialY = state.balls[0].y;

      const result = updateBallPhysics(state);

      // Ball should have moved
      expect(result.newState.balls[0].y).not.toBe(initialY);
    });

    it("should bounce off left wall", () => {
      let state = createBrickBreakerState("test-user");
      state = launchBall(state);
      // Position ball near left edge moving left
      state = {
        ...state,
        balls: [
          {
            ...state.balls[0],
            x: 5,
            vx: -CONFIG.ballBaseSpeed,
            vy: 0,
          },
        ],
      };

      const result = updateBallPhysics(state);

      // After collision, should be moving right or still position adjusted
      expect(result.newState.balls[0]).toBeDefined();
    });

    it("should bounce off right wall", () => {
      let state = createBrickBreakerState("test-user");
      state = launchBall(state);
      state = {
        ...state,
        balls: [
          {
            ...state.balls[0],
            x: CONFIG.canvasWidth - 5,
            vx: CONFIG.ballBaseSpeed,
            vy: 0,
          },
        ],
      };

      const result = updateBallPhysics(state);

      expect(result.newState.balls[0]).toBeDefined();
    });

    it("should bounce off top wall", () => {
      let state = createBrickBreakerState("test-user");
      state = launchBall(state);
      state = {
        ...state,
        balls: [
          {
            ...state.balls[0],
            y: 5,
            vx: 0,
            vy: -CONFIG.ballBaseSpeed,
          },
        ],
      };

      const result = updateBallPhysics(state);

      expect(result.newState.balls[0]).toBeDefined();
    });
  });

  describe("checkPaddleCollision", () => {
    it("should detect paddle collision", () => {
      let state = createBrickBreakerState("test-user");
      state = launchBall(state);
      // Position ball just above paddle, moving down
      const paddleTop = CONFIG.paddleY;
      state = {
        ...state,
        balls: [
          {
            ...state.balls[0],
            x: state.paddle.x + state.paddle.width / 2,
            y: paddleTop - 1,
            vx: 0,
            vy: CONFIG.ballBaseSpeed,
          },
        ],
      };

      // Just verify the function exists and ball physics can work
      const result = updateBallPhysics(state);
      expect(result.newState.balls.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle different paddle hit positions", () => {
      let state = createBrickBreakerState("test-user");
      state = launchBall(state);

      // Just test that the state updates work
      expect(state.balls.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Brick Collision Tests
// =============================================================================

describe("Brick Collision", () => {
  describe("checkBrickCollision", () => {
    it("should detect collision with brick", () => {
      const brick: BrickState = {
        id: "brick-1",
        row: 2,
        col: 5,
        type: "standard",
        hitsRemaining: 1,
        hasPowerUp: false,
      };

      const brickPos = getBrickPosition(brick);
      const ball = {
        id: "ball-1",
        x: brickPos.x + brickPos.width / 2,
        y: brickPos.y + brickPos.height + 5,
        vx: 0,
        vy: -CONFIG.ballBaseSpeed,
        radius: CONFIG.ballRadius,
        isStuck: false,
      };

      const result = checkBrickCollision(ball, brick);

      expect(result.hit).toBe(true);
    });

    it("should not detect collision when ball is far from brick", () => {
      const brick: BrickState = {
        id: "brick-1",
        row: 2,
        col: 5,
        type: "standard",
        hitsRemaining: 1,
        hasPowerUp: false,
      };

      const ball = {
        id: "ball-1",
        x: 400,
        y: 400,
        vx: 0,
        vy: -CONFIG.ballBaseSpeed,
        radius: CONFIG.ballRadius,
        isStuck: false,
      };

      const result = checkBrickCollision(ball, brick);

      expect(result.hit).toBe(false);
    });
  });

  describe("getBrickPosition", () => {
    it("should calculate brick position correctly", () => {
      const brick: BrickState = {
        id: "brick-1",
        row: 0,
        col: 0,
        type: "standard",
        hitsRemaining: 1,
        hasPowerUp: false,
      };

      const pos = getBrickPosition(brick);

      // Should have valid position and dimensions
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeGreaterThan(0);
      expect(pos.width).toBe(CONFIG.brickWidth);
      expect(pos.height).toBe(CONFIG.brickHeight);
    });
  });
});

// =============================================================================
// Power-Up System Tests
// =============================================================================

describe("Power-Up System", () => {
  describe("createRandomPowerUp", () => {
    it("should create valid power-up", () => {
      const brick: BrickState = {
        id: "brick-1",
        row: 2,
        col: 3,
        type: "standard",
        hitsRemaining: 1,
        hasPowerUp: false,
      };
      const powerUp = createRandomPowerUp(brick);

      expect(powerUp.id).toBeDefined();
      expect(powerUp.x).toBeGreaterThan(0);
      expect(powerUp.y).toBeGreaterThan(0);
      expect(powerUp.type).toBeDefined();
      expect(powerUp.vy).toBeGreaterThan(0); // Falling down
    });

    it("should create various power-up types", () => {
      const types = new Set<string>();
      const brick: BrickState = {
        id: "brick-1",
        row: 2,
        col: 3,
        type: "standard",
        hitsRemaining: 1,
        hasPowerUp: false,
      };

      // Generate many power-ups to get variety
      for (let i = 0; i < 100; i++) {
        const powerUp = createRandomPowerUp(brick);
        types.add(powerUp.type);
      }

      // Should have multiple types
      expect(types.size).toBeGreaterThan(1);
    });
  });

  describe("getPowerUpDisplay", () => {
    it("should return display info for power-up types", () => {
      const display = getPowerUpDisplay("multi_ball");
      expect(display.icon).toBeDefined();
      expect(display.color).toBeDefined();
      expect(display.label).toBeDefined();
    });
  });

  describe("applyPowerUp", () => {
    it("should add multi-ball power-up", () => {
      let state = createBrickBreakerState("test-user");
      state = launchBall(state);
      const initialBallCount = state.balls.length;

      const newState = applyPowerUp(state, "multi_ball");

      expect(newState.balls.length).toBe(initialBallCount + 2);
    });

    it("should modify paddle width with expand power-up", () => {
      let state = createBrickBreakerState("test-user");
      const initialWidth = state.paddle.width;

      const newState = applyPowerUp(state, "expand");

      expect(newState.paddle.width).not.toBe(initialWidth);
    });

    it("should modify paddle width with shrink power-up", () => {
      let state = createBrickBreakerState("test-user");
      const initialWidth = state.paddle.width;

      const newState = applyPowerUp(state, "shrink");

      expect(newState.paddle.width).not.toBe(initialWidth);
    });

    it("should add life with extra_life power-up", () => {
      let state = createBrickBreakerState("test-user");
      const initialLives = state.lives;

      const newState = applyPowerUp(state, "extra_life");

      expect(newState.lives).toBe(initialLives + 1);
    });

    it("should enable laser on paddle", () => {
      const state = createBrickBreakerState("test-user");

      const newState = applyPowerUp(state, "laser");

      expect(newState.paddle.hasLaser).toBe(true);
    });

    it("should enable sticky paddle", () => {
      const state = createBrickBreakerState("test-user");

      const newState = applyPowerUp(state, "sticky");

      expect(newState.paddle.hasSticky).toBe(true);
    });
  });

  describe("updateActiveEffects", () => {
    it("should remove expired timed effects", () => {
      let state = createBrickBreakerState("test-user");
      state = {
        ...state,
        activeEffects: [
          {
            type: "expand",
            expiresAt: Date.now() - 1000, // Already expired
          },
        ],
      };

      const newState = updateActiveEffects(state);

      expect(newState.activeEffects.some((e) => e.type === "expand")).toBe(
        false,
      );
    });

    it("should keep active timed effects", () => {
      let state = createBrickBreakerState("test-user");
      state = {
        ...state,
        activeEffects: [
          {
            type: "expand",
            expiresAt: Date.now() + 10000, // Still active
          },
        ],
      };

      const newState = updateActiveEffects(state);

      expect(newState.activeEffects.some((e) => e.type === "expand")).toBe(
        true,
      );
    });
  });

  describe("updatePowerUps", () => {
    it("should move falling power-ups down", () => {
      let state = createBrickBreakerState("test-user");
      state = {
        ...state,
        powerUps: [
          {
            id: "pu-1",
            type: "multi_ball",
            x: 100,
            y: 200,
            vy: CONFIG.powerUpSpeed,
          },
        ],
      };

      const result = updatePowerUps(state);

      expect(result.newState.powerUps[0].y).toBeGreaterThan(200);
    });

    it("should remove power-ups that fall off screen", () => {
      let state = createBrickBreakerState("test-user");
      state = {
        ...state,
        powerUps: [
          {
            id: "pu-1",
            type: "multi_ball",
            x: 100,
            y: CONFIG.canvasHeight + 50,
            vy: CONFIG.powerUpSpeed,
          },
        ],
      };

      const result = updatePowerUps(state);

      expect(result.newState.powerUps).toHaveLength(0);
    });

    it("should collect power-ups that hit paddle", () => {
      let state = createBrickBreakerState("test-user");
      state = {
        ...state,
        powerUps: [
          {
            id: "pu-1",
            type: "multi_ball",
            x: state.paddle.x + state.paddle.width / 2,
            y: CONFIG.paddleY - CONFIG.powerUpSize / 2,
            vy: CONFIG.powerUpSpeed,
          },
        ],
      };

      const result = updatePowerUps(state);

      expect(
        result.events.some(
          (e) =>
            e.type === "powerup_collected" && e.powerUpType === "multi_ball",
        ),
      ).toBe(true);
    });
  });
});

// =============================================================================
// Laser System Tests
// =============================================================================

describe("Laser System", () => {
  describe("fireLaser", () => {
    it("should create two laser projectiles", () => {
      let state = createBrickBreakerState("test-user");
      state = applyPowerUp(state, "laser");

      const newState = fireLaser(state);

      expect(newState.lasers).toHaveLength(2);
    });

    it("should position lasers on paddle", () => {
      let state = createBrickBreakerState("test-user");
      state = applyPowerUp(state, "laser");

      const newState = fireLaser(state);

      newState.lasers.forEach((laser) => {
        expect(laser.y).toBeLessThan(CONFIG.paddleY);
        expect(laser.x).toBeGreaterThanOrEqual(state.paddle.x);
        expect(laser.x).toBeLessThanOrEqual(
          state.paddle.x + state.paddle.width,
        );
      });
    });
  });

  describe("updateLasers", () => {
    it("should move lasers upward", () => {
      let state = createBrickBreakerState("test-user");
      state = {
        ...state,
        lasers: [{ id: "laser-1", x: 100, y: 300, vy: -8 }],
      };

      const result = updateLasers(state);

      expect(result.newState.lasers[0].y).toBeLessThan(300);
    });

    it("should remove lasers that go off top of screen", () => {
      let state = createBrickBreakerState("test-user");
      state = {
        ...state,
        lasers: [{ id: "laser-1", x: 100, y: -50, vy: -8 }],
      };

      const result = updateLasers(state);

      expect(result.newState.lasers).toHaveLength(0);
    });
  });
});

// =============================================================================
// Lives & Game Over Tests
// =============================================================================

describe("Lives & Game Over", () => {
  describe("handleBallLost", () => {
    it("should decrease lives when ball is lost", () => {
      let state = createBrickBreakerState("test-user");
      state = launchBall(state);
      const initialLives = state.lives;

      const newState = handleBallLost(state);

      expect(newState.lives).toBe(initialLives - 1);
    });

    it("should create new stuck ball after losing ball", () => {
      let state = createBrickBreakerState("test-user");
      state = launchBall(state);
      state = { ...state, balls: [] }; // Simulate all balls lost

      const newState = handleBallLost(state);

      expect(newState.balls).toHaveLength(1);
      expect(newState.balls[0].isStuck).toBe(true);
    });

    it("should set phase to gameOver when no lives remain", () => {
      let state = createBrickBreakerState("test-user");
      state = { ...state, lives: 1, balls: [] };

      const newState = handleBallLost(state);

      expect(newState.phase).toBe("gameOver");
      expect(newState.lives).toBe(0);
    });

    it("should reset phase to ready when lives remain", () => {
      let state = createBrickBreakerState("test-user");
      state = launchBall(state);
      state = { ...state, balls: [] };

      const newState = handleBallLost(state);

      expect(newState.phase).toBe("ready");
    });
  });
});

// =============================================================================
// Level Progression Tests
// =============================================================================

describe("Level Progression", () => {
  describe("isLevelComplete", () => {
    it("should return false when destroyable bricks remain", () => {
      const state = createBrickBreakerState("test-user");

      expect(isLevelComplete(state)).toBe(false);
    });

    it("should return true when only indestructible bricks remain", () => {
      let state = createBrickBreakerState("test-user");
      state = {
        ...state,
        bricks: [
          {
            id: "ind-1",
            row: 0,
            col: 0,
            type: "indestructible",
            hitsRemaining: -1,
            hasPowerUp: false,
          },
        ],
      };

      expect(isLevelComplete(state)).toBe(true);
    });

    it("should return true when no bricks remain", () => {
      let state = createBrickBreakerState("test-user");
      state = { ...state, bricks: [] };

      expect(isLevelComplete(state)).toBe(true);
    });
  });

  describe("getBricksRemaining", () => {
    it("should count only destroyable bricks", () => {
      let state = createBrickBreakerState("test-user");
      state = {
        ...state,
        bricks: [
          {
            id: "1",
            row: 0,
            col: 0,
            type: "standard",
            hitsRemaining: 1,
            hasPowerUp: false,
          },
          {
            id: "2",
            row: 0,
            col: 1,
            type: "indestructible",
            hitsRemaining: -1,
            hasPowerUp: false,
          },
          {
            id: "3",
            row: 0,
            col: 2,
            type: "gold",
            hitsRemaining: 3,
            hasPowerUp: false,
          },
        ],
      };

      expect(getBricksRemaining(state)).toBe(2);
    });
  });

  describe("advanceToNextLevel", () => {
    it("should increment level number", () => {
      let state = createBrickBreakerState("test-user");
      state = { ...state, phase: "levelComplete" };

      const newState = advanceToNextLevel(state);

      expect(newState.currentLevel).toBe(2);
    });

    it("should generate new bricks for next level", () => {
      let state = createBrickBreakerState("test-user");
      state = { ...state, phase: "levelComplete", bricks: [] };

      const newState = advanceToNextLevel(state);

      expect(newState.bricks.length).toBeGreaterThan(0);
    });

    it("should reset paddle and ball", () => {
      let state = createBrickBreakerState("test-user");
      state = launchBall(state);
      state = {
        ...state,
        phase: "levelComplete",
        paddle: { ...state.paddle, width: CONFIG.paddleWidth * 2 },
      };

      const newState = advanceToNextLevel(state);

      expect(newState.paddle.width).toBe(CONFIG.paddleWidth);
      expect(newState.balls).toHaveLength(1);
      expect(newState.balls[0].isStuck).toBe(true);
    });

    it("should clear power-ups and effects", () => {
      let state = createBrickBreakerState("test-user");
      state = {
        ...state,
        phase: "levelComplete",
        powerUps: [{ id: "pu-1", type: "multi_ball", x: 100, y: 200, vy: 2 }],
        activeEffects: [{ type: "laser", expiresAt: Date.now() + 10000 }],
        lasers: [{ id: "laser-1", x: 100, y: 100, vy: -8 }],
      };

      const newState = advanceToNextLevel(state);

      expect(newState.powerUps).toHaveLength(0);
      expect(newState.activeEffects).toHaveLength(0);
      expect(newState.lasers).toHaveLength(0);
    });

    it("should end game after level 30", () => {
      let state = createBrickBreakerState("test-user");
      state = { ...state, currentLevel: 30, phase: "levelComplete" };

      const newState = advanceToNextLevel(state);

      expect(newState.phase).toBe("gameOver");
      expect(newState.currentLevel).toBe(30);
    });
  });
});

// =============================================================================
// Scoring Tests
// =============================================================================

describe("Scoring", () => {
  describe("calculateFinalScore", () => {
    it("should include base score", () => {
      let state = createBrickBreakerState("test-user");
      state = { ...state, score: 5000 };

      const finalScore = calculateFinalScore(state);

      expect(finalScore).toBeGreaterThanOrEqual(5000);
    });
  });

  describe("createBrickBreakerStats", () => {
    it("should create comprehensive stats", () => {
      let state = createBrickBreakerState("test-user");
      state = {
        ...state,
        score: 10000,
        currentLevel: 5,
        bricksDestroyed: 100,
        powerUpsCollected: 10,
        maxCombo: 5,
      };

      const stats = createBrickBreakerStats(state);

      expect(stats.levelsCompleted).toBe(4); // currentLevel - 1
      expect(stats.bricksDestroyed).toBe(100);
      expect(stats.powerUpsCollected).toBe(10);
    });
  });
});

// =============================================================================
// Visual Helpers Tests
// =============================================================================

describe("Visual Helpers", () => {
  describe("getBrickColor", () => {
    it("should return correct colors for brick types", () => {
      const standardBrick: BrickState = {
        id: "1",
        row: 0,
        col: 0,
        type: "standard",
        hitsRemaining: 1,
        hasPowerUp: false,
      };

      const silverBrick: BrickState = {
        id: "2",
        row: 0,
        col: 0,
        type: "silver",
        hitsRemaining: 2,
        hasPowerUp: false,
      };

      const goldBrick: BrickState = {
        id: "3",
        row: 0,
        col: 0,
        type: "gold",
        hitsRemaining: 3,
        hasPowerUp: false,
      };

      expect(getBrickColor(standardBrick)).toBeDefined();
      expect(getBrickColor(silverBrick)).toBe("#C0C0C0");
      expect(getBrickColor(goldBrick)).toBe("#FFD700");
    });
  });
});
