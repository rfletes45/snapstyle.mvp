import type { ServerLogger } from "../../utils/logger";
import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("PhysicsRoom");

/**
 * PhysicsRoom — Abstract base for all Tier 1 real-time physics games
 *
 * Pattern: Server-authoritative physics simulation at 60fps, state sync at
 * ~30fps (patchRate 33ms). Both players send input messages; the server
 * applies them, runs physics, and broadcasts delta-compressed state patches.
 *
 * Lifecycle:
 * 1. Both players join → "waiting"
 * 2. Both send "ready" → "countdown" (3 seconds)
 * 3. Countdown expires → "playing" (simulation starts)
 * 4. Win condition reached → "finished"
 * 5. On dispose → persistGameResult() if game completed
 *
 * Subclasses must implement:
 *   - gameTypeKey          (string identifying the game)
 *   - scoreToWin           (points needed to win, 0 = time-based)
 *   - gameDuration         (seconds, 0 = unlimited / score-only)
 *   - initializeGame()     (set up initial positions, ball, etc.)
 *   - updatePhysics(dt)    (per-tick physics — collision, movement)
 *   - handleInput(client, input) (process player input)
 *   - resetAfterScore()    (reset ball/positions after a point)
 *
 * Used by: PongRoom (Phase 4)
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §7.1
 */

import { Client, Room } from "colyseus";
import { BaseGameState } from "../../schemas/common";
import { Paddle, PhysicsPlayer, PhysicsState } from "../../schemas/physics";
import { SpectatorEntry } from "../../schemas/spectator";
import { verifyFirebaseToken } from "../../services/firebase";
import {
  deleteGameAndInvite,
  extractInviteIdFromExtGameId,
  markGameVacant,
  persistGameResult,
} from "../../services/persistence";
import { checkProtocolVersion } from "../../utils/protocol";
import {
  MessageRateLimiter,
  PHYSICS_RATE_LIMITS,
} from "../../utils/rateLimiter";
import {
  createStuckRoomWatchdog,
  type StuckRoomWatchdog,
} from "../../utils/stuckRoomWatchdog";

// =============================================================================
// Input Payload
// =============================================================================

export interface InputPayload {
  /** Paddle X position (normalised 0-1 of field width) */
  x?: number;
  /** Paddle Y position (normalised 0-1 of field height, Air Hockey) */
  y?: number;
  /** Arbitrary action (e.g., "launch") */
  action?: string;
}

// =============================================================================
// Abstract Base
// =============================================================================

export abstract class PhysicsRoom extends Room<{ state: PhysicsState }> {
  maxClients = 12;
  patchRate = 33; // ~30fps state sync
  autoDispose = true;

  /** Game type key — must match client-side GAME_REGISTRY */
  protected abstract readonly gameTypeKey: string;

  /** Points needed to win (0 = time-based) */
  protected abstract readonly scoreToWin: number;

  /** Game duration in seconds (0 = unlimited, score-only) */
  protected abstract readonly gameDuration: number;

  /** Game start timestamp */
  private gameStartTime = 0;

  /** Track spectator session IDs for fast lookup */
  private spectatorSessionIds = new Set<string>();

  /** Scoped logger with room-level context */
  protected roomLog: ServerLogger = log;

  /** Message rate limiter to prevent input spam */
  private rateLimiter = new MessageRateLimiter(PHYSICS_RATE_LIMITS);

  /** Stuck-room watchdog — logs if room never reaches playing */
  private stuckWatchdog: StuckRoomWatchdog | null = null;

  /** Invite ID for finalization fallback (defense-in-depth). */
  private inviteId: string | undefined;

  /** Check if a session is a spectator */
  protected isSpectator(sessionId: string): boolean {
    return this.spectatorSessionIds.has(sessionId);
  }

  // ===========================================================================
  // Abstract Methods — Subclasses MUST implement
  // ===========================================================================

  /** Set up initial game objects (ball, paddles, field) */
  protected abstract initializeGame(): void;

  /** Run one physics tick. deltaTime is in milliseconds. */
  protected abstract updatePhysics(deltaTime: number): void;

  /** Process a player input message */
  protected abstract handleInput(client: Client, input: InputPayload): void;

  /** Reset positions after a point is scored */
  protected abstract resetAfterScore(): void;

  // ===========================================================================
  // Lifecycle — onAuth
  // ===========================================================================

