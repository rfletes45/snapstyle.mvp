"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSessionV4Internal = resolveSessionV4Internal;
exports.retryRewardsForSession = retryRewardsForSession;
const admin = __importStar(require("firebase-admin"));
const achievements_1 = require("./achievements");
const adapters_1 = require("./adapters");
const helpers_1 = require("./helpers");
const levelRewardsV4_1 = require("./levelRewardsV4");
const notifications_1 = require("./notifications");
const types_1 = require("./types");
// =============================================================================
// Main resolve function
// =============================================================================
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
async function resolveSessionV4Internal(input) {
    const db = (0, helpers_1.getDb)();
    const sessionRef = db
        .collection(types_1.COLLECTIONS.GAME_SESSIONS)
        .doc(input.sessionId);
    // ─── Phase 1: Atomic status transition ──────────────────────────────
    const session = await db.runTransaction(async (tx) => {
        const snap = await tx.get(sessionRef);
        if (!snap.exists) {
            console.warn(`[resolveV4] Session ${input.sessionId} not found. Skipping.`);
            return null;
        }
        const data = snap.data();
        // Idempotent: already resolved
        if (data.status === "resolved" ||
            data.status === "abandoned" ||
            data.status === "expired") {
            console.log(`[resolveV4] Session ${input.sessionId} already ${data.status}. Idempotent no-op.`);
            return null;
        }
        const now = admin.firestore.Timestamp.now();
        tx.update(sessionRef, {
            status: "resolved",
            resolvedAt: now,
            resolution: {
                type: input.resolutionType,
                winnerIds: input.winnerIds ?? [],
                ...(input.reason ? { reason: input.reason } : {}),
            },
        });
        // Return the session data for subsequent processing
        return {
            ...data,
            status: "resolved",
            resolvedAt: now.toMillis(),
            resolution: {
                type: input.resolutionType,
                winnerIds: input.winnerIds ?? [],
                ...(input.reason ? { reason: input.reason } : {}),
            },
        };
    });
    if (!session)
        return null;
    // ─── Phase 2: Transition invite → resolved (skip for solo sessions) ──
    if (session.inviteId) {
        try {
            const inviteRef = db
                .collection(types_1.COLLECTIONS.GAME_INVITES)
                .doc(session.inviteId);
            const now = Date.now();
            await inviteRef.update({
                status: "resolved",
                updatedAt: admin.firestore.Timestamp.now(),
                hiddenInChat: false, // surface for resolved card display
                deleteRequestedAt: admin.firestore.Timestamp.fromMillis(now),
                deleteAt: admin.firestore.Timestamp.fromMillis(now + types_1.RESOLVED_INVITE_TTL_MS),
                "summary.phase": "resolved",
            });
        }
        catch (err) {
            console.error(`[resolveV4] Failed to transition invite ${session.inviteId}:`, err);
        }
    }
    // ─── Phase 3: Compute result data ──────────────────────────────────
    // PERF: Start countMoves in parallel with scoreboard computation.
    // countMoves is an independent Firestore query that doesn't block scoreboard.
    const countMovesPromise = countMoves(db, input.sessionId);
    const durationMs = computeDuration(session);
    // Use adapter-driven scoreboard (with proper scores + stats) when available
    let scoreboard;
    let performanceMetrics = input.performanceMetrics ?? {};
    if (input.scoreboard) {
        scoreboard = input.scoreboard;
        console.log(`[resolveV4] Using input.scoreboard for ${session.gameId}`);
    }
    else if ((0, adapters_1.hasAdapter)(session.gameId)) {
        try {
            const pubSnap = await db
                .collection(types_1.COLLECTIONS.GAME_SESSIONS)
                .doc(input.sessionId)
                .collection(types_1.COLLECTIONS.PUBLIC_STATE)
                .doc("state")
                .get();
            const pubState = pubSnap.exists
                ? pubSnap.data()
                : {};
            console.log(`[resolveV4] PublicState exists=${pubSnap.exists}, phase=${pubState.phase}, campaignScore=${pubState.campaign?.score}`);
            const players = session.players.map((p, i) => ({
                uid: p.uid,
                slotIndex: i,
                displayName: p.displayName ?? "Player",
                avatarConfig: p.avatarConfig,
                profilePictureUrl: p.profilePictureUrl ?? null,
            }));
            const outcome = (0, adapters_1.computeOutcome)(session.gameId, pubState, players, input.winnerIds ?? []);
            scoreboard = outcome.finalScoreboard.map((e, idx) => {
                const player = session.players.find((p) => p.uid === e.uid);
                return {
                    uid: e.uid,
                    displayName: player?.displayName ?? `Player ${idx + 1}`,
                    avatarConfig: player?.avatarConfig,
                    profilePictureUrl: player?.profilePictureUrl ?? null,
                    score: e.score,
                    placement: e.placement,
                    stats: e.stats ?? {},
                };
            });
            console.log(`[resolveV4] computeOutcome for ${session.gameId}: scores=${JSON.stringify(scoreboard.map((s) => ({ uid: s.uid, score: s.score })))}`);
            // Also grab performance metrics for achievement evaluation
            if (Object.keys(performanceMetrics).length === 0) {
                performanceMetrics = (0, adapters_1.extractPerformanceMetrics)(session.gameId, pubState, session.players.map((p) => ({ uid: p.uid })));
            }
        }
        catch (err) {
            console.warn(`[resolveV4] computeOutcome failed for ${session.gameId}, falling back to buildDefaultScoreboard:`, err);
            scoreboard = buildDefaultScoreboard(session, input.winnerIds ?? []);
        }
    }
    else {
        console.log(`[resolveV4] No adapter for ${session.gameId}, using buildDefaultScoreboard`);
        scoreboard = buildDefaultScoreboard(session, input.winnerIds ?? []);
    }
    const xpAwards = computeXPAwards(session, input.resolutionType, input.winnerIds ?? [], scoreboard);
    // Await the parallel countMoves query
    const totalMoves = await countMovesPromise;
    const weekKey = (0, helpers_1.currentWeekKey)();
    const leaderboardUpdates = []; // Populated below
    const result = {
        sessionId: session.sessionId,
        inviteId: session.inviteId,
        conversationId: session.conversationId,
        gameId: session.gameId,
        resolutionType: input.resolutionType,
        winnerIds: input.winnerIds ?? [],
        scoreboard,
        xpAwards,
        achievementUnlocks: [], // Written initially empty; updated below
        leaderboardUpdates,
        durationMs,
        totalMoves,
        createdAt: admin.firestore.Timestamp.now(),
        participantIds: session.participantUids,
        performanceMetrics,
    };
    // ─── Phase 4: Write result doc EARLY ───────────────────────────────
    // PERF: Write the result doc immediately with scoreboard + XP so the
    // client's onSnapshot listener fires as soon as possible. Achievements
    // are evaluated and patched in afterward — the client will receive
    // the update automatically via its live subscription.
    const resultRef = db
        .collection(types_1.COLLECTIONS.GAME_RESULTS)
        .doc(input.sessionId);
    await resultRef.set(result);
    // ─── Phase 4.5: Evaluate achievements (deferred from Phase 3) ─────
    // This runs AFTER the result doc is written so the client sees
    // scoreboard/XP immediately. Achievement unlocks are patched in.
    const achievementUnlocks = await (0, achievements_1.evaluateAchievementsV4)(db, session, {
        sessionId: session.sessionId,
        inviteId: session.inviteId,
        conversationId: session.conversationId,
        gameId: session.gameId,
        resolutionType: input.resolutionType,
        winnerIds: input.winnerIds ?? [],
        scoreboard,
        xpAwards,
        leaderboardUpdates: [],
        durationMs,
        totalMoves,
        createdAt: admin.firestore.Timestamp.now(),
        participantIds: session.participantUids,
        performanceMetrics,
    });
    result.achievementUnlocks = achievementUnlocks;
    // Patch achievement unlocks into the result doc if any were earned
    if (achievementUnlocks.length > 0) {
        await resultRef.update({ achievementUnlocks });
    }
    // ─── Phases 5-7: Apply rewards in parallel ─────────────────────────
    // PERF: XP, leaderboard, and PB writes are independent of each other.
    // Running them in parallel saves ~300-800ms compared to sequential.
    const [, lbUpdates] = await Promise.all([
        applyXPAwards(db, xpAwards), // Phase 5
        updateLeaderboards(db, session.gameId, weekKey, scoreboard), // Phase 6
        updatePersonalBests(db, session.gameId, scoreboard, input.sessionId), // Phase 7
    ]);
    result.leaderboardUpdates = lbUpdates;
    // ─── Phases 8-9: Unpin invite + mark rewards in parallel ─────────
    // PERF: These writes are independent; run together.
    const tailWrites = [
        sessionRef.update({ rewardsProcessed: true }),
    ];
    if (session.inviteId) {
        tailWrites.push((0, helpers_1.unpinInviteFromConversation)(session.conversationId, session.conversationScope, session.inviteId).catch((err) => console.error(`[resolveV4] Failed to unpin invite ${session.inviteId}:`, err)));
    }
    await Promise.all(tailWrites);
    // ─── Phase 9.5: Send achievement unlock notifications ──────────────
    if (achievementUnlocks.length > 0) {
        // Group unlocks by uid so each player gets one notification
        const unlocksByUid = new Map();
        for (const unlock of achievementUnlocks) {
            const list = unlocksByUid.get(unlock.uid) ?? [];
            list.push(unlock);
            unlocksByUid.set(unlock.uid, list);
        }
        const achievementNotifPromises = Array.from(unlocksByUid.entries()).map(([uid, unlocks]) => (0, notifications_1.notifyAchievementUnlocked)({
            uid,
            achievementIds: unlocks.map((u) => u.achievementType),
            achievementTitles: unlocks.map((u) => u.achievementType), // titles resolved client-side from defs
            sectionId: undefined, // multiple sections possible
            gameId: session.gameId,
            sessionId: session.sessionId,
        }).catch((err) => console.error(`[resolveV4] Failed to send achievement notification to ${uid}:`, err)));
        await Promise.allSettled(achievementNotifPromises);
    }
    // ─── Phase 10: Send resolved notifications ─────────────────────────
    try {
        await (0, notifications_1.notifyResolved)(result, session.conversationScope, input.resolverUid);
    }
    catch (err) {
        console.error(`[resolveV4] Failed to send resolved notifications:`, err);
    }
    console.log(`[resolveV4] Session ${input.sessionId} resolved as ${input.resolutionType}. ` +
        `XP awarded to ${xpAwards.length} players.`);
    return result;
}
// =============================================================================
// Retry rewards for already-resolved sessions (watchdog)
// =============================================================================
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
async function retryRewardsForSession(sessionId) {
    const db = (0, helpers_1.getDb)();
    const sessionRef = db.collection(types_1.COLLECTIONS.GAME_SESSIONS).doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
        console.warn(`[resolveV4] retryRewards: session ${sessionId} not found.`);
        return;
    }
    const session = sessionSnap.data();
    // Guard: only retry for resolved sessions that haven't processed rewards
    if (session.rewardsProcessed) {
        console.log(`[resolveV4] retryRewards: session ${sessionId} already processed.`);
        return;
    }
    if (session.status !== "resolved") {
        console.warn(`[resolveV4] retryRewards: session ${sessionId} not resolved (${session.status}).`);
        return;
    }
    // Read existing result doc (created by Phase 4 in resolveSessionV4Internal)
    const resultSnap = await db
        .collection(types_1.COLLECTIONS.GAME_RESULTS)
        .doc(sessionId)
        .get();
    if (!resultSnap.exists) {
        // Result doc was never written — can't retry. Needs full re-resolution.
        console.warn(`[resolveV4] retryRewards: no result doc for ${sessionId}. Cannot retry.`);
        return;
    }
    const result = resultSnap.data();
    const weekKey = (0, helpers_1.currentWeekKey)();
    // ─── Phase 5: Apply XP ─────────────────────────────────────────────
    await applyXPAwards(db, result.xpAwards);
    // ─── Phase 6: Update leaderboards ──────────────────────────────────
    await updateLeaderboards(db, session.gameId, weekKey, result.scoreboard);
    // ─── Phase 7: Update personal bests ────────────────────────────────
    await updatePersonalBests(db, session.gameId, result.scoreboard, sessionId);
    // ─── Phase 9: Mark rewards processed ───────────────────────────────
    await sessionRef.update({ rewardsProcessed: true });
    console.log(`[resolveV4] retryRewards: successfully re-applied rewards for ${sessionId}.`);
}
// =============================================================================
// Duration computation
// =============================================================================
function computeDuration(session) {
    const startMs = toMs(session.startedAt);
    const endMs = (0, helpers_1.nowMs)();
    if (!startMs)
        return 0;
    return Math.max(0, endMs - startMs);
}
function toMs(ts) {
    if (ts === null || ts === undefined)
        return null;
    if (typeof ts === "number")
        return ts;
    // Firestore Timestamp
    if (typeof ts === "object" && "toMillis" in ts) {
        return ts.toMillis();
    }
    return null;
}
// =============================================================================
// Move counting
// =============================================================================
async function countMoves(db, sessionId) {
    const snap = await db
        .collection(types_1.COLLECTIONS.GAME_SESSIONS)
        .doc(sessionId)
        .collection(types_1.COLLECTIONS.MOVES)
        .count()
        .get();
    return snap.data().count;
}
// =============================================================================
// Default scoreboard
// =============================================================================
function buildDefaultScoreboard(session, winnerIds) {
    return session.players.map((player, idx) => {
        const isWinner = winnerIds.includes(player.uid);
        // Try to use existing scoreboard summary
        const summaryEntry = session.scoreboardSummary?.find((e) => e.uid === player.uid);
        return {
            uid: player.uid,
            displayName: player.displayName ?? "Player",
            avatarConfig: player.avatarConfig,
            profilePictureUrl: player.profilePictureUrl ?? null,
            score: summaryEntry?.score ?? (isWinner ? 1 : 0),
            placement: isWinner ? 1 : idx + 1,
            stats: {},
        };
    });
}
// =============================================================================
// XP computation
// =============================================================================
function computeXPAwards(session, resolutionType, winnerIds, scoreboard) {
    return scoreboard.map((entry) => {
        let baseXP = types_1.XP_CONFIG.BASE_PARTICIPATION;
        let bonusXP = 0;
        let bonusReason;
        const isWinner = winnerIds.includes(entry.uid);
        const isDraw = resolutionType === "draw";
        if (isWinner) {
            bonusXP += types_1.XP_CONFIG.WIN_BONUS;
            bonusReason = "Victory";
        }
        else if (isDraw) {
            bonusXP += types_1.XP_CONFIG.DRAW_BONUS;
            bonusReason = "Draw";
        }
        // Solo games: award score-based XP instead of win/draw multiplayer bonus
        if (session.runtimeType === "solo") {
            baseXP = types_1.XP_CONFIG.BASE_PARTICIPATION;
            // Score-based performance bonus: 1 XP per 1000 score, capped at MAX_PERFORMANCE_BONUS
            const scoreBonus = Math.min(Math.floor(entry.score / 1000), types_1.XP_CONFIG.MAX_PERFORMANCE_BONUS);
            bonusXP = scoreBonus;
            bonusReason =
                scoreBonus > 0 ? `Score ${entry.score.toLocaleString()}` : undefined;
        }
        return {
            uid: entry.uid,
            baseXP,
            bonusXP,
            totalXP: baseXP + bonusXP,
            ...(bonusReason ? { bonusReason } : {}),
        };
    });
}
// =============================================================================
// Apply XP to user profiles
// =============================================================================
async function applyXPAwards(db, xpAwards) {
    const batch = db.batch();
    for (const award of xpAwards) {
        const userRef = db.collection("Users").doc(award.uid);
        try {
            const userDoc = await userRef.get();
            if (!userDoc.exists)
                continue;
            const userData = userDoc.data();
            const currentLevel = userData.level?.current ?? 1;
            const currentXp = userData.level?.xp ?? 0;
            const currentTotalXp = userData.level?.totalXp ?? 0;
            const MAX_LEVEL = 50;
            const newTotalXp = currentTotalXp + award.totalXP;
            let newXp = currentXp + award.totalXP;
            let newLevel = currentLevel;
            // Level up check — capped at MAX_LEVEL
            let threshold = types_1.XP_CONFIG.levelXpThreshold(newLevel);
            while (newXp >= threshold && newLevel < MAX_LEVEL) {
                newXp -= threshold;
                newLevel++;
                threshold = types_1.XP_CONFIG.levelXpThreshold(newLevel);
            }
            // Clamp level to cap (handles pre-existing levels > 50)
            if (newLevel > MAX_LEVEL) {
                newLevel = MAX_LEVEL;
                threshold = types_1.XP_CONFIG.levelXpThreshold(MAX_LEVEL);
                newXp = 0;
            }
            // At level cap: freeze XP bar as full
            if (newLevel === MAX_LEVEL) {
                threshold = types_1.XP_CONFIG.levelXpThreshold(MAX_LEVEL);
                // Keep xp as-is but xpToNextLevel = threshold so bar shows progress
                // If xp >= threshold, clamp to threshold (display as MAX)
                if (newXp >= threshold) {
                    newXp = threshold;
                }
            }
            const levelUpdate = {
                "level.xp": newXp,
                "level.totalXp": newTotalXp,
                "level.xpToNextLevel": threshold,
            };
            if (newLevel !== currentLevel) {
                levelUpdate["level.current"] = newLevel;
                award.levelUp = {
                    oldLevel: currentLevel,
                    newLevel,
                    newXpToNextLevel: threshold,
                };
            }
            batch.update(userRef, levelUpdate);
            // Also update stats cache
            const statsRef = db
                .collection("Users")
                .doc(award.uid)
                .collection("UserStatsCache")
                .doc("stats");
            batch.set(statsRef, {
                gamesPlayed: admin.firestore.FieldValue.increment(1),
                ...(award.bonusReason === "Victory"
                    ? { gamesWon: admin.firestore.FieldValue.increment(1) }
                    : {}),
            }, { merge: true });
        }
        catch (err) {
            console.error(`[resolveV4] Failed to compute XP for ${award.uid}:`, err);
        }
    }
    await batch.commit();
    // ─── Unlock level rewards for players that leveled up ────────────────
    for (const award of xpAwards) {
        if (award.levelUp) {
            try {
                await (0, levelRewardsV4_1.unlockLevelRewards)(db, award.uid, award.levelUp.oldLevel, award.levelUp.newLevel);
            }
            catch (err) {
                console.error(`[resolveV4] Failed to unlock level rewards for ${award.uid}:`, err);
            }
        }
    }
}
// =============================================================================
// Leaderboard updates
// =============================================================================
async function updateLeaderboards(db, gameId, weekKey, scoreboard) {
    const updates = [];
    const batch = db.batch();
    const metric = (0, types_1.getLeaderboardMetric)(gameId);
    // Ensure week document exists
    const weekRef = db
        .collection(types_1.COLLECTIONS.LEADERBOARDS)
        .doc(gameId)
        .collection("Weeks")
        .doc(weekKey);
    batch.set(weekRef, { weekKey, gameId, createdAt: admin.firestore.Timestamp.now() }, { merge: true });
    for (const entry of scoreboard) {
        const entryRef = weekRef.collection("Entries").doc(entry.uid);
        try {
            const existing = await entryRef.get();
            const previousScore = existing.exists
                ? (existing.data()?.score ?? null)
                : null;
            let newScore;
            if (metric === "wins") {
                // For wins-based games: increment score by 1 for winners only
                const isWinner = entry.placement === 1;
                const prev = previousScore ?? 0;
                newScore = isWinner ? prev + 1 : prev;
            }
            else {
                // For bestScore-based games: keep running max
                newScore =
                    previousScore !== null
                        ? Math.max(previousScore, entry.score)
                        : entry.score;
            }
            batch.set(entryRef, {
                uid: entry.uid,
                displayName: entry.displayName,
                score: newScore,
                updatedAt: admin.firestore.Timestamp.now(),
            }, { merge: true });
            updates.push({
                uid: entry.uid,
                gameId,
                weekKey,
                newScore,
                previousScore,
            });
        }
        catch (err) {
            console.error(`[resolveV4] Failed to update leaderboard for ${entry.uid}:`, err);
        }
    }
    await batch.commit();
    return updates;
}
// =============================================================================
// Personal best updates
// =============================================================================
async function updatePersonalBests(db, gameId, scoreboard, sessionId) {
    const batch = db.batch();
    const metric = (0, types_1.getLeaderboardMetric)(gameId);
    for (const entry of scoreboard) {
        const pbRef = db
            .collection("Users")
            .doc(entry.uid)
            .collection(types_1.COLLECTIONS.GAME_PB)
            .doc(gameId);
        try {
            if (metric === "wins") {
                // ── Wins-based games (TTT, Connect4, Chess, Crazy 8s, Battleship) ──
                // PB value comparison is meaningless (score is always 1 or 0).
                // Only track totalPlays / totalWins — the client reads totalWins
                // for leaderboard display.
                batch.set(pbRef, {
                    gameId,
                    totalPlays: admin.firestore.FieldValue.increment(1),
                    ...(entry.placement === 1
                        ? { totalWins: admin.firestore.FieldValue.increment(1) }
                        : {}),
                    schemaVersion: 1,
                }, { merge: true });
            }
            else {
                // ── Best-score games (2048, Brick Breaker, Minesweeper, etc.) ──
                // Keep running MAX of pbValue.
                const existing = await pbRef.get();
                const currentPb = existing.exists
                    ? (existing.data()?.pbValue ?? -Infinity)
                    : -Infinity;
                if (entry.score > currentPb) {
                    const hash = (0, helpers_1.computeIntegrityHash)(entry.uid, gameId, entry.score, sessionId);
                    batch.set(pbRef, {
                        gameId,
                        pbValue: entry.score,
                        pbMeta: entry.stats || {},
                        achievedAt: admin.firestore.Timestamp.now(),
                        sessionId,
                        totalPlays: admin.firestore.FieldValue.increment(1),
                        totalWins: entry.placement === 1
                            ? admin.firestore.FieldValue.increment(1)
                            : admin.firestore.FieldValue.increment(0),
                        integrityHash: hash,
                        schemaVersion: 1,
                    }, { merge: true });
                }
                else {
                    // Still increment play count even if not a PB.
                    // Use set+merge (not update) so first-time players whose score
                    // is somehow ≤ –Infinity (NaN, etc.) don't crash the batch.
                    batch.set(pbRef, {
                        gameId,
                        totalPlays: admin.firestore.FieldValue.increment(1),
                        ...(entry.placement === 1
                            ? { totalWins: admin.firestore.FieldValue.increment(1) }
                            : {}),
                    }, { merge: true });
                }
            }
        }
        catch (err) {
            console.error(`[resolveV4] Failed to update PB for ${entry.uid}:`, err);
        }
    }
    await batch.commit();
}
//# sourceMappingURL=resolve.js.map