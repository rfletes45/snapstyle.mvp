/**
 * Streak Service
 * Handles streak counting and management between friends
 *
 * Streak Logic:
 * - A streak is maintained when BOTH users send at least one message per day
 * - If either user misses a day, the streak resets to 0
 * - Streak increments only once per day when both users have sent
 * - Milestones at 3, 7, 14, 30, 100 days
 */

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import { todayKey } from "@/utils/dates";

export interface StreakStatus {
  count: number;
  isActive: boolean; // True if streak is still alive today
  lastUpdated: string; // YYYY-MM-DD
  user1SentToday: boolean;
  user2SentToday: boolean;
  nextMilestone: number | null;
  atRisk: boolean; // True if only one user has sent today
}

// Milestone thresholds
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365];

/**
 * Calculate days between two date strings (YYYY-MM-DD)
 */
function getDaysBetween(dateStr1: string, dateStr2: string): number {
  if (!dateStr1 || !dateStr2) return Infinity;
  const date1 = new Date(dateStr1);
  const date2 = new Date(dateStr2);
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get streak status for a friendship
 * @param friendshipId - The Friend document ID
 * @param currentUserId - Current user's UID to determine position
 */
export async function getStreakStatus(
  friendshipId: string,
  currentUserId: string,
): Promise<StreakStatus | null> {
  try {
    console.log("🔵 [streaks] Getting streak status for:", friendshipId);

    const db = getFirestoreInstance();
    const friendRef = doc(db, "Friends", friendshipId);
    const friendDoc = await getDoc(friendRef);

    if (!friendDoc.exists()) {
      console.warn("⚠️ [streaks] Friendship not found:", friendshipId);
      return null;
    }

    const data = friendDoc.data();
    const today = todayKey();
    const [uid1, uid2] = data.users;

    // Determine which user is which
    const isUser1 = currentUserId === uid1;
    const lastSentDay1 = data.lastSentDay_uid1 || "";
    const lastSentDay2 = data.lastSentDay_uid2 || "";

    // Check if each user has sent today
    const user1SentToday = lastSentDay1 === today;
    const user2SentToday = lastSentDay2 === today;

    // Calculate if streak is active
    const streakUpdatedDay = data.streakUpdatedDay || "";
    const daysSinceUpdate = getDaysBetween(streakUpdatedDay, today);

    // Streak is active if it was updated today or yesterday (grace period)
    // and if at least one user has sent today
    const isActive =
      daysSinceUpdate <= 1 && (user1SentToday || user2SentToday);

    // Streak is at risk if only one user has sent today
    const atRisk =
      isActive &&
      ((user1SentToday && !user2SentToday) ||
        (!user1SentToday && user2SentToday));

    // Find next milestone
    const currentCount = data.streakCount || 0;
    const nextMilestone =
      STREAK_MILESTONES.find((m) => m > currentCount) || null;

    const status: StreakStatus = {
      count: currentCount,
      isActive,
      lastUpdated: streakUpdatedDay,
      user1SentToday: isUser1 ? user1SentToday : user2SentToday,
      user2SentToday: isUser1 ? user2SentToday : user1SentToday,
      nextMilestone,
      atRisk,
    };

    console.log("✅ [streaks] Status:", status);
    return status;
  } catch (error: any) {
    console.error("❌ [streaks] Error getting streak status:", error);
    throw error;
  }
}

/**
 * Record that a user sent a message today
 * This is called when sending a message to update streak tracking
 * @param friendshipId - The Friend document ID
 * @param senderId - The sender's UID
 * @returns Updated streak count and whether a milestone was reached
 */
export async function recordMessageSent(
  friendshipId: string,
  senderId: string,
): Promise<{ newCount: number; milestoneReached: number | null }> {
  try {
    console.log("🔵 [streaks] Recording message for:", {
      friendshipId,
      senderId,
    });

    const db = getFirestoreInstance();
    const friendRef = doc(db, "Friends", friendshipId);
    const friendDoc = await getDoc(friendRef);

    if (!friendDoc.exists()) {
      throw new Error("Friendship not found");
    }

    const data = friendDoc.data();
    const today = todayKey();
    const [uid1, uid2] = data.users;

    // Determine which user position the sender is
    const isUser1 = senderId === uid1;
    const lastSentField = isUser1 ? "lastSentDay_uid1" : "lastSentDay_uid2";
    const otherLastSentField = isUser1 ? "lastSentDay_uid2" : "lastSentDay_uid1";

    // Get current state
    const currentLastSent = data[lastSentField] || "";
    const otherLastSent = data[otherLastSentField] || "";
    const streakUpdatedDay = data.streakUpdatedDay || "";
    let currentCount = data.streakCount || 0;

    // If user already sent today, no update needed
    if (currentLastSent === today) {
      console.log("ℹ️ [streaks] User already sent today, no update");
      return { newCount: currentCount, milestoneReached: null };
    }

    // Prepare update
    const updates: any = {
      [lastSentField]: today,
    };

    let milestoneReached: number | null = null;

    // Check if this completes today's streak requirement (both users sent)
    const otherSentToday = otherLastSent === today;

    if (otherSentToday && streakUpdatedDay !== today) {
      // Both users have now sent today - increment streak!
      const daysSinceLastUpdate = getDaysBetween(streakUpdatedDay, today);

      if (daysSinceLastUpdate <= 1) {
        // Streak continues - increment
        currentCount += 1;
        console.log("🔥 [streaks] Streak incremented to:", currentCount);
      } else {
        // Streak was broken, start fresh at 1
        currentCount = 1;
        console.log("🔄 [streaks] Streak reset, starting at 1");
      }

      updates.streakCount = currentCount;
      updates.streakUpdatedDay = today;

      // Check if milestone reached
      if (STREAK_MILESTONES.includes(currentCount)) {
        milestoneReached = currentCount;
        console.log("🏆 [streaks] Milestone reached:", milestoneReached);
      }
    } else if (!otherSentToday) {
      // Other user hasn't sent yet today
      // Check if streak needs to be reset (missed yesterday)
      const daysSinceLastUpdate = getDaysBetween(streakUpdatedDay, today);
      if (daysSinceLastUpdate > 1 && currentCount > 0) {
        // Streak broken - reset
        updates.streakCount = 0;
        currentCount = 0;
        console.log("💔 [streaks] Streak broken, reset to 0");
      }
    }

    // Apply updates
    await updateDoc(friendRef, updates);
    console.log("✅ [streaks] Updated friendship document");

    return { newCount: currentCount, milestoneReached };
  } catch (error: any) {
    console.error("❌ [streaks] Error recording message:", error);
    throw error;
  }
}

/**
 * Get all friendships with active streaks for a user
 * @param userId - User's UID
 * @returns Array of friendship IDs with active streaks
 */
export async function getActiveStreaks(
  userId: string,
): Promise<{ friendshipId: string; count: number; atRisk: boolean }[]> {
  try {
    console.log("🔵 [streaks] Getting active streaks for:", userId);

    const db = getFirestoreInstance();
    const friendsRef = collection(db, "Friends");
    const q = query(
      friendsRef,
      where("users", "array-contains", userId),
      where("streakCount", ">", 0),
    );

    const snapshot = await getDocs(q);
    const today = todayKey();
    const activeStreaks: { friendshipId: string; count: number; atRisk: boolean }[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const daysSinceUpdate = getDaysBetween(data.streakUpdatedDay || "", today);

      // Only include if streak is still alive (updated today or yesterday)
      if (daysSinceUpdate <= 1) {
        const [uid1] = data.users;
        const isUser1 = userId === uid1;
        const myLastSent = isUser1 ? data.lastSentDay_uid1 : data.lastSentDay_uid2;
        const theirLastSent = isUser1 ? data.lastSentDay_uid2 : data.lastSentDay_uid1;

        const atRisk =
          (myLastSent === today && theirLastSent !== today) ||
          (myLastSent !== today && theirLastSent === today);

        activeStreaks.push({
          friendshipId: doc.id,
          count: data.streakCount,
          atRisk,
        });
      }
    }

    console.log("✅ [streaks] Found active streaks:", activeStreaks.length);
    return activeStreaks;
  } catch (error: any) {
    console.error("❌ [streaks] Error getting active streaks:", error);
    return [];
  }
}

/**
 * Get streaks at risk (only one user sent today)
 * Used for reminder notifications
 */
export async function getStreaksAtRisk(
  userId: string,
): Promise<{ friendshipId: string; friendId: string; count: number }[]> {
  try {
    const activeStreaks = await getActiveStreaks(userId);
    const atRisk = activeStreaks.filter((s) => s.atRisk);

    // Get friend details for each at-risk streak
    const db = getFirestoreInstance();
    const result: { friendshipId: string; friendId: string; count: number }[] =
      [];

    for (const streak of atRisk) {
      const friendRef = doc(db, "Friends", streak.friendshipId);
      const friendDoc = await getDoc(friendRef);
      if (friendDoc.exists()) {
        const data = friendDoc.data();
        const friendId = data.users.find((u: string) => u !== userId);
        if (friendId) {
          result.push({
            friendshipId: streak.friendshipId,
            friendId,
            count: streak.count,
          });
        }
      }
    }

    return result;
  } catch (error: any) {
    console.error("❌ [streaks] Error getting at-risk streaks:", error);
    return [];
  }
}

/**
 * Format streak count for display with emoji
 */
export function formatStreakDisplay(count: number): string {
  if (count === 0) return "";
  if (count >= 100) return `🔥 ${count} 💯`;
  if (count >= 50) return `🔥 ${count} ⭐`;
  if (count >= 30) return `🔥 ${count} 🌟`;
  if (count >= 14) return `🔥 ${count}`;
  if (count >= 7) return `🔥 ${count}`;
  if (count >= 3) return `🔥 ${count}`;
  return `${count}`;
}

/**
 * Get milestone message for reaching a streak milestone
 */
export function getMilestoneMessage(milestone: number): string {
  switch (milestone) {
    case 3:
      return "🔥 3-day streak! You're on fire!";
    case 7:
      return "🔥 1 week streak! Amazing commitment!";
    case 14:
      return "🔥 2 week streak! Incredible!";
    case 30:
      return "🔥 30-day streak! One month strong!";
    case 50:
      return "🔥 50-day streak! Legendary!";
    case 100:
      return "💯 100-day streak! You're a champion!";
    case 365:
      return "🏆 365-day streak! One whole year!";
    default:
      return `🔥 ${milestone}-day streak!`;
  }
}
