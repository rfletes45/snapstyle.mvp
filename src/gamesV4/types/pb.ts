/**
 * Games V4 — Personal Best Types
 *
 * Users/{uid}/GamePB/{gameId} — server-written only.
 * Stores the personal best record for each game.
 * PBs NEVER reference local history scores — they are server-authoritative.
 *
 * @module gamesV4/types/pb
 */

import type { GameId, TimestampLike } from "./common";

// =============================================================================
// Personal Best Document
// =============================================================================

/**
 * Full document shape for Users/{uid}/GamePB/{gameId}.
 *
 * Server-written only. Clients read for profile display.
 * The pbWriter in resolveSessionInternal writes this only if the new
 * score exceeds the existing PB (or if no PB exists).
 */
export interface GamePBV4 {
  /** Canonical game identifier (same as Firestore doc ID). */
  gameId: GameId;

  /** The personal best value (interpretation is game-specific, e.g., score, time). */
  pbValue: number;

  /** Game-specific PB metadata (e.g., difficulty level, mode). */
  pbMeta: Record<string, unknown>;

  /** When the PB was achieved (server timestamp). */
  achievedAt: TimestampLike;

  /** Session ID that produced this PB (nullable for legacy). */
  sessionId: string | null;

  /** Number of times this player has played this game. */
  totalPlays: number;

  /** Number of wins in this game. */
  totalWins: number;

  // ── Anti-forgery ──────────────────────────────────────────────────────

  /**
   * Server-computed hash of the session result that produced this PB.
   * Used to verify PB provenance. Format: SHA-256 of
   * `${sessionId}:${uid}:${pbValue}:${serverSecret}`.
   */
  integrityHash: string;

  /** Schema version for forward compatibility. */
  schemaVersion: number;
}
