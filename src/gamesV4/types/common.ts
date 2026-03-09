/**
 * Games V4 — Common Types
 *
 * Canonical type definitions shared across client and backend.
 * These are the single source of truth for the V4 game system.
 *
 * @module gamesV4/types/common
 */

// =============================================================================
// Game Identity
// =============================================================================

/**
 * Canonical game IDs for all supported games.
 * These IDs are stable and referenced in Firestore data, routing, and adapters.
 * NEVER rename or remove an existing ID — only append new ones.
 */
export type GameId =
  // Solo
  | "bounce_blitz"
  | "play_2048"
  | "brick_breaker"
  | "word_master"
  | "minesweeper"
  | "lights_out"
  | "solitaire_klondike"
  // Turn-based
  | "tic_tac_toe"
  | "chess"
  | "checkers"
  | "connect_four"
  | "gomoku"
  | "reversi"
  | "dots_and_boxes"
  | "crazy_eights"
  // Realtime
  | "pong_game"
  | "battleship"
  | "sketch_party_game"
  | "starforge_game"
  | "crossword_puzzle"
  | "minigolf_duels"
  | "dot_match";

/** Runtime classification for a game. */
export type GameRuntimeType = "solo" | "turnBased" | "realtime";

/**
 * Solo sub-mode that controls session lifecycle policy.
 *
 * - "standard"   — current behaviour: run-based, resign allowed, sessions
 *                   may be resolved on exit or restart.
 * - "persistent" — long-lived idle/incremental: always save on exit,
 *                   resume on re-entry, no resign action, explicit
 *                   archive/reset flow for finalization.
 */
export type SoloMode = "standard" | "persistent";

/** Spectate mode controlling what spectators can see. */
export type SpectateMode = "public_only" | "post_game_only" | "full_state";

// =============================================================================
// Timestamps & Integrity
// =============================================================================

/** Firestore Timestamp (server) or epoch millis (client). */
export type TimestampLike = number;

/** Integrity envelope for anti-forgery and versioning. */
export interface IntegrityEnvelope {
  /** Monotonically increasing version; incremented on each state mutation. */
  version: number;
  /** Schema version of the game state format. */
  schemaVersion: number;
  /** End-to-end trace ID for debugging. */
  traceId: string;
}

// =============================================================================
// Player Slot
// =============================================================================

/** A player slot in a session or invite. */
export interface PlayerSlot {
  uid: string;
  slotIndex: number;
  teamId?: string;
  displayName?: string;
  avatarConfig?: Record<string, unknown>;
  profilePictureUrl?: string | null;
}

/** A spectator slot. */
export interface SpectatorSlot {
  uid: string;
  joinedAt: TimestampLike;
}

// =============================================================================
// Score Summary (compact, for invite cards)
// =============================================================================

/** Compact per-player score entry for summary display. */
export interface ScoreSummaryEntry {
  uid: string;
  displayName: string;
  score: number;
}

/** Compact summary written to invite doc for real-time card updates. */
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
