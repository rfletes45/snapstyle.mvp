/**
 * GameResultFacts — Unified result snapshot contract
 *
 * A single, game-agnostic type that captures everything needed to:
 *   1. Display the SessionGameOverScreen (scoreboard, key stats, outcome)
 *   2. Submit results to the XP/achievement pipeline (cf `onGameResult`)
 *   3. Populate leaderboard deltas
 *
 * Both solo and multiplayer games produce a `GameResultFacts` at
 * completion time. The runtime shells (SoloRuntimeShell,
 * MultiplayerRuntimeShell) consume this to drive the end-game flow.
 *
 * Game adapters implement `getResultSnapshot(state)` to extract this
 * from their internal state.
 *
 * @module types/gameResultFacts
 */

import type { GameMode, GameOutcome } from "./gameResult";
import type { ExtendedGameType } from "./games";

// =============================================================================
// Scoreboard
// =============================================================================

/**
 * A single row in the post-game scoreboard.
 * Ordered by the game adapter (winner first, then by score desc).
 */
export interface ScoreboardEntry {
  /** Firebase UID */
  uid: string;
  /** Display name */
  displayName: string;
  /** Avatar URL (optional) */
  avatarUrl?: string;
  /** Numeric score (game-specific meaning) */
  score?: number;
  /** Formatted score string for display (e.g. "3 wins", "42s") */
  formattedScore?: string;
  /** Player outcome */
  outcome: GameOutcome;
  /** Whether this player won */
  isWinner: boolean;
}

// =============================================================================
// Performance Metrics
// =============================================================================

/**
 * Game-specific key stats displayed on the end screen.
 * Each entry is a label + value pair for flexible rendering.
 */
export interface PerformanceMetric {
  /** Short label (e.g. "Accuracy", "Moves", "Time") */
  label: string;
  /** Display value (e.g. "87%", "42", "1:23") */
  value: string;
  /** Optional icon name (MaterialCommunityIcons) */
  icon?: string;
}

// =============================================================================
// Turn Summary
// =============================================================================

/**
 * A per-player turn summary row for turn-based games.
 * Provides aggregate stats (moves, captures, time) that turn summary
 * cards can render without requiring the full move history.
 */
export interface TurnSummaryEntry {
  /** Firebase UID */
  uid: string;
  /** Display name */
  displayName: string;
  /** Total moves made */
  moveCount: number;
  /** Average time per turn in ms (optional — only for timed games) */
  avgTurnTimeMs?: number;
  /** Total captures / pieces taken (game-specific) */
  captures?: number;
  /** Notable moves — e.g. ["Fork on e5", "Checkmate in 3"] */
  highlights?: string[];
}

// =============================================================================
// GameResultFacts
// =============================================================================

/**
 * Universal result snapshot produced by every game at completion.
 *
 * This is the single contract between game screens and the system-owned
 * end-game flow (shells → SessionGameOverScreen).
 */
export interface GameResultFacts {
  // ── Identity ──────────────────────────────────────────────────────────
  /** Game type */
  gameId: ExtendedGameType;
  /** Runtime mode */
  mode: GameMode;

  // ── Outcome ───────────────────────────────────────────────────────────
  /** Outcome for the current/submitting player */
  outcome: GameOutcome;
  /** Human-readable reason (e.g. "Checkmate", "Time expired", "Forfeit") */
  outcomeReason?: string;

  // ── Scores ────────────────────────────────────────────────────────────
  /** Ordered scoreboard rows */
  scoreboard: ScoreboardEntry[];

  // ── Stats ─────────────────────────────────────────────────────────────
  /** Game-specific performance metrics for the end screen */
  performanceMetrics?: PerformanceMetric[];

  // ── Timing ────────────────────────────────────────────────────────────
  /** Game duration in milliseconds */
  durationMs: number;

  // ── Server-computed Awards (populated after resolveSessionV3 / onGameResult) ─
  /** XP awarded per participant UID */
  xpAwarded?: Record<string, number>;
  /** Achievement IDs unlocked this session */
  achievementsUnlocked?: string[];
  /** Whether the current player leveled up */
  didLevelUp?: boolean;
  /** New level after XP award */
  newLevel?: number;
  /** Whether leaderboard was updated */
  leaderboardUpdated?: boolean;

  // ── Linking ───────────────────────────────────────────────────────────
  /** V3 session ID (if multiplayer) */
  sessionId?: string;
  /** Invite ID (if from chat invite) */
  inviteId?: string;
  /** Conversation ID (if from chat) */
  conversationId?: string;
  /** Firestore game doc ID (for turn-based games) */
  firestoreGameId?: string;

  // ── Raw metadata ──────────────────────────────────────────────────────
  /** Arbitrary game-specific metadata (for adapter-level extensions) */
  meta?: Record<string, unknown>;

  // ── Turn Summary (turn-based games only) ──────────────────────────────
  /** Per-player turn summaries for post-game cards */
  turnSummary?: TurnSummaryEntry[];
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract the current user's scoreboard entry from a GameResultFacts.
 */
export function getMyScoreboardEntry(
  facts: GameResultFacts,
  uid: string,
): ScoreboardEntry | undefined {
  return facts.scoreboard.find((e) => e.uid === uid);
}

/**
 * Extract the winner's scoreboard entry from a GameResultFacts.
 */
export function getWinnerEntry(
  facts: GameResultFacts,
): ScoreboardEntry | undefined {
  return facts.scoreboard.find((e) => e.isWinner);
}

/**
 * Build a solo scoreboard (single player).
 */
export function buildSoloScoreboard(params: {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  score?: number;
  formattedScore?: string;
  outcome: GameOutcome;
}): ScoreboardEntry[] {
  return [
    {
      uid: params.uid,
      displayName: params.displayName,
      avatarUrl: params.avatarUrl,
      score: params.score,
      formattedScore: params.formattedScore,
      outcome: params.outcome,
      isWinner: params.outcome === "win" || params.outcome === "completed",
    },
  ];
}
