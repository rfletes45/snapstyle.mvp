/**
 * Badge Service
 *
 * Handles:
 * - Fetching user's earned badges
 * - Granting badges (via achievements or milestones)
 * - Featuring/unfeaturing badges on profile
 * - Real-time badge subscription
 *
 * @see src/types/profile.ts for Badge types
 * @see src/data/badges.ts for badge definitions
 */

import {
  BADGE_DEFINITIONS,
  getBadgeById,
  getBadgeForAchievement,
  getBadgeForMilestone,
} from "@/data/badges";
import type { Badge, UserBadge } from "@/types/profile";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/badges");
// Lazy getter for Firestore
const getDb = () => getFirestoreInstance();

// =============================================================================
// Badge Fetching
// =============================================================================

/**
 * Get all badge definitions
 */
export function getAllBadges(): Badge[] {
  return BADGE_DEFINITIONS;
}

/**
 * Get a specific badge definition
 */
export function getBadge(badgeId: string): Badge | undefined {
  return getBadgeById(badgeId);
}

/**
 * Get user's earned badges from Firestore
 */
export async function getUserBadges(uid: string): Promise<UserBadge[]> {
  const db = getDb();

  try {
    const badgesRef = collection(db, "Users", uid, "Badges");
    const q = query(badgesRef, orderBy("earnedAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        badgeId: doc.id,
        earnedAt: data.earnedAt?.toMillis?.() || data.earnedAt || Date.now(),
        featured: data.featured || false,
        displayOrder: data.displayOrder,
        earnedVia: data.earnedVia,
      } as UserBadge;
    });
  } catch (error) {
    logger.error("[badges] Error fetching user badges:", error);
    return [];
  }
}

/**
 * Get user's featured badges (for profile display)
 */
export async function getFeaturedBadges(uid: string): Promise<UserBadge[]> {
  const db = getDb();

  try {
    const badgesRef = collection(db, "Users", uid, "Badges");
    const q = query(
      badgesRef,
      where("featured", "==", true),
      orderBy("displayOrder", "asc"),
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        badgeId: doc.id,
        earnedAt: data.earnedAt?.toMillis?.() || data.earnedAt || Date.now(),
        featured: true,
        displayOrder: data.displayOrder,
        earnedVia: data.earnedVia,
      } as UserBadge;
    });
  } catch (error) {
    logger.error("[badges] Error fetching featured badges:", error);
    return [];
  }
}

/**
 * Check if user has a specific badge
 */
export async function hasBadge(uid: string, badgeId: string): Promise<boolean> {
  const db = getDb();

  try {
    const badgeRef = doc(db, "Users", uid, "Badges", badgeId);
    const badgeDoc = await getDoc(badgeRef);
    return badgeDoc.exists();
  } catch (error) {
    logger.error("[badges] Error checking badge:", error);
    return false;
  }
}

// =============================================================================
// Badge Granting
// =============================================================================

/**
 * Grant a badge to a user
 * @returns true if badge was granted, false if already owned or error
 */
export async function grantBadge(
  uid: string,
  badgeId: string,
  earnedVia?: UserBadge["earnedVia"],
): Promise<boolean> {
  const db = getDb();

  try {
    // Verify badge exists in definitions
    const badge = getBadgeById(badgeId);
    if (!badge) {
      logger.error("[badges] Badge not found in definitions:", badgeId);
      return false;
    }

    // Check if already earned
    const alreadyHas = await hasBadge(uid, badgeId);
    if (alreadyHas) {
      logger.info("[badges] User already has badge:", badgeId);
      return false;
    }

    // Grant the badge
    const badgeRef = doc(db, "Users", uid, "Badges", badgeId);
    await setDoc(badgeRef, {
      badgeId,
      earnedAt: serverTimestamp(),
      featured: false,
      earnedVia: earnedVia || {},
    });

    logger.info("[badges] Granted badge:", badgeId, "to user:", uid);
    return true;
  } catch (error) {
    logger.error("[badges] Error granting badge:", error);
    return false;
  }
}

/**
 * Check and grant badge for an achievement
 * Called when an achievement is earned
 */
export async function checkAndGrantBadgeForAchievement(
  uid: string,
  achievementId: string,
): Promise<Badge | null> {
  const badge = getBadgeForAchievement(achievementId);

  if (!badge) {
    return null;
  }

  const granted = await grantBadge(uid, badge.id, {
    achievementId,
  });

  return granted ? badge : null;
}

/**
 * Check and grant badge for a streak milestone
 */
export async function checkAndGrantBadgeForStreak(
  uid: string,
  streakDays: number,
): Promise<Badge | null> {
  const badge = getBadgeForMilestone("streak", streakDays);

  if (!badge) {
    return null;
  }

  const granted = await grantBadge(uid, badge.id, {
    meta: { streakDays },
  });

  return granted ? badge : null;
}

// =============================================================================
// Badge Featuring
// =============================================================================

/**
 * Feature a badge on profile
 * @param displayOrder - Position 1-5 for display order
 */
export async function featureBadge(
  uid: string,
  badgeId: string,
  displayOrder: number,
): Promise<boolean> {
  const db = getDb();

  if (displayOrder < 1 || displayOrder > 5) {
    logger.error("[badges] Invalid display order:", displayOrder);
    return false;
  }

  try {
    // Check user has this badge
    const badgeRef = doc(db, "Users", uid, "Badges", badgeId);
    const badgeDoc = await getDoc(badgeRef);

    if (!badgeDoc.exists()) {
      logger.error("[badges] User does not have badge:", badgeId);
      return false;
    }

    // Get current featured badges to check limit
    const featured = await getFeaturedBadges(uid);

    // Check if already featured
    const alreadyFeatured = featured.find((b) => b.badgeId === badgeId);
    if (alreadyFeatured) {
      // Just update display order
      await updateDoc(badgeRef, { displayOrder });
      return true;
    }

    // Check limit (max 5 featured)
    if (featured.length >= 5) {
      logger.error("[badges] Max featured badges reached (5)");
      return false;
    }

    // Feature the badge
    await updateDoc(badgeRef, {
      featured: true,
      displayOrder,
    });

    return true;
  } catch (error) {
    logger.error("[badges] Error featuring badge:", error);
    return false;
  }
}

