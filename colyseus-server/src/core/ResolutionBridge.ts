/**
 * Realtime Framework — Resolution Bridge
 *
 * Idempotent bridge from Colyseus room-end data into the Firebase
 * V4 resolution pipeline. Writes a resolution request doc that
 * the onRealtimeResolutionRequest trigger picks up.
 *
 * Key design decisions:
 * - Uses requestId for idempotency (duplicate writes are no-ops)
 * - Writes to the same path the existing trigger expects
 * - Includes rich metadata for debugging and postmortem
 * - Does NOT write XP/PB/achievements directly — all flows through resolve pipeline
 *
 * @module core/ResolutionBridge
 */

import * as admin from "firebase-admin";
import { getFirebaseDb, isDevBypass } from "../bridge/firebaseBridge";
import type { RealtimeResolutionPayload } from "./types";

// Track written request IDs to prevent duplicate writes within same process
const writtenRequestIds = new Set<string>();
const MAX_TRACKED_IDS = 1000;

export interface WriteResolutionResult {
  /** Whether the document was actually written to Firestore */
  written: boolean;
  /** True when the write was skipped due to dev bypass */
  bypassed: boolean;
}

/**
 * Write a terminal resolution payload to Firestore.
 *
 * Idempotent:
 * - In-process dedup via requestId tracking
 * - Firestore set() is naturally idempotent for the same doc path
 * - The trigger function also checks session status before resolving
 *
 * @param payload - The resolution payload from the room
 * @returns Whether the document was actually written
 */
export async function writeResolutionRequest(
  payload: RealtimeResolutionPayload,
): Promise<WriteResolutionResult> {
  // In-process idempotency guard
  if (writtenRequestIds.has(payload.requestId)) {
    console.log(
      `[ResolutionBridge] Skipping duplicate request ${payload.requestId} for session ${payload.sessionId}`,
    );
    return { written: false, bypassed: false };
  }

  if (isDevBypass()) {
    writtenRequestIds.add(payload.requestId);
    console.warn(
      `[ResolutionBridge] ⚠️  DEV BYPASS — Firestore write SKIPPED for session ${payload.sessionId}. ` +
        `Resolution will NOT proceed. Game-over navigation will NOT trigger.\n` +
        `  reason=${payload.reason}, resolutionType=${payload.resolutionType}, ` +
        `winners=${JSON.stringify(payload.winnerIds)}\n` +
        `  To fix: set COLYSEUS_DEV_BYPASS=0 with valid credentials, or start the Firebase Emulator.`,
    );
    return { written: false, bypassed: true };
  }

  const db = getFirebaseDb();

  const docData: Record<string, unknown> = {
    ...payload,
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Write to the path the existing trigger expects
  await db
    .collection("GameSessionsV4")
    .doc(payload.sessionId)
    .collection("internal")
    .doc("realtimeResolution")
    .set(docData);

  // Track the written request ID
  writtenRequestIds.add(payload.requestId);

  // Prevent memory leak: evict oldest if over limit
  if (writtenRequestIds.size > MAX_TRACKED_IDS) {
    const first = writtenRequestIds.values().next().value;
    if (first) writtenRequestIds.delete(first);
  }

  console.log(
    `[ResolutionBridge] Wrote resolution for session ${payload.sessionId} ` +
      `(requestId=${payload.requestId}, reason=${payload.reason}, ` +
      `resolutionType=${payload.resolutionType}, winners=${JSON.stringify(payload.winnerIds)})`,
  );

  return { written: true, bypassed: false };
}

/**
 * Build a resolution payload from room state.
 * Helper to standardize payload construction.
 */
export function buildResolutionPayload(params: {
  sessionId: string;
  gameId: string;
  roomVersion: number;
  reason: RealtimeResolutionPayload["reason"];
  resolutionType: RealtimeResolutionPayload["resolutionType"];
  winnerIds: string[];
  scoreboard: RealtimeResolutionPayload["scoreboard"];
  durationMs: number;
  playerMetrics?: Record<string, Record<string, unknown>>;
  flags?: RealtimeResolutionPayload["flags"];
}): RealtimeResolutionPayload {
  return {
    requestId: `${params.sessionId}_${params.roomVersion}_${Date.now()}`,
    sessionId: params.sessionId,
    gameId: params.gameId,
    roomVersion: params.roomVersion,
    endedAt: Date.now(),
    reason: params.reason,
    resolutionType: params.resolutionType,
    winnerIds: params.winnerIds,
    scoreboard: params.scoreboard,
    durationMs: params.durationMs,
    playerMetrics: params.playerMetrics ?? {},
    flags: params.flags ?? {},
  };
}
