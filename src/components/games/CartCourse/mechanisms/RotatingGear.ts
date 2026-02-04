/**
 * Rotating Gear Mechanism (Phase 3)
 * L/R button controlled gear that rotates an attached platform
 * Based on Donkey Kong's Crash Course mechanisms
 */

import Matter from "matter-js";
import {
  MECHANISM_COLLISION_FILTER,
  MECHANISM_CONFIG,
} from "../data/constants";
import {
  MechanismConfig,
  MechanismType,
  RotatingGearMechanism,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Configuration Interface
// ============================================

export interface RotatingGearConfig {
  id: string;
  x: number;
  y: number;
  type: MechanismType.L_ROTATING_GEAR | MechanismType.R_ROTATING_GEAR;
  rotationRange?: { min: number; max: number };
  rotationSpeed?: number;
  returnSpeed?: number;
  armLength?: number;
  platformWidth?: number;
  platformHeight?: number;
  gearRadius?: number;
  returnToNeutral?: boolean;
}

// ============================================
// Create Rotating Gear
// ============================================

export function createRotatingGear(
  config: RotatingGearConfig,
  world: Matter.World,
): RotatingGearMechanism {
  const defaults = MECHANISM_CONFIG.rotatingGear;

  const {
    id,
    x,
    y,
    type,
    rotationRange = { min: defaults.minRotation, max: defaults.maxRotation },
    rotationSpeed = defaults.defaultRotationSpeed,
    returnSpeed = defaults.defaultReturnSpeed,
    armLength = defaults.defaultArmLength,
    platformWidth = defaults.platformWidth,
    platformHeight = defaults.platformHeight,
    gearRadius = defaults.gearRadius,
    returnToNeutral = defaults.returnToNeutral,
  } = config;

  // Create gear body (visual only, no collisions)
  const gearBody = Matter.Bodies.circle(x, y, gearRadius, {
    isStatic: true,
    label: `gear_${id}`,
    collisionFilter: { mask: 0 }, // No collisions
    render: { visible: true },
    plugin: {
      mechanismId: id,
      mechanismType: type,
    },
  });

  // Calculate initial platform position (at 0 degrees = right of gear)
  const platformX = x + armLength;
  const platformY = y;

  // Create attached platform
  const attachedPlatform = Matter.Bodies.rectangle(
    platformX,
    platformY,
    platformWidth,
    platformHeight,
    {
      isStatic: true, // We control position manually
      label: `gear_platform_${id}`,
      friction: 0.9,
      frictionStatic: 1.0,
      collisionFilter: MECHANISM_COLLISION_FILTER,
      plugin: {
        mechanismId: id,
        mechanismType: type,
        isPlatform: true,
      },
    },
  );

  // Add bodies to world
  Matter.World.add(world, [gearBody, attachedPlatform]);

  // Build mechanism config
  const mechanismConfig: MechanismConfig = {
    id,
    type,
    controlType:
      type === MechanismType.L_ROTATING_GEAR ? "left_button" : "right_button",
    rotationRange,
    rotationSpeed,
    returnSpeed,
    returnToNeutral,
    armLength,
  };

  // Create and return the mechanism entity
  const mechanism: RotatingGearMechanism = {
    id,
    type,
    position: { x, y },
    config: mechanismConfig,
    state: "idle",
    progress: 0,
    renderer: "rotating_gear",
    body: gearBody,
    attachedPlatform,
    currentAngle: 0,
    targetAngle: 0,
    armLength,
  };

  return mechanism;
}

// ============================================
// Update Rotating Gear
// ============================================

export function updateRotatingGear(
  mechanism: RotatingGearMechanism,
  isButtonHeld: boolean,
  deltaTime: number,
): void {
  const { config, currentAngle, armLength, position } = mechanism;
  const rotationSpeed =
    config.rotationSpeed ?? MECHANISM_CONFIG.rotatingGear.defaultRotationSpeed;
  const returnSpeed =
    config.returnSpeed ?? MECHANISM_CONFIG.rotatingGear.defaultReturnSpeed;
  const rotationRange = config.rotationRange ?? {
    min: MECHANISM_CONFIG.rotatingGear.minRotation,
    max: MECHANISM_CONFIG.rotatingGear.maxRotation,
  };
  const returnToNeutral = config.returnToNeutral ?? true;

  // Delta time in seconds
  const dt = deltaTime / 1000;

  if (isButtonHeld) {
    // Rotate while button is held
    mechanism.state = "active";
    mechanism.targetAngle = Math.min(
      mechanism.targetAngle + rotationSpeed * dt,
      rotationRange.max,
    );
  } else if (returnToNeutral) {
    // Return to neutral position
    mechanism.state = mechanism.currentAngle !== 0 ? "returning" : "idle";
    mechanism.targetAngle = Math.max(
      mechanism.targetAngle - returnSpeed * dt,
      0,
    );
  }

  // Smoothly interpolate current angle toward target
  const angleDiff = mechanism.targetAngle - mechanism.currentAngle;
  const interpolationSpeed = isButtonHeld ? 0.2 : 0.15;
  mechanism.currentAngle += angleDiff * interpolationSpeed;

  // Update progress (0-1 based on rotation range)
  mechanism.progress =
    Math.abs(mechanism.currentAngle) / Math.abs(rotationRange.max);

  // Update platform position based on rotation
  const angleRad = (mechanism.currentAngle * Math.PI) / 180;
  const newX = position.x + Math.cos(angleRad) * armLength;
  const newY = position.y + Math.sin(angleRad) * armLength;

  // Update Matter.js body
  Matter.Body.setPosition(mechanism.attachedPlatform, { x: newX, y: newY });
  Matter.Body.setAngle(mechanism.attachedPlatform, angleRad);

  // Also rotate the gear visual body
  Matter.Body.setAngle(mechanism.body, angleRad);
}

// ============================================
// Get Platform Position
// ============================================

export function getGearPlatformPosition(
  mechanism: RotatingGearMechanism,
): Vector2D {
  return {
    x: mechanism.attachedPlatform.position.x,
    y: mechanism.attachedPlatform.position.y,
  };
}

// ============================================
// Reset Rotating Gear
// ============================================

export function resetRotatingGear(mechanism: RotatingGearMechanism): void {
  mechanism.currentAngle = 0;
  mechanism.targetAngle = 0;
  mechanism.state = "idle";
  mechanism.progress = 0;

  // Reset platform to initial position
  const { position, armLength } = mechanism;
  Matter.Body.setPosition(mechanism.attachedPlatform, {
    x: position.x + armLength,
    y: position.y,
  });
  Matter.Body.setAngle(mechanism.attachedPlatform, 0);
  Matter.Body.setAngle(mechanism.body, 0);
}

// ============================================
// Remove Rotating Gear from World
// ============================================

export function removeRotatingGear(
  mechanism: RotatingGearMechanism,
  world: Matter.World,
): void {
  Matter.World.remove(world, mechanism.body);
  Matter.World.remove(world, mechanism.attachedPlatform);
}
