/**
 * Tile Slide Game Logic
 *
 * Pure functions for the classic sliding puzzle game.
 * Implements solvability checking, puzzle generation, move validation,
 * and hint system using Manhattan distance heuristics.
 *
 * Key algorithms:
 * - Inversion count for solvability checking
 * - Shuffle via random valid moves (guarantees solvability)
 * - A* inspired hint system using Manhattan distance
 *
 * Exported Functions:
 * - createPuzzle(playerId, size, mode, imageUri?) - Create a new puzzle
 * - createDailyPuzzle(playerId, date, size) - Create deterministic daily puzzle
 * - moveTile(state, tileIndex) - Move a tile into empty space
 * - getValidMoves(state) - Get indices of movable tiles
 * - isSolved(state) - Check if puzzle is complete
 * - getOptimalMoveHint(state) - Get hint for best move
 * - useHint(state) - Use a hint (decrements hint count)
 * - calculateScore(state, durationSeconds) - Calculate final score
 * - createTileSlideStats(state, isOptimal) - Create stats for recording
 *
 * @see docs/06_GAMES.md Section 4 (Single-Player Games)
 */

import { TILE_SLIDE_CONFIG, TileSlideState } from "@/types/singlePlayerGames";
import { generateId } from "@/utils/ids";

// =============================================================================
// Types
// =============================================================================

export type TileSlideSize = 3 | 4 | 5;
export type SlideDirection = "up" | "down" | "left" | "right";

export interface TileMoveResult {
  newState: TileSlideState;
  moved: boolean;
  slideDirection: SlideDirection | null;
  movedTileValue: number | null;
}

export interface PuzzleDifficulty {
  size: TileSlideSize;
  name: string;
  optimalMoves: number;
  timeBonus30s: number;
  timeBonus60s: number;
  baseScore: number;
}

// =============================================================================
// Constants
// =============================================================================

export const PUZZLE_DIFFICULTIES: Record<TileSlideSize, PuzzleDifficulty> = {
  3: {
    size: 3,
    name: "Easy (3×3)",
    optimalMoves: 22,
    timeBonus30s: 40,
    timeBonus60s: 20,
    baseScore: 100,
  },
  4: {
    size: 4,
    name: "Medium (4×4)",
    optimalMoves: 50,
    timeBonus30s: 40,
    timeBonus60s: 20,
    baseScore: 200,
  },
  5: {
    size: 5,
    name: "Hard (5×5)",
    optimalMoves: 100,
    timeBonus30s: 40,
    timeBonus60s: 20,
    baseScore: 350,
  },
};

// =============================================================================
// Core Puzzle Creation
// =============================================================================

/**
 * Create a solved puzzle state (tiles in order 1, 2, 3, ... , n²-1, null)
 */
export function createSolvedState(size: TileSlideSize): (number | null)[] {
  const total = size * size;
  const tiles: (number | null)[] = [];

  for (let i = 1; i < total; i++) {
    tiles.push(i);
  }
  tiles.push(null); // Empty space at the end

  return tiles;
}

/**
 * Create a new puzzle with the given size
 */
export function createPuzzle(
  playerId: string,
  size: TileSlideSize = 4,
  mode: "numbers" | "image" = "numbers",
  imageUri?: string,
): TileSlideState {
  const solvedState = createSolvedState(size);
  const shuffleMoves =
    TILE_SLIDE_CONFIG.shuffleMoves[
      size as keyof typeof TILE_SLIDE_CONFIG.shuffleMoves
    ];

  // Shuffle by making random valid moves (ensures solvability)
  const shuffledTiles = shufflePuzzle(solvedState, size, shuffleMoves);
  const emptyIndex = shuffledTiles.indexOf(null);

  const state: TileSlideState = {
    // Base state
    gameType: "tile_slide",
    category: "puzzle",
    playerId,
    sessionId: generateId(),
    score: 0,
    highScore: 0,
    status: "playing",
    startedAt: Date.now(),
    totalPauseDuration: 0,

    // Tile slide specific
    gridSize: size,
    mode,
    imageUri,
    tiles: shuffledTiles,
    emptyIndex,
    solvedState: solvedState.map((t) => (t === null ? 0 : t)),
    moveCount: 0,
    hintsUsed: 0,
    optimalMoves: PUZZLE_DIFFICULTIES[size].optimalMoves,
    isDailyPuzzle: false,
    slidingTile: null,
    slideDirection: null,
  };

  return state;
}

