import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("IncrementalRoom");

/**
 * IncrementalRoom — Abstract base for incremental/idle games.
 *
 * Unlike ScoreRaceRoom (competitive, short-session, score-based),
 * IncrementalRoom supports:
 *  - Continuous simulation at a configurable Hz (no "win" condition)
 *  - Server-authoritative input-queue pattern
 *  - Single-player or cooperative (not competitive)
 *  - Cold storage persistence (Firestore snapshots between sessions)
 *  - Spectator support via BaseGameState.spectators MapSchema
 *
 * Follows Colyseus v0.17 patterns:
 *  - onDrop(client, code) for unexpected disconnects
 *  - onLeave(client, code) for intentional/final leaves
 *  - allowReconnection(client, timeout) in onDrop
 *  - setSimulationInterval(cb, ms) for game loop
 *  - broadcast(type, data, { except }) for messaging
 *
 * Subclasses must implement:
 *  - initSim(options): Initialize simulation state (+ call setState)
 *  - stepSim(dt): Advance simulation by one tick
 *  - applyCommand(sessionId, cmd): Process a player input command
 *  - serializeSnapshot(): Return serializable sim state for cold storage
 *  - hydrateSnapshot(data): Restore from cold storage
 */

import { Client, Room } from "colyseus";
import { Player, BaseGameState } from "../../schemas/common";
import { SpectatorEntry } from "../../schemas/spectator";
import { verifyFirebaseToken } from "../../services/firebase";
import {
  saveSnapshot,
  loadSnapshot,
  deleteSnapshot,
} from "../../services/coldStorage";

// ─── Types ───────────────────────────────────────────────────

export interface IncrementalAuth {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

export interface IncrementalJoinOptions {
  token?: string;
  spectator?: boolean;
  name?: string;
  firestoreGameId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IncrementalRoomOptions {
  state: BaseGameState;
}

// ─── Abstract Base ───────────────────────────────────────────

export abstract class IncrementalRoom<
  TOptions extends IncrementalRoomOptions = IncrementalRoomOptions,
> extends Room<TOptions> {
  maxClients = 12;
  patchRate = 50; // 20fps schema patching
  autoDispose = true;

  /** Game type key — must match COLYSEUS_ROOM_NAMES. */
  protected abstract readonly gameTypeKey: string;

  /** Simulation frequency in Hz. */
  protected abstract readonly simHz: number;

  /** Maximum number of active players (not spectators). */
  protected readonly maxActivePlayers: number = 2;

  /** Reconnection timeout in seconds. */
  protected readonly reconnectionTimeoutSec: number = 15;

  /** Track spectator session IDs. */
  protected spectatorSessionIds = new Set<string>();

  /** Track player session IDs (for input validation). */
  protected playerSessionIds = new Set<string>();

  /** Whether the sim loop is currently running. */
  private simRunning = false;

  /** Idle timeout — auto-dispose if no players for this duration (ms). */
  protected readonly idleTimeoutMs: number = 5 * 60 * 1000; // 5 minutes

  /** Timer handle for idle auto-dispose. */
  private idleTimerHandle: ReturnType<typeof setTimeout> | null = null;

  /** The firestoreGameId for cold storage. Populated in onCreate. */
  private persistenceKey: string | null = null;

  // ── Abstract hooks ───────────────────────────────────────

  /** Initialize simulation state. Called in onCreate. Must call setState(). */
  protected abstract initSim(options: Record<string, unknown>): void;

  /** Advance the simulation by one tick (dt = 1/simHz seconds). */
  protected abstract stepSim(dt: number): void;

  /** Validate and apply a player input command. Return false to reject. */
  protected abstract applyCommand(
    sessionId: string,
    cmd: Record<string, unknown>,
  ): boolean;

  /** Serialize current sim state for cold storage. */
  protected abstract serializeSnapshot(): Record<string, unknown>;

  /** Hydrate sim state from a cold storage snapshot. */
  protected abstract hydrateSnapshot(data: Record<string, unknown>): void;

  /** Optional hook: called when a player joins (not spectator). */
  protected onPlayerJoined?(
    sessionId: string,
    auth: IncrementalAuth,
  ): void;

  /** Optional hook: called when a player leaves (not spectator). */
  protected onPlayerLeft?(sessionId: string): void;

  // ── Helpers ──────────────────────────────────────────────

  protected isSpectator(sessionId: string): boolean {
    return this.spectatorSessionIds.has(sessionId);
  }

  protected isPlayer(sessionId: string): boolean {
    return this.playerSessionIds.has(sessionId);
  }

  protected getPlayerCount(): number {
    return this.playerSessionIds.size;
  }

  // ── Auth ─────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async onAuth(_client: Client, options: any, context: any): Promise<IncrementalAuth> {
    const token = context?.token || options?.token || "";
    const decoded = await verifyFirebaseToken(token);
    return {
      uid: decoded.uid,
      displayName: decoded.name || decoded.email || "Player",
      avatarUrl: decoded.picture || "",
    };
  }

