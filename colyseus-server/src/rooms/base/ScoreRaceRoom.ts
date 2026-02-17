import type { ServerLogger } from "../../utils/logger";
import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("ScoreRaceRoom");

/**
 * ScoreRaceRoom — Abstract base for all Tier 4 quick-play games
 *
 * Pattern: Both players play simultaneously, competing on score.
 * The server manages the timer and syncs scores in real-time.
 * Game logic runs client-side; server validates score bounds.
 *
 * Lifecycle:
 * 1. Both players join → "waiting"
 * 2. Both send "ready" → "countdown" (3 seconds)
 * 3. Countdown expires → "playing" (game clock starts)
 * 4. Game duration expires or both finish → "finished"
 * 5. Winner determined by highest score
 *
 * Used by: DotMatch
 */

import { Client, Room } from "colyseus";
import { Player } from "../../schemas/common";
import { ScoreRacePlayer, ScoreRaceState } from "../../schemas/quickplay";
import { SpectatorEntry } from "../../schemas/spectator";
import { verifyFirebaseToken } from "../../services/firebase";
import {
  deleteGameAndInvite,
  markGameVacant,
  persistGameResult,
} from "../../services/persistence";
import { validateScoreUpdate } from "../../services/validation";
import { checkProtocolVersion } from "../../utils/protocol";
import {
  MessageRateLimiter,
  SCORE_RACE_RATE_LIMITS,
} from "../../utils/rateLimiter";
import {
  createStuckRoomWatchdog,
  type StuckRoomWatchdog,
} from "../../utils/stuckRoomWatchdog";

// =============================================================================
// Abstract Base
// =============================================================================

export abstract class ScoreRaceRoom extends Room<{ state: ScoreRaceState }> {
  maxClients = 12;
  patchRate = 100; // 10fps state sync (just scores + timer)
  autoDispose = true;

  /** Game type key — must match client-side GAME_REGISTRY */
  protected abstract readonly gameTypeKey: string;

  /** Default game duration in seconds */
  protected abstract readonly defaultDuration: number;

  /** Max lives (-1 = unlimited) */
  protected abstract readonly maxLives: number;

  /** Whether lower score is better (e.g., reaction time) */
  protected abstract readonly lowerIsBetter: boolean;

  private gameStartTime: number = 0;
  private spectatorSessionIds = new Set<string>();

  /** Scoped logger with room-level context */
  protected roomLog: ServerLogger = log;

  /** Message rate limiter to prevent score spam */
  private rateLimiter = new MessageRateLimiter(SCORE_RACE_RATE_LIMITS);

  /** Stuck-room watchdog — logs if room never reaches playing */
  private stuckWatchdog: StuckRoomWatchdog | null = null;

  protected isSpectator(sessionId: string): boolean {
    return this.spectatorSessionIds.has(sessionId);
  }

  // ===========================================================================
  // Lifecycle
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

