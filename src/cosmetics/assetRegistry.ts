/**
 * Unified Cosmetics Asset Registry
 *
 * Single source of truth for all cosmetic image assets.
 * Every entry uses a static require() call — Expo bundler requires
 * this for deterministic bundling (no dynamic string-based requires).
 *
 * Usage:
 *   import { getCosmeticAsset, hasCosmeticAsset } from "@/cosmetics/assetRegistry";
 *   const src = getCosmeticAsset("decoration", "basic_circle_gold");
 *
 * @module cosmetics/assetRegistry
 */

import type { CosmeticImageSource, CosmeticType } from "./types";

// =============================================================================
// Badge Assets
// =============================================================================

export const badgeAssets: Record<string, CosmeticImageSource> = {
  badge_2048_master: require("../../assets/cosmetics/badges/2048_Master.png"),
  badge_bounce_blitz_master: require("../../assets/cosmetics/badges/Bounce_Blitz_Master.png"),
  badge_brick_breaker_master: require("../../assets/cosmetics/badges/Brick_Breaker_Master.png"),
  badge_checkers_master: require("../../assets/cosmetics/badges/Checkers_Master.png"),
  badge_chess_master: require("../../assets/cosmetics/badges/Chess_Master.png"),
  badge_dots_and_boxes_master: require("../../assets/cosmetics/badges/Dots_and_Boxes_Master.png"),
  badge_four_master: require("../../assets/cosmetics/badges/Four_Master.png"),
  badge_gomoku_master: require("../../assets/cosmetics/badges/Gomoku_Master.png"),
  badge_minesweeper_master: require("../../assets/cosmetics/badges/Minesweeper_Master.png"),
  badge_pong_master: require("../../assets/cosmetics/badges/Pong_Master.png"),
  badge_reversi_master: require("../../assets/cosmetics/badges/Reversi_Master.png"),
  badge_ttt_master: require("../../assets/cosmetics/badges/Tic-Tac-Toe_Master.png"),
} as const;

// =============================================================================
// Background Assets
// =============================================================================

export const backgroundAssets: Record<string, CosmeticImageSource> = {
  // ── Existing ─────────────────────────────────────────
  bg_donut_wallpaper: require("../../assets/cosmetics/backgrounds/Donut_Wallpaper.jpg"),
  bg_galaxy: require("../../assets/themes/backgrounds/galaxy_bg.jpg"),
  bg_lofi_alleyway: require("../../assets/cosmetics/backgrounds/Lofi_Alleyway.png"),
  bg_magical_forest: require("../../assets/cosmetics/backgrounds/Magical_Forest.jpg"),
  bg_pixel_cafe: require("../../assets/cosmetics/backgrounds/Pixel_Cafe.png"),
  bg_pixel_neo_tokyo: require("../../assets/cosmetics/backgrounds/Pixel_Neo_Tokyo.png"),
  bg_scary_forest: require("../../assets/cosmetics/backgrounds/Scary_forest.png"),
  bg_sketched_alleyway: require("../../assets/cosmetics/backgrounds/Sketched_Alleyway.jpg"),
  bg_steampunk_city: require("../../assets/cosmetics/backgrounds/Steampunk_City.png"),
  // ── New (Phase 3) ────────────────────────────────────
  bg_arcane_circles: require("../../assets/cosmetics/backgrounds/Arcane_Circles.png"),
  bg_aurora_borealis: require("../../assets/cosmetics/backgrounds/Aurora_Borealis.png"),
  bg_circling_waves: require("../../assets/cosmetics/backgrounds/Circling_Waves.jpg"),
  bg_cyber_aesthetic: require("../../assets/cosmetics/backgrounds/Cyber_Aesthetic.png"),
  bg_cyber_screens: require("../../assets/cosmetics/backgrounds/Cyber_Screens.jpg"),
  bg_glitched_tokyo: require("../../assets/cosmetics/backgrounds/Glitched_Tokyo.png"),
  bg_rune_circles: require("../../assets/cosmetics/backgrounds/Rune_Circles.png"),
  bg_sketched_lofi_alleyway: require("../../assets/cosmetics/backgrounds/Sketched_Lofi_Alleyway.png"),
  bg_synthwave: require("../../assets/cosmetics/backgrounds/Synthwave.png"),
  bg_synthwave_videogame: require("../../assets/cosmetics/backgrounds/Synthwave_Videogame.png"),
} as const;

