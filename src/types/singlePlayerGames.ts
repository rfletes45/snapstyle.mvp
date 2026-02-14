/**
 * Single-Player Game Types
 *
 * Type definitions for single-player games including:
 * - Bounce Blitz
 * - Word Master
 * - Play 2048
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
 * Word Master game state (daily word puzzle)
 */
export interface WordMasterState extends BaseSinglePlayerState {
  gameType: "word_master";
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
// Play 2048
// =============================================================================

/**
 * Play 2048 game state
 */
export interface Play2048State extends BaseSinglePlayerState {
  gameType: "play_2048";
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
    direction: Play2048Direction;
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
export type Play2048Direction = "up" | "down" | "left" | "right";

/**
 * 2048 game constants
 */
export const PLAY_2048_CONFIG = {
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
// 2048 Stats
// =============================================================================

export interface Play2048Stats {
  gameType: "play_2048";
  bestTile: number;
  moveCount: number;
  mergeCount: number;
  didWin: boolean;
}

// =============================================================================
// Brick Breaker (New Game)
// =============================================================================

/**
 * Brick type in the game
 */
export type BrickType =
  | "standard"
  | "silver"
  | "gold"
  | "indestructible"
  | "explosive"
  | "mystery";

/**
 * Power-up type
 */
export type BrickPowerUpType =
  | "expand"
  | "shrink"
  | "multi_ball"
  | "laser"
  | "slow"
  | "fast"
  | "sticky"
  | "extra_life";

/**
 * Paddle state
 */
export interface BrickPaddleState {
  x: number;
  width: number;
  baseWidth: number;
  hasSticky: boolean;
  hasLaser: boolean;
}

/**
 * Ball state
 */
export interface BrickBallState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isStuck: boolean;
}

/**
 * Brick state
 */
export interface BrickState {
  id: string;
  row: number;
  col: number;
  type: BrickType;
  hitsRemaining: number;
  hasPowerUp: boolean;
}

/**
 * Falling power-up
 */
export interface FallingPowerUp {
  id: string;
  type: BrickPowerUpType;
  x: number;
  y: number;
  vy: number;
}

/**
 * Laser projectile
 */
export interface LaserState {
  id: string;
  x: number;
  y: number;
  vy: number;
}

/**
 * Active effect on paddle/ball
 */
export interface ActiveEffect {
  type: BrickPowerUpType;
  expiresAt: number;
  usesRemaining?: number;
}

/**
 * Brick Breaker game state
 */
export interface BrickBreakerState extends BaseSinglePlayerState {
  gameType: "brick_breaker";
  category: "quick_play";

  // Game objects
  paddle: BrickPaddleState;
  balls: BrickBallState[];
  bricks: BrickState[];
  powerUps: FallingPowerUp[];
  lasers: LaserState[];

  // Progress
  currentLevel: number;
  lives: number;
  maxLives: number;

  // Active effects
  activeEffects: ActiveEffect[];

  // Stats
  bricksDestroyed: number;
  powerUpsCollected: number;
  maxCombo: number;
  perfectLevels: number;

  // Game phase
  phase: "ready" | "playing" | "levelComplete" | "gameOver";
}

/**
 * Brick Breaker stats for session recording
 */
export interface BrickBreakerStats {
  gameType: "brick_breaker";
  levelsCompleted: number;
  bricksDestroyed: number;
  powerUpsCollected: number;
  perfectLevels: number;
  maxMultiBall: number;
}

/**
 * Brick Breaker configuration constants
 */
export const BRICK_BREAKER_CONFIG = {
  // Canvas dimensions
  canvasWidth: 360,
  canvasHeight: 640,

  // Paddle
  paddleWidth: 80,
  paddleHeight: 12,
  paddleY: 580,
  paddleSpeed: 15,
  expandedWidth: 120,
  shrunkWidth: 56,

  // Ball
  ballRadius: 8,
  ballBaseSpeed: 5,
  maxBallSpeed: 12,
  maxBalls: 5,

  // Bricks
  brickRows: 6,
  brickCols: 8,
  brickWidth: 40,
  brickHeight: 16,
  brickPadding: 4,
  brickTopOffset: 60,

  // Power-ups
  powerUpSpeed: 3,
  powerUpSize: 24,
  effectDurations: {
    expand: 15000,
    shrink: 15000,
    laser: 20000,
    slow: 12000,
    fast: 12000,
    sticky: 3, // uses
  },

  // Physics
  speedIncreasePerLevel: 0.5,
  bounceVariation: 0.2,

  // Game
  totalLevels: 30,
  startingLives: 3,

  // Scoring
  brickPoints: {
    standard: 10,
    silver: 25,
    gold: 50,
    explosive: 15,
    mystery: 20,
    indestructible: 0,
  },
  levelCompleteBonus: 100,
  noMissBonus: 200,
  speedBonus: 150,
  multiBallMultiplier: 1.5,
};

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
  | BounceBlitzStats
  | WordMasterStats
  | Play2048Stats
  | BrickBreakerStats;

export interface BounceBlitzStats {
  gameType: "bounce_blitz";
  levelReached: number;
  blocksDestroyed: number;
  ballsLaunched: number;
  totalBounces: number;
}

export interface WordMasterStats {
  gameType: "word_master";
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