  onCreate(options: Record<string, any>): void {
    this.setState(new ScoreRaceState());
    this.state.gameType = this.gameTypeKey;
    this.state.gameDuration = options.duration || this.defaultDuration;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.state.phase = "waiting";
    this.state.gameId = this.roomId;
    this.state.difficulty = options.difficulty || 1;

    if (options.firestoreGameId) {
      this.state.firestoreGameId = options.firestoreGameId;
    }

    // Build scoped logger with room-level correlation context
    this.roomLog = log.child({
      roomId: this.roomId,
      gameType: this.gameTypeKey,
      firestoreGameId: options.firestoreGameId || undefined,
      traceId: options.traceId || undefined,
    });

    this.roomLog.info(`Room created (duration: ${this.state.gameDuration}s)`);

    // Start stuck-room watchdog (logs if room never reaches playing)
    this.stuckWatchdog = createStuckRoomWatchdog(this as any, this.roomLog);
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    /**
     * Player signals they are ready to start.
     * When all players are ready, countdown begins.
     */
    ready: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      const player = this.state.racePlayers.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.roomLog.info(`Player ready: ${player.displayName}`);
        this.checkAllReady();
      }
    },

    /**
     * Player reports a score update during gameplay.
     * Validated against anti-cheat bounds.
     */
    score_update: (client: Client, payload: { score: number }) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "playing") return;
      if (this.rateLimiter.isRateLimited(client.sessionId, "score_update"))
        return;

      const player = this.state.racePlayers.get(client.sessionId);
      if (!player || player.finished) return;

      const elapsedMs = Date.now() - this.gameStartTime;
      if (
        validateScoreUpdate(
          this.gameTypeKey,
          payload.score,
          player.currentScore,
          elapsedMs,
        )
      ) {
        player.currentScore = payload.score;
        player.score = payload.score; // Mirror to base Player.score
      }
    },

    /**
     * Player reports a combo/streak change.
     */
    combo_update: (client: Client, payload: { combo: number }) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "playing") return;
      if (this.rateLimiter.isRateLimited(client.sessionId, "combo_update"))
        return;
      const player = this.state.racePlayers.get(client.sessionId);
      if (player && !player.finished) {
        player.combo = Math.max(0, Math.min(payload.combo, 999));
      }
    },

    /**
     * Player lost a life (for life-based games).
     */
    lose_life: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "playing") return;
      const player = this.state.racePlayers.get(client.sessionId);
      if (player && !player.finished && player.lives > 0) {
        player.lives--;
        if (player.lives <= 0) {
          player.finished = true;
          player.finishTime = Date.now() - this.gameStartTime;
          this.checkAllFinished();
        }
      }
    },

    /**
     * Player explicitly signals they've finished (died, ran out of time, etc.).
     */
    finished: (client: Client, payload: { finalScore: number }) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "playing") return;
      const player = this.state.racePlayers.get(client.sessionId);
      if (player && !player.finished) {
        const elapsedMs = Date.now() - this.gameStartTime;
        if (
          validateScoreUpdate(
            this.gameTypeKey,
            payload.finalScore,
            player.currentScore,
            elapsedMs,
          )
        ) {
          player.currentScore = payload.finalScore;
          player.score = payload.finalScore;
        }
        player.finished = true;
        player.finishTime = elapsedMs;
        this.checkAllFinished();
      }
    },

    /**
     * Rematch request from a player.
     */
    rematch: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "finished") return;
      // Broadcast to other players
      this.broadcast("rematch_request", {
        fromSessionId: client.sessionId,
        fromName:
          this.state.racePlayers.get(client.sessionId)?.displayName || "Player",
      });
    },

    /**
     * Rematch accepted — reset the room.
     */
    rematch_accept: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "finished") return;
      this.resetForRematch();
    },

    /**
     * App state change (background/foreground).
     */
    app_state: (client: Client, payload: { state: string }) => {
      this.roomLog.info(
        `Player app state: ${client.sessionId} → ${payload.state}`,
      );
    },
  };

  // ===========================================================================
  // Player Lifecycle
  // ===========================================================================

  onJoin(client: Client, options: Record<string, any>, auth: any): void {
    // ─── Spectator join ─────────────────────────────────────────────────
    if (options.spectator === true) {
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

    const player = new ScoreRacePlayer();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.avatarUrl = auth.avatarUrl || "";
    player.playerIndex = this.state.racePlayers.size;
    player.lives = this.maxLives;
    player.connected = true;

    this.state.racePlayers.set(client.sessionId, player);

    // Also set in base players map for consistency
    const basePlayer = new Player();
    basePlayer.uid = auth.uid;
    basePlayer.sessionId = client.sessionId;
    basePlayer.displayName = auth.displayName || "Player";
    basePlayer.playerIndex = player.playerIndex;
    basePlayer.connected = true;
    this.state.players.set(client.sessionId, basePlayer);

    // Send welcome message with player details
    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: player.playerIndex,
      seed: this.state.seed,
    });

    this.roomLog.info(
      `Player joined: ${auth.displayName} (${client.sessionId}) [${this.state.racePlayers.size}/${this.maxClients}]`,
    );

    if (this.state.racePlayers.size >= 2) {
      this.lock();
    }
  }

  onDrop(client: Client, code: number): void {
    if (this.spectatorSessionIds.has(client.sessionId)) return;
    const player = this.state.racePlayers.get(client.sessionId);
    if (player) player.connected = false;

    const basePlayer = this.state.players.get(client.sessionId);
    if (basePlayer) basePlayer.connected = false;

    // Notify other players
    this.broadcast(
      "opponent_reconnecting",
      { sessionId: client.sessionId },
      { except: client },
    );

    // Short reconnection window for fast games
    const timeout = parseInt(
      process.env.RECONNECTION_TIMEOUT_QUICKPLAY || "15",
      10,
    );
    this.allowReconnection(client, timeout);

    this.roomLog.info(
      `Player dropped: ${client.sessionId} (${timeout}s window)`,
    );
  }

  onReconnect(client: Client): void {
    if (this.spectatorSessionIds.has(client.sessionId)) return;
    const player = this.state.racePlayers.get(client.sessionId);
    if (player) player.connected = true;

    const basePlayer = this.state.players.get(client.sessionId);
    if (basePlayer) basePlayer.connected = true;

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

    const player = this.state.racePlayers.get(client.sessionId);
    if (player) {
      if (this.state.phase === "playing" && !player.finished) {
        player.finished = true;
        player.finishTime = Date.now() - this.gameStartTime;
        this.checkAllFinished();
      }
    }

    this.roomLog.info(`Player left: ${client.sessionId} (code: ${code})`);
  }

  async onDispose(): Promise<void> {
    this.rateLimiter.dispose();
    this.stuckWatchdog?.dispose();
    const firestoreGameId =
      this.state.firestoreGameId || this.state.gameId || this.roomId;

    if (this.state.phase === "finished" && this.state.winnerId) {
      // Game resolved � persist results, then delete game + invite
      const durationMs = this.state.timer.elapsed;
      await persistGameResult(this.state, durationMs);
      await deleteGameAndInvite(firestoreGameId);
      this.roomLog.info(
        `Game completed, persisted, and cleaned up: ${this.roomId}`,
      );
    } else if (this.state.phase === "playing") {
      // Ongoing non-turn-based game � mark as vacant for 10-minute cleanup
      await markGameVacant(firestoreGameId, this.gameTypeKey, false);
      this.roomLog.info(
        `Ongoing game marked vacant (10-min TTL): ${this.roomId}`,
      );
    } else if (
      this.state.phase === "waiting" ||
      this.state.phase === "countdown"
    ) {
      // PRE-START ABANDONMENT: delete immediately
      await deleteGameAndInvite(firestoreGameId);
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
    if (this.state.racePlayers.size < 2) return;

    let allReady = true;
    this.state.racePlayers.forEach((player: ScoreRacePlayer) => {
      if (!player.ready) allReady = false;
    });

    if (allReady) {
      this.startCountdown();
    }
  }

  private startCountdown(): void {
    this.state.phase = "countdown";
    this.state.countdown = 3;

    this.roomLog.info(`Countdown started`);

    // 3-second countdown
    const countdownInterval = this.clock.setInterval(() => {
      this.state.countdown--;
      if (this.state.countdown <= 0) {
        countdownInterval.clear();
        this.startGame();
      }
    }, 1000);
  }

  private startGame(): void {
    this.state.phase = "playing";
    this.state.timer.running = true;
    this.state.timer.remaining = this.state.gameDuration * 1000;
    this.gameStartTime = Date.now();
    this.stuckWatchdog?.markPlaying();

    this.roomLog.info(`Game started! Duration: ${this.state.gameDuration}s`);

    // Game timer — updates elapsed/remaining every 100ms
    this.setSimulationInterval((deltaTime: number) => {
      if (this.state.phase !== "playing") return;

      this.state.timer.elapsed += deltaTime;
      this.state.timer.remaining = Math.max(
        0,
        this.state.gameDuration * 1000 - this.state.timer.elapsed,
      );

      if (this.state.timer.remaining <= 0) {
        this.endGame();
      }
    }, 100); // 10fps timer updates
  }

  private checkAllFinished(): void {
    let allFinished = true;
    this.state.racePlayers.forEach((player: ScoreRacePlayer) => {
      if (!player.finished) allFinished = false;
    });

    if (allFinished) {
      this.endGame();
    }
  }

  private endGame(): void {
    if (this.state.phase === "finished") return; // Prevent double-end
    this.state.phase = "finished";
    this.state.timer.running = false;

    // Determine winner
    const players = Array.from(
      this.state.racePlayers.values(),
    ) as ScoreRacePlayer[];
    if (players.length >= 2) {
      const sorted = [...players].sort(
        (a: ScoreRacePlayer, b: ScoreRacePlayer) => {
          if (this.lowerIsBetter) {
            // Lower score wins (e.g., reaction time)
            // But only if they actually scored (score > 0)
            if (a.currentScore === 0 && b.currentScore === 0) return 0;
            if (a.currentScore === 0) return 1;
            if (b.currentScore === 0) return -1;
            return a.currentScore - b.currentScore;
          }
          return b.currentScore - a.currentScore; // Higher score wins
        },
      );

      if (sorted[0].currentScore === sorted[1].currentScore) {
        // Tie
        this.state.winnerId = "";
        this.state.winReason = "tie";
      } else {
        this.state.winnerId = sorted[0].uid;
        this.state.winReason = "highest_score";
      }
    }

    // Mirror scores to base players
    this.state.racePlayers.forEach((rp: ScoreRacePlayer) => {
      const bp = this.state.players.get(rp.sessionId);
      if (bp) bp.score = rp.currentScore;
    });

    // Broadcast final results
    const results = players.map((p: ScoreRacePlayer) => ({
      uid: p.uid,
      displayName: p.displayName,
      score: p.currentScore,
      playerIndex: p.playerIndex,
    }));

    this.broadcast("game_over", {
      winnerId: this.state.winnerId,
      winReason: this.state.winReason,
      results,
      gameDurationMs: this.state.timer.elapsed,
    });

    this.roomLog.info(
      `Game over! Winner: ${this.state.winnerId || "TIE"} | Scores: ${results.map((r) => `${r.displayName}: ${r.score}`).join(", ")}`,
    );
  }

  private resetForRematch(): void {
    // Reset player state
    this.state.racePlayers.forEach((player: ScoreRacePlayer) => {
      player.currentScore = 0;
      player.score = 0;
      player.finished = false;
      player.finishTime = 0;
      player.combo = 0;
      player.ready = false;
      player.lives = this.maxLives;
    });

    // Reset game state
    this.state.phase = "waiting";
    this.state.winnerId = "";
    this.state.winReason = "";
    this.state.timer.elapsed = 0;
    this.state.timer.remaining = 0;
    this.state.timer.running = false;
    this.state.countdown = 0;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.gameStartTime = 0;

    this.unlock();

    this.roomLog.info(`Room reset for rematch`);
  }
}
