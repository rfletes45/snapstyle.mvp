/**
 * Matter.js World Setup
 * Configures the physics engine with gravity and collision handling
 */

import Matter from "matter-js";
import { CRASH_CONFIG, PHYSICS_CONFIG } from "../data/constants";
import { COLLISION_CATEGORIES, CrashType } from "../types/cartCourse.types";

// ============================================
// World Creation
// ============================================

export interface MatterWorldInstance {
  engine: Matter.Engine;
  world: Matter.World;
  cleanup: () => void;
}

export function createMatterWorld(): MatterWorldInstance {
  // Create engine with gravity
  const engine = Matter.Engine.create({
    gravity: {
      x: PHYSICS_CONFIG.gravity.x,
      y: PHYSICS_CONFIG.gravity.y,
    },
    enableSleeping: PHYSICS_CONFIG.enableSleeping,
  });

  const world = engine.world;

  // Cleanup function
  const cleanup = () => {
    Matter.World.clear(world, false);
    Matter.Engine.clear(engine);
  };

  return { engine, world, cleanup };
}

// ============================================
// Collision Detection Helpers
// ============================================

export function isCartPart(body: Matter.Body): boolean {
  return (
    body.label === "cart_body" ||
    body.label === "cart_wheel_left" ||
    body.label === "cart_wheel_right"
  );
}

export function isHazard(body: Matter.Body): boolean {
  return body.collisionFilter?.category === COLLISION_CATEGORIES.HAZARD;
}

export function isCheckpoint(body: Matter.Body): boolean {
  return body.collisionFilter?.category === COLLISION_CATEGORIES.CHECKPOINT;
}

export function isCollectible(body: Matter.Body): boolean {
  return body.collisionFilter?.category === COLLISION_CATEGORIES.COLLECTIBLE;
}

export function isPlatform(body: Matter.Body): boolean {
  return body.collisionFilter?.category === COLLISION_CATEGORIES.PLATFORM;
}

export function isWall(body: Matter.Body): boolean {
  return body.collisionFilter?.category === COLLISION_CATEGORIES.WALL;
}

export function isBumper(body: Matter.Body): boolean {
  const plugin = body.plugin as { isBumper?: boolean } | undefined;
  return plugin?.isBumper === true;
}

// ============================================
// Collision Event Handler Setup (Phase 2 Enhanced)
// ============================================

export interface CollisionCallbacks {
  onCrash: (type: CrashType, position: Matter.Vector) => void;
  onCheckpoint?: (index: number) => void;
  onCollectible?: (id: string) => void;
  onPlatformContact?: (isGrounded: boolean, surfaceType?: string) => void;
  onBumperHit?: (position: Matter.Vector, bounceVelocity: number) => void;
  onSurfaceChange?: (surfaceType: string) => void;
}

export function setupCollisionHandler(
  engine: Matter.Engine,
  callbacks: CollisionCallbacks,
): () => void {
  const collisionStartHandler = (
    event: Matter.IEventCollision<Matter.Engine>,
  ) => {
    event.pairs.forEach((pair) => {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      // Check for cart collision
      if (isCartPart(bodyA) || isCartPart(bodyB)) {
        const cartPart = isCartPart(bodyA) ? bodyA : bodyB;
        const otherBody = isCartPart(bodyA) ? bodyB : bodyA;

        // Calculate impact velocity
        const relativeVelocity = Matter.Vector.sub(
          cartPart.velocity,
          otherBody.isStatic ? { x: 0, y: 0 } : otherBody.velocity,
        );
        const impactSpeed = Matter.Vector.magnitude(relativeVelocity);

        // Get surface type from plugin data
        const plugin = otherBody.plugin as
          | { surfaceType?: string; isBumper?: boolean }
          | undefined;
        const surfaceType = plugin?.surfaceType ?? "normal";
        const bodyIsBumper = plugin?.isBumper === true;

        // Check for hazard crash (always fatal)
        if (isHazard(otherBody)) {
          callbacks.onCrash(CrashType.HAZARD, cartPart.position);
          return;
        }

        // Phase 2: Bumper hit - no crash, just bounce callback
        if (bodyIsBumper || isBumper(otherBody)) {
          if (callbacks.onBumperHit) {
            callbacks.onBumperHit(cartPart.position, impactSpeed);
          }
          // Bumpers don't cause crashes - the high restitution handles the bounce
          return;
        }

        // Phase 2: Surface-specific crash thresholds
        const impactThreshold = getImpactThresholdForSurface(surfaceType);

        // Check for high-velocity wall impact crash
        if (isWall(otherBody) && impactSpeed > impactThreshold) {
          callbacks.onCrash(CrashType.WALL_IMPACT, cartPart.position);
          return;
        }

        // Check for checkpoint
        if (isCheckpoint(otherBody) && callbacks.onCheckpoint) {
          const checkpointIndex =
            (otherBody as any).plugin?.checkpointIndex ?? 0;
          callbacks.onCheckpoint(checkpointIndex);
        }

        // Check for collectible
        if (isCollectible(otherBody) && callbacks.onCollectible) {
          const collectibleId =
            (otherBody as any).plugin?.id ?? otherBody.id.toString();
          callbacks.onCollectible(collectibleId);
        }

        // Platform contact for grounded state with surface type
        if (isPlatform(otherBody) && callbacks.onPlatformContact) {
          callbacks.onPlatformContact(true, surfaceType);

          // Notify of surface change
          if (callbacks.onSurfaceChange) {
            callbacks.onSurfaceChange(surfaceType);
          }
        }
      }
    });
  };

  const collisionEndHandler = (
    event: Matter.IEventCollision<Matter.Engine>,
  ) => {
    event.pairs.forEach((pair) => {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      if (isCartPart(bodyA) || isCartPart(bodyB)) {
        const otherBody = isCartPart(bodyA) ? bodyB : bodyA;

        // Platform contact ended
        if (isPlatform(otherBody) && callbacks.onPlatformContact) {
          // Note: This is simplified - in real impl, need to track all contacts
          callbacks.onPlatformContact(false);
        }
      }
    });
  };

  // Register event handlers
  Matter.Events.on(engine, "collisionStart", collisionStartHandler);
  Matter.Events.on(engine, "collisionEnd", collisionEndHandler);

  // Return cleanup function
  return () => {
    Matter.Events.off(engine, "collisionStart", collisionStartHandler);
    Matter.Events.off(engine, "collisionEnd", collisionEndHandler);
  };
}

