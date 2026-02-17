/**
 * Validate that a string is safe (non-empty, reasonable length, no control chars)
 */
export declare function isValidString(value: unknown, minLen?: number, maxLen?: number): value is string;
/**
 * Validate that a value is a valid Firebase UID
 */
export declare function isValidUid(value: unknown): value is string;
/**
 * Sanitize string for logging (truncate, remove newlines)
 */
export declare function sanitizeForLog(value: string, maxLen?: number): string;
export interface ExpoPushMessage {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: "default" | null;
    badge?: number;
}
/**
 * Send push notification via Expo's push service
 */
export declare function sendExpoPushNotification(message: ExpoPushMessage): Promise<void>;
/**
 * Get user's Expo Push Token from Firestore
 */
export declare function getUserPushToken(userId: string): Promise<string | null>;
/**
 * Check if user has muted a DM chat
 * Uses the MembersPrivate subcollection of Chats
 */
export declare function isDmChatMuted(chatId: string, userId: string): Promise<boolean>;
/**
 * Check if user has muted a Group chat
 * Uses GroupMembers collection with mute settings
 */
export declare function isGroupChatMuted(groupId: string, userId: string): Promise<boolean>;
export declare const isGroupMuted: typeof isGroupChatMuted;