/**
 * Create a daily puzzle based on the date
 * Uses date as seed for deterministic puzzle generation
 */
export function createDailyPuzzle(
  playerId: string,
  date: string,
  size: TileSlideSize = 4,
): TileSlideState {
  // Create a seeded random number generator based on date
  const seed = hashDateString(date);
  const seededRandom = createSeededRandom(seed);

  const solvedState = createSolvedState(size);
  const shuffleMoves =
    TILE_SLIDE_CONFIG.shuffleMoves[
      size as keyof typeof TILE_SLIDE_CONFIG.shuffleMoves
    ];

  // Shuffle using seeded random (same puzzle for everyone on same day)
  const shuffledTiles = shufflePuzzleSeeded(
    solvedState,
    size,
    shuffleMoves,
    seededRandom,
  );
  const emptyIndex = shuffledTiles.indexOf(null);

  const state: TileSlideState = {
    gameType: "tile_slide",
    category: "puzzle",
    playerId,
    sessionId: generateId(),
    score: 0,
    highScore: 0,
    status: "playing",
    startedAt: Date.now(),
    totalPauseDuration: 0,

    gridSize: size,
    mode: "numbers",
    tiles: shuffledTiles,
    emptyIndex,
    solvedState: solvedState.map((t) => (t === null ? 0 : t)),
    moveCount: 0,
    hintsUsed: 0,
    optimalMoves: PUZZLE_DIFFICULTIES[size].optimalMoves,
    isDailyPuzzle: true,
    dailyPuzzleDate: date,
    slidingTile: null,
    slideDirection: null,
  };

  return state;
}

// =============================================================================
// Shuffling
// =============================================================================

/**
 * Shuffle a puzzle by making random valid moves
 * This guarantees the resulting puzzle is solvable
 */
export function shufflePuzzle(
  tiles: (number | null)[],
  size: TileSlideSize,
  moveCount: number,
): (number | null)[] {
  let current = [...tiles];
  let emptyIndex = current.indexOf(null);
  let lastMove: SlideDirection | null = null;

  for (let i = 0; i < moveCount; i++) {
    const validMoves = getValidMovesFromEmpty(emptyIndex, size);

    // Avoid undoing the previous move
    const opposites: Record<SlideDirection, SlideDirection> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };

    const filteredMoves: Array<{
      tileIndex: number;
      direction: SlideDirection;
    }> = lastMove
      ? validMoves.filter((m) => m.direction !== opposites[lastMove!])
      : validMoves;

    const movesToUse: Array<{ tileIndex: number; direction: SlideDirection }> =
      filteredMoves.length > 0 ? filteredMoves : validMoves;
    const randomMove: { tileIndex: number; direction: SlideDirection } =
      movesToUse[Math.floor(Math.random() * movesToUse.length)];

    // Swap
    current[emptyIndex] = current[randomMove.tileIndex];
    current[randomMove.tileIndex] = null;
    emptyIndex = randomMove.tileIndex;
    lastMove = randomMove.direction;
  }

  return current;
}

/**
 * Shuffle with seeded random for daily puzzles
 */
function shufflePuzzleSeeded(
  tiles: (number | null)[],
  size: TileSlideSize,
  moveCount: number,
  random: () => number,
): (number | null)[] {
  let current = [...tiles];
  let emptyIndex = current.indexOf(null);
  let lastMove: SlideDirection | null = null;

  for (let i = 0; i < moveCount; i++) {
    const validMoves = getValidMovesFromEmpty(emptyIndex, size);

    const opposites: Record<SlideDirection, SlideDirection> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };

    const filteredMoves: Array<{
      tileIndex: number;
      direction: SlideDirection;
    }> = lastMove
      ? validMoves.filter((m) => m.direction !== opposites[lastMove!])
      : validMoves;

    const movesToUse: Array<{ tileIndex: number; direction: SlideDirection }> =
      filteredMoves.length > 0 ? filteredMoves : validMoves;
    const randomMove: { tileIndex: number; direction: SlideDirection } =
      movesToUse[Math.floor(random() * movesToUse.length)];

    current[emptyIndex] = current[randomMove.tileIndex];
    current[randomMove.tileIndex] = null;
    emptyIndex = randomMove.tileIndex;
    lastMove = randomMove.direction;
  }

  return current;
}

