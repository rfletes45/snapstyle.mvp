/**
 * BounceBlitz 2.0 — Core Physics Engine
 *
 * Uses Planck.js (Box2D) for reliable collision detection with CCD (bullet mode).
 * This module is framework-agnostic — no React dependency.
 *
 * Architecture:
 *   - Planck.js world with static walls, static bricks, dynamic balls
 *   - Balls use `bullet: true` for continuous collision detection (no tunneling)
 *   - Floor is a sensor (detect return without bouncing)
 *   - Pickups are sensors (collect without bouncing)
 *   - Contact listener handles brick HP decrement + pickup collection
 *   - Fixed timestep stepped externally via `step()`
 */

import * as planck from "planck";

import {
  BALL_RADIUS,
  BALL_SPEED,
  BALL_STAGGER_MS,
  BRICK_PADDING,
  CAT_BALL,
  CAT_BRICK,
  CAT_FLOOR,
  CAT_PICKUP,
  CAT_WALL,
  CELL_SIZE,
  COLS,
  FLOOR_Y_PX,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_BRICKS_PER_ROW,
  MAX_PICKUPS_PER_ROW,
  MIN_BRICKS_PER_ROW,
  PHYSICS_DT,
  PICKUP_CHANCE,
  POSITION_ITERATIONS,
  ROWS,
  SCALE,
  SHOOTING_TIMEOUT_MS,
  VELOCITY_ITERATIONS,
  px2m,
} from "./BounceBlitzConfig";

import type {
  BallState,
  BounceBlitzCallbacks,
  BounceBlitzGameStats,
  BounceBlitzResult,
  BounceBlitzSnapshot,
  Brick,
  TurnPhase,
} from "./BounceBlitzTypes";

// =============================================================================
// Helpers
// =============================================================================

/** Clamp value between min and max */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// =============================================================================
// User-data tags for Planck.js fixtures
// =============================================================================

interface WallUserData {
  kind: "wall";
}
interface BrickUserData {
  kind: "brick";
  brickId: number;
}
interface PickupUserData {
  kind: "pickup";
  brickId: number; // re-uses brick ID for the pickup entity
}
interface FloorUserData {
  kind: "floor";
}
interface BallUserData {
  kind: "ball";
  ballId: number;
}

type FixtureUserData =
  | WallUserData
  | BrickUserData
  | PickupUserData
  | FloorUserData
  | BallUserData;

// =============================================================================
// Engine
// =============================================================================

export class BounceBlitzEngine {
  // ── Planck world ──
  private world: planck.World;

  // ── Instance ID counter (avoids stale global) ──
  private _nextId = 1;
  private uid(): number {
    return this._nextId++;
  }

  // ── Game state ──
  private _phase: TurnPhase = "idle";
  private _level = 0;
  private _ballCount = 1; // total balls the player has
  private _ballsInFlight = 0; // balls actually launched this turn (not increased by pickups)
  private _launchX: number; // px
  private _bestScore = 0;
  private _speedMultiplier = 1;

  // ── Per-turn tracking ──
  private _ballsReturned = 0;
  private _firstReturnX: number | null = null;
  private _allBallsFired = false;
  private _safetyTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Deterministic ball launch state (driven by step()) ──
  private _launchDirX = 0;
  private _launchDirY = 0;
  private _launchStartX = 0;
  private _launchStartY = 0;
  private _ballsFired = 0;
  private _launchAccumMs = 0; // accumulated time for stagger

  // ── Lifetime stats ──
  private _totalBricksDestroyed = 0;
  private _totalBounces = 0;
  private _peakBallCount = 1;

  // ── Entity bookkeeping ──
  private bricks: Map<number, { brick: Brick; body: planck.Body }> = new Map();
  private ballBodies: Map<number, { ball: BallState; body: planck.Body }> =
    new Map();
  private _brickSnapshot: Brick[] = [];

  // ── Physics boundaries ──
  private wallBodies: planck.Body[] = [];
  private floorBody!: planck.Body;

  // ── Callbacks ──
  private cb: Partial<BounceBlitzCallbacks> = {};

  // ── Deferred destruction sets (applied after world step) ──
  private destroyedBrickIds: Set<number> = new Set();
  private collectedPickupIds: Set<number> = new Set();
  private returnedBallIds: Set<number> = new Set();

