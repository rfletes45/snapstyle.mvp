/**
 * Brick Breaker — Simulation Core (Planck / Box2D)
 *
 * Deterministic physics simulation that runs identically on client (RN) and
 * server (Cloud Functions / Node). Uses fixed timestep and seeded RNG.
 *
 * API:
 *   createLevelSim()  — build a Planck world for one level
 *   stepLevelSim()    — advance one fixed-dt tick
 *   replayRun()       — replay an entire run from input samples
 *
 * @module gamesV4/games/brickBreaker/simCore
 */

import * as planck from "planck";
import { LEVEL_PACK } from "./levels";
import { createRng, weightedPick, type SeededRng } from "./rng";
import type {
  CampaignStats,
  InputSample,
  LevelDef,
  PowerupKind,
} from "./types";
import {
  ACTION_LAUNCH,
  BRICK_DEFS,
  POWERUP_POOL,
  POWERUP_WEIGHTS,
  SIM,
} from "./types";

const { Vec2 } = planck;

// =============================================================================
// Entity userData tags
// =============================================================================

interface BallUD {
  tag: "ball";
  id: number;
}
interface PaddleUD {
  tag: "paddle";
}
interface BrickUD {
  tag: "brick";
  key: string;
  col: number;
  row: number;
  brickType: string;
}
interface WallUD {
  tag: "wall";
}
interface DeathUD {
  tag: "death";
}
interface PowerupUD {
  tag: "powerup";
  id: number;
  kind: PowerupKind;
}
interface ShieldUD {
  tag: "shield";
}
interface LaserUD {
  tag: "laser";
  id: number;
}

type EntityUD =
  | BallUD
  | PaddleUD
  | BrickUD
  | WallUD
  | DeathUD
  | PowerupUD
  | ShieldUD
  | LaserUD;

function getUD(body: planck.Body): EntityUD | null {
  return body.getUserData() as EntityUD | null;
}

// =============================================================================
// Level Simulation State
// =============================================================================

export interface BrickState {
  body: planck.Body;
  hp: number;
  brickType: string;
  col: number;
  row: number;
  originX: number;
}

export interface LevelSim {
  world: planck.World;
  paddle: planck.Body;
  balls: Map<number, planck.Body>;
  bricks: Map<string, BrickState>;
  powerupBodies: Map<number, { body: planck.Body; kind: PowerupKind }>;
  shieldBody: planck.Body | null;
  laserBodies: Map<number, planck.Body>;

  levelDef: LevelDef;
  rng: SeededRng;
  baseBallSpeed: number;
  paddleHW: number;

  tick: number;
  serving: boolean;
  lives: number;
  score: number;
  combo: number;
  maxCombo: number;
  bricksDestroyed: number;
  breakableRemaining: number;
  powerupsUsed: number;
  explosionKills: number;
  laserKills: number;
  maxBallsAtOnce: number;
  missedThisLevel: boolean;
  levelCleared: boolean;
  runOver: boolean;

  activePowerups: Map<PowerupKind, number>; // kind → expiry tick
  laserShotsRemaining: number;
  lastLaserTick: number;
  stickyBall: boolean;
  stickyOffset: number;

  nextBallId: number;
  nextPowerupId: number;
  nextLaserId: number;

  // Deferred contact actions
  _pendingBrickHits: Array<{ key: string }>;
  _pendingBallLoss: number[];
  _pendingPowerupCollect: Array<{ id: number; byPaddle: boolean }>;
  _pendingLaserHits: Array<{ laserId: number; brickKey: string }>;
  _pendingShieldHit: boolean;
  _pendingPaddleHit: number | null; // ballId that hit paddle
}

// =============================================================================
// Renderable snapshot (used by UI)
// =============================================================================

export interface RenderBall {
  id: number;
  x: number;
  y: number;
}
export interface RenderBrick {
  key: string;
  col: number;
  row: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  brickType: string;
}
export interface RenderPowerup {
  id: number;
  x: number;
  y: number;
  kind: PowerupKind;
}

export interface RenderState {
  balls: RenderBall[];
  paddleX: number;
  paddleHW: number;
  bricks: RenderBrick[];
  powerups: RenderPowerup[];
  hasShield: boolean;
  activePowerups: PowerupKind[];
  serving: boolean;
  lives: number;
  score: number;
  combo: number;
  levelId: number;
  levelName: string;
  levelCleared: boolean;
  runOver: boolean;
}

// =============================================================================
// Create Level Simulation
// =============================================================================

