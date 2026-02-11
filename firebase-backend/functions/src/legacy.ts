/**
 * SnapStyle Cloud Functions
 * Handles:
 * - Automatic Storage cleanup when messages are deleted
 * - Story auto-expiry and cleanup
 * - Push notifications
 * - Streak management
 * - V2 Messaging with idempotent sends
 * - Games: Turn-based games, matchmaking, achievements
 *
 * Security Note:
 * - All onCall functions require authentication via context.auth
 * - Admin functions verify context.auth.token.admin claim
 * - Input validation is performed on all user-supplied data
 * - Structured logging includes context for debugging/audit
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// Import V2 Messaging functions
import {
  deleteMessageForAllV2Function,
  editMessageV2Function,
  sendMessageV2Function,
  toggleReactionV2Function,
} from "./messaging";

// Import Games functions
import {
  cleanupOldGameSessions,
  cleanupOldGames,
  cleanupResolvedInvites,
  cleanupStaleMatchmakingEntries,
  createGameFromInvite,
  expireGameInvites,
  expireMatchmakingEntries,
  makeMove,
  onGameCompletedCreateHistory,
  onGameHistoryCreatedUpdateLeaderboard,
  onUniversalInviteUpdate,
  processGameCompletion,
  processMatchmakingQueue,
  resignGame,
} from "./games";

// Import Migration functions
import {
  migrateGameInvites,
  migrateGameInvitesDryRun,
  rollbackGameInvitesMigration,
} from "./migrations/migrateGameInvites";

// Import Shop functions
import { grantItem, purchaseWithTokens } from "./shop";

// Import IAP functions
import { getPurchaseHistory, restorePurchases, validateReceipt } from "./iap";

// Import Gifting functions (Phase 4)
import { expireGifts, getGiftHistory, openGift, sendGift } from "./gifting";

// Import Daily Deals functions (Phase 4)
import {
  cleanupOldDeals,
  generateDailyDeals,
  generateWeeklyDeals,
  triggerDailyDeals,
} from "./dailyDeals";

// Import Call functions (Voice/Video Calling)
import {
  cleanupCallSignaling,
  getTurnCredentials,
  handleCallTimeouts,
  onCallCreated,
  onCallUpdated,
} from "./calls";

// Import Link Preview function
import { fetchLinkPreviewFunction } from "./linkPreview";
import {
  getUserPushToken,
  isDmChatMuted,
  isValidString,
  isValidUid,
  sanitizeForLog,
  sendExpoPushNotification,
} from "./utils";
import type { ExpoPushMessage } from "./utils";

// Re-export V2 Messaging functions
export const sendMessageV2 = sendMessageV2Function;
export const editMessageV2 = editMessageV2Function;
export const deleteMessageForAllV2 = deleteMessageForAllV2Function;
export const toggleReactionV2 = toggleReactionV2Function;

// Re-export Games functions
export {
  cleanupOldGameSessions,
  cleanupOldGames,
  cleanupResolvedInvites,
  cleanupStaleMatchmakingEntries,
  createGameFromInvite,
  expireGameInvites,
  expireMatchmakingEntries,
  makeMove,
  onGameCompletedCreateHistory,
  onGameHistoryCreatedUpdateLeaderboard,
  onUniversalInviteUpdate,
  processGameCompletion,
  processMatchmakingQueue,
  resignGame,
};

// Re-export Migration functions
export {
  migrateGameInvites,
  migrateGameInvitesDryRun,
  rollbackGameInvitesMigration,
};

// Re-export Shop functions
export { grantItem, purchaseWithTokens };

// Re-export IAP functions
export { getPurchaseHistory, restorePurchases, validateReceipt };

// Re-export Gifting functions (Phase 4)
export { expireGifts, getGiftHistory, openGift, sendGift };

// Re-export Daily Deals functions (Phase 4)
export {
  cleanupOldDeals,
  generateDailyDeals,
  generateWeeklyDeals,
  triggerDailyDeals,
};

// Re-export Call functions (Voice/Video Calling)
export {
  cleanupCallSignaling,
  getTurnCredentials,
  handleCallTimeouts,
  onCallCreated,
  onCallUpdated,
};

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

/**
 * onNewMessage: Triggered when a new message is created
 * Sends push notification to recipient and updates streak tracking
 * Respects user mute preferences
 */
export const onNewMessage = functions.firestore
  .document("Chats/{chatId}/Messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { chatId } = context.params;

    try {
      // Get chat to find recipient
      const chatDoc = await db.collection("Chats").doc(chatId).get();
      if (!chatDoc.exists) {
        console.log("Chat not found:", chatId);
        return;
      }

      const chat = chatDoc.data()!;
      const senderId = message.sender;
      const recipientId = chat.members.find((m: string) => m !== senderId);

      if (!recipientId) {
        console.log("Recipient not found in chat");
        return;
      }

      // Check if recipient has muted this chat
      const isMuted = await isDmChatMuted(chatId, recipientId);
      if (isMuted) {
        console.log(
          `[onNewMessage] Skipping muted user ${recipientId.substring(0, 8)}`,
        );
        // Still update streak tracking even if muted
        await updateStreakOnMessage(senderId, recipientId);
        return;
      }

      // Get sender's display name
      const senderDoc = await db.collection("Users").doc(senderId).get();
      const senderName = senderDoc.exists
        ? senderDoc.data()?.displayName || "Someone"
        : "Someone";

      // Get recipient's push token
      const pushToken = await getUserPushToken(recipientId);

      if (pushToken) {
        // Determine notification content based on message type
        const isSnap = message.type === "image";
        const title = senderName;
        const body = isSnap ? "📸 Sent you a picture!" : message.content;

        await sendExpoPushNotification({
          to: pushToken,
          title,
          body,
          data: {
            type: "message",
            chatId,
            senderId,
          },
          sound: "default",
        });

        console.log(`✅ Sent notification to ${recipientId}`);
      }

      // Update streak tracking
      await updateStreakOnMessage(senderId, recipientId);
    } catch (error) {
      console.error("❌ Error in onNewMessage:", error);
    }
  });

// =============================================================================
// H9: Group Message Notifications with Mention Support
// =============================================================================

/**
 * Get user's notification preference for a group conversation
 * Returns "all", "mentions", or "none"
 */
async function getGroupNotifyLevel(
  groupId: string,
  userId: string,
): Promise<"all" | "mentions" | "none"> {
  try {
    const memberPrivateDoc = await db
      .collection("Groups")
      .doc(groupId)
      .collection("MembersPrivate")
      .doc(userId)
      .get();

    if (!memberPrivateDoc.exists) {
      // Default to "all" if no preference set
      return "all";
    }

    const data = memberPrivateDoc.data();
    return data?.notifyLevel || "all";
  } catch (error) {
    console.error(`[getGroupNotifyLevel] Error for ${userId}:`, error);
    return "all"; // Default to "all" on error
  }
}

/**
 * Check if user is muted for a group conversation
 */
async function isGroupMuted(groupId: string, userId: string): Promise<boolean> {
  try {
    const memberPrivateDoc = await db
      .collection("Groups")
      .doc(groupId)
      .collection("MembersPrivate")
      .doc(userId)
      .get();

    if (!memberPrivateDoc.exists) {
      return false;
    }

    const data = memberPrivateDoc.data();
    const mutedUntil = data?.mutedUntil;

    if (!mutedUntil) {
      return false;
    }

    // -1 means muted forever
    if (mutedUntil === -1) {
      return true;
    }

    // Check if still muted
    return mutedUntil > Date.now();
  } catch (error) {
    console.error(`[isGroupMuted] Error for ${userId}:`, error);
    return false;
  }
}

/**
 * Get all members of a group
 */
async function getGroupMemberUids(groupId: string): Promise<string[]> {
  try {
    const membersSnapshot = await db
      .collection("Groups")
      .doc(groupId)
      .collection("Members")
      .get();

    return membersSnapshot.docs.map((doc) => doc.id);
  } catch (error) {
    console.error(`[getGroupMemberUids] Error:`, error);
    return [];
  }
}

/**
 * onNewGroupMessageV2: Triggered when a new message is created in a group
 * Sends push notifications respecting notifyLevel preferences:
 * - "all": notify for all messages
 * - "mentions": notify only if mentioned
 * - "none": never notify
 */
