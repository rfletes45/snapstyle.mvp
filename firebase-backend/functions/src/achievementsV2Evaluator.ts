/**
 * Achievements V2 — Server-Side Evaluator
 *
 * Deterministic achievement evaluation engine for Cloud Functions.
 * Reads trusted stats, computes achievement progress, and writes
 * canonical v2 achievement docs.
 *
 * Firestore paths written:
 *   /users/{uid}/achievements/{achievementId}
 *   /users/{uid}/achievementSummary
 *
 * Firestore paths read:
 *   /PlayerGameStats/{playerId}
 *   /users/{uid}/socialGameStats
 *
 * Design principles:
 *   - Idempotent: running multiple times never reduces progress/unlocks
 *   - Server-authoritative: source = "server"
 *   - Minimal reads: only reads stats relevant to active achievements
 *   - Batch writes: groups updates into a single batch
 *
 * @module achievementsV2Evaluator
 */

import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import * as functions from "firebase-functions";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =============================================================================
// Types (server-side copies — no dependency on client @/ imports)
// =============================================================================

type AchievementV2Category =
  | "global"
  | "single_player"
  | "turn_based"
  | "real_time";
type AchievementV2Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond";
type AchievementV2ProgressType =
  | "count"
  | "threshold"
  | "streak"
  | "instant"
  | "pct_of_max";
type AchievementState = "locked" | "progress" | "unlocked";

interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementV2Category;
  tier: AchievementV2Tier;
  gameType?: string;
  progressType: AchievementV2ProgressType;
  target: number;
  pctThreshold?: number;
  xpReward: number;
  coinReward: number;
  secret?: boolean;
  isEnabledByDefault: boolean;
  version: number;
  group?: string;
  sortOrder?: number;
}

interface UserAchievementDoc {
  achievementId: string;
  state: AchievementState;
  progress: number;
  target: number;
  unlockedAt: number | null;
  version: number;
  source: "server" | "migration" | "client";
  updatedAt: number;
  createdAt: number;
}

interface PerGameStats {
  gameType: string;
  played: number;
  wins: number;
  completed: number;
  solved: number;
  streak: number;
  bestStreak: number;
  highScore: number;
  matches: number;
  lastPlayedAt: number;
  firstPlayedAt: number;
  updatedAt: number;
}

interface SocialGameStats {
  invitesSent: number;
  invitesAcceptedByOthers: number;
  gamesWatched: number;
  turnBasedRematchesCompleted: number;
  updatedAt: number;
}

interface AchievementSummaryDoc {
  totalUnlocked: number;
  totalAvailable: number;
  unlockedByTier: Record<AchievementV2Tier, number>;
  totalXpEarned: number;
  totalCoinsEarned: number;
  unlockedIds: string[];
  lastEvaluatedAt: number;
  updatedAt: number;
}

interface AchievementEvalResult {
  achievementId: string;
  previousState: AchievementState;
  newState: AchievementState;
  progress: number;
  target: number;
  justUnlocked: boolean;
}

interface EvaluationResult {
  userId: string;
  evaluated: number;
  newUnlocks: AchievementEvalResult[];
  errors: Array<{ achievementId: string; error: string }>;
  legacySynced: boolean;
  timestamp: number;
}

// =============================================================================
// Score Limits (server-side copy)
// =============================================================================

interface GameScoreLimits {
  minScore: number;
  maxScore: number;
  scoreDirection: "higher" | "lower";
}

