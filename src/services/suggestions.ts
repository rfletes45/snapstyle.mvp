/**
 * Friend Suggestions Service
 *
 * Aggregates suggestion sources:
 * - Mutual friends
 * - Same group chat members not yet friended
 * - Contact matches on the app
 *
 * @module services/suggestions
 */

import { createLogger } from "@/utils/log";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

const logger = createLogger("services/suggestions");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FriendSuggestion {
  uid: string;
  username: string;
  displayName: string;
  avatarConfig: any;
  profilePictureUrl?: string | null;
  decorationId?: string | null;
  reason: SuggestionReason;
  reasonLabel: string;
  score: number; // For sorting; higher = more relevant
}

export type SuggestionReason =
  | "mutual_friends"
  | "group_chat"
  | "contacts"
  | "game_lobby";

// ---------------------------------------------------------------------------
// Fetching Suggestions
// ---------------------------------------------------------------------------

/**
 * Get friend suggestions for a user.
 * Combines multiple sources and deduplicates.
 */
export async function getFriendSuggestions(
  uid: string,
  limit: number = 20,
): Promise<FriendSuggestion[]> {
  const db = getFirestoreInstance();

  // Get current friends
  const friendsQ = query(
    collection(db, "Friends"),
    where("users", "array-contains", uid),
  );
  const friendsSnap = await getDocs(friendsQ);
  const friendUids = new Set<string>();
  friendsSnap.forEach((d) => {
    const users = d.data().users as string[];
    users.forEach((u) => {
      if (u !== uid) friendUids.add(u);
    });
  });

  // Get pending requests (sent + received)
  const [sentSnap, recvSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "FriendRequests"),
        where("from", "==", uid),
        where("status", "==", "pending"),
      ),
    ),
    getDocs(
      query(
        collection(db, "FriendRequests"),
        where("to", "==", uid),
        where("status", "==", "pending"),
      ),
    ),
  ]);
  const pendingUids = new Set<string>();
  sentSnap.forEach((d) => pendingUids.add(d.data().to as string));
  recvSnap.forEach((d) => pendingUids.add(d.data().from as string));

  // Get dismissed suggestions
  const dismissedUids = await getDismissedSuggestions(uid);

  // Exclude set: self, friends, pending, dismissed
  const exclude = new Set([
    uid,
    ...friendUids,
    ...pendingUids,
    ...dismissedUids,
  ]);

  // Get blocked users
  try {
    const blockedSnap = await getDocs(
      collection(db, "Users", uid, "blockedUsers"),
    );
    blockedSnap.forEach((d) => exclude.add(d.id));
  } catch {
    // Permission denied for non-owner — skip
  }

  const suggestionsMap = new Map<string, FriendSuggestion>();

  // Source 1: Mutual friends (friends of friends)
  try {
    for (const friendUid of friendUids) {
      const fofQ = query(
        collection(db, "Friends"),
        where("users", "array-contains", friendUid),
      );
      const fofSnap = await getDocs(fofQ);
      fofSnap.forEach((d) => {
        const users = d.data().users as string[];
        users.forEach((u) => {
          if (!exclude.has(u)) {
            const existing = suggestionsMap.get(u);
            if (existing) {
              existing.score += 1;
              const mutualCount = existing.score;
              existing.reasonLabel = `${mutualCount} mutual friend${mutualCount > 1 ? "s" : ""}`;
            } else {
              suggestionsMap.set(u, {
                uid: u,
                username: "",
                displayName: "",
                avatarConfig: {},
                reason: "mutual_friends",
                reasonLabel: "1 mutual friend",
                score: 1,
              });
            }
          }
        });
      });
    }
  } catch (err) {
    logger.error("Mutual friends suggestion error:", err);
  }

  // Source 2: Group chat members
  try {
    const groupsQ = query(
      collection(db, "GroupChats"),
      where("memberIds", "array-contains", uid),
    );
    const groupsSnap = await getDocs(groupsQ);
    groupsSnap.forEach((d) => {
      const members = d.data().memberIds as string[];
      members?.forEach((m) => {
        if (!exclude.has(m) && !suggestionsMap.has(m)) {
          suggestionsMap.set(m, {
            uid: m,
            username: "",
            displayName: "",
            avatarConfig: {},
            reason: "group_chat",
            reasonLabel: "In your group chat",
            score: 0.5,
          });
        }
      });
    });
  } catch (err) {
    logger.error("Group chat suggestion error:", err);
  }

  // Fetch profiles for all suggestions
  const results: FriendSuggestion[] = [];
  for (const [sugUid, suggestion] of suggestionsMap) {
    try {
      const userDoc = await getDoc(doc(db, "Users", sugUid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        results.push({
          ...suggestion,
          username: data.username,
          displayName: data.displayName,
          avatarConfig: data.avatarConfig,
          profilePictureUrl: data.profilePicture?.url ?? null,
          decorationId: data.avatarDecoration?.decorationId ?? null,
        });
      }
    } catch {
      // Skip users we can't fetch
    }
  }

  // Sort by score descending, limit
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Dismissal Persistence
// ---------------------------------------------------------------------------

/**
 * Dismiss a suggestion so it doesn't reappear.
 */
export async function dismissSuggestion(
  uid: string,
  targetUid: string,
): Promise<void> {
  const db = getFirestoreInstance();
  await setDoc(doc(db, "SuggestionDismissals", uid, "dismissed", targetUid), {
    dismissedAt: Date.now(),
  });
}

/**
 * Get all dismissed suggestion UIDs.
 */
async function getDismissedSuggestions(uid: string): Promise<Set<string>> {
  const db = getFirestoreInstance();
  try {
    const snap = await getDocs(
      collection(db, "SuggestionDismissals", uid, "dismissed"),
    );
    return new Set(snap.docs.map((d) => d.id));
  } catch {
    return new Set();
  }
}
