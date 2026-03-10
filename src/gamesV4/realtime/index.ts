/**
 * Games V4 — Realtime Module Barrel
 *
 * Central exports for the generalized realtime client layer.
 *
 * @module gamesV4/realtime
 */

// ── Types ──────────────────────────────────────────────────────────
export { DEFAULT_RECONNECT_CONFIG } from "./types";
export type {
  ClientRoomPhase,
  ConnectionStatus,
  DisconnectReason,
  JoinOptions,
  MessageHandler,
  RealtimeClientDefinition,
  RealtimeRoomContext,
  ReconnectConfig,
  RoomEventCallback,
  SystemMessageType,
  SystemMessages,
} from "./types";

// ── Client ─────────────────────────────────────────────────────────
export {
  RealtimeRoomClient,
  getColyseusUrl,
  resetClient,
} from "./realtimeClient";

// ── Registry ───────────────────────────────────────────────────────
export {
  getAllRealtimeClientDefs,
  getRealtimeClientDef,
  isRealtimeGame,
  registerRealtimeClientDef,
} from "./registry";

// ── Hooks ──────────────────────────────────────────────────────────
export { useRealtimeMessages } from "./useRealtimeMessages";
export type { MessageHandlerMap } from "./useRealtimeMessages";
export { useRealtimeClient, useRealtimeRoom } from "./useRealtimeRoom";
export type { UseRealtimeRoomOptions } from "./useRealtimeRoom";

// ── Errors ─────────────────────────────────────────────────────────
export {
  RealtimeAuthError,
  RealtimeError,
  RealtimeMessageError,
  RealtimeRoomFullError,
  RealtimeSessionError,
  RealtimeTimeoutError,
  classifyConnectionError,
} from "./errors";
