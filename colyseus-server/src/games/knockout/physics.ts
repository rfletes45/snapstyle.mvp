/**
 * Knockout — Physics Engine
 *
 * Authoritative 2D top-down physics for the Knockout game.
 * Implements circle-based collision detection, impulse resolution,
 * and square arena boundary enforcement.
 *
 * The arena is a SQUARE centered at (0.5, 0.5) in normalized coordinates.
 * Penguins are circles with radius PENGUIN_RADIUS.
 * Gravity is zero — movement comes from player-directed impulses.
 *
 * Elimination rule: a penguin is eliminated when MORE THAN 50% of its
 * circular body area lies outside the square arena. This uses a
 * deterministic grid-sampling approach (circle-vs-rectangle overlap).
 *
 * @module games/knockout/physics
 */

// =============================================================================
// Constants — Server-authoritative, clients derive visuals from these
// =============================================================================

/** Penguin body radius in normalized coordinates */
export const PENGUIN_RADIUS = 0.035;

/** Base arena half-side length (before shrink) */
export const ARENA_BASE_HALF_SIDE = 0.42;

/** Minimum launch impulse (power = 0) */
export const LAUNCH_IMPULSE_MIN = 0.15;

/** Maximum launch impulse (power = 1) */
export const LAUNCH_IMPULSE_MAX = 0.7;

/** Linear damping factor per second (friction on ice) */
export const LINEAR_DAMPING = 1.8;

/** Collision restitution (bounciness) */
export const RESTITUTION = 0.7;

/** Collision mass (all penguins equal) */
export const PENGUIN_MASS = 1.0;

/** Velocity threshold to consider a body "settled" */
export const SETTLE_THRESHOLD = 0.005;

/** Maximum simulation duration per round (ms) */
export const MAX_SIM_DURATION_MS = 6000;

/** Fixed physics timestep (seconds) */
export const FIXED_DT = 1 / 60;

/** Arena center in normalized coordinates */
export const ARENA_CENTER_X = 0.5;
export const ARENA_CENTER_Y = 0.5;

/** How much the arena shrinks per stage (half-side reduction) */
export const SHRINK_PER_STAGE = 0.04;

/** Minimum arena half-side */
export const MIN_ARENA_HALF_SIDE = 0.12;

/** Speed cap to prevent tunneling */
export const MAX_SPEED = 2.5;

// =============================================================================
// Types
// =============================================================================

export interface PhysicsBody {
  uid: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  /** UID of the last opponent that hit this body significantly */
  lastHitBy: string | null;
  /** Timestamp of the last significant hit */
  lastHitAt: number;
  /** UID of the second-to-last opponent hit (for assists) */
  assistHitBy: string | null;
}

export interface CollisionEvent {
  uidA: string;
  uidB: string;
  impulse: number;
  timestamp: number;
}

export interface EliminationEvent {
  uid: string;
  killerUid: string | null;
  assistUid: string | null;
  selfElim: boolean;
}

// =============================================================================
// Physics World
// =============================================================================

// =============================================================================
// Circle-vs-rectangle overlap sampling
// =============================================================================

/**
 * Pre-computed grid offsets inside a unit circle for area overlap testing.
 * A 7×7 grid gives ~37 sample points inside the circle — enough for a
 * smooth, fair >50% elimination check on both edges and corners.
 */
const OVERLAP_SAMPLES: Array<[number, number]> = [];
{
  const N = 7;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const nx = -1 + (2 * (i + 0.5)) / N;
      const ny = -1 + (2 * (j + 0.5)) / N;
      if (nx * nx + ny * ny <= 1.0) {
        OVERLAP_SAMPLES.push([nx, ny]);
      }
    }
  }
}

/**
 * Returns true when more than 50% of the circular body is outside
 * the axis-aligned square arena.
 */
function isMoreThanHalfOutside(
  cx: number,
  cy: number,
  r: number,
  halfSide: number,
): boolean {
  const xMin = ARENA_CENTER_X - halfSide;
  const xMax = ARENA_CENTER_X + halfSide;
  const yMin = ARENA_CENTER_Y - halfSide;
  const yMax = ARENA_CENTER_Y + halfSide;

  // Fast path: bounding box fully inside arena
  if (cx - r >= xMin && cx + r <= xMax && cy - r >= yMin && cy + r <= yMax) {
    return false;
  }
  // Fast path: bounding box fully outside arena
  if (cx + r < xMin || cx - r > xMax || cy + r < yMin || cy - r > yMax) {
    return true;
  }

  let insideCount = 0;
  for (const [nx, ny] of OVERLAP_SAMPLES) {
    const sx = cx + nx * r;
    const sy = cy + ny * r;
    if (sx >= xMin && sx <= xMax && sy >= yMin && sy <= yMax) {
      insideCount++;
    }
  }
  return insideCount < OVERLAP_SAMPLES.length / 2;
}

