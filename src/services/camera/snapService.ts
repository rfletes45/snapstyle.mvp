/**
 * SNAP SERVICE
 * Handles snap uploads, sharing, viewing, and Firestore operations
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
  Snap,
  SnapDraft,
  SnapRecipient,
  SnapReply,
  SnapView,
} from "../../types/camera";
import { getFirestoreInstance, getStorageInstance } from "../firebase";

/**
 * ============================================================================
 * SNAP UPLOAD
 * ============================================================================
 */

/**
 * Upload snap to Firebase with progress tracking
 */
export async function uploadSnap(
  snap: Snap,
  mediaFile: File | Blob,
  userId: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  try {
    console.log("[Snap Service] Starting snap upload");

    // 1. Upload media to Firebase Storage
    const mediaUrl = await uploadMediaFile(
      userId,
      snap.id,
      mediaFile,
      onProgress,
    );

    // 2. Update snap with media URL
    snap.mediaUrl = mediaUrl;

    // 3. Create snap document in Firestore
    const snapDocRef = await createSnapDocument(snap, userId);

    console.log(`[Snap Service] Snap uploaded successfully: ${snapDocRef}`);

    // 4. Update recipients' view lists
    await updateRecipientsViewLists(snap.id, snap.recipients);

    return snapDocRef;
  } catch (error) {
    console.error("[Snap Service] Snap upload failed:", error);
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
          console.error("[Snap Service] Media upload failed:", error);
          reject(error);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        },
      );
    });
  } catch (error) {
    console.error("[Snap Service] Failed to upload media file:", error);
    throw error;
  }
}

/**
 * Create snap document in Firestore
 */
