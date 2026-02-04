/**
 * Phase 6 Tests: Collectibles & Scoring
 *
 * Tests for:
 * - Banana/coin collectibles with sensor bodies
 * - Coin spawning after all bananas collected
 * - Score calculation with bonuses
 * - Time tracking with 10-minute limit
 * - Extra life every 2000 points
 * - Area and course completion
 */

import {
  DEFAULT_COLLECTIBLE_CONFIG,
  collectItem,
  createCollectibleBody,
  createCollectibleState,
} from "../../../src/components/games/CartCourse/systems/CollectibleSystem";
import {
  DEFAULT_PROGRESS_CONFIG,
  advanceToNextArea,
  checkCheckpointReached,
  completeArea,
  completeCourse,
  createProgressState,
  generateCompletionResult,
  getAreaStats,
  getCurrentAreaDisplay,
  getLastCheckpointIndex,
  getProgressBarData,
  getProgressPercentage,
  getStatusDisplayText,
  handleCrash,
  isCheckpointReached,
  isCurrentAreaPerfect,
  pauseGame,
  resetToCheckpoint,
  restartCourse,
  resumeGame,
  startGame,
} from "../../../src/components/games/CartCourse/systems/GameProgressSystem";
import {
  DEFAULT_SCORE_CONFIG,
  addCollectiblePoints,
  calculateFinalScore,
  calculateSpeedMultiplier,
  calculateStarRating,
  calculateTimeBonus,
  createScoreState,
  hasPendingExtraLives,
  markAreaPerfect,
  recordLifeLost,
} from "../../../src/components/games/CartCourse/systems/ScoringSystem";
import {
  DEFAULT_TIMER_CONFIG,
  createTimerState,
  pauseTimer,
  resetTimer,
  resumeTimer,
  startTimer,
  updateTimer,
} from "../../../src/components/games/CartCourse/systems/TimerSystem";
import {
  Area,
  Checkpoint,
  Collectible,
  Course,
  Vector2D,
} from "../../../src/components/games/CartCourse/types/cartCourse.types";

// ============================================
// Test Fixtures
// ============================================

function createMockCollectible(
  id: string,
  type: "banana" | "coin",
  position: Vector2D,
  areaIndex: number = 0,
): Collectible {
  return {
    id,
    type,
    position,
    areaIndex,
  };
}

function createMockArea(index: number = 0): Area {
  return {
    id: `area_${index}`,
    areaNumber: index + 1,
    name: `Area ${index + 1}`,
    bounds: {
      id: `bounds_${index}`,
      minX: 0,
      maxX: 800,
      minY: index * 1000,
      maxY: (index + 1) * 1000,
    },
    checkpoint: {
      id: `checkpoint_${index}`,
      position: { x: 400, y: index * 1000 + 50 },
      rotation: 0,
      areaIndex: index,
    },
    collectibles: [],
    mechanisms: [],
    obstacles: [],
    scrollDirection: "vertical" as const,
  };
}

function createMockCourse(areaCount: number = 3): Course {
  return {
    id: "test_course",
    name: "Test Course",
    areas: Array.from({ length: areaCount }, (_, i) => createMockArea(i)),
    parTime: 120, // 2 minutes in seconds
    difficulty: 2,
    theme: "classic" as const,
    width: 800,
    height: areaCount * 1000,
    backgroundLayers: [],
    cameraConfig: {
      followMode: "ahead" as const,
      followSmoothing: 0.08,
      lookAheadDistance: 100,
      defaultZoom: 1.0,
      zoomRange: { min: 0.8, max: 1.2 },
      autoZoom: true,
      deadZone: { x: 0, y: 0, width: 100, height: 150 },
    },
    startPosition: { x: 400, y: 50 },
    startRotation: 0,
    maxTime: 600,
    totalBananas: 30,
    totalCoins: 5,
  };
}

// ============================================
// COLLECTIBLE SYSTEM TESTS
// ============================================

