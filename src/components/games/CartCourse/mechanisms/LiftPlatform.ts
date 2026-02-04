/**
 * Lift Platform Mechanism (Phase 3)
 * L/R button controlled platform that moves vertically
 * Hold button to raise, release to lower
 */

import Matter from "matter-js";
import {
  MECHANISM_COLLISION_FILTER,
  MECHANISM_CONFIG,
} from "../data/constants";
import {
  LiftPlatformMechanism,
  MechanismConfig,
  MechanismType,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Configuration Interface
// ============================================

export interface LiftPlatformConfig {
  id: string;
  x: number;
  y: number; // Base position (lowest)
  type: MechanismType.L_LIFT_PLATFORM | MechanismType.R_LIFT_PLATFORM;
  liftHeight?: number; // How far it can lift
  moveSpeed?: number; // Pixels per second
  returnSpeed?: number; // Speed when lowering
  platformWidth?: number;
  platformHeight?: number;
  holdToMaintain?: boolean; // Must hold to keep raised
}

// ============================================
// Create Lift Platform
// ============================================

export function createLiftPlatform(
  config: LiftPlatformConfig,
  world: Matter.World,
): LiftPlatformMechanism {
  const defaults = MECHANISM_CONFIG.liftPlatform;

  const {
    id,
    x,
    y,
    type,
    liftHeight = defaults.defaultLiftHeight,
    moveSpeed = defaults.defaultMoveSpeed,
    returnSpeed = defaults.defaultReturnSpeed,
    platformWidth = defaults.platformWidth,
    platformHeight = defaults.platformHeight,
    holdToMaintain = defaults.holdToMaintain,
  } = config;

  // Create platform body
  const platform = Matter.Bodies.rectangle(
    x,
    y,
    platformWidth,
    platformHeight,
    {
      isStatic: true, // We control position manually
      label: `lift_platform_${id}`,
      friction: 0.9,
      frictionStatic: 1.0,
      collisionFilter: MECHANISM_COLLISION_FILTER,
      plugin: {
        mechanismId: id,
        mechanismType: type,
        isPlatform: true,
        isLiftPlatform: true,
      },
    },
  );

  // Add to world
  Matter.World.add(world, platform);

  // Build mechanism config
  const mechanismConfig: MechanismConfig = {
    id,
    type,
    controlType:
      type === MechanismType.L_LIFT_PLATFORM ? "left_button" : "right_button",
    startPosition: { x, y },
    endPosition: { x, y: y - liftHeight }, // Y decreases going up
    moveSpeed,
    returnSpeed,
  };

  // Create and return the mechanism entity
  const mechanism: LiftPlatformMechanism = {
    id,
    type,
    position: { x, y },
    config: mechanismConfig,
    state: "idle",
    progress: 0,
    renderer: "lift_platform",
    platform,
    baseY: y,
    maxLiftY: y - liftHeight,
    currentLift: 0,
  };

  return mechanism;
}

// ============================================
// Update Lift Platform
// ============================================

export function updateLiftPlatform(
  mechanism: LiftPlatformMechanism,
  isButtonHeld: boolean,
  deltaTime: number,
): void {
  const { config, baseY, maxLiftY, platform } = mechanism;
  const moveSpeed =
    config.moveSpeed ?? MECHANISM_CONFIG.liftPlatform.defaultMoveSpeed;
  const returnSpeed =
    config.returnSpeed ?? MECHANISM_CONFIG.liftPlatform.defaultReturnSpeed;

  // Delta time in seconds
  const dt = deltaTime / 1000;

  // Calculate lift distance
  const liftDistance = baseY - maxLiftY;

  if (isButtonHeld) {
    // Raise platform
    mechanism.state = "active";
    const liftIncrement = (moveSpeed * dt) / liftDistance;
    mechanism.currentLift = Math.min(1, mechanism.currentLift + liftIncrement);
  } else {
    // Lower platform
    mechanism.state = mechanism.currentLift > 0 ? "returning" : "idle";
    const lowerIncrement = (returnSpeed * dt) / liftDistance;
    mechanism.currentLift = Math.max(0, mechanism.currentLift - lowerIncrement);
  }

  // Update progress
  mechanism.progress = mechanism.currentLift;

  // Calculate new Y position using linear interpolation
  const newY = lerp(baseY, maxLiftY, mechanism.currentLift);

  // Update Matter.js body position
  Matter.Body.setPosition(platform, {
    x: platform.position.x,
    y: newY,
  });
}

// ============================================
// Get Platform Position
// ============================================

export function getLiftPlatformPosition(
  mechanism: LiftPlatformMechanism,
): Vector2D {
  return {
    x: mechanism.platform.position.x,
    y: mechanism.platform.position.y,
  };
}

// ============================================
// Get Lift Progress (0-1)
// ============================================

export function getLiftProgress(mechanism: LiftPlatformMechanism): number {
  return mechanism.currentLift;
}

// ============================================
// Reset Lift Platform
// ============================================

export function resetLiftPlatform(mechanism: LiftPlatformMechanism): void {
  mechanism.currentLift = 0;
  mechanism.state = "idle";
  mechanism.progress = 0;

  // Reset to base position
  Matter.Body.setPosition(mechanism.platform, {
    x: mechanism.position.x,
    y: mechanism.baseY,
  });
}

// ============================================
// Remove Lift Platform from World
// ============================================

export function removeLiftPlatform(
  mechanism: LiftPlatformMechanism,
  world: Matter.World,
): void {
  Matter.World.remove(world, mechanism.platform);
}

// ============================================
// Check if Cart is on Platform
// ============================================

export function isCartOnLiftPlatform(
  mechanism: LiftPlatformMechanism,
  cartBody: Matter.Body,
  threshold: number = 5,
): boolean {
  const platformBounds = mechanism.platform.bounds;
  const cartPosition = cartBody.position;

  // Check if cart is above the platform and within horizontal bounds
  const isAbove = cartPosition.y < mechanism.platform.position.y;
  const isWithinX =
    cartPosition.x >= platformBounds.min.x - threshold &&
    cartPosition.x <= platformBounds.max.x + threshold;
  const isCloseY =
    Math.abs(cartPosition.y - platformBounds.min.y) < threshold * 3;

  return isAbove && isWithinX && isCloseY;
}

// ============================================
// Helper: Linear Interpolation
// ============================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
