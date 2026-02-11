/**
 * Games Type Definitions
 *
 * This file contains all type definitions for the games expansion including:
 * - Single-player game types (Bounce Blitz, Snake, etc.)
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
  | "bounce_blitz" // Ballz-style
  | "play_2048" // 2048 puzzle
  | "snake_master" // Classic snake
  | "memory_master" // Memory matching
  | "word_master" // Daily word puzzle (Wordle-style)
  | "match" // Match-3 puzzle
  | "slice" // Fruit slicing arcade
  | "tap_tap" // Rhythm tap game
  | "target_master" // Accuracy target shooting
  | "words" // Word board puzzle
  | "reaction_tap" // Existing - tap when green
  | "timed_tap" // Existing - tap count in 10s
  | "brick_breaker" // Classic Breakout/Arkanoid
  | "tile_slide" // Classic 15-puzzle sliding tiles
  | "minesweeper_classic" // Classic Minesweeper
  | "number_master" // Mental math speed game
  | "lights_out" // Lights Out puzzle
  | "pong_game"; // Pong with AI

/**
 * Turn-based multiplayer games
 */
export type TurnBasedGameType =
  | "chess"
  | "checkers"
  | "crazy_eights"
  | "tic_tac_toe"
  | "connect_four" // Connect Four
  | "dot_match" // Dots and Boxes
  | "gomoku_master" // Five in a Row (Gomoku)
  | "reversi_game" // Othello / Reversi
  | "war_game"; // Card War

/**
 * Real-time multiplayer games (simulated turn-based for pool)
 */
