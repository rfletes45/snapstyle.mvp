/**
 * Games V4 — Realtime Client Core
 *
 * Generalized Colyseus room connection, lifecycle management,
 * reconnection, and message dispatch. Replaces the bespoke
 * sketchPartyClient.ts singleton with a reusable class.
 *
 * Usage:
 *   const client = new RealtimeRoomClient(definition);
 *   await client.join(options);
 *   client.onMessage("stroke_begin", (data) => { ... });
 *   client.send("guess", { text: "cat" });
 *   await client.leave();
 *
 * @module gamesV4/realtime/realtimeClient
 */

import { Client, Room } from "colyseus.js";
import Constants from "expo-constants";

import type {
  ConnectionStatus,
  DisconnectReason,
  JoinOptions,
  MessageHandler,
  RealtimeClientDefinition,
  ReconnectConfig,
  RoomEventCallback,
} from "./types";
import { DEFAULT_RECONNECT_CONFIG } from "./types";

// =============================================================================
// Server URL derivation (shared across all realtime games)
// =============================================================================

const COLYSEUS_PORT = 2567;

/**
 * Derive the Colyseus server URL.
 * Priority:
 * 1. Explicit `colyseusUrl` in app.config extra
 * 2. Auto-detect from Expo dev-server host (LAN IP)
 * 3. Fallback to localhost
 */
export function getColyseusUrl(): string {
  const extra = Constants.expoConfig?.extra;
  if (extra?.colyseusUrl && typeof extra.colyseusUrl === "string") {
    return extra.colyseusUrl;
  }

  const devHost =
    Constants.expoConfig?.hostUri ??
    ((Constants as Record<string, unknown>).debuggerHost as string | undefined);
  if (devHost) {
    const hostname = devHost.split(":")[0];
    if (hostname) {
      return `http://${hostname}:${COLYSEUS_PORT}`;
    }
  }

  return `http://localhost:${COLYSEUS_PORT}`;
}

// =============================================================================
// Colyseus Client singleton
// =============================================================================

let sharedClient: Client | null = null;

function getClient(): Client {
  if (!sharedClient) {
    sharedClient = new Client(getColyseusUrl());
  }
  return sharedClient;
}

/**
 * Reset the shared client (useful for testing or URL changes).
 */
export function resetClient(): void {
  sharedClient = null;
}

// =============================================================================
// RealtimeRoomClient
// =============================================================================

/**
 * Generalized Colyseus room client with:
 * - Typed message dispatch
 * - Auto-reconnection with exponential backoff
 * - Latency tracking via ping/pong
 * - Connection lifecycle events
 * - State sync listener
 */
export class RealtimeRoomClient<TState = Record<string, unknown>> {
  // ── Configuration ───────────────────────────────────────────────
  private readonly definition: RealtimeClientDefinition<TState>;
  private readonly reconnectConfig: ReconnectConfig;

  // ── State ───────────────────────────────────────────────────────
  private room: Room | null = null;
  private joinOptions: JoinOptions | null = null;
  private connectionStatus: ConnectionStatus = "idle";
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private latencyMs = 0;
  private destroyed = false;
  private lastPingTs = 0;
  private matchEnded = false;

  // ── Listeners ───────────────────────────────────────────────────
  private readonly messageHandlers = new Map<string, Set<MessageHandler>>();
  private readonly lifecycleListeners = new Set<RoomEventCallback>();
  private readonly stateListeners = new Set<(state: TState) => void>();
  private readonly statusListeners = new Set<
    (status: ConnectionStatus) => void
  >();
  private readonly latencyListeners = new Set<(ms: number) => void>();

