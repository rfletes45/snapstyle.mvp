/**
 * Games V4 — Tic-Tac-Toe Adapter Unit Tests
 *
 * Tests the pure game logic of the TicTacToe adapter:
 * - Initial state creation
 * - Move validation (valid, invalid, out-of-bounds, occupied)
 * - Win detection (rows, columns, diagonals)
 * - Draw detection (full board, no winner)
 * - Outcome computation
 * - Performance metrics
 */

// Import adapter directly — auto-registers on import
import ticTacToeAdapter from "@/gamesV4/adapters/ticTacToe";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS = [
  { uid: "p1", slotIndex: 0 },
  { uid: "p2", slotIndex: 1 },
];

const PLAYERS_NAMED = [
  { uid: "p1", displayName: "Alice" },
  { uid: "p2", displayName: "Bob" },
];

function makeCtx(currentTurnIndex: number) {
  return {
    uid: currentTurnIndex === 0 ? "p1" : "p2",
    turnOrder: ["p1", "p2"],
    currentTurnIndex,
    settings: {},
  };
}

function emptyBoard(): (string | null)[][] {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
}

function makeState(
  board: (string | null)[][],
  moveCount = 0,
  scores = { X: 0, O: 0, draws: 0 },
) {
  return { board, scores, moveCount } as unknown as Record<string, unknown>;
}

// =============================================================================
// Tests
// =============================================================================

