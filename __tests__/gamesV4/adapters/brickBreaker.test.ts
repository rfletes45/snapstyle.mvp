/**
 * Games V4 — Brick Breaker Adapter Unit Tests
 *
 * Tests the adapter metadata, state creation, move validation,
 * deterministic replay, and integration with descriptors.
 */

import brickBreakerAdapter from "@/gamesV4/adapters/brickBreaker";
import {
  LEVEL_PACK,
  MAX_LEVEL,
  getLevelById,
} from "@/gamesV4/games/brickBreaker/levels";
import { createRng } from "@/gamesV4/games/brickBreaker/rng";
import { SIM } from "@/gamesV4/games/brickBreaker/types";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS = [{ uid: "solo", slotIndex: 0 }];

function makeCtx(uid = "solo") {
  return {
    uid,
    turnOrder: [uid],
    currentTurnIndex: 0,
    settings: {},
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("Brick Breaker Adapter V4", () => {
  // ── Metadata ──────────────────────────────────────────────────────

  describe("metadata", () => {
    it("has correct classification", () => {
      expect(brickBreakerAdapter.gameId).toBe("brick_breaker");
      expect(brickBreakerAdapter.runtimeType).toBe("solo");
      expect(brickBreakerAdapter.maxPlayers).toBe(1);
      expect(brickBreakerAdapter.minPlayers).toBe(1);
      expect(brickBreakerAdapter.supportsSpectate).toBe(false);
    });

    it("has settings schema for aimGuide, haptics, sound", () => {
      const schema = brickBreakerAdapter.settingsSchema;
      expect(schema).toBeDefined();
      const keys = schema!.map((s) => s.key);
      expect(keys).toContain("aimGuide");
      expect(keys).toContain("haptics");
      expect(keys).toContain("sound");
    });
  });

  // ── Initial State ─────────────────────────────────────────────────

  describe("createInitialPublicState", () => {
    it("starts in idle phase with default lives", () => {
      const state = brickBreakerAdapter.createInitialPublicState(PLAYERS, {});
      const s = state as Record<string, unknown>;
      expect(s.phase).toBe("idle");

      const c = s.campaign as Record<string, unknown>;
      expect(c.lives).toBe(SIM.DEFAULT_LIVES);
      expect(c.score).toBe(0);
      expect(c.currentLevelId).toBe(1);
      expect(c.maxLevel).toBe(MAX_LEVEL);
      expect(c.seed).toBe(0);
    });
  });

  // ── startRun Move ─────────────────────────────────────────────────

  describe("validateMove — startRun", () => {
    it("transitions to running phase with seed", () => {
      const state = brickBreakerAdapter.createInitialPublicState(PLAYERS, {});
      const result = brickBreakerAdapter.validateMove(
        state,
        {},
        { type: "startRun", seed: 42 },
        makeCtx(),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const ns = result.nextPublicState as Record<string, unknown>;
      expect(ns.phase).toBe("running");

      const c = ns.campaign as Record<string, unknown>;
      expect(c.seed).toBe(42);
      expect(c.lives).toBe(SIM.DEFAULT_LIVES);
      expect(c.score).toBe(0);
      expect(result.turnAdvance).toBe(false);
    });

    it("uses Date.now() when no seed provided", () => {
      const state = brickBreakerAdapter.createInitialPublicState(PLAYERS, {});
      const before = Date.now();
      const result = brickBreakerAdapter.validateMove(
        state,
        {},
        { type: "startRun" },
        makeCtx(),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const c = (result.nextPublicState as Record<string, unknown>)
        .campaign as Record<string, unknown>;
      expect(c.seed).toBeGreaterThanOrEqual(before);
    });
  });

  // ── finishRun Move ────────────────────────────────────────────────

  describe("validateMove — finishRun", () => {
    it("accepts a valid finishRun with empty inputs (idle ball)", () => {
      // Start the run
      const initial = brickBreakerAdapter.createInitialPublicState(PLAYERS, {});
      const startResult = brickBreakerAdapter.validateMove(
        initial,
        {},
        { type: "startRun", seed: 12345 },
        makeCtx(),
      );
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      // Finish with no inputs (all lives will be lost eventually or clock will run)
      const finishResult = brickBreakerAdapter.validateMove(
        startResult.nextPublicState,
        {},
        {
          type: "finishRun",
          seed: 12345,
          startLevelId: 1,
          endLevelId: 1,
          inputHz: 15,
          inputSamples: [],
        },
        makeCtx(),
      );

      expect(finishResult.ok).toBe(true);
      if (!finishResult.ok) return;

      const ns = finishResult.nextPublicState as Record<string, unknown>;
      expect(ns.phase).toBe("finished");
      expect(ns.integrity).toEqual({
        replayVerified: true,
        verifierVersion: 1,
      });
      expect(finishResult.terminal).toBeDefined();
      expect(finishResult.turnAdvance).toBe(false);
    });

    it("returns terminal outcome with score delta", () => {
      const initial = brickBreakerAdapter.createInitialPublicState(PLAYERS, {});
      const startResult = brickBreakerAdapter.validateMove(
        initial,
        {},
        { type: "startRun", seed: 99 },
        makeCtx(),
      );
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const finishResult = brickBreakerAdapter.validateMove(
        startResult.nextPublicState,
        {},
        {
          type: "finishRun",
          seed: 99,
          startLevelId: 1,
          endLevelId: 1,
          inputHz: 15,
          inputSamples: [],
        },
        makeCtx(),
      );

      expect(finishResult.ok).toBe(true);
      if (!finishResult.ok) return;
      expect(finishResult.scoreDelta).toBeDefined();
      expect(finishResult.scoreDelta![0].uid).toBe("solo");
    });
  });

  // ── Unknown Move ──────────────────────────────────────────────────

  describe("validateMove — unknown", () => {
    it("rejects unknown move types", () => {
      const state = brickBreakerAdapter.createInitialPublicState(PLAYERS, {});
      const result = brickBreakerAdapter.validateMove(
        state,
        {},
        { type: "teleportBall" },
        makeCtx(),
      );
      expect(result.ok).toBe(false);
    });
  });

  // ── Outcome ───────────────────────────────────────────────────────

  describe("computeOutcome", () => {
    it("returns a single-player scoreboard", () => {
      const state = {
        phase: "finished",
        campaign: {
          score: 1500,
          levelsCleared: 3,
          durationMs: 60000,
          maxCombo: 8,
          bricksDestroyed: 120,
          powerupsUsed: 5,
        },
      } as unknown as Record<string, unknown>;

      const outcome = brickBreakerAdapter.computeOutcome(state, PLAYERS);

      expect(outcome.winnerIds).toEqual(["solo"]);
      expect(outcome.finalScoreboard).toHaveLength(1);
      expect(outcome.finalScoreboard[0].score).toBe(1500);
      expect(outcome.finalScoreboard[0].placement).toBe(1);
      expect(outcome.finalScoreboard[0].stats).toMatchObject({
        levelsCleared: 3,
        bricksDestroyed: 120,
      });
    });
  });

  // ── Performance Metrics ───────────────────────────────────────────

  describe("extractPerformanceMetrics", () => {
    it("extracts expected keys from public state", () => {
      const state = {
        phase: "finished",
        campaign: {
          score: 9999,
          levelsCleared: 10,
          durationMs: 120000,
          maxCombo: 20,
          bricksDestroyed: 300,
          powerupsUsed: 12,
          lives: 2,
        },
      } as unknown as Record<string, unknown>;

      const metrics = brickBreakerAdapter.extractPerformanceMetrics!(state, [
        { uid: "solo" },
      ]);

      expect(metrics.score).toBe(9999);
      expect(metrics.levelsCleared).toBe(10);
      expect(metrics.durationMs).toBe(120000);
      expect(metrics.maxCombo).toBe(20);
      expect(metrics.bricksDestroyed).toBe(300);
      expect(metrics.powerupsUsed).toBe(12);
      expect(metrics.lives).toBe(2);
    });
  });
});

// =============================================================================
// Levels & Constants Integrity
// =============================================================================

describe("Brick Breaker Levels", () => {
  it("has exactly 30 levels", () => {
    expect(LEVEL_PACK).toHaveLength(30);
    expect(MAX_LEVEL).toBe(30);
  });

  it("level IDs are sequential 1..30", () => {
    for (let i = 0; i < 30; i++) {
      expect(LEVEL_PACK[i].id).toBe(i + 1);
    }
  });

  it("all levels have valid rows array", () => {
    for (const level of LEVEL_PACK) {
      expect(level.rows.length).toBeGreaterThanOrEqual(1);
      expect(level.rows.length).toBeLessThanOrEqual(SIM.ROWS);
      expect(level.ballSpeed).toBeGreaterThan(0);
      expect(level.paddle).toBeGreaterThan(0);
      expect(level.powerRate).toBeGreaterThanOrEqual(0);
    }
  });

  it("getLevelById returns correct level", () => {
    const level1 = getLevelById(1);
    expect(level1).toBeDefined();
    expect(level1!.name).toBe("Warm-Up");

    const level30 = getLevelById(30);
    expect(level30).toBeDefined();
    expect(level30!.name).toBe("The Last Wall");

    expect(getLevelById(0)).toBeUndefined();
    expect(getLevelById(31)).toBeUndefined();
  });
});

// =============================================================================
// Seeded RNG
// =============================================================================

describe("Seeded RNG", () => {
  it("is deterministic for same seed", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const vals1 = Array.from({ length: 100 }, () => rng1.next());
    const vals2 = Array.from({ length: 100 }, () => rng2.next());
    expect(vals1).toEqual(vals2);
  });

  it("produces different values for different seeds", () => {
    const rng1 = createRng(1);
    const rng2 = createRng(2);
    const v1 = rng1.next();
    const v2 = rng2.next();
    expect(v1).not.toBe(v2);
  });

  it("produces values in [0, 1) range", () => {
    const rng = createRng(777);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("nextInt returns values in [min, max] range", () => {
    const rng = createRng(999);
    for (let i = 0; i < 200; i++) {
      const v = rng.nextInt(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
});

// =============================================================================
// Descriptors
// =============================================================================

describe("Brick Breaker Descriptors", () => {
  it("is in IMPLEMENTED_GAME_IDS", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { IMPLEMENTED_GAME_IDS } = require("@/gamesV4/constants");
    expect(IMPLEMENTED_GAME_IDS.has("brick_breaker")).toBe(true);
  });

  it("has SCOREBOARD_DESCRIPTORS entry", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SCOREBOARD_DESCRIPTORS } = require("@/gamesV4/constants");
    const desc = SCOREBOARD_DESCRIPTORS.brick_breaker;
    expect(desc).toBeDefined();
    expect(desc.title).toBe("FINAL SCORE");
    expect(desc.sortDirection).toBe("desc");
  });

  it("has LEADERBOARD_DESCRIPTORS entry", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LEADERBOARD_DESCRIPTORS } = require("@/gamesV4/constants");
    const desc = LEADERBOARD_DESCRIPTORS.brick_breaker;
    expect(desc).toBeDefined();
    expect(desc.metric).toBe("bestScore");
    expect(desc.sortDirection).toBe("desc");
  });

  it("has GAME_DESCRIPTIONS entry", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GAME_DESCRIPTIONS } = require("@/gamesV4/constants");
    const desc = GAME_DESCRIPTIONS.brick_breaker;
    expect(desc).toBeDefined();
    expect(desc.shortDescription).toBeTruthy();
    expect(desc.howToPlay).toBeTruthy();
  });
});
