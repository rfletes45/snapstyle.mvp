/**
 * Achievements Service
 *
 * Handles:
 * - Achievement definitions (static data)
 * - Fetching user achievements
 * - Granting achievements (via Cloud Function preferred)
 * - Achievement progress tracking
 */

import {
  Achievement,
  AchievementDefinition,
  AchievementType,
  GameType,
} from "@/types/models";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/achievements");
// =============================================================================
// Achievement Definitions (Static Data)
// =============================================================================

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Game achievements
  {
    type: "game_first_play",
    name: "First Game",
    description: "Play your first game",
    icon: "gamepad-variant",
    category: "game",
    rarity: "common",
  },
  {
    type: "game_reaction_master",
    name: "Lightning Reflexes",
    description: "Achieve a reaction time under 200ms",
    icon: "lightning-bolt",
    category: "game",
    rarity: "epic",
    threshold: 200,
  },
  {
    type: "game_speed_demon",
    name: "Speed Demon",
    description: "Tap 100 times in 10 seconds",
    icon: "fire",
    category: "game",
    rarity: "rare",
    threshold: 100,
  },
  {
    type: "game_10_sessions",
    name: "Getting Started",
    description: "Play 10 games",
    icon: "numeric-10-circle",
    category: "game",
    rarity: "common",
    threshold: 10,
  },
  {
    type: "game_50_sessions",
    name: "Dedicated Gamer",
    description: "Play 50 games",
    icon: "star-circle",
    category: "game",
    rarity: "rare",
    threshold: 50,
  },

  // Streak achievements
  {
    type: "streak_3_days",
    name: "Getting Warmed Up",
    description: "Maintain a 3-day streak",
    icon: "fire",
    category: "streak",
    rarity: "common",
    threshold: 3,
  },
  {
    type: "streak_7_days",
    name: "Week Warrior",
    description: "Maintain a 7-day streak",
    icon: "fire",
    category: "streak",
    rarity: "rare",
    threshold: 7,
  },
  {
    type: "streak_30_days",
    name: "Monthly Master",
    description: "Maintain a 30-day streak",
    icon: "fire",
    category: "streak",
    rarity: "epic",
    threshold: 30,
  },
  {
    type: "streak_100_days",
    name: "Streak Legend",
    description: "Maintain a 100-day streak",
    icon: "fire",
    category: "streak",
    rarity: "legendary",
    threshold: 100,
  },

  // Social achievements
  {
    type: "social_first_friend",
    name: "Making Friends",
    description: "Add your first friend",
    icon: "account-plus",
    category: "social",
    rarity: "common",
  },
  {
    type: "social_10_friends",
    name: "Social Butterfly",
    description: "Have 10 friends",
    icon: "account-group",
    category: "social",
    rarity: "rare",
    threshold: 10,
  },
  {
    type: "social_first_picture",
    name: "Say Cheese!",
    description: "Send your first picture",
    icon: "camera",
    category: "social",
    rarity: "common",
  },
  {
    type: "social_100_pictures",
    name: "Snapshot Pro",
    description: "Send 100 pictures",
    icon: "camera-burst",
    category: "social",
    rarity: "rare",
    threshold: 100,
  },
  {
    type: "social_first_story",
    name: "Storyteller",
    description: "Post your first story",
    icon: "book-open-variant",
    category: "social",
    rarity: "common",
  },

  // Collection achievements
  {
    type: "collection_first_cosmetic",
    name: "Style Starter",
    description: "Acquire your first cosmetic item",
    icon: "palette",
    category: "collection",
    rarity: "common",
  },
  {
    type: "collection_full_set",
    name: "Fashionista",
    description: "Acquire a complete cosmetic set",
    icon: "crown",
    category: "collection",
    rarity: "epic",
  },
];

// =============================================================================
// Fetch Achievements
// =============================================================================

/**
 * Get all achievements for a user
 */
export async function getUserAchievements(
  userId: string,
): Promise<Achievement[]> {
  const db = getFirestoreInstance();

  try {
    const achievementsRef = collection(db, "Users", userId, "Achievements");
    const q = query(achievementsRef, orderBy("earnedAt", "desc"));
    const snapshot = await getDocs(q);

    const achievements: Achievement[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: userId,
        type: data.type as AchievementType,
        earnedAt: data.earnedAt?.toMillis?.() || data.earnedAt || Date.now(),
        meta: data.meta,
      };
    });

    logger.info(
      `[achievements] Fetched ${achievements.length} achievements for user ${userId}`,
    );
    return achievements;
  } catch (error) {
    logger.error("[achievements] Error fetching user achievements:", error);
    return [];
  }
}

/**
 * Check if user has a specific achievement
 */
export async function hasAchievement(
  userId: string,
  achievementType: AchievementType,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    const achievementRef = doc(
      db,
      "Users",
      userId,
      "Achievements",
      achievementType,
    );
    const achievementSnap = await getDoc(achievementRef);
    return achievementSnap.exists();
  } catch (error) {
    logger.error("[achievements] Error checking achievement:", error);
    return false;
  }
}

