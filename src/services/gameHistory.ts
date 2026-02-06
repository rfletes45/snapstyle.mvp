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
 * - Unified history including single-player games
 *
 * Note: Multiplayer GameHistory documents are READ-ONLY from the client.
 * All writes happen via Cloud Functions for data integrity.
 * Single-player sessions are read from Users/{uid}/GameSessions.
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
import { SinglePlayerGameType } from "../types/games";
import { SinglePlayerGameSession } from "../types/singlePlayerGames";
import { TurnBasedGameType } from "../types/turnBased";
import { getFirestoreInstance } from "./firebase";

// =============================================================================
// Constants
// =============================================================================

const GAME_HISTORY_COLLECTION = "GameHistory";
const DEFAULT_QUERY_LIMIT = 20;
const MAX_QUERY_LIMIT = 100;
const STATS_CALCULATION_LIMIT = 100; // Reduced from 500 for better performance
const SINGLE_PLAYER_FETCH_LIMIT = 50; // Reasonable limit for single-player sessions

// Single-player game types for type checking
const SINGLE_PLAYER_GAME_TYPES: SinglePlayerGameType[] = [
  "flappy_snap",
  "bounce_blitz",
  "snap_2048",
  "snap_snake",
  "memory_snap",
  "word_snap",
  "reaction_tap",
  "timed_tap",
];

/**
 * Check if a game type is a single-player game
 */
function isSinglePlayerGame(
  gameType: string,
): gameType is SinglePlayerGameType {
  return SINGLE_PLAYER_GAME_TYPES.includes(gameType as SinglePlayerGameType);
}

/**
 * Convert a SinglePlayerGameSession to GameHistoryRecord format
 * This allows single-player games to be displayed in the unified game history
 */
function convertSinglePlayerToHistoryRecord(
  session: SinglePlayerGameSession,
  playerName?: string,
): GameHistoryRecord {
  // Determine win/loss for single-player games based on game-specific logic
  const isWin = determineSinglePlayerWin(session);

  return {
    id: `sp_${session.id}`, // Prefix with sp_ to distinguish from multiplayer
    gameType: session.gameType as unknown as TurnBasedGameType, // Cast for compatibility
    matchId: session.id,
    players: [
      {
        userId: session.playerId,
        displayName: playerName || "You",
        isWinner: isWin,
        finalScore: session.finalScore,
        movesPlayed: 0, // Not applicable for single-player
      },
    ],
    playerIds: [session.playerId],
    winnerId: isWin ? session.playerId : null,
    status: "completed",
    endReason: isWin ? "completion" : "normal",
    startedAt: session.startedAt,
    completedAt: session.endedAt,
    duration: session.duration * 1000, // Convert seconds to ms
    totalMoves: 0,
    isRated: false,
    createdAt: session.endedAt,
    // Additional single-player specific data
    isSinglePlayer: true,
    singlePlayerScore: session.finalScore,
    isNewHighScore: session.isNewHighScore,
    singlePlayerStats: session.stats, // Include full game-specific stats
  } as GameHistoryRecord & {
    isSinglePlayer: boolean;
    singlePlayerScore: number;
    isNewHighScore: boolean;
    singlePlayerStats: SinglePlayerGameSession["stats"];
  };
}

/**
 * Determine if a single-player game session was a "win"
 * Different games have different win conditions
 */
function determineSinglePlayerWin(session: SinglePlayerGameSession): boolean {
  const stats = session.stats;

  switch (session.gameType) {
    case "word_snap":
      // Word Snap: win if word was guessed
      return "wordGuessed" in stats && stats.wordGuessed === true;

    case "memory_snap":
      // Memory Snap: always a "win" if completed (matched all pairs)
      return "pairsMatched" in stats && stats.pairsMatched > 0;

    case "flappy_snap":
    case "bounce_blitz":
    case "snap_2048":
    case "snap_snake":
      // Score-based games: win if score > 0 (completed at least something)
      return session.finalScore > 0;

    case "reaction_tap":
    case "timed_tap":
      // Tap games: always record as completed, show score
      return session.finalScore > 0;

    default:
      return session.finalScore > 0;
  }
}

/**
 * Get Firestore instance (lazy load)
 */
function getDb() {
  return getFirestoreInstance();
}

// =============================================================================
// Single-Player Session Fetching
// =============================================================================

/**
 * Get single-player game sessions for a user
 * Returns sessions converted to GameHistoryRecord format
 *
 * Note: We fetch ALL sessions and filter client-side for gameType to avoid
 * needing a composite Firestore index (gameType + endedAt). This is acceptable
 * because GameSessions is a user-scoped subcollection with limited records.
 */