export const onNewGroupMessageV2 = functions.firestore
  .document("Groups/{groupId}/Messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { groupId, messageId } = context.params;

    try {
      // Skip system messages
      if (message.kind === "system") {
        console.log(`[onNewGroupMessageV2] Skipping system message`);
        return;
      }

      const senderId = message.senderId;
      const senderName = message.senderName || "Someone";
      const mentionUids: string[] = message.mentionUids || [];

      console.log(
        `[onNewGroupMessageV2] Processing message in group ${groupId.substring(0, 8)}`,
        {
          messageId: messageId.substring(0, 8),
          senderId: senderId.substring(0, 8),
          mentionCount: mentionUids.length,
        },
      );

      // Get group info for notification title
      const groupDoc = await db.collection("Groups").doc(groupId).get();
      if (!groupDoc.exists) {
        console.log(`[onNewGroupMessageV2] Group not found: ${groupId}`);
        return;
      }
      const groupName = groupDoc.data()?.name || "Group Chat";

      // Get all group members
      const memberUids = await getGroupMemberUids(groupId);

      // Filter out the sender - they don't need a notification
      const recipientUids = memberUids.filter((uid) => uid !== senderId);

      console.log(
        `[onNewGroupMessageV2] Processing ${recipientUids.length} potential recipients`,
      );

      // Process each recipient
      for (const recipientUid of recipientUids) {
        try {
          // Check if muted
          const isMuted = await isGroupMuted(groupId, recipientUid);
          if (isMuted) {
            console.log(
              `[onNewGroupMessageV2] Skipping muted user: ${recipientUid.substring(0, 8)}`,
            );
            continue;
          }

          // Get notification preference
          const notifyLevel = await getGroupNotifyLevel(groupId, recipientUid);
          const isMentioned = mentionUids.includes(recipientUid);

          // Determine if we should notify
          let shouldNotify = false;
          if (notifyLevel === "all") {
            shouldNotify = true;
          } else if (notifyLevel === "mentions" && isMentioned) {
            shouldNotify = true;
          }
          // notifyLevel === "none" means never notify

          if (!shouldNotify) {
            console.log(
              `[onNewGroupMessageV2] Skipping user ${recipientUid.substring(0, 8)}: notifyLevel=${notifyLevel}, mentioned=${isMentioned}`,
            );
            continue;
          }

          // Get push token
          const pushToken = await getUserPushToken(recipientUid);
          if (!pushToken) {
            console.log(
              `[onNewGroupMessageV2] No push token for user: ${recipientUid.substring(0, 8)}`,
            );
            continue;
          }

          // Build notification content
          let title: string;
          let body: string;

          if (isMentioned) {
            title = `${senderName} mentioned you in ${groupName}`;
          } else {
            title = `${groupName}`;
          }

          // Determine body based on message type
          if (message.kind === "text" && message.text) {
            body = `${senderName}: ${message.text}`;
            if (body.length > 100) {
              body = body.substring(0, 97) + "...";
            }
          } else if (message.kind === "media") {
            const attachmentCount = message.attachments?.length || 1;
            body =
              attachmentCount > 1
                ? `${senderName}: 📷 ${attachmentCount} photos`
                : `${senderName}: 📷 Photo`;
          } else if (message.kind === "voice") {
            body = `${senderName}: 🎤 Voice message`;
          } else if (message.kind === "file") {
            body = `${senderName}: 📎 File`;
          } else {
            body = `${senderName} sent a message`;
          }

          // Send notification
          await sendExpoPushNotification({
            to: pushToken,
            title,
            body,
            data: {
              type: "group_message",
              groupId,
              messageId,
              senderId,
              mentioned: isMentioned,
            },
            sound: "default",
          });

          console.log(
            `[onNewGroupMessageV2] ✅ Sent notification to ${recipientUid.substring(0, 8)}`,
          );
        } catch (recipientError) {
          console.error(
            `[onNewGroupMessageV2] Error processing recipient ${recipientUid.substring(0, 8)}:`,
            recipientError,
          );
        }
      }

      console.log(
        `[onNewGroupMessageV2] ✅ Completed processing message ${messageId.substring(0, 8)}`,
      );
    } catch (error) {
      console.error("❌ Error in onNewGroupMessageV2:", error);
    }
  });

async function updateStreakOnMessage(
  senderId: string,
  recipientId: string,
): Promise<void> {
  try {
    console.log("🔵 [updateStreakOnMessage] Starting streak update", {
      senderId,
      recipientId,
    });

    // Find the friendship document using array-contains
    // Since Friends documents have a "users" array with both UIDs,
    // we query for documents containing the sender, then filter client-side
    const friendsRef = db.collection("Friends");
    const querySnapshot = await friendsRef
      .where("users", "array-contains", senderId)
      .get();

    // Find the friendship that includes both users
    let friendDoc = querySnapshot.docs.find((doc) => {
      const users = doc.data().users as string[];
      return users.includes(recipientId);
    });

    if (!friendDoc) {
      console.log("❌ [updateStreakOnMessage] Friendship not found");
      return;
    }

    console.log("✅ [updateStreakOnMessage] Found friendship:", friendDoc.id);

    const data = friendDoc.data();
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
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

    console.log("🔵 [updateStreakOnMessage] Current state:", {
      today,
      isUser1,
      currentLastSent,
      otherLastSent,
      streakUpdatedDay,
      streakCount,
    });

    // If user already sent today, no update needed
    if (currentLastSent === today) {
      console.log(
        "⏭️ [updateStreakOnMessage] User already sent today, skipping",
      );
      return;
    }

    const updates: any = {
      [lastSentField]: today,
    };

    // Check if this completes today's streak requirement
    const otherSentToday = otherLastSent === today;

    console.log("🔵 [updateStreakOnMessage] Checking streak conditions:", {
      otherSentToday,
      streakUpdatedDayNotToday: streakUpdatedDay !== today,
    });

    if (otherSentToday && streakUpdatedDay !== today) {
      // Both users have now sent today - update streak
      if (!streakUpdatedDay) {
        // First streak ever - start at 1
        streakCount = 1;
        console.log(
          "🆕 [updateStreakOnMessage] First streak started:",
          streakCount,
        );
      } else {
        // Check if streak continues from yesterday
        const lastUpdate = new Date(streakUpdatedDay);
        const todayDate = new Date(today);
        const daysDiff = Math.floor(
          (todayDate.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24),
        );

        console.log(
          "🔵 [updateStreakOnMessage] Days since last update:",
          daysDiff,
        );

        if (daysDiff <= 1) {
          // Streak continues (today or yesterday)
          streakCount += 1;
          console.log(
            "🔥 [updateStreakOnMessage] Streak continues:",
            streakCount,
          );
        } else {
          // Streak broken, start fresh
          streakCount = 1;
          console.log(
            "💔➡️🆕 [updateStreakOnMessage] Streak broken, restarting:",
            streakCount,
          );
        }
      }

      updates.streakCount = streakCount;
      updates.streakUpdatedDay = today;
    } else if (!otherSentToday) {
      // Check if streak needs reset
      const lastUpdate = new Date(streakUpdatedDay || "2000-01-01");
      const todayDate = new Date(today);
      const daysDiff = Math.floor(
        (todayDate.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff > 1 && streakCount > 0) {
        console.log("💔 [updateStreakOnMessage] Streak broken, resetting");
        updates.streakCount = 0;
      } else {
        console.log(
          "⏳ [updateStreakOnMessage] Waiting for other user to send",
        );
      }
    }

    console.log("🔵 [updateStreakOnMessage] Applying updates:", updates);
    await friendDoc.ref.update(updates);
    console.log(
      "✅ [updateStreakOnMessage] Streak updated for friendship:",
      friendDoc.id,
    );

    // Check for milestone and award cosmetics
    if (updates.streakCount) {
      const milestones = [3, 7, 14, 30, 50, 100, 365];
      console.log(
        "🔵 [updateStreakOnMessage] Checking milestone:",
        updates.streakCount,
        "Valid milestones:",
        milestones,
      );
      if (milestones.includes(updates.streakCount)) {
        console.log(
          "🎉 [updateStreakOnMessage] MILESTONE REACHED!",
          updates.streakCount,
          "days",
        );
        // Send notifications and award cosmetics
        await sendStreakMilestoneNotification(
          senderId,
          recipientId,
          updates.streakCount,
        );
        // Grant cosmetic rewards to both users
        await grantMilestoneCosmetic(senderId, updates.streakCount);
        await grantMilestoneCosmetic(recipientId, updates.streakCount);
        console.log("✅ [updateStreakOnMessage] Milestone rewards granted!");
      } else {
        console.log(
          "ℹ️ [updateStreakOnMessage] Not a milestone day. Next milestone:",
          milestones.find((m) => m > updates.streakCount) || "none",
        );
      }
    }
  } catch (error) {
    console.error("❌ [updateStreakOnMessage] Error:", error);
  }
}

/**
 * Send notification when streak milestone is reached
 */
async function sendStreakMilestoneNotification(
  user1Id: string,
  user2Id: string,
  milestone: number,
): Promise<void> {
  const messages: Record<number, string> = {
    3: "🔥 3-day streak! You're on fire!",
    7: "🔥 1 week streak! Amazing!",
    14: "🔥 2 week streak! Incredible!",
    30: "🔥 30-day streak! One month strong!",
    50: "🔥 50-day streak! Legendary!",
    100: "💯 100-day streak! Champion!",
    365: "🏆 365-day streak! One whole year!",
  };

  const body = messages[milestone] || `🔥 ${milestone}-day streak!`;

  // Notify both users
  for (const userId of [user1Id, user2Id]) {
    const token = await getUserPushToken(userId);
    if (token) {
      await sendExpoPushNotification({
        to: token,
        title: "Streak Milestone! 🎉",
        body,
        data: { type: "streak_milestone", milestone },
        sound: "default",
      });
    }
  }
}

// ============================================
// COSMETICS REWARDS
// ============================================

/**
 * Mapping of streak milestones to cosmetic item IDs
 */
const MILESTONE_COSMETICS: Record<number, string> = {
  3: "hat_flame",
  7: "glasses_cool",
  14: "bg_gradient",
  30: "hat_crown",
  50: "glasses_star",
  100: "bg_rainbow",
  365: "hat_legendary",
};

/**
 * Cosmetic item names for notifications
 */
const COSMETIC_NAMES: Record<string, string> = {
  hat_flame: "Flame Cap 🔥",
  glasses_cool: "Cool Shades 😎",
  bg_gradient: "Gradient Glow ✨",
  hat_crown: "Golden Crown 👑",
  glasses_star: "Star Glasses 🤩",
  bg_rainbow: "Rainbow Burst 🌈",
  hat_legendary: "Legendary Halo 😇",
};

/**
 * Grant a cosmetic item to a user when they reach a streak milestone
 */
async function grantMilestoneCosmetic(
  userId: string,
  milestone: number,
): Promise<void> {
  try {
    const itemId = MILESTONE_COSMETICS[milestone];
    if (!itemId) {
      console.log(`No cosmetic reward for milestone ${milestone}`);
      return;
    }

    // Check if user already has this item
    const inventoryRef = db
      .collection("Users")
      .doc(userId)
      .collection("inventory")
      .doc(itemId);
    const existingItem = await inventoryRef.get();

    if (existingItem.exists) {
      console.log(`User ${userId} already has item ${itemId}`);
      return;
    }

    // Grant the item
    await inventoryRef.set({
      itemId,
      acquiredAt: Date.now(),
    });

    console.log(
      `🎁 Granted ${itemId} to user ${userId} for ${milestone}-day streak`,
    );

    // Send notification about new cosmetic
    const itemName = COSMETIC_NAMES[itemId] || itemId;
    const pushToken = await getUserPushToken(userId);

    if (pushToken) {
      await sendExpoPushNotification({
        to: pushToken,
        title: "New Cosmetic Unlocked! 🎁",
        body: `You earned ${itemName} for your ${milestone}-day streak!`,
        data: { type: "cosmetic_unlock", itemId, milestone },
        sound: "default",
      });
    }
  } catch (error) {
    console.error(`❌ Error granting cosmetic to ${userId}:`, error);
  }
}

/**
 * onNewFriendRequest: Notify user when they receive a friend request
 */
export const onNewFriendRequest = functions.firestore
  .document("FriendRequests/{requestId}")
  .onCreate(async (snap) => {
    const request = snap.data();

    try {
      const recipientId = request.to;
      const senderId = request.from;

      // Get sender's display name
      const senderDoc = await db.collection("Users").doc(senderId).get();
      const senderName = senderDoc.exists
        ? senderDoc.data()?.displayName || "Someone"
        : "Someone";

      // Get recipient's push token
      const pushToken = await getUserPushToken(recipientId);

      if (pushToken) {
        await sendExpoPushNotification({
          to: pushToken,
          title: "New Friend Request! 👋",
          body: `${senderName} wants to be your friend`,
          data: {
            type: "friend_request",
            requestId: snap.id,
            senderId,
          },
          sound: "default",
        });

        console.log(`✅ Sent friend request notification to ${recipientId}`);
      }
    } catch (error) {
      console.error("❌ Error in onNewFriendRequest:", error);
    }
  });

/**
 * onStoryViewed: Notify story author when their story is viewed
 */
export const onStoryViewed = functions.firestore
  .document("stories/{storyId}/views/{viewerId}")
  .onCreate(async (snap, context) => {
    const { storyId, viewerId } = context.params;

    try {
      // Get story to find author
      const storyDoc = await db.collection("stories").doc(storyId).get();
      if (!storyDoc.exists) return;

      const story = storyDoc.data()!;
      const authorId = story.authorId;

      // Don't notify if viewing own story
      if (authorId === viewerId) return;

      // Get viewer's display name
      const viewerDoc = await db.collection("Users").doc(viewerId).get();
      const viewerName = viewerDoc.exists
        ? viewerDoc.data()?.displayName || "Someone"
        : "Someone";

      // Get author's push token
      const pushToken = await getUserPushToken(authorId);

      if (pushToken) {
        await sendExpoPushNotification({
          to: pushToken,
          title: "Story Viewed! 👀",
          body: `${viewerName} viewed your story`,
          data: {
            type: "story_view",
            storyId,
            viewerId,
          },
          sound: "default",
        });

        console.log(`✅ Sent story view notification to ${authorId}`);
      }
    } catch (error) {
      console.error("❌ Error in onStoryViewed:", error);
    }
  });

/**
 * streakReminder: Daily check for at-risk streaks
 * Runs at 8 PM UTC to remind users whose streaks are at risk
 */
export const streakReminder = functions.pubsub
  .schedule("0 20 * * *") // 8 PM UTC daily
  .timeZone("UTC")
  .onRun(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Find all friendships with active streaks
      const friendsRef = db.collection("Friends");
      const activeStreaks = await friendsRef.where("streakCount", ">", 0).get();

      console.log(`Checking ${activeStreaks.docs.length} active streaks`);

      for (const doc of activeStreaks.docs) {
        const data = doc.data();
        const [uid1, uid2] = data.users;
        const lastSent1 = data.lastSentDay_uid1 || "";
        const lastSent2 = data.lastSentDay_uid2 || "";

        // Check if only one user has sent today (streak at risk)
        const user1SentToday = lastSent1 === today;
        const user2SentToday = lastSent2 === today;

        if (user1SentToday !== user2SentToday) {
          // Streak is at risk - notify the user who hasn't sent
          const userToNotify = user1SentToday ? uid2 : uid1;
          const token = await getUserPushToken(userToNotify);

          if (token) {
            await sendExpoPushNotification({
              to: token,
              title: "Streak at Risk! ⚠️",
              body: `Your ${data.streakCount}-day streak is about to end! Send a message to keep it going.`,
              data: {
                type: "streak_reminder",
                friendshipId: doc.id,
                streakCount: data.streakCount,
              },
              sound: "default",
            });

            console.log(`✅ Sent streak reminder to ${userToNotify}`);
          }
        }
      }

      console.log("✅ Streak reminder check complete");
      return;
    } catch (error) {
      console.error("❌ Error in streakReminder:", error);
      throw error;
    }
  });

