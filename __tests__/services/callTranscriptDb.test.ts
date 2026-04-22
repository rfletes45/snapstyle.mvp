/**
 * Tests for `saveTranscriptTransactional` — rollback on malformed segments
 * and happy-path atomic commit. We stub `expo-sqlite` in-memory.
 */

type Row = Record<string, any>;

interface FakeDb {
  meta: Map<string, Row>;
  segments: Map<string, Row>;
  /** If true, the next segment INSERT will throw — used to test rollback. */
  failOnSegmentIndex: number | null;
  insideTxn: boolean;
}

const fakeDb: FakeDb = {
  meta: new Map(),
  segments: new Map(),
  failOnSegmentIndex: null,
  insideTxn: false,
};

function metaKey(row: Row) {
  return `${row.callId}|${row.sessionId}|${row.ownerUid}`;
}
function segKey(row: Row) {
  return `${row.callId}|${row.sessionId}|${row.segmentIndex}`;
}

const mockOpenDatabaseAsync = jest.fn(async () => {
  const db: any = {
    execAsync: jest.fn(async () => {}),
    runAsync: jest.fn(async (sql: string, params: any[] = []) => {
      const s = sql.trim();
      if (s.startsWith("DELETE FROM call_transcript_segments")) {
        const [callId, sessionId] = params;
        for (const k of Array.from(fakeDb.segments.keys())) {
          const row = fakeDb.segments.get(k)!;
          if (row.callId === callId && row.sessionId === sessionId) {
            fakeDb.segments.delete(k);
          }
        }
        return;
      }
      if (s.startsWith("INSERT INTO call_transcript_segments")) {
        const [
          callId,
          sessionId,
          segmentIndex,
          speakerId,
          speakerName,
          startTimeMs,
          endTimeMs,
          text,
        ] = params;
        if (
          fakeDb.failOnSegmentIndex !== null &&
          fakeDb.failOnSegmentIndex === segmentIndex
        ) {
          throw new Error("simulated segment write failure");
        }
        const row = {
          callId,
          sessionId,
          segmentIndex,
          speakerId,
          speakerName,
          startTimeMs,
          endTimeMs,
          text,
        };
        fakeDb.segments.set(segKey(row), row);
        return;
      }
      if (s.startsWith("INSERT OR REPLACE INTO call_transcript_meta")) {
        // Transactional save uses fixed column order with 'saved_local'
        // literal; plain upsert path passes status in params.
        const hasLiteralSaved = s.includes("'saved_local'");
        if (hasLiteralSaved) {
          const [
            callId,
            sessionId,
            ownerUid,
            entryId,
            serverExpiresAt,
            localSavedAt,
            updatedAt,
          ] = params;
          const row = {
            callId,
            sessionId,
            ownerUid,
            entryId,
            transcriptStatus: "saved_local",
            serverExpiresAt,
            localSavedAt,
            deletedFromServerAt: null,
            lastError: null,
            updatedAt,
          };
          fakeDb.meta.set(metaKey(row), row);
        } else {
          const [
            callId,
            sessionId,
            ownerUid,
            entryId,
            transcriptStatus,
            serverExpiresAt,
            localSavedAt,
            deletedFromServerAt,
            lastError,
            updatedAt,
          ] = params;
          const row = {
            callId,
            sessionId,
            ownerUid,
            entryId,
            transcriptStatus,
            serverExpiresAt,
            localSavedAt,
            deletedFromServerAt,
            lastError,
            updatedAt,
          };
          fakeDb.meta.set(metaKey(row), row);
        }
        return;
      }
    }),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
      fakeDb.insideTxn = true;
      const metaSnapshot = new Map(fakeDb.meta);
      const segSnapshot = new Map(fakeDb.segments);
      try {
        await fn();
        fakeDb.insideTxn = false;
      } catch (err) {
        // Roll back by restoring snapshots.
        fakeDb.meta = metaSnapshot;
        fakeDb.segments = segSnapshot;
        fakeDb.insideTxn = false;
        throw err;
      }
    }),
  };
  return db;
});

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args),
}));

jest.mock("../../src/utils/log", () => ({
  createLogger: () => ({
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

import { saveTranscriptTransactional } from "../../src/services/calls/callTranscriptDb";

describe("saveTranscriptTransactional", () => {
  beforeEach(() => {
    fakeDb.meta = new Map();
    fakeDb.segments = new Map();
    fakeDb.failOnSegmentIndex = null;
  });

  it("commits all segments and marks meta saved_local on success", async () => {
    await saveTranscriptTransactional({
      callId: "c1",
      sessionId: "s1",
      ownerUid: "u1",
      entryId: "e1",
      serverExpiresAt: 123,
      segments: [
        {
          callId: "c1",
          sessionId: "s1",
          segmentIndex: 0,
          speakerId: "u2",
          speakerName: "Alice",
          startTimeMs: 0,
          endTimeMs: 1000,
          text: "hi",
        },
        {
          callId: "c1",
          sessionId: "s1",
          segmentIndex: 1,
          speakerId: "u1",
          speakerName: "Me",
          startTimeMs: 1000,
          endTimeMs: 2000,
          text: "hello",
        },
      ],
    });

    expect(fakeDb.segments.size).toBe(2);
    const meta = fakeDb.meta.get("c1|s1|u1");
    expect(meta).toBeDefined();
    expect(meta?.transcriptStatus).toBe("saved_local");
    expect(meta?.serverExpiresAt).toBe(123);
  });

  it("rolls back (no meta, no segments) when any segment write fails", async () => {
    fakeDb.failOnSegmentIndex = 1;

    await expect(
      saveTranscriptTransactional({
        callId: "c2",
        sessionId: "s2",
        ownerUid: "u1",
        entryId: null,
        serverExpiresAt: null,
        segments: [
          {
            callId: "c2",
            sessionId: "s2",
            segmentIndex: 0,
            speakerId: "u2",
            speakerName: "Alice",
            startTimeMs: 0,
            endTimeMs: 500,
            text: "ok",
          },
          {
            callId: "c2",
            sessionId: "s2",
            segmentIndex: 1,
            speakerId: "u2",
            speakerName: "Alice",
            startTimeMs: 500,
            endTimeMs: 1000,
            text: "boom",
          },
        ],
      }),
    ).rejects.toThrow(/simulated segment write failure/);

    // After rollback, neither meta nor segments should have been committed.
    expect(fakeDb.meta.get("c2|s2|u1")).toBeUndefined();
    expect(fakeDb.segments.size).toBe(0);
  });
});
