/**
 * Conversation Repository
 *
 * CRUD operations for conversations in SQLite.
 *
 * @file src/services/database/conversationRepository.ts
 */

import { ConversationRow } from "@/types/database";
import { getDatabase, getDatabaseOwnerUid } from "./index";

// =============================================================================
// Query Operations
// =============================================================================

/**
 * Get all conversations for inbox display
 */
export function getConversations(
  options: {
    includeArchived?: boolean;
    limit?: number;
  } = {},
): ConversationRow[] {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  const { includeArchived = false, limit = 100 } = options;

  let query = "SELECT * FROM conversations WHERE owner_uid = ?";
  const params: (number | string)[] = [ownerUid];

  if (!includeArchived) {
    query += " AND is_archived = 0";
  }

  query += " ORDER BY COALESCE(last_message_at, updated_at) DESC LIMIT ?";
  params.push(limit);

  return db.getAllSync<ConversationRow>(query, params);
}

/**
 * Get a single conversation by ID
 */
export function getConversationById(id: string): ConversationRow | null {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  return db.getFirstSync<ConversationRow>(
    "SELECT * FROM conversations WHERE id = ? AND owner_uid = ?",
    [id, ownerUid],
  );
}

/**
 * Get or create a DM conversation
 */
export function getOrCreateDMConversation(
  chatId: string,
  _otherUserId?: string,
): ConversationRow {
  const db = getDatabase();
  const existing = getConversationById(chatId);

  if (existing) {
    return existing;
  }

  const now = Date.now();
  db.runSync(
    `INSERT OR REPLACE INTO conversations (id, owner_uid, scope, name, created_at, updated_at)
     VALUES (?, ?, 'dm', NULL, ?, ?)`,
    [chatId, getDatabaseOwnerUid(), now, now],
  );

  return getConversationById(chatId)!;
}

/**
 * Get or create a group conversation
 */
export function getOrCreateGroupConversation(
  groupId: string,
  groupName: string,
): ConversationRow {
  const db = getDatabase();
  const existing = getConversationById(groupId);

  if (existing) {
    return existing;
  }

  const now = Date.now();
  db.runSync(
    `INSERT OR REPLACE INTO conversations (id, owner_uid, scope, name, created_at, updated_at)
     VALUES (?, ?, 'group', ?, ?, ?)`,
    [groupId, getDatabaseOwnerUid(), groupName, now, now],
  );

  return getConversationById(groupId)!;
}

/**
 * Check if conversation exists
 */
export function conversationExists(id: string): boolean {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  const result = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM conversations WHERE id = ? AND owner_uid = ?",
    [id, ownerUid],
  );
  return (result?.count ?? 0) > 0;
}

/**
 * Get conversations by scope
 */
export function getConversationsByScope(
  scope: "dm" | "group",
  options: {
    includeArchived?: boolean;
    limit?: number;
  } = {},
): ConversationRow[] {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  const { includeArchived = false, limit = 100 } = options;

  let whereClause = "owner_uid = ? AND scope = ?";
  const params: (string | number)[] = [ownerUid, scope];

  if (!includeArchived) {
    whereClause += " AND is_archived = 0";
  }

  params.push(limit);

  return db.getAllSync<ConversationRow>(
    `SELECT * FROM conversations 
     WHERE ${whereClause}
     ORDER BY COALESCE(last_message_at, updated_at) DESC 
     LIMIT ?`,
    params,
  );
}

/**
 * Search conversations by name
 */
export function searchConversations(
  searchTerm: string,
  limit: number = 20,
): ConversationRow[] {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  return db.getAllSync<ConversationRow>(
    `SELECT * FROM conversations 
     WHERE owner_uid = ? AND name LIKE ? AND is_archived = 0
     ORDER BY COALESCE(last_message_at, updated_at) DESC 
     LIMIT ?`,
    [ownerUid, `%${searchTerm}%`, limit],
  );
}

// =============================================================================
// Update Operations
// =============================================================================

/**
 * Update conversation metadata from server
 */
export function updateConversationFromServer(
  id: string,
  data: Partial<{
    name: string;
    is_archived: boolean;
    is_muted: boolean;
    muted_until: number | null;
    unread_count: number;
  }>,
): void {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  const updates: string[] = ["updated_at = ?"];
  const params: (string | number | null)[] = [Date.now()];

  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.is_archived !== undefined) {
    updates.push("is_archived = ?");
    params.push(data.is_archived ? 1 : 0);
  }
  if (data.is_muted !== undefined) {
    updates.push("is_muted = ?");
    params.push(data.is_muted ? 1 : 0);
  }
  if (data.muted_until !== undefined) {
    updates.push("muted_until = ?");
    params.push(data.muted_until);
  }
  if (data.unread_count !== undefined) {
    updates.push("unread_count = ?");
    params.push(data.unread_count);
  }

  params.push(id, ownerUid);

  db.runSync(
    `UPDATE conversations SET ${updates.join(", ")} WHERE id = ? AND owner_uid = ?`,
    params,
  );
}

