/**
 * Games V4 notification helpers.
 *
 * All game notification delivery is delegated to the shared notification
 * center so foreground in-app delivery and background push delivery remain
 * mutually exclusive.
 */
import type { GameId, GameInviteV4, GameResultV4, GameSessionV4 } from "./types";
/**
 * Public helper so the resolve pipeline can label the auto-posted group
 * scorecard with the same name we use everywhere else.
 */
export declare function getGameDisplayName(gameId: GameId): string;
export declare function notifyInviteCreated(invite: GameInviteV4, senderDisplayName: string, recipientUids: string[]): Promise<void>;
export declare function notifyTurn(session: GameSessionV4, turnPlayerUid: string, lastActorName: string, versionToken?: number): Promise<void>;
export declare function notifyResolved(result: GameResultV4, conversationScope: "dm" | "group", resolverUid?: string): Promise<void>;
export declare function notifyPlayerJoinedLobby(invite: GameInviteV4, joinerDisplayName: string): Promise<void>;
export declare function notifyAchievementUnlocked(params: {
    uid: string;
    achievementIds: string[];
    achievementTitles?: string[];
    tokenRewards?: number[];
    sectionId?: string;
    gameId?: string;
    sessionId?: string;
}): Promise<void>;
/**
 * Notify a user that a friend just overtook them on a friends leaderboard.
 *
 * Reuses the `game_resolved` notification transport (so existing category,
 * channel, and mute plumbing all apply) but with a distinct title/body
 * and a route that deep-links to the game's detail/leaderboard view.
 *
 * `variant` is "default" for standard games and the difficulty key
 * ("easy" | "intermediate" | "expert") for Minesweeper so we dedupe
 * per-board rather than once per game.
 */
export declare function notifyFriendBeatScore(params: {
    victimUid: string;
    actorUid: string;
    actorName: string;
    gameId: GameId;
    variant: string;
}): Promise<void>;
