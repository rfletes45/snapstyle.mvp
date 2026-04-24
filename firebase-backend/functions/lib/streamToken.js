"use strict";
/**
 * Stream Video Token Issuance & User Provisioning
 *
 * Mints short-lived Stream Video user tokens from the secure backend.
 * Also upserts the calling user in Stream so they exist before any call
 * operation, and provides an endpoint to ensure call members exist.
 *
 * Environment variables required (set in firebase-backend/functions/.env):
 *   STREAM_API_KEY=your_key
 *   STREAM_API_SECRET=your_secret
 *
 * @module functions/streamToken
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
exports.ensureStreamUsers = exports.getStreamVideoToken = void 0;
exports.getStreamClient = getStreamClient;
const node_sdk_1 = require("@stream-io/node-sdk");
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function getStreamConfig() {
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;
    if (!apiKey || !apiSecret) {
        throw new functions.https.HttpsError("failed-precondition", "Stream Video API key/secret not configured. Set STREAM_API_KEY and STREAM_API_SECRET in firebase-backend/functions/.env");
    }
    return { apiKey, apiSecret };
}
let _streamClient = null;
function getStreamClient() {
    if (!_streamClient) {
        const { apiKey, apiSecret } = getStreamConfig();
        _streamClient = new node_sdk_1.StreamClient(apiKey, apiSecret);
    }
    return _streamClient;
}
// ---------------------------------------------------------------------------
// Callable: getStreamVideoToken
// ---------------------------------------------------------------------------
/**
 * Authenticated callable that returns a Stream Video user token.
 * Also upserts the authenticated user in Stream so they are guaranteed
 * to exist before any call operations.
 *
 * Request: (no data required)
 * Response: { token: string; apiKey: string }
 */
exports.getStreamVideoToken = functions.https.onCall(async (_data, context) => {
    // Require authentication
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in to obtain a Stream Video token.");
    }
    const userId = context.auth.uid;
    const { apiKey } = getStreamConfig();
    const client = getStreamClient();
    // Upsert the authenticated user in Stream so they exist for call operations.
    // This is idempotent — safe to call on every token fetch.
    // Prefer Firestore profile data (displayName, avatarUrl) over Firebase Auth
    // token claims, because Auth claims are often null even when the app has
    // a rich user profile in Firestore.
    try {
        let name = context.auth.token.name || undefined;
        let image = context.auth.token.picture || undefined;
        // Fall back to Firestore profile when Auth token lacks name/image
        if (!name || !image) {
            try {
                const userDoc = await admin
                    .firestore()
                    .collection("Users")
                    .doc(userId)
                    .get();
                if (userDoc.exists) {
                    const data = userDoc.data();
                    if (!name) {
                        name = data.displayName || data.username || undefined;
                    }
                    if (!image) {
                        // Profile picture is stored as { url, thumbnailUrl, updatedAt }
                        image =
                            data.profilePicture?.url ||
                                data.profilePicture?.thumbnailUrl ||
                                undefined;
                    }
                }
            }
            catch (profileErr) {
                // Non-fatal — proceed with whatever we have
                functions.logger.warn(`[getStreamVideoToken] Firestore profile lookup failed for ${userId}:`, profileErr);
            }
        }
        await client.upsertUsers([
            {
                id: userId,
                name: name,
                image: image,
            },
        ]);
    }
    catch (err) {
        // Log but don't fail — user may already exist, and token is still valid
        functions.logger.warn(`[getStreamVideoToken] Failed to upsert user ${userId} in Stream:`, err);
    }
    // Token valid for 24 hours
    const validity = 60 * 60 * 24; // seconds
    const token = client.generateUserToken({
        user_id: userId,
        validity_in_seconds: validity,
    });
    return { token, apiKey };
});
// ---------------------------------------------------------------------------
// Callable: ensureStreamUsers
// ---------------------------------------------------------------------------
/**
 * Ensures that a list of user IDs exist in Stream Video.
 * Called by the client before creating a call to guarantee all members exist.
 *
 * Request: { userIds: string[] }
 * Response: { provisioned: number }
 */
exports.ensureStreamUsers = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    }
    const userIds = data?.userIds;
    if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "userIds must be a non-empty array of strings.");
    }
    // Limit batch size to prevent abuse
    if (userIds.length > 25) {
        throw new functions.https.HttpsError("invalid-argument", "Maximum 25 users per request.");
    }
    // Validate all IDs are strings
    for (const id of userIds) {
        if (typeof id !== "string" || id.trim().length === 0) {
            throw new functions.https.HttpsError("invalid-argument", `Invalid user ID: ${id}`);
        }
    }
    const client = getStreamClient();
    const db = admin.firestore();
    // Look up user profiles from Firestore to populate name/image
    const usersToUpsert = [];
    const userDocs = await Promise.allSettled(userIds.map((uid) => db.collection("Users").doc(uid).get()));
    for (let i = 0; i < userIds.length; i++) {
        const uid = userIds[i];
        const result = userDocs[i];
        if (result.status === "fulfilled" && result.value.exists) {
            const data = result.value.data();
            usersToUpsert.push({
                id: uid,
                name: data.displayName || data.username || undefined,
                // Profile picture is stored as { url, thumbnailUrl, updatedAt }
                image: data.profilePicture?.url ||
                    data.profilePicture?.thumbnailUrl ||
                    undefined,
            });
        }
        else {
            // User doc not found — still upsert with just the ID so Stream knows about them
            usersToUpsert.push({ id: uid });
        }
    }
    try {
        await client.upsertUsers(usersToUpsert);
    }
    catch (err) {
        functions.logger.error(`[ensureStreamUsers] Failed to upsert users:`, err);
        throw new functions.https.HttpsError("internal", "Failed to provision Stream users.");
    }
    return { provisioned: usersToUpsert.length };
});
//# sourceMappingURL=streamToken.js.map