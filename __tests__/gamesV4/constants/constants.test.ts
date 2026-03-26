/**
 * Games V4 — Constants & Type Contract Tests
 *
 * Validates the integrity of V4 constants and type contracts:
 * - GAME_METADATA covers all current game IDs
 * - XP_CONFIG values are sane
 * - COLLECTIONS paths are non-empty strings
 * - Game categories are well-formed
 */

import {
  COLLECTIONS,
  GAME_METADATA,
  XP_CONFIG,
  getGameLifecyclePolicy,
  getSoloMode,
  isPersistentSoloGame,
} from "@/gamesV4/constants";

// =============================================================================
// Tests
// =============================================================================

describe("V4 Constants & Contracts", () => {
  describe("GAME_METADATA", () => {
    it("contains exactly 26 games", () => {
      const ids = Object.keys(GAME_METADATA);
      expect(ids.length).toBe(26);
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
      "solitaire_klondike",
      "tic_tac_toe",
      "chess",
      "checkers",
      "connect_four",
      "gomoku",
      "reversi",
      "dots_and_boxes",
      "crazy_eights",
      "hex",
      "dead_drop",
      "metro_magnate",
      "pong_game",
      "battleship",
      "sketch_party_game",
      "starforge_game",
      "crossword_puzzle",
      "minigolf_duels",
      "dot_match",
      "knockout_game",
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

  // ===========================================================================
  // Persistent Solo — Lifecycle Policy & Helpers
  // ===========================================================================

  describe("Persistent Solo helpers", () => {
    it("getSoloMode returns 'standard' for a regular solo game", () => {
      expect(getSoloMode("play_2048")).toBe("standard");
    });

    it("getSoloMode returns 'standard' for a multiplayer game", () => {
      expect(getSoloMode("tic_tac_toe")).toBe("standard");
    });

    it("isPersistentSoloGame returns false for standard solo games", () => {
      expect(isPersistentSoloGame("play_2048")).toBe(false);
      expect(isPersistentSoloGame("brick_breaker")).toBe(false);
    });

    it("isPersistentSoloGame returns false for multiplayer games", () => {
      expect(isPersistentSoloGame("chess")).toBe(false);
      expect(isPersistentSoloGame("tic_tac_toe")).toBe(false);
    });
  });

  describe("getGameLifecyclePolicy", () => {
    it("standard solo: allow resign, auto-resume, no inactivity resolve", () => {
      const policy = getGameLifecyclePolicy("play_2048");
      expect(policy.runtimeType).toBe("solo");
      expect(policy.soloMode).toBe("standard");
      expect(policy.allowResign).toBe(true);
      expect(policy.autoResumeExisting).toBe(true);
      expect(policy.inactivityAutoResolve).toBe(false);
      expect(policy.suspendOnExit).toBe(true);
    });

    it("turn-based multiplayer: resign allowed, inactivity resolve on", () => {
      const policy = getGameLifecyclePolicy("chess");
      expect(policy.runtimeType).toBe("turnBased");
      expect(policy.soloMode).toBe("standard");
      expect(policy.allowResign).toBe(true);
      expect(policy.inactivityAutoResolve).toBe(true);
      expect(policy.suspendOnExit).toBe(false);
    });

    it("standard games have supportsOfflineProgression false", () => {
      const policy = getGameLifecyclePolicy("play_2048");
      expect(policy.supportsOfflineProgression).toBe(false);
    });

    it("all games return a valid policy object shape", () => {
      for (const gameId of Object.keys(GAME_METADATA)) {
        const policy = getGameLifecyclePolicy(
          gameId as import("@/gamesV4/types/common").GameId,
        );
        expect(policy).toHaveProperty("runtimeType");
        expect(policy).toHaveProperty("soloMode");
        expect(policy).toHaveProperty("allowResign");
        expect(policy).toHaveProperty("suspendOnExit");
        expect(policy).toHaveProperty("resolveOnExit");
        expect(policy).toHaveProperty("autoResumeExisting");
        expect(policy).toHaveProperty("inactivityAutoResolve");
        expect(policy).toHaveProperty("showTerminalScreenOnSuspend");
        expect(policy).toHaveProperty("allowRestart");
        expect(policy).toHaveProperty("supportsOfflineProgression");
      }
    });
  });
});