const SCORE_LIMITS: Record<string, GameScoreLimits> = {
  bounce_blitz: { minScore: 0, maxScore: 999999, scoreDirection: "higher" },
  play_2048: { minScore: 0, maxScore: 999999, scoreDirection: "higher" },
  word_master: { minScore: 1, maxScore: 6, scoreDirection: "lower" },
  brick_breaker: { minScore: 0, maxScore: 999999, scoreDirection: "higher" },
  minesweeper_classic: { minScore: 1, maxScore: 9999, scoreDirection: "lower" },
  lights_out: { minScore: 1, maxScore: 999, scoreDirection: "lower" },
  pong_game: { minScore: 0, maxScore: 999, scoreDirection: "higher" },
  chess: { minScore: 0, maxScore: 9999, scoreDirection: "higher" },
  checkers: { minScore: 0, maxScore: 9999, scoreDirection: "higher" },
  crazy_eights: { minScore: 0, maxScore: 9999, scoreDirection: "higher" },
  tic_tac_toe: { minScore: 0, maxScore: 9999, scoreDirection: "higher" },
  connect_four: { minScore: 0, maxScore: 9999, scoreDirection: "higher" },
  dot_match: { minScore: 0, maxScore: 16, scoreDirection: "higher" },
  gomoku_master: { minScore: 0, maxScore: 9999, scoreDirection: "higher" },
  reversi_game: { minScore: 0, maxScore: 9999, scoreDirection: "higher" },
  crossword_puzzle: { minScore: 1, maxScore: 9999, scoreDirection: "lower" },
  starforge_game: {
    minScore: 0,
    maxScore: 999999999,
    scoreDirection: "higher",
  },
  sketch_party_game: { minScore: 0, maxScore: 99999, scoreDirection: "higher" },
  minigolf_duels: { minScore: 0, maxScore: 999, scoreDirection: "lower" },
};

/**
 * Check if a score is suspicious (out of valid range).
 */
function isScoreSuspicious(score: number, gameType: string): boolean {
  const limits = SCORE_LIMITS[gameType];
  if (!limits) return false; // Unknown game, can't validate
  return score < limits.minScore || score > limits.maxScore;
}

// =============================================================================
// Achievements Catalog (server-side copy)
// =============================================================================

/** Games available in the system (server-side truth).
 *  Matches client GAME_METADATA availability. */
const AVAILABLE_GAMES = new Set([
  "bounce_blitz",
  "play_2048",
  "word_master",
  "brick_breaker",
  "minesweeper_classic",
  "lights_out",
  "pong_game",
  "chess",
  "checkers",
  "crazy_eights",
  "tic_tac_toe",
  "connect_four",
  "dot_match",
  "gomoku_master",
  "reversi_game",
  "crossword_puzzle",
]);

