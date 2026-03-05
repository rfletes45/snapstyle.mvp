// ──────────────────────────────────────────────────────────
// Template: Achievement Definitions for a New Game
//
// You need to add achievements in TWO places:
//   1. Backend:  firebase-backend/functions/src/gamesV4/achievements.ts
//   2. Client:   src/gamesV4/data/achievementDefinitions.ts
//
// This file shows examples for both.
// ──────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════
// BACKEND — firebase-backend/functions/src/gamesV4/achievements.ts
// ═══════════════════════════════════════════════════════════

// 1) Add to ACHIEVEMENT_SECTIONS array:
const MY_GAME_SECTION = {
  sectionId: "my_game",
  title: "My Game",
  icon: "🎮",
  badgeId: "section_my_game", // Awarded when all achievements in section are earned
};

// 2) Add to GAME_ACHIEVEMENTS array:
const MY_GAME_ACHIEVEMENTS_BACKEND = [
  // ── Easy ──────────────────────────────────────────────
  {
    type: "my_game_first_play",
    name: "The Journey Begins",
    description: "Play your first game of My Game",
    sectionId: "my_game",
    difficulty: "easy" as const,
    tokenReward: 5,
    evaluate: (ctx: any) => ctx.gameId === "my_game" && ctx.pb.totalPlays >= 1,
  },
  {
    type: "my_game_first_win",
    name: "First Blood",
    description: "Win your first game of My Game",
    sectionId: "my_game",
    difficulty: "easy" as const,
    tokenReward: 10,
    evaluate: (ctx: any) =>
      ctx.gameId === "my_game" &&
      ctx.result.winnerIds.includes(ctx.uid) &&
      ctx.pb.totalWins >= 1,
  },

  // ── Medium ────────────────────────────────────────────
  {
    type: "my_game_10_games",
    name: "Getting Hooked",
    description: "Play 10 games of My Game",
    sectionId: "my_game",
    difficulty: "medium" as const,
    tokenReward: 15,
    evaluate: (ctx: any) => ctx.gameId === "my_game" && ctx.pb.totalPlays >= 10,
  },
  {
    type: "my_game_10_wins",
    name: "My Game Veteran",
    description: "Win 10 games of My Game",
    sectionId: "my_game",
    difficulty: "medium" as const,
    tokenReward: 25,
    evaluate: (ctx: any) =>
      ctx.gameId === "my_game" &&
      ctx.result.winnerIds.includes(ctx.uid) &&
      ctx.pb.totalWins >= 10,
  },
  {
    type: "my_game_win_streak",
    name: "On a Roll",
    description: "Win 5 games of My Game",
    sectionId: "my_game",
    difficulty: "medium" as const,
    tokenReward: 20,
    evaluate: (ctx: any) =>
      ctx.gameId === "my_game" &&
      ctx.result.winnerIds.includes(ctx.uid) &&
      ctx.pb.totalWins >= 5,
  },

  // ── Hard ──────────────────────────────────────────────
  {
    type: "my_game_50_games",
    name: "Dedicated Player",
    description: "Play 50 games of My Game",
    sectionId: "my_game",
    difficulty: "hard" as const,
    tokenReward: 40,
    evaluate: (ctx: any) => ctx.gameId === "my_game" && ctx.pb.totalPlays >= 50,
  },
  {
    type: "my_game_50_wins",
    name: "Master Competitor",
    description: "Win 50 games of My Game",
    sectionId: "my_game",
    difficulty: "hard" as const,
    tokenReward: 50,
    evaluate: (ctx: any) =>
      ctx.gameId === "my_game" &&
      ctx.result.winnerIds.includes(ctx.uid) &&
      ctx.pb.totalWins >= 50,
  },
  {
    type: "my_game_speed_win",
    name: "Lightning Strike",
    description: "Win a game of My Game in under 60 seconds",
    sectionId: "my_game",
    difficulty: "hard" as const,
    tokenReward: 30,
    evaluate: (ctx: any) =>
      ctx.gameId === "my_game" &&
      ctx.result.winnerIds.includes(ctx.uid) &&
      ctx.durationMs < 60_000,
  },

  // ── Expert ────────────────────────────────────────────
  {
    type: "my_game_perfect",
    name: "Perfect Game",
    description: "Win with the maximum possible score in My Game",
    sectionId: "my_game",
    difficulty: "expert" as const,
    tokenReward: 50,
    evaluate: (ctx: any) => {
      if (ctx.gameId !== "my_game") return false;
      if (!ctx.result.winnerIds.includes(ctx.uid)) return false;
      // TODO: Check for game-specific "perfect" condition
      // e.g., opponent scored 0, or won in minimum moves
      return false;
    },
  },

  // ── Legendary ─────────────────────────────────────────
  {
    type: "my_game_legendary",
    name: "Legendary Achievement",
    description: "Accomplish something extraordinary in My Game",
    sectionId: "my_game",
    difficulty: "legendary" as const,
    tokenReward: 100,
    evaluate: (ctx: any) => {
      if (ctx.gameId !== "my_game") return false;
      // TODO: Check for ultra-rare condition
      return false;
    },
  },
];

