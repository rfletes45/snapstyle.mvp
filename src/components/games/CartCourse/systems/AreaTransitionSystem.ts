/**
 * Area Transition System
 *
 * Detects when the cart moves between areas and handles
 * camera transitions and area-specific settings.
 */

import {
  Area,
  AreaBounds,
  GameEngineUpdateProps,
  GameEntities,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Area Transition State
// ============================================

export interface AreaTransitionState {
  currentAreaIndex: number;
  previousAreaIndex: number;
  isTransitioning: boolean;
  transitionProgress: number;
  transitionStartTime: number;
  transitionDuration: number;
}

// ============================================
// Area Detection
// ============================================

/**
 * Check if a position is within an area's bounds
 */
export function isPositionInArea(position: Vector2D, area: Area): boolean {
  const { bounds } = area;
  return (
    position.x >= bounds.minX &&
    position.x <= bounds.maxX &&
    position.y >= bounds.minY &&
    position.y <= bounds.maxY
  );
}

/**
 * Find which area the cart is currently in
 */
export function findCurrentArea(position: Vector2D, areas: Area[]): number {
  for (let i = 0; i < areas.length; i++) {
    if (isPositionInArea(position, areas[i])) {
      return i;
    }
  }
  // Return -1 if cart is outside all areas (possible during transitions)
  return -1;
}

/**
 * Get the area that the cart is entering (based on movement direction)
 */
export function getTargetArea(
  position: Vector2D,
  velocity: Vector2D,
  currentAreaIndex: number,
  areas: Area[],
): number {
  // Project position slightly ahead based on velocity
  const lookAheadDistance = 50; // pixels
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

  if (speed < 0.1) {
    return currentAreaIndex;
  }

  const projectedPosition: Vector2D = {
    x: position.x + (velocity.x / speed) * lookAheadDistance,
    y: position.y + (velocity.y / speed) * lookAheadDistance,
  };

  const targetIndex = findCurrentArea(projectedPosition, areas);
  return targetIndex >= 0 ? targetIndex : currentAreaIndex;
}

// ============================================
// Transition Calculations
// ============================================

/**
 * Calculate transition progress (0 to 1)
 */
export function calculateTransitionProgress(
  currentTime: number,
  startTime: number,
  duration: number,
): number {
  const elapsed = currentTime - startTime;
  const progress = Math.min(1, elapsed / duration);
  // Use ease-out-cubic for smooth transition
  return 1 - Math.pow(1 - progress, 3);
}

/**
 * Interpolate camera bounds between two areas
 */
export function interpolateBounds(
  fromBounds: AreaBounds,
  toBounds: AreaBounds,
  progress: number,
): AreaBounds {
  return {
    id: toBounds.id,
    minX: lerp(fromBounds.minX, toBounds.minX, progress),
    maxX: lerp(fromBounds.maxX, toBounds.maxX, progress),
    minY: lerp(fromBounds.minY, toBounds.minY, progress),
    maxY: lerp(fromBounds.maxY, toBounds.maxY, progress),
    cameraZoom: lerp(
      fromBounds.cameraZoom ?? 1.0,
      toBounds.cameraZoom ?? 1.0,
      progress,
    ),
    transitionSmoothing: toBounds.transitionSmoothing,
  };
}

/**
 * Linear interpolation helper
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================
// Area Transition System
// ============================================

/**
 * Initialize area transition state
 */
export function createAreaTransitionState(
  initialAreaIndex: number = 0,
): AreaTransitionState {
  return {
    currentAreaIndex: initialAreaIndex,
    previousAreaIndex: initialAreaIndex,
    isTransitioning: false,
    transitionProgress: 0,
    transitionStartTime: 0,
    transitionDuration: 500, // Default 500ms transition
  };
}

/**
 * Area Transition System - detects and handles area transitions
 */
export function AreaTransitionSystem(
  entities: GameEntities & {
    areaTransition?: AreaTransitionState;
    areas?: Area[];
  },
  { time, dispatch }: GameEngineUpdateProps,
): GameEntities {
  const { cart, camera, areaTransition, areas } = entities;

  if (!areaTransition || !areas || areas.length === 0) {
    return entities;
  }

  // Get cart position
  const cartBody = cart.composite.bodies.find((b) => b.label === "cart_body");
  if (!cartBody) {
    return entities;
  }

  const cartPosition: Vector2D = {
    x: cartBody.position.x,
    y: cartBody.position.y,
  };

  const cartVelocity: Vector2D = {
    x: cartBody.velocity.x,
    y: cartBody.velocity.y,
  };

  // Handle ongoing transition
  if (areaTransition.isTransitioning) {
    const progress = calculateTransitionProgress(
      time.current,
      areaTransition.transitionStartTime,
      areaTransition.transitionDuration,
    );

    areaTransition.transitionProgress = progress;

    // Update camera bounds during transition
    if (camera.areas && areaTransition.previousAreaIndex >= 0) {
      const fromArea = areas[areaTransition.previousAreaIndex];
      const toArea = areas[areaTransition.currentAreaIndex];

      if (fromArea && toArea) {
        camera.currentArea = interpolateBounds(
          fromArea.bounds,
          toArea.bounds,
          progress,
        );

        // Update camera zoom if areas have different zooms
        if (fromArea.cameraZoom || toArea.cameraZoom) {
          camera.targetZoom = lerp(
            fromArea.cameraZoom ?? camera.config.defaultZoom,
            toArea.cameraZoom ?? camera.config.defaultZoom,
            progress,
          );
        }
      }
    }

    // Transition complete
    if (progress >= 1) {
      areaTransition.isTransitioning = false;
      areaTransition.transitionProgress = 1;

      // Set final camera bounds
      const currentArea = areas[areaTransition.currentAreaIndex];
      if (currentArea) {
        camera.currentArea = currentArea.bounds;
        camera.targetZoom = currentArea.cameraZoom ?? camera.config.defaultZoom;
      }

      camera.isTransitioning = false;
    }

    return entities;
  }

  // Detect area change
  const detectedAreaIndex = findCurrentArea(cartPosition, areas);

  if (
    detectedAreaIndex >= 0 &&
    detectedAreaIndex !== areaTransition.currentAreaIndex
  ) {
    // Start transition to new area
    areaTransition.previousAreaIndex = areaTransition.currentAreaIndex;
    areaTransition.currentAreaIndex = detectedAreaIndex;
    areaTransition.isTransitioning = true;
    areaTransition.transitionProgress = 0;
    areaTransition.transitionStartTime = time.current;

    // Get transition duration from target area
    const targetArea = areas[detectedAreaIndex];
    if (targetArea.transitionSmoothing) {
      areaTransition.transitionDuration = targetArea.transitionSmoothing;
    }

    camera.isTransitioning = true;

    // Dispatch area change event
    dispatch({
      type: "checkpoint",
      index: detectedAreaIndex,
    });
  }

  return entities;
}

// ============================================
// Area Bounds Helpers
// ============================================

/**
 * Get all area bounds from a course
 */
export function getAreaBoundsFromAreas(areas: Area[]): AreaBounds[] {
  return areas.map((area) => ({
    ...area.bounds,
    cameraZoom: area.cameraZoom,
    transitionSmoothing: area.transitionSmoothing,
  }));
}

/**
 * Clamp position to area bounds
 */
export function clampPositionToArea(
  position: Vector2D,
  bounds: AreaBounds,
  padding: number = 0,
): Vector2D {
  return {
    x: Math.max(
      bounds.minX + padding,
      Math.min(bounds.maxX - padding, position.x),
    ),
    y: Math.max(
      bounds.minY + padding,
      Math.min(bounds.maxY - padding, position.y),
    ),
  };
}

/**
 * Check if cart is near area boundary (for early camera adjustment)
 */
export function isNearAreaBoundary(
  position: Vector2D,
  bounds: AreaBounds,
  threshold: number = 100,
): {
  nearTop: boolean;
  nearBottom: boolean;
  nearLeft: boolean;
  nearRight: boolean;
} {
  return {
    nearTop: position.y - bounds.minY < threshold,
    nearBottom: bounds.maxY - position.y < threshold,
    nearLeft: position.x - bounds.minX < threshold,
    nearRight: bounds.maxX - position.x < threshold,
  };
}

/**
 * Get adjacent area index based on boundary proximity
 */
export function getAdjacentAreaIndex(
  currentAreaIndex: number,
  areas: Area[],
  boundaryProximity: ReturnType<typeof isNearAreaBoundary>,
): number | null {
  const currentArea = areas[currentAreaIndex];
  if (!currentArea) return null;

  // Check which boundary cart is near and find adjacent area
  for (let i = 0; i < areas.length; i++) {
    if (i === currentAreaIndex) continue;

    const otherArea = areas[i];

    // Check if other area is adjacent based on boundary proximity
    if (boundaryProximity.nearTop) {
      if (
        Math.abs(otherArea.bounds.maxY - currentArea.bounds.minY) < 50 &&
        overlapsHorizontally(currentArea.bounds, otherArea.bounds)
      ) {
        return i;
      }
    }

    if (boundaryProximity.nearBottom) {
      if (
        Math.abs(currentArea.bounds.maxY - otherArea.bounds.minY) < 50 &&
        overlapsHorizontally(currentArea.bounds, otherArea.bounds)
      ) {
        return i;
      }
    }
  }

  return null;
}

/**
 * Check if two bounds overlap horizontally
 */
function overlapsHorizontally(a: AreaBounds, b: AreaBounds): boolean {
  return a.maxX > b.minX && a.minX < b.maxX;
}
