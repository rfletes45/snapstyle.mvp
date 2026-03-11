import * as functions from "firebase-functions";
import { onStoryViewed } from "./legacy";
export declare const onNewFriendRequest: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
export declare const onFriendRequestAccepted: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
export { onStoryViewed };
