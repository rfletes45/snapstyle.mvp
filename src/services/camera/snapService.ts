/**
 * PICTURE SERVICE
 * Handles picture uploads, sharing, viewing, and Firestore operations
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import {
  Picture,
  Snap,
  SnapDraft,
  SnapRecipient,
  SnapReply,
  SnapView,
} from "@/types/camera";
import { getFirestoreInstance, getStorageInstance } from "@/services/firebase";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/camera/snapService");
/**
 * ============================================================================
 * PICTURE UPLOAD
 * ============================================================================
 */

/**
 * Upload picture to Firebase with progress tracking
 */
export async function uploadPicture(
  picture: Picture,
  mediaFile: File | Blob,
  userId: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  try {
    logger.info("[Game Service] Starting picture upload");

    // 1. Upload media to Firebase Storage
    const mediaUrl = await uploadMediaFile(
      userId,
      picture.id,
      mediaFile,
      onProgress,
    );

    // 2. Update picture with media URL
    picture.mediaUrl = mediaUrl;

    // 3. Create picture document in Firestore
    const pictureDocRef = await createSnapDocument(picture, userId);

    logger.info(
      `[Game Service] Picture uploaded successfully: ${pictureDocRef}`,
    );

    // 4. Update recipients' view lists
    await updateRecipientsViewLists(picture.id, picture.recipients);

    return pictureDocRef;
  } catch (error) {
    logger.error("[Game Service] Picture upload failed:", error);
    throw error;
  }
}

/**
 * Upload media file to Firebase Storage
 */
async function uploadMediaFile(
  userId: string,
  snapId: string,
  mediaFile: File | Blob,
  onProgress?: (progress: number) => void,
): Promise<string> {
  try {
    // Determine file extension
    const ext = mediaFile.type === "video/mp4" ? "mp4" : "jpg";
    const storagePath = `snaps/${userId}/${snapId}/media.${ext}`;

    const storageRef = ref(getStorageInstance(), storagePath);

    // Upload with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, mediaFile);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress?.(progress);
        },
        (error) => {
          logger.error("[Game Service] Media upload failed:", error);
          reject(error);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        },
      );
    });
  } catch (error) {
    logger.error("[Game Service] Failed to upload media file:", error);
    throw error;
  }
}

/**
 * Create picture document in Firestore
 */
