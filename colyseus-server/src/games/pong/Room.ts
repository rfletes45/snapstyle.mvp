/**
 * Pong — Room Implementation
 *
 * Authoritative 1v1 Pong room extending BaseRealtimeRoom.
 * Owns all physics, scoring, phase transitions, and result payloads.
 *
 * Arena coordinate system:
 *   - Origin (0, 0) at top-left
 *   - Width: 1.0 (normalized)
 *   - Height: 1.0 (normalized)
 *   - Left paddle at x ≈ 0.02
 *   - Right paddle at x ≈ 0.98
 *
 * @module games/pong/Room
 */

import type { Client } from "colyseus";
import { BaseRealtimeRoom } from "../../core/BaseRealtimeRoom";
import type {
  RealtimeGameDefinition,
  RealtimeScoreboardEntry,
} from "../../core/types";
import { PONG_DEFINITION } from "./Definition";

// =============================================================================
// Constants
// =============================================================================

const ARENA_W = 1.0;
const ARENA_H = 1.0;
const PADDLE_X_OFFSET = 0.03;
const PADDLE_WIDTH = 0.012;

/** Paddle half-heights by size preset */
const PADDLE_HALF: Record<string, number> = {
  normal: 0.08,
  large: 0.11,
};

/** Ball speed presets (units/sec in normalized coords) */
const BALL_SPEED: Record<string, number> = {
  normal: 0.55,
  fast: 0.72,
};

/** Rally speed ramp: each hit adds this fraction */
const RALLY_SPEED_RAMP = 0.012;
/** Maximum speed multiplier from rallying */
const MAX_RALLY_MULTIPLIER = 1.6;

const PADDLE_MAX_SPEED = 1.2; // units/sec
const PADDLE_ACCEL = 8.0; // units/sec²
const PADDLE_DECEL = 12.0; // units/sec²

/** Durations (ms) */
const SERVE_DELAY_MS = 1200;
const POINT_SCORED_DELAY_MS = 1500;

// Ball radius (normalized)
const BALL_RADIUS = 0.012;

// =============================================================================
// Types
// =============================================================================

interface PongPaddle {
  y: number;
  vy: number;
  targetY: number | null;
  connected: boolean;
}

interface PongBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface PlayerMetrics {
  goalsScored: number;
  goalsConceded: number;
  longestRallyHits: number;
  fastestPointMs: number;
  shutout: boolean;
  disconnectWin: boolean;
  comebackWin: boolean;
}

type PongPhase =
  | "waiting"
  | "countdown"
  | "serve"
  | "live"
  | "point_scored"
  | "match_end"
  | "aborted";

// =============================================================================
// Room
// =============================================================================

export class PongRoom extends BaseRealtimeRoom {
  // ── Identity ──────────────────────────────────────────────────────
  private leftUid = "";
  private rightUid = "";

  // ── Game state ────────────────────────────────────────────────────
  private pongPhase: PongPhase = "waiting";
  private scores: Record<string, number> = {};
  private ball: PongBall = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  private paddles: Record<string, PongPaddle> = {};
  private serveOwner = "left"; // "left" | "right"
  private pointHistory: Array<{
    scorer: string;
    leftScore: number;
    rightScore: number;
  }> = [];

  // ── Rally tracking ────────────────────────────────────────────────
  private rallyHits = 0;
  private currentServeStartMs = 0;
  private maxRallyHitsThisMatch = 0;

  // ── Settings (hydrated) ───────────────────────────────────────────
  private scoreToWin = 7;
  private winByTwo = false;
  private baseBallSpeed = BALL_SPEED.normal;
  private paddleHalf = PADDLE_HALF.normal;
  private arenaTheme = "classic";

  // ── Metrics ───────────────────────────────────────────────────────
  private metrics: Record<string, PlayerMetrics> = {};

  // ── Timers ────────────────────────────────────────────────────────
  private serveTimer: ReturnType<typeof setTimeout> | null = null;
  private pointTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Concede tracking ──────────────────────────────────────────────
  private concededUid: string | null = null;

  // ═════════════════════════════════════════════════════════════════
  // BaseRealtimeRoom template methods
  // ═════════════════════════════════════════════════════════════════

