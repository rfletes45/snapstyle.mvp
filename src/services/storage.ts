/**
 * Storage Service
 * Handles Firebase Storage operations for pictures:
 * - Upload compressed images to snaps/{chatId}/{messageId}.jpg
 * - Download images from Storage for display
 * - Delete images from Storage
 * - Compress images before upload (resize + quality reduction)
 * - H10: Multi-attachment upload with progress tracking
 * - H11: Voice message upload support
 */

import { AttachmentKind, AttachmentV2 } from "@/types/messaging";
import * as ImageManipulator from "expo-image-manipulator";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
} from "firebase/storage";
import { Platform } from "react-native";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/storage");
// =============================================================================
// Types (H10)
// =============================================================================

/**
 * Local attachment before upload
 */
export interface LocalAttachment {
  /** Unique ID for this attachment */
  id: string;
  /** Local file URI */
  uri: string;
  /** Attachment type */
  kind: AttachmentKind;
  /** MIME type */
  mime: string;
  /** File size in bytes (if known) */
  sizeBytes?: number;
  /** Image/video width */
  width?: number;
  /** Image/video height */
  height?: number;
  /** User-provided caption */
  caption?: string;
  /** View-once flag */
  viewOnce?: boolean;
}

/**
 * Upload progress callback
 */
export type UploadProgressCallback = (
  attachmentId: string,
  progress: number, // 0-1
  status: "uploading" | "complete" | "error",
  error?: string,
) => void;

/**
 * Upload result for a single attachment
 */
export interface UploadResult {
  success: boolean;
  attachment?: AttachmentV2;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_IMAGE_DIMENSION = 1920;
const THUMBNAIL_DIMENSION = 400;
const IMAGE_QUALITY = 0.8;
const THUMBNAIL_QUALITY = 0.6;

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
      logger.info("🔵 [compressImage] Using web-based compression");
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
            logger.info("✅ [compressImage] Web compression complete");
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
      logger.info("🔵 [compressImage] Using expo-image-manipulator");
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: maxSize, height: maxSize } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
      );
      logger.info("✅ [compressImage] Native compression complete");
      return result.uri;
    }
  } catch (error) {
    logger.error("❌ [compressImage] Error compressing image:", error);
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
 * Upload picture image to Firebase Storage
 * Stores at snaps/{chatId}/{messageId}.jpg
 * Handles both data URLs (web) and file URIs (native)
 * @param chatId - Chat ID for organizing pictures
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

    logger.info("🔵 [uploadSnapImage] Uploading picture image");

    let blob: Blob;

    // Handle data URLs (web platform) vs file URIs (native)
    if (imageUri.startsWith("data:")) {
      logger.info("🔵 [uploadSnapImage] Converting data URL to blob");
      blob = dataURLtoBlob(imageUri);
    } else {
      logger.info("🔵 [uploadSnapImage] Fetching file URI as blob");
      const response = await fetch(imageUri);
      blob = await response.blob();
    }

    logger.info("🔵 [uploadSnapImage] Uploading blob to Firebase Storage");
    // Upload to Firebase Storage
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });

    logger.info(`✅ [uploadSnapImage] Uploaded picture to: ${storagePath}`);
    return storagePath;
  } catch (error) {
    logger.error("❌ [uploadSnapImage] Error uploading picture image:", error);
    throw error;
  }
}

/**
 * Download picture image from Firebase Storage
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

    logger.info(`Got download URL for picture: ${storagePath}`);
    return downloadUrl;
  } catch (error) {
    logger.error("Error downloading picture image:", error);
    throw error;
  }
}

/**
 * Delete picture image from Firebase Storage
 * Called after viewing (view-once) or when message TTL expires
 * Cloud Function also triggers on message doc delete for redundancy
 * @param storagePath - Storage path to delete
 */
export async function deleteSnapImage(storagePath: string): Promise<void> {
  try {
    const storage = getStorage();
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    logger.info(`Deleted picture: ${storagePath}`);
  } catch (error: any) {
    // File may already be deleted; only log if not a 404 error
    if (error.code !== "storage/object-not-found") {
      logger.error("Error deleting picture image:", error);
    }
  }
}

