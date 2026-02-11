/**
 * Games Design System
 * Phase 6: UI/UX Specifications
 *
 * Extended design tokens for the games section including:
 * - Category-specific colors
 * - Game-specific palettes
 * - Typography scales
 * - Spacing system
 * - Animation constants
 *
 * @see docs/PROMPT_GAMES_EXPANSION.md - Phase 6
 * @see docs/11_GAMES_PHASE6.md for documentation
 */

import { Latte, Mocha } from "./theme";

// =============================================================================
// Game Category Colors
// =============================================================================

export const GAME_CATEGORY_COLORS = {
  /** Red for action/quick-play games */
  quickPlay: {
    light: "#FF6B6B",
    dark: "#FF8787",
    gradient: ["#FF6B6B", "#FF8E8E"],
  },
  /** Teal for puzzle games */
  puzzle: {
    light: "#4ECDC4",
    dark: "#5EDDD4",
    gradient: ["#4ECDC4", "#6EE7DE"],
  },
  /** Purple for multiplayer games */
  multiplayer: {
    light: "#6C5CE7",
    dark: "#8B7CF7",
    gradient: ["#6C5CE7", "#8C7CF7"],
  },
  /** Gold for achievements */
  achievements: {
    light: "#FFD700",
    dark: "#FFE44D",
    gradient: ["#FFD700", "#FFF066"],
  },
  /** Blue for leaderboards */
  leaderboards: {
    light: "#4A90D9",
    dark: "#6AABE9",
    gradient: ["#4A90D9", "#7ABDF9"],
  },
} as const;

// =============================================================================
// Game-Specific Color Palettes
// =============================================================================

export const GAME_PALETTES = {
  /** Bounce Blitz color scheme */
  bounce: {
    ball: {
      light: "#FF6B6B",
      dark: "#FF8787",
    },
    ballGlow: {
      light: "rgba(255, 107, 107, 0.3)",
      dark: "rgba(255, 135, 135, 0.4)",
    },
    block: {
      light: "#6C5CE7",
      dark: "#8B7CF7",
    },
    blockHit: {
      light: "#A29BFE",
      dark: "#B2ABFE",
    },
    background: {
      light: "#E8E8F0",
      dark: "#1A1A2E",
    },
    backgroundGradient: {
      light: ["#F0F0F8", "#E0E0E8"],
      dark: ["#1A1A2E", "#16162A"],
    },
  },

  /** Memory Snap color scheme */
  memory: {
    cardFront: {
      light: "#FFFFFF",
      dark: "#2D2D3D",
    },
    cardBack: {
      light: Latte.mauve,
      dark: Mocha.mauve,
    },
    cardMatched: {
      light: Latte.green,
      dark: Mocha.green,
    },
    cardBorder: {
      light: Latte.surface1,
      dark: Mocha.surface1,
    },
  },

  /** Chess color scheme */
  chess: {
    lightSquare: {
      light: "#F0D9B5",
      dark: "#E8D0A8",
    },
    darkSquare: {
      light: "#B58863",
      dark: "#A57853",
    },
    highlight: {
      light: "#BACA2B",
      dark: "#CADA3B",
    },
    lastMove: {
      light: "rgba(186, 202, 43, 0.5)",
      dark: "rgba(202, 218, 59, 0.5)",
    },
    check: {
      light: "#FF6B6B",
      dark: "#FF8787",
    },
    legalMove: {
      light: "rgba(0, 0, 0, 0.15)",
      dark: "rgba(255, 255, 255, 0.2)",
    },
    capture: {
      light: "rgba(255, 107, 107, 0.4)",
      dark: "rgba(255, 135, 135, 0.5)",
    },
    selected: {
      light: "#829769",
      dark: "#92A779",
    },
  },

  /** Checkers color scheme */
  checkers: {
    lightSquare: {
      light: "#EDDBC0",
      dark: "#D8C8A8",
    },
    darkSquare: {
      light: "#8B4513",
      dark: "#7B3503",
    },
    redPiece: {
      light: "#DC143C",
      dark: "#EC243C",
    },
    redPieceKing: {
      light: "#FFD700",
      dark: "#FFE720",
    },
    blackPiece: {
      light: "#2F2F2F",
      dark: "#1F1F1F",
    },
    blackPieceKing: {
      light: "#C0C0C0",
      dark: "#D0D0D0",
    },
    validMove: {
      light: "rgba(76, 175, 80, 0.4)",
      dark: "rgba(96, 195, 100, 0.5)",
    },
  },

  /** Pool/Billiards color scheme */
  pool: {
    felt: {
      light: "#0A5F38",
      dark: "#0A4F28",
    },
    feltTexture: {
      light: "#0C6F48",
      dark: "#0C5F38",
    },
    rail: {
      light: "#5D3FD3",
      dark: "#4D2FC3",
    },
    railHighlight: {
      light: "#7D5FE3",
      dark: "#6D4FD3",
    },
    cueBall: {
      light: "#FFFFF0",
      dark: "#FFFFF0",
    },
    solidBall: {
      light: "#FFD700",
      dark: "#FFE720",
    },
    stripeBall: {
      light: "#E74C3C",
      dark: "#F75C4C",
    },
    eightBall: {
      light: "#1A1A1A",
      dark: "#0A0A0A",
    },
    pocket: {
      light: "#0D0D0D",
      dark: "#050505",
    },
    cue: {
      light: "#DEB887",
      dark: "#CDA877",
    },
    aimLine: {
      light: "rgba(255, 255, 255, 0.6)",
      dark: "rgba(255, 255, 255, 0.5)",
    },
  },

  /** Tic-Tac-Toe color scheme */
  ticTacToe: {
    grid: {
      light: Latte.surface2,
      dark: Mocha.surface2,
    },
    xColor: {
      light: "#FF6B6B",
      dark: "#FF8787",
    },
    oColor: {
      light: "#4ECDC4",
      dark: "#5EDDD4",
    },
    winLine: {
      light: Latte.mauve,
      dark: Mocha.mauve,
    },
  },
} as const;