export function createLevelSim(
  levelDef: LevelDef,
  seed: number,
  lives: number,
  carryStats?: Partial<
    Pick<
      LevelSim,
      | "score"
      | "combo"
      | "maxCombo"
      | "bricksDestroyed"
      | "powerupsUsed"
      | "explosionKills"
      | "laserKills"
      | "maxBallsAtOnce"
      | "missedThisLevel"
    >
  >,
): LevelSim {
  const world = new planck.World(Vec2(0, 0));

  const rng = createRng(seed + levelDef.id * 997);
  const paddleHW = SIM.PADDLE_HW * levelDef.paddle;
  const baseBallSpeed = SIM.BALL_SPEED * levelDef.ballSpeed;

  // ── Walls ──────────────────────────────────────────────────────────
  const wallBody = world.createBody({
    type: "static",
    position: Vec2(0, 0),
  });
  wallBody.setUserData({ tag: "wall" } as WallUD);
  wallBody.createFixture({
    shape: new planck.Edge(Vec2(0, 0), Vec2(0, SIM.FIELD_H)),
    friction: 0,
    restitution: 1,
  });
  wallBody.createFixture({
    shape: new planck.Edge(
      Vec2(SIM.FIELD_W, 0),
      Vec2(SIM.FIELD_W, SIM.FIELD_H),
    ),
    friction: 0,
    restitution: 1,
  });
  wallBody.createFixture({
    shape: new planck.Edge(
      Vec2(0, SIM.FIELD_H),
      Vec2(SIM.FIELD_W, SIM.FIELD_H),
    ),
    friction: 0,
    restitution: 1,
  });

  // ── Death zone ─────────────────────────────────────────────────────
  const deathBody = world.createBody({
    type: "static",
    position: Vec2(SIM.FIELD_W / 2, -0.5),
  });
  deathBody.setUserData({ tag: "death" } as DeathUD);
  deathBody.createFixture({
    shape: new planck.Box(SIM.FIELD_W, 0.3),
    isSensor: true,
  });

  // ── Paddle ─────────────────────────────────────────────────────────
  const paddle = world.createBody({
    type: "kinematic",
    position: Vec2(SIM.FIELD_W / 2, SIM.PADDLE_Y),
    fixedRotation: true,
  });
  paddle.setUserData({ tag: "paddle" } as PaddleUD);
  paddle.createFixture({
    shape: new planck.Box(paddleHW, SIM.PADDLE_HH),
    friction: 0,
    restitution: 1,
  });

  // ── Bricks ─────────────────────────────────────────────────────────
  const bricks = new Map<string, BrickState>();
  let breakableRemaining = 0;

  for (let row = 0; row < SIM.ROWS; row++) {
    const rowStr = (levelDef.rows[row] || "")
      .padEnd(SIM.COLS, ".")
      .slice(0, SIM.COLS);
    for (let col = 0; col < SIM.COLS; col++) {
      let ch = rowStr[col] || ".";
      if (ch === " ") ch = ".";
      // Handle non-ASCII characters (from level pack encoding issues)
      const def = BRICK_DEFS[ch];
      if (!def || def.hp < 0) continue;

      const x = col * SIM.BRICK_W + SIM.BRICK_W / 2;
      const y = SIM.GRID_TOP_Y - row * SIM.BRICK_H - SIM.BRICK_H / 2;
      const key = `${col}_${row}`;

      const isMoving = ch === "M";
      const body = world.createBody({
        type: isMoving ? "kinematic" : "static",
        position: Vec2(x, y),
        fixedRotation: true,
      });
      body.setUserData({
        tag: "brick",
        key,
        col,
        row,
        brickType: ch,
      } as BrickUD);
      body.createFixture({
        shape: new planck.Box(SIM.BRICK_W / 2 - 0.01, SIM.BRICK_H / 2 - 0.01),
        friction: 0,
        restitution: 1,
      });

      const hp = def.hp === 0 ? 9999 : def.hp; // steel = effectively infinite
      bricks.set(key, { body, hp, brickType: ch, col, row, originX: x });
      if (def.breakable) breakableRemaining++;
    }
  }

  // ── Ball (serve position) ──────────────────────────────────────────
  const balls = new Map<number, planck.Body>();
  const ballY = SIM.PADDLE_Y + SIM.PADDLE_HH + SIM.BALL_RADIUS + 0.05;
  const ballBody = world.createBody({
    type: "dynamic",
    position: Vec2(SIM.FIELD_W / 2, ballY),
    bullet: true,
    fixedRotation: true,
  });
  ballBody.setUserData({ tag: "ball", id: 0 } as BallUD);
  ballBody.createFixture({
    shape: new planck.Circle(SIM.BALL_RADIUS),
    friction: 0,
    restitution: 1,
    density: 1,
  });
  ballBody.setLinearVelocity(Vec2(0, 0));
  balls.set(0, ballBody);

  // ── Assemble sim state ─────────────────────────────────────────────
  const sim: LevelSim = {
    world,
    paddle,
    balls,
    bricks,
    powerupBodies: new Map(),
    shieldBody: null,
    laserBodies: new Map(),
    levelDef,
    rng,
    baseBallSpeed,
    paddleHW,
    tick: 0,
    serving: true,
    lives,
    score: carryStats?.score ?? 0,
    combo: carryStats?.combo ?? 0,
    maxCombo: carryStats?.maxCombo ?? 0,
    bricksDestroyed: carryStats?.bricksDestroyed ?? 0,
    breakableRemaining,
    powerupsUsed: carryStats?.powerupsUsed ?? 0,
    explosionKills: carryStats?.explosionKills ?? 0,
    laserKills: carryStats?.laserKills ?? 0,
    maxBallsAtOnce: carryStats?.maxBallsAtOnce ?? 1,
    missedThisLevel: carryStats?.missedThisLevel ?? false,
    levelCleared: false,
    runOver: false,
    activePowerups: new Map(),
    laserShotsRemaining: 0,
    lastLaserTick: -999,
    stickyBall: false,
    stickyOffset: 0,
    nextBallId: 1,
    nextPowerupId: 0,
    nextLaserId: 0,
    _pendingBrickHits: [],
    _pendingBallLoss: [],
    _pendingPowerupCollect: [],
    _pendingLaserHits: [],
    _pendingShieldHit: false,
    _pendingPaddleHit: null,
  };

  // ── Contact listener ───────────────────────────────────────────────
  world.on("begin-contact", (contact: planck.Contact) => {
    const bodyA = contact.getFixtureA().getBody();
    const bodyB = contact.getFixtureB().getBody();
    const udA = getUD(bodyA);
    const udB = getUD(bodyB);
    if (!udA || !udB) return;

    const pair = [udA, udB];
    const _ball = pair.find((u) => u.tag === "ball") as BallUD | undefined;
    const _brick = pair.find((u) => u.tag === "brick") as BrickUD | undefined;
    const _death = pair.find((u) => u.tag === "death") as DeathUD | undefined;
    const _paddle = pair.find((u) => u.tag === "paddle") as
      | PaddleUD
      | undefined;
    const _powerup = pair.find((u) => u.tag === "powerup") as
      | PowerupUD
      | undefined;
    const _laser = pair.find((u) => u.tag === "laser") as LaserUD | undefined;
    const _shield = pair.find((u) => u.tag === "shield") as
      | ShieldUD
      | undefined;

    if (_ball && _brick) {
      sim._pendingBrickHits.push({ key: _brick.key });
    }
    if (_ball && _death) {
      sim._pendingBallLoss.push(_ball.id);
    }
    if (_ball && _paddle) {
      sim._pendingPaddleHit = _ball.id;
    }
    if (_ball && _shield) {
      sim._pendingShieldHit = true;
    }
    if (_powerup && _paddle) {
      sim._pendingPowerupCollect.push({ id: _powerup.id, byPaddle: true });
    }
    if (_powerup && _death) {
      sim._pendingPowerupCollect.push({ id: _powerup.id, byPaddle: false });
    }
    if (_laser && _brick) {
      sim._pendingLaserHits.push({
        laserId: _laser.id,
        brickKey: _brick.key,
      });
    }
  });

  return sim;
}

