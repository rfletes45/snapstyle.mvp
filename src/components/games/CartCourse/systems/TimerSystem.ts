/**
 * Timer System
 *
 * Manages game timing for Cart Course including:
 * - Elapsed time tracking
 * - 10-minute time limit (from game plan)
 * - Par time comparison
 * - Time formatting for display
 * - Pause handling
 */

import { GameEngineUpdateProps, GameEntities } from "../types/cartCourse.types";

// ============================================
// Timer Configuration
// ============================================

export interface TimerConfig {
  // Time limit - from game plan "10-Minute Timer"
  maxTimeMs: number;
  // Warning thresholds
  warningThresholdMs: number; // Show warning at this remaining time
  criticalThresholdMs: number; // Show critical warning
  // Display
  showMilliseconds: boolean;
  flashOnWarning: boolean;
}

export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  maxTimeMs: 10 * 60 * 1000, // 10 minutes in milliseconds
  warningThresholdMs: 60 * 1000, // 1 minute warning
  criticalThresholdMs: 30 * 1000, // 30 second critical warning
  showMilliseconds: false,
  flashOnWarning: true,
};

// ============================================
// Timer State
// ============================================

export interface TimerState {
  // Time tracking
  elapsedMs: number;
  startTime: number;
  pausedTime: number;
  isPaused: boolean;
  isRunning: boolean;

  // Time limit
  maxTimeMs: number;
  remainingMs: number;
  isTimeUp: boolean;

  // Par time comparison
  parTimeMs: number;
  isBelowParTime: boolean;

  // Warning states
  isWarning: boolean;
  isCritical: boolean;
}

// ============================================
// State Creation
// ============================================

/**
 * Create initial timer state
 */
export function createTimerState(
  parTimeSeconds: number = 420,
  config: TimerConfig = DEFAULT_TIMER_CONFIG,
): TimerState {
  return {
    elapsedMs: 0,
    startTime: 0,
    pausedTime: 0,
    isPaused: false,
    isRunning: false,
    maxTimeMs: config.maxTimeMs,
    remainingMs: config.maxTimeMs,
    isTimeUp: false,
    parTimeMs: parTimeSeconds * 1000,
    isBelowParTime: true,
    isWarning: false,
    isCritical: false,
  };
}

// ============================================
// Timer Controls
// ============================================

/**
 * Start the timer
 */
export function startTimer(state: TimerState, currentTime: number): TimerState {
  if (state.isRunning) {
    return state;
  }

  return {
    ...state,
    startTime: currentTime - state.elapsedMs,
    isRunning: true,
    isPaused: false,
  };
}

/**
 * Pause the timer
 */
export function pauseTimer(state: TimerState, currentTime: number): TimerState {
  if (!state.isRunning || state.isPaused) {
    return state;
  }

  return {
    ...state,
    pausedTime: currentTime,
    isPaused: true,
  };
}

/**
 * Resume the timer from pause
 */
export function resumeTimer(
  state: TimerState,
  currentTime: number,
): TimerState {
  if (!state.isPaused) {
    return state;
  }

  const pauseDuration = currentTime - state.pausedTime;

  return {
    ...state,
    startTime: state.startTime + pauseDuration,
    isPaused: false,
    pausedTime: 0,
  };
}

/**
 * Stop the timer
 */
export function stopTimer(state: TimerState): TimerState {
  return {
    ...state,
    isRunning: false,
  };
}

/**
 * Reset the timer
 */
export function resetTimer(
  state: TimerState,
  parTimeSeconds?: number,
): TimerState {
  return createTimerState(parTimeSeconds ?? state.parTimeMs / 1000, {
    ...DEFAULT_TIMER_CONFIG,
    maxTimeMs: state.maxTimeMs,
  });
}

// ============================================
// Timer Update
// ============================================

/**
 * Update timer state with current time
 */
export function updateTimer(
  state: TimerState,
  currentTime: number,
  config: TimerConfig = DEFAULT_TIMER_CONFIG,
): TimerState {
  if (!state.isRunning || state.isPaused || state.isTimeUp) {
    return state;
  }

  const elapsedMs = currentTime - state.startTime;
  const remainingMs = Math.max(0, state.maxTimeMs - elapsedMs);
  const isTimeUp = remainingMs <= 0;

  // Check par time
  const isBelowParTime = elapsedMs < state.parTimeMs;

  // Check warning thresholds
  const isWarning = remainingMs <= config.warningThresholdMs && remainingMs > 0;
  const isCritical =
    remainingMs <= config.criticalThresholdMs && remainingMs > 0;

  return {
    ...state,
    elapsedMs,
    remainingMs,
    isTimeUp,
    isBelowParTime,
    isWarning,
    isCritical,
  };
}

// ============================================
// Time Queries
// ============================================

/**
 * Get elapsed time in seconds
 */
