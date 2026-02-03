/**
 * Avatar Migration Utilities
 *
 * Utilities for migrating legacy avatar configurations to the new
 * digital avatar system. Includes color mapping, emoji conversion,
 * and validation helpers.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 7
 */

import type {
  DigitalAvatarConfig,
  EyeColorId,
  HairColorId,
  SkinToneId,
} from "@/types/avatar";
import type { AvatarConfig } from "@/types/models";
import { getDefaultAvatarConfig } from "./avatarHelpers";

// =============================================================================
// COLOR MAPPING - Legacy BaseColor to Skin Tone
// =============================================================================

/**
 * Maps legacy avatar baseColor values to skin tone IDs
 * Colors that don't map well to skin tones use default medium tone
 */
export const LEGACY_COLOR_TO_SKIN_MAP: Record<string, SkinToneId> = {
  // Original cosmetics colors (from src/data/cosmetics.ts)
  "#FF6B6B": "skin_06", // Red-ish -> medium
  "#4ECDC4": "skin_06", // Teal -> medium (no skin match)
  "#45B7D1": "skin_06", // Blue -> medium (no skin match)
  "#96CEB4": "skin_06", // Green -> medium (no skin match)
  "#FFEAA7": "skin_03", // Yellow/light -> light
  "#DDA0DD": "skin_06", // Plum -> medium (no skin match)
  "#98D8C8": "skin_04", // Mint -> light medium (no skin match)
  "#F7DC6F": "skin_03", // Gold -> light
  "#BB8FCE": "skin_06", // Purple -> medium (no skin match)
  "#85C1E9": "skin_06", // Sky blue -> medium (no skin match)

  // Skin-like color values
  "#FFDAB9": "skin_02", // Peach -> fair
  "#FFE4C4": "skin_02", // Bisque -> fair
  "#FFF0E6": "skin_01", // Porcelain
  "#F5DEB3": "skin_03", // Wheat -> light
  "#DEB887": "skin_05", // Burlywood -> medium light
  "#D2B48C": "skin_05", // Tan -> medium light
  "#C4A484": "skin_06", // Medium
  "#A0522D": "skin_08", // Sienna -> olive
  "#CD853F": "skin_07", // Peru -> medium tan
  "#D2691E": "skin_08", // Chocolate -> olive
  "#8B4513": "skin_10", // Saddle brown -> caramel
  "#A67B5B": "skin_09", // French brown -> tan
  "#6B4423": "skin_11", // Brown
  "#4A3728": "skin_12", // Deep
  "#2E221A": "skin_12", // Very deep

  // Common hex variations (lowercase)
  "#ff6b6b": "skin_06",
  "#4ecdc4": "skin_06",
  "#45b7d1": "skin_06",
  "#ffeaa7": "skin_03",
  "#ffdab9": "skin_02",
};

/**
 * Convert hex color to closest skin tone
 * Uses exact match first, then falls back to color distance calculation
 */
export function mapColorToSkinTone(hexColor: string): SkinToneId {
  // Normalize to uppercase
  const normalized = hexColor.toUpperCase();

  // Check exact match
  if (LEGACY_COLOR_TO_SKIN_MAP[normalized]) {
    return LEGACY_COLOR_TO_SKIN_MAP[normalized];
  }

  // Check lowercase version
  if (LEGACY_COLOR_TO_SKIN_MAP[hexColor.toLowerCase()]) {
    return LEGACY_COLOR_TO_SKIN_MAP[hexColor.toLowerCase()];
  }

  // Try to find closest skin-like color by analyzing the color
  const rgb = hexToRgb(normalized);
  if (rgb) {
    return findClosestSkinTone(rgb);
  }

  // Default to medium skin tone
  return "skin_06";
}

// =============================================================================
// HAT EMOJI MAPPING
// =============================================================================

/**
 * Maps legacy hat emoji values to new headwear IDs
 */
