/**
 * Minesweeper — Pure Game Engine
 *
 * Deterministic, side-effect-free Minesweeper logic.
 * Shared between client adapter and server adapter.
 *
 * Key design decisions:
 * - Board stored as flat arrays for efficient serialization
 * - Seeded PRNG for deterministic mine placement
 * - First-click safety: mines placed after first reveal, excluding clicked cell + neighbors
 * - All functions are pure: take state in, return new state out
 *
 * @module gamesV4/games/minesweeper/engine
 */

import type {
  CellState,
  CellValue,
  MinesweeperDifficulty,
  MinesweeperPublicState,
} from "./types";
import { DIFFICULTY_PRESETS } from "./types";

// =============================================================================
// Seeded PRNG — Mulberry32 (32-bit state, uniform distribution)
// =============================================================================

/**
 * Create a seeded PRNG using the Mulberry32 algorithm.
 * Returns a function that produces a new random number [0, 1) each call.
 */
export function createRNG(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using a seeded RNG.
 */
function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// =============================================================================
// Board Helpers
// =============================================================================

/** Convert (row, col) to flat index */
export function toIndex(row: number, col: number, cols: number): number {
  return row * cols + col;
}

/** Convert flat index to (row, col) */
export function fromIndex(idx: number, cols: number): [number, number] {
  return [Math.floor(idx / cols), idx % cols];
}

/** Get all valid neighbor indices for a cell */
export function getNeighbors(
  idx: number,
  rows: number,
  cols: number,
): number[] {
  const [row, col] = fromIndex(idx, cols);
  const neighbors: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        neighbors.push(toIndex(nr, nc, cols));
      }
    }
  }
  return neighbors;
}

// =============================================================================
// Board Generation
// =============================================================================

/**
 * Generate the mine layout deterministically from seed, dimensions, mine count,
 * and the first-clicked cell. The first-clicked cell and its immediate neighbors
 * are guaranteed safe.
 *
 * Returns the board array (flat) with mine placements and adjacency counts.
 */
export function generateBoard(
  rows: number,
  cols: number,
  mineCount: number,
  seed: number,
  firstClickIdx: number,
): CellValue[] {
  const totalCells = rows * cols;
  const board: CellValue[] = new Array(totalCells).fill(0);

  // Cells excluded from mine placement: first click + neighbors
  const excluded = new Set<number>([firstClickIdx]);
  for (const n of getNeighbors(firstClickIdx, rows, cols)) {
    excluded.add(n);
  }

  // Build candidate positions (all cells except excluded)
  const candidates: number[] = [];
  for (let i = 0; i < totalCells; i++) {
    if (!excluded.has(i)) {
      candidates.push(i);
    }
  }

  // Shuffle candidates and pick first `mineCount` positions
  const rng = createRNG(seed);
  const shuffled = shuffleArray(candidates, rng);
  const minesToPlace = Math.min(mineCount, shuffled.length);

  for (let i = 0; i < minesToPlace; i++) {
    board[shuffled[i]] = -1;
  }

  // Compute adjacency counts for non-mine cells
  for (let i = 0; i < totalCells; i++) {
    if (board[i] === -1) continue;
    let count = 0;
    for (const n of getNeighbors(i, rows, cols)) {
      if (board[n] === -1) count++;
    }
    board[i] = count as CellValue;
  }

  return board;
}

// =============================================================================
// State Creation
// =============================================================================

/**
 * Create the initial public state for a new Minesweeper game.
 */
export function createInitialState(
  difficulty: MinesweeperDifficulty = "easy",
  seed?: number,
): MinesweeperPublicState {
  const preset = DIFFICULTY_PRESETS[difficulty];
  const totalCells = preset.rows * preset.cols;
  const gameSeed = seed ?? Math.floor(Math.random() * 2147483647);

  return {
    difficulty: preset.difficulty,
    cols: preset.cols,
    rows: preset.rows,
    mineCount: preset.mineCount,
    seed: gameSeed,
    boardGenerated: false,
    board: new Array(totalCells).fill(0),
    cellStates: new Array(totalCells).fill("hidden") as CellState[],
    status: "idle",
    revealedCount: 0,
    totalSafeCells: totalCells - preset.mineCount,
    flagCount: 0,
    explodedCell: -1,
    startedAtMs: 0,
    elapsedMs: 0,
    moveCount: 0,
    chordCount: 0,
    floodCount: 0,
  };
}

// =============================================================================
// Reveal Logic
// =============================================================================

export interface RevealResult {
  state: MinesweeperPublicState;
  /** Whether the reveal caused a loss */
  hitMine: boolean;
  /** Number of cells newly revealed */
  cellsRevealed: number;
}

