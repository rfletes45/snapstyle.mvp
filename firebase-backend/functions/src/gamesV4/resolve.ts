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

import * as admin from "firebase-admin";
import { evaluateAchievementsV4, getAllAchievementDefs } from "./achievements";
import {
  computeOutcome,
  extractPerformanceMetrics,
  hasAdapter,
} from "./adapters";
import {
  computeIntegrityHash,
  currentWeekKey,
  getDb,
  nowMs,
  unpinInviteFromConversation,
} from "./helpers";
import { unlockLevelRewards } from "./levelRewardsV4";
import {
  getGameDisplayName,
  notifyAchievementUnlocked,
  notifyFriendBeatScore,
  notifyResolved,
} from "./notifications";
import type {
  AchievementUnlock,
  FinalScoreboardEntry,
  GameId,
  GameResultV4,
  GameSessionV4,
  LeaderboardUpdate,
  ResolutionType,
  XPAward,
} from "./types";
import {
  COLLECTIONS,
  getLeaderboardMetric,
  RESOLVED_INVITE_TTL_MS,
  XP_CONFIG,
} from "./types";

// =============================================================================
// Input contract
// =============================================================================

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
export async function resolveSessionV4Internal(
  input: ResolveInput,
): Promise<GameResultV4 | null> {
  const db = getDb();
  const sessionRef = db
    .collection(COLLECTIONS.GAME_SESSIONS)
    .doc(input.sessionId);

  // ─── Phase 1: Atomic status transition ──────────────────────────────
  const session = await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) {
      console.warn(
        `[resolveV4] Session ${input.sessionId} not found. Skipping.`,
      );
      return null;
    }

    const data = snap.data() as GameSessionV4;

    // Idempotent: already resolved
    if (
      data.status === "resolved" ||
      data.status === "abandoned" ||
      data.status === "expired"
    ) {
      console.log(
        `[resolveV4] Session ${input.sessionId} already ${data.status}. Idempotent no-op.`,
      );
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
      status: "resolved" as const,
      resolvedAt: now.toMillis(),
      resolution: {
        type: input.resolutionType,
        winnerIds: input.winnerIds ?? [],
        ...(input.reason ? { reason: input.reason } : {}),
      },
    } as GameSessionV4;
  });

  if (!session) return null;

  // ─── Phase 2: Transition invite → resolved (skip for solo sessions) ──
  if (session.inviteId) {
    try {
      const inviteRef = db
        .collection(COLLECTIONS.GAME_INVITES)
        .doc(session.inviteId);
      const now = Date.now();
      await inviteRef.update({
        status: "resolved",
        updatedAt: admin.firestore.Timestamp.now(),
        hiddenInChat: false, // surface for resolved card display
        deleteRequestedAt: admin.firestore.Timestamp.fromMillis(now),
        deleteAt: admin.firestore.Timestamp.fromMillis(
          now + RESOLVED_INVITE_TTL_MS,
        ),
        "summary.phase": "resolved",
      });
    } catch (err) {
      console.error(
        `[resolveV4] Failed to transition invite ${session.inviteId}:`,
        err,
      );
    }
  }

  // ─── Phase 3: Compute result data ──────────────────────────────────
  // PERF: Start countMoves in parallel with scoreboard computation.
  // countMoves is an independent Firestore query that doesn't block scoreboard.
  const countMovesPromise = countMoves(db, input.sessionId);
  const durationMs = computeDuration(session);

  // Use adapter-driven scoreboard (with proper scores + stats) when available
  let scoreboard: FinalScoreboardEntry[];
  let performanceMetrics: Record<string, unknown> =
    input.performanceMetrics ?? {};

  if (input.scoreboard) {
    scoreboard = input.scoreboard;
    console.log(`[resolveV4] Using input.scoreboard for ${session.gameId}`);
  } else if (hasAdapter(session.gameId)) {
    try {
      const pubSnap = await db
        .collection(COLLECTIONS.GAME_SESSIONS)
        .doc(input.sessionId)
        .collection(COLLECTIONS.PUBLIC_STATE)
        .doc("state")
        .get();
      const pubState = pubSnap.exists
        ? (pubSnap.data() as Record<string, unknown>)
        : {};
      console.log(
        `[resolveV4] PublicState exists=${pubSnap.exists}, phase=${(pubState as Record<string, unknown>).phase}, campaignScore=${((pubState as Record<string, unknown>).campaign as Record<string, unknown> | undefined)?.score}`,
      );
      const players = session.players.map((p, i) => ({
        uid: p.uid,
        slotIndex: i,
        displayName: p.displayName ?? "Player",
        avatarConfig: p.avatarConfig,
        profilePictureUrl: p.profilePictureUrl ?? null,
      }));
      const outcome = computeOutcome(
        session.gameId,
        pubState,
        players,
        input.winnerIds ?? [],
      );
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
      console.log(
        `[resolveV4] computeOutcome for ${session.gameId}: scores=${JSON.stringify(scoreboard.map((s) => ({ uid: s.uid, score: s.score })))}`,
      );
      // Also grab performance metrics for achievement evaluation
      if (Object.keys(performanceMetrics).length === 0) {
        performanceMetrics = extractPerformanceMetrics(
          session.gameId,
          pubState,
          session.players.map((p) => ({ uid: p.uid })),
        );
      }
    } catch (err) {
      console.warn(
        `[resolveV4] computeOutcome failed for ${session.gameId}, falling back to buildDefaultScoreboard:`,
        err,
      );
      scoreboard = buildDefaultScoreboard(session, input.winnerIds ?? []);
    }
  } else {
    console.log(
      `[resolveV4] No adapter for ${session.gameId}, using buildDefaultScoreboard`,
    );
    scoreboard = buildDefaultScoreboard(session, input.winnerIds ?? []);
  }

  const xpAwards = computeXPAwards(
    session,
    input.resolutionType,
    input.winnerIds ?? [],
    scoreboard,
    input.resolverUid,
  );

  // Await the parallel countMoves query
  const totalMoves = await countMovesPromise;

  const weekKey = currentWeekKey();
  const leaderboardUpdates: LeaderboardUpdate[] = []; // Populated below

  const result: GameResultV4 = {
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
    .collection(COLLECTIONS.GAME_RESULTS)
    .doc(input.sessionId);
  await resultRef.set(result);

  // ─── Phase 4.5: Evaluate achievements (deferred from Phase 3) ─────
  // This runs AFTER the result doc is written so the client sees
  // scoreboard/XP immediately. Achievement unlocks are patched in.
  const achievementUnlocks: AchievementUnlock[] = await evaluateAchievementsV4(
    db,
    session,
    {
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
    },
  );
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
  } catch (err) {
    console.error(`[resolveV4] Beat-friend notification phase failed:`, err);
  }

  // ─── Phases 8-9: Unpin invite + mark rewards in parallel ─────────
  // PERF: These writes are independent; run together.
  const tailWrites: Promise<unknown>[] = [
    sessionRef.update({ rewardsProcessed: true }),
  ];
  if (session.inviteId) {
    tailWrites.push(
      unpinInviteFromConversation(
        session.conversationId,
        session.conversationScope,
        session.inviteId,
      ).catch((err) =>
        console.error(
          `[resolveV4] Failed to unpin invite ${session.inviteId}:`,
          err,
        ),
      ),
    );
  }
  await Promise.all(tailWrites);

  // ─── Phase 9.5: Send achievement unlock notifications ──────────────
  if (achievementUnlocks.length > 0) {
    // Group unlocks by uid so each player gets one notification
    const unlocksByUid = new Map<string, AchievementUnlock[]>();
    for (const unlock of achievementUnlocks) {
      const list = unlocksByUid.get(unlock.uid) ?? [];
      list.push(unlock);
      unlocksByUid.set(unlock.uid, list);
    }

    // Build a type→name lookup so notification bodies use human-readable names
    const achNameMap = new Map(
      getAllAchievementDefs().map((d) => [d.type, d.name]),
    );

    const achievementNotifPromises = Array.from(unlocksByUid.entries()).map(
      ([uid, unlocks]) =>
        notifyAchievementUnlocked({
          uid,
          achievementIds: unlocks.map((u) => u.achievementType),
          achievementTitles: unlocks.map(
            (u) => achNameMap.get(u.achievementType) ?? u.achievementType,
          ),
          sectionId: undefined, // multiple sections possible
          gameId: session.gameId,
          sessionId: session.sessionId,
        }).catch((err) =>
          console.error(
            `[resolveV4] Failed to send achievement notification to ${uid}:`,
            err,
          ),
        ),
    );

    await Promise.allSettled(achievementNotifPromises);
  }

  // ─── Phase 10: Send resolved notifications ─────────────────────────
  try {
    await notifyResolved(result, session.conversationScope, input.resolverUid);
  } catch (err) {
    console.error(`[resolveV4] Failed to send resolved notifications:`, err);
  }

  // ─── Phase 10.5: Auto-post scorecard to group chat ────────────────
  // Group-only, multiplayer-only. DMs never receive auto-posts per product
  // requirement — users in DMs can still share via the GameOverScreen
  // "Share" button. Solo sessions have no conversation chat to post into.
  if (
    session.conversationScope === "group" &&
    session.runtimeType !== "solo" &&
    session.conversationId
  ) {
    try {
      await postGameScorecardToGroup(db, session, result);
    } catch (err) {
      console.error(
        `[resolveV4] Failed to auto-post scorecard to group ${session.conversationId}:`,
        err,
      );
    }
  }

  console.log(
    `[resolveV4] Session ${input.sessionId} resolved as ${input.resolutionType}. ` +
      `XP awarded to ${xpAwards.length} players.`,
  );

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
export async function retryRewardsForSession(sessionId: string): Promise<void> {
  const db = getDb();
  const sessionRef = db.collection(COLLECTIONS.GAME_SESSIONS).doc(sessionId);

  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    console.warn(`[resolveV4] retryRewards: session ${sessionId} not found.`);
    return;
  }

  const session = sessionSnap.data() as GameSessionV4;

  // Guard: only retry for resolved sessions that haven't processed rewards
  if (session.rewardsProcessed) {
    console.log(
      `[resolveV4] retryRewards: session ${sessionId} already processed.`,
    );
    return;
  }
  if (session.status !== "resolved") {
    console.warn(
      `[resolveV4] retryRewards: session ${sessionId} not resolved (${session.status}).`,
    );
    return;
  }

  // Read existing result doc (created by Phase 4 in resolveSessionV4Internal)
  const resultSnap = await db
    .collection(COLLECTIONS.GAME_RESULTS)
    .doc(sessionId)
    .get();

  if (!resultSnap.exists) {
    // Result doc was never written — can't retry. Needs full re-resolution.
    console.warn(
      `[resolveV4] retryRewards: no result doc for ${sessionId}. Cannot retry.`,
    );
    return;
  }

  const result = resultSnap.data() as GameResultV4;
  const weekKey = currentWeekKey();

  // ─── Phase 5: Apply XP ─────────────────────────────────────────────
  await applyXPAwards(db, result.xpAwards);

  // ─── Phase 6: Update leaderboards ──────────────────────────────────
  await updateLeaderboards(db, session.gameId, weekKey, result.scoreboard);

  // ─── Phase 7: Update personal bests ────────────────────────────────
  await updatePersonalBests(db, session.gameId, result.scoreboard, sessionId);

  // ─── Phase 9: Mark rewards processed ───────────────────────────────
  await sessionRef.update({ rewardsProcessed: true });

  console.log(
    `[resolveV4] retryRewards: successfully re-applied rewards for ${sessionId}.`,
  );
}

