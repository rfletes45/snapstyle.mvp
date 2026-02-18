/**
 * Colyseus Client Service
 *
 * Singleton service for connecting to the Colyseus game server.
 * Manages room creation, joining, reconnection, and lifecycle.
 *
 * Usage:
 *   import { colyseusService } from '@/services/colyseus';
 *   const room = await colyseusService.joinOrCreate('timed_tap');
 *   room.state.listen("phase", (phase) => { ... });
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §8
 */

// Must be imported BEFORE @colyseus/sdk — patches window.location.protocol
// so the SDK's module-level DEFAULT_ENDPOINT doesn't crash in React Native.
import "@/shims/colyseus-sdk";

import {
  COLYSEUS_SERVER_URL,
  COLYSEUS_SPECTATOR_ROOM,
  getColyseusRoomName,
  resolveColyseusRoomName,
} from "@/config/colyseus";
import { buildJoinOptions } from "@/services/colyseusJoin";
import { GameErrorCode, createGameError } from "@/types/gameErrors";
import {
  GAME_PROTOCOL_VERSION,
  getClientBuildInfo,
} from "@/types/gameProtocol";
import type { GameSessionContext } from "@/types/gameSession";
import { createTraceId } from "@/utils/trace";
import type { Room } from "@colyseus/sdk";
import { Client } from "@colyseus/sdk";
import { getAuth } from "firebase/auth";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/colyseus");
// =============================================================================
// Types
// =============================================================================

export interface JoinOptions {
  /** Game duration in seconds (for quick-play) */
  duration?: number;
  /** Difficulty level */
  difficulty?: number;
  /** Whether this is a private/invite-only room */
  private?: boolean;
  /** Firestore game ID for restoring suspended games */
  firestoreGameId?: string;
  /** Invitee Firebase UID (for friend invites) */
  inviteeUid?: string;
  /** Number of rounds (for reaction game) */
  rounds?: number;
  /** Any additional options */
  [key: string]: any;
}

export interface ColyseusEventHandlers {
  onStateChange?: (state: any) => void;
  /**
   * Called when an abnormal disconnection is detected (onLeave with code < 4000
   * and != 1000). The hook can use this to show a "reconnecting" UI.
   */
  onDrop?: (code?: number, reason?: string) => void;
  onLeave?: (code: number) => void;
  onError?: (code: number, message?: string) => void;
  onMessage?: (type: string, payload: any) => void;
}

// =============================================================================
// Service
// =============================================================================

class ColyseusService {
  private _client: Client | null = null;
  private activeRoom: Room | null = null;
  private eventHandlers: ColyseusEventHandlers = {};

  /**
   * Lazy-initialised Colyseus Client.
   *
   * Deferred to first access so `@colyseus/sdk` module-level code
   * (DEFAULT_ENDPOINT — `window.location.protocol.replace(...)`) is only
   * evaluated when the game server is actually needed, not at import time.
   */
  private get client(): Client {
    if (!this._client) {
      if (!COLYSEUS_SERVER_URL) {
        throw new Error(
          "[Colyseus] COLYSEUS_SERVER_URL is not defined. " +
            "Check src/config/colyseus.ts and ensure the server URL is configured.",
        );
      }
      logger.info(`[Colyseus] Creating Client → URL: ${COLYSEUS_SERVER_URL}`);
      this._client = new Client(COLYSEUS_SERVER_URL);
    }
    return this._client;
  }

  constructor() {
    // Client initialisation is deferred to first access (see `get client()`).
  }

  // ===========================================================================
  // Auth
  // ===========================================================================

  /**
   * Get the current Firebase user's ID token for Colyseus authentication.
   * @throws Error if the user is not authenticated.
   */
  private async getAuthToken(): Promise<string> {
    const user = getAuth().currentUser;
    if (!user) {
      throw new Error("Not authenticated — cannot connect to game server");
    }
    return user.getIdToken();
  }

  // ===========================================================================
  // Room Management
  // ===========================================================================

