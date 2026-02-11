/**
 * Tests for shouldUseColyseus, getGameCategory, and isColyseusEnabled helpers.
 *
 * Verifies:
 * - Smart switch routes physics games to Colyseus
 * - Smart switch routes turn-based games based on feature flags
 * - Feature flag gating works per category
 */

// We need to mock the featureFlags module that colyseus.ts imports.
// src/config/colyseus.ts uses: import { COLYSEUS_FEATURES } from "@/constants/featureFlags"
// Jest resolves @/constants/* → constants/* (root), so the mock path must match.

// We'll test the pure functions by requiring them after mocking.

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (opts: any) => opts.ios ?? opts.default },
}));

// Instead of mocking featureFlags, we test the logic directly by
// importing functions that read the mutable COLYSEUS_FEATURES object.
// We'll use jest.isolateModules to get fresh imports with controlled flags.

describe("Colyseus config helpers", () => {
  // We'll dynamically require the functions to work around the mock path issue
  let shouldUseColyseus: (gameType: string) => boolean;
  let getGameCategory: (gameType: string) => string | null;
  let isColyseusEnabled: (gameType: string) => boolean;
  let COLYSEUS_FEATURES: Record<string, any>;

  beforeEach(() => {
    jest.resetModules();
    // Set up a mutable feature flags object
    jest.doMock("../../constants/featureFlags", () => {
      const flags = {
        COLYSEUS_ENABLED: true,
        QUICKPLAY_ENABLED: true,
        TURNBASED_ENABLED: true,
        COMPLEX_TURNBASED_ENABLED: true,
        PHYSICS_ENABLED: true,
        COOP_ENABLED: true,
        MATCHMAKING_ENABLED: false,
        RANKED_ENABLED: false,
        SPECTATOR_ENABLED: false,
      };
      return { __esModule: true, COLYSEUS_FEATURES: flags };
    });

    // Require fresh module
    const colyseus = require("../../src/config/colyseus");
    shouldUseColyseus = colyseus.shouldUseColyseus;
    getGameCategory = colyseus.getGameCategory;
    isColyseusEnabled = colyseus.isColyseusEnabled;

    // Get the mutable mock so tests can toggle flags
    COLYSEUS_FEATURES =
      require("../../constants/featureFlags").COLYSEUS_FEATURES;
  });

  // ===========================================================================
  // shouldUseColyseus
  // ===========================================================================

  describe("shouldUseColyseus", () => {
    // ─── Physics Games ────────────────────────────────────────────────

    it("returns true for physics games when all flags enabled", () => {
      expect(shouldUseColyseus("pong_game")).toBe(true);
      expect(shouldUseColyseus("air_hockey_game")).toBe(true);
      expect(shouldUseColyseus("bounce_blitz_game")).toBe(true);
      expect(shouldUseColyseus("brick_breaker_game")).toBe(true);
      expect(shouldUseColyseus("snake_game")).toBe(true);
      expect(shouldUseColyseus("race_game")).toBe(true);
    });

    it("returns false for physics games when PHYSICS_ENABLED is off", () => {
      COLYSEUS_FEATURES.PHYSICS_ENABLED = false;
      expect(shouldUseColyseus("pong_game")).toBe(false);
      expect(shouldUseColyseus("air_hockey_game")).toBe(false);
    });

    // ─── Quick-Play Games ─────────────────────────────────────────────

    it("returns true for quick-play games when all flags enabled", () => {
      expect(shouldUseColyseus("reaction_tap_game")).toBe(true);
      expect(shouldUseColyseus("dot_match_game")).toBe(true);
      expect(shouldUseColyseus("timed_tap_game")).toBe(true);
    });

    it("returns false for quick-play games when QUICKPLAY_ENABLED is off", () => {
      COLYSEUS_FEATURES.QUICKPLAY_ENABLED = false;
      expect(shouldUseColyseus("reaction_tap_game")).toBe(false);
    });

    // ─── Turn-Based Games ─────────────────────────────────────────────

    it("returns true for turn-based games when all flags enabled", () => {
      expect(shouldUseColyseus("tic_tac_toe_game")).toBe(true);
      expect(shouldUseColyseus("connect_four_game")).toBe(true);
      expect(shouldUseColyseus("gomoku_master_game")).toBe(true);
      expect(shouldUseColyseus("reversi_game")).toBe(true);
    });

    it("returns false for turn-based games when TURNBASED_ENABLED is off", () => {
      COLYSEUS_FEATURES.TURNBASED_ENABLED = false;
      expect(shouldUseColyseus("tic_tac_toe_game")).toBe(false);
      expect(shouldUseColyseus("connect_four_game")).toBe(false);
    });

    // ─── Complex Turn-Based Games ─────────────────────────────────────

    it("returns true for complex turn-based games when all flags enabled", () => {
      expect(shouldUseColyseus("chess_game")).toBe(true);
      expect(shouldUseColyseus("checkers_game")).toBe(true);
      expect(shouldUseColyseus("crazy_eights_game")).toBe(true);
      expect(shouldUseColyseus("war_game")).toBe(true);
    });

    it("returns false for complex games when COMPLEX_TURNBASED_ENABLED is off", () => {
      COLYSEUS_FEATURES.COMPLEX_TURNBASED_ENABLED = false;
      expect(shouldUseColyseus("chess_game")).toBe(false);
      expect(shouldUseColyseus("checkers_game")).toBe(false);
    });

    // ─── Cooperative Games ────────────────────────────────────────────

    it("returns true for coop games when all flags enabled", () => {
      expect(shouldUseColyseus("word_master_game")).toBe(true);
      expect(shouldUseColyseus("crossword_puzzle_game")).toBe(true);
    });

    it("returns false for coop games when COOP_ENABLED is off", () => {
      COLYSEUS_FEATURES.COOP_ENABLED = false;
      expect(shouldUseColyseus("word_master_game")).toBe(false);
    });

    // ─── Master Switch ────────────────────────────────────────────────

    it("returns false for all games when master COLYSEUS_ENABLED is off", () => {
      COLYSEUS_FEATURES.COLYSEUS_ENABLED = false;
      expect(shouldUseColyseus("pong_game")).toBe(false);
      expect(shouldUseColyseus("reaction_tap_game")).toBe(false);
      expect(shouldUseColyseus("chess_game")).toBe(false);
      expect(shouldUseColyseus("word_master_game")).toBe(false);
      expect(shouldUseColyseus("tic_tac_toe_game")).toBe(false);
    });

    // ─── Unknown Games ────────────────────────────────────────────────

    it("returns false for unknown game types", () => {
      expect(shouldUseColyseus("unknown_game")).toBe(false);
      expect(shouldUseColyseus("solo_puzzle")).toBe(false);
      expect(shouldUseColyseus("")).toBe(false);
    });
  });

  // ===========================================================================
  // getGameCategory
  // ===========================================================================

  describe("getGameCategory", () => {
    it("returns correct category for each game tier", () => {
      expect(getGameCategory("pong_game")).toBe("physics");
      expect(getGameCategory("reaction_tap_game")).toBe("quickplay");
      expect(getGameCategory("tic_tac_toe_game")).toBe("turnbased");
      expect(getGameCategory("chess_game")).toBe("complex");
      expect(getGameCategory("word_master_game")).toBe("coop");
    });

    it("returns null for unknown game types", () => {
      expect(getGameCategory("unknown_game")).toBeNull();
      expect(getGameCategory("")).toBeNull();
    });
  });

  // ===========================================================================
  // isColyseusEnabled
  // ===========================================================================

  describe("isColyseusEnabled", () => {
    it("returns true for registered game types", () => {
      expect(isColyseusEnabled("pong_game")).toBe(true);
      expect(isColyseusEnabled("chess_game")).toBe(true);
      expect(isColyseusEnabled("word_master_game")).toBe(true);
    });

    it("returns false for unregistered game types", () => {
      expect(isColyseusEnabled("unknown_game")).toBe(false);
      expect(isColyseusEnabled("2048_game")).toBe(false);
    });
  });

  // ===========================================================================
  // useGameConnection logic (via shouldUseColyseus)
  // ===========================================================================

  describe("useGameConnection logic (via shouldUseColyseus)", () => {
    it("physics game with matchId → colyseus", () => {
      expect(shouldUseColyseus("pong_game")).toBe(true);
    });

    it("physics game with PHYSICS_ENABLED off → online fallback", () => {
      COLYSEUS_FEATURES.PHYSICS_ENABLED = false;
      expect(shouldUseColyseus("pong_game")).toBe(false);
    });

    it("turn-based game with TURNBASED_ENABLED off → online fallback", () => {
      COLYSEUS_FEATURES.TURNBASED_ENABLED = false;
      expect(shouldUseColyseus("tic_tac_toe_game")).toBe(false);
    });

    it("all flags enabled, all game types route to colyseus", () => {
      const allGameTypes = [
        "pong_game",
        "air_hockey_game",
        "bounce_blitz_game",
        "brick_breaker_game",
        "snake_game",
        "race_game",
        "reaction_tap_game",
        "timed_tap_game",
        "dot_match_game",
        "tic_tac_toe_game",
        "connect_four_game",
        "gomoku_master_game",
        "reversi_game",
        "chess_game",
        "checkers_game",
        "crazy_eights_game",
        "war_game",
        "word_master_game",
        "crossword_puzzle_game",
      ];

      for (const gameType of allGameTypes) {
        expect(shouldUseColyseus(gameType)).toBe(true);
      }
    });
  });
});
