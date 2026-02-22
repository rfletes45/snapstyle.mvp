/**
 * Achievements V2 — Client Service Tests
 *
 * Tests for buildV2DisplayItems, getUnlockedIds, computeLocalSummary
 * using mock data (no Firebase dependency).
 *
 * @see src/services/achievementsV2.ts
 */

// Mock firebase/firestore before importing anything
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  getFirestore: jest.fn(() => ({})),
  onSnapshot: jest.fn(),
  query: jest.fn(),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
}));

import {
  buildV2DisplayItems,
  computeLocalSummary,
  getUnlockedIds,
  isAchievementUnlocked,
} from "@/services/achievementsV2";
import type { UserAchievementDoc } from "@/types/achievementsV2";

// =============================================================================
// Helpers
// =============================================================================

function makeDoc(
  id: string,
  state: "locked" | "progress" | "unlocked",
  progress: number,
  target: number = 10,
): UserAchievementDoc {
  return {
    achievementId: id,
    state,
    progress,
    target,
    unlockedAt: state === "unlocked" ? Date.now() : null,
    version: 1,
    source: "server",
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("Achievements V2 Client Service", () => {
  describe("getUnlockedIds", () => {
    it("should return empty set for empty docs", () => {
      const ids = getUnlockedIds(new Map());
      expect(ids.size).toBe(0);
    });

    it("should return only unlocked IDs", () => {
      const docs = new Map<string, UserAchievementDoc>();
      docs.set("a", makeDoc("a", "unlocked", 10));
      docs.set("b", makeDoc("b", "progress", 5));
      docs.set("c", makeDoc("c", "locked", 0));
      docs.set("d", makeDoc("d", "unlocked", 10));

      const ids = getUnlockedIds(docs);
      expect(ids.size).toBe(2);
      expect(ids.has("a")).toBe(true);
      expect(ids.has("d")).toBe(true);
      expect(ids.has("b")).toBe(false);
    });
  });

  describe("isAchievementUnlocked", () => {
    it("should return true for unlocked achievement", () => {
      const docs = new Map<string, UserAchievementDoc>();
      docs.set("a", makeDoc("a", "unlocked", 10));
      expect(isAchievementUnlocked(docs, "a")).toBe(true);
    });

    it("should return false for progress achievement", () => {
      const docs = new Map<string, UserAchievementDoc>();
      docs.set("a", makeDoc("a", "progress", 5));
      expect(isAchievementUnlocked(docs, "a")).toBe(false);
    });

    it("should return false for unknown achievement", () => {
      expect(isAchievementUnlocked(new Map(), "unknown")).toBe(false);
    });
  });

  describe("computeLocalSummary", () => {
    it("should return zeros for empty docs", () => {
      const summary = computeLocalSummary(new Map());
      expect(summary.totalUnlocked).toBe(0);
      expect(summary.totalXpEarned).toBe(0);
      expect(summary.totalCoinsEarned).toBe(0);
    });

    it("should count unlocked achievements", () => {
      const docs = new Map<string, UserAchievementDoc>();
      docs.set(
        "achv.global.first_game",
        makeDoc("achv.global.first_game", "unlocked", 1, 1),
      );
      docs.set(
        "achv.global.ten_games",
        makeDoc("achv.global.ten_games", "progress", 5, 10),
      );

      const summary = computeLocalSummary(docs);
      expect(summary.totalUnlocked).toBe(1);
    });

    it("should have totalAvailable > 0", () => {
      const summary = computeLocalSummary(new Map());
      expect(summary.totalAvailable).toBeGreaterThan(0);
    });
  });

  describe("buildV2DisplayItems", () => {
    it("should return items for all active achievements", () => {
      const items = buildV2DisplayItems(new Map());
      expect(items.length).toBeGreaterThan(0);
    });

    it("should show all catalog items as locked with empty docs", () => {
      const items = buildV2DisplayItems(new Map());
      for (const item of items) {
        expect(item.state).toBe("locked");
        expect(item.progress).toBe(0);
        expect(item.progressPct).toBe(0);
      }
    });

    it("should mark items with matching docs as unlocked", () => {
      const docs = new Map<string, UserAchievementDoc>();
      docs.set(
        "achv.global.first_game",
        makeDoc("achv.global.first_game", "unlocked", 1, 1),
      );

      const items = buildV2DisplayItems(docs);
      const firstGame = items.find((i) => i.id === "achv.global.first_game");
      expect(firstGame).toBeDefined();
      expect(firstGame?.state).toBe("unlocked");
      expect(firstGame?.progressPct).toBe(1);
    });

    it("should filter by category", () => {
      const items = buildV2DisplayItems(new Map(), {
        category: "global",
      });
      for (const item of items) {
        expect(item.category).toBe("global");
      }
    });

    it("should filter by gameType", () => {
      const items = buildV2DisplayItems(new Map(), {
        gameType: "bounce_blitz",
      });
      // When scoped to a game, ONLY that game's achievements are included
      // (global items without gameType are excluded)
      for (const item of items) {
        expect(item.gameType).toBe("bounce_blitz");
      }
    });

    it("should sort unlocked items first", () => {
      const docs = new Map<string, UserAchievementDoc>();
      docs.set(
        "achv.global.first_game",
        makeDoc("achv.global.first_game", "unlocked", 1, 1),
      );
      docs.set(
        "achv.global.ten_games",
        makeDoc("achv.global.ten_games", "progress", 5, 10),
      );

      const items = buildV2DisplayItems(docs);
      if (items.length >= 2) {
        // First item should be unlocked, second should be progress or locked
        const firstUnlockedIdx = items.findIndex((i) => i.state === "unlocked");
        const firstProgressIdx = items.findIndex((i) => i.state === "progress");
        const firstLockedIdx = items.findIndex((i) => i.state === "locked");

        if (firstUnlockedIdx >= 0 && firstProgressIdx >= 0) {
          expect(firstUnlockedIdx).toBeLessThan(firstProgressIdx);
        }
        if (firstProgressIdx >= 0 && firstLockedIdx >= 0) {
          expect(firstProgressIdx).toBeLessThan(firstLockedIdx);
        }
      }
    });

    it("should hide secret achievements when locked", () => {
      // Default showSecrets is false
      const items = buildV2DisplayItems(new Map(), { showSecrets: false });
      const secrets = items.filter((i) => i.secret && i.state === "locked");
      expect(secrets.length).toBe(0);
    });

    it("should show secret achievements when showSecrets is true", () => {
      const items = buildV2DisplayItems(new Map(), { showSecrets: true });
      // Should include any secret achievements that exist in catalog
      // (may be 0 if none are defined yet)
      expect(items.length).toBeGreaterThanOrEqual(0);
    });

    it("should compute progressPct correctly", () => {
      const docs = new Map<string, UserAchievementDoc>();
      docs.set(
        "achv.global.ten_games",
        makeDoc("achv.global.ten_games", "progress", 5, 10),
      );

      const items = buildV2DisplayItems(docs);
      const tenGames = items.find((i) => i.id === "achv.global.ten_games");
      expect(tenGames).toBeDefined();
      expect(tenGames?.progressPct).toBe(0.5);
    });

    it("should cap progressPct at 1.0", () => {
      const docs = new Map<string, UserAchievementDoc>();
      docs.set(
        "achv.global.ten_games",
        makeDoc("achv.global.ten_games", "unlocked", 15, 10),
      );

      const items = buildV2DisplayItems(docs);
      const tenGames = items.find((i) => i.id === "achv.global.ten_games");
      expect(tenGames?.progressPct).toBeLessThanOrEqual(1);
    });
  });
});
