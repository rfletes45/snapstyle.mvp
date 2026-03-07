/**
 * Chess UI — Shared Constants
 *
 * Dimensions, piece mappings, and layout constants used across
 * all chess sub-components.
 *
 * @module gamesV4/screens/chess/constants
 */

import { Dimensions } from "react-native";

// =============================================================================
// Dimensions
// =============================================================================

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

/** Outer padding around the board */
export const BOARD_PADDING = 8;

/** Board pixel size — fits comfortably on small phones with HUD room */
export const BOARD_SIZE = Math.min(SCREEN_WIDTH - BOARD_PADDING * 2, 400);

/** Individual square size */
export const SQUARE_SIZE = BOARD_SIZE / 8;

/** Screen dimensions for layout calculations */
export { SCREEN_HEIGHT, SCREEN_WIDTH };

// =============================================================================
// Animation Timing
// =============================================================================

/** Duration for piece slide animation (ms) */
export const MOVE_ANIM_DURATION = 150;

/** Duration for capture piece shrink/fade (ms) */
export const CAPTURE_ANIM_DURATION = 120;

/** Duration for check pulse ring (ms) */
export const CHECK_PULSE_DURATION = 600;

/** Duration for last-move highlight fade-in (ms) */
export const HIGHLIGHT_FADE_DURATION = 200;

// =============================================================================
// Piece Unicode Symbols
// =============================================================================

export const PIECE_SYMBOLS: Record<string, string> = {
  wK: "\u2654",
  wQ: "\u2655",
  wR: "\u2656",
  wB: "\u2657",
  wN: "\u2658",
  wP: "\u2659",
  bK: "\u265A",
  bQ: "\u265B",
  bR: "\u265C",
  bB: "\u265D",
  bN: "\u265E",
  bP: "\u265F",
};

/** MaterialCommunityIcons names for pieces */
export const PIECE_ICONS: Record<string, string> = {
  wP: "chess-pawn",
  wN: "chess-knight",
  wB: "chess-bishop",
  wR: "chess-rook",
  wQ: "chess-queen",
  wK: "chess-king",
  bP: "chess-pawn",
  bN: "chess-knight",
  bB: "chess-bishop",
  bR: "chess-rook",
  bQ: "chess-queen",
  bK: "chess-king",
};

/** Readable piece names for accessibility / labels */
export const PIECE_NAMES: Record<string, string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
};

/** Material piece values for advantage calculation */
export const PIECE_VALUES: Record<string, number> = {
  P: 1,
  N: 3,
  B: 3,
  R: 5,
  Q: 9,
  K: 0,
};
