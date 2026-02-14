/**
 * Golf Duels — Match Rules Tests
 */

import {
  evaluateMatch,
  getNextHoleTier,
  isStrokeCapped,
  resolveForfeit,
  resolveHole,
} from "../src/matchRules";
import { MATCH_RULES } from "../src/types";

describe("Match Rules", () => {
  describe("resolveHole", () => {
    it("p1 wins with fewer strokes", () => {
      expect(resolveHole(2, 4)).toBe("p1");
    });

    it("p2 wins with fewer strokes", () => {
      expect(resolveHole(5, 3)).toBe("p2");
    });

    it("tie on equal strokes", () => {
      expect(resolveHole(3, 3)).toBe("tie");
    });
  });

  describe("evaluateMatch", () => {
    it("not finished before 5 holes", () => {
      const result = evaluateMatch(3, 0, 3);
      expect(result.finished).toBe(false);
      expect(result.holesPlayed).toBe(3);
    });

    it("not finished at 5 holes with lead of 1", () => {
      const result = evaluateMatch(3, 2, 5);
      expect(result.finished).toBe(false);
      expect(result.holeLead).toBe(1);
    });

    it("p1 wins at 5 holes with lead of 2", () => {
      const result = evaluateMatch(4, 1, 5);
      expect(result.finished).toBe(true);
      expect(result.winner).toBe("p1");
      expect(result.winReason).toBe("up_by_2");
    });

    it("p2 wins at 5 holes with lead of 2", () => {
      const result = evaluateMatch(1, 4, 5);
      expect(result.finished).toBe(true);
      expect(result.winner).toBe("p2");
    });

    it("p1 wins in overtime with lead of 2", () => {
      const result = evaluateMatch(5, 3, 7);
      expect(result.finished).toBe(true);
      expect(result.winner).toBe("p1");
      expect(result.isOvertime).toBe(true);
      expect(result.winReason).toBe("up_by_2");
    });

    it("forces finish at max holes cap with p1 leading", () => {
      const result = evaluateMatch(6, 5, MATCH_RULES.MAX_TOTAL_HOLES);
      expect(result.finished).toBe(true);
      expect(result.winner).toBe("p1");
      expect(result.winReason).toBe("max_holes");
    });

    it("draw at max holes cap", () => {
      const result = evaluateMatch(5, 5, MATCH_RULES.MAX_TOTAL_HOLES);
      expect(result.finished).toBe(true);
      expect(result.winner).toBeNull();
      expect(result.winReason).toBe("max_holes");
    });

    it("continues to overtime when tied at 5", () => {
      const result = evaluateMatch(2, 2, 5);
      expect(result.finished).toBe(false);
      expect(result.isOvertime).toBe(false);
    });

    it("overtime starts after hole 5", () => {
      const result = evaluateMatch(3, 3, 6);
      expect(result.finished).toBe(false);
      expect(result.isOvertime).toBe(true);
    });
  });

  describe("getNextHoleTier", () => {
    it("returns tiers 1-5 for holes 0-4", () => {
      expect(getNextHoleTier(0)).toBe(1);
      expect(getNextHoleTier(1)).toBe(2);
      expect(getNextHoleTier(2)).toBe(3);
      expect(getNextHoleTier(3)).toBe(4);
      expect(getNextHoleTier(4)).toBe(5);
    });

    it("returns tier 6 for overtime holes", () => {
      expect(getNextHoleTier(5)).toBe(6);
      expect(getNextHoleTier(6)).toBe(6);
      expect(getNextHoleTier(10)).toBe(6);
    });
  });

  describe("isStrokeCapped", () => {
    it("not capped below max", () => {
      expect(isStrokeCapped(7)).toBe(false);
    });

    it("capped at max", () => {
      expect(isStrokeCapped(MATCH_RULES.MAX_STROKES_PER_HOLE)).toBe(true);
    });

    it("capped above max", () => {
      expect(isStrokeCapped(MATCH_RULES.MAX_STROKES_PER_HOLE + 1)).toBe(true);
    });
  });

  describe("resolveForfeit", () => {
    it("p2 wins when p1 forfeits", () => {
      const result = resolveForfeit("p1", 2, 1, 3);
      expect(result.finished).toBe(true);
      expect(result.winner).toBe("p2");
      expect(result.winReason).toBe("forfeit");
    });

    it("p1 wins when p2 forfeits", () => {
      const result = resolveForfeit("p2", 1, 3, 7);
      expect(result.finished).toBe(true);
      expect(result.winner).toBe("p1");
      expect(result.isOvertime).toBe(true);
    });
  });
});
