/**
 * BreakoutEngine — Core Planck.js Physics Engine
 *
 * Uses Planck.js (Box2D) for reliable collision detection with CCD (bullet mode).
 * This module is framework-agnostic — no React dependency.
 *
 * Architecture:
 *   - Planck.js world with zero gravity
 *   - Static walls (left, right, ceiling) with restitution=1
 *   - Ceiling has special userData for paddle-shrink detection
 *   - Static bricks with userData for color/points identification
 *   - Dynamic bullet-mode ball with restitution=1
 *   - Kinematic paddle — custom bounce angle via pre-solve
 *   - Thick sensor drain at bottom (never missed via fat box)
 *   - Contact listener handles all game logic:
 *       brick destruction, speed tier triggers, paddle shrink, life loss
 *   - Deferred body destruction (never destroy during contact callback)
 *   - Per-step de-duplication via hitThisStep Set
 *
 * Classic Atari Breakout rules:
 *   - 8 rows × 14 cols, 2 walls, 3 lives, score by color
 *   - Speed tiers: 4 hits, 12 hits, first orange, first red
 *   - Paddle shrink: after breakthrough red + ceiling hit
 */

import * as planck from "planck";

import {
  BALL_BASE_SPEED,
  BALL_RADIUS,
  BALL_RADIUS_PX,
  BRICK_COLS,
  BRICK_HEIGHT,
  BRICK_PADDING,
  BRICK_ROWS,
  BRICK_TOP_OFFSET,
  BRICK_WIDTH,
  CAT_BALL,
  CAT_BRICK,
  CAT_CEILING,
  CAT_DRAIN,
  CAT_PADDLE,
  CAT_WALL,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_BOUNCE_ANGLE,
  MIN_ANGLE_FROM_HORIZONTAL,
  PADDLE_HEIGHT,
  PADDLE_SHRUNK_WIDTH,
  PADDLE_WIDTH,
  PADDLE_Y,
  PHYSICS_DT,
  POSITION_ITERATIONS,
  px2m,
  ROW_DEFS,
  SCALE,
  SPEED_TIER_HIT_12,
  SPEED_TIER_HIT_4,
  SPEED_TIERS,
  STARTING_LIVES,
  TOTAL_WALLS,
  VELOCITY_ITERATIONS,
} from "./BreakoutConfig";

import type {
  BallUserData,
  BreakoutBallState,
  BreakoutBrick,
  BreakoutCallbacks,
  BreakoutGameStats,
  BreakoutPhase,
  BreakoutResult,
  BreakoutSnapshot,
  BrickUserData,
  CeilingUserData,
  DrainUserData,
  FixtureUserData,
  PaddleUserData,
  SpeedTierFlags,
  WallUserData,
} from "./BreakoutTypes";

// =============================================================================
// Helpers
// =============================================================================

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// =============================================================================
// Engine
// =============================================================================

export class BreakoutEngine {
  // ── Planck world ──
  private world: planck.World;

  // ── Instance ID counter ──
  private _nextId = 1;
  private uid(): number {
    return this._nextId++;
  }

  // ── Game state ──
  private _phase: BreakoutPhase = "idle";
  private _score = 0;
  private _lives = STARTING_LIVES;
  private _wall = 1; // current wall (1 or 2)
  private _bestScore = 0;
  private _startedAt = 0;

  // ── Ball tracking ──
  private _totalBrickHits = 0;
  private _bricksDestroyed = 0;

  // ── Speed tier state ──
  private _currentSpeedTier = 0;
  private _speedFlags: SpeedTierFlags = {
    tier4Hits: false,
    tier12Hits: false,
    tierOrangeContact: false,
    tierRedContact: false,
  };

  // ── Paddle state ──
  private _paddleShrunk = false;
  private _hasBreakthroughRed = false; // ball touched a red brick
  private _paddleX = GAME_WIDTH / 2; // center X in px
  private _paddleWidth = PADDLE_WIDTH;

  // ── Max speed tier reached (for stats) ──
  private _maxSpeedTier = 0;

  // ── Entity bookkeeping ──
  private bricks: Map<number, { brick: BreakoutBrick; body: planck.Body }> =
    new Map();
  private _brickSnapshot: BreakoutBrick[] = [];

  // ── Physics bodies ──
  private wallBodies: planck.Body[] = [];
  private ceilingBody!: planck.Body;
  private drainBody!: planck.Body;
  private paddleBody!: planck.Body;
  private ballBody: planck.Body | null = null;

