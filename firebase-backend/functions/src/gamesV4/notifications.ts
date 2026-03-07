/**
 * Games V4 — Push Notification Helpers
 *
 * Sends game-related push notifications via Expo push service.
 * Also writes in-app notification documents to Firestore for foreground
 * banner display (Users/{uid}/InAppNotificationsV4/{id}).
 *
 * All notification dispatch is centralized here.
 *
 * @module gamesV4/notifications
 */

import * as admin from "firebase-admin";
import {
  getUserPushToken,
  isDmChatMuted,
  isGroupChatMuted,
  sendExpoPushNotification,
} from "../utils";
import { getDb } from "./helpers";
import type {
  GameId,
  GameInviteV4,
  GameResultV4,
  GameSessionV4,
} from "./types";
import { COLLECTIONS, PRESENCE_STALE_MS } from "./types";

// =============================================================================
// Game metadata display names (lightweight lookup)
// =============================================================================

const GAME_DISPLAY_NAMES: Record<GameId, string> = {
  bounce_blitz: "Bounce Blitz",
  play_2048: "2048",
  brick_breaker: "Brick Breaker",
  word_master: "Word Master",
  minesweeper: "Minesweeper",
  lights_out: "Lights Out",
  tic_tac_toe: "Tic Tac Toe",
  chess: "Chess",
  checkers: "Checkers",
  connect_four: "Connect Four",
  gomoku: "Gomoku",
  reversi: "Reversi",
  dots_and_boxes: "Dots & Boxes",
  pong_game: "Pong",
  battleship: "Battleship",
  sketch_party_game: "Sketch Party",
  crazy_eights: "Crazy 8's",
  starforge_game: "Starforge",
  crossword_puzzle: "Crossword",
  minigolf_duels: "Mini Golf",
  dot_match: "Dot Match",
  solitaire_klondike: "Solitaire",
};

function gameName(gameId: GameId): string {
  return GAME_DISPLAY_NAMES[gameId] || gameId;
}

// =============================================================================
// Mute check
// =============================================================================

async function isMuted(
  uid: string,
  conversationId: string,
  scope: "dm" | "group",
): Promise<boolean> {
  if (scope === "dm") {
    return isDmChatMuted(conversationId, uid);
  }
  return isGroupChatMuted(conversationId, uid);
}

// =============================================================================
// Send push to a single user (with mute check)
// =============================================================================

async function sendGamePush(
  uid: string,
  conversationId: string,
  scope: "dm" | "group",
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    // Don't notify if user muted the conversation
    const muted = await isMuted(uid, conversationId, scope);
    if (muted) return;

    const token = await getUserPushToken(uid);
    if (!token) return;

    await sendExpoPushNotification({
      to: token,
      title,
      body,
      data,
      sound: "default",
    });
  } catch (err) {
    console.error(`[gamesV4] Failed to send push to ${uid}:`, err);
  }
}

// =============================================================================
// In-App Notification Doc Writer
// =============================================================================

/**
 * Write an in-app notification document to Firestore.
 * The client subscribes to `Users/{uid}/InAppNotificationsV4` and shows
 * foreground banners for undelivered docs.
 */
async function writeInAppNotification(
  uid: string,
  type: "game_turn" | "achievement_unlocked",
  collapseKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getDb();
    // Use collapseKey-based doc ID for natural deduplication
    const docId = Buffer.from(collapseKey).toString("base64url").slice(0, 128);
    const ref = db
      .collection("Users")
      .doc(uid)
      .collection(COLLECTIONS.IN_APP_NOTIFICATIONS_V4)
      .doc(docId);

    await ref.set({
      type,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      deliveredAt: null,
      readAt: null,
      collapseKey,
      payload,
    });

    console.log(
      `[gamesV4] In-app notification written: ${type} for ${uid} (${collapseKey})`,
    );
  } catch (err) {
    // Non-fatal — push notification still goes out
    console.error(
      `[gamesV4] Failed to write in-app notification for ${uid}:`,
      err,
    );
  }
}

// =============================================================================
// Notification: Invite Created
// =============================================================================

/**
 * Notify conversation members that a new game invite was created.
 * Skips the creator themselves.
 */
export async function notifyInviteCreated(
  invite: GameInviteV4,
  senderDisplayName: string,
  recipientUids: string[],
): Promise<void> {
  const title = `${gameName(invite.gameId)} Invite`;
  const body = `${senderDisplayName} invited you to play ${gameName(invite.gameId)}!`;
  const data = {
    type: "GAME_INVITE_CREATED",
    inviteId: invite.inviteId,
    conversationId: invite.conversationId,
    conversationScope: invite.conversationScope,
    gameId: invite.gameId,
  };

  const promises = recipientUids
    .filter((uid) => uid !== invite.createdBy)
    .map((uid) =>
      sendGamePush(
        uid,
        invite.conversationId,
        invite.conversationScope,
        title,
        body,
        data,
      ),
    );

  await Promise.allSettled(promises);
}

// =============================================================================
// Notification: Your Turn
// =============================================================================

/**
 * Notify the current turn player that it's their turn.
 */
