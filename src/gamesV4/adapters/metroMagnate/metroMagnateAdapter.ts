/**
 * Games V4 — Metro Magnate Client Adapter
 *
 * Implements the GameAdapterV4 interface for Metro Magnate.
 * Take 1 — scaffold only. Engine logic (validateMove, computeOutcome) will
 * be implemented in Take 2.
 *
 * @module gamesV4/adapters/metroMagnate/metroMagnateAdapter
 */

import type {
  GameAdapterV4,
  MoveValidationResult,
  SettingsFieldDef,
} from "../../types/adapter";
import { registerAdapter } from "../registry";
import {
  BOARD_SIZE,
  CENTRAL_TERMINAL_INDEX,
  SECTORS,
} from "./metroMagnateBoard";
import { processMove } from "./metroMagnateEngine";
import type {
  MetroMagnateMovePayload,
  MetroMagnatePublicState,
  MetroMagnateSettings,
  MetroPlayerState,
} from "./metroMagnateTypes";
import { DEFAULT_METRO_MAGNATE_SETTINGS } from "./metroMagnateTypes";

// =============================================================================
// State Casting Helpers
// =============================================================================

function asPublicState(raw: Record<string, unknown>): MetroMagnatePublicState {
  return raw as unknown as MetroMagnatePublicState;
}
function asRecord(state: MetroMagnatePublicState): Record<string, unknown> {
  return state as unknown as Record<string, unknown>;
}

// =============================================================================
// Settings Schema (10 fields)
// =============================================================================

const SETTINGS_SCHEMA: SettingsFieldDef[] = [
  {
    key: "mode",
    label: "Mode",
    type: "select",
    default: "classic",
    options: [
      { label: "Classic", value: "classic" },
      { label: "Express", value: "express" },
    ],
    helperText:
      "Express mode starts with pre-dealt properties and higher cash.",
    group: "Game",
  },
  {
    key: "startingCapital",
    label: "Starting Capital",
    type: "number",
    default: 1500,
    min: 500,
    max: 5000,
    step: 100,
    helperText: "Each player's starting cash.",
    group: "Economy",
  },
  {
    key: "passSalary",
    label: "Pass Salary",
    type: "number",
    default: 200,
    min: 0,
    max: 500,
    step: 50,
    helperText: "Cash collected when passing Central Terminal.",
    group: "Economy",
  },
  {
    key: "auctionType",
    label: "Auction Type",
    type: "select",
    default: "english",
    options: [
      { label: "English (open bidding)", value: "english" },
      { label: "Sealed (one bid)", value: "sealed" },
    ],
    helperText: "How declined properties go to auction.",
    group: "Rules",
  },
  {
    key: "turnTimer",
    label: "Turn Timer",
    type: "select",
    default: "60s",
    options: [
      { label: "Off", value: "off" },
      { label: "30 seconds", value: "30s" },
      { label: "60 seconds", value: "60s" },
      { label: "90 seconds", value: "90s" },
      { label: "Unlimited", value: "unlimited" },
    ],
    helperText: "Time limit per turn. Auto-pass on timeout.",
    group: "Timing",
  },
  {
    key: "inspectionSeverity",
    label: "Inspection Severity",
    type: "select",
    default: "standard",
    options: [
      { label: "Lenient (1 turn)", value: "lenient" },
      { label: "Standard (3 turns or pay/card)", value: "standard" },
      { label: "Strict (must pay)", value: "strict" },
    ],
    helperText: "How Inspection Hold works.",
    group: "Rules",
  },
  {
    key: "improvementSupply",
    label: "Improvement Supply",
    type: "select",
    default: "unlimited",
    options: [
      { label: "Unlimited", value: "unlimited" },
      { label: "Limited (classic scarcity)", value: "limited" },
    ],
    helperText: "Whether improvements can run out.",
    group: "Rules",
  },
  {
    key: "plazaBonus",
    label: "Plaza Bonus",
    type: "boolean",
    default: true,
    helperText:
      "Collect accumulated Civic Fee pot when landing on Grand Plaza.",
    group: "Rules",
  },
  {
    key: "terminalExactBonus",
    label: "Terminal Exact Bonus",
    type: "boolean",
    default: false,
    helperText: "Double salary for landing exactly on Central Terminal.",
    group: "Rules",
  },
  {
    key: "tradeWindow",
    label: "Trade Window",
    type: "boolean",
    default: true,
    helperText: "Allow property trades between players during their turn.",
    group: "Rules",
  },
];

