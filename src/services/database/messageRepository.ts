/**
 * Message Repository
 *
 * CRUD operations for messages in SQLite.
 * All operations are synchronous for immediate UI updates.
 *
 * @file src/services/database/messageRepository.ts
 */

import { normalizeMessageFromLocalRow } from "@/services/chat/normalizeMessage";
import { AttachmentRow, MessageRow, parseJsonColumn } from "@/types/database";
import {
  AttachmentV2,
  LocalAttachment,
  MessageV2,
  ReplyToMetadata,
} from "@/types/messaging";
import * as Crypto from "expo-crypto";
import { getDatabase } from "./index";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/database/messageRepository");

/** Max retry attempts before a message is considered permanently failed */
export const MAX_MESSAGE_RETRIES = 10;

// =============================================================================
// FTS5 Helpers
// =============================================================================

/**
 * Sync a message into the FTS5 index.
 * Uses INSERT OR REPLACE semantics via FTS5 delete + insert.
 * Should only be called within an existing transaction or after a write.
 */
function syncFtsIndex(
  db: ReturnType<typeof getDatabase>,
  messageId: string,
  text: string | null,
  senderName: string | null,
): void {
  if (!text) return;
  try {
    // Get the rowid of the message (FTS5 content sync uses rowid)
    const row = db.getFirstSync<{ rowid: number }>(
      "SELECT rowid FROM messages WHERE id = ?",
      [messageId],
    );
    if (!row) return;

    // Delete old entry (if any), then insert new
    db.runSync(
      "INSERT INTO messages_fts(messages_fts, rowid, text, sender_name) VALUES('delete', ?, ?, ?)",
      [row.rowid, text, senderName || ""],
    );
    db.runSync(
      "INSERT INTO messages_fts(rowid, text, sender_name) VALUES(?, ?, ?)",
      [row.rowid, text, senderName || ""],
    );
  } catch (e) {
    // FTS sync is non-critical; log but don't throw
    logger.warn("[MessageRepository] FTS sync failed:", e);
  }
}

// =============================================================================
// Types
// =============================================================================

export interface InsertMessageParams {
  conversationId: string;
  scope: "dm" | "group";
  senderId: string;
  senderName?: string;
  kind: MessageRow["kind"];
  text?: string;
  replyTo?: ReplyToMetadata;
  /** Thread root message ID (for threaded replies) */
  threadRootId?: string;
  mentions?: string[];
  attachments?: AttachmentV2[];
  /** Local attachments pending upload */
  localAttachments?: LocalAttachment[];
  /** If true, mark as 'synced' immediately (for local-only test messages) */
  skipSync?: boolean;
}

export interface MessageWithAttachments extends MessageRow {
  attachments: AttachmentRow[];
}

export interface MessageWindowResult {
  messages: MessageWithAttachments[];
  olderCount: number;
  newerCount: number;
  hasOlder: boolean;
  hasNewer: boolean;
}

// =============================================================================
// Insert Operations
// =============================================================================

/**
 * Insert a new message (optimistic, pending sync)
 */
