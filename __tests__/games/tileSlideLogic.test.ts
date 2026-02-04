/**
 * Tile Slide Logic Unit Tests
 *
 * Tests for the sliding puzzle game logic including:
 * - Puzzle creation and solvability
 * - Move validation and execution
 * - Win condition detection
 * - Hint system
 * - Scoring calculations
 *
 * @see src/services/games/tileSlideLogic.ts
 */

import {
  calculateManhattanDistance,
  calculateScore,
  calculateStarRating,
  countInversions,
  createPuzzle,
  createSolvedState,
  getOptimalMoveHint,
  getValidMoves,
  isSolvable,
  isSolved,
  isTileCorrect,
  moveTile,
  PUZZLE_DIFFICULTIES,
} from "@/services/games/tileSlideLogic";
import { TileSlideState } from "@/types/singlePlayerGames";

// =============================================================================
// Test Helpers
// =============================================================================

function createTestState(
  tiles: (number | null)[],
  gridSize: 3 | 4 | 5 = 4,
): TileSlideState {
  const emptyIndex = tiles.indexOf(null);
  return {
    gameType: "tile_slide",
    category: "puzzle",
    playerId: "test-player",
    sessionId: "test-session",
    score: 0,
    highScore: 0,
    status: "playing",
    startedAt: Date.now(),
    totalPauseDuration: 0,
    gridSize,
    mode: "numbers",
    tiles,
    emptyIndex,
    solvedState: createSolvedState(gridSize).map((t) => (t === null ? 0 : t)),
    moveCount: 0,
    hintsUsed: 0,
    optimalMoves: PUZZLE_DIFFICULTIES[gridSize].optimalMoves,
    isDailyPuzzle: false,
    slidingTile: null,
    slideDirection: null,
  };
}

// =============================================================================
// Puzzle Creation Tests
// =============================================================================

describe("createSolvedState", () => {
  it("should create a valid 3x3 solved state", () => {
    const solved = createSolvedState(3);
    expect(solved).toEqual([1, 2, 3, 4, 5, 6, 7, 8, null]);
  });

  it("should create a valid 4x4 solved state", () => {
    const solved = createSolvedState(4);
    expect(solved).toEqual([
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      null,
    ]);
  });

  it("should create a valid 5x5 solved state", () => {
    const solved = createSolvedState(5);
    expect(solved).toHaveLength(25);
    expect(solved[0]).toBe(1);
    expect(solved[23]).toBe(24);
    expect(solved[24]).toBe(null);
  });
});

describe("createPuzzle", () => {
  it("should create a valid puzzle state", () => {
    const state = createPuzzle("test-player", 3);

    expect(state.gameType).toBe("tile_slide");
    expect(state.category).toBe("puzzle");
    expect(state.gridSize).toBe(3);
    expect(state.tiles).toHaveLength(9);
    expect(state.status).toBe("playing");
    expect(state.moveCount).toBe(0);
  });

  it("should create a solvable puzzle", () => {
    // Test multiple times to ensure consistency
    for (let i = 0; i < 10; i++) {
      const state = createPuzzle("test-player", 4);
      expect(isSolvable(state.tiles, 4)).toBe(true);
    }
  });

  it("should create different puzzles for 3x3, 4x4, and 5x5", () => {
    const state3 = createPuzzle("test-player", 3);
    const state4 = createPuzzle("test-player", 4);
    const state5 = createPuzzle("test-player", 5);

    expect(state3.tiles).toHaveLength(9);
    expect(state4.tiles).toHaveLength(16);
    expect(state5.tiles).toHaveLength(25);
  });

  it("should not create an already-solved puzzle", () => {
    // Multiple attempts to verify shuffling works
    let allSolved = true;
    for (let i = 0; i < 10; i++) {
      const state = createPuzzle("test-player", 3);
      if (!isSolved(state)) {
        allSolved = false;
        break;
      }
    }
    expect(allSolved).toBe(false);
  });
});