  // ── Deferred destruction ──
  private destroyedBrickIds: Set<number> = new Set();
  private _ballLost = false;
  private _bricksChanged = true; // tracks whether brick snapshot needs rebuild

  // ── Per-step de-dup ──
  private hitThisStep: Set<number> = new Set(); // brickId

  // ── Callbacks ──
  private cb: Partial<BreakoutCallbacks> = {};

  // ── Debug ──
  debugCollisions: { x: number; y: number; t: number }[] = [];
  debugBallSpeed = 0;
  debugHitCount = 0;
  debugSpeedTier = 0;

  private static readonly MAX_DEBUG_POINTS = 50;

  // ── Life-loss / wall-clear transition timers ──
  private _transitionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.world = new planck.World({ gravity: planck.Vec2(0, 0) });
    this.createBoundaries();
    this.createPaddle();
    this.installContactListener();
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /** Register event callbacks */
  on(callbacks: Partial<BreakoutCallbacks>): void {
    this.cb = { ...this.cb, ...callbacks };
  }

  /** Get a read-only snapshot for rendering */
  get snapshot(): BreakoutSnapshot {
    let ballState: BreakoutBallState = {
      x: this._paddleX,
      y: PADDLE_Y - BALL_RADIUS_PX - 1,
    };

    if (this.ballBody) {
      const pos = this.ballBody.getPosition();
      ballState = { x: pos.x * SCALE, y: pos.y * SCALE };
    }

    return {
      phase: this._phase,
      ball: ballState,
      paddle: {
        x: this._paddleX,
        width: this._paddleWidth,
      },
      bricks: this._brickSnapshot,
      score: this._score,
      lives: this._lives,
      wall: this._wall,
      speedTier: this._currentSpeedTier,
      paddleShrunk: this._paddleShrunk,
      totalBrickHits: this._totalBrickHits,
      hasBreakthroughRed: this._hasBreakthroughRed,
      bricksDestroyed: this._bricksDestroyed,
      bestScore: this._bestScore,
    };
  }

  get phase(): BreakoutPhase {
    return this._phase;
  }
  get score(): number {
    return this._score;
  }
  get lives(): number {
    return this._lives;
  }
  get wall(): number {
    return this._wall;
  }
  get bestScore(): number {
    return this._bestScore;
  }
  set bestScore(v: number) {
    this._bestScore = v;
  }
  get startedAt(): number {
    return this._startedAt;
  }
  get paddleX(): number {
    return this._paddleX;
  }

  /** Start a new game from scratch */
  startGame(): void {
    this.resetGameState();
    this._phase = "serving";
    this._startedAt = Date.now();
    this._wall = 1;
    this._score = 0;
    this._lives = STARTING_LIVES;
    this._totalBrickHits = 0;
    this._bricksDestroyed = 0;
    this._currentSpeedTier = 0;
    this._maxSpeedTier = 0;
    this._paddleShrunk = false;
    this._hasBreakthroughRed = false;
    this._paddleWidth = PADDLE_WIDTH;
    this._paddleX = GAME_WIDTH / 2;
    this._speedFlags = {
      tier4Hits: false,
      tier12Hits: false,
      tierOrangeContact: false,
      tierRedContact: false,
    };

    this.spawnWall();
    this.rebuildPaddleFixture();
    this.updateBrickSnapshot();
    this.emitStateChanged();
  }

  /** Launch the ball from the paddle */
  launchBall(): void {
    if (this._phase !== "serving") return;

    this._phase = "playing";
    this.createBall();
    this.emitStateChanged();
  }

  /** Move paddle to an absolute X position (in game pixels) */
  movePaddle(x: number): void {
    const halfW = this._paddleWidth / 2;
    this._paddleX = clamp(x, halfW, GAME_WIDTH - halfW);
    this.syncPaddleBody();
  }

