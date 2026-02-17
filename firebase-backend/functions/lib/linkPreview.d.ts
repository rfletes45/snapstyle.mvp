/**
 * Link Preview Cloud Function
 *
 * Fetches OpenGraph metadata from URLs server-side.
 * Results are cached in Firestore for 24 hours.
 */
import * as functions from "firebase-functions";
/**
 * Fetch link preview - Callable Cloud Function
 *
 * Fetches OpenGraph metadata from a URL server-side.
 * Results are cached in Firestore for 24 hours.
 *
 * @param url - URL to fetch preview for
 * @returns Link preview data or error
 */
export declare const fetchLinkPreviewFunction: functions.HttpsFunction & functions.Runnable<any>;
