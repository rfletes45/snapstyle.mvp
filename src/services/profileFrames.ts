/**
 * Profile Frames Service
 *
 * Handles:
 * - Fetching available frames
 * - Managing user's owned frames
 * - Equipping frames to profile
 * - Real-time frame subscriptions
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 * @see src/types/profile.ts for ProfileFrame type
 * @see src/data/extendedCosmetics.ts for frame definitions
 */

import {
  getAllFrames,
  getFrameById,
  PROFILE_FRAMES,
} from "@/data/extendedCosmetics";
import type { ProfileFrame } from "@/types/profile";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

// Lazy getter for Firestore
const getDb = () => getFirestoreInstance();

// =============================================================================
// Frame Definitions
// =============================================================================

/**
 * Get all frame definitions
 */
export function getAvailableFrames(): ProfileFrame[] {
  return getAllFrames();
}

/**
 * Get a specific frame definition
 */
export function getFrame(frameId: string): ProfileFrame | undefined {
  return getFrameById(frameId);
}

/**
 * Get frames by tier
 */
export function getFramesByTier(tier: ProfileFrame["tier"]): ProfileFrame[] {
  return PROFILE_FRAMES.filter((f) => f.tier === tier);
}

/**
 * Get frames by rarity
 */
export function getFramesByRarity(
  rarity: ProfileFrame["rarity"],
): ProfileFrame[] {
  return PROFILE_FRAMES.filter((f) => f.rarity === rarity);
}

// =============================================================================
// User Frame Ownership
// =============================================================================

/**
 * Get user's owned frame IDs
 */
