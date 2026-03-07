/**
 * Chess UI — Board Color Themes
 *
 * Curated board themes with light/dark square colors, highlight overlays,
 * and piece color schemes. Includes a high-contrast accessibility option.
 *
 * @module gamesV4/screens/chess/chessThemes
 */

// =============================================================================
// Board Theme Type
// =============================================================================

export interface ChessBoardTheme {
  id: string;
  label: string;
  lightSquare: string;
  darkSquare: string;
  /** Semi-transparent overlay for selected piece square */
  selectedOverlay: string;
  /** Semi-transparent overlay for last move from/to */
  lastMoveOverlay: string;
  /** Semi-transparent overlay for king in check */
  checkOverlay: string;
  /** Color for legal-move dots */
  legalMoveDot: string;
  /** Color for legal-capture rings */
  legalCaptureRing: string;
  /** Coordinate label color on light squares */
  coordOnLight: string;
  /** Coordinate label color on dark squares */
  coordOnDark: string;
  /** White piece fill */
  whitePiece: string;
  /** Black piece fill */
  blackPiece: string;
  /** Outline / stroke for white pieces (helps contrast) */
  whitePieceStroke: string;
  /** Outline / stroke for black pieces */
  blackPieceStroke: string;
  /** High-contrast flag */
  isHighContrast?: boolean;
}

// =============================================================================
// Themes
// =============================================================================

export const BOARD_THEMES: ChessBoardTheme[] = [
  {
    id: "classic",
    label: "Classic",
    lightSquare: "#F0D9B5",
    darkSquare: "#B58863",
    selectedOverlay: "rgba(255, 255, 0, 0.45)",
    lastMoveOverlay: "rgba(155, 199, 0, 0.42)",
    checkOverlay: "rgba(255, 40, 40, 0.55)",
    legalMoveDot: "rgba(0, 0, 0, 0.22)",
    legalCaptureRing: "rgba(0, 0, 0, 0.22)",
    coordOnLight: "#B58863",
    coordOnDark: "#F0D9B5",
    whitePiece: "#FFFFFF",
    blackPiece: "#1A1A1A",
    whitePieceStroke: "rgba(0,0,0,0.25)",
    blackPieceStroke: "rgba(255,255,255,0.15)",
  },
  {
    id: "modern",
    label: "Modern",
    lightSquare: "#EBECD0",
    darkSquare: "#779556",
    selectedOverlay: "rgba(255, 255, 100, 0.5)",
    lastMoveOverlay: "rgba(255, 255, 100, 0.42)",
    checkOverlay: "rgba(255, 30, 30, 0.55)",
    legalMoveDot: "rgba(0, 0, 0, 0.2)",
    legalCaptureRing: "rgba(0, 0, 0, 0.2)",
    coordOnLight: "#779556",
    coordOnDark: "#EBECD0",
    whitePiece: "#FFFFFF",
    blackPiece: "#1B1B1B",
    whitePieceStroke: "rgba(0,0,0,0.2)",
    blackPieceStroke: "rgba(255,255,255,0.12)",
  },
  {
    id: "midnight",
    label: "Midnight",
    lightSquare: "#DEE3E6",
    darkSquare: "#8CA2AD",
    selectedOverlay: "rgba(130, 200, 255, 0.45)",
    lastMoveOverlay: "rgba(130, 200, 255, 0.35)",
    checkOverlay: "rgba(255, 50, 50, 0.55)",
    legalMoveDot: "rgba(0, 0, 0, 0.22)",
    legalCaptureRing: "rgba(0, 0, 0, 0.22)",
    coordOnLight: "#8CA2AD",
    coordOnDark: "#DEE3E6",
    whitePiece: "#FFFFFF",
    blackPiece: "#222222",
    whitePieceStroke: "rgba(0,0,0,0.2)",
    blackPieceStroke: "rgba(255,255,255,0.1)",
  },
  {
    id: "walnut",
    label: "Walnut",
    lightSquare: "#E8D0AA",
    darkSquare: "#9C7A4B",
    selectedOverlay: "rgba(255, 240, 100, 0.45)",
    lastMoveOverlay: "rgba(200, 180, 60, 0.4)",
    checkOverlay: "rgba(255, 40, 40, 0.55)",
    legalMoveDot: "rgba(0, 0, 0, 0.2)",
    legalCaptureRing: "rgba(0, 0, 0, 0.2)",
    coordOnLight: "#9C7A4B",
    coordOnDark: "#E8D0AA",
    whitePiece: "#FFF8E7",
    blackPiece: "#2C1B0E",
    whitePieceStroke: "rgba(0,0,0,0.2)",
    blackPieceStroke: "rgba(255,255,255,0.12)",
  },
  {
    id: "ocean",
    label: "Ocean",
    lightSquare: "#D4E4F7",
    darkSquare: "#5B8DBE",
    selectedOverlay: "rgba(100, 255, 200, 0.4)",
    lastMoveOverlay: "rgba(100, 255, 200, 0.3)",
    checkOverlay: "rgba(255, 60, 60, 0.5)",
    legalMoveDot: "rgba(0, 0, 0, 0.2)",
    legalCaptureRing: "rgba(0, 0, 0, 0.2)",
    coordOnLight: "#5B8DBE",
    coordOnDark: "#D4E4F7",
    whitePiece: "#FFFFFF",
    blackPiece: "#1A2A3A",
    whitePieceStroke: "rgba(0,0,0,0.18)",
    blackPieceStroke: "rgba(255,255,255,0.12)",
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    lightSquare: "#FFFFFF",
    darkSquare: "#555555",
    selectedOverlay: "rgba(0, 120, 255, 0.5)",
    lastMoveOverlay: "rgba(255, 200, 0, 0.55)",
    checkOverlay: "rgba(255, 0, 0, 0.6)",
    legalMoveDot: "rgba(0, 120, 255, 0.5)",
    legalCaptureRing: "rgba(255, 0, 0, 0.5)",
    coordOnLight: "#333333",
    coordOnDark: "#FFFFFF",
    whitePiece: "#FFFFFF",
    blackPiece: "#000000",
    whitePieceStroke: "rgba(0,0,0,0.5)",
    blackPieceStroke: "rgba(255,255,255,0.4)",
    isHighContrast: true,
  },
];

/** Default theme ID */
export const DEFAULT_BOARD_THEME_ID = "classic";

/** Look up a theme by ID; falls back to classic */
export function getBoardTheme(id: string): ChessBoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}
