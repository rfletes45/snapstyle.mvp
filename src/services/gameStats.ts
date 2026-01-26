/**
 * Game Stats Service
 *
 * Handles player game statistics including:
 * - Per-game stats
 * - Overall stats
 * - Ratings and rankings
 * - Achievements progress
 *
 * @see docs/07_GAMES_ARCHITECTURE.md Section 2.4
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  GameCategory,
  RealTimeGameType,
  SinglePlayerGameType,
  TurnBasedGameType,
} from "../types/games";
import { getFirestoreInstance } from "./firebase";

// Get Firestore instance
const db = getFirestoreInstance();

// =============================================================================
// Types
// =============================================================================

/**
 * All game types for stats
 */
export type StatsGameType =
  | SinglePlayerGameType
  | TurnBasedGameType
  | RealTimeGameType;

/**
 * Outcome for multiplayer games
 */
export type GameOutcome = "win" | "loss" | "draw";

/**
 * Per-game statistics
 */
export interface GameStats {
  gameType: StatsGameType;
  category: GameCategory;

  // Play counts
  gamesPlayed: number;
  gamesCompleted: number;

  // For multiplayer games
  wins?: number;
  losses?: number;
  draws?: number;
  winStreak?: number;
  bestWinStreak?: number;
  currentStreak?: number; // Positive = wins, negative = losses

  // For single-player games
  highScore?: number;
  totalScore?: number;
  averageScore?: number;
  bestTime?: number; // Milliseconds

  // Rating (for rated games)
  rating?: number;
  ratingDeviation?: number; // For Glicko-2
  peakRating?: number;

  // Time tracking
  totalPlayTime: number; // Seconds
  averageGameDuration: number; // Seconds

  // Recent history
  recentResults?: GameOutcome[]; // Last 10 games

  // Timestamps
  firstPlayedAt: Timestamp;
  lastPlayedAt: Timestamp;
}

/**
 * Overall player stats (aggregated)
 */
export interface PlayerOverallStats {
  playerId: string;

  // Total counts
  totalGamesPlayed: number;
  totalGamesCompleted: number;
  totalPlayTime: number; // Seconds

  // Multiplayer totals
  totalWins: number;
  totalLosses: number;
  totalDraws: number;

  // Single-player totals
  totalScore: number;

  // Favorites
  favoriteGameType?: StatsGameType;
  mostPlayedCategory?: GameCategory;

  // Achievements
  achievementsUnlocked: number;
  totalAchievements: number;

  // Timestamps
  firstGameAt: Timestamp;
  lastGameAt: Timestamp;

  // Daily tracking
  gamesPlayedToday: number;
  lastDayPlayed: string; // YYYY-MM-DD
}

/**
 * Player stats document (stored in Firestore)
 */
export interface PlayerGameStatsDocument {
  playerId: string;

  // Per-game stats (keyed by game type)
  gameStats: Record<string, GameStats>;

  // Overall stats
  overall: PlayerOverallStats;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Game result input for recording
 */
export interface RecordGameResultInput {
  gameType: StatsGameType;
  category: GameCategory;

  // For multiplayer
  outcome?: GameOutcome;
  opponentRating?: number;
  isRated?: boolean;

  // For single-player
  score?: number;

  // Duration
  durationSeconds: number;

  // Game-specific stats
  customStats?: Record<string, number>;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  playerAvatar?: string;

  // Value being ranked
  value: number;
  label: string; // e.g., "Rating", "High Score", "Wins"

