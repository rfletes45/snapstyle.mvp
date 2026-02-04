/**
 * Course Utilities
 *
 * Helper functions for course management, selection, and progression.
 */

import {
  Area,
  Checkpoint,
  Collectible,
  Course,
  MechanismDefinition,
  StaticObstacle,
} from "../../types/cartCourse.types";
import { COURSE_1 } from "./course1";
import { COURSE_2 } from "./course2";
import { COURSE_3 } from "./course3";
import { COURSE_4 } from "./course4";

// ============================================
// Course Collection
// ============================================

/**
 * All available courses
 */
export const ALL_COURSES: Course[] = [COURSE_1, COURSE_2, COURSE_3, COURSE_4];

/**
 * Course map for quick lookup by ID
 */
export const COURSE_MAP: Map<string, Course> = new Map(
  ALL_COURSES.map((course) => [course.id, course]),
);

// ============================================
// Course Lookup Functions
// ============================================

/**
 * Get a course by ID
 */
export function getCourseById(courseId: string): Course | undefined {
  return COURSE_MAP.get(courseId);
}

/**
 * Get a course by index
 */
export function getCourseByIndex(index: number): Course | undefined {
  return ALL_COURSES[index];
}

/**
 * Get the next course after the given course
 */
export function getNextCourse(currentCourseId: string): Course | undefined {
  const currentIndex = ALL_COURSES.findIndex((c) => c.id === currentCourseId);
  if (currentIndex === -1 || currentIndex >= ALL_COURSES.length - 1) {
    return undefined;
  }
  return ALL_COURSES[currentIndex + 1];
}

// ============================================
// Unlock/Progression Functions
// ============================================

export interface PlayerProgress {
  completedCourses: Map<string, CourseCompletion>;
  totalStars: number;
}

export interface CourseCompletion {
  courseId: string;
  bestTime: number;
  bestScore: number;
  stars: number; // 1-3 stars
  collectiblesFound: number;
  deathCount: number;
  completedAt: number; // timestamp
}

/**
 * Get list of courses that are unlocked for the player
 */
export function getUnlockedCourses(progress: PlayerProgress): Course[] {
  return ALL_COURSES.filter((course) => isCourseUnlocked(course, progress));
}

/**
 * Check if a specific course is unlocked
 */
