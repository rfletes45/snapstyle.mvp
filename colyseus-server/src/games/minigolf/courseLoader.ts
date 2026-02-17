/**
 * courseLoader — Loads hole/course JSON for the MiniGolf Duels room.
 *
 * Courses are stored as JSON files under:
 *   colyseus-server/src/games/minigolf/courses/<packId>.json
 *   shared/golfDuels/courses/<packId>.json            (v2 packs)
 *
 * The loader reads them once and caches in memory.
 * V2-format courses are validated with the shared courseValidator.
 */

import fs from "fs";
import path from "path";
import { validateCourse } from "../../../../shared/golfDuels/courseValidator";
import { createServerLogger } from "../../utils/logger";
import type { CourseConfig, HoleConfig } from "./types";

const log = createServerLogger("MiniGolfCourseLoader");

// In-memory cache: packId -> CourseConfig
const courseCache = new Map<string, CourseConfig>();

const COURSES_DIR = path.resolve(__dirname, "courses");
const V2_COURSES_DIR = path.resolve(
  __dirname,
  "../../../../shared/golfDuels/courses",
);

/**
 * Load an entire course pack by packId.
 * Returns cached result on subsequent calls.
 */
export function loadCourse(packId: string): CourseConfig {
  const cached = courseCache.get(packId);
  if (cached) return cached;

  // Try standard location first, then v2 shared directory
  let filePath = path.join(COURSES_DIR, `${packId}.json`);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(V2_COURSES_DIR, `${packId}.json`);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`[MiniGolfCourseLoader] Course pack not found: ${packId}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const course: CourseConfig = JSON.parse(raw);

  // V2 validation (if version field present)
  if ((course as any).version != null) {
    const vErrors = validateCourse(course);
    if (vErrors.length > 0) {
      throw new Error(
        `[MiniGolfCourseLoader] V2 validation failed for "${packId}":\n  ${vErrors.join("\n  ")}`,
      );
    }
    log.info(`V2 validation passed for pack "${packId}"`);
  } else {
    // Legacy v1 basic validation
    if (
      !course.packId ||
      !Array.isArray(course.holes) ||
      course.holes.length === 0
    ) {
      throw new Error(
        `[MiniGolfCourseLoader] Invalid course pack "${packId}": missing packId or holes`,
      );
    }

    for (let i = 0; i < course.holes.length; i++) {
      const h = course.holes[i];
      if (!h.id || !h.tee || !h.cup || !h.bounds || !Array.isArray(h.walls)) {
        throw new Error(
          `[MiniGolfCourseLoader] Hole ${i} in pack "${packId}" fails validation`,
        );
      }
    }
  }

  courseCache.set(packId, course);
  log.info(`Loaded course pack "${packId}" with ${course.holes.length} holes`);
  return course;
}

/**
 * Get a specific hole from a course pack.
 */
export function loadHole(packId: string, holeIndex: number): HoleConfig {
  const course = loadCourse(packId);
  if (holeIndex < 0 || holeIndex >= course.holes.length) {
    throw new Error(
      `[MiniGolfCourseLoader] Hole index ${holeIndex} out of range for pack "${packId}" (${course.holes.length} holes)`,
    );
  }
  return course.holes[holeIndex];
}

/**
 * Return the total number of holes in a pack.
 */
export function holeCount(packId: string): number {
  return loadCourse(packId).holes.length;
}