  // Additional context
  gamesPlayed?: number;
}

// =============================================================================
// Constants
// =============================================================================

const COLLECTION_NAME = "PlayerGameStats";
const RECENT_RESULTS_LIMIT = 10;
const DEFAULT_RATING = 1200;
const DEFAULT_RATING_DEVIATION = 350;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get today's date string
 */
function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Create empty game stats
 */
function createEmptyGameStats(
  gameType: StatsGameType,
  category: GameCategory,
): GameStats {
  const isMultiplayer = category === "multiplayer";

  return {
    gameType,
    category,
    gamesPlayed: 0,
    gamesCompleted: 0,
    ...(isMultiplayer && {
      wins: 0,
      losses: 0,
      draws: 0,
      winStreak: 0,
      bestWinStreak: 0,
      currentStreak: 0,
      rating: DEFAULT_RATING,
      ratingDeviation: DEFAULT_RATING_DEVIATION,
      peakRating: DEFAULT_RATING,
      recentResults: [],
    }),
    ...(!isMultiplayer && {
      highScore: 0,
      totalScore: 0,
      averageScore: 0,
    }),
    totalPlayTime: 0,
    averageGameDuration: 0,
    firstPlayedAt: Timestamp.now(),
    lastPlayedAt: Timestamp.now(),
  };
}

/**
 * Create empty overall stats
 */
function createEmptyOverallStats(playerId: string): PlayerOverallStats {
  return {
    playerId,
    totalGamesPlayed: 0,
    totalGamesCompleted: 0,
    totalPlayTime: 0,
    totalWins: 0,
    totalLosses: 0,
    totalDraws: 0,
    totalScore: 0,
    achievementsUnlocked: 0,
    totalAchievements: 100, // Placeholder
    firstGameAt: Timestamp.now(),
    lastGameAt: Timestamp.now(),
    gamesPlayedToday: 0,
    lastDayPlayed: getTodayString(),
  };
}

/**
 * Create empty stats document
 */
function createEmptyStatsDocument(playerId: string): PlayerGameStatsDocument {
  return {
    playerId,
    gameStats: {},
    overall: createEmptyOverallStats(playerId),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get or create player stats document
 */
export async function getOrCreatePlayerStats(
  playerId: string,
): Promise<PlayerGameStatsDocument> {
  const docRef = doc(db, COLLECTION_NAME, playerId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as PlayerGameStatsDocument;
  }

  // Create new document
  const newDoc = createEmptyStatsDocument(playerId);
  await setDoc(docRef, newDoc);

  return newDoc;
}

/**
 * Record a game result
 */
export async function recordGameResult(
  playerId: string,
  input: RecordGameResultInput,
): Promise<PlayerGameStatsDocument> {
  const docRef = doc(db, COLLECTION_NAME, playerId);

  const result = await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(docRef);

    let statsDoc: PlayerGameStatsDocument;

    if (docSnap.exists()) {
      statsDoc = docSnap.data() as PlayerGameStatsDocument;
    } else {
      statsDoc = createEmptyStatsDocument(playerId);
    }

    // Get or create game-specific stats
    const gameKey = input.gameType;
    let gameStats = statsDoc.gameStats[gameKey];

    if (!gameStats) {
      gameStats = createEmptyGameStats(input.gameType, input.category);
    }

    // Update game stats
    gameStats.gamesPlayed++;
    gameStats.gamesCompleted++;
    gameStats.totalPlayTime += input.durationSeconds;
    gameStats.averageGameDuration =
      gameStats.totalPlayTime / gameStats.gamesCompleted;
    gameStats.lastPlayedAt = Timestamp.now();

    // Handle multiplayer outcome
    if (input.outcome && input.category === "multiplayer") {
      const recentResults = gameStats.recentResults ?? [];
      recentResults.unshift(input.outcome);
      if (recentResults.length > RECENT_RESULTS_LIMIT) {
        recentResults.pop();
      }
      gameStats.recentResults = recentResults;

      if (input.outcome === "win") {
        gameStats.wins = (gameStats.wins ?? 0) + 1;
        gameStats.currentStreak = Math.max(
          1,
          (gameStats.currentStreak ?? 0) + 1,
        );
        gameStats.winStreak = (gameStats.winStreak ?? 0) + 1;
        gameStats.bestWinStreak = Math.max(
          gameStats.bestWinStreak ?? 0,
          gameStats.winStreak ?? 0,
        );
      } else if (input.outcome === "loss") {
        gameStats.losses = (gameStats.losses ?? 0) + 1;
        gameStats.currentStreak = Math.min(
          -1,
          (gameStats.currentStreak ?? 0) - 1,
        );
        gameStats.winStreak = 0;
      } else {
        gameStats.draws = (gameStats.draws ?? 0) + 1;
        gameStats.currentStreak = 0;
        gameStats.winStreak = 0;
      }

      // Update rating for rated games
      if (input.isRated && input.opponentRating !== undefined) {
        const newRating = calculateNewRating(
          gameStats.rating ?? DEFAULT_RATING,
          input.opponentRating,
          input.outcome,
        );
        gameStats.rating = newRating;
        gameStats.peakRating = Math.max(gameStats.peakRating ?? 0, newRating);
      }
    }

    // Handle single-player score
    if (input.score !== undefined && input.category !== "multiplayer") {
      gameStats.totalScore = (gameStats.totalScore ?? 0) + input.score;
      gameStats.averageScore = gameStats.totalScore / gameStats.gamesCompleted;
      gameStats.highScore = Math.max(gameStats.highScore ?? 0, input.score);
    }

    // Update document
    statsDoc.gameStats[gameKey] = gameStats;

    // Update overall stats
    const overall = statsDoc.overall;
    overall.totalGamesPlayed++;
    overall.totalGamesCompleted++;
    overall.totalPlayTime += input.durationSeconds;
    overall.lastGameAt = Timestamp.now();

    if (input.outcome === "win") {
      overall.totalWins++;
    } else if (input.outcome === "loss") {
      overall.totalLosses++;
    } else if (input.outcome === "draw") {
      overall.totalDraws++;
    }

    if (input.score !== undefined) {
      overall.totalScore += input.score;
    }

    // Update daily tracking
    const today = getTodayString();
    if (overall.lastDayPlayed !== today) {
      overall.gamesPlayedToday = 1;
      overall.lastDayPlayed = today;
    } else {
      overall.gamesPlayedToday++;
    }

    // Determine favorite game
    let maxPlayed = 0;
    let favoriteGame: StatsGameType | undefined;

    for (const [type, stats] of Object.entries(statsDoc.gameStats)) {
      if (stats.gamesPlayed > maxPlayed) {
        maxPlayed = stats.gamesPlayed;
        favoriteGame = type as StatsGameType;
      }
    }
    overall.favoriteGameType = favoriteGame;

    statsDoc.overall = overall;
    statsDoc.updatedAt = Timestamp.now();

    transaction.set(docRef, statsDoc);

    return statsDoc;
  });

  return result;
}

/**
 * Calculate new rating after a game
 */
function calculateNewRating(
  currentRating: number,
  opponentRating: number,
  outcome: GameOutcome,
): number {
  const expectedScore =
    1 / (1 + Math.pow(10, (opponentRating - currentRating) / 400));
  const actualScore = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;
  const kFactor = currentRating < 2400 ? 32 : 16;

  return Math.round(currentRating + kFactor * (actualScore - expectedScore));
}

/**
 * Get stats for a specific game type
 */
export async function getGameStats(
  playerId: string,
  gameType: StatsGameType,
): Promise<GameStats | null> {
  const statsDoc = await getOrCreatePlayerStats(playerId);
  return statsDoc.gameStats[gameType] ?? null;
}

/**
 * Get overall stats for a player
 */
export async function getOverallStats(
  playerId: string,
): Promise<PlayerOverallStats> {
  const statsDoc = await getOrCreatePlayerStats(playerId);
  return statsDoc.overall;
}

/**
 * Get player rating for a game type
 */
export async function getPlayerRating(
  playerId: string,
  gameType: TurnBasedGameType | RealTimeGameType,
): Promise<number> {
  const gameStats = await getGameStats(playerId, gameType);
  return gameStats?.rating ?? DEFAULT_RATING;
}

// =============================================================================
// Leaderboard Functions
// =============================================================================

/**
 * Get rating leaderboard for a game type
 */
export async function getRatingLeaderboard(
  gameType: TurnBasedGameType | RealTimeGameType,
  limitCount: number = 100,
): Promise<LeaderboardEntry[]> {
  // This would ideally use a separate leaderboard collection
  // For now, query player stats
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy(`gameStats.${gameType}.rating`, "desc"),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);

