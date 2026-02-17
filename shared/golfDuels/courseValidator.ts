/**
 * Course System v2 — Validator
 *
 * Validates a CourseConfig against the v2 schema constraints:
 *   - version tag matches COURSE_FORMAT_VERSION
 *   - every hole has valid bounds, tee, cup, walls, surfaces, hazards, obstacles
 *   - all coordinates sit within the declared bounds
 *   - no zero-length wall segments
 *   - tee and cup are not coincident
 *
 * Usage:
 *   const errors = validateCourse(json);
 *   if (errors.length > 0) throw new Error(errors.join("\n"));
 */

import {
  COURSE_FORMAT_VERSION,
  CourseConfig,
  HoleConfig,
  Polyline,
  Vec2,
} from "./courseTypes";

// =============================================================================
// Public API
// =============================================================================

/**
 * Returns an array of human-readable error strings.
 * An empty array means the course is valid.
 */
export function validateCourse(course: unknown): string[] {
  const errors: string[] = [];
  if (!course || typeof course !== "object") {
    errors.push("Course must be a non-null object.");
    return errors;
  }

  const c = course as Partial<CourseConfig>;

  // ── version ──────────────────────────────────────────────────────────
  if (c.version !== COURSE_FORMAT_VERSION) {
    errors.push(
      `Expected version ${COURSE_FORMAT_VERSION}, got ${String(c.version)}.`,
    );
  }

  // ── top-level fields ─────────────────────────────────────────────────
  if (typeof c.packId !== "string" || c.packId.length === 0) {
    errors.push("packId must be a non-empty string.");
  }
  if (typeof c.name !== "string" || c.name.length === 0) {
    errors.push("name must be a non-empty string.");
  }
  if (!Array.isArray(c.holes) || c.holes.length === 0) {
    errors.push("holes must be a non-empty array.");
    return errors; // nothing more to validate
  }

  // ── per-hole ─────────────────────────────────────────────────────────
  const holeIds = new Set<string>();
  c.holes.forEach((hole, i) => {
    const prefix = `holes[${i}]`;
    validateHole(hole, prefix, holeIds, errors);
  });

  return errors;
}

// =============================================================================
// Hole-level validation
// =============================================================================

