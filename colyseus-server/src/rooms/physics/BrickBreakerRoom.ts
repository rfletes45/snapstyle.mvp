import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("BrickBreakerRoom");

/**
 * BrickBreakerRoom â€” Competitive parallel Brick Breaker
 *
 * Both players play the same Brick Breaker levels simultaneously.
 * Shared RNG seed ensures identical block layouts. Server tracks
 * score, lives, and level progress. First to lose all lives or
 * lower score when both finish wins.
 *
 * Architecture: Score-race style â€” physics runs client-side (pure
 * functions in brickBreakerLogic), server validates and compares.
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md â€” Phase 4.4
 */

import { Client, Room } from "colyseus";
import { BaseGameState } from "../../schemas/common";
import {
  BrickBreakerPlayerState,
  BrickBreakerState,
} from "../../schemas/physics";
import { verifyFirebaseToken } from "../../services/firebase";
import { persistGameResult } from "../../services/persistence";

// =============================================================================
// Constants
// =============================================================================

const MAX_LEVEL = 10; // competitive mode uses first 10 levels
const STARTING_LIVES = 3;
const TIME_LIMIT = 300; // 5 minutes

// =============================================================================
// Room
// =============================================================================

// Intentionally standalone room: Brick Breaker progression/state transitions
// do not match the shared score-race room abstraction.
export class BrickBreakerRoom extends Room<{ state: BrickBreakerState }> {
  maxClients = 2;
  patchRate = 100; // 10fps (just score/life updates)
  autoDispose = true;

  private gameStartTime = 0;

