/**
 * Single-Player Game Types
 *
 * Type definitions for single-player games including:
 * - Flappy Dunk
 * - Bounce Master
 * - Color Match Blitz
 * - Daily Brain Puzzles
 *
 * @see docs/07_GAMES_ARCHITECTURE.md Section 1
 */

import { GameCategory, SinglePlayerGameType } from "./games";

// =============================================================================
// Base Single-Player State
// =============================================================================

/**
 * Common state for all single-player games
 */
export interface BaseSinglePlayerState {
  gameType: SinglePlayerGameType;
  category: GameCategory;

  // Player info
  playerId: string;

  // Session info
  sessionId: string;

  // Scoring
  score: number;
  highScore: number;

  // State
  status: "playing" | "paused" | "gameOver";
  startedAt: number;
  endedAt?: number;
  pausedAt?: number;
  totalPauseDuration: number;

  // Lives (for games that have them)
  lives?: number;
  maxLives?: number;
}

// =============================================================================
// Flappy Dunk
// =============================================================================

/**
 * Flappy Snap game state (Flappy Bird-style)
 */
export interface FlappySnapState extends BaseSinglePlayerState {
  gameType: "flappy_snap";
  category: "quick_play";

  // Ball state
  ball: {
    x: number;
    y: number;
    velocity: number;
    rotation: number;
  };

  // Hoops passed
  hoopsPassed: number;

  // Perfect dunks (through center)
  perfectDunks: number;

  // Combo tracking
  comboCount: number;
  maxCombo: number;

  // Obstacles
  currentHoopIndex: number;
  hoops: FlappyHoop[];

  // Power-ups (future)
  activePowerUp?: FlappyPowerUp;

  // Difficulty scaling
  difficultyLevel: number;
  scrollSpeed: number;
}

/**
 * Flappy hoop obstacle
 */
export interface FlappyHoop {
  id: number;
  x: number;
  centerY: number;
  gapSize: number;
  passed: boolean;
  scoredPerfect: boolean;
  moving?: {
    direction: "up" | "down";
    speed: number;
    minY: number;
    maxY: number;
  };
}

/**
 * Flappy power-up types
 */
export type FlappyPowerUp =
  | { type: "shield"; duration: number; remainingTime: number }
  | { type: "slow_motion"; duration: number; remainingTime: number }
  | { type: "double_points"; duration: number; remainingTime: number };

/**
 * Flappy Dunk constants
 */
export const FLAPPY_DUNK_CONFIG = {
  // Physics
  gravity: 0.5,
  jumpVelocity: -8,
  terminalVelocity: 12,

  // Ball
  ballRadius: 15,

  // Hoops
  baseHoopGap: 120,
  minHoopGap: 80,
  hoopWidth: 60,
  hoopSpacing: 200,

  // Scoring
  scorePerHoop: 1,
  perfectDunkBonus: 2,
  comboMultiplier: 0.5, // Additional per combo

  // Difficulty scaling
  difficultyIncreaseInterval: 5, // Every 5 hoops
  speedIncrease: 0.1,
  gapDecrease: 5,

  // Screen
  worldWidth: 400,
  worldHeight: 600,
};

// =============================================================================
// Bounce Master
// =============================================================================

/**
 * Bounce Blitz game state (Ballz-style)
 */
export interface BounceBlitzState extends BaseSinglePlayerState {
  gameType: "bounce_blitz";
  category: "quick_play";

  // Ball state
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
  };

  // Level info
  currentLevel: number;
  totalLevels: number;

  // Platforms
  platforms: BouncePlatform[];

  // Collectibles
  collectibles: BounceCollectible[];
  collectedCount: number;
  totalCollectibles: number;

  // Stars earned this level
  stars: 0 | 1 | 2 | 3;

  // Time tracking
  levelTime: number;
  parTime: number; // Target time for 3 stars

  // Bounces
  bounceCount: number;
  maxBouncesForBonus?: number;
}

/**
 * Platform in Bounce Master
 */
export interface BouncePlatform {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "normal" | "bouncy" | "sticky" | "breaking" | "moving";

  // For moving platforms
  movement?: {
    axis: "x" | "y";
    speed: number;
    minPos: number;
    maxPos: number;
  };

  // For breaking platforms
  breakState?: "solid" | "cracking" | "broken";

  // Bounce modifier
  bounciness: number; // 1 = normal, 2 = super bouncy, 0.5 = reduced
}