export function insertMessage(params: InsertMessageParams): MessageRow {
  const db = getDatabase();
  const now = Date.now();
  const messageId = Crypto.randomUUID();

  const row: MessageRow = {
    id: messageId,
    conversation_id: params.conversationId,
    scope: params.scope,
    sender_id: params.senderId,
    sender_name: params.senderName || null,
    kind: params.kind,
    text: params.text || null,
    created_at: now,
    server_received_at: params.skipSync ? now : null,
    edited_at: null,
    reply_to_id: params.replyTo?.messageId || null,
    reply_to_preview: params.replyTo ? JSON.stringify(params.replyTo) : null,
    thread_root_id: params.threadRootId || null,
    reply_count: 0,
    last_reply_at: null,
    mentions_json: params.mentions ? JSON.stringify(params.mentions) : null,
    reactions_json: null,
    deleted_for_all: 0,
    deleted_by: null,
    deleted_at: null,
    hidden_for_json: null,
    link_preview_json: null,
    sender_style_json: null,
    sync_status: params.skipSync ? "synced" : "pending",
    sync_error: null,
    retry_count: 0,
  };

  // Wrap message + attachments + conversation update in a transaction
  // to prevent partial writes on crash/interruption.
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO messages (
        id, conversation_id, scope, sender_id, sender_name, kind, text,
        created_at, server_received_at, edited_at, reply_to_id, reply_to_preview,
        thread_root_id, reply_count, last_reply_at,
        mentions_json, reactions_json, deleted_for_all, deleted_by, deleted_at,
        hidden_for_json, link_preview_json, sender_style_json,
        sync_status, sync_error, retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.conversation_id,
        row.scope,
        row.sender_id,
        row.sender_name,
        row.kind,
        row.text,
        row.created_at,
        row.server_received_at,
        row.edited_at,
        row.reply_to_id,
        row.reply_to_preview,
        row.thread_root_id,
        row.reply_count,
        row.last_reply_at,
        row.mentions_json,
        row.reactions_json,
        row.deleted_for_all,
        row.deleted_by,
        row.deleted_at,
        row.hidden_for_json,
        row.link_preview_json,
        row.sender_style_json,
        row.sync_status,
        row.sync_error,
        row.retry_count,
      ],
    );

    // Sync to FTS5 index for full-text search
    syncFtsIndex(db, row.id, row.text, row.sender_name);

    // Insert attachments if present (already uploaded)
    if (params.attachments && params.attachments.length > 0) {
      for (const att of params.attachments) {
        insertAttachment(messageId, att);
      }
    }

    // Insert local attachments pending upload
    if (params.localAttachments && params.localAttachments.length > 0) {
      for (const att of params.localAttachments) {
        insertLocalAttachment(messageId, att);
      }
    }

    // Update conversation last message
    updateConversationLastMessage(
      params.conversationId,
      params.scope,
      messageId,
      params.text || "",
      now,
    );

    // Optimistically increment reply_count on the thread root message
    if (params.threadRootId) {
      db.runSync(
        `UPDATE messages SET reply_count = reply_count + 1, last_reply_at = ? WHERE id = ?`,
        [now, params.threadRootId],
      );
    }
  });

  return row;
}

/**
 * Insert or update a message from server sync
 */
