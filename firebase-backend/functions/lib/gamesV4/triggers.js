"use strict";
/**
 * Games V4 — Firestore Triggers
 *
 * Triggers:
 * - onGameInviteV4Deleted: cleanup when invite is hard-deleted (by TTL or watchdog)
 * - onSessionV4Updated: detect status transitions and fan-out side effects
 *
 * @module gamesV4/triggers
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
exports.onRealtimeResolutionRequest = exports.onSessionV4StatusChanged = exports.onGameInviteV4Deleted = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const helpers_1 = require("./helpers");
const sessions_1 = require("./sessions");
const types_1 = require("./types");
// =============================================================================
// Trigger: onGameInviteV4Deleted
// Fires when an invite doc is deleted (by TTL policy or watchdog).
// Ensures the invite is unpinned from the conversation.
// =============================================================================
exports.onGameInviteV4Deleted = functions.firestore
    .document(`${types_1.COLLECTIONS.GAME_INVITES}/{inviteId}`)
    .onDelete(async (snap) => {
    const invite = snap.data();
    // Unpin from conversation (idempotent — arrayRemove is safe even if not present)
    try {
        await (0, helpers_1.unpinInviteFromConversation)(invite.conversationId, invite.conversationScope, invite.inviteId);
    }
    catch (err) {
        console.error(`[triggerV4] Failed to unpin deleted invite ${invite.inviteId}:`, err);
    }
    console.log(`[triggerV4] Invite ${invite.inviteId} deleted. Unpinned from ${invite.conversationScope}:${invite.conversationId}.`);
});
// =============================================================================
// Trigger: onSessionV4StatusChanged
// Fires when a session document is updated.
// Detects resolved → triggers cleanup for any side effects not handled
// by the resolve chokepoint (defensive/redundant).
// =============================================================================
exports.onSessionV4StatusChanged = functions.firestore
    .document(`${types_1.COLLECTIONS.GAME_SESSIONS}/{sessionId}`)
    .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    // Only react to status transitions
    if (before.status === after.status)
        return;
    console.log(`[triggerV4] Session ${after.sessionId} status: ${before.status} → ${after.status}`);
    // ─── Transition to resolved/abandoned/expired ─────────────────────
    if ((after.status === "resolved" ||
        after.status === "abandoned" ||
        after.status === "expired") &&
        before.status === "active") {
        // Defensive: ensure invite is also marked resolved
        // (resolveSessionV4Internal already does this, but this is a safety net)
        try {
            const db = (0, helpers_1.getDb)();
            const inviteRef = db
                .collection(types_1.COLLECTIONS.GAME_INVITES)
                .doc(after.inviteId);
            const inviteSnap = await inviteRef.get();
            if (inviteSnap.exists) {
                const invite = inviteSnap.data();
                if (invite.status !== "resolved") {
                    console.warn(`[triggerV4] Invite ${after.inviteId} not resolved — forcing.`);
                    await inviteRef.update({
                        status: "resolved",
                        updatedAt: admin.firestore.Timestamp.now(),
                        "summary.phase": "resolved",
                    });
                }
            }
        }
        catch (err) {
            console.error(`[triggerV4] Failed to sync invite status for session ${after.sessionId}:`, err);
        }
    }
    // ─── Transition to active (from lobby_open) ──────────────────────
    if (after.status === "active" && before.status === "lobby_open") {
        console.log(`[triggerV4] Session ${after.sessionId} activated from lobby.`);
        // Future: could trigger a "game started" notification here
    }
});
// =============================================================================
// Trigger: onRealtimeResolutionRequest
// Fires when the Colyseus server writes a resolution request doc
// at gameSessions/{sessionId}/internal/realtimeResolution.
// Bridges the result into the standard V4 resolution pipeline.
// =============================================================================
exports.onRealtimeResolutionRequest = functions.firestore
    .document(`${types_1.COLLECTIONS.GAME_SESSIONS}/{sessionId}/internal/realtimeResolution`)
    .onCreate(async (snap, context) => {
    const sessionId = context.params.sessionId;
    const data = snap.data();
    if (!data) {
        console.error(`[triggerV4] Empty realtimeResolution doc for session ${sessionId}`);
        return;
    }
    const resolutionType = data.resolutionType;
    const winnerIds = data.winnerIds ?? [];
    const scoreboard = data.scoreboard;
    console.log(`[triggerV4] Realtime resolution request for session ${sessionId}: ${resolutionType}, winners=${JSON.stringify(winnerIds)}`);
    try {
        await (0, sessions_1.resolveRealtimeSessionV4)(sessionId, resolutionType, winnerIds, scoreboard);
        console.log(`[triggerV4] Realtime session ${sessionId} resolved successfully.`);
    }
    catch (err) {
        console.error(`[triggerV4] Failed to resolve realtime session ${sessionId}:`, err);
    }
});
//# sourceMappingURL=triggers.js.map