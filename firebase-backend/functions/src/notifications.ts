import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { buildMessagePreviewText } from "./messagePreview";
import { notifyUser } from "./notificationCenter";
import { updateStreakOnMessage } from "./streaks";

const db = admin.firestore();

/**
 * Retrieve all active push tokens for a user.  Used to build the
 * `excludeTokens` list so we never deliver a notification to the
 * sender's own device.
 */
async function getUserPushTokens(uid: string): Promise<string[]> {
  try {
    const tokenSet = new Set<string>();
    const snap = await db
      .collection("Users")
      .doc(uid)
      .collection("NotificationDevices")
      .get();
    for (const doc of snap.docs) {
      const token = doc.data()?.expoPushToken;
      if (typeof token === "string" && token.length > 0) {
        tokenSet.add(token);
      }
    }

    const userDoc = await db.collection("Users").doc(uid).get();
    const legacyToken = userDoc.data()?.expoPushToken;
    if (typeof legacyToken === "string" && legacyToken.length > 0) {
      tokenSet.add(legacyToken);
    }

    return Array.from(tokenSet);
  } catch {
    return [];
  }
}

async function revokeDuplicateLegacyRootTokens(
  ownerUid: string,
  token: string,
): Promise<void> {
  const staleRootSnap = await db
    .collection("Users")
    .where("expoPushToken", "==", token)
    .get();

  const staleRootWrites: Promise<FirebaseFirestore.WriteResult>[] = [];
  for (const userDoc of staleRootSnap.docs) {
    if (userDoc.id === ownerUid) continue;

    functions.logger.info(
      `[onPushTokenRegistered] Clearing stale legacy root token from user ${userDoc.id} ` +
        `- token now owned by ${ownerUid}`,
    );

    staleRootWrites.push(
      userDoc.ref.set(
        {
          expoPushToken: admin.firestore.FieldValue.delete(),
        },
        { merge: true },
      ),
    );
  }

  if (staleRootWrites.length > 0) {
    await Promise.all(staleRootWrites);
    functions.logger.info(
      `[onPushTokenRegistered] Cleared ${staleRootWrites.length} stale legacy root token(s) for ${ownerUid}`,
    );
  }
}

type NotificationPreviewMode = "full" | "sender_only" | "generic";
type NotifyLevel = "all" | "mentions" | "none";

async function getUserDisplayName(uid: string): Promise<string> {
  try {
    const userDoc = await db.collection("Users").doc(uid).get();
    const data = userDoc.data();
    return data?.displayName || data?.username || "Someone";
  } catch {
    return "Someone";
  }
}

async function getInboxSettings(uid: string): Promise<{
  defaultNotifyLevel: NotifyLevel;
  notificationPreview: NotificationPreviewMode;
}> {
  try {
    const inboxDoc = await db
      .collection("Users")
      .doc(uid)
      .collection("settings")
      .doc("inbox")
      .get();
    const data = inboxDoc.data() ?? {};
    return {
      defaultNotifyLevel:
        data.defaultNotifyLevel === "mentions" ||
        data.defaultNotifyLevel === "none"
          ? data.defaultNotifyLevel
          : "all",
      notificationPreview:
        data.notificationPreview === "sender_only" ||
        data.notificationPreview === "generic"
          ? data.notificationPreview
          : "full",
    };
  } catch {
    return {
      defaultNotifyLevel: "all",
      notificationPreview: "full",
    };
  }
}

async function getDmNotifyLevel(
  chatId: string,
  uid: string,
): Promise<NotifyLevel> {
  const memberDoc = await db
    .collection("Chats")
    .doc(chatId)
    .collection("MembersPrivate")
    .doc(uid)
    .get();
  const notifyLevel = memberDoc.data()?.notifyLevel;
  if (notifyLevel === "mentions" || notifyLevel === "none") {
    return notifyLevel;
  }
  return (await getInboxSettings(uid)).defaultNotifyLevel;
}

async function getGroupNotifyLevel(
  groupId: string,
  uid: string,
): Promise<NotifyLevel> {
  const memberDoc = await db
    .collection("Groups")
    .doc(groupId)
    .collection("MembersPrivate")
    .doc(uid)
    .get();
  const notifyLevel = memberDoc.data()?.notifyLevel;
  if (notifyLevel === "mentions" || notifyLevel === "none") {
    return notifyLevel;
  }
  return (await getInboxSettings(uid)).defaultNotifyLevel;
}

function buildDmCopy(params: {
  senderName: string;
  previewText: string;
  previewMode: NotificationPreviewMode;
}) {
  const { senderName, previewText, previewMode } = params;
  if (previewMode === "generic") {
    return {
      title: "Vibe",
      body: "You have a new message",
    };
  }
  if (previewMode === "sender_only") {
    return {
      title: senderName,
      body: "Sent you a message",
    };
  }
  return {
    title: senderName,
    body: previewText,
  };
}

