/**
 * Media Cache Service
 *
 * Local file storage for images, videos, and audio.
 * Uses expo-file-system for persistent storage.
 *
 * @file src/services/mediaCache.ts
 */

// Using legacy API for compatibility with expo-file-system v19+
import {
  copyAsync,
  createDownloadResumable,
  deleteAsync,
  documentDirectory,
  downloadAsync,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  moveAsync,
  readAsStringAsync,
  readDirectoryAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { Platform } from "react-native";
import { getDatabase } from "./database";
import { updateAttachmentLocalUri } from "./database/messageRepository";

// =============================================================================
// Constants
// =============================================================================

const MEDIA_DIRECTORY = `${documentDirectory}snapstyle/media/`;
const TEMP_DIRECTORY = `${documentDirectory}snapstyle/temp/`;

const SUBDIRECTORIES = {
  images: `${MEDIA_DIRECTORY}images/`,
  videos: `${MEDIA_DIRECTORY}videos/`,
  audio: `${MEDIA_DIRECTORY}audio/`,
  files: `${MEDIA_DIRECTORY}files/`,
  uploads: `${TEMP_DIRECTORY}uploads/`,
};

// Export directory paths for external use
export const MEDIA_PATHS = {
  root: MEDIA_DIRECTORY,
  temp: TEMP_DIRECTORY,
  ...SUBDIRECTORIES,
};

// =============================================================================
// Types
// =============================================================================

export type MediaKind = "image" | "video" | "audio" | "file";

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  progress: number;
}

export interface CacheStats {
  totalSize: number;
  imageCount: number;
  videoCount: number;
  audioCount: number;
  fileCount: number;
}

// =============================================================================
// Initialization
// =============================================================================

let initialized = false;

/**
 * Initialize media directories
 */
export async function initializeMediaCache(): Promise<void> {
  if (initialized) return;

  try {
    // Create all directories
    for (const dir of Object.values(SUBDIRECTORIES)) {
      const info = await getInfoAsync(dir);
      if (!info.exists) {
        await makeDirectoryAsync(dir, { intermediates: true });
      }
    }

    initialized = true;
    console.log("[MediaCache] Directories initialized");
  } catch (error) {
    console.error("[MediaCache] Failed to initialize:", error);
    throw error;
  }
}

/**
 * Ensure media cache is initialized
 */
async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await initializeMediaCache();
  }
}

// =============================================================================
// Download Operations
// =============================================================================

/**
 * Download and cache a remote attachment
 */
export async function downloadAttachment(
  attachmentId: string,
  remoteUrl: string,
  kind: MediaKind,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
  await ensureInitialized();

  const extension = getExtensionFromUrl(remoteUrl) || getDefaultExtension(kind);
  const subdir = getSubdirectoryForKind(kind);
  const localPath = `${subdir}${attachmentId}${extension}`;

  // Check if already downloaded
  const info = await getInfoAsync(localPath);
  if (info.exists) {
    return localPath;
  }

  // Update status to downloading
  const db = getDatabase();
  db.runSync("UPDATE attachments SET download_status = ? WHERE id = ?", [
    "downloading",
    attachmentId,
  ]);

  try {
    // Download with progress
    const downloadResumable = createDownloadResumable(
      remoteUrl,
      localPath,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        onProgress?.({
          totalBytesWritten: downloadProgress.totalBytesWritten,
          totalBytesExpectedToWrite: downloadProgress.totalBytesExpectedToWrite,
          progress,
        });
      },
    );

    const result = await downloadResumable.downloadAsync();

    if (!result?.uri) {
      throw new Error("Download failed - no URI returned");
    }

    // Update database with local path
    updateAttachmentLocalUri(attachmentId, result.uri);

    console.log(`[MediaCache] Downloaded attachment ${attachmentId}`);
    return result.uri;
  } catch (error) {
    // Mark as failed
    db.runSync("UPDATE attachments SET download_status = ? WHERE id = ?", [
      "failed",
      attachmentId,
    ]);
    console.error(`[MediaCache] Download failed for ${attachmentId}:`, error);
    throw error;
  }
}

/**
 * Download thumbnail for an attachment
 */