// =============================================================================
// Step Simulation (one fixed tick)
// =============================================================================

export interface StepResult {
  /** True when level is cleared. */
  levelCleared: boolean;
  /** True when all lives lost. */
  runOver: boolean;
  /** Bricks destroyed this tick (for SFX). */
  bricksDestroyedThisTick: string[];
  /** Powerups collected this tick. */
  powerupsCollectedThisTick: PowerupKind[];
  /** True if a life was lost. */
  lifeLost: boolean;
}

export function stepLevelSim(
  sim: LevelSim,
  paddleTargetXNorm: number,
  action?: number,
): StepResult {
  const result: StepResult = {
    levelCleared: false,
    runOver: false,
    bricksDestroyedThisTick: [],
    powerupsCollectedThisTick: [],
    lifeLost: false,
  };

  if (sim.levelCleared || sim.runOver) return result;

  // ── Handle launch action ─────────────────────────────────────────
  if (sim.serving && action === ACTION_LAUNCH) {
    launchBall(sim);
  }

  // ── Move paddle ──────────────────────────────────────────────────
  const currentPaddleHW = getEffectivePaddleHW(sim);
  const targetX = clamp(
    paddleTargetXNorm * SIM.FIELD_W,
    currentPaddleHW,
    SIM.FIELD_W - currentPaddleHW,
  );
  const paddlePos = sim.paddle.getPosition();
  const dx = targetX - paddlePos.x;
  const speed = clamp(dx / SIM.DT, -SIM.MAX_PADDLE_SPEED, SIM.MAX_PADDLE_SPEED);
  sim.paddle.setLinearVelocity(Vec2(speed, 0));

  // ── Sticky ball follows paddle ───────────────────────────────────
  if (sim.serving || sim.stickyBall) {
    for (const [, ball] of sim.balls) {
      if (ball.getLinearVelocity().length() < 0.1) {
        const px = sim.paddle.getPosition().x;
        const by = SIM.PADDLE_Y + SIM.PADDLE_HH + SIM.BALL_RADIUS + 0.05;
        ball.setTransform(Vec2(px + sim.stickyOffset, by), 0);
        ball.setLinearVelocity(Vec2(0, 0));
      }
    }
  }

  // ── Move moving bricks (oscillation) ─────────────────────────────
  for (const [, brick] of sim.bricks) {
    if (brick.brickType === "M") {
      const t = sim.tick * SIM.DT;
      const ox =
        Math.sin(t * SIM.MOVING_BRICK_SPEED * Math.PI * 2) *
        SIM.MOVING_BRICK_RANGE;
      brick.body.setTransform(
        Vec2(brick.originX + ox, brick.body.getPosition().y),
        0,
      );
    }
  }

  // ── Laser auto-fire ──────────────────────────────────────────────
  if (
    sim.laserShotsRemaining > 0 &&
    sim.tick - sim.lastLaserTick >= SIM.LASER_FIRE_INTERVAL &&
    !sim.serving
  ) {
    fireLaser(sim);
  }

  // ── Move laser projectiles ───────────────────────────────────────
  for (const [id, laser] of sim.laserBodies) {
    const lp = laser.getPosition();
    if (lp.y > SIM.FIELD_H + 0.5) {
      sim.world.destroyBody(laser);
      sim.laserBodies.delete(id);
    }
  }

  // ── Step physics ─────────────────────────────────────────────────
  sim.world.step(SIM.DT, 8, 3);
  sim.tick++;

  // ── Process deferred contacts ────────────────────────────────────

  // Paddle hit → adjust ball angle
  if (sim._pendingPaddleHit !== null) {
    const ballBody = sim.balls.get(sim._pendingPaddleHit);
    if (ballBody) {
      adjustBallAngle(sim, ballBody);
      if (sim.stickyBall) {
        const bx = ballBody.getPosition().x;
        const px = sim.paddle.getPosition().x;
        sim.stickyOffset = bx - px;
        ballBody.setLinearVelocity(Vec2(0, 0));
        sim.stickyBall = false; // consumed; need tap to release
        sim.serving = true; // reuse serve mechanic
      }
    }
    sim._pendingPaddleHit = null;
  }

  // Shield hit
  if (sim._pendingShieldHit && sim.shieldBody) {
    sim.world.destroyBody(sim.shieldBody);
    sim.shieldBody = null;
    sim._pendingShieldHit = false;
  }

  // Brick hits
  const destroyedKeys = new Set<string>();
  for (const hit of sim._pendingBrickHits) {
    if (destroyedKeys.has(hit.key)) continue;
    const brick = sim.bricks.get(hit.key);
    if (!brick) continue;

    brick.hp--;
    if (brick.hp <= 0) {
      destroyBrick(sim, hit.key, destroyedKeys, result);
    }
  }
  sim._pendingBrickHits = [];

  // Laser hits
  for (const lh of sim._pendingLaserHits) {
    const brick = sim.bricks.get(lh.brickKey);
    if (brick && !destroyedKeys.has(lh.brickKey)) {
      brick.hp--;
      if (brick.hp <= 0) {
        destroyBrick(sim, lh.brickKey, destroyedKeys, result);
        sim.laserKills++;
      }
    }
    const laser = sim.laserBodies.get(lh.laserId);
    if (laser) {
      sim.world.destroyBody(laser);
      sim.laserBodies.delete(lh.laserId);
    }
  }
  sim._pendingLaserHits = [];

  // Ball loss
  const lostBallIds = new Set(sim._pendingBallLoss);
  for (const id of lostBallIds) {
    const ball = sim.balls.get(id);
    if (ball) {
      sim.world.destroyBody(ball);
      sim.balls.delete(id);
    }
  }
  sim._pendingBallLoss = [];

  if (lostBallIds.size > 0 && sim.balls.size === 0) {
    // All balls lost — lose a life
    sim.lives--;
    sim.combo = 0;
    sim.missedThisLevel = true;
    result.lifeLost = true;

    if (sim.lives <= 0) {
      sim.runOver = true;
      result.runOver = true;
    } else {
      // Reset serve
      resetServe(sim);
    }
  }

  // Powerup collect
  for (const pc of sim._pendingPowerupCollect) {
    const pu = sim.powerupBodies.get(pc.id);
    if (pu) {
      if (pc.byPaddle) {
        applyPowerup(sim, pu.kind);
        result.powerupsCollectedThisTick.push(pu.kind);
      }
      sim.world.destroyBody(pu.body);
      sim.powerupBodies.delete(pc.id);
    }
  }
  sim._pendingPowerupCollect = [];

  // ── Expire powerups ──────────────────────────────────────────────
  for (const [kind, expiry] of sim.activePowerups) {
    if (sim.tick >= expiry) {
      sim.activePowerups.delete(kind);
      // Reset effect
      if (kind === "expand" || kind === "shrink") {
        updatePaddleFixture(sim);
      }
    }
  }

  // ── Enforce ball speed ───────────────────────────────────────────
  const effectiveSpeed = getEffectiveBallSpeed(sim);
  for (const [, ball] of sim.balls) {
    const vel = ball.getLinearVelocity();
    const spd = vel.length();
    if (spd > 0.5 && Math.abs(spd - effectiveSpeed) > 0.1) {
      const scale = effectiveSpeed / spd;
      ball.setLinearVelocity(Vec2(vel.x * scale, vel.y * scale));
    }
    // Prevent near-horizontal stuck balls
    if (spd > 0.5) {
      const vy = vel.y;
      if (Math.abs(vy) < effectiveSpeed * 0.15) {
        const sign = vy >= 0 ? 1 : -1;
        const minVy = effectiveSpeed * 0.15;
        const newVy = sign * minVy;
        const newVx =
          Math.sign(vel.x) *
          Math.sqrt(effectiveSpeed * effectiveSpeed - newVy * newVy);
        ball.setLinearVelocity(Vec2(newVx, newVy));
      }
    }
  }

  // ── Remove out-of-bounds powerups ────────────────────────────────
  for (const [id, pu] of sim.powerupBodies) {
    if (pu.body.getPosition().y < -1) {
      sim.world.destroyBody(pu.body);
      sim.powerupBodies.delete(id);
    }
  }

  // ── Check level clear ────────────────────────────────────────────
  if (sim.breakableRemaining <= 0 && !sim.levelCleared) {
    sim.levelCleared = true;
    result.levelCleared = true;
  }

  return result;
}

