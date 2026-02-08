/**
 * Play 2048 Game Logic
 *
 * Simple, clean implementation of 2048 game mechanics.
 * All functions are pure - no side effects.
 */

import { PLAY_2048_CONFIG, Play2048Direction } from "@/types/singlePlayerGames";

const GRID_SIZE = PLAY_2048_CONFIG.gridSize;

// =============================================================================
// Board Utilities
// =============================================================================

/**
 * Create an empty 4x4 board
 */
export function createEmptyBoard(): number[][] {
  return Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(0));
}

/**
 * Deep clone a board
 */
export function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

/**
 * Get all empty cell positions
 */
export function getEmptyCells(
  board: number[][],
): { row: number; col: number }[] {
  const empty: { row: number; col: number }[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === 0) {
        empty.push({ row, col });
      }
    }
  }
  return empty;
}

/**
 * Add a random tile (90% chance of 2, 10% chance of 4)
 */
export function addRandomTile(board: number[][]): number[][] {
  const newBoard = cloneBoard(board);
  const empty = getEmptyCells(newBoard);
  if (empty.length === 0) return newBoard;

  const { row, col } = empty[Math.floor(Math.random() * empty.length)];
  newBoard[row][col] = Math.random() < 0.9 ? 2 : 4;
  return newBoard;
}

/**
 * Get the highest tile value on the board
 */
export function getBestTile(board: number[][]): number {
  let best = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell > best) best = cell;
    }
  }
  return best;
}

/**
 * Check if two boards are equal
 */
export function boardsEqual(a: number[][], b: number[][]): boolean {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (a[row][col] !== b[row][col]) return false;
    }
  }
  return true;
}

// =============================================================================
// Game State Checks
// =============================================================================

/**
 * Check if any moves are possible
 */
export function canMove(board: number[][]): boolean {
  // Check for empty cells
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === 0) return true;
    }
  }

  // Check for adjacent equal tiles (horizontal)
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE - 1; col++) {
      if (board[row][col] === board[row][col + 1]) return true;
    }
  }

  // Check for adjacent equal tiles (vertical)
  for (let row = 0; row < GRID_SIZE - 1; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === board[row + 1][col]) return true;
    }
  }

  return false;
}

/**
 * Check if player has won (reached 2048)
 */
export function checkWin(board: number[][]): boolean {
  return getBestTile(board) >= PLAY_2048_CONFIG.winTile;
}

/**
 * Check if game is over (no moves possible)
 */
export function checkGameOver(board: number[][]): boolean {
  return !canMove(board);
}

// =============================================================================
// Move Logic
// =============================================================================

interface SlideResult {
  newRow: number[];
  score: number;
  mergeCount: number;
}

/**
 * Slide and merge a single row to the left
 */
function slideRowLeft(row: number[]): SlideResult {
  // Remove zeros (compact to left)
  const nonZero = row.filter((val) => val !== 0);

  // Merge adjacent equal tiles
  const merged: number[] = [];
  let score = 0;
  let mergeCount = 0;
  let i = 0;

  while (i < nonZero.length) {
    if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
      // Merge: double the value
      const mergedValue = nonZero[i] * 2;
      merged.push(mergedValue);
      score += mergedValue;
      mergeCount++;
      i += 2;
    } else {
      merged.push(nonZero[i]);
      i++;
    }
  }

  // Pad with zeros
  while (merged.length < GRID_SIZE) {
    merged.push(0);
  }

  return { newRow: merged, score, mergeCount };
}

/**
 * Slide and merge a single row to the right
 */
function slideRowRight(row: number[]): SlideResult {
  const reversed = [...row].reverse();
  const result = slideRowLeft(reversed);
  return {
    newRow: result.newRow.reverse(),
    score: result.score,
    mergeCount: result.mergeCount,
  };
}

interface MoveResult {
  newBoard: number[][];
  score: number;
  mergeCount: number;
  moved: boolean;
}

/**
 * Execute a move in the given direction
 */
