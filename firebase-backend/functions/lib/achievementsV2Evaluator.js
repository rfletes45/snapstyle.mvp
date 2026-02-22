"use strict";
/**
 * Achievements V2 — Server-Side Evaluator
 *
 * Deterministic achievement evaluation engine for Cloud Functions.
 * Reads trusted stats, computes achievement progress, writes
 * canonical v2 achievement docs, and grants rewards atomically.
 *
 * v2 Changes:
 * - stat_threshold progress type for game-specific stat milestones
 * - gameSpecific field on PerGameStats for per-game metrics
 * - Reward granting: tokens → Wallets/{uid}, entitlements → Entitlements/{id}
 * - Secret achievement support
 * - processSinglePlayerCompletion callable for SP games
 *
 * Firestore paths written:
 *   /users/{uid}/achievements/{achievementId}
 *   /users/{uid}/achievementSummary
 *   /Wallets/{uid}                          (token rewards)
 *   /Users/{uid}/Entitlements/{cosmeticId}  (cosmetic rewards)
 *   /Users/{uid}/Transactions/{txnId}       (reward audit log)
 *
 * @module achievementsV2Evaluator
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
exports.processSinglePlayerCompletion = void 0;
exports.evaluateAchievementsV2 = evaluateAchievementsV2;
exports.migrateExistingAchievements = migrateExistingAchievements;
exports.updatePerGameStatsV2 = updatePerGameStatsV2;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const SCORE_LIMITS = {
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
function isScoreSuspicious(score, gameType) {
    const limits = SCORE_LIMITS[gameType];
    if (!limits)
        return false;
    return score < limits.minScore || score > limits.maxScore;
}
// =============================================================================
// Achievements Catalog (server-side v2)
// =============================================================================
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
    "sketch_party_game",
    "minigolf_duels",
]);
function buildCatalog() {
    const catalog = [];
    // ── Global achievements ──────────────────────────────────────────
    catalog.push({
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
        rewards: { tokens: 10 },
        isEnabledByDefault: true,
        version: 2,
    }, {
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
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
    }, {
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
        rewards: { tokens: 75 },
        isEnabledByDefault: true,
        version: 2,
    }, {
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
        rewards: { tokens: 10 },
        isEnabledByDefault: true,
        version: 2,
    }, {
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
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
    }, {
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
        version: 2,
    }, {
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
        version: 2,
    }, {
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
        version: 2,
    });
    // ── 2048 Achievements — tile milestones ───────────────────────────
    catalog.push({
        id: "achv.game.play_2048.first_play",
        name: "Number Cruncher",
        description: "Play 2048 for the first time",
        icon: "🔢",
        category: "single_player",
        tier: "bronze",
        gameType: "play_2048",
        progressType: "count",
        target: 1,
        xpReward: 25,
        coinReward: 10,
        rewards: { tokens: 10 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.game.play_2048.tile_256",
        name: "Getting Warmer",
        description: "Reach the 256 tile",
        icon: "🔢",
        category: "single_player",
        tier: "bronze",
        gameType: "play_2048",
        progressType: "stat_threshold",
        statKey: "maxTile",
        target: 256,
        xpReward: 25,
        coinReward: 15,
        rewards: { tokens: 15 },
        isEnabledByDefault: true,
        version: 2,
        group: "achv.game.play_2048.tiles",
    }, {
        id: "achv.game.play_2048.tile_512",
        name: "Halfway There",
        description: "Reach the 512 tile",
        icon: "🔢",
        category: "single_player",
        tier: "silver",
        gameType: "play_2048",
        progressType: "stat_threshold",
        statKey: "maxTile",
        target: 512,
        xpReward: 50,
        coinReward: 25,
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
        group: "achv.game.play_2048.tiles",
    }, {
        id: "achv.game.play_2048.tile_1024",
        name: "Power of Two",
        description: "Reach the 1024 tile",
        icon: "🔢",
        category: "single_player",
        tier: "gold",
        gameType: "play_2048",
        progressType: "stat_threshold",
        statKey: "maxTile",
        target: 1024,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 50, entitlements: ["badge_2048_gold"] },
        isEnabledByDefault: true,
        version: 2,
        group: "achv.game.play_2048.tiles",
    }, {
        id: "achv.game.play_2048.tile_2048",
        name: "2048 Champion",
        description: "Reach the legendary 2048 tile",
        icon: "🔢",
        category: "single_player",
        tier: "platinum",
        gameType: "play_2048",
        progressType: "stat_threshold",
        statKey: "maxTile",
        target: 2048,
        xpReward: 250,
        coinReward: 100,
        rewards: { tokens: 150, entitlements: ["badge_2048_master"] },
        isEnabledByDefault: true,
        version: 2,
        group: "achv.game.play_2048.tiles",
    }, {
        id: "achv.game.play_2048.tile_4096",
        name: "Beyond Infinity",
        description: "???",
        icon: "✨",
        category: "single_player",
        tier: "diamond",
        gameType: "play_2048",
        progressType: "stat_threshold",
        statKey: "maxTile",
        target: 4096,
        xpReward: 500,
        coinReward: 250,
        rewards: { tokens: 300, entitlements: ["badge_2048_legend"] },
        secret: true,
        isEnabledByDefault: true,
        version: 2,
        group: "achv.game.play_2048.tiles",
    }, {
        id: "achv.game.play_2048.games_10",
        name: "2048 Regular",
        description: "Play 10 games of 2048",
        icon: "🔢",
        category: "single_player",
        tier: "silver",
        gameType: "play_2048",
        progressType: "count",
        target: 10,
        xpReward: 50,
        coinReward: 25,
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.game.play_2048.under_500_moves",
        name: "Efficient Slider",
        description: "Reach 2048 in under 500 moves",
        icon: "⚡",
        category: "single_player",
        tier: "platinum",
        gameType: "play_2048",
        progressType: "stat_threshold",
        statKey: "bestWinMoveCount",
        target: 1,
        xpReward: 250,
        coinReward: 100,
        rewards: { tokens: 100 },
        secret: true,
        isEnabledByDefault: true,
        version: 2,
    });
    // ── Brick Breaker — level milestones ──────────────────────────────
    catalog.push({
        id: "achv.game.brick_breaker.first_play",
        name: "Brick Layer",
        description: "Play Brick Breaker for the first time",
        icon: "🧱",
        category: "single_player",
        tier: "bronze",
        gameType: "brick_breaker",
        progressType: "count",
        target: 1,
        xpReward: 25,
        coinReward: 10,
        rewards: { tokens: 10 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.game.brick_breaker.level_5",
        name: "Breaking Through",
        description: "Reach level 5",
        icon: "🧱",
        category: "single_player",
        tier: "bronze",
        gameType: "brick_breaker",
        progressType: "stat_threshold",
        statKey: "highestLevel",
        target: 5,
        xpReward: 25,
        coinReward: 15,
        rewards: { tokens: 15 },
        isEnabledByDefault: true,
        version: 2,
        group: "achv.game.brick_breaker.levels",
    }, {
        id: "achv.game.brick_breaker.level_10",
        name: "Demolition Expert",
        description: "Reach level 10",
        icon: "🧱",
        category: "single_player",
        tier: "silver",
        gameType: "brick_breaker",
        progressType: "stat_threshold",
        statKey: "highestLevel",
        target: 10,
        xpReward: 50,
        coinReward: 25,
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
        group: "achv.game.brick_breaker.levels",
    }, {
        id: "achv.game.brick_breaker.level_20",
        name: "Wrecking Ball",
        description: "Reach level 20",
        icon: "🧱",
        category: "single_player",
        tier: "gold",
        gameType: "brick_breaker",
        progressType: "stat_threshold",
        statKey: "highestLevel",
        target: 20,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 50, entitlements: ["badge_breaker_gold"] },
        isEnabledByDefault: true,
        version: 2,
        group: "achv.game.brick_breaker.levels",
    }, {
        id: "achv.game.brick_breaker.level_30",
        name: "Brick Breaker Master",
        description: "Reach level 30",
        icon: "🧱",
        category: "single_player",
        tier: "platinum",
        gameType: "brick_breaker",
        progressType: "stat_threshold",
        statKey: "highestLevel",
        target: 30,
        xpReward: 250,
        coinReward: 100,
        rewards: { tokens: 150, entitlements: ["badge_breaker_master"] },
        isEnabledByDefault: true,
        version: 2,
        group: "achv.game.brick_breaker.levels",
    }, {
        id: "achv.game.brick_breaker.perfect_level",
        name: "Not a Scratch",
        description: "???",
        icon: "💎",
        category: "single_player",
        tier: "diamond",
        gameType: "brick_breaker",
        progressType: "stat_threshold",
        statKey: "perfectLevels",
        target: 1,
        xpReward: 500,
        coinReward: 250,
        rewards: { tokens: 300, entitlements: ["badge_breaker_perfect"] },
        secret: true,
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.game.brick_breaker.games_10",
        name: "Brick Enthusiast",
        description: "Play 10 games of Brick Breaker",
        icon: "🧱",
        category: "single_player",
        tier: "silver",
        gameType: "brick_breaker",
        progressType: "count",
        target: 10,
        xpReward: 50,
        coinReward: 25,
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.game.brick_breaker.score_50000",
        name: "High Scorer",
        description: "Score 50,000 points in a single game",
        icon: "🧱",
        category: "single_player",
        tier: "gold",
        gameType: "brick_breaker",
        progressType: "stat_threshold",
        statKey: "bestScore",
        target: 50000,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 50 },
        isEnabledByDefault: true,
        version: 2,
    });
    // ── Other single-player (pct_of_max games) ────────────────────────
    const otherSpGames = [
        { gt: "bounce_blitz", icon: "⚪" },
        { gt: "pong_game", icon: "🏓" },
        { gt: "minesweeper_classic", icon: "💣" },
        { gt: "lights_out", icon: "💡" },
    ];
    const scoreTiers = [
        { suffix: "bronze", pct: 0.25, tier: "bronze", tokenReward: 10 },
        { suffix: "silver", pct: 0.5, tier: "silver", tokenReward: 25 },
        { suffix: "gold", pct: 0.75, tier: "gold", tokenReward: 50 },
        { suffix: "platinum", pct: 0.9, tier: "platinum", tokenReward: 100 },
    ];
    for (const g of otherSpGames) {
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
            rewards: { tokens: 10 },
            isEnabledByDefault: true,
            version: 2,
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
                xpReward: st.tier === "bronze"
                    ? 25
                    : st.tier === "silver"
                        ? 50
                        : st.tier === "gold"
                            ? 100
                            : 250,
                coinReward: st.tier === "bronze"
                    ? 10
                    : st.tier === "silver"
                        ? 25
                        : st.tier === "gold"
                            ? 50
                            : 100,
                rewards: { tokens: st.tokenReward },
                isEnabledByDefault: true,
                version: 2,
                group: `achv.game.${g.gt}.score`,
            });
        }
    }
    // Word Master specials
    catalog.push({
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
        rewards: { tokens: 10 },
        isEnabledByDefault: true,
        version: 2,
    }, {
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
        rewards: { tokens: 50 },
        isEnabledByDefault: true,
        version: 2,
    });
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
        catalog.push({
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
            rewards: { tokens: 10 },
            isEnabledByDefault: true,
            version: 2,
        }, {
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
            rewards: { tokens: 10 },
            isEnabledByDefault: true,
            version: 2,
        }, {
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
            rewards: { tokens: 25 },
            isEnabledByDefault: true,
            version: 2,
        }, {
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
            rewards: { tokens: 50 },
            isEnabledByDefault: true,
            version: 2,
        });
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
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
    });
    // ── Real-time achievements ────────────────────────────────────────
    catalog.push({
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
        rewards: { tokens: 10 },
        isEnabledByDefault: true,
        version: 2,
    }, {
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
        rewards: { tokens: 50 },
        isEnabledByDefault: true,
        version: 2,
    });
    // ── Bounce Blitz stat-based achievements ──────────────────────────
    catalog.push({
        id: "achv.game.bounce_blitz.level_10",
        name: "Rising Bouncer",
        description: "Reach level 10 in Bounce Blitz",
        icon: "⚪",
        category: "single_player",
        tier: "silver",
        gameType: "bounce_blitz",
        progressType: "stat_threshold",
        statKey: "highestLevel",
        target: 10,
        xpReward: 50,
        coinReward: 25,
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
        group: "achv.game.bounce_blitz.levels",
    }, {
        id: "achv.game.bounce_blitz.level_25",
        name: "Bounce Master",
        description: "Reach level 25 in Bounce Blitz",
        icon: "⚪",
        category: "single_player",
        tier: "gold",
        gameType: "bounce_blitz",
        progressType: "stat_threshold",
        statKey: "highestLevel",
        target: 25,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 50, entitlements: ["badge_bounce_gold"] },
        isEnabledByDefault: true,
        version: 2,
        group: "achv.game.bounce_blitz.levels",
    }, {
        id: "achv.game.bounce_blitz.blocks_500",
        name: "Block Buster",
        description: "Destroy 500 blocks total",
        icon: "💥",
        category: "single_player",
        tier: "gold",
        gameType: "bounce_blitz",
        progressType: "stat_threshold",
        statKey: "totalBlocksDestroyed",
        target: 500,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 50 },
        isEnabledByDefault: true,
        version: 2,
    });
    // ── Word Master stat-based achievements ───────────────────────────
    catalog.push({
        id: "achv.game.word_master.no_hints",
        name: "No Peeking",
        description: "???",
        icon: "🧠",
        category: "single_player",
        tier: "gold",
        gameType: "word_master",
        progressType: "stat_threshold",
        statKey: "bestAttempts",
        target: 1,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 50 },
        secret: true,
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.game.word_master.streak_30",
        name: "Monthly Wordsmiths",
        description: "Solve the daily word 30 days in a row",
        icon: "🔥",
        category: "single_player",
        tier: "platinum",
        gameType: "word_master",
        progressType: "stat_threshold",
        statKey: "streakDay",
        target: 30,
        xpReward: 250,
        coinReward: 100,
        rewards: { tokens: 150, entitlements: ["badge_wordsmith_platinum"] },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.game.word_master.games_50",
        name: "Word Enthusiast",
        description: "Play 50 games of Word Master",
        icon: "📝",
        category: "single_player",
        tier: "gold",
        gameType: "word_master",
        progressType: "count",
        target: 50,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 50 },
        isEnabledByDefault: true,
        version: 2,
    });
    // ── Crossword Puzzle additional achievements ──────────────────────
    catalog.push({
        id: "achv.rt.crossword_puzzle.puzzles_10",
        name: "Puzzle Collector",
        description: "Complete 10 crossword puzzles",
        icon: "📰",
        category: "real_time",
        tier: "silver",
        gameType: "crossword_puzzle",
        progressType: "count",
        target: 10,
        xpReward: 50,
        coinReward: 25,
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.crossword_puzzle.puzzles_50",
        name: "Crossword Master",
        description: "Complete 50 crossword puzzles",
        icon: "📰",
        category: "real_time",
        tier: "gold",
        gameType: "crossword_puzzle",
        progressType: "count",
        target: 50,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 75, entitlements: ["badge_crossword_master"] },
        isEnabledByDefault: true,
        version: 2,
    });
    // ── Turn-based win streak + extra milestones ──────────────────────
    for (const gt of tbGames) {
        catalog.push({
            id: `achv.tb.${gt}.win_streak_5`,
            name: `${gt} hot streak`,
            description: `Win 5 ${gt} matches in a row`,
            icon: "🔥",
            category: "turn_based",
            tier: "gold",
            gameType: gt,
            progressType: "streak",
            target: 5,
            xpReward: 100,
            coinReward: 50,
            rewards: { tokens: 50 },
            isEnabledByDefault: true,
            version: 2,
        }, {
            id: `achv.tb.${gt}.wins_50`,
            name: `${gt} champion`,
            description: `Win 50 ${gt} matches`,
            icon: "👑",
            category: "turn_based",
            tier: "platinum",
            gameType: gt,
            progressType: "count",
            target: 50,
            xpReward: 250,
            coinReward: 100,
            rewards: { tokens: 150 },
            isEnabledByDefault: true,
            version: 2,
        });
    }
    // ── Sketch Party achievements ─────────────────────────────────────
    catalog.push({
        id: "achv.rt.sketch_party_game.first_match",
        name: "Party Starter",
        description: "Play your first Sketch Party game",
        icon: "🎨",
        category: "real_time",
        tier: "bronze",
        gameType: "sketch_party_game",
        progressType: "count",
        target: 1,
        xpReward: 25,
        coinReward: 10,
        rewards: { tokens: 10 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.sketch_party_game.first_win",
        name: "Artistic Triumph",
        description: "Win a Sketch Party game",
        icon: "🏆",
        category: "real_time",
        tier: "bronze",
        gameType: "sketch_party_game",
        progressType: "count",
        target: 1,
        xpReward: 25,
        coinReward: 10,
        rewards: { tokens: 10 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.sketch_party_game.wins_10",
        name: "Sketch Prodigy",
        description: "Win 10 Sketch Party games",
        icon: "🎨",
        category: "real_time",
        tier: "silver",
        gameType: "sketch_party_game",
        progressType: "count",
        target: 10,
        xpReward: 50,
        coinReward: 25,
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.sketch_party_game.matches_25",
        name: "Sketch Veteran",
        description: "Play 25 Sketch Party games",
        icon: "🎨",
        category: "real_time",
        tier: "gold",
        gameType: "sketch_party_game",
        progressType: "count",
        target: 25,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 50 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.sketch_party_game.correct_100",
        name: "Sharp Eye",
        description: "Guess 100 words correctly across all games",
        icon: "👁️",
        category: "real_time",
        tier: "gold",
        gameType: "sketch_party_game",
        progressType: "stat_threshold",
        statKey: "correctGuesses",
        target: 100,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 75, entitlements: ["badge_sketch_guesser"] },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.sketch_party_game.perfect_drawer_5",
        name: "Picasso",
        description: "Have everyone guess your drawing 5 times",
        icon: "🖌️",
        category: "real_time",
        tier: "gold",
        gameType: "sketch_party_game",
        progressType: "stat_threshold",
        statKey: "perfectDrawerTurns",
        target: 5,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 75, entitlements: ["badge_sketch_artist"] },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.sketch_party_game.first_guess_10",
        name: "Speed Guesser",
        description: "Be the first to guess the word 10 times",
        icon: "⚡",
        category: "real_time",
        tier: "silver",
        gameType: "sketch_party_game",
        progressType: "stat_threshold",
        statKey: "firstGuessCount",
        target: 10,
        xpReward: 50,
        coinReward: 25,
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.sketch_party_game.score_5000",
        name: "Sketch Legend",
        description: "???",
        icon: "✨",
        category: "real_time",
        tier: "platinum",
        gameType: "sketch_party_game",
        progressType: "stat_threshold",
        statKey: "bestScore",
        target: 5000,
        xpReward: 250,
        coinReward: 100,
        rewards: { tokens: 150, entitlements: ["badge_sketch_legend"] },
        secret: true,
        isEnabledByDefault: true,
        version: 2,
    });
    // ── Mini-Golf Duels achievements ──────────────────────────────────
    catalog.push({
        id: "achv.rt.minigolf_duels.first_match",
        name: "Tee Time",
        description: "Play your first Mini-Golf Duels match",
        icon: "⛳",
        category: "real_time",
        tier: "bronze",
        gameType: "minigolf_duels",
        progressType: "count",
        target: 1,
        xpReward: 25,
        coinReward: 10,
        rewards: { tokens: 10 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.minigolf_duels.first_win",
        name: "Fairway Victor",
        description: "Win a Mini-Golf Duels match",
        icon: "🏆",
        category: "real_time",
        tier: "bronze",
        gameType: "minigolf_duels",
        progressType: "count",
        target: 1,
        xpReward: 25,
        coinReward: 10,
        rewards: { tokens: 10 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.minigolf_duels.wins_10",
        name: "Golf Pro",
        description: "Win 10 Mini-Golf Duels matches",
        icon: "⛳",
        category: "real_time",
        tier: "silver",
        gameType: "minigolf_duels",
        progressType: "count",
        target: 10,
        xpReward: 50,
        coinReward: 25,
        rewards: { tokens: 25 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.minigolf_duels.matches_25",
        name: "Golf Enthusiast",
        description: "Play 25 Mini-Golf Duels matches",
        icon: "⛳",
        category: "real_time",
        tier: "gold",
        gameType: "minigolf_duels",
        progressType: "count",
        target: 25,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 50 },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.minigolf_duels.hole_in_one",
        name: "Ace!",
        description: "Get a hole-in-one",
        icon: "🕳️",
        category: "real_time",
        tier: "gold",
        gameType: "minigolf_duels",
        progressType: "stat_threshold",
        statKey: "holesInOne",
        target: 1,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 75, entitlements: ["badge_golf_ace"] },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.minigolf_duels.holes_in_one_5",
        name: "Aces High",
        description: "Get 5 holes-in-one across all matches",
        icon: "🕳️",
        category: "real_time",
        tier: "platinum",
        gameType: "minigolf_duels",
        progressType: "stat_threshold",
        statKey: "holesInOne",
        target: 5,
        xpReward: 250,
        coinReward: 100,
        rewards: { tokens: 150, entitlements: ["badge_golf_master"] },
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.minigolf_duels.under_par_9",
        name: "Under Par Pro",
        description: "Finish 9 holes under par in a single match",
        icon: "📉",
        category: "real_time",
        tier: "platinum",
        gameType: "minigolf_duels",
        progressType: "stat_threshold",
        statKey: "underParHoles",
        target: 9,
        xpReward: 250,
        coinReward: 100,
        rewards: { tokens: 150 },
        secret: true,
        isEnabledByDefault: true,
        version: 2,
    }, {
        id: "achv.rt.minigolf_duels.win_streak_5",
        name: "Golf Streak",
        description: "Win 5 Mini-Golf matches in a row",
        icon: "🔥",
        category: "real_time",
        tier: "gold",
        gameType: "minigolf_duels",
        progressType: "streak",
        target: 5,
        xpReward: 100,
        coinReward: 50,
        rewards: { tokens: 50 },
        isEnabledByDefault: true,
        version: 2,
    });
    return catalog;
}
const SERVER_CATALOG = buildCatalog();
const SERVER_CATALOG_BY_ID = new Map(SERVER_CATALOG.map((d) => [d.id, d]));
function getActiveServerAchievements() {
    return SERVER_CATALOG.filter((def) => {
        if (!def.isEnabledByDefault)
            return false;
        if (def.gameType && !AVAILABLE_GAMES.has(def.gameType))
            return false;
        return true;
    });
}
/**
 * Compute the current progress value for a single achievement.
 */
