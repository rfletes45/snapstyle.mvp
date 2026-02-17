/**
 * Course System v2 — Deterministic Wall Builder
 *
 * Converts course wall polylines into edge-segment rectangles
 * suitable for Matter.js. Also provides a proper polygon centroid
 * for use with `Matter.Bodies.fromVertices()`.
 *
 * This module is deliberately pure (no Matter.js dependency) so it
 * can be imported by both server and client for consistent geometry.
 */

import { Polyline, Vec2, WALL_THICKNESS, WallSegment } from "./courseTypes";

// =============================================================================
// Wall segment decomposition
// =============================================================================

/**
 * Decompose a CLOSED polyline into edge-segment descriptors.
 *
 * For a polygon with N vertices the result contains N segments
 * (vertex[N-1] → vertex[0] closes the loop).
 *
 * Each segment stores the midpoint, length, and angle of a thin
 * rectangle that should be placed in the physics world.
 */
export function buildWallSegments(
  poly: Polyline,
  thickness: number = WALL_THICKNESS,
): WallSegment[] {
  if (poly.length < 2) return [];

  const segments: WallSegment[] = [];

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    // skip degenerate (zero-length) edges
    if (len < 1e-4) continue;

    segments.push({
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      length: len,
      angle: Math.atan2(dy, dx),
    });
  }

  return segments;
}

/**
 * Build corner "plug" circles to seal the gaps between adjacent
 * edge-segment rectangles. Each plug is a small static circle placed
 * at the shared vertex between two segments.
 *
 * Returns an array of { x, y, radius } that should become static
 * Matter.Bodies.circle colliders.
 */
export function buildCornerPlugs(
  poly: Polyline,
  thickness: number = WALL_THICKNESS,
): { x: number; y: number; radius: number }[] {
  if (poly.length < 3) return [];

  const r = thickness / 2;
  return poly.map((v) => ({ x: v.x, y: v.y, radius: r }));
}

// =============================================================================
// Polygon centroid (area-weighted)
// =============================================================================

/**
 * Compute the geometric centroid of a simple polygon using the
 * shoelace formula (signed-area weighting). This is more accurate
 * than a simple vertex-average for non-convex or irregular shapes.
 *
 * Falls back to vertex-average if the signed area is ~0 (degenerate poly).
 */
export function polygonCentroid(poly: Polyline): Vec2 {
  const n = poly.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { x: poly[0].x, y: poly[0].y };
  if (n === 2)
    return { x: (poly[0].x + poly[1].x) / 2, y: (poly[0].y + poly[1].y) / 2 };

  let signedArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const cross = a.x * b.y - b.x * a.y;
    signedArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }

  signedArea /= 2;

  if (Math.abs(signedArea) < 1e-8) {
    // Degenerate — fall back to vertex average
    let sx = 0;
    let sy = 0;
    for (const v of poly) {
      sx += v.x;
      sy += v.y;
    }
    return { x: sx / n, y: sy / n };
  }

  const factor = 1 / (6 * signedArea);
  return { x: cx * factor, y: cy * factor };
}

// =============================================================================
// Convenience: all segments for an entire hole
// =============================================================================

/**
 * Build all wall segments (edges + corner plugs) for an array of wall polylines.
 */
export function buildAllWallGeometry(
  walls: Polyline[],
  thickness: number = WALL_THICKNESS,
): {
  segments: WallSegment[];
  cornerPlugs: { x: number; y: number; radius: number }[];
} {
  const segments: WallSegment[] = [];
  const cornerPlugs: { x: number; y: number; radius: number }[] = [];

  for (const poly of walls) {
    segments.push(...buildWallSegments(poly, thickness));
    cornerPlugs.push(...buildCornerPlugs(poly, thickness));
  }

  return { segments, cornerPlugs };
}
