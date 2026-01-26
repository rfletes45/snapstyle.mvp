/**
 * Snap 2048 Game Logic
 *
 * Core mechanics:
 * - 4x4 grid initialization with two random tiles (2 or 4)
 * - Swipe in any direction to slide tiles
 * - Matching tiles merge and double their value
 * - New tile spawns after each valid move
 * - Game ends when no moves available
 * - Win when 2048 tile is created (can continue playing)
 *
 * @see docs/GAMES_IMPLEMENTATION_PLAN.md
 */

import {
  Snap2048Direction,
  Snap2048State,
  SNAP_2048_CONFIG,
} from "@/types/singlePlayerGames";

// =============================================================================
// Types
// =============================================================================

interface MoveResult {
  board: number[][];
  score: number;
  moved: boolean;
  mergedPositions: { row: number; col: number; value: number }[];
  movedTiles: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    value: number;
  }[];
}

interface SlideResult {
  row: number[];
  score: number;
  merged: number[];
  moves: { from: number; to: number; value: number }[];
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Create initial empty board
 */
export function createEmptyBoard(): number[][] {
  return Array(SNAP_2048_CONFIG.gridSize)
    .fill(null)
    .map(() => Array(SNAP_2048_CONFIG.gridSize).fill(0));
}

/**
 * Create initial game state with two random tiles
 */
export function createInitial2048State(
  playerId: string,
  sessionId: string,
): Snap2048State {
  const board = createEmptyBoard();

  // Add two initial tiles
  addRandomTile(board);
  addRandomTile(board);

  return {
    gameType: "snap_2048",
    category: "puzzle",
    playerId,
    sessionId,
    score: 0,
    highScore: 0,
    status: "playing",
    startedAt: Date.now(),
    totalPauseDuration: 0,
    board,
    bestTile: Math.max(...board.flat()),
    moveCount: 0,
    hasWon: false,
  };
}

// =============================================================================
// Tile Management
// =============================================================================

/**
 * Get all empty cell positions
 */
export function getEmptyCells(
  board: number[][],
): { row: number; col: number }[] {
  const emptyCells: { row: number; col: number }[] = [];

  for (let row = 0; row < SNAP_2048_CONFIG.gridSize; row++) {
    for (let col = 0; col < SNAP_2048_CONFIG.gridSize; col++) {
      if (board[row][col] === 0) {
        emptyCells.push({ row, col });
      }
    }
  }

  return emptyCells;
}

/**
 * Add a random tile (2 or 4) to an empty cell
 * Returns true if successful, false if board is full
 */
export function addRandomTile(board: number[][]): boolean {
  const emptyCells = getEmptyCells(board);

  if (emptyCells.length === 0) {
    return false;
  }

  const { row, col } =
    emptyCells[Math.floor(Math.random() * emptyCells.length)];
  board[row][col] = Math.random() < SNAP_2048_CONFIG.newTileChance4 ? 4 : 2;

  return true;
}

/**
 * Get the position and value of the newly added tile
 */
export function addRandomTileWithPosition(
  board: number[][],
): { row: number; col: number; value: number } | null {
  const emptyCells = getEmptyCells(board);

  if (emptyCells.length === 0) {
    return null;
  }

  const { row, col } =
    emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const value = Math.random() < SNAP_2048_CONFIG.newTileChance4 ? 4 : 2;
  board[row][col] = value;

  return { row, col, value };
}

// =============================================================================
// Move Logic
// =============================================================================

/**
 * Slide a single row to the left and merge tiles
 */
function slideRowLeft(row: number[]): SlideResult {
  const result: number[] = [];
  let score = 0;
  const merged: number[] = [];
  const moves: { from: number; to: number; value: number }[] = [];

  // Filter out zeros and track original positions
  const nonZero: { value: number; originalIndex: number }[] = [];
  for (let i = 0; i < row.length; i++) {
    if (row[i] !== 0) {
      nonZero.push({ value: row[i], originalIndex: i });
    }
  }

  // Merge adjacent equal tiles
  let resultIndex = 0;
  for (let i = 0; i < nonZero.length; i++) {
    if (i < nonZero.length - 1 && nonZero[i].value === nonZero[i + 1].value) {
      // Merge tiles
      const mergedValue = nonZero[i].value * 2;
      result.push(mergedValue);
      score += mergedValue;
      merged.push(resultIndex);

      // Track moves for both tiles
      moves.push({
        from: nonZero[i].originalIndex,
        to: resultIndex,
        value: nonZero[i].value,
      });
      moves.push({
        from: nonZero[i + 1].originalIndex,
        to: resultIndex,
        value: nonZero[i + 1].value,
      });

      i++; // Skip the next tile as it's been merged
      resultIndex++;
    } else {
      // Just move the tile
      result.push(nonZero[i].value);
      if (nonZero[i].originalIndex !== resultIndex) {
        moves.push({
          from: nonZero[i].originalIndex,
          to: resultIndex,
          value: nonZero[i].value,
        });
      }
      resultIndex++;
    }
  }

  // Fill the rest with zeros
  while (result.length < row.length) {
    result.push(0);
  }

  return { row: result, score, merged, moves };
}

/**
 * Rotate board 90 degrees clockwise
 */
function rotateBoard(board: number[][]): number[][] {
  const size = board.length;
  const rotated: number[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      rotated[col][size - 1 - row] = board[row][col];
    }
  }

