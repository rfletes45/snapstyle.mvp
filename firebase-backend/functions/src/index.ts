/** Cloud Functions entrypoint (imports/re-exports only). */

// V2 Messaging
import {
  deleteMessageForAllV2Function,
  editMessageV2Function,
  sendMessageV2Function,
  toggleReactionV2Function,
} from "./messaging";

// Games
import {
  cleanupOldGameSessions,
  cleanupOldGames,
  cleanupResolvedInvites,
  cleanupStaleMatchmakingEntries,
  createGameFromInvite,
  expireGameInvites,
  expireMatchmakingEntries,
  makeMove,
  onGameCompletedCreateHistory,
  onGameHistoryCreatedUpdateLeaderboard,
  onUniversalInviteUpdate,
  processGameCompletion,
  processMatchmakingQueue,
  resignGame,
} from "./games";

// Migrations
import {
  migrateGameInvites,
  migrateGameInvitesDryRun,
  rollbackGameInvitesMigration,
} from "./migrations/migrateGameInvites";

// Shop/IAP/Gifting/Deals/Calls/Preview
import { grantItem, purchaseWithTokens } from "./shop";
import { getPurchaseHistory, restorePurchases, validateReceipt } from "./iap";
import { expireGifts, getGiftHistory, openGift, sendGift } from "./gifting";
import {
  cleanupOldDeals,
  generateDailyDeals,
  generateWeeklyDeals,
  triggerDailyDeals,
} from "./dailyDeals";
import {
  cleanupCallSignaling,
  getTurnCredentials,
  handleCallTimeouts,
  onCallCreated,
  onCallUpdated,
} from "./calls";
import { fetchLinkPreviewFunction } from "./linkPreview";

// Extracted modules
import { onNewGroupMessageV2, onNewMessage } from "./notifications";
import { onNewFriendRequest, onStoryViewed } from "./social";
import {
  cleanupExpiredPushTokens,
  cleanupExpiredSnaps,
  cleanupExpiredStories,
  cleanupOldScheduledMessages,
  streakReminder,
} from "./scheduled";
import { onScheduledMessageCreated, processScheduledMessages } from "./scheduledMessages";
import {
  onGameSessionCreated,
  onStreakAchievementCheck,
  weeklyLeaderboardReset,
} from "./leaderboards";
import {
  claimTaskReward,
  initializeExistingWallets,
  onFriendAddedTaskProgress,
  onGamePlayedTaskProgress,
  onMessageSentTaskProgress,
  onStoryPostedTaskProgress,
  onStoryViewedTaskProgress,
  onUserCreated,
  recordDailyLogin,
  seedDailyTasks,
} from "./economy";
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
  checkMessageRateLimit,
  onNewMessageEvent,
  onNewReport,
  sendFriendRequestWithRateLimit,
  updateExpiredBans,
} from "./moderation";

// Remaining legacy exports not covered by extracted modules.
import { onDeleteMessage, seedShopCatalog } from "./legacy";

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
  adminApplyStrike,
  adminApplyWarning,
  adminLiftBan,
  adminResolveReport,
  adminSetAdminClaim,
  adminSetBan,
  checkMessageRateLimit,
  claimTaskReward,
  cleanupCallSignaling,
  cleanupExpiredPushTokens,
  cleanupExpiredSnaps,
  cleanupExpiredStories,
  cleanupOldDeals,
  cleanupOldGameSessions,
  cleanupOldGames,
  cleanupOldScheduledMessages,
  cleanupResolvedInvites,
  cleanupStaleMatchmakingEntries,
  createGameFromInvite,
  expireGameInvites,
  expireGifts,
  expireMatchmakingEntries,
  generateDailyDeals,
  generateWeeklyDeals,
  getGiftHistory,
  getPurchaseHistory,
  getTurnCredentials,
  grantItem,
  handleCallTimeouts,
  initializeExistingWallets,
  initializeFirstAdmin,
  makeMove,
  migrateGameInvites,
  migrateGameInvitesDryRun,
  onCallCreated,
  onCallUpdated,
  onDeleteMessage,
  onFriendAddedTaskProgress,
  onGameCompletedCreateHistory,
  onGameHistoryCreatedUpdateLeaderboard,
  onGamePlayedTaskProgress,
  onGameSessionCreated,
  onMessageSentTaskProgress,
  onNewFriendRequest,
  onNewGroupMessageV2,
  onNewMessage,
  onNewMessageEvent,
  onNewReport,
  onScheduledMessageCreated,
  onStoryPostedTaskProgress,
  onStoryViewed,
  onStoryViewedTaskProgress,
  onStreakAchievementCheck,
  onUniversalInviteUpdate,
  onUserCreated,
  openGift,
  processGameCompletion,
  processMatchmakingQueue,
  processScheduledMessages,
  purchaseWithTokens,
  recordDailyLogin,
  resignGame,
  restorePurchases,
  rollbackGameInvitesMigration,
  seedDailyTasks,
  seedShopCatalog,
  sendFriendRequestWithRateLimit,
  sendGift,
  streakReminder,
  triggerDailyDeals,
  updateExpiredBans,
  validateReceipt,
  weeklyLeaderboardReset,
};