// =============================================================================
// Decoration Assets
// =============================================================================

export const decorationAssets: Record<string, CosmeticImageSource> = {
  // ── Basic ────────────────────────────────────────────
  basic_circle_gold: require("../../assets/cosmetics/decorations/basic/circle_gold.png"),
  // ── Achievement ──────────────────────────────────────
  achievement_streak_7: require("../../assets/cosmetics/decorations/achievement/streak_7.png"),
  // ── Premium (PFP Decorations) ────────────────────────
  premium_chess: require("../../assets/cosmetics/decorations/premium/Chess.png"),
  premium_chicago: require("../../assets/cosmetics/decorations/premium/Chicago.png"),
  premium_chicken_sketch: require("../../assets/cosmetics/decorations/premium/chicken_sketch.png"),
  premium_cozy_cat: require("../../assets/cosmetics/decorations/premium/Cozy_Cat.png"),
  premium_donut: require("../../assets/cosmetics/decorations/premium/Donut.png"),
  premium_fox_ears: require("../../assets/cosmetics/decorations/premium/Fox_Ears.png"),
  premium_kindergarten_scribble: require("../../assets/cosmetics/decorations/premium/Kindergarten_Scribble.png"),
  premium_lofi_city: require("../../assets/cosmetics/decorations/premium/Lofi_City.png"),
  premium_mini_golf: require("../../assets/cosmetics/decorations/premium/mini-golf.png"),
  premium_retro_arcade: require("../../assets/cosmetics/decorations/premium/Retro_arcade.png"),
} as const;

// =============================================================================
// Theme Preview Assets (placeholder — add preview images as they become available)
// =============================================================================

export const themePreviewAssets: Record<string, CosmeticImageSource> = {
  // theme_default: require("../../assets/cosmetics/themes/default_preview.png"),
  // Add theme preview images here as they become available
} as const;

// =============================================================================
// Unified Lookup
// =============================================================================

// =============================================================================
// Animal Theme Assets (images only — sounds handled by animalAssets.ts)
// =============================================================================

export const animalThemeAssets: Record<string, CosmeticImageSource> = {
  animal_duck: require("../../assets/animals/duck.jpeg"),
  animal_bear: require("../../assets/animals/bear.png"),
  animal_wolf: require("../../assets/animals/wolf.png"),
  animal_turtle: require("../../assets/animals/turtle.png"),
} as const;

const REGISTRIES: Partial<
  Record<CosmeticType, Record<string, CosmeticImageSource>>
> = {
  badge: badgeAssets,
  background: backgroundAssets,
  decoration: decorationAssets,
  theme: themePreviewAssets,
  chat_animal_theme: animalThemeAssets,
};

/**
 * Check whether an asset is available for a given cosmetic.
 */
export function hasCosmeticAsset(type: CosmeticType, id: string): boolean {
  return REGISTRIES[type]?.[id] != null;
}

/**
 * Get the image source for a cosmetic. Returns null when no asset is mapped.
 */
export function getCosmeticAsset(
  type: CosmeticType,
  id: string,
): CosmeticImageSource | null {
  return REGISTRIES[type]?.[id] ?? null;
}

/**
 * List all loaded IDs for a given cosmetic type.
 */
export function getLoadedIds(type: CosmeticType): string[] {
  return Object.keys(REGISTRIES[type] ?? {});
}

/**
 * List all loaded IDs across all types.
 */
export function getAllLoadedIds(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const type of Object.keys(REGISTRIES)) {
    result[type] = getLoadedIds(type as CosmeticType);
  }
  return result;
}
