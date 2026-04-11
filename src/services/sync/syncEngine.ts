/**
 * Sync Engine
 *
 * Bidirectional sync between SQLite and Firestore.
 * Handles conflict resolution with server-wins strategy.
 *
 * @file src/services/sync/syncEngine.ts
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import {
  getDatabase,
  getDatabaseUnavailableReason,
  isDatabaseRuntimeAvailable,
} from "@/services/database";
import {
  getPendingMessages,
  markMessagePermanentlyFailed,
  markMessageSynced,
  markMessageSyncFailed,
  MAX_MESSAGE_RETRIES,
  MessageWithAttachments,
  updateAttachmentUploadStatus,
  upsertMessageFromServer,
} from "@/services/database/messageRepository";
import {
  getFirestoreInstance,
  getFunctionsInstance,
} from "@/services/firebase";
import {
  fromGroupMessage,
  isLegacyGroupMessage,
} from "@/services/messaging/adapters/groupAdapter";
import { LocalAttachment, uploadMultipleAttachments } from "@/services/storage";
import { AttachmentV2, MessageV2, ReplyToMetadata } from "@/types/messaging";
import type { GroupMessage } from "@/types/models";
import { toTimestamp } from "@/utils/dates";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/sync/syncEngine");
// =============================================================================
// Types
// =============================================================================

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: number | null;
  pendingCount: number;
  error: string | null;
}

type SyncStateListener = (state: SyncState) => void;

interface SendMessagePayload {
  messageId: string;
  clientId: string;
  scope: "dm" | "group";
  conversationId: string;
  kind: string;
  text?: string;
  /** Animal theme ID (required when kind="animal") */
  animalId?: string;
  attachments?: AttachmentV2[];
  replyToId?: string;
  /** Full reply metadata – required by sendMessageV2 Cloud Function */
  replyTo?: ReplyToMetadata;
  /** Thread root message ID for threading */
  threadRootId?: string;
  mentionUids?: string[];
  createdAt?: number;
}

interface SendMessageResponse {
  serverReceivedAt: number;
}

// =============================================================================
// State
// =============================================================================

let syncState: SyncState = {
  isOnline: true,
  isSyncing: false,
  lastSyncAt: null,
  pendingCount: 0,
  error: null,
};

const listeners = new Set<SyncStateListener>();

interface ConversationSubscription {
  scope: "dm" | "group";
  conversationId: string;
  listeners: Set<(message: MessageV2) => void>;
  unsubscribe: Unsubscribe;
}

const activeSubscriptions = new Map<string, ConversationSubscription>();

function getSubscriptionKey(
  scope: "dm" | "group",
  conversationId: string,
): string {
  return `${scope}:${conversationId}`;
}

/**
 * Notify all UI listeners for a conversation that data has changed.
 * Used after local sync completion so the UI re-reads SQLite immediately
 * instead of waiting for the Firestore onSnapshot round-trip.
 */
function notifyConversationListeners(
  scope: "dm" | "group",
  conversationId: string,
): void {
  const key = getSubscriptionKey(scope, conversationId);
  const sub = activeSubscriptions.get(key);
  if (sub) {
    sub.listeners.forEach((cb) => {
      try {
        cb({} as MessageV2);
      } catch (e) {
        logger.warn("[SyncEngine] Listener notification error:", e);
      }
    });
  }
}

// =============================================================================
// State Management
// =============================================================================

function updateSyncState(updates: Partial<SyncState>): void {
  syncState = { ...syncState, ...updates };
  listeners.forEach((listener) => listener(syncState));
}

/**
 * Get current sync state
 */
export function getSyncState(): SyncState {
  return { ...syncState };
}

/**
 * Subscribe to sync state changes
 */
export function subscribeSyncState(listener: SyncStateListener): () => void {
  listeners.add(listener);
  listener(syncState);
  return () => listeners.delete(listener);
}

/**
 * Set online/offline status
 */
export function setOnlineStatus(online: boolean): void {
  const wasOffline = !syncState.isOnline;
  updateSyncState({ isOnline: online });

  if (online && wasOffline && !syncState.isSyncing) {
    // Trigger sync when coming back online
    syncPendingMessages();
  }
}

/**
 * Update pending count from database
 */
