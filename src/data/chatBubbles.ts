/**
 * Chat Bubble Style Definitions
 *
 * Static data for all chat bubble styles that can be equipped.
 * Bubble styles customize how a user's messages appear in chat.
 *
 * @see src/types/profile.ts for ChatBubbleStyle interface
 */

import type {
  ChatBubbleStyle,
  ExtendedCosmeticRarity,
  GradientConfig,
} from "@/types/profile";

// =============================================================================
// Chat Bubble Style Definitions
// =============================================================================

export const CHAT_BUBBLE_STYLES: ChatBubbleStyle[] = [
  // -------------------------
  // FREE/STARTER BUBBLES
  // -------------------------
  {
    id: "default",
    name: "Default",
    description: "The classic message bubble",
    rarity: "common",
    background: "#6200EE",
    borderRadius: 18,
    textColor: "#FFFFFF",
    linkColor: "#B9F2FF",
    unlock: { type: "free" },
    sortOrder: 0,
  },
  {
    id: "simple_gray",
    name: "Simple Gray",
    description: "A clean, minimal look",
    rarity: "common",
    background: "#424242",
    borderRadius: 16,
    textColor: "#FFFFFF",
    linkColor: "#90CAF9",
    unlock: { type: "free" },
    sortOrder: 1,
  },
  {
    id: "soft_blue",
    name: "Soft Blue",
    description: "Calming blue tones",
    rarity: "common",
    background: "#1976D2",
    borderRadius: 18,
    textColor: "#FFFFFF",
    linkColor: "#E3F2FD",
    unlock: { type: "starter" },
    sortOrder: 2,
  },
  {
    id: "forest_green",
    name: "Forest Green",
    description: "Natural green vibes",
    rarity: "common",
    background: "#2E7D32",
    borderRadius: 18,
    textColor: "#FFFFFF",
    linkColor: "#C8E6C9",
    unlock: { type: "starter" },
    sortOrder: 3,
  },

  // -------------------------
  // RARE BUBBLES
  // -------------------------
  {
    id: "sunset_orange",
    name: "Sunset Orange",
    description: "Warm sunset colors",
    rarity: "rare",
    background: {
      type: "linear",
      colors: ["#FF6B6B", "#FF8E53"],
      angle: 135,
    } as GradientConfig,
    borderRadius: 20,
    textColor: "#FFFFFF",
    linkColor: "#FFE082",
    unlock: { type: "purchase", priceTokens: 200 },
    sortOrder: 10,
  },
  {
    id: "ocean_wave",
    name: "Ocean Wave",
    description: "Cool ocean gradient",
    rarity: "rare",
    background: {
      type: "linear",
      colors: ["#0077B6", "#00B4D8"],
      angle: 90,
    } as GradientConfig,
    borderRadius: 20,
    textColor: "#FFFFFF",
    linkColor: "#E0F7FA",
    unlock: { type: "purchase", priceTokens: 200 },
    sortOrder: 11,
  },
  {
    id: "lavender_dream",
    name: "Lavender Dream",
    description: "Soft purple tones",
    rarity: "rare",
    background: {
      type: "linear",
      colors: ["#9C27B0", "#BA68C8"],
      angle: 135,
    } as GradientConfig,
    borderRadius: 22,
    textColor: "#FFFFFF",
    linkColor: "#F3E5F5",
    unlock: { type: "purchase", priceTokens: 250 },
    sortOrder: 12,
  },
  {
    id: "mint_fresh",
    name: "Mint Fresh",
    description: "Cool mint gradient",
    rarity: "rare",
    background: {
      type: "linear",
      colors: ["#00BFA5", "#64FFDA"],
      angle: 90,
    } as GradientConfig,
    borderRadius: 18,
    textColor: "#004D40",
    linkColor: "#1DE9B6",
    unlock: { type: "milestone", milestoneType: "streak", milestoneValue: 7 },
    sortOrder: 13,
  },
  {
    id: "coral_reef",
    name: "Coral Reef",
    description: "Vibrant coral colors",
    rarity: "rare",
    background: {
      type: "linear",
      colors: ["#FF7043", "#FFAB91"],
      angle: 45,
    } as GradientConfig,
    borderRadius: 20,
    textColor: "#FFFFFF",
    linkColor: "#FFE0B2",
    unlock: { type: "purchase", priceTokens: 250 },
    sortOrder: 14,
  },
  {
    id: "slate_pro",
    name: "Slate Pro",
    description: "Professional dark slate",
    rarity: "rare",
    background: "#37474F",
    borderColor: "#546E7A",
    borderWidth: 2,
    borderRadius: 16,
    textColor: "#ECEFF1",
    linkColor: "#80DEEA",
    unlock: { type: "purchase", priceTokens: 200 },
    sortOrder: 15,
  },

  // -------------------------
  // EPIC BUBBLES (with effects)
  // -------------------------
  {
    id: "neon_pink",
    name: "Neon Pink",
    description: "Glowing neon pink",
    rarity: "epic",
    background: "#FF1493",
    borderColor: "#FF69B4",
    borderWidth: 2,
    borderRadius: 20,
    effect: "glow",
    effectColor: "#FF1493",
    textColor: "#FFFFFF",
    linkColor: "#FFB6C1",
    unlock: { type: "purchase", priceTokens: 500 },
    sortOrder: 20,
  },
  {
    id: "cyber_blue",
    name: "Cyber Blue",
    description: "Electric blue with glow",
    rarity: "epic",
    background: "#0D47A1",
    borderColor: "#2196F3",
    borderWidth: 2,
    borderRadius: 18,
    effect: "glow",
    effectColor: "#2196F3",
    textColor: "#FFFFFF",
    linkColor: "#90CAF9",
    unlock: { type: "purchase", priceTokens: 500 },
    sortOrder: 21,
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Shimmering aurora colors",
    rarity: "epic",
    background: {
      type: "linear",
      colors: ["#00FF88", "#00D9FF", "#9B59B6"],
      angle: 135,
    } as GradientConfig,
    borderRadius: 22,
    effect: "shimmer",
    effectColor: "#FFFFFF",
    effectSpeed: 2,
    textColor: "#FFFFFF",
    linkColor: "#E0FFFF",
    unlock: { type: "purchase", priceTokens: 600 },
    sortOrder: 22,
  },
  {
    id: "fire",
    name: "Fire",
    description: "Burning flames",
    rarity: "epic",
    background: {
      type: "linear",
      colors: ["#FF4500", "#FF6347", "#FFD700"],
      angle: 180,
    } as GradientConfig,
    borderRadius: 20,
    effect: "pulse",
    effectColor: "#FF4500",
    effectSpeed: 1.5,
    textColor: "#FFFFFF",
    linkColor: "#FFE4B5",
    unlock: { type: "achievement", achievementId: "streak_30" },
    sortOrder: 23,
  },
  {
    id: "midnight_galaxy",
    name: "Midnight Galaxy",
    description: "Stars in the night sky",
    rarity: "epic",
    background: {
      type: "linear",
      colors: ["#1A1A2E", "#16213E", "#0F3460"],
      angle: 135,
    } as GradientConfig,
    borderColor: "#9B59B6",
    borderWidth: 1,
    borderRadius: 20,
    effect: "shimmer",
    effectColor: "#FFFFFF",
    effectSpeed: 3,
    textColor: "#FFFFFF",
    linkColor: "#BB8FCE",
    unlock: { type: "purchase", priceTokens: 650 },
    sortOrder: 24,
  },
  {
    id: "golden_luxury",
    name: "Golden Luxury",
    description: "Premium gold styling",
    rarity: "epic",
    background: "#1A1A1A",
    borderColor: "#FFD700",
    borderWidth: 2,
    borderRadius: 18,
    effect: "glow",
    effectColor: "#FFD700",
    textColor: "#FFD700",
    linkColor: "#FFA500",
    unlock: { type: "milestone", milestoneType: "level", milestoneValue: 20 },
    sortOrder: 25,
  },

  // -------------------------
  // LEGENDARY BUBBLES
  // -------------------------
  {
    id: "rainbow",
    name: "Rainbow",
    description: "All colors of the rainbow",
    rarity: "legendary",
    background: {
      type: "linear",
      colors: [
        "#FF0000",
        "#FF7F00",
        "#FFFF00",
        "#00FF00",
        "#0000FF",
        "#8B00FF",
      ],
      angle: 90,
    } as GradientConfig,
    borderRadius: 22,
    effect: "gradient-shift",
    effectSpeed: 3,
    textColor: "#FFFFFF",
    linkColor: "#FFFFFF",
    unlock: { type: "purchase", priceTokens: 1500 },
    sortOrder: 30,
  },
  {
    id: "holographic",
    name: "Holographic",
    description: "Iridescent shifting colors",
    rarity: "legendary",
    background: {
      type: "linear",
      colors: ["#FF6B6B", "#FFE66D", "#4ECDC4", "#95E1D3"],
      angle: 45,
    } as GradientConfig,
    borderRadius: 24,
    effect: "gradient-shift",
    effectSpeed: 2,
    textColor: "#1A1A2E",
    linkColor: "#4A4A6A",
    unlock: { type: "purchase", priceTokens: 1800 },
    sortOrder: 31,
  },
  {
    id: "diamond",
    name: "Diamond",
    description: "Sparkling like a diamond",
    rarity: "legendary",
    background: {
      type: "linear",
      colors: ["#E0E8F0", "#B9F2FF", "#87CEEB"],
      angle: 135,
    } as GradientConfig,
    borderColor: "#B9F2FF",
    borderWidth: 2,
    borderRadius: 20,
    effect: "shimmer",
    effectColor: "#FFFFFF",
    effectSpeed: 1.5,
    textColor: "#1A1A2E",
    linkColor: "#4682B4",
    unlock: { type: "achievement", achievementId: "streak_100" },
    sortOrder: 32,
  },
  {
    id: "phoenix",
    name: "Phoenix",
    description: "Rise from the ashes",
    rarity: "legendary",
    background: {
      type: "linear",
      colors: ["#FF4500", "#FF6347", "#FFD700", "#FFA500"],
      angle: 180,
    } as GradientConfig,
    borderColor: "#FFD700",
    borderWidth: 2,
    borderRadius: 22,
    effect: "pulse",
    effectColor: "#FF4500",
    effectSpeed: 1,
    textColor: "#FFFFFF",
    linkColor: "#FFE4B5",
    unlock: { type: "milestone", milestoneType: "level", milestoneValue: 50 },
    sortOrder: 33,
  },

  // -------------------------
  // MYTHIC BUBBLES
  // -------------------------
  {
    id: "void",
    name: "Void",
    description: "Messages from the void",
    rarity: "mythic",
    background: "#000000",
    borderColor: "#8B00FF",
    borderWidth: 2,
    borderRadius: 20,
    effect: "glow",
    effectColor: "#8B00FF",
    textColor: "#8B00FF",
    linkColor: "#DA70D6",
    unlock: { type: "exclusive", source: "beta_tester" },
    sortOrder: 40,
  },
  {
    id: "champion_gold",
    name: "Champion",
    description: "For true champions",
    rarity: "mythic",
    background: {
      type: "linear",
      colors: ["#FFD700", "#FFA500", "#FF8C00"],
      angle: 135,
    } as GradientConfig,
    borderColor: "#FFFFFF",
    borderWidth: 2,
    borderRadius: 24,
    effect: "shimmer",
    effectColor: "#FFFFFF",
    effectSpeed: 1,
    textColor: "#000000",
    linkColor: "#8B4513",
    unlock: { type: "achievement", achievementId: "streak_365" },
    sortOrder: 41,
  },
  {
    id: "cosmic",
    name: "Cosmic",
    description: "Power of the cosmos",
    rarity: "mythic",
    background: {
      type: "radial",
      colors: ["#8B00FF", "#4B0082", "#000000"],
      centerX: 0.5,
      centerY: 0.5,
    } as GradientConfig,
    borderRadius: 22,
    effect: "pulse",
    effectColor: "#8B00FF",
    effectSpeed: 2,
    textColor: "#FFFFFF",
    linkColor: "#DA70D6",
    unlock: { type: "milestone", milestoneType: "level", milestoneValue: 100 },
    sortOrder: 42,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get bubble style by ID
 */
export function getBubbleStyleById(
  styleId: string,
): ChatBubbleStyle | undefined {
  return CHAT_BUBBLE_STYLES.find((s) => s.id === styleId);
}

/**
 * Get all bubble styles (sorted by sortOrder)
 */
export function getAllBubbleStyles(): ChatBubbleStyle[] {
  return [...CHAT_BUBBLE_STYLES].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}

/**
 * Get bubble styles by rarity
 */
export function getBubbleStylesByRarity(
  rarity: ExtendedCosmeticRarity,
): ChatBubbleStyle[] {
  return CHAT_BUBBLE_STYLES.filter((s) => s.rarity === rarity);
}

/**
 * Get free/starter bubble styles
 */
export function getFreeBubbleStyles(): ChatBubbleStyle[] {
  return CHAT_BUBBLE_STYLES.filter(
    (s) => s.unlock.type === "free" || s.unlock.type === "starter",
  );
}

/**
 * Get purchasable bubble styles
 */
export function getPurchasableBubbleStyles(): ChatBubbleStyle[] {
  return CHAT_BUBBLE_STYLES.filter((s) => s.unlock.type === "purchase");
}

/**
 * Get bubble styles with effects
 */
export function getBubbleStylesWithEffects(): ChatBubbleStyle[] {
  return CHAT_BUBBLE_STYLES.filter((s) => s.effect && s.effect !== "none");
}

/**
 * Check if a background is a gradient
 */
export function isBubbleGradient(
  background: string | GradientConfig,
): background is GradientConfig {
  return (
    typeof background === "object" &&
    "type" in background &&
    "colors" in background
  );
}

/**
 * Get the primary color from a bubble background
 */
export function getBubblePrimaryColor(
  background: string | GradientConfig,
): string {
  if (isBubbleGradient(background)) {
    return background.colors[0];
  }
  return background;
}

/**
 * Get total bubble style count
 */
export function getTotalBubbleStyleCount(): number {
  return CHAT_BUBBLE_STYLES.length;
}

/**
 * Get bubble style count by rarity
 */
export function getBubbleStyleCountByRarity(): Record<
  ExtendedCosmeticRarity,
  number
> {
  const counts: Record<ExtendedCosmeticRarity, number> = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
  };

  CHAT_BUBBLE_STYLES.forEach((style) => {
    counts[style.rarity]++;
  });

  return counts;
}

/**
 * Get default bubble style
 */
export function getDefaultBubbleStyle(): ChatBubbleStyle {
  return CHAT_BUBBLE_STYLES.find((s) => s.id === "default")!;
}
