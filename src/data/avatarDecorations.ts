/**
 * Avatar Decoration Definitions
 *
 * Static data for all avatar decorations that can be equipped on profile pictures.
 * Decorations are 320x320 pixel overlays (PNG with transparency or animated GIF)
 * that display on top of the user's profile picture.
 *
 * NOTE: Asset paths use a placeholder system until actual assets are created.
 * The DECORATION_ASSETS object maps decoration IDs to their require() paths.
 * When assets don't exist, decorations will show as unavailable.
 *
 * @see src/types/userProfile.ts for AvatarDecoration interface
 * @see docs/NEW_PROFILE_SYSTEM_PLAN.md for implementation details
 */

import type {
  AvatarDecoration,
  DecorationCategory,
  DecorationRarity,
} from "@/types/userProfile";

// =============================================================================
// Asset Loading
// =============================================================================

/**
 * Placeholder image for decorations without assets
 * Uses a simple transparent placeholder
 */
const PLACEHOLDER_ASSET = null;

/**
 * Safely require an asset, returning placeholder if not found
 * This allows the app to run before all assets are created
 */
function safeRequire(path: string): any {
  // For now, return placeholder - replace with actual require() when assets exist
  // Example: return require('@assets/decorations/basic/circle_gold.png');
  return PLACEHOLDER_ASSET;
}

// =============================================================================
// Avatar Decoration Definitions
// =============================================================================

/**
 * All decorations use safeRequire() and are marked available: false until assets exist.
 * When adding real assets:
 * 1. Add the image to the appropriate assets/decorations/{category}/ folder
 * 2. Update the asset path in the DECORATION_ASSETS map below
 * 3. Set available: true for that decoration
 */

