/**
 * Games V4 — Session Resolution (THE SINGLE CHOKEPOINT)
 *
 * Every game termination — win, loss, draw, resign, disconnect, timeout, error —
 * MUST flow through resolveSessionV4Internal. This function:
 *
 * 1. Marks session → resolved
 * 2. Marks invite → resolved
 * 3. Creates GameResultV4 doc
 * 4. Computes and awards XP
 * 5. Evaluates achievements
 * 6. Updates leaderboards
 * 7. Updates personal bests
 * 8. Unpins invite from conversation
 * 9. Schedules invite hard-delete (TTL)
 * 10. Sends resolved notifications
 *
 * Idempotent: if session is already resolved, this is a no-op.
 *
 * @module gamesV4/resolve
 */
import type { FinalScoreboardEntry, GameResultV4, ResolutionType } from "./types";
export interface ResolveInput {
    sessionId: string;
    resolutionType: ResolutionType;
    winnerIds?: string[];
    reason?: string;
    /** UID of the actor who triggered resolution (for notif filtering). */
    resolverUid?: string;
    /** Override scoreboard if the game adapter computed one. */
    scoreboard?: FinalScoreboardEntry[];
    /** Performance metrics from the adapter. */
    performanceMetrics?: Record<string, unknown>;
}
/**
 * THE SINGLE CHOKEPOINT for all game resolution.
 *
 * ACCEPTED-RISK N2: For non-adaptored games, `winnerIds` and
 * `resolutionType` are client-supplied hints. A malicious client could
 * spoof them to claim a false win. This is acceptable until every game
 * has a server-side adapter that computes results authoritatively.
 *
 * ACCEPTED-RISK N3: XP writes use FieldValue.increment which is last-
 * write-wins under concurrent resolution of two games for the same
 * player. The probability is low and the impact (off-by-small-XP) is
 * negligible for an MVP.
 *
 * @param input - Resolution parameters
 * @returns The created GameResultV4, or null if already resolved (idempotent).
 */
export declare function resolveSessionV4Internal(input: ResolveInput): Promise<GameResultV4 | null>;
/**
 * Re-run reward phases (XP, leaderboards, PBs) for a session that was
 * resolved but whose rewardsProcessed flag is still false.
 *
 * Unlike resolveSessionV4Internal, this does NOT re-check status transitions
 * (the session is already resolved). It re-reads the existing GameResultV4 doc
 * and re-applies the reward writes (Phases 5-7 + 9).
 *
 * Idempotent: safe to call multiple times — XP increments and PB max() are
 * re-entrant by design.
 */
export declare function retryRewardsForSession(sessionId: string): Promise<void>;
