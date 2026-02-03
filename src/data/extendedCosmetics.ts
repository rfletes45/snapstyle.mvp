/**
 * Extended Cosmetics Catalog
 *
 * New cosmetic items for Profile Overhaul Phase 4:
 * - Clothing (tops, bottoms)
 * - Accessories (neck, ear, hand)
 * - Profile frames
 * - Profile banners
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 * @see src/types/profile.ts for ExtendedCosmeticItem type
 */

import type {
  ExtendedCosmeticItem,
  ExtendedCosmeticRarity,
  ExtendedCosmeticSlot,
  ProfileFrame,
} from "@/types/profile";

// =============================================================================
// RARITY COLORS (re-export for convenience)
// =============================================================================

export const RARITY_COLORS: Record<ExtendedCosmeticRarity, string> = {
  common: "#9E9E9E",
  rare: "#2196F3",
  epic: "#9C27B0",
  legendary: "#FF9800",
  mythic: "#E91E63",
};

// =============================================================================
// CLOTHING - TOPS
// =============================================================================

export const CLOTHING_TOPS: ExtendedCosmeticItem[] = [
  {
    id: "top_none",
    name: "No Top",
    description: "Keep it simple",
    slot: "clothing_top",
    imagePath: "",
    rarity: "common",
    unlock: { type: "starter" },
    sortOrder: 0,
  },
  {
    id: "top_tshirt_white",
    name: "Classic White Tee",
    description: "A timeless white t-shirt",
    slot: "clothing_top",
    imagePath: "👕",
    rarity: "common",
    unlock: { type: "free" },
    sortOrder: 1,
  },
  {
    id: "top_tshirt_black",
    name: "Black Tee",
    description: "Sleek and stylish",
    slot: "clothing_top",
    imagePath: "🖤",
    rarity: "common",
    unlock: { type: "free" },
    sortOrder: 2,
  },
  {
    id: "top_hoodie_gray",
    name: "Gray Hoodie",
    description: "Cozy and casual",
    slot: "clothing_top",
    imagePath: "🧥",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 150 },
    sortOrder: 3,
  },
  {
    id: "top_hoodie_neon",
    name: "Neon Hoodie",
    description: "Stand out from the crowd",
    slot: "clothing_top",
    imagePath: "💜",
    rarity: "epic",
    unlock: { type: "purchase", priceTokens: 300 },
    sortOrder: 4,
  },
  {
    id: "top_jacket_leather",
    name: "Leather Jacket",
    description: "Cool and edgy",
    slot: "clothing_top",
    imagePath: "🧥",
    rarity: "epic",
    unlock: { type: "achievement", achievementId: "games_100" },
    sortOrder: 5,
  },
  {
    id: "top_suit",
    name: "Business Suit",
    description: "Dressed for success",
    slot: "clothing_top",
    imagePath: "🤵",
    rarity: "legendary",
    unlock: { type: "achievement", achievementId: "wins_50" },
    sortOrder: 6,
  },
  {
    id: "top_jersey_champion",
    name: "Champion Jersey",
    description: "For true champions",
    slot: "clothing_top",
    imagePath: "🏆",
    rarity: "legendary",
    unlock: { type: "milestone", milestoneType: "streak", milestoneValue: 100 },
    sortOrder: 7,
  },
  {
    id: "top_royal_cape",
    name: "Royal Cape",
    description: "Fit for royalty",
    slot: "clothing_top",
    imagePath: "👑",
    rarity: "mythic",
    unlock: { type: "exclusive", source: "anniversary_2026" },
    exclusive: true,
    sortOrder: 8,
  },
];

// =============================================================================
// CLOTHING - BOTTOMS
// =============================================================================

