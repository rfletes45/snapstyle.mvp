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
exports.postGameScorecardToChat = postGameScorecardToChat;
const admin = __importStar(require("firebase-admin"));
const messagePreview_1 = require("../messagePreview");
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
    const xpAwards = computeXPAwards(session, input.resolutionType, input.winnerIds ?? [], scoreboard, input.resolverUid);
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
    const scorecardAutoPostPromise = session.runtimeType !== "solo" &&
        session.conversationId &&
        (session.conversationScope === "group" ||
            session.conversationScope === "dm")
        ? postGameScorecardToChat(db, session, result).catch((err) => {
            console.error(`[resolveV4] Failed to auto-post scorecard to ${session.conversationScope} ${session.conversationId}:`, err);
        })
        : null;
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
    const [, lbUpdates, pbDeltas] = await Promise.all([
        applyXPAwards(db, xpAwards), // Phase 5
        updateLeaderboards(db, session.gameId, weekKey, scoreboard), // Phase 6
        updatePersonalBests(db, session.gameId, scoreboard, input.sessionId), // Phase 7
    ]);
    result.leaderboardUpdates = lbUpdates;
    // ─── Phase 7.5: Beat-friend notifications ──────────────────────────
    // For every participant whose PB improved this match, detect which of
    // their friends just got overtaken on the relevant friends-leaderboard
    // board and notify the beaten friends. Only friends with an existing
    // qualifying entry are notified — never spam people who never played.
    try {
        await notifyFriendsBeatenByDeltas(db, session, pbDeltas, scoreboard);
    }
    catch (err) {
        console.error(`[resolveV4] Beat-friend notification phase failed:`, err);
    }
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
        // Build a type→name lookup so notification bodies use human-readable names
        const achNameMap = new Map((0, achievements_1.getAllAchievementDefs)().map((d) => [d.type, d.name]));
        const achievementNotifPromises = Array.from(unlocksByUid.entries()).map(([uid, unlocks]) => (0, notifications_1.notifyAchievementUnlocked)({
            uid,
            achievementIds: unlocks.map((u) => u.achievementType),
            achievementTitles: unlocks.map((u) => achNameMap.get(u.achievementType) ?? u.achievementType),
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
    // ─── Phase 10.5: Auto-post scorecard to conversation ─────────────
    // Posts into the hosting chat (DM or group) for every multiplayer
    // session. Solo sessions have no conversation to post into. The host's
    // per-chat `autoSendScorecards` preference (stored on their
    // MembersPrivate doc) gates the post — defaults to enabled when the
    // field is absent.
    if (scorecardAutoPostPromise) {
        await scorecardAutoPostPromise;
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
            decorationId: player.decorationId ?? null,
            score: summaryEntry?.score ?? (isWinner ? 1 : 0),
            placement: isWinner ? 1 : idx + 1,
            stats: {},
        };
    });
}
// =============================================================================
// XP computation
// =============================================================================
function computeXPAwards(session, resolutionType, winnerIds, scoreboard, resolverUid) {
    return scoreboard.map((entry) => {
        const isWinner = winnerIds.includes(entry.uid);
        const isDraw = resolutionType === "draw";
        // ══════════════════════════════════════════════════════════════════
        // ABSOLUTE HARD-ZERO GATES — run BEFORE any baseXP assignment.
        // These ensure a user who bails on a match earns exactly 0 XP,
        // regardless of runtimeType (solo included) or scoreboard score.
        // ══════════════════════════════════════════════════════════════════
        // Gate A: resignation — the resigner is ALWAYS 0 XP.
        // The resigner is identified in two ways (defense-in-depth):
        //   1. resolverUid (passed by resignSessionV4 callable)
        //   2. any participant NOT in winnerIds for a resign resolution
        //      (resignSessionV4 sets winnerIds = participants - resigner;
        //       for solo, participants=[uid] so winnerIds=[] and the solo
        //       player correctly matches this check)
        if (resolutionType === "resign") {
            const isResigner = (resolverUid && entry.uid === resolverUid) || !isWinner;
            if (isResigner) {
                return {
                    uid: entry.uid,
                    baseXP: 0,
                    bonusXP: 0,
                    totalXP: 0,
                    bonusReason: "Resigned — no XP",
                };
            }
            // Non-resigner participants (multiplayer): fall through to normal
            // victory XP computation below.
        }
        // Gate B: disconnect / timeout — non-winners get 0 XP.
        // Realtime rooms (Colyseus) emit these when a player bails mid-match.
        if ((resolutionType === "disconnect" || resolutionType === "timeout") &&
            !isWinner) {
            const reasonMap = {
                disconnect: "Disconnected — no XP",
                timeout: "Timed out — no XP",
            };
            return {
                uid: entry.uid,
                baseXP: 0,
                bonusXP: 0,
                totalXP: 0,
                bonusReason: reasonMap[resolutionType] ?? "No XP",
            };
        }
        // ══════════════════════════════════════════════════════════════════
        // Normal XP computation (only reached for legitimate completions)
        // ══════════════════════════════════════════════════════════════════
        let baseXP = types_1.XP_CONFIG.BASE_PARTICIPATION;
        let bonusXP = 0;
        let bonusReason;
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
            // ── Game-specific progression XP ──────────────────────────────
            // Brick Breaker scales with `levelsCleared` so a losing run that
            // still reached level 25 earns more than one that died at level 3.
            // Capped so the total never exceeds roughly 2x a participation run.
            if (session.gameId === "brick_breaker") {
                const levelsCleared = Number(entry.stats?.levelsCleared ?? 0);
                // 2 XP per cleared level, cap at 50 (→ max total 60 XP incl. base).
                const BB_MAX_PROGRESS_BONUS = 50;
                const progressBonus = Math.min(levelsCleared * 2, BB_MAX_PROGRESS_BONUS);
                bonusXP = progressBonus;
                bonusReason =
                    levelsCleared > 0
                        ? `Reached Level ${levelsCleared + (isWinner ? 0 : 1)}`
                        : undefined;
            }
            else {
                // Generic solo: 1 XP per 1000 score, capped at MAX_PERFORMANCE_BONUS
                const scoreBonus = Math.min(Math.floor(entry.score / 1000), types_1.XP_CONFIG.MAX_PERFORMANCE_BONUS);
                bonusXP = scoreBonus;
                bonusReason =
                    scoreBonus > 0 ? `Score ${entry.score.toLocaleString()}` : undefined;
            }
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
function decodeMinesweeperScore(score) {
    if (!Number.isFinite(score) || score <= 0)
        return null;
    let difficulty;
    let tierBase;
    if (score >= 3_000_000) {
        difficulty = "expert";
        tierBase = 3_000_000;
    }
    else if (score >= 2_000_000) {
        difficulty = "intermediate";
        tierBase = 2_000_000;
    }
    else if (score >= 1_000_000) {
        difficulty = "easy";
        tierBase = 1_000_000;
    }
    else {
        return null;
    }
    const elapsedMs = 999_999 - (score - tierBase);
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
        return null;
    return { difficulty, elapsedMs };
}
async function updatePersonalBests(db, gameId, scoreboard, sessionId) {
    const batch = db.batch();
    const metric = (0, types_1.getLeaderboardMetric)(gameId);
    const deltas = [];
    const isMinesweeper = gameId === "minesweeper";
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
                const existing = await pbRef.get();
                const previousWins = existing.exists
                    ? (existing.data()?.totalWins ?? 0)
                    : 0;
                const isWinner = entry.placement === 1;
                const newWins = isWinner ? previousWins + 1 : previousWins;
                batch.set(pbRef, {
                    gameId,
                    totalPlays: admin.firestore.FieldValue.increment(1),
                    ...(isWinner
                        ? { totalWins: admin.firestore.FieldValue.increment(1) }
                        : {}),
                    schemaVersion: 1,
                }, { merge: true });
                deltas.push({
                    uid: entry.uid,
                    gameId,
                    metric: "wins",
                    variant: "default",
                    previousValue: existing.exists ? previousWins : null,
                    newValue: newWins,
                    higherIsBetter: true,
                    improved: isWinner,
                });
            }
            else {
                // ── Best-score games (2048, Brick Breaker, Minesweeper, etc.) ──
                // Keep running MAX of pbValue.
                const existing = await pbRef.get();
                const existingData = existing.exists ? existing.data() : undefined;
                const currentPb = existingData?.pbValue ?? -Infinity;
                const isPb = entry.score > currentPb;
                // Minesweeper: decode the encoded score and maintain a per-difficulty
                // best-time map so friends leaderboards can have one board per tier.
                // Lower elapsedMs = better. We store the raw ms value; the global
                // leaderboard still uses the encoded `pbValue`.
                let msPayload;
                if (isMinesweeper) {
                    const decoded = decodeMinesweeperScore(entry.score);
                    if (decoded) {
                        const prevByDiff = existingData?.bestsByDifficulty ?? {};
                        const prevBestMs = prevByDiff[decoded.difficulty]?.elapsedMs;
                        const improvedTier = prevBestMs === undefined || decoded.elapsedMs < prevBestMs;
                        if (improvedTier) {
                            msPayload = {
                                [`bestsByDifficulty.${decoded.difficulty}`]: {
                                    elapsedMs: decoded.elapsedMs,
                                    achievedAt: admin.firestore.Timestamp.now(),
                                    sessionId,
                                },
                            };
                        }
                        deltas.push({
                            uid: entry.uid,
                            gameId,
                            metric: "bestScore",
                            variant: decoded.difficulty,
                            previousValue: prevBestMs ?? null,
                            newValue: decoded.elapsedMs,
                            higherIsBetter: false,
                            improved: improvedTier,
                        });
                    }
                }
                if (isPb) {
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
                        ...(msPayload ?? {}),
                    }, { merge: true });
                }
                else {
                    // Still increment play count even if not a PB.
                    batch.set(pbRef, {
                        gameId,
                        totalPlays: admin.firestore.FieldValue.increment(1),
                        ...(entry.placement === 1
                            ? { totalWins: admin.firestore.FieldValue.increment(1) }
                            : {}),
                        ...(msPayload ?? {}),
                    }, { merge: true });
                }
                // Record a non-minesweeper bestScore delta (minesweeper is per-tier
                // so the aggregate encoded pbValue is not a friends-leaderboard metric).
                if (!isMinesweeper) {
                    deltas.push({
                        uid: entry.uid,
                        gameId,
                        metric: "bestScore",
                        variant: "default",
                        previousValue: existing.exists ? currentPb : null,
                        newValue: entry.score,
                        higherIsBetter: true,
                        improved: isPb,
                    });
                }
            }
        }
        catch (err) {
            console.error(`[resolveV4] Failed to update PB for ${entry.uid}:`, err);
        }
    }
    await batch.commit();
    return deltas;
}
// =============================================================================
// Beat-friend notifications
// =============================================================================
/**
 * Detect friends who were just overtaken on the friends leaderboard for
 * this game and send each affected friend a "[actor] beat your score"
 * notification.
 *
 * Only friends with an existing qualifying entry receive a notification.
 * Friends who never played the game (no PB doc, zero wins, or no entry
 * for the minesweeper difficulty in question) are silently skipped.
 *
 * A friend is "newly beaten" if:
 *   higherIsBetter=true  : friend.value <  newValue && friend.value >= previousValue
 *   higherIsBetter=false : friend.value >  newValue && friend.value <= previousValue
 *
 * This keeps the notification fair: we only pass someone when crossing
 * the tie boundary, never send multiple notifications for the same
 * overtake, and never notify friends who are still ahead.
 */
