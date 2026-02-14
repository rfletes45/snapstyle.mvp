/**
 * Games Service
 *
 * Handles:
 * - Recording game sessions
 * - Fetching game history
 * - Personal best scores
 * - Sending scorecard messages
 */

import { EXTENDED_GAME_SCORE_LIMITS, ExtendedGameType } from "@/types/games";
import { GameSession } from "@/types/models";
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
  updateDoc,
  where,
} from "firebase/firestore";
import { getOrCreateChat } from "./chat";
import { getFirestoreInstance } from "./firebase";
import { sendMessage } from "./messaging/send";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/games");
// =============================================================================
// Spectator Invite Tracking
// =============================================================================

/**
 * Reference to a sent spectator invite message in Firestore,
 * so it can be updated when the game ends.
 */
export interface SentInviteRef {
  conversationId: string;
  messageId: string;
  scope: "dm" | "group";
}

// =============================================================================
// Types
// =============================================================================

export interface GameResult {
  gameId: ExtendedGameType | string;
  score: number;
  duration?: number;
  tapCount?: number;
  reactionTime?: number;
}

export interface PersonalBest {
  gameId: ExtendedGameType | string;
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
    const limits =
      EXTENDED_GAME_SCORE_LIMITS[result.gameId as ExtendedGameType];
    if (!limits) {
      logger.error("[games] Unknown game type:", result.gameId);
      return null;
    }

