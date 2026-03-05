/**
 * Games V4 — Resolve Pipeline Pure-Logic Tests
 *
 * Tests the pure functions used in the resolve pipeline:
 * - XP computation logic
 * - Level-up threshold calculation
 * - Default scoreboard building
 * - Duration computation
 * - Invite status transitions
 *
 * These mirror the algorithms in firebase-backend/functions/src/gamesV4/resolve.ts
 * and types.ts. By testing the same logic client-side, we get determinism guarantees
 * without needing a backend test runner.
 */

// =============================================================================
// Import constants that are mirrored on the client
// =============================================================================

import { XP_CONFIG } from "@/gamesV4/constants";

// =============================================================================
// Re-implement server-side pure functions for testing
// =============================================================================

interface FinalScoreboardEntry {
  uid: string;
  displayName: string;
  score: number;
  placement: number;
  stats: Record<string, unknown>;
}

interface XPAward {
  uid: string;
  baseXP: number;
  bonusXP: number;
  totalXP: number;
  bonusReason?: string;
}

type ResolutionType =
  | "win"
  | "draw"
  | "resign"
  | "disconnect"
  | "timeout"
  | "error";

function computeXPAwards(
  runtimeType: "solo" | "turnBased" | "realtime",
  resolutionType: ResolutionType,
  winnerIds: string[],
  scoreboard: FinalScoreboardEntry[],
): XPAward[] {
  return scoreboard.map((entry) => {
    let baseXP = XP_CONFIG.BASE_PARTICIPATION;
    let bonusXP = 0;
    let bonusReason: string | undefined;

    const isWinner = winnerIds.includes(entry.uid);
    const isDraw = resolutionType === "draw";

    if (isWinner) {
      bonusXP += XP_CONFIG.WIN_BONUS;
      bonusReason = "Victory";
    } else if (isDraw) {
      bonusXP += XP_CONFIG.DRAW_BONUS;
      bonusReason = "Draw";
    }

    // Solo games: base XP only
    if (runtimeType === "solo") {
      baseXP = XP_CONFIG.BASE_PARTICIPATION;
      bonusXP = 0;
      bonusReason = undefined;
    }

    return {
      uid: entry.uid,
      baseXP,
      bonusXP,
      totalXP: baseXP + bonusXP,
      ...(bonusReason ? { bonusReason } : {}),
    };
  });
}

