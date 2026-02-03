/**
 * Avatar Accessibility Utilities
 *
 * Utilities for making the avatar system accessible to all users.
 * Includes screen reader labels, color name mappings, and
 * reduced motion support.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 7
 */

import type { DigitalAvatarConfig } from "@/types/avatar";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

// =============================================================================
// COLOR NAME MAPPINGS
// =============================================================================

/**
 * Human-readable names for skin tones
 */
export const SKIN_TONE_NAMES: Record<string, string> = {
  skin_01: "Porcelain",
  skin_02: "Fair",
  skin_03: "Light",
  skin_04: "Light Medium",
  skin_05: "Medium Light",
  skin_06: "Medium",
  skin_07: "Medium Tan",
  skin_08: "Olive",
  skin_09: "Tan",
  skin_10: "Caramel",
  skin_11: "Brown",
  skin_12: "Deep",
};

/**
 * Human-readable names for hair colors
 */
export const HAIR_COLOR_NAMES: Record<string, string> = {
  black: "Black",
  dark_brown: "Dark Brown",
  medium_brown: "Medium Brown",
  light_brown: "Light Brown",
  auburn: "Auburn",
  chestnut: "Chestnut",
  copper: "Copper",
  strawberry_blonde: "Strawberry Blonde",
  golden_blonde: "Golden Blonde",
  platinum_blonde: "Platinum Blonde",
  dirty_blonde: "Dirty Blonde",
  gray_dark: "Dark Gray",
  gray_light: "Light Gray",
  silver: "Silver",
  white: "White",
  fantasy_blue: "Fantasy Blue",
  fantasy_purple: "Fantasy Purple",
  fantasy_pink: "Fantasy Pink",
  fantasy_green: "Fantasy Green",
  fantasy_red: "Fantasy Red",
};

/**
 * Human-readable names for eye colors
 */
export const EYE_COLOR_NAMES: Record<string, string> = {
  brown_dark: "Dark Brown",
  brown_light: "Light Brown",
  hazel_gold: "Golden Hazel",
  hazel_green: "Green Hazel",
  green_forest: "Forest Green",
  green_light: "Light Green",
  green_gray: "Gray Green",
  blue_deep: "Deep Blue",
  blue_light: "Light Blue",
  blue_gray: "Gray Blue",
  gray_dark: "Dark Gray",
  gray_light: "Light Gray",
  amber: "Amber",
};

/**
 * Human-readable names for face shapes
 */
export const FACE_SHAPE_NAMES: Record<string, string> = {
  oval: "Oval",
  round: "Round",
  square: "Square",
  heart: "Heart",
  oblong: "Oblong",
  diamond: "Diamond",
  triangle: "Triangle",
  rectangle: "Rectangle",
};

/**
 * Human-readable names for hair styles (simplified categories)
 */
export const HAIR_STYLE_CATEGORIES: Record<string, string> = {
  short: "Short",
  medium: "Medium Length",
  long: "Long",
  bald: "Bald",
  special: "Special Style",
};

// =============================================================================
// SCREEN READER DESCRIPTIONS
// =============================================================================

/**
 * Generate accessible description for an avatar
 */
export function getAvatarAccessibilityLabel(
  config: DigitalAvatarConfig,
  userName?: string,
): string {
  const parts: string[] = [];

  // User name if provided
  if (userName) {
    parts.push(`${userName}'s avatar`);
  } else {
    parts.push("Avatar");
  }

  // Skin tone
  const skinToneName = SKIN_TONE_NAMES[config.body.skinTone] || "Unknown";
  parts.push(`with ${skinToneName.toLowerCase()} skin tone`);

  // Hair
  const hairColorName = HAIR_COLOR_NAMES[config.hair.color] || "Unknown";
  const hairStyleCategory = getHairStyleCategory(config.hair.style);
  if (config.hair.style.includes("bald")) {
    parts.push("bald");
  } else {
    parts.push(
      `${hairStyleCategory.toLowerCase()} ${hairColorName.toLowerCase()} hair`,
    );
  }

  // Eyes
  const eyeColorName = EYE_COLOR_NAMES[config.eyes.color] || "Unknown";
  parts.push(`${eyeColorName.toLowerCase()} eyes`);

  // Accessories
  const accessories: string[] = [];
  if (config.accessories.headwear) {
    accessories.push("wearing a hat");
  }
  if (config.accessories.eyewear) {
    accessories.push("wearing glasses");
  }
  if (accessories.length > 0) {
    parts.push(accessories.join(" and "));
  }

  return parts.join(", ");
}

/**
 * Get hair style category from style ID
 */
function getHairStyleCategory(styleId: string): string {
  if (styleId.includes("short")) return HAIR_STYLE_CATEGORIES.short;
  if (styleId.includes("medium")) return HAIR_STYLE_CATEGORIES.medium;
  if (styleId.includes("long")) return HAIR_STYLE_CATEGORIES.long;
  if (styleId.includes("bald")) return HAIR_STYLE_CATEGORIES.bald;
  if (styleId.includes("special")) return HAIR_STYLE_CATEGORIES.special;
  return HAIR_STYLE_CATEGORIES.medium;
}

/**
 * Generate hint for customization options
 */
