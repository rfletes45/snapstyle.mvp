/**
 * Joystick Gear Mechanism (Phase 3)
 * Joystick controlled gear that rotates an attached platform
 * Rotation is mapped to joystick angle
 */

import Matter from "matter-js";
import {
  MECHANISM_COLLISION_FILTER,
  MECHANISM_CONFIG,
} from "../data/constants";
import {
  JoystickGearMechanism,
  JoystickInput,
  MechanismConfig,
  MechanismType,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Configuration Interface
// ============================================

export interface JoystickGearConfig {
  id: string;
  x: number;
  y: number;
  type: MechanismType.LEFT_STICK_GEAR | MechanismType.RIGHT_STICK_GEAR;
  maxRotation?: number; // Max degrees from center
  rotationSpeed?: number; // How fast it responds
  armLength?: number;
  platformWidth?: number;
  platformHeight?: number;
  gearRadius?: number;
  returnToNeutral?: boolean;
  returnSpeed?: number;
  deadzone?: number;
}

// ============================================
// Create Joystick Gear
// ============================================

export function createJoystickGear(
  config: JoystickGearConfig,
  world: Matter.World,
): JoystickGearMechanism {
  const defaults = MECHANISM_CONFIG.joystickGear;
  const rotatingDefaults = MECHANISM_CONFIG.rotatingGear;

  const {
    id,
    x,
    y,
    type,
    maxRotation = defaults.maxRotation,
    rotationSpeed = defaults.defaultRotationSpeed,
    armLength = defaults.armLength,
    platformWidth = rotatingDefaults.platformWidth,
    platformHeight = rotatingDefaults.platformHeight,
    gearRadius = rotatingDefaults.gearRadius,
    returnToNeutral = defaults.returnToNeutral,
    returnSpeed = defaults.returnSpeed,
    deadzone = defaults.deadzone,
  } = config;

  // Create gear body (visual only, no collisions)
  const gearBody = Matter.Bodies.circle(x, y, gearRadius, {
    isStatic: true,
    label: `joystick_gear_${id}`,
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
      isStatic: true,
      label: `joystick_gear_platform_${id}`,
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
      type === MechanismType.LEFT_STICK_GEAR
        ? "left_joystick"
        : "right_joystick",
    rotationRange: { min: -maxRotation, max: maxRotation },
    rotationSpeed,
    returnSpeed,
    returnToNeutral,
    armLength,
  };

  // Create and return the mechanism entity
  const mechanism: JoystickGearMechanism = {
    id,
    type,
    position: { x, y },
    config: mechanismConfig,
    state: "idle",
    progress: 0,
    renderer: "joystick_gear",
    body: gearBody,
    attachedPlatform,
    currentAngle: 0,
    armLength,
  };

  return mechanism;
}

// ============================================
// Update Joystick Gear
// ============================================

export function updateJoystickGear(
  mechanism: JoystickGearMechanism,
  joystickInput: JoystickInput,
  deltaTime: number,
): void {
  const { config, armLength, position } = mechanism;
  const rotationSpeed =
    config.rotationSpeed ?? MECHANISM_CONFIG.joystickGear.defaultRotationSpeed;
  const returnSpeed =
    config.returnSpeed ?? MECHANISM_CONFIG.joystickGear.returnSpeed;
  const maxRotation =
    config.rotationRange?.max ?? MECHANISM_CONFIG.joystickGear.maxRotation;
  const deadzone = MECHANISM_CONFIG.joystickGear.deadzone;
  const returnToNeutral = config.returnToNeutral ?? true;

  // Delta time in seconds
  const dt = deltaTime / 1000;

  let targetAngle = 0;

  if (joystickInput.magnitude > deadzone) {
    mechanism.state = "active";

    // Map joystick Y to rotation (-1 to 1 -> -maxRotation to maxRotation)
    // Using Y axis for up/down tilt of platform
    targetAngle = joystickInput.y * maxRotation;

    // Clamp to range
    targetAngle = Math.max(-maxRotation, Math.min(maxRotation, targetAngle));
  } else if (returnToNeutral) {
    mechanism.state = mechanism.currentAngle !== 0 ? "returning" : "idle";
    targetAngle = 0;
  } else {
    mechanism.state = "idle";
    targetAngle = mechanism.currentAngle; // Hold position
  }

  // Calculate interpolation speed based on whether actively controlled
  const isActive = joystickInput.magnitude > deadzone;
  const lerpSpeed = isActive
    ? Math.min(1, rotationSpeed * dt * 0.1)
    : Math.min(1, returnSpeed * dt * 0.1);

  // Smoothly interpolate toward target
  mechanism.currentAngle = lerp(mechanism.currentAngle, targetAngle, lerpSpeed);

  // Update progress (-1 to 1 based on angle)
  mechanism.progress = mechanism.currentAngle / maxRotation;

  // Update platform position based on rotation
  const angleRad = (mechanism.currentAngle * Math.PI) / 180;
  const newX = position.x + Math.cos(angleRad) * armLength;
  const newY = position.y + Math.sin(angleRad) * armLength;

  // Update Matter.js bodies
  Matter.Body.setPosition(mechanism.attachedPlatform, { x: newX, y: newY });
  Matter.Body.setAngle(mechanism.attachedPlatform, angleRad);
  Matter.Body.setAngle(mechanism.body, angleRad);
}

// ============================================
// Get Platform Position
// ============================================

export function getJoystickGearPlatformPosition(
  mechanism: JoystickGearMechanism,
): Vector2D {
  return {
    x: mechanism.attachedPlatform.position.x,
    y: mechanism.attachedPlatform.position.y,
  };
}

// ============================================
// Reset Joystick Gear
// ============================================

export function resetJoystickGear(mechanism: JoystickGearMechanism): void {
  mechanism.currentAngle = 0;
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
// Remove Joystick Gear from World
// ============================================

export function removeJoystickGear(
  mechanism: JoystickGearMechanism,
  world: Matter.World,
): void {
  Matter.World.remove(world, mechanism.body);
  Matter.World.remove(world, mechanism.attachedPlatform);
}

// ============================================
// Helper: Linear Interpolation
// ============================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
