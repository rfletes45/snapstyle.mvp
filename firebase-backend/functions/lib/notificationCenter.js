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
exports.notifyUser = notifyUser;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const crypto_1 = require("crypto");
const utils_1 = require("./utils");
const db = admin.firestore();
const NOTIFICATION_SESSION_STALE_MS = 90_000;
const DEFAULT_NOTIFICATION_PREFERENCES = {
    notificationsEnabled: true,
    inAppNotificationsEnabled: true,
    messageNotificationsEnabled: true,
    socialNotificationsEnabled: true,
    gameNotificationsEnabled: true,
    achievementNotificationsEnabled: true,
    giftNotificationsEnabled: true,
    storyNotificationsEnabled: true,
    streakNotificationsEnabled: true,
    badgeCountEnabled: true,
};
function timestampToMillis(value) {
    if (!value)
        return 0;
    if (typeof value === "number")
        return value;
    if (typeof value === "object" &&
        value !== null &&
        typeof value.toMillis === "function") {
        return value.toMillis();
    }
    return 0;
}
function removeUndefined(value) {
    if (Array.isArray(value)) {
        return value
            .map((entry) => removeUndefined(entry))
            .filter((entry) => entry !== undefined);
    }
    if (value && typeof value === "object") {
        const next = {};
        for (const [key, entry] of Object.entries(value)) {
            if (entry === undefined)
                continue;
            next[key] = removeUndefined(entry);
        }
        return next;
    }
    return value;
}
function buildNotificationId(dedupeKey) {
    return (0, crypto_1.createHash)("sha256").update(dedupeKey).digest("hex").slice(0, 40);
}
function isRecipientViewingConversation(session, request) {
    if (!request.conversationId || !session.currentChatId)
        return false;
    if (session.currentChatId !== request.conversationId)
        return false;
    if (!request.conversationScope)
        return true;
    if (request.conversationScope === "group") {
        return (session.currentConversationScope === "group" ||
            session.currentScreen === "GroupChat");
    }
    return (session.currentConversationScope === "dm" ||
        session.currentScreen === "ChatDetail");
}
function isRecipientViewingGame(session, request) {
    if (!request.sessionId || !session.currentGameSessionId)
        return false;
    return request.sessionId === session.currentGameSessionId;
}
function isRecipientViewingGameInvite(session, request) {
    if (!request.inviteId || !session.currentGameInviteId)
        return false;
    return request.inviteId === session.currentGameInviteId;
}
function isRecipientViewingEquivalentSurface(session, request) {
    if (isRecipientViewingConversation(session, request))
        return true;
    if (isRecipientViewingGame(session, request))
        return true;
    if (isRecipientViewingGameInvite(session, request))
        return true;
    if (request.type === "friend_request" ||
        request.type === "friend_request_accepted") {
        return session.currentScreen === "Connections";
    }
    if (request.type === "achievement_unlocked") {
        return (session.currentScreen === "AchievementsHub" ||
            session.currentScreen === "AchievementSection");
    }
    if (request.type === "gift_received" || request.type === "gift_opened") {
        return (session.currentScreen === "Wallet" ||
            session.currentScreen === "PurchaseHistory");
    }
    if (request.type === "message_request" &&
        (session.currentScreen === "ChatList" || session.currentScreen === "Connections")) {
        return true;
    }
    return false;
}
async function getNotificationPreferences(uid) {
    try {
        const inboxDoc = await db
            .collection("Users")
            .doc(uid)
            .collection("settings")
            .doc("inbox")
            .get();
        if (!inboxDoc.exists) {
            return DEFAULT_NOTIFICATION_PREFERENCES;
        }
        return {
            ...DEFAULT_NOTIFICATION_PREFERENCES,
            ...inboxDoc.data(),
        };
    }
    catch (error) {
        functions.logger.warn("[notificationCenter] Failed to read preferences", {
            uid,
            error: error instanceof Error ? error.message : String(error),
        });
        return DEFAULT_NOTIFICATION_PREFERENCES;
    }
}
function categoryEnabledForEvent(prefs, type) {
    switch (type) {
        case "dm_message":
        case "group_message":
        case "message_request":
            return prefs.messageNotificationsEnabled;
        case "friend_request":
        case "friend_request_accepted":
            return prefs.socialNotificationsEnabled;
        case "game_invite":
        case "game_lobby_ready":
        case "game_turn":
        case "game_resolved":
            return prefs.gameNotificationsEnabled;
        case "achievement_unlocked":
            return prefs.achievementNotificationsEnabled;
        case "gift_received":
        case "gift_opened":
            return prefs.giftNotificationsEnabled;
        default:
            return true;
    }
}
async function isConversationMuted(uid, conversationId, scope) {
    if (scope === "dm") {
        return (0, utils_1.isDmChatMuted)(conversationId, uid);
    }
    return (0, utils_1.isGroupChatMuted)(conversationId, uid);
}
async function getFreshNotificationSessions(uid) {
    const now = Date.now();
    const snapshot = await db
        .collection("Users")
        .doc(uid)
        .collection("NotificationSessions")
        .get();
    return snapshot.docs
        .map((docSnap) => {
        const data = docSnap.data();
        return {
            deviceId: docSnap.id,
            appState: String(data.appState ?? "unknown"),
            currentScreen: typeof data.currentScreen === "string" ? data.currentScreen : null,
            currentChatId: typeof data.currentChatId === "string" ? data.currentChatId : null,
            currentConversationScope: typeof data.currentConversationScope === "string"
                ? data.currentConversationScope
                : null,
            currentGameSessionId: typeof data.currentGameSessionId === "string"
                ? data.currentGameSessionId
                : null,
            currentGameInviteId: typeof data.currentGameInviteId === "string"
                ? data.currentGameInviteId
                : null,
            currentGameRuntimeType: typeof data.currentGameRuntimeType === "string"
                ? data.currentGameRuntimeType
                : null,
            inAppEnabled: data.inAppEnabled !== false,
            updatedAtMs: timestampToMillis(data.updatedAt ?? data.lastHeartbeatAt),
        };
    })
        .filter((session) => session.updatedAtMs > 0 &&
        now - session.updatedAtMs <= NOTIFICATION_SESSION_STALE_MS)
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}
async function getPushDevices(uid) {
    const devicesSnap = await db
        .collection("Users")
        .doc(uid)
        .collection("NotificationDevices")
        .get();
    const tokenSeen = new Set();
    const devices = [];
    for (const docSnap of devicesSnap.docs) {
        const data = docSnap.data();
        if (data.pushEnabled === false)
            continue;
        const token = typeof data.expoPushToken === "string" ? data.expoPushToken : null;
        if (!token || tokenSeen.has(token))
            continue;
        tokenSeen.add(token);
        devices.push({
            deviceId: docSnap.id,
            expoPushToken: token,
            platform: typeof data.platform === "string" ? data.platform : null,
        });
    }
    if (devices.length === 0) {
        const userDoc = await db.collection("Users").doc(uid).get();
        const legacyToken = typeof userDoc.data()?.expoPushToken === "string"
            ? userDoc.data()?.expoPushToken
            : null;
        if (legacyToken && !tokenSeen.has(legacyToken)) {
            devices.push({
                deviceId: "legacy",
                expoPushToken: legacyToken,
                platform: null,
            });
        }
    }
    return devices;
}
async function chooseNotificationDecision(request, prefs) {
    if (!prefs.notificationsEnabled) {
        return { channel: "none", reason: "global_notifications_disabled" };
    }
    if (!categoryEnabledForEvent(prefs, request.type)) {
        return { channel: "none", reason: "category_notifications_disabled" };
    }
    if (request.respectConversationMute &&
        request.conversationId &&
        request.conversationScope) {
        const muted = await isConversationMuted(request.recipientUid, request.conversationId, request.conversationScope);
        if (muted) {
            return { channel: "none", reason: "conversation_muted" };
        }
    }
    const sessions = await getFreshNotificationSessions(request.recipientUid);
    const activeSessions = sessions.filter((session) => session.appState === "active");
    if (activeSessions.some((session) => isRecipientViewingEquivalentSurface(session, request))) {
        return { channel: "none", reason: "already_viewing_target" };
    }
    if (activeSessions.length > 0) {
        if (!prefs.inAppNotificationsEnabled) {
            return {
                channel: "none",
                reason: "active_session_but_in_app_disabled",
            };
        }
        const targetSession = activeSessions.find((session) => session.inAppEnabled);
        if (!targetSession) {
            return {
                channel: "none",
                reason: "active_session_local_banners_disabled",
            };
        }
        return {
            channel: "in_app",
            reason: "active_session_available",
            targetDeviceId: targetSession.deviceId,
        };
    }
    const pushDevices = await getPushDevices(request.recipientUid);
    if (pushDevices.length === 0) {
        return { channel: "none", reason: "no_push_devices" };
    }
    return {
        channel: "push",
        reason: "no_active_session",
        pushDevices,
    };
}
function buildNotificationDoc(request, decision, prefs) {
    const payloadData = removeUndefined({
        notificationId: buildNotificationId(request.dedupeKey),
        dedupeKey: request.dedupeKey,
        collapseKey: request.collapseKey ?? request.dedupeKey,
        type: request.type,
        actorUid: request.actorUid ?? null,
        actorName: request.actorName ?? null,
        conversationId: request.conversationId ?? null,
        conversationScope: request.conversationScope ?? null,
        requestId: request.requestId ?? null,
        sessionId: request.sessionId ?? null,
        inviteId: request.inviteId ?? null,
        gameId: request.gameId ?? null,
        sectionId: request.sectionId ?? null,
        giftId: request.giftId ?? null,
        route: removeUndefined(request.route),
        ...request.data,
    });
    return removeUndefined({
        recipientUid: request.recipientUid,
        type: request.type,
        category: request.category,
        dedupeKey: request.dedupeKey,
        collapseKey: request.collapseKey ?? request.dedupeKey,
        title: request.title,
        body: request.body,
        actorUid: request.actorUid ?? null,
        actorName: request.actorName ?? null,
        conversationId: request.conversationId ?? null,
        conversationScope: request.conversationScope ?? null,
        requestId: request.requestId ?? null,
        sessionId: request.sessionId ?? null,
        inviteId: request.inviteId ?? null,
        gameId: request.gameId ?? null,
        sectionId: request.sectionId ?? null,
        giftId: request.giftId ?? null,
        route: removeUndefined(request.route),
        data: payloadData,
        channel: decision.channel,
        deliveryReason: decision.reason,
        targetDeviceId: decision.targetDeviceId ?? null,
        pushTargetDeviceIds: decision.pushDevices?.map((device) => device.deviceId) ?? [],
        pushSentAt: null,
        presentedAt: null,
        readAt: null,
        archivedAt: null,
        badgeEligible: prefs.badgeCountEnabled && (request.badgeEligible ?? true) === true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
async function createNotificationRecordIfNeeded(request, decision, prefs) {
    const notificationId = buildNotificationId(request.dedupeKey);
    const ref = db
        .collection("Users")
        .doc(request.recipientUid)
        .collection("Notifications")
        .doc(notificationId);
    try {
        await ref.create(buildNotificationDoc(request, decision, prefs));
        return { notificationId, created: true };
    }
    catch (error) {
        if (error?.code === 6 || error?.code === "already-exists") {
            return { notificationId, created: false };
        }
        throw error;
    }
}
async function cleanupInvalidPushTarget(uid, deviceId) {
    if (deviceId === "legacy") {
        await db.collection("Users").doc(uid).set({
            expoPushToken: admin.firestore.FieldValue.delete(),
        }, { merge: true });
        return;
    }
    await db
        .collection("Users")
        .doc(uid)
        .collection("NotificationDevices")
        .doc(deviceId)
        .set({
        expoPushToken: null,
        pushEnabled: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
async function getUnreadBadgeCount(uid) {
    const unreadSnap = await db
        .collection("Users")
        .doc(uid)
        .collection("Notifications")
        .where("badgeEligible", "==", true)
        .where("readAt", "==", null)
        .get();
    return unreadSnap.size;
}
async function sendPushNotifications(request, notificationId, pushDevices, prefs) {
    const badgeCount = prefs.badgeCountEnabled
        ? await getUnreadBadgeCount(request.recipientUid)
        : undefined;
    const messages = pushDevices.map((device) => removeUndefined({
        to: device.expoPushToken,
        title: request.title,
        body: request.body,
        sound: "default",
        badge: badgeCount,
        data: removeUndefined({
            notificationId,
            dedupeKey: request.dedupeKey,
            collapseKey: request.collapseKey ?? request.dedupeKey,
            type: request.type,
            actorUid: request.actorUid ?? null,
            actorName: request.actorName ?? null,
            conversationId: request.conversationId ?? null,
            conversationScope: request.conversationScope ?? null,
            requestId: request.requestId ?? null,
            sessionId: request.sessionId ?? null,
            inviteId: request.inviteId ?? null,
            gameId: request.gameId ?? null,
            sectionId: request.sectionId ?? null,
            giftId: request.giftId ?? null,
            route: removeUndefined(request.route),
            ...request.data,
        }),
        channelId: request.category === "games" ? "game-invites" : "default",
        collapseId: request.collapseKey ?? request.dedupeKey,
    }));
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Expo push request failed (${response.status}): ${body}`);
    }
    const result = (await response.json());
    const results = Array.isArray(result?.data) ? result.data : [];
    await Promise.all(results.map(async (entry, index) => {
        const errorCode = entry?.details?.error;
        if (errorCode !== "DeviceNotRegistered")
            return;
        const device = pushDevices[index];
        if (!device)
            return;
        await cleanupInvalidPushTarget(request.recipientUid, device.deviceId);
    }));
    await db
        .collection("Users")
        .doc(request.recipientUid)
        .collection("Notifications")
        .doc(notificationId)
        .set({
        pushSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
async function notifyUser(request) {
    const prefs = await getNotificationPreferences(request.recipientUid);
    const decision = await chooseNotificationDecision(request, prefs);
    if (decision.channel === "none") {
        return {
            channel: "none",
            reason: decision.reason,
        };
    }
    const record = await createNotificationRecordIfNeeded(request, decision, prefs);
    if (!record.created) {
        return {
            channel: decision.channel,
            notificationId: record.notificationId,
            reason: "duplicate_suppressed",
        };
    }
    if (decision.channel === "push" && decision.pushDevices?.length) {
        try {
            await sendPushNotifications(request, record.notificationId, decision.pushDevices, prefs);
        }
        catch (error) {
            functions.logger.error("[notificationCenter] Failed to send push", {
                recipientUid: request.recipientUid,
                notificationId: record.notificationId,
                type: request.type,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return {
        channel: decision.channel,
        notificationId: record.notificationId,
        reason: decision.reason,
    };
}
//# sourceMappingURL=notificationCenter.js.map