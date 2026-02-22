/**
 * Chat Appearance Resolver
 *
 * Resolves a user's chatAppearance fields to concrete display values
 * with fallback to defaults when cosmetic IDs are invalid or missing.
 *
 * Developer guardrails: logs warnings for invalid/missing catalog entries.
 *
 * @module cosmetics/chatAppearanceResolver
 */

import { getCosmeticById } from "./catalog";
import {
  DEFAULT_CHAT_BUBBLE_COLOR_DARK,
  DEFAULT_CHAT_BUBBLE_COLOR_LIGHT,
  DEFAULT_CHAT_FONT_FAMILY,
  getChatBubbleColor,
  getChatFontFamily,
} from "./chatDefaults";
import type { ChatAppearance, SenderStyle } from "./types";
import { DEFAULT_CHAT_APPEARANCE } from "./types";

// =============================================================================
// Types
// =============================================================================

/** Resolved chat style values ready for rendering. */
export interface ResolvedChatStyle {
  /** Background color for outgoing message bubbles. */
  bubbleBgColor: string;
  /** Text color for outgoing message bubbles (contrast-computed). */
  bubbleTextColor: string;
  /** Font family for outgoing messages (undefined = platform default). */
  fontFamily: string | undefined;
}

/** Options for resolving chat style. */
export interface ResolveChatStyleOptions {
  /** User's chatAppearance from their profile doc. */
  chatAppearance: ChatAppearance | null | undefined;
  /** Current appearance mode: light or dark. */
  appearanceMode: "light" | "dark";
}

// =============================================================================
// Luminance / Contrast Helpers
// =============================================================================

/**
 * Parse a hex color string to RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6 && cleaned.length !== 3) return null;

  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;

  const num = parseInt(full, 16);
  if (isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Compute relative luminance of a hex color (WCAG formula).
 */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [rs, gs, bs] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Choose black or white text color based on background luminance.
 * Returns white for dark backgrounds, black for light backgrounds.
 */
export function contrastTextColor(bgHex: string): string {
  const lum = relativeLuminance(bgHex);
  return lum > 0.179 ? "#000000" : "#FFFFFF";
}

// =============================================================================
// Dev Logger
// =============================================================================

const DEV = __DEV__;

function devWarn(message: string, data?: Record<string, unknown>) {
  if (DEV) {
    console.warn(`[chatAppearanceResolver] ${message}`, data ?? "");
  }
}

// =============================================================================
// Resolver
// =============================================================================

/**
 * Resolve a user's chatAppearance to concrete rendering values.
 *
 * Guardrails:
 * - If bubbleColorId references a non-existent catalog item → fall back to default, dev-log warning.
 * - If fontId references a non-existent catalog item → fall back to default, dev-log warning.
 * - If chatAppearance is null/undefined → use all defaults.
 */
export function resolveOutgoingChatStyle(
  options: ResolveChatStyleOptions,
): ResolvedChatStyle {
  const { appearanceMode } = options;
  const chatAppearance = options.chatAppearance ?? DEFAULT_CHAT_APPEARANCE;

  // -- Bubble Color --
  let bubbleBgColor: string;
  const defaultBg =
    appearanceMode === "dark"
      ? DEFAULT_CHAT_BUBBLE_COLOR_DARK
      : DEFAULT_CHAT_BUBBLE_COLOR_LIGHT;

  if (chatAppearance.bubbleColorId) {
    // Validate catalog entry exists
    const def = getCosmeticById(chatAppearance.bubbleColorId);
    if (!def || def.type !== "chat_bubble_color") {
      devWarn(
        `bubbleColorId "${chatAppearance.bubbleColorId}" not found in catalog or wrong type. Falling back to default.`,
        { bubbleColorId: chatAppearance.bubbleColorId },
      );
      bubbleBgColor = defaultBg;
    } else {
      const color = getChatBubbleColor(chatAppearance.bubbleColorId);
      if (!color) {
        devWarn(
          `bubbleColorId "${chatAppearance.bubbleColorId}" has no color value in chatDefaults map. Using metadata.`,
          { bubbleColorId: chatAppearance.bubbleColorId },
        );
        // Try metadata fallback
        const metaColor = def.metadata?.bubbleColorValue;
        bubbleBgColor = typeof metaColor === "string" ? metaColor : defaultBg;
      } else {
        bubbleBgColor = color;
      }
    }
  } else {
    bubbleBgColor = defaultBg;
  }

  // -- Text Color (auto-computed from bg luminance) --
  const bubbleTextColor = contrastTextColor(bubbleBgColor);

  // -- Font Family --
  let fontFamily: string | undefined;
  if (chatAppearance.fontId) {
    const def = getCosmeticById(chatAppearance.fontId);
    if (!def || def.type !== "chat_font") {
      devWarn(
        `fontId "${chatAppearance.fontId}" not found in catalog or wrong type. Falling back to default font.`,
        { fontId: chatAppearance.fontId },
      );
      fontFamily = DEFAULT_CHAT_FONT_FAMILY;
    } else {
      fontFamily = getChatFontFamily(chatAppearance.fontId);
    }
  } else {
    fontFamily = DEFAULT_CHAT_FONT_FAMILY;
  }

  return { bubbleBgColor, bubbleTextColor, fontFamily };
}

/**
 * Validate a chatAppearance object, logging any issues.
 * Returns a sanitized copy with invalid IDs set to null.
 */
