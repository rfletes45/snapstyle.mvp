#!/usr/bin/env node
// @ts-nocheck
/**
 * Profile System Migration Script
 *
 * Migrates existing user documents to support the new profile system.
 * Adds default values for new profile fields while preserving existing data.
 *
 * Usage:
 *   npx ts-node scripts/migrate-profiles.ts --dry-run
 *   npx ts-node scripts/migrate-profiles.ts --production --batch-size=100
 *   npx ts-node scripts/migrate-profiles.ts --production --limit=10
 *
 * Options:
 *   --dry-run       Preview migration without making changes (default)
 *   --production    Execute migration (requires confirmation)
 *   --batch-size=N  Users per batch (default: 100, max: 500)
 *   --limit=N       Maximum users to migrate (for testing)
 *   --verbose       Show detailed progress
 *   --force         Skip user confirmation prompts
 *   --help          Show this help message
 *
 * @see docs/NEW_PROFILE_SYSTEM_PLAN.md
 */

import * as admin from "firebase-admin";
import * as readline from "readline";

// =============================================================================
// TYPES
// =============================================================================

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  limit?: number;
  verbose: boolean;
  force: boolean;
}

interface MigrationStats {
  total: number;
  migrated: number;
  alreadyMigrated: number;
  skipped: number;
  failed: number;
  errors: string[];
  startTime: number;
  endTime?: number;
}

interface ProfilePicture {
  url: string | null;
  thumbnailUrl?: string;
  updatedAt: number;
}

interface ProfileBio {
  text: string;
  updatedAt: number;
}

interface UserAvatarDecoration {
  decorationId: string | null;
  equippedAt?: number;
}

interface ProfileGameScoresConfig {
  enabled: boolean;
  displayedGames: any[];
  updatedAt: number;
}

interface UserThemeConfig {
  equippedThemeId: string;
  customBackgroundUrl?: string;
  updatedAt: number;
}

interface FeaturedBadgesConfig {
  badgeIds: string[];
  updatedAt: number;
}

