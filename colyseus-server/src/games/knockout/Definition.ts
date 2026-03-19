/**
 * Knockout — Game Definition
 *
 * RealtimeGameDefinition for the Knockout FFA physics game.
 * Declares lifecycle policies, settings, and message contracts.
 *
 * @module games/knockout/Definition
 */

import type {
  MessageDefinition,
  RealtimeGameDefinition,
} from "../../core/types";

// =============================================================================
// Message Definitions
// =============================================================================

const knockoutMessages: MessageDefinition[] = [
  {
    type: "submit_move",
    validate: (payload: unknown) => {
      const p = payload as Record<string, unknown>;
      if (!p || typeof p !== "object") return "Invalid payload";
      if (typeof p.dx !== "number" || typeof p.dy !== "number")
        return "dx and dy must be numbers";
      // Validate direction is unit-ish (client sends normalized)
      const mag = Math.sqrt((p.dx as number) ** 2 + (p.dy as number) ** 2);
      if (mag < 0.01) return "Direction too small";
      if (mag > 1.5) return "Direction magnitude too large";
      // Validate optional power (0..1, defaults to 1 if absent)
      if (p.power !== undefined) {
        if (typeof p.power !== "number") return "power must be a number";
        if ((p.power as number) < 0 || (p.power as number) > 1.01)
          return "power must be 0..1";
      }
      return null;
    },
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 100,
    burstLimit: 5,
  },
  {
    type: "lock_move",
    validate: () => null,
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 500,
  },
  {
    type: "cancel_move",
    validate: () => null,
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 500,
  },
  {
    type: "reaction",
    validate: (payload: unknown) => {
      const p = payload as Record<string, unknown>;
      if (!p || typeof p.kind !== "string") return "Missing reaction kind";
      const validKinds = ["nice", "gg", "wow", "ouch", "lol"];
      if (!validKinds.includes(p.kind as string))
        return "Invalid reaction kind";
      return null;
    },
    senderEligibility: "player",
    allowedPhases: "any",
    rateLimitMs: 2000,
  },
];

// =============================================================================
// Settings Validation
// =============================================================================

function validateKnockoutSettings(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const planningTimerSec = [6, 8, 10, 12].includes(
    raw.planningTimerSec as number,
  )
    ? (raw.planningTimerSec as number)
    : 8;

  const shrinkSpeed = ["normal", "fast"].includes(raw.shrinkSpeed as string)
    ? (raw.shrinkSpeed as string)
    : "normal";

  const maxPlayers =
    typeof raw.maxPlayers === "number"
      ? Math.max(2, Math.min(8, Math.round(raw.maxPlayers as number)))
      : 8;

  return {
    planningTimerSec,
    shrinkSpeed,
    maxPlayers,
  };
}

// =============================================================================
// Game Definition
// =============================================================================

export const KNOCKOUT_DEFINITION: RealtimeGameDefinition = {
  gameId: "knockout_game",
  roomName: "knockout_game",
  simulationProfile: "hybrid_round_tick",

  // Settings
  defaultSettings: {
    planningTimerSec: 8,
    shrinkSpeed: "normal",
    maxPlayers: 8,
  },
  validateSettings: validateKnockoutSettings,

  // Players
  minPlayers: 2,
  maxPlayers: 8,
  teams: null, // FFA

  // Policies
  matchStartPolicy: "full_roster",
  disconnectPolicy: "grace_then_forfeit",
  lateJoinPolicy: "spectator_only",
  matchEndConditions: ["elimination"],

  // Spectators
  supportsSpectate: true,
  spectatorMode: "live_public",

  // Reconnect
  reconnectGraceMs: 20_000,

  // Timing
  countdownSec: 3,
  tickRate: 60,
  /**
   * 15 Hz broadcast during simulation phases. The simulation runs at 60 Hz
   * server-side but we only need to push state 15 times/sec — client-side
   * interpolation smooths intermediate frames. This balances visual
   * smoothness with bandwidth for 2–8 player FFA.
   */
  stateBroadcastHz: 15,
  maxMatchDurationMs: 10 * 60 * 1000, // 10 minute safety cap
  // PERF: Reduced from 10_000. Clients call leave() on match_end,
  // so the room only needs a brief grace period for slow connections.
  postMatchDisposalDelayMs: 5_000,
  abandonmentGraceMs: 20_000,

  // Capabilities
  allowResign: false,
  allowPause: false,
  hasHiddenInfo: true, // staged moves are private until reveal

  // Messages
  messages: knockoutMessages,

  // Leaderboard
  leaderboardMetric: "wins",
};
