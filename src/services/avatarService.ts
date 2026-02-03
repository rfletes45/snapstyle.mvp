/**
 * Avatar Service
 *
 * Service for saving, loading, and managing digital avatar configurations.
 * Includes retry logic, validation, and batch migration support.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 7
 */

import type { DigitalAvatarConfig } from "@/types/avatar";
import { isDigitalAvatarConfig } from "@/types/avatar";
import type { AvatarConfig } from "@/types/models";
import {
  convertLegacyConfig,
  getDefaultAvatarConfig,
} from "@/utils/avatarHelpers";
import { validateAvatarConfig } from "@/utils/avatarValidation";
import {
  collection,
  doc,
  DocumentSnapshot,
  getDoc,
  getDocs,
  limit,
  query,
  startAfter,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getAuthInstance, getFirestoreInstance } from "./firebase";

// =============================================================================
// TYPES
// =============================================================================

export interface SaveAvatarResult {
  success: boolean;
  error?: string;
}

export interface LoadAvatarResult {
  success: boolean;
  config?: DigitalAvatarConfig;
  error?: string;
}

export interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface MigrationOptions {
  /** Number of users to process per batch (max 500) */
  batchSize?: number;
  /** Maximum total users to migrate (for testing) */
  maxUsers?: number;
  /** Preview mode - don't actually write changes */
  dryRun?: boolean;
  /** Callback for progress updates */
  onProgress?: (stats: MigrationStats) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MAX_BATCH_SIZE = 500; // Firestore limit

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `Attempt ${attempt + 1}/${maxRetries} failed:`,
        lastError.message,
      );

      if (attempt < maxRetries - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// =============================================================================
// SAVE AVATAR
// =============================================================================

/**
 * Save a digital avatar configuration to Firestore
 *
 * @param userId - User ID (uses current user if not provided)
 * @param config - The digital avatar configuration to save
 * @returns Result object with success status and optional error
 */
export async function saveDigitalAvatar(
  userId: string | undefined,
  config: DigitalAvatarConfig,
): Promise<SaveAvatarResult> {
  try {
    const auth = getAuthInstance();
    const db = getFirestoreInstance();

    // Use provided userId or current auth user
    const targetUserId = userId ?? auth.currentUser?.uid;

    if (!targetUserId) {
      return {
        success: false,
        error: "No user ID provided and no authenticated user",
      };
    }

    // Validate the configuration before saving
    const validation = validateAvatarConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid avatar configuration: ${validation.errors.join(", ")}`,
      };
    }

    // Add timestamp
    const configWithTimestamp: DigitalAvatarConfig = {
      ...config,
      updatedAt: Date.now(),
    };

    // Update the user document with retry logic
    await withRetry(async () => {
      const userRef = doc(db, "Users", targetUserId);
      await updateDoc(userRef, {
        digitalAvatar: configWithTimestamp,
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Error saving digital avatar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// LOAD AVATAR
// =============================================================================

/**
 * Load a digital avatar configuration from Firestore
 * Automatically converts legacy configs if no digital avatar exists
 *
 * @param userId - User ID (uses current user if not provided)
 * @returns Result object with config or error
 */
export async function loadDigitalAvatar(
  userId?: string,
): Promise<LoadAvatarResult> {
  try {
    const auth = getAuthInstance();
    const db = getFirestoreInstance();

    const targetUserId = userId ?? auth.currentUser?.uid;

    if (!targetUserId) {
      return {
        success: false,
        error: "No user ID provided and no authenticated user",
      };
    }

    // Fetch user document with retry logic
    const userDoc = await withRetry(async () => {
      const userRef = doc(db, "Users", targetUserId);
      return await getDoc(userRef);
    });

    if (!userDoc.exists()) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const data = userDoc.data();

    // Check for digital avatar first
    if (data?.digitalAvatar && isDigitalAvatarConfig(data.digitalAvatar)) {
      return {
        success: true,
        config: data.digitalAvatar as DigitalAvatarConfig,
      };
    }

    // If no digital avatar, try to convert legacy config
    if (data?.avatarConfig) {
      const convertedConfig = convertLegacyConfig(
        data.avatarConfig as AvatarConfig,
      );
      return {
        success: true,
        config: convertedConfig,
      };
    }

    // No avatar configured - return default
    return {
      success: true,
      config: getDefaultAvatarConfig(),
    };
  } catch (error) {
    console.error("Error loading digital avatar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// GET OR CREATE AVATAR
// =============================================================================

/**
 * Get user's digital avatar or create a default one
 *
 * @param userId - User ID
 * @returns Digital avatar configuration (never null)
 */
export async function getOrCreateDigitalAvatar(
  userId: string,
): Promise<DigitalAvatarConfig> {
  const result = await loadDigitalAvatar(userId);

  if (result.success && result.config) {
    return result.config;
  }

  // Return default config if loading failed
  return getDefaultAvatarConfig();
}

// =============================================================================
// BATCH MIGRATION
// =============================================================================

/**
 * Batch migrate users from legacy avatar to digital avatar
 * Processes users in batches to avoid Firestore limits
 *
 * @param options - Migration options
 * @returns Migration statistics
 */
export async function batchMigrateAvatars(
  options: MigrationOptions = {},
): Promise<MigrationStats> {
  const { batchSize = 100, maxUsers, dryRun = false, onProgress } = options;

  const effectiveBatchSize = Math.min(batchSize, MAX_BATCH_SIZE);

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    const db = getFirestoreInstance();
    const usersRef = collection(db, "Users");

    let lastDoc: DocumentSnapshot | null = null;
    let processedCount = 0;
    let hasMore = true;

    while (hasMore) {
      // Build query for this batch
      let batchQuery = query(usersRef, limit(effectiveBatchSize));

      if (lastDoc) {
        batchQuery = query(
          usersRef,
          startAfter(lastDoc),
          limit(effectiveBatchSize),
        );
      }

      const snapshot = await getDocs(batchQuery);

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      // Filter users that need migration
      const usersToMigrate = snapshot.docs.filter((doc) => {
        const data = doc.data();
        // User needs migration if they have avatarConfig but no digitalAvatar
        return data.avatarConfig && !data.digitalAvatar;
      });

      stats.total += usersToMigrate.length;
      stats.skipped += snapshot.docs.length - usersToMigrate.length;

      if (usersToMigrate.length > 0 && !dryRun) {
        // Create batch write
        const batch = writeBatch(db);

        for (const userDoc of usersToMigrate) {
          try {
            const data = userDoc.data();
            const legacyConfig = data.avatarConfig as AvatarConfig;

            // Convert to digital avatar
            const digitalAvatar = convertLegacyConfig(legacyConfig);
            digitalAvatar.createdAt = Date.now();
            digitalAvatar.updatedAt = Date.now();

            batch.update(userDoc.ref, {
              digitalAvatar,
            });

            stats.migrated++;
          } catch (error) {
            stats.failed++;
            const errorMsg = `Error processing ${userDoc.id}: ${error}`;
            stats.errors.push(errorMsg);
            console.error(errorMsg);
          }
        }

        // Commit the batch
        try {
          await batch.commit();
        } catch (error) {
          const errorMsg = `Batch commit error: ${error}`;
          stats.errors.push(errorMsg);
          console.error(errorMsg);
        }
      } else if (dryRun) {
        // In dry run mode, just count as migrated
        stats.migrated += usersToMigrate.length;
      }

      // Update progress
      processedCount += snapshot.docs.length;
      onProgress?.(stats);

      // Check if we've hit the max users limit
      if (maxUsers && processedCount >= maxUsers) {
        hasMore = false;
        break;
      }

      // Get last document for pagination
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // Check if there are more results
      hasMore = snapshot.docs.length === effectiveBatchSize;
    }

    return stats;
  } catch (error) {
    console.error("Migration error:", error);
    stats.errors.push(`Migration error: ${error}`);
    return stats;
  }
}

// =============================================================================
// MIGRATE SINGLE USER
// =============================================================================

/**
 * Migrate a single user from legacy to digital avatar
 *
 * @param userId - User ID to migrate
 * @returns Success status and migrated config
 */
export async function migrateUserAvatar(
  userId: string,
): Promise<{ success: boolean; config?: DigitalAvatarConfig; error?: string }> {
  try {
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { success: false, error: "User not found" };
    }

    const data = userDoc.data();

    // Already has digital avatar
    if (data.digitalAvatar) {
      return {
        success: true,
        config: data.digitalAvatar as DigitalAvatarConfig,
      };
    }

    // No legacy config to migrate
    if (!data.avatarConfig) {
      const defaultConfig = getDefaultAvatarConfig();
      await updateDoc(userRef, { digitalAvatar: defaultConfig });
      return { success: true, config: defaultConfig };
    }

    // Convert legacy config
    const digitalAvatar = convertLegacyConfig(
      data.avatarConfig as AvatarConfig,
    );
    digitalAvatar.createdAt = Date.now();
    digitalAvatar.updatedAt = Date.now();

    await updateDoc(userRef, { digitalAvatar });

    return { success: true, config: digitalAvatar };
  } catch (error) {
    console.error("Error migrating user avatar:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// DELETE AVATAR
// =============================================================================

/**
 * Reset user's digital avatar to default
 *
 * @param userId - User ID
 * @returns Success status
 */
export async function resetDigitalAvatar(
  userId: string,
): Promise<SaveAvatarResult> {
  const defaultConfig = getDefaultAvatarConfig();
  return saveDigitalAvatar(userId, defaultConfig);
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { getDefaultAvatarConfig } from "@/utils/avatarHelpers";