// Build catalog
function buildCatalog(): AchievementDef[] {
  const catalog: AchievementDef[] = [];

  // ── Global achievements ──────────────────────────────────────────
  catalog.push(
    {
      id: "achv.global.first_game",
      name: "First Steps",
      description: "Play your first game",
      icon: "🎮",
      category: "global",
      tier: "bronze",
      progressType: "count",
      target: 1,
      xpReward: 25,
      coinReward: 10,
      isEnabledByDefault: true,
      version: 1,
    },
    {
      id: "achv.global.ten_games",
      name: "Getting Started",
      description: "Play 10 games",
      icon: "🎯",
      category: "global",
      tier: "silver",
      progressType: "count",
      target: 10,
      xpReward: 50,
      coinReward: 25,
      isEnabledByDefault: true,
      version: 1,
    },
    {
      id: "achv.global.hundred_games",
      name: "Veteran Player",
      description: "Play 100 games",
      icon: "🏅",
      category: "global",
      tier: "gold",
      progressType: "count",
      target: 100,
      xpReward: 100,
      coinReward: 50,
      isEnabledByDefault: true,
      version: 1,
    },
    {
      id: "achv.global.first_win",
      name: "First Victory",
      description: "Win your first game",
      icon: "🏆",
      category: "global",
      tier: "bronze",
      progressType: "count",
      target: 1,
      xpReward: 25,
      coinReward: 10,
      isEnabledByDefault: true,
      version: 1,
    },
    {
      id: "achv.global.ten_wins",
      name: "Winner's Circle",
      description: "Win 10 games",
      icon: "🥇",
      category: "global",
      tier: "silver",
      progressType: "count",
      target: 10,
      xpReward: 50,
      coinReward: 25,
      isEnabledByDefault: true,
      version: 1,
    },
    {
      id: "achv.global.first_invite_sent",
      name: "Social Butterfly",
      description: "Send your first game invite",
      icon: "💌",
      category: "global",
      tier: "bronze",
      progressType: "count",
      target: 1,
      xpReward: 25,
      coinReward: 10,
      isEnabledByDefault: true,
      version: 1,
    },
    {
      id: "achv.global.first_invite_accepted",
      name: "Challenge Accepted",
      description: "Have an invite accepted",
      icon: "🤝",
      category: "global",
      tier: "silver",
      progressType: "count",
      target: 1,
      xpReward: 50,
      coinReward: 25,
      isEnabledByDefault: true,
      version: 1,
    },
    {
      id: "achv.global.spectator_first_watch",
      name: "Spectator",
      description: "Watch your first game as a spectator",
      icon: "👀",
      category: "global",
      tier: "bronze",
      progressType: "count",
      target: 1,
      xpReward: 25,
      coinReward: 10,
      isEnabledByDefault: true,
      version: 1,
    },
  );

  // ── Single-player achievements ────────────────────────────────────
  const spGames = [
    { gt: "bounce_blitz", icon: "⚪" },
    { gt: "brick_breaker", icon: "🧱" },
    { gt: "pong_game", icon: "🏓" },
    { gt: "play_2048", icon: "🔢" },
    { gt: "minesweeper_classic", icon: "💣" },
    { gt: "lights_out", icon: "💡" },
  ];
  const scoreTiers: Array<{
    suffix: string;
    pct: number;
    tier: AchievementV2Tier;
  }> = [
    { suffix: "bronze", pct: 0.25, tier: "bronze" },
    { suffix: "silver", pct: 0.5, tier: "silver" },
    { suffix: "gold", pct: 0.75, tier: "gold" },
    { suffix: "platinum", pct: 0.9, tier: "platinum" },
  ];

  for (const g of spGames) {
    catalog.push({
      id: `achv.game.${g.gt}.first_play`,
      name: `First ${g.gt}`,
      description: `Play ${g.gt} for the first time`,
      icon: g.icon,
      category: "single_player",
      tier: "bronze",
      gameType: g.gt,
      progressType: "count",
      target: 1,
      xpReward: 25,
      coinReward: 10,
      isEnabledByDefault: true,
      version: 1,
    });
    for (const st of scoreTiers) {
      catalog.push({
        id: `achv.game.${g.gt}.score_${st.suffix}`,
        name: `${g.gt} score ${st.suffix}`,
        description: `Reach ${Math.round(st.pct * 100)}% of max score in ${g.gt}`,
        icon: g.icon,
        category: "single_player",
        tier: st.tier,
        gameType: g.gt,
        progressType: "pct_of_max",
        target: 1,
        pctThreshold: st.pct,
        xpReward:
          st.tier === "bronze"
            ? 25
            : st.tier === "silver"
              ? 50
              : st.tier === "gold"
                ? 100
                : 250,
        coinReward:
          st.tier === "bronze"
            ? 10
            : st.tier === "silver"
              ? 25
              : st.tier === "gold"
                ? 50
                : 100,
        isEnabledByDefault: true,
        version: 1,
        group: `achv.game.${g.gt}.score`,
      });
    }
  }

  // Word Master specials
  catalog.push(
    {
      id: "achv.game.word_master.first_solve",
      name: "Word Solver",
      description: "Solve the daily word for the first time",
      icon: "📝",
      category: "single_player",
      tier: "bronze",
      gameType: "word_master",
      progressType: "count",
      target: 1,
      xpReward: 25,
      coinReward: 10,
      isEnabledByDefault: true,
      version: 1,
    },
    {
      id: "achv.game.word_master.streak_7",
      name: "Word Streak",
      description: "Solve the daily word 7 days in a row",
      icon: "🔥",
      category: "single_player",
      tier: "gold",
      gameType: "word_master",
      progressType: "streak",
      target: 7,
      xpReward: 100,
      coinReward: 50,
      isEnabledByDefault: true,
      version: 1,
    },
  );

  // ── Turn-based achievements ───────────────────────────────────────
  const tbGames = [
    "tic_tac_toe",
    "chess",
    "checkers",
    "crazy_eights",
    "connect_four",
    "gomoku_master",
    "reversi_game",
    "dot_match",
  ];
  for (const gt of tbGames) {
    catalog.push(
      {
        id: `achv.tb.${gt}.first_match`,
        name: `${gt} debut`,
        description: `Play first ${gt} match`,
        icon: "🎲",
        category: "turn_based",
        tier: "bronze",
        gameType: gt,
        progressType: "count",
        target: 1,
        xpReward: 25,
        coinReward: 10,
        isEnabledByDefault: true,
        version: 1,
      },
      {
        id: `achv.tb.${gt}.first_win`,
        name: `${gt} victor`,
        description: `Win first ${gt} match`,
        icon: "🏆",
        category: "turn_based",
        tier: "bronze",
        gameType: gt,
        progressType: "count",
        target: 1,
        xpReward: 25,
        coinReward: 10,
        isEnabledByDefault: true,
        version: 1,
      },
      {
        id: `achv.tb.${gt}.wins_10`,
        name: `${gt} expert`,
        description: `Win 10 ${gt} matches`,
        icon: "⭐",
        category: "turn_based",
        tier: "silver",
        gameType: gt,
        progressType: "count",
        target: 10,
        xpReward: 50,
        coinReward: 25,
        isEnabledByDefault: true,
        version: 1,
      },
      {
        id: `achv.tb.${gt}.matches_25`,
        name: `${gt} enthusiast`,
        description: `Play 25 ${gt} matches`,
        icon: "🎮",
        category: "turn_based",
        tier: "gold",
        gameType: gt,
        progressType: "count",
        target: 25,
        xpReward: 100,
        coinReward: 50,
        isEnabledByDefault: true,
        version: 1,
      },
    );
  }
  catalog.push({
    id: "achv.tb.rematch_accepted_5",
    name: "Rematch Warrior",
    description: "Complete 5 turn-based rematches",
    icon: "🔄",
    category: "turn_based",
    tier: "silver",
    progressType: "count",
    target: 5,
    xpReward: 50,
    coinReward: 25,
    isEnabledByDefault: true,
    version: 1,
  });

  // ── Real-time achievements ────────────────────────────────────────
  catalog.push(
    {
      id: "achv.rt.crossword_puzzle.first_complete",
      name: "Crossword Beginner",
      description: "Complete first crossword",
      icon: "📰",
      category: "real_time",
      tier: "bronze",
      gameType: "crossword_puzzle",
      progressType: "count",
      target: 1,
      xpReward: 25,
      coinReward: 10,
      isEnabledByDefault: true,
      version: 1,
    },
    {
      id: "achv.rt.crossword_puzzle.streak_7",
      name: "Crossword Streak",
      description: "Complete 7 crosswords in a row",
      icon: "🔥",
      category: "real_time",
      tier: "gold",
      gameType: "crossword_puzzle",
      progressType: "streak",
      target: 7,
      xpReward: 100,
      coinReward: 50,
      isEnabledByDefault: true,
      version: 1,
    },
  );

  return catalog;
}