/**
 * Reveal a single cell. If it's a zero, flood-fill all connected zeros and their borders.
 * If it's a mine, game over.
 *
 * Returns the new state plus metadata about what happened.
 */
export function revealCell(
  state: MinesweeperPublicState,
  cellIdx: number,
  nowMs: number,
): RevealResult {
  // Validate cell index
  if (cellIdx < 0 || cellIdx >= state.rows * state.cols) {
    return { state, hitMine: false, cellsRevealed: 0 };
  }

  // Can't reveal if game is over
  if (state.status === "won" || state.status === "lost") {
    return { state, hitMine: false, cellsRevealed: 0 };
  }

  // Can't reveal flagged or already-revealed cells
  if (state.cellStates[cellIdx] !== "hidden") {
    return { state, hitMine: false, cellsRevealed: 0 };
  }

  // Clone state for immutability
  let newState = cloneState(state);

  // First click: generate board and start timer
  if (!newState.boardGenerated) {
    newState.board = generateBoard(
      newState.rows,
      newState.cols,
      newState.mineCount,
      newState.seed,
      cellIdx,
    );
    newState.boardGenerated = true;
    newState.status = "active";
    newState.startedAtMs = nowMs;
  }

  newState.moveCount++;

  // Check if mine
  if (newState.board[cellIdx] === -1) {
    // BOOM — game over
    newState.cellStates[cellIdx] = "revealed";
    newState.explodedCell = cellIdx;
    newState.status = "lost";
    newState.elapsedMs = nowMs - newState.startedAtMs;

    // Reveal all mines and mark incorrect flags
    // (incorrect flags are left as "flagged" — the UI will check board[i] !== -1)
    for (let i = 0; i < newState.board.length; i++) {
      if (newState.board[i] === -1 && newState.cellStates[i] === "hidden") {
        newState.cellStates[i] = "revealed";
      }
    }

    return { state: newState, hitMine: true, cellsRevealed: 1 };
  }

  // Reveal cell (and flood-fill if zero)
  let cellsRevealed = 0;
  if (newState.board[cellIdx] === 0) {
    // Flood fill
    const floodResult = floodFill(newState, cellIdx);
    newState = floodResult.state;
    cellsRevealed = floodResult.revealed;
    newState.floodCount += cellsRevealed;
  } else {
    // Reveal single numbered cell
    newState.cellStates[cellIdx] = "revealed";
    newState.revealedCount++;
    cellsRevealed = 1;
  }

  // Check win condition
  if (newState.revealedCount >= newState.totalSafeCells) {
    newState.status = "won";
    newState.elapsedMs = nowMs - newState.startedAtMs;
    // Auto-flag remaining mines
    for (let i = 0; i < newState.board.length; i++) {
      if (newState.board[i] === -1 && newState.cellStates[i] !== "flagged") {
        newState.cellStates[i] = "flagged";
        newState.flagCount++;
      }
    }
  }

  return { state: newState, hitMine: false, cellsRevealed };
}

/**
 * Flood fill from a zero cell, revealing all connected zeros and their numbered borders.
 */
function floodFill(
  state: MinesweeperPublicState,
  startIdx: number,
): { state: MinesweeperPublicState; revealed: number } {
  const newState = state; // Already cloned by caller
  const queue: number[] = [startIdx];
  const visited = new Set<number>();
  let revealed = 0;

  while (queue.length > 0) {
    const idx = queue.shift()!;
    if (visited.has(idx)) continue;
    visited.add(idx);

    if (newState.cellStates[idx] !== "hidden") continue;

    newState.cellStates[idx] = "revealed";
    newState.revealedCount++;
    revealed++;

    // If this cell is zero, add all neighbors to queue
    if (newState.board[idx] === 0) {
      const neighbors = getNeighbors(idx, newState.rows, newState.cols);
      for (const n of neighbors) {
        if (!visited.has(n) && newState.cellStates[n] === "hidden") {
          queue.push(n);
        }
      }
    }
  }

  return { state: newState, revealed };
}

// =============================================================================
// Flag Logic
// =============================================================================

/**
 * Toggle flag on a cell. Returns the new state.
 */
