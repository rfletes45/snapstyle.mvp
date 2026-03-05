/**
 * Games V4 — Session Callables (Turn Submission + Resign)
 *
 * Callables:
 * - submitTurnMoveV4: submit a turn move (turn-based games)
 * - resignSessionV4: resign from an active session
 *
 * Both funnel terminal conditions through resolveSessionV4Internal.
 *
 * @module gamesV4/sessions
 */
import * as functions from "firebase-functions";
export declare const submitTurnMoveV4: functions.HttpsFunction & functions.Runnable<any>;
export declare const resignSessionV4: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Resolve a realtime session from the Colyseus persistence bridge.
 * This is NOT a callable — it's exported for use by the Colyseus bridge.
 */
export declare function resolveRealtimeSessionV4(sessionId: string, resolutionType: "win" | "draw" | "disconnect" | "timeout" | "error", winnerIds: string[], scoreboard?: Array<{
    uid: string;
    displayName: string;
    score: number;
    placement: number;
    stats: Record<string, unknown>;
}>): Promise<void>;
