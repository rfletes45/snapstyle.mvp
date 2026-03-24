/**
 * Stream Call History — Server-side recording via Stream webhooks.
 *
 * Stream sends webhook events for call lifecycle. This function receives
 * `call.session_ended` events and records normalized history entries in
 * each participant's `StreamCallHistory` subcollection.
 *
 * Webhook URL: https://<region>-<project>.cloudfunctions.net/streamCallWebhook
 * Configure in Stream Dashboard → Webhooks → call.session_ended
 */
import * as functions from "firebase-functions";
export declare const streamCallWebhook: functions.HttpsFunction;
