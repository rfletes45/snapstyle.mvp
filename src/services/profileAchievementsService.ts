/**
 * Profile Achievements Service
 *
 * Clean read/write layer that bridges the Games V4 achievement system
 * and the profile trophy-case feature.
 *
 * Responsibilities:
 * - Fetch / subscribe to all unlocked achievements for any user
 * - Normalize achievement data for profile rendering
 * - Read & write featured achievement selections
 * - Validate featured IDs against owned set
 *
 * Achievement source of truth: `Users/{uid}/Achievements` subcollection
 * (same collection used by gamesV4/services/gameServiceV4.ts).
 *
 * @module services/profileAchievementsService
 */

import {
  ACHIEVEMENT_BY_TYPE,
  ACHIEVEMENT_SECTIONS,
  DIFFICULTY_META,
  type AchievementDef,
  type AchievementDifficulty,
} from "@/gamesV4/data/achievementDefinitions";
import { getFirestoreInstance } from "@/services/firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

// =============================================================================
// Types
// =============================================================================

/** Normalized achievement for profile rendering. */
export interface ProfileAchievement {
  /** Achievement type identifier (matches AchievementDef.type) */
  id: string;
  /** Human-readable title */
  title: string;
  /** Description text */
  description: string;
  /** Difficulty tier */
  difficulty: AchievementDifficulty;
  /** Difficulty color */
  color: string;
  /** Difficulty icon name (MaterialCommunityIcons) */
  icon: string;
  /** Originating game/section label */
  category: string;
  /** Section ID from achievement definitions */
  sectionId: string;
  /** When the achievement was earned (epoch ms, or null if unknown) */
  unlockedAt: number | null;
  /** Whether this achievement is currently featured on profile */
  isFeatured: boolean;
}

/** Max number of achievements that can be featured on a profile. */
export const MAX_FEATURED_ACHIEVEMENTS = 2;

// =============================================================================
// Read helpers
// =============================================================================

/**
 * Subscribe to a user's unlocked achievements (live updates).
 * Works for any user, not just the current authenticated user.
 */
export function subscribeToUserAchievements(
  userId: string,
  onData: (achievements: ProfileAchievement[], rawTypes: string[]) => void,
  featuredIds: string[] = [],
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const ref = collection(db, "Users", userId, "Achievements");
  const q = query(ref, orderBy("earnedAt", "desc"));

  const featuredSet = new Set(featuredIds);

  return onSnapshot(
    q,
    (snap) => {
      const rawTypes: string[] = [];
      const achievements: ProfileAchievement[] = snap.docs.map((d) => {
        const data = d.data();
        const type: string = data.type ?? d.id;
        rawTypes.push(type);
        return normalizeAchievement(type, data, featuredSet);
      });
      onData(achievements, rawTypes);
    },
    onError,
  );
}

/**
 * Normalize a raw achievement entry into the profile-rendering shape.
 */
function normalizeAchievement(
  type: string,
  raw: Record<string, unknown>,
  featuredSet: Set<string>,
): ProfileAchievement {
  const def: AchievementDef | undefined = ACHIEVEMENT_BY_TYPE[type];
  const difficulty: AchievementDifficulty =
    (def?.difficulty as AchievementDifficulty) ?? "easy";
  const meta = DIFFICULTY_META[difficulty] ?? DIFFICULTY_META.easy;

  // Resolve category label from section definitions
  const sectionId = def?.sectionId ?? (raw.sectionId as string) ?? "milestones";
  let category = sectionId;
  const sec = ACHIEVEMENT_SECTIONS.find((s) => s.sectionId === sectionId);
  if (sec) category = sec.name;

  // Parse earnedAt
  let unlockedAt: number | null = null;
  if (raw.earnedAt) {
    if (typeof raw.earnedAt === "number") {
      unlockedAt = raw.earnedAt;
    } else if (
      typeof raw.earnedAt === "object" &&
      raw.earnedAt !== null &&
      "toMillis" in (raw.earnedAt as Record<string, unknown>)
    ) {
      unlockedAt = (raw.earnedAt as { toMillis: () => number }).toMillis();
    }
  }

  return {
    id: type,
    title: def?.name ?? (raw.name as string) ?? type,
    description: def?.description ?? (raw.description as string) ?? "",
    difficulty,
    color: meta.color,
    icon: meta.icon,
    category,
    sectionId,
    unlockedAt,
    isFeatured: featuredSet.has(type),
  };
}

/**
 * Derive the featured achievements for display by intersecting
 * the profile's featuredAchievements.achievementIds with owned set.
 * Filters out IDs that are not actually owned.
 */
export function deriveFeaturedAchievements(
  featuredIds: string[],
  ownedTypes: string[],
): string[] {
  const ownedSet = new Set(ownedTypes);
  return (featuredIds ?? [])
    .filter((id) => ownedSet.has(id))
    .slice(0, MAX_FEATURED_ACHIEVEMENTS);
}

/**
 * Sort achievements for trophy case display.
 * Order: featured first → most recent → difficulty desc → title alpha.
 */
export function sortAchievementsForDisplay(
  achievements: ProfileAchievement[],
): ProfileAchievement[] {
  const difficultyOrder: Record<string, number> = {
    legendary: 5,
    expert: 4,
    hard: 3,
    medium: 2,
    easy: 1,
  };

  return [...achievements].sort((a, b) => {
    // Featured first
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    // Most recent unlock
    if (a.unlockedAt !== b.unlockedAt) {
      if (a.unlockedAt == null) return 1;
      if (b.unlockedAt == null) return -1;
      return b.unlockedAt - a.unlockedAt;
    }
    // Higher difficulty first
    const da = difficultyOrder[a.difficulty] ?? 0;
    const db = difficultyOrder[b.difficulty] ?? 0;
    if (da !== db) return db - da;
    // Alphabetical fallback
    return a.title.localeCompare(b.title);
  });
}

// =============================================================================
// Write helpers
// =============================================================================

/**
 * Update the featured achievements on a user's profile.
 * Validates, de-duplicates, and clamps to MAX_FEATURED_ACHIEVEMENTS.
 */
export async function updateFeaturedAchievements(
  userId: string,
  achievementIds: string[],
): Promise<void> {
  // De-duplicate and clamp
  const unique = [...new Set(achievementIds)].slice(
    0,
    MAX_FEATURED_ACHIEVEMENTS,
  );

  const db = getFirestoreInstance();
  const userRef = doc(db, "Users", userId);

  await updateDoc(userRef, {
    "featuredAchievements.achievementIds": unique,
    "featuredAchievements.updatedAt": Date.now(),
    lastProfileUpdate: Date.now(),
  });
}