describe("CollectibleSystem", () => {
  describe("Configuration", () => {
    it("should have correct default point values", () => {
      expect(DEFAULT_COLLECTIBLE_CONFIG.bananaPoints).toBe(100);
      expect(DEFAULT_COLLECTIBLE_CONFIG.coinPoints).toBe(500);
    });

    it("should have sensor radius configured", () => {
      expect(DEFAULT_COLLECTIBLE_CONFIG.sensorRadius).toBeGreaterThan(0);
    });

    it("should have animation settings", () => {
      expect(DEFAULT_COLLECTIBLE_CONFIG.bobAmplitude).toBeGreaterThan(0);
      expect(DEFAULT_COLLECTIBLE_CONFIG.bobFrequency).toBeGreaterThan(0);
    });
  });

  describe("createCollectibleState", () => {
    it("should create empty state with no collectibles", () => {
      const state = createCollectibleState([]);
      expect(state.collectedIds.size).toBe(0);
      expect(state.totalBananas).toBe(0);
      expect(state.totalCoins).toBe(0);
      expect(state.bananasCollected).toBe(0);
      expect(state.coinsCollected).toBe(0);
    });

    it("should count bananas and coins correctly", () => {
      const collectibles = [
        createMockCollectible("b1", "banana", { x: 100, y: 100 }),
        createMockCollectible("b2", "banana", { x: 200, y: 100 }),
        createMockCollectible("c1", "coin", { x: 300, y: 100 }),
      ];
      const state = createCollectibleState(collectibles);
      expect(state.totalBananas).toBe(2);
      expect(state.totalCoins).toBe(1);
    });

    it("should initialize collectible score to 0", () => {
      const state = createCollectibleState([]);
      expect(state.collectibleScore).toBe(0);
    });
  });

  describe("createCollectibleBody", () => {
    it("should create sensor body for collectible", () => {
      const collectible = createMockCollectible("b1", "banana", {
        x: 100,
        y: 200,
      });
      const body = createCollectibleBody(collectible);

      expect(body).toBeDefined();
      expect(body.isSensor).toBe(true);
      expect(body.position.x).toBe(100);
      expect(body.position.y).toBe(200);
      expect(body.label).toBe("collectible_b1");
    });

    it("should create static body", () => {
      const collectible = createMockCollectible("b1", "banana", {
        x: 100,
        y: 100,
      });
      const body = createCollectibleBody(collectible);
      expect(body.isStatic).toBe(true);
    });
  });

  describe("collectItem", () => {
    it("should add item to collected set", () => {
      const collectible = createMockCollectible("b1", "banana", {
        x: 100,
        y: 100,
      });
      const state = createCollectibleState([collectible]);

      const result = collectItem(state, "b1", collectible, Date.now());
      expect(result.state.collectedIds.has("b1")).toBe(true);
      expect(result.state.bananasCollected).toBe(1);
      expect(result.pointsEarned).toBe(100);
    });

    it("should not double-collect items", () => {
      const collectible = createMockCollectible("b1", "banana", {
        x: 100,
        y: 100,
      });
      const state = createCollectibleState([collectible]);

      const result1 = collectItem(state, "b1", collectible, Date.now());
      const result2 = collectItem(result1.state, "b1", collectible, Date.now());

      expect(result1.state.bananasCollected).toBe(1);
      expect(result2.state.bananasCollected).toBe(1);
      expect(result2.pointsEarned).toBe(0);
    });

    it("should track banana and coin collection separately", () => {
      const banana = createMockCollectible("b1", "banana", { x: 100, y: 100 });
      const coin = createMockCollectible("c1", "coin", { x: 200, y: 100 });
      const collectibles = [banana, coin];
      let state = createCollectibleState(collectibles);

      const result1 = collectItem(state, "b1", banana, Date.now());
      expect(result1.state.bananasCollected).toBe(1);
      expect(result1.state.coinsCollected).toBe(0);
      expect(result1.pointsEarned).toBe(100);

      const result2 = collectItem(result1.state, "c1", coin, Date.now());
      expect(result2.state.bananasCollected).toBe(1);
      expect(result2.state.coinsCollected).toBe(1);
      expect(result2.pointsEarned).toBe(500);
    });

    it("should accumulate collectible score", () => {
      const banana = createMockCollectible("b1", "banana", { x: 100, y: 100 });
      const coin = createMockCollectible("c1", "coin", { x: 200, y: 100 });
      let state = createCollectibleState([banana, coin]);

      const result1 = collectItem(state, "b1", banana, Date.now());
      const result2 = collectItem(result1.state, "c1", coin, Date.now());

      expect(result2.state.collectibleScore).toBe(600); // 100 + 500
    });
  });
});

// ============================================
// SCORING SYSTEM TESTS
// ============================================

