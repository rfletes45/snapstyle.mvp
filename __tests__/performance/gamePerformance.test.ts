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

describe("Game Performance", () => {
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

  describe("Load Time Simulation", () => {
    it("should parse starting chess position quickly", () => {
      const startingFEN =
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      const result = measureExecutionTime(() => {
        parseFEN(startingFEN);
      }, 1000);

      expect(result.average).toBeLessThan(1);
    });
  });

  describe("Stress Tests", () => {
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
    chessMoveLegal: 1, // ms
    chessCheckmate: 5, // ms
    fenParsing: 0.5, // ms
  };

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
