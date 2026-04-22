/**
 * Call Transcript Local Database
 *
 * On-device SQLite storage for call transcripts. Privacy-first:
 *  - Transcripts only ever land here for eligible direct 1:1 audio calls
 *  - Server copies are deleted after ACK — this is the long-term store
 *  - Writes are transactional — meta is only marked "saved_local" after
 *    all segments commit successfully
 *
 * DO NOT use SecureStore for large transcript bodies.
 */

import type {
  CallTranscriptMeta,
  CallTranscriptSegment,
  CallTranscriptStatus,
} from "@/types/callTranscript";
import { createLogger } from "@/utils/log";
import * as SQLite from "expo-sqlite";

const logger = createLogger("services/calls/callTranscriptDb");

const DB_NAME = "call_transcripts.db";
const SCHEMA_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await initSchema(db);
      return db;
    });
  }
  return dbPromise;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS call_transcript_meta (
      callId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      ownerUid TEXT NOT NULL,
      entryId TEXT,
      transcriptStatus TEXT NOT NULL,
      serverExpiresAt INTEGER,
      localSavedAt INTEGER,
      deletedFromServerAt INTEGER,
      lastError TEXT,
      updatedAt INTEGER NOT NULL,
      PRIMARY KEY (callId, sessionId, ownerUid)
    );

    CREATE TABLE IF NOT EXISTS call_transcript_segments (
      callId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      segmentIndex INTEGER NOT NULL,
      speakerId TEXT,
      speakerName TEXT,
      startTimeMs INTEGER NOT NULL,
      endTimeMs INTEGER NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (callId, sessionId, segmentIndex)
    );

    CREATE INDEX IF NOT EXISTS idx_meta_owner ON call_transcript_meta (ownerUid, updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_segments_call ON call_transcript_segments (callId, sessionId, segmentIndex);
  `);
  logger.info(`[callTranscriptDb] Schema ready (v${SCHEMA_VERSION})`);
}

function now(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// Meta operations
// ---------------------------------------------------------------------------

export async function upsertTranscriptMeta(
  meta: Omit<CallTranscriptMeta, "updatedAt"> & { updatedAt?: number },
): Promise<void> {
  const db = await getDb();
  const updatedAt = meta.updatedAt ?? now();
  await db.runAsync(
    `INSERT OR REPLACE INTO call_transcript_meta
     (callId, sessionId, ownerUid, entryId, transcriptStatus, serverExpiresAt,
      localSavedAt, deletedFromServerAt, lastError, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      meta.callId,
      meta.sessionId,
      meta.ownerUid,
      meta.entryId,
      meta.transcriptStatus,
      meta.serverExpiresAt,
      meta.localSavedAt,
      meta.deletedFromServerAt,
      meta.lastError,
      updatedAt,
    ],
  );
}

export async function patchTranscriptMeta(
  key: { callId: string; sessionId: string; ownerUid: string },
  patch: Partial<
    Pick<
      CallTranscriptMeta,
      | "transcriptStatus"
      | "serverExpiresAt"
      | "localSavedAt"
      | "deletedFromServerAt"
      | "lastError"
      | "entryId"
    >
  >,
): Promise<void> {
  const db = await getDb();
  const existing = await getTranscriptMeta(
    key.callId,
    key.sessionId,
    key.ownerUid,
  );
  const merged: CallTranscriptMeta = {
    callId: key.callId,
    sessionId: key.sessionId,
    ownerUid: key.ownerUid,
    entryId: patch.entryId ?? existing?.entryId ?? null,
    transcriptStatus:
      patch.transcriptStatus ?? existing?.transcriptStatus ?? "processing",
    serverExpiresAt:
      patch.serverExpiresAt !== undefined
        ? patch.serverExpiresAt
        : (existing?.serverExpiresAt ?? null),
    localSavedAt:
      patch.localSavedAt !== undefined
        ? patch.localSavedAt
        : (existing?.localSavedAt ?? null),
    deletedFromServerAt:
      patch.deletedFromServerAt !== undefined
        ? patch.deletedFromServerAt
        : (existing?.deletedFromServerAt ?? null),
    lastError:
      patch.lastError !== undefined
        ? patch.lastError
        : (existing?.lastError ?? null),
    updatedAt: now(),
  };
  await upsertTranscriptMeta(merged);
  void db; // keep ref
}

