/**
 * Outbox Service
 *
 * Persistent offline message queue using AsyncStorage.
 * Ensures messages are not lost on network failures or app restarts.
 *
 * @deprecated This module is being replaced by SQLite-based storage.
 * For new code, use:
 * - `@/services/database/messageRepository` for message queue storage
 * - `@/services/sync/syncEngine` for syncing pending messages
 *
 * The SQLite-based approach provides:
 * - Faster message storage (synchronous writes)
 * - Better query capabilities
 * - Unified storage for all message data
 *
 * Features:
 * - Persistent storage of pending messages
 * - Automatic retry with exponential backoff
 * - Non-retryable error detection (blocked, permission denied)
 * - Client ID generation for idempotency
 *
 * @module services/outbox
 */

import {
  LocalAttachment,
  MessageKind,
  OutboxItem,
  ReplyToMetadata,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";
import AsyncStorage from "@react-native-async-storage/async-storage";

const log = createLogger("outbox");

// =============================================================================
// Constants
// =============================================================================

/** AsyncStorage key for outbox */
const OUTBOX_KEY = "@snapstyle/message_outbox_v2";

/** AsyncStorage key for client ID */
const CLIENT_ID_KEY = "@snapstyle/client_device_id";

/** Max retry attempts before giving up */
const MAX_RETRY_ATTEMPTS = 10;

/** Max backoff delay in milliseconds (5 minutes) */
const MAX_BACKOFF_MS = 5 * 60 * 1000;

/** Non-retryable error codes */
const NON_RETRYABLE_ERRORS = [
  "permission-denied",
  "unauthenticated",
  "not-found",
  "already-exists",
  "invalid-argument",
];

// =============================================================================
// Client ID Management
// =============================================================================

let cachedClientId: string | null = null;

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a stable client device ID
 */
export async function getClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;

  try {
    let clientId = await AsyncStorage.getItem(CLIENT_ID_KEY);

    if (!clientId) {
      clientId = generateUUID();
      await AsyncStorage.setItem(CLIENT_ID_KEY, clientId);
      log.info("Generated new client ID");
    }

    cachedClientId = clientId;
    return clientId;
  } catch (error) {
    log.error("Failed to get/create client ID", error);
    const fallbackId = generateUUID();
    cachedClientId = fallbackId;
    return fallbackId;
  }
}

/**
 * Generate a new message ID (UUID v4)
 */
export function generateMessageId(): string {
  return generateUUID();
}

// =============================================================================
// Outbox Storage Operations
// =============================================================================

/**
 * Get all items in the outbox
 */
export async function getOutbox(): Promise<OutboxItem[]> {
  try {
    const data = await AsyncStorage.getItem(OUTBOX_KEY);
    if (!data) return [];
    return JSON.parse(data) as OutboxItem[];
  } catch (error) {
    log.error("Failed to read outbox", error);
    return [];
  }
}

/**
 * Save outbox to storage
 */
async function saveOutbox(outbox: OutboxItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch (error) {
    log.error("Failed to save outbox", error);
    throw error;
  }
}

/**
 * Add a message to the outbox
 *
 * IMPORTANT: For retrying failed messages, use retryItem() instead.
 * This function always creates a new message ID.
 *
 * @throws If a pending/failed message with identical content exists (prevents duplicates)
 */
export async function enqueueMessage(params: {
  scope: "dm" | "group";
  conversationId: string;
  kind: MessageKind;
  text?: string;
  replyTo?: ReplyToMetadata;
  mentionUids?: string[];
  localAttachments?: LocalAttachment[];
}): Promise<OutboxItem> {
  const outbox = await getOutbox();

  // BUG FIX: Check for duplicate pending messages to prevent accidental re-sends
  // This catches cases where user might call sendMessageWithOutbox again instead of retryFailedMessage
  const duplicatePending = outbox.find(
    (item) =>
      item.conversationId === params.conversationId &&
      item.text === params.text &&
      item.kind === params.kind &&
      (item.state === "queued" ||
        item.state === "sending" ||
        item.state === "failed"),
  );

  if (duplicatePending) {
    log.warn("Duplicate message detected, returning existing outbox item", {
      operation: "enqueue",
      data: {
        existingId: duplicatePending.messageId.substring(0, 8) + "...",
        state: duplicatePending.state,
      },
    });
    // Return existing item instead of creating duplicate
    return duplicatePending;
  }

  const newItem: OutboxItem = {
    messageId: generateMessageId(),
    scope: params.scope,
    conversationId: params.conversationId,
    kind: params.kind,
    text: params.text,
    replyTo: params.replyTo,
    mentionUids: params.mentionUids,
    localAttachments: params.localAttachments,
    createdAt: Date.now(),
    attemptCount: 0,
    nextRetryAt: Date.now(),
    state: "queued",
  };

  outbox.push(newItem);
  await saveOutbox(outbox);

  log.info("Enqueued message", {
    operation: "enqueue",
    data: { scope: params.scope, kind: params.kind },
  });

  return newItem;
}

