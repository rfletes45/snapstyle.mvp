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

import { Client, Room } from "@colyseus/sdk";
import { getAuth } from "firebase/auth";
import {
  COLYSEUS_SERVER_URL,
  COLYSEUS_SPECTATOR_ROOM,
  getColyseusRoomName,
} from "@/config/colyseus";


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
  private client: Client;
  private activeRoom: Room | null = null;
  private eventHandlers: ColyseusEventHandlers = {};

  constructor() {
    this.client = new Client(COLYSEUS_SERVER_URL);
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
    this.eventHandlers = handlers;

    try {
      const room = await this.client.joinOrCreate(roomName, {
        ...options,
        token,
      });

      this.activeRoom = room;
      this.setupRoomHandlers(room);

      logger.info(`[Colyseus] Joined room: ${roomName} (${room.roomId})`);

      return room;
    } catch (error) {
      logger.error("[Colyseus] Failed to join room:", error);
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
    this.eventHandlers = handlers;

    try {
      const room = await this.client.joinById(roomId, {
        ...options,
        token,
      });

      this.activeRoom = room;
      this.setupRoomHandlers(room);

      logger.info(`[Colyseus] Joined room by ID: ${roomId}`);

      return room;
    } catch (error) {
      logger.error("[Colyseus] Failed to join room by ID:", error);
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
      });

      this.setupRoomHandlers(room);
      logger.info(
        `[Colyseus] Created spectator room: ${room.roomId} (game: ${gameType})`,
      );

      return room;
    } catch (error) {
      logger.error("[Colyseus] Failed to create spectator room:", error);
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
      const start = performance.now();
      await fetch(COLYSEUS_SERVER_URL.replace("ws", "http") + "/health");
      return Math.round(performance.now() - start);
    } catch {
      return -1; // Server unreachable
    }
  }

  // ===========================================================================
  // Internal Handlers
  // ===========================================================================

  private setupRoomHandlers(room: Room): void {
    // Store reconnection token for later use
    if (room.reconnectionToken) {
      logger.info(
        `[Colyseus] Reconnection token: ${room.reconnectionToken.substring(0, 8)}...`,
      );
    }

    // State changes
    room.onStateChange((newState: any) => {
      this.eventHandlers.onStateChange?.(newState);
    });

    // Connection drop — v0.17 SDK has native onDrop signal
    room.onDrop((code: number, reason?: string) => {
      logger.warn(
        `[Colyseus] Connection dropped (code ${code}) — signalling reconnection…`,
      );
      this.eventHandlers.onDrop?.(code, reason);
    });

    // Left room — consented or final leave
    room.onLeave((code: number) => {
      logger.info(`[Colyseus] Left room: ${code}`);
      this.activeRoom = null;
      this.eventHandlers.onLeave?.(code);
    });

    // Error
    room.onError((code: number, message?: string) => {
      logger.error(`[Colyseus] Room error: ${code} — ${message}`);
      this.eventHandlers.onError?.(code, message);
    });
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const colyseusService = new ColyseusService();