function validateHole(
  hole: Partial<HoleConfig>,
  prefix: string,
  seenIds: Set<string>,
  errors: string[],
): void {
  // id
  if (typeof hole.id !== "string" || hole.id.length === 0) {
    errors.push(`${prefix}.id must be a non-empty string.`);
  } else if (seenIds.has(hole.id)) {
    errors.push(`${prefix}.id "${hole.id}" is duplicated.`);
  } else {
    seenIds.add(hole.id);
  }

  // par / maxStrokes
  if (!isPositiveInt(hole.par)) {
    errors.push(`${prefix}.par must be a positive integer.`);
  }
  if (!isPositiveInt(hole.maxStrokes)) {
    errors.push(`${prefix}.maxStrokes must be a positive integer.`);
  }

  // bounds
  const bounds = hole.bounds;
  if (
    !bounds ||
    typeof bounds.width !== "number" ||
    typeof bounds.height !== "number" ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    errors.push(`${prefix}.bounds must have positive width and height.`);
    return; // can't check point containment without valid bounds
  }

  // tee / cup
  if (!isVec2(hole.tee)) {
    errors.push(`${prefix}.tee must be {x, y}.`);
  } else {
    assertInBounds(hole.tee, bounds, `${prefix}.tee`, errors);
  }
  if (!isVec2(hole.cup)) {
    errors.push(`${prefix}.cup must be {x, y}.`);
  } else {
    assertInBounds(hole.cup, bounds, `${prefix}.cup`, errors);
  }
  if (
    isVec2(hole.tee) &&
    isVec2(hole.cup) &&
    hole.tee.x === hole.cup.x &&
    hole.tee.y === hole.cup.y
  ) {
    errors.push(`${prefix}: tee and cup must not be at the same position.`);
  }

  // cupRadius
  if (typeof hole.cupRadius !== "number" || hole.cupRadius <= 0) {
    errors.push(`${prefix}.cupRadius must be a positive number.`);
  }

  // walls
  if (!Array.isArray(hole.walls)) {
    errors.push(`${prefix}.walls must be an array of polylines.`);
  } else {
    hole.walls.forEach((poly, j) => {
      validatePolyline(poly, bounds, `${prefix}.walls[${j}]`, errors, true);
    });
  }

  // surfaces
  if (Array.isArray(hole.surfaces)) {
    hole.surfaces.forEach((surf, j) => {
      const sp = `${prefix}.surfaces[${j}]`;
      if (!["sand", "ice"].includes(surf.type as string)) {
        errors.push(`${sp}.type must be "sand" or "ice".`);
      }
      if (typeof surf.frictionMul !== "number" || surf.frictionMul < 0) {
        errors.push(`${sp}.frictionMul must be >= 0.`);
      }
      if (surf.poly) {
        validatePolyline(surf.poly, bounds, `${sp}.poly`, errors, false);
      }
    });
  }

  // hazards
  if (Array.isArray(hole.hazards)) {
    hole.hazards.forEach((haz, j) => {
      const hp = `${prefix}.hazards[${j}]`;
      if (!["water", "oob"].includes(haz.type as string)) {
        errors.push(`${hp}.type must be "water" or "oob".`);
      }
      if (typeof haz.penalty !== "number" || haz.penalty < 0) {
        errors.push(`${hp}.penalty must be >= 0.`);
      }
      if (haz.poly) {
        validatePolyline(haz.poly, bounds, `${hp}.poly`, errors, false);
      }
    });
  }

  // obstacles
  if (Array.isArray(hole.obstacles)) {
    hole.obstacles.forEach((obs, j) => {
      const op = `${prefix}.obstacles[${j}]`;
      if (!["bumper", "spinner", "moving_gate"].includes(obs.type as string)) {
        errors.push(`${op}.type must be bumper|spinner|moving_gate.`);
      }
      if (!isVec2(obs.position)) {
        errors.push(`${op}.position must be {x, y}.`);
      } else {
        assertInBounds(obs.position, bounds, `${op}.position`, errors);
      }
    });
  }

  // portals
  if (Array.isArray((hole as any).portals)) {
    const portalIds = new Set<string>();
    const portals = (hole as any).portals as any[];
    portals.forEach((portal: any, j: number) => {
      const pp = `${prefix}.portals[${j}]`;
      if (typeof portal.id !== "string" || portal.id.length === 0) {
        errors.push(`${pp}.id must be a non-empty string.`);
      } else {
        portalIds.add(portal.id);
      }
      if (!isVec2(portal.position)) {
        errors.push(`${pp}.position must be {x, y}.`);
      } else {
        assertInBounds(portal.position, bounds, `${pp}.position`, errors);
      }
      if (typeof portal.radius !== "number" || portal.radius <= 0) {
        errors.push(`${pp}.radius must be a positive number.`);
      }
      if (typeof portal.targetId !== "string" || portal.targetId.length === 0) {
        errors.push(`${pp}.targetId must be a non-empty string.`);
      }
    });
    // Validate that all targetIds reference existing portal ids
    portals.forEach((portal: any, j: number) => {
      if (
        typeof portal.targetId === "string" &&
        portal.targetId.length > 0 &&
        !portalIds.has(portal.targetId)
      ) {
        errors.push(
          `${prefix}.portals[${j}].targetId "${portal.targetId}" references a non-existent portal.`,
        );
      }
    });
  }

  // slopes
  if (Array.isArray((hole as any).slopes)) {
    const slopes = (hole as any).slopes as any[];
    slopes.forEach((slope: any, j: number) => {
      const sp = `${prefix}.slopes[${j}]`;
      if (typeof slope.id !== "string" || slope.id.length === 0) {
        errors.push(`${sp}.id must be a non-empty string.`);
      }
      if (slope.poly) {
        validatePolyline(slope.poly, bounds, `${sp}.poly`, errors, false);
      } else {
        errors.push(`${sp}.poly is required.`);
      }
      if (!isVec2(slope.direction)) {
        errors.push(`${sp}.direction must be {x, y}.`);
      }
      if (typeof slope.strength !== "number" || slope.strength <= 0) {
        errors.push(`${sp}.strength must be a positive number.`);
      }
    });
  }

  // difficulty
  if (
    (hole as any).difficulty !== undefined &&
    (typeof (hole as any).difficulty !== "number" ||
      (hole as any).difficulty < 1 ||
      (hole as any).difficulty > 5)
  ) {
    errors.push(`${prefix}.difficulty must be 1-5 if provided.`);
  }
}

// =============================================================================
// Polyline validation
// =============================================================================

function validatePolyline(
  poly: Polyline,
  bounds: { width: number; height: number },
  prefix: string,
  errors: string[],
  requireClosed: boolean,
): void {
  if (!Array.isArray(poly) || poly.length < 3) {
    errors.push(`${prefix} must have at least 3 vertices.`);
    return;
  }

  for (let i = 0; i < poly.length; i++) {
    const v = poly[i];
    if (!isVec2(v)) {
      errors.push(`${prefix}[${i}] must be {x, y}.`);
      continue;
    }
    assertInBounds(v, bounds, `${prefix}[${i}]`, errors);
  }

  // Check for zero-length segments (consecutive duplicate vertices)
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (isVec2(a) && isVec2(b)) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy < 1e-6) {
        errors.push(
          `${prefix} has zero-length segment between vertex ${i} and ${(i + 1) % poly.length}.`,
        );
      }
    }
  }
}

// =============================================================================
// Helpers
// =============================================================================

function isVec2(v: unknown): v is Vec2 {
  return (
    v !== null &&
    typeof v === "object" &&
    typeof (v as Vec2).x === "number" &&
    typeof (v as Vec2).y === "number"
  );
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

function assertInBounds(
  pt: Vec2,
  bounds: { width: number; height: number },
  label: string,
  errors: string[],
): void {
  if (pt.x < 0 || pt.x > bounds.width) {
    errors.push(`${label}.x = ${pt.x} is outside bounds [0, ${bounds.width}].`);
  }
  if (pt.y < 0 || pt.y > bounds.height) {
    errors.push(
      `${label}.y = ${pt.y} is outside bounds [0, ${bounds.height}].`,
    );
  }
}
