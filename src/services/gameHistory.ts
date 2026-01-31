/**
 * GameHistory Service
 *
 * Handles querying and managing game history records.
 * History records are created by Cloud Functions when games complete.
 *
 * Features:
 * - Query game history with filters (game type, opponent, date range)
 * - Pagination support for large history sets
 * - Head-to-head records between players
 * - Statistics calculation
 *
 * Note: GameHistory documents are READ-ONLY from the client.
 * All writes happen via Cloud Functions for data integrity.
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 1
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  startAfter,
  where,
} from "firebase/firestore";
import {
  GameHistoryQuery,
  GameHistoryRecord,
  GameHistoryResponse,
  GameHistoryStats,
  GameTypeStats,
  HeadToHeadRecord,
} from "../types/gameHistory";
import { TurnBasedGameType } from "../types/turnBased";
import { getFirestoreInstance } from "./firebase";

// =============================================================================
// Constants
// =============================================================================

const GAME_HISTORY_COLLECTION = "GameHistory";
const DEFAULT_QUERY_LIMIT = 20;
const MAX_QUERY_LIMIT = 100;
const STATS_CALCULATION_LIMIT = 500; // Max games to fetch for stats calculation

/**
 * Get Firestore instance (lazy load)
 */
function getDb() {
  return getFirestoreInstance();
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get game history for a user with optional filters
 *
 * @param params - Query parameters including userId and optional filters
 * @returns Paginated response with records and hasMore indicator
 *
 * @example
 * // Get recent games
 * const history = await getGameHistory({ userId: 'user123' });
 *
 * @example
 * // Get chess games only
 * const chessHistory = await getGameHistory({
 *   userId: 'user123',
 *   gameType: 'chess',
 *   limit: 10
 * });
 */
export async function getGameHistory(
  params: GameHistoryQuery,
): Promise<GameHistoryResponse> {
  const {
    userId,
    gameType,
    opponentId,
    conversationId,
    dateFrom,
    dateTo,
    outcome,
    limit: queryLimit = DEFAULT_QUERY_LIMIT,
    startAfter: startAfterId,
  } = params;

  // Validate and cap limit
  const effectiveLimit = Math.min(queryLimit, MAX_QUERY_LIMIT);

  // Build query constraints
  const constraints: QueryConstraint[] = [
    where("playerIds", "array-contains", userId),
    orderBy("completedAt", "desc"),
    limit(effectiveLimit + 1), // +1 to check if there are more
  ];

  // Add optional Firestore-compatible filters
  // Note: Some filters must be done client-side due to Firestore limitations
  if (gameType) {
    constraints.push(where("gameType", "==", gameType));
  }

  if (conversationId) {
    constraints.push(where("conversationId", "==", conversationId));
  }

  if (dateFrom) {
    constraints.push(where("completedAt", ">=", dateFrom));
  }

  if (dateTo) {
    constraints.push(where("completedAt", "<=", dateTo));
  }

  // Build query
  let q = query(collection(getDb(), GAME_HISTORY_COLLECTION), ...constraints);

  // Handle pagination
  if (startAfterId) {
    const startAfterDoc = await getDoc(
      doc(getDb(), GAME_HISTORY_COLLECTION, startAfterId),
    );
    if (startAfterDoc.exists()) {
      q = query(q, startAfter(startAfterDoc));
    }
  }

  // Execute query
  const snapshot = await getDocs(q);
  const records: GameHistoryRecord[] = [];

  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data() as Omit<GameHistoryRecord, "id">;
    const record: GameHistoryRecord = { ...data, id: docSnapshot.id };

    // Client-side filter for opponent (can't do compound array-contains queries)
    if (opponentId) {
      const hasOpponent = record.playerIds.includes(opponentId);
      if (!hasOpponent) return;
    }

    // Client-side filter for outcome
    if (outcome) {
      const userIsWinner = record.winnerId === userId;
      const isDraw = !record.winnerId;

      if (outcome === "win" && !userIsWinner) return;
      if (outcome === "loss" && (userIsWinner || isDraw)) return;
      if (outcome === "draw" && !isDraw) return;
    }

    records.push(record);
  });

  // Check if there are more results
  const hasMore = records.length > effectiveLimit;
  if (hasMore) {
    records.pop(); // Remove the extra one
  }

  return {
    records,
    hasMore,
    lastId: records.length > 0 ? records[records.length - 1].id : undefined,
  };
}

/**
 * Get a single game history record by ID
 *
 * @param historyId - The ID of the history record to retrieve
 * @returns The history record or null if not found
 */
