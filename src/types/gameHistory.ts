/**
 * GameHistory Types
 *
 * Type definitions for completed game records stored in the GameHistory collection.
 * These records are created by Cloud Functions when games complete and are used for:
 * 1. Player statistics and history viewing
 * 2. Head-to-head records between players
 * 3. Achievement tracking and leaderboards
 *
 * Kept separate from TurnBasedMatch to:
 * - Keep active games collection lean
 * - Allow different security rules for history
 * - Enable efficient stats queries
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 1
 */

import { MatchStatus, TurnBasedGameType } from "./turnBased";

// =============================================================================
// Core Types
// =============================================================================

/**
 * How a game ended - more detailed than MatchStatus
 */
export type GameEndReason =
  | "checkmate" // Chess - opponent in checkmate
  | "stalemate" // Chess - draw, no legal moves but not in check
  | "resignation" // Player voluntarily resigned
  | "timeout" // Time ran out
  | "draw_agreement" // Players agreed to draw
  | "draw_repetition" // Chess - threefold repetition
  | "draw_50_moves" // Chess - 50-move rule
  | "draw_insufficient" // Chess - insufficient material
  | "no_moves" // Checkers - no legal moves available
  | "completion" // Normal game completion (won by rules)
  | "abandonment" // Game abandoned (both inactive)
  | "forfeit" // Player forfeited (different from resign)
  | "normal"; // Generic win condition (tic-tac-toe, cards, etc.)

/**
 * Player record within a game history entry
 */
export interface GameHistoryPlayer {
  /** User ID of the player */
  userId: string;

  /** Display name at time of game */
  displayName: string;

  /** Avatar URL at time of game */
  avatarUrl?: string;

  /** Whether this player won */
  isWinner: boolean;

  /** Final score (for scored games) */
  finalScore?: number;

  /** Number of moves this player made */
  movesPlayed: number;

  /** ELO rating before game (for rated games) */
  ratingBefore?: number;

  /** ELO rating after game (for rated games) */
  ratingAfter?: number;

  /** Rating change (positive for gain, negative for loss) */
  ratingChange?: number;

  /** Time spent thinking (total milliseconds) */
  timeSpentMs?: number;
}

/**
 * Complete record of a finished game
 */
export interface GameHistoryRecord {
  /** Unique history record ID */
  id: string;

  // =========================================================================
  // Game Identification
  // =========================================================================

  /** Type of game played */
  gameType: TurnBasedGameType;

  /** Original match ID from TurnBasedGames collection */
  matchId: string;

  // =========================================================================
  // Players
  // =========================================================================

  /** All players who participated */
  players: GameHistoryPlayer[];

  /** Array of player IDs (for Firestore array-contains queries) */
  playerIds: string[];

  /** User ID of the winner (undefined for draws) */
  winnerId?: string;

  // =========================================================================
  // Outcome Details
  // =========================================================================

  /** Final match status */
  status: MatchStatus;

  /** Detailed reason for how game ended */
  endReason: GameEndReason;

  // =========================================================================
  // Conversation Context
  // =========================================================================

  /** Conversation where game was initiated (if applicable) */
  conversationId?: string;

  /** Type of originating conversation */
  conversationType?: "dm" | "group";

  /** Name of group chat (for display in history) */
  conversationName?: string;

  // =========================================================================
  // Timestamps & Duration
  // =========================================================================

  /** When the match was created */
  startedAt: number;

  /** When the match completed */
  completedAt: number;

  /** Total game duration in milliseconds */
  duration: number;

  /** When this history record was created */
  createdAt: number;

  // =========================================================================
  // Game Statistics
  // =========================================================================

  /** Total number of moves in the game */
  totalMoves: number;

  /** Final scores per player (for scored games) */
  finalScore?: Record<string, number>;

  /** Achievement IDs earned during this game */
  achievementsEarned?: string[];

  /** Was this a rated game affecting ELO? */
  isRated?: boolean;
}

// =============================================================================
// Query Types
// =============================================================================

/**
 * Parameters for querying game history
 */
export interface GameHistoryQuery {
  /** Required: User ID to get history for */
  userId: string;

  /** Filter by game type */
  gameType?: TurnBasedGameType;

  /** Filter to games with specific opponent */
  opponentId?: string;

  /** Filter to games from specific conversation */
  conversationId?: string;

  /** Filter games after this timestamp */
  dateFrom?: number;

  /** Filter games before this timestamp */
  dateTo?: number;

  /** Filter by outcome for the querying user */
  outcome?: "win" | "loss" | "draw";

  /** Maximum number of results (default: 20) */
  limit?: number;

  /** Cursor for pagination - ID of last record from previous query */
  startAfter?: string;
}

/**
 * Response from game history queries
 */
export interface GameHistoryResponse {
  /** Array of history records */
  records: GameHistoryRecord[];

  /** Whether there are more results available */
  hasMore: boolean;

  /** ID of last record (for pagination cursor) */
  lastId?: string;
}

// =============================================================================
// Statistics Types
// =============================================================================

/**
 * Per-game-type statistics
 */
export interface GameTypeStats {
  /** Total games played of this type */
  played: number;

  /** Games won */
  wins: number;

  /** Games lost */
  losses: number;

  /** Games drawn */
  draws: number;

  /** Win rate as percentage (0-100) */
  winRate: number;

  /** Average game duration in milliseconds */
  averageDuration?: number;

  /** Current ELO rating for this game type */
  currentRating?: number;

  /** Peak ELO rating achieved */
  peakRating?: number;
}

/**
 * Current streak information
 */
export interface StreakInfo {
  /** Type of current streak */
  type: "win" | "loss" | "none";

  /** Number of consecutive games in streak */
  count: number;

  /** Game type the streak is in (null if across all types) */
  gameType?: TurnBasedGameType;
}

/**
 * Aggregated statistics for a user
 */
export interface GameHistoryStats {
  /** Total games played across all types */
  totalGames: number;

  /** Total wins */
  wins: number;

  /** Total losses */
  losses: number;

  /** Total draws */
  draws: number;

  /** Overall win rate as percentage (0-100) */
  winRate: number;

  /** Statistics broken down by game type */
  byGameType: Partial<Record<TurnBasedGameType, GameTypeStats>>;

  /** Current win/loss streak */
  currentStreak: StreakInfo;

  /** Longest win streak ever achieved */
  longestWinStreak: number;

  /** Average game duration across all games (milliseconds) */
  averageGameDuration: number;

  /** Total time spent playing (milliseconds) */
  totalPlayTime: number;

  /** When stats were last calculated */
  calculatedAt: number;
}

// =============================================================================
// Head-to-Head Types
// =============================================================================

/**
 * Record between two specific players
 */
export interface HeadToHeadRecord {
  /** User ID of the querying player */
  userId: string;

  /** User ID of the opponent */
  opponentId: string;

  /** Opponent's display name */
  opponentName: string;

  /** Opponent's avatar URL */
  opponentAvatar?: string;

  /** Games won by the querying user */
  wins: number;

  /** Games lost by the querying user */
  losses: number;

  /** Games drawn */
  draws: number;

  /** Total games played between these two */
  totalGames: number;

  /** Win rate for querying user (0-100) */
  winRate: number;

  /** Current streak against this opponent */
  currentStreak: StreakInfo;

  /** Most recent game between these players */
  lastPlayed?: number;

  /** Most played game type between them */
  favoriteGameType?: TurnBasedGameType;

  /** Breakdown by game type */
  byGameType?: Partial<
    Record<
      TurnBasedGameType,
      {
        wins: number;
        losses: number;
        draws: number;
      }
    >
  >;
}
