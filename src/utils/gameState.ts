/**
 * Game State Management Utilities
 *
 * Provides state management utilities for single-player games including:
 * - Game state machines
 * - Score tracking
 * - High score persistence
 * - Pause/resume handling
 *
 * @see docs/06_GAMES_RESEARCH.md
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { ExtendedGameType } from "@/types/models";


import { createLogger } from "@/utils/log";
const logger = createLogger("utils/gameState");
// =============================================================================
// Types
// =============================================================================

/**
 * Game state machine states
 */
export type GameState =
  | "idle" // Initial state, showing menu
  | "ready" // Ready to start (countdown)
  | "playing" // Game in progress
  | "paused" // Game paused
  | "game_over" // Game ended
  | "victory"; // Player won (for games with win conditions)

/**
 * Game state transition events
 */
export type GameEvent =
  | "START" // User taps start
  | "COUNTDOWN_COMPLETE" // Countdown finished
  | "PAUSE" // User pauses
  | "RESUME" // User resumes
  | "GAME_OVER" // Player lost
  | "VICTORY" // Player won
  | "RESTART" // User restarts
  | "EXIT"; // User exits to menu

/**
 * State machine transition map
 */
type StateTransitions = {
  [K in GameState]: {
    [E in GameEvent]?: GameState;
  };
};

/**
 * Base game context (extend per game)
 */
export interface BaseGameContext {
  score: number;
  highScore: number;
  startTime: number | null;
  pausedTime: number;
  totalPausedDuration: number;
}

/**
 * High score entry
 */
export interface HighScoreEntry {
  score: number;
  date: number;
  gameType: ExtendedGameType;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// State Machine
// =============================================================================

/**
 * Game state transition map
 */
const STATE_TRANSITIONS: StateTransitions = {
  idle: {
    START: "ready",
  },
  ready: {
    COUNTDOWN_COMPLETE: "playing",
    EXIT: "idle",
  },
  playing: {
    PAUSE: "paused",
    GAME_OVER: "game_over",
    VICTORY: "victory",
  },
  paused: {
    RESUME: "playing",
    EXIT: "idle",
    RESTART: "ready",
  },
  game_over: {
    RESTART: "ready",
    EXIT: "idle",
  },
  victory: {
    RESTART: "ready",
    EXIT: "idle",
  },
};

/**
 * Create a game state machine
 */
export function createGameStateMachine(initialState: GameState = "idle") {
  let currentState = initialState;
  const listeners: Set<(state: GameState) => void> = new Set();

  return {
    /**
     * Get current state
     */
    getState: () => currentState,

    /**
     * Send event to state machine
     */
    send: (event: GameEvent): GameState => {
      const transitions = STATE_TRANSITIONS[currentState];
      const nextState = transitions[event];

      if (nextState) {
        currentState = nextState;
        listeners.forEach((listener) => listener(currentState));
      }

      return currentState;
    },

    /**
     * Check if event is valid for current state
     */
    canSend: (event: GameEvent): boolean => {
      return STATE_TRANSITIONS[currentState][event] !== undefined;
    },

    /**
     * Subscribe to state changes
     */
    subscribe: (listener: (state: GameState) => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Reset to initial state
     */
    reset: () => {
      currentState = initialState;
      listeners.forEach((listener) => listener(currentState));
    },
  };
}

// =============================================================================
// Score Tracking
// =============================================================================

/**
 * Create a score tracker with combo multiplier support
 */
export function createScoreTracker(options?: {
  comboMultiplier?: boolean;
  comboDecayMs?: number;
  maxCombo?: number;
}) {
  const {
    comboMultiplier = false,
    comboDecayMs = 2000,
    maxCombo = 10,
  } = options ?? {};

  let score = 0;
  let combo = 0;
  let lastScoreTime = 0;

  return {
    /**
     * Add points (with optional combo)
     */
    addPoints: (points: number): number => {
      const now = Date.now();

      if (comboMultiplier) {
        // Reset combo if too much time passed
        if (now - lastScoreTime > comboDecayMs) {
          combo = 0;
        }

        combo = Math.min(combo + 1, maxCombo);
        lastScoreTime = now;

        // Apply combo multiplier (1x, 1.5x, 2x, 2.5x, etc.)
        const multiplier = 1 + (combo - 1) * 0.5;
        score += Math.floor(points * multiplier);
      } else {
        score += points;
      }

      return score;
    },

    /**
     * Get current score
     */
    getScore: () => score,

    /**
     * Get current combo
     */
    getCombo: () => combo,

    /**
     * Reset score and combo
     */
    reset: () => {
      score = 0;
      combo = 0;
      lastScoreTime = 0;
    },

    /**
     * Break combo (e.g., on miss)
     */
    breakCombo: () => {
      combo = 0;
    },
  };
}

// =============================================================================
// High Score Persistence
// =============================================================================

const HIGH_SCORES_KEY = "@snapstyle/high_scores";
const MAX_HIGH_SCORES_PER_GAME = 10;

/**
 * Get high scores for a game
 */
export async function getHighScores(
  gameType: ExtendedGameType,
): Promise<HighScoreEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(HIGH_SCORES_KEY);
    if (!stored) return [];

    const allScores: Record<string, HighScoreEntry[]> = JSON.parse(stored);
    return allScores[gameType] ?? [];
  } catch {
    logger.error("Failed to get high scores");
    return [];
  }
}

