/**
 * useProfileData Hook
 *
 * Phase 3 & 7 of Profile Screen Overhaul
 *
 * Combines user profile, stats, level, and badges into a single hook.
 * Provides all data needed for the profile screen with:
 * - Intelligent caching for reduced Firestore reads
 * - Stale-while-revalidate pattern
 * - Memoized computations
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 */

import { useBadges } from "@/hooks/useBadges";
import {
  getCached,
  invalidateCacheForEvent,
  isCacheStale,
  setCached,
  type CacheInvalidationEvent,
} from "@/services/profileCache";
import { useUser } from "@/store/UserContext";
import type {
  ExtendedUserProfile,
  LevelInfo,
  ProfileStats,
} from "@/types/profile";
import { calculateLevelFromXp, normalizeAvatarConfig } from "@/types/profile";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// =============================================================================
// Types
// =============================================================================

interface UseProfileDataReturn {
  /** Extended profile data */
  profile: ExtendedUserProfile | null;
  /** Loading state */
  loading: boolean;
  /** Whether cache is stale (data shown but refresh recommended) */
  isStale: boolean;
  /** Error state */
  error: Error | null;
  /** Refresh all profile data */
  refresh: () => Promise<void>;
  /** Invalidate cache for specific event */
  invalidateCache: (event: CacheInvalidationEvent) => Promise<void>;
  /** Profile stats (memoized) */
  stats: ProfileStats | null;
  /** Level info (memoized) */
  levelInfo: LevelInfo | null;
  /** Last refresh timestamp */
  lastRefresh: number | null;
}

