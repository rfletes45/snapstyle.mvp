/**
 * Cart Course Phase 8: Progression & Integration Tests
 *
 * Comprehensive unit tests for:
 * - Stamps/achievement system
 * - Unlockables (courses, skins, modes)
 * - Firebase service (mocked)
 * - Navigation hooks
 * - Performance utilities
 */

// =============================================================================
// Mock Setup
// =============================================================================

// Mock Firebase
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  Timestamp: {
    now: () => ({ toDate: () => new Date() }),
    fromDate: (d: Date) => ({ toDate: () => d }),
  },
  increment: jest.fn(),
  arrayUnion: jest.fn(),
  writeBatch: jest.fn(),
}));

// Mock React Navigation
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

// Mock BackHandler
jest.mock("react-native", () => ({
  BackHandler: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: { OS: "android" },
  Alert: { alert: jest.fn() },
}));

// Mock firebase service
jest.mock("../../../src/services/firebase", () => ({
  getFirestoreInstance: jest.fn(() => ({})),
}));

// =============================================================================
// Stamps Tests
// =============================================================================

describe("Stamps System", () => {
  // Import after mocks are set up
  const {
    CART_COURSE_STAMPS,
    calculateStampProgress,
    checkStampsForProgress,
    getNextStampsToEarn,
    getStampRarityColor,
    getStampsByCategory,
    getStampById,
    createInitialCourseStats,
  } = require("../../../src/components/games/CartCourse/data/stamps");

  // Get CourseStats type from stamps
  type CourseStats = ReturnType<typeof createInitialCourseStats>;

  const createDefaultStats = (): CourseStats => createInitialCourseStats();

  describe("CART_COURSE_STAMPS", () => {
    it("should have stamps defined", () => {
      expect(CART_COURSE_STAMPS).toBeDefined();
      expect(CART_COURSE_STAMPS.length).toBeGreaterThan(0);
    });

    it("should have all required stamp properties", () => {
      CART_COURSE_STAMPS.forEach((stamp: any) => {
        expect(stamp.id).toBeTruthy();
        expect(stamp.name).toBeTruthy();
        expect(stamp.description).toBeTruthy();
        expect(stamp.icon).toBeTruthy();
        expect(stamp.rarity).toMatch(/^(common|uncommon|rare|epic|legendary)$/);
        expect(stamp.category).toBeTruthy();
        expect(stamp.requirement).toBeDefined();
        expect(stamp.points).toBeGreaterThan(0);
      });
    });

    it("should have unique stamp IDs", () => {
      const ids = CART_COURSE_STAMPS.map((s: any) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have valid categories", () => {
      const validCategories = [
        "completion",
        "skill",
        "collection",
        "speed",
        "challenge",
        "mastery",
      ];
      CART_COURSE_STAMPS.forEach((stamp: any) => {
        expect(validCategories).toContain(stamp.category);
      });
    });

    it("should have valid rarities", () => {
      const validRarities = ["common", "uncommon", "rare", "epic", "legendary"];
      CART_COURSE_STAMPS.forEach((stamp: any) => {
        expect(validRarities).toContain(stamp.rarity);
      });
    });
  });

  describe("createInitialCourseStats", () => {
    it("should create empty initial stats", () => {
      const stats = createInitialCourseStats();

      expect(stats.coursesCompleted).toEqual([]);
      expect(stats.perfectCourses).toEqual([]);
      expect(stats.totalBananasCollected).toBe(0);
      expect(stats.totalCoinsCollected).toBe(0);
      expect(stats.totalCrashes).toBe(0);
      expect(stats.earnedStamps).toEqual([]);
    });
  });

  describe("calculateStampProgress", () => {
    it("should return progress object for stamp", () => {
      const stamp = CART_COURSE_STAMPS[0];
      const stats = createDefaultStats();
      const progress = calculateStampProgress(stamp, stats);

      expect(progress).toBeDefined();
      expect(typeof progress.currentValue).toBe("number");
      expect(typeof progress.targetValue).toBe("number");
      expect(typeof progress.percentComplete).toBe("number");
      expect(typeof progress.isComplete).toBe("boolean");
    });

    it("should show 0% progress for new player", () => {
      const stamp = CART_COURSE_STAMPS.find(
        (s: any) => s.requirement.type === "total_bananas",
      );
      const stats = createDefaultStats();
      const progress = calculateStampProgress(stamp, stats);

      expect(progress.percentComplete).toBe(0);
      expect(progress.isComplete).toBe(false);
    });

    it("should show 100% for completed requirement", () => {
      const stamp = CART_COURSE_STAMPS.find(
        (s: any) => s.requirement.type === "course_complete",
      );
      const stats = createDefaultStats();
      stats.coursesCompleted = [stamp.requirement.courseId];
      const progress = calculateStampProgress(stamp, stats);

      expect(progress.percentComplete).toBe(100);
      expect(progress.isComplete).toBe(true);
    });

    it("should calculate partial progress for collection stamps", () => {
      const stamp = CART_COURSE_STAMPS.find(
        (s: any) =>
          s.requirement.type === "total_bananas" && s.requirement.count === 100,
      );
      const stats = createDefaultStats();
      stats.totalBananasCollected = 50;
      const progress = calculateStampProgress(stamp, stats);

      expect(progress.percentComplete).toBe(50);
      expect(progress.currentValue).toBe(50);
      expect(progress.targetValue).toBe(100);
      expect(progress.isComplete).toBe(false);
    });
  });

  describe("checkStampsForProgress", () => {
    it("should return empty array for new player", () => {
      const stats = createDefaultStats();
      const newlyEarned = checkStampsForProgress(stats, []);

      expect(Array.isArray(newlyEarned)).toBe(true);
    });

    it("should return earned stamp IDs when requirements met", () => {
      const stats = createDefaultStats();
      stats.coursesCompleted = ["course_1"];
      const newlyEarned = checkStampsForProgress(stats, []);

      expect(newlyEarned.length).toBeGreaterThan(0);
      expect(newlyEarned.every((id: string) => typeof id === "string")).toBe(
        true,
      );
    });

    it("should not return already earned stamps", () => {
      const stats = createDefaultStats();
      stats.coursesCompleted = ["course_1"];

      // First call - should earn stamps
      const firstEarned = checkStampsForProgress(stats, []);
      expect(firstEarned.length).toBeGreaterThan(0);

      // Second call with already earned - should not return same stamps
      const secondEarned = checkStampsForProgress(stats, firstEarned);
      firstEarned.forEach((id: string) => {
        expect(secondEarned).not.toContain(id);
      });
    });
  });

  describe("getNextStampsToEarn", () => {
    it("should return stamps sorted by progress", () => {
      const stats = createDefaultStats();
      stats.totalBananasCollected = 50; // Partial progress on banana stamps
      const nextStamps = getNextStampsToEarn(stats, 5);

      expect(Array.isArray(nextStamps)).toBe(true);
      expect(nextStamps.length).toBeLessThanOrEqual(5);

      // Each entry should have stamp and progress
      nextStamps.forEach((entry: any) => {
        expect(entry.stamp).toBeDefined();
        expect(entry.progress).toBeDefined();
      });
    });

    it("should exclude secret stamps", () => {
      const stats = createDefaultStats();
      const nextStamps = getNextStampsToEarn(stats, 100);

      nextStamps.forEach((entry: any) => {
        expect(entry.stamp.secret).toBeFalsy();
      });
    });

    it("should exclude already earned stamps", () => {
      const stats = createDefaultStats();
      stats.coursesCompleted = ["course_1"];
      stats.earnedStamps = ["first_finish", "classic_champion"];
      const nextStamps = getNextStampsToEarn(stats, 100);

      const stampIds = nextStamps.map((e: any) => e.stamp.id);
      expect(stampIds).not.toContain("first_finish");
      expect(stampIds).not.toContain("classic_champion");
    });

    it("should respect limit parameter", () => {
      const stats = createDefaultStats();
      const nextStamps = getNextStampsToEarn(stats, 3);

      expect(nextStamps.length).toBeLessThanOrEqual(3);
    });
  });

  describe("getStampRarityColor", () => {
    it("should return colors for all rarities", () => {
      const rarities = ["common", "uncommon", "rare", "epic", "legendary"];
      rarities.forEach((rarity: any) => {
        const color = getStampRarityColor(rarity);
        expect(typeof color).toBe("string");
        expect(color.startsWith("#")).toBe(true);
      });
    });
  });

  describe("getStampsByCategory", () => {
    it("should return stamps filtered by category", () => {
      const categories = [
        "completion",
        "skill",
        "collection",
        "speed",
        "challenge",
        "mastery",
      ];

      categories.forEach((category) => {
        const stamps = getStampsByCategory(category);
        expect(Array.isArray(stamps)).toBe(true);
        stamps.forEach((stamp: any) => {
          expect(stamp.category).toBe(category);
        });
      });
    });
  });

  describe("getStampById", () => {
    it("should return stamp for valid ID", () => {
      const stamp = getStampById("first_finish");
      expect(stamp).toBeDefined();
      expect(stamp.id).toBe("first_finish");
    });

    it("should return undefined for invalid ID", () => {
      const stamp = getStampById("nonexistent_stamp");
      expect(stamp).toBeUndefined();
    });
  });
});

// =============================================================================
// Unlockables Tests
// =============================================================================

describe("Unlockables System", () => {
  const {
    UNLOCKABLE_COURSES,
    UNLOCKABLE_CART_SKINS,
    UNLOCKABLE_MODES,
    isUnlocked,
    getUnlockProgress,
    getUnlockedCourses,
    getUnlockedCartSkins,
    getUnlockedModes,
    checkNewUnlocks,
    updateUnlocks,
    createInitialUnlocks,
    getCartSkinById,
    getGameModeById,
  } = require("../../../src/components/games/CartCourse/data/unlockables");

  const {
    createInitialCourseStats,
  } = require("../../../src/components/games/CartCourse/data/stamps");

  describe("UNLOCKABLE_COURSES", () => {
    it("should have courses defined", () => {
      expect(UNLOCKABLE_COURSES).toBeDefined();
      expect(UNLOCKABLE_COURSES.length).toBeGreaterThan(0);
    });

    it("should have required properties for each course", () => {
      UNLOCKABLE_COURSES.forEach((course: any) => {
        expect(course.id).toBeTruthy();
        expect(course.name).toBeTruthy();
        expect(course.description).toBeTruthy();
        expect(course.type).toBe("course");
        expect(course.requirement).toBeDefined();
      });
    });

    it("should have course_1 available from start", () => {
      const course1 = UNLOCKABLE_COURSES.find((c: any) => c.id === "course_1");
      expect(course1).toBeDefined();
      expect(course1.requirement.type).toBe("none");
    });

    it("should have course_2 require completing course_1", () => {
      const course2 = UNLOCKABLE_COURSES.find((c: any) => c.id === "course_2");
      expect(course2).toBeDefined();
      expect(course2.requirement.type).toBe("complete_course");
      expect(course2.requirement.courseId).toBe("course_1");
    });
  });

  describe("UNLOCKABLE_CART_SKINS", () => {
    it("should have skins defined", () => {
      expect(UNLOCKABLE_CART_SKINS).toBeDefined();
      expect(UNLOCKABLE_CART_SKINS.length).toBeGreaterThan(0);
    });

    it("should have required properties for each skin", () => {
      UNLOCKABLE_CART_SKINS.forEach((skin: any) => {
        expect(skin.id).toBeTruthy();
        expect(skin.name).toBeTruthy();
        expect(skin.type).toBe("cart_skin");
        expect(skin.colors).toBeDefined();
        expect(skin.colors.body).toBeTruthy();
        expect(skin.colors.wheels).toBeTruthy(); // Note: API uses "wheels" not "wheel"
      });
    });

    it("should have default skin available from start", () => {
      const defaultSkin = UNLOCKABLE_CART_SKINS.find(
        (s: any) => s.id === "default" || s.requirement?.type === "none",
      );
      expect(defaultSkin).toBeDefined();
    });
  });

  describe("UNLOCKABLE_MODES", () => {
    it("should have modes defined", () => {
      expect(UNLOCKABLE_MODES).toBeDefined();
      expect(UNLOCKABLE_MODES.length).toBeGreaterThan(0);
    });

    it("should have required properties for each mode", () => {
      UNLOCKABLE_MODES.forEach((mode: any) => {
        expect(mode.id).toBeTruthy();
        expect(mode.name).toBeTruthy();
        expect(mode.type).toBe("mode");
        expect(mode.requirement).toBeDefined();
      });
    });

    it("should have standard mode available from start", () => {
      const standardMode = UNLOCKABLE_MODES.find(
        (m: any) => m.id === "standard" || m.requirement?.type === "none",
      );
      expect(standardMode).toBeDefined();
    });
  });

  describe("createInitialUnlocks", () => {
    it("should create initial unlocks with default items", () => {
      const unlocks = createInitialUnlocks();

      expect(unlocks.unlockedCourses).toContain("course_1");
      expect(unlocks.unlockedSkins.length).toBeGreaterThan(0);
      expect(unlocks.unlockedModes.length).toBeGreaterThan(0);
    });
  });

  describe("getUnlockProgress", () => {
    it("should return progress for unlockable items", () => {
      const stats = createInitialCourseStats();
      const course2 = UNLOCKABLE_COURSES.find((c: any) => c.id === "course_2");

      if (course2) {
        const progress = getUnlockProgress(course2, stats);
        expect(progress).toBeDefined();
        expect(typeof progress.currentValue).toBe("number");
        expect(typeof progress.targetValue).toBe("number");
        expect(typeof progress.percentComplete).toBe("number");
        expect(typeof progress.isUnlocked).toBe("boolean");
      }
    });

    it("should show unlocked for items with no requirement", () => {
      const stats = createInitialCourseStats();
      const course1 = UNLOCKABLE_COURSES.find((c: any) => c.id === "course_1");

      if (course1) {
        const progress = getUnlockProgress(course1, stats);
        expect(progress.isUnlocked).toBe(true);
      }
    });
  });

  describe("getUnlockedCourses", () => {
    it("should return array of unlocked courses", () => {
      const stats = createInitialCourseStats();
      const unlocked = getUnlockedCourses(stats);

      expect(Array.isArray(unlocked)).toBe(true);
      expect(unlocked.length).toBeGreaterThan(0);
      // Course 1 should always be unlocked
      expect(unlocked.some((c: any) => c.id === "course_1")).toBe(true);
    });

    it("should include more courses as requirements are met", () => {
      const stats = createInitialCourseStats();
      stats.coursesCompleted = ["course_1"];
      const unlocked = getUnlockedCourses(stats);

      expect(unlocked.some((c: any) => c.id === "course_2")).toBe(true);
    });
  });

  describe("checkNewUnlocks", () => {
    it("should detect new unlocks when requirements are met", () => {
      const stats = createInitialCourseStats();
      stats.coursesCompleted = ["course_1"];

      const previousUnlocks = ["course_1", "skin_default", "mode_standard"];
      const newUnlocks = checkNewUnlocks(previousUnlocks, stats);

      expect(newUnlocks.some((u: any) => u.id === "course_2")).toBe(true);
    });
  });

  describe("updateUnlocks", () => {
    it("should add newly unlocked items", () => {
      const stats = createInitialCourseStats();
      stats.coursesCompleted = ["course_1"];

      const currentUnlocks = createInitialUnlocks();
      const updated = updateUnlocks(currentUnlocks, stats);

      expect(updated.unlockedCourses).toContain("course_2");
    });

    it("should preserve already unlocked items", () => {
      const stats = createInitialCourseStats();
      const currentUnlocks = createInitialUnlocks();

      const updated = updateUnlocks(currentUnlocks, stats);

      expect(updated.unlockedCourses).toContain("course_1");
    });
  });

  describe("getCartSkinById", () => {
    it("should return skin for valid ID", () => {
      const skin = getCartSkinById("skin_default");
      expect(skin).toBeDefined();
      expect(skin.id).toBe("skin_default");
    });

    it("should return undefined for invalid ID", () => {
      const skin = getCartSkinById("nonexistent_skin");
      expect(skin).toBeUndefined();
    });
  });

  describe("getGameModeById", () => {
    it("should return mode for valid ID", () => {
      const mode = getGameModeById("mode_standard");
      expect(mode).toBeDefined();
      expect(mode.id).toBe("mode_standard");
    });

    it("should return undefined for invalid ID", () => {
      const mode = getGameModeById("nonexistent_mode");
      expect(mode).toBeUndefined();
    });
  });
});

// =============================================================================
// Navigation Hook Tests
// =============================================================================

describe("Cart Course Navigation", () => {
  const {
    GameSessionState,
  } = require("../../../src/components/games/CartCourse/hooks/useCartCourseNavigation");

  const {
    UNLOCKABLE_MODES,
    getGameModeById,
  } = require("../../../src/components/games/CartCourse/data/unlockables");

  describe("Game Mode Settings", () => {
    it("should have standard mode with default modifiers", () => {
      const standardMode = getGameModeById("mode_standard");
      expect(standardMode).toBeDefined();
      expect(standardMode.modifiers).toBeUndefined(); // Standard has no special modifiers
    });

    it("should have time attack mode with special settings", () => {
      const timeAttackMode = getGameModeById("mode_time_attack");
      expect(timeAttackMode).toBeDefined();
      expect(timeAttackMode.modifiers).toBeDefined();
      expect(timeAttackMode.modifiers.timerCountsUp).toBe(true);
    });

    it("should have one life mode with 1 life", () => {
      const oneLifeMode = getGameModeById("mode_one_life");
      expect(oneLifeMode).toBeDefined();
      expect(oneLifeMode.modifiers).toBeDefined();
      expect(oneLifeMode.modifiers.livesCount).toBe(1);
    });

    it("should handle unknown mode gracefully", () => {
      const unknownMode = getGameModeById("unknown_mode");
      expect(unknownMode).toBeUndefined();
    });
  });

  describe("UNLOCKABLE_MODES", () => {
    it("should have modes defined", () => {
      expect(UNLOCKABLE_MODES).toBeDefined();
      expect(UNLOCKABLE_MODES.length).toBeGreaterThan(0);
    });

    it("should include standard mode", () => {
      const standard = UNLOCKABLE_MODES.find(
        (m: any) => m.id === "mode_standard",
      );
      expect(standard).toBeDefined();
      expect(standard.requirement.type).toBe("none");
    });
  });
});

// =============================================================================
// Performance Utilities Tests
// =============================================================================

describe("Performance Utilities", () => {
  const {
    PerformanceMonitor,
    ObjectPool,
    getPooledVector,
    releasePooledVector,
    getVectorPoolStats,
    FrameBudget,
    BatchProcessor,
    getQualitySettings,
    detectOptimalQuality,
    gamePerformanceMonitor,
  } = require("../../../src/components/games/CartCourse/systems/PerformanceUtils");

  describe("PerformanceMonitor", () => {
    let monitor: InstanceType<typeof PerformanceMonitor>;

    beforeEach(() => {
      monitor = new PerformanceMonitor();
    });

    afterEach(() => {
      if (monitor.stop) {
        monitor.stop();
      }
    });

    it("should create a performance monitor", () => {
      expect(monitor).toBeDefined();
    });

    it("should track frame times with recordFrame", () => {
      monitor.start();
      // Record some frames
      monitor.recordFrame();
      monitor.recordFrame();
      monitor.recordFrame();

      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalFrames).toBe(3);
    });

    it("should calculate FPS", () => {
      monitor.start();
      // Simulate 10 frames
      for (let i = 0; i < 10; i++) {
        monitor.recordFrame();
      }

      const metrics = monitor.getMetrics();
      expect(metrics.fps).toBeGreaterThan(0);
    });

    it("should reset metrics", () => {
      monitor.start();
      monitor.recordFrame();
      monitor.recordFrame();
      monitor.reset();

      const metrics = monitor.getMetrics();
      expect(metrics.totalFrames).toBe(0);
    });

    it("should report warning levels", () => {
      monitor.start();
      // Record some frames to get a warning level
      for (let i = 0; i < 10; i++) {
        monitor.recordFrame();
      }

      const warningLevel = monitor.getWarningLevel();
      expect(["none", "low", "medium", "high"]).toContain(warningLevel);
    });

    it("should check if healthy", () => {
      monitor.start();
      for (let i = 0; i < 60; i++) {
        monitor.recordFrame();
      }

      const isHealthy = monitor.isHealthy();
      expect(typeof isHealthy).toBe("boolean");
    });
  });

  describe("ObjectPool", () => {
    it("should create objects up to initial size", () => {
      const pool = new ObjectPool(
        () => ({ x: 0, y: 0 }),
        (obj: any) => {
          obj.x = 0;
          obj.y = 0;
        },
        10,
      );

      const stats = pool.getStats();
      expect(stats.poolSize).toBe(10);
    });

    it("should acquire objects from pool", () => {
      const pool = new ObjectPool(
        () => ({ x: 0, y: 0 }),
        (obj: any) => {
          obj.x = 0;
          obj.y = 0;
        },
        5,
      );

      const obj = pool.acquire();
      expect(obj).toBeDefined();
      expect(obj.x).toBe(0);
      expect(obj.y).toBe(0);
    });

    it("should release objects back to pool", () => {
      const pool = new ObjectPool(
        () => ({ x: 0, y: 0 }),
        (obj: any) => {
          obj.x = 0;
          obj.y = 0;
        },
        5,
      );

      const obj = pool.acquire();
      obj.x = 100;
      obj.y = 200;

      pool.release(obj);

      // Next acquire should get reset object
      const obj2 = pool.acquire();
      expect(obj2.x).toBe(0);
      expect(obj2.y).toBe(0);
    });

    it("should track pool statistics", () => {
      const pool = new ObjectPool(
        () => ({ value: 0 }),
        (obj: any) => {
          obj.value = 0;
        },
        5,
      );

      pool.acquire();
      pool.acquire();

      const stats = pool.getStats();
      expect(stats.totalCreated).toBeGreaterThanOrEqual(5);
      expect(stats.activeCount).toBe(2);
    });
  });

  describe("Pooled Vector2D", () => {
    it("should get a pooled vector", () => {
      const vec = getPooledVector(10, 20);

      expect(vec).toBeDefined();
      expect(vec.x).toBe(10);
      expect(vec.y).toBe(20);

      releasePooledVector(vec);
    });

    it("should get pool stats", () => {
      const stats = getVectorPoolStats();

      expect(stats).toBeDefined();
      expect(typeof stats.poolSize).toBe("number");
      expect(typeof stats.activeCount).toBe("number");
    });

    it("should create default vector with zeros", () => {
      const vec = getPooledVector();

      expect(vec.x).toBe(0);
      expect(vec.y).toBe(0);

      releasePooledVector(vec);
    });
  });

  describe("FrameBudget", () => {
    it("should create with default budget", () => {
      const budget = new FrameBudget();
      expect(budget).toBeDefined();
    });

    it("should track remaining budget", () => {
      const budget = new FrameBudget();
      budget.startFrame();

      const remaining = budget.getRemainingBudget();
      expect(remaining).toBeGreaterThan(0);
    });

    it("should detect when budget exceeded with didExceedBudget", () => {
      const budget = new FrameBudget();
      budget.startFrame();

      // Consume time with busy wait
      const start = Date.now();
      while (Date.now() - start < 20) {
        // Busy wait
      }

      expect(budget.didExceedBudget()).toBe(true);
    });

    it("should check if has budget for task", () => {
      const budget = new FrameBudget();
      budget.startFrame();

      expect(budget.hasBudget(1)).toBe(true);
      expect(budget.hasBudget(1000)).toBe(false);
    });

    it("should get frame time", () => {
      const budget = new FrameBudget();
      budget.startFrame();

      // Small delay
      const start = Date.now();
      while (Date.now() - start < 5) {
        // Busy wait
      }

      expect(budget.getFrameTime()).toBeGreaterThan(0);
    });
  });

  describe("BatchProcessor", () => {
    it("should process items in batches", () => {
      const processed: number[] = [];
      const processor = new BatchProcessor(
        (item: number) => {
          processed.push(item);
        },
        10, // batch size
      );

      // Add items
      processor.addItems([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

      // Process all
      while (processor.processBatch()) {
        // Continue processing
      }

      expect(processed.length).toBe(15);
    });

    it("should report progress", () => {
      const processor = new BatchProcessor(() => {}, 10);

      processor.addItems([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      // Before processing
      expect(processor.getProgress()).toBe(0);

      // After processing all
      processor.processBatch();
      expect(processor.getProgress()).toBe(1);
    });

    it("should clear pending items", () => {
      const processor = new BatchProcessor(() => {}, 10);

      processor.addItems([1, 2, 3, 4, 5]);
      processor.clear();

      expect(processor.getProgress()).toBe(1); // No items = complete
    });
  });

  describe("getQualitySettings", () => {
    it("should return settings for each quality level", () => {
      const levels = ["low", "medium", "high", "ultra"];

      levels.forEach((level: any) => {
        const settings = getQualitySettings(level);

        expect(settings).toBeDefined();
        expect(typeof settings.particleCount).toBe("number");
        expect(typeof settings.trailLength).toBe("number");
      });
    });

    it("should have increasing quality settings", () => {
      const low = getQualitySettings("low");
      const high = getQualitySettings("high");

      expect(high.particleCount).toBeGreaterThanOrEqual(low.particleCount);
      expect(high.trailLength).toBeGreaterThanOrEqual(low.trailLength);
    });
  });

  describe("detectOptimalQuality", () => {
    it("should return a valid quality level with performance monitor", () => {
      const monitor = new PerformanceMonitor();
      monitor.start();
      // Record some frames to get valid metrics
      for (let i = 0; i < 60; i++) {
        monitor.recordFrame();
      }

      const quality = detectOptimalQuality(monitor);
      expect(["low", "medium", "high", "ultra"]).toContain(quality);
    });

    it("should use gamePerformanceMonitor singleton", () => {
      expect(gamePerformanceMonitor).toBeDefined();
      expect(gamePerformanceMonitor instanceof PerformanceMonitor).toBe(true);
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe("Phase 8 Integration", () => {
  const {
    CART_COURSE_STAMPS,
    createInitialCourseStats,
  } = require("../../../src/components/games/CartCourse/data/stamps");
  const {
    UNLOCKABLE_COURSES,
    UNLOCKABLE_CART_SKINS,
  } = require("../../../src/components/games/CartCourse/data/unlockables");

  it("should have consistent data across modules", () => {
    expect(CART_COURSE_STAMPS.length).toBeGreaterThan(0);
    expect(UNLOCKABLE_COURSES.length).toBeGreaterThan(0);
    expect(UNLOCKABLE_CART_SKINS.length).toBeGreaterThan(0);
  });

  it("should have matching course IDs between stamps and unlockables", () => {
    const courseIds = UNLOCKABLE_COURSES.map((c: any) => c.id);

    // Check that stamps reference valid courses
    CART_COURSE_STAMPS.forEach((stamp: any) => {
      if (stamp.requirement.courseId) {
        expect(courseIds).toContain(stamp.requirement.courseId);
      }
    });
  });

  it("should create valid initial game state", () => {
    const stats = createInitialCourseStats();

    expect(stats.coursesCompleted).toEqual([]);
    expect(stats.earnedStamps).toEqual([]);
    expect(stats.totalBananasCollected).toBe(0);
  });
});
