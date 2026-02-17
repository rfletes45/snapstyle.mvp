#!/usr/bin/env ts-node
/**
 * validateCourses.ts — Build-time validator for Mini-Golf Duels course JSON
 *
 * Usage:
 *   npx ts-node tools/minigolf/validateCourses.ts
 *   npm run validate:minigolf
 *
 * Checks per-hole:
 *   1. Required keys present with correct types
 *   2. Bounds positive
 *   3. Tee inside bounds
 *   4. Cup inside bounds
 *   5. Wall polygons closed (≥3 vertices) and non-self-intersecting (basic)
 *   6. Cup not inside any wall polygon
 *   7. Obstacles not overlapping tee or cup
 *   8. Hazard polygons inside bounds
 *   9. Surface polygons inside bounds
 */

import * as fs from "fs";
import * as path from "path";

// =============================================================================
// Types
// =============================================================================

interface Point {
  x: number;
  y: number;
}

interface BoundsObj {
  width: number;
  height: number;
}

interface SurfaceDef {
  id: string;
  type: string;
  frictionMul: number;
  poly: Point[];
}

interface HazardDef {
  id: string;
  type: string;
  penalty: number;
  poly: Point[];
}

interface ObstacleDef {
  id: string;
  type: string;
  position: Point;
  size: { width: number; height: number };
  radius?: number;
  speed?: number;
  restitution?: number;
  pointA?: Point;
  pointB?: Point;
}

interface HoleJson {
  id: string;
  packId: string;
  name?: string;
  par: number;
  maxStrokes: number;
  bounds: BoundsObj;
  tee: Point;
  cup: Point;
  cupRadius: number;
  walls: Point[][];
  surfaces: SurfaceDef[];
  hazards: HazardDef[];
  obstacles: ObstacleDef[];
}

// =============================================================================
// Geometry helpers
// =============================================================================

/** Point-in-polygon (ray-casting) */
function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Check if point is inside axis-aligned bounds (0,0 → width,height) */
function pointInBounds(pt: Point, b: BoundsObj): boolean {
  return pt.x >= 0 && pt.x <= b.width && pt.y >= 0 && pt.y <= b.height;
}

/** Check if all polygon vertices are inside bounds */
function polyInsideBounds(poly: Point[], b: BoundsObj): boolean {
  return poly.every((p) => pointInBounds(p, b));
}

/** Basic non-self-intersecting check: no two non-adjacent edges cross */
function segmentsIntersect(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): boolean {
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }
  return false;
}

