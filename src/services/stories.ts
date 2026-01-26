/**
 * Stories Service
 * Handles Firebase operations for photo stories:
 * - Post new story (upload image to Storage, create Story doc)
 * - Fetch friends' stories from Firestore
 * - Track views (create Views subcollection entries)
 * - Delete stories (author only)
 * - Batch operations for performance
 */

import { Story } from "@/types/models";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { Image, Platform } from "react-native";
import { getFirestoreInstance } from "./firebase";
import { getFriends } from "./friends";
import { deleteSnapImage, downloadSnapImage } from "./storage";

const STORY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// In-memory cache for preloaded image URLs
const preloadedImageCache = new Map<string, string>();

/**
 * Post a new story
 * Uploads image to Firebase Storage and creates Story document in Firestore
 * Story is visible to current user and all their friends for 24 hours
 *
 * @param authorId - Current user ID
 * @param imageUri - Image URI (data URL on web, file URI on native)
 * @returns Story ID
 */
export async function postStory(
  authorId: string,
  imageUri: string,
): Promise<string> {
  try {
    if (__DEV__)
      console.log("🔵 [postStory] Starting story post for user:", authorId);

    const db = getFirestoreInstance();

    // Generate story ID
    const storyId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (__DEV__) console.log("🔵 [postStory] Generated story ID:", storyId);

    // Upload image to Storage
    const storagePath = `stories/${authorId}/${storyId}.jpg`;
    const storage = (await import("firebase/storage")).getStorage();
    const storageRef = (await import("firebase/storage")).ref(
      storage,
      storagePath,
    );

    if (__DEV__)
      console.log("🔵 [postStory] Uploading image to Storage at:", storagePath);

    let blob: Blob;

    // Handle data URLs (web) vs file URIs (native)
    if (imageUri.startsWith("data:")) {
      if (__DEV__) console.log("🔵 [postStory] Converting data URL to blob");
      const response = await fetch(imageUri);
      blob = await response.blob();
    } else {
      if (__DEV__) console.log("🔵 [postStory] Fetching file URI as blob");
      const response = await fetch(imageUri);
      blob = await response.blob();
    }

    // Upload to Firebase Storage
    const { uploadBytes } = await import("firebase/storage");
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    if (__DEV__) console.log("✅ [postStory] Image uploaded to Storage");

    // Get user's friends to set recipientIds
    const friends = await getFriends(authorId);
    const friendIds = friends
      .map((f) => f.users.find((u) => u !== authorId))
      .filter((id): id is string => Boolean(id));

    // Add self to recipients (user can see their own stories)
    const recipientIds = [authorId, ...friendIds];
    if (__DEV__)
      console.log(
        "🔵 [postStory] Recipient IDs:",
        recipientIds.length,
        "users",
      );

    // Create Story document in Firestore
    const now = Date.now();
    const expiresAt = now + STORY_EXPIRY_MS;

    const storyData: Story = {
      id: storyId,
      authorId,
      createdAt: now,
      expiresAt,
      storagePath,
      viewCount: 0,
      recipientIds,
    };

    const storyRef = doc(db, "stories", storyId);
    await setDoc(storyRef, storyData);
    if (__DEV__)
      console.log("✅ [postStory] Story document created in Firestore");

    return storyId;
  } catch (error) {
    console.error("❌ [postStory] Error posting story:", error);
    throw error;
  }
}

/**
 * Get all unexpired stories from current user and their friends
 * Stories are sorted by createdAt DESC (newest first)
 *
 * @param userId - Current user ID
 * @param userFriendIds - Array of current user's friend IDs
 * @returns Array of unexpired stories
 */
