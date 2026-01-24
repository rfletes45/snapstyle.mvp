/**
 * Attachments Service (H10 Stub)
 *
 * Handles file uploads to Firebase Storage and attachment management.
 * Supports images, videos, audio, and generic files.
 *
 * TODO: Full implementation in H10
 *
 * @module services/attachments
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot,
} from "firebase/storage";
import { getStorageInstance } from "./firebase";

// Lazy initialization - don't call at module load time
const getStorage = () => getStorageInstance();
import {
  AttachmentV2,
  LocalAttachment,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";

const log = createLogger("attachments");

// =============================================================================
// Types
// =============================================================================

interface UploadProgress {
  attachmentId: string;
  progress: number; // 0-100
  bytesTransferred: number;
  totalBytes: number;
  state: "running" | "paused" | "success" | "error" | "canceled";
  error?: string;
}

interface UploadResult {
  success: boolean;
  attachment?: AttachmentV2;
  error?: string;
}

interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  generateThumbnail?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum file size in bytes (25 MB) */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Maximum image dimension for auto-resize */
const MAX_IMAGE_DIMENSION = 2048;

/** Thumbnail size */
const THUMBNAIL_SIZE = 200;

/** Allowed MIME types by category */
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/aac", "audio/m4a"],
  file: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "application/json",
  ],
};

// =============================================================================
// Validation
// =============================================================================

/**
 * Get attachment kind from MIME type
 */
export function getKindFromMime(mime: string): AttachmentV2["kind"] | null {
  for (const [kind, types] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (types.includes(mime)) {
      return kind as AttachmentV2["kind"];
    }
  }
  return null;
}

/**
 * Check if MIME type is allowed
 */
export function isAllowedMimeType(mime: string): boolean {
  return getKindFromMime(mime) !== null;
}

/**
 * Validate file before upload
 */
export function validateFile(file: { size: number; type: string }): {
  valid: boolean;
  error?: string;
} {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
    };
  }

  if (!isAllowedMimeType(file.type)) {
    return { valid: false, error: "File type not allowed" };
  }

  return { valid: true };
}

/**
 * Validate attachment count
 */
export function validateAttachmentCount(currentCount: number): {
  valid: boolean;
  error?: string;
} {
  if (currentCount >= MAX_ATTACHMENTS_PER_MESSAGE) {
    return {
      valid: false,
      error: `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message`,
    };
  }
  return { valid: true };
}

// =============================================================================
// Storage Path Helpers
// =============================================================================

/**
 * Generate storage path for an attachment
 */
function getStoragePath(
  scope: "dm" | "group",
  conversationId: string,
  messageId: string,
  attachmentId: string,
  filename: string,
): string {
  const folder = scope === "dm" ? "chats" : "groups";
  return `${folder}/${conversationId}/messages/${messageId}/${attachmentId}_${filename}`;
}

/**
 * Generate storage path for thumbnail
 */
function getThumbnailPath(
  scope: "dm" | "group",
  conversationId: string,
  messageId: string,
  attachmentId: string,
): string {
  const folder = scope === "dm" ? "chats" : "groups";
  return `${folder}/${conversationId}/messages/${messageId}/${attachmentId}_thumb.jpg`;
}

// =============================================================================
// Upload Functions (Stubs)
// =============================================================================

/**
 * Upload a single attachment
 *
 * @param params - Upload parameters
 * @param options - Upload options
 *
 * TODO: Implement in H10
 */
export async function uploadAttachment(
  params: {
    scope: "dm" | "group";
    conversationId: string;
    messageId: string;
    localAttachment: LocalAttachment;
  },
  options?: UploadOptions,
): Promise<UploadResult> {
  log.warn("uploadAttachment: Not yet implemented (H10)", {
    operation: "uploadStub",
  });

  // TODO: Implement actual upload logic
  // 1. Read file from localAttachment.uri
  // 2. Generate thumbnail if image/video
  // 3. Upload to Firebase Storage
  // 4. Get download URL
  // 5. Return AttachmentV2

  return { success: false, error: "Not implemented" };
}

/**
 * Upload multiple attachments
 *
 * @param params - Upload parameters
 * @param options - Upload options
 *
 * TODO: Implement in H10
 */
