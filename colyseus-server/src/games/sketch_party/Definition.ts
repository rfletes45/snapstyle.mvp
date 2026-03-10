/**
 * Sketch Party — Game Definition
 *
 * Defines Sketch Party's integration with the generalized realtime framework.
 * This replaces the bespoke SketchPartyRoom configuration with a standard
 * RealtimeGameDefinition contract.
 *
 * @module games/sketch_party/Definition
 */

import { createPayloadValidator } from "../../core/InputValidation";
import type {
  MessageDefinition,
  RealtimeGameDefinition,
} from "../../core/types";

// =============================================================================
// Message Definitions
// =============================================================================

const sketchPartyMessages: MessageDefinition[] = [
  {
    type: "stroke_begin",
    validate: createPayloadValidator({
      strokeId: "string",
      x: "number",
      y: "number",
    }),
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 0, // Strokes need to be fast
  },
  {
    type: "stroke_points",
    validate: (payload: unknown) => {
      if (!payload || typeof payload !== "object") return "Invalid payload.";
      const p = payload as Record<string, unknown>;
      if (typeof p.strokeId !== "string") return "Missing strokeId.";
      if (!Array.isArray(p.points)) return "Missing points array.";
      return null;
    },
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 0,
  },
  {
    type: "stroke_end",
    validate: createPayloadValidator({ strokeId: "string" }),
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 0,
  },
  {
    type: "guess",
    validate: (payload: unknown) => {
      if (!payload || typeof payload !== "object") return "Invalid payload.";
      const p = payload as Record<string, unknown>;
      if (!p.text || typeof p.text !== "string") return "Missing text.";
      if ((p.text as string).trim().length === 0) return "Empty guess.";
      return null;
    },
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 400,
    burstLimit: 1,
  },
  {
    type: "word_choice",
    validate: (payload: unknown) => {
      if (!payload || typeof payload !== "object") return "Invalid payload.";
      const p = payload as Record<string, unknown>;
      if (typeof p.wordIndex !== "number") return "Missing wordIndex.";
      return null;
    },
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 1000,
  },
  {
    type: "undo",
    validate: () => null, // No payload needed
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 200,
  },
  {
    type: "clear",
    validate: () => null,
    senderEligibility: "player",
    allowedPhases: ["in_progress"],
    rateLimitMs: 1000,
  },
  {
    type: "reaction",
    validate: (payload: unknown) => {
      if (!payload || typeof payload !== "object") return "Invalid payload.";
      const p = payload as Record<string, unknown>;
      const validKinds = new Set(["thumbsup", "thumbsdown", "fire", "laugh"]);
      if (!p.kind || !validKinds.has(p.kind as string))
        return "Invalid reaction kind.";
      return null;
    },
    senderEligibility: "any",
    allowedPhases: ["in_progress"],
    rateLimitMs: 1200,
  },
];

// =============================================================================
// Settings Validation
// =============================================================================

function validateSketchPartySettings(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const validated: Record<string, unknown> = {};

  if (typeof raw.maxPlayers === "number") {
    validated.maxPlayers = Math.max(2, Math.min(8, raw.maxPlayers));
  }
  if (typeof raw.rounds === "number") {
    validated.rounds = Math.max(1, Math.min(10, raw.rounds));
  }
  if (typeof raw.drawTimeSec === "number") {
    validated.drawTimeSec = Math.max(30, Math.min(180, raw.drawTimeSec));
  }
  if (typeof raw.turnChooseTimeSec === "number") {
    validated.turnChooseTimeSec = Math.max(
      5,
      Math.min(15, raw.turnChooseTimeSec),
    );
  }
  if (typeof raw.wordChoices === "number") {
    validated.wordChoices = Math.max(1, Math.min(5, raw.wordChoices));
  }
  if (typeof raw.hints === "number") {
    validated.hints = Math.max(0, Math.min(3, raw.hints));
  }
  if (typeof raw.customWordsEnabled === "boolean") {
    validated.customWordsEnabled = raw.customWordsEnabled;
  }
  if (typeof raw.customWordsList === "string") {
    validated.customWordsList = raw.customWordsList.slice(0, 2000);
  }

  return validated;
}

// =============================================================================
// Game Definition
// =============================================================================

export const SKETCH_PARTY_DEFINITION: RealtimeGameDefinition = {
  gameId: "sketch_party_game",
  roomName: "sketch_party",
  simulationProfile: "phase_event",

  defaultSettings: {
    maxPlayers: 8,
    rounds: 3,
    drawTimeSec: 80,
    turnChooseTimeSec: 10,
    wordChoices: 3,
    hints: 2,
    customWordsEnabled: false,
    customWordsList: "",
  },
  validateSettings: validateSketchPartySettings,

  minPlayers: 2,
  maxPlayers: 8,
  teams: null, // FFA

  matchStartPolicy: "full_roster",
  disconnectPolicy: "continue_without_player",
  lateJoinPolicy: "none",
  matchEndConditions: ["completion"],

  supportsSpectate: false,
  spectatorMode: "none",

  reconnectGraceMs: 30_000, // 30 seconds
  countdownSec: 0,
  tickRate: null,
  maxMatchDurationMs: null, // No hard match time limit (turn timer handles it)
  postMatchDisposalDelayMs: 10_000,
  abandonmentGraceMs: 15_000,

  allowResign: false,
  allowPause: false,
  hasHiddenInfo: true, // Secret word is hidden from guessers

  messages: sketchPartyMessages,
  leaderboardMetric: "bestScore",
};
