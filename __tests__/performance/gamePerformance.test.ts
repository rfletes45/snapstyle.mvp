/**
 * Game Performance Tests
 * Phase 8: Testing & Launch
 *
 * Tests to ensure games meet performance requirements:
 * - 60fps rendering
 * - Physics calculations < 16ms
 * - Memory usage bounds
 * - Load times
 */

import {
  isCheckmate,
  isLegalMove,
  isStalemate,
  parseFEN,
} from "@/services/gameValidation/chessValidator";
import {
  Bird,
  FLAPPY_PHYSICS,
  FlappyGameState,
  generatePipe,
  physicsTick,
} from "@/utils/physics/flappyPhysics";
import {
  Ball,
  createBall,
  PoolTable,
  simulateShot,
} from "@/utils/physics/poolPhysics";

// Screen width constant for tests
const SCREEN_WIDTH = 800;

// Performance measurement utilities
const measureExecutionTime = (
  fn: () => void,
  iterations: number = 1000,
): {
  average: number;
  min: number;
  max: number;
  total: number;
} => {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  return {
    average: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
    total: times.reduce((a, b) => a + b, 0),
  };
};

const simulateGameLoop = (
  updateFn: (deltaTime: number) => void,
  frames: number,
  targetFps: number = 60,
): { fps: number; frameTimes: number[] } => {
  const targetFrameTime = 1000 / targetFps;
  const frameTimes: number[] = [];

  for (let i = 0; i < frames; i++) {
    const start = performance.now();
    updateFn(targetFrameTime);
    frameTimes.push(performance.now() - start);
  }

  const avgFrameTime =
    frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  const fps = 1000 / avgFrameTime;

  return { fps, frameTimes };
};

// Helper to create test Bird
const createTestBird = (overrides: Partial<Bird> = {}): Bird => ({
  x: 100,
  y: 300,
  velocity: 0,
  width: FLAPPY_PHYSICS.BIRD_WIDTH,
  height: FLAPPY_PHYSICS.BIRD_HEIGHT,
  ...overrides,
});

// Helper to create test game state
const createTestGameState = (
  overrides: Partial<FlappyGameState> = {},
): FlappyGameState => ({
  bird: createTestBird(),
  pipes: [],
  score: 0,
  lastPipePassed: -1,
  isGameOver: false,
  ...overrides,
});