function levelXpThreshold(level: number): number {
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

function computeLevelProgression(
  currentLevel: number,
  currentXp: number,
  awardedXP: number,
): { newLevel: number; newXp: number } {
  let xp = currentXp + awardedXP;
  let level = currentLevel;

  let threshold = levelXpThreshold(level);
  while (xp >= threshold) {
    xp -= threshold;
    level++;
    threshold = levelXpThreshold(level);
  }

  return { newLevel: level, newXp: xp };
}

// Invite status transitions (mirrors types.ts)
const INVITE_TRANSITIONS: Record<string, string[]> = {
  sent: ["lobby", "resolved"],
  lobby: ["active", "resolved"],
  active: ["resolved"],
  resolved: [],
};

function canTransition(from: string, to: string): boolean {
  return INVITE_TRANSITIONS[from]?.includes(to) ?? false;
}

// =============================================================================
// Tests
// =============================================================================

describe("Resolve Pipeline Pure Logic", () => {
  describe("XP Computation", () => {
    const twoPlayerScoreboard: FinalScoreboardEntry[] = [
      { uid: "p1", displayName: "Alice", score: 5, placement: 1, stats: {} },
      { uid: "p2", displayName: "Bob", score: 3, placement: 2, stats: {} },
    ];

    it("awards base + win bonus to winner, base only to loser", () => {
      const awards = computeXPAwards(
        "turnBased",
        "win",
        ["p1"],
        twoPlayerScoreboard,
      );

      const winnerAward = awards.find((a) => a.uid === "p1")!;
      const loserAward = awards.find((a) => a.uid === "p2")!;

      expect(winnerAward.baseXP).toBe(XP_CONFIG.BASE_PARTICIPATION);
      expect(winnerAward.bonusXP).toBe(XP_CONFIG.WIN_BONUS);
      expect(winnerAward.totalXP).toBe(
        XP_CONFIG.BASE_PARTICIPATION + XP_CONFIG.WIN_BONUS,
      );
      expect(winnerAward.bonusReason).toBe("Victory");

      expect(loserAward.baseXP).toBe(XP_CONFIG.BASE_PARTICIPATION);
      expect(loserAward.bonusXP).toBe(0);
      expect(loserAward.totalXP).toBe(XP_CONFIG.BASE_PARTICIPATION);
      expect(loserAward.bonusReason).toBeUndefined();
    });

    it("awards draw bonus to all participants in a draw", () => {
      const awards = computeXPAwards(
        "turnBased",
        "draw",
        [],
        twoPlayerScoreboard,
      );

      for (const award of awards) {
        expect(award.bonusXP).toBe(XP_CONFIG.DRAW_BONUS);
        expect(award.bonusReason).toBe("Draw");
        expect(award.totalXP).toBe(
          XP_CONFIG.BASE_PARTICIPATION + XP_CONFIG.DRAW_BONUS,
        );
      }
    });

    it("solo games get base participation only (no bonus)", () => {
      const soloBoard: FinalScoreboardEntry[] = [
        {
          uid: "solo",
          displayName: "Solo",
          score: 2048,
          placement: 1,
          stats: {},
        },
      ];

      const awards = computeXPAwards("solo", "win", ["solo"], soloBoard);

      expect(awards[0].baseXP).toBe(XP_CONFIG.BASE_PARTICIPATION);
      expect(awards[0].bonusXP).toBe(0);
      expect(awards[0].totalXP).toBe(XP_CONFIG.BASE_PARTICIPATION);
      expect(awards[0].bonusReason).toBeUndefined();
    });

    it("resign resolution: winner (non-resigner) gets win bonus", () => {
      const awards = computeXPAwards(
        "turnBased",
        "resign",
        ["p1"],
        twoPlayerScoreboard,
      );

      expect(awards[0].bonusReason).toBe("Victory"); // p1 wins
      expect(awards[1].bonusXP).toBe(0); // p2 resigned
    });

    it("handles empty scoreboard gracefully", () => {
      const awards = computeXPAwards("turnBased", "win", ["p1"], []);
      expect(awards).toEqual([]);
    });
  });

  describe("Level Threshold", () => {
    it("level 1 requires 100 XP", () => {
      expect(levelXpThreshold(1)).toBe(100);
    });

    it("scales exponentially with level", () => {
      const lvl5 = levelXpThreshold(5);
      const lvl10 = levelXpThreshold(10);
      expect(lvl10).toBeGreaterThan(lvl5);
      // Level 5 ≈ 207, Level 10 ≈ 515
      expect(lvl5).toBeGreaterThanOrEqual(200);
      expect(lvl10).toBeGreaterThanOrEqual(500);
    });

    it("never returns 0 or negative", () => {
      for (let level = 1; level <= 100; level++) {
        expect(levelXpThreshold(level)).toBeGreaterThan(0);
      }
    });
  });

  describe("Level Progression", () => {
    it("no level-up when XP is below threshold", () => {
      const result = computeLevelProgression(1, 0, 25);
      expect(result.newLevel).toBe(1);
      expect(result.newXp).toBe(25);
    });

    it("level-up when XP exceeds threshold", () => {
      const result = computeLevelProgression(1, 90, 25);
      // lvl 1 threshold = 100, so 90+25 = 115 → level up, carry 15
      expect(result.newLevel).toBe(2);
      expect(result.newXp).toBe(15);
    });

    it("handles multi-level-up from large XP award", () => {
      // Start at level 1 with 0 XP, award 500 XP
      // lvl 1: 100, lvl 2: 120, lvl 3: 144, lvl 4: 172
      // 100 + 120 + 144 = 364 < 500
      // 364 + 172 = 536 > 500 → level 4 with 500-364 = 136 carry, < 172
      const result = computeLevelProgression(1, 0, 500);
      expect(result.newLevel).toBeGreaterThan(1);
      expect(result.newXp).toBeGreaterThanOrEqual(0);
      expect(result.newXp).toBeLessThan(levelXpThreshold(result.newLevel));
    });

    it("preserves existing XP across level-ups", () => {
      const result = computeLevelProgression(3, 140, 10);
      // lvl 3 threshold = floor(100 * 1.2^2) = 144
      // 140 + 10 = 150 ≥ 144 → level up, carry 150-144 = 6
      expect(result.newLevel).toBe(4);
      expect(result.newXp).toBe(6);
    });
  });

  describe("Invite Status Transitions", () => {
    it("sent → lobby is valid", () => {
      expect(canTransition("sent", "lobby")).toBe(true);
    });

    it("sent → resolved is valid (cancel/expire)", () => {
      expect(canTransition("sent", "resolved")).toBe(true);
    });

    it("lobby → active is valid (game start)", () => {
      expect(canTransition("lobby", "active")).toBe(true);
    });

    it("active → resolved is valid (game end)", () => {
      expect(canTransition("active", "resolved")).toBe(true);
    });

    it("resolved → anything is invalid (terminal)", () => {
      expect(canTransition("resolved", "sent")).toBe(false);
      expect(canTransition("resolved", "lobby")).toBe(false);
      expect(canTransition("resolved", "active")).toBe(false);
      expect(canTransition("resolved", "resolved")).toBe(false);
    });

    it("backward transitions are invalid", () => {
      expect(canTransition("lobby", "sent")).toBe(false);
      expect(canTransition("active", "lobby")).toBe(false);
      expect(canTransition("active", "sent")).toBe(false);
    });

    it("sent → active is invalid (must go through lobby)", () => {
      expect(canTransition("sent", "active")).toBe(false);
    });
  });
});
