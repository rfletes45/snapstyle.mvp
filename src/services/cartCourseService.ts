/**
 * Cart Course Service
 *
 * Firebase integration for Cart Course game:
 * - Progress persistence
 * - Leaderboards
 * - Stats tracking
 * - Stamp/achievement syncing
 */

import {
  CourseStats,
  StampDefinition,
  checkStampsForProgress,
  createInitialCourseStats,
  getStampById,
} from "@/components/games/CartCourse/data/stamps";
import {
  Unlockable,
  checkNewUnlocks,
  createInitialUnlocks,
  updateUnlocks,
} from "@/components/games/CartCourse/data/unlockables";
import type { AvatarConfig } from "@/types/models";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

// ============================================
// Types
// ============================================

export interface CartCourseProgress {
  // Course completion status
  courses: {
    [courseId: string]: CourseProgress;
  };

  // Unlocks (derived from stats, but cached for quick access)
  unlockedCourses: string[];
  unlockedSkins: string[];
  unlockedModes: string[];

  // Selected customization
  selectedSkin: string;
  selectedMode: string;

  // Stamps/achievements
  stamps: string[];

  // Aggregate statistics
  stats: CourseStats;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastPlayedAt: number;
}

export interface CourseProgress {
  completed: boolean;
  bestTime: number; // Milliseconds
  bestScore: number;
  bananasCollected: number;
  totalBananas: number;
  coinsCollected: number;
  totalCoins: number;
  starRating: 1 | 2 | 3;
  attempts: number;
  perfectRuns: number; // Times completed without losing a life
  firstCompletedAt?: number;
  lastPlayedAt: number;
}

export interface LeaderboardEntry {
  rank?: number;
  userId: string;
  displayName: string;
  avatarConfig?: AvatarConfig;
  score: number;
  time: number;
  bananasCollected: number;
  stars: number;
  courseId: string;
  timestamp: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  courseId: string;
  weekKey: string;
  userRank?: number;
  userEntry?: LeaderboardEntry;
}

export interface GameSessionResult {
  courseId: string;
  modeId: string;
  completed: boolean;
  score: number;
  time: number; // Milliseconds
  bananasCollected: number;
  totalBananas: number;
  coinsCollected: number;
  livesLost: number;
  crashes: number;
  longestAirTime: number;
  narrowestEscape: number;
  mechanismsUsed: boolean;
  stars: number;
  isPerfect: boolean;
}

// ============================================
// Constants
// ============================================

const COLLECTION_CART_COURSE_PROGRESS = "CartCourseProgress";
const COLLECTION_CART_COURSE_LEADERBOARDS = "CartCourseLeaderboards";
const MAX_LEADERBOARD_ENTRIES = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory cache
const progressCache = new Map<
  string,
  { data: CartCourseProgress; timestamp: number }
>();
const leaderboardCache = new Map<
  string,
  { data: LeaderboardResult; timestamp: number }
>();

// ============================================
// Progress Management
// ============================================

/**
 * Get user's Cart Course progress from Firebase
 */
export async function getCartCourseProgress(
  userId: string,
): Promise<CartCourseProgress> {
  // Check cache first
  const cached = progressCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const db = getFirestoreInstance();
  const docRef = doc(db, COLLECTION_CART_COURSE_PROGRESS, userId);

  try {
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as CartCourseProgress;
      progressCache.set(userId, { data, timestamp: Date.now() });
      return data;
    }

    // Create initial progress if doesn't exist
    const initialProgress = createInitialProgress();
    await setDoc(docRef, initialProgress);
    progressCache.set(userId, { data: initialProgress, timestamp: Date.now() });
    return initialProgress;
  } catch (error) {
    console.error("[CartCourseService] Failed to get progress:", error);
    return createInitialProgress();
  }
}

/**
 * Create initial progress object
 */
