/**
 * Profile Cache Service
 *
 * In-memory cache for user profiles to avoid repeated Firestore fetches.
 * Used across chat screens for instant profile display.
 *
 * @file src/services/cache/profileCache.ts
 */

import { getUserProfileByUid } from "@/services/friends";

// =============================================================================
// Types
// =============================================================================

export interface CachedProfile {
  uid: string;
  username: string;
  displayName?: string;
  avatar?: string | null;
  avatarConfig?: any;
  bio?: string;
  isOnline?: boolean;
  lastSeen?: Date | null;
}

interface CacheEntry {
  data: CachedProfile;
  fetchedAt: number;
}

// =============================================================================
// Cache Configuration
// =============================================================================

/** Cache time-to-live in milliseconds (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000;

/** Maximum number of profiles to cache */
const MAX_CACHE_SIZE = 100;

// =============================================================================
// Cache Store
// =============================================================================

const profileCache = new Map<string, CacheEntry>();

// =============================================================================
// Cache Functions
// =============================================================================

/**
 * Get a profile from cache without fetching
 * Returns null if not cached or expired
 */
export function getCachedProfileSync(userId: string): CachedProfile | null {
  const cached = profileCache.get(userId);
  if (!cached) return null;

  // Check if expired
  if (Date.now() - cached.fetchedAt > CACHE_TTL) {
    profileCache.delete(userId);
    return null;
  }

  return cached.data;
}

/**
 * Get a profile, using cache if available and fresh
 * Falls back to Firestore fetch if not cached
 */
export async function getCachedProfile(userId: string): Promise<CachedProfile> {
  // Check cache first
  const cached = getCachedProfileSync(userId);
  if (cached) {
    return cached;
  }

  // Fetch from Firestore
  const profile = await getUserProfileByUid(userId);

  if (!profile) {
    // Return minimal profile if not found
    const fallback: CachedProfile = {
      uid: userId,
      username: "Unknown",
    };
    setCachedProfile(userId, fallback);
    return fallback;
  }

  // Cache the result
  const cachedProfile: CachedProfile = {
    uid: userId,
    username: profile.username,
    displayName: profile.displayName,
    avatarConfig: profile.avatarConfig,
  };

  setCachedProfile(userId, cachedProfile);
  return cachedProfile;
}

/**
 * Store a profile in cache
 */
export function setCachedProfile(userId: string, profile: CachedProfile): void {
  // Evict oldest entries if cache is full
  if (profileCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = profileCache.keys().next().value;
    if (oldestKey) {
      profileCache.delete(oldestKey);
    }
  }

  profileCache.set(userId, {
    data: profile,
    fetchedAt: Date.now(),
  });
}

/**
 * Prefetch multiple profiles into cache
 * Useful when loading inbox to prepare for chat entry
 */
export async function prefetchProfiles(userIds: string[]): Promise<void> {
  const uncached = userIds.filter((id) => !getCachedProfileSync(id));

  if (uncached.length === 0) return;

  // Fetch in parallel, but don't block on errors
  await Promise.allSettled(uncached.map((id) => getCachedProfile(id)));
}

/**
 * Clear a specific profile from cache
 * Use when profile data is known to be stale
 */
export function invalidateProfile(userId: string): void {
  profileCache.delete(userId);
}

/**
 * Clear all profiles from cache
 */
export function clearProfileCache(): void {
  profileCache.clear();
}

/**
 * Get cache stats for debugging
 */
export function getProfileCacheStats(): {
  size: number;
  maxSize: number;
  ttlMs: number;
} {
  return {
    size: profileCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL,
  };
}

export default {
  getCachedProfile,
  getCachedProfileSync,
  setCachedProfile,
  prefetchProfiles,
  invalidateProfile,
  clearProfileCache,
  getProfileCacheStats,
};