async function notifyFriendsBeatenByDeltas(db, session, deltas, scoreboard) {
    const improved = deltas.filter((d) => d.improved);
    if (improved.length === 0)
        return;
    const gameId = session.gameId;
    const displayNameByUid = new Map();
    for (const entry of scoreboard) {
        displayNameByUid.set(entry.uid, entry.displayName);
    }
    await Promise.all(improved.map(async (delta) => {
        try {
            // Load friendships: docs in "Friends" where users array-contains uid.
            const friendsSnap = await db
                .collection("Friends")
                .where("users", "array-contains", delta.uid)
                .get();
            const friendUids = [];
            for (const doc of friendsSnap.docs) {
                const users = doc.data().users;
                if (!Array.isArray(users))
                    continue;
                const other = users.find((u) => u !== delta.uid);
                if (other)
                    friendUids.push(other);
            }
            if (friendUids.length === 0)
                return;
            // Read each friend's PB doc in parallel.
            const friendPBSnaps = await Promise.all(friendUids.map((fuid) => db
                .collection("Users")
                .doc(fuid)
                .collection(types_1.COLLECTIONS.GAME_PB)
                .doc(gameId)
                .get()));
            const actorName = displayNameByUid.get(delta.uid) ??
                session.players.find((p) => p.uid === delta.uid)?.displayName ??
                "A friend";
            // Collect beaten friends for this delta.
            const beaten = [];
            for (let i = 0; i < friendUids.length; i++) {
                const snap = friendPBSnaps[i];
                if (!snap.exists)
                    continue;
                const data = snap.data() ?? {};
                let friendValue = null;
                if (delta.metric === "wins") {
                    const wins = data.totalWins ?? 0;
                    if (wins <= 0)
                        continue; // never won anything: no qualifying entry
                    friendValue = wins;
                }
                else if (gameId === "minesweeper") {
                    const byDiff = data.bestsByDifficulty;
                    const ms = byDiff?.[delta.variant]?.elapsedMs;
                    if (typeof ms !== "number" || ms <= 0)
                        continue;
                    friendValue = ms;
                }
                else {
                    const pb = data.pbValue;
                    if (typeof pb !== "number" || pb <= 0)
                        continue;
                    friendValue = pb;
                }
                if (friendValue === null)
                    continue;
                const prev = delta.previousValue === null
                    ? delta.higherIsBetter
                        ? -Infinity
                        : Infinity
                    : delta.previousValue;
                const newlyBeaten = delta.higherIsBetter
                    ? friendValue < delta.newValue && friendValue >= prev
                    : friendValue > delta.newValue && friendValue <= prev;
                if (newlyBeaten)
                    beaten.push(friendUids[i]);
            }
            if (beaten.length === 0)
                return;
            await Promise.all(beaten.map((victimUid) => (0, notifications_1.notifyFriendBeatScore)({
                victimUid,
                actorUid: delta.uid,
                actorName,
                gameId,
                variant: delta.variant,
            }).catch((err) => console.error(`[resolveV4] notifyFriendBeatScore failed for ${victimUid}:`, err))));
        }
        catch (err) {
            console.error(`[resolveV4] Beat-friend detection failed for ${delta.uid}:`, err);
        }
    }));
}
// =============================================================================
// Auto-post scorecard to hosting conversation
// =============================================================================
/**
 * Write a trusted inline scorecard message to the hosting DM or group.
 *
 * The message is authored by the session **host** (not `system`) so it
 * reads as a real in-chat message from the host — matching the manual
 * share-sheet flow, where the scorecard is authored by the sharing user.
 *
 * Deterministic doc id = `scorecard_{sessionId}` + `.create()` makes this
 * idempotent: a duplicate resolve/retry cannot double-post. `kind: "text"`
 * lets the standard renderer's trusted scorecard decode mount the rich
 * card — no special system-message wiring required.
 */