export async function getUserOwnedFrames(uid: string): Promise<string[]> {
  const db = getDb();

  try {
    const inventoryRef = collection(db, "Users", uid, "inventory");
    const q = query(inventoryRef, where("slot", "==", "profile_frame"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => doc.id);
  } catch (error) {
    console.error("[profileFrames] Error fetching owned frames:", error);
    return [];
  }
}

/**
 * Check if user owns a specific frame
 */
export async function userOwnsFrame(
  uid: string,
  frameId: string,
): Promise<boolean> {
  const db = getDb();

  // Check if it's a starter frame (always owned)
  const frame = getFrameById(frameId);
  if (frame?.unlock.type === "starter" || frame?.unlock.type === "free") {
    return true;
  }

  try {
    const itemRef = doc(db, "Users", uid, "inventory", frameId);
    const itemDoc = await getDoc(itemRef);
    return itemDoc.exists();
  } catch (error) {
    console.error("[profileFrames] Error checking frame ownership:", error);
    return false;
  }
}

/**
 * Grant a frame to a user
 */
export async function grantFrame(
  uid: string,
  frameId: string,
  source?: string,
): Promise<boolean> {
  const db = getDb();

  try {
    // Verify frame exists
    const frame = getFrameById(frameId);
    if (!frame) {
      console.error("[profileFrames] Frame not found:", frameId);
      return false;
    }

    // Check if already owned
    const alreadyOwned = await userOwnsFrame(uid, frameId);
    if (alreadyOwned) {
      console.log("[profileFrames] User already owns frame:", frameId);
      return false;
    }

    // Add to inventory
    const itemRef = doc(db, "Users", uid, "inventory", frameId);
    await setDoc(itemRef, {
      itemId: frameId,
      slot: "profile_frame",
      acquiredAt: Date.now(),
      source: source || "unknown",
    });

    console.log("[profileFrames] Granted frame:", frameId, "to user:", uid);
    return true;
  } catch (error) {
    console.error("[profileFrames] Error granting frame:", error);
    return false;
  }
}

// =============================================================================
// Frame Equipping
// =============================================================================

/**
 * Get user's currently equipped frame ID
 */
export async function getEquippedFrame(uid: string): Promise<string | null> {
  const db = getDb();

  try {
    const userRef = doc(db, "Users", uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return null;
    }

    const data = userDoc.data();
    return data.avatarConfig?.profileFrame || null;
  } catch (error) {
    console.error("[profileFrames] Error getting equipped frame:", error);
    return null;
  }
}

/**
 * Equip a frame to user's profile
 */
export async function equipFrame(
  uid: string,
  frameId: string | null,
): Promise<boolean> {
  const db = getDb();

  try {
    // If frameId is provided, verify ownership
    if (frameId) {
      const ownsFrame = await userOwnsFrame(uid, frameId);
      if (!ownsFrame) {
        console.error("[profileFrames] User does not own frame:", frameId);
        return false;
      }
    }

    // Update avatar config
    const userRef = doc(db, "Users", uid);
    await updateDoc(userRef, {
      "avatarConfig.profileFrame": frameId || null,
      lastActive: Date.now(),
    });

    console.log("[profileFrames] Equipped frame:", frameId || "none");
    return true;
  } catch (error) {
    console.error("[profileFrames] Error equipping frame:", error);
    return false;
  }
}

/**
 * Unequip current frame
 */
export async function unequipFrame(uid: string): Promise<boolean> {
  return equipFrame(uid, null);
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to user's owned frames
 */
export function subscribeToOwnedFrames(
  uid: string,
  onUpdate: (frameIds: string[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getDb();
  const inventoryRef = collection(db, "Users", uid, "inventory");
  const q = query(inventoryRef, where("slot", "==", "profile_frame"));

  return onSnapshot(
    q,
    (snapshot) => {
      const frameIds = snapshot.docs.map((doc) => doc.id);
      onUpdate(frameIds);
    },
    (error) => {
      console.error("[profileFrames] Subscription error:", error);
      onError?.(error as Error);
    },
  );
}

/**
 * Subscribe to user's equipped frame
 */
export function subscribeToEquippedFrame(
  uid: string,
  onUpdate: (frameId: string | null) => void,
): () => void {
  const db = getDb();
  const userRef = doc(db, "Users", uid);

  return onSnapshot(userRef, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }

    const data = snapshot.data();
    onUpdate(data.avatarConfig?.profileFrame || null);
  });
}

// =============================================================================
// Frame Unlock Checking
// =============================================================================

/**
 * Check if user meets unlock requirements for a frame
 */
export async function canUnlockFrame(
  uid: string,
  frameId: string,
  userStats?: {
    streak?: number;
    level?: number;
    gamesPlayed?: number;
    achievements?: string[];
    tokenBalance?: number;
  },
): Promise<{
  canUnlock: boolean;
  reason?: string;
  progress?: { current: number; required: number };
}> {
  const frame = getFrameById(frameId);

  if (!frame) {
    return { canUnlock: false, reason: "Frame not found" };
  }

  const { unlock } = frame;

  switch (unlock.type) {
    case "starter":
    case "free":
      return { canUnlock: true };

    case "milestone":
      if (!userStats) {
        return { canUnlock: false, reason: "Stats required" };
      }

      const milestoneValue = unlock.milestoneValue || 0;

      if (unlock.milestoneType === "streak") {
        const currentStreak = userStats.streak || 0;
        return {
          canUnlock: currentStreak >= milestoneValue,
          reason:
            currentStreak >= milestoneValue
              ? undefined
              : `Reach ${milestoneValue} day streak`,
          progress: { current: currentStreak, required: milestoneValue },
        };
      }

      if (unlock.milestoneType === "level") {
        const currentLevel = userStats.level || 1;
        return {
          canUnlock: currentLevel >= milestoneValue,
          reason:
            currentLevel >= milestoneValue
              ? undefined
              : `Reach level ${milestoneValue}`,
          progress: { current: currentLevel, required: milestoneValue },
        };
      }

      if (unlock.milestoneType === "games_played") {
        const gamesPlayed = userStats.gamesPlayed || 0;
        return {
          canUnlock: gamesPlayed >= milestoneValue,
          reason:
            gamesPlayed >= milestoneValue
              ? undefined
              : `Play ${milestoneValue} games`,
          progress: { current: gamesPlayed, required: milestoneValue },
        };
      }

      return { canUnlock: false, reason: "Unknown milestone type" };

    case "achievement":
      if (!userStats?.achievements || !unlock.achievementId) {
        return { canUnlock: false, reason: "Achievement required" };
      }

      const hasAchievement = userStats.achievements.includes(
        unlock.achievementId,
      );
      return {
        canUnlock: hasAchievement,
        reason: hasAchievement ? undefined : "Complete required achievement",
      };

    case "purchase":
      if (!userStats?.tokenBalance || !unlock.priceTokens) {
        return { canUnlock: false, reason: "Insufficient tokens" };
      }

      const canAfford = userStats.tokenBalance >= unlock.priceTokens;
      return {
        canUnlock: canAfford,
        reason: canAfford ? undefined : `Need ${unlock.priceTokens} tokens`,
      };

    case "exclusive":
      return {
        canUnlock: false,
        reason: "Exclusive item - cannot be unlocked",
      };

    case "premium":
      return { canUnlock: false, reason: "Premium purchase required" };

    default:
      return { canUnlock: false, reason: "Unknown unlock type" };
  }
}

// =============================================================================
// Frame Display Helpers
// =============================================================================

/**
 * Get frame with ownership and equipped status
 */
export async function getFrameWithStatus(
  uid: string,
  frameId: string,
): Promise<(ProfileFrame & { owned: boolean; equipped: boolean }) | undefined> {
  const frame = getFrameById(frameId);
  if (!frame) return undefined;

  const owned = await userOwnsFrame(uid, frameId);
  const equippedId = await getEquippedFrame(uid);

  return {
    ...frame,
    owned,
    equipped: equippedId === frameId,
  };
}

/**
 * Get all frames with ownership status
 */
export async function getAllFramesWithStatus(
  uid: string,
): Promise<(ProfileFrame & { owned: boolean; equipped: boolean })[]> {
  const frames = getAllFrames();
  const ownedFrames = await getUserOwnedFrames(uid);
  const equippedId = await getEquippedFrame(uid);

  return frames.map((frame) => ({
    ...frame,
    owned:
      ownedFrames.includes(frame.id) ||
      frame.unlock.type === "starter" ||
      frame.unlock.type === "free",
    equipped: equippedId === frame.id,
  }));
}