export function createInitialProgress(): CartCourseProgress {
  const now = Date.now();
  const stats = createInitialCourseStats();
  const unlocks = createInitialUnlocks();

  return {
    courses: {},
    unlockedCourses: unlocks.unlockedCourses,
    unlockedSkins: unlocks.unlockedSkins,
    unlockedModes: unlocks.unlockedModes,
    selectedSkin: unlocks.selectedSkin,
    selectedMode: unlocks.selectedMode,
    stamps: [],
    stats,
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: now,
  };
}

/**
 * Save game session results and update progress
 */
export async function saveGameSession(
  userId: string,
  displayName: string,
  result: GameSessionResult,
  avatarConfig?: AvatarConfig,
): Promise<{
  progress: CartCourseProgress;
  newStamps: StampDefinition[];
  newUnlocks: Unlockable[];
}> {
  const db = getFirestoreInstance();
  const docRef = doc(db, COLLECTION_CART_COURSE_PROGRESS, userId);

  try {
    // Get current progress
    const currentProgress = await getCartCourseProgress(userId);
    const previousStamps = [...currentProgress.stamps];
    const previousUnlockIds = [
      ...currentProgress.unlockedCourses,
      ...currentProgress.unlockedSkins,
      ...currentProgress.unlockedModes,
    ];

    // Update course progress
    const courseProgress = updateCourseProgress(
      currentProgress.courses[result.courseId],
      result,
    );

    // Update aggregate stats
    const updatedStats = updateStats(currentProgress.stats, result);

    // Check for new stamps
    const newStampIds = checkStampsForProgress(updatedStats, previousStamps);
    const allStamps = [...previousStamps, ...newStampIds];

    // Update stats with new stamps
    updatedStats.earnedStamps = allStamps;

    // Check for new unlocks
    const newlyUnlockedItems = checkNewUnlocks(previousUnlockIds, updatedStats);
    const updatedUnlocks = updateUnlocks(
      {
        unlockedCourses: currentProgress.unlockedCourses,
        unlockedSkins: currentProgress.unlockedSkins,
        unlockedModes: currentProgress.unlockedModes,
        selectedSkin: currentProgress.selectedSkin,
        selectedMode: currentProgress.selectedMode,
      },
      updatedStats,
    );

    // Build updated progress
    const now = Date.now();
    const updatedProgress: CartCourseProgress = {
      ...currentProgress,
      courses: {
        ...currentProgress.courses,
        [result.courseId]: courseProgress,
      },
      stamps: allStamps,
      stats: updatedStats,
      unlockedCourses: updatedUnlocks.unlockedCourses,
      unlockedSkins: updatedUnlocks.unlockedSkins,
      unlockedModes: updatedUnlocks.unlockedModes,
      updatedAt: now,
      lastPlayedAt: now,
    };

    // Save to Firebase
    await setDoc(docRef, updatedProgress);

    // Update cache
    progressCache.set(userId, { data: updatedProgress, timestamp: Date.now() });

    // Submit to leaderboard if completed
    if (result.completed) {
      await submitToLeaderboard(userId, displayName, result, avatarConfig);
    }

    // Get full stamp definitions for newly earned stamps
    const newStamps = newStampIds
      .map((id) => getStampById(id))
      .filter((s): s is StampDefinition => s !== undefined);

    return {
      progress: updatedProgress,
      newStamps,
      newUnlocks: newlyUnlockedItems,
    };
  } catch (error) {
    console.error("[CartCourseService] Failed to save game session:", error);
    throw error;
  }
}

/**
 * Update course progress with new session result
 */
