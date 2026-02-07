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
  | "snap_2048" // 2048 puzzle
  | "snap_snake" // Classic snake
  | "memory_snap" // Memory matching
  | "word_snap" // Daily word puzzle (Wordle-style)
  | "reaction_tap" // Existing - tap when green
  | "timed_tap" // Existing - tap count in 10s
  | "cart_course" // DK Crash Course-style tilt game
  | "flappy_snap" // Flappy Bird-style pipe game
  // New single-player games (Phase 1)
  | "brick_breaker" // Classic Breakout/Arkanoid
  | "tile_slide" // Classic 15-puzzle sliding tiles
  // New single-player games (Phase 2)
  | "snap_stack" // Stacking tower game
  | "snap_minesweeper" // Classic Minesweeper
  | "snap_number" // Mental math speed game
  | "snap_aim" // Target shooting accuracy
  | "snap_lights" // Lights Out puzzle
  // New single-player games (Phase 3)
  | "snap_match" // Match-3 (Candy Crush/Bejeweled)
  | "snap_pipes" // Pipe Mania rotate-to-connect
  | "snap_nonogram" // Picross / Nonogram
  | "tap_tap_snap" // Rhythm / Piano Tiles
  | "snap_slice" // Fruit Ninja swipe-to-slice
  | "snap_pong"; // Pong with AI

/**
 * Turn-based multiplayer games
 */
export type TurnBasedGameType =
  | "chess"
  | "checkers"
  | "crazy_eights"
  | "tic_tac_toe"
  | "snap_four" // Connect Four
  | "snap_dots" // Dots and Boxes
  | "snap_gomoku" // Five in a Row (Gomoku)
  // New turn-based games (Phase 3)
  | "snap_reversi" // Othello / Reversi
  | "snap_words" // Scrabble-lite
  | "snap_war" // Card War
  | "snap_hex"; // Hex board game

/**
 * Real-time multiplayer games (simulated turn-based for pool)
 */
export type RealTimeGameType =
  | "8ball_pool"
  | "air_hockey"
  // New real-time games (Phase 3)
  | "snap_draw" // Pictionary drawing game
  | "snap_race" // Typing race
  | "snap_crossword"; // Daily mini crossword

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
    isNew: true,
  },

  // New Single-player Games (Phase 1)
  flappy_snap: {
    id: "flappy_snap",
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
  snap_stack: {
    id: "snap_stack",
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
  snap_minesweeper: {
    id: "snap_minesweeper",
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
  snap_number: {
    id: "snap_number",
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
  snap_aim: {
    id: "snap_aim",
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
  snap_lights: {
    id: "snap_lights",
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
  snap_match: {
    id: "snap_match",
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
  snap_pipes: {
    id: "snap_pipes",
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
  snap_nonogram: {
    id: "snap_nonogram",
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
  tap_tap_snap: {
    id: "tap_tap_snap",
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
  snap_slice: {
    id: "snap_slice",
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
  snap_pong: {
    id: "snap_pong",
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
  snap_four: {
    id: "snap_four",
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
  snap_dots: {
    id: "snap_dots",
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
  snap_gomoku: {
    id: "snap_gomoku",
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
  snap_reversi: {
    id: "snap_reversi",
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
  snap_words: {
    id: "snap_words",
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
  snap_war: {
    id: "snap_war",
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
  snap_hex: {
    id: "snap_hex",
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
  snap_draw: {
    id: "snap_draw",
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
  snap_race: {
    id: "snap_race",
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
  snap_crossword: {
    id: "snap_crossword",
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
  flappy_snap: {
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
  cart_course: {
    minScore: 0,
    maxScore: 999999,
    maxDuration: 600000, // 10 minutes max
    scoreDirection: "higher", // Higher score is better
  },
  word_snap: {
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
  snap_stack: {
    minScore: 0,
    maxScore: 999,
    scoreDirection: "higher", // More blocks stacked is better
  },
  snap_minesweeper: {
    minScore: 1,
    maxScore: 9999,
    scoreDirection: "lower", // Fewer seconds is better
  },
  snap_number: {
    minScore: 1,
    maxScore: 9999,
    scoreDirection: "lower", // Fewer seconds is better
  },
  snap_aim: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher points is better
  },
  snap_lights: {
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
  snap_four: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  snap_dots: {
    minScore: 0,
    maxScore: 16,
    scoreDirection: "higher", // Boxes captured
  },
  snap_gomoku: {
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
  snap_match: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher combo score is better
  },
  snap_pipes: {
    minScore: 1,
    maxScore: 9999,
    scoreDirection: "lower", // Fewer seconds is better
  },
  snap_nonogram: {
    minScore: 1,
    maxScore: 9999,
    scoreDirection: "lower", // Fewer seconds is better
  },
  tap_tap_snap: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher score is better
  },
  snap_slice: {
    minScore: 0,
    maxScore: 999999,
    scoreDirection: "higher", // Higher score is better
  },
  snap_pong: {
    minScore: 0,
    maxScore: 999,
    scoreDirection: "higher", // Games won vs AI
  },

  // Phase 3: New multiplayer games
  snap_reversi: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  snap_words: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  snap_war: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  snap_hex: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  snap_draw: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Points from correct guesses
  },
  snap_race: {
    minScore: 0,
    maxScore: 9999,
    scoreDirection: "higher", // Wins
  },
  snap_crossword: {
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
    case "snap_snake":
    case "brick_breaker":
    case "flappy_snap":
    case "cart_course":
      return score.toLocaleString();
    case "memory_snap":
      return `${score}s`;
    case "word_snap":
      return score === 1 ? "1 guess" : `${score} guesses`;
    case "tile_slide":
      return score === 1 ? "1 move" : `${score} moves`;
    case "snap_stack":
      return `${score} blocks`;
    case "snap_minesweeper":
    case "snap_number":
      return `${score}s`;
    case "snap_aim":
      return score.toLocaleString();
    case "snap_lights":
      return score === 1 ? "1 move" : `${score} moves`;
    case "snap_dots":
      return `${score} boxes`;
    // Phase 3 single-player
    case "snap_match":
    case "tap_tap_snap":
    case "snap_slice":
      return score.toLocaleString();
    case "snap_pipes":
    case "snap_nonogram":
    case "snap_crossword":
      return `${score}s`;
    case "snap_pong":
      return `${score} wins`;
    // Multiplayer games
    case "chess":
    case "checkers":
    case "8ball_pool":
    case "tic_tac_toe":
    case "crazy_eights":
    case "air_hockey":
    case "snap_four":
    case "snap_gomoku":
    case "snap_reversi":
    case "snap_words":
    case "snap_war":
    case "snap_hex":
    case "snap_draw":
    case "snap_race":
      return `${score} wins`;
    default:
      return score.toString();
  }
}
