/**
 * Game Error Codes & Recovery Actions
 *
 * Canonical error taxonomy for the entire game system.
 * Used by Colyseus hooks, invite services, and UI overlays
 * to provide structured, actionable error handling.
 *
 * @see docs/GAME_SYSTEM_REFERENCE.md §12 (Feature Flags)
 */

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Exhaustive error code enum for all game-related failures.
 *
 * Naming convention:  CATEGORY_SPECIFIC_FAULT
 *   Categories: JOIN, AUTH, INVITE, ROOM, NETWORK, PROTOCOL, LOBBY, STATE
 */
export enum GameErrorCode {
  // ── Join / Connection ─────────────────────────────────────────────────────
  /** Colyseus joinOrCreate failed (generic) */
  JOIN_FAILED = "JOIN_FAILED",
  /** Room name could not be resolved from game type */
  JOIN_ROOM_NOT_FOUND = "JOIN_ROOM_NOT_FOUND",
  /** Room is full (maxClients reached) */
  JOIN_ROOM_FULL = "JOIN_ROOM_FULL",
  /** filterBy match found no room and create was rejected */
  JOIN_CREATE_REJECTED = "JOIN_CREATE_REJECTED",
  /** Client timed-out waiting for joinOrCreate to resolve */
  JOIN_TIMEOUT = "JOIN_TIMEOUT",
  /** A join is already in-flight (idempotency guard) */
  JOIN_ALREADY_IN_PROGRESS = "JOIN_ALREADY_IN_PROGRESS",

  // ── Auth ──────────────────────────────────────────────────────────────────
  /** Firebase ID token missing or expired */
  AUTH_TOKEN_MISSING = "AUTH_TOKEN_MISSING",
  /** Server rejected the token (invalid / revoked) */
  AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID",
  /** User not signed in */
  AUTH_NOT_SIGNED_IN = "AUTH_NOT_SIGNED_IN",

  // ── Invite / Lobby ────────────────────────────────────────────────────────
  /** Invite document not found or already consumed */
  INVITE_NOT_FOUND = "INVITE_NOT_FOUND",
  /** Invite has expired (past TTL) */
  INVITE_EXPIRED = "INVITE_EXPIRED",
  /** Invite was cancelled by the host */
  INVITE_CANCELLED = "INVITE_CANCELLED",
  /** All slots already claimed */
  INVITE_SLOTS_FULL = "INVITE_SLOTS_FULL",
  /** User is not eligible for this invite */
  INVITE_NOT_ELIGIBLE = "INVITE_NOT_ELIGIBLE",
  /** startGameEarly failed (e.g. not enough players) */
  INVITE_START_FAILED = "INVITE_START_FAILED",

  // ── Lobby / Waiting ───────────────────────────────────────────────────────
  /** Nobody joined within the lobby timeout window */
  LOBBY_TIMEOUT = "LOBBY_TIMEOUT",
  /** A player disconnected during countdown */
  LOBBY_PLAYER_LEFT = "LOBBY_PLAYER_LEFT",
  /** Invite shows full/ready but room never advanced to playing */
  STUCK_WAITING = "STUCK_WAITING",

  // ── Room / Session ────────────────────────────────────────────────────────
  /** Unexpected room disposal while still playing */
  ROOM_DISPOSED = "ROOM_DISPOSED",
  /** onLeave fired with a non-consented code */
  ROOM_KICKED = "ROOM_KICKED",
  /** Server-side error broadcast */
  ROOM_SERVER_ERROR = "ROOM_SERVER_ERROR",
  /** No state patches for too long while phase is "playing" */
  ROOM_STALE = "ROOM_STALE",

  // ── Network ───────────────────────────────────────────────────────────────
  /** WebSocket dropped (onDrop) */
  NETWORK_DISCONNECTED = "NETWORK_DISCONNECTED",
  /** Reconnection attempts exhausted */
  NETWORK_RECONNECT_FAILED = "NETWORK_RECONNECT_FAILED",
  /** Server health-check unreachable */
  NETWORK_SERVER_UNREACHABLE = "NETWORK_SERVER_UNREACHABLE",

