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
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { getDatabase } from "@/services/database";
import {
  getPendingMessages,
  markMessagePermanentlyFailed,
  markMessageSynced,
  markMessageSyncFailed,
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
import { AttachmentV2, MessageV2 } from "@/types/messaging";
import { toTimestamp } from "@/utils/dates";
import { Platform } from "react-native";

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
  attachments?: AttachmentV2[];
  replyToId?: string;
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
const activeSubscriptions = new Map<string, Unsubscribe>();

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
  const pending = getPendingMessages(1);
  updateSyncState({ pendingCount: pending.length > 0 ? -1 : 0 }); // -1 indicates "some pending"

  // Get actual count
  const db = getDatabase();
  const result = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM messages WHERE sync_status IN ('pending', 'failed') AND retry_count < 10`,
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
    console.warn(
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

    console.log(
      `[SyncEngine] Syncing ${pendingMessages.length} pending messages`,
    );

    for (const message of pendingMessages) {
      try {
        await syncSingleMessage(message);
      } catch (error) {
        // Continue with other messages even if one fails
        console.error(
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
    console.error("[SyncEngine] Sync failed:", error);
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
        const localAttachments: LocalAttachment[] = attachmentsNeedingUpload
          .filter((a) => a.local_uri) // Must have local file
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
            console.error(
              "[SyncEngine] Cannot upload attachments: conversation_id is empty for message",
              message.id,
            );
            throw new Error(
              "Cannot upload attachments without a conversation ID",
            );
          }

          // Determine storage path based on scope and attachment type
          // Voice messages go to /voice/ (groups) or /dm-voice/ (DMs)
          // Images go to /messages/ (groups) or /snaps/ (DMs)
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

          console.log(
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
            console.warn(
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

      // Add already-uploaded attachments to the list
      const alreadyUploaded = message.attachments
        .filter((a) => a.upload_status === "uploaded" && a.remote_url)
        .map((a) => ({
          id: a.id,
          kind: a.kind as "image" | "video" | "audio" | "file",
          mime: a.mime,
          url: a.remote_url!,
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

    // Build payload for Cloud Function
    const payload: SendMessagePayload = {
      messageId: message.id,
      clientId: message.id, // Use message ID as clientId for idempotency
      scope: message.scope,
      conversationId: message.conversation_id,
      kind: message.kind,
      text: message.text || undefined,
      attachments:
        uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      replyToId: message.reply_to_id || undefined,
      mentionUids: message.mentions_json
        ? JSON.parse(message.mentions_json)
        : undefined,
      createdAt: message.created_at,
    };

    // Debug logging for sync
    console.log(`[SyncEngine] Attempting to sync message:`, {
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

    console.log(`[SyncEngine] Message synced: ${message.id}`);
  } catch (error: any) {
    console.error("[SyncEngine] Failed to sync message:", message.id, error);

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
      errorMessage.includes("without a conversation ID");

    if (isPermanentError) {
      console.warn(
        `[SyncEngine] Permanent error for message ${message.id}, will not retry:`,
        errorMessage,
      );
      markMessagePermanentlyFailed(message.id, errorMessage);
    } else {
      markMessageSyncFailed(message.id, errorMessage);
    }

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
  const q = query(
    collection(firestore, collectionPath),
    where("serverReceivedAt", ">", lastSyncedAt),
    orderBy("serverReceivedAt", "asc"),
    limit(100),
  );

  try {
    const snapshot = await getDocs(q);
    let newCount = 0;
    let maxServerReceivedAt = lastSyncedAt;

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
      };

      upsertMessageFromServer(message);
      newCount++;

      if (serverReceivedAtNum > maxServerReceivedAt) {
        maxServerReceivedAt = serverReceivedAtNum;
      }
    });

    // Update sync cursor
    if (maxServerReceivedAt > lastSyncedAt) {
      db.runSync(
        `INSERT OR REPLACE INTO sync_cursors (conversation_id, last_synced_at, last_sync_attempt)
         VALUES (?, ?, ?)`,
        [conversationId, maxServerReceivedAt, Date.now()],
      );
    }

    console.log(
      `[SyncEngine] Pulled ${newCount} new messages for ${conversationId}`,
    );
    return newCount;
  } catch (error: any) {
    console.error(`[SyncEngine] Pull failed for ${conversationId}:`, error);
    throw error;
  }
}

/**
 * Full sync for a conversation (used on first load)
 * NOTE: This function requires SQLite and should not be called on web.
 * Returns 0 if SQLite is not available.
 */
export async function fullSyncConversation(
  scope: "dm" | "group",
  conversationId: string,
  messageLimit: number = 50,
): Promise<number> {
  // SQLite is not available on web
  if (Platform.OS === "web") {
    console.warn(
      "[SyncEngine] fullSyncConversation called on web - SQLite not available",
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
  // Note: Group messages may use 'createdAt' instead of 'serverReceivedAt'
  const orderField = scope === "dm" ? "serverReceivedAt" : "createdAt";
  const q = query(
    collection(firestore, collectionPath),
    orderBy(orderField, "desc"),
    limit(messageLimit),
  );

  try {
    const snapshot = await getDocs(q);
    let count = 0;
    let maxTimestamp = 0;

    console.log(
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
        console.log("[SyncEngine] First message timestamp conversion:", {
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
        message = fromGroupMessage(msgWithId as any);
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
        };
      }

      upsertMessageFromServer(message);
      count++;

      // Use the converted numeric timestamp for cursor
      const timestamp = serverReceivedAtNum || createdAtNum;
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

    console.log(
      `[SyncEngine] Full sync pulled ${count} messages for ${conversationId}`,
    );
    return count;
  } catch (error: any) {
    console.error(
      `[SyncEngine] Full sync failed for ${conversationId}:`,
      error,
    );
    throw error;
  }
}

// =============================================================================
// Real-time Subscription
// =============================================================================

/**
 * Subscribe to real-time message updates for a conversation
 * NOTE: This function requires SQLite and should not be called on web.
 * Returns a no-op unsubscribe function if SQLite is not available.
 */
export function subscribeToConversation(
  scope: "dm" | "group",
  conversationId: string,
  onNewMessage?: (message: MessageV2) => void,
): () => void {
  // SQLite is not available on web
  if (Platform.OS === "web") {
    console.warn(
      "[SyncEngine] subscribeToConversation called on web - SQLite not available",
    );
    return () => {}; // Return no-op unsubscribe
  }

  const db = getDatabase();

  // Unsubscribe from existing if any
  const existingUnsub = activeSubscriptions.get(conversationId);
  if (existingUnsub) {
    existingUnsub();
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

  // Use createdAt for groups (legacy format), serverReceivedAt for DMs
  const orderField = scope === "dm" ? "serverReceivedAt" : "createdAt";

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
            message = fromGroupMessage(msgWithId as any);
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
            };
          }

          upsertMessageFromServer(message);
          onNewMessage?.(message);

          // Update sync cursor using the converted numeric timestamp
          const timestamp = serverReceivedAtNum || createdAtNum;
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
      console.error("[SyncEngine] Subscription error:", error);
    },
  );

  activeSubscriptions.set(conversationId, unsubscribe);

  return () => {
    unsubscribe();
    activeSubscriptions.delete(conversationId);
  };
}

/**
 * Check if a conversation has an active subscription
 */
export function hasActiveSubscription(conversationId: string): boolean {
  return activeSubscriptions.has(conversationId);
}

/**
 * Unsubscribe from a specific conversation
 */
export function unsubscribeFromConversation(conversationId: string): void {
  const unsub = activeSubscriptions.get(conversationId);
  if (unsub) {
    unsub();
    activeSubscriptions.delete(conversationId);
  }
}

/**
 * Unsubscribe from all active subscriptions
 */
export function unsubscribeAll(): void {
  activeSubscriptions.forEach((unsub) => unsub());
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
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start background sync worker
 */
export function startBackgroundSync(intervalMs: number = 30000): void {
  if (syncIntervalId) {
    console.log("[SyncEngine] Background sync already running");
    return;
  }

  console.log(
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
    console.log("[SyncEngine] Background sync stopped");
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
     WHERE sync_status IN ('pending', 'failed') AND retry_count < 10`,
  );
  return results.map((r: { conversation_id: string }) => r.conversation_id);
}
