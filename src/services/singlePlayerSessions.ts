/**
 * Single-Player Sessions Service
 *
 * Handles:
 * - Recording single-player game sessions
 * - Fetching session history
 * - High score tracking
 * - Leaderboard updates
 *
 * @see docs/07_GAMES_ARCHITECTURE.md
 * @see src/types/singlePlayerGames.ts
 */

import { SinglePlayerGameType } from "@/types/games";
import {
  BounceBlitzStats,
  BrickBreakerStats,
  LeaderboardPeriod,
  Play2048Stats,
  SinglePlayerGameSession,
  SinglePlayerGameStats,
  SinglePlayerLeaderboardEntry,
  WordMasterStats,
} from "@/types/singlePlayerGames";
import { createLogger } from "@/utils/log";
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
import { httpsCallable } from "firebase/functions";
import {
  getAuthInstance,
  getFirestoreInstance,
  getFunctionsInstance,
} from "./firebase";

const log = createLogger("singlePlayerSessions");

// =============================================================================
// Types
// =============================================================================

interface RecordSessionInput {
  gameType: SinglePlayerGameType;
  finalScore: number;
  stats: SinglePlayerGameStats;
  duration?: number;
}

export interface PlayerHighScore {
  gameType: SinglePlayerGameType;
  highScore: number;
  achievedAt: number;
  totalGames: number;
}

// =============================================================================
// Record Session
// =============================================================================

/**
 * Record a single-player game session
 *
 * Phase 1 Hardening: All writes now go through the `processSoloGameResult`
 * Cloud Function for server-authoritative score/PB/leaderboard/coin writes.
 * The client sends raw facts and receives computed results.
 */
export async function recordSinglePlayerSession(
  playerId: string,
  input: RecordSessionInput,
): Promise<SinglePlayerGameSession | null> {
  const db = getFirestoreInstance();
  const auth = getAuthInstance();
  const currentUser = auth.currentUser;

  // Debug: Check if authenticated user matches playerId
  log.debug("Auth check", {
    data: {
      authUid: currentUser?.uid,
      playerId,
      match: currentUser?.uid === playerId,
    },
  });

  // Validate authentication state
  if (!currentUser) {
    log.error("No authenticated user - cannot record session");
    return null;
  }

  if (currentUser.uid !== playerId) {
    log.error("Auth UID does not match playerId - potential security issue");
    return null;
  }

  try {
    const functions = getFunctionsInstance();
    const processResult = httpsCallable<
      {
        gameType: string;
        score: number;
        durationMs?: number;
        stats?: Record<string, unknown>;
        gameSpecific?: Record<string, number>;
      },
      {
        success: boolean;
        sessionId: string;
        isNewHighScore: boolean;
        highScore: number;
        totalGames: number;
        coinsEarned: number;
        xpEarned: number;
        didLevelUp: boolean;
        level: number;
        achievementsUnlocked: string[];
        rewardsGranted: number;
      }
    >(functions, "processSoloGameResult");

    const gameSpecific = extractGameSpecificStats(input.stats);

    log.info("Submitting to processSoloGameResult", {
      data: { playerId, gameType: input.gameType, score: input.finalScore },
    });

    const result = await processResult({
      gameType: input.gameType,
      score: input.finalScore,
      durationMs: (input.duration || 0) * 1000,
      stats: input.stats as unknown as Record<string, unknown>,
      gameSpecific,
    });

    const r = result.data;

    // Build the session object for backward compatibility with callers
    const session: SinglePlayerGameSession = {
      id: r.sessionId,
      playerId,
      gameType: input.gameType,
      finalScore: input.finalScore,
      highScore: r.highScore,
      isNewHighScore: r.isNewHighScore,
      startedAt: Date.now() - (input.duration || 0) * 1000,
      endedAt: Date.now(),
      duration: input.duration || 0,
      stats: input.stats,
      achievementsUnlocked: r.achievementsUnlocked,
      coinsEarned: r.coinsEarned,
      platform: getPlatform(),
    };

    log.info("Session recorded via server", {
      data: {
        sessionId: r.sessionId,
        isNewHighScore: r.isNewHighScore,
        xpEarned: r.xpEarned,
        achievements: r.achievementsUnlocked.length,
      },
    });

    return session;
  } catch (error: any) {
    log.error("Error recording session via server", error);

    // Provide more helpful error messages
    if (
      error?.code === "permission-denied" ||
      error?.message?.includes("permission")
    ) {
      log.error(
        "PERMISSION DENIED - Check: 1) Cloud Function deployed, 2) User authenticated",
      );
    }

    return null;
  }
}

// =============================================================================
// High Scores
// =============================================================================

/**
 * Get player's high score for a game
 */
async function getHighScore(
  playerId: string,
  gameType: SinglePlayerGameType,
): Promise<PlayerHighScore | null> {
  const db = getFirestoreInstance();

  try {
    const docSnap = await getDoc(
      doc(db, "Users", playerId, "GameHighScores", gameType),
    );

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      gameType,
      highScore: data.highScore,
      achievedAt: data.achievedAt?.toMillis() || Date.now(),
      totalGames: data.totalGames || 0,
    };
  } catch (error) {
    log.error("Error getting high score", error);
    return null;
  }
}

/**
 * Get all high scores for a player
 */
