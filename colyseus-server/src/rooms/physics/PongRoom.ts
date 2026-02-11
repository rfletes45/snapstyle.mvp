/**
 * PongRoom â€” Server-authoritative classic Pong
 *
 * Two paddles, one ball. First to 7 wins.
 * Server owns ball physics; clients send paddle X position.
 *
 * Physics model:
 * - Ball moves at constant speed, bouncing off walls and paddles
 * - Paddle hit angle influences ball direction
 * - Ball speed increases slightly on each paddle hit
 * - Power-ups spawn randomly after each score
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md â€” Phase 4.1
 */

import { Client } from "colyseus";
import { Paddle, PhysicsPlayer } from "../../schemas/physics";
import { InputPayload, PhysicsRoom } from "../base/PhysicsRoom";

// =============================================================================
// Constants
// =============================================================================

const FIELD_W = 400;
const FIELD_H = 600;
const PADDLE_W = 80;
const PADDLE_H = 14;
const BALL_R = 10;
const INITIAL_SPEED = 4;
const MAX_SPEED = 12;
const SPEED_INCREMENT = 0.15;
const WIN_SCORE = 7;

// =============================================================================
// Room
// =============================================================================

export class PongRoom extends PhysicsRoom {
  protected readonly gameTypeKey = "pong_game";
  protected readonly scoreToWin = WIN_SCORE;
  protected readonly gameDuration = 0; // score-based, not timed

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  protected initializeGame(): void {
    this.state.fieldWidth = FIELD_W;
    this.state.fieldHeight = FIELD_H;
    this.state.scoreToWin = WIN_SCORE;
    this.resetBall();
  }

  // ---------------------------------------------------------------------------
  // Physics â€” runs at ~60fps
  // ---------------------------------------------------------------------------

  protected updatePhysics(_dt: number): void {
    const b = this.state.ball;

    // Move ball
    b.x += b.vx;
    b.y += b.vy;

    // Wall bounces (left/right)
    if (b.x - b.radius <= 0) {
      b.x = b.radius;
      b.vx = Math.abs(b.vx);
    } else if (b.x + b.radius >= FIELD_W) {
      b.x = FIELD_W - b.radius;
      b.vx = -Math.abs(b.vx);
    }

    // Paddle collisions
    this.state.paddles.forEach((paddle: Paddle) => {
      const player = this.state.players.get(paddle.ownerId);
      if (!player) return;

      const isBottom = player.playerIndex === 0;
      const withinX = b.x >= paddle.x && b.x <= paddle.x + paddle.width;

      if (isBottom) {
        // Bottom paddle
        if (
          b.y + b.radius >= paddle.y &&
          b.y + b.radius <= paddle.y + paddle.height &&
          withinX &&
          b.vy > 0
        ) {
          this.handlePaddleHit(paddle, isBottom);
        }
      } else {
        // Top paddle
        if (
          b.y - b.radius <= paddle.y + paddle.height &&
          b.y - b.radius >= paddle.y &&
          withinX &&
          b.vy < 0
        ) {
          this.handlePaddleHit(paddle, isBottom);
        }
      }
    });

    // Scoring â€” ball past bottom
    if (b.y + b.radius > FIELD_H) {
      // Player 1 (top, index=1) scores
      const topPlayer = this.findPlayerByIndex(1);
      if (topPlayer) this.scorePoint(topPlayer.sessionId);
      return;
    }

    // Scoring â€” ball past top
    if (b.y - b.radius < 0) {
      // Player 0 (bottom, index=0) scores
      const bottomPlayer = this.findPlayerByIndex(0);
      if (bottomPlayer) this.scorePoint(bottomPlayer.sessionId);
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  protected handleInput(client: Client, input: InputPayload): void {
    const paddle = this.state.paddles.get(client.sessionId);
    if (!paddle) return;

    if (input.x !== undefined) {
      // Client sends normalised X (0-1), convert to field units
      const newX = Math.max(
        0,
        Math.min(FIELD_W - paddle.width, input.x * FIELD_W - paddle.width / 2),
      );
      paddle.x = newX;

      // Also update player's paddleX
      const player = this.state.players.get(client.sessionId);
      if (player) player.paddleX = input.x;
    }
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  protected resetAfterScore(): void {
    this.resetBall();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private resetBall(): void {
    const b = this.state.ball;
    b.x = FIELD_W / 2;
    b.y = FIELD_H / 2;
    b.radius = BALL_R;
    b.speed = INITIAL_SPEED;

    // Random angle between 30Â° and 60Â°
    const angle = (Math.random() * Math.PI) / 6 + Math.PI / 6;
    const dirX = Math.random() > 0.5 ? 1 : -1;
    const dirY = Math.random() > 0.5 ? 1 : -1;
    b.vx = Math.cos(angle) * b.speed * dirX;
    b.vy = Math.sin(angle) * b.speed * dirY;
  }

  private handlePaddleHit(paddle: Paddle, isBottom: boolean): void {
    const b = this.state.ball;
    b.vy *= -1;

    // Hit position influences angle (-0.5 to +0.5)
    const hitPos = (b.x - paddle.x) / paddle.width - 0.5;
    b.vx += hitPos * 3;

    // Speed up
    b.speed = Math.min(b.speed + SPEED_INCREMENT, MAX_SPEED);
    const mag = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    b.vx = (b.vx / mag) * b.speed;
    b.vy = (b.vy / mag) * b.speed;

    // Ensure ball moves away from paddle
    if (isBottom) {
      b.y = paddle.y - b.radius - 1;
    } else {
      b.y = paddle.y + paddle.height + b.radius + 1;
    }
  }

  private findPlayerByIndex(index: number): PhysicsPlayer | null {
    let found: PhysicsPlayer | null = null;
    this.state.players.forEach((p: PhysicsPlayer) => {
      if (p.playerIndex === index) found = p;
    });
    return found;
  }
}