export const CLOTHING_BOTTOMS: ExtendedCosmeticItem[] = [
  {
    id: "bottom_none",
    name: "No Bottom",
    description: "Keep it simple",
    slot: "clothing_bottom",
    imagePath: "",
    rarity: "common",
    unlock: { type: "starter" },
    sortOrder: 0,
  },
  {
    id: "bottom_jeans_blue",
    name: "Blue Jeans",
    description: "Classic denim",
    slot: "clothing_bottom",
    imagePath: "👖",
    rarity: "common",
    unlock: { type: "free" },
    sortOrder: 1,
  },
  {
    id: "bottom_jeans_black",
    name: "Black Jeans",
    description: "Dark and stylish",
    slot: "clothing_bottom",
    imagePath: "🖤",
    rarity: "common",
    unlock: { type: "free" },
    sortOrder: 2,
  },
  {
    id: "bottom_shorts",
    name: "Casual Shorts",
    description: "Perfect for summer",
    slot: "clothing_bottom",
    imagePath: "🩳",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 100 },
    sortOrder: 3,
  },
  {
    id: "bottom_sweatpants",
    name: "Sweatpants",
    description: "Maximum comfort",
    slot: "clothing_bottom",
    imagePath: "👟",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 120 },
    sortOrder: 4,
  },
];

// =============================================================================
// ACCESSORIES - NECK
// =============================================================================

export const ACCESSORIES_NECK: ExtendedCosmeticItem[] = [
  {
    id: "neck_none",
    name: "No Neckwear",
    description: "Keep it clean",
    slot: "accessory_neck",
    imagePath: "",
    rarity: "common",
    unlock: { type: "starter" },
    sortOrder: 0,
  },
  {
    id: "neck_chain_gold",
    name: "Gold Chain",
    description: "Bling bling",
    slot: "accessory_neck",
    imagePath: "⛓️",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 200 },
    sortOrder: 1,
  },
  {
    id: "neck_chain_silver",
    name: "Silver Chain",
    description: "Sleek and shiny",
    slot: "accessory_neck",
    imagePath: "🔗",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 175 },
    sortOrder: 2,
  },
  {
    id: "neck_scarf",
    name: "Cozy Scarf",
    description: "Warm and fashionable",
    slot: "accessory_neck",
    imagePath: "🧣",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 150 },
    sortOrder: 3,
  },
  {
    id: "neck_bowtie",
    name: "Bow Tie",
    description: "Classy and elegant",
    slot: "accessory_neck",
    imagePath: "🎀",
    rarity: "epic",
    unlock: { type: "achievement", achievementId: "chess_wins_50" },
    sortOrder: 4,
  },
  {
    id: "neck_medal",
    name: "Champion Medal",
    description: "A symbol of victory",
    slot: "accessory_neck",
    imagePath: "🏅",
    rarity: "legendary",
    unlock: { type: "milestone", milestoneType: "streak", milestoneValue: 365 },
    sortOrder: 5,
  },
];

// =============================================================================
// ACCESSORIES - EAR
// =============================================================================

export const ACCESSORIES_EAR: ExtendedCosmeticItem[] = [
  {
    id: "ear_none",
    name: "No Earwear",
    description: "Keep it natural",
    slot: "accessory_ear",
    imagePath: "",
    rarity: "common",
    unlock: { type: "starter" },
    sortOrder: 0,
  },
  {
    id: "ear_headphones",
    name: "Headphones",
    description: "Always in the zone",
    slot: "accessory_ear",
    imagePath: "🎧",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 175 },
    sortOrder: 1,
  },
  {
    id: "ear_airpods",
    name: "Wireless Earbuds",
    description: "Modern and sleek",
    slot: "accessory_ear",
    imagePath: "🎵",
    rarity: "epic",
    unlock: { type: "purchase", priceTokens: 250 },
    sortOrder: 2,
  },
  {
    id: "ear_stud_diamond",
    name: "Diamond Studs",
    description: "Sparkle and shine",
    slot: "accessory_ear",
    imagePath: "💎",
    rarity: "legendary",
    unlock: { type: "achievement", achievementId: "collection_50" },
    sortOrder: 3,
  },
];

// =============================================================================
// ACCESSORIES - HAND
// =============================================================================

