/**
 * Scoring System
 *
 * Manages score calculation for Cart Course including:
 * - Collectible points (bananas = 100, coins = 500)
 * - Time bonus calculation
 * - Perfect area/course bonuses
 * - Speed bonus multiplier
 * - Extra life tracking (every 2000 points)
 * - Final score calculation with breakdown
 */

import { GameEngineUpdateProps, GameEntities } from "../types/cartCourse.types";

// ============================================
// Scoring Configuration
// ============================================

export interface ScoreConfig {
  // Collectible points
  bananaPoints: number;
  coinPoints: number;

  // Time bonus
  timeBonus: {
    enabled: boolean;
    basePoints: number;
    penaltyPerSecond: number;
    minimumBonus: number;
  };

  // Bonus multipliers
  perfectAreaBonus: number; // No lives lost in area
  perfectCourseBonus: number; // No lives lost in course
  speedBonus: {
    threshold: number; // Complete in X% of par time
    multiplier: number;
  };

  // Extra lives
  pointsPerExtraLife: number;
}

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  // Collectible points from game plan
  bananaPoints: 100,
  coinPoints: 500,

  // Time bonus
  timeBonus: {
    enabled: true,
    basePoints: 10000,
    penaltyPerSecond: 10,
    minimumBonus: 1000,
  },

  // Bonus multipliers
  perfectAreaBonus: 500,
  perfectCourseBonus: 5000,
  speedBonus: {
    threshold: 0.7, // Complete in 70% of par time
    multiplier: 1.5,
  },

  // Extra lives - from game plan "Extra life every 2000 points"
  pointsPerExtraLife: 2000,
};

// ============================================
// Score State
// ============================================

export interface ScoreState {
  // Current score
  currentScore: number;

  // Score breakdown
  collectibleScore: number;
  timeBonus: number;
  perfectAreaBonuses: number;
  perfectCourseBonus: number;
  speedMultiplier: number;

  // Tracking
  bananasCollected: number;
  coinsCollected: number;
  livesLostInCourse: number;
  perfectAreaCount: number;
  areasWithoutDeath: Set<number>;

  // Extra lives
  extraLivesEarned: number;
  lastExtraLifeThreshold: number;
  pendingExtraLives: number;

  // High score
  isNewHighScore: boolean;
  previousHighScore: number;
}

// ============================================
// State Creation
// ============================================

/**
 * Create initial score state
 */
export function createScoreState(previousHighScore: number = 0): ScoreState {
  return {
    currentScore: 0,
    collectibleScore: 0,
    timeBonus: 0,
    perfectAreaBonuses: 0,
    perfectCourseBonus: 0,
    speedMultiplier: 1,
    bananasCollected: 0,
    coinsCollected: 0,
    livesLostInCourse: 0,
    perfectAreaCount: 0,
    areasWithoutDeath: new Set(),
    extraLivesEarned: 0,
    lastExtraLifeThreshold: 0,
    pendingExtraLives: 0,
    isNewHighScore: false,
    previousHighScore,
  };
}

// ============================================
// Score Calculation Functions
// ============================================

/**
 * Add points for collecting an item
 */
export function addCollectiblePoints(
  state: ScoreState,
  itemType: "banana" | "coin",
  config: ScoreConfig = DEFAULT_SCORE_CONFIG,
): ScoreState {
  const points =
    itemType === "banana" ? config.bananaPoints : config.coinPoints;

  const newState = { ...state };
  newState.collectibleScore += points;
  newState.currentScore += points;

  if (itemType === "banana") {
    newState.bananasCollected++;
  } else {
    newState.coinsCollected++;
  }

  // Check for extra life
  const extraLifeResult = checkExtraLife(newState, config);
  return extraLifeResult;
}

/**
 * Check if player earned an extra life from points
 */
export function checkExtraLife(
  state: ScoreState,
  config: ScoreConfig = DEFAULT_SCORE_CONFIG,
): ScoreState {
  const threshold = config.pointsPerExtraLife;
  const currentThreshold =
    Math.floor(state.currentScore / threshold) * threshold;

  if (currentThreshold > state.lastExtraLifeThreshold) {
    const newLives = Math.floor(
      (currentThreshold - state.lastExtraLifeThreshold) / threshold,
    );

    return {
      ...state,
      extraLivesEarned: state.extraLivesEarned + newLives,
      lastExtraLifeThreshold: currentThreshold,
      pendingExtraLives: state.pendingExtraLives + newLives,
    };
  }

  return state;
}

/**
 * Consume pending extra life (after applying it to lives)
 */
