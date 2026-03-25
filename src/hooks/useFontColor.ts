/**
 * useFontColor Hook
 *
 * Centralized hook for resolving the user's font color preference.
 *
 * Behavior:
 *   - **Default** (fontColorId === null): Returns the theme's text token.
 *     This automatically adapts to light/dark themes and surfaces.
 *   - **Custom** (fontColorId !== null): Returns the fixed hex color
 *     regardless of theme changes.
 *
 * Scope — where custom font color applies:
 *   - Chat message text (bubble + stacked modes)
 *   - Chat metadata (author names, timestamps in feeds)
 *   - Composer text
 *   - General body/content text
 *
 * Scope — where custom font color does NOT apply:
 *   - Error / destructive text (semantic safety)
 *   - Text on primary/accent-colored buttons (contrast-computed)
 *   - Badge / chip content text (contrast-dependent)
 *   - Status indicators (success/warning/info)
 *   - Navigation bar labels
 *   - Placeholder text (always theme.colors.textMuted)
 *
 * @module hooks/useFontColor
 */

import { useMemo } from "react";

import { resolveOutgoingChatStyle } from "@/cosmetics/chatAppearanceResolver";
import type { ChatAppearance } from "@/cosmetics/types";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";

// =============================================================================
// Types
// =============================================================================

export interface FontColorResult {
  /**
   * The resolved primary text color.
   * - When "default": theme.colors.text (adaptive)
   * - When custom: the user's chosen hex string (fixed)
   */
  textColor: string;

  /**
   * The resolved secondary text color.
   * - When "default": theme.colors.textSecondary (adaptive)
   * - When custom: the user's chosen hex at 70% opacity approximation
   */
  textSecondaryColor: string;

  /**
   * Whether the user has a custom font color selected (non-default).
   */
  isCustom: boolean;

  /**
   * The raw custom hex value, or null if default.
   */
  customHex: string | null;

  /**
   * Resolved font color for chat messages specifically.
   * In bubble mode, this may be overridden by contrast-computed bubble text color.
   * In stacked/feed mode, this is the primary text color.
   */
  chatTextColor: string;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Resolve the user's font color preference to a usable text color.
 *
 * Usage:
 * ```tsx
 * const { textColor, isCustom } = useFontColor();
 * <Text style={{ color: textColor }}>Hello</Text>
 * ```
 */
export function useFontColor(): FontColorResult {
  const { colors, isDark } = useAppTheme();
  const profile = useUser().profile;
  const chatAppearance = profile?.chatAppearance as
    | ChatAppearance
    | null
    | undefined;

  return useMemo(() => {
    const resolved = resolveOutgoingChatStyle({
      chatAppearance: chatAppearance ?? null,
      appearanceMode: isDark ? "dark" : "light",
    });

    const customHex = resolved.fontColorHex;
    const isCustom = customHex != null;

    // Primary text color
    const textColor = isCustom ? customHex : colors.text;

    // Secondary text color — for custom, use ~70% opacity hint of chosen color
    const textSecondaryColor = isCustom
      ? customHex + "B3" // hex alpha ~70%
      : colors.textSecondary;

    // Chat text — same as textColor for stacked mode.
    // In bubble mode, callers should prefer contrast-computed bubbleTextColor
    // over this value when rendering text inside colored bubbles.
    const chatTextColor = textColor;

    return {
      textColor,
      textSecondaryColor,
      isCustom,
      customHex,
      chatTextColor,
    };
  }, [chatAppearance?.fontColorId, isDark, colors.text, colors.textSecondary]);
}

/**
 * Standalone resolver (non-hook) for contexts where React hooks
 * cannot be called (e.g., inside useMemo callbacks, utility functions).
 *
 * Accepts pre-resolved values instead of calling hooks.
 */
export function resolveFontColor(
  fontColorHex: string | null | undefined,
  themeTextColor: string,
): string {
  return fontColorHex ?? themeTextColor;
}
