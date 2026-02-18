/**
 * Inbox Trigger Cloud Functions (Segment 4)
 *
 * Firestore triggers that maintain per-user inbox aggregation docs
 * under Users/{uid}/Inbox/{threadId}.
 *
 * Thread ID format:
 *   - DMs:    "dm:{chatId}"
 *   - Groups: "group:{groupId}"
 *
 * These are activated automatically on message creation. The client
 * feature flag CHAT_INBOX_AGGREGATION controls whether the *client*
 * reads from this collection; the server always writes.
 *
 * @module functions/inboxTriggers
 */
import * as functions from "firebase-functions";
/**
 * On new DM message → update both participants' inbox entries.
 *
 * Each participant gets an inbox doc at:
 *   Users/{uid}/Inbox/dm:{chatId}
 *
 * For the sender: lastActivityAt is updated but unreadCount is NOT incremented.
 * For the recipient: lastActivityAt updated AND unreadCount incremented.
 */
export declare const onDMMessageInbox: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * On new group message → update every member's inbox entry.
 *
 * Each member gets an inbox doc at:
 *   Users/{uid}/Inbox/group:{groupId}
 *
 * Sender gets unreadCount reset; other members get increment.
 */
export declare const onGroupMessageInbox: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * Callable to reset a user's unread count for a conversation.
 * Called when the user opens / views a chat.
 */
export declare const markInboxRead: functions.HttpsFunction & functions.Runnable<any>;
