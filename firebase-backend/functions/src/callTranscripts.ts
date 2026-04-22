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

import * as crypto from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Hard max server-side retention (privacy rule: ≤ 2 days regardless of SDK policy). */
const SERVER_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

/** Short TTL signed URL for the app-owned transcript blob. */
const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

const COLLECTION = "CallTranscripts";
const STORAGE_PREFIX = "call-transcripts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TranscriptStatus =
  | "processing"
  | "ready"
  | "expired"
  | "deleted"
  | "failed";

interface TranscriptDoc {
  callId: string;
  sessionId: string;
  /** Participants who are allowed to fetch this transcript (uid list). */
  participants: string[];
  /** `{ uid: ackedAtMs }` — when every participant has ACKed, we hard-delete. */
  acks: Record<string, number>;
  status: TranscriptStatus;
  /**
   *  - "external": app-owned Cloud Storage object at `storagePath` (default, production path).
   *  - "stream_fallback": legacy rows only — never written by new code.
   */
  source: "external" | "stream_fallback";
  /** App-owned Cloud Storage object path (new production path). */
  storagePath: string | null;
  /** LEGACY only: Stream-managed URL on pre-rehost rows. Not populated by new code. */
  downloadUrl: string | null;
  /** Unix ms — hard deletion deadline. */
  serverExpiresAt: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  /** Stream-specific metadata (call type, etc.) for diagnostics. */
  streamMeta: {
    callType: string | null;
    createdBy: string | null;
    mode: "audio" | "video" | null;
  };
  lastError: string | null;
}

// ---------------------------------------------------------------------------
// Webhook signature verification (shared with streamCallWebhook)
// ---------------------------------------------------------------------------

