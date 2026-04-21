/**
 * Sticker Service Facade
 *
 * High-level service that wraps the sticker provider with caching,
 * and a stable API for the UI layer.
 *
 * Modeled after gifService.ts but uses page-based pagination.
 *
 * @module services/sticker/stickerService
 */

import { createLogger } from "@/utils/log";
import { createKlipyStickerProvider } from "./klipyStickerProvider";
import type { StickerCategory, StickerPage, StickerProvider } from "./types";

const log = createLogger("sticker:service");

// =============================================================================
// Singleton Provider
// =============================================================================

let _provider: StickerProvider | null = null;

function getProvider(): StickerProvider {
  if (!_provider) {
    _provider = createKlipyStickerProvider();
  }
  return _provider;
}

// =============================================================================
// In-Memory Cache
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const trendingCache: { current: CacheEntry<StickerPage> | null } = {
  current: null,
};
const categoriesCache: { current: CacheEntry<StickerCategory[]> | null } = {
  current: null,
};
let trendingFirstPagePromise: Promise<StickerPage> | null = null;
let categoriesPromise: Promise<StickerCategory[]> | null = null;

function isCacheValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() - entry.timestamp < CACHE_TTL_MS;
}

// =============================================================================
// Service API
// =============================================================================

/**
 * Fetch trending stickers (cached for 5 minutes on first page).
 */
export async function fetchTrendingStickers(params?: {
  limit?: number;
  page?: number;
}): Promise<StickerPage> {
  const isFirstPage = !params?.page || params.page === 1;

  // Return cache for first page only
  if (isFirstPage && isCacheValid(trendingCache.current)) {
    return trendingCache.current.data;
  }

  if (isFirstPage) {
    if (trendingFirstPagePromise) {
      return trendingFirstPagePromise;
    }

    trendingFirstPagePromise = getProvider()
      .trending(params ?? {})
      .then((result) => {
        trendingCache.current = { data: result, timestamp: Date.now() };
        return result;
      })
      .finally(() => {
        trendingFirstPagePromise = null;
      });

    return trendingFirstPagePromise;
  }

  const result = await getProvider().trending(params ?? {});
  return result;
}

/**
 * Search for stickers.
 */
export async function searchStickers(params: {
  query: string;
  limit?: number;
  page?: number;
}): Promise<StickerPage> {
  return getProvider().search(params);
}

/**
 * Get browseable sticker categories (cached for 5 minutes).
 */
export async function getStickerCategories(): Promise<StickerCategory[]> {
  if (isCacheValid(categoriesCache.current)) {
    return categoriesCache.current.data;
  }

  if (categoriesPromise) {
    return categoriesPromise;
  }

  categoriesPromise = getProvider()
    .categories()
    .then((result) => {
      categoriesCache.current = { data: result, timestamp: Date.now() };
      return result;
    })
    .finally(() => {
      categoriesPromise = null;
    });

  return categoriesPromise;
}

/**
 * Return the cached first trending sticker page if it is still fresh.
 */
export function peekTrendingStickerPage(): StickerPage | null {
  return isCacheValid(trendingCache.current)
    ? trendingCache.current.data
    : null;
}

/**
 * Return cached sticker categories if they are still fresh.
 */
export function peekStickerCategories(): StickerCategory[] | null {
  return isCacheValid(categoriesCache.current)
    ? categoriesCache.current.data
    : null;
}

/**
 * Register a share event with the provider (call after sending a sticker).
 * Best-effort — failures are silently logged.
 */
export async function registerStickerShare(
  slug: string,
  query?: string,
): Promise<void> {
  return getProvider().registerShare(slug, query);
}

/**
 * Invalidate all caches (call when switching accounts, etc.).
 */
export function clearStickerCache(): void {
  trendingCache.current = null;
  categoriesCache.current = null;
  log.debug("Sticker caches cleared");
}
