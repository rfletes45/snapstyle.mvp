/**
 * Database Type Definitions
 *
 * TypeScript interfaces matching SQLite schema.
 *
 * @file src/types/database.ts
 */

// =============================================================================
// Conversation Types
// =============================================================================

export interface ConversationRow {
  id: string;
  scope: "dm" | "group";
  name: string | null;
  created_at: number;
  updated_at: number;
  last_message_id: string | null;
  last_message_text: string | null;
  last_message_at: number | null;
  is_archived: 0 | 1;
  is_muted: 0 | 1;
  muted_until: number | null;
  unread_count: number;
  sync_version: number;
}

// =============================================================================
// Message Types
// =============================================================================

export type MessageSyncStatus = "pending" | "synced" | "failed" | "conflict";

export interface MessageRow {
  id: string;
  conversation_id: string;
  scope: "dm" | "group";
  sender_id: string;
  sender_name: string | null;
  kind:
    | "text"
    | "media"
    | "voice"
    | "file"
    | "system"
    | "scorecard"
    | "game_invite";
  text: string | null;
  created_at: number;
  server_received_at: number | null;
  edited_at: number | null;
  reply_to_id: string | null;
  reply_to_preview: string | null; // JSON string
  mentions_json: string | null; // JSON string
  reactions_json: string | null; // JSON string
  deleted_for_all: 0 | 1;
  deleted_by: string | null;
  deleted_at: number | null;
  hidden_for_json: string | null; // JSON string
  link_preview_json: string | null; // JSON string
  sync_status: MessageSyncStatus;
  sync_error: string | null;
  retry_count: number;
}

// =============================================================================
// Attachment Types
// =============================================================================

export type AttachmentDownloadStatus =
  | "none"
  | "downloading"
  | "downloaded"
  | "failed";
export type AttachmentUploadStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "failed";

export interface AttachmentRow {
  id: string;
  message_id: string;
  kind: "image" | "video" | "audio" | "file";
  mime: string;
  local_uri: string | null;
  remote_url: string | null;
  remote_path: string | null;
  thumb_local_uri: string | null;
  thumb_remote_url: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  caption: string | null;
  view_once: 0 | 1;
  expires_at: number | null;
  download_status: AttachmentDownloadStatus;
  upload_status: AttachmentUploadStatus;
}

// =============================================================================
// Reaction Types
// =============================================================================

export interface ReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: number;
  sync_status: "pending" | "synced" | "failed";
}

// =============================================================================
// Sync Cursor Types
// =============================================================================

export interface SyncCursorRow {
  conversation_id: string;
  last_synced_at: number | null;
  last_sync_attempt: number | null;
  sync_token: string | null;
}

// =============================================================================
// Conversion Helpers
// =============================================================================

/**
 * Parse JSON column safely
 */
export function parseJsonColumn<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Convert boolean to SQLite integer
 */
export function boolToInt(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

/**
 * Convert SQLite integer to boolean
 */
export function intToBool(value: 0 | 1 | number): boolean {
  return value === 1;
}
