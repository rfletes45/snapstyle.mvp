/**
 * Games V4 — Mini Golf Adapter
 *
 * Pure, deterministic game logic for Mini Golf.
 * Shared between client (optimistic preview) and server (authoritative).
 *
 * Turn-based: 2–3 players, round-robin turns, series of holes.
 * Scoring: lowest total strokes wins (score = negative strokes for "higher is better" leaderboard).
 *
 * @module gamesV4/adapters/minigolf
 */

import {
  getCoursePack,
  isValidAngleQ,
  isValidPowerQ,
  simulateShot,
} from "../games/miniGolf";
import type {
  CoursePackDef,
  FinishRollMove,
  MiniGolfMove,
  MiniGolfPublicState,
  RollingPayload,
  ShotMove,
  Vec2,
} from "../games/miniGolf/types";
import type {
  GameAdapterV4,
  GameOutcome,
  MoveValidationResult,
  SettingsFieldDef,
} from "../types/adapter";
import { registerAdapter } from "./registry";

// =============================================================================
// Helpers
// =============================================================================

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function getHoleFromPack(pack: CoursePackDef, holeIndex: number) {
  return pack.holes[holeIndex] ?? null;
}

function allPlayersDone(
  state: MiniGolfPublicState,
  turnOrder: string[],
  maxStrokes: number,
): boolean {
  return turnOrder.every(
    (uid) =>
      state.ballSunkByUid[uid] || state.strokesThisHoleByUid[uid] >= maxStrokes,
  );
}

function advanceHole(
  state: MiniGolfPublicState,
  pack: CoursePackDef,
  turnOrder: string[],
): MiniGolfPublicState {
  const nextIndex = state.holeIndex + 1;
  if (nextIndex >= state.holeCount || nextIndex >= pack.holes.length) {
    // Match over
    state.phase = "finished";
    return state;
  }

  const nextHole = pack.holes[nextIndex];
  state.holeIndex = nextIndex;
  state.holeId = nextHole.id;
  state.holePar = nextHole.par;
  state.phase = "aim";

  // Reset per-hole state
  for (const uid of turnOrder) {
    state.strokesThisHoleByUid[uid] = 0;
    state.ballSunkByUid[uid] = false;
    state.ballPosByUid[uid] = { x: nextHole.tee.x, y: nextHole.tee.y };
    state.lastSafePosByUid[uid] = { x: nextHole.tee.x, y: nextHole.tee.y };
    state.lastShotMeta[uid] = {
      wallContact: false,
      bumperContact: false,
      sandContact: false,
      sunk: false,
    };
  }

  return state;
}

// =============================================================================
// Settings Schema
// =============================================================================

const settingsSchema: SettingsFieldDef[] = [
  {
    key: "holeCount",
    label: "Holes",
    type: "select",
    default: 9,
    options: [
      { label: "3 Holes", value: 3 },
      { label: "5 Holes", value: 5 },
      { label: "9 Holes", value: 9 },
      { label: "18 Holes", value: 18 },
    ],
  },
  {
    key: "maxStrokesPerHole",
    label: "Max Strokes",
    type: "number",
    default: 10,
    min: 5,
    max: 15,
    step: 1,
  },
  {
    key: "allowPickups",
    label: "Allow Pickup",
    type: "boolean",
    default: true,
  },
  {
    key: "assistGhostLine",
    label: "Aim Assist",
    type: "boolean",
    default: false,
  },
];

const defaultSettings: Record<string, unknown> = {
  coursePackId: "pigeon_classic",
  holeCount: 9,
  maxStrokesPerHole: 10,
  allowPickups: true,
  assistGhostLine: false,
};

// =============================================================================
// Adapter Implementation
// =============================================================================

