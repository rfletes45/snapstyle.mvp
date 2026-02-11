import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("SnakeRoom");

/**
 * SnakeRoom â€” Server-authoritative multiplayer Snake
 *
 * Two snakes on a shared grid. Each player controls their snake's direction.
 * Server ticks at a fixed interval, advancing all snakes simultaneously.
 *
 * Win conditions:
 * - Opponent crashes into wall, self, or your snake
 * - If both crash on the same tick â†’ longer snake wins (tie = draw)
 *
 * Physics model:
 * - Grid-based movement, no sub-cell positions
 * - Fixed tick rate that increases as snakes grow
 * - Multiple food items can exist simultaneously
 * - Snakes grow by 1 segment per food eaten
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md â€” Phase 4.5
 */

import { Client, Room } from "colyseus";
import { BaseGameState } from "../../schemas/common";
import {
  Food,
  SnakePlayerState,
  SnakeSegment,
  SnakeState,
} from "../../schemas/physics";
import { verifyFirebaseToken } from "../../services/firebase";
import { persistGameResult } from "../../services/persistence";

// =============================================================================
// Constants
// =============================================================================

const GRID_W = 20;
const GRID_H = 20;
const INITIAL_LENGTH = 3;
const INITIAL_TICK_MS = 150;
const MIN_TICK_MS = 80;
const FOOD_COUNT = 3;

type Direction = "up" | "down" | "left" | "right";

const OPPOSITES: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

// =============================================================================
// Room
// =============================================================================

// Intentionally standalone room: grid-based snake tick/lifecycle differs from
// the shared physics room model.
export class SnakeRoom extends Room<{ state: SnakeState }> {
  maxClients = 2;
  patchRate = 33; // ~30fps sync
  autoDispose = true;

  private pendingDirections = new Map<string, Direction>();
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private currentTickMs = INITIAL_TICK_MS;

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

  onCreate(_options: Record<string, any>): void {
    this.setState(new SnakeState());
    this.state.gameType = "snake_game";
    this.state.gameId = this.roomId;
    this.state.gridWidth = GRID_W;
    this.state.gridHeight = GRID_H;
    this.state.tickRate = INITIAL_TICK_MS;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.state.phase = "waiting";

    log.info(`[snake_game] Room created: ${this.roomId}`);
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    ready: (client: Client) => {
      const player = this.state.snakePlayers.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.checkAllReady();
      }
    },

    input: (client: Client, payload: { direction: Direction }) => {
      if (this.state.phase !== "playing") return;
      const player = this.state.snakePlayers.get(client.sessionId);
      if (!player || !player.alive) return;

      const newDir = payload.direction;
      const currentDir = player.direction as Direction;

      // Prevent 180Â° turns
      if (OPPOSITES[newDir] !== currentDir) {
        this.pendingDirections.set(client.sessionId, newDir);
      }
    },

    rematch: (client: Client) => {
      if (this.state.phase !== "finished") return;
      this.broadcast("rematch_request", {
        fromSessionId: client.sessionId,
        fromName:
          this.state.snakePlayers.get(client.sessionId)?.displayName ||
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
    const player = new SnakePlayerState();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.playerIndex = this.state.snakePlayers.size;
    player.connected = true;
    player.alive = true;
    player.length = INITIAL_LENGTH;

    // Initial snake positions: player 0 at left, player 1 at right
    const startX =
      player.playerIndex === 0
        ? Math.floor(GRID_W * 0.25)
        : Math.floor(GRID_W * 0.75);
    const startY = Math.floor(GRID_H / 2);
    player.direction = player.playerIndex === 0 ? "right" : "left";

    for (let i = 0; i < INITIAL_LENGTH; i++) {
      const seg = new SnakeSegment();
      seg.x =
        player.playerIndex === 0
          ? startX - i // facing right, tail extends left
          : startX + i; // facing left, tail extends right
      seg.y = startY;
      player.segments.push(seg);
    }

    this.state.snakePlayers.set(client.sessionId, player);

    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: player.playerIndex,
    });

    log.info(
      `[snake_game] Player joined: ${auth.displayName} (${client.sessionId})`,
    );

    if (this.state.snakePlayers.size >= this.maxClients) {
      this.lock();
    }
  }

