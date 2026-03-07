import * as functions from "firebase-functions";
import {
  onNewGroupMessageV2 as legacyOnNewGroupMessageV2,
  onNewMessage as legacyOnNewMessage,
} from "./legacy";

/**
 * Legacy push triggers can be disabled with env flag:
 *   CHAT_LEGACY_PUSH_ENABLED=false
 *
 * This keeps deployed trigger names stable while allowing staged migration
 * to in-app/modern notification channels without duplicate delivery.
 */
const legacyPushEnabled = process.env.CHAT_LEGACY_PUSH_ENABLED !== "false";

const noopDmTrigger = functions.firestore
  .document("Chats/{chatId}/Messages/{messageId}")
  .onCreate(async () => null);
const noopGroupTrigger = functions.firestore
  .document("Groups/{groupId}/Messages/{messageId}")
  .onCreate(async () => null);

export const onNewMessage = legacyPushEnabled
  ? legacyOnNewMessage
  : noopDmTrigger;

export const onNewGroupMessageV2 = legacyPushEnabled
  ? legacyOnNewGroupMessageV2
  : noopGroupTrigger;

