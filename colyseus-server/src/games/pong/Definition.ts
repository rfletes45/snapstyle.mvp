/**
 * Pong — Game Definition
 *
 * RealtimeGameDefinition for the Pong 1v1 realtime game.
 * Declares lifecycle policies, settings, and message contracts.
 *
 * @module games/pong/Definition
 */

import { createPayloadValidator } from "../../core/InputValidation";
import type {
  MessageDefinition,
  RealtimeGameDefinition,
} from "../../core/types";

// =============================================================================
// Message Definitions
// =============================================================================

const pongMessages: MessageDefinition[] = [
  {
    type: "input_move",
    validate: createPayloadValidator({ y: "number" }),
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 0, // continuous input
  },
  {
    type: "input_stop",
    validate: () => null,
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 0,
  },
  {
    type: "ready",
    validate: () => null,
    senderEligibility: "player",
    allowedPhases: ["waiting_for_players"],
    rateLimitMs: 1000,
  },
  {
    type: "reaction",
    validate: (payload: unknown) => {
      const p = payload as Record<string, unknown>;
      if (!p || typeof p.kind !== "string") return "Missing reaction kind";
      const validKinds = ["nice", "gg", "wow", "ouch"];
      if (!validKinds.includes(p.kind as string))
        return "Invalid reaction kind";
      return null;
    },
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 2000,
  },
  {
    type: "concede",
    validate: () => null,
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 5000,
  },
];

// =============================================================================
// Settings Validation
// =============================================================================

function validatePongSettings(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const scoreToWin = [5, 7, 11].includes(raw.scoreToWin as number)
    ? (raw.scoreToWin as number)
    : 7;

  const winByTwo = typeof raw.winByTwo === "boolean" ? raw.winByTwo : false;

  const ballSpeedPreset = ["normal", "fast"].includes(
    raw.ballSpeedPreset as string,
  )
    ? (raw.ballSpeedPreset as string)
    : "normal";

  const paddleSizePreset = ["normal", "large"].includes(
    raw.paddleSizePreset as string,
  )
    ? (raw.paddleSizePreset as string)
    : "normal";

  const arenaTheme = ["classic", "neon", "catppuccin"].includes(
    raw.arenaTheme as string,
  )
    ? (raw.arenaTheme as string)
    : "classic";

  return {
    scoreToWin,
    winByTwo,
    ballSpeedPreset,
    paddleSizePreset,
    arenaTheme,
  };
}

// =============================================================================
// Game Definition
// =============================================================================

export const PONG_DEFINITION: RealtimeGameDefinition = {
  gameId: "pong_game",
  roomName: "pong_game",
  simulationProfile: "fixed_tick",

  // Settings
  defaultSettings: {
    scoreToWin: 7,
    winByTwo: false,
    ballSpeedPreset: "normal",
    paddleSizePreset: "normal",
    arenaTheme: "classic",
  },
  validateSettings: validatePongSettings,

  // Players
  minPlayers: 2,
  maxPlayers: 2,
  teams: null,

  // Policies
  matchStartPolicy: "full_roster",
  disconnectPolicy: "grace_then_forfeit",
  lateJoinPolicy: "none",
  matchEndConditions: ["score_target"],

  // Spectators (v1: none)
  supportsSpectate: false,
  spectatorMode: "none",

  // Reconnect
  reconnectGraceMs: 15_000,

  // Join grace — abort 1v1 if opponent never shows within 45s
  joinGraceMs: 45_000,

  // Timing
  countdownSec: 3,
  tickRate: 60,
  stateBroadcastHz: 20, // 20 full state_syncs/sec — enough for smooth client interpolation
  maxMatchDurationMs: 15 * 60 * 1000, // 15 minutes safety cap
  // PERF: Reduced from 10_000. Clients call leave() on match_end,
  // so the room only needs a brief grace period for slow connections.
  postMatchDisposalDelayMs: 5_000,
  abandonmentGraceMs: 15_000,

  // Capabilities
  allowResign: true,
  allowPause: false,
  hasHiddenInfo: false,

  // Messages
  messages: pongMessages,

  // Leaderboard
  leaderboardMetric: "wins",
};