  // ── Protocol ──────────────────────────────────────────────────────────────
  /** Client protocolVersion does not match server's expected version */
  PROTOCOL_VERSION_MISMATCH = "PROTOCOL_VERSION_MISMATCH",

  // ── State / Persistence ───────────────────────────────────────────────────
  /** Failed to save game state to Firestore */
  STATE_SAVE_FAILED = "STATE_SAVE_FAILED",
  /** Failed to load suspended game from Firestore */
  STATE_LOAD_FAILED = "STATE_LOAD_FAILED",
  /** Game state document was corrupted or missing fields */
  STATE_CORRUPT = "STATE_CORRUPT",

  // ── Catch-all ─────────────────────────────────────────────────────────────
  /** An error that doesn't fit any other category */
  UNKNOWN = "UNKNOWN",
}

// =============================================================================
// Recovery Actions
// =============================================================================

/**
 * Identifiers for recovery actions the UI can offer the player.
 */
export type GameRecoveryActionId =
  | "retry_join"
  | "rejoin_room"
  | "reset_lobby"
  | "switch_mode"
  | "cancel_invite"
  | "report_bug";

/**
 * A concrete recovery the UI can render as a button.
 */
export interface GameRecoveryAction {
  id: GameRecoveryActionId;
  label: string;
}

// =============================================================================
// GameError type
// =============================================================================

/**
 * Structured game error passed through hooks → UI.
 */