  // ── Contact tracking to prevent double-hits in the same step ──
  private hitThisStep: Set<string> = new Set(); // "ballId:brickId"

  // ── Debug ──
  debugCollisions: { x: number; y: number; t: number }[] = [];

  /** Max debug collision points to retain (prevents unbounded growth) */
  private static readonly MAX_DEBUG_POINTS = 100;

  constructor() {
    // Zero-gravity world
    this.world = new planck.World({ gravity: planck.Vec2(0, 0) });
    this._launchX = GAME_WIDTH / 2;

    this.createBoundaries();
    this.installContactListener();
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /** Register event callbacks */
  on(callbacks: Partial<BounceBlitzCallbacks>): void {
    this.cb = { ...this.cb, ...callbacks };
  }

  /** Get a read-only snapshot of current state (for rendering) */
  get snapshot(): BounceBlitzSnapshot {
    const balls: BallState[] = [];
    this.ballBodies.forEach(({ ball, body }) => {
      const pos = body.getPosition();
      balls.push({
        ...ball,
        x: pos.x * SCALE,
        y: pos.y * SCALE,
      });
    });

    return {
      phase: this._phase,
      level: this._level,
      score: this._level,
      ballCount: this._ballCount,
      ballsReturned: this._ballsReturned,
      bricks: this._brickSnapshot,
      balls,
      launchX: this._launchX,
      aimAngle: null, // managed externally
      speedMultiplier: this._speedMultiplier,
      bestScore: this._bestScore,
    };
  }

  get phase(): TurnPhase {
    return this._phase;
  }
  get level(): number {
    return this._level;
  }
  get score(): number {
    return this._level;
  }
  get ballCount(): number {
    return this._ballCount;
  }
  get launchX(): number {
    return this._launchX;
  }
  get bestScore(): number {
    return this._bestScore;
  }
  get speedMultiplier(): number {
    return this._speedMultiplier;
  }

  set bestScore(v: number) {
    this._bestScore = v;
  }

  /** Start a new game from scratch */
  startGame(): void {
    this.resetState();
    this._phase = "aiming";
    this._level = 1;
    this._ballCount = 1;
    this._peakBallCount = 1;
    this._launchX = GAME_WIDTH / 2;
    this._totalBricksDestroyed = 0;
    this._totalBounces = 0;
    this._speedMultiplier = 1;

    // Spawn initial row
    this.spawnRow(1);
    this.updateBrickSnapshot();
    this.emitStateChanged();
  }

  /** Fire balls at the given angle (radians, screen coords: 0=right, -PI/2=up) */
  shoot(angleRad: number): void {
    if (this._phase !== "aiming") return;

    this._phase = "shooting";
    this._ballsReturned = 0;
    this._ballsInFlight = 0;
    this._firstReturnX = null;
    this._allBallsFired = false;
    this._ballsFired = 0;
    this._launchAccumMs = 0;
    this.hitThisStep.clear();

    // Direction vector
    this._launchDirX = Math.cos(angleRad);
    this._launchDirY = Math.sin(angleRad);
    this._launchStartX = px2m(this._launchX);
    this._launchStartY = px2m(FLOOR_Y_PX - BALL_RADIUS * SCALE - 2);

    // Fire the first ball immediately
    this.launchOneBall();

    // Safety timeout (only in non-test environments)
    this._safetyTimer = setTimeout(() => {
      if (this._phase === "shooting") {
        this.forceEndTurn();
      }
    }, SHOOTING_TIMEOUT_MS);

    this.emitStateChanged();
  }

  /** Launch a single ball into the physics world */
  private launchOneBall(): void {
    if (this._ballsFired >= this._ballCount) {
      this._allBallsFired = true;
      return;
    }

    const ballId = this.uid();
    const body = this.world.createDynamicBody({
      position: planck.Vec2(this._launchStartX, this._launchStartY),
      bullet: true, // CCD — prevents tunneling
      fixedRotation: true,
      linearDamping: 0,
    });

    body.createFixture({
      shape: new planck.Circle(BALL_RADIUS),
      density: 1,
      friction: 0,
      restitution: 1, // perfectly elastic
      filterCategoryBits: CAT_BALL,
      filterMaskBits: CAT_WALL | CAT_BRICK | CAT_FLOOR | CAT_PICKUP,
      userData: { kind: "ball", ballId } as BallUserData,
    });

    body.setLinearVelocity(
      planck.Vec2(this._launchDirX * BALL_SPEED, this._launchDirY * BALL_SPEED),
    );

    const ball: BallState = {
      id: ballId,
      x: this._launchStartX * SCALE,
      y: this._launchStartY * SCALE,
      active: true,
      returned: false,
    };
    this.ballBodies.set(ballId, { ball, body });
    this._ballsFired++;
    this._ballsInFlight++;

    // Check if all balls are now fired
    if (this._ballsFired >= this._ballCount) {
      this._allBallsFired = true;
    }
  }

  /** Toggle speed 1x ↔ 2x */
  toggleSpeed(): void {
    this._speedMultiplier = this._speedMultiplier === 1 ? 2 : 1;
  }

  /**
   * Step the physics world forward by one frame.
   * Call this from requestAnimationFrame.
   * Returns true if a render update is needed.
   */
  step(): boolean {
    if (this._phase !== "shooting") return false;

    // Clear per-step hit tracking
    this.hitThisStep.clear();

    // ── Deterministic ball launch: stagger balls based on elapsed time ──
    const staggerMs = BALL_STAGGER_MS / this._speedMultiplier;
    this._launchAccumMs += PHYSICS_DT * 1000 * this._speedMultiplier;
    while (
      !this._allBallsFired &&
      this._launchAccumMs >= staggerMs &&
      this._ballsFired < this._ballCount
    ) {
      this._launchAccumMs -= staggerMs;
      this.launchOneBall();
    }

    // Step physics (multiple sub-steps for speed multiplier)
    const steps = this._speedMultiplier;
    for (let i = 0; i < steps; i++) {
      this.world.step(PHYSICS_DT, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
    }

    // Process deferred destructions
    this.processDeferred();

    // Belt-and-suspenders: position-based floor detection
    // Catches any ball that slipped past the sensor without triggering contact
    const floorY = px2m(FLOOR_Y_PX);
    this.ballBodies.forEach(({ ball }, ballId) => {
      if (!ball.active || ball.returned) return;
      const entry = this.ballBodies.get(ballId);
      if (!entry) return;
      const pos = entry.body.getPosition();
      if (pos.y >= floorY) {
        this.onBallHitFloor(ballId);
      }
    });

    // Process any newly returned balls from position check
    if (this.returnedBallIds.size > 0) {
      this.processDeferred();
    }

    // Check if all balls returned — compare against balls actually in flight,
    // NOT _ballCount (which can increase mid-turn via pickups)
    if (this._allBallsFired && this._ballsReturned >= this._ballsInFlight) {
      this.endTurn();
    }

    this.updateBrickSnapshot();
    this.emitStateChanged();
    return true;
  }

  /** Clean up all physics resources */
  destroy(): void {
    if (this._safetyTimer) clearTimeout(this._safetyTimer);

    // Destroy all bodies
    let body = this.world.getBodyList();
    while (body) {
      const next = body.getNext();
      this.world.destroyBody(body);
      body = next;
    }

    this.bricks.clear();
    this.ballBodies.clear();
    this.wallBodies = [];
  }

  // =========================================================================
  // Internals — World Setup
  // =========================================================================

  /** Create static wall boundaries + floor sensor */
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

    // Ceiling
    const ceiling = this.world.createBody({
      type: "static",
      position: planck.Vec2(w / 2, 0),
    });
    ceiling.createFixture({
      shape: planck.Edge(planck.Vec2(-w / 2, 0), planck.Vec2(w / 2, 0)),
      friction: 0,
      restitution: 1,
      filterCategoryBits: CAT_WALL,
      filterMaskBits: CAT_BALL,
      userData: { kind: "wall" } as WallUserData,
    });
    this.wallBodies.push(ceiling);

    // Floor sensor — thick box instead of thin edge
    // (Sensors don't participate in CCD, so a fat sensor prevents missed contacts)
    const FLOOR_SENSOR_HEIGHT = 2; // 2 meters thick
    this.floorBody = this.world.createBody({
      type: "static",
      position: planck.Vec2(w / 2, h + FLOOR_SENSOR_HEIGHT / 2),
    });
    this.floorBody.createFixture({
      shape: planck.Box(w / 2, FLOOR_SENSOR_HEIGHT / 2),
      isSensor: true,
      filterCategoryBits: CAT_FLOOR,
      filterMaskBits: CAT_BALL,
      userData: { kind: "floor" } as FloorUserData,
    });
  }

  /** Install contact listener for all collision events */
  private installContactListener(): void {
    this.world.on("begin-contact", (contact: planck.Contact) => {
      const fA = contact.getFixtureA();
      const fB = contact.getFixtureB();
      const udA = fA.getUserData() as FixtureUserData | null;
      const udB = fB.getUserData() as FixtureUserData | null;
      if (!udA || !udB) return;

      // Identify ball vs other
      let ballUd: BallUserData | null = null;
      let otherUd: FixtureUserData | null = null;
      let ballFixture: planck.Fixture | null = null;

      if (udA.kind === "ball") {
        ballUd = udA;
        otherUd = udB;
        ballFixture = fA;
      } else if (udB.kind === "ball") {
        ballUd = udB;
        otherUd = udA;
        ballFixture = fB;
      }

      if (!ballUd || !otherUd || !ballFixture) return;

      switch (otherUd.kind) {
        case "brick":
          this.onBallHitBrick(ballUd.ballId, otherUd.brickId, contact);
          break;
        case "pickup":
          this.onBallHitPickup(ballUd.ballId, otherUd.brickId);
          break;
        case "floor":
          this.onBallHitFloor(ballUd.ballId);
          break;
        case "wall":
          this._totalBounces++;
          break;
      }
    });

    // Also count brick bounces
    this.world.on("pre-solve", (contact: planck.Contact) => {
      const fA = contact.getFixtureA();
      const fB = contact.getFixtureB();
      const udA = fA.getUserData() as FixtureUserData | null;
      const udB = fB.getUserData() as FixtureUserData | null;
      if (!udA || !udB) return;

      // For pickups, disable the contact so the ball passes through
      if (
        (udA.kind === "pickup" && udB.kind === "ball") ||
        (udA.kind === "ball" && udB.kind === "pickup")
      ) {
        contact.setEnabled(false);
      }
    });
  }

  // =========================================================================
  // Contact Handlers
  // =========================================================================

  private onBallHitBrick(
    ballId: number,
    brickId: number,
    contact: planck.Contact,
  ): void {
    // Skip bricks already queued for destruction (prevents double-destroy from multi-ball)
    if (this.destroyedBrickIds.has(brickId)) return;

    // Prevent double-hit in same step (same ball + same brick)
    const key = `${ballId}:${brickId}`;
    if (this.hitThisStep.has(key)) return;
    this.hitThisStep.add(key);

    const entry = this.bricks.get(brickId);
    if (!entry) return;

    entry.brick.hp -= 1;
    this._totalBounces++;

    // Record collision point for debug overlay (capped to prevent unbounded growth)
    const worldManifold = contact.getWorldManifold(null);
    if (
      worldManifold &&
      worldManifold.points &&
      worldManifold.points.length > 0
    ) {
      const pt = worldManifold.points[0];
      this.debugCollisions.push({
        x: pt.x * SCALE,
        y: pt.y * SCALE,
        t: Date.now(),
      });
      if (this.debugCollisions.length > BounceBlitzEngine.MAX_DEBUG_POINTS) {
        this.debugCollisions.splice(
          0,
          this.debugCollisions.length - BounceBlitzEngine.MAX_DEBUG_POINTS,
        );
      }
    }

    if (entry.brick.hp <= 0) {
      this.destroyedBrickIds.add(brickId);
      this._totalBricksDestroyed++;
      this.cb.onBrickDestroyed?.(brickId);
    } else {
      this.cb.onBrickHit?.(brickId, entry.brick.hp);
    }
  }

  private onBallHitPickup(_ballId: number, pickupId: number): void {
    if (this.collectedPickupIds.has(pickupId)) return;
    this.collectedPickupIds.add(pickupId);
    this._ballCount++;
    if (this._ballCount > this._peakBallCount) {
      this._peakBallCount = this._ballCount;
    }
    this.cb.onBallPickup?.();
  }

  private onBallHitFloor(ballId: number): void {
    if (this.returnedBallIds.has(ballId)) return;
    this.returnedBallIds.add(ballId);

    const entry = this.ballBodies.get(ballId);
    if (!entry) return;

    const pos = entry.body.getPosition();
    const px = pos.x * SCALE;
    const isFirst = this._firstReturnX === null;

    if (isFirst) {
      this._firstReturnX = clamp(
        px,
        BALL_RADIUS * SCALE + 2,
        GAME_WIDTH - BALL_RADIUS * SCALE - 2,
      );
    }

    entry.ball.active = false;
    entry.ball.returned = true;
    this._ballsReturned++;

    this.cb.onBallReturned?.(ballId, px, isFirst);
  }

  // =========================================================================
  // Deferred Processing (after world.step)
  // =========================================================================

  private processDeferred(): void {
    // Remove destroyed bricks
    for (const brickId of this.destroyedBrickIds) {
      const entry = this.bricks.get(brickId);
      if (entry) {
        this.world.destroyBody(entry.body);
        this.bricks.delete(brickId);
      }
    }
    this.destroyedBrickIds.clear();

    // Remove collected pickups
    for (const pickupId of this.collectedPickupIds) {
      const entry = this.bricks.get(pickupId);
      if (entry) {
        this.world.destroyBody(entry.body);
        this.bricks.delete(pickupId);
      }
    }
    this.collectedPickupIds.clear();

    // Remove returned balls from physics world
    for (const ballId of this.returnedBallIds) {
      const entry = this.ballBodies.get(ballId);
      if (entry) {
        this.world.destroyBody(entry.body);
        this.ballBodies.delete(ballId);
      }
    }
    this.returnedBallIds.clear();
  }

  // =========================================================================
  // Turn Lifecycle
  // =========================================================================

  /** Called when all balls have returned — advance grid, spawn row, check game over */
  private endTurn(): void {
    // Cancel timers
    if (this._safetyTimer) {
      clearTimeout(this._safetyTimer);
      this._safetyTimer = null;
    }

    // Clean up any remaining ball bodies
    this.ballBodies.forEach(({ body }) => {
      this.world.destroyBody(body);
    });
    this.ballBodies.clear();

    // Update launch X
    if (this._firstReturnX !== null) {
      this._launchX = this._firstReturnX;
    }

    // Advance grid: move all bricks down by 1 row
    this.advanceGrid();

    // Check game over
    let gameOver = false;
    this.bricks.forEach(({ brick }) => {
      if (brick.row >= ROWS) {
        gameOver = true;
      }
    });

    if (gameOver) {
      this.triggerGameOver();
      return;
    }

    // Spawn new row at top
    this._level++;
    this.spawnRow(this._level);

    this._phase = "aiming";
    this._speedMultiplier = 1;
    this.updateBrickSnapshot();
    this.emitStateChanged();
    this.cb.onAllBallsReturned?.();
  }

  /** Safety / user-initiated: force all balls returned and end turn */
  forceEndTurn(): void {
    // Stop launching
    this._allBallsFired = true;

    // Force-return all active balls
    this.ballBodies.forEach(({ ball, body }, ballId) => {
      if (ball.active) {
        const pos = body.getPosition();
        if (this._firstReturnX === null) {
          this._firstReturnX = clamp(
            pos.x * SCALE,
            BALL_RADIUS * SCALE + 2,
            GAME_WIDTH - BALL_RADIUS * SCALE - 2,
          );
        }
        ball.active = false;
        ball.returned = true;
        this._ballsReturned++;
      }
    });

    this.endTurn();
  }

  /** Move all brick bodies down by 1 row */
  private advanceGrid(): void {
    this.bricks.forEach((entry) => {
      entry.brick.row += 1;
      // Update physics body position
      const newX = px2m(entry.brick.col * CELL_SIZE + CELL_SIZE / 2);
      const newY = px2m((entry.brick.row + 0.5) * CELL_SIZE);
      entry.body.setPosition(planck.Vec2(newX, newY));
    });
  }

  /** Trigger game over */
  private triggerGameOver(): void {
    this._phase = "gameOver";

    // Cancel any running timers
    if (this._safetyTimer) {
      clearTimeout(this._safetyTimer);
      this._safetyTimer = null;
    }

    const isNewBest = this._level > this._bestScore;
    if (isNewBest) {
      this._bestScore = this._level;
    }

    const stats: BounceBlitzGameStats = {
      gameType: "bounce_blitz",
      levelReached: this._level,
      blocksDestroyed: this._totalBricksDestroyed,
      ballsLaunched: this._peakBallCount,
      totalBounces: this._totalBounces,
    };

    const result: BounceBlitzResult = {
      score: this._level,
      isNewBest,
      stats,
    };

    this.updateBrickSnapshot();
    this.emitStateChanged();
    this.cb.onGameOver?.(result);
  }

  // =========================================================================
  // Spawning
  // =========================================================================

  /** Spawn a new row of bricks at row 0 */
  private spawnRow(level: number): void {
    // Decide which columns get bricks
    const brickCount =
      MIN_BRICKS_PER_ROW +
      Math.floor(Math.random() * (MAX_BRICKS_PER_ROW - MIN_BRICKS_PER_ROW + 1));
    const columns = this.pickRandomColumns(brickCount);

    // Determine which empty columns get pickups
    const emptyColumns = [];
    for (let c = 0; c < COLS; c++) {
      if (!columns.includes(c)) emptyColumns.push(c);
    }
    const pickupColumns: number[] = [];
    for (const col of emptyColumns) {
      if (pickupColumns.length >= MAX_PICKUPS_PER_ROW) break;
      if (Math.random() < PICKUP_CHANCE) {
        pickupColumns.push(col);
      }
    }

    // Spawn bricks
    for (const col of columns) {
      const hp = Math.max(1, level + Math.floor(Math.random() * 3) - 1);
      this.createBrick(0, col, hp, "normal");
    }

    // Spawn pickups
    for (const col of pickupColumns) {
      this.createBrick(0, col, 1, "extra_ball");
    }
  }

  /** Create a brick (or pickup) in the physics world */
  private createBrick(
    row: number,
    col: number,
    hp: number,
    type: "normal" | "extra_ball",
  ): void {
    const id = this.uid();
    const cx = px2m(col * CELL_SIZE + CELL_SIZE / 2);
    const cy = px2m((row + 0.5) * CELL_SIZE);
    const halfW = px2m((CELL_SIZE - BRICK_PADDING * 2) / 2);
    const halfH = px2m((CELL_SIZE - BRICK_PADDING * 2) / 2);

    const body = this.world.createBody({
      type: "static",
      position: planck.Vec2(cx, cy),
    });

    if (type === "extra_ball") {
      // Pickup: circle sensor — collision disabled via pre-solve
      const radius = px2m(CELL_SIZE / 2 - BRICK_PADDING);
      body.createFixture({
        shape: new planck.Circle(radius),
        isSensor: true,
        filterCategoryBits: CAT_PICKUP,
        filterMaskBits: CAT_BALL,
        userData: { kind: "pickup", brickId: id } as PickupUserData,
      });
    } else {
      // Brick: solid rectangle
      body.createFixture({
        shape: planck.Box(halfW, halfH),
        friction: 0,
        restitution: 1,
        filterCategoryBits: CAT_BRICK,
        filterMaskBits: CAT_BALL,
        userData: { kind: "brick", brickId: id } as BrickUserData,
      });
    }

    const brick: Brick = { id, row, col, hp, type };
    this.bricks.set(id, { brick, body });
  }

  /** Pick `count` unique random columns from 0..COLS-1 */
  private pickRandomColumns(count: number): number[] {
    const all = Array.from({ length: COLS }, (_, i) => i);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, count);
  }

  // =========================================================================
  // State Reset
  // =========================================================================

  /** Remove all bricks and balls from the world */
  private resetState(): void {
    // Cancel timers
    if (this._safetyTimer) {
      clearTimeout(this._safetyTimer);
      this._safetyTimer = null;
    }

    // Destroy all brick bodies
    this.bricks.forEach(({ body }) => {
      this.world.destroyBody(body);
    });
    this.bricks.clear();

    // Destroy all ball bodies
    this.ballBodies.forEach(({ body }) => {
      this.world.destroyBody(body);
    });
    this.ballBodies.clear();

    this.destroyedBrickIds.clear();
    this.collectedPickupIds.clear();
    this.returnedBallIds.clear();
    this._brickSnapshot = [];
    this._nextId = 1;
  }

  // =========================================================================
  // Snapshot
  // =========================================================================

  private updateBrickSnapshot(): void {
    this._brickSnapshot = [];
    this.bricks.forEach(({ brick }) => {
      this._brickSnapshot.push({ ...brick });
    });
  }

  private emitStateChanged(): void {
    this.cb.onStateChanged?.(this.snapshot);
  }
}
