/**
 * Migration Script: Migrate Legacy GameInvites to Universal Format
 *
 * This migration adds the new universal invite fields to existing GameInvites
 * documents to ensure backward compatibility while enabling new features.
 *
 * Run via: firebase functions:call migrateGameInvites
 * Or deploy and hit the HTTP endpoint.
 *
 * @module migrations/migrateGameInvites
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

// =============================================================================
// Types
// =============================================================================

interface LegacyGameInvite {
  id: string;
  gameType: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  status: string;
  settings?: {
    isRated?: boolean;
    timeControl?: { type: string; seconds: number };
    chatEnabled?: boolean;
  };
  createdAt: FirebaseFirestore.Timestamp | number;
  expiresAt: FirebaseFirestore.Timestamp | number;
  updatedAt?: FirebaseFirestore.Timestamp | number;
  gameId?: string;
  // Field added by migration - used to detect already-migrated documents
  targetType?: "universal" | "specific";
}

interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: number;
  total: number;
  errorDetails: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert Firestore Timestamp or number to Unix milliseconds
 */
function toUnixMs(
  value: FirebaseFirestore.Timestamp | number | undefined,
): number {
  if (!value) return Date.now();
  if (typeof value === "number") return value;
  if (value.toMillis) return value.toMillis();
  return Date.now();
}

/**
 * Get default settings for a game type
 */
function getDefaultSettings(gameType: string): {
  isRated: boolean;
  timeControl?: { type: string; seconds: number };
  chatEnabled: boolean;
} {
  const defaults: Record<
    string,
    {
      isRated: boolean;
      timeControl?: { type: string; seconds: number };
      chatEnabled: boolean;
    }
  > = {
    chess: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 86400 },
      chatEnabled: true,
    },
    checkers: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 86400 },
      chatEnabled: true,
    },
    tic_tac_toe: {
      isRated: false,
      timeControl: { type: "per_turn", seconds: 60 },
      chatEnabled: true,
    },
    crazy_eights: {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 120 },
      chatEnabled: true,
    },
    "8ball_pool": {
      isRated: true,
      timeControl: { type: "per_turn", seconds: 60 },
      chatEnabled: true,
    },
    air_hockey: {
      isRated: true,
      timeControl: { type: "none", seconds: 0 },
      chatEnabled: true,
    },
  };
  return defaults[gameType] || { isRated: false, chatEnabled: true };
}

// =============================================================================
// Migration Functions
// =============================================================================

/**
 * Migrate a single invite document to universal format
 */
function buildMigrationUpdates(
  data: LegacyGameInvite,
): Record<string, unknown> {
  const createdAtMs = toUnixMs(data.createdAt);
  const expiresAtMs = toUnixMs(data.expiresAt);
  const now = Date.now();

  // Build host slot from sender
  const hostSlot = {
    playerId: data.senderId,
    playerName: data.senderName,
    playerAvatar: data.senderAvatar || null,
    claimedAt: createdAtMs,
    isHost: true,
  };

  // Build claimed slots based on status
  const claimedSlots = [hostSlot];

  // If the invite was accepted, the recipient also claimed a slot
  if (data.status === "accepted" && data.recipientId) {
    claimedSlots.push({
      playerId: data.recipientId,
      playerName: data.recipientName,
      playerAvatar: data.recipientAvatar || null,
      claimedAt: createdAtMs, // Use createdAt as approximation
      isHost: false,
    });
  }

  // Build eligible users list
  const eligibleUserIds = [data.senderId];
  if (data.recipientId) {
    eligibleUserIds.push(data.recipientId);
  }

  // Map legacy status to universal status
  let universalStatus = data.status;
  if (data.status === "accepted") {
    universalStatus = data.gameId ? "active" : "ready";
  }

  // Build settings with defaults
  const settings = {
    ...getDefaultSettings(data.gameType),
    ...data.settings,
  };

  return {
    // Context (assume DM for all legacy invites)
    context: "dm",
    targetType: "specific",
    conversationId: data.recipientId || data.senderId, // Best guess

    // Eligible users
    eligibleUserIds,

    // Player slots
    requiredPlayers: 2,
    maxPlayers: 2,
    claimedSlots,
    filledAt: data.status === "accepted" ? createdAtMs : null,

    // Spectating defaults
    spectatingEnabled: true,
    spectatorOnly: false,
    spectators: [],
    maxSpectators: null,

    // Visibility
    showInPlayPage: true,

    // Settings
    settings,

    // Status (may need mapping)
    status: universalStatus,

    // Ensure timestamps are numbers
    createdAt: createdAtMs,
    updatedAt: now,
    expiresAt: expiresAtMs,
  };
}

/**
 * Main migration function - HTTP callable
 *
 * Migrates all existing GameInvites to include universal invite fields.
 * Safe to run multiple times - skips already migrated documents.
 */