/**
 * Collectible item
 */
export interface BounceCollectible {
  id: number;
  x: number;
  y: number;
  type: "star" | "coin" | "gem";
  value: number;
  collected: boolean;
}

/**
 * Bounce Master constants
 */
export const BOUNCE_MASTER_CONFIG = {
  // Physics
  gravity: 0.3,
  airResistance: 0.99,
  normalBounciness: 0.8,
  superBounciness: 1.5,

  // Ball
  defaultBallRadius: 12,

  // Scoring
  collectibleBase: 10,
  timeBonus: 100, // Per second under par
  bounceBonus: 50, // For under max bounces

  // Stars
  starThresholds: {
    one: 0.3, // 30% of max score
    two: 0.6, // 60%
    three: 0.9, // 90%
  },
};

// =============================================================================
// Color Match Blitz
// =============================================================================

/**
 * Memory Snap game state (memory matching)
 */
export interface MemorySnapState extends BaseSinglePlayerState {
  gameType: "memory_snap";
  category: "puzzle";

  // Grid state
  grid: ColorTile[][];
  gridSize: { rows: number; cols: number };

  // Selection
  selectedTiles: Array<{ row: number; col: number }>;

  // Combo and multiplier
  comboCount: number;
  maxCombo: number;
  multiplier: number;

  // Time-based mode
  timeRemaining: number; // Seconds
  totalTime: number;

  // Level (endless mode)
  level: number;
  tilesCleared: number;
  tilesToClearForLevel: number;

  // Power-ups
  availablePowerUps: ColorMatchPowerUp[];
  activePowerUp?: ColorMatchPowerUp;
}

/**
 * Single tile in the grid
 */
export interface ColorTile {
  id: string;
  color: TileColor;
  special?: TileSpecial;
  selected: boolean;
  matched: boolean;
  falling: boolean;

  // Animation state
  animating: boolean;
  animationType?: "match" | "fall" | "spawn";
}

/**
 * Tile colors
 */
export type TileColor =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "purple"
  | "orange";

/**
 * Special tile types
 */
export type TileSpecial =
  | "bomb" // Clears surrounding tiles
  | "row_clear" // Clears entire row
  | "col_clear" // Clears entire column
  | "color_bomb" // Clears all of one color
  | "multiplier"; // 2x points for match

/**
 * Power-ups
 */
export interface ColorMatchPowerUp {
  type: "shuffle" | "extra_time" | "hint" | "clear_color";
  uses: number;
}

/**
 * Color Match Blitz constants
 */
export const COLOR_MATCH_CONFIG = {
  // Grid
  defaultRows: 8,
  defaultCols: 8,
  minMatchSize: 3,

  // Scoring
  baseScore: 10,
  comboMultiplierStep: 0.25,
  maxMultiplier: 5,

  // Time
  baseTime: 60, // Seconds
  timePerLevel: 10, // Bonus per level

  // Special creation thresholds
  matchForBomb: 5,
  matchForRowClear: 6,
  matchForColorBomb: 7,

  // Level progression
  baseTilesToClear: 50,
  tilesIncreasePerLevel: 20,
};

// =============================================================================
// Daily Brain Puzzles
// =============================================================================

/**
 * Daily Brain Puzzle types
 */
export type DailyPuzzleType =
  | "word_scramble"
  | "number_sequence"
  | "pattern_match"
  | "memory_grid"
  | "logic_puzzle";

/**
 * Word Snap game state (daily word puzzle)
 */
export interface WordSnapState extends BaseSinglePlayerState {
  gameType: "word_snap";
  category: "daily";

  // Puzzle info
  puzzleId: string;
  puzzleType: DailyPuzzleType;
  puzzleDate: string; // YYYY-MM-DD

  // Difficulty
  difficulty: "easy" | "medium" | "hard";

  // Progress
  currentStep: number;
  totalSteps: number;

  // Hints
  hintsUsed: number;
  maxHints: number;
  hintPenalty: number; // Score deduction per hint

  // Puzzle-specific state
  puzzleState: PuzzleSpecificState;

  // Time tracking
  timeLimit?: number;
  timeRemaining?: number;

  // Completion
  completed: boolean;
  perfectScore: boolean;

  // Streak tracking
  dailyStreak: number;
}

/**
 * Union of puzzle-specific states
 */
