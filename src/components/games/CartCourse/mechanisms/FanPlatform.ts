/**
 * Fan Platform Mechanism (Phase 4)
 * Blow or tap to lift platform - microphone or touch controlled
 */

import Matter from "matter-js";
import { MECHANISM_COLLISION_FILTER } from "../data/constants";
import {
  FanPlatformMechanism,
  MechanismConfig,
  MechanismType,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Configuration Interface
// ============================================

export interface FanPlatformConfig {
  id: string;
  x: number;
  y: number;
  type: MechanismType.FAN_PLATFORM;
  liftHeight?: number; // How high platform lifts
  liftSpeed?: number; // How fast it rises when active
  descentSpeed?: number; // How fast it falls when inactive
  platformWidth?: number;
  platformHeight?: number;
  holdToMaintain?: boolean; // Must keep blowing to stay up
  maxHoldTime?: number; // Optional time limit for holding
}

// ============================================
// Default Configuration
// ============================================

const FAN_DEFAULTS = {
  liftHeight: 150, // pixels
  liftSpeed: 2.5, // 0-1 progress per second (fast rise)
  descentSpeed: 1.0, // 0-1 progress per second (slower fall)
  platformWidth: 100,
  platformHeight: 15,
  holdToMaintain: true,
  maxHoldTime: 0, // 0 = no limit
};

// ============================================
// Create Fan Platform
// ============================================

export function createFanPlatform(
  config: FanPlatformConfig,
  world: Matter.World,
): FanPlatformMechanism {
  const {
    id,
    x,
    y,
    type,
    liftHeight = FAN_DEFAULTS.liftHeight,
    liftSpeed = FAN_DEFAULTS.liftSpeed,
    descentSpeed = FAN_DEFAULTS.descentSpeed,
    platformWidth = FAN_DEFAULTS.platformWidth,
    platformHeight = FAN_DEFAULTS.platformHeight,
    holdToMaintain = FAN_DEFAULTS.holdToMaintain,
    maxHoldTime = FAN_DEFAULTS.maxHoldTime,
  } = config;

  // Create platform body
  const platform = Matter.Bodies.rectangle(
    x,
    y,
    platformWidth,
    platformHeight,
    {
      isStatic: true, // We control position directly
      label: `fan_platform_${id}`,
      friction: 0.9,
      frictionStatic: 1.0,
      collisionFilter: MECHANISM_COLLISION_FILTER,
      plugin: {
        mechanismId: id,
        mechanismType: type,
        isPlatform: true,
        isFanPlatform: true,
      },
    },
  );

  // Add to world
  Matter.World.add(world, platform);

  // Calculate lift positions
  const baseY = y;
  const maxLiftY = y - liftHeight;

  // Build mechanism config
  const mechanismConfig: MechanismConfig = {
    controlType: "blow",
    moveSpeed: liftSpeed,
    startPosition: { x, y: baseY },
    endPosition: { x, y: maxLiftY },
  };

  // Create and return mechanism entity
  const mechanism: FanPlatformMechanism = {
    id,
    type,
    position: { x, y },
    config: mechanismConfig,
    state: "idle",
    progress: 0,
    renderer: "fan_platform",
    platform,
    baseY,
    maxLiftY,
    currentLift: 0, // 0 = base, 1 = fully lifted
    liftSpeed,
    descentSpeed,
    holdToMaintain,
    blowStartTime: 0,
    totalBlowTime: 0,
  };

  return mechanism;
}

// ============================================
// Update Fan Platform
// ============================================

export function updateFanPlatform(
  mechanism: FanPlatformMechanism,
  isBlowing: boolean,
  deltaTime: number,
): void {
  const { liftSpeed, descentSpeed, holdToMaintain, baseY, maxLiftY } =
    mechanism;
  const dt = deltaTime / 1000; // Convert to seconds

  if (isBlowing) {
    // Lift platform
    mechanism.state = "active";
    mechanism.currentLift = Math.min(1, mechanism.currentLift + liftSpeed * dt);

    // Track blow duration
    if (mechanism.blowStartTime === 0) {
      mechanism.blowStartTime = Date.now();
    }
    mechanism.totalBlowTime += deltaTime;
  } else if (holdToMaintain) {
    // Lower platform when not blowing
    if (mechanism.currentLift > 0) {
      mechanism.state = "returning";
      mechanism.currentLift = Math.max(
        0,
        mechanism.currentLift - descentSpeed * dt,
      );
    } else {
      mechanism.state = "idle";
    }

    // Reset blow tracking
    mechanism.blowStartTime = 0;
  } else {
    // Stay at current position when not hold-to-maintain
    mechanism.state = mechanism.currentLift > 0 ? "active" : "idle";
    mechanism.blowStartTime = 0;
  }

  // Update progress for visual feedback
  mechanism.progress = mechanism.currentLift;

  // Update platform position
  const newY = lerp(baseY, maxLiftY, mechanism.currentLift);
  Matter.Body.setPosition(mechanism.platform, {
    x: mechanism.platform.position.x,
    y: newY,
  });
}

// ============================================
// Check if Cart is on Fan Platform
// ============================================

export function isCartOnFanPlatform(
  mechanism: FanPlatformMechanism,
  cartBody: Matter.Body,
  threshold: number = 30,
): boolean {
  const platformPos = mechanism.platform.position;
  const cartPos = cartBody.position;

  // Check horizontal alignment
  const platformBounds = mechanism.platform.bounds;
  const platformWidth = platformBounds.max.x - platformBounds.min.x;
  const horizontalDist = Math.abs(cartPos.x - platformPos.x);

  if (horizontalDist > platformWidth / 2 + threshold) {
    return false;
  }

  // Check vertical position (cart should be above platform)
  const platformTop = platformBounds.min.y;
  const verticalDist = platformTop - cartPos.y;

  return verticalDist > 0 && verticalDist < threshold;
}

// ============================================
// Get Fan Platform Position
// ============================================

export function getFanPlatformPosition(
  mechanism: FanPlatformMechanism,
): Vector2D {
  return {
    x: mechanism.platform.position.x,
    y: mechanism.platform.position.y,
  };
}

// ============================================
// Get Lift Progress
// ============================================

export function getFanLiftProgress(mechanism: FanPlatformMechanism): number {
  return mechanism.currentLift;
}

// ============================================
// Reset Fan Platform
// ============================================

export function resetFanPlatform(mechanism: FanPlatformMechanism): void {
  mechanism.currentLift = 0;
  mechanism.state = "idle";
  mechanism.progress = 0;
  mechanism.blowStartTime = 0;
  mechanism.totalBlowTime = 0;

  // Reset position to base
  Matter.Body.setPosition(mechanism.platform, {
    x: mechanism.position.x,
    y: mechanism.baseY,
  });
}

// ============================================
// Remove Fan Platform from World
// ============================================

export function removeFanPlatform(
  mechanism: FanPlatformMechanism,
  world: Matter.World,
): void {
  Matter.World.remove(world, mechanism.platform);
}

// ============================================
// Helper Functions
// ============================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
