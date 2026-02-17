/**
 * Cloud Functions for Call System
 * Handles call notifications, timeouts, and history recording
 */
import * as functions from "firebase-functions";
export declare const onCallCreated: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
export declare const onCallUpdated: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
export declare const handleCallTimeouts: functions.CloudFunction<unknown>;
export declare const cleanupCallSignaling: functions.CloudFunction<unknown>;
export declare const getTurnCredentials: functions.HttpsFunction & functions.Runnable<any>;
export declare const registerVoIPToken: functions.HttpsFunction & functions.Runnable<any>;
export declare const sendCallNotification: functions.HttpsFunction & functions.Runnable<any>;
export declare const cancelCall: functions.HttpsFunction & functions.Runnable<any>;
export declare const onGroupCallInviteCreated: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
export declare const onGroupCallParticipantJoined: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
export declare const onGroupCallHostAction: functions.HttpsFunction & functions.Runnable<any>;
