/**
 * Stream Video Token Issuance & User Provisioning
 *
 * Mints short-lived Stream Video user tokens from the secure backend.
 * Also upserts the calling user in Stream so they exist before any call
 * operation, and provides an endpoint to ensure call members exist.
 *
 * Environment variables required (set in firebase-backend/functions/.env):
 *   STREAM_API_KEY=your_key
 *   STREAM_API_SECRET=your_secret
 *
 * @module functions/streamToken
 */
import { StreamClient } from "@stream-io/node-sdk";
import * as functions from "firebase-functions";
export declare function getStreamClient(): StreamClient;
/**
 * Authenticated callable that returns a Stream Video user token.
 * Also upserts the authenticated user in Stream so they are guaranteed
 * to exist before any call operations.
 *
 * Request: (no data required)
 * Response: { token: string; apiKey: string }
 */
export declare const getStreamVideoToken: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Ensures that a list of user IDs exist in Stream Video.
 * Called by the client before creating a call to guarantee all members exist.
 *
 * Request: { userIds: string[] }
 * Response: { provisioned: number }
 */
export declare const ensureStreamUsers: functions.HttpsFunction & functions.Runnable<any>;