export function toggleFlag(
  state: MinesweeperPublicState,
  cellIdx: number,
): MinesweeperPublicState {
  if (cellIdx < 0 || cellIdx >= state.rows * state.cols) return state;
  if (state.status === "won" || state.status === "lost") return state;

  const cellState = state.cellStates[cellIdx];
  if (cellState === "revealed") return state;

  const newState = cloneState(state);
  newState.moveCount++;

  if (cellState === "flagged") {
    newState.cellStates[cellIdx] = "hidden";
    newState.flagCount--;
  } else {
    newState.cellStates[cellIdx] = "flagged";
    newState.flagCount++;
  }

  // Start timer on first interaction if not started
  if (newState.status === "idle") {
    // Don't start on flag alone — keep idle
  }

  return newState;
}

// =============================================================================
// Chord Reveal
// =============================================================================

export interface ChordResult {
  state: MinesweeperPublicState;
  hitMine: boolean;
  cellsRevealed: number;
}

/**
 * Chord reveal: if a revealed numbered cell's adjacent flag count matches its number,
 * reveal all hidden (non-flagged) neighbors.
 *
 * If any of those neighbors is a mine (incorrect flag elsewhere), it's a loss.
 */
export function chordReveal(
  state: MinesweeperPublicState,
  cellIdx: number,
  nowMs: number,
): ChordResult {
  if (cellIdx < 0 || cellIdx >= state.rows * state.cols) {
    return { state, hitMine: false, cellsRevealed: 0 };
  }

  if (state.status !== "active") {
    return { state, hitMine: false, cellsRevealed: 0 };
  }

  // Cell must be revealed and numbered
  if (state.cellStates[cellIdx] !== "revealed") {
    return { state, hitMine: false, cellsRevealed: 0 };
  }

  const cellValue = state.board[cellIdx];
  if (cellValue <= 0) {
    return { state, hitMine: false, cellsRevealed: 0 };
  }

  const neighbors = getNeighbors(cellIdx, state.rows, state.cols);

  // Count adjacent flags
  let adjFlags = 0;
  for (const n of neighbors) {
    if (state.cellStates[n] === "flagged") adjFlags++;
  }

  // Flags must match the number
  if (adjFlags !== cellValue) {
    return { state, hitMine: false, cellsRevealed: 0 };
  }

  let newState = cloneState(state);
  newState.moveCount++;
  newState.chordCount++;

  let totalRevealed = 0;
  let hitMine = false;

  // Reveal all hidden (non-flagged) neighbors
  for (const n of neighbors) {
    if (newState.cellStates[n] !== "hidden") continue;

    if (newState.board[n] === -1) {
      // Hit a mine — bad flag placement elsewhere
      newState.cellStates[n] = "revealed";
      newState.explodedCell = n;
      newState.status = "lost";
      newState.elapsedMs = nowMs - newState.startedAtMs;
      hitMine = true;

      // Reveal all mines
      for (let i = 0; i < newState.board.length; i++) {
        if (newState.board[i] === -1 && newState.cellStates[i] === "hidden") {
          newState.cellStates[i] = "revealed";
        }
      }
      return {
        state: newState,
        hitMine: true,
        cellsRevealed: totalRevealed + 1,
      };
    }

    if (newState.board[n] === 0) {
      const floodResult = floodFill(newState, n);
      newState = floodResult.state;
      totalRevealed += floodResult.revealed;
      newState.floodCount += floodResult.revealed;
    } else {
      newState.cellStates[n] = "revealed";
      newState.revealedCount++;
      totalRevealed++;
    }
  }

  // Check win
  if (newState.revealedCount >= newState.totalSafeCells) {
    newState.status = "won";
    newState.elapsedMs = nowMs - newState.startedAtMs;
    for (let i = 0; i < newState.board.length; i++) {
      if (newState.board[i] === -1 && newState.cellStates[i] !== "flagged") {
        newState.cellStates[i] = "flagged";
        newState.flagCount++;
      }
    }
  }

  return { state: newState, hitMine, cellsRevealed: totalRevealed };
}

// =============================================================================
// Incorrect Flags Detection
// =============================================================================

/**
 * Get indices of incorrectly flagged cells (flagged but not a mine).
 * Used on loss to display wrong flags.
 */
export function getIncorrectFlags(state: MinesweeperPublicState): number[] {
  const incorrect: number[] = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.cellStates[i] === "flagged" && state.board[i] !== -1) {
      incorrect.push(i);
    }
  }
  return incorrect;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Deep-clone the public state (flat arrays are cheap to spread).
 */
function cloneState(state: MinesweeperPublicState): MinesweeperPublicState {
  return {
    ...state,
    board: [...state.board],
    cellStates: [...state.cellStates],
  };
}

/**
 * Get the remaining mine count for display (mines - flags placed).
 */
export function getRemainingMines(state: MinesweeperPublicState): number {
  return state.mineCount - state.flagCount;
}