// =============================================================================
// Solvability Tests
// =============================================================================

describe("countInversions", () => {
  it("should count 0 inversions for solved puzzle", () => {
    const solved = [1, 2, 3, 4, 5, 6, 7, 8, null];
    expect(countInversions(solved)).toBe(0);
  });

  it("should count inversions correctly", () => {
    // One inversion: 2 before 1
    const tiles = [2, 1, 3, 4, 5, 6, 7, 8, null];
    expect(countInversions(tiles)).toBe(1);
  });

  it("should count multiple inversions", () => {
    // 8 is before everything, creating 7 inversions
    const tiles = [8, 1, 2, 3, 4, 5, 6, 7, null];
    expect(countInversions(tiles)).toBe(7);
  });
});

describe("isSolvable", () => {
  it("should return true for solvable 3x3 puzzle", () => {
    // Solved state is always solvable
    const solved = [1, 2, 3, 4, 5, 6, 7, 8, null];
    expect(isSolvable(solved, 3)).toBe(true);
  });

  it("should return false for unsolvable 3x3 puzzle", () => {
    // Swap 1 and 2 creates odd inversions = unsolvable for odd grid
    const unsolvable = [2, 1, 3, 4, 5, 6, 7, 8, null];
    expect(isSolvable(unsolvable, 3)).toBe(false);
  });

  it("should correctly identify solvable 4x4 puzzle", () => {
    // Empty at row 4 (from bottom row 0), so inversions must be odd
    const solved = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, null];
    expect(isSolvable(solved, 4)).toBe(true);
  });

  it("should correctly identify unsolvable 4x4 puzzle", () => {
    // Swap 14 and 15 with empty at last row
    // 1 inversion, empty at row 1 from bottom = 1 + 1 = 2 (even) = unsolvable
    const unsolvable = [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      15,
      14,
      null,
    ];
    expect(isSolvable(unsolvable, 4)).toBe(false);
  });
});

// =============================================================================
// Move Validation Tests
// =============================================================================

describe("getValidMoves", () => {
  it("should return correct moves when empty is in center", () => {
    // 3x3 grid with empty in center (index 4)
    const tiles = [1, 2, 3, 4, null, 6, 7, 8, 5];
    const state = createTestState(tiles, 3);

    const validMoves = getValidMoves(state);
    // Should be able to move tiles at indices 1, 3, 5, 7 (above, left, right, below)
    expect(validMoves).toContain(1); // Above
    expect(validMoves).toContain(3); // Left
    expect(validMoves).toContain(5); // Right
    expect(validMoves).toContain(7); // Below
    expect(validMoves).toHaveLength(4);
  });

  it("should return correct moves when empty is in corner", () => {
    // Empty at top-left corner (index 0)
    const tiles = [null, 2, 3, 4, 5, 6, 7, 8, 1];
    const state = createTestState(tiles, 3);

    const validMoves = getValidMoves(state);
    // Only right (1) and below (3) are valid
    expect(validMoves).toContain(1);
    expect(validMoves).toContain(3);
    expect(validMoves).toHaveLength(2);
  });

  it("should return correct moves when empty is on edge", () => {
    // Empty at top-middle (index 1)
    const tiles = [1, null, 3, 4, 5, 6, 7, 8, 2];
    const state = createTestState(tiles, 3);

    const validMoves = getValidMoves(state);
    // Left (0), right (2), below (4)
    expect(validMoves).toContain(0);
    expect(validMoves).toContain(2);
    expect(validMoves).toContain(4);
    expect(validMoves).toHaveLength(3);
  });
});

