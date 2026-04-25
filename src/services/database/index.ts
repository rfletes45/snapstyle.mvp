/**
 * SQLite Database Service
 *
 * Local-first message and media storage.
 * All database operations are synchronous for simplicity.
 *
 * @file src/services/database/index.ts
 */

import type { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

import {
  EXPERIMENTAL_WEB_SQLITE,
  USE_LOCAL_STORAGE,
} from "@/constants/featureFlags";
import { createLogger } from "@/utils/log";
const logger = createLogger("services/database/index");
// =============================================================================
// Constants
// =============================================================================

const DATABASE_NAME = "snapstyle.db";
const DATABASE_VERSION = 6;
const ANONYMOUS_OWNER_UID = "__anonymous__";

let activeOwnerUid: string | null = null;

function hasSharedArrayBufferSupport(): boolean {
  return typeof SharedArrayBuffer !== "undefined";
}

/**
 * Whether the current runtime can open the synchronous SQLite database.
 *
 * Native builds always support the current implementation. Web only supports
 * it when the experimental Expo SQLite runtime is explicitly enabled and the
 * page is running with SharedArrayBuffer support.
 */
export function isDatabaseRuntimeAvailable(): boolean {
  if (Platform.OS !== "web") {
    return true;
  }

  return USE_LOCAL_STORAGE && hasSharedArrayBufferSupport();
}

export function getDatabaseUnavailableReason(): string {
  if (Platform.OS !== "web") {
    return "SQLite is not available on this platform";
  }

  if (!EXPERIMENTAL_WEB_SQLITE) {
    return (
      "SQLite web runtime is disabled. Enable " +
      "EXPO_PUBLIC_ENABLE_WEB_SQLITE=1 after wiring Expo's wasm + COOP/COEP setup."
    );
  }

  if (!hasSharedArrayBufferSupport()) {
    return (
      "SQLite web runtime requires SharedArrayBuffer. Serve the app with " +
      "COOP/COEP headers before enabling local-first messaging on web."
    );
  }

  return "SQLite is not available on this platform";
}

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
  return SQLite!;
}

// =============================================================================
// Singleton Instance
// =============================================================================

// Singleton database instance
let db: SQLiteDatabase | null = null;

export function getDatabaseOwnerUid(): string {
  return activeOwnerUid ?? ANONYMOUS_OWNER_UID;
}

export function getActiveDatabaseOwnerUid(): string | null {
  return activeOwnerUid;
}

export function setDatabaseOwnerUid(uid: string): void {
  const normalized = uid.trim();
  if (!normalized) {
    clearDatabaseOwnerUid();
    return;
  }

  activeOwnerUid = normalized;
  if (db) {
    claimLegacyCacheForOwner(db, normalized);
  }
}

export function clearDatabaseOwnerUid(): void {
  activeOwnerUid = null;
}

/**
 * Get or create the database instance.
 * Throws when the current runtime cannot support synchronous SQLite.
 */
