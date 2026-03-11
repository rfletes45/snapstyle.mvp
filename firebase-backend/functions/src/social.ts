import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { onStoryViewed } from "./legacy";
import { notifyUser } from "./notificationCenter";

const db = admin.firestore();

async function getUserDisplayName(uid: string): Promise<string> {
  try {
    const userDoc = await db.collection("Users").doc(uid).get();
    const data = userDoc.data();
    return data?.displayName || data?.username || "Someone";
  } catch {
    return "Someone";
  }
}

export const onNewFriendRequest = functions.firestore
  .document("FriendRequests/{requestId}")
  .onCreate(async (snap, context) => {
    const request = snap.data();
    const { requestId } = context.params;
    const senderUid = request.from as string | undefined;
    const recipientUid = request.to as string | undefined;

    if (!senderUid || !recipientUid || senderUid === recipientUid) {
      return null;
    }

    const senderName = await getUserDisplayName(senderUid);

    await notifyUser({
      recipientUid,
      type: "friend_request",
      category: "social",
      dedupeKey: `friend_request:${requestId}`,
      collapseKey: "friend_request",
      title: "New connection request",
      body: `${senderName} wants to connect with you`,
      actorUid: senderUid,
      actorName: senderName,
      requestId,
      route: {
        screen: "Connections",
        params: { tab: "requests" },
      },
      data: {
        requestId,
        senderId: senderUid,
        senderName,
      },
    });

    return null;
  });

export const onFriendRequestAccepted = functions.firestore
  .document("FriendRequests/{requestId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const { requestId } = context.params;

    if (before.status === "accepted" || after.status !== "accepted") {
      return null;
    }

    const senderUid = after.from as string | undefined;
    const accepterUid = after.to as string | undefined;
    if (!senderUid || !accepterUid || senderUid === accepterUid) {
      return null;
    }

    const accepterName = await getUserDisplayName(accepterUid);

    await notifyUser({
      recipientUid: senderUid,
      type: "friend_request_accepted",
      category: "social",
      dedupeKey: `friend_request_accepted:${requestId}`,
      collapseKey: "friend_request",
      title: "Connection accepted",
      body: `${accepterName} accepted your request`,
      actorUid: accepterUid,
      actorName: accepterName,
      requestId,
      route: {
        screen: "Connections",
      },
      data: {
        requestId,
        accepterId: accepterUid,
        accepterName,
      },
    });

    return null;
  });

export { onStoryViewed };
