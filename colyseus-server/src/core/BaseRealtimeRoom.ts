/**
 * Realtime Framework — Base Realtime Room
 *
 * The reusable backbone that all realtime Colyseus rooms extend.
 * Provides:
 * - Firebase auth + session membership verification
 * - Standardized room lifecycle (provisioning → gameplay → resolution)
 * - Configurable reconnect / disconnect / grace handling
 * - Spectator support hooks
 * - Typed message validation and rate limiting
 * - Runtime summary mirroring to Firestore
 * - Idempotent resolution bridge into Firebase V4 pipeline
 * - Heartbeat and stale room cleanup
 * - Structured logging
 *
 * Game-specific rooms extend this and implement:
 * - getGameDefinition(): the game's RealtimeGameDefinition
 * - onMatchStart(): initialize game-specific state
 * - onMatchEnd(): compute final results
 * - Game-specific message handlers
 *
 * @module core/BaseRealtimeRoom
 */

import { Client, Room } from "colyseus";
import { isDevBypass } from "../bridge/firebaseBridge";
import type { SessionGuardResult } from "./FirebaseSessionGuard";
import { verifyJoin } from "./FirebaseSessionGuard";
import { createValidatedHandler, MessageRegistry } from "./InputValidation";
import {
    buildResolutionPayload,
    writeResolutionRequest,
} from "./ResolutionBridge";
import { RuntimeMirror } from "./RuntimeMirror";
import type {
    DisconnectPolicy,
    MatchStartPolicy,
    RealtimeGameDefinition,
    RealtimePlayerInfo,
    RealtimeResolutionPayload,
    RealtimeScoreboardEntry,
    RoomPhase,
    RuntimeSummary,
} from "./types";

// =============================================================================
// Auth data passed from onAuth to onJoin
// =============================================================================

export interface BaseAuthData {
  uid: string;
  displayName: string;
  participantUids: string[];
  spectatorUids: string[];
  players: Array<{ uid: string; displayName?: string }>;
  settings: Record<string, unknown>;
  isSpectator: boolean;
  spectatorsAllowed: boolean;
}

// =============================================================================
// Base Room Implementation
// =============================================================================

export abstract class BaseRealtimeRoom extends Room {
  // ── Game definition (provided by subclass) ────────────────────────
  protected abstract getGameDefinition(): RealtimeGameDefinition;

  // ── State ─────────────────────────────────────────────────────────
  protected phase: RoomPhase = "provisioning";
  protected sessionId = "";
  protected roomVersion = 0;
  protected matchStartedAt: number | null = null;
  protected players = new Map<string, RealtimePlayerInfo>();
  protected spectators = new Map<string, RealtimePlayerInfo>();
  protected expectedParticipantUids = new Set<string>();
  protected rosterDisplayNames = new Map<string, string>();
  protected settings: Record<string, unknown> = {};
  protected isResolved = false;

  // ── Infrastructure ────────────────────────────────────────────────
  protected messageRegistry = new MessageRegistry();
  protected runtimeMirror: RuntimeMirror | null = null;
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private abandonmentTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private matchDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private joinGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private disposalTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Template methods (subclass implements) ────────────────────────

  /**
   * Called when the match actually starts (after countdown, when roster is ready).
   * Subclass should initialize game-specific state here.
   */
  protected abstract onMatchStart(): void;

  /**
   * Called when the match ends, before resolution bridge write.
   * Subclass should compute final scoreboard and metrics.
   *
   * @param reason - Why the match ended
   * @returns Scoreboard entries and optional performance metrics
   */
  protected abstract onMatchEnd(reason: string): {
    scoreboard: RealtimeScoreboardEntry[];
    winnerIds: string[];
    playerMetrics?: Record<string, Record<string, unknown>>;
  };