async function postGameScorecardToChat(db, session, result) {
    const conversationId = session.conversationId;
    const scope = session.conversationScope === "dm" ? "dm" : "group";
    const rootCollection = scope === "dm" ? "Chats" : "Groups";
    const hostId = session.hostId;
    // Host-preference gate: skip auto-post when the host has disabled
    // auto-sending scorecards for this specific conversation. Field is
    // stored on the host's per-conversation MembersPrivate doc. Missing /
    // undefined = enabled (product default).
    try {
        const prefSnap = await db
            .collection(rootCollection)
            .doc(conversationId)
            .collection("MembersPrivate")
            .doc(hostId)
            .get();
        const prefs = prefSnap.data();
        if (prefs?.autoSendScorecards === false) {
            console.log(`[resolveV4] Host ${hostId} disabled auto-send scorecards for ${scope} ${conversationId}; skipping.`);
            return;
        }
    }
    catch (err) {
        console.warn(`[resolveV4] Failed to read autoSendScorecards pref for host ${hostId}:`, err);
        // Fall through — default is enabled.
    }
    const messageId = `scorecard_${session.sessionId}`;
    const messageRef = db
        .collection(rootCollection)
        .doc(conversationId)
        .collection("Messages")
        .doc(messageId);
    const gameTitle = (0, notifications_1.getGameDisplayName)(session.gameId);
    // Thread equipped decorationId from PlayerSlot onto scoreboard so the
    // client scorecard renderer can draw pfp decorations per player.
    const slotDecorationByUid = new Map();
    for (const p of session.players ?? []) {
        slotDecorationByUid.set(p.uid, p.decorationId ?? null);
    }
    const scoreboard = result.scoreboard.map((e) => ({
        uid: e.uid,
        displayName: e.displayName,
        profilePictureUrl: e.profilePictureUrl ?? null,
        decorationId: slotDecorationByUid.get(e.uid) ?? null,
        score: typeof e.score === "number" ? e.score : 0,
        placement: e.placement,
    }));
    // Generic text surfaced in inboxes / notification previews / search /
    // clipboard / reply-snippet — anywhere the rich scorecard card is NOT
    // drawn. We deliberately do NOT include player names, winner names,
    // scores, or game title here: scorecards are privacy-sensitive and
    // leaking that content into previews/notifications is a hazard.
    //
    // The rich in-chat card reads its data from the JSON payload encoded
    // on line 1 of `wireText`; the human-readable line 2 is only used by
    // clients that don't yet know about scorecards.
    const fallbackText = messagePreview_1.SCORECARD_VISIBLE_TEXT;
    const now = admin.firestore.Timestamp.now();
    const createdAtMs = now.toMillis();
    // Personalization: when there is exactly one winner, fetch their
    // equipped profile background id so the scorecard renderer can paint
    // the card with the winner's profile background. We do a single user
    // doc read (best-effort: a failure simply leaves the field null and
    // the renderer falls back to the neutral default surface).
    let winnerEquippedBackgroundId = null;
    if (result.winnerIds.length === 1) {
        try {
            const winnerSnap = await db
                .collection("Users")
                .doc(result.winnerIds[0])
                .get();
            const winnerData = winnerSnap.data();
            winnerEquippedBackgroundId = winnerData?.equippedBackgroundId ?? null;
        }
        catch (err) {
            console.warn(`[resolveV4] Failed to read winner equippedBackgroundId for ${result.winnerIds[0]}:`, err);
        }
    }
    const scorecardPayload = {
        v: 1,
        sessionId: session.sessionId,
        gameId: session.gameId,
        gameTitle,
        runtimeType: session.runtimeType,
        resolutionType: result.resolutionType,
        winnerIds: result.winnerIds,
        scoreboard,
        durationMs: result.durationMs,
        createdAt: createdAtMs,
        winnerEquippedBackgroundId,
    };
    // Sentinel-encoded wire format — mirrors `encodeScorecardText()` in
    // `src/gamesV4/services/scorecardWire.ts`. First line is machine-
    // parsed by the renderer; second line is the human-readable fallback.
    const wireText = `${messagePreview_1.SCORECARD_SENTINEL}${JSON.stringify(scorecardPayload)}\n${fallbackText}`;
    // Host identity — auto-posted multiplayer scorecards are authored by
    // the session host so the message feels like a real post from that
    // user. Fall back to the scoreboard entry (same uid) for displayName /
    // avatar, then to the players slot, then to a safe default.
    const hostScoreboardEntry = scoreboard.find((s) => s.uid === hostId) ?? null;
    const hostPlayerSlot = session.players?.find((p) => p.uid === hostId) ?? null;
    const hostDisplayName = hostScoreboardEntry?.displayName ?? hostPlayerSlot?.displayName ?? "Player";
    // Shaped to align with `MessageV2` so the existing subscribe / normalize
    // / renderer path picks it up without changes. `kind: "text"` + the
    // sentinel decode short-circuit makes the scorecard render as a
    // native, sender-aligned in-chat message.
    const messageDoc = {
        id: messageId,
        scope,
        conversationId,
        senderId: hostId,
        senderName: hostDisplayName,
        kind: "text",
        text: wireText,
        createdAt: createdAtMs,
        serverReceivedAt: createdAtMs,
        clientId: "server",
        idempotencyKey: `server:scorecard:${session.sessionId}`,
    };
    try {
        await messageRef.create(messageDoc);
    }
    catch (err) {
        // `create()` on an existing doc throws ALREADY_EXISTS — treat as idempotent success.
        const code = err?.code;
        if (code === 6 || code === "already-exists") {
            console.log(`[resolveV4] Scorecard race — already posted for ${session.sessionId}.`);
            return;
        }
        throw err;
    }
    // Best-effort: update the conversation's last message summary so the
    // inbox preview reflects the scorecard. Non-fatal on failure.
    try {
        await db.collection(rootCollection).doc(conversationId).update({
            lastMessageText: fallbackText,
            lastMessageAt: createdAtMs,
            lastMessageSenderId: hostId,
            updatedAt: createdAtMs,
        });
    }
    catch (err) {
        console.warn(`[resolveV4] Failed to bump ${scope} lastMessage for ${conversationId}:`, err);
    }
    console.log(`[resolveV4] Posted scorecard to ${scope} ${conversationId} for session ${session.sessionId}.`);
}
//# sourceMappingURL=resolve.js.map