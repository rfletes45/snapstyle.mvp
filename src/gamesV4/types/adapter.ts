/**
 * Games V4 — Game Adapter Interface
 *
 * Defines the contract that every game must implement.
 * Adapters are shared between client (for optimistic validation)
 * and server (for authoritative validation).
 *
 * @module gamesV4/types/adapter
 */

import type { ScoreboardDescriptor } from "../constants";
import type { GameId, GameRuntimeType, SpectateMode } from "./common";

// =============================================================================
// Settings Schema
// =============================================================================

/**
 * A settings field definition for the lobby UI.
 */
export interface SettingsFieldDef {
  key: string;
  label: string;
  type: "number" | "boolean" | "select";
  default: unknown;
  /** For "number" type: min/max range and step increment. */
  min?: number;
  max?: number;
  step?: number;
  /** For "select" type: allowed values. */
  options?: Array<{ label: string; value: unknown }>;
}

// =============================================================================
// Validation Result
// =============================================================================

/** Result of a move validation. */
export interface MoveValidationResult {
  /** Whether the move is valid. */
  ok: boolean;
  /** Error message if not ok. */
  error?: string;
  /** The new public state after applying the move. */
  nextPublicState?: Record<string, unknown>;
  /** Private state changes (keyed by uid). */
  nextPrivateState?: Record<string, Record<string, unknown>>;
  /** Score delta per player. */
  scoreDelta?: Array<{ uid: string; delta: number }>;
  /** Whether the turn advances to the next player. */
  turnAdvance?: boolean;
  /** Override the next turn player ID (for games with non-round-robin turn order). */
  nextTurnPlayerId?: string;
  /** Whether the game is now terminal (win/draw/etc). */
  terminal?: {
    type: "win" | "draw" | "timeout";
    winnerIds?: string[];
    reason?: string;
  };
}

// =============================================================================
// Outcome
// =============================================================================

/** Final game outcome computed by the adapter. */
export interface GameOutcome {
  winnerIds: string[];
  finalScoreboard: Array<{
    uid: string;
    score: number;
    placement: number;
    stats: Record<string, unknown>;
  }>;
}

// =============================================================================
// Game Adapter Interface
// =============================================================================

/**
 * The contract every game adapter must fulfill.
 * Adapters are stateless — they receive state and return new state.
 */
export interface GameAdapterV4 {
  /** Canonical game ID. */
  gameId: GameId;

  /** Runtime classification. */
  runtimeType: GameRuntimeType;

  /** Maximum number of players. */
  maxPlayers: number;

  /** Minimum number of players to start. */
  minPlayers: number;

  /** Whether this game supports spectating. */
  supportsSpectate: boolean;

  /** Spectate mode if spectating is supported. */
  spectateMode: SpectateMode;

  /** Optional scoreboard formatting for the Game Over screen. */
  scoreboardDescriptor?: ScoreboardDescriptor;

  /** Settings schema for lobby UI. */
  settingsSchema: SettingsFieldDef[];

  /** Default settings values. */
  defaultSettings: Record<string, unknown>;

  // ── State model ─────────────────────────────────────────────────────

  /** Create initial public state for a new game. */
  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, unknown>;

  /** Create initial private state for each player (optional). */
  createInitialPrivateState?(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, Record<string, unknown>>;

  // ── Turn-based ──────────────────────────────────────────────────────

  /**
   * Validate and apply a move.
   * Must be deterministic and produce the same result on client and server.
   */
  validateMove?(
    publicState: Record<string, unknown>,
    privateStateByPlayer: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult;

  /**
   * Compute a summary from the current state (for invite card rendering).
   */
  computeSummary?(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; displayName: string }>,
    currentTurnPlayerId: string | null,
  ): {
    turnPlayerId: string | null;
    scoreSummary: Array<{ uid: string; displayName: string; score: number }>;
  };

  /**
   * Compute the final game outcome from the current state.
   */
  computeOutcome?(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome;

  // ── Spectator ──────────────────────────────────────────────────────

  /**
   * Filter public state for spectators (strip any private info leaks).
   * Defaults to returning publicState as-is if not implemented.
   */
  getSpectatorView?(
    publicState: Record<string, unknown>,
  ): Record<string, unknown>;

  // ── Performance metrics ────────────────────────────────────────────

  /**
   * Extract performance metrics from the final state for XP scaling.
   */
  extractPerformanceMetrics?(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string }>,
  ): Record<string, unknown>;

  // ── Settings validation ────────────────────────────────────────────

  /**
   * Validate a settings patch from the host lobby.
   * Returns the validated settings or throws on invalid input.
   */
  validateSettings?(patch: Record<string, unknown>): Record<string, unknown>;
}
