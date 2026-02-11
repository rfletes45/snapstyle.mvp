/**
 * Profile Data Caching Service
 *
 * Phase 7 of Profile Screen Overhaul
 *
 * Provides intelligent caching for profile-related data:
 * - In-memory cache with TTL
 * - AsyncStorage persistence for offline support
 * - Automatic cache invalidation
 * - Stale-while-revalidate pattern
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 7
 */

import type {
  Badge,
  LevelInfo,
  ProfileStats,
  UserBadge,
} from "@/types/profile";
import AsyncStorage from "@react-native-async-storage/async-storage";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/profileCache");
// =============================================================================
// Types
// =============================================================================

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache configuration
 */
interface CacheConfig {
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Whether to persist to AsyncStorage */
  persist: boolean;
  /** Stale time - return stale data while revalidating */
  staleTime?: number;
}

/**
 * Profile cache structure
 */
interface ProfileCacheData {
  profile: CacheEntry<any> | null;
  badges: CacheEntry<UserBadge[]> | null;
  stats: CacheEntry<ProfileStats> | null;
  level: CacheEntry<LevelInfo> | null;
  inventory: CacheEntry<Record<string, string[]>> | null;
  badgeDefinitions: CacheEntry<Badge[]> | null;
}

/**
 * Extract the data type from a ProfileCacheData entry
 */
type ProfileCacheValue<K extends keyof ProfileCacheData> =
  ProfileCacheData[K] extends CacheEntry<infer T> | null ? T | null : never;

/**
 * Cache invalidation events
 */
export type CacheInvalidationEvent =
  | "profile_updated"
  | "avatar_changed"
  | "achievement_earned"
  | "badge_earned"
  | "badge_featured"
  | "item_purchased"
  | "item_earned"
  | "game_played"
  | "friend_added"
  | "level_up"
  | "stats_updated";

// =============================================================================
// Constants
// =============================================================================

const CACHE_PREFIX = "@profile_cache:";
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const STALE_TIME = 30 * 1000; // 30 seconds
const BADGE_DEFINITIONS_TTL = 24 * 60 * 60 * 1000; // 24 hours (static data)

/**
 * Cache configuration per data type
 */
const CACHE_CONFIGS: Record<keyof ProfileCacheData, CacheConfig> = {
  profile: { ttl: DEFAULT_TTL, persist: true, staleTime: STALE_TIME },
  badges: { ttl: DEFAULT_TTL, persist: true, staleTime: STALE_TIME },
  stats: { ttl: 2 * 60 * 1000, persist: true, staleTime: STALE_TIME }, // 2 min for stats
  level: { ttl: DEFAULT_TTL, persist: true, staleTime: STALE_TIME },
  inventory: { ttl: DEFAULT_TTL, persist: true, staleTime: STALE_TIME },
  badgeDefinitions: { ttl: BADGE_DEFINITIONS_TTL, persist: true }, // Long TTL for static data
};

/**
 * Events that invalidate specific cache keys
 */
const INVALIDATION_MAP: Record<
  CacheInvalidationEvent,
  (keyof ProfileCacheData)[]
> = {
  profile_updated: ["profile"],
  avatar_changed: ["profile", "inventory"],
  achievement_earned: ["badges", "stats"],
  badge_earned: ["badges", "stats"],
  badge_featured: ["badges"],
  item_purchased: ["inventory", "stats"],
  item_earned: ["inventory", "stats"],
  game_played: ["stats"],
  friend_added: ["stats"],
  level_up: ["level", "stats"],
  stats_updated: ["stats"],
};

// =============================================================================
// In-Memory Cache
// =============================================================================

/** In-memory cache storage per user */
const memoryCache = new Map<string, ProfileCacheData>();

/** Subscribers for cache updates */
const cacheSubscribers = new Map<
  string,
  Set<(event: CacheInvalidationEvent) => void>
>();

/**
 * Get user's cache data
 */
function getUserCache(uid: string): ProfileCacheData {
  if (!memoryCache.has(uid)) {
    memoryCache.set(uid, {
      profile: null,
      badges: null,
      stats: null,
      level: null,
      inventory: null,
      badgeDefinitions: null,
    });
  }
  return memoryCache.get(uid)!;
}

// =============================================================================
// Cache Operations
// =============================================================================

/**
 * Get cached data
 * Returns null if not cached or expired
 */
export async function getCached<K extends keyof ProfileCacheData>(
  uid: string,
  key: K,
): Promise<
  ProfileCacheData[K] extends CacheEntry<infer T> | null ? T | null : never
> {
  const cache = getUserCache(uid);
  const config = CACHE_CONFIGS[key];
  const entry = cache[key];

  // Check memory cache first
  if (entry) {
    const now = Date.now();

    // Fresh data
    if (now < entry.expiresAt) {
      return entry.data as ProfileCacheValue<K>;
    }

    // Stale but within stale time - return stale data
    if (config.staleTime && now < entry.expiresAt + config.staleTime) {
      // Trigger background refresh (caller should handle)
      return entry.data as ProfileCacheValue<K>;
    }
  }

  // Try AsyncStorage if persistence enabled
  if (config.persist) {
    try {
      const storageKey = `${CACHE_PREFIX}${uid}:${key}`;
      const stored = await AsyncStorage.getItem(storageKey);

      if (stored) {
        const parsed: CacheEntry<any> = JSON.parse(stored);
        const now = Date.now();

        if (now < parsed.expiresAt) {
          // Restore to memory cache
          (cache[key] as CacheEntry<unknown> | null) = parsed;
          return parsed.data;
        }

        // Stale but usable
        if (config.staleTime && now < parsed.expiresAt + config.staleTime) {
          (cache[key] as CacheEntry<unknown> | null) = parsed;
          return parsed.data;
        }

        // Expired - clean up
        await AsyncStorage.removeItem(storageKey);
      }
    } catch (error) {
      logger.warn(`[profileCache] Failed to read ${key} from storage:`, error);
    }
  }

  return null as ProfileCacheValue<K>;
}