  const entries: LeaderboardEntry[] = [];
  let rank = 1;

  for (const doc of snapshot.docs) {
    const statsDoc = doc.data() as PlayerGameStatsDocument;
    const gameStats = statsDoc.gameStats[gameType];

    if (!gameStats?.rating) continue;

    entries.push({
      rank: rank++,
      playerId: statsDoc.playerId,
      playerName: "Player", // Would need to join with users collection
      value: gameStats.rating,
      label: "Rating",
      gamesPlayed: gameStats.gamesPlayed,
    });
  }

  return entries;
}

/**
 * Get high score leaderboard for a game type
 */
export async function getHighScoreLeaderboard(
  gameType: SinglePlayerGameType,
  limitCount: number = 100,
): Promise<LeaderboardEntry[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy(`gameStats.${gameType}.highScore`, "desc"),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);

  const entries: LeaderboardEntry[] = [];
  let rank = 1;

  for (const doc of snapshot.docs) {
    const statsDoc = doc.data() as PlayerGameStatsDocument;
    const gameStats = statsDoc.gameStats[gameType];

    if (!gameStats?.highScore) continue;

    entries.push({
      rank: rank++,
      playerId: statsDoc.playerId,
      playerName: "Player",
      value: gameStats.highScore,
      label: "High Score",
      gamesPlayed: gameStats.gamesPlayed,
    });
  }

  return entries;
}

