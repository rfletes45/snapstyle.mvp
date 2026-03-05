/**
 * Games V4 — Solo Session Creation
 *
 * Callable: createSoloSessionV4
 *
 * Creates a GameSessionV4 directly for a solo game (e.g. 2048),
 * bypassing the invite system entirely. Solo games don't need
 * lobbies, invites, or conversation pinning — the player taps
 * "Play" from the Games Hub and immediately enters the game.
 *
 * @module gamesV4/solo
 */
import * as functions from "firebase-functions";
export declare const createSoloSessionV4: functions.HttpsFunction & functions.Runnable<any>;
