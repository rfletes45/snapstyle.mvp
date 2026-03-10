/**
 * Games V4 — Knockout Client Definition
 *
 * Game-specific RealtimeClientDefinition for Knockout.
 * Registers at import time so the generalized realtime layer
 * knows how to connect to and manage a Knockout room.
 *
 * @module gamesV4/realtime/games/knockoutGameDef
 */

import { registerRealtimeClientDef } from "../registry";
import type { RealtimeClientDefinition } from "../types";

// =============================================================================
// State shape synced from server
// =============================================================================

export interface KnockoutBodyState {
  uid: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

export interface KnockoutPlayerStats {
  knockouts: number;
  assists: number;
  alive: boolean;
  placement: number;
  eliminatedAtRound: number;
}

export interface KnockoutRevealedMove {
  uid: string;
  dx: number;
  dy: number;
  power: number;
}

export interface KnockoutRoundSummary {
  eliminations: Array<{
    uid: string;
    killerUid: string | null;
    assistUid: string | null;
  }>;
  aliveCount: number;
}

export interface KnockoutMyMove {
  dx: number;
  dy: number;
  power: number;
  locked: boolean;
}

export type KnockoutPhase =
  | "waiting"
  | "round_intro"
  | "planning"
  | "locked_countdown"
  | "reveal"
  | "simulation"
  | "settle"
  | "resolve_elims"
  | "shrink"
  | "round_summary"
  | "match_end";

export interface KnockoutRealtimeState {
  /** Server room phase */
  phase: string;
  /** Knockout-specific gameplay phase */
  knockoutPhase: KnockoutPhase;
  /** Current round number */
  roundNumber: number;
  /** Timestamp when planning ends (ms epoch) */
  planningEndsAt: number;
  /** Current shrink stage */
  shrinkStage: number;
  /** Current arena half-side (normalized coords, square arena) */
  arenaHalfSide: number;
  /** Number of players still alive */
  aliveCount: number;
  /** All penguin body positions/velocities */
  bodies: KnockoutBodyState[];
  /** Revealed moves (only populated after reveal phase) */
  revealedMoves: KnockoutRevealedMove[];
  /** Round summary data (only populated during round_summary phase) */
  roundSummary: KnockoutRoundSummary | null;
  /** Per-player public stats */
  stats: Record<string, KnockoutPlayerStats>;
  /** The viewing player's own staged move (only during planning, owner-only) */
  myMove: KnockoutMyMove | null;
  /** Player list from framework */
  players: Array<{
    uid: string;
    displayName: string;
    connected: boolean;
    isSpectator: boolean;
  }>;
  /** Room version */
  roomVersion: number;
}

// =============================================================================
// Server message types
// =============================================================================

const KNOCKOUT_SERVER_MESSAGES = [
  // Framework messages
  "state_sync",
  "countdown",
  "system_message",
  "player_connected",
  "player_disconnected",
  "player_reconnected",
  "spectator_joined",
  "match_end",
  "pong",
  "error",
  "settings_applied",
  // Knockout-specific
  "move_ack",
  "eliminations",
  "arena_shrink",
  "shrink_warning",
  "reaction_event",
] as const;

export type KnockoutServerMessage = (typeof KNOCKOUT_SERVER_MESSAGES)[number];

// =============================================================================
// Client Definition
// =============================================================================

export const KNOCKOUT_CLIENT_DEF: RealtimeClientDefinition<
  KnockoutRealtimeState,
  KnockoutServerMessage
> = {
  gameId: "knockout_game",
  roomName: "knockout_game",
  displayName: "Knockout",

  serverMessageTypes: KNOCKOUT_SERVER_MESSAGES,

  initialState: {
    phase: "waiting_for_players",
    knockoutPhase: "waiting",
    roundNumber: 0,
    planningEndsAt: 0,
    shrinkStage: 0,
    arenaHalfSide: 0.42,
    aliveCount: 0,
    bodies: [],
    revealedMoves: [],
    roundSummary: null,
    stats: {},
    myMove: null,
    players: [],
    roomVersion: 0,
  },

  reconnect: {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 15000,
  },

  autoStateSync: true,
};

// =============================================================================
// Auto-register
// =============================================================================

registerRealtimeClientDef(KNOCKOUT_CLIENT_DEF);
