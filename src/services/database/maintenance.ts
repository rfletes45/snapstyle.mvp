/**
 * Database Maintenance Utilities
 *
 * Tools for debugging, exporting, and resetting local data.
 * Used for development, testing, and troubleshooting.
 *
 * @file src/services/database/maintenance.ts
 */

import {
  deleteAsync,
  documentDirectory,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { MEDIA_PATHS } from "../mediaCache";
import { getDatabase } from "./index";

// =============================================================================
// Constants
// =============================================================================

const EXPORT_DIRECTORY = `${documentDirectory}snapstyle/exports/`;

// =============================================================================
// Types
// =============================================================================

export interface DatabaseExport {
  exportedAt: string;
  version: number;
  tables: {
    conversations: Array<Record<string, unknown>>;
    messages: Array<Record<string, unknown>>;
    attachments: Array<Record<string, unknown>>;
    reactions: Array<Record<string, unknown>>;
    syncCursors: Array<Record<string, unknown>>;
  };
  stats: {
    conversationCount: number;
    messageCount: number;
    attachmentCount: number;
    reactionCount: number;
  };
}

export interface MaintenanceStats {
  databaseCleared: boolean;
  mediaCacheCleared: boolean;
  exportDirectory: string | null;
}

// =============================================================================
// Export Functions
// =============================================================================

/**
 * Export entire database to JSON for debugging
 * Returns the file path where the export was saved
 */
export async function exportDatabaseForDebug(): Promise<string> {
  const db = getDatabase();

  // Ensure export directory exists
  const dirInfo = await getInfoAsync(EXPORT_DIRECTORY);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(EXPORT_DIRECTORY, { intermediates: true });
  }

  // Query all tables
  const conversations = db.getAllSync<Record<string, unknown>>(
    "SELECT * FROM conversations ORDER BY last_message_at DESC",
  );

  const messages = db.getAllSync<Record<string, unknown>>(
    "SELECT * FROM messages ORDER BY created_at DESC LIMIT 1000",
  );

  const attachments = db.getAllSync<Record<string, unknown>>(
    "SELECT * FROM attachments ORDER BY id",
  );

  const reactions = db.getAllSync<Record<string, unknown>>(
    "SELECT * FROM reactions ORDER BY created_at DESC",
  );

  const syncCursors = db.getAllSync<Record<string, unknown>>(
    "SELECT * FROM sync_cursors",
  );

  const exportData: DatabaseExport = {
    exportedAt: new Date().toISOString(),
    version: 1,
    tables: {
      conversations,
      messages,
      attachments,
      reactions,
      syncCursors,
    },
    stats: {
      conversationCount: conversations.length,
      messageCount: messages.length,
      attachmentCount: attachments.length,
      reactionCount: reactions.length,
    },
  };

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `database-export-${timestamp}.json`;
  const filePath = `${EXPORT_DIRECTORY}${filename}`;

  // Write to file
  await writeAsStringAsync(filePath, JSON.stringify(exportData, null, 2), {
    encoding: EncodingType.UTF8,
  });

  console.log(`[Maintenance] Database exported to: ${filePath}`);
  console.log(
    `[Maintenance] Stats: ${exportData.stats.conversationCount} conversations, ${exportData.stats.messageCount} messages`,
  );

  return filePath;
}

/**
 * Get database statistics without exporting
 */
export function getDatabaseStats(): Record<string, number> {
  const db = getDatabase();

  const conversationCount =
    db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM conversations",
    )?.count ?? 0;

  const messageCount =
    db.getFirstSync<{ count: number }>("SELECT COUNT(*) as count FROM messages")
      ?.count ?? 0;

  const pendingCount =
    db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM messages WHERE sync_status = 'pending'",
    )?.count ?? 0;

  const failedCount =
    db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM messages WHERE sync_status = 'failed'",
    )?.count ?? 0;

  const attachmentCount =
    db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM attachments",
    )?.count ?? 0;

  const reactionCount =
    db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM reactions",
    )?.count ?? 0;

  return {
    conversations: conversationCount,
    messages: messageCount,
    pendingMessages: pendingCount,
    failedMessages: failedCount,
    attachments: attachmentCount,
    reactions: reactionCount,
  };
}

// =============================================================================
// Reset Functions
// =============================================================================

/**
 * Clear all local data - database tables and media cache
 * Use with caution! This is destructive and cannot be undone.
 *
 * @param clearMediaCache - Whether to also clear cached media files (default: true)
 * @returns Stats about what was cleared
 */
export async function resetLocalData(
  clearMediaCache: boolean = true,
): Promise<MaintenanceStats> {
  console.log("[Maintenance] Starting local data reset...");

  const stats: MaintenanceStats = {
    databaseCleared: false,
    mediaCacheCleared: false,
    exportDirectory: null,
  };

  try {
    // First, export database for safety (in case user wants to recover)
    try {
      stats.exportDirectory = await exportDatabaseForDebug();
      console.log("[Maintenance] Safety export created");
    } catch (exportError) {
      console.warn(
        "[Maintenance] Could not create safety export:",
        exportError,
      );
    }

    // Clear database tables
    const db = getDatabase();

    db.runSync("DELETE FROM reactions");
    db.runSync("DELETE FROM attachments");
    db.runSync("DELETE FROM messages");
    db.runSync("DELETE FROM conversations");
    db.runSync("DELETE FROM sync_cursors");

    // Reset auto-increment counters
    db.runSync(
      "DELETE FROM sqlite_sequence WHERE name IN ('conversations', 'messages', 'attachments', 'reactions', 'sync_cursors')",
    );

    stats.databaseCleared = true;
    console.log("[Maintenance] Database tables cleared");

    // Clear media cache if requested
    if (clearMediaCache) {
      await clearMediaCacheDirectory();
      stats.mediaCacheCleared = true;
      console.log("[Maintenance] Media cache cleared");
    }

    console.log("[Maintenance] Local data reset complete");
    return stats;
  } catch (error) {
    console.error("[Maintenance] Error during reset:", error);
    throw error;
  }
}

