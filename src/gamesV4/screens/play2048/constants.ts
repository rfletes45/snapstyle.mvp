/**
 * 2048 Presentation Layer — Visual Constants
 *
 * Colors, sizes, timing values, and helper functions for
 * the 2048 board and tile rendering.
 *
 * @module gamesV4/screens/play2048/constants
 */

// ── Grid ──────────────────────────────────────────────────────────────────────

export const GRID_SIZE = 4;
export const WIN_TILE = 2048;

// ── Animation timing (ms) — matches original 2048 CSS transitions ─────────

/** Slide duration in milliseconds. */
export const SLIDE_MS = 100;

/** Delay before merge-result pop begins (overlaps slightly with slide end). */
export const MERGE_POP_DELAY_MS = 75;

/** Delay before spawn-tile appear begins (after slide finishes). */
export const APPEAR_DELAY_MS = 100;

/** Total animation cycle: slide + pop + settle margin. */
export const ANIM_TOTAL_MS = 320;

// ── Board layout ──────────────────────────────────────────────────────────────

/** Padding inside the board container. */
export const BOARD_PADDING = 10;

/** Gap between cells. */
export const CELL_GAP = 10;

/** Maximum board width (for large screens / web). */
export const MAX_BOARD_SIZE = 500;

// ── Gesture ───────────────────────────────────────────────────────────────────

/** Minimum swipe distance to register a move. */
export const SWIPE_THRESHOLD = 30;

// ── Tile style lookup ─────────────────────────────────────────────────────────

interface TileVisual {
  bg: string;
  text: string;
}

const TILE_MAP: Record<number, TileVisual> = {
  2: { bg: "#EEE4DA", text: "#776E65" },
  4: { bg: "#EDE0C8", text: "#776E65" },
  8: { bg: "#F2B179", text: "#F9F6F2" },
  16: { bg: "#F59563", text: "#F9F6F2" },
  32: { bg: "#F67C5F", text: "#F9F6F2" },
  64: { bg: "#F65E3B", text: "#F9F6F2" },
  128: { bg: "#EDCF72", text: "#F9F6F2" },
  256: { bg: "#EDCC61", text: "#F9F6F2" },
  512: { bg: "#EDC850", text: "#F9F6F2" },
  1024: { bg: "#EDC53F", text: "#F9F6F2" },
  2048: { bg: "#EDC22E", text: "#F9F6F2" },
  4096: { bg: "#ED4263", text: "#F9F6F2" },
  8192: { bg: "#B3325A", text: "#F9F6F2" },
};

const SUPER_TILE: TileVisual = { bg: "#3C3A32", text: "#F9F6F2" };

/** Get background and text color for a tile value. */
export function getTileStyle(value: number): TileVisual {
  return TILE_MAP[value] ?? SUPER_TILE;
}

/** Get font size relative to cell size, scaling for digit count. */
export function getTileFontSize(value: number, cellSize: number): number {
  const digits = String(value).length;
  if (digits <= 1) return cellSize * 0.45;
  if (digits === 2) return cellSize * 0.38;
  if (digits === 3) return cellSize * 0.3;
  if (digits === 4) return cellSize * 0.24;
  return cellSize * 0.2;
}

/** Convert a grid index + layout params to a pixel offset. */
export function cellPosition(
  index: number,
  cellSize: number,
  cellGap: number,
  boardPadding: number,
): number {
  return boardPadding + index * (cellSize + cellGap);
}

// ── Board theming ─────────────────────────────────────────────────────────────

export interface BoardTheme {
  boardBg: string;
  cellBg: string;
  screenBg: string;
  textPrimary: string;
  textSecondary: string;
  scoreBg: string;
  scoreLabel: string;
  scoreValue: string;
  overlayBg: string;
  overlayText: string;
}

export const LIGHT_THEME: BoardTheme = {
  boardBg: "#BBADA0",
  cellBg: "rgba(238,228,218,0.35)",
  screenBg: "#FAF8EF",
  textPrimary: "#776E65",
  textSecondary: "#776E65",
  scoreBg: "#BBADA0",
  scoreLabel: "#EEE4DA",
  scoreValue: "#FFFFFF",
  overlayBg: "rgba(238,228,218,0.73)",
  overlayText: "#776E65",
};

export const DARK_THEME: BoardTheme = {
  boardBg: "#3D3529",
  cellBg: "rgba(255,255,255,0.08)",
  screenBg: "#1A1614",
  textPrimary: "#CDC1B4",
  textSecondary: "#A09588",
  scoreBg: "#3D3529",
  scoreLabel: "#A09588",
  scoreValue: "#F9F6F2",
  overlayBg: "rgba(26,22,20,0.78)",
  overlayText: "#CDC1B4",
};
