/**
 * Profile Cache Service
 *
 * In-memory cache for user profiles to avoid repeated Firestore fetches.
 * Used across chat screens for instant profile display.
 *
 * @file src/services/cache/profileCache.ts
 */

import { getFirestoreInstance } from "@/services/firebase";
import { getUserProfileByUid } from "@/services/friends";
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from "firebase/firestore";

// =============================================================================
// Types
// =============================================================================

export interface CachedProfile {
  uid: string;
  username: string;
  displayName?: string;
  avatar?: string | null;
  avatarConfig?: any;
  profilePictureUrl?: string | null;
  decorationId?: string | null;
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
    profilePictureUrl: profile.profilePicture?.url || null,
    decorationId:
      profile.avatarDecoration?.decorationId ||
      profile.avatarDecoration?.equippedId ||
      null,
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
 * Prefetch multiple profiles into cache using Firestore batch queries.
 * Uses `where(documentId(), 'in', ...)` to fetch up to 30 profiles per
 * round-trip instead of N individual getDoc calls.
 */
export async function prefetchProfiles(userIds: string[]): Promise<void> {
  const uncached = userIds.filter((id) => !getCachedProfileSync(id));
  if (uncached.length === 0) return;

  await batchFetchProfiles(uncached);
}

/**
 * Batch-fetch profiles from Firestore using `documentId() in [...]` queries.
 * Firestore limits disjunction (`in`) to 30 values, so we chunk accordingly.
 * All fetched profiles are written into the cache.
 */
const FIRESTORE_IN_LIMIT = 30;

export async function batchFetchProfiles(
  userIds: string[],
): Promise<Map<string, CachedProfile>> {
  const results = new Map<string, CachedProfile>();
  if (userIds.length === 0) return results;

  // Return cached hits immediately, collect misses
  const uncached: string[] = [];
  for (const uid of userIds) {
    const cached = getCachedProfileSync(uid);
    if (cached) {
      results.set(uid, cached);
    } else {
      uncached.push(uid);
    }
  }

  if (uncached.length === 0) return results;

  const db = getFirestoreInstance();
  const usersRef = collection(db, "Users");

  // Chunk into groups of FIRESTORE_IN_LIMIT (30) for the `in` operator
  const chunks: string[][] = [];
  for (let i = 0; i < uncached.length; i += FIRESTORE_IN_LIMIT) {
    chunks.push(uncached.slice(i, i + FIRESTORE_IN_LIMIT));
  }

  const chunkResults = await Promise.allSettled(
    chunks.map(async (chunk) => {
      const q = query(usersRef, where(documentId(), "in", chunk));
      const snap = await getDocs(q);
      const found = new Set<string>();

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const profile: CachedProfile = {
          uid: docSnap.id,
          username: data.username || "Unknown",
          displayName: data.displayName,
          avatar: data.avatarUrl || null,
          avatarConfig: data.avatarConfig,
          profilePictureUrl: data.profilePicture?.url || null,
          decorationId:
            data.avatarDecoration?.decorationId ||
            data.avatarDecoration?.equippedId ||
            null,
        };
        setCachedProfile(docSnap.id, profile);
        results.set(docSnap.id, profile);
        found.add(docSnap.id);
      }

      // Cache "Unknown" fallback for UIDs not found in Firestore
      for (const uid of chunk) {
        if (!found.has(uid)) {
          const fallback: CachedProfile = { uid, username: "Unknown" };
          setCachedProfile(uid, fallback);
          results.set(uid, fallback);
        }
      }
    }),
  );

  // Log failures but don't throw — partial results are fine
  for (const result of chunkResults) {
    if (result.status === "rejected") {
      console.warn("[profileCache] Batch fetch chunk failed:", result.reason);
    }
  }

  return results;
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
