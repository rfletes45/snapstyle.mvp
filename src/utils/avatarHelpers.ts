/**
 * Avatar Helper Functions
 *
 * Utilities for avatar configuration management including
 * default config generation, legacy conversion, and type guards.
 */

import type {
  AvatarConfig,
  DigitalAvatarConfig,
  SkinToneId,
} from "@/types/avatar";

import { isDigitalAvatarConfig, isLegacyAvatarConfig } from "@/types/avatar";

// Re-export type guards for convenience
export { isDigitalAvatarConfig, isLegacyAvatarConfig } from "@/types/avatar";

/**
 * Generate default avatar configuration for new users
 * This creates a balanced, neutral-looking avatar as a starting point
 */
export function getDefaultAvatarConfig(): DigitalAvatarConfig {
  const now = Date.now();

  return {
    version: 2,
    createdAt: now,
    updatedAt: now,

    body: {
      skinTone: "skin_06", // Medium skin tone
      shape: "body_average",
      height: 1.0,
    },

    face: {
      shape: "oval",
      width: 1.0,
    },

    eyes: {
      style: "eye_natural",
      color: "brown_dark",
      size: 1.0,
      spacing: 1.0,
      tilt: 0,
      eyebrows: {
        style: "brow_natural",
        color: "dark_brown",
        thickness: 1.0,
      },
      eyelashes: {
        enabled: false,
        style: "natural",
        color: "#000000",
      },
    },

    nose: {
      style: "nose_small",
      size: 1.0,
    },

    mouth: {
      style: "mouth_smile",
      size: 1.0,
      lipColor: "lip_natural_medium",
      lipThickness: 1.0,
    },

    ears: {
      style: "ear_medium",
      size: 1.0,
      visible: true,
    },

    hair: {
      style: "hair_short_classic",
      color: "dark_brown",
      facialHair: {
        style: "none",
        color: "dark_brown",
      },
    },

    clothing: {
      top: "top_tshirt_basic",
      bottom: "bottom_jeans_regular",
      outfit: null,
      topColor: undefined,
      bottomColor: undefined,
      outfitColor: undefined,
    },

    accessories: {
      headwear: null,
      eyewear: null,
      earwear: null,
      neckwear: null,
      wristwear: null,
    },
  };
}

/**
 * Map legacy baseColor to closest skin tone
 * The old system used baseColor as avatar circle color
 * We interpret warm colors as skin tones, cool colors get default
 */
const COLOR_TO_SKIN_MAP: Record<string, SkinToneId> = {
  // Existing color options from current cosmetics
  "#FF6B6B": "skin_06", // Red-ish -> medium
  "#4ECDC4": "skin_05", // Teal -> medium light
  "#45B7D1": "skin_05", // Blue -> medium light
  "#96CEB4": "skin_05", // Green -> medium light
  "#FFEAA7": "skin_03", // Yellow/light -> light
  "#DDA0DD": "skin_05", // Plum -> medium light
  "#98D8C8": "skin_04", // Mint -> light medium
  "#F7DC6F": "skin_03", // Gold -> light
  "#BB8FCE": "skin_05", // Purple -> medium light
  "#85C1E9": "skin_05", // Sky blue -> medium light
  // Skin-like colors
  "#FFDAB9": "skin_03", // Peach
  "#DEB887": "skin_06", // Burlywood
  "#D2691E": "skin_08", // Chocolate
  "#8B4513": "skin_10", // Saddle brown
};

/**
 * Map legacy hat emojis to new headwear IDs
 */
const HAT_EMOJI_MAP: Record<string, string> = {
  "🔥": "headwear_flame",
  "👑": "headwear_crown_royal",
  "😇": "headwear_halo",
  "🎉": "headwear_party_hat",
  "🧢": "headwear_baseball_cap",
  "🎿": "headwear_beanie_basic",
  "🎩": "headwear_top_hat",
};

/**
 * Map legacy glasses emojis to new eyewear IDs
 */
const GLASSES_EMOJI_MAP: Record<string, string> = {
  "😎": "eyewear_aviator_sun",
  "👓": "eyewear_round_thin",
  "🕶️": "eyewear_aviator_sun",
  "🥽": "eyewear_goggles_ski",
  "🤩": "eyewear_star_glasses",
  "🤓": "eyewear_round_thick",
};

/**
 * Find closest skin tone for a hex color
 */