export function upsertMessageFromServer(message: MessageV2): void {
  try {
    const db = getDatabase();

    const existing = db.getFirstSync<{ id: string; sync_status: string }>(
      "SELECT id, sync_status FROM messages WHERE id = ?",
      [message.id],
    );

    // Normalize deletedForAll: accept both boolean and object shapes
    const deletedForAll =
      typeof message.deletedForAll === "object" && message.deletedForAll
        ? message.deletedForAll
        : message.deletedForAll
          ? { by: "unknown", at: Date.now() }
          : null;

    if (existing) {
      // Update existing - server wins for ALL content fields
      // This ensures edits, mention changes, and deletion metadata
      // are reflected locally after sync.
      //
      // REPLY PROTECTION: If the server message has no replyTo but the
      // local row already does (because we set it before sync), keep the
      // local reply data.  This prevents the server-wins strategy from
      // wiping reply metadata that the sync engine failed to send as a
      // full object.
      let replyToId: string | null = message.replyTo?.messageId || null;
      let replyToPreview: string | null = message.replyTo
        ? JSON.stringify(message.replyTo)
        : null;

      if (!replyToId) {
        // Server lacks reply data – check if local row already has it
        const localRow = db.getFirstSync<{
          reply_to_id: string | null;
          reply_to_preview: string | null;
        }>("SELECT reply_to_id, reply_to_preview FROM messages WHERE id = ?", [
          message.id,
        ]);
        if (localRow?.reply_to_id) {
          replyToId = localRow.reply_to_id;
          replyToPreview = localRow.reply_to_preview;
        }
      }

      db.runSync(
        `UPDATE messages SET
          server_received_at = ?,
          text = ?,
          kind = ?,
          sender_name = ?,
          edited_at = ?,
          mentions_json = ?,
          reply_to_id = ?,
          reply_to_preview = ?,
          thread_root_id = COALESCE(?, thread_root_id),
          reply_count = MAX(reply_count, ?),
          last_reply_at = MAX(COALESCE(last_reply_at, 0), COALESCE(?, 0)),
          reactions_json = ?,
          hidden_for_json = ?,
          link_preview_json = ?,
          sender_style_json = ?,
          deleted_for_all = ?,
          deleted_by = ?,
          deleted_at = ?,
          sync_status = 'synced',
          sync_error = NULL
        WHERE id = ?`,
        [
          message.serverReceivedAt,
          // For animal messages, store animalId in text column
          message.kind === "animal"
            ? message.animalId || message.text || null
            : (message.text ?? null),
          message.kind || "text",
          message.senderName || null,
          message.editedAt || null,
          message.mentionUids ? JSON.stringify(message.mentionUids) : null,
          replyToId,
          replyToPreview,
          message.threadRootId || null,
          message.replyCount ?? 0,
          message.lastReplyAt || null,
          message.reactionsSummary
            ? JSON.stringify(message.reactionsSummary)
            : null,
          message.hiddenFor ? JSON.stringify(message.hiddenFor) : null,
          message.linkPreview ? JSON.stringify(message.linkPreview) : null,
          message.senderStyle ? JSON.stringify(message.senderStyle) : null,
          deletedForAll ? 1 : 0,
          deletedForAll?.by || null,
          deletedForAll?.at || null,
          message.id,
        ],
      );

      // Sync FTS index after update
      const updatedText =
        message.kind === "animal"
          ? message.animalId || message.text || null
          : (message.text ?? null);
      if (!deletedForAll) {
        syncFtsIndex(db, message.id, updatedText, message.senderName || null);
      }
    } else {
      // Insert new from server
      // Ensure required fields have valid values (prevent undefined causing SQLite errors)
      const id = message.id || "";
      const conversationId = message.conversationId || "";
      const scope = message.scope || "group";
      const senderId = message.senderId || "";
      const kind = message.kind || "text";
      const createdAt = message.createdAt || Date.now();
      const serverReceivedAt = message.serverReceivedAt || createdAt;

      if (!id) {
        logger.warn("[MessageRepository] Skipping message with empty id");
        return;
      }

      db.runSync(
        `INSERT INTO messages (
          id, conversation_id, scope, sender_id, sender_name, kind, text,
          created_at, server_received_at, edited_at, reply_to_id, reply_to_preview,
          thread_root_id, reply_count, last_reply_at,
          mentions_json, reactions_json, deleted_for_all, deleted_by, deleted_at,
          hidden_for_json, link_preview_json, sender_style_json,
          sync_status, sync_error, retry_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL, 0)`,
        [
          id,
          conversationId,
          scope,
          senderId,
          message.senderName || null,
          kind,
          // For animal messages, store animalId in text column
          kind === "animal"
            ? message.animalId || message.text || null
            : message.text || null,
          createdAt,
          serverReceivedAt,
          message.editedAt || null,
          message.replyTo?.messageId || null,
          message.replyTo ? JSON.stringify(message.replyTo) : null,
          message.threadRootId || null,
          message.replyCount ?? 0,
          message.lastReplyAt || null,
          message.mentionUids ? JSON.stringify(message.mentionUids) : null,
          message.reactionsSummary
            ? JSON.stringify(message.reactionsSummary)
            : null,
          deletedForAll ? 1 : 0,
          deletedForAll?.by || null,
          deletedForAll?.at || null,
          message.hiddenFor ? JSON.stringify(message.hiddenFor) : null,
          message.linkPreview ? JSON.stringify(message.linkPreview) : null,
          message.senderStyle ? JSON.stringify(message.senderStyle) : null,
        ],
      );

      // Sync FTS index after insert
      const insertedText =
        kind === "animal"
          ? message.animalId || message.text || null
          : message.text || null;
      if (!deletedForAll) {
        syncFtsIndex(db, id, insertedText, message.senderName || null);
      }

      // Insert attachments
      if (message.attachments) {
        for (const att of message.attachments) {
          upsertAttachmentFromServer(message.id, att);
        }
      }
    }
  } catch (error: any) {
    logger.error("[MessageRepository] Error upserting message:", error.message);
    logger.error(
      "[MessageRepository] Message data:",
      JSON.stringify(
        {
          id: message.id,
          scope: message.scope,
          conversationId: message.conversationId,
          senderId: message.senderId,
          kind: message.kind,
          createdAt: message.createdAt,
          serverReceivedAt: message.serverReceivedAt,
        },
        null,
        2,
      ),
    );
    throw error;
  }
}

// =============================================================================
// Query Operations
// =============================================================================

/**
 * Get all replies in a thread (messages whose thread_root_id matches the given rootMessageId).
 * Returns them in chronological order (oldest first) so the UI can render top-to-bottom.
 */
export function getThreadMessages(
  rootMessageId: string,
  limit: number = 200,
): MessageWithAttachments[] {
  const db = getDatabase();
  const messages = db.getAllSync<MessageRow>(
    `SELECT * FROM messages
     WHERE thread_root_id = ? AND deleted_for_all = 0
     ORDER BY created_at ASC
     LIMIT ?`,
    [rootMessageId, limit],
  );
  return attachBatchAttachments(messages);
}

