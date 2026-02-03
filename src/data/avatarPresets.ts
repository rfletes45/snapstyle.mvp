/**
 * Avatar Presets Data
 *
 * Curated preset configurations for quick avatar customization.
 * Users can select a preset as a starting point and customize from there.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import type { DigitalAvatarConfig } from "@/types/avatar";

// =============================================================================
// TYPES
// =============================================================================

export interface AvatarPreset {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Category for filtering */
  category: PresetCategory;
  /** Description shown in UI */
  description: string;
  /** Emoji icon for quick identification */
  icon: string;
  /** Whether this preset is locked (requires unlock) */
  locked?: boolean;
  /** Unlock requirement description */
  unlockRequirement?: string;
  /** The actual avatar configuration */
  config: DigitalAvatarConfig;
}

export type PresetCategory =
  | "starter"
  | "professional"
  | "casual"
  | "creative"
  | "seasonal"
  | "achievement";

// =============================================================================
// BASE DEFAULTS - Matches DigitalAvatarConfig type exactly
// =============================================================================

const NOW = Date.now();

/**
 * Default configuration values used as a base for all presets
 * Uses valid type IDs from the avatar type definitions
 */
const BASE_CONFIG: DigitalAvatarConfig = {
  version: 2,
  createdAt: NOW,
  updatedAt: NOW,
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
    style: "nose_medium",
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
    top: "tshirt_basic",
    bottom: "jeans_classic",
    outfit: null,
    topColor: "#1A237E", // Navy
    bottomColor: "#5C6BC0", // Denim blue
  },
  accessories: {
    headwear: null,
    eyewear: null,
    earwear: null,
    neckwear: null,
    wristwear: null,
  },
};

// =============================================================================
// STARTER PRESETS
// =============================================================================

const starterPresets: AvatarPreset[] = [
  {
    id: "starter_alex",
    name: "Alex",
    category: "starter",
    description: "A friendly, approachable look",
    icon: "👋",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_03", shape: "body_average", height: 1.0 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_round",
        color: "blue_light",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_short_textured",
        color: "light_brown",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "tshirt_basic",
        topColor: "#87CEEB", // Sky blue
      },
    },
  },
  {
    id: "starter_jordan",
    name: "Jordan",
    category: "starter",
    description: "Cool and confident style",
    icon: "😎",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_08", shape: "body_athletic", height: 1.05 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_almond",
        color: "brown_dark",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_short_buzz",
        color: "black",
        facialHair: { style: "stubble", color: "black" },
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "hoodie_basic",
        topColor: "#36454F", // Charcoal
      },
    },
  },
  {
    id: "starter_sam",
    name: "Sam",
    category: "starter",
    description: "Bright and cheerful vibes",
    icon: "🌟",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_09", shape: "body_slim", height: 0.95 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_wide_set",
        color: "green_forest",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_medium_wavy",
        color: "auburn",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "sweater_basic",
        topColor: "#FF7F50", // Coral
      },
    },
  },
  {
    id: "starter_riley",
    name: "Riley",
    category: "starter",
    description: "Classic and timeless",
    icon: "✨",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_04", shape: "body_average", height: 1.0 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_round",
        color: "hazel_gold",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_medium_layered",
        color: "golden_blonde",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "blouse_basic",
        topColor: "#FFFFFF", // White
      },
    },
  },
  {
    id: "starter_morgan",
    name: "Morgan",
    category: "starter",
    description: "Warm and welcoming",
    icon: "☀️",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_11", shape: "body_curvy", height: 1.02 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_almond",
        color: "brown_light",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_long_afro",
        color: "black",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "tshirt_basic",
        topColor: "#FFDB58", // Mustard
      },
    },
  },
];

// =============================================================================
// PROFESSIONAL PRESETS
// =============================================================================