const SERVER_CATALOG = buildCatalog();
const SERVER_CATALOG_BY_ID = new Map(SERVER_CATALOG.map((d) => [d.id, d]));

function getActiveServerAchievements(): AchievementDef[] {
  return SERVER_CATALOG.filter((def) => {
    if (!def.isEnabledByDefault) return false;
    if (def.gameType && !AVAILABLE_GAMES.has(def.gameType)) return false;
    return true;
  });
}

// =============================================================================
// Core Evaluator
// =============================================================================

interface EvalContext {
  /** Overall stats from PlayerGameStats */
  totalGamesPlayed: number;
  totalWins: number;
  /** Per-game stats keyed by gameType */
  perGame: Record<string, PerGameStats>;
  /** Social counters */
  social: SocialGameStats;
  /** Existing v2 achievement docs (keyed by achievementId) */
  existing: Map<string, UserAchievementDoc>;
}

/**
 * Compute the current progress value for a single achievement
 * given the evaluation context.
 */
function computeProgress(def: AchievementDef, ctx: EvalContext): number {
  switch (def.id) {
    // ── Global count achievements ──
    case "achv.global.first_game":
    case "achv.global.ten_games":
    case "achv.global.hundred_games":
      return ctx.totalGamesPlayed;

    case "achv.global.first_win":
    case "achv.global.ten_wins":
      return ctx.totalWins;

    // ── Social achievements ──
    case "achv.global.first_invite_sent":
      return ctx.social.invitesSent;
    case "achv.global.first_invite_accepted":
      return ctx.social.invitesAcceptedByOthers;
    case "achv.global.spectator_first_watch":
      return ctx.social.gamesWatched;

    // ── Turn-based rematch ──
    case "achv.tb.rematch_accepted_5":
      return ctx.social.turnBasedRematchesCompleted;

    default:
      break;
  }

  // ── Per-game achievements ──
  if (def.gameType) {
    const stats = ctx.perGame[def.gameType];
    if (!stats) return 0;

    // Single-player first play
    if (def.id.endsWith(".first_play") || def.id.endsWith(".first_solve")) {
      return stats.played > 0 ? 1 : 0;
    }

    // Single-player score tiers (pct_of_max)
    if (def.progressType === "pct_of_max" && def.pctThreshold !== undefined) {
      const limits = SCORE_LIMITS[def.gameType];
      if (!limits) return 0;
      if (isScoreSuspicious(stats.highScore, def.gameType)) return 0;

      const threshold = Math.floor(limits.maxScore * def.pctThreshold);
      if (limits.scoreDirection === "higher") {
        return stats.highScore >= threshold ? 1 : 0;
      } else {
        // Lower is better: score <= threshold means achievement
        // But only if user has actually played (highScore > 0)
        return stats.highScore > 0 && stats.highScore <= threshold ? 1 : 0;
      }
    }

    // Streak achievements
    if (def.progressType === "streak") {
      return stats.bestStreak;
    }

    // Turn-based first match
    if (def.id.endsWith(".first_match")) {
      return stats.matches > 0 ? stats.matches : stats.played;
    }

    // Turn-based first win
    if (def.id.endsWith(".first_win")) {
      return stats.wins;
    }

    // Turn-based wins_10
    if (def.id.endsWith(".wins_10")) {
      return stats.wins;
    }

    // Turn-based matches_25
    if (def.id.endsWith(".matches_25")) {
      return stats.matches > 0 ? stats.matches : stats.played;
    }

    // Real-time first complete
    if (def.id.endsWith(".first_complete")) {
      return stats.completed > 0 ? stats.completed : stats.solved;
    }
  }

  return 0;
}

