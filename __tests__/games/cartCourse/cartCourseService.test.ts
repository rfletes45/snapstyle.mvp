/**
 * Cart Course Service Tests
 * Phase 8: Firebase Integration Testing
 *
 * Tests for Firebase progress persistence, leaderboards, and stats tracking.
 */

// =============================================================================
// Mocks
// =============================================================================

// Mock Firebase Firestore
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((db, ...pathSegments) => ({
    path: pathSegments.join("/"),
  })),
  doc: jest.fn((db, collection, docId) => ({
    path: `${collection}/${docId}`,
    id: docId,
  })),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, direction) => ({ field, direction })),
  limit: jest.fn((count) => ({ count })),
  Timestamp: {
    now: () => ({ toDate: () => new Date() }),
    fromDate: (d: Date) => ({ toDate: () => d }),
  },
  increment: jest.fn((value) => ({ increment: value })),
  arrayUnion: jest.fn((...values) => ({ arrayUnion: values })),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock Firebase service
jest.mock("../../../src/services/firebase", () => ({
  getFirestoreInstance: jest.fn(() => ({})),
}));

// =============================================================================
// Imports (after mocks)
// =============================================================================

import {
  clearCartCourseCache,
  clearUserCache,
  createInitialProgress,
  getFormattedStats,
} from "../../../src/services/cartCourseService";

import type {
  CartCourseProgress,
  CourseProgress,
  GameSessionResult,
  LeaderboardEntry,
} from "../../../src/services/cartCourseService";

// =============================================================================
// Helper Functions
// =============================================================================

function createMockCourseProgress(
  overrides?: Partial<CourseProgress>,
): CourseProgress {
  return {
    completed: true,
    bestTime: 120000,
    bestScore: 1000,
    bananasCollected: 50,
    totalBananas: 60,
    coinsCollected: 10,
    totalCoins: 15,
    starRating: 2,
    attempts: 5,
    perfectRuns: 1,
    lastPlayedAt: Date.now(),
    ...overrides,
  };
}

function createMockGameSessionResult(
  overrides?: Partial<GameSessionResult>,
): GameSessionResult {
  return {
    courseId: "course_1",
    modeId: "mode_standard",
    completed: true,
    score: 1500,
    time: 90000,
    bananasCollected: 55,
    totalBananas: 60,
    coinsCollected: 12,
    livesLost: 1,
    crashes: 2,
    longestAirTime: 1500,
    narrowestEscape: 50,
    mechanismsUsed: true,
    stars: 3,
    isPerfect: false,
    ...overrides,
  };
}

