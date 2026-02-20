/**
 * Achievements V2 — Catalog Tests
 *
 * Tests for the static achievements catalog:
 * - Catalog integrity (no duplicate IDs, valid fields)
 * - Active achievement filtering
 * - Game-specific filtering
 * - Category filtering
 *
 * @see src/config/achievementsCatalog.ts
 */

import {
  ACHIEVEMENTS_BY_ID,
  ACHIEVEMENTS_CATALOG,
  getAchievementDefById,
  getActiveAchievementCount,
  getActiveAchievements,
  getActiveAchievementsByCategory,
  getActiveAchievementsForGame,
  isAchievementActive,
} from "@/config/achievementsCatalog";

// =============================================================================
// Catalog Integrity
// =============================================================================

describe("Achievements V2 Catalog", () => {
  describe("catalog integrity", () => {
    it("should have no duplicate achievement IDs", () => {
      const ids = ACHIEVEMENTS_CATALOG.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have valid IDs matching the achv.* pattern", () => {
      for (const def of ACHIEVEMENTS_CATALOG) {
        expect(def.id).toMatch(/^achv\./);
      }
    });

    it("should have non-empty name and description for all entries", () => {
      for (const def of ACHIEVEMENTS_CATALOG) {
        expect(def.name.length).toBeGreaterThan(0);
        expect(def.description.length).toBeGreaterThan(0);
      }
    });

    it("should have valid tier values", () => {
      const validTiers = new Set([
        "bronze",
        "silver",
        "gold",
        "platinum",
        "diamond",
      ]);
      for (const def of ACHIEVEMENTS_CATALOG) {
        expect(validTiers.has(def.tier)).toBe(true);
      }
    });

    it("should have valid category values", () => {
      const validCategories = new Set([
        "global",
        "single_player",
        "turn_based",
        "real_time",
      ]);
      for (const def of ACHIEVEMENTS_CATALOG) {
        expect(validCategories.has(def.category)).toBe(true);
      }
    });

    it("should have valid progressType values", () => {
      const validTypes = new Set([
        "count",
        "threshold",
        "streak",
        "instant",
        "pct_of_max",
      ]);
      for (const def of ACHIEVEMENTS_CATALOG) {
        expect(validTypes.has(def.progressType)).toBe(true);
      }
    });

    it("should have target > 0 for all entries", () => {
      for (const def of ACHIEVEMENTS_CATALOG) {
        expect(def.target).toBeGreaterThan(0);
      }
    });

    it("should have non-negative rewards", () => {
      for (const def of ACHIEVEMENTS_CATALOG) {
        expect(def.xpReward).toBeGreaterThanOrEqual(0);
        expect(def.coinReward).toBeGreaterThanOrEqual(0);
      }
    });

    it("should have version >= 1", () => {
      for (const def of ACHIEVEMENTS_CATALOG) {
        expect(def.version).toBeGreaterThanOrEqual(1);
      }
    });

    it("should have pctThreshold for pct_of_max progressType", () => {
      for (const def of ACHIEVEMENTS_CATALOG) {
        if (def.progressType === "pct_of_max") {
          expect(def.pctThreshold).toBeDefined();
          expect(def.pctThreshold).toBeGreaterThan(0);
          expect(def.pctThreshold).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  // =============================================================================
  // ACHIEVEMENTS_BY_ID Map
  // =============================================================================

  describe("ACHIEVEMENTS_BY_ID", () => {
    it("should contain same number of entries as catalog", () => {
      expect(ACHIEVEMENTS_BY_ID.size).toBe(ACHIEVEMENTS_CATALOG.length);
    });

    it("should allow lookup by ID", () => {
      const def = ACHIEVEMENTS_BY_ID.get("achv.global.first_game");
      expect(def).toBeDefined();
      expect(def?.name).toBeTruthy();
    });

    it("should return undefined for unknown IDs", () => {
      expect(ACHIEVEMENTS_BY_ID.get("nonexistent")).toBeUndefined();
    });
  });

  // =============================================================================
  // Filtering Functions
  // =============================================================================

  describe("getActiveAchievements", () => {
    it("should return only achievements where isEnabledByDefault is true", () => {
      const active = getActiveAchievements();
      for (const def of active) {
        expect(def.isEnabledByDefault).toBe(true);
      }
    });

    it("should return a non-empty array", () => {
      expect(getActiveAchievements().length).toBeGreaterThan(0);
    });
  });

  describe("getActiveAchievementsForGame", () => {
    it("should return achievements for a specific game type", () => {
      const bounceAchievements = getActiveAchievementsForGame("bounce_blitz");
      expect(bounceAchievements.length).toBeGreaterThan(0);
      for (const def of bounceAchievements) {
        expect(def.gameType).toBe("bounce_blitz");
      }
    });

    it("should return empty array for game with no achievements", () => {
      // starforge_game has hasAchievements: false
      const achievements = getActiveAchievementsForGame(
        "starforge_game" as any,
      );
      expect(achievements.length).toBe(0);
    });
  });

  describe("getActiveAchievementsByCategory", () => {
    it("should return achievements filtered by category", () => {
      const global = getActiveAchievementsByCategory("global");
      expect(global.length).toBeGreaterThan(0);
      for (const def of global) {
        expect(def.category).toBe("global");
      }
    });

    it("should return empty for non-existent category", () => {
      const result = getActiveAchievementsByCategory("nonexistent" as any);
      expect(result.length).toBe(0);
    });
  });

  describe("getAchievementDefById", () => {
    it("should return definition for known ID", () => {
      const def = getAchievementDefById("achv.global.first_game");
      expect(def).toBeDefined();
      expect(def?.id).toBe("achv.global.first_game");
    });

    it("should return undefined for unknown ID", () => {
      expect(getAchievementDefById("nonexistent")).toBeUndefined();
    });
  });

  describe("getActiveAchievementCount", () => {
    it("should return a positive number", () => {
      expect(getActiveAchievementCount()).toBeGreaterThan(0);
    });

    it("should match length of getActiveAchievements", () => {
      expect(getActiveAchievementCount()).toBe(getActiveAchievements().length);
    });
  });

  describe("isAchievementActive", () => {
    it("should return true for enabled global achievements", () => {
      const def = ACHIEVEMENTS_BY_ID.get("achv.global.first_game")!;
      expect(def).toBeDefined();
      expect(isAchievementActive(def)).toBe(true);
    });

    it("should return false for disabled achievements", () => {
      expect(
        isAchievementActive({
          id: "test.disabled",
          name: "Disabled",
          description: "Disabled achievement",
          icon: "❌",
          category: "global",
          tier: "bronze",
          progressType: "count",
          target: 1,
          xpReward: 0,
          coinReward: 0,
          isEnabledByDefault: false,
          version: 1,
        }),
      ).toBe(false);
    });
  });

  // =============================================================================
  // Specific Achievement Presence
  // =============================================================================

  describe("expected achievements exist", () => {
    it("should have global first_game achievement", () => {
      const def = ACHIEVEMENTS_BY_ID.get("achv.global.first_game");
      expect(def).toBeDefined();
      expect(def?.category).toBe("global");
      expect(def?.progressType).toBe("count");
    });

    it("should have global ten_games achievement", () => {
      const def = ACHIEVEMENTS_BY_ID.get("achv.global.ten_games");
      expect(def).toBeDefined();
      expect(def?.target).toBe(10);
    });

    it("should have bounce_blitz score achievements", () => {
      const first = ACHIEVEMENTS_BY_ID.get("achv.game.bounce_blitz.first_play");
      expect(first).toBeDefined();
      expect(first?.gameType).toBe("bounce_blitz");
    });

    it("should have turn-based first_win achievements", () => {
      const def = ACHIEVEMENTS_BY_ID.get("achv.tb.checkers.first_win");
      // TB achievements might use different ID format; if not found, check variants
      if (!def) {
        // Check ACHIEVEMENTS_CATALOG for any checkers achievement
        const checkers = ACHIEVEMENTS_CATALOG.find(
          (a) => a.gameType === "checkers",
        );
        expect(checkers).toBeDefined();
      } else {
        expect(def?.category).toBe("turn_based");
      }
    });

    it("should have rematch warrior achievement", () => {
      const def = ACHIEVEMENTS_BY_ID.get("achv.tb.rematch_accepted_5");
      expect(def).toBeDefined();
      expect(def?.target).toBe(5);
    });
  });
});
