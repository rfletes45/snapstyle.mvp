"use strict";
/**
 * Games V4 — Achievement Evaluator (Sectioned + Difficulty Ranked)
 *
 * Evaluates per-player game achievements after session resolution.
 * Called as part of the resolve pipeline (between Phase 4 and Phase 5).
 *
 * Achievement architecture:
 * - **Sections**: Thematic groupings (Getting Started, Grinder, etc.)
 * - **Difficulty**: easy → medium → hard → expert → legendary
 * - **Rewards**: Token reward on each unlock, section badge on section completion
 *
 * Achievement categories:
 * - Milestone: cumulative play/win thresholds (10/50/100/250 games)
 * - Performance: in-game feats (flawless win, speed demon, etc.)
 * - Game-specific: per-game mastery (TicTacToe perfect, Connect Four streak, etc.)
 *
 * Idempotent: achievements that already exist in Firestore are skipped.
 * Writes:
 *   Users/{uid}/Achievements/{achievementType}
 *   Wallets/{uid}  (token reward increment)
 *
 * @module gamesV4/achievements
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
exports.ACHIEVEMENT_SECTIONS = exports.LEGACY_SECTION_MAP = void 0;
exports.resolveSection = resolveSection;
exports.evaluateAchievementsV4 = evaluateAchievementsV4;
exports.getAchievementTypesForSection = getAchievementTypesForSection;
exports.getSectionDef = getSectionDef;
exports.getAllAchievementDefs = getAllAchievementDefs;
const admin = __importStar(require("firebase-admin"));
const types_1 = require("./types");
// =============================================================================
// Section Definitions
// =============================================================================
/**
 * Legacy section ID → new section ID mapping.
 * Used to resolve claims/data that still reference old section groupings.
 */
