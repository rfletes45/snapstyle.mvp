/**
 * Games V4 — Game Invite Types
 *
 * GameInvites/{inviteId} — the chat-facing summary document.
 * This is the minimal projection visible to all conversation members.
 * The full session state lives in GameSessions/{sessionId}.
 *
 * @module gamesV4/types/invite
 */

import type {
  GameId,
  GameRuntimeType,
  InviteSummary,
  ParticipantSummary,
  SpectateMode,
  TimestampLike,
} from "./common";

// =============================================================================
// Invite Status
// =============================================================================

/**
 * Lifecycle status of a game invite.
 *
 * Transition graph (monotonic — terminal states never revert):
 *   sent → lobby → active → resolved
 *                          ↘ (also from lobby)
 *
 * "sent" is the initial creation state before any player joins.
 * "lobby" means at least one player has joined.
 * "active" means the host started the game (session created).
 * "resolved" means the game ended (win/loss/draw/resign/timeout/error).
 */
export type GameInviteStatus = "sent" | "lobby" | "active" | "resolved";

/**
 * Allowed status transitions. Used for server-side guards.
 */
export const GAME_INVITE_STATUS_TRANSITIONS: Record<
  GameInviteStatus,
  GameInviteStatus[]
> = {
  sent: ["lobby", "resolved"], // resolved = cancelled before anyone joined
  lobby: ["active", "resolved"], // resolved = cancelled from lobby
  active: ["resolved"],
  resolved: [], // terminal
};

/**
 * Check if a status transition is valid.
 */
export function canTransitionInviteStatus(
  from: GameInviteStatus,
  to: GameInviteStatus,
): boolean {
  return GAME_INVITE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// =============================================================================
// Game Invite Document
// =============================================================================

/**
 * Full document shape for GameInvites/{inviteId}.
 *
 * Written by Cloud Functions only (except hiddenInChat which is advisory).
 * Read by conversation members for rendering pinned invite cards.
 */
export interface GameInviteV4 {
  /** Unique invite ID (same as Firestore doc ID). */
  inviteId: string;

  /**
   * Conversation this invite is pinned to.
   * For DMs: chatId (uid1_uid2).
   * For groups: groupId.
   */
  conversationId: string;

  /** Scope of the conversation. */
  conversationScope: "dm" | "group";

  /** Canonical game identifier. */
  gameId: GameId;

  /** Runtime type for routing decisions. */
  runtimeType: GameRuntimeType;

  /** UID of the user who created the invite. */
  createdBy: string;

  /** Current invite status. */
  status: GameInviteStatus;

  /** When the invite was created (server timestamp). */
  createdAt: TimestampLike;

  /** When the invite was last meaningfully updated (server timestamp). */
  updatedAt: TimestampLike;

  /** UID of the lobby/session host. */
  hostId: string;

  /** UIDs of players (including host). Max 8. */
  participantIds: string[];

  /** UIDs of spectators. */
  spectatorIds: string[];

  /** Maximum number of players allowed. */
  maxPlayers: number;

  /** Whether spectating is allowed for this game. */
  allowSpectators: boolean;

  /** What level of state spectators can see. */
  spectateMode: SpectateMode;

  /**
   * Session ID, set when the game starts (status transitions to "active").
   * Null while in "sent" or "lobby" status.
   */
  sessionId: string | null;

  /**
   * Compact summary for rendering invite cards.
   * Updated on meaningful events only (start, move, score change, turn, resolve).
   */
  summary: InviteSummary;

  /** Lightweight profile snapshots for lobby rendering (players). */
  participantSummaries: ParticipantSummary[];

  /** Lightweight profile snapshots for lobby rendering (spectators). */
  spectatorSummaries: ParticipantSummary[];

  // ── Deletion / cleanup ──────────────────────────────────────────────────

  /** Client-side hide flag. Set true when resolved. */
  hiddenInChat: boolean;

  /** When the invite was hidden (server timestamp). */
  hiddenAt: TimestampLike | null;

  /** When server requested hard delete (server timestamp). */
  deleteRequestedAt: TimestampLike | null;

  /**
   * TTL safety timestamp. If the invite still exists after this time,
   * the watchdog will hard-delete it.
   */
  deleteAt: TimestampLike | null;
}
