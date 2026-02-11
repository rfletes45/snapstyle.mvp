/**
 * Cloud Functions for Call System
 * Handles call notifications, timeouts, and history recording
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();
const messaging = admin.messaging();

// ============================================================================
// Types
// ============================================================================

interface CallParticipant {
  odId: string;
  odname: string;
  displayName: string;
  avatarConfig?: any;
  joinedAt: number | null;
  leftAt: number | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  connectionState: string;
}

interface Call {
  id: string;
  scope: "dm" | "group";
  conversationId: string;
  type: "audio" | "video";
  status: string;
  callerId: string;
  callerName: string;
  participants: Record<string, CallParticipant>;
  createdAt: number;
  answeredAt: number | null;
  endedAt: number | null;
  endReason?: string;
  duration?: number;
}

interface CallHistoryEntry {
  callId: string;
  odId: string;
  otherParticipants: {
    odId: string;
    displayName: string;
  }[];
  type: "audio" | "video";
  scope: "dm" | "group";
  status: string;
  direction: "incoming" | "outgoing";
  createdAt: number;
  duration: number | null;
  wasAnswered: boolean;
}

// ============================================================================
// Call Created - Send Push Notifications
// ============================================================================

export const onCallCreated = functions.firestore
  .document("Calls/{callId}")
  .onCreate(async (snapshot, context) => {
    const call = snapshot.data() as Call;
    const { callId } = context.params;

    functions.logger.info("Call created", {
      callId,
      type: call.type,
      scope: call.scope,
    });

    // Get all participants except caller
    const recipientIds = Object.keys(call.participants).filter(
      (uid) => uid !== call.callerId,
    );

    if (recipientIds.length === 0) {
      functions.logger.warn("No recipients for call notification", { callId });
      return;
    }

    // Get FCM tokens for all recipients
    const tokenPromises = recipientIds.map(async (uid) => {
      const userDoc = await db.collection("Users").doc(uid).get();
      const userData = userDoc.data();
      return {
        uid,
        fcmToken: userData?.fcmToken as string | undefined,
        platform: (userData?.platform as string) || "ios",
      };
    });

    const recipients = await Promise.all(tokenPromises);
    const validRecipients = recipients.filter(
      (r): r is { uid: string; fcmToken: string; platform: string } =>
        !!r.fcmToken,
    );

    if (validRecipients.length === 0) {
      functions.logger.warn("No valid FCM tokens for call recipients", {
        callId,
      });
      return;
    }

    // Send notifications to all recipients
    const notificationPromises = validRecipients.map(async (recipient) => {
      const message = buildCallNotification(call, callId, recipient);

      try {
        await messaging.send(message);
        functions.logger.info("Call notification sent", {
          callId,
          recipientUid: recipient.uid,
        });
      } catch (error) {
        functions.logger.error("Failed to send call notification", {
          callId,
          recipientUid: recipient.uid,
          error,
        });
      }
    });

    await Promise.all(notificationPromises);
  });

// ============================================================================
// Build Call Notification Message
// ============================================================================

function buildCallNotification(
  call: Call,
  callId: string,
  recipient: { uid: string; fcmToken: string; platform: string },
): admin.messaging.Message {
  const isVideo = call.type === "video";
  const callerName = call.callerName || "Unknown";

  // Base data payload
  const data: Record<string, string> = {
    type: "incoming_call",
    callId,
    callerId: call.callerId,
    callerName,
    callType: call.type,
    conversationId: call.conversationId,
    scope: call.scope,
    hasVideo: isVideo ? "true" : "false",
    uuid: callId, // Use callId as UUID for CallKeep
  };

  if (recipient.platform === "ios") {
    // iOS: Send VoIP push for CallKit
    return {
      token: recipient.fcmToken,
      data,
      apns: {
        headers: {
          "apns-push-type": "voip",
          "apns-priority": "10",
          "apns-topic": "com.vibeapp.mobile.voip",
        },
        payload: {
          aps: {
            "content-available": 1,
          },
          ...data,
        },
      },
    };
  } else {
    // Android: High priority data message
    return {
      token: recipient.fcmToken,
      data,
      android: {
        priority: "high" as const,
        ttl: 30000, // 30 seconds TTL for calls
        notification: {
          channelId: "vibe-incoming-calls",
          priority: "max" as const,
          visibility: "public" as const,
          title: isVideo ? "📹 Incoming Video Call" : "📞 Incoming Call",
          body: `${callerName} is calling...`,
          sound: "ringtone",
          defaultSound: false,
          defaultVibrateTimings: false,
          vibrateTimingsMillis: [0, 500, 200, 500, 200, 500],
        },
        // directBootOk not available in firebase-admin types
      },
    };
  }
}

// ============================================================================
// Call Updated - Handle Status Changes
// ============================================================================

export const onCallUpdated = functions.firestore
  .document("Calls/{callId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Call;
    const after = change.after.data() as Call;
    const { callId } = context.params;

    // Check for status transition to terminal state
    const terminalStates = ["ended", "declined", "missed", "failed"];
    const wasTerminal = terminalStates.includes(before.status);
    const isTerminal = terminalStates.includes(after.status);

    // If call just transitioned to terminal state
    if (!wasTerminal && isTerminal) {
      functions.logger.info("Call ended", {
        callId,
        status: after.status,
        endReason: after.endReason,
      });

      // Send call cancelled notification to participants
      await sendCallCancelledNotification(callId, after);

      // Record call history for all participants
      await recordCallHistory(callId, after);
    }

    // If call was ringing and now ended, it's a cancel
    if (before.status === "ringing" && isTerminal) {
      await sendCallCancelledNotification(callId, after);
    }
  });

// ============================================================================
// Send Call Cancelled Notification
// ============================================================================

async function sendCallCancelledNotification(
  callId: string,
  call: Call,
): Promise<void> {
  // Get all participants except caller
  const recipientIds = Object.keys(call.participants).filter(
    (uid) => uid !== call.callerId,
  );

  // Get FCM tokens
  const tokenPromises = recipientIds.map(async (uid) => {
    const userDoc = await db.collection("Users").doc(uid).get();
    return userDoc.data()?.fcmToken as string | undefined;
  });

  const tokens = (await Promise.all(tokenPromises)).filter(Boolean) as string[];

  if (tokens.length === 0) return;

  const message: admin.messaging.MulticastMessage = {
    tokens,
    data: {
      type: "call_cancelled",
      callId,
      reason: call.endReason || "cancelled",
    },
    android: {
      priority: "high",
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
    },
  };

  try {
    await messaging.sendEachForMulticast(message);
    functions.logger.info("Call cancelled notifications sent", { callId });
  } catch (error) {
    functions.logger.error("Failed to send call cancelled notifications", {
      callId,
      error,
    });
  }
}

// ============================================================================
// Record Call History
// ============================================================================

async function recordCallHistory(callId: string, call: Call): Promise<void> {
  const duration =
    call.answeredAt && call.endedAt
      ? Math.floor((call.endedAt - call.answeredAt) / 1000)
      : null;

  const batch = db.batch();

  for (const [odId, participant] of Object.entries(call.participants)) {
    const otherParticipants = Object.entries(call.participants)
      .filter(([id]) => id !== odId)
      .map(([, p]) => ({
        odId: p.odId,
        displayName: p.displayName,
      }));

    const historyEntry: CallHistoryEntry = {
      callId,
      odId,
      otherParticipants,
      type: call.type,
      scope: call.scope,
      status: call.status,
      direction: odId === call.callerId ? "outgoing" : "incoming",
      createdAt: call.createdAt,
      duration,
      wasAnswered: call.answeredAt !== null,
    };

    const historyRef = db
      .collection("Users")
      .doc(odId)
      .collection("CallHistory")
      .doc(callId);

    batch.set(historyRef, historyEntry);
  }

  try {
    await batch.commit();
    functions.logger.info("Call history recorded", {
      callId,
      participantCount: Object.keys(call.participants).length,
    });
  } catch (error) {
    functions.logger.error("Failed to record call history", { callId, error });
  }
}

// ============================================================================
// Scheduled: Handle Call Timeouts
// ============================================================================

export const handleCallTimeouts = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async () => {
    const now = Date.now();
    const timeoutThreshold = 30000; // 30 seconds

    // Find ringing calls that have exceeded timeout
    const ringingCallsSnapshot = await db
      .collection("Calls")
      .where("status", "==", "ringing")
      .where("createdAt", "<", now - timeoutThreshold)
      .get();

    if (ringingCallsSnapshot.empty) {
      return null;
    }

    const batch = db.batch();
    const callsToTimeout: string[] = [];

    ringingCallsSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: "missed",
        endedAt: now,
        endReason: "missed",
      });
      callsToTimeout.push(doc.id);
    });

    await batch.commit();

    functions.logger.info("Calls marked as missed", {
      count: callsToTimeout.length,
      callIds: callsToTimeout,
    });

    return null;
  });

// ============================================================================
// Scheduled: Cleanup Old Signaling Data
// ============================================================================

export const cleanupCallSignaling = functions.pubsub
  .schedule("every 1 hours")
  .onRun(async () => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    // Get old signaling documents
    const oldSignalsSnapshot = await db
      .collectionGroup("Signals")
      .where("createdAt", "<", cutoff)
      .limit(500)
      .get();

    if (oldSignalsSnapshot.empty) {
      functions.logger.info("No old signaling data to clean up");
      return null;
    }

    const batch = db.batch();
    oldSignalsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    functions.logger.info("Cleaned up old signaling data", {
      count: oldSignalsSnapshot.size,
    });

    return null;
  });

// ============================================================================
// HTTP: Get TURN Server Credentials
// ============================================================================

export const getTurnCredentials = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to get TURN credentials",
      );
    }

    // NOTE: Integrate with Twilio or another TURN provider
    // For now, return placeholder configuration
    // In production, generate time-limited credentials from your TURN provider

    // Example Twilio integration:
    // const twilioAccountSid = functions.config().twilio?.account_sid;
    // const twilioAuthToken = functions.config().twilio?.auth_token;
    // const client = require('twilio')(twilioAccountSid, twilioAuthToken);
    // const token = await client.tokens.create();

    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // TURN servers would be added here with credentials
        // {
        //   urls: 'turn:global.turn.twilio.com:3478?transport=udp',
        //   username: token.username,
        //   credential: token.password,
        // },
      ],
      ttl: 86400, // Credentials valid for 24 hours
    };
  },
);

// ============================================================================
// HTTP: Register VoIP Push Token (iOS)
// ============================================================================

export const registerVoIPToken = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to register VoIP token",
      );
    }

    const { voipToken, platform, appVersion, deviceId } = data;

    if (!voipToken || typeof voipToken !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "VoIP token is required",
      );
    }

    const userId = context.auth.uid;

    try {
      await db
        .collection("Users")
        .doc(userId)
        .update({
          voipToken,
          voipTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          platform: platform || "ios",
          appVersion: appVersion || null,
          deviceId: deviceId || null,
        });

      functions.logger.info("VoIP token registered", {
        userId,
        platform,
        tokenLength: voipToken.length,
      });

      return { success: true };
    } catch (error) {
      functions.logger.error("Failed to register VoIP token", {
        userId,
        error,
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to register VoIP token",
      );
    }
  },
);

// ============================================================================
// HTTP: Send Call Push Notification (for testing/manual trigger)
// ============================================================================

export const sendCallNotification = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const { recipientId, callType, callerName } = data;

    if (!recipientId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Recipient ID is required",
      );
    }

    const callerId = context.auth.uid;

    // Get recipient's tokens
    const recipientDoc = await db.collection("Users").doc(recipientId).get();
    const recipientData = recipientDoc.data();

    if (!recipientData) {
      throw new functions.https.HttpsError("not-found", "Recipient not found");
    }

    const fcmToken = recipientData.fcmToken;
    const voipToken = recipientData.voipToken;
    const platform = recipientData.platform || "ios";

    if (!fcmToken && !voipToken) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Recipient has no push tokens",
      );
    }

    const callId = db.collection("Calls").doc().id;
    const isVideo = callType === "video";

    const payload: Record<string, string> = {
      type: "incoming_call",
      callId,
      callerId,
      callerName: callerName || "Unknown",
      callType: callType || "audio",
      hasVideo: isVideo ? "true" : "false",
      uuid: callId,
    };

    try {
      // For iOS with VoIP token, use APNs directly
      if (platform === "ios" && voipToken) {
        // Note: In production, you'd use a library like node-apn
        // to send directly to APNs with the voip topic
        // For now, use FCM with VoIP headers
        if (fcmToken) {
          await messaging.send({
            token: fcmToken,
            data: payload,
            apns: {
              headers: {
                "apns-push-type": "voip",
                "apns-priority": "10",
                "apns-topic": "com.vibeapp.mobile.voip",
                "apns-expiration": String(Math.floor(Date.now() / 1000) + 30),
              },
              payload: {
                aps: {
                  "content-available": 1,
                },
                ...payload,
              },
            },
          });
        }
      } else if (fcmToken) {
        // For Android, send high-priority FCM
        await messaging.send({
          token: fcmToken,
          data: payload,
          android: {
            priority: "high",
            ttl: 30000,
            notification: {
              channelId: "vibe-incoming-calls",
              priority: "max",
              visibility: "public",
              title: isVideo ? "📹 Incoming Video Call" : "📞 Incoming Call",
              body: `${callerName || "Someone"} is calling...`,
              sound: "ringtone",
            },
          },
        });
      }

      functions.logger.info("Call notification sent manually", {
        callId,
        recipientId,
        platform,
      });

      return { success: true, callId };
    } catch (error) {
      functions.logger.error("Failed to send call notification", {
        recipientId,
        error,
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to send notification",
      );
    }
  },
);

// ============================================================================
// HTTP: Cancel Call (cleanup for incomplete calls)
// ============================================================================

export const cancelCall = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be logged in",
    );
  }

  const { callId, reason } = data;

  if (!callId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Call ID is required",
    );
  }

  const userId = context.auth.uid;
  const callRef = db.collection("Calls").doc(callId);
  const callDoc = await callRef.get();

  if (!callDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Call not found");
  }

  const call = callDoc.data() as Call;

  // Verify user is part of the call
  if (!call.participants[userId] && call.callerId !== userId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Not a participant of this call",
    );
  }

  // Only allow cancelling ringing/connecting calls
  const cancellableStates = ["ringing", "connecting"];
  if (!cancellableStates.includes(call.status)) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Call cannot be cancelled in current state",
    );
  }

  try {
    await callRef.update({
      status: "cancelled",
      endedAt: Date.now(),
      endReason: reason || "user_cancelled",
    });

    functions.logger.info("Call cancelled", {
      callId,
      userId,
      reason,
    });

    return { success: true };
  } catch (error) {
    functions.logger.error("Failed to cancel call", { callId, error });
    throw new functions.https.HttpsError("internal", "Failed to cancel call");
  }
});

// ============================================================================
// Group Call Invite - Send Notification to Invited Participant
// ============================================================================

export const onGroupCallInviteCreated = functions.firestore
  .document("GroupCallInvites/{inviteId}")
  .onCreate(async (snapshot, context) => {
    const invite = snapshot.data();
    const { inviteId } = context.params;

    functions.logger.info("Group call invite created", {
      inviteId,
      callId: invite.callId,
      inviteeId: invite.inviteeId,
    });

    // Get invitee's FCM token
    const inviteeDoc = await db.collection("Users").doc(invite.inviteeId).get();
    const inviteeData = inviteeDoc.data();

    if (!inviteeData?.fcmToken) {
      functions.logger.warn("No FCM token for invitee", {
        inviteId,
        inviteeId: invite.inviteeId,
      });
      return;
    }

    // Build notification
    const message: admin.messaging.Message = {
      token: inviteeData.fcmToken,
      data: {
        type: "group_call_invite",
        inviteId,
        callId: invite.callId,
        inviterId: invite.inviterId,
        inviterName: invite.inviterName,
        groupId: invite.groupId,
        groupName: invite.groupName,
        callType: invite.callType,
      },
      notification: {
        title:
          invite.callType === "video" ? "📹 Group Video Call" : "📞 Group Call",
        body: `${invite.inviterName} invited you to join ${invite.groupName}`,
      },
      android: {
        priority: "high" as const,
        ttl: 60000, // 1 minute TTL
        notification: {
          channelId: "vibe-group-calls",
          priority: "high" as const,
          visibility: "public" as const,
          sound: "ringtone",
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            alert: {
              title:
                invite.callType === "video"
                  ? "📹 Group Video Call"
                  : "📞 Group Call",
              body: `${invite.inviterName} invited you to join ${invite.groupName}`,
            },
            sound: "ringtone.caf",
            badge: 1,
          },
        },
      },
    };

    try {
      await messaging.send(message);
      functions.logger.info("Group call invite notification sent", {
        inviteId,
        inviteeId: invite.inviteeId,
      });
    } catch (error) {
      functions.logger.error("Failed to send group call invite notification", {
        inviteId,
        error,
      });
    }
  });

// ============================================================================
// Group Call Participant Joined - Notify Others
// ============================================================================

export const onGroupCallParticipantJoined = functions.firestore
  .document("Calls/{callId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Call;
    const after = change.after.data() as Call;
    const { callId } = context.params;

    // Only process group calls
    if (after.scope !== "group") {
      return;
    }

    // Find newly joined participants
    const beforeParticipants = Object.values(before.participants);
    const afterParticipants = Object.values(after.participants);

    const newlyJoined = afterParticipants.filter((afterP) => {
      const beforeP = beforeParticipants.find((bp) => bp.odId === afterP.odId);
      return (
        afterP.joinedAt !== null && (!beforeP || beforeP.joinedAt === null)
      );
    });

    if (newlyJoined.length === 0) {
      return;
    }

    functions.logger.info("Participants joined group call", {
      callId,
      newParticipants: newlyJoined.map((p) => p.odId),
    });

    // Get all active participants to notify
    const activeParticipantIds = Object.values(after.participants)
      .filter((p) => p.joinedAt !== null && p.leftAt === null)
      .map((p) => p.odId);

    // Don't notify the person who just joined
    const recipientIds = activeParticipantIds.filter(
      (id) => !newlyJoined.some((p) => p.odId === id),
    );

    if (recipientIds.length === 0) {
      return;
    }

    // Get FCM tokens
    const tokenPromises = recipientIds.map(async (uid) => {
      const userDoc = await db.collection("Users").doc(uid).get();
      return {
        uid,
        fcmToken: userDoc.data()?.fcmToken as string | undefined,
      };
    });

    const recipients = (await Promise.all(tokenPromises)).filter(
      (r): r is { uid: string; fcmToken: string } => !!r.fcmToken,
    );

    if (recipients.length === 0) {
      return;
    }

    // Send "participant joined" notifications
    for (const joined of newlyJoined) {
      const notifications = recipients.map((recipient) => ({
        token: recipient.fcmToken,
        data: {
          type: "group_call_participant_joined",
          callId,
          participantId: joined.odId,
          participantName: joined.displayName,
        },
        notification: {
          title: "Participant Joined",
          body: `${joined.displayName} joined the call`,
        },
        android: {
          priority: "high" as const,
          ttl: 10000,
        },
      }));

      try {
        await Promise.all(notifications.map((msg) => messaging.send(msg)));
      } catch (error) {
        functions.logger.error(
          "Failed to send participant joined notification",
          {
            callId,
            joinedId: joined.odId,
            error,
          },
        );
      }
    }
  });

// ============================================================================
// Group Call - Host Controls Notifications
// ============================================================================

export const onGroupCallHostAction = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated",
      );
    }

    const { callId, action, targetUserId } = data;

    if (!callId || !action) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Call ID and action are required",
      );
    }

    const userId = context.auth.uid;
    const callRef = db.collection("Calls").doc(callId);
    const callDoc = await callRef.get();

    if (!callDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Call not found");
    }

    const call = callDoc.data() as Call & { hostId?: string };

    // Verify user is host or co-host
    const isHost = call.hostId === userId || call.callerId === userId;
    const participant = call.participants[userId] as CallParticipant & {
      role?: string;
    };
    const isCoHost = participant?.role === "co-host";

    if (!isHost && !isCoHost) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only host or co-host can perform this action",
      );
    }

    // Handle different actions
    switch (action) {
      case "mute_all": {
        // Get all non-host participants to notify
        const recipientIds = Object.keys(call.participants).filter(
          (id) => id !== userId,
        );

        await sendGroupCallNotification(callId, recipientIds, {
          type: "group_call_muted",
          message: "Host has muted all participants",
        });
        break;
      }

      case "remove_participant": {
        if (!targetUserId) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "Target user ID required for remove action",
          );
        }

        // Notify the removed participant
        await sendGroupCallNotification(callId, [targetUserId], {
          type: "group_call_removed",
          message: "You have been removed from the call",
        });
        break;
      }

      case "end_call": {
        // Notify all participants
        const allParticipantIds = Object.keys(call.participants).filter(
          (id) => id !== userId,
        );

        await sendGroupCallNotification(callId, allParticipantIds, {
          type: "group_call_ended_by_host",
          message: "Host has ended the call",
        });
        break;
      }

      case "lock_call":
      case "unlock_call": {
        const activeParticipantIds = Object.values(call.participants)
          .filter(
            (p) =>
              p.joinedAt !== null && p.leftAt === null && p.odId !== userId,
          )
          .map((p) => p.odId);

        await sendGroupCallNotification(callId, activeParticipantIds, {
          type:
            action === "lock_call"
              ? "group_call_locked"
              : "group_call_unlocked",
          message:
            action === "lock_call"
              ? "Host has locked the call"
              : "Host has unlocked the call",
        });
        break;
      }

      default:
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Unknown action: ${action}`,
        );
    }

    return { success: true };
  },
);

// ============================================================================
// Helper: Send Group Call Notification
// ============================================================================

async function sendGroupCallNotification(
  callId: string,
  recipientIds: string[],
  payload: { type: string; message: string },
): Promise<void> {
  if (recipientIds.length === 0) return;

  // Get FCM tokens
  const tokenPromises = recipientIds.map(async (uid) => {
    const userDoc = await db.collection("Users").doc(uid).get();
    return {
      uid,
      fcmToken: userDoc.data()?.fcmToken as string | undefined,
    };
  });

  const recipients = (await Promise.all(tokenPromises)).filter(
    (r): r is { uid: string; fcmToken: string } => !!r.fcmToken,
  );

  if (recipients.length === 0) return;

  const notifications = recipients.map((recipient) => ({
    token: recipient.fcmToken,
    data: {
      ...payload,
      callId,
    },
    android: {
      priority: "high" as const,
      ttl: 10000,
    },
  }));

  try {
    await Promise.all(notifications.map((msg) => messaging.send(msg)));
    functions.logger.info("Group call notifications sent", {
      callId,
      type: payload.type,
      recipientCount: recipients.length,
    });
  } catch (error) {
    functions.logger.error("Failed to send group call notifications", {
      callId,
      error,
    });
  }
}
