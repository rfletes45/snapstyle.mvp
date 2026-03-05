/**
 * Games V4 — Battleship Adapter
 *
 * Full turn-based adapter for Battleship, following the V4 GameAdapterV4 contract.
 * Self-registers via registerAdapter() on import.
 *
 * Hidden-information model:
 *   - Fleet placements are ONLY in PrivateState (per-player, owner-only read).
 *   - PublicState contains shots, stats, phase — safe for spectators.
 *   - Spectators see fog-of-war during play, full reveal after resolution.
 *
 * Move types:
 *   place_fleet — setup phase (writes PrivateState, marks ready in PublicState)
 *   fire        — battle phase (single shot)
 *   salvo_fire  — battle phase (multi-shot, equal to alive ships)
 *   resign      — any phase
 *
 * @module gamesV4/adapters/battleship/battleshipAdapter
 */

import type {
  GameAdapterV4,
  GameOutcome,
  MoveValidationResult,
  SettingsFieldDef,
} from "../../types/adapter";
import { registerAdapter } from "../registry";
import {
  buildPrivateStateFromPlacements,
  computeFleetScore,
  computeShipCells,
  createEmptyPrivateState,
  createInitialBattleshipPublicState,
  getOpponentUid,
  pickStartingPlayer,
  resolveShot,
  updatePlayerStats,
  validateFleetPlacement,
} from "./battleshipEngine";
import type {
  BattleshipMovePayload,
  BattleshipPrivateState,
  BattleshipPublicState,
  BattleshipSettings,
  PlayerStats,
  ShipPlacement,
  ShotRecord,
} from "./battleshipTypes";
import {
  DEFAULT_BATTLESHIP_SETTINGS,
  getFleetForPreset,
} from "./battleshipTypes";

// =============================================================================
// Helpers
// =============================================================================

function asPublicState(raw: Record<string, unknown>): BattleshipPublicState {
  return raw as unknown as BattleshipPublicState;
}

function asRecord(state: BattleshipPublicState): Record<string, unknown> {
  return state as unknown as Record<string, unknown>;
}

function asPrivateMap(
  raw: Record<string, Record<string, unknown>>,
): Record<string, BattleshipPrivateState> {
  return raw as unknown as Record<string, BattleshipPrivateState>;
}

function privateToRecord(
  map: Record<string, BattleshipPrivateState>,
): Record<string, Record<string, unknown>> {
  return map as unknown as Record<string, Record<string, unknown>>;
}

function mergeSettings(patch: Record<string, unknown>): BattleshipSettings {
  const d = DEFAULT_BATTLESHIP_SETTINGS;
  return {
    gridSize: [8, 10, 12].includes(patch.gridSize as number)
      ? (patch.gridSize as 8 | 10 | 12)
      : d.gridSize,
    fleetPreset: ["classic_5", "compact_4"].includes(
      patch.fleetPreset as string,
    )
      ? (patch.fleetPreset as "classic_5" | "compact_4")
      : d.fleetPreset,
    allowAdjacentShips:
      typeof patch.allowAdjacentShips === "boolean"
        ? patch.allowAdjacentShips
        : d.allowAdjacentShips,
    turnRule: "alternate",
    shotMode: ["single", "salvo"].includes(patch.shotMode as string)
      ? (patch.shotMode as "single" | "salvo")
      : d.shotMode,
    setupTimeLimitSec: [0, 60, 90, 120].includes(
      patch.setupTimeLimitSec as number,
    )
      ? (patch.setupTimeLimitSec as number)
      : d.setupTimeLimitSec,
    turnTimeLimitSec: [0, 30, 45, 60].includes(patch.turnTimeLimitSec as number)
      ? (patch.turnTimeLimitSec as number)
      : d.turnTimeLimitSec,
    autoResolveOnTimeout:
      typeof patch.autoResolveOnTimeout === "boolean"
        ? patch.autoResolveOnTimeout
        : d.autoResolveOnTimeout,
    spectatorRevealPolicy: ["no_reveal_live", "post_game_reveal_only"].includes(
      patch.spectatorRevealPolicy as string,
    )
      ? (patch.spectatorRevealPolicy as
          | "no_reveal_live"
          | "post_game_reveal_only")
      : d.spectatorRevealPolicy,
    confirmBeforeFire:
      typeof patch.confirmBeforeFire === "boolean"
        ? patch.confirmBeforeFire
        : d.confirmBeforeFire,
    haptics: typeof patch.haptics === "boolean" ? patch.haptics : d.haptics,
    showHeatmapHint:
      typeof patch.showHeatmapHint === "boolean"
        ? patch.showHeatmapHint
        : d.showHeatmapHint,
  };
}

