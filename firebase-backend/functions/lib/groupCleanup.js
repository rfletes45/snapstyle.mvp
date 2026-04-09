"use strict";
/**
 * Group Cleanup Cloud Function
 *
 * Firestore trigger that fires when a Groups/{groupId} document is deleted.
 * Performs cascading cleanup of:
 *   - Members subcollection
 *   - MembersPrivate subcollection
 *   - Messages subcollection
 *   - AuditLog subcollection
 *   - Firebase Storage files (avatars, message media, voice messages)
 *   - Per-user inbox entries referencing this group
 *
 * Safety:
 *   - Each cleanup step is independent and logged
 *   - Individual step failures do not block other steps
 *   - All operations use batched deletes to stay within Firestore limits
 *
 * @module functions/groupCleanup
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
exports.onGroupDeleted = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
const storage = admin.storage();
const BATCH_LIMIT = 450;
// ─── Helpers ────────────────────────────────────────────────────────────────
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
        if (snapshot.size < BATCH_LIMIT)
            break;
        snapshot = await queryRef.limit(BATCH_LIMIT).get();
    }
    return totalDeleted;
}
async function deleteSubcollection(parentRef, subcollectionName) {
    const colRef = parentRef.collection(subcollectionName);
    return deleteQueryBatched(colRef, `${parentRef.path}/${subcollectionName}`);
}
async function deleteStoragePrefix(prefix) {
    try {
        const bucket = storage.bucket();
        const [files] = await bucket.getFiles({ prefix });
        if (files.length === 0)
            return 0;
        await Promise.all(files.map((file) => file.delete().catch((err) => {
            if (err?.code !== 404) {
                functions.logger.warn(`[groupCleanup] Failed to delete storage file ${file.name}:`, err.message);
            }
        })));
        return files.length;
    }
    catch (err) {
        functions.logger.warn(`[groupCleanup] Failed to list/delete storage prefix ${prefix}:`, err.message);
        return 0;
    }
}
// ─── Inbox cleanup ──────────────────────────────────────────────────────────
/**
 * Remove inbox entries for this group from all members' Inbox subcollections.
 */
async function cleanupMemberInboxEntries(groupId, memberIds) {
    if (!memberIds || memberIds.length === 0)
        return 0;
    let cleaned = 0;
    const threadId = `group:${groupId}`;
    for (const uid of memberIds) {
        try {
            const inboxRef = db
                .collection("Users")
                .doc(uid)
                .collection("Inbox")
                .doc(threadId);
            const inboxDoc = await inboxRef.get();
            if (inboxDoc.exists) {
                await inboxRef.delete();
                cleaned++;
            }
        }
        catch (err) {
            functions.logger.warn(`[groupCleanup] Failed to clean inbox for user ${uid}:`, err.message);
        }
    }
    return cleaned;
}
// ─── Main trigger ───────────────────────────────────────────────────────────
exports.onGroupDeleted = functions.firestore
    .document("Groups/{groupId}")
    .onDelete(async (snap, context) => {
    const { groupId } = context.params;
    const groupData = snap.data();
    const memberIds = groupData?.memberIds || [];
    functions.logger.info(`[groupCleanup] Group deleted, starting cleanup`, {
        groupId,
        memberCount: memberIds.length,
    });
    const parentRef = db.collection("Groups").doc(groupId);
    const results = {};
    // Step 1: Delete Members subcollection
    try {
        results.members = await deleteSubcollection(parentRef, "Members");
        functions.logger.info(`[groupCleanup] Deleted Members`, {
            groupId,
            count: results.members,
        });
    }
    catch (err) {
        results.members = `error: ${err.message}`;
        functions.logger.error(`[groupCleanup] Failed to delete Members`, {
            groupId,
            error: err.message,
        });
    }
    // Step 2: Delete MembersPrivate subcollection
    try {
        results.membersPrivate = await deleteSubcollection(parentRef, "MembersPrivate");
        functions.logger.info(`[groupCleanup] Deleted MembersPrivate`, {
            groupId,
            count: results.membersPrivate,
        });
    }
    catch (err) {
        results.membersPrivate = `error: ${err.message}`;
        functions.logger.error(`[groupCleanup] Failed to delete MembersPrivate`, {
            groupId,
            error: err.message,
        });
    }
    // Step 3: Delete Messages subcollection
    try {
        results.messages = await deleteSubcollection(parentRef, "Messages");
        functions.logger.info(`[groupCleanup] Deleted Messages`, {
            groupId,
            count: results.messages,
        });
    }
    catch (err) {
        results.messages = `error: ${err.message}`;
        functions.logger.error(`[groupCleanup] Failed to delete Messages`, {
            groupId,
            error: err.message,
        });
    }
    // Step 4: Delete AuditLog subcollection
    try {
        results.auditLog = await deleteSubcollection(parentRef, "AuditLog");
        functions.logger.info(`[groupCleanup] Deleted AuditLog`, {
            groupId,
            count: results.auditLog,
        });
    }
    catch (err) {
        results.auditLog = `error: ${err.message}`;
        functions.logger.error(`[groupCleanup] Failed to delete AuditLog`, {
            groupId,
            error: err.message,
        });
    }
    // Step 5: Delete Storage files (avatars, message media, voice)
    try {
        results.storageFiles = await deleteStoragePrefix(`groups/${groupId}/`);
        functions.logger.info(`[groupCleanup] Deleted storage files`, {
            groupId,
            count: results.storageFiles,
        });
    }
    catch (err) {
        results.storageFiles = `error: ${err.message}`;
        functions.logger.error(`[groupCleanup] Failed to delete storage`, {
            groupId,
            error: err.message,
        });
    }
    // Step 6: Clean up inbox entries for all members
    try {
        results.inboxEntries = await cleanupMemberInboxEntries(groupId, memberIds);
        functions.logger.info(`[groupCleanup] Cleaned inbox entries`, {
            groupId,
            count: results.inboxEntries,
        });
    }
    catch (err) {
        results.inboxEntries = `error: ${err.message}`;
        functions.logger.error(`[groupCleanup] Failed to clean inbox entries`, {
            groupId,
            error: err.message,
        });
    }
    functions.logger.info(`[groupCleanup] Cleanup complete`, {
        groupId,
        results,
    });
});
//# sourceMappingURL=groupCleanup.js.map