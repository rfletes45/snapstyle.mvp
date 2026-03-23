"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMessageRequestCreatedNotification = exports.onNewGroupMessageV2 = exports.onNewMessage = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const notificationCenter_1 = require("./notificationCenter");
const db = admin.firestore();
function buildMessagePreview(kind, text) {
    if (kind === "text" && text) {
        return text.length > 120 ? `${text.slice(0, 117)}...` : text;
    }
    if (kind === "media")
        return "Sent a photo";
    if (kind === "voice")
        return "Sent a voice message";
    if (kind === "file")
        return "Sent a file";
    if (kind === "animal")
        return "Sent an animal sticker";
    return text || "New message";
}
async function getUserDisplayName(uid) {
    try {
        const userDoc = await db.collection("Users").doc(uid).get();
        const data = userDoc.data();
        return data?.displayName || data?.username || "Someone";
    }
    catch {
        return "Someone";
    }
}
async function getInboxSettings(uid) {
    try {
        const inboxDoc = await db
            .collection("Users")
            .doc(uid)
            .collection("settings")
            .doc("inbox")
            .get();
        const data = inboxDoc.data() ?? {};
        return {
            defaultNotifyLevel: data.defaultNotifyLevel === "mentions" ||
                data.defaultNotifyLevel === "none"
                ? data.defaultNotifyLevel
                : "all",
            notificationPreview: data.notificationPreview === "sender_only" ||
                data.notificationPreview === "generic"
                ? data.notificationPreview
                : "full",
        };
    }
    catch {
        return {
            defaultNotifyLevel: "all",
            notificationPreview: "full",
        };
    }
}
async function getDmNotifyLevel(chatId, uid) {
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
async function getGroupNotifyLevel(groupId, uid) {
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
function buildDmCopy(params) {
    const { senderName, previewText, previewMode } = params;
    if (previewMode === "generic") {
        return {
            title: "New message",
            body: "Open Vibe to view it",
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
function buildGroupCopy(params) {
    const { senderName, groupName, previewText, previewMode, mentioned } = params;
    if (previewMode === "generic") {
        return {
            title: mentioned ? `${groupName}` : groupName,
            body: mentioned ? "You were mentioned in a message" : "New message",
        };
    }
    if (previewMode === "sender_only") {
        return {
            title: mentioned ? `${groupName}` : groupName,
            body: mentioned
                ? `${senderName} mentioned you`
                : `${senderName} sent a message`,
        };
    }
    return {
        title: mentioned ? `${groupName} - mentioned you` : groupName,
        body: previewText,
    };
}
exports.onNewMessage = functions.firestore
    .document("Chats/{chatId}/Messages/{messageId}")
    .onCreate(async (snap, context) => {
    const message = snap.data();
    const { chatId, messageId } = context.params;
    if (message.kind === "system" || message.type === "system") {
        return null;
    }
    const senderId = message.senderId || message.sender;
    if (!senderId)
        return null;
    const chatDoc = await db.collection("Chats").doc(chatId).get();
    if (!chatDoc.exists)
        return null;
    const members = chatDoc.data()?.members || [];
    const recipientUid = members.find((uid) => uid !== senderId);
    if (!recipientUid)
        return null;
    const notifyLevel = await getDmNotifyLevel(chatId, recipientUid);
    if (notifyLevel === "none") {
        return null;
    }
    const senderName = typeof message.senderName === "string"
        ? message.senderName
        : await getUserDisplayName(senderId);
    const { notificationPreview } = await getInboxSettings(recipientUid);
    const previewText = buildMessagePreview(String(message.kind || message.type || "text"), message.text || message.content);
    const copy = buildDmCopy({
        senderName,
        previewText,
        previewMode: notificationPreview,
    });
    await (0, notificationCenter_1.notifyUser)({
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
    });
    return null;
});
exports.onNewGroupMessageV2 = functions.firestore
    .document("Groups/{groupId}/Messages/{messageId}")
    .onCreate(async (snap, context) => {
    const message = snap.data();
    const { groupId, messageId } = context.params;
    if (message.kind === "system" || message.type === "system") {
        return null;
    }
    const senderId = message.senderId || message.sender;
    if (!senderId)
        return null;
    const groupDoc = await db.collection("Groups").doc(groupId).get();
    if (!groupDoc.exists)
        return null;
    const groupData = groupDoc.data() ?? {};
    const groupName = typeof groupData.name === "string" && groupData.name.trim().length > 0
        ? groupData.name
        : "Group";
    const memberIds = Array.isArray(groupData.memberIds)
        ? groupData.memberIds
        : [];
    const mentionUids = Array.isArray(message.mentionUids)
        ? message.mentionUids
        : [];
    const senderName = typeof message.senderName === "string"
        ? message.senderName
        : await getUserDisplayName(senderId);
    const previewText = buildMessagePreview(String(message.kind || message.type || "text"), message.text || message.content);
    await Promise.all(memberIds
        .filter((uid) => uid !== senderId)
        .map(async (recipientUid) => {
        const notifyLevel = await getGroupNotifyLevel(groupId, recipientUid);
        const mentioned = mentionUids.includes(recipientUid);
        if (notifyLevel === "none")
            return;
        if (notifyLevel === "mentions" && !mentioned)
            return;
        const { notificationPreview } = await getInboxSettings(recipientUid);
        const copy = buildGroupCopy({
            senderName,
            groupName,
            previewText,
            previewMode: notificationPreview,
            mentioned,
        });
        await (0, notificationCenter_1.notifyUser)({
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
        });
    }));
    return null;
});
exports.onMessageRequestCreatedNotification = functions.firestore
    .document("Users/{recipientUid}/MessageRequests/{chatId}")
    .onCreate(async (snap, context) => {
    const data = snap.data();
    const { recipientUid, chatId } = context.params;
    await (0, notificationCenter_1.notifyUser)({
        recipientUid,
        type: "message_request",
        category: "message",
        dedupeKey: `message_request:${recipientUid}:${chatId}`,
        collapseKey: `message_request:${recipientUid}`,
        title: "New message request",
        body: typeof data.messagePreview === "string" &&
            data.messagePreview.length > 0
            ? data.messagePreview
            : `${data.requesterName || "Someone"} wants to message you`,
        actorUid: typeof data.requesterId === "string" ? data.requesterId : undefined,
        actorName: typeof data.requesterName === "string" ? data.requesterName : "Someone",
        conversationId: chatId,
        conversationScope: "dm",
        route: {
            screen: "MainTabs",
            params: {
                screen: "Messages",
                params: {
                    screen: "ChatList",
                    params: {
                        initialFilter: "requests",
                    },
                },
            },
        },
        data: {
            chatId,
            requesterId: typeof data.requesterId === "string" ? data.requesterId : undefined,
        },
    });
    return null;
});
//# sourceMappingURL=notifications.js.map