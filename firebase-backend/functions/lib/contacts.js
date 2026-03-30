"use strict";
/**
 * Contacts Matching Cloud Function
 *
 * Accepts normalized contact identifiers (phones/emails) and returns
 * categorized match results. Privacy-conscious:
 * - Requires authentication
 * - Respects user discoverability settings
 * - Rate-limited
 * - Never returns raw contact data to other users
 *
 * @module functions/contacts
 */
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
exports.matchContacts = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
/**
 * matchContacts — Callable function for contact-based friend discovery.
 *
 * Input: { phones: string[], emails: string[] }
 * Output: { onAppUsers, alreadyFriendUids, pendingSentUids, pendingReceivedUids }
 */
exports.matchContacts = functions.https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const callerUid = context.auth.uid;
    const { phones = [], emails = [] } = data;
    // Rate limit: max 500 identifiers per call
    if (phones.length + emails.length > 500) {
        throw new functions.https.HttpsError("invalid-argument", "Too many identifiers. Maximum 500 per request.");
    }
    // Validate input types
    if (!Array.isArray(phones) ||
        !Array.isArray(emails) ||
        phones.some((p) => typeof p !== "string") ||
        emails.some((e) => typeof e !== "string")) {
        throw new functions.https.HttpsError("invalid-argument", "phones and emails must be arrays of strings.");
    }
    const matchedUsers = [];
    const matchedUids = new Set();
    // Query by phone in batches of 10 (Firestore `in` limit)
    for (let i = 0; i < phones.length; i += 10) {
        const batch = phones.slice(i, i + 10);
        if (batch.length === 0)
            continue;
        const snap = await db
            .collection("Users")
            .where("phone", "in", batch)
            .get();
        snap.forEach((doc) => {
            const d = doc.data();
            if (doc.id === callerUid)
                return;
            // Respect discoverability settings
            if (d.discoverability?.phone === false)
                return;
            if (!matchedUids.has(doc.id)) {
                matchedUids.add(doc.id);
                matchedUsers.push({
                    uid: doc.id,
                    username: d.username,
                    displayName: d.displayName,
                    avatarConfig: d.avatarConfig,
                    profilePictureUrl: d.profilePicture?.url ?? null,
                    decorationId: d.avatarDecoration?.decorationId ?? null,
                    matchType: "phone",
                });
            }
        });
    }
    // Query by email in batches of 10
    for (let i = 0; i < emails.length; i += 10) {
        const batch = emails.slice(i, i + 10);
        if (batch.length === 0)
            continue;
        const snap = await db
            .collection("Users")
            .where("email", "in", batch)
            .get();
        snap.forEach((doc) => {
            const d = doc.data();
            if (doc.id === callerUid)
                return;
            if (d.discoverability?.email === false)
                return;
            if (!matchedUids.has(doc.id)) {
                matchedUids.add(doc.id);
                matchedUsers.push({
                    uid: doc.id,
                    username: d.username,
                    displayName: d.displayName,
                    avatarConfig: d.avatarConfig,
                    profilePictureUrl: d.profilePicture?.url ?? null,
                    decorationId: d.avatarDecoration?.decorationId ?? null,
                    matchType: "email",
                });
            }
        });
    }
    // Get current friends
    const friendsSnap = await db
        .collection("Friends")
        .where("users", "array-contains", callerUid)
        .get();
    const friendUids = [];
    friendsSnap.forEach((doc) => {
        const users = doc.data().users;
        const other = users.find((u) => u !== callerUid);
        if (other)
            friendUids.push(other);
    });
    // Get pending requests
    const [sentSnap, recvSnap] = await Promise.all([
        db
            .collection("FriendRequests")
            .where("from", "==", callerUid)
            .where("status", "==", "pending")
            .get(),
        db
            .collection("FriendRequests")
            .where("to", "==", callerUid)
            .where("status", "==", "pending")
            .get(),
    ]);
    const pendingSentUids = [];
    sentSnap.forEach((doc) => pendingSentUids.push(doc.data().to));
    const pendingReceivedUids = [];
    recvSnap.forEach((doc) => pendingReceivedUids.push(doc.data().from));
    return {
        onAppUsers: matchedUsers,
        alreadyFriendUids: friendUids,
        pendingSentUids,
        pendingReceivedUids,
    };
});
//# sourceMappingURL=contacts.js.map