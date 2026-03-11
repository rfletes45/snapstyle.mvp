"use strict";
/**
 * deleteAccount — Server-side account deletion Cloud Function
 *
 * Orchestrates complete, safe, retry-safe deletion of all user data:
 *  1. Creates a DeletionJob doc for idempotency & audit trail
 *  2. Cleans all Firestore documents, subcollections, and references
 *  3. Cleans Firebase Storage files
 *  4. Cleans Realtime Database presence/visibility
 *  5. Releases the username for reuse
 *  6. Deletes the Firebase Auth record (last step)
 *  7. Marks the DeletionJob as complete
 *
 * The function is callable (authenticated) — the caller must be the user
 * being deleted. The Auth token is verified at the Cloud Functions layer.
 *
 * Deletion ordering:
 *  - All data cleanup happens BEFORE Auth deletion so the Admin SDK still
 *    has a valid uid to reference.
 *  - Auth deletion is the final step.
 *  - If any step fails, the DeletionJob doc records how far we got so the
 *    deletion can be retried or completed manually.
 *
 * @module functions/deleteAccount
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
exports.deleteAccountFunction = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
const rtdb = admin.database();
const storage = admin.storage();
const auth = admin.auth();
// ─── Constants ──────────────────────────────────────────────────────────────
const DELETED_SENTINEL = "[deleted]";
const BATCH_LIMIT = 450; // Stay under Firestore 500-write batch limit
// ─── Helpers ────────────────────────────────────────────────────────────────
/**
 * Delete all documents in a collection query, in batches.
 * Returns count of documents deleted.
 */
async function deleteQueryBatched(queryRef, label) {
    let totalDeleted = 0;
    let snapshot = await queryRef.limit(BATCH_LIMIT).get();
    while (!snapshot.empty) {
        const batch = db.batch();
        for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
        }
        await batch.commit();
        totalDeleted += snapshot.size;
        functions.logger.info(`[deleteAccount] Deleted ${snapshot.size} docs from ${label}`);
        if (snapshot.size < BATCH_LIMIT)
            break;
        snapshot = await queryRef.limit(BATCH_LIMIT).get();
    }
    return totalDeleted;
}
/**
 * Delete all documents in a subcollection under a given parent doc ref.
 */
async function deleteSubcollection(parentRef, subcollectionName) {
    const colRef = parentRef.collection(subcollectionName);
    return deleteQueryBatched(colRef, `${parentRef.path}/${subcollectionName}`);
}
/**
 * Delete all files under a Storage prefix (folder path).
 * Silently ignores "not found" errors.
 */
async function deleteStoragePrefix(prefix) {
    try {
        const bucket = storage.bucket();
        const [files] = await bucket.getFiles({ prefix });
        if (files.length === 0)
            return 0;
        await Promise.all(files.map((file) => file.delete().catch((err) => {
            if (err?.code !== 404) {
                functions.logger.warn(`[deleteAccount] Failed to delete storage file ${file.name}:`, err.message);
            }
        })));
        functions.logger.info(`[deleteAccount] Deleted ${files.length} files from storage prefix: ${prefix}`);
        return files.length;
    }
    catch (err) {
        if (err?.code !== 404) {
            functions.logger.warn(`[deleteAccount] Storage prefix delete error for ${prefix}:`, err.message);
        }
        return 0;
    }
}
/**
 * Redact user identity in a document — replace uid/name fields with sentinel.
 */
async function redactUserInDoc(docRef, uidField, uid, additionalFields) {
    try {
        const snap = await docRef.get();
        if (!snap.exists)
            return;
        const data = snap.data();
        if (!data)
            return;
        if (data[uidField] === uid) {
            const update = {
                [uidField]: DELETED_SENTINEL,
                ...(additionalFields || {}),
            };
            await docRef.update(update);
        }
    }
    catch (err) {
        functions.logger.warn(`[deleteAccount] Failed to redact ${docRef.path}:`, err.message);
    }
}
/**
 * Remove a uid from an array field in a document using arrayRemove.
 */
