/**
 * Achievement Triggers Service
 *
 * Orchestrates achievement checking after game completion events.
 * Works with GameHistoryStats and TurnBasedMatch data to determine
 * which achievements should be awarded.
 *
 * This service is the main entry point for checking achievements
 * after multiplayer games complete. It handles:
 * 1. Win/loss streak achievements
 * 2. Total games played achievements
 * 3. Win count achievements (overall and per-game-type)
 * 4. Speed achievements (quick wins)
 * 5. Game-specific achievements (checkmate, multi-jumps, etc.)
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 7
 */

import {
  ALL_GAME_ACHIEVEMENTS,
  getGameAchievementById,
} from "@/data/gameAchievements";
import { GameAchievementDefinition } from "@/types/achievements";
import { GameHistoryStats } from "@/types/gameHistory";
import { TurnBasedGameType, TurnBasedMatch } from "@/types/turnBased";
import {
  AchievementCheckResult,
  checkAchievements,
  checkGameCountAchievements,
  checkStreakAchievements,
  checkWinCountAchievements,
  getAchievementById,
} from "./gameAchievements";
import { StatsGameType } from "./gameStats";

// =============================================================================
// Types
// =============================================================================

/**
 * Context passed to achievement checking after a game completes
 */
export interface GameCompletionContext {
  /** The completed match data */
  match: TurnBasedMatch<unknown, unknown>;

  /** User ID of the player we're checking achievements for */
  userId: string;

  /** Whether this player won the game */
  isWinner: boolean;

  /** Whether this was a draw */
  isDraw: boolean;

  /** Player's aggregated stats (including this game) */
  stats: GameHistoryStats;

  /** Game duration in milliseconds */
  durationMs: number;

  /** Total moves in the game */
  totalMoves: number;
}

/**
 * Result of achievement checking
 */
export interface AchievementTriggerResult {
  /** Achievement IDs that were newly awarded */
  awarded: string[];

  /** Full results from achievement checks */
  checkResults: AchievementCheckResult[];

  /** Achievement definitions that were awarded (for UI display) */
  awardedDefinitions: GameAchievementDefinition[];

  /** Total XP earned from these achievements */
  totalXpEarned: number;

  /** Total coins earned from these achievements */
  totalCoinsEarned: number;
}

/**
 * Custom trigger types for game-specific achievements
 */
type CustomTriggerChecker = (
  context: GameCompletionContext,
) => { achievementId: string; value: number }[];

// =============================================================================
// Constants
// =============================================================================

/** Quick win threshold in milliseconds (2 minutes) */
const QUICK_WIN_THRESHOLD_MS = 2 * 60 * 1000;

/** Scholar's mate threshold (4 moves or less = 8 half-moves) */
const SCHOLARS_MATE_THRESHOLD = 8;

// =============================================================================
// Main Function
// =============================================================================

/**
 * Check and grant achievements after a game completes
 *
 * This is the main entry point called after a multiplayer game finishes.
 * It orchestrates all achievement checks and returns newly awarded achievements.
 *
 * @param context - Game completion context with match data and stats
 * @returns Result containing awarded achievements and rewards
 *
 * @example
 * const result = await checkGameAchievements({
 *   match,
 *   userId: currentUser.uid,
 *   isWinner: match.winnerId === currentUser.uid,
 *   isDraw: !match.winnerId,
 *   stats: await calculateUserStats(currentUser.uid),
 *   durationMs: match.completedAt - match.createdAt,
 *   totalMoves: match.moveHistory.length,
 * });
 *
 * if (result.awarded.length > 0) {
 *   showAchievementToast(result.awardedDefinitions);
 * }
 */
