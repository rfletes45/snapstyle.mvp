/**
 * Multiplayer Leaderboard Types
 *
 * Defines types for multiplayer game leaderboards (chess, checkers, etc.)
 * These are separate from single-player leaderboards which track high scores.
 *
 * Multiplayer leaderboards track:
 * - ELO/Rating based rankings
 * - Win/Loss records
 * - Win rates
 * - Win streaks
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 8
 */

import { AvatarConfig } from "./models";
import { TurnBasedGameType } from "./turnBased";

// =============================================================================
// Leaderboard Entry Types
// =============================================================================

/**
 * A single entry in the multiplayer leaderboard
 */
export interface MultiplayerLeaderboardEntry {
  /** User ID */
  userId: string;

  /** Display name */
  displayName: string;

  /** Avatar configuration */
  avatarConfig?: AvatarConfig;

  /** Avatar URL (alternative to config) */
  avatarUrl?: string;

  /** Current rank in the leaderboard */
  rank: number;

  /** ELO-based rating score */
  rating: number;

  /** Total wins */
  wins: number;

  /** Total losses */
  losses: number;

  /** Total draws */
  draws: number;

  /** Win rate as percentage (0-100) */
  winRate: number;

  /** Total games played */
  gamesPlayed: number;

  /** Current win streak */
  currentStreak: number;

  /** Longest win streak ever */
  longestStreak: number;

  /** When stats were last updated */
  updatedAt: number;
}

// =============================================================================
// Leaderboard Data Types
// =============================================================================

/**
 * Complete leaderboard data for display
 */
export interface MultiplayerLeaderboardData {
  /** Game type this leaderboard is for */
  gameType: TurnBasedGameType | "all";

  /** Scope of the leaderboard */
  scope: "global" | "friends";

  /** Timeframe for the leaderboard */
  timeframe: MultiplayerLeaderboardTimeframe;

  /** Sorted list of entries */
  entries: MultiplayerLeaderboardEntry[];

  /** Current user's entry (may not be in top entries) */
  userEntry?: MultiplayerLeaderboardEntry;

  /** Current user's global rank (even if not in entries) */
  userGlobalRank?: number;

  /** When this leaderboard was last refreshed */
  updatedAt: number;

  /** Total number of ranked players */
  totalPlayers?: number;
}

/**
 * Timeframe options for leaderboards
 */
export type MultiplayerLeaderboardTimeframe =
  | "all-time" // Lifetime stats
  | "monthly" // Current month
  | "weekly"; // Current week (ISO week)

// =============================================================================
// Leaderboard Stats (Firestore Document)
// =============================================================================

/**
 * Structure of a LeaderboardStats document in Firestore
 * Collection: LeaderboardStats
 * Document ID: `{userId}_{gameType}_{timeframe}`
 */
export interface LeaderboardStatsDocument {
  /** User ID */
  userId: string;

  /** Display name (cached for queries) */
  displayName: string;

  /** Avatar URL (cached for queries) */
  avatarUrl?: string;

  /** Avatar config JSON (cached for queries) */
  avatarConfigJson?: string;

  /** Game type */
  gameType: TurnBasedGameType | "all";

  /** Timeframe this record covers */
  timeframe: MultiplayerLeaderboardTimeframe;

  /** ELO-based rating */
  rating: number;

  /** Total wins */
  wins: number;

  /** Total losses */
  losses: number;

  /** Total draws */
  draws: number;

  /** Total games played */
  gamesPlayed: number;

  /** Win rate (precomputed for sorting) */
  winRate: number;

  /** Current win streak */
  currentStreak: number;

  /** Longest win streak */
  longestStreak: number;

  /** Last game completed timestamp */
  lastGameAt: number;

  /** When this document was last updated */
  updatedAt: number;

  /** When this document was created */
  createdAt: number;
}

// =============================================================================
// Query Parameters
// =============================================================================

/**
 * Parameters for fetching leaderboard data
 */
export interface LeaderboardQueryParams {
  /** Game type to filter by (or 'all' for combined) */
  gameType: TurnBasedGameType | "all";

  /** Scope: global or friends only */
  scope: "global" | "friends";

  /** Timeframe to query */
  timeframe: MultiplayerLeaderboardTimeframe;

  /** Maximum entries to return */
  limit?: number;

  /** User ID for friends scope or user entry lookup */
  userId?: string;
}

// =============================================================================
// Rating System Types
// =============================================================================

/**
 * ELO rating change result
 */
export interface RatingChange {
  /** Player's rating before the game */
  ratingBefore: number;

  /** Player's rating after the game */
  ratingAfter: number;

  /** The change amount (can be negative) */
  change: number;
}

/**
 * ELO calculation parameters
 */
export interface EloCalculationParams {
  /** Player's current rating */
  playerRating: number;

