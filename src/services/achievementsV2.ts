/**
 * Achievements V2 — Client-Side Service
 *
 * Reads achievement data from the v2 Firestore subcollections:
 *   /users/{uid}/achievements/{achievementId}
 *   /users/{uid}/achievementSummary/summary
 *   /users/{uid}/statsPerGame/{gameType}
 *
 * Does NOT evaluate or write achievements — that's server-authoritative.
 * This service is read-only for the client.
 *
 * @module services/achievementsV2
 */

import {
  ACHIEVEMENTS_BY_ID,
  getActiveAchievements,
  getSectionsForCategory,
} from "@/config/achievementsCatalog";
import type {
  AchievementSectionWithProgress,
  AchievementSummaryDoc,
  AchievementV2Category,
  AchievementV2Tier,
  UserAchievementDoc,
} from "@/types/achievementsV2";
import type { ExtendedGameType } from "@/types/games";
import { createLogger } from "@/utils/log";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  type Unsubscribe,
} from "firebase/firestore";

const logger = createLogger("services/achievementsV2");

// =============================================================================
// Read Functions
// =============================================================================

/**
 * Fetch all v2 achievement docs for a user.
 * Returns a Map of achievementId → UserAchievementDoc.
 */
export async function getV2AchievementDocs(
  userId: string,
): Promise<Map<string, UserAchievementDoc>> {
  const db = getFirestore();
  const colRef = collection(db, "users", userId, "achievements");
  const snap = await getDocs(query(colRef));

  const result = new Map<string, UserAchievementDoc>();
  snap.forEach((d) => {
    result.set(d.id, d.data() as UserAchievementDoc);
  });
  return result;
}

/**
 * Fetch the achievement summary doc for a user.
 */
export async function getV2AchievementSummary(
  userId: string,
): Promise<AchievementSummaryDoc | null> {
  const db = getFirestore();
  const ref = doc(db, "users", userId, "achievementSummary", "summary");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as AchievementSummaryDoc) : null;
}

/**
 * Subscribe to all v2 achievement docs for a user.
 * Callback receives the full Map on every change.
 */
export function subscribeToV2Achievements(
  userId: string,
  onData: (docs: Map<string, UserAchievementDoc>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const db = getFirestore();
  const colRef = collection(db, "users", userId, "achievements");

  return onSnapshot(
    query(colRef),
    (snap) => {
      const result = new Map<string, UserAchievementDoc>();
      snap.forEach((d) => {
        result.set(d.id, d.data() as UserAchievementDoc);
      });
      onData(result);
    },
    (error) => {
      logger.error("[subscribeToV2Achievements] Error:", error);
      onError?.(error);
    },
  );
}

/**
 * Subscribe to the achievement summary doc.
 */
export function subscribeToV2Summary(
  userId: string,
  onData: (summary: AchievementSummaryDoc | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const db = getFirestore();
  const ref = doc(db, "users", userId, "achievementSummary", "summary");

  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? (snap.data() as AchievementSummaryDoc) : null);
    },
    (error) => {
      logger.error("[subscribeToV2Summary] Error:", error);
      onError?.(error);
    },
  );
}

// =============================================================================
// Derived / Helper Functions
// =============================================================================

export interface V2AchievementDisplayItem {
  /** Achievement ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Icon / emoji */
  icon: string;
  /** Category */
  category: string;
  /** Tier */
  tier: AchievementV2Tier;
  /** Game type (if game-specific) */
  gameType?: ExtendedGameType;
  /** Current state */
  state: "locked" | "progress" | "unlocked";
  /** Current progress (0 if locked) */
  progress: number;
  /** Target to unlock */
  target: number;
  /** Progress as fraction 0..1 */
  progressPct: number;
  /** When unlocked (epoch ms), null if not */
  unlockedAt: number | null;
  /** Is secret/hidden until unlocked */
  secret: boolean;
  /** XP reward */
  xpReward: number;
  /** Coin reward */
  coinReward: number;
  /** Sort order */
  sortOrder: number;
}

/**
 * Build display items by merging catalog definitions with user docs.
 * Items without user docs are shown as "locked" with 0 progress.
 */
