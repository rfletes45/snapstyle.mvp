/**
 * CosmeticsAssetCache — Pre-warm and manage cosmetic image cache.
 *
 * Since all cosmetic images are local `require()` assets, this module
 * uses Expo Asset to pre-download and cache them at app startup or
 * screen focus so expo-image can render them instantly from the native
 * cache without JS-thread decoding overhead.
 *
 * Provides:
 *  - prefetchOwnedCosmetics()      — warm cache for equipped items
 *  - prefetchShopCategory()        — warm cache for shop grids
 *  - prefetchCustomizationCategory() — warm cache for customization grids
 *  - prefetchCriticalProfileAssets() — warm cache for profile bg + decoration
 *  - getStats()                      — dev metrics
 *
 * @module services/cosmeticsAssetCache
 */

import {
  animalThemeAssets,
  backgroundAssets,
  badgeAssets,
  decorationAssets,
  getCosmeticAsset,
} from "@/cosmetics/assetRegistry";
import type { CosmeticType } from "@/cosmetics/types";
import { Asset } from "expo-asset";

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

let _prefetchedCount = 0;
let _prefetchErrors = 0;
let _prefetchTimeMs = 0;
const _prefetchedKeys = new Set<string>();

export interface CacheStats {
  prefetchedCount: number;
  prefetchErrors: number;
  totalTimeMs: number;
  prefetchedKeys: number;
}

export function getCacheStats(): CacheStats {
  return {
    prefetchedCount: _prefetchedCount,
    prefetchErrors: _prefetchErrors,
    totalTimeMs: Math.round(_prefetchTimeMs),
    prefetchedKeys: _prefetchedKeys.size,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Max parallel downloads to avoid overloading native thread. */
const MAX_CONCURRENCY = 6;

/**
 * Prefetch a batch of require() modules via expo-asset.
 * Throttled to MAX_CONCURRENCY simultaneous operations.
 */
async function prefetchModules(
  modules: { key: string; module: number }[],
): Promise<number> {
  const toLoad = modules.filter((m) => !_prefetchedKeys.has(m.key));
  if (toLoad.length === 0) return 0;

  let loaded = 0;
  const start = performance.now();

  // Process in batches
  for (let i = 0; i < toLoad.length; i += MAX_CONCURRENCY) {
    const batch = toLoad.slice(i, i + MAX_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async ({ key, module: mod }) => {
        try {
          const asset = Asset.fromModule(mod);
          await asset.downloadAsync();
          _prefetchedKeys.add(key);
          loaded++;
        } catch {
          _prefetchErrors++;
        }
      }),
    );
    // Count settled
    results.forEach((r) => {
      if (r.status === "rejected") _prefetchErrors++;
    });
  }

  _prefetchedCount += loaded;
  _prefetchTimeMs += performance.now() - start;

  return loaded;
}

function registryToModules(
  registry: Record<string, unknown>,
): { key: string; module: number }[] {
  return Object.entries(registry)
    .filter(([, v]) => typeof v === "number")
    .map(([key, mod]) => ({ key, module: mod as number }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Prefetch assets for the user's equipped cosmetics so the profile
 * renders instantly.
 */
export async function prefetchCriticalProfileAssets(equipped: {
  backgroundId?: string | null;
  decorationId?: string | null;
  badgeIds?: string[];
}): Promise<number> {
  const modules: { key: string; module: number }[] = [];

  if (equipped.backgroundId) {
    const src = getCosmeticAsset("background", equipped.backgroundId);
    if (src && typeof src === "number") {
      modules.push({ key: `bg:${equipped.backgroundId}`, module: src });
    }
  }

  if (equipped.decorationId) {
    const src = getCosmeticAsset("decoration", equipped.decorationId);
    if (src && typeof src === "number") {
      modules.push({ key: `dec:${equipped.decorationId}`, module: src });
    }
  }

  for (const bid of equipped.badgeIds ?? []) {
    const src = getCosmeticAsset("badge", bid);
    if (src && typeof src === "number") {
      modules.push({ key: `badge:${bid}`, module: src });
    }
  }

  return prefetchModules(modules);
}

/**
 * Prefetch all assets for a specific cosmetic type (e.g., for Shop
 * or Customization category tabs).
 */
export async function prefetchCategory(type: CosmeticType): Promise<number> {
  const registryMap: Record<string, Record<string, unknown>> = {
    badge: badgeAssets,
    background: backgroundAssets,
    decoration: decorationAssets,
    chat_animal_theme: animalThemeAssets,
  };
  const reg = registryMap[type];
  if (!reg) return 0;

  return prefetchModules(
    registryToModules(reg).map((m) => ({
      ...m,
      key: `${type}:${m.key}`,
    })),
  );
}

/**
 * Alias for Shop grids — prefetches the given category.
 */
export const prefetchShopCategory = prefetchCategory;

/**
 * Alias for Customization grids — prefetches the given category.
 */
export const prefetchCustomizationCategory = prefetchCategory;

/**
 * Prefetch ALL cosmetic assets (backgrounds, badges, decorations, animals).
 * Useful for dev or "download all" feature.
 */
export async function prefetchAllCosmetics(): Promise<number> {
  const allModules: { key: string; module: number }[] = [];

  const registries: Record<string, Record<string, unknown>> = {
    badge: badgeAssets,
    background: backgroundAssets,
    decoration: decorationAssets,
    chat_animal_theme: animalThemeAssets,
  };

  for (const [type, reg] of Object.entries(registries)) {
    for (const m of registryToModules(reg)) {
      allModules.push({ key: `${type}:${m.key}`, module: m.module });
    }
  }

  return prefetchModules(allModules);
}