export async function checkGameAchievements(
  context: GameCompletionContext,
): Promise<AchievementTriggerResult> {
  const { userId, isWinner, stats } = context;
  const allResults: AchievementCheckResult[] = [];
  const awarded: string[] = [];

  try {
    // 1. Check total games played achievements
    const gameCountResults = await checkGameCountAchievements(
      userId,
      stats.totalGames,
    );
    allResults.push(...gameCountResults);

    // 2. Check win count achievements (only if winner)
    if (isWinner) {
      // Overall wins
      const winResults = await checkWinCountAchievements(userId, stats.wins);
      allResults.push(...winResults);

      // Per-game-type wins
      const gameType = context.match.gameType;
      const gameTypeStats = stats.byGameType[gameType];
      if (gameTypeStats) {
        const gameTypeWinResults = await checkWinCountAchievements(
          userId,
          gameTypeStats.wins,
          gameTypeToStatsType(gameType),
        );
        allResults.push(...gameTypeWinResults);
      }
    }

    // 3. Check win streak achievements
    if (stats.currentStreak.type === "win" && stats.currentStreak.count > 0) {
      const streakResults = await checkStreakAchievements(
        userId,
        stats.currentStreak.count,
      );
      allResults.push(...streakResults);
    }

    // 4. Check multiplayer-specific achievements
    const mpResults = await checkMultiplayerAchievements(context);
    allResults.push(...mpResults);

    // 5. Check game-specific achievements (chess checkmate, etc.)
    const gameSpecificResults = await checkGameSpecificAchievements(context);
    allResults.push(...gameSpecificResults);

    // 6. Check speed/quick win achievements
    if (isWinner) {
      const speedResults = await checkSpeedAchievements(context);
      allResults.push(...speedResults);
    }

    // Collect newly awarded achievements
    let totalXpEarned = 0;
    let totalCoinsEarned = 0;
    const awardedDefinitions: GameAchievementDefinition[] = [];

    for (const result of allResults) {
      if (result.unlocked) {
        awarded.push(result.achievementId);

        if (result.rewards) {
          totalXpEarned += result.rewards.xp;
          totalCoinsEarned += result.rewards.coins;
        }

        // Get the achievement definition for UI
        const def = getGameAchievementById(result.achievementId);
        if (def) {
          awardedDefinitions.push(def);
        }
      }
    }

    console.log(
      `[achievementTriggers] Checked ${allResults.length} achievements for user ${userId}, awarded ${awarded.length}`,
    );

    return {
      awarded,
      checkResults: allResults,
      awardedDefinitions,
      totalXpEarned,
      totalCoinsEarned,
    };
  } catch (error) {
    console.error("[achievementTriggers] Error checking achievements:", error);
    return {
      awarded: [],
      checkResults: allResults,
      awardedDefinitions: [],
      totalXpEarned: 0,
      totalCoinsEarned: 0,
    };
  }
}

// =============================================================================
// Multiplayer Achievement Checks
// =============================================================================

/**
 * Check multiplayer-specific achievements
 */
async function checkMultiplayerAchievements(
  context: GameCompletionContext,
): Promise<AchievementCheckResult[]> {
  const { userId, isWinner, stats, match } = context;
  const checks: { achievementId: string; value: number }[] = [];

  // Multiplayer games played
  checks.push({
    achievementId: "mp_first_game",
    value: stats.totalGames,
  });

  checks.push({
    achievementId: "mp_games_25",
    value: stats.totalGames,
  });

  checks.push({
    achievementId: "mp_games_100",
    value: stats.totalGames,
  });

  // Multiplayer wins (if winner)
  if (isWinner) {
    checks.push({
      achievementId: "mp_first_win",
      value: stats.wins,
    });

    checks.push({
      achievementId: "mp_wins_10",
      value: stats.wins,
    });

    checks.push({
      achievementId: "mp_wins_50",
      value: stats.wins,
    });

    checks.push({
      achievementId: "mp_wins_100",
      value: stats.wins,
    });
  }

  // Chat-initiated game achievements (Phase 6 integration)
  // Check if this game was started from a chat conversation
  if (match.conversationId) {
    checks.push({
      achievementId: "mp_chat_game",
      value: 1,
    });

    if (isWinner) {
      checks.push({
        achievementId: "mp_chat_win",
        value: 1,
      });
    }
  }

  // Win streaks
  if (stats.currentStreak.type === "win") {
    checks.push({
      achievementId: "mp_streak_3",
      value: stats.currentStreak.count,
    });

    checks.push({
      achievementId: "mp_streak_5",
      value: stats.currentStreak.count,
    });

    checks.push({
      achievementId: "mp_streak_10",
      value: stats.currentStreak.count,
    });
  }

  return checkAchievements(userId, checks);
}

// =============================================================================
// Game-Specific Achievement Checks
// =============================================================================

/**
 * Check achievements specific to certain game types
 */
