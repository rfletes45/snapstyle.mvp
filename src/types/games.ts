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
  | "bounce_blitz" // Ballz-style
  | "play_2048" // 2048 puzzle
  | "snake_master" // Classic snake
  | "memory_master" // Memory matching
  | "word_master" // Daily word puzzle (Wordle-style)
  | "reaction_tap" // Existing - tap when green
  | "timed_tap" // Existing - tap count in 10s
  | "cart_course" // DK Crash Course-style tilt game
  | "flappy_bird" // Flappy Bird-style pipe game
  // New single-player games (Phase 1)
  | "brick_breaker" // Classic Breakout/Arkanoid
  | "tile_slide" // Classic 15-puzzle sliding tiles
  // New single-player games (Phase 2)
  | "stack_puzzle" // Stacking tower game
  | "minesweeper_classic" // Classic Minesweeper
  | "number_master" // Mental math speed game
  | "target_master" // Target shooting accuracy
  | "lights_out" // Lights Out puzzle
  // New single-player games (Phase 3)
  | "match_game" // Match-3 (Candy Crush/Bejeweled)
  | "pipes_game" // Pipe Mania rotate-to-connect
  | "nonogram_puzzle" // Picross / Nonogram
  | "tap_tap_game" // Rhythm / Piano Tiles
  | "slice_game" // Fruit Ninja swipe-to-slice
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
  // New turn-based games (Phase 3)
  | "reversi_game" // Othello / Reversi
  | "words_game" // Scrabble-lite
  | "war_game" // Card War
  | "hex_game"; // Hex board game

/**
 * Real-time multiplayer games (simulated turn-based for pool)
 */
export type RealTimeGameType =
  | "8ball_pool"
  | "air_hockey"
  // New real-time games (Phase 3)
  | "draw_game" // Pictionary drawing game
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
  memory_master: {
    id: "memory_master",
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
    isNew: true,
  },
  cart_course: {
    id: "cart_course",
    name: "Cart Course",
    shortName: "Cart",
    description:
      "Tilt to guide your cart through challenging obstacle courses!",
    icon: "🛒",
    category: "puzzle",
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
    isNew: true,
  },

  // New Single-player Games (Phase 1)
  flappy_bird: {
    id: "flappy_bird",
    name: "Flappy Snap",
    shortName: "Flappy",
    description: "Tap to flap through pipes and score big!",
    icon: "🐦",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
  },
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

  // Phase 2 Single-player Games
  stack_puzzle: {
    id: "stack_puzzle",
    name: "Snap Stack",
    shortName: "Stack",
    description: "Stack blocks as high as you can!",
    icon: "🏗️",
    category: "quick_play",
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
    name: "Snap Minesweeper",
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
    name: "Snap Number",
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
  target_master: {
    id: "target_master",
    name: "Snap Aim",
    shortName: "Aim",
    description: "Tap targets before they shrink away!",
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
  lights_out: {
    id: "lights_out",
    name: "Snap Lights",
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

  // Phase 3: New Single-player Games
  match_game: {
    id: "match_game",
    name: "Snap Match",
    shortName: "Match",
    description: "Match 3 gems in a row to score combos!",
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
  pipes_game: {
    id: "pipes_game",
    name: "Snap Pipes",
    shortName: "Pipes",
    description: "Rotate pipes to connect the water flow!",
    icon: "🔧",
    category: "puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  nonogram_puzzle: {
    id: "nonogram_puzzle",
    name: "Snap Nonogram",
    shortName: "Nonogram",
    description: "Fill cells by clues to reveal a pixel picture!",
    icon: "🖼️",
    category: "puzzle",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  tap_tap_game: {
    id: "tap_tap_game",
    name: "Tap Tap Snap",
    shortName: "TapTap",
    description: "Tap falling notes to the beat!",
    icon: "🎵",
    category: "quick_play",
    minPlayers: 1,
    maxPlayers: 1,
    isMultiplayer: false,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  slice_game: {
    id: "slice_game",
    name: "Snap Slice",
    shortName: "Slice",
    description: "Swipe to slice shapes — avoid bombs!",
    icon: "🔪",
    category: "quick_play",
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
    name: "Snap Pong",
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
    name: "Snap Four",
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
    name: "Snap Dots",
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
    name: "Snap Gomoku",
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
    name: "Snap Reversi",
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
  words_game: {
    id: "words_game",
    name: "Snap Words",
    shortName: "Words",
    description: "Place letter tiles on the board to score!",
    icon: "🔤",
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
    name: "Snap War",
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
  hex_game: {
    id: "hex_game",
    name: "Snap Hex",
    shortName: "Hex",
    description: "Connect your two sides of the hex board!",
    icon: "⬡",
    category: "multiplayer",
    minPlayers: 1,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: true,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },

  // Phase 3: New Real-Time Multiplayer Games
  draw_game: {
    id: "draw_game",
    name: "Snap Draw",
    shortName: "Draw",
    description: "Draw the prompt — others guess!",
    icon: "🎨",
    category: "multiplayer",
    minPlayers: 2,
    maxPlayers: 8,
    isMultiplayer: true,
    hasLeaderboard: false,
    hasAchievements: true,
    isAvailable: true,
    isNew: true,
  },
  race_game: {
    id: "race_game",
    name: "Snap Race",
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
    name: "Snap Crossword",
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
  bounce_blitz: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher score is better
  },
  flappy_bird: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher score is better
  },
  snap_2048: {
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
  cart_course: {
    minScore: 0,
    maxScore: 999999,
    maxDuration: 600000, // 10 minutes max
    scoreDirection: "higher", // Higher score is better
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
  stack_puzzle: {
    minScore: 0,
    maxScore: 999,
    scoreDirection: "higher", // More blocks stacked is better
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
  target_master: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher points is better
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

  // Phase 3: New single-player games
  match_game: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher combo score is better
  },
  pipes_game: {
    minScore: 1,
    maxScore: 9999,
    scoreDirection: "lower", // Fewer seconds is better
  },
  nonogram_puzzle: {
    minScore: 1,
    maxScore: 9999,
    scoreDirection: "lower", // Fewer seconds is better
  },
  tap_tap_game: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher score is better
  },
  slice_game: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher score is better
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
  words_game: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  war_game: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  hex_game: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  draw_game: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Points from correct guesses
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
    case "snap_2048":
    case "snake_master":
    case "brick_breaker":
    case "flappy_bird":
    case "cart_course":
      return score.toLocaleString();
    case "memory_master":
      return `${score}s`;
    case "word_master":
      return score === 1 ? "1 guess" : `${score} guesses`;
    case "tile_slide":
      return score === 1 ? "1 move" : `${score} moves`;
    case "stack_puzzle":
      return `${score} blocks`;
    case "minesweeper_classic":
    case "number_master":
      return `${score}s`;
    case "target_master":
      return score.toLocaleString();
    case "lights_out":
      return score === 1 ? "1 move" : `${score} moves`;
    case "dot_match":
      return `${score} boxes`;
    // Phase 3 single-player
    case "match_game":
    case "tap_tap_game":
    case "slice_game":
      return score.toLocaleString();
    case "pipes_game":
    case "nonogram_puzzle":
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
    case "words_game":
    case "war_game":
    case "hex_game":
    case "draw_game":
    case "race_game":
      return `${score} wins`;
    default:
      return score.toString();
  }
}