  protected getGameDefinition(): RealtimeGameDefinition {
    return PONG_DEFINITION;
  }

  protected registerGameMessages(): void {
    const def = this.getGameDefinition();
    for (const msg of def.messages) {
      this.messageRegistry.register(msg);
    }

    this.registerGameMessage<{ y: number }>(
      "input_move",
      (_client, uid, payload) => {
        this.handleInputMove(uid, payload.y);
      },
    );

    this.registerGameMessage("input_stop", (_client, uid) => {
      this.handleInputStop(uid);
    });

    this.registerGameMessage("reaction", (_client, uid, payload) => {
      this.handleReaction(uid, payload as { kind: string });
    });

    this.registerGameMessage("concede", (_client, uid) => {
      this.handleConcede(uid);
    });
  }

  protected onMatchStart(): void {
    this.hydrateSettings();
    this.assignSides();
    this.initScores();
    this.initPaddles();
    this.initMetrics();
    this.pongPhase = "serve";
    this.serveOwner = "left";
    this.startServe();
  }

  protected onMatchEnd(reason: string): {
    scoreboard: RealtimeScoreboardEntry[];
    winnerIds: string[];
    playerMetrics?: Record<string, Record<string, unknown>>;
  } {
    this.clearGameTimers();
    this.pongPhase = "match_end";

    const leftScore = this.scores[this.leftUid] ?? 0;
    const rightScore = this.scores[this.rightUid] ?? 0;

    // Determine winner
    let winnerIds: string[] = [];
    if (this.concededUid) {
      winnerIds =
        this.concededUid === this.leftUid ? [this.rightUid] : [this.leftUid];
    } else if (reason === "disconnect") {
      // Whoever is still connected (or was last) wins
      const leftPaddle = this.paddles[this.leftUid];
      const rightPaddle = this.paddles[this.rightUid];
      if (leftPaddle?.connected && !rightPaddle?.connected) {
        winnerIds = [this.leftUid];
        this.metrics[this.leftUid].disconnectWin = true;
      } else if (rightPaddle?.connected && !leftPaddle?.connected) {
        winnerIds = [this.rightUid];
        this.metrics[this.rightUid].disconnectWin = true;
      }
      // Both disconnected = no winner
    } else {
      if (leftScore > rightScore) winnerIds = [this.leftUid];
      else if (rightScore > leftScore) winnerIds = [this.rightUid];
      // Equal = draw (unlikely in Pong)
    }

    // Check comeback for winner
    for (const wid of winnerIds) {
      const opp = wid === this.leftUid ? this.rightUid : this.leftUid;
      // Trailing by 3+ at any point
      let maxDeficit = 0;
      let wScore = 0;
      let oScore = 0;
      for (const pt of this.pointHistory) {
        if (pt.scorer === wid) {
          wScore = wid === this.leftUid ? pt.leftScore : pt.rightScore;
          oScore = wid === this.leftUid ? pt.rightScore : pt.leftScore;
        } else {
          wScore = wid === this.leftUid ? pt.leftScore : pt.rightScore;
          oScore = wid === this.leftUid ? pt.rightScore : pt.leftScore;
        }
        const deficit = oScore - wScore;
        if (deficit > maxDeficit) maxDeficit = deficit;
      }
      if (maxDeficit >= 3) {
        this.metrics[wid].comebackWin = true;
      }
    }

    // Shutout check
    for (const uid of [this.leftUid, this.rightUid]) {
      if (winnerIds.includes(uid) && this.metrics[uid].goalsConceded === 0) {
        this.metrics[uid].shutout = true;
      }
    }

    // Build scoreboard
    const scoreboard: RealtimeScoreboardEntry[] = [
      this.leftUid,
      this.rightUid,
    ].map((uid) => {
      const isWinner = winnerIds.includes(uid);
      return {
        uid,
        displayName: this.rosterDisplayNames.get(uid) ?? uid,
        score: isWinner ? 1 : 0, // wins-based: 1 for win, 0 for loss
        placement: isWinner ? 1 : 2,
        stats: {
          goalsScored: this.metrics[uid]?.goalsScored ?? 0,
          goalsConceded: this.metrics[uid]?.goalsConceded ?? 0,
          matchScore: this.scores[uid] ?? 0,
          opponentScore:
            this.scores[uid === this.leftUid ? this.rightUid : this.leftUid] ??
            0,
        },
      };
    });

    // Build player metrics for achievements
    const playerMetrics: Record<string, Record<string, unknown>> = {};
    for (const uid of [this.leftUid, this.rightUid]) {
      const m = this.metrics[uid];
      playerMetrics[uid] = {
        goalsScored: m?.goalsScored ?? 0,
        goalsConceded: m?.goalsConceded ?? 0,
        longestRallyHits: m?.longestRallyHits ?? 0,
        fastestPointMs: m?.fastestPointMs ?? Infinity,
        shutout: m?.shutout ?? false,
        disconnectWin: m?.disconnectWin ?? false,
        comebackWin: m?.comebackWin ?? false,
        matchScore: this.scores[uid] ?? 0,
        opponentScore:
          this.scores[uid === this.leftUid ? this.rightUid : this.leftUid] ?? 0,
        side: uid === this.leftUid ? "left" : "right",
      };
    }

    return { scoreboard, winnerIds, playerMetrics };
  }