export function mapColorToSkinTone(hexColor: string): SkinToneId {
  const upperColor = hexColor.toUpperCase();
  if (COLOR_TO_SKIN_MAP[upperColor]) {
    return COLOR_TO_SKIN_MAP[upperColor];
  }
  // Default to medium skin tone
  return "skin_06";
}

/**
 * Map legacy hat emoji to headwear ID
 */
export function mapLegacyHat(emoji: string): string | null {
  return HAT_EMOJI_MAP[emoji] || null;
}

/**
 * Map legacy glasses emoji to eyewear ID
 */
export function mapLegacyGlasses(emoji: string): string | null {
  return GLASSES_EMOJI_MAP[emoji] || null;
}

/**
 * Convert legacy AvatarConfig to DigitalAvatarConfig
 *
 * This function transforms the simple circle-based avatar config
 * into a full digital avatar configuration while preserving any
 * cosmetic items the user had equipped.
 */
export function convertLegacyConfig(legacy: AvatarConfig): DigitalAvatarConfig {
  // Start with default config
  const digital = getDefaultAvatarConfig();

  // Map skin tone from base color
  if (legacy.baseColor) {
    digital.body.skinTone = mapColorToSkinTone(legacy.baseColor);
  }

  // Map hat to headwear
  if (legacy.hat) {
    const headwear = mapLegacyHat(legacy.hat);
    if (headwear) {
      digital.accessories.headwear = headwear;
    }
  }

  // Map glasses to eyewear
  if (legacy.glasses) {
    const eyewear = mapLegacyGlasses(legacy.glasses);
    if (eyewear) {
      digital.accessories.eyewear = eyewear;
    }
  }

  // Store original color as clothing color hint
  if (legacy.baseColor) {
    digital._legacyColor = legacy.baseColor;
  }

  // Store legacy config for reference/debugging
  digital.legacy = legacy;

  return digital;
}

/**
 * Normalize config to digital avatar format
 * Handles both legacy and digital configs
 */
export function normalizeAvatarConfig(
  config: DigitalAvatarConfig | AvatarConfig | null | undefined,
): DigitalAvatarConfig {
  if (!config) {
    return getDefaultAvatarConfig();
  }

  if (isDigitalAvatarConfig(config)) {
    return config;
  }

  if (isLegacyAvatarConfig(config)) {
    return convertLegacyConfig(config);
  }

  // Unknown format, return default
  console.warn("Unknown avatar config format, using default");
  return getDefaultAvatarConfig();
}

/**
 * Merge partial config updates into existing config
 */
export function mergeAvatarConfig(
  base: DigitalAvatarConfig,
  updates: Partial<DigitalAvatarConfig>,
): DigitalAvatarConfig {
  return {
    ...base,
    ...updates,
    body: { ...base.body, ...updates.body },
    face: { ...base.face, ...updates.face },
    eyes: {
      ...base.eyes,
      ...updates.eyes,
      eyebrows: { ...base.eyes.eyebrows, ...updates.eyes?.eyebrows },
      eyelashes: { ...base.eyes.eyelashes, ...updates.eyes?.eyelashes },
    },
    nose: { ...base.nose, ...updates.nose },
    mouth: { ...base.mouth, ...updates.mouth },
    ears: { ...base.ears, ...updates.ears },
    hair: {
      ...base.hair,
      ...updates.hair,
      facialHair: { ...base.hair.facialHair, ...updates.hair?.facialHair },
    },
    clothing: { ...base.clothing, ...updates.clothing },
    accessories: { ...base.accessories, ...updates.accessories },
    // Profile is optional - only include if either has it
    ...(base.profile || updates.profile
      ? {
          profile: {
            frame:
              updates.profile?.frame !== undefined
                ? updates.profile.frame
                : (base.profile?.frame ?? null),
            banner:
              updates.profile?.banner !== undefined
                ? updates.profile.banner
                : (base.profile?.banner ?? null),
            theme:
              updates.profile?.theme !== undefined
                ? updates.profile.theme
                : (base.profile?.theme ?? null),
            chatBubble:
              updates.profile?.chatBubble !== undefined
                ? updates.profile.chatBubble
                : base.profile?.chatBubble,
            nameEffect:
              updates.profile?.nameEffect !== undefined
                ? updates.profile.nameEffect
                : base.profile?.nameEffect,
            featuredBadges:
              updates.profile?.featuredBadges !== undefined
                ? updates.profile.featuredBadges
                : base.profile?.featuredBadges,
          },
        }
      : {}),
    updatedAt: Date.now(),
  };
}
