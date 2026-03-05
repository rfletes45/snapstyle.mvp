/**
 * Games V4 — Create Game Invite
 *
 * Callable: createGameInviteV4
 *
 * Creates a new GameInviteV4 doc, pins it to the conversation,
 * and fans out notifications to conversation members.
 *
 * @module gamesV4/invites
 */
import * as functions from "firebase-functions";
export declare const createGameInviteV4: functions.HttpsFunction & functions.Runnable<any>;
