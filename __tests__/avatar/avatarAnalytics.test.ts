/**
 * Avatar Analytics Tests
 *
 * Tests for the avatar analytics service including
 * event tracking, session stats, and adoption metrics.
 */

import {
  avatarAnalytics,
  calculateAdoptionRate,
  getSessionSummary,
  trackAvatarEvent,
  trackAvatarFeatureChange,
  trackAvatarMigration,
  trackAvatarRender,
  trackCustomizerAction,
} from "@/services/avatarAnalytics";

// =============================================================================
// ANALYTICS SERVICE TESTS
// =============================================================================

describe("AvatarAnalyticsService", () => {
  beforeEach(() => {
    // Reset session stats before each test
    avatarAnalytics.resetSessionStats();
  });

  describe("track", () => {
    it("tracks events without throwing", () => {
      expect(() => {
        avatarAnalytics.track("avatar_rendered", { size: 100 });
      }).not.toThrow();
    });

    it("updates session stats for render events", () => {
      avatarAnalytics.track("avatar_rendered");
      avatarAnalytics.track("avatar_rendered");

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.avatarsRendered).toBe(2);
    });

    it("updates session stats for legacy render events", () => {
      avatarAnalytics.track("legacy_avatar_rendered");

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.legacyAvatarsRendered).toBe(1);
    });

    it("updates session stats for customizer events", () => {
      avatarAnalytics.track("customizer_opened");
      avatarAnalytics.track("customizer_opened");

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.customizerOpened).toBe(2);
    });

    it("updates session stats for feature changes", () => {
      avatarAnalytics.track("feature_changed");

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.featureChanges).toBe(1);
    });
  });

  describe("trackRender", () => {
    it("tracks digital avatar render", () => {
      avatarAnalytics.trackRender({
        isDigital: true,
        size: 100,
        showBody: false,
      });

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.avatarsRendered).toBe(1);
    });

    it("tracks legacy avatar render", () => {
      avatarAnalytics.trackRender({
        isDigital: false,
        size: 80,
      });

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.legacyAvatarsRendered).toBe(1);
    });

    it("accepts render time property", () => {
      expect(() => {
        avatarAnalytics.trackRender({
          isDigital: true,
          size: 100,
          renderTime: 15,
        });
      }).not.toThrow();
    });
  });

  describe("trackCustomizer", () => {
    it("tracks all customizer actions", () => {
      const actions: Array<
        "opened" | "closed" | "saved" | "cancelled" | "reset"
      > = ["opened", "closed", "saved", "cancelled", "reset"];

      actions.forEach((action) => {
        expect(() => {
          avatarAnalytics.trackCustomizer(action);
        }).not.toThrow();
      });
    });

    it("increments customizer opened count", () => {
      avatarAnalytics.trackCustomizer("opened");

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.customizerOpened).toBe(1);
    });
  });

  describe("trackFeatureChange", () => {
    it("tracks feature changes with properties", () => {
      expect(() => {
        avatarAnalytics.trackFeatureChange(
          "hair",
          "style",
          "hair_short_classic",
          "hair_long_wavy",
        );
      }).not.toThrow();

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.featureChanges).toBe(1);
    });
  });

  describe("trackMigration", () => {
    it("tracks all migration statuses", () => {
      const statuses: Array<"started" | "completed" | "skipped" | "failed"> = [
        "started",
        "completed",
        "skipped",
        "failed",
      ];

      statuses.forEach((status) => {
        expect(() => {
          avatarAnalytics.trackMigration(status);
        }).not.toThrow();
      });
    });

    it("accepts additional properties", () => {
      expect(() => {
        avatarAnalytics.trackMigration("completed", {
          legacyColor: "#FF6B6B",
          newSkinTone: "skin_06",
        });
      }).not.toThrow();
    });
  });

  describe("trackRolloutCheck", () => {
    it("tracks rollout checks", () => {
      expect(() => {
        avatarAnalytics.trackRolloutCheck("digital_avatar", true, "percentage");
        avatarAnalytics.trackRolloutCheck("digital_avatar", false, "disabled");
      }).not.toThrow();
    });
  });

  describe("trackRenderError", () => {
    it("tracks render errors", () => {
      const error = new Error("Test error");

      expect(() => {
        avatarAnalytics.trackRenderError(error, {
          component: "DigitalAvatar",
        });
      }).not.toThrow();
    });
  });

  describe("getSessionStats", () => {
    it("returns copy of stats", () => {
      avatarAnalytics.track("avatar_rendered");

      const stats1 = avatarAnalytics.getSessionStats();
      const stats2 = avatarAnalytics.getSessionStats();

      // Should be equal but not same reference
      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2);
    });
  });

  describe("resetSessionStats", () => {
    it("resets all stats to zero", () => {
      avatarAnalytics.track("avatar_rendered");
      avatarAnalytics.track("legacy_avatar_rendered");
      avatarAnalytics.track("customizer_opened");
      avatarAnalytics.track("feature_changed");

      avatarAnalytics.resetSessionStats();

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.avatarsRendered).toBe(0);
      expect(stats.legacyAvatarsRendered).toBe(0);
      expect(stats.customizerOpened).toBe(0);
      expect(stats.featureChanges).toBe(0);
    });
  });

  describe("flush", () => {
    it("does not throw when called", () => {
      avatarAnalytics.track("avatar_rendered");
      avatarAnalytics.track("avatar_rendered");

      expect(() => {
        avatarAnalytics.flush();
      }).not.toThrow();
    });

    it("can be called multiple times", () => {
      expect(() => {
        avatarAnalytics.flush();
        avatarAnalytics.flush();
        avatarAnalytics.flush();
      }).not.toThrow();
    });
  });
});

