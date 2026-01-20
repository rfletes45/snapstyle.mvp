/**
 * SnapStyle Cloud Functions
 * Handles:
 * - Automatic Storage cleanup when messages are deleted (Phase 4)
 * - Story auto-expiry and cleanup (Phase 5)
 * - Push notifications (Phase 6)
 * - Streak management (Phase 6)
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

// ============================================
// EXPO PUSH NOTIFICATIONS
// ============================================

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  badge?: number;
}

/**
 * Send push notification via Expo's push service
 */
async function sendExpoPushNotification(
  message: ExpoPushMessage,
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

    const result = await response.json();
    console.log("📱 Push notification result:", result);
  } catch (error) {
    console.error("❌ Error sending push notification:", error);
  }
}

/**
 * Get user's Expo Push Token from Firestore
 */
async function getUserPushToken(userId: string): Promise<string | null> {
  try {
    const userDoc = await db.collection("Users").doc(userId).get();
    if (!userDoc.exists) return null;
    return userDoc.data()?.expoPushToken || null;
  } catch (error) {
    console.error("❌ Error getting push token:", error);
    return null;
  }
}

/**
 * onNewMessage: Triggered when a new message is created
 * Sends push notification to recipient and updates streak tracking
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
        const body = isSnap ? "📸 Sent you a snap!" : message.content;

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

/**
 * Update streak when a message is sent
 */
async function updateStreakOnMessage(
  senderId: string,
  recipientId: string,
): Promise<void> {
  try {
    // Find the friendship document
    const friendsRef = db.collection("Friends");
    const q1 = await friendsRef
      .where("users", "==", [senderId, recipientId])
      .get();
    const q2 = await friendsRef
      .where("users", "==", [recipientId, senderId])
      .get();

    let friendDoc = q1.docs[0] || q2.docs[0];
    if (!friendDoc) {
      console.log("Friendship not found for streak update");
      return;
    }

    const data = friendDoc.data();
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const [uid1, uid2] = data.users;
    const isUser1 = senderId === uid1;

    const lastSentField = isUser1 ? "lastSentDay_uid1" : "lastSentDay_uid2";
    const otherLastSentField = isUser1 ? "lastSentDay_uid2" : "lastSentDay_uid1";

    const currentLastSent = data[lastSentField] || "";
    const otherLastSent = data[otherLastSentField] || "";
    const streakUpdatedDay = data.streakUpdatedDay || "";
    let streakCount = data.streakCount || 0;

    // If user already sent today, no update needed
    if (currentLastSent === today) {
      return;
    }

    const updates: any = {
      [lastSentField]: today,
    };

    // Check if this completes today's streak requirement
    const otherSentToday = otherLastSent === today;

    if (otherSentToday && streakUpdatedDay !== today) {
      // Both users have now sent today - check if streak continues
      const lastUpdate = new Date(streakUpdatedDay || "2000-01-01");
      const todayDate = new Date(today);
      const daysDiff = Math.floor(
        (todayDate.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff <= 1) {
        // Streak continues
        streakCount += 1;
      } else {
        // Streak broken, start fresh
        streakCount = 1;
      }

      updates.streakCount = streakCount;
      updates.streakUpdatedDay = today;

      // Check for milestone and send notification
      const milestones = [3, 7, 14, 30, 50, 100, 365];
      if (milestones.includes(streakCount)) {
        await sendStreakMilestoneNotification(
          senderId,
          recipientId,
          streakCount,
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
        updates.streakCount = 0;
      }
    }

    await friendDoc.ref.update(updates);
    console.log("✅ Streak updated for friendship:", friendDoc.id);
  } catch (error) {
    console.error("❌ Error updating streak:", error);
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
      const activeStreaks = await friendsRef
        .where("streakCount", ">", 0)
        .get();

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
