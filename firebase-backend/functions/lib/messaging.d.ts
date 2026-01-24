/**
 * Messaging V2 Cloud Functions
 *
 * Server-side message handling with:
 * - Idempotent message creation
 * - Server-authoritative timestamps
 * - Block/rate limit enforcement
 * - Membership validation
 *
 * @module functions/messaging
 */
import * as functions from "firebase-functions";
/**
 * Idempotent message creation with server-authoritative timestamp
 *
 * Key features:
 * 1. Uses messageId as document ID for idempotency
 * 2. Sets serverReceivedAt on server (not client-editable)
 * 3. Validates membership before write
 * 4. Checks block status for DMs
 * 5. Enforces rate limits
 */
export declare const sendMessageV2: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Edit a message (sender only, within edit window)
 *
 * Rules:
 * - Only sender can edit
 * - Must be within 15-minute window
 * - Only text field can change
 * - Cannot edit deleted messages
 */
export declare const editMessageV2: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Delete a message for all participants
 *
 * Rules:
 * - Sender can delete within edit window
 * - Group admins/mods can delete any message
 * - Sets deletedForAll marker
 * - Clears text and attachments
 */
export declare const deleteMessageForAllV2: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Toggle a reaction on a message
 *
 * Features:
 * - Adds reaction if user hasn't reacted with this emoji
 * - Removes reaction if user already reacted with this emoji
 * - Updates Reactions subcollection per emoji
 * - Denormalizes summary on message document
 * - Rate limited (10/minute)
 * - Max 12 unique emojis per message
 */
export declare const toggleReactionV2: functions.HttpsFunction & functions.Runnable<any>;
export { deleteMessageForAllV2 as deleteMessageForAllV2Function, editMessageV2 as editMessageV2Function, sendMessageV2 as sendMessageV2Function, toggleReactionV2 as toggleReactionV2Function, };
