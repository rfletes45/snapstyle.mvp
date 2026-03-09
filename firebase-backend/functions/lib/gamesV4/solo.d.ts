/**
 * Games V4 — Solo Session Callables
 *
 * Supports two solo modes:
 * - "standard" — current run-based behaviour (2048, Minesweeper, etc.)
 * - "persistent" — long-lived idle/incremental (no games currently use this)
 *
 * Persistent solo games:
 * - always save/suspend on exit (no resign, no resolve)
 * - resume the same active session on re-entry
 * - support deterministic offline progression on resume
 * - finalize only via explicit archiveSoloSessionV4
 *
 * Callables:
 *   createSoloSessionV4
 *   resumeOrCreateSoloSessionV4
 *   restartSoloSessionV4
 *   suspendSoloSessionV4
 *   archiveSoloSessionV4  (NEW — persistent solo finalization)
 *
 * @module gamesV4/solo
 */
import * as functions from "firebase-functions";
export declare const createSoloSessionV4: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Looks for an existing active (unresolved) solo session for the given
 * user + gameId.  If found, clears `soloSuspendedAt` (marks it as resumed)
 * and returns it.  Otherwise creates a brand-new solo session.
 *
 * This is the **primary entry point** for launching solo games from the hub.
 */
export declare const resumeOrCreateSoloSessionV4: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Restart a solo game: resign/resolve the current session, then create a
 * fresh solo session for the same game.  This uses the existing resolve
 * pipeline (Option A from the spec) to avoid orphaned sessions.
 */
export declare const restartSoloSessionV4: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Mark a solo session as suspended (player leaving via back arrow).
 * Sets `soloSuspendedAt` timestamp. Does NOT resolve the session.
 */
export declare const suspendSoloSessionV4: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Explicitly archive/finalize a persistent solo run.
 *
 * This is the ONLY path that creates a terminal result for persistent solo.
 * Exiting the game, suspending, or being idle does NOT resolve the session.
 *
 * Steps:
 *  1. Validate ownership and session state.
 *  2. Optionally run adapter.archiveRun() for custom summary/scoreboard.
 *  3. Delegate to resolveSessionV4Internal (the single chokepoint) to:
 *     - Mark session resolved
 *     - Create GameResultV4
 *     - Compute XP, achievements, leaderboards, PBs
 *  4. Return success + sessionId for the client to navigate to Game Over.
 *
 * Only valid for persistent solo sessions (soloMode === "persistent").
 */
export declare const archiveSoloSessionV4: functions.HttpsFunction & functions.Runnable<any>;