export function executeMove(
  board: number[][],
  direction: Play2048Direction,
): MoveResult {
  const newBoard = cloneBoard(board);
  let totalScore = 0;
  let totalMerges = 0;

  if (direction === "left") {
    for (let row = 0; row < GRID_SIZE; row++) {
      const result = slideRowLeft(newBoard[row]);
      newBoard[row] = result.newRow;
      totalScore += result.score;
      totalMerges += result.mergeCount;
    }
  } else if (direction === "right") {
    for (let row = 0; row < GRID_SIZE; row++) {
      const result = slideRowRight(newBoard[row]);
      newBoard[row] = result.newRow;
      totalScore += result.score;
      totalMerges += result.mergeCount;
    }
  } else if (direction === "up") {
    for (let col = 0; col < GRID_SIZE; col++) {
      const column: number[] = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        column.push(newBoard[row][col]);
      }
      const result = slideRowLeft(column);
      for (let row = 0; row < GRID_SIZE; row++) {
        newBoard[row][col] = result.newRow[row];
      }
      totalScore += result.score;
      totalMerges += result.mergeCount;
    }
  } else if (direction === "down") {
    for (let col = 0; col < GRID_SIZE; col++) {
      const column: number[] = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        column.push(newBoard[row][col]);
      }
      const result = slideRowRight(column);
      for (let row = 0; row < GRID_SIZE; row++) {
        newBoard[row][col] = result.newRow[row];
      }
      totalScore += result.score;
      totalMerges += result.mergeCount;
    }
  }

  return {
    newBoard,
    score: totalScore,
    mergeCount: totalMerges,
    moved: !boardsEqual(board, newBoard),
  };
}

// =============================================================================
// State Management
// =============================================================================

/**
 * Simple internal state interface for 2048
 * (The screen component uses its own state management)
 */
export interface Simple2048State {
  board: number[][];
  score: number;
  bestTile: number;
  moveCount: number;
  mergeCount: number;
  hasWon: boolean;
  gameOver: boolean;
}

/**
 * Create initial game state with two random tiles
 */
export function createInitial2048State(): Simple2048State {
  let board = createEmptyBoard();
  board = addRandomTile(board);
  board = addRandomTile(board);

  return {
    board,
    score: 0,
    bestTile: getBestTile(board),
    moveCount: 0,
    mergeCount: 0,
    hasWon: false,
    gameOver: false,
  };
}

/**
 * Apply a move to the game state
 * Returns new state (or same state if move was invalid)
 */
export function applyMove(
  state: Simple2048State,
  direction: Play2048Direction,
): Simple2048State {
  if (state.gameOver) return state;

  const result = executeMove(state.board, direction);

  // Invalid move - board didn't change
  if (!result.moved) {
    return state;
  }

  // Add new random tile
  const boardWithNewTile = addRandomTile(result.newBoard);
  const bestTile = getBestTile(boardWithNewTile);
  const hasWon = state.hasWon || bestTile >= PLAY_2048_CONFIG.winTile;
  const gameOver = !canMove(boardWithNewTile);

  return {
    board: boardWithNewTile,
    score: state.score + result.score,
    bestTile,
    moveCount: state.moveCount + 1,
    mergeCount: state.mergeCount + result.mergeCount,
    hasWon,
    gameOver,
  };
}

// =============================================================================
// UI Utilities
// =============================================================================

/**
 * Get tile background color based on value
 */
export function getTileColor(value: number): string {
  const colors: Record<number, string> = {
    0: "#CDC1B4",
    2: "#EEE4DA",
    4: "#EDE0C8",
    8: "#F2B179",
    16: "#F59563",
    32: "#F67C5F",
    64: "#F65E3B",
    128: "#EDCF72",
    256: "#EDCC61",
    512: "#EDC850",
    1024: "#EDC53F",
    2048: "#EDC22E",
  };
  return colors[value] || "#3C3A32";
}

/**
 * Get tile text color based on value
 */
export function getTileTextColor(value: number): string {
  return value <= 4 ? "#776E65" : "#FFFFFF";
}

/**
 * Get font size based on number of digits
 */
export function getTileFontSize(value: number, cellSize: number): number {
  const digits = value.toString().length;
  if (digits <= 2) return cellSize * 0.45;
  if (digits === 3) return cellSize * 0.38;
  if (digits === 4) return cellSize * 0.32;
  return cellSize * 0.26;
}