  protected onTick(deltaMs: number): void {
    const dt = deltaMs / 1000;

    // Always update paddles so players can move freely between rounds
    this.updatePaddles(dt);

    if (this.pongPhase !== "live") return;
    this.updateBall(dt);
    this.checkCollisions();
    this.checkGoal();
  }

  protected onPlayerReconnect(client: Client, uid: string): void {
    const paddle = this.paddles[uid];
    if (paddle) {
      paddle.connected = true;
      paddle.targetY = null;
      paddle.vy = 0;
    }

    // If we were in a frozen state waiting for reconnect, resume from serve
    if (this.pongPhase === "live" || this.pongPhase === "serve") {
      this.broadcastGameState();
    }
  }

  protected onPlayerDisconnect(uid: string): void {
    const paddle = this.paddles[uid];
    if (paddle) {
      paddle.connected = false;
      paddle.targetY = null;
      paddle.vy = 0;
    }
  }

  protected getGameState(
    viewerUid?: string,
    _isSpectator?: boolean,
  ): Record<string, unknown> {
    return {
      pongPhase: this.pongPhase,
      leftPlayerId: this.leftUid,
      rightPlayerId: this.rightUid,
      scores: { ...this.scores },
      ball: { ...this.ball },
      paddles: {
        left: {
          y: this.paddles[this.leftUid]?.y ?? 0.5,
          vy: this.paddles[this.leftUid]?.vy ?? 0,
          connected: this.paddles[this.leftUid]?.connected ?? false,
        },
        right: {
          y: this.paddles[this.rightUid]?.y ?? 0.5,
          vy: this.paddles[this.rightUid]?.vy ?? 0,
          connected: this.paddles[this.rightUid]?.connected ?? false,
        },
      },
      serveOwner: this.serveOwner,
      effectiveSettings: {
        scoreToWin: this.scoreToWin,
        winByTwo: this.winByTwo,
        ballSpeedPreset:
          this.baseBallSpeed === BALL_SPEED.fast ? "fast" : "normal",
        paddleSizePreset:
          this.paddleHalf === PADDLE_HALF.large ? "large" : "normal",
        arenaTheme: this.arenaTheme,
      },
      rallyHits: this.rallyHits,
      pointHistory: this.pointHistory.slice(-10),
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Setup helpers
  // ═════════════════════════════════════════════════════════════════

  private hydrateSettings(): void {
    const s = this.settings;
    this.scoreToWin = typeof s.scoreToWin === "number" ? s.scoreToWin : 7;
    this.winByTwo = typeof s.winByTwo === "boolean" ? s.winByTwo : false;
    this.baseBallSpeed =
      BALL_SPEED[(s.ballSpeedPreset as string) ?? "normal"] ??
      BALL_SPEED.normal;
    this.paddleHalf =
      PADDLE_HALF[(s.paddleSizePreset as string) ?? "normal"] ??
      PADDLE_HALF.normal;
    this.arenaTheme = (s.arenaTheme as string) ?? "classic";
  }

  private assignSides(): void {
    const uids = Array.from(this.players.keys());
    // Randomize sides
    if (Math.random() < 0.5) {
      this.leftUid = uids[0];
      this.rightUid = uids[1];
    } else {
      this.leftUid = uids[1];
      this.rightUid = uids[0];
    }
    this.log(`Sides assigned: left=${this.leftUid}, right=${this.rightUid}`);
  }

  private initScores(): void {
    this.scores = { [this.leftUid]: 0, [this.rightUid]: 0 };
    this.pointHistory = [];
  }

  private initPaddles(): void {
    this.paddles = {
      [this.leftUid]: {
        y: 0.5,
        vy: 0,
        targetY: null,
        connected: this.players.get(this.leftUid)?.connected ?? true,
      },
      [this.rightUid]: {
        y: 0.5,
        vy: 0,
        targetY: null,
        connected: this.players.get(this.rightUid)?.connected ?? true,
      },
    };
  }

  private initMetrics(): void {
    this.metrics = {
      [this.leftUid]: {
        goalsScored: 0,
        goalsConceded: 0,
        longestRallyHits: 0,
        fastestPointMs: Infinity,
        shutout: false,
        disconnectWin: false,
        comebackWin: false,
      },
      [this.rightUid]: {
        goalsScored: 0,
        goalsConceded: 0,
        longestRallyHits: 0,
        fastestPointMs: Infinity,
        shutout: false,
        disconnectWin: false,
        comebackWin: false,
      },
    };
    this.maxRallyHitsThisMatch = 0;
  }

  // ═════════════════════════════════════════════════════════════════
  // Serve / Point flow
  // ═════════════════════════════════════════════════════════════════

  private startServe(): void {
    this.pongPhase = "serve";
    this.rallyHits = 0;
    this.currentServeStartMs = Date.now();

    // Reset ball to center
    this.ball = { x: 0.5, y: 0.5, vx: 0, vy: 0 };

    // Broadcast pre-serve state
    this.broadcastGameState();

    // After a delay, launch the ball
    this.serveTimer = setTimeout(() => {
      this.serveTimer = null;
      this.launchBall();
    }, SERVE_DELAY_MS);
  }

  private launchBall(): void {
    if (this.pongPhase !== "serve") return;
    this.pongPhase = "live";

    // Ball direction: toward the serve receiver
    const dirX = this.serveOwner === "left" ? 1 : -1;
    // Random Y angle between -30° and 30°
    const angle = (Math.random() - 0.5) * (Math.PI / 3);
    const speed = this.baseBallSpeed * this.getMatchSpeedMultiplier();

    this.ball.vx = Math.cos(angle) * speed * dirX;
    this.ball.vy = Math.sin(angle) * speed;

    this.broadcast("serve_launch", {
      dirX,
      speed,
      angle,
    });
    this.broadcastGameState();
  }

  private onPointScored(scorerSide: "left" | "right"): void {
    const scorerUid = scorerSide === "left" ? this.leftUid : this.rightUid;
    const concederUid = scorerSide === "left" ? this.rightUid : this.leftUid;

    this.scores[scorerUid] = (this.scores[scorerUid] ?? 0) + 1;
    this.metrics[scorerUid].goalsScored++;
    this.metrics[concederUid].goalsConceded++;

    // Track rally stats
    if (this.rallyHits > this.maxRallyHitsThisMatch) {
      this.maxRallyHitsThisMatch = this.rallyHits;
    }
    for (const uid of [this.leftUid, this.rightUid]) {
      if (this.rallyHits > this.metrics[uid].longestRallyHits) {
        this.metrics[uid].longestRallyHits = this.rallyHits;
      }
    }

    // Track fastest point
    const pointDuration = Date.now() - this.currentServeStartMs;
    if (pointDuration < this.metrics[scorerUid].fastestPointMs) {
      this.metrics[scorerUid].fastestPointMs = pointDuration;
    }

    this.pointHistory.push({
      scorer: scorerUid,
      leftScore: this.scores[this.leftUid],
      rightScore: this.scores[this.rightUid],
    });

    this.pongPhase = "point_scored";
    this.ball = { x: 0.5, y: 0.5, vx: 0, vy: 0 };

    this.broadcast("point_scored", {
      scorerUid,
      scorerSide,
      leftScore: this.scores[this.leftUid],
      rightScore: this.scores[this.rightUid],
      rallyHits: this.rallyHits,
    });

    this.broadcastGameState();

    // Check win condition
    if (this.checkWinCondition()) {
      this.pointTimer = setTimeout(() => {
        this.pointTimer = null;
        this.endMatch("complete");
      }, POINT_SCORED_DELAY_MS);
      return;
    }

    // Next serve goes to the scorer (serves toward opponent)
    this.serveOwner = scorerSide;

    this.pointTimer = setTimeout(() => {
      this.pointTimer = null;
      this.startServe();
    }, POINT_SCORED_DELAY_MS);
  }

  private checkWinCondition(): boolean {
    const left = this.scores[this.leftUid] ?? 0;
    const right = this.scores[this.rightUid] ?? 0;
    const target = this.scoreToWin;

    if (this.winByTwo) {
      return (left >= target || right >= target) && Math.abs(left - right) >= 2;
    }
    return left >= target || right >= target;
  }

  // ═════════════════════════════════════════════════════════════════
  // Physics
  // ═════════════════════════════════════════════════════════════════

  private updatePaddles(dt: number): void {
    for (const uid of [this.leftUid, this.rightUid]) {
      const p = this.paddles[uid];
      if (!p) continue;

      if (p.targetY !== null) {
        // Move toward target
        const diff = p.targetY - p.y;
        const dir = Math.sign(diff);

        if (Math.abs(diff) < 0.005) {
          // Close enough — snap
          p.y = p.targetY;
          p.vy = 0;
        } else {
          // Accelerate toward target
          p.vy += dir * PADDLE_ACCEL * dt;
          // Clamp speed
          if (Math.abs(p.vy) > PADDLE_MAX_SPEED) {
            p.vy = Math.sign(p.vy) * PADDLE_MAX_SPEED;
          }
          // Don't overshoot
          const newY = p.y + p.vy * dt;
          if ((dir > 0 && newY > p.targetY) || (dir < 0 && newY < p.targetY)) {
            p.y = p.targetY;
            p.vy = 0;
          } else {
            p.y = newY;
          }
        }
      } else {
        // Decelerate
        if (Math.abs(p.vy) > 0.001) {
          const decel = Math.sign(p.vy) * PADDLE_DECEL * dt;
          if (Math.abs(decel) > Math.abs(p.vy)) {
            p.vy = 0;
          } else {
            p.vy -= decel;
          }
          p.y += p.vy * dt;
        }
      }

      // Clamp paddle within arena
      p.y = Math.max(this.paddleHalf, Math.min(ARENA_H - this.paddleHalf, p.y));
    }
  }

  private updateBall(dt: number): void {
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
  }

  private checkCollisions(): void {
    // ── Wall bounces (top/bottom) ───────────────────────────────
    if (this.ball.y - BALL_RADIUS <= 0) {
      this.ball.y = BALL_RADIUS;
      this.ball.vy = Math.abs(this.ball.vy);
      this.broadcast("wall_hit", { side: "top" });
    } else if (this.ball.y + BALL_RADIUS >= ARENA_H) {
      this.ball.y = ARENA_H - BALL_RADIUS;
      this.ball.vy = -Math.abs(this.ball.vy);
      this.broadcast("wall_hit", { side: "bottom" });
    }

    // ── Left paddle collision ───────────────────────────────────
    const leftPaddle = this.paddles[this.leftUid];
    const leftX = PADDLE_X_OFFSET;
    if (
      leftPaddle &&
      this.ball.vx < 0 &&
      this.ball.x - BALL_RADIUS <= leftX + PADDLE_WIDTH &&
      this.ball.x - BALL_RADIUS >= leftX - PADDLE_WIDTH &&
      this.ball.y >= leftPaddle.y - this.paddleHalf &&
      this.ball.y <= leftPaddle.y + this.paddleHalf
    ) {
      this.resolvePaddleHit("left", leftPaddle);
    }

    // ── Right paddle collision ──────────────────────────────────
    const rightPaddle = this.paddles[this.rightUid];
    const rightX = ARENA_W - PADDLE_X_OFFSET;
    if (
      rightPaddle &&
      this.ball.vx > 0 &&
      this.ball.x + BALL_RADIUS >= rightX - PADDLE_WIDTH &&
      this.ball.x + BALL_RADIUS <= rightX + PADDLE_WIDTH &&
      this.ball.y >= rightPaddle.y - this.paddleHalf &&
      this.ball.y <= rightPaddle.y + this.paddleHalf
    ) {
      this.resolvePaddleHit("right", rightPaddle);
    }
  }

  private resolvePaddleHit(side: "left" | "right", paddle: PongPaddle): void {
    this.rallyHits++;

    // Calculate hit position (-1 to 1) relative to paddle center
    const hitOffset = (this.ball.y - paddle.y) / this.paddleHalf;

    // Bounce angle: center = shallow, edges = steep
    const maxAngle = Math.PI / 3; // 60 degrees
    const angle = hitOffset * maxAngle;

    // Rally speed ramp (capped) + match escalation
    const rallyMultiplier = Math.min(
      1.0 + this.rallyHits * RALLY_SPEED_RAMP,
      MAX_RALLY_MULTIPLIER,
    );
    const speed =
      this.baseBallSpeed * rallyMultiplier * this.getMatchSpeedMultiplier();

    // Subtle spin from paddle movement
    const spinInfluence = paddle.vy * 0.15;

    const dirX = side === "left" ? 1 : -1;
    this.ball.vx = Math.cos(angle) * speed * dirX;
    this.ball.vy = Math.sin(angle) * speed + spinInfluence;

    // Push ball out of paddle zone to prevent double-hit
    if (side === "left") {
      this.ball.x = PADDLE_X_OFFSET + PADDLE_WIDTH + BALL_RADIUS + 0.002;
    } else {
      this.ball.x =
        ARENA_W - PADDLE_X_OFFSET - PADDLE_WIDTH - BALL_RADIUS - 0.002;
    }

    this.broadcast("paddle_hit", {
      side,
      hitOffset,
      rallyHits: this.rallyHits,
      speed,
    });
  }

  private checkGoal(): void {
    // Left goal (ball passes left boundary)
    if (this.ball.x - BALL_RADIUS <= 0) {
      this.onPointScored("right"); // Right player scores
      return;
    }
    // Right goal (ball passes right boundary)
    if (this.ball.x + BALL_RADIUS >= ARENA_W) {
      this.onPointScored("left"); // Left player scores
      return;
    }
  }

  /** Match-level speed escalation: each scored point adds 3%, capped at +60%. */
  private getMatchSpeedMultiplier(): number {
    const totalPoints =
      (this.scores[this.leftUid] ?? 0) + (this.scores[this.rightUid] ?? 0);
    return 1 + Math.min(totalPoints * 0.03, 0.6);
  }

  // ═════════════════════════════════════════════════════════════════
  // Input handlers
  // ═════════════════════════════════════════════════════════════════

  private handleInputMove(uid: string, targetY: number): void {
    const paddle = this.paddles[uid];
    if (!paddle) return;

    // Clamp target to arena bounds
    paddle.targetY = Math.max(
      this.paddleHalf,
      Math.min(ARENA_H - this.paddleHalf, targetY),
    );
  }

  private handleInputStop(uid: string): void {
    const paddle = this.paddles[uid];
    if (!paddle) return;
    paddle.targetY = null;
  }

  private handleReaction(uid: string, payload: { kind: string }): void {
    this.broadcast("reaction_event", {
      uid,
      kind: payload.kind,
      displayName: this.rosterDisplayNames.get(uid) ?? uid,
    });
  }

  private handleConcede(uid: string): void {
    if (this.pongPhase === "match_end" || this.pongPhase === "aborted") return;
    this.concededUid = uid;
    this.broadcastSystemMessage(
      `${this.rosterDisplayNames.get(uid) ?? uid} conceded`,
    );
    this.endMatch("complete");
  }

  // ═════════════════════════════════════════════════════════════════
  // Timer management
  // ═════════════════════════════════════════════════════════════════

  private clearGameTimers(): void {
    if (this.serveTimer) {
      clearTimeout(this.serveTimer);
      this.serveTimer = null;
    }
    if (this.pointTimer) {
      clearTimeout(this.pointTimer);
      this.pointTimer = null;
    }
  }
}