// =============================================================================
// Game Typography
// =============================================================================

export const GAME_TYPOGRAPHY = {
  /** Large score display */
  score: {
    fontSize: 48,
    fontWeight: "900" as const,
    fontFamily: "monospace",
    letterSpacing: 2,
  },
  /** Medium score (game over) */
  scoreMedium: {
    fontSize: 36,
    fontWeight: "800" as const,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  /** Small score (in-game HUD) */
  scoreSmall: {
    fontSize: 24,
    fontWeight: "700" as const,
    fontFamily: "monospace",
  },
  /** Timer display */
  timer: {
    fontSize: 24,
    fontWeight: "700" as const,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  /** Countdown (3, 2, 1, GO!) */
  countdown: {
    fontSize: 72,
    fontWeight: "900" as const,
  },
  /** Game title in cards */
  gameTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  /** Stats label */
  statLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  /** Stats value */
  statValue: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  /** Move notation (chess) */
  moveNotation: {
    fontSize: 14,
    fontFamily: "monospace",
  },
  /** Rating display */
  rating: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  /** Win/Loss record */
  record: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
} as const;

// =============================================================================
// Game Spacing
// =============================================================================

export const GAME_SPACING = {
  /** Extra small - 4px */
  xs: 4,
  /** Small - 8px */
  sm: 8,
  /** Medium - 16px */
  md: 16,
  /** Large - 24px */
  lg: 24,
  /** Extra large - 32px */
  xl: 32,
  /** Double extra large - 48px */
  xxl: 48,
} as const;

// =============================================================================
// Game Border Radii
// =============================================================================

export const GAME_BORDER_RADIUS = {
  /** Small - 4px (chips, badges) */
  sm: 4,
  /** Medium - 8px (cards) */
  md: 8,
  /** Large - 12px (game cards) */
  lg: 12,
  /** Extra large - 16px (modals) */
  xl: 16,
  /** Round - 9999px (avatars, circular) */
  round: 9999,
} as const;

// =============================================================================
// Animation Constants
// =============================================================================

export const GAME_ANIMATIONS = {
  /** Quick micro-interaction */
  fast: 150,
  /** Standard transition */
  normal: 250,
  /** Slower, emphasis transition */
  slow: 400,
  /** Long animation (achievement unlocks) */
  emphasis: 600,

  /** Spring configs for react-native-reanimated */
  spring: {
    snappy: {
      damping: 15,
      stiffness: 150,
      mass: 1,
    },
    bouncy: {
      damping: 10,
      stiffness: 100,
      mass: 1,
    },
    gentle: {
      damping: 20,
      stiffness: 80,
      mass: 1,
    },
  },

  /** Easing presets */
  easing: {
    easeInOut: "easeInOut",
    easeOut: "easeOut",
    easeIn: "easeIn",
    bounce: "bounce",
  },
} as const;

// =============================================================================
// Shadow Presets
// =============================================================================

export const GAME_SHADOWS = {
  /** Small shadow for cards */
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  /** Medium shadow for elevated content */
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  /** Large shadow for modals */
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  /** Glow effect (colored shadow) */
  glow: (color: string, intensity: number = 0.3) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: intensity,
    shadowRadius: 12,
    elevation: 0,
  }),
} as const;

