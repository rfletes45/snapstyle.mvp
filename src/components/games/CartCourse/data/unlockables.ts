/**
 * Cart Course Unlockables System
 *
 * Manages unlockable content: courses, cart skins, and game modes.
 * Tracks unlock requirements and progression.
 */

import type { CourseStats } from "./stamps";

// ============================================
// Types
// ============================================

export type UnlockableType = "course" | "cart_skin" | "mode";

export type UnlockRequirement =
  | { type: "none" } // Available from start
  | { type: "complete_course"; courseId: string }
  | { type: "complete_all_courses" }
  | { type: "star_course"; courseId: string; minStars: number }
  | { type: "perfect_course"; courseId: string }
  | { type: "perfect_any_course" }
  | { type: "collect_bananas"; count: number }
  | { type: "collect_coins"; count: number }
  | { type: "earn_stamps"; count: number }
  | { type: "earn_stamp"; stampId: string }
  | { type: "total_score"; points: number }
  | { type: "speed_run"; courseId: string; maxTimeMs: number };

export interface Unlockable {
  id: string;
  name: string;
  description: string;
  type: UnlockableType;
  icon?: string;
  preview?: string; // Image/asset reference
  requirement: UnlockRequirement;
  // Optional display order
  order?: number;
}

export interface UnlockProgress {
  unlockableId: string;
  isUnlocked: boolean;
  currentValue: number;
  targetValue: number;
  percentComplete: number;
  requirementDescription: string;
}

// ============================================
// Course Unlockables
// ============================================

export const UNLOCKABLE_COURSES: Unlockable[] = [
  {
    id: "course_1",
    name: "The Classic Run",
    description: "Learn the ropes with gentle slopes and forgiving bumpers",
    type: "course",
    icon: "🏁",
    requirement: { type: "none" },
    order: 1,
  },
  {
    id: "course_2",
    name: "Industrial Zone",
    description: "Navigate gears, lifts, and precision machinery",
    type: "course",
    icon: "🏭",
    requirement: { type: "complete_course", courseId: "course_1" },
    order: 2,
  },
  {
    id: "course_3",
    name: "The Classic Run - Expert",
    description: "The classic course with fewer safety nets",
    type: "course",
    icon: "⭐",
    requirement: { type: "star_course", courseId: "course_1", minStars: 3 },
    order: 3,
  },
  {
    id: "course_4",
    name: "Industrial Zone - Expert",
    description: "Maximum challenge with unforgiving mechanisms",
    type: "course",
    icon: "💫",
    requirement: { type: "star_course", courseId: "course_2", minStars: 3 },
    order: 4,
  },
];

// ============================================
// Cart Skin Unlockables
// ============================================

export interface CartSkin extends Unlockable {
  type: "cart_skin";
  colors: {
    body: string;
    wheels: string;
    highlight: string;
    trail?: string;
  };
  effects?: {
    trailType?: "none" | "spark" | "flame" | "rainbow" | "star";
    glowColor?: string;
    particleColor?: string;
  };
}

