/**
 * Cart Course - Course Data Index
 * Exports all course definitions and utilities
 */

// Course Definitions
export { COURSE_1, COURSE_1_AREAS } from "./course1";
export { COURSE_2, COURSE_2_AREAS } from "./course2";
export {
  COURSE_3,
  COURSE_3_AREAS,
  COURSE_3_STATS,
  getCourse3Checkpoints,
  getCourse3CollectibleCount,
} from "./course3";
export {
  COURSE_4,
  COURSE_4_AREAS,
  COURSE_4_STATS,
  getCourse4Checkpoints,
  getCourse4CollectibleCount,
} from "./course4";

// Course Utilities
export {
  ALL_COURSES,
  COURSE_MAP,
  calculateStars,
  getAllCheckpoints,
  getAllCollectibles,
  getAllCourseDisplayInfo,
  getAllMechanisms,
  getAreaByIndex,
  getAreaCheckpoint,
  getAreaCollectibles,
  getAreaMechanisms,
  getCourseById,
  getCourseByIndex,
  getCourseDisplayInfo,
  getCourseStats,
  getFinishArea,
  getFinishCheckpoint,
  getNextCourse,
  getStartCheckpoint,
  getStartingArea,
  getUnlockedCourses,
  isCourseUnlocked,
  validateAllCourses,
  validateCourse,
} from "./courseUtils";

// Types re-exported for convenience
export type {
  CourseCompletion,
  CourseDisplayInfo,
  CourseStats,
  CourseValidationResult,
  PlayerProgress,
} from "./courseUtils";