describe("TicTacToe Adapter V4", () => {
  describe("metadata", () => {
    it("has correct game ID and runtime type", () => {
      expect(ticTacToeAdapter.gameId).toBe("tic_tac_toe");
      expect(ticTacToeAdapter.runtimeType).toBe("turnBased");
      expect(ticTacToeAdapter.maxPlayers).toBe(2);
      expect(ticTacToeAdapter.minPlayers).toBe(2);
      expect(ticTacToeAdapter.supportsSpectate).toBe(true);
      expect(ticTacToeAdapter.spectateMode).toBe("full_state");
    });
  });

  describe("createInitialPublicState", () => {
    it("creates an empty 3×3 board with zero scores", () => {
      const state = ticTacToeAdapter.createInitialPublicState(PLAYERS, {});
      const s = state as {
        board: unknown[][];
        scores: Record<string, number>;
        moveCount: number;
      };

      expect(s.board).toEqual(emptyBoard());
      expect(s.scores).toEqual({ X: 0, O: 0, draws: 0 });
      expect(s.moveCount).toBe(0);
    });
  });

  describe("validateMove", () => {
    it("accepts a valid move on an empty cell", () => {
      const state = makeState(emptyBoard(), 0);
      const result = ticTacToeAdapter.validateMove!(
        state,
        {},
        { row: 0, col: 0 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(true);
      expect(result.terminal).toBeUndefined();

      // Board should have X at (0,0)
      const nextBoard = (result.nextPublicState as { board: unknown[][] })
        .board;
      expect(nextBoard[0][0]).toBe("X");
    });

    it("rejects a move on an occupied cell", () => {
      const board = emptyBoard();
      board[1][1] = "X";
      const state = makeState(board, 1);

      const result = ticTacToeAdapter.validateMove!(
        state,
        {},
        { row: 1, col: 1 },
        makeCtx(1),
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("occupied");
    });

    it("rejects out-of-bounds coordinates", () => {
      const state = makeState(emptyBoard());
      const cases = [
        { row: -1, col: 0 },
        { row: 0, col: 3 },
        { row: 3, col: 3 },
        { row: "a", col: 0 },
      ];

      for (const move of cases) {
        const result = ticTacToeAdapter.validateMove!(
          state,
          {},
          move as unknown as Record<string, unknown>,
          makeCtx(0),
        );
        expect(result.ok).toBe(false);
      }
    });

    it("detects a row win", () => {
      // X X _
      // O O _
      // _ _ _
      const board = emptyBoard();
      board[0][0] = "X";
      board[0][1] = "X";
      board[1][0] = "O";
      board[1][1] = "O";
      const state = makeState(board, 4);

      // X places at (0,2) — completes top row
      const result = ticTacToeAdapter.validateMove!(
        state,
        {},
        { row: 0, col: 2 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      expect(result.terminal).toBeDefined();
      expect(result.terminal!.type).toBe("win");
      expect(result.terminal!.winnerIds).toEqual(["p1"]);
      expect(result.turnAdvance).toBe(false);
    });

    it("detects a column win", () => {
      // X O _
      // X O _
      // _ _ _
      const board = emptyBoard();
      board[0][0] = "X";
      board[0][1] = "O";
      board[1][0] = "X";
      board[1][1] = "O";
      const state = makeState(board, 4);

      // X places at (2,0) — completes left column
      const result = ticTacToeAdapter.validateMove!(
        state,
        {},
        { row: 2, col: 0 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      expect(result.terminal!.type).toBe("win");
      expect(result.terminal!.winnerIds).toEqual(["p1"]);
    });

    it("detects a diagonal win", () => {
      // X O _
      // O X _
      // _ _ _
      const board = emptyBoard();
      board[0][0] = "X";
      board[0][1] = "O";
      board[1][0] = "O";
      board[1][1] = "X";
      const state = makeState(board, 4);

      // X places at (2,2) — completes main diagonal
      const result = ticTacToeAdapter.validateMove!(
        state,
        {},
        { row: 2, col: 2 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      expect(result.terminal!.type).toBe("win");
    });

    it("detects a draw (full board, no winner)", () => {
      // X O X
      // X O O
      // O X _
      const board: (string | null)[][] = [
        ["X", "O", "X"],
        ["X", "O", "O"],
        ["O", "X", null],
      ];
      const state = makeState(board, 8);

      // X places at (2,2) — fills board with no winner
      const result = ticTacToeAdapter.validateMove!(
        state,
        {},
        { row: 2, col: 2 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      expect(result.terminal).toBeDefined();
      expect(result.terminal!.type).toBe("draw");
      expect(result.terminal!.winnerIds).toBeUndefined();
    });
  });

  describe("computeOutcome", () => {
    it("returns winner when board has a complete line", () => {
      // X wins with top row
      const board: (string | null)[][] = [
        ["X", "X", "X"],
        ["O", "O", null],
        [null, null, null],
      ];
      const state = makeState(board);

      const outcome = ticTacToeAdapter.computeOutcome!(state, PLAYERS);
      expect(outcome.winnerIds).toEqual(["p1"]);
      expect(outcome.finalScoreboard[0].placement).toBe(1);
      expect(outcome.finalScoreboard[1].placement).toBe(2);
    });

    it("returns empty winners for a drawn board", () => {
      const board: (string | null)[][] = [
        ["X", "O", "X"],
        ["X", "O", "O"],
        ["O", "X", "X"],
      ];
      const state = makeState(board);

      const outcome = ticTacToeAdapter.computeOutcome!(state, PLAYERS);
      expect(outcome.winnerIds).toEqual([]);
    });
  });

  describe("computeSummary", () => {
    it("returns current turn player and scores", () => {
      const state = makeState(emptyBoard(), 0, { X: 1, O: 0, draws: 0 });
      const summary = ticTacToeAdapter.computeSummary!(
        state,
        PLAYERS_NAMED,
        "p1",
      );

      expect(summary.turnPlayerId).toBe("p1");
      expect(summary.scoreSummary).toHaveLength(2);
      expect(summary.scoreSummary[0].score).toBe(1);
    });
  });

  describe("extractPerformanceMetrics", () => {
    it("extracts total move count", () => {
      const state = makeState(emptyBoard(), 5);
      const metrics = ticTacToeAdapter.extractPerformanceMetrics!(
        state,
        PLAYERS,
      );
      expect(metrics.totalMoves).toBe(5);
    });
  });
});