export async function getTranscriptMeta(
  callId: string,
  sessionId: string,
  ownerUid: string,
): Promise<CallTranscriptMeta | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM call_transcript_meta
     WHERE callId = ? AND sessionId = ? AND ownerUid = ?`,
    [callId, sessionId, ownerUid],
  );
  if (!row) return null;
  return row as CallTranscriptMeta;
}

/** Fallback when sessionId is unknown — pick the newest record for (callId, owner). */
export async function getLatestTranscriptMetaForCall(
  callId: string,
  ownerUid: string,
): Promise<CallTranscriptMeta | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM call_transcript_meta
     WHERE callId = ? AND ownerUid = ?
     ORDER BY updatedAt DESC LIMIT 1`,
    [callId, ownerUid],
  );
  return (row as CallTranscriptMeta | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Transactional segment write
// ---------------------------------------------------------------------------

/**
 * Atomically persist a transcript's segments AND mark meta `saved_local`.
 * If any write fails, the transaction rolls back and status stays unchanged.
 */
export async function saveTranscriptTransactional(params: {
  callId: string;
  sessionId: string;
  ownerUid: string;
  entryId: string | null;
  segments: CallTranscriptSegment[];
  serverExpiresAt: number | null;
}): Promise<void> {
  const db = await getDb();
  const { callId, sessionId, ownerUid, entryId, segments, serverExpiresAt } =
    params;
  await db.withTransactionAsync(async () => {
    // Clear any stale segments for this transcript
    await db.runAsync(
      `DELETE FROM call_transcript_segments WHERE callId = ? AND sessionId = ?`,
      [callId, sessionId],
    );
    for (const seg of segments) {
      await db.runAsync(
        `INSERT INTO call_transcript_segments
         (callId, sessionId, segmentIndex, speakerId, speakerName, startTimeMs, endTimeMs, text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          callId,
          sessionId,
          seg.segmentIndex,
          seg.speakerId,
          seg.speakerName,
          seg.startTimeMs,
          seg.endTimeMs,
          seg.text,
        ],
      );
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO call_transcript_meta
       (callId, sessionId, ownerUid, entryId, transcriptStatus, serverExpiresAt,
        localSavedAt, deletedFromServerAt, lastError, updatedAt)
       VALUES (?, ?, ?, ?, 'saved_local', ?, ?, NULL, NULL, ?)`,
      [callId, sessionId, ownerUid, entryId, serverExpiresAt, now(), now()],
    );
  });
}

export async function getTranscriptSegments(
  callId: string,
  sessionId: string,
): Promise<CallTranscriptSegment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM call_transcript_segments
     WHERE callId = ? AND sessionId = ?
     ORDER BY segmentIndex ASC`,
    [callId, sessionId],
  );
  return rows as CallTranscriptSegment[];
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

export async function deleteTranscriptLocal(
  callId: string,
  sessionId: string,
  ownerUid: string,
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM call_transcript_segments WHERE callId = ? AND sessionId = ?`,
      [callId, sessionId],
    );
    await db.runAsync(
      `UPDATE call_transcript_meta
       SET transcriptStatus = 'deleted_local', localSavedAt = NULL, updatedAt = ?
       WHERE callId = ? AND sessionId = ? AND ownerUid = ?`,
      [now(), callId, sessionId, ownerUid],
    );
  });
}

/**
 * Wipe every transcript record owned by a specific user.
 * Call on sign-out / account deletion to match the privacy-first model.
 */
export async function wipeTranscriptsForOwner(ownerUid: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    // Collect keys first so we can delete the matching segments.
    const metaRows = await db.getAllAsync<{
      callId: string;
      sessionId: string;
    }>(
      `SELECT callId, sessionId FROM call_transcript_meta WHERE ownerUid = ?`,
      [ownerUid],
    );
    for (const row of metaRows) {
      await db.runAsync(
        `DELETE FROM call_transcript_segments WHERE callId = ? AND sessionId = ?`,
        [row.callId, row.sessionId],
      );
    }
    await db.runAsync(`DELETE FROM call_transcript_meta WHERE ownerUid = ?`, [
      ownerUid,
    ]);
  });
}

export async function setTranscriptStatus(
  callId: string,
  sessionId: string,
  ownerUid: string,
  status: CallTranscriptStatus,
  extra?: { lastError?: string | null; entryId?: string | null },
): Promise<void> {
  await patchTranscriptMeta(
    { callId, sessionId, ownerUid },
    {
      transcriptStatus: status,
      lastError: extra?.lastError ?? null,
      entryId: extra?.entryId ?? undefined,
    },
  );
}