export const HAT_EMOJI_TO_HEADWEAR: Record<string, string> = {
  // From cosmetics.ts COSMETIC_ITEMS
  "🔥": "headwear_flame", // hat_flame
  "👑": "headwear_crown_royal", // hat_crown
  "😇": "headwear_halo", // hat_legendary
  "🎉": "headwear_party_hat", // hat_party
  "🧢": "headwear_baseball_cap", // hat_cap
  "🎿": "headwear_beanie_basic", // hat_beanie
  "🎩": "headwear_top_hat", // hat_tophat
  "👒": "headwear_sun_hat", // Additional common hats
  "🪖": "headwear_helmet", // Military helmet
  "⛑️": "headwear_hard_hat", // Hard hat
  "🎓": "headwear_graduation_cap", // Graduation cap
  "👲": "headwear_asian_hat", // Asian conical hat
  "🧑‍🎄": "headwear_santa_hat", // Santa hat (person emoji)
  "🤠": "headwear_cowboy_hat", // Cowboy
};

/**
 * Map legacy hat emoji to new headwear ID
 */
export function mapLegacyHatToHeadwear(emoji: string): string | null {
  return HAT_EMOJI_TO_HEADWEAR[emoji] || null;
}

// =============================================================================
// GLASSES EMOJI MAPPING
// =============================================================================

/**
 * Maps legacy glasses emoji values to new eyewear IDs
 */
export const GLASSES_EMOJI_TO_EYEWEAR: Record<string, string> = {
  // From cosmetics.ts COSMETIC_ITEMS
  "😎": "eyewear_aviator_sun", // glasses_cool
  "👓": "eyewear_round_thin", // glasses_round
  "🕶️": "eyewear_aviator_sun", // glasses_sunglasses
  "🕶": "eyewear_aviator_sun", // Without variation selector
  "🥽": "eyewear_goggles_ski", // glasses_vr / goggles
  "🤩": "eyewear_star_glasses", // glasses_star
  "🤓": "eyewear_round_thick", // glasses_nerd
  "🧐": "eyewear_monocle", // Monocle
};

/**
 * Map legacy glasses emoji to new eyewear ID
 */
export function mapLegacyGlassesToEyewear(emoji: string): string | null {
  return GLASSES_EMOJI_TO_EYEWEAR[emoji] || null;
}

// =============================================================================
// CLOTHING MAPPING (if clothing emojis were used)
// =============================================================================

/**
 * Maps clothing emoji to clothing item IDs
 */
export const CLOTHING_EMOJI_MAP: Record<string, { slot: string; id: string }> =
  {
    "👕": { slot: "top", id: "top_tshirt_basic" },
    "👔": { slot: "top", id: "top_button_down" },
    "🧥": { slot: "top", id: "top_jacket_casual" },
    "🥼": { slot: "top", id: "top_lab_coat" },
    "🦺": { slot: "top", id: "top_safety_vest" },
    "👗": { slot: "outfit", id: "outfit_casual_dress" },
    "👖": { slot: "bottom", id: "bottom_jeans_regular" },
    "🩳": { slot: "bottom", id: "bottom_shorts" },
    "👙": { slot: "outfit", id: "outfit_swimsuit" },
    "👘": { slot: "outfit", id: "outfit_kimono" },
  };

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, "");

  // Handle 3-character hex
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
      : cleanHex;

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Skin tone reference colors for matching
 */
const SKIN_TONE_COLORS: Record<
  SkinToneId,
  { r: number; g: number; b: number }
> = {
  skin_01: { r: 255, g: 240, b: 230 }, // Porcelain
  skin_02: { r: 255, g: 228, b: 196 }, // Fair
  skin_03: { r: 245, g: 222, b: 179 }, // Light
  skin_04: { r: 235, g: 200, b: 165 }, // Light Medium
  skin_05: { r: 222, g: 184, b: 135 }, // Medium Light
  skin_06: { r: 198, g: 134, b: 66 }, // Medium
  skin_07: { r: 180, g: 120, b: 80 }, // Medium Tan
  skin_08: { r: 160, g: 120, b: 90 }, // Olive
  skin_09: { r: 140, g: 100, b: 70 }, // Tan
  skin_10: { r: 120, g: 80, b: 50 }, // Caramel
  skin_11: { r: 90, g: 60, b: 40 }, // Brown
  skin_12: { r: 74, g: 55, b: 40 }, // Deep
};

/**
 * Calculate color distance (Euclidean in RGB space)
 */
function colorDistance(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2),
  );
}

/**
 * Find closest skin tone based on RGB values
 */