function computeProgress(def, ctx) {
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
        if (!stats)
            return 0;
        // stat_threshold: read from gameSpecific map
        if (def.progressType === "stat_threshold" && def.statKey) {
            const value = stats.gameSpecific?.[def.statKey] ?? 0;
            return value;
        }
        // Single-player first play
        if (def.id.endsWith(".first_play") || def.id.endsWith(".first_solve")) {
            return stats.played > 0 ? 1 : 0;
        }
        // Games played count (e.g. games_10, games_50)
        if (def.id.match(/\.games_\d+$/)) {
            return stats.played;
        }
        // pct_of_max score tiers
        if (def.progressType === "pct_of_max" && def.pctThreshold !== undefined) {
            const limits = SCORE_LIMITS[def.gameType];
            if (!limits)
                return 0;
            if (isScoreSuspicious(stats.highScore, def.gameType))
                return 0;
            const threshold = Math.floor(limits.maxScore * def.pctThreshold);
            if (limits.scoreDirection === "higher") {
                return stats.highScore >= threshold ? 1 : 0;
            }
            else {
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
        // Wins count (wins_10, wins_50, etc.)
        if (def.id.match(/\.wins_\d+$/)) {
            return stats.wins;
        }
        // Matches count (matches_25, etc.)
        if (def.id.match(/\.matches_\d+$/)) {
            return stats.matches > 0 ? stats.matches : stats.played;
        }
        // Puzzles count (crossword puzzles_10, puzzles_50)
        if (def.id.match(/\.puzzles_\d+$/)) {
            return stats.completed > 0 ? stats.completed : stats.solved;
        }
        // Real-time first complete
        if (def.id.endsWith(".first_complete")) {
            return stats.completed > 0 ? stats.completed : stats.solved;
        }
    }
    return 0;
}
/**
 * Evaluate a single achievement. Never reduces progress or revokes unlocks.
 */
function evaluateOne(def, ctx) {
    const existing = ctx.existing.get(def.id);
    const previousState = existing?.state ?? "locked";
    if (previousState === "unlocked") {
        return {
            achievementId: def.id,
            previousState: "unlocked",
            newState: "unlocked",
            progress: existing.progress,
            target: def.target,
            justUnlocked: false,
        };
    }
    const rawProgress = computeProgress(def, ctx);
    const progress = Math.max(rawProgress, existing?.progress ?? 0);
    let newState;
    if (progress >= def.target) {
        newState = "unlocked";
    }
    else if (progress > 0) {
        newState = "progress";
    }
    else {
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
async function readPlayerGameStats(userId) {
    const docRef = db.collection("PlayerGameStats").doc(userId);
    const snap = await docRef.get();
    if (!snap.exists) {
        return { totalGamesPlayed: 0, totalWins: 0, perGame: {} };
    }
    const data = snap.data();
    return {
        totalGamesPlayed: data.overall?.totalGamesPlayed ?? 0,
        totalWins: data.overall?.totalWins ?? 0,
        perGame: data.gameStats ?? {},
    };
}
async function readPerGameStats(userId) {
    const v2Ref = db.collection("users").doc(userId).collection("statsPerGame");
    const v2Snap = await v2Ref.get();
    if (!v2Snap.empty) {
        const result = {};
        v2Snap.forEach((doc) => {
            result[doc.id] = doc.data();
        });
        return result;
    }
    // Fall back to PlayerGameStats.gameStats
    const pgStats = await readPlayerGameStats(userId);
    const result = {};
    const now = Date.now();
    for (const [gameType, stats] of Object.entries(pgStats.perGame)) {
        const s = stats;
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
async function readSocialGameStats(userId) {
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
    return snap.data();
}
async function readExistingV2Achievements(userId) {
    const ref = db.collection("users").doc(userId).collection("achievements");
    const snap = await ref.get();
    const result = new Map();
    snap.forEach((doc) => {
        result.set(doc.id, doc.data());
    });
    return result;
}
// =============================================================================
// Reward Granting
// =============================================================================
/**
 * Grant achievement rewards (tokens + entitlements) atomically.
 * Uses the canonical Wallets/{uid}.tokensBalance field.
 * Writes Entitlements via Users/{uid}/Entitlements/{cosmeticId}.
 * Records a transaction log entry for audit.
 *
 * Idempotent: checks rewardsGranted flag on the achievement doc.
 */
async function grantAchievementRewards(userId, achievementId, rewards) {
    try {
        const achievementRef = db
            .collection("users")
            .doc(userId)
            .collection("achievements")
            .doc(achievementId);
        // Check idempotency
        const achSnap = await achievementRef.get();
        if (achSnap.exists && achSnap.data()?.rewardsGranted) {
            return false; // Already granted
        }
        const batch = db.batch();
        const now = firestore_1.Timestamp.now();
        // Grant tokens
        if (rewards.tokens && rewards.tokens > 0) {
            const walletRef = db.collection("Wallets").doc(userId);
            batch.set(walletRef, {
                tokensBalance: admin.firestore.FieldValue.increment(rewards.tokens),
                // Back-compat: also increment tokens field
                tokens: admin.firestore.FieldValue.increment(rewards.tokens),
                totalEarned: admin.firestore.FieldValue.increment(rewards.tokens),
                lastUpdated: now,
            }, { merge: true });
            // Transaction log
            const txnId = `achv_${achievementId}_${Date.now().toString(36)}`;
            const txnRef = db
                .collection("Users")
                .doc(userId)
                .collection("Transactions")
                .doc(txnId);
            batch.set(txnRef, {
                type: "achievement_reward",
                achievementId,
                amount: rewards.tokens,
                timestamp: now,
                source: "achievement",
            });
        }
        // Grant entitlements
        if (rewards.entitlements && rewards.entitlements.length > 0) {
            for (const cosmeticId of rewards.entitlements) {
                const entRef = db
                    .collection("Users")
                    .doc(userId)
                    .collection("Entitlements")
                    .doc(cosmeticId);
                batch.set(entRef, {
                    cosmeticId,
                    type: "badge",
                    grantedAt: now,
                    source: "achievement",
                    metadata: { achievementId },
                }, { merge: true });
            }
        }
        // Mark rewards as granted (idempotency flag)
        batch.update(achievementRef, { rewardsGranted: true });
        await batch.commit();
        functions.logger.info("[AchievementsV2] Rewards granted", {
            userId,
            achievementId,
            tokens: rewards.tokens ?? 0,
            entitlements: rewards.entitlements?.length ?? 0,
        });
        return true;
    }
    catch (err) {
        functions.logger.error("[AchievementsV2] Reward grant failed", {
            userId,
            achievementId,
            error: err instanceof Error ? err.message : String(err),
        });
        return false;
    }
}
// =============================================================================
// Main Evaluator Entry Point
// =============================================================================
/**
 * Run the achievements v2 evaluator for a single user.
 *
 * 1. Reads all relevant stats
 * 2. Evaluates all active achievements
 * 3. Writes/updates v2 achievement docs
 * 4. Grants rewards for newly unlocked achievements
 * 5. Updates achievement summary
 * 6. Syncs legacy
 */
async function evaluateAchievementsV2(userId) {
    const timestamp = Date.now();
    const result = {
        userId,
        evaluated: 0,
        newUnlocks: [],
        errors: [],
        legacySynced: false,
        rewardsGranted: 0,
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
        const ctx = {
            totalGamesPlayed: playerStats.totalGamesPlayed,
            totalWins: playerStats.totalWins,
            perGame,
            social,
            existing,
        };
        // 2. Evaluate all active achievements
        const activeAchievements = getActiveServerAchievements();
        const evalResults = [];
        for (const def of activeAchievements) {
            try {
                const evalResult = evaluateOne(def, ctx);
                evalResults.push(evalResult);
                result.evaluated++;
            }
            catch (err) {
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
            if (existingDoc) {
                if (existingDoc.state === evalResult.newState &&
                    existingDoc.progress === evalResult.progress) {
                    continue;
                }
            }
            else if (evalResult.newState === "locked" &&
                evalResult.progress === 0) {
                continue;
            }
            const docRef = db
                .collection("users")
                .doc(userId)
                .collection("achievements")
                .doc(evalResult.achievementId);
            const doc = {
                achievementId: evalResult.achievementId,
                state: evalResult.newState,
                progress: evalResult.progress,
                target: evalResult.target,
                unlockedAt: evalResult.justUnlocked
                    ? now
                    : (existingDoc?.unlockedAt ?? null),
                version: SERVER_CATALOG_BY_ID.get(evalResult.achievementId)?.version ?? 1,
                source: "server",
                rewardsGranted: existingDoc?.rewardsGranted ?? false,
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
        const allUnlockedIds = [];
        const unlockedByTier = {
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
        const summary = {
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
        // Legacy sync
        if (allUnlockedIds.length > 0) {
            await syncLegacyAchievements(userId, allUnlockedIds);
            result.legacySynced = true;
        }
        // Commit batch
        if (batchCount > 0) {
            await batch.commit();
        }
        // 5. Grant rewards for newly unlocked achievements (after batch commit)
        for (const unlock of result.newUnlocks) {
            const def = SERVER_CATALOG_BY_ID.get(unlock.achievementId);
            if (def?.rewards) {
                const granted = await grantAchievementRewards(userId, unlock.achievementId, def.rewards);
                if (granted)
                    result.rewardsGranted++;
            }
        }
        functions.logger.info("[AchievementsV2] Evaluation complete", {
            userId,
            evaluated: result.evaluated,
            newUnlocks: result.newUnlocks.length,
            totalUnlocked: allUnlockedIds.length,
            rewardsGranted: result.rewardsGranted,
            errors: result.errors.length,
        });
    }
    catch (err) {
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
async function syncLegacyAchievements(userId, unlockedIds) {
    try {
        const paRef = db.collection("PlayerAchievements").doc(userId);
        const paSnap = await paRef.get();
        const progress = paSnap.exists
            ? (paSnap.data()?.progress ?? {})
            : {};
        const now = firestore_1.Timestamp.now();
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
            const totalUnlocked = Object.values(progress).filter((p) => p.unlocked).length;
            await paRef.set({
                playerId: userId,
                progress,
                totalUnlocked,
                updatedAt: now,
            }, { merge: true });
        }
    }
    catch (err) {
        functions.logger.warn("[AchievementsV2] Legacy sync failed", {
            userId,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
// =============================================================================
// Migration Helper
// =============================================================================
async function migrateExistingAchievements(userId) {
    const paRef = db.collection("PlayerAchievements").doc(userId);
    const paSnap = await paRef.get();
    if (!paSnap.exists)
        return 0;
    const progress = paSnap.data()?.progress ?? {};
    const now = Date.now();
    const batch = db.batch();
    let migrated = 0;
    for (const [id, p] of Object.entries(progress)) {
        const prog = p;
        if (!prog.unlocked)
            continue;
        const v2Ref = db
            .collection("users")
            .doc(userId)
            .collection("achievements")
            .doc(id);
        const v2Snap = await v2Ref.get();
        if (v2Snap.exists)
            continue;
        const doc = {
            achievementId: id,
            state: "unlocked",
            progress: prog.currentValue ?? 1,
            target: prog.threshold ?? 1,
            unlockedAt: prog.unlockedAt?.toMillis?.() ?? now,
            version: 1,
            source: "migration",
            rewardsGranted: false,
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
// Per-Game Stats Writer
// =============================================================================
/**
 * Update the v2 per-game stats subcollection.
 * Accepts optional gameSpecific stats for game-specific metrics
 * (e.g. maxTile for 2048, highestLevel for brick_breaker).
 */
async function updatePerGameStatsV2(userId, gameType, outcome, score, gameSpecific) {
    const docRef = db
        .collection("users")
        .doc(userId)
        .collection("statsPerGame")
        .doc(gameType);
    const now = Date.now();
    await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(docRef);
        let stats;
        if (snap.exists) {
            stats = snap.data();
        }
        else {
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
                }
                else {
                    if (stats.highScore === 0 || score < stats.highScore) {
                        stats.highScore = score;
                    }
                }
            }
        }
        // Merge game-specific stats (always take the max)
        if (gameSpecific) {
            if (!stats.gameSpecific)
                stats.gameSpecific = {};
            for (const [key, value] of Object.entries(gameSpecific)) {
                const current = stats.gameSpecific[key] ?? 0;
                stats.gameSpecific[key] = Math.max(current, value);
            }
        }
        transaction.set(docRef, stats);
    });
}
/**
 * Called by the client after recording a single-player session.
 * Bridges SP games into the server-authoritative achievement + stats system.
 */
exports.processSinglePlayerCompletion = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    const { gameType, score, outcome, gameSpecific } = data;
    // Validate input
    if (!gameType || typeof gameType !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "gameType required");
    }
    if (typeof score !== "number" || score < 0) {
        throw new functions.https.HttpsError("invalid-argument", "valid score required");
    }
    // Anti-cheat: validate score range
    if (isScoreSuspicious(score, gameType)) {
        functions.logger.warn("[SPCompletion] Suspicious score rejected", {
            uid,
            gameType,
            score,
        });
        throw new functions.https.HttpsError("invalid-argument", "Score out of valid range");
    }
    try {
        // Inject score into gameSpecific so stat_threshold achievements
        // like score_50000 can read it via gameSpecific.bestScore
        const mergedGameSpecific = {
            ...(gameSpecific || {}),
            bestScore: score,
        };
        // 1. Update per-game stats (with game-specific stats)
        await updatePerGameStatsV2(uid, gameType, outcome || "completed", score, mergedGameSpecific);
        // 2. Run achievement evaluator
        const evalResult = await evaluateAchievementsV2(uid);
        functions.logger.info("[SPCompletion] Processed", {
            uid,
            gameType,
            score,
            newUnlocks: evalResult.newUnlocks.length,
            rewardsGranted: evalResult.rewardsGranted,
        });
        return {
            success: true,
            newUnlocks: evalResult.newUnlocks.map((u) => u.achievementId),
            rewardsGranted: evalResult.rewardsGranted,
        };
    }
    catch (err) {
        functions.logger.error("[SPCompletion] Failed", {
            uid,
            gameType,
            error: err instanceof Error ? err.message : String(err),
        });
        throw new functions.https.HttpsError("internal", "Processing failed");
    }
});
//# sourceMappingURL=achievementsV2Evaluator.js.map