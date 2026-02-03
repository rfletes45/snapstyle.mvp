/**
 * Cosmetic Bundles Data
 *
 * Defines bundles/sets of cosmetic items that can be purchased together
 * at a discounted price. Bundles may include items from different categories.
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 6
 */

import type { ExtendedCosmeticRarity } from "@/types/profile";

// =============================================================================
// Types
// =============================================================================

/**
 * Bundle type - determines special behaviors
 */
export type BundleType =
  | "starter" // New player starter pack
  | "themed" // Theme-based collection
  | "seasonal" // Holiday/seasonal items
  | "premium" // High-value items
  | "limited" // Limited-time availability
  | "achievement"; // Unlocked via achievements

/**
 * Cosmetic bundle definition
 */
export interface CosmeticBundle {
  id: string;
  name: string;
  description: string;
  type: BundleType;
  rarity: ExtendedCosmeticRarity;

  // Items included in bundle
  items: BundleItem[];

  // Pricing
  priceTokens: number;
  originalPriceTokens: number; // Sum of individual item prices
  discountPercent: number;
  priceUSD?: number; // Real money price (optional)

  // Display
  imagePath: string;
  previewImages?: string[];
  badgeText?: string; // e.g., "Best Value", "Limited"
  highlightColor?: string;

  // Availability
  featured: boolean;
  availableFrom?: number;
  availableTo?: number;
  limitedQuantity?: number;
  purchaseCount?: number;

  // Unlock requirements (for achievement bundles)
  unlockRequirement?: {
    type: "achievement" | "level" | "streak";
    value: string | number;
  };

  // Metadata
  sortOrder: number;
  tags?: string[];
  setId?: string; // For multi-part sets
}

/**
 * Individual item within a bundle
 */
export interface BundleItem {
  cosmeticId: string;
  name: string;
  slot: string;
  imagePath: string;
  rarity: ExtendedCosmeticRarity;
  /** Individual item price (for showing savings) */
  priceTokens: number;
}

// =============================================================================
// Bundle Definitions
// =============================================================================

