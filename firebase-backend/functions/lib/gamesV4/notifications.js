"use strict";
/**
 * Games V4 notification helpers.
 *
 * All game notification delivery is delegated to the shared notification
 * center so foreground in-app delivery and background push delivery remain
 * mutually exclusive.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyInviteCreated = notifyInviteCreated;
exports.notifyTurn = notifyTurn;
exports.notifyResolved = notifyResolved;
exports.notifyPlayerJoinedLobby = notifyPlayerJoinedLobby;
exports.notifyAchievementUnlocked = notifyAchievementUnlocked;
const notificationCenter_1 = require("../notificationCenter");
const GAME_DISPLAY_NAMES = {
    bounce_blitz: "Bounce Blitz",
    play_2048: "2048",
    brick_breaker: "Brick Breaker",
    word_master: "Word Master",
    minesweeper: "Minesweeper",
    lights_out: "Lights Out",
    tic_tac_toe: "Tic Tac Toe",
    chess: "Chess",
    checkers: "Checkers",
    connect_four: "Connect Four",
    gomoku: "Gomoku",
    reversi: "Reversi",
    dots_and_boxes: "Dots & Boxes",
    pong_game: "Pong",
    battleship: "Battleship",
    sketch_party_game: "Sketch Party",
    crazy_eights: "Crazy 8's",
    starforge_game: "Starforge",
    crossword_puzzle: "Crossword",
    minigolf_duels: "Mini Golf",
    dot_match: "Dot Match",
    knockout_game: "Knockout",
    solitaire_klondike: "Solitaire",
    hex: "Hex",
    dead_drop: "Dead Drop",
    metro_magnate: "Metro Magnate",
};
function gameName(gameId) {
    return GAME_DISPLAY_NAMES[gameId] || gameId;
}
async function notifyInviteCreated(invite, senderDisplayName, recipientUids) {
    await Promise.all(recipientUids
        .filter((uid) => uid !== invite.createdBy)
        .map((uid) => (0, notificationCenter_1.notifyUser)({
        recipientUid: uid,
        type: "game_invite",
        category: "games",
        dedupeKey: `game_invite:${invite.inviteId}:${uid}`,
        collapseKey: `game_invite:${invite.conversationId}`,
        title: `${senderDisplayName} invited you to play`,
        subtitle: gameName(invite.gameId),
        body: `Tap to join the ${gameName(invite.gameId)} lobby`,
        actorUid: invite.createdBy,
        actorName: senderDisplayName,
        conversationId: invite.conversationId,
        conversationScope: invite.conversationScope,
        inviteId: invite.inviteId,
        gameId: invite.gameId,
        route: {
            screen: "GameLobbyV4",
            params: { inviteId: invite.inviteId },
        },
        data: {
            inviteId: invite.inviteId,
            conversationId: invite.conversationId,
            conversationScope: invite.conversationScope,
            gameId: invite.gameId,
        },
        respectConversationMute: true,
    })));
}
async function notifyTurn(session, turnPlayerUid, lastActorName, versionToken) {
    if (!turnPlayerUid || session.runtimeType !== "turnBased") {
        return;
    }
    await (0, notificationCenter_1.notifyUser)({
        recipientUid: turnPlayerUid,
        type: "game_turn",
        category: "games",
        dedupeKey: `game_turn:${session.sessionId}:${turnPlayerUid}:${versionToken ?? session.integrity.version}`,
        collapseKey: `game_turn:${session.sessionId}`,
        title: `Your Turn — ${gameName(session.gameId)}`,
        body: `${lastActorName} made a move. Tap to play.`,
        conversationId: session.conversationId,
        conversationScope: session.conversationScope,
        sessionId: session.sessionId,
        inviteId: session.inviteId,
        gameId: session.gameId,
        route: {
            screen: "GamePlayV4",
            params: {
                sessionId: session.sessionId,
                gameId: session.gameId,
            },
        },
        data: {
            sessionId: session.sessionId,
            inviteId: session.inviteId,
            conversationId: session.conversationId,
            conversationScope: session.conversationScope,
            gameId: session.gameId,
            gameName: gameName(session.gameId),
            opponentName: lastActorName,
        },
        respectConversationMute: true,
    });
}
async function notifyResolved(result, conversationScope, resolverUid) {
    function buildGameOverBody(uid) {
        if (result.resolutionType === "draw") {
            return "The game ended in a draw.";
        }
        if (result.winnerIds.length > 0) {
            if (result.winnerIds.includes(uid)) {
                return "Congratulations, you won!";
            }
            const winnerEntry = result.scoreboard.find((entry) => result.winnerIds.includes(entry.uid));
            return `${winnerEntry?.displayName ?? "Your opponent"} won the game.`;
        }
        return "The game has ended.";
    }
    await Promise.all(result.participantIds
        .filter((uid) => uid !== resolverUid)
        .map((uid) => (0, notificationCenter_1.notifyUser)({
        recipientUid: uid,
        type: "game_resolved",
        category: "games",
        dedupeKey: `game_resolved:${result.sessionId}:${uid}`,
        collapseKey: `game_resolved:${result.sessionId}`,
        title: `Game Over — ${gameName(result.gameId)}`,
        body: buildGameOverBody(uid),
        conversationId: result.conversationId,
        conversationScope,
        sessionId: result.sessionId,
        inviteId: result.inviteId,
        gameId: result.gameId,
        route: {
            screen: "GameOverV4",
            params: { sessionId: result.sessionId },
        },
        data: {
            sessionId: result.sessionId,
            inviteId: result.inviteId,
            conversationId: result.conversationId,
            gameId: result.gameId,
            resolutionType: result.resolutionType,
        },
        respectConversationMute: true,
    })));
}
async function notifyPlayerJoinedLobby(invite, joinerDisplayName) {
    if (!invite.hostId)
        return;
    await (0, notificationCenter_1.notifyUser)({
        recipientUid: invite.hostId,
        type: "game_lobby_ready",
        category: "games",
        dedupeKey: `game_lobby_ready:${invite.inviteId}:${invite.hostId}`,
        collapseKey: `game_invite:${invite.inviteId}`,
        title: `${joinerDisplayName} joined your lobby`,
        subtitle: gameName(invite.gameId),
        body: "Your game is ready to start!",
        actorName: joinerDisplayName,
        conversationId: invite.conversationId,
        conversationScope: invite.conversationScope,
        inviteId: invite.inviteId,
        gameId: invite.gameId,
        route: {
            screen: "GameLobbyV4",
            params: { inviteId: invite.inviteId },
        },
        data: {
            inviteId: invite.inviteId,
            conversationId: invite.conversationId,
            conversationScope: invite.conversationScope,
            gameId: invite.gameId,
        },
        respectConversationMute: true,
    });
}
async function notifyAchievementUnlocked(params) {
    const { uid, achievementIds, achievementTitles, sectionId, gameId, sessionId, } = params;
    if (achievementIds.length === 0)
        return;
    const achievementCount = achievementIds.length;
    await (0, notificationCenter_1.notifyUser)({
        recipientUid: uid,
        type: "achievement_unlocked",
        category: "progression",
        dedupeKey: `achievement_unlocked:${uid}:${sessionId ?? achievementIds.join(",")}`,
        collapseKey: `achievement_unlocked:${uid}`,
        title: achievementCount === 1
            ? "Achievement Unlocked!"
            : `${achievementCount} Achievements Unlocked!`,
        body: achievementCount === 1
            ? achievementTitles?.[0] || "You earned a new achievement"
            : `${achievementTitles?.slice(0, 2).join(", ") || "Multiple achievements"} and more`,
        sectionId: sectionId ?? null,
        sessionId: sessionId ?? null,
        gameId: gameId ?? null,
        route: sectionId
            ? {
                screen: "AchievementSection",
                params: { sectionId },
            }
            : {
                screen: "AchievementsHub",
            },
        data: {
            achievementIds,
            achievementTitles: achievementTitles ?? [],
            sectionId: sectionId ?? null,
            gameId: gameId ?? null,
            sourceSessionId: sessionId ?? null,
        },
    });
}
//# sourceMappingURL=notifications.js.map