export type PuzzleSpecificState =
  | WordScrambleState
  | NumberSequenceState
  | PatternMatchState
  | MemoryGridState
  | LogicPuzzleState;

/**
 * Word Scramble puzzle state
 */
export interface WordScrambleState {
  type: "word_scramble";
  scrambledWord: string;
  targetWord: string;
  currentGuess: string;
  attempts: string[];
  maxAttempts: number;
}

/**
 * Number Sequence puzzle state
 */
export interface NumberSequenceState {
  type: "number_sequence";
  sequence: (number | null)[]; // null = blank to fill
  correctAnswers: number[];
  userAnswers: (number | null)[];
  rule: string; // Description of the pattern (hidden)
}

/**
 * Pattern Match puzzle state
 */
export interface PatternMatchState {
  type: "pattern_match";
  grid: PatternCell[][];
  options: PatternCell[];
  correctOption: number;
  selectedOption?: number;
}

interface PatternCell {
  shape: "circle" | "square" | "triangle" | "star";
  color: string;
  rotation: number;
}

/**
 * Memory Grid puzzle state
 */
export interface MemoryGridState {
  type: "memory_grid";
  gridSize: number;
  pattern: boolean[][]; // True = highlighted cell
  displayPhase: boolean; // Show pattern or hide
  userSelection: boolean[][];
  displayTime: number; // Seconds to memorize
}

/**
 * Logic Puzzle state
 */
export interface LogicPuzzleState {
  type: "logic_puzzle";
  puzzle: LogicGrid;
  clues: string[];
  userSolution: LogicGridCell[][];
}

interface LogicGrid {
  categories: string[];
  items: string[][];
  correctSolution: LogicGridCell[][];
}

interface LogicGridCell {
  value: "yes" | "no" | "unknown";
}

/**
 * Daily Puzzle constants
 */
export const DAILY_PUZZLE_CONFIG = {
  // Hints
  defaultMaxHints: 3,
  hintPenalty: 50,

  // Time
  wordScrambleTime: 120,
  numberSequenceTime: 90,
  patternMatchTime: 60,
  memoryGridTime: 180,
  logicPuzzleTime: 300,

  // Scoring
  baseScore: 1000,
  timeBonusMultiplier: 10, // Per second remaining
  perfectBonus: 500,
  streakBonus: 50, // Per day of streak

  // Memory grid display times
  memoryDisplayEasy: 5,
  memoryDisplayMedium: 3,
  memoryDisplayHard: 2,
};

// =============================================================================
// Snap 2048
// =============================================================================

/**
 * Snap 2048 game state
 */
export interface Snap2048State extends BaseSinglePlayerState {
  gameType: "snap_2048";
  category: "puzzle";

  // 4x4 grid - 0 means empty, 2/4/8/16... means tile value
  board: number[][];

  // Best tile achieved
  bestTile: number;

  // Move count
  moveCount: number;

  // Whether player has achieved 2048 (can continue playing)
  hasWon: boolean;

  // Animation state for smooth tile transitions
  lastMove?: {
    direction: Snap2048Direction;
    mergedPositions: { row: number; col: number; value: number }[];
    movedTiles: {
      from: { row: number; col: number };
      to: { row: number; col: number };
      value: number;
    }[];
    newTile?: { row: number; col: number; value: number };
  };
}

/**
 * Swipe direction for 2048
 */
export type Snap2048Direction = "up" | "down" | "left" | "right";

/**
 * 2048 game constants
 */
export const SNAP_2048_CONFIG = {
  // Grid
  gridSize: 4,

  // Initial tiles
  initialTileCount: 2,
  newTileChance4: 0.1, // 10% chance of spawning 4 instead of 2

  // Scoring
  // Score = sum of all merged tiles
  // e.g., merging two 2s gives 4 points, two 4s gives 8 points

  // Win condition
  winTile: 2048,

  // Tile colors (value -> color)
  tileColors: {
    0: "#CDC1B4",
    2: "#EEE4DA",
    4: "#EDE0C8",
    8: "#F2B179",
    16: "#F59563",
    32: "#F67C5F",
    64: "#F65E3B",
    128: "#EDCF72",
    256: "#EDCC61",
    512: "#EDC850",
    1024: "#EDC53F",
    2048: "#EDC22E",
    4096: "#3C3A32",
    8192: "#3C3A32",
  } as Record<number, string>,

  // Text colors (dark for light tiles, light for dark tiles)
  tileTextColors: {
    2: "#776E65",
    4: "#776E65",
    // Everything else is white
  } as Record<number, string>,
};

