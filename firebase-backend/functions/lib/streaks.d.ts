/**
 * Streak Engine — Server-authoritative streak management.
 *
 * This is the SOLE authority for streak state. Clients must never write streak
 * fields; they only read the canonical values emitted here.
 *
 * PRODUCT DEFINITION
 * ──────────────────
 * - Streak type     : Friend-to-friend DM streak (per friendship).
 * - Qualifying act  : Both friends must each send ≥ 1 DM within a UTC calendar day.
 * - Day boundary    : UTC midnight (00:00 UTC).
 * - Streak count    : Number of consecutive UTC days where both friends sent a message.
 * - Streak start    : Begins at 1 on the first day both friends send.
 * - Streak continue : Increments by 1 for each consecutive day both friends send.
 * - Streak break    : If a full UTC day passes without both friends sending,
 *                     the streak resets on the next qualifying event. A 1-day
 *                     grace period auto-protects once every 30 days.
 * - Grace / protect : If the gap is exactly 2 days AND no grace was used in the
 *                     last 30 days, the streak survives (grace consumed).
 * - Offline / sync  : Because only the server writes streak state inside a
 *                     Firestore transaction, client timing is irrelevant.
 *
 * DATA MODEL (on `Friends/{id}` document)
 * ────────────────────────────────────────
 *   streakCount         : number   — current streak
 *   streakBestCount     : number   — all-time best for this pair
 *   streakUpdatedDay    : string   — YYYY-MM-DD (UTC) of last increment
 *   lastSentDay_uid1    : string   — YYYY-MM-DD (UTC), first UID in `users` array
 *   lastSentDay_uid2    : string   — YYYY-MM-DD (UTC), second UID in `users` array
 *   streakGraceUsedAt   : string   — YYYY-MM-DD (UTC), last date grace was consumed
 *
 * @module functions/streaks
 */
import * as functions from "firebase-functions";
/** UTC YYYY-MM-DD for right now. */
export declare function utcToday(): string;
/**
 * Update streak state after a DM is sent.
 *
 * MUST be called from a trusted server context (Cloud Function / Admin SDK).
 * Runs inside a Firestore transaction so concurrent sends cannot corrupt state.
 */
export declare function updateStreakOnMessage(senderId: string, recipientId: string): Promise<void>;
/**
 * Runs daily at 8 PM UTC.
 *   1. Sends "at risk" reminders to users who haven't sent today.
 *   2. Resets streaks where BOTH users missed a full day (gap > 1 from streakUpdatedDay).
 *      This prevents "zombie" streaks that display a stale count.
 */
export declare const streakReminder: functions.CloudFunction<unknown>;
