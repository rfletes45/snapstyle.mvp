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

  /** Per-spectator helper energy for boost sessions */
  private helperEnergy = new Map<string, number>();
  private helperActionAt = new Map<string, number>();
  private cheerActionAt = new Map<string, number>();
  private readonly helperActionCooldownMs = 850;
  private readonly cheerCooldownMs = 750;

  private readonly maxHelperEnergy = 6;

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
        sessionMode?: "spectate" | "boost" | "expedition";
        activeMineId?: string;
        bossHp?: number;
        bossMaxHp?: number;
        expeditionBossHp?: number;
        expeditionBossMaxHp?: number;
        crewSummaryJson?: string;
        deltaEvents?: Array<{ type: string; payload?: Record<string, unknown>; at?: number }>;
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
      if (payload.sessionMode) {
        this.state.sessionMode = payload.sessionMode;
      }
      if (payload.activeMineId !== undefined) {
        this.state.activeMineId = payload.activeMineId;
      }
      if (payload.bossHp !== undefined) {
        this.state.bossHp = payload.bossHp;
      }
      if (payload.bossMaxHp !== undefined) {
        this.state.bossMaxHp = payload.bossMaxHp;
      }
      if (payload.expeditionBossHp !== undefined) {
        this.state.expeditionBossHp = payload.expeditionBossHp;
      }
      if (payload.expeditionBossMaxHp !== undefined) {
        this.state.expeditionBossMaxHp = payload.expeditionBossMaxHp;
      }
      if (payload.crewSummaryJson !== undefined) {
        this.state.crewSummaryJson = payload.crewSummaryJson;
      }
      if (Array.isArray(payload.deltaEvents) && payload.deltaEvents.length > 0) {
        payload.deltaEvents.slice(0, 12).forEach((event) => {
          this.broadcast("spectator_delta", {
            type: event.type || "event",
            payload: event.payload || {},
            at: event.at || Date.now(),
          });
        });
      }

      if (payload.gameStateJson) {
        try {
          const parsed = JSON.parse(payload.gameStateJson);
          if (typeof parsed?.activeMineId === "string") {
            this.state.activeMineId = parsed.activeMineId;
          }
          if (parsed?.bossVein) {
            this.state.bossHp = Math.max(0, Math.floor(parsed.bossVein.hp || 0));
            this.state.bossMaxHp = Math.max(0, Math.floor(parsed.bossVein.maxHp || 0));
          }
          if (parsed?.expedition) {
            this.state.expeditionBossHp = Math.max(0, Math.floor(parsed.expedition.bossHp || 0));
            this.state.expeditionBossMaxHp = Math.max(
              0,
              Math.floor(parsed.expedition.bossMaxHp || 0),
            );
            this.state.crewSummaryJson = JSON.stringify(
              parsed.expedition.crewContributions || [],
            );
          }
        } catch {
          // Ignore malformed payloads; keep last valid coarse state.
        }
      }
    },

    delta_event: (
      client: Client,
      payload?: { type?: string; payload?: Record<string, unknown>; at?: number },
    ) => {
      if (client.sessionId !== this.hostSessionId) return;
      this.broadcast("spectator_delta", {
        type: payload?.type || "event",
        payload: payload?.payload || {},
        at: payload?.at || Date.now(),
      });
    },

    /**
     * Host starts a temporary helper boost session (for invited friends).
     */
    boost_session_start: (
      client: Client,
      payload?: { durationMs?: number },
    ) => {
      if (client.sessionId !== this.hostSessionId) return;
      const durationMs = Math.max(30_000, Math.min(180_000, payload?.durationMs || 90_000));
      this.state.boostSessionEndsAt = Date.now() + durationMs;

      // Refresh helper energy for all currently connected spectators.
      this.spectatorSessionIds.forEach((sessionId) => {
        this.helperEnergy.set(sessionId, this.maxHelperEnergy);
      });

      this.broadcast("boost_session_started", {
        endsAt: this.state.boostSessionEndsAt,
        durationMs,
      });
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
      this.state.boostSessionEndsAt = 0;
      log.info(
        `[SpectatorRoom] Game ended: ${this.state.hostName} â€” score: ${this.state.currentScore}`,
      );
    },

    /**
     * Spectator helper action (tap boost / ore rain).
     * Forwarded to host if helper session is active and spectator has energy.
     */
    helper_boost: (
      client: Client,
      payload?: { kind?: string; value?: number },
    ) => {
      if (!this.spectatorSessionIds.has(client.sessionId)) return;
      if (this.state.phase !== "active") return;
      if (this.state.boostSessionEndsAt <= Date.now()) return;
      const now = Date.now();
      const lastActionAt = this.helperActionAt.get(client.sessionId) || 0;
      if (now - lastActionAt < this.helperActionCooldownMs) return;
      this.helperActionAt.set(client.sessionId, now);

      const remaining = this.helperEnergy.get(client.sessionId) ?? 0;
      if (remaining <= 0) {
        client.send("helper_energy", {
          remaining: 0,
          max: this.maxHelperEnergy,
        });
        return;
      }

      const nextRemaining = remaining - 1;
      this.helperEnergy.set(client.sessionId, nextRemaining);
      client.send("helper_energy", {
        remaining: nextRemaining,
        max: this.maxHelperEnergy,
      });

      const helper = this.state.spectators.get(client.sessionId);
      const hostClient = this.clients.find(
        (candidate) => candidate.sessionId === this.hostSessionId,
      );
      if (!hostClient) return;

      hostClient.send("helper_boost", {
        helperUid: helper?.uid || "",
        helperName: helper?.displayName || "Helper",
        helperSessionId: client.sessionId,
        kind: payload?.kind || "tap_boost",
        value: payload?.value ?? 1,
        at: now,
      });
    },

    /**
     * Spectator requests a helper energy refresh after fully wiring message
     * handlers client-side. This avoids early join-time messages being dropped.
     */
    helper_energy_sync: (client: Client) => {
      if (!this.spectatorSessionIds.has(client.sessionId)) return;
      const remaining = this.helperEnergy.get(client.sessionId) ?? this.maxHelperEnergy;
      client.send("helper_energy", {
        remaining,
        max: this.maxHelperEnergy,
      });
    },

    /**
     * Lightweight spectator reaction forwarded to host and viewers.
     */
    cheer: (
      client: Client,
      payload?: { emoji?: string },
    ) => {
      if (!this.spectatorSessionIds.has(client.sessionId)) return;
      const now = Date.now();
      const lastCheerAt = this.cheerActionAt.get(client.sessionId) || 0;
      if (now - lastCheerAt < this.cheerCooldownMs) return;
      this.cheerActionAt.set(client.sessionId, now);
      const helper = this.state.spectators.get(client.sessionId);
      const event = {
        helperUid: helper?.uid || "",
        helperName: helper?.displayName || "Spectator",
        emoji: payload?.emoji || "👏",
        at: now,
      };

      const hostClient = this.clients.find(
        (candidate) => candidate.sessionId === this.hostSessionId,
      );
      hostClient?.send("cheer", event);
      this.broadcast("cheer", event);
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
    this.helperEnergy.set(client.sessionId, this.maxHelperEnergy);
    this.helperActionAt.set(client.sessionId, 0);
    this.cheerActionAt.set(client.sessionId, 0);

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
      this.helperEnergy.delete(client.sessionId);
      this.helperActionAt.delete(client.sessionId);
      this.cheerActionAt.delete(client.sessionId);
      log.info(
        `[SpectatorRoom] Spectator left (${this.state.spectatorCount} watching)`,
      );
    }
  }

  async onDispose(): Promise<void> {
    log.info(`[SpectatorRoom] Room disposed: ${this.roomId}`);
  }
}


