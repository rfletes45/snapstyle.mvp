/**
 * Game Stats Service â€” Type Definitions
 *
 * Type exports for player game statistics.
 * Implementation functions have been removed as they were unused.
 * Re-implement as needed when the game stats feature is built out.
 *
 * @see docs/07_GAMES_ARCHITECTURE.md Section 2.4
 */

import { Timestamp } from "firebase/firestore";
import {
  GameCategory,
  RealTimeGameType,
  SinglePlayerGameType,
  TurnBasedGameType,
} from "@/types/games";

// =============================================================================
// Types
// =============================================================================

/**
 * All game types for stats
 */
export type StatsGameType =
  | SinglePlayerGameType
  | TurnBasedGameType
  | RealTimeGameType;

/**
 * Outcome for multiplayer games
 */
export type GameOutcome = "win" | "loss" | "draw";

/**
 * Per-game statistics
 */
export interface GameStats {
  gameType: StatsGameType;
  category: GameCategory;

  // Play counts
  gamesPlayed: number;
  gamesCompleted: number;

  // For multiplayer games
  wins?: number;
  losses?: number;
  draws?: number;
  winStreak?: number;
  bestWinStreak?: number;
  currentStreak?: number; // Positive = wins, negative = losses

  // For single-player games
  highScore?: number;
  totalScore?: number;
  averageScore?: number;
  bestTime?: number; // Milliseconds

  // Rating (for rated games)
  rating?: number;
  ratingDeviation?: number; // For Glicko-2
  peakRating?: number;

  // Time tracking
  totalPlayTime: number; // Seconds
  averageGameDuration: number; // Seconds

  // Recent history
  recentResults?: GameOutcome[]; // Last 10 games

  // Timestamps
  firstPlayedAt: Timestamp;
  lastPlayedAt: Timestamp;
}

/**
 * Overall player stats (aggregated)
 */
export interface PlayerOverallStats {
  playerId: string;

  // Total counts
  totalGamesPlayed: number;
  totalGamesCompleted: number;
  totalPlayTime: number; // Seconds

  // Multiplayer totals
  totalWins: number;
  totalLosses: number;
  totalDraws: number;

  // Single-player totals
  totalScore: number;

  // Favorites
  favoriteGameType?: StatsGameType;
  mostPlayedCategory?: GameCategory;

  // Achievements
  achievementsUnlocked: number;
  totalAchievements: number;

  // Timestamps
  firstGameAt: Timestamp;
  lastGameAt: Timestamp;

  // Daily tracking
  gamesPlayedToday: number;
  lastDayPlayed: string; // YYYY-MM-DD
}

/**
 * Player stats document (stored in Firestore)
 */
export interface PlayerGameStatsDocument {
  playerId: string;

  // Per-game stats (keyed by game type)
  gameStats: Record<string, GameStats>;

  // Overall stats
  overall: PlayerOverallStats;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Game result input for recording
 */
export interface RecordGameResultInput {
  gameType: StatsGameType;
  category: GameCategory;

  // For multiplayer
  outcome?: GameOutcome;
  opponentRating?: number;
  isRated?: boolean;

  // For single-player
  score?: number;

  // Duration
  durationSeconds: number;

  // Game-specific stats
  customStats?: Record<string, number>;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  playerAvatar?: string;

  // Value being ranked
  value: number;
  label: string; // e.g., "Rating", "High Score", "Wins"

  // Additional context
  gamesPlayed?: number;
}
