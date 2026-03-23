/**
 * Games V4 - Sketch Party Client Definition
 *
 * Game-specific RealtimeClientDefinition for Sketch Party.
 * Registers at import time so the generalized realtime layer
 * knows how to connect to and manage a Sketch Party room.
 *
 * @module gamesV4/realtime/games/sketchPartyDef
 */

import { registerRealtimeClientDef } from "../registry";
import type { RealtimeClientDefinition } from "../types";
import type { SketchPartyRealtimeState } from "./sketchPartyTypes";

export type { SketchPartyRealtimeState } from "./sketchPartyTypes";

// =============================================================================
// Server message types that the Sketch Party client listens to
// =============================================================================

export const SKETCH_PARTY_SERVER_MESSAGES = [
  // Framework messages (handled by RealtimeRoomClient internally)
  "state_sync",
  "pong",
  "error",
  "system_message",
  "countdown",
  "player_connected",
  "player_disconnected",
  "player_reconnected",
  "match_resolved",
  // Game-specific messages
  "stroke_begin",
  "stroke_points",
  "stroke_end",
  "chat",
  "clear_canvas",
  "undo_stroke",
  "board_snapshot",
  "word_reveal",
  "turn_scores",
  "settings_applied",
  "reaction_event",
] as const;

export type SketchPartyServerMessage =
  (typeof SKETCH_PARTY_SERVER_MESSAGES)[number];

// =============================================================================
// Default initial state
// =============================================================================

const INITIAL_STATE: SketchPartyRealtimeState = {
  phase: "waiting",
  currentRound: 1,
  totalRounds: 3,
  currentTurnIndex: 0,
  drawerId: "",
  turnOrder: [],
  maskedWord: "",
  wordLength: 0,
  secretWord: "",
  scores: {},
  correctGuessers: [],
  timeRemainingSec: 80,
  drawTimeSec: 80,
  hintsUsed: 0,
  maxHints: 2,
  wordChoices: [],
  players: [],
  effectiveSettings: {
    maxPlayers: 8,
    rounds: 3,
    drawTimeSec: 80,
    turnChooseTimeSec: 10,
    wordChoices: 3,
    hints: 2,
    customWordsEnabled: false,
    customWordsList: "",
  },
};

// =============================================================================
// Definition
// =============================================================================

export const SKETCH_PARTY_CLIENT_DEF: RealtimeClientDefinition<SketchPartyRealtimeState> =
  {
    gameId: "sketch_party_game",
    roomName: "sketch_party",
    displayName: "Sketch Party",
    serverMessageTypes: SKETCH_PARTY_SERVER_MESSAGES,
    initialState: INITIAL_STATE,
    autoStateSync: true,
    reconnect: {
      enabled: true,
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 15000,
    },
  };

// Auto-register on import
registerRealtimeClientDef(SKETCH_PARTY_CLIENT_DEF);