/**
 * Update an existing outbox item
 */
export async function updateOutboxItem(
  messageId: string,
  updates: Partial<OutboxItem>,
): Promise<void> {
  const outbox = await getOutbox();
  const index = outbox.findIndex((i) => i.messageId === messageId);

  if (index >= 0) {
    outbox[index] = { ...outbox[index], ...updates };
    await saveOutbox(outbox);
    log.debug("Updated outbox item", { operation: "update" });
  } else {
    log.warn("Outbox item not found for update");
  }
}

/**
 * Remove an item from the outbox
 */
export async function removeFromOutbox(messageId: string): Promise<void> {
  const outbox = await getOutbox();
  const filtered = outbox.filter((i) => i.messageId !== messageId);
  await saveOutbox(filtered);
  log.info("Removed from outbox", { operation: "remove" });
}

/**
 * Get a single outbox item by message ID
 */
export async function getOutboxItem(
  messageId: string,
): Promise<OutboxItem | null> {
  const outbox = await getOutbox();
  return outbox.find((i) => i.messageId === messageId) || null;
}

/**
 * Get items for a specific conversation
 */
export async function getOutboxForConversation(
  conversationId: string,
): Promise<OutboxItem[]> {
  const outbox = await getOutbox();
  return outbox.filter((i) => i.conversationId === conversationId);
}

// =============================================================================
// Outbox Querying
// =============================================================================

/**
 * Get pending items ready for processing
 */
export async function getPendingItems(): Promise<OutboxItem[]> {
  const outbox = await getOutbox();
  const now = Date.now();

  return outbox.filter((item) => {
    if (item.state === "queued") return true;
    if (item.state === "failed") {
      return item.nextRetryAt <= now && item.attemptCount < MAX_RETRY_ATTEMPTS;
    }
    return false;
  });
}

/**
 * Get all failed items
 */
export async function getFailedItems(): Promise<OutboxItem[]> {
  const outbox = await getOutbox();
  return outbox.filter((item) => item.state === "failed");
}

/**
 * Get items that are currently sending
 */
export async function getSendingItems(): Promise<OutboxItem[]> {
  const outbox = await getOutbox();
  return outbox.filter(
    (item) => item.state === "sending" || item.state === "uploading",
  );
}

// =============================================================================
// Outbox Processing
// =============================================================================

/**
 * Check if an error is non-retryable
 */