export async function getFriendsStories(
  userId: string,
  userFriendIds: string[],
): Promise<Story[]> {
  try {
    if (__DEV__)
      console.log("🔵 [getFriendsStories] Fetching stories for user:", userId);

    const db = getFirestoreInstance();

    // Query unexpired stories where user is a recipient
    const now = Date.now();
    const storiesRef = collection(db, "stories");
    const q = query(
      storiesRef,
      where("recipientIds", "array-contains", userId),
      where("expiresAt", ">", now),
    );

    const snapshot = await getDocs(q);
    const stories: Story[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      stories.push({
        id: doc.id,
        authorId: data.authorId,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        storagePath: data.storagePath,
        viewCount: data.viewCount || 0,
        recipientIds: data.recipientIds,
      });
    });

    // Sort by createdAt DESC (newest first)
    stories.sort((a, b) => b.createdAt - a.createdAt);

    if (__DEV__)
      console.log("✅ [getFriendsStories] Found", stories.length, "stories");
    return stories;
  } catch (error) {
    console.error("❌ [getFriendsStories] Error:", error);
    throw error;
  }
}

/**
 * Get single story by ID
 *
 * @param storyId - Story ID
 * @returns Story object or null if not found/expired
 */
export async function getStory(storyId: string): Promise<Story | null> {
  try {
    if (__DEV__) console.log("🔵 [getStory] Fetching story:", storyId);

    const db = getFirestoreInstance();
    const storyRef = doc(db, "stories", storyId);
    const docSnap = await getDoc(storyRef);

    if (!docSnap.exists()) {
      if (__DEV__) console.warn("⚠️  [getStory] Story not found:", storyId);
      return null;
    }

    const data = docSnap.data();

    // Check if expired
    if (data.expiresAt < Date.now()) {
      if (__DEV__) console.warn("⚠️  [getStory] Story expired:", storyId);
      return null;
    }

    if (__DEV__) console.log("✅ [getStory] Story loaded successfully");
    return {
      id: docSnap.id,
      authorId: data.authorId,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
      storagePath: data.storagePath,
      viewCount: data.viewCount || 0,
      recipientIds: data.recipientIds,
    };
  } catch (error) {
    console.error("❌ [getStory] Error:", error);
    throw error;
  }
}

/**
 * Mark story as viewed by current user
 * Creates entry in stories/{storyId}/views/{userId}
 * Increments viewCount on story doc
 *
 * @param storyId - Story ID
 * @param userId - Current user ID
 */
export async function markStoryViewed(
  storyId: string,
  userId: string,
): Promise<void> {
  const db = getFirestoreInstance();

  try {
    if (__DEV__)
      console.log("🔵 [markStoryViewed] Marking story as viewed:", {
        storyId,
        userId,
      });

    const viewRef = doc(db, "stories", storyId, "views", userId);
    const storyRef = doc(db, "stories", storyId);

    // Create/update view record
    const now = Date.now();
    await setDoc(
      viewRef,
      {
        userId,
        viewedAt: now,
        viewed: true,
      },
      { merge: true },
    );

    // Increment view count on story doc
    await updateDoc(storyRef, {
      viewCount: increment(1),
    });

    if (__DEV__) console.log("✅ [markStoryViewed] Story marked as viewed");
  } catch (error) {
    console.error("❌ [markStoryViewed] Error:", error);
    throw error;
  }
}

/**
 * Check if current user has already viewed a story
 *
 * @param storyId - Story ID
 * @param userId - Current user ID
 * @returns true if viewed, false otherwise
 */
export async function hasUserViewedStory(
  storyId: string,
  userId: string,
): Promise<boolean> {
  try {
    if (__DEV__)
      console.log("🔵 [hasUserViewedStory] Checking view status:", {
        storyId,
        userId,
      });

    const db = getFirestoreInstance();
    const viewRef = doc(db, "stories", storyId, "views", userId);
    const docSnap = await getDoc(viewRef);

    const viewed = docSnap.exists();
    if (__DEV__) console.log("✅ [hasUserViewedStory] View status:", viewed);
    return viewed;
  } catch (error) {
    console.error("❌ [hasUserViewedStory] Error:", error);
    return false;
  }
}

/**
 * Get view count for a story
 *
 * @param storyId - Story ID
 * @returns View count
 */
