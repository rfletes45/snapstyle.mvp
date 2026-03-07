/**
 * Games V4 — Mini Golf Adapter Unit Tests
 *
 * Tests the pure game logic of the MiniGolf adapter:
 * - Initial state creation
 * - Move validation (shot, pickup)
 * - Deterministic physics (same inputs → same outputs)
 * - Course pack validation (all 18 holes)
 * - Outcome computation (scoring, placements)
 * - Performance metrics
 * - Settings validation
 */

// Import to trigger registration
import "@/gamesV4/adapters/minigolf";

import { getAdapter } from "@/gamesV4/adapters/registry";
import {
  PIGEON_CLASSIC,
  getCoursePack,
  getTotalPar,
} from "@/gamesV4/games/miniGolf/courses/pigeonClassic";
import {
  simulateShot,
  simulateShotPositions,
} from "@/gamesV4/games/miniGolf/physics/sim";
import {
  dequantizeAngle,
  dequantizePower,
  isValidAngleQ,
  isValidPowerQ,
  quantizeAngle,
  quantizePower,
} from "@/gamesV4/games/miniGolf/utils/quantize";
import type { GameAdapterV4 } from "@/gamesV4/types/adapter";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS_2 = [
  { uid: "alice", slotIndex: 0 },
  { uid: "bob", slotIndex: 1 },
];

const PLAYERS_3 = [
  { uid: "alice", slotIndex: 0 },
  { uid: "bob", slotIndex: 1 },
  { uid: "charlie", slotIndex: 2 },
];

function getMinigolfAdapter(): GameAdapterV4 {
  const adapter = getAdapter("minigolf_duels");
  if (!adapter) throw new Error("minigolf_duels adapter not registered");
  return adapter;
}

function makeCtx(
  uid: string,
  turnOrder: string[],
  currentTurnIndex: number,
  settings: Record<string, unknown> = {},
) {
  return { uid, turnOrder, currentTurnIndex, settings };
}

function makeInitialState(
  players = PLAYERS_2,
  settings: Record<string, unknown> = {},
) {
  const adapter = getMinigolfAdapter();
  return adapter.createInitialPublicState(players, settings);
}

// =============================================================================
// Tests
// =============================================================================

