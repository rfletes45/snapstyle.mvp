import { createServerLogger } from "../utils/logger";
const log = createServerLogger("firebase");

/**
 * Firebase Admin SDK Service
 *
 * Initializes Firebase Admin for:
 * 1. Auth token verification (onAuth in rooms)
 * 2. Firestore persistence (save/restore turn-based games)
 * 3. Game result recording
 *
 * Supports three initialization methods (tried in order):
 *   a) serviceAccountKey.json file (FIREBASE_SERVICE_ACCOUNT_PATH env var)
 *   b) Inline JSON credentials (FIREBASE_SERVICE_ACCOUNT_JSON env var)
 *   c) Application Default Credentials (GCP hosted environments)
 *
 * When none are available (local dev), falls back to unverified JWT decoding
 * to extract real Firebase UIDs from client tokens.
 */

import {
  App,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { DecodedIdToken, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import path from "path";

let app: App;
let db: Firestore;
let firebaseInitialized = false;

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize Firebase Admin SDK.
 * Called once at server startup from app.config.ts.
 *
 * Tries these methods in order:
 * 1. Service account key file (FIREBASE_SERVICE_ACCOUNT_PATH or ./serviceAccountKey.json)
 * 2. Inline JSON credentials (FIREBASE_SERVICE_ACCOUNT_JSON env var â€” ideal for
 *    deployment platforms like Heroku, Railway, Render where you can set env vars
 *    but can't upload files)
 * 3. Application Default Credentials (works automatically on GCP / Firebase Hosting)
 */
export function initializeFirebaseAdmin(): void {
  if (getApps().length > 0) {
    app = getApps()[0];
    db = getFirestore(app);
    firebaseInitialized = true;
    return;
  }

  // Method 1: Service account key file
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json";

  try {
    const resolvedPath = path.resolve(serviceAccountPath);
    app = initializeApp({
      credential: cert(require(resolvedPath)),
    });
    db = getFirestore(app);
    firebaseInitialized = true;
    log.info(
      "[Firebase] Admin SDK initialized via service account key file",
    );
    return;
  } catch {
    // File not found or invalid â€” try next method
  }

  // Method 2: Inline JSON credentials via env var
  // Set FIREBASE_SERVICE_ACCOUNT_JSON to the full JSON content of the service account key.
  // This avoids needing to manage a separate file â€” just paste the JSON into your env config.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      );
      app = initializeApp({
        credential: cert(serviceAccount),
      });
      db = getFirestore(app);
      firebaseInitialized = true;
      log.info(
        "[Firebase] Admin SDK initialized via FIREBASE_SERVICE_ACCOUNT_JSON env var",
      );
      return;
    } catch (error) {
      log.warn(
        "[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Method 3: Application Default Credentials (ADC)
  // Works automatically on GCP (Cloud Run, App Engine, etc.) and when
  // GOOGLE_APPLICATION_CREDENTIALS env var is set to a key file path.
  try {
    app = initializeApp({
      credential: applicationDefault(),
    });
    db = getFirestore(app);
    firebaseInitialized = true;
    log.info(
      "[Firebase] Admin SDK initialized via Application Default Credentials",
    );
    return;
  } catch {
    // ADC not available â€” proceed without Firebase
  }

  // No method worked
  firebaseInitialized = false;
  log.warn("[Firebase] Admin SDK not available â€” no credentials found.");
  log.warn("[Firebase] To fix, use ONE of these methods:");
  log.warn("  1. Place serviceAccountKey.json in colyseus-server/");
  log.warn(
    "  2. Set FIREBASE_SERVICE_ACCOUNT_JSON env var to the key file's JSON content",
  );
  log.warn(
    "  3. Set GOOGLE_APPLICATION_CREDENTIALS env var to the key file path",
  );
  log.warn(
    "[Firebase] Running without Firebase â€” auth will use dev-mode JWT decode, persistence disabled",
  );
}

// =============================================================================
// Auth â€” Token Verification
// =============================================================================

/**
 * Verify a Firebase ID token from a client.
 * Used in room onAuth() to authenticate players.
 *
 * @param token - Firebase ID token string
 * @returns Decoded token with uid, name, email, picture
 * @throws Error if token is invalid or expired
 */
export async function verifyFirebaseToken(
  token: string,
): Promise<DecodedIdToken> {
  if (!token) {
    throw new Error("No auth token provided");
  }

  // If Firebase Admin is not available, fall back to dev-mode mock auth.
  // This happens when serviceAccountKey.json is missing (typical in local dev).
  if (!firebaseInitialized || !app) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Firebase Admin not initialized â€” cannot verify tokens in production",
      );
    }

    // In dev mode, decode the JWT payload WITHOUT verification to extract
    // the real uid/name/email so game associations still work correctly.
    log.warn(
      "[Firebase] No Admin SDK â€” using unverified token decode (dev mode)",
    );
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf-8"),
        );
        if (payload.user_id || payload.sub) {
          return {
            uid: payload.user_id || payload.sub,
            name: payload.name || payload.email || "Dev Player",
            email: payload.email || "dev@test.com",
            picture: payload.picture || "",
          } as unknown as DecodedIdToken;
        }
      }
    } catch {
      // Token is not a valid JWT â€” fall through to static mock
    }

    return {
      uid: `dev_${Date.now()}`,
      name: "Dev Player",
      email: "dev@test.com",
      picture: "",
    } as unknown as DecodedIdToken;
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    throw new Error(`Invalid auth token: ${(error as Error).message}`);
  }
}

// =============================================================================
// Firestore Access
// =============================================================================

/**
 * Get the Firestore instance.
 * Returns null if Firebase is not initialized (dev mode).
 */
export function getFirestoreDb(): Firestore | null {
  return db || null;
}