const professionalPresets: AvatarPreset[] = [
  {
    id: "pro_executive",
    name: "Executive",
    category: "professional",
    description: "Polished boardroom look",
    icon: "💼",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_03", shape: "body_average", height: 1.05 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_almond",
        color: "brown_dark",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_medium_side_part",
        color: "dark_brown",
        facialHair: { style: "none", color: "dark_brown" },
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        outfit: "suit_formal",
      },
    },
  },
  {
    id: "pro_creative",
    name: "Creative Director",
    category: "professional",
    description: "Artistic professional style",
    icon: "🎨",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_05", shape: "body_slim", height: 1.0 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_round",
        color: "blue_deep",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_short_fade",
        color: "platinum_blonde",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "blazer_casual",
        topColor: "#000000", // Black
      },
      accessories: {
        ...BASE_CONFIG.accessories,
        eyewear: "glasses_designer",
      },
    },
  },
  {
    id: "pro_tech",
    name: "Tech Lead",
    category: "professional",
    description: "Silicon Valley smart casual",
    icon: "💻",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_07", shape: "body_average", height: 1.0 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_round",
        color: "brown_dark",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_short_textured",
        color: "black",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "polo_basic",
        topColor: "#1A237E", // Navy
      },
    },
  },
  {
    id: "pro_consultant",
    name: "Consultant",
    category: "professional",
    description: "Smart business casual",
    icon: "📊",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_04", shape: "body_average", height: 1.02 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_almond",
        color: "gray_dark",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_medium_bob",
        color: "medium_brown",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        outfit: "business_casual",
      },
    },
  },
];

// =============================================================================
// CASUAL PRESETS
// =============================================================================

const casualPresets: AvatarPreset[] = [
  {
    id: "casual_weekend",
    name: "Weekend Vibes",
    category: "casual",
    description: "Relaxed and comfortable",
    icon: "🛋️",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_02", shape: "body_average", height: 1.0 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_round",
        color: "blue_light",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_medium_shaggy",
        color: "medium_brown",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "hoodie_basic",
        topColor: "#9E9E9E", // Heather gray
      },
    },
  },
  {
    id: "casual_sporty",
    name: "Sporty",
    category: "casual",
    description: "Active and energetic",
    icon: "🏃",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_06", shape: "body_athletic", height: 1.05 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_almond",
        color: "brown_light",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_short_buzz",
        color: "black",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "tanktop_athletic",
        topColor: "#F44336", // Red
      },
      accessories: {
        ...BASE_CONFIG.accessories,
        headwear: "headband_sport",
      },
    },
  },
  {
    id: "casual_cozy",
    name: "Cozy",
    category: "casual",
    description: "Warm and snuggly",
    icon: "☕",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_07", shape: "body_curvy", height: 0.98 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_wide_set",
        color: "green_light",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_long_wavy",
        color: "auburn",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "sweater_oversized",
        topColor: "#FFF8DC", // Cream
      },
    },
  },
  {
    id: "casual_streetwear",
    name: "Street Style",
    category: "casual",
    description: "Urban fashion forward",
    icon: "🔥",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_12", shape: "body_slim", height: 1.03 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_almond",
        color: "brown_dark",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_long_dreads",
        color: "black",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "tshirt_graphic",
        topColor: "#000000", // Black
      },
      accessories: {
        ...BASE_CONFIG.accessories,
        headwear: "cap_snapback",
      },
    },
  },
];

// =============================================================================
// CREATIVE PRESETS
// =============================================================================

const creativePresets: AvatarPreset[] = [
  {
    id: "creative_artist",
    name: "Artist",
    category: "creative",
    description: "Express your creative side",
    icon: "🖌️",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_03", shape: "body_slim", height: 0.98 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_wide_set",
        color: "amber",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_short_cropped",
        color: "fantasy_purple",
        highlightColor: "fantasy_pink",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "tshirt_artistic",
        topColor: "#FFFFFF", // White
      },
    },
  },
  {
    id: "creative_musician",
    name: "Musician",
    category: "creative",
    description: "Rock star energy",
    icon: "🎸",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_05", shape: "body_slim", height: 1.02 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_almond",
        color: "green_forest",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_long_straight",
        color: "black",
        facialHair: { style: "stubble", color: "black" },
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "jacket_leather",
        topColor: "#000000", // Black
      },
    },
  },
  {
    id: "creative_gamer",
    name: "Gamer",
    category: "creative",
    description: "Level up your style",
    icon: "🎮",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_02", shape: "body_average", height: 1.0 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_round",
        color: "blue_deep",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_medium_shaggy",
        color: "fantasy_blue",
        highlightColor: "fantasy_green",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "hoodie_gaming",
        topColor: "#9C27B0", // Purple
      },
      accessories: {
        ...BASE_CONFIG.accessories,
        headwear: "headset_gaming",
      },
    },
  },
  {
    id: "creative_cosplay",
    name: "Cosplayer",
    category: "creative",
    description: "Costume-ready look",
    icon: "🦸",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_09", shape: "body_athletic", height: 1.05 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_round",
        color: "blue_light",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_short_spiky",
        color: "fantasy_blue",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        outfit: "costume_hero",
      },
    },
  },
];

