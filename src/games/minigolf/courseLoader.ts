/**
 * Client-side course loader for Mini-Golf Duels
 *
 * Loads hole geometry from bundled JSON packs. The client renders from
 * this JSON — it does NOT rely on Colyseus schema for wall/hazard geometry.
 *
 * Types are now re-exported from the shared Course System v2 module.
 *
 * @see colyseus-server/src/games/minigolf/courseLoader.ts (server mirror)
 * @see shared/golfDuels/courseTypes.ts
 */

// =============================================================================
// Types — re-exported from shared Course System v2
// =============================================================================

export type {
  CourseConfig,
  HazardDef,
  HoleConfig,
  ObstacleDef,
  Vec2 as Point,
  Polyline as Polygon,
  SurfaceDef,
} from "../../../shared/golfDuels/courseTypes";

import type {
  CourseConfig,
  HoleConfig,
} from "../../../shared/golfDuels/courseTypes";

// Also re-export builder utilities for the canvas renderer
export {
  buildAllWallGeometry,
  polygonCentroid,
} from "../../../shared/golfDuels/courseBuilder";

// =============================================================================
// Course registry — static imports (bundled at build time by Metro)
// =============================================================================

const COURSE_PACKS: Record<string, CourseConfig> = {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  default: require("./courses/default.json") as CourseConfig,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  tutorial: require("./courses/tutorial.json") as CourseConfig,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  neon: require("./courses/neon.json") as CourseConfig,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  garden: require("./courses/garden.json") as CourseConfig,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  toybox: require("./courses/toybox.json") as CourseConfig,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  v2_test:
    require("../../../shared/golfDuels/courses/v2_test.json") as CourseConfig,
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Load a full course pack by packId.
 * Returns undefined if the pack is not found.
 */
export function loadCourse(packId: string): CourseConfig | undefined {
  return COURSE_PACKS[packId];
}

/**
 * Load a single hole config by packId + zero-based holeIndex.
 * Returns undefined if the pack or hole index is invalid.
 */
export function loadHole(
  packId: string,
  holeIndex: number,
): HoleConfig | undefined {
  const course = COURSE_PACKS[packId];
  if (!course) return undefined;
  return course.holes[holeIndex];
}

/**
 * Get total number of holes in a pack.
 */
export function holeCount(packId: string): number {
  return COURSE_PACKS[packId]?.holes.length ?? 0;
}