  /** Opponent's current rating */
  opponentRating: number;

  /** Game outcome: 1 for win, 0.5 for draw, 0 for loss */
  outcome: 0 | 0.5 | 1;

  /** K-factor (default: 32 for new players, 16 for established) */
  kFactor?: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default starting ELO rating
 */
export const DEFAULT_RATING = 1200;

/**
 * K-factor for new players (< 30 games)
 */
export const K_FACTOR_NEW_PLAYER = 32;

/**
 * K-factor for established players (>= 30 games)
 */
export const K_FACTOR_ESTABLISHED = 16;

/**
 * Minimum rating floor
 */
export const MINIMUM_RATING = 100;

/**
 * Games required to be considered "established"
 */
export const ESTABLISHED_GAMES_THRESHOLD = 30;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate new ELO rating after a game
 *
 * @param params - ELO calculation parameters
 * @returns The new rating (integer)
 */
export function calculateEloRating(params: EloCalculationParams): number {
  const {
    playerRating,
    opponentRating,
    outcome,
    kFactor = K_FACTOR_NEW_PLAYER,
  } = params;

  // Expected score based on rating difference
  const expectedScore =
    1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));

  // New rating calculation
  const newRating = playerRating + kFactor * (outcome - expectedScore);

  // Ensure minimum rating
  return Math.max(MINIMUM_RATING, Math.round(newRating));
}

/**
 * Get the appropriate K-factor based on games played
 *
 * @param gamesPlayed - Number of games the player has played
 * @returns The K-factor to use
 */
export function getKFactor(gamesPlayed: number): number {
  return gamesPlayed < ESTABLISHED_GAMES_THRESHOLD
    ? K_FACTOR_NEW_PLAYER
    : K_FACTOR_ESTABLISHED;
}

/**
 * Calculate rating changes for both players after a game
 *
 * @param player1Rating - First player's rating
 * @param player2Rating - Second player's rating
 * @param player1Won - Whether player 1 won (false = player 2 won, null = draw)
 * @param player1Games - Player 1's total games
 * @param player2Games - Player 2's total games
 * @returns Rating changes for both players
 */
export function calculateGameRatingChanges(
  player1Rating: number,
  player2Rating: number,
  player1Won: boolean | null,
  player1Games: number,
  player2Games: number,
): { player1: RatingChange; player2: RatingChange } {
  // Determine outcomes
  let player1Outcome: 0 | 0.5 | 1;
  let player2Outcome: 0 | 0.5 | 1;

  if (player1Won === null) {
    // Draw
    player1Outcome = 0.5;
    player2Outcome = 0.5;
  } else if (player1Won) {
    player1Outcome = 1;
    player2Outcome = 0;
  } else {
    player1Outcome = 0;
    player2Outcome = 1;
  }

  const player1NewRating = calculateEloRating({
    playerRating: player1Rating,
    opponentRating: player2Rating,
    outcome: player1Outcome,
    kFactor: getKFactor(player1Games),
  });

  const player2NewRating = calculateEloRating({
    playerRating: player2Rating,
    opponentRating: player1Rating,
    outcome: player2Outcome,
    kFactor: getKFactor(player2Games),
  });

  return {
    player1: {
      ratingBefore: player1Rating,
      ratingAfter: player1NewRating,
      change: player1NewRating - player1Rating,
    },
    player2: {
      ratingBefore: player2Rating,
      ratingAfter: player2NewRating,
      change: player2NewRating - player2Rating,
    },
  };
}

/**
 * Get rank display text with emoji for top 3
 */
export function getRankDisplayText(rank: number): string {
  if (rank === 1) return "🥇 1st";
  if (rank === 2) return "🥈 2nd";
  if (rank === 3) return "🥉 3rd";
  return `#${rank}`;
}

/**
 * Get tier/league based on rating
 */
export function getRatingTier(rating: number): {
  name: string;
  icon: string;
  color: string;
} {
  if (rating >= 2400)
    return { name: "Grandmaster", icon: "👑", color: "#FFD700" };
  if (rating >= 2200) return { name: "Master", icon: "💎", color: "#E5E4E2" };
  if (rating >= 2000) return { name: "Expert", icon: "⭐", color: "#B9F2FF" };
  if (rating >= 1800) return { name: "Advanced", icon: "🔷", color: "#4169E1" };
  if (rating >= 1600)
    return { name: "Intermediate", icon: "🟢", color: "#32CD32" };
  if (rating >= 1400) return { name: "Amateur", icon: "🟡", color: "#FFFF00" };
  if (rating >= 1200) return { name: "Beginner", icon: "🟠", color: "#FFA500" };
  return { name: "Novice", icon: "⚪", color: "#CCCCCC" };
}