export async function getAllHighScores(
  playerId: string,
): Promise<PlayerHighScore[]> {
  const db = getFirestoreInstance();

  try {
    const querySnap = await getDocs(
      collection(db, "Users", playerId, "GameHighScores"),
    );

    return querySnap.docs.map((doc) => {
      const data = doc.data();
      return {
        gameType: doc.id as SinglePlayerGameType,
        highScore: data.highScore,
        achievedAt: data.achievedAt?.toMillis() || Date.now(),
        totalGames: data.totalGames || 0,
      };
    });
  } catch (error) {
    log.error("Error getting all high scores", error);
    return [];
  }
}

// =============================================================================
// Recent Sessions
// =============================================================================

/**
 * Get recent game sessions for a player
 */
export async function getRecentSessions(
  playerId: string,
  gameType?: SinglePlayerGameType,
  maxResults: number = 10,
): Promise<SinglePlayerGameSession[]> {
  const db = getFirestoreInstance();

  try {
    let q;
    if (gameType) {
      q = query(
        collection(db, "Users", playerId, "GameSessions"),
        where("gameType", "==", gameType),
        orderBy("endedAt", "desc"),
        limit(maxResults),
      );
    } else {
      q = query(
        collection(db, "Users", playerId, "GameSessions"),
        orderBy("endedAt", "desc"),
        limit(maxResults),
      );
    }

    const querySnap = await getDocs(q);
    return querySnap.docs.map((doc) => doc.data() as SinglePlayerGameSession);
  } catch (error) {
    log.error("Error getting recent sessions", error);
    return [];
  }
}

// =============================================================================
// Leaderboards (reads only — writes handled by processSoloGameResult CF)
// =============================================================================

/**
 * Get leaderboard entries
 */
export async function getLeaderboard(
  gameType: SinglePlayerGameType,
  period: LeaderboardPeriod = "allTime",
  maxResults: number = 50,
): Promise<SinglePlayerLeaderboardEntry[]> {
  const db = getFirestoreInstance();

  try {
    let collectionName: string;
    if (period === "allTime") {
      collectionName = "allTime";
    } else if (period === "weekly") {
      collectionName = `weekly_${getWeekKey()}`;
    } else if (period === "daily") {
      collectionName = `daily_${getDayKey()}`;
    } else {
      collectionName = `monthly_${getMonthKey()}`;
    }

    const q = query(
      collection(db, "Leaderboards", gameType, collectionName),
      orderBy("score", "desc"),
      limit(maxResults),
    );

    const querySnap = await getDocs(q);

    return querySnap.docs.map((doc, index) => {
      const data = doc.data();
      return {
        rank: index + 1,
        playerId: data.playerId,
        playerName: data.playerName,
        playerAvatar: data.playerAvatar,
        score: data.score,
        achievedAt: data.achievedAt?.toMillis() || Date.now(),
      };
    });
  } catch (error) {
    log.error("Error getting leaderboard", error);
    return [];
  }
}

/**
 * Get player's rank on leaderboard
 */
export async function getPlayerRank(
  playerId: string,
  gameType: SinglePlayerGameType,
  period: LeaderboardPeriod = "allTime",
): Promise<number | null> {
  const leaderboard = await getLeaderboard(gameType, period, 1000);
  const playerEntry = leaderboard.find((e) => e.playerId === playerId);
  return playerEntry?.rank || null;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get current platform
 */
function getPlatform(): "ios" | "android" {
  const { Platform } = require("react-native");
  return Platform.OS === "ios" ? "ios" : "android";
}

/**
 * Get week key (YYYY-WW)
 */
function getWeekKey(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
  );
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, "0")}`;
}

/**
 * Get day key (YYYY-MM-DD)
 */
function getDayKey(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get month key (YYYY-MM)
 */
function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
}

// =============================================================================
// Game-Specific Stats Extraction
// =============================================================================

/**
 * Extract game-specific stat fields that the achievement evaluator uses.
 * These map to `PerGameStatsDoc.gameSpecific` keys on the server.
 */
function extractGameSpecificStats(
  stats: SinglePlayerGameStats,
): Record<string, number> | undefined {
  switch (stats.gameType) {
    case "play_2048": {
      const s = stats as Play2048Stats;
      return {
        maxTile: s.bestTile,
        bestWinMoveCount: s.didWin ? s.moveCount : 0,
        totalMerges: s.mergeCount,
      };
    }
    case "brick_breaker": {
      const s = stats as BrickBreakerStats;
      return {
        wallsCleared: s.wallsCleared,
        totalBricksDestroyed: s.bricksDestroyed,
        maxSpeedTier: s.maxSpeedTier,
        paddleShrinkTriggered: s.paddleShrinkTriggered ? 1 : 0,
        livesRemaining: s.livesRemaining,
      };
    }
    case "bounce_blitz": {
      const s = stats as BounceBlitzStats;
      return {
        highestLevel: s.levelReached,
        totalBlocksDestroyed: s.blocksDestroyed,
        totalBounces: s.totalBounces,
        peakBallCount: s.ballsLaunched,
      };
    }
    case "word_master": {
      const s = stats as WordMasterStats;
      return {
        bestAttempts: s.wordGuessed ? s.attemptsUsed : 0,
        hintsUsed: s.hintsUsed,
        streakDay: s.streakDay,
      };
    }
    default:
      return undefined;
  }
}

// =============================================================================
// Score Formatting
// =============================================================================

/**
 * Format score for display
 */
export function formatScore(
  gameType: SinglePlayerGameType,
  score: number,
): string {
  switch (gameType) {
    case "bounce_blitz":
      return `${score} pts`;
    case "word_master":
      return score > 0 ? `${score} pts` : "X";
    case "play_2048":
      return score.toLocaleString();
    default:
      return score.toString();
  }
}
