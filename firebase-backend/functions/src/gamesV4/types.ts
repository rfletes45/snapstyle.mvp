/**
 * Games V4 — Backend Type Definitions
 *
 * Mirrors the client types from src/gamesV4/types for use in Cloud Functions.
 * This is the canonical backend reference. Keep in sync with the client types.
 *
 * @module gamesV4/types
 */

// =============================================================================
// Common
// =============================================================================

export type GameId =
  | "bounce_blitz"
  | "play_2048"
  | "brick_breaker"
  | "word_master"
  | "minesweeper"
  | "lights_out"
  | "solitaire_klondike"
  | "tic_tac_toe"
  | "chess"
  | "checkers"
  | "connect_four"
  | "gomoku"
  | "reversi"
  | "dots_and_boxes"
  | "crazy_eights"
  | "hex"
  | "pong_game"
  | "battleship"
  | "sketch_party_game"
  | "starforge_game"
  | "crossword_puzzle"
  | "knockout_game"
  | "minigolf_duels"
  | "dot_match"
  | "dead_drop";

export type GameRuntimeType = "solo" | "turnBased" | "realtime";

/**
 * Solo sub-mode that controls session lifecycle policy.
 * "standard"   — current behaviour (run-based, resign allowed).
 * "persistent" — long-lived idle/incremental (save on exit, resume later).
 */
export type SoloMode = "standard" | "persistent";
export type SpectateMode = "public_only" | "post_game_only" | "full_state";
export type TimestampLike = number | FirebaseFirestore.Timestamp;

export interface IntegrityEnvelope {
  version: number;
  schemaVersion: number;
  traceId: string;
}

export interface PlayerSlot {
  uid: string;
  slotIndex: number;
  teamId?: string;
  displayName?: string;
  avatarConfig?: Record<string, unknown>;
  profilePictureUrl?: string | null;
}

export interface SpectatorSlot {
  uid: string;
  joinedAt: TimestampLike;
}

export interface ScoreSummaryEntry {
  uid: string;
  displayName: string;
  score: number;
}

export interface InviteSummary {
  phase: "lobby" | "active" | "resolved";
  turnPlayerId: string | null;
  scoreSummary: ScoreSummaryEntry[];
  lastMoveAt: TimestampLike | null;
  lastActorId: string | null;
}

/** Lightweight profile snapshot embedded in the invite for lobby rendering. */
export interface ParticipantSummary {
  uid: string;
  displayName: string;
  profilePictureUrl: string | null;
}

// =============================================================================
// Invite
// =============================================================================

export type GameInviteStatus = "sent" | "lobby" | "active" | "resolved";

export const GAME_INVITE_STATUS_TRANSITIONS: Record<
  GameInviteStatus,
  GameInviteStatus[]
> = {
  sent: ["lobby", "resolved"],
  lobby: ["active", "resolved"],
  active: ["resolved"],
  resolved: [],
};

