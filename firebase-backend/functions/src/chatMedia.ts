/**
 * Chat Media Cloud Functions (Segment 3)
 *
 * Server-side functions for the improved media pipeline:
 *
 *  B) commitStagedAttachments — called by sendMessageV2 to copy
 *     objects from chat-staging → chat-media, strip download tokens,
 *     and delete staging objects.
 *
 *  C) mintChatMediaUrl — callable that mints short-lived signed URLs
 *     for chat media, verifying membership before signing.
 *
 *  D) cleanupStagingOrphans — scheduled function to delete staging
 *     objects older than N hours.
 *
 * @module functions/chatMedia
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

function getDb() {
  return admin.firestore();
}

// =============================================================================
// Feature flag — read from a server-side env config or hardcode.
// Cloud Functions don't import client-side featureFlags; use env config
// or a simple boolean. For Phase 1, behaviour is only activated when the
// client sends staged attachments.
// =============================================================================

/** Signed URL lifetime in seconds (5 minutes). */
const SIGNED_URL_TTL_SECONDS = 5 * 60;

/** Max staging age before orphan cleanup (6 hours). */
const STAGING_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Maximum attachments per message. */
const MAX_ATTACHMENTS = 10;

/** Maximum individual file size (25 MB). */
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/** Allowed MIME prefixes for chat media. */
const ALLOWED_MIME_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "application/msword",
  "application/vnd.",
  "text/plain",
  "application/json",
];

// =============================================================================
// B) commitStagedAttachments — invoked from sendMessageV2
// =============================================================================

interface StagedAttachmentInput {
  id: string;
  kind: string;
  mime: string;
  path: string; // staging path
  sizeBytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
  thumbPath?: string;
  caption?: string;
  viewOnce?: boolean;
}

interface CommittedAttachment {
  id: string;
  kind: string;
  mime: string;
  path: string; // final path
  sizeBytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
  thumbPath?: string;
  caption?: string;
  viewOnce?: boolean;
  // url field intentionally omitted — path only
}

/**
 * Validate and commit staged attachments to final paths.
 *
 * Called internally from sendMessageV2 when the client provides
 * `stagedAttachments`. This function:
 *
 *  1. Validates count, size, MIME type
 *  2. Copies each object from staging → final path
 *  3. Removes `firebaseStorageDownloadTokens` metadata
 *  4. Deletes staging objects (best-effort)
 *  5. Returns the final attachment metadata (path-only, no URL)
 *
 * @throws functions.https.HttpsError on validation failure
 */
