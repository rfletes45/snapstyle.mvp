/**
 * Account Deletion Service
 *
 * Provides the full client-side account deletion flow:
 *  1. Re-authentication (if needed)
 *  2. Calls the server-side `deleteAccount` Cloud Function
 *  3. Clears local caches and persisted state
 *  4. Signs out
 *
 * The heavy lifting (Firestore/Storage/RTDB/Auth cleanup) is done server-side.
 * This module handles the UX lifecycle and local cleanup only.
 *
 * @module services/accountDeletion
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EmailAuthProvider,
  User as FirebaseUser,
  reauthenticateWithCredential,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { getFunctionsInstance } from "./firebase";
import { removePushToken } from "./notifications";
import { cleanupPresence } from "./presence";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/accountDeletion");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DeleteAccountResult {
  success: boolean;
  message: string;
  jobId?: string;
  stepsCompleted?: string[];
  errors?: string[];
}

export type DeleteAccountError =
  | { type: "requires-reauth" }
  | { type: "network"; message: string }
  | { type: "server"; message: string; errors?: string[] }
  | { type: "unknown"; message: string };

// ─── Local Cache Keys to Clear ──────────────────────────────────────────────

const ASYNC_STORAGE_KEYS_TO_CLEAR = [
  "@vibe/notification_settings",
  "@vibe/theme_preference",
  "@vibe/use_system_theme",
  "@vibe/onboarding_complete",
  "@vibe/last_inbox_sync",
  "@vibe/draft_messages",
  "@vibe/cached_profile",
  "@vibe/cached_friends",
  "@vibe/game_settings",
  "@vibe/push_token",
];

// ─── Re-authentication ──────────────────────────────────────────────────────

/**
 * Re-authenticate the user with email/password.
 * Required by Firebase when the last sign-in was >5 minutes ago and
 * a sensitive operation (like account deletion) is attempted.
 */
export async function reauthenticateUser(
  user: FirebaseUser,
  password: string,
): Promise<void> {
  const email = user.email;
  if (!email) {
    throw new Error("No email address on file for re-authentication.");
  }

  const credential = EmailAuthProvider.credential(email, password);
  await reauthenticateWithCredential(user, credential);
  logger.info("[accountDeletion] Re-authentication successful");
}

// ─── Local Cleanup ──────────────────────────────────────────────────────────

/**
 * Clear all local caches and persisted state related to the deleted account.
 * This must run AFTER server-side deletion but BEFORE the auth state listener
 * fires, so listeners don't accidentally recreate user data.
 */
async function clearLocalState(): Promise<void> {
  try {
    // Clear known AsyncStorage keys
    await AsyncStorage.multiRemove(ASYNC_STORAGE_KEYS_TO_CLEAR);
    logger.info("[accountDeletion] Cleared known AsyncStorage keys");
  } catch (err: any) {
    logger.warn("[accountDeletion] Error clearing AsyncStorage:", err.message);
  }

  try {
    // Also clear any keys with vibe/ prefix (catch-all)
    const allKeys = await AsyncStorage.getAllKeys();
    const vibeKeys = allKeys.filter(
      (k) => k.startsWith("@vibe/") || k.startsWith("vibe_"),
    );
    if (vibeKeys.length > 0) {
      await AsyncStorage.multiRemove(vibeKeys);
      logger.info(
        `[accountDeletion] Cleared ${vibeKeys.length} additional cached keys`,
      );
    }
  } catch (err: any) {
    logger.warn("[accountDeletion] Error clearing vibe keys:", err.message);
  }
}

// ─── Main Deletion Flow ─────────────────────────────────────────────────────

/**
 * Execute the full account deletion flow.
 *
 * Steps:
 *  1. Remove push token (while we still have Firestore permissions)
 *  2. Clean up RTDB presence
 *  3. Call the server-side deleteAccount Cloud Function
 *  4. Clear local state
 *
 * The Cloud Function handles:
 *  - All Firestore document/subcollection cleanup
 *  - Storage file cleanup
 *  - RTDB cleanup
 *  - Username release
 *  - Auth user deletion (last step)
 *
 * @param user The current Firebase user
 * @returns Result of the deletion
 * @throws DeleteAccountError if deletion fails
 */
export async function executeAccountDeletion(
  user: FirebaseUser,
): Promise<DeleteAccountResult> {
  const uid = user.uid;
  logger.info(`[accountDeletion] Starting deletion for uid=${uid}`);

  // Step 1: Remove push token (best-effort, while we have permissions)
  try {
    await removePushToken(uid);
  } catch (err: any) {
    logger.warn("[accountDeletion] Push token removal failed:", err.message);
    // Non-fatal — server-side cleanup will handle the user doc anyway
  }

  // Step 2: Clean up RTDB presence (best-effort)
  try {
    cleanupPresence();
  } catch (err: any) {
    logger.warn("[accountDeletion] Presence cleanup failed:", err.message);
  }

  // Step 3: Call server-side deletion function
  try {
    const functions = getFunctionsInstance();
    const deleteAccountFn = httpsCallable<unknown, DeleteAccountResult>(
      functions,
      "deleteAccount",
    );

    const result = await deleteAccountFn({});
    const data = result.data;

    logger.info(
      `[accountDeletion] Server response: success=${data.success}, steps=${data.stepsCompleted?.length}`,
    );

    // Step 4: Clear local state regardless of server result
    await clearLocalState();

    if (!data.success) {
      throw {
        type: "server" as const,
        message: data.message,
        errors: data.errors,
      };
    }

    return data;
  } catch (err: any) {
    // Clear local state even on failure (user may be partially deleted)
    await clearLocalState();

    // Check for Firebase callable function errors
    if (
      err?.code === "functions/unauthenticated" ||
      err?.type === "requires-reauth"
    ) {
      throw { type: "requires-reauth" as const };
    }

    if (err?.type === "server") {
      throw err; // Already formatted
    }

    if (
      err?.code === "functions/unavailable" ||
      err?.code === "functions/deadline-exceeded" ||
      err?.message?.includes("network")
    ) {
      throw {
        type: "network" as const,
        message:
          "Network error during account deletion. Your deletion may still be processing. Please try again or contact support.",
      };
    }

    // Unknown error
    throw {
      type: "unknown" as const,
      message:
        err?.message || "An unexpected error occurred during account deletion.",
    };
  }
}
