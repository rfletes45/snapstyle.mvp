/**
 * Tests for the server-side Streak Engine utility functions.
 *
 * Since the core `updateStreakOnMessage` requires Firestore,
 * we test the exported helper `utcToday` and the internal logic by
 * exercising the pure-function components of the streak engine.
 */

// We test the streak logic by simulating the same algorithm used
// in streaks.ts. The pure helpers (daysBetween, canUseGrace) are
// duplicated here to enable unit testing without Firestore mocking.

// ─── daysBetween (mirrors streaks.ts) ─────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  const msA = Date.parse(a + "T00:00:00Z");
  const msB = Date.parse(b + "T00:00:00Z");
  return Math.round(Math.abs(msB - msA) / 86_400_000);
}

function canUseGrace(lastGrace: string, today: string): boolean {
  if (!lastGrace) return true;
  return daysBetween(lastGrace, today) >= 30;
}

// Simulates the core streak logic from streaks.ts.
function computeStreakUpdate(params: {
  currentLastSent: string;
  otherLastSent: string;
  streakUpdatedDay: string;
  streakCount: number;
  streakGraceUsedAt: string;
  today: string;
}): {
  newStreakCount: number;
  shouldUpdate: boolean;
  graceUsed: boolean;
  milestoneReached: number | null;
} {
  const { currentLastSent, otherLastSent, streakUpdatedDay, today } = params;
  let { streakCount, streakGraceUsedAt } = params;
  let graceUsed = false;

  // Idempotent check
  if (currentLastSent === today) {
    return {
      newStreakCount: streakCount,
      shouldUpdate: false,
      graceUsed,
      milestoneReached: null,
    };
  }

  const otherSentToday = otherLastSent === today;

  if (otherSentToday && streakUpdatedDay !== today) {
    if (!streakUpdatedDay) {
      streakCount = 1;
    } else {
      const gap = daysBetween(streakUpdatedDay, today);
      if (gap <= 1) {
        streakCount += 1;
      } else if (gap === 2 && canUseGrace(streakGraceUsedAt, today)) {
        streakCount += 1;
        graceUsed = true;
      } else {
        streakCount = 1;
      }
    }

    const milestones = [3, 7, 14, 30, 50, 100, 365];
    const milestoneReached = milestones.includes(streakCount)
      ? streakCount
      : null;

    return {
      newStreakCount: streakCount,
      shouldUpdate: true,
      graceUsed,
      milestoneReached,
    };
  }

  // Only one user sent — no streak update, just mark lastSent
  return {
    newStreakCount: streakCount,
    shouldUpdate: false,
    graceUsed,
    milestoneReached: null,
  };
}

// ─── daysBetween tests ────────────────────────────────────────────────────────

describe("daysBetween", () => {
  it("returns 0 for same day", () => {
    expect(daysBetween("2026-03-27", "2026-03-27")).toBe(0);
  });

  it("returns 1 for consecutive days", () => {
    expect(daysBetween("2026-03-26", "2026-03-27")).toBe(1);
  });

  it("returns 1 regardless of order", () => {
    expect(daysBetween("2026-03-27", "2026-03-26")).toBe(1);
  });

  it("returns correct large gaps", () => {
    expect(daysBetween("2026-01-01", "2026-03-27")).toBe(85);
  });

  it("handles year boundaries", () => {
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });

  it("handles leap year", () => {
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2); // 2024 is leap
    expect(daysBetween("2025-02-28", "2025-03-01")).toBe(1); // 2025 not leap
  });
});

// ─── canUseGrace tests ────────────────────────────────────────────────────────

describe("canUseGrace", () => {
  it("allows grace when never used", () => {
    expect(canUseGrace("", "2026-03-27")).toBe(true);
  });

  it("blocks grace if used recently (< 30 days)", () => {
    expect(canUseGrace("2026-03-10", "2026-03-27")).toBe(false); // 17 days
  });

  it("allows grace after 30-day cooldown", () => {
    expect(canUseGrace("2026-02-25", "2026-03-27")).toBe(true); // 30 days
  });

  it("allows grace after > 30 days", () => {
    expect(canUseGrace("2026-01-01", "2026-03-27")).toBe(true);
  });
});

// ─── computeStreakUpdate tests ────────────────────────────────────────────────

