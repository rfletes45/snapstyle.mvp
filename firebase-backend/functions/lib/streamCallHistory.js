"use strict";
/**
 * Stream Call History — Server-side recording via Stream webhooks.
 *
 * Stream sends webhook events for call lifecycle. This function receives
 * `call.session_ended` events and records normalized history entries in
 * each participant's `StreamCallHistory` subcollection.
 *
 * Webhook URL: https://<region>-<project>.cloudfunctions.net/streamCallWebhook
 * Configure in Stream Dashboard → Webhooks → call.session_ended
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
exports.streamCallWebhook = void 0;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------
exports.streamCallWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    // Verify webhook authenticity via Stream's HMAC-SHA256 signature.
    // Stream signs every webhook body with your API Secret and sends
    // the hex digest in the X-Signature header.
    const apiSecret = process.env.STREAM_API_SECRET;
    const signature = req.headers["x-signature"];
    if (apiSecret && signature) {
        const expectedSignature = crypto
            .createHmac("sha256", apiSecret)
            .update(req.rawBody)
            .digest("hex");
        if (signature !== expectedSignature) {
            functions.logger.warn("Stream webhook: invalid X-Signature");
            res.status(401).send("Unauthorized");
            return;
        }
    }
    else if (apiSecret && !signature) {
        functions.logger.warn("Stream webhook: missing X-Signature header");
        res.status(401).send("Unauthorized");
        return;
    }
    try {
        const event = req.body;
        const eventType = event?.type;
        if (eventType !== "call.session_ended") {
            // We only care about session-ended events for history
            res.status(200).send("OK — ignored event type");
            return;
        }
        const call = event?.call;
        if (!call) {
            res.status(400).send("Missing call data");
            return;
        }
        const callId = call.id;
        const callType = call.type; // "default" or "audio_room"
        const createdBy = call.created_by?.id ?? "";
        const custom = call.custom ?? {};
        const members = call.members ?? [];
        const session = call.session ?? {};
        const startedAt = session.started_at
            ? new Date(session.started_at).getTime()
            : Date.now();
        const endedAt = session.ended_at
            ? new Date(session.ended_at).getTime()
            : Date.now();
        const durationSeconds = Math.round((endedAt - startedAt) / 1000);
        const isVoiceRoom = callType === "audio_room";
        const groupId = custom.groupId ?? null;
        const groupName = custom.groupName ?? null;
        const participantIds = members.map((m) => m.user_id);
        const now = Date.now();
        const batch = db.batch();
        for (const member of members) {
            const userId = member.user_id;
            let entry;
            if (isVoiceRoom) {
                entry = {
                    id: `${callId}_${userId}`,
                    userId,
                    callId,
                    entryType: "voice_room",
                    direction: "joined",
                    result: "left",
                    startedAt,
                    endedAt,
                    durationSeconds,
                    otherUserId: null,
                    otherUserName: null,
                    otherUserAvatar: null,
                    groupId,
                    groupName,
                    groupAvatar: null,
                    participantCount: participantIds.length,
                    initiatedBy: createdBy,
                    createdAt: now,
                };
            }
            else {
                // Direct call — determine peer and direction
                const otherMember = members.find((m) => m.user_id !== userId);
                const isOutgoing = userId === createdBy;
                // Determine result — if the session has meaningful duration, it was completed
                let result = "completed";
                if (durationSeconds < 2 && !isOutgoing) {
                    result = "missed";
                }
                entry = {
                    id: callId,
                    userId,
                    callId,
                    entryType: custom.mode === "video" ? "direct_video" : "direct_audio",
                    direction: isOutgoing ? "outgoing" : "incoming",
                    result,
                    startedAt,
                    endedAt,
                    durationSeconds: result === "completed" ? durationSeconds : null,
                    otherUserId: otherMember?.user_id ?? null,
                    otherUserName: otherMember?.user?.name ?? null,
                    otherUserAvatar: otherMember?.user?.image ?? null,
                    groupId: null,
                    groupName: null,
                    groupAvatar: null,
                    participantCount: null,
                    initiatedBy: createdBy,
                    createdAt: now,
                };
            }
            const docRef = db
                .collection("Users")
                .doc(userId)
                .collection("StreamCallHistory")
                .doc(entry.id);
            batch.set(docRef, entry, { merge: true });
        }
        await batch.commit();
        functions.logger.info("Stream call history recorded", {
            callId,
            callType,
            participants: participantIds.length,
        });
        res.status(200).send("OK");
    }
    catch (error) {
        functions.logger.error("Stream webhook processing error", { error });
        res.status(500).send("Internal error");
    }
});
//# sourceMappingURL=streamCallHistory.js.map