  // ===========================================================================
  // Lifecycle
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
    };
  }

  onCreate(options: Record<string, any>): void {
    this.setState(new BrickBreakerState());
    this.state.gameType = "brick_breaker_game";
    this.state.gameId = this.roomId;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.state.maxLevel = options.maxLevel || MAX_LEVEL;
    this.state.phase = "waiting";

    log.info(`[brick_breaker_game] Room created: ${this.roomId}`);
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    ready: (client: Client) => {
      const player = this.state.bbPlayers.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.checkAllReady();
      }
    },

    score_update: (
      client: Client,
      payload: {
        score: number;
        level: number;
        lives: number;
        bricksDestroyed: number;
      },
    ) => {
      if (this.state.phase !== "playing") return;
      const player = this.state.bbPlayers.get(client.sessionId);
      if (!player || player.finished) return;

      player.score = payload.score;
      player.level = Math.min(payload.level, this.state.maxLevel);
      player.lives = Math.max(0, payload.lives);
      player.bricksDestroyed = payload.bricksDestroyed;

      // Player lost all lives â†’ finished
      if (player.lives <= 0) {
        player.finished = true;
        this.checkAllFinished();
      }
    },

    level_complete: (
      client: Client,
      payload: { level: number; score: number },
    ) => {
      if (this.state.phase !== "playing") return;
      const player = this.state.bbPlayers.get(client.sessionId);
      if (!player || player.finished) return;

      player.level = Math.min(payload.level + 1, this.state.maxLevel);
      player.score = payload.score;

      // Completed all levels
      if (player.level > this.state.maxLevel) {
        player.finished = true;
        this.checkAllFinished();
      }
    },

    finished: (client: Client, payload: { finalScore: number }) => {
      if (this.state.phase !== "playing") return;
      const player = this.state.bbPlayers.get(client.sessionId);
      if (!player || player.finished) return;

      player.score = payload.finalScore;
      player.finished = true;
      this.checkAllFinished();
    },

    rematch: (client: Client) => {
      if (this.state.phase !== "finished") return;
      this.broadcast("rematch_request", {
        fromSessionId: client.sessionId,
        fromName:
          this.state.bbPlayers.get(client.sessionId)?.displayName || "Player",
      });
    },

    rematch_accept: (_client: Client) => {
      if (this.state.phase !== "finished") return;
      this.resetForRematch();
    },
  };

  // ===========================================================================
  // Player Lifecycle
  // ===========================================================================

  onJoin(client: Client, _options: Record<string, any>, auth: any): void {
    const player = new BrickBreakerPlayerState();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.playerIndex = this.state.bbPlayers.size;
    player.connected = true;
    player.lives = STARTING_LIVES;
    player.level = 1;

    this.state.bbPlayers.set(client.sessionId, player);

    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: player.playerIndex,
      seed: this.state.seed,
    });

    if (this.state.bbPlayers.size >= this.maxClients) {
      this.lock();
    }
  }

  onDrop(client: Client, _code: number): void {
    const player = this.state.bbPlayers.get(client.sessionId);
    if (player) player.connected = false;
    this.broadcast(
      "opponent_reconnecting",
      { sessionId: client.sessionId },
      { except: client },
    );
    this.allowReconnection(client, 15);
  }

  onReconnect(client: Client): void {
    const player = this.state.bbPlayers.get(client.sessionId);
    if (player) player.connected = true;
    this.broadcast(
      "opponent_reconnected",
      { sessionId: client.sessionId },
      { except: client },
    );
  }

  onLeave(client: Client, _code: number): void {
    const player = this.state.bbPlayers.get(client.sessionId);
    if (player && this.state.phase === "playing" && !player.finished) {
      player.finished = true;
      this.checkAllFinished();
    }
  }

  async onDispose(): Promise<void> {
    if (this.state.phase === "finished" && this.state.winnerId) {
      await persistGameResult(this.state as unknown as BaseGameState, this.state.elapsed);
    }
    log.info(`[brick_breaker_game] Room disposed: ${this.roomId}`);
  }

  // ===========================================================================
  // Game Flow
  // ===========================================================================

  private checkAllReady(): void {
    if (this.state.bbPlayers.size < 2) return;
    let allReady = true;
    this.state.bbPlayers.forEach((p: BrickBreakerPlayerState) => {
      if (!p.ready) allReady = false;
    });
    if (allReady) this.startCountdown();
  }

  private startCountdown(): void {
    this.state.phase = "countdown";
    this.state.countdown = 3;
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
    this.state.remaining = TIME_LIMIT * 1000;
    this.gameStartTime = Date.now();

    this.setSimulationInterval((dt: number) => {
      if (this.state.phase !== "playing") return;
      this.state.elapsed += dt;
      this.state.remaining = Math.max(
        0,
        TIME_LIMIT * 1000 - this.state.elapsed,
      );
      if (this.state.remaining <= 0) this.endGame();
    }, 100);

    log.info("[brick_breaker_game] Game started!");
  }

  private checkAllFinished(): void {
    let allFinished = true;
    this.state.bbPlayers.forEach((p: BrickBreakerPlayerState) => {
      if (!p.finished) allFinished = false;
    });
    if (allFinished) this.endGame();
  }

  private endGame(): void {
    if (this.state.phase === "finished") return;
    this.state.phase = "finished";

    const players = Array.from(
      this.state.bbPlayers.values(),
    ) as BrickBreakerPlayerState[];

    if (players.length >= 2) {
      // Winner: highest score. Tiebreak: more levels completed.
      const sorted = [...players].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.level !== a.level) return b.level - a.level;
        return b.bricksDestroyed - a.bricksDestroyed;
      });

      if (
        sorted[0].score === sorted[1].score &&
        sorted[0].level === sorted[1].level
      ) {
        this.state.winnerId = "";
        this.state.winReason = "tie";
      } else {
        this.state.winnerId = sorted[0].uid;
        this.state.winReason = "highest_score";
      }
    }

    const results = players.map((p) => ({
      uid: p.uid,
      displayName: p.displayName,
      score: p.score,
      level: p.level,
      lives: p.lives,
      bricksDestroyed: p.bricksDestroyed,
    }));

    this.broadcast("game_over", {
      winnerId: this.state.winnerId,
      winReason: this.state.winReason,
      results,
    });

    log.info(
      `[brick_breaker_game] Game over! Winner: ${this.state.winnerId || "TIE"}`,
    );
  }

  private resetForRematch(): void {
    this.state.bbPlayers.forEach((p: BrickBreakerPlayerState) => {
      p.score = 0;
      p.ready = false;
      p.finished = false;
      p.lives = STARTING_LIVES;
      p.level = 1;
      p.bricksDestroyed = 0;
    });
    this.state.phase = "waiting";
    this.state.winnerId = "";
    this.state.winReason = "";
    this.state.elapsed = 0;
    this.state.remaining = 0;
    this.state.countdown = 0;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.unlock();
  }
}