// =============================================================================
// Internal Helpers
// =============================================================================

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function launchBall(sim: LevelSim): void {
  sim.serving = false;
  const speed = getEffectiveBallSpeed(sim);
  // Launch at a slight angle based on RNG
  const angle = (sim.rng.next() - 0.5) * 0.6; // -0.3 to 0.3 rad
  for (const [, ball] of sim.balls) {
    if (ball.getLinearVelocity().length() < 0.1) {
      ball.setLinearVelocity(
        Vec2(Math.sin(angle) * speed, Math.cos(angle) * speed),
      );
    }
  }
}

function resetServe(sim: LevelSim): void {
  sim.serving = true;
  sim.stickyBall = false;
  sim.stickyOffset = 0;

  // Clear all extra balls, powerups, lasers
  for (const [id, ball] of sim.balls) {
    sim.world.destroyBody(ball);
    sim.balls.delete(id);
  }
  for (const [id, pu] of sim.powerupBodies) {
    sim.world.destroyBody(pu.body);
    sim.powerupBodies.delete(id);
  }
  for (const [id, laser] of sim.laserBodies) {
    sim.world.destroyBody(laser);
    sim.laserBodies.delete(id);
  }
  sim.activePowerups.clear();
  sim.laserShotsRemaining = 0;

  // Reset paddle size
  updatePaddleFixture(sim);

  // Remove shield
  if (sim.shieldBody) {
    sim.world.destroyBody(sim.shieldBody);
    sim.shieldBody = null;
  }

  // Spawn fresh ball on paddle
  const ballY = SIM.PADDLE_Y + SIM.PADDLE_HH + SIM.BALL_RADIUS + 0.05;
  const px = sim.paddle.getPosition().x;
  const ball = sim.world.createBody({
    type: "dynamic",
    position: Vec2(px, ballY),
    bullet: true,
    fixedRotation: true,
  });
  const ballId = sim.nextBallId++;
  ball.setUserData({ tag: "ball", id: ballId } as BallUD);
  ball.createFixture({
    shape: new planck.Circle(SIM.BALL_RADIUS),
    friction: 0,
    restitution: 1,
    density: 1,
  });
  ball.setLinearVelocity(Vec2(0, 0));
  sim.balls.set(ballId, ball);
}