export interface GameError {
  /** Machine-readable code */
  code: GameErrorCode;
  /** Developer-facing message (logged, not shown to users directly) */
  message: string;
  /** Arbitrary metadata (roomId, gameType, traceId, …) */
  context?: Record<string, unknown>;
  /** Ordered list of recovery actions the UI should offer */
  recoveries?: GameRecoveryAction[];
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Default user-facing strings keyed by error code.
 * UI components can override these, but this gives a sensible baseline.
 */
const USER_MESSAGES: Record<GameErrorCode, string> = {
  [GameErrorCode.JOIN_FAILED]:
    "Couldn't connect to the game. Please try again.",
  [GameErrorCode.JOIN_ROOM_NOT_FOUND]:
    "This game type isn't available right now.",
  [GameErrorCode.JOIN_ROOM_FULL]: "The room is already full.",
  [GameErrorCode.JOIN_CREATE_REJECTED]:
    "Couldn't create the game room. Please try again.",
  [GameErrorCode.JOIN_TIMEOUT]:
    "Connection timed out. Check your internet and try again.",
  [GameErrorCode.JOIN_ALREADY_IN_PROGRESS]:
    "Already connecting — please wait a moment.",

  [GameErrorCode.AUTH_TOKEN_MISSING]: "Please sign in to play.",
  [GameErrorCode.AUTH_TOKEN_INVALID]:
    "Your session has expired. Please sign in again.",
  [GameErrorCode.AUTH_NOT_SIGNED_IN]: "Please sign in to play.",

  [GameErrorCode.INVITE_NOT_FOUND]: "This invite is no longer available.",
  [GameErrorCode.INVITE_EXPIRED]: "This invite has expired.",
  [GameErrorCode.INVITE_CANCELLED]: "The host cancelled this invite.",
  [GameErrorCode.INVITE_SLOTS_FULL]: "All spots have been taken.",
  [GameErrorCode.INVITE_NOT_ELIGIBLE]: "You're not eligible for this invite.",
  [GameErrorCode.INVITE_START_FAILED]:
    "Couldn't start the game. Not enough players.",

  [GameErrorCode.LOBBY_TIMEOUT]:
    "No opponent joined in time. The lobby has closed.",
  [GameErrorCode.LOBBY_PLAYER_LEFT]:
    "Your opponent left before the game could start.",
  [GameErrorCode.STUCK_WAITING]:
    "The game appears stuck. All players are ready but the game hasn\u2019t started.",

  [GameErrorCode.ROOM_DISPOSED]: "The game room was closed unexpectedly.",
  [GameErrorCode.ROOM_KICKED]: "You were removed from the game.",
  [GameErrorCode.ROOM_SERVER_ERROR]:
    "Something went wrong on the server. Please try again.",
  [GameErrorCode.ROOM_STALE]:
    "No response from the game server. The connection may have dropped.",

  [GameErrorCode.NETWORK_DISCONNECTED]:
    "Lost connection. Attempting to reconnect…",
  [GameErrorCode.NETWORK_RECONNECT_FAILED]:
    "Couldn't reconnect. Please rejoin the game.",
  [GameErrorCode.NETWORK_SERVER_UNREACHABLE]:
    "Can't reach the game server. Check your connection.",

  [GameErrorCode.PROTOCOL_VERSION_MISMATCH]:
    "Your app is out of date. Please update to continue playing.",

  [GameErrorCode.STATE_SAVE_FAILED]:
    "Couldn't save your game. Progress may be lost.",
  [GameErrorCode.STATE_LOAD_FAILED]:
    "Couldn't restore your saved game. It may have expired.",
  [GameErrorCode.STATE_CORRUPT]:
    "Saved game data was corrupted and couldn't be loaded.",

  [GameErrorCode.UNKNOWN]: "Something went wrong. Please try again.",
};

/**
 * Get a user-friendly message for a GameErrorCode.
 */
export function getUserMessage(code: GameErrorCode): string {
  return USER_MESSAGES[code] ?? USER_MESSAGES[GameErrorCode.UNKNOWN];
}

/**
 * Default recovery actions per error code.
 * Hooks/UI can override, but this is the sensible default set.
 */
const DEFAULT_RECOVERIES: Partial<Record<GameErrorCode, GameRecoveryAction[]>> =
  {
    [GameErrorCode.JOIN_FAILED]: [
      { id: "retry_join", label: "Try Again" },
      { id: "cancel_invite", label: "Cancel" },
    ],
    [GameErrorCode.JOIN_TIMEOUT]: [
      { id: "retry_join", label: "Retry" },
      { id: "reset_lobby", label: "Back to Lobby" },
    ],
    [GameErrorCode.NETWORK_DISCONNECTED]: [
      { id: "rejoin_room", label: "Reconnect" },
    ],
    [GameErrorCode.NETWORK_RECONNECT_FAILED]: [
      { id: "rejoin_room", label: "Rejoin" },
      { id: "reset_lobby", label: "Back to Lobby" },
    ],
    [GameErrorCode.LOBBY_TIMEOUT]: [
      { id: "retry_join", label: "Try Again" },
      { id: "cancel_invite", label: "Leave" },
    ],
    [GameErrorCode.STUCK_WAITING]: [
      { id: "rejoin_room", label: "Rejoin Room" },
      { id: "reset_lobby", label: "Reset Lobby" },
      { id: "report_bug", label: "Report Bug" },
      { id: "cancel_invite", label: "Cancel Invite" },
    ],
    [GameErrorCode.ROOM_STALE]: [
      { id: "rejoin_room", label: "Resync" },
      { id: "report_bug", label: "Report Bug" },
    ],
    [GameErrorCode.PROTOCOL_VERSION_MISMATCH]: [
      { id: "switch_mode", label: "Update App" },
    ],
    [GameErrorCode.STATE_LOAD_FAILED]: [
      { id: "retry_join", label: "Retry" },
      { id: "reset_lobby", label: "New Game" },
    ],
    [GameErrorCode.UNKNOWN]: [
      { id: "retry_join", label: "Try Again" },
      { id: "report_bug", label: "Report Bug" },
    ],
  };

/**
 * Build a full GameError with defaults pre-populated.
 */
export function createGameError(
  code: GameErrorCode,
  overrides?: {
    message?: string;
    context?: Record<string, unknown>;
    recoveries?: GameRecoveryAction[];
  },
): GameError {
  return {
    code,
    message: overrides?.message ?? getUserMessage(code),
    context: overrides?.context,
    recoveries: overrides?.recoveries ?? DEFAULT_RECOVERIES[code],
  };
}