/**
 * onDeleteMessage: Triggered when a message document is deleted
 * Cleans up associated Storage object if it's an image snap
 *
 * This provides redundant cleanup for snaps deleted via view-once flow
 * If the client-side deletion fails, this Cloud Function ensures cleanup
 */
export const onDeleteMessage = functions.firestore
  .document("Chats/{chatId}/Messages/{messageId}")
  .onDelete(async (snap, context) => {
    const message = snap.data();
    const { chatId } = context.params;

    // Only process image messages (snaps)
    if (message.type !== "image") {
      return;
    }

    const storagePath = message.content; // e.g., "snaps/chatId/messageId.jpg"

    try {
      // Delete the Storage file
      const bucket = storage.bucket();
      await bucket.file(storagePath).delete();
      console.log(`✅ Deleted storage file: ${storagePath}`);
    } catch (error: any) {
      // File may already be deleted or not exist; only log non-404 errors
      if (error.code !== "storage/object-not-found" && error.code !== 404) {
        console.error(
          `⚠️ Error deleting storage file ${storagePath}:`,
          error.message,
        );
      }
    }
  });

/**
 * cleanupExpiredSnaps: Scheduled function to clean up expired snaps from Storage
 * Runs daily to remove any snaps that weren't deleted by TTL
 *
 * This is a safety net for snaps that:
 * - Weren't viewed (message TTL expires, but Storage file may persist)
 * - Failed to delete due to errors
 *
 * Future enhancement: Query Messages with expiresAt < now and delete their storage
 */
export const cleanupExpiredSnaps = functions.pubsub
  .schedule("0 2 * * *") // 2 AM UTC daily
  .timeZone("UTC")
  .onRun(async () => {
    try {
      // Query all messages with expiresAt in the past
      const now = admin.firestore.Timestamp.now();
      const messagesRef = db.collectionGroup("Messages");
      const expiredQuery = await messagesRef.where("expiresAt", "<", now).get();

      console.log(`Found ${expiredQuery.docs.length} expired messages`);

      // Batch delete expired messages and their storage files
      const batch = db.batch();
      let deletedCount = 0;

      for (const doc of expiredQuery.docs) {
        const message = doc.data();

        // If it's an image snap, delete the Storage file
        if (message.type === "image" && message.content) {
          try {
            const bucket = storage.bucket();
            await bucket.file(message.content).delete();
            console.log(`Deleted expired snap: ${message.content}`);
          } catch (error: any) {
            if (
              error.code !== 404 &&
              error.code !== "storage/object-not-found"
            ) {
              console.warn(
                `Failed to delete snap ${message.content}:`,
                error.message,
              );
            }
          }
        }

        // Delete the message document
        batch.delete(doc.ref);
        deletedCount++;

        // Firestore batch write limit is 500
        if (deletedCount % 500 === 0) {
          await batch.commit();
          console.log(`Committed batch of 500 deletes`);
        }
      }

      // Final commit
      if (deletedCount % 500 !== 0) {
        await batch.commit();
      }

      console.log(
        `✅ Cleanup complete: ${deletedCount} expired messages removed`,
      );
      return;
    } catch (error: any) {
      console.error("❌ Error in cleanupExpiredSnaps:", error);
      throw error;
    }
  });

/**
 * cleanupExpiredStories: Scheduled function to clean up expired stories
 * Runs daily at 2 AM UTC to remove stories past their 24h expiry
 *
 * For each expired story:
 * - Delete the storage file from Storage
 * - Delete the story document (views subcollection auto-deletes)
 *
 * This ensures stories expire even if TTL index isn't active
 */
export const cleanupExpiredStories = functions.pubsub
  .schedule("0 2 * * *") // 2 AM UTC daily (same as snap cleanup)
  .timeZone("UTC")
  .onRun(async () => {
    try {
      // Query all stories with expiresAt in the past
      const now = admin.firestore.Timestamp.now();
      const storiesRef = db.collection("stories");
      const expiredQuery = await storiesRef.where("expiresAt", "<", now).get();

      console.log(`Found ${expiredQuery.docs.length} expired stories`);

      const bucket = storage.bucket();
      let deletedCount = 0;

      // Process each expired story
      for (const doc of expiredQuery.docs) {
        const story = doc.data();
        const storagePath = story.storagePath; // e.g., "stories/authorId/storyId.jpg"

        try {
          // Delete the Storage file
          await bucket.file(storagePath).delete();
          console.log(`✅ Deleted expired story storage: ${storagePath}`);
        } catch (error: any) {
          // File may already be deleted; only log real errors
          if (error.code !== 404 && error.code !== "storage/object-not-found") {
            console.warn(
              `⚠️ Failed to delete story storage ${storagePath}:`,
              error.message,
            );
          }
        }

        // Delete the story document (views subcollection auto-deletes)
        await doc.ref.delete();
        deletedCount++;

        console.log(`✅ Deleted expired story document: ${doc.id}`);
      }

      console.log(
        `✅ Story cleanup complete: ${deletedCount} expired stories removed`,
      );
      return;
    } catch (error: any) {
      console.error("❌ Error in cleanupExpiredStories:", error);
      throw error;
    }
  });

// ============================================
// SCHEDULED MESSAGES
// ============================================

/**
 * processScheduledMessages: Runs every minute to check for scheduled messages
 * that are due to be sent and delivers them.
 */