// ============================================
// Flip Crash Detection
// ============================================

export function checkFlipCrash(cart: Matter.Composite): boolean {
  const cartBody = cart.bodies.find((b) => b.label === "cart_body");
  if (!cartBody) return false;

  // Normalize angle to -180 to 180 degrees
  const angleDegrees = (cartBody.angle * 180) / Math.PI;
  const normalizedAngle = ((angleDegrees % 360) + 360) % 360;
  const adjustedAngle =
    normalizedAngle > 180 ? normalizedAngle - 360 : normalizedAngle;

  // Crash if tilted more than threshold from upright
  return Math.abs(adjustedAngle) > CRASH_CONFIG.maxRotationDegrees;
}

// ============================================
// Enhanced Flip Crash Detection (Phase 2)
// Considers both angle AND angular velocity
// ============================================

export interface FlipCrashResult {
  isCrash: boolean;
  angle: number;
  angularVelocity: number;
  canRecover: boolean;
}

export function checkFlipCrashWithVelocity(
  cart: Matter.Composite,
): FlipCrashResult {
  const cartBody = cart.bodies.find((b) => b.label === "cart_body");
  if (!cartBody) {
    return { isCrash: false, angle: 0, angularVelocity: 0, canRecover: true };
  }

  // Calculate normalized angle
  const angleDegrees = (cartBody.angle * 180) / Math.PI;
  const normalizedAngle = ((angleDegrees % 360) + 360) % 360;
  const adjustedAngle =
    normalizedAngle > 180 ? normalizedAngle - 360 : normalizedAngle;

  const absAngle = Math.abs(adjustedAngle);
  const angularVelocity = Math.abs(cartBody.angularVelocity);

  // Recovery zone: angle is recoverable but not too far gone
  const canRecover =
    absAngle < CRASH_CONFIG.flipAngleRecoveryThreshold &&
    angularVelocity < CRASH_CONFIG.flipAngularVelocityThreshold;

  // Crash conditions:
  // 1. Angle exceeds maximum threshold OR
  // 2. Angle is in danger zone AND spinning too fast to recover
  const inDangerZone = absAngle > CRASH_CONFIG.flipAngleRecoveryThreshold * 0.8;
  const spinningTooFast =
    angularVelocity > CRASH_CONFIG.flipAngularVelocityThreshold;

  const isCrash =
    absAngle > CRASH_CONFIG.maxRotationDegrees ||
    (inDangerZone && spinningTooFast);

  return {
    isCrash,
    angle: adjustedAngle,
    angularVelocity,
    canRecover,
  };
}

// ============================================
// Surface-Specific Impact Threshold (Phase 2)
// ============================================

export function getImpactThresholdForSurface(surfaceType: string): number {
  // Match against known surface types
  const thresholds: Record<string, number> = {
    normal: CRASH_CONFIG.maxImpactVelocity,
    slippery: CRASH_CONFIG.maxImpactVelocity * 1.25, // Higher - slides instead
    sticky: CRASH_CONFIG.maxImpactVelocity * 0.75, // Lower - sticks on impact
    bouncy: 999, // Bumpers never cause crash
    rough: CRASH_CONFIG.maxImpactVelocity * 0.9,
    metal: CRASH_CONFIG.maxImpactVelocity * 1.1,
  };

  return thresholds[surfaceType] ?? CRASH_CONFIG.maxImpactVelocity;
}

// ============================================
// Fall Crash Detection
// ============================================

export function checkFallCrash(cart: Matter.Composite, maxY: number): boolean {
  const cartBody = cart.bodies.find((b) => b.label === "cart_body");
  return cartBody ? cartBody.position.y > maxY : false;
}

// ============================================
// Utility: Linear Interpolation
// ============================================

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================
// Utility: Clamp Value
// ============================================

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
