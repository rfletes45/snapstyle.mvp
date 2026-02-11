import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("SpectatorRoom");

/**
 * SpectatorRoom â€” Dedicated room for single-player game spectating
 *
 * Allows friends to watch a player's single-player game in real-time.
 * The host creates this room when starting a single-player game with
 * spectating enabled, then pushes game state updates to the room.
 * Spectators join and receive live state patches via Colyseus.
 *
 * Lifecycle:
 * 1. Host creates room â†’ phase = "waiting"
 * 2. Host sends "start_hosting" â†’ phase = "active"
 * 3. Host periodically sends "state_update" â†’ gameStateJson updated
 * 4. Spectators join/leave freely during "active" phase
 * 5. Host sends "game_end" â†’ phase = "finished"
 * 6. All clients leave â†’ room auto-disposes
 *
 * @see docs/SPECTATOR_SYSTEM_PLAN.md Â§3.3
 */

import { Client, Room } from "colyseus";
import { SpectatorEntry, SpectatorRoomState } from "../../schemas/spectator";
import { verifyFirebaseToken } from "../../services/firebase";

// =============================================================================
// SpectatorRoom
// =============================================================================

// Intentionally standalone room: spectator host/observer lifecycle is distinct
// from gameplay room abstractions.
export class SpectatorRoom extends Room<{ state: SpectatorRoomState }> {
  maxClients = 11; // 1 host + 10 spectators
  patchRate = 100; // 10fps state sync
  autoDispose = true;

  /** Session ID of the host (the player being watched) */
  private hostSessionId: string = "";

  /** Track spectator session IDs for fast lookup */
  private spectatorSessionIds = new Set<string>();

  // ===========================================================================
  // Auth
  // ===========================================================================

  async onAuth(
    client: Client,
    options: Record<string, any>,
    context: any,
  ): Promise<any> {
    const decoded = await verifyFirebaseToken(
      context?.token || options?.token || "",
    );
    return {
      uid: decoded.uid,
      displayName: (decoded as { name?: string; email?: string; picture?: string }).name || (decoded as { name?: string; email?: string; picture?: string }).email || "Player",
      avatarUrl: (decoded as { name?: string; email?: string; picture?: string }).picture || "",
    };
  }

  // ===========================================================================
  // onCreate
  // ===========================================================================

  onCreate(options: Record<string, any>): void {
    this.setState(new SpectatorRoomState());
    this.state.gameType = options.gameType || "";
    this.state.phase = "waiting";
    this.state.maxSpectators = options.maxSpectators || 10;

    log.info(
      `[SpectatorRoom] Room created: ${this.roomId} (game: ${this.state.gameType})`,
    );
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    /**
     * Host signals they're starting the game.
     * Transitions the room to "active" phase.
     */
    start_hosting: (client: Client) => {
      if (client.sessionId !== this.hostSessionId) return;
      this.state.phase = "active";
      log.info(
        `[SpectatorRoom] Host started broadcasting: ${this.state.hostName}`,
      );
    },

    /**
     * Host pushes a game state snapshot.
     * This is the primary mechanism for spectator state sync.
     */
    state_update: (
      client: Client,
      payload: {
        gameStateJson?: string;
        currentScore?: number;
        currentLevel?: number;
        lives?: number;
      },
    ) => {
      if (client.sessionId !== this.hostSessionId) return;
      if (this.state.phase !== "active") return;

      if (payload.gameStateJson !== undefined) {
        this.state.gameStateJson = payload.gameStateJson;
      }
      if (payload.currentScore !== undefined) {
        this.state.currentScore = payload.currentScore;
      }
      if (payload.currentLevel !== undefined) {
        this.state.currentLevel = payload.currentLevel;
      }
      if (payload.lives !== undefined) {
        this.state.lives = payload.lives;
      }
    },

    /**
     * Host signals the game has ended.
     */
    game_end: (
      client: Client,
      payload?: { finalScore?: number; reason?: string },
    ) => {
      if (client.sessionId !== this.hostSessionId) return;
      if (payload?.finalScore !== undefined) {
        this.state.currentScore = payload.finalScore;
      }
      this.state.phase = "finished";
      log.info(
        `[SpectatorRoom] Game ended: ${this.state.hostName} â€” score: ${this.state.currentScore}`,
      );
    },

    /**
     * App state change (background/foreground).
     */
    app_state: (client: Client, payload: { state: string }) => {
      log.info(
        `[SpectatorRoom] App state: ${client.sessionId} â†’ ${payload.state}`,
      );
    },
  };

  // ===========================================================================
  // Player Lifecycle
  // ===========================================================================

  onJoin(client: Client, options: Record<string, any>, auth: any): void {
    // First person to join is the host
    if (!this.hostSessionId) {
      this.hostSessionId = client.sessionId;
      this.state.hostId = auth.uid;
      this.state.hostName = auth.displayName || "Host";

      log.info(
        `[SpectatorRoom] Host joined: ${auth.displayName} (${client.sessionId})`,
      );

      // Send confirmation to host
      client.send("host_confirmed", {
        roomId: this.roomId,
        sessionId: client.sessionId,
      });
      return;
    }

    // Everyone else is a spectator
    if (this.state.spectatorCount >= this.state.maxSpectators) {
      client.send("error", { message: "Spectator room is full" });
      client.leave(4001);
      return;
    }

    const spectator = new SpectatorEntry();
    spectator.uid = auth.uid;
    spectator.sessionId = client.sessionId;
    spectator.displayName = auth.displayName || "Spectator";
    spectator.avatarUrl = auth.avatarUrl || "";
    spectator.joinedAt = Date.now();

    this.state.spectators.set(client.sessionId, spectator);
    this.state.spectatorCount++;
    this.spectatorSessionIds.add(client.sessionId);

    log.info(
      `[SpectatorRoom] Spectator joined: ${auth.displayName} (${this.state.spectatorCount} watching)`,
    );
  }

  async onLeave(client: Client, code?: number): Promise<void> {
    // Host left
    if (client.sessionId === this.hostSessionId) {
      // Brief reconnection window for the host
      const consented = code !== undefined && code >= 4000;
      if (this.state.phase === "active" && !consented) {
        try {
          await this.allowReconnection(client, 30);
          log.info(`[SpectatorRoom] Host reconnected`);
          return;
        } catch {
          // Host didn't come back â€” end the session
          log.info(`[SpectatorRoom] Host disconnected permanently`);
        }
      }

      this.state.phase = "finished";
      this.broadcast("host_left", {});
      log.info(`[SpectatorRoom] Host left, room will close`);
      return;
    }

    // Spectator left
    if (this.spectatorSessionIds.has(client.sessionId)) {
      this.state.spectators.delete(client.sessionId);
      this.state.spectatorCount = Math.max(0, this.state.spectatorCount - 1);
      this.spectatorSessionIds.delete(client.sessionId);
      log.info(
        `[SpectatorRoom] Spectator left (${this.state.spectatorCount} watching)`,
      );
    }
  }

  async onDispose(): Promise<void> {
    log.info(`[SpectatorRoom] Room disposed: ${this.roomId}`);
  }
}