async function checkGameSpecificAchievements(
  context: GameCompletionContext,
): Promise<AchievementCheckResult[]> {
  const { match, userId } = context;
  const gameType = match.gameType;
  const checks: { achievementId: string; value: number }[] = [];

  switch (gameType) {
    case "chess":
      checks.push(...getChessAchievementChecks(context));
      break;

    case "checkers":
      checks.push(...getCheckersAchievementChecks(context));
      break;

    case "tic_tac_toe":
      checks.push(...getTicTacToeAchievementChecks(context));
      break;

    case "crazy_eights":
      checks.push(...getCrazyEightsAchievementChecks(context));
      break;

    default:
      break;
  }

  if (checks.length === 0) {
    return [];
  }

  return checkAchievements(userId, checks);
}

/**
 * Get chess-specific achievement checks
 */
function getChessAchievementChecks(
  context: GameCompletionContext,
): { achievementId: string; value: number }[] {
  const { match, isWinner, stats, totalMoves } = context;
  const checks: { achievementId: string; value: number }[] = [];
  const gameState = match.gameState as { isCheckmate?: boolean } | undefined;
  const gameTypeStats = stats.byGameType.chess;

  // First chess win
  if (isWinner && gameTypeStats) {
    checks.push({
      achievementId: "chess_first_win",
      value: gameTypeStats.wins,
    });

    checks.push({
      achievementId: "chess_wins_10",
      value: gameTypeStats.wins,
    });

    checks.push({
      achievementId: "chess_wins_50",
      value: gameTypeStats.wins,
    });
  }

  // Checkmate achievements
  if (isWinner && gameState?.isCheckmate) {
    checks.push({
      achievementId: "chess_checkmate",
      value: 1,
    });

    // Scholar's mate (quick checkmate)
    if (totalMoves <= SCHOLARS_MATE_THRESHOLD) {
      checks.push({
        achievementId: "chess_quick_mate",
        value: 1,
      });
    }
  }

  return checks;
}

/**
 * Get checkers-specific achievement checks
 */
function getCheckersAchievementChecks(
  context: GameCompletionContext,
): { achievementId: string; value: number }[] {
  const { match, isWinner, stats } = context;
  const checks: { achievementId: string; value: number }[] = [];
  const gameTypeStats = stats.byGameType.checkers;

  if (isWinner && gameTypeStats) {
    checks.push({
      achievementId: "checkers_first_win",
      value: gameTypeStats.wins,
    });

    checks.push({
      achievementId: "checkers_wins_10",
      value: gameTypeStats.wins,
    });

    checks.push({
      achievementId: "checkers_wins_50",
      value: gameTypeStats.wins,
    });
  }

  // Check for multi-jump or clean sweep in game state
  const gameState = match.gameState as
    | {
        lastMultiJump?: number;
        opponentPiecesRemaining?: number;
      }
    | undefined;

  if (gameState?.lastMultiJump && gameState.lastMultiJump >= 3) {
    checks.push({
      achievementId: "checkers_multi_jump",
      value: gameState.lastMultiJump,
    });
  }

  if (isWinner && gameState?.opponentPiecesRemaining === 0) {
    checks.push({
      achievementId: "checkers_sweep",
      value: 1,
    });
  }

  return checks;
}

/**
 * Get tic-tac-toe-specific achievement checks
 */
function getTicTacToeAchievementChecks(
  context: GameCompletionContext,
): { achievementId: string; value: number }[] {
  const { match, isWinner, stats } = context;
  const checks: { achievementId: string; value: number }[] = [];
  const gameTypeStats = stats.byGameType.tic_tac_toe;

  if (isWinner && gameTypeStats) {
    checks.push({
      achievementId: "ttt_first_win",
      value: gameTypeStats.wins,
    });

    checks.push({
      achievementId: "ttt_wins_10",
      value: gameTypeStats.wins,
    });

    checks.push({
      achievementId: "ttt_wins_50",
      value: gameTypeStats.wins,
    });
  }

  // Check for perfect victory (3-0 in a best-of series)
  const gameState = match.gameState as
    | {
        playerScore?: number;
        opponentScore?: number;
      }
    | undefined;

  if (
    isWinner &&
    gameState?.playerScore === 3 &&
    gameState?.opponentScore === 0
  ) {
    checks.push({
      achievementId: "ttt_perfect",
      value: 1,
    });
  }

  return checks;
}

