/**
 * Games V4 — Achievement Definitions (Client Mirror)
 *
 * Static definitions of all achievements and sections for client-side rendering.
 * This mirrors the backend definitions in achievements.ts but excludes evaluate
 * functions (server-only). Keep in sync with backend when adding new achievements.
 *
 * @module gamesV4/data/achievementDefinitions
 */

// =============================================================================
// Types
// =============================================================================

export type AchievementDifficulty =
  | "easy"
  | "medium"
  | "hard"
  | "expert"
  | "legendary";

export interface AchievementSectionDef {
  sectionId: string;
  name: string;
  description: string;
  icon: string;
  sectionBadgeId: string;
}

export interface AchievementDef {
  type: string;
  name: string;
  description: string;
  sectionId: string;
  difficulty: AchievementDifficulty;
  tokenReward: number;
  badgeId?: string;
}

// =============================================================================
// Difficulty Metadata
// =============================================================================

export const DIFFICULTY_META: Record<
  AchievementDifficulty,
  { label: string; color: string; icon: string }
> = {
  easy: { label: "Easy", color: "#34C759", icon: "star-outline" },
  medium: { label: "Medium", color: "#FF9500", icon: "star-half-full" },
  hard: { label: "Hard", color: "#FF3B30", icon: "star" },
  expert: { label: "Expert", color: "#AF52DE", icon: "star-shooting" },
  legendary: { label: "Legendary", color: "#FFD700", icon: "crown" },
};

// =============================================================================
// Section Definitions — one section per game + general milestones
// =============================================================================

export const ACHIEVEMENT_SECTIONS: AchievementSectionDef[] = [
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
  // General game milestones
  {
    sectionId: "milestones",
    name: "Milestones",
    description: "Track your overall gaming journey",
    icon: "🌟",
    sectionBadgeId: "section_milestones",
  },
];

/**
 * Legacy section ID → new section ID mapping.
 * Used to resolve earned achievements that were stored with old sectionIds.
 */
export const LEGACY_SECTION_MAP: Record<string, string> = {
  getting_started: "milestones",
  grinder: "milestones",
  game_mastery: "milestones",
  speedster: "tic_tac_toe", // speed achievements moved to TTT
  champion: "tic_tac_toe", // champion feats mapped per-achievement below
  puzzle_master: "play_2048",
};