/**
 * Upload group chat image to Firebase Storage
 * Stores at groups/{groupId}/messages/{messageId}.jpg
 * Handles both data URLs (web) and file URIs (native)
 * @param groupId - Group ID for organizing images
 * @param messageId - Message ID for unique file naming
 * @param imageUri - Local file URI or data URL (should be pre-compressed)
 * @returns Storage path string for saving in GroupMessage doc
 */
export async function uploadGroupImage(
  groupId: string,
  messageId: string,
  imageUri: string,
): Promise<string> {
  try {
    const storagePath = `groups/${groupId}/messages/${messageId}.jpg`;
    const storage = getStorage();
    const storageRef = ref(storage, storagePath);

    logger.info("🔵 [uploadGroupImage] Uploading group chat image");

    let blob: Blob;

    // Handle data URLs (web platform) vs file URIs (native)
    if (imageUri.startsWith("data:")) {
      logger.info("🔵 [uploadGroupImage] Converting data URL to blob");
      blob = dataURLtoBlob(imageUri);
    } else {
      logger.info("🔵 [uploadGroupImage] Fetching file URI as blob");
      const response = await fetch(imageUri);
      blob = await response.blob();
    }

    logger.info("🔵 [uploadGroupImage] Uploading blob to Firebase Storage");
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });

    logger.info(`✅ [uploadGroupImage] Uploaded to: ${storagePath}`);

    // Get download URL
    logger.info("🔵 [uploadGroupImage] Getting download URL...");
    const downloadUrl = await getDownloadURL(storageRef);
    logger.info(`✅ [uploadGroupImage] Download URL: ${downloadUrl}`);

    return downloadUrl;
  } catch (error) {
    logger.error("❌ [uploadGroupImage] Error uploading group image:", error);
    throw error;
  }
}

// =============================================================================
// H10: Multi-Attachment Upload Support
// =============================================================================

/**
 * Generate a unique attachment ID
 */
export function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get image dimensions from URI
 * Works on both web (using Image) and native (using Image.getSize)
 */
export async function getImageDimensions(
  uri: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (Platform.OS === "web") {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        reject(new Error("Failed to load image for dimensions"));
      };
      img.src = uri;
    } else {
      // On native, use RN Image.getSize
      const { Image: RNImage } = require("react-native");
      RNImage.getSize(
        uri,
        (width: number, height: number) => {
          resolve({ width, height });
        },
        (error: Error) => {
          reject(error);
        },
      );
    }
  });
}

/**
 * Generate a thumbnail for an image
 * Returns the thumbnail URI
 */
export async function generateThumbnail(
  uri: string,
  maxSize: number = THUMBNAIL_DIMENSION,
  quality: number = THUMBNAIL_QUALITY,
): Promise<string> {
  return compressImage(uri, maxSize, quality);
}

/**
 * Get file size from URI
 */
export async function getFileSize(uri: string): Promise<number> {
  try {
    if (uri.startsWith("data:")) {
      // For data URLs, calculate from base64 content
      const base64 = uri.split(",")[1];
      return Math.ceil((base64.length * 3) / 4);
    } else {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size;
    }
  } catch (error) {
    logger.warn("[getFileSize] Could not determine file size:", error);
    return 0;
  }
}

/**
 * Determine MIME type from URI or extension
 */
export function getMimeType(uri: string, kind: AttachmentKind): string {
  if (uri.startsWith("data:")) {
    const match = uri.match(/data:([^;]+);/);
    if (match) return match[1];
  }

  // Default MIME types by kind
  const defaults: Record<AttachmentKind, string> = {
    image: "image/jpeg",
    video: "video/mp4",
    audio: "audio/mp4",
    file: "application/octet-stream",
  };

  return defaults[kind] || "application/octet-stream";
}

/**
 * Upload a single attachment with progress tracking
 */
