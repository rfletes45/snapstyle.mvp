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
import * as functions from "firebase-functions";
interface StagedAttachmentInput {
    id: string;
    kind: string;
    mime: string;
    path: string;
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
    path: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    durationMs?: number;
    thumbPath?: string;
    caption?: string;
    viewOnce?: boolean;
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
export declare function commitStagedAttachments(scope: "dm" | "group", conversationId: string, messageId: string, staged: StagedAttachmentInput[]): Promise<CommittedAttachment[]>;
/**
 * Mint a short-lived signed URL for a chat media object.
 *
 * Membership is verified before signing. The signed URL has a
 * configurable TTL (default 5 minutes).
 */
export declare const mintChatMediaUrl: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Delete objects in chat-staging/ older than STAGING_MAX_AGE_MS.
 *
 * Runs every 6 hours. Best-effort: individual delete failures are
 * logged but don't abort the run.
 */
export declare const cleanupStagingOrphans: functions.CloudFunction<unknown>;
export {};
