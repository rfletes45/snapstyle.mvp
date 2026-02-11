/**
 * PROFILE SYSTEM - PICTURE GALLERY SERVICE
 * Manages user picture galleries and profile integration
 * Uses Firebase Web SDK v12 modular API
 */

import {
  collection,
  doc,
  limit as firestoreLimit,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Snap } from "@/types/camera";
import { getFirestoreInstance } from "@/services/firebase";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/profile/snapGalleryService");
/**
 * Picture gallery item for profile display
 */
export interface PictureGalleryItem {
  id: string;
  userId: string;
  pictureId: string;
  thumbnailUrl: string;
  mediaType: "photo" | "video";
  createdAt: Date;
  viewCount: number;
  reactionCount: number;
  replyCount: number;
  isFavorite: boolean;
}

// Backwards compatibility alias
export type SnapGalleryItem = PictureGalleryItem;

/**
 * User picture gallery
 */
export interface UserSnapGallery {
  userId: string;
  snaps: SnapGalleryItem[];
  totalCount: number;
  totalViews: number;
}

/**
 * Get user's snaps for profile gallery
 * Only returns non-private, non-expiring snaps
 */
export async function getUserPictures(
  userId: string,
  limitCount: number = 50,
  offset: number = 0,
): Promise<SnapGalleryItem[]> {
  try {
    logger.info(
      `[Game Gallery Service] Fetching pictures for user ${userId} (limit: ${limitCount}, offset: ${offset})`,
    );

    const db = getFirestoreInstance();

    const snapsRef = collection(db, "Pictures");
    const q = query(
      snapsRef,
      where("senderId", "==", userId),
      where("isPrivate", "==", false),
      orderBy("createdAt", "desc"),
      firestoreLimit(limitCount + offset),
    );
    const snapshot = await getDocs(q);

    const galleryItems: SnapGalleryItem[] = [];

    snapshot.docs.forEach((snapDoc, index) => {
      if (index >= offset) {
        const data = snapDoc.data();

        galleryItems.push({
          id: snapDoc.id,
          userId,
          pictureId: snapDoc.id,
          thumbnailUrl: data.thumbnailUrl || data.mediaUrl || "",
          mediaType: data.mediaType,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          viewCount: data.viewCount || 0,
          reactionCount: data.reactionCount || 0,
          replyCount: data.replyCount || 0,
          isFavorite: data.isFavorite || false,
        });
      }
    });

    logger.info(
      `[Game Gallery Service] Fetched ${galleryItems.length} gallery items`,
    );
    return galleryItems;
  } catch (error) {
    logger.error("[Game Gallery Service] Failed to get user pictures:", error);
    return [];
  }
}

/**
 * Get favorite snaps for user
 */
export async function getFavoriteSnaps(
  userId: string,
  limitCount: number = 50,
): Promise<SnapGalleryItem[]> {
  try {
    logger.info(
      `[Game Gallery Service] Fetching favorite pictures for user ${userId}`,
    );

    const db = getFirestoreInstance();

    const snapsRef = collection(db, "Pictures");
    const q = query(
      snapsRef,
      where("senderId", "==", userId),
      where("isFavorite", "==", true),
      where("isPrivate", "==", false),
      orderBy("createdAt", "desc"),
      firestoreLimit(limitCount),
    );
    const snapshot = await getDocs(q);

    const favoriteItems: SnapGalleryItem[] = [];

    snapshot.forEach((snapDoc) => {
      const data = snapDoc.data();

      favoriteItems.push({
        id: snapDoc.id,
        userId,
        pictureId: snapDoc.id,
        thumbnailUrl: data.thumbnailUrl || data.mediaUrl || "",
        mediaType: data.mediaType,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        viewCount: data.viewCount || 0,
        reactionCount: data.reactionCount || 0,
        replyCount: data.replyCount || 0,
        isFavorite: true,
      });
    });

    logger.info(
      `[Game Gallery Service] Fetched ${favoriteItems.length} favorite pictures`,
    );
    return favoriteItems;
  } catch (error) {
    logger.error(
      "[Game Gallery Service] Failed to get favorite pictures:",
      error,
    );
    return [];
  }
}

/**
 * Get picture statistics for user profile
 */
