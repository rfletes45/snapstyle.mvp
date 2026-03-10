/**
 * Games V4 — Pong Adapter (Client)
 *
 * Minimal client adapter for the realtime Pong game.
 * The room is authoritative; this adapter advertises identity,
 * settings schema, and provides summary/outcome formatting helpers.
 *
 * @module gamesV4/adapters/pong
 */

import type {
  GameAdapterV4,
  GameOutcome,
  SettingsFieldDef,
} from "../types/adapter";
import { registerAdapter } from "./registry";

// =============================================================================
// Public State Shape (bootstrap / Firebase mirror)
// =============================================================================

export interface PongPublicState {
  phase:
    | "waiting"
    | "countdown"
    | "serve"
    | "live"
    | "point_scored"
    | "match_end"
    | "aborted";
  leftPlayerId: string;
  rightPlayerId: string;
  scores: Record<string, number>;
}

// =============================================================================
// Settings Schema
// =============================================================================

const SETTINGS_SCHEMA: SettingsFieldDef[] = [
  {
    key: "scoreToWin",
    label: "Score to Win",
    type: "select",
    default: 7,
    options: [
      { label: "5", value: 5 },
      { label: "7", value: 7 },
      { label: "11", value: 11 },
    ],
    helperText: "First to this score wins",
  },
  {
    key: "winByTwo",
    label: "Win By Two",
    type: "boolean",
    default: false,
    helperText: "Require a 2-point lead to win",
  },
  {
    key: "ballSpeedPreset",
    label: "Ball Speed",
    type: "select",
    default: "normal",
    options: [
      { label: "Normal", value: "normal" },
      { label: "Fast", value: "fast" },
    ],
  },
  {
    key: "paddleSizePreset",
    label: "Paddle Size",
    type: "select",
    default: "normal",
    options: [
      { label: "Normal", value: "normal" },
      { label: "Large", value: "large" },
    ],
  },
  {
    key: "arenaTheme",
    label: "Arena Theme",
    type: "select",
    default: "classic",
    options: [
      { label: "Classic", value: "classic" },
      { label: "Neon", value: "neon" },
      { label: "Catppuccin", value: "catppuccin" },
    ],
  },
];

const DEFAULT_SETTINGS: Record<string, unknown> = {
  scoreToWin: 7,
  winByTwo: false,
  ballSpeedPreset: "normal",
  paddleSizePreset: "normal",
  arenaTheme: "classic",
};

// =============================================================================
// Adapter
// =============================================================================

const pongAdapter: GameAdapterV4 = {
  gameId: "pong_game",
  runtimeType: "realtime",
  maxPlayers: 2,
  minPlayers: 2,
  supportsSpectate: false,
  spectateMode: "public_only",

  scoreboardDescriptor: {
    title: "MATCH RESULT",
    formatScore: (s) => (s === 1 ? "Win" : s === 0 ? "Loss" : "Draw"),
    sortDirection: "desc",
  },

  settingsSchema: SETTINGS_SCHEMA,
  defaultSettings: DEFAULT_SETTINGS,

  createInitialPublicState(players, _settings) {
    const uids = players.map((p) => p.uid);
    return {
      phase: "waiting",
      leftPlayerId: uids[0] ?? "",
      rightPlayerId: uids[1] ?? "",
      scores: Object.fromEntries(uids.map((uid) => [uid, 0])),
    };
  },

  computeSummary(publicState, players, _currentTurnPlayerId) {
    const state = publicState as unknown as PongPublicState;
    return {
      turnPlayerId: null,
      scoreSummary: players.map((p) => ({
        uid: p.uid,
        displayName: p.uid,
        score: state.scores?.[p.uid] ?? 0,
      })),
    };
  },

  computeOutcome(publicState, players): GameOutcome {
    const state = publicState as unknown as PongPublicState;
    const scores = state.scores ?? {};

    // Sort by score descending
    const sorted = [...players].sort(
      (a, b) => (scores[b.uid] ?? 0) - (scores[a.uid] ?? 0),
    );

    const topScore = scores[sorted[0]?.uid] ?? 0;
    const winnerIds = sorted
      .filter((p) => (scores[p.uid] ?? 0) === topScore && topScore > 0)
      .map((p) => p.uid);

    return {
      winnerIds,
      finalScoreboard: sorted.map((p, i) => ({
        uid: p.uid,
        displayName: p.uid,
        score: winnerIds.includes(p.uid) ? 1 : 0,
        placement: i + 1,
        stats: {
          matchScore: scores[p.uid] ?? 0,
        },
      })),
    };
  },

  extractPerformanceMetrics(publicState, _players) {
    const state = publicState as unknown as PongPublicState;
    return {
      phase: state.phase,
      scores: state.scores,
    };
  },

  validateSettings(patch) {
    const result: Record<string, unknown> = {};

    if (patch.scoreToWin !== undefined) {
      result.scoreToWin = [5, 7, 11].includes(patch.scoreToWin as number)
        ? patch.scoreToWin
        : 7;
    }

    if (patch.winByTwo !== undefined) {
      result.winByTwo =
        typeof patch.winByTwo === "boolean" ? patch.winByTwo : false;
    }

    if (patch.ballSpeedPreset !== undefined) {
      result.ballSpeedPreset = ["normal", "fast"].includes(
        patch.ballSpeedPreset as string,
      )
        ? patch.ballSpeedPreset
        : "normal";
    }

    if (patch.paddleSizePreset !== undefined) {
      result.paddleSizePreset = ["normal", "large"].includes(
        patch.paddleSizePreset as string,
      )
        ? patch.paddleSizePreset
        : "normal";
    }

    if (patch.arenaTheme !== undefined) {
      result.arenaTheme = ["classic", "neon", "catppuccin"].includes(
        patch.arenaTheme as string,
      )
        ? patch.arenaTheme
        : "classic";
    }

    return result;
  },
};

registerAdapter(pongAdapter);
export default pongAdapter;
