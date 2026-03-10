/**
 * deleteAccount — Server-side account deletion Cloud Function
 *
 * Orchestrates complete, safe, retry-safe deletion of all user data:
 *  1. Creates a DeletionJob doc for idempotency & audit trail
 *  2. Cleans all Firestore documents, subcollections, and references
 *  3. Cleans Firebase Storage files
 *  4. Cleans Realtime Database presence/visibility
 *  5. Releases the username for reuse
 *  6. Deletes the Firebase Auth record (last step)
 *  7. Marks the DeletionJob as complete
 *
 * The function is callable (authenticated) — the caller must be the user
 * being deleted. The Auth token is verified at the Cloud Functions layer.
 *
 * Deletion ordering:
 *  - All data cleanup happens BEFORE Auth deletion so the Admin SDK still
 *    has a valid uid to reference.
 *  - Auth deletion is the final step.
 *  - If any step fails, the DeletionJob doc records how far we got so the
 *    deletion can be retried or completed manually.
 *
 * @module functions/deleteAccount
 */
import * as functions from "firebase-functions";
export declare const deleteAccountFunction: functions.HttpsFunction & functions.Runnable<any>;
