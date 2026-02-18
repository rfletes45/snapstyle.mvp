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
