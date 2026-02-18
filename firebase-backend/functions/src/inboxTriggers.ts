/**
 * Inbox Trigger Cloud Functions (Segment 4)
 *
 * Firestore triggers that maintain per-user inbox aggregation docs
 * under Users/{uid}/Inbox/{threadId}.
 *
 * Thread ID format:
 *   - DMs:    "dm:{chatId}"
 *   - Groups: "group:{groupId}"
 *
 * These are activated automatically on message creation. The client
 * feature flag CHAT_INBOX_AGGREGATION controls whether the *client*
 * reads from this collection; the server always writes.
 *
 * @module functions/inboxTriggers
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

function getDb() {
  return admin.firestore();
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a short preview string for the inbox entry.
 */
function buildPreview(kind: string, text?: string): string {
  if (kind === "text" && text) {
    return text.length > 80 ? text.substring(0, 80) + "…" : text;
  }
  if (kind === "media") return "📷 Photo";
  if (kind === "voice") return "🎤 Voice message";
  if (kind === "file") return "📎 File";
  if (kind === "system") return text || "System message";
  if (kind === "scorecard" || kind === "game_invite") return "🎮 Game";
  return text || "";
}

/**
 * Get all member UIDs of a group by listing the Members subcollection.
 */
async function getGroupMemberUids(groupId: string): Promise<string[]> {
  try {
    const snap = await getDb()
      .collection("Groups")
      .doc(groupId)
      .collection("Members")
      .get();
    return snap.docs.map((d) => d.id);
  } catch (error) {
    functions.logger.error("[inboxTriggers] getGroupMemberUids error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// =============================================================================
// A) DM inbox trigger
// =============================================================================

/**
 * On new DM message → update both participants' inbox entries.
 *
 * Each participant gets an inbox doc at:
 *   Users/{uid}/Inbox/dm:{chatId}
 *
 * For the sender: lastActivityAt is updated but unreadCount is NOT incremented.
 * For the recipient: lastActivityAt updated AND unreadCount incremented.
 */
export const onDMMessageInbox = functions.firestore
  .document("Chats/{chatId}/Messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { chatId } = context.params;
    const db = getDb();

    // Skip system messages
    if (message.kind === "system" || message.type === "system") {
      return;
    }

    const senderId: string = message.senderId || message.sender;
    if (!senderId) {
      console.warn("[onDMMessageInbox] No senderId found on message");
      return;
    }

    const kind: string = message.kind || message.type || "text";
    const text: string | undefined = message.text || message.content;
    const preview = buildPreview(kind, text);
    const threadId = `dm:${chatId}`;

    try {
      // Fetch chat doc to get both members
      const chatDoc = await db.collection("Chats").doc(chatId).get();
      if (!chatDoc.exists) {
        console.warn(`[onDMMessageInbox] Chat ${chatId} not found`);
        return;
      }
      const members: string[] = chatDoc.data()?.members || [];
      if (members.length < 2) return;

      const batch = db.batch();

      for (const uid of members) {
        const inboxRef = db
          .collection("Users")
          .doc(uid)
          .collection("Inbox")
          .doc(threadId);

        const isSender = uid === senderId;
        const otherUid = members.find((m) => m !== uid) || "";

        // Fetch other user's name for display (best-effort)
        let otherUserName = "";
        try {
          const otherDoc = await db.collection("Users").doc(otherUid).get();
          otherUserName = otherDoc.data()?.displayName || "";
        } catch {
          // non-critical
        }

        const baseUpdate: Record<string, unknown> = {
          threadId,
          scope: "dm",
          conversationId: chatId,
          lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSenderId: senderId,
          lastMessageKind: kind,
          lastMessagePreview: preview,
          otherUserId: otherUid,
          otherUserName,
        };

        if (isSender) {
          // Sender: just update activity, reset their unread
          baseUpdate.unreadCount = 0;
          baseUpdate.unreadSince = null;
        } else {
          // Recipient: increment unread
          baseUpdate.unreadCount = admin.firestore.FieldValue.increment(1);
          // Set unreadSince only if currently 0 (first unread)
          // We'll use set with merge so existing unreadSince isn't overwritten
        }

        batch.set(inboxRef, baseUpdate, { merge: true });
      }

      await batch.commit();
      console.log(
        `[onDMMessageInbox] Updated inbox for chat ${chatId.substring(0, 8)}`,
      );
    } catch (error) {
      functions.logger.error("[onDMMessageInbox] Error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

// =============================================================================
// B) Group inbox trigger
// =============================================================================

/**
 * On new group message → update every member's inbox entry.
 *
 * Each member gets an inbox doc at:
 *   Users/{uid}/Inbox/group:{groupId}
 *
 * Sender gets unreadCount reset; other members get increment.
 */
export const onGroupMessageInbox = functions.firestore
  .document("Groups/{groupId}/Messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { groupId } = context.params;
    const db = getDb();

    // Skip system messages
    if (message.kind === "system" || message.type === "system") {
      return;
    }

    const senderId: string = message.senderId || message.sender;
    if (!senderId) {
      console.warn("[onGroupMessageInbox] No senderId found on message");
      return;
    }

    const kind: string = message.kind || message.type || "text";
    const text: string | undefined = message.text || message.content;
    const preview = buildPreview(kind, text);
    const threadId = `group:${groupId}`;

    try {
      // Fetch group metadata
      const groupDoc = await db.collection("Groups").doc(groupId).get();
      const groupName: string = groupDoc.data()?.name || "Group Chat";
      const avatarPath: string = groupDoc.data()?.avatarPath || "";

      // Fetch all member UIDs
      const memberUids = await getGroupMemberUids(groupId);
      if (memberUids.length === 0) return;

      // Firestore batches max 500 operations — split if needed
      const BATCH_LIMIT = 450;
      for (let i = 0; i < memberUids.length; i += BATCH_LIMIT) {
        const chunk = memberUids.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();

        for (const uid of chunk) {
          const inboxRef = db
            .collection("Users")
            .doc(uid)
            .collection("Inbox")
            .doc(threadId);

          const isSender = uid === senderId;

          const baseUpdate: Record<string, unknown> = {
            threadId,
            scope: "group",
            conversationId: groupId,
            lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSenderId: senderId,
            lastMessageKind: kind,
            lastMessagePreview: preview,
            groupName,
            avatarPath,
            memberCount: memberUids.length,
          };

          if (isSender) {
            baseUpdate.unreadCount = 0;
            baseUpdate.unreadSince = null;
          } else {
            baseUpdate.unreadCount = admin.firestore.FieldValue.increment(1);
          }

          batch.set(inboxRef, baseUpdate, { merge: true });
        }

        await batch.commit();
      }

      console.log(
        `[onGroupMessageInbox] Updated ${memberUids.length} inbox entries for group ${groupId.substring(0, 8)}`,
      );
    } catch (error) {
      functions.logger.error("[onGroupMessageInbox] Error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

// =============================================================================
// C) Mark-read callable
// =============================================================================

/**
 * Callable to reset a user's unread count for a conversation.
 * Called when the user opens / views a chat.
 */
export const markInboxRead = functions.https.onCall(
  async (
    data: { threadId: string },
    context,
  ): Promise<{ success: boolean }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const { threadId } = data;
    if (!threadId || typeof threadId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "threadId is required",
      );
    }

    const uid = context.auth.uid;
    const db = getDb();

    try {
      const inboxRef = db
        .collection("Users")
        .doc(uid)
        .collection("Inbox")
        .doc(threadId);

      await inboxRef.set(
        {
          unreadCount: 0,
          unreadSince: null,
        },
        { merge: true },
      );

      return { success: true };
    } catch (error) {
      functions.logger.error("[markInboxRead] Error", {
        uid,
        threadId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to update inbox",
      );
    }
  },
);
