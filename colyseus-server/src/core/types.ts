/**
 * Realtime Framework — Core Type Definitions
 *
 * Shared types for the generalized Colyseus-backed realtime game system.
 * These types define the contracts that all realtime games must work within.
 *
 * @module core/types
 */

// =============================================================================
// Simulation Profiles
// =============================================================================

/**
 * How the game simulation runs:
 * - "phase_event" — turn phases, timers, event-driven (e.g., drawing/guessing)
 * - "fixed_tick" — fixed-rate simulation loop (e.g., pong, tank battles)
 * - "hybrid_round_tick" — rounds with fixed-tick gameplay within (e.g., round-based combat)
 */
export type SimulationProfile =
  | "phase_event"
  | "fixed_tick"
  | "hybrid_round_tick";

// =============================================================================
// Room Lifecycle
// =============================================================================

/**
 * Standard room lifecycle states.
 * Games may use a subset, but the framework provides the full model.
 */
export type RoomPhase =
  | "provisioning" // Room created, waiting for configuration
  | "waiting_for_players" // Accepting player connections
  | "ready_check" // Optional ready-check before start
  | "countdown" // Pre-game countdown
  | "in_progress" // Active gameplay
  | "paused" // Gameplay suspended (e.g., all players disconnected temporarily)
  | "resolving" // Computing final results
  | "finished" // Results written, room winding down
  | "abandoned" // Room abandoned (grace period expired with no players)
  | "cancelled"; // Room cancelled before gameplay started

// =============================================================================
// Policies
// =============================================================================

/**
 * When the match is allowed to start.
 * - "full_roster" — all expected participants must be connected
 * - "min_roster" — at least minPlayers must be connected
 * - "host_ready" — host sends an explicit start command
 * - "auto_start_on_ready" — start when all connected players signal ready
 * - "countdown_start" — start after a countdown once minimum roster is met
 */
export type MatchStartPolicy =
  | "full_roster"
  | "min_roster"
  | "host_ready"
  | "auto_start_on_ready"
  | "countdown_start";

/**
 * What happens when a player disconnects.
 * - "no_reconnect" — player is immediately removed/forfeited
 * - "grace_reconnect" — player has graceWindowMs to reconnect
 * - "grace_then_forfeit" — grace window, then auto-forfeit
 * - "grace_then_no_contest" — grace window, then match is void/no-contest
 * - "immediate_elimination" — player is eliminated immediately
 * - "pause_until_return" — pause entire match until player returns
 * - "continue_without_player" — match continues, absent player loses turns/input
 */
export type DisconnectPolicy =
  | "no_reconnect"
  | "grace_reconnect"
  | "grace_then_forfeit"
  | "grace_then_no_contest"
  | "immediate_elimination"
  | "pause_until_return"
  | "continue_without_player";

/**
 * How late-joining is handled.
 * - "none" — no late joins after match starts
 * - "spectator_only" — late arrivals can only spectate
 * - "join_in_progress" — late arrivals can join active gameplay
 */
export type LateJoinPolicy = "none" | "spectator_only" | "join_in_progress";

/**
 * What conditions end the match.
 * - "score_target" — first to reach a score threshold
 * - "time_limit" — match ends after a time limit
 * - "round_limit" — match ends after N rounds
 * - "elimination" — last player/team standing
 * - "completion" — all turns/rounds played
 * - "custom" — game-specific logic decides
 */
export type MatchEndCondition =
  | "score_target"
  | "time_limit"
  | "round_limit"
  | "elimination"
  | "completion"
  | "custom";

// =============================================================================
// Spectator Support
// =============================================================================

/**
 * Spectator mode for the room.
 * - "none" — no spectators allowed
 * - "live_public" — spectators see public game state in real-time
 * - "live_delayed" — spectators see state with a configurable delay
 */
export type SpectatorMode = "none" | "live_public" | "live_delayed";

/**
 * Visibility scope for state fields or messages.
 * - "public" — visible to all including spectators
 * - "team_only" — visible only to team members
 * - "owner_only" — visible only to the owning player
 * - "spectator_safe" — explicitly marked safe for spectators
 * - "server_only" — never sent to any client
 */
export type VisibilityScope =
  | "public"
  | "team_only"
  | "owner_only"
  | "spectator_safe"
  | "server_only";

// =============================================================================
// Team Support
// =============================================================================

export interface TeamConfig {
  teamId: string;
  name: string;
  maxSize: number;
  color?: string;
}

// =============================================================================
// Player Info (Runtime)
// =============================================================================

export interface RealtimePlayerInfo {
  uid: string;
  displayName: string;
  colyseusSessionId: string;
  connected: boolean;
  connectedAt: number;
  disconnectedAt: number | null;
  teamId?: string;
  isSpectator: boolean;
  /** For reconnect grace tracking */
  reconnectDeadline: number | null;
}

// =============================================================================
// Message Protocol
// =============================================================================

/**
 * Definition for a typed message that the room accepts.
 */
export interface MessageDefinition<T = unknown> {
  /** Unique message type identifier */
  type: string;
  /** Validate the payload. Returns null if valid, error string if invalid. */
  validate: (payload: unknown) => string | null;
  /** Who can send this message */
  senderEligibility: "player" | "spectator" | "any";
  /** Which phases this message is allowed in */
  allowedPhases: RoomPhase[] | "any";
  /** Rate limit: minimum ms between messages from the same sender */
  rateLimitMs: number;
  /** Max burst count within rateLimitMs window. Default 1. */
  burstLimit?: number;
  /** Optional: additional check before processing */
  preCheck?: (senderUid: string, payload: T, phase: RoomPhase) => string | null;
}

// =============================================================================
// Resolution Bridge Payload
// =============================================================================