export const COSMETIC_BUNDLES: CosmeticBundle[] = [
  // =====================
  // STARTER BUNDLES
  // =====================
  {
    id: "starter_essentials",
    name: "Starter Essentials",
    description:
      "Everything you need to start customizing! Includes popular hats, glasses, and backgrounds.",
    type: "starter",
    rarity: "common",
    items: [
      {
        cosmeticId: "hat_flame",
        name: "Flame Cap",
        slot: "hat",
        imagePath: "🔥",
        rarity: "common",
        priceTokens: 50,
      },
      {
        cosmeticId: "glasses_cool",
        name: "Cool Shades",
        slot: "glasses",
        imagePath: "😎",
        rarity: "common",
        priceTokens: 50,
      },
      {
        cosmeticId: "bg_sunset",
        name: "Sunset Vibes",
        slot: "background",
        imagePath: "🌅",
        rarity: "rare",
        priceTokens: 100,
      },
    ],
    priceTokens: 150,
    originalPriceTokens: 200,
    discountPercent: 25,
    imagePath: "🎁",
    badgeText: "Best for New Players",
    highlightColor: "#4CAF50",
    featured: true,
    sortOrder: 1,
    tags: ["starter", "value"],
  },

  {
    id: "starter_premium",
    name: "Premium Starter Pack",
    description:
      "Begin your journey in style with premium cosmetics and bonus tokens!",
    type: "starter",
    rarity: "rare",
    items: [
      {
        cosmeticId: "hat_crown",
        name: "Golden Crown",
        slot: "hat",
        imagePath: "👑",
        rarity: "rare",
        priceTokens: 200,
      },
      {
        cosmeticId: "glasses_star",
        name: "Star Glasses",
        slot: "glasses",
        imagePath: "⭐",
        rarity: "rare",
        priceTokens: 150,
      },
      {
        cosmeticId: "bg_galaxy",
        name: "Galaxy Background",
        slot: "background",
        imagePath: "🌌",
        rarity: "epic",
        priceTokens: 300,
      },
      {
        cosmeticId: "frame_gold_basic",
        name: "Gold Basic Frame",
        slot: "profile_frame",
        imagePath: "✨",
        rarity: "rare",
        priceTokens: 250,
      },
    ],
    priceTokens: 650,
    originalPriceTokens: 900,
    discountPercent: 28,
    priceUSD: 4.99,
    imagePath: "💎",
    badgeText: "Best Value",
    highlightColor: "#FFD700",
    featured: true,
    sortOrder: 2,
    tags: ["starter", "premium", "value"],
  },

  // =====================
  // THEMED BUNDLES
  // =====================
  {
    id: "neon_collection",
    name: "Neon Dreams Collection",
    description:
      "Light up your profile with this electric neon-themed set. Includes matching frame and chat bubble!",
    type: "themed",
    rarity: "epic",
    items: [
      {
        cosmeticId: "bg_neon",
        name: "Neon Dreams",
        slot: "background",
        imagePath: "💜",
        rarity: "epic",
        priceTokens: 250,
      },
      {
        cosmeticId: "frame_neon_glow",
        name: "Neon Glow Frame",
        slot: "profile_frame",
        imagePath: "🔮",
        rarity: "epic",
        priceTokens: 400,
      },
      {
        cosmeticId: "bubble_neon_pulse",
        name: "Neon Pulse Bubble",
        slot: "chat_bubble",
        imagePath: "💬",
        rarity: "epic",
        priceTokens: 300,
      },
      {
        cosmeticId: "theme_cyberpunk",
        name: "Cyberpunk Theme",
        slot: "profile_theme",
        imagePath: "🌃",
        rarity: "epic",
        priceTokens: 500,
      },
    ],
    priceTokens: 1100,
    originalPriceTokens: 1450,
    discountPercent: 24,
    imagePath: "💜",
    highlightColor: "#9B59B6",
    featured: true,
    sortOrder: 10,
    tags: ["themed", "neon", "cyberpunk"],
    setId: "neon_set",
  },

  {
    id: "ocean_collection",
    name: "Ocean Breeze Collection",
    description: "Dive into tranquility with this calming ocean-themed bundle.",
    type: "themed",
    rarity: "rare",
    items: [
      {
        cosmeticId: "bg_ocean",
        name: "Ocean Waves",
        slot: "background",
        imagePath: "🌊",
        rarity: "rare",
        priceTokens: 150,
      },
      {
        cosmeticId: "frame_water_ripple",
        name: "Water Ripple Frame",
        slot: "profile_frame",
        imagePath: "💧",
        rarity: "rare",
        priceTokens: 300,
      },
      {
        cosmeticId: "bubble_ocean_gradient",
        name: "Ocean Gradient Bubble",
        slot: "chat_bubble",
        imagePath: "🐚",
        rarity: "rare",
        priceTokens: 200,
      },
      {
        cosmeticId: "theme_ocean_breeze",
        name: "Ocean Breeze Theme",
        slot: "profile_theme",
        imagePath: "🏖️",
        rarity: "rare",
        priceTokens: 400,
      },
    ],
    priceTokens: 800,
    originalPriceTokens: 1050,
    discountPercent: 24,
    imagePath: "🌊",
    highlightColor: "#3498DB",
    featured: false,
    sortOrder: 11,
    tags: ["themed", "ocean", "calm"],
    setId: "ocean_set",
  },

  {
    id: "fire_collection",
    name: "Inferno Collection",
    description: "Blaze through with this fiery hot collection!",
    type: "themed",
    rarity: "epic",
    items: [
      {
        cosmeticId: "hat_flame",
        name: "Flame Cap",
        slot: "hat",
        imagePath: "🔥",
        rarity: "common",
        priceTokens: 50,
      },
      {
        cosmeticId: "bg_fire",
        name: "Blazing Inferno",
        slot: "background",
        imagePath: "🔥",
        rarity: "epic",
        priceTokens: 300,
      },
      {
        cosmeticId: "frame_fire_animated",
        name: "Animated Fire Frame",
        slot: "profile_frame",
        imagePath: "🔥",
        rarity: "epic",
        priceTokens: 500,
      },
      {
        cosmeticId: "bubble_ember_glow",
        name: "Ember Glow Bubble",
        slot: "chat_bubble",
        imagePath: "✨",
        rarity: "epic",
        priceTokens: 350,
      },
    ],
    priceTokens: 900,
    originalPriceTokens: 1200,
    discountPercent: 25,
    imagePath: "🔥",
    highlightColor: "#E74C3C",
    featured: false,
    sortOrder: 12,
    tags: ["themed", "fire", "intense"],
    setId: "fire_set",
  },

  // =====================
  // SEASONAL BUNDLES
  // =====================
  {
    id: "winter_wonderland",
    name: "Winter Wonderland",
    description:
      "Celebrate the season with this frosty collection of winter cosmetics!",
    type: "seasonal",
    rarity: "epic",
    items: [
      {
        cosmeticId: "hat_santa",
        name: "Santa Hat",
        slot: "hat",
        imagePath: "🎅",
        rarity: "rare",
        priceTokens: 200,
      },
      {
        cosmeticId: "bg_snow",
        name: "Snowy Background",
        slot: "background",
        imagePath: "❄️",
        rarity: "rare",
        priceTokens: 200,
      },
      {
        cosmeticId: "frame_snowflake",
        name: "Snowflake Frame",
        slot: "profile_frame",
        imagePath: "❄️",
        rarity: "epic",
        priceTokens: 400,
      },
      {
        cosmeticId: "bubble_frost",
        name: "Frost Bubble",
        slot: "chat_bubble",
        imagePath: "🧊",
        rarity: "rare",
        priceTokens: 250,
      },
      {
        cosmeticId: "theme_winter",
        name: "Winter Theme",
        slot: "profile_theme",
        imagePath: "🌨️",
        rarity: "epic",
        priceTokens: 450,
      },
    ],
    priceTokens: 1100,
    originalPriceTokens: 1500,
    discountPercent: 27,
    imagePath: "❄️",
    badgeText: "Seasonal",
    highlightColor: "#00BCD4",
    featured: true,
    availableFrom: Date.now(), // Would be set to December dates in production
    availableTo: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    sortOrder: 20,
    tags: ["seasonal", "winter", "holiday"],
  },

  {
    id: "halloween_spooky",
    name: "Spooky Halloween Pack",
    description: "Get into the spooky spirit with this Halloween collection!",
    type: "seasonal",
    rarity: "epic",
    items: [
      {
        cosmeticId: "hat_witch",
        name: "Witch Hat",
        slot: "hat",
        imagePath: "🧙",
        rarity: "rare",
        priceTokens: 200,
      },
      {
        cosmeticId: "bg_haunted",
        name: "Haunted House",
        slot: "background",
        imagePath: "🏚️",
        rarity: "epic",
        priceTokens: 300,
      },
      {
        cosmeticId: "frame_spiderweb",
        name: "Spiderweb Frame",
        slot: "profile_frame",
        imagePath: "🕸️",
        rarity: "epic",
        priceTokens: 400,
      },
      {
        cosmeticId: "bubble_ghostly",
        name: "Ghostly Bubble",
        slot: "chat_bubble",
        imagePath: "👻",
        rarity: "rare",
        priceTokens: 250,
      },
    ],
    priceTokens: 850,
    originalPriceTokens: 1150,
    discountPercent: 26,
    imagePath: "🎃",
    badgeText: "Seasonal",
    highlightColor: "#FF9800",
    featured: false,
    sortOrder: 21,
    tags: ["seasonal", "halloween", "spooky"],
  },

  // =====================
  // PREMIUM BUNDLES
  // =====================
  {
    id: "legendary_collection",
    name: "Legendary Collection",
    description:
      "The ultimate collection for true collectors. Includes our rarest and most prestigious items!",
    type: "premium",
    rarity: "legendary",
    items: [
      {
        cosmeticId: "hat_legendary",
        name: "Legendary Crown",
        slot: "hat",
        imagePath: "👑",
        rarity: "legendary",
        priceTokens: 500,
      },
      {
        cosmeticId: "frame_diamond",
        name: "Diamond Frame",
        slot: "profile_frame",
        imagePath: "💎",
        rarity: "legendary",
        priceTokens: 800,
      },
      {
        cosmeticId: "bubble_holographic",
        name: "Holographic Bubble",
        slot: "chat_bubble",
        imagePath: "🌈",
        rarity: "legendary",
        priceTokens: 600,
      },
      {
        cosmeticId: "theme_aurora",
        name: "Aurora Theme",
        slot: "profile_theme",
        imagePath: "🌌",
        rarity: "legendary",
        priceTokens: 700,
      },
      {
        cosmeticId: "bg_rainbow",
        name: "Rainbow Burst",
        slot: "background",
        imagePath: "🌈",
        rarity: "epic",
        priceTokens: 400,
      },
    ],
    priceTokens: 2200,
    originalPriceTokens: 3000,
    discountPercent: 27,
    priceUSD: 19.99,
    imagePath: "👑",
    badgeText: "Premium",
    highlightColor: "#FFD700",
    featured: true,
    sortOrder: 30,
    tags: ["premium", "legendary", "exclusive"],
  },

  {
    id: "mythic_bundle",
    name: "Mythic Ascension",
    description:
      "Transcend to mythic status with the most exclusive items in the game!",
    type: "premium",
    rarity: "mythic",
    items: [
      {
        cosmeticId: "frame_cosmic_void",
        name: "Cosmic Void Frame",
        slot: "profile_frame",
        imagePath: "🌀",
        rarity: "mythic",
        priceTokens: 1500,
      },
      {
        cosmeticId: "bubble_galaxy_shift",
        name: "Galaxy Shift Bubble",
        slot: "chat_bubble",
        imagePath: "🌠",
        rarity: "mythic",
        priceTokens: 1200,
      },
      {
        cosmeticId: "theme_cosmic_void",
        name: "Cosmic Void Theme",
        slot: "profile_theme",
        imagePath: "🕳️",
        rarity: "mythic",
        priceTokens: 1500,
      },
    ],
    priceTokens: 3200,
    originalPriceTokens: 4200,
    discountPercent: 24,
    priceUSD: 29.99,
    imagePath: "🌌",
    badgeText: "Ultra Rare",
    highlightColor: "#E91E63",
    featured: true,
    limitedQuantity: 100,
    purchaseCount: 0,
    sortOrder: 31,
    tags: ["premium", "mythic", "exclusive", "limited"],
  },

  // =====================
  // LIMITED BUNDLES
  // =====================
  {
    id: "founders_pack",
    name: "Founders Pack",
    description: "Exclusive bundle for early supporters! Limited availability.",
    type: "limited",
    rarity: "legendary",
    items: [
      {
        cosmeticId: "badge_founder",
        name: "Founder Badge",
        slot: "profile_banner",
        imagePath: "⭐",
        rarity: "legendary",
        priceTokens: 0, // Exclusive to this bundle
      },
      {
        cosmeticId: "frame_founder_gold",
        name: "Founder's Gold Frame",
        slot: "profile_frame",
        imagePath: "🏆",
        rarity: "legendary",
        priceTokens: 1000,
      },
      {
        cosmeticId: "bubble_founder",
        name: "Founder's Bubble",
        slot: "chat_bubble",
        imagePath: "💬",
        rarity: "legendary",
        priceTokens: 800,
      },
    ],
    priceTokens: 1500,
    originalPriceTokens: 1800,
    discountPercent: 17,
    priceUSD: 14.99,
    imagePath: "🏆",
    badgeText: "Limited Edition",
    highlightColor: "#FFD700",
    featured: true,
    limitedQuantity: 500,
    purchaseCount: 0,
    sortOrder: 40,
    tags: ["limited", "founders", "exclusive"],
  },

  // =====================
  // ACHIEVEMENT BUNDLES
  // =====================
  {
    id: "game_master_reward",
    name: "Game Master Reward Pack",
    description: "Exclusive rewards for achieving Game Master status!",
    type: "achievement",
    rarity: "epic",
    items: [
      {
        cosmeticId: "frame_game_master",
        name: "Game Master Frame",
        slot: "profile_frame",
        imagePath: "🎮",
        rarity: "epic",
        priceTokens: 0, // Free with achievement
      },
      {
        cosmeticId: "bubble_champion",
        name: "Champion Bubble",
        slot: "chat_bubble",
        imagePath: "🏆",
        rarity: "epic",
        priceTokens: 0,
      },
    ],
    priceTokens: 0, // Free for those who qualify
    originalPriceTokens: 800,
    discountPercent: 100,
    imagePath: "🎮",
    highlightColor: "#9C27B0",
    featured: false,
    unlockRequirement: {
      type: "achievement",
      value: "game_master",
    },
    sortOrder: 50,
    tags: ["achievement", "reward", "exclusive"],
  },

  {
    id: "streak_master_reward",
    name: "Streak Master Pack",
    description: "Rewards for maintaining a 100-day streak!",
    type: "achievement",
    rarity: "legendary",
    items: [
      {
        cosmeticId: "frame_fire_streak",
        name: "Fire Streak Frame",
        slot: "profile_frame",
        imagePath: "🔥",
        rarity: "legendary",
        priceTokens: 0,
      },
      {
        cosmeticId: "bubble_streak_flame",
        name: "Streak Flame Bubble",
        slot: "chat_bubble",
        imagePath: "🔥",
        rarity: "legendary",
        priceTokens: 0,
      },
      {
        cosmeticId: "theme_streak_master",
        name: "Streak Master Theme",
        slot: "profile_theme",
        imagePath: "🔥",
        rarity: "legendary",
        priceTokens: 0,
      },
    ],
    priceTokens: 0,
    originalPriceTokens: 1500,
    discountPercent: 100,
    imagePath: "🔥",
    highlightColor: "#FF5722",
    featured: false,
    unlockRequirement: {
      type: "streak",
      value: 100,
    },
    sortOrder: 51,
    tags: ["achievement", "streak", "exclusive"],
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get bundle by ID
 */
export function getBundleById(bundleId: string): CosmeticBundle | undefined {
  return COSMETIC_BUNDLES.find((b) => b.id === bundleId);
}

/**
 * Get all bundles
 */
export function getAllBundles(): CosmeticBundle[] {
  return COSMETIC_BUNDLES;
}

/**
 * Get bundles by type
 */
export function getBundlesByType(type: BundleType): CosmeticBundle[] {
  return COSMETIC_BUNDLES.filter((b) => b.type === type);
}

/**
 * Get featured bundles
 */
export function getFeaturedBundles(): CosmeticBundle[] {
  return COSMETIC_BUNDLES.filter((b) => b.featured).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

/**
 * Get currently available bundles (not expired, not sold out)
 */
export function getAvailableBundles(): CosmeticBundle[] {
  const now = Date.now();
  return COSMETIC_BUNDLES.filter((b) => {
    // Check time availability
    if (b.availableFrom && now < b.availableFrom) return false;
    if (b.availableTo && now > b.availableTo) return false;

    // Check quantity limit
    if (
      b.limitedQuantity &&
      b.purchaseCount !== undefined &&
      b.purchaseCount >= b.limitedQuantity
    )
      return false;

    return true;
  });
}

/**
 * Get bundles by set ID (for multi-part sets)
 */
export function getBundlesBySet(setId: string): CosmeticBundle[] {
  return COSMETIC_BUNDLES.filter((b) => b.setId === setId);
}

/**
 * Get achievement-locked bundles
 */
export function getAchievementBundles(): CosmeticBundle[] {
  return COSMETIC_BUNDLES.filter((b) => b.type === "achievement");
}

/**
 * Check if bundle is available for purchase
 */
export function isBundleAvailable(bundle: CosmeticBundle): boolean {
  const now = Date.now();

  if (bundle.availableFrom && now < bundle.availableFrom) return false;
  if (bundle.availableTo && now > bundle.availableTo) return false;
  if (
    bundle.limitedQuantity &&
    bundle.purchaseCount !== undefined &&
    bundle.purchaseCount >= bundle.limitedQuantity
  )
    return false;
  if (bundle.unlockRequirement) return false; // Requires achievement check

  return true;
}

/**
 * Calculate bundle savings
 */
export function calculateBundleSavings(bundle: CosmeticBundle): {
  savedTokens: number;
  savedPercent: number;
} {
  const savedTokens = bundle.originalPriceTokens - bundle.priceTokens;
  const savedPercent = Math.round(
    (savedTokens / bundle.originalPriceTokens) * 100,
  );
  return { savedTokens, savedPercent };
}

/**
 * Get time remaining for limited-time bundle
 */
export function getBundleTimeRemaining(bundle: CosmeticBundle): number | null {
  if (!bundle.availableTo) return null;
  const remaining = bundle.availableTo - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Get stock remaining for limited-quantity bundle
 */
export function getBundleStockRemaining(bundle: CosmeticBundle): number | null {
  if (!bundle.limitedQuantity) return null;
  return bundle.limitedQuantity - (bundle.purchaseCount || 0);
}