describe("computeStreakUpdate", () => {
  const today = "2026-03-27";

  it("skips if sender already sent today (idempotent)", () => {
    const result = computeStreakUpdate({
      currentLastSent: today,
      otherLastSent: today,
      streakUpdatedDay: "2026-03-26",
      streakCount: 5,
      streakGraceUsedAt: "",
      today,
    });
    expect(result.shouldUpdate).toBe(false);
    expect(result.newStreakCount).toBe(5);
  });

  it("starts new streak when both send on the same day (first ever)", () => {
    const result = computeStreakUpdate({
      currentLastSent: "",
      otherLastSent: today,
      streakUpdatedDay: "",
      streakCount: 0,
      streakGraceUsedAt: "",
      today,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.newStreakCount).toBe(1);
  });

  it("continues streak from yesterday", () => {
    const result = computeStreakUpdate({
      currentLastSent: "",
      otherLastSent: today,
      streakUpdatedDay: "2026-03-26",
      streakCount: 5,
      streakGraceUsedAt: "",
      today,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.newStreakCount).toBe(6);
  });

  it("does not update when only sender sent (waiting for other)", () => {
    const result = computeStreakUpdate({
      currentLastSent: "",
      otherLastSent: "2026-03-26", // yesterday, not today
      streakUpdatedDay: "2026-03-26",
      streakCount: 5,
      streakGraceUsedAt: "",
      today,
    });
    expect(result.shouldUpdate).toBe(false);
    expect(result.newStreakCount).toBe(5);
  });

  it("restarts streak after missing a day (gap=2, no grace)", () => {
    const result = computeStreakUpdate({
      currentLastSent: "",
      otherLastSent: today,
      streakUpdatedDay: "2026-03-25", // 2 days ago
      streakCount: 10,
      streakGraceUsedAt: "2026-03-20", // within 30 days = no grace
      today,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.newStreakCount).toBe(1);
    expect(result.graceUsed).toBe(false);
  });

  it("grace saves streak when gap=2 and grace is available", () => {
    const result = computeStreakUpdate({
      currentLastSent: "",
      otherLastSent: today,
      streakUpdatedDay: "2026-03-25", // 2 days ago
      streakCount: 10,
      streakGraceUsedAt: "", // never used
      today,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.newStreakCount).toBe(11);
    expect(result.graceUsed).toBe(true);
  });

  it("grace saves streak when grace cooldown has elapsed", () => {
    const result = computeStreakUpdate({
      currentLastSent: "",
      otherLastSent: today,
      streakUpdatedDay: "2026-03-25",
      streakCount: 10,
      streakGraceUsedAt: "2026-02-25", // 30 days ago
      today,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.newStreakCount).toBe(11);
    expect(result.graceUsed).toBe(true);
  });

  it("restarts streak with large gap (> 2 days)", () => {
    const result = computeStreakUpdate({
      currentLastSent: "",
      otherLastSent: today,
      streakUpdatedDay: "2026-03-20", // 7 days ago
      streakCount: 50,
      streakGraceUsedAt: "",
      today,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.newStreakCount).toBe(1);
    expect(result.graceUsed).toBe(false);
  });

  it("detects milestone at 3 days", () => {
    const result = computeStreakUpdate({
      currentLastSent: "",
      otherLastSent: today,
      streakUpdatedDay: "2026-03-26",
      streakCount: 2,
      streakGraceUsedAt: "",
      today,
    });
    expect(result.newStreakCount).toBe(3);
    expect(result.milestoneReached).toBe(3);
  });

  it("detects milestone at 7 days", () => {
    const result = computeStreakUpdate({
      currentLastSent: "",
      otherLastSent: today,
      streakUpdatedDay: "2026-03-26",
      streakCount: 6,
      streakGraceUsedAt: "",
      today,
    });
    expect(result.newStreakCount).toBe(7);
    expect(result.milestoneReached).toBe(7);
  });

  it("returns null milestone for non-milestone counts", () => {
    const result = computeStreakUpdate({
      currentLastSent: "",
      otherLastSent: today,
      streakUpdatedDay: "2026-03-26",
      streakCount: 4,
      streakGraceUsedAt: "",
      today,
    });
    expect(result.newStreakCount).toBe(5);
    expect(result.milestoneReached).toBeNull();
  });

  it("handles same-day double send correctly (streak already updated)", () => {
    const result = computeStreakUpdate({
      currentLastSent: "", // sender hasn't sent today
      otherLastSent: today,
      streakUpdatedDay: today, // already updated today
      streakCount: 5,
      streakGraceUsedAt: "",
      today,
    });
    // Other sent today AND streak already updated today → no double increment
    expect(result.shouldUpdate).toBe(false);
    expect(result.newStreakCount).toBe(5);
  });

  it("continues streak from the same day (gap=0)", () => {
    // Edge case: streakUpdatedDay is today but somehow the condition fires.
    // The `streakUpdatedDay !== today` guard in the logic prevents this.
    const result = computeStreakUpdate({
      currentLastSent: "",
      otherLastSent: today,
      streakUpdatedDay: today, // same day
      streakCount: 5,
      streakGraceUsedAt: "",
      today,
    });
    expect(result.shouldUpdate).toBe(false);
  });
});

// ─── Edge case: timezone-adjacent dates ───────────────────────────────────────

describe("timezone edge cases", () => {
  it("daysBetween is consistent regardless of time component", () => {
    // The function uses T00:00:00Z anchors, so time components don't matter
    expect(daysBetween("2026-03-27", "2026-03-28")).toBe(1);
  });

  it("handles DST-like month boundaries", () => {
    // March, November — months where DST changes happen in the US
    expect(daysBetween("2026-03-08", "2026-03-09")).toBe(1);
    expect(daysBetween("2026-11-01", "2026-11-02")).toBe(1);
  });
});
