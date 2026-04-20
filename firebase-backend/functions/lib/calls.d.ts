/**
 * ⚠️  DEPRECATED — LEGACY CALL SYSTEM (not deployed)
 *
 * This file contains Firestore-based WebRTC signaling functions from the
 * pre-Stream era.  **None of these functions are exported from index.ts**,
 * so they are NOT deployed to Cloud Functions.
 *
 * The active call system uses Stream Video:
 *   - Token issuance:   streamToken.ts  → getStreamVideoToken, ensureStreamUsers
 *   - Call history:     streamCallHistory.ts → streamCallWebhook
 *   - Client-side:      src/services/stream/*, src/contexts/StreamCallContext.tsx
 *
 * This file is kept for historical reference only.  Do NOT re-export any of
 * these functions without a full audit — the Firestore schema and push
 * notification contract they rely on no longer exists.
 *
 * @deprecated Superseded by Stream Video integration (2024-Q4).
 */
import * as functions from "firebase-functions";
export declare const onCallCreated: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
export declare const onCallUpdated: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
export declare const handleCallTimeouts: functions.CloudFunction<unknown>;
export declare const cleanupCallSignaling: functions.CloudFunction<unknown>;
export declare const getTurnCredentials: functions.HttpsFunction & functions.Runnable<any>;
