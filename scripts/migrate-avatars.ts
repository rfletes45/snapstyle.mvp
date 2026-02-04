#!/usr/bin/env node
// @ts-nocheck
/**
 * Avatar Migration Script
 *
 * Migrates legacy avatar configurations to digital avatar format.
 * Supports dry-run mode, batch processing, and progress reporting.
 *
 * Usage:
 *   npx ts-node scripts/migrate-avatars.ts --dry-run
 *   npx ts-node scripts/migrate-avatars.ts --production --batch-size=100
 *   npx ts-node scripts/migrate-avatars.ts --production --limit=10
 *
 * Options:
 *   --dry-run       Preview migration without making changes (default)
 *   --production    Execute migration (requires confirmation)
 *   --batch-size=N  Users per batch (default: 100, max: 500)
 *   --limit=N       Maximum users to migrate (for testing)
 *   --verbose       Show detailed progress
 *   --help          Show this help message
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 7
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
}

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
  startTime: number;
  endTime?: number;
}

interface LegacyAvatarConfig {
  baseColor: string;
  hat?: string;
  glasses?: string;
  background?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_BATCH_SIZE = 500;
const DEFAULT_BATCH_SIZE = 100;

// =============================================================================
// COLOR MAPPING
// =============================================================================

const COLOR_TO_SKIN_MAP: Record<string, string> = {
  "#FF6B6B": "skin_06",
  "#4ECDC4": "skin_06",
  "#45B7D1": "skin_06",
  "#96CEB4": "skin_06",
  "#FFEAA7": "skin_03",
  "#DDA0DD": "skin_06",
  "#98D8C8": "skin_04",
  "#F7DC6F": "skin_03",
  "#BB8FCE": "skin_06",
  "#85C1E9": "skin_06",
  "#FFDAB9": "skin_02",
  "#FFE4C4": "skin_02",
  "#FFF0E6": "skin_01",
  "#F5DEB3": "skin_03",
  "#DEB887": "skin_05",
  "#D2B48C": "skin_05",
  "#C4A484": "skin_06",
  "#A0522D": "skin_08",
  "#CD853F": "skin_07",
  "#D2691E": "skin_08",
  "#8B4513": "skin_10",
  "#A67B5B": "skin_09",
  "#6B4423": "skin_11",
  "#4A3728": "skin_12",
};

const HAT_EMOJI_MAP: Record<string, string> = {
  "🔥": "headwear_flame",
  "👑": "headwear_crown_royal",
  "😇": "headwear_halo",
  "🎉": "headwear_party_hat",
  "🧢": "headwear_baseball_cap",
  "🎿": "headwear_beanie_basic",
  "🎩": "headwear_top_hat",
  "👒": "headwear_sun_hat",
};

const GLASSES_EMOJI_MAP: Record<string, string> = {
  "😎": "eyewear_aviator_sun",
  "👓": "eyewear_round_thin",
  "🕶️": "eyewear_aviator_sun",
  "🕶": "eyewear_aviator_sun",
  "🥽": "eyewear_goggles_ski",
  "🤩": "eyewear_star_glasses",
  "🤓": "eyewear_round_thick",
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: true, // Safe default
    batchSize: DEFAULT_BATCH_SIZE,
    verbose: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
    }
    if (arg === "--production") {
      options.dryRun = false;
    }
    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    }
    if (arg.startsWith("--batch-size=")) {
      const size = parseInt(arg.split("=")[1], 10);
      options.batchSize = Math.min(size, MAX_BATCH_SIZE);
    }
    if (arg.startsWith("--limit=")) {
      options.limit = parseInt(arg.split("=")[1], 10);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Avatar Migration Script
=======================

Migrates legacy avatar configurations to the new digital avatar system.

Usage:
  npx ts-node scripts/migrate-avatars.ts [options]

Options:
  --dry-run       Preview migration without making changes (default)
  --production    Execute migration (requires confirmation)
  --batch-size=N  Users per batch (default: ${DEFAULT_BATCH_SIZE}, max: ${MAX_BATCH_SIZE})
  --limit=N       Maximum users to migrate (for testing)
  --verbose, -v   Show detailed progress
  --help, -h      Show this help message

Examples:
  # Preview migration (safe)
  npx ts-node scripts/migrate-avatars.ts --dry-run

  # Migrate first 10 users (test)
  npx ts-node scripts/migrate-avatars.ts --production --limit=10

  # Full migration with progress
  npx ts-node scripts/migrate-avatars.ts --production --verbose
`);
}

function mapColorToSkinTone(hexColor: string): string {
  const normalized = hexColor.toUpperCase();
  return COLOR_TO_SKIN_MAP[normalized] || "skin_06";
}

function convertLegacyConfig(
  legacy: LegacyAvatarConfig,
): Record<string, unknown> {
  const now = Date.now();

  const digitalAvatar: Record<string, unknown> = {
    version: 2,
    createdAt: now,
    updatedAt: now,
    migratedAt: now,
    migratedFrom: "legacy",

    body: {
      skinTone: mapColorToSkinTone(legacy.baseColor),
      shape: "body_average",
      height: 1.0,
    },

    face: {
      shape: "oval",
      width: 1.0,
    },

    eyes: {
      style: "eye_natural",
      color: "brown_dark",
      size: 1.0,
      spacing: 1.0,
      tilt: 0,
      eyebrows: {
        style: "brow_natural",
        color: "dark_brown",
        thickness: 1.0,
      },
      eyelashes: {
        enabled: false,
        style: "natural",
        color: "#000000",
      },
    },

    nose: {
      style: "nose_small",
      size: 1.0,
    },

    mouth: {
      style: "mouth_smile",
      size: 1.0,
      lipColor: "lip_natural_medium",
      lipThickness: 1.0,
    },

    ears: {
      style: "ear_medium",
      size: 1.0,
      visible: true,
    },

    hair: {
      style: "hair_short_classic",
      color: "dark_brown",
      facialHair: {
        style: "none",
        color: "dark_brown",
      },
    },

    clothing: {
      top: "top_tshirt_basic",
      bottom: "bottom_jeans_regular",
      outfit: null,
    },

    accessories: {
      headwear: legacy.hat ? HAT_EMOJI_MAP[legacy.hat] || null : null,
      eyewear: legacy.glasses
        ? GLASSES_EMOJI_MAP[legacy.glasses] || null
        : null,
      earwear: null,
      neckwear: null,
      wristwear: null,
    },

    legacy: legacy,
    _legacyColor: legacy.baseColor,
  };

  return digitalAvatar;
}

async function confirmProduction(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n⚠️  WARNING: Running in PRODUCTION mode");
    console.log("This will modify user data in Firestore.\n");

    rl.question('Type "migrate" to confirm: ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "migrate");
    });
  });
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

// =============================================================================
// MAIN MIGRATION FUNCTION
// =============================================================================

async function migrateAvatars(
  db: admin.firestore.Firestore,
  options: MigrationOptions,
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    startTime: Date.now(),
  };

  console.log("\n📊 Starting avatar migration...");
  console.log(
    `   Mode: ${options.dryRun ? "DRY RUN (preview)" : "PRODUCTION"}`,
  );
  console.log(`   Batch size: ${options.batchSize}`);
  if (options.limit) {
    console.log(`   Limit: ${options.limit} users`);
  }
  console.log("");

  const usersRef = db.collection("Users");
  let lastDoc: admin.firestore.DocumentSnapshot | null = null;
  let processedCount = 0;
  let hasMore = true;

  while (hasMore) {
    // Build query
    let queryRef = usersRef.limit(options.batchSize);
    if (lastDoc) {
      queryRef = queryRef.startAfter(lastDoc);
    }

    const snapshot = await queryRef.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    // Filter users needing migration
    const usersToMigrate = snapshot.docs.filter((doc) => {
      const data = doc.data();
      return data.avatarConfig && !data.digitalAvatar;
    });

    const skippedInBatch = snapshot.docs.length - usersToMigrate.length;
    stats.skipped += skippedInBatch;

    if (usersToMigrate.length > 0) {
      if (options.verbose) {
        console.log(
          `\n   Batch: ${usersToMigrate.length} to migrate, ${skippedInBatch} already migrated`,
        );
      }

      if (!options.dryRun) {
        // Create batch write
        const batch = db.batch();

        for (const userDoc of usersToMigrate) {
          try {
            const data = userDoc.data();
            const legacy = data.avatarConfig as LegacyAvatarConfig;
            const digitalAvatar = convertLegacyConfig(legacy);

            batch.update(userDoc.ref, { digitalAvatar });
            stats.migrated++;
            stats.total++;

            if (options.verbose) {
              console.log(
                `   ✓ ${userDoc.id}: ${legacy.baseColor} -> skin tone mapped`,
              );
            }
          } catch (error) {
            stats.failed++;
            stats.total++;
            const errorMsg = `Error processing ${userDoc.id}: ${error}`;
            stats.errors.push(errorMsg);
            if (options.verbose) {
              console.log(`   ✗ ${userDoc.id}: ${error}`);
            }
          }
        }

        // Commit batch
        try {
          await batch.commit();
          if (!options.verbose) {
            process.stdout.write(
              `\r   Migrated: ${stats.migrated} | Skipped: ${stats.skipped} | Failed: ${stats.failed}`,
            );
          }
        } catch (error) {
          const errorMsg = `Batch commit failed: ${error}`;
          stats.errors.push(errorMsg);
          console.error(`\n   ❌ ${errorMsg}`);
        }
      } else {
        // Dry run - just count
        for (const userDoc of usersToMigrate) {
          const data = userDoc.data();
          const legacy = data.avatarConfig as LegacyAvatarConfig;
          stats.migrated++;
          stats.total++;

          if (options.verbose) {
            const skinTone = mapColorToSkinTone(legacy.baseColor);
            const headwear = legacy.hat ? HAT_EMOJI_MAP[legacy.hat] : null;
            const eyewear = legacy.glasses
              ? GLASSES_EMOJI_MAP[legacy.glasses]
              : null;
            console.log(
              `   [DRY RUN] ${userDoc.id}: ${legacy.baseColor} -> ${skinTone}` +
                (headwear ? `, hat: ${headwear}` : "") +
                (eyewear ? `, glasses: ${eyewear}` : ""),
            );
          }
        }

        if (!options.verbose) {
          process.stdout.write(
            `\r   Would migrate: ${stats.migrated} | Already migrated: ${stats.skipped}`,
          );
        }
      }
    }

    // Update pagination
    processedCount += snapshot.docs.length;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMore = snapshot.docs.length === options.batchSize;

    // Check limit
    if (options.limit && processedCount >= options.limit) {
      hasMore = false;
    }
  }

  stats.endTime = Date.now();
  return stats;
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║     Avatar Migration Script v1.0          ║");
  console.log("╚═══════════════════════════════════════════╝");

  // Production confirmation
  if (!options.dryRun) {
    const confirmed = await confirmProduction();
    if (!confirmed) {
      console.log("\n❌ Migration cancelled.\n");
      process.exit(0);
    }
  }

  // Initialize Firebase Admin
  console.log("\n🔥 Initializing Firebase Admin...");

  try {
    // Try to load service account from environment or file
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (serviceAccountPath) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Try default credentials (useful for Cloud Functions or local emulator)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }

    console.log("   ✓ Firebase initialized");
  } catch (error) {
    console.error("\n❌ Failed to initialize Firebase:");
    console.error("   " + error);
    console.error(
      "\n   Make sure GOOGLE_APPLICATION_CREDENTIALS environment variable",
    );
    console.error("   points to your Firebase service account JSON file.\n");
    process.exit(1);
  }

  const db = admin.firestore();

  // Run migration
  const stats = await migrateAvatars(db, options);

  // Print summary
  const duration = stats.endTime ? stats.endTime - stats.startTime : 0;

  console.log("\n\n═══════════════════════════════════════════");
  console.log("            Migration Summary");
  console.log("═══════════════════════════════════════════\n");

  if (options.dryRun) {
    console.log("   Mode:            DRY RUN (no changes made)");
    console.log(`   Would migrate:   ${stats.migrated}`);
    console.log(`   Already done:    ${stats.skipped}`);
  } else {
    console.log("   Mode:            PRODUCTION");
    console.log(`   Migrated:        ${stats.migrated}`);
    console.log(`   Skipped:         ${stats.skipped}`);
    console.log(`   Failed:          ${stats.failed}`);
  }

  console.log(`   Duration:        ${formatDuration(duration)}`);

  if (stats.errors.length > 0) {
    console.log("\n   Errors:");
    stats.errors.slice(0, 10).forEach((e) => console.log(`   - ${e}`));
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more errors`);
    }
  }

  console.log("\n═══════════════════════════════════════════\n");

  // Exit with error code if there were failures
  process.exit(stats.failed > 0 ? 1 : 0);
}

// Run
main().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