/**
 * Clear only the media cache directory
 */
export async function clearMediaCacheDirectory(): Promise<void> {
  try {
    const mediaInfo = await getInfoAsync(MEDIA_PATHS.root);
    if (mediaInfo.exists) {
      await deleteAsync(MEDIA_PATHS.root, { idempotent: true });
      console.log("[Maintenance] Deleted media directory");
    }

    const tempInfo = await getInfoAsync(MEDIA_PATHS.temp);
    if (tempInfo.exists) {
      await deleteAsync(MEDIA_PATHS.temp, { idempotent: true });
      console.log("[Maintenance] Deleted temp directory");
    }
  } catch (error) {
    console.error("[Maintenance] Error clearing media cache:", error);
    throw error;
  }
}

/**
 * Clear only pending/failed messages (retry queue)
 * Useful for clearing stuck messages without losing all data
 */
export function clearPendingMessages(): number {
  const db = getDatabase();

  const result = db.runSync(
    "DELETE FROM messages WHERE sync_status IN ('pending', 'failed')",
  );

  console.log(
    `[Maintenance] Cleared ${result.changes} pending/failed messages`,
  );
  return result.changes;
}

/**
 * Force sync status reset for stuck messages
 * Sets all "syncing" messages back to "pending" for retry
 */
export function resetStuckSyncingMessages(): number {
  const db = getDatabase();

  const result = db.runSync(
    "UPDATE messages SET sync_status = 'pending' WHERE sync_status = 'syncing'",
  );

  console.log(`[Maintenance] Reset ${result.changes} stuck syncing messages`);
  return result.changes;
}

// =============================================================================
// Cleanup Functions
// =============================================================================

/**
 * Delete old messages beyond a certain age
 * Useful for managing database size over time
 *
 * @param daysOld - Delete messages older than this many days (default: 90)
 * @returns Number of messages deleted
 */
export function pruneOldMessages(daysOld: number = 90): number {
  const db = getDatabase();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffTimestamp = cutoffDate.toISOString();

  // Delete attachments for old messages first (foreign key constraint)
  db.runSync(
    `DELETE FROM attachments WHERE message_id IN (
      SELECT id FROM messages WHERE created_at < ? AND sync_status = 'synced'
    )`,
    [cutoffTimestamp],
  );

  // Delete reactions for old messages
  db.runSync(
    `DELETE FROM reactions WHERE message_id IN (
      SELECT id FROM messages WHERE created_at < ? AND sync_status = 'synced'
    )`,
    [cutoffTimestamp],
  );

  // Delete old synced messages (never delete unsynced messages)
  const result = db.runSync(
    "DELETE FROM messages WHERE created_at < ? AND sync_status = 'synced'",
    [cutoffTimestamp],
  );

  console.log(
    `[Maintenance] Pruned ${result.changes} messages older than ${daysOld} days`,
  );
  return result.changes;
}

/**
 * Vacuum database to reclaim space after deletions
 */
export function vacuumDatabase(): void {
  const db = getDatabase();
  db.runSync("VACUUM");
  console.log("[Maintenance] Database vacuumed");
}

/**
 * Full maintenance routine - prune, vacuum, and report stats
 */
export async function runFullMaintenance(
  options: {
    pruneOlderThanDays?: number;
    clearOrphanedMedia?: boolean;
  } = {},
): Promise<Record<string, unknown>> {
  const { pruneOlderThanDays = 90, clearOrphanedMedia = false } = options;

  console.log("[Maintenance] Starting full maintenance...");

  const beforeStats = getDatabaseStats();
  const prunedMessages = pruneOldMessages(pruneOlderThanDays);

  if (clearOrphanedMedia) {
    await clearOrphanedMediaFiles();
  }

  vacuumDatabase();
  const afterStats = getDatabaseStats();

  const report = {
    beforeStats,
    afterStats,
    prunedMessages,
    orphanedMediaCleared: clearOrphanedMedia,
  };

  console.log("[Maintenance] Full maintenance complete:", report);
  return report;
}

/**
 * Clear media files that are no longer referenced by any attachment
 */
export async function clearOrphanedMediaFiles(): Promise<number> {
  // Get all local_uri values from attachments
  const db = getDatabase();
  const attachments = db.getAllSync<{ local_uri: string | null }>(
    "SELECT local_uri FROM attachments WHERE local_uri IS NOT NULL",
  );

  const validPaths = new Set(
    attachments.map((a) => a.local_uri).filter(Boolean),
  );

  // This would require listing all files in media directories
  // and deleting any not in validPaths - simplified implementation
  console.log(
    `[Maintenance] Found ${validPaths.size} valid media paths, orphan cleanup not yet implemented`,
  );

  return 0;
}