/**
 * Get the highest score for a game
 */
export async function getHighScore(
  gameType: ExtendedGameType,
): Promise<number> {
  const scores = await getHighScores(gameType);
  return scores.length > 0 ? scores[0].score : 0;
}

/**
 * Save a new high score
 */
export async function saveHighScore(
  gameType: ExtendedGameType,
  score: number,
  metadata?: Record<string, unknown>,
): Promise<{ isHighScore: boolean; rank: number }> {
  try {
    const stored = await AsyncStorage.getItem(HIGH_SCORES_KEY);
    const allScores: Record<string, HighScoreEntry[]> = stored
      ? JSON.parse(stored)
      : {};

    const gameScores = allScores[gameType] ?? [];
    const entry: HighScoreEntry = {
      score,
      date: Date.now(),
      gameType,
      metadata,
    };

    // Determine rank
    let rank = gameScores.length + 1;
    for (let i = 0; i < gameScores.length; i++) {
      if (score > gameScores[i].score) {
        rank = i + 1;
        break;
      }
    }

    // Insert at correct position
    gameScores.splice(rank - 1, 0, entry);

    // Trim to max entries
    allScores[gameType] = gameScores.slice(0, MAX_HIGH_SCORES_PER_GAME);

    await AsyncStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(allScores));

    return {
      isHighScore: rank === 1,
      rank,
    };
  } catch {
    logger.error("Failed to save high score");
    return { isHighScore: false, rank: -1 };
  }
}

/**
 * Clear high scores for a game
 */
export async function clearHighScores(
  gameType: ExtendedGameType,
): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(HIGH_SCORES_KEY);
    if (!stored) return;

    const allScores: Record<string, HighScoreEntry[]> = JSON.parse(stored);
    delete allScores[gameType];

    await AsyncStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(allScores));
  } catch {
    logger.error("Failed to clear high scores");
  }
}

/**
 * Clear all high scores
 */
export async function clearAllHighScores(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HIGH_SCORES_KEY);
  } catch {
    logger.error("Failed to clear all high scores");
  }
}

// =============================================================================
// Time Tracking
// =============================================================================

/**
 * Create a game timer with pause support
 */
export function createGameTimer() {
  let startTime: number | null = null;
  let pauseTime: number | null = null;
  let totalPausedDuration = 0;

  return {
    /**
     * Start the timer
     */
    start: () => {
      startTime = Date.now();
      pauseTime = null;
      totalPausedDuration = 0;
    },

    /**
     * Pause the timer
     */
    pause: () => {
      if (startTime && !pauseTime) {
        pauseTime = Date.now();
      }
    },

    /**
     * Resume the timer
     */
    resume: () => {
      if (pauseTime) {
        totalPausedDuration += Date.now() - pauseTime;
        pauseTime = null;
      }
    },

    /**
     * Get elapsed time in milliseconds
     */
    getElapsed: (): number => {
      if (!startTime) return 0;

      const now = pauseTime ?? Date.now();
      return now - startTime - totalPausedDuration;
    },

    /**
     * Get elapsed time formatted as MM:SS
     */
    getFormatted: (): string => {
      const elapsed = Math.floor(
        (startTime ? Date.now() - startTime - totalPausedDuration : 0) / 1000,
      );
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    },

    /**
     * Check if timer is running
     */
    isRunning: (): boolean => {
      return startTime !== null && pauseTime === null;
    },

    /**
     * Reset the timer
     */
    reset: () => {
      startTime = null;
      pauseTime = null;
      totalPausedDuration = 0;
    },
  };
}

// =============================================================================
// Countdown Utility
// =============================================================================

/**
 * Create a countdown timer
 */
export function createCountdown(
  duration: number,
  onTick: (remaining: number) => void,
  onComplete: () => void,
): { start: () => void; cancel: () => void } {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let remaining = duration;

  const start = () => {
    remaining = duration;
    onTick(remaining);

    intervalId = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        if (intervalId) clearInterval(intervalId);
        onComplete();
      } else {
        onTick(remaining);
      }
    }, 1000);
  };

  const cancel = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  return { start, cancel };
}