export function refreshPendingCount(): void {
  // Single COUNT query — avoids the redundant getPendingMessages(1) call
  const db = getDatabase();
  const result = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM messages WHERE sync_status IN ('pending', 'failed') AND retry_count < ${MAX_MESSAGE_RETRIES}`,
  );
  updateSyncState({ pendingCount: result?.count || 0 });
}

// =============================================================================
// Upload Pending Messages (Push Sync)
// =============================================================================

/**
 * Clean up orphaned messages that have no conversation_id.
 * These can never be synced so mark them as permanently failed.
 */
function cleanupOrphanedMessages(): void {
  const db = getDatabase();
  const orphaned = db.getAllSync<{ id: string }>(
    `SELECT id FROM messages
     WHERE sync_status IN ('pending', 'failed')
     AND (conversation_id IS NULL OR conversation_id = '')
     AND retry_count < 999`,
  );

  if (orphaned.length > 0) {
    logger.warn(
      `[SyncEngine] Cleaning up ${orphaned.length} orphaned messages with empty conversation_id`,
    );
    for (const msg of orphaned) {
      markMessagePermanentlyFailed(
        msg.id,
        "Message has no conversation ID — cannot sync",
      );
    }
  }
}

/**
 * Sync all pending messages to server
 */
export async function syncPendingMessages(): Promise<void> {
  if (syncState.isSyncing || !syncState.isOnline) {
    return;
  }

  updateSyncState({ isSyncing: true, error: null });

  // Clean up orphaned messages before processing
  cleanupOrphanedMessages();

  try {
    const pendingMessages = getPendingMessages(20);
    updateSyncState({ pendingCount: pendingMessages.length });

    if (pendingMessages.length === 0) {
      updateSyncState({
        isSyncing: false,
        lastSyncAt: Date.now(),
      });
      return;
    }

    logger.info(
      `[SyncEngine] Syncing ${pendingMessages.length} pending messages`,
    );

    for (const message of pendingMessages) {
      try {
        await syncSingleMessage(message);
      } catch (error) {
        // Continue with other messages even if one fails
        logger.error(
          `[SyncEngine] Failed to sync message ${message.id}:`,
          error,
        );
      }
    }

    // Refresh pending count after sync
    refreshPendingCount();

    updateSyncState({
      isSyncing: false,
      lastSyncAt: Date.now(),
    });
  } catch (error: any) {
    logger.error("[SyncEngine] Sync failed:", error);
    updateSyncState({
      isSyncing: false,
      error: error.message || "Sync failed",
    });
  }
}

/**
 * Sync a single message to server
 */
async function syncSingleMessage(
  message: MessageWithAttachments,
): Promise<void> {
  const functions = getFunctionsInstance();
  const sendMessageV2 = httpsCallable<SendMessagePayload, SendMessageResponse>(
    functions,
    "sendMessageV2",
  );

  try {
    // Upload attachments first if any need uploading
    let uploadedAttachments: AttachmentV2[] = [];

    if (message.attachments.length > 0) {
      // Filter attachments that need upload
      const attachmentsNeedingUpload = message.attachments.filter(
        (a) => a.upload_status !== "uploaded",
      );

      if (attachmentsNeedingUpload.length > 0) {
        // Convert to LocalAttachment format for upload
        // Skip remote URLs (http/https) — they aren't local files and would
        // crash compressImage. This can happen if stale data was inserted by
        // an earlier code path that didn't distinguish remote vs local.
        const localAttachments: LocalAttachment[] = attachmentsNeedingUpload
          .filter((a) => a.local_uri && !a.local_uri.startsWith("http"))
          .map((a) => ({
            id: a.id,
            uri: a.local_uri!,
            kind: a.kind as "image" | "video" | "audio" | "file",
            mime: a.mime,
            sizeBytes: a.size_bytes || undefined,
            width: a.width || undefined,
            height: a.height || undefined,
            caption: a.caption || undefined,
            viewOnce: a.view_once === 1,
          }));

        if (localAttachments.length > 0) {
          // Guard: conversation_id must be set for storage paths
          if (!message.conversation_id) {
            logger.error(
              "[SyncEngine] Cannot upload attachments: conversation_id is empty for message",
              message.id,
            );
            throw new Error(
              "Cannot upload attachments without a conversation ID",
            );
          }

          // Determine storage path based on scope and attachment type
          // Voice messages go to /voice/ (groups) or /dm-voice/ (DMs)
          // Images go to /messages/ (groups) or /Pictures/ (DMs)
          const isVoice =
            message.kind === "voice" ||
            localAttachments.some((a) => a.kind === "audio");
          let basePath: string;
          if (message.scope === "dm") {
            basePath = isVoice
              ? `dm-voice/${message.conversation_id}`
              : `snaps/${message.conversation_id}`;
          } else {
            basePath = isVoice
              ? `groups/${message.conversation_id}/voice`
              : `groups/${message.conversation_id}/messages`;
          }

          logger.info(
            `[SyncEngine] Uploading ${localAttachments.length} attachments`,
          );

          const uploadResult = await uploadMultipleAttachments(
            localAttachments,
            basePath,
            (attachmentId, progress, status, error) => {
              // Update upload status in database
              if (status === "uploading") {
                updateAttachmentUploadStatus(attachmentId, "uploading");
              } else if (status === "error") {
                updateAttachmentUploadStatus(attachmentId, "failed");
              }
            },
          );

          uploadedAttachments = uploadResult.successful;

          // Update successfully uploaded attachments in database
          for (const att of uploadResult.successful) {
            updateAttachmentUploadStatus(att.id, "uploaded", att.url, att.path);
          }

          if (uploadResult.failed.length > 0) {
            logger.warn(
              "[SyncEngine] Some attachments failed to upload:",
              uploadResult.failed,
            );

            // If all attachments failed, don't send the message
            if (
              uploadResult.successful.length === 0 &&
              message.kind === "media"
            ) {
              throw new Error("All attachments failed to upload");
            }
          }
        }
      }

      // Add already-uploaded attachments to the list.
      // Also include attachments whose local_uri is a remote URL — they are
      // externally hosted (e.g. KLIPY GIFs) and don't need upload.
      const alreadyUploaded = message.attachments
        .filter(
          (a) =>
            (a.upload_status === "uploaded" && a.remote_url) ||
            a.local_uri?.startsWith("http"),
        )
        .map((a) => ({
          id: a.id,
          kind: a.kind as "image" | "video" | "audio" | "file",
          mime: a.mime,
          url: a.remote_url || a.local_uri!,
          path: a.remote_path || "",
          sizeBytes: a.size_bytes || 0,
          width: a.width || undefined,
          height: a.height || undefined,
          thumbUrl: a.thumb_remote_url || undefined,
          thumbPath: undefined,
          caption: a.caption || undefined,
          viewOnce: a.view_once === 1,
          durationMs: a.duration_ms || undefined,
        })) as AttachmentV2[];

      uploadedAttachments = [...uploadedAttachments, ...alreadyUploaded];
    }

    // Parse full replyTo metadata from the JSON stored in SQLite
    let replyToMeta: ReplyToMetadata | undefined;
    if (message.reply_to_preview) {
      try {
        replyToMeta = JSON.parse(message.reply_to_preview) as ReplyToMetadata;
      } catch {
        // Fallback: build a minimal object from just the ID
        if (message.reply_to_id) {
          replyToMeta = {
            messageId: message.reply_to_id,
            senderId: "",
            kind: "text" as any,
          };
        }
      }
    } else if (message.reply_to_id) {
      replyToMeta = {
        messageId: message.reply_to_id,
        senderId: "",
        kind: "text" as any,
      };
    }

    // Build payload for Cloud Function
    const payload: SendMessagePayload = {
      messageId: message.id,
      clientId: message.id, // Use message ID as clientId for idempotency
      scope: message.scope,
      conversationId: message.conversation_id,
      kind: message.kind,
      text: message.kind === "animal" ? undefined : message.text || undefined,
      // For animal messages, the animalId is stored in the text column
      animalId:
        message.kind === "animal" ? message.text || undefined : undefined,
      attachments:
        uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      replyToId: message.reply_to_id || undefined,
      replyTo: replyToMeta,
      threadRootId: message.thread_root_id || undefined,
      mentionUids: message.mentions_json
        ? JSON.parse(message.mentions_json)
        : undefined,
      createdAt: message.created_at,
    };

    // Guard: block send if animal message has no animalId
    if (message.kind === "animal" && !payload.animalId) {
      logger.error(
        "[SyncEngine] Animal message missing animalId, aborting send",
        message.id,
      );
      markMessagePermanentlyFailed(
        message.id,
        "Animal message missing animalId",
      );
      return;
    }

    // Debug logging for sync
    logger.info(`[SyncEngine] Attempting to sync message:`, {
      messageId: message.id.substring(0, 8),
      scope: message.scope,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      kind: message.kind,
      retryCount: message.retry_count,
    });

    // Send message via Cloud Function
    const result = await sendMessageV2(payload);
    const serverData = result.data;

    // Mark as synced in local database
    markMessageSynced(message.id, serverData.serverReceivedAt);

    // Notify active UI subscribers so they refresh immediately instead of
    // waiting for the Firestore onSnapshot round-trip.
    notifyConversationListeners(message.scope, message.conversation_id);

    logger.info(`[SendPipeline] Backend confirmed`, {
      messageId: message.id.substring(0, 8),
      scope: message.scope,
      conversationId: message.conversation_id.substring(0, 8),
      serverReceivedAt: serverData.serverReceivedAt,
    });
  } catch (error: any) {
    logger.error("[SendPipeline] Sync failed:", message.id, error);

    // Detect permanent errors that should NOT be retried
    const errorMessage = error.message || "Unknown error";
    const isPermanentError =
      errorMessage.includes("Not a member") ||
      errorMessage.includes("permission-denied") ||
      errorMessage.includes("PERMISSION_DENIED") ||
      errorMessage.includes("not-found") ||
      errorMessage.includes("NOT_FOUND") ||
      errorMessage.includes("unauthenticated") ||
      errorMessage.includes("UNAUTHENTICATED") ||
      errorMessage.includes("without a conversation ID") ||
      errorMessage.includes("Invalid message kind") ||
      errorMessage.includes("Animal messages must include");

    if (isPermanentError) {
      logger.warn(
        `[SyncEngine] Permanent error for message ${message.id}, will not retry:`,
        errorMessage,
      );
      markMessagePermanentlyFailed(message.id, errorMessage);
    } else {
      markMessageSyncFailed(message.id, errorMessage);
    }

    // Notify UI so the failed status is reflected immediately
    notifyConversationListeners(message.scope, message.conversation_id);

    throw error;
  }
}

// =============================================================================
// Download Messages (Pull Sync)
// =============================================================================

/**
 * Pull new messages from server for a conversation
 */
export async function pullMessages(
  scope: "dm" | "group",
  conversationId: string,
): Promise<number> {
  const db = getDatabase();
  const firestore = getFirestoreInstance();

  // Get last sync cursor
  const cursor = db.getFirstSync<{ last_synced_at: number | null }>(
    "SELECT last_synced_at FROM sync_cursors WHERE conversation_id = ?",
    [conversationId],
  );

  const lastSyncedAt = cursor?.last_synced_at || 0;

  // Build collection reference
  // Both DM and Group messages use uppercase 'Messages'
  const collectionPath =
    scope === "dm"
      ? `Chats/${conversationId}/Messages`
      : `Groups/${conversationId}/Messages`;

  // Query new messages since last sync
  // Both DM and Group messages use createdAt for ordering because
  // serverReceivedAt uses FieldValue.serverTimestamp() which can be null
  // on initial local snapshots.
  const orderField = "createdAt";
  const q = query(
    collection(firestore, collectionPath),
    where(orderField, ">", lastSyncedAt),
    orderBy(orderField, "asc"),
    limit(100),
  );

  try {
    const snapshot = await getDocs(q);
    let newCount = 0;
    let maxCursorTimestamp = lastSyncedAt;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // Convert Firestore timestamps to numbers upfront
      const createdAtNum = toTimestamp(data.createdAt) || Date.now();
      const serverReceivedAtNum =
        toTimestamp(data.serverReceivedAt) || createdAtNum;
      const editedAtNum = data.editedAt
        ? toTimestamp(data.editedAt)
        : undefined;

      const message: MessageV2 = {
        id: docSnap.id,
        scope,
        conversationId,
        senderId: data.senderId || "",
        senderName: data.senderName || null,
        kind: data.kind || "text",
        text: data.text || null,
        animalId: data.animalId || undefined,
        attachments: data.attachments || null,
        createdAt: createdAtNum,
        serverReceivedAt: serverReceivedAtNum,
        editedAt: editedAtNum,
        replyTo: data.replyTo || null,
        mentionUids: data.mentionUids || null,
        reactionsSummary: data.reactionsSummary || null,
        deletedForAll: data.deletedForAll || false,
        hiddenFor: data.hiddenFor || null,
        linkPreview: data.linkPreview || null,
        clientId: data.clientId || "",
        idempotencyKey: data.idempotencyKey || docSnap.id,
        senderStyle: data.senderStyle || undefined,
      };

      upsertMessageFromServer(message);
      newCount++;

      if (createdAtNum > maxCursorTimestamp) {
        maxCursorTimestamp = createdAtNum;
      }
    });

    // Update sync cursor
    if (maxCursorTimestamp > lastSyncedAt) {
      db.runSync(
        `INSERT OR REPLACE INTO sync_cursors (conversation_id, last_synced_at, last_sync_attempt)
         VALUES (?, ?, ?)`,
        [conversationId, maxCursorTimestamp, Date.now()],
      );
    }

    logger.info(
      `[SyncEngine] Pulled ${newCount} new messages for ${conversationId}`,
    );
    return newCount;
  } catch (error: any) {
    logger.error(`[SyncEngine] Pull failed for ${conversationId}:`, error);
    throw error;
  }
}

/**
 * Full sync for a conversation (used on first load)
 * Returns 0 when the active runtime does not support the local database.
 */
export async function fullSyncConversation(
  scope: "dm" | "group",
  conversationId: string,
  messageLimit: number = 50,
): Promise<number> {
  if (!isDatabaseRuntimeAvailable()) {
    logger.warn(
      "[SyncEngine] fullSyncConversation skipped:",
      getDatabaseUnavailableReason(),
    );
    return 0;
  }

  const db = getDatabase();
  const firestore = getFirestoreInstance();

  // Both DM and Group messages use uppercase 'Messages'
  const collectionPath =
    scope === "dm"
      ? `Chats/${conversationId}/Messages`
      : `Groups/${conversationId}/Messages`;

  // Get most recent messages
  // Use createdAt for both scopes to avoid serverTimestamp sentinel null issues
  const orderField = "createdAt";
  const q = query(
    collection(firestore, collectionPath),
    orderBy(orderField, "desc"),
    limit(messageLimit),
  );

  try {
    const snapshot = await getDocs(q);
    let count = 0;
    let maxTimestamp = 0;

    logger.info(
      "[SyncEngine] fullSyncConversation v2 running for:",
      conversationId,
    );

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // Convert Firestore timestamps to numbers upfront
      const createdAtNum = toTimestamp(data.createdAt) || Date.now();
      const serverReceivedAtNum =
        toTimestamp(data.serverReceivedAt) || createdAtNum;
      const editedAtNum = data.editedAt
        ? toTimestamp(data.editedAt)
        : undefined;

      // Debug: log first message conversion to verify timestamps
      if (count === 0) {
        logger.info("[SyncEngine] First message timestamp conversion:", {
          rawCreatedAt: data.createdAt,
          rawServerReceivedAt: data.serverReceivedAt,
          convertedCreatedAt: createdAtNum,
          convertedServerReceivedAt: serverReceivedAtNum,
        });
      }

      // Convert to MessageV2 - handle both legacy GroupMessage and V2 formats
      let message: MessageV2;

      // Build the message object with groupId added for legacy detection
      // Also normalize timestamps for the legacy check
      const msgWithId = {
        ...data,
        id: docSnap.id,
        groupId: conversationId,
        createdAt: createdAtNum,
      };

      if (scope === "group" && isLegacyGroupMessage(msgWithId)) {
        // Legacy GroupMessage format - use adapter
        // Note: fromGroupMessage expects createdAt as a number
        message = fromGroupMessage(msgWithId as GroupMessage);
        // Ensure serverReceivedAt is a number (adapter may not handle this)
        message.serverReceivedAt = serverReceivedAtNum;
      } else {
        // V2 format or DM format
        message = {
          id: docSnap.id,
          scope,
          conversationId,
          senderId: data.senderId || data.sender || "",
          senderName: data.senderName || data.senderDisplayName || null,
          kind: data.kind || data.type || "text",
          text: data.text || data.content || null,
          animalId: data.animalId || undefined,
          attachments: data.attachments || null,
          createdAt: createdAtNum,
          serverReceivedAt: serverReceivedAtNum,
          editedAt: editedAtNum,
          replyTo: data.replyTo || null,
          mentionUids: data.mentionUids || null,
          reactionsSummary: data.reactionsSummary || null,
          deletedForAll: data.deletedForAll || false,
          hiddenFor: data.hiddenFor || null,
          linkPreview: data.linkPreview || null,
          clientId: data.clientId || "",
          idempotencyKey: data.idempotencyKey || docSnap.id,
          senderStyle: data.senderStyle || undefined,
        };
      }

      upsertMessageFromServer(message);
      count++;

      // Keep the sync cursor aligned with the field used for sync queries.
      const timestamp = createdAtNum;
      if (timestamp > maxTimestamp) {
        maxTimestamp = timestamp;
      }
    });

    // Update sync cursor
    if (maxTimestamp > 0) {
      db.runSync(
        `INSERT OR REPLACE INTO sync_cursors (conversation_id, last_synced_at, last_sync_attempt)
         VALUES (?, ?, ?)`,
        [conversationId, maxTimestamp, Date.now()],
      );
    }

    logger.info(
      `[SyncEngine] Full sync pulled ${count} messages for ${conversationId}`,
    );
    return count;
  } catch (error: any) {
    logger.error(`[SyncEngine] Full sync failed for ${conversationId}:`, error);
    throw error;
  }
}

/**
 * Sync older messages from Firestore into SQLite.
 *
 * Fetches messages older than `beforeTimestamp` and upserts them locally.
 * Used by useLocalMessages.loadMore when the SQLite cache is exhausted.
 *
 * @returns The number of messages synced
 */
export async function syncOlderMessages(
  scope: "dm" | "group",
  conversationId: string,
  beforeTimestamp: number,
  messageLimit: number = 50,
): Promise<number> {
  if (!isDatabaseRuntimeAvailable()) {
    return 0;
  }

  const firestore = getFirestoreInstance();
  const collectionPath =
    scope === "dm"
      ? `Chats/${conversationId}/Messages`
      : `Groups/${conversationId}/Messages`;

  const q = query(
    collection(firestore, collectionPath),
    orderBy("createdAt", "desc"),
    where("createdAt", "<", beforeTimestamp),
    limit(messageLimit),
  );

  try {
    const snapshot = await getDocs(q);
    let count = 0;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const createdAtNum = toTimestamp(data.createdAt) || Date.now();
      const serverReceivedAtNum =
        toTimestamp(data.serverReceivedAt) || createdAtNum;
      const editedAtNum = data.editedAt
        ? toTimestamp(data.editedAt)
        : undefined;

      const msgWithId = {
        ...data,
        id: docSnap.id,
        groupId: conversationId,
        createdAt: createdAtNum,
      };

      let message: MessageV2;
      if (scope === "group" && isLegacyGroupMessage(msgWithId)) {
        message = fromGroupMessage(msgWithId as GroupMessage);
        message.serverReceivedAt = serverReceivedAtNum;
      } else {
        message = {
          id: docSnap.id,
          scope,
          conversationId,
          senderId: data.senderId || data.sender || "",
          senderName: data.senderName || data.senderDisplayName || null,
          kind: data.kind || data.type || "text",
          text: data.text || data.content || null,
          animalId: data.animalId || undefined,
          attachments: data.attachments || null,
          createdAt: createdAtNum,
          serverReceivedAt: serverReceivedAtNum,
          editedAt: editedAtNum,
          replyTo: data.replyTo || null,
          mentionUids: data.mentionUids || null,
          reactionsSummary: data.reactionsSummary || null,
          deletedForAll: data.deletedForAll || false,
          hiddenFor: data.hiddenFor || null,
          linkPreview: data.linkPreview || null,
          clientId: data.clientId || "",
          idempotencyKey: data.idempotencyKey || docSnap.id,
          senderStyle: data.senderStyle || undefined,
        };
      }

      upsertMessageFromServer(message);
      count++;
    });

    if (count > 0) {
      notifyConversationListeners(scope, conversationId);
    }

    logger.info(
      `[SyncEngine] syncOlderMessages pulled ${count} messages for ${conversationId}`,
    );
    return count;
  } catch (error: any) {
    logger.error(
      `[SyncEngine] syncOlderMessages failed for ${conversationId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Load messages around a target message ID.
 *
 * 1. Fetches the target message by ID to get its timestamp.
 * 2. Loads a window of messages around that timestamp.
 * 3. Upserts them into SQLite so the local cache includes the target.
 *
 * Used for jump-to-message when the target is not in the local cache.
 *
 * @returns true if the target message was found and synced
 */
export async function syncMessagesAroundTarget(
  scope: "dm" | "group",
  conversationId: string,
  targetMessageId: string,
  windowSize: number = 25,
): Promise<boolean> {
  if (!isDatabaseRuntimeAvailable()) {
    return false;
  }

  const firestore = getFirestoreInstance();
  const collectionPath =
    scope === "dm"
      ? `Chats/${conversationId}/Messages`
      : `Groups/${conversationId}/Messages`;

  // Step 1: Fetch the target message by ID
  const targetRef = doc(firestore, collectionPath, targetMessageId);
  const targetSnap = await getDoc(targetRef);

  if (!targetSnap.exists()) {
    logger.warn(
      `[SyncEngine] Target message ${targetMessageId} not found in Firestore`,
    );
    return false;
  }

  const targetData = targetSnap.data();
  const targetCreatedAt = toTimestamp(targetData.createdAt) || Date.now();

  // Upsert the target message itself
  const targetServerReceivedAt =
    toTimestamp(targetData.serverReceivedAt) || targetCreatedAt;
  const targetEditedAt = targetData.editedAt
    ? toTimestamp(targetData.editedAt)
    : undefined;

  const targetMsgWithId = {
    ...targetData,
    id: targetSnap.id,
    groupId: conversationId,
    createdAt: targetCreatedAt,
  };

  let targetMessage: MessageV2;
  if (scope === "group" && isLegacyGroupMessage(targetMsgWithId)) {
    targetMessage = fromGroupMessage(targetMsgWithId as GroupMessage);
    targetMessage.serverReceivedAt = targetServerReceivedAt;
  } else {
    targetMessage = {
      id: targetSnap.id,
      scope,
      conversationId,
      senderId: targetData.senderId || targetData.sender || "",
      senderName: targetData.senderName || targetData.senderDisplayName || null,
      kind: targetData.kind || targetData.type || "text",
      text: targetData.text || targetData.content || null,
      animalId: targetData.animalId || undefined,
      attachments: targetData.attachments || null,
      createdAt: targetCreatedAt,
      serverReceivedAt: targetServerReceivedAt,
      editedAt: targetEditedAt,
      replyTo: targetData.replyTo || null,
      mentionUids: targetData.mentionUids || null,
      reactionsSummary: targetData.reactionsSummary || null,
      deletedForAll: targetData.deletedForAll || false,
      hiddenFor: targetData.hiddenFor || null,
      linkPreview: targetData.linkPreview || null,
      clientId: targetData.clientId || "",
      idempotencyKey: targetData.idempotencyKey || targetSnap.id,
      senderStyle: targetData.senderStyle || undefined,
    };
  }

  upsertMessageFromServer(targetMessage);

  // Step 2: Load older messages (before the target)
  const olderQuery = query(
    collection(firestore, collectionPath),
    orderBy("createdAt", "desc"),
    where("createdAt", "<", targetCreatedAt),
    limit(windowSize),
  );

  // Step 3: Load newer messages (after the target)
  const newerQuery = query(
    collection(firestore, collectionPath),
    orderBy("createdAt", "asc"),
    where("createdAt", ">", targetCreatedAt),
    limit(windowSize),
  );

  const [olderSnap, newerSnap] = await Promise.all([
    getDocs(olderQuery),
    getDocs(newerQuery),
  ]);

  let count = 1; // target message already upserted

  const processSnapshot = (snap: typeof olderSnap) => {
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const createdAtNum = toTimestamp(data.createdAt) || Date.now();
      const serverReceivedAtNum =
        toTimestamp(data.serverReceivedAt) || createdAtNum;
      const editedAtNum = data.editedAt
        ? toTimestamp(data.editedAt)
        : undefined;

      const msgWithId = {
        ...data,
        id: docSnap.id,
        groupId: conversationId,
        createdAt: createdAtNum,
      };

      let message: MessageV2;
      if (scope === "group" && isLegacyGroupMessage(msgWithId)) {
        message = fromGroupMessage(msgWithId as GroupMessage);
        message.serverReceivedAt = serverReceivedAtNum;
      } else {
        message = {
          id: docSnap.id,
          scope,
          conversationId,
          senderId: data.senderId || data.sender || "",
          senderName: data.senderName || data.senderDisplayName || null,
          kind: data.kind || data.type || "text",
          text: data.text || data.content || null,
          animalId: data.animalId || undefined,
          attachments: data.attachments || null,
          createdAt: createdAtNum,
          serverReceivedAt: serverReceivedAtNum,
          editedAt: editedAtNum,
          replyTo: data.replyTo || null,
          mentionUids: data.mentionUids || null,
          reactionsSummary: data.reactionsSummary || null,
          deletedForAll: data.deletedForAll || false,
          hiddenFor: data.hiddenFor || null,
          linkPreview: data.linkPreview || null,
          clientId: data.clientId || "",
          idempotencyKey: data.idempotencyKey || docSnap.id,
          senderStyle: data.senderStyle || undefined,
        };
      }

      upsertMessageFromServer(message);
      count++;
    });
  };

  processSnapshot(olderSnap);
  processSnapshot(newerSnap);

  notifyConversationListeners(scope, conversationId);

  logger.info(
    `[SyncEngine] syncMessagesAroundTarget synced ${count} messages around ${targetMessageId}`,
  );
  return true;
}