export async function getStoryViewCount(storyId: string): Promise<number> {
  try {
    if (__DEV__)
      console.log("🔵 [getStoryViewCount] Fetching view count for:", storyId);

    const db = getFirestoreInstance();
    const storyRef = doc(db, "stories", storyId);
    const docSnap = await getDoc(storyRef);

    if (!docSnap.exists()) {
      if (__DEV__) console.warn("⚠️  [getStoryViewCount] Story not found");
      return 0;
    }

    const viewCount = docSnap.data().viewCount || 0;
    if (__DEV__) console.log("✅ [getStoryViewCount] View count:", viewCount);
    return viewCount;
  } catch (error) {
    console.error("❌ [getStoryViewCount] Error:", error);
    return 0;
  }
}

/**
 * Get list of users who viewed a story (for author)
 *
 * @param storyId - Story ID
 * @returns Array of user IDs who viewed the story
 */
export async function getStoryViewers(storyId: string): Promise<string[]> {
  try {
    if (__DEV__)
      console.log("🔵 [getStoryViewers] Fetching viewers for:", storyId);

    const db = getFirestoreInstance();
    const viewsRef = collection(db, "stories", storyId, "views");
    const snapshot = await getDocs(viewsRef);

    const viewers: string[] = [];
    snapshot.forEach((doc) => {
      viewers.push(doc.data().userId);
    });

    if (__DEV__)
      console.log("✅ [getStoryViewers] Found", viewers.length, "viewers");
    return viewers;
  } catch (error) {
    console.error("❌ [getStoryViewers] Error:", error);
    throw error;
  }
}

/**
 * Delete a story (author only)
 * Deletes Story doc, Views subcollection, and Storage file
 *
 * @param storyId - Story ID
 * @param storagePath - Storage path (for deletion)
 */
export async function deleteStory(
  storyId: string,
  storagePath: string,
): Promise<void> {
  try {
    if (__DEV__)
      console.log("🔵 [deleteStory] Deleting story:", { storyId, storagePath });

    const db = getFirestoreInstance();
    const storyRef = doc(db, "stories", storyId);

    // Delete Storage file
    await deleteSnapImage(storagePath);
    if (__DEV__) console.log("✅ [deleteStory] Storage file deleted");

    // Delete story document (views subcollection auto-deletes with parent)
    await deleteDoc(storyRef);
    if (__DEV__) console.log("✅ [deleteStory] Story document deleted");
  } catch (error) {
    console.error("❌ [deleteStory] Error:", error);
    throw error;
  }
}

// =============================================================================
// Performance Optimizations
// =============================================================================

/**
 * Batch check which stories the user has already viewed
 * Replaces N individual getDoc() calls with parallel batch processing
 *
 * @param storyIds - Array of story IDs to check
 * @param userId - Current user ID
 * @returns Set of story IDs that have been viewed
 */
export async function getBatchViewedStories(
  storyIds: string[],
  userId: string,
): Promise<Set<string>> {
  if (storyIds.length === 0) {
    return new Set();
  }

  if (__DEV__)
    console.log(
      "🔵 [getBatchViewedStories] Checking",
      storyIds.length,
      "stories for user:",
      userId,
    );
  const startTime = Date.now();

  const db = getFirestoreInstance();
  const viewedSet = new Set<string>();

  try {
    // Process all view checks in parallel for speed
    const viewPromises = storyIds.map((storyId) =>
      getDoc(doc(db, "stories", storyId, "views", userId))
        .then((docSnap) => ({ storyId, viewed: docSnap.exists() }))
        .catch(() => ({ storyId, viewed: false })),
    );

    const results = await Promise.all(viewPromises);

    results.forEach(({ storyId, viewed }) => {
      if (viewed) {
        viewedSet.add(storyId);
      }
    });

    if (__DEV__) {
      const duration = Date.now() - startTime;
      console.log(
        "✅ [getBatchViewedStories] Checked",
        storyIds.length,
        "stories in",
        duration,
        "ms.",
        "Viewed:",
        viewedSet.size,
      );
    }

    return viewedSet;
  } catch (error) {
    console.error("❌ [getBatchViewedStories] Error:", error);
    return viewedSet;
  }
}