  /**
   * Called on each tick for fixed_tick or hybrid_round_tick games.
   * Override in subclass if needed. No-op by default.
   *
   * @param deltaMs - Milliseconds since last tick
   */
  protected onTick(_deltaMs: number): void {
    // No-op by default. Override in fixed_tick games.
  }

  /**
   * Called when a player reconnects during an active match.
   * Subclass can send catch-up state here.
   */
  protected onPlayerReconnect(_client: Client, _uid: string): void {
    // No-op by default. Override if game needs to send catch-up state.
  }

  /**
   * Called when a player disconnects during an active match.
   * Subclass can handle game-specific consequences (e.g., skip turn).
   */
  protected onPlayerDisconnect(_uid: string): void {
    // No-op by default. Override if game needs custom disconnect handling.
  }

  /**
   * Called when a spectator joins.
   * Subclass can send spectator-specific state here.
   */
  protected onSpectatorJoin(_client: Client, _uid: string): void {
    // No-op by default.
  }

  /**
   * Register game-specific message handlers.
   * Called during onCreate. Use this.registerGameMessage() to register handlers.
   */
  protected abstract registerGameMessages(): void;

  /**
   * Get the current game state for broadcasting.
   * Subclass returns its game-specific state.
   *
   * @param viewerUid - Who is viewing (for visibility filtering)
   * @param isSpectator - Whether the viewer is a spectator
   */
  protected abstract getGameState(
    viewerUid?: string,
    isSpectator?: boolean,
  ): Record<string, unknown>;

  // ═══════════════════════════════════════════════════════════════════
  // Colyseus Lifecycle
  // ═══════════════════════════════════════════════════════════════════

  onCreate(options: Record<string, unknown>): void {
    const def = this.getGameDefinition();
    this.sessionId = (options.sessionId as string) ?? "";
    this.maxClients = def.maxPlayers + (def.supportsSpectate ? 20 : 0);
    this.autoDispose = false;

    // Apply provisional settings from room creation options
    if (options.settings && typeof options.settings === "object") {
      this.settings = def.validateSettings(
        options.settings as Record<string, unknown>,
      );
    } else {
      this.settings = { ...def.defaultSettings };
    }

    this.phase = "waiting_for_players";
    this.log("Room created", { sessionId: this.sessionId });

    // Register game-specific messages
    this.registerGameMessages();

    // Register built-in messages
    this.registerBuiltinMessages();

    // Start periodic state broadcast.
    // Physics games can set stateBroadcastHz for higher-frequency updates.
    // Default is 1 Hz for event-driven games (Sketch Party etc.).
    const broadcastHz = def.stateBroadcastHz ?? 1;
    const broadcastIntervalMs = Math.max(50, Math.floor(1000 / broadcastHz));
    this.clock.setInterval(
      () => this.broadcastGameState(),
      broadcastIntervalMs,
    );

    // Start runtime mirror
    this.runtimeMirror = new RuntimeMirror(this.sessionId);
    this.runtimeMirror.start(() => this.buildRuntimeSummary(), 15_000);

    // Start join grace timer for full_roster policy
    if (def.matchStartPolicy === "full_roster" && def.joinGraceMs > 0) {
      this.joinGraceTimer = setTimeout(() => {
        this.joinGraceTimer = null;
        if (this.phase !== "waiting_for_players") return; // already started
        const connected = this.getConnectedParticipantCount();
        if (connected < def.minPlayers) {
          this.log(
            `Join grace expired with ${connected}/${def.minPlayers} min players — cancelling`,
          );
          this.endMatch("cancelled", { partialRoster: true });
        } else {
          this.log(
            `Join grace expired with ${connected} players — starting with partial roster`,
          );
          if (def.countdownSec > 0) {
            this.startCountdown(def.countdownSec);
          } else {
            this.beginMatch();
          }
        }
      }, def.joinGraceMs);
    }

    // Start simulation tick if applicable
    if (
      def.simulationProfile === "fixed_tick" ||
      def.simulationProfile === "hybrid_round_tick"
    ) {
      const tickRate = def.tickRate ?? 20;
      const tickIntervalMs = Math.floor(1000 / tickRate);
      let lastTick = Date.now();

      this.tickInterval = setInterval(() => {
        if (this.phase !== "in_progress") return;
        const now = Date.now();
        const deltaMs = now - lastTick;
        lastTick = now;
        this.onTick(deltaMs);
        this.roomVersion++;
      }, tickIntervalMs);
    }
  }