function updateCourseProgress(
  existing: CourseProgress | undefined,
  result: GameSessionResult,
): CourseProgress {
  const now = Date.now();

  if (!existing) {
    // First time playing this course
    return {
      completed: result.completed,
      bestTime: result.completed ? result.time : Infinity,
      bestScore: result.score,
      bananasCollected: result.bananasCollected,
      totalBananas: result.totalBananas,
      coinsCollected: result.coinsCollected,
      totalCoins: 0, // Will be set from course data
      starRating: result.stars as 1 | 2 | 3,
      attempts: 1,
      perfectRuns: result.isPerfect ? 1 : 0,
      firstCompletedAt: result.completed ? now : undefined,
      lastPlayedAt: now,
    };
  }

  return {
    ...existing,
    completed: existing.completed || result.completed,
    bestTime: result.completed
      ? Math.min(existing.bestTime, result.time)
      : existing.bestTime,
    bestScore: Math.max(existing.bestScore, result.score),
    bananasCollected: Math.max(
      existing.bananasCollected,
      result.bananasCollected,
    ),
    starRating: Math.max(existing.starRating, result.stars) as 1 | 2 | 3,
    attempts: existing.attempts + 1,
    perfectRuns: existing.perfectRuns + (result.isPerfect ? 1 : 0),
    firstCompletedAt:
      existing.firstCompletedAt ?? (result.completed ? now : undefined),
    lastPlayedAt: now,
  };
}

/**
 * Update aggregate stats with new session result
 */
function updateStats(
  existing: CourseStats,
  result: GameSessionResult,
): CourseStats {
  const updated: CourseStats = {
    ...existing,
    totalBananasCollected:
      existing.totalBananasCollected + result.bananasCollected,
    totalCoinsCollected: existing.totalCoinsCollected + result.coinsCollected,
    totalCrashes: existing.totalCrashes + result.crashes,
    totalPlayTime: existing.totalPlayTime + result.time,
    longestAirTime: Math.max(existing.longestAirTime, result.longestAirTime),
    narrowestEscape: Math.min(existing.narrowestEscape, result.narrowestEscape),
  };

  // Update course-specific banana tracking
  updated.courseBananasCollected = {
    ...existing.courseBananasCollected,
    [result.courseId]: Math.max(
      existing.courseBananasCollected[result.courseId] ?? 0,
      result.bananasCollected,
    ),
  };

  updated.courseBananasTotals = {
    ...existing.courseBananasTotals,
    [result.courseId]: result.totalBananas,
  };

  // Update completion tracking
  if (
    result.completed &&
    !existing.coursesCompleted.includes(result.courseId)
  ) {
    updated.coursesCompleted = [...existing.coursesCompleted, result.courseId];
  }

  if (result.isPerfect && !existing.perfectCourses.includes(result.courseId)) {
    updated.perfectCourses = [...existing.perfectCourses, result.courseId];
  }

  // Update best times and scores
  const existingBestTime =
    existing.courseBestTimes[result.courseId] ?? Infinity;
  if (result.completed && result.time < existingBestTime) {
    updated.courseBestTimes = {
      ...existing.courseBestTimes,
      [result.courseId]: result.time,
    };
  }

  const existingBestScore = existing.courseBestScores[result.courseId] ?? 0;
  if (result.score > existingBestScore) {
    updated.courseBestScores = {
      ...existing.courseBestScores,
      [result.courseId]: result.score,
    };
  }

  // Update star ratings
  const existingStars = existing.courseStars[result.courseId] ?? 0;
  if (result.stars > existingStars) {
    updated.courseStars = {
      ...existing.courseStars,
      [result.courseId]: result.stars,
    };
  }

  // Track mechanism usage
  updated.mechanismsUsed = {
    ...existing.mechanismsUsed,
    [result.courseId]: result.mechanismsUsed,
  };

  return updated;
}

/**
 * Update selected cart skin
 */
export async function setSelectedSkin(
  userId: string,
  skinId: string,
): Promise<void> {
  const db = getFirestoreInstance();
  const docRef = doc(db, COLLECTION_CART_COURSE_PROGRESS, userId);

  try {
    await updateDoc(docRef, {
      selectedSkin: skinId,
      updatedAt: Date.now(),
    });

    // Update cache
    const cached = progressCache.get(userId);
    if (cached) {
      cached.data.selectedSkin = skinId;
      cached.data.updatedAt = Date.now();
    }
  } catch (error) {
    console.error("[CartCourseService] Failed to set skin:", error);
    throw error;
  }
}

/**
 * Update selected game mode
 */
