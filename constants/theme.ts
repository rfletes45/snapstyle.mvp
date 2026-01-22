/**
 * Vibe Design System
 * Catppuccin-inspired pastel palette with full theme support
 *
 * Light mode: "Latte" inspired
 * Dark mode: "Mocha" inspired
 *
 * Single source of truth for:
 * - Color tokens (light + dark)
 * - React Native Paper theme
 * - React Navigation theme
 * - Spacing, radius, typography, elevation
 */

import { Platform } from "react-native";
import {
  MD3LightTheme,
  MD3DarkTheme,
  configureFonts,
} from "react-native-paper";
import type { MD3Theme } from "react-native-paper";
import type { Theme as NavigationTheme } from "@react-navigation/native";

// ============================================================================
// CATPPUCCIN-INSPIRED COLOR TOKENS
// ============================================================================

/**
 * Latte (Light Mode) - Warm, soft pastels
 */
export const Latte = {
  // Base backgrounds
  base: "#eff1f5",
  mantle: "#e6e9ef",
  crust: "#dce0e8",
  surface0: "#ccd0da",
  surface1: "#bcc0cc",
  surface2: "#acb0be",

  // Text
  text: "#4c4f69",
  subtext1: "#5c5f77",
  subtext0: "#6c6f85",

  // Overlay (for modals, elevated surfaces)
  overlay2: "#7c7f93",
  overlay1: "#8c8fa1",
  overlay0: "#9ca0b0",

  // Accent colors
  rosewater: "#dc8a78",
  flamingo: "#dd7878",
  pink: "#ea76cb",
  mauve: "#8839ef", // Primary
  red: "#d20f39",
  maroon: "#e64553",
  peach: "#fe640b", // Accent
  yellow: "#df8e1d",
  green: "#40a02b",
  teal: "#179299",
  sky: "#04a5e5",
  sapphire: "#209fb5",
  blue: "#1e66f5",
  lavender: "#7287fd",
};

/**
 * Mocha (Dark Mode) - Rich, deep tones
 */
export const Mocha = {
  // Base backgrounds
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",

  // Text
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",

  // Overlay (for modals, elevated surfaces)
  overlay2: "#9399b2",
  overlay1: "#7f849c",
  overlay0: "#6c7086",

  // Accent colors
  rosewater: "#f5e0dc",
  flamingo: "#f2cdcd",
  pink: "#f5c2e7",
  mauve: "#cba6f7", // Primary
  red: "#f38ba8",
  maroon: "#eba0ac",
  peach: "#fab387", // Accent
  yellow: "#f9e2af",
  green: "#a6e3a1",
  teal: "#94e2d5",
  sky: "#89dceb",
  sapphire: "#74c7ec",
  blue: "#89b4fa",
  lavender: "#b4befe",
};

// ============================================================================
// SEMANTIC COLOR MAPPING
// ============================================================================

export interface ThemeColors {
  // Backgrounds
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceElevated: string;

  // Primary brand
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;

  // Secondary/Accent
  secondary: string;
  secondaryContainer: string;
  onSecondary: string;
  onSecondaryContainer: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;

  // Status
  success: string;
  successContainer: string;
  warning: string;
  warningContainer: string;
  error: string;
  errorContainer: string;
  info: string;
  infoContainer: string;

  // Ritual (streak) colors
  ritual: string;
  ritualGlow: string;

  // Cards
  cardConnection: string;
  cardConnectionBorder: string;
  cardRequest: string;
  cardRequestBorder: string;
  cardSent: string;

  // Borders & Dividers
  border: string;
  divider: string;
  outline: string;

  // Overlay
  overlay: string;
  overlayLight: string;

  // Tab bar
  tabActive: string;
  tabInactive: string;

  // Header
  headerBackground: string;
  headerText: string;
}

