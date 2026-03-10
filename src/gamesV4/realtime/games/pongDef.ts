/**
 * Games V4 — Pong Client Definition
 *
 * Game-specific RealtimeClientDefinition for Pong.
 * Registers at import time so the generalized realtime layer
 * knows how to connect to and manage a Pong room.
 *
 * @module gamesV4/realtime/games/pongDef
 */

import { registerRealtimeClientDef } from "../registry";
import type { RealtimeClientDefinition } from "../types";

// =============================================================================
// State shape synced from server
// =============================================================================

export interface PongPaddleState {
  y: number;
  vy: number;
  connected: boolean;
}

export interface PongBallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface PongEffectiveSettings {
  scoreToWin: number;
  winByTwo: boolean;
  ballSpeedPreset: "normal" | "fast";
  paddleSizePreset: "normal" | "large";
  arenaTheme: "classic" | "neon" | "catppuccin";
}

export interface PongPointHistoryEntry {
  scorer: string;
  leftScore: number;
  rightScore: number;
}

export interface PongRealtimeState {
  /** Server room phase */
  phase: string;
  /** Pong-specific gameplay phase */
  pongPhase:
    | "waiting"
    | "countdown"
    | "serve"
    | "live"
    | "point_scored"
    | "match_end"
    | "aborted";
  /** Left player UID */
  leftPlayerId: string;
  /** Right player UID */
  rightPlayerId: string;
  /** Score map: { [uid]: number } */
  scores: Record<string, number>;
  /** Ball position and velocity */
  ball: PongBallState;
  /** Paddle states keyed by side */
  paddles: {
    left: PongPaddleState;
    right: PongPaddleState;
  };
  /** Which side serves next */
  serveOwner: "left" | "right";
  /** Effective game settings */
  effectiveSettings: PongEffectiveSettings;
  /** Current rally hit count */
  rallyHits: number;
  /** Recent point history */
  pointHistory: PongPointHistoryEntry[];
  /** Player roster from framework */
  players: Array<{
    uid: string;
    displayName: string;
    connected: boolean;
    isSpectator: boolean;
  }>;
}

// =============================================================================
// Server message types
// =============================================================================

export const PONG_SERVER_MESSAGES = [
  // Framework system messages
  "state_sync",
  "pong", // ping-pong heartbeat (framework built-in name)
  "error",
  "system_message",
  "countdown",
  "player_connected",
  "player_disconnected",
  "player_reconnected",
  "match_resolved",
  "match_end",
  "settings_applied",
  // Pong-specific event messages
  "serve_launch",
  "paddle_hit",
  "wall_hit",
  "point_scored",
  "reaction_event",
] as const;

export type PongServerMessage = (typeof PONG_SERVER_MESSAGES)[number];

// =============================================================================
// Initial state
// =============================================================================

const INITIAL_STATE: PongRealtimeState = {
  phase: "waiting_for_players",
  pongPhase: "waiting",
  leftPlayerId: "",
  rightPlayerId: "",
  scores: {},
  ball: { x: 0.5, y: 0.5, vx: 0, vy: 0 },
  paddles: {
    left: { y: 0.5, vy: 0, connected: false },
    right: { y: 0.5, vy: 0, connected: false },
  },
  serveOwner: "left",
  effectiveSettings: {
    scoreToWin: 7,
    winByTwo: false,
    ballSpeedPreset: "normal",
    paddleSizePreset: "normal",
    arenaTheme: "classic",
  },
  rallyHits: 0,
  pointHistory: [],
  players: [],
};

// =============================================================================
// Client Definition
// =============================================================================

export const PONG_CLIENT_DEF: RealtimeClientDefinition<PongRealtimeState> = {
  gameId: "pong_game",
  roomName: "pong_game",
  displayName: "Pong",
  serverMessageTypes: PONG_SERVER_MESSAGES,
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
registerRealtimeClientDef(PONG_CLIENT_DEF);
