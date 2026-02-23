/**
 * Store Curations — Featured Items & Bundles
 *
 * Curated store content: featured highlights, promotional bundles, and
 * helpers for the store UI.  All IDs reference entries in the canonical
 * COSMETICS_CATALOG.  Add / rotate items here to update what the store
 * showcases — no code changes elsewhere required.
 *
 * @module cosmetics/storeCurations
 */

import type { CosmeticBundle, FeaturedItem } from "./types";

// =============================================================================
// Featured Items — shown in the horizontal carousel at the top of the Shop
// =============================================================================

export const FEATURED_ITEMS: FeaturedItem[] = [
  {
    cosmeticId: "bg_galaxy",
    headline: "New Arrival",
    subtitle: "A swirling cosmic galaxy for your profile",
    badge: "NEW",
  },
  {
    cosmeticId: "bg_magical_forest",
    headline: "Staff Pick",
    subtitle: "Enchanted woodland vibes",
    badge: "HOT",
  },
  {
    cosmeticId: "premium_fox_ears",
    headline: "Fan Favorite",
    subtitle: "The most popular PFP decoration",
    badge: "HOT",
  },
  {
    cosmeticId: "bg_pixel_neo_tokyo",
    headline: "Pixel Perfect",
    subtitle: "Neon-soaked cyberpunk city",
  },
  {
    cosmeticId: "premium_lofi_city",
    headline: "Chill Vibes",
    subtitle: "Lofi-inspired PFP frame",
  },
  {
    cosmeticId: "bg_steampunk_city",
    headline: "Epic Pick",
    subtitle: "Steam-powered cityscape backdrop",
  },
  {
    cosmeticId: "premium_retro_arcade",
    headline: "Gamer Essential",
    subtitle: "Retro arcade-themed frame",
  },
  {
    cosmeticId: "premium_cozy_cat",
    headline: "Cozy Collection",
    subtitle: "Warm and fuzzy cat frame",
  },
  {
    cosmeticId: "bg_glitched_tokyo",
    headline: "Glitch City",
    subtitle: "Tokyo through a digital lens",
    badge: "NEW",
  },
  {
    cosmeticId: "bg_cyber_aesthetic",
    headline: "Cyber Vibes",
    subtitle: "Neon-drenched cyberpunk aesthetic",
    badge: "NEW",
  },
  {
    cosmeticId: "bg_arcane_circles",
    headline: "Mystical",
    subtitle: "Glowing arcane sigils for the magic-minded",
    badge: "NEW",
  },
];

// =============================================================================
// Bundles — grouped items at a discounted price
// =============================================================================

export const STORE_BUNDLES: CosmeticBundle[] = [
  {
    id: "bundle_pixel_pack",
    name: "Pixel Pack",
    description:
      "Pixel Café background + Retro Arcade frame — the ultimate retro combo",
    cosmeticIds: ["bg_pixel_cafe", "premium_retro_arcade"],
    priceTokens: 850,
    originalPriceTokens: 1100, // 500 + 600
    rarity: "rare",
    badge: "BEST VALUE",
    sortOrder: 1,
  },
  {
    id: "bundle_urban_explorer",
    name: "Urban Explorer",
    description:
      "Lofi Alleyway + Sketched Alleyway backgrounds with a Chicago Skyline frame",
    cosmeticIds: [
      "bg_lofi_alleyway",
      "bg_sketched_alleyway",
      "premium_chicago",
    ],
    priceTokens: 1200,
    originalPriceTokens: 1700, // 600 + 500 + 600
    rarity: "epic",
    badge: "POPULAR",
    sortOrder: 2,
  },
  {
    id: "bundle_cozy_vibes",
    name: "Cozy Vibes",
    description:
      "Donut Wallpaper background + Cozy Cat frame + Donut frame — warm and wholesome",
    cosmeticIds: ["bg_donut_wallpaper", "premium_cozy_cat", "premium_donut"],
    priceTokens: 1000,
    originalPriceTokens: 1400, // 500 + 500 + 400
    rarity: "rare",
    sortOrder: 3,
  },
  {
    id: "bundle_cosmic_deluxe",
    name: "Cosmic Deluxe",
    description:
      "Galaxy background + Magical Forest — two legendary-tier environments",
    cosmeticIds: ["bg_galaxy", "bg_magical_forest"],
    priceTokens: 1500,
    originalPriceTokens: 2000, // 1200 + 800
    rarity: "legendary",
    badge: "BEST VALUE",
    sortOrder: 4,
  },
  {
    id: "bundle_sketch_starter",
    name: "Sketch Starter",
    description:
      "Chicken Sketch + Kindergarten Scribble — cute hand-drawn frames",
    cosmeticIds: ["premium_chicken_sketch", "premium_kindergarten_scribble"],
    priceTokens: 450,
    originalPriceTokens: 600, // 300 + 300
    rarity: "uncommon",
    badge: "POPULAR",
    sortOrder: 5,
  },
  {
    id: "bundle_cyber_night",
    name: "Cyber Night",
    description:
      "Glitched Tokyo + Cyber Aesthetic + Cyber Screens — full cyberpunk immersion",
    cosmeticIds: [
      "bg_glitched_tokyo",
      "bg_cyber_aesthetic",
      "bg_cyber_screens",
    ],
    priceTokens: 1700,
    originalPriceTokens: 2400, // 900 + 900 + 600
    rarity: "epic",
    badge: "NEW",
    sortOrder: 6,
  },
  {
    id: "bundle_mystic_arts",
    name: "Mystic Arts",
    description: "Arcane Circles + Scary Forest — dark and magical atmosphere",
    cosmeticIds: ["bg_arcane_circles", "bg_scary_forest"],
    priceTokens: 900,
    originalPriceTokens: 1300, // 800 + 500
    rarity: "epic",
    badge: "NEW",
    sortOrder: 7,
  },
  {
    id: "bundle_lofi_collection",
    name: "Lofi Collection",
    description:
      "Lofi Alleyway + Sketched Lofi Alleyway + Circling Waves — chill-zone starter kit",
    cosmeticIds: [
      "bg_lofi_alleyway",
      "bg_sketched_lofi_alleyway",
      "bg_circling_waves",
    ],
    priceTokens: 1200,
    originalPriceTokens: 1750, // 600 + 550 + 600 (500 for waves, rounding)
    rarity: "rare",
    sortOrder: 8,
  },
];

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the discount percentage for a bundle.
 */
export function getBundleDiscount(bundle: CosmeticBundle): number {
  if (bundle.originalPriceTokens <= 0) return 0;
  return Math.round(
    ((bundle.originalPriceTokens - bundle.priceTokens) /
      bundle.originalPriceTokens) *
      100,
  );
}

/**
 * Check if all items in a bundle are already owned.
 */
export function isBundleFullyOwned(
  bundle: CosmeticBundle,
  ownedIds: ReadonlySet<string>,
): boolean {
  return bundle.cosmeticIds.every((id) => ownedIds.has(id));
}

/**
 * Get the IDs of items in a bundle that the user doesn't yet own.
 */
export function getBundleUnownedIds(
  bundle: CosmeticBundle,
  ownedIds: ReadonlySet<string>,
): string[] {
  return bundle.cosmeticIds.filter((id) => !ownedIds.has(id));
}

/**
 * Featured item IDs as a Set for fast "is featured" checks.
 */
const _featuredIdSet = new Set(FEATURED_ITEMS.map((f) => f.cosmeticId));
export function isFeaturedItem(cosmeticId: string): boolean {
  return _featuredIdSet.has(cosmeticId);
}