function adjustBallAngle(sim: LevelSim, ball: planck.Body): void {
  const vel = ball.getLinearVelocity();
  const speed = vel.length();
  if (speed < 0.5) return;

  const bx = ball.getPosition().x;
  const px = sim.paddle.getPosition().x;
  const hw = getEffectivePaddleHW(sim);
  const offset = clamp((bx - px) / hw, -1, 1);

  const angle = offset * SIM.MAX_BOUNCE_ANGLE;
  const effectiveSpeed = getEffectiveBallSpeed(sim);
  ball.setLinearVelocity(
    Vec2(
      Math.sin(angle) * effectiveSpeed,
      Math.abs(Math.cos(angle)) * effectiveSpeed,
    ),
  );
}

function destroyBrick(
  sim: LevelSim,
  key: string,
  destroyedKeys: Set<string>,
  result: StepResult,
): void {
  const brick = sim.bricks.get(key);
  if (!brick || destroyedKeys.has(key)) return;

  const def = BRICK_DEFS[brick.brickType];
  if (!def || !def.breakable) return;

  destroyedKeys.add(key);

  // Score
  sim.score += def.score * Math.max(1, Math.floor(sim.combo / 5) + 1);
  sim.combo++;
  sim.maxCombo = Math.max(sim.maxCombo, sim.combo);
  sim.bricksDestroyed++;
  sim.breakableRemaining--;
  result.bricksDestroyedThisTick.push(key);

  // Explosive chain reaction
  if (brick.brickType === "E") {
    const adjacent = getAdjacentKeys(brick.col, brick.row);
    for (const adjKey of adjacent) {
      const adj = sim.bricks.get(adjKey);
      if (
        adj &&
        !destroyedKeys.has(adjKey) &&
        BRICK_DEFS[adj.brickType]?.breakable
      ) {
        adj.hp = 0;
        sim.explosionKills++;
        destroyBrick(sim, adjKey, destroyedKeys, result);
      }
    }
  }

  // Powerup drop
  const shouldDrop =
    brick.brickType === "P" || sim.rng.next() < sim.levelDef.powerRate;
  if (shouldDrop) {
    spawnPowerup(sim, brick.body.getPosition().x, brick.body.getPosition().y);
  }

  // Remove body
  sim.world.destroyBody(brick.body);
  sim.bricks.delete(key);
}

