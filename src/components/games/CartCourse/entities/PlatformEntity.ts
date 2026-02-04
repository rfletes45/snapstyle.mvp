/**
 * Platform Entity Factory
 * Creates static platform bodies for the cart to roll on
 * Phase 2: Added surface-specific friction types
 */

import Matter from "matter-js";
import {
  PLATFORM_COLLISION_FILTER,
  SURFACE_MATERIALS,
} from "../data/constants";
import {
  PlatformEntity,
  SurfaceType,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Platform Configuration
// ============================================

export interface PlatformConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // Degrees
  friction?: number;
  isRamp?: boolean;
  surfaceType?: SurfaceType; // Phase 2: Surface material type
}

// ============================================
// Create Platform Entity
// ============================================

export function createPlatformEntity(
  config: PlatformConfig,
  world: Matter.World,
): PlatformEntity {
  const {
    id,
    x,
    y,
    width,
    height,
    rotation = 0,
    surfaceType = SurfaceType.NORMAL,
  } = config;

  // Get material properties from surface type
  const material = SURFACE_MATERIALS[surfaceType];
  const friction = config.friction ?? material.friction;

  // Convert rotation from degrees to radians
  const angleRad = (rotation * Math.PI) / 180;

  // Create static body
  const body = Matter.Bodies.rectangle(x, y, width, height, {
    label: `platform_${id}`,
    isStatic: true,
    friction,
    frictionStatic: material.frictionStatic,
    restitution: material.restitution,
    angle: angleRad,
    collisionFilter: PLATFORM_COLLISION_FILTER,
    // Store surface info in plugin data for collision handling
    plugin: {
      surfaceType,
      isRamp: config.isRamp ?? false,
    },
  });

  // Add to world
  Matter.World.add(world, body);

  // Create entity
  const platformEntity: PlatformEntity = {
    body,
    position: { x, y },
    size: { width, height },
    rotation,
    friction,
    surfaceType,
    renderer: "platform",
  };

  return platformEntity;
}

// ============================================
// Create Ground Platform
// ============================================

export function createGroundPlatform(
  x: number,
  y: number,
  width: number,
  world: Matter.World,
  surfaceType: SurfaceType = SurfaceType.NORMAL,
): PlatformEntity {
  return createPlatformEntity(
    {
      id: "ground",
      x,
      y,
      width,
      height: 40, // Thick ground
      rotation: 0,
      surfaceType,
    },
    world,
  );
}

// ============================================
// Create Ramp Platform
// ============================================

export function createRampPlatform(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number, // Degrees
  world: Matter.World,
  surfaceType: SurfaceType = SurfaceType.NORMAL,
): PlatformEntity {
  return createPlatformEntity(
    {
      id,
      x,
      y,
      width,
      height,
      rotation: angle,
      surfaceType,
      isRamp: true,
    },
    world,
  );
}

// ============================================
// Create Slippery Platform (Phase 2)
// Ice-like surface with very low friction
// ============================================

export function createSlipperyPlatform(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  world: Matter.World,
  rotation: number = 0,
): PlatformEntity {
  return createPlatformEntity(
    {
      id,
      x,
      y,
      width,
      height,
      rotation,
      surfaceType: SurfaceType.SLIPPERY,
    },
    world,
  );
}

// ============================================
// Create Sticky Platform (Phase 2)
// High friction surface that slows the cart
// ============================================

export function createStickyPlatform(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  world: Matter.World,
  rotation: number = 0,
): PlatformEntity {
  return createPlatformEntity(
    {
      id,
      x,
      y,
      width,
      height,
      rotation,
      surfaceType: SurfaceType.STICKY,
    },
    world,
  );
}

// ============================================
// Create Rough Platform (Phase 2)
// Gravel-like surface
// ============================================

export function createRoughPlatform(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  world: Matter.World,
  rotation: number = 0,
): PlatformEntity {
  return createPlatformEntity(
    {
      id,
      x,
      y,
      width,
      height,
      rotation,
      surfaceType: SurfaceType.ROUGH,
    },
    world,
  );
}

// ============================================
// Create Metal Platform (Phase 2)
// Medium friction with some bounce
// ============================================

export function createMetalPlatform(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  world: Matter.World,
  rotation: number = 0,
): PlatformEntity {
  return createPlatformEntity(
    {
      id,
      x,
      y,
      width,
      height,
      rotation,
      surfaceType: SurfaceType.METAL,
    },
    world,
  );
}

// ============================================
// Remove Platform from World
// ============================================

export function removePlatformFromWorld(
  platform: PlatformEntity,
  world: Matter.World,
): void {
  Matter.World.remove(world, platform.body);
}

// ============================================
// Update Platform Position (for kinematic platforms)
// ============================================

export function updatePlatformPosition(
  platform: PlatformEntity,
  newPosition: Vector2D,
  newRotation?: number,
): void {
  Matter.Body.setPosition(platform.body, newPosition);
  platform.position = newPosition;

  if (newRotation !== undefined) {
    const angleRad = (newRotation * Math.PI) / 180;
    Matter.Body.setAngle(platform.body, angleRad);
    platform.rotation = newRotation;
  }
}
