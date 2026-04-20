/**
 * Group Cleanup Cloud Function
 *
 * Firestore triggers for group cleanup.
 * Performs cascading cleanup of:
 *   - Members subcollection
 *   - MembersPrivate subcollection
 *   - Messages subcollection
 *   - AuditLog subcollection
 *   - Firebase Storage files (avatars, message media, voice messages)
 *   - Group background Storage files when backgroundUrl is removed
 *   - Per-user inbox entries referencing this group
 *
 * Safety:
 *   - Each cleanup step is independent and logged
 *   - Individual step failures do not block other steps
 *   - All operations use batched deletes to stay within Firestore limits
 *
 * @module functions/groupCleanup
 */
import * as functions from "firebase-functions";
export declare const onGroupBackgroundRemoved: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
export declare const onGroupDeleted: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
