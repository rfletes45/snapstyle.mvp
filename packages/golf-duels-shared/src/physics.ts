/**
 * Golf Duels — Deterministic 2.5D Physics Simulation  (Segment 3 spec)
 *
 * Server-authoritative physics engine for mini-golf.
 * Runs at 60 Hz fixed timestep on the server.
 * Client uses the identical code for prediction / aim-assist.
 *
 * Coordinate system: X = right, Z = down (top-down 2D).
 * Y is purely visual — not simulated here.
 *
 * Physics features:
 *  - Exponential damping per surface (turf, sand, slow)
 *  - Speed pad boost with max-speed clamp
 *  - Ball–wall segment collision with push-out and restitution
 *  - Ball–bumper (round + wedge) collision
 *  - Spinner / gate deterministic animated obstacles
 *  - Bridge passthrough (suppress hazards)
 *  - Tunnel teleportation with anti-re-trigger offset
 *  - Speed-gate pass/reflect
 *  - Height-field gravity: planar slopes + domes
 *  - Hazard detection (water / out_of_bounds → reset)
 *  - Cup capture (distance + speed threshold)
 *  - Rest-time accumulator (ball must be below threshold for REST_TIME)
 *  - Max simulation time cap per stroke
 */

import {
  type BallState,
  type BridgeObstacle,
  type BumperRoundObstacle,
  type BumperWedgeObstacle,
  type DomeHeightField,
  type GateObstacle,
  type HeightField,
  type HoleData,
  PHYSICS,
  type PlaneHeightField,
  type SpeedGateObstacle,
  type SpeedSurface,
  type SpinnerObstacle,
  type TunnelObstacle,
  type Vec2,
} from "./types";

// =============================================================================
// Simulation Result
// =============================================================================

export interface TickResult {
  /** Updated ball state */
  ball: BallState;
  /** Ball has entered the cup */
  holed: boolean;
  /** Ball hit a hazard — needs reset to lastSafe */
  hitHazard: HazardHitInfo | null;
  /** Ball has stopped moving (below threshold for REST_TIME) */
  stopped: boolean;
  /** Ball entered a tunnel this tick */
  tunneled: boolean;
}

export interface HazardHitInfo {
  type: string;
  id: string;
}

// =============================================================================
// Vector Helpers
// =============================================================================

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.z * b.z;
}

function len(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.z * v.z);
}

function normalize(v: Vec2): Vec2 {
  const l = len(v);
  if (l < 1e-9) return { x: 0, z: 0 };
  return { x: v.x / l, z: v.z / l };
}

function reflect(v: Vec2, normal: Vec2): Vec2 {
  const d = dot(v, normal);
  return { x: v.x - 2 * d * normal.x, z: v.z - 2 * d * normal.z };
}

function ballSpeed(b: BallState): number {
  return Math.sqrt(b.vx * b.vx + b.vz * b.vz);
}

// =============================================================================
// AABB Helpers
// =============================================================================

function pointInAABB(px: number, pz: number, min: Vec2, max: Vec2): boolean {
  return px >= min.x && px <= max.x && pz >= min.z && pz <= max.z;
}

// =============================================================================
// Line Segment Collision
// =============================================================================

/**
 * Check if a circle (ball) intersects a line segment.
 * Returns the penetration normal, depth, and closest point, or null.
 */