export const processScheduledMessages = functions.pubsub
  .schedule("every 1 minutes")
  .timeZone("UTC")
  .onRun(async () => {
    try {
      const now = admin.firestore.Timestamp.now();
      console.log(
        `🕐 [ScheduledMessages] Processing at ${now.toDate().toISOString()}`,
      );
      console.log(
        `🕐 [ScheduledMessages] Current timestamp (ms): ${now.toMillis()}`,
      );

      // Query pending messages that are due (scheduledFor <= now)
      const scheduledRef = db.collection("ScheduledMessages");

      // First, let's check all pending messages to debug
      const allPending = await scheduledRef
        .where("status", "==", "pending")
        .get();

      console.log(
        `🔍 [ScheduledMessages] Total pending messages: ${allPending.docs.length}`,
      );

      if (allPending.docs.length > 0) {
        allPending.docs.forEach((doc) => {
          const data = doc.data();
          const scheduledFor = data.scheduledFor;
          console.log(`🔍 [ScheduledMessages] Pending message ${doc.id}:`, {
            scheduledFor:
              scheduledFor?.toDate?.()?.toISOString() || scheduledFor,
            scheduledForMs: scheduledFor?.toMillis?.() || scheduledFor,
            nowMs: now.toMillis(),
            isDue: scheduledFor?.toMillis?.() <= now.toMillis(),
          });
        });
      }

      const dueMessages = await scheduledRef
        .where("status", "==", "pending")
        .where("scheduledFor", "<=", now)
        .limit(100) // Process up to 100 messages per run
        .get();

      console.log(
        `📬 Found ${dueMessages.docs.length} scheduled messages to deliver`,
      );

      let sentCount = 0;
      let failedCount = 0;

      for (const doc of dueMessages.docs) {
        const scheduledMessage = doc.data();
        const messageId = doc.id;

        try {
          // Get the chat to verify it still exists
          const chatDoc = await db
            .collection("Chats")
            .doc(scheduledMessage.chatId)
            .get();

          if (!chatDoc.exists) {
            // Chat no longer exists, mark as failed
            await doc.ref.update({
              status: "failed",
              failReason: "Chat no longer exists",
            });
            failedCount++;
            console.log(`❌ Chat not found for scheduled message ${messageId}`);
            continue;
          }

          // Create the actual message in the chat
          const newMessageRef = db
            .collection("Chats")
            .doc(scheduledMessage.chatId)
            .collection("Messages")
            .doc();

          // Calculate expiry time (24 hours for text, 5 seconds for images)
          const expiryMs =
            scheduledMessage.type === "image"
              ? 5 * 1000 // 5 seconds for snaps
              : 24 * 60 * 60 * 1000; // 24 hours for text
          const expiresAt = admin.firestore.Timestamp.fromMillis(
            Date.now() + expiryMs,
          );

          const messageData: any = {
            id: newMessageRef.id,
            sender: scheduledMessage.senderId,
            content: scheduledMessage.content,
            type: scheduledMessage.type,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: expiresAt,
            read: false,
          };

          // If it's an image message, include the image URL
          if (scheduledMessage.type === "image" && scheduledMessage.imageUrl) {
            messageData.imageUrl = scheduledMessage.imageUrl;
          }

          // Create the message
          await newMessageRef.set(messageData);

          // Update the chat's lastMessage
          await db
            .collection("Chats")
            .doc(scheduledMessage.chatId)
            .update({
              lastMessage:
                scheduledMessage.type === "image"
                  ? "📸 Picture"
                  : scheduledMessage.content,
              lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            });

          // Mark scheduled message as sent
          await doc.ref.update({
            status: "sent",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          sentCount++;
          console.log(
            `✅ Delivered scheduled message ${messageId} to chat ${scheduledMessage.chatId}`,
          );
        } catch (error: any) {
          // Mark as failed with reason
          await doc.ref.update({
            status: "failed",
            failReason: error.message || "Unknown error",
          });
          failedCount++;
          console.error(
            `❌ Failed to deliver scheduled message ${messageId}:`,
            error,
          );
        }
      }

      console.log(
        `✅ Scheduled messages processing complete: ${sentCount} sent, ${failedCount} failed`,
      );
      return;
    } catch (error: any) {
      console.error("❌ Error in processScheduledMessages:", error);
      throw error;
    }
  });

/**
 * onScheduledMessageCreated: Triggered when a new scheduled message is created
 * Can be used for additional validation or logging
 */
export const onScheduledMessageCreated = functions.firestore
  .document("ScheduledMessages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { messageId } = context.params;

    console.log(`📅 New scheduled message created: ${messageId}`);
    console.log(`   Sender: ${message.senderId}`);
    console.log(`   Chat: ${message.chatId}`);
    console.log(
      `   Scheduled for: ${message.scheduledFor?.toDate?.()?.toISOString() || "unknown"}`,
    );

    return;
  });

/**
 * cleanupOldScheduledMessages: Runs daily to clean up old sent/cancelled/failed messages
 * Keeps scheduled messages for 30 days after they've been processed
 */
export const cleanupOldScheduledMessages = functions.pubsub
  .schedule("0 3 * * *") // 3 AM UTC daily
  .timeZone("UTC")
  .onRun(async () => {
    try {
      // Calculate 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

      console.log(
        `🧹 Cleaning up scheduled messages older than ${thirtyDaysAgo.toISOString()}`,
      );

      const scheduledRef = db.collection("ScheduledMessages");

      // Delete old sent messages
      const oldSent = await scheduledRef
        .where("status", "==", "sent")
        .where("sentAt", "<", cutoffTimestamp)
        .limit(500)
        .get();

      // Delete old cancelled messages
      const oldCancelled = await scheduledRef
        .where("status", "==", "cancelled")
        .where("createdAt", "<", cutoffTimestamp)
        .limit(500)
        .get();

      // Delete old failed messages
      const oldFailed = await scheduledRef
        .where("status", "==", "failed")
        .where("createdAt", "<", cutoffTimestamp)
        .limit(500)
        .get();

      const allDocs = [
        ...oldSent.docs,
        ...oldCancelled.docs,
        ...oldFailed.docs,
      ];
      console.log(`Found ${allDocs.length} old scheduled messages to clean up`);

      let deletedCount = 0;
      for (const doc of allDocs) {
        await doc.ref.delete();
        deletedCount++;
      }

      console.log(
        `✅ Scheduled message cleanup complete: ${deletedCount} messages removed`,
      );
      return;
    } catch (error: any) {
      console.error("❌ Error in cleanupOldScheduledMessages:", error);
      throw error;
    }
  });

// ============================================
// LEADERBOARDS + ACHIEVEMENTS
// ============================================

/**
 * Helper: Get current ISO week key (e.g., "2026-W03")
 */
function getCurrentWeekKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const days = Math.floor(
    (now.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000),
  );
  const weekNum = Math.ceil((days + oneJan.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Helper: Validate game score bounds (anti-cheat)
 */
function isValidScore(
  gameId: string,
  score: number,
): { valid: boolean; reason?: string } {
  if (gameId === "reaction_tap") {
    // Reaction time: 100ms - 2000ms is valid
    if (score < 100) {
      return {
        valid: false,
        reason: "Reaction time too fast (likely cheating)",
      };
    }
    if (score > 2000) {
      return { valid: false, reason: "Reaction time too slow" };
    }
  } else if (gameId === "timed_tap") {
    // Taps in 10 seconds: 1 - 200 is valid
    if (score < 1) {
      return { valid: false, reason: "Invalid tap count" };
    }
    if (score > 200) {
      return { valid: false, reason: "Tap count too high (likely cheating)" };
    }
  } else {
    return { valid: false, reason: "Unknown game type" };
  }
  return { valid: true };
}

/**
 * onGameSessionCreated: Triggered when a new game session is recorded
 * Updates leaderboard and checks for achievements
 */
export const onGameSessionCreated = functions.firestore
  .document("GameSessions/{sessionId}")
  .onCreate(async (snap, context) => {
    const session = snap.data();
    const { sessionId } = context.params;

    try {
      console.log(`🎮 New game session: ${sessionId}`);
      console.log(`   Player: ${session.playerId}`);
      console.log(`   Game: ${session.gameId}`);
      console.log(`   Score: ${session.score}`);

      // Validate score
      const validation = isValidScore(session.gameId, session.score);
      if (!validation.valid) {
        console.log(`❌ Invalid score: ${validation.reason}`);
        // Mark session as invalid but don't delete (for review)
        await snap.ref.update({
          invalid: true,
          invalidReason: validation.reason,
        });
        return;
      }

      // Get player info
      const playerDoc = await db
        .collection("Users")
        .doc(session.playerId)
        .get();
      if (!playerDoc.exists) {
        console.log("❌ Player not found");
        return;
      }
      const player = playerDoc.data()!;

      // Update weekly leaderboard
      const weekKey = getCurrentWeekKey();
      const leaderboardId = `${session.gameId}_${weekKey}`;
      const entryRef = db
        .collection("Leaderboards")
        .doc(leaderboardId)
        .collection("Entries")
        .doc(session.playerId);

      const existingEntry = await entryRef.get();
      let shouldUpdate = true;

      if (existingEntry.exists) {
        const existingScore = existingEntry.data()!.score;
        // For reaction_tap: lower is better
        // For timed_tap: higher is better
        if (session.gameId === "reaction_tap") {
          shouldUpdate = session.score < existingScore;
        } else {
          shouldUpdate = session.score > existingScore;
        }
      }

      if (shouldUpdate) {
        await entryRef.set({
          uid: session.playerId,
          displayName: player.displayName,
          avatarConfig: player.avatarConfig,
          score: session.score,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`✅ Updated leaderboard entry for ${session.playerId}`);
      } else {
        console.log(
          "⏭️ Score not better than existing, skipping leaderboard update",
        );
      }

      // Check for achievements
      await checkGameAchievements(
        session.playerId,
        session.gameId,
        session.score,
      );

      return;
    } catch (error) {
      console.error("❌ Error in onGameSessionCreated:", error);
    }
  });

/**
 * Helper: Check and grant game achievements
 */
async function checkGameAchievements(
  playerId: string,
  gameId: string,
  score: number,
): Promise<void> {
  try {
    // Count total game sessions for this player
    const sessionsQuery = await db
      .collection("GameSessions")
      .where("playerId", "==", playerId)
      .get();
    const totalGames = sessionsQuery.size;

    const achievementsRef = db
      .collection("Users")
      .doc(playerId)
      .collection("Achievements");

    // First game achievement
    if (totalGames === 1) {
      await grantAchievementIfNotEarned(achievementsRef, "game_first_play", {
        gameId,
      });
    }

    // Session count achievements
    if (totalGames >= 10) {
      await grantAchievementIfNotEarned(achievementsRef, "game_10_sessions");
    }
    if (totalGames >= 50) {
      await grantAchievementIfNotEarned(achievementsRef, "game_50_sessions");
    }

    // Game-specific achievements
    if (gameId === "reaction_tap" && score < 200) {
      await grantAchievementIfNotEarned(
        achievementsRef,
        "game_reaction_master",
        {
          score,
          gameId,
        },
      );
    }
    if (gameId === "timed_tap" && score >= 100) {
      await grantAchievementIfNotEarned(achievementsRef, "game_speed_demon", {
        score,
        gameId,
      });
    }
  } catch (error) {
    console.error("❌ Error checking game achievements:", error);
  }
}

/**
 * Helper: Grant achievement if not already earned
 */
async function grantAchievementIfNotEarned(
  achievementsRef: admin.firestore.CollectionReference,
  achievementType: string,
  meta?: Record<string, any>,
): Promise<boolean> {
  const achievementRef = achievementsRef.doc(achievementType);
  const existing = await achievementRef.get();

  if (existing.exists) {
    console.log(`⏭️ Achievement ${achievementType} already earned`);
    return false;
  }

  await achievementRef.set({
    type: achievementType,
    earnedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(meta && { meta }),
  });

  console.log(`🏆 Granted achievement: ${achievementType}`);
  return true;
}

/**
 * onStreakUpdated: Check for streak achievements when streak changes
 * This extends the existing streak update logic
 */
export const onStreakAchievementCheck = functions.firestore
  .document("Friends/{friendId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only check if streakCount increased
    if (after.streakCount <= before.streakCount) {
      return;
    }

    const streakCount = after.streakCount;
    const users = after.users as string[];

    console.log(
      `🔥 Streak updated to ${streakCount} between ${users.join(" and ")}`,
    );

    // Check streak achievements for both users
    const thresholds: [number, string][] = [
      [3, "streak_3_days"],
      [7, "streak_7_days"],
      [30, "streak_30_days"],
      [100, "streak_100_days"],
    ];

    for (const userId of users) {
      const achievementsRef = db
        .collection("Users")
        .doc(userId)
        .collection("Achievements");

      for (const [threshold, achievementType] of thresholds) {
        if (streakCount >= threshold) {
          await grantAchievementIfNotEarned(achievementsRef, achievementType, {
            streakCount,
          });
        }
      }
    }
  });

/**
 * Weekly leaderboard reset notification (optional)
 * Runs Monday at 00:00 UTC to notify top players from previous week
 */
export const weeklyLeaderboardReset = functions.pubsub
  .schedule("0 0 * * 1") // Every Monday at 00:00 UTC
  .timeZone("UTC")
  .onRun(async () => {
    console.log("🏆 Weekly leaderboard reset - new week started");
    // This function can be extended to:
    // - Send notifications to top players
    // - Archive previous week's results
    // - Generate weekly summary stats
    return;
  });

// ============================================
// ECONOMY + WALLET + TASKS
// ============================================

/** Default starting tokens for new users */
const DEFAULT_STARTING_TOKENS = 100;

/** Default timezone for day calculations */
const DEFAULT_TIMEZONE = "America/Indiana/Indianapolis";

/**
 * Helper to get current day key in timezone
 */
function getCurrentDayKey(timezone = DEFAULT_TIMEZONE): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

/**
 * Initialize wallet when new user is created
 * Grants starting tokens to new users
 */
export const onUserCreated = functions.firestore
  .document("Users/{uid}")
  .onCreate(async (snap, context) => {
    const { uid } = context.params;
    const userData = snap.data();

    console.log(`👤 New user created: ${uid} (${userData.displayName})`);

    try {
      // Create wallet with starting balance
      const walletRef = db.collection("Wallets").doc(uid);
      const walletDoc = await walletRef.get();

      if (!walletDoc.exists) {
        await walletRef.set({
          uid,
          tokensBalance: DEFAULT_STARTING_TOKENS,
          totalEarned: DEFAULT_STARTING_TOKENS,
          totalSpent: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create transaction record for starting bonus
        await db.collection("Transactions").add({
          uid,
          type: "earn",
          amount: DEFAULT_STARTING_TOKENS,
          reason: "daily_bonus",
          description: "Welcome bonus!",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `💰 Created wallet for ${uid} with ${DEFAULT_STARTING_TOKENS} starting tokens`,
        );
      }
    } catch (error) {
      console.error(`❌ Error creating wallet for ${uid}:`, error);
    }
  });

/**
 * claimTaskReward: Callable function to claim reward for completed task
 * Validates completion, prevents double claims, awards tokens atomically
 */
export const claimTaskReward = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated",
    );
  }

  const uid = context.auth.uid;
  const { taskId, dayKey } = data;

  // Enhanced input validation (Security)
  if (!isValidString(taskId, 1, 100)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid taskId format",
    );
  }

  if (!isValidString(dayKey, 8, 15)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid dayKey format",
    );
  }

  console.log(
    `🎯 [claimTaskReward] User ${sanitizeForLog(uid)} claiming task ${sanitizeForLog(taskId)} for day ${sanitizeForLog(dayKey)}`,
  );

  try {
    // Get task definition
    const taskRef = db.collection("Tasks").doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Task not found");
    }

    const task = taskDoc.data()!;

    if (!task.active) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Task is not active",
      );
    }

    // Check availability window
    const now = Date.now();
    if (task.availableFrom && now < task.availableFrom.toMillis()) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Task not yet available",
      );
    }
    if (task.availableTo && now > task.availableTo.toMillis()) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Task has expired",
      );
    }

    // Get user's progress for this task
    const progressRef = db
      .collection("Users")
      .doc(uid)
      .collection("TaskProgress")
      .doc(taskId);
    const progressDoc = await progressRef.get();

    if (!progressDoc.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No progress found for this task",
      );
    }

    const progress = progressDoc.data()!;

    // Verify dayKey matches (for daily tasks)
    if (task.cadence === "daily" && progress.dayKey !== dayKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Progress is from a different day",
      );
    }

    // Check if already claimed
    if (progress.claimed) {
      throw new functions.https.HttpsError(
        "already-exists",
        "Reward already claimed",
      );
    }

    // Check if task is completed
    if (progress.progress < task.target) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Task not completed: ${progress.progress}/${task.target}`,
      );
    }

    // All checks passed - award reward atomically
    const batch = db.batch();

    // 1. Mark progress as claimed
    batch.update(progressRef, {
      claimed: true,
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Award tokens
    const tokensAwarded = task.rewardTokens || 0;
    if (tokensAwarded > 0) {
      const walletRef = db.collection("Wallets").doc(uid);
      batch.update(walletRef, {
        tokensBalance: admin.firestore.FieldValue.increment(tokensAwarded),
        totalEarned: admin.firestore.FieldValue.increment(tokensAwarded),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create transaction record
      const txRef = db.collection("Transactions").doc();
      batch.set(txRef, {
        uid,
        type: "earn",
        amount: tokensAwarded,
        reason: "task_reward",
        refId: taskId,
        refType: "task",
        description: task.title,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // 3. Award cosmetic item if specified
    let itemAwarded: string | undefined;
    if (task.rewardItemId) {
      const inventoryRef = db
        .collection("Users")
        .doc(uid)
        .collection("inventory")
        .doc(task.rewardItemId);

      // Check if user already has this item
      const existingItem = await inventoryRef.get();
      if (!existingItem.exists) {
        batch.set(inventoryRef, {
          itemId: task.rewardItemId,
          acquiredAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        itemAwarded = task.rewardItemId;
      }
    }

    await batch.commit();

    console.log(
      `✅ [claimTaskReward] Awarded ${tokensAwarded} tokens to ${uid} for completing ${taskId}`,
    );

    return {
      success: true,
      tokensAwarded,
      itemAwarded,
    };
  } catch (error: any) {
    console.error(`❌ [claimTaskReward] Error:`, error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to claim reward",
    );
  }
});

/**
 * Helper to update task progress atomically
 */
async function updateTaskProgress(
  uid: string,
  taskType: string,
  incrementBy: number = 1,
): Promise<void> {
  const dayKey = getCurrentDayKey();

  // Find active tasks of this type
  const tasksRef = db.collection("Tasks");
  const tasksQuery = await tasksRef
    .where("active", "==", true)
    .where("type", "==", taskType)
    .get();

  if (tasksQuery.empty) {
    return;
  }

  const batch = db.batch();

  for (const taskDoc of tasksQuery.docs) {
    const task = taskDoc.data();
    const taskId = taskDoc.id;

    // Get or create progress document
    const progressRef = db
      .collection("Users")
      .doc(uid)
      .collection("TaskProgress")
      .doc(taskId);

    const progressDoc = await progressRef.get();

    if (!progressDoc.exists) {
      // Create new progress
      batch.set(progressRef, {
        taskId,
        progress: incrementBy,
        claimed: false,
        dayKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const progress = progressDoc.data()!;

      // For daily tasks, reset if it's a new day
      if (task.cadence === "daily" && progress.dayKey !== dayKey) {
        batch.set(progressRef, {
          taskId,
          progress: incrementBy,
          claimed: false,
          dayKey,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (!progress.claimed) {
        // Increment existing progress (only if not already claimed)
        batch.update(progressRef, {
          progress: admin.firestore.FieldValue.increment(incrementBy),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }

  await batch.commit();
  console.log(
    `📈 [updateTaskProgress] Updated ${taskType} progress for ${uid}`,
  );
}

/**
 * Update task progress when message is sent
 */
export const onMessageSentTaskProgress = functions.firestore
  .document("Chats/{chatId}/Messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const senderId = message.sender;

    try {
      // Update "send_message" tasks
      await updateTaskProgress(senderId, "send_message");

      // If it's an image message, also update "send_snap" tasks
      if (message.type === "image") {
        await updateTaskProgress(senderId, "send_snap");
      }
    } catch (error) {
      console.error("❌ [onMessageSentTaskProgress] Error:", error);
    }
  });

/**
 * Update task progress when story is viewed
 */
export const onStoryViewedTaskProgress = functions.firestore
  .document("stories/{storyId}/views/{userId}")
  .onCreate(async (snap, context) => {
    const { userId } = context.params;

    try {
      // Update "view_story" tasks for the viewer
      await updateTaskProgress(userId, "view_story");
    } catch (error) {
      console.error("❌ [onStoryViewedTaskProgress] Error:", error);
    }
  });

/**
 * Update task progress when story is posted
 */
export const onStoryPostedTaskProgress = functions.firestore
  .document("stories/{storyId}")
  .onCreate(async (snap, context) => {
    const story = snap.data();
    const authorId = story.authorId;

    try {
      // Update "post_story" tasks for the author
      await updateTaskProgress(authorId, "post_story");
    } catch (error) {
      console.error("❌ [onStoryPostedTaskProgress] Error:", error);
    }
  });

/**
 * Update task progress when game is played
 * Note: This extends the existing onGameSessionCreated functionality
 */
export const onGamePlayedTaskProgress = functions.firestore
  .document("GameSessions/{sessionId}")
  .onCreate(async (snap, context) => {
    const session = snap.data();
    const playerId = session.playerId;
    const score = session.score;
    const gameId = session.gameId;

    try {
      // Update "play_game" tasks
      await updateTaskProgress(playerId, "play_game");

      // For "win_game" tasks, check if score meets threshold
      // This requires checking the task definition for the threshold
      const winTasksQuery = await db
        .collection("Tasks")
        .where("active", "==", true)
        .where("type", "==", "win_game")
        .get();

      for (const taskDoc of winTasksQuery.docs) {
        const task = taskDoc.data();
        // For reaction_tap, lower score is better (reaction time in ms)
        // For timed_tap, higher score is better (tap count)
        let isWin = false;

        if (gameId === "reaction_tap") {
          // Win if reaction time is under 300ms
          isWin = score <= 300;
        } else if (gameId === "timed_tap") {
          // Win if tap count is over 50
          isWin = score >= 50;
        }

        if (isWin) {
          await updateTaskProgress(playerId, "win_game");
          break; // Only count once per game session
        }
      }
    } catch (error) {
      console.error("❌ [onGamePlayedTaskProgress] Error:", error);
    }
  });

/**
 * Update task progress when friend is added
 */
export const onFriendAddedTaskProgress = functions.firestore
  .document("Friends/{friendId}")
  .onCreate(async (snap, context) => {
    const friend = snap.data();
    const users = friend.users as string[];

    try {
      // Update "add_friend" tasks for both users
      for (const userId of users) {
        await updateTaskProgress(userId, "add_friend");
      }
    } catch (error) {
      console.error("❌ [onFriendAddedTaskProgress] Error:", error);
    }
  });

/**
 * Daily login task trigger
 * This is called when user opens app (client-side via callable)
 */
export const recordDailyLogin = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated",
      );
    }

    const uid = context.auth.uid;

    try {
      await updateTaskProgress(uid, "login");
      return { success: true };
    } catch (error: any) {
      console.error("❌ [recordDailyLogin] Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        error.message || "Failed to record login",
      );
    }
  },
);

/**
 * Seed initial daily tasks (run once via admin or console)
 * This creates default task definitions
 */
export const seedDailyTasks = functions.https.onRequest(async (req, res) => {
  // Only allow from admin/localhost in development
  // In production, this should be protected or removed

  const defaultTasks = [
    {
      id: "daily_send_5_messages",
      title: "Social Butterfly",
      description: "Send 5 messages to friends",
      icon: "message-text",
      cadence: "daily",
      type: "send_message",
      target: 5,
      rewardTokens: 10,
      active: true,
      sortOrder: 1,
    },
    {
      id: "daily_send_3_pictures",
      title: "Picture Perfect",
      description: "Send 3 pictures to friends",
      icon: "camera",
      cadence: "daily",
      type: "send_snap",
      target: 3,
      rewardTokens: 15,
      active: true,
      sortOrder: 2,
    },
    {
      id: "daily_view_5_stories",
      title: "Story Explorer",
      description: "View 5 stories from friends",
      icon: "eye",
      cadence: "daily",
      type: "view_story",
      target: 5,
      rewardTokens: 10,
      active: true,
      sortOrder: 3,
    },
    {
      id: "daily_post_story",
      title: "Story Time",
      description: "Post a story",
      icon: "image-plus",
      cadence: "daily",
      type: "post_story",
      target: 1,
      rewardTokens: 20,
      active: true,
      sortOrder: 4,
    },
    {
      id: "daily_play_game",
      title: "Game On",
      description: "Play a game",
      icon: "gamepad-variant",
      cadence: "daily",
      type: "play_game",
      target: 1,
      rewardTokens: 15,
      active: true,
      sortOrder: 5,
    },
    {
      id: "daily_win_game",
      title: "Champion",
      description: "Win a game (under 300ms reaction or 50+ taps)",
      icon: "trophy",
      cadence: "daily",
      type: "win_game",
      target: 1,
      rewardTokens: 25,
      active: true,
      sortOrder: 6,
    },
    {
      id: "daily_login",
      title: "Daily Check-In",
      description: "Open the app today",
      icon: "login",
      cadence: "daily",
      type: "login",
      target: 1,
      rewardTokens: 5,
      active: true,
      sortOrder: 0,
    },
  ];

  const batch = db.batch();

  for (const task of defaultTasks) {
    const taskRef = db.collection("Tasks").doc(task.id);
    batch.set(taskRef, {
      ...task,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  console.log(`✅ Seeded ${defaultTasks.length} daily tasks`);
  res.json({ success: true, tasksCreated: defaultTasks.length });
});

/**
 * Initialize wallet for existing users who don't have one
 * Run once via admin to migrate existing users
 */
export const initializeExistingWallets = functions.https.onRequest(
  async (req, res) => {
    // This is an admin function - should be protected in production

    try {
      const usersSnapshot = await db.collection("Users").get();
      let created = 0;
      let skipped = 0;

      for (const userDoc of usersSnapshot.docs) {
        const uid = userDoc.id;
        const walletRef = db.collection("Wallets").doc(uid);
        const walletDoc = await walletRef.get();

        if (!walletDoc.exists) {
          await walletRef.set({
            uid,
            tokensBalance: DEFAULT_STARTING_TOKENS,
            totalEarned: DEFAULT_STARTING_TOKENS,
            totalSpent: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Create transaction record
          await db.collection("Transactions").add({
            uid,
            type: "earn",
            amount: DEFAULT_STARTING_TOKENS,
            reason: "daily_bonus",
            description: "Welcome bonus!",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          created++;
        } else {
          skipped++;
        }
      }

      console.log(
        `✅ Initialized wallets: ${created} created, ${skipped} skipped`,
      );
      res.json({ success: true, created, skipped });
    } catch (error: any) {
      console.error("❌ Error initializing wallets:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// ============================================
// SHOP + LIMITED-TIME DROPS
// ============================================

/**
 * Seed shop catalog with sample items (run once via admin)
 * Creates initial shop items for testing
 */
export const seedShopCatalog = functions.https.onRequest(
  async (req: functions.https.Request, res: functions.Response) => {
    // This is an admin function - should be protected in production

    // Sample shop items based on existing cosmetics
    const shopItems = [
      // Featured limited-time items
      {
        id: "shop_hat_crown",
        cosmeticId: "hat_crown",
        name: "Royal Crown",
        description: "Rule the chat with this majestic crown!",
        category: "featured",
        slot: "hat",
        priceTokens: 150,
        rarity: "legendary",
        imagePath: "👑",
        featured: true,
        availableFrom: Date.now(),
        availableTo: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        purchaseCount: 0,
        active: true,
        sortOrder: 1,
      },
      {
        id: "shop_bg_galaxy",
        cosmeticId: "bg_galaxy",
        name: "Galaxy Background",
        description: "A stunning cosmic background",
        category: "featured",
        slot: "background",
        priceTokens: 100,
        rarity: "epic",
        imagePath: "🌌",
        featured: true,
        availableFrom: Date.now(),
        availableTo: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days
        purchaseCount: 0,
        active: true,
        sortOrder: 2,
      },
      // Regular shop items - Hats
      {
        id: "shop_hat_cap",
        cosmeticId: "hat_cap",
        name: "Cool Cap",
        description: "A stylish cap for everyday wear",
        category: "hat",
        slot: "hat",
        priceTokens: 25,
        rarity: "common",
        imagePath: "🧢",
        featured: false,
        purchaseCount: 0,
        active: true,
        sortOrder: 10,
      },
      {
        id: "shop_hat_beanie",
        cosmeticId: "hat_beanie",
        name: "Cozy Beanie",
        description: "Stay warm and stylish",
        category: "hat",
        slot: "hat",
        priceTokens: 30,
        rarity: "common",
        imagePath: "🎿",
        featured: false,
        purchaseCount: 0,
        active: true,
        sortOrder: 11,
      },
      {
        id: "shop_hat_tophat",
        cosmeticId: "hat_tophat",
        name: "Top Hat",
        description: "For the distinguished avatar",
        category: "hat",
        slot: "hat",
        priceTokens: 50,
        rarity: "rare",
        imagePath: "🎩",
        featured: false,
        purchaseCount: 0,
        active: true,
        sortOrder: 12,
      },
      // Glasses
      {
        id: "shop_glasses_round",
        cosmeticId: "glasses_round",
        name: "Round Glasses",
        description: "Classic round frames",
        category: "glasses",
        slot: "glasses",
        priceTokens: 20,
        rarity: "common",
        imagePath: "👓",
        featured: false,
        purchaseCount: 0,
        active: true,
        sortOrder: 20,
      },
      {
        id: "shop_glasses_sunglasses",
        cosmeticId: "glasses_sunglasses",
        name: "Cool Sunglasses",
        description: "Block the haters",
        category: "glasses",
        slot: "glasses",
        priceTokens: 35,
        rarity: "rare",
        imagePath: "🕶️",
        featured: false,
        purchaseCount: 0,
        active: true,
        sortOrder: 21,
      },
      {
        id: "shop_glasses_vr",
        cosmeticId: "glasses_vr",
        name: "VR Headset",
        description: "Enter the metaverse in style",
        category: "glasses",
        slot: "glasses",
        priceTokens: 75,
        rarity: "epic",
        imagePath: "🥽",
        featured: false,
        purchaseCount: 0,
        active: true,
        sortOrder: 22,
      },
      // Backgrounds
      {
        id: "shop_bg_sunset",
        cosmeticId: "bg_sunset",
        name: "Sunset Vibes",
        description: "A beautiful sunset backdrop",
        category: "background",
        slot: "background",
        priceTokens: 40,
        rarity: "rare",
        imagePath: "🌅",
        featured: false,
        purchaseCount: 0,
        active: true,
        sortOrder: 30,
      },
      {
        id: "shop_bg_city",
        cosmeticId: "bg_city",
        name: "City Lights",
        description: "Urban cityscape at night",
        category: "background",
        slot: "background",
        priceTokens: 45,
        rarity: "rare",
        imagePath: "🌃",
        featured: false,
        purchaseCount: 0,
        active: true,
        sortOrder: 31,
      },
      {
        id: "shop_bg_neon",
        cosmeticId: "bg_neon",
        name: "Neon Dreams",
        description: "Vibrant neon aesthetic",
        category: "background",
        slot: "background",
        priceTokens: 60,
        rarity: "epic",
        imagePath: "💜",
        featured: false,
        purchaseCount: 0,
        active: true,
        sortOrder: 32,
      },
    ];

    const batch = db.batch();

    for (const item of shopItems) {
      const itemRef = db.collection("ShopCatalog").doc(item.id);
      batch.set(itemRef, {
        ...item,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    console.log(`✅ Seeded ${shopItems.length} shop items`);
    res.json({ success: true, itemsCreated: shopItems.length });
  },
);

// ============================================
// TRUST & SAFETY V1.5
// Rate Limiting, Bans, Strikes, Admin Moderation
// ============================================

/**
 * Rate limit configuration
 */
const RATE_LIMITS = {
  FRIEND_REQUESTS_PER_HOUR: 20,
  MESSAGES_PER_MINUTE: 30,
  REPORTS_PER_DAY: 10,
  GROUP_INVITES_PER_HOUR: 30,
};

/**
 * Strike thresholds for automatic bans
 */
const STRIKE_THRESHOLDS = {
  WARNING_AT: 1,
  TEMP_BAN_AT: 2, // 1 day ban
  LONG_BAN_AT: 3, // 1 week ban
  PERM_BAN_AT: 5, // Permanent ban
};

/**
 * Helper: Check if user is an admin
 */
async function isAdmin(
  context: functions.https.CallableContext,
): Promise<boolean> {
  if (!context.auth) return false;
  return context.auth.token.admin === true;
}

/**
 * Helper: Check rate limit for a user action
 * Returns true if action is allowed, false if rate limited
 */
async function checkRateLimit(
  uid: string,
  actionType: string,
  limitPerPeriod: number,
  periodMs: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const periodStart = now - periodMs;

  // Get rate limit doc
  const rateLimitRef = db.collection("RateLimits").doc(`${uid}_${actionType}`);
  const rateLimitDoc = await rateLimitRef.get();

  if (!rateLimitDoc.exists) {
    // First action, create tracking doc
    await rateLimitRef.set({
      uid,
      actionType,
      actions: [now],
      updatedAt: now,
    });
    return { allowed: true, remaining: limitPerPeriod - 1 };
  }

  const data = rateLimitDoc.data()!;
  const actions = (data.actions || []).filter((ts: number) => ts > periodStart);

  if (actions.length >= limitPerPeriod) {
    return { allowed: false, remaining: 0 };
  }

  // Add new action
  actions.push(now);
  await rateLimitRef.update({
    actions,
    updatedAt: now,
  });

  return { allowed: true, remaining: limitPerPeriod - actions.length };
}

/**
 * Rate-limited friend request creation
 * Validates rate limits server-side
 */
export const sendFriendRequestWithRateLimit = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const uid = context.auth.uid;
    const { toUid } = data;

    // Enhanced input validation (Security)
    if (!isValidUid(toUid)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid recipient ID",
      );
    }

    // Prevent self-friending
    if (toUid === uid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Cannot send friend request to yourself",
      );
    }

    // Check if sender is banned
    const banDoc = await db.collection("Bans").doc(uid).get();
    if (banDoc.exists) {
      const ban = banDoc.data()!;
      if (ban.status === "active") {
        if (ban.expiresAt === null || Date.now() < ban.expiresAt) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "Your account is currently restricted",
          );
        }
      }
    }

    // Check rate limit (20 per hour)
    const rateCheck = await checkRateLimit(
      uid,
      "friend_request",
      RATE_LIMITS.FRIEND_REQUESTS_PER_HOUR,
      60 * 60 * 1000, // 1 hour
    );

    if (!rateCheck.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Too many friend requests. Please wait before sending more.",
      );
    }

    console.log(
      `✅ Friend request rate check passed. Remaining: ${rateCheck.remaining}`,
    );
    return { allowed: true, remaining: rateCheck.remaining };
  },
);

/**
 * Rate-limited message sending check
 * Called before sending messages to enforce limits
 */
export const checkMessageRateLimit = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const uid = context.auth.uid;

    // Check if sender is banned
    const banDoc = await db.collection("Bans").doc(uid).get();
    if (banDoc.exists) {
      const ban = banDoc.data()!;
      if (ban.status === "active") {
        if (ban.expiresAt === null || Date.now() < ban.expiresAt) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "Your account is currently restricted",
          );
        }
      }
    }

    // Check rate limit (30 per minute)
    const rateCheck = await checkRateLimit(
      uid,
      "message",
      RATE_LIMITS.MESSAGES_PER_MINUTE,
      60 * 1000, // 1 minute
    );

    if (!rateCheck.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Slow down! You're sending messages too quickly.",
      );
    }

    return { allowed: true, remaining: rateCheck.remaining };
  },
);

// ============================================
// EXPO PUSH TOKEN CLEANUP
// ============================================

interface ExpoPushTicket {
  id?: string;
  status: "ok" | "error";
  message?: string;
  details?: {
    error?:
      | "DeviceNotRegistered"
      | "InvalidCredentials"
      | "MessageTooBig"
      | "MessageRateExceeded";
  };
}

interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: {
    error?:
      | "DeviceNotRegistered"
      | "InvalidCredentials"
      | "MessageTooBig"
      | "MessageRateExceeded";
  };
}

/**
 * Send push notification with invalid token cleanup
 * Enhanced version that removes invalid tokens
 */
async function sendExpoPushNotificationWithCleanup(
  message: ExpoPushMessage,
  userId: string,
): Promise<void> {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = (await response.json()) as ExpoPushTicket;
    console.log("📱 Push notification result:", result);

    // Check for device not registered error
    if (
      result.status === "error" &&
      result.details?.error === "DeviceNotRegistered"
    ) {
      console.log(`🧹 Cleaning up invalid token for user ${userId}`);
      await cleanupInvalidPushToken(userId);
    }
  } catch (error) {
    console.error("❌ Error sending push notification:", error);
  }
}

/**
 * Remove invalid push token from user document
 */
async function cleanupInvalidPushToken(userId: string): Promise<void> {
  try {
    await db.collection("Users").doc(userId).update({
      expoPushToken: admin.firestore.FieldValue.delete(),
    });
    console.log(`✅ Removed invalid push token for user ${userId}`);
  } catch (error) {
    console.error(`❌ Error removing push token for ${userId}:`, error);
  }
}

/**
 * Scheduled function to clean up expired push tokens
 * Runs daily to check for tokens that haven't been updated in 30 days
 */
export const cleanupExpiredPushTokens = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    console.log("🧹 Starting push token cleanup...");

    // This is a placeholder - in production, you would:
    // 1. Track token last-used timestamps
    // 2. Send test pushes to dormant tokens
    // 3. Remove tokens that fail with DeviceNotRegistered

    // For now, we rely on real-time cleanup in sendExpoPushNotificationWithCleanup
    console.log("✅ Push token cleanup completed (no-op for now)");
    return null;
  });

// ============================================
// ADMIN MODERATION FUNCTIONS
// ============================================

/**
 * Admin: Set a ban on a user
 * Requires admin custom claim
 */
export const adminSetBan = functions.https.onCall(async (data, context) => {
  // Verify admin
  if (!(await isAdmin(context))) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Admin access required",
    );
  }

  const { targetUid, reason, durationMs, details } = data;
  const adminUid = context.auth!.uid;

  if (!targetUid || !reason) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing targetUid or reason",
    );
  }

  // Don't allow banning admins
  const targetAuth = await admin
    .auth()
    .getUser(targetUid)
    .catch(() => null);
  if (targetAuth?.customClaims?.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Cannot ban an admin",
    );
  }

  const now = Date.now();
  const expiresAt = durationMs ? now + durationMs : null;

  const ban = {
    uid: targetUid,
    status: "active",
    reason,
    reasonDetails: details || null,
    bannedBy: adminUid,
    createdAt: now,
    expiresAt,
  };

  await db.collection("Bans").doc(targetUid).set(ban);

  // Log the event
  await logDomainEvent("ban_applied", adminUid, {
    targetUid,
    reason,
    expiresAt,
  });

  console.log(`🔨 Admin ${adminUid} banned user ${targetUid} for ${reason}`);
  return { success: true };
});

/**
 * Admin: Lift a ban
 * Requires admin custom claim
 */
export const adminLiftBan = functions.https.onCall(async (data, context) => {
  if (!(await isAdmin(context))) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Admin access required",
    );
  }

  const { targetUid } = data;
  const adminUid = context.auth!.uid;

  if (!targetUid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing targetUid",
    );
  }

  const banRef = db.collection("Bans").doc(targetUid);
  const banDoc = await banRef.get();

  if (!banDoc.exists) {
    throw new functions.https.HttpsError("not-found", "No ban found for user");
  }

  await banRef.update({
    status: "lifted",
    liftedAt: Date.now(),
    liftedBy: adminUid,
  });

  console.log(`✅ Admin ${adminUid} lifted ban for user ${targetUid}`);
  return { success: true };
});

/**
 * Admin: Apply a strike to a user
 * Automatically applies bans based on strike thresholds
 */
export const adminApplyStrike = functions.https.onCall(
  async (data, context) => {
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin access required",
      );
    }

    const { targetUid, reason, details, reportId } = data;
    const adminUid = context.auth!.uid;

    if (!targetUid || !reason) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing targetUid or reason",
      );
    }

    const now = Date.now();
    const strikeRef = db.collection("UserStrikes").doc(targetUid);
    const strikeDoc = await strikeRef.get();

    let strikeCount = 1;
    let strikeHistory: any[] = [];

    if (strikeDoc.exists) {
      const existingData = strikeDoc.data()!;
      strikeCount = (existingData.strikeCount || 0) + 1;
      strikeHistory = existingData.strikeHistory || [];
    }

    // Add new strike to history
    strikeHistory.push({
      reason,
      details: details || null,
      issuedBy: adminUid,
      issuedAt: now,
      reportId: reportId || null,
    });

    await strikeRef.set({
      uid: targetUid,
      strikeCount,
      lastStrikeAt: now,
      lastStrikeReason: reason,
      strikeHistory,
    });

    // Log the event
    await logDomainEvent("strike_issued", adminUid, {
      targetUid,
      reason,
      strikeCount,
      reportId,
    });

    // Check if automatic ban should be applied
    let autoBanApplied = false;
    let banDuration: number | null = null;

    if (strikeCount >= STRIKE_THRESHOLDS.PERM_BAN_AT) {
      banDuration = null; // Permanent
      autoBanApplied = true;
    } else if (strikeCount >= STRIKE_THRESHOLDS.LONG_BAN_AT) {
      banDuration = 7 * 24 * 60 * 60 * 1000; // 1 week
      autoBanApplied = true;
    } else if (strikeCount >= STRIKE_THRESHOLDS.TEMP_BAN_AT) {
      banDuration = 24 * 60 * 60 * 1000; // 1 day
      autoBanApplied = true;
    }

    if (autoBanApplied) {
      const ban = {
        uid: targetUid,
        status: "active",
        reason: "multiple_violations",
        reasonDetails: `Automatic ban after ${strikeCount} strikes`,
        bannedBy: "system",
        createdAt: now,
        expiresAt: banDuration ? now + banDuration : null,
      };

      await db.collection("Bans").doc(targetUid).set(ban);
      console.log(
        `🔨 Auto-ban applied to ${targetUid} after ${strikeCount} strikes`,
      );
    }

    console.log(
      `⚠️ Admin ${adminUid} applied strike #${strikeCount} to user ${targetUid}`,
    );
    return { success: true, strikeCount, autoBanApplied };
  },
);