export const UNLOCKABLE_CART_SKINS: CartSkin[] = [
  {
    id: "skin_default",
    name: "Red Racer",
    description: "The classic red cart - reliable and sturdy",
    type: "cart_skin",
    icon: "🔴",
    requirement: { type: "none" },
    colors: {
      body: "#e74c3c",
      wheels: "#2c3e50",
      highlight: "#f39c12",
    },
    order: 1,
  },
  {
    id: "skin_blue",
    name: "Blue Speedster",
    description: "Cool blue for cool customers",
    type: "cart_skin",
    icon: "🔵",
    requirement: { type: "complete_course", courseId: "course_1" },
    colors: {
      body: "#3498db",
      wheels: "#2c3e50",
      highlight: "#ecf0f1",
    },
    order: 2,
  },
  {
    id: "skin_green",
    name: "Green Machine",
    description: "Eco-friendly racing",
    type: "cart_skin",
    icon: "🟢",
    requirement: { type: "collect_bananas", count: 500 },
    colors: {
      body: "#27ae60",
      wheels: "#2c3e50",
      highlight: "#f1c40f",
    },
    order: 3,
  },
  {
    id: "skin_purple",
    name: "Purple Phantom",
    description: "Mysterious and swift",
    type: "cart_skin",
    icon: "🟣",
    requirement: { type: "complete_course", courseId: "course_2" },
    colors: {
      body: "#9b59b6",
      wheels: "#2c3e50",
      highlight: "#e74c3c",
    },
    order: 4,
  },
  {
    id: "skin_golden",
    name: "Golden Cart",
    description: "The pinnacle of cart engineering",
    type: "cart_skin",
    icon: "🥇",
    requirement: { type: "complete_all_courses" },
    colors: {
      body: "#f1c40f",
      wheels: "#d4a017",
      highlight: "#ffffff",
      trail: "#ffd700",
    },
    effects: {
      trailType: "spark",
      glowColor: "#ffd700",
    },
    order: 5,
  },
  {
    id: "skin_neon",
    name: "Neon Runner",
    description: "Light up the course with neon trails",
    type: "cart_skin",
    icon: "💡",
    requirement: { type: "perfect_any_course" },
    colors: {
      body: "#00ffff",
      wheels: "#ff00ff",
      highlight: "#00ff00",
      trail: "#ff00ff",
    },
    effects: {
      trailType: "rainbow",
      glowColor: "#00ffff",
      particleColor: "#ff00ff",
    },
    order: 6,
  },
  {
    id: "skin_retro",
    name: "Retro Wooden",
    description: "A throwback to simpler times",
    type: "cart_skin",
    icon: "🪵",
    requirement: { type: "collect_bananas", count: 1000 },
    colors: {
      body: "#8b4513",
      wheels: "#5d3a1a",
      highlight: "#d2691e",
    },
    order: 7,
  },
  {
    id: "skin_diamond",
    name: "Diamond Edition",
    description: "For the most dedicated racers",
    type: "cart_skin",
    icon: "💎",
    requirement: { type: "earn_stamps", count: 20 },
    colors: {
      body: "#b9f2ff",
      wheels: "#87ceeb",
      highlight: "#ffffff",
      trail: "#b9f2ff",
    },
    effects: {
      trailType: "star",
      glowColor: "#b9f2ff",
    },
    order: 8,
  },
  {
    id: "skin_flame",
    name: "Inferno Cart",
    description: "Leave a blazing trail behind",
    type: "cart_skin",
    icon: "🔥",
    requirement: { type: "speed_run", courseId: "course_1", maxTimeMs: 180000 },
    colors: {
      body: "#ff4500",
      wheels: "#2c3e50",
      highlight: "#ffd700",
      trail: "#ff6347",
    },
    effects: {
      trailType: "flame",
      glowColor: "#ff4500",
      particleColor: "#ffd700",
    },
    order: 9,
  },
  {
    id: "skin_ghost",
    name: "Ghost Cart",
    description: "Ethereal and untouchable",
    type: "cart_skin",
    icon: "👻",
    requirement: { type: "earn_stamp", stampId: "perfect_run" },
    colors: {
      body: "#ffffff80", // Semi-transparent
      wheels: "#cccccc80",
      highlight: "#ffffff",
    },
    effects: {
      trailType: "none",
      glowColor: "#ffffff40",
    },
    order: 10,
  },
];

// ============================================
// Game Mode Unlockables
// ============================================

export interface GameMode extends Unlockable {
  type: "mode";
  modifiers?: {
    timeLimit?: number; // Custom time limit in ms
    livesCount?: number; // Custom lives count
    gravity?: number; // Gravity multiplier
    mirrorX?: boolean; // Mirror horizontally
    mirrorY?: boolean; // Mirror vertically (upside down!)
    noCheckpoints?: boolean;
    timerCountsUp?: boolean; // For time attack
  };
}

export const UNLOCKABLE_MODES: GameMode[] = [
  {
    id: "mode_standard",
    name: "Standard",
    description: "The classic experience with 3 lives and checkpoints",
    type: "mode",
    icon: "🎮",
    requirement: { type: "none" },
    order: 1,
  },
  {
    id: "mode_time_attack",
    name: "Time Attack",
    description: "Race against the clock - no lives, just speed",
    type: "mode",
    icon: "⏱️",
    requirement: { type: "complete_course", courseId: "course_1" },
    modifiers: {
      livesCount: Infinity,
      timerCountsUp: true,
    },
    order: 2,
  },
  {
    id: "mode_one_life",
    name: "One Life",
    description: "One chance, no mistakes",
    type: "mode",
    icon: "💀",
    requirement: { type: "complete_all_courses" },
    modifiers: {
      livesCount: 1,
    },
    order: 3,
  },
  {
    id: "mode_mirror",
    name: "Mirror Mode",
    description: "Everything is reversed - even your muscle memory",
    type: "mode",
    icon: "🪞",
    requirement: { type: "complete_all_courses" },
    modifiers: {
      mirrorX: true,
    },
    order: 4,
  },
  {
    id: "mode_low_gravity",
    name: "Low Gravity",
    description: "Floaty physics for a different challenge",
    type: "mode",
    icon: "🌙",
    requirement: { type: "perfect_any_course" },
    modifiers: {
      gravity: 0.5,
    },
    order: 5,
  },
  {
    id: "mode_high_gravity",
    name: "High Gravity",
    description: "Heavy cart, heavy challenge",
    type: "mode",
    icon: "🪨",
    requirement: { type: "earn_stamps", count: 15 },
    modifiers: {
      gravity: 1.5,
    },
    order: 6,
  },
  {
    id: "mode_no_checkpoints",
    name: "Iron Cart",
    description: "No checkpoints - start from the beginning on crash",
    type: "mode",
    icon: "🛡️",
    requirement: { type: "perfect_course", courseId: "course_1" },
    modifiers: {
      noCheckpoints: true,
    },
    order: 7,
  },
  {
    id: "mode_sprint",
    name: "Sprint Mode",
    description: "3-minute time limit - can you finish in time?",
    type: "mode",
    icon: "🏃",
    requirement: { type: "speed_run", courseId: "course_1", maxTimeMs: 240000 },
    modifiers: {
      timeLimit: 180000,
      livesCount: Infinity,
    },
    order: 8,
  },
];