/**
 * Unfeature a badge from profile
 */
export async function unfeatureBadge(
  uid: string,
  badgeId: string,
): Promise<boolean> {
  const db = getDb();

  try {
    const badgeRef = doc(db, "Users", uid, "Badges", badgeId);
    await updateDoc(badgeRef, {
      featured: false,
      displayOrder: null,
    });

    return true;
  } catch (error) {
    logger.error("[badges] Error unfeaturing badge:", error);
    return false;
  }
}

/**
 * Reorder featured badges
 */
export async function reorderFeaturedBadges(
  uid: string,
  orderedBadgeIds: string[],
): Promise<boolean> {
  const db = getDb();

  if (orderedBadgeIds.length > 5) {
    logger.error("[badges] Cannot feature more than 5 badges");
    return false;
  }

  try {
    const batch = writeBatch(db);

    orderedBadgeIds.forEach((badgeId, index) => {
      const badgeRef = doc(db, "Users", uid, "Badges", badgeId);
      batch.update(badgeRef, {
        featured: true,
        displayOrder: index + 1,
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    logger.error("[badges] Error reordering badges:", error);
    return false;
  }
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to user's badges for real-time updates
 * Includes retry logic for auth propagation delays
 * @returns Unsubscribe function
 */
export function subscribeToBadges(
  uid: string,
  onUpdate: (badges: UserBadge[]) => void,
  onError?: (error: Error) => void,
): () => void {
  logger.info("[badges.subscribeToBadges] Creating subscription for uid:", uid);
  const db = getDb();
  const badgesRef = collection(db, "Users", uid, "Badges");
  const q = query(badgesRef, orderBy("earnedAt", "desc"));

  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second
  let unsubscribe: (() => void) | null = null;
  let isUnsubscribed = false;

  const setupSubscription = (): (() => void) => {
    return onSnapshot(
      q,
      (snapshot) => {
        logger.info(
          "[badges.subscribeToBadges] Snapshot received, docs:",
          snapshot.docs.length,
        );
        retryCount = 0; // Reset retry count on success
        const badges = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            badgeId: doc.id,
            earnedAt:
              data.earnedAt?.toMillis?.() || data.earnedAt || Date.now(),
            featured: data.featured || false,
            displayOrder: data.displayOrder,
            earnedVia: data.earnedVia,
          } as UserBadge;
        });
        onUpdate(badges);
      },
      (error) => {
        const errorCode = (error as { code?: string }).code;
        logger.error("[badges] Subscription error:", error);
        logger.error("[badges] Error code:", errorCode);
        logger.error("[badges] Subscription was for uid:", uid);

        // Retry on permission-denied (likely auth sync delay)
        if (
          errorCode === "permission-denied" &&
          retryCount < maxRetries &&
          !isUnsubscribed
        ) {
          retryCount++;
          logger.info(
            `[badges] Retrying subscription (attempt ${retryCount}/${maxRetries}) in ${retryDelay}ms...`,
          );

          setTimeout(() => {
            if (!isUnsubscribed) {
              logger.info(`[badges] Retry attempt ${retryCount} starting...`);
              unsubscribe = setupSubscription();
            }
          }, retryDelay * retryCount); // Exponential-ish backoff
        } else if (retryCount >= maxRetries) {
          logger.error("[badges] Max retries reached, giving up");
          onError?.(error as Error);
        } else {
          onError?.(error as Error);
        }
      },
    );
  };

  unsubscribe = setupSubscription();

  return () => {
    logger.info("[badges] Unsubscribing from badges for uid:", uid);
    isUnsubscribed = true;
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

/**
 * Subscribe to featured badges only
 */
export function subscribeToFeaturedBadges(
  uid: string,
  onUpdate: (badges: UserBadge[]) => void,
): () => void {
  const db = getDb();
  const badgesRef = collection(db, "Users", uid, "Badges");
  const q = query(
    badgesRef,
    where("featured", "==", true),
    orderBy("displayOrder", "asc"),
  );

  return onSnapshot(q, (snapshot) => {
    const badges = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        badgeId: doc.id,
        earnedAt: data.earnedAt?.toMillis?.() || data.earnedAt || Date.now(),
        featured: true,
        displayOrder: data.displayOrder,
        earnedVia: data.earnedVia,
      } as UserBadge;
    });
    onUpdate(badges);
  });
}

// =============================================================================
// Badge Stats
// =============================================================================

/**
 * Get badge statistics for a user
 */
export async function getBadgeStats(uid: string): Promise<{
  total: number;
  earned: number;
  featured: number;
  byCategory: Record<string, number>;
  byTier: Record<string, number>;
}> {
  const badges = await getUserBadges(uid);
  const total = BADGE_DEFINITIONS.filter((b) => !b.hidden).length;

  const byCategory: Record<string, number> = {};
  const byTier: Record<string, number> = {};

  for (const userBadge of badges) {
    const definition = getBadgeById(userBadge.badgeId);
    if (definition) {
      byCategory[definition.category] =
        (byCategory[definition.category] || 0) + 1;
      byTier[definition.tier] = (byTier[definition.tier] || 0) + 1;
    }
  }

  return {
    total,
    earned: badges.length,
    featured: badges.filter((b) => b.featured).length,
    byCategory,
    byTier,
  };
}
