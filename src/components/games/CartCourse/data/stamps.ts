/**
 * Cart Course Stamps (Achievements)
 *
 * Defines all stamps/achievements that can be earned in Cart Course.
 * Based on Nintendo Land's Donkey Kong Crash Course stamp system.
 */

// ============================================
// Stamp Types
// ============================================

export type StampCategory =
  | "completion"
  | "skill"
  | "collection"
  | "speed"
  | "challenge"
  | "mastery";

export type StampRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface StampDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: StampCategory;
  rarity: StampRarity;
  // Requirements for automatic detection
  requirement: StampRequirement;
  // Points awarded
  points: number;
  // Hidden until unlocked
  secret?: boolean;
}

export type StampRequirement =
  | { type: "course_complete"; courseId: string }
  | { type: "all_courses_complete" }
  | { type: "perfect_course"; courseId: string } // No lives lost
  | { type: "perfect_all_courses" }
  | { type: "perfect_area"; courseId: string; areaNumber: number }
  | { type: "collect_all_bananas"; courseId: string }
  | { type: "skip_bananas"; courseId: string; minSkipped: number }
  | { type: "speed_run"; courseId: string; maxTimeMs: number }
  | { type: "speed_run_any"; maxTimeMs: number }
  | { type: "total_bananas"; count: number }
  | { type: "total_coins"; count: number }
  | { type: "total_crashes"; count: number }
  | { type: "total_playtime"; hours: number }
  | { type: "air_time"; seconds: number }
  | { type: "narrow_escape"; pixels: number }
  | { type: "no_mechanisms"; courseId: string }
  | { type: "star_rating"; courseId: string; stars: 3 }
  | { type: "all_three_stars" }
  | { type: "custom"; checkFn: string }; // Named function reference

// ============================================
// Stamp Definitions
// ============================================

