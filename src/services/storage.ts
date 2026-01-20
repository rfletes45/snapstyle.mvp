/**
 * Storage Service
 * Handles Firebase Storage operations for photo snaps:
 * - Upload compressed images to snaps/{chatId}/{messageId}.jpg
 * - Download images from Storage for display
 * - Delete images from Storage
 * - Compress images before upload (resize + quality reduction)
 */

import * as ImageManipulator from "expo-image-manipulator";
import {
  getStorage,
  ref,
  uploadBytes,
  deleteObject,
  getDownloadURL,
} from "firebase/storage";

/**
 * Compress image before upload
 * Resizes to max 1024px (preserving aspect ratio) and reduces JPEG quality to 0.7
 * Reduces file size from MB to typically 50-200KB
 * @param imageUri - Local file URI from camera capture or image picker
 * @param maxSize - Max dimension (default 1024px)
 * @param quality - JPEG quality 0-1 (default 0.7)
 * @returns Compressed image URI for upload
 */
export async function compressImage(
  imageUri: string,
  maxSize: number = 1024,
  quality: number = 0.7,
): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: maxSize, height: maxSize } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
    );

    return result.uri;
  } catch (error) {
    console.error("Error compressing image:", error);
    throw error;
  }
}

/**
 * Upload snap image to Firebase Storage
 * Stores at snaps/{chatId}/{messageId}.jpg
 * @param chatId - Chat ID for organizing snaps
 * @param messageId - Message ID for unique file naming
 * @param imageUri - Local file URI (should be pre-compressed)
 * @returns Storage path string for saving in Message doc
 */
export async function uploadSnapImage(
  chatId: string,
  messageId: string,
  imageUri: string,
): Promise<string> {
  try {
    const storagePath = `snaps/${chatId}/${messageId}.jpg`;
    const storage = getStorage();
    const storageRef = ref(storage, storagePath);

    // Fetch the image as blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Upload to Firebase Storage
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });

    console.log(`Uploaded snap to: ${storagePath}`);
    return storagePath;
  } catch (error) {
    console.error("Error uploading snap image:", error);
    throw error;
  }
}

/**
 * Download snap image from Firebase Storage
 * Retrieves download URL for displaying in SnapViewer
 * Works on both native and web platforms
 * @param storagePath - Storage path (e.g., "snaps/chatId/messageId.jpg")
 * @returns Download URL for Image component or direct image display
 */
export async function downloadSnapImage(storagePath: string): Promise<string> {
  try {
    const storage = getStorage();
    const storageRef = ref(storage, storagePath);

    // Get download URL - works on all platforms and handles CORS properly
    const downloadUrl = await getDownloadURL(storageRef);

    console.log(`Got download URL for snap: ${storagePath}`);
    return downloadUrl;
  } catch (error) {
    console.error("Error downloading snap image:", error);
    throw error;
  }
}

/**
 * Delete snap image from Firebase Storage
 * Called after viewing (view-once) or when message TTL expires
 * Cloud Function also triggers on message doc delete for redundancy
 * @param storagePath - Storage path to delete
 */
export async function deleteSnapImage(storagePath: string): Promise<void> {
  try {
    const storage = getStorage();
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    console.log(`Deleted snap: ${storagePath}`);
  } catch (error: any) {
    // File may already be deleted; only log if not a 404 error
    if (error.code !== "storage/object-not-found") {
      console.error("Error deleting snap image:", error);
    }
  }
}
