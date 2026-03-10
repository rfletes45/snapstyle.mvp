/**
 * Games V4 — Realtime Client Types
 *
 * Shared type definitions for the generalized realtime client layer.
 * These mirror the server-side protocol contracts and provide typed
 * access to room state, messages, and lifecycle events.
 *
 * @module gamesV4/realtime/types
 */

import type { Room } from "colyseus.js";
import type { GameId } from "../types/common";

// =============================================================================
// Room Lifecycle
// =============================================================================

/** Lifecycle phases mirroring server-side RoomPhase. */
export type ClientRoomPhase =
  | "connecting"
  | "waiting"
  | "countdown"
  | "playing"
  | "paused"
  | "match_end"
  | "resolving"
  | "resolved"
  | "error"
  | "disconnected";

/** Connection status for the local client. */
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

/** Describes the reason for a disconnect. */
export type DisconnectReason =
  | "user_left"
  | "kicked"
  | "server_shutdown"
  | "network_error"
  | "auth_failure"
  | "timeout"
  | "unknown";

// =============================================================================
// Connection Options
// =============================================================================

/** Options for joining a realtime room. */
export interface JoinOptions {
  /** V4 session ID (used as room filter key). */
  sessionId: string;
  /** Player's UID. */
  uid: string;
  /** Player's display name. */
  displayName: string;
  /** Firebase ID token for server-side auth. */
  token: string;
  /** Whether joining as spectator. */
  spectator?: boolean;
  /** Room name override (defaults to game definition's roomName). */
  roomName?: string;
}

/** Reconnection policy configuration. */
export interface ReconnectConfig {
  /** Whether auto-reconnect is enabled. */
  enabled: boolean;
  /** Maximum number of reconnect attempts. */
  maxAttempts: number;
  /** Base delay between attempts (ms). Doubled each retry. */
  baseDelayMs: number;
  /** Maximum delay between attempts (ms). */
  maxDelayMs: number;
}

/** Default reconnect configuration. */
export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  enabled: true,
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 15000,
};

// =============================================================================
// Game-Specific Client Definition
// =============================================================================

/**
 * Client-side definition for a realtime game.
 * Registered per game to configure the generalized client layer.
 */
export interface RealtimeClientDefinition<
  TState = Record<string, unknown>,
  TEvent extends string = string,
> {
  /** Game identity. */
  gameId: GameId;
  /** Colyseus room name (must match server-side definition). */
  roomName: string;
  /** Human-readable game name for logging/errors. */
  displayName: string;

  /**
   * Map of server message types this game listens to.
   * Keys are message type strings, values are type discriminators for TS.
   * Used to auto-register message handlers.
   */
  serverMessageTypes: readonly TEvent[];

  /** Initial client-side state before any server state arrives. */
  initialState: TState;

  /** Reconnection configuration. */
  reconnect?: Partial<ReconnectConfig>;

  /**
   * Whether to automatically listen for "state_sync" messages
   * and update the state atom. Defaults to true.
   */
  autoStateSync?: boolean;
}

// =============================================================================
// Room Context
// =============================================================================

/**
 * The runtime context exposed to game screens via the useRealtimeRoom hook.
 * Contains the Colyseus Room handle plus typed lifecycle state.
 */
export interface RealtimeRoomContext<TState = Record<string, unknown>> {
  /** The raw Colyseus Room instance (null until connected). */
  room: Room | null;
  /** Current connection status. */
  connectionStatus: ConnectionStatus;
  /** Current server-reported room phase. */
  phase: ClientRoomPhase;
  /** Latest game state from server. */
  gameState: TState;
  /** Whether the local player is a spectator. */
  isSpectator: boolean;
  /** Reconnect attempt counter (0 when connected). */
  reconnectAttempt: number;
  /** Human-readable error message (null when healthy). */
  error: string | null;
  /** Latency in ms (measured via ping/pong). */
  latencyMs: number;

  // ── Actions ─────────────────────────────────────────────────────
  /** Send a typed message to the server. */
  send: (type: string, payload?: unknown) => void;
  /** Manually trigger reconnection. */
  reconnect: () => Promise<void>;
  /** Leave the room gracefully. */
  leave: () => Promise<void>;
}

// =============================================================================
// System Messages (from server framework)
// =============================================================================

/** System-level messages sent by BaseRealtimeRoom. */
export interface SystemMessages {
  /** Full game state broadcast. */
  state_sync: Record<string, unknown>;
  /** Match countdown tick. */
  countdown: { secondsLeft: number };
  /** System chat/announcement. */
  system_message: { text: string; severity: "info" | "warning" | "error" };
  /** Player connected. */
  player_connected: { uid: string; displayName: string };
  /** Player disconnected. */
  player_disconnected: { uid: string; displayName: string };
  /** Player reconnected. */
  player_reconnected: { uid: string; displayName: string };
  /** Spectator joined. */
  spectator_joined: { uid: string; displayName: string };
  /** Match resolved (game over). */
  match_resolved: { reason: string };
  /** Ping response for latency measurement. */
  pong: { serverTs: number };
  /** Error from server. */
  error: { message: string; code?: string };
}

/** Union of all system message types. */
export type SystemMessageType = keyof SystemMessages;

// =============================================================================
// Event Listener Types
// =============================================================================

/** Callback for room lifecycle events. */
export type RoomEventCallback = (event: {
  type: "connected" | "disconnected" | "reconnected" | "error" | "left";
  code?: number;
  reason?: string;
}) => void;

/** Generic message handler. */
export type MessageHandler<T = unknown> = (payload: T) => void;
