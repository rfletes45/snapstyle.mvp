/**
 * Games V4 — Lobby Management
 *
 * Callables:
 * - joinInviteLobbyV4: join as player or spectator
 * - leaveInviteLobbyV4: leave an invite lobby before game starts
 * - cancelGameInviteV4: host cancels an invite (resolves it)
 * - updateLobbySettingsV4: host-only settings patch
 * - startGameFromInviteV4: host starts the game, creating a GameSessionV4
 *
 * @module gamesV4/lobby
 */
import * as functions from "firebase-functions";
export declare const joinInviteLobbyV4: functions.HttpsFunction & functions.Runnable<any>;
export declare const updateLobbySettingsV4: functions.HttpsFunction & functions.Runnable<any>;
export declare const startGameFromInviteV4: functions.HttpsFunction & functions.Runnable<any>;
export declare const leaveInviteLobbyV4: functions.HttpsFunction & functions.Runnable<any>;
export declare const cancelGameInviteV4: functions.HttpsFunction & functions.Runnable<any>;
