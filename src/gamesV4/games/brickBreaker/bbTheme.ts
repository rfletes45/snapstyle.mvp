/**
 * Brick Breaker — Design Tokens & Theme
 *
 * Single source of truth for all visual constants: colors, gradients,
 * typography, spacing, and radii. Keeps the main screen file focused
 * on layout and logic rather than magic numbers.
 *
 * @module gamesV4/games/brickBreaker/bbTheme
 */

// =============================================================================
// Background & Surface
// =============================================================================

export const BG = {
  /** Full-screen gradient (top → bottom). */
  gradient: ["#0B0D1A", "#111428", "#0B0D1A"] as const,
  /** Playfield glass panel fill. */
  fieldFill: "rgba(10, 12, 30, 0.85)",
  /** Playfield glass border. */
  fieldBorder: "rgba(255, 255, 255, 0.08)",
  /** Playfield inner top highlight. */
  fieldHighlight: "rgba(255, 255, 255, 0.04)",
  /** Vignette overlay color (edges only). */
  vignetteColor: "rgba(0, 0, 0, 0.55)",
} as const;

// =============================================================================
// HUD Chips
// =============================================================================

export const CHIP = {
  bg: "rgba(255, 255, 255, 0.08)",
  border: "rgba(255, 255, 255, 0.12)",
  radius: 10,
  paddingH: 10,
  paddingV: 5,
  /** Pre-built base ViewStyle for convenience spreads. */
  base: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
} as const;

// =============================================================================
// Typography
// =============================================================================

export const TYPO = {
  title: { fontSize: 38, fontWeight: "800" as const, letterSpacing: -1 },
  subtitle: { fontSize: 15, fontWeight: "500" as const, letterSpacing: 0.2 },
  hudLabel: { fontSize: 13, fontWeight: "700" as const },
  hudValue: { fontSize: 15, fontWeight: "800" as const },
  score: { fontSize: 16, fontWeight: "800" as const },
  combo: { fontSize: 13, fontWeight: "800" as const },
  button: { fontSize: 17, fontWeight: "700" as const, letterSpacing: 0.3 },
  servePrompt: { fontSize: 16, fontWeight: "700" as const },
  levelBig: { fontSize: 15, fontWeight: "800" as const },
  levelSub: { fontSize: 11, fontWeight: "500" as const },
  cardLabel: { fontSize: 12, fontWeight: "600" as const },
  pauseTitle: { fontSize: 22, fontWeight: "800" as const },
  pauseButton: { fontSize: 15, fontWeight: "700" as const },
} as const;

// =============================================================================
// Colors
// =============================================================================

export const CLR = {
  text: "#EAEAFF",
  textDim: "rgba(234, 234, 255, 0.55)",
  accent: "#6C5CE7",
  accentLight: "#A29BFE",
  heart: "#FF6B81",
  heartEmpty: "rgba(255, 107, 129, 0.25)",
  gold: "#FFD700",
  comboGlow: "rgba(255, 215, 0, 0.35)",
  white: "#FFFFFF",
  /** Start Campaign button gradient. */
  btnGradient: ["#6C5CE7", "#A29BFE"] as const,
  btnShadow: "rgba(108, 92, 231, 0.45)",
  /** Pause FAB background. */
  pauseFab: "rgba(255, 255, 255, 0.10)",
  pauseFabBorder: "rgba(255, 255, 255, 0.15)",
  /** Glass modal. */
  modalBg: "rgba(16, 18, 35, 0.92)",
  modalBorder: "rgba(255, 255, 255, 0.10)",
  /** Shield bar. */
  shield: "#6C5CE7",
  shieldGlow: "rgba(108, 92, 231, 0.6)",
} as const;

// =============================================================================
// Brick Palette (row-indexed, richer than before)
// =============================================================================

export const BRICK_ROW_COLORS: string[] = [
  "#E53935", // row 0 — red
  "#FF7043", // row 1 — deep orange
  "#FFA726", // row 2 — orange / amber
  "#FFCA28", // row 3 — golden yellow
  "#66BB6A", // row 4 — green
  "#26A69A", // row 5 — teal
  "#42A5F5", // row 6 — blue
  "#5C6BC0", // row 7 — indigo
  "#7E57C2", // row 8 — purple
  "#EC407A", // row 9 — pink
];

/** Top-edge highlight color per brick. */
export const BRICK_HIGHLIGHT = "rgba(255, 255, 255, 0.30)";
/** Bottom-edge shadow color per brick. */
export const BRICK_SHADOW = "rgba(0, 0, 0, 0.25)";
/** Crack overlay color for damaged multi-hp bricks. */
export const BRICK_CRACK = "rgba(0, 0, 0, 0.35)";
/** Steel metallic gradient stops. */
export const STEEL_COLORS = ["#B0BEC5", "#78909C", "#546E7A"] as const;

// =============================================================================
// Ball
// =============================================================================

export const BALL = {
  fill: "#FFFFFF",
  glow: "rgba(255, 255, 255, 0.45)",
  glowRadius: 6,
  highlightSize: 0.3, // fraction of ball radius for specular dot
  trailAlphaStart: 0.35,
  trailSegments: 5,
  trailColor: "rgba(255, 255, 255, 0.35)",
} as const;

// =============================================================================
// Paddle
// =============================================================================

export const PADDLE = {
  gradient: ["#E0E0E0", "#BDBDBD"] as const,
  fill: "#E0E0E0",
  highlight: "rgba(255, 255, 255, 0.35)",
  glow: "rgba(224, 224, 224, 0.30)",
  radius: 5,
} as const;

// =============================================================================
// Particles
// =============================================================================

export const PARTICLE = {
  maxPerBurst: 8,
  maxAlive: 60,
  burstSpeed: 2.5, // px per frame
  lifetime: 20, // frames
  sizeMin: 2,
  sizeMax: 5,
  gravity: 0.12, // px per frame downward
  powerupSparkles: 5,
} as const;

// =============================================================================
// Spacing & Radii
// =============================================================================

export const SPACE = {
  /** Horizontal margin for playfield. */
  fieldMarginH: 8,
  /** Shell back/options button row height. */
  shellRowH: 44,
  /** Approximate HUD chip height (used for layout math). */
  hudChipH: 32,
  /** Vertical gap between HUD chip bottom and field top. */
  hudFieldGap: 8,
  /** Playfield corner radius. */
  fieldRadius: 16,
  /** Brick corner radius. */
  brickRadius: 3,
  /** Pause FAB size. */
  pauseFabSize: 42,
  /** Pause FAB right inset. */
  pauseFabRight: 16,
  /** Pause FAB bottom inset (above safe area). */
  pauseFabBottom: 18,
} as const;

// =============================================================================
// Powerup badge colors (keep existing from types.ts, re-export for convenience)
// =============================================================================

export { POWERUP_COLORS, POWERUP_ICONS } from "./types";

