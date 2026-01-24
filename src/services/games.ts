/**
 * Games Service
 * Phase 16: Real Games + Scorecards
 * Phase 16.5: Share Scorecards to Chat
 *
 * Handles:
 * - Recording game sessions
 * - Fetching game history
 * - Personal best scores
 * - Sending scorecard messages
 */

import { GAME_SCORE_LIMITS, GameSession, GameType } from "@/types/models";
import { generateId } from "@/utils/ids";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { getOrCreateChat } from "./chat";
import { sendMessageV2 } from "./chatV2";
import { getFirestoreInstance } from "./firebase";

// =============================================================================
// Types
// =============================================================================

export interface GameResult {
  gameId: GameType;
  score: number;
  duration?: number;
  tapCount?: number;
  reactionTime?: number;
}

export interface PersonalBest {
  gameId: GameType;
  bestScore: number;
  achievedAt: number;
}

/**
 * Helper: Convert Firestore Timestamp to milliseconds
 */
function timestampToMillis(ts: Timestamp | number): number {
  if (typeof ts === "number") return ts;
  return ts.toMillis();
}

// =============================================================================
// Game Session Recording
// =============================================================================

/**
 * Record a game session
 * Client-side validation before sending to Firestore
 * Note: In production, use Cloud Function for anti-cheat
 */
export async function recordGameSession(
  playerId: string,
  result: GameResult,
): Promise<GameSession | null> {
  const db = getFirestoreInstance();

  try {
    // Validate score is within acceptable bounds
    const limits = GAME_SCORE_LIMITS[result.gameId];
    if (!limits) {
      console.error("[games] Unknown game type:", result.gameId);
      return null;
    }

    // For reaction_tap, lower scores are better (faster reaction)
    // For timed_tap, higher scores are better (more taps)
    if (result.gameId === "reaction_tap") {
      if (result.score < limits.minScore || result.score > limits.maxScore) {
        console.error("[games] Invalid reaction time:", result.score);
        return null;
      }
    } else if (result.gameId === "timed_tap") {
      if (result.score < limits.minScore || result.score > limits.maxScore) {
        console.error("[games] Invalid tap count:", result.score);
        return null;
      }
    }

    const sessionId = generateId();
    const now = Timestamp.now();
    const session: GameSession = {
      id: sessionId,
      gameId: result.gameId,
      playerId,
      score: result.score,
      playedAt: now.toMillis(), // Convert to number for return value
      ...(result.duration !== undefined && { duration: result.duration }),
      ...(result.tapCount !== undefined && { tapCount: result.tapCount }),
      ...(result.reactionTime !== undefined && {
        reactionTime: result.reactionTime,
      }),
    };

    const sessionRef = doc(db, "GameSessions", sessionId);
    // Write to Firestore with Timestamp object
    await setDoc(sessionRef, {
      ...session,
      playedAt: now, // Use Timestamp when writing to Firestore
    });

    console.log("[games] Recorded session:", sessionId, "Score:", result.score);
    return session;
  } catch (error) {
    console.error("[games] Error recording session:", error);
    return null;
  }
}

// =============================================================================
// Game History
// =============================================================================

/**
 * Get recent game sessions for a player
 */
export async function getRecentGames(
  playerId: string,
  gameId?: GameType,
  maxResults: number = 10,
): Promise<GameSession[]> {
  const db = getFirestoreInstance();

  try {
    const sessionsRef = collection(db, "GameSessions");
    let q;

    if (gameId) {
      q = query(
        sessionsRef,
        where("playerId", "==", playerId),
        where("gameId", "==", gameId),
        orderBy("playedAt", "desc"),
        limit(maxResults),
      );
    } else {
      q = query(
        sessionsRef,
        where("playerId", "==", playerId),
        orderBy("playedAt", "desc"),
        limit(maxResults),
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data() as GameSession;
      return {
        ...data,
        playedAt: timestampToMillis(data.playedAt),
      };
    });
  } catch (error) {
    console.error("[games] Error fetching recent games:", error);
    return [];
  }
}