/**
 * Get messages for a specific conversation (simpler API for useLocalMessages)
 */
export function getMessagesForConversation(
  conversationId: string,
  scope: "dm" | "group",
  limit: number = 50,
): MessageWithAttachments[] {
  return getMessages(conversationId, { limit, scope });
}

/**
 * Get messages by sync status (for queue management)
 */
export function getMessagesByStatus(
  status: "pending" | "syncing" | "synced" | "failed",
  limit: number = 100,
): MessageWithAttachments[] {
  const db = getDatabase();
  const messages = db.getAllSync<MessageRow>(
    `SELECT * FROM messages 
     WHERE sync_status = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [status, limit],
  );

  return messages.map((msg) => ({
    ...msg,
    attachments: getAttachmentsForMessage(msg.id),
  }));
}

/**
 * Get messages for a conversation with pagination
 */
export function getMessages(
  conversationId: string,
  options: {
    limit?: number;
    beforeTimestamp?: number;
    afterTimestamp?: number;
    includeDeleted?: boolean;
    scope?: "dm" | "group";
  } = {},
): MessageWithAttachments[] {
  const db = getDatabase();
  const {
    limit = 50,
    beforeTimestamp,
    afterTimestamp,
    includeDeleted = false,
    scope,
  } = options;

  let whereClause = "conversation_id = ?";
  const params: (string | number)[] = [conversationId];

  if (scope) {
    whereClause += " AND scope = ?";
    params.push(scope);
  }

  if (!includeDeleted) {
    whereClause += " AND deleted_for_all = 0";
  }

  if (beforeTimestamp) {
    whereClause += " AND created_at < ?";
    params.push(beforeTimestamp);
  }

  if (afterTimestamp) {
    whereClause += " AND created_at > ?";
    params.push(afterTimestamp);
  }

  params.push(limit);

  const messages = db.getAllSync<MessageRow>(
    `SELECT * FROM messages 
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT ?`,
    params,
  );

  // Batch-load attachments for all messages (avoids N+1)
  return attachBatchAttachments(messages);
}

/**
 * Get a bounded message window around a target message without loading the
 * entire conversation into memory.
 */
export function getMessageWindowAroundMessage(
  conversationId: string,
  scope: "dm" | "group",
  messageId: string,
  olderLimit: number = 50,
  newerLimit: number = 50,
): MessageWindowResult | null {
  const db = getDatabase();
  const target = db.getFirstSync<MessageRow>(
    `SELECT * FROM messages
     WHERE id = ? AND conversation_id = ? AND scope = ?
     LIMIT 1`,
    [messageId, conversationId, scope],
  );

  if (!target) {
    return null;
  }

  const newerRowsRaw = db.getAllSync<MessageRow>(
    `SELECT * FROM messages
     WHERE conversation_id = ? AND scope = ? AND deleted_for_all = 0
     AND created_at > ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [conversationId, scope, target.created_at, newerLimit + 1],
  );
  const olderRowsRaw = db.getAllSync<MessageRow>(
    `SELECT * FROM messages
     WHERE conversation_id = ? AND scope = ? AND deleted_for_all = 0
     AND created_at < ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [conversationId, scope, target.created_at, olderLimit + 1],
  );

  const hasNewer = newerRowsRaw.length > newerLimit;
  const hasOlder = olderRowsRaw.length > olderLimit;
  const newerRows = newerRowsRaw.slice(0, newerLimit);
  const olderRows = olderRowsRaw.slice(0, olderLimit);

  return {
    messages: attachBatchAttachments([...newerRows, target, ...olderRows]),
    newerCount: newerRows.length,
    olderCount: olderRows.length,
    hasNewer,
    hasOlder,
  };
}

/**
 * Get a single message by ID
 */
export function getMessageById(
  messageId: string,
): MessageWithAttachments | null {
  const db = getDatabase();
  const message = db.getFirstSync<MessageRow>(
    "SELECT * FROM messages WHERE id = ?",
    [messageId],
  );

  if (!message) return null;

  return {
    ...message,
    attachments: getAttachmentsForMessage(messageId),
  };
}

/**
 * Get pending messages that need sync
 */
export function getPendingMessages(
  limit: number = 50,
): MessageWithAttachments[] {
  const db = getDatabase();
  const messages = db.getAllSync<MessageRow>(
    `SELECT * FROM messages 
     WHERE sync_status IN ('pending', 'failed')
     AND retry_count < ${MAX_MESSAGE_RETRIES}
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit],
  );

  return attachBatchAttachments(messages);
}

