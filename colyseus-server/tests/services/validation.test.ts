/**
 * Validation Service Tests — score bounds checking
 */

import {
  getScoreBounds,
  validateScoreUpdate,
} from "../../src/services/validation";

describe("validateScoreUpdate", () => {
  it("should accept valid score for tap_race", () => {
    // 10 taps in 1 second (max is 15/s * 1.5 buffer = 22.5/s)
    expect(validateScoreUpdate("tap_race", 10, 0, 1000)).toBe(true);
  });

  it("should reject negative scores", () => {
    expect(validateScoreUpdate("tap_race", -5, 0, 1000)).toBe(false);
  });

  it("should reject decreasing scores", () => {
    expect(validateScoreUpdate("tap_race", 5, 10, 1000)).toBe(false);
  });

  it("should reject non-integer scores", () => {
    expect(validateScoreUpdate("tap_race", 5.5, 0, 1000)).toBe(false);
  });

  it("should reject non-finite scores", () => {
    expect(validateScoreUpdate("tap_race", Infinity, 0, 1000)).toBe(false);
    expect(validateScoreUpdate("tap_race", NaN, 0, 1000)).toBe(false);
  });

  it("should reject scores exceeding max total", () => {
    expect(validateScoreUpdate("tap_race", 1000, 0, 60000)).toBe(false);
  });

  it("should reject scores exceeding max rate with buffer", () => {
    // tap_race max rate is 15/s * 1.5 buffer = 22.5/s
    // 25 in 1 second exceeds the buffer
    expect(validateScoreUpdate("tap_race", 25, 0, 1000)).toBe(false);
  });

  it("should accept scores within burst buffer", () => {
    // tap_race max rate is 15/s * 1.5 buffer = 22.5/s
    // 20 in 1 second is within the buffer
    expect(validateScoreUpdate("tap_race", 20, 0, 1000)).toBe(true);
  });

  it("should accept valid reaction score", () => {
    expect(validateScoreUpdate("reaction", 1, 0, 1000)).toBe(true);
  });

  it("should handle unknown game types gracefully", () => {
    expect(validateScoreUpdate("unknown_game", 50, 0, 1000)).toBe(true);
  });

  it("should handle very short elapsed times", () => {
    // elapsedMs gets clamped to min 100ms = 0.1s
    // 5 in 0.1s = 50/s, exceeds tap_race max of 22.5/s
    expect(validateScoreUpdate("tap_race", 5, 0, 10)).toBe(false);
  });
});

describe("getScoreBounds", () => {
  it("should return bounds for known game types", () => {
    const bounds = getScoreBounds("tap_race");
    expect(bounds).toBeDefined();
    expect(bounds!.maxPerSecond).toBe(15);
    expect(bounds!.maxTotal).toBe(999);
  });

  it("should return null for unknown game types", () => {
    expect(getScoreBounds("nonexistent")).toBeNull();
  });
});