interface ProfilePrivacySettings {
  profileVisibility: "everyone" | "friends" | "nobody";
  showProfilePicture: "everyone" | "friends" | "nobody";
  showBio: "everyone" | "friends" | "nobody";
  showStatus: "everyone" | "friends" | "nobody";
  showGameScores: "everyone" | "friends" | "nobody";
  showBadges: "everyone" | "friends" | "nobody";
  showLastActive: "everyone" | "friends" | "nobody";
  showOnlineStatus: "everyone" | "friends" | "nobody";
  showFriendshipInfo: "everyone" | "friends" | "nobody";
  showMutualFriends: boolean;
  showFriendCount: boolean;
  showFriendsList: "everyone" | "friends" | "nobody";
  allowFriendRequests: "everyone" | "friends" | "nobody";
  allowMessages: "everyone" | "friends" | "nobody";
  allowCalls: "everyone" | "friends" | "nobody";
  allowGameInvites: "everyone" | "friends" | "nobody";
  appearInSearch: boolean;
  allowProfileSharing: boolean;
  allowSuggestions: boolean;
  trackProfileViews: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_BATCH_SIZE = 500;
const DEFAULT_BATCH_SIZE = 100;

/** Default values for new profile fields */
const DEFAULT_PROFILE_PICTURE: ProfilePicture = {
  url: null,
  updatedAt: Date.now(),
};

const DEFAULT_BIO: ProfileBio = {
  text: "",
  updatedAt: Date.now(),
};

const DEFAULT_AVATAR_DECORATION: UserAvatarDecoration = {
  decorationId: null,
};

const DEFAULT_GAME_SCORES: ProfileGameScoresConfig = {
  enabled: false,
  displayedGames: [],
  updatedAt: Date.now(),
};

const DEFAULT_THEME: UserThemeConfig = {
  equippedThemeId: "default",
  updatedAt: Date.now(),
};

const DEFAULT_FEATURED_BADGES: FeaturedBadgesConfig = {
  badgeIds: [],
  updatedAt: Date.now(),
};

const DEFAULT_PRIVACY_SETTINGS: ProfilePrivacySettings = {
  profileVisibility: "everyone",
  showProfilePicture: "everyone",
  showBio: "everyone",
  showStatus: "friends",
  showGameScores: "everyone",
  showBadges: "everyone",
  showLastActive: "friends",
  showOnlineStatus: "friends",
  showFriendshipInfo: "friends",
  showMutualFriends: true,
  showFriendCount: true,
  showFriendsList: "friends",
  allowFriendRequests: "everyone",
  allowMessages: "friends",
  allowCalls: "friends",
  allowGameInvites: "friends",
  appearInSearch: true,
  allowProfileSharing: true,
  allowSuggestions: true,
  trackProfileViews: true,
};

// =============================================================================
// HELPERS
// =============================================================================

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);

  const options: MigrationOptions = {
    dryRun: true,
    batchSize: DEFAULT_BATCH_SIZE,
    verbose: false,
    force: false,
  };

  for (const arg of args) {
    if (arg === "--help") {
      showHelp();
      process.exit(0);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--production") {
      options.dryRun = false;
    } else if (arg === "--verbose") {
      options.verbose = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg.startsWith("--batch-size=")) {
      const size = parseInt(arg.split("=")[1], 10);
      options.batchSize = Math.min(Math.max(1, size), MAX_BATCH_SIZE);
    } else if (arg.startsWith("--limit=")) {
      const limit = parseInt(arg.split("=")[1], 10);
      if (limit > 0) {
        options.limit = limit;
      }
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Profile System Migration Script

Migrates existing user documents to support the new profile system.
Adds default values for new profile fields while preserving existing data.

Usage:
  npx ts-node scripts/migrate-profiles.ts [options]

Options:
  --dry-run       Preview migration without making changes (default)
  --production    Execute migration (requires confirmation)
  --batch-size=N  Users per batch (default: 100, max: 500)
  --limit=N       Maximum users to migrate (for testing)
  --verbose       Show detailed progress
  --force         Skip user confirmation prompts
  --help          Show this help message

Examples:
  npx ts-node scripts/migrate-profiles.ts --dry-run --verbose
  npx ts-node scripts/migrate-profiles.ts --production --batch-size=50 --limit=100
  npx ts-node scripts/migrate-profiles.ts --production --force
  `);
}

async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function log(message: string, options: MigrationOptions): void {
  if (options.verbose) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

// =============================================================================
// MIGRATION LOGIC
// =============================================================================

/**
 * Check if a user document already has the new profile fields
 */
function isAlreadyMigrated(userData: any): boolean {
  // Check for presence of key new fields
  return (
    userData.profilePicture !== undefined &&
    userData.privacy !== undefined &&
    userData.bio !== undefined &&
    userData.theme !== undefined
  );
}

/**
 * Check if user has legacy privacy settings that need merging
 */
function hasLegacyPrivacy(userData: any): boolean {
  // Old privacy had fewer fields
  const privacy = userData.privacy;
  if (!privacy) return false;

  // If missing new fields, it's legacy
  return (
    privacy.profileVisibility === undefined ||
    privacy.showFriendshipInfo === undefined ||
    privacy.allowFriendRequests === undefined
  );
}

/**
 * Merge legacy privacy settings with new defaults
 */
function mergeLegacyPrivacy(legacyPrivacy: any): ProfilePrivacySettings {
  return {
    ...DEFAULT_PRIVACY_SETTINGS,
    // Preserve old values if they exist
    showGameScores:
      legacyPrivacy.showGameScores ?? DEFAULT_PRIVACY_SETTINGS.showGameScores,
    showBadges: legacyPrivacy.showBadges ?? DEFAULT_PRIVACY_SETTINGS.showBadges,
    showLastActive:
      legacyPrivacy.showLastActive ?? DEFAULT_PRIVACY_SETTINGS.showLastActive,
    showBio: legacyPrivacy.showBio ?? DEFAULT_PRIVACY_SETTINGS.showBio,
    showMutualFriends:
      legacyPrivacy.showMutualFriends ??
      DEFAULT_PRIVACY_SETTINGS.showMutualFriends,
    showOnlineStatus:
      legacyPrivacy.showOnlineStatus === true
        ? "everyone"
        : legacyPrivacy.showOnlineStatus === false
          ? "nobody"
          : (legacyPrivacy.showOnlineStatus ??
            DEFAULT_PRIVACY_SETTINGS.showOnlineStatus),
    allowProfileSharing:
      legacyPrivacy.allowProfileSharing ??
      DEFAULT_PRIVACY_SETTINGS.allowProfileSharing,
  };
}

/**
 * Generate migration data for a user
 */
function generateMigrationData(userData: any): Record<string, any> {
  const now = Date.now();
  const migrationData: Record<string, any> = {};

  // Profile picture (if not set)
  if (userData.profilePicture === undefined) {
    migrationData.profilePicture = {
      url: null,
      updatedAt: now,
    };
  }

  // Avatar decoration (if not set)
  if (userData.avatarDecoration === undefined) {
    migrationData.avatarDecoration = {
      decorationId: null,
    };
  }

  // Bio (if not set)
  if (userData.bio === undefined) {
    migrationData.bio = {
      text: "",
      updatedAt: now,
    };
  }

  // Game scores config (if not set)
  if (userData.gameScores === undefined) {
    migrationData.gameScores = {
      enabled: false,
      displayedGames: [],
      updatedAt: now,
    };
  }

  // Theme (if not set)
  if (userData.theme === undefined) {
    migrationData.theme = {
      equippedThemeId: "default",
      updatedAt: now,
    };
  }

  // Featured badges (if not set)
  if (userData.featuredBadges === undefined) {
    migrationData.featuredBadges = {
      badgeIds: [],
      updatedAt: now,
    };
  }

  // Privacy settings (merge or create)
  if (userData.privacy === undefined) {
    migrationData.privacy = DEFAULT_PRIVACY_SETTINGS;
  } else if (hasLegacyPrivacy(userData)) {
    migrationData.privacy = mergeLegacyPrivacy(userData.privacy);
  }

  // Owned decorations array (if not set)
  if (userData.ownedDecorations === undefined) {
    migrationData.ownedDecorations = [];
  }

  // Owned themes array (if not set)
  if (userData.ownedThemes === undefined) {
    migrationData.ownedThemes = ["default"];
  }

  // Last profile update timestamp
  if (userData.lastProfileUpdate === undefined) {
    migrationData.lastProfileUpdate = userData.lastActive || now;
  }

  return migrationData;
}

/**
 * Migrate a batch of users
 */
async function migrateBatch(
  db: admin.firestore.Firestore,
  users: admin.firestore.QueryDocumentSnapshot[],
  options: MigrationOptions,
  stats: MigrationStats,
): Promise<void> {
  const batch = db.batch();
  let batchOperations = 0;

  for (const userDoc of users) {
    const userData = userDoc.data();
    const uid = userDoc.id;

    try {
      // Check if already migrated
      if (isAlreadyMigrated(userData) && !hasLegacyPrivacy(userData)) {
        stats.alreadyMigrated++;
        log(`User ${uid}: Already migrated, skipping`, options);
        continue;
      }

      // Generate migration data
      const migrationData = generateMigrationData(userData);

      if (Object.keys(migrationData).length === 0) {
        stats.skipped++;
        log(`User ${uid}: No changes needed`, options);
        continue;
      }

      if (!options.dryRun) {
        batch.update(userDoc.ref, migrationData);
        batchOperations++;
      }

      stats.migrated++;
      log(
        `User ${uid}: Migrating ${Object.keys(migrationData).length} fields`,
        options,
      );

      if (options.verbose) {
        console.log(`  Fields: ${Object.keys(migrationData).join(", ")}`);
      }
    } catch (error) {
      stats.failed++;
      stats.errors.push(`User ${uid}: ${error}`);
      console.error(`Error migrating user ${uid}:`, error);
    }
  }

  // Commit the batch
  if (!options.dryRun && batchOperations > 0) {
    await batch.commit();
    log(`Committed batch of ${batchOperations} updates`, options);
  }
}

/**
 * Run the migration
 */
async function runMigration(
  options: MigrationOptions,
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    alreadyMigrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    startTime: Date.now(),
  };

  console.log("\n========================================");
  console.log("Profile System Migration");
  console.log("========================================");
  console.log(
    `Mode: ${options.dryRun ? "DRY RUN (no changes)" : "PRODUCTION"}`,
  );
  console.log(`Batch size: ${options.batchSize}`);
  if (options.limit) {
    console.log(`Limit: ${options.limit} users`);
  }
  console.log("========================================\n");

  // Initialize Firebase Admin
  if (!admin.apps.length) {
    // Try to use service account if available
    try {
      const serviceAccount = require("../firebase-backend/service-account.json");
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch {
      // Fall back to default credentials
      admin.initializeApp();
    }
  }

  const db = admin.firestore();

  // Get total user count
  const countSnapshot = await db.collection("Users").count().get();
  const totalUsers = countSnapshot.data().count;
  console.log(`Total users in database: ${totalUsers}`);

  // Confirm if production mode
  if (!options.dryRun && !options.force) {
    const confirmed = await promptConfirmation(
      `\n⚠️  You are about to migrate up to ${options.limit || totalUsers} user documents.\n` +
        `This will add default profile fields to existing users.\n` +
        `Continue?`,
    );

    if (!confirmed) {
      console.log("Migration cancelled.");
      process.exit(0);
    }
  }

  console.log("\nStarting migration...\n");

  // Process users in batches
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let processedCount = 0;

  while (true) {
    // Build query
    let query = db.collection("Users").orderBy("uid").limit(options.batchSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      break;
    }

    const users = snapshot.docs;
    stats.total += users.length;
    processedCount += users.length;

    // Process batch
    await migrateBatch(db, users, options, stats);

    // Progress update
    const progress = ((processedCount / totalUsers) * 100).toFixed(1);
    console.log(
      `Progress: ${processedCount}/${totalUsers} (${progress}%) - ` +
        `Migrated: ${stats.migrated}, Already: ${stats.alreadyMigrated}, Failed: ${stats.failed}`,
    );

    // Check limit
    if (options.limit && processedCount >= options.limit) {
      console.log(`\nReached limit of ${options.limit} users.`);
      break;
    }

    // Update cursor for next batch
    lastDoc = users[users.length - 1];
  }

  stats.endTime = Date.now();
  return stats;
}

/**
 * Print final summary
 */
function printSummary(stats: MigrationStats, options: MigrationOptions): void {
  const duration = stats.endTime! - stats.startTime;

  console.log("\n========================================");
  console.log("Migration Complete");
  console.log("========================================");
  console.log(`Mode: ${options.dryRun ? "DRY RUN" : "PRODUCTION"}`);
  console.log(`Duration: ${formatDuration(duration)}`);
  console.log(`Total processed: ${stats.total}`);
  console.log(`Migrated: ${stats.migrated}`);
  console.log(`Already migrated: ${stats.alreadyMigrated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log("\nErrors:");
    stats.errors.slice(0, 10).forEach((error) => {
      console.log(`  - ${error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more`);
    }
  }

  if (options.dryRun) {
    console.log("\n💡 This was a dry run. No changes were made.");
    console.log("   Run with --production to apply changes.");
  } else {
    console.log("\n✅ Migration completed successfully!");
  }

  console.log("========================================\n");
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const options = parseArgs();

  try {
    const stats = await runMigration(options);
    printSummary(stats, options);
    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("\n❌ Migration failed with error:");
    console.error(error);
    process.exit(1);
  }
}

main();
