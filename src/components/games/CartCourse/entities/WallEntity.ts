/**
 * Wall Entity Factory
 * Creates static wall bodies for course boundaries
 * Phase 2: Added surface types and bumper support
 */

import Matter from "matter-js";
import {
  BUMPER_COLLISION_FILTER,
  BUMPER_CONFIG,
  SURFACE_MATERIALS,
  WALL_COLLISION_FILTER,
} from "../data/constants";
import {
  BumperEntity,
  SurfaceType,
  WallEntity,
} from "../types/cartCourse.types";

// ============================================
// Wall Configuration
// ============================================

export interface WallConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // Degrees
  surfaceType?: SurfaceType; // Phase 2: Surface material
  isBumper?: boolean; // Phase 2: Is this a bouncy bumper?
}

// ============================================
// Create Wall Entity
// ============================================

export function createWallEntity(
  config: WallConfig,
  world: Matter.World,
): WallEntity {
  const {
    id,
    x,
    y,
    width,
    height,
    rotation = 0,
    surfaceType = SurfaceType.NORMAL,
    isBumper = false,
  } = config;

  // Convert rotation from degrees to radians
  const angleRad = (rotation * Math.PI) / 180;

  // Get material properties based on surface type
  const material = isBumper
    ? SURFACE_MATERIALS[SurfaceType.BOUNCY]
    : SURFACE_MATERIALS[surfaceType];

  // Create static body
  const body = Matter.Bodies.rectangle(x, y, width, height, {
    label: isBumper ? `bumper_${id}` : `wall_${id}`,
    isStatic: true,
    friction: material.friction,
    frictionStatic: material.frictionStatic,
    restitution: material.restitution,
    angle: angleRad,
    collisionFilter: isBumper ? BUMPER_COLLISION_FILTER : WALL_COLLISION_FILTER,
    // Store surface info in plugin data for collision handling
    plugin: {
      surfaceType: isBumper ? SurfaceType.BOUNCY : surfaceType,
      isBumper,
    },
  });

  // Add to world
  Matter.World.add(world, body);

  // Create entity
  const wallEntity: WallEntity = {
    body,
    position: { x, y },
    size: { width, height },
    rotation,
    surfaceType: isBumper ? SurfaceType.BOUNCY : surfaceType,
    isBumper,
    renderer: "wall",
  };

  return wallEntity;
}

// ============================================
// Create Boundary Walls
// ============================================

export function createBoundaryWalls(
  courseWidth: number,
  courseHeight: number,
  world: Matter.World,
): Map<string, WallEntity> {
  const walls = new Map<string, WallEntity>();
  const wallThickness = 20;

  // Left wall
  walls.set(
    "left_boundary",
    createWallEntity(
      {
        id: "left_boundary",
        x: -wallThickness / 2,
        y: courseHeight / 2,
        width: wallThickness,
        height: courseHeight + 200, // Extra for pit
        surfaceType: SurfaceType.NORMAL,
      },
      world,
    ),
  );

  // Right wall
  walls.set(
    "right_boundary",
    createWallEntity(
      {
        id: "right_boundary",
        x: courseWidth + wallThickness / 2,
        y: courseHeight / 2,
        width: wallThickness,
        height: courseHeight + 200,
        surfaceType: SurfaceType.NORMAL,
      },
      world,
    ),
  );

  return walls;
}

// ============================================
// Create Bumper Entity (Phase 2)
// ============================================

export interface BumperConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  bounciness?: number; // 0-1, override default
}

export function createBumperEntity(
  config: BumperConfig,
  world: Matter.World,
): BumperEntity {
  const {
    id,
    x,
    y,
    width,
    height,
    rotation = 0,
    bounciness = BUMPER_CONFIG.defaultBounciness,
  } = config;

  const angleRad = (rotation * Math.PI) / 180;
  const material = SURFACE_MATERIALS[SurfaceType.BOUNCY];

  const body = Matter.Bodies.rectangle(x, y, width, height, {
    label: `bumper_${id}`,
    isStatic: true,
    friction: material.friction,
    frictionStatic: material.frictionStatic,
    restitution: bounciness, // Use custom bounciness
    angle: angleRad,
    collisionFilter: BUMPER_COLLISION_FILTER,
    plugin: {
      surfaceType: SurfaceType.BOUNCY,
      isBumper: true,
      bounciness,
    },
  });

  Matter.World.add(world, body);

  const bumperEntity: BumperEntity = {
    body,
    position: { x, y },
    size: { width, height },
    rotation,
    bounciness,
    maxBounceVelocity: BUMPER_CONFIG.maxBounceVelocity,
    renderer: "bumper",
  };

  return bumperEntity;
}

// ============================================
// Create Corner Bumper (Phase 2)
// Creates an angled bumper for corners
// ============================================

export function createCornerBumper(
  id: string,
  x: number,
  y: number,
  size: number,
  angle: number, // 45 for top-left, -45 for top-right, etc.
  world: Matter.World,
): BumperEntity {
  return createBumperEntity(
    {
      id,
      x,
      y,
      width: size,
      height: 15, // Thin bumper
      rotation: angle,
      bounciness: BUMPER_CONFIG.defaultBounciness,
    },
    world,
  );
}

// ============================================
// Remove Wall from World
// ============================================

export function removeWallFromWorld(
  wall: WallEntity,
  world: Matter.World,
): void {
  Matter.World.remove(world, wall.body);
}

// ============================================
// Remove Bumper from World (Phase 2)
// ============================================

export function removeBumperFromWorld(
  bumper: BumperEntity,
  world: Matter.World,
): void {
  Matter.World.remove(world, bumper.body);
}
