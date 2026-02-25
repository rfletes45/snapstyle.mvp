"use strict";
/**
 * profileViews — Server-authoritative profile view counter.
 *
 * Instead of letting clients write directly to another user's profile doc,
 * this callable increments `profileViews` via the admin SDK and deduplicates
 * per viewer/target pair within a 24-hour window.
 *
 * @module functions/profileViews
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
exports.incrementProfileViews = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
// 24-hour dedup window (in milliseconds)
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;
/**
 * Callable: incrementProfileViews
 *
 * Input: { targetUid: string }
 * - Auth required
 * - Cannot view own profile
 * - Deduplicates per viewer per target within 24h
 * - Increments Users/{targetUid}.profileViews via admin SDK
 */
exports.incrementProfileViews = functions.https.onCall(async (data, context) => {
    // 1. Auth check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const viewerUid = context.auth.uid;
    const { targetUid } = data;
    // 2. Validate input
    if (!targetUid || typeof targetUid !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "targetUid is required");
    }
    // 3. Cannot view own profile
    if (viewerUid === targetUid) {
        return { ok: true };
    }
    try {
        // 4. Dedup check — Users/{targetUid}/ProfileViews/{viewerUid}
        const dedupRef = db
            .collection("Users")
            .doc(targetUid)
            .collection("ProfileViews")
            .doc(viewerUid);
        const dedupSnap = await dedupRef.get();
        if (dedupSnap.exists) {
            const lastViewedAt = dedupSnap.data()?.lastViewedAt;
            if (lastViewedAt &&
                typeof lastViewedAt === "number" &&
                Date.now() - lastViewedAt < DEDUP_WINDOW_MS) {
                // Within dedup window — skip increment
                return { ok: true };
            }
        }
        // 5. Increment + update dedup atomically via batch
        const batch = db.batch();
        // Increment counter on the user doc
        const userRef = db.collection("Users").doc(targetUid);
        batch.update(userRef, { profileViews: firestore_1.FieldValue.increment(1) });
        // Upsert dedup doc
        batch.set(dedupRef, { lastViewedAt: Date.now() }, { merge: true });
        await batch.commit();
        return { ok: true };
    }
    catch (error) {
        // Non-critical — do not throw to client
        functions.logger.warn("incrementProfileViews failed:", error);
        return { ok: true };
    }
});
//# sourceMappingURL=profileViews.js.map