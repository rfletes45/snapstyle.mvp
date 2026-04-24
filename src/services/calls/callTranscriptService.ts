/**
 * Call Transcript Service
 *
 * Orchestrates the privacy-first transcript pipeline:
 *
 *   1. resolveTranscriptPolicy()  — fail-closed effective policy check
 *   2. startCallTranscriptionIfEligible(call) — after join, turn it on
 *   3. stopCallTranscription(call) — on user toggle or call end
 *   4. fetchAndPersistTranscript({ callId, sessionId }) — download + save
 *      locally via SQLite, then ACK so the backend can delete the server copy
 *
 * Only direct 1:1 audio calls are transcript-eligible. Video calls and
 * voice rooms always return `disabled_by_policy`.
 *
 * External backend contract (Cloud Functions):
 *   - getCallTranscriptPolicy({ calleeUid }): TranscriptPolicyResult
 *   - getCallTranscript({ callId, sessionId }): TranscriptAvailability
 *   - ackCallTranscript({ callId, sessionId }): { serverDeleted: boolean }
 */

import { getAuthInstance, getFunctionsInstance } from "@/services/firebase";
import type {
  CallTranscriptSegment,
  CallTranscriptStatus,
  TranscriptAvailability,
} from "@/types/callTranscript";
import type { DirectCallMode } from "@/types/streamCall";
import { createLogger } from "@/utils/log";
import type { Call } from "@stream-io/video-react-native-sdk";
import { httpsCallable } from "firebase/functions";

import { callSettingsService } from "./callSettingsService";
import {
  getTranscriptMeta,
  patchTranscriptMeta,
  saveTranscriptTransactional,
  setTranscriptStatus,
  upsertTranscriptMeta,
} from "./callTranscriptDb";

const logger = createLogger("services/calls/callTranscriptService");

export interface TranscriptPolicyResult {
  /** Whether transcription is allowed for this specific direct-audio pair. */
  allowed: boolean;
  /**
   * Why it was denied. "remote_disabled" and "local_disabled" are expected
   * outcomes; "unresolved" / "unknown" should fail closed.
   */
  reason:
    | "ok"
    | "local_disabled"
    | "remote_disabled"
    | "mode_not_audio"
    | "not_direct"
    | "unresolved"
    | "unknown";
}

// ---------------------------------------------------------------------------
// Policy resolution
// ---------------------------------------------------------------------------

/**
 * Resolve transcription policy for a direct audio call.
 * - Checks local user setting first (fast bail)
 * - Then asks the backend for the remote user's setting
 * - Fails closed on any error
 */
export async function resolveTranscriptPolicy(params: {
  mode: DirectCallMode;
  isDirect: boolean;
  otherUserId: string | null;
}): Promise<TranscriptPolicyResult> {
  if (!params.isDirect) {
    return { allowed: false, reason: "not_direct" };
  }
  if (params.mode !== "audio") {
    return { allowed: false, reason: "mode_not_audio" };
  }

  // Local setting check — fast bail
  const local = await callSettingsService.getSettings();
  if (!local.audioCallTranscriptionsEnabled) {
    return { allowed: false, reason: "local_disabled" };
  }

  if (!params.otherUserId) {
    return { allowed: false, reason: "unresolved" };
  }

  try {
    const functions = getFunctionsInstance();
    const callable = httpsCallable<
      { calleeUid: string },
      TranscriptPolicyResult
    >(functions, "getCallTranscriptPolicy");
    const res = await callable({ calleeUid: params.otherUserId });
    const data = res.data;
    if (!data || typeof data.allowed !== "boolean") {
      logger.warn("[transcript] policy response malformed — failing closed");
      return { allowed: false, reason: "unresolved" };
    }
    return data;
  } catch (err) {
    logger.warn("[transcript] policy callable failed — failing closed", err);
    return { allowed: false, reason: "unresolved" };
  }
}

// ---------------------------------------------------------------------------
// Start / stop on the active Stream call
// ---------------------------------------------------------------------------

/**
 * Explicitly disable transcription on a call. Used for video/voice-room
 * calls so an accidental settings_override can't spin transcription up.
 */
export async function forceDisableTranscriptionOnCall(
  call: Call,
  reason: string,
): Promise<void> {
  try {
    const maybeUpdate = (call as any).update;
    if (typeof maybeUpdate === "function") {
      await maybeUpdate.call(call, {
        settings_override: { transcription: { mode: "disabled" } },
      });
      logger.info(`[transcript] forced off for call.id=${call.id} (${reason})`);
    }
  } catch (err) {
    logger.warn(`[transcript] force-disable failed (${reason})`, err);
  }
}