/**
 * Get valid moves from empty position (tiles that can slide into empty)
 */
function getValidMovesFromEmpty(
  emptyIndex: number,
  size: number,
): Array<{ tileIndex: number; direction: SlideDirection }> {
  const row = Math.floor(emptyIndex / size);
  const col = emptyIndex % size;
  const moves: Array<{ tileIndex: number; direction: SlideDirection }> = [];

  // Tile above can slide down into empty
  if (row > 0) {
    moves.push({ tileIndex: emptyIndex - size, direction: "down" });
  }
  // Tile below can slide up into empty
  if (row < size - 1) {
    moves.push({ tileIndex: emptyIndex + size, direction: "up" });
  }
  // Tile to the left can slide right into empty
  if (col > 0) {
    moves.push({ tileIndex: emptyIndex - 1, direction: "right" });
  }
  // Tile to the right can slide left into empty
  if (col < size - 1) {
    moves.push({ tileIndex: emptyIndex + 1, direction: "left" });
  }

  return moves;
}

// =============================================================================
// Solvability Checking
// =============================================================================

/**
 * Count the number of inversions in the puzzle
 * An inversion is when a larger number precedes a smaller number
 */
export function countInversions(tiles: (number | null)[]): number {
  let inversions = 0;
  const nonNullTiles = tiles.filter((t): t is number => t !== null);

  for (let i = 0; i < nonNullTiles.length; i++) {
    for (let j = i + 1; j < nonNullTiles.length; j++) {
      if (nonNullTiles[i] > nonNullTiles[j]) {
        inversions++;
      }
    }
  }

  return inversions;
}

/**
 * Check if a puzzle configuration is solvable
 *
 * For odd-sized grids (3×3, 5×5): solvable if inversions is even
 * For even-sized grids (4×4): solvable if inversions + empty row from bottom is odd
 */
export function isSolvable(
  tiles: (number | null)[],
  gridSize: number,
): boolean {
  const inversions = countInversions(tiles);
  const emptyIndex = tiles.indexOf(null);
  const emptyRow = Math.floor(emptyIndex / gridSize);

  if (gridSize % 2 === 1) {
    // Odd-sized grid: solvable if inversions is even
    return inversions % 2 === 0;
  } else {
    // Even-sized grid: solvable if inversions + row from bottom is odd
    const rowFromBottom = gridSize - emptyRow;
    return (inversions + rowFromBottom) % 2 === 1;
  }
}

// =============================================================================
// Move Logic
// =============================================================================

/**
 * Get indices of tiles that can be moved (adjacent to empty space)
 */
export function getValidMoves(state: TileSlideState): number[] {
  const { tiles, emptyIndex, gridSize } = state;
  const validIndices: number[] = [];

  const row = Math.floor(emptyIndex / gridSize);
  const col = emptyIndex % gridSize;

  // Check all four directions
  if (row > 0) validIndices.push(emptyIndex - gridSize); // Above
  if (row < gridSize - 1) validIndices.push(emptyIndex + gridSize); // Below
  if (col > 0) validIndices.push(emptyIndex - 1); // Left
  if (col < gridSize - 1) validIndices.push(emptyIndex + 1); // Right

  return validIndices;
}

/**
 * Check if a tile index is a valid move
 */
export function isValidMove(state: TileSlideState, tileIndex: number): boolean {
  return getValidMoves(state).includes(tileIndex);
}

/**
 * Move a tile into the empty space
 * Returns new state and whether the move was valid
 */
