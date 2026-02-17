/**
 * HoleConfig — Strongly typed shape for a mini-golf hole JSON definition.
 *
 * Course geometry lives server-side only.  Colyseus state never syncs
 * polygon arrays — only IDs, ball transforms, and kinematic obstacle
 * transforms are networked.
 */

// =============================================================================
// Geometry primitives
// =============================================================================

export interface Point {
  x: number;
  y: number;
}

/** A closed polygon defined as an array of vertices */
export type Polygon = Point[];

// =============================================================================
// Surface / Hazard / Obstacle definitions
// =============================================================================

export interface SurfaceDef {
  id: string;
  /** "sand" | "ice" */
  type: "sand" | "ice";
  /** Friction multiplier applied while ball overlaps (sand > 1, ice < 1) */
  frictionMul: number;
  poly: Polygon;
}

export interface HazardDef {
  id: string;
  /** "water" | "oob" (out-of-bounds) */
  type: "water" | "oob";
  /** Extra strokes added when ball enters */
  penalty: number;
  poly: Polygon;
}

export interface ObstacleDef {
  id: string;
  /** "bumper" | "spinner" | "moving_gate" */
  type: "bumper" | "spinner" | "moving_gate";
  /** Centre position */
  position: Point;
  /** Size / dimensions (interpretation varies by type) */
  size: { width: number; height: number };
  /** Spinner: angular velocity (rad/s).  Gate: oscillation amplitude. */
  speed?: number;
  /** Moving gate: start point */
  pointA?: Point;
  /** Moving gate: end point */
  pointB?: Point;
  /** Bumper: radius (overrides size) */
  radius?: number;
  /** Restitution for bumper bounces */
  restitution?: number;
}

// =============================================================================
// Portal / Slope definitions
// =============================================================================

export interface PortalDef {
  id: string;
  /** Position of this portal entrance. */
  position: Point;
  /** Radius of the portal sensor. */
  radius: number;
  /** ID of the portal this one links to (must exist in same hole). */
  targetId: string;
}

export interface SlopeDef {
  id: string;
  /** Polygon zone where the slope force applies. */
  poly: Polygon;
  /** Direction of the drift force (unit vector). */
  direction: Point;
  /** Strength of the drift force. */
  strength: number;
}

// =============================================================================
// HoleConfig — single hole
// =============================================================================

export interface HoleConfig {
  /** Unique hole id within the pack (e.g. "classic_1") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Difficulty rating 1-5 */
  difficulty?: number;
  /** Par for this hole */
  par: number;
  /** Maximum strokes before auto-advance */
  maxStrokes: number;
  /** Bounding box dimensions */
  bounds: { width: number; height: number };
  /** Tee position */
  tee: Point;
  /** Cup (hole) position */
  cup: Point;
  /** Cup capture radius */
  cupRadius: number;
  /** Outer walls — array of closed polygons */
  walls: Polygon[];
  /** Special surfaces (sand pits, ice patches) */
  surfaces: SurfaceDef[];
  /** Hazard zones (water, out-of-bounds) */
  hazards: HazardDef[];
  /** Kinematic obstacles (bumpers, spinners, gates) */
  obstacles: ObstacleDef[];
  /** Portal pairs — ball teleports between linked portals. */
  portals?: PortalDef[];
  /** Slope zones — apply directional drift force while ball overlaps. */
  slopes?: SlopeDef[];
}

// =============================================================================
// CourseConfig — a pack of holes
// =============================================================================

export interface CourseConfig {
  packId: string;
  name: string;
  holes: HoleConfig[];
}