  /**
   * Step the physics world forward by one frame.
   * Call from requestAnimationFrame.
   * Returns true if a render update is needed.
   */
  step(): boolean {
    if (this._phase !== "playing") return false;

    // Clear per-step tracking
    this.hitThisStep.clear();
    this._ballLost = false;

    // Step physics
    this.world.step(PHYSICS_DT, VELOCITY_ITERATIONS, POSITION_ITERATIONS);

    // Process deferred destructions
    this.processDeferred();

    // Belt-and-suspenders: position-based drain detection
    if (this.ballBody && !this._ballLost) {
      const pos = this.ballBody.getPosition();
      if (pos.y * SCALE > PADDLE_Y + 60) {
        this.handleBallLost();
      }
    }

    // Re-normalize ball speed to current tier (prevent float drift)
    if (this.ballBody && this._phase === "playing") {
      this.enforceSpeed();
    }

    // Only rebuild brick array when bricks have actually changed
    if (this._bricksChanged) {
      this.updateBrickSnapshot();
      this._bricksChanged = false;
    }

    // Note: we don't call emitStateChanged() here — the rAF loop in
    // useBreakoutGame reads engine.snapshot directly each frame.
    // emitStateChanged is reserved for engine-internal transitions
    // (lifeLost→serving, wallCleared→serving) outside the rAF loop.
    return true;
  }

  /** Clean up all physics resources */
  destroy(): void {
    if (this._transitionTimer) clearTimeout(this._transitionTimer);

    let body = this.world.getBodyList();
    while (body) {
      const next = body.getNext();
      this.world.destroyBody(body);
      body = next;
    }

    this.bricks.clear();
    this.ballBody = null;
    this.wallBodies = [];
  }

  // =========================================================================
  // Internals — World Setup
  // =========================================================================

  /** Create static boundaries: left wall, right wall, ceiling, drain sensor */
  private createBoundaries(): void {
    const w = px2m(GAME_WIDTH);
    const h = px2m(GAME_HEIGHT);

    // Left wall
    const leftWall = this.world.createBody({
      type: "static",
      position: planck.Vec2(0, h / 2),
    });
    leftWall.createFixture({
      shape: planck.Edge(planck.Vec2(0, -h / 2), planck.Vec2(0, h / 2)),
      friction: 0,
      restitution: 1,
      filterCategoryBits: CAT_WALL,
      filterMaskBits: CAT_BALL,
      userData: { kind: "wall" } as WallUserData,
    });
    this.wallBodies.push(leftWall);

    // Right wall
    const rightWall = this.world.createBody({
      type: "static",
      position: planck.Vec2(w, h / 2),
    });
    rightWall.createFixture({
      shape: planck.Edge(planck.Vec2(0, -h / 2), planck.Vec2(0, h / 2)),
      friction: 0,
      restitution: 1,
      filterCategoryBits: CAT_WALL,
      filterMaskBits: CAT_BALL,
      userData: { kind: "wall" } as WallUserData,
    });
    this.wallBodies.push(rightWall);

    // Ceiling — separate category to detect paddle-shrink trigger
    this.ceilingBody = this.world.createBody({
      type: "static",
      position: planck.Vec2(w / 2, 0),
    });
    this.ceilingBody.createFixture({
      shape: planck.Edge(planck.Vec2(-w / 2, 0), planck.Vec2(w / 2, 0)),
      friction: 0,
      restitution: 1,
      filterCategoryBits: CAT_CEILING,
      filterMaskBits: CAT_BALL,
      userData: { kind: "ceiling" } as CeilingUserData,
    });

    // Drain sensor — thick box below visible area to prevent missed contacts
    const DRAIN_SENSOR_HEIGHT = 2; // 2 meters thick
    this.drainBody = this.world.createBody({
      type: "static",
      position: planck.Vec2(w / 2, h + DRAIN_SENSOR_HEIGHT / 2),
    });
    this.drainBody.createFixture({
      shape: planck.Box(w / 2, DRAIN_SENSOR_HEIGHT / 2),
      isSensor: true,
      filterCategoryBits: CAT_DRAIN,
      filterMaskBits: CAT_BALL,
      userData: { kind: "drain" } as DrainUserData,
    });
  }

  /** Create the kinematic paddle body */
  private createPaddle(): void {
    const cx = px2m(GAME_WIDTH / 2);
    const cy = px2m(PADDLE_Y);

    this.paddleBody = this.world.createBody({
      type: "kinematic",
      position: planck.Vec2(cx, cy),
      fixedRotation: true,
    });

    const halfW = px2m(PADDLE_WIDTH / 2);
    const halfH = px2m(PADDLE_HEIGHT / 2);

    this.paddleBody.createFixture({
      shape: planck.Box(halfW, halfH),
      friction: 0,
      restitution: 0, // we handle bounce manually
      filterCategoryBits: CAT_PADDLE,
      filterMaskBits: CAT_BALL,
      userData: { kind: "paddle" } as PaddleUserData,
    });
  }