function isNonRetryableError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const errorObj = error as { code?: string; message?: string };

    if (errorObj.code && NON_RETRYABLE_ERRORS.includes(errorObj.code)) {
      return true;
    }

    if (errorObj.message) {
      const msg = errorObj.message.toLowerCase();
      if (
        msg.includes("blocked") ||
        msg.includes("permission denied") ||
        msg.includes("not a member") ||
        msg.includes("unauthenticated")
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attemptCount: number): number {
  const delay = Math.min(Math.pow(2, attemptCount) * 1000, MAX_BACKOFF_MS);
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Process the outbox - attempt to send all pending messages
 */
export async function processOutbox(
  sendFn: (item: OutboxItem) => Promise<boolean>,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const pendingItems = await getPendingItems();

  log.info("Processing outbox", {
    operation: "processOutbox",
    data: { count: pendingItems.length },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of pendingItems) {
    if (item.state === "sending" || item.state === "uploading") {
      skipped++;
      continue;
    }

    try {
      await updateOutboxItem(item.messageId, {
        state: "sending",
        attemptCount: item.attemptCount + 1,
      });

      const success = await sendFn(item);

      if (success) {
        await removeFromOutbox(item.messageId);
        sent++;
        log.info("Outbox item sent successfully", { operation: "send" });
      } else {
        throw new Error("Send function returned false");
      }
    } catch (error: unknown) {
      failed++;

      const isNonRetryable = isNonRetryableError(error);
      const backoffMs = isNonRetryable
        ? Infinity
        : calculateBackoff(item.attemptCount + 1);
      const nextRetryAt = isNonRetryable
        ? Date.now() + 365 * 24 * 60 * 60 * 1000
        : Date.now() + backoffMs;

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await updateOutboxItem(item.messageId, {
        state: "failed",
        lastError: errorMessage,
        nextRetryAt,
      });

      log.warn("Outbox item failed", { operation: "sendFailed" });
    }
  }

  log.info("Outbox processing complete", {
    operation: "processComplete",
    data: { sent, failed, skipped },
  });

  // Auto-cleanup: remove items older than 7 days and items that have
  // exceeded MAX_RETRY_ATTEMPTS to prevent unbounded AsyncStorage growth
  try {
    const staleRemoved = await removeStaleItems();
    const exhaustedRemoved = await removeExhaustedItems();
    if (staleRemoved > 0 || exhaustedRemoved > 0) {
      log.info("Outbox auto-cleanup completed", {
        operation: "autoCleanup",
        data: { staleRemoved, exhaustedRemoved },
      });
    }
  } catch (cleanupError) {
    log.warn("Outbox auto-cleanup failed", { operation: "autoCleanupFailed" });
  }

  return { sent, failed, skipped };
}

/**
 * Retry a specific failed item immediately
 */
export async function retryItem(
  messageId: string,
  sendFn: (item: OutboxItem) => Promise<boolean>,
): Promise<boolean> {
  const item = await getOutboxItem(messageId);

  if (!item) {
    log.warn("Item not found for retry");
    return false;
  }

  if (item.state === "sending" || item.state === "uploading") {
    log.warn("Item already being sent");
    return false;
  }

  try {
    await updateOutboxItem(messageId, {
      state: "sending",
      attemptCount: item.attemptCount + 1,
    });

    const success = await sendFn(item);

    if (success) {
      await removeFromOutbox(messageId);
      return true;
    }

    throw new Error("Send function returned false");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isNonRetryable = isNonRetryableError(error);

    await updateOutboxItem(messageId, {
      state: "failed",
      lastError: errorMessage,
      nextRetryAt: isNonRetryable
        ? Date.now() + 365 * 24 * 60 * 60 * 1000
        : Date.now() + calculateBackoff(item.attemptCount + 1),
    });

    return false;
  }
}

// =============================================================================
// Outbox Management
// =============================================================================

/**
 * Clear the entire outbox (for debugging/testing)
 */
export async function clearOutbox(): Promise<void> {
  await AsyncStorage.removeItem(OUTBOX_KEY);
  log.info("Outbox cleared");
}

/**
 * Get outbox statistics
 */
export async function getOutboxStats(): Promise<{
  total: number;
  queued: number;
  uploading: number;
  sending: number;
  failed: number;
  oldestPending: number | null;
}> {
  const outbox = await getOutbox();

  const stats = {
    total: outbox.length,
    queued: 0,
    uploading: 0,
    sending: 0,
    failed: 0,
    oldestPending: null as number | null,
  };

  for (const item of outbox) {
    switch (item.state) {
      case "queued":
        stats.queued++;
        break;
      case "uploading":
        stats.uploading++;
        break;
      case "sending":
        stats.sending++;
        break;
      case "failed":
        stats.failed++;
        break;
    }

    if (item.state === "queued" || item.state === "failed") {
      if (
        stats.oldestPending === null ||
        item.createdAt < stats.oldestPending
      ) {
        stats.oldestPending = item.createdAt;
      }
    }
  }

  return stats;
}

/**
 * Remove items that have exceeded MAX_RETRY_ATTEMPTS
 * These will never succeed and should not accumulate in storage
 */
export async function removeExhaustedItems(): Promise<number> {
  const outbox = await getOutbox();

  const filtered = outbox.filter((item) => {
    if (item.attemptCount <= MAX_RETRY_ATTEMPTS) return true;
    log.info("Removing exhausted outbox item", {
      operation: "removeExhausted",
      data: { messageId: item.messageId, attempts: item.attemptCount },
    });
    return false;
  });

  const removedCount = outbox.length - filtered.length;

  if (removedCount > 0) {
    await saveOutbox(filtered);
  }

  return removedCount;
}

/**
 * Remove stale items (older than maxAge)
 */
export async function removeStaleItems(
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000,
): Promise<number> {
  const outbox = await getOutbox();
  const cutoff = Date.now() - maxAgeMs;

  const filtered = outbox.filter((item) => {
    if (item.createdAt > cutoff) return true;
    log.info("Removing stale outbox item", { operation: "removeStale" });
    return false;
  });

  const removedCount = outbox.length - filtered.length;

  if (removedCount > 0) {
    await saveOutbox(filtered);
  }

  return removedCount;
}