export function canTransitionInviteStatus(
  from: GameInviteStatus,
  to: GameInviteStatus,
): boolean {
  return GAME_INVITE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GameInviteV4 {
  inviteId: string;
  conversationId: string;
  conversationScope: "dm" | "group";
  gameId: GameId;
  runtimeType: GameRuntimeType;
  createdBy: string;
  status: GameInviteStatus;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  hostId: string;
  participantIds: string[];
  spectatorIds: string[];
  maxPlayers: number;
  allowSpectators: boolean;
  spectateMode: SpectateMode;
  sessionId: string | null;
  summary: InviteSummary;
  /** Lightweight profile snapshots for lobby rendering (players). */
  participantSummaries: ParticipantSummary[];
  /** Lightweight profile snapshots for lobby rendering (spectators). */
  spectatorSummaries: ParticipantSummary[];
  hiddenInChat: boolean;
  hiddenAt: TimestampLike | null;
  deleteRequestedAt: TimestampLike | null;
  deleteAt: TimestampLike | null;
}

// =============================================================================
// Session
// =============================================================================

export type SessionStatus =
  | "lobby_open"
  | "active"
  | "resolved"
  | "abandoned"
  | "expired";

export type ResolutionType =
  | "win"
  | "loss"
  | "draw"
  | "resign"
  | "disconnect"
  | "timeout"
  | "error";

export interface SessionResolution {
  type: ResolutionType;
  winnerIds: string[];
  reason?: string;
}

export interface GameSessionV4 {
  sessionId: string;
  inviteId: string;
  conversationId: string;
  conversationScope: "dm" | "group";
  gameId: GameId;
  runtimeType: GameRuntimeType;
  status: SessionStatus;
  hostId: string;
  players: PlayerSlot[];
  spectatorsAllowed: boolean;
  spectateMode: SpectateMode;
  spectators: SpectatorSlot[];
  settings: Record<string, unknown>;
  turnOrder: string[];
  currentTurnIndex: number;
  currentTurnPlayerId: string | null;
  scoreboardSummary: ScoreSummaryEntry[];
  createdAt: TimestampLike;
  startedAt: TimestampLike | null;
  resolvedAt: TimestampLike | null;
  resolution: SessionResolution | null;
  integrity: IntegrityEnvelope;
  rewardsProcessed: boolean;
  participantUids: string[];
  spectatorUids: string[];
  /**
   * Solo-only: timestamp when the player suspended the session via back arrow.
   * Null when actively playing. Set on suspend, cleared on resume.
   */
  soloSuspendedAt?: TimestampLike | null;

  // ── Persistent solo fields ─────────────────────────────────────────────────────

  /** Solo sub-mode ("standard" | "persistent"). */
  soloMode?: SoloMode;

  /** Timestamp of the last server-side simulation tick (epoch ms). */
  lastSimulatedAt?: TimestampLike | null;

  /** Timestamp when the run was first opened (epoch ms). */
  runStartedAt?: TimestampLike | null;

  /** Timestamp of the last server-side save (epoch ms). */
  lastServerSaveAt?: TimestampLike | null;

  // ── Realtime-specific fields ───────────────────────────────────────────────────

  /** Colyseus room name (e.g., "sketch_party"). Set when lobby → active. */
  realtimeRoomName?: string;

  /** Colyseus room ID for the live match instance. */
  realtimeRoomId?: string;

  /** Match start policy (e.g., "full_roster", "host_start"). */
  realtimeMatchStartPolicy?: string;

  /** Disconnect policy (e.g., "continue_without_player", "pause_match"). */
  realtimeDisconnectPolicy?: string;

  /** Reconnect grace period in seconds. */
  realtimeReconnectGraceSec?: number;

  /** Whether the realtime room is currently live (heartbeat). */
  realtimeRoomAlive?: boolean;

  /** Timestamp of last heartbeat from the Colyseus room. */
  realtimeLastHeartbeat?: TimestampLike;
}

export interface MoveDoc {
  uid: string;
  movePayload: Record<string, unknown>;
  createdAt: TimestampLike;
  appliedAt: TimestampLike | null;
  status: "pending" | "committed" | "rejected";
  rejectionReason?: string;
  serverVersion: number;
  resultingTurnPlayerId: string | null;
  scoreDeltaSummary: ScoreSummaryEntry[] | null;
}

// =============================================================================
// Result
// =============================================================================

export interface FinalScoreboardEntry {
  uid: string;
  displayName: string;
  avatarConfig?: Record<string, unknown>;
  profilePictureUrl?: string | null;
  score: number;
  placement: number;
  stats: Record<string, unknown>;
}

export interface XPAward {
  uid: string;
  baseXP: number;
  bonusXP: number;
  totalXP: number;
  bonusReason?: string;
  levelUp?: {
    oldLevel: number;
    newLevel: number;
    newXpToNextLevel: number;
  };
}

export interface AchievementUnlock {
  uid: string;
  achievementType: string;
  badgeId?: string;
  earnedAt: TimestampLike;
}

export interface LeaderboardUpdate {
  uid: string;
  gameId: GameId;
  weekKey: string;
  newScore: number;
  previousScore: number | null;
  newRank?: number;
}

export interface GameResultV4 {
  sessionId: string;
  inviteId: string;
  conversationId: string;
  gameId: GameId;
  resolutionType: ResolutionType;
  winnerIds: string[];
  scoreboard: FinalScoreboardEntry[];
  xpAwards: XPAward[];
  achievementUnlocks: AchievementUnlock[];
  leaderboardUpdates: LeaderboardUpdate[];
  durationMs: number;
  totalMoves: number;
  createdAt: TimestampLike;
  participantIds: string[];
  performanceMetrics: Record<string, unknown>;
}

// =============================================================================
// PB
// =============================================================================

export interface GamePBV4 {
  gameId: GameId;
  pbValue: number;
  pbMeta: Record<string, unknown>;
  achievedAt: TimestampLike;
  sessionId: string | null;
  totalPlays: number;
  totalWins: number;
  integrityHash: string;
  schemaVersion: number;
}

// =============================================================================
// Constants
// =============================================================================

export const COLLECTIONS = {
  GAME_INVITES: "GameInvitesV4",
  GAME_SESSIONS: "GameSessionsV4",
  PUBLIC_STATE: "PublicState",
  PRIVATE_STATE: "PrivateState",
  MOVES: "Moves",
  GAME_RESULTS: "GameResultsV4",
  GAME_PB: "GamePB",
  NOTIFICATIONS: "Notifications",
  LEADERBOARDS: "LeaderboardsV4",
  LEADERBOARD_WEEKS: "Weeks",
  LEADERBOARD_ENTRIES: "Entries",
  IN_APP_NOTIFICATIONS_V4: "InAppNotificationsV4",
} as const;

export const PINNED_INVITE_IDS_FIELD = "pinnedGameInviteIds" as const;

export const MAX_PINNED_INVITES = 5;
export const MAX_PLAYERS = 8;
export const RESOLVED_INVITE_TTL_MS = 60 * 60 * 1000;
export const LOBBY_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const PRESENCE_STALE_MS = 60 * 1000;

export const XP_CONFIG = {
  BASE_PARTICIPATION: 10,
  WIN_BONUS: 15,
  DRAW_BONUS: 5,
  MAX_PERFORMANCE_BONUS: 10,
  levelXpThreshold(level: number): number {
    return Math.floor(100 * Math.pow(1.2, level - 1));
  },
} as const;

// =============================================================================
// Leaderboard Metric Configuration (Backend)
// =============================================================================

/**
 * Determines how leaderboard scores are computed per game.
 *
 * - "wins": leaderboard score = cumulative win count (incremented on each win)
 * - "bestScore": leaderboard score = max(previous, current match score)
 */
export type LeaderboardMetric = "wins" | "bestScore";

export const LEADERBOARD_METRICS: Partial<Record<GameId, LeaderboardMetric>> = {
  tic_tac_toe: "wins",
  connect_four: "wins",
  play_2048: "bestScore",
  chess: "wins",
  sketch_party_game: "bestScore",
  battleship: "wins",
  brick_breaker: "bestScore",
  crazy_eights: "wins",
  minigolf_duels: "bestScore",
  minesweeper: "bestScore",
  solitaire_klondike: "bestScore",
  reversi: "wins",
  dots_and_boxes: "wins",
  hex: "wins",
  pong_game: "wins",
  knockout_game: "wins",
  dead_drop: "wins",
  // Default for unspecified games: "bestScore"
};

export function getLeaderboardMetric(gameId: GameId): LeaderboardMetric {
  return LEADERBOARD_METRICS[gameId] ?? "bestScore";
}
