/**
 * Mini Golf — Planck.js Physics Simulation
 *
 * Deterministic fixed-timestep simulation. Creates a Planck world,
 * builds fixtures from HoleDef, applies shot impulse, and steps
 * until the ball stops or hits max steps.
 *
 * CRITICAL: This file is used identically on client and server.
 * Do NOT use Math.random() or any non-deterministic operations.
 *
 * @module gamesV4/games/miniGolf/physics/sim
 */

import * as planck from "planck";
import type { HoleDef, MiniGolfEvent, SimulationResult, Vec2 } from "../types";
import {
  dequantizeAngle,
  dequantizePower,
  quantizePos,
} from "../utils/quantize";

// =============================================================================
// Constants
// =============================================================================

const FIXED_DT = 1 / 60;
const MAX_STEPS = 900; // 15 seconds max
const BALL_RADIUS = 0.06;
const BALL_DENSITY = 1.0;
const BALL_FRICTION = 0.3;
const BALL_RESTITUTION = 0.5;
const BALL_LINEAR_DAMPING = 0.8; // Turf baseline
const MAX_SHOT_IMPULSE = 4.0; // Max impulse magnitude
const STOP_SPEED_THRESHOLD = 0.02;
const STOP_FRAMES_REQUIRED = 12;
const CUP_SINK_SPEED_THRESHOLD = 1.5;
const CUP_SINK_FRAMES_REQUIRED = 3;
const PORTAL_COOLDOWN_FRAMES = 30;
const MAX_EVENTS = 20;

// Surface damping multipliers (applied as linearDamping override)
const DAMPING_TURF = 0.8;
const DAMPING_SAND = 3.5;
const DAMPING_ICE = 0.1;
const DAMPING_ROUGH = 2.0;

// =============================================================================
// User data types for fixtures
// =============================================================================

interface FixtureUserData {
  type:
    | "wall"
    | "bumper"
    | "cup"
    | "surface"
    | "hazard"
    | "portal"
    | "conveyor"
    | "slope"
    | "boost"
    | "gate";
  subType?: string;
  portalId?: string;
  targetId?: string;
  exitOffset?: Vec2;
  force?: Vec2;
  impulse?: Vec2;
  surfaceType?: string;
  hazardType?: string;
}

// =============================================================================
// Simulation entry point
// =============================================================================

