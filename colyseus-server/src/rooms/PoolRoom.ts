import { createServerLogger } from "../utils/logger";
const log = createServerLogger("PoolRoom");

import { ArraySchema, Schema, type } from "@colyseus/schema";
import { Client, Room } from "colyseus";
import { BaseGameState, Player } from "../schemas/common";
import { SpectatorEntry } from "../schemas/spectator";
import { verifyFirebaseToken } from "../services/firebase";
import {
  PoolBall,
  PoolMatchState,
  ShotParams,
  canPlaceCueBall,
  createInitialBalls,
  createInitialMatchState,
  createTable,
  evaluateShot,
  placeCueBall,
  simulateShot,
} from "../services/poolEngine";
import { persistGameResult } from "../services/persistence";

class PoolBallSchema extends Schema {
  @type("int16") id: number = 0;
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") vx: number = 0;
  @type("float32") vy: number = 0;
  @type("float32") spinX: number = 0;
  @type("float32") spinY: number = 0;
  @type("boolean") pocketed: boolean = false;
}

class PoolState extends BaseGameState {
  @type([PoolBallSchema]) balls = new ArraySchema<PoolBallSchema>();
  @type("boolean") openTable: boolean = true;
  @type("boolean") breakShot: boolean = true;
  @type("boolean") ballInHand: boolean = false;
  @type("uint8") currentPlayerIndex: number = 0;
  @type("string") lastFoul: string = "";
}

function toSchema(ball: PoolBall): PoolBallSchema {
  const out = new PoolBallSchema();
  out.id = ball.id;
  out.x = ball.x;
  out.y = ball.y;
  out.vx = ball.vx;
  out.vy = ball.vy;
  out.spinX = ball.spin.x;
  out.spinY = ball.spin.y;
  out.pocketed = ball.pocketed;
  return out;
}

function fromSchema(ball: PoolBallSchema): PoolBall {
  return {
    id: ball.id,
    x: ball.x,
    y: ball.y,
    vx: ball.vx,
    vy: ball.vy,
    spin: { x: ball.spinX, y: ball.spinY },
    pocketed: ball.pocketed,
  };
}

export class PoolRoom extends Room<{ state: PoolState }> {
  maxClients = 12;
  patchRate = 50;
  autoDispose = true;

  private readonly table = createTable();
  private matchState: PoolMatchState = createInitialMatchState();
  private gameStartMs = 0;
  private spectatorSessionIds = new Set<string>();
  private rematchVotes = new Set<string>();

  async onAuth(
    _client: Client,
    options: Record<string, any>,
    context: any,
  ): Promise<any> {
    const decoded = await verifyFirebaseToken(
      context?.token || options?.token || "",
    );
    return {
      uid: decoded.uid,
      displayName:
        (decoded as { name?: string; email?: string; picture?: string }).name ||
        (decoded as { name?: string; email?: string; picture?: string }).email ||
        "Player",
      avatarUrl:
        (decoded as { name?: string; email?: string; picture?: string })
          .picture || "",
    };
  }

  onCreate(options: Record<string, any>): void {
    const state = new PoolState();
    state.phase = "waiting";
    state.gameType = "8ball_pool";
    state.gameId = this.roomId;
    state.maxPlayers = 2;
    state.maxSpectators = 10;
    state.firestoreGameId = String(options.firestoreGameId ?? "");
    state.isRated = true;
    this.setState(state);

    this.setBalls(createInitialBalls(this.table));
    this.syncStateFromMatch();
    log.info("Room created", {
      roomId: this.roomId,
      firestoreGameId: state.firestoreGameId,
    });
  }

  private setBalls(balls: PoolBall[]): void {
    this.state.balls.clear();
    for (const ball of balls) {
      this.state.balls.push(toSchema(ball));
    }
  }

  private getBalls(): PoolBall[] {
    return this.state.balls.map(fromSchema);
  }

  private findSessionByPlayerIndex(index: 0 | 1): string | null {
    let sessionId: string | null = null;
    this.state.players.forEach((player: Player) => {
      if (player.playerIndex === index) sessionId = player.sessionId;
    });
    return sessionId;
  }

  private syncStateFromMatch(): void {
    this.state.phase =
      this.matchState.phase === "game-over" ? "finished" : this.matchState.phase;
    this.state.openTable = this.matchState.openTable;
    this.state.breakShot = this.matchState.breakShot;
    this.state.ballInHand = this.matchState.ballInHand;
    this.state.currentPlayerIndex = this.matchState.currentPlayer;
    this.state.turnNumber = this.matchState.turnNumber;
    this.state.lastFoul = this.matchState.lastFoul ?? "";
    const turnSession = this.findSessionByPlayerIndex(this.matchState.currentPlayer);
    this.state.currentTurnPlayerId = turnSession ?? "";
  }

  private finishGame(winnerIndex: 0 | 1, reason: string): void {
    const winnerSessionId = this.findSessionByPlayerIndex(winnerIndex);
    if (!winnerSessionId) return;
    const winnerPlayer = this.state.players.get(winnerSessionId);
    if (!winnerPlayer) return;
    this.state.phase = "finished";
    this.state.winnerId = winnerPlayer.uid;
    this.state.winReason = reason;
    this.broadcast("game_over", {
      winnerSessionId,
      winnerUid: winnerPlayer.uid,
      reason,
    });
    void persistGameResult(
      this.state,
      Math.max(1, Date.now() - this.gameStartMs),
    );
  }