export function getDatabase(): SQLiteDatabase {
  if (!isDatabaseRuntimeAvailable()) {
    throw new Error(getDatabaseUnavailableReason());
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

function tableExists(database: SQLiteDatabase, name: string): boolean {
  const row = database.getFirstSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [name],
  );
  return !!row;
}

function columnExists(
  database: SQLiteDatabase,
  tableName: string,
  columnName: string,
): boolean {
  if (!tableExists(database, tableName)) return false;
  const rows = database.getAllSync<{ name: string }>(
    `PRAGMA table_info(${tableName})`,
  );
  return rows.some((row) => row.name === columnName);
}

function ensureColumn(
  database: SQLiteDatabase,
  tableName: string,
  columnSql: string,
): void {
  const columnName = columnSql.trim().split(/\s+/)[0];
  if (!tableExists(database, tableName)) return;
  if (columnExists(database, tableName, columnName)) return;
  database.execSync(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`);
}

function ensureOwnerScopedSchema(database: SQLiteDatabase): void {
  ensureColumn(database, "conversations", "owner_uid TEXT");
  ensureColumn(database, "messages", "owner_uid TEXT");
  ensureColumn(database, "attachments", "owner_uid TEXT");
  ensureColumn(database, "reactions", "owner_uid TEXT");
  ensureColumn(database, "sync_cursors", "owner_uid TEXT");
  ensureColumn(database, "sync_cursors", "last_doc_id TEXT");
  ensureOwnerScopedSyncCursors(database);

  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_conversations_owner_updated
      ON conversations(owner_uid, COALESCE(last_message_at, updated_at) DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_owner_scope_updated
      ON conversations(owner_uid, scope, COALESCE(last_message_at, updated_at) DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_owner_conversation_created_id
      ON messages(owner_uid, conversation_id, scope, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_owner_status
      ON messages(owner_uid, sync_status, retry_count);
    CREATE INDEX IF NOT EXISTS idx_messages_owner_thread
      ON messages(owner_uid, thread_root_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_attachments_owner_message
      ON attachments(owner_uid, message_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_owner_download
      ON attachments(owner_uid, download_status);
    CREATE INDEX IF NOT EXISTS idx_attachments_owner_upload
      ON attachments(owner_uid, upload_status);
    CREATE INDEX IF NOT EXISTS idx_reactions_owner_message
      ON reactions(owner_uid, message_id);
    CREATE INDEX IF NOT EXISTS idx_sync_cursors_owner_conversation
      ON sync_cursors(owner_uid, conversation_id);
  `);
}

function ensureOwnerScopedSyncCursors(database: SQLiteDatabase): void {
  if (!tableExists(database, "sync_cursors")) return;

  const tableInfo = database.getAllSync<{
    name: string;
    pk: number;
  }>("PRAGMA table_info(sync_cursors)");
  const conversationIdPk = tableInfo.some(
    (column) => column.name === "conversation_id" && column.pk > 0,
  );

  if (!conversationIdPk) return;

  database.withTransactionSync(() => {
    database.execSync(`
      CREATE TABLE IF NOT EXISTS sync_cursors_owner_scoped (
        conversation_id TEXT NOT NULL,
        owner_uid TEXT NOT NULL,
        last_synced_at INTEGER,
        last_sync_attempt INTEGER,
        last_doc_id TEXT,
        sync_token TEXT,
        PRIMARY KEY (owner_uid, conversation_id)
      );
    `);
    database.execSync(`
      INSERT OR REPLACE INTO sync_cursors_owner_scoped (
        conversation_id, owner_uid, last_synced_at, last_sync_attempt, last_doc_id, sync_token
      )
      SELECT
        conversation_id,
        COALESCE(NULLIF(owner_uid, ''), '${ANONYMOUS_OWNER_UID}'),
        last_synced_at,
        last_sync_attempt,
        last_doc_id,
        sync_token
      FROM sync_cursors;
    `);
    database.execSync("DROP TABLE sync_cursors;");
    database.execSync(
      "ALTER TABLE sync_cursors_owner_scoped RENAME TO sync_cursors;",
    );
  });
}

function claimLegacyCacheForOwner(
  database: SQLiteDatabase,
  ownerUid: string,
): void {
  ensureOwnerScopedSchema(database);
  database.withTransactionSync(() => {
    for (const tableName of [
      "conversations",
      "messages",
      "attachments",
      "reactions",
      "sync_cursors",
    ]) {
      database.runSync(
        `UPDATE ${tableName}
         SET owner_uid = ?
         WHERE owner_uid IS NULL OR owner_uid = ''`,
        [ownerUid],
      );
    }
  });
}

export function clearLocalChatCacheForOwner(ownerUid: string): void {
  const database = getDatabase();
  ensureOwnerScopedSchema(database);
  database.withTransactionSync(() => {
    database.runSync("DELETE FROM reactions WHERE owner_uid = ?", [ownerUid]);
    database.runSync("DELETE FROM attachments WHERE owner_uid = ?", [ownerUid]);
    database.runSync("DELETE FROM messages WHERE owner_uid = ?", [ownerUid]);
    database.runSync("DELETE FROM conversations WHERE owner_uid = ?", [
      ownerUid,
    ]);
    database.runSync("DELETE FROM sync_cursors WHERE owner_uid = ?", [
      ownerUid,
    ]);
  });
}

export function wipeAllLocalChatCache(): void {
  const database = getDatabase();
  database.withTransactionSync(() => {
    database.runSync("DELETE FROM reactions");
    database.runSync("DELETE FROM attachments");
    database.runSync("DELETE FROM messages");
    database.runSync("DELETE FROM conversations");
    database.runSync("DELETE FROM sync_cursors");
    if (tableExists(database, "messages_fts")) {
      database.runSync("DELETE FROM messages_fts");
    }
  });
}

function initializeSchema(database: SQLiteDatabase): void {
  const currentVersion =
    database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
      ?.user_version ?? 0;

  // ---- Migration from v1 → v2: add sender_style_json column ----
  if (currentVersion === 1) {
    try {
      database.execSync(
        `ALTER TABLE messages ADD COLUMN sender_style_json TEXT;`,
      );
      logger.info("[Database] Migrated v1 → v2: added sender_style_json");
    } catch (e: unknown) {
      // Column may already exist if a prior migration was interrupted
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("duplicate column")) {
        throw e;
      }
    }
  }

  // ---- Migration from v2 → v3: add thread columns ----
  if (currentVersion <= 2 && currentVersion >= 1) {
    try {
      database.execSync(`ALTER TABLE messages ADD COLUMN thread_root_id TEXT;`);
      database.execSync(
        `ALTER TABLE messages ADD COLUMN reply_count INTEGER DEFAULT 0;`,
      );
      database.execSync(
        `ALTER TABLE messages ADD COLUMN last_reply_at INTEGER;`,
      );
      database.execSync(
        `CREATE INDEX IF NOT EXISTS idx_messages_thread
         ON messages(thread_root_id, server_received_at DESC);`,
      );
      logger.info(
        "[Database] Migrated v2 → v3: added thread_root_id, reply_count, last_reply_at",
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("duplicate column")) {
        throw e;
      }
    }
  }

  // ---- Migration from v3 → v4: add FTS5 full-text search virtual table ----
  if (currentVersion === 3) {
    try {
      database.execSync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
          text,
          sender_name,
          content='messages',
          content_rowid='rowid',
          tokenize='unicode61 remove_diacritics 2'
        );
      `);
      // Backfill existing messages into FTS index
      database.execSync(`
        INSERT INTO messages_fts(rowid, text, sender_name)
        SELECT rowid, COALESCE(text, ''), COALESCE(sender_name, '')
        FROM messages
        WHERE deleted_for_all = 0 AND text IS NOT NULL AND text != '';
      `);
      logger.info(
        "[Database] Migrated v3 → v4: created messages_fts FTS5 table + backfill",
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("already exists")) {
        logger.error("[Database] FTS5 migration failed:", msg);
        throw e;
      }
    }
  }

  // ---- Migration from v4 → v5: add client_id column ----
  // The scorecard trust gate keys off `client_id` (server-authored
  // messages have `"server"` or `"server-share:*"`). Without this
  // column the local cache always hydrates `clientId: ""`, which
  // makes the renderer treat every server-authored scorecard as
  // unverified plain text — leaking the raw sentinel + JSON
  // (including profile-picture URLs) into the chat bubble.
  //
  // Run unconditionally (idempotent via duplicate-column catch) so
  // legacy databases with stale `user_version = 0` — which predate
  // the version-tracking system — still receive the column instead
  // of being silently skipped by a version-range guard.
  if (tableExists(database, "messages")) {
    try {
      database.execSync(`ALTER TABLE messages ADD COLUMN client_id TEXT;`);
      logger.info("[Database] Ensured client_id column on messages");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("duplicate column")) {
        throw e;
      }
    }
  }

  if (currentVersion < DATABASE_VERSION) {
    database.execSync(`
      -- Conversations table
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        owner_uid TEXT,
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
        owner_uid TEXT,
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
        thread_root_id TEXT,
        reply_count INTEGER DEFAULT 0,
        last_reply_at INTEGER,
        mentions_json TEXT,
        reactions_json TEXT,
        deleted_for_all INTEGER DEFAULT 0,
        deleted_by TEXT,
        deleted_at INTEGER,
        hidden_for_json TEXT,
        link_preview_json TEXT,
        sender_style_json TEXT,
        sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'failed', 'conflict')),
        sync_error TEXT,
        retry_count INTEGER DEFAULT 0,
        client_id TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      -- Attachments table
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        owner_uid TEXT,
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
        owner_uid TEXT,
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
        conversation_id TEXT NOT NULL,
        owner_uid TEXT NOT NULL,
        last_synced_at INTEGER,
        last_sync_attempt INTEGER,
        last_doc_id TEXT,
        sync_token TEXT,
        PRIMARY KEY (owner_uid, conversation_id)
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_messages_conversation 
        ON messages(conversation_id, server_received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_sync_status 
        ON messages(sync_status) WHERE sync_status != 'synced';
      CREATE INDEX IF NOT EXISTS idx_messages_created 
        ON messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_thread
        ON messages(thread_root_id, server_received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_attachments_message 
        ON attachments(message_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_download 
        ON attachments(download_status) WHERE download_status != 'downloaded';
      CREATE INDEX IF NOT EXISTS idx_conversations_updated 
        ON conversations(updated_at DESC);
    `);

    ensureOwnerScopedSchema(database);
    if (activeOwnerUid) {
      claimLegacyCacheForOwner(database, activeOwnerUid);
    }

    // FTS5 virtual table (CREATE VIRTUAL TABLE cannot run inside execSync batch)
    database.execSync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        text,
        sender_name,
        content='messages',
        content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
      );
    `);

    database.execSync(`PRAGMA user_version = ${DATABASE_VERSION}`);

    logger.info(`[Database] Schema initialized to version ${DATABASE_VERSION}`);
  }

  ensureOwnerScopedSchema(database);
  if (activeOwnerUid) {
    claimLegacyCacheForOwner(database, activeOwnerUid);
  }

  ensureSearchIndexes(database);
}

function ensureSearchIndexes(database: SQLiteDatabase): void {
  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_messages_search_recent
      ON messages(deleted_for_all, COALESCE(server_received_at, created_at) DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_search_scope_recent
      ON messages(scope, deleted_for_all, COALESCE(server_received_at, created_at) DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_search_kind_recent
      ON messages(kind, deleted_for_all, COALESCE(server_received_at, created_at) DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_search_sender_recent
      ON messages(sender_id, deleted_for_all, COALESCE(server_received_at, created_at) DESC);
  `);
}

// =============================================================================
// Export Types
// =============================================================================

export type { SQLiteDatabase } from "expo-sqlite";
