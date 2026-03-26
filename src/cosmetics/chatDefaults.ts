/**
 * Chat Cosmetic Defaults
 *
 * Default values for chat appearance when no cosmetic is equipped.
 * These defaults do NOT depend on theme selection — only on system
 * appearance mode (light/dark).
 *
 * @module cosmetics/chatDefaults
 */

// =============================================================================
// Default Bubble Colors
// =============================================================================

/** Default outgoing bubble background for light mode. */
export const DEFAULT_CHAT_BUBBLE_COLOR_LIGHT = "#1976D2";

/** Default outgoing bubble background for dark mode. */
export const DEFAULT_CHAT_BUBBLE_COLOR_DARK = "#64B5F6";

/** Default outgoing bubble text color for light mode. */
export const DEFAULT_CHAT_BUBBLE_TEXT_COLOR_LIGHT = "#FFFFFF";

/** Default outgoing bubble text color for dark mode. */
export const DEFAULT_CHAT_BUBBLE_TEXT_COLOR_DARK = "#000000";

// =============================================================================
// Default Font
// =============================================================================

/**
 * Default chat font ID.
 * null means "use the system/platform default font".
 */
export const DEFAULT_CHAT_FONT_ID: string | null = null;

/**
 * Default font family string (platform default).
 * When null, React Native uses the platform default font.
 */
export const DEFAULT_CHAT_FONT_FAMILY: string | undefined = undefined;

// =============================================================================
// Default Font Color
// =============================================================================

/**
 * Default chat font color ID.
 * null means "use the active theme's text token (theme-adaptive)".
 */
export const DEFAULT_CHAT_FONT_COLOR_ID: string | null = null;

// =============================================================================
// Supported Chat Fonts
// =============================================================================

/**
 * Registry of font families available for chat cosmetics.
 * Maps font catalog IDs to the fontFamily string used in React Native styles.
 *
 * System-available fonts are used first. Custom fonts loaded via expo-font
 * can be added here as well — just ensure they are loaded before use.
 */
export const CHAT_FONT_FAMILIES: Record<string, string> = {
  font_system: "System",
  font_monospace: "monospace",
  font_serif: "serif",
  font_rounded: "pf_agency", // Agency FB — clean geometric letterforms
  font_handwritten: "pf_bradleyhand", // Bradley Hand ITC
  font_retro: "pf_bauhaus", // Bauhaus 93 — retro geometric
  font_elegant: "pf_bellmt", // Bell MT — elegant serif
  font_comic: "pf_chiller", // Chiller — fun comic style
};

/**
 * Look up the fontFamily string for a given chat font catalog ID.
 * Returns undefined if the font ID is unknown (caller should fall back to default).
 */
export function getChatFontFamily(fontId: string | null): string | undefined {
  if (!fontId) return DEFAULT_CHAT_FONT_FAMILY;
  return CHAT_FONT_FAMILIES[fontId] ?? DEFAULT_CHAT_FONT_FAMILY;
}

// =============================================================================
// Bubble Color Lookup
// =============================================================================

/**
 * Registry of bubble color values keyed by catalog ID.
 * Populated from catalog metadata at module load time — but having a
 * static map here lets us resolve colors without scanning the catalog.
 */
export const CHAT_BUBBLE_COLORS: Record<string, string> = {
  // These will be populated from catalog entries' metadata.bubbleColorValue.
  // Keeping a static mirror here for O(1) lookup.
  bubble_purple: "#6200EE",
  bubble_blue: "#1976D2",
  bubble_teal: "#00897B",
  bubble_green: "#2E7D32",
  bubble_red: "#C62828",
  bubble_orange: "#E65100",
  bubble_pink: "#AD1457",
  bubble_indigo: "#283593",
  bubble_cyan: "#00838F",
  bubble_amber: "#FF8F00",
  bubble_deep_purple: "#4527A0",
  bubble_lime: "#9E9D24",
  bubble_rose: "#E91E63",
  bubble_slate: "#37474F",
  bubble_midnight: "#1A237E",
  bubble_coral: "#FF6F61",
};

/**
 * Look up the hex color for a bubble color cosmetic ID.
 * Returns null if unknown (caller should use mode-based default).
 */
export function getChatBubbleColor(
  bubbleColorId: string | null,
): string | null {
  if (!bubbleColorId) return null;
  return CHAT_BUBBLE_COLORS[bubbleColorId] ?? null;
}

// =============================================================================
// Font Color Lookup
// =============================================================================

/**
 * Registry of font color values keyed by catalog ID.
 * Mirrors CHAT_BUBBLE_COLORS pattern — static map for O(1) lookup.
 */
export const CHAT_FONT_COLORS: Record<string, string> = {
  // Free / Starter
  font_color_snow: "#FFFFFF",
  font_color_charcoal: "#2D2D2D",
  font_color_silver: "#B0B0B0",
  // Shop (Common)
  font_color_sky_blue: "#64B5F6",
  font_color_lavender: "#B39DDB",
  font_color_mint: "#80CBC4",
  font_color_rose: "#F48FB1",
  font_color_peach: "#FFAB91",
  // Shop (Uncommon)
  font_color_coral: "#FF8A65",
  font_color_gold: "#FFD54F",
  font_color_aqua: "#4DD0E1",
  font_color_lime: "#AED581",
  // Shop (Rare)
  font_color_neon_pink: "#FF4081",
  font_color_electric_blue: "#448AFF",
  font_color_emerald: "#66BB6A",
};

/**
 * Look up the hex color for a font color cosmetic ID.
 * Returns null if unknown or null input (caller should use theme-adaptive default).
 */
export function getChatFontColor(fontColorId: string | null): string | null {
  if (!fontColorId) return null;
  return CHAT_FONT_COLORS[fontColorId] ?? null;
}