/**
 * Evaluate a single achievement against context.
 * Returns the eval result. Never reduces progress or revokes unlocks.
 */
function evaluateOne(
  def: AchievementDef,
  ctx: EvalContext,
): AchievementEvalResult {
  const now = Date.now();
  const existing = ctx.existing.get(def.id);
  const previousState: AchievementState = existing?.state ?? "locked";

  // If already unlocked, don't re-evaluate
  if (previousState === "unlocked") {
    return {
      achievementId: def.id,
      previousState: "unlocked",
      newState: "unlocked",
      progress: existing!.progress,
      target: def.target,
      justUnlocked: false,
    };
  }

  const rawProgress = computeProgress(def, ctx);
  // Never reduce progress (idempotency)
  const progress = Math.max(rawProgress, existing?.progress ?? 0);

  let newState: AchievementState;
  if (progress >= def.target) {
    newState = "unlocked";
  } else if (progress > 0) {
    newState = "progress";
  } else {
    newState = "locked";
  }

  return {
    achievementId: def.id,
    previousState,
    newState,
    progress,
    target: def.target,
    justUnlocked: newState === "unlocked",
  };
}

// =============================================================================
// Firestore Reader Helpers
// =============================================================================

async function readPlayerGameStats(userId: string): Promise<{
  totalGamesPlayed: number;
  totalWins: number;
  perGame: Record<string, any>;
}> {
  const docRef = db.collection("PlayerGameStats").doc(userId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return { totalGamesPlayed: 0, totalWins: 0, perGame: {} };
  }
  const data = snap.data()!;
  return {
    totalGamesPlayed: data.overall?.totalGamesPlayed ?? 0,
    totalWins: data.overall?.totalWins ?? 0,
    perGame: data.gameStats ?? {},
  };
}