export function moveTile(
  state: TileSlideState,
  tileIndex: number,
): TileMoveResult {
  if (!isValidMove(state, tileIndex)) {
    return {
      newState: state,
      moved: false,
      slideDirection: null,
      movedTileValue: null,
    };
  }

  const { tiles, emptyIndex, gridSize } = state;
  const movedTileValue = tiles[tileIndex];

  // Determine slide direction
  const tileRow = Math.floor(tileIndex / gridSize);
  const tileCol = tileIndex % gridSize;
  const emptyRow = Math.floor(emptyIndex / gridSize);
  const emptyCol = emptyIndex % gridSize;

  let slideDirection: SlideDirection;
  if (tileRow < emptyRow) slideDirection = "down";
  else if (tileRow > emptyRow) slideDirection = "up";
  else if (tileCol < emptyCol) slideDirection = "right";
  else slideDirection = "left";

  // Create new tiles array with swap
  const newTiles = [...tiles];
  newTiles[emptyIndex] = newTiles[tileIndex];
  newTiles[tileIndex] = null;

  const newState: TileSlideState = {
    ...state,
    tiles: newTiles,
    emptyIndex: tileIndex,
    moveCount: state.moveCount + 1,
    slidingTile: movedTileValue,
    slideDirection,
  };

  return {
    newState,
    moved: true,
    slideDirection,
    movedTileValue,
  };
}

/**
 * Move by tapping a tile value (finds index and moves)
 */
export function moveTileByValue(
  state: TileSlideState,
  tileValue: number,
): TileMoveResult {
  const tileIndex = state.tiles.indexOf(tileValue);
  if (tileIndex === -1) {
    return {
      newState: state,
      moved: false,
      slideDirection: null,
      movedTileValue: null,
    };
  }
  return moveTile(state, tileIndex);
}

// =============================================================================
// Win Condition
// =============================================================================

/**
 * Check if the puzzle is solved
 */
export function isSolved(state: TileSlideState): boolean {
  const { tiles, gridSize } = state;
  const total = gridSize * gridSize;

  for (let i = 0; i < total - 1; i++) {
    if (tiles[i] !== i + 1) return false;
  }

  return tiles[total - 1] === null;
}

// =============================================================================
// Hint System
// =============================================================================

/**
 * Calculate Manhattan distance of current state to solved state
 */
export function calculateManhattanDistance(
  tiles: (number | null)[],
  gridSize: number,
): number {
  let distance = 0;

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (tile === null) continue;

    // Current position
    const currentRow = Math.floor(i / gridSize);
    const currentCol = i % gridSize;

    // Target position (tile value 1 should be at index 0, etc.)
    const targetIndex = tile - 1;
    const targetRow = Math.floor(targetIndex / gridSize);
    const targetCol = targetIndex % gridSize;

    distance +=
      Math.abs(currentRow - targetRow) + Math.abs(currentCol - targetCol);
  }

  return distance;
}

/**
 * Get the best move hint using Manhattan distance heuristic
 * Returns the tile index that should be moved, or null if already solved
 */
export function getOptimalMoveHint(state: TileSlideState): number | null {
  if (isSolved(state)) return null;

  const validMoves = getValidMoves(state);
  let bestMove: number | null = null;
  let bestDistance = Infinity;

  for (const moveIndex of validMoves) {
    // Simulate the move
    const result = moveTile(state, moveIndex);
    if (!result.moved) continue;

    const distance = calculateManhattanDistance(
      result.newState.tiles,
      result.newState.gridSize,
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMove = moveIndex;
    }
  }

  return bestMove;
}

/**
 * Use a hint - returns new state with hintsUsed incremented and the hint tile index
 */
export function useHint(state: TileSlideState): {
  newState: TileSlideState;
  hintTileIndex: number | null;
} {
  const hintTileIndex = getOptimalMoveHint(state);

  const newState: TileSlideState = {
    ...state,
    hintsUsed: state.hintsUsed + 1,
  };

  return { newState, hintTileIndex };
}

// =============================================================================
// Scoring
// =============================================================================

/**
 * Calculate final score for a solved puzzle
 */
