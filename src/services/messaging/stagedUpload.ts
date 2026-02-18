/**
 * Staged Upload Service (Segment 3A)
 *
 * When CHAT_STAGED_UPLOADS is enabled, attachments are uploaded to a
 * staging path. The server-side sendMessageV2 commits them to the
 * final path and strips any download-token metadata.
 *
 * Staging path format:
 *   chat-staging/{scope}/{conversationId}/{messageId}/{attachmentId}
 *
 * Final path (written by server):
 *   chat-media/{scope}/{conversationId}/{messageId}/{attachmentId}
 *
 * @module services/messaging/stagedUpload
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import { StagedAttachment } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { getStorage, ref, uploadBytesResumable } from "firebase/storage";

const log = createLogger("stagedUpload");

// =============================================================================
// Path Helpers
// =============================================================================

/**
 * Build the staging storage path for an attachment.
 */
export function getStagingPath(
  scope: "dm" | "group",
  conversationId: string,
  messageId: string,
  attachmentId: string,
): string {
  return `chat-staging/${scope}/${conversationId}/${messageId}/${attachmentId}`;
}

/**
 * Build the final (committed) storage path for an attachment.
 * Only used server-side or for reference.
 */
export function getFinalMediaPath(
  scope: "dm" | "group",
  conversationId: string,
  messageId: string,
  attachmentId: string,
): string {
  return `chat-media/${scope}/${conversationId}/${messageId}/${attachmentId}`;
}

// =============================================================================
// Upload
// =============================================================================

export interface StagedUploadProgress {
  attachmentId: string;
  progress: number; // 0–100
  bytesTransferred: number;
  totalBytes: number;
  state: "running" | "paused" | "success" | "error" | "canceled";
  error?: string;
}

export interface StagedUploadResult {
  success: boolean;
  staged?: StagedAttachment;
  error?: string;
}

/**
 * Upload a single file to the staging bucket path.
 *
 * This is the Segment 3A client-side entry point. The resulting
 * {@link StagedAttachment} should be included in the sendMessageV2
 * payload (under `stagedAttachments`). The server will validate +
 * commit the object from staging → final path.
 *
 * @param params Upload parameters
 * @param onProgress Optional progress callback
 * @returns Upload result with staged attachment metadata
 */
export async function uploadToStaging(
  params: {
    scope: "dm" | "group";
    conversationId: string;
    messageId: string;
    attachmentId: string;
    fileUri: string;
    mime: string;
    sizeBytes: number;
    kind: StagedAttachment["kind"];
    width?: number;
    height?: number;
    durationMs?: number;
    thumbUri?: string;
    caption?: string;
    viewOnce?: boolean;
  },
  onProgress?: (progress: StagedUploadProgress) => void,
): Promise<StagedUploadResult> {
  if (!CHAT_FEATURES.CHAT_STAGED_UPLOADS) {
    return { success: false, error: "CHAT_STAGED_UPLOADS flag is disabled" };
  }

  const {
    scope,
    conversationId,
    messageId,
    attachmentId,
    fileUri,
    mime,
    sizeBytes,
    kind,
    width,
    height,
    durationMs,
    caption,
    viewOnce,
  } = params;

  const stagingPath = getStagingPath(
    scope,
    conversationId,
    messageId,
    attachmentId,
  );

  try {
    log.debug("Starting staged upload", {
      operation: "uploadToStaging",
      data: { stagingPath, mime, sizeBytes },
    });

    // Fetch file data from URI
    const response = await fetch(fileUri);
    const blob = await response.blob();

    const storage = getStorage();
    const storageRef = ref(storage, stagingPath);

    // Upload with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: mime,
      // Do NOT set customMetadata with firebaseStorageDownloadTokens —
      // the server will strip them during commit anyway.
    });

    return new Promise<StagedUploadResult>((resolve) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress?.({
            attachmentId,
            progress,
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            state:
              snapshot.state === "running"
                ? "running"
                : snapshot.state === "paused"
                  ? "paused"
                  : "running",
          });
        },
        (error) => {
          log.error("Staged upload failed", {
            operation: "uploadToStaging",
            data: { stagingPath, error: error.message },
          });
          onProgress?.({
            attachmentId,
            progress: 0,
            bytesTransferred: 0,
            totalBytes: sizeBytes,
            state: "error",
            error: error.message,
          });
          resolve({ success: false, error: error.message });
        },
        () => {
          // Success — build StagedAttachment
          const staged: StagedAttachment = {
            id: attachmentId,
            kind,
            mime,
            path: stagingPath,
            sizeBytes,
            width,
            height,
            durationMs,
            caption,
            viewOnce,
          };

          // Handle thumbnail if provided
          if (params.thumbUri) {
            staged.thumbPath = `${stagingPath}_thumb`;
            // Thumbnail upload is fire-and-forget; we don't block on it
            uploadThumbnail(
              staged.thumbPath,
              params.thumbUri,
              "image/jpeg",
            ).catch((e) =>
              log.warn("Thumbnail upload failed", {
                operation: "uploadThumb",
                data: { error: e },
              }),
            );
          }

          onProgress?.({
            attachmentId,
            progress: 100,
            bytesTransferred: sizeBytes,
            totalBytes: sizeBytes,
            state: "success",
          });

          log.debug("Staged upload complete", {
            operation: "uploadToStaging",
            data: { stagingPath },
          });

          resolve({ success: true, staged });
        },
      );
    });
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown upload error";
    log.error("Staged upload exception", {
      operation: "uploadToStaging",
      data: { stagingPath, error: errMsg },
    });
    return { success: false, error: errMsg };
  }
}

/**
 * Upload a thumbnail to its staging path (fire-and-forget helper).
 */
async function uploadThumbnail(
  thumbPath: string,
  thumbUri: string,
  mime: string,
): Promise<void> {
  const response = await fetch(thumbUri);
  const blob = await response.blob();
  const storage = getStorage();
  const storageRef = ref(storage, thumbPath);
  await uploadBytesResumable(storageRef, blob, { contentType: mime });
}