/**
 * Start transcription on an eligible direct audio call.
 * Returns true if transcription was actually started.
 */
export async function startCallTranscriptionIfEligible(
  call: Call,
  policy: TranscriptPolicyResult,
): Promise<boolean> {
  if (!policy.allowed) {
    logger.info(
      `[transcript] not started: reason=${policy.reason} callId=${call.id}`,
    );
    return false;
  }
  try {
    const anyCall = call as any;
    if (typeof anyCall.startTranscription === "function") {
      await anyCall.startTranscription();
    } else if (typeof anyCall.update === "function") {
      // Fall back to enabling via call-level settings override
      await anyCall.update({
        settings_override: { transcription: { mode: "auto-on" } },
      });
    } else {
      logger.warn("[transcript] SDK exposes no transcription API on call");
      return false;
    }
    logger.info(`[transcript] started for callId=${call.id}`);
    return true;
  } catch (err) {
    logger.warn(`[transcript] start failed for callId=${call.id}`, err);
    return false;
  }
}

export async function stopCallTranscription(call: Call): Promise<void> {
  try {
    const anyCall = call as any;
    if (typeof anyCall.stopTranscription === "function") {
      await anyCall.stopTranscription();
    } else if (typeof anyCall.update === "function") {
      await anyCall.update({
        settings_override: { transcription: { mode: "disabled" } },
      });
    }
    logger.info(`[transcript] stopped for callId=${call.id}`);
  } catch (err) {
    logger.warn(`[transcript] stop failed for callId=${call.id}`, err);
  }
}

// ---------------------------------------------------------------------------
// Fetch + persist (download → SQLite → ACK)
// ---------------------------------------------------------------------------

export interface FetchAndPersistParams {
  callId: string;
  sessionId: string;
  entryId: string | null;
}

export interface FetchAndPersistResult {
  status: CallTranscriptStatus;
  segments: CallTranscriptSegment[] | null;
  error?: string;
}

/**
 * Query the backend for transcript availability without downloading content.
 */
export async function getTranscriptAvailability(params: {
  callId: string;
  sessionId: string;
}): Promise<TranscriptAvailability> {
  const functions = getFunctionsInstance();
  const callable = httpsCallable<
    { callId: string; sessionId: string },
    TranscriptAvailability
  >(functions, "getCallTranscript");
  const res = await callable(params);
  return res.data;
}

/**
 * Acknowledge successful local save to the backend so the server copy can be
 * deleted immediately. Idempotent — safe to call repeatedly.
 */
export async function ackTranscriptToServer(params: {
  callId: string;
  sessionId: string;
}): Promise<{ serverDeleted: boolean }> {
  const functions = getFunctionsInstance();
  const callable = httpsCallable<
    { callId: string; sessionId: string },
    { serverDeleted: boolean }
  >(functions, "ackCallTranscript");
  const res = await callable(params);
  return res.data ?? { serverDeleted: false };
}

