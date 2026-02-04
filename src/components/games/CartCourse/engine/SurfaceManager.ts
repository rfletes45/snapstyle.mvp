/**
 * Surface Manager (Phase 2)
 * Manages surface-specific friction and material properties
 */

import Matter from "matter-js";
import { SURFACE_MATERIALS, WHEEL_PHYSICS } from "../data/constants";
import {
  SurfaceManager,
  SurfaceMaterial,
  SurfaceType,
  WheelState,
} from "../types/cartCourse.types";

// ============================================
// Create Surface Manager
// ============================================

export function createSurfaceManager(): SurfaceManager {
  const materials = new Map<SurfaceType, SurfaceMaterial>();

  // Initialize materials from constants
  Object.values(SurfaceType).forEach((type) => {
    materials.set(type, SURFACE_MATERIALS[type]);
  });

  return {
    materials,

    getMaterial(type: SurfaceType): SurfaceMaterial {
      return materials.get(type) ?? SURFACE_MATERIALS[SurfaceType.NORMAL];
    },

    applyFriction(body: Matter.Body, surfaceType: SurfaceType): void {
      const material = this.getMaterial(surfaceType);
      body.friction = material.friction;
      body.frictionStatic = material.frictionStatic;
      body.restitution = material.restitution;
    },
  };
}

// ============================================
// Wheel Grip Calculation
// ============================================

export function calculateWheelGrip(
  wheelBody: Matter.Body,
  surfaceType: SurfaceType,
  wheelState: WheelState,
): number {
  const frictionMultiplier =
    WHEEL_PHYSICS.surfaceFrictionMultipliers[surfaceType];

  // Base grip from surface
  let grip = WHEEL_PHYSICS.baseGrip * frictionMultiplier;

  // Reduce grip if wheel is slipping
  if (wheelState.isSlipping) {
    grip *= 0.5; // Reduced grip when slipping
  }

  // Clamp grip between 0 and 1
  return Math.max(0, Math.min(1, grip));
}

// ============================================
// Slip Detection
// ============================================

export function detectWheelSlip(
  wheelBody: Matter.Body,
  expectedVelocity: number, // Based on cart movement
  actualAngularVelocity: number,
): boolean {
  // Calculate what the wheel's angular velocity should be based on linear movement
  const expectedAngularVelocity =
    expectedVelocity / (wheelBody.circleRadius ?? 8);

  // Check if there's a significant difference (slip)
  const velocityDifference = Math.abs(
    expectedAngularVelocity - actualAngularVelocity,
  );

  return velocityDifference > WHEEL_PHYSICS.slipThreshold;
}

// ============================================
// Update Wheel State
// ============================================

export function updateWheelState(
  wheelBody: Matter.Body,
  currentState: WheelState,
  cartVelocityX: number,
  surfaceType: SurfaceType | null,
  deltaTime: number,
): WheelState {
  const newState = { ...currentState };

  // Update angular velocity
  newState.angularVelocity = wheelBody.angularVelocity;

  // Update surface contact
  newState.surfaceContact = surfaceType;

  // Detect slipping
  if (surfaceType) {
    const expectedVelocity = cartVelocityX;
    newState.isSlipping = detectWheelSlip(
      wheelBody,
      expectedVelocity,
      wheelBody.angularVelocity,
    );

    // Calculate grip
    newState.grip = calculateWheelGrip(wheelBody, surfaceType, newState);

    // Recovery from slip
    if (!newState.isSlipping && currentState.isSlipping) {
      // Smooth grip recovery
      newState.grip = Math.min(
        1,
        currentState.grip + WHEEL_PHYSICS.gripRecoveryRate * deltaTime,
      );
    }
  } else {
    // Airborne - no grip
    newState.isSlipping = false;
    newState.grip = 0;
    newState.surfaceContact = null;
  }

  return newState;
}

// ============================================
// Create Initial Wheel State
// ============================================

export function createInitialWheelState(): WheelState {
  return {
    angularVelocity: 0,
    isSlipping: false,
    surfaceContact: null,
    grip: 1.0,
    temperature: 0,
  };
}

// ============================================
// Get Surface Type from Body
// ============================================

export function getSurfaceTypeFromBody(body: Matter.Body): SurfaceType {
  const plugin = body.plugin as { surfaceType?: SurfaceType } | undefined;
  return plugin?.surfaceType ?? SurfaceType.NORMAL;
}

// ============================================
// Apply Surface Effect to Cart
// ============================================

export function applySurfaceEffectToCart(
  cartBody: Matter.Body,
  leftWheel: Matter.Body,
  rightWheel: Matter.Body,
  surfaceType: SurfaceType,
): void {
  const material = SURFACE_MATERIALS[surfaceType];
  const frictionMultiplier =
    WHEEL_PHYSICS.surfaceFrictionMultipliers[surfaceType];

  // Adjust wheel friction based on surface
  leftWheel.friction = leftWheel.friction * frictionMultiplier;
  rightWheel.friction = rightWheel.friction * frictionMultiplier;

  // Special effects for certain surfaces
  switch (surfaceType) {
    case SurfaceType.SLIPPERY:
      // Reduce air friction for sliding feeling
      cartBody.frictionAir = 0.001;
      break;

    case SurfaceType.STICKY:
      // Increase air friction for sluggish feeling
      cartBody.frictionAir = 0.05;
      break;

    case SurfaceType.BOUNCY:
      // Already handled by restitution
      break;

    default:
      // Reset to normal air friction
      cartBody.frictionAir = 0.01;
  }
}