export const ACCESSORIES_HAND: ExtendedCosmeticItem[] = [
  {
    id: "hand_none",
    name: "No Handwear",
    description: "Keep it simple",
    slot: "accessory_hand",
    imagePath: "",
    rarity: "common",
    unlock: { type: "starter" },
    sortOrder: 0,
  },
  {
    id: "hand_watch_classic",
    name: "Classic Watch",
    description: "Timeless elegance",
    slot: "accessory_hand",
    imagePath: "⌚",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 200 },
    sortOrder: 1,
  },
  {
    id: "hand_watch_smart",
    name: "Smart Watch",
    description: "Tech-savvy style",
    slot: "accessory_hand",
    imagePath: "📱",
    rarity: "epic",
    unlock: { type: "purchase", priceTokens: 300 },
    sortOrder: 2,
  },
  {
    id: "hand_bracelet",
    name: "Friendship Bracelet",
    description: "A symbol of friendship",
    slot: "accessory_hand",
    imagePath: "📿",
    rarity: "epic",
    unlock: { type: "achievement", achievementId: "social_50_friends" },
    sortOrder: 3,
  },
  {
    id: "hand_gloves_boxing",
    name: "Boxing Gloves",
    description: "Ready to fight",
    slot: "accessory_hand",
    imagePath: "🥊",
    rarity: "legendary",
    unlock: { type: "achievement", achievementId: "wins_100" },
    sortOrder: 4,
  },
];

// =============================================================================
// PROFILE FRAMES
// =============================================================================