  // ── Create ───────────────────────────────────────────────

  onCreate(options: Record<string, unknown>): void {
    // Store persistence key (firestoreGameId) for cold storage
    if (typeof options.firestoreGameId === "string" && options.firestoreGameId) {
      this.persistenceKey = options.firestoreGameId;
    }

    // Let subclass initialize sim (which must call setState)
    this.initSim(options);

    // Attempt cold storage restoration (async, non-blocking)
    if (this.persistenceKey) {
      this.restoreFromColdStorage(this.persistenceKey);
    }

    // Register message handlers
    this.onMessage("input", (client: Client, cmd: Record<string, unknown>) => {
      if (this.isSpectator(client.sessionId)) {
        client.send("error", {
          code: "SPECTATOR_NO_INPUT",
          message: "Spectators cannot send input commands.",
        });
        return;
      }
      if (!this.isPlayer(client.sessionId)) {
        client.send("error", {
          code: "UNKNOWN_PLAYER",
          message: "You are not a registered player in this room.",
        });
        return;
      }
      const ok = this.applyCommand(client.sessionId, cmd);
      if (!ok) {
        client.send("error", {
          code: "INVALID_COMMAND",
          message: "Command rejected by server.",
        });
      }
    });

    this.onMessage("ready", (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = (this.state as any).players?.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.checkAllReady();
      }
    });

    this.onMessage("app_state", (_client: Client, payload: Record<string, unknown>) => {
      log.debug("app_state", payload);
    });

    log.info(`Room ${this.roomId} created (type=${this.gameTypeKey}, hz=${this.simHz})`);
  }

  // ── Join ─────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onJoin(client: Client, options: any, auth: any): void {
    const joinOpts = options as IncrementalJoinOptions;
    const authInfo = auth as IncrementalAuth;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = this.state as any;

