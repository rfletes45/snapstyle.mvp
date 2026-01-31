/**
 * useGameCompletion Hook
 *
 * Orchestrates game completion handling, combining:
 * - Achievement checking (Phase 7)
 * - Smart navigation (Phase 6)
 * - Stats calculation
 *
 * This hook provides a unified interface for game screens to handle
 * game completion events, ensuring achievements are checked and
 * navigation works correctly regardless of entry point.
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 6 & 7
 */

import {
  AchievementTriggerResult,
  checkGameAchievements,
  GameCompletionContext,
} from "@/services/achievementTriggers";
import { calculateUserStats } from "@/services/gameHistory";
import { useAuth } from "@/store/AuthContext";
import {
  AchievementNotification,
  GameAchievementDefinition,
} from "@/types/achievements";
import { GameHistoryStats } from "@/types/gameHistory";
import { TurnBasedMatch } from "@/types/turnBased";
import { useCallback, useRef, useState } from "react";
import {
  useGameNavigation,
  UseGameNavigationOptions,
} from "./useGameNavigation";

// =============================================================================
// Types
// =============================================================================

interface UseGameCompletionOptions extends UseGameNavigationOptions {
  /**
   * The game type for achievement tracking
   */
  gameType?: string;

  /**
   * Callback when achievements are awarded
   */
  onAchievementsAwarded?: (achievements: GameAchievementDefinition[]) => void;

  /**
   * Whether to auto-exit after completion processing
   * Default: false
   */
  autoExitOnComplete?: boolean;

  /**
   * Delay before auto-exit (ms)
   * Default: 2000
   */
  autoExitDelay?: number;
}

interface GameCompletionResult {
  /** Whether the current user won */
  isWinner: boolean;

  /** Whether the game was a draw */
  isDraw: boolean;

  /** Achievements awarded during this completion */
  achievementsAwarded: GameAchievementDefinition[];

  /** Achievement check result details */
  achievementResult: AchievementTriggerResult | null;

  /** User's updated stats */
  stats: GameHistoryStats | null;

  /** Total XP earned from achievements */
  xpEarned: number;

  /** Total coins earned from achievements */
  coinsEarned: number;
}

interface UseGameCompletionReturn {
  /**
   * Process game completion - checks achievements and prepares navigation
   */
  handleGameCompletion: (
    match: TurnBasedMatch<unknown, unknown>,
  ) => Promise<GameCompletionResult>;

  /**
   * Whether completion is currently being processed
   */
  isProcessing: boolean;

  /**
   * Last completion result (persists until next completion)
   */
  lastResult: GameCompletionResult | null;

  /**
   * Achievement notifications to display
   */
  notifications: AchievementNotification[];

  /**
   * Dismiss a notification
   */
  dismissNotification: (achievementId: string) => void;

  /**
   * Clear all notifications
   */
  clearNotifications: () => void;

