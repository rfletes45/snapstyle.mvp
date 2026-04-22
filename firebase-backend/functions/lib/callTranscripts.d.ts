/**
 * Call Transcript Pipeline — backend.
 *
 * Privacy-first, app-owned transcript handling:
 *
 *   1. `call.transcription_ready` arrives from Stream → we immediately
 *      download the transcript bytes and **re-host** them in an app-owned
 *      Cloud Storage object (`call-transcripts/{callId}__{sessionId}.json`).
 *      We then store only the `storagePath` in Firestore — Stream-managed
 *      URLs are NEVER persisted and NEVER returned to clients.
 *   2. `getCallTranscript` returns a short-lived v4-signed URL to the
 *      app-owned blob (15 min TTL).
 *   3. On ACK from every participant we delete the Storage object AND
 *      tombstone the Firestore row.
 *   4. Scheduled cleanup enforces the 2-day hard deadline and closes
 *      loops for failed deletes / orphaned index rows.
 *
 * Eligibility is enforced at three layers (client, webhook, callable):
 * only direct 1:1 audio calls ever produce a transcript record.
 *
 * Backward compatibility:
 *   Pre-rehost rows (`source:"stream_fallback"` + `downloadUrl`) are still
 *   served as-is until they expire. All new rows use `source:"external"` +
 *   `storagePath`.
 */
import * as functions from "firebase-functions";
export declare function handleTranscriptionWebhookEvent(event: any): Promise<{
    ok: boolean;
    reason: string;
}>;
export declare const streamTranscriptionWebhook: functions.HttpsFunction;
/**
 * Resolve whether the caller + callee pair can transcribe together.
 * Reads both users' call-settings docs and ANDs the flags.
 * Fails closed on any error.
 */
export declare const getCallTranscriptPolicy: functions.HttpsFunction & functions.Runnable<any>;
export declare const getCallTranscript: functions.HttpsFunction & functions.Runnable<any>;
/**
 * App ACKs that it persisted the transcript locally. We record this uid's
 * ack; once every participant has ACKed we hard-delete the server copy
 * immediately. Otherwise the scheduled cleanup picks it up by the 2-day
 * deadline.
 */
export declare const ackCallTranscript: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Runs every 6 hours. Finds any non-deleted transcripts whose
 * serverExpiresAt has passed and hard-deletes them. We intentionally do
 * NOT rely solely on Firestore TTL — TTL is best-effort and not a privacy
 * contract. This explicit pass is the enforcement.
 */
export declare const cleanupExpiredCallTranscripts: functions.CloudFunction<unknown>;
