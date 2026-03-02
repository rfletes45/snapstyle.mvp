/**
 * sessionsV3.ts — Cloud Function Callables for v3 Game Sessions
 *
 * These callables manage the `GameSessions/{sessionId}` lifecycle:
 *   createSessionV3  — host creates a session (lobby phase)
 *   joinSessionV3    — player/spectator joins an existing session
 *   leaveSessionV3   — participant leaves (host leaving → abandons session)
 *   startSessionV3   — host starts the game (lobby → starting → active)
 *
 * Design:
 *   - All mutations run inside a Firestore transaction for consistency.
 *   - Phase transitions are validated via `canTransitionPhase()`.
 *   - The session doc is the single source of truth (not the invite).
 *   - Types are inlined here because the Cloud Functions tsconfig.rootDir
 *     is `src/` and cannot import from `../../shared/sessions/`.
 *
 * @module firebase-backend/functions/src/sessionsV3
 */
import * as functions from "firebase-functions";
export declare const createSessionV3: functions.HttpsFunction & functions.Runnable<any>;
export declare const joinSessionV3: functions.HttpsFunction & functions.Runnable<any>;
export declare const leaveSessionV3: functions.HttpsFunction & functions.Runnable<any>;
export declare const startSessionV3: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Transition a session to "resolved" (or "abandoned") with resolution data.
 *
 * Called by:
 *   - Colyseus persistence bridge (room onDispose)
 *   - processGameCompletion / processRealtimeGameCompletion triggers
 *   - Client-side completion paths (via callable)
 *
 * Idempotent: if the session is already terminal, returns success.
 */
export declare const resolveSessionV3: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Send a game invite to a conversation (DM or group).
 *
 * Creates a `GameInvites` pointer doc so the chat's invite pill subscription
 * renders it immediately. Optionally stamps `conversationId` on the session
 * so `subscribeToConversationSessions` can discover it.
 *
 * INVARIANT: This function NEVER modifies `GameSessions.participants`.
 * Participants are only added by `joinSessionV3` (explicit Join action).
 */
export declare const inviteToSessionV3: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Scheduled function that runs every 15 minutes to:
 *
 * Pass 1: Expire lobby sessions past their TTL (expiresAt < now)
 * Pass 2: Abandon active sessions with no updates for 4 hours
 *
 * Both passes also finalize the linked v2 GameInvites doc so it
 * disappears from chat. This is belt-and-suspenders — the primary
 * finalization happens in resolveSessionV3 / room disposal, but the
 * watchdog catches anything that slipped through.
 *
 * Idempotent — safe to run concurrently or with overlapping windows.
 */
export declare const watchdogSessionsV3: functions.CloudFunction<unknown>;