// =============================================================================
// SEASONAL PRESETS
// =============================================================================

const seasonalPresets: AvatarPreset[] = [
  {
    id: "seasonal_summer",
    name: "Summer Sun",
    category: "seasonal",
    description: "Beach-ready vibes",
    icon: "🏖️",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_10", shape: "body_athletic", height: 1.0 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_round",
        color: "blue_light",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_medium_wavy",
        color: "strawberry_blonde",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "tanktop_casual",
        topColor: "#FF7F50", // Coral
      },
      accessories: {
        ...BASE_CONFIG.accessories,
        eyewear: "sunglasses_aviator",
      },
    },
  },
  {
    id: "seasonal_autumn",
    name: "Autumn Cozy",
    category: "seasonal",
    description: "Fall fashion forward",
    icon: "🍂",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_04", shape: "body_average", height: 1.0 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_almond",
        color: "hazel_green",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_medium_layered",
        color: "auburn",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "cardigan_cozy",
        topColor: "#CC5500", // Burnt orange
      },
      accessories: {
        ...BASE_CONFIG.accessories,
        neckwear: "scarf_knit",
      },
    },
  },
  {
    id: "seasonal_winter",
    name: "Winter Wonderland",
    category: "seasonal",
    description: "Cold weather chic",
    icon: "❄️",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_02", shape: "body_average", height: 1.0 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_round",
        color: "gray_light",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_long_straight",
        color: "platinum_blonde",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        outfit: "outfit_winter",
      },
      accessories: {
        ...BASE_CONFIG.accessories,
        headwear: "beanie_knit",
        neckwear: "scarf_winter",
      },
    },
  },
  {
    id: "seasonal_spring",
    name: "Spring Bloom",
    category: "seasonal",
    description: "Fresh and floral",
    icon: "🌸",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_05", shape: "body_slim", height: 0.98 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_wide_set",
        color: "green_light",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_medium_wavy",
        color: "light_brown",
        highlightColor: "strawberry_blonde",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        top: "blouse_floral",
        topColor: "#FFC0CB", // Pink
      },
    },
  },
];

// =============================================================================
// ACHIEVEMENT PRESETS (Locked by default)
// =============================================================================