/**
 * Admin: Apply a warning to a user
 * Requires admin custom claim
 * Warnings are stored in UserWarnings collection and user is notified
 */
export const adminApplyWarning = functions.https.onCall(
  async (data, context) => {
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin access required",
      );
    }

    const { targetUid, reason, details, reportId } = data;
    const adminUid = context.auth!.uid;

    if (!targetUid || !reason) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing targetUid or reason",
      );
    }

    const now = Date.now();
    const warningId = `${targetUid}_${now}`;

    // Create warning record
    const warning = {
      id: warningId,
      uid: targetUid,
      reason,
      details: details || null,
      issuedBy: adminUid,
      issuedAt: now,
      reportId: reportId || null,
      status: "unread",
    };

    await db.collection("UserWarnings").doc(warningId).set(warning);

    // Log the event
    await logDomainEvent("warning_issued", adminUid, {
      targetUid,
      reason,
      warningId,
      reportId,
    });

    // Try to send push notification to the user
    try {
      const userDoc = await db.collection("Users").doc(targetUid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const pushToken = userData?.expoPushToken;

        if (pushToken) {
          await sendExpoPushNotificationWithCleanup(
            {
              to: pushToken,
              title: "Warning from SnapStyle",
              body: "You have received a warning. Please review it in the app.",
              data: { type: "warning", warningId },
            },
            targetUid,
          );
        }
      }
    } catch (error) {
      console.error("Failed to send warning push notification:", error);
      // Don't throw - warning was still created
    }

    console.log(
      `⚠️ Admin ${adminUid} issued warning to user ${targetUid} for ${reason}`,
    );
    return { success: true, warningId };
  },
);