// =============================================================================
// Duration computation
// =============================================================================

function computeDuration(session: GameSessionV4): number {
  const startMs = toMs(session.startedAt);
  const endMs = nowMs();
  if (!startMs) return 0;
  return Math.max(0, endMs - startMs);
}

function toMs(ts: unknown): number | null {
  if (ts === null || ts === undefined) return null;
  if (typeof ts === "number") return ts;
  // Firestore Timestamp
  if (typeof ts === "object" && "toMillis" in (ts as object)) {
    return (ts as FirebaseFirestore.Timestamp).toMillis();
  }
  return null;
}

// =============================================================================
// Move counting
// =============================================================================

async function countMoves(
  db: FirebaseFirestore.Firestore,
  sessionId: string,
): Promise<number> {
  const snap = await db
    .collection(COLLECTIONS.GAME_SESSIONS)
    .doc(sessionId)
    .collection(COLLECTIONS.MOVES)
    .count()
    .get();
  return snap.data().count;
}

// =============================================================================
// Default scoreboard
// =============================================================================

function buildDefaultScoreboard(
  session: GameSessionV4,
  winnerIds: string[],
): FinalScoreboardEntry[] {
  return session.players.map((player, idx) => {
    const isWinner = winnerIds.includes(player.uid);
    // Try to use existing scoreboard summary
    const summaryEntry = session.scoreboardSummary?.find(
      (e) => e.uid === player.uid,
    );
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

function computeXPAwards(
  session: GameSessionV4,
  resolutionType: ResolutionType,
  winnerIds: string[],
  scoreboard: FinalScoreboardEntry[],
  resolverUid?: string,
): XPAward[] {
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
      const isResigner =
        (resolverUid && entry.uid === resolverUid) || !isWinner;
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
    if (
      (resolutionType === "disconnect" || resolutionType === "timeout") &&
      !isWinner
    ) {
      const reasonMap: Record<string, string> = {
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
    let baseXP = XP_CONFIG.BASE_PARTICIPATION;
    let bonusXP = 0;
    let bonusReason: string | undefined;

    if (isWinner) {
      bonusXP += XP_CONFIG.WIN_BONUS;
      bonusReason = "Victory";
    } else if (isDraw) {
      bonusXP += XP_CONFIG.DRAW_BONUS;
      bonusReason = "Draw";
    }

    // Solo games: award score-based XP instead of win/draw multiplayer bonus
    if (session.runtimeType === "solo") {
      baseXP = XP_CONFIG.BASE_PARTICIPATION;

      // ── Game-specific progression XP ──────────────────────────────
      // Brick Breaker scales with `levelsCleared` so a losing run that
      // still reached level 25 earns more than one that died at level 3.
      // Capped so the total never exceeds roughly 2x a participation run.
      if (session.gameId === "brick_breaker") {
        const levelsCleared = Number(
          (entry.stats as Record<string, unknown>)?.levelsCleared ?? 0,
        );
        // 2 XP per cleared level, cap at 50 (→ max total 60 XP incl. base).
        const BB_MAX_PROGRESS_BONUS = 50;
        const progressBonus = Math.min(
          levelsCleared * 2,
          BB_MAX_PROGRESS_BONUS,
        );
        bonusXP = progressBonus;
        bonusReason =
          levelsCleared > 0
            ? `Reached Level ${levelsCleared + (isWinner ? 0 : 1)}`
            : undefined;
      } else {
        // Generic solo: 1 XP per 1000 score, capped at MAX_PERFORMANCE_BONUS
        const scoreBonus = Math.min(
          Math.floor(entry.score / 1000),
          XP_CONFIG.MAX_PERFORMANCE_BONUS,
        );
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

async function applyXPAwards(
  db: FirebaseFirestore.Firestore,
  xpAwards: XPAward[],
): Promise<void> {
  const batch = db.batch();

  for (const award of xpAwards) {
    const userRef = db.collection("Users").doc(award.uid);

    try {
      const userDoc = await userRef.get();
      if (!userDoc.exists) continue;

      const userData = userDoc.data()!;
      const currentLevel = userData.level?.current ?? 1;
      const currentXp = userData.level?.xp ?? 0;
      const currentTotalXp = userData.level?.totalXp ?? 0;

      const MAX_LEVEL = 50;

      const newTotalXp = currentTotalXp + award.totalXP;
      let newXp = currentXp + award.totalXP;
      let newLevel = currentLevel;

      // Level up check — capped at MAX_LEVEL
      let threshold = XP_CONFIG.levelXpThreshold(newLevel);
      while (newXp >= threshold && newLevel < MAX_LEVEL) {
        newXp -= threshold;
        newLevel++;
        threshold = XP_CONFIG.levelXpThreshold(newLevel);
      }

      // Clamp level to cap (handles pre-existing levels > 50)
      if (newLevel > MAX_LEVEL) {
        newLevel = MAX_LEVEL;
        threshold = XP_CONFIG.levelXpThreshold(MAX_LEVEL);
        newXp = 0;
      }

      // At level cap: freeze XP bar as full
      if (newLevel === MAX_LEVEL) {
        threshold = XP_CONFIG.levelXpThreshold(MAX_LEVEL);
        // Keep xp as-is but xpToNextLevel = threshold so bar shows progress
        // If xp >= threshold, clamp to threshold (display as MAX)
        if (newXp >= threshold) {
          newXp = threshold;
        }
      }

      const levelUpdate: Record<string, unknown> = {
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
      batch.set(
        statsRef,
        {
          gamesPlayed: admin.firestore.FieldValue.increment(1),
          ...(award.bonusReason === "Victory"
            ? { gamesWon: admin.firestore.FieldValue.increment(1) }
            : {}),
        },
        { merge: true },
      );
    } catch (err) {
      console.error(`[resolveV4] Failed to compute XP for ${award.uid}:`, err);
    }
  }

  await batch.commit();

  // ─── Unlock level rewards for players that leveled up ────────────────
  for (const award of xpAwards) {
    if (award.levelUp) {
      try {
        await unlockLevelRewards(
          db,
          award.uid,
          award.levelUp.oldLevel,
          award.levelUp.newLevel,
        );
      } catch (err) {
        console.error(
          `[resolveV4] Failed to unlock level rewards for ${award.uid}:`,
          err,
        );
      }
    }
  }
}

// =============================================================================
// Leaderboard updates
// =============================================================================

async function updateLeaderboards(
  db: FirebaseFirestore.Firestore,
  gameId: GameId,
  weekKey: string,
  scoreboard: FinalScoreboardEntry[],
): Promise<LeaderboardUpdate[]> {
  const updates: LeaderboardUpdate[] = [];
  const batch = db.batch();
  const metric = getLeaderboardMetric(gameId);

  // Ensure week document exists
  const weekRef = db
    .collection(COLLECTIONS.LEADERBOARDS)
    .doc(gameId)
    .collection("Weeks")
    .doc(weekKey);
  batch.set(
    weekRef,
    { weekKey, gameId, createdAt: admin.firestore.Timestamp.now() },
    { merge: true },
  );

  for (const entry of scoreboard) {
    const entryRef = weekRef.collection("Entries").doc(entry.uid);

    try {
      const existing = await entryRef.get();
      const previousScore = existing.exists
        ? (existing.data()?.score ?? null)
        : null;

      let newScore: number;
      if (metric === "wins") {
        // For wins-based games: increment score by 1 for winners only
        const isWinner = entry.placement === 1;
        const prev = (previousScore as number) ?? 0;
        newScore = isWinner ? prev + 1 : prev;
      } else {
        // For bestScore-based games: keep running max
        newScore =
          previousScore !== null
            ? Math.max(previousScore as number, entry.score)
            : entry.score;
      }

      batch.set(
        entryRef,
        {
          uid: entry.uid,
          displayName: entry.displayName,
          score: newScore,
          updatedAt: admin.firestore.Timestamp.now(),
        },
        { merge: true },
      );

      updates.push({
        uid: entry.uid,
        gameId,
        weekKey,
        newScore,
        previousScore,
      });
    } catch (err) {
      console.error(
        `[resolveV4] Failed to update leaderboard for ${entry.uid}:`,
        err,
      );
    }
  }

  await batch.commit();
  return updates;
}

// =============================================================================
// Personal best updates
// =============================================================================

/**
 * Minesweeper difficulty decoded from the encoded score.
 * Mirrors `encodeBestScore` in `src/gamesV4/games/minesweeper/types.ts`.
 */
type MinesweeperDifficulty = "easy" | "intermediate" | "expert";

function decodeMinesweeperScore(
  score: number,
): { difficulty: MinesweeperDifficulty; elapsedMs: number } | null {
  if (!Number.isFinite(score) || score <= 0) return null;
  let difficulty: MinesweeperDifficulty;
  let tierBase: number;
  if (score >= 3_000_000) {
    difficulty = "expert";
    tierBase = 3_000_000;
  } else if (score >= 2_000_000) {
    difficulty = "intermediate";
    tierBase = 2_000_000;
  } else if (score >= 1_000_000) {
    difficulty = "easy";
    tierBase = 1_000_000;
  } else {
    return null;
  }
  const elapsedMs = 999_999 - (score - tierBase);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  return { difficulty, elapsedMs };
}

/**
 * Per-uid delta describing how a player's aggregate leaderboard value
 * changed during this resolution. Fed to the beat-friend notification
 * phase so we can detect friends who just got passed on a board.
 *
 * `variant` partitions Minesweeper by difficulty so each tier maintains
 * an independent leaderboard. All other games use variant = "default".
 *
 * `higherIsBetter = false` is only set for Minesweeper (time metric).
 */
export interface PBDelta {
  uid: string;
  gameId: GameId;
  metric: "wins" | "bestScore";
  variant: string;
  previousValue: number | null;
  newValue: number;
  higherIsBetter: boolean;
  improved: boolean;
}

async function updatePersonalBests(
  db: FirebaseFirestore.Firestore,
  gameId: GameId,
  scoreboard: FinalScoreboardEntry[],
  sessionId: string,
): Promise<PBDelta[]> {
  const batch = db.batch();
  const metric = getLeaderboardMetric(gameId);
  const deltas: PBDelta[] = [];
  const isMinesweeper = gameId === "minesweeper";

  for (const entry of scoreboard) {
    const pbRef = db
      .collection("Users")
      .doc(entry.uid)
      .collection(COLLECTIONS.GAME_PB)
      .doc(gameId);

    try {
      if (metric === "wins") {
        // ── Wins-based games (TTT, Connect4, Chess, Crazy 8s, Battleship) ──
        // PB value comparison is meaningless (score is always 1 or 0).
        // Only track totalPlays / totalWins — the client reads totalWins
        // for leaderboard display.
        const existing = await pbRef.get();
        const previousWins = existing.exists
          ? ((existing.data()?.totalWins as number | undefined) ?? 0)
          : 0;
        const isWinner = entry.placement === 1;
        const newWins = isWinner ? previousWins + 1 : previousWins;

        batch.set(
          pbRef,
          {
            gameId,
            totalPlays: admin.firestore.FieldValue.increment(1),
            ...(isWinner
              ? { totalWins: admin.firestore.FieldValue.increment(1) }
              : {}),
            schemaVersion: 1,
          },
          { merge: true },
        );

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
      } else {
        // ── Best-score games (2048, Brick Breaker, Minesweeper, etc.) ──
        // Keep running MAX of pbValue.
        const existing = await pbRef.get();
        const existingData = existing.exists ? existing.data() : undefined;
        const currentPb =
          (existingData?.pbValue as number | undefined) ?? -Infinity;
        const isPb = entry.score > (currentPb as number);

        // Minesweeper: decode the encoded score and maintain a per-difficulty
        // best-time map so friends leaderboards can have one board per tier.
        // Lower elapsedMs = better. We store the raw ms value; the global
        // leaderboard still uses the encoded `pbValue`.
        let msPayload: Record<string, unknown> | undefined;
        if (isMinesweeper) {
          const decoded = decodeMinesweeperScore(entry.score);
          if (decoded) {
            const prevByDiff =
              (existingData?.bestsByDifficulty as
                | Record<string, { elapsedMs?: number } | undefined>
                | undefined) ?? {};
            const prevBestMs = prevByDiff[decoded.difficulty]?.elapsedMs;
            const improvedTier =
              prevBestMs === undefined || decoded.elapsedMs < prevBestMs;

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
          const hash = computeIntegrityHash(
            entry.uid,
            gameId,
            entry.score,
            sessionId,
          );

          batch.set(
            pbRef,
            {
              gameId,
              pbValue: entry.score,
              pbMeta: entry.stats || {},
              achievedAt: admin.firestore.Timestamp.now(),
              sessionId,
              totalPlays: admin.firestore.FieldValue.increment(1),
              totalWins:
                entry.placement === 1
                  ? admin.firestore.FieldValue.increment(1)
                  : admin.firestore.FieldValue.increment(0),
              integrityHash: hash,
              schemaVersion: 1,
              ...(msPayload ?? {}),
            },
            { merge: true },
          );
        } else {
          // Still increment play count even if not a PB.
          batch.set(
            pbRef,
            {
              gameId,
              totalPlays: admin.firestore.FieldValue.increment(1),
              ...(entry.placement === 1
                ? { totalWins: admin.firestore.FieldValue.increment(1) }
                : {}),
              ...(msPayload ?? {}),
            },
            { merge: true },
          );
        }

        // Record a non-minesweeper bestScore delta (minesweeper is per-tier
        // so the aggregate encoded pbValue is not a friends-leaderboard metric).
        if (!isMinesweeper) {
          deltas.push({
            uid: entry.uid,
            gameId,
            metric: "bestScore",
            variant: "default",
            previousValue: existing.exists ? (currentPb as number) : null,
            newValue: entry.score,
            higherIsBetter: true,
            improved: isPb,
          });
        }
      }
    } catch (err) {
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
async function notifyFriendsBeatenByDeltas(
  db: FirebaseFirestore.Firestore,
  session: GameSessionV4,
  deltas: PBDelta[],
  scoreboard: FinalScoreboardEntry[],
): Promise<void> {
  const improved = deltas.filter((d) => d.improved);
  if (improved.length === 0) return;

  const gameId = session.gameId;
  const displayNameByUid = new Map<string, string>();
  for (const entry of scoreboard) {
    displayNameByUid.set(entry.uid, entry.displayName);
  }

  await Promise.all(
    improved.map(async (delta) => {
      try {
        // Load friendships: docs in "Friends" where users array-contains uid.
        const friendsSnap = await db
          .collection("Friends")
          .where("users", "array-contains", delta.uid)
          .get();

        const friendUids: string[] = [];
        for (const doc of friendsSnap.docs) {
          const users = doc.data().users as string[] | undefined;
          if (!Array.isArray(users)) continue;
          const other = users.find((u) => u !== delta.uid);
          if (other) friendUids.push(other);
        }

        if (friendUids.length === 0) return;

        // Read each friend's PB doc in parallel.
        const friendPBSnaps = await Promise.all(
          friendUids.map((fuid) =>
            db
              .collection("Users")
              .doc(fuid)
              .collection(COLLECTIONS.GAME_PB)
              .doc(gameId)
              .get(),
          ),
        );

        const actorName =
          displayNameByUid.get(delta.uid) ??
          session.players.find((p) => p.uid === delta.uid)?.displayName ??
          "A friend";

        // Collect beaten friends for this delta.
        const beaten: string[] = [];
        for (let i = 0; i < friendUids.length; i++) {
          const snap = friendPBSnaps[i];
          if (!snap.exists) continue;
          const data = snap.data() ?? {};

          let friendValue: number | null = null;

          if (delta.metric === "wins") {
            const wins = (data.totalWins as number | undefined) ?? 0;
            if (wins <= 0) continue; // never won anything: no qualifying entry
            friendValue = wins;
          } else if (gameId === "minesweeper") {
            const byDiff = data.bestsByDifficulty as
              | Record<string, { elapsedMs?: number } | undefined>
              | undefined;
            const ms = byDiff?.[delta.variant]?.elapsedMs;
            if (typeof ms !== "number" || ms <= 0) continue;
            friendValue = ms;
          } else {
            const pb = data.pbValue as number | undefined;
            if (typeof pb !== "number" || pb <= 0) continue;
            friendValue = pb;
          }

          if (friendValue === null) continue;

          const prev =
            delta.previousValue === null
              ? delta.higherIsBetter
                ? -Infinity
                : Infinity
              : delta.previousValue;

          const newlyBeaten = delta.higherIsBetter
            ? friendValue < delta.newValue && friendValue >= prev
            : friendValue > delta.newValue && friendValue <= prev;

          if (newlyBeaten) beaten.push(friendUids[i]);
        }

        if (beaten.length === 0) return;

        await Promise.all(
          beaten.map((victimUid) =>
            notifyFriendBeatScore({
              victimUid,
              actorUid: delta.uid,
              actorName,
              gameId,
              variant: delta.variant,
            }).catch((err) =>
              console.error(
                `[resolveV4] notifyFriendBeatScore failed for ${victimUid}:`,
                err,
              ),
            ),
          ),
        );
      } catch (err) {
        console.error(
          `[resolveV4] Beat-friend detection failed for ${delta.uid}:`,
          err,
        );
      }
    }),
  );
}

// =============================================================================
// Auto-post scorecard to group chat
// =============================================================================

/**
 * Write a message to `Groups/{groupId}/Messages` containing a
 * `gameScorecard` payload clients can render inline.
 *
 * The message is authored by the session **host** (not `system`) so it
 * reads as a real in-chat message from the host — matching the manual
 * share-sheet flow, where the scorecard is authored by the sharing user.
 *
 * Deterministic doc id = `scorecard_{sessionId}` + `.create()` makes this
 * idempotent: a duplicate resolve/retry cannot double-post. `kind: "text"`
 * lets the standard renderer's scorecard decode short-circuit mount the
 * rich card — no special system-message wiring required.
 */
async function postGameScorecardToGroup(
  db: FirebaseFirestore.Firestore,
  session: GameSessionV4,
  result: GameResultV4,
): Promise<void> {
  const groupId = session.conversationId;
  const messageId = `scorecard_${session.sessionId}`;
  const messageRef = db
    .collection("Groups")
    .doc(groupId)
    .collection("Messages")
    .doc(messageId);

  // Idempotency: skip if already posted.
  const existing = await messageRef.get();
  if (existing.exists) {
    console.log(
      `[resolveV4] Scorecard message already exists for ${session.sessionId}, skipping.`,
    );
    return;
  }

  const gameTitle = getGameDisplayName(session.gameId);
  const scoreboard = result.scoreboard.map((e) => ({
    uid: e.uid,
    displayName: e.displayName,
    profilePictureUrl: e.profilePictureUrl ?? null,
    score: typeof e.score === "number" ? e.score : 0,
    placement: e.placement,
  }));

  // Short text fallback surfaced in inboxes / notification previews
  // for clients that don't yet render the scorecard payload.
  let fallbackText: string;
  if (result.resolutionType === "loss") {
    fallbackText = `🎮 ${gameTitle} — Game over`;
  } else if (
    result.resolutionType === "draw" ||
    result.winnerIds.length === 0
  ) {
    fallbackText = `🎮 ${gameTitle} — Draw`;
  } else if (result.winnerIds.length === 1) {
    const winner = scoreboard.find((s) => s.uid === result.winnerIds[0]);
    fallbackText = `🎮 ${gameTitle} — ${winner?.displayName ?? "Winner"} won!`;
  } else {
    fallbackText = `🎮 ${gameTitle} — Game over`;
  }

  const now = admin.firestore.Timestamp.now();
  const createdAtMs = now.toMillis();

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
  };

  // Sentinel-encoded wire format — mirrors `encodeScorecardText()` in
  // `src/gamesV4/services/scorecardWire.ts`. First line is machine-
  // parsed by the renderer; second line is the human-readable fallback.
  const SCORECARD_SENTINEL = "[SCORECARD_V1]";
  const wireText = `${SCORECARD_SENTINEL}${JSON.stringify(scorecardPayload)}\n${fallbackText}`;

  // Host identity — auto-posted multiplayer scorecards are authored by
  // the session host so the message feels like a real post from that
  // user. Fall back to the scoreboard entry (same uid) for displayName /
  // avatar, then to the players slot, then to a safe default.
  const hostId = session.hostId;
  const hostScoreboardEntry = scoreboard.find((s) => s.uid === hostId) ?? null;
  const hostPlayerSlot = session.players?.find((p) => p.uid === hostId) ?? null;
  const hostDisplayName =
    hostScoreboardEntry?.displayName ?? hostPlayerSlot?.displayName ?? "Player";

  // Shaped to align with `MessageV2` so the existing group subscribe /
  // normalize / renderer path picks it up without changes. `kind: "text"`
  // + the sentinel decode short-circuit makes the scorecard render as a
  // native, sender-aligned in-chat message.
  const messageDoc = {
    id: messageId,
    scope: "group" as const,
    conversationId: groupId,
    senderId: hostId,
    senderName: hostDisplayName,
    kind: "text" as const,
    text: wireText,
    createdAt: createdAtMs,
    serverReceivedAt: createdAtMs,
    clientId: "server",
    idempotencyKey: `server:scorecard:${session.sessionId}`,
  };

  try {
    await messageRef.create(messageDoc);
  } catch (err: unknown) {
    // `create()` on an existing doc throws ALREADY_EXISTS — treat as idempotent success.
    const code = (err as { code?: number | string } | null)?.code;
    if (code === 6 || code === "already-exists") {
      console.log(
        `[resolveV4] Scorecard race — already posted for ${session.sessionId}.`,
      );
      return;
    }
    throw err;
  }

  // Best-effort: update the group's last message summary so the inbox
  // preview reflects the scorecard. Non-fatal on failure.
  try {
    await db.collection("Groups").doc(groupId).update({
      lastMessageText: fallbackText,
      lastMessageAt: createdAtMs,
      lastMessageSenderId: hostId,
      updatedAt: createdAtMs,
    });
  } catch (err) {
    console.warn(
      `[resolveV4] Failed to bump group lastMessage for ${groupId}:`,
      err,
    );
  }

  console.log(
    `[resolveV4] Posted scorecard to group ${groupId} for session ${session.sessionId}.`,
  );
}
