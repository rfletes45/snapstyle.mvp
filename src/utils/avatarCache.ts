/**
 * Avatar Cache Utilities
 *
 * Caching system for rendered avatars to improve performance
 * in lists and frequently-rendered contexts.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 7
 */

import type { DigitalAvatarConfig } from "@/types/avatar";
import { createHash } from "@/utils/hash";

// =============================================================================
// TYPES
// =============================================================================

interface CacheEntry {
  /** Cached image URI (base64 or file URI) */
  uri: string;
  /** Cache timestamp */
  cachedAt: number;
  /** Config hash for validation */
  configHash: string;
  /** Avatar size this was rendered at */
  size: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Maximum number of cached avatars */
const MAX_CACHE_SIZE = 100;

/** Cache TTL in milliseconds (30 minutes) */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Cache key prefix */
const CACHE_KEY_PREFIX = "avatar_cache_";

// =============================================================================
// CACHE IMPLEMENTATION
// =============================================================================

class AvatarCache {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = [];
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: MAX_CACHE_SIZE,
  };

  /**
   * Generate cache key from config and size
   */
  private generateKey(config: DigitalAvatarConfig, size: number): string {
    const configHash = this.hashConfig(config);
    return `${CACHE_KEY_PREFIX}${configHash}_${size}`;
  }

  /**
   * Hash avatar config for cache key
   */
  private hashConfig(config: DigitalAvatarConfig): string {
    // Create a stable string representation of relevant config values
    const relevantConfig = {
      body: config.body,
      face: config.face,
      eyes: {
        style: config.eyes.style,
        color: config.eyes.color,
        size: config.eyes.size,
        spacing: config.eyes.spacing,
        eyebrows: config.eyes.eyebrows,
      },
      nose: config.nose,
      mouth: config.mouth,
      ears: config.ears,
      hair: config.hair,
      clothing: config.clothing,
      accessories: config.accessories,
    };

    const jsonStr = JSON.stringify(relevantConfig);
    return createHash(jsonStr);
  }

  /**
   * Get cached avatar if available and not expired
   */
  get(config: DigitalAvatarConfig, size: number): string | null {
    const key = this.generateKey(config, size);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return null;
    }

    // Update access order (LRU)
    this.updateAccessOrder(key);
    this.stats.hits++;

    return entry.uri;
  }

  /**
   * Store avatar in cache
   */
  set(config: DigitalAvatarConfig, size: number, uri: string): void {
    const key = this.generateKey(config, size);
    const configHash = this.hashConfig(config);

    // Evict oldest entry if at capacity
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      uri,
      cachedAt: Date.now(),
      configHash,
      size,
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.stats.size = this.cache.size;
  }

  /**
   * Check if avatar is cached (without counting as hit/miss)
   */
  has(config: DigitalAvatarConfig, size: number): boolean {
    const key = this.generateKey(config, size);
    const entry = this.cache.get(key);

    if (!entry) return false;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return false;

    return true;
  }

  /**
   * Invalidate cache entry for a config
   */
  invalidate(config: DigitalAvatarConfig): void {
    const configHash = this.hashConfig(config);

    // Remove all entries with this config hash
    for (const [key, entry] of this.cache.entries()) {
      if (entry.configHash === configHash) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
      }
    }

    this.stats.size = this.cache.size;
  }

  /**
   * Invalidate all cache entries for a user
   */
  invalidateUser(userId: string): void {
    // In a more sophisticated implementation, we'd track user -> config mappings
    // For now, this is a no-op placeholder
    console.log(`[AvatarCache] Invalidate requested for user: ${userId}`);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get hit rate percentage
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return (this.stats.hits / total) * 100;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictOldest(): void {
    if (this.accessOrder.length === 0) return;

    const oldestKey = this.accessOrder.shift();
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

const avatarCache = new AvatarCache();

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get cached avatar image URI
 * @returns URI string or null if not cached
 */
export function getCachedAvatar(
  config: DigitalAvatarConfig,
  size: number,
): string | null {
  return avatarCache.get(config, size);
}

/**
 * Store avatar image in cache
 */
export function cacheAvatar(
  config: DigitalAvatarConfig,
  size: number,
  uri: string,
): void {
  avatarCache.set(config, size, uri);
}

/**
 * Check if avatar is cached
 */
export function isAvatarCached(
  config: DigitalAvatarConfig,
  size: number,
): boolean {
  return avatarCache.has(config, size);
}

/**
 * Invalidate cached avatar for a config
 */
export function invalidateAvatarCache(config: DigitalAvatarConfig): void {
  avatarCache.invalidate(config);
}

/**
 * Clear all cached avatars
 */
export function clearAvatarCache(): void {
  avatarCache.clear();
}

/**
 * Get cache statistics
 */
export function getAvatarCacheStats(): CacheStats {
  return avatarCache.getStats();
}

/**
 * Get cache hit rate
 */
export function getAvatarCacheHitRate(): number {
  return avatarCache.getHitRate();
}

// =============================================================================
// REACT HOOK FOR CACHED AVATAR
// =============================================================================

import { useCallback, useEffect, useState } from "react";

/**
 * Hook for using cached avatar with automatic cache management
 */
export function useCachedAvatar(
  config: DigitalAvatarConfig | null,
  size: number,
): {
  cachedUri: string | null;
  isCached: boolean;
  cacheImage: (uri: string) => void;
} {
  const [cachedUri, setCachedUri] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    if (!config) {
      setCachedUri(null);
      setIsCached(false);
      return;
    }

    const cached = avatarCache.get(config, size);
    if (cached) {
      setCachedUri(cached);
      setIsCached(true);
    } else {
      setCachedUri(null);
      setIsCached(false);
    }
  }, [config, size]);

  const cacheImage = useCallback(
    (uri: string) => {
      if (config) {
        avatarCache.set(config, size, uri);
        setCachedUri(uri);
        setIsCached(true);
      }
    },
    [config, size],
  );

  return { cachedUri, isCached, cacheImage };
}

// =============================================================================
// DEBUG UTILITIES (development only)
// =============================================================================

if (__DEV__) {
  // @ts-ignore - Global debug utilities
  global.__avatarCacheDebug = {
    getStats: () => avatarCache.getStats(),
    getHitRate: () => avatarCache.getHitRate(),
    clear: () => avatarCache.clear(),
    getCacheSize: () => avatarCache.getStats().size,
  };
}
