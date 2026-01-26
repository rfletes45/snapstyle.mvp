/**
 * useGameAchievements Hook
 *
 * Hook for checking and displaying achievements in game screens.
 * Uses the existing gameAchievements service API.
 */

import { getGameAchievementById } from "@/data/gameAchievements";
import {
  AchievementCheckResult,
  AchievementProgress,
  checkGameCountAchievements,
  checkScoreAchievements,
  checkWinCountAchievements,
  getAchievementById,
  getPlayerAchievementProgress,
  PlayerAchievementsDocument,
  subscribeToPlayerAchievements,
} from "@/services/gameAchievements";
import { StatsGameType } from "@/services/gameStats";
import { useAuth } from "@/store/AuthContext";
import {
  AchievementNotification,
  GameAchievementDefinition,
} from "@/types/achievements";
import { useCallback, useEffect, useRef, useState } from "react";

// =============================================================================
// Types
// =============================================================================

interface UseGameAchievementsOptions {
  gameType: StatsGameType;
  autoCheck?: boolean;
}

interface UseGameAchievementsReturn {
  // Notifications
  notifications: AchievementNotification[];
  dismissNotification: (achievementId: string) => void;
  clearNotifications: () => void;

  // Checking
  checkAchievementsForGame: (context: {
    totalGames?: number;
    wins?: number;
    score?: number;
  }) => Promise<AchievementCheckResult[]>;
  isChecking: boolean;

  // Progress
  progress: AchievementProgress[];
  loadProgress: () => Promise<void>;
  isLoadingProgress: boolean;

  // Helpers
  hasEarnedAchievement: (achievementId: string) => boolean;
  getProgressForAchievement: (
    achievementId: string,
  ) => AchievementProgress | undefined;
  earnedAchievements: Set<string>;
}

// =============================================================================
// Main Hook
// =============================================================================

export function useGameAchievements(
  options: UseGameAchievementsOptions,
): UseGameAchievementsReturn {
  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;

  const [notifications, setNotifications] = useState<AchievementNotification[]>(
    [],
  );
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState<AchievementProgress[]>([]);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Subscribe to player achievements
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToPlayerAchievements(
      userId,
      (doc: PlayerAchievementsDocument) => {
        if (mountedRef.current) {
          // Update earned IDs
          const earned = new Set<string>();
          Object.entries(doc.progress).forEach(([id, p]) => {
            if (p.unlocked) {
              earned.add(id);
            }
          });
          setEarnedIds(earned);
        }
      },
      (error: Error) => {
        console.error("[useGameAchievements] Subscription error:", error);
      },
    );

    return () => unsubscribe();
  }, [userId]);

  /**
   * Check achievements after a game
   */
  const checkAchievementsForGame = useCallback(
    async (context: {
      totalGames?: number;
      wins?: number;
      score?: number;
    }): Promise<AchievementCheckResult[]> => {
      if (!userId) {
        console.warn("[useGameAchievements] No user ID");
        return [];
      }

      setIsChecking(true);
      const allResults: AchievementCheckResult[] = [];

      try {
        // Check game count achievements
        if (context.totalGames !== undefined) {
          const gameCountResults = await checkGameCountAchievements(
            userId,
            context.totalGames,
          );
          allResults.push(...gameCountResults);
        }

        // Check win count achievements
        if (context.wins !== undefined) {
          const winResults = await checkWinCountAchievements(
            userId,
            context.wins,
          );
          allResults.push(...winResults);
        }

        // Check score achievements
        if (context.score !== undefined) {
          const scoreResults = await checkScoreAchievements(
            userId,
            context.score,
            options.gameType,
          );
          allResults.push(...scoreResults);
        }

        // Create notifications for newly unlocked achievements
        if (mountedRef.current) {
          const newNotifications: AchievementNotification[] = [];

          for (const result of allResults) {
            if (result.unlocked) {
              // Find in new achievement definitions first
              const newDef = getGameAchievementById(result.achievementId);
              if (newDef) {
                newNotifications.push({
                  achievement: newDef,
                  earnedAt: Date.now(),
                  isNew: true,
                  earnCount: 1,
                });
              } else {
                // Fall back to legacy achievement
                const legacyDef = getAchievementById(result.achievementId);
                if (legacyDef) {
                  // Convert to new format
                  const converted: GameAchievementDefinition = {
                    id: legacyDef.id,
                    name: legacyDef.name,
                    description: legacyDef.description,
                    icon: legacyDef.icon,
                    category:
                      legacyDef.category as GameAchievementDefinition["category"],
                    tier: legacyDef.tier,
                    xpReward: legacyDef.xpReward,
                    coinReward: legacyDef.coinReward,
                    secret: legacyDef.hidden,
                    repeatable: false,
                    trigger: { type: "game_played", conditions: {} },
                    progressType: "instant",
                  };
                  newNotifications.push({
                    achievement: converted,
                    earnedAt: Date.now(),
                    isNew: true,
                    earnCount: 1,
                  });
                }
              }
            }
          }

          if (newNotifications.length > 0) {
            setNotifications((prev) => [...prev, ...newNotifications]);
          }
        }

        return allResults;
      } catch (error) {
        console.error(
          "[useGameAchievements] Error checking achievements:",
          error,
        );
        return [];
      } finally {
        if (mountedRef.current) {
          setIsChecking(false);
        }
      }
    },
    [userId, options.gameType],
  );

  /**
   * Dismiss a notification
   */
  const dismissNotification = useCallback((achievementId: string) => {
    setNotifications((prev) =>
      prev.filter((n) => n.achievement.id !== achievementId),
    );
  }, []);

  /**
   * Clear all notifications
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  /**
   * Load progress for all achievements
   */
  const loadProgress = useCallback(async () => {
    if (!userId) return;

    setIsLoadingProgress(true);

    try {
      const progressData = await getPlayerAchievementProgress(userId);
      if (mountedRef.current) {
        setProgress(progressData);
      }
    } catch (error) {
      console.error("[useGameAchievements] Error loading progress:", error);
    } finally {
      if (mountedRef.current) {
        setIsLoadingProgress(false);
      }
    }
  }, [userId]);

  /**
   * Check if user has earned a specific achievement
   */
  const hasEarnedAchievement = useCallback(
    (achievementId: string): boolean => {
      return earnedIds.has(achievementId);
    },
    [earnedIds],
  );

  /**
   * Get progress for a specific achievement
   */
  const getProgressForAchievement = useCallback(
    (achievementId: string): AchievementProgress | undefined => {
      return progress.find((p) => p.achievementId === achievementId);
    },
    [progress],
  );

  return {
    notifications,
    dismissNotification,
    clearNotifications,
    checkAchievementsForGame,
    isChecking,
    progress,
    loadProgress,
    isLoadingProgress,
    hasEarnedAchievement,
    getProgressForAchievement,
    earnedAchievements: earnedIds,
  };
}

