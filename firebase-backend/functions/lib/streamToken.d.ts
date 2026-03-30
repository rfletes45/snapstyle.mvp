/**
 * Stream Video Token Issuance
 *
 * Mints short-lived Stream Video user tokens from the secure backend.
 * The client calls this callable function to obtain a token for
 * initializing the Stream Video SDK.
 *
 * Environment variables required (set in firebase-backend/functions/.env):
 *   STREAM_API_KEY=your_key
 *   STREAM_API_SECRET=your_secret
 *
 * @module functions/streamToken
 */
import * as functions from "firebase-functions";
/**
 * Authenticated callable that returns a Stream Video user token.
 *
 * Request: (no data required)
 * Response: { token: string; apiKey: string }
 */
export declare const getStreamVideoToken: functions.HttpsFunction & functions.Runnable<any>;
