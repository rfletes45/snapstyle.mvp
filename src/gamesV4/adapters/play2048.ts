/**
 * Games V4 — 2048 (Solo) Adapter
 *
 * Pure, deterministic game logic for 2048.
 * Solo game — no multiplayer turn order, no opponent.
 *
 * Board: 4×4 grid, cells are 0 (empty) or powers of 2.
 * Moves: "up" | "down" | "left" | "right"
 * Win: any tile reaches 2048 (game can continue after winning).
 * Game over: no valid moves remain.
 *
 * @module gamesV4/adapters/play2048
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

type Direction = "up" | "down" | "left" | "right";
type Board = number[][];

interface Play2048PublicState {
  board: Board;
  score: number;
  bestTile: number;
  moveCount: number;
  mergeCount: number;
  hasWon: boolean;
  gameOver: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const GRID_SIZE = 4;
const WIN_TILE = 2048;

// =============================================================================
// Pure Logic Helpers
// =============================================================================

function createEmptyBoard(): Board {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => 0),
  );
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

/**
 * Deterministic seeded random for server-side tile spawning.
 * Uses a simple LCG (xorshift) seeded from moveCount.
 */
function getNewTileValue(moveCount: number): number {
  // 90% chance of 2, 10% chance of 4
  // Use moveCount as simple determinism key
  return moveCount % 10 === 7 ? 4 : 2;
}

/**
 * Find all empty cell positions.
 */
function getEmptyCells(board: Board): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

/**
 * Place a tile deterministically based on move count.
 * Returns a new board (does not mutate).
 */
function placeNewTile(board: Board, moveCount: number): Board {
  const newBoard = cloneBoard(board);
  const empty = getEmptyCells(newBoard);
  if (empty.length === 0) return newBoard;

  // Deterministic cell selection based on move count
  const idx = moveCount % empty.length;
  const [r, c] = empty[idx];
  newBoard[r][c] = getNewTileValue(moveCount);
  return newBoard;
}

/**
 * Slide a single row to the left, merging equal adjacent tiles.
 * Returns { row, score, merges }.
 */
function slideRowLeft(row: number[]): {
  row: number[];
  score: number;
  merges: number;
} {
  // Compact: remove zeros
  const compacted = row.filter((v) => v !== 0);
  const result: number[] = [];
  let score = 0;
  let merges = 0;
  let i = 0;

  while (i < compacted.length) {
    if (i + 1 < compacted.length && compacted[i] === compacted[i + 1]) {
      const merged = compacted[i] * 2;
      result.push(merged);
      score += merged;
      merges++;
      i += 2;
    } else {
      result.push(compacted[i]);
      i++;
    }
  }

  // Pad with zeros
  while (result.length < GRID_SIZE) {
    result.push(0);
  }

  return { row: result, score, merges };
}

/**
 * Execute a move direction on the board.
 * Returns { newBoard, score, mergeCount, moved }.
 */
function executeMove(
  board: Board,
  direction: Direction,
): { newBoard: Board; score: number; mergeCount: number; moved: boolean } {
  let totalScore = 0;
  let totalMerges = 0;
  const newBoard = cloneBoard(board);

  switch (direction) {
    case "left":
      for (let r = 0; r < GRID_SIZE; r++) {
        const { row, score, merges } = slideRowLeft(newBoard[r]);
        newBoard[r] = row;
        totalScore += score;
        totalMerges += merges;
      }
      break;

    case "right":
      for (let r = 0; r < GRID_SIZE; r++) {
        const reversed = [...newBoard[r]].reverse();
        const { row, score, merges } = slideRowLeft(reversed);
        newBoard[r] = row.reverse();
        totalScore += score;
        totalMerges += merges;
      }
      break;

    case "up":
      for (let c = 0; c < GRID_SIZE; c++) {
        const col = Array.from({ length: GRID_SIZE }, (_, r) => newBoard[r][c]);
        const { row, score, merges } = slideRowLeft(col);
        for (let r = 0; r < GRID_SIZE; r++) newBoard[r][c] = row[r];
        totalScore += score;
        totalMerges += merges;
      }
      break;

    case "down":
      for (let c = 0; c < GRID_SIZE; c++) {
        const col = Array.from(
          { length: GRID_SIZE },
          (_, r) => newBoard[r][c],
        ).reverse();
        const { row, score, merges } = slideRowLeft(col);
        const reversed = row.reverse();
        for (let r = 0; r < GRID_SIZE; r++) newBoard[r][c] = reversed[r];
        totalScore += score;
        totalMerges += merges;
      }
      break;
  }

  // Check if board changed
  const moved = !boardsEqual(board, newBoard);

  return { newBoard, score: totalScore, mergeCount: totalMerges, moved };
}

function boardsEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

function getBestTile(board: Board): number {
  let best = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell > best) best = cell;
    }
  }
  return best;
}

/**
 * Check if any moves are possible.
 */
function canMove(board: Board): boolean {
  // Check for empty cells
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) return true;
    }
  }

  // Check for adjacent equal tiles
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = board[r][c];
      if (c + 1 < GRID_SIZE && board[r][c + 1] === val) return true;
      if (r + 1 < GRID_SIZE && board[r + 1][c] === val) return true;
    }
  }

  return false;
}

// =============================================================================
// Adapter Implementation
// =============================================================================

const play2048Adapter: GameAdapterV4 = {
  gameId: "play_2048",
  runtimeType: "solo",
  maxPlayers: 1,
  minPlayers: 1,
  supportsSpectate: false,
  spectateMode: "public_only",

  scoreboardDescriptor: {
    title: "FINAL SCORE",
    formatScore: (s) => s.toLocaleString(),
    sortDirection: "desc",
  },

  settingsSchema: [],
  defaultSettings: {},

  // ── State Creation ──────────────────────────────────────────────────

  createInitialPublicState(
    _players: Array<{ uid: string; slotIndex: number }>,
    _settings: Record<string, unknown>,
  ): Record<string, unknown> {
    // Start with 2 random tiles
    let board = createEmptyBoard();
    board = placeNewTile(board, 0);
    board = placeNewTile(board, 1);

    const state: Play2048PublicState = {
      board,
      score: 0,
      bestTile: getBestTile(board),
      moveCount: 0,
      mergeCount: 0,
      hasWon: false,
      gameOver: false,
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
    const state = publicState as unknown as Play2048PublicState;
    const { direction } = movePayload as { direction: Direction };

    // Validate direction
    if (!["up", "down", "left", "right"].includes(direction)) {
      return { ok: false, error: "Invalid direction." };
    }

    // Game already over
    if (state.gameOver) {
      return { ok: false, error: "Game is over." };
    }

    // Execute move
    const { newBoard, score, mergeCount, moved } = executeMove(
      state.board,
      direction,
    );

    if (!moved) {
      return { ok: false, error: "Move has no effect." };
    }

    // Place new tile after the move
    const boardWithNewTile = placeNewTile(newBoard, state.moveCount + 1);
    const bestTile = getBestTile(boardWithNewTile);
    const hasWon = state.hasWon || bestTile >= WIN_TILE;
    const gameOver = !canMove(boardWithNewTile);

    const newState: Play2048PublicState = {
      board: boardWithNewTile,
      score: state.score + score,
      bestTile,
      moveCount: state.moveCount + 1,
      mergeCount: state.mergeCount + mergeCount,
      hasWon,
      gameOver,
    };

    // Terminal if game over
    if (gameOver) {
      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        scoreDelta: [{ uid: ctx.uid, delta: score }],
        turnAdvance: false,
        terminal: {
          type: hasWon ? "win" : "timeout", // "timeout" = no moves left
          winnerIds: hasWon ? [ctx.uid] : [],
          reason: hasWon ? "Reached 2048!" : "No moves remaining",
        },
      };
    }

    // Game continues — solo games don't advance turns
    return {
      ok: true,
      nextPublicState: newState as unknown as Record<string, unknown>,
      scoreDelta: [{ uid: ctx.uid, delta: score }],
      turnAdvance: false, // Solo: same player always
    };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = publicState as unknown as Play2048PublicState;
    const uid = players[0]?.uid ?? "";

    return {
      winnerIds: state.hasWon ? [uid] : [],
      finalScoreboard: [
        {
          uid,
          score: state.score,
          placement: 1,
          stats: {
            bestTile: state.bestTile,
            moveCount: state.moveCount,
            mergeCount: state.mergeCount,
          },
        },
      ],
    };
  },

  // ── Performance ─────────────────────────────────────────────────────

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    _players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as Play2048PublicState;
    return {
      score: state.score,
      bestTile: state.bestTile,
      moveCount: state.moveCount,
      mergeCount: state.mergeCount,
      hasWon: state.hasWon,
    };
  },
};

// Auto-register on import
registerAdapter(play2048Adapter);

export default play2048Adapter;
