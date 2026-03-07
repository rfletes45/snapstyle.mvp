/**
 * Games V4 — Admin / Owner Game Moderation
 *
 * Server-authoritative callables for force-clearing broken games when the
 * normal lifecycle fails.  Permission-gated by conversation role (group
 * owner/admin or DM participant).
 *
 * Design:
 * - Soft-clear by default (mark resolved/hidden, unpin, set TTL).
 * - Hard-delete only for truly orphaned docs.
 * - Resolution type "error" so moderation clears are distinguishable from
 *   real game outcomes and don't corrupt rewards/history.
 * - Idempotent — safe to call repeatedly on the same target.
 *
 * @module gamesV4/moderation
 */
import * as functions from "firebase-functions";
/**
 * Force-clear a single broken game (invite + session).
 *
 * Permission: conversation owner/admin (group) or any participant (DM).
 * Behavior:
 * - Soft-clears the invite (resolved + hidden + TTL for eventual hard-delete).
 * - Soft-clears the session if one exists (abandoned with error resolution).
 * - Unpins from conversation.
 * - Idempotent.
 */
export declare const adminClearGameV4: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Force-clear ALL games in a conversation.
 *
 * Permission: conversation owner/admin (group) or any participant (DM).
 * Behavior:
 * - Queries all non-resolved invites for the conversation.
 * - Soft-clears each invite + associated session.
 * - Unpins all.
 * - Optionally clears the entire pinnedGameInviteIds array.
 * - Idempotent.
 */
export declare const adminClearConversationGamesV4: functions.HttpsFunction & functions.Runnable<any>;