  /** Rebuild paddle fixture with current width (for shrink) */
  private rebuildPaddleFixture(): void {
    // Remove existing fixture
    let fix = this.paddleBody.getFixtureList();
    while (fix) {
      const next = fix.getNext();
      this.paddleBody.destroyFixture(fix);
      fix = next;
    }

    const halfW = px2m(this._paddleWidth / 2);
    const halfH = px2m(PADDLE_HEIGHT / 2);

    this.paddleBody.createFixture({
      shape: planck.Box(halfW, halfH),
      friction: 0,
      restitution: 0,
      filterCategoryBits: CAT_PADDLE,
      filterMaskBits: CAT_BALL,
      userData: { kind: "paddle" } as PaddleUserData,
    });
  }

  /** Sync paddle body position to _paddleX */
  private syncPaddleBody(): void {
    const cx = px2m(this._paddleX);
    const cy = px2m(PADDLE_Y);
    this.paddleBody.setPosition(planck.Vec2(cx, cy));
    this.paddleBody.setLinearVelocity(planck.Vec2(0, 0));
  }

  /** Create the ball (dynamic, bullet mode) positioned on top of the paddle */
  private createBall(): void {
    // Destroy existing ball if any
    if (this.ballBody) {
      this.world.destroyBody(this.ballBody);
      this.ballBody = null;
    }

    const cx = px2m(this._paddleX);
    const cy = px2m(PADDLE_Y - PADDLE_HEIGHT / 2 - BALL_RADIUS_PX - 1);

    this.ballBody = this.world.createDynamicBody({
      position: planck.Vec2(cx, cy),
      bullet: true, // CCD — prevents tunneling
      fixedRotation: true,
      linearDamping: 0,
    });

    this.ballBody.createFixture({
      shape: new planck.Circle(BALL_RADIUS),
      density: 1,
      friction: 0,
      restitution: 1, // perfectly elastic for wall/brick bounces
      filterCategoryBits: CAT_BALL,
      filterMaskBits:
        CAT_WALL | CAT_BRICK | CAT_PADDLE | CAT_DRAIN | CAT_CEILING,
      userData: { kind: "ball" } as BallUserData,
    });

    // Launch upward with a slight random angle
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.4; // roughly upward
    const speed = this.getCurrentSpeed();
    this.ballBody.setLinearVelocity(
      planck.Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
    );
  }

  /** Install the Planck contact listener */
  private installContactListener(): void {
    // ── begin-contact: detect collisions ──
    this.world.on("begin-contact", (contact: planck.Contact) => {
      const fA = contact.getFixtureA();
      const fB = contact.getFixtureB();
      const udA = fA.getUserData() as FixtureUserData | null;
      const udB = fB.getUserData() as FixtureUserData | null;
      if (!udA || !udB) return;

      // Identify ball vs other
      let otherUd: FixtureUserData | null = null;

      if (udA.kind === "ball") {
        otherUd = udB;
      } else if (udB.kind === "ball") {
        otherUd = udA;
      }

      if (!otherUd) return;

      switch (otherUd.kind) {
        case "brick":
          this.onBallHitBrick(otherUd.brickId, contact);
          break;
        case "drain":
          this.onBallHitDrain();
          break;
        case "ceiling":
          this.onBallHitCeiling();
          break;
        case "wall":
          // nothing special — Planck handles the bounce
          break;
        case "paddle":
          // bounce handled in pre-solve
          break;
      }
    });

    // ── pre-solve: custom paddle bounce angle ──
    this.world.on("pre-solve", (contact: planck.Contact) => {
      const fA = contact.getFixtureA();
      const fB = contact.getFixtureB();
      const udA = fA.getUserData() as FixtureUserData | null;
      const udB = fB.getUserData() as FixtureUserData | null;
      if (!udA || !udB) return;

      const isPaddleBall =
        (udA.kind === "paddle" && udB.kind === "ball") ||
        (udA.kind === "ball" && udB.kind === "paddle");

      if (isPaddleBall) {
        // Disable Planck's default bounce response
        contact.setEnabled(false);

        // Apply custom bounce
        this.applyPaddleBounce();
      }
    });
  }

  // =========================================================================
  // Contact Handlers
  // =========================================================================