export async function commitStagedAttachments(
  scope: "dm" | "group",
  conversationId: string,
  messageId: string,
  staged: StagedAttachmentInput[],
): Promise<CommittedAttachment[]> {
  // Validate count
  if (staged.length > MAX_ATTACHMENTS) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Maximum ${MAX_ATTACHMENTS} attachments per message`,
    );
  }

  const bucket = admin.storage().bucket();
  const committed: CommittedAttachment[] = [];

  for (const att of staged) {
    // Validate MIME type
    if (!ALLOWED_MIME_PREFIXES.some((prefix) => att.mime.startsWith(prefix))) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Unsupported MIME type: ${att.mime}`,
      );
    }

    // Validate size
    if (att.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Attachment ${att.id} exceeds max size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
      );
    }

    // Validate staging path format
    const expectedPrefix = `chat-staging/${scope}/${conversationId}/${messageId}/`;
    if (!att.path.startsWith(expectedPrefix)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Invalid staging path for attachment ${att.id}`,
      );
    }

    // Build final path
    const finalPath = `chat-media/${scope}/${conversationId}/${messageId}/${att.id}`;

    try {
      // Copy staging → final
      const stagingFile = bucket.file(att.path);
      const [exists] = await stagingFile.exists();
      if (!exists) {
        throw new functions.https.HttpsError(
          "not-found",
          `Staging object not found for attachment ${att.id}`,
        );
      }

      await stagingFile.copy(bucket.file(finalPath));

      // Remove download-token metadata from final file
      const finalFile = bucket.file(finalPath);
      const [metadata] = await finalFile.getMetadata();
      if (metadata?.metadata?.firebaseStorageDownloadTokens) {
        const cleanedMeta = { ...metadata.metadata };
        delete cleanedMeta.firebaseStorageDownloadTokens;
        await finalFile.setMetadata({ metadata: cleanedMeta });
      }

      // Delete staging object (best-effort)
      stagingFile.delete().catch((e: Error) => {
        console.warn(
          `[commitStagedAttachments] Failed to delete staging ${att.path}: ${e.message}`,
        );
      });

      // Handle thumbnail if present
      let finalThumbPath: string | undefined;
      if (att.thumbPath) {
        const thumbFinalPath = `${finalPath}_thumb`;
        const thumbStagingFile = bucket.file(att.thumbPath);
        const [thumbExists] = await thumbStagingFile.exists();
        if (thumbExists) {
          await thumbStagingFile.copy(bucket.file(thumbFinalPath));
          // Remove tokens from thumb
          const thumbFinal = bucket.file(thumbFinalPath);
          const [thumbMeta] = await thumbFinal.getMetadata();
          if (thumbMeta?.metadata?.firebaseStorageDownloadTokens) {
            const cleanedThumbMeta = { ...thumbMeta.metadata };
            delete cleanedThumbMeta.firebaseStorageDownloadTokens;
            await thumbFinal.setMetadata({ metadata: cleanedThumbMeta });
          }
          // Delete staging thumb
          thumbStagingFile.delete().catch(() => {});
          finalThumbPath = thumbFinalPath;
        }
      }

      committed.push({
        id: att.id,
        kind: att.kind,
        mime: att.mime,
        path: finalPath,
        sizeBytes: att.sizeBytes,
        width: att.width,
        height: att.height,
        durationMs: att.durationMs,
        thumbPath: finalThumbPath,
        caption: att.caption,
        viewOnce: att.viewOnce,
      });
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      console.error(
        `[commitStagedAttachments] Failed to commit ${att.id}:`,
        error,
      );
      throw new functions.https.HttpsError(
        "internal",
        `Failed to commit attachment ${att.id}`,
      );
    }
  }

  return committed;
}

// =============================================================================
// C) mintChatMediaUrl — callable
// =============================================================================

interface MintChatMediaUrlInput {
  scope: "dm" | "group";
  conversationId: string;
  messageId: string;
  path: string;
  variant?: string;
}

interface MintChatMediaUrlResponse {
  url: string;
  expiresAt: number;
}

/**
 * Mint a short-lived signed URL for a chat media object.
 *
 * Membership is verified before signing. The signed URL has a
 * configurable TTL (default 5 minutes).
 */
export const mintChatMediaUrl = functions.https.onCall(
  async (
    data: MintChatMediaUrlInput,
    context,
  ): Promise<MintChatMediaUrlResponse> => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const uid = context.auth.uid;
    const { scope, conversationId, messageId, path, variant } = data;

    // Validate inputs
    if (!scope || !["dm", "group"].includes(scope)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid scope");
    }
    if (!conversationId || typeof conversationId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid conversationId",
      );
    }
    if (!path || typeof path !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "Invalid path");
    }

    // Validate path belongs to this conversation
    const allowedPrefixes = [
      `chat-media/${scope}/${conversationId}/`,
      // Also allow legacy paths for backward compat
      scope === "dm" ? `chats/${conversationId}/` : `groups/${conversationId}/`,
    ];
    const pathOk = allowedPrefixes.some((prefix) => path.startsWith(prefix));
    if (!pathOk) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Path does not belong to this conversation",
      );
    }

    // Membership check
    const db = getDb();
    if (scope === "dm") {
      const chatDoc = await db.collection("Chats").doc(conversationId).get();
      if (!chatDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Chat not found");
      }
      const members = chatDoc.data()?.members || [];
      if (!members.includes(uid)) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Not a member of this conversation",
        );
      }
    } else {
      const memberDoc = await db
        .collection("Groups")
        .doc(conversationId)
        .collection("Members")
        .doc(uid)
        .get();
      if (!memberDoc.exists) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Not a member of this group",
        );
      }
    }

    // Determine actual path (variant = "thumb" appends _thumb)
    let actualPath = path;
    if (variant === "thumb") {
      actualPath = `${path}_thumb`;
    }

    // Sign URL
    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(actualPath);

      const [exists] = await file.exists();
      if (!exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Media object not found",
        );
      }

      const expiresAt = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;

      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: new Date(expiresAt),
      });

      console.log(
        `[mintChatMediaUrl] Signed URL minted for ${uid.substring(0, 8)}, path=${actualPath.substring(0, 40)}...`,
      );

      return { url: signedUrl, expiresAt };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      console.error("[mintChatMediaUrl] Signing failed:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to generate signed URL",
      );
    }
  },
);

// =============================================================================
// D) cleanupStagingOrphans — scheduled
// =============================================================================

/**
 * Delete objects in chat-staging/ older than STAGING_MAX_AGE_MS.
 *
 * Runs every 6 hours. Best-effort: individual delete failures are
 * logged but don't abort the run.
 */
export const cleanupStagingOrphans = functions.pubsub
  .schedule("every 6 hours")
  .onRun(async () => {
    const bucket = admin.storage().bucket();
    const cutoff = Date.now() - STAGING_MAX_AGE_MS;

    console.log(
      `[cleanupStagingOrphans] Starting. Cutoff: ${new Date(cutoff).toISOString()}`,
    );

    let deletedCount = 0;
    let errorCount = 0;

    try {
      const [files] = await bucket.getFiles({ prefix: "chat-staging/" });

      for (const file of files) {
        try {
          const [metadata] = await file.getMetadata();
          const createdMs = metadata.timeCreated
            ? new Date(metadata.timeCreated).getTime()
            : 0;

          if (createdMs > 0 && createdMs < cutoff) {
            await file.delete();
            deletedCount++;
          }
        } catch (err) {
          errorCount++;
          console.warn(
            `[cleanupStagingOrphans] Failed to process ${file.name}:`,
            err,
          );
        }
      }
    } catch (err) {
      console.error(
        "[cleanupStagingOrphans] Failed to list staging files:",
        err,
      );
    }

    console.log(
      `[cleanupStagingOrphans] Done. Deleted: ${deletedCount}, Errors: ${errorCount}`,
    );
  });