export const CART_COURSE_STAMPS: StampDefinition[] = [
  // ====================
  // COMPLETION STAMPS
  // ====================
  {
    id: "first_finish",
    name: "First Finish",
    description: "Complete any course for the first time",
    icon: "🏁",
    category: "completion",
    rarity: "common",
    requirement: { type: "course_complete", courseId: "course_1" },
    points: 100,
  },
  {
    id: "classic_champion",
    name: "Classic Champion",
    description: "Complete The Classic Run",
    icon: "🏆",
    category: "completion",
    rarity: "common",
    requirement: { type: "course_complete", courseId: "course_1" },
    points: 200,
  },
  {
    id: "industrial_master",
    name: "Industrial Master",
    description: "Complete Industrial Zone",
    icon: "🏭",
    category: "completion",
    rarity: "uncommon",
    requirement: { type: "course_complete", courseId: "course_2" },
    points: 300,
  },
  {
    id: "expert_classic",
    name: "Expert Classic",
    description: "Complete The Classic Run - Expert",
    icon: "⭐",
    category: "completion",
    rarity: "rare",
    requirement: { type: "course_complete", courseId: "course_3" },
    points: 500,
  },
  {
    id: "expert_industrial",
    name: "Expert Industrial",
    description: "Complete Industrial Zone - Expert",
    icon: "💫",
    category: "completion",
    rarity: "rare",
    requirement: { type: "course_complete", courseId: "course_4" },
    points: 500,
  },
  {
    id: "double_damsel_rescue",
    name: "Double Damsel Rescue",
    description: "Complete all four courses",
    icon: "👸👸",
    category: "completion",
    rarity: "epic",
    requirement: { type: "all_courses_complete" },
    points: 1000,
  },

  // ====================
  // SKILL STAMPS (PERFECT RUNS)
  // ====================
  {
    id: "perfect_area_2",
    name: "Perfect through Area 2",
    description: "Reach the third checkpoint without losing a life",
    icon: "✨",
    category: "skill",
    rarity: "uncommon",
    requirement: { type: "perfect_area", courseId: "course_1", areaNumber: 2 },
    points: 150,
  },
  {
    id: "perfect_area_5",
    name: "Halfway Hero",
    description: "Reach Area 6 without losing a life",
    icon: "🌟",
    category: "skill",
    rarity: "rare",
    requirement: { type: "perfect_area", courseId: "course_1", areaNumber: 5 },
    points: 300,
  },
  {
    id: "perfect_classic",
    name: "Flawless Classic",
    description: "Complete The Classic Run without losing any lives",
    icon: "💎",
    category: "skill",
    rarity: "epic",
    requirement: { type: "perfect_course", courseId: "course_1" },
    points: 750,
  },
  {
    id: "perfect_industrial",
    name: "Flawless Industrial",
    description: "Complete Industrial Zone without losing any lives",
    icon: "🔷",
    category: "skill",
    rarity: "epic",
    requirement: { type: "perfect_course", courseId: "course_2" },
    points: 750,
  },
  {
    id: "perfect_run",
    name: "Perfect Run",
    description: "Complete all four courses without losing any lives",
    icon: "🏆",
    category: "skill",
    rarity: "legendary",
    requirement: { type: "perfect_all_courses" },
    points: 2000,
  },
  {
    id: "narrow_escape",
    name: "Narrow Escape",
    description: "Land a jump with less than 10 pixels to spare",
    icon: "😰",
    category: "skill",
    rarity: "rare",
    requirement: { type: "narrow_escape", pixels: 10 },
    points: 250,
    secret: true,
  },
  {
    id: "air_time",
    name: "Air Time",
    description: "Stay airborne for 3 seconds",
    icon: "🪂",
    category: "skill",
    rarity: "uncommon",
    requirement: { type: "air_time", seconds: 3 },
    points: 200,
  },

  // ====================
  // COLLECTION STAMPS
  // ====================
  {
    id: "banana_lover",
    name: "Banana Lover",
    description: "Collect 100 bananas total",
    icon: "🍌",
    category: "collection",
    rarity: "common",
    requirement: { type: "total_bananas", count: 100 },
    points: 100,
  },
  {
    id: "banana_hoarder",
    name: "Banana Hoarder",
    description: "Collect 500 bananas total",
    icon: "🍌🍌",
    category: "collection",
    rarity: "uncommon",
    requirement: { type: "total_bananas", count: 500 },
    points: 250,
  },
  {
    id: "banana_millionaire",
    name: "Banana Millionaire",
    description: "Collect 1000 bananas total",
    icon: "🍌👑",
    category: "collection",
    rarity: "rare",
    requirement: { type: "total_bananas", count: 1000 },
    points: 500,
  },
  {
    id: "coin_collector",
    name: "Coin Collector",
    description: "Collect 50 coins total",
    icon: "🪙",
    category: "collection",
    rarity: "uncommon",
    requirement: { type: "total_coins", count: 50 },
    points: 200,
  },
  {
    id: "coin_tycoon",
    name: "Coin Tycoon",
    description: "Collect 200 coins total",
    icon: "🪙💰",
    category: "collection",
    rarity: "rare",
    requirement: { type: "total_coins", count: 200 },
    points: 400,
  },
  {
    id: "all_bananas_course_1",
    name: "Banana Sweep",
    description: "Collect all bananas in The Classic Run",
    icon: "🍌✅",
    category: "collection",
    rarity: "uncommon",
    requirement: { type: "collect_all_bananas", courseId: "course_1" },
    points: 300,
  },
  {
    id: "skip_30_bananas",
    name: "Skip 30 Bananas",
    description: "Finish Course 1 while skipping at least 30 bananas",
    icon: "🍌❌",
    category: "challenge",
    rarity: "rare",
    requirement: { type: "skip_bananas", courseId: "course_1", minSkipped: 30 },
    points: 350,
    secret: true,
  },

  // ====================
  // SPEED STAMPS
  // ====================
  {
    id: "speed_demon",
    name: "Speed Demon",
    description: "Complete any course in under 3 minutes",
    icon: "⚡",
    category: "speed",
    rarity: "rare",
    requirement: { type: "speed_run_any", maxTimeMs: 3 * 60 * 1000 },
    points: 400,
  },
  {
    id: "lightning_classic",
    name: "Lightning Classic",
    description: "Complete The Classic Run in under 4 minutes",
    icon: "⚡🏃",
    category: "speed",
    rarity: "uncommon",
    requirement: {
      type: "speed_run",
      courseId: "course_1",
      maxTimeMs: 4 * 60 * 1000,
    },
    points: 300,
  },
  {
    id: "speedster_industrial",
    name: "Industrial Speedster",
    description: "Complete Industrial Zone in under 5 minutes",
    icon: "🏭⚡",
    category: "speed",
    rarity: "uncommon",
    requirement: {
      type: "speed_run",
      courseId: "course_2",
      maxTimeMs: 5 * 60 * 1000,
    },
    points: 350,
  },
  {
    id: "world_record_pace",
    name: "World Record Pace",
    description: "Complete any course in under 2 minutes",
    icon: "🌍⚡",
    category: "speed",
    rarity: "epic",
    requirement: { type: "speed_run_any", maxTimeMs: 2 * 60 * 1000 },
    points: 750,
    secret: true,
  },

  // ====================
  // CHALLENGE STAMPS
  // ====================
  {
    id: "crash_test_dummy",
    name: "Crash Test Dummy",
    description: "Crash 50 times total",
    icon: "💥",
    category: "challenge",
    rarity: "common",
    requirement: { type: "total_crashes", count: 50 },
    points: 50,
    secret: true,
  },
  {
    id: "persistent_player",
    name: "Persistent Player",
    description: "Crash 200 times total (and keep going!)",
    icon: "💪",
    category: "challenge",
    rarity: "uncommon",
    requirement: { type: "total_crashes", count: 200 },
    points: 150,
    secret: true,
  },
  {
    id: "dedicated_racer",
    name: "Dedicated Racer",
    description: "Play for 5 hours total",
    icon: "⏰",
    category: "challenge",
    rarity: "uncommon",
    requirement: { type: "total_playtime", hours: 5 },
    points: 200,
  },
  {
    id: "marathon_runner",
    name: "Marathon Runner",
    description: "Play for 20 hours total",
    icon: "🏃‍♂️",
    category: "challenge",
    rarity: "rare",
    requirement: { type: "total_playtime", hours: 20 },
    points: 400,
  },

  // ====================
  // MASTERY STAMPS
  // ====================
  {
    id: "three_star_classic",
    name: "Three Star Classic",
    description: "Earn 3 stars on The Classic Run",
    icon: "⭐⭐⭐",
    category: "mastery",
    rarity: "rare",
    requirement: { type: "star_rating", courseId: "course_1", stars: 3 },
    points: 400,
  },
  {
    id: "three_star_industrial",
    name: "Three Star Industrial",
    description: "Earn 3 stars on Industrial Zone",
    icon: "🌟🌟🌟",
    category: "mastery",
    rarity: "rare",
    requirement: { type: "star_rating", courseId: "course_2", stars: 3 },
    points: 400,
  },
  {
    id: "all_three_stars",
    name: "Star Master",
    description: "Earn 3 stars on all courses",
    icon: "🌟👑",
    category: "mastery",
    rarity: "legendary",
    requirement: { type: "all_three_stars" },
    points: 1500,
  },
  {
    id: "no_mechanism_classic",
    name: "Pure Skill",
    description: "Complete The Classic Run without using any mechanisms",
    icon: "🎯",
    category: "mastery",
    rarity: "legendary",
    requirement: { type: "no_mechanisms", courseId: "course_1" },
    points: 1000,
    secret: true,
  },
];

