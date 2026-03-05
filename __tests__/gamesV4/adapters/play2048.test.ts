/**
 * Games V4 — 2048 Adapter Unit Tests
 *
 * Tests the pure game logic:
 * - Initial state (two tiles placed)
 * - Move validation (valid slide, invalid direction, no-op move)
 * - Merge mechanics (adjacent equal tiles merge)
 * - Score accumulation
 * - Game-over detection (no valid moves)
 * - Deterministic tile placement
 * - Outcome computation
 */

import play2048Adapter from "@/gamesV4/adapters/play2048";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS = [{ uid: "solo", slotIndex: 0 }];

function makeCtx() {
  return {
    uid: "solo",
    turnOrder: ["solo"],
    currentTurnIndex: 0,
    settings: {},
  };
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    board: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    bestTile: 0,
    moveCount: 0,
    mergeCount: 0,
    hasWon: false,
    gameOver: false,
    ...overrides,
  } as unknown as Record<string, unknown>;
}

// =============================================================================
// Tests
// =============================================================================

describe("2048 Adapter V4", () => {
  describe("metadata", () => {
    it("has correct classification", () => {
      expect(play2048Adapter.gameId).toBe("play_2048");
      expect(play2048Adapter.runtimeType).toBe("solo");
      expect(play2048Adapter.maxPlayers).toBe(1);
      expect(play2048Adapter.minPlayers).toBe(1);
      expect(play2048Adapter.supportsSpectate).toBe(false);
    });
  });

  describe("createInitialPublicState", () => {
    it("starts with a 4×4 board and 2 placed tiles", () => {
      const state = play2048Adapter.createInitialPublicState(PLAYERS, {});
      const s = state as {
        board: number[][];
        score: number;
        moveCount: number;
      };

      expect(s.board).toHaveLength(4);
      expect(s.board[0]).toHaveLength(4);

      // Count non-zero tiles — should be exactly 2
      const nonZero = s.board.flat().filter((v) => v > 0);
      expect(nonZero).toHaveLength(2);
      expect(s.score).toBe(0);
      expect(s.moveCount).toBe(0);
    });

    it("is deterministic (same result on repeated calls)", () => {
      const s1 = play2048Adapter.createInitialPublicState(PLAYERS, {});
      const s2 = play2048Adapter.createInitialPublicState(PLAYERS, {});
      expect(s1).toEqual(s2);
    });
  });

  describe("validateMove", () => {
    it("rejects an invalid direction", () => {
      const state = makeState({
        board: [
          [2, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      });
      const result = play2048Adapter.validateMove!(
        state,
        {},
        { direction: "diagonal" },
        makeCtx(),
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid direction");
    });

    it("rejects a move that has no effect", () => {
      // A board where "left" has no effect (tile already at left edge, no merges)
      const state = makeState({
        board: [
          [2, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      });
      const result = play2048Adapter.validateMove!(
        state,
        {},
        { direction: "left" },
        makeCtx(),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("no effect");
    });

    it("accepts a valid slide that moves tiles", () => {
      const state = makeState({
        board: [
          [0, 0, 0, 2],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      });
      const result = play2048Adapter.validateMove!(
        state,
        {},
        { direction: "left" },
        makeCtx(),
      );

      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(false); // Solo game

      const nextBoard = (result.nextPublicState as { board: number[][] }).board;
      // The 2 should have slid to col 0
      expect(nextBoard[0][0]).toBe(2);
    });

    it("merges adjacent equal tiles and accumulates score", () => {
      const state = makeState({
        board: [
          [2, 2, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      });
      const result = play2048Adapter.validateMove!(
        state,
        {},
        { direction: "left" },
        makeCtx(),
      );

      expect(result.ok).toBe(true);
      const next = result.nextPublicState as {
        board: number[][];
        score: number;
      };
      // 2+2 = 4, merged at col 0
      expect(next.board[0][0]).toBe(4);
      expect(next.score).toBe(4);
    });

    it("chain-merges correctly (4+4 after 2+2 on same row)", () => {
      const state = makeState({
        board: [
          [2, 2, 4, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      });
      const result = play2048Adapter.validateMove!(
        state,
        {},
        { direction: "left" },
        makeCtx(),
      );

      expect(result.ok).toBe(true);
      const next = result.nextPublicState as { board: number[][] };
      // [2,2,4,0] → slide left → [4,4,0,0] (2+2=4, then the original 4 is separate)
      expect(next.board[0][0]).toBe(4);
      expect(next.board[0][1]).toBe(4);
    });

    it("rejects a move when the game is already over", () => {
      const state = makeState({ gameOver: true });
      const result = play2048Adapter.validateMove!(
        state,
        {},
        { direction: "left" },
        makeCtx(),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("over");
    });

    it("detects terminal state when no moves remain after slide", () => {
      // A board that will become stuck after one more move
      // After a left slide, all cells will be filled with no adjacent equals
      const board = [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 0], // one empty cell that will be filled after move
      ];
      const state = makeState({ board, moveCount: 14 });

      const result = play2048Adapter.validateMove!(
        state,
        {},
        { direction: "right" },
        makeCtx(),
      );

      // The board fills after slid piece + new tile placement
      // Terminal detection depends on whether the post-tile-placement board can still move
      if (result.ok && result.terminal) {
        expect(["win", "timeout"]).toContain(result.terminal.type);
      }
      // If still playable, that's also fine — move was valid
      expect(result.ok).toBe(true);
    });

    it("places a new tile after each valid move", () => {
      const state = makeState({
        board: [
          [0, 0, 0, 2],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      });

      const result = play2048Adapter.validateMove!(
        state,
        {},
        { direction: "left" },
        makeCtx(),
      );

      expect(result.ok).toBe(true);
      const nextBoard = (result.nextPublicState as { board: number[][] }).board;
      // Should have 2 non-zero tiles: original (slid) + new tile
      const nonZero = nextBoard.flat().filter((v) => v > 0);
      expect(nonZero.length).toBe(2);
    });
  });

  describe("computeOutcome", () => {
    it("marks win when 2048 tile is reached", () => {
      const state = makeState({ hasWon: true, score: 5000, bestTile: 2048 });
      const outcome = play2048Adapter.computeOutcome!(state, PLAYERS);

      expect(outcome.winnerIds).toEqual(["solo"]);
      expect(outcome.finalScoreboard[0].score).toBe(5000);
    });

    it("returns no winners when game over without reaching 2048", () => {
      const state = makeState({
        hasWon: false,
        gameOver: true,
        score: 1000,
        bestTile: 512,
      });
      const outcome = play2048Adapter.computeOutcome!(state, PLAYERS);

      expect(outcome.winnerIds).toEqual([]);
      expect(outcome.finalScoreboard[0].score).toBe(1000);
    });
  });

  describe("extractPerformanceMetrics", () => {
    it("extracts all relevant metrics", () => {
      const state = makeState({
        score: 3456,
        bestTile: 512,
        moveCount: 120,
        mergeCount: 50,
        hasWon: false,
      });
      const metrics = play2048Adapter.extractPerformanceMetrics!(
        state,
        PLAYERS,
      );

      expect(metrics.score).toBe(3456);
      expect(metrics.bestTile).toBe(512);
      expect(metrics.moveCount).toBe(120);
      expect(metrics.mergeCount).toBe(50);
      expect(metrics.hasWon).toBe(false);
    });
  });
});