export async function notifyTurn(
  session: GameSessionV4,
  turnPlayerUid: string,
  lastActorName: string,
): Promise<void> {
  if (!turnPlayerUid) return;

  // Defense-in-depth: only turn-based games should receive turn
  // notifications.  Solo and realtime sessions always have the same
  // "turn player" — spamming "Your turn!" on every move is wrong.
  // The primary guard is in sessions.ts; this is a safety net.
  if (session.runtimeType !== "turnBased") {
    console.log(
      `[gamesV4] Skipping turn notification for non-turnBased session ${session.sessionId} (runtimeType=${session.runtimeType})`,
    );
    return;
  }

  // Skip push if the player is already on the game screen (presence gating)
  try {
    const db = getDb();
    const presSnap = await db
      .collection("Users")
      .doc(turnPlayerUid)
      .collection("GamePresence")
      .doc(session.sessionId)
      .get();
    if (presSnap.exists) {
      const data = presSnap.data();
      const activeAt = data?.activeAt?.toMillis?.() ?? 0;
      if (Date.now() - activeAt < PRESENCE_STALE_MS) {
        console.log(
          `[gamesV4] Skipping turn push for ${turnPlayerUid} — active on game screen`,
        );
        return;
      }
    }
  } catch (err) {
    // Non-fatal; fall through and send the push anyway
    console.warn("[gamesV4] Presence check failed:", err);
  }

  const title = `Your Turn — ${gameName(session.gameId)}`;
  const body = `${lastActorName} made a move. It's your turn!`;
  const data = {
    type: "GAME_TURN",
    sessionId: session.sessionId,
    inviteId: session.inviteId,
    conversationId: session.conversationId,
    conversationScope: session.conversationScope,
    gameId: session.gameId,
  };

  // Write in-app notification doc for foreground banner display
  const collapseKey = `sess:${session.sessionId}:turn:${turnPlayerUid}`;
  await writeInAppNotification(turnPlayerUid, "game_turn", collapseKey, {
    sessionId: session.sessionId,
    inviteId: session.inviteId,
    conversationId: session.conversationId,
    conversationScope: session.conversationScope,
    gameId: session.gameId,
    gameName: gameName(session.gameId),
    opponentName: lastActorName,
  });

  await sendGamePush(
    turnPlayerUid,
    session.conversationId,
    session.conversationScope,
    title,
    body,
    data,
  );
}

// =============================================================================
// Notification: Game Resolved
// =============================================================================

/**
 * Notify all participants that the game has ended.
 * Skips the player who caused the resolution (e.g., the winner who made the final move).
 */
export async function notifyResolved(
  result: GameResultV4,
  conversationScope: "dm" | "group",
  resolverUid?: string,
): Promise<void> {
  const title = `Game Over — ${gameName(result.gameId)}`;
  let body: string;
  if (result.resolutionType === "draw") {
    body = "The game ended in a draw!";
  } else if (result.winnerIds.length > 0) {
    const winnerEntry = result.scoreboard.find((e) =>
      result.winnerIds.includes(e.uid),
    );
    const winnerName = winnerEntry?.displayName ?? "Someone";
    body = `${winnerName} won the game!`;
  } else {
    body = "The game has ended.";
  }

  const data = {
    type: "GAME_RESOLVED",
    sessionId: result.sessionId,
    inviteId: result.inviteId,
    conversationId: result.conversationId,
    gameId: result.gameId,
    resolutionType: result.resolutionType,
  };

  const promises = result.participantIds
    .filter((uid) => uid !== resolverUid)
    .map((uid) =>
      sendGamePush(
        uid,
        result.conversationId,
        conversationScope,
        title,
        body,
        data,
      ),
    );

  await Promise.allSettled(promises);
}

// =============================================================================
// Notification: Player Joined Lobby
// =============================================================================

/**
 * Notify the host that a player joined the lobby.
 */
export async function notifyPlayerJoinedLobby(
  invite: GameInviteV4,
  joinerDisplayName: string,
): Promise<void> {
  if (!invite.hostId) return;

  const title = `${gameName(invite.gameId)} Lobby`;
  const body = `${joinerDisplayName} joined the lobby!`;
  const data = {
    type: "GAME_LOBBY_JOIN",
    inviteId: invite.inviteId,
    conversationId: invite.conversationId,
    conversationScope: invite.conversationScope,
    gameId: invite.gameId,
  };

  await sendGamePush(
    invite.hostId,
    invite.conversationId,
    invite.conversationScope,
    title,
    body,
    data,
  );
}

// =============================================================================
// Notification: Achievement Unlocked
// =============================================================================

/**
 * Notify a user that they unlocked one or more achievements.
 * Writes an in-app notification doc (for foreground banner).
 * No push notification is sent for achievements — they are in-app only.
 */
export async function notifyAchievementUnlocked(params: {
  uid: string;
  achievementIds: string[];
  achievementTitles?: string[];
  sectionId?: string;
  gameId?: string;
  sessionId?: string;
}): Promise<void> {
  const {
    uid,
    achievementIds,
    achievementTitles,
    sectionId,
    gameId,
    sessionId,
  } = params;

  if (achievementIds.length === 0) return;

  const collapseKey = `user:${uid}:achievement:${sessionId ?? "manual"}`;

  await writeInAppNotification(uid, "achievement_unlocked", collapseKey, {
    achievementIds,
    achievementTitles: achievementTitles ?? [],
    sectionId: sectionId ?? null,
    gameId: gameId ?? null,
    sourceSessionId: sessionId ?? null,
  });

  console.log(
    `[gamesV4] Achievement notification: ${uid} unlocked ${achievementIds.length} achievement(s) [${achievementIds.join(", ")}]`,
  );
}
