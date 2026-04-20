"use strict";
/**
 * Stream Call History webhook.
 *
 * Persists server-authored call history to `Users/{uid}/StreamCallHistory/*`.
 *
 * Handled events:
 * - `call.session_ended` for completed direct calls and voice-room sessions
 * - `call.rejected` for declined / canceled / timed-out ringing calls
 * - `call.missed` for missed incoming ringing calls
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
exports.streamCallWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    const apiSecret = process.env.STREAM_API_SECRET;
    const signature = req.headers["x-signature"];
    if (!apiSecret) {
        functions.logger.error("Stream webhook: STREAM_API_SECRET not configured — rejecting request. " +
            "Set it in firebase-backend/functions/.env");
        res.status(500).send("Server misconfiguration");
        return;
    }
    if (!signature) {
        functions.logger.warn("Stream webhook: missing X-Signature header");
        res.status(401).send("Unauthorized");
        return;
    }
    const expectedSignature = crypto
        .createHmac("sha256", apiSecret)
        .update(req.rawBody)
        .digest("hex");
    if (signature !== expectedSignature) {
        functions.logger.warn("Stream webhook: invalid X-Signature");
        res.status(401).send("Unauthorized");
        return;
    }
    try {
        const event = req.body ?? {};
        const eventType = event.type;
        if (eventType !== "call.session_ended" &&
            eventType !== "call.rejected" &&
            eventType !== "call.missed") {
            res.status(200).send("OK - ignored event type");
            return;
        }
        const call = event.call;
        if (!call?.id) {
            res.status(400).send("Missing call data");
            return;
        }
        const batch = db.batch();
        if (eventType === "call.session_ended") {
            writeSessionEndedEntries(batch, call);
        }
        else if (eventType === "call.rejected") {
            writeRejectedEntries(batch, call, event);
        }
        else if (eventType === "call.missed") {
            writeMissedEntries(batch, call, event);
        }
        await batch.commit();
        functions.logger.info("Stream call history recorded", {
            callId: call.id,
            callType: call.type,
            eventType,
        });
        res.status(200).send("OK");
    }
    catch (error) {
        functions.logger.error("Stream webhook processing error", { error });
        res.status(500).send("Internal error");
    }
});
function writeSessionEndedEntries(batch, call) {
    const createdBy = call.created_by?.id ?? "";
    const custom = call.custom ?? {};
    const startedAt = toMillis(call.session?.started_at, call.created_at);
    const endedAt = toMillis(call.session?.ended_at, undefined);
    const createdAt = endedAt ?? Date.now();
    if (isVoiceRoomCall(call)) {
        const participants = getSessionParticipants(call);
        const participantCount = participants.length;
        const groupId = custom.groupId ?? getGroupIdFromCallId(call.id);
        const groupName = custom.groupName ?? "Voice Room";
        for (const participant of participants) {
            if (!participant.user_id)
                continue;
            const entry = {
                id: `${call.id}_${participant.user_id}`,
                userId: participant.user_id,
                callId: call.id,
                entryType: "voice_room",
                direction: "joined",
                result: "left",
                startedAt,
                endedAt,
                durationSeconds: getDurationSeconds(startedAt, endedAt),
                otherUserId: null,
                otherUserName: null,
                otherUserAvatar: null,
                groupId,
                groupName,
                groupAvatar: null,
                participantCount,
                initiatedBy: createdBy,
                createdAt,
            };
            writeHistoryEntry(batch, entry);
        }
        return;
    }
    const members = getDirectParticipants(call);
    for (const member of members) {
        const otherMember = members.find((candidate) => candidate.user_id !== member.user_id);
        const entry = buildDirectEntry({
            call,
            userId: member.user_id,
            otherMember,
            direction: member.user_id === createdBy ? "outgoing" : "incoming",
            result: "completed",
            startedAt,
            endedAt,
            createdAt,
        });
        writeHistoryEntry(batch, entry);
    }
}
function writeRejectedEntries(batch, call, event) {
    if (isVoiceRoomCall(call))
        return;
    const createdBy = call.created_by?.id ?? "";
    const members = getDirectParticipants(call);
    const eventUserId = event.user?.id ?? "";
    const reason = String(event.reason ?? "decline");
    const startedAt = toMillis(call.created_at, undefined);
    const endedAt = toMillis(event.created_at, undefined);
    const createdAt = endedAt ?? Date.now();
    if (reason === "cancel") {
        const caller = members.find((member) => member.user_id === createdBy);
        const callee = members.find((member) => member.user_id !== createdBy);
        if (!caller)
            return;
        writeHistoryEntry(batch, buildDirectEntry({
            call,
            userId: caller.user_id,
            otherMember: callee,
            direction: "outgoing",
            result: "canceled",
            startedAt,
            endedAt,
            createdAt,
        }));
        return;
    }
    if (reason === "decline" || reason === "busy") {
        const caller = members.find((member) => member.user_id === createdBy);
        const rejectingMember = members.find((member) => member.user_id === eventUserId) ??
            members.find((member) => member.user_id !== createdBy);
        if (caller) {
            writeHistoryEntry(batch, buildDirectEntry({
                call,
                userId: caller.user_id,
                otherMember: rejectingMember,
                direction: "outgoing",
                result: "declined",
                startedAt,
                endedAt,
                createdAt,
            }));
        }
        if (rejectingMember && rejectingMember.user_id !== createdBy) {
            writeHistoryEntry(batch, buildDirectEntry({
                call,
                userId: rejectingMember.user_id,
                otherMember: caller,
                direction: "incoming",
                result: "declined",
                startedAt,
                endedAt,
                createdAt,
            }));
        }
        return;
    }
    if (reason === "timeout") {
        const caller = members.find((member) => member.user_id === createdBy);
        const callee = members.find((member) => member.user_id !== createdBy);
        if (!caller)
            return;
        writeHistoryEntry(batch, buildDirectEntry({
            call,
            userId: caller.user_id,
            otherMember: callee,
            direction: "outgoing",
            result: "missed",
            startedAt,
            endedAt,
            createdAt,
        }));
        return;
    }
    const caller = members.find((member) => member.user_id === createdBy);
    const otherMember = members.find((member) => member.user_id !== createdBy);
    if (!caller)
        return;
    writeHistoryEntry(batch, buildDirectEntry({
        call,
        userId: caller.user_id,
        otherMember,
        direction: "outgoing",
        result: "declined",
        startedAt,
        endedAt,
        createdAt,
    }));
}
function writeMissedEntries(batch, call, event) {
    if (isVoiceRoomCall(call))
        return;
    const createdBy = call.created_by?.id ?? "";
    const startedAt = toMillis(call.created_at, undefined);
    const endedAt = toMillis(event.created_at, undefined);
    const createdAt = endedAt ?? Date.now();
    const caller = getDirectParticipants(call).find((member) => member.user_id === createdBy) ?? normalizeUser(call.created_by);
    const missedMembers = Array.isArray(event.members)
        ? event.members.map(normalizeUser)
        : [];
    for (const missedMember of missedMembers) {
        if (!missedMember.user_id || missedMember.user_id === createdBy)
            continue;
        writeHistoryEntry(batch, buildDirectEntry({
            call,
            userId: missedMember.user_id,
            otherMember: caller,
            direction: "incoming",
            result: "missed",
            startedAt,
            endedAt,
            createdAt,
        }));
    }
}
function buildDirectEntry(params) {
    return {
        id: params.call.id,
        userId: params.userId,
        callId: params.call.id,
        entryType: params.call.custom?.mode === "video" ? "direct_video" : "direct_audio",
        direction: params.direction,
        result: params.result,
        startedAt: params.startedAt,
        endedAt: params.endedAt,
        durationSeconds: params.result === "completed"
            ? getDurationSeconds(params.startedAt, params.endedAt)
            : null,
        otherUserId: params.otherMember?.user_id ?? null,
        otherUserName: params.otherMember?.user?.name ?? null,
        otherUserAvatar: params.otherMember?.user?.image ?? null,
        groupId: null,
        groupName: null,
        groupAvatar: null,
        participantCount: null,
        initiatedBy: params.call.created_by?.id ?? "",
        createdAt: params.createdAt,
    };
}
function writeHistoryEntry(batch, entry) {
    const docRef = db
        .collection("Users")
        .doc(entry.userId)
        .collection("StreamCallHistory")
        .doc(entry.id);
    batch.set(docRef, entry, { merge: true });
}
function isVoiceRoomCall(call) {
    return ((typeof call?.id === "string" && call.id.startsWith("voice_channel_")) ||
        Boolean(call?.custom?.groupId || call?.custom?.groupName));
}
function getDirectParticipants(call) {
    const fromMembers = Array.isArray(call?.members)
        ? call.members.map(normalizeUser)
        : [];
    if (fromMembers.length > 0)
        return fromMembers;
    return getSessionParticipants(call);
}
function getSessionParticipants(call) {
    const participants = call?.session?.participants;
    if (!Array.isArray(participants))
        return [];
    return participants
        .map((participant) => normalizeUser({
        user_id: participant?.user?.id ?? participant?.user_session_id ?? "",
        user: participant?.user,
    }))
        .filter((participant) => participant.user_id.length > 0);
}
function normalizeUser(value) {
    return {
        user_id: value?.user_id ?? value?.id ?? "",
        user: value?.user
            ? {
                name: value.user.name ?? undefined,
                image: value.user.image ?? undefined,
            }
            : {
                name: value?.name ?? undefined,
                image: value?.image ?? undefined,
            },
    };
}
function toMillis(primary, fallback) {
    return primary
        ? new Date(primary).getTime()
        : fallback
            ? new Date(fallback).getTime()
            : Date.now();
}
function getDurationSeconds(startedAt, endedAt) {
    if (!endedAt)
        return null;
    return Math.max(0, Math.round((endedAt - startedAt) / 1000));
}
function getGroupIdFromCallId(callId) {
    if (!callId.startsWith("voice_channel_"))
        return null;
    return callId.replace(/^voice_channel_/, "") || null;
}
//# sourceMappingURL=streamCallHistory.js.map