async function createSnapDocument(
  picture: Picture,
  userId: string,
): Promise<string> {
  try {
    const snapsRef = collection(getFirestoreInstance(), "Pictures");

    const docRef = await addDoc(snapsRef, {
      ...picture,
      senderId: userId,
      recipientIds: picture.recipients.map((recipient) => recipient.userId),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return docRef.id;
  } catch (error) {
    logger.error("[Game Service] Failed to create picture document:", error);
    throw error;
  }
}

/**
 * Update recipients' view tracking lists
 */
async function updateRecipientsViewLists(
  snapId: string,
  recipients: SnapRecipient[],
): Promise<void> {
  try {
    const promises = recipients.map(async (recipient) => {
      const viewedSnapsRef = collection(
        getFirestoreInstance(),
        `Users/${recipient.userId}/ViewedSnaps`,
      );

      await addDoc(viewedSnapsRef, {
        snapId,
        viewedAt: null, // Will be filled when viewed
        screenshotTaken: false,
      });
    });

    await Promise.all(promises);
  } catch (error) {
    logger.error(
      "[Game Service] Failed to update recipients view lists:",
      error,
    );
    // Don't throw - picture is still uploaded
  }
}

/**
 * ============================================================================
 * PICTURE MANAGEMENT
 * ============================================================================
 */

/**
 * View a picture and record view timestamp
 */
export async function viewPicture(
  snapId: string,
  userId: string,
  screenshotTaken: boolean = false,
): Promise<void> {
  try {
    const snapRef = doc(getFirestoreInstance(), "Pictures", snapId);
    const snap = await (await import("firebase/firestore")).getDoc(snapRef);

    if (!snap.exists()) throw new Error("Picture not found");

    const snapData = snap.data() as Snap;

    // Add view to picture document
    const newView: SnapView = {
      userId,
      viewedAt: Date.now(),
      screenshotTaken,
    };

    const updatedViews = [...snapData.viewedBy, newView];

    await updateDoc(snapRef, {
      viewedBy: updatedViews,
    });

    // Also record in user's ViewedSnaps
    const viewedRef = doc(
      getFirestoreInstance(),
      `Users/${userId}/ViewedSnaps/${snapId}`,
    );
    await updateDoc(viewedRef, {
      viewedAt: Date.now(),
      screenshotTaken,
    });
  } catch (error) {
    logger.error("[Game Service] Failed to record picture view:", error);
  }
}

/**
 * Delete picture
 */
export async function deletePicture(
  snapId: string,
  userId: string,
): Promise<void> {
  try {
    // Delete Firestore document
    const snapRef = doc(getFirestoreInstance(), "Pictures", snapId);
    await deleteDoc(snapRef);

    // Delete storage files
    // Would delete media, thumbnails, etc.
    logger.info(`[Game Service] Deleted picture: ${snapId}`);
  } catch (error) {
    logger.error("[Game Service] Failed to delete picture:", error);
    throw error;
  }
}

/**
 * Add reaction to picture
 */
export async function addReaction(
  snapId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  try {
    const snapRef = doc(getFirestoreInstance(), "Pictures", snapId);
    const snap = await (await import("firebase/firestore")).getDoc(snapRef);

    if (!snap.exists()) throw new Error("Picture not found");

    const snapData = snap.data() as Snap;

    // Remove existing reaction from this user
    const updatedReactions = snapData.reactions.filter(
      (r) => r.userId !== userId,
    );

    // Add new reaction
    updatedReactions.push({
      userId,
      emoji,
      timestamp: Date.now(),
    });

    await updateDoc(snapRef, {
      reactions: updatedReactions,
    });
  } catch (error) {
    logger.error("[Game Service] Failed to add reaction:", error);
    throw error;
  }
}

/**
 * Reply to picture
 */
export async function replyToPicture(
  snapId: string,
  userId: string,
  reply: SnapReply,
): Promise<void> {
  try {
    const snapRef = doc(getFirestoreInstance(), "Pictures", snapId);
    const snap = await (await import("firebase/firestore")).getDoc(snapRef);

    if (!snap.exists()) throw new Error("Picture not found");

    const snapData = snap.data() as Snap;

    await updateDoc(snapRef, {
      replies: [...snapData.replies, reply],
    });
  } catch (error) {
    logger.error("[Game Service] Failed to reply to picture:", error);
    throw error;
  }
}

/**
 * Get picture receipts (view data)
 */
export async function getPictureReceipts(snapId: string): Promise<SnapView[]> {
  try {
    const snapRef = doc(getFirestoreInstance(), "Pictures", snapId);
    const snap = await (await import("firebase/firestore")).getDoc(snapRef);

    if (!snap.exists()) throw new Error("Picture not found");

    const snapData = snap.data() as Snap;
    return snapData.viewedBy;
  } catch (error) {
    logger.error("[Game Service] Failed to get picture receipts:", error);
    return [];
  }
}

/**
 * Share picture to story
 */
export async function shareToStory(
  picture: Picture,
  userId: string,
  duration: number = 86400000,
): Promise<void> {
  try {
    picture.storyVisible = true;
    picture.storyExpiresAt = Date.now() + duration; // Default 24 hours

    const pictureRef = doc(getFirestoreInstance(), "Pictures", picture.id);
    await updateDoc(pictureRef, {
      storyVisible: true,
      storyExpiresAt: picture.storyExpiresAt,
    });

    logger.info("[Game Service] Picture shared to story");
  } catch (error) {
    logger.error("[Game Service] Failed to share to story:", error);
    throw error;
  }
}

/**
 * ============================================================================
 * DRAFT MANAGEMENT
 * ============================================================================
 */

/**
 * Save picture as draft
 */
export async function createDraft(
  picture: Partial<Picture>,
  userId: string,
): Promise<string> {
  try {
    const draftId = `draft_${Date.now()}`;
    const draft: SnapDraft = {
      id: draftId,
      userId,
      media:
        picture.mediaType === "photo"
          ? {
              id: "",
              type: "photo",
              uri: "",
              timestamp: 0,
              fileSize: 0,
              mimeType: "image/jpeg",
              dimensions: { width: 0, height: 0 },
            }
          : {
              id: "",
              type: "video",
              uri: "",
              timestamp: 0,
              fileSize: 0,
              mimeType: "video/mp4",
              dimensions: { width: 0, height: 0 },
            },
      overlayElements: picture.overlayElements || [],
      filters: picture.filters || [],
      caption: picture.caption,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    const draftRef = collection(
      getFirestoreInstance(),
      `Users/${userId}/SnapDrafts`,
    );
    const docRef = await addDoc(draftRef, draft);

    logger.info(`[Game Service] Created draft: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    logger.error("[Game Service] Failed to create draft:", error);
    throw error;
  }
}

/**
 * Load draft
 */
export async function loadDraft(
  userId: string,
  draftId: string,
): Promise<SnapDraft> {
  try {
    const draftRef = doc(
      getFirestoreInstance(),
      `Users/${userId}/SnapDrafts/${draftId}`,
    );
    const draftSnapshot = await (
      await import("firebase/firestore")
    ).getDoc(draftRef);

    if (!draftSnapshot.exists()) throw new Error("Draft not found");

    return draftSnapshot.data() as SnapDraft;
  } catch (error) {
    logger.error("[Game Service] Failed to load draft:", error);
    throw error;
  }
}

/**
 * Delete draft
 */
export async function deleteDraft(
  userId: string,
  draftId: string,
): Promise<void> {
  try {
    const draftRef = doc(
      getFirestoreInstance(),
      `Users/${userId}/SnapDrafts/${draftId}`,
    );
    await deleteDoc(draftRef);

    logger.info(`[Game Service] Deleted draft: ${draftId}`);
  } catch (error) {
    logger.error("[Game Service] Failed to delete draft:", error);
    throw error;
  }
}

/**
 * Get all user drafts
 */
export async function getUserDrafts(userId: string): Promise<SnapDraft[]> {
  try {
    const draftsRef = collection(
      getFirestoreInstance(),
      `Users/${userId}/SnapDrafts`,
    );
    const q = query(draftsRef, where("expiresAt", ">", Date.now()));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as SnapDraft);
  } catch (error) {
    logger.error("[Game Service] Failed to get user drafts:", error);
    return [];
  }
}

/**
 * ============================================================================
 * PICTURE HISTORY & GALLERY
 * ============================================================================
 */

/**
 * Get user's own snaps (gallery)
 */
export async function getUserPictures(
  userId: string,
  limit: number = 50,
): Promise<Snap[]> {
  try {
    const snapsRef = collection(getFirestoreInstance(), "Pictures");
    const q = query(snapsRef, where("senderId", "==", userId));

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => doc.data() as Snap)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  } catch (error) {
    logger.error("[Game Service] Failed to get user pictures:", error);
    return [];
  }
}

/**
 * Get snaps sent to specific user
 */
export async function getReceivedPictures(
  userId: string,
  limit: number = 50,
): Promise<Snap[]> {
  try {
    const snapsRef = collection(getFirestoreInstance(), "Pictures");
    const q = query(
      snapsRef,
      where("recipients", "array-contains", {
        userId,
        recipientType: "direct",
      }),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => doc.data() as Snap)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  } catch (error) {
    logger.error("[Game Service] Failed to get received pictures:", error);
    return [];
  }
}

/**
 * Get story snaps visible to user
 */
export async function getVisibleStorySnaps(userId: string): Promise<Snap[]> {
  try {
    const snapsRef = collection(getFirestoreInstance(), "Pictures");
    const now = Date.now();

    const q = query(
      snapsRef,
      where("storyVisible", "==", true),
      where("storyExpiresAt", ">", now),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as Snap);
  } catch (error) {
    logger.error("[Game Service] Failed to get story pictures:", error);
    return [];
  }
}

/**
 * ============================================================================
 * ANALYTICS
 * ============================================================================
 */

/**
 * Record picture analytics
 */
export async function recordSnapAnalytics(
  snapId: string,
  userId: string,
  event: string,
): Promise<void> {
  try {
    // Would record events like:
    // - view, reply, reaction, screenshot, etc.

    logger.info(
      `[Game Service] Recorded event "${event}" for picture ${snapId}`,
    );
  } catch (error) {
    logger.error("[Game Service] Failed to record analytics:", error);
  }
}

/**
 * Get picture statistics
 */
export async function getSnapStatistics(snapId: string): Promise<{
  viewCount: number;
  reactionCount: number;
  replyCount: number;
  screenshotCount: number;
}> {
  try {
    const snapRef = doc(getFirestoreInstance(), "Pictures", snapId);
    const snap = await (await import("firebase/firestore")).getDoc(snapRef);

    if (!snap.exists()) throw new Error("Picture not found");

    const snapData = snap.data() as Snap;

    return {
      viewCount: snapData.viewedBy.length,
      reactionCount: snapData.reactions.length,
      replyCount: snapData.replies.length,
      screenshotCount: snapData.viewedBy.filter((v) => v.screenshotTaken)
        .length,
    };
  } catch (error) {
    logger.error("[Game Service] Failed to get statistics:", error);
    return {
      viewCount: 0,
      reactionCount: 0,
      replyCount: 0,
      screenshotCount: 0,
    };
  }
}
