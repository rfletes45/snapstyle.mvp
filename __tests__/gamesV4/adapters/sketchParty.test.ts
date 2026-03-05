/**
 * Games V4 — Sketch Party Unit Tests
 *
 * Tests:
 * - Scoring logic (guesser & drawer points, time bonus, placements)
 * - Word bank (pickRandomWords, maskedWord, guess detection)
 * - Client adapter (initial state, computeOutcome, extractPerformanceMetrics, settings validation)
 * - Achievement evaluators
 */

import {
  computeDrawerGainPerGuesser,
  computeGuesserPoints,
  computePlacements,
  computeTimeBonus,
} from "@/gamesV4/data/sketchPartyScoring";
import {
  computeMaskedWord,
  isCorrectGuess,
  pickRandomWords,
} from "@/gamesV4/data/sketchPartyWords";

// Import adapter (auto-registers on import)
import { getAdapter } from "@/gamesV4/adapters/registry";
import "@/gamesV4/adapters/sketchParty";
import type { GameId } from "@/gamesV4/types/common";

// =============================================================================
// Scoring Tests
// =============================================================================

describe("Sketch Party Scoring", () => {
  describe("computeGuesserPoints", () => {
    it("awards maximum points for instant guess with no hints", () => {
      const pts = computeGuesserPoints(5, 0, 80, 0);
      // base(100+50) + timeBonus(120) - hintPenalty(0) = 270
      expect(pts).toBe(270);
    });

    it("awards fewer points for late guess", () => {
      const early = computeGuesserPoints(5, 5, 80, 0);
      const late = computeGuesserPoints(5, 70, 80, 0);
      expect(early).toBeGreaterThan(late);
    });

    it("penalizes points when hints are used", () => {
      const noHints = computeGuesserPoints(5, 20, 80, 0);
      const withHints = computeGuesserPoints(5, 20, 80, 2);
      expect(noHints).toBeGreaterThan(withHints);
    });

    it("awards more points for longer words", () => {
      const short = computeGuesserPoints(3, 20, 80, 0);
      const long = computeGuesserPoints(10, 20, 80, 0);
      expect(long).toBeGreaterThan(short);
    });

    it("returns at least the minimum points (50)", () => {
      // Very late guess with max hints
      const pts = computeGuesserPoints(3, 79, 80, 5);
      expect(pts).toBeGreaterThanOrEqual(50);
    });

    it("never returns NaN", () => {
      expect(computeGuesserPoints(0, 0, 80, 0)).not.toBeNaN();
      expect(computeGuesserPoints(5, 80, 80, 0)).not.toBeNaN();
    });
  });

  describe("computeTimeBonus", () => {
    it("returns max bonus for instant guess", () => {
      expect(computeTimeBonus(0, 80)).toBe(120);
    });

    it("returns 0 when time = drawTime", () => {
      expect(computeTimeBonus(80, 80)).toBe(0);
    });

    it("returns value between 0 and 120 for partial time", () => {
      const bonus = computeTimeBonus(40, 80);
      expect(bonus).toBeGreaterThan(0);
      expect(bonus).toBeLessThanOrEqual(120);
    });
  });

  describe("computeDrawerGainPerGuesser", () => {
    it("returns positive gain for positive time bonus", () => {
      const gain = computeDrawerGainPerGuesser(0.8);
      expect(gain).toBeGreaterThan(0);
    });

    it("returns minimum gain for zero time bonus", () => {
      const gain = computeDrawerGainPerGuesser(0);
      expect(gain).toBeGreaterThanOrEqual(10);
    });
  });

  describe("computePlacements", () => {
    it("returns correct placements sorted by score desc", () => {
      const players = [
        {
          uid: "alice",
          score: 300,
          firstCorrectCount: 1,
          avgCorrectTimeSec: 10,
        },
        { uid: "bob", score: 500, firstCorrectCount: 2, avgCorrectTimeSec: 8 },
        {
          uid: "carol",
          score: 100,
          firstCorrectCount: 0,
          avgCorrectTimeSec: 20,
        },
      ];
      const placements = computePlacements(players);
      expect(placements[0].uid).toBe("bob");
      expect(placements[0].placement).toBe(1);
      expect(placements[1].uid).toBe("alice");
      expect(placements[1].placement).toBe(2);
      expect(placements[2].uid).toBe("carol");
      expect(placements[2].placement).toBe(3);
    });

    it("breaks ties using firstCorrectCount", () => {
      const players = [
        {
          uid: "alice",
          score: 300,
          firstCorrectCount: 1,
          avgCorrectTimeSec: 10,
        },
        { uid: "bob", score: 300, firstCorrectCount: 3, avgCorrectTimeSec: 10 },
        {
          uid: "carol",
          score: 100,
          firstCorrectCount: 0,
          avgCorrectTimeSec: 20,
        },
      ];
      const placements = computePlacements(players);
      expect(placements[0].uid).toBe("bob");
      expect(placements[1].uid).toBe("alice");
    });

    it("returns empty array for empty input", () => {
      const placements = computePlacements([]);
      expect(placements).toEqual([]);
    });
  });
});

// =============================================================================
// Word Bank Tests
// =============================================================================