// =============================================================================
// Snap Snake
// =============================================================================

/**
 * Snap Snake game state
 */
export interface SnapSnakeState extends BaseSinglePlayerState {
  gameType: "snap_snake";
  category: "quick_play";

  // Snake body segments (head is at index 0)
  snake: { x: number; y: number }[];

  // Current food position
  food: { x: number; y: number };

  // Current direction
  direction: SnakeDirection;

  // Buffered direction (for smooth input handling)
  nextDirection: SnakeDirection;

  // Grid dimensions
  gridWidth: number;
  gridHeight: number;

  // Game speed (ms per tick)
  speed: number;

  // Food eaten count
  foodEaten: number;

  // Longest length achieved
  maxLength: number;
}

/**
 * Snake movement direction
 */
export type SnakeDirection = "up" | "down" | "left" | "right";

/**
 * Snap Snake game constants
 */
export const SNAP_SNAKE_CONFIG = {
  // Grid
  defaultGridWidth: 20,
  defaultGridHeight: 28,

  // Initial state
  initialLength: 3,
  initialSpeed: 150, // ms per tick

  // Speed scaling
  minSpeed: 60, // Fastest speed (ms per tick)
  speedDecreasePerFood: 2, // Speed up by 2ms per food eaten

  // Scoring
  baseScorePerFood: 10,
  lengthBonusMultiplier: 1, // Extra points per current length

  // Colors
  snakeHeadColor: "#4CAF50",
  snakeBodyColor: "#66BB6A",
  snakeTailColor: "#81C784",
  foodColor: "#FF5722",
  gridColor: "#1a1a2e",
  gridLineColor: "#16213e",
};

// =============================================================================
// 2048 Stats
// =============================================================================

export interface Snap2048Stats {
  gameType: "snap_2048";
  bestTile: number;
  moveCount: number;
  mergeCount: number;
  didWin: boolean;
}

// =============================================================================
// Snake Stats
// =============================================================================

export interface SnapSnakeStats {
  gameType: "snap_snake";
  foodEaten: number;
  maxLength: number;
  survivalTime: number; // seconds
}

// =============================================================================
// Game Session Management
// =============================================================================

/**
 * Single-player game session for Firestore
 */
export interface SinglePlayerGameSession {
  id: string;
  playerId: string;
  gameType: SinglePlayerGameType;

  // Scores
  finalScore: number;
  highScore: number;
  isNewHighScore: boolean;

  // Timing
  startedAt: number;
  endedAt: number;
  duration: number; // Seconds

  // Game-specific stats
  stats: SinglePlayerGameStats;

  // Achievements unlocked this session
  achievementsUnlocked: string[];

  // Coins earned
  coinsEarned: number;

  // Platform info
  platform: "ios" | "android";
}

/**
 * Union of game-specific stats
 */
export type SinglePlayerGameStats =
  | FlappySnapStats
  | BounceBlitzStats
  | MemorySnapStats
  | WordSnapStats
  | Snap2048Stats
  | SnapSnakeStats;

export interface FlappySnapStats {
  gameType: "flappy_snap";
  pipesPassed: number;
  perfectPasses: number;
  maxCombo: number;
  totalJumps: number;
}

export interface BounceBlitzStats {
  gameType: "bounce_blitz";
  levelReached: number;
  blocksDestroyed: number;
  ballsLaunched: number;
  totalBounces: number;
}

export interface MemorySnapStats {
  gameType: "memory_snap";
  pairsMatched: number;
  attempts: number;
  perfectMatches: number;
  bestTime: number;
}

export interface WordSnapStats {
  gameType: "word_snap";
  wordGuessed: boolean;
  attemptsUsed: number;
  hintsUsed: number;
  streakDay: number;
}

// =============================================================================
// Leaderboard Types
// =============================================================================

/**
 * Leaderboard entry for single-player games
 */
export interface SinglePlayerLeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  score: number;
  achievedAt: number;

  // Game-specific highlights
  highlights?: {
    [key: string]: string | number;
  };
}

/**
 * Leaderboard periods
 */
export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "allTime";

/**
 * Leaderboard request
 */
export interface LeaderboardRequest {
  gameType: SinglePlayerGameType;
  period: LeaderboardPeriod;
  limit?: number;
  aroundPlayer?: string; // Center on this player
}
