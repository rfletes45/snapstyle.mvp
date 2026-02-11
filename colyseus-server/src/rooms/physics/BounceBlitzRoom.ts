import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("BounceBlitzRoom");

/**
 * BounceBlitzRoom â€” Competitive parallel Bounce Blitz (Ballz-style)
 *
 * Both players play the same Ballz-style game simultaneously with a
 * shared RNG seed for identical block layouts. Server tracks scores,
 * rounds, and determines the winner when time runs out or a player
 * loses (blocks reach bottom).
 *
 * Architecture: Score-race style â€” physics runs client-side, server
 * validates score updates and determines the winner.
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md â€” Phase 4.3
 */

import { Client, Room } from "colyseus";
import { BaseGameState } from "../../schemas/common";
import {
  BounceBlitzPlayerState,
  BounceBlitzState,
} from "../../schemas/physics";
import { verifyFirebaseToken } from "../../services/firebase";
import { persistGameResult } from "../../services/persistence";

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_DURATION = 120; // 2 minutes
const MAX_SCORE_PER_SECOND = 200; // anti-cheat cap

// =============================================================================
// Room
// =============================================================================

// Intentionally standalone room: state and message contracts differ from the
// shared score-race base, so lifecycle is kept explicit here.
export class BounceBlitzRoom extends Room<{ state: BounceBlitzState }> {
  maxClients = 2;
  patchRate = 100; // 10fps (score updates)
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
    this.setState(new BounceBlitzState());
    this.state.gameType = "bounce_blitz_game";
    this.state.gameId = this.roomId;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.state.gameDuration = options.duration || DEFAULT_DURATION;
    this.state.phase = "waiting";

    log.info(`[bounce_blitz_game] Room created: ${this.roomId}`);
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    ready: (client: Client) => {
      const player = this.state.blitzPlayers.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.checkAllReady();
      }
    },

    score_update: (
      client: Client,
      payload: { score: number; round: number; blocksDestroyed: number },
    ) => {
      if (this.state.phase !== "playing") return;
      const player = this.state.blitzPlayers.get(client.sessionId);
      if (!player || player.finished) return;

      // Basic anti-cheat
      const elapsedSec = (Date.now() - this.gameStartTime) / 1000;
      if (elapsedSec > 0 && payload.score / elapsedSec > MAX_SCORE_PER_SECOND) {
        return;
      }

      player.score = payload.score;
      player.round = payload.round || player.round;
      player.blocksDestroyed =
        payload.blocksDestroyed || player.blocksDestroyed;
    },

    finished: (client: Client, payload: { finalScore: number }) => {
      if (this.state.phase !== "playing") return;
      const player = this.state.blitzPlayers.get(client.sessionId);
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
          this.state.blitzPlayers.get(client.sessionId)?.displayName ||
          "Player",
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
    const player = new BounceBlitzPlayerState();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.playerIndex = this.state.blitzPlayers.size;
    player.connected = true;

    this.state.blitzPlayers.set(client.sessionId, player);

    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: player.playerIndex,
      seed: this.state.seed,
    });

    if (this.state.blitzPlayers.size >= this.maxClients) {
      this.lock();
    }
  }

  onDrop(client: Client, _code: number): void {
    const player = this.state.blitzPlayers.get(client.sessionId);
    if (player) player.connected = false;
    this.broadcast(
      "opponent_reconnecting",
      { sessionId: client.sessionId },
      { except: client },
    );
    this.allowReconnection(client, 15);
  }

  onReconnect(client: Client): void {
    const player = this.state.blitzPlayers.get(client.sessionId);
    if (player) player.connected = true;
    this.broadcast(
      "opponent_reconnected",
      { sessionId: client.sessionId },
      { except: client },
    );
  }

  onLeave(client: Client, _code: number): void {
    const player = this.state.blitzPlayers.get(client.sessionId);
    if (player && this.state.phase === "playing" && !player.finished) {
      player.finished = true;
      this.checkAllFinished();
    }
  }

  async onDispose(): Promise<void> {
    if (this.state.phase === "finished" && this.state.winnerId) {
      await persistGameResult(this.state as unknown as BaseGameState, this.state.elapsed);
    }
    log.info(`[bounce_blitz_game] Room disposed: ${this.roomId}`);
  }

  // ===========================================================================
  // Game Flow
  // ===========================================================================

  private checkAllReady(): void {
    if (this.state.blitzPlayers.size < 2) return;
    let allReady = true;
    this.state.blitzPlayers.forEach((p: BounceBlitzPlayerState) => {
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
    this.state.remaining = this.state.gameDuration * 1000;
    this.gameStartTime = Date.now();

    this.setSimulationInterval((dt: number) => {
      if (this.state.phase !== "playing") return;
      this.state.elapsed += dt;
      this.state.remaining = Math.max(
        0,
        this.state.gameDuration * 1000 - this.state.elapsed,
      );
      if (this.state.remaining <= 0) this.endGame();
    }, 100);

    log.info("[bounce_blitz_game] Game started!");
  }

  private checkAllFinished(): void {
    let allFinished = true;
    this.state.blitzPlayers.forEach((p: BounceBlitzPlayerState) => {
      if (!p.finished) allFinished = false;
    });
    if (allFinished) this.endGame();
  }

  private endGame(): void {
    if (this.state.phase === "finished") return;
    this.state.phase = "finished";

    const players = Array.from(
      this.state.blitzPlayers.values(),
    ) as BounceBlitzPlayerState[];

    if (players.length >= 2) {
      const sorted = [...players].sort((a, b) => b.score - a.score);
      if (sorted[0].score === sorted[1].score) {
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
      round: p.round,
      blocksDestroyed: p.blocksDestroyed,
    }));

    this.broadcast("game_over", {
      winnerId: this.state.winnerId,
      winReason: this.state.winReason,
      results,
    });

    log.info(
      `[bounce_blitz_game] Game over! Winner: ${this.state.winnerId || "TIE"}`,
    );
  }

  private resetForRematch(): void {
    this.state.blitzPlayers.forEach((p: BounceBlitzPlayerState) => {
      p.score = 0;
      p.ready = false;
      p.finished = false;
      p.round = 1;
      p.blocksDestroyed = 0;
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


