/**
 * Launcher Platform Mechanism (Phase 4)
 * Hold to charge, release to launch cart with impulse
 */

import Matter from "matter-js";
import { MECHANISM_COLLISION_FILTER } from "../data/constants";
import {
  LauncherPlatformMechanism,
  MechanismConfig,
  MechanismType,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Configuration Interface
// ============================================

export interface LauncherPlatformConfig {
  id: string;
  x: number;
  y: number;
  type: MechanismType.R_LAUNCHER;
  maxLaunchForce?: number; // Maximum impulse force
  chargeTime?: number; // Seconds to full charge
  launchDirection?: Vector2D; // Normalized direction vector
  platformWidth?: number;
  platformHeight?: number;
  activationRadius?: number; // How close cart must be to launch
  visualChargeIndicator?: boolean;
}

// ============================================
// Default Configuration
// ============================================

const LAUNCHER_DEFAULTS = {
  maxLaunchForce: 0.015, // Matter.js impulse scale
  chargeTime: 1.5, // 1.5 seconds to full charge
  launchDirection: { x: 0, y: -1 }, // Up by default
  platformWidth: 80,
  platformHeight: 20,
  activationRadius: 50, // Cart must be within 50px
  visualChargeIndicator: true,
};

// ============================================
// Create Launcher Platform
// ============================================

export function createLauncherPlatform(
  config: LauncherPlatformConfig,
  world: Matter.World,
): LauncherPlatformMechanism {
  const {
    id,
    x,
    y,
    type,
    maxLaunchForce = LAUNCHER_DEFAULTS.maxLaunchForce,
    chargeTime = LAUNCHER_DEFAULTS.chargeTime,
    launchDirection = LAUNCHER_DEFAULTS.launchDirection,
    platformWidth = LAUNCHER_DEFAULTS.platformWidth,
    platformHeight = LAUNCHER_DEFAULTS.platformHeight,
    activationRadius = LAUNCHER_DEFAULTS.activationRadius,
    visualChargeIndicator = LAUNCHER_DEFAULTS.visualChargeIndicator,
  } = config;

  // Create platform body
  const platform = Matter.Bodies.rectangle(
    x,
    y,
    platformWidth,
    platformHeight,
    {
      isStatic: true,
      label: `launcher_platform_${id}`,
      friction: 0.9,
      frictionStatic: 1.0,
      collisionFilter: MECHANISM_COLLISION_FILTER,
      plugin: {
        mechanismId: id,
        mechanismType: type,
        isPlatform: true,
        isLauncher: true,
      },
    },
  );

  // Add to world
  Matter.World.add(world, platform);

  // Build mechanism config
  const mechanismConfig: MechanismConfig = {
    controlType: "right_button",
    launchForce: maxLaunchForce,
    chargeTime,
    launchDirection: normalizeVector(launchDirection),
  };

  // Create and return mechanism entity
  const mechanism: LauncherPlatformMechanism = {
    id,
    type,
    position: { x, y },
    config: mechanismConfig,
    state: "idle",
    progress: 0,
    renderer: "launcher_platform",
    platform,
    chargeLevel: 0,
    isCharging: false,
    maxLaunchForce,
    chargeTime,
    launchDirection: normalizeVector(launchDirection),
    activationRadius,
    lastLaunchTime: 0,
  };

  return mechanism;
}

// ============================================
// Update Launcher Platform
// ============================================

export function updateLauncherPlatform(
  mechanism: LauncherPlatformMechanism,
  isButtonHeld: boolean,
  deltaTime: number,
): void {
  const { chargeTime } = mechanism;
  const dt = deltaTime / 1000; // Convert to seconds

  if (isButtonHeld) {
    // Start or continue charging
    mechanism.isCharging = true;
    mechanism.state = "active";

    // Increase charge level
    mechanism.chargeLevel = Math.min(
      1,
      mechanism.chargeLevel + dt / chargeTime,
    );
    mechanism.progress = mechanism.chargeLevel;
  } else if (mechanism.isCharging) {
    // Button released while charging - this triggers the launch
    // The actual launch is handled by the system that checks cart proximity
    mechanism.state = "transitioning";
  } else {
    // Not charging, reset
    mechanism.state = "idle";
    mechanism.progress = 0;
    mechanism.chargeLevel = 0;
  }
}

// ============================================
// Launch Cart
// ============================================

export function launchCart(
  mechanism: LauncherPlatformMechanism,
  cartBody: Matter.Body,
): boolean {
  if (!mechanism.isCharging || mechanism.chargeLevel <= 0) {
    return false;
  }

  // Check if cart is within activation radius
  const distance = getDistance(
    mechanism.position,
    cartBody.position as Vector2D,
  );

  if (distance > mechanism.activationRadius) {
    // Reset charging state
    mechanism.isCharging = false;
    mechanism.chargeLevel = 0;
    mechanism.state = "idle";
    mechanism.progress = 0;
    return false;
  }

  // Calculate impulse based on charge level
  const power = mechanism.chargeLevel;
  const force = mechanism.maxLaunchForce * power;

  const impulse = {
    x: mechanism.launchDirection.x * force,
    y: mechanism.launchDirection.y * force,
  };

  // Apply impulse to cart
  Matter.Body.applyForce(cartBody, cartBody.position, impulse);

  // Record launch time and reset
  mechanism.lastLaunchTime = Date.now();
  mechanism.isCharging = false;
  mechanism.chargeLevel = 0;
  mechanism.state = "idle";
  mechanism.progress = 0;

  return true;
}

// ============================================
// Check if Cart is on Launcher
// ============================================

export function isCartOnLauncher(
  mechanism: LauncherPlatformMechanism,
  cartBody: Matter.Body,
  threshold: number = 30,
): boolean {
  const platformPos = mechanism.platform.position;
  const cartPos = cartBody.position;

  // Check horizontal alignment
  const platformWidth =
    mechanism.platform.bounds.max.x - mechanism.platform.bounds.min.x;
  const horizontalDist = Math.abs(cartPos.x - platformPos.x);

  if (horizontalDist > platformWidth / 2 + threshold) {
    return false;
  }

  // Check vertical position (cart should be above platform)
  const platformTop = mechanism.platform.bounds.min.y;
  const verticalDist = platformTop - cartPos.y;

  return verticalDist > 0 && verticalDist < threshold;
}

// ============================================
// Reset Launcher Platform
// ============================================

export function resetLauncherPlatform(
  mechanism: LauncherPlatformMechanism,
): void {
  mechanism.chargeLevel = 0;
  mechanism.isCharging = false;
  mechanism.state = "idle";
  mechanism.progress = 0;
}

// ============================================
// Remove Launcher Platform from World
// ============================================

export function removeLauncherPlatform(
  mechanism: LauncherPlatformMechanism,
  world: Matter.World,
): void {
  Matter.World.remove(world, mechanism.platform);
}

// ============================================
// Get Charge Level (for UI)
// ============================================

export function getLauncherChargeLevel(
  mechanism: LauncherPlatformMechanism,
): number {
  return mechanism.chargeLevel;
}

// ============================================
// Helper Functions
// ============================================

function normalizeVector(v: Vector2D): Vector2D {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag === 0) return { x: 0, y: -1 }; // Default up
  return { x: v.x / mag, y: v.y / mag };
}

function getDistance(a: Vector2D, b: Vector2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