export function simulateShot(
  hole: HoleDef,
  startPos: Vec2,
  angleQ: number,
  powerQ: number,
): SimulationResult {
  const world = planck.World({ gravity: planck.Vec2(0, 0) });

  // ── Build static fixtures ─────────────────────────────────────────

  // Walls
  for (const wallDef of hole.walls) {
    const body = world.createBody({ type: "static" });
    const pts = wallDef.points.map((p) => planck.Vec2(p.x, p.y));
    if (wallDef.loop && pts.length >= 3) {
      body.createFixture({
        shape: planck.Chain(pts, true),
        friction: 0.2,
        restitution: 0.6,
        userData: { type: "wall" } as FixtureUserData,
      });
    } else if (pts.length >= 2) {
      body.createFixture({
        shape: planck.Chain(pts, false),
        friction: 0.2,
        restitution: 0.6,
        userData: { type: "wall" } as FixtureUserData,
      });
    }
  }

  // Bumpers
  for (const b of hole.bumpers ?? []) {
    const body = world.createBody({
      type: "static",
      position: planck.Vec2(b.pos.x, b.pos.y),
    });
    body.createFixture({
      shape: planck.Circle(b.radius),
      friction: 0.1,
      restitution: Math.min(b.restitution ?? 1.2, 1.5),
      userData: { type: "bumper" } as FixtureUserData,
    });
  }

  // Cup (sensor)
  const cupBody = world.createBody({
    type: "static",
    position: planck.Vec2(hole.cup.x, hole.cup.y),
  });
  cupBody.createFixture({
    shape: planck.Circle(hole.cupRadius),
    isSensor: true,
    userData: { type: "cup" } as FixtureUserData,
  });

  // Surface regions (sensors)
  for (const s of hole.surfaces ?? []) {
    const body = world.createBody({ type: "static" });
    const verts = s.vertices.map((v) => planck.Vec2(v.x, v.y));
    if (verts.length >= 3) {
      body.createFixture({
        shape: planck.Polygon(verts),
        isSensor: true,
        userData: { type: "surface", surfaceType: s.type } as FixtureUserData,
      });
    }
  }

  // Hazard regions (sensors)
  for (const h of hole.hazards ?? []) {
    const body = world.createBody({ type: "static" });
    const verts = h.vertices.map((v) => planck.Vec2(v.x, v.y));
    if (verts.length >= 3) {
      body.createFixture({
        shape: planck.Polygon(verts),
        isSensor: true,
        userData: { type: "hazard", hazardType: h.type } as FixtureUserData,
      });
    }
  }

  // Portals (sensors)
  for (const p of hole.portals ?? []) {
    const body = world.createBody({
      type: "static",
      position: planck.Vec2(p.pos.x, p.pos.y),
    });
    body.createFixture({
      shape: planck.Circle(p.radius),
      isSensor: true,
      userData: {
        type: "portal",
        portalId: p.id,
        targetId: p.targetId,
        exitOffset: p.exitOffset,
      } as FixtureUserData,
    });
  }

  // Conveyors (sensors)
  for (const c of hole.conveyors ?? []) {
    const body = world.createBody({ type: "static" });
    const verts = c.vertices.map((v) => planck.Vec2(v.x, v.y));
    if (verts.length >= 3) {
      body.createFixture({
        shape: planck.Polygon(verts),
        isSensor: true,
        userData: { type: "conveyor", force: c.force } as FixtureUserData,
      });
    }
  }

  // Slopes (sensors)
  for (const s of hole.slopes ?? []) {
    const body = world.createBody({ type: "static" });
    const verts = s.vertices.map((v) => planck.Vec2(v.x, v.y));
    if (verts.length >= 3) {
      body.createFixture({
        shape: planck.Polygon(verts),
        isSensor: true,
        userData: { type: "slope", force: s.force } as FixtureUserData,
      });
    }
  }

  // Boosts (sensors)
  for (const b of hole.boosts ?? []) {
    const body = world.createBody({ type: "static" });
    const verts = b.vertices.map((v) => planck.Vec2(v.x, v.y));
    if (verts.length >= 3) {
      body.createFixture({
        shape: planck.Polygon(verts),
        isSensor: true,
        userData: { type: "boost", impulse: b.impulse } as FixtureUserData,
      });
    }
  }

  // Rotating gates (kinematic bodies)
  const gateInfos: Array<{ body: planck.Body; angVel: number }> = [];
  for (const g of hole.rotatingGates ?? []) {
    const gateBody = world.createBody({
      type: "kinematic",
      position: planck.Vec2(g.pivot.x, g.pivot.y),
      angle: g.initialAngle ?? 0,
    });
    gateBody.createFixture({
      shape: planck.Box(g.length / 2, g.thickness / 2),
      friction: 0.2,
      restitution: 0.5,
      userData: { type: "gate" } as FixtureUserData,
    });
    gateBody.setAngularVelocity(g.angularVelocity);
    gateInfos.push({ body: gateBody, angVel: g.angularVelocity });
  }

  // ── Create ball ───────────────────────────────────────────────────

  const ballBody = world.createBody({
    type: "dynamic",
    position: planck.Vec2(startPos.x, startPos.y),
    bullet: true,
    linearDamping: BALL_LINEAR_DAMPING,
    angularDamping: 1.0,
  });
  ballBody.createFixture({
    shape: planck.Circle(BALL_RADIUS),
    density: BALL_DENSITY,
    friction: BALL_FRICTION,
    restitution: BALL_RESTITUTION,
  });

  // Apply initial impulse
  const angle = dequantizeAngle(angleQ);
  const power = dequantizePower(powerQ);
  const impulseX = Math.cos(angle) * power * MAX_SHOT_IMPULSE;
  const impulseY = -Math.sin(angle) * power * MAX_SHOT_IMPULSE; // negative Y = up in screen coords
  ballBody.applyLinearImpulse(
    planck.Vec2(impulseX, impulseY),
    ballBody.getWorldCenter(),
  );

  // ── Track state ───────────────────────────────────────────────────

  const events: MiniGolfEvent[] = [];
  let sunk = false;
  let penalty = false;
  let penaltyType: "water" | "out_of_bounds" | undefined;
  let wallContact = false;
  let bumperContact = false;
  let sandContact = false;
  let stopFrames = 0;
  let cupFrames = 0;
  let portalCooldown = 0;
  let boostApplied = new Set<string>();

  // Track current overlapping sensors
  const activeSensors = new Set<string>();

  // Contact listener
  world.on("begin-contact", (contact) => {
    const fA = contact.getFixtureA();
    const fB = contact.getFixtureB();
    const udA = fA.getUserData() as FixtureUserData | null;
    const udB = fB.getUserData() as FixtureUserData | null;

    // Determine which fixture is the "other" (non-ball)
    const other =
      fA.getBody() === ballBody ? udB : fB.getBody() === ballBody ? udA : null;
    if (!other) return;

    if (other.type === "wall") {
      wallContact = true;
    } else if (other.type === "bumper") {
      bumperContact = true;
    } else if (other.type === "cup") {
      activeSensors.add("cup");
    } else if (other.type === "hazard") {
      activeSensors.add(`hazard_${other.hazardType}`);
    } else if (other.type === "surface") {
      activeSensors.add(`surface_${other.surfaceType}`);
      if (other.surfaceType === "sand") sandContact = true;
    } else if (other.type === "portal") {
      activeSensors.add(`portal_${other.portalId}`);
    } else if (other.type === "conveyor") {
      activeSensors.add(`conveyor_${other.force?.x}_${other.force?.y}`);
    } else if (other.type === "slope") {
      activeSensors.add(`slope_${other.force?.x}_${other.force?.y}`);
    } else if (other.type === "boost") {
      const key = `boost_${other.impulse?.x}_${other.impulse?.y}`;
      activeSensors.add(key);
    } else if (other.type === "gate") {
      wallContact = true; // gates count as wall contact
    }
  });

  world.on("end-contact", (contact) => {
    const fA = contact.getFixtureA();
    const fB = contact.getFixtureB();
    const udA = fA.getUserData() as FixtureUserData | null;
    const udB = fB.getUserData() as FixtureUserData | null;
    const other =
      fA.getBody() === ballBody ? udB : fB.getBody() === ballBody ? udA : null;
    if (!other) return;

    if (other.type === "cup") {
      activeSensors.delete("cup");
      cupFrames = 0;
    } else if (other.type === "hazard") {
      activeSensors.delete(`hazard_${other.hazardType}`);
    } else if (other.type === "surface") {
      activeSensors.delete(`surface_${other.surfaceType}`);
    } else if (other.type === "portal") {
      activeSensors.delete(`portal_${other.portalId}`);
    } else if (other.type === "conveyor") {
      activeSensors.delete(`conveyor_${other.force?.x}_${other.force?.y}`);
    } else if (other.type === "slope") {
      activeSensors.delete(`slope_${other.force?.x}_${other.force?.y}`);
    } else if (other.type === "boost") {
      const key = `boost_${other.impulse?.x}_${other.impulse?.y}`;
      activeSensors.delete(key);
    }
  });

  // ── Step loop ─────────────────────────────────────────────────────

  let step = 0;
  for (step = 0; step < MAX_STEPS; step++) {
    // Update rotating gates deterministically
    for (const gi of gateInfos) {
      gi.body.setAngularVelocity(gi.angVel);
    }

    // Apply surface modifiers
    let currentDamping = DAMPING_TURF;
    for (const key of activeSensors) {
      if (key === "surface_sand")
        currentDamping = Math.max(currentDamping, DAMPING_SAND);
      else if (key === "surface_ice") currentDamping = DAMPING_ICE;
      else if (key === "surface_rough")
        currentDamping = Math.max(currentDamping, DAMPING_ROUGH);
    }
    ballBody.setLinearDamping(currentDamping);

    // Apply conveyor forces
    for (const key of activeSensors) {
      if (key.startsWith("conveyor_")) {
        const parts = key.split("_");
        const fx = parseFloat(parts[1]);
        const fy = parseFloat(parts[2]);
        if (!isNaN(fx) && !isNaN(fy)) {
          ballBody.applyForce(planck.Vec2(fx, fy), ballBody.getWorldCenter());
        }
      }
    }

    // Apply slope forces
    for (const key of activeSensors) {
      if (key.startsWith("slope_")) {
        const parts = key.split("_");
        const fx = parseFloat(parts[1]);
        const fy = parseFloat(parts[2]);
        if (!isNaN(fx) && !isNaN(fy)) {
          ballBody.applyForce(planck.Vec2(fx, fy), ballBody.getWorldCenter());
        }
      }
    }

    // Apply boost impulse (once per entry)
    for (const key of activeSensors) {
      if (key.startsWith("boost_") && !boostApplied.has(key)) {
        const parts = key.split("_");
        const ix = parseFloat(parts[1]);
        const iy = parseFloat(parts[2]);
        if (!isNaN(ix) && !isNaN(iy)) {
          ballBody.applyLinearImpulse(
            planck.Vec2(ix, iy),
            ballBody.getWorldCenter(),
          );
          boostApplied.add(key);
          if (events.length < MAX_EVENTS) {
            events.push({ t: step, type: "boost" });
          }
        }
      }
    }

    // Portal teleport
    if (portalCooldown > 0) {
      portalCooldown--;
    } else {
      for (const key of activeSensors) {
        if (key.startsWith("portal_")) {
          const portalId = key.substring(7);
          // Find the portal def
          const portalDef = hole.portals?.find((p) => p.id === portalId);
          if (portalDef) {
            const targetPortal = hole.portals?.find(
              (p) => p.id === portalDef.targetId,
            );
            if (targetPortal) {
              const exitX = targetPortal.pos.x + portalDef.exitOffset.x;
              const exitY = targetPortal.pos.y + portalDef.exitOffset.y;
              ballBody.setPosition(planck.Vec2(exitX, exitY));
              portalCooldown = PORTAL_COOLDOWN_FRAMES;
              if (events.length < MAX_EVENTS) {
                events.push({
                  t: step,
                  type: "portal",
                  data: { from: portalId, to: portalDef.targetId },
                });
              }
              break;
            }
          }
        }
      }
    }

    // Step world
    world.step(FIXED_DT);

    // Check hazards
    for (const key of activeSensors) {
      if (key === "hazard_water" || key === "hazard_out_of_bounds") {
        penalty = true;
        penaltyType = key === "hazard_water" ? "water" : "out_of_bounds";
        if (events.length < MAX_EVENTS) {
          events.push({
            t: step,
            type: "hazard",
            data: { hazardType: penaltyType },
          });
        }
        // Stop immediately
        step = MAX_STEPS;
        break;
      }
    }
    if (penalty) break;

    // Check out of bounds (ball outside hole bounds)
    const bpos = ballBody.getPosition();
    if (
      bpos.x < -0.5 ||
      bpos.x > hole.bounds.width + 0.5 ||
      bpos.y < -0.5 ||
      bpos.y > hole.bounds.height + 0.5
    ) {
      penalty = true;
      penaltyType = "out_of_bounds";
      if (events.length < MAX_EVENTS) {
        events.push({ t: step, type: "out_of_bounds" });
      }
      break;
    }

    // Check cup sink
    if (activeSensors.has("cup")) {
      const speed = ballBody.getLinearVelocity().length();
      if (speed < CUP_SINK_SPEED_THRESHOLD) {
        cupFrames++;
        if (cupFrames >= CUP_SINK_FRAMES_REQUIRED) {
          sunk = true;
          if (events.length < MAX_EVENTS) {
            events.push({ t: step, type: "sunk" });
          }
          break;
        }
      } else {
        cupFrames = 0;
      }
    }

    // Check stop condition
    const speed = ballBody.getLinearVelocity().length();
    if (speed < STOP_SPEED_THRESHOLD) {
      stopFrames++;
      if (stopFrames >= STOP_FRAMES_REQUIRED) {
        if (events.length < MAX_EVENTS) {
          events.push({ t: step, type: "stopped" });
        }
        break;
      }
    } else {
      stopFrames = 0;
    }
  }

  // ── Collect results ───────────────────────────────────────────────

  const finalRawPos = ballBody.getPosition();
  const finalPos = quantizePos(finalRawPos.x, finalRawPos.y);
  const resetPos = penalty ? quantizePos(startPos.x, startPos.y) : finalPos;

  // Clear all boost tracking for next shot
  boostApplied.clear();

  return {
    finalPos: sunk ? quantizePos(hole.cup.x, hole.cup.y) : finalPos,
    sunk,
    penalty,
    penaltyType,
    resetPos,
    events,
    wallContact,
    bumperContact,
    sandContact,
    totalSteps: step,
  };
}

