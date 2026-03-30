/** Cloud Functions entrypoint (imports/re-exports only). */

// Initialize Firebase Admin SDK BEFORE any module accesses admin services.
import "./adminInit";

// V2 Messaging
import {
  deleteMessageForAllV2Function,
  editMessageV2Function,
  sendMessageV2Function,
  toggleReactionV2Function,
} from "./messaging";

// Shop/IAP/Gifting/Deals/Preview
import {
  cleanupOldDeals,
  generateDailyDeals,
  generateWeeklyDeals,
  triggerDailyDeals,
} from "./dailyDeals";
import { expireGifts, getGiftHistory, openGift, sendGift } from "./gifting";
import { getPurchaseHistory, restorePurchases, validateReceipt } from "./iap";
import { fetchLinkPreviewFunction } from "./linkPreview";
import { grantItem, purchaseWithTokens } from "./shop";

// Cosmetic entitlements (unified cosmetics system)
import {
  grantCosmeticEntitlement,
  purchaseCosmeticWithTokens,
} from "./cosmeticEntitlements";

// Extracted modules
import {
  adminApplyStrike,
  adminApplyWarning,
  adminLiftBan,
  adminResolveReport,
  adminSetAdminClaim,
  adminSetBan,
  initializeFirstAdmin,
} from "./admin";
import {
  claimTaskReward,
  initializeExistingWallets,
  onFriendAddedTaskProgress,
  onMessageSentTaskProgress,
  onStoryPostedTaskProgress,
  onStoryViewedTaskProgress,
  onUserCreated,
  recordDailyLogin,
  seedDailyTasks,
  seedMonthlyTasks,
} from "./economy";
import {
  checkMessageRateLimit,
  onNewMessageEvent,
  onNewReport,
  sendFriendRequestWithRateLimit,
  updateExpiredBans,
} from "./moderation";
import {
  onMessageRequestCreatedNotification,
  onNewGroupMessageV2,
  onNewMessage,
  onPushTokenRegistered,
} from "./notifications";
import {
  cleanupExpiredPushTokens,
  cleanupExpiredSnaps,
  cleanupExpiredStories,
  cleanupOldScheduledMessages,
  streakReminder,
} from "./scheduled";
import {
  onScheduledMessageCreated,
  processScheduledMessages,
} from "./scheduledMessages";
import {
  onFriendRequestAccepted,
  onNewFriendRequest,
  onStoryViewed,
} from "./social";

// Remaining legacy exports not covered by extracted modules.
import { onDeleteMessage, seedShopCatalog } from "./legacy";

// Chat Media Pipeline (Segment 3)
import { cleanupStagingOrphans, mintChatMediaUrl } from "./chatMedia";

// Inbox Aggregation Triggers (Segment 4)
import {
  markInboxRead,
  onDMMessageInbox,
  onGroupMessageInbox,
} from "./inboxTriggers";

// Message Requests (Segment 5)
import { acceptMessageRequest, declineMessageRequest } from "./messageRequests";

// Global Rate Limiter (Segment 6)
import { getRateLimitStatus } from "./rateLimiter";

// Account Deletion (comprehensive server-side cleanup)
import { deleteAccountFunction } from "./deleteAccount";

// Stream Video token issuance
import { getStreamVideoToken } from "./streamToken";

// Stream Call History webhook
import { streamCallWebhook } from "./streamCallHistory";

// Privacy-Enforced Publish APIs (Segment 7)
import {
  onChatSettingsChanged,
  onInboxSettingsChanged,
  publishDeliveryReceipt,
  publishReadReceipt,
  publishTypingIndicator,
} from "./privacyPublish";

// Profile Views (server-authoritative increment)
import { incrementProfileViews } from "./profileViews";

// Games V4 — Full game system
import {
  adminClearConversationGamesV4,
  adminClearGameV4,
  cancelGameInviteV4,
  claimAchievementSectionBadgeV4,
  claimAchievementV4,
  claimLevelRewardV4,
  createGameInviteV4,
  createSoloSessionV4,
  joinInviteLobbyV4,
  leaveInviteLobbyV4,
  onGameInviteV4Deleted,
  onRealtimeResolutionRequest,
  onSessionV4StatusChanged,
  resignSessionV4,
  restartSoloSessionV4,
  resumeOrCreateSoloSessionV4,
  startGameFromInviteV4,
  submitTurnMoveV4,
  suspendSoloSessionV4,
  updateLobbySettingsV4,
  watchdogGamesV4,
} from "./gamesV4";

