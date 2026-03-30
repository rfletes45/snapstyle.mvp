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

import { StreamClient } from "@stream-io/node-sdk";
import * as functions from "firebase-functions";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getStreamConfig(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stream Video API key/secret not configured. Set STREAM_API_KEY and STREAM_API_SECRET in firebase-backend/functions/.env",
    );
  }
  return { apiKey, apiSecret };
}

// ---------------------------------------------------------------------------
// Callable: getStreamVideoToken
// ---------------------------------------------------------------------------

/**
 * Authenticated callable that returns a Stream Video user token.
 *
 * Request: (no data required)
 * Response: { token: string; apiKey: string }
 */
export const getStreamVideoToken = functions.https.onCall(
  async (_data, context) => {
    // Require authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to obtain a Stream Video token.",
      );
    }

    const userId = context.auth.uid;
    const { apiKey, apiSecret } = getStreamConfig();

    const client = new StreamClient(apiKey, apiSecret);

    // Token valid for 24 hours (Stream default expiry is fine for most cases)
    const validity = 60 * 60 * 24; // seconds
    const token = client.generateUserToken({
      user_id: userId,
      validity_in_seconds: validity,
    });

    return { token, apiKey };
  },
);