describe("ScoringSystem", () => {
  describe("Configuration", () => {
    it("should have correct default point values", () => {
      expect(DEFAULT_SCORE_CONFIG.bananaPoints).toBe(100);
      expect(DEFAULT_SCORE_CONFIG.coinPoints).toBe(500);
    });

    it("should have time bonus configuration", () => {
      expect(DEFAULT_SCORE_CONFIG.timeBonus.enabled).toBe(true);
      expect(DEFAULT_SCORE_CONFIG.timeBonus.basePoints).toBe(10000);
      expect(DEFAULT_SCORE_CONFIG.timeBonus.penaltyPerSecond).toBe(10);
      expect(DEFAULT_SCORE_CONFIG.timeBonus.minimumBonus).toBe(1000);
    });

    it("should have perfect bonuses configured", () => {
      expect(DEFAULT_SCORE_CONFIG.perfectAreaBonus).toBe(500);
      expect(DEFAULT_SCORE_CONFIG.perfectCourseBonus).toBe(5000);
    });

    it("should have extra life threshold at 2000 points", () => {
      expect(DEFAULT_SCORE_CONFIG.pointsPerExtraLife).toBe(2000);
    });

    it("should have speed bonus configuration", () => {
      expect(DEFAULT_SCORE_CONFIG.speedBonus.threshold).toBe(0.7);
      expect(DEFAULT_SCORE_CONFIG.speedBonus.multiplier).toBe(1.5);
    });
  });

  describe("createScoreState", () => {
    it("should create initial score state", () => {
      const state = createScoreState();
      expect(state.currentScore).toBe(0);
      expect(state.collectibleScore).toBe(0);
      expect(state.extraLivesEarned).toBe(0);
      expect(state.bananasCollected).toBe(0);
      expect(state.coinsCollected).toBe(0);
    });

    it("should preserve previous high score", () => {
      const state = createScoreState(5000);
      expect(state.previousHighScore).toBe(5000);
    });
  });

  describe("addCollectiblePoints", () => {
    it("should add banana points correctly", () => {
      const state = createScoreState();
      const newState = addCollectiblePoints(state, "banana");

      expect(newState.currentScore).toBe(100);
      expect(newState.collectibleScore).toBe(100);
      expect(newState.bananasCollected).toBe(1);
    });

    it("should add coin points correctly", () => {
      const state = createScoreState();
      const newState = addCollectiblePoints(state, "coin");

      expect(newState.currentScore).toBe(500);
      expect(newState.collectibleScore).toBe(500);
      expect(newState.coinsCollected).toBe(1);
    });

    it("should accumulate points", () => {
      let state = createScoreState();
      state = addCollectiblePoints(state, "banana");
      state = addCollectiblePoints(state, "banana");
      state = addCollectiblePoints(state, "coin");

      expect(state.currentScore).toBe(700); // 100 + 100 + 500
      expect(state.bananasCollected).toBe(2);
      expect(state.coinsCollected).toBe(1);
    });
  });

  describe("Extra Life System", () => {
    it("should award extra life at 2000 points", () => {
      let state = createScoreState();

      // Add points up to 1900 (should not earn extra life)
      for (let i = 0; i < 19; i++) {
        state = addCollectiblePoints(state, "banana");
      }
      expect(state.currentScore).toBe(1900);
      expect(state.extraLivesEarned).toBe(0);
      expect(hasPendingExtraLives(state)).toBe(false);

      // Add one more banana (2000 points)
      state = addCollectiblePoints(state, "banana");
      expect(state.currentScore).toBe(2000);
      expect(state.extraLivesEarned).toBe(1);
      expect(hasPendingExtraLives(state)).toBe(true);
    });

    it("should award multiple extra lives", () => {
      let state = createScoreState();

      // Add 4000 points worth (should earn 2 extra lives)
      for (let i = 0; i < 8; i++) {
        state = addCollectiblePoints(state, "coin"); // 8 x 500 = 4000
      }

      expect(state.currentScore).toBe(4000);
      expect(state.extraLivesEarned).toBe(2);
    });
  });

  describe("calculateTimeBonus", () => {
    it("should calculate time bonus correctly", () => {
      // 60 seconds = 10000 - (10 * 60) = 9400
      expect(calculateTimeBonus(60)).toBe(9400);
    });

    it("should not go below minimum", () => {
      // 1000 seconds would be negative, so should be minimum
      expect(calculateTimeBonus(1000)).toBe(1000);
    });

    it("should handle fast completion", () => {
      // 10 seconds = 10000 - (10 * 10) = 9900
      expect(calculateTimeBonus(10)).toBe(9900);
    });

    it("should return 0 when disabled", () => {
      const disabledConfig = {
        ...DEFAULT_SCORE_CONFIG,
        timeBonus: { ...DEFAULT_SCORE_CONFIG.timeBonus, enabled: false },
      };
      expect(calculateTimeBonus(60, disabledConfig)).toBe(0);
    });
  });

  describe("calculateSpeedMultiplier", () => {
    it("should award 1.5x multiplier for fast completion", () => {
      // Complete in 50 seconds with 100 second par time (50%)
      expect(calculateSpeedMultiplier(50, 100)).toBe(1.5);
    });

    it("should award 1x for normal completion", () => {
      // Complete in 80 seconds with 100 second par time (80%)
      expect(calculateSpeedMultiplier(80, 100)).toBe(1);
    });

    it("should award 1x for slow completion", () => {
      // Complete in 150 seconds with 100 second par time (150%)
      expect(calculateSpeedMultiplier(150, 100)).toBe(1);
    });
  });

  describe("markAreaPerfect", () => {
    it("should award perfect area bonus", () => {
      let state = createScoreState();
      state = markAreaPerfect(state, 0);

      expect(state.perfectAreaCount).toBe(1);
      expect(state.perfectAreaBonuses).toBe(500);
      expect(state.currentScore).toBe(500);
    });

    it("should not double-award for same area", () => {
      let state = createScoreState();
      state = markAreaPerfect(state, 0);
      state = markAreaPerfect(state, 0);

      expect(state.perfectAreaCount).toBe(1);
      expect(state.perfectAreaBonuses).toBe(500);
    });
  });

  describe("recordLifeLost", () => {
    it("should increment lives lost counter", () => {
      let state = createScoreState();
      state = recordLifeLost(state, 0);

      expect(state.livesLostInCourse).toBe(1);
    });

    it("should remove area from perfect set", () => {
      let state = createScoreState();
      state = markAreaPerfect(state, 0);
      expect(state.areasWithoutDeath.has(0)).toBe(true);

      state = recordLifeLost(state, 0);
      expect(state.areasWithoutDeath.has(0)).toBe(false);
    });
  });

  describe("calculateFinalScore", () => {
    it("should calculate complete final score", () => {
      let state = createScoreState();
      // Collect 5 bananas and 2 coins
      for (let i = 0; i < 5; i++) {
        state = addCollectiblePoints(state, "banana");
      }
      for (let i = 0; i < 2; i++) {
        state = addCollectiblePoints(state, "coin");
      }
      // Mark 2 areas perfect
      state = markAreaPerfect(state, 0);
      state = markAreaPerfect(state, 1);

      const result = calculateFinalScore(state, 60, 120); // 60 seconds, 120 par

      // Collectible: 500 + 1000 = 1500
      // Perfect areas already added to state: 1000
      // State current score: 2500
      expect(result.breakdown.collectibles).toBe(1500);
      expect(result.breakdown.perfectAreaBonuses).toBe(1000);
      expect(result.breakdown.perfectCourseBonus).toBe(5000); // No lives lost
      expect(result.finalScore).toBeGreaterThan(0);
    });
  });

  describe("calculateStarRating", () => {
    it("should award 3 stars for excellent performance", () => {
      // High collectible %, good time bonus, no deaths
      expect(calculateStarRating(25000, 0.95, 0.6, 0)).toBe(3);
    });

    it("should award 2 stars for good performance", () => {
      expect(calculateStarRating(10000, 0.65, 0.4, 1)).toBe(2);
    });

    it("should award 1 star for completion", () => {
      expect(calculateStarRating(1000, 0.3, 0.1, 5)).toBe(1);
    });
  });
});