  private onBallHitBrick(brickId: number, contact: planck.Contact): void {
    // Skip already-queued bricks
    if (this.destroyedBrickIds.has(brickId)) return;

    // De-dup: one hit per brick per step
    if (this.hitThisStep.has(brickId)) return;
    this.hitThisStep.add(brickId);

    const entry = this.bricks.get(brickId);
    if (!entry || !entry.brick.alive) return;

    // Increment hit counter
    this._totalBrickHits++;

    // Record debug collision point
    const wm = contact.getWorldManifold(null);
    if (wm && wm.points && wm.points.length > 0) {
      const pt = wm.points[0];
      this.debugCollisions.push({
        x: pt.x * SCALE,
        y: pt.y * SCALE,
        t: Date.now(),
      });
      if (this.debugCollisions.length > BreakoutEngine.MAX_DEBUG_POINTS) {
        this.debugCollisions.splice(
          0,
          this.debugCollisions.length - BreakoutEngine.MAX_DEBUG_POINTS,
        );
      }
    }

    // Score
    this._score += entry.brick.points;

    // Check color-based speed tier triggers (one-shot)
    if (entry.brick.color === "orange" && !this._speedFlags.tierOrangeContact) {
      this._speedFlags.tierOrangeContact = true;
      this.recalcSpeedTier();
    }
    if (entry.brick.color === "red" && !this._speedFlags.tierRedContact) {
      this._speedFlags.tierRedContact = true;
      this._hasBreakthroughRed = true;
      this.recalcSpeedTier();
    }

    // Check hit-count speed tier triggers
    if (
      this._totalBrickHits >= SPEED_TIER_HIT_4 &&
      !this._speedFlags.tier4Hits
    ) {
      this._speedFlags.tier4Hits = true;
      this.recalcSpeedTier();
    }
    if (
      this._totalBrickHits >= SPEED_TIER_HIT_12 &&
      !this._speedFlags.tier12Hits
    ) {
      this._speedFlags.tier12Hits = true;
      this.recalcSpeedTier();
    }

    // Mark brick for destruction
    entry.brick.alive = false;
    this.destroyedBrickIds.add(brickId);
    this._bricksDestroyed++;
    this._bricksChanged = true;

    this.cb.onBrickHit?.(brickId);
    this.cb.onBrickDestroyed?.(brickId, entry.brick.color);

    // Check wall cleared
    if (this.allBricksDestroyed()) {
      this.handleWallCleared();
    }
  }

  private onBallHitDrain(): void {
    if (this._ballLost) return; // already processing
    this._ballLost = true;
    this.handleBallLost();
  }

  private onBallHitCeiling(): void {
    // Paddle shrink trigger: ball has touched red AND now hit ceiling
    if (this._hasBreakthroughRed && !this._paddleShrunk) {
      this._paddleShrunk = true;
      this._paddleWidth = PADDLE_SHRUNK_WIDTH;
      this.rebuildPaddleFixture();
      this.syncPaddleBody();
      this.cb.onPaddleShrink?.();
    }
  }

  // =========================================================================
  // Paddle Bounce
  // =========================================================================

  /** Custom paddle bounce: set ball velocity based on hit offset */
  private applyPaddleBounce(): void {
    if (!this.ballBody) return;

    const ballPos = this.ballBody.getPosition();
    const paddlePos = this.paddleBody.getPosition();

    // Offset from paddle center: -1 (left edge) to +1 (right edge)
    const halfW = px2m(this._paddleWidth / 2);
    const offset = clamp((ballPos.x - paddlePos.x) / halfW, -1, 1);

    // Map offset to angle from vertical
    // offset= -1 → angle= -MAX_BOUNCE_ANGLE (left)
    // offset=  0 → angle=  0 (straight up)
    // offset= +1 → angle= +MAX_BOUNCE_ANGLE (right)
    let angle = offset * MAX_BOUNCE_ANGLE;

    // Clamp to prevent near-horizontal shots
    // angle is from vertical (Y-up), so |angle| near PI/2 = horizontal
    const maxAngle = Math.PI / 2 - MIN_ANGLE_FROM_HORIZONTAL;
    angle = clamp(angle, -maxAngle, maxAngle);

    // Convert to velocity: angle=0 → straight up, positive → right
    const speed = this.getCurrentSpeed();
    const vx = speed * Math.sin(angle);
    const vy = -speed * Math.cos(angle); // negative = up in Planck coords

    this.ballBody.setLinearVelocity(planck.Vec2(vx, vy));

    // Also nudge ball above paddle to prevent re-collision
    const safeY = paddlePos.y - px2m(PADDLE_HEIGHT / 2) - BALL_RADIUS - 0.01;
    if (ballPos.y > safeY) {
      this.ballBody.setPosition(planck.Vec2(ballPos.x, safeY));
    }
  }