export function buildV2DisplayItems(
  userDocs: Map<string, UserAchievementDoc>,
  options?: {
    /** Filter to a specific game type */
    gameType?: ExtendedGameType;
    /** Filter to a specific category */
    category?: string;
    /** Include secret achievements even if locked */
    showSecrets?: boolean;
  },
): V2AchievementDisplayItem[] {
  const catalog = getActiveAchievements();
  const items: V2AchievementDisplayItem[] = [];

  for (const def of catalog) {
    // Apply filters
    if (
      options?.gameType &&
      def.gameType &&
      def.gameType !== options.gameType
    ) {
      continue;
    }
    if (options?.category && def.category !== options.category) {
      continue;
    }

    const userDoc = userDocs.get(def.id);
    const state = userDoc?.state ?? "locked";
    const progress = userDoc?.progress ?? 0;

    // Hide secrets that aren't yet in-progress/unlocked
    if (def.secret && state === "locked" && !options?.showSecrets) {
      continue;
    }

    items.push({
      id: def.id,
      name: def.name,
      description: state === "locked" && def.secret ? "???" : def.description,
      icon: def.icon,
      category: def.category,
      tier: def.tier,
      gameType: def.gameType,
      state,
      progress,
      target: def.target,
      progressPct: def.target > 0 ? Math.min(progress / def.target, 1) : 0,
      unlockedAt: userDoc?.unlockedAt ?? null,
      secret: def.secret ?? false,
      xpReward: def.xpReward,
      coinReward: def.coinReward,
      sortOrder: def.sortOrder ?? 999,
    });
  }

  // Sort: unlocked first (newest), then in-progress (highest %), then locked (catalog order)
  items.sort((a, b) => {
    const stateOrder = { unlocked: 0, progress: 1, locked: 2 };
    const aDiff = stateOrder[a.state] - stateOrder[b.state];
    if (aDiff !== 0) return aDiff;

    if (a.state === "unlocked" && b.state === "unlocked") {
      return (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0);
    }
    if (a.state === "progress" && b.state === "progress") {
      return b.progressPct - a.progressPct;
    }
    return a.sortOrder - b.sortOrder;
  });

  return items;
}

/**
 * Get unlocked achievement IDs from user docs.
 */
export function getUnlockedIds(
  userDocs: Map<string, UserAchievementDoc>,
): Set<string> {
  const ids = new Set<string>();
  for (const [id, doc] of userDocs) {
    if (doc.state === "unlocked") {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * Check if a specific achievement is unlocked.
 */
export function isAchievementUnlocked(
  userDocs: Map<string, UserAchievementDoc>,
  achievementId: string,
): boolean {
  return userDocs.get(achievementId)?.state === "unlocked";
}

/**
 * Get summary statistics from user docs.
 */
export function computeLocalSummary(
  userDocs: Map<string, UserAchievementDoc>,
): {
  totalUnlocked: number;
  totalAvailable: number;
  unlockedByTier: Record<AchievementV2Tier, number>;
  totalXpEarned: number;
  totalCoinsEarned: number;
} {
  const tiers: Record<AchievementV2Tier, number> = {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
    diamond: 0,
  };
  let totalXp = 0;
  let totalCoins = 0;
  let totalUnlocked = 0;

  for (const [id, uDoc] of userDocs) {
    if (uDoc.state === "unlocked") {
      totalUnlocked++;
      const def = ACHIEVEMENTS_BY_ID.get(id);
      if (def) {
        tiers[def.tier]++;
        totalXp += def.xpReward;
        totalCoins += def.coinReward;
      }
    }
  }

  return {
    totalUnlocked,
    totalAvailable: getActiveAchievements().length,
    unlockedByTier: tiers,
    totalXpEarned: totalXp,
    totalCoinsEarned: totalCoins,
  };
}

// =============================================================================
// Section Grouping
// =============================================================================

/**
 * Build collapsible sections with progress for a given category.
 *
 * Each section groups achievements by game type (or "general" for
 * achievements without a specific game). Sections include completion
 * counts and badge eligibility.
 *
 * Items within each section are sorted: in-progress first, then
 * unlocked (newest), then locked (catalog order).
 */
export function buildSectionsWithProgress(
  displayItems: V2AchievementDisplayItem[],
  category: AchievementV2Category,
): AchievementSectionWithProgress[] {
  const sections = getSectionsForCategory(category);
  if (sections.length === 0) return [];

  // Bucket items into sections
  const buckets = new Map<string, V2AchievementDisplayItem[]>();
  for (const section of sections) {
    buckets.set(section.id, []);
  }

  for (const item of displayItems) {
    // Find matching section by gameType
    let sectionId: string | undefined;

    if (item.gameType) {
      const match = sections.find((s) => s.gameType === item.gameType);
      if (match) sectionId = match.id;
    }

    // Fall back to general section (no gameType)
    if (!sectionId) {
      const general = sections.find((s) => !s.gameType);
      if (general) sectionId = general.id;
    }

    if (sectionId && buckets.has(sectionId)) {
      buckets.get(sectionId)!.push(item);
    }
  }

  // Build result
  const result: AchievementSectionWithProgress[] = [];

  for (const section of sections) {
    const items = buckets.get(section.id) ?? [];
    if (items.length === 0) continue; // Skip empty sections (game not available)

    const unlockedCount = items.filter((i) => i.state === "unlocked").length;
    const totalCount = items.length;

    result.push({
      section,
      items,
      unlockedCount,
      totalCount,
      completionPct: totalCount > 0 ? unlockedCount / totalCount : 0,
      isComplete: unlockedCount === totalCount && totalCount > 0,
    });
  }

  return result;
}
