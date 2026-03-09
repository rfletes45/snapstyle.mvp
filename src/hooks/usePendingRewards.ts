/**
 * usePendingRewards — Aggregates unclaimed achievement and level rewards.
 *
 * Provides a unified view of all pending claimable rewards for the current user,
 * used by the Wallet screen and any other surface that needs reward awareness.
 *
 * @module hooks/usePendingRewards
 */

import {
  subscribeToAchievements,
  subscribeToLevelRewards,
  type AchievementEntryV4,
  type LevelRewardDocV4,
} from "@/gamesV4/services/gameServiceV4";
import { useAuth } from "@/store/AuthContext";
import { useEffect, useMemo, useState } from "react";

export interface PendingRewardsSummary {
  /** Number of unclaimed achievement rewards */
  unclaimedAchievementCount: number;
  /** Total tokens available from unclaimed achievements */
  unclaimedAchievementTokens: number;
  /** Number of unclaimed level rewards */
  unclaimedLevelRewardCount: number;
  /** Total tokens available from unclaimed level rewards */
  unclaimedLevelRewardTokens: number;
  /** Combined total pending claimable tokens */
  totalPendingTokens: number;
  /** Combined total pending claims */
  totalPendingCount: number;
  /** Whether data is still loading */
  loading: boolean;
}

/**
 * Determine if an achievement entry is "unclaimed" (earned but reward not yet collected).
 * Legacy docs (schemaVersion undefined / < 2) are treated as already claimed since tokens
 * were auto-credited before the manual-claim system was introduced.
 */
function isUnclaimedAchievement(entry: AchievementEntryV4): boolean {
  if (entry.schemaVersion && entry.schemaVersion >= 2) {
    return entry.status === "earned_unclaimed";
  }
  return false;
}

/**
 * Subscribe to aggregated pending rewards for the current user.
 */
export function usePendingRewards(): PendingRewardsSummary {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [achievements, setAchievements] = useState<AchievementEntryV4[]>([]);
  const [levelRewards, setLevelRewards] = useState<LevelRewardDocV4[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState(true);
  const [loadingLevelRewards, setLoadingLevelRewards] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoadingAchievements(false);
      setLoadingLevelRewards(false);
      return;
    }

    setLoadingAchievements(true);
    setLoadingLevelRewards(true);

    const unsubAch = subscribeToAchievements(
      uid,
      (data) => {
        setAchievements(data);
        setLoadingAchievements(false);
      },
      () => setLoadingAchievements(false),
    );

    const unsubLvl = subscribeToLevelRewards(
      uid,
      (data) => {
        setLevelRewards(data);
        setLoadingLevelRewards(false);
      },
      () => setLoadingLevelRewards(false),
    );

    return () => {
      unsubAch();
      unsubLvl();
    };
  }, [uid]);

  return useMemo(() => {
    const unclaimedAch = achievements.filter(isUnclaimedAchievement);
    const unclaimedLvl = levelRewards.filter((r) => r.claimedAt === null);

    const unclaimedAchievementTokens = unclaimedAch.reduce(
      (sum, a) => sum + (a.tokenReward || 0),
      0,
    );
    const unclaimedLevelRewardTokens = unclaimedLvl.reduce(
      (sum, r) => sum + (r.tokenReward || 0),
      0,
    );

    return {
      unclaimedAchievementCount: unclaimedAch.length,
      unclaimedAchievementTokens,
      unclaimedLevelRewardCount: unclaimedLvl.length,
      unclaimedLevelRewardTokens,
      totalPendingTokens:
        unclaimedAchievementTokens + unclaimedLevelRewardTokens,
      totalPendingCount: unclaimedAch.length + unclaimedLvl.length,
      loading: loadingAchievements || loadingLevelRewards,
    };
  }, [achievements, levelRewards, loadingAchievements, loadingLevelRewards]);
}
