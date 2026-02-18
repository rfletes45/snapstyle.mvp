/**
 * Validation Service Tests — score bounds checking
 */

import {
  getScoreBounds,
  validateScoreUpdate,
} from "../../src/services/validation";

describe("validateScoreUpdate", () => {
  it("should accept valid score for dot_match", () => {
    // 5 points in 1 second (max is 5/s * 1.5 buffer = 7.5/s)
    expect(validateScoreUpdate("dot_match", 5, 0, 1000)).toBe(true);
  });

  it("should reject negative scores", () => {
    expect(validateScoreUpdate("dot_match", -5, 0, 1000)).toBe(false);
  });

  it("should reject decreasing scores", () => {
    expect(validateScoreUpdate("dot_match", 5, 10, 1000)).toBe(false);
  });

  it("should reject non-integer scores", () => {
    expect(validateScoreUpdate("dot_match", 5.5, 0, 1000)).toBe(false);
  });

  it("should reject non-finite scores", () => {
    expect(validateScoreUpdate("dot_match", Infinity, 0, 1000)).toBe(false);
    expect(validateScoreUpdate("dot_match", NaN, 0, 1000)).toBe(false);
  });

  it("should reject scores exceeding max total", () => {
    expect(validateScoreUpdate("dot_match", 1000, 0, 60000)).toBe(false);
  });

  it("should reject scores exceeding max rate with buffer", () => {
    // dot_match max rate is 5/s * 1.5 buffer = 7.5/s
    // 8 in 1 second exceeds the buffer
    expect(validateScoreUpdate("dot_match", 8, 0, 1000)).toBe(false);
  });

  it("should accept scores within burst buffer", () => {
    // dot_match max rate is 5/s * 1.5 buffer = 7.5/s
    // 7 in 1 second is within the buffer
    expect(validateScoreUpdate("dot_match", 7, 0, 1000)).toBe(true);
  });

  it("should accept valid reaction score", () => {
    expect(validateScoreUpdate("reaction", 1, 0, 1000)).toBe(true);
  });

  it("should handle unknown game types gracefully", () => {
    expect(validateScoreUpdate("unknown_game", 50, 0, 1000)).toBe(true);
  });

  it("should handle very short elapsed times", () => {
    // elapsedMs gets clamped to min 100ms = 0.1s
    // 1 in 0.1s = 10/s, exceeds dot_match max of 7.5/s
    expect(validateScoreUpdate("dot_match", 1, 0, 10)).toBe(false);
  });
});

describe("getScoreBounds", () => {
  it("should return bounds for known game types", () => {
    const bounds = getScoreBounds("dot_match");
    expect(bounds).toBeDefined();
    expect(bounds!.maxPerSecond).toBe(5);
    expect(bounds!.maxTotal).toBe(999);
  });

  it("should return null for unknown game types", () => {
    expect(getScoreBounds("nonexistent")).toBeNull();
  });
});