async function readPerGameStats(
  userId: string,
): Promise<Record<string, PerGameStats>> {
  // First try the new v2 subcollection path
  const v2Ref = db.collection("users").doc(userId).collection("statsPerGame");
  const v2Snap = await v2Ref.get();

  if (!v2Snap.empty) {
    const result: Record<string, PerGameStats> = {};
    v2Snap.forEach((doc) => {
      result[doc.id] = doc.data() as PerGameStats;
    });
    return result;
  }

  // Fall back to PlayerGameStats.gameStats and convert
  const pgStats = await readPlayerGameStats(userId);
  const result: Record<string, PerGameStats> = {};
  const now = Date.now();

  for (const [gameType, stats] of Object.entries(pgStats.perGame)) {
    const s = stats as any;
    result[gameType] = {
      gameType,
      played: s.gamesPlayed ?? 0,
      wins: s.wins ?? 0,
      completed: s.gamesCompleted ?? 0,
      solved: 0,
      streak: s.winStreak ?? 0,
      bestStreak: s.bestWinStreak ?? 0,
      highScore: s.highScore ?? 0,
      matches: s.gamesPlayed ?? 0,
      lastPlayedAt: s.lastPlayedAt?.toMillis?.() ?? now,
      firstPlayedAt: s.firstPlayedAt?.toMillis?.() ?? now,
      updatedAt: now,
    };
  }

  return result;
}

async function readSocialGameStats(userId: string): Promise<SocialGameStats> {
  const docRef = db
    .collection("users")
    .doc(userId)
    .collection("socialGameStats")
    .doc("counters");
  const snap = await docRef.get();
  if (!snap.exists) {
    return {
      invitesSent: 0,
      invitesAcceptedByOthers: 0,
      gamesWatched: 0,
      turnBasedRematchesCompleted: 0,
      updatedAt: 0,
    };
  }
  return snap.data() as SocialGameStats;
}

async function readExistingV2Achievements(
  userId: string,
): Promise<Map<string, UserAchievementDoc>> {
  const ref = db.collection("users").doc(userId).collection("achievements");
  const snap = await ref.get();
  const result = new Map<string, UserAchievementDoc>();
  snap.forEach((doc) => {
    result.set(doc.id, doc.data() as UserAchievementDoc);
  });
  return result;
}

// =============================================================================
// Main Evaluator Entry Point
// =============================================================================

/**
 * Run the achievements v2 evaluator for a single user.
 *
 * This function:
 * 1. Reads all relevant stats
 * 2. Evaluates all active achievements
 * 3. Writes/updates v2 achievement docs
 * 4. Updates achievement summary
 * 5. Syncs legacy PlayerAchievements and Users/{uid}/Achievements if needed
 *
 * Designed to be called from processGameCompletion or a dedicated trigger.
 */