// ============================================
// Stamp Helpers
// ============================================

/**
 * Get stamp by ID
 */
export function getStampById(stampId: string): StampDefinition | undefined {
  return CART_COURSE_STAMPS.find((s) => s.id === stampId);
}

/**
 * Get all stamps in a category
 */
export function getStampsByCategory(
  category: StampCategory,
): StampDefinition[] {
  return CART_COURSE_STAMPS.filter((s) => s.category === category);
}

/**
 * Get all stamps of a rarity
 */
export function getStampsByRarity(rarity: StampRarity): StampDefinition[] {
  return CART_COURSE_STAMPS.filter((s) => s.rarity === rarity);
}

/**
 * Get all non-secret stamps
 */
export function getVisibleStamps(): StampDefinition[] {
  return CART_COURSE_STAMPS.filter((s) => !s.secret);
}

/**
 * Get total points from a list of stamp IDs
 */
export function calculateStampPoints(stampIds: string[]): number {
  return stampIds.reduce((total, id) => {
    const stamp = getStampById(id);
    return total + (stamp?.points ?? 0);
  }, 0);
}

/**
 * Get rarity color for UI
 */
export function getStampRarityColor(rarity: StampRarity): string {
  switch (rarity) {
    case "common":
      return "#9e9e9e"; // Gray
    case "uncommon":
      return "#4caf50"; // Green
    case "rare":
      return "#2196f3"; // Blue
    case "epic":
      return "#9c27b0"; // Purple
    case "legendary":
      return "#ff9800"; // Gold/Orange
    default:
      return "#9e9e9e";
  }
}

