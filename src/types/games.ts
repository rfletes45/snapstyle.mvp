/**
 * Games Type Definitions
 *
 * This file contains all type definitions for the games expansion including:
 * - Single-player game types (Flappy Snap, Bounce Blitz, etc.)
 * - Turn-based multiplayer types (Chess, Checkers, Crazy Eights)
 * - Real-time multiplayer types (8-Ball Pool)
 * - Game metadata and configuration
 *
 * @see docs/06_GAMES_RESEARCH.md for physics research
 * @see docs/PROMPT_GAMES_EXPANSION.md for full implementation plan
 */

// =============================================================================
// Game Type Unions
// =============================================================================

/**
 * Single-player games that can be played solo
 */
export type SinglePlayerGameType =
  | "flappy_snap" // Flappy Bird-style
  | "bounce_blitz" // Ballz-style
  | "snap_2048" // 2048 puzzle
  | "snap_snake" // Classic snake
  | "memory_snap" // Memory matching
  | "word_snap" // Daily word puzzle (Wordle-style)
  | "reaction_tap" // Existing - tap when green
  | "timed_tap"; // Existing - tap count in 10s

/**
 * Turn-based multiplayer games
 */
export type TurnBasedGameType =
  | "chess"
  | "checkers"
  | "crazy_eights"
  | "tic_tac_toe";

/**
 * Real-time multiplayer games (simulated turn-based for pool)
 */
export type RealTimeGameType = "8ball_pool" | "air_hockey";

/**
 * All game types combined
 */
export type ExtendedGameType =
  | SinglePlayerGameType
  | TurnBasedGameType
  | RealTimeGameType;

/**
 * Game category for UI grouping
 */
export type GameCategory = "quick_play" | "puzzle" | "multiplayer" | "daily";

// =============================================================================
// Game Metadata
// =============================================================================

/**
 * Metadata for each game type used in UI and game hub
 */
export interface GameMetadata {
  id: ExtendedGameType;
  name: string;
  shortName: string;
  description: string;
  icon: string; // Emoji or MaterialCommunityIcons name
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  isMultiplayer: boolean;
  hasLeaderboard: boolean;
  hasAchievements: boolean;
  isAvailable: boolean; // Feature flag for gradual rollout
  comingSoon?: boolean;
}

/**
 * Game metadata registry - source of truth for all games
 */
export const GAME_METADATA: Record<ExtendedGameType, GameMetadata> = {
  // Single-player: Quick Play
  reaction_tap: {
    id: "reaction_tap",
    name: "Reaction Tap",
    shortName: "Reaction",
    description: "Wait for green, tap as fast as possible!",
    icon: "⚡",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
  },
  timed_tap: {
    id: "timed_tap",
    name: "Timed Tap",
    shortName: "Timed",
    description: "Tap as many times as you can in 10 seconds!",
    icon: "⏱️",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
  },
  flappy_snap: {
    id: "flappy_snap",
    name: "Flappy Snap",
    shortName: "Flappy",
    description: "Tap to fly through the pipes!",
    icon: "🐦",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
  },
  bounce_blitz: {
    id: "bounce_blitz",
    name: "Bounce Blitz",
    shortName: "Bounce",
    description: "Aim and launch balls to destroy blocks!",
    icon: "⚪",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
  },
  snap_snake: {
    id: "snap_snake",
    name: "Snap Snake",
    shortName: "Snake",
    description: "Eat food and grow without hitting walls!",
    icon: "🐍",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
  },

  // Single-player: Puzzle
  snap_2048: {
    id: "snap_2048",
    name: "Snap 2048",
    shortName: "2048",
    description: "Merge tiles to reach 2048!",
    icon: "🔢",
    category: "puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
  },
  memory_snap: {
    id: "memory_snap",
    name: "Memory Snap",
    shortName: "Memory",
    description: "Match pairs of cards!",
    icon: "🃏",
    category: "puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
  },

  // Single-player: Daily
  word_snap: {
    id: "word_snap",
    name: "Word Snap",
    shortName: "Word",
    description: "Guess the daily word in 6 tries!",
    icon: "📝",
    category: "daily",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: false,
    hasAchievements: true,
    isAvailable: true,
  },

  // Multiplayer: Turn-based
  chess: {
    id: "chess",
    name: "Chess",
    shortName: "Chess",
    description: "Classic strategy game of kings and queens",
    icon: "♟️",
    category: "multiplayer",
    minPlayers: 2,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
  },
  checkers: {
    id: "checkers",
    name: "Checkers",
    shortName: "Checkers",
    description: "Jump and capture your opponent's pieces",
    icon: "⬛",
    category: "multiplayer",
    minPlayers: 2,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
  },
  crazy_eights: {
    id: "crazy_eights",
    name: "Crazy Eights",
    shortName: "Crazy 8s",
    description: "Match cards by suit or rank!",
    icon: "🎴",
    category: "multiplayer",
    minPlayers: 2,
    maxPlayers: 4,
    isMultiplayer: true,
    hasLeaderboard: false,
    hasAchievements: true,
    isAvailable: true,
  },
  tic_tac_toe: {
    id: "tic_tac_toe",
    name: "Tic-Tac-Toe",
    shortName: "Tic-Tac",
    description: "Get three in a row!",
    icon: "❌",
    category: "multiplayer",
    minPlayers: 2,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: false,
    hasAchievements: true,
    isAvailable: true,
  },

  // Multiplayer: Real-time (simulated)
  "8ball_pool": {
    id: "8ball_pool",
    name: "8-Ball Pool",
    shortName: "Pool",
    description: "Sink your balls and the 8-ball to win!",
    icon: "🎱",
    category: "multiplayer",
    minPlayers: 2,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: false,
    comingSoon: true,
  },
  air_hockey: {
    id: "air_hockey",
    name: "Air Hockey",
    shortName: "Hockey",
    description: "Score goals against your opponent!",
    icon: "🏒",
    category: "multiplayer",
    minPlayers: 2,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: false,
    comingSoon: true,
  },
};