describe("moveTile", () => {
  it("should successfully move a valid tile", () => {
    // Empty at index 4, try to move tile at index 1
    const tiles = [1, 2, 3, 4, null, 6, 7, 8, 5];
    const state = createTestState(tiles, 3);

    const result = moveTile(state, 1);

    expect(result.moved).toBe(true);
    expect(result.newState.tiles[4]).toBe(2);
    expect(result.newState.tiles[1]).toBe(null);
    expect(result.newState.emptyIndex).toBe(1);
    expect(result.newState.moveCount).toBe(1);
    expect(result.slideDirection).toBe("down");
  });

  it("should not move an invalid tile", () => {
    // Empty at index 0, try to move tile at index 8 (not adjacent)
    const tiles = [null, 2, 3, 4, 5, 6, 7, 8, 1];
    const state = createTestState(tiles, 3);

    const result = moveTile(state, 8);

    expect(result.moved).toBe(false);
    expect(result.newState).toBe(state); // Same state reference
    expect(result.slideDirection).toBe(null);
  });

  it("should correctly set slide direction", () => {
    // Test all four directions
    const tiles = [1, 2, 3, 4, null, 6, 7, 8, 5];
    const state = createTestState(tiles, 3);

    // Moving tile from above (index 1) should slide down
    expect(moveTile(state, 1).slideDirection).toBe("down");

    // Moving tile from below (index 7) should slide up
    expect(moveTile(state, 7).slideDirection).toBe("up");

    // Moving tile from left (index 3) should slide right
    expect(moveTile(state, 3).slideDirection).toBe("right");

    // Moving tile from right (index 5) should slide left
    expect(moveTile(state, 5).slideDirection).toBe("left");
  });
});

// =============================================================================
// Win Condition Tests
// =============================================================================

describe("isSolved", () => {
  it("should return true for solved 3x3 puzzle", () => {
    const tiles = [1, 2, 3, 4, 5, 6, 7, 8, null];
    const state = createTestState(tiles, 3);
    expect(isSolved(state)).toBe(true);
  });

  it("should return false for unsolved puzzle", () => {
    const tiles = [1, 2, 3, 4, 5, 6, 8, 7, null];
    const state = createTestState(tiles, 3);
    expect(isSolved(state)).toBe(false);
  });

  it("should return true for solved 4x4 puzzle", () => {
    const tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, null];
    const state = createTestState(tiles, 4);
    expect(isSolved(state)).toBe(true);
  });

  it("should return false when empty is not at the end", () => {
    const tiles = [1, 2, 3, 4, 5, 6, 7, null, 8];
    const state = createTestState(tiles, 3);
    expect(isSolved(state)).toBe(false);
  });
});

describe("isTileCorrect", () => {
  it("should return true for correctly placed tile", () => {
    const tiles = [1, 2, 3, 4, 5, 6, 7, 8, null];
    const state = createTestState(tiles, 3);

    expect(isTileCorrect(state, 0)).toBe(true); // 1 at index 0
    expect(isTileCorrect(state, 7)).toBe(true); // 8 at index 7
    expect(isTileCorrect(state, 8)).toBe(true); // null at last
  });

  it("should return false for incorrectly placed tile", () => {
    const tiles = [2, 1, 3, 4, 5, 6, 7, 8, null];
    const state = createTestState(tiles, 3);

    expect(isTileCorrect(state, 0)).toBe(false); // 2 at index 0 (should be 1)
    expect(isTileCorrect(state, 1)).toBe(false); // 1 at index 1 (should be 2)
  });
});

// =============================================================================
// Hint System Tests
// =============================================================================

describe("calculateManhattanDistance", () => {
  it("should return 0 for solved puzzle", () => {
    const tiles = [1, 2, 3, 4, 5, 6, 7, 8, null];
    expect(calculateManhattanDistance(tiles, 3)).toBe(0);
  });

  it("should calculate distance correctly", () => {
    // Swap 8 and 7 - both are 1 position away from goal
    const tiles = [1, 2, 3, 4, 5, 6, 8, 7, null];
    expect(calculateManhattanDistance(tiles, 3)).toBe(2);
  });

  it("should calculate larger distances", () => {
    // 1 in bottom-right corner (should be at top-left)
    // Distance: 2 (down) + 2 (right) = 4
    const tiles = [8, 2, 3, 4, 5, 6, 7, null, 1];
    const distance = calculateManhattanDistance(tiles, 3);
    expect(distance).toBeGreaterThan(0);
  });
});

