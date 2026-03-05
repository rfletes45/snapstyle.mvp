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

import * as admin from "firebase-admin";
import type {
  AchievementUnlock,
  FinalScoreboardEntry,
  GameId,
  GameResultV4,
  GameSessionV4,
  ResolutionType,
  TimestampLike,
} from "./types";
import { COLLECTIONS } from "./types";

// =============================================================================
// Achievement Definition Types
// =============================================================================

export type AchievementDifficulty =
  | "easy"
  | "medium"
  | "hard"
  | "expert"
  | "legendary";

export interface AchievementSectionDef {
  /** Unique section ID. */
  sectionId: string;
  /** Human-readable section name. */
  name: string;
  /** Short description of the section. */
  description: string;
  /** Icon (emoji or MaterialCommunityIcons name). */
  icon: string;
  /** Badge ID granted when all achievements in section are complete. */
  sectionBadgeId: string;
}

interface AchievementDef {
  /** Unique achievement type ID. */
  type: string;
  /** Human-readable name. */
  name: string;
  /** Short description. */
  description: string;
  /** Badge ID to grant (matches client BADGE_DEFINITIONS). */
  badgeId?: string;
  /** Section this achievement belongs to. */
  sectionId: string;
  /** Difficulty rank. */
  difficulty: AchievementDifficulty;
  /** Token reward for unlocking this achievement. */
  tokenReward: number;
  /** Evaluation function — returns true if the achievement is earned. */
  evaluate: (ctx: EvaluationContext) => boolean;
}

interface EvaluationContext {
  /** Current player's UID. */
  uid: string;
  /** Game that was just played. */
  gameId: GameId;
  /** How the game ended. */
  resolutionType: ResolutionType;
  /** Winner UIDs. */
  winnerIds: string[];
  /** Full scoreboard. */
  scoreboard: FinalScoreboardEntry[];
  /** This player's scoreboard entry. */
  myEntry: FinalScoreboardEntry;
  /** Game duration in ms. */
  durationMs: number;
  /** Total moves in the session. */
  totalMoves: number;
  /** Session runtime type. */
  runtimeType: string;
  /** Performance metrics from the adapter. */
  performanceMetrics: Record<string, unknown>;
  /** Cumulative stats from Users/{uid}/GamePB/{gameId}. */
  pbStats: { totalPlays: number; totalWins: number } | null;
  /** Global stats from Users/{uid}/UserStatsCache/stats. */
  globalStats: { gamesPlayed: number; gamesWon: number } | null;
}

// =============================================================================
// Section Definitions
// =============================================================================