  /**
   * Join or create a game room.
   * Uses the game type key to look up the Colyseus room name.
   *
   * @param gameType - Client-side game type (e.g., "timed_tap_game")
   * @param options - Join options (duration, difficulty, etc.)
   * @param handlers - Event handlers for state, reconnection, errors
   * @returns The joined Room instance
   */
  async joinOrCreate(
    gameType: string,
    options: JoinOptions = {},
    handlers: ColyseusEventHandlers = {},
  ): Promise<Room> {
    const roomName = getColyseusRoomName(gameType);
    if (!roomName) {
      throw new Error(`Game type "${gameType}" is not Colyseus-enabled`);
    }

    const token = await this.getAuthToken();

    logger.info(
      `[Colyseus] joinOrCreate → room=${roomName}, firestoreGameId=${options.firestoreGameId ?? "none"}`,
    );

    try {
      const room = await this.client.joinOrCreate(roomName, {
        ...options,
        token,
        protocolVersion: GAME_PROTOCOL_VERSION,
        buildInfo: getClientBuildInfo(),
        traceId: options.traceId || createTraceId("gs"),
      });

      this.activeRoom = room;
      this.eventHandlers = handlers;
      // Pass handlers directly so each room's listeners use their own
      // handler snapshot — prevents a later joinOrCreate from hijacking
      // this room's callbacks.
      this.setupRoomHandlers(room, handlers);

      logger.info(`[Colyseus] Joined room: ${roomName} (${room.roomId})`);

      return room;
    } catch (error: any) {
      logger.error(
        `[Colyseus] Failed to join room: ${error?.message}\nStack: ${error?.stack}`,
      );
      throw error;
    }
  }

  /**
   * Join a specific room by its Colyseus room ID.
   * Used when accepting an invite or restoring a suspended game.
   *
   * @param roomId - The Colyseus room ID
   * @param options - Join options
   * @param handlers - Event handlers
   * @returns The joined Room instance
   */
  async joinById(
    roomId: string,
    options: JoinOptions = {},
    handlers: ColyseusEventHandlers = {},
  ): Promise<Room> {
    const token = await this.getAuthToken();

    try {
      const room = await this.client.joinById(roomId, {
        ...options,
        token,
        protocolVersion: GAME_PROTOCOL_VERSION,
        buildInfo: getClientBuildInfo(),
        traceId: options.traceId || createTraceId("gs"),
      });

      this.activeRoom = room;
      this.eventHandlers = handlers;
      this.setupRoomHandlers(room, handlers);

      logger.info(`[Colyseus] Joined room by ID: ${roomId}`);

      return room;
    } catch (error: any) {
      logger.error(
        `[Colyseus] Failed to join room by ID: ${error?.message}\nStack: ${error?.stack}`,
      );
      throw error;
    }
  }

  /**
   * Restore a suspended turn-based game from Firestore.
   * Creates a new Colyseus room that pre-loads the saved state.
   *
   * @param gameType - Client-side game type
   * @param firestoreGameId - The Firestore document ID of the saved game
   * @returns The restored Room instance
   */
  async restoreGame(
    gameType: string,
    firestoreGameId: string,
    handlers: ColyseusEventHandlers = {},
  ): Promise<Room> {
    return this.joinOrCreate(gameType, { firestoreGameId }, handlers);
  }

  /**
   * Join an existing game room as a spectator.
   * The server will track the client as a spectator (not a player).
   *
   * @param gameType - Client-side game type (e.g., "chess_game")
   * @param firestoreGameId - Firestore game ID (used with filterBy to find the room)
   * @param handlers - Event handlers
   * @returns The joined Room instance
   */
  async joinAsSpectator(
    gameType: string,
    firestoreGameId: string,
    handlers: ColyseusEventHandlers = {},
  ): Promise<Room> {
    return this.joinOrCreate(
      gameType,
      { firestoreGameId, spectator: true },
      handlers,
    );
  }