// =============================================================================
// CONVENIENCE FUNCTION TESTS
// =============================================================================

describe("Convenience Functions", () => {
  beforeEach(() => {
    avatarAnalytics.resetSessionStats();
  });

  describe("trackAvatarEvent", () => {
    it("delegates to analytics service", () => {
      trackAvatarEvent("avatar_rendered", { size: 100 });

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.avatarsRendered).toBe(1);
    });
  });

  describe("trackAvatarRender", () => {
    it("delegates to analytics service", () => {
      trackAvatarRender({ isDigital: true, size: 100 });

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.avatarsRendered).toBe(1);
    });
  });

  describe("trackCustomizerAction", () => {
    it("delegates to analytics service", () => {
      trackCustomizerAction("opened");

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.customizerOpened).toBe(1);
    });
  });

  describe("trackAvatarFeatureChange", () => {
    it("delegates to analytics service", () => {
      trackAvatarFeatureChange("hair", "color", "black", "blonde");

      const stats = avatarAnalytics.getSessionStats();
      expect(stats.featureChanges).toBe(1);
    });
  });

  describe("trackAvatarMigration", () => {
    it("does not throw for any status", () => {
      expect(() => {
        trackAvatarMigration("started");
        trackAvatarMigration("completed");
        trackAvatarMigration("skipped");
        trackAvatarMigration("failed");
      }).not.toThrow();
    });
  });
});

// =============================================================================
// METRICS HELPER TESTS
// =============================================================================

describe("Metrics Helpers", () => {
  describe("calculateAdoptionRate", () => {
    it("calculates correct adoption rate", () => {
      expect(calculateAdoptionRate(75, 25)).toBe(75);
      expect(calculateAdoptionRate(50, 50)).toBe(50);
      expect(calculateAdoptionRate(100, 0)).toBe(100);
      expect(calculateAdoptionRate(0, 100)).toBe(0);
    });

    it("returns 0 for zero total", () => {
      expect(calculateAdoptionRate(0, 0)).toBe(0);
    });

    it("rounds to nearest integer", () => {
      expect(calculateAdoptionRate(1, 2)).toBe(33); // 33.33...
      expect(calculateAdoptionRate(2, 1)).toBe(67); // 66.66...
    });
  });

  describe("getSessionSummary", () => {
    beforeEach(() => {
      avatarAnalytics.resetSessionStats();
    });

    it("returns stats and adoption rate", () => {
      avatarAnalytics.track("avatar_rendered");
      avatarAnalytics.track("avatar_rendered");
      avatarAnalytics.track("legacy_avatar_rendered");

      const summary = getSessionSummary();

      expect(summary.stats.avatarsRendered).toBe(2);
      expect(summary.stats.legacyAvatarsRendered).toBe(1);
      expect(summary.adoptionRate).toBe(67); // 2/3 ≈ 67%
    });

    it("handles zero renders", () => {
      const summary = getSessionSummary();

      expect(summary.stats.avatarsRendered).toBe(0);
      expect(summary.stats.legacyAvatarsRendered).toBe(0);
      expect(summary.adoptionRate).toBe(0);
    });
  });
});
