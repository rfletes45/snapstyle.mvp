/**
 * Games V4 — Push Notification Helpers
 *
 * Sends game-related push notifications via Expo push service.
 * Also writes in-app notification documents to Firestore for foreground
 * banner display (Users/{uid}/InAppNotificationsV4/{id}).
 *
 * All notification dispatch is centralized here.
 *
 * @module gamesV4/notifications
 */
import type { GameInviteV4, GameResultV4, GameSessionV4 } from "./types";
/**
 * Notify conversation members that a new game invite was created.
 * Skips the creator themselves.
 */
export declare function notifyInviteCreated(invite: GameInviteV4, senderDisplayName: string, recipientUids: string[]): Promise<void>;
/**
 * Notify the current turn player that it's their turn.
 */
export declare function notifyTurn(session: GameSessionV4, turnPlayerUid: string, lastActorName: string): Promise<void>;
/**
 * Notify all participants that the game has ended.
 * Skips the player who caused the resolution (e.g., the winner who made the final move).
 */
export declare function notifyResolved(result: GameResultV4, conversationScope: "dm" | "group", resolverUid?: string): Promise<void>;
/**
 * Notify the host that a player joined the lobby.
 */
export declare function notifyPlayerJoinedLobby(invite: GameInviteV4, joinerDisplayName: string): Promise<void>;
/**
 * Notify a user that they unlocked one or more achievements.
 * Writes an in-app notification doc (for foreground banner).
 * No push notification is sent for achievements — they are in-app only.
 */
export declare function notifyAchievementUnlocked(params: {
    uid: string;
    achievementIds: string[];
    achievementTitles?: string[];
    sectionId?: string;
    gameId?: string;
    sessionId?: string;
}): Promise<void>;