/**
 * Update conversation name
 */
export function updateConversationName(id: string, name: string): void {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  db.runSync(
    "UPDATE conversations SET name = ?, updated_at = ? WHERE id = ? AND owner_uid = ?",
    [name, Date.now(), id, ownerUid],
  );
}

/**
 * Archive/unarchive conversation
 */
export function setConversationArchived(id: string, archived: boolean): void {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  db.runSync(
    "UPDATE conversations SET is_archived = ?, updated_at = ? WHERE id = ? AND owner_uid = ?",
    [archived ? 1 : 0, Date.now(), id, ownerUid],
  );
}

/**
 * Mute/unmute conversation
 */
export function setConversationMuted(
  id: string,
  muted: boolean,
  mutedUntil?: number | null,
): void {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  db.runSync(
    "UPDATE conversations SET is_muted = ?, muted_until = ?, updated_at = ? WHERE id = ? AND owner_uid = ?",
    [muted ? 1 : 0, mutedUntil ?? null, Date.now(), id, ownerUid],
  );
}

/**
 * Update unread count
 */
export function updateUnreadCount(id: string, count: number): void {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  db.runSync(
    "UPDATE conversations SET unread_count = ? WHERE id = ? AND owner_uid = ?",
    [count, id, ownerUid],
  );
}

/**
 * Mark conversation as read (set unread to 0)
 */
export function markConversationRead(id: string): void {
  updateUnreadCount(id, 0);
}

/**
 * Increment unread count
 */
export function incrementUnreadCount(id: string): void {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  db.runSync(
    "UPDATE conversations SET unread_count = unread_count + 1 WHERE id = ? AND owner_uid = ?",
    [id, ownerUid],
  );
}

/**
 * Update last message metadata
 */
export function updateLastMessage(
  id: string,
  messageId: string,
  text: string,
  timestamp: number,
): void {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  db.runSync(
    `UPDATE conversations SET 
      last_message_id = ?,
      last_message_text = ?,
      last_message_at = ?,
      updated_at = ?
    WHERE id = ? AND owner_uid = ?`,
    [messageId, text, timestamp, timestamp, id, ownerUid],
  );
}

/**
 * Update sync version (for conflict resolution)
 */
export function updateSyncVersion(id: string, version: number): void {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  db.runSync(
    "UPDATE conversations SET sync_version = ? WHERE id = ? AND owner_uid = ?",
    [version, id, ownerUid],
  );
}

// =============================================================================
// Delete Operations
// =============================================================================

/**
 * Delete conversation and all messages
 */
export function deleteConversation(id: string): void {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  // CASCADE will delete messages and attachments
  db.runSync("DELETE FROM conversations WHERE id = ? AND owner_uid = ?", [
    id,
    ownerUid,
  ]);
}

/**
 * Clear all messages in conversation but keep metadata
 */
export function clearConversationMessages(id: string): void {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  db.runSync("DELETE FROM messages WHERE conversation_id = ? AND owner_uid = ?", [
    id,
    ownerUid,
  ]);
  db.runSync(
    `UPDATE conversations SET 
      last_message_id = NULL,
      last_message_text = NULL,
      last_message_at = NULL,
      unread_count = 0
    WHERE id = ? AND owner_uid = ?`,
    [id, ownerUid],
  );
}

/**
 * Delete all archived conversations
 */
export function deleteArchivedConversations(): number {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  const result = db.runSync(
    "DELETE FROM conversations WHERE owner_uid = ? AND is_archived = 1",
    [ownerUid],
  );
  return result.changes;
}

// =============================================================================
// Statistics
// =============================================================================

/**
 * Get total conversation count
 */
export function getConversationCount(
  options: { scope?: "dm" | "group"; includeArchived?: boolean } = {},
): number {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  const { scope, includeArchived = false } = options;

  let whereClause = "owner_uid = ?";
  const params: (string | number)[] = [ownerUid];

  if (scope) {
    whereClause += " AND scope = ?";
    params.push(scope);
  }

  if (!includeArchived) {
    whereClause += " AND is_archived = 0";
  }

  const result = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM conversations WHERE ${whereClause}`,
    params,
  );
  return result?.count ?? 0;
}

/**
 * Get total unread count across all conversations
 */
export function getTotalUnreadCount(): number {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  const result = db.getFirstSync<{ total: number }>(
    "SELECT SUM(unread_count) as total FROM conversations WHERE owner_uid = ? AND is_archived = 0",
    [ownerUid],
  );
  return result?.total ?? 0;
}

/**
 * Get conversations with unread messages
 */
export function getConversationsWithUnread(): ConversationRow[] {
  const db = getDatabase();
  const ownerUid = getDatabaseOwnerUid();
  return db.getAllSync<ConversationRow>(
    `SELECT * FROM conversations 
     WHERE owner_uid = ? AND unread_count > 0 AND is_archived = 0
     ORDER BY COALESCE(last_message_at, updated_at) DESC`,
    [ownerUid],
  );
}
