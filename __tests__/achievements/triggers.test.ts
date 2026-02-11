/**
 * Achievement Triggers Unit Tests
 * Phase 7: Testing Requirements
 *
 * Tests for:
 * - Game achievement triggers
 * - Multiplayer achievements
 * - Streak tracking
 * - Achievement deduplication
 *
 * @see src/services/achievements.ts
 */

// Test-specific achievement definition (uses string types for flexibility)
interface TestAchievementDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: "game" | "streak" | "social" | "collection";
  rarity: "common" | "rare" | "epic" | "legendary";
  threshold?: number;
}

// =============================================================================
// Mock Achievement Service
// =============================================================================

// In-memory storage for tests
let grantedAchievements: Map<string, Set<string>> = new Map();
let userStats: Map<string, UserStats> = new Map();

interface UserStats {
  gamesPlayed: number;
  currentWinStreak: number;
  bestWinStreak: number;
  totalWins: number;
  totalLosses: number;
  gameScores: Record<string, number[]>;
}

interface AchievementContext {
  userId: string;
  gameType?: string;
  score?: number;
  isMultiplayer?: boolean;
  isWinner?: boolean;
  reactionTime?: number;
  tapCount?: number;
}

interface GrantedAchievement {
  id: string;
  grantedAt: number;
}

// Achievement definitions for testing
const TEST_ACHIEVEMENTS: TestAchievementDefinition[] = [
  // Multiplayer achievements
  {
    type: "mp_first_game",
    name: "First Victory",
    description: "Win your first multiplayer game",
    icon: "sword",
    category: "game",
    rarity: "common",
  },
  {
    type: "mp_win_streak_3",
    name: "Hat Trick",
    description: "Win 3 games in a row",
    icon: "fire",
    category: "game",
    rarity: "rare",
    threshold: 3,
  },
  {
    type: "mp_win_streak_5",
    name: "Dominant",
    description: "Win 5 games in a row",
    icon: "fire",
    category: "game",
    rarity: "epic",
    threshold: 5,
  },
  {
    type: "mp_win_streak_10",
    name: "Unstoppable",
    description: "Win 10 games in a row",
    icon: "fire",
    category: "game",
    rarity: "legendary",
    threshold: 10,
  },

  // Reaction game achievements
  {
    type: "reaction_master",
    name: "Lightning Reflexes",
    description: "Achieve a reaction time under 200ms",
    icon: "lightning-bolt",
    category: "game",
    rarity: "epic",
    threshold: 200,
  },
  {
    type: "reaction_god",
    name: "Superhuman",
    description: "Achieve a reaction time under 150ms",
    icon: "flash",
    category: "game",
    rarity: "legendary",
    threshold: 150,
  },

  // Timed tap achievements
  {
    type: "tap_100",
    name: "Speed Demon",
    description: "Tap 100 times in 10 seconds",
    icon: "fire",
    category: "game",
    rarity: "rare",
    threshold: 100,
  },
  {
    type: "tap_120",
    name: "Finger Fury",
    description: "Tap 120 times in 10 seconds",
    icon: "fire",
    category: "game",
    rarity: "epic",
    threshold: 120,
  },
];

/**
 * Reset test state
 */
function resetTestState(): void {
  grantedAchievements = new Map();
  userStats = new Map();
}

/**
 * Get or create user stats
 */
function getOrCreateUserStats(userId: string): UserStats {
  if (!userStats.has(userId)) {
    userStats.set(userId, {
      gamesPlayed: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
      totalWins: 0,
      totalLosses: 0,
      gameScores: {},
    });
  }
  return userStats.get(userId)!;
}

/**
 * Check if user already has achievement
 */
function hasAchievement(userId: string, achievementId: string): boolean {
  const userAchievements = grantedAchievements.get(userId);
  return userAchievements?.has(achievementId) ?? false;
}

/**
 * Grant achievement to user
 */
function grantAchievement(
  userId: string,
  achievementId: string,
): GrantedAchievement | null {
  if (hasAchievement(userId, achievementId)) {
    return null; // Already has it
  }

  if (!grantedAchievements.has(userId)) {
    grantedAchievements.set(userId, new Set());
  }

  grantedAchievements.get(userId)!.add(achievementId);
  return { id: achievementId, grantedAt: Date.now() };
}

/**
 * Check and grant achievements based on context
 */
