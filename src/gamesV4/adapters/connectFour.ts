/**
 * Games V4 — Connect Four Adapter
 *
 * Pure, deterministic game logic for Connect Four.
 * Shared between client (optimistic preview) and server (authoritative).
 *
 * Board: 6 rows × 7 columns, cells are 0 (empty), 1 (P1/Red), 2 (P2/Yellow).
 * Players: exactly 2 — player 0 is P1/Red, player 1 is P2/Yellow.
 *
 * @module gamesV4/adapters/connectFour
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

type CellState = 0 | 1 | 2;
type Board = CellState[][];

interface ConnectFourPublicState {
  board: Board;
  moveCount: number;
  lastMove: { row: number; col: number } | null;
}

// =============================================================================
// Constants
// =============================================================================

const ROWS = 6;
const COLS = 7;
const WIN_LENGTH = 4;

// =============================================================================
// Pure Logic Helpers
// =============================================================================

function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 0 as CellState),
  );
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function getPlayerPiece(slotIndex: number): CellState {
  return (slotIndex + 1) as CellState; // 1 or 2
}

/**
 * Drop a piece in a column. Returns the row it landed in, or -1 if full.
 */
function findDropRow(board: Board, col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === 0) return row;
  }
  return -1;
}

/**
 * Check if a player has won.
 */
function checkWin(board: Board, player: CellState): boolean {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - WIN_LENGTH; c++) {
      if (
        board[r][c] === player &&
        board[r][c + 1] === player &&
        board[r][c + 2] === player &&
        board[r][c + 3] === player
      ) {
        return true;
      }
    }
  }

  // Vertical
  for (let r = 0; r <= ROWS - WIN_LENGTH; r++) {
    for (let c = 0; c < COLS; c++) {
      if (
        board[r][c] === player &&
        board[r + 1][c] === player &&
        board[r + 2][c] === player &&
        board[r + 3][c] === player
      ) {
        return true;
      }
    }
  }

  // Diagonal ↘
  for (let r = 0; r <= ROWS - WIN_LENGTH; r++) {
    for (let c = 0; c <= COLS - WIN_LENGTH; c++) {
      if (
        board[r][c] === player &&
        board[r + 1][c + 1] === player &&
        board[r + 2][c + 2] === player &&
        board[r + 3][c + 3] === player
      ) {
        return true;
      }
    }
  }

  // Diagonal ↗
  for (let r = WIN_LENGTH - 1; r < ROWS; r++) {
    for (let c = 0; c <= COLS - WIN_LENGTH; c++) {
      if (
        board[r][c] === player &&
        board[r - 1][c + 1] === player &&
        board[r - 2][c + 2] === player &&
        board[r - 3][c + 3] === player
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if the board is full (top row all non-zero).
 */
function isBoardFull(board: Board): boolean {
  return board[0].every((cell) => cell !== 0);
}

// =============================================================================
// Adapter Implementation
// =============================================================================

const connectFourAdapter: GameAdapterV4 = {
  gameId: "connect_four",
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
    const state: ConnectFourPublicState = {
      board: createEmptyBoard(),
      moveCount: 0,
      lastMove: null,
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
    const state = publicState as unknown as ConnectFourPublicState;
    const { col } = movePayload as { col: number };

    // Validate column
    if (typeof col !== "number" || col < 0 || col >= COLS) {
      return { ok: false, error: "Invalid column." };
    }

    // Find landing row
    const landingRow = findDropRow(state.board, col);
    if (landingRow === -1) {
      return { ok: false, error: "Column is full." };
    }

    // Apply move
    const newBoard = cloneBoard(state.board);
    const piece = getPlayerPiece(ctx.currentTurnIndex);
    newBoard[landingRow][col] = piece;

    const newState: ConnectFourPublicState = {
      board: newBoard,
      moveCount: state.moveCount + 1,
      lastMove: { row: landingRow, col },
    };

    // Check for win
    if (checkWin(newBoard, piece)) {
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
      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: {
          type: "draw",
        },
      };
    }

    // Game continues
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
    const state = publicState as unknown as ConnectFourPublicState;
    return {
      turnPlayerId: currentTurnPlayerId,
      scoreSummary: players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        score: 0, // Connect Four doesn't have running scores
      })),
    };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = publicState as unknown as ConnectFourPublicState;

    // Check each player for a win
    for (const p of players) {
      const piece = getPlayerPiece(p.slotIndex);
      if (checkWin(state.board, piece)) {
        const loserId = players.find((op) => op.uid !== p.uid)?.uid ?? "";
        return {
          winnerIds: [p.uid],
          finalScoreboard: [
            { uid: p.uid, score: 1, placement: 1, stats: { piece } },
            {
              uid: loserId,
              score: 0,
              placement: 2,
              stats: { piece: getPlayerPiece(1 - p.slotIndex) },
            },
          ],
        };
      }
    }

    // Draw
    return {
      winnerIds: [],
      finalScoreboard: players.map((p) => ({
        uid: p.uid,
        score: 0,
        placement: 1,
        stats: { piece: getPlayerPiece(p.slotIndex) },
      })),
    };
  },

  // ── Performance ─────────────────────────────────────────────────────

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    _players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as ConnectFourPublicState;
    return {
      totalMoves: state.moveCount,
    };
  },
};

// Auto-register on import
registerAdapter(connectFourAdapter);

export default connectFourAdapter;
