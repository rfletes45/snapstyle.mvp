import * as functions from "firebase-functions";
export declare const onNewMessage: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
export declare const onNewGroupMessageV2: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
export declare const onMessageRequestCreatedNotification: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
