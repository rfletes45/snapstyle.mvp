/**
 * useBadges Hook
 *
 * Provides badge data and actions for profile/badge screens.
 *
 * @example
 * const { earnedBadges, featuredBadges, featureBadge } = useBadges(userId);
 */

import { BADGE_DEFINITIONS, getBadgeById } from "@/data/badges";
import {
  featureBadge as featureBadgeService,
  subscribeToBadges,
  unfeatureBadge as unfeatureBadgeService,
} from "@/services/badges";
import { useAuth } from "@/store/AuthContext";
import type { Badge, UserBadge } from "@/types/profile";
import { useCallback, useEffect, useMemo, useState } from "react";


import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useBadges");
interface UseBadgesReturn {
  /** All badges the user has earned */
  earnedBadges: UserBadge[];
  /** All badge definitions (for showing locked badges) */
  allBadges: Badge[];
  /** Featured badges for profile display (max 5) */
  featuredBadges: UserBadge[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Feature a badge on profile */
  featureBadge: (badgeId: string, order: number) => Promise<boolean>;
  /** Remove a badge from featured */
  unfeatureBadge: (badgeId: string) => Promise<boolean>;
  /** Check if a badge is earned */
  hasBadge: (badgeId: string) => boolean;
  /** Get badge definition with earned status */
  getBadgeWithStatus: (
    badgeId: string,
  ) => (Badge & { earned: boolean; featured: boolean }) | undefined;
  /** Statistics */
  stats: {
    total: number;
    earned: number;
    percentage: number;
  };
}

export function useBadges(uid: string | undefined): UseBadgesReturn {
  const { isHydrated: authHydrated, currentFirebaseUser } = useAuth();
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isTokenReady, setIsTokenReady] = useState(false);

  // Wait for auth token to be truly ready before allowing subscriptions
  useEffect(() => {
    let cancelled = false;

    const verifyAuthToken = async () => {
      if (!currentFirebaseUser) {
        setIsTokenReady(false);
        return;
      }

      try {
        // Force get a fresh token to ensure auth is fully propagated
        const token = await currentFirebaseUser.getIdToken(false);
        if (!cancelled && token) {
          logger.info("[useBadges] Auth token verified, ready to subscribe");
          setIsTokenReady(true);
        }
      } catch (err) {
        logger.error("[useBadges] Error verifying auth token:", err);
        if (!cancelled) {
          setIsTokenReady(false);
        }
      }
    };

    if (authHydrated && currentFirebaseUser) {
      verifyAuthToken();
    } else {
      setIsTokenReady(false);
    }

    return () => {
      cancelled = true;
    };
  }, [authHydrated, currentFirebaseUser]);

  // Subscribe to badges - only after auth token is verified
  useEffect(() => {
    logger.info("[useBadges] Subscription effect triggered:", {
      uid,
      authHydrated,
      isTokenReady,
      hasFirebaseUser: !!currentFirebaseUser,
    });

    // Don't subscribe until auth token is truly ready
    if (!isTokenReady) {
      logger.info("[useBadges] Skipping - auth token not ready yet");
      return;
    }

    if (!uid) {
      logger.info("[useBadges] Skipping - no uid provided");
      setEarnedBadges([]);
      setLoading(false);
      return;
    }

    logger.info("[useBadges] Setting up subscription for uid:", uid);
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToBadges(
      uid,
      (badges) => {
        logger.info("[useBadges] Received badges:", badges.length);
        setEarnedBadges(badges);
        setLoading(false);
      },
      (err) => {
        logger.error("[useBadges] Subscription error:", err);
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      logger.info("[useBadges] Cleaning up subscription for uid:", uid);
      unsubscribe();
    };
  }, [uid, isTokenReady, currentFirebaseUser]);

  // Compute featured badges
  const featuredBadges = useMemo(() => {
    return earnedBadges
      .filter((b) => b.featured)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [earnedBadges]);

  // All badge definitions
  const allBadges = useMemo(() => BADGE_DEFINITIONS, []);

  // Stats
  const stats = useMemo(() => {
    const total = BADGE_DEFINITIONS.filter((b) => !b.hidden).length;
    const earned = earnedBadges.length;
    return {
      total,
      earned,
      percentage: total > 0 ? Math.round((earned / total) * 100) : 0,
    };
  }, [earnedBadges]);

  // Check if badge is earned
  const hasBadge = useCallback(
    (badgeId: string) => {
      return earnedBadges.some((b) => b.badgeId === badgeId);
    },
    [earnedBadges],
  );

  // Get badge with status
  const getBadgeWithStatus = useCallback(
    (badgeId: string) => {
      const definition = getBadgeById(badgeId);
      if (!definition) return undefined;

      const userBadge = earnedBadges.find((b) => b.badgeId === badgeId);
      return {
        ...definition,
        earned: !!userBadge,
        featured: userBadge?.featured || false,
      };
    },
    [earnedBadges],
  );

  // Feature badge action
  const featureBadge = useCallback(
    async (badgeId: string, order: number) => {
      if (!uid) return false;
      return featureBadgeService(uid, badgeId, order);
    },
    [uid],
  );

  // Unfeature badge action
  const unfeatureBadge = useCallback(
    async (badgeId: string) => {
      if (!uid) return false;
      return unfeatureBadgeService(uid, badgeId);
    },
    [uid],
  );

  return {
    earnedBadges,
    allBadges,
    featuredBadges,
    loading,
    error,
    featureBadge,
    unfeatureBadge,
    hasBadge,
    getBadgeWithStatus,
    stats,
  };
}

export default useBadges;