const minigolfAdapter: GameAdapterV4 = {
  gameId: "minigolf_duels",
  runtimeType: "turnBased",
  maxPlayers: 3,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "full_state",

  scoreboardDescriptor: {
    title: "TOTAL STROKES",
    formatScore: (s) => `${Math.abs(s)}`,
    sortDirection: "desc", // higher (less negative) = fewer strokes = better
  },

  settingsSchema,
  defaultSettings,

  // ── State Creation ──────────────────────────────────────────────────

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const holeCount = (settings.holeCount as number) || 9;
    const coursePackId = (settings.coursePackId as string) || "pigeon_classic";
    const pack = getCoursePack(coursePackId)!;
    const firstHole = pack.holes[0];

    const strokesTotalByUid: Record<string, number> = {};
    const strokesThisHoleByUid: Record<string, number> = {};
    const ballPosByUid: Record<string, Vec2> = {};
    const ballSunkByUid: Record<string, boolean> = {};
    const lastSafePosByUid: Record<string, Vec2> = {};
    const penaltiesByUid: Record<string, number> = {};
    const holeScoresByUid: Record<string, Record<string, number>> = {};
    const holesInOneByUid: Record<string, number> = {};
    const birdiesByUid: Record<string, number> = {};
    const lastShotMeta: Record<
      string,
      {
        wallContact: boolean;
        bumperContact: boolean;
        sandContact: boolean;
        sunk: boolean;
      }
    > = {};

    for (const p of players) {
      strokesTotalByUid[p.uid] = 0;
      strokesThisHoleByUid[p.uid] = 0;
      ballPosByUid[p.uid] = { x: firstHole.tee.x, y: firstHole.tee.y };
      ballSunkByUid[p.uid] = false;
      lastSafePosByUid[p.uid] = { x: firstHole.tee.x, y: firstHole.tee.y };
      penaltiesByUid[p.uid] = 0;
      holeScoresByUid[p.uid] = {};
      holesInOneByUid[p.uid] = 0;
      birdiesByUid[p.uid] = 0;
      lastShotMeta[p.uid] = {
        wallContact: false,
        bumperContact: false,
        sandContact: false,
        sunk: false,
      };
    }

    const state: MiniGolfPublicState = {
      coursePackId,
      holeCount: holeCount as 3 | 5 | 9 | 18,
      holeIndex: 0,
      phase: "aim",
      holeId: firstHole.id,
      holePar: firstHole.par,
      strokesTotalByUid,
      strokesThisHoleByUid,
      ballPosByUid,
      ballSunkByUid,
      lastSafePosByUid,
      penaltiesByUid,
      holeScoresByUid,
      holesInOneByUid,
      birdiesByUid,
      lastShotMeta,
      events: [],
    };

    return state as unknown as Record<string, unknown>;
  },

  // ── Move Validation ─────────────────────────────────────────────────

  validateMove(
    publicState: Record<string, unknown>,
    _privateStateByPlayer: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult {
    const state = deepClone(publicState) as unknown as MiniGolfPublicState;
    const move = movePayload as unknown as MiniGolfMove;
    const { uid, turnOrder } = ctx;
    const maxStrokes = (ctx.settings.maxStrokesPerHole as number) || 10;

    if (__DEV__) {
      console.log("[MiniGolf/adapter] validateMove:", {
        moveType: move.type,
        uid,
        phase: state.phase,
        ballSunk: state.ballSunkByUid[uid],
        strokes: state.strokesThisHoleByUid[uid],
        maxStrokes,
      });
    }

    // Reject if game is finished
    if (state.phase === "finished") {
      if (__DEV__) console.warn("[MiniGolf/adapter] REJECTED: game finished");
      return { ok: false, error: "Game is already finished." };
    }

    // Reject if ball already sunk or maxed out
    if (
      state.ballSunkByUid[uid] ||
      state.strokesThisHoleByUid[uid] >= maxStrokes
    ) {
      if (__DEV__) console.warn("[MiniGolf/adapter] REJECTED: hole completed");
      return { ok: false, error: "You have already completed this hole." };
    }

    const pack = getCoursePack(state.coursePackId);
    if (!pack) return { ok: false, error: "Invalid course pack." };
    const hole = getHoleFromPack(pack, state.holeIndex);
    if (!hole) return { ok: false, error: "Invalid hole index." };

    // ── Handle pickup ───────────────────────────────────────────────
    if (move.type === "pickup") {
      if (!ctx.settings.allowPickups) {
        return { ok: false, error: "Pickups are not allowed." };
      }

      state.strokesThisHoleByUid[uid] = maxStrokes;
      state.strokesTotalByUid[uid] +=
        maxStrokes - (state.strokesThisHoleByUid[uid] || 0);
      // Correct: set total to include this hole's max
      const prevHoleStrokes =
        (publicState as unknown as MiniGolfPublicState).strokesThisHoleByUid[
          uid
        ] || 0;
      state.strokesTotalByUid[uid] =
        (publicState as unknown as MiniGolfPublicState).strokesTotalByUid[uid] +
        (maxStrokes - prevHoleStrokes);
      state.ballSunkByUid[uid] = true;
      state.holeScoresByUid[uid][state.holeId] = maxStrokes;

      if (state.events.length < 20) {
        state.events.push({ t: 0, type: "pickup", uid });
      }

      // Check if all players done
      if (allPlayersDone(state, turnOrder, maxStrokes)) {
        advanceHole(state, pack, turnOrder);
      }

      if ((state.phase as string) === "finished") {
        const outcome = computeOutcomeFromState(state, turnOrder);
        return {
          ok: true,
          nextPublicState: state as unknown as Record<string, unknown>,
          turnAdvance: false,
          terminal: {
            type: "win",
            winnerIds: outcome.winnerIds,
          },
        };
      }

      return {
        ok: true,
        nextPublicState: state as unknown as Record<string, unknown>,
        turnAdvance: true,
      };
    }

    // ── Handle shot (Phase 1: start rolling — no teleport, no turn advance) ──
    if (move.type === "shot") {
      const shot = move as ShotMove;

      // Reject if already rolling
      if (state.phase === "rolling") {
        return { ok: false, error: "A shot is already in progress." };
      }

      // Validate quantized inputs
      if (!isValidAngleQ(shot.angleQ)) {
        if (__DEV__)
          console.warn(
            "[MiniGolf/adapter] REJECTED: invalid angle",
            shot.angleQ,
          );
        return { ok: false, error: "Invalid angle." };
      }
      if (!isValidPowerQ(shot.powerQ)) {
        if (__DEV__)
          console.warn(
            "[MiniGolf/adapter] REJECTED: invalid power",
            shot.powerQ,
          );
        return { ok: false, error: "Invalid power." };
      }
      if (shot.powerQ === 0) {
        if (__DEV__) console.warn("[MiniGolf/adapter] REJECTED: zero power");
        return { ok: false, error: "Power must be greater than 0." };
      }

      // Get current ball position
      const currentPos = state.ballPosByUid[uid];

      // Run deterministic simulation to compute result
      const simResult = simulateShot(
        hole,
        currentPos,
        shot.angleQ,
        shot.powerQ,
      );

      // Increment strokes (immediately — the shot IS taken)
      state.strokesThisHoleByUid[uid] += 1;
      state.strokesTotalByUid[uid] += 1;

      // Update last shot metadata
      state.lastShotMeta[uid] = {
        wallContact: simResult.wallContact,
        bumperContact: simResult.bumperContact,
        sandContact: simResult.sandContact,
        sunk: simResult.sunk,
      };

      // Append events
      for (const evt of simResult.events) {
        if (state.events.length < 20) {
          state.events.push({ ...evt, uid });
        }
      }

      // Calculate rolling duration
      const rollDurationMs = Math.round(simResult.totalSteps * (1000 / 60));

      // Compute final position to store in rolling payload
      let finalPosQ: Vec2;
      if (simResult.penalty) {
        finalPosQ = { ...state.lastSafePosByUid[uid] };
      } else {
        finalPosQ = simResult.finalPos;
      }

      // Set rolling state — ball stays at startPos, NO teleport
      const rolling: RollingPayload = {
        shotId: `${uid}_${Date.now()}_${shot.angleQ}_${shot.powerQ}`,
        uid,
        holeId: state.holeId,
        startPos: { ...currentPos },
        angleQ: shot.angleQ,
        powerQ: shot.powerQ,
        startedAtMs: Date.now(),
        rollDurationMs,
        finalPosQ,
        sunk: simResult.sunk,
        penalty: simResult.penalty,
        penaltyType: simResult.penaltyType,
        totalSteps: simResult.totalSteps,
      };

      state.phase = "rolling";
      state.rolling = rolling;
      // Ball position stays at currentPos — NOT updated yet

      // Trim events
      if (state.events.length > 20) {
        state.events = state.events.slice(-20);
      }

      // DO NOT advance turn — the roller still "owns" the turn
      return {
        ok: true,
        nextPublicState: state as unknown as Record<string, unknown>,
        turnAdvance: false,
      };
    }

    // ── Handle finish_roll (Phase 2: commit result + advance turn) ────
    if (move.type === "finish_roll") {
      const finishMove = move as FinishRollMove;

      // Validate rolling state
      if (state.phase !== "rolling" || !state.rolling) {
        // Idempotent: if already committed, just succeed
        return {
          ok: true,
          nextPublicState: state as unknown as Record<string, unknown>,
          turnAdvance: false,
        };
      }

      const r = state.rolling;

      // Validate shotId matches
      if (r.shotId !== finishMove.shotId) {
        return { ok: false, error: "Shot ID mismatch." };
      }

      const rollingUid = r.uid;

      // Apply penalty
      if (r.penalty) {
        state.penaltiesByUid[rollingUid] += 1;
        state.strokesThisHoleByUid[rollingUid] += 1; // penalty stroke
        state.strokesTotalByUid[rollingUid] += 1;
        state.ballPosByUid[rollingUid] = {
          ...state.lastSafePosByUid[rollingUid],
        };
      } else if (r.sunk) {
        state.ballSunkByUid[rollingUid] = true;
        state.ballPosByUid[rollingUid] = r.finalPosQ;
        state.holeScoresByUid[rollingUid][state.holeId] =
          state.strokesThisHoleByUid[rollingUid];

        // Track holes-in-one and birdies
        if (state.strokesThisHoleByUid[rollingUid] === 1) {
          state.holesInOneByUid[rollingUid] =
            (state.holesInOneByUid[rollingUid] || 0) + 1;
        }
        if (state.strokesThisHoleByUid[rollingUid] < state.holePar) {
          state.birdiesByUid[rollingUid] =
            (state.birdiesByUid[rollingUid] || 0) + 1;
        }
      } else {
        // Ball stopped normally
        state.ballPosByUid[rollingUid] = r.finalPosQ;
        state.lastSafePosByUid[rollingUid] = r.finalPosQ;
      }

      // Check max strokes
      if (
        state.strokesThisHoleByUid[rollingUid] >= maxStrokes &&
        !state.ballSunkByUid[rollingUid]
      ) {
        state.ballSunkByUid[rollingUid] = true;
        state.holeScoresByUid[rollingUid][state.holeId] = maxStrokes;
      }

      // Clear rolling state
      state.rolling = null;
      state.phase = "aim";

      // Check if all players done this hole
      if (allPlayersDone(state, turnOrder, maxStrokes)) {
        advanceHole(state, pack, turnOrder);
      }

      // Trim events
      if (state.events.length > 20) {
        state.events = state.events.slice(-20);
      }

      if ((state.phase as string) === "finished") {
        const outcome = computeOutcomeFromState(state, turnOrder);
        return {
          ok: true,
          nextPublicState: state as unknown as Record<string, unknown>,
          turnAdvance: false,
          terminal: {
            type: "win",
            winnerIds: outcome.winnerIds,
          },
        };
      }

      // NOW advance turn
      return {
        ok: true,
        nextPublicState: state as unknown as Record<string, unknown>,
        turnAdvance: true,
      };
    }

    // ── Handle next_hole_ready (no-op acknowledged) ─────────────────
    if (move.type === "next_hole_ready") {
      return {
        ok: true,
        nextPublicState: state as unknown as Record<string, unknown>,
        turnAdvance: false,
      };
    }

    return { ok: false, error: "Unknown move type." };
  },

  // ── Summary ─────────────────────────────────────────────────────────

  computeSummary(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; displayName: string }>,
    currentTurnPlayerId: string | null,
  ) {
    const state = publicState as unknown as MiniGolfPublicState;
    return {
      turnPlayerId: currentTurnPlayerId,
      scoreSummary: players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        score: -(state.strokesTotalByUid[p.uid] || 0),
      })),
    };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = publicState as unknown as MiniGolfPublicState;
    const uids = players.map((p) => p.uid);
    return computeOutcomeFromState(state, uids);
  },

  // ── Spectator View ──────────────────────────────────────────────────

  getSpectatorView(
    publicState: Record<string, unknown>,
  ): Record<string, unknown> {
    return publicState; // full state, no hidden info
  },

  // ── Performance Metrics ─────────────────────────────────────────────

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as MiniGolfPublicState;
    let totalStrokes = 0;
    for (const p of players) {
      totalStrokes += state.strokesTotalByUid[p.uid] || 0;
    }
    return {
      totalMoves: totalStrokes,
      totalStrokes,
      holesPlayed: state.holeIndex + 1,
    };
  },

  // ── Settings Validation ─────────────────────────────────────────────

  validateSettings(patch: Record<string, unknown>): Record<string, unknown> {
    const result = { ...patch };
    if (result.holeCount !== undefined) {
      const hc = result.holeCount as number;
      if (![3, 5, 9, 18].includes(hc)) result.holeCount = 3;
    }
    if (result.maxStrokesPerHole !== undefined) {
      const ms = result.maxStrokesPerHole as number;
      result.maxStrokesPerHole = Math.max(5, Math.min(15, Math.round(ms)));
    }
    return result;
  },
};