function findClosestSkinTone(rgb: {
  r: number;
  g: number;
  b: number;
}): SkinToneId {
  let closestTone: SkinToneId = "skin_06";
  let minDistance = Infinity;

  for (const [toneId, toneRgb] of Object.entries(SKIN_TONE_COLORS)) {
    const distance = colorDistance(rgb, toneRgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestTone = toneId as SkinToneId;
    }
  }

  return closestTone;
}

// =============================================================================
// FULL MIGRATION FUNCTION
// =============================================================================

/**
 * Fully convert a legacy avatar config to digital avatar config
 * Handles all known legacy fields and applies intelligent defaults
 */
export function migrateLegacyAvatar(
  legacy: AvatarConfig,
  options: {
    preserveLegacy?: boolean;
    randomizeUnmapped?: boolean;
  } = {},
): DigitalAvatarConfig {
  const { preserveLegacy = true, randomizeUnmapped = false } = options;

  // Start with default config
  const digital = getDefaultAvatarConfig();

  // Map skin tone from baseColor
  if (legacy.baseColor) {
    digital.body.skinTone = mapColorToSkinTone(legacy.baseColor);
  }

  // Map hat to headwear
  if (legacy.hat) {
    const headwear = mapLegacyHatToHeadwear(legacy.hat);
    if (headwear) {
      digital.accessories.headwear = headwear;
    }
  }

  // Map glasses to eyewear
  if (legacy.glasses) {
    const eyewear = mapLegacyGlassesToEyewear(legacy.glasses);
    if (eyewear) {
      digital.accessories.eyewear = eyewear;
    }
  }

  // If randomization is enabled, add some variety
  if (randomizeUnmapped) {
    // Random hair style from a safe set
    const hairStyles = [
      "hair_short_classic",
      "hair_short_textured",
      "hair_medium_wavy",
      "hair_medium_straight",
      "hair_long_straight",
    ];
    digital.hair.style = hairStyles[
      Math.floor(Math.random() * hairStyles.length)
    ] as typeof digital.hair.style;

    // Random hair color
    const hairColors: HairColorId[] = [
      "black",
      "dark_brown",
      "medium_brown",
      "light_brown",
      "auburn",
      "golden_blonde",
    ];
    digital.hair.color =
      hairColors[Math.floor(Math.random() * hairColors.length)];

    // Random eye color
    const eyeColors: EyeColorId[] = [
      "brown_dark",
      "brown_light",
      "hazel_gold",
      "green_forest",
      "blue_deep",
      "gray_dark",
    ];
    digital.eyes.color =
      eyeColors[Math.floor(Math.random() * eyeColors.length)];
  }

  // Preserve legacy color as hint for clothing
  if (legacy.baseColor) {
    digital._legacyColor = legacy.baseColor;
  }

  // Preserve original legacy config if requested
  if (preserveLegacy) {
    digital.legacy = legacy;
  }

  // Set timestamps
  digital.createdAt = Date.now();
  digital.updatedAt = Date.now();

  return digital;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Check if a user has been migrated to digital avatar
 */
export function hasDigitalAvatar(userData: {
  digitalAvatar?: unknown;
  avatarConfig?: unknown;
}): boolean {
  return (
    userData.digitalAvatar !== undefined &&
    userData.digitalAvatar !== null &&
    typeof userData.digitalAvatar === "object" &&
    (userData.digitalAvatar as Record<string, unknown>).version === 2
  );
}

/**
 * Check if a user needs migration
 */
export function needsMigration(userData: {
  digitalAvatar?: unknown;
  avatarConfig?: unknown;
}): boolean {
  return !hasDigitalAvatar(userData) && userData.avatarConfig !== undefined;
}

/**
 * Get migration status for a user
 */
export function getMigrationStatus(userData: {
  digitalAvatar?: unknown;
  avatarConfig?: unknown;
}): "migrated" | "needs_migration" | "new_user" {
  if (hasDigitalAvatar(userData)) {
    return "migrated";
  }
  if (userData.avatarConfig !== undefined) {
    return "needs_migration";
  }
  return "new_user";
}

// =============================================================================
// EXPORT MAPPINGS FOR EXTERNAL USE
// =============================================================================

export {
  LEGACY_COLOR_TO_SKIN_MAP as COLOR_TO_SKIN_MAP,
  GLASSES_EMOJI_TO_EYEWEAR as GLASSES_EMOJI_MAP,
  HAT_EMOJI_TO_HEADWEAR as HAT_EMOJI_MAP,
};
