/**
 * Shared Session Types — v3 Game Session Architecture
 *
 * These types define the canonical `GameSessions/{sessionId}` Firestore
 * document schema. They are used by:
 *   - Client (React Native) — subscriptions, optimistic writes
 *   - Cloud Functions — callables, triggers, watchdog
 *   - Colyseus Server — room ↔ session sync
 *
 * Design principles:
 *   1. Session is the single runtime document (replace invite-as-runtime)
 *   2. Invite becomes a lightweight delivery envelope (chat pill only)
 *   3. All multiplayer screens navigate via SessionLobbyScreen
 *   4. Participants array is the source of truth for who is in the game
 *
 * @module shared/sessions/types
 */

import type {
  ParticipantRole,
  ParticipantStatus,
  SessionEntrySource,
  SessionPhase,
  SessionVisibility,
} from "./constants";

// =============================================================================
// Participant
// =============================================================================

/**
 * A player or spectator in the session.
 *
 * The `participants` array on the session doc is ordered: host first,
 * then players in join order, then spectators.
 */
export interface SessionParticipant {
  /** Firebase user ID */
  uid: string;
  /** Display name at time of join (denormalized for offline rendering) */
  displayName: string;
  /** Avatar URL at time of join (denormalized) */
  avatarUrl?: string;
  /** Role in this session */
  role: ParticipantRole;
  /** Current status within the session */
  status: ParticipantStatus;
  /** When the participant joined (epoch ms) */
  joinedAt: number;
  /** When the participant last heartbeated (epoch ms) */
  lastHeartbeatAt?: number;
  /** Score / result for this participant (set at finalization) */
  score?: number;
  /** Whether this participant won (set at finalization) */
  isWinner?: boolean;
}

// =============================================================================
// Session Resolution (game outcome)
// =============================================================================

/**
 * Outcome type for the session — set when phase transitions to "resolved".
 */
export type SessionOutcome = "win" | "draw" | "forfeit" | "timeout" | "error";

export interface SessionResolution {
  /** How the game ended */
  outcome: SessionOutcome;
  /** UID of the winner (if outcome === "win") */
  winnerUid?: string;
  /** Final scores per participant UID */
  scores?: Record<string, number>;
  /** When the game was resolved (epoch ms) */
  resolvedAt: number;
  /** Firestore game document ID (for history/stats) */
  firestoreGameId?: string;
  /** Link back to the v2 invite that spawned this session (if any) */
  sourceInviteId?: string;
  /** XP awarded per participant UID */
  xpAwarded?: Record<string, number>;
  /** Achievement IDs unlocked per participant UID */
  achievementsUnlocked?: Record<string, string[]>;
  /** Whether rewards (XP, stats, achievements) have been processed */
  rewardsProcessed?: boolean;
  /** When rewards were processed (epoch ms) */
  rewardsProcessedAt?: number;
  /** Who triggered the resolve (server, colyseus, client, watchdog) */
  resolvedBy?: string;
  /** Total turn count (turn-based games only) */
  turnCount?: number;
  /** Total moves per participant UID (turn-based games only) */
  movesPerPlayer?: Record<string, number>;
  /** Game duration in milliseconds */
  gameDurationMs?: number;
}

// =============================================================================
// Game Session V3 Document
// =============================================================================

/**
 * The canonical `GameSessions/{sessionId}` document.
 *
 * This is the single source of truth for a multiplayer game's runtime state.
 * The invite doc (`GameInvites/{inviteId}`) is only used for delivery
 * (chat pills, push notifications) and carries a `sessionId` FK.
 */
export interface GameSessionV3 {
  /** Document ID */
  id: string;

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  /** Game type key (e.g. "chess", "battleship") */
  gameType: string;
  /** Runtime category — determines transport and finalization path */
  runtimeType: "solo" | "turnBased" | "realtime";
  /** Visibility — who can discover / spectate this session */
  visibility: SessionVisibility;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Current lifecycle phase */
  phase: SessionPhase;
  /** When the session was created (epoch ms) */
  createdAt: number;
  /** When the session doc was last written (epoch ms) */
  updatedAt: number;
  /** When the session should auto-expire if still in lobby (epoch ms) */
  expiresAt?: number;

  // ---------------------------------------------------------------------------
  // Host
  // ---------------------------------------------------------------------------

  /** UID of the session host / creator */
  hostUid: string;

  // ---------------------------------------------------------------------------
  // Participants
  // ---------------------------------------------------------------------------

