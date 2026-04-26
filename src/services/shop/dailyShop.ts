/**
 * Daily Shop helpers
 *
 * Pure, deterministic helpers for the unified Daily Shop:
 *   - reset-time computation (next local midnight)
 *   - countdown formatting
 *   - daily seed (YYYY-MM-DD in local time)
 *   - category grouping for shop items
 *   - deterministic per-day item selection
 *
 * No I/O, no React, no Firebase — kept pure for easy unit testing and
 * memoization at the screen layer.
 *
 * @module services/shop/dailyShop
 */

import type { CosmeticDefinition, CosmeticType } from "@/cosmetics/types";

// =============================================================================
// Categories
// =============================================================================

export type DailyShopCategoryId =
  | "decoration"
  | "background"
  | "badge"
  | "theme"
  | "chat";

export interface DailyShopCategoryDef {
  id: DailyShopCategoryId;
  label: string;
  /** Item types that belong in this category. */
  types: ReadonlyArray<CosmeticType>;
}

export const DAILY_SHOP_CATEGORIES: ReadonlyArray<DailyShopCategoryDef> = [
  { id: "decoration", label: "Frames", types: ["decoration"] },
  { id: "background", label: "Backgrounds", types: ["background"] },
  { id: "badge", label: "Badges", types: ["badge"] },
  { id: "theme", label: "Themes", types: ["theme"] },
  {
    id: "chat",
    label: "Chat",
    types: ["chat_bubble_color", "chat_animal_theme"],
  },
];

/** How many items to display per category in the Daily Shop. */
export const DAILY_SHOP_ITEMS_PER_CATEGORY = 2;

// =============================================================================
// Reset time / countdown
// =============================================================================

/**
 * Returns the next reset epoch-ms. Reset is the next local-midnight boundary
 * relative to the supplied "now". This is local-time based for the MVP — when
 * a server-driven reset schedule is added later, swap this implementation
 * (callers do not need to change).
 */
export function getDailyShopResetTime(now: Date = new Date()): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0); // jumps to next local midnight
  return d.getTime();
}

/** Stable per-day seed. YYYY-MM-DD in local time. */
export function getDailyShopSeed(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Formats a countdown given remaining milliseconds.
 * - >= 1 hour:  "12h 34m"
 * - <  1 hour:  "42m 15s"
 * - <= 0:        "0m 0s"
 */
export function formatDailyShopCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0m 0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

// =============================================================================
// Selection
// =============================================================================

/**
 * Eligibility filter applied before a daily category roll.
 * Mirrors getShopCosmetics() guarantees but defends against partial data.
 */
export function isEligibleForDailyShop(item: CosmeticDefinition): boolean {
  if (!item || typeof item !== "object") return false;
  if (!item.id || !item.type || !item.name) return false;
  if (typeof item.priceTokens !== "number" || item.priceTokens <= 0) {
    return false;
  }
  if (item.metadata?.comingSoon) return false;
  return true;
}

/**
 * Group shop items into Daily Shop categories. Items not matching any
 * category are dropped. Each item appears in at most one category (the
 * first matching definition wins).
 */
export function groupShopItemsByDecorationCategory(
  items: ReadonlyArray<CosmeticDefinition>,
): Record<DailyShopCategoryId, CosmeticDefinition[]> {
  const out: Record<DailyShopCategoryId, CosmeticDefinition[]> = {
    decoration: [],
    background: [],
    badge: [],
    theme: [],
    chat: [],
  };
  for (const item of items) {
    if (!isEligibleForDailyShop(item)) continue;
    for (const cat of DAILY_SHOP_CATEGORIES) {
      if (cat.types.includes(item.type)) {
        out[cat.id].push(item);
        break;
      }
    }
  }
  return out;
}

/**
 * Tiny FNV-1a 32-bit string hash. Stable, fast, no deps. Used to derive
 * a deterministic ordering per (seed, category, itemId).
 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit FNV prime mul via shifts (keeps result an int)
    h =
      (h +
        ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>>
      0;
  }
  return h >>> 0;
}

/**
 * Pick `count` items deterministically for a given (seed, categoryId).
 * - Same inputs always return the same output (in the same order).
 * - Different days (different seeds) reshuffle.
 * - Output preserves a stable order based on the hashed score.
 *
 * Items are pre-filtered through isEligibleForDailyShop().
 */
export function selectDailyItemsForCategory(
  items: ReadonlyArray<CosmeticDefinition>,
  categoryId: DailyShopCategoryId,
  seed: string,
  count: number = DAILY_SHOP_ITEMS_PER_CATEGORY,
): CosmeticDefinition[] {
  const eligible = items.filter(isEligibleForDailyShop);
  if (eligible.length === 0 || count <= 0) return [];

  // Deduplicate by id (defensive — catalog should already be unique)
  const byId = new Map<string, CosmeticDefinition>();
  for (const it of eligible) {
    if (!byId.has(it.id)) byId.set(it.id, it);
  }
  const unique = Array.from(byId.values());

  // Score each item, sort ascending, take first `count`.
  const scored = unique.map((item) => ({
    item,
    score: fnv1a(`${seed}|${categoryId}|${item.id}`),
  }));
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.item.id.localeCompare(b.item.id);
  });
  return scored.slice(0, count).map((s) => s.item);
}