/**
 * Get personal best score for a game
 * For reaction_tap: lowest score (fastest reaction) is best
 * For timed_tap: highest score (most taps) is best
 */
export async function getPersonalBest(
  playerId: string,
  gameId: GameType,
): Promise<PersonalBest | null> {
  const db = getFirestoreInstance();

  try {
    const sessionsRef = collection(db, "GameSessions");

    // For reaction tap, best is lowest (fastest)
    // For timed tap, best is highest (most taps)
    const sortDirection = gameId === "reaction_tap" ? "asc" : "desc";

    const q = query(
      sessionsRef,
      where("playerId", "==", playerId),
      where("gameId", "==", gameId),
      orderBy("score", sortDirection as "asc" | "desc"),
      limit(1),
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const session = snapshot.docs[0].data() as GameSession;
    return {
      gameId: session.gameId,
      bestScore: session.score,
      achievedAt: timestampToMillis(session.playedAt),
    };
  } catch (error) {
    console.error("[games] Error fetching personal best:", error);
    return null;
  }
}

/**
 * Get all personal bests for a player
 */
export async function getAllPersonalBests(
  playerId: string,
): Promise<PersonalBest[]> {
  const gameTypes: GameType[] = ["reaction_tap", "timed_tap"];
  const bests: PersonalBest[] = [];

  for (const gameId of gameTypes) {
    const best = await getPersonalBest(playerId, gameId);
    if (best) {
      bests.push(best);
    }
  }

  return bests;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format score for display
 */
export function formatScore(gameId: GameType, score: number): string {
  if (gameId === "reaction_tap") {
    return `${score}ms`;
  } else if (gameId === "timed_tap") {
    return `${score} taps`;
  }
  return String(score);
}

/**
 * Get game display name
 */
export function getGameDisplayName(gameId: GameType): string {
  const names: Record<GameType, string> = {
    reaction_tap: "Reaction Time",
    timed_tap: "Speed Tap",
  };
  return names[gameId] || gameId;
}

/**
 * Get game description
 */
export function getGameDescription(gameId: GameType): string {
  const descriptions: Record<GameType, string> = {
    reaction_tap: "Tap as fast as you can when the color changes!",
    timed_tap: "Tap as many times as you can in 10 seconds!",
  };
  return descriptions[gameId] || "";
}

/**
 * Get game icon
 */
export function getGameIcon(gameId: GameType): string {
  const icons: Record<GameType, string> = {
    reaction_tap: "lightning-bolt",
    timed_tap: "timer-outline",
  };
  return icons[gameId] || "gamepad-variant";
}

// =============================================================================
// Scorecard Sharing (Phase 16.5)
// =============================================================================

export interface ScorecardData {
  gameId: GameType;
  score: number;
  playerName: string;
}

/**
 * Send a scorecard message to a friend
 * Creates/gets chat and sends a scorecard-type message using V2
 */
export async function sendScorecard(
  senderId: string,
  friendUid: string,
  scorecard: ScorecardData,
): Promise<boolean> {
  try {
    console.log("[games] Sending scorecard to friend:", friendUid);

    // Get or create chat with friend
    const chatId = await getOrCreateChat(senderId, friendUid);

    // Create scorecard content as JSON string
    const content = JSON.stringify(scorecard);

    // Generate message ID and client ID for V2
    const messageId = generateId();
    const clientId = `scorecard_${senderId}_${Date.now()}`;

    // Send the scorecard message using V2
    await sendMessageV2({
      conversationId: chatId,
      scope: "dm",
      kind: "scorecard",
      text: content,
      clientId,
      messageId,
    });

    console.log("[games] Scorecard sent successfully via V2");
    return true;
  } catch (error) {
    console.error("[games] Error sending scorecard:", error);
    return false;
  }
}