// =============================================================================
// Adapter Implementation
// =============================================================================

const metroMagnateAdapter: GameAdapterV4 = {
  gameId: "metro_magnate",
  runtimeType: "turnBased",
  maxPlayers: 6,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "public_only",
  scoreboardDescriptor: {
    title: "FINAL STANDING",
    formatScore: (s: number) => (s === 1 ? "Win" : "Loss"),
    sortDirection: "desc",
  },

  settingsSchema: SETTINGS_SCHEMA,
  defaultSettings: DEFAULT_METRO_MAGNATE_SETTINGS as unknown as Record<
    string,
    unknown
  >,

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const s = settings as unknown as MetroMagnateSettings;
    const sorted = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
    const turnOrder = sorted.map((p) => p.uid);

    const playerStates: MetroPlayerState[] = sorted.map((p) => ({
      uid: p.uid,
      position: CENTRAL_TERMINAL_INDEX,
      cash: s.startingCapital,
      ownedProperties: [],
      improvements: [],
      mortgagedProperties: [],
      inspectionPasses: 0,
      isBankrupt: false,
      bankruptTurn: -1,
      netWorth: s.startingCapital,
      timesPassedTerminal: 0,
    }));

    const emptyOrder = Array.from({ length: 16 }, (_, i) => i);

    const state: MetroMagnatePublicState = {
      boardId: "standard_36",
      players: playerStates,
      turnOrder,
      currentTurnIndex: 0,
      currentTurnUid: turnOrder[0],
      phase: "pre_roll",
      lastDice: null,
      doublesCount: 0,
      turnNumber: 1,
      moveCount: 0,
      activeAuction: null,
      activeTrade: null,
      propertyOwnership: [],
      propertyImprovements: [],
      propertyMortgages: [],
      inspectionHoldTurns: [],
      marketShiftDeckIndex: 0,
      cityBriefDeckIndex: 0,
      marketShiftOrder: emptyOrder,
      cityBriefOrder: emptyOrder,
      plazaPot: 0,
      debtContext: null,
      eliminationOrder: [],
      storefrontSupply: s.improvementSupply === "limited" ? 32 : 9999,
      towerSupply: s.improvementSupply === "limited" ? 12 : 9999,
      winnerUid: null,
      endReason: null,
      settings: s,
    };

    return state as unknown as Record<string, unknown>;
  },

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
    const state = asPublicState(publicState);
    const payload = movePayload as unknown as MetroMagnateMovePayload;
    const result = processMove(state, ctx.uid, payload);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const mvr: MoveValidationResult = {
      ok: true,
      nextPublicState: asRecord(result.state!),
      turnAdvance: false,
    };
    if (result.nextTurnPlayerId) {
      mvr.nextTurnPlayerId = result.nextTurnPlayerId;
    }
    if (result.terminal) {
      mvr.terminal = result.terminal;
    }
    return mvr;
  },

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ) {
    const state = publicState as unknown as MetroMagnatePublicState;
    const winner = state.winnerUid;
    const totalPlayers = players.length;

    // Build placement map: winner=1
    const placementMap = new Map<string, number>();
    if (winner) placementMap.set(winner, 1);

    // eliminationOrder is earliest-eliminated first → worst placement first
    const eliminated = state.eliminationOrder ?? [];
    for (let i = 0; i < eliminated.length; i++) {
      placementMap.set(eliminated[i], totalPlayers - i);
    }

    // For non-eliminated, non-winner players (express mode), sort by netWorth
    const unranked = players
      .map((p) => p.uid)
      .filter((uid) => !placementMap.has(uid));
    if (unranked.length > 0) {
      const sorted = [...unranked].sort((a, b) => {
        const pa = state.players.find((p) => p.uid === a);
        const pb = state.players.find((p) => p.uid === b);
        return (pb?.netWorth ?? 0) - (pa?.netWorth ?? 0);
      });
      // Assign placements starting at 2 (or after winner+eliminated)
      const startPlacement = 1 + eliminated.length + 1;
      for (let i = 0; i < sorted.length; i++) {
        placementMap.set(sorted[i], startPlacement + i);
      }
    }

    return {
      winnerIds: winner ? [winner] : [],
      finalScoreboard: players.map((p) => {
        const ps = state.players.find((pl) => pl.uid === p.uid);
        const isWinner = p.uid === winner;
        return {
          uid: p.uid,
          score: isWinner ? 1 : 0,
          placement: placementMap.get(p.uid) ?? totalPlayers,
          stats: {
            netWorth: ps?.netWorth ?? 0,
            propertiesOwned: ps?.ownedProperties.length ?? 0,
          },
        };
      }),
    };
  },

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as MetroMagnatePublicState;
    const transitIndices = [5, 16, 24, 35];
    const serviceIndices = [12, 27];
    const perPlayer: Record<string, Record<string, unknown>> = {};

    for (const p of players) {
      const ps = state.players.find((pl) => pl.uid === p.uid);
      if (!ps) continue;

      const ownedSet = new Set(ps.ownedProperties);
      let sectorsCompleted = 0;
      for (const sector of SECTORS) {
        if (sector.districtIndices.every((i) => ownedSet.has(i))) {
          sectorsCompleted++;
        }
      }

      let towersBuilt = 0;
      let totalImprovements = 0;
      for (const imp of state.propertyImprovements) {
        if (ownedSet.has(imp.spaceIndex)) {
          if (imp.level === 5) towersBuilt++;
          if (imp.level > 0) totalImprovements += imp.level;
        }
      }

      perPlayer[p.uid] = {
        netWorth: ps.netWorth,
        cash: ps.cash,
        propertiesOwned: ps.ownedProperties.length,
        sectorsCompleted,
        towersBuilt,
        totalImprovements,
        transitLinesOwned: transitIndices.filter((i) => ownedSet.has(i)).length,
        serviceNodesOwned: serviceIndices.filter((i) => ownedSet.has(i)).length,
        timesPassedTerminal: ps.timesPassedTerminal,
        isBankrupt: ps.isBankrupt,
        isWinner: state.winnerUid === p.uid,
        mortgagedCount: ps.mortgagedProperties.length,
      };
    }

    return {
      totalTurns: state.turnNumber,
      totalMoves: state.moveCount,
      boardSize: BOARD_SIZE,
      playerCount: players.length,
      eliminationOrder: state.eliminationOrder,
      mode: state.settings.mode,
      perPlayer,
    };
  },

  getSpectatorView(
    publicState: Record<string, unknown>,
  ): Record<string, unknown> {
    // All state is public in Metro Magnate.
    return publicState;
  },

  validateSettings(patch: Record<string, unknown>): Record<string, unknown> {
    const result = { ...DEFAULT_METRO_MAGNATE_SETTINGS } as Record<
      string,
      unknown
    >;

    if (patch.mode && ["classic", "express"].includes(patch.mode as string))
      result.mode = patch.mode;

    if (typeof patch.startingCapital === "number") {
      const c = Math.round(patch.startingCapital as number);
      result.startingCapital = Math.max(500, Math.min(5000, c));
    }

    if (typeof patch.passSalary === "number") {
      const s = Math.round(patch.passSalary as number);
      result.passSalary = Math.max(0, Math.min(500, s));
    }

    if (
      patch.auctionType &&
      ["english", "sealed"].includes(patch.auctionType as string)
    )
      result.auctionType = patch.auctionType;

    if (
      patch.turnTimer &&
      ["off", "30s", "60s", "90s", "unlimited"].includes(
        patch.turnTimer as string,
      )
    )
      result.turnTimer = patch.turnTimer;

    if (
      patch.inspectionSeverity &&
      ["lenient", "standard", "strict"].includes(
        patch.inspectionSeverity as string,
      )
    )
      result.inspectionSeverity = patch.inspectionSeverity;

    if (
      patch.improvementSupply &&
      ["unlimited", "limited"].includes(patch.improvementSupply as string)
    )
      result.improvementSupply = patch.improvementSupply;

    if (typeof patch.plazaBonus === "boolean")
      result.plazaBonus = patch.plazaBonus;

    if (typeof patch.terminalExactBonus === "boolean")
      result.terminalExactBonus = patch.terminalExactBonus;

    if (typeof patch.tradeWindow === "boolean")
      result.tradeWindow = patch.tradeWindow;

    return result;
  },
};

// =============================================================================
// Auto-register
// =============================================================================

registerAdapter(metroMagnateAdapter);
export default metroMagnateAdapter;