  /** Ordered array of participants (host first) */
  participants: SessionParticipant[];
  /** Max non-spectator participants (default 2) */
  maxParticipants: number;
  /** Max spectators (default 10) */
  maxSpectators: number;

  // ---------------------------------------------------------------------------
  // Connections
  // ---------------------------------------------------------------------------

  /** Colyseus room ID — set when the room is created */
  colyseusRoomId?: string;
  /** Firestore TurnBasedGames/{id} — set when game doc is created */
  firestoreGameId?: string;
  /** v2 invite ID that spawned this session (for migration bridge) */
  sourceInviteId?: string;

  // ---------------------------------------------------------------------------
  // Context
  // ---------------------------------------------------------------------------

  /** Chat conversation this session was launched from */
  conversationId?: string;
  /** How the host entered (for analytics / post-game navigation) */
  entrySource?: SessionEntrySource;

  // ---------------------------------------------------------------------------
  // Resolution
  // ---------------------------------------------------------------------------

  /** Populated when phase transitions to "resolved" */
  resolution?: SessionResolution;

  // ---------------------------------------------------------------------------
  // Tracing
  // ---------------------------------------------------------------------------

  /** Correlation ID for end-to-end tracing */
  traceId?: string;

  // ---------------------------------------------------------------------------
  // Denormalized (for Firestore security rules)
  // ---------------------------------------------------------------------------

  /**
   * Flat array of participant UIDs — maintained by Cloud Functions.
   * Firestore rules can't map over an array of objects, so we keep
   * a parallel string[] for `uid in participantUids` checks.
   */
  participantUids: string[];
}

// =============================================================================
// Create Session Params (client → callable)
// =============================================================================

/**
 * Parameters sent by the client to the `createSessionV3` callable.
 */
export interface CreateSessionParams {
  gameType: string;
  runtimeType: "solo" | "turnBased" | "realtime";
  visibility?: SessionVisibility;
  maxParticipants?: number;
  conversationId?: string;
  entrySource?: SessionEntrySource;
  /** Optional: create a v2 invite alongside (dual-write) */
  createInvite?: boolean;
  /** Invite recipients (UIDs) for push notification delivery */
  recipientUids?: string[];
}

/**
 * Response from the `createSessionV3` callable.
 */
export interface CreateSessionResult {
  success: boolean;
  sessionId?: string;
  inviteId?: string;
  error?: string;
}

// =============================================================================
// Join Session Params (client → callable)
// =============================================================================

export interface JoinSessionParams {
  sessionId: string;
  role?: ParticipantRole;
  /** Optional — the CF fetches the profile from Firestore server-side. */
  displayName?: string;
  avatarUrl?: string;
  entrySource?: SessionEntrySource;
}

export interface JoinSessionResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// Leave Session Params
// =============================================================================

export interface LeaveSessionParams {
  sessionId: string;
}

export interface LeaveSessionResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// Start Session Params (host only)
// =============================================================================

export interface StartSessionParams {
  sessionId: string;
}

export interface StartSessionResult {
  success: boolean;
  /** Colyseus room ID (for realtime games) */
  colyseusRoomId?: string;
  /** Firestore game document ID (for turn-based games) */
  firestoreGameId?: string;
  error?: string;
}

// =============================================================================
// Resolve Session Params (game over)
// =============================================================================

export interface ResolveSessionParams {
  sessionId: string;
  /** Game outcome. */
  outcome: SessionOutcome;
  /** UID of the winner (omit for draw / error). */
  winnerUid?: string;
  /** Per-participant scores keyed by UID. */
  scores?: Record<string, number>;
  /** Firestore turn-based game doc ID, if applicable. */
  firestoreGameId?: string;
  /** Who triggered resolution (default "client"). */
  resolvedBy?: string;
}

export interface ResolveSessionResult {
  success: boolean;
  alreadyTerminal?: boolean;
  alreadyCleaned?: boolean;
  error?: string;
}

// =============================================================================
// Invite To Session Params (host/participant invites a friend)
// =============================================================================

export interface InviteToSessionParams {
  sessionId: string;
  /** For DM invites — the single recipient UID. */
  recipientUid?: string;
  /** Target conversation ID — a GameInvites doc is created for this chat. */
  conversationId: string;
  /** For group invites — all member UIDs who should see the invite pill. */
  eligibleUserIds?: string[];
}

export interface InviteToSessionResult {
  success: boolean;
  /** The GameInvites doc ID created for the target chat. */
  inviteId?: string;
  alreadyInvited?: boolean;
  error?: string;
}