export const PROFILE_FRAMES: ProfileFrame[] = [
  {
    id: "frame_none",
    name: "No Frame",
    description: "Keep it clean",
    tier: "basic",
    rarity: "common",
    staticImagePath: "",
    unlock: { type: "starter" },
    sortOrder: 0,
  },
  {
    id: "frame_simple_gold",
    name: "Gold Ring",
    description: "A simple golden border",
    tier: "basic",
    rarity: "rare",
    staticImagePath: "gold_ring",
    effects: {
      border: {
        width: 3,
        style: "solid",
        color: "#FFD700",
      },
    },
    unlock: { type: "purchase", priceTokens: 100 },
    sortOrder: 1,
  },
  {
    id: "frame_simple_silver",
    name: "Silver Ring",
    description: "A sleek silver border",
    tier: "basic",
    rarity: "rare",
    staticImagePath: "silver_ring",
    effects: {
      border: {
        width: 3,
        style: "solid",
        color: "#C0C0C0",
      },
    },
    unlock: { type: "purchase", priceTokens: 100 },
    sortOrder: 2,
  },
  {
    id: "frame_neon_blue",
    name: "Neon Blue",
    description: "Electric blue glow",
    tier: "premium",
    rarity: "epic",
    staticImagePath: "neon_blue",
    effects: {
      glow: {
        color: "#00D4FF",
        intensity: 0.7,
        animated: true,
      },
      border: {
        width: 3,
        style: "solid",
        color: "#00D4FF",
      },
    },
    unlock: { type: "purchase", priceTokens: 250 },
    sortOrder: 3,
  },
  {
    id: "frame_neon_pink",
    name: "Neon Pink",
    description: "Hot pink glow",
    tier: "premium",
    rarity: "epic",
    staticImagePath: "neon_pink",
    effects: {
      glow: {
        color: "#FF1493",
        intensity: 0.7,
        animated: true,
      },
      border: {
        width: 3,
        style: "solid",
        color: "#FF1493",
      },
    },
    unlock: { type: "purchase", priceTokens: 250 },
    sortOrder: 4,
  },
  {
    id: "frame_fire",
    name: "Flame Frame",
    description: "On fire!",
    tier: "elite",
    rarity: "legendary",
    staticImagePath: "fire",
    animatedImagePath: "fire_animated",
    effects: {
      glow: {
        color: "#FF4500",
        intensity: 0.8,
        animated: true,
      },
      particles: {
        type: "fire",
        color: "#FF6600",
        density: 5,
      },
      border: {
        width: 4,
        style: "gradient",
        color: {
          type: "linear",
          colors: ["#FF0000", "#FF6600", "#FFD700"],
          angle: 180,
        },
      },
    },
    unlock: { type: "milestone", milestoneType: "streak", milestoneValue: 100 },
    sortOrder: 5,
  },
  {
    id: "frame_ice",
    name: "Frost Frame",
    description: "Cool as ice",
    tier: "elite",
    rarity: "legendary",
    staticImagePath: "ice",
    animatedImagePath: "ice_animated",
    effects: {
      glow: {
        color: "#00BFFF",
        intensity: 0.6,
        animated: true,
      },
      particles: {
        type: "snow",
        color: "#FFFFFF",
        density: 3,
      },
      border: {
        width: 4,
        style: "gradient",
        color: {
          type: "linear",
          colors: ["#00BFFF", "#87CEEB", "#FFFFFF"],
          angle: 180,
        },
      },
    },
    unlock: { type: "achievement", achievementId: "games_500" },
    sortOrder: 6,
  },
  {
    id: "frame_rainbow",
    name: "Rainbow Frame",
    description: "All colors of the spectrum",
    tier: "elite",
    rarity: "legendary",
    staticImagePath: "rainbow",
    animatedImagePath: "rainbow_animated",
    effects: {
      border: {
        width: 4,
        style: "gradient",
        color: {
          type: "linear",
          colors: [
            "#FF0000",
            "#FF7F00",
            "#FFFF00",
            "#00FF00",
            "#0000FF",
            "#8B00FF",
          ],
          angle: 45,
        },
      },
    },
    unlock: { type: "achievement", achievementId: "badge_collector_20" },
    sortOrder: 7,
  },
  {
    id: "frame_galaxy",
    name: "Galaxy Frame",
    description: "Cosmic and otherworldly",
    tier: "legendary",
    rarity: "mythic",
    staticImagePath: "galaxy",
    animatedImagePath: "galaxy_animated",
    effects: {
      glow: {
        color: "#9400D3",
        intensity: 0.9,
        animated: true,
      },
      particles: {
        type: "stars",
        color: "#FFFFFF",
        density: 8,
      },
      border: {
        width: 5,
        style: "gradient",
        color: {
          type: "linear",
          colors: ["#000033", "#4B0082", "#9400D3", "#FF1493"],
          angle: 135,
        },
      },
    },
    unlock: { type: "exclusive", source: "beta_tester" },
    exclusive: true,
    sortOrder: 8,
  },
  {
    id: "frame_champion",
    name: "Champion Frame",
    description: "For true champions",
    tier: "legendary",
    rarity: "mythic",
    staticImagePath: "champion",
    animatedImagePath: "champion_animated",
    effects: {
      glow: {
        color: "#FFD700",
        intensity: 1.0,
        animated: true,
      },
      particles: {
        type: "sparkle",
        color: "#FFD700",
        density: 6,
      },
      border: {
        width: 5,
        style: "gradient",
        color: {
          type: "linear",
          colors: ["#FFD700", "#FFA500", "#FFD700"],
          angle: 0,
        },
      },
    },
    unlock: { type: "milestone", milestoneType: "streak", milestoneValue: 365 },
    sortOrder: 9,
  },
];

// =============================================================================
// PROFILE BANNERS
// =============================================================================