export function isCourseUnlocked(
  course: Course,
  progress: PlayerProgress,
): boolean {
  // Course 1 is always unlocked
  if (!course.unlockRequirements) {
    return true;
  }

  const { courseCompleted, minStars } = course.unlockRequirements;

  // Check if required course is completed
  if (courseCompleted) {
    const completion = progress.completedCourses.get(courseCompleted);
    if (!completion) {
      return false;
    }

    // Check if minimum stars are achieved
    if (minStars && completion.stars < minStars) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate stars earned for a course completion
 */
export function calculateStars(
  course: Course,
  time: number,
  collectiblesPercentage: number,
  deathCount: number,
): number {
  let stars = 1; // Completing gives 1 star

  // 2 stars: Under par time
  if (time <= course.parTime) {
    stars = 2;
  }

  // 3 stars: Under par time AND 90%+ collectibles AND less than 3 deaths
  if (
    time <= course.parTime &&
    collectiblesPercentage >= 90 &&
    deathCount < 3
  ) {
    stars = 3;
  }

  return stars;
}

// ============================================
// Course Statistics Functions
// ============================================

export interface CourseStats {
  totalAreas: number;
  totalObstacles: number;
  totalMechanisms: number;
  totalCollectibles: number;
  totalBananas: number;
  totalCoins: number;
  maxPossibleScore: number;
  mechanismBreakdown: Map<string, number>;
  surfaceBreakdown: Map<string, number>;
}

/**
 * Get statistics for a course
 */
export function getCourseStats(course: Course): CourseStats {
  let totalObstacles = 0;
  let totalMechanisms = 0;
  let totalBananas = 0;
  let totalCoins = 0;
  const mechanismBreakdown = new Map<string, number>();
  const surfaceBreakdown = new Map<string, number>();

  course.areas.forEach((area: Area) => {
    // Count obstacles
    totalObstacles += area.obstacles.length;

    // Count and categorize mechanisms
    area.mechanisms.forEach((mechanism: MechanismDefinition) => {
      totalMechanisms++;
      const count = mechanismBreakdown.get(mechanism.type) ?? 0;
      mechanismBreakdown.set(mechanism.type, count + 1);
    });

    // Count and categorize collectibles
    area.collectibles.forEach((collectible: Collectible) => {
      if (collectible.type === "banana") totalBananas++;
      else if (collectible.type === "coin") totalCoins++;
    });

    // Count surface types
    area.obstacles.forEach((obstacle: StaticObstacle) => {
      if (obstacle.surfaceType) {
        const count = surfaceBreakdown.get(obstacle.surfaceType) ?? 0;
        surfaceBreakdown.set(obstacle.surfaceType, count + 1);
      }
    });
  });

  const totalCollectibles = totalBananas + totalCoins;
  const maxPossibleScore = totalBananas * 100 + totalCoins * 500;

  return {
    totalAreas: course.totalAreas ?? course.areas.length,
    totalObstacles,
    totalMechanisms,
    totalCollectibles,
    totalBananas,
    totalCoins,
    maxPossibleScore,
    mechanismBreakdown,
    surfaceBreakdown,
  };
}

// ============================================
// Area Functions
// ============================================

/**
 * Get an area by index from a course
 */
export function getAreaByIndex(
  course: Course,
  areaIndex: number,
): Area | undefined {
  return course.areas[areaIndex];
}

/**
 * Get the starting area of a course
 */
export function getStartingArea(course: Course): Area {
  return course.areas[0];
}

/**
 * Get the finishing area of a course
 */
export function getFinishArea(course: Course): Area {
  return course.areas[course.areas.length - 1];
}

/**
 * Get checkpoint for an area
 */
export function getAreaCheckpoint(area: Area): Checkpoint {
  return area.checkpoint;
}

/**
 * Get all checkpoints from a course
 */
export function getAllCheckpoints(course: Course): Checkpoint[] {
  return course.areas.map((area: Area) => area.checkpoint);
}

/**
 * Get starting checkpoint
 */
export function getStartCheckpoint(course: Course): Checkpoint {
  const startArea = course.areas.find((area: Area) => area.checkpoint.isStart);
  return startArea?.checkpoint ?? course.areas[0].checkpoint;
}

/**
 * Get finish checkpoint
 */
export function getFinishCheckpoint(course: Course): Checkpoint {
  const finishArea = course.areas.find(
    (area: Area) => area.checkpoint.isFinish,
  );
  return (
    finishArea?.checkpoint ?? course.areas[course.areas.length - 1].checkpoint
  );
}

// ============================================
// Collectible Functions
// ============================================

/**
 * Get all collectibles from a course
 */
export function getAllCollectibles(course: Course): Collectible[] {
  return course.areas.flatMap((area: Area) => area.collectibles);
}

/**
 * Get collectibles for a specific area
 */
export function getAreaCollectibles(
  course: Course,
  areaIndex: number,
): Collectible[] {
  const area = course.areas[areaIndex];
  return area ? area.collectibles : [];
}

// ============================================
// Mechanism Functions
// ============================================

/**
 * Get all mechanisms from a course
 */
export function getAllMechanisms(course: Course): MechanismDefinition[] {
  return course.areas.flatMap((area) => area.mechanisms);
}

/**
 * Get mechanisms for a specific area
 */
export function getAreaMechanisms(
  course: Course,
  areaIndex: number,
): MechanismDefinition[] {
  const area = course.areas[areaIndex];
  return area ? area.mechanisms : [];
}

// ============================================
// Course Validation
// ============================================

export interface CourseValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a course definition
 */
export function validateCourse(course: Course): CourseValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!course.id) errors.push("Course ID is required");
  if (!course.name) errors.push("Course name is required");
  if (!course.areas || course.areas.length === 0) {
    errors.push("Course must have at least one area");
  }

  // Validate areas
  course.areas.forEach((area, index) => {
    // Check area has checkpoint
    if (!area.checkpoint) {
      errors.push(`Area ${index} is missing a checkpoint`);
    }

    // Check area bounds - use computed width/height if not provided
    const boundsWidth =
      area.bounds.width ?? area.bounds.maxX - area.bounds.minX;
    const boundsHeight =
      area.bounds.height ?? area.bounds.maxY - area.bounds.minY;
    if (!area.bounds || boundsWidth <= 0 || boundsHeight <= 0) {
      errors.push(`Area ${index} has invalid bounds`);
    }

    // Check for starting checkpoint
    if (index === 0 && !area.checkpoint?.isStart) {
      warnings.push("First area checkpoint should have isStart=true");
    }

    // Check for finish checkpoint
    if (index === course.areas.length - 1 && !area.checkpoint?.isFinish) {
      warnings.push("Last area checkpoint should have isFinish=true");
    }
  });

  // Check for starting area
  const hasStartCheckpoint = course.areas.some((a) => a.checkpoint?.isStart);
  if (!hasStartCheckpoint) {
    warnings.push("No checkpoint marked as start (isStart=true)");
  }

  // Check for finish area
  const hasFinishCheckpoint = course.areas.some((a) => a.checkpoint?.isFinish);
  if (!hasFinishCheckpoint) {
    warnings.push("No checkpoint marked as finish (isFinish=true)");
  }

  // Check totalAreas matches actual areas (if totalAreas is provided)
  const expectedTotalAreas = course.totalAreas ?? course.areas.length;
  if (expectedTotalAreas !== course.areas.length) {
    warnings.push(
      `totalAreas (${expectedTotalAreas}) doesn't match actual areas count (${course.areas.length})`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate all courses
 */
export function validateAllCourses(): Map<string, CourseValidationResult> {
  const results = new Map<string, CourseValidationResult>();
  ALL_COURSES.forEach((course) => {
    results.set(course.id, validateCourse(course));
  });
  return results;
}

// ============================================
// Course Display Functions
// ============================================

export interface CourseDisplayInfo {
  id: string;
  name: string;
  description: string | undefined;
  theme: string;
  difficulty: number;
  difficultyLabel: string;
  parTime: number;
  parTimeFormatted: string;
  isLocked: boolean;
  stats: CourseStats;
}

/**
 * Get course display information
 */
export function getCourseDisplayInfo(
  course: Course,
  progress: PlayerProgress,
): CourseDisplayInfo {
  const difficultyLabels = ["Easy", "Medium", "Hard", "Expert"];
  const isLocked = !isCourseUnlocked(course, progress);

  // Format par time as mm:ss
  const minutes = Math.floor(course.parTime / 60);
  const seconds = course.parTime % 60;
  const parTimeFormatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return {
    id: course.id,
    name: course.name,
    description: course.description,
    theme: course.theme,
    difficulty: course.difficulty,
    difficultyLabel: difficultyLabels[course.difficulty - 1] ?? "Unknown",
    parTime: course.parTime,
    parTimeFormatted,
    isLocked,
    stats: getCourseStats(course),
  };
}

/**
 * Get display info for all courses
 */
export function getAllCourseDisplayInfo(
  progress: PlayerProgress,
): CourseDisplayInfo[] {
  return ALL_COURSES.map((course) => getCourseDisplayInfo(course, progress));
}
