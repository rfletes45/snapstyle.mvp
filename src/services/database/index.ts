/**
 * SQLite Database Service
 *
 * Local-first message and media storage.
 * All database operations are synchronous for simplicity.
 *
 * @file src/services/database/index.ts
 */

import { Platform } from "react-native";

// =============================================================================
// Constants
// =============================================================================

const DATABASE_NAME = "snapstyle.db";
const DATABASE_VERSION = 1;

/**
 * Check if SQLite is available on this platform
 * SQLite sync operations require SharedArrayBuffer on web, which needs COOP/COEP headers
 * Also not fully supported in Expo Go for certain operations
 */
const IS_SQLITE_AVAILABLE = Platform.OS !== "web";

// =============================================================================
// Lazy-loaded SQLite module
// We lazy-load expo-sqlite to avoid accessing native modules before the runtime
// is fully initialized, which can cause issues in Expo Go
// =============================================================================

let SQLite: typeof import("expo-sqlite") | null = null;

function getSQLiteModule(): typeof import("expo-sqlite") {
  if (!SQLite) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SQLite = require("expo-sqlite");
  }
  return SQLite;
}

// =============================================================================
// Singleton Instance
// =============================================================================

// Use 'any' for the db type to avoid importing expo-sqlite types at module level
let db: any = null;

/**
 * Get or create the database instance
 * Returns null on web platform where SQLite sync operations are not available
 */
export function getDatabase(): any {
  // SQLite sync operations are not available on web
  if (!IS_SQLITE_AVAILABLE) {
    return null;
  }

  if (!db) {
    const sqlite = getSQLiteModule();
    db = sqlite.openDatabaseSync(DATABASE_NAME);
    initializeSchema(db);
  }
  return db;
}

/**
 * Close database connection (for cleanup/testing)
 */
export function closeDatabase(): void {
  if (db) {
    db.closeSync();
    db = null;
  }
}

// =============================================================================
// Schema Initialization
// =============================================================================

// Use 'any' for the database parameter since we're lazy-loading the module
function initializeSchema(database: any): void {
  const currentVersion =
    database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
      ?.user_version ?? 0;

  if (currentVersion < DATABASE_VERSION) {
    database.execSync(`
      -- Conversations table
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL CHECK(scope IN ('dm', 'group')),
        name TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_message_id TEXT,
        last_message_text TEXT,
        last_message_at INTEGER,
        is_archived INTEGER DEFAULT 0,
        is_muted INTEGER DEFAULT 0,
        muted_until INTEGER,
        unread_count INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 0
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        scope TEXT NOT NULL CHECK(scope IN ('dm', 'group')),
        sender_id TEXT NOT NULL,
        sender_name TEXT,
        kind TEXT NOT NULL,
        text TEXT,
        created_at INTEGER NOT NULL,
        server_received_at INTEGER,
        edited_at INTEGER,
        reply_to_id TEXT,
        reply_to_preview TEXT,
        mentions_json TEXT,
        reactions_json TEXT,
        deleted_for_all INTEGER DEFAULT 0,
        deleted_by TEXT,
        deleted_at INTEGER,
        hidden_for_json TEXT,
        link_preview_json TEXT,
        sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'failed', 'conflict')),
        sync_error TEXT,
        retry_count INTEGER DEFAULT 0,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      -- Attachments table
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('image', 'video', 'audio', 'file')),
        mime TEXT NOT NULL,
        local_uri TEXT,
        remote_url TEXT,
        remote_path TEXT,
        thumb_local_uri TEXT,
        thumb_remote_url TEXT,
        size_bytes INTEGER,
        width INTEGER,
        height INTEGER,
        duration_ms INTEGER,
        caption TEXT,
        view_once INTEGER DEFAULT 0,
        expires_at INTEGER,
        download_status TEXT DEFAULT 'none' CHECK(download_status IN ('none', 'downloading', 'downloaded', 'failed')),
        upload_status TEXT DEFAULT 'pending' CHECK(upload_status IN ('pending', 'uploading', 'uploaded', 'failed')),
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      );

      -- Reactions table
      CREATE TABLE IF NOT EXISTS reactions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'pending',
        UNIQUE(message_id, user_id, emoji),
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      );

      -- Sync cursors table
      CREATE TABLE IF NOT EXISTS sync_cursors (
        conversation_id TEXT PRIMARY KEY,
        last_synced_at INTEGER,
        last_sync_attempt INTEGER,
        sync_token TEXT
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_messages_conversation 
        ON messages(conversation_id, server_received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_sync_status 
        ON messages(sync_status) WHERE sync_status != 'synced';
      CREATE INDEX IF NOT EXISTS idx_messages_created 
        ON messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_attachments_message 
        ON attachments(message_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_download 
        ON attachments(download_status) WHERE download_status != 'downloaded';
      CREATE INDEX IF NOT EXISTS idx_conversations_updated 
        ON conversations(updated_at DESC);

      -- Update version
      PRAGMA user_version = ${DATABASE_VERSION};
    `);

    console.log(`[Database] Schema initialized to version ${DATABASE_VERSION}`);
  }
}

// =============================================================================
// Export Types
// =============================================================================

export type { SQLiteDatabase } from "expo-sqlite";