async function downloadSegmentsFromUrl(
  url: string,
): Promise<CallTranscriptSegment[]> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Transcript download failed: ${resp.status}`);
  }
  const text = await resp.text();
  // Accept both JSON array and JSONL formats to be tolerant of Stream's shape.
  const segments: CallTranscriptSegment[] = [];
  let raw: any = null;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  if (Array.isArray(raw)) {
    raw.forEach((r, i) => {
      segments.push(normalizeSegment(r, i));
    });
  } else if (raw && Array.isArray(raw.segments)) {
    raw.segments.forEach((r: any, i: number) => {
      segments.push(normalizeSegment(r, i));
    });
  } else {
    // JSONL fallback
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    lines.forEach((line, i) => {
      try {
        segments.push(normalizeSegment(JSON.parse(line), i));
      } catch {
        /* skip malformed lines */
      }
    });
  }
  return segments;
}

function normalizeSegment(raw: any, index: number): CallTranscriptSegment {
  const startMs =
    typeof raw?.start_time_ms === "number"
      ? raw.start_time_ms
      : typeof raw?.startTimeMs === "number"
        ? raw.startTimeMs
        : typeof raw?.start_time === "string"
          ? Date.parse(raw.start_time) || 0
          : 0;
  const endMs =
    typeof raw?.end_time_ms === "number"
      ? raw.end_time_ms
      : typeof raw?.endTimeMs === "number"
        ? raw.endTimeMs
        : typeof raw?.stop_time === "string"
          ? Date.parse(raw.stop_time) || 0
          : typeof raw?.end_time === "string"
            ? Date.parse(raw.end_time) || 0
            : startMs;
  return {
    callId: String(raw?.callId ?? raw?.call_id ?? ""),
    sessionId: String(raw?.sessionId ?? raw?.session_id ?? ""),
    segmentIndex: index,
    speakerId: raw?.speaker_id ?? raw?.speakerId ?? raw?.user_id ?? null,
    speakerName:
      raw?.speaker_name ?? raw?.speakerName ?? raw?.user?.name ?? null,
    startTimeMs: Math.max(0, Math.floor(startMs)),
    endTimeMs: Math.max(0, Math.floor(endMs)),
    text: String(raw?.text ?? raw?.transcript ?? ""),
  };
}

/**
 * Full pipeline: download transcript, commit to SQLite transactionally,
 * then ACK the backend. Returns the terminal local status.
 */
export async function fetchAndPersistTranscript(
  params: FetchAndPersistParams,
): Promise<FetchAndPersistResult> {
  const ownerUid = getAuthInstance().currentUser?.uid;
  if (!ownerUid) {
    return { status: "failed", segments: null, error: "Not signed in" };
  }

  const { callId, sessionId, entryId } = params;

  // Mark as downloading before we kick off any network work
  await upsertTranscriptMeta({
    callId,
    sessionId,
    ownerUid,
    entryId,
    transcriptStatus: "downloading",
    serverExpiresAt: null,
    localSavedAt: null,
    deletedFromServerAt: null,
    lastError: null,
  });

  let availability: TranscriptAvailability;
  try {
    availability = await getTranscriptAvailability({ callId, sessionId });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    await setTranscriptStatus(callId, sessionId, ownerUid, "failed", {
      lastError: msg,
    });
    return { status: "failed", segments: null, error: msg };
  }

  if (
    availability.status === "expired" ||
    availability.status === "not_found"
  ) {
    await setTranscriptStatus(callId, sessionId, ownerUid, "expired");
    return { status: "expired", segments: null };
  }

  if (availability.status === "processing") {
    await patchTranscriptMeta(
      { callId, sessionId, ownerUid },
      {
        transcriptStatus: "processing",
        serverExpiresAt: availability.serverExpiresAt,
      },
    );
    return { status: "processing", segments: null };
  }

  if (availability.status !== "ready" || !availability.downloadUrl) {
    await setTranscriptStatus(callId, sessionId, ownerUid, "failed", {
      lastError: "Transcript is not ready",
    });
    return {
      status: "failed",
      segments: null,
      error: "Transcript is not ready",
    };
  }

  let segments: CallTranscriptSegment[];
  try {
    segments = await downloadSegmentsFromUrl(availability.downloadUrl);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    await setTranscriptStatus(callId, sessionId, ownerUid, "failed", {
      lastError: msg,
    });
    return { status: "failed", segments: null, error: msg };
  }

  // Persist transactionally
  try {
    await saveTranscriptTransactional({
      callId,
      sessionId,
      ownerUid,
      entryId,
      segments: segments.map((s) => ({ ...s, callId, sessionId })),
      serverExpiresAt: availability.serverExpiresAt,
    });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    await setTranscriptStatus(callId, sessionId, ownerUid, "failed", {
      lastError: `Local save failed: ${msg}`,
    });
    return {
      status: "failed",
      segments: null,
      error: `Local save failed: ${msg}`,
    };
  }

  // ACK best-effort. A failed ACK does NOT demote the local state — the
  // server will eventually GC the copy via scheduled cleanup (≤ 2 days).
  try {
    const ack = await ackTranscriptToServer({ callId, sessionId });
    if (ack.serverDeleted) {
      await patchTranscriptMeta(
        { callId, sessionId, ownerUid },
        { deletedFromServerAt: Date.now() },
      );
    }
  } catch (err) {
    logger.warn("[transcript] ACK failed — server will GC on its own", err);
  }

  const finalMeta = await getTranscriptMeta(callId, sessionId, ownerUid);
  return {
    status: finalMeta?.transcriptStatus ?? "saved_local",
    segments,
  };
}
