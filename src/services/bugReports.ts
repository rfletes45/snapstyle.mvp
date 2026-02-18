/**
 * Bug Report Service
 *
 * Creates structured bug reports in Firestore with full game context
 * (gameType, ids, version, traceId, error info).
 *
 * Two APIs:
 *  - submitBugReport(context, userNote?) — full context (used by recovery actions)
 *  - recordBugReport({ code, userMessage, context }) — convenience wrapper
 *
 * Used by the "Report Bug" recovery action in game error overlays
 * and by the Debug HUD's "Copy Debug Info" flow.
 *
 * @module services/bugReports
 */

import { getClientBuildInfo } from "@/types/gameProtocol";
import { createLogger } from "@/utils/log";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getAuthInstance, getFirestoreInstance } from "./firebase";

const logger = createLogger("services/bugReports");

const getDb = () => getFirestoreInstance();
const getAuth = () => getAuthInstance();

// =============================================================================
// Types
// =============================================================================

export interface BugReportContext {
  /** The game type (e.g. "chess_game") */
  gameType?: string;
  /** Firestore game document ID */
  firestoreGameId?: string;
  /** Colyseus room ID */
  roomId?: string;
  /** Invite ID */
  inviteId?: string;
  /** Trace ID for correlation */
  traceId?: string;
  /** Error code (from GameErrorCode) */
  errorCode?: string;
  /** Error message */
  errorMessage?: string;
  /** Room phase at time of report */
  roomPhase?: string;
  /** Lobby phase at time of report */
  lobbyPhase?: string;
  /** Whether the connection was stale */
  wasStale?: boolean;
  /** Seconds since last patch at time of report */
  staleDurationSec?: number;
  /** Any additional context */
  [key: string]: unknown;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Submit a bug report to Firestore with full game context.
 *
 * @param context - Game state context at the time of the bug
 * @param userNote - Optional user-provided description
 * @returns The Firestore document ID of the created report
 */
export async function submitBugReport(
  context: BugReportContext,
  userNote?: string,
): Promise<string> {
  try {
    const user = getAuth().currentUser;
    if (!user) {
      throw new Error("Must be authenticated to submit bug reports.");
    }
    const buildInfo = getClientBuildInfo();

    const report = {
      // Who
      uid: user.uid,
      displayName: user.displayName ?? user.email ?? user.uid,

      // What
      errorCode: context.errorCode ?? null,
      errorMessage: context.errorMessage ?? null,
      userNote: userNote ?? null,

      // Where
      gameType: context.gameType ?? null,
      firestoreGameId: context.firestoreGameId ?? null,
      roomId: context.roomId ?? null,
      inviteId: context.inviteId ?? null,
      traceId: context.traceId ?? null,

      // State snapshot
      roomPhase: context.roomPhase ?? null,
      lobbyPhase: context.lobbyPhase ?? null,
      wasStale: context.wasStale ?? false,
      staleDurationSec: context.staleDurationSec ?? 0,

      // Build info
      appVersion: buildInfo.appVersion,
      platform: buildInfo.platform,
      protocolVersion: buildInfo.protocolVersion,
      commitHash: buildInfo.commitHash ?? null,

      // Meta
      createdAt: serverTimestamp(),
      status: "new",
    };

    const docRef = await addDoc(collection(getDb(), "BugReports"), report);

    logger.info(
      `[BugReport] Submitted: ${docRef.id} (error=${context.errorCode})`,
    );

    return docRef.id;
  } catch (err: any) {
    logger.error("[BugReport] Failed to submit:", err);
    throw err;
  }
}

// =============================================================================
// Convenience wrapper
// =============================================================================

/**
 * Simplified bug-report API.
 *
 * Accepts the same shape the Debug HUD or error overlays naturally produce:
 *   recordBugReport({ code: "JOIN_TIMEOUT", userMessage: "stuck", context: { roomId, traceId, … } })
 *
 * Delegates to submitBugReport internally.
 *
 * @returns The Firestore document ID.
 */
export async function recordBugReport(input: {
  /** GameErrorCode (or any string code). */
  code?: string;
  /** User-facing description or note. */
  userMessage?: string;
  /** Arbitrary context — will be spread into BugReportContext. */
  context?: Record<string, unknown>;
}): Promise<string> {
  const { code, userMessage, context = {} } = input;

  const bugCtx: BugReportContext = {
    ...context,
    errorCode: code ?? (context.errorCode as string) ?? undefined,
    errorMessage: (context.errorMessage as string) ?? userMessage ?? undefined,
  };

  return submitBugReport(bugCtx, userMessage);
}