function circleSegmentCollision(
  cx: number,
  cz: number,
  radius: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { normal: Vec2; depth: number; closest: Vec2 } | null {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;

  if (lenSq < 1e-9) {
    const dist = Math.sqrt((cx - ax) ** 2 + (cz - az) ** 2);
    if (dist < radius) {
      const n = normalize({ x: cx - ax, z: cz - az });
      return { normal: n, depth: radius - dist, closest: { x: ax, z: az } };
    }
    return null;
  }

  let t = ((cx - ax) * dx + (cz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestZ = az + t * dz;
  const distX = cx - closestX;
  const distZ = cz - closestZ;
  const dist = Math.sqrt(distX * distX + distZ * distZ);

  if (dist < radius) {
    const n =
      dist > 1e-9
        ? { x: distX / dist, z: distZ / dist }
        : normalize({ x: -dz, z: dx });
    return {
      normal: n,
      depth: radius - dist,
      closest: { x: closestX, z: closestZ },
    };
  }
  return null;
}

// =============================================================================
// Spinner Arm Geometry at Time t  (deterministic)
// =============================================================================

function getSpinnerSegment(
  obs: SpinnerObstacle,
  time: number,
): { a: Vec2; b: Vec2 } {
  const angle = (obs.phase + time * obs.rps) * Math.PI * 2;
  const halfLen = obs.length / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    a: { x: obs.pivot.x - cos * halfLen, z: obs.pivot.z - sin * halfLen },
    b: { x: obs.pivot.x + cos * halfLen, z: obs.pivot.z + sin * halfLen },
  };
}

// =============================================================================
// Gate Arm Geometry at Time t  (deterministic)
// =============================================================================

function getGateArmEnd(obs: GateObstacle, time: number): Vec2 {
  const baseRad = (obs.rotationBaseDeg * Math.PI) / 180;
  const halfArc = ((obs.arcDeg / 2) * Math.PI) / 180;
  const phase = obs.phase * Math.PI * 2;
  const oscillation =
    Math.sin((time / obs.periodSec) * Math.PI * 2 + phase) * halfArc;
  const angle = baseRad + oscillation;
  return {
    x: obs.hinge.x + Math.cos(angle) * obs.armLength,
    z: obs.hinge.z + Math.sin(angle) * obs.armLength,
  };
}

// =============================================================================
// Bridge Passthrough
// =============================================================================

function isOnBridge(bx: number, bz: number, bridge: BridgeObstacle): boolean {
  const dx = bridge.b.x - bridge.a.x;
  const dz = bridge.b.z - bridge.a.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-9) return false;

  let t = ((bx - bridge.a.x) * dx + (bz - bridge.a.z) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = bridge.a.x + t * dx;
  const closestZ = bridge.a.z + t * dz;
  const distSq = (bx - closestX) ** 2 + (bz - closestZ) ** 2;
  return distSq <= (bridge.width / 2) ** 2;
}

// =============================================================================
// Main Physics Tick
// =============================================================================

/**
 * Run one physics tick (fixed dt = 1/60) and return the result.
 *
 * @param ball       Current ball state
 * @param hole       Current hole data
 * @param dt         Time step in seconds (should be PHYSICS.DT = 1/60)
 * @param elapsedTime Total elapsed time since hole start (for animated obstacles)
 * @param restAccum   Time the ball has been below STOP_THRESHOLD (carried across ticks)
 */
export function physicsTick(
  ball: BallState,
  hole: HoleData,
  dt: number,
  elapsedTime: number,
  restAccum: number = 0,
): TickResult & { restAccum: number } {
  const R = PHYSICS.BALL_RADIUS;
  const b: BallState = { ...ball };

  let holed = false;
  let hitHazard: HazardHitInfo | null = null;
  let tunneled = false;

  // ------------------------------------------------------------------
  // 1. Height-field slope acceleration  (before damping)
  // ------------------------------------------------------------------
  for (const hf of hole.heightFields) {
    applyHeightFieldGravity(b, hf, dt);
  }

  // ------------------------------------------------------------------
  // 2. Exponential damping by surface  +  speed-pad boost
  // ------------------------------------------------------------------
  let damping: number = PHYSICS.TURF_DAMPING;
  for (const surface of hole.surfaces) {
    if (!pointInAABB(b.x, b.z, surface.min, surface.max)) continue;
    switch (surface.type) {
      case "sand":
        damping = Math.max(damping, PHYSICS.SAND_DAMPING);
        break;
      case "slow":
        damping = Math.max(damping, PHYSICS.SLOW_DAMPING);
        break;
      case "speed": {
        const spd = surface as SpeedSurface;
        const accel = spd.accel ?? PHYSICS.SPEED_PAD_DEFAULT_ACCEL;
        b.vx += spd.dir.x * accel * dt;
        b.vz += spd.dir.z * accel * dt;
        // Clamp max speed
        const maxSpd = spd.maxSpeed ?? PHYSICS.SPEED_PAD_MAX_SPEED;
        const curSpd = ballSpeed(b);
        if (curSpd > maxSpd) {
          const ratio = maxSpd / curSpd;
          b.vx *= ratio;
          b.vz *= ratio;
        }
        // Speed pad uses turf damping
        break;
      }
    }
  }

  // Exponential damping: vel *= exp(-damping * dt)
  const dampFactor = Math.exp(-damping * dt);
  b.vx *= dampFactor;
  b.vz *= dampFactor;

  // ------------------------------------------------------------------
  // 3. Integrate position
  // ------------------------------------------------------------------
  b.x += b.vx * dt;
  b.z += b.vz * dt;

  // ------------------------------------------------------------------
  // 4. Wall collisions
  // ------------------------------------------------------------------
  for (const wall of hole.walls) {
    const hit = circleSegmentCollision(
      b.x,
      b.z,
      R,
      wall.a.x,
      wall.a.z,
      wall.b.x,
      wall.b.z,
    );
    if (hit) {
      b.x += hit.normal.x * hit.depth;
      b.z += hit.normal.z * hit.depth;
      const vel: Vec2 = { x: b.vx, z: b.vz };
      const ref = reflect(vel, hit.normal);
      b.vx = ref.x * PHYSICS.WALL_RESTITUTION;
      b.vz = ref.z * PHYSICS.WALL_RESTITUTION;
    }
  }

  // ------------------------------------------------------------------
  // 5. Obstacle collisions
  // ------------------------------------------------------------------
  let onBridge = false;
  for (const obstacle of hole.obstacles) {
    switch (obstacle.type) {
      case "bumper_round":
        handleBumperRound(b, obstacle as BumperRoundObstacle, R);
        break;
      case "bumper_wedge":
        handleBumperWedge(b, obstacle as BumperWedgeObstacle, R);
        break;
      case "spinner":
        handleSpinner(b, obstacle as SpinnerObstacle, R, elapsedTime);
        break;
      case "gate":
        handleGate(b, obstacle as GateObstacle, R, elapsedTime);
        break;
      case "bridge":
        if (isOnBridge(b.x, b.z, obstacle as BridgeObstacle)) onBridge = true;
        break;
      case "tunnel":
        if (handleTunnel(b, obstacle as TunnelObstacle, R)) tunneled = true;
        break;
      case "speed_gate":
        handleSpeedGate(b, obstacle as SpeedGateObstacle);
        break;
    }
  }

  // ------------------------------------------------------------------
  // 6. Hazard check (skip if on bridge)
  // ------------------------------------------------------------------
  if (!onBridge) {
    for (const hazard of hole.hazards) {
      if (pointInAABB(b.x, b.z, hazard.min, hazard.max)) {
        hitHazard = { type: hazard.type, id: hazard.id };
        break;
      }
    }
  }

  // ------------------------------------------------------------------
  // 7. Cup capture
  // ------------------------------------------------------------------
  const cupDist = Math.sqrt((b.x - hole.cup.x) ** 2 + (b.z - hole.cup.z) ** 2);
  const spd = ballSpeed(b);
  if (cupDist <= PHYSICS.CUP_RADIUS + R && spd <= PHYSICS.CUP_CAPTURE_SPEED) {
    holed = true;
    b.x = hole.cup.x;
    b.z = hole.cup.z;
    b.vx = 0;
    b.vz = 0;
  }

  // ------------------------------------------------------------------
  // 8. Rest-time accumulator → "stopped" flag
  // ------------------------------------------------------------------
  let newRestAccum = restAccum;
  let stopped = false;
  if (!holed && !hitHazard) {
    if (ballSpeed(b) < PHYSICS.STOP_THRESHOLD) {
      newRestAccum += dt;
      if (newRestAccum >= PHYSICS.REST_TIME) {
        b.vx = 0;
        b.vz = 0;
        stopped = true;
      }
    } else {
      newRestAccum = 0;
    }
  }

  return {
    ball: b,
    holed,
    hitHazard,
    stopped,
    tunneled,
    restAccum: newRestAccum,
  };
}

// =============================================================================
// Obstacle Handlers
// =============================================================================

function handleBumperRound(
  b: BallState,
  obs: BumperRoundObstacle,
  ballRadius: number,
): void {
  const dx = b.x - obs.pos.x;
  const dz = b.z - obs.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const minDist = ballRadius + obs.radius;

  if (dist < minDist && dist > 1e-9) {
    const normal: Vec2 = { x: dx / dist, z: dz / dist };
    b.x = obs.pos.x + normal.x * minDist;
    b.z = obs.pos.z + normal.z * minDist;
    const vel: Vec2 = { x: b.vx, z: b.vz };
    const ref = reflect(vel, normal);
    b.vx = ref.x * PHYSICS.BUMPER_RESTITUTION;
    b.vz = ref.z * PHYSICS.BUMPER_RESTITUTION;
  }
}

function handleBumperWedge(
  b: BallState,
  obs: BumperWedgeObstacle,
  ballRadius: number,
): void {
  const angle = (obs.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const ax = obs.pos.x - cos * obs.halfLength;
  const az = obs.pos.z - sin * obs.halfLength;
  const bx = obs.pos.x + cos * obs.halfLength;
  const bz = obs.pos.z + sin * obs.halfLength;

  const hit = circleSegmentCollision(b.x, b.z, ballRadius, ax, az, bx, bz);
  if (hit) {
    b.x += hit.normal.x * hit.depth;
    b.z += hit.normal.z * hit.depth;
    const vel: Vec2 = { x: b.vx, z: b.vz };
    const ref = reflect(vel, hit.normal);
    b.vx = ref.x * PHYSICS.BUMPER_RESTITUTION;
    b.vz = ref.z * PHYSICS.BUMPER_RESTITUTION;
  }
}

function handleSpinner(
  b: BallState,
  obs: SpinnerObstacle,
  ballRadius: number,
  time: number,
): void {
  const seg = getSpinnerSegment(obs, time);
  const hit = circleSegmentCollision(
    b.x,
    b.z,
    ballRadius,
    seg.a.x,
    seg.a.z,
    seg.b.x,
    seg.b.z,
  );
  if (hit) {
    b.x += hit.normal.x * hit.depth;
    b.z += hit.normal.z * hit.depth;

    // Tangential velocity from spinner rotation
    const spinAngVel = obs.rps * Math.PI * 2;
    const relX = hit.closest.x - obs.pivot.x;
    const relZ = hit.closest.z - obs.pivot.z;
    const tangentVx = -relZ * spinAngVel;
    const tangentVz = relX * spinAngVel;

    const vel: Vec2 = { x: b.vx, z: b.vz };
    const ref = reflect(vel, hit.normal);
    b.vx = ref.x * PHYSICS.WALL_RESTITUTION + tangentVx * 0.3;
    b.vz = ref.z * PHYSICS.WALL_RESTITUTION + tangentVz * 0.3;
  }
}

function handleGate(
  b: BallState,
  obs: GateObstacle,
  ballRadius: number,
  time: number,
): void {
  const armEnd = getGateArmEnd(obs, time);
  const hit = circleSegmentCollision(
    b.x,
    b.z,
    ballRadius,
    obs.hinge.x,
    obs.hinge.z,
    armEnd.x,
    armEnd.z,
  );
  if (hit) {
    b.x += hit.normal.x * hit.depth;
    b.z += hit.normal.z * hit.depth;
    const vel: Vec2 = { x: b.vx, z: b.vz };
    const ref = reflect(vel, hit.normal);
    b.vx = ref.x * PHYSICS.WALL_RESTITUTION;
    b.vz = ref.z * PHYSICS.WALL_RESTITUTION;
  }
}

/**
 * Tunnel: If ball enters "enter" radius, instantly move to "exit".
 * Preserve speed/direction. Add small positional offset along direction
 * to avoid re-trigger loops.
 */
function handleTunnel(
  b: BallState,
  obs: TunnelObstacle,
  ballRadius: number,
): boolean {
  const dist = Math.sqrt((b.x - obs.enter.x) ** 2 + (b.z - obs.enter.z) ** 2);
  if (dist <= obs.radius + ballRadius) {
    // Teleport to exit
    b.x = obs.exit.x;
    b.z = obs.exit.z;

    // Add small offset along velocity direction to prevent re-trigger
    const spd = ballSpeed(b);
    if (spd > 1e-6) {
      const offset = ballRadius + 0.05;
      b.x += (b.vx / spd) * offset;
      b.z += (b.vz / spd) * offset;
    }
    return true;
  }
  return false;
}

function handleSpeedGate(b: BallState, obs: SpeedGateObstacle): void {
  if (pointInAABB(b.x, b.z, obs.entry.min, obs.entry.max)) {
    const currentSpeed = ballSpeed(b);
    if (currentSpeed >= obs.minSpeed && currentSpeed <= obs.maxSpeed) {
      b.x = obs.exit.x;
      b.z = obs.exit.z;
    } else if (obs.onFail === "reflect") {
      b.vx = -b.vx * obs.reflectRestitution;
      b.vz = -b.vz * obs.reflectRestitution;
      b.x = obs.entry.min.x - PHYSICS.BALL_RADIUS * 2;
    }
  }
}

// =============================================================================
// HeightField Gravity  (a_slope = -g * slopeScale * grad(h))
// =============================================================================

function applyHeightFieldGravity(
  b: BallState,
  hf: HeightField,
  dt: number,
): void {
  const g = PHYSICS.GRAVITY;
  const sc = PHYSICS.SLOPE_SCALE;

  switch (hf.type) {
    case "plane": {
      const phf = hf as PlaneHeightField;
      const inZone = phf.zone
        ? pointInAABB(b.x, b.z, phf.zone.min, phf.zone.max)
        : true;
      if (inZone) {
        // h = a*x + b*z  →  grad = (a, b)
        // a_slope = -g * slopeScale * grad
        b.vx += -g * sc * phf.a * dt;
        b.vz += -g * sc * phf.b * dt;
      }
      break;
    }
    case "dome": {
      const dhf = hf as DomeHeightField;
      const dx = b.x - dhf.center.x;
      const dz = b.z - dhf.center.z;
      const r = Math.sqrt(dx * dx + dz * dz);
      if (r < dhf.radius && r > 1e-9) {
        // h = max(0, H*(1-(r/R)^2))
        // dh/dr = -2*H*r/R^2
        // grad in (x,z) = dh/dr * (dx/r, dz/r) = -2H/(R^2) * (dx, dz)
        const gradScale = (-2 * dhf.height) / (dhf.radius * dhf.radius);
        const gradX = gradScale * dx;
        const gradZ = gradScale * dz;
        // a_slope = -g * slopeScale * grad(h)
        b.vx += -g * sc * gradX * dt;
        b.vz += -g * sc * gradZ * dt;
      }
      break;
    }
  }
}

// =============================================================================
// Shot Application  (S3 exact mapping)
// =============================================================================

/**
 * Apply a shot to the ball.
 *
 * Speed = lerp(SHOT_SPEED_MIN, SHOT_SPEED_MAX, power01^SHOT_POWER_EXPONENT)
 * Velocity = dirFromAngle(aimAngleRad) * speed
 */
export function applyShot(
  ball: BallState,
  angle: number,
  power: number,
): BallState {
  const p = Math.max(0, Math.min(1, power));
  const curved = Math.pow(p, PHYSICS.SHOT_POWER_EXPONENT);
  const speed =
    PHYSICS.SHOT_SPEED_MIN +
    curved * (PHYSICS.SHOT_SPEED_MAX - PHYSICS.SHOT_SPEED_MIN);
  return {
    x: ball.x,
    z: ball.z,
    vx: Math.cos(angle) * speed,
    vz: Math.sin(angle) * speed,
  };
}

// =============================================================================
// Full Simulation Until Settled
// =============================================================================

/**
 * Run the simulation until the ball stops, holes, or hits a hazard.
 * Respects MAX_SIM_TIME (6 s) and REST_TIME accumulator.
 *
 * @param ball       Starting ball state
 * @param hole       Hole data
 * @param startTime  Elapsed time at start (for animated obstacles)
 * @param maxTime    Maximum simulation seconds (default: PHYSICS.MAX_SIM_TIME)
 */
export function simulateUntilSettled(
  ball: BallState,
  hole: HoleData,
  startTime: number = 0,
  maxTime: number = PHYSICS.MAX_SIM_TIME,
): { frames: BallState[]; result: TickResult } {
  const maxTicks = Math.ceil(maxTime / PHYSICS.DT);
  const frames: BallState[] = [{ ...ball }];
  let current = { ...ball };
  let restAccum = 0;
  let lastResult: (TickResult & { restAccum: number }) | null = null;

  for (let i = 0; i < maxTicks; i++) {
    const time = startTime + i * PHYSICS.DT;
    const tickResult = physicsTick(current, hole, PHYSICS.DT, time, restAccum);
    current = tickResult.ball;
    restAccum = tickResult.restAccum;
    frames.push({ ...current });
    lastResult = tickResult;

    if (tickResult.holed || tickResult.hitHazard || tickResult.stopped) {
      break;
    }
  }

  const fallback: TickResult = {
    ball: current,
    holed: false,
    hitHazard: null,
    stopped: true,
    tunneled: false,
  };

  return {
    frames,
    result: lastResult
      ? {
          ball: lastResult.ball,
          holed: lastResult.holed,
          hitHazard: lastResult.hitHazard,
          stopped: lastResult.stopped,
          tunneled: lastResult.tunneled,
        }
      : fallback,
  };
}