    // ── Spectator path ──
    if (joinOpts.spectator === true) {
      if (state.spectatorCount >= state.maxSpectators) {
        client.leave(4001);
        return;
      }
      this.spectatorSessionIds.add(client.sessionId);
      const entry = new SpectatorEntry();
      entry.uid = authInfo.uid;
      entry.sessionId = client.sessionId;
      entry.displayName = authInfo.displayName;
      entry.avatarUrl = authInfo.avatarUrl;
      entry.joinedAt = Date.now();
      state.spectators.set(client.sessionId, entry);
      state.spectatorCount = state.spectators.size;
      // Broadcast spectator count to all clients
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).broadcast("spectator_count", {
        count: state.spectatorCount,
      });
      log.info(`Spectator ${authInfo.displayName} joined (session=${client.sessionId})`);
      return;
    }

    // ── Player path ──
    if (this.playerSessionIds.size >= this.maxActivePlayers) {
      log.warn(`Player slots full — demoting ${authInfo.displayName} to spectator`);
      joinOpts.spectator = true;
      this.onJoin(client, joinOpts, authInfo);
      return;
    }

    // Cancel idle timer — a player is joining
    this.clearIdleTimer();

    const player = new Player();
    player.uid = authInfo.uid;
    player.sessionId = client.sessionId;
    player.displayName = authInfo.displayName;
    player.avatarUrl = authInfo.avatarUrl;
    player.connected = true;
    player.playerIndex = this.playerSessionIds.size;
    player.ready = false;

    state.players.set(client.sessionId, player);
    this.playerSessionIds.add(client.sessionId);

    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: player.playerIndex,
      gameType: this.gameTypeKey,
    });

    log.info(
      `Player ${authInfo.displayName} joined (session=${client.sessionId}, idx=${player.playerIndex})`,
    );

    // Notify subclass
    this.onPlayerJoined?.(client.sessionId, authInfo);

    // Single-player game: auto-ready
    if (this.maxActivePlayers === 1) {
      player.ready = true;
      this.checkAllReady();
    }
  }

  // ── Drop (unexpected disconnect) ────────────────────────

  onDrop(client: Client, code: number): void {
    if (this.spectatorSessionIds.has(client.sessionId)) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = this.state as any;
    const player = state.players?.get(client.sessionId);
    if (player) {
      player.connected = false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).broadcast("player_disconnected", {
      sessionId: client.sessionId,
      displayName: player?.displayName ?? "Unknown",
    });

    this.allowReconnection(client, this.reconnectionTimeoutSec);

    log.info(
      `Player dropped (session=${client.sessionId}, code=${code}, timeout=${this.reconnectionTimeoutSec}s)`,
    );
  }

  // ── Reconnect ────────────────────────────────────────────

  onReconnect(client: Client): void {
    if (this.spectatorSessionIds.has(client.sessionId)) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = this.state as any;
    const player = state.players?.get(client.sessionId);
    if (player) {
      player.connected = true;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).broadcast("player_reconnected", {
      sessionId: client.sessionId,
      displayName: player?.displayName ?? "Unknown",
    });

    log.info(`Player reconnected (session=${client.sessionId})`);
  }

  // ── Leave (intentional/final) ───────────────────────────

  onLeave(client: Client, code: number): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = this.state as any;

    // Spectator leaving
    if (this.spectatorSessionIds.has(client.sessionId)) {
      this.spectatorSessionIds.delete(client.sessionId);
      state.spectators.delete(client.sessionId);
      state.spectatorCount = state.spectators.size;
      // Broadcast updated spectator count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).broadcast("spectator_count", {
        count: state.spectatorCount,
      });
      log.info(`Spectator left (session=${client.sessionId})`);
      return;
    }

    // Player leaving
    const player = state.players?.get(client.sessionId);
    if (player) {
      state.players.delete(client.sessionId);
      this.playerSessionIds.delete(client.sessionId);
      this.onPlayerLeft?.(client.sessionId);
      log.info(`Player ${player.displayName} left (code=${code})`);
    }

    // If no players remain during playing, stop sim and start idle timer
    if (state.phase === "playing" && this.playerSessionIds.size === 0) {
      this.stopSim();
      this.startIdleTimer();
    } else if (this.playerSessionIds.size === 0) {
      this.startIdleTimer();
    }
  }

  // ── Sim Lifecycle ────────────────────────────────────────

  private checkAllReady(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = this.state as any;
    if (state.phase !== "waiting") return;

    let allReady = true;
    state.players.forEach((p: Player) => {
      if (!p.ready) allReady = false;
    });

    if (allReady && this.playerSessionIds.size > 0) {
      this.startSim();
    }
  }

  protected startSim(): void {
    if (this.simRunning) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = this.state as any;
    state.phase = "playing";
    this.simRunning = true;
    const dt = 1 / this.simHz;
    const intervalMs = 1000 / this.simHz;

    this.setSimulationInterval(() => {
      if (!this.simRunning) return;
      this.stepSim(dt);
      if (state.timer) {
        state.timer.elapsed += dt;
      }
    }, intervalMs);

    log.info(`Sim started (roomId=${this.roomId}, hz=${this.simHz})`);
  }

  protected stopSim(): void {
    this.simRunning = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = this.state as any;
    if (state.phase === "playing") {
      state.phase = "finished";
    }
    log.info(`Sim stopped (roomId=${this.roomId})`);
  }

  async onDispose(): Promise<void> {
    this.simRunning = false;
    this.clearIdleTimer();

    // Persist snapshot to cold storage on dispose
    if (this.persistenceKey) {
      const snapshot = this.serializeSnapshot();
      const tick =
        (snapshot as Record<string, unknown>).tick as number | undefined;
      await saveSnapshot(
        this.persistenceKey,
        this.gameTypeKey,
        this.roomId,
        snapshot,
        tick ?? 0,
      );
    }

    log.info(`Room ${this.roomId} disposed`);
  }

  // ── Cold Storage ─────────────────────────────────────────

  /**
   * Attempt to restore simulation state from a Firestore snapshot.
   * Called during onCreate. If a snapshot is found, calls hydrateSnapshot().
   */
  private restoreFromColdStorage(firestoreGameId: string): void {
    loadSnapshot(firestoreGameId)
      .then((snapshot) => {
        if (snapshot && snapshot.data) {
          this.hydrateSnapshot(snapshot.data);
          log.info(
            `Restored cold storage for ${firestoreGameId} (tick=${snapshot.tick})`,
          );
        }
      })
      .catch((err) => {
        log.error(`Cold storage restore failed for ${firestoreGameId}:`, err);
      });
  }

  /**
   * Explicitly delete the cold storage snapshot (e.g. on game reset).
   */
  protected async clearColdStorage(): Promise<void> {
    if (this.persistenceKey) {
      await deleteSnapshot(this.persistenceKey);
    }
  }

  // ── Idle Timer ───────────────────────────────────────────

  /**
   * Start or reset the idle timer. When no players remain, the room
   * will auto-dispose after idleTimeoutMs.
   */
  private startIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimerHandle = setTimeout(() => {
      if (this.playerSessionIds.size === 0) {
        log.info(
          `Idle timeout reached for room ${this.roomId} — disposing`,
        );
        this.disconnect();
      }
    }, this.idleTimeoutMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimerHandle) {
      clearTimeout(this.idleTimerHandle);
      this.idleTimerHandle = null;
    }
  }
}