  return rotated;
}

/**
 * Rotate board 90 degrees counter-clockwise
 */
function rotateBoardCCW(board: number[][]): number[][] {
  const size = board.length;
  const rotated: number[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      rotated[size - 1 - col][row] = board[row][col];
    }
  }

  return rotated;
}

/**
 * Execute a move in the given direction
 * Uses direct approach instead of rotation for clarity and correctness
 */
export function executeMove(
  board: number[][],
  direction: Snap2048Direction,
): MoveResult {
  const size = board.length;
  const newBoard: number[][] = board.map((row) => [...row]);
  let totalScore = 0;
  const mergedPositions: { row: number; col: number; value: number }[] = [];
  const movedTiles: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    value: number;
  }[] = [];

  if (direction === "left") {
    for (let row = 0; row < size; row++) {
      const result = slideRowLeft(newBoard[row]);
      newBoard[row] = result.row;
      totalScore += result.score;
      for (const col of result.merged) {
        mergedPositions.push({ row, col, value: result.row[col] });
      }
      for (const move of result.moves) {
        movedTiles.push({
          from: { row, col: move.from },
          to: { row, col: move.to },
          value: move.value,
        });
      }
    }
  } else if (direction === "right") {
    for (let row = 0; row < size; row++) {
      // Reverse, slide left, reverse back
      const reversed = [...newBoard[row]].reverse();
      const result = slideRowLeft(reversed);
      newBoard[row] = result.row.reverse();
      totalScore += result.score;
      for (const col of result.merged) {
        // Unreverse the column index
        const actualCol = size - 1 - col;
        mergedPositions.push({
          row,
          col: actualCol,
          value: newBoard[row][actualCol],
        });
      }
      for (const move of result.moves) {
        movedTiles.push({
          from: { row, col: size - 1 - move.from },
          to: { row, col: size - 1 - move.to },
          value: move.value,
        });
      }
    }
  } else if (direction === "up") {
    for (let col = 0; col < size; col++) {
      // Extract column as array
      const column = [];
      for (let row = 0; row < size; row++) {
        column.push(newBoard[row][col]);
      }
      const result = slideRowLeft(column);
      // Put back into board
      for (let row = 0; row < size; row++) {
        newBoard[row][col] = result.row[row];
      }
      totalScore += result.score;
      for (const row of result.merged) {
        mergedPositions.push({ row, col, value: newBoard[row][col] });
      }
      for (const move of result.moves) {
        movedTiles.push({
          from: { row: move.from, col },
          to: { row: move.to, col },
          value: move.value,
        });
      }
    }
  } else if (direction === "down") {
    for (let col = 0; col < size; col++) {
      // Extract column as array, reversed (so sliding "down" becomes sliding "left")
      const column = [];
      for (let row = size - 1; row >= 0; row--) {
        column.push(newBoard[row][col]);
      }
      const result = slideRowLeft(column);
      // Put back into board (reversed)
      for (let row = 0; row < size; row++) {
        newBoard[size - 1 - row][col] = result.row[row];
      }
      totalScore += result.score;
      for (const mergedIdx of result.merged) {
        const actualRow = size - 1 - mergedIdx;
        mergedPositions.push({
          row: actualRow,
          col,
          value: newBoard[actualRow][col],
        });
      }
      for (const move of result.moves) {
        movedTiles.push({
          from: { row: size - 1 - move.from, col },
          to: { row: size - 1 - move.to, col },
          value: move.value,
        });
      }
    }
  }

  // Check if board changed
  const moved = !boardsEqual(board, newBoard);

  return {
    board: newBoard,
    score: totalScore,
    moved,
    mergedPositions,
    movedTiles,
  };
}

