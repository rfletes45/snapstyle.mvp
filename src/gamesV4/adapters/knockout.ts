/**
 * Games V4 — Knockout Client Adapter
 *
 * Minimal realtime adapter. Live gameplay runs in Colyseus;
 * this adapter handles bootstrap state, outcome formatting, and
 * settings validation for the Firebase session layer.
 *
 * @module gamesV4/adapters/knockout
 */

import type { SettingsFieldDef } from "@/gamesV4/types/adapter";
import { registerAdapter } from "./registry";

/**
 * Knockout public state shape stored in the Firebase session.
 * Minimal — the room is the live authority.
 */
export interface KnockoutPublicState {
  phase: "waiting" | "active" | "resolved";
  playerUids: string[];
  scores: Record<string, number>;
}

// =============================================================================
// Settings schema (surfaced in lobby)
// =============================================================================

export const KNOCKOUT_SETTINGS_SCHEMA: SettingsFieldDef[] = [
  {
    key: "planningTimerSec",
    label: "Planning Timer",
    type: "select",
    options: [
      { value: 6, label: "6 sec" },
      { value: 8, label: "8 sec" },
      { value: 10, label: "10 sec" },
      { value: 12, label: "12 sec" },
    ],
    default: 8,
  },
  {
    key: "shrinkSpeed",
    label: "Shrink Speed",
    type: "select",
    options: [
      { value: "normal", label: "Normal" },
      { value: "fast", label: "Fast" },
    ],
    default: "normal",
  },
];

// =============================================================================
// Adapter Registration
// =============================================================================

registerAdapter({
  gameId: "knockout_game",
  runtimeType: "realtime",
  maxPlayers: 8,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "full_state",

  settingsSchema: KNOCKOUT_SETTINGS_SCHEMA,

  defaultSettings: {
    planningTimerSec: 8,
    shrinkSpeed: "normal",
    maxPlayers: 8,
  },

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
  ): Record<string, unknown> {
    const scores: Record<string, number> = {};
    for (const p of players) scores[p.uid] = 0;
    return {
      phase: "waiting",
      playerUids: players.map((p) => p.uid),
      scores,
    };
  },

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ) {
    // Realtime games: outcome is computed from the resolution bridge payload
    // This is a fallback for Firebase-side if needed
    const scores = (publicState as Record<string, unknown>).scores as
      | Record<string, number>
      | undefined;

    if (!scores) {
      return {
        winnerIds: [],
        finalScoreboard: players.map((p, i) => ({
          uid: p.uid,
          score: 0,
          placement: i + 1,
          stats: {},
        })),
      };
    }

    const sorted = players
      .map((p) => ({ uid: p.uid, score: scores[p.uid] ?? 0 }))
      .sort((a, b) => b.score - a.score);

    const topScore = sorted[0]?.score ?? 0;
    const winnerIds =
      topScore > 0
        ? sorted.filter((s) => s.score === topScore).map((s) => s.uid)
        : [];

    return {
      winnerIds,
      finalScoreboard: sorted.map((s, i) => ({
        uid: s.uid,
        score: winnerIds.includes(s.uid) ? 1 : 0,
        placement: i + 1,
        stats: {},
      })),
    };
  },

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    return {
      playerCount: players.length,
    };
  },

  validateSettings(patch: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (patch.planningTimerSec !== undefined) {
      result.planningTimerSec = [6, 8, 10, 12].includes(
        patch.planningTimerSec as number,
      )
        ? patch.planningTimerSec
        : 8;
    }

    if (patch.shrinkSpeed !== undefined) {
      result.shrinkSpeed = ["normal", "fast"].includes(
        patch.shrinkSpeed as string,
      )
        ? patch.shrinkSpeed
        : "normal";
    }

    if (patch.maxPlayers !== undefined) {
      const mp = patch.maxPlayers as number;
      result.maxPlayers =
        typeof mp === "number" ? Math.max(2, Math.min(8, Math.round(mp))) : 8;
    }

    return result;
  },
});
