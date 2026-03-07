/**
 * Minesweeper — Type Definitions
 *
 * Shared types for the pure engine, client adapter, and server adapter.
 *
 * @module gamesV4/games/minesweeper/types
 */

// =============================================================================
// Difficulty
// =============================================================================

export type MinesweeperDifficulty = "easy" | "intermediate" | "expert";

export interface DifficultyPreset {
  difficulty: MinesweeperDifficulty;
  label: string;
  cols: number;
  rows: number;
  mineCount: number;
}

export const DIFFICULTY_PRESETS: Record<
  MinesweeperDifficulty,
  DifficultyPreset
> = {
  easy: { difficulty: "easy", label: "Easy", cols: 9, rows: 9, mineCount: 10 },
  intermediate: {
    difficulty: "intermediate",
    label: "Intermediate",
    cols: 16,
    rows: 16,
    mineCount: 40,
  },
  expert: {
    difficulty: "expert",
    label: "Expert",
    cols: 30,
    rows: 16,
    mineCount: 99,
  },
};

// =============================================================================
// Cell / Board State
// =============================================================================

/** Cell value: -1 = mine, 0..8 = adjacency count */
export type CellValue = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Cell visibility state */
export type CellState = "hidden" | "revealed" | "flagged";

// =============================================================================
// Game Status
// =============================================================================

export type GameStatus = "idle" | "active" | "won" | "lost";

// =============================================================================
// Public State (serializable, stored in Firestore)
// =============================================================================

export interface MinesweeperPublicState {
  /** Difficulty key */
  difficulty: MinesweeperDifficulty;
  /** Board dimensions */
  cols: number;
  rows: number;
  /** Total mine count */
  mineCount: number;
  /** Deterministic seed for board generation */
  seed: number;
  /** Whether the board mines have been placed (after first click) */
  boardGenerated: boolean;
  /** Flat array [rows][cols] of cell values (-1 = mine, 0-8 = adjacency) */
  board: CellValue[];
  /** Flat array [rows][cols] of cell states */
  cellStates: CellState[];
  /** Current game status */
  status: GameStatus;
  /** Number of safe cells revealed so far */
  revealedCount: number;
  /** Total safe cells to reveal to win */
  totalSafeCells: number;
  /** Number of flags currently placed */
  flagCount: number;
  /** Cell that was exploded (row * cols + col), or -1 */
  explodedCell: number;
  /** Timestamp when first move was made (ms) */
  startedAtMs: number;
  /** Elapsed time in ms when game ended */
  elapsedMs: number;
  /** Total move count */
  moveCount: number;
  /** Number of chord reveals performed */
  chordCount: number;
  /** Number of cells revealed via flood fill */
  floodCount: number;
}

// =============================================================================
// Move Types
// =============================================================================

export type MinesweeperMoveAction = "reveal" | "flag" | "chord" | "restart";

export interface MinesweeperMove {
  action: MinesweeperMoveAction;
  /** Cell index (row * cols + col) — not used for restart */
  cell?: number;
  /** New difficulty for restart moves */
  difficulty?: MinesweeperDifficulty;
}

// =============================================================================
// Number Colors (classic XP Minesweeper)
// =============================================================================

export const NUMBER_COLORS: Record<number, string> = {
  1: "#0000FF", // Blue
  2: "#008000", // Green
  3: "#FF0000", // Red
  4: "#000080", // Dark blue / Navy
  5: "#800000", // Maroon
  6: "#008080", // Teal
  7: "#000000", // Black
  8: "#808080", // Gray
};

// =============================================================================
// PB Encoding
// =============================================================================

/**
 * Encode a Minesweeper clear result into a single bestScore number for leaderboards.
 *
 * Format: difficultyTier * 1_000_000 + invertedTimeScore
 *
 * - Expert = 3_000_000 + (999_999 - clampedMs)
 * - Intermediate = 2_000_000 + (999_999 - clampedMs)
 * - Easy = 1_000_000 + (999_999 - clampedMs)
 *
 * Higher score = better. Expert always outranks Intermediate which always outranks Easy.
 * Within a tier, faster clears produce higher scores.
 */
export function encodeBestScore(
  difficulty: MinesweeperDifficulty,
  elapsedMs: number,
): number {
  const tierBase: Record<MinesweeperDifficulty, number> = {
    easy: 1_000_000,
    intermediate: 2_000_000,
    expert: 3_000_000,
  };
  // Clamp to 999_999ms (~16.6 minutes) max
  const clamped = Math.min(Math.max(0, Math.floor(elapsedMs)), 999_999);
  return tierBase[difficulty] + (999_999 - clamped);
}

/**
 * Decode a bestScore back into difficulty + time for display.
 */
export function decodeBestScore(score: number): {
  difficulty: MinesweeperDifficulty;
  elapsedMs: number;
} {
  let difficulty: MinesweeperDifficulty;
  let tierBase: number;

  if (score >= 3_000_000) {
    difficulty = "expert";
    tierBase = 3_000_000;
  } else if (score >= 2_000_000) {
    difficulty = "intermediate";
    tierBase = 2_000_000;
  } else {
    difficulty = "easy";
    tierBase = 1_000_000;
  }

  const invertedTime = score - tierBase;
  const elapsedMs = 999_999 - invertedTime;

  return { difficulty, elapsedMs };
}

/**
 * Format milliseconds as M:SS display string.
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Format a bestScore into a readable display string.
 * e.g. "Expert • 2:41"
 */
export function formatBestScore(score: number): string {
  const { difficulty, elapsedMs } = decodeBestScore(score);
  const label =
    difficulty === "easy"
      ? "Easy"
      : difficulty === "intermediate"
        ? "Intermediate"
        : "Expert";
  return `${label} • ${formatTime(elapsedMs)}`;
}