// =============================================================================
// Settings Schema (for Lobby UI)
// =============================================================================

const SETTINGS_SCHEMA: SettingsFieldDef[] = [
  {
    key: "gridSize",
    label: "Grid Size",
    type: "select",
    default: 10,
    options: [
      { label: "8×8 (Quick)", value: 8 },
      { label: "10×10 (Classic)", value: 10 },
      { label: "12×12 (Large)", value: 12 },
    ],
  },
  {
    key: "fleetPreset",
    label: "Fleet",
    type: "select",
    default: "classic_5",
    options: [
      { label: "Classic (5 ships)", value: "classic_5" },
      { label: "Compact (4 ships)", value: "compact_4" },
    ],
  },
  {
    key: "allowAdjacentShips",
    label: "Allow Adjacent Ships",
    type: "boolean",
    default: true,
  },
  {
    key: "shotMode",
    label: "Shot Mode",
    type: "select",
    default: "single",
    options: [
      { label: "Single Shot", value: "single" },
      { label: "Salvo (ships = shots)", value: "salvo" },
    ],
  },
  {
    key: "setupTimeLimitSec",
    label: "Setup Timer",
    type: "select",
    default: 90,
    options: [
      { label: "No Limit", value: 0 },
      { label: "60s", value: 60 },
      { label: "90s", value: 90 },
      { label: "120s", value: 120 },
    ],
  },
  {
    key: "turnTimeLimitSec",
    label: "Turn Timer",
    type: "select",
    default: 45,
    options: [
      { label: "No Limit", value: 0 },
      { label: "30s", value: 30 },
      { label: "45s", value: 45 },
      { label: "60s", value: 60 },
    ],
  },
  {
    key: "autoResolveOnTimeout",
    label: "Timeout = Forfeit",
    type: "boolean",
    default: true,
  },
  {
    key: "spectatorRevealPolicy",
    label: "Spectator Reveal",
    type: "select",
    default: "no_reveal_live",
    options: [
      { label: "No reveal during game", value: "no_reveal_live" },
      { label: "Reveal after game ends", value: "post_game_reveal_only" },
    ],
  },
  {
    key: "confirmBeforeFire",
    label: "Confirm Before Fire",
    type: "boolean",
    default: true,
  },
  {
    key: "haptics",
    label: "Haptics",
    type: "boolean",
    default: true,
  },
];

// =============================================================================
// Adapter Implementation
// =============================================================================

