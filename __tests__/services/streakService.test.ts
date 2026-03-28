/**
 * Tests for the Streak Display Helpers (client read-only module).
 *
 * The server-side streak engine is tested separately; this file covers
 * the pure display/status utilities exposed to the UI.
 */

import {
  MILESTONES,
  MILESTONE_MESSAGES,
  deriveStreakStatus,
  isMilestone,
  milestoneRewardId,
  nextMilestone,
} from "@/services/streakCosmetics";

// ─── nextMilestone ────────────────────────────────────────────────────────────

describe("nextMilestone", () => {
  it("returns 3 for count 0", () => {
    expect(nextMilestone(0)).toBe(3);
  });

  it("returns 7 for count 3", () => {
    expect(nextMilestone(3)).toBe(7);
  });

  it("returns 14 for count 10", () => {
    expect(nextMilestone(10)).toBe(14);
  });

  it("returns 365 for count 100", () => {
    expect(nextMilestone(100)).toBe(365);
  });

  it("returns null when past max milestone", () => {
    expect(nextMilestone(365)).toBeNull();
    expect(nextMilestone(999)).toBeNull();
  });
});

// ─── isMilestone ──────────────────────────────────────────────────────────────

describe("isMilestone", () => {
  it("returns true for all defined milestones", () => {
    for (const m of MILESTONES) {
      expect(isMilestone(m)).toBe(true);
    }
  });

  it("returns false for non-milestone counts", () => {
    expect(isMilestone(0)).toBe(false);
    expect(isMilestone(1)).toBe(false);
    expect(isMilestone(10)).toBe(false);
    expect(isMilestone(99)).toBe(false);
  });
});

// ─── milestoneRewardId ────────────────────────────────────────────────────────

describe("milestoneRewardId", () => {
  it("returns a cosmetic id for known milestones", () => {
    expect(milestoneRewardId(3)).toBe("hat_flame");
    expect(milestoneRewardId(7)).toBe("glasses_cool");
    expect(milestoneRewardId(100)).toBe("bg_rainbow");
  });

  it("returns null for non-milestone values", () => {
    expect(milestoneRewardId(0)).toBeNull();
    expect(milestoneRewardId(10)).toBeNull();
  });
});

// ─── MILESTONE_MESSAGES ───────────────────────────────────────────────────────

describe("MILESTONE_MESSAGES", () => {
  it("has a message for every milestone", () => {
    for (const m of MILESTONES) {
      expect(MILESTONE_MESSAGES[m]).toBeDefined();
      expect(typeof MILESTONE_MESSAGES[m]).toBe("string");
    }
  });
});

// ─── deriveStreakStatus ───────────────────────────────────────────────────────

describe("deriveStreakStatus", () => {
  // Mock the current date for deterministic tests.
  const realDateNow = Date.now;
  const MOCK_NOW = Date.parse("2026-03-27T12:00:00Z"); // midday UTC

  beforeAll(() => {
    jest.spyOn(Date, "now").mockReturnValue(MOCK_NOW);

    // Also mock new Date().toISOString() for the `today` derivation inside the function.
    const OrigDate = global.Date;
    const mockDate = class extends OrigDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(MOCK_NOW);
        } else {
          // @ts-ignore
          super(...args);
        }
      }
    } as any;
    mockDate.now = () => MOCK_NOW;
    mockDate.parse = OrigDate.parse;
    mockDate.UTC = OrigDate.UTC;
    global.Date = mockDate;
  });

  afterAll(() => {
    Date.now = realDateNow;
    // Restore Date is tricky; rely on jest teardown.
  });

  it('returns "none" for zero/negative streak counts', () => {
    expect(deriveStreakStatus(0, "", "", "")).toEqual({
      status: "none",
      displayCount: 0,
    });
    expect(deriveStreakStatus(-1, "2026-03-27", "", "")).toEqual({
      status: "none",
      displayCount: 0,
    });
  });

  it('returns "active" when streakUpdatedDay is today', () => {
    expect(
      deriveStreakStatus(5, "2026-03-27", "2026-03-27", "2026-03-27"),
    ).toEqual({
      status: "active",
      displayCount: 5,
    });
  });

  it('returns "active" when gap=1 and both sent today', () => {
    // Updated yesterday, both already sent today → active
    expect(
      deriveStreakStatus(5, "2026-03-26", "2026-03-27", "2026-03-27"),
    ).toEqual({
      status: "active",
      displayCount: 5,
    });
  });

  it('returns "at_risk" when gap=1 and only one sent today', () => {
    expect(deriveStreakStatus(5, "2026-03-26", "2026-03-27", "")).toEqual({
      status: "at_risk",
      displayCount: 5,
    });
    expect(deriveStreakStatus(5, "2026-03-26", "", "2026-03-27")).toEqual({
      status: "at_risk",
      displayCount: 5,
    });
  });

  it('returns "at_risk" when gap=1 and neither sent today', () => {
    expect(deriveStreakStatus(5, "2026-03-26", "", "")).toEqual({
      status: "at_risk",
      displayCount: 5,
    });
  });

  it('returns "at_risk" when gap=2 (possible grace save)', () => {
    expect(deriveStreakStatus(5, "2026-03-25", "", "")).toEqual({
      status: "at_risk",
      displayCount: 5,
    });
  });

  it('returns "expired" when gap >= 3', () => {
    expect(deriveStreakStatus(5, "2026-03-24", "", "")).toEqual({
      status: "expired",
      displayCount: 0,
    });
    expect(deriveStreakStatus(100, "2026-01-01", "", "")).toEqual({
      status: "expired",
      displayCount: 0,
    });
  });
});
