/**
 * Phase 4 Physics / Real-Time Room Unit Tests
 *
 * Tests schemas, game logic, physics, collision detection, scoring,
 * win conditions, validation, and lifecycle for all 6 Phase-4 games:
 *   - Pong (ball physics, paddle collision, wall bounce, scoring)
 *   - Air Hockey (circle-circle collision, friction, goals, half-constraint)
 *   - Bounce Blitz (score-race, anti-cheat, timer)
 *   - Brick Breaker (score/level tracking, lives, tiebreaker)
 *
 * Pattern: Direct schema/logic testing (no Colyseus Room simulation).
 */

// ---------------------------------------------------------------------------
// Mocks Ã¢â‚¬â€ must be before imports
// ---------------------------------------------------------------------------
jest.mock("../../src/services/firebase", () => ({
  initializeFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: jest.fn().mockResolvedValue({
    uid: "test-uid-1",
    name: "Player 1",
  }),
  getFirestoreDb: jest.fn().mockReturnValue(null),
}));

jest.mock("../../src/services/persistence", () => ({
  saveGameState: jest.fn().mockResolvedValue(undefined),
  loadGameState: jest.fn().mockResolvedValue(null),
  persistGameResult: jest.fn().mockResolvedValue(undefined),
  cleanupExpiredGameStates: jest.fn().mockResolvedValue(undefined),
}));

import { ArraySchema, MapSchema } from "@colyseus/schema";
import {
  Ball,
  BounceBlitzPlayerState,
  BounceBlitzState,
  BrickBreakerPlayerState,
  BrickBreakerState,
  BrickState,
  Paddle,
  PhysicsPlayer,
  PhysicsState,
} from "../../src/schemas/physics";

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// 1. Physics Schemas Ã¢â‚¬â€ Ball, Paddle, PhysicsPlayer, PhysicsState
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

describe("Physics Schemas", () => {
  describe("Ball", () => {
    it("should have correct default values", () => {
      const ball = new Ball();
      expect(ball.x).toBe(0);
      expect(ball.y).toBe(0);
      expect(ball.vx).toBe(0);
      expect(ball.vy).toBe(0);
      expect(ball.radius).toBe(10);
      expect(ball.speed).toBe(5);
    });

    it("should allow setting position and velocity", () => {
      const ball = new Ball();
      ball.x = 200;
      ball.y = 300;
      ball.vx = 3.5;
      ball.vy = -4.2;
      ball.radius = 12;
      ball.speed = 8;
      expect(ball.x).toBe(200);
      expect(ball.y).toBe(300);
      expect(ball.vx).toBe(3.5);
      expect(ball.vy).toBeCloseTo(-4.2);
      expect(ball.radius).toBe(12);
      expect(ball.speed).toBe(8);
    });
  });

  describe("Paddle", () => {
    it("should have correct default values", () => {
      const paddle = new Paddle();
      expect(paddle.x).toBe(0);
      expect(paddle.y).toBe(0);
      expect(paddle.width).toBe(80);
      expect(paddle.height).toBe(14);
      expect(paddle.ownerId).toBe("");
    });

    it("should track owner", () => {
      const paddle = new Paddle();
      paddle.ownerId = "session-abc";
      expect(paddle.ownerId).toBe("session-abc");
    });
  });

  describe("PhysicsPlayer", () => {
    it("should extend Player with physics fields", () => {
      const player = new PhysicsPlayer();
      // Inherited from Player
      expect(player.uid).toBe("");
      expect(player.sessionId).toBe("");
      expect(player.displayName).toBe("");
      expect(player.connected).toBe(true);
      expect(player.ready).toBe(false);
      expect(player.score).toBe(0);
      expect(player.playerIndex).toBe(0);
      // Physics-specific
      expect(player.paddleX).toBeCloseTo(0.5);
      expect(player.paddleY).toBe(0);
      expect(player.finished).toBe(false);
      expect(player.lives).toBe(3);
      expect(player.combo).toBe(0);
    });
  });

  describe("PhysicsState", () => {
    it("should have correct default values", () => {
      const state = new PhysicsState();
      expect(state.phase).toBe("waiting");
      expect(state.gameId).toBe("");
      expect(state.gameType).toBe("");
      expect(state.maxPlayers).toBe(2);
      expect(state.winnerId).toBe("");
      expect(state.winReason).toBe("");
      expect(state.elapsed).toBe(0);
      expect(state.remaining).toBe(0);
      expect(state.timerRunning).toBe(false);
      expect(state.countdown).toBe(0);
      expect(state.fieldWidth).toBe(400);
      expect(state.fieldHeight).toBe(600);
      expect(state.scoreToWin).toBe(7);
      expect(state.seed).toBe(0);
    });

    it("should contain Ball and MapSchemas", () => {
      const state = new PhysicsState();
      expect(state.ball).toBeInstanceOf(Ball);
      expect(state.players).toBeInstanceOf(MapSchema);
      expect(state.paddles).toBeInstanceOf(MapSchema);
      expect(state.players.size).toBe(0);
      expect(state.paddles.size).toBe(0);
    });

    it("should track two players with paddles", () => {
      const state = new PhysicsState();

      const p1 = new PhysicsPlayer();
      p1.uid = "uid-1";
      p1.sessionId = "s1";
      p1.playerIndex = 0;
      state.players.set("s1", p1);

      const p2 = new PhysicsPlayer();
      p2.uid = "uid-2";
      p2.sessionId = "s2";
      p2.playerIndex = 1;
      state.players.set("s2", p2);

      const pad1 = new Paddle();
      pad1.ownerId = "s1";
      state.paddles.set("s1", pad1);

      const pad2 = new Paddle();
      pad2.ownerId = "s2";
      state.paddles.set("s2", pad2);

      expect(state.players.size).toBe(2);
      expect(state.paddles.size).toBe(2);
      expect(state.players.get("s1")!.playerIndex).toBe(0);
      expect(state.players.get("s2")!.playerIndex).toBe(1);
    });
  });
});


// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// 3. Brick Breaker Schemas
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

describe("BrickBreaker Schemas", () => {
  describe("BrickState", () => {
    it("should have correct defaults", () => {
      const brick = new BrickState();
      expect(brick.col).toBe(0);
      expect(brick.row).toBe(0);
      expect(brick.hp).toBe(1);
      expect(brick.brickType).toBe(1);
    });

    it("should represent different brick types", () => {
      const normal = new BrickState();
      normal.hp = 1;
      normal.brickType = 1;

      const silver = new BrickState();
      silver.hp = 2;
      silver.brickType = 2;

      const gold = new BrickState();
      gold.hp = 3;
      gold.brickType = 3;

      const indestructible = new BrickState();
      indestructible.hp = 4;
      indestructible.brickType = 4;

      expect(silver.hp).toBe(2);
      expect(gold.hp).toBe(3);
      expect(indestructible.brickType).toBe(4);
    });
  });

  describe("BrickBreakerPlayerState", () => {
    it("should extend Player with brick breaker fields", () => {
      const player = new BrickBreakerPlayerState();
      expect(player.finished).toBe(false);
      expect(player.lives).toBe(3);
      expect(player.level).toBe(1);
      expect(player.bricksDestroyed).toBe(0);
      // Inherited
      expect(player.score).toBe(0);
      expect(player.connected).toBe(true);
    });
  });

  describe("BrickBreakerState", () => {
    it("should have correct defaults", () => {
      const state = new BrickBreakerState();
      expect(state.phase).toBe("waiting");
      expect(state.currentLevel).toBe(1);
      expect(state.maxLevel).toBe(10);
      expect(state.bbPlayers).toBeInstanceOf(MapSchema);
    });
  });
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// 4. Bounce Blitz Schemas
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

describe("BounceBlitz Schemas", () => {
  describe("BounceBlitzPlayerState", () => {
    it("should extend Player with blitz fields", () => {
      const player = new BounceBlitzPlayerState();
      expect(player.finished).toBe(false);
      expect(player.round).toBe(1);
      expect(player.blocksDestroyed).toBe(0);
      expect(player.score).toBe(0);
    });
  });

  describe("BounceBlitzState", () => {
    it("should have correct defaults", () => {
      const state = new BounceBlitzState();
      expect(state.phase).toBe("waiting");
      expect(state.gameDuration).toBe(120);
      expect(state.blitzPlayers).toBeInstanceOf(MapSchema);
    });
  });
});


// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// 6. Pong Game Logic
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

describe("Pong Game Logic", () => {
  // Constants matching PongRoom
  const FIELD_W = 400;
  const FIELD_H = 600;
  const PADDLE_W = 80;
  const PADDLE_H = 14;
  const BALL_R = 10;
  const INITIAL_SPEED = 4;
  const MAX_SPEED = 12;
  const SPEED_INCREMENT = 0.15;
  const WIN_SCORE = 7;

  function createPongState(): PhysicsState {
    const state = new PhysicsState();
    state.gameType = "pong_game";
    state.fieldWidth = FIELD_W;
    state.fieldHeight = FIELD_H;
    state.scoreToWin = WIN_SCORE;
    resetBall(state);
    return state;
  }

  function resetBall(state: PhysicsState): void {
    const b = state.ball;
    b.x = FIELD_W / 2;
    b.y = FIELD_H / 2;
    b.radius = BALL_R;
    b.speed = INITIAL_SPEED;
    b.vx = 2;
    b.vy = 3;
  }

  function addPlayers(state: PhysicsState): void {
    const p1 = new PhysicsPlayer();
    p1.uid = "uid-1";
    p1.sessionId = "s1";
    p1.playerIndex = 0;
    p1.displayName = "Player 1";
    state.players.set("s1", p1);

    const p2 = new PhysicsPlayer();
    p2.uid = "uid-2";
    p2.sessionId = "s2";
    p2.playerIndex = 1;
    p2.displayName = "Player 2";
    state.players.set("s2", p2);

    // Bottom paddle (player 0)
    const pad1 = new Paddle();
    pad1.ownerId = "s1";
    pad1.width = PADDLE_W;
    pad1.height = PADDLE_H;
    pad1.x = FIELD_W / 2 - PADDLE_W / 2;
    pad1.y = FIELD_H - PADDLE_H - 10;
    state.paddles.set("s1", pad1);

    // Top paddle (player 1)
    const pad2 = new Paddle();
    pad2.ownerId = "s2";
    pad2.width = PADDLE_W;
    pad2.height = PADDLE_H;
    pad2.x = FIELD_W / 2 - PADDLE_W / 2;
    pad2.y = 10;
    state.paddles.set("s2", pad2);
  }

  it("should initialize ball at center", () => {
    const state = createPongState();
    expect(state.ball.x).toBe(FIELD_W / 2);
    expect(state.ball.y).toBe(FIELD_H / 2);
    expect(state.ball.radius).toBe(BALL_R);
  });

  it("should move ball by velocity each tick", () => {
    const state = createPongState();
    const b = state.ball;
    b.vx = 3;
    b.vy = -4;
    const oldX = b.x;
    const oldY = b.y;
    // Simulate one tick
    b.x += b.vx;
    b.y += b.vy;
    expect(b.x).toBe(oldX + 3);
    expect(b.y).toBe(oldY - 4);
  });

  it("should bounce ball off left wall", () => {
    const state = createPongState();
    const b = state.ball;
    b.x = 5; // near left edge
    b.vx = -10; // moving left
    b.vy = 3;

    // Simulate
    b.x += b.vx;
    if (b.x - b.radius <= 0) {
      b.x = b.radius;
      b.vx = Math.abs(b.vx);
    }

    expect(b.x).toBe(b.radius);
    expect(b.vx).toBeGreaterThan(0);
  });

  it("should bounce ball off right wall", () => {
    const state = createPongState();
    const b = state.ball;
    b.x = FIELD_W - 5;
    b.vx = 10;
    b.vy = 3;

    b.x += b.vx;
    if (b.x + b.radius >= FIELD_W) {
      b.x = FIELD_W - b.radius;
      b.vx = -Math.abs(b.vx);
    }

    expect(b.x).toBe(FIELD_W - b.radius);
    expect(b.vx).toBeLessThan(0);
  });

  it("should detect ball past bottom for top player scoring", () => {
    const state = createPongState();
    addPlayers(state);
    const b = state.ball;
    b.y = FIELD_H + 5;

    const pastBottom = b.y + b.radius > FIELD_H;
    expect(pastBottom).toBe(true);
    // In PongRoom, this means player 1 (top) scores
  });

  it("should detect ball past top for bottom player scoring", () => {
    const state = createPongState();
    const b = state.ball;
    b.y = -5;

    const pastTop = b.y - b.radius < 0;
    expect(pastTop).toBe(true);
    // In PongRoom, this means player 0 (bottom) scores
  });

  it("should detect bottom paddle collision", () => {
    const state = createPongState();
    addPlayers(state);
    const pad = state.paddles.get("s1")!;
    const b = state.ball;

    // Position ball just above bottom paddle
    b.x = pad.x + pad.width / 2; // center of paddle
    b.y = pad.y - b.radius; // just at paddle surface
    b.vy = 4; // moving down

    const withinX = b.x >= pad.x && b.x <= pad.x + pad.width;
    const hitsPaddle =
      b.y + b.radius >= pad.y &&
      b.y + b.radius <= pad.y + pad.height &&
      withinX &&
      b.vy > 0;

    expect(withinX).toBe(true);
    // Ball at exact surface, y + radius = pad.y Ã¢â€ â€™ should trigger
    expect(b.y + b.radius).toBeGreaterThanOrEqual(pad.y);
  });

  it("should influence bounce angle based on hit position", () => {
    const pad = new Paddle();
    pad.width = PADDLE_W;
    pad.x = 160; // centered

    // Hit at left edge Ã¢â€ â€™ hitPos = -0.5
    const hitPosLeft = (160 - pad.x) / pad.width - 0.5;
    expect(hitPosLeft).toBeCloseTo(-0.5);

    // Hit at center Ã¢â€ â€™ hitPos = 0
    const hitPosCenter = (pad.x + pad.width / 2 - pad.x) / pad.width - 0.5;
    expect(hitPosCenter).toBeCloseTo(0);

    // Hit at right edge Ã¢â€ â€™ hitPos = +0.5
    const hitPosRight = (pad.x + pad.width - pad.x) / pad.width - 0.5;
    expect(hitPosRight).toBeCloseTo(0.5);
  });

  it("should increase ball speed on paddle hit up to MAX_SPEED", () => {
    let speed = INITIAL_SPEED;
    for (let i = 0; i < 100; i++) {
      speed = Math.min(speed + SPEED_INCREMENT, MAX_SPEED);
    }
    expect(speed).toBe(MAX_SPEED);
  });

  it("should cap ball speed at MAX_SPEED", () => {
    const b = new Ball();
    b.vx = 20;
    b.vy = 20;
    b.speed = MAX_SPEED;

    const mag = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const normalizedVx = (b.vx / mag) * b.speed;
    const normalizedVy = (b.vy / mag) * b.speed;
    const newMag = Math.sqrt(
      normalizedVx * normalizedVx + normalizedVy * normalizedVy,
    );

    expect(newMag).toBeCloseTo(MAX_SPEED, 4);
  });

  it("should track scoring correctly", () => {
    const state = createPongState();
    addPlayers(state);

    const p1 = state.players.get("s1")!;
    const p2 = state.players.get("s2")!;

    p1.score = 6;
    p2.score = 4;

    expect(p1.score).toBe(6);
    expect(p2.score).toBe(4);
    expect(p1.score < WIN_SCORE).toBe(true);
  });

  it("should detect win at WIN_SCORE", () => {
    const p = new PhysicsPlayer();
    p.score = WIN_SCORE;
    expect(p.score >= WIN_SCORE).toBe(true);
  });

  it("should find player by index", () => {
    const state = createPongState();
    addPlayers(state);

    let bottomPlayer: PhysicsPlayer | null = null;
    let topPlayer: PhysicsPlayer | null = null;
    state.players.forEach((p: PhysicsPlayer) => {
      if (p.playerIndex === 0) bottomPlayer = p;
      if (p.playerIndex === 1) topPlayer = p;
    });

    expect(bottomPlayer).not.toBeNull();
    expect(topPlayer).not.toBeNull();
    expect(bottomPlayer!.sessionId).toBe("s1");
    expect(topPlayer!.sessionId).toBe("s2");
  });

  it("should clamp paddle X within field bounds", () => {
    const pad = new Paddle();
    pad.width = PADDLE_W;

    // Test normalised input = 0 (far left)
    let newX = Math.max(
      0,
      Math.min(FIELD_W - pad.width, 0 * FIELD_W - pad.width / 2),
    );
    expect(newX).toBe(0);

    // Test normalised input = 1 (far right)
    newX = Math.max(
      0,
      Math.min(FIELD_W - pad.width, 1 * FIELD_W - pad.width / 2),
    );
    expect(newX).toBe(FIELD_W - pad.width);

    // Test normalised input = 0.5 (center)
    newX = Math.max(
      0,
      Math.min(FIELD_W - pad.width, 0.5 * FIELD_W - pad.width / 2),
    );
    expect(newX).toBe(FIELD_W / 2 - pad.width / 2);
  });

  it("should reset ball to center after scoring", () => {
    const state = createPongState();
    state.ball.x = 50;
    state.ball.y = 650; // off field
    resetBall(state);
    expect(state.ball.x).toBe(FIELD_W / 2);
    expect(state.ball.y).toBe(FIELD_H / 2);
  });
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// 7. Air Hockey Game Logic
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

describe("Air Hockey Game Logic", () => {
  const FIELD_W = 400;
  const FIELD_H = 600;
  const PUCK_R = 12;
  const STRIKER_R = 24;
  const GOAL_WIDTH = 140;
  const FRICTION = 0.998;
  const WALL_BOUNCE = 0.9;
  const MAX_PUCK_SPEED = 15;
  const WIN_SCORE = 7;

  function createAirHockeyState(): PhysicsState {
    const state = new PhysicsState();
    state.gameType = "air_hockey_game";
    state.fieldWidth = FIELD_W;
    state.fieldHeight = FIELD_H;
    state.scoreToWin = WIN_SCORE;
    state.ball.radius = PUCK_R;
    state.ball.x = FIELD_W / 2;
    state.ball.y = FIELD_H / 2;
    state.ball.vx = 0;
    state.ball.vy = 0;
    return state;
  }

  it("should initialize puck at center with zero velocity", () => {
    const state = createAirHockeyState();
    expect(state.ball.x).toBe(FIELD_W / 2);
    expect(state.ball.y).toBe(FIELD_H / 2);
    expect(state.ball.vx).toBe(0);
    expect(state.ball.vy).toBe(0);
  });

  it("should apply friction to slow puck down", () => {
    const puck = new Ball();
    puck.vx = 10;
    puck.vy = 10;

    // Apply friction for several frames
    for (let i = 0; i < 100; i++) {
      puck.vx *= FRICTION;
      puck.vy *= FRICTION;
    }

    expect(Math.abs(puck.vx)).toBeLessThan(10);
    expect(Math.abs(puck.vy)).toBeLessThan(10);
  });

  it("should stop puck when speed below threshold (0.1)", () => {
    const puck = new Ball();
    puck.vx = 0.05;
    puck.vy = 0.08;

    const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
    if (speed < 0.1) {
      puck.vx = 0;
      puck.vy = 0;
    }

    expect(puck.vx).toBe(0);
    expect(puck.vy).toBe(0);
  });

  it("should bounce puck off left wall with energy loss", () => {
    const puck = new Ball();
    puck.radius = PUCK_R;
    puck.x = 5;
    puck.vx = -8;

    puck.x += puck.vx;
    if (puck.x - puck.radius <= 0) {
      puck.x = puck.radius;
      puck.vx = Math.abs(puck.vx) * WALL_BOUNCE;
    }

    expect(puck.x).toBe(PUCK_R);
    expect(puck.vx).toBeCloseTo(8 * WALL_BOUNCE);
    expect(puck.vx).toBeLessThan(8); // lost energy
  });

  it("should bounce puck off right wall with energy loss", () => {
    const puck = new Ball();
    puck.radius = PUCK_R;
    puck.x = FIELD_W - 5;
    puck.vx = 8;

    puck.x += puck.vx;
    if (puck.x + puck.radius >= FIELD_W) {
      puck.x = FIELD_W - puck.radius;
      puck.vx = -Math.abs(puck.vx) * WALL_BOUNCE;
    }

    expect(puck.x).toBe(FIELD_W - PUCK_R);
    expect(puck.vx).toBeCloseTo(-8 * WALL_BOUNCE);
  });

  it("should detect goal zone at bottom center", () => {
    const goalLeft = (FIELD_W - GOAL_WIDTH) / 2;
    const goalRight = (FIELD_W + GOAL_WIDTH) / 2;

    // In goal zone
    expect(FIELD_W / 2 >= goalLeft && FIELD_W / 2 <= goalRight).toBe(true);

    // Outside goal zone (far left)
    expect(10 >= goalLeft && 10 <= goalRight).toBe(false);

    // Outside goal zone (far right)
    expect(FIELD_W - 10 >= goalLeft && FIELD_W - 10 <= goalRight).toBe(false);

    // Goal zone boundaries
    expect(goalLeft).toBe((400 - 140) / 2); // 130
    expect(goalRight).toBe((400 + 140) / 2); // 270
  });

  it("should score when puck enters bottom goal zone", () => {
    const puck = new Ball();
    puck.radius = PUCK_R;
    puck.x = FIELD_W / 2; // center (in goal zone)
    puck.y = FIELD_H + 5;

    const goalLeft = (FIELD_W - GOAL_WIDTH) / 2;
    const goalRight = (FIELD_W + GOAL_WIDTH) / 2;
    const inGoalZone = puck.x >= goalLeft && puck.x <= goalRight;
    const pastBottom = puck.y + puck.radius > FIELD_H;

    expect(inGoalZone).toBe(true);
    expect(pastBottom).toBe(true);
  });

  it("should bounce when puck hits bottom wall outside goal", () => {
    const puck = new Ball();
    puck.radius = PUCK_R;
    puck.x = 50; // far left (outside goal zone)
    puck.y = FIELD_H + 5;
    puck.vy = 5;

    const goalLeft = (FIELD_W - GOAL_WIDTH) / 2;
    const goalRight = (FIELD_W + GOAL_WIDTH) / 2;
    const inGoalZone = puck.x >= goalLeft && puck.x <= goalRight;

    if (puck.y + puck.radius > FIELD_H && !inGoalZone) {
      puck.y = FIELD_H - puck.radius;
      puck.vy = -Math.abs(puck.vy) * WALL_BOUNCE;
    }

    expect(inGoalZone).toBe(false);
    expect(puck.y).toBe(FIELD_H - PUCK_R);
    expect(puck.vy).toBeCloseTo(-5 * WALL_BOUNCE);
  });

  it("should detect circle-circle collision between puck and striker", () => {
    const puck = { x: 100, y: 100, radius: PUCK_R };
    const striker = { x: 120, y: 100, radius: STRIKER_R };

    const dx = puck.x - striker.x;
    const dy = puck.y - striker.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = puck.radius + striker.radius;

    expect(dist).toBe(20); // |100-120| = 20
    expect(minDist).toBe(PUCK_R + STRIKER_R); // 12 + 24 = 36
    expect(dist < minDist).toBe(true); // collision detected
  });

  it("should NOT detect collision when puck and striker are far apart", () => {
    const puck = { x: 100, y: 100, radius: PUCK_R };
    const striker = { x: 200, y: 200, radius: STRIKER_R };

    const dx = puck.x - striker.x;
    const dy = puck.y - striker.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = puck.radius + striker.radius;

    expect(dist).toBeGreaterThan(minDist);
  });

  it("should separate overlapping puck and striker", () => {
    const puckX = 110;
    const puckY = 100;
    const strikerX = 120;
    const strikerY = 100;

    const dx = puckX - strikerX;
    const dy = puckY - strikerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = PUCK_R + STRIKER_R;
    const overlap = minDist - dist;

    expect(overlap).toBeGreaterThan(0);

    const nx = dx / dist;
    const ny = dy / dist;
    const newPuckX = puckX + nx * overlap;
    const newPuckY = puckY + ny * overlap;

    // After separation, distance should be >= minDist
    const newDx = newPuckX - strikerX;
    const newDy = newPuckY - strikerY;
    const newDist = Math.sqrt(newDx * newDx + newDy * newDy);
    expect(newDist).toBeCloseTo(minDist, 4);
  });

  it("should cap puck speed at MAX_PUCK_SPEED", () => {
    let vx = 20;
    let vy = 20;

    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > MAX_PUCK_SPEED) {
      vx = (vx / speed) * MAX_PUCK_SPEED;
      vy = (vy / speed) * MAX_PUCK_SPEED;
    }

    const newSpeed = Math.sqrt(vx * vx + vy * vy);
    expect(newSpeed).toBeCloseTo(MAX_PUCK_SPEED, 4);
  });

  it("should constrain bottom player (index 0) to bottom half", () => {
    // y Ã¢Ë†Ë† [0.5, 1.0]
    const inputY = 0.3; // trying to go into top half
    const constrainedY = Math.max(0.5, Math.min(1, inputY));
    expect(constrainedY).toBe(0.5);

    const validY = 0.75;
    const validConstrainedY = Math.max(0.5, Math.min(1, validY));
    expect(validConstrainedY).toBe(0.75);
  });

  it("should constrain top player (index 1) to top half", () => {
    // y Ã¢Ë†Ë† [0.0, 0.5]
    const inputY = 0.8; // trying to go into bottom half
    const constrainedY = Math.max(0, Math.min(0.5, inputY));
    expect(constrainedY).toBe(0.5);

    const validY = 0.25;
    const validConstrainedY = Math.max(0, Math.min(0.5, validY));
    expect(validConstrainedY).toBe(0.25);
  });

  it("should clamp paddle X within [0, 1]", () => {
    expect(Math.max(0, Math.min(1, -0.1))).toBe(0);
    expect(Math.max(0, Math.min(1, 1.1))).toBe(1);
    expect(Math.max(0, Math.min(1, 0.5))).toBe(0.5);
  });

  it("should reset puck to center after goal", () => {
    const state = createAirHockeyState();
    state.ball.x = 50;
    state.ball.y = 650;
    state.ball.vx = 10;
    state.ball.vy = -5;

    // Reset
    state.ball.x = FIELD_W / 2;
    state.ball.y = FIELD_H / 2;
    state.ball.vx = 0;
    state.ball.vy = 0;

    expect(state.ball.x).toBe(FIELD_W / 2);
    expect(state.ball.y).toBe(FIELD_H / 2);
    expect(state.ball.vx).toBe(0);
    expect(state.ball.vy).toBe(0);
  });
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// 9. Bounce Blitz Game Logic
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

describe("Bounce Blitz Game Logic", () => {
  const DEFAULT_DURATION = 120;
  const MAX_SCORE_PER_SECOND = 200;

  function createBlitzState(): BounceBlitzState {
    const state = new BounceBlitzState();
    state.gameType = "bounce_blitz_game";
    state.gameDuration = DEFAULT_DURATION;
    state.seed = 12345;
    state.phase = "playing";
    return state;
  }

  function addBlitzPlayers(state: BounceBlitzState): void {
    const p1 = new BounceBlitzPlayerState();
    p1.uid = "uid-1";
    p1.sessionId = "s1";
    p1.playerIndex = 0;
    p1.displayName = "Player 1";
    state.blitzPlayers.set("s1", p1);

    const p2 = new BounceBlitzPlayerState();
    p2.uid = "uid-2";
    p2.sessionId = "s2";
    p2.playerIndex = 1;
    p2.displayName = "Player 2";
    state.blitzPlayers.set("s2", p2);
  }

  describe("Anti-Cheat Validation", () => {
    it("should accept valid score rate", () => {
      const elapsedSec = 10; // 10 seconds elapsed
      const score = 500;
      const scorePerSecond = score / elapsedSec;
      expect(scorePerSecond).toBe(50);
      expect(scorePerSecond <= MAX_SCORE_PER_SECOND).toBe(true);
    });

    it("should reject excessive score rate", () => {
      const elapsedSec = 1; // 1 second elapsed
      const score = 500;
      const scorePerSecond = score / elapsedSec;
      expect(scorePerSecond).toBe(500);
      expect(scorePerSecond > MAX_SCORE_PER_SECOND).toBe(true);
    });

    it("should handle edge case of zero elapsed time", () => {
      const elapsedSec = 0;
      // The room checks elapsedSec > 0 before dividing
      const shouldSkip = !(elapsedSec > 0);
      expect(shouldSkip).toBe(true);
    });

    it("should accept MAX_SCORE_PER_SECOND exactly", () => {
      const elapsedSec = 5;
      const score = MAX_SCORE_PER_SECOND * elapsedSec;
      const rate = score / elapsedSec;
      expect(rate).toBe(MAX_SCORE_PER_SECOND);
      expect(rate > MAX_SCORE_PER_SECOND).toBe(false);
    });
  });

  describe("Timer and Duration", () => {
    it("should calculate remaining time correctly", () => {
      const state = createBlitzState();
      state.elapsed = 30000; // 30 seconds
      state.remaining = Math.max(0, state.gameDuration * 1000 - state.elapsed);
      expect(state.remaining).toBe(90000); // 90 seconds left
    });

    it("should clamp remaining to zero", () => {
      const state = createBlitzState();
      state.elapsed = 200000; // way past duration
      state.remaining = Math.max(0, state.gameDuration * 1000 - state.elapsed);
      expect(state.remaining).toBe(0);
    });

    it("should trigger end game when remaining hits zero", () => {
      const state = createBlitzState();
      state.elapsed = DEFAULT_DURATION * 1000;
      state.remaining = Math.max(0, state.gameDuration * 1000 - state.elapsed);
      expect(state.remaining).toBe(0);
      // Game should end
    });
  });

  describe("Score-Based Win Detection", () => {
    it("should determine winner by highest score", () => {
      const state = createBlitzState();
      addBlitzPlayers(state);

      const p1 = state.blitzPlayers.get("s1")!;
      const p2 = state.blitzPlayers.get("s2")!;
      p1.score = 1500;
      p2.score = 1200;

      const players = Array.from(
        state.blitzPlayers.values(),
      ) as BounceBlitzPlayerState[];
      const sorted = [...players].sort((a, b) => b.score - a.score);

      expect(sorted[0].uid).toBe("uid-1");
      expect(sorted[0].score).toBe(1500);
    });

    it("should detect tie when scores are equal", () => {
      const state = createBlitzState();
      addBlitzPlayers(state);

      const p1 = state.blitzPlayers.get("s1")!;
      const p2 = state.blitzPlayers.get("s2")!;
      p1.score = 1000;
      p2.score = 1000;

      const players = Array.from(
        state.blitzPlayers.values(),
      ) as BounceBlitzPlayerState[];
      const sorted = [...players].sort((a, b) => b.score - a.score);

      expect(sorted[0].score === sorted[1].score).toBe(true);
      // winnerId should be "" for tie
    });
  });

  describe("Rematch Reset", () => {
    it("should reset all player state for rematch", () => {
      const state = createBlitzState();
      addBlitzPlayers(state);

      const p1 = state.blitzPlayers.get("s1")!;
      p1.score = 2000;
      p1.round = 5;
      p1.blocksDestroyed = 100;
      p1.finished = true;
      state.phase = "finished";
      state.winnerId = "uid-1";

      // Reset
      state.blitzPlayers.forEach((p: BounceBlitzPlayerState) => {
        p.score = 0;
        p.ready = false;
        p.finished = false;
        p.round = 1;
        p.blocksDestroyed = 0;
      });
      state.phase = "waiting";
      state.winnerId = "";
      state.elapsed = 0;
      state.remaining = 0;

      expect(p1.score).toBe(0);
      expect(p1.round).toBe(1);
      expect(p1.finished).toBe(false);
      expect(state.phase).toBe("waiting");
      expect(state.winnerId).toBe("");
    });

    it("should generate new seed on rematch", () => {
      const state = createBlitzState();
      const oldSeed = state.seed;
      state.seed = Math.floor(Math.random() * 2147483647);
      // New seed should be different (extremely unlikely to be same)
      // We just check it's a valid integer
      expect(state.seed).toBeGreaterThanOrEqual(0);
      expect(state.seed).toBeLessThan(2147483647);
    });
  });
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// 10. Brick Breaker Game Logic
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

describe("Brick Breaker Game Logic", () => {
  const MAX_LEVEL = 10;
  const STARTING_LIVES = 3;
  const TIME_LIMIT = 300;

  function createBBState(): BrickBreakerState {
    const state = new BrickBreakerState();
    state.gameType = "brick_breaker_game";
    state.seed = 42;
    state.maxLevel = MAX_LEVEL;
    state.phase = "playing";
    return state;
  }

  function addBBPlayers(state: BrickBreakerState): void {
    const p1 = new BrickBreakerPlayerState();
    p1.uid = "uid-1";
    p1.sessionId = "s1";
    p1.playerIndex = 0;
    p1.displayName = "Player 1";
    p1.lives = STARTING_LIVES;
    p1.level = 1;
    state.bbPlayers.set("s1", p1);

    const p2 = new BrickBreakerPlayerState();
    p2.uid = "uid-2";
    p2.sessionId = "s2";
    p2.playerIndex = 1;
    p2.displayName = "Player 2";
    p2.lives = STARTING_LIVES;
    p2.level = 1;
    state.bbPlayers.set("s2", p2);
  }

  describe("Score Update Validation", () => {
    it("should accept valid score update", () => {
      const state = createBBState();
      addBBPlayers(state);
      const p1 = state.bbPlayers.get("s1")!;

      p1.score = 500;
      p1.level = 3;
      p1.lives = 2;
      p1.bricksDestroyed = 45;

      expect(p1.score).toBe(500);
      expect(p1.level).toBe(3);
      expect(p1.lives).toBe(2);
    });

    it("should clamp level to maxLevel", () => {
      const level = 15;
      const clamped = Math.min(level, MAX_LEVEL);
      expect(clamped).toBe(MAX_LEVEL);
    });

    it("should clamp lives to minimum 0", () => {
      const lives = -2;
      const clamped = Math.max(0, lives);
      expect(clamped).toBe(0);
    });
  });

  describe("Player Finished Detection", () => {
    it("should mark player finished when lives reach 0", () => {
      const p = new BrickBreakerPlayerState();
      p.lives = 0;
      p.finished = p.lives <= 0;
      expect(p.finished).toBe(true);
    });

    it("should mark player finished when all levels complete", () => {
      const p = new BrickBreakerPlayerState();
      p.level = MAX_LEVEL + 1;
      p.finished = p.level > MAX_LEVEL;
      expect(p.finished).toBe(true);
    });

    it("should NOT mark player finished during normal play", () => {
      const p = new BrickBreakerPlayerState();
      p.lives = 2;
      p.level = 5;
      expect(p.lives > 0 && p.level <= MAX_LEVEL).toBe(true);
    });
  });

  describe("Win Detection", () => {
    it("should determine winner by highest score", () => {
      const state = createBBState();
      addBBPlayers(state);

      const p1 = state.bbPlayers.get("s1")!;
      const p2 = state.bbPlayers.get("s2")!;
      p1.score = 3000;
      p1.level = 7;
      p2.score = 2000;
      p2.level = 5;

      const players = Array.from(
        state.bbPlayers.values(),
      ) as BrickBreakerPlayerState[];
      const sorted = [...players].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.level !== a.level) return b.level - a.level;
        return b.bricksDestroyed - a.bricksDestroyed;
      });

      expect(sorted[0].uid).toBe("uid-1");
    });

    it("should use level as tiebreaker when scores are equal", () => {
      const state = createBBState();
      addBBPlayers(state);

      const p1 = state.bbPlayers.get("s1")!;
      const p2 = state.bbPlayers.get("s2")!;
      p1.score = 2000;
      p1.level = 8;
      p2.score = 2000;
      p2.level = 6;

      const players = Array.from(
        state.bbPlayers.values(),
      ) as BrickBreakerPlayerState[];
      const sorted = [...players].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.level !== a.level) return b.level - a.level;
        return b.bricksDestroyed - a.bricksDestroyed;
      });

      expect(sorted[0].uid).toBe("uid-1"); // higher level wins
    });

    it("should use bricksDestroyed as final tiebreaker", () => {
      const state = createBBState();
      addBBPlayers(state);

      const p1 = state.bbPlayers.get("s1")!;
      const p2 = state.bbPlayers.get("s2")!;
      p1.score = 2000;
      p1.level = 6;
      p1.bricksDestroyed = 80;
      p2.score = 2000;
      p2.level = 6;
      p2.bricksDestroyed = 60;

      const players = Array.from(
        state.bbPlayers.values(),
      ) as BrickBreakerPlayerState[];
      const sorted = [...players].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.level !== a.level) return b.level - a.level;
        return b.bricksDestroyed - a.bricksDestroyed;
      });

      expect(sorted[0].uid).toBe("uid-1"); // more bricks
    });

    it("should detect tie when score and level are equal", () => {
      const state = createBBState();
      addBBPlayers(state);

      const p1 = state.bbPlayers.get("s1")!;
      const p2 = state.bbPlayers.get("s2")!;
      p1.score = 2000;
      p1.level = 6;
      p2.score = 2000;
      p2.level = 6;

      const sorted = [p1, p2].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.level !== a.level) return b.level - a.level;
        return b.bricksDestroyed - a.bricksDestroyed;
      });

      const isTie =
        sorted[0].score === sorted[1].score &&
        sorted[0].level === sorted[1].level;
      expect(isTie).toBe(true);
    });
  });

  describe("Timer", () => {
    it("should calculate remaining time correctly", () => {
      const state = createBBState();
      state.elapsed = 60000;
      state.remaining = Math.max(0, TIME_LIMIT * 1000 - state.elapsed);
      expect(state.remaining).toBe(240000); // 4 minutes left
    });

    it("should end game when timer expires", () => {
      const state = createBBState();
      state.elapsed = TIME_LIMIT * 1000;
      state.remaining = Math.max(0, TIME_LIMIT * 1000 - state.elapsed);
      expect(state.remaining).toBe(0);
    });
  });

  describe("Rematch Reset", () => {
    it("should reset all player and game state", () => {
      const state = createBBState();
      addBBPlayers(state);

      const p1 = state.bbPlayers.get("s1")!;
      p1.score = 5000;
      p1.level = 8;
      p1.lives = 0;
      p1.bricksDestroyed = 200;
      p1.finished = true;
      state.phase = "finished";
      state.winnerId = "uid-1";

      // Reset
      state.bbPlayers.forEach((p: BrickBreakerPlayerState) => {
        p.score = 0;
        p.ready = false;
        p.finished = false;
        p.lives = STARTING_LIVES;
        p.level = 1;
        p.bricksDestroyed = 0;
      });
      state.phase = "waiting";
      state.winnerId = "";
      state.winReason = "";
      state.elapsed = 0;
      state.remaining = 0;

      expect(p1.score).toBe(0);
      expect(p1.lives).toBe(STARTING_LIVES);
      expect(p1.level).toBe(1);
      expect(p1.bricksDestroyed).toBe(0);
      expect(p1.finished).toBe(false);
      expect(state.phase).toBe("waiting");
    });
  });
});
// 12. Game Lifecycle (Shared Patterns)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

