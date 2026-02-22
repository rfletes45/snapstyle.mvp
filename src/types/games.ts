/**
 * Games Type Definitions
 *
 * This file contains all type definitions for the games expansion including:
 * - Single-player game types (Bounce Blitz, Pong, etc.)
 * - Turn-based multiplayer types (Chess, Checkers, Crazy Eights)
 * - Real-time multiplayer types (Starforge, Sketch Party)
 * - Game metadata and configuration
 *
 * @see docs/06_GAMES_RESEARCH.md for physics research
 * @see docs/PROMPT_GAMES_EXPANSION.md for full implementation plan
 */

import { COLYSEUS_FEATURES } from "@/constants/featureFlags";

// =============================================================================
// Game Type Unions
// =============================================================================

/**
 * Single-player games that can be played solo
 */
export type SinglePlayerGameType =
  | "bounce_blitz" // Ballz-style
  | "play_2048" // 2048 puzzle
  | "word_master" // Daily word puzzle (Wordle-style)
  | "brick_breaker" // Classic Breakout/Arkanoid
  | "minesweeper_classic" // Classic Minesweeper
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
  | "reversi_game"; // Othello / Reversi

/**
 * Real-time multiplayer games (simulated turn-based for pool)
 */
export type RealTimeGameType =
  | "crossword_puzzle" // Daily mini crossword
  | "starforge_game" // Starforge incremental
  | "sketch_party_game" // Sketch Party (skribbl-style)
  | "minigolf_duels"; // Mini-Golf Duels

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
 * Scoring type determines how to interpret/display scores for this game.
 */
export type ScoringType =
  | "high_score"
  | "time_low"
  | "moves_low"
  | "wins"
  | "guesses_low"
  | "boxes"
  | "points"
  | "flux";

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
  // ── Extended detail fields for GameDetails screen ──
  /** Short one-line tagline shown in long-press sheet and hero header */
  tagline?: string;
  /** Longer game description (paragraph) for the About section */
  longDescription?: string;
  /** How-to-play bullet points */
  howToPlay?: string[];
  /** Keyword tags for display chips (e.g. "Strategy", "2-player") */
  tags?: string[];
  /** Scoring interpretation */
  scoringType?: ScoringType;
}

/**
 * Game metadata registry - source of truth for all games
 */