// =============================================================================
// Game Status Colors
// =============================================================================

export const GAME_STATUS_COLORS = {
  /** Your turn indicator */
  yourTurn: {
    bg: {
      light: "#E8F5E9",
      dark: "#1B3B1E",
    },
    text: {
      light: "#2E7D32",
      dark: "#66BB6A",
    },
    dot: {
      light: "#4CAF50",
      dark: "#66BB6A",
    },
  },
  /** Opponent's turn indicator */
  theirTurn: {
    bg: {
      light: "#FFF3E0",
      dark: "#3D2B1F",
    },
    text: {
      light: "#EF6C00",
      dark: "#FFB74D",
    },
    dot: {
      light: "#FF9800",
      dark: "#FFB74D",
    },
  },
  /** Game completed - Victory */
  victory: {
    bg: {
      light: "#E3F2FD",
      dark: "#1A237E",
    },
    text: {
      light: "#1565C0",
      dark: "#64B5F6",
    },
  },
  /** Game completed - Defeat */
  defeat: {
    bg: {
      light: "#FFEBEE",
      dark: "#3D1F1F",
    },
    text: {
      light: "#C62828",
      dark: "#EF5350",
    },
  },
  /** Game completed - Draw */
  draw: {
    bg: {
      light: "#F5F5F5",
      dark: "#2D2D2D",
    },
    text: {
      light: "#757575",
      dark: "#BDBDBD",
    },
  },
  /** Waiting for opponent */
  waiting: {
    bg: {
      light: "#FFF8E1",
      dark: "#3D3520",
    },
    text: {
      light: "#F9A825",
      dark: "#FFD54F",
    },
  },
  /** Online status */
  online: {
    dot: "#4CAF50",
  },
  /** Offline status */
  offline: {
    dot: "#9E9E9E",
  },
} as const;

// =============================================================================
// Achievement Tier Colors
// =============================================================================

export const ACHIEVEMENT_TIER_COLORS = {
  bronze: {
    primary: "#CD7F32",
    secondary: "#E8A862",
    gradient: ["#CD7F32", "#E8A862"],
  },
  silver: {
    primary: "#C0C0C0",
    secondary: "#E8E8E8",
    gradient: ["#C0C0C0", "#E8E8E8"],
  },
  gold: {
    primary: "#FFD700",
    secondary: "#FFF066",
    gradient: ["#FFD700", "#FFF066"],
  },
  platinum: {
    primary: "#E5E4E2",
    secondary: "#F0EFED",
    gradient: ["#A8A8A8", "#E5E4E2"],
  },
  diamond: {
    primary: "#B9F2FF",
    secondary: "#E0F7FA",
    gradient: ["#4DD0E1", "#B9F2FF"],
  },
} as const;

// =============================================================================
// Leaderboard Colors
// =============================================================================