// =============================================================================
// Achievement Definitions (ordered by section + difficulty)
// =============================================================================

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Tic Tac Toe ───────────────────────────────────────────────────────────
  {
    type: "ttt_perfect_game",
    name: "TicTacToe Master",
    description: "Win TicTacToe in the minimum possible moves (5)",
    sectionId: "tic_tac_toe",
    difficulty: "expert",
    tokenReward: 50,
  },
  {
    type: "game_flawless_victory",
    name: "Flawless Victory",
    description: "Win without your opponent scoring",
    sectionId: "tic_tac_toe",
    difficulty: "hard",
    tokenReward: 30,
  },
  {
    type: "game_speed_demon",
    name: "Speed Demon",
    description: "Win a game in under 30 seconds",
    sectionId: "tic_tac_toe",
    difficulty: "hard",
    tokenReward: 30,
  },

  // ── Connect Four ──────────────────────────────────────────────────────────
  {
    type: "c4_quick_connect",
    name: "Quick Connect",
    description: "Win Connect Four in 7 or fewer moves",
    sectionId: "connect_four",
    difficulty: "expert",
    tokenReward: 50,
  },
  {
    type: "game_lightning_round",
    name: "Lightning Round",
    description: "Win a game in under 60 seconds",
    sectionId: "connect_four",
    difficulty: "medium",
    tokenReward: 15,
  },
  {
    type: "game_mastery_win_streak_5",
    name: "On Fire",
    description: "Win 5+ games of any single game",
    sectionId: "connect_four",
    difficulty: "medium",
    tokenReward: 20,
  },

  // ── 2048 ──────────────────────────────────────────────────────────────────
  {
    type: "2048_reached_2048",
    name: "2048 Club",
    description: "Reach the 2048 tile",
    sectionId: "play_2048",
    difficulty: "hard",
    tokenReward: 40,
  },
  {
    type: "2048_reached_4096",
    name: "Beyond 2048",
    description: "Reach the 4096 tile in 2048",
    sectionId: "play_2048",
    difficulty: "legendary",
    tokenReward: 100,
  },
  {
    type: "game_mastery_10",
    name: "Game Explorer",
    description: "Play 10 rounds of any single game",
    sectionId: "play_2048",
    difficulty: "easy",
    tokenReward: 10,
  },
  {
    type: "game_mastery_50",
    name: "Game Specialist",
    description: "Play 50 rounds of any single game",
    sectionId: "play_2048",
    difficulty: "medium",
    tokenReward: 25,
  },

  // ── Milestones (cross-game) ───────────────────────────────────────────────
  {
    type: "game_first_play",
    name: "First Steps",
    description: "Play your first game",
    sectionId: "milestones",
    difficulty: "easy",
    tokenReward: 5,
    badgeId: "game_first_play",
  },
  {
    type: "game_first_win",
    name: "First Victory",
    description: "Win your first game",
    sectionId: "milestones",
    difficulty: "easy",
    tokenReward: 10,
    badgeId: "game_first_win",
  },
  {
    type: "game_10_sessions",
    name: "Getting Warmed Up",
    description: "Play 10 games",
    sectionId: "milestones",
    difficulty: "easy",
    tokenReward: 10,
  },
  {
    type: "game_50_sessions",
    name: "Dedicated Player",
    description: "Play 50 games",
    sectionId: "milestones",
    difficulty: "medium",
    tokenReward: 25,
  },
  {
    type: "game_100_sessions",
    name: "Centurion Gamer",
    description: "Play 100 games",
    sectionId: "milestones",
    difficulty: "hard",
    tokenReward: 50,
  },
  {
    type: "game_250_sessions",
    name: "Veteran",
    description: "Play 250 games",
    sectionId: "milestones",
    difficulty: "expert",
    tokenReward: 100,
  },
  {
    type: "game_10_wins",
    name: "Rising Champion",
    description: "Win 10 games",
    sectionId: "milestones",
    difficulty: "medium",
    tokenReward: 20,
  },
  {
    type: "game_50_wins",
    name: "Master Competitor",
    description: "Win 50 games",
    sectionId: "milestones",
    difficulty: "hard",
    tokenReward: 50,
  },

  // ── Chess ──────────────────────────────────────────────────────────────────
  {
    type: "chess_first_play",
    name: "First Move",
    description: "Play 1 chess game",
    sectionId: "chess",
    difficulty: "easy",
    tokenReward: 5,
  },
  {
    type: "chess_first_win",
    name: "First Checkmate",
    description: "Win 1 chess game",
    sectionId: "chess",
    difficulty: "easy",
    tokenReward: 10,
  },
  {
    type: "chess_castle_once",
    name: "Safety First",
    description: "Castle in a game",
    sectionId: "chess",
    difficulty: "easy",
    tokenReward: 10,
  },
  {
    type: "chess_capture_game5",
    name: "Piece Collector",
    description: "Capture 5 pieces in one game",
    sectionId: "chess",
    difficulty: "easy",
    tokenReward: 10,
  },
  {
    type: "chess_play_10",
    name: "Club Regular",
    description: "Play 10 chess games",
    sectionId: "chess",
    difficulty: "medium",
    tokenReward: 15,
  },
  {
    type: "chess_win_10",
    name: "Tournament Ready",
    description: "Win 10 chess games",
    sectionId: "chess",
    difficulty: "medium",
    tokenReward: 25,
  },
  {
    type: "chess_promote_once",
    name: "New Queen",
    description: "Promote a pawn",
    sectionId: "chess",
    difficulty: "medium",
    tokenReward: 25,
  },
  {
    type: "chess_en_passant",
    name: "Ghost Capture",
    description: "Perform an en passant capture",
    sectionId: "chess",
    difficulty: "medium",
    tokenReward: 25,
  },
  {
    type: "chess_checkmate",
    name: "Checkmate!",
    description: "Win by checkmate (not resignation)",
    sectionId: "chess",
    difficulty: "hard",
    tokenReward: 30,
  },
  {
    type: "chess_short_mate_12ply",
    name: "Lightning Mate",
    description: "Checkmate in 12 or fewer plies",
    sectionId: "chess",
    difficulty: "hard",
    tokenReward: 40,
  },
  {
    type: "chess_no_piece_lost_win",
    name: "Untouched",
    description: "Win without losing a piece",
    sectionId: "chess",
    difficulty: "hard",
    tokenReward: 50,
  },
  {
    type: "chess_draw_stalemate",
    name: "Stalemate Trap",
    description: "Draw by stalemate",
    sectionId: "chess",
    difficulty: "hard",
    tokenReward: 40,
  },
  {
    type: "chess_scholars_mate",
    name: "Scholar",
    description: "Win by checkmate in 8 or fewer plies",
    sectionId: "chess",
    difficulty: "expert",
    tokenReward: 50,
  },
  {
    type: "chess_threefold_draw",
    name: "Loop Master",
    description: "Draw by threefold repetition",
    sectionId: "chess",
    difficulty: "expert",
    tokenReward: 50,
  },
  {
    type: "chess_underpromotion_win",
    name: "Style Points",
    description: "Underpromote (to N/B/R) and still win that game",
    sectionId: "chess",
    difficulty: "legendary",
    tokenReward: 100,
  },

  // ── Battleship ──────────────────────────────────────────────────────────────
  {
    type: "bs_first_deployment",
    name: "First Deployment",
    description: "Play your first Battleship game",
    sectionId: "battleship",
    difficulty: "easy",
    tokenReward: 5,
  },
  {
    type: "bs_direct_hit",
    name: "Direct Hit",
    description: "Land your first hit",
    sectionId: "battleship",
    difficulty: "easy",
    tokenReward: 5,
  },
  {
    type: "bs_first_sink",
    name: "Sinker",
    description: "Sink your first enemy ship",
    sectionId: "battleship",
    difficulty: "easy",
    tokenReward: 10,
  },
  {
    type: "bs_first_win",
    name: "Admiral's First",
    description: "Win your first Battleship game",
    sectionId: "battleship",
    difficulty: "easy",
    tokenReward: 10,
    badgeId: "bs_first_win",
  },
  {
    type: "bs_clean_sweep",
    name: "Clean Sweep",
    description: "Sink the entire enemy fleet",
    sectionId: "battleship",
    difficulty: "medium",
    tokenReward: 15,
  },
  {
    type: "bs_sharpshooter",
    name: "Sharpshooter",
    description: "Win with 60% or higher accuracy",
    sectionId: "battleship",
    difficulty: "medium",
    tokenReward: 20,
  },
  {
    type: "bs_play_10",
    name: "Sea Dog",
    description: "Play 10 Battleship games",
    sectionId: "battleship",
    difficulty: "medium",
    tokenReward: 15,
  },
  {
    type: "bs_no_mercy",
    name: "No Mercy",
    description: "Win without your opponent sinking any of your ships",
    sectionId: "battleship",
    difficulty: "hard",
    tokenReward: 30,
  },
  {
    type: "bs_fast_victory",
    name: "Fast Victory",
    description: "Win in 25 or fewer turns",
    sectionId: "battleship",
    difficulty: "hard",
    tokenReward: 40,
  },
  {
    type: "bs_salvo_captain",
    name: "Salvo Captain",
    description: "Win a game played in Salvo mode",
    sectionId: "battleship",
    difficulty: "hard",
    tokenReward: 30,
  },
  {
    type: "bs_cold_read",
    name: "Cold Read",
    description: "Win with 75% or higher accuracy",
    sectionId: "battleship",
    difficulty: "expert",
    tokenReward: 50,
  },
  {
    type: "bs_clutch_commander",
    name: "Clutch Commander",
    description: "Win with only 1 ship remaining",
    sectionId: "battleship",
    difficulty: "expert",
    tokenReward: 50,
  },
  {
    type: "bs_streak_admiral",
    name: "Streak Admiral",
    description: "Win 10 Battleship games",
    sectionId: "battleship",
    difficulty: "expert",
    tokenReward: 50,
  },
  {
    type: "bs_perfect_game",
    name: "Perfect Game",
    description: "Win without missing a single shot",
    sectionId: "battleship",
    difficulty: "legendary",
    tokenReward: 100,
  },
  {
    type: "bs_fleet_legend",
    name: "Fleet Legend",
    description: "Win 25 Battleship games",
    sectionId: "battleship",
    difficulty: "legendary",
    tokenReward: 100,
  },

  // ── Brick Breaker ──────────────────────────────────────────────────────────────
  // Easy
  {
    type: "bb_first_play",
    name: "Wall Smasher",
    description: "Play your first Brick Breaker game",
    sectionId: "brick_breaker",
    difficulty: "easy",
    tokenReward: 5,
  },
  {
    type: "bb_clear_1",
    name: "First Wall Down",
    description: "Clear level 1",
    sectionId: "brick_breaker",
    difficulty: "easy",
    tokenReward: 5,
  },
  {
    type: "bb_brick_50",
    name: "Demolition Derby",
    description: "Destroy 50 bricks in one run",
    sectionId: "brick_breaker",
    difficulty: "easy",
    tokenReward: 5,
  },
  {
    type: "bb_score_1000",
    name: "Score Seeker",
    description: "Score 1 000+ in a single run",
    sectionId: "brick_breaker",
    difficulty: "easy",
    tokenReward: 10,
  },
  // Medium
  {
    type: "bb_clear_5",
    name: "Keep Going",
    description: "Clear 5 levels in one run",
    sectionId: "brick_breaker",
    difficulty: "medium",
    tokenReward: 15,
  },
  {
    type: "bb_score_10000",
    name: "Five Figures",
    description: "Score 10 000+ in a single run",
    sectionId: "brick_breaker",
    difficulty: "medium",
    tokenReward: 20,
  },
  {
    type: "bb_combo_15",
    name: "Combo Builder",
    description: "Reach a 15-hit combo",
    sectionId: "brick_breaker",
    difficulty: "medium",
    tokenReward: 20,
  },
  {
    type: "bb_play_10",
    name: "Brick Enthusiast",
    description: "Play 10 Brick Breaker games",
    sectionId: "brick_breaker",
    difficulty: "medium",
    tokenReward: 15,
  },
  // Hard
  {
    type: "bb_clear_15",
    name: "Halfway There",
    description: "Clear 15 levels in one run",
    sectionId: "brick_breaker",
    difficulty: "hard",
    tokenReward: 30,
  },
  {
    type: "bb_score_50000",
    name: "High Roller",
    description: "Score 50 000+ in a single run",
    sectionId: "brick_breaker",
    difficulty: "hard",
    tokenReward: 40,
  },
  {
    type: "bb_combo_30",
    name: "Combo Freak",
    description: "Reach a 30-hit combo",
    sectionId: "brick_breaker",
    difficulty: "hard",
    tokenReward: 40,
  },
  {
    type: "bb_brick_500",
    name: "Wrecking Ball",
    description: "Destroy 500 bricks in one run",
    sectionId: "brick_breaker",
    difficulty: "hard",
    tokenReward: 30,
  },
  // Expert
  {
    type: "bb_clear_25",
    name: "Elite Runner",
    description: "Clear 25 levels in one run",
    sectionId: "brick_breaker",
    difficulty: "expert",
    tokenReward: 50,
  },
  {
    type: "bb_score_100000",
    name: "Six Figures",
    description: "Score 100 000+ in a single run",
    sectionId: "brick_breaker",
    difficulty: "expert",
    tokenReward: 60,
  },
  {
    type: "bb_combo_50",
    name: "Unstoppable",
    description: "Reach a 50-hit combo",
    sectionId: "brick_breaker",
    difficulty: "expert",
    tokenReward: 50,
  },
  // Legendary
  {
    type: "bb_clear_30",
    name: "Last Brick Standing",
    description: "Complete all 30 levels in one run",
    sectionId: "brick_breaker",
    difficulty: "legendary",
    tokenReward: 100,
  },
  {
    type: "bb_score_200000",
    name: "Score Titan",
    description: "Score 200 000+ in a single run",
    sectionId: "brick_breaker",
    difficulty: "legendary",
    tokenReward: 100,
  },
  {
    type: "bb_powerup_master",
    name: "Powerup Hoarder",
    description: "Collect 50+ powerups in one run",
    sectionId: "brick_breaker",
    difficulty: "legendary",
    tokenReward: 100,
  },

  // ── Sketch Party ────────────────────────────────────────────────────────────────

  // ── Crazy 8's ────────────────────────────────────────────────────────────────
  // Easy
  {
    type: "ce_first_hand",
    name: "Deal Me In",
    description: "Play your first Crazy 8's game",
    sectionId: "crazy_eights",
    difficulty: "easy",
    tokenReward: 5,
  },
  {
    type: "ce_first_win",
    name: "Going Out",
    description: "Win your first Crazy 8's hand",
    sectionId: "crazy_eights",
    difficulty: "easy",
    tokenReward: 10,
    badgeId: "ce_first_win",
  },
  {
    type: "ce_wild_thing",
    name: "Wild Thing",
    description: "Play 10 wild cards across all games",
    sectionId: "crazy_eights",
    difficulty: "easy",
    tokenReward: 10,
  },
  {
    type: "ce_crazy_call",
    name: "CRAZY!",
    description: "Successfully call CRAZY! before getting caught",
    sectionId: "crazy_eights",
    difficulty: "easy",
    tokenReward: 5,
  },
  // Medium
  {
    type: "ce_comeback_kid",
    name: "Comeback Kid",
    description: "Win after having 10+ cards in hand",
    sectionId: "crazy_eights",
    difficulty: "medium",
    tokenReward: 20,
  },
  {
    type: "ce_stack_starter",
    name: "Stack Starter",
    description: "Stack a Draw card on top of another Draw card",
    sectionId: "crazy_eights",
    difficulty: "medium",
    tokenReward: 15,
  },
  {
    type: "ce_color_controller",
    name: "Color Controller",
    description: "Change the active color 5 times in one hand",
    sectionId: "crazy_eights",
    difficulty: "medium",
    tokenReward: 15,
  },
  {
    type: "ce_play_10",
    name: "Card Shark",
    description: "Play 10 Crazy 8's games",
    sectionId: "crazy_eights",
    difficulty: "medium",
    tokenReward: 15,
  },
  // Hard
  {
    type: "ce_speedy",
    name: "Speed Demon",
    description: "Win a hand in 8 turns or fewer",
    sectionId: "crazy_eights",
    difficulty: "hard",
    tokenReward: 30,
  },
  {
    type: "ce_table_captain",
    name: "Table Captain",
    description: "Win a 5+ player game",
    sectionId: "crazy_eights",
    difficulty: "hard",
    tokenReward: 40,
  },
  {
    type: "ce_no_mercy",
    name: "No Mercy",
    description: "Win while every opponent has 5+ cards remaining",
    sectionId: "crazy_eights",
    difficulty: "hard",
    tokenReward: 30,
  },
  {
    type: "ce_perfect_timing",
    name: "Perfect Timing",
    description: "Successfully challenge a Wild +4 play",
    sectionId: "crazy_eights",
    difficulty: "hard",
    tokenReward: 40,
  },
  // Expert
  {
    type: "ce_untouchable",
    name: "Untouchable",
    description: "Win without drawing any cards the entire hand",
    sectionId: "crazy_eights",
    difficulty: "expert",
    tokenReward: 50,
  },
  {
    type: "ce_point_farmer",
    name: "Point Farmer",
    description: "Score 200+ points in a single hand",
    sectionId: "crazy_eights",
    difficulty: "expert",
    tokenReward: 60,
  },
  {
    type: "ce_reverse_sweep",
    name: "Reverse Sweep",
    description: "Win a match after trailing by 100+ points",
    sectionId: "crazy_eights",
    difficulty: "expert",
    tokenReward: 50,
  },
  // Legendary
  {
    type: "ce_clutch_crazy",
    name: "Clutch Crazy",
    description: "Win 25 Crazy 8's games",
    sectionId: "crazy_eights",
    difficulty: "legendary",
    tokenReward: 100,
  },

  // ── Sketch Party ────────────────────────────────────────────────────────────────
  {
    type: "sp_first_play",
    name: "Doodle Debut",
    description: "Play your first Sketch Party game",
    sectionId: "sketch_party",
    difficulty: "easy",
    tokenReward: 5,
  },
  {
    type: "sp_first_win",
    name: "Top Artist",
    description: "Win your first Sketch Party game",
    badgeId: "sp_first_win",
    sectionId: "sketch_party",
    difficulty: "easy",
    tokenReward: 10,
  },
  {
    type: "sp_first_correct_guess",
    name: "Sharp Eye",
    description: "Guess a word correctly for the first time",
    sectionId: "sketch_party",
    difficulty: "easy",
    tokenReward: 5,
  },
  {
    type: "sp_play_10",
    name: "Sketch Enthusiast",
    description: "Play 10 Sketch Party games",
    sectionId: "sketch_party",
    difficulty: "medium",
    tokenReward: 15,
  },
  {
    type: "sp_win_5",
    name: "Gallery Champion",
    description: "Win 5 Sketch Party games",
    sectionId: "sketch_party",
    difficulty: "medium",
    tokenReward: 25,
  },
  {
    type: "sp_score_500",
    name: "Point Collector",
    description: "Score 500+ points in a single game",
    sectionId: "sketch_party",
    difficulty: "medium",
    tokenReward: 20,
  },
  {
    type: "sp_speed_guesser",
    name: "Quick Draw",
    description: "Guess correctly within 5 seconds of the drawing starting",
    sectionId: "sketch_party",
    difficulty: "hard",
    tokenReward: 30,
  },
  {
    type: "sp_all_guessed",
    name: "Master Illustrator",
    description: "Have everyone guess your drawing correctly in a turn",
    sectionId: "sketch_party",
    difficulty: "hard",
    tokenReward: 40,
  },
  {
    type: "sp_score_1000",
    name: "Sketch Prodigy",
    description: "Score 1000+ points in a single game",
    sectionId: "sketch_party",
    difficulty: "hard",
    tokenReward: 50,
  },
  {
    type: "sp_win_10",
    name: "Sketch Legend",
    description: "Win 10 Sketch Party games",
    sectionId: "sketch_party",
    difficulty: "expert",
    tokenReward: 50,
  },
  {
    type: "sp_score_2000",
    name: "Canvas King",
    description: "Score 2000+ points in a single game",
    sectionId: "sketch_party",
    difficulty: "expert",
    tokenReward: 75,
  },
  {
    type: "sp_perfect_round",
    name: "Picasso",
    description: "Guess every word and have all your drawings guessed",
    sectionId: "sketch_party",
    difficulty: "legendary",
    tokenReward: 100,
  },
];

// =============================================================================
// Helpers
// =============================================================================

/** Get all achievements for a section. */
export function getDefsForSection(sectionId: string): AchievementDef[] {
  return ACHIEVEMENT_DEFS.filter((a) => a.sectionId === sectionId);
}

/** Get all achievements for a specific gameId (matches sectionId). */
export function getDefsForGame(gameId: string): AchievementDef[] {
  return ACHIEVEMENT_DEFS.filter((a) => a.sectionId === gameId);
}

/** Resolve a possibly-legacy sectionId to the current sectionId. */
export function resolveSection(sectionId: string): string {
  return LEGACY_SECTION_MAP[sectionId] ?? sectionId;
}

/** Check if a sectionId is a per-game section (matches a gameId). */
export function isGameSection(sectionId: string): boolean {
  return [
    "tic_tac_toe",
    "connect_four",
    "play_2048",
    "chess",
    "sketch_party",
    "battleship",
    "brick_breaker",
    "crazy_eights",
  ].includes(sectionId);
}

/** Lookup map by type. */
export const ACHIEVEMENT_BY_TYPE: Record<string, AchievementDef> = {};
for (const def of ACHIEVEMENT_DEFS) {
  ACHIEVEMENT_BY_TYPE[def.type] = def;
}