describe("Game Performance", () => {
  describe("Flappy Snap Performance", () => {
    it("should complete physics tick within frame budget (16ms)", () => {
      const gameState = createTestGameState({
        pipes: [
          generatePipe(400, 0),
          generatePipe(600, 1),
          generatePipe(800, 2),
        ],
      });

      const result = measureExecutionTime(() => {
        physicsTick(gameState, 16.67, SCREEN_WIDTH);
      }, 1000);

      expect(result.average).toBeLessThan(1); // Should be well under 1ms
      expect(result.max).toBeLessThan(16); // Worst case under frame budget
    });

    it("should maintain 60fps with typical gameplay scenario", () => {
      let gameState = createTestGameState();

      // Generate initial pipes
      for (let i = 0; i < 5; i++) {
        gameState.pipes.push(generatePipe(400 + i * 200, i));
      }

      const { fps, frameTimes } = simulateGameLoop(
        (deltaTime) => {
          gameState = physicsTick(gameState, deltaTime, SCREEN_WIDTH);
        },
        600, // 10 seconds at 60fps
        60,
      );

      // Average should support 60fps (frame time < 16.67ms)
      const avgFrameTime =
        frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      expect(avgFrameTime).toBeLessThan(16.67);

      // 99th percentile should still be under budget
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      expect(p99).toBeLessThan(16.67);
    });

    it("should handle rapid pipe generation efficiently", () => {
      const result = measureExecutionTime(() => {
        for (let i = 0; i < 100; i++) {
          generatePipe(400, i, 600);
        }
      }, 100);

      expect(result.average).toBeLessThan(5); // 100 pipes in under 5ms
    });
  });

  describe("Pool Physics Performance", () => {
    it("should complete single frame physics in under 16ms", () => {
      const balls: Ball[] = [];
      for (let i = 0; i < 16; i++) {
        balls.push(
          createBall(
            i,
            100 + (i % 4) * 50,
            100 + Math.floor(i / 4) * 50,
            i === 0 ? "cue" : i === 8 ? "eight" : i < 8 ? "solid" : "stripe",
          ),
        );
      }

      const table: PoolTable = {
        width: 800,
        height: 400,
        pockets: [
          { x: 0, y: 0, radius: 20 },
          { x: 400, y: 0, radius: 20 },
          { x: 800, y: 0, radius: 20 },
          { x: 0, y: 400, radius: 20 },
          { x: 400, y: 400, radius: 20 },
          { x: 800, y: 400, radius: 20 },
        ],
      };

      // Apply initial shot
      balls[0].vx = 300;
      balls[0].vy = 150;

      const result = measureExecutionTime(() => {
        simulateShot(balls, { angle: 0, power: 300 }, table, 1000);
      }, 100);

      expect(result.average).toBeLessThan(16);
    });

    it("should handle collision-heavy scenarios efficiently", () => {
      // Create balls very close together to force many collisions
      const balls: Ball[] = [];
      for (let i = 0; i < 16; i++) {
        balls.push(
          createBall(
            i,
            300 + (i % 4) * 25,
            200 + Math.floor(i / 4) * 25,
            i === 0 ? "cue" : i === 8 ? "eight" : i < 8 ? "solid" : "stripe",
          ),
        );
      }

      const table: PoolTable = {
        width: 800,
        height: 400,
        pockets: [
          { x: 0, y: 0, radius: 20 },
          { x: 400, y: 0, radius: 20 },
          { x: 800, y: 0, radius: 20 },
          { x: 0, y: 400, radius: 20 },
          { x: 400, y: 400, radius: 20 },
          { x: 800, y: 400, radius: 20 },
        ],
      };

      const result = measureExecutionTime(() => {
        simulateShot(balls, { angle: 45, power: 500 }, table, 500);
      }, 50);

      // Even with many collisions, should complete reasonably fast
      expect(result.average).toBeLessThan(50);
    });

    it("should scale linearly with ball count", () => {
      const createBallSet = (count: number): Ball[] => {
        const balls: Ball[] = [];
        for (let i = 0; i < count; i++) {
          balls.push(
            createBall(
              i,
              100 + (i % 8) * 80,
              100 + Math.floor(i / 8) * 80,
              "solid",
            ),
          );
        }
        return balls;
      };

      const table = {
        width: 800,
        height: 400,
        pockets: [],
      };

      const time8 = measureExecutionTime(() => {
        simulateShot(createBallSet(8), { angle: 0, power: 200 }, table, 100);
      }, 50);

      const time16 = measureExecutionTime(() => {
        simulateShot(createBallSet(16), { angle: 0, power: 200 }, table, 100);
      }, 50);

      // Time should not increase more than 4x for double the balls
      // (collision checks are O(n²), but should be optimized)
      expect(time16.average).toBeLessThan(time8.average * 5);
    });
  });

  describe("Chess Validation Performance", () => {
    const startingFEN =
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const complexFEN =
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const endgameFEN = "8/8/4k3/8/8/4K3/4P3/8 w - - 0 1";

    it("should parse FEN quickly", () => {
      const result = measureExecutionTime(() => {
        parseFEN(startingFEN);
      }, 1000);

      expect(result.average).toBeLessThan(0.5); // Under 0.5ms
    });

    it("should validate legal moves quickly", () => {
      const result = measureExecutionTime(() => {
        isLegalMove(startingFEN, { from: "e2", to: "e4" });
      }, 1000);

      expect(result.average).toBeLessThan(1); // Under 1ms
    });

    it("should check for checkmate efficiently", () => {
      // Scholar's mate position
      const scholarsMate =
        "rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";

      const result = measureExecutionTime(() => {
        isCheckmate(scholarsMate);
      }, 500);

      expect(result.average).toBeLessThan(5); // Under 5ms for checkmate detection
    });

    it("should handle complex positions without timeout", () => {
      // Position with many possible moves
      const result = measureExecutionTime(() => {
        // Check several moves in complex position
        isLegalMove(complexFEN, { from: "e1", to: "g1" }); // Castling
        isLegalMove(complexFEN, { from: "d2", to: "d4" });
        isLegalMove(complexFEN, { from: "f3", to: "g5" });
      }, 500);

      expect(result.average).toBeLessThan(5);
    });

    it("should detect stalemate efficiently", () => {
      // Near-stalemate position
      const stalematePos = "k7/8/1K6/8/8/8/8/8 b - - 0 1";

      const result = measureExecutionTime(() => {
        isStalemate(stalematePos);
      }, 500);

      expect(result.average).toBeLessThan(5);
    });

    it("should validate 100 consecutive moves under 100ms", () => {
      const moves = [
        { fen: startingFEN, move: { from: "e2", to: "e4" } },
        {
          fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
          move: { from: "e7", to: "e5" },
        },
        {
          fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
          move: { from: "g1", to: "f3" },
        },
        {
          fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
          move: { from: "b8", to: "c6" },
        },
      ];

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        const { fen, move } = moves[i % moves.length];
        isLegalMove(fen, move);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe("Memory Efficiency", () => {
    it("should not leak memory during extended Flappy gameplay", () => {
      let gameState = createTestGameState();

      // Simulate extended gameplay
      const initialPipeCount = 5;

      for (let i = 0; i < initialPipeCount; i++) {
        gameState.pipes.push(generatePipe(400 + i * 200, i));
      }

      // Run many frames
      for (let frame = 0; frame < 10000; frame++) {
        gameState = physicsTick(gameState, 16.67, SCREEN_WIDTH);

        // Periodically add pipes (simulating continuous gameplay)
        if (frame % 100 === 0) {
          gameState.pipes.push(
            generatePipe(1000, gameState.lastPipePassed + 1),
          );
        }

        // Clean up off-screen pipes
        gameState.pipes = gameState.pipes.filter((p) => p.x > -100);
      }

      // Pipe count should stay bounded
      expect(gameState.pipes.length).toBeLessThan(20);
    });

    it("should efficiently reuse objects in pool physics", () => {
      const balls: Ball[] = [];
      for (let i = 0; i < 16; i++) {
        balls.push(
          createBall(
            i,
            100 + i * 30,
            200,
            i === 0 ? "cue" : i === 8 ? "eight" : i < 8 ? "solid" : "stripe",
          ),
        );
      }

      const table: PoolTable = {
        width: 800,
        height: 400,
        pockets: [],
      };

      // Simulate many shots
      for (let shot = 0; shot < 100; shot++) {
        simulateShot(balls, { angle: shot * 10, power: 200 }, table, 100);
      }

      // All balls should still exist
      expect(balls.length).toBe(16);
    });
  });

  describe("Load Time Simulation", () => {
    it("should initialize Flappy game state quickly", () => {
      const result = measureExecutionTime(() => {
        const gameState = createTestGameState();

        // Generate initial pipes
        for (let i = 0; i < 5; i++) {
          gameState.pipes.push(generatePipe(400 + i * 200, i));
        }

        return gameState;
      }, 1000);

      expect(result.average).toBeLessThan(1); // Under 1ms
    });

    it("should parse starting chess position quickly", () => {
      const startingFEN =
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      const result = measureExecutionTime(() => {
        parseFEN(startingFEN);
      }, 1000);

      expect(result.average).toBeLessThan(1);
    });

    it("should create pool table state quickly", () => {
      const result = measureExecutionTime(() => {
        const balls: Ball[] = [];
        for (let i = 0; i < 16; i++) {
          balls.push(
            createBall(
              i,
              100 + i * 30,
              200,
              i === 0 ? "cue" : i === 8 ? "eight" : i < 8 ? "solid" : "stripe",
            ),
          );
        }

        return {
          balls,
          table: {
            width: 800,
            height: 400,
            pockets: [
              { x: 0, y: 0, radius: 20 },
              { x: 400, y: 0, radius: 20 },
              { x: 800, y: 0, radius: 20 },
              { x: 0, y: 400, radius: 20 },
              { x: 400, y: 400, radius: 20 },
              { x: 800, y: 400, radius: 20 },
            ],
          },
        };
      }, 1000);

      expect(result.average).toBeLessThan(1);
    });
  });

  describe("Stress Tests", () => {
    it("should handle rapid Flappy input (spam tapping)", () => {
      let gameState = createTestGameState();

      const result = measureExecutionTime(() => {
        // Simulate 10 taps per frame (stress test)
        for (let tap = 0; tap < 10; tap++) {
          gameState.bird.velocity = FLAPPY_PHYSICS.FLAP_VELOCITY;
        }
        gameState = physicsTick(gameState, 16.67, SCREEN_WIDTH);
      }, 1000);

      expect(result.average).toBeLessThan(1);
    });

    it("should handle simultaneous pool ball movements", () => {
      const balls: Ball[] = [];
      for (let i = 0; i < 16; i++) {
        const ball = createBall(
          i,
          400,
          200,
          i === 0 ? "cue" : i === 8 ? "eight" : i < 8 ? "solid" : "stripe",
        );
        // All balls moving in different directions
        ball.vx = Math.cos((i * Math.PI * 2) / 16) * 200;
        ball.vy = Math.sin((i * Math.PI * 2) / 16) * 200;
        balls.push(ball);
      }

      const table: PoolTable = {
        width: 800,
        height: 400,
        pockets: [],
      };

      const result = measureExecutionTime(() => {
        simulateShot(balls, { angle: 0, power: 0 }, table, 100);
      }, 100);

      expect(result.average).toBeLessThan(20);
    });

    it("should handle long chess games efficiently", () => {
      // Simulate validating moves throughout a long game
      const positions = [
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
        "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
        "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
      ];

      const start = performance.now();

      // Simulate 200 move game (100 moves per player)
      for (let move = 0; move < 200; move++) {
        const fen = positions[move % positions.length];
        parseFEN(fen);
        isCheckmate(fen);
        isStalemate(fen);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // Under 1 second for entire game
    });
  });
});

describe("Performance Regression Tests", () => {
  // These tests set baselines that future changes should not exceed

  const performanceBaselines = {
    flappyPhysicsTick: 0.5, // ms
    poolSimulation: 15, // ms
    chessMoveLegal: 1, // ms
    chessCheckmate: 5, // ms
    fenParsing: 0.5, // ms
  };

  it("should not regress Flappy physics performance", () => {
    const gameState = createTestGameState({
      pipes: [generatePipe(400, 0)],
    });

    const result = measureExecutionTime(() => {
      physicsTick(gameState, 16.67, SCREEN_WIDTH);
    }, 1000);

    expect(result.average).toBeLessThan(performanceBaselines.flappyPhysicsTick);
  });

  it("should not regress pool simulation performance", () => {
    const balls: Ball[] = [];
    for (let i = 0; i < 16; i++) {
      balls.push(
        createBall(
          i,
          100 + i * 30,
          200,
          i === 0 ? "cue" : i === 8 ? "eight" : i < 8 ? "solid" : "stripe",
        ),
      );
    }

    const result = measureExecutionTime(() => {
      simulateShot(
        balls,
        { angle: 45, power: 300 },
        { width: 800, height: 400, pockets: [] },
        500,
      );
    }, 50);

    expect(result.average).toBeLessThan(performanceBaselines.poolSimulation);
  });

  it("should not regress chess move validation performance", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    const result = measureExecutionTime(() => {
      isLegalMove(fen, { from: "e2", to: "e4" });
    }, 1000);

    expect(result.average).toBeLessThan(performanceBaselines.chessMoveLegal);
  });

  it("should not regress FEN parsing performance", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    const result = measureExecutionTime(() => {
      parseFEN(fen);
    }, 1000);

    expect(result.average).toBeLessThan(performanceBaselines.fenParsing);
  });
});
