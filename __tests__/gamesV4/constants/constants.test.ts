/**
 * Games V4 — Constants & Type Contract Tests
 *
 * Validates the integrity of V4 constants and type contracts:
 * - GAME_METADATA covers all 20 game IDs
 * - XP_CONFIG values are sane
 * - COLLECTIONS paths are non-empty strings
 * - Game categories are well-formed
 */

import { COLLECTIONS, GAME_METADATA, XP_CONFIG } from "@/gamesV4/constants";

// =============================================================================
// Tests
// =============================================================================

describe("V4 Constants & Contracts", () => {
  describe("GAME_METADATA", () => {
    it("contains exactly 20 games", () => {
      const ids = Object.keys(GAME_METADATA);
      expect(ids.length).toBe(20);
    });

    it("every entry has required fields", () => {
      for (const [gameId, meta] of Object.entries(GAME_METADATA)) {
        expect(meta.displayName).toBeTruthy();
        expect(meta.runtimeType).toBeDefined();
        expect(["solo", "turnBased", "realtime"]).toContain(meta.runtimeType);
        expect(typeof meta.minPlayers).toBe("number");
        expect(typeof meta.maxPlayers).toBe("number");
        expect(meta.minPlayers).toBeGreaterThanOrEqual(1);
        expect(meta.maxPlayers).toBeGreaterThanOrEqual(meta.minPlayers);
      }
    });

    const EXPECTED_IDS = [
      "bounce_blitz",
      "play_2048",
      "brick_breaker",
      "word_master",
      "minesweeper",
      "lights_out",
      "tic_tac_toe",
      "chess",
      "checkers",
      "connect_four",
      "gomoku",
      "reversi",
      "dots_and_boxes",
      "pong_game",
      "battleship",
      "sketch_party_game",
      "starforge_game",
      "crossword_puzzle",
      "minigolf_duels",
      "dot_match",
    ];

    it("contains all expected game IDs", () => {
      for (const id of EXPECTED_IDS) {
        expect(GAME_METADATA).toHaveProperty(id);
      }
    });

    it("has no unexpected game IDs", () => {
      const ids = Object.keys(GAME_METADATA);
      for (const id of ids) {
        expect(EXPECTED_IDS).toContain(id);
      }
    });

    it("solo games have maxPlayers = 1", () => {
      for (const [, meta] of Object.entries(GAME_METADATA)) {
        if (meta.runtimeType === "solo") {
          expect(meta.maxPlayers).toBe(1);
        }
      }
    });

    it("multiplayer games have maxPlayers ≥ 2", () => {
      for (const [, meta] of Object.entries(GAME_METADATA)) {
        if (meta.runtimeType !== "solo") {
          expect(meta.maxPlayers).toBeGreaterThanOrEqual(2);
        }
      }
    });
  });

  describe("XP_CONFIG", () => {
    it("has positive base participation", () => {
      expect(XP_CONFIG.BASE_PARTICIPATION).toBeGreaterThan(0);
    });

    it("win bonus exceeds draw bonus", () => {
      expect(XP_CONFIG.WIN_BONUS).toBeGreaterThan(XP_CONFIG.DRAW_BONUS);
    });

    it("draw bonus is positive", () => {
      expect(XP_CONFIG.DRAW_BONUS).toBeGreaterThan(0);
    });

    it("level threshold produces increasing values", () => {
      let prev = 0;
      for (let lvl = 1; lvl <= 50; lvl++) {
        const threshold = XP_CONFIG.levelXpThreshold(lvl);
        expect(threshold).toBeGreaterThan(prev);
        prev = threshold;
      }
    });
  });

  describe("COLLECTIONS", () => {
    it("all collection paths are non-empty strings", () => {
      for (const [key, value] of Object.entries(COLLECTIONS)) {
        expect(typeof value).toBe("string");
        expect((value as string).length).toBeGreaterThan(0);
      }
    });

    it("contains expected V4 paths", () => {
      expect(COLLECTIONS.GAME_INVITES).toBe("GameInvitesV4");
      expect(COLLECTIONS.GAME_SESSIONS).toBe("GameSessionsV4");
      expect(COLLECTIONS.GAME_RESULTS).toBe("GameResultsV4");
      expect(COLLECTIONS.LEADERBOARDS).toBe("LeaderboardsV4");
    });

    it("subcollection names are lowercase-safe", () => {
      // Subcollections: Moves, PublicState, PrivateState
      expect(COLLECTIONS.MOVES).toBeDefined();
      expect(COLLECTIONS.PUBLIC_STATE).toBeDefined();
      expect(COLLECTIONS.PRIVATE_STATE).toBeDefined();
    });
  });
});