export function consumePendingExtraLife(state: ScoreState): ScoreState {
  if (state.pendingExtraLives > 0) {
    return {
      ...state,
      pendingExtraLives: state.pendingExtraLives - 1,
    };
  }
  return state;
}

/**
 * Has pending extra lives to award
 */
export function hasPendingExtraLives(state: ScoreState): boolean {
  return state.pendingExtraLives > 0;
}

/**
 * Record that player lost a life
 */
export function recordLifeLost(
  state: ScoreState,
  areaIndex: number,
): ScoreState {
  const newAreasWithoutDeath = new Set(state.areasWithoutDeath);
  newAreasWithoutDeath.delete(areaIndex);

  return {
    ...state,
    livesLostInCourse: state.livesLostInCourse + 1,
    areasWithoutDeath: newAreasWithoutDeath,
  };
}

/**
 * Mark area as completed without death
 */
export function markAreaPerfect(
  state: ScoreState,
  areaIndex: number,
  config: ScoreConfig = DEFAULT_SCORE_CONFIG,
): ScoreState {
  if (state.areasWithoutDeath.has(areaIndex)) {
    return state; // Already marked
  }

  const newAreasWithoutDeath = new Set(state.areasWithoutDeath);
  newAreasWithoutDeath.add(areaIndex);

  return {
    ...state,
    areasWithoutDeath: newAreasWithoutDeath,
    perfectAreaCount: state.perfectAreaCount + 1,
    perfectAreaBonuses: state.perfectAreaBonuses + config.perfectAreaBonus,
    currentScore: state.currentScore + config.perfectAreaBonus,
  };
}

/**
 * Calculate time bonus based on completion time
 */
export function calculateTimeBonus(
  elapsedTimeSeconds: number,
  config: ScoreConfig = DEFAULT_SCORE_CONFIG,
): number {
  if (!config.timeBonus.enabled) {
    return 0;
  }

  const penalty = elapsedTimeSeconds * config.timeBonus.penaltyPerSecond;
  const bonus = config.timeBonus.basePoints - penalty;

  return Math.max(config.timeBonus.minimumBonus, Math.floor(bonus));
}

/**
 * Calculate speed bonus multiplier
 */
export function calculateSpeedMultiplier(
  elapsedTimeSeconds: number,
  parTimeSeconds: number,
  config: ScoreConfig = DEFAULT_SCORE_CONFIG,
): number {
  if (elapsedTimeSeconds < parTimeSeconds * config.speedBonus.threshold) {
    return config.speedBonus.multiplier;
  }
  return 1;
}

/**
 * Calculate final score on course completion
 */
export function calculateFinalScore(
  state: ScoreState,
  elapsedTimeSeconds: number,
  parTimeSeconds: number,
  config: ScoreConfig = DEFAULT_SCORE_CONFIG,
): FinalScoreResult {
  // Start with collectible score
  let finalScore = state.collectibleScore;

  // Calculate time bonus
  const timeBonus = calculateTimeBonus(elapsedTimeSeconds, config);
  finalScore += timeBonus;

  // Add perfect area bonuses (already accumulated in state)
  finalScore += state.perfectAreaBonuses;

  // Check for perfect course bonus
  let perfectCourseBonus = 0;
  if (state.livesLostInCourse === 0) {
    perfectCourseBonus = config.perfectCourseBonus;
    finalScore += perfectCourseBonus;
  }

  // Apply speed multiplier
  const speedMultiplier = calculateSpeedMultiplier(
    elapsedTimeSeconds,
    parTimeSeconds,
    config,
  );
  finalScore = Math.floor(finalScore * speedMultiplier);

  // Check for new high score
  const isNewHighScore = finalScore > state.previousHighScore;

  return {
    finalScore,
    breakdown: {
      collectibles: state.collectibleScore,
      bananas: {
        count: state.bananasCollected,
        points: state.bananasCollected * config.bananaPoints,
      },
      coins: {
        count: state.coinsCollected,
        points: state.coinsCollected * config.coinPoints,
      },
      timeBonus,
      perfectAreaBonuses: state.perfectAreaBonuses,
      perfectAreasCount: state.perfectAreaCount,
      perfectCourseBonus,
      speedMultiplier,
      livesLost: state.livesLostInCourse,
      extraLivesEarned: state.extraLivesEarned,
    },
    isNewHighScore,
    previousHighScore: state.previousHighScore,
  };
}

// ============================================
// Score Result Types
// ============================================

export interface FinalScoreResult {
  finalScore: number;
  breakdown: ScoreBreakdown;
  isNewHighScore: boolean;
  previousHighScore: number;
}

