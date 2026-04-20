/**
 * Contacts Cloud Functions
 *
 * Privacy-conscious contact sync & recommendation pipeline:
 * - syncContacts: Upload normalized identifiers, match against app users,
 *   store hashed identifiers, record reciprocal relationships.
 * - getContactRecommendations: Ranked recommendations with explanation tags.
 * - removeSyncedContacts: Delete all synced contact data for a user.
 * - updateContactDiscoverySettings: Privacy toggle persistence.
 * - matchContacts: Legacy callable for quick client-side matching.
 *
 * Data model:
 *   Users/{uid}.contactDiscovery        — settings & sync metadata
 *   Users/{uid}/syncedContactHashes/{h} — hashed contact identifiers
 *   Users/{uid}/contactedBy/{otherUid}  — reverse index (who has me)
 *
 * @module functions/contacts
 */
import * as functions from "firebase-functions";
export declare const syncContacts: functions.HttpsFunction & functions.Runnable<any>;
export declare const getContactRecommendations: functions.HttpsFunction & functions.Runnable<any>;
export declare const removeSyncedContacts: functions.HttpsFunction & functions.Runnable<any>;
export declare const updateContactDiscoverySettings: functions.HttpsFunction & functions.Runnable<any>;
export declare const matchContacts: functions.HttpsFunction & functions.Runnable<any>;