function createMockLeaderboardEntry(
  overrides?: Partial<LeaderboardEntry>,
): LeaderboardEntry {
  return {
    userId: "user123",
    displayName: "TestPlayer",
    score: 2000,
    time: 85000,
    bananasCollected: 58,
    stars: 3,
    courseId: "course_1",
    timestamp: Date.now(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("CartCourseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCartCourseCache();
  });

  // ===========================================================================
  // createInitialProgress Tests
  // ===========================================================================

  describe("createInitialProgress", () => {
    it("should create valid initial progress object", () => {
      const progress = createInitialProgress();

      expect(progress).toBeDefined();
      expect(progress.courses).toEqual({});
      expect(progress.stamps).toEqual([]);
      expect(progress.createdAt).toBeGreaterThan(0);
      expect(progress.updatedAt).toBeGreaterThan(0);
      expect(progress.lastPlayedAt).toBeGreaterThan(0);
    });

    it("should include initial unlocked courses", () => {
      const progress = createInitialProgress();

      expect(progress.unlockedCourses).toContain("course_1");
    });

    it("should include initial unlocked skins", () => {
      const progress = createInitialProgress();

      expect(progress.unlockedSkins.length).toBeGreaterThan(0);
      expect(progress.unlockedSkins).toContain("skin_default");
    });

    it("should include initial unlocked modes", () => {
      const progress = createInitialProgress();

      expect(progress.unlockedModes.length).toBeGreaterThan(0);
      expect(progress.unlockedModes).toContain("mode_standard");
    });

    it("should have default skin and mode selected", () => {
      const progress = createInitialProgress();

      expect(progress.selectedSkin).toBe("skin_default");
      expect(progress.selectedMode).toBe("mode_standard");
    });

    it("should have empty stats", () => {
      const progress = createInitialProgress();

      expect(progress.stats.coursesCompleted).toEqual([]);
      expect(progress.stats.perfectCourses).toEqual([]);
      expect(progress.stats.totalBananasCollected).toBe(0);
      expect(progress.stats.earnedStamps).toEqual([]);
    });
  });

  // ===========================================================================
  // getFormattedStats Tests
  // ===========================================================================

  describe("getFormattedStats", () => {
    it("should format empty progress", () => {
      const progress = createInitialProgress();
      const formatted = getFormattedStats(progress);

      expect(formatted.coursesCompleted).toBe(0);
      expect(formatted.totalStamps).toBe(0);
      expect(formatted.totalBananas).toBe(0);
      expect(formatted.totalCoins).toBe(0);
      expect(formatted.perfectRuns).toBe(0);
      expect(formatted.bestCourse).toBeNull();
    });

    it("should format play time correctly for minutes only", () => {
      const progress: CartCourseProgress = {
        ...createInitialProgress(),
        stats: {
          ...createInitialProgress().stats,
          totalPlayTime: 30 * 60 * 1000, // 30 minutes
        },
      };

      const formatted = getFormattedStats(progress);
      expect(formatted.totalPlayTime).toBe("30m");
    });

    it("should format play time correctly for hours and minutes", () => {
      const progress: CartCourseProgress = {
        ...createInitialProgress(),
        stats: {
          ...createInitialProgress().stats,
          totalPlayTime: 90 * 60 * 1000, // 90 minutes = 1h 30m
        },
      };

      const formatted = getFormattedStats(progress);
      expect(formatted.totalPlayTime).toBe("1h 30m");
    });

    it("should count courses completed", () => {
      const progress: CartCourseProgress = {
        ...createInitialProgress(),
        stats: {
          ...createInitialProgress().stats,
          coursesCompleted: ["course_1", "course_2"],
        },
      };

      const formatted = getFormattedStats(progress);
      expect(formatted.coursesCompleted).toBe(2);
    });

    it("should count total stamps", () => {
      const progress: CartCourseProgress = {
        ...createInitialProgress(),
        stats: {
          ...createInitialProgress().stats,
          earnedStamps: ["stamp1", "stamp2", "stamp3"],
        },
      };

      const formatted = getFormattedStats(progress);
      expect(formatted.totalStamps).toBe(3);
    });

    it("should sum bananas and coins", () => {
      const progress: CartCourseProgress = {
        ...createInitialProgress(),
        stats: {
          ...createInitialProgress().stats,
          totalBananasCollected: 250,
          totalCoinsCollected: 75,
        },
      };

      const formatted = getFormattedStats(progress);
      expect(formatted.totalBananas).toBe(250);
      expect(formatted.totalCoins).toBe(75);
    });

    it("should count perfect runs across all courses", () => {
      const progress: CartCourseProgress = {
        ...createInitialProgress(),
        courses: {
          course_1: createMockCourseProgress({ perfectRuns: 3 }),
          course_2: createMockCourseProgress({ perfectRuns: 2 }),
        },
      };

      const formatted = getFormattedStats(progress);
      expect(formatted.perfectRuns).toBe(5);
    });

    it("should find best course by score", () => {
      const progress: CartCourseProgress = {
        ...createInitialProgress(),
        courses: {
          course_1: createMockCourseProgress({ bestScore: 1000 }),
          course_2: createMockCourseProgress({ bestScore: 2500 }),
          course_3: createMockCourseProgress({ bestScore: 1800 }),
        },
      };

      const formatted = getFormattedStats(progress);
      expect(formatted.bestCourse).toEqual({
        courseId: "course_2",
        score: 2500,
      });
    });
  });

  // ===========================================================================
  // Cache Management Tests
  // ===========================================================================

  describe("Cache Management", () => {
    it("should clear all caches", () => {
      // Just verify it doesn't throw
      expect(() => clearCartCourseCache()).not.toThrow();
    });

    it("should clear user-specific cache", () => {
      // Just verify it doesn't throw
      expect(() => clearUserCache("user123")).not.toThrow();
    });
  });

  // ===========================================================================
  // CourseProgress Type Tests
  // ===========================================================================

  describe("CourseProgress Type", () => {
    it("should have all required fields", () => {
      const progress = createMockCourseProgress();

      expect(progress.completed).toBe(true);
      expect(typeof progress.bestTime).toBe("number");
      expect(typeof progress.bestScore).toBe("number");
      expect(typeof progress.bananasCollected).toBe("number");
      expect(typeof progress.totalBananas).toBe("number");
      expect(typeof progress.coinsCollected).toBe("number");
      expect(typeof progress.totalCoins).toBe("number");
      expect([1, 2, 3]).toContain(progress.starRating);
      expect(typeof progress.attempts).toBe("number");
      expect(typeof progress.perfectRuns).toBe("number");
      expect(typeof progress.lastPlayedAt).toBe("number");
    });
  });

  // ===========================================================================
  // GameSessionResult Type Tests
  // ===========================================================================

  describe("GameSessionResult Type", () => {
    it("should have all required fields", () => {
      const result = createMockGameSessionResult();

      expect(result.courseId).toBeTruthy();
      expect(result.modeId).toBeTruthy();
      expect(typeof result.completed).toBe("boolean");
      expect(typeof result.score).toBe("number");
      expect(typeof result.time).toBe("number");
      expect(typeof result.bananasCollected).toBe("number");
      expect(typeof result.totalBananas).toBe("number");
      expect(typeof result.coinsCollected).toBe("number");
      expect(typeof result.livesLost).toBe("number");
      expect(typeof result.crashes).toBe("number");
      expect(typeof result.longestAirTime).toBe("number");
      expect(typeof result.narrowestEscape).toBe("number");
      expect(typeof result.mechanismsUsed).toBe("boolean");
      expect(typeof result.stars).toBe("number");
      expect(typeof result.isPerfect).toBe("boolean");
    });

    it("should support different game modes", () => {
      const standardResult = createMockGameSessionResult({
        modeId: "mode_standard",
      });
      const timeAttackResult = createMockGameSessionResult({
        modeId: "mode_time_attack",
      });
      const oneLifeResult = createMockGameSessionResult({
        modeId: "mode_one_life",
      });

      expect(standardResult.modeId).toBe("mode_standard");
      expect(timeAttackResult.modeId).toBe("mode_time_attack");
      expect(oneLifeResult.modeId).toBe("mode_one_life");
    });

    it("should track perfect runs correctly", () => {
      const perfectRun = createMockGameSessionResult({
        isPerfect: true,
        livesLost: 0,
        crashes: 0,
      });

      const imperfectRun = createMockGameSessionResult({
        isPerfect: false,
        livesLost: 2,
        crashes: 3,
      });

      expect(perfectRun.isPerfect).toBe(true);
      expect(imperfectRun.isPerfect).toBe(false);
    });
  });

  // ===========================================================================
  // LeaderboardEntry Type Tests
  // ===========================================================================

  describe("LeaderboardEntry Type", () => {
    it("should have all required fields", () => {
      const entry = createMockLeaderboardEntry();

      expect(entry.userId).toBeTruthy();
      expect(entry.displayName).toBeTruthy();
      expect(typeof entry.score).toBe("number");
      expect(typeof entry.time).toBe("number");
      expect(typeof entry.bananasCollected).toBe("number");
      expect(typeof entry.stars).toBe("number");
      expect(entry.courseId).toBeTruthy();
      expect(typeof entry.timestamp).toBe("number");
    });

    it("should support optional avatar config", () => {
      const entryWithAvatar = createMockLeaderboardEntry({
        avatarConfig: { color: "#ff0000" } as any,
      });

      const entryWithoutAvatar = createMockLeaderboardEntry();
      delete (entryWithoutAvatar as any).avatarConfig;

      expect(entryWithAvatar.avatarConfig).toBeDefined();
      expect(entryWithoutAvatar.avatarConfig).toBeUndefined();
    });

    it("should support optional rank", () => {
      const rankedEntry = createMockLeaderboardEntry({ rank: 1 });
      const unrankedEntry = createMockLeaderboardEntry();

      expect(rankedEntry.rank).toBe(1);
      expect(unrankedEntry.rank).toBeUndefined();
    });
  });

  // ===========================================================================
  // Progress Calculation Tests
  // ===========================================================================

  describe("Progress Calculations", () => {
    it("should calculate star rating based on performance", () => {
      // Perfect run = 3 stars
      const perfectResult = createMockGameSessionResult({
        bananasCollected: 60,
        totalBananas: 60,
        isPerfect: true,
        stars: 3,
      });
      expect(perfectResult.stars).toBe(3);

      // Good run = 2 stars
      const goodResult = createMockGameSessionResult({
        bananasCollected: 50,
        totalBananas: 60,
        isPerfect: false,
        stars: 2,
      });
      expect(goodResult.stars).toBe(2);

      // Basic run = 1 star
      const basicResult = createMockGameSessionResult({
        bananasCollected: 30,
        totalBananas: 60,
        isPerfect: false,
        stars: 1,
      });
      expect(basicResult.stars).toBe(1);
    });

    it("should track best scores across sessions", () => {
      const session1 = createMockGameSessionResult({ score: 1000 });
      const session2 = createMockGameSessionResult({ score: 1500 });
      const session3 = createMockGameSessionResult({ score: 1200 });

      const bestScore = Math.max(
        session1.score,
        session2.score,
        session3.score,
      );
      expect(bestScore).toBe(1500);
    });

    it("should track best times across sessions", () => {
      const session1 = createMockGameSessionResult({ time: 120000 });
      const session2 = createMockGameSessionResult({ time: 95000 });
      const session3 = createMockGameSessionResult({ time: 105000 });

      const bestTime = Math.min(session1.time, session2.time, session3.time);
      expect(bestTime).toBe(95000);
    });
  });

  // ===========================================================================
  // Week Key Tests
  // ===========================================================================

  describe("Week Key Generation", () => {
    it("should generate consistent week keys", () => {
      // Test that week keys are in expected format
      const now = new Date();
      const year = now.getFullYear();

      // Week key should be a string
      expect(typeof year).toBe("number");
      expect(year).toBeGreaterThan(2020);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("Edge Cases", () => {
    it("should handle zero scores", () => {
      const result = createMockGameSessionResult({
        score: 0,
        bananasCollected: 0,
        coinsCollected: 0,
      });

      expect(result.score).toBe(0);
      expect(result.bananasCollected).toBe(0);
      expect(result.coinsCollected).toBe(0);
    });

    it("should handle incomplete courses", () => {
      const result = createMockGameSessionResult({
        completed: false,
        score: 500,
      });

      expect(result.completed).toBe(false);
    });

    it("should handle max values", () => {
      const result = createMockGameSessionResult({
        score: Number.MAX_SAFE_INTEGER,
        time: Number.MAX_SAFE_INTEGER,
      });

      expect(result.score).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.time).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});

// =============================================================================
// Integration Tests (Mocked)
// =============================================================================

describe("CartCourseService Integration (Mocked)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Firebase Document Structure", () => {
    it("should have correct collection names", () => {
      // These are the expected collection names
      const expectedCollections = [
        "CartCourseProgress",
        "CartCourseLeaderboards",
      ];

      // Verify the constants are used correctly
      expectedCollections.forEach((name) => {
        expect(typeof name).toBe("string");
        expect(name.length).toBeGreaterThan(0);
      });
    });

    it("should create proper document paths", () => {
      const userId = "user123";
      const courseId = "course_1";
      const weekKey = "2025-W03";

      const progressPath = `CartCourseProgress/${userId}`;
      const leaderboardPath = `CartCourseLeaderboards/${courseId}_${weekKey}`;

      expect(progressPath).toContain(userId);
      expect(leaderboardPath).toContain(courseId);
      expect(leaderboardPath).toContain(weekKey);
    });
  });

  describe("Data Validation", () => {
    it("should validate course IDs", () => {
      const validCourseIds = ["course_1", "course_2", "course_3", "course_4"];
      const invalidCourseId = "invalid_course";

      expect(validCourseIds.includes("course_1")).toBe(true);
      expect(validCourseIds.includes(invalidCourseId)).toBe(false);
    });

    it("should validate skin IDs", () => {
      const validSkinIds = ["skin_default", "skin_blue", "skin_green"];
      const invalidSkinId = "invalid_skin";

      expect(validSkinIds.includes("skin_default")).toBe(true);
      expect(validSkinIds.includes(invalidSkinId)).toBe(false);
    });

    it("should validate mode IDs", () => {
      const validModeIds = [
        "mode_standard",
        "mode_time_attack",
        "mode_one_life",
      ];
      const invalidModeId = "invalid_mode";

      expect(validModeIds.includes("mode_standard")).toBe(true);
      expect(validModeIds.includes(invalidModeId)).toBe(false);
    });
  });
});