// =============================================================================
// Outcome helper (shared by validateMove terminal + computeOutcome)
// =============================================================================

function computeOutcomeFromState(
  state: MiniGolfPublicState,
  uids: string[],
): GameOutcome {
  // Score = negative total strokes (higher is better for leaderboard)
  const entries = uids.map((uid) => ({
    uid,
    strokes: state.strokesTotalByUid[uid] || 0,
    score: -(state.strokesTotalByUid[uid] || 0),
    penalties: state.penaltiesByUid[uid] || 0,
    holesInOne: state.holesInOneByUid[uid] || 0,
    birdies: state.birdiesByUid[uid] || 0,
  }));

  // Sort by strokes ascending (fewest strokes = best)
  entries.sort((a, b) => a.strokes - b.strokes);

  // Assign placements with tie support
  let placement = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].strokes > entries[i - 1].strokes) {
      placement = i + 1;
    }
    (entries[i] as any).placement = placement;
  }

  // Winners = all with placement 1
  const winnerIds = entries
    .filter((e) => (e as any).placement === 1)
    .map((e) => e.uid);

  return {
    winnerIds,
    finalScoreboard: entries.map((e) => ({
      uid: e.uid,
      score: e.score,
      placement: (e as any).placement as number,
      stats: {
        strokes: e.strokes,
        penalties: e.penalties,
        holesInOne: e.holesInOne,
        birdies: e.birdies,
      },
    })),
  };
}

// Auto-register on import
registerAdapter(minigolfAdapter);

export default minigolfAdapter;