// Utilities extracted from legacy index.
export {
  getUserPushToken,
  isDmChatMuted,
  isGroupChatMuted,
  isValidString,
  isValidUid,
  sanitizeForLog,
  sendExpoPushNotification,
} from "./utils";
export type { ExpoPushMessage } from "./utils";

// Keep deployed function names exactly stable.
export const sendMessageV2 = sendMessageV2Function;
export const editMessageV2 = editMessageV2Function;
export const deleteMessageForAllV2 = deleteMessageForAllV2Function;
export const toggleReactionV2 = toggleReactionV2Function;
export const fetchLinkPreview = fetchLinkPreviewFunction;

export {
  acceptMessageRequest,
  adminApplyStrike,
  adminApplyWarning,
  adminLiftBan,
  adminResolveReport,
  adminSetAdminClaim,
  adminSetBan,
  checkMessageRateLimit,
  claimTaskReward,
  cleanupExpiredPushTokens,
  cleanupExpiredSnaps,
  cleanupExpiredStories,
  cleanupOldDeals,
  cleanupOldScheduledMessages,
  cleanupStagingOrphans,
  declineMessageRequest,
  expireGifts,
  generateDailyDeals,
  generateWeeklyDeals,
  getGiftHistory,
  getPurchaseHistory,
  getRateLimitStatus,
  grantCosmeticEntitlement,
  grantItem,
  incrementProfileViews,
  initializeExistingWallets,
  initializeFirstAdmin,
  markInboxRead,
  mintChatMediaUrl,
  onDeleteMessage,
  onDMMessageInbox,
  onFriendAddedTaskProgress,
  onFriendRequestAccepted,
  onGroupMessageInbox,
  onMessageRequestCreatedNotification,
  onMessageSentTaskProgress,
  onNewFriendRequest,
  onNewGroupMessageV2,
  onNewMessage,
  onNewMessageEvent,
  onNewReport,
  onPushTokenRegistered,
  onScheduledMessageCreated,
  onStoryPostedTaskProgress,
  onStoryViewed,
  onStoryViewedTaskProgress,
  onUserCreated,
  openGift,
  processScheduledMessages,
  publishDeliveryReceipt,
  publishReadReceipt,
  publishTypingIndicator,
  purchaseCosmeticWithTokens,
  purchaseWithTokens,
  recordDailyLogin,
  restorePurchases,
  seedDailyTasks,
  seedMonthlyTasks,
  seedShopCatalog,
  sendFriendRequestWithRateLimit,
  sendGift,
  streakReminder,
  triggerDailyDeals,
  updateExpiredBans,
  validateReceipt,
};

// ─── Account Deletion ──────────────────────────────────────────────────────
export const deleteAccount = deleteAccountFunction;

// ─── Stream Video ──────────────────────────────────────────────────────────
export { getStreamVideoToken, streamCallWebhook };

// ─── Callable aliases for client backward-compat ───────────────────────────
// Client iap.ts calls "verifyIAPPurchase" — map it to the canonical handler.
export const verifyIAPPurchase = validateReceipt;

// Segment 7 Firestore triggers (named exports for stable function names)
export { onChatSettingsChanged, onInboxSettingsChanged };

// ─── Games V4 ──────────────────────────────────────────────────────────────
export {
  adminClearConversationGamesV4,
  adminClearGameV4,
  cancelGameInviteV4,
  claimAchievementSectionBadgeV4,
  claimAchievementV4,
  claimLevelRewardV4,
  createGameInviteV4,
  createSoloSessionV4,
  joinInviteLobbyV4,
  leaveInviteLobbyV4,
  onGameInviteV4Deleted,
  onRealtimeResolutionRequest,
  onSessionV4StatusChanged,
  resignSessionV4,
  restartSoloSessionV4,
  resumeOrCreateSoloSessionV4,
  startGameFromInviteV4,
  submitTurnMoveV4,
  suspendSoloSessionV4,
  updateLobbySettingsV4,
  watchdogGamesV4,
};

// ─── Contacts Matching ─────────────────────────────────────────────────────
export { matchContacts } from "./contacts";
