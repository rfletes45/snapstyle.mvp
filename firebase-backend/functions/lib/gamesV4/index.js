"use strict";
/**
 * Games V4 — Backend Module Index
 *
 * Barrel exports for all V4 Cloud Functions.
 * Import in the main index.ts and re-export.
 *
 * @module gamesV4/index
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSessionV4Internal = exports.watchdogGamesV4 = exports.onSessionV4StatusChanged = exports.onRealtimeResolutionRequest = exports.onGameInviteV4Deleted = exports.suspendSoloSessionV4 = exports.resumeOrCreateSoloSessionV4 = exports.restartSoloSessionV4 = exports.createSoloSessionV4 = exports.archiveSoloSessionV4 = exports.submitTurnMoveV4 = exports.resolveRealtimeSessionV4 = exports.resignSessionV4 = exports.adminClearGameV4 = exports.adminClearConversationGamesV4 = exports.updateLobbySettingsV4 = exports.startGameFromInviteV4 = exports.leaveInviteLobbyV4 = exports.joinInviteLobbyV4 = exports.cancelGameInviteV4 = exports.claimLevelRewardV4 = exports.createGameInviteV4 = exports.claimAchievementSectionBadgeV4 = exports.claimAchievementV4 = void 0;
// ─── Callables ─────────────────────────────────────────────────────────────
var claimAchievement_1 = require("./claimAchievement");
Object.defineProperty(exports, "claimAchievementV4", { enumerable: true, get: function () { return claimAchievement_1.claimAchievementV4; } });
var claimSectionBadge_1 = require("./claimSectionBadge");
Object.defineProperty(exports, "claimAchievementSectionBadgeV4", { enumerable: true, get: function () { return claimSectionBadge_1.claimAchievementSectionBadgeV4; } });
var invites_1 = require("./invites");
Object.defineProperty(exports, "createGameInviteV4", { enumerable: true, get: function () { return invites_1.createGameInviteV4; } });
var levelRewardsV4_1 = require("./levelRewardsV4");
Object.defineProperty(exports, "claimLevelRewardV4", { enumerable: true, get: function () { return levelRewardsV4_1.claimLevelRewardV4; } });
var lobby_1 = require("./lobby");
Object.defineProperty(exports, "cancelGameInviteV4", { enumerable: true, get: function () { return lobby_1.cancelGameInviteV4; } });
Object.defineProperty(exports, "joinInviteLobbyV4", { enumerable: true, get: function () { return lobby_1.joinInviteLobbyV4; } });
Object.defineProperty(exports, "leaveInviteLobbyV4", { enumerable: true, get: function () { return lobby_1.leaveInviteLobbyV4; } });
Object.defineProperty(exports, "startGameFromInviteV4", { enumerable: true, get: function () { return lobby_1.startGameFromInviteV4; } });
Object.defineProperty(exports, "updateLobbySettingsV4", { enumerable: true, get: function () { return lobby_1.updateLobbySettingsV4; } });
var moderation_1 = require("./moderation");
Object.defineProperty(exports, "adminClearConversationGamesV4", { enumerable: true, get: function () { return moderation_1.adminClearConversationGamesV4; } });
Object.defineProperty(exports, "adminClearGameV4", { enumerable: true, get: function () { return moderation_1.adminClearGameV4; } });
var sessions_1 = require("./sessions");
Object.defineProperty(exports, "resignSessionV4", { enumerable: true, get: function () { return sessions_1.resignSessionV4; } });
Object.defineProperty(exports, "resolveRealtimeSessionV4", { enumerable: true, get: function () { return sessions_1.resolveRealtimeSessionV4; } });
Object.defineProperty(exports, "submitTurnMoveV4", { enumerable: true, get: function () { return sessions_1.submitTurnMoveV4; } });
var solo_1 = require("./solo");
Object.defineProperty(exports, "archiveSoloSessionV4", { enumerable: true, get: function () { return solo_1.archiveSoloSessionV4; } });
Object.defineProperty(exports, "createSoloSessionV4", { enumerable: true, get: function () { return solo_1.createSoloSessionV4; } });
Object.defineProperty(exports, "restartSoloSessionV4", { enumerable: true, get: function () { return solo_1.restartSoloSessionV4; } });
Object.defineProperty(exports, "resumeOrCreateSoloSessionV4", { enumerable: true, get: function () { return solo_1.resumeOrCreateSoloSessionV4; } });
Object.defineProperty(exports, "suspendSoloSessionV4", { enumerable: true, get: function () { return solo_1.suspendSoloSessionV4; } });
// ─── Triggers ──────────────────────────────────────────────────────────────
var triggers_1 = require("./triggers");
Object.defineProperty(exports, "onGameInviteV4Deleted", { enumerable: true, get: function () { return triggers_1.onGameInviteV4Deleted; } });
Object.defineProperty(exports, "onRealtimeResolutionRequest", { enumerable: true, get: function () { return triggers_1.onRealtimeResolutionRequest; } });
Object.defineProperty(exports, "onSessionV4StatusChanged", { enumerable: true, get: function () { return triggers_1.onSessionV4StatusChanged; } });
// ─── Scheduled ─────────────────────────────────────────────────────────────
var watchdog_1 = require("./watchdog");
Object.defineProperty(exports, "watchdogGamesV4", { enumerable: true, get: function () { return watchdog_1.watchdogGamesV4; } });
// ─── Internal (for Colyseus bridge / cross-module use) ─────────────────────
var resolve_1 = require("./resolve");
Object.defineProperty(exports, "resolveSessionV4Internal", { enumerable: true, get: function () { return resolve_1.resolveSessionV4Internal; } });
//# sourceMappingURL=index.js.map