export function sanitizeChatAppearance(
  chatAppearance: ChatAppearance | null | undefined,
): ChatAppearance {
  if (!chatAppearance) return { ...DEFAULT_CHAT_APPEARANCE };

  const result: ChatAppearance = { ...chatAppearance };

  // Validate bubbleColorId
  if (result.bubbleColorId) {
    const def = getCosmeticById(result.bubbleColorId);
    if (!def || def.type !== "chat_bubble_color") {
      devWarn(
        `sanitizeChatAppearance: invalid bubbleColorId "${result.bubbleColorId}" — resetting to null.`,
      );
      result.bubbleColorId = null;
    }
  }

  // Validate fontId
  if (result.fontId) {
    const def = getCosmeticById(result.fontId);
    if (!def || def.type !== "chat_font") {
      devWarn(
        `sanitizeChatAppearance: invalid fontId "${result.fontId}" — resetting to null.`,
      );
      result.fontId = null;
    }
  }

  // Validate animalThemeId
  if (result.animalThemeId) {
    const def = getCosmeticById(result.animalThemeId);
    if (!def || def.type !== "chat_animal_theme") {
      devWarn(
        `sanitizeChatAppearance: invalid animalThemeId "${result.animalThemeId}" — resetting to null.`,
      );
      result.animalThemeId = null;
    }
  }

  return result;
}

// =============================================================================
// Incoming Message Style Resolver
// =============================================================================

/** Options for resolving an incoming message's bubble style. */
export interface ResolveIncomingStyleOptions {
  /** The sender style stamped on the message (may be undefined for old msgs). */
  senderStyle?: SenderStyle | null;
  /** Current appearance mode for default color selection. */
  appearanceMode: "light" | "dark";
  /** Default incoming bubble bg color (typically theme.colors.surfaceVariant). */
  defaultBgColor: string;
  /** Default incoming text color (typically theme.colors.text/onSurface). */
  defaultTextColor: string;
}

/**
 * Resolve the bubble style for an **incoming** message based on its
 * stamped senderStyle.
 *
 * - If senderStyle contains a concrete `bubbleColorHex`, use it as the
 *   background and auto-compute the text color via contrast.
 * - If senderStyle contains a `fontKey`, use it as the font family.
 * - Falls back to theme defaults when senderStyle is missing or empty.
 */
export function resolveIncomingBubbleStyle(
  options: ResolveIncomingStyleOptions,
): ResolvedChatStyle {
  const { senderStyle, defaultBgColor, defaultTextColor } = options;

  // No sender style → theme defaults
  if (!senderStyle || senderStyle.v !== 1) {
    return {
      bubbleBgColor: defaultBgColor,
      bubbleTextColor: defaultTextColor,
      fontFamily: undefined,
    };
  }

  // Resolve bubble hex: prefer pre-resolved hex, fall back to catalogID lookup
  let resolvedHex = senderStyle.bubbleColorHex ?? null;
  if (!resolvedHex && senderStyle.bubbleColorId) {
    const catalogHex = getChatBubbleColor(senderStyle.bubbleColorId);
    if (catalogHex) {
      resolvedHex = catalogHex;
    } else {
      // Try metadata fallback
      const def = getCosmeticById(senderStyle.bubbleColorId);
      const meta = def?.metadata?.bubbleColorValue;
      if (typeof meta === "string") {
        resolvedHex = meta;
      }
    }
  }

  // Resolve font: prefer pre-resolved fontKey, fall back to catalog ID lookup
  let resolvedFont = senderStyle.fontKey ?? null;
  if (!resolvedFont && senderStyle.fontId) {
    const catalogFont = getChatFontFamily(senderStyle.fontId);
    if (catalogFont) {
      resolvedFont = catalogFont;
    }
  }

  // Bubble background
  const bubbleBgColor = resolvedHex ?? defaultBgColor;

  // Text color — auto-compute contrast if custom bg, else default
  const bubbleTextColor = resolvedHex
    ? contrastTextColor(resolvedHex)
    : defaultTextColor;

  // Font family
  const fontFamily = resolvedFont ?? undefined;

  return { bubbleBgColor, bubbleTextColor, fontFamily };
}

/**
 * Build a SenderStyle snapshot from a user's chatAppearance.
 *
 * This is stamped onto each outgoing message so recipients can render
 * the sender's bubble color, font, and animal theme without fetching
 * the sender's profile.
 *
 * Resolves catalog IDs to concrete hex/font-family values so the
 * message is self-contained even if the catalog changes later.
 */
export function buildSenderStyle(
  chatAppearance: ChatAppearance | null | undefined,
): SenderStyle {
  const appearance = chatAppearance ?? DEFAULT_CHAT_APPEARANCE;

  // Resolve bubble color ID → hex
  let bubbleColorHex: string | null = null;
  if (appearance.bubbleColorId) {
    const color = getChatBubbleColor(appearance.bubbleColorId);
    if (color) {
      bubbleColorHex = color;
    } else {
      // Try metadata fallback
      const def = getCosmeticById(appearance.bubbleColorId);
      const meta = def?.metadata?.bubbleColorValue;
      if (typeof meta === "string") {
        bubbleColorHex = meta;
      }
    }
  }

  // Resolve font ID → font family key
  let fontKey: string | null = null;
  if (appearance.fontId) {
    const family = getChatFontFamily(appearance.fontId);
    if (family) {
      fontKey = family;
    }
  }

  return {
    bubbleColorId: appearance.bubbleColorId ?? null,
    bubbleColorHex,
    fontId: appearance.fontId ?? null,
    fontKey,
    animalThemeId: appearance.animalThemeId ?? null,
    v: 1,
  };
}