export const AVATAR_DECORATIONS: AvatarDecoration[] = [
  // -------------------------
  // BASIC (Free/Starter) Decorations
  // -------------------------
  {
    id: "basic_circle_gold",
    name: "Golden Ring",
    description: "A simple golden circle frame",
    assetPath: safeRequire("@assets/decorations/basic/circle_gold.png"),
    animated: false,
    rarity: "common",
    obtainMethod: { type: "free" },
    category: "basic",
    available: false,
    tags: ["circle", "gold", "simple"],
    sortOrder: 0,
  },
  {
    id: "basic_circle_silver",
    name: "Silver Ring",
    description: "A simple silver circle frame",
    assetPath: safeRequire("@assets/decorations/basic/circle_silver.png"),
    animated: false,
    rarity: "common",
    obtainMethod: { type: "free" },
    category: "basic",
    available: false,
    tags: ["circle", "silver", "simple"],
    sortOrder: 1,
  },
  {
    id: "basic_circle_rainbow",
    name: "Rainbow Ring",
    description: "A colorful rainbow circle frame",
    assetPath: safeRequire("@assets/decorations/basic/circle_rainbow.png"),
    animated: false,
    rarity: "common",
    obtainMethod: { type: "free" },
    category: "basic",
    available: false,
    tags: ["circle", "rainbow", "colorful"],
    sortOrder: 2,
  },
  {
    id: "basic_stars",
    name: "Starry Border",
    description: "Stars surrounding your profile",
    assetPath: safeRequire("@assets/decorations/basic/stars.png"),
    animated: false,
    rarity: "common",
    obtainMethod: { type: "free" },
    category: "basic",
    available: false,
    tags: ["stars", "sparkle"],
    sortOrder: 3,
  },

  // -------------------------
  // ACHIEVEMENT Decorations
  // -------------------------
  {
    id: "achievement_streak_7",
    name: "Week Warrior Frame",
    description: "Earned by maintaining a 7-day streak",
    assetPath: safeRequire("@assets/decorations/achievement/streak_7.png"),
    animated: false,
    rarity: "rare",
    obtainMethod: {
      type: "achievement",
      achievementId: "streak_7_days",
    },
    category: "achievement",
    available: false,
    tags: ["streak", "fire", "achievement"],
    sortOrder: 10,
  },
  {
    id: "achievement_streak_30",
    name: "Month Master Frame",
    description: "Earned by maintaining a 30-day streak",
    assetPath: safeRequire("@assets/decorations/achievement/streak_30.png"),
    animated: true,
    rarity: "epic",
    obtainMethod: {
      type: "achievement",
      achievementId: "streak_30_days",
    },
    category: "achievement",
    available: false,
    tags: ["streak", "fire", "achievement", "animated"],
    sortOrder: 11,
  },
  {
    id: "achievement_streak_100",
    name: "Legendary Blazer",
    description: "Earned by maintaining a 100-day streak",
    assetPath: safeRequire("@assets/decorations/achievement/streak_100.gif"),
    animated: true,
    rarity: "legendary",
    obtainMethod: {
      type: "achievement",
      achievementId: "streak_100_days",
    },
    category: "achievement",
    available: false,
    tags: ["streak", "fire", "achievement", "animated", "legendary"],
    sortOrder: 12,
  },
  {
    id: "achievement_gamer",
    name: "Pro Gamer",
    description: "Earned by playing 100 games",
    assetPath: safeRequire("@assets/decorations/achievement/gamer.png"),
    animated: false,
    rarity: "rare",
    obtainMethod: {
      type: "achievement",
      achievementId: "games_played_100",
    },
    category: "achievement",
    available: false,
    tags: ["games", "controller", "achievement"],
    sortOrder: 13,
  },
  {
    id: "achievement_social_butterfly",
    name: "Social Butterfly",
    description: "Earned by having 50 friends",
    assetPath: safeRequire("@assets/decorations/achievement/social.png"),
    animated: false,
    rarity: "epic",
    obtainMethod: {
      type: "achievement",
      achievementId: "friends_50",
    },
    category: "achievement",
    available: false,
    tags: ["friends", "social", "butterfly", "achievement"],
    sortOrder: 14,
  },
  {
    id: "achievement_champion",
    name: "Champion Crown",
    description: "Earned by getting #1 on any leaderboard",
    assetPath: safeRequire("@assets/decorations/achievement/champion.gif"),
    animated: true,
    rarity: "legendary",
    obtainMethod: {
      type: "achievement",
      achievementId: "leaderboard_first",
    },
    category: "achievement",
    available: false,
    tags: ["crown", "champion", "first", "animated"],
    sortOrder: 15,
  },

  // -------------------------
  // PREMIUM (Purchase) Decorations
  // -------------------------
  {
    id: "premium_neon_blue",
    name: "Neon Glow Blue",
    description: "Pulsing blue neon effect",
    assetPath: safeRequire("@assets/decorations/premium/neon_blue.gif"),
    animated: true,
    rarity: "rare",
    obtainMethod: {
      type: "purchase",
      priceTokens: 500,
    },
    category: "premium",
    available: false,
    tags: ["neon", "blue", "glow", "animated"],
    sortOrder: 20,
  },
  {
    id: "premium_neon_pink",
    name: "Neon Glow Pink",
    description: "Pulsing pink neon effect",
    assetPath: safeRequire("@assets/decorations/premium/neon_pink.gif"),
    animated: true,
    rarity: "rare",
    obtainMethod: {
      type: "purchase",
      priceTokens: 500,
    },
    category: "premium",
    available: false,
    tags: ["neon", "pink", "glow", "animated"],
    sortOrder: 21,
  },
  {
    id: "premium_diamond",
    name: "Diamond Frame",
    description: "Sparkling diamond border",
    assetPath: safeRequire("@assets/decorations/premium/diamond.gif"),
    animated: true,
    rarity: "epic",
    obtainMethod: {
      type: "purchase",
      priceTokens: 1000,
    },
    category: "premium",
    available: false,
    tags: ["diamond", "sparkle", "luxury", "animated"],
    sortOrder: 22,
  },
  {
    id: "premium_fire",
    name: "Flames",
    description: "Burning flames around your profile",
    assetPath: safeRequire("@assets/decorations/premium/fire.gif"),
    animated: true,
    rarity: "epic",
    obtainMethod: {
      type: "purchase",
      priceTokens: 800,
    },
    category: "premium",
    available: false,
    tags: ["fire", "flames", "hot", "animated"],
    sortOrder: 23,
  },
  {
    id: "premium_galaxy",
    name: "Galaxy Swirl",
    description: "Cosmic galaxy effect",
    assetPath: safeRequire("@assets/decorations/premium/galaxy.gif"),
    animated: true,
    rarity: "legendary",
    obtainMethod: {
      type: "purchase",
      priceTokens: 1500,
    },
    category: "premium",
    available: false,
    tags: ["galaxy", "space", "cosmic", "animated"],
    sortOrder: 24,
  },
  {
    id: "premium_hearts",
    name: "Floating Hearts",
    description: "Cute floating hearts",
    assetPath: safeRequire("@assets/decorations/premium/hearts.gif"),
    animated: true,
    rarity: "rare",
    obtainMethod: {
      type: "purchase",
      priceTokens: 400,
    },
    category: "premium",
    available: false,
    tags: ["hearts", "love", "cute", "animated"],
    sortOrder: 25,
  },

  // -------------------------
  // SEASONAL Decorations
  // -------------------------
  {
    id: "seasonal_valentines_2026",
    name: "Valentine's Love",
    description: "Limited Valentine's Day 2026 frame",
    assetPath: safeRequire("@assets/decorations/seasonal/valentines_2026.gif"),
    animated: true,
    rarity: "epic",
    obtainMethod: {
      type: "event",
      eventId: "valentines_2026",
      eventName: "Valentine's Day 2026",
      availableFrom: new Date("2026-02-01").getTime(),
      availableTo: new Date("2026-02-28").getTime(),
    },
    category: "seasonal",
    available: false,
    tags: ["valentines", "hearts", "love", "seasonal", "2026"],
    sortOrder: 30,
  },
  {
    id: "seasonal_halloween_2025",
    name: "Spooky Season",
    description: "Halloween 2025 spooky frame",
    assetPath: safeRequire("@assets/decorations/seasonal/halloween_2025.gif"),
    animated: true,
    rarity: "epic",
    obtainMethod: {
      type: "event",
      eventId: "halloween_2025",
      eventName: "Halloween 2025",
      availableFrom: new Date("2025-10-01").getTime(),
      availableTo: new Date("2025-11-01").getTime(),
    },
    category: "seasonal",
    available: false,
    tags: ["halloween", "spooky", "scary", "seasonal", "2025"],
    sortOrder: 31,
  },
  {
    id: "seasonal_christmas_2025",
    name: "Holiday Spirit",
    description: "Christmas 2025 festive frame",
    assetPath: safeRequire("@assets/decorations/seasonal/christmas_2025.gif"),
    animated: true,
    rarity: "epic",
    obtainMethod: {
      type: "event",
      eventId: "christmas_2025",
      eventName: "Christmas 2025",
      availableFrom: new Date("2025-12-01").getTime(),
      availableTo: new Date("2026-01-07").getTime(),
    },
    category: "seasonal",
    available: false,
    tags: ["christmas", "holiday", "festive", "seasonal", "2025"],
    sortOrder: 32,
  },
  {
    id: "seasonal_spring_2026",
    name: "Spring Blossoms",
    description: "Spring 2026 cherry blossom frame",
    assetPath: safeRequire("@assets/decorations/seasonal/spring_2026.png"),
    animated: false,
    rarity: "rare",
    obtainMethod: {
      type: "event",
      eventId: "spring_2026",
      eventName: "Spring 2026",
      availableFrom: new Date("2026-03-01").getTime(),
      availableTo: new Date("2026-04-30").getTime(),
    },
    category: "seasonal",
    available: false,
    tags: ["spring", "flowers", "blossom", "seasonal", "2026"],
    sortOrder: 33,
  },

  // -------------------------
  // EXCLUSIVE Decorations
  // -------------------------
  {
    id: "exclusive_beta_tester",
    name: "Beta Pioneer",
    description: "Exclusive for beta testers",
    assetPath: safeRequire("@assets/decorations/exclusive/beta_tester.png"),
    animated: false,
    rarity: "mythic",
    obtainMethod: {
      type: "exclusive",
    },
    category: "exclusive",
    available: false,
    tags: ["beta", "pioneer", "exclusive", "og"],
    sortOrder: 40,
  },
  {
    id: "exclusive_founder",
    name: "Founding Member",
    description: "For early adopters who joined in 2025",
    assetPath: safeRequire("@assets/decorations/exclusive/founder.gif"),
    animated: true,
    rarity: "mythic",
    obtainMethod: {
      type: "exclusive",
    },
    category: "exclusive",
    available: false,
    tags: ["founder", "og", "exclusive", "animated"],
    sortOrder: 41,
  },
  {
    id: "exclusive_influencer",
    name: "Influencer Badge",
    description: "Verified influencer frame",
    assetPath: safeRequire("@assets/decorations/exclusive/influencer.gif"),
    animated: true,
    rarity: "mythic",
    obtainMethod: {
      type: "exclusive",
    },
    category: "exclusive",
    available: false,
    tags: ["influencer", "verified", "exclusive", "animated"],
    sortOrder: 42,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get decoration by ID
 */
export function getDecorationById(id: string): AvatarDecoration | undefined {
  return AVATAR_DECORATIONS.find((d) => d.id === id);
}

/**
 * Get decorations by category
 */
export function getDecorationsByCategory(
  category: DecorationCategory,
): AvatarDecoration[] {
  return AVATAR_DECORATIONS.filter((d) => d.category === category).sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}

/**
 * Get decorations by rarity
 */
export function getDecorationsByRarity(
  rarity: DecorationRarity,
): AvatarDecoration[] {
  return AVATAR_DECORATIONS.filter((d) => d.rarity === rarity).sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}

/**
 * Get all available decorations (currently obtainable)
 */
export function getAvailableDecorations(): AvatarDecoration[] {
  return AVATAR_DECORATIONS.filter((d) => {
    if (!d.available) return false;

    // Check time-based availability
    const now = Date.now();
    if (d.obtainMethod.availableFrom && now < d.obtainMethod.availableFrom)
      return false;
    if (d.obtainMethod.availableTo && now > d.obtainMethod.availableTo)
      return false;

    return true;
  }).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * Get free/starter decorations
 */
export function getFreeDecorations(): AvatarDecoration[] {
  return AVATAR_DECORATIONS.filter((d) => d.obtainMethod.type === "free").sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}

/**
 * Get purchasable decorations
 */
export function getPurchasableDecorations(): AvatarDecoration[] {
  return AVATAR_DECORATIONS.filter(
    (d) => d.obtainMethod.type === "purchase" && d.available,
  ).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * Get achievement-based decorations
 */
export function getAchievementDecorations(): AvatarDecoration[] {
  return AVATAR_DECORATIONS.filter(
    (d) => d.obtainMethod.type === "achievement",
  ).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * Get event/seasonal decorations
 */
export function getSeasonalDecorations(): AvatarDecoration[] {
  return AVATAR_DECORATIONS.filter((d) => d.category === "seasonal").sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}

/**
 * Check if a decoration is currently obtainable
 */
export function isDecorationObtainable(decoration: AvatarDecoration): boolean {
  if (!decoration.available) return false;

  const now = Date.now();
  if (
    decoration.obtainMethod.availableFrom &&
    now < decoration.obtainMethod.availableFrom
  )
    return false;
  if (
    decoration.obtainMethod.availableTo &&
    now > decoration.obtainMethod.availableTo
  )
    return false;

  return true;
}

/**
 * Get decoration price in tokens (if purchasable)
 */
export function getDecorationPrice(decoration: AvatarDecoration): number {
  return decoration.obtainMethod.priceTokens ?? 0;
}

/**
 * Get all decoration categories with counts
 */
export function getDecorationCategoryCounts(): Record<
  DecorationCategory,
  number
> {
  const counts: Record<DecorationCategory, number> = {
    basic: 0,
    achievement: 0,
    premium: 0,
    seasonal: 0,
    exclusive: 0,
  };

  for (const decoration of AVATAR_DECORATIONS) {
    counts[decoration.category]++;
  }

  return counts;
}

/**
 * Search decorations by name or tags
 */
export function searchDecorations(query: string): AvatarDecoration[] {
  const lowerQuery = query.toLowerCase();
  return AVATAR_DECORATIONS.filter(
    (d) =>
      d.name.toLowerCase().includes(lowerQuery) ||
      d.description?.toLowerCase().includes(lowerQuery) ||
      d.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)),
  );
}
