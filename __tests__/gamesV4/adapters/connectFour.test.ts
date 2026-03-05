/**
 * Games V4 — Connect Four Adapter Unit Tests
 *
 * Tests the pure game logic:
 * - Initial state creation
 * - Move validation (valid drop, full column, out-of-range)
 * - Gravity (piece drops to bottom)
 * - Win detection (horizontal, vertical, both diagonals)
 * - Draw detection (full board)
 * - Outcome computation
 */

import connectFourAdapter from "@/gamesV4/adapters/connectFour";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS = [
  { uid: "p1", slotIndex: 0 },
  { uid: "p2", slotIndex: 1 },
];

function makeCtx(currentTurnIndex: number) {
  return {
    uid: currentTurnIndex === 0 ? "p1" : "p2",
    turnOrder: ["p1", "p2"],
    currentTurnIndex,
    settings: {},
  };
}

function emptyBoard(): number[][] {
  return Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => 0));
}

function makeState(
  board?: number[][],
  moveCount = 0,
  lastMove: { row: number; col: number } | null = null,
) {
  return {
    board: board ?? emptyBoard(),
    moveCount,
    lastMove,
  } as unknown as Record<string, unknown>;
}

// =============================================================================
// Tests
// =============================================================================

describe("Connect Four Adapter V4", () => {
  describe("metadata", () => {
    it("has correct IDs and limits", () => {
      expect(connectFourAdapter.gameId).toBe("connect_four");
      expect(connectFourAdapter.runtimeType).toBe("turnBased");
      expect(connectFourAdapter.maxPlayers).toBe(2);
      expect(connectFourAdapter.minPlayers).toBe(2);
    });
  });

  describe("createInitialPublicState", () => {
    it("creates a 6×7 empty board", () => {
      const state = connectFourAdapter.createInitialPublicState(PLAYERS, {});
      const s = state as { board: number[][]; moveCount: number };

      expect(s.board).toHaveLength(6);
      expect(s.board[0]).toHaveLength(7);
      expect(s.board.flat().every((c) => c === 0)).toBe(true);
      expect(s.moveCount).toBe(0);
    });
  });

  describe("validateMove", () => {
    it("drops a piece to the bottom of an empty column", () => {
      const state = makeState();
      const result = connectFourAdapter.validateMove!(
        state,
        {},
        { col: 3 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(true);
      expect(result.terminal).toBeUndefined();

      const nextBoard = (result.nextPublicState as { board: number[][] }).board;
      // Bottom row (5), column 3 should have player 1's piece
      expect(nextBoard[5][3]).toBe(1);
      // Row 4 should still be empty
      expect(nextBoard[4][3]).toBe(0);
    });

    it("stacks pieces correctly (gravity)", () => {
      const board = emptyBoard();
      board[5][2] = 1; // P1 already in bottom of col 2
      const state = makeState(board, 1);

      const result = connectFourAdapter.validateMove!(
        state,
        {},
        { col: 2 },
        makeCtx(1),
      );

      expect(result.ok).toBe(true);
      const nextBoard = (result.nextPublicState as { board: number[][] }).board;
      expect(nextBoard[4][2]).toBe(2); // P2 stacked on top
      expect(nextBoard[5][2]).toBe(1); // P1 still at bottom
    });

    it("rejects a move on a full column", () => {
      const board = emptyBoard();
      // Fill column 0 completely
      for (let r = 0; r < 6; r++) {
        board[r][0] = r % 2 === 0 ? 1 : 2;
      }
      const state = makeState(board, 6);

      const result = connectFourAdapter.validateMove!(
        state,
        {},
        { col: 0 },
        makeCtx(0),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("full");
    });

    it("rejects out-of-range column", () => {
      const state = makeState();
      const invalid = [{ col: -1 }, { col: 7 }, { col: "abc" }];

      for (const move of invalid) {
        const result = connectFourAdapter.validateMove!(
          state,
          {},
          move as unknown as Record<string, unknown>,
          makeCtx(0),
        );
        expect(result.ok).toBe(false);
      }
    });

    it("detects a horizontal win", () => {
      const board = emptyBoard();
      // P1 has 3 in a row at bottom: cols 0,1,2
      board[5][0] = 1;
      board[5][1] = 1;
      board[5][2] = 1;
      // P2 pieces above
      board[4][0] = 2;
      board[4][1] = 2;
      board[4][2] = 2;
      const state = makeState(board, 6);

      // P1 places in col 3 — completes 4 in a row
      const result = connectFourAdapter.validateMove!(
        state,
        {},
        { col: 3 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      expect(result.terminal).toBeDefined();
      expect(result.terminal!.type).toBe("win");
      expect(result.terminal!.winnerIds).toEqual(["p1"]);
    });

    it("detects a vertical win", () => {
      const board = emptyBoard();
      // P1 has 3 stacked in col 4: rows 5,4,3
      board[5][4] = 1;
      board[4][4] = 1;
      board[3][4] = 1;
      // P2 pieces in col 5
      board[5][5] = 2;
      board[4][5] = 2;
      board[3][5] = 2;
      const state = makeState(board, 6);

      // P1 places in col 4 — stacks on row 2, completes vertical 4
      const result = connectFourAdapter.validateMove!(
        state,
        {},
        { col: 4 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      expect(result.terminal!.type).toBe("win");
      expect(result.terminal!.winnerIds).toEqual(["p1"]);
    });

    it("detects a diagonal ↘ win", () => {
      const board = emptyBoard();
      // Set up P1 diagonal at (5,0), (4,1), (3,2) + support pieces
      board[5][0] = 1;
      board[5][1] = 2;
      board[4][1] = 1;
      board[5][2] = 2;
      board[4][2] = 2;
      board[3][2] = 1;
      // Support for col 3 (need 3 pieces below)
      board[5][3] = 2;
      board[4][3] = 2;
      board[3][3] = 2;
      const state = makeState(board, 9);

      // P1 drops in col 3 → lands at row 2 → completes diagonal
      const result = connectFourAdapter.validateMove!(
        state,
        {},
        { col: 3 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      expect(result.terminal!.type).toBe("win");
    });

    it("detects a draw (full board, no winner)", () => {
      // A valid drawn Connect Four board with no 4-in-a-row:
      // Pattern avoids any horizontal, vertical, or diagonal sequence of 4
      const board = [
        [1, 1, 2, 1, 1, 2, 0], // row 0 (top) — one empty cell at col 6
        [2, 2, 1, 2, 2, 1, 2],
        [1, 1, 2, 1, 1, 2, 1],
        [2, 2, 1, 2, 2, 1, 2],
        [1, 1, 2, 1, 1, 2, 1],
        [2, 2, 1, 2, 2, 1, 2],
      ];
      const state = makeState(board, 41);

      // P1 places the last piece in col 6, row 0
      const result = connectFourAdapter.validateMove!(
        state,
        {},
        { col: 6 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      // Should be terminal draw (board full, no 4-in-a-row)
      expect(result.terminal).toBeDefined();
      expect(result.terminal!.type).toBe("draw");
    });
  });

  describe("computeOutcome", () => {
    it("identifies winner from a winning board", () => {
      const board = emptyBoard();
      // P2 vertical win in col 0
      board[5][0] = 2;
      board[4][0] = 2;
      board[3][0] = 2;
      board[2][0] = 2;
      const state = makeState(board);

      const outcome = connectFourAdapter.computeOutcome!(state, PLAYERS);
      expect(outcome.winnerIds).toEqual(["p2"]);
      expect(outcome.finalScoreboard[0].uid).toBe("p2");
      expect(outcome.finalScoreboard[0].placement).toBe(1);
    });

    it("returns draw when no winner", () => {
      const state = makeState(emptyBoard());
      const outcome = connectFourAdapter.computeOutcome!(state, PLAYERS);
      expect(outcome.winnerIds).toEqual([]);
    });
  });

  describe("extractPerformanceMetrics", () => {
    it("extracts move count", () => {
      const state = makeState(undefined, 12);
      const metrics = connectFourAdapter.extractPerformanceMetrics!(
        state,
        PLAYERS,
      );
      expect(metrics.totalMoves).toBe(12);
    });
  });
});
