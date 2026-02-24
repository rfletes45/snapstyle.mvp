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
import { generateId } from "@/utils/ids";
import { createLogger } from "@/utils/log";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  getAuthInstance,
  getFirestoreInstance,
  getFunctionsInstance,
} from "./firebase";
import { buildGameResultEvent, submitGameResult } from "./gameResultService";

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
    const sessionId = generateId();
    const now = Date.now();

    // Get current high score
    const highScoreDoc = await getDoc(
      doc(db, "Users", playerId, "GameHighScores", input.gameType),
    );

    const currentHighScore = highScoreDoc.exists()
      ? (highScoreDoc.data().highScore ?? 0)
      : 0;

    const isNewHighScore = input.finalScore > currentHighScore;

    // Create session document
    const session: SinglePlayerGameSession = {
      id: sessionId,
      playerId,
      gameType: input.gameType,
      finalScore: input.finalScore,
      highScore: isNewHighScore ? input.finalScore : currentHighScore,
      isNewHighScore,
      startedAt: now - (input.duration || 0) * 1000,
      endedAt: now,
      duration: input.duration || 0,
      stats: input.stats,
      achievementsUnlocked: [], // NOTE: Check achievements
      coinsEarned: calculateCoinsEarned(
        input.gameType,
        input.finalScore,
        isNewHighScore,
      ),
      platform: getPlatform(),
    };

    // Save session - create minimal document that matches Firestore rules
    const sessionDoc = {
      playerId,
      gameType: input.gameType,
      finalScore: input.finalScore,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      // Additional fields (allowed but not validated by rules)
      id: sessionId,
      highScore: session.highScore,
      isNewHighScore,
      duration: session.duration,
      stats: session.stats,
      achievementsUnlocked: session.achievementsUnlocked,
      coinsEarned: session.coinsEarned,
      platform: session.platform,
      createdAt: Timestamp.now(),
    };

    log.debug("Saving session", { data: { playerId, sessionId } });

    await setDoc(
      doc(db, "Users", playerId, "GameSessions", sessionId),
      sessionDoc,
    );

    // Update high score if new best
    if (isNewHighScore) {
      await setDoc(
        doc(db, "Users", playerId, "GameHighScores", input.gameType),
        {
          gameType: input.gameType,
          highScore: input.finalScore,
          achievedAt: Timestamp.now(),
          totalGames: increment(1),
        },
        { merge: true },
      );

      // Update leaderboard
      await updateLeaderboard(playerId, input.gameType, input.finalScore);
    } else {
      // Just increment game count
      await setDoc(
        doc(db, "Users", playerId, "GameHighScores", input.gameType),
        {
          totalGames: increment(1),
        },
        { merge: true },
      );
    }

    // Award coins
    if (session.coinsEarned > 0) {
      await updateDoc(doc(db, "Users", playerId), {
        coins: increment(session.coinsEarned),
      });
    }

    log.info("Session recorded", { data: { sessionId } });

    // Fire-and-forget: trigger server-side achievement evaluation & rewards
    triggerAchievementEvaluation(input, session).catch((err) =>
      log.warn("Achievement evaluation failed (non-blocking)", err),
    );

    // Fire-and-forget: submit to universal GameResult pipeline for XP/level
    submitGameResult(
      buildGameResultEvent({
        gameId: input.gameType,
        mode: "solo",
        outcome: session.isNewHighScore ? "win" : "completed",
        score: input.finalScore,
        durationMs: (input.duration || 0) * 1000,
        userId: playerId,
        displayName: currentUser.displayName || "Player",
        meta: input.stats as unknown as Record<string, unknown>,
      }),
    ).catch((err) =>
      log.warn("GameResult submission failed (non-blocking)", err),
    );

    return session;
  } catch (error: any) {
    log.error("Error recording session", error);

    // Provide more helpful error messages
    if (
      error?.code === "permission-denied" ||
      error?.message?.includes("permission")
    ) {
      log.error(
        "PERMISSION DENIED - Check: 1) Firestore rules deployed, 2) User authenticated, 3) playerId matches auth UID",
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
// Leaderboards
// =============================================================================

/**
 * Update global leaderboard
 */
async function updateLeaderboard(
  playerId: string,
  gameType: SinglePlayerGameType,
  score: number,
): Promise<void> {
  const db = getFirestoreInstance();

  try {
    // Get player info
    const userDoc = await getDoc(doc(db, "Users", playerId));
    const userData = userDoc.data();

    if (!userData) return;

    // Update all-time leaderboard
    await setDoc(doc(db, "Leaderboards", gameType, "allTime", playerId), {
      playerId,
      playerName: userData.displayName || userData.username || "Player",
      playerAvatar: userData.avatarConfig,
      score,
      achievedAt: Timestamp.now(),
    });

    // Update weekly leaderboard
    const weekKey = getWeekKey();
    await setDoc(
      doc(db, "Leaderboards", gameType, `weekly_${weekKey}`, playerId),
      {
        playerId,
        playerName: userData.displayName || userData.username || "Player",
        playerAvatar: userData.avatarConfig,
        score,
        achievedAt: Timestamp.now(),
      },
    );

    // Update daily leaderboard
    const dayKey = getDayKey();
    await setDoc(
      doc(db, "Leaderboards", gameType, `daily_${dayKey}`, playerId),
      {
        playerId,
        playerName: userData.displayName || userData.username || "Player",
        playerAvatar: userData.avatarConfig,
        score,
        achievedAt: Timestamp.now(),
      },
    );
  } catch (error) {
    log.error("Error updating leaderboard", error);
  }
}

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
 * Calculate coins earned from a game
 */
function calculateCoinsEarned(
  gameType: SinglePlayerGameType,
  score: number,
  isNewHighScore: boolean,
): number {
  let coins = 0;

  // Base coins for playing
  coins += 5;

  // Bonus for high score
  if (isNewHighScore) {
    coins += 10;
  }

  // Game-specific bonuses
  switch (gameType) {
    case "bounce_blitz":
      coins += Math.floor(score / 50);
      break;
    case "word_master":
      coins += score > 0 ? 15 : 0;
      break;
    default:
      coins += Math.floor(score / 100);
  }

  return Math.min(coins, 100); // Cap at 100 coins per game
}

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
// Server Achievement Evaluation Bridge
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

/**
 * Fire-and-forget call to the server-side achievement evaluator.
 * This triggers stat updates + achievement evaluation + reward granting.
 */
async function triggerAchievementEvaluation(
  input: RecordSessionInput,
  session: SinglePlayerGameSession,
): Promise<void> {
  try {
    const functions = getFunctionsInstance();
    const callable = httpsCallable<
      {
        gameType: string;
        score: number;
        outcome: string;
        gameSpecific?: Record<string, number>;
      },
      { success: boolean; newUnlocks: string[]; rewardsGranted: number }
    >(functions, "processSinglePlayerCompletion");

    const result = await callable({
      gameType: input.gameType,
      score: input.finalScore,
      outcome: "completed",
      gameSpecific: extractGameSpecificStats(input.stats),
    });

    if (result.data.newUnlocks.length > 0) {
      log.info("Achievements unlocked!", {
        data: {
          unlocks: result.data.newUnlocks,
          rewardsGranted: result.data.rewardsGranted,
        },
      });
    }
  } catch (error) {
    // Non-fatal — the session was already recorded client-side
    log.warn("processSinglePlayerCompletion callable failed", error);
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