  constructor(definition: RealtimeClientDefinition<TState>) {
    this.definition = definition;
    this.reconnectConfig = {
      ...DEFAULT_RECONNECT_CONFIG,
      ...(definition.reconnect ?? {}),
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public API — Connection
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Join or create a room for the given session.
   * @throws If already connected or join fails after retries.
   */
  async join(options: JoinOptions): Promise<Room> {
    if (this.room) {
      throw new Error(
        `[RealtimeClient:${this.definition.displayName}] Already connected. Call leave() first.`,
      );
    }
    this.destroyed = false;
    this.matchEnded = false;
    this.joinOptions = options;
    this.setStatus("connecting");

    const roomName = options.roomName ?? this.definition.roomName;
    const client = getClient();

    const tag = `[RealtimeClient:${this.definition.displayName}]`;
    console.log(
      `${tag} Connecting to ${getColyseusUrl()} for session ${options.sessionId}`,
    );

    try {
      const room = await client.joinOrCreate(roomName, {
        sessionId: options.sessionId,
        uid: options.uid,
        displayName: options.displayName,
        token: options.token,
        spectator: options.spectator ?? false,
      });

      if (this.destroyed) {
        room.leave();
        throw new Error(`${tag} Client destroyed during join.`);
      }

      this.room = room;
      this.reconnectAttempt = 0;
      this.setStatus("connected");
      this.wireRoomListeners(room);
      this.startPing();

      console.log(
        `${tag} Joined room ${room.roomId} (session ${room.sessionId})`,
      );
      this.emitLifecycle({ type: "connected" });

      return room;
    } catch (err) {
      this.setStatus("error");
      this.emitLifecycle({
        type: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Leave the room gracefully.
   */
  async leave(): Promise<void> {
    this.destroyed = true;
    this.stopPing();
    this.clearReconnectTimer();

    if (this.room) {
      try {
        await this.room.leave();
      } catch {
        // Ignore — may already be disconnected
      }
      this.room = null;
    }

    this.setStatus("disconnected");
    this.emitLifecycle({ type: "left" });
  }

  /**
   * Manually trigger a reconnection attempt.
   */
  async reconnect(): Promise<void> {
    if (!this.joinOptions) {
      throw new Error("Cannot reconnect without prior join options.");
    }
    this.clearReconnectTimer();
    await this.attemptReconnect();
  }

  /**
   * Destroy the client and clean up all listeners.
   */
  destroy(): void {
    this.destroyed = true;
    this.matchEnded = false;
    this.stopPing();
    this.clearReconnectTimer();
    if (this.room) {
      try {
        this.room.leave(false);
      } catch {
        // noop
      }
      this.room = null;
    }
    this.messageHandlers.clear();
    this.lifecycleListeners.clear();
    this.stateListeners.clear();
    this.statusListeners.clear();
    this.latencyListeners.clear();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public API — Messaging
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Send a message to the server.
   * Silently drops if not connected or match has ended.
   */
  send(type: string, payload?: unknown): void {
    if (!this.room) {
      // After match end, sends are expected (e.g. touch-end events) — don't warn
      if (!this.matchEnded) {
        console.warn(
          `[RealtimeClient:${this.definition.displayName}] Cannot send "${type}" — not connected.`,
        );
      }
      return;
    }
    this.room.send(type, payload ?? {});
  }

  /**
   * Register a handler for a specific server message type.
   * Returns an unsubscribe function.
   */
  onMessage<T = unknown>(type: string, handler: MessageHandler<T>): () => void {
    let set = this.messageHandlers.get(type);
    if (!set) {
      set = new Set();
      this.messageHandlers.set(type, set);
    }
    const wrapped = handler as MessageHandler;
    set.add(wrapped);

    // If room already exists, register immediately
    if (this.room) {
      this.room.onMessage(type, wrapped);
    }

    return () => {
      set?.delete(wrapped);
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public API — Subscriptions
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Subscribe to state_sync updates.
   * Returns unsubscribe function.
   */
  onStateChange(handler: (state: TState) => void): () => void {
    this.stateListeners.add(handler);
    return () => {
      this.stateListeners.delete(handler);
    };
  }

  /**
   * Subscribe to connection status changes.
   * Returns unsubscribe function.
   */
  onStatusChange(handler: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(handler);
    return () => {
      this.statusListeners.delete(handler);
    };
  }

  /**
   * Subscribe to lifecycle events (connected, disconnected, etc).
   * Returns unsubscribe function.
   */
  onLifecycle(handler: RoomEventCallback): () => void {
    this.lifecycleListeners.add(handler);
    return () => {
      this.lifecycleListeners.delete(handler);
    };
  }

  /**
   * Subscribe to latency updates.
   * Returns unsubscribe function.
   */
  onLatencyChange(handler: (ms: number) => void): () => void {
    this.latencyListeners.add(handler);
    return () => {
      this.latencyListeners.delete(handler);
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public API — Getters
  // ═══════════════════════════════════════════════════════════════════

  getRoom(): Room | null {
    return this.room;
  }

  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  getLatency(): number {
    return this.latencyMs;
  }

  getReconnectAttempt(): number {
    return this.reconnectAttempt;
  }

  isConnected(): boolean {
    return this.connectionStatus === "connected";
  }

  isMatchEnded(): boolean {
    return this.matchEnded;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Private — Room Wiring
  // ═══════════════════════════════════════════════════════════════════

  private wireRoomListeners(room: Room): void {
    const tag = `[RealtimeClient:${this.definition.displayName}]`;

    // ── State sync ──
    if (this.definition.autoStateSync !== false) {
      room.onMessage("state_sync", (state: TState) => {
        if (!this.destroyed) {
          for (const listener of this.stateListeners) {
            try {
              listener(state);
            } catch (err) {
              console.error(`${tag} State listener error:`, err);
            }
          }
        }
      });
    }

    // ── Pong (latency tracking) ──
    room.onMessage("pong", (msg: { serverTs: number }) => {
      if (this.lastPingTs > 0) {
        this.latencyMs = Date.now() - this.lastPingTs;
        for (const listener of this.latencyListeners) {
          listener(this.latencyMs);
        }
      }
    });

    // ── System messages ──
    room.onMessage("error", (msg: { message: string; code?: string }) => {
      console.warn(`${tag} Server error:`, msg.message);
    });

    // ── Framework messages (sent by BaseRealtimeRoom for all games) ──
    room.onMessage("settings_applied", () => {});
    room.onMessage("system_message", () => {});
    room.onMessage("countdown", () => {});
    room.onMessage("match_end", () => {
      this.matchEnded = true;
      console.log(`${tag} Match ended — reconnection suppressed.`);
    });

    // ── Forward all registered game message handlers ──
    for (const [type, handlers] of this.messageHandlers) {
      room.onMessage(type, (data: unknown) => {
        for (const handler of handlers) {
          try {
            handler(data);
          } catch (err) {
            console.error(`${tag} Handler error for "${type}":`, err);
          }
        }
      });
    }

    // ── Disconnect ──
    room.onLeave((code: number) => {
      console.log(`${tag} Room left with code ${code}`);
      this.room = null;
      this.stopPing();

      const reason = this.interpretLeaveCode(code);

      if (
        !this.matchEnded &&
        reason !== "user_left" &&
        this.reconnectConfig.enabled &&
        !this.destroyed
      ) {
        this.setStatus("reconnecting");
        this.emitLifecycle({ type: "disconnected", code, reason });
        this.scheduleReconnect();
      } else {
        this.setStatus("disconnected");
        this.emitLifecycle({ type: "disconnected", code, reason });
      }
    });

    // ── Error ──
    room.onError((code: number, message?: string) => {
      console.error(`${tag} Room error ${code}: ${message}`);
      this.emitLifecycle({
        type: "error",
        code,
        reason: message ?? "Unknown error",
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Private — Reconnection
  // ═══════════════════════════════════════════════════════════════════

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectAttempt >= this.reconnectConfig.maxAttempts) {
      console.warn(
        `[RealtimeClient:${this.definition.displayName}] Max reconnect attempts reached.`,
      );
      this.setStatus("error");
      return;
    }

    const delay = Math.min(
      this.reconnectConfig.baseDelayMs * Math.pow(2, this.reconnectAttempt),
      this.reconnectConfig.maxDelayMs,
    );

    console.log(
      `[RealtimeClient:${this.definition.displayName}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt + 1}/${this.reconnectConfig.maxAttempts})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }

  private async attemptReconnect(): Promise<void> {
    if (this.destroyed || !this.joinOptions) return;

    this.reconnectAttempt++;
    this.setStatus("reconnecting");

    try {
      // Get a fresh token for reconnection
      const room = await this.join({
        ...this.joinOptions,
        // Token should be refreshed by the caller before reconnect
      });
      this.reconnectAttempt = 0;
      this.emitLifecycle({ type: "reconnected" });
    } catch (err) {
      console.warn(
        `[RealtimeClient:${this.definition.displayName}] Reconnect attempt ${this.reconnectAttempt} failed:`,
        err,
      );
      if (!this.destroyed) {
        this.scheduleReconnect();
      }
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Private — Ping / Latency
  // ═══════════════════════════════════════════════════════════════════

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.room) {
        this.lastPingTs = Date.now();
        this.room.send("ping", { clientTs: this.lastPingTs });
      }
    }, 5000); // every 5 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Private — Helpers
  // ═══════════════════════════════════════════════════════════════════

  private setStatus(status: ConnectionStatus): void {
    if (this.connectionStatus === status) return;
    this.connectionStatus = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error(
          `[RealtimeClient:${this.definition.displayName}] Status listener error:`,
          err,
        );
      }
    }
  }

  private emitLifecycle(event: Parameters<RoomEventCallback>[0]): void {
    for (const listener of this.lifecycleListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(
          `[RealtimeClient:${this.definition.displayName}] Lifecycle listener error:`,
          err,
        );
      }
    }
  }

  private interpretLeaveCode(code: number): DisconnectReason {
    // Colyseus close codes
    switch (code) {
      case 1000: // Normal close
        return "user_left";
      case 4000: // Server initiated
        return "server_shutdown";
      case 4002: // Auth failure
        return "auth_failure";
      case 4210: // Kicked
        return "kicked";
      default:
        if (code >= 4000 && code < 4100) return "server_shutdown";
        if (code >= 1001 && code <= 1015) return "network_error";
        return "unknown";
    }
  }
}