export const migrateGameInvites = functions.https.onRequest(
  async (req, res) => {
    functions.logger.info("Starting GameInvites migration");

    const result: MigrationResult = {
      migrated: 0,
      skipped: 0,
      errors: 0,
      total: 0,
      errorDetails: [],
    };

    try {
      const snapshot = await db.collection("GameInvites").get();
      result.total = snapshot.size;

      functions.logger.info(`Found ${snapshot.size} invites to process`);

      // Process in batches of 500 (Firestore batch limit)
      const BATCH_SIZE = 500;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        try {
          const data = doc.data() as LegacyGameInvite;

          // Skip if already migrated (has targetType field)
          if (data.targetType) {
            result.skipped++;
            continue;
          }

          // Skip if missing required fields
          if (!data.senderId || !data.gameType) {
            result.skipped++;
            functions.logger.warn(
              `Skipping invite ${doc.id}: missing required fields`,
            );
            continue;
          }

          // Build migration updates
          const updates = buildMigrationUpdates(data);

          // Add to batch
          batch.update(doc.ref, updates);
          batchCount++;
          result.migrated++;

          // Commit batch if at limit
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            functions.logger.info(`Committed batch of ${batchCount} updates`);
            batch = db.batch();
            batchCount = 0;
          }
        } catch (docError) {
          result.errors++;
          const errorMsg = `Error processing ${doc.id}: ${docError}`;
          result.errorDetails.push(errorMsg);
          functions.logger.error(errorMsg);
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
        functions.logger.info(`Committed final batch of ${batchCount} updates`);
      }

      functions.logger.info("Migration complete", result);
      res.json(result);
    } catch (error) {
      functions.logger.error("Migration failed", error);
      res.status(500).json({
        error: "Migration failed",
        details: String(error),
        ...result,
      });
    }
  },
);

/**
 * Dry-run migration - shows what would be migrated without making changes
 */
export const migrateGameInvitesDryRun = functions.https.onRequest(
  async (req, res) => {
    functions.logger.info("Starting GameInvites migration DRY RUN");

    const result = {
      wouldMigrate: 0,
      wouldSkip: 0,
      total: 0,
      sampleMigrations: [] as Array<{
        id: string;
        before: Partial<LegacyGameInvite>;
        after: Record<string, unknown>;
      }>,
    };

    try {
      const snapshot = await db.collection("GameInvites").get();
      result.total = snapshot.size;

      for (const doc of snapshot.docs) {
        const data = doc.data() as LegacyGameInvite;

        // Check if already migrated
        if (data.targetType) {
          result.wouldSkip++;
          continue;
        }

        // Check if missing required fields
        if (!data.senderId || !data.gameType) {
          result.wouldSkip++;
          continue;
        }

        result.wouldMigrate++;

        // Store sample migrations (first 5)
        if (result.sampleMigrations.length < 5) {
          const updates = buildMigrationUpdates(data);
          result.sampleMigrations.push({
            id: doc.id,
            before: {
              gameType: data.gameType,
              senderId: data.senderId,
              recipientId: data.recipientId,
              status: data.status,
            },
            after: updates,
          });
        }
      }

      functions.logger.info("Dry run complete", result);
      res.json(result);
    } catch (error) {
      functions.logger.error("Dry run failed", error);
      res.status(500).json({ error: "Dry run failed", details: String(error) });
    }
  },
);

/**
 * Rollback migration - removes universal invite fields
 * USE WITH CAUTION - only for emergency rollback
 */
export const rollbackGameInvitesMigration = functions.https.onRequest(
  async (req, res) => {
    // Safety check - require confirmation parameter
    if (req.query.confirm !== "YES_ROLLBACK") {
      res.status(400).json({
        error: "Rollback requires confirmation",
        usage: "Add ?confirm=YES_ROLLBACK to the URL",
      });
      return;
    }

    functions.logger.warn("Starting GameInvites migration ROLLBACK");

    const result = {
      rolledBack: 0,
      skipped: 0,
      total: 0,
    };

    try {
      const snapshot = await db.collection("GameInvites").get();
      result.total = snapshot.size;

      const BATCH_SIZE = 500;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Only rollback if has universal fields
        if (!data.targetType) {
          result.skipped++;
          continue;
        }

        // Remove universal invite fields
        batch.update(doc.ref, {
          context: admin.firestore.FieldValue.delete(),
          targetType: admin.firestore.FieldValue.delete(),
          conversationId: admin.firestore.FieldValue.delete(),
          conversationName: admin.firestore.FieldValue.delete(),
          eligibleUserIds: admin.firestore.FieldValue.delete(),
          requiredPlayers: admin.firestore.FieldValue.delete(),
          maxPlayers: admin.firestore.FieldValue.delete(),
          claimedSlots: admin.firestore.FieldValue.delete(),
          filledAt: admin.firestore.FieldValue.delete(),
          spectatingEnabled: admin.firestore.FieldValue.delete(),
          spectatorOnly: admin.firestore.FieldValue.delete(),
          spectators: admin.firestore.FieldValue.delete(),
          maxSpectators: admin.firestore.FieldValue.delete(),
          showInPlayPage: admin.firestore.FieldValue.delete(),
          chatMessageId: admin.firestore.FieldValue.delete(),
        });

        batchCount++;
        result.rolledBack++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      functions.logger.warn("Rollback complete", result);
      res.json(result);
    } catch (error) {
      functions.logger.error("Rollback failed", error);
      res.status(500).json({
        error: "Rollback failed",
        details: String(error),
        ...result,
      });
    }
  },
);
