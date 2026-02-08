/**
 * Game Achievements Service
 *
 * Handles game-related achievements including:
 * - Achievement definitions
 * - Progress tracking
 * - Unlocking achievements
 * - Reward distribution
 *
 * @see docs/07_GAMES_ARCHITECTURE.md Section 4
 */

import { getGameAchievementById } from "@/data/gameAchievements";
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { checkAndGrantBadgeForAchievement } from "./badges";
import { getFirestoreInstance } from "./firebase";
import { StatsGameType } from "./gameStats";

// Lazy getter to avoid calling getFirestoreInstance at module load time
const getDb = () => getFirestoreInstance();

// =============================================================================
// Types
// =============================================================================

/**
 * Achievement rarity/difficulty tiers
 */
export type AchievementTier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond";

/**
 * Achievement category
 */
export type AchievementCategory =
  | "general" // Cross-game achievements
  | "single_player" // Single-player game achievements
  | "multiplayer" // Multiplayer achievements
  | "social" // Social/friend achievements
  | "daily" // Daily challenge achievements
  | "special"; // Limited-time or secret achievements

/**
 * Achievement trigger type
 */
export type AchievementTrigger =
  | "game_count" // Play X games
  | "win_count" // Win X games
  | "score" // Reach score threshold
  | "streak" // Maintain streak
  | "rating" // Reach rating threshold
  | "perfect" // Perfect game (no mistakes)
  | "speed" // Complete in time
  | "combo" // Achieve combo
  | "collection" // Collect items
  | "social" // Friend-related
  | "daily" // Daily challenge
  | "custom"; // Custom condition

/**
 * Achievement definition
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;

  // Classification
  tier: AchievementTier;
  category: AchievementCategory;

  // Requirements
  trigger: AchievementTrigger;
  gameType?: StatsGameType; // If game-specific
  threshold: number;

  // Rewards
  coinReward: number;
  xpReward: number;

  // Metadata
  hidden: boolean; // Secret achievement
  order: number; // Display order

  // Date restrictions
  availableFrom?: Timestamp;
  availableUntil?: Timestamp;
}

/**
 * Player's achievement progress
 */
export interface AchievementProgress {
  achievementId: string;
  playerId: string;

  // Progress
  currentValue: number;
  threshold: number;
  percentComplete: number;

  // Status
  unlocked: boolean;
  unlockedAt?: Timestamp;

  // Rewards
  rewardsClaimed: boolean;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Player's achievements document
 */
export interface PlayerAchievementsDocument {
  playerId: string;

  // Progress for each achievement
  progress: Record<string, AchievementProgress>;

  // Summary
  totalUnlocked: number;
  totalAvailable: number;

  // By tier
  unlockedByTier: Record<AchievementTier, number>;

