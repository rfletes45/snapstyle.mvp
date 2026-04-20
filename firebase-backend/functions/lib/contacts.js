"use strict";
/**
 * Contacts Cloud Functions
 *
 * Privacy-conscious contact sync & recommendation pipeline:
 * - syncContacts: Upload normalized identifiers, match against app users,
 *   store hashed identifiers, record reciprocal relationships.
 * - getContactRecommendations: Ranked recommendations with explanation tags.
 * - removeSyncedContacts: Delete all synced contact data for a user.
 * - updateContactDiscoverySettings: Privacy toggle persistence.
 * - matchContacts: Legacy callable for quick client-side matching.
 *
 * Data model:
 *   Users/{uid}.contactDiscovery        — settings & sync metadata
 *   Users/{uid}/syncedContactHashes/{h} — hashed contact identifiers
 *   Users/{uid}/contactedBy/{otherUid}  — reverse index (who has me)
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
exports.matchContacts = exports.updateContactDiscoverySettings = exports.removeSyncedContacts = exports.getContactRecommendations = exports.syncContacts = void 0;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
// ---------------------------------------------------------------------------
// Shared Utilities
// ---------------------------------------------------------------------------
function sha256(input) {
    return crypto.createHash("sha256").update(input).digest("hex");
}
function extractUserProfile(doc) {
    const d = doc.data();
    return {
        uid: doc.id,
        username: d.username ?? "",
        displayName: d.displayName ?? "",
        avatarConfig: d.avatarConfig ?? {},
        profilePictureUrl: d.profilePicture?.url ?? null,
        decorationId: d.avatarDecoration?.decorationId ?? null,
    };
}
async function getExclusionSets(callerUid) {
    const friendUidsSet = new Set();
    const pendingSentSet = new Set();
    const pendingReceivedSet = new Set();
    const blockedSet = new Set();
    const dismissedSet = new Set();
    const friendsSnap = await db
        .collection("Friends")
        .where("users", "array-contains", callerUid)
        .get();
    friendsSnap.forEach((fdoc) => {
        const users = fdoc.data().users;
        users.forEach((u) => {
            if (u !== callerUid)
                friendUidsSet.add(u);
        });
    });
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
    sentSnap.forEach((fdoc) => pendingSentSet.add(fdoc.data().to));
    recvSnap.forEach((fdoc) => pendingReceivedSet.add(fdoc.data().from));
    try {
        const blockedSnap = await db
            .collection("Users")
            .doc(callerUid)
            .collection("blockedUsers")
            .get();
        blockedSnap.forEach((bdoc) => blockedSet.add(bdoc.id));
    }
    catch {
        // skip
    }
    try {
        const dismissedSnap = await db
            .collection("SuggestionDismissals")
            .doc(callerUid)
            .collection("dismissed")
            .get();
        dismissedSnap.forEach((ddoc) => dismissedSet.add(ddoc.id));
    }
    catch {
        // skip
    }
    return {
        friendUids: friendUidsSet,
        pendingSent: pendingSentSet,
        pendingReceived: pendingReceivedSet,
        blocked: blockedSet,
        dismissed: dismissedSet,
        allExcluded: new Set([
            callerUid,
            ...friendUidsSet,
            ...pendingSentSet,
            ...pendingReceivedSet,
            ...blockedSet,
            ...dismissedSet,
        ]),
    };
}
async function deleteSubcollection(ref) {
    const snap = await ref.get();
    if (snap.empty)
        return;
    const batch = db.batch();
    let count = 0;
    for (const ddoc of snap.docs) {
        batch.delete(ddoc.ref);
        count++;
        if (count >= 499) {
            await batch.commit();
            count = 0;
        }
    }
    if (count > 0)
        await batch.commit();
}
exports.syncContacts = functions
    .runWith({ timeoutSeconds: 120, memory: "256MB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const callerUid = context.auth.uid;
    const { phones = [], emails = [] } = data;
    if (phones.length + emails.length > 500) {
        throw new functions.https.HttpsError("invalid-argument", "Too many identifiers. Maximum 500 per request.");
    }
    if (!Array.isArray(phones) ||
        !Array.isArray(emails) ||
        phones.some((p) => typeof p !== "string") ||
        emails.some((e) => typeof e !== "string")) {
        throw new functions.https.HttpsError("invalid-argument", "phones and emails must be arrays of strings.");
    }
    const now = Date.now();
    // ── Step 1: Hash and store contact identifiers ────────────────────
    const allHashes = [];
    for (const p of phones)
        allHashes.push(sha256(p.trim()));
    for (const e of emails)
        allHashes.push(sha256(e.trim().toLowerCase()));
    const hashRef = db
        .collection("Users")
        .doc(callerUid)
        .collection("syncedContactHashes");
    await deleteSubcollection(hashRef);
    let writeBatch = db.batch();
    let batchCount = 0;
    for (const hash of allHashes) {
        writeBatch.set(hashRef.doc(hash), { syncedAt: now });
        batchCount++;
        if (batchCount >= 499) {
            await writeBatch.commit();
            writeBatch = db.batch();
            batchCount = 0;
        }
    }
    if (batchCount > 0)
        await writeBatch.commit();
    // ── Step 2: Match identifiers against Users ───────────────────────
    const matchedUsers = [];
    const matchedUids = new Set();
    for (let i = 0; i < phones.length; i += 10) {
        const batch = phones.slice(i, i + 10);
        if (batch.length === 0)
            continue;
        try {
            const snap = await db
                .collection("Users")
                .where("phone", "in", batch)
                .get();
            snap.forEach((sdoc) => {
                const d = sdoc.data();
                if (sdoc.id === callerUid)
                    return;
                if (d.contactDiscovery?.discoverableViaContacts === false)
                    return;
                if (d.discoverability?.phone === false)
                    return;
                if (!matchedUids.has(sdoc.id)) {
                    matchedUids.add(sdoc.id);
                    matchedUsers.push({
                        ...extractUserProfile(sdoc),
                        matchType: "phone",
                    });
                }
            });
        }
        catch {
            /* skip */
        }
    }
    for (let i = 0; i < emails.length; i += 10) {
        const batch = emails.slice(i, i + 10);
        if (batch.length === 0)
            continue;
        try {
            const snap = await db
                .collection("Users")
                .where("email", "in", batch)
                .get();
            snap.forEach((sdoc) => {
                const d = sdoc.data();
                if (sdoc.id === callerUid)
                    return;
                if (d.contactDiscovery?.discoverableViaContacts === false)
                    return;
                if (d.discoverability?.email === false)
                    return;
                if (!matchedUids.has(sdoc.id)) {
                    matchedUids.add(sdoc.id);
                    matchedUsers.push({
                        ...extractUserProfile(sdoc),
                        matchType: "email",
                    });
                }
            });
        }
        catch {
            /* skip */
        }
    }
    // ── Step 3: Record reciprocal relationships ───────────────────────
    let recipBatch = db.batch();
    let recipCount = 0;
    for (const matched of matchedUsers) {
        recipBatch.set(db
            .collection("Users")
            .doc(matched.uid)
            .collection("contactedBy")
            .doc(callerUid), { syncedAt: now });
        recipCount++;
        if (recipCount >= 499) {
            await recipBatch.commit();
            recipBatch = db.batch();
            recipCount = 0;
        }
    }
    if (recipCount > 0)
        await recipBatch.commit();
    // ── Step 4: Check who has caller in their contacts ────────────────
    const contactedBySnap = await db
        .collection("Users")
        .doc(callerUid)
        .collection("contactedBy")
        .get();
    const contactedByUids = new Set();
    contactedBySnap.forEach((cbdoc) => contactedByUids.add(cbdoc.id));
    // ── Step 5: Get exclusion sets ────────────────────────────────────
    const exclusions = await getExclusionSets(callerUid);
    const callerFriendUids = exclusions.friendUids;
    // ── Step 6: Compute mutual friend counts ──────────────────────────
    const mutualCounts = new Map();
    for (const matched of matchedUsers) {
        if (exclusions.allExcluded.has(matched.uid))
            continue;
        try {
            const theirFriendsSnap = await db
                .collection("Friends")
                .where("users", "array-contains", matched.uid)
                .get();
            let mc = 0;
            theirFriendsSnap.forEach((fDoc) => {
                const users = fDoc.data().users;
                const other = users.find((u) => u !== matched.uid);
                if (other && callerFriendUids.has(other))
                    mc++;
            });
            mutualCounts.set(matched.uid, mc);
        }
        catch {
            mutualCounts.set(matched.uid, 0);
        }
    }
    // ── Step 7: Build ranked results ──────────────────────────────────
    const rankedResults = [];
    for (const matched of matchedUsers) {
        if (exclusions.allExcluded.has(matched.uid))
            continue;
        const isReciprocal = contactedByUids.has(matched.uid);
        const mutualCount = mutualCounts.get(matched.uid) ?? 0;
        let score = 3;
        if (isReciprocal)
            score += 2;
        score += mutualCount;
        const tags = ["In your contacts"];
        if (isReciprocal)
            tags.push("Has you in contacts");
        if (mutualCount > 0)
            tags.push(`${mutualCount} mutual friend${mutualCount > 1 ? "s" : ""}`);
        rankedResults.push({
            ...matched,
            reciprocal: isReciprocal,
            mutualFriendCount: mutualCount,
            explanationTags: tags,
            score,
        });
    }
    rankedResults.sort((a, b) => b.score - a.score);
    // ── Step 8: Update sync metadata ──────────────────────────────────
    await db
        .collection("Users")
        .doc(callerUid)
        .set({
        contactDiscovery: {
            syncEnabled: true,
            lastSyncedAt: now,
            syncedHashCount: allHashes.length,
        },
    }, { merge: true });
    return {
        matchedUsers: rankedResults,
        alreadyFriendUids: Array.from(exclusions.friendUids),
        pendingSentUids: Array.from(exclusions.pendingSent),
        pendingReceivedUids: Array.from(exclusions.pendingReceived),
        syncedHashCount: allHashes.length,
        syncedAt: now,
    };
});
exports.getContactRecommendations = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const callerUid = context.auth.uid;
    const userDoc = await db.collection("Users").doc(callerUid).get();
    const userData = userDoc.data();
    if (!userData?.contactDiscovery?.syncEnabled) {
        return {
            recommendations: [],
            alreadyFriendUids: [],
            pendingSentUids: [],
            pendingReceivedUids: [],
        };
    }
    const exclusions = await getExclusionSets(callerUid);
    const callerFriendUids = exclusions.friendUids;
    const contactedBySnap = await db
        .collection("Users")
        .doc(callerUid)
        .collection("contactedBy")
        .get();
    const recommendations = new Map();
    for (const cbDoc of contactedBySnap.docs) {
        const otherUid = cbDoc.id;
        if (exclusions.allExcluded.has(otherUid))
            continue;
        try {
            const otherDoc = await db.collection("Users").doc(otherUid).get();
            if (!otherDoc.exists)
                continue;
            const otherData = otherDoc.data();
            if (otherData.contactDiscovery?.discoverableViaContacts === false)
                continue;
            const profile = extractUserProfile(otherDoc);
            let isReciprocal = false;
            if (otherData.phone || otherData.email) {
                const hashesToCheck = [];
                if (otherData.phone)
                    hashesToCheck.push(sha256(otherData.phone));
                if (otherData.email)
                    hashesToCheck.push(sha256(otherData.email.trim().toLowerCase()));
                for (const h of hashesToCheck) {
                    const hDoc = await db
                        .collection("Users")
                        .doc(callerUid)
                        .collection("syncedContactHashes")
                        .doc(h)
                        .get();
                    if (hDoc.exists) {
                        isReciprocal = true;
                        break;
                    }
                }
            }
            let mutualCount = 0;
            try {
                const theirFriends = await db
                    .collection("Friends")
                    .where("users", "array-contains", otherUid)
                    .get();
                theirFriends.forEach((fDoc) => {
                    const users = fDoc.data().users;
                    const other = users.find((u) => u !== otherUid);
                    if (other && callerFriendUids.has(other))
                        mutualCount++;
                });
            }
            catch {
                /* skip */
            }
            let score = 2;
            if (isReciprocal)
                score += 3;
            score += mutualCount;
            const tags = ["Has you in contacts"];
            if (isReciprocal)
                tags.unshift("In your contacts");
            if (mutualCount > 0)
                tags.push(`${mutualCount} mutual friend${mutualCount > 1 ? "s" : ""}`);
            recommendations.set(otherUid, {
                ...profile,
                matchType: isReciprocal ? "phone" : "reciprocal",
                reciprocal: isReciprocal,
                mutualFriendCount: mutualCount,
                explanationTags: tags,
                score,
            });
        }
        catch {
            /* skip */
        }
    }
    const result = Array.from(recommendations.values());
    result.sort((a, b) => b.score - a.score);
    return {
        recommendations: result.slice(0, 50),
        alreadyFriendUids: Array.from(exclusions.friendUids),
        pendingSentUids: Array.from(exclusions.pendingSent),
        pendingReceivedUids: Array.from(exclusions.pendingReceived),
    };
});
// ═══════════════════════════════════════════════════════════════════════════
// 3. removeSyncedContacts — Delete all synced contact data
// ═══════════════════════════════════════════════════════════════════════════
exports.removeSyncedContacts = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const callerUid = context.auth.uid;
    await deleteSubcollection(db.collection("Users").doc(callerUid).collection("syncedContactHashes"));
    await db
        .collection("Users")
        .doc(callerUid)
        .set({
        contactDiscovery: {
            syncEnabled: false,
            lastSyncedAt: null,
            syncedHashCount: 0,
        },
    }, { merge: true });
    return { success: true };
});
exports.updateContactDiscoverySettings = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const callerUid = context.auth.uid;
    const update = {};
    if (typeof data.syncEnabled === "boolean")
        update["contactDiscovery.syncEnabled"] = data.syncEnabled;
    if (typeof data.discoverableViaContacts === "boolean")
        update["contactDiscovery.discoverableViaContacts"] =
            data.discoverableViaContacts;
    if (Object.keys(update).length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "No valid settings provided.");
    }
    await db.collection("Users").doc(callerUid).update(update);
    return { success: true };
});
exports.matchContacts = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const callerUid = context.auth.uid;
    const { phones = [], emails = [] } = data;
    if (phones.length + emails.length > 500) {
        throw new functions.https.HttpsError("invalid-argument", "Too many identifiers. Maximum 500 per request.");
    }
    if (!Array.isArray(phones) ||
        !Array.isArray(emails) ||
        phones.some((p) => typeof p !== "string") ||
        emails.some((e) => typeof e !== "string")) {
        throw new functions.https.HttpsError("invalid-argument", "phones and emails must be arrays of strings.");
    }
    const matchedUsers = [];
    const matchedUids = new Set();
    for (let i = 0; i < phones.length; i += 10) {
        const batch = phones.slice(i, i + 10);
        if (batch.length === 0)
            continue;
        const snap = await db
            .collection("Users")
            .where("phone", "in", batch)
            .get();
        snap.forEach((sdoc) => {
            const d = sdoc.data();
            if (sdoc.id === callerUid)
                return;
            if (d.discoverability?.phone === false)
                return;
            if (!matchedUids.has(sdoc.id)) {
                matchedUids.add(sdoc.id);
                matchedUsers.push({
                    ...extractUserProfile(sdoc),
                    matchType: "phone",
                });
            }
        });
    }
    for (let i = 0; i < emails.length; i += 10) {
        const batch = emails.slice(i, i + 10);
        if (batch.length === 0)
            continue;
        const snap = await db
            .collection("Users")
            .where("email", "in", batch)
            .get();
        snap.forEach((sdoc) => {
            const d = sdoc.data();
            if (sdoc.id === callerUid)
                return;
            if (d.discoverability?.email === false)
                return;
            if (!matchedUids.has(sdoc.id)) {
                matchedUids.add(sdoc.id);
                matchedUsers.push({
                    ...extractUserProfile(sdoc),
                    matchType: "email",
                });
            }
        });
    }
    const exclusions = await getExclusionSets(callerUid);
    return {
        onAppUsers: matchedUsers.filter((u) => !exclusions.allExcluded.has(u.uid)),
        alreadyFriendUids: Array.from(exclusions.friendUids),
        pendingSentUids: Array.from(exclusions.pendingSent),
        pendingReceivedUids: Array.from(exclusions.pendingReceived),
    };
});
//# sourceMappingURL=contacts.js.map