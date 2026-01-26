/**
 * Cosmetics Catalog - Static data for all cosmetic items
 */

import type { CosmeticItem } from "@/types/models";

// ============================================================
// COSMETICS CATALOG
// ============================================================

export const COSMETIC_ITEMS: CosmeticItem[] = [
  // ----------------------
  // BACKGROUNDS
  // ----------------------
  {
    id: "bg_default",
    name: "Default",
    slot: "background",
    imagePath: "", // Uses baseColor
    rarity: "common",
    unlock: { type: "starter" },
  },
  {
    id: "bg_gradient",
    name: "Gradient Glow",
    slot: "background",
    imagePath: "gradient",
    rarity: "rare",
    unlock: { type: "milestone", value: "streak_14" },
  },
  {
    id: "bg_rainbow",
    name: "Rainbow Burst",
    slot: "background",
    imagePath: "rainbow",
    rarity: "epic",
    unlock: { type: "milestone", value: "streak_100" },
  },
  {
    id: "bg_galaxy",
    name: "Galaxy Background",
    slot: "background",
    imagePath: "🌌",
    rarity: "epic",
    unlock: { type: "free" },
  },
  {
    id: "bg_sunset",
    name: "Sunset Vibes",
    slot: "background",
    imagePath: "🌅",
    rarity: "rare",
    unlock: { type: "free" },
  },
  {
    id: "bg_city",
    name: "City Lights",
    slot: "background",
    imagePath: "🌃",
    rarity: "rare",
    unlock: { type: "free" },
  },
  {
    id: "bg_neon",
    name: "Neon Dreams",
    slot: "background",
    imagePath: "💜",
    rarity: "epic",
    unlock: { type: "free" },
  },

  // ----------------------
  // HATS
  // ----------------------
  {
    id: "hat_none",
    name: "No Hat",
    slot: "hat",
    imagePath: "",
    rarity: "common",
    unlock: { type: "starter" },
  },
  {
    id: "hat_flame",
    name: "Flame Cap",
    slot: "hat",
    imagePath: "🔥",
    rarity: "common",
    unlock: { type: "milestone", value: "streak_3" },
  },
  {
    id: "hat_crown",
    name: "Golden Crown",
    slot: "hat",
    imagePath: "👑",
    rarity: "rare",
    unlock: { type: "milestone", value: "streak_30" },
  },
  {
    id: "hat_legendary",
    name: "Legendary Halo",
    slot: "hat",
    imagePath: "😇",
    rarity: "epic",
    unlock: { type: "milestone", value: "streak_365" },
  },
  {
    id: "hat_party",
    name: "Party Hat",
    slot: "hat",
    imagePath: "🎉",
    rarity: "common",
    unlock: { type: "free" },
  },
  {
    id: "hat_cap",
    name: "Cool Cap",
    slot: "hat",
    imagePath: "🧢",
    rarity: "common",
    unlock: { type: "free" },
  },
  {
    id: "hat_beanie",
    name: "Cozy Beanie",
    slot: "hat",
    imagePath: "🎿",
    rarity: "common",
    unlock: { type: "free" },
  },
  {
    id: "hat_tophat",
    name: "Top Hat",
    slot: "hat",
    imagePath: "🎩",
    rarity: "rare",
    unlock: { type: "free" },
  },

  // ----------------------
  // GLASSES
  // ----------------------
  {
    id: "glasses_none",
    name: "No Glasses",
    slot: "glasses",
    imagePath: "",
    rarity: "common",
    unlock: { type: "starter" },
  },
  {
    id: "glasses_cool",
    name: "Cool Shades",
    slot: "glasses",
    imagePath: "😎",
    rarity: "common",
    unlock: { type: "milestone", value: "streak_7" },
  },
  {
    id: "glasses_round",
    name: "Round Glasses",
    slot: "glasses",
    imagePath: "👓",
    rarity: "common",
    unlock: { type: "free" },
  },
  {
    id: "glasses_sunglasses",
    name: "Cool Sunglasses",
    slot: "glasses",
    imagePath: "🕶️",
    rarity: "rare",
    unlock: { type: "free" },
  },
  {
    id: "glasses_vr",
    name: "VR Headset",
    slot: "glasses",
    imagePath: "🥽",
    rarity: "epic",
    unlock: { type: "free" },
  },
  {
    id: "glasses_star",
    name: "Star Glasses",
    slot: "glasses",
    imagePath: "🤩",
    rarity: "rare",
    unlock: { type: "milestone", value: "streak_50" },
  },
  {
    id: "glasses_nerd",
    name: "Nerd Glasses",
    slot: "glasses",
    imagePath: "🤓",
    rarity: "common",
    unlock: { type: "free" },
  },
];

// ============================================================
// MILESTONE REWARDS MAPPING
// Maps streak day count to cosmetic item ID
// ============================================================

export const MILESTONE_REWARDS: Record<number, string> = {
  3: "hat_flame",
  7: "glasses_cool",
  14: "bg_gradient",
  30: "hat_crown",
  50: "glasses_star",
  100: "bg_rainbow",
  365: "hat_legendary",
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get a cosmetic item by its ID
 */
export function getItemById(itemId: string): CosmeticItem | undefined {
  return COSMETIC_ITEMS.find((item) => item.id === itemId);
}

/**
 * Get all cosmetic items for a specific slot
 */
export function getItemsBySlot(
  slot: "hat" | "glasses" | "background",
): CosmeticItem[] {
  return COSMETIC_ITEMS.filter((item) => item.slot === slot);
}

/**
 * Get the cosmetic reward for a streak milestone
 */
export function getMilestoneReward(
  streakDays: number,
): CosmeticItem | undefined {
  const itemId = MILESTONE_REWARDS[streakDays];
  if (!itemId) return undefined;
  return getItemById(itemId);
}

/**
 * Get all starter items (granted to all new users)
 */
export function getStarterItems(): CosmeticItem[] {
  return COSMETIC_ITEMS.filter((item) => item.unlock.type === "starter");
}

/**
 * Get all free items (available to all users)
 */
export function getFreeItems(): CosmeticItem[] {
  return COSMETIC_ITEMS.filter(
    (item) => item.unlock.type === "free" || item.unlock.type === "starter",
  );
}

/**
 * Get milestone items and their required streak days
 */
export function getMilestoneItems(): {
  item: CosmeticItem;
  streakDays: number;
}[] {
  return Object.entries(MILESTONE_REWARDS).map(([days, itemId]) => ({
    streakDays: parseInt(days, 10),
    item: getItemById(itemId)!,
  }));
}

/**
 * Check if an item is a milestone reward
 */
export function isMilestoneItem(itemId: string): boolean {
  return Object.values(MILESTONE_REWARDS).includes(itemId);
}

/**
 * Get required streak days for a milestone item
 */
export function getRequiredStreak(itemId: string): number | undefined {
  const entry = Object.entries(MILESTONE_REWARDS).find(
    ([, id]) => id === itemId,
  );
  return entry ? parseInt(entry[0], 10) : undefined;
}