describe("getOptimalMoveHint", () => {
  it("should return null for solved puzzle", () => {
    const tiles = [1, 2, 3, 4, 5, 6, 7, 8, null];
    const state = createTestState(tiles, 3);
    expect(getOptimalMoveHint(state)).toBe(null);
  });

  it("should return a valid move index", () => {
    const tiles = [1, 2, 3, 4, 5, 6, 7, null, 8];
    const state = createTestState(tiles, 3);

    const hint = getOptimalMoveHint(state);
    expect(hint).not.toBe(null);

    // The hint should be a valid move
    const validMoves = getValidMoves(state);
    expect(validMoves).toContain(hint);
  });

  it("should suggest a move that reduces distance", () => {
    // Almost solved - just need to move 8
    const tiles = [1, 2, 3, 4, 5, 6, 7, null, 8];
    const state = createTestState(tiles, 3);

    const hint = getOptimalMoveHint(state);
    // Should suggest moving 8 (index 8) into empty (index 7)
    expect(hint).toBe(8);
  });
});

// =============================================================================
// Scoring Tests
// =============================================================================

describe("calculateScore", () => {
  it("should calculate base score correctly", () => {
    const state3 = createTestState([1, 2, 3, 4, 5, 6, 7, 8, null], 3);
    state3.moveCount = 50; // Well over optimal

    const state4 = createTestState(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, null],
      4,
    );
    state4.moveCount = 100; // Well over optimal

    const score3 = calculateScore(state3, 120); // 2 minutes
    const score4 = calculateScore(state4, 120);

    expect(score3).toBeGreaterThan(0);
    expect(score4).toBeGreaterThan(score3); // 4x4 has higher base
  });

  it("should add optimal bonus", () => {
    const state = createTestState([1, 2, 3, 4, 5, 6, 7, 8, null], 3);
    state.moveCount = 20; // Under optimal (22)

    const score = calculateScore(state, 120);
    // Should include base (100) + optimal bonus (100) + no hints bonus (30) - no time bonus (>60s)
    expect(score).toBe(230);
  });

  it("should add time bonus for fast solve", () => {
    const state = createTestState([1, 2, 3, 4, 5, 6, 7, 8, null], 3);
    state.moveCount = 50; // Over optimal

    const fastScore = calculateScore(state, 25); // Under 30s
    const slowScore = calculateScore(state, 120); // Over 60s

    expect(fastScore).toBeGreaterThan(slowScore);
  });

  it("should apply hint penalty", () => {
    const stateNoHints = createTestState([1, 2, 3, 4, 5, 6, 7, 8, null], 3);
    stateNoHints.moveCount = 50;
    stateNoHints.hintsUsed = 0;

    const stateWithHints = createTestState([1, 2, 3, 4, 5, 6, 7, 8, null], 3);
    stateWithHints.moveCount = 50;
    stateWithHints.hintsUsed = 3;

    const noHintScore = calculateScore(stateNoHints, 120);
    const hintScore = calculateScore(stateWithHints, 120);

    expect(noHintScore).toBeGreaterThan(hintScore);
  });
});

describe("calculateStarRating", () => {
  it("should return 3 stars for optimal moves", () => {
    expect(calculateStarRating(22, 22)).toBe(3);
    expect(calculateStarRating(20, 22)).toBe(3);
  });

  it("should return 2 stars for near-optimal", () => {
    // Within 150% of optimal
    expect(calculateStarRating(30, 22)).toBe(2);
  });

  it("should return 1 star for over 150% optimal", () => {
    expect(calculateStarRating(50, 22)).toBe(1);
  });
});
