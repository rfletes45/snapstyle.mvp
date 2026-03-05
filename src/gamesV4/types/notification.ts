/**
 * Games V4 — Notification Types
 *
 * Notification type extensions for the game system.
 * These integrate with the existing InAppNotificationsContext
 * and push notification routing.
 *
 * @module gamesV4/types/notification
 */

import type { GameId, TimestampLike } from "./common";

// =============================================================================
// Game Notification Types
// =============================================================================

/**
 * Game-specific notification types.
 * These extend the existing NotificationType union.
 */
export type GameNotificationType =
  | "GAME_INVITE_CREATED"
  | "GAME_TURN"
  | "GAME_RESOLVED"
  | "ACHIEVEMENT_UNLOCKED";

/**
 * Deduplication / collapse keys for game notifications.
 *
 * invite created: `conv:{conversationId}:invites`
 * turn changed:   `sess:{sessionId}:turn:{uid}`
 * resolved:       `sess:{sessionId}:resolved`
 * achievement:    `user:{uid}:achievement:{sessionId}`
 */
export function getGameNotifCollapseKey(
  type: GameNotificationType,
  ids: { conversationId?: string; sessionId?: string; uid?: string },
): string {
  switch (type) {
    case "GAME_INVITE_CREATED":
      return `conv:${ids.conversationId}:invites`;
    case "GAME_TURN":
      return `sess:${ids.sessionId}:turn:${ids.uid}`;
    case "GAME_RESOLVED":
      return `sess:${ids.sessionId}:resolved`;
    case "ACHIEVEMENT_UNLOCKED":
      return `user:${ids.uid}:achievement:${ids.sessionId ?? "manual"}`;
  }
}

// =============================================================================
// Notification Payloads
// =============================================================================

/** Base notification payload for game events. */
export interface GameNotificationBase {
  type: GameNotificationType;
  gameId: GameId;
  conversationId: string;
  inviteId: string;
  createdAt: TimestampLike;
}

/** Notification: a new game invite was created in a conversation. */
export interface GameInviteCreatedNotification extends GameNotificationBase {
  type: "GAME_INVITE_CREATED";
  creatorUid: string;
  creatorDisplayName: string;
  gameName: string;
}

/** Notification: it's your turn in a game. */
export interface GameTurnNotification extends GameNotificationBase {
  type: "GAME_TURN";
  sessionId: string;
  nextPlayerUid: string;
  /** Display name of the player who just moved. */
  lastActorDisplayName?: string;
}

/** Notification: a game has ended. */
export interface GameResolvedNotification extends GameNotificationBase {
  type: "GAME_RESOLVED";
  sessionId: string;
  winnerIds: string[];
  /** Brief human-readable result (e.g., "Alice won!"). */
  resultSummary: string;
}

/** Notification: one or more achievements were unlocked. */
export interface AchievementUnlockedNotification {
  type: "ACHIEVEMENT_UNLOCKED";
  achievementIds: string[];
  /** Section that the achievements belong to (for deep-linking). */
  sectionId?: string;
  /** Game ID if this was a game-specific section. */
  gameId?: GameId;
  /** Session that triggered this unlock. */
  sourceSessionId?: string;
  /** Human-readable titles of unlocked achievements. */
  achievementTitles?: string[];
  createdAt: TimestampLike;
}

/** Union of all game notification payloads. */
export type GameNotificationPayload =
  | GameInviteCreatedNotification
  | GameTurnNotification
  | GameResolvedNotification
  | AchievementUnlockedNotification;

// =============================================================================
// Push Notification Data
// =============================================================================

/** Push notification data payload (sent via Expo push API). */
export interface GamePushData {
  type: "game_invite" | "game_turn" | "game_resolved" | "achievement_unlocked";
  inviteId?: string;
  sessionId?: string;
  conversationId?: string;
  conversationScope?: string;
  gameId?: string;
  achievementIds?: string;
}

// =============================================================================
// In-App Notification Doc (Firestore: Users/{uid}/InAppNotificationsV4/{id})
// =============================================================================

/** In-app notification types for the foreground banner system. */
export type InAppGameNotificationType = "game_turn" | "achievement_unlocked";

/** Payload for a game-turn in-app notification. */
export interface InAppTurnPayload {
  sessionId: string;
  inviteId?: string;
  conversationId: string;
  conversationScope: string;
  gameId: string;
  gameName?: string;
  opponentName?: string;
}

/** Payload for an achievement-unlocked in-app notification. */
export interface InAppAchievementPayload {
  achievementIds: string[];
  achievementTitles?: string[];
  sectionId?: string;
  gameId?: string;
  sourceSessionId?: string;
}

/** Firestore document schema for Users/{uid}/InAppNotificationsV4/{id}. */
export interface InAppNotificationV4Doc {
  type: InAppGameNotificationType;
  createdAt: TimestampLike;
  deliveredAt: TimestampLike | null;
  readAt: TimestampLike | null;
  collapseKey: string;
  payload: InAppTurnPayload | InAppAchievementPayload;
}