export async function uploadAttachments(
  params: {
    scope: "dm" | "group";
    conversationId: string;
    messageId: string;
    localAttachments: LocalAttachment[];
  },
  options?: {
    onProgress?: (attachmentId: string, progress: UploadProgress) => void;
  },
): Promise<{ results: UploadResult[]; allSuccessful: boolean }> {
  log.warn("uploadAttachments: Not yet implemented (H10)", {
    operation: "uploadMultiStub",
  });

  const results: UploadResult[] = params.localAttachments.map(() => ({
    success: false,
    error: "Not implemented",
  }));

  return { results, allSuccessful: false };
}

/**
 * Cancel an ongoing upload
 *
 * @param attachmentId - Attachment ID to cancel
 *
 * TODO: Implement in H10
 */
export function cancelUpload(attachmentId: string): boolean {
  log.warn("cancelUpload: Not yet implemented (H10)");
  return false;
}

// =============================================================================
// Download Functions (Stubs)
// =============================================================================

/**
 * Get download URL for an attachment
 *
 * @param attachment - Attachment object
 *
 * TODO: Implement caching in H10
 */
export async function getAttachmentUrl(
  attachment: AttachmentV2,
): Promise<string> {
  // URL is already in the attachment
  return attachment.url;
}

/**
 * Get thumbnail URL for an attachment
 *
 * @param attachment - Attachment object
 */
export function getThumbnailUrl(attachment: AttachmentV2): string | undefined {
  return attachment.thumbUrl;
}

// =============================================================================
// Deletion (Stubs)
// =============================================================================

/**
 * Delete attachment from storage
 *
 * @param attachment - Attachment to delete
 *
 * TODO: Implement in H10 (called when message is deleted)
 */
export async function deleteAttachment(
  attachment: AttachmentV2,
): Promise<{ success: boolean; error?: string }> {
  log.warn("deleteAttachment: Not yet implemented (H10)");
  return { success: false, error: "Not implemented" };
}

/**
 * Delete all attachments for a message
 *
 * @param attachments - Attachments to delete
 *
 * TODO: Implement in H10
 */
export async function deleteMessageAttachments(
  attachments: AttachmentV2[],
): Promise<void> {
  log.warn("deleteMessageAttachments: Not yet implemented (H10)");
}

// =============================================================================
// Image Processing (Stubs)
// =============================================================================

/**
 * Generate thumbnail for image
 *
 * @param uri - Local image URI
 *
 * TODO: Implement in H10
 */
export async function generateImageThumbnail(
  uri: string,
): Promise<{ uri: string; width: number; height: number } | null> {
  log.debug("generateImageThumbnail: Not yet implemented (H10)");
  return null;
}

/**
 * Resize image if needed
 *
 * @param uri - Local image URI
 *
 * TODO: Implement in H10
 */
export async function resizeImageIfNeeded(uri: string): Promise<{
  uri: string;
  width: number;
  height: number;
  wasResized: boolean;
}> {
  log.debug("resizeImageIfNeeded: Not yet implemented (H10)");
  return {
    uri,
    width: 0,
    height: 0,
    wasResized: false,
  };
}

/**
 * Get image dimensions
 *
 * @param uri - Local image URI
 *
 * TODO: Implement in H10
 */
export async function getImageDimensions(
  uri: string,
): Promise<{ width: number; height: number } | null> {
  log.debug("getImageDimensions: Not yet implemented (H10)");
  return null;
}

// =============================================================================
// Video Processing (Stubs)
// =============================================================================

/**
 * Generate video thumbnail
 *
 * @param uri - Local video URI
 *
 * TODO: Implement in H10
 */
export async function generateVideoThumbnail(
  uri: string,
): Promise<{ uri: string; width: number; height: number } | null> {
  log.debug("generateVideoThumbnail: Not yet implemented (H10)");
  return null;
}

/**
 * Get video duration
 *
 * @param uri - Local video URI
 *
 * TODO: Implement in H10
 */
export async function getVideoDuration(uri: string): Promise<number | null> {
  log.debug("getVideoDuration: Not yet implemented (H10)");
  return null;
}

// =============================================================================
// File Info Helpers
// =============================================================================

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
}

/**
 * Get display name for file
 */
export function getDisplayFilename(
  filename: string,
  maxLength: number = 30,
): string {
  if (filename.length <= maxLength) return filename;

  const ext = getFileExtension(filename);
  const name = filename.substring(0, filename.length - ext.length - 1);
  const truncatedName = name.substring(0, maxLength - ext.length - 4);

  return `${truncatedName}...${ext}`;
}
