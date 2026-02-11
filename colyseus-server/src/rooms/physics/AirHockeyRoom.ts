/**
 * AirHockeyRoom â€” Server-authoritative Air Hockey
 *
 * Two circular strikers (mallets), one puck. First to 7 wins.
 * Players can move strikers freely within their half of the table.
 * Server owns puck physics with circle-circle collision.
 *
 * Physics model:
 * - Puck moves with friction deceleration
 * - Circle-circle collision between puck and strikers
 * - Wall bouncing with slight energy loss
 * - Goal detection at top/bottom edges (within goal zone)
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md â€” Phase 4.2
 */

import { Client } from "colyseus";
import { PhysicsPlayer } from "../../schemas/physics";
import { InputPayload, PhysicsRoom } from "../base/PhysicsRoom";

// =============================================================================
// Constants
// =============================================================================

const FIELD_W = 400;
const FIELD_H = 600;
const PUCK_R = 12;
const STRIKER_R = 24;
const GOAL_WIDTH = 140;
const INITIAL_PUCK_SPEED = 0;
const MAX_PUCK_SPEED = 15;
const FRICTION = 0.998; // slight per-frame friction
const WALL_BOUNCE = 0.9; // energy loss on wall
const WIN_SCORE = 7;

// =============================================================================
// Room
// =============================================================================

export class AirHockeyRoom extends PhysicsRoom {
  protected readonly gameTypeKey = "air_hockey_game";
  protected readonly scoreToWin = WIN_SCORE;
  protected readonly gameDuration = 0;

  /** Previous striker positions for velocity-based hits */
  private prevStrikerPos = new Map<string, { x: number; y: number }>();

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  protected initializeGame(): void {
    this.state.fieldWidth = FIELD_W;
    this.state.fieldHeight = FIELD_H;
    this.state.scoreToWin = WIN_SCORE;
    this.state.ball.radius = PUCK_R;
    this.resetPuck();
  }

  // ---------------------------------------------------------------------------
  // Physics â€” runs at ~60fps
  // ---------------------------------------------------------------------------

  protected updatePhysics(_dt: number): void {
    const puck = this.state.ball;

    // Apply friction
    puck.vx *= FRICTION;
    puck.vy *= FRICTION;

    // Stop if very slow
    const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
    if (speed < 0.1) {
      puck.vx = 0;
      puck.vy = 0;
    }

    // Move puck
    puck.x += puck.vx;
    puck.y += puck.vy;

    // Wall bounces (left/right)
    if (puck.x - puck.radius <= 0) {
      puck.x = puck.radius;
      puck.vx = Math.abs(puck.vx) * WALL_BOUNCE;
    } else if (puck.x + puck.radius >= FIELD_W) {
      puck.x = FIELD_W - puck.radius;
      puck.vx = -Math.abs(puck.vx) * WALL_BOUNCE;
    }

    // Goal detection (top/bottom center gaps)
    const goalLeft = (FIELD_W - GOAL_WIDTH) / 2;
    const goalRight = (FIELD_W + GOAL_WIDTH) / 2;
    const inGoalZone = puck.x >= goalLeft && puck.x <= goalRight;

    // Ball past bottom â†’ player 1 (top) scores
    if (puck.y + puck.radius > FIELD_H) {
      if (inGoalZone) {
        const topPlayer = this.findPlayerByIndex(1);
        if (topPlayer) this.scorePoint(topPlayer.sessionId);
        return;
      }
      // Bounce off bottom wall (outside goal)
      puck.y = FIELD_H - puck.radius;
      puck.vy = -Math.abs(puck.vy) * WALL_BOUNCE;
    }

    // Ball past top â†’ player 0 (bottom) scores
    if (puck.y - puck.radius < 0) {
      if (inGoalZone) {
        const bottomPlayer = this.findPlayerByIndex(0);
        if (bottomPlayer) this.scorePoint(bottomPlayer.sessionId);
        return;
      }
      puck.y = puck.radius;
      puck.vy = Math.abs(puck.vy) * WALL_BOUNCE;
    }

    // Striker-puck collision
    this.state.players.forEach((p: PhysicsPlayer) => {
      const strikerX = p.paddleX * FIELD_W;
      const strikerY = p.paddleY * FIELD_H;

      const dx = puck.x - strikerX;
      const dy = puck.y - strikerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = puck.radius + STRIKER_R;

      if (dist < minDist && dist > 0) {
        // Separate objects
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        puck.x += nx * overlap;
        puck.y += ny * overlap;

        // Calculate striker velocity from previous position
        const prev = this.prevStrikerPos.get(p.sessionId) || {
          x: strikerX,
          y: strikerY,
        };
        const svx = strikerX - prev.x;
        const svy = strikerY - prev.y;

        // Elastic collision: puck gets striker velocity + reflected velocity
        const relVx = puck.vx - svx;
        const relVy = puck.vy - svy;
        const dotProduct = relVx * nx + relVy * ny;

        puck.vx -= 2 * dotProduct * nx;
        puck.vy -= 2 * dotProduct * ny;

        // Add striker velocity
        puck.vx += svx * 1.5;
        puck.vy += svy * 1.5;

        // Cap speed
        const puckSpeed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
        if (puckSpeed > MAX_PUCK_SPEED) {
          puck.vx = (puck.vx / puckSpeed) * MAX_PUCK_SPEED;
          puck.vy = (puck.vy / puckSpeed) * MAX_PUCK_SPEED;
        }
      }

      // Save current position for next frame
      this.prevStrikerPos.set(p.sessionId, { x: strikerX, y: strikerY });
    });
  }

  // ---------------------------------------------------------------------------
  // Input â€” both X and Y for free movement in own half
  // ---------------------------------------------------------------------------

  protected handleInput(client: Client, input: InputPayload): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (input.x !== undefined) {
      player.paddleX = Math.max(0, Math.min(1, input.x));
    }
    if (input.y !== undefined) {
      // Constrain to own half
      if (player.playerIndex === 0) {
        // Bottom player: y âˆˆ [0.5, 1.0]
        player.paddleY = Math.max(0.5, Math.min(1, input.y));
      } else {
        // Top player: y âˆˆ [0.0, 0.5]
        player.paddleY = Math.max(0, Math.min(0.5, input.y));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  protected resetAfterScore(): void {
    this.resetPuck();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private resetPuck(): void {
    const puck = this.state.ball;
    puck.x = FIELD_W / 2;
    puck.y = FIELD_H / 2;
    puck.vx = 0;
    puck.vy = 0;
    puck.speed = INITIAL_PUCK_SPEED;
  }

  private findPlayerByIndex(index: number): PhysicsPlayer | null {
    let found: PhysicsPlayer | null = null;
    this.state.players.forEach((p: PhysicsPlayer) => {
      if (p.playerIndex === index) found = p;
    });
    return found;
  }
}

