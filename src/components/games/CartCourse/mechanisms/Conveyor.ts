/**
 * Conveyor Belt Mechanism (Phase 4)
 * Applies constant velocity to cart when in contact
 */

import Matter from "matter-js";
import { MECHANISM_COLLISION_FILTER } from "../data/constants";
import {
  ConveyorMechanism,
  MechanismConfig,
  MechanismType,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Configuration Interface
// ============================================

export interface ConveyorConfig {
  id: string;
  x: number;
  y: number;
  type: MechanismType.CONVEYOR;
  width?: number;
  height?: number;
  speed?: number; // Pixels per second
  direction?: "left" | "right"; // Direction of movement
  active?: boolean; // Can be toggled
  visualSegments?: number; // Number of animated belt segments
}

// ============================================
// Default Configuration
// ============================================

const CONVEYOR_DEFAULTS = {
  width: 200,
  height: 20,
  speed: 100, // pixels per second
  direction: "right" as const,
  active: true,
  visualSegments: 8,
};

// ============================================
// Create Conveyor
// ============================================

export function createConveyor(
  config: ConveyorConfig,
  world: Matter.World,
): ConveyorMechanism {
  const {
    id,
    x,
    y,
    type,
    width = CONVEYOR_DEFAULTS.width,
    height = CONVEYOR_DEFAULTS.height,
    speed = CONVEYOR_DEFAULTS.speed,
    direction = CONVEYOR_DEFAULTS.direction,
    active = CONVEYOR_DEFAULTS.active,
    visualSegments = CONVEYOR_DEFAULTS.visualSegments,
  } = config;

  // Create conveyor belt body
  const belt = Matter.Bodies.rectangle(x, y, width, height, {
    isStatic: true,
    label: `conveyor_${id}`,
    friction: 0.95, // High friction to "grip" cart
    frictionStatic: 1.0,
    collisionFilter: MECHANISM_COLLISION_FILTER,
    plugin: {
      mechanismId: id,
      mechanismType: type,
      isPlatform: true,
      isConveyor: true,
      conveyorSpeed: direction === "right" ? speed : -speed,
    },
  });

  // Add to world
  Matter.World.add(world, belt);

  // Build mechanism config
  const mechanismConfig: MechanismConfig = {
    controlType: "auto",
    moveSpeed: speed,
  };

  // Create and return mechanism entity
  const mechanism: ConveyorMechanism = {
    id,
    type,
    position: { x, y },
    config: mechanismConfig,
    state: active ? "active" : "idle",
    progress: 0,
    renderer: "conveyor",
    belt,
    speed,
    direction,
    isActive: active,
    animationOffset: 0, // For visual animation
    visualSegments,
    beltWidth: width,
    beltHeight: height,
  };

  return mechanism;
}

// ============================================
// Update Conveyor
// ============================================

export function updateConveyor(
  mechanism: ConveyorMechanism,
  deltaTime: number,
): void {
  if (!mechanism.isActive) {
    mechanism.state = "idle";
    return;
  }

  mechanism.state = "active";

  // Update animation offset for visual belt movement
  const dt = deltaTime / 1000;
  const animationSpeed = mechanism.speed * 0.02; // Scale for visual
  mechanism.animationOffset += animationSpeed * dt;

  // Wrap animation offset
  if (mechanism.animationOffset > 1) {
    mechanism.animationOffset -= 1;
  }

  // Progress cycles for visual indication
  mechanism.progress = mechanism.animationOffset;
}

// ============================================
// Apply Conveyor Force to Cart
// ============================================

export function applyConveyorForce(
  mechanism: ConveyorMechanism,
  cartBody: Matter.Body,
  deltaTime: number,
): void {
  if (!mechanism.isActive) return;

  // Calculate conveyor velocity
  const velocityX =
    mechanism.direction === "right" ? mechanism.speed : -mechanism.speed;

  // Apply a gentle force to push cart in conveyor direction
  // Instead of setting velocity directly (which feels unnatural),
  // we apply a force that gradually moves the cart
  const forceScale = 0.0001; // Small force for gradual acceleration
  const force = {
    x: velocityX * forceScale,
    y: 0,
  };

  Matter.Body.applyForce(cartBody, cartBody.position, force);
}

// ============================================
// Check if Cart is on Conveyor
// ============================================

export function isCartOnConveyor(
  mechanism: ConveyorMechanism,
  cartBody: Matter.Body,
  threshold: number = 30,
): boolean {
  const beltPos = mechanism.belt.position;
  const cartPos = cartBody.position;
  const beltBounds = mechanism.belt.bounds;

  // Get belt dimensions
  const beltWidth = beltBounds.max.x - beltBounds.min.x;

  // Check horizontal alignment
  const horizontalDist = Math.abs(cartPos.x - beltPos.x);
  if (horizontalDist > beltWidth / 2 + threshold) {
    return false;
  }

  // Check vertical position (cart should be above belt)
  const beltTop = beltBounds.min.y;
  const verticalDist = beltTop - cartPos.y;

  return verticalDist > 0 && verticalDist < threshold;
}

// ============================================
// Toggle Conveyor Active State
// ============================================

export function toggleConveyor(mechanism: ConveyorMechanism): void {
  mechanism.isActive = !mechanism.isActive;
  mechanism.state = mechanism.isActive ? "active" : "idle";

  // Update body plugin
  mechanism.belt.plugin.conveyorSpeed = mechanism.isActive
    ? mechanism.direction === "right"
      ? mechanism.speed
      : -mechanism.speed
    : 0;
}

// ============================================
// Set Conveyor Direction
// ============================================

export function setConveyorDirection(
  mechanism: ConveyorMechanism,
  direction: "left" | "right",
): void {
  mechanism.direction = direction;

  // Update body plugin
  if (mechanism.isActive) {
    mechanism.belt.plugin.conveyorSpeed =
      direction === "right" ? mechanism.speed : -mechanism.speed;
  }
}

// ============================================
// Set Conveyor Speed
// ============================================

export function setConveyorSpeed(
  mechanism: ConveyorMechanism,
  speed: number,
): void {
  mechanism.speed = Math.abs(speed);

  // Update body plugin
  if (mechanism.isActive) {
    mechanism.belt.plugin.conveyorSpeed =
      mechanism.direction === "right" ? speed : -speed;
  }
}

// ============================================
// Reset Conveyor
// ============================================

export function resetConveyor(mechanism: ConveyorMechanism): void {
  mechanism.animationOffset = 0;
  mechanism.progress = 0;
  // Keep active state as configured
}

// ============================================
// Remove Conveyor from World
// ============================================

export function removeConveyor(
  mechanism: ConveyorMechanism,
  world: Matter.World,
): void {
  Matter.World.remove(world, mechanism.belt);
}

// ============================================
// Get Conveyor Position
// ============================================

export function getConveyorPosition(mechanism: ConveyorMechanism): Vector2D {
  return {
    x: mechanism.belt.position.x,
    y: mechanism.belt.position.y,
  };
}

// ============================================
// Get Conveyor Velocity (for cart effect)
// ============================================

export function getConveyorVelocity(mechanism: ConveyorMechanism): number {
  if (!mechanism.isActive) return 0;
  return mechanism.direction === "right" ? mechanism.speed : -mechanism.speed;
}