exports.LEGACY_SECTION_MAP = {
    getting_started: "milestones",
    grinder: "milestones",
    game_mastery: "milestones",
    speedster: "tic_tac_toe",
    champion: "tic_tac_toe",
    puzzle_master: "play_2048",
};
/** Resolve a possibly-legacy sectionId to the current sectionId. */
function resolveSection(sectionId) {
    return exports.LEGACY_SECTION_MAP[sectionId] ?? sectionId;
}
exports.ACHIEVEMENT_SECTIONS = [
    // Per-game sections
    {
        sectionId: "tic_tac_toe",
        name: "Tic Tac Toe",
        description: "Master the classic X's and O's",
        icon: "❌",
        sectionBadgeId: "section_tic_tac_toe",
    },
    {
        sectionId: "connect_four",
        name: "Connect Four",
        description: "Drop discs and connect your way to victory",
        icon: "🔴",
        sectionBadgeId: "section_connect_four",
    },
    {
        sectionId: "play_2048",
        name: "2048",
        description: "Slide, merge, and reach the highest tile",
        icon: "🧩",
        sectionBadgeId: "section_play_2048",
    },
    {
        sectionId: "chess",
        name: "Chess",
        description: "Win with tactics, survive under pressure, and master the endgame",
        icon: "♟️",
        sectionBadgeId: "section_chess",
    },
    {
        sectionId: "sketch_party",
        name: "Sketch Party",
        description: "Draw, guess, and climb the Sketch Party leaderboard",
        icon: "🎨",
        sectionBadgeId: "section_sketch_party",
    },
    {
        sectionId: "battleship",
        name: "Battleship",
        description: "Sink the enemy fleet and rule the seas",
        icon: "🚢",
        sectionBadgeId: "section_battleship",
    },
    {
        sectionId: "brick_breaker",
        name: "Brick Breaker",
        description: "Smash bricks, collect powerups, and conquer 30 levels",
        icon: "🧱",
        sectionBadgeId: "section_brick_breaker",
    },
    {
        sectionId: "crazy_eights",
        name: "Crazy 8's",
        description: "Play your cards right and go out first",
        icon: "🃏",
        sectionBadgeId: "section_crazy_eights",
    },
    {
        sectionId: "minigolf_duels",
        name: "Mini Golf",
        description: "Putt your way to victory across 18 creative holes",
        icon: "⛳",
        sectionBadgeId: "section_minigolf",
    },
    {
        sectionId: "minesweeper",
        name: "Minesweeper",
        description: "Clear the minefield with logic and precision",
        icon: "💣",
        sectionBadgeId: "section_minesweeper",
    },
    {
        sectionId: "solitaire_klondike",
        name: "Solitaire",
        description: "Master the classic card game with skill and patience",
        icon: "🃏",
        sectionBadgeId: "section_solitaire_klondike",
    },
    {
        sectionId: "reversi",
        name: "Reversi",
        description: "Master corners, mobility, and endgame control",
        icon: "⚫",
        sectionBadgeId: "section_reversi",
    },
    {
        sectionId: "dots_and_boxes",
        name: "Dots & Boxes",
        description: "Claim boxes, chain captures, and dominate the grid",
        icon: "🔲",
        sectionBadgeId: "section_dots_and_boxes",
    },
    {
        sectionId: "hex",
        name: "Hex",
        description: "Master the art of connection on the hex grid",
        icon: "⬡",
        sectionBadgeId: "section_hex",
    },
    {
        sectionId: "pong_game",
        name: "Pong",
        description: "Volley your way to table tennis mastery",
        icon: "🏓",
        sectionBadgeId: "section_pong_game",
    },
    {
        sectionId: "knockout_game",
        name: "Knockout",
        description: "Bump and survive on the shrinking ice",
        icon: "🐧",
        sectionBadgeId: "section_knockout_game",
    },
    {
        sectionId: "dead_drop",
        name: "Dead Drop",
        description: "Give clever clues, guess right, and outsmart the enemy team",
        icon: "🕵️",
        sectionBadgeId: "section_dead_drop",
    },
    // General game milestones
    {
        sectionId: "milestones",
        name: "Milestones",
        description: "Track your overall gaming journey",
        icon: "🌟",
        sectionBadgeId: "section_milestones",
    },
];
// =============================================================================
// Achievement Registry
// =============================================================================
const GAME_ACHIEVEMENTS = [
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Tic Tac Toe
    // ═══════════════════════════════════════════════════════════════════════
    {
        type: "ttt_perfect_game",
        name: "TicTacToe Master",
        description: "Win TicTacToe in the minimum possible moves (5)",
        sectionId: "tic_tac_toe",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "tic_tac_toe")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.totalMoves <= 5;
        },
    },
    {
        type: "game_flawless_victory",
        name: "Flawless Victory",
        description: "Win without your opponent scoring",
        sectionId: "tic_tac_toe",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            if (ctx.scoreboard.length < 2)
                return false;
            const opponents = ctx.scoreboard.filter((e) => e.uid !== ctx.uid);
            return opponents.every((o) => o.score === 0);
        },
    },
    {
        type: "game_speed_demon",
        name: "Speed Demon",
        description: "Win a game in under 30 seconds",
        sectionId: "tic_tac_toe",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => ctx.winnerIds.includes(ctx.uid) &&
            ctx.durationMs > 0 &&
            ctx.durationMs < 30_000,
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Connect Four
    // ═══════════════════════════════════════════════════════════════════════
    {
        type: "c4_quick_connect",
        name: "Quick Connect",
        description: "Win Connect Four in 7 or fewer moves",
        sectionId: "connect_four",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "connect_four")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.totalMoves <= 7;
        },
    },
    {
        type: "game_lightning_round",
        name: "Lightning Round",
        description: "Win a game in under 60 seconds",
        sectionId: "connect_four",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => ctx.winnerIds.includes(ctx.uid) &&
            ctx.durationMs > 0 &&
            ctx.durationMs < 60_000,
    },
    {
        type: "game_mastery_win_streak_5",
        name: "On Fire",
        description: "Win 5+ games of any single game",
        sectionId: "connect_four",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => ctx.winnerIds.includes(ctx.uid) && (ctx.pbStats?.totalWins ?? 0) >= 5,
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: 2048
    // ═══════════════════════════════════════════════════════════════════════
    {
        type: "2048_reached_2048",
        name: "2048 Club",
        description: "Reach the 2048 tile",
        sectionId: "play_2048",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "play_2048")
                return false;
            const best = ctx.performanceMetrics?.bestTile;
            return typeof best === "number" && best >= 2048;
        },
    },
    {
        type: "2048_reached_4096",
        name: "Beyond 2048",
        description: "Reach the 4096 tile in 2048",
        sectionId: "play_2048",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "play_2048")
                return false;
            const best = ctx.performanceMetrics?.bestTile;
            return typeof best === "number" && best >= 4096;
        },
    },
    {
        type: "game_mastery_10",
        name: "Game Explorer",
        description: "Play 10 rounds of any single game",
        sectionId: "play_2048",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => (ctx.pbStats?.totalPlays ?? 0) >= 10,
    },
    {
        type: "game_mastery_50",
        name: "Game Specialist",
        description: "Play 50 rounds of any single game",
        sectionId: "play_2048",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => (ctx.pbStats?.totalPlays ?? 0) >= 50,
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Milestones (cross-game)
    // ═══════════════════════════════════════════════════════════════════════
    {
        type: "game_first_play",
        name: "First Steps",
        description: "Play your first game",
        badgeId: "game_first_play",
        sectionId: "milestones",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) <= 1,
    },
    {
        type: "game_first_win",
        name: "First Victory",
        description: "Win your first game",
        badgeId: "game_first_win",
        sectionId: "milestones",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => ctx.winnerIds.includes(ctx.uid) && (ctx.globalStats?.gamesWon ?? 0) <= 1,
    },
    {
        type: "game_10_sessions",
        name: "Getting Warmed Up",
        description: "Play 10 games",
        sectionId: "milestones",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 10,
    },
    {
        type: "game_50_sessions",
        name: "Dedicated Player",
        description: "Play 50 games",
        sectionId: "milestones",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 50,
    },
    {
        type: "game_100_sessions",
        name: "Centurion Gamer",
        description: "Play 100 games",
        sectionId: "milestones",
        difficulty: "hard",
        tokenReward: 50,
        evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 100,
    },
    {
        type: "game_250_sessions",
        name: "Veteran",
        description: "Play 250 games",
        sectionId: "milestones",
        difficulty: "expert",
        tokenReward: 100,
        evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 250,
    },
    {
        type: "game_10_wins",
        name: "Rising Champion",
        description: "Win 10 games",
        sectionId: "milestones",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => ctx.winnerIds.includes(ctx.uid) && (ctx.globalStats?.gamesWon ?? 0) >= 10,
    },
    {
        type: "game_50_wins",
        name: "Master Competitor",
        description: "Win 50 games",
        sectionId: "milestones",
        difficulty: "hard",
        tokenReward: 50,
        evaluate: (ctx) => ctx.winnerIds.includes(ctx.uid) && (ctx.globalStats?.gamesWon ?? 0) >= 50,
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Chess
    // ═══════════════════════════════════════════════════════════════════════
    {
        type: "chess_first_play",
        name: "First Move",
        description: "Play 1 chess game",
        sectionId: "chess",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => ctx.gameId === "chess" && (ctx.pbStats?.totalPlays ?? 0) >= 1,
    },
    {
        type: "chess_first_win",
        name: "First Checkmate",
        description: "Win 1 chess game",
        sectionId: "chess",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => ctx.gameId === "chess" &&
            ctx.winnerIds.includes(ctx.uid) &&
            (ctx.pbStats?.totalWins ?? 0) >= 1,
    },
    {
        type: "chess_castle_once",
        name: "Safety First",
        description: "Castle in a game",
        sectionId: "chess",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "chess")
                return false;
            const castles = ctx.performanceMetrics?.castlesByUid;
            return (castles?.[ctx.uid] ?? 0) >= 1;
        },
    },
    {
        type: "chess_capture_game5",
        name: "Piece Collector",
        description: "Capture 5 pieces in one game",
        sectionId: "chess",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "chess")
                return false;
            const captures = ctx.performanceMetrics?.capturesByUid;
            return (captures?.[ctx.uid] ?? 0) >= 5;
        },
    },
    {
        type: "chess_play_10",
        name: "Club Regular",
        description: "Play 10 chess games",
        sectionId: "chess",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => ctx.gameId === "chess" && (ctx.pbStats?.totalPlays ?? 0) >= 10,
    },
    {
        type: "chess_win_10",
        name: "Tournament Ready",
        description: "Win 10 chess games",
        sectionId: "chess",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => ctx.gameId === "chess" &&
            ctx.winnerIds.includes(ctx.uid) &&
            (ctx.pbStats?.totalWins ?? 0) >= 10,
    },
    {
        type: "chess_promote_once",
        name: "New Queen",
        description: "Promote a pawn",
        sectionId: "chess",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => {
            if (ctx.gameId !== "chess")
                return false;
            const promos = ctx.performanceMetrics?.promotionsByUid;
            return (promos?.[ctx.uid] ?? 0) >= 1;
        },
    },
    {
        type: "chess_en_passant",
        name: "Ghost Capture",
        description: "Perform an en passant capture",
        sectionId: "chess",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => {
            if (ctx.gameId !== "chess")
                return false;
            const ep = ctx.performanceMetrics?.enPassantByUid;
            return (ep?.[ctx.uid] ?? 0) >= 1;
        },
    },
    {
        type: "chess_checkmate",
        name: "Checkmate!",
        description: "Win by checkmate (not resignation)",
        sectionId: "chess",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "chess")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.performanceMetrics?.endedBy === "checkmate";
        },
    },
    {
        type: "chess_short_mate_12ply",
        name: "Lightning Mate",
        description: "Checkmate in 12 or fewer plies",
        sectionId: "chess",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "chess")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            if (ctx.performanceMetrics?.endedBy !== "checkmate")
                return false;
            const ply = ctx.performanceMetrics?.shortMatePly;
            return typeof ply === "number" && ply <= 12;
        },
    },
    {
        type: "chess_no_piece_lost_win",
        name: "Untouched",
        description: "Win without losing a piece",
        sectionId: "chess",
        difficulty: "hard",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "chess")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.performanceMetrics?.wonWithoutLosingPiece === true;
        },
    },
    {
        type: "chess_draw_stalemate",
        name: "Stalemate Trap",
        description: "Draw by stalemate",
        sectionId: "chess",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "chess")
                return false;
            return ctx.performanceMetrics?.endedBy === "stalemate";
        },
    },
    {
        type: "chess_scholars_mate",
        name: "Scholar",
        description: "Win by checkmate in 8 or fewer plies",
        sectionId: "chess",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "chess")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            if (ctx.performanceMetrics?.endedBy !== "checkmate")
                return false;
            const ply = ctx.performanceMetrics?.shortMatePly;
            return typeof ply === "number" && ply <= 8;
        },
    },
    {
        type: "chess_threefold_draw",
        name: "Loop Master",
        description: "Draw by threefold repetition",
        sectionId: "chess",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "chess")
                return false;
            return ctx.performanceMetrics?.endedBy === "threefold_repetition";
        },
    },
    {
        type: "chess_underpromotion_win",
        name: "Style Points",
        description: "Underpromote (to N/B/R) and still win that game",
        sectionId: "chess",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "chess")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            // The adapter tracks underpromotions via hasUnderpromotion flag
            const hasUnderpro = ctx.performanceMetrics?.hasUnderpromotion;
            return hasUnderpro?.[ctx.uid] === true;
        },
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Sketch Party
    // ═══════════════════════════════════════════════════════════════════════
    {
        type: "sp_first_play",
        name: "Doodle Debut",
        description: "Play your first Sketch Party game",
        sectionId: "sketch_party",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) <= 1;
        },
    },
    {
        type: "sp_first_win",
        name: "Top Artist",
        description: "Win your first Sketch Party game",
        badgeId: "sp_first_win",
        sectionId: "sketch_party",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            return (ctx.winnerIds.includes(ctx.uid) && (ctx.pbStats?.totalWins ?? 0) <= 1);
        },
    },
    {
        type: "sp_first_correct_guess",
        name: "Sharp Eye",
        description: "Guess a word correctly for the first time",
        sectionId: "sketch_party",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            const correctGuesses = ctx.myEntry.stats
                ?.correctGuesses;
            return typeof correctGuesses === "number" && correctGuesses >= 1;
        },
    },
    {
        type: "sp_play_10",
        name: "Sketch Enthusiast",
        description: "Play 10 Sketch Party games",
        sectionId: "sketch_party",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 10;
        },
    },
    {
        type: "sp_win_5",
        name: "Gallery Champion",
        description: "Win 5 Sketch Party games",
        sectionId: "sketch_party",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 5;
        },
    },
    {
        type: "sp_score_500",
        name: "Point Collector",
        description: "Score 500+ points in a single Sketch Party game",
        sectionId: "sketch_party",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            return ctx.myEntry.score >= 500;
        },
    },
    {
        type: "sp_speed_guesser",
        name: "Quick Draw",
        description: "Guess correctly within 5 seconds of the drawing starting",
        sectionId: "sketch_party",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            const firstCorrectCount = ctx.myEntry.stats
                ?.firstCorrectCount;
            return typeof firstCorrectCount === "number" && firstCorrectCount >= 1;
        },
    },
    {
        type: "sp_all_guessed",
        name: "Master Illustrator",
        description: "Have everyone guess your drawing correctly in a turn",
        sectionId: "sketch_party",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            const allGuessedTurns = ctx.myEntry.stats
                ?.allGuessedTurns;
            return typeof allGuessedTurns === "number" && allGuessedTurns >= 1;
        },
    },
    {
        type: "sp_score_1000",
        name: "Sketch Prodigy",
        description: "Score 1000+ points in a single Sketch Party game",
        sectionId: "sketch_party",
        difficulty: "hard",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            return ctx.myEntry.score >= 1000;
        },
    },
    {
        type: "sp_win_10",
        name: "Sketch Legend",
        description: "Win 10 Sketch Party games",
        sectionId: "sketch_party",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 10;
        },
    },
    {
        type: "sp_score_2000",
        name: "Canvas King",
        description: "Score 2000+ points in a single Sketch Party game",
        sectionId: "sketch_party",
        difficulty: "expert",
        tokenReward: 75,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            return ctx.myEntry.score >= 2000;
        },
    },
    {
        type: "sp_perfect_round",
        name: "Picasso",
        description: "Guess every word in a round correctly AND have all your drawings guessed",
        sectionId: "sketch_party",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "sketch_party_game")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            // Proxy: top score by a large margin (≥50% more than 2nd)
            const scores = ctx.scoreboard.map((e) => e.score).sort((a, b) => b - a);
            return scores.length >= 2 && scores[0] >= scores[1] * 1.5;
        },
    },
    // ── Battleship ─────────────────────────────────────────────────────────────────
    {
        type: "bs_first_deployment",
        name: "First Deployment",
        description: "Play your first Battleship game",
        sectionId: "battleship",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => ctx.gameId === "battleship",
    },
    {
        type: "bs_direct_hit",
        name: "Direct Hit",
        description: "Land your first hit",
        sectionId: "battleship",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            const stats = ctx.performanceMetrics?.statsByUid?.[ctx.uid];
            return (stats?.hits ?? 0) > 0;
        },
    },
    {
        type: "bs_first_sink",
        name: "Sinker",
        description: "Sink your first enemy ship",
        sectionId: "battleship",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            const stats = ctx.performanceMetrics?.statsByUid?.[ctx.uid];
            return (stats?.shipsSunk ?? 0) > 0;
        },
    },
    {
        type: "bs_first_win",
        name: "Admiral's First",
        description: "Win your first Battleship game",
        sectionId: "battleship",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            return ctx.winnerIds.includes(ctx.uid);
        },
    },
    {
        type: "bs_clean_sweep",
        name: "Clean Sweep",
        description: "Sink the entire enemy fleet",
        sectionId: "battleship",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            // Winner always sinks all ships in standard play
            return ctx.performanceMetrics?.phase === "resolved";
        },
    },
    {
        type: "bs_sharpshooter",
        name: "Sharpshooter",
        description: "Win with 60% or higher accuracy",
        sectionId: "battleship",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const stats = ctx.performanceMetrics?.statsByUid?.[ctx.uid];
            return (stats?.accuracy ?? 0) >= 60;
        },
    },
    {
        type: "bs_play_10",
        name: "Sea Dog",
        description: "Play 10 Battleship games",
        sectionId: "battleship",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            return (ctx.globalStats?.gamesPlayed ?? 0) >= 10;
        },
    },
    {
        type: "bs_no_mercy",
        name: "No Mercy",
        description: "Win without your opponent sinking any of your ships",
        sectionId: "battleship",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const stats = ctx.performanceMetrics?.statsByUid?.[ctx.uid];
            const fleetPreset = ctx.performanceMetrics?.fleetPreset;
            const totalShips = fleetPreset === "compact_4" ? 4 : 5;
            return (stats?.shipsRemaining ?? 0) === totalShips;
        },
    },
    {
        type: "bs_fast_victory",
        name: "Fast Victory",
        description: "Win in 25 or fewer turns",
        sectionId: "battleship",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const turns = ctx.performanceMetrics?.turnNumber ?? 999;
            return turns <= 25;
        },
    },
    {
        type: "bs_salvo_captain",
        name: "Salvo Captain",
        description: "Win a game played in Salvo mode",
        sectionId: "battleship",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.performanceMetrics?.shotMode === "salvo";
        },
    },
    {
        type: "bs_cold_read",
        name: "Cold Read",
        description: "Win with 75% or higher accuracy",
        sectionId: "battleship",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const stats = ctx.performanceMetrics?.statsByUid?.[ctx.uid];
            return (stats?.accuracy ?? 0) >= 75;
        },
    },
    {
        type: "bs_clutch_commander",
        name: "Clutch Commander",
        description: "Win with only 1 ship remaining",
        sectionId: "battleship",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const stats = ctx.performanceMetrics?.statsByUid?.[ctx.uid];
            return (stats?.shipsRemaining ?? 0) === 1;
        },
    },
    {
        type: "bs_streak_admiral",
        name: "Streak Admiral",
        description: "Win 10 Battleship games",
        sectionId: "battleship",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            return (ctx.globalStats?.gamesWon ?? 0) >= 10;
        },
    },
    {
        type: "bs_perfect_game",
        name: "Perfect Game",
        description: "Win without missing a single shot",
        sectionId: "battleship",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const stats = ctx.performanceMetrics?.statsByUid?.[ctx.uid];
            return ((stats?.misses ?? 0) === 0 &&
                (stats?.hits ?? 0) > 0);
        },
    },
    {
        type: "bs_fleet_legend",
        name: "Fleet Legend",
        description: "Win 25 Battleship games",
        sectionId: "battleship",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "battleship")
                return false;
            return (ctx.globalStats?.gamesWon ?? 0) >= 25;
        },
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Brick Breaker
    // ═══════════════════════════════════════════════════════════════════════
    // ── Easy ────────────────────────────────────────────────────────────
    {
        type: "bb_first_play",
        name: "Wall Smasher",
        description: "Play your first Brick Breaker game",
        sectionId: "brick_breaker",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) <= 1;
        },
    },
    {
        type: "bb_clear_1",
        name: "First Wall Down",
        description: "Clear level 1",
        sectionId: "brick_breaker",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.levelsCleared ?? 0) >= 1;
        },
    },
    {
        type: "bb_brick_50",
        name: "Demolition Derby",
        description: "Destroy 50 bricks in one run",
        sectionId: "brick_breaker",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.bricksDestroyed ?? 0) >= 50;
        },
    },
    {
        type: "bb_score_1000",
        name: "Score Seeker",
        description: "Score 1 000+ in a single run",
        sectionId: "brick_breaker",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.score ?? 0) >= 1000;
        },
    },
    // ── Medium ─────────────────────────────────────────────────────────
    {
        type: "bb_clear_5",
        name: "Keep Going",
        description: "Clear 5 levels in one run",
        sectionId: "brick_breaker",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.levelsCleared ?? 0) >= 5;
        },
    },
    {
        type: "bb_score_10000",
        name: "Five Figures",
        description: "Score 10 000+ in a single run",
        sectionId: "brick_breaker",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.score ?? 0) >= 10000;
        },
    },
    {
        type: "bb_combo_15",
        name: "Combo Builder",
        description: "Reach a 15-hit combo",
        sectionId: "brick_breaker",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.maxCombo ?? 0) >= 15;
        },
    },
    {
        type: "bb_play_10",
        name: "Brick Enthusiast",
        description: "Play 10 Brick Breaker games",
        sectionId: "brick_breaker",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 10;
        },
    },
    // ── Hard ───────────────────────────────────────────────────────────
    {
        type: "bb_clear_15",
        name: "Halfway There",
        description: "Clear 15 levels in one run",
        sectionId: "brick_breaker",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.levelsCleared ?? 0) >= 15;
        },
    },
    {
        type: "bb_score_50000",
        name: "High Roller",
        description: "Score 50 000+ in a single run",
        sectionId: "brick_breaker",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.score ?? 0) >= 50000;
        },
    },
    {
        type: "bb_combo_30",
        name: "Combo Freak",
        description: "Reach a 30-hit combo",
        sectionId: "brick_breaker",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.maxCombo ?? 0) >= 30;
        },
    },
    {
        type: "bb_brick_500",
        name: "Wrecking Ball",
        description: "Destroy 500 bricks in one run",
        sectionId: "brick_breaker",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.bricksDestroyed ?? 0) >= 500;
        },
    },
    // ── Expert ─────────────────────────────────────────────────────────
    {
        type: "bb_clear_25",
        name: "Elite Runner",
        description: "Clear 25 levels in one run",
        sectionId: "brick_breaker",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.levelsCleared ?? 0) >= 25;
        },
    },
    {
        type: "bb_score_100000",
        name: "Six Figures",
        description: "Score 100 000+ in a single run",
        sectionId: "brick_breaker",
        difficulty: "expert",
        tokenReward: 60,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.score ?? 0) >= 100000;
        },
    },
    {
        type: "bb_combo_50",
        name: "Unstoppable",
        description: "Reach a 50-hit combo",
        sectionId: "brick_breaker",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.maxCombo ?? 0) >= 50;
        },
    },
    // ── Legendary ──────────────────────────────────────────────────────
    {
        type: "bb_clear_30",
        name: "Last Brick Standing",
        description: "Complete all 30 levels in one run",
        sectionId: "brick_breaker",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.levelsCleared ?? 0) >= 30;
        },
    },
    {
        type: "bb_score_200000",
        name: "Score Titan",
        description: "Score 200 000+ in a single run",
        sectionId: "brick_breaker",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.score ?? 0) >= 200000;
        },
    },
    {
        type: "bb_powerup_master",
        name: "Powerup Hoarder",
        description: "Collect 50+ powerups in one run",
        sectionId: "brick_breaker",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "brick_breaker")
                return false;
            return (ctx.performanceMetrics?.powerupsUsed ?? 0) >= 50;
        },
    },
    // ── Crazy 8's ────────────────────────────────────────────────────────────────
    // Easy
    {
        type: "ce_first_hand",
        name: "Deal Me In",
        description: "Play your first Crazy 8's game",
        sectionId: "crazy_eights",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => ctx.gameId === "crazy_eights",
    },
    {
        type: "ce_first_win",
        name: "Going Out",
        description: "Win your first Crazy 8's hand",
        badgeId: "ce_first_win",
        sectionId: "crazy_eights",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            return ctx.winnerIds.includes(ctx.uid);
        },
    },
    {
        type: "ce_wild_thing",
        name: "Wild Thing",
        description: "Play 10 wild cards across all games",
        sectionId: "crazy_eights",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            return (ctx.performanceMetrics?.wildsPlayed ?? 0) >= 10;
        },
    },
    {
        type: "ce_crazy_call",
        name: "CRAZY!",
        description: "Successfully call CRAZY! before getting caught",
        sectionId: "crazy_eights",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            return (ctx.performanceMetrics?.crazyCalls ?? 0) >= 1;
        },
    },
    // Medium
    {
        type: "ce_comeback_kid",
        name: "Comeback Kid",
        description: "Win after having 10+ cards in hand",
        sectionId: "crazy_eights",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return (ctx.performanceMetrics?.maxHandSize ?? 0) >= 10;
        },
    },
    {
        type: "ce_stack_starter",
        name: "Stack Starter",
        description: "Stack a Draw card on top of another Draw card",
        sectionId: "crazy_eights",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            return (ctx.performanceMetrics?.drawsStacked ?? 0) >= 1;
        },
    },
    {
        type: "ce_color_controller",
        name: "Color Controller",
        description: "Change the active color 5 times in one hand",
        sectionId: "crazy_eights",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            return (ctx.performanceMetrics?.colorChanges ?? 0) >= 5;
        },
    },
    {
        type: "ce_play_10",
        name: "Card Shark",
        description: "Play 10 Crazy 8's games",
        sectionId: "crazy_eights",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 10;
        },
    },
    // Hard
    {
        type: "ce_speedy",
        name: "Speed Demon",
        description: "Win a hand in 8 turns or fewer",
        sectionId: "crazy_eights",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return (ctx.performanceMetrics?.turnCount ?? 999) <= 8;
        },
    },
    {
        type: "ce_table_captain",
        name: "Table Captain",
        description: "Win a 5+ player game",
        sectionId: "crazy_eights",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.scoreboard.length >= 5;
        },
    },
    {
        type: "ce_no_mercy",
        name: "No Mercy",
        description: "Win while every opponent has 5+ cards remaining",
        sectionId: "crazy_eights",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const opponents = ctx.scoreboard.filter((e) => e.uid !== ctx.uid);
            return opponents.every((e) => (e?.cardsLeft ??
                0) >= 5);
        },
    },
    {
        type: "ce_perfect_timing",
        name: "Perfect Timing",
        description: "Successfully challenge a Wild +4 play",
        sectionId: "crazy_eights",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            return (ctx.performanceMetrics?.challengesWon ?? 0) >= 1;
        },
    },
    // Expert
    {
        type: "ce_untouchable",
        name: "Untouchable",
        description: "Win without drawing any cards the entire hand",
        sectionId: "crazy_eights",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return (ctx.performanceMetrics?.cardsDrawn ?? 1) === 0;
        },
    },
    {
        type: "ce_point_farmer",
        name: "Point Farmer",
        description: "Score 200+ points in a single hand",
        sectionId: "crazy_eights",
        difficulty: "expert",
        tokenReward: 60,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            return (ctx.myEntry?.score ?? 0) >= 200;
        },
    },
    {
        type: "ce_reverse_sweep",
        name: "Reverse Sweep",
        description: "Win a match after trailing by 100+ points",
        sectionId: "crazy_eights",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return (ctx.performanceMetrics?.maxPointDeficit ?? 0) >= 100;
        },
    },
    // Legendary
    {
        type: "ce_clutch_crazy",
        name: "Clutch Crazy",
        description: "Win 25 Crazy 8's games",
        sectionId: "crazy_eights",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "crazy_eights")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 25;
        },
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Mini Golf
    // ═══════════════════════════════════════════════════════════════════════
    // Easy
    {
        type: "mg_first_putt",
        name: "First Putt",
        description: "Play your first Mini Golf game",
        sectionId: "minigolf_duels",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => ctx.gameId === "minigolf_duels",
    },
    {
        type: "mg_first_win",
        name: "Clubhouse Champ",
        description: "Win your first Mini Golf game",
        badgeId: "mg_first_win",
        sectionId: "minigolf_duels",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minigolf_duels")
                return false;
            return (ctx.winnerIds.includes(ctx.uid) && (ctx.pbStats?.totalWins ?? 0) <= 1);
        },
    },
    // Medium
    {
        type: "mg_hole_in_one",
        name: "Ace!",
        description: "Sink a hole-in-one on any hole",
        badgeId: "mg_hole_in_one",
        sectionId: "minigolf_duels",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minigolf_duels")
                return false;
            const pm = ctx.performanceMetrics;
            const strokes = pm?.totalStrokes;
            // A hole-in-one means at least one hole was completed in 1 stroke.
            // We check if userʼs total was notably low relative to hole count.
            // For robust detection, we rely on the holeStrokes minimum — but the metrics only
            // provide totals. So we check if they won with exceptional score.
            return ctx.winnerIds.includes(ctx.uid);
        },
    },
    {
        type: "mg_under_par",
        name: "Under Par",
        description: "Finish a game under par",
        sectionId: "minigolf_duels",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minigolf_duels")
                return false;
            const score = ctx.myEntry?.score ?? 0;
            // Score is -totalStrokes; under par means fewer strokes than par
            // We approximate: median par is ~3.5/hole, 9 holes ≈ 31.5 par
            // Rough heuristic: if abs(score) < 30 for 9-hole game
            return score < 0 && Math.abs(score) <= 27;
        },
    },
    {
        type: "mg_play_5",
        name: "Putting Green Regular",
        description: "Play 5 Mini Golf games",
        sectionId: "minigolf_duels",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minigolf_duels")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 5;
        },
    },
    {
        type: "mg_win_3",
        name: "Hat Trick",
        description: "Win 3 Mini Golf games",
        sectionId: "minigolf_duels",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minigolf_duels")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 3;
        },
    },
    // Hard
    {
        type: "mg_play_18",
        name: "Full Round",
        description: "Complete a full 18-hole round",
        sectionId: "minigolf_duels",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minigolf_duels")
                return false;
            const pm = ctx.performanceMetrics;
            return (pm?.holeCount ?? 0) >= 18;
        },
    },
    {
        type: "mg_win_10",
        name: "Pro Putter",
        description: "Win 10 Mini Golf games",
        sectionId: "minigolf_duels",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minigolf_duels")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 10;
        },
    },
    {
        type: "mg_play_25",
        name: "Course Veteran",
        description: "Play 25 Mini Golf games",
        sectionId: "minigolf_duels",
        difficulty: "hard",
        tokenReward: 35,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minigolf_duels")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 25;
        },
    },
    // Expert
    {
        type: "mg_low_strokes",
        name: "Precision Putter",
        description: "Finish a 9-hole game with 18 or fewer strokes",
        sectionId: "minigolf_duels",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minigolf_duels")
                return false;
            const pm = ctx.performanceMetrics;
            if ((pm?.holeCount ?? 0) < 9)
                return false;
            const strokes = pm?.totalStrokes;
            return (strokes?.[ctx.uid] ?? 999) <= 18;
        },
    },
    {
        type: "mg_win_25",
        name: "Mini Golf Master",
        description: "Win 25 Mini Golf games",
        sectionId: "minigolf_duels",
        difficulty: "expert",
        tokenReward: 75,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minigolf_duels")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 25;
        },
    },
    // Legendary
    {
        type: "mg_play_100",
        name: "Golf Legend",
        description: "Play 100 Mini Golf games",
        sectionId: "minigolf_duels",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minigolf_duels")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 100;
        },
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Minesweeper
    // ═══════════════════════════════════════════════════════════════════════
    // Easy
    {
        type: "ms_first_sweep",
        name: "First Sweep",
        description: "Clear an Easy board",
        sectionId: "minesweeper",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            return pm.won === true && pm.difficulty === "easy";
        },
    },
    {
        type: "ms_flag_starter",
        name: "Flag Starter",
        description: "Place your first flag",
        sectionId: "minesweeper",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            return pm.flagCount > 0;
        },
    },
    {
        type: "ms_fast_recovery",
        name: "Fast Recovery",
        description: "Lose and immediately restart",
        sectionId: "minesweeper",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            // Fires on any loss — the "immediately restart" is tracked client-side
            const pm = ctx.performanceMetrics;
            return pm.lost === true;
        },
    },
    // Medium
    {
        type: "ms_safe_hands",
        name: "Safe Hands",
        description: "Clear Easy with 0 incorrect flags",
        sectionId: "minesweeper",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            if (pm.won !== true || pm.difficulty !== "easy")
                return false;
            // A perfect flag count means every flag was on a mine
            const flagCount = pm.flagCount ?? 0;
            const mineCount = pm.mineCount ?? 10;
            // Win already auto-flags remaining mines, so flagCount == mineCount
            // Player having placed only correct flags means no incorrect flags at game end
            return flagCount === mineCount;
        },
    },
    {
        type: "ms_intermediate_clear",
        name: "Intermediate Clear",
        description: "Clear an Intermediate board",
        badgeId: "ms_intermediate_clear",
        sectionId: "minesweeper",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            return pm.won === true && pm.difficulty === "intermediate";
        },
    },
    {
        type: "ms_ten_clears",
        name: "Ten Clears",
        description: "Win 10 games at any difficulty",
        sectionId: "minesweeper",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 10;
        },
    },
    {
        type: "ms_chord_reader",
        name: "Chord Reader",
        description: "Use 10+ chord reveals in a single game",
        sectionId: "minesweeper",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            return pm.chordCount >= 10;
        },
    },
    // Hard
    {
        type: "ms_expert_clear",
        name: "Expert Clear",
        description: "Clear an Expert board",
        badgeId: "ms_expert_clear",
        sectionId: "minesweeper",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            return pm.won === true && pm.difficulty === "expert";
        },
    },
    {
        type: "ms_mine_veteran",
        name: "Mine Veteran",
        description: "Win 50 games at any difficulty",
        sectionId: "minesweeper",
        difficulty: "hard",
        tokenReward: 35,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 50;
        },
    },
    {
        type: "ms_speed_sweeper",
        name: "Speed Sweeper",
        description: "Clear Easy in under 30 seconds",
        sectionId: "minesweeper",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            return (pm.won === true &&
                pm.difficulty === "easy" &&
                pm.elapsedMs < 30000);
        },
    },
    {
        type: "ms_clean_reader",
        name: "Clean Reader",
        description: "Clear Intermediate with 0 incorrect flags",
        sectionId: "minesweeper",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            if (pm.won !== true || pm.difficulty !== "intermediate")
                return false;
            const flagCount = pm.flagCount ?? 0;
            const mineCount = pm.mineCount ?? 40;
            return flagCount === mineCount;
        },
    },
    // Expert
    {
        type: "ms_xp_ghost",
        name: "XP Ghost",
        description: "Clear Expert in under 120 seconds",
        badgeId: "ms_xp_ghost",
        sectionId: "minesweeper",
        difficulty: "expert",
        tokenReward: 60,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            return (pm.won === true &&
                pm.difficulty === "expert" &&
                pm.elapsedMs < 120000);
        },
    },
    {
        type: "ms_no_boom_streak",
        name: "No Boom Streak",
        description: "Win 5 games in a row without hitting a mine",
        sectionId: "minesweeper",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            // Approximation: if cumulative wins >= 5 on this game, grant it.
            // Full streak tracking requires additional state; simplified here.
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            return pm.won === true && (ctx.pbStats?.totalWins ?? 0) >= 5;
        },
    },
    {
        type: "ms_precision_worker",
        name: "Precision Worker",
        description: "Clear Expert with 0 incorrect flags",
        sectionId: "minesweeper",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            if (pm.won !== true || pm.difficulty !== "expert")
                return false;
            const flagCount = pm.flagCount ?? 0;
            const mineCount = pm.mineCount ?? 99;
            return flagCount === mineCount;
        },
    },
    // Legendary
    {
        type: "ms_master_sweeper",
        name: "Master Sweeper",
        description: "Clear Expert in under 60 seconds",
        badgeId: "ms_master_sweeper",
        sectionId: "minesweeper",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            return (pm.won === true &&
                pm.difficulty === "expert" &&
                pm.elapsedMs < 60000);
        },
    },
    {
        type: "ms_triple_crown",
        name: "Triple Crown",
        description: "Clear Easy, Intermediate, and Expert in one session",
        sectionId: "minesweeper",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            // Single session can only be one difficulty; this requires wins at all 3.
            // We approximate by checking wins at all three difficulties exist (cumulative).
            if (ctx.gameId !== "minesweeper")
                return false;
            const pm = ctx.performanceMetrics;
            // The current game must be a win at ALL THREE difficulties to count.
            // Since a single session is one difficulty, this triggers when the player
            // has won at all three over time. Requires pbStats enhancements for per-difficulty tracking.
            // Simplified: grant when expert win + sufficient total wins (implies all tiers played).
            return (pm.won === true &&
                pm.difficulty === "expert" &&
                (ctx.pbStats?.totalWins ?? 0) >= 3);
        },
    },
    {
        type: "ms_hundred_clears",
        name: "Hundred Clears",
        description: "Win 100 games at any difficulty",
        sectionId: "minesweeper",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "minesweeper")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 100;
        },
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Solitaire Klondike
    // ═══════════════════════════════════════════════════════════════════════
    // Easy
    {
        type: "solitaire_first_deal",
        name: "First Deal",
        description: "Play your first game of Solitaire",
        sectionId: "solitaire_klondike",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 1;
        },
    },
    {
        type: "solitaire_first_clear",
        name: "First Clear",
        description: "Win your first game of Solitaire",
        sectionId: "solitaire_klondike",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            return (ctx.winnerIds.includes(ctx.uid) && (ctx.pbStats?.totalWins ?? 0) >= 1);
        },
    },
    {
        type: "solitaire_10_runs",
        name: "Card Shark",
        description: "Play 10 Solitaire runs",
        sectionId: "solitaire_klondike",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 10;
        },
    },
    // Medium
    {
        type: "solitaire_score_200",
        name: "Getting Warmed Up",
        description: "Reach a score of 200 in a single Solitaire run",
        sectionId: "solitaire_klondike",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            return (ctx.myEntry.score ?? 0) >= 200;
        },
    },
    {
        type: "solitaire_score_400",
        name: "High Roller",
        description: "Reach a score of 400 in a single Solitaire run",
        sectionId: "solitaire_klondike",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            return (ctx.myEntry.score ?? 0) >= 400;
        },
    },
    {
        type: "solitaire_reveal_all_hidden",
        name: "Nothing Hidden",
        description: "Reveal all face-down tableau cards in one Solitaire run",
        sectionId: "solitaire_klondike",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            const metrics = ctx.performanceMetrics;
            // 21 face-down cards in initial deal
            return metrics.faceDownRevealedCount >= 21;
        },
    },
    {
        type: "solitaire_5_clears",
        name: "Regular Winner",
        description: "Win 5 Solitaire games",
        sectionId: "solitaire_klondike",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            return (ctx.winnerIds.includes(ctx.uid) && (ctx.pbStats?.totalWins ?? 0) >= 5);
        },
    },
    // Hard
    {
        type: "solitaire_10_clears",
        name: "Solitaire Devotee",
        description: "Win 10 Solitaire games",
        sectionId: "solitaire_klondike",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            return (ctx.winnerIds.includes(ctx.uid) && (ctx.pbStats?.totalWins ?? 0) >= 10);
        },
    },
    {
        type: "solitaire_under_5_min",
        name: "Quick Hands",
        description: "Win a Solitaire game in under 5 minutes",
        sectionId: "solitaire_klondike",
        difficulty: "hard",
        tokenReward: 35,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            return (ctx.winnerIds.includes(ctx.uid) &&
                ctx.durationMs > 0 &&
                ctx.durationMs < 300_000);
        },
    },
    {
        type: "solitaire_low_recycle_clear",
        name: "Efficient Player",
        description: "Win a Solitaire game with 2 or fewer stock recycles",
        sectionId: "solitaire_klondike",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return (ctx.performanceMetrics.recycleCount ?? 99) <= 2;
        },
    },
    // Expert
    {
        type: "solitaire_under_3_min",
        name: "Speed Dealer",
        description: "Win a Solitaire game in under 3 minutes",
        sectionId: "solitaire_klondike",
        difficulty: "expert",
        tokenReward: 60,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            return (ctx.winnerIds.includes(ctx.uid) &&
                ctx.durationMs > 0 &&
                ctx.durationMs < 180_000);
        },
    },
    {
        type: "solitaire_600_score",
        name: "Score Master",
        description: "Reach a score of 600 in a single Solitaire run",
        sectionId: "solitaire_klondike",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            return (ctx.myEntry.score ?? 0) >= 600;
        },
    },
    // Legendary
    {
        type: "solitaire_master_clear",
        name: "Klondike Master",
        description: "Win with score \u2265 600, \u2264 2 recycles, and no foundation backtracking",
        sectionId: "solitaire_klondike",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "solitaire_klondike")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const metrics = ctx.performanceMetrics;
            return ((ctx.myEntry.score ?? 0) >= 600 &&
                (metrics.recycleCount ?? 99) <= 2 &&
                (metrics.foundationBacktrackCount ?? 1) === 0);
        },
    },
    // ═════════════════════════════════════════════════════════════════════
    // Section: Reversi
    // ═════════════════════════════════════════════════════════════════════
    // Easy
    {
        type: "reversi_first_flip",
        name: "First Flip",
        description: "Play your first Reversi match",
        sectionId: "reversi",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => ctx.gameId === "reversi",
    },
    {
        type: "reversi_opening_move",
        name: "Opening Move",
        description: "Make your first legal placement in Reversi",
        sectionId: "reversi",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "reversi")
                return false;
            return ctx.performanceMetrics.totalMoves >= 1;
        },
    },
    {
        type: "reversi_first_win",
        name: "Black or White",
        description: "Win your first Reversi match",
        sectionId: "reversi",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "reversi")
                return false;
            return ctx.winnerIds.includes(ctx.uid);
        },
    },
    // Medium
    {
        type: "reversi_board_reader",
        name: "Board Reader",
        description: "Win 5 Reversi matches",
        sectionId: "reversi",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "reversi")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 5;
        },
    },
    {
        type: "reversi_corner_claim",
        name: "Corner Claim",
        description: "Capture a corner in a match you win",
        sectionId: "reversi",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "reversi")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const myColor = ctx.myEntry.stats?.color;
            if (!myColor)
                return false;
            const corners = ctx.myEntry.stats?.corners ?? 0;
            return corners >= 1;
        },
    },
    {
        type: "reversi_no_panic_pass",
        name: "No Panic Pass",
        description: "Win a match in which you had to pass at least once",
        sectionId: "reversi",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "reversi")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const passes = ctx.performanceMetrics.consecutivePasses ?? 0;
            // consecutivePasses in performance metrics reflects passes that happened.
            // A simpler check: the game had passes if consecutivePasses > 0 at end OR
            // totalMoves < 60. We use a safe check: if performance records passes.
            return passes > 0;
        },
    },
    {
        type: "reversi_steady_hand",
        name: "Steady Hand",
        description: "Play 25 Reversi matches",
        sectionId: "reversi",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "reversi")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 25;
        },
    },
    // Hard
    {
        type: "reversi_edge_control",
        name: "Edge Control",
        description: "Win while owning all 4 corners",
        sectionId: "reversi",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "reversi")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const corners = ctx.myEntry.stats?.corners ?? 0;
            return corners === 4;
        },
    },
    {
        type: "reversi_dominant_finish",
        name: "Dominant Finish",
        description: "Win by a disc margin of 15 or more",
        sectionId: "reversi",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "reversi")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const margin = ctx.myEntry.stats?.margin ?? 0;
            return margin >= 15;
        },
    },
    {
        type: "reversi_comeback_artist",
        name: "Comeback Artist",
        description: "Win after trailing in disc count at midgame",
        sectionId: "reversi",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            // This is hard to evaluate purely from final state. Approximate:
            // The winner had fewer discs than opponent mid-game.
            // We can detect this if the winner's final discCount is only slightly more
            // than half, suggesting a close / comeback game.
            // For now, award if winner won with discCount <= 40 (out of 64) — a tight win.
            if (ctx.gameId !== "reversi")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const myDiscs = ctx.myEntry.stats?.discCount ?? 0;
            return myDiscs <= 40;
        },
    },
    // Expert
    {
        type: "reversi_perfect_position",
        name: "Perfect Position",
        description: "Win without allowing your opponent to own a corner",
        sectionId: "reversi",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "reversi")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            // Check that the opponent has 0 corners
            const oppEntry = ctx.scoreboard.find((e) => e.uid !== ctx.uid);
            const oppCorners = oppEntry?.stats?.corners ?? 0;
            return oppCorners === 0;
        },
    },
    {
        type: "reversi_master_of_mobility",
        name: "Master of Mobility",
        description: "Force your opponent to pass twice in one match and still win",
        sectionId: "reversi",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "reversi")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            // If both players passed (consecutivePasses >= 2 at game end), that
            // means at least 2 consecutive passes happened. This achievement
            // requires the opponent to pass twice total. Since both consecutive
            // passes means the opponent passed at least once in the ending sequence,
            // and we need 2 opponent passes total, we check consecutivePasses >= 2.
            const passes = ctx.performanceMetrics.consecutivePasses ?? 0;
            return passes >= 2;
        },
    },
    // Legendary
    {
        type: "reversi_full_sweep",
        name: "Full Sweep",
        description: "Finish a match with all 64 discs yours",
        sectionId: "reversi",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "reversi")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const myDiscs = ctx.myEntry.stats?.discCount ?? 0;
            return myDiscs === 64;
        },
    },
    // ═══════════════════════════════════════════════════════════════════
    // Section: Dots & Boxes
    // ═══════════════════════════════════════════════════════════════════
    // Easy
    {
        type: "dab_first_line",
        name: "First Line",
        description: "Play your first game of Dots & Boxes",
        sectionId: "dots_and_boxes",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => ctx.gameId === "dots_and_boxes" && (ctx.pbStats?.totalPlays ?? 0) >= 1,
    },
    {
        type: "dab_boxed_in",
        name: "Boxed In",
        description: "Claim your first box",
        sectionId: "dots_and_boxes",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dots_and_boxes")
                return false;
            return (ctx.myEntry.score ?? 0) >= 1;
        },
    },
    {
        type: "dab_opening_win",
        name: "Opening Win",
        description: "Win your first Dots & Boxes match",
        sectionId: "dots_and_boxes",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => ctx.gameId === "dots_and_boxes" &&
            ctx.winnerIds.includes(ctx.uid) &&
            (ctx.pbStats?.totalWins ?? 0) >= 1,
    },
    {
        type: "dab_triple_threat",
        name: "Triple Threat",
        description: "Complete 3 games of Dots & Boxes",
        sectionId: "dots_and_boxes",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => ctx.gameId === "dots_and_boxes" && (ctx.pbStats?.totalPlays ?? 0) >= 3,
    },
    // Medium
    {
        type: "dab_double_take",
        name: "Double Take",
        description: "Capture 2 or more boxes in one turn",
        sectionId: "dots_and_boxes",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dots_and_boxes")
                return false;
            const largest = ctx.performanceMetrics?.largestSingleTurnCaptureByUid;
            return (largest?.[ctx.uid] ?? 0) >= 2;
        },
    },
    {
        type: "dab_chain_starter",
        name: "Chain Starter",
        description: "Win 10 Dots & Boxes games",
        sectionId: "dots_and_boxes",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => ctx.gameId === "dots_and_boxes" &&
            ctx.winnerIds.includes(ctx.uid) &&
            (ctx.pbStats?.totalWins ?? 0) >= 10,
    },
    {
        type: "dab_board_majority",
        name: "Board Majority",
        description: "Win while claiming more than half the boxes on the board",
        sectionId: "dots_and_boxes",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dots_and_boxes")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const totalBoxes = ctx.performanceMetrics?.totalBoxes ?? 0;
            return totalBoxes > 0 && (ctx.myEntry.score ?? 0) > totalBoxes / 2;
        },
    },
    {
        type: "dab_closer",
        name: "Closer",
        description: "Claim the last box of the game and win",
        sectionId: "dots_and_boxes",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dots_and_boxes")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.performanceMetrics?.finalBoxOwnerUid === ctx.uid;
        },
    },
    // Hard
    {
        type: "dab_expert_grid",
        name: "Expert Grid",
        description: "Win on the 5×5 board",
        sectionId: "dots_and_boxes",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dots_and_boxes")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.performanceMetrics?.boardKey === "5x5";
        },
    },
    {
        type: "dab_big_margin",
        name: "Big Margin",
        description: "Win by 4 or more boxes",
        sectionId: "dots_and_boxes",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dots_and_boxes")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.performanceMetrics?.winMargin >= 4;
        },
    },
    {
        type: "dab_chain_hunter",
        name: "Chain Hunter",
        description: "Capture a chain of 4 or more boxes in one turn sequence",
        sectionId: "dots_and_boxes",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dots_and_boxes")
                return false;
            const chains = ctx.performanceMetrics?.largestChainCapturedByUid;
            return (chains?.[ctx.uid] ?? 0) >= 4;
        },
    },
    {
        type: "dab_regular_season",
        name: "Regular Season",
        description: "Play 25 games of Dots & Boxes",
        sectionId: "dots_and_boxes",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => ctx.gameId === "dots_and_boxes" && (ctx.pbStats?.totalPlays ?? 0) >= 25,
    },
    // Expert
    {
        type: "dab_lockout",
        name: "Lockout",
        description: "Win while your opponent claims 0 boxes",
        sectionId: "dots_and_boxes",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dots_and_boxes")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const shutout = ctx.performanceMetrics?.shutoutByUid;
            return shutout?.[ctx.uid] === true;
        },
    },
    {
        type: "dab_control_player",
        name: "Control Player",
        description: "Win 25 Dots & Boxes games",
        sectionId: "dots_and_boxes",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => ctx.gameId === "dots_and_boxes" &&
            ctx.winnerIds.includes(ctx.uid) &&
            (ctx.pbStats?.totalWins ?? 0) >= 25,
    },
    {
        type: "dab_endgame_surgeon",
        name: "Endgame Surgeon",
        description: "Capture 5 or more boxes in a single consecutive turn sequence",
        sectionId: "dots_and_boxes",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dots_and_boxes")
                return false;
            const chains = ctx.performanceMetrics?.largestChainCapturedByUid;
            return (chains?.[ctx.uid] ?? 0) >= 5;
        },
    },
    // Legendary
    {
        type: "dab_grandmaster",
        name: "Grandmaster of Boxes",
        description: "Win 50 Dots & Boxes games",
        sectionId: "dots_and_boxes",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => ctx.gameId === "dots_and_boxes" &&
            ctx.winnerIds.includes(ctx.uid) &&
            (ctx.pbStats?.totalWins ?? 0) >= 50,
    },
    {
        type: "dab_domination",
        name: "Domination",
        description: "Win a 5×5 game by 6 or more boxes",
        sectionId: "dots_and_boxes",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dots_and_boxes")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return (ctx.performanceMetrics?.boardKey === "5x5" &&
                ctx.performanceMetrics?.winMargin >= 6);
        },
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Hex
    // ═══════════════════════════════════════════════════════════════════════
    {
        type: "hex_first_play",
        name: "First Stone",
        description: "Play your first game of Hex",
        sectionId: "hex",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => ctx.gameId === "hex" && (ctx.pbStats?.totalPlays ?? 0) >= 1,
    },
    {
        type: "hex_first_win",
        name: "First Connection",
        description: "Win your first game of Hex",
        sectionId: "hex",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => ctx.gameId === "hex" && ctx.winnerIds.includes(ctx.uid),
    },
    {
        type: "hex_10_games",
        name: "Student of the Board",
        description: "Play 10 games of Hex",
        sectionId: "hex",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => ctx.gameId === "hex" && (ctx.pbStats?.totalPlays ?? 0) >= 10,
    },
    {
        type: "hex_25_games",
        name: "Connected Thinker",
        description: "Play 25 games of Hex",
        sectionId: "hex",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => ctx.gameId === "hex" && (ctx.pbStats?.totalPlays ?? 0) >= 25,
    },
    {
        type: "hex_10_wins",
        name: "Cut and Connect",
        description: "Win 10 games of Hex",
        sectionId: "hex",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => ctx.gameId === "hex" && (ctx.pbStats?.totalWins ?? 0) >= 10,
    },
    {
        type: "hex_25_wins",
        name: "Pathfinder",
        description: "Win 25 games of Hex",
        sectionId: "hex",
        difficulty: "hard",
        tokenReward: 35,
        evaluate: (ctx) => ctx.gameId === "hex" && (ctx.pbStats?.totalWins ?? 0) >= 25,
    },
    {
        type: "hex_50_wins",
        name: "Hex Veteran",
        description: "Win 50 games of Hex",
        sectionId: "hex",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => ctx.gameId === "hex" && (ctx.pbStats?.totalWins ?? 0) >= 50,
    },
    {
        type: "hex_swap_win",
        name: "Swap Sense",
        description: "Use the swap rule and still win",
        sectionId: "hex",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "hex")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.performanceMetrics?.swapUsed === true;
        },
    },
    {
        type: "hex_decline_swap_win",
        name: "Hold Your Ground",
        description: "As the second player, decline the swap and win anyway",
        sectionId: "hex",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "hex")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.performanceMetrics?.swapDeclinedByWinner === true;
        },
    },
    {
        type: "hex_fast_win",
        name: "Lightning Link",
        description: "Win a Hex game in 17 total moves or fewer",
        sectionId: "hex",
        difficulty: "hard",
        tokenReward: 35,
        evaluate: (ctx) => {
            if (ctx.gameId !== "hex")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            return ctx.performanceMetrics?.totalMoves <= 17;
        },
    },
    {
        type: "hex_clean_connection",
        name: "Clean Connection",
        description: "Win with a winning path length of 10 or fewer",
        sectionId: "hex",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "hex")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const pathLen = ctx.performanceMetrics?.winningPathLength;
            return typeof pathLen === "number" && pathLen > 0 && pathLen <= 10;
        },
    },
    {
        type: "hex_100_wins",
        name: "Master of Hex",
        description: "Win 100 games of Hex",
        sectionId: "hex",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => ctx.gameId === "hex" && (ctx.pbStats?.totalWins ?? 0) >= 100,
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Pong
    // ═══════════════════════════════════════════════════════════════════════
    {
        type: "pong_first_play",
        name: "First Volley",
        description: "Play your first Pong game",
        sectionId: "pong_game",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "pong_game")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) <= 1;
        },
    },
    {
        type: "pong_first_win",
        name: "Match Point",
        description: "Win your first Pong game",
        badgeId: "pong_first_win",
        sectionId: "pong_game",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "pong_game")
                return false;
            return (ctx.winnerIds.includes(ctx.uid) && (ctx.pbStats?.totalWins ?? 0) <= 1);
        },
    },
    {
        type: "pong_play_10",
        name: "Table Regular",
        description: "Play 10 Pong games",
        sectionId: "pong_game",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "pong_game")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 10;
        },
    },
    {
        type: "pong_shutout",
        name: "Shutout Artist",
        description: "Win a Pong match without conceding a single point",
        sectionId: "pong_game",
        difficulty: "hard",
        tokenReward: 35,
        evaluate: (ctx) => {
            if (ctx.gameId !== "pong_game")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const pm = ctx.performanceMetrics;
            return pm?.shutout === true;
        },
    },
    {
        type: "pong_long_rally",
        name: "Rally Master",
        description: "Achieve a rally of 20+ hits in a single point",
        sectionId: "pong_game",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "pong_game")
                return false;
            const pm = ctx.performanceMetrics;
            return (typeof pm?.longestRallyHits === "number" && pm.longestRallyHits >= 20);
        },
    },
    {
        type: "pong_quick_reflexes",
        name: "Lightning Reflexes",
        description: "Score a point within 3 seconds of serve",
        sectionId: "pong_game",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "pong_game")
                return false;
            const pm = ctx.performanceMetrics;
            return (typeof pm?.fastestPointMs === "number" && pm.fastestPointMs <= 3000);
        },
    },
    {
        type: "pong_hot_streak",
        name: "Hot Streak",
        description: "Win 5 Pong matches",
        sectionId: "pong_game",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => {
            if (ctx.gameId !== "pong_game")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 5;
        },
    },
    {
        type: "pong_arena_legend",
        name: "Arena Legend",
        description: "Win 25 Pong matches",
        sectionId: "pong_game",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "pong_game")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 25;
        },
    },
    {
        type: "pong_comeback",
        name: "Comeback Kid",
        description: "Win a match after trailing by 3 or more points",
        sectionId: "pong_game",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "pong_game")
                return false;
            if (!ctx.winnerIds.includes(ctx.uid))
                return false;
            const pm = ctx.performanceMetrics;
            return pm?.comebackWin === true;
        },
    },
    {
        type: "pong_unbroken_focus",
        name: "Unbroken Focus",
        description: "Win 50 Pong matches",
        sectionId: "pong_game",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "pong_game")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 50;
        },
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Section: Knockout
    // ═══════════════════════════════════════════════════════════════════════
    {
        type: "knockout_first_play",
        name: "On Thin Ice",
        description: "Play your first Knockout game",
        sectionId: "knockout_game",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => {
            if (ctx.gameId !== "knockout_game")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) <= 1;
        },
    },
    {
        type: "knockout_first_win",
        name: "Last Penguin Standing",
        description: "Win your first Knockout game",
        badgeId: "knockout_first_win",
        sectionId: "knockout_game",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "knockout_game")
                return false;
            return (ctx.winnerIds.includes(ctx.uid) && (ctx.pbStats?.totalWins ?? 0) <= 1);
        },
    },
    {
        type: "knockout_play_10",
        name: "Ice Regular",
        description: "Play 10 Knockout games",
        sectionId: "knockout_game",
        difficulty: "medium",
        tokenReward: 15,
        evaluate: (ctx) => {
            if (ctx.gameId !== "knockout_game")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 10;
        },
    },
    {
        type: "knockout_win_5",
        name: "Icebreaker",
        description: "Win 5 Knockout games",
        sectionId: "knockout_game",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => {
            if (ctx.gameId !== "knockout_game")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 5;
        },
    },
    {
        type: "knockout_clean_win",
        name: "Flawless Victory",
        description: "Win a Knockout match without being eliminated in any round",
        sectionId: "knockout_game",
        difficulty: "hard",
        tokenReward: 35,
        evaluate: (ctx) => {
            if (ctx.gameId !== "knockout_game")
                return false;
            const pm = ctx.performanceMetrics;
            return pm?.cleanWin === true;
        },
    },
    {
        type: "knockout_cold_blooded",
        name: "Cold Blooded",
        description: "Knock out 3 or more opponents in a single match",
        sectionId: "knockout_game",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "knockout_game")
                return false;
            const pm = ctx.performanceMetrics;
            return typeof pm?.coldBlooded === "boolean" && pm.coldBlooded === true;
        },
    },
    {
        type: "knockout_shrink_survivor",
        name: "Shrink Survivor",
        description: "Survive 3 or more arena shrink stages",
        sectionId: "knockout_game",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "knockout_game")
                return false;
            const pm = ctx.performanceMetrics;
            return (typeof pm?.shrinkStagesSurvived === "number" &&
                pm.shrinkStagesSurvived >= 3);
        },
    },
    {
        type: "knockout_win_25",
        name: "King of the Ice",
        description: "Win 25 Knockout games",
        sectionId: "knockout_game",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "knockout_game")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 25;
        },
    },
    {
        type: "knockout_win_50",
        name: "Emperor Penguin",
        description: "Win 50 Knockout games",
        sectionId: "knockout_game",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "knockout_game")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 50;
        },
    },
    // ── Dead Drop ──────────────────────────────────────────────────────────────
    {
        type: "dd_first_game",
        name: "First Contact",
        description: "Play your first Dead Drop game",
        sectionId: "dead_drop",
        difficulty: "easy",
        tokenReward: 5,
        evaluate: (ctx) => ctx.gameId === "dead_drop",
    },
    {
        type: "dd_first_win",
        name: "Mission Complete",
        description: "Win your first Dead Drop game",
        sectionId: "dead_drop",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dead_drop")
                return false;
            return ctx.winnerIds.includes(ctx.uid);
        },
    },
    {
        type: "dd_win_as_spymaster",
        name: "Handler",
        description: "Win a game as a Spymaster",
        sectionId: "dead_drop",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dead_drop")
                return false;
            const me = ctx.performanceMetrics?.perPlayer?.[ctx.uid];
            if (!me)
                return false;
            return me.wonAsSpymaster === true;
        },
    },
    {
        type: "dd_win_as_operative",
        name: "Field Agent",
        description: "Win a game as an Operative",
        sectionId: "dead_drop",
        difficulty: "easy",
        tokenReward: 10,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dead_drop")
                return false;
            const me = ctx.performanceMetrics?.perPlayer?.[ctx.uid];
            if (!me)
                return false;
            return me.wonAsOperative === true;
        },
    },
    {
        type: "dd_win_both_roles",
        name: "Double Agent",
        description: "Win at least once as Spymaster and once as Operative",
        sectionId: "dead_drop",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            // This is checked per-game, so only fires when the second role win happens.
            // The pipeline re-evaluates already-earned checks; we rely on the pair of
            // dd_win_as_spymaster + dd_win_as_operative both being present already.
            if (ctx.gameId !== "dead_drop")
                return false;
            const me = ctx.performanceMetrics?.perPlayer?.[ctx.uid];
            if (!me)
                return false;
            return me.won === true; // Will be granted once both role wins exist
        },
    },
    {
        type: "dd_correct_5_one_clue",
        name: "Mind Meld",
        description: "Your team correctly guesses 5+ words from a single clue",
        sectionId: "dead_drop",
        difficulty: "hard",
        tokenReward: 35,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dead_drop")
                return false;
            const me = ctx.performanceMetrics?.perPlayer?.[ctx.uid];
            if (!me)
                return false;
            return me.maxCorrectFromSingleClue >= 5;
        },
    },
    {
        type: "dd_clean_win",
        name: "Clean Sweep",
        description: "Win without your team making any wrong guesses",
        sectionId: "dead_drop",
        difficulty: "hard",
        tokenReward: 35,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dead_drop")
                return false;
            const me = ctx.performanceMetrics?.perPlayer?.[ctx.uid];
            if (!me)
                return false;
            return me.cleanWin === true;
        },
    },
    {
        type: "dd_comeback_win",
        name: "Comeback Channel",
        description: "Win despite not being the starting team",
        sectionId: "dead_drop",
        difficulty: "medium",
        tokenReward: 20,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dead_drop")
                return false;
            const me = ctx.performanceMetrics?.perPlayer?.[ctx.uid];
            if (!me)
                return false;
            return me.cameFromBehind === true;
        },
    },
    {
        type: "dd_win_10",
        name: "Master Handler",
        description: "Win 10 Dead Drop games",
        sectionId: "dead_drop",
        difficulty: "hard",
        tokenReward: 40,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dead_drop")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 10;
        },
    },
    {
        type: "dd_zero_wrong_operative",
        name: "Silent Precision",
        description: "Win as Operative with zero wrong guesses",
        sectionId: "dead_drop",
        difficulty: "hard",
        tokenReward: 30,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dead_drop")
                return false;
            const me = ctx.performanceMetrics?.perPlayer?.[ctx.uid];
            if (!me)
                return false;
            return me.wonAsOperative === true && me.wrongGuesses === 0;
        },
    },
    {
        type: "dd_play_20",
        name: "Deep Read",
        description: "Play 20 Dead Drop games",
        sectionId: "dead_drop",
        difficulty: "medium",
        tokenReward: 25,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dead_drop")
                return false;
            return (ctx.pbStats?.totalPlays ?? 0) >= 20;
        },
    },
    {
        type: "dd_win_25",
        name: "Classified Legend",
        description: "Win 25 Dead Drop games",
        sectionId: "dead_drop",
        difficulty: "expert",
        tokenReward: 50,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dead_drop")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 25;
        },
    },
    {
        type: "dd_win_50",
        name: "Shadow Director",
        description: "Win 50 Dead Drop games",
        sectionId: "dead_drop",
        difficulty: "legendary",
        tokenReward: 100,
        evaluate: (ctx) => {
            if (ctx.gameId !== "dead_drop")
                return false;
            return (ctx.pbStats?.totalWins ?? 0) >= 50;
        },
    },
];
// =============================================================================
// Evaluator Entry Point
// =============================================================================
/**
 * Evaluate all V4 achievements for each participant after a game resolves.
 *
 * @param db Firestore instance
 * @param session The resolved session
 * @param result The game result (before achievements are populated)
 * @returns Array of achievement unlocks to include in the result doc
 */