function getAdjacentKeys(col: number, row: number): string[] {
  const keys: string[] = [];
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue;
      const nc = col + dc;
      const nr = row + dr;
      if (nc >= 0 && nc < SIM.COLS && nr >= 0 && nr < SIM.ROWS) {
        keys.push(`${nc}_${nr}`);
      }
    }
  }
  return keys;
}

function spawnPowerup(sim: LevelSim, x: number, y: number): void {
  const kind = weightedPick(sim.rng, POWERUP_POOL, POWERUP_WEIGHTS);
  const id = sim.nextPowerupId++;
  const body = sim.world.createBody({
    type: "dynamic",
    position: Vec2(x, y),
    fixedRotation: true,
  });
  body.setUserData({ tag: "powerup", id, kind } as PowerupUD);
  body.createFixture({
    shape: new planck.Circle(SIM.POWERUP_RADIUS),
    isSensor: true,
    density: 0.1,
  });
  body.setLinearVelocity(Vec2(0, SIM.POWERUP_FALL_SPEED));
  body.setGravityScale(0);
  sim.powerupBodies.set(id, { body, kind });
}

function applyPowerup(sim: LevelSim, kind: PowerupKind): void {
  sim.powerupsUsed++;
  const expiry = sim.tick + SIM.POWERUP_DURATION_TICKS;

  switch (kind) {
    case "expand":
      sim.activePowerups.set("expand", expiry);
      sim.activePowerups.delete("shrink");
      updatePaddleFixture(sim);
      break;
    case "shrink":
      sim.activePowerups.set("shrink", expiry);
      sim.activePowerups.delete("expand");
      updatePaddleFixture(sim);
      break;
    case "slow":
      sim.activePowerups.set("slow", expiry);
      sim.activePowerups.delete("fast");
      break;
    case "fast":
      sim.activePowerups.set("fast", expiry);
      sim.activePowerups.delete("slow");
      break;
    case "extraLife":
      sim.lives++;
      break;
    case "shield":
      if (!sim.shieldBody) {
        const sb = sim.world.createBody({
          type: "static",
          position: Vec2(SIM.FIELD_W / 2, 0.05),
        });
        sb.setUserData({ tag: "shield" } as ShieldUD);
        sb.createFixture({
          shape: new planck.Box(SIM.FIELD_W / 2, 0.05),
          friction: 0,
          restitution: 1,
        });
        sim.shieldBody = sb;
      }
      break;
    case "multiball": {
      const primary = [...sim.balls.values()][0];
      if (primary) {
        const pos = primary.getPosition();
        const vel = primary.getLinearVelocity();
        const speed = vel.length() || getEffectiveBallSpeed(sim);
        for (let i = 0; i < 2; i++) {
          const angle = (i === 0 ? -0.4 : 0.4) + Math.atan2(vel.x, vel.y);
          const id = sim.nextBallId++;
          const nb = sim.world.createBody({
            type: "dynamic",
            position: Vec2(pos.x, pos.y),
            bullet: true,
            fixedRotation: true,
          });
          nb.setUserData({ tag: "ball", id } as BallUD);
          nb.createFixture({
            shape: new planck.Circle(SIM.BALL_RADIUS),
            friction: 0,
            restitution: 1,
            density: 1,
          });
          nb.setLinearVelocity(
            Vec2(Math.sin(angle) * speed, Math.cos(angle) * speed),
          );
          sim.balls.set(id, nb);
        }
        sim.maxBallsAtOnce = Math.max(sim.maxBallsAtOnce, sim.balls.size);
      }
      break;
    }
    case "sticky":
      sim.stickyBall = true;
      break;
    case "laser":
      sim.laserShotsRemaining = SIM.LASER_TOTAL_SHOTS;
      sim.lastLaserTick = sim.tick - SIM.LASER_FIRE_INTERVAL; // can fire immediately
      break;
  }
}