// =============================================================================
// Lives/Health System
// =============================================================================

/**
 * Create a lives/health tracker
 */
export function createLivesTracker(initialLives: number) {
  let lives = initialLives;
  let maxLives = initialLives;
  const listeners: Set<(lives: number) => void> = new Set();

  const notify = () => {
    listeners.forEach((l) => l(lives));
  };

  return {
    /**
     * Get current lives
     */
    getLives: () => lives,

    /**
     * Get max lives
     */
    getMaxLives: () => maxLives,

    /**
     * Lose a life
     */
    loseLife: (): boolean => {
      lives = Math.max(0, lives - 1);
      notify();
      return lives > 0;
    },

    /**
     * Gain a life
     */
    gainLife: (): void => {
      lives = Math.min(maxLives, lives + 1);
      notify();
    },

    /**
     * Set lives directly
     */
    setLives: (newLives: number): void => {
      lives = Math.max(0, Math.min(maxLives, newLives));
      notify();
    },

    /**
     * Check if alive
     */
    isAlive: () => lives > 0,

    /**
     * Reset to initial lives
     */
    reset: () => {
      lives = initialLives;
      notify();
    },

    /**
     * Subscribe to lives changes
     */
    subscribe: (listener: (lives: number) => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// =============================================================================
// Difficulty Scaling
// =============================================================================

/**
 * Difficulty level definitions
 */
export type DifficultyLevel = "easy" | "normal" | "hard" | "expert";

/**
 * Difficulty multipliers
 */
export const DIFFICULTY_MULTIPLIERS: Record<
  DifficultyLevel,
  {
    speed: number;
    scoreMultiplier: number;
    spawnRate: number;
  }
> = {
  easy: { speed: 0.75, scoreMultiplier: 0.5, spawnRate: 0.75 },
  normal: { speed: 1.0, scoreMultiplier: 1.0, spawnRate: 1.0 },
  hard: { speed: 1.25, scoreMultiplier: 1.5, spawnRate: 1.25 },
  expert: { speed: 1.5, scoreMultiplier: 2.0, spawnRate: 1.5 },
};

/**
 * Calculate dynamic difficulty based on score/time
 */
export function calculateDynamicDifficulty(
  score: number,
  elapsedMs: number,
  options?: {
    scoreThresholds?: number[];
    timeThresholds?: number[];
    maxMultiplier?: number;
  },
): number {
  const {
    scoreThresholds = [100, 500, 1000, 2000, 5000],
    timeThresholds = [30000, 60000, 120000, 180000],
    maxMultiplier = 2.0,
  } = options ?? {};

  // Score-based difficulty
  let scoreDifficulty = 1.0;
  for (let i = 0; i < scoreThresholds.length; i++) {
    if (score >= scoreThresholds[i]) {
      scoreDifficulty += 0.1;
    }
  }

  // Time-based difficulty
  let timeDifficulty = 1.0;
  for (let i = 0; i < timeThresholds.length; i++) {
    if (elapsedMs >= timeThresholds[i]) {
      timeDifficulty += 0.1;
    }
  }

  // Combine and clamp
  const combined = (scoreDifficulty + timeDifficulty) / 2;
  return Math.min(combined, maxMultiplier);
}

// =============================================================================
// Achievement/Milestone Tracking
// =============================================================================

/**
 * Game milestone definition
 */
export interface GameMilestone {
  id: string;
  name: string;
  description: string;
  check: (context: MilestoneContext) => boolean;
  reward?: {
    coins: number;
    item?: string;
  };
}

/**
 * Context for milestone checking
 */
export interface MilestoneContext {
  score: number;
  highScore: number;
  gamesPlayed: number;
  totalPlayTime: number;
  metadata: Record<string, number>;
}

/**
 * Create a milestone tracker
 */
export function createMilestoneTracker(milestones: GameMilestone[]) {
  const achieved = new Set<string>();

  return {
    /**
     * Check for newly achieved milestones
     */
    check: (context: MilestoneContext): GameMilestone[] => {
      const newlyAchieved: GameMilestone[] = [];

      for (const milestone of milestones) {
        if (!achieved.has(milestone.id) && milestone.check(context)) {
          achieved.add(milestone.id);
          newlyAchieved.push(milestone);
        }
      }

      return newlyAchieved;
    },

    /**
     * Get achieved milestones
     */
    getAchieved: () => Array.from(achieved),

    /**
     * Check if milestone is achieved
     */
    isAchieved: (id: string) => achieved.has(id),

    /**
     * Reset tracker
     */
    reset: () => achieved.clear(),
  };
}