  /**
   * Create a SpectatorRoom for single-player game spectating.
   * The caller becomes the host of the room.
   *
   * @param gameType - Game type being played (for display)
   * @param handlers - Event handlers
   * @returns The created Room instance
   */
  async createSpectatorRoom(
    gameType: string,
    handlers: ColyseusEventHandlers = {},
  ): Promise<Room> {
    const token = await this.getAuthToken();
    this.eventHandlers = handlers;

    try {
      const room = await this.client.joinOrCreate(COLYSEUS_SPECTATOR_ROOM, {
        gameType,
        token,
        protocolVersion: GAME_PROTOCOL_VERSION,
        buildInfo: getClientBuildInfo(),
        traceId: createTraceId("gs"),
      });

      this.setupRoomHandlers(room, handlers);
      logger.info(
        `[Colyseus] Created spectator room: ${room.roomId} (game: ${gameType})`,
      );

      return room;
    } catch (error: any) {
      logger.error(
        `[Colyseus] Failed to create spectator room: ${error?.message}\nStack: ${error?.stack}`,
      );
      throw error;
    }
  }

  /**
   * Join an existing SpectatorRoom as a spectator.
   *
   * @param roomId - The SpectatorRoom's Colyseus room ID
   * @param handlers - Event handlers
   * @returns The joined Room instance
   */
  async joinSpectatorRoom(
    roomId: string,
    handlers: ColyseusEventHandlers = {},
  ): Promise<Room> {
    return this.joinById(roomId, { spectator: true }, handlers);
  }

  // ===========================================================================
  // Context-Driven Join (canonical path)
  // ===========================================================================

  /**
   * Join or create a room using the canonical GameSessionContext.
   *
   * This is the preferred join path — it resolves room names,
   * builds canonical join options (token, protocolVersion, buildInfo,
   * traceId), and maps errors to structured GameError objects.
   *
   * @param ctx - GameSessionContext from the screen / invite flow
   * @param handlers - Lifecycle event handlers
   * @param extras - Additional ad-hoc options (duration, difficulty, etc.)
   * @returns The joined Room instance
   * @throws GameError on failure
   */
  async joinWithContext(
    ctx: GameSessionContext,
    handlers: ColyseusEventHandlers = {},
    extras: Record<string, unknown> = {},
  ): Promise<Room> {
    const roomName = resolveColyseusRoomName(ctx.gameType);
    const joinOpts = await buildJoinOptions(ctx);

    logger.info(
      `[Colyseus] joinWithContext → room=${roomName}, traceId=${joinOpts.traceId}, ` +
        `firestoreGameId=${joinOpts.firestoreGameId ?? "none"}, ` +
        `spectator=${joinOpts.spectator ?? false}`,
    );

    try {
      const room = await this.client.joinOrCreate(roomName, {
        ...extras,
        ...joinOpts,
      });

      this.activeRoom = room;
      this.eventHandlers = handlers;
      this.setupRoomHandlers(room, handlers);

      logger.info(
        `[Colyseus] Joined room: ${roomName} (${room.roomId}), traceId=${joinOpts.traceId}`,
      );

      return room;
    } catch (error: any) {
      logger.error(
        `[Colyseus] joinWithContext failed: ${error?.message}\n` +
          `traceId=${joinOpts.traceId}\nStack: ${error?.stack}`,
      );

      // Map SDK errors to canonical GameError
      const code = mapJoinError(error);
      throw createGameError(code, {
        message: error?.message ?? "Failed to join room",
        context: {
          roomName,
          gameType: ctx.gameType,
          traceId: joinOpts.traceId,
          firestoreGameId: ctx.firestoreGameId,
        },
      });
    }
  }

  /**
   * Leave the current room gracefully.
   */
  async leaveRoom(): Promise<void> {
    if (this.activeRoom) {
      try {
        await this.activeRoom.leave();
      } catch (error) {
        logger.warn("[Colyseus] Error leaving room:", error);
      }
      this.activeRoom = null;
      this.eventHandlers = {};
    }
  }