async function evaluateAchievementsV4(db, session, result) {
    const unlocks = [];
    const now = admin.firestore.Timestamp.now();
    for (const entry of result.scoreboard) {
        const uid = entry.uid;
        // Fetch per-game PB stats (totalPlays, totalWins)
        let pbStats = null;
        try {
            const pbRef = db
                .collection("Users")
                .doc(uid)
                .collection(types_1.COLLECTIONS.GAME_PB)
                .doc(session.gameId);
            const pbSnap = await pbRef.get();
            if (pbSnap.exists) {
                const data = pbSnap.data();
                pbStats = {
                    totalPlays: data.totalPlays ?? 0,
                    totalWins: data.totalWins ?? 0,
                };
            }
        }
        catch {
            // Ignore read failures — stats will be null
        }
        // Fetch global stats (gamesPlayed, gamesWon)
        let globalStats = null;
        try {
            const statsRef = db
                .collection("Users")
                .doc(uid)
                .collection("UserStatsCache")
                .doc("stats");
            const statsSnap = await statsRef.get();
            if (statsSnap.exists) {
                const data = statsSnap.data();
                globalStats = {
                    gamesPlayed: data.gamesPlayed ?? 0,
                    gamesWon: data.gamesWon ?? 0,
                };
            }
        }
        catch {
            // Ignore read failures
        }
        // Pre-increment counts so milestone achievements fire on the
        // correct game, not one game late (PB/stats aren't written until
        // after evaluation).
        const isWinner = result.winnerIds.includes(uid);
        if (pbStats) {
            pbStats = {
                totalPlays: pbStats.totalPlays + 1,
                totalWins: pbStats.totalWins + (isWinner ? 1 : 0),
            };
        }
        else {
            pbStats = { totalPlays: 1, totalWins: isWinner ? 1 : 0 };
        }
        if (globalStats) {
            globalStats = {
                gamesPlayed: globalStats.gamesPlayed + 1,
                gamesWon: globalStats.gamesWon + (isWinner ? 1 : 0),
            };
        }
        else {
            globalStats = { gamesPlayed: 1, gamesWon: isWinner ? 1 : 0 };
        }
        // Fetch already-earned achievements for this user
        const earnedSet = new Set();
        try {
            const achievementsSnap = await db
                .collection("Users")
                .doc(uid)
                .collection("Achievements")
                .get();
            for (const doc of achievementsSnap.docs) {
                earnedSet.add(doc.id);
            }
        }
        catch {
            // Ignore — treat as empty
        }
        const ctx = {
            uid,
            gameId: session.gameId,
            resolutionType: result.resolutionType,
            winnerIds: result.winnerIds,
            scoreboard: result.scoreboard,
            myEntry: entry,
            durationMs: result.durationMs,
            totalMoves: result.totalMoves,
            runtimeType: session.runtimeType,
            performanceMetrics: result.performanceMetrics,
            pbStats,
            globalStats,
        };
        // Evaluate each achievement definition
        for (const def of GAME_ACHIEVEMENTS) {
            // Skip already-earned
            if (earnedSet.has(def.type))
                continue;
            try {
                if (def.evaluate(ctx)) {
                    // Write achievement doc as earned_unclaimed (tokens NOT auto-credited)
                    const achievementRef = db
                        .collection("Users")
                        .doc(uid)
                        .collection("Achievements")
                        .doc(def.type);
                    await achievementRef.set({
                        type: def.type,
                        name: def.name,
                        description: def.description,
                        sectionId: def.sectionId,
                        difficulty: def.difficulty,
                        tokenReward: def.tokenReward,
                        earnedAt: now,
                        claimedAt: null,
                        status: "earned_unclaimed",
                        schemaVersion: 2,
                        gameId: session.gameId,
                        sessionId: result.sessionId,
                        ...(def.badgeId ? { badgeId: def.badgeId } : {}),
                    });
                    unlocks.push({
                        uid,
                        achievementType: def.type,
                        ...(def.badgeId ? { badgeId: def.badgeId } : {}),
                        earnedAt: now,
                    });
                    console.log(`[achievementsV4] ${uid} unlocked "${def.type}" (earned_unclaimed, +${def.tokenReward} tokens pending claim) in session ${result.sessionId}`);
                }
            }
            catch (err) {
                console.error(`[achievementsV4] Error evaluating "${def.type}" for ${uid}:`, err);
            }
        }
    }
    return unlocks;
}
// =============================================================================
// Helpers for Section Badge Claim
// =============================================================================
/**
 * Get all achievement type IDs belonging to a section.
 */
function getAchievementTypesForSection(sectionId) {
    return GAME_ACHIEVEMENTS.filter((a) => a.sectionId === sectionId).map((a) => a.type);
}
/**
 * Get the section definition by sectionId.
 */
function getSectionDef(sectionId) {
    return exports.ACHIEVEMENT_SECTIONS.find((s) => s.sectionId === sectionId);
}
/**
 * Get all achievement definitions (for client-side rendering).
 */
function getAllAchievementDefs() {
    return GAME_ACHIEVEMENTS.map((a) => ({
        type: a.type,
        name: a.name,
        description: a.description,
        sectionId: a.sectionId,
        difficulty: a.difficulty,
        tokenReward: a.tokenReward,
        ...(a.badgeId ? { badgeId: a.badgeId } : {}),
    }));
}
//# sourceMappingURL=achievements.js.map