/**
 * Contacts Matching Cloud Function
 *
 * Accepts normalized contact identifiers (phones/emails) and returns
 * categorized match results. Privacy-conscious:
 * - Requires authentication
 * - Respects user discoverability settings
 * - Rate-limited
 * - Never returns raw contact data to other users
 *
 * @module functions/contacts
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

interface ContactMatchRequest {
  phones: string[];
  emails: string[];
}

interface MatchedUserResult {
  uid: string;
  username: string;
  displayName: string;
  avatarConfig: any;
  profilePictureUrl: string | null;
  decorationId: string | null;
  matchType: "phone" | "email";
}

interface ContactMatchResponse {
  onAppUsers: MatchedUserResult[];
  alreadyFriendUids: string[];
  pendingSentUids: string[];
  pendingReceivedUids: string[];
}

/**
 * matchContacts — Callable function for contact-based friend discovery.
 *
 * Input: { phones: string[], emails: string[] }
 * Output: { onAppUsers, alreadyFriendUids, pendingSentUids, pendingReceivedUids }
 */
export const matchContacts = functions.https.onCall(
  async (data: ContactMatchRequest, context): Promise<ContactMatchResponse> => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be signed in.",
      );
    }

    const callerUid = context.auth.uid;
    const { phones = [], emails = [] } = data;

    // Rate limit: max 500 identifiers per call
    if (phones.length + emails.length > 500) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Too many identifiers. Maximum 500 per request.",
      );
    }

    // Validate input types
    if (
      !Array.isArray(phones) ||
      !Array.isArray(emails) ||
      phones.some((p) => typeof p !== "string") ||
      emails.some((e) => typeof e !== "string")
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "phones and emails must be arrays of strings.",
      );
    }

    const matchedUsers: MatchedUserResult[] = [];
    const matchedUids = new Set<string>();

    // Query by phone in batches of 10 (Firestore `in` limit)
    for (let i = 0; i < phones.length; i += 10) {
      const batch = phones.slice(i, i + 10);
      if (batch.length === 0) continue;

      const snap = await db
        .collection("Users")
        .where("phone", "in", batch)
        .get();

      snap.forEach((doc) => {
        const d = doc.data();
        if (doc.id === callerUid) return;
        // Respect discoverability settings
        if (d.discoverability?.phone === false) return;

        if (!matchedUids.has(doc.id)) {
          matchedUids.add(doc.id);
          matchedUsers.push({
            uid: doc.id,
            username: d.username,
            displayName: d.displayName,
            avatarConfig: d.avatarConfig,
            profilePictureUrl: d.profilePicture?.url ?? null,
            decorationId: d.avatarDecoration?.decorationId ?? null,
            matchType: "phone",
          });
        }
      });
    }

    // Query by email in batches of 10
    for (let i = 0; i < emails.length; i += 10) {
      const batch = emails.slice(i, i + 10);
      if (batch.length === 0) continue;

      const snap = await db
        .collection("Users")
        .where("email", "in", batch)
        .get();

      snap.forEach((doc) => {
        const d = doc.data();
        if (doc.id === callerUid) return;
        if (d.discoverability?.email === false) return;

        if (!matchedUids.has(doc.id)) {
          matchedUids.add(doc.id);
          matchedUsers.push({
            uid: doc.id,
            username: d.username,
            displayName: d.displayName,
            avatarConfig: d.avatarConfig,
            profilePictureUrl: d.profilePicture?.url ?? null,
            decorationId: d.avatarDecoration?.decorationId ?? null,
            matchType: "email",
          });
        }
      });
    }

    // Get current friends
    const friendsSnap = await db
      .collection("Friends")
      .where("users", "array-contains", callerUid)
      .get();

    const friendUids: string[] = [];
    friendsSnap.forEach((doc) => {
      const users = doc.data().users as string[];
      const other = users.find((u: string) => u !== callerUid);
      if (other) friendUids.push(other);
    });

    // Get pending requests
    const [sentSnap, recvSnap] = await Promise.all([
      db
        .collection("FriendRequests")
        .where("from", "==", callerUid)
        .where("status", "==", "pending")
        .get(),
      db
        .collection("FriendRequests")
        .where("to", "==", callerUid)
        .where("status", "==", "pending")
        .get(),
    ]);

    const pendingSentUids: string[] = [];
    sentSnap.forEach((doc) => pendingSentUids.push(doc.data().to));

    const pendingReceivedUids: string[] = [];
    recvSnap.forEach((doc) => pendingReceivedUids.push(doc.data().from));

    return {
      onAppUsers: matchedUsers,
      alreadyFriendUids: friendUids,
      pendingSentUids,
      pendingReceivedUids,
    };
  },
);