export async function getSnapStats(userId: string): Promise<{
  totalSnaps: number;
  totalViews: number;
  totalReactions: number;
  totalReplies: number;
  averageViews: number;
  averageReactions: number;
  mostViewedPicture: PictureGalleryItem | null;
  mostReactedPicture: PictureGalleryItem | null;
}> {
  try {
    logger.info(
      `[Game Gallery Service] Getting picture statistics for ${userId}`,
    );

    const db = getFirestoreInstance();

    const snapsRef = collection(db, "Pictures");
    const q = query(
      snapsRef,
      where("senderId", "==", userId),
      where("isPrivate", "==", false),
    );
    const snapshot = await getDocs(q);

    let totalViews = 0;
    let totalReactions = 0;
    let totalReplies = 0;
    let mostViewedPicture: PictureGalleryItem | null = null;
    let mostReactedPicture: PictureGalleryItem | null = null;
    let maxViews = 0;
    let maxReactions = 0;

    snapshot.forEach((snapDoc) => {
      const data = snapDoc.data();
      const views = data.viewCount || 0;
      const reactions = data.reactionCount || 0;
      const replies = data.replyCount || 0;

      totalViews += views;
      totalReactions += reactions;
      totalReplies += replies;

      const item: SnapGalleryItem = {
        id: snapDoc.id,
        userId,
        pictureId: snapDoc.id,
        thumbnailUrl: data.thumbnailUrl || data.mediaUrl || "",
        mediaType: data.mediaType,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        viewCount: views,
        reactionCount: reactions,
        replyCount: replies,
        isFavorite: data.isFavorite || false,
      };

      if (views > maxViews) {
        maxViews = views;
        mostViewedPicture = item;
      }

      if (reactions > maxReactions) {
        maxReactions = reactions;
        mostReactedPicture = item;
      }
    });

    const totalSnaps = snapshot.size;

    return {
      totalSnaps,
      totalViews,
      totalReactions,
      totalReplies,
      averageViews: totalSnaps > 0 ? totalViews / totalSnaps : 0,
      averageReactions: totalSnaps > 0 ? totalReactions / totalSnaps : 0,
      mostViewedPicture,
      mostReactedPicture,
    };
  } catch (error) {
    logger.error(
      "[Game Gallery Service] Failed to get picture statistics:",
      error,
    );
    return {
      totalSnaps: 0,
      totalViews: 0,
      totalReactions: 0,
      totalReplies: 0,
      averageViews: 0,
      averageReactions: 0,
      mostViewedPicture: null,
      mostReactedPicture: null,
    };
  }
}

/**
 * Toggle favorite on picture
 */
export async function toggleSnapFavorite(
  snapId: string,
  userId: string,
): Promise<boolean> {
  try {
    logger.info(
      `[Game Gallery Service] Toggling favorite status for picture ${snapId}`,
    );

    const db = getFirestoreInstance();

    const snapRef = doc(db, "Pictures", snapId);
    const snapDoc = await getDoc(snapRef);

    if (!snapDoc.exists()) {
      throw new Error("Picture not found");
    }

    const data = snapDoc.data();

    // Verify ownership
    if (data.senderId !== userId) {
      throw new Error("Cannot modify pictures you don't own");
    }

    const newFavoriteStatus = !data.isFavorite;

    await updateDoc(snapRef, {
      isFavorite: newFavoriteStatus,
    });

    logger.info(
      `[Game Gallery Service] Favorite status updated to ${newFavoriteStatus}`,
    );
    return newFavoriteStatus;
  } catch (error) {
    logger.error(
      "[Game Gallery Service] Failed to toggle picture favorite:",
      error,
    );
    throw error;
  }
}

/**
 * Delete picture from gallery
 * Marks as archived instead of complete deletion
 */
export async function deleteSnapFromGallery(
  snapId: string,
  userId: string,
): Promise<void> {
  try {
    logger.info(
      `[Game Gallery Service] Deleting picture ${snapId} from gallery`,
    );

    const db = getFirestoreInstance();

    const snapRef = doc(db, "Pictures", snapId);
    const snapDoc = await getDoc(snapRef);

    if (!snapDoc.exists()) {
      throw new Error("Picture not found");
    }

    const data = snapDoc.data();

    // Verify ownership
    if (data.senderId !== userId) {
      throw new Error("Cannot delete pictures you don't own");
    }

    // Mark as archived instead of deleting (for compliance/recovery)
    await updateDoc(snapRef, {
      isArchived: true,
      archivedAt: new Date(),
      isPrivate: true,
    });

    logger.info("[Game Gallery Service] Picture archived");
  } catch (error) {
    logger.error(
      "[Game Gallery Service] Failed to delete picture from gallery:",
      error,
    );
    throw error;
  }
}