/**
 * Get crazy eights-specific achievement checks
 */
function getCrazyEightsAchievementChecks(
  context: GameCompletionContext,
): { achievementId: string; value: number }[] {
  const { isWinner, stats } = context;
  const checks: { achievementId: string; value: number }[] = [];
  const gameTypeStats = stats.byGameType.crazy_eights;

  if (isWinner && gameTypeStats) {
    checks.push({
      achievementId: "crazy8_first_win",
      value: gameTypeStats.wins,
    });

    checks.push({
      achievementId: "crazy8_wins_10",
      value: gameTypeStats.wins,
    });

    checks.push({
      achievementId: "crazy8_wins_50",
      value: gameTypeStats.wins,
    });
  }

  return checks;
}

// =============================================================================
// Speed Achievement Checks
// =============================================================================

/**
 * Check quick win achievements
 */
async function checkSpeedAchievements(
  context: GameCompletionContext,
): Promise<AchievementCheckResult[]> {
  const { userId, isWinner, durationMs, match } = context;

  if (!isWinner || durationMs > QUICK_WIN_THRESHOLD_MS) {
    return [];
  }

  const checks: { achievementId: string; value: number }[] = [];
  const gameType = match.gameType;

  // Quick win achievements by game type
  // These are triggered when winning in under 2 minutes
  if (gameType === "chess") {
    // Scholar's mate already handled in chess-specific checks
    // Add any other quick chess achievements here
  } else if (gameType === "tic_tac_toe") {
    // Quick TTT win - check for achievements with quick/fast in name
    checks.push({
      achievementId: "ttt_quick_win",
      value: 1,
    });
  }

  // Generic multiplayer quick win (if such achievement exists)
  checks.push({
    achievementId: "mp_quick_win",
    value: 1,
  });

  if (checks.length === 0) {
    return [];
  }

  // Filter to only existing achievements
  const validChecks = checks.filter(
    (c) =>
      getAchievementById(c.achievementId) ||
      getGameAchievementById(c.achievementId),
  );

  if (validChecks.length === 0) {
    return [];
  }

  return checkAchievements(userId, validChecks);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert TurnBasedGameType to StatsGameType
 */
function gameTypeToStatsType(gameType: TurnBasedGameType): StatsGameType {
  // Map turn-based game types to stats game types
  const typeMap: Record<TurnBasedGameType, StatsGameType> = {
    chess: "chess",
    checkers: "checkers",
    tic_tac_toe: "tic_tac_toe",
    crazy_eights: "crazy_eights",
    snap_four: "snap_four",
    snap_dots: "snap_dots",
    snap_gomoku: "snap_gomoku",
  };

  return typeMap[gameType] || gameType;
}

/**
 * Check if an achievement exists in the definitions
 */
export function achievementExists(achievementId: string): boolean {
  return (
    !!getAchievementById(achievementId) ||
    !!getGameAchievementById(achievementId)
  );
}

/**
 * Get all achievement IDs for a specific game type
 */
export function getAchievementIdsForGameType(
  gameType: TurnBasedGameType,
): string[] {
  return ALL_GAME_ACHIEVEMENTS.filter(
    (a) =>
      a.category === gameType ||
      a.category === "multiplayer" ||
      a.trigger.conditions?.gameType === gameType,
  ).map((a) => a.id);
}

// =============================================================================
// Batch Processing for Cloud Functions
// =============================================================================

/**
 * Batch check achievements for multiple users after a game
 * Useful for Cloud Functions that process game completions
 *
 * @param contexts - Array of game completion contexts (one per player)
 * @returns Map of userId to their achievement results
 */
export async function batchCheckGameAchievements(
  contexts: GameCompletionContext[],
): Promise<Map<string, AchievementTriggerResult>> {
  const results = new Map<string, AchievementTriggerResult>();

  // Process in parallel for better performance
  const promises = contexts.map(async (context) => {
    const result = await checkGameAchievements(context);
    return { userId: context.userId, result };
  });

  const settled = await Promise.allSettled(promises);

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      results.set(outcome.value.userId, outcome.value.result);
    }
  }

  return results;
}

// =============================================================================
// Export
// =============================================================================

export const achievementTriggers = {
  checkGameAchievements,
  batchCheckGameAchievements,
  achievementExists,
  getAchievementIdsForGameType,
};

export default achievementTriggers;
