/**
 * Games V4 — Backend Module Index
 *
 * Barrel exports for all V4 Cloud Functions.
 * Import in the main index.ts and re-export.
 *
 * @module gamesV4/index
 */
export { claimAchievementV4 } from "./claimAchievement";
export { claimAchievementSectionBadgeV4 } from "./claimSectionBadge";
export { createGameInviteV4 } from "./invites";
export { claimLevelRewardV4 } from "./levelRewardsV4";
export { cancelGameInviteV4, joinInviteLobbyV4, leaveInviteLobbyV4, startGameFromInviteV4, updateLobbySettingsV4, } from "./lobby";
export { adminClearConversationGamesV4, adminClearGameV4 } from "./moderation";
export { resignSessionV4, resolveRealtimeSessionV4, submitTurnMoveV4, } from "./sessions";
export { archiveSoloSessionV4, createSoloSessionV4, restartSoloSessionV4, resumeOrCreateSoloSessionV4, suspendSoloSessionV4, } from "./solo";
export { onGameInviteV4Deleted, onRealtimeResolutionRequest, onSessionV4StatusChanged, } from "./triggers";
export { watchdogGamesV4 } from "./watchdog";
export { resolveSessionV4Internal } from "./resolve";