  async onAuth(
    _client: Client,
    options: Record<string, unknown>,
  ): Promise<BaseAuthData> {
    const def = this.getGameDefinition();

    const result: SessionGuardResult = await verifyJoin(
      this.sessionId,
      def.gameId,
      {
        uid: options.uid as string,
        token: options.token as string,
        sessionId: (options.sessionId as string) ?? this.sessionId,
        displayName: options.displayName as string | undefined,
        allowSpectators: def.supportsSpectate,
      },
    );

    // Determine if this is a spectator join
    const isSpectator =
      !result.participantUids.includes(result.uid) &&
      result.spectatorUids.includes(result.uid);

    return {
      uid: result.uid,
      displayName: result.displayName,
      participantUids: result.participantUids,
      spectatorUids: result.spectatorUids,
      players: result.players,
      settings: result.settings,
      isSpectator,
      spectatorsAllowed: result.spectatorsAllowed,
    };
  }

  onJoin(
    client: Client,
    _options: Record<string, unknown>,
    auth?: BaseAuthData,
  ): void {
    if (!auth) return;
    const def = this.getGameDefinition();

    // Hydrate session config from the first authenticated join
    this.hydrateFromAuth(auth);

    if (auth.isSpectator) {
      this.handleSpectatorJoin(client, auth);
      return;
    }

    // Check for reconnect
    const existing = this.players.get(auth.uid);
    if (existing) {
      this.handlePlayerReconnect(client, auth, existing);
      return;
    }

    // New player join
    const info: RealtimePlayerInfo = {
      uid: auth.uid,
      displayName: auth.displayName,
      colyseusSessionId: client.sessionId,
      connected: true,
      connectedAt: Date.now(),
      disconnectedAt: null,
      isSpectator: false,
      reconnectDeadline: null,
    };
    this.players.set(auth.uid, info);

    this.log(`Player joined: ${auth.displayName} (${auth.uid})`, {
      playerCount: this.players.size,
    });

    // Send current state to the joining client
    this.sendStateToClient(client, auth.uid, false);

    // Send effective settings
    client.send("settings_applied", { ...this.settings });

    // Broadcast join event
    this.broadcastSystemMessage(`${auth.displayName} joined the game`);
    this.broadcastGameState();

    // Check if match can start
    this.evaluateMatchStart();
  }

  onLeave(client: Client, consented: boolean): void {
    // Check players first
    for (const [uid, info] of this.players) {
      if (info.colyseusSessionId === client.sessionId) {
        this.handlePlayerLeave(uid, info, consented);
        return;
      }
    }

    // Check spectators
    for (const [uid, info] of this.spectators) {
      if (info.colyseusSessionId === client.sessionId) {
        this.spectators.delete(uid);
        this.log(`Spectator left: ${info.displayName}`);
        return;
      }
    }
  }

  onDispose(): void {
    this.clearAllTimers();

    if (this.runtimeMirror) {
      this.runtimeMirror.writeFinal(this.buildRuntimeSummary());
    }

    this.messageRegistry.clearAllRateLimits();
    this.log("Room disposed");
  }

  // ═══════════════════════════════════════════════════════════════════
  // Player Management
  // ═══════════════════════════════════════════════════════════════════

