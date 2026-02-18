/**
 * Privacy-Enforced Publish APIs (Segment 7)
 *
 * Server-side callables that replace direct client Firestore writes for:
 * - typingAt
 * - lastDeliveredAtPublic
 * - lastReadAtPublic
 *
 * Each callable:
 * 1. Validates auth + membership
 * 2. Loads effective settings via server-side resolver
 * 3. If disabled by user's privacy settings → no-op success
 *    (does NOT reveal privacy choices to the other party)
 * 4. If enabled → writes to the Members doc
 *
 * Also contains a Firestore trigger that mirrors user privacy settings
 * to RTDB `/statusVisibility/{uid}` for presence privacy.
 *
 * @module functions/privacyPublish
 */
import * as functions from "firebase-functions";
/**
 * Publish a typing indicator for the calling user.
 *
 * Input: { scope, conversationId, typingAt: number | null }
 *   - typingAt = Date.now()  → user is typing
 *   - typingAt = null        → user stopped typing (deletes field)
 *
 * Behavior:
 *   - If privacy settings disable typing → no-op success
 *   - If feature not enabled → no-op success
 */
export declare const publishTypingIndicator: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Publish a delivery receipt (lastDeliveredAtPublic watermark).
 *
 * Input: { scope, conversationId, lastDeliveredAt: number }
 *
 * Behavior:
 *   - Validates monotonic increase (new timestamp >= existing)
 *   - If privacy settings disable delivery receipts → no-op success
 */
export declare const publishDeliveryReceipt: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Publish a read receipt (lastReadAtPublic watermark).
 *
 * Input: { scope, conversationId, lastReadAt: number }
 *
 * Behavior:
 *   - Validates monotonic increase
 *   - If privacy settings disable read receipts → no-op success
 *   - Always updates private lastSeenAtPrivate (for unread badge)
 *     regardless of public receipt setting
 */
export declare const publishReadReceipt: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Firestore trigger: when user's chat settings change, mirror privacy
 * flags to RTDB at `/statusVisibility/{uid}`.
 *
 * This is necessary because RTDB security rules cannot read Firestore
 * documents. By mirroring the relevant flags, client-side presence
 * publishers can be validated (or at least audited) against RTDB rules.
 *
 * Trigger paths:
 *   - Users/{uid}/settings/chatSettings
 *   - Users/{uid}/settings/inbox (legacy)
 *
 * RTDB shape:
 *   /statusVisibility/{uid} = {
 *     onlineAllowed: boolean,
 *     lastSeenAllowed: boolean,
 *     updatedAt: number
 *   }
 */
export declare const onChatSettingsChanged: functions.CloudFunction<functions.Change<functions.firestore.DocumentSnapshot>>;
/**
 * Legacy inbox settings trigger — same mirror logic for users who
 * haven't migrated to chatSettings V3.
 */
export declare const onInboxSettingsChanged: functions.CloudFunction<functions.Change<functions.firestore.DocumentSnapshot>>;