// =============================================================================
// Game Over Hook
// =============================================================================

interface UseGameOverAchievementsOptions {
  gameType: StatsGameType;
  totalGames?: number;
  wins?: number;
  score?: number;
}

/**
 * Simplified hook for game over screens
 * Automatically checks achievements on mount
 */
export function useGameOverAchievements(
  options: UseGameOverAchievementsOptions,
) {
  const {
    notifications,
    dismissNotification,
    checkAchievementsForGame,
    isChecking,
  } = useGameAchievements({ gameType: options.gameType });

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked) return;

    const check = async () => {
      await checkAchievementsForGame({
        totalGames: options.totalGames,
        wins: options.wins,
        score: options.score,
      });
      setChecked(true);
    };

    check();
  }, [
    options.totalGames,
    options.wins,
    options.score,
    checked,
    checkAchievementsForGame,
  ]);

  return {
    notifications,
    dismissNotification,
    isChecking,
    hasAchievements: notifications.length > 0,
  };
}

// =============================================================================
// Multiplayer Hook
// =============================================================================

interface UseMultiplayerAchievementsOptions {
  gameType: StatsGameType;
}

/**
 * Hook for tracking multiplayer-specific achievement data
 */
export function useMultiplayerAchievements(
  options: UseMultiplayerAchievementsOptions,
) {
  const achievements = useGameAchievements({
    gameType: options.gameType,
  });

  // Track game-specific data
  const [kingsCreated, setKingsCreated] = useState(0);
  const [multiJumpCount, setMultiJumpCount] = useState(0);
  const [specialMoves, setSpecialMoves] = useState<string[]>([]);

  const trackKingCreated = useCallback(() => {
    setKingsCreated((prev) => prev + 1);
  }, []);

  const trackMultiJump = useCallback(
    (jumpCount: number) => {
      if (jumpCount > multiJumpCount) {
        setMultiJumpCount(jumpCount);
        setSpecialMoves((prev) => [...prev, `multi_jump_${jumpCount}`]);
      }
    },
    [multiJumpCount],
  );

  const trackSpecialMove = useCallback((move: string) => {
    setSpecialMoves((prev) => [...prev, move]);
  }, []);

  const checkGameEnd = useCallback(
    async (
      totalGames: number,
      wins: number,
    ): Promise<AchievementCheckResult[]> => {
      return achievements.checkAchievementsForGame({
        totalGames,
        wins,
      });
    },
    [achievements.checkAchievementsForGame],
  );

  const resetTracking = useCallback(() => {
    setKingsCreated(0);
    setMultiJumpCount(0);
    setSpecialMoves([]);
  }, []);

  return {
    ...achievements,
    trackKingCreated,
    trackMultiJump,
    trackSpecialMove,
    checkGameEnd,
    resetTracking,
    kingsCreated,
    multiJumpCount,
    specialMoves,
  };
}

export default useGameAchievements;