  private handlePlayerReconnect(
    client: Client,
    auth: BaseAuthData,
    existing: RealtimePlayerInfo,
  ): void {
    existing.colyseusSessionId = client.sessionId;
    existing.connected = true;
    existing.connectedAt = Date.now();
    existing.disconnectedAt = null;
    existing.displayName = auth.displayName;

    // Clear reconnect deadline
    if (existing.reconnectDeadline) {
      existing.reconnectDeadline = null;
    }
    const timer = this.reconnectTimers.get(auth.uid);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(auth.uid);
    }

    // Clear abandonment timer if any player reconnects
    this.clearAbandonmentTimer();

    // Unpause if we were paused due to disconnection
    if (this.phase === "paused" && this.shouldUnpause()) {
      this.setPhase("in_progress");
    }

    this.log(`Player reconnected: ${auth.displayName} (${auth.uid})`);

    // Send current state
    this.sendStateToClient(client, auth.uid, false);
    client.send("settings_applied", { ...this.settings });

    // Let subclass send additional catch-up state
    this.onPlayerReconnect(client, auth.uid);

    this.broadcastSystemMessage(`${auth.displayName} reconnected`);
    this.broadcastGameState();
  }

  private handleSpectatorJoin(client: Client, auth: BaseAuthData): void {
    const def = this.getGameDefinition();
    if (!def.supportsSpectate) {
      client.send("error", { message: "Spectating not supported." });
      client.leave();
      return;
    }

    const info: RealtimePlayerInfo = {
      uid: auth.uid,
      displayName: auth.displayName,
      colyseusSessionId: client.sessionId,
      connected: true,
      connectedAt: Date.now(),
      disconnectedAt: null,
      isSpectator: true,
      reconnectDeadline: null,
    };
    this.spectators.set(auth.uid, info);

    this.log(`Spectator joined: ${auth.displayName}`);

    // Send current state (spectator view)
    this.sendStateToClient(client, auth.uid, true);
    client.send("settings_applied", { ...this.settings });

    this.onSpectatorJoin(client, auth.uid);
  }

  private handlePlayerLeave(
    uid: string,
    info: RealtimePlayerInfo,
    _consented: boolean,
  ): void {
    const def = this.getGameDefinition();
    info.connected = false;
    info.disconnectedAt = Date.now();

    this.log(`Player disconnected: ${info.displayName} (${uid})`);
    this.broadcastSystemMessage(`${info.displayName} disconnected`);

    // Notify subclass
    this.onPlayerDisconnect(uid);

    // Apply disconnect policy based on game phase
    if (
      this.phase === "in_progress" ||
      this.phase === "countdown" ||
      this.phase === "ready_check"
    ) {
      this.applyDisconnectPolicy(uid, def.disconnectPolicy);
    }

    // Check if all players are disconnected
    const connectedCount = this.getConnectedPlayerCount();
    if (
      connectedCount === 0 &&
      this.phase !== "finished" &&
      this.phase !== "resolving"
    ) {
      this.startAbandonmentTimer();
    }

    this.broadcastGameState();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Disconnect / Reconnect Policy Engine
  // ═══════════════════════════════════════════════════════════════════

  private applyDisconnectPolicy(uid: string, policy: DisconnectPolicy): void {
    const def = this.getGameDefinition();

    switch (policy) {
      case "no_reconnect":
      case "immediate_elimination":
        // Player is forfeit/eliminated immediately
        this.players.delete(uid);
        this.checkMatchViability();
        break;

      case "grace_reconnect":
      case "grace_then_forfeit":
      case "grace_then_no_contest": {
        // Start grace timer
        const graceMs = def.reconnectGraceMs;
        if (graceMs <= 0) {
          // No grace — treat as immediate
          this.players.delete(uid);
          this.checkMatchViability();
          return;
        }

        const player = this.players.get(uid);
        if (player) {
          player.reconnectDeadline = Date.now() + graceMs;
        }

        const timer = setTimeout(() => {
          this.reconnectTimers.delete(uid);
          const p = this.players.get(uid);
          if (p && !p.connected) {
            this.onReconnectGraceExpired(uid, policy);
          }
        }, graceMs);

        this.reconnectTimers.set(uid, timer);
        break;
      }

      case "pause_until_return":
        if (this.phase === "in_progress") {
          this.setPhase("paused");
        }
        break;

      case "continue_without_player":
        // Game continues, player misses turns/input
        this.checkMatchViability();
        break;
    }
  }

  private onReconnectGraceExpired(uid: string, policy: DisconnectPolicy): void {
    const player = this.players.get(uid);
    if (!player) return;

    this.log(
      `Reconnect grace expired for ${player.displayName} (${uid}), policy: ${policy}`,
    );

    switch (policy) {
      case "grace_then_forfeit":
        this.players.delete(uid);
        this.broadcastSystemMessage(
          `${player.displayName} forfeited (disconnected too long)`,
        );
        this.checkMatchViability();
        break;

      case "grace_then_no_contest":
        this.endMatch("disconnect", {
          noContest: true,
          disconnectAbandonment: true,
        });
        break;

      case "grace_reconnect":
        // Just keep waiting — game might handle this per-situation
        break;
    }
  }

  private checkMatchViability(): void {
    const def = this.getGameDefinition();
    const connectedCount = this.getConnectedPlayerCount();
    const totalPlayers = this.players.size;

    if (totalPlayers < def.minPlayers && this.phase === "in_progress") {
      this.endMatch("disconnect", { disconnectAbandonment: true });
    } else if (connectedCount === 0 && this.phase === "in_progress") {
      this.startAbandonmentTimer();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Match Start Logic
  // ═══════════════════════════════════════════════════════════════════

  protected evaluateMatchStart(): void {
    if (this.phase !== "waiting_for_players" && this.phase !== "ready_check") {
      return;
    }

    const def = this.getGameDefinition();

    if (this.canStartMatch(def.matchStartPolicy)) {
      if (def.countdownSec > 0) {
        this.startCountdown(def.countdownSec);
      } else {
        this.beginMatch();
      }
    }
  }

  private canStartMatch(policy: MatchStartPolicy): boolean {
    const def = this.getGameDefinition();
    const connectedCount = this.getConnectedParticipantCount();

    switch (policy) {
      case "full_roster": {
        const expectedCount = this.expectedParticipantUids.size;
        return (
          expectedCount >= def.minPlayers && connectedCount >= expectedCount
        );
      }
      case "min_roster":
        return connectedCount >= def.minPlayers;
      case "host_ready":
        return false; // Must be triggered by host message
      case "auto_start_on_ready":
        return connectedCount >= def.minPlayers; // Simplified
      case "countdown_start":
        return connectedCount >= def.minPlayers;
      default:
        return connectedCount >= def.minPlayers;
    }
  }

  private startCountdown(seconds: number): void {
    this.setPhase("countdown");
    this.broadcast("countdown", { seconds });

    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      if (this.phase === "countdown") {
        this.beginMatch();
      }
    }, seconds * 1000);
  }

  private beginMatch(): void {
    const def = this.getGameDefinition();

    // Cancel join grace timer since match is starting
    if (this.joinGraceTimer) {
      clearTimeout(this.joinGraceTimer);
      this.joinGraceTimer = null;
    }

    this.setPhase("in_progress");
    this.matchStartedAt = Date.now();
    this.roomVersion++;

    this.log("Match started", {
      playerCount: this.players.size,
      spectatorCount: this.spectators.size,
    });

    // Notify subclass to initialize game state
    this.onMatchStart();

    // Start match duration timer if configured
    if (def.maxMatchDurationMs && def.maxMatchDurationMs > 0) {
      this.matchDurationTimer = setTimeout(() => {
        if (this.phase === "in_progress") {
          this.endMatch("timeout", { timedOut: true });
        }
      }, def.maxMatchDurationMs);
    }

    this.broadcastGameState();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Match End Logic
  // ═══════════════════════════════════════════════════════════════════

  /**
   * End the match and write the resolution bridge.
   * Call this from the subclass when the game naturally ends,
   * or it's called automatically by the framework for timeouts/abandonment.
   *
   * @param reason - Why the match ended
   * @param flags - Optional flags for special conditions
   */
  protected async endMatch(
    reason: RealtimeResolutionPayload["reason"],
    flags: RealtimeResolutionPayload["flags"] = {},
  ): Promise<void> {
    if (this.isResolved) return; // Idempotent
    this.isResolved = true;

    this.setPhase("resolving");
    this.clearAllTimers();

    // Get game-specific results from subclass
    const results = this.onMatchEnd(reason);
    const def = this.getGameDefinition();

    // Compute duration
    const durationMs = this.matchStartedAt
      ? Date.now() - this.matchStartedAt
      : 0;

    // Determine resolution type for the V4 pipeline
    let resolutionType: RealtimeResolutionPayload["resolutionType"];
    switch (reason) {
      case "complete":
        resolutionType = results.winnerIds.length > 0 ? "win" : "draw";
        break;
      case "disconnect":
        resolutionType = "disconnect";
        break;
      case "timeout":
        resolutionType = "timeout";
        break;
      case "error":
      case "cancelled":
        resolutionType = "error";
        break;
      case "abandoned":
        resolutionType = "disconnect";
        break;
      default:
        resolutionType = "error";
    }

    // Build and write resolution payload
    const payload = buildResolutionPayload({
      sessionId: this.sessionId,
      gameId: def.gameId,
      roomVersion: this.roomVersion,
      reason,
      resolutionType,
      winnerIds: results.winnerIds,
      scoreboard: results.scoreboard,
      durationMs,
      playerMetrics: results.playerMetrics,
      flags,
    });

    try {
      const result = await writeResolutionRequest(payload);
      if (result.written) {
        this.log("Resolution written successfully", {
          reason,
          resolutionType,
          winnerCount: results.winnerIds.length,
        });
      } else if (result.bypassed) {
        this.log(
          "⚠️  Resolution write SKIPPED (DEV BYPASS) — session will NOT resolve via Firebase. " +
            "Set COLYSEUS_DEV_BYPASS=0 with valid credentials for full endgame flow.",
          { reason, resolutionType },
        );
      } else {
        this.log("Resolution write skipped (duplicate or no-op)", {
          reason,
          resolutionType,
        });
      }
    } catch (err) {
      console.error(
        `[${def.gameId}] Failed to write resolution for session ${this.sessionId}:`,
        err,
      );
    }

    this.setPhase("finished");

    // Broadcast match end to all clients
    this.broadcast("match_end", {
      reason,
      resolutionType,
      winnerIds: results.winnerIds,
      scoreboard: results.scoreboard,
    });

    // Dispose room after delay
    this.disposalTimer = setTimeout(() => {
      this.disposalTimer = null;
      this.disconnect();
    }, def.postMatchDisposalDelayMs);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Abandonment
  // ═══════════════════════════════════════════════════════════════════

  private startAbandonmentTimer(): void {
    const def = this.getGameDefinition();
    if (this.abandonmentTimer) return;

    const graceMs = def.abandonmentGraceMs;

    if (graceMs <= 0) {
      this.endMatch("abandoned", { disconnectAbandonment: true });
      return;
    }

    this.log(`All players disconnected. Abandonment grace: ${graceMs}ms`);

    this.abandonmentTimer = setTimeout(() => {
      this.abandonmentTimer = null;
      const connectedCount = this.getConnectedPlayerCount();
      if (connectedCount === 0) {
        this.endMatch("abandoned", { disconnectAbandonment: true });
      }
    }, graceMs);
  }

  private clearAbandonmentTimer(): void {
    if (this.abandonmentTimer) {
      clearTimeout(this.abandonmentTimer);
      this.abandonmentTimer = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // State Broadcasting
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Broadcast game state to all connected clients.
   * Respects visibility rules per viewer.
   */
  protected broadcastGameState(): void {
    for (const client of this.clients) {
      const uid = this.getUidByClient(client);
      const isSpectator = uid ? this.spectators.has(uid) : false;
      const state = this.getGameState(uid ?? undefined, isSpectator);

      client.send("state_sync", {
        phase: this.phase,
        roomVersion: this.roomVersion,
        ...state,
        players: this.getPlayersSnapshot(),
      });
    }
  }

  /**
   * Send state to a specific client.
   */
  protected sendStateToClient(
    client: Client,
    uid: string,
    isSpectator: boolean,
  ): void {
    const state = this.getGameState(uid, isSpectator);
    client.send("state_sync", {
      phase: this.phase,
      roomVersion: this.roomVersion,
      ...state,
      players: this.getPlayersSnapshot(),
    });
  }

  /**
   * Broadcast a system message to all clients.
   */
  protected broadcastSystemMessage(text: string): void {
    this.broadcast("system_message", {
      text,
      timestamp: Date.now(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Built-in Messages
  // ═══════════════════════════════════════════════════════════════════

  private registerBuiltinMessages(): void {
    const def = this.getGameDefinition();

    // Host start command (for host_ready policy)
    if (def.matchStartPolicy === "host_ready") {
      this.onMessage("host_start", (client) => {
        const uid = this.getUidByClient(client);
        if (!uid) return;

        // Verify caller is the host (first in participant list)
        const participants = Array.from(this.expectedParticipantUids);
        if (participants[0] !== uid) {
          client.send("error", {
            message: "Only the host can start the match.",
          });
          return;
        }

        if (this.phase === "waiting_for_players") {
          this.evaluateMatchStart();
        }
      });
    }

    // Resign/forfeit
    if (def.allowResign) {
      this.onMessage("resign", (client) => {
        const uid = this.getUidByClient(client);
        if (!uid) return;
        if (this.phase !== "in_progress") return;

        this.log(`Player resigned: ${uid}`);
        this.players.delete(uid);
        this.broadcastSystemMessage(
          `${this.rosterDisplayNames.get(uid) ?? uid} resigned`,
        );
        this.checkMatchViability();
      });
    }

    // Ping/pong heartbeat
    this.onMessage("ping", (client) => {
      client.send("pong", { serverTime: Date.now() });
    });
  }

  /**
   * Register a game-specific message handler with validation.
   * Use this in registerGameMessages().
   */
  protected registerGameMessage<T>(
    messageType: string,
    handler: (client: Client, uid: string, payload: T) => void,
  ): void {
    const validatedHandler = createValidatedHandler<T>(
      this.messageRegistry,
      messageType,
      (client) => this.getUidByClient(client),
      (uid) => this.spectators.has(uid),
      () => this.phase,
      handler,
    );

    this.onMessage(messageType, validatedHandler);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════

  protected setPhase(phase: RoomPhase): void {
    const prev = this.phase;
    this.phase = phase;
    this.roomVersion++;
    this.log(`Phase transition: ${prev} → ${phase}`);
  }

  protected getUidByClient(client: Client): string | null {
    for (const [uid, info] of this.players) {
      if (info.colyseusSessionId === client.sessionId) return uid;
    }
    for (const [uid, info] of this.spectators) {
      if (info.colyseusSessionId === client.sessionId) return uid;
    }
    return null;
  }

  protected getClientByUid(uid: string): Client | undefined {
    const info = this.players.get(uid) ?? this.spectators.get(uid);
    if (!info) return undefined;
    return this.clients.find((c) => c.sessionId === info.colyseusSessionId);
  }

  protected getConnectedPlayerCount(): number {
    let count = 0;
    for (const info of this.players.values()) {
      if (info.connected) count++;
    }
    return count;
  }

  private getConnectedParticipantCount(): number {
    let count = 0;
    for (const uid of this.expectedParticipantUids) {
      const info = this.players.get(uid);
      if (info?.connected) count++;
    }
    return count;
  }

  protected getPlayersSnapshot(): Array<{
    uid: string;
    displayName: string;
    connected: boolean;
    isSpectator: boolean;
  }> {
    const result: Array<{
      uid: string;
      displayName: string;
      connected: boolean;
      isSpectator: boolean;
    }> = [];

    for (const info of this.players.values()) {
      result.push({
        uid: info.uid,
        displayName: this.rosterDisplayNames.get(info.uid) ?? info.displayName,
        connected: info.connected,
        isSpectator: false,
      });
    }

    for (const info of this.spectators.values()) {
      result.push({
        uid: info.uid,
        displayName: info.displayName,
        connected: info.connected,
        isSpectator: true,
      });
    }

    return result;
  }

  private shouldUnpause(): boolean {
    const def = this.getGameDefinition();
    if (def.disconnectPolicy !== "pause_until_return") return false;
    // Unpause when at least minPlayers are connected
    return this.getConnectedPlayerCount() >= def.minPlayers;
  }

  private hydrateFromAuth(auth: BaseAuthData): void {
    if (this.expectedParticipantUids.size === 0) {
      // First authenticated join — hydrate roster and settings
      this.expectedParticipantUids = new Set(auth.participantUids);
      for (const p of auth.players) {
        this.rosterDisplayNames.set(p.uid, p.displayName ?? p.uid);
      }
      // Apply authoritative settings from Firebase session
      const def = this.getGameDefinition();
      this.settings = def.validateSettings(auth.settings);
    } else if (isDevBypass()) {
      // Dev bypass: Firebase guard returns only the joining player's UID per call.
      // Accumulate participants and display names as they arrive.
      for (const uid of auth.participantUids) {
        this.expectedParticipantUids.add(uid);
      }
      for (const p of auth.players) {
        if (!this.rosterDisplayNames.has(p.uid)) {
          this.rosterDisplayNames.set(p.uid, p.displayName ?? p.uid);
        }
      }
    }
  }

  private buildRuntimeSummary(): RuntimeSummary {
    const def = this.getGameDefinition();
    const connectedUids: string[] = [];
    for (const [uid, info] of this.players) {
      if (info.connected) connectedUids.push(uid);
    }

    return {
      roomId: this.roomId,
      sessionId: this.sessionId,
      gameId: def.gameId,
      phase: this.phase,
      connectedPlayerCount: connectedUids.length,
      connectedPlayerUids: connectedUids,
      spectatorCount: this.spectators.size,
      startedAt: this.matchStartedAt,
      lastHeartbeatAt: Date.now(),
      roomVersion: this.roomVersion,
      abandonmentFlag: this.abandonmentTimer !== null,
      pauseFlag: this.phase === "paused",
    };
  }

  private clearAllTimers(): void {
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    this.clearAbandonmentTimer();

    if (this.joinGraceTimer) {
      clearTimeout(this.joinGraceTimer);
      this.joinGraceTimer = null;
    }

    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }

    if (this.matchDurationTimer) {
      clearTimeout(this.matchDurationTimer);
      this.matchDurationTimer = null;
    }

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    if (this.disposalTimer) {
      clearTimeout(this.disposalTimer);
      this.disposalTimer = null;
    }

    if (this.runtimeMirror) {
      this.runtimeMirror.stop();
    }
  }

  protected log(message: string, data?: Record<string, unknown>): void {
    const def = this.getGameDefinition();
    const prefix = `[${def.gameId}][${this.sessionId?.slice(0, 8)}]`;
    if (data) {
      console.log(`${prefix} ${message}`, JSON.stringify(data));
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}
