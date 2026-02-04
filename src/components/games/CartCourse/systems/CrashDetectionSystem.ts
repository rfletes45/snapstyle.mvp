/**
 * Crash Detection System (Phase 2 Enhanced)
 * Detects when the cart has crashed and dispatches events
 * - Impact velocity threshold with surface-specific adjustments
 * - Flip angle detection with recovery window
 * - Fall out of bounds with grace period
 */

import Matter from "matter-js";
import { CRASH_CONFIG } from "../data/constants";
import {
  checkFallCrash,
  checkFlipCrashWithVelocity,
} from "../engine/MatterWorld";
import { getSurfaceTypeFromBody } from "../engine/SurfaceManager";
import {
  CrashType,
  GameEngineUpdateProps,
  GameEntities,
  SurfaceType,
} from "../types/cartCourse.types";

// ============================================
// Track Fall State
// ============================================

interface FallTracker {
  lastGroundedY: number;
  lastGroundedTime: number;
  airTime: number;
  maxFallDistance: number;
}

const fallTrackers = new Map<string, FallTracker>();

function getOrCreateFallTracker(cartId: string): FallTracker {
  if (!fallTrackers.has(cartId)) {
    fallTrackers.set(cartId, {
      lastGroundedY: 0,
      lastGroundedTime: Date.now(),
      airTime: 0,
      maxFallDistance: 0,
    });
  }
  return fallTrackers.get(cartId)!;
}

// ============================================
// Crash Detection System
// ============================================

export const CrashDetectionSystem = (
  entities: GameEntities,
  { dispatch, time }: GameEngineUpdateProps,
): GameEntities => {
  const { cart, camera } = entities;

  if (!cart || !cart.composite) {
    return entities;
  }

  const cartBody = cart.body;
  const tracker = getOrCreateFallTracker("main_cart");

  // ========== Check for flip crash ==========
  // Phase 2: Enhanced flip detection with angular velocity check
  const flipResult = checkFlipCrashWithVelocity(cart.composite);
  if (flipResult.isCrash) {
    dispatch({
      type: "crash",
      crashType: CrashType.FLIP,
    });
    return entities;
  }

  // ========== Check for fall out of bounds (pit) ==========
  const maxY = camera?.bounds?.maxY ?? 1000;
  if (checkFallCrash(cart.composite, maxY + CRASH_CONFIG.pitThreshold)) {
    dispatch({ type: "crash", crashType: CrashType.PIT });
    return entities;
  }

  // ========== Track grounded state for fall damage ==========
  const isGrounded = cart.state.isGrounded;

  if (isGrounded) {
    // Update last grounded position
    tracker.lastGroundedY = cartBody.position.y;
    tracker.lastGroundedTime = time.current;
    tracker.airTime = 0;
    tracker.maxFallDistance = 0;
  } else {
    // Track air time and fall distance
    tracker.airTime += time.delta;

    // Only calculate fall distance after grace period
    if (tracker.airTime > CRASH_CONFIG.fallDamageGracePeriod) {
      const fallDistance = cartBody.position.y - tracker.lastGroundedY;

      // Track maximum fall distance
      if (fallDistance > tracker.maxFallDistance) {
        tracker.maxFallDistance = fallDistance;
      }

      // Check for fatal fall (still airborne and exceeded threshold)
      if (
        fallDistance > CRASH_CONFIG.fallDamageFatalHeight &&
        cartBody.velocity.y > 0 // Falling down
      ) {
        dispatch({ type: "crash", crashType: CrashType.FLOOR_IMPACT });
        return entities;
      }
    }
  }

  return entities;
};

// ============================================
// Impact Crash Detection (Called from collision handler)
// Phase 2: Surface-specific impact thresholds
// ============================================

export function checkImpactCrash(
  impactVelocity: number,
  surfaceBody: Matter.Body,
): boolean {
  const surfaceType = getSurfaceTypeFromBody(surfaceBody);

  // Bumpers don't cause crashes
  if (surfaceType === SurfaceType.BOUNCY) {
    return false;
  }

  // Get threshold for this surface type
  const threshold =
    CRASH_CONFIG.impactVelocityThresholds[surfaceType] ??
    CRASH_CONFIG.maxImpactVelocity;

  return impactVelocity > threshold;
}

// ============================================
// Landing Crash Check (Phase 2)
// Called when cart lands after being airborne
// ============================================

export function checkLandingCrash(
  fallDistance: number,
  impactVelocity: number,
  surfaceType: SurfaceType,
): { isCrash: boolean; crashType: CrashType | null } {
  // Bouncy surfaces absorb landing
  if (surfaceType === SurfaceType.BOUNCY) {
    return { isCrash: false, crashType: null };
  }

  // Sticky surfaces have slightly lower fall threshold
  const heightThreshold =
    surfaceType === SurfaceType.STICKY
      ? CRASH_CONFIG.fallDamageFatalHeight * 0.8
      : CRASH_CONFIG.fallDamageFatalHeight;

  if (fallDistance > heightThreshold) {
    return { isCrash: true, crashType: CrashType.FLOOR_IMPACT };
  }

  // High velocity landing on hard surfaces
  if (
    surfaceType === SurfaceType.METAL &&
    impactVelocity > CRASH_CONFIG.maxImpactVelocity * 0.9
  ) {
    return { isCrash: true, crashType: CrashType.FLOOR_IMPACT };
  }

  return { isCrash: false, crashType: null };
}

// ============================================
// Reset Fall Tracker (for respawn)
// ============================================

export function resetFallTracker(cartId: string = "main_cart"): void {
  fallTrackers.delete(cartId);
}