  /**
   * Fully clear the active session — leave room, null all refs, clear handlers.
   *
   * This is the "hard cleanup" used when a user exits a game to ensure
   * the Play screen doesn't show a stale active session (fixes Bug #2).
   */
  async clearActiveSession(): Promise<void> {
    if (this.activeRoom) {
      try {
        await this.activeRoom.leave(true); // consented leave
      } catch {
        /* ignore */
      }
      this.activeRoom = null;
    }
    this.eventHandlers = {};
    logger.info("[Colyseus] Active session fully cleared");
  }

  /**
   * Send a message to the current room.
   */
  send(type: string, payload?: any): void {
    if (this.activeRoom) {
      this.activeRoom.send(type, payload);
    } else {
      logger.warn("[Colyseus] Cannot send — no active room");
    }
  }

  /**
   * Get the current active room.
   */
  getActiveRoom(): Room | null {
    return this.activeRoom;
  }

  /**
   * Check if currently connected to a room.
   */
  isConnected(): boolean {
    return this.activeRoom !== null;
  }

  /**
   * Measure latency to the Colyseus server.
   * Uses a simple HTTP round-trip time measurement.
   * @returns Average latency in milliseconds
   */
  async getLatency(): Promise<number> {
    try {
      const httpUrl = (COLYSEUS_SERVER_URL || "").replace("ws", "http");
      const start = performance.now();
      await fetch(httpUrl + "/health");
      return Math.round(performance.now() - start);
    } catch {
      return -1; // Server unreachable
    }
  }

  // ===========================================================================
  // Internal Handlers
  // ===========================================================================

  private setupRoomHandlers(room: Room, handlers: ColyseusEventHandlers): void {
    // Store reconnection token for later use
    if (room.reconnectionToken) {
      logger.info(
        `[Colyseus] Reconnection token: ${room.reconnectionToken.substring(0, 8)}...`,
      );
    }

    // Use the scoped `handlers` argument — NOT `this.eventHandlers` —
    // so that a later joinOrCreate (different room) can't hijack these
    // callbacks.  Each room gets its own frozen snapshot of handlers.

    // State changes
    room.onStateChange((newState: any) => {
      handlers.onStateChange?.(newState);
    });

    // Connection drop — v0.17 SDK has native onDrop signal
    room.onDrop((code: number, reason?: string) => {
      logger.warn(
        `[Colyseus] Connection dropped (code ${code}) — signalling reconnection…`,
      );
      handlers.onDrop?.(code, reason);
    });

    // Left room — consented or final leave
    room.onLeave((code: number) => {
      logger.info(`[Colyseus] Left room: ${code}`);
      // Only clear activeRoom if it's still THIS room — prevents a
      // stale room's onLeave from nullifying a newer session.
      if (this.activeRoom === room) {
        this.activeRoom = null;
      }
      handlers.onLeave?.(code);
    });

    // Error
    room.onError((code: number, message?: string) => {
      logger.error(`[Colyseus] Room error: ${code} — ${message}`);
      handlers.onError?.(code, message);
    });
  }
}

// =============================================================================
// Error Mapping
// =============================================================================

/**
 * Map a Colyseus SDK error to a GameErrorCode.
 * Inspects error message for common patterns.
 */
function mapJoinError(error: any): GameErrorCode {
  const msg = (error?.message ?? "").toLowerCase();
  if (
    msg.includes("protocolversion") ||
    msg.includes("protocol version") ||
    msg.includes("update the app")
  ) {
    return GameErrorCode.PROTOCOL_VERSION_MISMATCH;
  }
  if (msg.includes("full") || msg.includes("maxclients")) {
    return GameErrorCode.JOIN_ROOM_FULL;
  }
  if (msg.includes("auth") || msg.includes("token")) {
    return GameErrorCode.AUTH_TOKEN_INVALID;
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return GameErrorCode.JOIN_TIMEOUT;
  }
  if (msg.includes("not found") || msg.includes("no available")) {
    return GameErrorCode.JOIN_ROOM_NOT_FOUND;
  }
  return GameErrorCode.JOIN_FAILED;
}

// =============================================================================
// Singleton Export
// =============================================================================

export const colyseusService = new ColyseusService();
