/**
 * Games V4 — Game Session Types
 *
 * GameSessions/{sessionId} — the canonical session lifecycle document.
 * This is the source of truth for game state, turn order, and resolution.
 *
 * Subcollections:
 *   GameSessions/{sessionId}/PublicState/{doc}
 *   GameSessions/{sessionId}/PrivateState/{uid}
 *   GameSessions/{sessionId}/Moves/{moveId}
 *
 * @module gamesV4/types/session
 */

import type {
  GameId,
  GameRuntimeType,
  IntegrityEnvelope,
  PlayerSlot,
  ScoreSummaryEntry,
  SoloMode,
  SpectateMode,
  SpectatorSlot,
  TimestampLike,
} from "./common";

// =============================================================================
// Session Status
// =============================================================================

/**
 * Lifecycle status of a game session.
 *
 * Transition graph:
 *   lobby_open → active → resolved
 *                       ↘ abandoned
 *             ↘ expired
 *
 * "lobby_open" — waiting for players or host to start.
 * "active" — game in progress.
 * "resolved" — game completed (win/loss/draw/resign/timeout/error).
 * "abandoned" — game abandoned (all players left, crash recovery failed).
 * "expired" — lobby timed out before starting.
 */
export type SessionStatus =
  | "lobby_open"
  | "active"
  | "resolved"
  | "abandoned"
  | "expired";

// =============================================================================
// Resolution
// =============================================================================

/** How the game ended. */
export type ResolutionType =
  | "win"
  | "loss"
  | "draw"
  | "resign"
  | "disconnect"
  | "timeout"
  | "error";

/** Terminal resolution details. */
export interface SessionResolution {
  /** How the game ended. */
  type: ResolutionType;
  /** UIDs of the winner(s), if applicable. */
  winnerIds: string[];
  /** Human-readable reason (for error/timeout). */
  reason?: string;
}

// =============================================================================
// Game Session Document
// =============================================================================

/**
 * Full document shape for GameSessions/{sessionId}.
 *
 * Server-authoritative. Clients read-only (except for Moves create).
 */
export interface GameSessionV4 {
  /** Unique session ID (same as Firestore doc ID). */
  sessionId: string;

  /** Linked invite ID. */
  inviteId: string;

  /** Conversation ID (for membership validation). */
  conversationId: string;

  /** Conversation scope. */
  conversationScope: "dm" | "group";

  /** Canonical game identifier. */
  gameId: GameId;

  /** Runtime type. */
  runtimeType: GameRuntimeType;

  /** Current session status. */
  status: SessionStatus;

  /** UID of the session host. */
  hostId: string;

  /** Ordered list of player slots. */
  players: PlayerSlot[];

  /** Whether spectators are allowed. */
  spectatorsAllowed: boolean;

  /** Spectate mode. */
  spectateMode: SpectateMode;

  /** Active spectators. */
  spectators: SpectatorSlot[];

  /**
   * Game-specific settings (validated by the adapter's settings schema).
   * Immutable after game starts.
   */
  settings: Record<string, unknown>;

  // ── Turn-based fields ─────────────────────────────────────────────────

  /**
   * Ordered UIDs defining turn sequence.
   * Only populated for turnBased games.
   */
  turnOrder: string[];

  /** Index into turnOrder for the current turn. */
  currentTurnIndex: number;

  /** UID of the player whose turn it is. */
  currentTurnPlayerId: string | null;

  // ── Score ─────────────────────────────────────────────────────────────

  /** Compact scoreboard summary. */
  scoreboardSummary: ScoreSummaryEntry[];

  // ── Timestamps ────────────────────────────────────────────────────────

  /** When the session was created (server timestamp). */
  createdAt: TimestampLike;

  /** When the game was started (transition to active). */
  startedAt: TimestampLike | null;

  /** When the game was resolved. */
  resolvedAt: TimestampLike | null;

  // ── Resolution ────────────────────────────────────────────────────────

  /** Terminal resolution details. Null until resolved. */
  resolution: SessionResolution | null;

  // ── Integrity ─────────────────────────────────────────────────────────

  /** Anti-forgery and versioning envelope. */
  integrity: IntegrityEnvelope;

  // ── Reward tracking ───────────────────────────────────────────────────

  /** Whether rewards have been processed for this session. */
  rewardsProcessed: boolean;

  // ── Denormalized helpers (for Firestore rules / queries) ──────────────

  /**
   * Flat array of player UIDs (derived from players[].uid).
   * Maintained by Cloud Functions for Firestore security rules and queries,
   * since rules can't iterate lists of maps.
   */
  participantUids: string[];