export const LightColors: ThemeColors = {
  // Backgrounds
  background: Latte.base,
  surface: "#ffffff",
  surfaceVariant: Latte.mantle,
  surfaceElevated: "#ffffff",

  // Primary brand - Mauve/Lavender
  primary: Latte.mauve,
  primaryContainer: "#f3e8ff",
  onPrimary: "#ffffff",
  onPrimaryContainer: Latte.mauve,

  // Secondary/Accent - Peach
  secondary: Latte.peach,
  secondaryContainer: "#fff0e6",
  onSecondary: "#ffffff",
  onSecondaryContainer: Latte.peach,

  // Text
  text: Latte.text,
  textSecondary: Latte.subtext1,
  textMuted: Latte.overlay1,
  textOnPrimary: "#ffffff",

  // Status
  success: Latte.green,
  successContainer: "#e8f5e9",
  warning: Latte.yellow,
  warningContainer: "#fff8e1",
  error: Latte.red,
  errorContainer: "#ffebee",
  info: Latte.sapphire,
  infoContainer: "#e3f2fd",

  // Ritual colors
  ritual: Latte.flamingo,
  ritualGlow: Latte.rosewater,

  // Cards
  cardConnection: "#f5f0ff",
  cardConnectionBorder: Latte.lavender,
  cardRequest: "#fff5eb",
  cardRequestBorder: Latte.peach,
  cardSent: Latte.mantle,

  // Borders & Dividers
  border: Latte.surface1,
  divider: Latte.surface0,
  outline: Latte.surface2,

  // Overlay
  overlay: "rgba(76, 79, 105, 0.5)",
  overlayLight: "rgba(76, 79, 105, 0.3)",

  // Tab bar
  tabActive: Latte.mauve,
  tabInactive: Latte.overlay1,

  // Header
  headerBackground: "#ffffff",
  headerText: Latte.text,
};

export const DarkColors: ThemeColors = {
  // Backgrounds
  background: Mocha.base,
  surface: Mocha.surface0,
  surfaceVariant: Mocha.mantle,
  surfaceElevated: Mocha.surface1,

  // Primary brand - Mauve/Lavender
  primary: Mocha.mauve,
  primaryContainer: "#3d2466",
  onPrimary: Mocha.crust,
  onPrimaryContainer: Mocha.lavender,

  // Secondary/Accent - Peach
  secondary: Mocha.peach,
  secondaryContainer: "#5c3d2e",
  onSecondary: Mocha.crust,
  onSecondaryContainer: Mocha.peach,

  // Text
  text: Mocha.text,
  textSecondary: Mocha.subtext1,
  textMuted: Mocha.overlay1,
  textOnPrimary: Mocha.crust,

  // Status
  success: Mocha.green,
  successContainer: "#2d4a2d",
  warning: Mocha.yellow,
  warningContainer: "#4a4428",
  error: Mocha.red,
  errorContainer: "#4a2d2d",
  info: Mocha.sapphire,
  infoContainer: "#2d3d4a",

  // Ritual colors
  ritual: Mocha.flamingo,
  ritualGlow: Mocha.rosewater,

  // Cards
  cardConnection: "#2d2640",
  cardConnectionBorder: Mocha.lavender,
  cardRequest: "#402d28",
  cardRequestBorder: Mocha.peach,
  cardSent: Mocha.surface0,

  // Borders & Dividers
  border: Mocha.surface1,
  divider: Mocha.surface0,
  outline: Mocha.surface2,

  // Overlay
  overlay: "rgba(0, 0, 0, 0.6)",
  overlayLight: "rgba(0, 0, 0, 0.4)",

  // Tab bar
  tabActive: Mocha.mauve,
  tabInactive: Mocha.overlay1,

  // Header
  headerBackground: Mocha.mantle,
  headerText: Mocha.text,
};

// ============================================================================
// LEGACY COMPATIBILITY (AppColors maps to light theme)
// ============================================================================

/**
 * @deprecated Use theme colors via useAppTheme() hook instead
 * Kept for gradual migration
 */