// =============================================================================
// Physics World
// =============================================================================

export class KnockoutPhysics {
  bodies: Map<string, PhysicsBody> = new Map();
  private arenaHalfSide: number = ARENA_BASE_HALF_SIDE;
  private collisionEvents: CollisionEvent[] = [];
  private eliminationEvents: EliminationEvent[] = [];
  private simulationTime = 0;

  /** Initialize bodies for all players in a circle around the center */
  initBodies(uids: string[]): void {
    this.bodies.clear();
    const count = uids.length;
    const placementRadius = this.arenaHalfSide * 0.6;

    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      this.bodies.set(uids[i], {
        uid: uids[i],
        x: ARENA_CENTER_X + Math.cos(angle) * placementRadius,
        y: ARENA_CENTER_Y + Math.sin(angle) * placementRadius,
        vx: 0,
        vy: 0,
        alive: true,
        lastHitBy: null,
        lastHitAt: 0,
        assistHitBy: null,
      });
    }

    this.collisionEvents = [];
    this.eliminationEvents = [];
    this.simulationTime = 0;
  }

  /** Apply launch impulses to all alive bodies (variable power per player) */
  applyImpulses(
    moves: Map<string, { dx: number; dy: number; power: number }>,
  ): void {
    for (const [uid, move] of moves) {
      const body = this.bodies.get(uid);
      if (!body || !body.alive) continue;

      // Normalize direction
      const mag = Math.sqrt(move.dx ** 2 + move.dy ** 2);
      if (mag < 0.001) continue;

      const nx = move.dx / mag;
      const ny = move.dy / mag;

      // Clamp power 0..1 and interpolate impulse
      const p = Math.max(0, Math.min(1, move.power));
      const impulse =
        LAUNCH_IMPULSE_MIN + p * (LAUNCH_IMPULSE_MAX - LAUNCH_IMPULSE_MIN);

      body.vx += nx * impulse;
      body.vy += ny * impulse;
    }
  }

  /** Step the physics world by one fixed timestep */
  step(): void {
    this.simulationTime += FIXED_DT;

    // Apply damping and move bodies
    for (const body of this.bodies.values()) {
      if (!body.alive) continue;

      // Linear damping (ice friction)
      const dampFactor = Math.max(0, 1 - LINEAR_DAMPING * FIXED_DT);
      body.vx *= dampFactor;
      body.vy *= dampFactor;

      // Clamp speed
      const speed = Math.sqrt(body.vx ** 2 + body.vy ** 2);
      if (speed > MAX_SPEED) {
        body.vx = (body.vx / speed) * MAX_SPEED;
        body.vy = (body.vy / speed) * MAX_SPEED;
      }

      // Integrate position
      body.x += body.vx * FIXED_DT;
      body.y += body.vy * FIXED_DT;
    }

    // Resolve collisions between penguins
    this.resolveCollisions();

    // Check arena boundary eliminations
    this.checkBoundaryEliminations();
  }

  /** Run simulation until settled or max time reached */
  runUntilSettled(): {
    eliminations: EliminationEvent[];
    collisions: CollisionEvent[];
    steps: number;
  } {
    this.collisionEvents = [];
    this.eliminationEvents = [];
    this.simulationTime = 0;

    let stepCount = 0;
    const maxSteps = Math.ceil(MAX_SIM_DURATION_MS / 1000 / FIXED_DT);

    while (stepCount < maxSteps) {
      this.step();
      stepCount++;

      // Check if all alive bodies have settled
      if (this.allSettled() && stepCount > 10) {
        break;
      }
    }

    return {
      eliminations: [...this.eliminationEvents],
      collisions: [...this.collisionEvents],
      steps: stepCount,
    };
  }

  /** Check if all alive bodies have settled below velocity threshold */
  private allSettled(): boolean {
    for (const body of this.bodies.values()) {
      if (!body.alive) continue;
      const speed = Math.sqrt(body.vx ** 2 + body.vy ** 2);
      if (speed > SETTLE_THRESHOLD) return false;
    }
    return true;
  }

  /** Resolve collisions between all pairs of alive penguin bodies */
  private resolveCollisions(): void {
    const aliveBodies = Array.from(this.bodies.values()).filter((b) => b.alive);

    for (let i = 0; i < aliveBodies.length; i++) {
      for (let j = i + 1; j < aliveBodies.length; j++) {
        const a = aliveBodies[i];
        const b = aliveBodies[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = PENGUIN_RADIUS * 2;

        if (dist < minDist && dist > 0.0001) {
          // Collision normal
          const nx = dx / dist;
          const ny = dy / dist;

          // Relative velocity along normal
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const relVelNormal = dvx * nx + dvy * ny;

          // Only resolve if objects are moving toward each other
          if (relVelNormal <= 0) continue;

          // Impulse scalar (equal mass)
          const impulseScalar = (relVelNormal * (1 + RESTITUTION)) / 2;

          // Apply impulse
          a.vx -= impulseScalar * nx;
          a.vy -= impulseScalar * ny;
          b.vx += impulseScalar * nx;
          b.vy += impulseScalar * ny;

          // Separate overlapping bodies
          const overlap = minDist - dist;
          const separateX = (nx * overlap) / 2;
          const separateY = (ny * overlap) / 2;
          a.x -= separateX;
          a.y -= separateY;
          b.x += separateX;
          b.y += separateY;

          const impulseMag = Math.abs(impulseScalar);

          // Track collision for attribution (threshold for "significant")
          if (impulseMag > 0.05) {
            this.collisionEvents.push({
              uidA: a.uid,
              uidB: b.uid,
              impulse: impulseMag,
              timestamp: this.simulationTime,
            });

            // Attribution: update lastHitBy for both
            a.assistHitBy = a.lastHitBy;
            a.lastHitBy = b.uid;
            a.lastHitAt = this.simulationTime;

            b.assistHitBy = b.lastHitBy;
            b.lastHitBy = a.uid;
            b.lastHitAt = this.simulationTime;
          }
        }
      }
    }
  }

  /**
   * Check if any alive body has more than 50% of its area outside
   * the square arena bounds. Uses circle-vs-rectangle sampling.
   */
  private checkBoundaryEliminations(): void {
    for (const body of this.bodies.values()) {
      if (!body.alive) continue;

      if (
        isMoreThanHalfOutside(
          body.x,
          body.y,
          PENGUIN_RADIUS,
          this.arenaHalfSide,
        )
      ) {
        body.alive = false;
        body.vx = 0;
        body.vy = 0;

        // Attribution
        const recentHitWindow = 3.0; // seconds
        const hasRecentHit =
          body.lastHitBy !== null &&
          this.simulationTime - body.lastHitAt < recentHitWindow;

        this.eliminationEvents.push({
          uid: body.uid,
          killerUid: hasRecentHit ? body.lastHitBy : null,
          assistUid:
            hasRecentHit && body.assistHitBy !== body.lastHitBy
              ? body.assistHitBy
              : null,
          selfElim: !hasRecentHit,
        });
      }
    }
  }

  /** Get the number of alive bodies */
  getAliveCount(): number {
    let count = 0;
    for (const body of this.bodies.values()) {
      if (body.alive) count++;
    }
    return count;
  }

  /** Get UIDs of alive players */
  getAliveUids(): string[] {
    const uids: string[] = [];
    for (const body of this.bodies.values()) {
      if (body.alive) uids.push(body.uid);
    }
    return uids;
  }

  /** Set new arena half-side (for shrink) */
  setArenaHalfSide(hs: number): void {
    this.arenaHalfSide = Math.max(MIN_ARENA_HALF_SIDE, hs);
  }

  /** Get current arena half-side */
  getArenaHalfSide(): number {
    return this.arenaHalfSide;
  }

  /** Eliminate any bodies that now have >50% outside after a shrink */
  checkPostShrinkEliminations(): EliminationEvent[] {
    const elims: EliminationEvent[] = [];
    for (const body of this.bodies.values()) {
      if (!body.alive) continue;

      if (
        isMoreThanHalfOutside(
          body.x,
          body.y,
          PENGUIN_RADIUS,
          this.arenaHalfSide,
        )
      ) {
        body.alive = false;
        body.vx = 0;
        body.vy = 0;
        elims.push({
          uid: body.uid,
          killerUid: null,
          assistUid: null,
          selfElim: true, // caught by shrink
        });
      }
    }
    return elims;
  }

  /**
   * Drain and return all elimination events recorded since the last drain.
   * Call this after simulation to collect mid-step eliminations.
   */
  drainEliminationEvents(): EliminationEvent[] {
    const events = [...this.eliminationEvents];
    this.eliminationEvents = [];
    return events;
  }

  /**
   * Drain and return all collision events recorded since the last drain.
   */
  drainCollisionEvents(): CollisionEvent[] {
    const events = [...this.collisionEvents];
    this.collisionEvents = [];
    return events;
  }

  /** Get public snapshot of all bodies (safe to broadcast) */
  getBodiesSnapshot(): Array<{
    uid: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    alive: boolean;
  }> {
    const result: Array<{
      uid: string;
      x: number;
      y: number;
      vx: number;
      vy: number;
      alive: boolean;
    }> = [];
    for (const body of this.bodies.values()) {
      result.push({
        uid: body.uid,
        x: Math.round(body.x * 10000) / 10000,
        y: Math.round(body.y * 10000) / 10000,
        vx: Math.round(body.vx * 10000) / 10000,
        vy: Math.round(body.vy * 10000) / 10000,
        alive: body.alive,
      });
    }
    return result;
  }
}
