/**
 * profileViews — Server-authoritative profile view counter.
 *
 * Instead of letting clients write directly to another user's profile doc,
 * this callable increments `profileViews` via the admin SDK and deduplicates
 * per viewer/target pair within a 24-hour window.
 *
 * @module functions/profileViews
 */
import * as functions from "firebase-functions";
/**
 * Callable: incrementProfileViews
 *
 * Input: { targetUid: string }
 * - Auth required
 * - Cannot view own profile
 * - Deduplicates per viewer per target within 24h
 * - Increments Users/{targetUid}.profileViews via admin SDK
 */
export declare const incrementProfileViews: functions.HttpsFunction & functions.Runnable<any>;
