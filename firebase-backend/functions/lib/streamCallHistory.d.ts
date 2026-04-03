/**
 * Stream Call History webhook.
 *
 * Persists server-authored call history to `Users/{uid}/StreamCallHistory/*`.
 *
 * Handled events:
 * - `call.session_ended` for completed direct calls and voice-room sessions
 * - `call.rejected` for declined / canceled / timed-out ringing calls
 * - `call.missed` for missed incoming ringing calls
 */
import * as functions from "firebase-functions";
export declare const streamCallWebhook: functions.HttpsFunction;
