import * as functions from "firebase-functions";
export declare const onNewMessage: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
export declare const onNewGroupMessageV2: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
export declare const onMessageRequestCreatedNotification: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * Enforce push-token uniqueness across users.
 *
 * When a NotificationDevice document is created or updated with a non-null
 * push token, this trigger searches for ALL other users' NotificationDevices
 * documents that share the same token and invalidates them.  This prevents
 * the "stale token after account switch" bug where a device token remains
 * active under a previous user.
 */
export declare const onPushTokenRegistered: functions.CloudFunction<functions.Change<functions.firestore.DocumentSnapshot>>;