  onDrop(client: Client, _code: number): void {
    const player = this.state.snakePlayers.get(client.sessionId);
    if (player) player.connected = false;
    this.broadcast(
      "opponent_reconnecting",
      { sessionId: client.sessionId },
      { except: client },
    );
    this.allowReconnection(client, 15);
  }

  onReconnect(client: Client): void {
    const player = this.state.snakePlayers.get(client.sessionId);
    if (player) player.connected = true;
    this.broadcast(
      "opponent_reconnected",
      { sessionId: client.sessionId },
      { except: client },
    );
  }

  onLeave(client: Client, _code: number): void {
    if (this.state.phase === "playing") {
      const player = this.state.snakePlayers.get(client.sessionId);
      if (player) player.alive = false;
      this.checkGameOver();
    }
    log.info(`[snake_game] Player left: ${client.sessionId}`);
  }

  async onDispose(): Promise<void> {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.state.phase === "finished" && this.state.winnerId) {
      await persistGameResult(this.state as unknown as BaseGameState, this.state.elapsed);
    }
    log.info(`[snake_game] Room disposed: ${this.roomId}`);
  }

  // ===========================================================================
  // Game Flow
  // ===========================================================================

  private checkAllReady(): void {
    if (this.state.snakePlayers.size < 2) return;
    let allReady = true;
    this.state.snakePlayers.forEach((p: SnakePlayerState) => {
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
    this.currentTickMs = INITIAL_TICK_MS;
    this.state.tickRate = INITIAL_TICK_MS;

    // Spawn initial food
    for (let i = 0; i < FOOD_COUNT; i++) {
      this.spawnFood();
    }

    // Start fixed-rate game tick
    this.startTickLoop();

    log.info("[snake_game] Game started!");
  }

  private startTickLoop(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => {
      if (this.state.phase !== "playing") return;
      this.gameTick();
    }, this.currentTickMs);
  }

  // ===========================================================================
  // Game Tick â€” advance all snakes
  // ===========================================================================

  private gameTick(): void {
    this.state.elapsed += this.currentTickMs;

    // Apply pending direction changes
    this.pendingDirections.forEach((dir, sessionId) => {
      const player = this.state.snakePlayers.get(sessionId);
      if (player && player.alive) {
        player.direction = dir;
      }
    });
    this.pendingDirections.clear();

    // Move each alive snake
    const deaths: string[] = [];

    this.state.snakePlayers.forEach((player: SnakePlayerState) => {
      if (!player.alive) return;

      const head = player.segments[0];
      if (!head) return;

      const dir = player.direction as Direction;
      let newX = head.x;
      let newY = head.y;

      switch (dir) {
        case "up":
          newY--;
          break;
        case "down":
          newY++;
          break;
        case "left":
          newX--;
          break;
        case "right":
          newX++;
          break;
      }

      // Check wall collision
      if (newX < 0 || newX >= GRID_W || newY < 0 || newY >= GRID_H) {
        deaths.push(player.sessionId);
        return;
      }

      // Check self collision
      for (let i = 0; i < player.segments.length; i++) {
        const seg = player.segments[i];
        if (seg.x === newX && seg.y === newY) {
          deaths.push(player.sessionId);
          return;
        }
      }

      // Check collision with OTHER snakes
      this.state.snakePlayers.forEach((other: SnakePlayerState) => {
        if (other.sessionId === player.sessionId) return;
        if (!other.alive) return;
        for (let i = 0; i < other.segments.length; i++) {
          const seg = other.segments[i];
          if (seg.x === newX && seg.y === newY) {
            deaths.push(player.sessionId);
          }
        }
      });

      if (deaths.includes(player.sessionId)) return;

      // Check food collision
      let ate = false;
      for (let i = this.state.food.length - 1; i >= 0; i--) {
        const f = this.state.food[i];
        if (f.x === newX && f.y === newY) {
          ate = true;
          player.score += 10 + player.length * 2;
          player.length++;
          this.state.food.splice(i, 1);
          this.spawnFood();
          break;
        }
      }

      // Move: add new head
      const newHead = new SnakeSegment();
      newHead.x = newX;
      newHead.y = newY;
      player.segments.unshift(newHead);

      // Remove tail (unless food was eaten)
      if (!ate) {
        player.segments.pop();
      }
    });

    // Process deaths
    for (const sessionId of deaths) {
      const player = this.state.snakePlayers.get(sessionId);
      if (player) player.alive = false;
    }

    if (deaths.length > 0) {
      this.checkGameOver();
    }

    // Speed up as snakes grow
    const maxLength = this.getMaxSnakeLength();
    const newTick = Math.max(
      MIN_TICK_MS,
      INITIAL_TICK_MS - (maxLength - INITIAL_LENGTH) * 3,
    );
    if (newTick !== this.currentTickMs) {
      this.currentTickMs = newTick;
      this.state.tickRate = newTick;
      this.startTickLoop();
    }
  }

  // ===========================================================================
  // Win Detection
  // ===========================================================================

  private checkGameOver(): void {
    const players = Array.from(
      this.state.snakePlayers.values(),
    ) as SnakePlayerState[];

    const alive = players.filter((p) => p.alive);

    if (alive.length <= 1) {
      if (alive.length === 1) {
        this.state.winnerId = alive[0].uid;
        this.state.winReason = "opponent_crashed";
      } else {
        // Both died same tick â€” longer snake wins
        const sorted = [...players].sort((a, b) => b.length - a.length);
        if (sorted[0].length > sorted[1].length) {
          this.state.winnerId = sorted[0].uid;
          this.state.winReason = "longer_snake";
        } else {
          this.state.winnerId = "";
          this.state.winReason = "mutual_crash";
        }
      }

      this.state.phase = "finished";
      if (this.tickInterval) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
      }

      const results = players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        score: p.score,
        length: p.length,
        playerIndex: p.playerIndex,
      }));

      this.broadcast("game_over", {
        winnerId: this.state.winnerId,
        winReason: this.state.winReason,
        results,
      });

      log.info(
        `[snake_game] Game over! Winner: ${this.state.winnerId || "DRAW"}`,
      );
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private spawnFood(): void {
    const occupied = new Set<string>();

    this.state.snakePlayers.forEach((p: SnakePlayerState) => {
      for (const seg of p.segments) {
        occupied.add(`${seg.x},${seg.y}`);
      }
    });

    for (const f of this.state.food) {
      occupied.add(`${f.x},${f.y}`);
    }

    // Find a random empty cell
    const empty: { x: number; y: number }[] = [];
    for (let x = 0; x < GRID_W; x++) {
      for (let y = 0; y < GRID_H; y++) {
        if (!occupied.has(`${x},${y}`)) {
          empty.push({ x, y });
        }
      }
    }

    if (empty.length === 0) return;

    const pos = empty[Math.floor(Math.random() * empty.length)];
    const food = new Food();
    food.x = pos.x;
    food.y = pos.y;
    food.value = 1;
    this.state.food.push(food);
  }

  private getMaxSnakeLength(): number {
    let max = 0;
    this.state.snakePlayers.forEach((p: SnakePlayerState) => {
      if (p.length > max) max = p.length;
    });
    return max;
  }

  private resetForRematch(): void {
    // Clear old state
    this.state.snakePlayers.forEach((p: SnakePlayerState) => {
      p.segments.splice(0, p.segments.length);
      p.score = 0;
      p.ready = false;
      p.alive = true;
      p.length = INITIAL_LENGTH;

      // Re-create initial snake
      const startX =
        p.playerIndex === 0
          ? Math.floor(GRID_W * 0.25)
          : Math.floor(GRID_W * 0.75);
      const startY = Math.floor(GRID_H / 2);
      p.direction = p.playerIndex === 0 ? "right" : "left";

      for (let i = 0; i < INITIAL_LENGTH; i++) {
        const seg = new SnakeSegment();
        seg.x = p.playerIndex === 0 ? startX - i : startX + i;
        seg.y = startY;
        p.segments.push(seg);
      }
    });

    this.state.food.splice(0, this.state.food.length);
    this.state.phase = "waiting";
    this.state.winnerId = "";
    this.state.winReason = "";
    this.state.elapsed = 0;
    this.state.countdown = 0;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.currentTickMs = INITIAL_TICK_MS;
    this.state.tickRate = INITIAL_TICK_MS;
    this.pendingDirections.clear();
    this.unlock();

    log.info("[snake_game] Room reset for rematch");
  }
}