export type RealTimeGameType =
  | "8ball_pool"
  | "air_hockey"
  | "race_game" // Typing race
  | "crossword_puzzle"; // Daily mini crossword

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
  /** Mark as newly added game (shows NEW badge) */
  isNew?: boolean;
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
  snake_master: {
    id: "snake_master",
    name: "Snake",
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
  play_2048: {
    id: "play_2048",
    name: "2048",
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
  memory_master: {
    id: "memory_master",
    name: "Memory",
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
    isNew: true,
  },
  match: {
    id: "match",
    name: "Match",
    shortName: "Match",
    description: "Swap gems to make matches and trigger combos!",
    icon: "💎",
    category: "puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  slice: {
    id: "slice",
    name: "Slice",
    shortName: "Slice",
    description: "Slice flying targets quickly and avoid bombs!",
    icon: "🍉",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  tap_tap: {
    id: "tap_tap",
    name: "Tap Tap",
    shortName: "Tap Tap",
    description: "Tap the falling lanes before they pass by!",
    icon: "🎹",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  target_master: {
    id: "target_master",
    name: "Target Master",
    shortName: "Target",
    description: "Hit shrinking targets for accuracy combos!",
    icon: "🎯",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  words: {
    id: "words",
    name: "Words",
    shortName: "Words",
    description: "Build words on the board and maximize bonus squares!",
    icon: "📝",
    category: "daily",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  // Single-player: Daily
  word_master: {
    id: "word_master",
    name: "Word",
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
    isNew: true,
  },

  // New Single-player Games
  brick_breaker: {
    id: "brick_breaker",
    name: "Brick Breaker",
    shortName: "Bricks",
    description: "Bounce the ball to destroy all bricks!",
    icon: "🧱",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  tile_slide: {
    id: "tile_slide",
    name: "Tile Slide",
    shortName: "Slide",
    description: "Slide tiles to solve the puzzle!",
    icon: "🔢",
    category: "puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },

  minesweeper_classic: {
    id: "minesweeper_classic",
    name: "Minesweeper",
    shortName: "Mines",
    description: "Find all mines without detonating them!",
    icon: "💣",
    category: "puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  number_master: {
    id: "number_master",
    name: "Number",
    shortName: "Number",
    description: "Solve math puzzles against the clock!",
    icon: "🔢",
    category: "puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  lights_out: {
    id: "lights_out",
    name: "Lights",
    shortName: "Lights",
    description: "Toggle all the lights off!",
    icon: "💡",
    category: "puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },

  pong_game: {
    id: "pong_game",
    name: "Pong",
    shortName: "Pong",
    description: "Classic Pong — drag your paddle to win!",
    icon: "🏓",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
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
  connect_four: {
    id: "connect_four",
    name: "Four",
    shortName: "Four",
    description: "Connect four discs in a row to win!",
    icon: "🔴",
    category: "multiplayer",
    minPlayers: 1,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  dot_match: {
    id: "dot_match",
    name: "Dots",
    shortName: "Dots",
    description: "Draw lines to claim boxes!",
    icon: "⬜",
    category: "multiplayer",
    minPlayers: 1,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  gomoku_master: {
    id: "gomoku_master",
    name: "Gomoku",
    shortName: "Gomoku",
    description: "Get five in a row on the board!",
    icon: "⚫",
    category: "multiplayer",
    minPlayers: 1,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },

  // Phase 3: New Multiplayer Turn-Based Games
  reversi_game: {
    id: "reversi_game",
    name: "Reversi",
    shortName: "Reversi",
    description: "Outflank and flip your opponent's discs!",
    icon: "⚪",
    category: "multiplayer",
    minPlayers: 1,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  war_game: {
    id: "war_game",
    name: "War",
    shortName: "War",
    description: "Flip cards — higher wins! War on ties!",
    icon: "⚔️",
    category: "multiplayer",
    minPlayers: 2,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: false,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  race_game: {
    id: "race_game",
    name: "Race",
    shortName: "Race",
    description: "Type the sentence fastest to win!",
    icon: "🏎️",
    category: "multiplayer",
    minPlayers: 2,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  crossword_puzzle: {
    id: "crossword_puzzle",
    name: "Crossword",
    shortName: "Crossword",
    description: "Solve the daily 5×5 mini crossword!",
    icon: "📰",
    category: "daily",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: false,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
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
    isAvailable: true,
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
    isAvailable: true,
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
  bounce_blitz: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher score is better
  },
  play_2048: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher",
  },
  snake_master: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher",
  },
  memory_master: {
    minScore: 1,
    maxScore: 9999,
    maxDuration: 300000, // 5 minutes max
    scoreDirection: "lower", // Lower time is better (in seconds)
  },
  match: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher",
  },
  slice: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher",
  },
  tap_tap: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher",
  },
  target_master: {
    minScore: -9999,
    maxScore: 999999,
    scoreDirection: "higher",
  },
  words: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher",
  },
  word_master: {
    minScore: 1,
    maxScore: 6,
    scoreDirection: "lower", // Fewer guesses is better
  },
  brick_breaker: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher",
  },
  tile_slide: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "lower", // Fewer moves is better
  },
  minesweeper_classic: {
    minScore: 1,
    maxScore: 9999,
    scoreDirection: "lower", // Fewer seconds is better
  },
  number_master: {
    minScore: 1,
    maxScore: 9999,
    scoreDirection: "lower", // Fewer seconds is better
  },
  lights_out: {
    minScore: 1,
    maxScore: 999,
    scoreDirection: "lower", // Fewer moves is better
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
  connect_four: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  dot_match: {
    minScore: 0,
    maxScore: 16,
    scoreDirection: "higher", // Boxes captured
  },
  gomoku_master: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
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

  pong_game: {
    minScore: 0,
    maxScore: 999,
    scoreDirection: "higher", // Games won vs AI
  },

  // Phase 3: New multiplayer games
  reversi_game: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  war_game: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  race_game: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  crossword_puzzle: {
    minScore: 1,
    maxScore: 9999,
    scoreDirection: "lower", // Fewer seconds is better
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
    case "bounce_blitz":
    case "play_2048":
    case "snake_master":
    case "brick_breaker":
    case "match":
    case "slice":
    case "tap_tap":
    case "target_master":
    case "words":
      return score.toLocaleString();
    case "memory_master":
      return `${score}s`;
    case "word_master":
      return score === 1 ? "1 guess" : `${score} guesses`;
    case "tile_slide":
      return score === 1 ? "1 move" : `${score} moves`;
    case "minesweeper_classic":
    case "number_master":
      return `${score}s`;
    case "lights_out":
      return score === 1 ? "1 move" : `${score} moves`;
    case "dot_match":
      return `${score} boxes`;
    case "crossword_puzzle":
      return `${score}s`;
    case "pong_game":
      return `${score} wins`;
    // Multiplayer games
    case "chess":
    case "checkers":
    case "8ball_pool":
    case "tic_tac_toe":
    case "crazy_eights":
    case "air_hockey":
    case "connect_four":
    case "gomoku_master":
    case "reversi_game":
    case "war_game":
    case "race_game":
      return `${score} wins`;
    default:
      return score.toString();
  }
}