export async function evaluateAchievementsV2(
  userId: string,
): Promise<EvaluationResult> {
  const timestamp = Date.now();
  const result: EvaluationResult = {
    userId,
    evaluated: 0,
    newUnlocks: [],
    errors: [],
    legacySynced: false,
    timestamp,
  };

  try {
    // 1. Read all context in parallel
    const [playerStats, perGame, social, existing] = await Promise.all([
      readPlayerGameStats(userId),
      readPerGameStats(userId),
      readSocialGameStats(userId),
      readExistingV2Achievements(userId),
    ]);

    const ctx: EvalContext = {
      totalGamesPlayed: playerStats.totalGamesPlayed,
      totalWins: playerStats.totalWins,
      perGame,
      social,
      existing,
    };

    // 2. Evaluate all active achievements
    const activeAchievements = getActiveServerAchievements();
    const evalResults: AchievementEvalResult[] = [];

    for (const def of activeAchievements) {
      try {
        const evalResult = evaluateOne(def, ctx);
        evalResults.push(evalResult);
        result.evaluated++;
      } catch (err) {
        result.errors.push({
          achievementId: def.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 3. Write updates (only for achievements that changed)
    const batch = db.batch();
    let batchCount = 0;
    const now = Date.now();

    for (const evalResult of evalResults) {
      const existingDoc = existing.get(evalResult.achievementId);

      // Skip if nothing changed
      if (existingDoc) {
        if (
          existingDoc.state === evalResult.newState &&
          existingDoc.progress === evalResult.progress
        ) {
          continue;
        }
      } else if (
        evalResult.newState === "locked" &&
        evalResult.progress === 0
      ) {
        // Don't create docs for achievements with zero progress
        continue;
      }

      const docRef = db
        .collection("users")
        .doc(userId)
        .collection("achievements")
        .doc(evalResult.achievementId);

      const doc: UserAchievementDoc = {
        achievementId: evalResult.achievementId,
        state: evalResult.newState,
        progress: evalResult.progress,
        target: evalResult.target,
        unlockedAt: evalResult.justUnlocked
          ? now
          : (existingDoc?.unlockedAt ?? null),
        version:
          SERVER_CATALOG_BY_ID.get(evalResult.achievementId)?.version ?? 1,
        source: "server",
        updatedAt: now,
        createdAt: existingDoc?.createdAt ?? now,
      };

      batch.set(docRef, doc, { merge: true });
      batchCount++;

      if (evalResult.justUnlocked) {
        result.newUnlocks.push(evalResult);
      }
    }

    // 4. Update achievement summary
    const allUnlockedIds: string[] = [];
    const unlockedByTier: Record<AchievementV2Tier, number> = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      diamond: 0,
    };
    let totalXpEarned = 0;
    let totalCoinsEarned = 0;

    for (const evalResult of evalResults) {
      if (evalResult.newState === "unlocked") {
        allUnlockedIds.push(evalResult.achievementId);
        const def = SERVER_CATALOG_BY_ID.get(evalResult.achievementId);
        if (def) {
          unlockedByTier[def.tier]++;
          totalXpEarned += def.xpReward;
          totalCoinsEarned += def.coinReward;
        }
      }
    }

    // Also include existing unlocked achievements not in active catalog
    for (const [id, doc] of existing) {
      if (doc.state === "unlocked" && !allUnlockedIds.includes(id)) {
        allUnlockedIds.push(id);
        const def = SERVER_CATALOG_BY_ID.get(id);
        if (def) {
          unlockedByTier[def.tier]++;
          totalXpEarned += def.xpReward;
          totalCoinsEarned += def.coinReward;
        }
      }
    }

    const summaryRef = db
      .collection("users")
      .doc(userId)
      .collection("achievementSummary")
      .doc("summary");

    const summary: AchievementSummaryDoc = {
      totalUnlocked: allUnlockedIds.length,
      totalAvailable: activeAchievements.length,
      unlockedByTier,
      totalXpEarned,
      totalCoinsEarned,
      unlockedIds: allUnlockedIds.sort(),
      lastEvaluatedAt: now,
      updatedAt: now,
    };

    batch.set(summaryRef, summary, { merge: true });
    batchCount++;

    // 5. Legacy sync — write unlocked IDs to PlayerAchievements
    if (allUnlockedIds.length > 0) {
      await syncLegacyAchievements(userId, allUnlockedIds);
      result.legacySynced = true;
    }

    // Commit batch
    if (batchCount > 0) {
      await batch.commit();
    }

    functions.logger.info("[AchievementsV2] Evaluation complete", {
      userId,
      evaluated: result.evaluated,
      newUnlocks: result.newUnlocks.length,
      totalUnlocked: allUnlockedIds.length,
      errors: result.errors.length,
    });
  } catch (err) {
    functions.logger.error("[AchievementsV2] Evaluation failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  return result;
}

// =============================================================================
// Legacy Sync
// =============================================================================

/**
 * Sync unlocked v2 achievement IDs into the legacy PlayerAchievements doc
 * and Users/{uid}/Achievements subcollection.
 *
 * This ensures old UI/logic that reads from these paths continues to work.
 */
async function syncLegacyAchievements(
  userId: string,
  unlockedIds: string[],
): Promise<void> {
  try {
    // Update PlayerAchievements doc progress map
    const paRef = db.collection("PlayerAchievements").doc(userId);
    const paSnap = await paRef.get();

    const progress: Record<string, any> = paSnap.exists
      ? (paSnap.data()?.progress ?? {})
      : {};

    const now = Timestamp.now();
    let newUnlockCount = 0;

    for (const id of unlockedIds) {
      if (!progress[id] || !progress[id].unlocked) {
        progress[id] = {
          achievementId: id,
          currentValue: 1,
          threshold: 1,
          percentComplete: 100,
          unlocked: true,
          unlockedAt: now,
          rewardsClaimed: false,
          createdAt: progress[id]?.createdAt ?? now,
          updatedAt: now,
        };
        newUnlockCount++;
      }
    }

    if (newUnlockCount > 0) {
      const totalUnlocked = Object.values(progress).filter(
        (p: any) => p.unlocked,
      ).length;

      await paRef.set(
        {
          playerId: userId,
          progress,
          totalUnlocked,
          updatedAt: now,
        },
        { merge: true },
      );
    }
  } catch (err) {
    // Non-critical — log but don't fail
    functions.logger.warn("[AchievementsV2] Legacy sync failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// =============================================================================
// Migration Helper
// =============================================================================

/**
 * Migrate existing legacy achievements to v2 docs.
 * Creates v2 unlocked docs for achievement IDs found in
 * PlayerAchievements/{playerId} with source="migration".
 */
export async function migrateExistingAchievements(
  userId: string,
): Promise<number> {
  const paRef = db.collection("PlayerAchievements").doc(userId);
  const paSnap = await paRef.get();

  if (!paSnap.exists) return 0;

  const progress = paSnap.data()?.progress ?? {};
  const now = Date.now();
  const batch = db.batch();
  let migrated = 0;

  for (const [id, p] of Object.entries(progress)) {
    const prog = p as any;
    if (!prog.unlocked) continue;

    // Check if v2 doc already exists
    const v2Ref = db
      .collection("users")
      .doc(userId)
      .collection("achievements")
      .doc(id);
    const v2Snap = await v2Ref.get();
    if (v2Snap.exists) continue;

    const doc: UserAchievementDoc = {
      achievementId: id,
      state: "unlocked",
      progress: prog.currentValue ?? 1,
      target: prog.threshold ?? 1,
      unlockedAt: prog.unlockedAt?.toMillis?.() ?? now,
      version: 1,
      source: "migration",
      updatedAt: now,
      createdAt: now,
    };

    batch.set(v2Ref, doc);
    migrated++;
  }

  if (migrated > 0) {
    await batch.commit();
  }

  functions.logger.info("[AchievementsV2] Migration complete", {
    userId,
    migrated,
  });

  return migrated;
}

// =============================================================================
// Per-Game Stats Writer (called from game completion)
// =============================================================================

/**
 * Update the v2 per-game stats subcollection.
 * Called from processGameCompletion alongside existing updatePlayerStats.
 */
export async function updatePerGameStatsV2(
  userId: string,
  gameType: string,
  outcome: "win" | "loss" | "draw" | "completed" | "solved",
  score?: number,
): Promise<void> {
  const docRef = db
    .collection("users")
    .doc(userId)
    .collection("statsPerGame")
    .doc(gameType);

  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    let stats: PerGameStats;

    if (snap.exists) {
      stats = snap.data() as PerGameStats;
    } else {
      stats = {
        gameType,
        played: 0,
        wins: 0,
        completed: 0,
        solved: 0,
        streak: 0,
        bestStreak: 0,
        highScore: 0,
        matches: 0,
        lastPlayedAt: now,
        firstPlayedAt: now,
        updatedAt: now,
      };
    }

    stats.played++;
    stats.lastPlayedAt = now;
    stats.updatedAt = now;

    switch (outcome) {
      case "win":
        stats.wins++;
        stats.matches++;
        stats.streak++;
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
        break;
      case "loss":
        stats.matches++;
        stats.streak = 0;
        break;
      case "draw":
        stats.matches++;
        stats.streak = 0;
        break;
      case "completed":
        stats.completed++;
        stats.streak++;
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
        break;
      case "solved":
        stats.solved++;
        stats.streak++;
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
        break;
    }

    if (score !== undefined) {
      const limits = SCORE_LIMITS[gameType];
      if (limits && !isScoreSuspicious(score, gameType)) {
        if (limits.scoreDirection === "higher") {
          stats.highScore = Math.max(stats.highScore, score);
        } else {
          // Lower is better — only update if it's a better (lower) score
          // or if no score recorded yet
          if (stats.highScore === 0 || score < stats.highScore) {
            stats.highScore = score;
          }
        }
      }
    }

    transaction.set(docRef, stats);
  });
}