/**
 * Get count of messages in a conversation
 */
export function getMessageCount(conversationId: string): number {
  const db = getDatabase();
  const result = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND deleted_for_all = 0",
    [conversationId],
  );
  return result?.count ?? 0;
}

// =============================================================================
// Update Operations
// =============================================================================

/**
 * Mark message as synced
 */
export function markMessageSynced(
  messageId: string,
  serverReceivedAt: number,
): void {
  const db = getDatabase();
  db.runSync(
    `UPDATE messages SET 
      sync_status = 'synced', 
      server_received_at = ?,
      sync_error = NULL,
      retry_count = 0
    WHERE id = ?`,
    [serverReceivedAt, messageId],
  );
}

/**
 * Mark message sync failed (will retry)
 */
export function markMessageSyncFailed(messageId: string, error: string): void {
  const db = getDatabase();
  db.runSync(
    `UPDATE messages SET 
      sync_status = 'failed', 
      sync_error = ?,
      retry_count = retry_count + 1
    WHERE id = ?`,
    [error, messageId],
  );
}

/**
 * Mark message as permanently failed (will NOT retry)
 * Use for permission errors, not-found, etc.
 */
export function markMessagePermanentlyFailed(
  messageId: string,
  error: string,
): void {
  const db = getDatabase();
  db.runSync(
    `UPDATE messages SET 
      sync_status = 'failed', 
      sync_error = ?,
      retry_count = 999
    WHERE id = ?`,
    [error, messageId],
  );
}

/**
 * Update message text (local edit)
 */
export function updateMessageText(messageId: string, text: string): void {
  const db = getDatabase();
  db.runSync(
    `UPDATE messages SET 
      text = ?, 
      edited_at = ?,
      sync_status = CASE WHEN sync_status = 'synced' THEN 'pending' ELSE sync_status END
    WHERE id = ?`,
    [text, Date.now(), messageId],
  );
}

/**
 * Soft delete message (for all)
 */
export function deleteMessageForAll(
  messageId: string,
  deletedBy: string,
): void {
  const db = getDatabase();
  db.runSync(
    `UPDATE messages SET 
      deleted_for_all = 1, 
      deleted_by = ?,
      deleted_at = ?,
      sync_status = CASE WHEN sync_status = 'synced' THEN 'pending' ELSE sync_status END
    WHERE id = ?`,
    [deletedBy, Date.now(), messageId],
  );
}

/**
 * Hide message for current user (delete for me)
 */
export function hideMessageForUser(messageId: string, userId: string): void {
  const db = getDatabase();
  const message = db.getFirstSync<{ hidden_for_json: string | null }>(
    "SELECT hidden_for_json FROM messages WHERE id = ?",
    [messageId],
  );

  const hiddenFor = parseJsonColumn<string[]>(
    message?.hidden_for_json || null,
    [],
  );
  if (!hiddenFor.includes(userId)) {
    hiddenFor.push(userId);
  }

  db.runSync("UPDATE messages SET hidden_for_json = ? WHERE id = ?", [
    JSON.stringify(hiddenFor),
    messageId,
  ]);
}

/**
 * Update reactions summary
 */
export function updateMessageReactions(
  messageId: string,
  reactions: Record<string, number>,
): void {
  const db = getDatabase();
  db.runSync("UPDATE messages SET reactions_json = ? WHERE id = ?", [
    JSON.stringify(reactions),
    messageId,
  ]);
}

/**
 * Update link preview
 */
export function updateMessageLinkPreview(
  messageId: string,
  linkPreview: object,
): void {
  const db = getDatabase();
  db.runSync("UPDATE messages SET link_preview_json = ? WHERE id = ?", [
    JSON.stringify(linkPreview),
    messageId,
  ]);
}

// =============================================================================
// Attachment Operations
// =============================================================================

/**
 * Insert an attachment with remote URL (from server sync or already uploaded)
 */