/**
 * Check if two boards are equal
 */
function boardsEqual(a: number[][], b: number[][]): boolean {
  for (let row = 0; row < a.length; row++) {
    for (let col = 0; col < a[row].length; col++) {
      if (a[row][col] !== b[row][col]) {
        return false;
      }
    }
  }
  return true;
}

// =============================================================================
// Game State
// =============================================================================

/**
 * Check if any moves are possible
 */
export function canMove(board: number[][]): boolean {
  const size = board.length;

  // Check for empty cells
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] === 0) {
        return true;
      }
    }
  }

  // Check for adjacent equal tiles (horizontal)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size - 1; col++) {
      if (board[row][col] === board[row][col + 1]) {
        return true;
      }
    }
  }

  // Check for adjacent equal tiles (vertical)
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] === board[row + 1][col]) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if the win condition (2048 tile) has been achieved
 */
export function checkWin(board: number[][]): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (cell >= SNAP_2048_CONFIG.winTile) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get the best (highest) tile on the board
 */
export function getBestTile(board: number[][]): number {
  let best = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell > best) {
        best = cell;
      }
    }
  }
  return best;
}

/**
 * Apply a move to the game state
 */
export function applyMove(
  state: Snap2048State,
  direction: Snap2048Direction,
): Snap2048State {
  if (state.status !== "playing") {
    return state;
  }

  const result = executeMove(state.board, direction);

  if (!result.moved) {
    // Invalid move - board didn't change
    return state;
  }

  // Add a new random tile
  const newTile = addRandomTileWithPosition(result.board);

  // Check for win
  const hasWon = state.hasWon || checkWin(result.board);

  // Check for game over
  const isGameOver = !canMove(result.board);

  // Update best tile
  const bestTile = Math.max(state.bestTile, getBestTile(result.board));

  return {
    ...state,
    board: result.board,
    score: state.score + result.score,
    moveCount: state.moveCount + 1,
    bestTile,
    hasWon,
    status: isGameOver ? "gameOver" : "playing",
    endedAt: isGameOver ? Date.now() : undefined,
    lastMove: {
      direction,
      mergedPositions: result.mergedPositions,
      movedTiles: result.movedTiles,
      newTile: newTile ?? undefined,
    },
  };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Get tile color based on value
 */
export function getTileColor(value: number): string {
  if (value === 0) return SNAP_2048_CONFIG.tileColors[0];
  if (value in SNAP_2048_CONFIG.tileColors) {
    return SNAP_2048_CONFIG.tileColors[value];
  }
  // For values > 8192, use dark color
  return "#3C3A32";
}

/**
 * Get tile text color based on value
 */
export function getTileTextColor(value: number): string {
  if (value in SNAP_2048_CONFIG.tileTextColors) {
    return SNAP_2048_CONFIG.tileTextColors[value];
  }
  return "#FFFFFF";
}

/**
 * Get font size based on tile value (larger numbers need smaller font)
 */
export function getTileFontSize(value: number, tileSize: number): number {
  const digits = value.toString().length;
  if (digits <= 2) return tileSize * 0.45;
  if (digits === 3) return tileSize * 0.38;
  if (digits === 4) return tileSize * 0.32;
  return tileSize * 0.26;
}

/**
 * Deep clone the board
 */
export function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}
