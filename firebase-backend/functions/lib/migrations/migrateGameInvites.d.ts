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
import * as functions from "firebase-functions";
/**
 * Main migration function - HTTP callable
 *
 * Migrates all existing GameInvites to include universal invite fields.
 * Safe to run multiple times - skips already migrated documents.
 */
export declare const migrateGameInvites: functions.HttpsFunction;
/**
 * Dry-run migration - shows what would be migrated without making changes
 */
export declare const migrateGameInvitesDryRun: functions.HttpsFunction;
/**
 * Rollback migration - removes universal invite fields
 * USE WITH CAUTION - only for emergency rollback
 */
export declare const rollbackGameInvitesMigration: functions.HttpsFunction;