interface UseProfileDataOptions {
  /** Skip initial fetch (use cached data only) */
  cacheOnly?: boolean;
  /** Force refresh on mount */
  forceRefresh?: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useProfileData(
  uid: string | undefined,
  options: UseProfileDataOptions = {},
): UseProfileDataReturn {
  const { cacheOnly = false, forceRefresh = false } = options;

  const {
    profile: baseProfile,
    loading: profileLoading,
    refreshProfile,
  } = useUser();
  const {
    earnedBadges,
    featuredBadges,
    loading: badgesLoading,
    stats: badgeStats,
  } = useBadges(uid);

  const [error, setError] = useState<Error | null>(null);
  const [cachedStats, setCachedStats] = useState<ProfileStats | null>(null);
  const [cachedLevel, setCachedLevel] = useState<LevelInfo | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  // Track previous level for change detection
  const previousLevelRef = useRef<number | null>(null);

  // =============================================================================
  // Cache Management
  // =============================================================================

  // Load cached data on mount
  useEffect(() => {
    if (!uid) return;

    const loadCachedData = async () => {
      try {
        const [cachedStatsData, cachedLevelData] = await Promise.all([
          getCached(uid, "stats"),
          getCached(uid, "level"),
        ]);

        if (cachedStatsData) {
          setCachedStats(cachedStatsData);
          setIsStale(isCacheStale(uid, "stats"));
        }

        if (cachedLevelData) {
          setCachedLevel(cachedLevelData);
        }
      } catch (err) {
        console.warn("[useProfileData] Failed to load cached data:", err);
      }
    };

    loadCachedData();
  }, [uid]);

  // =============================================================================
  // Computed Stats (Memoized)
  // =============================================================================

  const computedStats = useMemo<ProfileStats | null>(() => {
    if (!baseProfile || !uid) return cachedStats;

    const stats: ProfileStats = {
      gamesPlayed: cachedStats?.gamesPlayed ?? 0,
      gamesWon: cachedStats?.gamesWon ?? 0,
      winRate: cachedStats?.winRate ?? 0,
      highestStreak: cachedStats?.highestStreak ?? 0,
      currentStreak: cachedStats?.currentStreak ?? 0,
      totalBadges: badgeStats.earned,
      achievementProgress: badgeStats.percentage,
      friendCount: cachedStats?.friendCount ?? 0,
      daysActive: Math.floor(
        (Date.now() - baseProfile.createdAt) / (24 * 60 * 60 * 1000),
      ),
    };

    // Update cache asynchronously
    setCached(uid, "stats", stats).catch(console.warn);

    return stats;
  }, [baseProfile, uid, badgeStats, cachedStats]);

  // =============================================================================
  // Computed Level (Memoized)
  // =============================================================================

  const computedLevel = useMemo<LevelInfo | null>(() => {
    if (!uid) return cachedLevel;

    // In production, fetch XP from user document
    const totalXp = cachedLevel?.totalXp ?? 0;
    const level = calculateLevelFromXp(totalXp);

    // Update cache asynchronously
    setCached(uid, "level", level).catch(console.warn);

    return level;
  }, [uid, cachedLevel]);

  // =============================================================================
  // Extended Profile (Memoized)
  // =============================================================================

  const extendedProfile = useMemo<ExtendedUserProfile | null>(() => {
    if (!baseProfile || !uid) return null;

    // Normalize avatar config to extended format
    const avatarConfig = normalizeAvatarConfig(baseProfile.avatarConfig);

    // Use computed stats and level
    const stats = computedStats || {
      gamesPlayed: 0,
      gamesWon: 0,
      winRate: 0,
      highestStreak: 0,
      currentStreak: 0,
      totalBadges: badgeStats.earned,
      achievementProgress: badgeStats.percentage,
      friendCount: 0,
      daysActive: Math.floor(
        (Date.now() - baseProfile.createdAt) / (24 * 60 * 60 * 1000),
      ),
    };

    const level = computedLevel || calculateLevelFromXp(0);

    return {
      uid: baseProfile.uid,
      username: baseProfile.username,
      displayName: baseProfile.displayName,
      avatarConfig,
      createdAt: baseProfile.createdAt,
      lastActive: baseProfile.lastActive,
      stats,
      level,
      featuredBadges,
      equippedCosmetics: {
        hat: avatarConfig.hat,
        glasses: avatarConfig.glasses,
        background: avatarConfig.background,
        profileFrame: avatarConfig.profileFrame,
        chatBubble: avatarConfig.chatBubble,
      },
    };
  }, [
    baseProfile,
    uid,
    featuredBadges,
    badgeStats,
    computedStats,
    computedLevel,
  ]);

  // =============================================================================
  // Loading State
  // =============================================================================

  const loading = useMemo(() => {
    // If we have cached data, don't show loading
    if (cachedStats && cachedLevel) return false;
    return profileLoading || badgesLoading;
  }, [profileLoading, badgesLoading, cachedStats, cachedLevel]);

  // =============================================================================
  // Refresh Handler
  // =============================================================================

  const refresh = useCallback(async () => {
    if (!uid) return;

    try {
      setError(null);

      // Refresh profile data
      await refreshProfile();

      // Mark as fresh
      setIsStale(false);
      setLastRefresh(Date.now());
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [refreshProfile, uid]);

  // =============================================================================
  // Cache Invalidation
  // =============================================================================

  const invalidateCache = useCallback(
    async (event: CacheInvalidationEvent) => {
      if (!uid) return;

      await invalidateCacheForEvent(uid, event);
      setIsStale(true);
    },
    [uid],
  );

  // =============================================================================
  // Auto-refresh on mount (if forceRefresh)
  // =============================================================================

  useEffect(() => {
    if (forceRefresh && uid && !cacheOnly) {
      refresh().catch(console.warn);
    }
  }, [forceRefresh, uid, cacheOnly, refresh]);

  // =============================================================================
  // Track level changes for animation triggers
  // =============================================================================

  useEffect(() => {
    if (computedLevel && previousLevelRef.current !== null) {
      if (computedLevel.current > previousLevelRef.current) {
        // Level up detected - could trigger animation via event
        console.log(
          `[useProfileData] Level up: ${previousLevelRef.current} → ${computedLevel.current}`,
        );
      }
    }
    previousLevelRef.current = computedLevel?.current ?? null;
  }, [computedLevel?.current]);

  // =============================================================================
  // Return
  // =============================================================================

  return {
    profile: extendedProfile,
    loading,
    isStale,
    error,
    refresh,
    invalidateCache,
    stats: computedStats,
    levelInfo: computedLevel,
    lastRefresh,
  };
}

export default useProfileData;