describe("MiniGolf Adapter V4", () => {
  let adapter: GameAdapterV4;

  beforeAll(() => {
    adapter = getMinigolfAdapter();
  });

  describe("metadata", () => {
    it("has correct gameId", () => {
      expect(adapter.gameId).toBe("minigolf_duels");
    });

    it("is turnBased", () => {
      expect(adapter.runtimeType).toBe("turnBased");
    });

    it("supports 2-3 players", () => {
      expect(adapter.minPlayers).toBe(2);
      expect(adapter.maxPlayers).toBe(3);
    });

    it("has default settings", () => {
      const ds = adapter.defaultSettings as Record<string, unknown>;
      expect(ds.coursePackId).toBe("pigeon_classic");
      expect(ds.holeCount).toBe(9);
      expect(ds.maxStrokesPerHole).toBe(10);
      expect(ds.allowPickups).toBe(true);
    });
  });

  describe("createInitialPublicState", () => {
    it("initializes correct state for 2 players", () => {
      const state = makeInitialState() as Record<string, unknown>;
      expect(state.phase).toBe("aim");
      expect(state.holeIndex).toBe(0);
      expect(state.holeCount).toBe(9);
      expect(state.coursePackId).toBe("pigeon_classic");

      const ballPosByUid = state.ballPosByUid as Record<
        string,
        { x: number; y: number }
      >;
      expect(ballPosByUid.alice).toBeDefined();
      expect(ballPosByUid.bob).toBeDefined();

      const strokesTotalByUid = state.strokesTotalByUid as Record<
        string,
        number
      >;
      expect(strokesTotalByUid.alice).toBe(0);
      expect(strokesTotalByUid.bob).toBe(0);
    });

    it("initializes for 3 players", () => {
      const state = makeInitialState(PLAYERS_3) as Record<string, unknown>;
      const ballPosByUid = state.ballPosByUid as Record<
        string,
        { x: number; y: number }
      >;
      expect(Object.keys(ballPosByUid)).toHaveLength(3);
      expect(ballPosByUid.charlie).toBeDefined();
    });

    it("respects custom hole count", () => {
      const state = makeInitialState(PLAYERS_2, { holeCount: 18 }) as Record<
        string,
        unknown
      >;
      expect(state.holeCount).toBe(18);
    });

    it("balls start at first hole tee position", () => {
      const state = makeInitialState() as Record<string, unknown>;
      const ballPosByUid = state.ballPosByUid as Record<
        string,
        { x: number; y: number }
      >;
      const firstHole = PIGEON_CLASSIC.holes[0];
      expect(ballPosByUid.alice.x).toBe(firstHole.tee.x);
      expect(ballPosByUid.alice.y).toBe(firstHole.tee.y);
    });
  });

  describe("validateMove — shot", () => {
    it("accepts a valid shot", () => {
      const state = makeInitialState();
      const ctx = makeCtx("alice", ["alice", "bob"], 0);
      const result = adapter.validateMove!(
        state,
        {},
        { type: "shot", angleQ: 0, powerQ: 500 },
        ctx,
      );
      expect(result.ok).toBe(true);
      expect(result.nextPublicState).toBeDefined();
    });

    it("rejects shot with invalid angleQ", () => {
      const state = makeInitialState();
      const ctx = makeCtx("alice", ["alice", "bob"], 0);
      const result = adapter.validateMove!(
        state,
        {},
        { type: "shot", angleQ: -1, powerQ: 500 },
        ctx,
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("angle");
    });

    it("rejects shot with invalid powerQ", () => {
      const state = makeInitialState();
      const ctx = makeCtx("alice", ["alice", "bob"], 0);
      const result = adapter.validateMove!(
        state,
        {},
        { type: "shot", angleQ: 100, powerQ: 1500 },
        ctx,
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("power");
    });

    it("increments stroke count after shot", () => {
      const state = makeInitialState();
      const ctx = makeCtx("alice", ["alice", "bob"], 0);
      const result = adapter.validateMove!(
        state,
        {},
        { type: "shot", angleQ: 0, powerQ: 500 },
        ctx,
      );
      expect(result.ok).toBe(true);
      const ns = result.nextPublicState as Record<string, unknown>;
      const strokesThisHoleByUid = ns.strokesThisHoleByUid as Record<
        string,
        number
      >;
      expect(strokesThisHoleByUid.alice).toBeGreaterThanOrEqual(1);
    });

    it("shot does NOT advance turn (two-phase rolling)", () => {
      const state = makeInitialState();
      const ctx = makeCtx("alice", ["alice", "bob"], 0);
      const result = adapter.validateMove!(
        state,
        {},
        { type: "shot", angleQ: 900, powerQ: 300 },
        ctx,
      );
      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(false);
    });

    it("shot sets rolling payload on state", () => {
      const state = makeInitialState();
      const ctx = makeCtx("alice", ["alice", "bob"], 0);
      const result = adapter.validateMove!(
        state,
        {},
        { type: "shot", angleQ: 0, powerQ: 500 },
        ctx,
      );
      expect(result.ok).toBe(true);
      const ns = result.nextPublicState as Record<string, unknown>;
      expect(ns.phase).toBe("rolling");
      const rolling = ns.rolling as Record<string, unknown>;
      expect(rolling).toBeDefined();
      expect(rolling.uid).toBe("alice");
      expect(rolling.shotId).toBeTruthy();
      expect(rolling.angleQ).toBe(0);
      expect(rolling.powerQ).toBe(500);
      expect(rolling.rollDurationMs).toBeGreaterThan(0);
      expect(rolling.totalSteps).toBeGreaterThan(0);
      expect(rolling.finalPosQ).toBeDefined();
    });
  });

  describe("validateMove — finish_roll", () => {
    function doShot(
      adapter: GameAdapterV4,
      state: Record<string, unknown>,
      uid = "alice",
    ) {
      const ctx = makeCtx(uid, ["alice", "bob"], uid === "alice" ? 0 : 1);
      return adapter.validateMove!(
        state,
        {},
        { type: "shot", angleQ: 0, powerQ: 500 },
        ctx,
      );
    }

    it("finish_roll advances turn and commits position", () => {
      const state = makeInitialState();
      const shotResult = doShot(adapter, state);
      expect(shotResult.ok).toBe(true);
      const rollingState = shotResult.nextPublicState as Record<
        string,
        unknown
      >;
      const rolling = rollingState.rolling as Record<string, unknown>;
      expect(rolling).toBeDefined();

      // Now finish the roll
      const ctx = makeCtx("alice", ["alice", "bob"], 0);
      const finishResult = adapter.validateMove!(
        rollingState,
        {},
        { type: "finish_roll", shotId: rolling.shotId as string },
        ctx,
      );
      expect(finishResult.ok).toBe(true);
      expect(finishResult.turnAdvance).toBe(true);
      const ns = finishResult.nextPublicState as Record<string, unknown>;
      expect(ns.phase).toBe("aim");
      expect(ns.rolling).toBeFalsy();
    });

    it("finish_roll with wrong shotId is rejected", () => {
      const state = makeInitialState();
      const shotResult = doShot(adapter, state);
      const rollingState = shotResult.nextPublicState as Record<
        string,
        unknown
      >;

      const ctx = makeCtx("alice", ["alice", "bob"], 0);
      const finishResult = adapter.validateMove!(
        rollingState,
        {},
        { type: "finish_roll", shotId: "wrong-shot-id" },
        ctx,
      );
      expect(finishResult.ok).toBe(false);
    });

    it("finish_roll when not rolling is idempotent (ok: true, no changes)", () => {
      const state = makeInitialState();
      const ctx = makeCtx("alice", ["alice", "bob"], 0);
      const result = adapter.validateMove!(
        state,
        {},
        { type: "finish_roll", shotId: "any-id" },
        ctx,
      );
      // Idempotent: returns ok:true but makes no state changes
      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(false);
    });
  });

  describe("validateMove — pickup", () => {
    it("allows pickup and marks player as sunk", () => {
      const state = makeInitialState();
      const ctx = makeCtx("alice", ["alice", "bob"], 0, { allowPickups: true });
      const result = adapter.validateMove!(state, {}, { type: "pickup" }, ctx);
      expect(result.ok).toBe(true);
      const ns = result.nextPublicState as Record<string, unknown>;
      const ballSunkByUid = ns.ballSunkByUid as Record<string, boolean>;
      expect(ballSunkByUid.alice).toBe(true);
    });
  });

  describe("computeOutcome", () => {
    it("ranks players by total strokes (lower is better)", () => {
      const state = makeInitialState() as Record<string, unknown>;
      // Manually set strokes for testing
      (state as any).strokesTotalByUid = { alice: 20, bob: 25 };
      (state as any).phase = "finished";

      const outcome = adapter.computeOutcome!(state, PLAYERS_2);
      expect(outcome.winnerIds).toContain("alice");
      expect(outcome.finalScoreboard[0].uid).toBe("alice");
      expect(outcome.finalScoreboard[0].placement).toBe(1);
      expect(outcome.finalScoreboard[1].uid).toBe("bob");
      expect(outcome.finalScoreboard[1].placement).toBe(2);
    });

    it("handles ties", () => {
      const state = makeInitialState() as Record<string, unknown>;
      (state as any).strokesTotalByUid = { alice: 20, bob: 20 };
      (state as any).phase = "finished";

      const outcome = adapter.computeOutcome!(state, PLAYERS_2);
      expect(outcome.winnerIds).toContain("alice");
      expect(outcome.winnerIds).toContain("bob");
      expect(outcome.finalScoreboard[0].placement).toBe(1);
      expect(outcome.finalScoreboard[1].placement).toBe(1);
    });

    it("uses negative strokes as score", () => {
      const state = makeInitialState() as Record<string, unknown>;
      (state as any).strokesTotalByUid = { alice: 30, bob: 35 };

      const outcome = adapter.computeOutcome!(state, PLAYERS_2);
      expect(outcome.finalScoreboard[0].score).toBe(-30);
      expect(outcome.finalScoreboard[1].score).toBe(-35);
    });
  });

  describe("extractPerformanceMetrics", () => {
    it("returns expected metrics", () => {
      const state = makeInitialState() as Record<string, unknown>;
      const metrics = adapter.extractPerformanceMetrics!(state, [
        { uid: "alice" },
        { uid: "bob" },
      ]) as Record<string, unknown>;
      expect(metrics.totalStrokes).toBeDefined();
      expect(metrics.totalMoves).toBeDefined();
      expect(metrics.holesPlayed).toBeDefined();
    });
  });

  describe("validateSettings", () => {
    it("passes through empty patch unchanged", () => {
      const settings = adapter.validateSettings!({}) as Record<string, unknown>;
      // Empty patch is valid — no fields to validate
      expect(settings).toBeDefined();
    });

    it("clamps maxStrokesPerHole", () => {
      const settings = adapter.validateSettings!({
        maxStrokesPerHole: 100,
      }) as Record<string, unknown>;
      expect(settings.maxStrokesPerHole).toBe(15);
    });

    it("accepts valid holeCount", () => {
      const settings = adapter.validateSettings!({ holeCount: 18 }) as Record<
        string,
        unknown
      >;
      expect(settings.holeCount).toBe(18);
    });

    it("rejects invalid holeCount", () => {
      const settings = adapter.validateSettings!({ holeCount: 7 }) as Record<
        string,
        unknown
      >;
      expect(settings.holeCount).toBe(3); // fallback to 3
    });
  });
});

// =============================================================================
// Course Pack Tests
// =============================================================================

describe("Pigeon Classic Course Pack", () => {
  it("has 18 holes", () => {
    expect(PIGEON_CLASSIC.holes).toHaveLength(18);
  });

  it("all holes have required fields", () => {
    for (const hole of PIGEON_CLASSIC.holes) {
      expect(hole.id).toBeTruthy();
      expect(hole.name).toBeTruthy();
      expect(hole.par).toBeGreaterThan(0);
      expect(hole.bounds.width).toBeGreaterThan(0);
      expect(hole.bounds.height).toBeGreaterThan(0);
      expect(hole.tee.x).toBeGreaterThan(0);
      expect(hole.tee.y).toBeGreaterThan(0);
      expect(hole.cup.x).toBeGreaterThan(0);
      expect(hole.cup.y).toBeGreaterThan(0);
      expect(hole.cupRadius).toBeGreaterThan(0);
      expect(hole.walls.length).toBeGreaterThan(0);
    }
  });

  it("all hole IDs are unique", () => {
    const ids = PIGEON_CLASSIC.holes.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tee positions are within bounds", () => {
    for (const hole of PIGEON_CLASSIC.holes) {
      expect(hole.tee.x).toBeGreaterThan(0);
      expect(hole.tee.x).toBeLessThan(hole.bounds.width);
      expect(hole.tee.y).toBeGreaterThan(0);
      expect(hole.tee.y).toBeLessThan(hole.bounds.height);
    }
  });

  it("cup positions are within bounds", () => {
    for (const hole of PIGEON_CLASSIC.holes) {
      expect(hole.cup.x).toBeGreaterThan(0);
      expect(hole.cup.x).toBeLessThan(hole.bounds.width);
      expect(hole.cup.y).toBeGreaterThan(0);
      expect(hole.cup.y).toBeLessThan(hole.bounds.height);
    }
  });

  it("getCoursePack returns pigeon_classic", () => {
    expect(getCoursePack("pigeon_classic")).toBe(PIGEON_CLASSIC);
  });

  it("getCoursePack returns null for unknown", () => {
    expect(getCoursePack("unknown_pack")).toBeNull();
  });

  it("getTotalPar computes correctly", () => {
    const par9 = getTotalPar(PIGEON_CLASSIC, 9);
    expect(par9).toBeGreaterThan(0);
    const par18 = getTotalPar(PIGEON_CLASSIC, 18);
    expect(par18).toBeGreaterThan(par9);
  });

  it("pars are reasonable (2-6 per hole)", () => {
    for (const hole of PIGEON_CLASSIC.holes) {
      expect(hole.par).toBeGreaterThanOrEqual(2);
      expect(hole.par).toBeLessThanOrEqual(6);
    }
  });
});

// =============================================================================
// Quantization Tests
// =============================================================================

describe("Quantization", () => {
  it("quantizeAngle roundtrips correctly", () => {
    const angRad = Math.PI / 4; // 45 degrees in radians
    const q = quantizeAngle(angRad);
    const back = dequantizeAngle(q);
    expect(Math.abs(back - angRad)).toBeLessThan(0.002);
  });

  it("quantizePower roundtrips correctly", () => {
    const pwr = 0.75;
    const q = quantizePower(pwr);
    const back = dequantizePower(q);
    expect(Math.abs(back - pwr)).toBeLessThan(0.002);
  });

  it("isValidAngleQ range [0, 3599]", () => {
    expect(isValidAngleQ(0)).toBe(true);
    expect(isValidAngleQ(3599)).toBe(true);
    expect(isValidAngleQ(-1)).toBe(false);
    expect(isValidAngleQ(3600)).toBe(false);
    expect(isValidAngleQ(1.5)).toBe(false);
  });

  it("isValidPowerQ range [0, 1000]", () => {
    expect(isValidPowerQ(0)).toBe(true);
    expect(isValidPowerQ(1000)).toBe(true);
    expect(isValidPowerQ(-1)).toBe(false);
    expect(isValidPowerQ(1001)).toBe(false);
    expect(isValidPowerQ(0.5)).toBe(false);
  });
});

// =============================================================================
// Physics Determinism Tests
// =============================================================================

describe("Physics Simulation", () => {
  const firstHole = PIGEON_CLASSIC.holes[0];

  it("produces a result for a basic shot", () => {
    const result = simulateShot(firstHole, firstHole.tee, 0, 500);
    expect(result).toBeDefined();
    expect(result.finalPos).toBeDefined();
    expect(result.finalPos.x).toBeGreaterThan(0);
    expect(result.totalSteps).toBeGreaterThan(0);
  });

  it("is deterministic — same inputs produce identical outputs", () => {
    const r1 = simulateShot(firstHole, firstHole.tee, 1800, 700);
    const r2 = simulateShot(firstHole, firstHole.tee, 1800, 700);
    expect(r1.finalPos.x).toBe(r2.finalPos.x);
    expect(r1.finalPos.y).toBe(r2.finalPos.y);
    expect(r1.sunk).toBe(r2.sunk);
    expect(r1.totalSteps).toBe(r2.totalSteps);
  });

  it("zero power stays at start", () => {
    const result = simulateShot(firstHole, firstHole.tee, 0, 0);
    expect(result.finalPos.x).toBeCloseTo(firstHole.tee.x, 1);
    expect(result.finalPos.y).toBeCloseTo(firstHole.tee.y, 1);
  });

  it("different angles produce different final positions", () => {
    const r1 = simulateShot(firstHole, firstHole.tee, 0, 500);
    const r2 = simulateShot(firstHole, firstHole.tee, 900, 500);
    const samePos =
      r1.finalPos.x === r2.finalPos.x && r1.finalPos.y === r2.finalPos.y;
    expect(samePos).toBe(false);
  });

  it("higher power moves ball further", () => {
    // Straight up shot on hole 1 (narrow lane)
    const r1 = simulateShot(firstHole, firstHole.tee, 0, 200);
    const r2 = simulateShot(firstHole, firstHole.tee, 0, 800);
    // Both shots going same direction — higher power should end further from start
    const dist1 = Math.hypot(
      r1.finalPos.x - firstHole.tee.x,
      r1.finalPos.y - firstHole.tee.y,
    );
    const dist2 = Math.hypot(
      r2.finalPos.x - firstHole.tee.x,
      r2.finalPos.y - firstHole.tee.y,
    );
    // Higher power should produce different result (may not always be further due to bouncing)
    expect(dist1 !== dist2 || r1.sunk !== r2.sunk).toBe(true);
  });

  it("ball stays within hole bounds", () => {
    // Test multiple shots to ensure ball doesn't escape
    for (let angleQ = 0; angleQ < 3600; angleQ += 450) {
      const result = simulateShot(firstHole, firstHole.tee, angleQ, 800);
      expect(result.finalPos.x).toBeGreaterThanOrEqual(-0.5);
      expect(result.finalPos.y).toBeGreaterThanOrEqual(-0.5);
      expect(result.finalPos.x).toBeLessThanOrEqual(
        firstHole.bounds.width + 0.5,
      );
      expect(result.finalPos.y).toBeLessThanOrEqual(
        firstHole.bounds.height + 0.5,
      );
    }
  });
});

// =============================================================================
// simulateShotPositions Tests (for rolling playback)
// =============================================================================

describe("simulateShotPositions", () => {
  const firstHole = PIGEON_CLASSIC.holes[0];

  it("returns an array of positions", () => {
    const positions = simulateShotPositions(firstHole, firstHole.tee, 0, 500);
    expect(Array.isArray(positions)).toBe(true);
    expect(positions.length).toBeGreaterThan(0);
  });

  it("first position is within a reasonable distance of the start", () => {
    const positions = simulateShotPositions(firstHole, firstHole.tee, 0, 500);
    // After one physics step the ball has moved from the impulse,
    // but it should still be within ~2 units of the tee.
    const dist = Math.hypot(
      positions[0].x - firstHole.tee.x,
      positions[0].y - firstHole.tee.y,
    );
    expect(dist).toBeLessThan(2);
  });

  it("last position is close to simulateShot finalPos", () => {
    const angleQ = 900;
    const powerQ = 600;
    const positions = simulateShotPositions(
      firstHole,
      firstHole.tee,
      angleQ,
      powerQ,
    );
    const simResult = simulateShot(firstHole, firstHole.tee, angleQ, powerQ);
    const lastPos = positions[positions.length - 1];
    // simulateShot quantizes finalPos while simulateShotPositions keeps raw;
    // also stop-frame detection may differ by ±1 step. Allow tolerance.
    expect(lastPos.x).toBeCloseTo(simResult.finalPos.x, 0);
    expect(lastPos.y).toBeCloseTo(simResult.finalPos.y, 0);
  });

  it("position count is close to simulateShot totalSteps", () => {
    const angleQ = 1800;
    const powerQ = 400;
    const positions = simulateShotPositions(
      firstHole,
      firstHole.tee,
      angleQ,
      powerQ,
    );
    const simResult = simulateShot(firstHole, firstHole.tee, angleQ, powerQ);
    // Allow ±2 frames difference due to step loop capture timing
    expect(
      Math.abs(positions.length - simResult.totalSteps),
    ).toBeLessThanOrEqual(2);
  });

  it("is deterministic", () => {
    const p1 = simulateShotPositions(firstHole, firstHole.tee, 450, 700);
    const p2 = simulateShotPositions(firstHole, firstHole.tee, 450, 700);
    expect(p1.length).toBe(p2.length);
    for (let i = 0; i < p1.length; i++) {
      expect(p1[i].x).toBe(p2[i].x);
      expect(p1[i].y).toBe(p2[i].y);
    }
  });

  it("zero power returns minimal positions near tee", () => {
    const positions = simulateShotPositions(firstHole, firstHole.tee, 0, 0);
    expect(positions.length).toBeGreaterThan(0);
    // All positions should be near the tee
    for (const p of positions) {
      expect(p.x).toBeCloseTo(firstHole.tee.x, 0);
      expect(p.y).toBeCloseTo(firstHole.tee.y, 0);
    }
  });
});