function verifyStreamSignature(req: functions.https.Request): boolean {
  const apiSecret = process.env.STREAM_API_SECRET;
  const signature = req.headers["x-signature"] as string | undefined;
  if (!apiSecret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", apiSecret)
    .update(req.rawBody)
    .digest("hex");
  return signature === expected;
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * Only direct 1:1 audio calls are transcript-eligible on the server.
 * Mirrors the client policy to fail closed at every layer.
 */
function isTranscriptEligible(call: any): {
  eligible: boolean;
  reason: string;
} {
  if (!call) return { eligible: false, reason: "no_call" };
  if (
    (typeof call.id === "string" && call.id.startsWith("voice_channel_")) ||
    Boolean(call.custom?.groupId || call.custom?.groupName)
  ) {
    return { eligible: false, reason: "voice_room" };
  }
  const mode = call.custom?.mode;
  if (mode !== "audio") {
    return { eligible: false, reason: "not_audio" };
  }
  const members: any[] = Array.isArray(call.members) ? call.members : [];
  if (members.length !== 2) {
    return { eligible: false, reason: "not_direct" };
  }
  return { eligible: true, reason: "ok" };
}

function participantUidsFromCall(call: any): string[] {
  const members: any[] = Array.isArray(call.members) ? call.members : [];
  return members
    .map((m) => m?.user_id ?? m?.user?.id ?? m?.id)
    .filter((uid: unknown): uid is string => typeof uid === "string");
}

// ---------------------------------------------------------------------------
// App-owned Storage helpers
// ---------------------------------------------------------------------------

function bucket() {
  return admin.storage().bucket();
}

function storagePathFor(callId: string, sessionId: string): string {
  return `${STORAGE_PREFIX}/${callId}__${sessionId}.json`;
}

/**
 * Download the transcript bytes from Stream's temporary signed URL and
 * upload them to our app-owned bucket. The Stream URL is NEVER persisted.
 */
async function rehostTranscriptToAppStorage(
  streamUrl: string,
  callId: string,
  sessionId: string,
): Promise<{ storagePath: string; bytes: number } | null> {
  try {
    // Node 20+ runtime has global fetch.
    const resp = await fetch(streamUrl);
    if (!resp.ok) throw new Error(`stream_fetch_${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0) throw new Error("empty_payload");
    const path = storagePathFor(callId, sessionId);
    await bucket()
      .file(path)
      .save(buf, {
        contentType: "application/json",
        resumable: false,
        metadata: {
          cacheControl: "private, max-age=0, no-store",
          metadata: {
            callId,
            sessionId,
            rehostedAt: String(Date.now()),
          },
        },
      });
    return { storagePath: path, bytes: buf.length };
  } catch (err) {
    functions.logger.warn("[transcriptRehost] failed", {
      err: String(err),
      callId,
      sessionId,
    });
    return null;
  }
}

async function deleteStorageObjectIfExists(
  storagePath: string | null,
): Promise<void> {
  if (!storagePath) return;
  try {
    await bucket().file(storagePath).delete({ ignoreNotFound: true });
  } catch (err) {
    functions.logger.warn("[transcriptStorage] delete failed", {
      err: String(err),
      storagePath,
    });
  }
}

async function makeSignedUrlForStorage(
  storagePath: string,
): Promise<string | null> {
  try {
    const [url] = await bucket()
      .file(storagePath)
      .getSignedUrl({
        action: "read",
        version: "v4",
        expires: Date.now() + SIGNED_URL_TTL_MS,
      });
    return url;
  } catch (err) {
    functions.logger.error("[transcriptStorage] signed url failed", {
      err: String(err),
      storagePath,
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-user transcript availability index
// ---------------------------------------------------------------------------

function indexDocRef(uid: string, callId: string, sessionId: string) {
  return db
    .collection("Users")
    .doc(uid)
    .collection("CallTranscriptIndex")
    .doc(`${callId}__${sessionId}`);
}

/**
 * Writes `Users/{uid}/CallTranscriptIndex/{callId__sessionId}` for each
 * allowed participant so the client can fast-query availability without
 * scanning the global `CallTranscripts` collection.
 */
function writeParticipantIndex(
  doc: TranscriptDoc,
  batch: FirebaseFirestore.WriteBatch,
): void {
  for (const uid of doc.participants) {
    batch.set(
      indexDocRef(uid, doc.callId, doc.sessionId),
      {
        callId: doc.callId,
        sessionId: doc.sessionId,
        status: doc.status,
        serverExpiresAt: doc.serverExpiresAt,
        updatedAt: doc.updatedAt,
      },
      { merge: true },
    );
  }
}

// ---------------------------------------------------------------------------
// Core event handler (shared with streamCallWebhook).
// Exported so the canonical Stream webhook can delegate transcription
// events here without a second endpoint.
// ---------------------------------------------------------------------------

export async function handleTranscriptionWebhookEvent(event: any): Promise<{
  ok: boolean;
  reason: string;
}> {
  const eventType: string | undefined = event?.type;
  if (
    eventType !== "call.transcription_ready" &&
    eventType !== "call.transcription_failed"
  ) {
    return { ok: true, reason: "ignored_event_type" };
  }

  const call = event.call;
  if (!call?.id) return { ok: false, reason: "missing_call" };

  const eligibility = isTranscriptEligible(call);
  if (!eligibility.eligible) {
    functions.logger.info(
      "[transcriptWebhook] ineligible call — dropping (no Firestore write)",
      { callId: call.id, reason: eligibility.reason },
    );
    return { ok: true, reason: `ineligible_${eligibility.reason}` };
  }

  const sessionId: string =
    event.session_id ?? call.session?.id ?? call.session_id ?? call.id;
  const docId = `${call.id}__${sessionId}`;
  const docRef = db.collection(COLLECTION).doc(docId);
  const now = Date.now();

  // Idempotency — skip duplicate deliveries after we've already finalized.
  const existingSnap = await docRef.get();
  if (existingSnap.exists) {
    const prior = existingSnap.data() as TranscriptDoc;
    if (prior.status === "ready" || prior.status === "deleted") {
      return { ok: true, reason: "duplicate_delivery" };
    }
  }

  const participants = participantUidsFromCall(call);
  const streamUrl: string | null =
    event.transcription?.url ?? event.transcript?.url ?? event.url ?? null;

  const baseMeta = {
    callId: call.id,
    sessionId,
    participants,
    acks: existingSnap.exists
      ? (existingSnap.data() as TranscriptDoc).acks || {}
      : {},
    createdAt: existingSnap.exists
      ? (existingSnap.data() as TranscriptDoc).createdAt
      : now,
    serverExpiresAt: now + SERVER_RETENTION_MS,
    updatedAt: now,
    deletedAt: null,
    streamMeta: {
      callType: call.type ?? null,
      createdBy: call.created_by?.id ?? null,
      mode: call.custom?.mode ?? null,
    },
    source: "external" as const,
  };

  // --- Failure path -------------------------------------------------------
  if (eventType === "call.transcription_failed") {
    const failedDoc: TranscriptDoc = {
      ...baseMeta,
      acks: {},
      status: "failed",
      storagePath: null,
      downloadUrl: null,
      lastError: event.reason ?? "transcription_failed",
    };
    const batch = db.batch();
    batch.set(docRef, failedDoc, { merge: true });
    writeParticipantIndex(failedDoc, batch);
    await batch.commit();
    return { ok: true, reason: "failure_recorded" };
  }

  // --- No URL yet → record processing so client can poll ------------------
  if (!streamUrl) {
    const processingDoc: TranscriptDoc = {
      ...baseMeta,
      status: "processing",
      storagePath: null,
      downloadUrl: null,
      lastError: null,
    };
    const batch = db.batch();
    batch.set(docRef, processingDoc, { merge: true });
    writeParticipantIndex(processingDoc, batch);
    await batch.commit();
    return { ok: true, reason: "processing_no_url" };
  }

  // --- Success path — rehost into app-owned Storage -----------------------
  const rehost = await rehostTranscriptToAppStorage(
    streamUrl,
    call.id,
    sessionId,
  );
  if (!rehost) {
    // Rehost failed. Record as failed rather than exposing a Stream URL.
    const failedDoc: TranscriptDoc = {
      ...baseMeta,
      acks: {},
      status: "failed",
      storagePath: null,
      downloadUrl: null,
      lastError: "rehost_failed",
    };
    const batch = db.batch();
    batch.set(docRef, failedDoc, { merge: true });
    writeParticipantIndex(failedDoc, batch);
    await batch.commit();
    functions.logger.error("[transcriptWebhook] rehost failed", {
      callId: call.id,
      sessionId,
    });
    return { ok: false, reason: "rehost_failed" };
  }

  const readyDoc: TranscriptDoc = {
    ...baseMeta,
    status: "ready",
    storagePath: rehost.storagePath,
    downloadUrl: null,
    lastError: null,
  };

  const batch = db.batch();
  batch.set(docRef, readyDoc, { merge: true });
  writeParticipantIndex(readyDoc, batch);
  await batch.commit();

  functions.logger.info("[transcriptWebhook] rehosted + ready", {
    callId: call.id,
    sessionId,
    bytes: rehost.bytes,
    storagePath: rehost.storagePath,
  });
  return { ok: true, reason: "ready" };
}

// ---------------------------------------------------------------------------
// Standalone webhook (pointable directly at from Stream dashboard).
// ---------------------------------------------------------------------------

export const streamTranscriptionWebhook = functions.https.onRequest(
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }
    if (!verifyStreamSignature(req)) {
      res.status(401).send("Unauthorized");
      return;
    }
    try {
      const result = await handleTranscriptionWebhookEvent(req.body ?? {});
      res.status(result.ok ? 200 : 500).send(`OK - ${result.reason}`);
    } catch (err) {
      functions.logger.error("[transcriptWebhook] unhandled error", { err });
      res.status(500).send("Internal error");
    }
  },
);

// ---------------------------------------------------------------------------
// Callable: getCallTranscriptPolicy
// ---------------------------------------------------------------------------

/**
 * Resolve whether the caller + callee pair can transcribe together.
 * Reads both users' call-settings docs and ANDs the flags.
 * Fails closed on any error.
 */
export const getCallTranscriptPolicy = functions.https.onCall(
  async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign-in required",
      );
    }
    const localUid = context.auth.uid;
    const remoteUid = String(data?.calleeUid ?? "");
    if (!remoteUid) {
      return { allowed: false, reason: "unresolved" };
    }

    try {
      const [localSnap, remoteSnap] = await Promise.all([
        db.doc(`Users/${localUid}/Settings/calls`).get(),
        db.doc(`Users/${remoteUid}/Settings/calls`).get(),
      ]);
      const localEnabled = localSnap.exists
        ? Boolean((localSnap.data() as any)?.audioCallTranscriptionsEnabled)
        : false;
      const remoteEnabled = remoteSnap.exists
        ? Boolean((remoteSnap.data() as any)?.audioCallTranscriptionsEnabled)
        : false;
      if (!localEnabled) return { allowed: false, reason: "local_disabled" };
      if (!remoteEnabled) return { allowed: false, reason: "remote_disabled" };
      return { allowed: true, reason: "ok" };
    } catch (err) {
      functions.logger.warn("Transcript policy lookup failed", { err });
      return { allowed: false, reason: "unresolved" };
    }
  },
);

// ---------------------------------------------------------------------------
// Callable: getCallTranscript (availability + signed URL)
// ---------------------------------------------------------------------------

export const getCallTranscript = functions.https.onCall(
  async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign-in required",
      );
    }
    const uid = context.auth.uid;
    const callId = String(data?.callId ?? "");
    const sessionId = String(data?.sessionId ?? "");
    if (!callId || !sessionId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "callId and sessionId required",
      );
    }

    const docId = `${callId}__${sessionId}`;
    const snap = await db.collection(COLLECTION).doc(docId).get();
    if (!snap.exists) {
      return {
        callId,
        sessionId,
        status: "not_found",
        serverExpiresAt: null,
        downloadUrl: null,
        source: null,
      };
    }
    const doc = snap.data() as TranscriptDoc;
    if (!doc.participants.includes(uid)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not a participant",
      );
    }

    // Check the hard deadline and treat as expired even if status is stale.
    const now = Date.now();
    if (doc.status === "deleted" || now > doc.serverExpiresAt) {
      return {
        callId,
        sessionId,
        status: "expired",
        serverExpiresAt: doc.serverExpiresAt,
        downloadUrl: null,
        source: doc.source,
      };
    }

    if (doc.status === "failed") {
      throw new functions.https.HttpsError(
        "internal",
        doc.lastError ?? "Transcription failed",
      );
    }

    if (doc.status !== "ready") {
      return {
        callId,
        sessionId,
        status: doc.status,
        serverExpiresAt: doc.serverExpiresAt,
        downloadUrl: null,
        source: doc.source,
      };
    }

    // Resolve download URL. Prefer app-owned signed URL; only fall back to
    // a legacy Stream URL if this row was written before the rehost path
    // shipped (source === "stream_fallback").
    let downloadUrl: string | null = null;
    if (doc.storagePath) {
      downloadUrl = await makeSignedUrlForStorage(doc.storagePath);
    } else if (doc.downloadUrl && doc.source === "stream_fallback") {
      downloadUrl = doc.downloadUrl;
    }

    if (!downloadUrl) {
      throw new functions.https.HttpsError(
        "internal",
        "Could not resolve transcript URL",
      );
    }

    return {
      callId,
      sessionId,
      status: "ready",
      serverExpiresAt: doc.serverExpiresAt,
      downloadUrl,
      source: doc.source,
    };
  },
);

// ---------------------------------------------------------------------------
// Callable: ackCallTranscript
// ---------------------------------------------------------------------------

/**
 * App ACKs that it persisted the transcript locally. We record this uid's
 * ack; once every participant has ACKed we hard-delete the server copy
 * immediately. Otherwise the scheduled cleanup picks it up by the 2-day
 * deadline.
 */
export const ackCallTranscript = functions.https.onCall(
  async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign-in required",
      );
    }
    const uid = context.auth.uid;
    const callId = String(data?.callId ?? "");
    const sessionId = String(data?.sessionId ?? "");
    if (!callId || !sessionId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "callId and sessionId required",
      );
    }
    const docId = `${callId}__${sessionId}`;
    const docRef = db.collection(COLLECTION).doc(docId);

    // Firestore transaction records the ACK + decides whether to tombstone.
    // Storage deletion must happen OUTSIDE the transaction (Storage is not
    // transactional with Firestore).
    const txResult = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return { action: "noop" as const };
      const doc = snap.data() as TranscriptDoc;
      if (!doc.participants.includes(uid)) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Not a participant",
        );
      }
      if (doc.status === "deleted") return { action: "noop" as const };

      const newAcks = { ...doc.acks, [uid]: Date.now() };
      const allAcked = doc.participants.every((p) => newAcks[p]);

      if (allAcked) {
        tombstoneInTransaction(tx, docRef, doc, "all_acked");
        return {
          action: "delete" as const,
          storagePath: doc.storagePath,
        };
      }
      tx.update(docRef, { acks: newAcks, updatedAt: Date.now() });
      return { action: "ack" as const };
    });

    if (txResult.action === "delete") {
      await deleteStorageObjectIfExists(txResult.storagePath);
      return { serverDeleted: true };
    }
    return { serverDeleted: false };
  },
);

// ---------------------------------------------------------------------------
// Tombstone helpers (shared by ACK + scheduled cleanup)
// ---------------------------------------------------------------------------

function tombstoneInTransaction(
  tx: FirebaseFirestore.Transaction,
  docRef: FirebaseFirestore.DocumentReference,
  doc: TranscriptDoc,
  reason: string,
): void {
  const now = Date.now();
  for (const uid of doc.participants) {
    tx.set(
      indexDocRef(uid, doc.callId, doc.sessionId),
      { status: "deleted", updatedAt: now, deletedAt: now },
      { merge: true },
    );
  }
  // Blank out URL + path and mark deleted. Keep the tombstone row so
  // duplicate webhook deliveries can't resurrect the data.
  tx.update(docRef, {
    downloadUrl: null,
    storagePath: null,
    status: "deleted",
    deletedAt: now,
    updatedAt: now,
    lastError: `deleted:${reason}`,
  });
}

/**
 * Non-transactional tombstone + storage delete used by the scheduled
 * cleanup. Idempotent: safe to call repeatedly on the same row.
 */
async function hardDeleteTranscriptOutOfBand(
  snap: FirebaseFirestore.QueryDocumentSnapshot,
  reason: string,
): Promise<void> {
  const doc = snap.data() as TranscriptDoc;
  // If already tombstoned, still make sure the blob is gone.
  if (doc.status === "deleted") {
    await deleteStorageObjectIfExists(doc.storagePath);
    return;
  }
  await db.runTransaction(async (tx) => {
    const latest = await tx.get(snap.ref);
    if (!latest.exists) return;
    const latestDoc = latest.data() as TranscriptDoc;
    if (latestDoc.status === "deleted") return;
    tombstoneInTransaction(tx, snap.ref, latestDoc, reason);
  });
  await deleteStorageObjectIfExists(doc.storagePath);
}

// ---------------------------------------------------------------------------
// Scheduled cleanup — enforces the 2-day hard deadline
// ---------------------------------------------------------------------------

/**
 * Runs every 6 hours. Finds any non-deleted transcripts whose
 * serverExpiresAt has passed and hard-deletes them. We intentionally do
 * NOT rely solely on Firestore TTL — TTL is best-effort and not a privacy
 * contract. This explicit pass is the enforcement.
 */
export const cleanupExpiredCallTranscripts = functions.pubsub
  .schedule("every 6 hours")
  .onRun(async () => {
    const cutoff = Date.now();

    // 1. Expired but not-yet-deleted rows.
    const expiredQ = db
      .collection(COLLECTION)
      .where("status", "in", ["processing", "ready", "failed"])
      .where("serverExpiresAt", "<=", cutoff)
      .limit(200);
    const expiredSnap = await expiredQ.get();
    if (!expiredSnap.empty) {
      functions.logger.info(
        `[transcriptCleanup] deleting ${expiredSnap.size} expired transcripts`,
      );
      for (const d of expiredSnap.docs) {
        try {
          await hardDeleteTranscriptOutOfBand(d, "scheduled_expiry");
        } catch (err) {
          functions.logger.warn("[transcriptCleanup] delete failed", {
            id: d.id,
            err: String(err),
          });
        }
      }
    }

    // 2. Tombstoned rows whose storage object may have survived a prior
    //    failed delete — best-effort re-delete to close the loop.
    const tombstonedQ = db
      .collection(COLLECTION)
      .where("status", "==", "deleted")
      .where("updatedAt", "<=", cutoff - 60 * 60 * 1000)
      .limit(100);
    const tombstonedSnap = await tombstonedQ.get();
    for (const d of tombstonedSnap.docs) {
      const data = d.data() as TranscriptDoc;
      if (data.storagePath) {
        await deleteStorageObjectIfExists(data.storagePath);
        await d.ref.update({ storagePath: null, updatedAt: Date.now() });
      }
    }

    // 3. Orphaned per-user index rows whose serverExpiresAt has elapsed
    //    but still report a live status. Mark them deleted so clients
    //    stop polling. Safe: all CallTranscriptIndex subcollections share
    //    the same schema.
    const orphanQ = db
      .collectionGroup("CallTranscriptIndex")
      .where("status", "in", ["processing", "ready"])
      .where("serverExpiresAt", "<=", cutoff)
      .limit(200);
    const orphanSnap = await orphanQ.get();
    for (const idx of orphanSnap.docs) {
      try {
        await idx.ref.set(
          { status: "deleted", updatedAt: Date.now(), deletedAt: Date.now() },
          { merge: true },
        );
      } catch (err) {
        functions.logger.warn("[transcriptCleanup] index update failed", {
          path: idx.ref.path,
          err: String(err),
        });
      }
    }

    functions.logger.info("[transcriptCleanup] run complete", {
      expired: expiredSnap.size,
      tombstoneRetries: tombstonedSnap.size,
      orphanIndex: orphanSnap.size,
    });
    return null;
  });
