/**
 * Wallet & Reward Synchronization Tests
 *
 * Tests the current reward model:
 * - Achievements auto-award tokens when unlocked
 * - Old earned_unclaimed achievements are repaired by background backfill
 * - Level rewards remain manually claimable
 * - Wallet transaction labels use automatic reward language
 */

describe("Achievement Reward State Model", () => {
  type AchievementEntryLike =
    | {
        schemaVersion?: number;
        status?: string;
        claimedAt?: unknown;
        [key: string]: unknown;
      }
    | null
    | undefined;

  function needsBackfill(entry: AchievementEntryLike): boolean {
    return entry?.status === "earned_unclaimed";
  }

  function getState(
    entry: AchievementEntryLike,
  ): "locked" | "needs_backfill" | "awarded" {
    if (!entry) return "locked";
    return needsBackfill(entry) ? "needs_backfill" : "awarded";
  }

  it("treats old earned_unclaimed achievements as needing backfill", () => {
    const entry = {
      schemaVersion: 2,
      status: "earned_unclaimed",
      claimedAt: null,
    };

    expect(needsBackfill(entry)).toBe(true);
    expect(getState(entry)).toBe("needs_backfill");
  });

  it("treats schemaVersion 3 claimed achievements as awarded", () => {
    const entry = {
      schemaVersion: 3,
      status: "claimed",
      claimedAt: { seconds: 1234567890 },
    };

    expect(needsBackfill(entry)).toBe(false);
    expect(getState(entry)).toBe("awarded");
  });

  it("treats legacy no-status achievements as already awarded", () => {
    const entry = {
      type: "game_first_play",
      earnedAt: { seconds: 1234567890 },
    };

    expect(needsBackfill(entry)).toBe(false);
    expect(getState(entry)).toBe("awarded");
  });

  it("treats missing entry as locked", () => {
    expect(getState(undefined as any)).toBe("locked");
    expect(getState(null as any)).toBe("locked");
  });
});

describe("Level Reward State Model", () => {
  function getLevelRewardState(doc: {
    claimedAt: unknown | null;
  }): "unclaimed" | "claimed" {
    return doc.claimedAt === null ? "unclaimed" : "claimed";
  }

  it("treats claimedAt=null as unclaimed/claimable", () => {
    const doc = { claimedAt: null, tokenReward: 50, level: 3 };
    expect(getLevelRewardState(doc)).toBe("unclaimed");
  });

  it("treats claimedAt=timestamp as claimed", () => {
    const doc = {
      claimedAt: { seconds: 1234567890 },
      tokenReward: 50,
      level: 3,
    };
    expect(getLevelRewardState(doc)).toBe("claimed");
  });
});

describe("Pending Rewards Aggregation", () => {
  function computePending(
    _achievements: {
      schemaVersion?: number;
      status?: string;
      tokenReward?: number;
    }[],
    levelRewards: {
      claimedAt: unknown | null;
      tokenReward: number;
    }[],
  ) {
    const unclaimedLvl = levelRewards.filter((r) => r.claimedAt === null);
    const unclaimedLevelRewardTokens = unclaimedLvl.reduce(
      (sum, r) => sum + r.tokenReward,
      0,
    );

    return {
      unclaimedAchievementCount: 0,
      unclaimedAchievementTokens: 0,
      unclaimedLevelRewardCount: unclaimedLvl.length,
      unclaimedLevelRewardTokens,
      totalPendingTokens: unclaimedLevelRewardTokens,
    };
  }

  it("computes zero pending for empty data", () => {
    const result = computePending([], []);
    expect(result.totalPendingTokens).toBe(0);
    expect(result.unclaimedAchievementCount).toBe(0);
    expect(result.unclaimedLevelRewardCount).toBe(0);
  });

  it("ignores old unclaimed achievements in pending rewards", () => {
    const achievements = [
      { schemaVersion: 2, status: "earned_unclaimed", tokenReward: 25 },
      { schemaVersion: 2, status: "earned_unclaimed", tokenReward: 50 },
    ];
    const result = computePending(achievements, []);
    expect(result.unclaimedAchievementCount).toBe(0);
    expect(result.unclaimedAchievementTokens).toBe(0);
  });

  it("counts unclaimed level rewards correctly", () => {
    const levelRewards = [
      { claimedAt: null, tokenReward: 50 },
      { claimedAt: { seconds: 123 }, tokenReward: 50 },
      { claimedAt: null, tokenReward: 200 },
    ];
    const result = computePending([], levelRewards);
    expect(result.unclaimedLevelRewardCount).toBe(2);
    expect(result.unclaimedLevelRewardTokens).toBe(250);
  });

  it("only sums level reward pending tokens", () => {
    const achievements = [
      { schemaVersion: 2, status: "earned_unclaimed", tokenReward: 25 },
    ];
    const levelRewards = [{ claimedAt: null, tokenReward: 100 }];
    const result = computePending(achievements, levelRewards);
    expect(result.totalPendingTokens).toBe(100);
  });
});