export function getElapsedSeconds(state: TimerState): number {
  return state.elapsedMs / 1000;
}

/**
 * Get elapsed time in minutes
 */
export function getElapsedMinutes(state: TimerState): number {
  return state.elapsedMs / (60 * 1000);
}

/**
 * Get remaining time in seconds
 */
export function getRemainingSeconds(state: TimerState): number {
  return state.remainingMs / 1000;
}

/**
 * Get time until par (negative if over par)
 */
export function getTimeUntilPar(state: TimerState): number {
  return (state.parTimeMs - state.elapsedMs) / 1000;
}

/**
 * Get progress toward time limit (0-1)
 */
export function getTimeProgress(state: TimerState): number {
  return Math.min(1, state.elapsedMs / state.maxTimeMs);
}

/**
 * Check if still below par time
 */
export function isBelowParTime(state: TimerState): boolean {
  return state.elapsedMs < state.parTimeMs;
}

/**
 * Get percentage of par time used
 */
export function getParTimePercentage(state: TimerState): number {
  return (state.elapsedMs / state.parTimeMs) * 100;
}

// ============================================
// Time Formatting
// ============================================

/**
 * Format milliseconds as MM:SS
 */
export function formatTimeMMSS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format milliseconds as MM:SS.ms
 */
export function formatTimeWithMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
}

/**
 * Format elapsed time for display
 */
export function formatElapsedTime(
  state: TimerState,
  showMs: boolean = false,
): string {
  return showMs
    ? formatTimeWithMs(state.elapsedMs)
    : formatTimeMMSS(state.elapsedMs);
}

/**
 * Format remaining time for display
 */
export function formatRemainingTime(state: TimerState): string {
  return formatTimeMMSS(state.remainingMs);
}

/**
 * Format time for completion screen
 */
export function formatCompletionTime(ms: number): string {
  return formatTimeWithMs(ms);
}

/**
 * Get time comparison text (vs par)
 */
export function getParTimeComparison(state: TimerState): string {
  const diff = state.parTimeMs - state.elapsedMs;
  const absDiff = Math.abs(diff);
  const formatted = formatTimeMMSS(absDiff);

  if (diff > 0) {
    return `-${formatted}`; // Under par
  } else if (diff < 0) {
    return `+${formatted}`; // Over par
  }
  return "PAR";
}

// ============================================
// Timer System (Game Engine)
// ============================================

/**
 * Timer System for react-native-game-engine
 * Updates elapsed time and checks for time-up condition
 */
export function TimerSystem(
  entities: GameEntities & {
    timerState?: TimerState;
  },
  { time, dispatch }: GameEngineUpdateProps,
): GameEntities {
  if (!entities.timerState) {
    return entities;
  }

  const previousState = entities.timerState;
  const updatedState = updateTimer(previousState, time.current);

  // Check for time-up
  if (updatedState.isTimeUp && !previousState.isTimeUp) {
    dispatch({ type: "time-up" });
  }

  // Check for warning threshold crossed
  if (updatedState.isWarning && !previousState.isWarning) {
    dispatch({ type: "timer_warning" });
  }

  // Check for critical threshold crossed
  if (updatedState.isCritical && !previousState.isCritical) {
    dispatch({ type: "timer_critical" });
  }

  entities.timerState = updatedState;
  return entities;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create timer display info for HUD
 */
export function getTimerDisplayInfo(state: TimerState): {
  time: string;
  isWarning: boolean;
  isCritical: boolean;
  remainingPercent: number;
} {
  return {
    time: formatElapsedTime(state),
    isWarning: state.isWarning,
    isCritical: state.isCritical,
    remainingPercent: (state.remainingMs / state.maxTimeMs) * 100,
  };
}

/**
 * Check if timer should flash (visual warning)
 */
export function shouldFlashTimer(
  state: TimerState,
  currentTime: number,
): boolean {
  if (!state.isWarning && !state.isCritical) {
    return false;
  }

  // Flash every 500ms for warning, 250ms for critical
  const flashInterval = state.isCritical ? 250 : 500;
  return Math.floor(currentTime / flashInterval) % 2 === 0;
}

/**
 * Get completion time stats
 */
export function getCompletionTimeStats(
  state: TimerState,
  parTimeSeconds: number,
): {
  elapsedSeconds: number;
  parTimeSeconds: number;
  differenceSeconds: number;
  isBelowPar: boolean;
  percentOfPar: number;
} {
  const elapsedSeconds = getElapsedSeconds(state);
  const differenceSeconds = elapsedSeconds - parTimeSeconds;

  return {
    elapsedSeconds,
    parTimeSeconds,
    differenceSeconds,
    isBelowPar: differenceSeconds < 0,
    percentOfPar: (elapsedSeconds / parTimeSeconds) * 100,
  };
}