const achievementPresets: AvatarPreset[] = [
  {
    id: "achievement_champion",
    name: "Champion",
    category: "achievement",
    description: "Victory royale look",
    icon: "🏆",
    locked: true,
    unlockRequirement: "Win 10 games",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_06", shape: "body_athletic", height: 1.08 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_almond",
        color: "amber",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_short_mohawk",
        color: "golden_blonde",
        highlightColor: "platinum_blonde",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        outfit: "outfit_champion",
      },
      accessories: {
        ...BASE_CONFIG.accessories,
        headwear: "crown_champion",
      },
    },
  },
  {
    id: "achievement_veteran",
    name: "Veteran",
    category: "achievement",
    description: "Seasoned player style",
    icon: "⭐",
    locked: true,
    unlockRequirement: "Play for 30 days",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_11", shape: "body_broad", height: 1.05 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_hooded",
        color: "gray_dark",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_short_classic",
        color: "gray_dark",
        facialHair: { style: "full_beard", color: "gray_dark" },
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        outfit: "outfit_veteran",
      },
    },
  },
  {
    id: "achievement_socialite",
    name: "Socialite",
    category: "achievement",
    description: "Popular and connected",
    icon: "💬",
    locked: true,
    unlockRequirement: "Have 50 friends",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_07", shape: "body_slim", height: 1.0 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_round",
        color: "blue_deep",
        eyelashes: { enabled: true, style: "dramatic", color: "#000000" },
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_long_wavy",
        color: "golden_blonde",
        highlightColor: "strawberry_blonde",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        outfit: "outfit_socialite",
      },
      accessories: {
        ...BASE_CONFIG.accessories,
        earwear: "earrings_diamond",
        neckwear: "necklace_pearl",
      },
    },
  },
  {
    id: "achievement_streak_master",
    name: "Streak Master",
    category: "achievement",
    description: "Consistency is key",
    icon: "🔥",
    locked: true,
    unlockRequirement: "Maintain a 30-day streak",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_08", shape: "body_athletic", height: 1.03 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_almond",
        color: "amber",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_short_spiky",
        color: "fantasy_red",
        highlightColor: "golden_blonde",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        outfit: "outfit_fire",
      },
      accessories: {
        ...BASE_CONFIG.accessories,
        wristwear: "bracelet_flame",
      },
    },
  },
  {
    id: "achievement_night_owl",
    name: "Night Owl",
    category: "achievement",
    description: "Midnight style",
    icon: "🦉",
    locked: true,
    unlockRequirement: "Send 100 messages after midnight",
    config: {
      ...BASE_CONFIG,
      createdAt: NOW,
      updatedAt: NOW,
      body: { skinTone: "skin_02", shape: "body_slim", height: 1.0 },
      eyes: {
        ...BASE_CONFIG.eyes,
        style: "eye_round",
        color: "blue_gray",
      },
      hair: {
        ...BASE_CONFIG.hair,
        style: "hair_medium_shaggy",
        color: "fantasy_blue",
        highlightColor: "silver",
      },
      clothing: {
        ...BASE_CONFIG.clothing,
        outfit: "outfit_nightowl",
      },
      accessories: {
        ...BASE_CONFIG.accessories,
        eyewear: "glasses_moon",
      },
    },
  },
];

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * All avatar presets organized by category
 */
export const AVATAR_PRESETS: AvatarPreset[] = [
  ...starterPresets,
  ...professionalPresets,
  ...casualPresets,
  ...creativePresets,
  ...seasonalPresets,
  ...achievementPresets,
];

/**
 * Get presets filtered by category
 */
export function getPresetsByCategory(category: PresetCategory): AvatarPreset[] {
  return AVATAR_PRESETS.filter((preset) => preset.category === category);
}

/**
 * Get a specific preset by ID
 */
export function getPresetById(id: string): AvatarPreset | undefined {
  return AVATAR_PRESETS.find((preset) => preset.id === id);
}

/**
 * Get all unlocked presets (excluding achievement presets that are locked)
 */
export function getUnlockedPresets(unlockedIds?: Set<string>): AvatarPreset[] {
  return AVATAR_PRESETS.filter((preset) => {
    if (!preset.locked) return true;
    return unlockedIds?.has(preset.id) ?? false;
  });
}

/**
 * Get only the starter presets (always available)
 */
export function getStarterPresets(): AvatarPreset[] {
  return starterPresets;
}

/**
 * Preset category metadata for UI display
 */
export const PRESET_CATEGORIES: {
  id: PresetCategory;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    id: "starter",
    label: "Starter",
    icon: "👋",
    description: "Great starting points",
  },
  {
    id: "professional",
    label: "Professional",
    icon: "💼",
    description: "Business-ready looks",
  },
  {
    id: "casual",
    label: "Casual",
    icon: "👕",
    description: "Relaxed everyday styles",
  },
  {
    id: "creative",
    label: "Creative",
    icon: "🎨",
    description: "Express yourself",
  },
  {
    id: "seasonal",
    label: "Seasonal",
    icon: "🌸",
    description: "Themed for the season",
  },
  {
    id: "achievement",
    label: "Unlockable",
    icon: "🏆",
    description: "Earn through gameplay",
  },
];

export default AVATAR_PRESETS;