export const AppColors = {
  // Primary brand colors
  primary: LightColors.primary,
  primaryLight: "#c4b5fd",
  primaryDark: "#6d28d9",

  // Secondary/accent colors
  secondary: LightColors.secondary,
  secondaryLight: "#fed7aa",
  secondaryDark: "#c2410c",

  // Status colors
  success: LightColors.success,
  successLight: LightColors.successContainer,
  warning: LightColors.warning,
  warningLight: LightColors.warningContainer,
  error: LightColors.error,
  errorLight: LightColors.errorContainer,
  info: LightColors.info,
  infoLight: LightColors.infoContainer,

  // Streak colors -> Ritual colors
  streak: LightColors.ritual,
  streakGlow: LightColors.ritualGlow,

  // Background colors
  background: LightColors.background,
  surface: LightColors.surface,
  surfaceVariant: LightColors.surfaceVariant,

  // Card colors by type
  friendCard: LightColors.cardConnection,
  friendCardBorder: LightColors.cardConnectionBorder,
  requestCard: LightColors.cardRequest,
  requestCardBorder: LightColors.cardRequestBorder,
  sentRequestCard: LightColors.cardSent,

  // Text colors
  textPrimary: LightColors.text,
  textSecondary: LightColors.textSecondary,
  textMuted: LightColors.textMuted,
  textOnPrimary: LightColors.textOnPrimary,

  // Border colors
  border: LightColors.border,
  divider: LightColors.divider,

  // Overlay colors
  overlay: LightColors.overlay,
  overlayLight: LightColors.overlayLight,
};

// ============================================================================
// SPACING & LAYOUT
// ============================================================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
} as const;