function fireLaser(sim: LevelSim): void {
  if (sim.laserShotsRemaining <= 0) return;
  sim.laserShotsRemaining--;
  sim.lastLaserTick = sim.tick;

  const px = sim.paddle.getPosition().x;
  const id = sim.nextLaserId++;
  const body = sim.world.createBody({
    type: "dynamic",
    position: Vec2(px, SIM.PADDLE_Y + 0.3),
    bullet: true,
    fixedRotation: true,
  });
  body.setUserData({ tag: "laser", id } as LaserUD);
  body.createFixture({
    shape: new planck.Box(0.03, 0.1),
    isSensor: true,
    density: 0.01,
  });
  body.setGravityScale(0);
  body.setLinearVelocity(Vec2(0, SIM.LASER_SPEED));
  sim.laserBodies.set(id, body);
}

function getEffectivePaddleHW(sim: LevelSim): number {
  let hw = sim.paddleHW;
  if (sim.activePowerups.has("expand")) hw *= 1.5;
  if (sim.activePowerups.has("shrink")) hw *= 0.6;
  return clamp(hw, 0.2, SIM.FIELD_W / 2 - 0.1);
}

function getEffectiveBallSpeed(sim: LevelSim): number {
  let speed = sim.baseBallSpeed;
  if (sim.activePowerups.has("slow")) speed *= 0.65;
  if (sim.activePowerups.has("fast")) speed *= 1.4;
  return speed;
}

function updatePaddleFixture(sim: LevelSim): void {
  const hw = getEffectivePaddleHW(sim);
  // Re-create fixture with new size
  const oldFixture = sim.paddle.getFixtureList();
  if (oldFixture) sim.paddle.destroyFixture(oldFixture);
  sim.paddle.createFixture({
    shape: new planck.Box(hw, SIM.PADDLE_HH),
    friction: 0,
    restitution: 1,
  });
}

// =============================================================================
// Renderable State Extraction
// =============================================================================

export function getRenderState(sim: LevelSim): RenderState {
  const balls: RenderBall[] = [];
  for (const [id, body] of sim.balls) {
    const p = body.getPosition();
    balls.push({ id, x: p.x, y: p.y });
  }

  const bricks: RenderBrick[] = [];
  for (const [key, brick] of sim.bricks) {
    const p = brick.body.getPosition();
    const origDef = BRICK_DEFS[brick.brickType];
    const maxHp = origDef ? (origDef.hp === 0 ? 1 : origDef.hp) : 1;
    bricks.push({
      key,
      col: brick.col,
      row: brick.row,
      x: p.x,
      y: p.y,
      hp: brick.hp >= 9999 ? 1 : brick.hp,
      maxHp,
      brickType: brick.brickType,
    });
  }

  const powerups: RenderPowerup[] = [];
  for (const [id, pu] of sim.powerupBodies) {
    const p = pu.body.getPosition();
    powerups.push({ id, x: p.x, y: p.y, kind: pu.kind });
  }

  const activePowerups: PowerupKind[] = [];
  for (const [kind] of sim.activePowerups) {
    activePowerups.push(kind);
  }

  return {
    balls,
    paddleX: sim.paddle.getPosition().x,
    paddleHW: getEffectivePaddleHW(sim),
    bricks,
    powerups,
    hasShield: sim.shieldBody !== null,
    activePowerups,
    serving: sim.serving,
    lives: sim.lives,
    score: sim.score,
    combo: sim.combo,
    levelId: sim.levelDef.id,
    levelName: sim.levelDef.name,
    levelCleared: sim.levelCleared,
    runOver: sim.runOver,
  };
}

