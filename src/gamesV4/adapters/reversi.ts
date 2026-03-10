/**
 * Games V4 — Reversi / Othello Adapter
 *
 * Pure, deterministic game logic for Reversi on an 8×8 board.
 * Shared between client (optimistic preview) and server (authoritative).
 *
 * Board cells: "B" (black), "W" (white), or null (empty).
 * Players: exactly 2 — slot 0 = Black (moves first), slot 1 = White.
 *
 * Pass turn: if the current player has zero legal moves they MUST pass.
 * Game ends: board full OR neither player can move.
 * Winner: player with more discs (draw if equal).
 *
 * @module gamesV4/adapters/reversi
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

type Disc = "B" | "W" | null;
type Board = Disc[][];

interface ReversiPublicState {
  board: Board;
  blackUid: string;
  whiteUid: string;
  currentColor: "B" | "W";
  legalMoves: Array<[number, number]>;
  blackCount: number;
  whiteCount: number;
  consecutivePasses: number;
  turnNumber: number;
  lastMove:
    | { type: "place"; row: number; col: number }
    | { type: "pass" }
    | null;
  lastAction: "place" | "pass" | null;
  gamePhase: "playing" | "finished";
}

// =============================================================================
// Constants
// =============================================================================

const SIZE = 8;

const DIRECTIONS: ReadonlyArray<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

// =============================================================================
// Pure Logic Helpers
// =============================================================================

function createEmptyBoard(): Board {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null),
  );
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function opponent(color: Disc & string): "B" | "W" {
  return color === "B" ? "W" : "B";
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

/**
 * Compute flips for placing `color` at (row, col).
 * Returns list of coordinates to flip, or empty if invalid.
 */
function computeFlips(
  board: Board,
  row: number,
  col: number,
  color: "B" | "W",
): Array<[number, number]> {
  if (board[row][col] !== null) return [];
  const opp = opponent(color);
  const allFlips: Array<[number, number]> = [];

  for (const [dr, dc] of DIRECTIONS) {
    const lineFlips: Array<[number, number]> = [];
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[r][c] === opp) {
      lineFlips.push([r, c]);
      r += dr;
      c += dc;
    }
    if (lineFlips.length > 0 && inBounds(r, c) && board[r][c] === color) {
      allFlips.push(...lineFlips);
    }
  }
  return allFlips;
}

/**
 * Get all legal moves for `color` on the given board.
 */
function getLegalMoves(
  board: Board,
  color: "B" | "W",
): Array<[number, number]> {
  const moves: Array<[number, number]> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === null && computeFlips(board, r, c, color).length > 0) {
        moves.push([r, c]);
      }
    }
  }
  return moves;
}

/**
 * Count discs on the board.
 */
function countDiscs(board: Board): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === "B") black++;
      else if (board[r][c] === "W") white++;
    }
  }
  return { black, white };
}

/**
 * Check if the board is full.
 */
function isBoardFull(board: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === null) return false;
    }
  }
  return true;
}

/**
 * Count how many corners a color owns.
 */
function countCorners(board: Board, color: "B" | "W"): number {
  const corners: Array<[number, number]> = [
    [0, 0],
    [0, 7],
    [7, 0],
    [7, 7],
  ];
  return corners.filter(([r, c]) => board[r][c] === color).length;
}

/**
 * Create the standard starting position.
 */
function createInitialBoard(): Board {
  const board = createEmptyBoard();
  board[3][3] = "W";
  board[3][4] = "B";
  board[4][3] = "B";
  board[4][4] = "W";
  return board;
}

// =============================================================================
// Adapter Implementation
// =============================================================================

