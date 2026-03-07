/**
 * Sketch Party — Settings Utilities Tests
 *
 * Tests for mergeSettings, computeTurnCount, and computeHintSchedule.
 */

import {
  computeHintSchedule,
  computeTurnCount,
  DEFAULT_SKETCH_PARTY_SETTINGS,
  mergeSettings,
} from "@/gamesV4/data/sketchPartySettings";

// =============================================================================
// mergeSettings
// =============================================================================

describe("mergeSettings", () => {
  const defaults = DEFAULT_SKETCH_PARTY_SETTINGS;

  it("returns defaults when session is null", () => {
    expect(mergeSettings(defaults, null)).toEqual(defaults);
  });

  it("returns defaults when session is undefined", () => {
    expect(mergeSettings(defaults, undefined)).toEqual(defaults);
  });

  it("returns defaults when session is empty object", () => {
    expect(mergeSettings(defaults, {})).toEqual(defaults);
  });

  it("merges valid numeric overrides", () => {
    const result = mergeSettings(defaults, { rounds: 5, drawTimeSec: 120 });
    expect(result.rounds).toBe(5);
    expect(result.drawTimeSec).toBe(120);
    // Unmentioned keys stay at default
    expect(result.maxPlayers).toBe(defaults.maxPlayers);
    expect(result.hints).toBe(defaults.hints);
  });

  it("clamps values above maximum", () => {
    const result = mergeSettings(defaults, {
      rounds: 99,
      drawTimeSec: 999,
      hints: 10,
      maxPlayers: 50,
      wordChoices: 20,
    });
    expect(result.rounds).toBe(10);
    expect(result.drawTimeSec).toBe(180);
    expect(result.hints).toBe(3);
    expect(result.maxPlayers).toBe(8);
    expect(result.wordChoices).toBe(5);
  });

  it("clamps values below minimum", () => {
    const result = mergeSettings(defaults, {
      rounds: 0,
      drawTimeSec: 1,
      hints: -1,
      maxPlayers: 0,
      wordChoices: -5,
      turnChooseTimeSec: 1,
    });
    expect(result.rounds).toBe(1);
    expect(result.drawTimeSec).toBe(30);
    expect(result.hints).toBe(0);
    expect(result.maxPlayers).toBe(2);
    expect(result.wordChoices).toBe(1);
    expect(result.turnChooseTimeSec).toBe(5);
  });

  it("coerces string numbers to integers", () => {
    const result = mergeSettings(defaults, {
      rounds: "5" as unknown,
      drawTimeSec: "120" as unknown,
    });
    expect(result.rounds).toBe(5);
    expect(result.drawTimeSec).toBe(120);
  });

  it("falls back to default for non-numeric junk values", () => {
    const result = mergeSettings(defaults, {
      rounds: "abc" as unknown,
      drawTimeSec: null as unknown,
      hints: undefined as unknown,
      wordChoices: {} as unknown,
    });
    expect(result.rounds).toBe(defaults.rounds);
    expect(result.drawTimeSec).toBe(defaults.drawTimeSec);
    expect(result.hints).toBe(defaults.hints);
    expect(result.wordChoices).toBe(defaults.wordChoices);
  });

  it("handles boolean customWordsEnabled correctly", () => {
    expect(
      mergeSettings(defaults, { customWordsEnabled: true }).customWordsEnabled,
    ).toBe(true);
    expect(
      mergeSettings(defaults, { customWordsEnabled: false }).customWordsEnabled,
    ).toBe(false);
    // Non-boolean falls back
    expect(
      mergeSettings(defaults, { customWordsEnabled: "yes" as unknown })
        .customWordsEnabled,
    ).toBe(defaults.customWordsEnabled);
  });

  it("truncates long customWordsList to 2000 chars", () => {
    const longList = "a".repeat(3000);
    const result = mergeSettings(defaults, { customWordsList: longList });
    expect(result.customWordsList.length).toBe(2000);
  });

  it("rounds fractional numbers", () => {
    const result = mergeSettings(defaults, { rounds: 3.7 });
    expect(result.rounds).toBe(4);
  });
});

// =============================================================================
// computeTurnCount
// =============================================================================

describe("computeTurnCount", () => {
  it("returns rounds × playerCount", () => {
    expect(computeTurnCount(3, 4)).toBe(12);
  });

  it("returns 0 for 0 rounds", () => {
    expect(computeTurnCount(0, 4)).toBe(0);
  });

  it("returns 0 for 0 players", () => {
    expect(computeTurnCount(3, 0)).toBe(0);
  });

  it("handles 1 round / 1 player", () => {
    expect(computeTurnCount(1, 1)).toBe(1);
  });
});

// =============================================================================
// computeHintSchedule
// =============================================================================

describe("computeHintSchedule", () => {
  it("returns empty array for hints=0", () => {
    expect(computeHintSchedule(80, 0)).toEqual([]);
  });

  it("returns empty array for negative hints", () => {
    expect(computeHintSchedule(80, -1)).toEqual([]);
  });

  it("returns 1 timestamp for hints=1", () => {
    const schedule = computeHintSchedule(80, 1);
    expect(schedule).toHaveLength(1);
    // 80s / 2 = 40s
    expect(schedule[0]).toBe(40000);
  });

  it("returns 2 evenly-spaced timestamps for hints=2", () => {
    const schedule = computeHintSchedule(90, 2);
    expect(schedule).toHaveLength(2);
    // 90s / 3 × 1 = 30s, 90s / 3 × 2 = 60s
    expect(schedule[0]).toBe(30000);
    expect(schedule[1]).toBe(60000);
  });

  it("returns 3 timestamps for hints=3", () => {
    const schedule = computeHintSchedule(80, 3);
    expect(schedule).toHaveLength(3);
    // 80s / 4 = 20s intervals
    expect(schedule[0]).toBe(20000);
    expect(schedule[1]).toBe(40000);
    expect(schedule[2]).toBe(60000);
  });

  it("all timestamps are between 0 and drawTimeMs", () => {
    const schedule = computeHintSchedule(80, 3);
    for (const t of schedule) {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(80000);
    }
  });
});
