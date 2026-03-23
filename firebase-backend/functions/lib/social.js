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
exports.onStoryViewed = exports.onFriendRequestAccepted = exports.onNewFriendRequest = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const legacy_1 = require("./legacy");
Object.defineProperty(exports, "onStoryViewed", { enumerable: true, get: function () { return legacy_1.onStoryViewed; } });
const notificationCenter_1 = require("./notificationCenter");
const db = admin.firestore();
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
exports.onNewFriendRequest = functions.firestore
    .document("FriendRequests/{requestId}")
    .onCreate(async (snap, context) => {
    const request = snap.data();
    const { requestId } = context.params;
    const senderUid = request.from;
    const recipientUid = request.to;
    if (!senderUid || !recipientUid || senderUid === recipientUid) {
        return null;
    }
    const senderName = await getUserDisplayName(senderUid);
    await (0, notificationCenter_1.notifyUser)({
        recipientUid,
        type: "friend_request",
        category: "social",
        dedupeKey: `friend_request:${requestId}`,
        collapseKey: "friend_request",
        title: "New friend request",
        body: `${senderName} wants to be your friend`,
        actorUid: senderUid,
        actorName: senderName,
        requestId,
        route: {
            screen: "Friends",
            params: { tab: "requests" },
        },
        data: {
            requestId,
            senderId: senderUid,
            senderName,
        },
    });
    return null;
});
exports.onFriendRequestAccepted = functions.firestore
    .document("FriendRequests/{requestId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const { requestId } = context.params;
    if (before.status === "accepted" || after.status !== "accepted") {
        return null;
    }
    const senderUid = after.from;
    const accepterUid = after.to;
    if (!senderUid || !accepterUid || senderUid === accepterUid) {
        return null;
    }
    const accepterName = await getUserDisplayName(accepterUid);
    await (0, notificationCenter_1.notifyUser)({
        recipientUid: senderUid,
        type: "friend_request_accepted",
        category: "social",
        dedupeKey: `friend_request_accepted:${requestId}`,
        collapseKey: "friend_request",
        title: "Friend request accepted",
        body: `${accepterName} accepted your request`,
        actorUid: accepterUid,
        actorName: accepterName,
        requestId,
        route: {
            screen: "Friends",
        },
        data: {
            requestId,
            accepterId: accepterUid,
            accepterName,
        },
    });
    return null;
});
//# sourceMappingURL=social.js.map