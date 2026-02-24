/**
 * GameResultEvent — Universal game-completion contract
 *
 * Every game (solo, turn-based, real-time) emits this event once upon
 * completion. The client calls `submitGameResult(event)` which fires
 * the `onGameResult` Cloud Function to:
 *   1. Validate the event & gameId
 *   2. Update leaderboard (if applicable)
 *   3. Evaluate achievements
 *   4. Award XP per rules
 *   5. Recalculate level from total XP
 *
 * @module types/gameResult
 */

import type { ExtendedGameType } from "./games";

// =============================================================================
// Core Types
// =============================================================================

export type GameMode = "solo" | "turnBased" | "realtime";

export type GameOutcome = "win" | "lose" | "draw" | "completed";

export interface GameResultParticipant {
  userId: string;
  displayName: string;
  outcome: GameOutcome;
  score?: number;
}

/**
 * Universal game result event — emitted once per game completion.
 */
export interface GameResultEvent {
  /** Game registry ID (must be in GAME_METADATA) */
  gameId: ExtendedGameType;

  /** Solo, turn-based, or real-time */
  mode: GameMode;

  /** Outcome for the submitting player */
  outcome: GameOutcome;

  /** Final score (nullable — not all games have numeric scores) */
  score: number | null;

  /** Game duration in milliseconds */
  durationMs: number;

  /** All participants and their outcomes */
  participants: GameResultParticipant[];

  /** Game-specific metadata */
  meta?: Record<string, unknown>;

  /** Idempotency key — prevents double-processing */
  idempotencyKey?: string;

  /** Originating invite ID (for multiplayer) */
  inviteId?: string;

  /** Originating conversation ID (for in-chat games) */
  conversationId?: string;
}

// =============================================================================
// XP Rules
// =============================================================================

export type GameXpCategory =
  | "arcade"
  | "puzzle"
  | "board"
  | "card"
  | "party"
  | "daily";

/** XP base amounts per category */
export const XP_BASE: Record<GameXpCategory, number> = {
  arcade: 15,
  puzzle: 20,
  board: 25,
  card: 20,
  party: 15,
  daily: 25,
};

/** Outcome multipliers */
export const XP_OUTCOME_MULTIPLIER: Record<GameOutcome, number> = {
  win: 2.0,
  completed: 1.5,
  draw: 1.2,
  lose: 0.5,
};

/** Bonus XP amounts */
export const XP_BONUSES = {
  /** First win of the day */
  firstWinOfDay: 25,
  /** New personal high score */
  newHighScore: 15,
  /** Multiplayer game completion (any outcome) */
  multiplayerBonus: 10,
} as const;

/** Max XP per single game session */
export const XP_CAP_PER_MATCH = 100;

/** Map game IDs to XP categories */
export const GAME_XP_CATEGORY: Record<ExtendedGameType, GameXpCategory> = {
  bounce_blitz: "arcade",
  play_2048: "puzzle",
  word_master: "daily",
  brick_breaker: "arcade",
  minesweeper_classic: "puzzle",
  pong_game: "arcade",
  chess: "board",
  checkers: "board",
  crazy_eights: "card",
  tic_tac_toe: "board",
  connect_four: "board",
  dot_match: "board",
  gomoku_master: "board",
  reversi_game: "board",
  crossword_puzzle: "daily",
  starforge_game: "arcade",
  sketch_party_game: "party",
  lights_out: "puzzle",
  minigolf_duels: "arcade",
  battleship: "board",
};

// =============================================================================
// Server Response
// =============================================================================

export interface GameResultResponse {
  success: boolean;
  /** XP earned this session */
  xpEarned: number;
  /** New total XP */
  totalXp: number;
  /** Current level after update */
  level: number;
  /** XP progress within current level */
  levelXp: number;
  /** XP required for next level */
  xpToNextLevel: number;
  /** Whether the player leveled up */
  didLevelUp: boolean;
  /** Previous level (for level-up animation) */
  previousLevel: number;
  /** Achievement IDs unlocked this session */
  achievementsUnlocked: string[];
  /** Leaderboard updated */
  leaderboardUpdated: boolean;
}
