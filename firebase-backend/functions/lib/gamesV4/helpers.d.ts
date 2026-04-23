/**
 * Games V4 — Shared Backend Helpers
 *
 * Utility functions used across all V4 Cloud Functions:
 * auth assertions, membership checks, pinning, ID generation.
 *
 * @module gamesV4/helpers
 */
import * as functions from "firebase-functions";
export declare function getDb(): FirebaseFirestore.Firestore;
/**
 * Assert the caller is authenticated, returning their UID.
 * Throws `unauthenticated` HttpsError if not.
 */
export declare function assertAuth(context: functions.https.CallableContext): string;
/**
 * Check if a user is a member of a conversation (DM or group).
 */
export declare function isConversationMember(uid: string, conversationId: string, scope: "dm" | "group"): Promise<boolean>;
/**
 * Assert the caller is a member of the conversation.
 * Throws `permission-denied` if not.
 */
export declare function assertConversationMember(uid: string, conversationId: string, scope: "dm" | "group"): Promise<void>;
/**
 * Get all member UIDs for a conversation.
 */
export declare function getConversationMemberIds(conversationId: string, scope: "dm" | "group"): Promise<string[]>;
/**
 * Pin an invite ID to the conversation's pinnedGameInviteIds array.
 * Respects MAX_PINNED_INVITES — oldest are evicted (FIFO) if at capacity.
 */
export declare function pinInviteToConversation(conversationId: string, scope: "dm" | "group", inviteId: string): Promise<void>;
/**
 * Unpin an invite ID from the conversation.
 */
export declare function unpinInviteFromConversation(conversationId: string, scope: "dm" | "group", inviteId: string): Promise<void>;
/** Generate a random trace ID for debugging. */
export declare function generateTraceId(): string;
/** Server timestamp shorthand. */
export declare function serverTimestamp(): FirebaseFirestore.FieldValue;
/** Current epoch millis. */
export declare function nowMs(): number;
export interface MinimalProfile {
    displayName: string;
    avatarConfig?: Record<string, unknown>;
    profilePictureUrl?: string | null;
    decorationId?: string | null;
}
/**
 * Fetch minimal profile data for a user.
 */
export declare function getUserProfile(uid: string): Promise<MinimalProfile | null>;
/**
 * Compute an integrity hash for PB anti-forgery.
 */
export declare function computeIntegrityHash(uid: string, gameId: string, pbValue: number, sessionId: string | null): string;
/**
 * Compute a weekly leaderboard key: "YYYY-Wnn" (ISO week).
 */
export declare function currentWeekKey(): string;