function buildGroupCopy(params: {
  senderName: string;
  groupName: string;
  previewText: string;
  previewMode: NotificationPreviewMode;
  mentioned: boolean;
}) {
  const { senderName, groupName, previewText, previewMode, mentioned } = params;

  if (previewMode === "generic") {
    return {
      title: groupName,
      body: mentioned ? "You were mentioned" : "New message",
    };
  }

  if (previewMode === "sender_only") {
    return {
      title: groupName,
      body: mentioned
        ? `${senderName} mentioned you`
        : `${senderName} sent a message`,
    };
  }

  return {
    title: groupName,
    body: mentioned
      ? `${senderName} mentioned you: ${previewText}`
      : `${senderName}: ${previewText}`,
  };
}

export const onNewMessage = functions.firestore
  .document("Chats/{chatId}/Messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { chatId, messageId } = context.params;

    if (message.kind === "system" || message.type === "system") {
      return null;
    }

    const senderId = message.senderId || message.sender;
    if (!senderId) return null;

    const chatDoc = await db.collection("Chats").doc(chatId).get();
    if (!chatDoc.exists) return null;

    const members: string[] = chatDoc.data()?.members || [];
    const recipientUid = members.find((uid) => uid !== senderId);
    if (!recipientUid) return null;
    // Defense in depth: refuse to notify the sender, even if the member list
    // is somehow malformed and returns them.
    if (recipientUid === senderId) return null;

    const senderDeviceId: string | null =
      typeof message.senderDeviceId === "string" && message.senderDeviceId
        ? message.senderDeviceId
        : null;

    const notifyLevel = await getDmNotifyLevel(chatId, recipientUid);

    // Always update streak tracking regardless of notification preferences.
    // Streak logic runs in its own try/catch so notification failures don't
    // block streak updates and vice-versa.
    try {
      await updateStreakOnMessage(senderId, recipientUid);
    } catch (streakErr) {
      console.error("[onNewMessage] Streak update failed:", streakErr);
    }

    if (notifyLevel === "none") {
      return null;
    }

    const senderName =
      typeof message.senderName === "string"
        ? message.senderName
        : await getUserDisplayName(senderId);
    const { notificationPreview } = await getInboxSettings(recipientUid);
    const previewText = buildMessagePreviewText({
      kind: String(message.kind || message.type || "text"),
      text: message.text || message.content,
      maxTextLength: 120,
    });
    const copy = buildDmCopy({
      senderName,
      previewText,
      previewMode: notificationPreview,
    });

    // Collect sender's push tokens so we can exclude them from delivery.
    // This prevents self-notifications when a stale token mapping exists.
    const senderTokens = await getUserPushTokens(senderId);

    await notifyUser({
      recipientUid,
      type: "dm_message",
      category: "message",
      dedupeKey: `dm_message:${chatId}:${messageId}:${recipientUid}`,
      collapseKey: `dm:${chatId}`,
      title: copy.title,
      body: copy.body,
      actorUid: senderId,
      actorName: senderName,
      conversationId: chatId,
      conversationScope: "dm",
      route: {
        screen: "ChatDetail",
        params: {
          friendUid: senderId,
          initialData: { chatId },
        },
      },
      data: {
        chatId,
        messageId,
        senderId,
        friendUid: senderId,
      },
      respectConversationMute: true,
      excludeTokens: senderTokens,
      excludeDeviceIds: senderDeviceId ? [senderDeviceId] : [],
    });

    return null;
  });

