/**
 * Games V4 notification helpers.
 *
 * All game notification delivery is delegated to the shared notification
 * center so foreground in-app delivery and background push delivery remain
 * mutually exclusive.
 */
import type { GameInviteV4, GameResultV4, GameSessionV4 } from "./types";
export declare function notifyInviteCreated(invite: GameInviteV4, senderDisplayName: string, recipientUids: string[]): Promise<void>;
export declare function notifyTurn(session: GameSessionV4, turnPlayerUid: string, lastActorName: string, versionToken?: number): Promise<void>;
export declare function notifyResolved(result: GameResultV4, conversationScope: "dm" | "group", resolverUid?: string): Promise<void>;
export declare function notifyPlayerJoinedLobby(invite: GameInviteV4, joinerDisplayName: string): Promise<void>;
export declare function notifyAchievementUnlocked(params: {
    uid: string;
    achievementIds: string[];
    achievementTitles?: string[];
    sectionId?: string;
    gameId?: string;
    sessionId?: string;
}): Promise<void>;