function insertAttachment(messageId: string, att: AttachmentV2): void {
  const db = getDatabase();
  db.runSync(
    `INSERT INTO attachments (
      id, message_id, kind, mime, local_uri, remote_url, remote_path,
      thumb_local_uri, thumb_remote_url, size_bytes, width, height,
      duration_ms, caption, view_once, expires_at, download_status, upload_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      att.id,
      messageId,
      att.kind,
      att.mime,
      null, // local_uri - to be set after download
      att.url || null,
      att.path || null,
      null, // thumb_local_uri
      att.thumbUrl || null,
      att.sizeBytes || null,
      att.width || null,
      att.height || null,
      att.durationMs || null,
      att.caption || null,
      att.viewOnce ? 1 : 0,
      att.expiresAt || null,
      att.url ? "none" : "downloaded", // If no remote URL, assume local
      att.url ? "uploaded" : "pending",
    ],
  );
}

/**
 * Insert a local attachment pending upload (for optimistic UI)
 */
function insertLocalAttachment(messageId: string, att: LocalAttachment): void {
  const db = getDatabase();
  db.runSync(
    `INSERT INTO attachments (
      id, message_id, kind, mime, local_uri, remote_url, remote_path,
      thumb_local_uri, thumb_remote_url, size_bytes, width, height,
      duration_ms, caption, view_once, expires_at, download_status, upload_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      att.id,
      messageId,
      att.kind,
      att.mime,
      att.uri, // local_uri - the file to upload
      null, // remote_url - not uploaded yet
      null, // remote_path - not uploaded yet
      null, // thumb_local_uri
      null, // thumb_remote_url
      null, // size_bytes - unknown until upload
      null, // width
      null, // height
      att.durationMs || null,
      att.caption || null,
      0, // view_once
      null, // expires_at
      "downloaded", // download_status - we have the local file
      "pending", // upload_status - needs to be uploaded
    ],
  );
}

function upsertAttachmentFromServer(
  messageId: string,
  att: AttachmentV2,
): void {
  const db = getDatabase();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM attachments WHERE id = ?",
    [att.id],
  );

  if (existing) {
    db.runSync(
      `UPDATE attachments SET
        remote_url = ?,
        remote_path = ?,
        thumb_remote_url = ?,
        upload_status = 'uploaded'
      WHERE id = ?`,
      [att.url, att.path, att.thumbUrl || null, att.id],
    );
  } else {
    insertAttachment(messageId, att);
  }
}

function getAttachmentsForMessage(messageId: string): AttachmentRow[] {
  const db = getDatabase();
  return db.getAllSync<AttachmentRow>(
    "SELECT * FROM attachments WHERE message_id = ?",
    [messageId],
  );
}

/**
 * Batch-load attachments for multiple messages.
 * Returns a Map keyed by message_id for O(1) lookup.
 * Eliminates N+1 query pattern in getMessages/getMessagesByStatus.
 */
function getAttachmentsForMessages(
  messageIds: string[],
): Map<string, AttachmentRow[]> {
  const result = new Map<string, AttachmentRow[]>();
  if (messageIds.length === 0) return result;

  // Initialize empty arrays for all IDs
  for (const id of messageIds) {
    result.set(id, []);
  }

  const db = getDatabase();
  // SQLite placeholder limit is ~999; chunk if needed
  const CHUNK_SIZE = 500;
  for (let i = 0; i < messageIds.length; i += CHUNK_SIZE) {
    const chunk = messageIds.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = db.getAllSync<AttachmentRow>(
      `SELECT * FROM attachments WHERE message_id IN (${placeholders})`,
      chunk,
    );
    for (const row of rows) {
      const arr = result.get(row.message_id);
      if (arr) {
        arr.push(row);
      } else {
        result.set(row.message_id, [row]);
      }
    }
  }
  return result;
}

/**
 * Attach attachments to messages using batch loading.
 * Replaces the per-message getAttachmentsForMessage pattern.
 */
function attachBatchAttachments(
  messages: MessageRow[],
): MessageWithAttachments[] {
  const attachmentMap = getAttachmentsForMessages(messages.map((m) => m.id));
  return messages.map((msg) => ({
    ...msg,
    attachments: attachmentMap.get(msg.id) || [],
  }));
}

/**
 * Update attachment local URI after download
 */
export function updateAttachmentLocalUri(
  attachmentId: string,
  localUri: string,
  thumbLocalUri?: string,
): void {
  const db = getDatabase();
  db.runSync(
    `UPDATE attachments SET 
      local_uri = ?,
      thumb_local_uri = ?,
      download_status = 'downloaded'
    WHERE id = ?`,
    [localUri, thumbLocalUri || null, attachmentId],
  );
}