    // For reaction_tap, lower scores are better (faster reaction)
    // For timed_tap, higher scores are better (more taps)
    if (result.gameId === "reaction_tap") {
      if (result.score < limits.minScore || result.score > limits.maxScore) {
        logger.error("[games] Invalid reaction time:", result.score);
        return null;
      }
    } else if (result.gameId === "timed_tap") {
      if (result.score < limits.minScore || result.score > limits.maxScore) {
        logger.error("[games] Invalid tap count:", result.score);
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

    logger.info("[games] Recorded session:", sessionId, "Score:", result.score);
    return session;
  } catch (error) {
    logger.error("[games] Error recording session:", error);
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
  gameId?: ExtendedGameType | string,
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
    logger.error("[games] Error fetching recent games:", error);
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
  gameId: ExtendedGameType | string,
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
    logger.error("[games] Error fetching personal best:", error);
    return null;
  }
}

/**
 * Get all personal bests for a player
 */
export async function getAllPersonalBests(
  playerId: string,
): Promise<PersonalBest[]> {
  const gameTypes: ExtendedGameType[] = ["reaction_tap", "timed_tap"];
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
export function formatScore(
  gameId: ExtendedGameType | string,
  score: number,
): string {
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
export function getGameDisplayName(gameId: ExtendedGameType | string): string {
  const names: Record<string, string> = {
    reaction_tap: "Reaction Time",
    timed_tap: "Speed Tap",
    tropical_fishing: "Tropical Fishing",
  };
  return names[gameId] || gameId;
}

/**
 * Get game description
 */
export function getGameDescription(gameId: ExtendedGameType | string): string {
  const descriptions: Record<string, string> = {
    reaction_tap: "Tap as fast as you can when the color changes!",
    timed_tap: "Tap as many times as you can in 10 seconds!",
    tropical_fishing:
      "Explore islands together, catch fish, and sell for party-scaled rewards.",
  };
  return descriptions[gameId] || "";
}

/**
 * Get game icon
 */
export function getGameIcon(gameId: ExtendedGameType | string): string {
  const icons: Record<string, string> = {
    reaction_tap: "lightning-bolt",
    timed_tap: "timer-outline",
    tropical_fishing: "fish",
  };
  return icons[gameId] || "gamepad-variant";
}

// =============================================================================
// Scorecard Sharing
// =============================================================================

export interface ScorecardData {
  gameId: ExtendedGameType | string; // Allow extended game types
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
    logger.info("[games] Sending scorecard to friend:", friendUid);

    // Get or create chat with friend
    const chatId = await getOrCreateChat(senderId, friendUid);

    // Create scorecard content as JSON string
    const content = JSON.stringify(scorecard);

    // Send via unified outbox path for optimistic local visibility + retries.
    const { sendPromise } = await sendMessage({
      conversationId: chatId,
      scope: "dm",
      kind: "scorecard",
      text: content,
    });
    const result = await sendPromise;
    if (!result.success) {
      logger.error("[games] Failed to send scorecard via outbox", result);
      return false;
    }

    logger.info("[games] Scorecard sent successfully via V2");
    return true;
  } catch (error) {
    logger.error("[games] Error sending scorecard:", error);
    return false;
  }
}

// =============================================================================
// Spectator Invite Sharing
// =============================================================================

export interface SpectatorInviteData {
  /** The Colyseus SpectatorRoom ID */
  roomId: string;
  /** The canonical game type (e.g. "brick_breaker_game") */
  gameType: string;
  /** Host's display name */
  hostName: string;
  /** Host's current score at time of invite */
  currentScore?: number;
  /** Invite mode: passive watch or helper boost session */
  inviteMode?: "spectate" | "boost" | "expedition";
  /** Optional boost-session end timestamp for helper invites */
  boostSessionEndsAt?: number;
}

/**
 * Send a spectator invite to a friend via chat
 *
 * Creates/gets a DM chat and sends a scorecard-kind message
 * containing the SpectatorRoom ID so the friend can join and watch.
 *
 * Uses "scorecard" kind (accepted by Firebase backend) with a
 * "spectator_invite" type field to distinguish from regular scorecards.
 * The JSON starts with {"gameId": to pass the scorecard heuristic
 * detection in messageV2ToWithProfile.
 *
 * Returns a SentInviteRef so the caller can update the message later
 * (e.g. to mark it finished when the game ends).
 *
 */
export async function sendSpectatorInvite(
  senderId: string,
  friendUid: string,
  invite: SpectatorInviteData,
): Promise<SentInviteRef | null> {
  try {
    logger.info("[games] Sending spectator invite to friend:", friendUid);

    // Get or create chat with friend
    const chatId = await getOrCreateChat(senderId, friendUid);

    // Create spectator invite content as JSON string
    // Must start with {"gameId": to pass the scorecard heuristic in messageAdapters
    const content = JSON.stringify({
      gameId: invite.gameType,
      type: "spectator_invite",
      roomId: invite.roomId,
      hostName: invite.hostName,
      score: invite.currentScore ?? 0,
      playerName: invite.hostName,
      inviteMode: invite.inviteMode || "spectate",
      boostSessionEndsAt: invite.boostSessionEndsAt ?? 0,
    });
    if (invite.inviteMode === "expedition") {
      logger.info("expedition_invite_sent", {
        roomId: invite.roomId,
        target: friendUid,
      });
    }

    // Send via unified outbox path for optimistic local visibility + retries.
    const { outboxItem, sendPromise } = await sendMessage({
      conversationId: chatId,
      scope: "dm",
      kind: "scorecard",
      text: content,
    });
    const result = await sendPromise;
    if (!result.success) {
      logger.error(
        "[games] Failed to send spectator invite via outbox",
        result,
      );
      return null;
    }

    logger.info("[games] Spectator invite sent successfully via V2");
    return {
      conversationId: chatId,
      messageId: outboxItem.messageId,
      scope: "dm",
    };
  } catch (error) {
    logger.error("[games] Error sending spectator invite:", error);
    return null;
  }
}

/**
 * Send a spectator invite to a group chat
 *
 * Sends directly to the group conversation (no getOrCreateChat needed —
 * the group already exists). Uses scope "group" so the Firebase backend
 * writes the message into Groups/{groupId}/Messages.
 *
 * Returns a SentInviteRef so the caller can update the message later.
 */
export async function sendGroupSpectatorInvite(
  senderId: string,
  groupId: string,
  invite: SpectatorInviteData,
): Promise<SentInviteRef | null> {
  try {
    void senderId;
    logger.info("[games] Sending spectator invite to group:", groupId);

    const content = JSON.stringify({
      gameId: invite.gameType,
      type: "spectator_invite",
      roomId: invite.roomId,
      hostName: invite.hostName,
      score: invite.currentScore ?? 0,
      playerName: invite.hostName,
      inviteMode: invite.inviteMode || "spectate",
      boostSessionEndsAt: invite.boostSessionEndsAt ?? 0,
    });
    if (invite.inviteMode === "expedition") {
      logger.info("expedition_invite_sent", {
        roomId: invite.roomId,
        target: groupId,
      });
    }

    const { outboxItem, sendPromise } = await sendMessage({
      conversationId: groupId,
      scope: "group",
      kind: "scorecard",
      text: content,
    });
    const result = await sendPromise;
    if (!result.success) {
      logger.error(
        "[games] Failed to send group spectator invite via outbox",
        result,
      );
      return null;
    }

    logger.info("[games] Group spectator invite sent successfully");
    return {
      conversationId: groupId,
      messageId: outboxItem.messageId,
      scope: "group",
    };
  } catch (error) {
    logger.error("[games] Error sending group spectator invite:", error);
    return null;
  }
}

// =============================================================================
// Update Spectator Invite After Game Ends
// =============================================================================

/**
 * Update a spectator invite message in Firestore to mark it as finished.
 *
 * Replaces the message text/content JSON so the invite now shows a
 * results summary instead of a "Watch Live" CTA. The `finished` flag
 * tells SpectatorInviteBubble to render the completed state.
 *
 * Works for both DM messages (Chats/{id}/Messages/{id}) and group
 * messages (Groups/{id}/Messages/{id}).
 */
export async function updateSpectatorInviteToFinished(
  ref: SentInviteRef,
  finalScore: number,
  gameName: string,
): Promise<boolean> {
  try {
    const db = getFirestoreInstance();
    const collectionPath =
      ref.scope === "dm"
        ? `Chats/${ref.conversationId}/Messages`
        : `Groups/${ref.conversationId}/Messages`;
    const messageRef = doc(db, collectionPath, ref.messageId);

    // Read the existing message to preserve the original invite fields
    const { getDoc: getDocFn } = await import("firebase/firestore");
    const snap = await getDocFn(messageRef);
    if (!snap.exists()) {
      logger.warn("[games] Spectator invite message not found:", ref.messageId);
      return false;
    }

    const existing = snap.data();
    // Parse the existing invite content to preserve fields like gameId, roomId, etc.
    let originalContent: Record<string, unknown> = {};
    try {
      originalContent = JSON.parse(
        (existing.text as string) || (existing.content as string) || "{}",
      );
    } catch {
      // fallback — build minimal content
    }

    // Build updated content with finished flag
    const updatedContent = JSON.stringify({
      ...originalContent,
      finished: true,
      finalScore,
      gameName,
    });

    // Update only the "text" field + "editedAt" to comply with Firestore
    // security rules (both DM and Group rules restrict updates to
    // {text, editedAt} for message edits). The subscription adapters
    // read from "text" or "content" — since sendMessageV2 writes the
    // same value to both, updating "text" alone is sufficient because
    // the real-time listener will see the change.
    await updateDoc(messageRef, {
      text: updatedContent,
      editedAt: Date.now(),
    });

    logger.info("[games] Spectator invite updated to finished:", ref.messageId);
    return true;
  } catch (error) {
    logger.error("[games] Error updating spectator invite:", error);
    return false;
  }
}

/**
 * Update all tracked spectator invites to finished state.
 * Called when a game ends to transform "Watch Live" invites into results.
 */
export async function updateAllSpectatorInvites(
  refs: SentInviteRef[],
  finalScore: number,
  gameName: string,
): Promise<void> {
  if (refs.length === 0) return;
  logger.info(
    `[games] Updating ${refs.length} spectator invite(s) to finished`,
  );
  await Promise.allSettled(
    refs.map((ref) =>
      updateSpectatorInviteToFinished(ref, finalScore, gameName),
    ),
  );
}