// =============================================================================
// Real-time Subscription
// =============================================================================

/**
 * Subscribe to real-time message updates for a conversation
 * Returns a no-op unsubscribe function when the local database is unavailable.
 */
export function subscribeToConversation(
  scope: "dm" | "group",
  conversationId: string,
  onNewMessage?: (message: MessageV2) => void,
): () => void {
  if (!isDatabaseRuntimeAvailable()) {
    logger.warn(
      "[SyncEngine] subscribeToConversation skipped:",
      getDatabaseUnavailableReason(),
    );
    return () => {};
  }

  const db = getDatabase();
  const subscriptionKey = getSubscriptionKey(scope, conversationId);
  const listener = onNewMessage || (() => {});

  // Reuse existing Firestore listener for this conversation and only add
  // another callback subscriber.
  const existing = activeSubscriptions.get(subscriptionKey);
  if (existing) {
    existing.listeners.add(listener);
    return () => {
      const current = activeSubscriptions.get(subscriptionKey);
      if (!current) return;
      current.listeners.delete(listener);
      if (current.listeners.size === 0) {
        current.unsubscribe();
        activeSubscriptions.delete(subscriptionKey);
      }
    };
  }

  const firestore = getFirestoreInstance();

  // Get last synced timestamp
  const cursor = db.getFirstSync<{ last_synced_at: number | null }>(
    "SELECT last_synced_at FROM sync_cursors WHERE conversation_id = ?",
    [conversationId],
  );

  const lastSyncedAt = cursor?.last_synced_at || 0;

  // Both DM and Group messages use uppercase 'Messages'
  const collectionPath =
    scope === "dm"
      ? `Chats/${conversationId}/Messages`
      : `Groups/${conversationId}/Messages`;

  // Keep real-time cursoring on the same field used by full sync / pagination.
  const orderField = "createdAt";

  const q = query(
    collection(firestore, collectionPath),
    where(orderField, ">", lastSyncedAt),
    orderBy(orderField, "asc"),
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const data = change.doc.data();

          // Convert Firestore timestamps to numbers upfront
          const createdAtNum = toTimestamp(data.createdAt) || Date.now();
          const serverReceivedAtNum =
            toTimestamp(data.serverReceivedAt) || createdAtNum;
          const editedAtNum = data.editedAt
            ? toTimestamp(data.editedAt)
            : undefined;

          let message: MessageV2;

          // Build the message object with groupId added for legacy detection
          // Also normalize timestamps for the legacy check
          const msgWithId = {
            ...data,
            id: change.doc.id,
            groupId: conversationId,
            createdAt: createdAtNum,
          };

          // Check if this is a legacy GroupMessage format
          if (scope === "group" && isLegacyGroupMessage(msgWithId)) {
            message = fromGroupMessage(msgWithId as GroupMessage);
            // Ensure serverReceivedAt is a number (adapter may not handle this)
            message.serverReceivedAt = serverReceivedAtNum;
          } else {
            // V2 format - provide fallbacks for any undefined values
            message = {
              id: change.doc.id,
              scope,
              conversationId,
              senderId: data.senderId || data.sender || "",
              senderName: data.senderName || data.senderDisplayName || null,
              kind: data.kind || data.type || "text",
              text: data.text || data.content || null,
              animalId: data.animalId || undefined,
              attachments: data.attachments || null,
              createdAt: createdAtNum,
              serverReceivedAt: serverReceivedAtNum,
              editedAt: editedAtNum,
              replyTo: data.replyTo || null,
              mentionUids: data.mentionUids || null,
              reactionsSummary: data.reactionsSummary || null,
              deletedForAll: data.deletedForAll || false,
              hiddenFor: data.hiddenFor || null,
              linkPreview: data.linkPreview || null,
              clientId: data.clientId || "",
              idempotencyKey: data.idempotencyKey || change.doc.id,
              senderStyle: data.senderStyle || undefined,
            };
          }

          upsertMessageFromServer(message);
          const current = activeSubscriptions.get(subscriptionKey);
          if (current) {
            current.listeners.forEach((callback) => {
              try {
                callback(message);
              } catch (listenerError) {
                logger.error(
                  "[SyncEngine] Subscription listener callback error:",
                  listenerError,
                );
              }
            });
          }

          // Update sync cursor using the same field this subscription orders by.
          const timestamp = createdAtNum;
          if (timestamp) {
            db.runSync(
              `INSERT OR REPLACE INTO sync_cursors (conversation_id, last_synced_at, last_sync_attempt)
               VALUES (?, ?, ?)`,
              [conversationId, timestamp, Date.now()],
            );
          }
        }
      });
    },
    (error) => {
      logger.error("[SyncEngine] Subscription error:", error);
    },
  );

  activeSubscriptions.set(subscriptionKey, {
    scope,
    conversationId,
    listeners: new Set([listener]),
    unsubscribe,
  });

  return () => {
    const current = activeSubscriptions.get(subscriptionKey);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      current.unsubscribe();
      activeSubscriptions.delete(subscriptionKey);
    }
  };
}

