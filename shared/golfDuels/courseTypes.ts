/**
 * Course System v2 — Canonical types for Mini-Golf Duels
 *
 * Canonical coordinate system:
 *   - World units (wu): abstract, not pixels.
 *   - Canonical bounds: 100 × 60 (width × height). Courses may use custom bounds.
 *   - Origin: top-left corner of the playable area.
 *   - +x → right, +y → down.
 *   - Angles: radians, 0 = rightward, positive = clockwise.
 *
 * Every polygon in `walls` is a CLOSED polyline that defines a SOLID obstacle
 * boundary. The server decomposes each polyline into thin edge-segment
 * rectangle colliders using buildWallBodies().
 *
 * Rendering: the client fits the `bounds` rect uniformly into its viewport
 * with aspect-ratio-preserving scaling.
 *
 * Physics: the server uses coordinates from the JSON directly as Matter.js
 * world coordinates — NO additional scaling.
 *
 * @version 2
 */

// =============================================================================
// Primitives
// =============================================================================

export interface Vec2 {
  x: number;
  y: number;
}

/** A closed polygon expressed as an ordered array of vertices. */
export type Polyline = Vec2[];

// =============================================================================
// Surface / Hazard / Obstacle definitions
// =============================================================================

export type SurfaceType = "sand" | "ice";

export interface SurfaceDef {
  id: string;
  type: SurfaceType;
  /** Friction multiplier applied while ball overlaps. >1 = slower, <1 = faster. */
  frictionMul: number;
  poly: Polyline;
}

export type HazardType = "water" | "oob";

export interface HazardDef {
  id: string;
  type: HazardType;
  /** Stroke penalty when ball enters hazard. */
  penalty: number;
  poly: Polyline;
}

// =============================================================================
// Portal / Slope definitions
// =============================================================================

export interface PortalDef {
  id: string;
  /** Position of this portal entrance. */
  position: Vec2;
  /** Radius of the portal sensor. */
  radius: number;
  /** ID of the portal this one links to (must exist in same hole). */
  targetId: string;
}

export interface SlopeDef {
  id: string;
  /** Polygon zone where the slope force applies. */
  poly: Polyline;
  /** Direction of the drift force (unit vector). */
  direction: Vec2;
  /** Strength of the drift force (world-units per tick). */
  strength: number;
}

// =============================================================================
// Obstacle definitions
// =============================================================================

export type ObstacleType = "bumper" | "spinner" | "moving_gate";

export interface ObstacleDef {
  id: string;
  type: ObstacleType;
  /** Center position of the obstacle in world coordinates. */
  position: Vec2;
  /** Bounding size (width × height) — used for spinners / gates. */
  size: { width: number; height: number };
  /** Rotation speed in rad/s (spinners). */
  speed?: number;
  /** Collision radius (bumpers). */
  radius?: number;
  /** Coefficient of restitution. */
  restitution?: number;
  /** Start of oscillation path (moving gates). */
  pointA?: Vec2;
  /** End of oscillation path (moving gates). */
  pointB?: Vec2;
}

// =============================================================================
// Hole / Course
// =============================================================================

/** Version tag for forward-compatible parsing. */
export const COURSE_FORMAT_VERSION = 2;

export interface HoleConfig {
  /** Unique hole identifier within a pack (e.g. "classic_1"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Difficulty rating 1-5 (1 = easy, 5 = expert). */
  difficulty?: number;
  /** Expected number of strokes. */
  par: number;
  /** Maximum allowed strokes before forced move. */
  maxStrokes: number;
  /** Playable area dimensions in world units. */
  bounds: { width: number; height: number };
  /** Ball starting position. */
  tee: Vec2;
  /** Target cup position. */
  cup: Vec2;
  /** Radius of the cup sensor area. */
  cupRadius: number;
  /**
   * Wall polylines. Each polyline defines a CLOSED boundary.
   * The first polyline is typically the outer fairway boundary;
   * subsequent polylines are interior obstacles/islands.
   *
   * The server converts each edge (segment between consecutive vertices)
   * into a thin rectangle collider via buildWallBodies().
   */
  walls: Polyline[];
  /** Surface zones (sand, ice). Sensor-only — affect ball friction. */
  surfaces: SurfaceDef[];
  /** Hazard zones (water). Sensor-only — apply penalty on overlap. */
  hazards: HazardDef[];
  /** Dynamic obstacles (bumpers, spinners, gates). */
  obstacles: ObstacleDef[];
  /** Portal pairs — ball teleports between linked portals. */
  portals?: PortalDef[];
  /** Slope zones — apply directional drift force while ball overlaps. */
  slopes?: SlopeDef[];
}

export interface CourseConfig {
  /** Format version — must be COURSE_FORMAT_VERSION. */
  version: number;
  /** Unique pack identifier. */
  packId: string;
  /** Human-readable pack name. */
  name: string;
  /** Ordered array of holes. */
  holes: HoleConfig[];
}

// =============================================================================
// Wall-builder output (used by server physics)
// =============================================================================

export interface WallSegment {
  /** Midpoint x (center of the rectangle body). */
  cx: number;
  /** Midpoint y (center of the rectangle body). */
  cy: number;
  /** Length of this wall segment (rectangle width). */
  length: number;
  /** Rotation angle in radians. */
  angle: number;
}

// =============================================================================
// Builder constants
// =============================================================================

/** Default wall collider thickness in world units. */
export const WALL_THICKNESS = 6;

// BALL_RADIUS and MAX_POWER are exported from physicsConstants.ts
// (removed here to avoid duplicate-export error in barrel index).
