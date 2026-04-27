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
import { secureCallableRuntime } from "./callableSecurity";
import {
  SCORECARD_VISIBLE_TEXT,
  sanitizeMessagePreviewText,
} from "./messagePreview";

function getDb() {
  return admin.firestore();
}

type InboxScope = "dm" | "group";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a short preview string for the inbox entry.
 */
function buildPreview(kind: string, text?: string): string {
  const sanitizedText = sanitizeMessagePreviewText(text);
  // Scorecards embed a JSON sentinel in their `text` field. Never leak
  // that into the inbox preview — substitute the generic label.
  if (sanitizedText === SCORECARD_VISIBLE_TEXT) {
    return SCORECARD_VISIBLE_TEXT;
  }
  if (kind === "text" && sanitizedText) {
    return sanitizedText.length > 80
      ? sanitizedText.substring(0, 80) + "..."
      : sanitizedText;
  }
  if (kind === "system") {
    return sanitizedText || "System message";
  }
  if (kind === "media") return "📷 Photo";
  if (kind === "gif") return "GIF";
  if (kind === "sticker") return "Sticker";
  if (kind === "voice") return "🎤 Voice message";
  if (kind === "file") return "📎 File";
  if (kind === "game") return "🎮 Game";
  return sanitizedText || "New message";
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

function isHiddenDeleted(
  data: FirebaseFirestore.DocumentData | undefined,
): boolean {
  return Boolean(data?.deletedAt && data?.hiddenUntilNewMessage);
}

function buildThreadId(scope: InboxScope, conversationId: string): string {
  return `${scope}:${conversationId}`;
}

async function deleteUserInboxThread(
  uid: string,
  threadId: string,
): Promise<void> {
  await getDb()
    .collection("Users")
    .doc(uid)
    .collection("Inbox")
    .doc(threadId)
    .delete();
}

async function shouldDeleteDmInboxThread(
  uid: string,
  chatId: string,
  threadData?: FirebaseFirestore.DocumentData,
): Promise<boolean> {
  const db = getDb();
  const chatRef = db.collection("Chats").doc(chatId);
  const [chatDoc, privateDoc] = await Promise.all([
    chatRef.get(),
    chatRef.collection("MembersPrivate").doc(uid).get(),
  ]);

  if (isHiddenDeleted(privateDoc.data())) return true;
  if (!chatDoc.exists) return true;

  const members = chatDoc.data()?.members;
  if (!Array.isArray(members) || !members.includes(uid)) return true;

  const otherUid =
    members.find(
      (memberUid: unknown) =>
        typeof memberUid === "string" && memberUid !== uid,
    ) || threadData?.otherUserId;
  if (!otherUid || typeof otherUid !== "string") return true;
  if (!members.includes(otherUid)) return true;

  const otherUserDoc = await db.collection("Users").doc(otherUid).get();
  return !otherUserDoc.exists;
}

async function shouldDeleteGroupInboxThread(
  uid: string,
  groupId: string,
): Promise<boolean> {
  const db = getDb();
  const groupRef = db.collection("Groups").doc(groupId);
  const [groupDoc, memberDoc, privateDoc] = await Promise.all([
    groupRef.get(),
    groupRef.collection("Members").doc(uid).get(),
    groupRef.collection("MembersPrivate").doc(uid).get(),
  ]);

  if (isHiddenDeleted(privateDoc.data())) return true;
  if (!groupDoc.exists) return true;

  const memberIds = groupDoc.data()?.memberIds;
  if (Array.isArray(memberIds) && !memberIds.includes(uid)) return true;

  return !memberDoc.exists;
}

async function cleanupInboxThreadIfStale(
  uid: string,
  scope: InboxScope,
  conversationId: string,
  threadData?: FirebaseFirestore.DocumentData,
): Promise<boolean> {
  const threadId = buildThreadId(scope, conversationId);
  const shouldDelete =
    scope === "dm"
      ? await shouldDeleteDmInboxThread(uid, conversationId, threadData)
      : await shouldDeleteGroupInboxThread(uid, conversationId);

  if (!shouldDelete) return false;
  await deleteUserInboxThread(uid, threadId);
  return true;
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
        const privateDoc = await db
          .collection("Chats")
          .doc(chatId)
          .collection("MembersPrivate")
          .doc(uid)
          .get();

        if (isHiddenDeleted(privateDoc.data())) {
          batch.delete(inboxRef);
          continue;
        }

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
    const senderName: string = message.senderName || "";

    try {
      // Fetch group metadata
      const groupDoc = await db.collection("Groups").doc(groupId).get();
      const groupName: string = groupDoc.data()?.name || "Group Chat";
      const avatarPath: string = groupDoc.data()?.avatarPath || "";
      const avatarUrl: string = groupDoc.data()?.avatarUrl || "";
      const backgroundUrl: string | null =
        groupDoc.data()?.backgroundUrl || null;

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
          const privateDoc = await db
            .collection("Groups")
            .doc(groupId)
            .collection("MembersPrivate")
            .doc(uid)
            .get();

          if (isHiddenDeleted(privateDoc.data())) {
            batch.delete(inboxRef);
            continue;
          }

          const baseUpdate: Record<string, unknown> = {
            threadId,
            scope: "group",
            conversationId: groupId,
            lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSenderId: senderId,
            lastSenderName: senderName,
            lastMessageKind: kind,
            lastMessagePreview: preview,
            groupName,
            avatarPath,
            avatarUrl,
            backgroundUrl,
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
export const markInboxRead = secureCallableRuntime().https.onCall(
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
          lastSeenAtPrivate: admin.firestore.FieldValue.serverTimestamp(),
          lastMarkedUnreadAt: null,
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

export const cleanupStaleInboxThread = secureCallableRuntime().https.onCall(
  async (
    data: { threadId?: string; scope?: string; conversationId?: string },
    context,
  ): Promise<{ success: boolean; cleaned: boolean }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const { threadId, scope, conversationId } = data;
    if (
      typeof threadId !== "string" ||
      (scope !== "dm" && scope !== "group") ||
      typeof conversationId !== "string" ||
      threadId !== buildThreadId(scope, conversationId)
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "A valid threadId, scope, and conversationId are required",
      );
    }

    const uid = context.auth.uid;
    const inboxRef = getDb()
      .collection("Users")
      .doc(uid)
      .collection("Inbox")
      .doc(threadId);

    try {
      const inboxDoc = await inboxRef.get();
      const cleaned = await cleanupInboxThreadIfStale(
        uid,
        scope,
        conversationId,
        inboxDoc.data(),
      );
      return { success: true, cleaned };
    } catch (error) {
      functions.logger.error("[cleanupStaleInboxThread] Error", {
        uid,
        threadId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to clean up stale inbox thread",
      );
    }
  },
);

// =============================================================================
// D) Member State Sync Triggers
//
// When a user updates their private member state (pin, archive, mute) the
// change needs to propagate to their Inbox doc so the aggregated path can
// display correct state without extra per-conversation reads.
// =============================================================================

/**
 * Sync DM member state changes to the user's Inbox entry.
 */
export const onDMMemberStateChanged = functions.firestore
  .document("Chats/{chatId}/MembersPrivate/{uid}")
  .onWrite(async (change, context) => {
    const { chatId, uid } = context.params;
    if (!change.after.exists) return;

    const before = change.before.exists ? change.before.data() || {} : {};
    const after = change.after.data() || {};

    // Sync all fields that affect inbox display + unread computation
    const changed =
      !change.before.exists ||
      before.pinnedAt !== after.pinnedAt ||
      before.archived !== after.archived ||
      before.mutedUntil !== after.mutedUntil ||
      before.notifyLevel !== after.notifyLevel ||
      before.deletedAt !== after.deletedAt ||
      before.hiddenUntilNewMessage !== after.hiddenUntilNewMessage ||
      before.lastSeenAtPrivate !== after.lastSeenAtPrivate ||
      before.lastMarkedUnreadAt !== after.lastMarkedUnreadAt;

    if (!changed) return;

    const db = getDb();
    const threadId = `dm:${chatId}`;
    const inboxRef = db
      .collection("Users")
      .doc(uid)
      .collection("Inbox")
      .doc(threadId);

    try {
      if (isHiddenDeleted(after)) {
        await inboxRef.delete();
        return;
      }

      const inboxDoc = await inboxRef.get();
      if (!inboxDoc.exists) return;

      await inboxRef.set(
        {
          pinnedAt: after.pinnedAt ?? null,
          archived: after.archived ?? false,
          mutedUntil: after.mutedUntil ?? null,
          notifyLevel: after.notifyLevel ?? "all",
          deletedAt: after.deletedAt ?? null,
          hiddenUntilNewMessage: after.hiddenUntilNewMessage ?? false,
          lastSeenAtPrivate: after.lastSeenAtPrivate ?? null,
          lastMarkedUnreadAt: after.lastMarkedUnreadAt ?? null,
        },
        { merge: true },
      );
    } catch (error) {
      functions.logger.error("[onDMMemberStateChanged] Error", {
        chatId,
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

/**
 * Sync group member state changes to the user's Inbox entry.
 */
export const onGroupMemberStateChanged = functions.firestore
  .document("Groups/{groupId}/MembersPrivate/{uid}")
  .onWrite(async (change, context) => {
    const { groupId, uid } = context.params;
    if (!change.after.exists) return;

    const before = change.before.exists ? change.before.data() || {} : {};
    const after = change.after.data() || {};

    const changed =
      !change.before.exists ||
      before.pinnedAt !== after.pinnedAt ||
      before.archived !== after.archived ||
      before.mutedUntil !== after.mutedUntil ||
      before.notifyLevel !== after.notifyLevel ||
      before.deletedAt !== after.deletedAt ||
      before.hiddenUntilNewMessage !== after.hiddenUntilNewMessage ||
      before.lastSeenAtPrivate !== after.lastSeenAtPrivate ||
      before.lastMarkedUnreadAt !== after.lastMarkedUnreadAt;

    if (!changed) return;

    const db = getDb();
    const threadId = `group:${groupId}`;
    const inboxRef = db
      .collection("Users")
      .doc(uid)
      .collection("Inbox")
      .doc(threadId);

    try {
      if (isHiddenDeleted(after)) {
        await inboxRef.delete();
        return;
      }

      const inboxDoc = await inboxRef.get();
      if (!inboxDoc.exists) return;

      await inboxRef.set(
        {
          pinnedAt: after.pinnedAt ?? null,
          archived: after.archived ?? false,
          mutedUntil: after.mutedUntil ?? null,
          notifyLevel: after.notifyLevel ?? "all",
          deletedAt: after.deletedAt ?? null,
          hiddenUntilNewMessage: after.hiddenUntilNewMessage ?? false,
          lastSeenAtPrivate: after.lastSeenAtPrivate ?? null,
          lastMarkedUnreadAt: after.lastMarkedUnreadAt ?? null,
        },
        { merge: true },
      );
    } catch (error) {
      functions.logger.error("[onGroupMemberStateChanged] Error", {
        groupId,
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

export const onDMMemberRemovedInboxCleanup = functions.firestore
  .document("Chats/{chatId}/Members/{uid}")
  .onDelete(async (_snap, context) => {
    const { chatId, uid } = context.params;
    try {
      await deleteUserInboxThread(uid, buildThreadId("dm", chatId));
    } catch (error) {
      functions.logger.error("[onDMMemberRemovedInboxCleanup] Error", {
        chatId,
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

export const onGroupMemberRemovedInboxCleanup = functions.firestore
  .document("Groups/{groupId}/Members/{uid}")
  .onDelete(async (_snap, context) => {
    const { groupId, uid } = context.params;
    try {
      await deleteUserInboxThread(uid, buildThreadId("group", groupId));
    } catch (error) {
      functions.logger.error("[onGroupMemberRemovedInboxCleanup] Error", {
        groupId,
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
