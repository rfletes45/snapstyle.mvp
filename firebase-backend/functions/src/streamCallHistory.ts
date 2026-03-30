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

import * as crypto from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Types (mirrors client-side StreamCallHistoryEntry)
// ---------------------------------------------------------------------------

interface StreamCallHistoryEntry {
  id: string;
  userId: string;
  callId: string;
  entryType: "direct_audio" | "direct_video" | "voice_room";
  direction: "incoming" | "outgoing" | "joined";
  result: "completed" | "missed" | "declined" | "canceled" | "left";
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number | null;
  otherUserId: string | null;
  otherUserName: string | null;
  otherUserAvatar: string | null;
  groupId: string | null;
  groupName: string | null;
  groupAvatar: string | null;
  participantCount: number | null;
  initiatedBy: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

export const streamCallWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  // Verify webhook authenticity via Stream's HMAC-SHA256 signature.
  // Stream signs every webhook body with your API Secret and sends
  // the hex digest in the X-Signature header.
  const apiSecret = process.env.STREAM_API_SECRET;
  const signature = req.headers["x-signature"] as string | undefined;

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
  } else if (apiSecret && !signature) {
    functions.logger.warn("Stream webhook: missing X-Signature header");
    res.status(401).send("Unauthorized");
    return;
  }

  try {
    const event = req.body;
    const eventType: string = event?.type;

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

    const callId: string = call.id;
    const callType: string = call.type; // "default" or "audio_room"
    const createdBy: string = call.created_by?.id ?? "";
    const custom: Record<string, string> = call.custom ?? {};
    const members: Array<{
      user_id: string;
      user?: { name?: string; image?: string };
    }> = call.members ?? [];
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

      let entry: StreamCallHistoryEntry;

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
      } else {
        // Direct call — determine peer and direction
        const otherMember = members.find((m) => m.user_id !== userId);
        const isOutgoing = userId === createdBy;

        // Determine result — if the session has meaningful duration, it was completed
        let result: StreamCallHistoryEntry["result"] = "completed";
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
  } catch (error) {
    functions.logger.error("Stream webhook processing error", { error });
    res.status(500).send("Internal error");
  }
});