export async function uploadAttachmentV2(
  attachment: LocalAttachment,
  basePath: string,
  onProgress?: UploadProgressCallback,
): Promise<UploadResult> {
  const { id, uri, kind, mime, caption, viewOnce } = attachment;

  try {
    logger.info(`🔵 [uploadAttachmentV2] Starting upload for ${id}`);
    onProgress?.(id, 0, "uploading");

    const storage = getStorage();
    // Determine file extension based on kind and mime
    const extension =
      kind === "image"
        ? "jpg"
        : kind === "video"
          ? "mp4"
          : kind === "audio"
            ? mime?.includes("m4a") || mime?.includes("mp4")
              ? "m4a"
              : "aac"
            : "bin";
    const storagePath = `${basePath}/${id}.${extension}`;
    const storageRef = ref(storage, storagePath);

    // Get dimensions for images/videos
    let width: number | undefined;
    let height: number | undefined;
    if (kind === "image" || kind === "video") {
      try {
        const dims = await getImageDimensions(uri);
        width = dims.width;
        height = dims.height;
      } catch (e) {
        logger.warn("[uploadAttachmentV2] Could not get dimensions:", e);
      }
    }

    // Compress image if needed
    let processedUri = uri;
    if (kind === "image") {
      processedUri = await compressImage(
        uri,
        MAX_IMAGE_DIMENSION,
        IMAGE_QUALITY,
      );
    }

    // Convert to blob
    let blob: Blob;
    if (processedUri.startsWith("data:")) {
      blob = dataURLtoBlob(processedUri);
    } else {
      const response = await fetch(processedUri);
      blob = await response.blob();
    }

    const sizeBytes = blob.size;

    // Upload with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: mime || getMimeType(uri, kind),
    });

    // Track progress
    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = snapshot.bytesTransferred / snapshot.totalBytes;
          onProgress?.(id, progress, "uploading");
        },
        (error) => {
          logger.error(`[uploadAttachmentV2] Upload error for ${id}:`, error);
          reject(error);
        },
        () => {
          resolve();
        },
      );
    });

    // Get download URL
    const url = await getDownloadURL(storageRef);

    // Generate thumbnail for images
    let thumbUrl: string | undefined;
    let thumbPath: string | undefined;
    if (kind === "image") {
      try {
        const thumbStoragePath = `${basePath}/thumb_${id}.jpg`;
        const thumbRef = ref(storage, thumbStoragePath);
        const thumbUri = await generateThumbnail(uri);

        let thumbBlob: Blob;
        if (thumbUri.startsWith("data:")) {
          thumbBlob = dataURLtoBlob(thumbUri);
        } else {
          const thumbResponse = await fetch(thumbUri);
          thumbBlob = await thumbResponse.blob();
        }

        await uploadBytes(thumbRef, thumbBlob, { contentType: "image/jpeg" });
        thumbUrl = await getDownloadURL(thumbRef);
        thumbPath = thumbStoragePath;
      } catch (thumbError) {
        logger.warn(
          "[uploadAttachmentV2] Thumbnail generation failed:",
          thumbError,
        );
      }
    }

    onProgress?.(id, 1, "complete");

    const result: AttachmentV2 = {
      id,
      kind,
      mime: mime || getMimeType(uri, kind),
      url,
      path: storagePath,
      sizeBytes,
      width,
      height,
      thumbUrl,
      thumbPath,
      caption,
      viewOnce,
    };

    logger.info(`✅ [uploadAttachmentV2] Upload complete for ${id}`);
    return { success: true, attachment: result };
  } catch (error: any) {
    logger.error(`❌ [uploadAttachmentV2] Failed for ${id}:`, error);
    onProgress?.(id, 0, "error", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Upload multiple attachments sequentially with progress tracking
 */
export async function uploadMultipleAttachments(
  attachments: LocalAttachment[],
  basePath: string,
  onProgress?: UploadProgressCallback,
): Promise<{
  successful: AttachmentV2[];
  failed: { id: string; error: string }[];
}> {
  const successful: AttachmentV2[] = [];
  const failed: { id: string; error: string }[] = [];

  logger.info(
    `🔵 [uploadMultipleAttachments] Starting upload of ${attachments.length} attachments`,
  );

  for (const attachment of attachments) {
    const result = await uploadAttachmentV2(attachment, basePath, onProgress);

    if (result.success && result.attachment) {
      successful.push(result.attachment);
    } else {
      failed.push({
        id: attachment.id,
        error: result.error || "Unknown error",
      });
    }
  }

  logger.info(
    `✅ [uploadMultipleAttachments] Complete: ${successful.length} successful, ${failed.length} failed`,
  );

  return { successful, failed };
}

/**
 * Delete multiple attachments from storage
 */
export async function deleteAttachments(
  attachments: AttachmentV2[],
): Promise<void> {
  const storage = getStorage();

  for (const attachment of attachments) {
    try {
      // Delete main file
      const mainRef = ref(storage, attachment.path);
      await deleteObject(mainRef);

      // Delete thumbnail if exists
      if (attachment.thumbPath) {
        const thumbRef = ref(storage, attachment.thumbPath);
        await deleteObject(thumbRef);
      }

      logger.info(`✅ [deleteAttachments] Deleted ${attachment.id}`);
    } catch (error: any) {
      if (error.code !== "storage/object-not-found") {
        logger.error(
          `❌ [deleteAttachments] Failed to delete ${attachment.id}:`,
          error,
        );
      }
    }
  }
}

// =============================================================================
// H11: Voice Message Upload Support
// =============================================================================

/**
 * Voice recording data from useVoiceRecorder hook
 */
export interface VoiceRecordingData {
  /** Local file URI */
  uri: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** MIME type (e.g., "audio/mp4") */
  mimeType: string;
  /** File extension (e.g., "m4a") */
  extension: string;
}

/**
 * Result of voice message upload
 */
export interface VoiceUploadResult {
  success: boolean;
  /** Download URL */
  url?: string;
  /** Storage path */
  path?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** File size in bytes */
  sizeBytes?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Upload a voice message to Firebase Storage
 * Stores at groups/{groupId}/voice/{messageId}.m4a (or specified extension)
 *
 * @param groupId - Group chat ID
 * @param messageId - Message ID for unique file naming
 * @param recording - Voice recording data from useVoiceRecorder
 * @param onProgress - Optional progress callback (0-1)
 * @returns Upload result with URL, path, duration, and size
 */
export async function uploadVoiceMessage(
  groupId: string,
  messageId: string,
  recording: VoiceRecordingData,
  onProgress?: (progress: number) => void,
): Promise<VoiceUploadResult> {
  const { uri, durationMs, mimeType, extension } = recording;

  try {
    logger.info(`🔵 [uploadVoiceMessage] Starting upload for ${messageId}`);
    onProgress?.(0);

    const storage = getStorage();
    const storagePath = `groups/${groupId}/voice/${messageId}.${extension}`;
    const storageRef = ref(storage, storagePath);

    // Convert to blob
    let blob: Blob;
    if (uri.startsWith("data:")) {
      blob = dataURLtoBlob(uri);
    } else {
      const response = await fetch(uri);
      blob = await response.blob();
    }

    const sizeBytes = blob.size;
    logger.info(`🔵 [uploadVoiceMessage] Voice file size: ${sizeBytes} bytes`);

    // Upload with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: mimeType,
    });

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = snapshot.bytesTransferred / snapshot.totalBytes;
          onProgress?.(progress);
        },
        (error) => {
          logger.error(`[uploadVoiceMessage] Upload error:`, error);
          reject(error);
        },
        () => {
          resolve();
        },
      );
    });

    // Get download URL
    const url = await getDownloadURL(storageRef);

    onProgress?.(1);
    logger.info(`✅ [uploadVoiceMessage] Upload complete: ${storagePath}`);

    return {
      success: true,
      url,
      path: storagePath,
      durationMs,
      sizeBytes,
    };
  } catch (error: any) {
    logger.error(`❌ [uploadVoiceMessage] Failed:`, error);
    return {
      success: false,
      error: error.message || "Voice upload failed",
    };
  }
}

/**
 * Delete a voice message from storage
 * @param storagePath - Storage path to the voice file
 */
export async function deleteVoiceMessage(storagePath: string): Promise<void> {
  try {
    const storage = getStorage();
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    logger.info(`✅ [deleteVoiceMessage] Deleted: ${storagePath}`);
  } catch (error: any) {
    if (error.code !== "storage/object-not-found") {
      logger.error(`❌ [deleteVoiceMessage] Failed:`, error);
    }
  }
}
