/**
 * Camera System (Phase 2 Enhanced)
 * Follows the cart with smooth interpolation
 * - Smooth lookahead based on velocity
 * - Area-based bounds clamping
 * - Velocity-based zoom
 * - Screen shake support
 */

import { CAMERA_ADVANCED_CONFIG, DEFAULT_CART_CONFIG } from "../data/constants";
import { clamp, lerp } from "../engine/MatterWorld";
import {
  AreaBounds,
  GameEngineUpdateProps,
  GameEntities,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Screen Shake State
// ============================================

interface ScreenShake {
  intensity: number;
  duration: number;
  elapsed: number;
  offset: Vector2D;
}

let activeShake: ScreenShake | null = null;

export function triggerScreenShake(
  intensity?: number,
  duration?: number,
): void {
  activeShake = {
    intensity: intensity ?? CAMERA_ADVANCED_CONFIG.screenShakeIntensity,
    duration: duration ?? CAMERA_ADVANCED_CONFIG.screenShakeDuration,
    elapsed: 0,
    offset: { x: 0, y: 0 },
  };
}

function updateScreenShake(deltaTime: number): Vector2D {
  if (!activeShake) {
    return { x: 0, y: 0 };
  }

  activeShake.elapsed += deltaTime;

  if (activeShake.elapsed >= activeShake.duration) {
    activeShake = null;
    return { x: 0, y: 0 };
  }

  // Decay intensity over time
  const progress = activeShake.elapsed / activeShake.duration;
  const currentIntensity =
    activeShake.intensity *
    Math.pow(CAMERA_ADVANCED_CONFIG.screenShakeDecay, progress * 10);

  // Random offset
  activeShake.offset = {
    x: (Math.random() - 0.5) * 2 * currentIntensity,
    y: (Math.random() - 0.5) * 2 * currentIntensity,
  };

  return activeShake.offset;
}

// ============================================
// Area Detection
// ============================================

function findCurrentArea(
  cartPosition: Vector2D,
  areas: AreaBounds[],
): AreaBounds | null {
  for (const area of areas) {
    if (
      cartPosition.x >= area.minX &&
      cartPosition.x <= area.maxX &&
      cartPosition.y >= area.minY &&
      cartPosition.y <= area.maxY
    ) {
      return area;
    }
  }
  return null;
}

// ============================================
// Camera System
// ============================================

export const CameraSystem = (
  entities: GameEntities,
  { time }: GameEngineUpdateProps,
): GameEntities => {
  const { cart, camera } = entities;

  if (!cart || !camera || !cart.body) {
    return entities;
  }

  const cartBody = cart.body;
  const { config, bounds, areas } = camera;

  // ========== Area Detection ==========
  const cartPosition = { x: cartBody.position.x, y: cartBody.position.y };
  const newArea = findCurrentArea(cartPosition, areas ?? []);

  // Handle area transition
  if (newArea && newArea !== camera.currentArea) {
    camera.currentArea = newArea;
    camera.isTransitioning = true;

    // Update bounds from new area
    camera.bounds = {
      minX: newArea.minX + CAMERA_ADVANCED_CONFIG.boundsPadding,
      maxX: newArea.maxX - CAMERA_ADVANCED_CONFIG.boundsPadding,
      minY: newArea.minY + CAMERA_ADVANCED_CONFIG.boundsPadding,
      maxY: newArea.maxY - CAMERA_ADVANCED_CONFIG.boundsPadding,
    };

    // Apply area-specific zoom if defined
    if (newArea.cameraZoom !== undefined) {
      camera.targetZoom = newArea.cameraZoom;
    }
  }

  // ========== Calculate Target Position ==========
  const velocityX = cartBody.velocity.x;
  const velocityY = cartBody.velocity.y;
  const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

  // Initialize target position if not set
  if (!camera.targetPosition) {
    camera.targetPosition = { x: cartBody.position.x, y: cartBody.position.y };
  }

  let targetX = cartBody.position.x;
  let targetY = cartBody.position.y;

  switch (config.followMode) {
    case "centered":
      // Just follow cart center
      break;

    case "ahead":
      // Dynamic lookahead based on velocity
      const lookAheadX = Math.min(
        velocityX *
          CAMERA_ADVANCED_CONFIG.lookAheadVelocityMultiplier *
          config.lookAheadDistance,
        CAMERA_ADVANCED_CONFIG.maxLookAhead,
      );
      const lookAheadY = Math.min(
        velocityY *
          CAMERA_ADVANCED_CONFIG.lookAheadVerticalMultiplier *
          config.lookAheadDistance,
        CAMERA_ADVANCED_CONFIG.maxLookAhead * 0.5,
      );

      targetX += lookAheadX;
      targetY += lookAheadY;
      break;

    case "area-locked":
      // Keep target within area bounds (already handled by clamping)
      break;
  }

  // Update target position
  camera.targetPosition.x = targetX;
  camera.targetPosition.y = targetY;

  // ========== Apply Dead Zone ==========
  const diffX = targetX - camera.position.x;
  const diffY = targetY - camera.position.y;

  if (Math.abs(diffX) < config.deadZone.width / 2) {
    targetX = camera.position.x;
  }
  if (Math.abs(diffY) < config.deadZone.height / 2) {
    targetY = camera.position.y;
  }

  // ========== Smooth Follow with Variable Smoothing ==========
  // Use slower smoothing during area transitions
  let smoothing = config.followSmoothing;

  if (camera.isTransitioning) {
    smoothing = CAMERA_ADVANCED_CONFIG.transitionSmoothing;

    // Check if transition is complete
    const distToTarget = Math.sqrt(
      Math.pow(camera.position.x - targetX, 2) +
        Math.pow(camera.position.y - targetY, 2),
    );
    if (distToTarget < 5) {
      camera.isTransitioning = false;
    }
  } else if (speed > CAMERA_ADVANCED_CONFIG.zoomVelocityThreshold * 2) {
    // Faster catch-up when cart is moving fast
    smoothing = CAMERA_ADVANCED_CONFIG.fastSmoothing;
  }

  camera.position.x = lerp(camera.position.x, targetX, smoothing);
  camera.position.y = lerp(camera.position.y, targetY, smoothing);

  // ========== Clamp to Bounds ==========
  camera.position.x = clamp(camera.position.x, bounds.minX, bounds.maxX);
  camera.position.y = clamp(camera.position.y, bounds.minY, bounds.maxY);

  // ========== Auto Zoom Based on Velocity ==========
  if (config.autoZoom) {
    const maxSpeed = DEFAULT_CART_CONFIG.maxLinearVelocity / 100;
    const speedRatio = Math.min(speed / maxSpeed, 1);

    // Zoom out when moving fast
    const baseTargetZoom = lerp(
      config.zoomRange.max,
      config.zoomRange.min,
      speedRatio,
    );

    // Blend with area zoom if transitioning
    const targetZoom = camera.targetZoom ?? baseTargetZoom;
    camera.zoom = lerp(
      camera.zoom,
      targetZoom,
      CAMERA_ADVANCED_CONFIG.zoomSmoothingFactor,
    );

    // Clear area zoom override after applying
    if (Math.abs(camera.zoom - targetZoom) < 0.01) {
      camera.targetZoom = baseTargetZoom;
    }
  }

  // ========== Apply Screen Shake ==========
  const shakeOffset = updateScreenShake(time.delta);
  camera.position.x += shakeOffset.x;
  camera.position.y += shakeOffset.y;

  return entities;
};

// ============================================
// Initialize Camera Entity (Phase 2)
// ============================================

export function createCameraEntity(
  initialPosition: Vector2D,
  courseBounds: { width: number; height: number },
  areas: AreaBounds[] = [],
): {
  position: Vector2D;
  targetPosition: Vector2D;
  zoom: number;
  targetZoom: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  config: typeof DEFAULT_CART_CONFIG extends { camera: infer C } ? C : any;
  currentArea: AreaBounds | null;
  areas: AreaBounds[];
  isTransitioning: boolean;
} {
  return {
    position: { ...initialPosition },
    targetPosition: { ...initialPosition },
    zoom: 1.0,
    targetZoom: 1.0,
    bounds: {
      minX: 0,
      maxX: courseBounds.width,
      minY: 0,
      maxY: courseBounds.height,
    },
    config: {
      followMode: "ahead" as const,
      followSmoothing: CAMERA_ADVANCED_CONFIG.normalSmoothing,
      lookAheadDistance: 100,
      defaultZoom: 1.0,
      zoomRange: { min: 0.8, max: 1.2 },
      autoZoom: true,
      deadZone: { x: 0, y: 0, width: 100, height: 150 },
    },
    currentArea: null,
    areas,
    isTransitioning: false,
  };
}