/**
 * Check if a conversation has an active subscription
 */
export function hasActiveSubscription(conversationId: string): boolean {
  for (const sub of activeSubscriptions.values()) {
    if (sub.conversationId === conversationId) {
      return true;
    }
  }
  return false;
}

/**
 * Unsubscribe from a specific conversation
 */
export function unsubscribeFromConversation(conversationId: string): void {
  for (const [key, sub] of activeSubscriptions.entries()) {
    if (sub.conversationId === conversationId) {
      sub.unsubscribe();
      activeSubscriptions.delete(key);
    }
  }
}

/**
 * Unsubscribe from all active subscriptions
 */
export function unsubscribeAll(): void {
  activeSubscriptions.forEach((sub) => sub.unsubscribe());
  activeSubscriptions.clear();
}

/**
 * Get count of active subscriptions
 */
export function getActiveSubscriptionCount(): number {
  return activeSubscriptions.size;
}

// =============================================================================
// Background Sync
// =============================================================================

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start background sync worker
 */
export function startBackgroundSync(intervalMs: number = 30000): void {
  if (syncIntervalId) {
    logger.info("[SyncEngine] Background sync already running");
    return;
  }

  logger.info(
    `[SyncEngine] Starting background sync (interval: ${intervalMs}ms)`,
  );

  syncIntervalId = setInterval(() => {
    if (syncState.isOnline && !syncState.isSyncing) {
      syncPendingMessages();
    }
  }, intervalMs);

  // Initial sync
  if (syncState.isOnline) {
    syncPendingMessages();
  }
}