// ============================================
// All Unlockables Combined
// ============================================

export const ALL_UNLOCKABLES: Unlockable[] = [
  ...UNLOCKABLE_COURSES,
  ...UNLOCKABLE_CART_SKINS,
  ...UNLOCKABLE_MODES,
];

// ============================================
// Unlock Checking Functions
// ============================================

/**
 * Check if an unlockable is unlocked based on player stats
 */
export function isUnlocked(
  unlockable: Unlockable,
  stats: CourseStats,
): boolean {
  const req = unlockable.requirement;

  switch (req.type) {
    case "none":
      return true;

    case "complete_course":
      return stats.coursesCompleted.includes(req.courseId);

    case "complete_all_courses":
      return (
        stats.coursesCompleted.includes("course_1") &&
        stats.coursesCompleted.includes("course_2") &&
        stats.coursesCompleted.includes("course_3") &&
        stats.coursesCompleted.includes("course_4")
      );

    case "star_course":
      return (stats.courseStars[req.courseId] ?? 0) >= req.minStars;

    case "perfect_course":
      return stats.perfectCourses.includes(req.courseId);

    case "perfect_any_course":
      return stats.perfectCourses.length > 0;

    case "collect_bananas":
      return stats.totalBananasCollected >= req.count;

    case "collect_coins":
      return stats.totalCoinsCollected >= req.count;

    case "earn_stamps":
      return stats.earnedStamps.length >= req.count;

    case "earn_stamp":
      return stats.earnedStamps.includes(req.stampId);

    case "total_score":
      const totalScore = Object.values(stats.courseBestScores).reduce(
        (sum, s) => sum + s,
        0,
      );
      return totalScore >= req.points;

    case "speed_run":
      const bestTime = stats.courseBestTimes[req.courseId];
      return bestTime !== undefined && bestTime <= req.maxTimeMs;

    default:
      return false;
  }
}

/**
 * Get unlock progress for an unlockable
 */
export function getUnlockProgress(
  unlockable: Unlockable,
  stats: CourseStats,
): UnlockProgress {
  const req = unlockable.requirement;
  let currentValue = 0;
  let targetValue = 1;
  let description = "";

  switch (req.type) {
    case "none":
      currentValue = 1;
      targetValue = 1;
      description = "Available from start";
      break;

    case "complete_course":
      currentValue = stats.coursesCompleted.includes(req.courseId) ? 1 : 0;
      targetValue = 1;
      description = `Complete ${getCourseDisplayName(req.courseId)}`;
      break;

    case "complete_all_courses":
      currentValue = stats.coursesCompleted.length;
      targetValue = 4;
      description = "Complete all 4 courses";
      break;

    case "star_course":
      currentValue = stats.courseStars[req.courseId] ?? 0;
      targetValue = req.minStars;
      description = `Earn ${req.minStars} stars on ${getCourseDisplayName(req.courseId)}`;
      break;

    case "perfect_course":
      currentValue = stats.perfectCourses.includes(req.courseId) ? 1 : 0;
      targetValue = 1;
      description = `Complete ${getCourseDisplayName(req.courseId)} without losing lives`;
      break;

    case "perfect_any_course":
      currentValue = stats.perfectCourses.length > 0 ? 1 : 0;
      targetValue = 1;
      description = "Complete any course without losing lives";
      break;

    case "collect_bananas":
      currentValue = stats.totalBananasCollected;
      targetValue = req.count;
      description = `Collect ${req.count} bananas`;
      break;

    case "collect_coins":
      currentValue = stats.totalCoinsCollected;
      targetValue = req.count;
      description = `Collect ${req.count} coins`;
      break;

    case "earn_stamps":
      currentValue = stats.earnedStamps.length;
      targetValue = req.count;
      description = `Earn ${req.count} stamps`;
      break;

    case "earn_stamp":
      currentValue = stats.earnedStamps.includes(req.stampId) ? 1 : 0;
      targetValue = 1;
      description = `Earn the "${req.stampId}" stamp`;
      break;

    case "total_score":
      currentValue = Object.values(stats.courseBestScores).reduce(
        (sum, s) => sum + s,
        0,
      );
      targetValue = req.points;
      description = `Reach a total score of ${req.points.toLocaleString()}`;
      break;

    case "speed_run":
      const bestTime = stats.courseBestTimes[req.courseId] ?? Infinity;
      currentValue = bestTime <= req.maxTimeMs ? 1 : 0;
      targetValue = 1;
      const timeStr = formatTime(req.maxTimeMs);
      description = `Complete ${getCourseDisplayName(req.courseId)} in under ${timeStr}`;
      break;
  }

  const percentComplete = Math.min(100, (currentValue / targetValue) * 100);

  return {
    unlockableId: unlockable.id,
    isUnlocked: currentValue >= targetValue,
    currentValue,
    targetValue,
    percentComplete,
    requirementDescription: description,
  };
}