export function calculateScore(
  state: TileSlideState,
  durationSeconds: number,
): number {
  const { gridSize, moveCount, hintsUsed, optimalMoves } = state;
  const difficulty = PUZZLE_DIFFICULTIES[gridSize];

  let score = difficulty.baseScore;

  // Optimal moves bonus
  if (moveCount <= optimalMoves) {
    score += TILE_SLIDE_CONFIG.optimalBonus;
  } else if (moveCount <= optimalMoves * 1.2) {
    // Near-optimal (within 120%)
    score += TILE_SLIDE_CONFIG.nearOptimalBonus;
  }

  // Time bonus
  if (durationSeconds < 30) {
    score += TILE_SLIDE_CONFIG.timeBonus30s;
  } else if (durationSeconds < 60) {
    score += TILE_SLIDE_CONFIG.timeBonus60s;
  }

  // Hint bonus/penalty
  if (hintsUsed === 0) {
    score += TILE_SLIDE_CONFIG.noHintsBonus;
  } else {
    score -= hintsUsed * TILE_SLIDE_CONFIG.hintPenalty;
  }

  return Math.max(0, score);
}

/**
 * Calculate star rating based on moves
 */
export function calculateStarRating(
  moveCount: number,
  optimalMoves: number,
): 1 | 2 | 3 {
  if (moveCount <= optimalMoves) return 3;
  if (moveCount <= optimalMoves * 1.5) return 2;
  return 1;
}

// =============================================================================
// Game State Helpers
// =============================================================================

/**
 * Get tile at a specific row and column
 */
export function getTileAt(
  state: TileSlideState,
  row: number,
  col: number,
): number | null {
  const index = row * state.gridSize + col;
  return state.tiles[index];
}

/**
 * Check if a tile is in its correct position
 */
export function isTileCorrect(
  state: TileSlideState,
  tileIndex: number,
): boolean {
  const tile = state.tiles[tileIndex];

  // Empty space is correct if at the last position
  if (tile === null) {
    return tileIndex === state.tiles.length - 1;
  }

  // Tile n should be at index n-1
  return tile === tileIndex + 1;
}

/**
 * Get the number of correctly placed tiles
 */
export function getCorrectTileCount(state: TileSlideState): number {
  let count = 0;
  for (let i = 0; i < state.tiles.length; i++) {
    if (isTileCorrect(state, i)) count++;
  }
  return count;
}

/**
 * Get progress percentage (0-100)
 */
export function getProgressPercent(state: TileSlideState): number {
  const total = state.tiles.length;
  const correct = getCorrectTileCount(state);
  return Math.round((correct / total) * 100);
}

/**
 * Reset animation state after animation completes
 */
export function clearAnimationState(state: TileSlideState): TileSlideState {
  return {
    ...state,
    slidingTile: null,
    slideDirection: null,
  };
}

/**
 * Complete the game
 */
export function completeGame(
  state: TileSlideState,
  durationSeconds: number,
): TileSlideState {
  const finalScore = calculateScore(state, durationSeconds);

  return {
    ...state,
    status: "gameOver",
    score: finalScore,
    endedAt: Date.now(),
  };
}

// =============================================================================
// Seeded Random for Daily Puzzles
// =============================================================================

/**
 * Simple hash function for date string
 */
function hashDateString(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Create a seeded random number generator (Mulberry32)
 */
function createSeededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =============================================================================
// Statistics
// =============================================================================

/**
 * Create stats object for session recording
 */
export function createTileSlideStats(
  state: TileSlideState,
  isOptimalSolve: boolean,
): {
  gameType: "tile_slide";
  puzzlesSolved: number;
  totalMoves: number;
  optimalSolves: number;
  hintsUsed: number;
  dailyPuzzlesCompleted: number;
} {
  return {
    gameType: "tile_slide",
    puzzlesSolved: 1,
    totalMoves: state.moveCount,
    optimalSolves: isOptimalSolve ? 1 : 0,
    hintsUsed: state.hintsUsed,
    dailyPuzzlesCompleted: state.isDailyPuzzle ? 1 : 0,
  };
}
