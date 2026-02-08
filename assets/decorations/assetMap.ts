/**
 * Decoration Asset Map
 *
 * Maps decoration IDs to their require() calls.
 * React Native requires static require() paths — they cannot be dynamic.
 *
 * HOW TO ADD A NEW DECORATION IMAGE:
 * 1. Drop the PNG/GIF file into the correct subfolder (basic/, achievement/, etc.)
 * 2. Uncomment the corresponding require() line below
 * 3. The decoration will automatically become available in the app
 *
 * ASSET SPECS:
 * - Size: 320×320 pixels
 * - Format: PNG (with transparency) or animated GIF
 * - GIF max size: 500KB
 * - Center ~200×200px should be clear/transparent for the profile picture
 * - 10px safe zone around edges
 */

import { ImageSourcePropType } from "react-native";

/**
 * Map of decoration ID → image asset (require() call).
 * Uncomment lines as you add the corresponding image files.
 */
export const DECORATION_ASSETS: Record<string, ImageSourcePropType | null> = {
  // ─── Basic ──────────────────────────────────────────────────
  basic_circle_gold: require("./basic/circle_gold.png"),
  // basic_circle_silver: require('./basic/circle_silver.png'),
  // basic_circle_rainbow: require('./basic/circle_rainbow.png'),
  // basic_stars: require('./basic/stars.png'),
  // ─── Achievement ────────────────────────────────────────────
  achievement_streak_7: require("./achievement/streak_7.png"),
  // achievement_streak_30: require('./achievement/streak_30.png'),
  // achievement_streak_100: require('./achievement/streak_100.gif'),
  // achievement_gamer: require('./achievement/gamer.png'),
  // achievement_social_butterfly: require('./achievement/social.png'),
  // achievement_champion: require('./achievement/champion.gif'),
  // ─── Premium ────────────────────────────────────────────────
  // premium_neon_blue: require('./premium/neon_blue.gif'),
  // premium_neon_pink: require('./premium/neon_pink.gif'),
  // premium_diamond: require('./premium/diamond.gif'),
  // premium_fire: require('./premium/fire.gif'),
  // premium_galaxy: require('./premium/galaxy.gif'),
  // premium_hearts: require('./premium/hearts.gif'),
  // ─── Seasonal ───────────────────────────────────────────────
  // seasonal_valentines_2026: require('./seasonal/valentines_2026.gif'),
  // seasonal_halloween_2025: require('./seasonal/halloween_2025.gif'),
  // seasonal_christmas_2025: require('./seasonal/christmas_2025.gif'),
  // seasonal_spring_2026: require('./seasonal/spring_2026.png'),
  // ─── Exclusive ──────────────────────────────────────────────
  // exclusive_beta_tester: require('./exclusive/beta_tester.png'),
  // exclusive_founder: require('./exclusive/founder.gif'),
  // exclusive_influencer: require('./exclusive/influencer.gif'),
};

/**
 * Get the asset for a decoration by ID.
 * Returns null if the asset hasn't been added yet.
 */
export function getDecorationAsset(
  decorationId: string,
): ImageSourcePropType | null {
  return DECORATION_ASSETS[decorationId] ?? null;
}

/**
 * Check if a decoration has a real asset (not placeholder).
 */
export function hasDecorationAsset(decorationId: string): boolean {
  return DECORATION_ASSETS[decorationId] != null;
}

/**
 * Get all decoration IDs that have assets loaded.
 */
export function getLoadedDecorationIds(): string[] {
  return Object.entries(DECORATION_ASSETS)
    .filter(([, asset]) => asset != null)
    .map(([id]) => id);
}
