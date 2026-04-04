/**
 * GIF Service Facade
 *
 * High-level service that wraps the GIF provider with caching,
 * request cancellation, and a stable API for the UI layer.
 *
 * @module services/gif/gifService
 */

import { createLogger } from "@/utils/log";
import { createKlipyProvider } from "./klipyProvider";
import type { GifCategory, GifPage, GifProvider, GifSuggestion } from "./types";

const log = createLogger("gif:service");

// =============================================================================
// Singleton Provider
// =============================================================================

let _provider: GifProvider | null = null;

function getProvider(): GifProvider {
  if (!_provider) {
    _provider = createKlipyProvider();
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
const trendingCache: { current: CacheEntry<GifPage> | null } = {
  current: null,
};
const categoriesCache: { current: CacheEntry<GifCategory[]> | null } = {
  current: null,
};

function isCacheValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() - entry.timestamp < CACHE_TTL_MS;
}

// =============================================================================
// Service API
// =============================================================================

/**
 * Fetch trending GIFs (cached for 5 minutes on first page).
 */
export async function fetchTrending(params?: {
  limit?: number;
  cursor?: string;
}): Promise<GifPage> {
  // Return cache for first page only
  if (!params?.cursor && isCacheValid(trendingCache.current)) {
    return trendingCache.current.data;
  }

  const result = await getProvider().trending(params ?? {});

  // Cache first page
  if (!params?.cursor) {
    trendingCache.current = { data: result, timestamp: Date.now() };
  }

  return result;
}

/**
 * Search for GIFs.
 */
export async function searchGifs(params: {
  query: string;
  limit?: number;
  cursor?: string;
}): Promise<GifPage> {
  return getProvider().search(params);
}

/**
 * Get search suggestions (related terms after a search query).
 */
export async function getSearchSuggestions(
  query: string,
): Promise<GifSuggestion[]> {
  return getProvider().suggestions(query);
}

/**
 * Get autocomplete results while user is typing.
 */
export async function getAutocomplete(query: string): Promise<GifSuggestion[]> {
  if (query.length < 2) return [];
  return getProvider().autocomplete(query);
}

/**
 * Get browseable GIF categories (cached for 5 minutes).
 */
export async function getCategories(): Promise<GifCategory[]> {
  if (isCacheValid(categoriesCache.current)) {
    return categoriesCache.current.data;
  }

  const result = await getProvider().categories();
  categoriesCache.current = { data: result, timestamp: Date.now() };
  return result;
}

/**
 * Register a share event with the provider (call after sending a GIF).
 * Best-effort — failures are silently logged.
 */
export async function registerGifShare(gifId: string): Promise<void> {
  return getProvider().registerShare(gifId);
}

/**
 * Invalidate all caches (call when switching accounts, etc.).
 */
export function clearGifCache(): void {
  trendingCache.current = null;
  categoriesCache.current = null;
  log.debug("GIF caches cleared");
}