// ============================================
// TIMER SYSTEM TESTS
// ============================================

describe("TimerSystem", () => {
  describe("Configuration", () => {
    it("should have 10-minute max time", () => {
      expect(DEFAULT_TIMER_CONFIG.maxTimeMs).toBe(600000);
    });

    it("should have warning at 1 minute remaining", () => {
      expect(DEFAULT_TIMER_CONFIG.warningThresholdMs).toBe(60000);
    });

    it("should have critical at 30 seconds remaining", () => {
      expect(DEFAULT_TIMER_CONFIG.criticalThresholdMs).toBe(30000);
    });
  });

  describe("createTimerState", () => {
    it("should create initial timer state", () => {
      const state = createTimerState();
      expect(state.elapsedMs).toBe(0);
      expect(state.isRunning).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.isTimeUp).toBe(false);
    });

    it("should set max time from config", () => {
      const state = createTimerState();
      expect(state.maxTimeMs).toBe(600000);
    });
  });

  describe("startTimer", () => {
    it("should start the timer", () => {
      const state = createTimerState();
      const startedState = startTimer(state, 1000);

      expect(startedState.isRunning).toBe(true);
      expect(startedState.startTime).toBe(1000);
    });

    it("should not restart if already running", () => {
      const state = createTimerState();
      const started = startTimer(state, 1000);
      const restarted = startTimer(started, 5000);

      expect(restarted.startTime).toBe(1000); // Original start time
    });
  });

  describe("pauseTimer and resumeTimer", () => {
    it("should pause and resume correctly", () => {
      let state = createTimerState();
      state = startTimer(state, 0);

      // Pause at 5 seconds
      state = pauseTimer(state, 5000);
      expect(state.isPaused).toBe(true);
      expect(state.pausedTime).toBe(5000);

      // Resume at 10 seconds (5 seconds of pause)
      state = resumeTimer(state, 10000);
      expect(state.isPaused).toBe(false);
      expect(state.startTime).toBe(5000); // Adjusted by pause duration
    });
  });

  describe("updateTimer", () => {
    it("should update elapsed time", () => {
      let state = createTimerState();
      state = startTimer(state, 0);

      state = updateTimer(state, 5000);
      expect(state.elapsedMs).toBe(5000);
    });

    it("should calculate remaining time", () => {
      let state = createTimerState();
      state = startTimer(state, 0);
      state = updateTimer(state, 60000); // 1 minute elapsed

      expect(state.remainingMs).toBe(540000); // 9 minutes remaining
    });

    it("should detect time up", () => {
      let state = createTimerState();
      state = startTimer(state, 0);
      state = updateTimer(state, 600000); // 10 minutes

      expect(state.isTimeUp).toBe(true);
    });

    it("should not update when paused", () => {
      let state = createTimerState();
      state = startTimer(state, 0);
      state = updateTimer(state, 5000);
      state = pauseTimer(state, 5000);
      state = updateTimer(state, 10000);

      expect(state.elapsedMs).toBe(5000); // Still 5 seconds
    });
  });

  describe("resetTimer", () => {
    it("should reset to initial state", () => {
      let state = createTimerState();
      state = startTimer(state, 0);
      state = updateTimer(state, 60000);

      const resetState = resetTimer(state);
      expect(resetState.elapsedMs).toBe(0);
      expect(resetState.isRunning).toBe(false);
    });
  });

  describe("Warning and Critical Detection", () => {
    it("should detect warning zone", () => {
      let state = createTimerState();
      state = startTimer(state, 0);
      state = updateTimer(state, 550000); // 50 seconds remaining

      expect(state.isWarning).toBe(true);
    });

    it("should detect critical zone", () => {
      let state = createTimerState();
      state = startTimer(state, 0);
      state = updateTimer(state, 580000); // 20 seconds remaining

      expect(state.isCritical).toBe(true);
    });
  });
});