async function getSinglePlayerSessions(
  userId: string,
  gameType?: string,
  limitCount: number = DEFAULT_QUERY_LIMIT,
): Promise<GameHistoryRecord[]> {
  try {
    // Fetch all sessions ordered by endedAt, then filter client-side
    // This avoids the composite index requirement for gameType + endedAt
    const q = query(
      collection(getDb(), "Users", userId, "GameSessions"),
      orderBy("endedAt", "desc"),
      limit(limitCount * 3), // Fetch more to account for filtering
    );

    const snapshot = await getDocs(q);
    const records: GameHistoryRecord[] = [];
    const seenIds = new Set<string>();

    snapshot.forEach((docSnapshot) => {
      const session = docSnapshot.data() as SinglePlayerGameSession;

      // Apply gameType filter client-side
      if (gameType && session.gameType !== gameType) {
        return;
      }

      // Use document ID as the unique identifier to prevent duplicates
      const uniqueId = `sp_${docSnapshot.id}`;

      if (!seenIds.has(uniqueId)) {
        seenIds.add(uniqueId);
        const record = convertSinglePlayerToHistoryRecord(session);
        // Override the ID with the document ID for true uniqueness
        record.id = uniqueId;
        records.push(record);
      }
    });

    // Return only up to limitCount records after filtering
    return records.slice(0, limitCount);
  } catch (error) {
    console.error("[gameHistory] getSinglePlayerSessions failed:", error);
    return [];
  }
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
    scope,
  } = params;

  // Validate and cap limit
  const effectiveLimit = Math.min(queryLimit, MAX_QUERY_LIMIT);

  // Check if we're querying a single-player game type specifically
  const isSinglePlayerQuery = gameType && isSinglePlayerGame(gameType);

  // Determine what to include based on scope
  const includeMultiplayer = scope !== "singleplayer" && !isSinglePlayerQuery;
  const includeSinglePlayer =
    (scope !== "multiplayer" || isSinglePlayerQuery) &&
    !opponentId &&
    !conversationId;

  let multiplayerRecords: GameHistoryRecord[] = [];
  let singlePlayerRecords: GameHistoryRecord[] = [];

  // Parse pagination info from startAfterId
  // Format: "mp_<id>_<timestamp>" for multiplayer or "sp_<id>_<timestamp>" for single-player
  let lastMultiplayerTimestamp: number | undefined;
  let lastSinglePlayerTimestamp: number | undefined;
  let lastMultiplayerId: string | undefined;

  if (startAfterId) {
    // Extract timestamp from the last record to use for pagination
    // We'll parse the timestamp from a special format or use the ID
    if (startAfterId.startsWith("sp_")) {
      // For single-player, we need to track the timestamp separately
      // The timestamp will be passed via a query parameter in future, for now we skip duplicates client-side
    } else {
      lastMultiplayerId = startAfterId;
    }
  }

  // Fetch multiplayer history (if not a single-player specific query and not scope=singleplayer)
  if (includeMultiplayer) {
    try {
      // Build query constraints
      const constraints: QueryConstraint[] = [
        where("playerIds", "array-contains", userId),
        orderBy("completedAt", "desc"),
        limit(effectiveLimit + 1), // +1 to check if there are more
      ];

      // Add optional Firestore-compatible filters
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
      let q = query(
        collection(getDb(), GAME_HISTORY_COLLECTION),
        ...constraints,
      );

      // Handle pagination for multiplayer records
      if (lastMultiplayerId) {
        const startAfterDoc = await getDoc(
          doc(getDb(), GAME_HISTORY_COLLECTION, lastMultiplayerId),
        );
        if (startAfterDoc.exists()) {
          q = query(q, startAfter(startAfterDoc));
        }
      }

      // Execute query
      const snapshot = await getDocs(q);

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as Omit<GameHistoryRecord, "id">;
        const record: GameHistoryRecord = { ...data, id: docSnapshot.id };

        // Client-side filter for opponent
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

        multiplayerRecords.push(record);
      });
    } catch (error) {
      console.error("[gameHistory] Multiplayer query failed:", error);
    }
  }

  // Fetch single-player sessions (only on initial load, not pagination)
  // This is a simplified approach - we load all single-player in one go since they're user-scoped
  if (includeSinglePlayer && !startAfterId) {
    try {
      singlePlayerRecords = await getSinglePlayerSessions(
        userId,
        isSinglePlayerQuery ? gameType : undefined,
        effectiveLimit * 2, // Only fetch what we need, not STATS_CALCULATION_LIMIT
      );

      // Apply outcome filter to single-player records
      if (outcome) {
        singlePlayerRecords = singlePlayerRecords.filter((record) => {
          const isWin = record.winnerId === userId;
          if (outcome === "win" && !isWin) return false;
          if (outcome === "loss" && isWin) return false;
          if (outcome === "draw") return false; // Single-player games don't have draws
          return true;
        });
      }
    } catch (error) {
      console.error("[gameHistory] Single-player query failed:", error);
    }
  }

  // Merge and sort all records by completedAt (most recent first)
  let allRecords = [...multiplayerRecords, ...singlePlayerRecords];

  // Remove duplicates based on ID
  const seenIds = new Set<string>();
  allRecords = allRecords.filter((record) => {
    if (seenIds.has(record.id)) {
      return false;
    }
    seenIds.add(record.id);
    return true;
  });

  allRecords.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  // Apply limit
  const hasMore = allRecords.length > effectiveLimit;
  if (hasMore) {
    allRecords = allRecords.slice(0, effectiveLimit);
  }

  return {
    records: allRecords,
    hasMore,
    lastId:
      allRecords.length > 0 ? allRecords[allRecords.length - 1].id : undefined,
  };
}

