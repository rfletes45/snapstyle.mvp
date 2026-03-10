/**
 * Firebase Bridge — writes realtime resolution requests into Firestore
 *
 * The Colyseus server calls this when a match ends so the result
 * flows through the normal V4 resolution pipeline (PB, leaderboard,
 * achievements, XP, notifications).
 *
 * In local development, when Firebase credentials are unavailable,
 * the bridge operates in dev bypass mode: auth is trust-based and
 * Firestore writes are logged but skipped.
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// ── Config ──────────────────────────────────────────────────────────
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "gamerapp-37e70";

// ── Dev bypass detection ────────────────────────────────────────────
let _devBypass: boolean | null = null;
let _devBypassLogged = false;

/**
 * Check whether Google Application Default Credentials are actually
 * available on this machine. `admin.credential.applicationDefault()`
 * does NOT throw synchronously — it returns a lazy credential that
 * only fails at gRPC time. So we check the concrete indicators:
 *   1. GOOGLE_APPLICATION_CREDENTIALS env var pointing to an existing file
 *   2. The well-known ADC file written by `gcloud auth application-default login`
 */
function hasGoogleCredentials(): boolean {
  // 1. Explicit service-account key file
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) return true;

  // 2. Well-known ADC file
  const home =
    process.env.APPDATA ?? // Windows
    process.env.HOME; // macOS / Linux
  if (home) {
    const wellKnown = process.env.APPDATA
      ? path.join(home, "gcloud", "application_default_credentials.json")
      : path.join(
          home,
          ".config",
          "gcloud",
          "application_default_credentials.json",
        );
    if (fs.existsSync(wellKnown)) return true;
  }

  return false;
}

/**
 * Returns true when Firebase credentials are unavailable.
 * The server continues to function with trust-based auth and
 * no Firestore writes. Safe only for local development.
 */
export function isDevBypass(): boolean {
  if (_devBypass !== null) return _devBypass;

  // Explicit env var overrides detection
  if (process.env.COLYSEUS_DEV_BYPASS === "1") {
    _devBypass = true;
  } else if (process.env.COLYSEUS_DEV_BYPASS === "0") {
    _devBypass = false;
  } else {
    // Auto-detect using concrete file checks
    _devBypass = !hasGoogleCredentials();
  }

  if (_devBypass && !_devBypassLogged) {
    _devBypassLogged = true;
    console.warn(
      "[FirebaseBridge] ⚠️  DEV BYPASS active — no Firebase credentials found.\n" +
        "  Auth will trust client-provided UIDs. Firestore writes are skipped.\n" +
        "  To use real Firebase, set GOOGLE_APPLICATION_CREDENTIALS or run:\n" +
        "    gcloud auth application-default login",
    );
  }

  return _devBypass;
}

// ── Initialise once ─────────────────────────────────────────────────
let initialised = false;

function ensureInit() {
  if (initialised) return;

  if (isDevBypass()) {
    // Initialise without credentials — Firestore calls will be guarded
    // by isDevBypass() checks at call sites.
    try {
      admin.initializeApp({ projectId: PROJECT_ID });
    } catch {
      // Already initialised by another path
    }
    initialised = true;
    return;
  }

  let credential: admin.credential.Credential | undefined;
  try {
    credential = admin.credential.applicationDefault();
  } catch {
    credential = undefined;
  }

  admin.initializeApp({
    ...(credential ? { credential } : {}),
    projectId: PROJECT_ID,
  });
  initialised = true;
}

export function getFirebaseDb(): FirebaseFirestore.Firestore {
  ensureInit();
  return admin.firestore();
}

export async function verifyFirebaseToken(
  token: string,
): Promise<admin.auth.DecodedIdToken> {
  ensureInit();
  return admin.auth().verifyIdToken(token);
}

// ── Public API ──────────────────────────────────────────────────────

export interface ScoreboardEntry {
  uid: string;
  displayName: string;
  score: number;
  placement: number;
  stats: Record<string, unknown>;
}

/**
 * Resolve a realtime session through the V4 pipeline by writing the
 * trigger document consumed by `onRealtimeResolutionRequest`.
 */
export async function resolveRealtimeSessionV4(
  sessionId: string,
  resolutionType: string,
  winnerIds: string[],
  scoreboard: ScoreboardEntry[],
): Promise<void> {
  if (isDevBypass()) {
    console.log(
      `[FirebaseBridge] DEV BYPASS — skipping resolution write for session ${sessionId} (${resolutionType}, winners=${JSON.stringify(winnerIds)})`,
    );
    return;
  }

  const db = getFirebaseDb();

  // Write the resolution request doc — a Cloud Function trigger picks it up
  await db
    .collection("GameSessionsV4")
    .doc(sessionId)
    .collection("internal")
    .doc("realtimeResolution")
    .set({
      resolutionType,
      winnerIds,
      scoreboard,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  console.log(
    `[FirebaseBridge] Wrote resolution request for session ${sessionId} (${resolutionType})`,
  );
}