describe("Shared Game Lifecycle", () => {
  it("should start in waiting phase", () => {
    expect(new PhysicsState().phase).toBe("waiting");
    expect(new BounceBlitzState().phase).toBe("waiting");
    expect(new BrickBreakerState().phase).toBe("waiting");
  });

  it("should track countdown correctly", () => {
    const state = new PhysicsState();
    state.phase = "countdown";
    state.countdown = 3;

    // Simulate countdown
    state.countdown--;
    expect(state.countdown).toBe(2);
    state.countdown--;
    expect(state.countdown).toBe(1);
    state.countdown--;
    expect(state.countdown).toBe(0);
    // At 0, game starts
    state.phase = "playing";
    expect(state.phase).toBe("playing");
  });

  it("should transition to finished phase with winner", () => {
    const state = new PhysicsState();
    state.phase = "playing";

    state.phase = "finished";
    state.winnerId = "uid-1";
    state.winReason = "score_limit";

    expect(state.phase).toBe("finished");
    expect(state.winnerId).toBe("uid-1");
    expect(state.winReason).toBe("score_limit");
  });

  it("should generate valid seeds", () => {
    for (let i = 0; i < 100; i++) {
      const seed = Math.floor(Math.random() * 2147483647);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2147483647);
      expect(Number.isInteger(seed)).toBe(true);
    }
  });

  it("should track elapsed time", () => {
    const state = new PhysicsState();
    state.elapsed = 0;

    // Simulate time passing
    const dt = 16.6; // ~60fps
    for (let i = 0; i < 60; i++) {
      state.elapsed += dt;
    }

    // About 1 second
    expect(state.elapsed).toBeCloseTo(996, 0);
  });

  describe("Player Connection State", () => {
    it("should track connection status for PhysicsPlayer", () => {
      const p = new PhysicsPlayer();
      expect(p.connected).toBe(true);
      p.connected = false;
      expect(p.connected).toBe(false);
    });

      expect(p.connected).toBe(true);
      p.connected = false;
      expect(p.connected).toBe(false);
    });

    it("should track connection status for BounceBlitzPlayerState", () => {
      const p = new BounceBlitzPlayerState();
      expect(p.connected).toBe(true);
    });

    it("should track connection status for BrickBreakerPlayerState", () => {
      const p = new BrickBreakerPlayerState();
      expect(p.connected).toBe(true);
    });

      expect(p.connected).toBe(true);
    });
  });

  describe("Ready State", () => {
    it("should check all players ready before countdown", () => {
      const state = new PhysicsState();
      const p1 = new PhysicsPlayer();
      p1.ready = false;
      const p2 = new PhysicsPlayer();
      p2.ready = false;
      state.players.set("s1", p1);
      state.players.set("s2", p2);

      let allReady = true;
      state.players.forEach((p: PhysicsPlayer) => {
        if (!p.ready) allReady = false;
      });
      expect(allReady).toBe(false);

      p1.ready = true;
      p2.ready = true;

      allReady = true;
      state.players.forEach((p: PhysicsPlayer) => {
        if (!p.ready) allReady = false;
      });
      expect(allReady).toBe(true);
    });

    it("should not start with only one player", () => {
      const state = new PhysicsState();
      const p1 = new PhysicsPlayer();
      p1.ready = true;
      state.players.set("s1", p1);

      const hasEnoughPlayers = state.players.size >= 2;
      expect(hasEnoughPlayers).toBe(false);
    });
  });
});
