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
import * as admin from "firebase-admin";
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

let _streamClient: StreamClient | null = null;
function getStreamClient(): StreamClient {
  if (!_streamClient) {
    const { apiKey, apiSecret } = getStreamConfig();
    _streamClient = new StreamClient(apiKey, apiSecret);
  }
  return _streamClient;
}

// ---------------------------------------------------------------------------
// Callable: getStreamVideoToken
// ---------------------------------------------------------------------------

/**
 * Authenticated callable that returns a Stream Video user token.
 * Also upserts the authenticated user in Stream so they are guaranteed
 * to exist before any call operations.
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
    const { apiKey } = getStreamConfig();
    const client = getStreamClient();

    // Upsert the authenticated user in Stream so they exist for call operations.
    // This is idempotent — safe to call on every token fetch.
    // Prefer Firestore profile data (displayName, avatarUrl) over Firebase Auth
    // token claims, because Auth claims are often null even when the app has
    // a rich user profile in Firestore.
    try {
      let name: string | undefined = context.auth.token.name || undefined;
      let image: string | undefined = context.auth.token.picture || undefined;

      // Fall back to Firestore profile when Auth token lacks name/image
      if (!name || !image) {
        try {
          const userDoc = await admin
            .firestore()
            .collection("Users")
            .doc(userId)
            .get();
          if (userDoc.exists) {
            const data = userDoc.data()!;
            if (!name) {
              name = data.displayName || data.username || undefined;
            }
            if (!image) {
              // Profile picture is stored as { url, thumbnailUrl, updatedAt }
              image =
                data.profilePicture?.url ||
                data.profilePicture?.thumbnailUrl ||
                undefined;
            }
          }
        } catch (profileErr) {
          // Non-fatal — proceed with whatever we have
          functions.logger.warn(
            `[getStreamVideoToken] Firestore profile lookup failed for ${userId}:`,
            profileErr,
          );
        }
      }

      await client.upsertUsers([
        {
          id: userId,
          name: name,
          image: image,
        },
      ]);
    } catch (err) {
      // Log but don't fail — user may already exist, and token is still valid
      functions.logger.warn(
        `[getStreamVideoToken] Failed to upsert user ${userId} in Stream:`,
        err,
      );
    }

    // Token valid for 24 hours
    const validity = 60 * 60 * 24; // seconds
    const token = client.generateUserToken({
      user_id: userId,
      validity_in_seconds: validity,
    });

    return { token, apiKey };
  },
);

// ---------------------------------------------------------------------------
// Callable: ensureStreamUsers
// ---------------------------------------------------------------------------

/**
 * Ensures that a list of user IDs exist in Stream Video.
 * Called by the client before creating a call to guarantee all members exist.
 *
 * Request: { userIds: string[] }
 * Response: { provisioned: number }
 */
export const ensureStreamUsers = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in.",
      );
    }

    const userIds: string[] = data?.userIds;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "userIds must be a non-empty array of strings.",
      );
    }

    // Limit batch size to prevent abuse
    if (userIds.length > 25) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Maximum 25 users per request.",
      );
    }

    // Validate all IDs are strings
    for (const id of userIds) {
      if (typeof id !== "string" || id.trim().length === 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Invalid user ID: ${id}`,
        );
      }
    }

    const client = getStreamClient();
    const db = admin.firestore();

    // Look up user profiles from Firestore to populate name/image
    const usersToUpsert: Array<{ id: string; name?: string; image?: string }> =
      [];

    const userDocs = await Promise.allSettled(
      userIds.map((uid) => db.collection("Users").doc(uid).get()),
    );

    for (let i = 0; i < userIds.length; i++) {
      const uid = userIds[i];
      const result = userDocs[i];
      if (result.status === "fulfilled" && result.value.exists) {
        const data = result.value.data()!;
        usersToUpsert.push({
          id: uid,
          name: data.displayName || data.username || undefined,
          // Profile picture is stored as { url, thumbnailUrl, updatedAt }
          image:
            data.profilePicture?.url ||
            data.profilePicture?.thumbnailUrl ||
            undefined,
        });
      } else {
        // User doc not found — still upsert with just the ID so Stream knows about them
        usersToUpsert.push({ id: uid });
      }
    }

    try {
      await client.upsertUsers(usersToUpsert);
    } catch (err) {
      functions.logger.error(
        `[ensureStreamUsers] Failed to upsert users:`,
        err,
      );
      throw new functions.https.HttpsError(
        "internal",
        "Failed to provision Stream users.",
      );
    }

    return { provisioned: usersToUpsert.length };
  },
);