/**
 * Admin: Resolve a report
 * Requires admin custom claim
 */
export const adminResolveReport = functions.https.onCall(
  async (data, context) => {
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin access required",
      );
    }

    const { reportId, resolution, actionTaken } = data;
    const adminUid = context.auth!.uid;

    if (!reportId || !resolution || !actionTaken) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing reportId, resolution, or actionTaken",
      );
    }

    const reportRef = db.collection("Reports").doc(reportId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Report not found");
    }

    const now = Date.now();
    await reportRef.update({
      status: actionTaken === "none" ? "dismissed" : "resolved",
      reviewedBy: adminUid,
      reviewedAt: now,
      resolution,
      actionTaken,
    });

    // Log the event
    await logDomainEvent("report_resolved", adminUid, {
      reportId,
      actionTaken,
    });

    console.log(
      `✅ Admin ${adminUid} resolved report ${reportId} with action: ${actionTaken}`,
    );
    return { success: true };
  },
);

/**
 * Admin: Set admin claim on a user
 * Only callable by existing admins
 */
export const adminSetAdminClaim = functions.https.onCall(
  async (data, context) => {
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin access required",
      );
    }

    const { targetUid, isAdmin: setAdmin } = data;

    if (!targetUid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing targetUid",
      );
    }

    await admin.auth().setCustomUserClaims(targetUid, { admin: setAdmin });

    console.log(`✅ Set admin=${setAdmin} for user ${targetUid}`);
    return { success: true };
  },
);