export const PROFILE_BANNERS: ExtendedCosmeticItem[] = [
  {
    id: "banner_none",
    name: "No Banner",
    description: "Keep it minimal",
    slot: "profile_banner",
    imagePath: "",
    rarity: "common",
    unlock: { type: "starter" },
    sortOrder: 0,
  },
  {
    id: "banner_gradient_blue",
    name: "Ocean Gradient",
    description: "Calming blue waves",
    slot: "profile_banner",
    imagePath: "gradient_blue",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 150 },
    sortOrder: 1,
  },
  {
    id: "banner_gradient_sunset",
    name: "Sunset Gradient",
    description: "Warm sunset colors",
    slot: "profile_banner",
    imagePath: "gradient_sunset",
    rarity: "rare",
    unlock: { type: "purchase", priceTokens: 150 },
    sortOrder: 2,
  },
  {
    id: "banner_stars",
    name: "Starry Night",
    description: "Twinkling stars",
    slot: "profile_banner",
    imagePath: "stars",
    rarity: "epic",
    unlock: { type: "purchase", priceTokens: 250 },
    animated: true,
    sortOrder: 3,
  },
  {
    id: "banner_geometric",
    name: "Geometric Pattern",
    description: "Modern and clean",
    slot: "profile_banner",
    imagePath: "geometric",
    rarity: "epic",
    unlock: { type: "achievement", achievementId: "games_100" },
    sortOrder: 4,
  },
  {
    id: "banner_fire",
    name: "Flame Banner",
    description: "Burning hot",
    slot: "profile_banner",
    imagePath: "fire",
    rarity: "legendary",
    unlock: { type: "milestone", milestoneType: "streak", milestoneValue: 100 },
    animated: true,
    sortOrder: 5,
  },
  {
    id: "banner_galaxy",
    name: "Galaxy Banner",
    description: "Cosmic infinity",
    slot: "profile_banner",
    imagePath: "galaxy",
    rarity: "mythic",
    unlock: { type: "exclusive", source: "anniversary_2026" },
    exclusive: true,
    animated: true,
    sortOrder: 6,
  },
];

// =============================================================================
// ALL EXTENDED COSMETICS COMBINED
// =============================================================================

export const ALL_EXTENDED_COSMETICS: ExtendedCosmeticItem[] = [
  ...CLOTHING_TOPS,
  ...CLOTHING_BOTTOMS,
  ...ACCESSORIES_NECK,
  ...ACCESSORIES_EAR,
  ...ACCESSORIES_HAND,
  ...PROFILE_BANNERS,
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get extended cosmetic item by ID
 */
export function getExtendedItemById(
  itemId: string,
): ExtendedCosmeticItem | undefined {
  return ALL_EXTENDED_COSMETICS.find((item) => item.id === itemId);
}

/**
 * Get extended cosmetic items by slot
 */
export function getExtendedItemsBySlot(
  slot: ExtendedCosmeticSlot,
): ExtendedCosmeticItem[] {
  return ALL_EXTENDED_COSMETICS.filter((item) => item.slot === slot).sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
  );
}

/**
 * Get frame by ID
 */
export function getFrameById(frameId: string): ProfileFrame | undefined {
  return PROFILE_FRAMES.find((frame) => frame.id === frameId);
}

/**
 * Get all frames sorted by tier/rarity
 */
export function getAllFrames(): ProfileFrame[] {
  return [...PROFILE_FRAMES].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
  );
}

/**
 * Get items by rarity
 */
export function getItemsByRarity(
  rarity: ExtendedCosmeticRarity,
): ExtendedCosmeticItem[] {
  return ALL_EXTENDED_COSMETICS.filter((item) => item.rarity === rarity);
}

/**
 * Get purchasable items (can buy with tokens)
 */
export function getPurchasableItems(): ExtendedCosmeticItem[] {
  return ALL_EXTENDED_COSMETICS.filter(
    (item) =>
      item.unlock.type === "purchase" && item.unlock.priceTokens !== undefined,
  );
}

/**
 * Get achievement-locked items
 */
export function getAchievementItems(): ExtendedCosmeticItem[] {
  return ALL_EXTENDED_COSMETICS.filter(
    (item) => item.unlock.type === "achievement",
  );
}

/**
 * Get exclusive items
 */
export function getExclusiveItems(): ExtendedCosmeticItem[] {
  return ALL_EXTENDED_COSMETICS.filter((item) => item.exclusive === true);
}

/**
 * Check if item is free (starter or free unlock)
 */
export function isItemFree(item: ExtendedCosmeticItem): boolean {
  return item.unlock.type === "free" || item.unlock.type === "starter";
}

/**
 * Get rarity color
 */
export function getRarityColor(rarity: ExtendedCosmeticRarity): string {
  return RARITY_COLORS[rarity];
}