describe("Sketch Party Word Bank", () => {
  describe("pickRandomWords", () => {
    it("returns the requested number of words", () => {
      const words = pickRandomWords(3);
      expect(words).toHaveLength(3);
    });

    it("returns unique words", () => {
      const words = pickRandomWords(5);
      const unique = new Set(words);
      expect(unique.size).toBe(5);
    });

    it("avoids used words", () => {
      const used = new Set(["cat", "dog", "house"]);
      const words = pickRandomWords(3, used);
      for (const w of words) {
        expect(used.has(w)).toBe(false);
      }
    });
  });

  describe("computeMaskedWord", () => {
    it("returns all underscores with 0 hints", () => {
      const masked = computeMaskedWord("hello", 0);
      expect(masked).toBe("_ _ _ _ _");
    });

    it("reveals some letters with hints", () => {
      const masked = computeMaskedWord("hello", 2);
      // Should have fewer underscores than full mask
      const underscores = (masked.match(/_/g) || []).length;
      expect(underscores).toBeLessThan(5);
      expect(underscores).toBeGreaterThan(0);
    });

    it("preserves spaces", () => {
      const masked = computeMaskedWord("ice cream", 0);
      // Should have a space (not underscore) where the space is
      expect(masked).toContain("  ");
    });
  });

  describe("isCorrectGuess", () => {
    it("returns true for exact match", () => {
      expect(isCorrectGuess("hello", "hello")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(isCorrectGuess("HELLO", "hello")).toBe(true);
      expect(isCorrectGuess("Hello", "hello")).toBe(true);
    });

    it("trims whitespace", () => {
      expect(isCorrectGuess("  hello  ", "hello")).toBe(true);
    });

    it("returns false for wrong guess", () => {
      expect(isCorrectGuess("world", "hello")).toBe(false);
    });

    it("returns false for empty guess", () => {
      expect(isCorrectGuess("", "hello")).toBe(false);
    });
  });
});

// =============================================================================
// Adapter Tests
// =============================================================================

describe("Sketch Party Adapter", () => {
  const adapter = getAdapter("sketch_party_game" as GameId);

  it("is registered", () => {
    expect(adapter).not.toBeNull();
  });

  it("has correct metadata", () => {
    expect(adapter!.gameId).toBe("sketch_party_game");
    expect(adapter!.runtimeType).toBe("realtime");
    expect(adapter!.minPlayers).toBe(2);
    expect(adapter!.maxPlayers).toBe(8);
  });

  describe("createInitialPublicState", () => {
    const players = [
      { uid: "alice", slotIndex: 0 },
      { uid: "bob", slotIndex: 1 },
      { uid: "carol", slotIndex: 2 },
    ];

    it("creates state with all required fields", () => {
      const state = adapter!.createInitialPublicState(players, {});
      expect(state).toHaveProperty("currentRound", 1);
      expect(state).toHaveProperty("totalRounds");
      expect(state).toHaveProperty("turnOrder");
      expect(state).toHaveProperty("scores");
      expect(state).toHaveProperty("drawerId");
      expect(state).toHaveProperty("phase");
    });

    it("has all players in turn order", () => {
      const state = adapter!.createInitialPublicState(players, {});
      const turnOrder = state.turnOrder as string[];
      expect(turnOrder).toHaveLength(3);
      expect(turnOrder).toContain("alice");
      expect(turnOrder).toContain("bob");
      expect(turnOrder).toContain("carol");
    });

    it("initializes all scores to 0", () => {
      const state = adapter!.createInitialPublicState(players, {});
      const scores = state.scores as Record<string, number>;
      expect(scores.alice).toBe(0);
      expect(scores.bob).toBe(0);
      expect(scores.carol).toBe(0);
    });
  });

  describe("computeOutcome", () => {
    it("returns winner with highest score", () => {
      const state = {
        scores: { alice: 300, bob: 500, carol: 100 },
      };
      const players = [
        { uid: "alice", slotIndex: 0 },
        { uid: "bob", slotIndex: 1 },
        { uid: "carol", slotIndex: 2 },
      ];
      const outcome = adapter!.computeOutcome!(state, players);
      expect(outcome.winnerIds).toEqual(["bob"]);
      expect(outcome.finalScoreboard[0].uid).toBe("bob");
      expect(outcome.finalScoreboard[0].placement).toBe(1);
    });

    it("returns multiple winners on tie", () => {
      const state = {
        scores: { alice: 500, bob: 500, carol: 100 },
      };
      const players = [
        { uid: "alice", slotIndex: 0 },
        { uid: "bob", slotIndex: 1 },
        { uid: "carol", slotIndex: 2 },
      ];
      const outcome = adapter!.computeOutcome!(state, players);
      expect(outcome.winnerIds).toHaveLength(2);
      expect(outcome.winnerIds).toContain("alice");
      expect(outcome.winnerIds).toContain("bob");
    });

    it("returns no winners when all scores are 0", () => {
      const state = {
        scores: { alice: 0, bob: 0 },
      };
      const players = [
        { uid: "alice", slotIndex: 0 },
        { uid: "bob", slotIndex: 1 },
      ];
      const outcome = adapter!.computeOutcome!(state, players);
      expect(outcome.winnerIds).toEqual([]);
    });
  });

  describe("extractPerformanceMetrics", () => {
    it("returns scores snapshot and player count", () => {
      const state = {
        scores: { alice: 300, bob: 500 },
      };
      const players = [{ uid: "alice" }, { uid: "bob" }];
      const metrics = adapter!.extractPerformanceMetrics!(state, players);
      expect(metrics).toHaveProperty("scores");
      expect(metrics).toHaveProperty("playerCount", 2);
    });
  });

  describe("validateSettings", () => {
    it("clamps rounds within valid range", () => {
      const validated = adapter!.validateSettings!({ rounds: 20 });
      expect((validated as Record<string, number>).rounds).toBeLessThanOrEqual(
        10,
      );
    });

    it("clamps draw time within valid range", () => {
      const validated = adapter!.validateSettings!({ drawTimeSec: 300 });
      expect(
        (validated as Record<string, number>).drawTimeSec,
      ).toBeLessThanOrEqual(180);
    });
  });
});
