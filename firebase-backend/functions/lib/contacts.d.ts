/**
 * Contacts Matching Cloud Function
 *
 * Accepts normalized contact identifiers (phones/emails) and returns
 * categorized match results. Privacy-conscious:
 * - Requires authentication
 * - Respects user discoverability settings
 * - Rate-limited
 * - Never returns raw contact data to other users
 *
 * @module functions/contacts
 */
import * as functions from "firebase-functions";
/**
 * matchContacts — Callable function for contact-based friend discovery.
 *
 * Input: { phones: string[], emails: string[] }
 * Output: { onAppUsers, alreadyFriendUids, pendingSentUids, pendingReceivedUids }
 */
export declare const matchContacts: functions.HttpsFunction & functions.Runnable<any>;
