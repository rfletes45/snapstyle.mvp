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

import type { AchievementTriggerResult } from "@/services/achievementTriggers";
import { calculateUserStats } from "@/services/gameHistory";
import { completeGameInvite } from "@/services/gameInvites";
import {
  buildGameResultEvent,
  submitGameResult,
} from "@/services/gameResultService";
import type { ResolveGameParams } from "@/services/sessionBridge";
import { useAuth } from "@/store/AuthContext";
import type {
  AchievementNotification,
  GameAchievementDefinition,
} from "@/types/achievements";
import { GameHistoryStats } from "@/types/gameHistory";
import { TurnBasedMatch } from "@/types/turnBased";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useGameNavigation,
  UseGameNavigationOptions,
} from "./useGameNavigation";

import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useGameCompletion");
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
  exitGame: (resolution?: Omit<ResolveGameParams, "sessionId">) => void;
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

  // Track auto-exit timer for cleanup on unmount
  const autoExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoExitTimerRef.current) {
        clearTimeout(autoExitTimerRef.current);
      }
    };
  }, []);

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
        logger.warn("[useGameCompletion] No user ID available");
        return defaultResult;
      }

      // Check if already processed
      if (processedMatchesRef.current.has(match.id)) {
        logger.info("[useGameCompletion] Match already processed:", match.id);
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
        const completedAt =
          "completedAt" in match && typeof match.completedAt === "number"
            ? match.completedAt
            : Date.now();
        const durationMs = completedAt - match.createdAt;

        // Get user stats (including this game)
        let stats: GameHistoryStats | null = null;
        try {
          stats = await calculateUserStats(userId, match.gameType);
        } catch (error) {
          logger.warn("[useGameCompletion] Failed to calculate stats:", error);
          // Create minimal stats for achievement checking
          stats = {
            totalGames: 1,
            wins: isWinner ? 1 : 0,
            losses: !isWinner && !isDraw ? 1 : 0,
            draws: isDraw ? 1 : 0,
            winRate: isWinner ? 100 : 0,
            byGameType: {},
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

        // V1 client-side achievement checking disabled — V2 evaluator runs
        // server-side in Cloud Functions and writes directly to Firestore.

        // ── Invite completion propagation ────────────────────────────
        // If this game originated from an invite, mark it completed.
        if (match.inviteId) {
          try {
            await completeGameInvite(
              match.inviteId,
              match.winnerId,
              match.endReason,
            );
          } catch (inviteErr) {
            // Non-critical — don't fail the completion flow
            logger.warn(
              "[useGameCompletion] Failed to propagate completion to invite:",
              inviteErr,
            );
          }
        }

        // Build result
        const result: GameCompletionResult = {
          isWinner,
          isDraw,
          achievementsAwarded: [],
          achievementResult: null,
          stats,
          xpEarned: 0,
          coinsEarned: 0,
        };

        // Fire-and-forget: submit to universal GameResult pipeline for XP/level
        const gameOutcome = isDraw
          ? ("draw" as const)
          : isWinner
            ? ("win" as const)
            : ("lose" as const);

        submitGameResult(
          buildGameResultEvent({
            gameId: match.gameType as any,
            mode: "turnBased",
            outcome: gameOutcome,
            score: null,
            durationMs,
            userId,
            displayName: currentFirebaseUser?.displayName || "Player",
            inviteId: match.inviteId,
          }),
        )
          .then((xpResult) => {
            if (xpResult) {
              result.xpEarned = xpResult.xpEarned;
              setLastResult({ ...result, xpEarned: xpResult.xpEarned });
            }
          })
          .catch((err) =>
            logger.warn(
              "[useGameCompletion] GameResult submission failed (non-blocking)",
              err,
            ),
          );

        setLastResult(result);

        // Auto-exit if configured
        if (autoExitOnComplete) {
          autoExitTimerRef.current = setTimeout(() => {
            exitGame();
          }, autoExitDelay);
        }

        return result;
      } catch (error) {
        logger.error("[useGameCompletion] Error processing completion:", error);
        return defaultResult;
      } finally {
        setIsProcessing(false);
      }
    },
    [userId, lastResult, autoExitOnComplete, autoExitDelay, exitGame],
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