  messages: Record<string, (client: Client, payload?: any) => void> = {
    shoot: (client: Client, payload?: ShotParams) => {
      if (this.spectatorSessionIds.has(client.sessionId)) return;
      if (this.state.phase === "finished") return;
      if (client.sessionId !== this.state.currentTurnPlayerId) return;
      if (this.matchState.ballInHand) return;
      const shot: ShotParams = {
        angle: Number(payload?.angle ?? 0),
        power: Math.max(0, Math.min(1, Number(payload?.power ?? 0))),
        english: {
          x: Math.max(-1, Math.min(1, Number(payload?.english?.x ?? 0))),
          y: Math.max(-1, Math.min(1, Number(payload?.english?.y ?? 0))),
        },
      };

      const result = simulateShot(this.getBalls(), shot, this.table);
      const evalResult = evaluateShot(this.matchState, result);
      this.matchState = evalResult.nextState;
      this.setBalls(result.finalBalls);
      this.syncStateFromMatch();
      this.broadcast("shot_result", {
        frames: result.frames,
        pocketed: result.pocketed,
        foulType: evalResult.foulType,
        message: evalResult.message,
      });

      if (evalResult.winner !== null) {
        this.finishGame(evalResult.winner, evalResult.message);
      }
    },

    place_cue: (client: Client, payload?: { x: number; y: number }) => {
      if (this.spectatorSessionIds.has(client.sessionId)) return;
      if (client.sessionId !== this.state.currentTurnPlayerId) return;
      if (!this.matchState.ballInHand) return;
      const x = Number(payload?.x ?? NaN);
      const y = Number(payload?.y ?? NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const balls = this.getBalls();
      const legal = canPlaceCueBall(
        balls,
        x,
        y,
        this.table,
        this.matchState.breakShot,
      );
      if (!legal) {
        client.send("error", { message: "Invalid cue-ball placement" });
        return;
      }
      this.setBalls(placeCueBall(balls, x, y));
      this.matchState.ballInHand = false;
      this.matchState.phase =
        this.matchState.players[this.matchState.currentPlayer].remaining <= 0
          ? "shooting-eight"
          : "playing";
      this.syncStateFromMatch();
    },

    rematch: (client: Client) => {
      if (this.spectatorSessionIds.has(client.sessionId)) return;
      if (this.state.phase !== "finished") return;
      this.rematchVotes.add(client.sessionId);
      if (this.rematchVotes.size < 2) return;
      this.rematchVotes.clear();
      this.matchState = createInitialMatchState();
      this.setBalls(createInitialBalls(this.table));
      this.state.winnerId = "";
      this.state.winReason = "";
      this.syncStateFromMatch();
      this.state.phase = "playing";
      this.gameStartMs = Date.now();
      this.broadcast("rematch_started", {});
    },
  };

  onJoin(client: Client, options: Record<string, any>, auth: any): void {
    if (options?.spectator === true) {
      const spectator = new SpectatorEntry();
      spectator.uid = auth.uid;
      spectator.sessionId = client.sessionId;
      spectator.displayName = auth.displayName || "Spectator";
      spectator.avatarUrl = auth.avatarUrl || "";
      spectator.joinedAt = Date.now();
      this.state.spectators.set(client.sessionId, spectator);
      this.state.spectatorCount += 1;
      this.spectatorSessionIds.add(client.sessionId);
      return;
    }

    if (this.state.players.size >= 2) {
      client.send("error", { message: "Match already has two players" });
      client.leave(4001);
      return;
    }

    const player = new Player();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.avatarUrl = auth.avatarUrl || "";
    player.ready = true;
    player.connected = true;
    player.playerIndex = this.state.players.size;
    this.state.players.set(client.sessionId, player);

    if (this.state.players.size === 1) {
      this.state.currentTurnPlayerId = client.sessionId;
      this.state.phase = "waiting";
      return;
    }

    this.state.phase = "playing";
    this.gameStartMs = Date.now();
    this.syncStateFromMatch();
    this.broadcast("match_started", {
      roomId: this.roomId,
      currentTurnPlayerId: this.state.currentTurnPlayerId,
    });
  }

  async onLeave(client: Client, code?: number): Promise<void> {
    if (this.spectatorSessionIds.has(client.sessionId)) {
      this.state.spectators.delete(client.sessionId);
      this.state.spectatorCount = Math.max(0, this.state.spectatorCount - 1);
      this.spectatorSessionIds.delete(client.sessionId);
      return;
    }

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (this.state.phase !== "finished" && (code === undefined || code < 4000)) {
      try {
        await this.allowReconnection(client, 300);
        return;
      } catch {
        const winner: 0 | 1 = player.playerIndex === 0 ? 1 : 0;
        this.finishGame(winner, "opponent_left");
      }
    }

    this.state.players.delete(client.sessionId);
  }

  async onDispose(): Promise<void> {
    log.info("Room disposed", { roomId: this.roomId });
  }
}
