/**
 * useAchievementsV2 — Client-side hook for the Achievements V2 system.
 *
 * When ACHIEVEMENTS_V2_FEATURES.ENABLED is true, subscribes to the v2
 * Firestore docs and exposes progress, unlocked state, and display items.
 *
 * When disabled, returns an empty/noop state so callers can conditionally
 * render without branching on the flag themselves.
 *
 * This hook is ADDITIVE — it does not replace `useGameAchievements`.
 * The legacy hook continues to handle v1 game-over checking.
 * This hook provides the richer v2 read layer for the Achievements UI.
 *
 * @module hooks/useAchievementsV2
 */

import { ACHIEVEMENTS_V2_FEATURES } from "@/constants/featureFlags";
import {
  buildV2DisplayItems,
  computeLocalSummary,
  getUnlockedIds,
  subscribeToV2Achievements,
  type V2AchievementDisplayItem,
} from "@/services/achievementsV2";
import type {
  AchievementV2Tier,
  UserAchievementDoc,
} from "@/types/achievementsV2";
import type { ExtendedGameType } from "@/types/games";
import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const logger = createLogger("hooks/useAchievementsV2");

// =============================================================================
// Types
// =============================================================================

export interface UseAchievementsV2Return {
  /** Whether v2 is enabled and has data */
  isV2Active: boolean;

  /** True while initial snapshot is loading */
  isLoading: boolean;

  /** All display items (merged catalog + user docs) */
  displayItems: V2AchievementDisplayItem[];

  /** Set of unlocked achievement IDs */
  unlockedIds: Set<string>;

  /** Check if a specific achievement is unlocked */
  isUnlocked: (achievementId: string) => boolean;

  /** Summary stats */
  summary: {
    totalUnlocked: number;
    totalAvailable: number;
    unlockedByTier: Record<AchievementV2Tier, number>;
    totalXpEarned: number;
    totalCoinsEarned: number;
  };

  /** Newly unlocked IDs since the last render (for toast/animation) */
  newUnlocks: string[];

  /** Acknowledge new unlocks (clears the newUnlocks array) */
  clearNewUnlocks: () => void;
}

const EMPTY_SET = new Set<string>();
const EMPTY_SUMMARY = {
  totalUnlocked: 0,
  totalAvailable: 0,
  unlockedByTier: {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
    diamond: 0,
  } as Record<AchievementV2Tier, number>,
  totalXpEarned: 0,
  totalCoinsEarned: 0,
};

// =============================================================================
// Hook
// =============================================================================

export function useAchievementsV2(
  userId: string | undefined,
  options?: {
    /** Filter display items to a game type */
    gameType?: ExtendedGameType;
    /** Filter display items to a category */
    category?: string;
  },
): UseAchievementsV2Return {
  const [userDocs, setUserDocs] = useState<Map<string, UserAchievementDoc>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [newUnlocks, setNewUnlocks] = useState<string[]>([]);
  const previousUnlockedRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const initialLoadRef = useRef(true);

  const isV2Active = ACHIEVEMENTS_V2_FEATURES.ENABLED && !!userId;

  // Subscribe to v2 docs
  useEffect(() => {
    mountedRef.current = true;
    if (!isV2Active || !userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsub = subscribeToV2Achievements(
      userId,
      (docs) => {
        if (!mountedRef.current) return;

        // Detect newly unlocked achievements
        const currentUnlocked = getUnlockedIds(docs);
        if (!initialLoadRef.current) {
          const freshUnlocks: string[] = [];
          for (const id of currentUnlocked) {
            if (!previousUnlockedRef.current.has(id)) {
              freshUnlocks.push(id);
            }
          }
          if (freshUnlocks.length > 0) {
            setNewUnlocks((prev) => [...prev, ...freshUnlocks]);
          }
        }

        previousUnlockedRef.current = currentUnlocked;
        initialLoadRef.current = false;
        setUserDocs(docs);
        setIsLoading(false);
      },
      (error) => {
        logger.error("[useAchievementsV2] Subscription error:", error);
        if (mountedRef.current) {
          setIsLoading(false);
        }
      },
    );

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [isV2Active, userId]);

  // Build display items
  const displayItems = useMemo(() => {
    if (!isV2Active) return [];
    return buildV2DisplayItems(userDocs, {
      gameType: options?.gameType,
      category: options?.category,
    });
  }, [isV2Active, userDocs, options?.gameType, options?.category]);

  // Unlocked IDs (scoped to gameType when provided)
  const unlockedIds = useMemo(() => {
    if (!isV2Active) return EMPTY_SET;
    return getUnlockedIds(userDocs, options?.gameType);
  }, [isV2Active, userDocs, options?.gameType]);

  // Summary (scoped to gameType when provided)
  const summary = useMemo(() => {
    if (!isV2Active) return EMPTY_SUMMARY;
    if (options?.gameType) {
      logger.debug(`[summary] Scoped to gameType=${options.gameType}`);
    } else {
      logger.debug("[summary] No gameType provided — returning global counts.");
    }
    return computeLocalSummary(userDocs, options?.gameType);
  }, [isV2Active, userDocs, options?.gameType]);

  // Is unlocked check
  const isUnlocked = useCallback(
    (achievementId: string): boolean => {
      return unlockedIds.has(achievementId);
    },
    [unlockedIds],
  );

  // Clear new unlocks
  const clearNewUnlocks = useCallback(() => {
    setNewUnlocks([]);
  }, []);

  return {
    isV2Active,
    isLoading,
    displayItems,
    unlockedIds,
    isUnlocked,
    summary,
    newUnlocks,
    clearNewUnlocks,
  };
}

export default useAchievementsV2;
