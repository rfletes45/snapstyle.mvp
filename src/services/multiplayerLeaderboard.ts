/**
 * Multiplayer Leaderboard Service
 *
 * Handles fetching and displaying leaderboard data for turn-based multiplayer games.
 * Rankings are based on ELO rating system.
 *
 * Data flow:
 * 1. Cloud Function updates LeaderboardStats on game completion
 * 2. This service queries LeaderboardStats for display
 * 3. Users see their rank among global players or friends
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 8
 */

import { Friend } from "@/types/models";
import {
  DEFAULT_RATING,
  LeaderboardQueryParams,
  LeaderboardStatsDocument,
  MultiplayerLeaderboardData,
  MultiplayerLeaderboardEntry,
  MultiplayerLeaderboardTimeframe,
} from "@/types/multiplayerLeaderboard";
import { TurnBasedGameType } from "@/types/turnBased";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import { getFriends } from "./friends";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/multiplayerLeaderboard");
// =============================================================================
// Constants
// =============================================================================

const LEADERBOARD_STATS_COLLECTION = "LeaderboardStats";
const MAX_LEADERBOARD_ENTRIES = 100;
const MAX_FRIENDS_LEADERBOARD = 50;

// =============================================================================
// Main Leaderboard Functions
// =============================================================================

/**
 * Get the global multiplayer leaderboard
 *
 * @param gameType - Game type to get leaderboard for (or "all" for combined)
 * @param timeframe - Timeframe to query
 * @param limitCount - Maximum entries to return
 * @returns Leaderboard data with ranked entries
 */
export async function getMultiplayerGlobalLeaderboard(
  gameType: TurnBasedGameType | "all",
  timeframe: MultiplayerLeaderboardTimeframe = "all-time",
  limitCount: number = MAX_LEADERBOARD_ENTRIES,
): Promise<MultiplayerLeaderboardData> {
  const db = getFirestoreInstance();

  try {
    const statsRef = collection(db, LEADERBOARD_STATS_COLLECTION);

    // Build query - sorted by rating descending
    let q = query(
      statsRef,
      where("gameType", "==", gameType),
      where("timeframe", "==", timeframe),
      orderBy("rating", "desc"),
      limit(limitCount),
    );

    const snapshot = await getDocs(q);
    const entries: MultiplayerLeaderboardEntry[] = [];
    let rank = 1;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as LeaderboardStatsDocument;
      entries.push(convertToEntry(data, rank++));
    });

    logger.info(
      `[multiplayerLeaderboard] Fetched ${entries.length} global entries for ${gameType} (${timeframe})`,
    );

    return {
      gameType,
      scope: "global",
      timeframe,
      entries,
      updatedAt: Date.now(),
      totalPlayers: entries.length,
    };
  } catch (error) {
    logger.error(
      "[multiplayerLeaderboard] Error fetching global leaderboard:",
      error,
    );
    return {
      gameType,
      scope: "global",
      timeframe,
      entries: [],
      updatedAt: Date.now(),
    };
  }
}

/**
 * Get friends-only multiplayer leaderboard
 *
 * @param userId - Current user's ID
 * @param gameType - Game type to get leaderboard for
 * @param timeframe - Timeframe to query
 * @returns Leaderboard data with user and friends
 */
export async function getMultiplayerFriendsLeaderboard(
  userId: string,
  gameType: TurnBasedGameType | "all",
  timeframe: MultiplayerLeaderboardTimeframe = "all-time",
): Promise<MultiplayerLeaderboardData> {
  const db = getFirestoreInstance();

  try {
    // Get user's friends list
    const friends: Friend[] = await getFriends(userId);
    const friendIds = friends
      .map((f: Friend) => f.users.find((u: string) => u !== userId) || "")
      .filter(Boolean);

    // Include the user themselves
    const relevantUserIds = [userId, ...friendIds];

    if (relevantUserIds.length === 0) {
      return {
        gameType,
        scope: "friends",
        timeframe,
        entries: [],
        updatedAt: Date.now(),
      };
    }

    // Firestore 'in' query is limited to 30 items, so batch if needed
    const allEntries: MultiplayerLeaderboardEntry[] = [];
    const batchSize = 30;

    for (let i = 0; i < relevantUserIds.length; i += batchSize) {
      const batch = relevantUserIds.slice(i, i + batchSize);
      const statsRef = collection(db, LEADERBOARD_STATS_COLLECTION);

      const q = query(
        statsRef,
        where("userId", "in", batch),
        where("gameType", "==", gameType),
        where("timeframe", "==", timeframe),
      );

      const snapshot = await getDocs(q);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as LeaderboardStatsDocument;
        allEntries.push(convertToEntry(data, 0)); // Rank will be assigned after sorting
      });
    }

    // Sort by rating descending
    allEntries.sort((a, b) => b.rating - a.rating);

    // Assign ranks and limit
    const rankedEntries = allEntries
      .slice(0, MAX_FRIENDS_LEADERBOARD)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    // Find user's entry
    const userEntry = rankedEntries.find((e) => e.userId === userId);

    logger.info(
      `[multiplayerLeaderboard] Fetched ${rankedEntries.length} friends entries for ${gameType}`,
    );

    return {
      gameType,
      scope: "friends",
      timeframe,
      entries: rankedEntries,
      userEntry,
      userGlobalRank: userEntry?.rank,
      updatedAt: Date.now(),
    };
  } catch (error) {
    logger.error(
      "[multiplayerLeaderboard] Error fetching friends leaderboard:",
      error,
    );
    return {
      gameType,
      scope: "friends",
      timeframe,
      entries: [],
      updatedAt: Date.now(),
    };
  }
}

