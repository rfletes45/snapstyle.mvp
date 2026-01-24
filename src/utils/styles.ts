/**
 * Cross-Platform Style Utilities
 *
 * Provides platform-aware style helpers for web and native compatibility.
 * Addresses React Native Web deprecation warnings for shadow* props.
 *
 * Usage:
 * ```ts
 * import { shadow } from '@/utils/styles';
 *
 * const styles = StyleSheet.create({
 *   card: {
 *     ...shadow({ color: '#000', offsetX: 0, offsetY: 2, opacity: 0.1, radius: 4, elevation: 3 }),
 *   },
 * });
 * ```
 *
 * @module utils/styles
 */

import { Platform, ViewStyle } from "react-native";

// =============================================================================
// Types
// =============================================================================

interface ShadowConfig {
  /** Shadow color (used for iOS/Android shadowColor and web boxShadow) */
  color?: string;
  /** Horizontal offset (iOS shadowOffset.width, web boxShadow offsetX) */
  offsetX?: number;
  /** Vertical offset (iOS shadowOffset.height, web boxShadow offsetY) */
  offsetY?: number;
  /** Shadow opacity (iOS only - incorporated into web color) */
  opacity?: number;
  /** Shadow blur radius (iOS shadowRadius, web boxShadow blur) */
  radius?: number;
  /** Android elevation (ignored on iOS/web) */
  elevation?: number;
}

// =============================================================================
// Shadow Helper
// =============================================================================

/**
 * Create cross-platform shadow styles
 *
 * On iOS: Uses native shadow* props
 * On Android: Uses elevation
 * On Web: Uses boxShadow CSS property
 *
 * @param config - Shadow configuration
 * @returns Platform-appropriate style object
 */
export function shadow(config: ShadowConfig = {}): ViewStyle {
  const {
    color = "#000",
    offsetX = 0,
    offsetY = 2,
    opacity = 0.1,
    radius = 4,
    elevation = 3,
  } = config;

  if (Platform.OS === "web") {
    // Convert hex color + opacity to rgba for web
    const rgbaColor = hexToRgba(color, opacity);
    return {
      // boxShadow is valid for web but not in standard RN types
      boxShadow: `${offsetX}px ${offsetY}px ${radius}px ${rgbaColor}`,
    } as ViewStyle;
  }

  if (Platform.OS === "android") {
    return {
      elevation,
    };
  }

  // iOS - use native shadow props
  return {
    shadowColor: color,
    shadowOffset: { width: offsetX, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
  };
}

/**
 * Convert hex color to rgba string
 */
function hexToRgba(hex: string, alpha: number): string {
  // Handle shorthand hex
  const fullHex =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;

  const r = parseInt(fullHex.slice(1, 3), 16);
  const g = parseInt(fullHex.slice(3, 5), 16);
  const b = parseInt(fullHex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// =============================================================================
// Preset Shadows
// =============================================================================

/** Subtle shadow for cards, modals */
export const shadowSm = shadow({
  offsetY: 1,
  radius: 2,
  opacity: 0.05,
  elevation: 1,
});

/** Standard shadow for elevated UI */
export const shadowMd = shadow({
  offsetY: 2,
  radius: 4,
  opacity: 0.1,
  elevation: 3,
});

/** Prominent shadow for floating UI */
export const shadowLg = shadow({
  offsetY: 4,
  radius: 8,
  opacity: 0.15,
  elevation: 5,
});

/** Strong shadow for overlays, dialogs */
export const shadowXl = shadow({
  offsetY: 8,
  radius: 16,
  opacity: 0.2,
  elevation: 8,
});