/**
 * Get rarity display name
 */
export function getStampRarityName(rarity: StampRarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

// ============================================
// Stamp Progress Tracking
// ============================================

export interface StampProgress {
  stampId: string;
  currentValue: number;
  targetValue: number;
  percentComplete: number;
  isComplete: boolean;
}

/**
 * Calculate progress toward a stamp
 */
export function calculateStampProgress(
  stamp: StampDefinition,
  stats: CourseStats,
): StampProgress {
  const req = stamp.requirement;
  let currentValue = 0;
  let targetValue = 1;

  switch (req.type) {
    case "total_bananas":
      currentValue = stats.totalBananasCollected;
      targetValue = req.count;
      break;

    case "total_coins":
      currentValue = stats.totalCoinsCollected;
      targetValue = req.count;
      break;

    case "total_crashes":
      currentValue = stats.totalCrashes;
      targetValue = req.count;
      break;

    case "total_playtime":
      currentValue = stats.totalPlayTime / (1000 * 60 * 60); // Convert ms to hours
      targetValue = req.hours;
      break;

    case "course_complete":
      currentValue = stats.coursesCompleted.includes(req.courseId) ? 1 : 0;
      targetValue = 1;
      break;

    case "all_courses_complete":
      currentValue = stats.coursesCompleted.length;
      targetValue = 4; // All 4 courses
      break;

    case "perfect_course":
      currentValue = stats.perfectCourses.includes(req.courseId) ? 1 : 0;
      targetValue = 1;
      break;

    case "perfect_all_courses":
      currentValue = stats.perfectCourses.length;
      targetValue = 4;
      break;

    case "star_rating":
      const courseStars = stats.courseStars[req.courseId] ?? 0;
      currentValue = courseStars >= 3 ? 1 : 0;
      targetValue = 1;
      break;

    case "all_three_stars":
      currentValue = Object.values(stats.courseStars).filter(
        (s) => s >= 3,
      ).length;
      targetValue = 4;
      break;

    case "speed_run":
      const courseBestTime = stats.courseBestTimes[req.courseId] ?? Infinity;
      currentValue = courseBestTime <= req.maxTimeMs ? 1 : 0;
      targetValue = 1;
      break;

    case "speed_run_any":
      const anyFastTime = Object.values(stats.courseBestTimes).some(
        (t) => t <= req.maxTimeMs,
      );
      currentValue = anyFastTime ? 1 : 0;
      targetValue = 1;
      break;

    case "air_time":
      currentValue = stats.longestAirTime;
      targetValue = req.seconds;
      break;

    case "narrow_escape":
      currentValue = stats.narrowestEscape;
      targetValue = req.pixels;
      break;

    case "collect_all_bananas":
      const courseCollected = stats.courseBananasCollected[req.courseId] ?? 0;
      const courseTotal = stats.courseBananasTotals[req.courseId] ?? 1;
      currentValue = courseCollected >= courseTotal ? 1 : 0;
      targetValue = 1;
      break;

    case "skip_bananas":
      const collected = stats.courseBananasCollected[req.courseId] ?? 0;
      const total = stats.courseBananasTotals[req.courseId] ?? 0;
      const skipped = total - collected;
      currentValue = skipped >= req.minSkipped ? 1 : 0;
      targetValue = 1;
      break;

    default:
      // For custom checks, assume not complete
      currentValue = 0;
      targetValue = 1;
  }

  const percentComplete = Math.min(100, (currentValue / targetValue) * 100);

  return {
    stampId: stamp.id,
    currentValue,
    targetValue,
    percentComplete,
    isComplete: currentValue >= targetValue,
  };
}

// ============================================
// Course Stats Interface (for stamp checking)
// ============================================

export interface CourseStats {
  // Completion tracking
  coursesCompleted: string[];
  perfectCourses: string[]; // Courses completed with no lives lost
  courseStars: Record<string, number>; // 1-3 stars per course
  courseBestTimes: Record<string, number>; // Best time in ms per course
  courseBestScores: Record<string, number>; // Best score per course

  // Collection tracking
  totalBananasCollected: number;
  totalCoinsCollected: number;
  courseBananasCollected: Record<string, number>; // Per course
  courseBananasTotals: Record<string, number>; // Total bananas per course

  // Gameplay stats
  totalCrashes: number;
  totalPlayTime: number; // In milliseconds
  longestAirTime: number; // In seconds
  narrowestEscape: number; // In pixels (smaller = closer call)
  mechanismsUsed: Record<string, boolean>; // Track if mechanisms were used per course

  // Achievement tracking
  earnedStamps: string[]; // IDs of earned stamps
}

/**
 * Create initial empty stats
 */
export function createInitialCourseStats(): CourseStats {
  return {
    coursesCompleted: [],
    perfectCourses: [],
    courseStars: {},
    courseBestTimes: {},
    courseBestScores: {},
    totalBananasCollected: 0,
    totalCoinsCollected: 0,
    courseBananasCollected: {},
    courseBananasTotals: {},
    totalCrashes: 0,
    totalPlayTime: 0,
    longestAirTime: 0,
    narrowestEscape: Infinity,
    mechanismsUsed: {},
    earnedStamps: [],
  };
}

/**
 * Check all stamps and return newly earned ones
 */
export function checkStampsForProgress(
  stats: CourseStats,
  previousStamps: string[],
): string[] {
  const newlyEarned: string[] = [];

  for (const stamp of CART_COURSE_STAMPS) {
    // Skip already earned
    if (previousStamps.includes(stamp.id)) {
      continue;
    }

    const progress = calculateStampProgress(stamp, stats);
    if (progress.isComplete) {
      newlyEarned.push(stamp.id);
    }
  }

  return newlyEarned;
}

/**
 * Get next stamps to work toward (not yet earned, with progress)
 */
export function getNextStampsToEarn(
  stats: CourseStats,
  limit: number = 5,
): Array<{ stamp: StampDefinition; progress: StampProgress }> {
  const unearned = CART_COURSE_STAMPS.filter(
    (s) => !s.secret && !stats.earnedStamps.includes(s.id),
  );

  const withProgress = unearned.map((stamp) => ({
    stamp,
    progress: calculateStampProgress(stamp, stats),
  }));

  // Sort by progress (highest first), then by rarity (rarer first for tie-breakers)
  const rarityOrder: StampRarity[] = [
    "legendary",
    "epic",
    "rare",
    "uncommon",
    "common",
  ];

  return withProgress
    .sort((a, b) => {
      // First by progress
      if (b.progress.percentComplete !== a.progress.percentComplete) {
        return b.progress.percentComplete - a.progress.percentComplete;
      }
      // Then by rarity
      return (
        rarityOrder.indexOf(a.stamp.rarity) -
        rarityOrder.indexOf(b.stamp.rarity)
      );
    })
    .slice(0, limit);
}