async function checkAndGrantAchievements(
  userId: string,
  context: AchievementContext,
): Promise<GrantedAchievement[]> {
  const granted: GrantedAchievement[] = [];
  const stats = getOrCreateUserStats(userId);

  // Update stats
  stats.gamesPlayed++;

  if (context.gameType) {
    if (!stats.gameScores[context.gameType]) {
      stats.gameScores[context.gameType] = [];
    }
    if (context.score !== undefined) {
      stats.gameScores[context.gameType].push(context.score);
    }
  }

  // Check reaction achievements
  if (
    context.gameType === "reaction_tap" &&
    context.reactionTime !== undefined
  ) {
    if (context.reactionTime <= 200) {
      const result = grantAchievement(userId, "reaction_master");
      if (result) granted.push(result);
    }
    if (context.reactionTime <= 150) {
      const result = grantAchievement(userId, "reaction_god");
      if (result) granted.push(result);
    }
  }

  // Check timed tap achievements
  if (context.gameType === "timed_tap" && context.tapCount !== undefined) {
    if (context.tapCount >= 100) {
      const result = grantAchievement(userId, "tap_100");
      if (result) granted.push(result);
    }
    if (context.tapCount >= 120) {
      const result = grantAchievement(userId, "tap_120");
      if (result) granted.push(result);
    }
  }

  // Check multiplayer achievements
  if (context.isMultiplayer) {
    if (context.isWinner) {
      stats.totalWins++;
      stats.currentWinStreak++;
      stats.bestWinStreak = Math.max(
        stats.bestWinStreak,
        stats.currentWinStreak,
      );

      // First win
      const firstWin = grantAchievement(userId, "mp_first_game");
      if (firstWin) granted.push(firstWin);

      // Win streaks
      if (stats.currentWinStreak >= 3) {
        const result = grantAchievement(userId, "mp_win_streak_3");
        if (result) granted.push(result);
      }
      if (stats.currentWinStreak >= 5) {
        const result = grantAchievement(userId, "mp_win_streak_5");
        if (result) granted.push(result);
      }
      if (stats.currentWinStreak >= 10) {
        const result = grantAchievement(userId, "mp_win_streak_10");
        if (result) granted.push(result);
      }
    } else {
      stats.totalLosses++;
      stats.currentWinStreak = 0; // Reset streak on loss
    }
  }

  return granted;
}

/**
 * Get user multiplayer stats
 */
async function getUserMultiplayerStats(userId: string): Promise<UserStats> {
  return getOrCreateUserStats(userId);
}

// =============================================================================
// Tests
// =============================================================================