// =============================================================================
// Score Limits (for anti-cheat validation)
// =============================================================================

/**
 * Score limits for each game type
 * Used for client and server-side validation
 */
export interface GameScoreLimits {
  minScore: number;
  maxScore: number;
  maxDuration?: number; // Max game duration in ms
  scoreDirection: "higher" | "lower"; // Higher is better or lower is better
}

export const EXTENDED_GAME_SCORE_LIMITS: Record<
  ExtendedGameType,
  GameScoreLimits
> = {
  // Existing games
  reaction_tap: {
    minScore: 100,
    maxScore: 2000,
    scoreDirection: "lower", // Lower ms is better
  },
  timed_tap: {
    minScore: 1,
    maxScore: 200,
    maxDuration: 10000,
    scoreDirection: "higher", // More taps is better
  },

  // New single-player games
  flappy_snap: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Higher score is better
  },
  bounce_blitz: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher score is better
  },
  snap_2048: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher",
  },
  snap_snake: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher",
  },
  memory_snap: {
    minScore: 1,
    maxScore: 9999,
    maxDuration: 300000, // 5 minutes max
    scoreDirection: "lower", // Lower time is better (in seconds)
  },
  word_snap: {
    minScore: 1,
    maxScore: 6,
    scoreDirection: "lower", // Fewer guesses is better
  },

  // Multiplayer games (score = wins for leaderboard)
  chess: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher",
  },
  checkers: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher",
  },
  crazy_eights: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher",
  },
  tic_tac_toe: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher",
  },
  "8ball_pool": {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher",
  },
  air_hockey: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher",
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get games by category
 */
export function getGamesByCategory(category: GameCategory): GameMetadata[] {
  return Object.values(GAME_METADATA).filter(
    (game) => game.category === category,
  );
}

/**
 * Get available games only
 */
export function getAvailableGames(): GameMetadata[] {
  return Object.values(GAME_METADATA).filter((game) => game.isAvailable);
}

/**
 * Get multiplayer games
 */
export function getMultiplayerGames(): GameMetadata[] {
  return Object.values(GAME_METADATA).filter((game) => game.isMultiplayer);
}

/**
 * Check if a game type is valid
 */
export function isValidGameType(type: string): type is ExtendedGameType {
  return type in GAME_METADATA;
}

/**
 * Get game metadata by type
 */
export function getGameMetadata(type: ExtendedGameType): GameMetadata {
  return GAME_METADATA[type];
}

/**
 * Format score for display based on game type
 */
export function formatGameScore(type: ExtendedGameType, score: number): string {
  switch (type) {
    case "reaction_tap":
      return `${score}ms`;
    case "timed_tap":
      return `${score} taps`;
    case "flappy_snap":
    case "bounce_blitz":
    case "snap_2048":
    case "snap_snake":
      return score.toLocaleString();
    case "memory_snap":
      return `${score}s`;
    case "word_snap":
      return score === 1 ? "1 guess" : `${score} guesses`;
    case "chess":
    case "checkers":
    case "8ball_pool":
      return `${score} wins`;
    default:
      return score.toString();
  }
}
