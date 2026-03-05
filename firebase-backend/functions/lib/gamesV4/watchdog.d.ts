/**
 * Games V4 — Watchdog (Scheduled)
 *
 * Runs periodically to clean up stale game state:
 *
 * Pass 1: Expire stale lobbies (LOBBY_EXPIRY_MS with no start)
 * Pass 2: Clean up resolved invites past TTL (backup for TTL policy)
 * Pass 3: Retry failed reward processing (rewardsProcessed !== true)
 * Pass 4: Auto-resolve inactive turn-based sessions (TURN_INACTIVITY_MS)
 *
 * @module gamesV4/watchdog
 */
import * as functions from "firebase-functions";
export declare const watchdogGamesV4: functions.CloudFunction<unknown>;
