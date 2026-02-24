/**
 * CrazyCardsConfig — Constants for the Crazy Cards (UNO-inspired) game
 *
 * Covers card sizing, color palette, layout math, and game constants.
 * Mobile-first: all sizing derived from screen width.
 *
 * Internal gameId stays "crazy_eights" for routing stability.
 */

import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// =============================================================================
// Card Sizing (mobile-first)
// =============================================================================

export const CARD_ASPECT = 0.66; // width / height
export const CARD_HEIGHT = Math.min(Math.max(SCREEN_WIDTH * 0.26, 92), 132);
export const CARD_WIDTH = CARD_HEIGHT * CARD_ASPECT;
export const CARD_RADIUS = CARD_HEIGHT * 0.12;
export const CARD_BORDER = 2;
export const CARD_PAD = CARD_HEIGHT * 0.1;
export const CORNER_INSET = CARD_HEIGHT * 0.08;

// =============================================================================
// Typography
// =============================================================================

export const CENTER_NUMBER_SIZE = CARD_HEIGHT * 0.42;
export const CENTER_ACTION_SIZE = CARD_HEIGHT * 0.32;
export const CORNER_GLYPH_SIZE = CARD_HEIGHT * 0.16;

// =============================================================================
// Color Palette (original — NOT UNO branded)
// =============================================================================

export const CARD_COLORS = {
  red: "#FF4D5A",
  yellow: "#FFD24A",
  green: "#3DE57A",
  blue: "#4D8CFF",
  wild: "#1B1E2B",
} as const;

/** Semi-transparent overlay for inner oval effect */
export const INNER_OVAL_LIGHT = "rgba(255,255,255,0.10)";
export const INNER_OVAL_DARK = "rgba(0,0,0,0.10)";

/** Text colors — auto-contrast based on card color */
export const CARD_TEXT_COLORS: Record<string, string> = {
  red: "#FFFFFF",
  yellow: "#1B1E2B",
  green: "#FFFFFF",
  blue: "#FFFFFF",
  wild: "#FFFFFF",
};

// =============================================================================
// Hand Layout
// =============================================================================

export const HAND_OVERLAP = CARD_WIDTH * 0.28;
export const SELECTED_LIFT_Y = -(CARD_HEIGHT * 0.18);

// =============================================================================
// Game Constants
// =============================================================================

export const INITIAL_HAND_SIZE = 7;
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 5;
export const DECK_SIZE = 108;
export const UNO_CALL_TIMEOUT_MS = 3000;
export const UNO_PENALTY_DRAW = 2;
export const DRAW_TWO_PENALTY = 2;
export const WILD_DRAW_FOUR_PENALTY = 4;

/** Display name for the game (internal gameId stays "crazy_eights") */
export const DISPLAY_NAME = "Crazy Cards";

// =============================================================================
// Card Point Values (for end-of-round scoring)
// =============================================================================

export const POINT_VALUES = {
  number: -1, // use face value
  skip: 20,
  reverse: 20,
  draw_two: 20,
  wild: 50,
  wild_draw_four: 50,
} as const;

// =============================================================================
// Action Symbols (for card face rendering)
// =============================================================================

export const ACTION_SYMBOLS: Record<string, string> = {
  skip: "⊘",
  reverse: "⇄",
  draw_two: "+2",
  wild: "★",
  wild_draw_four: "+4",
};