  // =========================================================================
  // Speed Tier System
  // =========================================================================

  /** Recalculate speed tier based on flags */
  private recalcSpeedTier(): void {
    let tier = 0;
    if (this._speedFlags.tier4Hits) tier = 1;
    if (this._speedFlags.tier12Hits) tier = Math.max(tier, 2);
    if (this._speedFlags.tierOrangeContact) tier = Math.max(tier, 3);
    if (this._speedFlags.tierRedContact) tier = Math.max(tier, 4);

    if (tier !== this._currentSpeedTier) {
      this._currentSpeedTier = tier;
      this._maxSpeedTier = Math.max(this._maxSpeedTier, tier);
      this.cb.onSpeedTierChanged?.(tier);

      // Immediately update ball speed
      if (this.ballBody) {
        this.enforceSpeed();
      }
    }
  }

  /** Get current ball speed in m/s based on speed tier */
  private getCurrentSpeed(): number {
    const tierIdx = clamp(this._currentSpeedTier, 0, SPEED_TIERS.length - 1);
    // BALL_BASE_SPEED is already in m/s — do NOT convert with px2m()
    return BALL_BASE_SPEED * SPEED_TIERS[tierIdx].multiplier;
  }

  /** Enforce ball speed magnitude to match current tier (prevent float drift) */
  private enforceSpeed(): void {
    if (!this.ballBody) return;

    const vel = this.ballBody.getLinearVelocity();
    const currentMag = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    if (currentMag < 0.001) return; // avoid division by zero

    const targetSpeed = this.getCurrentSpeed();
    const scale = targetSpeed / currentMag;
    this.ballBody.setLinearVelocity(planck.Vec2(vel.x * scale, vel.y * scale));
  }

  // =========================================================================
  // Life & Wall Management
  // =========================================================================

  /** Handle ball falling into drain */
  private handleBallLost(): void {
    // Destroy the ball body
    if (this.ballBody) {
      this.world.destroyBody(this.ballBody);
      this.ballBody = null;
    }

    this._lives--;
    this.cb.onLifeLost?.(this._lives);

    if (this._lives <= 0) {
      this._phase = "gameOver";
      const result = this.buildResult("lose");
      this.emitStateChanged();
      this.cb.onGameOver?.(result);
    } else {
      // Reset paddle to full size for next serve
      this._paddleShrunk = false;
      this._hasBreakthroughRed = false;
      this._paddleWidth = PADDLE_WIDTH;
      this.rebuildPaddleFixture();
      this.syncPaddleBody();

      // Brief pause then serve
      this._phase = "lifeLost";
      this.emitStateChanged();

      this._transitionTimer = setTimeout(() => {
        if (this._phase === "lifeLost") {
          this._phase = "serving";
          this.emitStateChanged();
        }
      }, 1000);
    }
  }

  /** Handle all bricks in current wall destroyed */
  private handleWallCleared(): void {
    // Destroy ball
    if (this.ballBody) {
      this.world.destroyBody(this.ballBody);
      this.ballBody = null;
    }

    this.cb.onWallCleared?.(this._wall);

    if (this._wall >= TOTAL_WALLS) {
      // Victory! Both walls cleared
      this._phase = "victory";
      const result = this.buildResult("win");
      this.emitStateChanged();
      this.cb.onVictory?.(result);
    } else {
      // Next wall
      this._phase = "wallCleared";
      this.emitStateChanged();

      this._transitionTimer = setTimeout(() => {
        if (this._phase === "wallCleared") {
          this._wall++;
          // Note: speed tier flags persist across walls (cumulative hits)
          // Paddle shrink resets (per arcade behavior, resets per life but persists across walls)
          this.spawnWall();
          this.updateBrickSnapshot();
          this._phase = "serving";
          this.emitStateChanged();
        }
      }, 1500);
    }
  }

  // =========================================================================
  // Brick Spawning
  // =========================================================================

