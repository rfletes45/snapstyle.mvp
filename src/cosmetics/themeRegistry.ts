/**
 * Theme Registry — Single Source of Truth Bridge
 *
 * Bridges the canonical app-wide theme definitions from `constants/theme.ts`
 * into `CosmeticDefinition[]` entries for the Customization Hub and Shop.
 *
 * This ensures the Customization Hub themes tab shows free themes and the
 * Shop shows premium themes for purchase — all from ONE canonical list.
 *
 * DO NOT define theme lists anywhere else.  Both Settings' Appearance toggles
 * and the Customization Hub must derive their theme data from `constants/theme.ts`
 * via this module.
 *
 * @module cosmetics/themeRegistry
 */

import {
  getAllThemes,
  type ThemeId,
  type ThemeMeta,
} from "../../constants/theme";
import type { CosmeticDefinition } from "./types";

// =============================================================================
// Free vs Premium classification
// =============================================================================

/**
 * Core free themes — always available in Customization without purchase.
 * These are the "starter" themes every user gets.
 */
export const FREE_DEFAULT_THEME_IDS: ReadonlySet<ThemeId> = new Set<ThemeId>([
  "catppuccin-latte", // Base light
  "catppuccin-mocha", // Base dark
  "solarized-light", // Alternative light
  "dracula", // Popular dark
  "nord", // Popular dark
  "rose-garden", // Free pastel
  "ocean-breeze", // Free pastel
]);

/**
 * Returns true if the theme is a free default (available without purchase).
 */
export function isFreeDefaultTheme(themeId: string): boolean {
  return FREE_DEFAULT_THEME_IDS.has(themeId as ThemeId);
}

// =============================================================================
// Category → Rarity mapping
// =============================================================================

const CATEGORY_RARITY: Record<
  ThemeMeta["category"],
  CosmeticDefinition["rarity"]
> = {
  light: "common",
  dark: "common",
  amoled: "rare",
  pastel: "uncommon",
  vibrant: "rare",
};

// =============================================================================
// Price tiers for premium themes (by rarity)
// =============================================================================

const PREMIUM_PRICE: Record<CosmeticDefinition["rarity"], number> = {
  common: 200,
  uncommon: 350,
  rare: 500,
  epic: 750,
  legendary: 1200,
  mythic: 2000,
};

// =============================================================================
// Generate CosmeticDefinition entries from app-wide theme metadata
// =============================================================================

/**
 * Convert all app-wide themes into CosmeticDefinition entries.
 * Free-default themes get `source: "free"`.
 * Premium themes get `source: "shop"` and a price based on rarity.
 *
 * Cached on first call.
 */
let _cachedThemeDefs: CosmeticDefinition[] | null = null;

export function getThemeCosmeticDefinitions(): CosmeticDefinition[] {
  if (_cachedThemeDefs) return _cachedThemeDefs;

  const allMeta = getAllThemes();
  _cachedThemeDefs = allMeta.map((meta, index) =>
    themeMetaToCosmeticDef(meta, index),
  );
  return _cachedThemeDefs;
}

function themeMetaToCosmeticDef(
  meta: ThemeMeta,
  sortIndex: number,
): CosmeticDefinition {
  const rarity = CATEGORY_RARITY[meta.category] ?? "common";
  const isFree = FREE_DEFAULT_THEME_IDS.has(meta.id);

  return {
    id: meta.id,
    type: "theme",
    name: meta.name,
    description: meta.description,
    rarity,
    source: isFree ? "free" : "shop",
    ...(isFree ? {} : { priceTokens: PREMIUM_PRICE[rarity] }),
    tags: [meta.category, meta.isDark ? "dark" : "light"],
    sortOrder: sortIndex,
  };
}

/**
 * Validate that a theme ID is a valid app-wide theme.
 * Use this for dev-time guardrails.
 */
export function isValidThemeId(id: string): id is ThemeId {
  try {
    return getAllThemes().some((t) => t.id === id);
  } catch {
    return false;
  }
}
