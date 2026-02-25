"use strict";
/** Cloud Functions entrypoint (imports/re-exports only). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeExistingWallets = exports.incrementProfileViews = exports.handleCallTimeouts = exports.grantItem = exports.grantCosmeticEntitlement = exports.getTurnCredentials = exports.getRateLimitStatus = exports.getPurchaseHistory = exports.getGiftHistory = exports.generateWeeklyDeals = exports.generateDailyDeals = exports.expireMatchmakingEntries = exports.expireGifts = exports.expireGameInvites = exports.declineMessageRequest = exports.createGameFromInvite = exports.cleanupVacantGames = exports.cleanupStaleMatchmakingEntries = exports.cleanupStagingOrphans = exports.cleanupResolvedInvites = exports.cleanupOldScheduledMessages = exports.cleanupOldGames = exports.cleanupOldGameSessions = exports.cleanupOldDeals = exports.cleanupExpiredStories = exports.cleanupExpiredSnaps = exports.cleanupExpiredPushTokens = exports.cleanupCallSignaling = exports.claimTaskReward = exports.claimLevelReward = exports.checkMessageRateLimit = exports.adminSetBan = exports.adminSetAdminClaim = exports.adminResolveReport = exports.adminLiftBan = exports.adminApplyWarning = exports.adminApplyStrike = exports.acceptMessageRequest = exports.fetchLinkPreview = exports.toggleReactionV2 = exports.deleteMessageForAllV2 = exports.editMessageV2 = exports.sendMessageV2 = exports.sendExpoPushNotification = exports.sanitizeForLog = exports.isValidUid = exports.isValidString = exports.isGroupChatMuted = exports.isDmChatMuted = exports.getUserPushToken = void 0;
exports.sendGift = exports.sendFriendRequestWithRateLimit = exports.seedShopCatalog = exports.seedMonthlyTasks = exports.seedDailyTasks = exports.rollbackGameInvitesMigration = exports.restorePurchases = exports.resignGame = exports.recordDailyLogin = exports.purchaseWithTokens = exports.purchaseCosmeticWithTokens = exports.publishTypingIndicator = exports.publishReadReceipt = exports.publishDeliveryReceipt = exports.processSinglePlayerCompletion = exports.processScheduledMessages = exports.processRealtimeGameCompletion = exports.processMatchmakingQueue = exports.processGameCompletion = exports.openGift = exports.onUserCreated = exports.onUniversalInviteUpdate = exports.onStreakAchievementCheck = exports.onStoryViewedTaskProgress = exports.onStoryViewed = exports.onStoryPostedTaskProgress = exports.onScheduledMessageCreated = exports.onNewReport = exports.onNewMessageEvent = exports.onNewMessage = exports.onNewGroupMessageV2 = exports.onNewFriendRequest = exports.onMessageSentTaskProgress = exports.onGroupMessageInbox = exports.onGameSessionCreated = exports.onGameResult = exports.onGamePlayedTaskProgress = exports.onGameHistoryCreatedUpdateLeaderboard = exports.onGameCompletedCreateHistory = exports.onFriendAddedTaskProgress = exports.onDeleteMessage = exports.onDMMessageInbox = exports.onCallUpdated = exports.onCallCreated = exports.mintChatMediaUrl = exports.migrateGameInvitesDryRun = exports.migrateGameInvites = exports.markInboxRead = exports.makeMove = exports.initializeFirstAdmin = void 0;
exports.onInboxSettingsChanged = exports.onChatSettingsChanged = exports.verifyIAPPurchase = exports.weeklyLeaderboardReset = exports.validateReceipt = exports.updateExpiredBans = exports.triggerDailyDeals = exports.streakReminder = void 0;
// V2 Messaging
const messaging_1 = require("./messaging");
// Games
const games_1 = require("./games");
Object.defineProperty(exports, "claimLevelReward", { enumerable: true, get: function () { return games_1.claimLevelReward; } });
Object.defineProperty(exports, "cleanupOldGameSessions", { enumerable: true, get: function () { return games_1.cleanupOldGameSessions; } });
Object.defineProperty(exports, "cleanupOldGames", { enumerable: true, get: function () { return games_1.cleanupOldGames; } });
Object.defineProperty(exports, "cleanupResolvedInvites", { enumerable: true, get: function () { return games_1.cleanupResolvedInvites; } });
Object.defineProperty(exports, "cleanupStaleMatchmakingEntries", { enumerable: true, get: function () { return games_1.cleanupStaleMatchmakingEntries; } });
Object.defineProperty(exports, "cleanupVacantGames", { enumerable: true, get: function () { return games_1.cleanupVacantGames; } });
Object.defineProperty(exports, "createGameFromInvite", { enumerable: true, get: function () { return games_1.createGameFromInvite; } });
Object.defineProperty(exports, "expireGameInvites", { enumerable: true, get: function () { return games_1.expireGameInvites; } });
Object.defineProperty(exports, "expireMatchmakingEntries", { enumerable: true, get: function () { return games_1.expireMatchmakingEntries; } });
Object.defineProperty(exports, "makeMove", { enumerable: true, get: function () { return games_1.makeMove; } });
Object.defineProperty(exports, "onGameCompletedCreateHistory", { enumerable: true, get: function () { return games_1.onGameCompletedCreateHistory; } });
Object.defineProperty(exports, "onGameHistoryCreatedUpdateLeaderboard", { enumerable: true, get: function () { return games_1.onGameHistoryCreatedUpdateLeaderboard; } });
Object.defineProperty(exports, "onGameResult", { enumerable: true, get: function () { return games_1.onGameResult; } });
Object.defineProperty(exports, "onUniversalInviteUpdate", { enumerable: true, get: function () { return games_1.onUniversalInviteUpdate; } });
Object.defineProperty(exports, "processGameCompletion", { enumerable: true, get: function () { return games_1.processGameCompletion; } });
Object.defineProperty(exports, "processMatchmakingQueue", { enumerable: true, get: function () { return games_1.processMatchmakingQueue; } });
Object.defineProperty(exports, "processRealtimeGameCompletion", { enumerable: true, get: function () { return games_1.processRealtimeGameCompletion; } });
Object.defineProperty(exports, "resignGame", { enumerable: true, get: function () { return games_1.resignGame; } });
// Migrations
const migrateGameInvites_1 = require("./migrations/migrateGameInvites");
Object.defineProperty(exports, "migrateGameInvites", { enumerable: true, get: function () { return migrateGameInvites_1.migrateGameInvites; } });
Object.defineProperty(exports, "migrateGameInvitesDryRun", { enumerable: true, get: function () { return migrateGameInvites_1.migrateGameInvitesDryRun; } });
Object.defineProperty(exports, "rollbackGameInvitesMigration", { enumerable: true, get: function () { return migrateGameInvites_1.rollbackGameInvitesMigration; } });
// Shop/IAP/Gifting/Deals/Calls/Preview
const calls_1 = require("./calls");
Object.defineProperty(exports, "cleanupCallSignaling", { enumerable: true, get: function () { return calls_1.cleanupCallSignaling; } });
Object.defineProperty(exports, "getTurnCredentials", { enumerable: true, get: function () { return calls_1.getTurnCredentials; } });
Object.defineProperty(exports, "handleCallTimeouts", { enumerable: true, get: function () { return calls_1.handleCallTimeouts; } });
Object.defineProperty(exports, "onCallCreated", { enumerable: true, get: function () { return calls_1.onCallCreated; } });
Object.defineProperty(exports, "onCallUpdated", { enumerable: true, get: function () { return calls_1.onCallUpdated; } });
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
// Achievements V2 (single-player completion trigger)
const achievementsV2Evaluator_1 = require("./achievementsV2Evaluator");
Object.defineProperty(exports, "processSinglePlayerCompletion", { enumerable: true, get: function () { return achievementsV2Evaluator_1.processSinglePlayerCompletion; } });
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
Object.defineProperty(exports, "onGamePlayedTaskProgress", { enumerable: true, get: function () { return economy_1.onGamePlayedTaskProgress; } });
Object.defineProperty(exports, "onMessageSentTaskProgress", { enumerable: true, get: function () { return economy_1.onMessageSentTaskProgress; } });
Object.defineProperty(exports, "onStoryPostedTaskProgress", { enumerable: true, get: function () { return economy_1.onStoryPostedTaskProgress; } });
Object.defineProperty(exports, "onStoryViewedTaskProgress", { enumerable: true, get: function () { return economy_1.onStoryViewedTaskProgress; } });
Object.defineProperty(exports, "onUserCreated", { enumerable: true, get: function () { return economy_1.onUserCreated; } });
Object.defineProperty(exports, "recordDailyLogin", { enumerable: true, get: function () { return economy_1.recordDailyLogin; } });
Object.defineProperty(exports, "seedDailyTasks", { enumerable: true, get: function () { return economy_1.seedDailyTasks; } });
Object.defineProperty(exports, "seedMonthlyTasks", { enumerable: true, get: function () { return economy_1.seedMonthlyTasks; } });
const leaderboards_1 = require("./leaderboards");
Object.defineProperty(exports, "onGameSessionCreated", { enumerable: true, get: function () { return leaderboards_1.onGameSessionCreated; } });
Object.defineProperty(exports, "onStreakAchievementCheck", { enumerable: true, get: function () { return leaderboards_1.onStreakAchievementCheck; } });
Object.defineProperty(exports, "weeklyLeaderboardReset", { enumerable: true, get: function () { return leaderboards_1.weeklyLeaderboardReset; } });
const moderation_1 = require("./moderation");
Object.defineProperty(exports, "checkMessageRateLimit", { enumerable: true, get: function () { return moderation_1.checkMessageRateLimit; } });
Object.defineProperty(exports, "onNewMessageEvent", { enumerable: true, get: function () { return moderation_1.onNewMessageEvent; } });
Object.defineProperty(exports, "onNewReport", { enumerable: true, get: function () { return moderation_1.onNewReport; } });
Object.defineProperty(exports, "sendFriendRequestWithRateLimit", { enumerable: true, get: function () { return moderation_1.sendFriendRequestWithRateLimit; } });
Object.defineProperty(exports, "updateExpiredBans", { enumerable: true, get: function () { return moderation_1.updateExpiredBans; } });
const notifications_1 = require("./notifications");
Object.defineProperty(exports, "onNewGroupMessageV2", { enumerable: true, get: function () { return notifications_1.onNewGroupMessageV2; } });
Object.defineProperty(exports, "onNewMessage", { enumerable: true, get: function () { return notifications_1.onNewMessage; } });
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
Object.defineProperty(exports, "onDMMessageInbox", { enumerable: true, get: function () { return inboxTriggers_1.onDMMessageInbox; } });
Object.defineProperty(exports, "onGroupMessageInbox", { enumerable: true, get: function () { return inboxTriggers_1.onGroupMessageInbox; } });
// Message Requests (Segment 5)
const messageRequests_1 = require("./messageRequests");
Object.defineProperty(exports, "acceptMessageRequest", { enumerable: true, get: function () { return messageRequests_1.acceptMessageRequest; } });
Object.defineProperty(exports, "declineMessageRequest", { enumerable: true, get: function () { return messageRequests_1.declineMessageRequest; } });
// Global Rate Limiter (Segment 6)
const rateLimiter_1 = require("./rateLimiter");
Object.defineProperty(exports, "getRateLimitStatus", { enumerable: true, get: function () { return rateLimiter_1.getRateLimitStatus; } });
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
// ─── Callable aliases for client backward-compat ───────────────────────────
// Client iap.ts calls "verifyIAPPurchase" — map it to the canonical handler.
exports.verifyIAPPurchase = iap_1.validateReceipt;
//# sourceMappingURL=index.js.map