export async function setSelectedMode(
  userId: string,
  modeId: string,
): Promise<void> {
  const db = getFirestoreInstance();
  const docRef = doc(db, COLLECTION_CART_COURSE_PROGRESS, userId);

  try {
    await updateDoc(docRef, {
      selectedMode: modeId,
      updatedAt: Date.now(),
    });

    // Update cache
    const cached = progressCache.get(userId);
    if (cached) {
      cached.data.selectedMode = modeId;
      cached.data.updatedAt = Date.now();
    }
  } catch (error) {
    console.error("[CartCourseService] Failed to set mode:", error);
    throw error;
  }
}

// ============================================
// Leaderboard Management
// ============================================

/**
 * Get current week key for leaderboards
 */
function getCurrentWeekKeyLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
  );
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${week.toString().padStart(2, "0")}`;
}

/**
 * Get leaderboard path
 */
function getLeaderboardPath(courseId: string, weekKey: string): string {
  return `${COLLECTION_CART_COURSE_LEADERBOARDS}/${courseId}_${weekKey}`;
}

/**
 * Submit score to leaderboard
 */
async function submitToLeaderboard(
  userId: string,
  displayName: string,
  result: GameSessionResult,
  avatarConfig?: AvatarConfig,
): Promise<void> {
  if (!result.completed) return;

  const db = getFirestoreInstance();
  const weekKey = getCurrentWeekKeyLocal();
  const leaderboardPath = getLeaderboardPath(result.courseId, weekKey);

  const entry: LeaderboardEntry = {
    userId,
    displayName,
    avatarConfig,
    score: result.score,
    time: result.time,
    bananasCollected: result.bananasCollected,
    stars: result.stars,
    courseId: result.courseId,
    timestamp: Date.now(),
  };

  try {
    const entryRef = doc(db, leaderboardPath, "Entries", userId);
    const existingDoc = await getDoc(entryRef);

    if (existingDoc.exists()) {
      const existingEntry = existingDoc.data() as LeaderboardEntry;
      // Only update if new score is better
      if (result.score > existingEntry.score) {
        await setDoc(entryRef, entry);
      }
    } else {
      await setDoc(entryRef, entry);
    }

    // Invalidate leaderboard cache
    leaderboardCache.delete(`${result.courseId}_${weekKey}`);
  } catch (error) {
    console.error(
      "[CartCourseService] Failed to submit to leaderboard:",
      error,
    );
    // Don't throw - leaderboard submission is non-critical
  }
}

/**
 * Get weekly leaderboard for a course
 */
export async function getWeeklyLeaderboard(
  courseId: string,
  userId?: string,
  weekKey?: string,
): Promise<LeaderboardResult> {
  const week = weekKey ?? getCurrentWeekKeyLocal();
  const cacheKey = `${courseId}_${week}`;

  // Check cache
  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Recalculate user rank if userId provided
    if (userId && cached.data.entries.length > 0) {
      const userIndex = cached.data.entries.findIndex(
        (e) => e.userId === userId,
      );
      if (userIndex >= 0) {
        cached.data.userRank = userIndex + 1;
        cached.data.userEntry = cached.data.entries[userIndex];
      }
    }
    return cached.data;
  }

  const db = getFirestoreInstance();
  const leaderboardPath = getLeaderboardPath(courseId, week);

  try {
    const entriesRef = collection(db, leaderboardPath, "Entries");
    const q = query(
      entriesRef,
      orderBy("score", "desc"),
      limit(MAX_LEADERBOARD_ENTRIES),
    );

    const snapshot = await getDocs(q);
    const entries: LeaderboardEntry[] = snapshot.docs.map((docSnap, index) => ({
      ...(docSnap.data() as LeaderboardEntry),
      rank: index + 1,
    }));

    const result: LeaderboardResult = {
      entries,
      courseId,
      weekKey: week,
    };

    // Find user's rank if provided
    if (userId) {
      const userIndex = entries.findIndex((e) => e.userId === userId);
      if (userIndex >= 0) {
        result.userRank = userIndex + 1;
        result.userEntry = entries[userIndex];
      }
    }

    // Cache the result
    leaderboardCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error("[CartCourseService] Failed to get leaderboard:", error);
    return {
      entries: [],
      courseId,
      weekKey: week,
    };
  }
}

/**
 * Get friends leaderboard for a course
 */
export async function getFriendsLeaderboard(
  courseId: string,
  userId: string,
  friendIds: string[],
  weekKey?: string,
): Promise<LeaderboardResult> {
  const week = weekKey ?? getCurrentWeekKeyLocal();
  const db = getFirestoreInstance();
  const leaderboardPath = getLeaderboardPath(courseId, week);

  try {
    // Include user in the list
    const allUserIds = [...new Set([userId, ...friendIds])];

    // Firebase 'in' queries limited to 30 items
    const chunks: string[][] = [];
    for (let i = 0; i < allUserIds.length; i += 30) {
      chunks.push(allUserIds.slice(i, i + 30));
    }

    const allEntries: LeaderboardEntry[] = [];

    for (const chunk of chunks) {
      const entriesRef = collection(db, leaderboardPath, "Entries");
      const q = query(entriesRef, where("userId", "in", chunk));
      const snapshot = await getDocs(q);

      snapshot.docs.forEach((docSnap) => {
        allEntries.push(docSnap.data() as LeaderboardEntry);
      });
    }

    // Sort by score and add ranks
    allEntries.sort((a, b) => b.score - a.score);
    const rankedEntries = allEntries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    const result: LeaderboardResult = {
      entries: rankedEntries,
      courseId,
      weekKey: week,
    };

    // Find user's rank
    const userIndex = rankedEntries.findIndex((e) => e.userId === userId);
    if (userIndex >= 0) {
      result.userRank = userIndex + 1;
      result.userEntry = rankedEntries[userIndex];
    }

    return result;
  } catch (error) {
    console.error(
      "[CartCourseService] Failed to get friends leaderboard:",
      error,
    );
    return {
      entries: [],
      courseId,
      weekKey: week,
    };
  }
}

/**
 * Get all-time best scores for a course
 */
export async function getAllTimeBest(
  courseId: string,
  limitCount: number = 10,
): Promise<LeaderboardEntry[]> {
  // For all-time, we'd need a separate collection
  // For now, return empty - this would be implemented with a scheduled function
  // that aggregates weekly leaderboards
  console.warn("[CartCourseService] All-time leaderboard not yet implemented");
  return [];
}

// ============================================
// Cache Management
// ============================================

/**
 * Clear all caches
 */
export function clearCartCourseCache(): void {
  progressCache.clear();
  leaderboardCache.clear();
}

/**
 * Clear cache for a specific user
 */
export function clearUserCache(userId: string): void {
  progressCache.delete(userId);
}

// ============================================
// Stats Helpers
// ============================================

/**
 * Get formatted stats for display
 */
export function getFormattedStats(progress: CartCourseProgress): {
  totalPlayTime: string;
  coursesCompleted: number;
  totalStamps: number;
  totalBananas: number;
  totalCoins: number;
  perfectRuns: number;
  bestCourse: { courseId: string; score: number } | null;
} {
  const { stats, courses } = progress;

  // Format play time
  const totalMs = stats.totalPlayTime;
  const hours = Math.floor(totalMs / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  const totalPlayTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Count perfect runs across all courses
  const perfectRuns = Object.values(courses).reduce(
    (sum, c) => sum + c.perfectRuns,
    0,
  );

  // Find best course by score
  let bestCourse: { courseId: string; score: number } | null = null;
  for (const [courseId, courseProgress] of Object.entries(courses)) {
    if (!bestCourse || courseProgress.bestScore > bestCourse.score) {
      bestCourse = { courseId, score: courseProgress.bestScore };
    }
  }

  return {
    totalPlayTime,
    coursesCompleted: stats.coursesCompleted.length,
    totalStamps: stats.earnedStamps.length,
    totalBananas: stats.totalBananasCollected,
    totalCoins: stats.totalCoinsCollected,
    perfectRuns,
    bestCourse,
  };
}