export const FontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export const Fonts = Platform.select({
  ios: {
    sans: "System",
    serif: "Georgia",
    rounded: "System",
    mono: "Menlo",
  },
  android: {
    sans: "Roboto",
    serif: "serif",
    rounded: "Roboto",
    mono: "monospace",
  },
  default: {
    sans: "System",
    serif: "serif",
    rounded: "System",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

// ============================================================================
// ELEVATION / SHADOWS
// ============================================================================

export const Elevation = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ============================================================================
// REACT NATIVE PAPER THEMES
// ============================================================================

const fontConfig = {
  fontFamily: Fonts?.sans || "System",
};

export const PaperLightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: BorderRadius.md,
  colors: {
    ...MD3LightTheme.colors,
    primary: LightColors.primary,
    onPrimary: LightColors.onPrimary,
    primaryContainer: LightColors.primaryContainer,
    onPrimaryContainer: LightColors.onPrimaryContainer,
    secondary: LightColors.secondary,
    onSecondary: LightColors.onSecondary,
    secondaryContainer: LightColors.secondaryContainer,
    onSecondaryContainer: LightColors.onSecondaryContainer,
    background: LightColors.background,
    onBackground: LightColors.text,
    surface: LightColors.surface,
    onSurface: LightColors.text,
    surfaceVariant: LightColors.surfaceVariant,
    onSurfaceVariant: LightColors.textSecondary,
    error: LightColors.error,
    onError: "#ffffff",
    errorContainer: LightColors.errorContainer,
    onErrorContainer: LightColors.error,
    outline: LightColors.outline,
    outlineVariant: LightColors.border,
    elevation: {
      level0: "transparent",
      level1: LightColors.surface,
      level2: LightColors.surfaceVariant,
      level3: LightColors.surfaceElevated,
      level4: LightColors.surfaceElevated,
      level5: LightColors.surfaceElevated,
    },
  },
  fonts: configureFonts({ config: fontConfig }),
};

export const PaperDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: BorderRadius.md,
  colors: {
    ...MD3DarkTheme.colors,
    primary: DarkColors.primary,
    onPrimary: DarkColors.onPrimary,
    primaryContainer: DarkColors.primaryContainer,
    onPrimaryContainer: DarkColors.onPrimaryContainer,
    secondary: DarkColors.secondary,
    onSecondary: DarkColors.onSecondary,
    secondaryContainer: DarkColors.secondaryContainer,
    onSecondaryContainer: DarkColors.onSecondaryContainer,
    background: DarkColors.background,
    onBackground: DarkColors.text,
    surface: DarkColors.surface,
    onSurface: DarkColors.text,
    surfaceVariant: DarkColors.surfaceVariant,
    onSurfaceVariant: DarkColors.textSecondary,
    error: DarkColors.error,
    onError: Mocha.crust,
    errorContainer: DarkColors.errorContainer,
    onErrorContainer: DarkColors.error,
    outline: DarkColors.outline,
    outlineVariant: DarkColors.border,
    elevation: {
      level0: "transparent",
      level1: DarkColors.surface,
      level2: DarkColors.surfaceVariant,
      level3: DarkColors.surfaceElevated,
      level4: DarkColors.surfaceElevated,
      level5: DarkColors.surfaceElevated,
    },
  },
  fonts: configureFonts({ config: fontConfig }),
};

// ============================================================================
// REACT NAVIGATION THEMES
// ============================================================================

export const NavigationLightTheme: NavigationTheme = {
  dark: false,
  colors: {
    primary: LightColors.primary,
    background: LightColors.background,
    card: LightColors.headerBackground,
    text: LightColors.headerText,
    border: LightColors.border,
    notification: LightColors.error,
  },
  fonts: {
    regular: { fontFamily: Fonts?.sans || "System", fontWeight: "400" },
    medium: { fontFamily: Fonts?.sans || "System", fontWeight: "500" },
    bold: { fontFamily: Fonts?.sans || "System", fontWeight: "700" },
    heavy: { fontFamily: Fonts?.sans || "System", fontWeight: "800" },
  },
};

export const NavigationDarkTheme: NavigationTheme = {
  dark: true,
  colors: {
    primary: DarkColors.primary,
    background: DarkColors.background,
    card: DarkColors.headerBackground,
    text: DarkColors.headerText,
    border: DarkColors.border,
    notification: DarkColors.error,
  },
  fonts: {
    regular: { fontFamily: Fonts?.sans || "System", fontWeight: "400" },
    medium: { fontFamily: Fonts?.sans || "System", fontWeight: "500" },
    bold: { fontFamily: Fonts?.sans || "System", fontWeight: "700" },
    heavy: { fontFamily: Fonts?.sans || "System", fontWeight: "800" },
  },
};

// ============================================================================
// COMBINED THEME HELPER
// ============================================================================

export interface AppTheme {
  colors: ThemeColors;
  paper: MD3Theme;
  navigation: NavigationTheme;
  spacing: typeof Spacing;
  radius: typeof BorderRadius;
  fonts: typeof FontSizes;
  elevation: typeof Elevation;
  isDark: boolean;
}

export function getTheme(isDark: boolean): AppTheme {
  return {
    colors: isDark ? DarkColors : LightColors,
    paper: isDark ? PaperDarkTheme : PaperLightTheme,
    navigation: isDark ? NavigationDarkTheme : NavigationLightTheme,
    spacing: Spacing,
    radius: BorderRadius,
    fonts: FontSizes,
    elevation: Elevation,
    isDark,
  };
}

// ============================================================================
// LEGACY EXPORTS (deprecated, for migration)
// ============================================================================

/**
 * @deprecated Use LightColors/DarkColors directly
 */
export const Colors = {
  light: {
    text: LightColors.text,
    background: LightColors.background,
    tint: LightColors.primary,
    icon: LightColors.textMuted,
    tabIconDefault: LightColors.tabInactive,
    tabIconSelected: LightColors.tabActive,
  },
  dark: {
    text: DarkColors.text,
    background: DarkColors.background,
    tint: DarkColors.primary,
    icon: DarkColors.textMuted,
    tabIconDefault: DarkColors.tabInactive,
    tabIconSelected: DarkColors.tabActive,
  },
};
