/**
 * Auto Rotate Mechanism (Phase 4)
 * Platform rotates automatically when cart touches it
 */

import Matter from "matter-js";
import { MECHANISM_COLLISION_FILTER } from "../data/constants";
import {
  AutoRotateMechanism,
  MechanismConfig,
  MechanismType,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Configuration Interface
// ============================================

export interface AutoRotateConfig {
  id: string;
  x: number;
  y: number;
  type: MechanismType.AUTO_ROTATE;
  rotationAngle?: number; // Total rotation in degrees
  rotationSpeed?: number; // Degrees per second
  triggerOnce?: boolean; // Only triggers once per attempt
  resetDelay?: number; // Milliseconds before resetting
  pivotPoint?: "center" | "left" | "right"; // Where platform pivots
  platformWidth?: number;
  platformHeight?: number;
  activationThreshold?: number; // How much weight needed to trigger
}

// ============================================
// Default Configuration
// ============================================

const AUTO_ROTATE_DEFAULTS = {
  rotationAngle: 90, // degrees
  rotationSpeed: 120, // degrees per second
  triggerOnce: false,
  resetDelay: 500, // ms
  pivotPoint: "center" as const,
  platformWidth: 100,
  platformHeight: 15,
  activationThreshold: 0.3, // 30% of cart weight
};

// ============================================
// Create Auto Rotate Mechanism
// ============================================

export function createAutoRotate(
  config: AutoRotateConfig,
  world: Matter.World,
): AutoRotateMechanism {
  const {
    id,
    x,
    y,
    type,
    rotationAngle = AUTO_ROTATE_DEFAULTS.rotationAngle,
    rotationSpeed = AUTO_ROTATE_DEFAULTS.rotationSpeed,
    triggerOnce = AUTO_ROTATE_DEFAULTS.triggerOnce,
    resetDelay = AUTO_ROTATE_DEFAULTS.resetDelay,
    pivotPoint = AUTO_ROTATE_DEFAULTS.pivotPoint,
    platformWidth = AUTO_ROTATE_DEFAULTS.platformWidth,
    platformHeight = AUTO_ROTATE_DEFAULTS.platformHeight,
    activationThreshold = AUTO_ROTATE_DEFAULTS.activationThreshold,
  } = config;

  // Calculate pivot offset based on pivot point
  let pivotOffset = 0;
  if (pivotPoint === "left") {
    pivotOffset = -platformWidth / 2;
  } else if (pivotPoint === "right") {
    pivotOffset = platformWidth / 2;
  }

  // Create platform body
  const platform = Matter.Bodies.rectangle(
    x,
    y,
    platformWidth,
    platformHeight,
    {
      isStatic: true, // We control rotation directly
      label: `auto_rotate_${id}`,
      friction: 0.9,
      frictionStatic: 1.0,
      collisionFilter: MECHANISM_COLLISION_FILTER,
      plugin: {
        mechanismId: id,
        mechanismType: type,
        isPlatform: true,
        isAutoRotate: true,
      },
    },
  );

  // Add to world
  Matter.World.add(world, platform);

  // Build mechanism config
  const mechanismConfig: MechanismConfig = {
    controlType: "auto",
    rotationRange: { min: 0, max: rotationAngle },
    rotationSpeed,
  };

  // Calculate pivot position based on pivot point setting
  const pivotPosition: Vector2D = {
    x: x + pivotOffset,
    y,
  };

  // Create and return mechanism entity
  const mechanism: AutoRotateMechanism = {
    id,
    type,
    position: { x, y },
    config: mechanismConfig,
    state: "idle",
    progress: 0,
    renderer: "auto_rotate",
    platform,
    currentAngle: 0,
    targetAngle: 0,
    rotationAngle,
    rotationSpeed,
    pivotPoint,
    pivotOffset,
    pivotPosition,
    isTriggered: false,
    triggerOnce,
    resetDelay,
    lastTriggerTime: 0,
    cartOnPlatform: false,
  };

  return mechanism;
}

// ============================================
// Update Auto Rotate
// ============================================

export function updateAutoRotate(
  mechanism: AutoRotateMechanism,
  isCartOnPlatform: boolean,
  deltaTime: number,
): void {
  const { rotationAngle, rotationSpeed, triggerOnce, resetDelay } = mechanism;
  const dt = deltaTime / 1000;

  // Track cart presence
  const cartJustLanded = isCartOnPlatform && !mechanism.cartOnPlatform;
  const cartJustLeft = !isCartOnPlatform && mechanism.cartOnPlatform;
  mechanism.cartOnPlatform = isCartOnPlatform;

  // Handle triggering
  if (cartJustLanded && !mechanism.isTriggered) {
    mechanism.isTriggered = true;
    mechanism.lastTriggerTime = Date.now();
    mechanism.targetAngle = rotationAngle;
    mechanism.state = "active";
  }

  // Check reset condition
  if (mechanism.isTriggered && !triggerOnce) {
    const timeSinceTrigger = Date.now() - mechanism.lastTriggerTime;
    if (cartJustLeft && timeSinceTrigger > resetDelay) {
      // Start reset after delay
      mechanism.targetAngle = 0;
      mechanism.state = "returning";
    }
  }

  // Smoothly rotate toward target
  const angleDiff = mechanism.targetAngle - mechanism.currentAngle;
  if (Math.abs(angleDiff) > 0.1) {
    const rotateAmount = Math.sign(angleDiff) * rotationSpeed * dt;
    if (Math.abs(rotateAmount) > Math.abs(angleDiff)) {
      mechanism.currentAngle = mechanism.targetAngle;
    } else {
      mechanism.currentAngle += rotateAmount;
    }
  } else {
    mechanism.currentAngle = mechanism.targetAngle;
    if (mechanism.targetAngle === 0 && !isCartOnPlatform) {
      mechanism.state = "idle";
      mechanism.isTriggered = false;
    }
  }

  // Update progress
  mechanism.progress = Math.abs(mechanism.currentAngle) / rotationAngle;

  // Update platform rotation
  const angleRad = (mechanism.currentAngle * Math.PI) / 180;
  Matter.Body.setAngle(mechanism.platform, angleRad);

  // If pivot is not center, adjust position to rotate around pivot point
  if (mechanism.pivotOffset !== 0) {
    const originalX = mechanism.position.x;
    const originalY = mechanism.position.y;

    // Calculate new center position based on rotation around pivot
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const dx = -mechanism.pivotOffset * (1 - cosA);
    const dy = mechanism.pivotOffset * sinA;

    Matter.Body.setPosition(mechanism.platform, {
      x: originalX + dx,
      y: originalY + dy,
    });
  }
}

// ============================================
// Check if Cart is on Auto Rotate Platform
// ============================================

export function isCartOnAutoRotate(
  mechanism: AutoRotateMechanism,
  cartBody: Matter.Body,
  threshold: number = 35,
): boolean {
  const platformPos = mechanism.platform.position;
  const cartPos = cartBody.position;
  const platformBounds = mechanism.platform.bounds;

  // Get platform dimensions (accounting for rotation)
  const platformWidth = platformBounds.max.x - platformBounds.min.x;
  const platformHeight = platformBounds.max.y - platformBounds.min.y;

  // Check if cart is within platform bounds plus threshold
  const horizontalDist = Math.abs(cartPos.x - platformPos.x);
  const verticalDist = platformBounds.min.y - cartPos.y;

  // Cart should be above and aligned with platform
  return (
    horizontalDist < platformWidth / 2 + threshold &&
    verticalDist > 0 &&
    verticalDist < threshold
  );
}

// ============================================
// Reset Auto Rotate
// ============================================

export function resetAutoRotate(mechanism: AutoRotateMechanism): void {
  mechanism.currentAngle = 0;
  mechanism.targetAngle = 0;
  mechanism.isTriggered = false;
  mechanism.state = "idle";
  mechanism.progress = 0;
  mechanism.cartOnPlatform = false;

  // Reset platform rotation
  Matter.Body.setAngle(mechanism.platform, 0);
  Matter.Body.setPosition(mechanism.platform, {
    x: mechanism.position.x,
    y: mechanism.position.y,
  });
}

// ============================================
// Remove Auto Rotate from World
// ============================================

export function removeAutoRotate(
  mechanism: AutoRotateMechanism,
  world: Matter.World,
): void {
  Matter.World.remove(world, mechanism.platform);
}

// ============================================
// Get Platform Position
// ============================================

export function getAutoRotatePosition(
  mechanism: AutoRotateMechanism,
): Vector2D {
  return {
    x: mechanism.platform.position.x,
    y: mechanism.platform.position.y,
  };
}