async function removeFromArray(docRef, arrayField, uid) {
    try {
        await docRef.update({
            [arrayField]: admin.firestore.FieldValue.arrayRemove(uid),
        });
    }
    catch (err) {
        if (err?.code !== 5) {
            // 5 = NOT_FOUND — doc may already be deleted
            functions.logger.warn(`[deleteAccount] Failed to remove from array ${docRef.path}.${arrayField}:`, err.message);
        }
    }
}
// ─── Step Functions ─────────────────────────────────────────────────────────
async function step_deleteUserSubcollections(uid) {
    const userRef = db.collection("Users").doc(uid);
    const subcollections = [
        "inventory",
        "blockedUsers",
        "Badges",
        "TaskProgress",
        "settings",
        "Wishlist",
        "PurchaseHistory",
        "OwnedDecorations",
        "OwnedThemes",
        "Entitlements",
        "LevelRewardsV4",
        "mutedUsers",
        "Inbox",
        "MessageRequests",
        "activity",
        "ProfileViews",
        "CallHistory",
        "GamePB",
        "GamePresence",
        "NotificationDevices",
        "Notifications",
        "NotificationSessions",
        "InAppNotificationsV4",
        "Achievements",
        "AchievementSections",
        "UserStatsCache",
        "RateLimits",
        "purchases",
        "PromoUsage",
    ];
    for (const sub of subcollections) {
        await deleteSubcollection(userRef, sub);
    }
}
async function step_deleteUserProfileDoc(uid) {
    const userRef = db.collection("Users").doc(uid);
    const snap = await userRef.get();
    if (snap.exists) {
        await userRef.delete();
        functions.logger.info(`[deleteAccount] Deleted Users/${uid}`);
    }
}
async function step_releaseUsername(uid) {
    // Find the username registry doc for this user
    const usernamesSnap = await db
        .collection("Usernames")
        .where("uid", "==", uid)
        .get();
    let releasedUsername = null;
    for (const doc of usernamesSnap.docs) {
        releasedUsername = doc.id;
        await doc.ref.delete();
        functions.logger.info(`[deleteAccount] Released username: ${releasedUsername}`);
    }
    return releasedUsername;
}
async function step_deleteWallet(uid) {
    const walletRef = db.collection("Wallets").doc(uid);
    const snap = await walletRef.get();
    if (snap.exists) {
        await walletRef.delete();
        functions.logger.info(`[deleteAccount] Deleted Wallets/${uid}`);
    }
}
async function step_deleteTransactions(uid) {
    const q = db.collection("Transactions").where("uid", "==", uid);
    await deleteQueryBatched(q, "Transactions");
}
async function step_deleteFriends(uid) {
    const q = db.collection("Friends").where("users", "array-contains", uid);
    await deleteQueryBatched(q, "Friends");
}
async function step_deleteFriendRequests(uid) {
    // Delete where user sent
    const qFrom = db.collection("FriendRequests").where("from", "==", uid);
    await deleteQueryBatched(qFrom, "FriendRequests (from)");
    // Delete where user received
    const qTo = db.collection("FriendRequests").where("to", "==", uid);
    await deleteQueryBatched(qTo, "FriendRequests (to)");
}
async function step_cleanupChats(uid) {
    const chatsSnap = await db
        .collection("Chats")
        .where("members", "array-contains", uid)
        .get();
    for (const chatDoc of chatsSnap.docs) {
        const chatData = chatDoc.data();
        const members = chatData.members || [];
        const otherMembers = members.filter((m) => m !== uid);
        // Delete user's membership subdocs
        const memberDoc = chatDoc.ref.collection("Members").doc(uid);
        const memberPrivDoc = chatDoc.ref.collection("MembersPrivate").doc(uid);
        await memberDoc.delete().catch(() => { });
        await memberPrivDoc.delete().catch(() => { });
        if (otherMembers.length === 0) {
            // Both members deleted — delete entire chat and subcollections
            await deleteSubcollection(chatDoc.ref, "Messages");
            await deleteSubcollection(chatDoc.ref, "Members");
            await deleteSubcollection(chatDoc.ref, "MembersPrivate");
            await chatDoc.ref.delete();
            functions.logger.info(`[deleteAccount] Deleted empty chat: ${chatDoc.id}`);
        }
        else {
            // Remove user from members array, redact their messages
            await chatDoc.ref.update({
                members: admin.firestore.FieldValue.arrayRemove(uid),
            });
            // Redact user's sent messages in this chat
            const messagesSnap = await chatDoc.ref
                .collection("Messages")
                .where("senderId", "==", uid)
                .get();
            const messageBatches = [];
            let currentBatch = db.batch();
            let opCount = 0;
            for (const msgDoc of messagesSnap.docs) {
                currentBatch.update(msgDoc.ref, {
                    senderId: DELETED_SENTINEL,
                    senderName: DELETED_SENTINEL,
                    senderUsername: DELETED_SENTINEL,
                });
                opCount++;
                if (opCount >= BATCH_LIMIT) {
                    messageBatches.push(currentBatch);
                    currentBatch = db.batch();
                    opCount = 0;
                }
            }
            if (opCount > 0)
                messageBatches.push(currentBatch);
            for (const batch of messageBatches) {
                await batch.commit();
            }
        }
    }
}
async function step_cleanupGroups(uid) {
    const groupsSnap = await db
        .collection("Groups")
        .where("memberIds", "array-contains", uid)
        .get();
    for (const groupDoc of groupsSnap.docs) {
        const groupData = groupDoc.data();
        const memberIds = groupData.memberIds || [];
        const otherMembers = memberIds.filter((m) => m !== uid);
        // Delete membership subdocs
        await groupDoc.ref
            .collection("Members")
            .doc(uid)
            .delete()
            .catch(() => { });
        await groupDoc.ref
            .collection("MembersPrivate")
            .doc(uid)
            .delete()
            .catch(() => { });
        if (otherMembers.length === 0 && groupData.ownerId === uid) {
            // Sole owner, no other members — delete entire group
            await deleteSubcollection(groupDoc.ref, "Messages");
            await deleteSubcollection(groupDoc.ref, "Members");
            await deleteSubcollection(groupDoc.ref, "MembersPrivate");
            await groupDoc.ref.delete();
            functions.logger.info(`[deleteAccount] Deleted empty group: ${groupDoc.id}`);
        }
        else {
            // Remove from member list
            const updates = {
                memberIds: admin.firestore.FieldValue.arrayRemove(uid),
                memberCount: admin.firestore.FieldValue.increment(-1),
            };
            // Transfer ownership if needed
            if (groupData.ownerId === uid && otherMembers.length > 0) {
                updates.ownerId = otherMembers[0]; // Transfer to first remaining member
            }
            // Remove from adminIds if present
            if ((groupData.adminIds || []).includes(uid)) {
                updates.adminIds = admin.firestore.FieldValue.arrayRemove(uid);
            }
            await groupDoc.ref.update(updates);
            // Redact sent messages
            const messagesSnap = await groupDoc.ref
                .collection("Messages")
                .where("senderId", "==", uid)
                .get();
            const batches = [];
            let batch = db.batch();
            let count = 0;
            for (const msgDoc of messagesSnap.docs) {
                batch.update(msgDoc.ref, {
                    senderId: DELETED_SENTINEL,
                    senderName: DELETED_SENTINEL,
                    senderUsername: DELETED_SENTINEL,
                });
                count++;
                if (count >= BATCH_LIMIT) {
                    batches.push(batch);
                    batch = db.batch();
                    count = 0;
                }
            }
            if (count > 0)
                batches.push(batch);
            for (const b of batches)
                await b.commit();
        }
    }
}
async function step_deleteGroupInvites(uid) {
    const qFrom = db.collection("GroupInvites").where("fromUid", "==", uid);
    await deleteQueryBatched(qFrom, "GroupInvites (from)");
    const qTo = db.collection("GroupInvites").where("toUid", "==", uid);
    await deleteQueryBatched(qTo, "GroupInvites (to)");
}
async function step_deleteStories(uid) {
    // stories/{storyId} where authorId == uid
    const q = db.collection("stories").where("authorId", "==", uid);
    const snap = await q.get();
    for (const storyDoc of snap.docs) {
        await deleteSubcollection(storyDoc.ref, "views");
        await storyDoc.ref.delete();
    }
    // Stories/{uid} (legacy uppercase collection)
    const legacyRef = db.collection("Stories").doc(uid);
    const legacySnap = await legacyRef.get();
    if (legacySnap.exists) {
        await legacyRef.delete();
    }
}
async function step_deletePictures(uid) {
    // Pictures sent by user
    const q = db.collection("Pictures").where("senderId", "==", uid);
    const snap = await q.get();
    for (const picDoc of snap.docs) {
        await deleteSubcollection(picDoc.ref, "Views");
        await picDoc.ref.delete();
    }
    // Also remove uid from recipientIds on others' pictures
    const recipientSnap = await db
        .collection("Pictures")
        .where("recipientIds", "array-contains", uid)
        .get();
    for (const picDoc of recipientSnap.docs) {
        await removeFromArray(picDoc.ref, "recipientIds", uid);
    }
}
async function step_deleteConversations(uid) {
    // Legacy Conversations collection
    const collections = ["Conversations"];
    for (const colName of collections) {
        // Try both common field names for participants
        for (const field of ["participantIds", "members", "participants"]) {
            try {
                const q = db.collection(colName).where(field, "array-contains", uid);
                const snap = await q.get();
                for (const convDoc of snap.docs) {
                    await removeFromArray(convDoc.ref, field, uid);
                    // Delete messages subcollection if no other participants
                    const data = convDoc.data();
                    const participants = data[field] || [];
                    if (participants.length <= 1) {
                        await deleteSubcollection(convDoc.ref, "Messages");
                        await convDoc.ref.delete();
                    }
                }
            }
            catch {
                // Field may not exist on this collection — skip
            }
        }
    }
}
async function step_deleteNotifications(uid) {
    // Notifications where user is recipient
    const qRecipient = db.collection("Notifications").where("userId", "==", uid);
    await deleteQueryBatched(qRecipient, "Notifications (recipient)");
    // Redact notifications where user is sender (keep for recipient)
    const qSender = db.collection("Notifications").where("senderId", "==", uid);
    const senderSnap = await qSender.get();
    const batches = [];
    let batch = db.batch();
    let count = 0;
    for (const notifDoc of senderSnap.docs) {
        batch.update(notifDoc.ref, {
            senderId: DELETED_SENTINEL,
            senderUsername: DELETED_SENTINEL,
            senderName: DELETED_SENTINEL,
            senderAvatar: null,
        });
        count++;
        if (count >= BATCH_LIMIT) {
            batches.push(batch);
            batch = db.batch();
            count = 0;
        }
    }
    if (count > 0)
        batches.push(batch);
    for (const b of batches)
        await b.commit();
}
async function step_deleteScheduledMessages(uid) {
    const q = db.collection("ScheduledMessages").where("senderId", "==", uid);
    await deleteQueryBatched(q, "ScheduledMessages");
}
async function step_cleanupCalls(uid) {
    // Redact calls (keep for other participants' history)
    const q = db
        .collection("Calls")
        .where("participantUids", "array-contains", uid);
    const snap = await q.get();
    for (const callDoc of snap.docs) {
        const data = callDoc.data();
        const updates = {};
        if (data.callerId === uid) {
            updates.callerId = DELETED_SENTINEL;
            updates.callerName = DELETED_SENTINEL;
        }
        // Remove from participantUids array
        updates.participantUids = admin.firestore.FieldValue.arrayRemove(uid);
        // If there's a participants map, redact the uid entry
        if (data.participants && data.participants[uid]) {
            updates[`participants.${uid}`] = admin.firestore.FieldValue.delete();
        }
        await callDoc.ref.update(updates);
    }
    // Delete call signaling docs
    // CallSignaling/{callId}/Signals/{signalId} — these are ephemeral
    // We need to find calls involving this user then delete their signals
    const signalingFromSnap = await db
        .collectionGroup("Signals")
        .where("from", "==", uid)
        .get();
    for (const sigDoc of signalingFromSnap.docs) {
        await sigDoc.ref.delete();
    }
    const signalingToSnap = await db
        .collectionGroup("Signals")
        .where("to", "==", uid)
        .get();
    for (const sigDoc of signalingToSnap.docs) {
        await sigDoc.ref.delete();
    }
}
async function step_deleteGroupCallInvites(uid) {
    const qInviter = db
        .collection("GroupCallInvites")
        .where("inviterId", "==", uid);
    await deleteQueryBatched(qInviter, "GroupCallInvites (inviter)");
    const qInvitee = db
        .collection("GroupCallInvites")
        .where("inviteeId", "==", uid);
    await deleteQueryBatched(qInvitee, "GroupCallInvites (invitee)");
}
async function step_deletePurchases(uid) {
    for (const col of ["Purchases", "IAPPurchases", "BundlePurchases"]) {
        const q = db.collection(col).where("uid", "==", uid);
        await deleteQueryBatched(q, col);
    }
    // Legacy Inventory/{uid}
    const inventoryRef = db.collection("Inventory").doc(uid);
    const invSnap = await inventoryRef.get();
    if (invSnap.exists) {
        await inventoryRef.delete();
    }
}
async function step_cleanupGifts(uid) {
    // Delete gifts sent by user
    const qSent = db.collection("Gifts").where("senderUid", "==", uid);
    await deleteQueryBatched(qSent, "Gifts (sent)");
    // Redact sender on gifts received by others
    const qReceived = db.collection("Gifts").where("recipientUid", "==", uid);
    const receivedSnap = await qReceived.get();
    for (const giftDoc of receivedSnap.docs) {
        await giftDoc.ref.update({
            recipientUid: DELETED_SENTINEL,
            recipientUsername: DELETED_SENTINEL,
        });
    }
}
async function step_deleteModeration(uid) {
    // Delete user-specific moderation docs
    const bansRef = db.collection("Bans").doc(uid);
    const bansSnap = await bansRef.get();
    if (bansSnap.exists)
        await bansRef.delete();
    const strikesRef = db.collection("UserStrikes").doc(uid);
    const strikesSnap = await strikesRef.get();
    if (strikesSnap.exists)
        await strikesRef.delete();
    const qWarnings = db.collection("UserWarnings").where("uid", "==", uid);
    await deleteQueryBatched(qWarnings, "UserWarnings");
    // Redact reporter identity in reports (keep reports for compliance)
    const qReporterReports = db
        .collection("Reports")
        .where("reporterId", "==", uid);
    const reporterSnap = await qReporterReports.get();
    for (const reportDoc of reporterSnap.docs) {
        await reportDoc.ref.update({
            reporterId: DELETED_SENTINEL,
            reporterUsername: DELETED_SENTINEL,
        });
    }
    const qUserReports = db
        .collection("UserReports")
        .where("reporterId", "==", uid);
    const userReportsSnap = await qUserReports.get();
    for (const reportDoc of userReportsSnap.docs) {
        await reportDoc.ref.update({
            reporterId: DELETED_SENTINEL,
            reporterUsername: DELETED_SENTINEL,
        });
    }
}
async function step_deleteGameData(uid) {
    // GameInvitesV4 — delete where user is participant
    const qInvites = db
        .collection("GameInvitesV4")
        .where("participantUids", "array-contains", uid);
    const invitesSnap = await qInvites.get();
    for (const invDoc of invitesSnap.docs) {
        const data = invDoc.data();
        const participants = data.participantUids || [];
        const others = participants.filter((p) => p !== uid);
        if (others.length === 0) {
            // Solo invite — delete entirely
            await deleteSubcollection(invDoc.ref, "Lobby");
            await invDoc.ref.delete();
        }
        else {
            // Remove from participants, redact
            await invDoc.ref.update({
                participantUids: admin.firestore.FieldValue.arrayRemove(uid),
            });
        }
    }
    // GameSessionsV4 — redact player data
    const qSessions = db
        .collection("GameSessionsV4")
        .where("participantUids", "array-contains", uid);
    const sessionsSnap = await qSessions.get();
    for (const sessDoc of sessionsSnap.docs) {
        const data = sessDoc.data();
        const updates = {
            participantUids: admin.firestore.FieldValue.arrayRemove(uid),
        };
        // Remove from spectatorUids if present
        if ((data.spectatorUids || []).includes(uid)) {
            updates.spectatorUids = admin.firestore.FieldValue.arrayRemove(uid);
        }
        // Redact player info in participants map if it exists
        if (data.participants && data.participants[uid]) {
            updates[`participants.${uid}.displayName`] = DELETED_SENTINEL;
            updates[`participants.${uid}.username`] = DELETED_SENTINEL;
            updates[`participants.${uid}.profilePicture`] = null;
            updates[`participants.${uid}.deleted`] = true;
        }
        await sessDoc.ref.update(updates);
        // Delete PrivateState/{uid}
        await sessDoc.ref
            .collection("PrivateState")
            .doc(uid)
            .delete()
            .catch(() => { });
        // Redact uid in Moves
        const movesSnap = await sessDoc.ref
            .collection("Moves")
            .where("uid", "==", uid)
            .get();
        const batch = db.batch();
        let count = 0;
        for (const moveDoc of movesSnap.docs) {
            batch.update(moveDoc.ref, { uid: DELETED_SENTINEL });
            count++;
            if (count >= BATCH_LIMIT) {
                await batch.commit();
                count = 0;
            }
        }
        if (count > 0)
            await batch.commit();
    }
    // GameResultsV4 — redact
    const qResults = db
        .collection("GameResultsV4")
        .where("participantIds", "array-contains", uid);
    const resultsSnap = await qResults.get();
    for (const resDoc of resultsSnap.docs) {
        const data = resDoc.data();
        const updates = {
            participantIds: admin.firestore.FieldValue.arrayRemove(uid),
        };
        // Redact player-specific entries
        if (data.players && data.players[uid]) {
            updates[`players.${uid}.displayName`] = DELETED_SENTINEL;
            updates[`players.${uid}.username`] = DELETED_SENTINEL;
            updates[`players.${uid}.profilePicture`] = null;
            updates[`players.${uid}.deleted`] = true;
        }
        await resDoc.ref.update(updates);
    }
    // LeaderboardsV4 — delete all entries for this user
    // Path: LeaderboardsV4/{gameId}/Weeks/{weekKey}/Entries/{uid}
    // We need to find all leaderboard entries across all games & weeks
    const leaderboardGamesSnap = await db.collection("LeaderboardsV4").get();
    for (const gameDoc of leaderboardGamesSnap.docs) {
        const weeksSnap = await gameDoc.ref.collection("Weeks").get();
        for (const weekDoc of weeksSnap.docs) {
            const entryRef = weekDoc.ref.collection("Entries").doc(uid);
            const entrySnap = await entryRef.get();
            if (entrySnap.exists) {
                await entryRef.delete();
                functions.logger.info(`[deleteAccount] Deleted leaderboard entry: ${entryRef.path}`);
            }
        }
    }
}
async function step_deleteAnalytics(uid) {
    // Analytics events
    const qAnalytics = db.collectionGroup("events").where("userId", "==", uid);
    try {
        await deleteQueryBatched(qAnalytics, "Analytics events");
    }
    catch {
        // collectionGroup may not have indexes for this query — skip gracefully
    }
    // Call quality reports
    const qCallQuality = db
        .collection("CallQualityReports")
        .where("userId", "==", uid);
    await deleteQueryBatched(qCallQuality, "CallQualityReports");
}
async function step_cleanupGroupChatsLegacy(uid) {
    // Legacy GroupChats collection
    for (const field of ["memberIds", "members", "adminIds"]) {
        try {
            const q = db.collection("GroupChats").where(field, "array-contains", uid);
            const snap = await q.get();
            for (const doc of snap.docs) {
                await removeFromArray(doc.ref, field, uid);
                // Also remove from ownerId if applicable
                const data = doc.data();
                if (data.ownerId === uid) {
                    const others = (data.memberIds || data.members || []).filter((m) => m !== uid);
                    if (others.length > 0) {
                        await doc.ref.update({ ownerId: others[0] });
                    }
                }
            }
        }
        catch {
            // Field may not exist
        }
    }
}
async function step_deleteStorage(uid) {
    // User profile pictures
    await deleteStoragePrefix(`users/${uid}/`);
    // Avatars
    await deleteStoragePrefix(`avatars/${uid}/`);
    // Stories
    await deleteStoragePrefix(`stories/${uid}/`);
    // Chat-related storage: pictures, dm-voice, snaps
    // These use chatId format: uid1_uid2 (sorted). We need to find chats
    // involving this user. We'll list files with prefix containing the uid.
    // Since Storage list API doesn't support wildcards, we check both positions.
    for (const folderPrefix of ["pictures/", "dm-voice/", "snaps/"]) {
        try {
            const bucket = storage.bucket();
            const [files] = await bucket.getFiles({ prefix: folderPrefix });
            const userFiles = files.filter((f) => {
                // Extract chatId from path: folderPrefix/{chatId}/...
                const pathParts = f.name.split("/");
                if (pathParts.length < 2)
                    return false;
                const chatId = pathParts[1];
                return chatId.includes(uid);
            });
            await Promise.all(userFiles.map((file) => file.delete().catch(() => { })));
            if (userFiles.length > 0) {
                functions.logger.info(`[deleteAccount] Deleted ${userFiles.length} files from ${folderPrefix}`);
            }
        }
        catch (err) {
            functions.logger.warn(`[deleteAccount] Error cleaning ${folderPrefix}:`, err.message);
        }
    }
    // Chat staging & media (server-side written files)
    for (const folderPrefix of ["chat-staging/", "chat-media/"]) {
        try {
            const bucket = storage.bucket();
            const [files] = await bucket.getFiles({ prefix: folderPrefix });
            // Filter to files in conversations involving this user
            const userFiles = files.filter((f) => f.name.includes(uid));
            await Promise.all(userFiles.map((file) => file.delete().catch(() => { })));
            if (userFiles.length > 0) {
                functions.logger.info(`[deleteAccount] Deleted ${userFiles.length} files from ${folderPrefix}`);
            }
        }
        catch (err) {
            functions.logger.warn(`[deleteAccount] Error cleaning ${folderPrefix}:`, err.message);
        }
    }
}
async function step_deleteRealtimeDatabase(uid) {
    // Presence
    await rtdb
        .ref(`presence/${uid}`)
        .remove()
        .catch((err) => {
        functions.logger.warn(`[deleteAccount] RTDB presence cleanup error:`, err.message);
    });
    // Status visibility
    await rtdb
        .ref(`statusVisibility/${uid}`)
        .remove()
        .catch((err) => {
        functions.logger.warn(`[deleteAccount] RTDB statusVisibility cleanup error:`, err.message);
    });
}
async function step_deleteAuthUser(uid) {
    try {
        await auth.deleteUser(uid);
        functions.logger.info(`[deleteAccount] Deleted Firebase Auth user: ${uid}`);
    }
    catch (err) {
        // user-not-found is OK — already deleted (idempotent)
        if (err.code !== "auth/user-not-found") {
            throw err;
        }
        functions.logger.info(`[deleteAccount] Auth user already deleted: ${uid}`);
    }
}
// ─── Main Function ──────────────────────────────────────────────────────────
exports.deleteAccountFunction = functions
    .runWith({
    timeoutSeconds: 540, // 9 minutes max for comprehensive cleanup
    memory: "1GB",
})
    .https.onCall(async (_data, context) => {
    // ── Auth check ──
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be signed in to delete account.");
    }
    const uid = context.auth.uid;
    const email = context.auth.token.email || null;
    functions.logger.info(`[deleteAccount] Starting account deletion for uid=${uid}, email=${email}`);
    // ── Create/Resume DeletionJob doc ──
    const jobRef = db.collection("DeletionJobs").doc(uid);
    const existingJob = await jobRef.get();
    let stepsCompleted = [];
    const errors = [];
    if (existingJob.exists) {
        const existing = existingJob.data();
        if (existing.status === "completed") {
            // Already fully deleted — just delete auth if somehow still around
            await step_deleteAuthUser(uid);
            return {
                success: true,
                message: "Account was already deleted.",
                jobId: uid,
                stepsCompleted: existing.stepsCompleted,
            };
        }
        // Resume from where we left off
        stepsCompleted = existing.stepsCompleted || [];
        functions.logger.info(`[deleteAccount] Resuming deletion job. Previously completed: ${stepsCompleted.join(", ")}`);
    }
    // Fetch user profile to get username before deleting
    let username = null;
    try {
        const userSnap = await db.collection("Users").doc(uid).get();
        if (userSnap.exists) {
            const userData = userSnap.data();
            username = userData?.usernameLower || userData?.username || null;
        }
    }
    catch {
        // OK — might be partially deleted
    }
    // Write initial job doc
    await jobRef.set({
        uid,
        username,
        email,
        status: "in_progress",
        stepsCompleted,
        errors: [],
        startedAt: existingJob.exists
            ? existingJob.data().startedAt
            : admin.firestore.FieldValue.serverTimestamp(),
        completedAt: null,
    }, { merge: true });
    // ── Execute steps ──
    const steps = [
        {
            name: "deleteUserSubcollections",
            fn: () => step_deleteUserSubcollections(uid),
        },
        {
            name: "deleteWallet",
            fn: () => step_deleteWallet(uid),
        },
        {
            name: "deleteTransactions",
            fn: () => step_deleteTransactions(uid),
        },
        {
            name: "deleteFriends",
            fn: () => step_deleteFriends(uid),
        },
        {
            name: "deleteFriendRequests",
            fn: () => step_deleteFriendRequests(uid),
        },
        {
            name: "cleanupChats",
            fn: () => step_cleanupChats(uid),
        },
        {
            name: "cleanupGroups",
            fn: () => step_cleanupGroups(uid),
        },
        {
            name: "deleteGroupInvites",
            fn: () => step_deleteGroupInvites(uid),
        },
        {
            name: "cleanupGroupChatsLegacy",
            fn: () => step_cleanupGroupChatsLegacy(uid),
        },
        {
            name: "deleteStories",
            fn: () => step_deleteStories(uid),
        },
        {
            name: "deletePictures",
            fn: () => step_deletePictures(uid),
        },
        {
            name: "deleteConversations",
            fn: () => step_deleteConversations(uid),
        },
        {
            name: "deleteNotifications",
            fn: () => step_deleteNotifications(uid),
        },
        {
            name: "deleteScheduledMessages",
            fn: () => step_deleteScheduledMessages(uid),
        },
        {
            name: "cleanupCalls",
            fn: () => step_cleanupCalls(uid),
        },
        {
            name: "deleteGroupCallInvites",
            fn: () => step_deleteGroupCallInvites(uid),
        },
        {
            name: "deletePurchases",
            fn: () => step_deletePurchases(uid),
        },
        {
            name: "cleanupGifts",
            fn: () => step_cleanupGifts(uid),
        },
        {
            name: "deleteModeration",
            fn: () => step_deleteModeration(uid),
        },
        {
            name: "deleteGameData",
            fn: () => step_deleteGameData(uid),
        },
        {
            name: "deleteAnalytics",
            fn: () => step_deleteAnalytics(uid),
        },
        {
            name: "deleteStorage",
            fn: () => step_deleteStorage(uid),
        },
        {
            name: "deleteRealtimeDatabase",
            fn: () => step_deleteRealtimeDatabase(uid),
        },
        {
            name: "deleteUserProfileDoc",
            fn: () => step_deleteUserProfileDoc(uid),
        },
        {
            name: "releaseUsername",
            fn: () => step_releaseUsername(uid),
        },
        {
            name: "deleteAuthUser",
            fn: () => step_deleteAuthUser(uid),
        },
    ];
    for (const step of steps) {
        if (stepsCompleted.includes(step.name)) {
            functions.logger.info(`[deleteAccount] Skipping already-completed step: ${step.name}`);
            continue;
        }
        try {
            functions.logger.info(`[deleteAccount] Running step: ${step.name}`);
            await step.fn();
            stepsCompleted.push(step.name);
            // Persist progress after each step
            await jobRef.update({
                stepsCompleted,
            });
        }
        catch (err) {
            const errorMsg = `Step ${step.name} failed: ${err.message || err}`;
            errors.push(errorMsg);
            functions.logger.error(`[deleteAccount] ${errorMsg}`);
            // Continue to next step — we want maximum cleanup even if one step fails
            // The DeletionJob tracks what succeeded so we can retry the rest
            continue;
        }
    }
    // ── Mark job complete ──
    const allSucceeded = errors.length === 0;
    await jobRef.update({
        status: allSucceeded ? "completed" : "failed",
        stepsCompleted,
        errors,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    functions.logger.info(`[deleteAccount] Deletion ${allSucceeded ? "completed" : "completed with errors"} for uid=${uid}. ` +
        `Steps: ${stepsCompleted.length}/${steps.length}, Errors: ${errors.length}`);
    return {
        success: allSucceeded,
        message: allSucceeded
            ? "Account deleted successfully. All data has been removed."
            : `Account deletion completed with ${errors.length} error(s). Please contact support if issues persist.`,
        jobId: uid,
        stepsCompleted,
        errors: errors.length > 0 ? errors : undefined,
    };
});
//# sourceMappingURL=deleteAccount.js.map