async function createSnapDocument(snap: Snap, userId: string): Promise<string> {
  try {
    const snapsRef = collection(getFirestoreInstance(), "Snaps");

    const docRef = await addDoc(snapsRef, {
      ...snap,
      senderId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return docRef.id;
  } catch (error) {
    console.error("[Snap Service] Failed to create snap document:", error);
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
    console.error(
      "[Snap Service] Failed to update recipients view lists:",
      error,
    );
    // Don't throw - snap is still uploaded
  }
}

/**
 * ============================================================================
 * SNAP MANAGEMENT
 * ============================================================================
 */

/**
 * View a snap and record view timestamp
 */
export async function viewSnap(
  snapId: string,
  userId: string,
  screenshotTaken: boolean = false,
): Promise<void> {
  try {
    const snapRef = doc(getFirestoreInstance(), "Snaps", snapId);
    const snap = await (await import("firebase/firestore")).getDoc(snapRef);

    if (!snap.exists()) throw new Error("Snap not found");

    const snapData = snap.data() as Snap;

    // Add view to snap document
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
    console.error("[Snap Service] Failed to record snap view:", error);
  }
}

/**
 * Delete snap
 */
export async function deleteSnap(
  snapId: string,
  userId: string,
): Promise<void> {
  try {
    // Delete Firestore document
    const snapRef = doc(getFirestoreInstance(), "Snaps", snapId);
    await deleteDoc(snapRef);

    // Delete storage files
    // Would delete media, thumbnails, etc.
    console.log(`[Snap Service] Deleted snap: ${snapId}`);
  } catch (error) {
    console.error("[Snap Service] Failed to delete snap:", error);
    throw error;
  }
}

/**
 * Add reaction to snap
 */
export async function addReaction(
  snapId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  try {
    const snapRef = doc(getFirestoreInstance(), "Snaps", snapId);
    const snap = await (await import("firebase/firestore")).getDoc(snapRef);

    if (!snap.exists()) throw new Error("Snap not found");

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
    console.error("[Snap Service] Failed to add reaction:", error);
    throw error;
  }
}

/**
 * Reply to snap
 */
export async function replyToSnap(
  snapId: string,
  userId: string,
  reply: SnapReply,
): Promise<void> {
  try {
    const snapRef = doc(getFirestoreInstance(), "Snaps", snapId);
    const snap = await (await import("firebase/firestore")).getDoc(snapRef);

    if (!snap.exists()) throw new Error("Snap not found");

    const snapData = snap.data() as Snap;

    await updateDoc(snapRef, {
      replies: [...snapData.replies, reply],
    });
  } catch (error) {
    console.error("[Snap Service] Failed to reply to snap:", error);
    throw error;
  }
}

/**
 * Get snap receipts (view data)
 */
export async function getSnapReceipts(snapId: string): Promise<SnapView[]> {
  try {
    const snapRef = doc(getFirestoreInstance(), "Snaps", snapId);
    const snap = await (await import("firebase/firestore")).getDoc(snapRef);

    if (!snap.exists()) throw new Error("Snap not found");

    const snapData = snap.data() as Snap;
    return snapData.viewedBy;
  } catch (error) {
    console.error("[Snap Service] Failed to get snap receipts:", error);
    return [];
  }
}

/**
 * Share snap to story
 */
export async function shareToStory(
  snap: Snap,
  userId: string,
  duration: number = 86400000,
): Promise<void> {
  try {
    snap.storyVisible = true;
    snap.storyExpiresAt = Date.now() + duration; // Default 24 hours

    const snapRef = doc(getFirestoreInstance(), "Snaps", snap.id);
    await updateDoc(snapRef, {
      storyVisible: true,
      storyExpiresAt: snap.storyExpiresAt,
    });

    console.log("[Snap Service] Snap shared to story");
  } catch (error) {
    console.error("[Snap Service] Failed to share to story:", error);
    throw error;
  }
}

/**
 * ============================================================================
 * DRAFT MANAGEMENT
 * ============================================================================
 */

/**
 * Save snap as draft
 */
export async function createDraft(
  snap: Partial<Snap>,
  userId: string,
): Promise<string> {
  try {
    const draftId = `draft_${Date.now()}`;
    const draft: SnapDraft = {
      id: draftId,
      userId,
      media:
        snap.mediaType === "photo"
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
      overlayElements: snap.overlayElements || [],
      filters: snap.filters || [],
      caption: snap.caption,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    const draftRef = collection(
      getFirestoreInstance(),
      `Users/${userId}/SnapDrafts`,
    );
    const docRef = await addDoc(draftRef, draft);

    console.log(`[Snap Service] Created draft: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("[Snap Service] Failed to create draft:", error);
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
    console.error("[Snap Service] Failed to load draft:", error);
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

    console.log(`[Snap Service] Deleted draft: ${draftId}`);
  } catch (error) {
    console.error("[Snap Service] Failed to delete draft:", error);
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
    console.error("[Snap Service] Failed to get user drafts:", error);
    return [];
  }
}

/**
 * ============================================================================
 * SNAP HISTORY & GALLERY
 * ============================================================================
 */

/**
 * Get user's own snaps (gallery)
 */
export async function getUserSnaps(
  userId: string,
  limit: number = 50,
): Promise<Snap[]> {
  try {
    const snapsRef = collection(getFirestoreInstance(), "Snaps");
    const q = query(snapsRef, where("senderId", "==", userId));

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => doc.data() as Snap)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  } catch (error) {
    console.error("[Snap Service] Failed to get user snaps:", error);
    return [];
  }
}

/**
 * Get snaps sent to specific user
 */
export async function getReceivedSnaps(
  userId: string,
  limit: number = 50,
): Promise<Snap[]> {
  try {
    const snapsRef = collection(getFirestoreInstance(), "Snaps");
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
    console.error("[Snap Service] Failed to get received snaps:", error);
    return [];
  }
}

/**
 * Get story snaps visible to user
 */
export async function getVisibleStorySnaps(userId: string): Promise<Snap[]> {
  try {
    const snapsRef = collection(getFirestoreInstance(), "Snaps");
    const now = Date.now();

    const q = query(
      snapsRef,
      where("storyVisible", "==", true),
      where("storyExpiresAt", ">", now),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as Snap);
  } catch (error) {
    console.error("[Snap Service] Failed to get story snaps:", error);
    return [];
  }
}

/**
 * ============================================================================
 * ANALYTICS
 * ============================================================================
 */

/**
 * Record snap analytics
 */
export async function recordSnapAnalytics(
  snapId: string,
  userId: string,
  event: string,
): Promise<void> {
  try {
    // Would record events like:
    // - view, reply, reaction, screenshot, etc.

    console.log(`[Snap Service] Recorded event "${event}" for snap ${snapId}`);
  } catch (error) {
    console.error("[Snap Service] Failed to record analytics:", error);
  }
}

/**
 * Get snap statistics
 */
export async function getSnapStatistics(snapId: string): Promise<{
  viewCount: number;
  reactionCount: number;
  replyCount: number;
  screenshotCount: number;
}> {
  try {
    const snapRef = doc(getFirestoreInstance(), "Snaps", snapId);
    const snap = await (await import("firebase/firestore")).getDoc(snapRef);

    if (!snap.exists()) throw new Error("Snap not found");

    const snapData = snap.data() as Snap;

    return {
      viewCount: snapData.viewedBy.length,
      reactionCount: snapData.reactions.length,
      replyCount: snapData.replies.length,
      screenshotCount: snapData.viewedBy.filter((v) => v.screenshotTaken)
        .length,
    };
  } catch (error) {
    console.error("[Snap Service] Failed to get statistics:", error);
    return {
      viewCount: 0,
      reactionCount: 0,
      replyCount: 0,
      screenshotCount: 0,
    };
  }
}
