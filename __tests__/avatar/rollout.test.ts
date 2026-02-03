/**
 * Rollout Utilities Tests
 *
 * Tests for the avatar system rollout utilities including
 * percentage-based rollout, beta user management, and feature checking.
 */

import {
  calculateBucketDistribution,
  DEFAULT_ROLLOUTS,
  estimateAffectedUsers,
  getRolloutStage,
  hashUserId,
  isFeatureEnabled,
  isUserInPercentage,
  ROLLOUT_STAGES,
  type RolloutConfig,
} from "@/utils/rollout";

// =============================================================================
// HASH FUNCTION TESTS
// =============================================================================

describe("hashUserId", () => {
  it("returns a number between 0-99", () => {
    const userIds = ["user1", "user2", "user3", "test-user-123"];

    for (const userId of userIds) {
      const hash = hashUserId(userId);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(100);
    }
  });

  it("returns consistent results for same input", () => {
    const userId = "test-user-123";
    const hash1 = hashUserId(userId);
    const hash2 = hashUserId(userId);
    const hash3 = hashUserId(userId);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it("uses salt for different bucket per feature", () => {
    const userId = "test-user-123";
    const hashFeature1 = hashUserId(userId, "feature_a");
    const hashFeature2 = hashUserId(userId, "feature_b");

    // Should produce different buckets (statistically unlikely to be same)
    // Note: This could theoretically fail but is extremely unlikely
    expect(hashFeature1).not.toBe(hashFeature2);
  });

  it("distributes users relatively evenly", () => {
    // Generate many user IDs and check distribution
    const userIds = Array.from({ length: 1000 }, (_, i) => `user_${i}`);
    const distribution = calculateBucketDistribution(userIds, "test_feature");

    // Calculate standard deviation - should be reasonably low
    const values = Object.values(distribution);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    // Standard deviation should be reasonable for uniform distribution
    // For 1000 users across 100 buckets, expected ~10 per bucket
    // stdDev should be roughly sqrt(10) ≈ 3.16
    expect(stdDev).toBeLessThan(10); // Allow some variance
  });
});

// =============================================================================
// PERCENTAGE ROLLOUT TESTS
// =============================================================================

describe("isUserInPercentage", () => {
  it("returns false for 0%", () => {
    const result = isUserInPercentage("any-user", 0, "feature");
    expect(result).toBe(false);
  });

  it("returns true for 100%", () => {
    const result = isUserInPercentage("any-user", 100, "feature");
    expect(result).toBe(true);
  });

  it("returns consistent results for same user", () => {
    const userId = "consistent-user";
    const percentage = 50;
    const feature = "test_feature";

    const result1 = isUserInPercentage(userId, percentage, feature);
    const result2 = isUserInPercentage(userId, percentage, feature);
    const result3 = isUserInPercentage(userId, percentage, feature);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it("respects percentage roughly correctly", () => {
    // Test with many users at 50%
    const userIds = Array.from({ length: 1000 }, (_, i) => `user_${i}`);
    const inRollout = userIds.filter((userId) =>
      isUserInPercentage(userId, 50, "test_feature"),
    );

    // Should be roughly 50% (allow 10% variance)
    const percentage = inRollout.length / userIds.length;
    expect(percentage).toBeGreaterThan(0.4);
    expect(percentage).toBeLessThan(0.6);
  });

  it("increasing percentage always includes previous users", () => {
    const userId = "test-user";
    const feature = "test_feature";

    // If user is in 10%, they should also be in 20%, 30%, etc.
    const in10 = isUserInPercentage(userId, 10, feature);

    if (in10) {
      expect(isUserInPercentage(userId, 20, feature)).toBe(true);
      expect(isUserInPercentage(userId, 50, feature)).toBe(true);
      expect(isUserInPercentage(userId, 100, feature)).toBe(true);
    }
  });
});

// =============================================================================
// FEATURE ENABLED TESTS
// =============================================================================

describe("isFeatureEnabled", () => {
  const mockConfig: RolloutConfig = {
    featureId: "test_feature",
    percentage: 50,
    betaUsers: ["beta-user-1", "beta-user-2"],
    excludedUsers: ["excluded-user"],
    disabled: false,
  };

  it("returns disabled reason when feature is disabled", () => {
    const disabledConfig = { ...mockConfig, disabled: true };
    const result = isFeatureEnabled("test", "user123", disabledConfig);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("disabled");
  });

  it("returns excluded reason for excluded users", () => {
    const result = isFeatureEnabled("test", "excluded-user", mockConfig);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("excluded");
  });

  it("returns enabled with beta reason for beta users", () => {
    const result = isFeatureEnabled("test", "beta-user-1", mockConfig);

    expect(result.enabled).toBe(true);
    expect(result.reason).toBe("beta");
  });

  it("checks percentage for regular users", () => {
    const result = isFeatureEnabled("test", "regular-user", mockConfig);

    expect(result.reason).toBe("percentage");
    // enabled could be true or false depending on hash
  });

  it("respects date range - before start date", () => {
    const futureConfig: RolloutConfig = {
      ...mockConfig,
      startDate: "2099-01-01",
    };
    const result = isFeatureEnabled("test", "user123", futureConfig);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("date");
  });

  it("respects date range - after end date", () => {
    const pastConfig: RolloutConfig = {
      ...mockConfig,
      endDate: "2020-01-01",
    };
    const result = isFeatureEnabled("test", "user123", pastConfig);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("date");
  });

  it("returns unknown for missing config", () => {
    const result = isFeatureEnabled("nonexistent_feature", "user123");

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("unknown");
  });

  it("uses default rollout configs", () => {
    // digital_avatar is in DEFAULT_ROLLOUTS
    const result = isFeatureEnabled("digital_avatar", "user123");

    // Should use the default config
    expect(result.reason).not.toBe("unknown");
  });
});

// =============================================================================
// ROLLOUT STAGE TESTS
// =============================================================================

describe("getRolloutStage", () => {
  it("returns disabled for 0%", () => {
    expect(getRolloutStage(0)).toBe("disabled");
  });

  it("returns beta for 5%", () => {
    expect(getRolloutStage(5)).toBe("beta");
  });

  it("returns canary for 10%", () => {
    expect(getRolloutStage(10)).toBe("canary");
  });

  it("returns gradual for 50%", () => {
    expect(getRolloutStage(50)).toBe("gradual");
  });

  it("returns general for 90%", () => {
    expect(getRolloutStage(90)).toBe("general");
  });

  it("returns full for 100%", () => {
    expect(getRolloutStage(100)).toBe("full");
  });

  it("handles edge cases", () => {
    expect(getRolloutStage(-1)).toBe("disabled");
    expect(getRolloutStage(1)).toBe("beta");
    expect(getRolloutStage(6)).toBe("canary");
    expect(getRolloutStage(51)).toBe("general");
    expect(getRolloutStage(91)).toBe("full");
  });
});

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe("estimateAffectedUsers", () => {
  it("calculates correct estimates", () => {
    expect(estimateAffectedUsers(1000, 10)).toBe(100);
    expect(estimateAffectedUsers(1000, 50)).toBe(500);
    expect(estimateAffectedUsers(1000, 100)).toBe(1000);
    expect(estimateAffectedUsers(1000, 0)).toBe(0);
  });

  it("rounds correctly", () => {
    expect(estimateAffectedUsers(1000, 33)).toBe(330);
    expect(estimateAffectedUsers(100, 33)).toBe(33);
  });
});

describe("calculateBucketDistribution", () => {
  it("returns distribution object with all buckets", () => {
    const userIds = ["user1", "user2", "user3"];
    const distribution = calculateBucketDistribution(userIds, "test");

    expect(Object.keys(distribution)).toHaveLength(100);
    expect(distribution[0]).toBeDefined();
    expect(distribution[99]).toBeDefined();
  });

  it("counts users correctly", () => {
    const userIds = ["user1", "user2", "user3"];
    const distribution = calculateBucketDistribution(userIds, "test");

    const totalUsers = Object.values(distribution).reduce((a, b) => a + b, 0);
    expect(totalUsers).toBe(3);
  });
});

// =============================================================================
// DEFAULT ROLLOUTS TESTS
// =============================================================================

describe("DEFAULT_ROLLOUTS", () => {
  it("has required features defined", () => {
    expect(DEFAULT_ROLLOUTS.digital_avatar).toBeDefined();
    expect(DEFAULT_ROLLOUTS.avatar_customizer).toBeDefined();
    expect(DEFAULT_ROLLOUTS.avatar_animations).toBeDefined();
  });

  it("digital_avatar starts at 0%", () => {
    expect(DEFAULT_ROLLOUTS.digital_avatar.percentage).toBe(0);
    expect(DEFAULT_ROLLOUTS.digital_avatar.disabled).toBe(false);
  });

  it("avatar_animations starts at 100%", () => {
    expect(DEFAULT_ROLLOUTS.avatar_animations.percentage).toBe(100);
  });
});

// =============================================================================
// ROLLOUT STAGES CONSTANTS TESTS
// =============================================================================

describe("ROLLOUT_STAGES", () => {
  it("has all stages defined", () => {
    expect(ROLLOUT_STAGES.disabled).toBeDefined();
    expect(ROLLOUT_STAGES.internal).toBeDefined();
    expect(ROLLOUT_STAGES.beta).toBeDefined();
    expect(ROLLOUT_STAGES.canary).toBeDefined();
    expect(ROLLOUT_STAGES.gradual).toBeDefined();
    expect(ROLLOUT_STAGES.general).toBeDefined();
    expect(ROLLOUT_STAGES.full).toBeDefined();
  });

  it("has correct percentages", () => {
    expect(ROLLOUT_STAGES.disabled.percentage).toBe(0);
    expect(ROLLOUT_STAGES.internal.percentage).toBe(0);
    expect(ROLLOUT_STAGES.beta.percentage).toBe(5);
    expect(ROLLOUT_STAGES.canary.percentage).toBe(10);
    expect(ROLLOUT_STAGES.gradual.percentage).toBe(50);
    expect(ROLLOUT_STAGES.general.percentage).toBe(90);
    expect(ROLLOUT_STAGES.full.percentage).toBe(100);
  });

  it("has descriptions for all stages", () => {
    Object.values(ROLLOUT_STAGES).forEach((stage) => {
      expect(stage.description).toBeTruthy();
      expect(stage.description.length).toBeGreaterThan(0);
    });
  });
});