// ═══════════════════════════════════════════════════════════
// CLIENT MIRROR — src/gamesV4/data/achievementDefinitions.ts
// ═══════════════════════════════════════════════════════════

// 1) Add to ACHIEVEMENT_SECTIONS array:
const MY_GAME_SECTION_CLIENT = {
  sectionId: "my_game",
  title: "My Game",
  icon: "🎮",
  description: "Master My Game",
  badgeId: "section_my_game",
};

// 2) Add to ACHIEVEMENT_DEFS array (NO evaluate function on client):
const MY_GAME_ACHIEVEMENTS_CLIENT = [
  {
    type: "my_game_first_play",
    name: "The Journey Begins",
    description: "Play your first game of My Game",
    sectionId: "my_game",
    difficulty: "easy" as const,
    tokenReward: 5,
  },
  {
    type: "my_game_first_win",
    name: "First Blood",
    description: "Win your first game of My Game",
    sectionId: "my_game",
    difficulty: "easy" as const,
    tokenReward: 10,
  },
  {
    type: "my_game_10_games",
    name: "Getting Hooked",
    description: "Play 10 games of My Game",
    sectionId: "my_game",
    difficulty: "medium" as const,
    tokenReward: 15,
  },
  {
    type: "my_game_10_wins",
    name: "My Game Veteran",
    description: "Win 10 games of My Game",
    sectionId: "my_game",
    difficulty: "medium" as const,
    tokenReward: 25,
  },
  {
    type: "my_game_win_streak",
    name: "On a Roll",
    description: "Win 5 games of My Game",
    sectionId: "my_game",
    difficulty: "medium" as const,
    tokenReward: 20,
  },
  {
    type: "my_game_50_games",
    name: "Dedicated Player",
    description: "Play 50 games of My Game",
    sectionId: "my_game",
    difficulty: "hard" as const,
    tokenReward: 40,
  },
  {
    type: "my_game_50_wins",
    name: "Master Competitor",
    description: "Win 50 games of My Game",
    sectionId: "my_game",
    difficulty: "hard" as const,
    tokenReward: 50,
  },
  {
    type: "my_game_speed_win",
    name: "Lightning Strike",
    description: "Win a game of My Game in under 60 seconds",
    sectionId: "my_game",
    difficulty: "hard" as const,
    tokenReward: 30,
  },
  {
    type: "my_game_perfect",
    name: "Perfect Game",
    description: "Win with the maximum possible score in My Game",
    sectionId: "my_game",
    difficulty: "expert" as const,
    tokenReward: 50,
  },
  {
    type: "my_game_legendary",
    name: "Legendary Achievement",
    description: "Accomplish something extraordinary in My Game",
    sectionId: "my_game",
    difficulty: "legendary" as const,
    tokenReward: 100,
  },
];

// ═══════════════════════════════════════════════════════════
// NOTES
// ═══════════════════════════════════════════════════════════
// - Backend and client defs MUST stay in sync (type, name, description, sectionId, difficulty, tokenReward)
// - Backend has evaluate() functions; client does NOT
// - The evaluate() context object (ctx) contains:
//     uid: string              — current player UID
//     gameId: string           — the game being resolved
//     session: GameSessionV4   — full session document
//     result: GameResultV4     — computed result (winnerIds, scoreboard, etc.)
//     pb: GamePBV4             — personal best doc (pre-incremented totalPlays/totalWins)
//     statsCache: StatsCache   — UserStatsCache (pre-incremented gamesPlayed/gamesWon)
//     durationMs: number       — game duration in milliseconds
//     totalMoves: number       — total moves in the session
//     publicState: object      — final public state
// - "Pre-incremented" means totalPlays is already +1 BEFORE evaluation runs
// - Achievements are idempotent — already-earned are skipped automatically
// - Token rewards are applied via FieldValue.increment on Wallets/{uid}.tokensBalance
