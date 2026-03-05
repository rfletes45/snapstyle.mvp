"use strict";
/**
 * Games V4 — Backend Type Definitions
 *
 * Mirrors the client types from src/gamesV4/types for use in Cloud Functions.
 * This is the canonical backend reference. Keep in sync with the client types.
 *
 * @module gamesV4/types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEADERBOARD_METRICS = exports.XP_CONFIG = exports.PRESENCE_STALE_MS = exports.LOBBY_EXPIRY_MS = exports.RESOLVED_INVITE_TTL_MS = exports.MAX_PLAYERS = exports.MAX_PINNED_INVITES = exports.PINNED_INVITE_IDS_FIELD = exports.COLLECTIONS = exports.GAME_INVITE_STATUS_TRANSITIONS = void 0;
exports.canTransitionInviteStatus = canTransitionInviteStatus;
exports.getLeaderboardMetric = getLeaderboardMetric;
exports.GAME_INVITE_STATUS_TRANSITIONS = {
    sent: ["lobby", "resolved"],
    lobby: ["active", "resolved"],
    active: ["resolved"],
    resolved: [],
};
function canTransitionInviteStatus(from, to) {
    return exports.GAME_INVITE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
// =============================================================================
// Constants
// =============================================================================
exports.COLLECTIONS = {
    GAME_INVITES: "GameInvitesV4",
    GAME_SESSIONS: "GameSessionsV4",
    PUBLIC_STATE: "PublicState",
    PRIVATE_STATE: "PrivateState",
    MOVES: "Moves",
    GAME_RESULTS: "GameResultsV4",
    GAME_PB: "GamePB",
    NOTIFICATIONS: "Notifications",
    LEADERBOARDS: "LeaderboardsV4",
    LEADERBOARD_WEEKS: "Weeks",
    LEADERBOARD_ENTRIES: "Entries",
    IN_APP_NOTIFICATIONS_V4: "InAppNotificationsV4",
};
exports.PINNED_INVITE_IDS_FIELD = "pinnedGameInviteIds";
exports.MAX_PINNED_INVITES = 5;
exports.MAX_PLAYERS = 8;
exports.RESOLVED_INVITE_TTL_MS = 60 * 60 * 1000;
exports.LOBBY_EXPIRY_MS = 24 * 60 * 60 * 1000;
exports.PRESENCE_STALE_MS = 60 * 1000;
exports.XP_CONFIG = {
    BASE_PARTICIPATION: 10,
    WIN_BONUS: 15,
    DRAW_BONUS: 5,
    MAX_PERFORMANCE_BONUS: 10,
    levelXpThreshold(level) {
        return Math.floor(100 * Math.pow(1.2, level - 1));
    },
};
exports.LEADERBOARD_METRICS = {
    tic_tac_toe: "wins",
    connect_four: "wins",
    play_2048: "bestScore",
    chess: "wins",
    sketch_party_game: "bestScore",
    battleship: "wins",
    // Default for unspecified games: "bestScore"
};
function getLeaderboardMetric(gameId) {
    return exports.LEADERBOARD_METRICS[gameId] ?? "bestScore";
}
//# sourceMappingURL=types.js.map