/**
 * Stop background sync worker
 */
export function stopBackgroundSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    logger.info("[SyncEngine] Background sync stopped");
  }
}

/**
 * Check if background sync is running
 */
export function isBackgroundSyncRunning(): boolean {
  return syncIntervalId !== null;
}

// =============================================================================
// Sync Utilities
// =============================================================================

/**
 * Force retry a failed message
 */
export async function retryMessage(messageId: string): Promise<void> {
  const db = getDatabase();

  // Reset retry count and status
  db.runSync(
    `UPDATE messages SET 
      sync_status = 'pending',
      sync_error = NULL,
      retry_count = 0
    WHERE id = ?`,
    [messageId],
  );

  // Trigger sync
  await syncPendingMessages();
}

/**
 * Cancel a pending message (mark as failed permanently)
 */
export function cancelMessage(messageId: string): void {
  const db = getDatabase();

  db.runSync(
    `UPDATE messages SET 
      sync_status = 'failed',
      sync_error = 'Cancelled by user',
      retry_count = 999
    WHERE id = ? AND sync_status = 'pending'`,
    [messageId],
  );

  refreshPendingCount();
}

/**
 * Get sync cursor for a conversation
 */
export function getSyncCursor(conversationId: string): number | null {
  const db = getDatabase();
  const cursor = db.getFirstSync<{ last_synced_at: number | null }>(
    "SELECT last_synced_at FROM sync_cursors WHERE conversation_id = ?",
    [conversationId],
  );
  return cursor?.last_synced_at || null;
}

/**
 * Reset sync cursor for a conversation (forces full re-sync)
 */
export function resetSyncCursor(conversationId: string): void {
  const db = getDatabase();
  db.runSync("DELETE FROM sync_cursors WHERE conversation_id = ?", [
    conversationId,
  ]);
}

/**
 * Get all conversations with pending messages
 */
export function getConversationsWithPending(): string[] {
  const db = getDatabase();
  const results = db.getAllSync<{ conversation_id: string }>(
    `SELECT DISTINCT conversation_id FROM messages 
     WHERE sync_status IN ('pending', 'failed') AND retry_count < ${MAX_MESSAGE_RETRIES}`,
  );
  return results.map((r: { conversation_id: string }) => r.conversation_id);
}