/**
 * HTTP endpoint to set the first admin (use once during setup)
 * Protected by a secret key from environment
 */
export const initializeFirstAdmin = functions.https.onRequest(
  async (req, res) => {
    // Only allow POST
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const { uid, secretKey } = req.body;
    // Use environment variable or hardcoded secret for development
    const expectedSecret = process.env.ADMIN_SETUP_KEY || "SECRET";

    if (secretKey !== expectedSecret) {
      res.status(403).json({ error: "Invalid secret key" });
      return;
    }

    if (!uid) {
      res.status(400).json({ error: "Missing uid" });
      return;
    }

    try {
      await admin.auth().setCustomUserClaims(uid, { admin: true });
      console.log(`✅ Initialized first admin: ${uid}`);
      res.json({ success: true, message: `User ${uid} is now an admin` });
    } catch (error: any) {
      console.error("Error setting admin:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// ============================================
// DOMAIN EVENTS (For Migration Prep)
// ============================================

/**
 * Log a domain event for future sync/migration
 */
async function logDomainEvent(
  type: string,
  uid: string,
  payload: Record<string, any>,
): Promise<void> {
  try {
    await db.collection("Events").add({
      type,
      uid,
      payload,
      createdAt: Date.now(),
      version: 1,
      processed: false,
    });
  } catch (error) {
    console.error("Error logging domain event:", error);
    // Don't throw - events are non-critical
  }
}

/**
 * Trigger to log message events
 */
export const onNewMessageEvent = functions.firestore
  .document("Chats/{chatId}/Messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    await logDomainEvent("message_sent", message.sender, {
      chatId: context.params.chatId,
      messageId: context.params.messageId,
      type: message.type,
    });
  });

/**
 * Trigger to log report events
 */
export const onNewReport = functions.firestore
  .document("Reports/{reportId}")
  .onCreate(async (snap) => {
    const report = snap.data();
    await logDomainEvent("report_submitted", report.reporterId, {
      reportId: snap.id,
      reportedUserId: report.reportedUserId,
      reason: report.reason,
    });
  });

// ============================================
// BAN EXPIRATION CHECK (Scheduled)
// ============================================

/**
 * Scheduled function to update expired bans
 * Runs every hour to mark expired bans as inactive
 */
export const updateExpiredBans = functions.pubsub
  .schedule("every 1 hours")
  .onRun(async () => {
    console.log("🔄 Checking for expired bans...");

    const now = Date.now();
    const expiredBansQuery = await db
      .collection("Bans")
      .where("status", "==", "active")
      .where("expiresAt", "<=", now)
      .get();

    if (expiredBansQuery.empty) {
      console.log("✅ No expired bans found");
      return null;
    }

    const batch = db.batch();
    expiredBansQuery.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "expired" });
    });

    await batch.commit();
    console.log(`✅ Marked ${expiredBansQuery.docs.length} bans as expired`);
    return null;
  });

// Re-export Link Preview function
export const fetchLinkPreview = fetchLinkPreviewFunction;