  // Re-export navigation functions from useGameNavigation
  exitGame: () => void;
  goToChat: () => void;
  goToPlayScreen: () => void;
  goToGameHistory: () => void;
  hasChat: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useGameCompletion(
  options: UseGameCompletionOptions = {},
): UseGameCompletionReturn {
  const {
    onAchievementsAwarded,
    autoExitOnComplete = false,
    autoExitDelay = 2000,
    ...navigationOptions
  } = options;

  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;

  // Navigation hook
  const { exitGame, goToChat, goToPlayScreen, goToGameHistory, hasChat } =
    useGameNavigation(navigationOptions);

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<GameCompletionResult | null>(
    null,
  );
  const [notifications, setNotifications] = useState<AchievementNotification[]>(
    [],
  );

  // Track processed matches to avoid duplicate processing
  const processedMatchesRef = useRef<Set<string>>(new Set());

  /**
   * Process game completion
   */
  const handleGameCompletion = useCallback(
    async (
      match: TurnBasedMatch<unknown, unknown>,
    ): Promise<GameCompletionResult> => {
      // Default result for early returns
      const defaultResult: GameCompletionResult = {
        isWinner: false,
        isDraw: false,
        achievementsAwarded: [],
        achievementResult: null,
        stats: null,
        xpEarned: 0,
        coinsEarned: 0,
      };

      if (!userId) {
        console.warn("[useGameCompletion] No user ID available");
        return defaultResult;
      }

      // Check if already processed
      if (processedMatchesRef.current.has(match.id)) {
        console.log("[useGameCompletion] Match already processed:", match.id);
        return lastResult || defaultResult;
      }

      setIsProcessing(true);

      try {
        // Mark as processed
        processedMatchesRef.current.add(match.id);

        // Determine outcome
        const isWinner = match.winnerId === userId;
        // Note: MatchStatus doesn't have "draw" - draws are completed games without a winner
        const isDraw = !match.winnerId && match.status === "completed";

        // Calculate duration - completedAt may be on extended match types
        const matchAny = match as any;
        const durationMs =
          (matchAny.completedAt || Date.now()) - match.createdAt;

        // Get user stats (including this game)
        let stats: GameHistoryStats | null = null;
        try {
          stats = await calculateUserStats(userId, match.gameType);
        } catch (error) {
          console.warn("[useGameCompletion] Failed to calculate stats:", error);
          // Create minimal stats for achievement checking
          stats = {
            totalGames: 1,
            wins: isWinner ? 1 : 0,
            losses: !isWinner && !isDraw ? 1 : 0,
            draws: isDraw ? 1 : 0,
            winRate: isWinner ? 100 : 0,
            byGameType: {} as any,
            currentStreak: {
              type: isWinner ? "win" : isDraw ? "none" : "loss",
              count: 1,
            },
            longestWinStreak: isWinner ? 1 : 0,
            averageGameDuration: durationMs,
            totalPlayTime: durationMs,
            calculatedAt: Date.now(),
          };
        }

        // Build achievement context
        // stats is guaranteed non-null here (either from calculateUserStats or fallback)
        const context: GameCompletionContext = {
          match,
          userId,
          isWinner,
          isDraw,
          stats: stats!,
          durationMs,
          totalMoves: match.moveHistory?.length || 0,
        };

        // Check achievements
        let achievementResult: AchievementTriggerResult | null = null;
        try {
          achievementResult = await checkGameAchievements(context);

          // Create notifications for awarded achievements
          if (achievementResult.awarded.length > 0) {
            const newNotifications: AchievementNotification[] =
              achievementResult.awardedDefinitions.map((def) => ({
                achievement: def,
                earnedAt: Date.now(),
                isNew: true,
                earnCount: 1,
              }));

            setNotifications((prev) => [...prev, ...newNotifications]);

            // Callback
            if (onAchievementsAwarded) {
              onAchievementsAwarded(achievementResult.awardedDefinitions);
            }

            console.log(
              `[useGameCompletion] Awarded ${achievementResult.awarded.length} achievements:`,
              achievementResult.awarded,
            );
          }
        } catch (error) {
          console.error("[useGameCompletion] Achievement check failed:", error);
        }

        // Build result
        const result: GameCompletionResult = {
          isWinner,
          isDraw,
          achievementsAwarded: achievementResult?.awardedDefinitions || [],
          achievementResult,
          stats,
          xpEarned: achievementResult?.totalXpEarned || 0,
          coinsEarned: achievementResult?.totalCoinsEarned || 0,
        };

        setLastResult(result);

        // Auto-exit if configured
        if (autoExitOnComplete) {
          setTimeout(() => {
            exitGame();
          }, autoExitDelay);
        }

        return result;
      } catch (error) {
        console.error(
          "[useGameCompletion] Error processing completion:",
          error,
        );
        return defaultResult;
      } finally {
        setIsProcessing(false);
      }
    },
    [
      userId,
      lastResult,
      onAchievementsAwarded,
      autoExitOnComplete,
      autoExitDelay,
      exitGame,
    ],
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

  return {
    handleGameCompletion,
    isProcessing,
    lastResult,
    notifications,
    dismissNotification,
    clearNotifications,
    exitGame,
    goToChat,
    goToPlayScreen,
    goToGameHistory,
    hasChat,
  };
}

// =============================================================================
// Export Types
// =============================================================================

export type {
  GameCompletionResult,
  UseGameCompletionOptions,
  UseGameCompletionReturn,
};