describe("Achievement Triggers", () => {
  beforeEach(() => {
    resetTestState();
  });

  // ===========================================================================
  // Multiplayer Achievement Tests
  // ===========================================================================

  describe("Multiplayer Achievements", () => {
    it("should grant first win achievement", async () => {
      const context: AchievementContext = {
        userId: "user1",
        gameType: "chess",
        isMultiplayer: true,
        isWinner: true,
      };

      const granted = await checkAndGrantAchievements("user1", context);

      expect(granted.some((a) => a.id === "mp_first_game")).toBe(true);
    });

    it("should not grant first win on loss", async () => {
      const context: AchievementContext = {
        userId: "user1",
        gameType: "chess",
        isMultiplayer: true,
        isWinner: false,
      };

      const granted = await checkAndGrantAchievements("user1", context);

      expect(granted.some((a) => a.id === "mp_first_game")).toBe(false);
    });

    it("should track win streak correctly", async () => {
      for (let i = 0; i < 5; i++) {
        await checkAndGrantAchievements("user1", {
          userId: "user1",
          gameType: "chess",
          isMultiplayer: true,
          isWinner: true,
        });
      }

      const stats = await getUserMultiplayerStats("user1");
      expect(stats.currentWinStreak).toBe(5);
      expect(stats.totalWins).toBe(5);
    });

    it("should reset win streak on loss", async () => {
      // Win 3
      for (let i = 0; i < 3; i++) {
        await checkAndGrantAchievements("user1", {
          userId: "user1",
          gameType: "chess",
          isMultiplayer: true,
          isWinner: true,
        });
      }

      // Lose 1
      await checkAndGrantAchievements("user1", {
        userId: "user1",
        gameType: "chess",
        isMultiplayer: true,
        isWinner: false,
      });

      const stats = await getUserMultiplayerStats("user1");
      expect(stats.currentWinStreak).toBe(0);
      expect(stats.totalWins).toBe(3);
      expect(stats.totalLosses).toBe(1);
    });

    it("should preserve best win streak after loss", async () => {
      // Win 5
      for (let i = 0; i < 5; i++) {
        await checkAndGrantAchievements("user1", {
          userId: "user1",
          gameType: "chess",
          isMultiplayer: true,
          isWinner: true,
        });
      }

      // Lose 1
      await checkAndGrantAchievements("user1", {
        userId: "user1",
        gameType: "chess",
        isMultiplayer: true,
        isWinner: false,
      });

      // Win 2 more
      for (let i = 0; i < 2; i++) {
        await checkAndGrantAchievements("user1", {
          userId: "user1",
          gameType: "chess",
          isMultiplayer: true,
          isWinner: true,
        });
      }

      const stats = await getUserMultiplayerStats("user1");
      expect(stats.currentWinStreak).toBe(2);
      expect(stats.bestWinStreak).toBe(5);
    });

    it("should grant streak achievements at correct thresholds", async () => {
      const allGranted: GrantedAchievement[] = [];

      for (let i = 0; i < 5; i++) {
        const granted = await checkAndGrantAchievements("user1", {
          userId: "user1",
          gameType: "chess",
          isMultiplayer: true,
          isWinner: true,
        });
        allGranted.push(...granted);
      }

      expect(allGranted.some((a) => a.id === "mp_first_game")).toBe(true);
      expect(allGranted.some((a) => a.id === "mp_win_streak_3")).toBe(true);
      expect(allGranted.some((a) => a.id === "mp_win_streak_5")).toBe(true);
      expect(allGranted.some((a) => a.id === "mp_win_streak_10")).toBe(false);
    });
  });

  // ===========================================================================
  // Reaction Game Achievement Tests
  // ===========================================================================

  describe("Reaction Game Achievements", () => {
    it("should grant achievement for fast reaction", async () => {
      const context: AchievementContext = {
        userId: "user1",
        gameType: "reaction_tap",
        reactionTime: 180,
      };

      const granted = await checkAndGrantAchievements("user1", context);

      expect(granted.some((a) => a.id === "reaction_master")).toBe(true);
    });

    it("should grant both achievements for very fast reaction", async () => {
      const context: AchievementContext = {
        userId: "user1",
        gameType: "reaction_tap",
        reactionTime: 140,
      };

      const granted = await checkAndGrantAchievements("user1", context);

      expect(granted.some((a) => a.id === "reaction_master")).toBe(true);
      expect(granted.some((a) => a.id === "reaction_god")).toBe(true);
    });

    it("should not grant achievement for slow reaction", async () => {
      const context: AchievementContext = {
        userId: "user1",
        gameType: "reaction_tap",
        reactionTime: 300,
      };

      const granted = await checkAndGrantAchievements("user1", context);

      expect(granted.some((a) => a.id === "reaction_master")).toBe(false);
    });

    it("should grant at exactly threshold", async () => {
      const context: AchievementContext = {
        userId: "user1",
        gameType: "reaction_tap",
        reactionTime: 200, // Exactly at threshold
      };

      const granted = await checkAndGrantAchievements("user1", context);

      expect(granted.some((a) => a.id === "reaction_master")).toBe(true);
    });
  });

  // ===========================================================================
  // Timed Tap Achievement Tests
  // ===========================================================================

  describe("Timed Tap Achievements", () => {
    it("should grant achievement for 100+ taps", async () => {
      const context: AchievementContext = {
        userId: "user1",
        gameType: "timed_tap",
        tapCount: 105,
      };

      const granted = await checkAndGrantAchievements("user1", context);

      expect(granted.some((a) => a.id === "tap_100")).toBe(true);
      expect(granted.some((a) => a.id === "tap_120")).toBe(false);
    });

    it("should grant both achievements for 120+ taps", async () => {
      const context: AchievementContext = {
        userId: "user1",
        gameType: "timed_tap",
        tapCount: 125,
      };

      const granted = await checkAndGrantAchievements("user1", context);

      expect(granted.some((a) => a.id === "tap_100")).toBe(true);
      expect(granted.some((a) => a.id === "tap_120")).toBe(true);
    });

    it("should not grant achievement for < 100 taps", async () => {
      const context: AchievementContext = {
        userId: "user1",
        gameType: "timed_tap",
        tapCount: 85,
      };

      const granted = await checkAndGrantAchievements("user1", context);

      expect(granted.length).toBe(0);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("Edge Cases", () => {
    it("should handle multiple users independently", async () => {
      await checkAndGrantAchievements("user1", {
        userId: "user1",
        gameType: "reaction_tap",
        reactionTime: 180,
      });

      await checkAndGrantAchievements("user2", {
        userId: "user2",
        gameType: "reaction_tap",
        reactionTime: 250,
      });

      expect(hasAchievement("user1", "reaction_master")).toBe(true);
      expect(hasAchievement("user2", "reaction_master")).toBe(false);
    });

    it("should handle missing optional fields", async () => {
      const context: AchievementContext = {
        userId: "user1",
        // No gameType, score, etc.
      };

      // Should not throw
      const granted = await checkAndGrantAchievements("user1", context);
      expect(granted).toEqual([]);
    });

    it("should track games played across all game types", async () => {
      await checkAndGrantAchievements("user1", {
        userId: "user1",
        gameType: "reaction_tap",
        reactionTime: 190,
      });

      await checkAndGrantAchievements("user1", {
        userId: "user1",
        gameType: "chess",
        isMultiplayer: true,
        isWinner: true,
      });

      const stats = await getUserMultiplayerStats("user1");
      expect(stats.gamesPlayed).toBe(2);
    });
  });
});
