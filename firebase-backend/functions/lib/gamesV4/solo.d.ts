/**
 * Games V4 — Solo Session Creation
 *
 * Callable: createSoloSessionV4
 *
 * Creates a GameSessionV4 directly for a solo game (e.g. 2048),
 * bypassing the invite system entirely. Solo games don't need
 * lobbies, invites, or conversation pinning — the player taps
 * "Play" from the Games Hub and immediately enters the game.
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