/**
 * Get a single game history record by ID
 *
 * @param historyId - The ID of the history record to retrieve
 * @returns The history record or null if not found
 */
async function getGameHistoryById(
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
async function getHeadToHeadHistory(
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
async function getHeadToHeadRecord(
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
 * Calculate stats from an array of already-fetched records
 * This avoids a redundant database query when records are already loaded
 *
 * @param records - Array of game history records
 * @param userId - User ID to determine win/loss
 * @returns Aggregated statistics
 */
export function calculateStatsFromRecords(
  records: GameHistoryRecord[],
  userId: string,
): GameHistoryStats {
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
  let streakLocked = false;
  let longestWinStreak = 0;
  let tempWinStreak = 0;

  for (const record of records) {
    stats.totalGames++;
    totalDuration += record.duration || 0;

    const gt = record.gameType;

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

    const isWin = record.winnerId === userId;
    const isDraw = !record.winnerId;

    if (isDraw) {
      stats.draws++;
      gtStats.draws++;
      tempWinStreak = 0;
      if (!streakLocked) streakLocked = true;
    } else if (isWin) {
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

    if (record.duration) {
      const avgDuration = gtStats.averageDuration || 0;
      gtStats.averageDuration =
        (avgDuration * (gtStats.played - 1) + record.duration) / gtStats.played;
    }
  }

  stats.winRate =
    stats.totalGames > 0 ? (stats.wins / stats.totalGames) * 100 : 0;
  stats.totalPlayTime = totalDuration;
  stats.averageGameDuration =
    stats.totalGames > 0 ? totalDuration / stats.totalGames : 0;
  stats.longestWinStreak = longestWinStreak;
  stats.currentStreak = { type: currentStreakType, count: currentStreakCount };

  for (const gt of Object.keys(stats.byGameType) as TurnBasedGameType[]) {
    const gtStats = stats.byGameType[gt] as GameTypeStats;
    gtStats.winRate =
      gtStats.played > 0 ? (gtStats.wins / gtStats.played) * 100 : 0;
  }

  return stats;
}

/**
 * Calculate comprehensive stats for a user from their game history
 *
 * Note: For production with many games, consider using pre-aggregated
 * stats stored in a separate collection and updated by Cloud Functions.
 *
 * @param userId - The user to calculate stats for
 * @param gameType - Optional filter by game type (supports both multiplayer and single-player)
 * @param scope - Optional scope to filter multiplayer or single-player only
 * @returns Aggregated statistics for the user
 */
export async function calculateUserStats(
  userId: string,
  gameType?: TurnBasedGameType | SinglePlayerGameType,
  scope?: "multiplayer" | "singleplayer",
): Promise<GameHistoryStats> {
  // Fetch history for stats calculation
  const result = await getGameHistory({
    userId,
    gameType: gameType as TurnBasedGameType, // Cast for query compatibility
    limit: STATS_CALCULATION_LIMIT,
    scope,
  });

  // Use the shared stats calculation function
  return calculateStatsFromRecords(result.records, userId);
}

/**
 * Get quick stats for a specific game type
 * Useful for displaying on game selection screens
 *
 * @param userId - The user to get stats for
 * @param gameType - The specific game type
 * @returns Stats for just that game type
 */
async function getGameTypeStats(
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