// =============================================================================
// Full Run Replay (for server verification)
// =============================================================================

export interface ReplayParams {
  seed: number;
  startLevelId: number;
  endLevelId: number;
  inputHz: number;
  inputSamples: InputSample[];
  levels?: LevelDef[];
}

export interface ReplayResult {
  ok: boolean;
  stats: CampaignStats;
  levelsCleared: number;
  finalLevelId: number;
  error?: string;
}

export function replayRun(params: ReplayParams): ReplayResult {
  const {
    seed,
    startLevelId,
    endLevelId,
    inputHz,
    inputSamples,
    levels: customLevels,
  } = params;
  const levels = customLevels ?? LEVEL_PACK;
  const ticksPerSample = Math.round(60 / inputHz);

  let lives: number = SIM.DEFAULT_LIVES;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let bricksDestroyed = 0;
  let powerupsUsed = 0;
  let explosionKills = 0;
  let laserKills = 0;
  let maxBallsAtOnce = 1;
  let levelsCleared = 0;
  const noMissLevels: number[] = [];
  let globalTick = 0;

  // Build sample index for fast lookup
  let sampleIdx = 0;

  function findInput(tick: number): { x: number; a?: number } {
    // Advance index to latest sample <= tick
    while (
      sampleIdx + 1 < inputSamples.length &&
      inputSamples[sampleIdx + 1].tick <= tick
    ) {
      sampleIdx++;
    }
    if (
      sampleIdx < inputSamples.length &&
      inputSamples[sampleIdx].tick <= tick
    ) {
      return inputSamples[sampleIdx];
    }
    return { x: 0.5 }; // default center
  }

  const maxTicks = 60 * 60 * 60; // 60 minutes hard limit

  for (let lvlId = startLevelId; lvlId <= endLevelId; lvlId++) {
    const levelDef = levels.find((l) => l.id === lvlId);
    if (!levelDef) break;

    const sim = createLevelSim(levelDef, seed, lives, {
      score,
      combo,
      maxCombo,
      bricksDestroyed,
      powerupsUsed,
      explosionKills,
      laserKills,
      maxBallsAtOnce,
      missedThisLevel: false,
    });

    // Run this level until cleared or run over
    const levelMaxTicks = 60 * 60 * 5; // 5 min per level hard limit
    let levelTicks = 0;

    while (
      !sim.levelCleared &&
      !sim.runOver &&
      levelTicks < levelMaxTicks &&
      globalTick < maxTicks
    ) {
      const input = findInput(globalTick);
      stepLevelSim(sim, input.x, input.a);
      globalTick++;
      levelTicks++;
    }

    // Extract stats
    score = sim.score;
    combo = sim.combo;
    maxCombo = sim.maxCombo;
    bricksDestroyed = sim.bricksDestroyed;
    powerupsUsed = sim.powerupsUsed;
    explosionKills = sim.explosionKills;
    laserKills = sim.laserKills;
    maxBallsAtOnce = sim.maxBallsAtOnce;
    lives = sim.lives;

    if (sim.levelCleared) {
      levelsCleared++;
      // Level clear bonus
      const timeBonus = Math.max(0, 3000 - levelTicks);
      const livesBonus = lives * 500;
      score += 1000 * lvlId + timeBonus + livesBonus;

      if (!sim.missedThisLevel) {
        noMissLevels.push(lvlId);
      }
    }

    if (sim.runOver) {
      lives = 0;
      break;
    }

    // Cleanup Planck world (not strictly necessary in Node but good practice)
    // world is garbage collected with the sim object
  }

  const durationMs = Math.round((globalTick / 60) * 1000);

  return {
    ok: true,
    stats: {
      score,
      maxCombo,
      bricksDestroyed,
      powerupsUsed,
      levelsCleared,
      durationMs,
      livesRemaining: lives,
      explosionBrickKills: explosionKills,
      laserBrickKills: laserKills,
      maxBallsAtOnce,
      noMissLevels,
    },
    levelsCleared,
    finalLevelId: startLevelId + levelsCleared - (levelsCleared > 0 ? 0 : 0),
    error: undefined,
  };
}
