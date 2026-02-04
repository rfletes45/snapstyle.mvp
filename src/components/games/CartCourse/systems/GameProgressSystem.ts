/**
 * Game Progress System
 *
 * Manages overall game progress for Cart Course including:
 * - Area completion detection
 * - Course completion flow
 * - Progress tracking (areas completed, checkpoints reached)
 * - Game state transitions (playing, paused, crashed, complete)
 * - Integration with checkpoint, lives, scoring, and timer systems
 */

import Matter from "matter-js";
import {
  Area,
  Checkpoint,
  Course,
  GameEngineUpdateProps,
  GameEntities,
  GameStatus,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Progress Configuration
// ============================================

export interface ProgressConfig {
  // Area completion
  areaCompleteTriggerDistance: number; // Distance to checkpoint to complete area
  areaCompleteDelay: number; // MS delay before showing area complete

  // Course completion
  courseCompleteCelebrationTime: number; // MS to show celebration
  autoAdvanceDelay: number; // MS before auto-advancing to results

  // Transitions
  areaTransitionTime: number; // MS for area transition animation
  respawnDelay: number; // MS delay before respawn after crash
}

export const DEFAULT_PROGRESS_CONFIG: ProgressConfig = {
  areaCompleteTriggerDistance: 30,
  areaCompleteDelay: 500,
  courseCompleteCelebrationTime: 3000,
  autoAdvanceDelay: 5000,
  areaTransitionTime: 1000,
  respawnDelay: 1500,
};

// ============================================
// Progress State
// ============================================

export interface ProgressState {
  // Game status
  status: GameStatus;
  previousStatus: GameStatus;
  statusChangedAt: number;

  // Course progress
  courseId: string;
  currentAreaIndex: number;
  totalAreas: number;
  areasCompleted: Set<number>;
  checkpointsReached: Set<number>;

  // Area state
  currentAreaStartTime: number;
  currentAreaDeathCount: number;
  isAreaComplete: boolean;
  pendingAreaComplete: number | null; // Area index waiting to complete

  // Course completion
  isCourseComplete: boolean;
  courseCompleteTime: number;

  // Run stats
  totalDeaths: number;
  totalRestarts: number;
  bestAreaTime: Map<number, number>;
  currentRunStartTime: number;
}

// ============================================
// State Creation
// ============================================

/**
 * Create initial progress state for a course
 */
export function createProgressState(
  course: Course,
  startTime: number = Date.now(),
): ProgressState {
  return {
    status: "idle",
    previousStatus: "idle",
    statusChangedAt: startTime,
    courseId: course.id,
    currentAreaIndex: 0,
    totalAreas: course.areas.length,
    areasCompleted: new Set(),
    checkpointsReached: new Set([0]), // Start checkpoint is reached
    currentAreaStartTime: startTime,
    currentAreaDeathCount: 0,
    isAreaComplete: false,
    pendingAreaComplete: null,
    isCourseComplete: false,
    courseCompleteTime: 0,
    totalDeaths: 0,
    totalRestarts: 0,
    bestAreaTime: new Map(),
    currentRunStartTime: startTime,
  };
}

// ============================================
// Status Transitions
// ============================================

/**
 * Transition to new game status
 */
export function setGameStatus(
  state: ProgressState,
  newStatus: GameStatus,
  currentTime: number,
): ProgressState {
  if (state.status === newStatus) {
    return state;
  }

  return {
    ...state,
    previousStatus: state.status,
    status: newStatus,
    statusChangedAt: currentTime,
  };
}

/**
 * Start the game (transition from idle to playing)
 */
export function startGame(
  state: ProgressState,
  currentTime: number,
): ProgressState {
  return setGameStatus(
    {
      ...state,
      currentRunStartTime: currentTime,
      currentAreaStartTime: currentTime,
    },
    "playing",
    currentTime,
  );
}

/**
 * Pause the game
 */
export function pauseGame(
  state: ProgressState,
  currentTime: number,
): ProgressState {
  if (state.status !== "playing") {
    return state;
  }
  return setGameStatus(state, "paused", currentTime);
}

/**
 * Resume from pause
 */
export function resumeGame(
  state: ProgressState,
  currentTime: number,
): ProgressState {
  if (state.status !== "paused") {
    return state;
  }
  return setGameStatus(state, "playing", currentTime);
}

/**
 * Handle crash
 */
export function handleCrash(
  state: ProgressState,
  currentTime: number,
): ProgressState {
  return setGameStatus(
    {
      ...state,
      totalDeaths: state.totalDeaths + 1,
      currentAreaDeathCount: state.currentAreaDeathCount + 1,
    },
    "crashed",
    currentTime,
  );
}

/**
 * Complete the course
 */
export function completeCourse(
  state: ProgressState,
  currentTime: number,
): ProgressState {
  return setGameStatus(
    {
      ...state,
      isCourseComplete: true,
      courseCompleteTime: currentTime,
    },
    "complete",
    currentTime,
  );
}

// ============================================
// Area Progression
// ============================================

/**
 * Mark current area as complete
 */
export function completeArea(
  state: ProgressState,
  areaIndex: number,
  currentTime: number,
): ProgressState {
  const newAreasCompleted = new Set(state.areasCompleted);
  newAreasCompleted.add(areaIndex);

  // Track best area time
  const areaTime = currentTime - state.currentAreaStartTime;
  const newBestAreaTime = new Map(state.bestAreaTime);
  const currentBest = newBestAreaTime.get(areaIndex);
  if (!currentBest || areaTime < currentBest) {
    newBestAreaTime.set(areaIndex, areaTime);
  }

  return {
    ...state,
    areasCompleted: newAreasCompleted,
    isAreaComplete: true,
    bestAreaTime: newBestAreaTime,
  };
}

/**
 * Advance to next area
 */
export function advanceToNextArea(
  state: ProgressState,
  currentTime: number,
): ProgressState {
  const nextAreaIndex = state.currentAreaIndex + 1;

  // Check if course is complete
  if (nextAreaIndex >= state.totalAreas) {
    return completeCourse(state, currentTime);
  }

  const newCheckpointsReached = new Set(state.checkpointsReached);
  newCheckpointsReached.add(nextAreaIndex);

  return {
    ...state,
    currentAreaIndex: nextAreaIndex,
    checkpointsReached: newCheckpointsReached,
    currentAreaStartTime: currentTime,
    currentAreaDeathCount: 0,
    isAreaComplete: false,
    pendingAreaComplete: null,
  };
}

/**
 * Reset to checkpoint after crash
 */
export function resetToCheckpoint(
  state: ProgressState,
  checkpointAreaIndex: number,
  currentTime: number,
): ProgressState {
  return setGameStatus(
    {
      ...state,
      currentAreaIndex: checkpointAreaIndex,
      currentAreaStartTime: currentTime,
      currentAreaDeathCount: 0,
      isAreaComplete: false,
    },
    "playing",
    currentTime,
  );
}

/**
 * Full course restart
 */
export function restartCourse(
  state: ProgressState,
  currentTime: number,
): ProgressState {
  return {
    ...createProgressState(
      { id: state.courseId, areas: Array(state.totalAreas) } as Course,
      currentTime,
    ),
    totalRestarts: state.totalRestarts + 1,
    bestAreaTime: state.bestAreaTime, // Keep best times
  };
}

// ============================================
// Checkpoint Detection
// ============================================

/**
 * Check if cart has reached a checkpoint
 */
export function checkCheckpointReached(
  cartPosition: Vector2D,
  checkpoint: Checkpoint,
  config: ProgressConfig = DEFAULT_PROGRESS_CONFIG,
): boolean {
  const dx = cartPosition.x - checkpoint.position.x;
  const dy = cartPosition.y - checkpoint.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= config.areaCompleteTriggerDistance;
}

/**
 * Get the last checkpoint index reached
 */
export function getLastCheckpointIndex(state: ProgressState): number {
  let highest = 0;
  state.checkpointsReached.forEach((index) => {
    if (index > highest) {
      highest = index;
    }
  });
  return highest;
}

/**
 * Check if checkpoint has been reached
 */
export function isCheckpointReached(
  state: ProgressState,
  checkpointIndex: number,
): boolean {
  return state.checkpointsReached.has(checkpointIndex);
}

// ============================================
// Area Completion Detection
// ============================================

/**
 * Check if current area is completed (cart reached end checkpoint)
 */
export function checkAreaCompletion(
  cartPosition: Vector2D,
  currentArea: Area,
  nextAreaCheckpoint: Checkpoint | null,
  config: ProgressConfig = DEFAULT_PROGRESS_CONFIG,
): boolean {
  if (!nextAreaCheckpoint) {
    // Last area - check if reached finish
    // For last area, check if cart is near the area's end bounds
    const endY = currentArea.bounds.minY; // Top of area (lower Y = higher on screen)
    return cartPosition.y <= endY + config.areaCompleteTriggerDistance;
  }

  return checkCheckpointReached(cartPosition, nextAreaCheckpoint, config);
}

/**
 * Check if course is completed
 */
export function isCourseCompleted(state: ProgressState): boolean {
  return state.areasCompleted.size >= state.totalAreas;
}

// ============================================
// Progress Queries
// ============================================

/**
 * Get progress percentage (0-1)
 */
export function getProgressPercentage(state: ProgressState): number {
  return state.areasCompleted.size / state.totalAreas;
}

/**
 * Get current area number for display (1-indexed)
 */
export function getCurrentAreaDisplay(state: ProgressState): string {
  return `${state.currentAreaIndex + 1}/${state.totalAreas}`;
}

/**
 * Check if current area was completed without death
 */
export function isCurrentAreaPerfect(state: ProgressState): boolean {
  return state.currentAreaDeathCount === 0;
}

/**
 * Get all perfect areas (no deaths)
 */
export function getPerfectAreas(state: ProgressState): number[] {
  // This would need death tracking per area
  // For now, check if current run had no deaths in completed areas
  return Array.from(state.areasCompleted).filter((areaIndex) => {
    // Simplified - would need per-area death tracking for accuracy
    return true;
  });
}

/**
 * Get area completion stats
 */
export function getAreaStats(state: ProgressState): {
  completed: number;
  total: number;
  current: number;
  percentage: number;
} {
  return {
    completed: state.areasCompleted.size,
    total: state.totalAreas,
    current: state.currentAreaIndex + 1,
    percentage: (state.areasCompleted.size / state.totalAreas) * 100,
  };
}

// ============================================
// Game Progress System (Game Engine)
// ============================================

/**
 * Game Progress System for react-native-game-engine
 * Handles area transitions, completion detection, and game state
 */
export function GameProgressSystem(
  entities: GameEntities & {
    progressState?: ProgressState;
    cart?: { composite: Matter.Composite };
    course?: Course;
  },
  { time, dispatch, events }: GameEngineUpdateProps,
): GameEntities {
  if (!entities.progressState || !entities.cart || !entities.course) {
    return entities;
  }

  let progressState = entities.progressState;
  const { course } = entities;

  // Only process during active gameplay
  if (progressState.status !== "playing") {
    return entities;
  }

  // Get cart position
  const cartBody = entities.cart.composite.bodies.find(
    (b) => b.label === "cart_body",
  );
  if (!cartBody) {
    return entities;
  }

  const cartPosition: Vector2D = {
    x: cartBody.position.x,
    y: cartBody.position.y,
  };

  // Check for area completion
  const currentArea = course.areas[progressState.currentAreaIndex];
  const nextArea = course.areas[progressState.currentAreaIndex + 1];
  const nextCheckpoint = nextArea?.checkpoint || null;

  if (!progressState.isAreaComplete) {
    const isComplete = checkAreaCompletion(
      cartPosition,
      currentArea,
      nextCheckpoint,
    );

    if (isComplete) {
      // Complete the current area
      progressState = completeArea(
        progressState,
        progressState.currentAreaIndex,
        time.current,
      );

      // Dispatch area complete event
      dispatch({
        type: "area_complete",
        areaIndex: progressState.currentAreaIndex,
        perfect: progressState.currentAreaDeathCount === 0,
      });

      // Check if this was the last area
      if (progressState.currentAreaIndex >= progressState.totalAreas - 1) {
        progressState = completeCourse(progressState, time.current);
        dispatch({ type: "course_complete" });
      } else {
        // Set pending area advance
        progressState = {
          ...progressState,
          pendingAreaComplete: progressState.currentAreaIndex,
        };
      }
    }
  }

  // Handle pending area advance (after delay)
  if (
    progressState.pendingAreaComplete !== null &&
    time.current - progressState.statusChangedAt >
      DEFAULT_PROGRESS_CONFIG.areaCompleteDelay
  ) {
    progressState = advanceToNextArea(progressState, time.current);
    dispatch({
      type: "area_start",
      areaIndex: progressState.currentAreaIndex,
    });
  }

  // Process events
  events?.forEach((event) => {
    if (event.type === "pause") {
      progressState = pauseGame(progressState, time.current);
    } else if (event.type === "resume") {
      progressState = resumeGame(progressState, time.current);
    } else if (event.type === "crash") {
      progressState = handleCrash(progressState, time.current);
    } else if (event.type === "respawn") {
      const checkpointIndex = getLastCheckpointIndex(progressState);
      progressState = resetToCheckpoint(
        progressState,
        checkpointIndex,
        time.current,
      );
    } else if (event.type === "restart") {
      progressState = restartCourse(progressState, time.current);
    }
  });

  entities.progressState = progressState;
  return entities;
}

// ============================================
// Completion Results
// ============================================

export interface CourseCompletionResult {
  courseId: string;
  completed: boolean;
  totalTime: number;
  areasCompleted: number;
  totalAreas: number;
  totalDeaths: number;
  perfectAreas: number;
  bestAreaTimes: Map<number, number>;
}

/**
 * Generate course completion result
 */
export function generateCompletionResult(
  state: ProgressState,
  elapsedTimeMs: number,
): CourseCompletionResult {
  return {
    courseId: state.courseId,
    completed: state.isCourseComplete,
    totalTime: elapsedTimeMs,
    areasCompleted: state.areasCompleted.size,
    totalAreas: state.totalAreas,
    totalDeaths: state.totalDeaths,
    perfectAreas: state.totalDeaths === 0 ? state.totalAreas : 0, // Simplified
    bestAreaTimes: new Map(state.bestAreaTime),
  };
}

// ============================================
// Display Helpers
// ============================================

/**
 * Get status display text
 */
export function getStatusDisplayText(status: GameStatus): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "playing":
      return "Playing";
    case "paused":
      return "Paused";
    case "crashed":
      return "Crashed!";
    case "complete":
      return "Complete!";
    default:
      return "";
  }
}

/**
 * Get progress bar data for HUD
 */
export function getProgressBarData(state: ProgressState): {
  segments: { index: number; completed: boolean; current: boolean }[];
  percentage: number;
} {
  const segments = [];
  for (let i = 0; i < state.totalAreas; i++) {
    segments.push({
      index: i,
      completed: state.areasCompleted.has(i),
      current: i === state.currentAreaIndex,
    });
  }

  return {
    segments,
    percentage: getProgressPercentage(state) * 100,
  };
}