/**
 * Get picture by ID with full details
 */
export async function getSnapById(snapId: string): Promise<Snap | null> {
  try {
    logger.info(`[Game Gallery Service] Fetching picture ${snapId}`);

    const db = getFirestoreInstance();

    const snapRef = doc(db, "Pictures", snapId);
    const snapDoc = await getDoc(snapRef);

    if (!snapDoc.exists()) {
      logger.info("[Game Gallery Service] Picture not found");
      return null;
    }

    const data = snapDoc.data();

    return {
      id: snapDoc.id,
      senderId: data.senderId,
      senderDisplayName: data.senderName || "",
      senderAvatar: data.senderAvatar,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      duration: data.mediaDuration,
      caption: data.caption || "",
      createdAt: data.createdAt?.toDate?.()?.getTime() || Date.now(),
      updatedAt: data.updatedAt?.toDate?.()?.getTime() || Date.now(),
      storyVisible: data.storyVisible ?? false,
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
  } catch (error) {
    logger.error("[Game Gallery Service] Failed to get picture by ID:", error);
    return null;
  }
}

/**
 * Search user snaps by caption
 */
export async function searchSnapsByCaption(
  userId: string,
  searchQuery: string,
): Promise<SnapGalleryItem[]> {
  try {
    logger.info(
      `[Game Gallery Service] Searching pictures for user ${userId} with query: "${searchQuery}"`,
    );

    const db = getFirestoreInstance();

    // Get all snaps for user and filter on client side
    // (Firestore doesn't support full-text search natively)
    const snapsRef = collection(db, "Pictures");
    const q = query(
      snapsRef,
      where("senderId", "==", userId),
      where("isPrivate", "==", false),
      orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);

    const lowerQuery = searchQuery.toLowerCase();
    const results: SnapGalleryItem[] = [];

    snapshot.forEach((snapDoc) => {
      const data = snapDoc.data();
      const caption = (data.caption || "").toLowerCase();

      if (caption.includes(lowerQuery)) {
        results.push({
          id: snapDoc.id,
          userId,
          pictureId: snapDoc.id,
          thumbnailUrl: data.thumbnailUrl || data.mediaUrl || "",
          mediaType: data.mediaType,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          viewCount: data.viewCount || 0,
          reactionCount: data.reactionCount || 0,
          replyCount: data.replyCount || 0,
          isFavorite: data.isFavorite || false,
        });
      }
    });

    logger.info(
      `[Game Gallery Service] Found ${results.length} pictures matching query`,
    );
    return results;
  } catch (error) {
    logger.error("[Game Gallery Service] Failed to search pictures:", error);
    return [];
  }
}

/**
 * Get snaps created in date range
 */
export async function getSnapsInDateRange(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<SnapGalleryItem[]> {
  try {
    logger.info(
      `[Game Gallery Service] Getting pictures for ${userId} in date range`,
    );

    const db = getFirestoreInstance();

    const snapsRef = collection(db, "Pictures");
    const q = query(
      snapsRef,
      where("senderId", "==", userId),
      where("isPrivate", "==", false),
      where("createdAt", ">=", startDate),
      where("createdAt", "<=", endDate),
      orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);

    const items: SnapGalleryItem[] = [];

    snapshot.forEach((snapDoc) => {
      const data = snapDoc.data();

      items.push({
        id: snapDoc.id,
        userId,
        pictureId: snapDoc.id,
        thumbnailUrl: data.thumbnailUrl || data.mediaUrl || "",
        mediaType: data.mediaType,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        viewCount: data.viewCount || 0,
        reactionCount: data.reactionCount || 0,
        replyCount: data.replyCount || 0,
        isFavorite: data.isFavorite || false,
      });
    });

    logger.info(
      `[Game Gallery Service] Found ${items.length} pictures in date range`,
    );
    return items;
  } catch (error) {
    logger.error(
      "[Game Gallery Service] Failed to get pictures in date range:",
      error,
    );
    return [];
  }
}