export const ACHIEVEMENT_SECTIONS: AchievementSectionDef[] = [
  {
    sectionId: "getting_started",
    name: "Getting Started",
    description: "Your first steps in the games world",
    icon: "🌟",
    sectionBadgeId: "section_getting_started",
  },
  {
    sectionId: "grinder",
    name: "Grinder",
    description: "Play more games to earn these milestones",
    icon: "⚡",
    sectionBadgeId: "section_grinder",
  },
  {
    sectionId: "game_mastery",
    name: "Game Mastery",
    description: "Master individual games",
    icon: "🎯",
    sectionBadgeId: "section_game_mastery",
  },
  {
    sectionId: "speedster",
    name: "Speedster",
    description: "Win games as fast as possible",
    icon: "⏱️",
    sectionBadgeId: "section_speedster",
  },
  {
    sectionId: "champion",
    name: "Champion",
    description: "Prove your dominance with extraordinary feats",
    icon: "🏆",
    sectionBadgeId: "section_champion",
  },
  {
    sectionId: "puzzle_master",
    name: "Puzzle Master",
    description: "Conquer the 2048 challenge",
    icon: "🧩",
    sectionBadgeId: "section_puzzle_master",
  },
  {
    sectionId: "chess",
    name: "Chess",
    description:
      "Win with tactics, survive under pressure, and master the endgame",
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
];

// =============================================================================
// Achievement Registry
// =============================================================================

const GAME_ACHIEVEMENTS: AchievementDef[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // Section: Getting Started
  // ═══════════════════════════════════════════════════════════════════════
  {
    type: "game_first_play",
    name: "First Steps",
    description: "Play your first game",
    badgeId: "game_first_play",
    sectionId: "getting_started",
    difficulty: "easy",
    tokenReward: 5,
    evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) <= 1,
  },
  {
    type: "game_first_win",
    name: "First Victory",
    description: "Win your first game",
    badgeId: "game_first_win",
    sectionId: "getting_started",
    difficulty: "easy",
    tokenReward: 10,
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) && (ctx.globalStats?.gamesWon ?? 0) <= 1,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Section: Grinder
  // ═══════════════════════════════════════════════════════════════════════
  {
    type: "game_10_sessions",
    name: "Getting Warmed Up",
    description: "Play 10 games",
    sectionId: "grinder",
    difficulty: "easy",
    tokenReward: 10,
    evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 10,
  },
  {
    type: "game_50_sessions",
    name: "Dedicated Player",
    description: "Play 50 games",
    sectionId: "grinder",
    difficulty: "medium",
    tokenReward: 25,
    evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 50,
  },
  {
    type: "game_100_sessions",
    name: "Centurion Gamer",
    description: "Play 100 games",
    sectionId: "grinder",
    difficulty: "hard",
    tokenReward: 50,
    evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 100,
  },
  {
    type: "game_250_sessions",
    name: "Veteran",
    description: "Play 250 games",
    sectionId: "grinder",
    difficulty: "expert",
    tokenReward: 100,
    evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 250,
  },
  {
    type: "game_10_wins",
    name: "Rising Champion",
    description: "Win 10 games",
    sectionId: "grinder",
    difficulty: "medium",
    tokenReward: 20,
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) && (ctx.globalStats?.gamesWon ?? 0) >= 10,
  },
  {
    type: "game_50_wins",
    name: "Master Competitor",
    description: "Win 50 games",
    sectionId: "grinder",
    difficulty: "hard",
    tokenReward: 50,
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) && (ctx.globalStats?.gamesWon ?? 0) >= 50,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Section: Game Mastery
  // ═══════════════════════════════════════════════════════════════════════
  {
    type: "game_mastery_10",
    name: "Game Explorer",
    description: "Play 10 rounds of any single game",
    sectionId: "game_mastery",
    difficulty: "easy",
    tokenReward: 10,
    evaluate: (ctx) => (ctx.pbStats?.totalPlays ?? 0) >= 10,
  },
  {
    type: "game_mastery_50",
    name: "Game Specialist",
    description: "Play 50 rounds of any single game",
    sectionId: "game_mastery",
    difficulty: "medium",
    tokenReward: 25,
    evaluate: (ctx) => (ctx.pbStats?.totalPlays ?? 0) >= 50,
  },
  {
    type: "game_mastery_win_streak_5",
    name: "On Fire",
    description: "Win 5+ games of any single game",
    sectionId: "game_mastery",
    difficulty: "medium",
    tokenReward: 20,
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) && (ctx.pbStats?.totalWins ?? 0) >= 5,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Section: Speedster
  // ═══════════════════════════════════════════════════════════════════════
  {
    type: "game_lightning_round",
    name: "Lightning Round",
    description: "Win a game in under 60 seconds",
    sectionId: "speedster",
    difficulty: "medium",
    tokenReward: 15,
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) &&
      ctx.durationMs > 0 &&
      ctx.durationMs < 60_000,
  },
  {
    type: "game_speed_demon",
    name: "Speed Demon",
    description: "Win a game in under 30 seconds",
    sectionId: "speedster",
    difficulty: "hard",
    tokenReward: 30,
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) &&
      ctx.durationMs > 0 &&
      ctx.durationMs < 30_000,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Section: Champion
  // ═══════════════════════════════════════════════════════════════════════
  {
    type: "game_flawless_victory",
    name: "Flawless Victory",
    description: "Win without your opponent scoring",
    sectionId: "champion",
    difficulty: "hard",
    tokenReward: 30,
    evaluate: (ctx) => {
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      if (ctx.scoreboard.length < 2) return false;
      const opponents = ctx.scoreboard.filter((e) => e.uid !== ctx.uid);
      return opponents.every((o) => o.score === 0);
    },
  },
  {
    type: "ttt_perfect_game",
    name: "TicTacToe Master",
    description: "Win TicTacToe in the minimum possible moves (5)",
    sectionId: "champion",
    difficulty: "expert",
    tokenReward: 50,
    evaluate: (ctx) => {
      if (ctx.gameId !== "tic_tac_toe") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      return ctx.totalMoves <= 5;
    },
  },
  {
    type: "c4_quick_connect",
    name: "Quick Connect",
    description: "Win Connect Four in 7 or fewer moves",
    sectionId: "champion",
    difficulty: "expert",
    tokenReward: 50,
    evaluate: (ctx) => {
      if (ctx.gameId !== "connect_four") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      return ctx.totalMoves <= 7;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Section: Puzzle Master
  // ═══════════════════════════════════════════════════════════════════════
  {
    type: "2048_reached_2048",
    name: "2048 Club",
    description: "Reach the 2048 tile",
    sectionId: "puzzle_master",
    difficulty: "hard",
    tokenReward: 40,
    evaluate: (ctx) => {
      if (ctx.gameId !== "play_2048") return false;
      const best = ctx.performanceMetrics?.bestTile;
      return typeof best === "number" && best >= 2048;
    },
  },
  {
    type: "2048_reached_4096",
    name: "Beyond 2048",
    description: "Reach the 4096 tile in 2048",
    sectionId: "puzzle_master",
    difficulty: "legendary",
    tokenReward: 100,
    evaluate: (ctx) => {
      if (ctx.gameId !== "play_2048") return false;
      const best = ctx.performanceMetrics?.bestTile;
      return typeof best === "number" && best >= 4096;
    },
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
    evaluate: (ctx) =>
      ctx.gameId === "chess" && (ctx.pbStats?.totalPlays ?? 0) >= 1,
  },
  {
    type: "chess_first_win",
    name: "First Checkmate",
    description: "Win 1 chess game",
    sectionId: "chess",
    difficulty: "easy",
    tokenReward: 10,
    evaluate: (ctx) =>
      ctx.gameId === "chess" &&
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
      if (ctx.gameId !== "chess") return false;
      const castles = ctx.performanceMetrics?.castlesByUid as
        | Record<string, number>
        | undefined;
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
      if (ctx.gameId !== "chess") return false;
      const captures = ctx.performanceMetrics?.capturesByUid as
        | Record<string, number>
        | undefined;
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
    evaluate: (ctx) =>
      ctx.gameId === "chess" && (ctx.pbStats?.totalPlays ?? 0) >= 10,
  },
  {
    type: "chess_win_10",
    name: "Tournament Ready",
    description: "Win 10 chess games",
    sectionId: "chess",
    difficulty: "medium",
    tokenReward: 25,
    evaluate: (ctx) =>
      ctx.gameId === "chess" &&
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
      if (ctx.gameId !== "chess") return false;
      const promos = ctx.performanceMetrics?.promotionsByUid as
        | Record<string, number>
        | undefined;
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
      if (ctx.gameId !== "chess") return false;
      const ep = ctx.performanceMetrics?.enPassantByUid as
        | Record<string, number>
        | undefined;
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
      if (ctx.gameId !== "chess") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
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
      if (ctx.gameId !== "chess") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      if (ctx.performanceMetrics?.endedBy !== "checkmate") return false;
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
      if (ctx.gameId !== "chess") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
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
      if (ctx.gameId !== "chess") return false;
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
      if (ctx.gameId !== "chess") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      if (ctx.performanceMetrics?.endedBy !== "checkmate") return false;
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
      if (ctx.gameId !== "chess") return false;
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
      if (ctx.gameId !== "chess") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      // The adapter tracks underpromotions via hasUnderpromotion flag
      const hasUnderpro = ctx.performanceMetrics?.hasUnderpromotion as
        | Record<string, boolean>
        | undefined;
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
      if (ctx.gameId !== "sketch_party_game") return false;
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
      if (ctx.gameId !== "sketch_party_game") return false;
      return (
        ctx.winnerIds.includes(ctx.uid) && (ctx.pbStats?.totalWins ?? 0) <= 1
      );
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
      if (ctx.gameId !== "sketch_party_game") return false;
      const correctGuesses = (ctx.myEntry.stats as Record<string, unknown>)
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
      if (ctx.gameId !== "sketch_party_game") return false;
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
      if (ctx.gameId !== "sketch_party_game") return false;
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
      if (ctx.gameId !== "sketch_party_game") return false;
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
      if (ctx.gameId !== "sketch_party_game") return false;
      const firstCorrectCount = (ctx.myEntry.stats as Record<string, unknown>)
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
      if (ctx.gameId !== "sketch_party_game") return false;
      const allGuessedTurns = (ctx.myEntry.stats as Record<string, unknown>)
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
      if (ctx.gameId !== "sketch_party_game") return false;
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
      if (ctx.gameId !== "sketch_party_game") return false;
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
      if (ctx.gameId !== "sketch_party_game") return false;
      return ctx.myEntry.score >= 2000;
    },
  },
  {
    type: "sp_perfect_round",
    name: "Picasso",
    description:
      "Guess every word in a round correctly AND have all your drawings guessed",
    sectionId: "sketch_party",
    difficulty: "legendary",
    tokenReward: 100,
    evaluate: (ctx) => {
      if (ctx.gameId !== "sketch_party_game") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
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
      if (ctx.gameId !== "battleship") return false;
      const stats = (
        ctx.performanceMetrics?.statsByUid as Record<
          string,
          Record<string, unknown>
        >
      )?.[ctx.uid];
      return ((stats?.hits as number) ?? 0) > 0;
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
      if (ctx.gameId !== "battleship") return false;
      const stats = (
        ctx.performanceMetrics?.statsByUid as Record<
          string,
          Record<string, unknown>
        >
      )?.[ctx.uid];
      return ((stats?.shipsSunk as number) ?? 0) > 0;
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
      if (ctx.gameId !== "battleship") return false;
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
      if (ctx.gameId !== "battleship") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
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
      if (ctx.gameId !== "battleship") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      const stats = (
        ctx.performanceMetrics?.statsByUid as Record<
          string,
          Record<string, unknown>
        >
      )?.[ctx.uid];
      return ((stats?.accuracy as number) ?? 0) >= 60;
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
      if (ctx.gameId !== "battleship") return false;
      return ((ctx.globalStats?.gamesPlayed as number) ?? 0) >= 10;
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
      if (ctx.gameId !== "battleship") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      const stats = (
        ctx.performanceMetrics?.statsByUid as Record<
          string,
          Record<string, unknown>
        >
      )?.[ctx.uid];
      const fleetPreset = ctx.performanceMetrics?.fleetPreset as string;
      const totalShips = fleetPreset === "compact_4" ? 4 : 5;
      return ((stats?.shipsRemaining as number) ?? 0) === totalShips;
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
      if (ctx.gameId !== "battleship") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      const turns = (ctx.performanceMetrics?.turnNumber as number) ?? 999;
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
      if (ctx.gameId !== "battleship") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
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
      if (ctx.gameId !== "battleship") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      const stats = (
        ctx.performanceMetrics?.statsByUid as Record<
          string,
          Record<string, unknown>
        >
      )?.[ctx.uid];
      return ((stats?.accuracy as number) ?? 0) >= 75;
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
      if (ctx.gameId !== "battleship") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      const stats = (
        ctx.performanceMetrics?.statsByUid as Record<
          string,
          Record<string, unknown>
        >
      )?.[ctx.uid];
      return ((stats?.shipsRemaining as number) ?? 0) === 1;
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
      if (ctx.gameId !== "battleship") return false;
      return ((ctx.globalStats?.gamesWon as number) ?? 0) >= 10;
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
      if (ctx.gameId !== "battleship") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      const stats = (
        ctx.performanceMetrics?.statsByUid as Record<
          string,
          Record<string, unknown>
        >
      )?.[ctx.uid];
      return (
        ((stats?.misses as number) ?? 0) === 0 &&
        ((stats?.hits as number) ?? 0) > 0
      );
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
      if (ctx.gameId !== "battleship") return false;
      return ((ctx.globalStats?.gamesWon as number) ?? 0) >= 25;
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
      if (ctx.gameId !== "brick_breaker") return false;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.levelsCleared as number) ?? 0) >= 1;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.bricksDestroyed as number) ?? 0) >= 50;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.score as number) ?? 0) >= 1000;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.levelsCleared as number) ?? 0) >= 5;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.score as number) ?? 0) >= 10000;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.maxCombo as number) ?? 0) >= 15;
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
      if (ctx.gameId !== "brick_breaker") return false;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.levelsCleared as number) ?? 0) >= 15;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.score as number) ?? 0) >= 50000;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.maxCombo as number) ?? 0) >= 30;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.bricksDestroyed as number) ?? 0) >= 500;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.levelsCleared as number) ?? 0) >= 25;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.score as number) ?? 0) >= 100000;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.maxCombo as number) ?? 0) >= 50;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.levelsCleared as number) ?? 0) >= 30;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.score as number) ?? 0) >= 200000;
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
      if (ctx.gameId !== "brick_breaker") return false;
      return ((ctx.performanceMetrics?.powerupsUsed as number) ?? 0) >= 50;
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
      if (ctx.gameId !== "crazy_eights") return false;
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
      if (ctx.gameId !== "crazy_eights") return false;
      return ((ctx.performanceMetrics?.wildsPlayed as number) ?? 0) >= 10;
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
      if (ctx.gameId !== "crazy_eights") return false;
      return ((ctx.performanceMetrics?.crazyCalls as number) ?? 0) >= 1;
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
      if (ctx.gameId !== "crazy_eights") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      return ((ctx.performanceMetrics?.maxHandSize as number) ?? 0) >= 10;
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
      if (ctx.gameId !== "crazy_eights") return false;
      return ((ctx.performanceMetrics?.drawsStacked as number) ?? 0) >= 1;
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
      if (ctx.gameId !== "crazy_eights") return false;
      return ((ctx.performanceMetrics?.colorChanges as number) ?? 0) >= 5;
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
      if (ctx.gameId !== "crazy_eights") return false;
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
      if (ctx.gameId !== "crazy_eights") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      return ((ctx.performanceMetrics?.turnCount as number) ?? 999) <= 8;
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
      if (ctx.gameId !== "crazy_eights") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
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
      if (ctx.gameId !== "crazy_eights") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      const opponents = ctx.scoreboard.filter((e) => e.uid !== ctx.uid);
      return opponents.every(
        (e) =>
          (((e as unknown as Record<string, unknown>)?.cardsLeft as number) ??
            0) >= 5,
      );
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
      if (ctx.gameId !== "crazy_eights") return false;
      return ((ctx.performanceMetrics?.challengesWon as number) ?? 0) >= 1;
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
      if (ctx.gameId !== "crazy_eights") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      return ((ctx.performanceMetrics?.cardsDrawn as number) ?? 1) === 0;
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
      if (ctx.gameId !== "crazy_eights") return false;
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
      if (ctx.gameId !== "crazy_eights") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      return ((ctx.performanceMetrics?.maxPointDeficit as number) ?? 0) >= 100;
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
      if (ctx.gameId !== "crazy_eights") return false;
      return (ctx.pbStats?.totalWins ?? 0) >= 25;
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
export async function evaluateAchievementsV4(
  db: FirebaseFirestore.Firestore,
  session: GameSessionV4,
  result: Omit<GameResultV4, "achievementUnlocks">,
): Promise<AchievementUnlock[]> {
  const unlocks: AchievementUnlock[] = [];
  const now = admin.firestore.Timestamp.now();

  for (const entry of result.scoreboard) {
    const uid = entry.uid;

    // Fetch per-game PB stats (totalPlays, totalWins)
    let pbStats: { totalPlays: number; totalWins: number } | null = null;
    try {
      const pbRef = db
        .collection("Users")
        .doc(uid)
        .collection(COLLECTIONS.GAME_PB)
        .doc(session.gameId);
      const pbSnap = await pbRef.get();
      if (pbSnap.exists) {
        const data = pbSnap.data()!;
        pbStats = {
          totalPlays: data.totalPlays ?? 0,
          totalWins: data.totalWins ?? 0,
        };
      }
    } catch {
      // Ignore read failures — stats will be null
    }

    // Fetch global stats (gamesPlayed, gamesWon)
    let globalStats: { gamesPlayed: number; gamesWon: number } | null = null;
    try {
      const statsRef = db
        .collection("Users")
        .doc(uid)
        .collection("UserStatsCache")
        .doc("stats");
      const statsSnap = await statsRef.get();
      if (statsSnap.exists) {
        const data = statsSnap.data()!;
        globalStats = {
          gamesPlayed: data.gamesPlayed ?? 0,
          gamesWon: data.gamesWon ?? 0,
        };
      }
    } catch {
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
    } else {
      pbStats = { totalPlays: 1, totalWins: isWinner ? 1 : 0 };
    }
    if (globalStats) {
      globalStats = {
        gamesPlayed: globalStats.gamesPlayed + 1,
        gamesWon: globalStats.gamesWon + (isWinner ? 1 : 0),
      };
    } else {
      globalStats = { gamesPlayed: 1, gamesWon: isWinner ? 1 : 0 };
    }

    // Fetch already-earned achievements for this user
    const earnedSet = new Set<string>();
    try {
      const achievementsSnap = await db
        .collection("Users")
        .doc(uid)
        .collection("Achievements")
        .get();
      for (const doc of achievementsSnap.docs) {
        earnedSet.add(doc.id);
      }
    } catch {
      // Ignore — treat as empty
    }

    const ctx: EvaluationContext = {
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
      if (earnedSet.has(def.type)) continue;

      try {
        if (def.evaluate(ctx)) {
          // Batch achievement + wallet writes for atomicity
          const batch = db.batch();

          // Write achievement doc
          const achievementRef = db
            .collection("Users")
            .doc(uid)
            .collection("Achievements")
            .doc(def.type);
          batch.set(achievementRef, {
            type: def.type,
            name: def.name,
            description: def.description,
            sectionId: def.sectionId,
            difficulty: def.difficulty,
            tokenReward: def.tokenReward,
            earnedAt: now,
            gameId: session.gameId,
            sessionId: result.sessionId,
            ...(def.badgeId ? { badgeId: def.badgeId } : {}),
          });

          // Grant token reward
          if (def.tokenReward > 0) {
            const walletRef = db.collection("Wallets").doc(uid);
            batch.set(
              walletRef,
              {
                tokensBalance: admin.firestore.FieldValue.increment(
                  def.tokenReward,
                ),
                totalEarned: admin.firestore.FieldValue.increment(
                  def.tokenReward,
                ),
              },
              { merge: true },
            );
          }

          await batch.commit();

          unlocks.push({
            uid,
            achievementType: def.type,
            ...(def.badgeId ? { badgeId: def.badgeId } : {}),
            earnedAt: now as unknown as TimestampLike,
          });

          console.log(
            `[achievementsV4] ${uid} unlocked "${def.type}" (+${def.tokenReward} tokens) in session ${result.sessionId}`,
          );
        }
      } catch (err) {
        console.error(
          `[achievementsV4] Error evaluating "${def.type}" for ${uid}:`,
          err,
        );
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
export function getAchievementTypesForSection(sectionId: string): string[] {
  return GAME_ACHIEVEMENTS.filter((a) => a.sectionId === sectionId).map(
    (a) => a.type,
  );
}

/**
 * Get the section definition by sectionId.
 */
export function getSectionDef(
  sectionId: string,
): AchievementSectionDef | undefined {
  return ACHIEVEMENT_SECTIONS.find((s) => s.sectionId === sectionId);
}

/**
 * Get all achievement definitions (for client-side rendering).
 */
export function getAllAchievementDefs(): Array<{
  type: string;
  name: string;
  description: string;
  sectionId: string;
  difficulty: AchievementDifficulty;
  tokenReward: number;
  badgeId?: string;
}> {
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