  async onAuth(
    client: Client,
    options: Record<string, any>,
    context: any,
  ): Promise<any> {
    // -- Protocol version gate ---------------------------------------------
    const proto = checkProtocolVersion(options);
    if (!proto.ok) {
      log.warn(`Protocol rejected: ${proto.reason}`, {
        sessionId: client.sessionId,
        gameType: this.gameTypeKey,
        traceId: options?.traceId,
      });
      throw new Error(proto.reason);
    }

    const decoded = await verifyFirebaseToken(
      context?.token || options?.token || "",
    );

    log.info("Auth success", {
      uid: decoded.uid,
      sessionId: client.sessionId,
      gameType: this.gameTypeKey,
      firestoreGameId: options?.firestoreGameId,
      traceId: options?.traceId,
      protocolVersion: proto.clientVersion,
      platform: options?.buildInfo?.platform,
    });

    return {
      uid: decoded.uid,
      displayName:
        (decoded as { name?: string; email?: string; picture?: string }).name ||
        (decoded as { name?: string; email?: string; picture?: string })
          .email ||
        "Player",
      avatarUrl:
        (decoded as { name?: string; email?: string; picture?: string })
          .picture || "",
      traceId: options?.traceId,
    };
  }

  // ===========================================================================
  // Lifecycle — onCreate
  // ===========================================================================