export const onNewGroupMessageV2 = functions.firestore
  .document("Groups/{groupId}/Messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { groupId, messageId } = context.params;

    if (message.kind === "system" || message.type === "system") {
      return null;
    }

    const senderId = message.senderId || message.sender;
    if (!senderId) return null;

    const groupDoc = await db.collection("Groups").doc(groupId).get();
    if (!groupDoc.exists) return null;

    const groupData = groupDoc.data() ?? {};
    const groupName =
      typeof groupData.name === "string" && groupData.name.trim().length > 0
        ? groupData.name
        : "Group";
    const memberIds: string[] = Array.isArray(groupData.memberIds)
      ? groupData.memberIds
      : [];
    const mentionUids: string[] = Array.isArray(message.mentionUids)
      ? message.mentionUids
      : [];
    const senderName =
      typeof message.senderName === "string"
        ? message.senderName
        : await getUserDisplayName(senderId);
    const previewText = buildMessagePreviewText({
      kind: String(message.kind || message.type || "text"),
      text: message.text || message.content,
      maxTextLength: 120,
    });

    // Collect sender's push tokens so we can exclude them from delivery.
    const senderTokens = await getUserPushTokens(senderId);
    const senderDeviceId: string | null =
      typeof message.senderDeviceId === "string" && message.senderDeviceId
        ? message.senderDeviceId
        : null;

    await Promise.all(
      memberIds
        .filter((uid) => uid !== senderId)
        .map(async (recipientUid) => {
          const notifyLevel = await getGroupNotifyLevel(groupId, recipientUid);
          const mentioned = mentionUids.includes(recipientUid);

          if (notifyLevel === "none") return;
          if (notifyLevel === "mentions" && !mentioned) return;

          const { notificationPreview } = await getInboxSettings(recipientUid);
          const copy = buildGroupCopy({
            senderName,
            groupName,
            previewText,
            previewMode: notificationPreview,
            mentioned,
          });

          await notifyUser({
            recipientUid,
            type: "group_message",
            category: "message",
            dedupeKey: `group_message:${groupId}:${messageId}:${recipientUid}`,
            collapseKey: `group:${groupId}`,
            title: copy.title,
            body: copy.body,
            actorUid: senderId,
            actorName: senderName,
            conversationId: groupId,
            conversationScope: "group",
            route: {
              screen: "GroupChat",
              params: {
                groupId,
                groupName,
              },
            },
            data: {
              groupId,
              groupName,
              messageId,
              senderId,
              senderName,
              mentioned,
            },
            respectConversationMute: true,
            excludeTokens: senderTokens,
            excludeDeviceIds: senderDeviceId ? [senderDeviceId] : [],
          });
        }),
    );

    return null;
  });

export const onMessageRequestCreatedNotification = functions.firestore
  .document("Users/{recipientUid}/MessageRequests/{chatId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { recipientUid, chatId } = context.params;

    await notifyUser({
      recipientUid,
      type: "message_request",
      category: "message",
      dedupeKey: `message_request:${recipientUid}:${chatId}`,
      collapseKey: `message_request:${recipientUid}`,
      title: "Message Request",
      body:
        typeof data.requesterName === "string" && data.requesterName.length > 0
          ? `${data.requesterName} wants to message you`
          : "Someone wants to send you a message",
      actorUid:
        typeof data.requesterId === "string" ? data.requesterId : undefined,
      actorName:
        typeof data.requesterName === "string" ? data.requesterName : "Someone",
      conversationId: chatId,
      conversationScope: "dm",
      route: {
        screen: "Friends",
        params: {
          tab: "requests",
        },
      },
      data: {
        chatId,
        requesterId:
          typeof data.requesterId === "string" ? data.requesterId : undefined,
      },
    });

    return null;
  });

/**
 * Enforce push-token uniqueness across users.
 *
 * When a NotificationDevice document is created or updated with a non-null
 * push token, this trigger searches for ALL other users' NotificationDevices
 * documents that share the same token and invalidates them.  This prevents
 * the "stale token after account switch" bug where a device token remains
 * active under a previous user.
 */
export const onPushTokenRegistered = functions.firestore
  .document("Users/{uid}/NotificationDevices/{deviceId}")
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return null; // deletion — nothing to clean up
    const token = after.expoPushToken;
    if (typeof token !== "string" || token.length === 0) return null;

    const ownerUid = context.params.uid;

    // Use a collectionGroup query to find ALL NotificationDevices with
    // this token, then invalidate matches that belong to a different user.
    try {
      const snap = await db
        .collectionGroup("NotificationDevices")
        .where("expoPushToken", "==", token)
        .get();

      const staleWrites: Promise<FirebaseFirestore.WriteResult>[] = [];
      for (const doc of snap.docs) {
        // Path: Users/{uid}/NotificationDevices/{deviceId}
        const parts = doc.ref.path.split("/");
        const docOwnerUid = parts[1];
        if (docOwnerUid === ownerUid) continue; // same user — skip

        functions.logger.info(
          `[onPushTokenRegistered] Revoking stale token from user ${docOwnerUid} ` +
            `(device ${doc.id}) — token now owned by ${ownerUid}`,
        );

        staleWrites.push(
          doc.ref.set(
            {
              expoPushToken: null,
              pushEnabled: false,
              revokedBy: ownerUid,
              revokedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          ),
        );
      }

      if (staleWrites.length > 0) {
        await Promise.all(staleWrites);
        functions.logger.info(
          `[onPushTokenRegistered] Revoked ${staleWrites.length} stale token(s) for token owned by ${ownerUid}`,
        );
      }
    } catch (err) {
      functions.logger.error(
        "[onPushTokenRegistered] Failed to clean stale tokens:",
        err,
      );
    }

    try {
      await revokeDuplicateLegacyRootTokens(ownerUid, token);
    } catch (err) {
      functions.logger.error(
        "[onPushTokenRegistered] Failed to clean stale legacy root tokens:",
        err,
      );
    }

    return null;
  });