export function getCustomizationHint(category: string): string {
  const hints: Record<string, string> = {
    face: "Tap to choose face shape and features",
    eyes: "Tap to customize eye shape, color, and eyebrows",
    hair: "Tap to select hairstyle and color",
    body: "Tap to adjust body type and skin tone",
    clothing: "Tap to choose outfit and clothing colors",
    accessories: "Tap to add hats, glasses, and jewelry",
    presets: "Tap to apply a preset avatar look",
  };

  return hints[category] || "Tap to customize";
}

// =============================================================================
// REDUCED MOTION SUPPORT
// =============================================================================

/**
 * Hook to check if reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check initial value
    const checkReducedMotion = async () => {
      try {
        const isReduced = await AccessibilityInfo.isReduceMotionEnabled();
        setReducedMotion(isReduced);
      } catch {
        // Default to false if check fails
        setReducedMotion(false);
      }
    };

    checkReducedMotion();

    // Listen for changes
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (isReduced: boolean) => {
        setReducedMotion(isReduced);
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

/**
 * Get animation duration based on reduced motion preference
 */
export function getAnimationDuration(
  normalDuration: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) {
    return 0; // No animation
  }
  return normalDuration;
}

/**
 * Check if animations should be enabled
 */
export function shouldAnimate(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

// =============================================================================
// SCREEN READER ANNOUNCEMENTS
// =============================================================================

/**
 * Announce a message to screen readers
 */
export function announceForAccessibility(message: string): void {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    AccessibilityInfo.announceForAccessibility(message);
  }
}

/**
 * Announce avatar change
 */
export function announceAvatarChange(
  changeType: string,
  newValue: string,
): void {
  const message = `${changeType} changed to ${newValue}`;
  announceForAccessibility(message);
}

/**
 * Announce color selection
 */
export function announceColorSelection(
  colorCategory: string,
  colorName: string,
): void {
  const message = `${colorCategory} color: ${colorName}`;
  announceForAccessibility(message);
}

/**
 * Announce style selection
 */
export function announceStyleSelection(
  styleCategory: string,
  styleName: string,
): void {
  const message = `${styleCategory}: ${styleName}`;
  announceForAccessibility(message);
}

// =============================================================================
// ACCESSIBILITY PROPS GENERATORS
// =============================================================================

/**
 * Generate accessibility props for avatar component
 */
export function getAvatarAccessibilityProps(
  config: DigitalAvatarConfig,
  userName?: string,
): {
  accessible: boolean;
  accessibilityLabel: string;
  accessibilityRole: "image";
} {
  return {
    accessible: true,
    accessibilityLabel: getAvatarAccessibilityLabel(config, userName),
    accessibilityRole: "image",
  };
}

/**
 * Generate accessibility props for color picker item
 */
export function getColorPickerItemAccessibilityProps(
  colorId: string,
  colorName: string,
  isSelected: boolean,
): {
  accessible: boolean;
  accessibilityLabel: string;
  accessibilityState: { selected: boolean };
  accessibilityRole: "button";
} {
  return {
    accessible: true,
    accessibilityLabel: `${colorName}${isSelected ? ", selected" : ""}`,
    accessibilityState: { selected: isSelected },
    accessibilityRole: "button",
  };
}

/**
 * Generate accessibility props for style picker item
 */
export function getStylePickerItemAccessibilityProps(
  styleName: string,
  isSelected: boolean,
  isLocked: boolean,
): {
  accessible: boolean;
  accessibilityLabel: string;
  accessibilityState: { selected: boolean; disabled: boolean };
  accessibilityRole: "button";
  accessibilityHint?: string;
} {
  const label = isLocked
    ? `${styleName}, locked`
    : `${styleName}${isSelected ? ", selected" : ""}`;

  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityState: { selected: isSelected, disabled: isLocked },
    accessibilityRole: "button",
    ...(isLocked ? { accessibilityHint: "Unlock this item to use it" } : {}),
  };
}

/**
 * Generate accessibility props for slider
 */
export function getSliderAccessibilityProps(
  label: string,
  value: number,
  minLabel?: string,
  maxLabel?: string,
): {
  accessible: boolean;
  accessibilityLabel: string;
  accessibilityRole: "adjustable";
  accessibilityValue: { min: number; max: number; now: number; text: string };
} {
  const valuePercent = Math.round(((value - 0.8) / 0.4) * 100);
  const valueText =
    minLabel && maxLabel
      ? `${valuePercent}% between ${minLabel} and ${maxLabel}`
      : `${valuePercent}%`;

  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: "adjustable",
    accessibilityValue: {
      min: 0,
      max: 100,
      now: valuePercent,
      text: valueText,
    },
  };
}

// =============================================================================
// COLOR CONTRAST UTILITIES
// =============================================================================

/**
 * Calculate relative luminance of a color
 */
function getLuminance(hexColor: string): number {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const adjust = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG AA standard (4.5:1 for normal text)
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  level: "AA" | "AAA" = "AA",
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const threshold = level === "AAA" ? 7 : 4.5;
  return ratio >= threshold;
}

/**
 * Get text color (black or white) that provides best contrast
 */
export function getAccessibleTextColor(
  backgroundColor: string,
): "#000000" | "#FFFFFF" {
  const luminance = getLuminance(backgroundColor);
  return luminance > 0.179 ? "#000000" : "#FFFFFF";
}
