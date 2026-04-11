/**
 * Stream User Provisioning
 *
 * Ensures users exist in Stream Video before they are referenced in calls.
 * Calls the `ensureStreamUsers` Cloud Function which upserts users server-side.
 */

import { getFunctionsInstance } from "@/services/firebase";
import { httpsCallable } from "firebase/functions";

const TAG = "[StreamUserProvisioning]";

/**
 * Ensure a set of user IDs exist as Stream Video users.
 * Must be called BEFORE creating a call with these users as members.
 * This is idempotent — safe to call multiple times for the same users.
 */
export async function ensureStreamUsersExist(userIds: string[]): Promise<void> {
  if (!userIds.length) return;

  // Deduplicate and validate
  const uniqueIds = [...new Set(userIds)].filter(
    (id) => typeof id === "string" && id.trim().length > 0,
  );
  if (!uniqueIds.length) return;

  try {
    const functions = getFunctionsInstance();
    const callable = httpsCallable<
      { userIds: string[] },
      { provisioned: number }
    >(functions, "ensureStreamUsers");
    await callable({ userIds: uniqueIds });
  } catch (err) {
    console.error(`${TAG} Failed to ensure Stream users:`, err);
    throw err;
  }
}