export interface ScoreBreakdown {
  collectibles: number;
  bananas: { count: number; points: number };
  coins: { count: number; points: number };
  timeBonus: number;
  perfectAreaBonuses: number;
  perfectAreasCount: number;
  perfectCourseBonus: number;
  speedMultiplier: number;
  livesLost: number;
  extraLivesEarned: number;
}

// ============================================
// Star Rating
// ============================================

export type StarRating = 1 | 2 | 3;

/**
 * Calculate star rating based on performance
 */
export function calculateStarRating(
  finalScore: number,
  collectiblesPercent: number,
  timeBonusPercent: number,
  livesLost: number,
): StarRating {
  // 3 stars: High score, most collectibles, good time, no deaths
  if (
    collectiblesPercent >= 0.9 &&
    timeBonusPercent >= 0.5 &&
    livesLost === 0
  ) {
    return 3;
  }

  // 2 stars: Decent performance
  if (
    collectiblesPercent >= 0.6 ||
    (timeBonusPercent >= 0.3 && livesLost <= 2)
  ) {
    return 2;
  }

  // 1 star: Completed the course
  return 1;
}

/**
 * Calculate star rating from score result
 */
export function calculateStarsFromResult(
  result: FinalScoreResult,
  totalBananas: number,
  totalCoins: number,
  maxTimeBonus: number,
): StarRating {
  const totalCollectibles = totalBananas + totalCoins;
  const collectedCount =
    result.breakdown.bananas.count + result.breakdown.coins.count;
  const collectiblesPercent =
    totalCollectibles > 0 ? collectedCount / totalCollectibles : 1;

  const timeBonusPercent =
    maxTimeBonus > 0 ? result.breakdown.timeBonus / maxTimeBonus : 1;

  return calculateStarRating(
    result.finalScore,
    collectiblesPercent,
    timeBonusPercent,
    result.breakdown.livesLost,
  );
}

// ============================================
// Reset Functions
// ============================================

/**
 * Reset score state for course restart
 */
export function resetScoreState(
  state: ScoreState,
  keepHighScore: boolean = true,
): ScoreState {
  return createScoreState(keepHighScore ? state.previousHighScore : 0);
}

/**
 * Update high score if current score is higher
 */
export function updateHighScore(
  state: ScoreState,
  newHighScore: number,
): ScoreState {
  return {
    ...state,
    previousHighScore: Math.max(state.previousHighScore, newHighScore),
  };
}

// ============================================
// Scoring System (Game Engine)
// ============================================

/**
 * Scoring System for react-native-game-engine
 * Processes score-related events and tracks extra lives
 */
export function ScoringSystem(
  entities: GameEntities & {
    scoreState?: ScoreState;
  },
  { events, dispatch }: GameEngineUpdateProps,
): GameEntities {
  if (!entities.scoreState) {
    return entities;
  }

  let scoreState = entities.scoreState;

  // Process events
  events?.forEach((event) => {
    if (event.type === "collect") {
      const collectEvent = event as {
        type: "collect";
        itemType: "banana" | "coin";
      };
      scoreState = addCollectiblePoints(scoreState, collectEvent.itemType);

      // Check for extra life
      if (hasPendingExtraLives(scoreState)) {
        dispatch({ type: "extra_life" });
        scoreState = consumePendingExtraLife(scoreState);
      }
    } else if (event.type === "crash") {
      // Record life lost - areaIndex should be provided in crash event
      const crashEvent = event as { type: "crash"; areaIndex?: number };
      scoreState = recordLifeLost(scoreState, crashEvent.areaIndex ?? 0);
    } else if (event.type === "area_complete") {
      // Check if area was completed without death
      const areaEvent = event as {
        type: "area_complete";
        areaIndex: number;
        perfect: boolean;
      };
      if (areaEvent.perfect) {
        scoreState = markAreaPerfect(scoreState, areaEvent.areaIndex);
      }
    }
  });

  entities.scoreState = scoreState;
  return entities;
}

// ============================================
// Display Formatting
// ============================================

/**
 * Format score for display with thousands separator
 */
export function formatScore(score: number): string {
  return score.toLocaleString();
}

/**
 * Format time bonus for display
 */
export function formatTimeBonus(bonus: number): string {
  const sign = bonus >= 0 ? "+" : "";
  return `${sign}${formatScore(bonus)}`;
}

/**
 * Get score display text for HUD
 */
export function getScoreDisplayText(state: ScoreState): string {
  return formatScore(state.currentScore);
}

/**
 * Get multiplier display text
 */
export function getMultiplierText(multiplier: number): string {
  if (multiplier > 1) {
    return `×${multiplier.toFixed(1)}`;
  }
  return "";
}