/**
 * Get player's rank on a leaderboard
 */
export async function getPlayerRank(
  playerId: string,
  gameType: StatsGameType,
  metric: "rating" | "highScore" | "wins",
): Promise<number | null> {
  const statsDoc = await getOrCreatePlayerStats(playerId);
  const gameStats = statsDoc.gameStats[gameType];

  if (!gameStats) return null;

  let value: number | undefined;
  switch (metric) {
    case "rating":
      value = gameStats.rating;
      break;
    case "highScore":
      value = gameStats.highScore;
      break;
    case "wins":
      value = gameStats.wins;
      break;
  }

  if (value === undefined) return null;

  // Count players with higher values
  const q = query(
    collection(db, COLLECTION_NAME),
    where(`gameStats.${gameType}.${metric}`, ">", value),
  );

  const snapshot = await getDocs(q);
  return snapshot.size + 1;
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to player's stats
 */
export function subscribeToPlayerStats(
  playerId: string,
  onUpdate: (stats: PlayerGameStatsDocument) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const docRef = doc(db, COLLECTION_NAME, playerId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        // Return empty stats
        onUpdate(createEmptyStatsDocument(playerId));
        return;
      }
      onUpdate(snapshot.data() as PlayerGameStatsDocument);
    },
    (error) => {
      console.error("[GameStats] Subscription error:", error);
      onError?.(error);
    },
  );
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Increment achievement count
 */
export async function incrementAchievementCount(
  playerId: string,
  count: number = 1,
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, playerId);

  await updateDoc(docRef, {
    "overall.achievementsUnlocked": increment(count),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Reset daily play count (called by Cloud Function at midnight)
 */
export async function resetDailyPlayCounts(): Promise<number> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const q = query(
    collection(db, COLLECTION_NAME),
    where("overall.lastDayPlayed", "==", yesterdayStr),
  );

  const snapshot = await getDocs(q);

  const today = getTodayString();
  const updates = snapshot.docs.map((doc) =>
    updateDoc(doc.ref, {
      "overall.gamesPlayedToday": 0,
      "overall.lastDayPlayed": today,
    }),
  );

  await Promise.all(updates);

  return snapshot.size;
}

// =============================================================================
// Export
// =============================================================================

export const gameStats = {
  // Core
  getOrCreate: getOrCreatePlayerStats,
  recordResult: recordGameResult,
  getGameStats,
  getOverallStats,
  getPlayerRating,

  // Leaderboards
  getRatingLeaderboard,
  getHighScoreLeaderboard,
  getPlayerRank,

  // Subscriptions
  subscribe: subscribeToPlayerStats,

  // Achievements
  incrementAchievementCount,

  // Batch
  resetDailyCounts: resetDailyPlayCounts,
};

export default gameStats;