export const LEADERBOARD_COLORS = {
  /** 1st place - Gold */
  first: {
    bg: {
      light: "#FFF8E1",
      dark: "#3D3520",
    },
    text: {
      light: "#F9A825",
      dark: "#FFD54F",
    },
    medal: "#FFD700",
  },
  /** 2nd place - Silver */
  second: {
    bg: {
      light: "#F5F5F5",
      dark: "#2D2D2D",
    },
    text: {
      light: "#757575",
      dark: "#BDBDBD",
    },
    medal: "#C0C0C0",
  },
  /** 3rd place - Bronze */
  third: {
    bg: {
      light: "#FBE9E7",
      dark: "#3D2B25",
    },
    text: {
      light: "#BF360C",
      dark: "#FF8A65",
    },
    medal: "#CD7F32",
  },
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a color value based on theme mode
 */
export function getThemedColor(
  colorSet: { light: string; dark: string },
  isDarkMode: boolean,
): string {
  return isDarkMode ? colorSet.dark : colorSet.light;
}

/**
 * Get game palette for a specific game type
 */
export function getGamePalette(
  gameType: keyof typeof GAME_PALETTES,
  isDarkMode: boolean,
): Record<string, string> {
  const palette = GAME_PALETTES[gameType];
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(palette)) {
    if (typeof value === "object" && "light" in value) {
      result[key] = isDarkMode ? value.dark : value.light;
    }
  }

  return result;
}

/**
 * Get category color based on theme mode
 */
export function getCategoryColor(
  category: keyof typeof GAME_CATEGORY_COLORS,
  isDarkMode: boolean,
): string {
  return isDarkMode
    ? GAME_CATEGORY_COLORS[category].dark
    : GAME_CATEGORY_COLORS[category].light;
}

/**
 * Get status colors based on turn state
 */
export function getTurnStatusColors(
  isYourTurn: boolean,
  isDarkMode: boolean,
): { bg: string; text: string; dot: string } {
  const status = isYourTurn
    ? GAME_STATUS_COLORS.yourTurn
    : GAME_STATUS_COLORS.theirTurn;

  return {
    bg: isDarkMode ? status.bg.dark : status.bg.light,
    text: isDarkMode ? status.text.dark : status.text.light,
    dot: isDarkMode ? status.dot.dark : status.dot.light,
  };
}

// Note: PLAY_SCREEN_TOKENS is defined below and exported at the bottom of the file

// =============================================================================
// Play Screen Design Tokens (Phase 1)
// =============================================================================

/**
 * Design tokens for the Play Screen UI overhaul
 *
 * These tokens define the modern, tight, sleek aesthetic
 * with reduced border-radius and subtle shadows.
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 1
 */