/**
 * Preload story images for faster viewing
 * Downloads and caches images in the background
 *
 * @param stories - Array of stories to preload
 * @param maxToPreload - Maximum number of stories to preload (default 5)
 */
export async function preloadStoryImages(
  stories: Story[],
  maxToPreload: number = 5,
): Promise<void> {
  const toPreload = stories.slice(0, maxToPreload);

  if (__DEV__)
    console.log(
      "🔵 [preloadStoryImages] Starting preload for",
      toPreload.length,
      "story images",
    );

  // Preload in parallel
  const preloadPromises = toPreload.map(async (story) => {
    try {
      // Skip if already cached
      if (preloadedImageCache.has(story.id)) {
        if (__DEV__)
          console.log("✅ [preloadStoryImages] Already cached:", story.id);
        return;
      }

      if (__DEV__)
        console.log("🔵 [preloadStoryImages] Starting download:", story.id);

      // Download image URL from Storage
      const uri = await downloadSnapImage(story.storagePath);
      preloadedImageCache.set(story.id, uri);

      // Prefetch image data into memory
      if (Platform.OS !== "web") {
        await Image.prefetch(uri);
      } else {
        return new Promise<void>((resolve) => {
          const img = new window.Image();
          img.onload = () => {
            if (__DEV__)
              console.log("✅ [preloadStoryImages] Preloaded (web):", story.id);
            resolve();
          };
          img.onerror = () => {
            if (__DEV__)
              console.warn(
                "⚠️ [preloadStoryImages] Failed to load image:",
                story.id,
              );
            resolve();
          };
          img.src = uri;
        });
      }

      if (__DEV__) console.log("✅ [preloadStoryImages] Preloaded:", story.id);
    } catch (error) {
      if (__DEV__)
        console.warn(
          "⚠️ [preloadStoryImages] Failed to preload:",
          story.id,
          error,
        );
    }
  });

  // Don't await - let preloading happen in background
  Promise.all(preloadPromises).then(() => {
    if (__DEV__) console.log("✅ [preloadStoryImages] All preloading complete");
  });
}

/**
 * Get preloaded image URL from cache
 *
 * @param storyId - Story ID
 * @returns Cached image URL or null
 */
export function getPreloadedImageUrl(storyId: string): string | null {
  return preloadedImageCache.get(storyId) || null;
}

/**
 * Clear preloaded image cache
 * Call when user logs out or to free memory
 */
export function clearPreloadedImageCache(): void {
  if (__DEV__)
    console.log(
      "🔵 [clearPreloadedImageCache] Clearing",
      preloadedImageCache.size,
      "cached images",
    );
  preloadedImageCache.clear();
}

/**
 * Filter out expired stories client-side
 *
 * @param stories - Array of stories to filter
 * @returns Array of valid (unexpired) stories
 */
export function filterExpiredStories(stories: Story[]): Story[] {
  const now = Date.now();
  const valid = stories.filter((s) => s.expiresAt > now);

  if (__DEV__ && valid.length < stories.length) {
    console.log(
      "🔵 [filterExpiredStories] Filtered out",
      stories.length - valid.length,
      "expired stories",
    );
  }

  return valid;
}

/**
 * Calculate time remaining until story expires
 *
 * @param expiresAt - Expiration timestamp
 * @returns Human-readable time string (e.g., "5h", "23m")
 */
export function getStoryTimeRemaining(expiresAt: number): string {
  const remaining = expiresAt - Date.now();

  if (remaining <= 0) {
    return "Expired";
  }

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  if (hours > 0) {
    return `${hours}h`;
  }

  const minutes = Math.floor(remaining / (1000 * 60));
  if (minutes > 0) {
    return `${minutes}m`;
  }

  return "<1m";
}
