/**
 * Message Requests Cloud Functions (Segment 5)
 *
 * Enforces the recipient's `dmAcceptance` setting when a non-friend
 * sends a DM for the first time.
 *
 * Flow:
 *  1. `checkDmAcceptance()` is called from sendMessageV2 before write.
 *  2. If the recipient allows everyone → pass.
 *  3. If the recipient requires friends-only or requests:
 *     a. Check the Friends collection for a friendship doc.
 *     b. If friends → pass.
 *     c. If friends_only → reject ("This user isn't accepting DMs").
 *     d. If requests → create a MessageRequest doc and return "request_created".
 *  4. `acceptMessageRequest` callable → sets status to "accepted", allows
 *     future messages.
 *  5. `declineMessageRequest` callable → sets status to "declined", optionally
 *     blocks the requester.
 *
 * @module functions/messageRequests
 */
import * as functions from "firebase-functions";
export type DmAcceptanceResult = {
    outcome: "allowed";
} | {
    outcome: "request_created";
} | {
    outcome: "rejected";
    reason: string;
};
/**
 * Pre-send check for DM conversations.
 *
 * Called from `sendMessageV2` after membership + block checks.
 *
 * @returns outcome "allowed" | "request_created" | "rejected"
 */
export declare function checkDmAcceptance(senderId: string, recipientUid: string, chatId: string, messagePreview: string, messageKind: string): Promise<DmAcceptanceResult>;
/**
 * Accept a pending DM message request.
 *
 * Sets the request status to "accepted" so future messages
 * from the requester bypass the gating check.
 */
export declare const acceptMessageRequest: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Decline a pending DM message request.
 *
 * Optionally blocks the requester.
 */
export declare const declineMessageRequest: functions.HttpsFunction & functions.Runnable<any>;