export async function downloadThumbnail(
  attachmentId: string,
  thumbUrl: string,
): Promise<string> {
  await ensureInitialized();

  const localPath = `${SUBDIRECTORIES.images}${attachmentId}_thumb.jpg`;

  // Check if already downloaded
  const info = await getInfoAsync(localPath);
  if (info.exists) {
    return localPath;
  }

  try {
    const result = await downloadAsync(thumbUrl, localPath);

    if (!result?.uri) {
      throw new Error("Thumbnail download failed");
    }

    // Update thumb URI in database
    const db = getDatabase();
    db.runSync("UPDATE attachments SET thumb_local_uri = ? WHERE id = ?", [
      result.uri,
      attachmentId,
    ]);

    console.log(`[MediaCache] Downloaded thumbnail for ${attachmentId}`);
    return result.uri;
  } catch (error) {
    console.error(
      `[MediaCache] Thumbnail download failed for ${attachmentId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Get attachment from cache or download if not present
 */
export async function getOrDownloadAttachment(
  attachmentId: string,
  remoteUrl: string,
  kind: MediaKind,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
  const db = getDatabase();
  const attachment = db.getFirstSync<{ local_uri: string | null }>(
    "SELECT local_uri FROM attachments WHERE id = ?",
    [attachmentId],
  );

  if (attachment?.local_uri) {
    // Verify file exists
    const info = await getInfoAsync(attachment.local_uri);
    if (info.exists) {
      return attachment.local_uri;
    }
    // File was deleted, clear the cached path
    db.runSync(
      "UPDATE attachments SET local_uri = NULL, download_status = 'none' WHERE id = ?",
      [attachmentId],
    );
  }

  // Download if not cached
  return downloadAttachment(attachmentId, remoteUrl, kind, onProgress);
}

/**
 * Get thumbnail from cache or download if not present
 */
export async function getOrDownloadThumbnail(
  attachmentId: string,
  thumbUrl: string,
): Promise<string> {
  const db = getDatabase();
  const attachment = db.getFirstSync<{ thumb_local_uri: string | null }>(
    "SELECT thumb_local_uri FROM attachments WHERE id = ?",
    [attachmentId],
  );

  if (attachment?.thumb_local_uri) {
    // Verify file exists
    const info = await getInfoAsync(attachment.thumb_local_uri);
    if (info.exists) {
      return attachment.thumb_local_uri;
    }
    // File was deleted, clear the cached path
    db.runSync("UPDATE attachments SET thumb_local_uri = NULL WHERE id = ?", [
      attachmentId,
    ]);
  }

  // Download if not cached
  return downloadThumbnail(attachmentId, thumbUrl);
}

/**
 * Check if attachment is cached locally
 */
export async function isAttachmentCached(
  attachmentId: string,
): Promise<boolean> {
  const db = getDatabase();
  const attachment = db.getFirstSync<{ local_uri: string | null }>(
    "SELECT local_uri FROM attachments WHERE id = ?",
    [attachmentId],
  );

  if (!attachment?.local_uri) {
    return false;
  }

  const info = await getInfoAsync(attachment.local_uri);
  return info.exists;
}

// =============================================================================
// Upload Staging
// =============================================================================

/**
 * Copy a local file to upload staging area
 * Returns the staged file path
 */
export async function stageFileForUpload(
  sourceUri: string,
  attachmentId: string,
  extension: string,
): Promise<string> {
  await ensureInitialized();

  const stagedPath = `${SUBDIRECTORIES.uploads}${attachmentId}${extension}`;

  // Handle different URI schemes
  if (sourceUri.startsWith("data:")) {
    // Data URL - decode and write
    await writeDataUrlToFile(sourceUri, stagedPath);
  } else if (sourceUri.startsWith("file://") || sourceUri.startsWith("/")) {
    // Local file - copy
    await copyAsync({ from: sourceUri, to: stagedPath });
  } else if (sourceUri.startsWith("content://")) {
    // Android content URI - copy
    await copyAsync({ from: sourceUri, to: stagedPath });
  } else if (Platform.OS === "web") {
    // Web blob URL - can't stage, return source
    return sourceUri;
  } else {
    throw new Error(`Unsupported URI scheme: ${sourceUri.slice(0, 30)}`);
  }

  console.log(`[MediaCache] Staged file for upload: ${attachmentId}`);
  return stagedPath;
}

/**
 * Move staged file to permanent location after successful upload
 */
export async function moveToMediaCache(
  stagedPath: string,
  attachmentId: string,
  kind: MediaKind,
): Promise<string> {
  const extension = getExtensionFromPath(stagedPath);
  const subdir = getSubdirectoryForKind(kind);
  const permanentPath = `${subdir}${attachmentId}${extension}`;

  await moveAsync({ from: stagedPath, to: permanentPath });

  // Update database
  updateAttachmentLocalUri(attachmentId, permanentPath);

  console.log(`[MediaCache] Moved to permanent cache: ${attachmentId}`);
  return permanentPath;
}

/**
 * Stage file and immediately move to permanent cache
 * Use this when not uploading to remote storage
 */
export async function cacheLocalFile(
  sourceUri: string,
  attachmentId: string,
  kind: MediaKind,
  extension: string,
): Promise<string> {
  const stagedPath = await stageFileForUpload(
    sourceUri,
    attachmentId,
    extension,
  );
  return moveToMediaCache(stagedPath, attachmentId, kind);
}

/**
 * Clean up staged files older than specified age
 */
export async function cleanupStagedFiles(
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): Promise<number> {
  await ensureInitialized();

  let deletedCount = 0;

  try {
    const files = await readDirectoryAsync(SUBDIRECTORIES.uploads);
    const now = Date.now();

    for (const file of files) {
      const filePath = `${SUBDIRECTORIES.uploads}${file}`;
      try {
        const info = await getInfoAsync(filePath);
        if (
          info.exists &&
          info.modificationTime &&
          now - info.modificationTime * 1000 > maxAgeMs
        ) {
          await deleteAsync(filePath, { idempotent: true });
          deletedCount++;
        }
      } catch {
        // Ignore errors during cleanup
      }
    }

    if (deletedCount > 0) {
      console.log(`[MediaCache] Cleaned up ${deletedCount} staged files`);
    }
  } catch {
    // Directory might not exist
  }

  return deletedCount;
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Get detailed cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  await ensureInitialized();

  const stats: CacheStats = {
    totalSize: 0,
    imageCount: 0,
    videoCount: 0,
    audioCount: 0,
    fileCount: 0,
  };

  const directories = [
    { path: SUBDIRECTORIES.images, key: "imageCount" as const },
    { path: SUBDIRECTORIES.videos, key: "videoCount" as const },
    { path: SUBDIRECTORIES.audio, key: "audioCount" as const },
    { path: SUBDIRECTORIES.files, key: "fileCount" as const },
  ];

  for (const { path, key } of directories) {
    try {
      const files = await readDirectoryAsync(path);
      stats[key] = files.length;

      for (const file of files) {
        const info = await getInfoAsync(`${path}${file}`);
        if (info.exists && info.size) {
          stats.totalSize += info.size;
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  return stats;
}

/**
 * Get total cache size in bytes
 */
export async function getCacheSize(): Promise<number> {
  const stats = await getCacheStats();
  return stats.totalSize;
}

/**
 * Format cache size for display
 */
export function formatCacheSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Clear all cached media
 */
export async function clearMediaCache(): Promise<void> {
  console.log("[MediaCache] Clearing all cached media...");

  for (const dir of Object.values(SUBDIRECTORIES)) {
    try {
      await deleteAsync(dir, { idempotent: true });
    } catch {
      // Ignore errors
    }
  }

  // Reset download status in database
  const db = getDatabase();
  db.runSync(
    `UPDATE attachments SET 
      local_uri = NULL, 
      thumb_local_uri = NULL, 
      download_status = 'none' 
    WHERE download_status = 'downloaded'`,
  );

  initialized = false;
  await initializeMediaCache();

  console.log("[MediaCache] Cache cleared and reinitialized");
}

/**
 * Delete cached file for a specific attachment
 */
export async function deleteAttachmentCache(
  attachmentId: string,
): Promise<void> {
  const db = getDatabase();
  const attachment = db.getFirstSync<{
    local_uri: string | null;
    thumb_local_uri: string | null;
  }>("SELECT local_uri, thumb_local_uri FROM attachments WHERE id = ?", [
    attachmentId,
  ]);

  if (attachment?.local_uri) {
    await deleteAsync(attachment.local_uri, { idempotent: true });
  }
  if (attachment?.thumb_local_uri) {
    await deleteAsync(attachment.thumb_local_uri, {
      idempotent: true,
    });
  }

  db.runSync(
    `UPDATE attachments SET 
      local_uri = NULL, 
      thumb_local_uri = NULL, 
      download_status = 'none' 
    WHERE id = ?`,
    [attachmentId],
  );

  console.log(`[MediaCache] Deleted cache for attachment ${attachmentId}`);
}

/**
 * Delete cached files for all attachments in a conversation
 */
export async function deleteConversationCache(
  conversationId: string,
): Promise<number> {
  const db = getDatabase();
  const attachments = db.getAllSync<{
    id: string;
    local_uri: string | null;
    thumb_local_uri: string | null;
  }>(
    `SELECT a.id, a.local_uri, a.thumb_local_uri 
     FROM attachments a 
     JOIN messages m ON a.message_id = m.id 
     WHERE m.conversation_id = ?`,
    [conversationId],
  );

  let deletedCount = 0;

  for (const att of attachments) {
    if (att.local_uri) {
      await deleteAsync(att.local_uri, { idempotent: true });
      deletedCount++;
    }
    if (att.thumb_local_uri) {
      await deleteAsync(att.thumb_local_uri, { idempotent: true });
    }
  }

  // Update database
  db.runSync(
    `UPDATE attachments SET 
      local_uri = NULL, 
      thumb_local_uri = NULL, 
      download_status = 'none' 
    WHERE message_id IN (
      SELECT id FROM messages WHERE conversation_id = ?
    )`,
    [conversationId],
  );

  console.log(
    `[MediaCache] Deleted ${deletedCount} cached files for conversation ${conversationId}`,
  );
  return deletedCount;
}

/**
 * Prune cache to stay under a size limit
 * Removes oldest files first until under limit
 */
export async function pruneCache(maxSizeBytes: number): Promise<number> {
  await ensureInitialized();

  const stats = await getCacheStats();
  if (stats.totalSize <= maxSizeBytes) {
    return 0;
  }

  const db = getDatabase();
  let freedBytes = 0;
  let targetFreed = stats.totalSize - maxSizeBytes;

  // Get attachments ordered by message creation time (oldest first)
  const attachments = db.getAllSync<{
    id: string;
    local_uri: string | null;
    thumb_local_uri: string | null;
  }>(
    `SELECT a.id, a.local_uri, a.thumb_local_uri 
     FROM attachments a 
     JOIN messages m ON a.message_id = m.id 
     WHERE a.download_status = 'downloaded'
     ORDER BY m.created_at ASC`,
  );

  for (const att of attachments) {
    if (freedBytes >= targetFreed) break;

    if (att.local_uri) {
      try {
        const info = await getInfoAsync(att.local_uri);
        if (info.exists && info.size) {
          await deleteAsync(att.local_uri, { idempotent: true });
          freedBytes += info.size;
        }
      } catch {
        // Ignore errors
      }
    }

    if (att.thumb_local_uri) {
      try {
        await deleteAsync(att.thumb_local_uri, { idempotent: true });
      } catch {
        // Ignore errors
      }
    }

    // Update database
    db.runSync(
      `UPDATE attachments SET 
        local_uri = NULL, 
        thumb_local_uri = NULL, 
        download_status = 'none' 
      WHERE id = ?`,
      [att.id],
    );
  }

  console.log(`[MediaCache] Pruned ${formatCacheSize(freedBytes)} from cache`);
  return freedBytes;
}

// =============================================================================
// File Operations
// =============================================================================

/**
 * Check if a local file exists
 */
export async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Get file size in bytes
 */
export async function getFileSize(uri: string): Promise<number | null> {
  try {
    const info = await getInfoAsync(uri);
    return info.exists ? (info.size ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Copy file to a new location
 */
export async function copyFile(from: string, to: string): Promise<void> {
  await copyAsync({ from, to });
}

/**
 * Read file as base64
 */
export async function readFileAsBase64(uri: string): Promise<string> {
  return readAsStringAsync(uri, {
    encoding: EncodingType.Base64,
  });
}

/**
 * Write base64 data to file
 */
export async function writeBase64ToFile(
  base64: string,
  uri: string,
): Promise<void> {
  await writeAsStringAsync(uri, base64, {
    encoding: EncodingType.Base64,
  });
}

// =============================================================================
// Helpers
// =============================================================================

function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.[a-zA-Z0-9]+$/);
    return match ? match[0] : "";
  } catch {
    // Try parsing without URL constructor for relative paths
    const match = url.match(/\.[a-zA-Z0-9]+(?:\?|$)/);
    return match ? match[0].replace("?", "") : "";
  }
}

function getExtensionFromPath(path: string): string {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return "";
  return path.slice(lastDot);
}

function getDefaultExtension(kind: MediaKind): string {
  switch (kind) {
    case "image":
      return ".jpg";
    case "video":
      return ".mp4";
    case "audio":
      return ".m4a";
    case "file":
      return "";
    default:
      return "";
  }
}

function getSubdirectoryForKind(kind: MediaKind): string {
  switch (kind) {
    case "image":
      return SUBDIRECTORIES.images;
    case "video":
      return SUBDIRECTORIES.videos;
    case "audio":
      return SUBDIRECTORIES.audio;
    case "file":
    default:
      return SUBDIRECTORIES.files;
  }
}

async function writeDataUrlToFile(
  dataUrl: string,
  path: string,
): Promise<void> {
  const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid data URL format");
  }
  const base64 = base64Match[1];
  await writeAsStringAsync(path, base64, {
    encoding: EncodingType.Base64,
  });
}

/**
 * Get MIME type from extension
 */
export function getMimeTypeFromExtension(extension: string): string {
  const ext = extension.toLowerCase().replace(".", "");
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Get media kind from MIME type
 */
export function getMediaKindFromMime(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}
