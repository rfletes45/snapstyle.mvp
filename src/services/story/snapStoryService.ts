/**
 * STORY SYSTEM - SNAP STORIES SERVICE
 * Manages snap stories (24-hour expiring stories)
 * Uses Firebase Web SDK v12 modular API
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { Snap } from "../../types/camera";
import { getFirestoreInstance } from "../firebase";

/**
 * Snap story user info
 */
export interface SnapStoryUser {
  userId: string;
  userName: string;
  userImage: string;
  hasUnviewedSnaps: boolean;
  viewedCount: number;
  totalCount: number;
  lastSnapTime: Date;
}

/**
 * Snap story data
 */
export interface SnapStory {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  snaps: Snap[];
  createdAt: Date;
  expiresAt: Date;
  isComplete: boolean;
}

/**
 * Publish snap to stories
 */
export async function publishSnapToStory(
  picture: Picture,
  userId: string,
  userName: string,
  userImage: string,
): Promise<void> {
  try {
    console.log(`[Game Story Service] Publishing snap ${snap.id} to stories`);

    const db = getFirestoreInstance();

    // Update snap document to mark as story
    const snapRef = doc(db, "Pictures", snap.id);
    await updateDoc(snapRef, {
      storyVisible: true,
      storyPublishedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isPrivate: false,
    });

    // Create or update user's story index
    const storyRef = doc(db, "Stories", userId);
    const storyDoc = await getDoc(storyRef);

    if (!storyDoc.exists()) {
      await setDoc(storyRef, {
        userId,
        userName,
        userImage,
        snapCount: 1,
        firstSnapTime: snap.createdAt || Date.now(),
        lastSnapTime: snap.createdAt || Date.now(),
        expiresAt:
          snap.storyExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
        isSnapStory: true,
        viewerCount: 0,
      });
    } else {
      await updateDoc(storyRef, {
        snapCount: increment(1),
        lastSnapTime: snap.createdAt || Date.now(),
        expiresAt:
          snap.storyExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    console.log(
      `[Game Story Service] Snap published to stories for user ${userId}`,
    );
  } catch (error) {
    console.error(
      "[Game Story Service] Failed to publish snap to stories:",
      error,
    );
    throw error;
  }
}

/**
 * Remove snap from stories
 */
export async function removeSnapFromStory(snapId: string): Promise<void> {
  try {
    console.log(`[Game Story Service] Removing snap ${snapId} from stories`);

    const db = getFirestoreInstance();

    const snapRef = doc(db, "Pictures", snapId);
    await updateDoc(snapRef, {
      storyVisible: false,
    });

    console.log("[Game Story Service] Snap removed from stories");
  } catch (error) {
    console.error(
      "[Game Story Service] Failed to remove snap from stories:",
      error,
    );
    throw error;
  }
}

/**
 * Get visible stories for user
 */
export async function getVisibleStories(
  userId: string,
  friendIds: string[],
): Promise<SnapStoryUser[]> {
  try {
    console.log(
      `[Game Story Service] Fetching visible stories for user ${userId}`,
    );

    const db = getFirestoreInstance();
    const now = new Date();
    const storyUsers: SnapStoryUser[] = [];

    for (const friendId of friendIds) {
      const snapsRef = collection(db, "Pictures");
      const q = query(
        snapsRef,
        where("senderId", "==", friendId),
        where("storyVisible", "==", true),
        where("expiresAt", ">", now),
        orderBy("expiresAt", "asc"),
        orderBy("createdAt", "desc"),
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const friendRef = doc(db, "Users", friendId);
        const friendDoc = await getDoc(friendRef);
        const friendData = friendDoc.data();

        if (friendData) {
          let viewedCount = 0;

          for (const snapDoc of snapshot.docs) {
            const viewsRef = collection(db, "Pictures", snapDoc.id, "Views");
            const viewQuery = query(viewsRef, where("userId", "==", userId));
            const viewSnapshot = await getDocs(viewQuery);

            if (!viewSnapshot.empty) {
              viewedCount++;
            }
          }

          storyUsers.push({
            userId: friendId,
            userName:
              friendData.displayName || friendData.username || "Unknown",
            userImage: friendData.profileImage || "",
            hasUnviewedSnaps: viewedCount < snapshot.size,
            viewedCount,
            totalCount: snapshot.size,
            lastSnapTime:
              snapshot.docs[0].data().createdAt?.toDate?.() || new Date(),
          });
        }
      }
    }

    storyUsers.sort(
      (a, b) => b.lastSnapTime.getTime() - a.lastSnapTime.getTime(),
    );

    console.log(
      `[Game Story Service] Fetched ${storyUsers.length} visible stories`,
    );
    return storyUsers;
  } catch (error) {
    console.error("[Game Story Service] Failed to get visible stories:", error);
    return [];
  }
}

/**
 * Get stories from specific friend
 */
export async function getStoriesFromFriend(
  friendId: string,
  _viewerId: string,
): Promise<SnapStory | null> {
  try {
    console.log(`[Game Story Service] Fetching story from friend ${friendId}`);

    const db = getFirestoreInstance();
    const now = new Date();

    const snapsRef = collection(db, "Pictures");
    const q = query(
      snapsRef,
      where("senderId", "==", friendId),
      where("storyVisible", "==", true),
      where("expiresAt", ">", now),
      orderBy("createdAt", "asc"),
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(
        `[Game Story Service] No stories found from friend ${friendId}`,
      );
      return null;
    }

    const friendRef = doc(db, "Users", friendId);
    const friendDoc = await getDoc(friendRef);
    const friendData = friendDoc.data();

    if (!friendData) {
      return null;
    }

    const snaps: Snap[] = snapshot.docs.map((snapDoc) => {
      const data = snapDoc.data();
      return {
        id: snapDoc.id,
        senderId: data.senderId,
        senderDisplayName: data.senderName || "",
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        duration: data.mediaDuration,
        caption: data.caption,
        createdAt: data.createdAt?.toDate?.()?.getTime() || Date.now(),
        updatedAt: data.updatedAt?.toDate?.()?.getTime() || Date.now(),
        storyVisible: data.storyVisible,
        storyExpiresAt: data.expiresAt?.toDate?.()?.getTime(),
        allowReplies: data.allowReplies ?? true,
        allowReactions: data.allowReactions ?? true,
        viewOnceOnly: data.viewOnceOnly ?? true,
        screenshotNotification: data.screenshotNotification ?? true,
        recipients: data.recipients || [],
        filters: data.filters || [],
        overlayElements: data.overlayElements || [],
        viewedBy: data.viewedBy || [],
        reactions: data.reactions || [],
        replies: data.replies || [],
        uploadStatus: "uploaded" as const,
        uploadProgress: 100,
      } as Snap;
    });

    const story: SnapStory = {
      id: friendId,
      userId: friendId,
      userName: friendData.displayName || friendData.username || "Unknown",
      userImage: friendData.profileImage || "",
      snaps,
      createdAt: new Date(snaps[0]?.createdAt || Date.now()),
      expiresAt: new Date(snaps[0]?.storyExpiresAt || Date.now()),
      isComplete: false,
    };

    console.log(
      `[Game Story Service] Fetched story with ${snaps.length} snaps`,
    );
    return story;
  } catch (error) {
    console.error(
      "[Game Story Service] Failed to get story from friend:",
      error,
    );
    return null;
  }
}

/**
 * Mark story as viewed
 */
export async function markStoryAsViewed(
  friendId: string,
  viewerId: string,
  _viewerName: string,
): Promise<void> {
  try {
    console.log(
      `[Game Story Service] Marking story from ${friendId} as viewed by ${viewerId}`,
    );

    const db = getFirestoreInstance();

    const snapsRef = collection(db, "Pictures");
    const q = query(
      snapsRef,
      where("senderId", "==", friendId),
      where("storyVisible", "==", true),
    );
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);

    for (const snapDoc of snapshot.docs) {
      const viewsRef = collection(db, "Pictures", snapDoc.id, "Views");
      const viewQuery = query(viewsRef, where("userId", "==", viewerId));
      const viewSnapshot = await getDocs(viewQuery);

      if (viewSnapshot.empty) {
        const viewRef = doc(viewsRef);
        batch.set(viewRef, {
          userId: viewerId,
          viewedAt: new Date(),
          duration: 5000,
          screenshotTaken: false,
          fromStory: true,
        });

        batch.update(snapDoc.ref, {
          viewCount: increment(1),
        });
      }
    }

    await batch.commit();

    console.log("[Game Story Service] Story marked as viewed");
  } catch (error) {
    console.error(
      "[Game Story Service] Failed to mark story as viewed:",
      error,
    );
    throw error;
  }
}

/**
 * Get story progress for current viewing
 */
export function getStoryProgress(
  currentSnapId: string,
  snaps: Snap[],
): { current: number; total: number } {
  const currentIndex = snaps.findIndex((snap) => snap.id === currentSnapId);
  return {
    current: currentIndex + 1,
    total: snaps.length,
  };
}

/**
 * Calculate time until story expires
 */
export function getTimeUntilExpiry(expiresAt: Date): number {
  const now = new Date();
  const millisecondsLeft = expiresAt.getTime() - now.getTime();
  return Math.max(0, millisecondsLeft);
}

/**
 * Get story expiry status
 */
export function getStoryExpiryStatus(
  expiresAt: Date,
): "valid" | "expiring_soon" | "expired" {
  const timeLeft = getTimeUntilExpiry(expiresAt);
  const oneHour = 60 * 60 * 1000;

  if (timeLeft <= 0) return "expired";
  if (timeLeft <= oneHour) return "expiring_soon";
  return "valid";
}

/**
 * Archive expired stories
 */
export async function archiveExpiredStories(): Promise<number> {
  try {
    console.log("[Game Story Service] Archiving expired stories");

    const db = getFirestoreInstance();
    const now = new Date();

    const storiesRef = collection(db, "Stories");
    const q = query(
      storiesRef,
      where("expiresAt", "<", now),
      where("isSnapStory", "==", true),
    );
    const expiredSnapshot = await getDocs(q);

    let count = 0;

    for (const storyDoc of expiredSnapshot.docs) {
      const snapsRef = collection(db, "Pictures");
      const snapQuery = query(
        snapsRef,
        where("senderId", "==", storyDoc.id),
        where("storyVisible", "==", true),
      );
      const snapSnapshot = await getDocs(snapQuery);

      const batch = writeBatch(db);

      snapSnapshot.forEach((snapDoc) => {
        batch.update(snapDoc.ref, { storyVisible: false });
      });

      batch.delete(storyDoc.ref);
      await batch.commit();
      count++;
    }

    console.log(
      `[Game Story Service] Archived ${count} expired story collections`,
    );
    return count;
  } catch (error) {
    console.error(
      "[Game Story Service] Failed to archive expired stories:",
      error,
    );
    return 0;
  }
}

/**
 * Get story statistics
 */
export async function getStoryStats(userId: string): Promise<{
  totalStories: number;
  totalViews: number;
  totalReactions: number;
  activeStoriesCount: number;
}> {
  try {
    console.log(
      `[Game Story Service] Getting story statistics for user ${userId}`,
    );

    const db = getFirestoreInstance();
    const now = new Date();

    const snapsRef = collection(db, "Pictures");
    const q = query(
      snapsRef,
      where("senderId", "==", userId),
      where("storyVisible", "==", true),
    );
    const snapshot = await getDocs(q);

    let totalViews = 0;
    let totalReactions = 0;
    let activeCount = 0;

    for (const snapDoc of snapshot.docs) {
      const data = snapDoc.data();
      totalViews += data.viewCount || 0;
      totalReactions += data.reactionCount || 0;
      if (data.expiresAt?.toDate?.() > now) {
        activeCount++;
      }
    }

    return {
      totalStories: snapshot.size,
      totalViews,
      totalReactions,
      activeStoriesCount: activeCount,
    };
  } catch (error) {
    console.error(
      "[Game Story Service] Failed to get story statistics:",
      error,
    );
    return {
      totalStories: 0,
      totalViews: 0,
      totalReactions: 0,
      activeStoriesCount: 0,
    };
  }
}