/**
 * Update attachment upload status
 */
export function updateAttachmentUploadStatus(
  attachmentId: string,
  status: AttachmentRow["upload_status"],
  remoteUrl?: string,
  remotePath?: string,
): void {
  const db = getDatabase();
  db.runSync(
    `UPDATE attachments SET 
      upload_status = ?,
      remote_url = COALESCE(?, remote_url),
      remote_path = COALESCE(?, remote_path)
    WHERE id = ?`,
    [status, remoteUrl || null, remotePath || null, attachmentId],
  );
}

/**
 * Update attachment download status
 */
export function updateAttachmentDownloadStatus(
  attachmentId: string,
  status: AttachmentRow["download_status"],
): void {
  const db = getDatabase();
  db.runSync("UPDATE attachments SET download_status = ? WHERE id = ?", [
    status,
    attachmentId,
  ]);
}

/**
 * Get attachment by ID
 */
export function getAttachmentById(attachmentId: string): AttachmentRow | null {
  const db = getDatabase();
  return db.getFirstSync<AttachmentRow>(
    "SELECT * FROM attachments WHERE id = ?",
    [attachmentId],
  );
}

/**
 * Get attachments pending upload
 */
export function getPendingUploads(): AttachmentRow[] {
  const db = getDatabase();
  return db.getAllSync<AttachmentRow>(
    "SELECT * FROM attachments WHERE upload_status IN ('pending', 'failed') ORDER BY message_id",
  );
}

/**
 * Get attachments pending download
 */
export function getPendingDownloads(): AttachmentRow[] {
  const db = getDatabase();
  return db.getAllSync<AttachmentRow>(
    "SELECT * FROM attachments WHERE download_status = 'none' AND remote_url IS NOT NULL ORDER BY message_id",
  );
}

// =============================================================================
// Conversation Helpers
// =============================================================================

function updateConversationLastMessage(
  conversationId: string,
  scope: "dm" | "group",
  messageId: string,
  text: string,
  timestamp: number,
): void {
  const db = getDatabase();

  // Ensure conversation exists
  db.runSync(
    `INSERT OR IGNORE INTO conversations (id, scope, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    [conversationId, scope, timestamp, timestamp],
  );

  db.runSync(
    `UPDATE conversations SET 
      last_message_id = ?,
      last_message_text = ?,
      last_message_at = ?,
      updated_at = ?
    WHERE id = ?`,
    [messageId, text, timestamp, timestamp, conversationId],
  );
}

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Convert database row to MessageV2 for UI
 */
export function rowToMessageV2(
  row: MessageWithAttachments,
  currentUserId: string,
): MessageV2 | null {
  return normalizeMessageFromLocalRow(row, currentUserId);
}

/**
 * Convert MessageV2 to row for insertion (when migrating from Firestore)
 */
export function messageV2ToRow(
  message: MessageV2,
): Omit<MessageRow, "attachments"> {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    scope: message.scope,
    sender_id: message.senderId,
    sender_name: message.senderName || null,
    kind: message.kind,
    // For animal messages, store animalId in text column
    text:
      message.kind === "animal"
        ? message.animalId || message.text || null
        : message.text || null,
    created_at: message.createdAt,
    server_received_at: message.serverReceivedAt,
    edited_at: message.editedAt || null,
    reply_to_id: message.replyTo?.messageId || null,
    reply_to_preview: message.replyTo ? JSON.stringify(message.replyTo) : null,
    thread_root_id: message.threadRootId || null,
    reply_count: message.replyCount || 0,
    last_reply_at: message.lastReplyAt || null,
    mentions_json: message.mentionUids
      ? JSON.stringify(message.mentionUids)
      : null,
    reactions_json: message.reactionsSummary
      ? JSON.stringify(message.reactionsSummary)
      : null,
    deleted_for_all: message.deletedForAll ? 1 : 0,
    deleted_by: message.deletedForAll?.by || null,
    deleted_at: message.deletedForAll?.at || null,
    hidden_for_json: message.hiddenFor
      ? JSON.stringify(message.hiddenFor)
      : null,
    link_preview_json: message.linkPreview
      ? JSON.stringify(message.linkPreview)
      : null,
    sender_style_json: message.senderStyle
      ? JSON.stringify(message.senderStyle)
      : null,
    sync_status: "synced",
    sync_error: null,
    retry_count: 0,
  };
}
