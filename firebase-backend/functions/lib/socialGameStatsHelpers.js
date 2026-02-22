"use strict";
/**
 * Social Game Stats — Counter increment helpers
 *
 * Server-side helpers for incrementing social game stats counters
 * used by the Achievements V2 evaluator.
 *
 * Firestore path: /users/{uid}/socialGameStats/counters
 *
 * @module socialGameStatsHelpers
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
exports.incrementInvitesSent = incrementInvitesSent;
exports.incrementInvitesAccepted = incrementInvitesAccepted;
exports.incrementGamesWatched = incrementGamesWatched;
exports.incrementRematchesCompleted = incrementRematchesCompleted;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Get the Firestore reference for a user's social game stats doc.
 */
function getSocialStatsRef(userId) {
    return db
        .collection("users")
        .doc(userId)
        .collection("socialGameStats")
        .doc("counters");
}
/**
 * Increment the invitesSent counter for a user.
 */
async function incrementInvitesSent(userId) {
    try {
        await getSocialStatsRef(userId).set({
            invitesSent: firestore_1.FieldValue.increment(1),
            updatedAt: Date.now(),
        }, { merge: true });
    }
    catch (err) {
        functions.logger.warn("[SocialGameStats] Failed to increment invitesSent", {
            userId,
            error: err,
        });
    }
}
/**
 * Increment the invitesAcceptedByOthers counter for the invite sender.
 */
async function incrementInvitesAccepted(senderUserId) {
    try {
        await getSocialStatsRef(senderUserId).set({
            invitesAcceptedByOthers: firestore_1.FieldValue.increment(1),
            updatedAt: Date.now(),
        }, { merge: true });
    }
    catch (err) {
        functions.logger.warn("[SocialGameStats] Failed to increment invitesAccepted", { userId: senderUserId, error: err });
    }
}
/**
 * Increment the gamesWatched counter for a user.
 */
async function incrementGamesWatched(userId) {
    try {
        await getSocialStatsRef(userId).set({
            gamesWatched: firestore_1.FieldValue.increment(1),
            updatedAt: Date.now(),
        }, { merge: true });
    }
    catch (err) {
        functions.logger.warn("[SocialGameStats] Failed to increment gamesWatched", { userId, error: err });
    }
}
/**
 * Increment the turnBasedRematchesCompleted counter for a user.
 */
async function incrementRematchesCompleted(userId) {
    try {
        await getSocialStatsRef(userId).set({
            turnBasedRematchesCompleted: firestore_1.FieldValue.increment(1),
            updatedAt: Date.now(),
        }, { merge: true });
    }
    catch (err) {
        functions.logger.warn("[SocialGameStats] Failed to increment rematchesCompleted", { userId, error: err });
    }
}
//# sourceMappingURL=socialGameStatsHelpers.js.map