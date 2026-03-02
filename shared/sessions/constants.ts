/**
 * Shared Session Constants — v3 Game Session Architecture
 *
 * Canonical status enums, phase transitions, and collection paths
 * shared between client, Cloud Functions, and Colyseus server.
 *
 * @module shared/sessions/constants
 */

// =============================================================================
// Session Phase (lifecycle state machine)
// =============================================================================

/**
 * The canonical lifecycle phases of a v3 game session.
 *
 * Transition graph:
 *   lobby → starting → active → finishing → resolved
 *                                         ↘ abandoned
 *   lobby → abandoned  (host cancels or timeout)
 *   lobby → expired    (no activity within TTL)
 *
 * Only forward transitions are permitted (no going back to "lobby" once
 * "active"). The Cloud Function enforces this via `canTransitionPhase()`.
 */
export const SESSION_PHASES = [
  "lobby",
  "starting",
  "active",
  "finishing",
  "resolved",
  "abandoned",
  "expired",
] as const;

export type SessionPhase = (typeof SESSION_PHASES)[number];

/**
 * Allowed phase transitions — used by both client guards and server
 * callable validation. Key = current phase, value = set of valid next phases.
 */
export const SESSION_PHASE_TRANSITIONS: Record<
  SessionPhase,
  readonly SessionPhase[]
> = {
  lobby: ["starting", "abandoned", "expired"],
  starting: ["active", "abandoned"],
  active: ["finishing", "abandoned"],
  finishing: ["resolved", "abandoned"],
  resolved: [], // terminal
  abandoned: [], // terminal
  expired: [], // terminal
} as const;

/**
 * Phases that are "terminal" — session is done and no further transitions
 * are allowed. Used for UI rendering (hide lobby, show result) and
 * subscription teardown.
 */
export const TERMINAL_PHASES = new Set<SessionPhase>([
  "resolved",
  "abandoned",
  "expired",
]);

/** Validate a phase transition. */
export function canTransitionPhase(
  from: SessionPhase,
  to: SessionPhase,
): boolean {
  return (SESSION_PHASE_TRANSITIONS[from] as readonly string[]).includes(to);
}

// =============================================================================
// Participant Role
// =============================================================================

export const PARTICIPANT_ROLES = ["host", "player", "spectator"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

// =============================================================================
// Participant Status (within a session)
// =============================================================================

export const PARTICIPANT_STATUSES = [
  "invited",
  "joined",
  "ready",
  "playing",
  "finished",
  "left",
  "disconnected",
] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

// =============================================================================
// Session Visibility
// =============================================================================

export const SESSION_VISIBILITIES = ["private", "friends", "public"] as const;
export type SessionVisibility = (typeof SESSION_VISIBILITIES)[number];

// =============================================================================
// Entry Source — how the user entered the session
// =============================================================================

export const SESSION_ENTRY_SOURCES = [
  "chat",
  "play",
  "recovery",
  "deeplink",
  "invite_pill",
] as const;
export type SessionEntrySource = (typeof SESSION_ENTRY_SOURCES)[number];

// =============================================================================
// Collection Paths
// =============================================================================

/** Firestore collection path for v3 session documents */
export const SESSIONS_COLLECTION = "GameSessions" as const;

/**
 * Sessions TTL — how long a session in "lobby" stays alive without
 * any joins before the watchdog marks it expired.
 */
export const SESSION_LOBBY_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Sessions active TTL — how long an "active" session can live without
 * any heartbeat before the watchdog marks it abandoned.
 */
export const SESSION_ACTIVE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// =============================================================================
// Capacity
// =============================================================================

/**
 * Default max participants per session (excluding spectators).
 * Override per-game via GameMetadata or session creation params.
 */
export const DEFAULT_MAX_PARTICIPANTS = 2;

/** Max spectators per session */
export const DEFAULT_MAX_SPECTATORS = 10;

// =============================================================================
// External Colyseus Game Types
// =============================================================================

/**
 * Games that run as external Colyseus real-time rooms and do NOT create a
 * `TurnBasedGames` doc. Shared across the client, Cloud Functions, and
 * Colyseus server to prevent divergence.
 *
 * If you add a new real-time Colyseus game, add it here — all three
 * environments pick up the change automatically.
 */
export const EXTERNAL_COLYSEUS_GAME_TYPES = [
  "crazy_eights",
  "starforge_game",
  "sketch_party_game",
  "crossword_puzzle",
  "pong_game",
  "minigolf_duels",
  "battleship",
] as const;

export type ExternalColyseusGameType =
  (typeof EXTERNAL_COLYSEUS_GAME_TYPES)[number];

/** Pre-built Set for O(1) lookups */
export const EXTERNAL_COLYSEUS_GAME_TYPE_SET: ReadonlySet<string> = new Set(
  EXTERNAL_COLYSEUS_GAME_TYPES,
);