/**
 * Terminal resolution payload written to Firestore by the room.
 * Consumed by the `onRealtimeResolutionRequest` trigger.
 */
export interface RealtimeResolutionPayload {
  /** Unique request ID for idempotency */
  requestId: string;
  /** V4 session ID */
  sessionId: string;
  /** Game identifier */
  gameId: string;
  /** Room version (monotonic, for ordering) */
  roomVersion: number;
  /** When the match ended (epoch ms) */
  endedAt: number;
  /** How the match ended */
  reason:
    | "complete"
    | "disconnect"
    | "timeout"
    | "abandoned"
    | "error"
    | "cancelled";
  /** Resolution type for the V4 pipeline */
  resolutionType: "win" | "draw" | "disconnect" | "timeout" | "error";
  /** Winner UIDs (empty for draw/no-contest) */
  winnerIds: string[];
  /** Full scoreboard */
  scoreboard: RealtimeScoreboardEntry[];
  /** Match duration in milliseconds */
  durationMs: number;
  /** Per-player performance metrics */
  playerMetrics: Record<string, Record<string, unknown>>;
  /** Flags for special conditions */
  flags: {
    noContest?: boolean;
    disconnectAbandonment?: boolean;
    partialRoster?: boolean;
    timedOut?: boolean;
  };
  /** Server timestamp - set by Firestore */
  requestedAt?: unknown; // FieldValue.serverTimestamp()
}

export interface RealtimeScoreboardEntry {
  uid: string;
  displayName: string;
  score: number;
  placement: number;
  stats: Record<string, unknown>;
}

// =============================================================================
// Runtime Summary (Firestore mirror for debugging/visibility)
// =============================================================================

/**
 * Low-frequency summary written to Firestore for debugging,
 * reconnect UX, and stale room cleanup. NOT tick-authoritative.
 */
export interface RuntimeSummary {
  roomId: string;
  sessionId: string;
  gameId: string;
  phase: RoomPhase;
  connectedPlayerCount: number;
  connectedPlayerUids: string[];
  spectatorCount: number;
  startedAt: number | null;
  lastHeartbeatAt: number;
  roomVersion: number;
  abandonmentFlag: boolean;
  pauseFlag: boolean;
  /** Optional region/process metadata */
  meta?: Record<string, unknown>;
}

// =============================================================================
// Game Definition Contract
// =============================================================================

/**
 * The definition contract each realtime game must implement.
 * This is the game-specific configuration that plugs into BaseRealtimeRoom.
 */
export interface RealtimeGameDefinition {
  /** Canonical game ID (matches GameId union) */
  gameId: string;
  /** Colyseus room name for registration */
  roomName: string;
  /** How the simulation runs */
  simulationProfile: SimulationProfile;
  /** Default game settings */
  defaultSettings: Record<string, unknown>;
  /** Validate settings patch, returns validated settings */
  validateSettings: (
    settings: Record<string, unknown>,
  ) => Record<string, unknown>;

  // ── Player/Team configuration ────────────────────────────────────────
  minPlayers: number;
  maxPlayers: number;
  /** Team configuration. Null for FFA games. */
  teams: TeamConfig[] | null;

  // ── Policies ─────────────────────────────────────────────────────────
  matchStartPolicy: MatchStartPolicy;
  disconnectPolicy: DisconnectPolicy;
  lateJoinPolicy: LateJoinPolicy;
  matchEndConditions: MatchEndCondition[];

  // ── Spectators ───────────────────────────────────────────────────────
  supportsSpectate: boolean;
  spectatorMode: SpectatorMode;
  /** Delay in ms for "live_delayed" spectator mode */
  spectatorDelayMs?: number;

  // ── Reconnect ────────────────────────────────────────────────────────
  /** Grace window in ms for reconnection. 0 = no grace. */
  reconnectGraceMs: number;

  // ── Join Grace ────────────────────────────────────────────────────────
  /**
   * Maximum time (ms) to wait for full roster before aborting or
   * starting with available players.  Only relevant when
   * `matchStartPolicy` is `"full_roster"`.
   *
   * 0 = wait indefinitely (legacy behaviour).
   * When the timer expires the room is cancelled as "no-show" if
   * fewer than `minPlayers` have connected, or started with the
   * available players otherwise.
   */
  joinGraceMs: number;

  // ── Timing ───────────────────────────────────────────────────────────
  /** Countdown duration in seconds before match starts. 0 = no countdown. */
  countdownSec: number;
  /** For fixed_tick: simulation tick rate in Hz. Null for phase_event. */
  tickRate: number | null;
  /**
   * How often (Hz) the full game state is broadcast to clients.
   * Defaults to 1 Hz for event-driven games.
   * Physics games should set this higher (e.g., 20) so clients
   * receive authoritative snapshots frequently enough to interpolate.
   */
  stateBroadcastHz?: number;
  /** Maximum match duration in ms. Null for unlimited. */
  maxMatchDurationMs: number | null;
  /** Time in ms to wait before disposing room after match ends */
  postMatchDisposalDelayMs: number;
  /** Grace period in ms before declaring room abandoned when all disconnect */
  abandonmentGraceMs: number;

  // ── Capabilities ─────────────────────────────────────────────────────
  /** Whether players can resign/forfeit */
  allowResign: boolean;
  /** Whether the match can be paused */
  allowPause: boolean;
  /** Whether hidden information exists per-player */
  hasHiddenInfo: boolean;

  // ── Messages ─────────────────────────────────────────────────────────
  /** Message definitions the room accepts */
  messages: MessageDefinition[];

  // ── Leaderboard ──────────────────────────────────────────────────────
  /** How leaderboard scores are computed: "wins" or "bestScore" */
  leaderboardMetric: "wins" | "bestScore";
}