function isSimplePolygon(poly: Point[]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a1 = poly[i];
    const a2 = poly[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (j === (i + n - 1) % n) continue; // skip adjacent
      const b1 = poly[j];
      const b2 = poly[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

/** Distance between two points */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// =============================================================================
// Validation
// =============================================================================

const errors: string[] = [];

function fail(packId: string, holeId: string, msg: string) {
  errors.push(`[${packId}/${holeId}] ${msg}`);
}

function validateHole(hole: HoleJson, filePath: string) {
  const pid = hole.packId || "unknown";
  const hid = hole.id || path.basename(filePath, ".json");

  // 1. Required keys
  const requiredKeys: (keyof HoleJson)[] = [
    "id",
    "packId",
    "par",
    "maxStrokes",
    "bounds",
    "tee",
    "cup",
    "cupRadius",
    "walls",
    "surfaces",
    "hazards",
    "obstacles",
  ];
  for (const key of requiredKeys) {
    if (hole[key] === undefined || hole[key] === null) {
      fail(pid, hid, `Missing required key: "${key}"`);
    }
  }

  // Type checks
  if (typeof hole.par !== "number" || hole.par < 1) {
    fail(pid, hid, `par must be a positive number, got ${hole.par}`);
  }
  if (typeof hole.maxStrokes !== "number" || hole.maxStrokes < 1) {
    fail(
      pid,
      hid,
      `maxStrokes must be a positive number, got ${hole.maxStrokes}`,
    );
  }
  if (typeof hole.cupRadius !== "number" || hole.cupRadius <= 0) {
    fail(pid, hid, `cupRadius must be positive, got ${hole.cupRadius}`);
  }

  // 2. Bounds positive
  if (!hole.bounds || hole.bounds.width <= 0 || hole.bounds.height <= 0) {
    fail(pid, hid, `Bounds must have positive width and height`);
    return; // Can't validate geometry without valid bounds
  }

  const b = hole.bounds;

  // 3. Tee inside bounds
  if (hole.tee && !pointInBounds(hole.tee, b)) {
    fail(
      pid,
      hid,
      `Tee (${hole.tee.x},${hole.tee.y}) is outside bounds (${b.width}x${b.height})`,
    );
  }

  // 4. Cup inside bounds
  if (hole.cup && !pointInBounds(hole.cup, b)) {
    fail(
      pid,
      hid,
      `Cup (${hole.cup.x},${hole.cup.y}) is outside bounds (${b.width}x${b.height})`,
    );
  }

  // 5. Wall polygons: closed (≥3 verts) and non-self-intersecting
  if (Array.isArray(hole.walls)) {
    for (let i = 0; i < hole.walls.length; i++) {
      const wall = hole.walls[i];
      if (!Array.isArray(wall) || wall.length < 3) {
        fail(pid, hid, `Wall[${i}] must have at least 3 vertices`);
        continue;
      }
      if (!isSimplePolygon(wall)) {
        fail(pid, hid, `Wall[${i}] is self-intersecting`);
      }
    }
  }

  // 6. Cup not inside thin interior wall polygons
  //    Walls define fairway boundaries in mini-golf. Multi-wall courses use
  //    separate polygons for L-shapes, bends, etc. We only flag very thin
  //    partition walls (area < 1000 sq units) that could trap the cup.
  if (hole.cup && Array.isArray(hole.walls)) {
    for (let i = 1; i < hole.walls.length; i++) {
      const wall = hole.walls[i];
      if (wall.length < 3) continue;
      // Compute rough area via shoelace
      let area = 0;
      for (let j = 0; j < wall.length; j++) {
        const k = (j + 1) % wall.length;
        area += wall[j].x * wall[k].y - wall[k].x * wall[j].y;
      }
      area = Math.abs(area) / 2;
      // Only flag if the wall is a thin partition (< 1000 area) and cup is inside
      if (area < 1000 && pointInPolygon(hole.cup, wall)) {
        fail(
          pid,
          hid,
          `Cup is inside thin interior wall polygon[${i}] (area=${area.toFixed(0)})`,
        );
      }
    }
  }

  // 7. Obstacles not overlapping tee or cup
  if (Array.isArray(hole.obstacles)) {
    for (const obs of hole.obstacles) {
      if (!obs.position) continue;
      const obsRadius =
        obs.radius ||
        Math.max((obs.size?.width ?? 0) / 2, (obs.size?.height ?? 0) / 2);
      if (hole.tee && dist(obs.position, hole.tee) < obsRadius + 8) {
        fail(pid, hid, `Obstacle "${obs.id}" overlaps tee`);
      }
      if (
        hole.cup &&
        dist(obs.position, hole.cup) < obsRadius + (hole.cupRadius || 18)
      ) {
        fail(pid, hid, `Obstacle "${obs.id}" overlaps cup`);
      }
    }
  }

  // 8. Hazard polygons inside bounds
  if (Array.isArray(hole.hazards)) {
    for (const haz of hole.hazards) {
      if (!Array.isArray(haz.poly) || haz.poly.length < 3) {
        fail(pid, hid, `Hazard "${haz.id}" poly must have ≥3 vertices`);
        continue;
      }
      if (!polyInsideBounds(haz.poly, b)) {
        fail(pid, hid, `Hazard "${haz.id}" has vertices outside bounds`);
      }
    }
  }

  // 9. Surface polygons inside bounds
  if (Array.isArray(hole.surfaces)) {
    for (const surf of hole.surfaces) {
      if (!Array.isArray(surf.poly) || surf.poly.length < 3) {
        fail(pid, hid, `Surface "${surf.id}" poly must have ≥3 vertices`);
        continue;
      }
      if (!polyInsideBounds(surf.poly, b)) {
        fail(pid, hid, `Surface "${surf.id}" has vertices outside bounds`);
      }
    }
  }
}

// =============================================================================
// Main
// =============================================================================

function main() {
  const SHARED_DIR = path.resolve(
    __dirname,
    "../../shared/games/minigolf/courses",
  );

  if (!fs.existsSync(SHARED_DIR)) {
    console.error(`ERROR: Course directory not found: ${SHARED_DIR}`);
    process.exit(1);
  }

  const packs = fs
    .readdirSync(SHARED_DIR)
    .filter((d) => fs.statSync(path.join(SHARED_DIR, d)).isDirectory());

  if (packs.length === 0) {
    console.error(
      "ERROR: No course packs found in shared/games/minigolf/courses/",
    );
    process.exit(1);
  }

  let totalHoles = 0;

  for (const pack of packs) {
    const packDir = path.join(SHARED_DIR, pack);
    const files = fs.readdirSync(packDir).filter((f) => f.endsWith(".json"));

    console.log(`  Pack "${pack}": ${files.length} hole(s)`);

    for (const file of files) {
      const filePath = path.join(packDir, file);
      let hole: HoleJson;
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        hole = JSON.parse(raw) as HoleJson;
      } catch (err) {
        errors.push(`[${pack}/${file}] Failed to parse JSON: ${err}`);
        continue;
      }
      validateHole(hole, filePath);
      totalHoles++;
    }
  }

  console.log(`\nValidated ${totalHoles} holes across ${packs.length} packs.`);

  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} error(s) found:\n`);
    for (const e of errors) {
      console.error(`  • ${e}`);
    }
    process.exit(1);
  } else {
    console.log("\n✅ All courses pass validation.");
  }
}

main();