// ============================================
// GAME PROGRESS SYSTEM TESTS
// ============================================

describe("GameProgressSystem", () => {
  describe("Configuration", () => {
    it("should have area completion trigger distance", () => {
      expect(DEFAULT_PROGRESS_CONFIG.areaCompleteTriggerDistance).toBe(30);
    });

    it("should have respawn delay", () => {
      expect(DEFAULT_PROGRESS_CONFIG.respawnDelay).toBe(1500);
    });
  });

  describe("createProgressState", () => {
    it("should create initial progress state", () => {
      const course = createMockCourse(3);
      const state = createProgressState(course);

      expect(state.status).toBe("idle");
      expect(state.courseId).toBe("test_course");
      expect(state.currentAreaIndex).toBe(0);
      expect(state.totalAreas).toBe(3);
      expect(state.areasCompleted.size).toBe(0);
      expect(state.checkpointsReached.has(0)).toBe(true);
    });
  });

  describe("Game Status Transitions", () => {
    it("should start game", () => {
      const course = createMockCourse();
      const state = createProgressState(course);
      const startedState = startGame(state, 1000);

      expect(startedState.status).toBe("playing");
      expect(startedState.currentRunStartTime).toBe(1000);
    });

    it("should pause and resume game", () => {
      const course = createMockCourse();
      let state = startGame(createProgressState(course), 0);

      state = pauseGame(state, 5000);
      expect(state.status).toBe("paused");

      state = resumeGame(state, 6000);
      expect(state.status).toBe("playing");
    });

    it("should not pause when not playing", () => {
      const course = createMockCourse();
      const state = createProgressState(course);
      const pausedState = pauseGame(state, 1000);

      expect(pausedState.status).toBe("idle"); // Still idle
    });

    it("should handle crash", () => {
      const course = createMockCourse();
      let state = startGame(createProgressState(course), 0);
      state = handleCrash(state, 5000);

      expect(state.status).toBe("crashed");
      expect(state.totalDeaths).toBe(1);
      expect(state.currentAreaDeathCount).toBe(1);
    });
  });

  describe("Area Progression", () => {
    it("should complete area", () => {
      const course = createMockCourse();
      let state = startGame(createProgressState(course), 0);
      state = completeArea(state, 0, 30000);

      expect(state.areasCompleted.has(0)).toBe(true);
      expect(state.isAreaComplete).toBe(true);
      expect(state.bestAreaTime.get(0)).toBe(30000);
    });

    it("should advance to next area", () => {
      const course = createMockCourse();
      let state = startGame(createProgressState(course), 0);
      state = completeArea(state, 0, 30000);
      state = advanceToNextArea(state, 31000);

      expect(state.currentAreaIndex).toBe(1);
      expect(state.checkpointsReached.has(1)).toBe(true);
      expect(state.isAreaComplete).toBe(false);
      expect(state.currentAreaDeathCount).toBe(0);
    });

    it("should complete course on last area", () => {
      const course = createMockCourse(2);
      let state = startGame(createProgressState(course), 0);

      // Complete first area
      state = completeArea(state, 0, 30000);
      state = advanceToNextArea(state, 31000);

      // Complete second (last) area
      state = completeArea(state, 1, 60000);
      state = advanceToNextArea(state, 61000);

      expect(state.status).toBe("complete");
      expect(state.isCourseComplete).toBe(true);
    });
  });

  describe("Checkpoint System", () => {
    it("should reset to checkpoint", () => {
      const course = createMockCourse();
      let state = startGame(createProgressState(course), 0);

      // Progress to area 2
      state = completeArea(state, 0, 30000);
      state = advanceToNextArea(state, 31000);
      state = completeArea(state, 1, 60000);
      state = advanceToNextArea(state, 61000);

      // Crash and reset
      state = handleCrash(state, 70000);
      state = resetToCheckpoint(state, 1, 72000);

      expect(state.status).toBe("playing");
      expect(state.currentAreaIndex).toBe(1);
    });

    it("should track last checkpoint", () => {
      const course = createMockCourse();
      let state = createProgressState(course);
      expect(getLastCheckpointIndex(state)).toBe(0);

      state = startGame(state, 0);
      state = completeArea(state, 0, 30000);
      state = advanceToNextArea(state, 31000);

      expect(getLastCheckpointIndex(state)).toBe(1);
    });

    it("should check if checkpoint reached", () => {
      const course = createMockCourse();
      let state = createProgressState(course);

      expect(isCheckpointReached(state, 0)).toBe(true);
      expect(isCheckpointReached(state, 1)).toBe(false);

      state = startGame(state, 0);
      state = completeArea(state, 0, 30000);
      state = advanceToNextArea(state, 31000);

      expect(isCheckpointReached(state, 1)).toBe(true);
    });
  });

  describe("checkCheckpointReached", () => {
    it("should detect when cart reaches checkpoint", () => {
      const checkpoint: Checkpoint = {
        id: "checkpoint_1",
        position: { x: 400, y: 100 },
        rotation: 0,
        areaIndex: 1,
      };

      expect(checkCheckpointReached({ x: 400, y: 100 }, checkpoint)).toBe(true);
      expect(checkCheckpointReached({ x: 410, y: 100 }, checkpoint)).toBe(true);
      expect(checkCheckpointReached({ x: 500, y: 100 }, checkpoint)).toBe(
        false,
      );
    });
  });

  describe("Course Restart", () => {
    it("should restart course completely", () => {
      const course = createMockCourse();
      let state = startGame(createProgressState(course), 0);
      state = completeArea(state, 0, 30000);
      state = advanceToNextArea(state, 31000);
      state = handleCrash(state, 50000);

      state = restartCourse(state, 100000);

      expect(state.status).toBe("idle");
      expect(state.currentAreaIndex).toBe(0);
      expect(state.areasCompleted.size).toBe(0);
      expect(state.totalRestarts).toBe(1);
      expect(state.totalDeaths).toBe(0); // Reset
    });

    it("should preserve best area times on restart", () => {
      const course = createMockCourse();
      let state = startGame(createProgressState(course), 0);
      state = completeArea(state, 0, 30000);
      expect(state.bestAreaTime.get(0)).toBe(30000);

      state = restartCourse(state, 100000);
      expect(state.bestAreaTime.get(0)).toBe(30000); // Preserved
    });
  });

  describe("Progress Queries", () => {
    it("should calculate progress percentage", () => {
      const course = createMockCourse(4);
      let state = startGame(createProgressState(course), 0);

      expect(getProgressPercentage(state)).toBe(0);

      state = completeArea(state, 0, 30000);
      expect(getProgressPercentage(state)).toBe(0.25);

      state = advanceToNextArea(state, 31000);
      state = completeArea(state, 1, 60000);
      expect(getProgressPercentage(state)).toBe(0.5);
    });

    it("should format area display", () => {
      const course = createMockCourse(5);
      let state = createProgressState(course);

      expect(getCurrentAreaDisplay(state)).toBe("1/5");

      state = startGame(state, 0);
      state = completeArea(state, 0, 30000);
      state = advanceToNextArea(state, 31000);

      expect(getCurrentAreaDisplay(state)).toBe("2/5");
    });

    it("should detect perfect area", () => {
      const course = createMockCourse();
      let state = startGame(createProgressState(course), 0);

      expect(isCurrentAreaPerfect(state)).toBe(true);
    });

    it("should get area stats", () => {
      const course = createMockCourse(4);
      let state = startGame(createProgressState(course), 0);
      state = completeArea(state, 0, 30000);
      state = advanceToNextArea(state, 31000);

      const stats = getAreaStats(state);
      expect(stats.completed).toBe(1);
      expect(stats.total).toBe(4);
      expect(stats.current).toBe(2);
      expect(stats.percentage).toBe(25);
    });
  });

  describe("Completion Result", () => {
    it("should generate completion result", () => {
      const course = createMockCourse(2);
      let state = startGame(createProgressState(course), 0);
      state = completeArea(state, 0, 30000);
      state = advanceToNextArea(state, 31000);
      state = completeArea(state, 1, 60000);
      state = completeCourse(state, 61000);

      const result = generateCompletionResult(state, 61000);

      expect(result.courseId).toBe("test_course");
      expect(result.completed).toBe(true);
      expect(result.totalTime).toBe(61000);
      expect(result.areasCompleted).toBe(2);
      expect(result.totalAreas).toBe(2);
      expect(result.totalDeaths).toBe(0);
    });
  });

  describe("Display Helpers", () => {
    it("should get status display text", () => {
      expect(getStatusDisplayText("idle")).toBe("Ready");
      expect(getStatusDisplayText("playing")).toBe("Playing");
      expect(getStatusDisplayText("paused")).toBe("Paused");
      expect(getStatusDisplayText("crashed")).toBe("Crashed!");
      expect(getStatusDisplayText("complete")).toBe("Complete!");
    });

    it("should generate progress bar data", () => {
      const course = createMockCourse(3);
      let state = startGame(createProgressState(course), 0);
      state = completeArea(state, 0, 30000);
      state = advanceToNextArea(state, 31000);

      const barData = getProgressBarData(state);

      expect(barData.segments.length).toBe(3);
      expect(barData.segments[0].completed).toBe(true);
      expect(barData.segments[0].current).toBe(false);
      expect(barData.segments[1].completed).toBe(false);
      expect(barData.segments[1].current).toBe(true);
      expect(barData.segments[2].completed).toBe(false);
      expect(barData.percentage).toBeCloseTo(33.33, 1);
    });
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe("Phase 6 Integration", () => {
  describe("Collectible + Scoring Integration", () => {
    it("should award points for collected items", () => {
      const banana = createMockCollectible("b1", "banana", { x: 100, y: 100 });
      const coin = createMockCollectible("c1", "coin", { x: 200, y: 100 });

      let collectibleState = createCollectibleState([banana, coin]);
      let scoreState = createScoreState();

      // Collect banana
      const result1 = collectItem(collectibleState, "b1", banana, Date.now());
      collectibleState = result1.state;
      scoreState = addCollectiblePoints(scoreState, "banana");

      expect(collectibleState.bananasCollected).toBe(1);
      expect(scoreState.currentScore).toBe(100);

      // Collect coin
      const result2 = collectItem(collectibleState, "c1", coin, Date.now());
      collectibleState = result2.state;
      scoreState = addCollectiblePoints(scoreState, "coin");

      expect(collectibleState.coinsCollected).toBe(1);
      expect(scoreState.currentScore).toBe(600);
    });

    it("should award extra life at 2000 points", () => {
      let scoreState = createScoreState();

      // Collect enough for 2000 points
      for (let i = 0; i < 4; i++) {
        scoreState = addCollectiblePoints(scoreState, "coin"); // 4 * 500 = 2000
      }

      expect(scoreState.currentScore).toBe(2000);
      expect(scoreState.extraLivesEarned).toBe(1);
    });
  });

  describe("Timer + Progress Integration", () => {
    it("should track time and progress together", () => {
      const course = createMockCourse(2);

      let progressState = startGame(createProgressState(course), 0);
      let timerState = startTimer(createTimerState(), 0);

      // Simulate 30 seconds of play
      timerState = updateTimer(timerState, 30000);
      progressState = completeArea(progressState, 0, 30000);

      expect(timerState.elapsedMs).toBe(30000);
      expect(progressState.areasCompleted.has(0)).toBe(true);
    });

    it("should pause timer when game paused", () => {
      const course = createMockCourse(2);

      let progressState = startGame(createProgressState(course), 0);
      let timerState = startTimer(createTimerState(), 0);

      // Play for 10 seconds
      timerState = updateTimer(timerState, 10000);

      // Pause for 5 seconds
      progressState = pauseGame(progressState, 10000);
      timerState = pauseTimer(timerState, 10000);
      timerState = resumeTimer(timerState, 15000);
      progressState = resumeGame(progressState, 15000);

      // Continue for 10 more seconds (25 seconds wall time)
      timerState = updateTimer(timerState, 25000);

      // Start time adjusted by 5 seconds, so 25 - 5 = 20 seconds elapsed
      expect(timerState.elapsedMs).toBe(20000);
      expect(progressState.status).toBe("playing");
    });
  });

  describe("Complete Course Flow", () => {
    it("should calculate final score on course completion", () => {
      const course = createMockCourse(2);
      const bananas = [
        createMockCollectible("b1", "banana", { x: 100, y: 100 }, 0),
        createMockCollectible("b2", "banana", { x: 200, y: 100 }, 0),
        createMockCollectible("b3", "banana", { x: 100, y: 100 }, 1),
      ];
      const coin = createMockCollectible("c1", "coin", { x: 200, y: 100 }, 1);

      // Setup state
      let progressState = startGame(createProgressState(course), 0);
      let timerState = startTimer(createTimerState(), 0);
      let scoreState = createScoreState();

      // Complete area 0 with all collectibles
      scoreState = addCollectiblePoints(scoreState, "banana");
      scoreState = addCollectiblePoints(scoreState, "banana");
      scoreState = markAreaPerfect(scoreState, 0);

      progressState = completeArea(progressState, 0, 30000);
      progressState = advanceToNextArea(progressState, 31000);

      // Complete area 1 with all collectibles
      scoreState = addCollectiblePoints(scoreState, "banana");
      scoreState = addCollectiblePoints(scoreState, "coin");
      scoreState = markAreaPerfect(scoreState, 1);

      progressState = completeArea(progressState, 1, 60000);
      progressState = completeCourse(progressState, 61000);

      timerState = updateTimer(timerState, 60000);

      // Calculate final score (using 60 seconds elapsed, 120 second par)
      const finalResult = calculateFinalScore(scoreState, 60, 120);

      expect(progressState.isCourseComplete).toBe(true);
      expect(scoreState.collectibleScore).toBe(800); // 3 bananas + 1 coin = 300 + 500
      expect(finalResult.breakdown.collectibles).toBe(800);
      expect(finalResult.finalScore).toBeGreaterThan(0);
      expect(finalResult.breakdown.perfectCourseBonus).toBe(5000); // No deaths
    });
  });
});
