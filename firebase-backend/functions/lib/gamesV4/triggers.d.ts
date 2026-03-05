/**
 * Games V4 — Firestore Triggers
 *
 * Triggers:
 * - onGameInviteV4Deleted: cleanup when invite is hard-deleted (by TTL or watchdog)
 * - onSessionV4Updated: detect status transitions and fan-out side effects
 *
 * @module gamesV4/triggers
 */
import * as functions from "firebase-functions";
export declare const onGameInviteV4Deleted: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
export declare const onSessionV4StatusChanged: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
export declare const onRealtimeResolutionRequest: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