export const GAME_METADATA: Record<ExtendedGameType, GameMetadata> = {
  // Single-player: Quick Play
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
    tagline: "Aim, launch, destroy — beat your high score!",
    longDescription:
      "Bounce Blitz is a fast-paced arcade game where you aim and launch balls at numbered blocks. Each ball that hits a block reduces its number. Clear all the blocks before they reach the bottom to survive. Strategy matters — angle your shots to maximize bounces and chain reactions.",
    howToPlay: [
      "Swipe to aim your shot angle",
      "Balls bounce off walls and blocks",
      "Each hit reduces a block's number by 1",
      "Collect power-ups for extra balls",
      "Survive as long as you can for a high score",
    ],
    tags: ["Arcade", "Solo", "High Score"],
    scoringType: "high_score",
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
    tagline: "Slide, merge, and chase the 2048 tile",
    longDescription:
      "The classic number-merging puzzle. Swipe to slide all tiles on the board — when two tiles with the same number collide, they merge into one. Plan ahead to keep the board from filling up and reach the legendary 2048 tile… and beyond.",
    howToPlay: [
      "Swipe in any direction to slide all tiles",
      "Matching tiles merge into their sum",
      "Try to reach 2048 — or keep going!",
      "Game over when no moves remain",
    ],
    tags: ["Puzzle", "Solo", "High Score"],
    scoringType: "high_score",
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
    tagline: "One word, six tries — can you crack it?",
    longDescription:
      "A new five-letter word every day. Type your guess and get instant colour-coded feedback: green means correct letter in the right spot, yellow means right letter wrong spot, and grey means the letter isn't in the word. Solve it in as few guesses as possible to keep your streak alive.",
    howToPlay: [
      "Type a valid five-letter word and submit",
      "Green = correct position, Yellow = wrong position",
      "Grey = letter not in the word",
      "Solve in 6 guesses or fewer",
    ],
    tags: ["Daily", "Word", "Solo"],
    scoringType: "guesses_low",
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
    tagline: "Classic brick-breaking arcade action",
    longDescription:
      "Control a paddle at the bottom of the screen and keep the ball in play to smash every brick. Some bricks need multiple hits, and power-ups fall from destroyed bricks. Clear every level to prove your reflexes.",
    howToPlay: [
      "Drag left/right to move your paddle",
      "Keep the ball from falling off-screen",
      "Break all bricks to clear the level",
      "Catch power-ups for extra balls, lasers, and more",
    ],
    tags: ["Arcade", "Solo", "High Score"],
    scoringType: "high_score",
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
    tagline: "Sweep the board — don't hit a mine!",
    longDescription:
      "The timeless logic puzzle. Reveal squares on a grid; each number tells you how many adjacent mines surround it. Use deduction to flag all mines and clear every safe square in record time.",
    howToPlay: [
      "Tap a square to reveal it",
      "Numbers show adjacent mine count",
      "Long-press to flag a suspected mine",
      "Clear all safe squares to win",
    ],
    tags: ["Puzzle", "Solo", "Speed"],
    scoringType: "time_low",
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
    tagline: "Turn off every light with logic",
    longDescription:
      "Each tap toggles a light and its neighbors. Your goal is to switch every light off using the fewest moves possible. Simple rules, surprisingly tricky solutions — a perfect brain teaser.",
    howToPlay: [
      "Tap a light to toggle it and its neighbors",
      "Turn all lights off to win",
      "Fewer moves = higher rank",
    ],
    tags: ["Puzzle", "Solo", "Logic"],
    scoringType: "moves_low",
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
    tagline: "Retro paddle action against the AI",
    longDescription:
      "The original arcade classic, reimagined for mobile. Drag your paddle to return the ball and outscore the AI opponent. The ball speeds up after every rally — how many wins can you rack up?",
    howToPlay: [
      "Drag your paddle up/down to hit the ball",
      "Score when the ball passes the AI's paddle",
      "Ball speeds up after each rally",
      "Win as many rounds as you can",
    ],
    tags: ["Arcade", "Solo", "Retro"],
    scoringType: "wins",
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
    tagline: "Outsmart your opponent on the 64-square board",
    longDescription:
      "The ultimate strategy game. Command an army of pieces — pawns, knights, bishops, rooks, a queen, and your king — to checkmate your opponent. Play against friends in turn-based matches.",
    howToPlay: [
      "Tap a piece, then tap a valid square to move",
      "Capture opponent pieces by moving onto their square",
      "Put the opponent's king in check — and checkmate to win",
      "Use castling and en-passant for advanced play",
    ],
    tags: ["Strategy", "2-Player", "Turn-Based"],
    scoringType: "wins",
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
    tagline: "Jump, capture, and king your way to victory",
    longDescription:
      "A classic board game of diagonal moves and multi-jump captures. Reach the far side to crown a king and gain the power to move backward. Capture all your opponent's pieces or block them completely to win.",
    howToPlay: [
      "Pieces move diagonally forward one square",
      "Jump over an opponent's piece to capture it",
      "Chain multiple jumps in one turn for combos",
      "Reach the opposite end to become a king",
    ],
    tags: ["Strategy", "2-Player", "Turn-Based"],
    scoringType: "wins",
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
    tagline: "Play your cards right — eights are wild!",
    longDescription:
      "A fast-paced card game for 2-4 players. Match the top card by suit or rank, or play an 8 to change the suit. Be the first to empty your hand to win the round. Simple to learn, full of twists.",
    howToPlay: [
      "Match the top card by suit or rank",
      "Play an 8 to choose any suit",
      "Draw from the deck if you can't play",
      "First player to empty their hand wins",
    ],
    tags: ["Cards", "2-4 Players", "Turn-Based"],
    scoringType: "wins",
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
    tagline: "Three in a row — the timeless classic",
    longDescription:
      "The simplest strategy game. Take turns placing X or O on a 3×3 grid. Line up three of your marks horizontally, vertically, or diagonally to win. Quick rounds make it perfect for a casual challenge.",
    howToPlay: [
      "Tap an empty cell to place your mark",
      "Get three in a row to win",
      "Block your opponent from completing a line",
    ],
    tags: ["Classic", "2-Player", "Quick"],
    scoringType: "wins",
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
    tagline: "Drop discs and connect four to win",
    longDescription:
      "Drop colored discs into a vertical grid. The first player to connect four discs in a row — horizontally, vertically, or diagonally — wins. Think ahead and block your opponent while building your own line.",
    howToPlay: [
      "Tap a column to drop your disc",
      "Discs stack from the bottom up",
      "Connect 4 in any direction to win",
      "Block your opponent's lines",
    ],
    tags: ["Strategy", "2-Player", "Turn-Based"],
    scoringType: "wins",
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
    tagline: "Draw lines, claim boxes, dominate the grid",
    longDescription:
      "A dots-and-boxes strategy game. Take turns drawing a line between two dots. When you complete the fourth side of a box, you claim it and take another turn. The player with the most boxes at the end wins.",
    howToPlay: [
      "Tap between two dots to draw a line",
      "Complete a box's fourth side to claim it",
      "Claiming a box gives you another turn",
      "Most boxes at the end wins",
    ],
    tags: ["Strategy", "2-Player", "Turn-Based"],
    scoringType: "boxes",
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
    tagline: "Five in a row — the ultimate board duel",
    longDescription:
      "Place stones on a large grid, taking turns with your opponent. The first player to line up five stones in a row — horizontally, vertically, or diagonally — wins. Simple rules, deep strategy.",
    howToPlay: [
      "Tap an intersection to place your stone",
      "Get five in a row to win",
      "Block your opponent while building your line",
      "Think several moves ahead",
    ],
    tags: ["Strategy", "2-Player", "Board"],
    scoringType: "wins",
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
    tagline: "Outflank, flip, and dominate the board",
    longDescription:
      "Place discs to outflank your opponent's pieces and flip them to your color. Control the corners and edges for maximum advantage. The player with the most discs when the board is full wins.",
    howToPlay: [
      "Place a disc to outflank opponent's pieces",
      "All outflanked pieces flip to your color",
      "Control corners for a strong position",
      "Most discs at the end wins",
    ],
    tags: ["Strategy", "2-Player", "Board"],
    scoringType: "wins",
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
    tagline: "Daily bite-sized crossword puzzle",
    longDescription:
      "A fresh 5×5 mini crossword every day. Read the clues, fill in the grid, and race the clock. Compact enough for a quick break but tricky enough to keep you thinking.",
    howToPlay: [
      "Tap a clue to highlight its row or column",
      "Type letters to fill the grid",
      "Complete the puzzle as fast as you can",
      "New puzzle every day",
    ],
    tags: ["Daily", "Word", "Solo"],
    scoringType: "time_low",
  },

  // Multiplayer: Real-time
  starforge_game: {
    id: "starforge_game",
    name: "Starforge",
    shortName: "Starforge",
    description:
      "Build machines, harvest wrecks, and forge your star empire. Tap to earn Flux!",
    icon: "🌟",
    category: "multiplayer",
    minPlayers: 1,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: false,
    hasAchievements: false,
    isAvailable: true,
    isNew: true,
    tagline: "Tap, build, and forge your star empire",
    longDescription:
      "An incremental space-building game. Tap to generate Flux, the universal energy currency. Invest Flux in machines, harvest wrecks for rare materials, and expand your empire. Compete with friends to see who can build the greatest star network.",
    howToPlay: [
      "Tap the star to generate Flux",
      "Spend Flux to buy machines and upgrades",
      "Harvest wrecks for bonus materials",
      "Compete for the highest Flux total",
    ],
    tags: ["Incremental", "Multiplayer", "Sci-Fi"],
    scoringType: "flux",
  },
  sketch_party_game: {
    id: "sketch_party_game",
    name: "Sketch Party",
    shortName: "Sketch",
    description: "Draw the word. Guess fast. Score points.",
    icon: "🎨",
    category: "multiplayer",
    minPlayers: 2,
    maxPlayers: 10,
    isMultiplayer: true,
    hasLeaderboard: false,
    hasAchievements: true,
    isAvailable: true, // Gated by PARTY_ENABLED at runtime via featureFlags
    isNew: true,
    comingSoon: false,
    tagline: "Draw it, guess it, laugh about it",
    longDescription:
      "A party drawing game for 2-10 players. One player draws a prompt while others race to guess the word. Faster correct guesses earn more points. Take turns drawing and watch hilarious interpretations appear in real time.",
    howToPlay: [
      "The drawer sees a secret word and sketches it",
      "Other players type guesses in the chat",
      "Faster correct guesses score more points",
      "Players take turns drawing each round",
    ],
    tags: ["Party", "Drawing", "2-10 Players"],
    scoringType: "points",
  },
  minigolf_duels: {
    id: "minigolf_duels",
    name: "Mini-Golf Duels",
    shortName: "Golf",
    description:
      "Sink the putt. Beat your rival across 9 holes of tricky mini-golf.",
    icon: "⛳",
    category: "multiplayer",
    minPlayers: 2,
    maxPlayers: 2,
    isMultiplayer: true,
    hasLeaderboard: false,
    hasAchievements: true,
    isAvailable: COLYSEUS_FEATURES.PHYSICS_ENABLED,
    isNew: true,
    tagline: "Putt your way to victory in 9 holes",
    longDescription:
      "Challenge a friend to 9 holes of physics-based mini-golf. Aim your shot, set your power, and navigate obstacles, ramps, and tricky greens. Lowest total strokes after 9 holes wins the duel.",
    howToPlay: [
      "Drag to aim your shot direction",
      "Pull back to set power, release to putt",
      "Navigate obstacles and slopes",
      "Lowest total strokes wins",
    ],
    tags: ["Sports", "2-Player", "Physics"],
    scoringType: "high_score",
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
  // Single-player games
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
  minesweeper_classic: {
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
  crossword_puzzle: {
    minScore: 1,
    maxScore: 9999,
    scoreDirection: "lower", // Fewer seconds is better
  },
  starforge_game: {
    minScore: 0,
    maxScore: 999999999,
    scoreDirection: "higher", // Total flux earned
  },
  sketch_party_game: {
    minScore: 0,
    maxScore: 99999,
    scoreDirection: "higher", // Points accumulated
  },
  minigolf_duels: {
    minScore: 0,
    maxScore: 999,
    scoreDirection: "lower", // Fewer total strokes is better
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
    case "bounce_blitz":
    case "play_2048":
    case "brick_breaker":
      return score.toLocaleString();
    case "word_master":
      return score === 1 ? "1 guess" : `${score} guesses`;
    case "minesweeper_classic":
      return `${score}s`;
    case "lights_out":
      return score === 1 ? "1 move" : `${score} moves`;
    case "dot_match":
      return `${score} boxes`;
    case "crossword_puzzle":
      return `${score}s`;
    case "starforge_game":
      return `${(score / 1000).toFixed(1)} flux`;
    case "pong_game":
      return `${score} wins`;
    // Multiplayer games
    case "chess":
    case "checkers":
    case "tic_tac_toe":
    case "crazy_eights":
    case "connect_four":
    case "gomoku_master":
    case "reversi_game":
      return `${score} wins`;
    case "sketch_party_game":
      return `${score.toLocaleString()} pts`;
    default:
      return score.toString();
  }
}
