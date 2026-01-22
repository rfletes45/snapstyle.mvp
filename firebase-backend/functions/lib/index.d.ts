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
/**
 * processScheduledMessages: Runs every minute to check for scheduled messages
 * that are due to be sent and delivers them.
 */
export declare const processScheduledMessages: functions.CloudFunction<unknown>;
/**
 * onScheduledMessageCreated: Triggered when a new scheduled message is created
 * Can be used for additional validation or logging
 */
export declare const onScheduledMessageCreated: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * cleanupOldScheduledMessages: Runs daily to clean up old sent/cancelled/failed messages
 * Keeps scheduled messages for 30 days after they've been processed
 */
export declare const cleanupOldScheduledMessages: functions.CloudFunction<unknown>;
/**
 * onGameSessionCreated: Triggered when a new game session is recorded
 * Updates leaderboard and checks for achievements
 */
export declare const onGameSessionCreated: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * onStreakUpdated: Check for streak achievements when streak changes
 * This extends the existing streak update logic
 */
export declare const onStreakAchievementCheck: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
/**
 * Weekly leaderboard reset notification (optional)
 * Runs Monday at 00:00 UTC to notify top players from previous week
 */
export declare const weeklyLeaderboardReset: functions.CloudFunction<unknown>;
/**
 * Initialize wallet when new user is created
 * Grants starting tokens to new users
 */
export declare const onUserCreated: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * claimTaskReward: Callable function to claim reward for completed task
 * Validates completion, prevents double claims, awards tokens atomically
 */
export declare const claimTaskReward: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Update task progress when message is sent
 */
export declare const onMessageSentTaskProgress: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * Update task progress when story is viewed
 */
export declare const onStoryViewedTaskProgress: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * Update task progress when story is posted
 */
export declare const onStoryPostedTaskProgress: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * Update task progress when game is played
 * Note: This extends the existing onGameSessionCreated functionality
 */
export declare const onGamePlayedTaskProgress: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * Update task progress when friend is added
 */
export declare const onFriendAddedTaskProgress: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * Daily login task trigger
 * This is called when user opens app (client-side via callable)
 */
export declare const recordDailyLogin: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Seed initial daily tasks (run once via admin or console)
 * This creates default task definitions
 */
export declare const seedDailyTasks: functions.HttpsFunction;
/**
 * Initialize wallet for existing users who don't have one
 * Run once via admin to migrate existing users
 */
export declare const initializeExistingWallets: functions.HttpsFunction;
/**
 * purchaseWithTokens: Callable function to purchase shop items
 * Performs atomic transaction:
 * 1. Validates item availability
 * 2. Validates user has enough tokens
 * 3. Validates user doesn't already own the item
 * 4. Deducts tokens from wallet
 * 5. Adds item to user's inventory
 * 6. Records the purchase
 * 7. Creates transaction record
 * 8. Updates item purchase count
 */
export declare const purchaseWithTokens: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Seed shop catalog with sample items (run once via admin)
 * Creates initial shop items for testing
 */
export declare const seedShopCatalog: functions.HttpsFunction;
/**
 * Rate-limited friend request creation
 * Validates rate limits server-side
 */
export declare const sendFriendRequestWithRateLimit: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Rate-limited message sending check
 * Called before sending messages to enforce limits
 */
export declare const checkMessageRateLimit: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Scheduled function to clean up expired push tokens
 * Runs daily to check for tokens that haven't been updated in 30 days
 */
export declare const cleanupExpiredPushTokens: functions.CloudFunction<unknown>;
/**
 * Admin: Set a ban on a user
 * Requires admin custom claim
 */
export declare const adminSetBan: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Admin: Lift a ban
 * Requires admin custom claim
 */
export declare const adminLiftBan: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Admin: Apply a strike to a user
 * Automatically applies bans based on strike thresholds
 */
export declare const adminApplyStrike: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Admin: Apply a warning to a user
 * Requires admin custom claim
 * Warnings are stored in UserWarnings collection and user is notified
 */
export declare const adminApplyWarning: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Admin: Resolve a report
 * Requires admin custom claim
 */
export declare const adminResolveReport: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Admin: Set admin claim on a user
 * Only callable by existing admins
 */
export declare const adminSetAdminClaim: functions.HttpsFunction & functions.Runnable<any>;
/**
 * HTTP endpoint to set the first admin (use once during setup)
 * Protected by a secret key from environment
 */
export declare const initializeFirstAdmin: functions.HttpsFunction;
/**
 * Trigger to log message events
 */
export declare const onNewMessageEvent: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * Trigger to log report events
 */
export declare const onNewReport: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * Scheduled function to update expired bans
 * Runs every hour to mark expired bans as inactive
 */
export declare const updateExpiredBans: functions.CloudFunction<unknown>;