  /**
   * Flat array of spectator UIDs (derived from spectators[].uid).
   */
  spectatorUids: string[];

  /**
   * Solo-only: timestamp when the player suspended the session via back arrow.
   * Null when actively playing. Set on suspend, cleared on resume.
   */
  soloSuspendedAt?: TimestampLike | null;

  // ── Persistent solo fields ────────────────────────────────────────────

  /**
   * Solo sub-mode controlling lifecycle policy.
   * Omitted or "standard" = current default. "persistent" = long-lived idle/incremental.
   */
  soloMode?: SoloMode;

  // ── Realtime-specific fields ──────────────────────────────────────────

  /**
   * Colyseus room name used by this session.
   * Only populated for realtime games. Set when lobby transitions to active.
   */
  realtimeRoomName?: string;

  /**
   * Colyseus room ID for this live match.
   * Written by the Colyseus server after room creation.
   * Used for debugging and reconnection routing.
   */
  realtimeRoomId?: string;

  /**
   * Match start policy for realtime games.
   * Controls when the match begins (e.g., "all players ready", "host starts").
   */
  realtimeMatchStartPolicy?:
    | "full_roster"
    | "min_players"
    | "host_start"
    | "countdown_on_min"
    | "immediate";

  /**
   * Disconnect policy for realtime games.
   * Defines behavior when a player disconnects mid-match.
   */
  realtimeDisconnectPolicy?:
    | "pause_match"
    | "continue_without_player"
    | "ai_takeover"
    | "forfeit_player"
    | "forfeit_team"
    | "spectate_on_disconnect"
    | "immediate_resolve";

  /**
   * Reconnect grace period in seconds for realtime games.
   * Players can reconnect within this window without penalty.
   */
  realtimeReconnectGraceSec?: number;

  /**
   * Whether the realtime room is currently live (heartbeat active).
   * Updated periodically by the RuntimeMirror.
   */
  realtimeRoomAlive?: boolean;

  /**
   * Timestamp of last heartbeat from the Colyseus room.
   */
  realtimeLastHeartbeat?: TimestampLike;

  /**
   * Timestamp of the last server-side simulation tick (epoch ms).
   * Used to compute deterministic offline progression on resume.
   * Only relevant for games with `supportsOfflineProgression`.
   */
  lastSimulatedAt?: TimestampLike | null;

  /**
   * Timestamp when the session was first opened (epoch ms).
   * Distinct from createdAt for future season-rollover logic.
   */
  runStartedAt?: TimestampLike | null;

  /**
   * Timestamp of the last server-side save (epoch ms).
   * Used for staleness checks and dedup guards.
   */
  lastServerSaveAt?: TimestampLike | null;
}

// =============================================================================
// Public State Subdocument
// =============================================================================

/**
 * GameSessions/{sessionId}/PublicState/{doc}
 *
 * Game-defined public state visible to all players and spectators.
 * Shape is adapter-specific; this type enforces the envelope.
 */
export interface PublicStateDoc {
  /** The game-specific public state. */
  publicState: Record<string, unknown>;
  /** When this state was last updated. */
  updatedAt: TimestampLike;
}

// =============================================================================
// Private State Subdocument
// =============================================================================

/**
 * GameSessions/{sessionId}/PrivateState/{uid}
 *
 * Per-player private state (e.g., hand cards in card games).
 * Only the owning player can read their own private state.
 */
export interface PrivateStateDoc {
  /** The game-specific private state for this player. */
  privateState: Record<string, unknown>;
  /** When this state was last updated. */
  updatedAt: TimestampLike;
}

// =============================================================================
// Move Subdocument
// =============================================================================

/**
 * GameSessions/{sessionId}/Moves/{moveId}
 *
 * A submitted move (intent). Written by clients.
 * Server validates, applies, and marks as committed or rejected.
 */
export interface MoveDoc {
  /** UID of the player who submitted the move. */
  uid: string;

  /** Game-specific move payload. */
  movePayload: Record<string, unknown>;

  /** When the move was submitted by the client. */
  createdAt: TimestampLike;

  /** When the server applied (or rejected) the move. */
  appliedAt: TimestampLike | null;

  /** Whether the move was committed or rejected. */
  status: "pending" | "committed" | "rejected";

  /** Rejection reason (if status = rejected). */
  rejectionReason?: string;

  /** Server state version after applying this move. */
  serverVersion: number;

  /** UID of the next turn player after this move (turn-based). */
  resultingTurnPlayerId: string | null;

  /** Score changes resulting from this move. */
  scoreDeltaSummary: ScoreSummaryEntry[] | null;
}