/**
 * Get a specific user's rank and stats in the leaderboard
 *
 * @param userId - User ID to look up
 * @param gameType - Game type
 * @param timeframe - Timeframe
 * @returns User's entry with rank, or null if not found
 */
export async function getMultiplayerUserRank(
  userId: string,
  gameType: TurnBasedGameType | "all",
  timeframe: MultiplayerLeaderboardTimeframe = "all-time",
): Promise<{ entry: MultiplayerLeaderboardEntry; globalRank: number } | null> {
  const db = getFirestoreInstance();

  try {
    // Get user's stats document
    const docId = `${userId}_${gameType}_${timeframe}`;
    const statsRef = doc(db, LEADERBOARD_STATS_COLLECTION, docId);
    const snapshot = await getDoc(statsRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as LeaderboardStatsDocument;
    const userRating = data.rating;

    // Count how many users have higher rating
    const higherRatingsQuery = query(
      collection(db, LEADERBOARD_STATS_COLLECTION),
      where("gameType", "==", gameType),
      where("timeframe", "==", timeframe),
      where("rating", ">", userRating),
    );

    const higherSnapshot = await getDocs(higherRatingsQuery);
    const globalRank = higherSnapshot.size + 1;

    return {
      entry: convertToEntry(data, globalRank),
      globalRank,
    };
  } catch (error) {
    logger.error("[multiplayerLeaderboard] Error getting user rank:", error);
    return null;
  }
}

/**
 * Get user's stats for all multiplayer game types
 *
 * @param userId - User ID
 * @param timeframe - Timeframe
 * @returns Map of game type to user's stats
 */
export async function getMultiplayerUserStats(
  userId: string,
  timeframe: MultiplayerLeaderboardTimeframe = "all-time",
): Promise<Map<TurnBasedGameType | "all", MultiplayerLeaderboardEntry>> {
  const db = getFirestoreInstance();
  const results = new Map<
    TurnBasedGameType | "all",
    MultiplayerLeaderboardEntry
  >();

  const gameTypes: (TurnBasedGameType | "all")[] = [
    "all",
    "chess",
    "checkers",
    "tic_tac_toe",
    "crazy_eights",
  ];

  try {
    // Fetch all game type stats in parallel
    const promises = gameTypes.map(async (gameType) => {
      const docId = `${userId}_${gameType}_${timeframe}`;
      const statsRef = doc(db, LEADERBOARD_STATS_COLLECTION, docId);
      const snapshot = await getDoc(statsRef);

      if (snapshot.exists()) {
        const data = snapshot.data() as LeaderboardStatsDocument;
        results.set(gameType, convertToEntry(data, 0));
      }
    });

    await Promise.all(promises);

    logger.info(
      `[multiplayerLeaderboard] Fetched stats for ${results.size} game types`,
    );

    return results;
  } catch (error) {
    logger.error("[multiplayerLeaderboard] Error getting user stats:", error);
    return results;
  }
}

/**
 * Get combined leaderboard data for a specific query
 * This is a convenience function that handles both global and friends
 *
 * @param params - Query parameters
 * @returns Leaderboard data
 */
export async function getMultiplayerLeaderboard(
  params: LeaderboardQueryParams,
): Promise<MultiplayerLeaderboardData> {
  const {
    gameType,
    scope,
    timeframe,
    limit: limitCount = MAX_LEADERBOARD_ENTRIES,
    userId,
  } = params;

  if (scope === "friends" && userId) {
    return getMultiplayerFriendsLeaderboard(userId, gameType, timeframe);
  }

  const data = await getMultiplayerGlobalLeaderboard(
    gameType,
    timeframe,
    limitCount,
  );

  // If userId provided, also get user's rank
  if (userId) {
    const userRankData = await getMultiplayerUserRank(
      userId,
      gameType,
      timeframe,
    );
    if (userRankData) {
      data.userEntry = userRankData.entry;
      data.userGlobalRank = userRankData.globalRank;
    }
  }

  return data;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a Firestore document to a leaderboard entry
 */
function convertToEntry(
  data: LeaderboardStatsDocument,
  rank: number,
): MultiplayerLeaderboardEntry {
  // Parse avatar config if stored as JSON
  let avatarConfig;
  if (data.avatarConfigJson) {
    try {
      avatarConfig = JSON.parse(data.avatarConfigJson);
    } catch {
      avatarConfig = undefined;
    }
  }

  return {
    userId: data.userId,
    displayName: data.displayName,
    avatarConfig,
    avatarUrl: data.avatarUrl,
    rank,
    rating: data.rating || DEFAULT_RATING,
    wins: data.wins || 0,
    losses: data.losses || 0,
    draws: data.draws || 0,
    winRate: data.winRate || 0,
    gamesPlayed: data.gamesPlayed || 0,
    currentStreak: data.currentStreak || 0,
    longestStreak: data.longestStreak || 0,
    updatedAt: data.updatedAt || Date.now(),
  };
}

/**
 * Get document ID for a user's leaderboard stats
 */
export function getLeaderboardStatsDocId(
  userId: string,
  gameType: TurnBasedGameType | "all",
  timeframe: MultiplayerLeaderboardTimeframe,
): string {
  return `${userId}_${gameType}_${timeframe}`;
}

// =============================================================================
// Export Types (re-export for convenience)
// =============================================================================

export type {
  LeaderboardQueryParams,
  MultiplayerLeaderboardData,
  MultiplayerLeaderboardEntry,
  MultiplayerLeaderboardTimeframe,
} from "@/types/multiplayerLeaderboard";

export {
  calculateEloRating,
  DEFAULT_RATING,
  getRankDisplayText,
  getRatingTier,
} from "@/types/multiplayerLeaderboard";