/**
 * Get achievement progress for display
 * Returns a map of achievement type to progress percentage
 */
export async function getAchievementProgress(
  userId: string,
): Promise<Map<AchievementType, number>> {
  const progress = new Map<AchievementType, number>();
  const userAchievements = await getUserAchievements(userId);
  const earnedTypes = new Set(userAchievements.map((a) => a.type));

  // Mark earned achievements as 100%
  for (const achievement of userAchievements) {
    progress.set(achievement.type, 100);
  }

  // For unearned achievements, we'd need additional data
  // This would typically come from aggregated stats
  // For now, mark unearned as 0%
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (!earnedTypes.has(def.type)) {
      progress.set(def.type, 0);
    }
  }

  return progress;
}

// =============================================================================
// Grant Achievements (Client-side fallback)
// Prefer using Cloud Functions for these operations
// =============================================================================

/**
 * Grant an achievement to a user
 * Note: In production, this should primarily be done via Cloud Functions
 */
export async function grantAchievement(
  userId: string,
  achievementType: AchievementType,
  meta?: Achievement["meta"],
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    // Check if already earned
    const alreadyEarned = await hasAchievement(userId, achievementType);
    if (alreadyEarned) {
      logger.info(
        `[achievements] User ${userId} already has ${achievementType}`,
      );
      return false;
    }

    const achievementRef = doc(
      db,
      "Users",
      userId,
      "Achievements",
      achievementType,
    );

    const achievement: Omit<Achievement, "id"> = {
      uid: userId,
      type: achievementType,
      earnedAt: Date.now(),
      ...(meta && { meta }),
    };

    await setDoc(achievementRef, {
      ...achievement,
      earnedAt: Timestamp.now(),
    });

    logger.info(`[achievements] Granted ${achievementType} to user ${userId}`);
    return true;
  } catch (error) {
    logger.error("[achievements] Error granting achievement:", error);
    return false;
  }
}

/**
 * Check and grant game-related achievements based on score
 */
export async function checkGameAchievements(
  userId: string,
  gameId: GameType,
  score: number,
  totalGamesPlayed: number,
): Promise<AchievementType[]> {
  const granted: AchievementType[] = [];

  try {
    // First game achievement
    if (totalGamesPlayed === 1) {
      const success = await grantAchievement(userId, "game_first_play", {
        gameId,
      });
      if (success) granted.push("game_first_play");
    }

    // Session count achievements
    if (totalGamesPlayed >= 10) {
      const success = await grantAchievement(userId, "game_10_sessions");
      if (success) granted.push("game_10_sessions");
    }
    if (totalGamesPlayed >= 50) {
      const success = await grantAchievement(userId, "game_50_sessions");
      if (success) granted.push("game_50_sessions");
    }

    // Game-specific achievements
    if (gameId === "reaction_tap" && score < 200) {
      const success = await grantAchievement(userId, "game_reaction_master", {
        score,
        gameId,
      });
      if (success) granted.push("game_reaction_master");
    }

    if (gameId === "timed_tap" && score >= 100) {
      const success = await grantAchievement(userId, "game_speed_demon", {
        score,
        gameId,
      });
      if (success) granted.push("game_speed_demon");
    }

    return granted;
  } catch (error) {
    logger.error("[achievements] Error checking game achievements:", error);
    return granted;
  }
}

/**
 * Check and grant streak achievements
 */
export async function checkStreakAchievements(
  userId: string,
  streakCount: number,
): Promise<AchievementType[]> {
  const granted: AchievementType[] = [];

  try {
    const thresholds: [number, AchievementType][] = [
      [3, "streak_3_days"],
      [7, "streak_7_days"],
      [30, "streak_30_days"],
      [100, "streak_100_days"],
    ];

    for (const [threshold, achievementType] of thresholds) {
      if (streakCount >= threshold) {
        const success = await grantAchievement(userId, achievementType, {
          streakCount,
        });
        if (success) granted.push(achievementType);
      }
    }

    return granted;
  } catch (error) {
    logger.error("[achievements] Error checking streak achievements:", error);
    return granted;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get achievement definition by type
 */
export function getAchievementDefinition(
  type: AchievementType,
): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((def) => def.type === type);
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(
  category: AchievementDefinition["category"],
): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter((def) => def.category === category);
}

/**
 * Get rarity color for display
 */
export function getRarityColor(
  rarity: AchievementDefinition["rarity"],
): string {
  const colors: Record<AchievementDefinition["rarity"], string> = {
    common: "#9E9E9E",
    rare: "#2196F3",
    epic: "#9C27B0",
    legendary: "#FF9800",
  };
  return colors[rarity];
}

/**
 * Get total achievement count
 */
export function getTotalAchievementCount(): number {
  return ACHIEVEMENT_DEFINITIONS.length;
}

/**
 * Calculate achievement completion percentage
 */
export function getCompletionPercentage(earnedCount: number): number {
  const total = getTotalAchievementCount();
  return Math.round((earnedCount / total) * 100);
}
