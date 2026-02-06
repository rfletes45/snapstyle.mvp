/**
 * Activity Feed Service
 *
 * Handles fetching and creating activity feed events from Firestore.
 * Activities are stored per-user and queried across friends for the feed.
 *
 * Firestore Structure:
 *   /Users/{uid}/activity/{eventId}  — individual activity events
 *   /Users/{uid}/activityFeed/{eventId} — aggregated feed (fan-out on write)
 *
 * For MVP, we use a pull-based model: fetch activities from friends' subcollections.
 * This can be upgraded to fan-out (push) for scale later.
 *
 * @module services/activityFeed
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
} from "firebase/firestore";

import { getFirestoreInstance } from "@/services/firebase";
import { getFriends } from "@/services/friends";
import type {
  ActivityEvent,
  ActivityEventData,
  ActivityEventType,
} from "@/types/activityFeed";

// =============================================================================
// Constants
// =============================================================================

const FEED_PAGE_SIZE = 20;
const MAX_FRIENDS_PER_QUERY = 10; // Firestore 'in' query limit

// =============================================================================
// Write: Record Activity
// =============================================================================

/**
 * Record a new activity event for the current user.
 * This writes to the user's activity subcollection.
 */
export async function recordActivity(
  userId: string,
  type: ActivityEventType,
  data: ActivityEventData,
  displayName: string,
  username?: string,
  avatarUrl?: string,
): Promise<string | null> {
  try {
    const db = getFirestoreInstance();
    const activityRef = collection(db, "Users", userId, "activity");

    const docRef = await addDoc(activityRef, {
      userId,
      displayName,
      username: username || null,
      avatarUrl: avatarUrl || null,
      type,
      data,
      timestamp: serverTimestamp(),
      likeCount: 0,
    });

    return docRef.id;
  } catch (error) {
    console.error("[ActivityFeed] Error recording activity:", error);
    return null;
  }
}

// =============================================================================
// Read: Fetch Feed
// =============================================================================

/**
 * Fetch the activity feed for the current user.
 * Aggregates activities from all friends, sorted by timestamp.
 *
 * @param userId - Current user's UID
 * @param pageSize - Number of events to fetch per page
 * @param lastTimestamp - Cursor for pagination (timestamp of last event)
 * @returns Array of ActivityEvent sorted by most recent first
 */
export async function fetchActivityFeed(
  userId: string,
  pageSize: number = FEED_PAGE_SIZE,
  lastTimestamp?: Date,
): Promise<ActivityEvent[]> {
  try {
    const db = getFirestoreInstance();

    // Get user's friends list
    const friends = await getFriends(userId);
    if (!friends || friends.length === 0) return [];

    // Extract friend UIDs
    const friendUids = friends
      .map((f: any) => f.friendUid || f.uid || f.id)
      .filter(Boolean)
      .slice(0, 50); // Cap at 50 friends for performance

    if (friendUids.length === 0) return [];

    // Firestore 'in' queries limited to 10 elements - batch if needed
    const batches: string[][] = [];
    for (let i = 0; i < friendUids.length; i += MAX_FRIENDS_PER_QUERY) {
      batches.push(friendUids.slice(i, i + MAX_FRIENDS_PER_QUERY));
    }

    // Fetch from each friend's activity subcollection in parallel
    const allActivities: ActivityEvent[] = [];

    // For each batch, query their activities
    const batchPromises = batches.map(async (batch) => {
      const perFriendPromises = batch.map(async (friendUid) => {
        try {
          const activityRef = collection(db, "Users", friendUid, "activity");

          let q;
          if (lastTimestamp) {
            q = query(
              activityRef,
              orderBy("timestamp", "desc"),
              startAfter(Timestamp.fromDate(lastTimestamp)),
              limit(Math.ceil(pageSize / batches.length)),
            );
          } else {
            q = query(
              activityRef,
              orderBy("timestamp", "desc"),
              limit(Math.ceil(pageSize / batches.length)),
            );
          }

          const snapshot = await getDocs(q);
          return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              userId: data.userId || friendUid,
              displayName: data.displayName || "Friend",
              username: data.username,
              avatarUrl: data.avatarUrl,
              avatarConfig: data.avatarConfig,
              type: data.type as ActivityEventType,
              timestamp:
                data.timestamp instanceof Timestamp
                  ? data.timestamp.toDate()
                  : new Date(data.timestamp),
              data: data.data as ActivityEventData,
              liked: false,
              likeCount: data.likeCount || 0,
            } as ActivityEvent;
          });
        } catch (error) {
          console.warn(
            `[ActivityFeed] Error fetching activities for ${friendUid}:`,
            error,
          );
          return [];
        }
      });

      const results = await Promise.all(perFriendPromises);
      return results.flat();
    });

    const batchResults = await Promise.all(batchPromises);
    allActivities.push(...batchResults.flat());

    // Sort by timestamp descending and limit to pageSize
    allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return allActivities.slice(0, pageSize);
  } catch (error) {
    console.error("[ActivityFeed] Error fetching feed:", error);
    return [];
  }
}

/**
 * Fetch activities for a specific user (for their profile)
 */
export async function fetchUserActivities(
  userId: string,
  pageSize: number = 10,
): Promise<ActivityEvent[]> {
  try {
    const db = getFirestoreInstance();
    const activityRef = collection(db, "Users", userId, "activity");

    const q = query(activityRef, orderBy("timestamp", "desc"), limit(pageSize));

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || userId,
        displayName: data.displayName || "User",
        username: data.username,
        avatarUrl: data.avatarUrl,
        avatarConfig: data.avatarConfig,
        type: data.type as ActivityEventType,
        timestamp:
          data.timestamp instanceof Timestamp
            ? data.timestamp.toDate()
            : new Date(data.timestamp),
        data: data.data as ActivityEventData,
        liked: false,
        likeCount: data.likeCount || 0,
      } as ActivityEvent;
    });
  } catch (error) {
    console.error("[ActivityFeed] Error fetching user activities:", error);
    return [];
  }
}

/**
 * Delete an activity event (user can remove their own activities)
 */
export async function deleteActivity(
  userId: string,
  activityId: string,
): Promise<boolean> {
  try {
    const db = getFirestoreInstance();
    await deleteDoc(doc(db, "Users", userId, "activity", activityId));
    return true;
  } catch (error) {
    console.error("[ActivityFeed] Error deleting activity:", error);
    return false;
  }
}

// =============================================================================
// Helper: Format Time Ago
// =============================================================================

/**
 * Format a timestamp as a human-readable "time ago" string.
 */
export function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