// =============================================================================
// Frame-by-frame position generator (for client-side rolling playback)
// =============================================================================

/**
 * Re-runs the deterministic sim and captures the ball position at every step.
 * Returns an array of Vec2 with length === totalSteps (from the original sim).
 * Clients use this to animate the ball smoothly during the "rolling" phase.
 *
 * IMPORTANT: Uses the exact same Planck setup as `simulateShot` so results
 * are bit-identical.  We stop playback at `maxSteps` even if the ball is
 * still moving so the array length matches `rolling.totalSteps`.
 */
export function simulateShotPositions(
  hole: HoleDef,
  startPos: Vec2,
  angleQ: number,
  powerQ: number,
  maxSteps: number = MAX_STEPS,
): Vec2[] {
  const positions: Vec2[] = [];
  const world = planck.World({ gravity: planck.Vec2(0, 0) });

  // ── Build static fixtures (identical to simulateShot) ──────────────

  for (const wallDef of hole.walls) {
    const body = world.createBody({ type: "static" });
    const pts = wallDef.points.map((p) => planck.Vec2(p.x, p.y));
    if (wallDef.loop && pts.length >= 3) {
      body.createFixture({
        shape: planck.Chain(pts, true),
        friction: 0.2,
        restitution: 0.6,
        userData: { type: "wall" } as FixtureUserData,
      });
    } else if (pts.length >= 2) {
      body.createFixture({
        shape: planck.Chain(pts, false),
        friction: 0.2,
        restitution: 0.6,
        userData: { type: "wall" } as FixtureUserData,
      });
    }
  }

  for (const b of hole.bumpers ?? []) {
    const body = world.createBody({
      type: "static",
      position: planck.Vec2(b.pos.x, b.pos.y),
    });
    body.createFixture({
      shape: planck.Circle(b.radius),
      friction: 0.1,
      restitution: Math.min(b.restitution ?? 1.2, 1.5),
      userData: { type: "bumper" } as FixtureUserData,
    });
  }

  const cupBody = world.createBody({
    type: "static",
    position: planck.Vec2(hole.cup.x, hole.cup.y),
  });
  cupBody.createFixture({
    shape: planck.Circle(hole.cupRadius),
    isSensor: true,
    userData: { type: "cup" } as FixtureUserData,
  });

  for (const s of hole.surfaces ?? []) {
    const body = world.createBody({ type: "static" });
    const verts = s.vertices.map((v) => planck.Vec2(v.x, v.y));
    if (verts.length >= 3) {
      body.createFixture({
        shape: planck.Polygon(verts),
        isSensor: true,
        userData: { type: "surface", surfaceType: s.type } as FixtureUserData,
      });
    }
  }

  for (const h of hole.hazards ?? []) {
    const body = world.createBody({ type: "static" });
    const verts = h.vertices.map((v) => planck.Vec2(v.x, v.y));
    if (verts.length >= 3) {
      body.createFixture({
        shape: planck.Polygon(verts),
        isSensor: true,
        userData: { type: "hazard", hazardType: h.type } as FixtureUserData,
      });
    }
  }

  for (const p of hole.portals ?? []) {
    const body = world.createBody({
      type: "static",
      position: planck.Vec2(p.pos.x, p.pos.y),
    });
    body.createFixture({
      shape: planck.Circle(p.radius),
      isSensor: true,
      userData: {
        type: "portal",
        portalId: p.id,
        targetId: p.targetId,
        exitOffset: p.exitOffset,
      } as FixtureUserData,
    });
  }

  for (const c of hole.conveyors ?? []) {
    const body = world.createBody({ type: "static" });
    const verts = c.vertices.map((v) => planck.Vec2(v.x, v.y));
    if (verts.length >= 3) {
      body.createFixture({
        shape: planck.Polygon(verts),
        isSensor: true,
        userData: { type: "conveyor", force: c.force } as FixtureUserData,
      });
    }
  }

  for (const s of hole.slopes ?? []) {
    const body = world.createBody({ type: "static" });
    const verts = s.vertices.map((v) => planck.Vec2(v.x, v.y));
    if (verts.length >= 3) {
      body.createFixture({
        shape: planck.Polygon(verts),
        isSensor: true,
        userData: { type: "slope", force: s.force } as FixtureUserData,
      });
    }
  }

  for (const b of hole.boosts ?? []) {
    const body = world.createBody({ type: "static" });
    const verts = b.vertices.map((v) => planck.Vec2(v.x, v.y));
    if (verts.length >= 3) {
      body.createFixture({
        shape: planck.Polygon(verts),
        isSensor: true,
        userData: { type: "boost", impulse: b.impulse } as FixtureUserData,
      });
    }
  }

  const gateInfos: Array<{ body: planck.Body; angVel: number }> = [];
  for (const g of hole.rotatingGates ?? []) {
    const gateBody = world.createBody({
      type: "kinematic",
      position: planck.Vec2(g.pivot.x, g.pivot.y),
      angle: g.initialAngle ?? 0,
    });
    gateBody.createFixture({
      shape: planck.Box(g.length / 2, g.thickness / 2),
      friction: 0.2,
      restitution: 0.5,
      userData: { type: "gate" } as FixtureUserData,
    });
    gateBody.setAngularVelocity(g.angularVelocity);
    gateInfos.push({ body: gateBody, angVel: g.angularVelocity });
  }

  // ── Create ball ───────────────────────────────────────────────────

  const ballBody = world.createBody({
    type: "dynamic",
    position: planck.Vec2(startPos.x, startPos.y),
    bullet: true,
    linearDamping: BALL_LINEAR_DAMPING,
    angularDamping: 1.0,
  });
  ballBody.createFixture({
    shape: planck.Circle(BALL_RADIUS),
    density: BALL_DENSITY,
    friction: BALL_FRICTION,
    restitution: BALL_RESTITUTION,
  });

  const angle = dequantizeAngle(angleQ);
  const power = dequantizePower(powerQ);
  const impulseX = Math.cos(angle) * power * MAX_SHOT_IMPULSE;
  const impulseY = -Math.sin(angle) * power * MAX_SHOT_IMPULSE;
  ballBody.applyLinearImpulse(
    planck.Vec2(impulseX, impulseY),
    ballBody.getWorldCenter(),
  );

  // ── Sensor tracking (identical to simulateShot) ───────────────────

  const activeSensors = new Set<string>();
  let portalCooldown = 0;
  const boostApplied = new Set<string>();

  world.on("begin-contact", (contact) => {
    const fA = contact.getFixtureA();
    const fB = contact.getFixtureB();
    const udA = fA.getUserData() as FixtureUserData | null;
    const udB = fB.getUserData() as FixtureUserData | null;
    const other =
      fA.getBody() === ballBody ? udB : fB.getBody() === ballBody ? udA : null;
    if (!other) return;

    if (other.type === "cup") activeSensors.add("cup");
    else if (other.type === "hazard")
      activeSensors.add(`hazard_${other.hazardType}`);
    else if (other.type === "surface")
      activeSensors.add(`surface_${other.surfaceType}`);
    else if (other.type === "portal")
      activeSensors.add(`portal_${other.portalId}`);
    else if (other.type === "conveyor")
      activeSensors.add(`conveyor_${other.force?.x}_${other.force?.y}`);
    else if (other.type === "slope")
      activeSensors.add(`slope_${other.force?.x}_${other.force?.y}`);
    else if (other.type === "boost")
      activeSensors.add(`boost_${other.impulse?.x}_${other.impulse?.y}`);
  });

  world.on("end-contact", (contact) => {
    const fA = contact.getFixtureA();
    const fB = contact.getFixtureB();
    const udA = fA.getUserData() as FixtureUserData | null;
    const udB = fB.getUserData() as FixtureUserData | null;
    const other =
      fA.getBody() === ballBody ? udB : fB.getBody() === ballBody ? udA : null;
    if (!other) return;

    if (other.type === "cup") activeSensors.delete("cup");
    else if (other.type === "hazard")
      activeSensors.delete(`hazard_${other.hazardType}`);
    else if (other.type === "surface")
      activeSensors.delete(`surface_${other.surfaceType}`);
    else if (other.type === "portal")
      activeSensors.delete(`portal_${other.portalId}`);
    else if (other.type === "conveyor")
      activeSensors.delete(`conveyor_${other.force?.x}_${other.force?.y}`);
    else if (other.type === "slope")
      activeSensors.delete(`slope_${other.force?.x}_${other.force?.y}`);
    else if (other.type === "boost")
      activeSensors.delete(`boost_${other.impulse?.x}_${other.impulse?.y}`);
  });

  // ── Step loop (capture position each frame) ──────────────────────

  let stopFrames = 0;
  let cupFrames = 0;
  let sunk = false;

  for (let step = 0; step < maxSteps; step++) {
    for (const gi of gateInfos) {
      gi.body.setAngularVelocity(gi.angVel);
    }

    // Surface damping
    let currentDamping = DAMPING_TURF;
    for (const key of activeSensors) {
      if (key === "surface_sand")
        currentDamping = Math.max(currentDamping, DAMPING_SAND);
      else if (key === "surface_ice") currentDamping = DAMPING_ICE;
      else if (key === "surface_rough")
        currentDamping = Math.max(currentDamping, DAMPING_ROUGH);
    }
    ballBody.setLinearDamping(currentDamping);

    // Conveyor / slope / boost forces
    for (const key of activeSensors) {
      if (key.startsWith("conveyor_") || key.startsWith("slope_")) {
        const parts = key.split("_");
        const fx = parseFloat(parts[1]);
        const fy = parseFloat(parts[2]);
        if (!isNaN(fx) && !isNaN(fy)) {
          ballBody.applyForce(planck.Vec2(fx, fy), ballBody.getWorldCenter());
        }
      }
      if (key.startsWith("boost_") && !boostApplied.has(key)) {
        const parts = key.split("_");
        const ix = parseFloat(parts[1]);
        const iy = parseFloat(parts[2]);
        if (!isNaN(ix) && !isNaN(iy)) {
          ballBody.applyLinearImpulse(
            planck.Vec2(ix, iy),
            ballBody.getWorldCenter(),
          );
          boostApplied.add(key);
        }
      }
    }

    // Portal teleport
    if (portalCooldown > 0) {
      portalCooldown--;
    } else {
      for (const key of activeSensors) {
        if (key.startsWith("portal_")) {
          const portalId = key.substring(7);
          const portalDef = hole.portals?.find((p) => p.id === portalId);
          if (portalDef) {
            const targetPortal = hole.portals?.find(
              (p) => p.id === portalDef.targetId,
            );
            if (targetPortal) {
              const exitX = targetPortal.pos.x + portalDef.exitOffset.x;
              const exitY = targetPortal.pos.y + portalDef.exitOffset.y;
              ballBody.setPosition(planck.Vec2(exitX, exitY));
              portalCooldown = PORTAL_COOLDOWN_FRAMES;
              break;
            }
          }
        }
      }
    }

    world.step(FIXED_DT);

    const bp = ballBody.getPosition();
    positions.push({ x: bp.x, y: bp.y });

    // ── Cup sunk check ──────────────────────────────────────────────
    if (activeSensors.has("cup")) {
      const speed = ballBody.getLinearVelocity().length();
      if (speed < CUP_SINK_SPEED_THRESHOLD) {
        cupFrames++;
        if (cupFrames >= CUP_SINK_FRAMES_REQUIRED) {
          sunk = true;
          break;
        }
      } else {
        cupFrames = 0;
      }
    } else {
      cupFrames = 0;
    }

    // ── Hazard check ────────────────────────────────────────────────
    let hitHazard = false;
    for (const key of activeSensors) {
      if (key.startsWith("hazard_")) {
        hitHazard = true;
        break;
      }
    }
    if (hitHazard) break;

    // ── Stop check ──────────────────────────────────────────────────
    const speed = ballBody.getLinearVelocity().length();
    if (speed < STOP_SPEED_THRESHOLD) {
      stopFrames++;
      if (stopFrames >= STOP_FRAMES_REQUIRED) break;
    } else {
      stopFrames = 0;
    }
  }

  return positions;
}

// =============================================================================
// Exported constants for tests / UI
// =============================================================================

export {
  BALL_RADIUS,
  FIXED_DT,
  MAX_SHOT_IMPULSE,
  MAX_STEPS,
  STOP_SPEED_THRESHOLD,
};