  // Rewards
  totalCoinsEarned: number;
  totalXpEarned: number;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Achievement check result
 */
export interface AchievementCheckResult {
  achievementId: string;
  unlocked: boolean;
  previousValue: number;
  newValue: number;
  threshold: number;
  rewards?: {
    coins: number;
    xp: number;
  };
}

// =============================================================================
// Achievement Definitions
// =============================================================================

/**
 * All game achievements
 */
export const GAME_ACHIEVEMENTS: Achievement[] = [
  // ===== General (Cross-Game) =====
  {
    id: "first_game",
    name: "First Steps",
    description: "Play your first game",
    icon: "🎮",
    tier: "bronze",
    category: "general",
    trigger: "game_count",
    threshold: 1,
    coinReward: 10,
    xpReward: 25,
    hidden: false,
    order: 1,
  },
  {
    id: "games_10",
    name: "Getting Started",
    description: "Play 10 games",
    icon: "🎲",
    tier: "bronze",
    category: "general",
    trigger: "game_count",
    threshold: 10,
    coinReward: 25,
    xpReward: 50,
    hidden: false,
    order: 2,
  },
  {
    id: "games_50",
    name: "Regular Player",
    description: "Play 50 games",
    icon: "🎯",
    tier: "silver",
    category: "general",
    trigger: "game_count",
    threshold: 50,
    coinReward: 50,
    xpReward: 100,
    hidden: false,
    order: 3,
  },
  {
    id: "games_100",
    name: "Dedicated Gamer",
    description: "Play 100 games",
    icon: "🏆",
    tier: "gold",
    category: "general",
    trigger: "game_count",
    threshold: 100,
    coinReward: 100,
    xpReward: 250,
    hidden: false,
    order: 4,
  },
  {
    id: "games_500",
    name: "Game Master",
    description: "Play 500 games",
    icon: "👑",
    tier: "platinum",
    category: "general",
    trigger: "game_count",
    threshold: 500,
    coinReward: 250,
    xpReward: 500,
    hidden: false,
    order: 5,
  },
  {
    id: "games_1000",
    name: "Legendary Player",
    description: "Play 1000 games",
    icon: "💎",
    tier: "diamond",
    category: "general",
    trigger: "game_count",
    threshold: 1000,
    coinReward: 500,
    xpReward: 1000,
    hidden: false,
    order: 6,
  },

  // ===== Multiplayer =====
  {
    id: "first_win",
    name: "Victory!",
    description: "Win your first multiplayer game",
    icon: "🥇",
    tier: "bronze",
    category: "multiplayer",
    trigger: "win_count",
    threshold: 1,
    coinReward: 15,
    xpReward: 30,
    hidden: false,
    order: 10,
  },
  {
    id: "wins_10",
    name: "Winner",
    description: "Win 10 multiplayer games",
    icon: "🏅",
    tier: "silver",
    category: "multiplayer",
    trigger: "win_count",
    threshold: 10,
    coinReward: 50,
    xpReward: 100,
    hidden: false,
    order: 11,
  },
  {
    id: "wins_50",
    name: "Champion",
    description: "Win 50 multiplayer games",
    icon: "🏆",
    tier: "gold",
    category: "multiplayer",
    trigger: "win_count",
    threshold: 50,
    coinReward: 150,
    xpReward: 300,
    hidden: false,
    order: 12,
  },
  {
    id: "win_streak_3",
    name: "On Fire",
    description: "Win 3 games in a row",
    icon: "🔥",
    tier: "bronze",
    category: "multiplayer",
    trigger: "streak",
    threshold: 3,
    coinReward: 25,
    xpReward: 50,
    hidden: false,
    order: 15,
  },
  {
    id: "win_streak_5",
    name: "Unstoppable",
    description: "Win 5 games in a row",
    icon: "⚡",
    tier: "silver",
    category: "multiplayer",
    trigger: "streak",
    threshold: 5,
    coinReward: 75,
    xpReward: 150,
    hidden: false,
    order: 16,
  },
  {
    id: "win_streak_10",
    name: "Legendary Streak",
    description: "Win 10 games in a row",
    icon: "🌟",
    tier: "gold",
    category: "multiplayer",
    trigger: "streak",
    threshold: 10,
    coinReward: 200,
    xpReward: 400,
    hidden: false,
    order: 17,
  },

  // ===== Rating Achievements =====
  {
    id: "rating_1300",
    name: "Rising Star",
    description: "Reach 1300 rating in any game",
    icon: "⭐",
    tier: "bronze",
    category: "multiplayer",
    trigger: "rating",
    threshold: 1300,
    coinReward: 50,
    xpReward: 100,
    hidden: false,
    order: 20,
  },
  {
    id: "rating_1500",
    name: "Expert",
    description: "Reach 1500 rating in any game",
    icon: "🌟",
    tier: "silver",
    category: "multiplayer",
    trigger: "rating",
    threshold: 1500,
    coinReward: 100,
    xpReward: 200,
    hidden: false,
    order: 21,
  },
  {
    id: "rating_1800",
    name: "Master",
    description: "Reach 1800 rating in any game",
    icon: "💫",
    tier: "gold",
    category: "multiplayer",
    trigger: "rating",
    threshold: 1800,
    coinReward: 200,
    xpReward: 400,
    hidden: false,
    order: 22,
  },
  {
    id: "rating_2000",
    name: "Grandmaster",
    description: "Reach 2000 rating in any game",
    icon: "👑",
    tier: "platinum",
    category: "multiplayer",
    trigger: "rating",
    threshold: 2000,
    coinReward: 500,
    xpReward: 1000,
    hidden: false,
    order: 23,
  },

  // ===== Flappy Bird =====
  {
    id: "flappy_first_10",
    name: "Flappy Fingers",
    description: "Score 10 in Flappy Bird",
    icon: "🐦",
    tier: "bronze",
    category: "single_player",
    trigger: "score",
    gameType: "flappy_bird",
    threshold: 10,
    coinReward: 15,
    xpReward: 30,
    hidden: false,
    order: 30,
  },
  {
    id: "flappy_score_25",
    name: "Pipe Master",
    description: "Score 25 in Flappy Bird",
    icon: "🎯",
    tier: "silver",
    category: "single_player",
    trigger: "score",
    gameType: "flappy_bird",
    threshold: 25,
    coinReward: 50,
    xpReward: 100,
    hidden: false,
    order: 31,
  },
  {
    id: "flappy_score_50",
    name: "Flappy Legend",
    description: "Score 50 in Flappy Bird",
    icon: "🏆",
    tier: "gold",
    category: "single_player",
    trigger: "score",
    gameType: "flappy_bird",
    threshold: 50,
    coinReward: 150,
    xpReward: 300,
    hidden: false,
    order: 32,
  },
  {
    id: "flappy_perfect_10",
    name: "Perfect Flight",
    description: "Score 10 perfect passes in one game",
    icon: "✨",
    tier: "gold",
    category: "single_player",
    trigger: "perfect",
    gameType: "flappy_bird",
    threshold: 10,
    coinReward: 100,
    xpReward: 200,
    hidden: false,
    order: 33,
  },

  // ===== Chess =====
  {
    id: "chess_first_win",
    name: "Chess Beginner",
    description: "Win your first chess game",
    icon: "♟️",
    tier: "bronze",
    category: "multiplayer",
    trigger: "win_count",
    gameType: "chess",
    threshold: 1,
    coinReward: 20,
    xpReward: 40,
    hidden: false,
    order: 40,
  },
  {
    id: "chess_wins_10",
    name: "Chess Player",
    description: "Win 10 chess games",
    icon: "♞",
    tier: "silver",
    category: "multiplayer",
    trigger: "win_count",
    gameType: "chess",
    threshold: 10,
    coinReward: 75,
    xpReward: 150,
    hidden: false,
    order: 41,
  },
  {
    id: "chess_wins_50",
    name: "Chess Master",
    description: "Win 50 chess games",
    icon: "♛",
    tier: "gold",
    category: "multiplayer",
    trigger: "win_count",
    gameType: "chess",
    threshold: 50,
    coinReward: 200,
    xpReward: 400,
    hidden: false,
    order: 42,
  },

  // ===== Pool =====
  {
    id: "pool_first_win",
    name: "Rookie Shooter",
    description: "Win your first pool game",
    icon: "🎱",
    tier: "bronze",
    category: "multiplayer",
    trigger: "win_count",
    gameType: "8ball_pool",
    threshold: 1,
    coinReward: 20,
    xpReward: 40,
    hidden: false,
    order: 50,
  },
  {
    id: "pool_wins_10",
    name: "Pool Shark",
    description: "Win 10 pool games",
    icon: "🦈",
    tier: "silver",
    category: "multiplayer",
    trigger: "win_count",
    gameType: "8ball_pool",
    threshold: 10,
    coinReward: 75,
    xpReward: 150,
    hidden: false,
    order: 51,
  },
  {
    id: "pool_perfect",
    name: "Run the Table",
    description: "Win without opponent potting any balls",
    icon: "🏆",
    tier: "gold",
    category: "multiplayer",
    trigger: "perfect",
    gameType: "8ball_pool",
    threshold: 1,
    coinReward: 150,
    xpReward: 300,
    hidden: false,
    order: 52,
  },

  // ===== Daily Challenge =====
  {
    id: "daily_first",
    name: "Daily Challenger",
    description: "Complete your first daily puzzle",
    icon: "📅",
    tier: "bronze",
    category: "daily",
    trigger: "daily",
    threshold: 1,
    coinReward: 10,
    xpReward: 25,
    hidden: false,
    order: 60,
  },
  {
    id: "daily_streak_7",
    name: "Week Warrior",
    description: "Complete daily puzzles 7 days in a row",
    icon: "🔥",
    tier: "silver",
    category: "daily",
    trigger: "streak",
    threshold: 7,
    coinReward: 100,
    xpReward: 200,
    hidden: false,
    order: 61,
  },
  {
    id: "daily_streak_30",
    name: "Monthly Master",
    description: "Complete daily puzzles 30 days in a row",
    icon: "🌟",
    tier: "gold",
    category: "daily",
    trigger: "streak",
    threshold: 30,
    coinReward: 300,
    xpReward: 600,
    hidden: false,
    order: 62,
  },

  // ===== Social =====
  {
    id: "social_first_invite",
    name: "Friendly Challenge",
    description: "Send your first game invite",
    icon: "📨",
    tier: "bronze",
    category: "social",
    trigger: "social",
    threshold: 1,
    coinReward: 10,
    xpReward: 25,
    hidden: false,
    order: 70,
  },
  {
    id: "social_play_friends_10",
    name: "Social Gamer",
    description: "Play 10 games with friends",
    icon: "👥",
    tier: "silver",
    category: "social",
    trigger: "social",
    threshold: 10,
    coinReward: 50,
    xpReward: 100,
    hidden: false,
    order: 71,
  },

  // ===== Secret Achievements =====
  {
    id: "comeback_king",
    name: "Comeback King",
    description: "Win a game after being 5+ pieces behind",
    icon: "👑",
    tier: "gold",
    category: "special",
    trigger: "custom",
    threshold: 1,
    coinReward: 200,
    xpReward: 400,
    hidden: true,
    order: 100,
  },
  {
    id: "speed_demon",
    name: "Speed Demon",
    description: "Win a chess game in under 20 moves",
    icon: "⚡",
    tier: "gold",
    category: "special",
    trigger: "speed",
    gameType: "chess",
    threshold: 20,
    coinReward: 150,
    xpReward: 300,
    hidden: true,
    order: 101,
  },
];

// =============================================================================
// Constants
// =============================================================================

const COLLECTION_NAME = "PlayerAchievements";
const ACHIEVEMENTS_DEF_COLLECTION = "AchievementDefinitions";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create empty achievements document
 */
function createEmptyAchievementsDocument(
  playerId: string,
): PlayerAchievementsDocument {
  return {
    playerId,
    progress: {},
    totalUnlocked: 0,
    totalAvailable: GAME_ACHIEVEMENTS.filter((a) => !a.hidden).length,
    unlockedByTier: {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      diamond: 0,
    },
    totalCoinsEarned: 0,
    totalXpEarned: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

/**
 * Get achievement by ID
 */
export function getAchievementById(id: string): Achievement | undefined {
  return GAME_ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(
  category: AchievementCategory,
): Achievement[] {
  return GAME_ACHIEVEMENTS.filter((a) => a.category === category);
}

/**
 * Get achievements for a specific game
 */
export function getAchievementsForGame(gameType: StatsGameType): Achievement[] {
  return GAME_ACHIEVEMENTS.filter(
    (a) => a.gameType === gameType || a.gameType === undefined,
  );
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get or create player achievements document
 */
export async function getOrCreatePlayerAchievements(
  playerId: string,
): Promise<PlayerAchievementsDocument> {
  const docRef = doc(getDb(), COLLECTION_NAME, playerId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as PlayerAchievementsDocument;
  }

  const newDoc = createEmptyAchievementsDocument(playerId);
  await setDoc(docRef, newDoc);

  return newDoc;
}

/**
 * Check and update achievement progress
 */
export async function checkAchievement(
  playerId: string,
  achievementId: string,
  newValue: number,
): Promise<AchievementCheckResult> {
  // Try legacy achievement system first
  let achievement = getAchievementById(achievementId);

  // If not found, try new achievement system
  if (!achievement) {
    const newAchievement = getGameAchievementById(achievementId);
    if (newAchievement) {
      // Map new trigger types to legacy trigger types
      const triggerTypeMap: Record<string, AchievementTrigger> = {
        game_played: "game_count",
        multiplayer_game: "game_count",
        multiplayer_win: "win_count",
        multiplayer_win_streak: "streak",
        chess_win: "win_count",
        chess_rating: "rating",
        checkers_win: "win_count",
        tic_tac_toe_win: "win_count",
        crazy_eights_win: "win_count",
        score_reached: "score",
        flappy_score: "score",
        bounce_round: "score",
        snake_score: "score",
        "2048_score": "score",
        "2048_tile": "score",
        game_streak: "streak",
      };

      const legacyTrigger =
        triggerTypeMap[newAchievement.trigger.type] || "custom";

      // Convert new format to legacy format for compatibility
      achievement = {
        id: newAchievement.id,
        name: newAchievement.name,
        description: newAchievement.description,
        icon: newAchievement.icon,
        tier: newAchievement.tier,
        category: newAchievement.category as AchievementCategory,
        trigger: legacyTrigger,
        threshold:
          newAchievement.progressTarget ??
          newAchievement.trigger.conditions?.count ??
          1,
        coinReward: newAchievement.coinReward,
        xpReward: newAchievement.xpReward,
        hidden: newAchievement.secret,
        order: 0,
      };
    }
  }

  if (!achievement) {
    throw new Error(`Achievement ${achievementId} not found`);
  }

  const docRef = doc(getDb(), COLLECTION_NAME, playerId);

  const result = await runTransaction(getDb(), async (transaction) => {
    const docSnap = await transaction.get(docRef);

    let achievementsDoc: PlayerAchievementsDocument;

    if (docSnap.exists()) {
      achievementsDoc = docSnap.data() as PlayerAchievementsDocument;
    } else {
      achievementsDoc = createEmptyAchievementsDocument(playerId);
    }

    // Get or create progress
    let progress = achievementsDoc.progress[achievementId];
    const previousValue = progress?.currentValue ?? 0;

    if (!progress) {
      progress = {
        achievementId,
        playerId,
        currentValue: 0,
        threshold: achievement.threshold,
        percentComplete: 0,
        unlocked: false,
        rewardsClaimed: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
    }

    // Update progress
    progress.currentValue = Math.max(progress.currentValue, newValue);
    progress.percentComplete = Math.min(
      100,
      (progress.currentValue / progress.threshold) * 100,
    );
    progress.updatedAt = Timestamp.now();

    let rewards: { coins: number; xp: number } | undefined;

    // Check if newly unlocked
    if (!progress.unlocked && progress.currentValue >= progress.threshold) {
      progress.unlocked = true;
      progress.unlockedAt = Timestamp.now();

      // Update summary
      achievementsDoc.totalUnlocked++;
      achievementsDoc.unlockedByTier[achievement.tier]++;

      // Prepare rewards (will be claimed separately or automatically)
      rewards = {
        coins: achievement.coinReward,
        xp: achievement.xpReward,
      };
    }

    achievementsDoc.progress[achievementId] = progress;
    achievementsDoc.updatedAt = Timestamp.now();

    transaction.set(docRef, achievementsDoc);

    return {
      achievementId,
      unlocked: progress.unlocked && previousValue < progress.threshold,
      previousValue,
      newValue: progress.currentValue,
      threshold: progress.threshold,
      rewards,
    };
  });

  // Check if achievement was newly unlocked and grant associated badge
  if (result.unlocked) {
    try {
      const badge = await checkAndGrantBadgeForAchievement(
        playerId,
        achievementId,
      );
      if (badge) {
        console.log(
          "[gameAchievements] Badge granted for achievement:",
          achievementId,
          "->",
          badge.id,
        );
      }
    } catch (error) {
      // Log but don't fail the achievement unlock if badge grant fails
      console.error("[gameAchievements] Failed to grant badge:", error);
    }
  }

  return result;
}

/**
 * Check multiple achievements at once
 */
export async function checkAchievements(
  playerId: string,
  checks: Array<{ achievementId: string; value: number }>,
): Promise<AchievementCheckResult[]> {
  const results: AchievementCheckResult[] = [];

  for (const check of checks) {
    const result = await checkAchievement(
      playerId,
      check.achievementId,
      check.value,
    );
    results.push(result);
  }

  return results;
}

/**
 * Claim rewards for an achievement
 */
export async function claimAchievementRewards(
  playerId: string,
  achievementId: string,
): Promise<{ coins: number; xp: number }> {
  const achievement = getAchievementById(achievementId);

  if (!achievement) {
    throw new Error(`Achievement ${achievementId} not found`);
  }

  const docRef = doc(getDb(), COLLECTION_NAME, playerId);

  return await runTransaction(getDb(), async (transaction) => {
    const docSnap = await transaction.get(docRef);

    if (!docSnap.exists()) {
      throw new Error("Achievements not found");
    }

    const achievementsDoc = docSnap.data() as PlayerAchievementsDocument;
    const progress = achievementsDoc.progress[achievementId];

    if (!progress || !progress.unlocked) {
      throw new Error("Achievement not unlocked");
    }

    if (progress.rewardsClaimed) {
      throw new Error("Rewards already claimed");
    }

    // Mark as claimed
    progress.rewardsClaimed = true;
    achievementsDoc.progress[achievementId] = progress;
    achievementsDoc.totalCoinsEarned += achievement.coinReward;
    achievementsDoc.totalXpEarned += achievement.xpReward;
    achievementsDoc.updatedAt = Timestamp.now();

    transaction.set(docRef, achievementsDoc);

    return {
      coins: achievement.coinReward,
      xp: achievement.xpReward,
    };
  });
}

/**
 * Get player's achievement progress
 */
export async function getPlayerAchievementProgress(
  playerId: string,
): Promise<AchievementProgress[]> {
  const achievementsDoc = await getOrCreatePlayerAchievements(playerId);
  return Object.values(achievementsDoc.progress);
}

/**
 * Get unlocked achievements for player
 */
export async function getUnlockedAchievements(
  playerId: string,
): Promise<Array<Achievement & { unlockedAt: Timestamp }>> {
  const achievementsDoc = await getOrCreatePlayerAchievements(playerId);

  const unlocked: Array<Achievement & { unlockedAt: Timestamp }> = [];

  for (const [id, progress] of Object.entries(achievementsDoc.progress)) {
    if (progress.unlocked && progress.unlockedAt) {
      const achievement = getAchievementById(id);
      if (achievement) {
        unlocked.push({
          ...achievement,
          unlockedAt: progress.unlockedAt,
        });
      }
    }
  }

  return unlocked.sort(
    (a, b) => b.unlockedAt.toMillis() - a.unlockedAt.toMillis(),
  );
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to player's achievements
 */
export function subscribeToPlayerAchievements(
  playerId: string,
  onUpdate: (achievements: PlayerAchievementsDocument) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const docRef = doc(getDb(), COLLECTION_NAME, playerId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(createEmptyAchievementsDocument(playerId));
        return;
      }
      onUpdate(snapshot.data() as PlayerAchievementsDocument);
    },
    (error) => {
      console.error("[Achievements] Subscription error:", error);
      onError?.(error);
    },
  );
}

// =============================================================================
// Achievement Checking Helpers
// =============================================================================

/**
 * Check game count achievements
 */
export async function checkGameCountAchievements(
  playerId: string,
  totalGames: number,
): Promise<AchievementCheckResult[]> {
  const gameCountAchievements = GAME_ACHIEVEMENTS.filter(
    (a) => a.trigger === "game_count" && !a.gameType,
  );

  const checks = gameCountAchievements.map((a) => ({
    achievementId: a.id,
    value: totalGames,
  }));

  return checkAchievements(playerId, checks);
}

/**
 * Check win count achievements
 */
export async function checkWinCountAchievements(
  playerId: string,
  totalWins: number,
  gameType?: StatsGameType,
): Promise<AchievementCheckResult[]> {
  const winAchievements = GAME_ACHIEVEMENTS.filter(
    (a) =>
      a.trigger === "win_count" &&
      (a.gameType === gameType || (!a.gameType && !gameType)),
  );

  const checks = winAchievements.map((a) => ({
    achievementId: a.id,
    value: totalWins,
  }));

  return checkAchievements(playerId, checks);
}

/**
 * Check score achievements
 */
export async function checkScoreAchievements(
  playerId: string,
  score: number,
  gameType: StatsGameType,
): Promise<AchievementCheckResult[]> {
  const scoreAchievements = GAME_ACHIEVEMENTS.filter(
    (a) => a.trigger === "score" && a.gameType === gameType,
  );

  const checks = scoreAchievements.map((a) => ({
    achievementId: a.id,
    value: score,
  }));

  return checkAchievements(playerId, checks);
}

/**
 * Check win streak achievements
 */
export async function checkStreakAchievements(
  playerId: string,
  currentStreak: number,
): Promise<AchievementCheckResult[]> {
  const streakAchievements = GAME_ACHIEVEMENTS.filter(
    (a) => a.trigger === "streak" && a.category === "multiplayer",
  );

  const checks = streakAchievements.map((a) => ({
    achievementId: a.id,
    value: currentStreak,
  }));

  return checkAchievements(playerId, checks);
}

/**
 * Check rating achievements
 */
export async function checkRatingAchievements(
  playerId: string,
  peakRating: number,
): Promise<AchievementCheckResult[]> {
  const ratingAchievements = GAME_ACHIEVEMENTS.filter(
    (a) => a.trigger === "rating",
  );

  const checks = ratingAchievements.map((a) => ({
    achievementId: a.id,
    value: peakRating,
  }));

  return checkAchievements(playerId, checks);
}

// =============================================================================
// Export
// =============================================================================

export const gameAchievements = {
  // Definitions
  getById: getAchievementById,
  getByCategory: getAchievementsByCategory,
  getForGame: getAchievementsForGame,
  all: GAME_ACHIEVEMENTS,

  // Core
  getOrCreate: getOrCreatePlayerAchievements,
  check: checkAchievement,
  checkMultiple: checkAchievements,
  claimRewards: claimAchievementRewards,
  getProgress: getPlayerAchievementProgress,
  getUnlocked: getUnlockedAchievements,

  // Subscriptions
  subscribe: subscribeToPlayerAchievements,

  // Helpers
  checkGameCount: checkGameCountAchievements,
  checkWinCount: checkWinCountAchievements,
  checkScore: checkScoreAchievements,
  checkStreak: checkStreakAchievements,
  checkRating: checkRatingAchievements,
};

export default gameAchievements;