  /**
   * Spawn a full wall of bricks.
   * 8 rows × 14 cols. Bottom row = row 0 (yellow), top row = row 7 (red).
   * In pixel space, row 7 is at the top of the brick area, row 0 at the bottom.
   */
  private spawnWall(): void {
    // Clear existing bricks
    for (const [, entry] of this.bricks) {
      this.world.destroyBody(entry.body);
    }
    this.bricks.clear();
    this.destroyedBrickIds.clear();

    for (let row = 0; row < BRICK_ROWS; row++) {
      const rowDef = ROW_DEFS[row];

      for (let col = 0; col < BRICK_COLS; col++) {
        const id = this.uid();

        // Position: row 7 (red) at top, row 0 (yellow) at bottom of brick area
        // In screen coords, lower row index = lower on screen
        const visualRow = BRICK_ROWS - 1 - row; // flip: row 0 → bottom visually
        const brickX = col * BRICK_WIDTH + BRICK_WIDTH / 2;
        const brickY =
          BRICK_TOP_OFFSET + visualRow * BRICK_HEIGHT + BRICK_HEIGHT / 2;

        const cx = px2m(brickX);
        const cy = px2m(brickY);
        const halfW = px2m((BRICK_WIDTH - BRICK_PADDING * 2) / 2);
        const halfH = px2m((BRICK_HEIGHT - BRICK_PADDING * 2) / 2);

        const body = this.world.createBody({
          type: "static",
          position: planck.Vec2(cx, cy),
        });
        body.createFixture({
          shape: planck.Box(halfW, halfH),
          friction: 0,
          restitution: 1,
          filterCategoryBits: CAT_BRICK,
          filterMaskBits: CAT_BALL,
          userData: { kind: "brick", brickId: id } as BrickUserData,
        });

        const brick: BreakoutBrick = {
          id,
          row,
          col,
          color: rowDef.color,
          points: rowDef.points,
          alive: true,
        };

        this.bricks.set(id, { brick, body });
      }
    }
  }

  // =========================================================================
  // Deferred Processing
  // =========================================================================

  /** Destroy bodies that were marked during contact callbacks */
  private processDeferred(): void {
    for (const brickId of this.destroyedBrickIds) {
      const entry = this.bricks.get(brickId);
      if (entry) {
        this.world.destroyBody(entry.body);
        // Keep the brick in the map for snapshot (alive=false) but
        // we don't need the body anymore. Set body ref to invalidate.
        entry.body = null as unknown as planck.Body;
      }
    }
    this.destroyedBrickIds.clear();
  }

  // =========================================================================
  // State Helpers
  // =========================================================================

  /** Check if all bricks in current wall are destroyed */
  private allBricksDestroyed(): boolean {
    for (const [, entry] of this.bricks) {
      if (entry.brick.alive) return false;
    }
    return true;
  }

  /** Update the snapshot brick array from the map */
  private updateBrickSnapshot(): void {
    this._brickSnapshot = [];
    for (const [, entry] of this.bricks) {
      this._brickSnapshot.push({ ...entry.brick });
    }
  }

  /** Emit state changed callback */
  private emitStateChanged(): void {
    this.cb.onStateChanged?.(this.snapshot);
  }

  /** Reset game state without destroying world infrastructure */
  private resetGameState(): void {
    if (this._transitionTimer) clearTimeout(this._transitionTimer);

    // Destroy ball
    if (this.ballBody) {
      this.world.destroyBody(this.ballBody);
      this.ballBody = null;
    }

    // Destroy bricks
    for (const [, entry] of this.bricks) {
      if (entry.body) {
        this.world.destroyBody(entry.body);
      }
    }
    this.bricks.clear();
    this._brickSnapshot = [];
    this.destroyedBrickIds.clear();
    this.hitThisStep.clear();
    this.debugCollisions = [];
  }

  /** Build the game result object */
  private buildResult(outcome: "win" | "lose"): BreakoutResult {
    const stats: BreakoutGameStats = {
      gameType: "brick_breaker",
      wallsCleared:
        this._wall >= TOTAL_WALLS && outcome === "win"
          ? TOTAL_WALLS
          : this._wall - 1,
      bricksDestroyed: this._bricksDestroyed,
      maxSpeedTier: this._maxSpeedTier,
      paddleShrinkTriggered: this._paddleShrunk,
      livesRemaining: this._lives,
    };

    return {
      score: this._score,
      isNewBest: this._score > this._bestScore,
      stats,
      outcome,
    };
  }
}