const battleshipAdapter: GameAdapterV4 = {
  gameId: "battleship",
  runtimeType: "turnBased",
  maxPlayers: 2,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "public_only",

  scoreboardDescriptor: {
    title: "BATTLE RESULT",
    formatScore: (s: number) => `${s} pts`,
    sortDirection: "desc",
  },

  settingsSchema: SETTINGS_SCHEMA,
  defaultSettings: DEFAULT_BATTLESHIP_SETTINGS as unknown as Record<
    string,
    unknown
  >,

  // ── State Creation ──────────────────────────────────────────────────

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const s = mergeSettings(settings);
    return asRecord(createInitialBattleshipPublicState(players, s));
  },

  createInitialPrivateState(
    players: Array<{ uid: string; slotIndex: number }>,
    _settings: Record<string, unknown>,
  ): Record<string, Record<string, unknown>> {
    const result: Record<string, BattleshipPrivateState> = {};
    for (const p of players) {
      result[p.uid] = createEmptyPrivateState();
    }
    return privateToRecord(result);
  },

  // ── Move Validation ─────────────────────────────────────────────────

  validateMove(
    publicState: Record<string, unknown>,
    privateStateByPlayer: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult {
    const state = asPublicState(publicState);
    const privateMap = asPrivateMap(privateStateByPlayer);
    const payload = movePayload as unknown as BattleshipMovePayload;
    const uid = ctx.uid;
    const settings = mergeSettings(ctx.settings);
    const fleet = getFleetForPreset(settings.fleetPreset);

    // ── Already resolved ─────────────────────────────────────────────
    if (state.phase === "resolved") {
      return { ok: false, error: "Game is already over." };
    }

    // ── Resign ───────────────────────────────────────────────────────
    if (payload.action === "resign") {
      const opponentUid = getOpponentUid(uid, ctx.turnOrder);
      const finalStats = { ...state.statsByUid };
      const newState: BattleshipPublicState = {
        ...state,
        phase: "resolved",
        currentTurnUid: null,
        lastEvent: `${uid} resigned`,
        moveCount: state.moveCount + 1,
        resolved: {
          winnerUid: opponentUid,
          reason: "resign",
          finalStatsByUid: finalStats,
        },
      };
      return {
        ok: true,
        nextPublicState: asRecord(newState),
        turnAdvance: false,
        terminal: {
          type: "win",
          winnerIds: [opponentUid],
          reason: "resign",
        },
      };
    }

    // ── Place Fleet ──────────────────────────────────────────────────
    if (payload.action === "place_fleet") {
      if (state.phase !== "setup") {
        return {
          ok: false,
          error: "Fleet placement only allowed during setup.",
        };
      }
      if (state.setup.readyByUid[uid]) {
        return { ok: false, error: "You have already placed your fleet." };
      }
      if (!ctx.turnOrder.includes(uid)) {
        return { ok: false, error: "You are not a player in this game." };
      }

      // Validate placements
      const validation = validateFleetPlacement(
        payload.placements,
        settings.gridSize,
        settings.fleetPreset,
        settings.allowAdjacentShips,
      );
      if (!validation.valid) {
        return { ok: false, error: validation.error };
      }

      // Normalize placements (recompute cells to prevent tampering)
      const normalizedPlacements: ShipPlacement[] = payload.placements.map(
        (p) => ({
          ...p,
          cells: computeShipCells(p.startRow, p.startCol, p.size, p.direction),
        }),
      );

      // Build private state
      const newPrivate = buildPrivateStateFromPlacements(normalizedPlacements);

      // Update public state
      const newSetup = {
        readyByUid: { ...state.setup.readyByUid, [uid]: true },
        readyAtByUid: { ...state.setup.readyAtByUid, [uid]: Date.now() },
      };

      // Check if both players are ready
      const allReady = ctx.turnOrder.every(
        (pUid) => pUid === uid || state.setup.readyByUid[pUid],
      );

      let newState: BattleshipPublicState;
      if (allReady) {
        // Transition to battle phase
        const startingPlayer = pickStartingPlayer(ctx.turnOrder);
        newState = {
          ...state,
          phase: "battle",
          setup: newSetup,
          turnNumber: 1,
          currentTurnUid: startingPlayer,
          lastEvent: "Battle begins!",
          moveCount: state.moveCount + 1,
        };
      } else {
        newState = {
          ...state,
          setup: newSetup,
          lastEvent: `${uid} is ready`,
          moveCount: state.moveCount + 1,
        };
      }

      // Return private state changes
      const newPrivateMap = { ...privateMap, [uid]: newPrivate };

      console.log(
        `[gamesV4][DEBUG][BS-Client] place_fleet: uid=${uid}, allReady=${allReady}, newState.phase=${newState.phase}, newState.currentTurnUid=${newState.currentTurnUid}, newState.moveCount=${newState.moveCount}, turnAdvance=true, turnOrder=${JSON.stringify(ctx.turnOrder)}`,
      );

      return {
        ok: true,
        nextPublicState: asRecord(newState),
        nextPrivateState: privateToRecord(newPrivateMap),
        // turnAdvance: true lets both players submit place_fleet in
        // alternating turns. On allReady, round-robin from index 1
        // wraps to index 0, matching adapter's currentTurnUid.
        turnAdvance: true,
      };
    }

    // ── Fire (Single Shot) ───────────────────────────────────────────
    if (payload.action === "fire") {
      if (state.phase !== "battle") {
        return { ok: false, error: "Can only fire during battle phase." };
      }
      if (state.rules.shotMode !== "single") {
        return { ok: false, error: "Use salvo_fire in salvo mode." };
      }
      if (state.currentTurnUid !== uid) {
        return { ok: false, error: "Not your turn." };
      }

      const { r, c } = payload.target;
      if (
        typeof r !== "number" ||
        typeof c !== "number" ||
        r < 0 ||
        r >= state.rules.gridSize ||
        c < 0 ||
        c >= state.rules.gridSize
      ) {
        return { ok: false, error: "Target out of bounds." };
      }

      const defenderUid = getOpponentUid(uid, ctx.turnOrder);
      const cellKey = `${r},${c}`;

      // Check already shot
      if (state.shotsByDefender[defenderUid]?.[cellKey]) {
        return { ok: false, error: "Cell already targeted." };
      }

      // Resolve shot against defender's private state
      const defenderPrivate = privateMap[defenderUid];
      if (!defenderPrivate) {
        // Can happen during optimistic local validation on client —
        // we don't have the opponent's private state. Allow optimistically.
        return { ok: true, turnAdvance: true };
      }

      const shotRes = resolveShot(r, c, defenderPrivate, fleet);

      // Build shot record
      const shotRecord: ShotRecord = {
        by: uid,
        result: shotRes.result,
        ...(shotRes.result === "sunk"
          ? { shipId: shotRes.shipId, shipSize: shotRes.shipSize }
          : {}),
        atTurn: state.turnNumber,
        ts: Date.now(),
      };

      // Update shots
      const newShotsByDefender = { ...state.shotsByDefender };
      newShotsByDefender[defenderUid] = {
        ...newShotsByDefender[defenderUid],
        [cellKey]: shotRecord,
      };

      // Update stats
      const attackerStats = updatePlayerStats(
        state.statsByUid[uid],
        shotRes.result,
        true,
      );
      attackerStats.turnsTaken += 1;
      const defenderStats = updatePlayerStats(
        state.statsByUid[defenderUid],
        shotRes.result,
        false,
      );

      const newStats = {
        ...state.statsByUid,
        [uid]: attackerStats,
        [defenderUid]: defenderStats,
      };

      // Build event text
      const colLetter = String.fromCharCode(65 + c);
      const rowLabel = r + 1;
      const eventText =
        shotRes.result === "sunk"
          ? `${colLetter}${rowLabel} — SUNK!`
          : shotRes.result === "hit"
            ? `${colLetter}${rowLabel} — HIT`
            : `${colLetter}${rowLabel} — Miss`;

      // Update private state
      const newPrivateMap = {
        ...privateMap,
        [defenderUid]: shotRes.defenderPrivateState,
      };

      // Check win condition
      if (shotRes.defenderPrivateState.aliveShips.length === 0) {
        // All ships sunk — game over
        const newState: BattleshipPublicState = {
          ...state,
          phase: "resolved",
          shotsByDefender: newShotsByDefender,
          statsByUid: newStats,
          currentTurnUid: null,
          lastEvent: `All ships sunk! ${uid} wins!`,
          moveCount: state.moveCount + 1,
          resolved: {
            winnerUid: uid,
            reason: "all_ships_sunk",
            finalStatsByUid: newStats,
            reveal: {
              placementsByUid: {
                [uid]: privateMap[uid]?.placements ?? [],
                [defenderUid]: shotRes.defenderPrivateState.placements ?? [],
              },
            },
          },
        };

        return {
          ok: true,
          nextPublicState: asRecord(newState),
          nextPrivateState: privateToRecord(newPrivateMap),
          turnAdvance: false,
          terminal: {
            type: "win",
            winnerIds: [uid],
            reason: "all_ships_sunk",
          },
        };
      }

      // Continue — advance turn
      const nextTurnUid = getOpponentUid(uid, ctx.turnOrder);
      const newState: BattleshipPublicState = {
        ...state,
        shotsByDefender: newShotsByDefender,
        statsByUid: newStats,
        turnNumber: state.turnNumber + 1,
        currentTurnUid: nextTurnUid,
        lastEvent: eventText,
        moveCount: state.moveCount + 1,
      };

      return {
        ok: true,
        nextPublicState: asRecord(newState),
        nextPrivateState: privateToRecord(newPrivateMap),
        turnAdvance: true,
      };
    }

    // ── Salvo Fire ───────────────────────────────────────────────────
    if (payload.action === "salvo_fire") {
      if (state.phase !== "battle") {
        return { ok: false, error: "Can only fire during battle phase." };
      }
      if (state.rules.shotMode !== "salvo") {
        return { ok: false, error: "Salvo mode is not enabled." };
      }
      if (state.currentTurnUid !== uid) {
        return { ok: false, error: "Not your turn." };
      }

      const attackerPrivate = privateMap[uid];
      if (!attackerPrivate) {
        // Optimistic: allow
        return { ok: true, turnAdvance: true };
      }

      const allowedShots = attackerPrivate.aliveShips.length;
      if (payload.targets.length !== allowedShots) {
        return {
          ok: false,
          error: `Salvo requires exactly ${allowedShots} targets (ships remaining).`,
        };
      }

      // Validate all targets
      const defenderUid = getOpponentUid(uid, ctx.turnOrder);
      const targetKeys = new Set<string>();
      for (const t of payload.targets) {
        if (
          typeof t.r !== "number" ||
          typeof t.c !== "number" ||
          t.r < 0 ||
          t.r >= state.rules.gridSize ||
          t.c < 0 ||
          t.c >= state.rules.gridSize
        ) {
          return { ok: false, error: "Target out of bounds." };
        }
        const key = `${t.r},${t.c}`;
        if (targetKeys.has(key)) {
          return { ok: false, error: "Duplicate target in salvo." };
        }
        if (state.shotsByDefender[defenderUid]?.[key]) {
          return { ok: false, error: `Cell ${key} already targeted.` };
        }
        targetKeys.add(key);
      }

      // Resolve all shots
      let defenderPriv = privateMap[defenderUid];
      if (!defenderPriv) {
        return { ok: true, turnAdvance: true };
      }

      const newShotsByDefender = { ...state.shotsByDefender };
      newShotsByDefender[defenderUid] = {
        ...newShotsByDefender[defenderUid],
      };

      let attackerStats = { ...state.statsByUid[uid] };
      let defenderStats = { ...state.statsByUid[defenderUid] };
      const events: string[] = [];

      for (const t of payload.targets) {
        const cellKey = `${t.r},${t.c}`;
        const shotRes = resolveShot(t.r, t.c, defenderPriv, fleet);

        const shotRecord: ShotRecord = {
          by: uid,
          result: shotRes.result,
          ...(shotRes.result === "sunk"
            ? { shipId: shotRes.shipId, shipSize: shotRes.shipSize }
            : {}),
          atTurn: state.turnNumber,
          ts: Date.now(),
        };

        newShotsByDefender[defenderUid][cellKey] = shotRecord;
        defenderPriv = shotRes.defenderPrivateState;

        attackerStats = updatePlayerStats(attackerStats, shotRes.result, true);
        defenderStats = updatePlayerStats(defenderStats, shotRes.result, false);

        const colLetter = String.fromCharCode(65 + t.c);
        events.push(`${colLetter}${t.r + 1}:${shotRes.result}`);
      }

      attackerStats.turnsTaken += 1;

      const newStats = {
        ...state.statsByUid,
        [uid]: attackerStats,
        [defenderUid]: defenderStats,
      };
      const newPrivateMap = {
        ...privateMap,
        [defenderUid]: defenderPriv,
      };

      // Check win
      if (defenderPriv.aliveShips.length === 0) {
        const newState: BattleshipPublicState = {
          ...state,
          phase: "resolved",
          shotsByDefender: newShotsByDefender,
          statsByUid: newStats,
          currentTurnUid: null,
          lastEvent: `Salvo sinks all ships! ${uid} wins!`,
          moveCount: state.moveCount + 1,
          resolved: {
            winnerUid: uid,
            reason: "all_ships_sunk",
            finalStatsByUid: newStats,
            reveal: {
              placementsByUid: {
                [uid]: privateMap[uid]?.placements ?? [],
                [defenderUid]: defenderPriv.placements ?? [],
              },
            },
          },
        };
        return {
          ok: true,
          nextPublicState: asRecord(newState),
          nextPrivateState: privateToRecord(newPrivateMap),
          turnAdvance: false,
          terminal: {
            type: "win",
            winnerIds: [uid],
            reason: "all_ships_sunk",
          },
        };
      }

      const nextTurnUid = getOpponentUid(uid, ctx.turnOrder);
      const newState: BattleshipPublicState = {
        ...state,
        shotsByDefender: newShotsByDefender,
        statsByUid: newStats,
        turnNumber: state.turnNumber + 1,
        currentTurnUid: nextTurnUid,
        lastEvent: `Salvo: ${events.join(", ")}`,
        moveCount: state.moveCount + 1,
      };

      return {
        ok: true,
        nextPublicState: asRecord(newState),
        nextPrivateState: privateToRecord(newPrivateMap),
        turnAdvance: true,
      };
    }

    return {
      ok: false,
      error: `Unknown action: ${(payload as Record<string, unknown>).action}`,
    };
  },

  // ── Summary (for invite card) ───────────────────────────────────────

  computeSummary(publicState, players, currentTurnPlayerId) {
    const state = asPublicState(publicState);
    return {
      turnPlayerId: state.currentTurnUid ?? currentTurnPlayerId,
      scoreSummary: players.map((p) => {
        const stats = state.statsByUid[p.uid];
        return {
          uid: p.uid,
          displayName: p.displayName,
          score: stats?.shipsSunk ?? 0,
        };
      }),
    };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(publicState, players): GameOutcome {
    const state = asPublicState(publicState);
    const winnerUid = state.resolved?.winnerUid;

    if (winnerUid) {
      const winnerId = winnerUid;
      const loserId = players.find((p) => p.uid !== winnerId)?.uid ?? "";
      const winnerStats = state.statsByUid[winnerId] ?? emptyStats();
      const loserStats = state.statsByUid[loserId] ?? emptyStats();

      return {
        winnerIds: [winnerId],
        finalScoreboard: [
          {
            uid: winnerId,
            score: computeFleetScore(winnerStats, true),
            placement: 1,
            stats: {
              ...winnerStats,
              winBy: state.resolved?.reason ?? "unknown",
              gridSize: state.rules.gridSize,
              fleetPreset: state.rules.fleetPreset,
              shotMode: state.rules.shotMode,
            } as Record<string, unknown>,
          },
          {
            uid: loserId,
            score: computeFleetScore(loserStats, false),
            placement: 2,
            stats: {
              ...loserStats,
              gridSize: state.rules.gridSize,
              fleetPreset: state.rules.fleetPreset,
              shotMode: state.rules.shotMode,
            } as Record<string, unknown>,
          },
        ],
      };
    }

    // No winner (shouldn't happen in Battleship, but handle gracefully)
    return {
      winnerIds: [],
      finalScoreboard: players.map((p) => ({
        uid: p.uid,
        score: 0,
        placement: 1,
        stats: (state.statsByUid[p.uid] ?? {}) as unknown as Record<
          string,
          unknown
        >,
      })),
    };
  },

  // ── Spectator View ──────────────────────────────────────────────────

  getSpectatorView(publicState): Record<string, unknown> {
    // PublicState is already safe — no placements are stored here mid-game.
    // Only strip reveal data during ongoing game (shouldn't be present, but guard).
    const state = asPublicState(publicState);
    if (state.phase !== "resolved" && state.resolved?.reveal) {
      const { reveal, ...safeResolved } = state.resolved;
      return asRecord({ ...state, resolved: safeResolved });
    }
    return publicState;
  },

  // ── Performance Metrics ─────────────────────────────────────────────

  extractPerformanceMetrics(publicState, players): Record<string, unknown> {
    const state = asPublicState(publicState);
    return {
      totalMoves: state.moveCount,
      statsByUid: state.statsByUid,
      endedBy: state.resolved?.reason ?? "unknown",
      gridSize: state.rules.gridSize,
      fleetPreset: state.rules.fleetPreset,
      shotMode: state.rules.shotMode,
      turnNumber: state.turnNumber,
    };
  },

  // ── Settings Validation ─────────────────────────────────────────────

  validateSettings(patch: Record<string, unknown>): Record<string, unknown> {
    return mergeSettings(patch) as unknown as Record<string, unknown>;
  },
};

function emptyStats(): PlayerStats {
  return {
    hits: 0,
    misses: 0,
    accuracy: 0,
    shipsRemaining: 0,
    shipsSunk: 0,
    turnsTaken: 0,
  };
}

// Auto-register on import
registerAdapter(battleshipAdapter);

export default battleshipAdapter;