/**
 * Get all unlocked courses
 */
export function getUnlockedCourses(stats: CourseStats): Unlockable[] {
  return UNLOCKABLE_COURSES.filter((c) => isUnlocked(c, stats));
}

/**
 * Get all unlocked cart skins
 */
export function getUnlockedCartSkins(stats: CourseStats): CartSkin[] {
  return UNLOCKABLE_CART_SKINS.filter((s) => isUnlocked(s, stats));
}

/**
 * Get all unlocked game modes
 */
export function getUnlockedModes(stats: CourseStats): GameMode[] {
  return UNLOCKABLE_MODES.filter((m) => isUnlocked(m, stats));
}

/**
 * Get the next unlockable to work toward for a given type
 */
export function getNextUnlockable(
  type: UnlockableType,
  stats: CourseStats,
): { unlockable: Unlockable; progress: UnlockProgress } | null {
  const unlockables =
    type === "course"
      ? UNLOCKABLE_COURSES
      : type === "cart_skin"
        ? UNLOCKABLE_CART_SKINS
        : UNLOCKABLE_MODES;

  const locked = unlockables.filter((u) => !isUnlocked(u, stats));
  if (locked.length === 0) return null;

  // Return the first locked one by order
  const sorted = [...locked].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const next = sorted[0];

  return {
    unlockable: next,
    progress: getUnlockProgress(next, stats),
  };
}

/**
 * Check for newly unlocked content after a game session
 */
export function checkNewUnlocks(
  previousUnlocks: string[],
  stats: CourseStats,
): Unlockable[] {
  const newlyUnlocked: Unlockable[] = [];

  for (const unlockable of ALL_UNLOCKABLES) {
    if (previousUnlocks.includes(unlockable.id)) {
      continue;
    }

    if (isUnlocked(unlockable, stats)) {
      newlyUnlocked.push(unlockable);
    }
  }

  return newlyUnlocked;
}

/**
 * Get cart skin by ID
 */
export function getCartSkinById(skinId: string): CartSkin | undefined {
  return UNLOCKABLE_CART_SKINS.find((s) => s.id === skinId);
}

/**
 * Get game mode by ID
 */
export function getGameModeById(modeId: string): GameMode | undefined {
  return UNLOCKABLE_MODES.find((m) => m.id === modeId);
}

/**
 * Get course by ID
 */
export function getCourseUnlockableById(
  courseId: string,
): Unlockable | undefined {
  return UNLOCKABLE_COURSES.find((c) => c.id === courseId);
}

// ============================================
// Helper Functions
// ============================================

function getCourseDisplayName(courseId: string): string {
  const course = UNLOCKABLE_COURSES.find((c) => c.id === courseId);
  return course?.name ?? courseId;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ============================================
// User Unlocks State
// ============================================

export interface UserUnlocks {
  unlockedCourses: string[];
  unlockedSkins: string[];
  unlockedModes: string[];
  selectedSkin: string;
  selectedMode: string;
}

/**
 * Create initial unlocks state
 */
export function createInitialUnlocks(): UserUnlocks {
  return {
    unlockedCourses: ["course_1"], // Course 1 always available
    unlockedSkins: ["skin_default"], // Default skin always available
    unlockedModes: ["mode_standard"], // Standard mode always available
    selectedSkin: "skin_default",
    selectedMode: "mode_standard",
  };
}

/**
 * Update unlocks after checking stats
 */
export function updateUnlocks(
  currentUnlocks: UserUnlocks,
  stats: CourseStats,
): UserUnlocks {
  const allUnlockedIds = ALL_UNLOCKABLES.filter((u) =>
    isUnlocked(u, stats),
  ).map((u) => u.id);

  return {
    ...currentUnlocks,
    unlockedCourses: allUnlockedIds.filter((id) => id.startsWith("course_")),
    unlockedSkins: allUnlockedIds.filter((id) => id.startsWith("skin_")),
    unlockedModes: allUnlockedIds.filter((id) => id.startsWith("mode_")),
  };
}
