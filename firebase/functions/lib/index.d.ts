/**
 * SnapStyle Cloud Functions
 * Handles:
 * - Automatic Storage cleanup when messages are deleted (Phase 4)
 * - Story auto-expiry and cleanup (Phase 5)
 * - Push notifications (Phase 6)
 * - Streak management (Phase 6)
 */
import * as functions from "firebase-functions";
/**
 * onNewMessage: Triggered when a new message is created
 * Sends push notification to recipient and updates streak tracking
 */
export declare const onNewMessage: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * onNewFriendRequest: Notify user when they receive a friend request
 */
export declare const onNewFriendRequest: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * onStoryViewed: Notify story author when their story is viewed
 */
export declare const onStoryViewed: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * streakReminder: Daily check for at-risk streaks
 * Runs at 8 PM UTC to remind users whose streaks are at risk
 */
export declare const streakReminder: functions.CloudFunction<unknown>;
/**
 * onDeleteMessage: Triggered when a message document is deleted
 * Cleans up associated Storage object if it's an image snap
 *
 * This provides redundant cleanup for snaps deleted via view-once flow
 * If the client-side deletion fails, this Cloud Function ensures cleanup
 */
export declare const onDeleteMessage: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * cleanupExpiredSnaps: Scheduled function to clean up expired snaps from Storage
 * Runs daily to remove any snaps that weren't deleted by TTL
 *
 * This is a safety net for snaps that:
 * - Weren't viewed (message TTL expires, but Storage file may persist)
 * - Failed to delete due to errors
 *
 * Future enhancement: Query Messages with expiresAt < now and delete their storage
 */
export declare const cleanupExpiredSnaps: functions.CloudFunction<unknown>;
/**
 * cleanupExpiredStories: Scheduled function to clean up expired stories
 * Runs daily at 2 AM UTC to remove stories past their 24h expiry
 *
 * For each expired story:
 * - Delete the storage file from Storage
 * - Delete the story document (views subcollection auto-deletes)
 *
 * This ensures stories expire even if TTL index isn't active
 */
export declare const cleanupExpiredStories: functions.CloudFunction<unknown>;