export async function getGameHistoryById(
  historyId: string,
): Promise<GameHistoryRecord | null> {
  try {
    const docRef = doc(getDb(), GAME_HISTORY_COLLECTION, historyId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as Omit<GameHistoryRecord, "id">;
    return { ...data, id: snapshot.id };
  } catch (error) {
    console.error("[gameHistory] getGameHistoryById failed:", error);
    return null;
  }
}

/**
 * Get game history between two specific users
 *
 * @param userId - The querying user's ID
 * @param opponentId - The opponent's user ID
 * @param gameType - Optional filter by game type
 * @param limitCount - Maximum number of records to return
 * @returns Array of history records between the two players
 */
export async function getHeadToHeadHistory(
  userId: string,
  opponentId: string,
  gameType?: TurnBasedGameType,
  limitCount: number = 10,
): Promise<GameHistoryRecord[]> {
  const result = await getGameHistory({
    userId,
    opponentId,
    gameType,
    limit: limitCount,
  });

  return result.records;
}

/**
 * Get head-to-head record summary between two players
 *
 * @param userId - The querying user's ID
 * @param opponentId - The opponent's user ID
 * @param opponentName - The opponent's display name
 * @param opponentAvatar - The opponent's avatar URL
 * @returns Aggregated head-to-head statistics
 */
export async function getHeadToHeadRecord(
  userId: string,
  opponentId: string,
  opponentName: string,
  opponentAvatar?: string,
): Promise<HeadToHeadRecord> {
  const records = await getHeadToHeadHistory(
    userId,
    opponentId,
    undefined,
    100,
  );

  const record: HeadToHeadRecord = {
    userId,
    opponentId,
    opponentName,
    opponentAvatar,
    wins: 0,
    losses: 0,
    draws: 0,
    totalGames: records.length,
    winRate: 0,
    currentStreak: { type: "none", count: 0 },
    byGameType: {},
  };

  const gameTypeCounts: Record<
    string,
    { wins: number; losses: number; draws: number; total: number }
  > = {};

  let streakType: "win" | "loss" | "none" = "none";
  let streakCount = 0;
  let streakSet = false;

  for (const game of records) {
    const isWin = game.winnerId === userId;
    const isDraw = !game.winnerId;
    const gt = game.gameType;

    // Initialize game type stats
    if (!gameTypeCounts[gt]) {
      gameTypeCounts[gt] = { wins: 0, losses: 0, draws: 0, total: 0 };
    }
    gameTypeCounts[gt].total++;

    if (isDraw) {
      record.draws++;
      gameTypeCounts[gt].draws++;
      if (!streakSet) {
        // Draws break streaks
        streakSet = true;
      }
    } else if (isWin) {
      record.wins++;
      gameTypeCounts[gt].wins++;
      if (!streakSet) {
        if (streakType === "win" || streakType === "none") {
          streakType = "win";
          streakCount++;
        } else {
          streakSet = true;
        }
      }
    } else {
      record.losses++;
      gameTypeCounts[gt].losses++;
      if (!streakSet) {
        if (streakType === "loss" || streakType === "none") {
          streakType = "loss";
          streakCount++;
        } else {
          streakSet = true;
        }
      }
    }

    // Track last played
    if (!record.lastPlayed || game.completedAt > record.lastPlayed) {
      record.lastPlayed = game.completedAt;
    }
  }

  // Calculate win rate
  record.winRate =
    record.totalGames > 0 ? (record.wins / record.totalGames) * 100 : 0;

  // Set streak
  record.currentStreak = { type: streakType, count: streakCount };

  // Convert game type counts to proper format
  const byGameType: HeadToHeadRecord["byGameType"] = {};
  for (const [gt, counts] of Object.entries(gameTypeCounts)) {
    byGameType[gt as TurnBasedGameType] = {
      wins: counts.wins,
      losses: counts.losses,
      draws: counts.draws,
    };
  }
  record.byGameType = byGameType;

  // Find favorite game type
  let maxPlayed = 0;
  for (const [gt, counts] of Object.entries(gameTypeCounts)) {
    if (counts.total > maxPlayed) {
      maxPlayed = counts.total;
      record.favoriteGameType = gt as TurnBasedGameType;
    }
  }

  return record;
}

// =============================================================================
// Statistics Functions
// =============================================================================

/**
 * Calculate comprehensive stats for a user from their game history
 *
 * Note: For production with many games, consider using pre-aggregated
 * stats stored in a separate collection and updated by Cloud Functions.
 *
 * @param userId - The user to calculate stats for
 * @param gameType - Optional filter by game type
 * @returns Aggregated statistics for the user
 */
export async function calculateUserStats(
  userId: string,
  gameType?: TurnBasedGameType,
): Promise<GameHistoryStats> {
  // Fetch history for stats calculation
  const result = await getGameHistory({
    userId,
    gameType,
    limit: STATS_CALCULATION_LIMIT,
  });

  const stats: GameHistoryStats = {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    byGameType: {},
    currentStreak: { type: "none", count: 0 },
    longestWinStreak: 0,
    averageGameDuration: 0,
    totalPlayTime: 0,
    calculatedAt: Date.now(),
  };

  let totalDuration = 0;
  let currentStreakType: "win" | "loss" | "none" = "none";
  let currentStreakCount = 0;
  let streakLocked = false; // Once a streak is broken, stop counting
  let longestWinStreak = 0;
  let tempWinStreak = 0;

  for (const record of result.records) {
    stats.totalGames++;
    totalDuration += record.duration || 0;

    const gt = record.gameType;

    // Initialize per-game-type stats
    if (!stats.byGameType[gt]) {
      stats.byGameType[gt] = {
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
      };
    }
    const gtStats = stats.byGameType[gt] as GameTypeStats;
    gtStats.played++;

    // Determine outcome
    const isWin = record.winnerId === userId;
    const isDraw = !record.winnerId;

    if (isDraw) {
      // Draw
      stats.draws++;
      gtStats.draws++;
      tempWinStreak = 0;

      if (!streakLocked) {
        // Draws break the current streak
        streakLocked = true;
      }
    } else if (isWin) {
      // Win
      stats.wins++;
      gtStats.wins++;
      tempWinStreak++;
      longestWinStreak = Math.max(longestWinStreak, tempWinStreak);

      if (!streakLocked) {
        if (currentStreakType === "win" || currentStreakType === "none") {
          currentStreakType = "win";
          currentStreakCount++;
        } else {
          streakLocked = true;
        }
      }
    } else {
      // Loss
      stats.losses++;
      gtStats.losses++;
      tempWinStreak = 0;

      if (!streakLocked) {
        if (currentStreakType === "loss" || currentStreakType === "none") {
          currentStreakType = "loss";
          currentStreakCount++;
        } else {
          streakLocked = true;
        }
      }
    }

    // Track duration for game type
    if (record.duration) {
      const avgDuration = gtStats.averageDuration || 0;
      gtStats.averageDuration =
        (avgDuration * (gtStats.played - 1) + record.duration) / gtStats.played;
    }
  }

  // Calculate overall rates
  stats.winRate =
    stats.totalGames > 0 ? (stats.wins / stats.totalGames) * 100 : 0;
  stats.totalPlayTime = totalDuration;
  stats.averageGameDuration =
    stats.totalGames > 0 ? totalDuration / stats.totalGames : 0;
  stats.longestWinStreak = longestWinStreak;
  stats.currentStreak = { type: currentStreakType, count: currentStreakCount };

  // Calculate per-game-type win rates
  for (const gt of Object.keys(stats.byGameType) as TurnBasedGameType[]) {
    const gtStats = stats.byGameType[gt] as GameTypeStats;
    gtStats.winRate =
      gtStats.played > 0 ? (gtStats.wins / gtStats.played) * 100 : 0;
  }

  return stats;
}

/**
 * Get quick stats for a specific game type
 * Useful for displaying on game selection screens
 *
 * @param userId - The user to get stats for
 * @param gameType - The specific game type
 * @returns Stats for just that game type
 */
export async function getGameTypeStats(
  userId: string,
  gameType: TurnBasedGameType,
): Promise<GameTypeStats> {
  const fullStats = await calculateUserStats(userId, gameType);

  return (
    fullStats.byGameType[gameType] || {
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
    }
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a user has played any games
 *
 * @param userId - The user to check
 * @returns True if user has at least one completed game
 */
export async function hasPlayedAnyGames(userId: string): Promise<boolean> {
  const result = await getGameHistory({ userId, limit: 1 });
  return result.records.length > 0;
}

/**
 * Get most recent game for a user
 *
 * @param userId - The user to get recent game for
 * @returns Most recent game or null if none
 */
export async function getMostRecentGame(
  userId: string,
): Promise<GameHistoryRecord | null> {
  const result = await getGameHistory({ userId, limit: 1 });
  return result.records.length > 0 ? result.records[0] : null;
}

/**
 * Get games from a specific conversation
 * Useful for showing game history within a chat
 *
 * @param conversationId - The conversation to get games from
 * @param userId - The user viewing (for access control)
 * @param limitCount - Maximum number of games to return
 * @returns Array of games from that conversation
 */
export async function getConversationGames(
  conversationId: string,
  userId: string,
  limitCount: number = 20,
): Promise<GameHistoryRecord[]> {
  const result = await getGameHistory({
    userId,
    conversationId,
    limit: limitCount,
  });

  return result.records;
}