/**
 * Set cached data
 */
export async function setCached<K extends keyof ProfileCacheData>(
  uid: string,
  key: K,
  data: ProfileCacheData[K] extends CacheEntry<infer T> | null ? T : never,
): Promise<void> {
  const cache = getUserCache(uid);
  const config = CACHE_CONFIGS[key];
  const now = Date.now();

  const entry: CacheEntry<typeof data> = {
    data,
    timestamp: now,
    expiresAt: now + config.ttl,
  };

  // Update memory cache
  (cache[key] as CacheEntry<unknown> | null) = entry;

  // Persist if enabled
  if (config.persist) {
    try {
      const storageKey = `${CACHE_PREFIX}${uid}:${key}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(entry));
    } catch (error) {
      logger.warn(`[profileCache] Failed to persist ${key}:`, error);
    }
  }
}

/**
 * Check if cached data is stale (but still usable)
 */
export function isCacheStale<K extends keyof ProfileCacheData>(
  uid: string,
  key: K,
): boolean {
  const cache = getUserCache(uid);
  const entry = cache[key];

  if (!entry) return true;

  return Date.now() >= entry.expiresAt;
}

/**
 * Get cache timestamp
 */
export function getCacheTimestamp<K extends keyof ProfileCacheData>(
  uid: string,
  key: K,
): number | null {
  const cache = getUserCache(uid);
  const entry = cache[key];
  return entry?.timestamp ?? null;
}

// =============================================================================
// Cache Invalidation
// =============================================================================

/**
 * Invalidate cache for specific keys
 */
export async function invalidateCache(
  uid: string,
  keys: (keyof ProfileCacheData)[],
): Promise<void> {
  const cache = getUserCache(uid);

  for (const key of keys) {
    cache[key] = null;

    // Remove from AsyncStorage
    const config = CACHE_CONFIGS[key];
    if (config.persist) {
      try {
        const storageKey = `${CACHE_PREFIX}${uid}:${key}`;
        await AsyncStorage.removeItem(storageKey);
      } catch (error) {
        logger.warn(`[profileCache] Failed to remove ${key}:`, error);
      }
    }
  }
}

/**
 * Invalidate cache based on event
 */
export async function invalidateCacheForEvent(
  uid: string,
  event: CacheInvalidationEvent,
): Promise<void> {
  const keysToInvalidate = INVALIDATION_MAP[event];

  if (keysToInvalidate.length > 0) {
    await invalidateCache(uid, keysToInvalidate);

    // Notify subscribers
    const subscribers = cacheSubscribers.get(uid);
    if (subscribers) {
      subscribers.forEach((callback) => callback(event));
    }
  }
}

/**
 * Clear all cache for a user
 */
export async function clearUserCache(uid: string): Promise<void> {
  memoryCache.delete(uid);

  // Clear all persisted cache
  try {
    const keys = await AsyncStorage.getAllKeys();
    const userCacheKeys = keys.filter((k) =>
      k.startsWith(`${CACHE_PREFIX}${uid}:`),
    );
    if (userCacheKeys.length > 0) {
      await AsyncStorage.multiRemove(userCacheKeys);
    }
  } catch (error) {
    logger.warn("[profileCache] Failed to clear user cache:", error);
  }
}

/**
 * Clear all profile cache (all users)
 */
export async function clearAllCache(): Promise<void> {
  memoryCache.clear();

  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    logger.warn("[profileCache] Failed to clear all cache:", error);
  }
}

// =============================================================================
// Cache Subscriptions
// =============================================================================

/**
 * Subscribe to cache invalidation events
 * @returns Unsubscribe function
 */
export function subscribeToCacheInvalidation(
  uid: string,
  callback: (event: CacheInvalidationEvent) => void,
): () => void {
  if (!cacheSubscribers.has(uid)) {
    cacheSubscribers.set(uid, new Set());
  }

  const subscribers = cacheSubscribers.get(uid)!;
  subscribers.add(callback);

  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0) {
      cacheSubscribers.delete(uid);
    }
  };
}

// =============================================================================
// Preloading
// =============================================================================

/**
 * Preload common profile data into cache
 * Call on app start or user login
 */
export async function preloadProfileCache(uid: string): Promise<void> {
  // This function can be extended to prefetch data
  // For now, it just ensures the cache structure exists
  getUserCache(uid);

  logger.info("[profileCache] Cache initialized for user:", uid);
}

// =============================================================================
// Cache Stats (Development)
// =============================================================================

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(uid: string): {
  memoryCacheSize: number;
  cachedKeys: string[];
  staleCacheKeys: string[];
} {
  const cache = getUserCache(uid);
  const cachedKeys: string[] = [];
  const staleCacheKeys: string[] = [];

  for (const [key, entry] of Object.entries(cache)) {
    if (entry) {
      cachedKeys.push(key);
      if (Date.now() >= (entry as CacheEntry<any>).expiresAt) {
        staleCacheKeys.push(key);
      }
    }
  }

  return {
    memoryCacheSize: memoryCache.size,
    cachedKeys,
    staleCacheKeys,
  };
}
