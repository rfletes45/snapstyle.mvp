/**
 * Storage Service
 * Handles Firebase Storage operations for photo snaps:
 * - Upload compressed images to snaps/{chatId}/{messageId}.jpg
 * - Download images from Storage for display
 * - Delete images from Storage
 * - Compress images before upload (resize + quality reduction)
 */

import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";
import {
  getStorage,
  ref,
  uploadBytes,
  deleteObject,
  getDownloadURL,
} from "firebase/storage";

/**
 * Compress image before upload
 * On web: uses canvas-based compression for data URLs
 * On native: uses expo-image-manipulator
 * Resizes to max 1024px (preserving aspect ratio) and reduces JPEG quality to 0.7
 * Reduces file size from MB to typically 50-200KB
 * @param imageUri - Local file URI from camera capture or image picker, or data URL on web
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
    // On web, use canvas-based compression for data URLs
    if (Platform.OS === "web") {
      console.log("🔵 [compressImage] Using web-based compression");
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            // Calculate new dimensions maintaining aspect ratio
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > maxSize) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
              }
            }

            // Create canvas and draw resized image
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              throw new Error("Could not get canvas context");
            }
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to data URL with compression
            const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
            console.log("✅ [compressImage] Web compression complete");
            resolve(compressedDataUrl);
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => {
          reject(new Error("Failed to load image for compression"));
        };
        img.src = imageUri;
      });
    } else {
      // On native, use expo-image-manipulator
      console.log("🔵 [compressImage] Using expo-image-manipulator");
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: maxSize, height: maxSize } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
      );
      console.log("✅ [compressImage] Native compression complete");
      return result.uri;
    }
  } catch (error) {
    console.error("❌ [compressImage] Error compressing image:", error);
    throw error;
  }
}

/**
 * Convert data URL to Blob
 * Helper for web platform where image URIs are data URLs
 */
function dataURLtoBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Upload snap image to Firebase Storage
 * Stores at snaps/{chatId}/{messageId}.jpg
 * Handles both data URLs (web) and file URIs (native)
 * @param chatId - Chat ID for organizing snaps
 * @param messageId - Message ID for unique file naming
 * @param imageUri - Local file URI or data URL (should be pre-compressed)
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

    console.log("🔵 [uploadSnapImage] Uploading snap image");

    let blob: Blob;

    // Handle data URLs (web platform) vs file URIs (native)
    if (imageUri.startsWith("data:")) {
      console.log("🔵 [uploadSnapImage] Converting data URL to blob");
      blob = dataURLtoBlob(imageUri);
    } else {
      console.log("🔵 [uploadSnapImage] Fetching file URI as blob");
      const response = await fetch(imageUri);
      blob = await response.blob();
    }

    console.log("🔵 [uploadSnapImage] Uploading blob to Firebase Storage");
    // Upload to Firebase Storage
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });

    console.log(`✅ [uploadSnapImage] Uploaded snap to: ${storagePath}`);
    return storagePath;
  } catch (error) {
    console.error("❌ [uploadSnapImage] Error uploading snap image:", error);
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