  onCreate(options: Record<string, any>): void {
    this.setState(new PhysicsState());
    this.state.gameType = this.gameTypeKey;
    this.state.gameId = this.roomId;
    this.state.traceId = options.traceId || "";
    this.state.maxPlayers = this.maxClients;
    this.state.scoreToWin = this.scoreToWin;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.state.phase = "waiting";

    if (options.firestoreGameId) {
      (this.state as any).firestoreGameId = options.firestoreGameId;
    }

    // Capture inviteId for finalization fallback
    if (options.inviteId) {
      this.inviteId = options.inviteId;
    }

    // Build scoped logger with room-level correlation context
    this.roomLog = log.child({
      roomId: this.roomId,
      gameType: this.gameTypeKey,
      firestoreGameId: options.firestoreGameId || undefined,
      traceId: options.traceId || undefined,
    });

    this.initializeGame();

    // Start stuck-room watchdog (logs if room never reaches playing)
    this.stuckWatchdog = createStuckRoomWatchdog(this as any, this.roomLog);

    this.roomLog.info(`Room created`);
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    ready: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.roomLog.info(`Player ready: ${player.displayName}`);
        this.checkAllReady();
      }
    },

    input: (client: Client, payload: InputPayload) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "playing") return;
      if (this.rateLimiter.isRateLimited(client.sessionId, "input")) return;
      this.handleInput(client, payload);
    },

    rematch: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "finished") return;
      this.broadcast("rematch_request", {
        fromSessionId: client.sessionId,
        fromName:
          this.state.players.get(client.sessionId)?.displayName || "Player",
      });
    },

    rematch_accept: (_client: Client) => {
      if (this.isSpectator(_client.sessionId)) return;
      if (this.state.phase !== "finished") return;
      this.resetForRematch();
    },

    app_state: (client: Client, payload: { state: string }) => {
      this.roomLog.info(`App state: ${client.sessionId} → ${payload.state}`);
    },
  };

  // ===========================================================================
  // Player Lifecycle
  // ===========================================================================

  onJoin(client: Client, _options: Record<string, any>, auth: any): void {
    // ─── Spectator join ─────────────────────────────────────────────────
    if (_options.spectator === true) {
      const spectator = new SpectatorEntry();
      spectator.uid = auth.uid;
      spectator.sessionId = client.sessionId;
      spectator.displayName = auth.displayName || "Spectator";
      spectator.avatarUrl = auth.avatarUrl || "";
      spectator.joinedAt = Date.now();
      this.state.spectators.set(client.sessionId, spectator);
      this.state.spectatorCount++;
      this.spectatorSessionIds.add(client.sessionId);
      this.roomLog.info(
        `Spectator joined: ${auth.displayName} (${this.state.spectatorCount} watching)`,
      );
      return;
    }

    // ─── Reject player joins when room is full ──────────────────────────
    // Don't use this.lock() — that blocks spectators too. Instead, gate at
    // the application level so spectators can still join after 2 players.
    if (this.state.players.size >= 2) {
      this.roomLog.warn(
        `Rejected player join — room full: ${auth.displayName} (${client.sessionId})`,
      );
      client.error(4000, "Room is full — game already has 2 players");
      client.leave(4000); // 4000 = room full
      return;
    }

    const player = new PhysicsPlayer();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.playerIndex = this.state.players.size;
    player.connected = true;
    this.state.players.set(client.sessionId, player);

    // Create paddle
    const paddle = new Paddle();
    paddle.ownerId = client.sessionId;
    paddle.x = this.state.fieldWidth / 2 - paddle.width / 2;
    paddle.y =
      player.playerIndex === 0
        ? this.state.fieldHeight - paddle.height - 10
        : 10;
    this.state.paddles.set(client.sessionId, paddle);

    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: player.playerIndex,
      seed: this.state.seed,
      fieldWidth: this.state.fieldWidth,
      fieldHeight: this.state.fieldHeight,
    });

    this.roomLog.info(
      `Player joined: ${auth.displayName} (${client.sessionId}) [${this.state.players.size}/${this.maxClients}]`,
    );
  }

  async onDrop(client: Client, _code: number): Promise<void> {
    if (this.spectatorSessionIds.has(client.sessionId)) return;
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    this.broadcast(
      "opponent_reconnecting",
      { sessionId: client.sessionId },
      { except: client },
    );
    // Shorter reconnection window for physics
    const timeout = parseInt(
      process.env.RECONNECTION_TIMEOUT_PHYSICS || "15",
      10,
    );
    try {
      await this.allowReconnection(client, timeout);
      // Reconnected successfully — onReconnect handles state update
    } catch {
      // Reconnection timed out — Colyseus will call onLeave
      this.roomLog.info(`Reconnection timed out: ${client.sessionId}`);
    }
  }

  onReconnect(client: Client): void {
    if (this.spectatorSessionIds.has(client.sessionId)) return;
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
    this.broadcast(
      "opponent_reconnected",
      { sessionId: client.sessionId },
      { except: client },
    );
    this.roomLog.info(`Player reconnected: ${client.sessionId}`);
  }

  onLeave(client: Client, code: number): void {
    // ─── Spectator leave ────────────────────────────────────────────────
    if (this.spectatorSessionIds.has(client.sessionId)) {
      this.state.spectators.delete(client.sessionId);
      this.state.spectatorCount = Math.max(0, this.state.spectatorCount - 1);
      this.spectatorSessionIds.delete(client.sessionId);
      this.roomLog.info(
        `Spectator left (${this.state.spectatorCount} watching)`,
      );
      return;
    }

    if (
      this.state.phase === "playing" &&
      this.state.players.has(client.sessionId)
    ) {
      // Award win to remaining player — only if they’re still connected
      const remaining = this.getOpponent(client.sessionId);
      if (remaining && remaining.connected) {
        this.endGame(remaining.uid, "opponent_left");
      } else if (remaining) {
        // Both disconnected — end without a winner
        this.endGame("", "mutual_disconnect");
      }
    }
    this.state.players.delete(client.sessionId);
    this.state.paddles.delete(client.sessionId);
    this.roomLog.info(`Player left: ${client.sessionId} (code: ${code})`);
  }

  /**
   * Override in subclasses to attach game-specific stats (e.g. shutouts)
   * that the achievement evaluator can read via `gameSpecific` fields.
   * Keys are player UIDs → stat map.
   */
  protected getPerPlayerStats():
    | Record<string, Record<string, number>>
    | undefined {
    return undefined;
  }

  async onDispose(): Promise<void> {
    this.rateLimiter.dispose();
    this.stuckWatchdog?.dispose();
    const firestoreGameId =
      (this.state as any).firestoreGameId || this.state.gameId || this.roomId;
    const inviteId =
      extractInviteIdFromExtGameId(firestoreGameId) ??
      this.inviteId ??
      undefined;

    if (this.state.phase === "finished" && this.state.winnerId) {
      // Game resolved — persist results, then delete game + invite
      await persistGameResult(
        this.state as unknown as BaseGameState,
        this.state.elapsed,
        this.getPerPlayerStats(),
        { inviteId, firestoreGameId },
      );
      await deleteGameAndInvite(firestoreGameId, inviteId);
      this.roomLog.info(
        `Game completed, persisted, and cleaned up: ${this.roomId}`,
      );
    } else if (this.state.phase === "playing") {
      // Ongoing non-turn-based game — mark as vacant for 10-minute cleanup
      await markGameVacant(firestoreGameId, this.gameTypeKey, false);
      this.roomLog.info(
        `Ongoing game marked vacant (10-min TTL): ${this.roomId}`,
      );
    } else if (
      this.state.phase === "waiting" ||
      this.state.phase === "countdown"
    ) {
      // PRE-START ABANDONMENT: delete immediately
      await deleteGameAndInvite(firestoreGameId, inviteId);
      this.roomLog.info(
        `Pre-start abandonment � deleted game + invite: ${this.roomId}`,
      );
    } else {
      this.roomLog.info(`Room disposed: ${this.roomId}`);
    }
  }

  // ===========================================================================
  // Game Flow
  // ===========================================================================

  private checkAllReady(): void {
    if (this.state.players.size < 2) return;
    let allReady = true;
    this.state.players.forEach((player: PhysicsPlayer) => {
      if (!player.ready) allReady = false;
    });
    if (allReady) this.startCountdown();
  }

  private startCountdown(): void {
    this.state.phase = "countdown";
    this.state.countdown = 3;
    this.roomLog.info(`Countdown started`);
    const interval = this.clock.setInterval(() => {
      this.state.countdown--;
      if (this.state.countdown <= 0) {
        interval.clear();
        this.startGame();
      }
    }, 1000);
  }

  private startGame(): void {
    this.state.phase = "playing";
    this.state.timerRunning = true;
    this.gameStartTime = Date.now();
    this.stuckWatchdog?.markPlaying();

    if (this.gameDuration > 0) {
      this.state.remaining = this.gameDuration * 1000;
    }

    // Physics simulation at ~60fps
    this.setSimulationInterval((dt: number) => {
      if (this.state.phase !== "playing") return;

      this.state.elapsed += dt;

      if (this.gameDuration > 0) {
        this.state.remaining = Math.max(
          0,
          this.gameDuration * 1000 - this.state.elapsed,
        );
        if (this.state.remaining <= 0) {
          this.endGameByTimeout();
          return;
        }
      }

      this.updatePhysics(dt);
    }, 16.6); // ~60fps

    this.roomLog.info(`Game started!`);
  }

  // ===========================================================================
  // Scoring & Game End
  // ===========================================================================

  /** Called by subclasses when a player scores a point */
  protected scorePoint(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    player.score++;

    if (this.scoreToWin > 0 && player.score >= this.scoreToWin) {
      this.endGame(player.uid, "score_limit");
    } else {
      this.resetAfterScore();
    }
  }

  /** End game with a winner */
  protected endGame(winnerId: string, reason: string): void {
    if (this.state.phase === "finished") return;
    this.state.phase = "finished";
    this.state.timerRunning = false;
    this.state.winnerId = winnerId;
    this.state.winReason = reason;

    const results = Array.from(this.state.players.values()).map(
      (p: unknown) => {
        const player = p as PhysicsPlayer;
        return {
          uid: player.uid,
          displayName: player.displayName,
          score: player.score,
          playerIndex: player.playerIndex,
        };
      },
    );

    this.broadcast("game_over", {
      winnerId: this.state.winnerId,
      winReason: reason,
      results,
      gameDurationMs: this.state.elapsed,
    });

    this.roomLog.info(`Game over! Winner: ${winnerId} (${reason})`);
  }

  /** End game by timeout — highest score wins */
  private endGameByTimeout(): void {
    const players = Array.from(this.state.players.values()) as PhysicsPlayer[];
    if (players.length < 2) return;

    const sorted = [...players].sort((a, b) => b.score - a.score);
    if (sorted[0].score === sorted[1].score) {
      this.endGame("", "timeout_tie");
    } else {
      this.endGame(sorted[0].uid, "timeout");
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /** Get the opponent of a given session */
  protected getOpponent(sessionId: string): PhysicsPlayer | null {
    let opponent: PhysicsPlayer | null = null;
    this.state.players.forEach((p: PhysicsPlayer) => {
      if (p.sessionId !== sessionId) opponent = p;
    });
    return opponent;
  }

  /** Get player by session ID */
  protected getPlayer(sessionId: string): PhysicsPlayer | undefined {
    return this.state.players.get(sessionId) as PhysicsPlayer | undefined;
  }

  /** Reset for rematch */
  private resetForRematch(): void {
    this.state.players.forEach((player: PhysicsPlayer) => {
      player.score = 0;
      player.ready = false;
      player.finished = false;
      player.combo = 0;
    });
    this.state.phase = "waiting";
    this.state.winnerId = "";
    this.state.winReason = "";
    this.state.elapsed = 0;
    this.state.remaining = 0;
    this.state.timerRunning = false;
    this.state.countdown = 0;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.gameStartTime = 0;
    this.initializeGame();
    this.unlock();
    this.roomLog.info(`Room reset for rematch`);
  }
}