export const PLAY_SCREEN_TOKENS = {
  // =========================================================================
  // Spacing
  // =========================================================================
  spacing: {
    /** Height of the custom header */
    headerHeight: 56,
    /** Height of the search bar input */
    searchBarHeight: 44,
    /** Gap between major sections */
    sectionGap: 24,
    /** Gap between cards in a list */
    cardGap: 10,
    /** Standard horizontal padding */
    horizontalPadding: 16,
    /** Gap between filter chips */
    chipGap: 8,
    /** Internal card padding */
    cardPadding: 12,
    /** Icon button touch target size */
    iconButtonSize: 40,
  },

  // =========================================================================
  // Border Radius (tighter/modern)
  // =========================================================================
  borderRadius: {
    /** Standard card border radius */
    card: 6,
    /** Larger card variants */
    cardLarge: 8,
    /** Buttons and small elements */
    button: 4,
    /** Chip/pill elements */
    chip: 16,
    /** Icon containers */
    icon: 6,
    /** Section containers */
    container: 12,
    /** Badge elements */
    badge: 10,
  },

  // =========================================================================
  // Shadows (subtle)
  // =========================================================================
  shadows: {
    /** Standard card shadow */
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    /** Card hover/pressed state */
    cardHover: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    /** Floating elements (FAB, banners) */
    floating: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    /** No shadow */
    none: {
      shadowColor: "transparent",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },

  // =========================================================================
  // Typography
  // =========================================================================
  typography: {
    /** Header title style */
    headerTitle: {
      fontSize: 24,
      fontWeight: "700" as const,
      lineHeight: 28,
    },
    /** Section title style */
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      lineHeight: 22,
    },
    /** Section subtitle style */
    sectionSubtitle: {
      fontSize: 13,
      fontWeight: "400" as const,
      lineHeight: 18,
    },
    /** Card title style */
    cardTitle: {
      fontSize: 15,
      fontWeight: "600" as const,
      lineHeight: 20,
    },
    /** Card subtitle style */
    cardSubtitle: {
      fontSize: 12,
      fontWeight: "400" as const,
      lineHeight: 16,
    },
    /** Button text style */
    buttonText: {
      fontSize: 12,
      fontWeight: "700" as const,
      lineHeight: 16,
    },
    /** Search input text */
    searchInput: {
      fontSize: 16,
      fontWeight: "400" as const,
      lineHeight: 22,
    },
    /** Filter chip text */
    chipText: {
      fontSize: 13,
      fontWeight: "500" as const,
      lineHeight: 18,
    },
    /** Badge text */
    badgeText: {
      fontSize: 10,
      fontWeight: "700" as const,
      lineHeight: 12,
    },
  },

  // =========================================================================
  // Colors (semantic)
  // =========================================================================
  colors: {
    /** Your turn indicator accent */
    yourTurnAccent: "#FF3B30",
    /** Waiting/their turn indicator accent */
    waitingAccent: "#8E8E93",
    /** New item badge background */
    newBadge: "#FF3B30",
    /** Invite badge background */
    inviteBadge: "#FF9500",
    /** Success color */
    success: "#34C759",
    /** Warning color */
    warning: "#FF9500",
    /** Search bar background (light) */
    searchBgLight: "#F2F2F7",
    /** Search bar background (dark) */
    searchBgDark: "#2C2C2E",
  },

  // =========================================================================
  // Icon Sizes
  // =========================================================================
  iconSizes: {
    /** Header action icons */
    headerIcon: 24,
    /** Search bar icon */
    searchIcon: 20,
    /** Card icons */
    cardIcon: 24,
    /** Compact card icons */
    cardIconSmall: 18,
    /** Featured card icons */
    cardIconLarge: 32,
    /** Game emoji in card */
    gameEmoji: 24,
    /** Badge icon */
    badgeIcon: 16,
  },

  // =========================================================================
  // Card Dimensions
  // =========================================================================
  cardDimensions: {
    /** Default card height */
    defaultHeight: 72,
    /** Compact card height */
    compactHeight: 56,
    /** Featured card height */
    featuredHeight: 140,
    /** Icon container size (default) */
    iconSize: 48,
    /** Icon container size (compact) */
    iconSizeCompact: 36,
    /** Icon container size (featured) */
    iconSizeFeatured: 64,
    /** Carousel tile width */
    tileWidth: 100,
    /** Carousel tile height */
    tileHeight: 110,
    /** Compact invite card width */
    inviteCardWidth: 140,
    /** Compact invite card height */
    inviteCardHeight: 100,
  },

  // =========================================================================
  // Animation Config
  // =========================================================================
  animation: {
    /** Spring config for press animations */
    pressSpring: {
      damping: 15,
      stiffness: 300,
    },
    /** Scale value when pressed */
    pressScale: 0.98,
    /** Duration for fade animations */
    fadeDuration: 200,
    /** Duration for slide animations */
    slideDuration: 300,
  },
} as const;

/**
 * Get play screen token value with type safety
 */
export function getPlayScreenToken<
  K extends keyof typeof PLAY_SCREEN_TOKENS,
  SK extends keyof (typeof PLAY_SCREEN_TOKENS)[K],
>(category: K, key: SK): (typeof PLAY_SCREEN_TOKENS)[K][SK] {
  return PLAY_SCREEN_TOKENS[category][key];
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  GAME_CATEGORY_COLORS,
  GAME_PALETTES,
  GAME_TYPOGRAPHY,
  GAME_SPACING,
  GAME_BORDER_RADIUS,
  GAME_ANIMATIONS,
  GAME_SHADOWS,
  GAME_STATUS_COLORS,
  ACHIEVEMENT_TIER_COLORS,
  LEADERBOARD_COLORS,
  PLAY_SCREEN_TOKENS,
  getThemedColor,
  getGamePalette,
  getCategoryColor,
  getTurnStatusColors,
  getPlayScreenToken,
};
