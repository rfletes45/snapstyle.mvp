"use strict";
/** Cloud Functions entrypoint (imports/re-exports only). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMessageSentTaskProgress = exports.onMessageRequestCreatedNotification = exports.onGroupMessageInbox = exports.onGroupMemberStateChanged = exports.onFriendRequestAccepted = exports.onFriendAddedTaskProgress = exports.onDMMessageInbox = exports.onDMMemberStateChanged = exports.onDeleteMessage = exports.mintChatMediaUrl = exports.markInboxRead = exports.initializeFirstAdmin = exports.initializeExistingWallets = exports.incrementProfileViews = exports.grantItem = exports.grantCosmeticEntitlement = exports.getRateLimitStatus = exports.getPurchaseHistory = exports.getGiftHistory = exports.generateWeeklyDeals = exports.generateDailyDeals = exports.expireGifts = exports.declineMessageRequest = exports.cleanupStagingOrphans = exports.cleanupOldScheduledMessages = exports.cleanupOldDeals = exports.cleanupExpiredStories = exports.cleanupExpiredSnaps = exports.cleanupExpiredPushTokens = exports.claimTaskReward = exports.checkMessageRateLimit = exports.adminSetBan = exports.adminSetAdminClaim = exports.adminResolveReport = exports.adminLiftBan = exports.adminApplyWarning = exports.adminApplyStrike = exports.acceptMessageRequest = exports.fetchLinkPreview = exports.toggleReactionV2 = exports.deleteMessageForAllV2 = exports.editMessageV2 = exports.sendMessageV2 = exports.sendExpoPushNotification = exports.sanitizeForLog = exports.isValidUid = exports.isValidString = exports.isGroupChatMuted = exports.isDmChatMuted = exports.getUserPushToken = void 0;
exports.onRealtimeResolutionRequest = exports.onGameInviteV4Deleted = exports.leaveInviteLobbyV4 = exports.joinInviteLobbyV4 = exports.createSoloSessionV4 = exports.createGameInviteV4 = exports.claimLevelRewardV4 = exports.claimAchievementV4 = exports.claimAchievementSectionBadgeV4 = exports.cancelGameInviteV4 = exports.adminClearGameV4 = exports.adminClearConversationGamesV4 = exports.onInboxSettingsChanged = exports.onChatSettingsChanged = exports.verifyIAPPurchase = exports.streamCallWebhook = exports.getStreamVideoToken = exports.ensureStreamUsers = exports.onGroupDeleted = exports.onGroupBackgroundRemoved = exports.deleteAccount = exports.validateReceipt = exports.updateExpiredBans = exports.triggerDailyDeals = exports.streakReminder = exports.sendGift = exports.sendFriendRequestWithRateLimit = exports.seedShopCatalog = exports.seedMonthlyTasks = exports.seedDailyTasks = exports.restorePurchases = exports.recordDailyLogin = exports.purchaseWithTokens = exports.purchaseCosmeticWithTokens = exports.publishTypingIndicator = exports.publishReadReceipt = exports.publishDeliveryReceipt = exports.processScheduledMessages = exports.openGift = exports.onUserCreated = exports.onStoryViewedTaskProgress = exports.onStoryViewed = exports.onStoryPostedTaskProgress = exports.onScheduledMessageCreated = exports.onPushTokenRegistered = exports.onNewReport = exports.onNewMessageEvent = exports.onNewMessage = exports.onNewGroupMessageV2 = exports.onNewFriendRequest = void 0;
exports.updateContactDiscoverySettings = exports.syncContacts = exports.removeSyncedContacts = exports.matchContacts = exports.getContactRecommendations = exports.watchdogGamesV4 = exports.updateLobbySettingsV4 = exports.suspendSoloSessionV4 = exports.submitTurnMoveV4 = exports.startGameFromInviteV4 = exports.resumeOrCreateSoloSessionV4 = exports.restartSoloSessionV4 = exports.resignSessionV4 = exports.onSessionV4StatusChanged = void 0;
// Initialize Firebase Admin SDK BEFORE any module accesses admin services.
require("./adminInit");
// V2 Messaging
const messaging_1 = require("./messaging");
// Shop/IAP/Gifting/Deals/Preview
const dailyDeals_1 = require("./dailyDeals");
Object.defineProperty(exports, "cleanupOldDeals", { enumerable: true, get: function () { return dailyDeals_1.cleanupOldDeals; } });
Object.defineProperty(exports, "generateDailyDeals", { enumerable: true, get: function () { return dailyDeals_1.generateDailyDeals; } });
Object.defineProperty(exports, "generateWeeklyDeals", { enumerable: true, get: function () { return dailyDeals_1.generateWeeklyDeals; } });
Object.defineProperty(exports, "triggerDailyDeals", { enumerable: true, get: function () { return dailyDeals_1.triggerDailyDeals; } });
const gifting_1 = require("./gifting");
Object.defineProperty(exports, "expireGifts", { enumerable: true, get: function () { return gifting_1.expireGifts; } });
Object.defineProperty(exports, "getGiftHistory", { enumerable: true, get: function () { return gifting_1.getGiftHistory; } });
Object.defineProperty(exports, "openGift", { enumerable: true, get: function () { return gifting_1.openGift; } });
Object.defineProperty(exports, "sendGift", { enumerable: true, get: function () { return gifting_1.sendGift; } });
const iap_1 = require("./iap");
Object.defineProperty(exports, "getPurchaseHistory", { enumerable: true, get: function () { return iap_1.getPurchaseHistory; } });
Object.defineProperty(exports, "restorePurchases", { enumerable: true, get: function () { return iap_1.restorePurchases; } });
Object.defineProperty(exports, "validateReceipt", { enumerable: true, get: function () { return iap_1.validateReceipt; } });
const linkPreview_1 = require("./linkPreview");
const shop_1 = require("./shop");
Object.defineProperty(exports, "grantItem", { enumerable: true, get: function () { return shop_1.grantItem; } });
Object.defineProperty(exports, "purchaseWithTokens", { enumerable: true, get: function () { return shop_1.purchaseWithTokens; } });
// Cosmetic entitlements (unified cosmetics system)
const cosmeticEntitlements_1 = require("./cosmeticEntitlements");
Object.defineProperty(exports, "grantCosmeticEntitlement", { enumerable: true, get: function () { return cosmeticEntitlements_1.grantCosmeticEntitlement; } });
Object.defineProperty(exports, "purchaseCosmeticWithTokens", { enumerable: true, get: function () { return cosmeticEntitlements_1.purchaseCosmeticWithTokens; } });
// Extracted modules
const admin_1 = require("./admin");
Object.defineProperty(exports, "adminApplyStrike", { enumerable: true, get: function () { return admin_1.adminApplyStrike; } });
Object.defineProperty(exports, "adminApplyWarning", { enumerable: true, get: function () { return admin_1.adminApplyWarning; } });
Object.defineProperty(exports, "adminLiftBan", { enumerable: true, get: function () { return admin_1.adminLiftBan; } });
Object.defineProperty(exports, "adminResolveReport", { enumerable: true, get: function () { return admin_1.adminResolveReport; } });
Object.defineProperty(exports, "adminSetAdminClaim", { enumerable: true, get: function () { return admin_1.adminSetAdminClaim; } });
Object.defineProperty(exports, "adminSetBan", { enumerable: true, get: function () { return admin_1.adminSetBan; } });
Object.defineProperty(exports, "initializeFirstAdmin", { enumerable: true, get: function () { return admin_1.initializeFirstAdmin; } });
const economy_1 = require("./economy");
Object.defineProperty(exports, "claimTaskReward", { enumerable: true, get: function () { return economy_1.claimTaskReward; } });
Object.defineProperty(exports, "initializeExistingWallets", { enumerable: true, get: function () { return economy_1.initializeExistingWallets; } });
Object.defineProperty(exports, "onFriendAddedTaskProgress", { enumerable: true, get: function () { return economy_1.onFriendAddedTaskProgress; } });
Object.defineProperty(exports, "onMessageSentTaskProgress", { enumerable: true, get: function () { return economy_1.onMessageSentTaskProgress; } });
Object.defineProperty(exports, "onStoryPostedTaskProgress", { enumerable: true, get: function () { return economy_1.onStoryPostedTaskProgress; } });
Object.defineProperty(exports, "onStoryViewedTaskProgress", { enumerable: true, get: function () { return economy_1.onStoryViewedTaskProgress; } });
Object.defineProperty(exports, "onUserCreated", { enumerable: true, get: function () { return economy_1.onUserCreated; } });
Object.defineProperty(exports, "recordDailyLogin", { enumerable: true, get: function () { return economy_1.recordDailyLogin; } });
Object.defineProperty(exports, "seedDailyTasks", { enumerable: true, get: function () { return economy_1.seedDailyTasks; } });
Object.defineProperty(exports, "seedMonthlyTasks", { enumerable: true, get: function () { return economy_1.seedMonthlyTasks; } });
const moderation_1 = require("./moderation");
Object.defineProperty(exports, "checkMessageRateLimit", { enumerable: true, get: function () { return moderation_1.checkMessageRateLimit; } });
Object.defineProperty(exports, "onNewMessageEvent", { enumerable: true, get: function () { return moderation_1.onNewMessageEvent; } });
Object.defineProperty(exports, "onNewReport", { enumerable: true, get: function () { return moderation_1.onNewReport; } });
Object.defineProperty(exports, "sendFriendRequestWithRateLimit", { enumerable: true, get: function () { return moderation_1.sendFriendRequestWithRateLimit; } });
Object.defineProperty(exports, "updateExpiredBans", { enumerable: true, get: function () { return moderation_1.updateExpiredBans; } });
const notifications_1 = require("./notifications");
Object.defineProperty(exports, "onMessageRequestCreatedNotification", { enumerable: true, get: function () { return notifications_1.onMessageRequestCreatedNotification; } });
Object.defineProperty(exports, "onNewGroupMessageV2", { enumerable: true, get: function () { return notifications_1.onNewGroupMessageV2; } });
Object.defineProperty(exports, "onNewMessage", { enumerable: true, get: function () { return notifications_1.onNewMessage; } });
Object.defineProperty(exports, "onPushTokenRegistered", { enumerable: true, get: function () { return notifications_1.onPushTokenRegistered; } });
const scheduled_1 = require("./scheduled");
Object.defineProperty(exports, "cleanupExpiredPushTokens", { enumerable: true, get: function () { return scheduled_1.cleanupExpiredPushTokens; } });
Object.defineProperty(exports, "cleanupExpiredSnaps", { enumerable: true, get: function () { return scheduled_1.cleanupExpiredSnaps; } });
Object.defineProperty(exports, "cleanupExpiredStories", { enumerable: true, get: function () { return scheduled_1.cleanupExpiredStories; } });
Object.defineProperty(exports, "cleanupOldScheduledMessages", { enumerable: true, get: function () { return scheduled_1.cleanupOldScheduledMessages; } });
Object.defineProperty(exports, "streakReminder", { enumerable: true, get: function () { return scheduled_1.streakReminder; } });
const scheduledMessages_1 = require("./scheduledMessages");
Object.defineProperty(exports, "onScheduledMessageCreated", { enumerable: true, get: function () { return scheduledMessages_1.onScheduledMessageCreated; } });
Object.defineProperty(exports, "processScheduledMessages", { enumerable: true, get: function () { return scheduledMessages_1.processScheduledMessages; } });
const social_1 = require("./social");
Object.defineProperty(exports, "onFriendRequestAccepted", { enumerable: true, get: function () { return social_1.onFriendRequestAccepted; } });
Object.defineProperty(exports, "onNewFriendRequest", { enumerable: true, get: function () { return social_1.onNewFriendRequest; } });
Object.defineProperty(exports, "onStoryViewed", { enumerable: true, get: function () { return social_1.onStoryViewed; } });
// Remaining legacy exports not covered by extracted modules.
const legacy_1 = require("./legacy");
Object.defineProperty(exports, "onDeleteMessage", { enumerable: true, get: function () { return legacy_1.onDeleteMessage; } });
Object.defineProperty(exports, "seedShopCatalog", { enumerable: true, get: function () { return legacy_1.seedShopCatalog; } });
// Chat Media Pipeline (Segment 3)
const chatMedia_1 = require("./chatMedia");
Object.defineProperty(exports, "cleanupStagingOrphans", { enumerable: true, get: function () { return chatMedia_1.cleanupStagingOrphans; } });
Object.defineProperty(exports, "mintChatMediaUrl", { enumerable: true, get: function () { return chatMedia_1.mintChatMediaUrl; } });
// Inbox Aggregation Triggers (Segment 4)
const inboxTriggers_1 = require("./inboxTriggers");
Object.defineProperty(exports, "markInboxRead", { enumerable: true, get: function () { return inboxTriggers_1.markInboxRead; } });
Object.defineProperty(exports, "onDMMemberStateChanged", { enumerable: true, get: function () { return inboxTriggers_1.onDMMemberStateChanged; } });
Object.defineProperty(exports, "onDMMessageInbox", { enumerable: true, get: function () { return inboxTriggers_1.onDMMessageInbox; } });
Object.defineProperty(exports, "onGroupMemberStateChanged", { enumerable: true, get: function () { return inboxTriggers_1.onGroupMemberStateChanged; } });
Object.defineProperty(exports, "onGroupMessageInbox", { enumerable: true, get: function () { return inboxTriggers_1.onGroupMessageInbox; } });
// Message Requests (Segment 5)
const messageRequests_1 = require("./messageRequests");
Object.defineProperty(exports, "acceptMessageRequest", { enumerable: true, get: function () { return messageRequests_1.acceptMessageRequest; } });
Object.defineProperty(exports, "declineMessageRequest", { enumerable: true, get: function () { return messageRequests_1.declineMessageRequest; } });
// Global Rate Limiter (Segment 6)
const rateLimiter_1 = require("./rateLimiter");
Object.defineProperty(exports, "getRateLimitStatus", { enumerable: true, get: function () { return rateLimiter_1.getRateLimitStatus; } });
// Account Deletion (comprehensive server-side cleanup)
const deleteAccount_1 = require("./deleteAccount");
// Group Cleanup (cascading subcollection + storage cleanup on group delete/background removal)
const groupCleanup_1 = require("./groupCleanup");
Object.defineProperty(exports, "onGroupBackgroundRemoved", { enumerable: true, get: function () { return groupCleanup_1.onGroupBackgroundRemoved; } });
Object.defineProperty(exports, "onGroupDeleted", { enumerable: true, get: function () { return groupCleanup_1.onGroupDeleted; } });
// Stream Video token issuance
const streamToken_1 = require("./streamToken");
Object.defineProperty(exports, "ensureStreamUsers", { enumerable: true, get: function () { return streamToken_1.ensureStreamUsers; } });
Object.defineProperty(exports, "getStreamVideoToken", { enumerable: true, get: function () { return streamToken_1.getStreamVideoToken; } });
// Stream Call History webhook
const streamCallHistory_1 = require("./streamCallHistory");
Object.defineProperty(exports, "streamCallWebhook", { enumerable: true, get: function () { return streamCallHistory_1.streamCallWebhook; } });
// Privacy-Enforced Publish APIs (Segment 7)
const privacyPublish_1 = require("./privacyPublish");
Object.defineProperty(exports, "onChatSettingsChanged", { enumerable: true, get: function () { return privacyPublish_1.onChatSettingsChanged; } });
Object.defineProperty(exports, "onInboxSettingsChanged", { enumerable: true, get: function () { return privacyPublish_1.onInboxSettingsChanged; } });
Object.defineProperty(exports, "publishDeliveryReceipt", { enumerable: true, get: function () { return privacyPublish_1.publishDeliveryReceipt; } });
Object.defineProperty(exports, "publishReadReceipt", { enumerable: true, get: function () { return privacyPublish_1.publishReadReceipt; } });
Object.defineProperty(exports, "publishTypingIndicator", { enumerable: true, get: function () { return privacyPublish_1.publishTypingIndicator; } });
// Profile Views (server-authoritative increment)
const profileViews_1 = require("./profileViews");
Object.defineProperty(exports, "incrementProfileViews", { enumerable: true, get: function () { return profileViews_1.incrementProfileViews; } });
// Games V4 — Full game system
const gamesV4_1 = require("./gamesV4");
Object.defineProperty(exports, "adminClearConversationGamesV4", { enumerable: true, get: function () { return gamesV4_1.adminClearConversationGamesV4; } });
Object.defineProperty(exports, "adminClearGameV4", { enumerable: true, get: function () { return gamesV4_1.adminClearGameV4; } });
Object.defineProperty(exports, "cancelGameInviteV4", { enumerable: true, get: function () { return gamesV4_1.cancelGameInviteV4; } });
Object.defineProperty(exports, "claimAchievementSectionBadgeV4", { enumerable: true, get: function () { return gamesV4_1.claimAchievementSectionBadgeV4; } });
Object.defineProperty(exports, "claimAchievementV4", { enumerable: true, get: function () { return gamesV4_1.claimAchievementV4; } });
Object.defineProperty(exports, "claimLevelRewardV4", { enumerable: true, get: function () { return gamesV4_1.claimLevelRewardV4; } });
Object.defineProperty(exports, "createGameInviteV4", { enumerable: true, get: function () { return gamesV4_1.createGameInviteV4; } });
Object.defineProperty(exports, "createSoloSessionV4", { enumerable: true, get: function () { return gamesV4_1.createSoloSessionV4; } });
Object.defineProperty(exports, "joinInviteLobbyV4", { enumerable: true, get: function () { return gamesV4_1.joinInviteLobbyV4; } });
Object.defineProperty(exports, "leaveInviteLobbyV4", { enumerable: true, get: function () { return gamesV4_1.leaveInviteLobbyV4; } });
Object.defineProperty(exports, "onGameInviteV4Deleted", { enumerable: true, get: function () { return gamesV4_1.onGameInviteV4Deleted; } });
Object.defineProperty(exports, "onRealtimeResolutionRequest", { enumerable: true, get: function () { return gamesV4_1.onRealtimeResolutionRequest; } });
Object.defineProperty(exports, "onSessionV4StatusChanged", { enumerable: true, get: function () { return gamesV4_1.onSessionV4StatusChanged; } });
Object.defineProperty(exports, "resignSessionV4", { enumerable: true, get: function () { return gamesV4_1.resignSessionV4; } });
Object.defineProperty(exports, "restartSoloSessionV4", { enumerable: true, get: function () { return gamesV4_1.restartSoloSessionV4; } });
Object.defineProperty(exports, "resumeOrCreateSoloSessionV4", { enumerable: true, get: function () { return gamesV4_1.resumeOrCreateSoloSessionV4; } });
Object.defineProperty(exports, "startGameFromInviteV4", { enumerable: true, get: function () { return gamesV4_1.startGameFromInviteV4; } });
Object.defineProperty(exports, "submitTurnMoveV4", { enumerable: true, get: function () { return gamesV4_1.submitTurnMoveV4; } });
Object.defineProperty(exports, "suspendSoloSessionV4", { enumerable: true, get: function () { return gamesV4_1.suspendSoloSessionV4; } });
Object.defineProperty(exports, "updateLobbySettingsV4", { enumerable: true, get: function () { return gamesV4_1.updateLobbySettingsV4; } });
Object.defineProperty(exports, "watchdogGamesV4", { enumerable: true, get: function () { return gamesV4_1.watchdogGamesV4; } });
// Utilities extracted from legacy index.
var utils_1 = require("./utils");
Object.defineProperty(exports, "getUserPushToken", { enumerable: true, get: function () { return utils_1.getUserPushToken; } });
Object.defineProperty(exports, "isDmChatMuted", { enumerable: true, get: function () { return utils_1.isDmChatMuted; } });
Object.defineProperty(exports, "isGroupChatMuted", { enumerable: true, get: function () { return utils_1.isGroupChatMuted; } });
Object.defineProperty(exports, "isValidString", { enumerable: true, get: function () { return utils_1.isValidString; } });
Object.defineProperty(exports, "isValidUid", { enumerable: true, get: function () { return utils_1.isValidUid; } });
Object.defineProperty(exports, "sanitizeForLog", { enumerable: true, get: function () { return utils_1.sanitizeForLog; } });
Object.defineProperty(exports, "sendExpoPushNotification", { enumerable: true, get: function () { return utils_1.sendExpoPushNotification; } });
// Keep deployed function names exactly stable.
exports.sendMessageV2 = messaging_1.sendMessageV2Function;
exports.editMessageV2 = messaging_1.editMessageV2Function;
exports.deleteMessageForAllV2 = messaging_1.deleteMessageForAllV2Function;
exports.toggleReactionV2 = messaging_1.toggleReactionV2Function;
exports.fetchLinkPreview = linkPreview_1.fetchLinkPreviewFunction;
// ─── Account Deletion ──────────────────────────────────────────────────────
exports.deleteAccount = deleteAccount_1.deleteAccountFunction;
// ─── Callable aliases for client backward-compat ───────────────────────────
// Client iap.ts calls "verifyIAPPurchase" — map it to the canonical handler.
exports.verifyIAPPurchase = iap_1.validateReceipt;
// ─── Contacts Matching & Discovery ─────────────────────────────────────
var contacts_1 = require("./contacts");
Object.defineProperty(exports, "getContactRecommendations", { enumerable: true, get: function () { return contacts_1.getContactRecommendations; } });
Object.defineProperty(exports, "matchContacts", { enumerable: true, get: function () { return contacts_1.matchContacts; } });
Object.defineProperty(exports, "removeSyncedContacts", { enumerable: true, get: function () { return contacts_1.removeSyncedContacts; } });
Object.defineProperty(exports, "syncContacts", { enumerable: true, get: function () { return contacts_1.syncContacts; } });
Object.defineProperty(exports, "updateContactDiscoverySettings", { enumerable: true, get: function () { return contacts_1.updateContactDiscoverySettings; } });
//# sourceMappingURL=index.js.map