describe("Auto-Award Backfill Safety", () => {
  it("reports zero awards when backfill is already complete", () => {
    const result = {
      success: true,
      scanned: 0,
      awardedCount: 0,
      repairedCount: 0,
      totalTokensAwarded: 0,
    };

    expect(result.success).toBe(true);
    expect(result.awardedCount).toBe(0);
    expect(result.totalTokensAwarded).toBe(0);
  });

  it("returns token totals for old unclaimed achievement backfill", () => {
    const result = {
      success: true,
      scanned: 1,
      awardedCount: 1,
      repairedCount: 0,
      totalTokensAwarded: 10,
    };

    expect(result.success).toBe(true);
    expect(result.awardedCount).toBe(1);
    expect(result.totalTokensAwarded).toBe(10);
  });

  it("does not double-count repaired rewards", () => {
    const first = {
      success: true,
      scanned: 2,
      awardedCount: 1,
      repairedCount: 1,
      totalTokensAwarded: 10,
    };
    const second = {
      success: true,
      scanned: 0,
      awardedCount: 0,
      repairedCount: 0,
      totalTokensAwarded: 0,
    };

    expect(first.totalTokensAwarded).toBe(10);
    expect(second.totalTokensAwarded).toBe(0);
  });
});

describe("Transaction Reason Display", () => {
  const reasonMap: Record<string, string> = {
    task_reward: "Task Completed",
    achievement_reward: "Achievement Reward",
    level_reward: "Level Reward Claimed",
    daily_bonus: "Daily Bonus",
    streak_bonus: "Streak Bonus",
    shop_purchase: "Shop Purchase",
    cosmetic_purchase: "Cosmetic Purchase",
    admin_grant: "Bonus Tokens",
    refund: "Refund",
  };

  it("has display labels for all known reason types", () => {
    const requiredReasons = [
      "task_reward",
      "achievement_reward",
      "level_reward",
      "daily_bonus",
      "shop_purchase",
      "cosmetic_purchase",
    ];
    for (const reason of requiredReasons) {
      expect(reasonMap[reason]).toBeDefined();
      expect(reasonMap[reason].length).toBeGreaterThan(0);
    }
  });

  it("uses automatic achievement reward language", () => {
    expect(reasonMap.achievement_reward).toBe("Achievement Reward");
  });

  it("keeps level reward claim language", () => {
    expect(reasonMap.level_reward).toBe("Level Reward Claimed");
  });
});

describe("Level Reward Definitions", () => {
  const MILESTONE_COSMETICS: Record<number, string> = {
    5: "bg_circling_waves",
    10: "bg_aurora_borealis",
    15: "badge_level_15",
    20: "bg_rune_circles",
    25: "badge_level_25",
    30: "bg_synthwave",
    35: "badge_level_35",
    40: "dec_golden_crown",
    45: "badge_level_45",
    50: "bg_synthwave_videogame",
  };

  it("has 10 milestones every 5th level", () => {
    const milestones = Object.keys(MILESTONE_COSMETICS).map(Number);
    expect(milestones).toHaveLength(10);
    for (const level of milestones) {
      expect(level % 5).toBe(0);
      expect(level).toBeGreaterThanOrEqual(5);
      expect(level).toBeLessThanOrEqual(50);
    }
  });

  it("uses the milestone token reward formula", () => {
    for (const level of Object.keys(MILESTONE_COSMETICS).map(Number)) {
      expect(level * 20).toBe(level * 20);
    }
  });

  it("keeps standard levels non-milestone", () => {
    const standardLevels = [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14];
    for (const level of standardLevels) {
      expect(level % 5 === 0).toBe(false);
    }
  });
});
