/**
 * Client-side Streak and Cosmetics Handler
 * This runs on the client to update streaks and grant cosmetics
 * Works as a fallback if Cloud Functions aren't deployed
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import { addToInventory, hasItem } from "./cosmetics";
import { MILESTONE_REWARDS } from "@/data/cosmetics";
import { todayKey } from "@/utils/dates";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/streakCosmetics");
/**
 * Update streak after sending a message
 * This is called client-side as a fallback
 */
export async function updateStreakAfterMessage(
  senderId: string,
  recipientId: string,
): Promise<{ newCount: number; milestoneReached: number | null }> {
  try {
    logger.info("🔵 [updateStreakAfterMessage] Starting streak update", {
      senderId,
      recipientId,
    });

    const db = getFirestoreInstance();

    // Find friendship document
    const friendsRef = collection(db, "Friends");
    const querySnapshot = await getDocs(
      query(friendsRef, where("users", "array-contains", senderId)),
    );

    const friendDoc = querySnapshot.docs.find((doc) => {
      const users = doc.data().users as string[];
      return users.includes(recipientId);
    });

    if (!friendDoc) {
      logger.info("❌ [updateStreakAfterMessage] Friendship not found");
      return { newCount: 0, milestoneReached: null };
    }

    logger.info(
      "✅ [updateStreakAfterMessage] Found friendship:",
      friendDoc.id,
    );

    const data = friendDoc.data();
    const today = todayKey();
    const [uid1, uid2] = data.users;
    const isUser1 = senderId === uid1;

    const lastSentField = isUser1 ? "lastSentDay_uid1" : "lastSentDay_uid2";
    const otherLastSentField = isUser1
      ? "lastSentDay_uid2"
      : "lastSentDay_uid1";

    const currentLastSent = data[lastSentField] || "";
    const otherLastSent = data[otherLastSentField] || "";
    const streakUpdatedDay = data.streakUpdatedDay || "";
    let streakCount = data.streakCount || 0;

    logger.info("🔵 [updateStreakAfterMessage] Current state:", {
      today,
      isUser1,
      currentLastSent,
      otherLastSent,
      streakUpdatedDay,
      streakCount,
    });

    // If user already sent today, no update needed
    if (currentLastSent === today) {
      logger.info("⏭️ [updateStreakAfterMessage] User already sent today");
      return { newCount: streakCount, milestoneReached: null };
    }

    const updates: any = {
      [lastSentField]: today,
    };

    let milestoneReached: number | null = null;

    // Check if this completes today's streak requirement
    const otherSentToday = otherLastSent === today;

    logger.info("🔵 [updateStreakAfterMessage] Checking streak conditions:", {
      otherSentToday,
      streakUpdatedDayNotToday: streakUpdatedDay !== today,
    });

    if (otherSentToday && streakUpdatedDay !== today) {
      // Both users have now sent today - update streak
      if (!streakUpdatedDay) {
        // First streak ever
        streakCount = 1;
        logger.info("🆕 [updateStreakAfterMessage] First streak:", streakCount);
      } else {
        // Check if streak continues from yesterday
        const lastUpdate = new Date(streakUpdatedDay);
        const todayDate = new Date(today);
        const daysDiff = Math.floor(
          (todayDate.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24),
        );

        logger.info(
          "🔵 [updateStreakAfterMessage] Days since last update:",
          daysDiff,
        );

        if (daysDiff <= 1) {
          // Streak continues
          streakCount += 1;
          logger.info(
            "🔥 [updateStreakAfterMessage] Streak continues:",
            streakCount,
          );
        } else {
          // Streak broken
          streakCount = 1;
          logger.info(
            "💔➡️🆕 [updateStreakAfterMessage] Streak broken, restarting:",
            streakCount,
          );
        }
      }

      updates.streakCount = streakCount;
      updates.streakUpdatedDay = today;

      // Check if milestone reached
      const milestones = [3, 7, 14, 30, 50, 100, 365];
      if (milestones.includes(streakCount)) {
        milestoneReached = streakCount;
        logger.info(
          "🎉 [updateStreakAfterMessage] MILESTONE REACHED!",
          streakCount,
          "days",
        );
      }
    } else if (!otherSentToday) {
      // Check if streak needs reset
      const lastUpdate = new Date(streakUpdatedDay || "2000-01-01");
      const todayDate = new Date(today);
      const daysDiff = Math.floor(
        (todayDate.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff > 1 && streakCount > 0) {
        logger.info("💔 [updateStreakAfterMessage] Streak broken");
        updates.streakCount = 0;
        streakCount = 0;
      } else {
        logger.info("⏳ [updateStreakAfterMessage] Waiting for other user");
      }
    }

    logger.info("🔵 [updateStreakAfterMessage] Applying updates:", updates);
    await updateDoc(friendDoc.ref, updates);
    logger.info("✅ [updateStreakAfterMessage] Streak updated");

    // Grant cosmetics if milestone reached (only to sender - other user will get it when they send)
    if (milestoneReached) {
      await grantMilestoneCosmetics(senderId, milestoneReached);
    }

    return { newCount: streakCount, milestoneReached };
  } catch (error) {
    logger.error("❌ [updateStreakAfterMessage] Error:", error);
    return { newCount: 0, milestoneReached: null };
  }
}

/**
 * Grant cosmetic reward to a user for reaching a milestone
 * Note: Only grants to the current user. The other user will receive the reward when they send a message.
 */
async function grantMilestoneCosmetics(
  userId: string,
  milestone: number,
): Promise<void> {
  logger.info(
    "🎁 [grantMilestoneCosmetics] Granting rewards for milestone:",
    milestone,
  );

  const itemId = MILESTONE_REWARDS[milestone];
  if (!itemId) {
    logger.info("No cosmetic reward for milestone", milestone);
    return;
  }

  try {
    // Check if user already has the item
    const alreadyHas = await hasItem(userId, itemId);
    if (alreadyHas) {
      logger.info(`User ${userId} already has ${itemId}`);
      return;
    }

    // Grant the item
    const success = await addToInventory(userId, itemId);
    if (success) {
      logger.info(
        `🎁 Granted ${itemId} to user ${userId} for ${milestone}-day streak`,
      );
    }
  } catch (error) {
    logger.error(`Error granting ${itemId} to ${userId}:`, error);
  }
}
