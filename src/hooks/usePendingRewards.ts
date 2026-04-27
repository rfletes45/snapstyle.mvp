/**
 * usePendingRewards — Aggregates unclaimed level rewards.
 *
 * Achievements now award tokens automatically when unlocked, so they are not
 * part of this pending/manual reward summary.
 *
 * @module hooks/usePendingRewards
 */

import {
  subscribeToLevelRewards,
  type LevelRewardDocV4,
} from "@/gamesV4/services/gameServiceV4";
import { useAuth } from "@/store/AuthContext";
import { useEffect, useMemo, useState } from "react";

export interface PendingRewardsSummary {
  /** Always zero: achievements auto-award and are not manually claimed. */
  unclaimedAchievementCount: number;
  /** Always zero: achievements auto-award and are not manually claimed. */
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
 * Subscribe to aggregated pending rewards for the current user.
 */
export function usePendingRewards(): PendingRewardsSummary {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [levelRewards, setLevelRewards] = useState<LevelRewardDocV4[]>([]);
  const [loadingLevelRewards, setLoadingLevelRewards] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoadingLevelRewards(false);
      return;
    }

    setLoadingLevelRewards(true);

    const unsubLvl = subscribeToLevelRewards(
      uid,
      (data) => {
        setLevelRewards(data);
        setLoadingLevelRewards(false);
      },
      () => setLoadingLevelRewards(false),
    );

    return () => {
      unsubLvl();
    };
  }, [uid]);

  return useMemo(() => {
    const unclaimedLvl = levelRewards.filter((r) => r.claimedAt === null);
    const unclaimedLevelRewardTokens = unclaimedLvl.reduce(
      (sum, r) => sum + (r.tokenReward || 0),
      0,
    );

    return {
      unclaimedAchievementCount: 0,
      unclaimedAchievementTokens: 0,
      unclaimedLevelRewardCount: unclaimedLvl.length,
      unclaimedLevelRewardTokens,
      totalPendingTokens: unclaimedLevelRewardTokens,
      totalPendingCount: unclaimedLvl.length,
      loading: loadingLevelRewards,
    };
  }, [levelRewards, loadingLevelRewards]);
}
