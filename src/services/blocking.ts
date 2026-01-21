/**
 * Blocking Service
 * Phase 8: Safety features - Block/unblock users
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import { removeFriend } from "./friends";
import type { BlockedUser, User } from "@/types/models";

/**
 * Block a user
 * - Adds to blocker's blockedUsers subcollection
 * - Removes friendship if exists
 * - Cancels any pending friend requests
 */
export async function blockUser(
  currentUserId: string,
  userToBlockId: string,
  reason?: string,
): Promise<boolean> {
  try {
    console.log("🔵 [blocking] Blocking user:", userToBlockId);

    const db = getFirestoreInstance();

    // Add to blocked users
    const blockedRef = doc(
      db,
      "Users",
      currentUserId,
      "blockedUsers",
      userToBlockId,
    );

    const blockData: BlockedUser = {
      blockedUserId: userToBlockId,
      blockedAt: Date.now(),
      reason,
    };

    await setDoc(blockedRef, blockData);
    console.log("✅ [blocking] Added to blocked list");

    // Remove friendship if exists
    try {
      await removeFriend(currentUserId, userToBlockId);
      console.log("✅ [blocking] Removed friendship");
    } catch (e) {
      // Friendship might not exist, that's fine
      console.log("ℹ️ [blocking] No friendship to remove");
    }

    // Cancel any pending friend requests (both directions)
    await cancelPendingRequests(currentUserId, userToBlockId);

    console.log("✅ [blocking] User blocked successfully");
    return true;
  } catch (error) {
    console.error("❌ [blocking] Error blocking user:", error);
    return false;
  }
}

/**
 * Unblock a user
 */
export async function unblockUser(
  currentUserId: string,
  userToUnblockId: string,
): Promise<boolean> {
  try {
    console.log("🔵 [blocking] Unblocking user:", userToUnblockId);

    const db = getFirestoreInstance();
    const blockedRef = doc(
      db,
      "Users",
      currentUserId,
      "blockedUsers",
      userToUnblockId,
    );

    await deleteDoc(blockedRef);
    console.log("✅ [blocking] User unblocked successfully");
    return true;
  } catch (error) {
    console.error("❌ [blocking] Error unblocking user:", error);
    return false;
  }
}

/**
 * Check if a user is blocked by the current user
 */
export async function isUserBlocked(
  currentUserId: string,
  targetUserId: string,
): Promise<boolean> {
  try {
    const db = getFirestoreInstance();
    const blockedRef = doc(
      db,
      "Users",
      currentUserId,
      "blockedUsers",
      targetUserId,
    );
    const blockedDoc = await getDoc(blockedRef);
    return blockedDoc.exists();
  } catch (error: any) {
    // Permission errors are expected when checking other users' blocked lists
    // Return false to indicate no block from this direction
    if (error?.code === "permission-denied") {
      return false;
    }

    // For offline errors, throw so the caller can handle appropriately
    if (error?.code === "unavailable" || error?.message?.includes("offline")) {
      console.error("❌ [blocking] Error checking block status:", error);
      throw new Error("Cannot verify block status while offline");
    }

    console.error("❌ [blocking] Error checking block status:", error);
    return false;
  }
}

/**
 * Check if current user is blocked BY another user
 */
export async function isBlockedByUser(
  currentUserId: string,
  otherUserId: string,
): Promise<boolean> {
  try {
    const db = getFirestoreInstance();
    const blockedRef = doc(
      db,
      "Users",
      otherUserId,
      "blockedUsers",
      currentUserId,
    );
    const blockedDoc = await getDoc(blockedRef);
    return blockedDoc.exists();
  } catch (error) {
    console.error("❌ [blocking] Error checking if blocked by user:", error);
    return false;
  }
}

/**
 * Check if there's any block between two users (either direction)
 */
export async function hasBlockBetweenUsers(
  userId1: string,
  userId2: string,
): Promise<boolean> {
  const blocked1 = await isUserBlocked(userId1, userId2);
  const blocked2 = await isUserBlocked(userId2, userId1);
  return blocked1 || blocked2;
}

/**
 * Get all blocked users for current user
 */
export async function getBlockedUsers(
  currentUserId: string,
): Promise<BlockedUser[]> {
  try {
    const db = getFirestoreInstance();
    const blockedRef = collection(db, "Users", currentUserId, "blockedUsers");
    const snapshot = await getDocs(blockedRef);

    return snapshot.docs.map((doc) => ({
      blockedUserId: doc.id,
      blockedAt: doc.data().blockedAt,
      reason: doc.data().reason,
    }));
  } catch (error) {
    console.error("❌ [blocking] Error getting blocked users:", error);
    return [];
  }
}

/**
 * Get blocked users with their profile info
 */
export async function getBlockedUsersWithProfiles(
  currentUserId: string,
): Promise<(BlockedUser & { username?: string; displayName?: string })[]> {
  try {
    const blockedUsers = await getBlockedUsers(currentUserId);
    const db = getFirestoreInstance();

    const usersWithProfiles = await Promise.all(
      blockedUsers.map(async (blocked) => {
        try {
          const userDoc = await getDoc(doc(db, "Users", blocked.blockedUserId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              ...blocked,
              username: userData.username,
              displayName: userData.displayName,
            };
          }
        } catch (e) {
          console.error("Error fetching user profile:", e);
        }
        return blocked;
      }),
    );

    return usersWithProfiles;
  } catch (error) {
    console.error(
      "❌ [blocking] Error getting blocked users with profiles:",
      error,
    );
    return [];
  }
}

/**
 * Cancel any pending friend requests between two users
 */
async function cancelPendingRequests(
  userId1: string,
  userId2: string,
): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const requestsRef = collection(db, "FriendRequests");

    // Find requests from user1 to user2
    const q1 = query(
      requestsRef,
      where("from", "==", userId1),
      where("to", "==", userId2),
      where("status", "==", "pending"),
    );

    // Find requests from user2 to user1
    const q2 = query(
      requestsRef,
      where("from", "==", userId2),
      where("to", "==", userId1),
      where("status", "==", "pending"),
    );

    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(q1),
      getDocs(q2),
    ]);

    // Delete all pending requests
    const deletePromises = [
      ...snapshot1.docs.map((d) => deleteDoc(d.ref)),
      ...snapshot2.docs.map((d) => deleteDoc(d.ref)),
    ];

    await Promise.all(deletePromises);
    console.log(
      "✅ [blocking] Cancelled",
      deletePromises.length,
      "pending requests",
    );
  } catch (error) {
    console.error("❌ [blocking] Error cancelling requests:", error);
  }
}