const reversiAdapter: GameAdapterV4 = {
  gameId: "reversi",
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
    players: Array<{ uid: string; slotIndex: number }>,
    _settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const blackPlayer = players.find((p) => p.slotIndex === 0)!;
    const whitePlayer = players.find((p) => p.slotIndex === 1)!;
    const board = createInitialBoard();
    const legalMoves = getLegalMoves(board, "B");

    const state: ReversiPublicState = {
      board,
      blackUid: blackPlayer.uid,
      whiteUid: whitePlayer.uid,
      currentColor: "B",
      legalMoves,
      blackCount: 2,
      whiteCount: 2,
      consecutivePasses: 0,
      turnNumber: 1,
      lastMove: null,
      lastAction: null,
      gamePhase: "playing",
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
    const state = publicState as unknown as ReversiPublicState;
    const moveType = movePayload.type as string;
    const playerColor: "B" | "W" = ctx.currentTurnIndex === 0 ? "B" : "W";

    // ── Pass move ─────────────────────
    if (moveType === "pass") {
      // Can only pass when there are no legal placement moves
      if (state.legalMoves.length > 0) {
        return { ok: false, error: "You have legal moves — cannot pass." };
      }

      const newBoard = cloneBoard(state.board);
      const nextColor = opponent(playerColor);
      const newConsecutivePasses = state.consecutivePasses + 1;

      // Check if game ends (both players passed)
      if (newConsecutivePasses >= 2) {
        const counts = countDiscs(newBoard);
        const newState: ReversiPublicState = {
          ...state,
          board: newBoard,
          currentColor: nextColor,
          legalMoves: [],
          blackCount: counts.black,
          whiteCount: counts.white,
          consecutivePasses: newConsecutivePasses,
          turnNumber: state.turnNumber + 1,
          lastMove: { type: "pass" },
          lastAction: "pass",
          gamePhase: "finished",
        };

        const terminal = resolveTerminal(newState, ctx);
        return {
          ok: true,
          nextPublicState: newState as unknown as Record<string, unknown>,
          turnAdvance: false,
          terminal,
        };
      }

      // Game continues — opponent's turn
      const nextMoves = getLegalMoves(newBoard, nextColor);
      const newState: ReversiPublicState = {
        ...state,
        board: newBoard,
        currentColor: nextColor,
        legalMoves: nextMoves,
        consecutivePasses: newConsecutivePasses,
        turnNumber: state.turnNumber + 1,
        lastMove: { type: "pass" },
        lastAction: "pass",
        gamePhase: "playing",
      };

      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        turnAdvance: true,
      };
    }

    // ── Place move ────────────────────
    if (moveType === "place") {
      const row = movePayload.row as number;
      const col = movePayload.col as number;

      if (
        typeof row !== "number" ||
        typeof col !== "number" ||
        row < 0 ||
        row >= SIZE ||
        col < 0 ||
        col >= SIZE
      ) {
        return { ok: false, error: "Invalid coordinates." };
      }

      if (state.board[row][col] !== null) {
        return { ok: false, error: "Cell is not empty." };
      }

      const flips = computeFlips(state.board, row, col, playerColor);
      if (flips.length === 0) {
        return {
          ok: false,
          error: "Illegal move — must flip at least one disc.",
        };
      }

      // Apply move
      const newBoard = cloneBoard(state.board);
      newBoard[row][col] = playerColor;
      for (const [fr, fc] of flips) {
        newBoard[fr][fc] = playerColor;
      }

      const counts = countDiscs(newBoard);
      const nextColor = opponent(playerColor);
      const nextMoves = getLegalMoves(newBoard, nextColor);
      const boardFull = isBoardFull(newBoard);

      // Check terminal: board full or next player has no moves AND current player also can't move
      const currentCanMoveAfter = getLegalMoves(newBoard, playerColor);
      const isTerminal =
        boardFull ||
        (nextMoves.length === 0 && currentCanMoveAfter.length === 0);

      const newState: ReversiPublicState = {
        ...state,
        board: newBoard,
        currentColor: nextColor,
        legalMoves: isTerminal ? [] : nextMoves,
        blackCount: counts.black,
        whiteCount: counts.white,
        consecutivePasses: 0,
        turnNumber: state.turnNumber + 1,
        lastMove: { type: "place", row, col },
        lastAction: "place",
        gamePhase: isTerminal ? "finished" : "playing",
      };

      if (isTerminal) {
        const terminal = resolveTerminal(newState, ctx);
        return {
          ok: true,
          nextPublicState: newState as unknown as Record<string, unknown>,
          turnAdvance: false,
          terminal,
        };
      }

      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        turnAdvance: true,
      };
    }

    return { ok: false, error: `Unknown move type: ${moveType}` };
  },

  // ── Summary ─────────────────────────────────────────────────────────

  computeSummary(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; displayName: string }>,
    currentTurnPlayerId: string | null,
  ) {
    const state = publicState as unknown as ReversiPublicState;
    return {
      turnPlayerId: currentTurnPlayerId,
      scoreSummary: players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        score: p.uid === state.blackUid ? state.blackCount : state.whiteCount,
      })),
    };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = publicState as unknown as ReversiPublicState;
    const { blackCount, whiteCount } = state;

    const blackPlayer = players.find((p) => p.slotIndex === 0)!;
    const whitePlayer = players.find((p) => p.slotIndex === 1)!;

    const cornersBlack = countCorners(state.board, "B");
    const cornersWhite = countCorners(state.board, "W");

    if (blackCount > whiteCount) {
      return {
        winnerIds: [blackPlayer.uid],
        finalScoreboard: [
          {
            uid: blackPlayer.uid,
            score: 1,
            placement: 1,
            stats: {
              color: "B",
              discCount: blackCount,
              corners: cornersBlack,
              margin: blackCount - whiteCount,
            },
          },
          {
            uid: whitePlayer.uid,
            score: 0,
            placement: 2,
            stats: {
              color: "W",
              discCount: whiteCount,
              corners: cornersWhite,
              margin: whiteCount - blackCount,
            },
          },
        ],
      };
    }

    if (whiteCount > blackCount) {
      return {
        winnerIds: [whitePlayer.uid],
        finalScoreboard: [
          {
            uid: whitePlayer.uid,
            score: 1,
            placement: 1,
            stats: {
              color: "W",
              discCount: whiteCount,
              corners: cornersWhite,
              margin: whiteCount - blackCount,
            },
          },
          {
            uid: blackPlayer.uid,
            score: 0,
            placement: 2,
            stats: {
              color: "B",
              discCount: blackCount,
              corners: cornersBlack,
              margin: blackCount - whiteCount,
            },
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
        stats: {
          color: p.slotIndex === 0 ? "B" : "W",
          discCount: p.slotIndex === 0 ? blackCount : whiteCount,
          corners: p.slotIndex === 0 ? cornersBlack : cornersWhite,
          margin: 0,
        },
      })),
    };
  },

  // ── Performance ─────────────────────────────────────────────────────

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    _players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as ReversiPublicState;
    return {
      totalMoves: state.turnNumber - 1,
      blackCount: state.blackCount,
      whiteCount: state.whiteCount,
      cornersBlack: countCorners(state.board, "B"),
      cornersWhite: countCorners(state.board, "W"),
      consecutivePasses: state.consecutivePasses,
    };
  },
};

// =============================================================================
// Helpers
// =============================================================================

function resolveTerminal(
  state: ReversiPublicState,
  ctx: { uid: string; turnOrder: string[] },
): { type: "win" | "draw"; winnerIds?: string[] } {
  const { blackCount, whiteCount } = state;

  if (blackCount > whiteCount) {
    return { type: "win", winnerIds: [state.blackUid] };
  }
  if (whiteCount > blackCount) {
    return { type: "win", winnerIds: [state.whiteUid] };
  }
  return { type: "draw" };
}

// Auto-register on import
registerAdapter(reversiAdapter);

export default reversiAdapter;
