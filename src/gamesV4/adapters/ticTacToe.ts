/**
 * Games V4 — Tic-Tac-Toe Adapter
 *
 * Pure, deterministic game logic for Tic-Tac-Toe.
 * Shared between client (optimistic preview) and server (authoritative).
 *
 * Board: 3×3 grid, cells are "X" | "O" | null.
 * Players: exactly 2 — player 0 is "X", player 1 is "O".
 *
 * @module gamesV4/adapters/ticTacToe
 */

import type {
  GameAdapterV4,
  GameOutcome,
  MoveValidationResult,
} from "../types/adapter";
import { registerAdapter } from "./registry";

// =============================================================================
// Types
// =============================================================================

type Cell = "X" | "O" | null;
type Board = Cell[][];

interface TicTacToePublicState {
  board: Board;
  scores: { X: number; O: number; draws: number };
  moveCount: number;
}

// =============================================================================
// Constants
// =============================================================================

const BOARD_SIZE = 3;

const WINNING_LINES: Array<Array<[number, number]>> = [
  // Rows
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  // Columns
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  // Diagonals
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
];

// =============================================================================
// Pure Logic Helpers
// =============================================================================

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function getPlayerSymbol(slotIndex: number): Cell {
  return slotIndex === 0 ? "X" : "O";
}

function checkWinner(
  board: Board,
): { winner: Cell; line: Array<[number, number]> } | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const cellA = board[a[0]][a[1]];
    if (cellA && cellA === board[b[0]][b[1]] && cellA === board[c[0]][c[1]]) {
      return { winner: cellA, line };
    }
  }
  return null;
}

function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

// =============================================================================
// Adapter Implementation
// =============================================================================

const ticTacToeAdapter: GameAdapterV4 = {
  gameId: "tic_tac_toe",
  runtimeType: "turnBased",
  maxPlayers: 2,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "full_state",

  scoreboardDescriptor: {
    title: "MATCH RESULT",
    formatScore: (s) => (s === 1 ? "Win" : s === 0 ? "Loss" : "Draw"),
    sortDirection: "desc",
  },

  settingsSchema: [],
  defaultSettings: {},

  // ── State Creation ──────────────────────────────────────────────────

  createInitialPublicState(
    _players: Array<{ uid: string; slotIndex: number }>,
    _settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const state: TicTacToePublicState = {
      board: createEmptyBoard(),
      scores: { X: 0, O: 0, draws: 0 },
      moveCount: 0,
    };
    return state as unknown as Record<string, unknown>;
  },

  // ── Move Validation ─────────────────────────────────────────────────

  validateMove(
    publicState: Record<string, unknown>,
    _privateStateByPlayer: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult {
    const state = publicState as unknown as TicTacToePublicState;
    const { row, col } = movePayload as { row: number; col: number };

    // Validate coordinates
    if (
      typeof row !== "number" ||
      typeof col !== "number" ||
      row < 0 ||
      row >= BOARD_SIZE ||
      col < 0 ||
      col >= BOARD_SIZE
    ) {
      return { ok: false, error: "Invalid cell coordinates." };
    }

    // Cell must be empty
    if (state.board[row][col] !== null) {
      return { ok: false, error: "Cell is already occupied." };
    }

    // Apply move
    const newBoard = cloneBoard(state.board);
    const symbol = getPlayerSymbol(ctx.currentTurnIndex);
    newBoard[row][col] = symbol;

    const newState: TicTacToePublicState = {
      board: newBoard,
      scores: { ...state.scores },
      moveCount: state.moveCount + 1,
    };

    // Check for win
    const winResult = checkWinner(newBoard);
    if (winResult) {
      // Update score
      if (winResult.winner === "X") newState.scores.X += 1;
      else newState.scores.O += 1;

      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: {
          type: "win",
          winnerIds: [ctx.uid],
        },
      };
    }

    // Check for draw
    if (isBoardFull(newBoard)) {
      newState.scores.draws += 1;
      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: {
          type: "draw",
        },
      };
    }

    // Game continues — advance turn
    return {
      ok: true,
      nextPublicState: newState as unknown as Record<string, unknown>,
      turnAdvance: true,
    };
  },

  // ── Summary ─────────────────────────────────────────────────────────

  computeSummary(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; displayName: string }>,
    currentTurnPlayerId: string | null,
  ) {
    const state = publicState as unknown as TicTacToePublicState;
    return {
      turnPlayerId: currentTurnPlayerId,
      scoreSummary: players.map((p, i) => ({
        uid: p.uid,
        displayName: p.displayName,
        score: i === 0 ? state.scores.X : state.scores.O,
      })),
    };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = publicState as unknown as TicTacToePublicState;
    const winResult = checkWinner(state.board);

    if (winResult) {
      const winSymbol = winResult.winner;
      const winnerSlot = winSymbol === "X" ? 0 : 1;
      const winnerId =
        players.find((p) => p.slotIndex === winnerSlot)?.uid ?? "";
      const loserId =
        players.find((p) => p.slotIndex !== winnerSlot)?.uid ?? "";

      return {
        winnerIds: [winnerId],
        finalScoreboard: [
          {
            uid: winnerId,
            score: 1,
            placement: 1,
            stats: { symbol: winSymbol },
          },
          {
            uid: loserId,
            score: 0,
            placement: 2,
            stats: { symbol: winSymbol === "X" ? "O" : "X" },
          },
        ],
      };
    }

    // Draw
    return {
      winnerIds: [],
      finalScoreboard: players.map((p) => ({
        uid: p.uid,
        score: 0,
        placement: 1,
        stats: { symbol: getPlayerSymbol(p.slotIndex) },
      })),
    };
  },

  // ── Performance ─────────────────────────────────────────────────────

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    _players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as TicTacToePublicState;
    return {
      totalMoves: state.moveCount,
    };
  },
};

// Auto-register on import
registerAdapter(ticTacToeAdapter);

export default ticTacToeAdapter;
