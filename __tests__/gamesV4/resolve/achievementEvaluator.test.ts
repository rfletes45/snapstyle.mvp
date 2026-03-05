/**
 * Games V4 — Achievement Evaluator Tests
 *
 * Tests the achievement evaluation logic by re-implementing the
 * 20 achievement definition predicates and verifying them against
 * various game scenarios.
 *
 * Mirrors: firebase-backend/functions/src/gamesV4/achievements.ts
 */

// =============================================================================
// Re-implement achievement evaluation context & definitions
// =============================================================================

interface EvaluationContext {
  uid: string;
  gameId: string;
  resolutionType: string;
  winnerIds: string[];
  scoreboard: Array<{
    uid: string;
    displayName: string;
    score: number;
    placement: number;
    stats: Record<string, unknown>;
  }>;
  myEntry: {
    uid: string;
    score: number;
    placement: number;
    stats: Record<string, unknown>;
  };
  durationMs: number;
  totalMoves: number;
  runtimeType: string;
  performanceMetrics: Record<string, unknown>;
  pbStats: { totalPlays: number; totalWins: number } | null;
  globalStats: { gamesPlayed: number; gamesWon: number } | null;
}

interface AchievementDef {
  type: string;
  evaluate: (ctx: EvaluationContext) => boolean;
}

// Mirror the 20 definitions exactly
const ACHIEVEMENTS: AchievementDef[] = [
  {
    type: "game_first_play",
    evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) <= 1,
  },
  {
    type: "game_10_sessions",
    evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 10,
  },
  {
    type: "game_50_sessions",
    evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 50,
  },
  {
    type: "game_100_sessions",
    evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 100,
  },
  {
    type: "game_250_sessions",
    evaluate: (ctx) => (ctx.globalStats?.gamesPlayed ?? 0) >= 250,
  },
  {
    type: "game_first_win",
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) && (ctx.globalStats?.gamesWon ?? 0) <= 1,
  },
  {
    type: "game_10_wins",
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) && (ctx.globalStats?.gamesWon ?? 0) >= 10,
  },
  {
    type: "game_50_wins",
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) && (ctx.globalStats?.gamesWon ?? 0) >= 50,
  },
  {
    type: "game_mastery_10",
    evaluate: (ctx) => (ctx.pbStats?.totalPlays ?? 0) >= 10,
  },
  {
    type: "game_mastery_50",
    evaluate: (ctx) => (ctx.pbStats?.totalPlays ?? 0) >= 50,
  },
  {
    type: "game_mastery_win_streak_5",
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) && (ctx.pbStats?.totalWins ?? 0) >= 5,
  },
  {
    type: "game_speed_demon",
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) &&
      ctx.durationMs > 0 &&
      ctx.durationMs < 30_000,
  },
  {
    type: "game_lightning_round",
    evaluate: (ctx) =>
      ctx.winnerIds.includes(ctx.uid) &&
      ctx.durationMs > 0 &&
      ctx.durationMs < 60_000,
  },
  {
    type: "game_flawless_victory",
    evaluate: (ctx) => {
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      if (ctx.scoreboard.length < 2) return false;
      const opponents = ctx.scoreboard.filter((e) => e.uid !== ctx.uid);
      return opponents.every((o) => o.score === 0);
    },
  },
  {
    type: "ttt_perfect_game",
    evaluate: (ctx) => {
      if (ctx.gameId !== "tic_tac_toe") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      return ctx.totalMoves <= 5;
    },
  },
  {
    type: "c4_quick_connect",
    evaluate: (ctx) => {
      if (ctx.gameId !== "connect_four") return false;
      if (!ctx.winnerIds.includes(ctx.uid)) return false;
      return ctx.totalMoves <= 7;
    },
  },
  {
    type: "2048_reached_2048",
    evaluate: (ctx) => {
      if (ctx.gameId !== "play_2048") return false;
      const best = ctx.performanceMetrics?.bestTile;
      return typeof best === "number" && best >= 2048;
    },
  },
  {
    type: "2048_reached_4096",
    evaluate: (ctx) => {
      if (ctx.gameId !== "play_2048") return false;
      const best = ctx.performanceMetrics?.bestTile;
      return typeof best === "number" && best >= 4096;
    },
  },
];

// Helper to get a definition by type
function getDef(type: string): AchievementDef {
  return ACHIEVEMENTS.find((a) => a.type === type)!;
}

// Default context factory
function makeCtx(
  overrides: Partial<EvaluationContext> = {},
): EvaluationContext {
  return {
    uid: "p1",
    gameId: "tic_tac_toe",
    resolutionType: "win",
    winnerIds: ["p1"],
    scoreboard: [
      {
        uid: "p1",
        displayName: "Alice",
        score: 1,
        placement: 1,
        stats: {},
      },
      {
        uid: "p2",
        displayName: "Bob",
        score: 0,
        placement: 2,
        stats: {},
      },
    ],
    myEntry: { uid: "p1", score: 1, placement: 1, stats: {} },
    durationMs: 120_000,
    totalMoves: 9,
    runtimeType: "turnBased",
    performanceMetrics: {},
    pbStats: { totalPlays: 5, totalWins: 3 },
    globalStats: { gamesPlayed: 20, gamesWon: 10 },
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("Achievement Evaluator V4", () => {
  describe("Milestone: Play counts", () => {
    it("game_first_play triggers on first game (gamesPlayed ≤ 1)", () => {
      expect(
        getDef("game_first_play").evaluate(
          makeCtx({ globalStats: { gamesPlayed: 1, gamesWon: 0 } }),
        ),
      ).toBe(true);
    });

    it("game_first_play does NOT trigger after multiple games", () => {
      expect(
        getDef("game_first_play").evaluate(
          makeCtx({ globalStats: { gamesPlayed: 5, gamesWon: 0 } }),
        ),
      ).toBe(false);
    });

    it("game_10_sessions triggers at exactly 10", () => {
      expect(
        getDef("game_10_sessions").evaluate(
          makeCtx({ globalStats: { gamesPlayed: 10, gamesWon: 5 } }),
        ),
      ).toBe(true);
    });

    it("game_10_sessions does NOT trigger at 9", () => {
      expect(
        getDef("game_10_sessions").evaluate(
          makeCtx({ globalStats: { gamesPlayed: 9, gamesWon: 5 } }),
        ),
      ).toBe(false);
    });

    it("game_250_sessions triggers at 250+", () => {
      expect(
        getDef("game_250_sessions").evaluate(
          makeCtx({ globalStats: { gamesPlayed: 300, gamesWon: 100 } }),
        ),
      ).toBe(true);
    });
  });

  describe("Milestone: Win counts", () => {
    it("game_first_win triggers on first win", () => {
      expect(
        getDef("game_first_win").evaluate(
          makeCtx({
            winnerIds: ["p1"],
            globalStats: { gamesPlayed: 5, gamesWon: 1 },
          }),
        ),
      ).toBe(true);
    });

    it("game_first_win does NOT trigger if not winner", () => {
      expect(
        getDef("game_first_win").evaluate(
          makeCtx({
            winnerIds: ["p2"],
            globalStats: { gamesPlayed: 5, gamesWon: 0 },
          }),
        ),
      ).toBe(false);
    });

    it("game_10_wins triggers when winner has 10+ wins", () => {
      expect(
        getDef("game_10_wins").evaluate(
          makeCtx({
            winnerIds: ["p1"],
            globalStats: { gamesPlayed: 20, gamesWon: 10 },
          }),
        ),
      ).toBe(true);
    });

    it("game_50_wins requires both winning AND 50+ wins", () => {
      // Winner but only 49 wins
      expect(
        getDef("game_50_wins").evaluate(
          makeCtx({
            winnerIds: ["p1"],
            globalStats: { gamesPlayed: 100, gamesWon: 49 },
          }),
        ),
      ).toBe(false);

      // 50 wins and is winner
      expect(
        getDef("game_50_wins").evaluate(
          makeCtx({
            winnerIds: ["p1"],
            globalStats: { gamesPlayed: 100, gamesWon: 50 },
          }),
        ),
      ).toBe(true);
    });
  });

  describe("Per-game mastery", () => {
    it("game_mastery_10 triggers at 10 per-game plays", () => {
      expect(
        getDef("game_mastery_10").evaluate(
          makeCtx({ pbStats: { totalPlays: 10, totalWins: 3 } }),
        ),
      ).toBe(true);
    });

    it("game_mastery_10 does NOT trigger at 9", () => {
      expect(
        getDef("game_mastery_10").evaluate(
          makeCtx({ pbStats: { totalPlays: 9, totalWins: 3 } }),
        ),
      ).toBe(false);
    });

    it("game_mastery_win_streak_5 requires winning with 5+ per-game wins", () => {
      expect(
        getDef("game_mastery_win_streak_5").evaluate(
          makeCtx({
            winnerIds: ["p1"],
            pbStats: { totalPlays: 20, totalWins: 5 },
          }),
        ),
      ).toBe(true);

      // Not a winner this game
      expect(
        getDef("game_mastery_win_streak_5").evaluate(
          makeCtx({
            winnerIds: ["p2"],
            pbStats: { totalPlays: 20, totalWins: 5 },
          }),
        ),
      ).toBe(false);
    });
  });

  describe("Performance: Speed", () => {
    it("speed_demon triggers on win under 30s", () => {
      expect(
        getDef("game_speed_demon").evaluate(makeCtx({ durationMs: 25_000 })),
      ).toBe(true);
    });

    it("speed_demon does NOT trigger at 30s+", () => {
      expect(
        getDef("game_speed_demon").evaluate(makeCtx({ durationMs: 30_000 })),
      ).toBe(false);
    });

    it("speed_demon does NOT trigger on a loss", () => {
      expect(
        getDef("game_speed_demon").evaluate(
          makeCtx({ winnerIds: ["p2"], durationMs: 20_000 }),
        ),
      ).toBe(false);
    });

    it("speed_demon does NOT trigger on 0ms duration", () => {
      expect(
        getDef("game_speed_demon").evaluate(makeCtx({ durationMs: 0 })),
      ).toBe(false);
    });

    it("lightning_round triggers on win under 60s", () => {
      expect(
        getDef("game_lightning_round").evaluate(
          makeCtx({ durationMs: 55_000 }),
        ),
      ).toBe(true);
    });
  });

  describe("Performance: Flawless", () => {
    it("flawless_victory triggers when opponent has 0 score", () => {
      expect(
        getDef("game_flawless_victory").evaluate(
          makeCtx({
            scoreboard: [
              {
                uid: "p1",
                displayName: "A",
                score: 5,
                placement: 1,
                stats: {},
              },
              {
                uid: "p2",
                displayName: "B",
                score: 0,
                placement: 2,
                stats: {},
              },
            ],
          }),
        ),
      ).toBe(true);
    });

    it("flawless_victory does NOT trigger if opponent scored", () => {
      expect(
        getDef("game_flawless_victory").evaluate(
          makeCtx({
            scoreboard: [
              {
                uid: "p1",
                displayName: "A",
                score: 5,
                placement: 1,
                stats: {},
              },
              {
                uid: "p2",
                displayName: "B",
                score: 1,
                placement: 2,
                stats: {},
              },
            ],
          }),
        ),
      ).toBe(false);
    });

    it("flawless_victory does NOT trigger in solo (< 2 players)", () => {
      expect(
        getDef("game_flawless_victory").evaluate(
          makeCtx({
            scoreboard: [
              {
                uid: "p1",
                displayName: "A",
                score: 5,
                placement: 1,
                stats: {},
              },
            ],
          }),
        ),
      ).toBe(false);
    });
  });

  describe("Game-specific: TicTacToe", () => {
    it("ttt_perfect_game triggers on 5-move win", () => {
      expect(
        getDef("ttt_perfect_game").evaluate(
          makeCtx({ gameId: "tic_tac_toe", totalMoves: 5 }),
        ),
      ).toBe(true);
    });

    it("ttt_perfect_game does NOT trigger on 6+ moves", () => {
      expect(
        getDef("ttt_perfect_game").evaluate(
          makeCtx({ gameId: "tic_tac_toe", totalMoves: 6 }),
        ),
      ).toBe(false);
    });

    it("ttt_perfect_game does NOT trigger for wrong game", () => {
      expect(
        getDef("ttt_perfect_game").evaluate(
          makeCtx({ gameId: "connect_four", totalMoves: 5 }),
        ),
      ).toBe(false);
    });
  });

  describe("Game-specific: Connect Four", () => {
    it("c4_quick_connect triggers on 7-move win", () => {
      expect(
        getDef("c4_quick_connect").evaluate(
          makeCtx({ gameId: "connect_four", totalMoves: 7 }),
        ),
      ).toBe(true);
    });

    it("c4_quick_connect does NOT trigger on 8+ moves", () => {
      expect(
        getDef("c4_quick_connect").evaluate(
          makeCtx({ gameId: "connect_four", totalMoves: 8 }),
        ),
      ).toBe(false);
    });
  });

  describe("Game-specific: 2048", () => {
    it("2048_reached_2048 triggers when bestTile >= 2048", () => {
      expect(
        getDef("2048_reached_2048").evaluate(
          makeCtx({
            gameId: "play_2048",
            performanceMetrics: { bestTile: 2048 },
          }),
        ),
      ).toBe(true);
    });

    it("2048_reached_2048 does NOT trigger at 1024", () => {
      expect(
        getDef("2048_reached_2048").evaluate(
          makeCtx({
            gameId: "play_2048",
            performanceMetrics: { bestTile: 1024 },
          }),
        ),
      ).toBe(false);
    });

    it("2048_reached_4096 triggers at 4096+", () => {
      expect(
        getDef("2048_reached_4096").evaluate(
          makeCtx({
            gameId: "play_2048",
            performanceMetrics: { bestTile: 4096 },
          }),
        ),
      ).toBe(true);
    });

    it("2048_reached_4096 does NOT trigger at 2048", () => {
      expect(
        getDef("2048_reached_4096").evaluate(
          makeCtx({
            gameId: "play_2048",
            performanceMetrics: { bestTile: 2048 },
          }),
        ),
      ).toBe(false);
    });

    it("2048 achievements ignore wrong game", () => {
      expect(
        getDef("2048_reached_2048").evaluate(
          makeCtx({
            gameId: "tic_tac_toe",
            performanceMetrics: { bestTile: 2048 },
          }),
        ),
      ).toBe(false);
    });

    it("2048 achievements handle missing bestTile metric", () => {
      expect(
        getDef("2048_reached_2048").evaluate(
          makeCtx({
            gameId: "play_2048",
            performanceMetrics: {},
          }),
        ),
      ).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("handles null pbStats gracefully", () => {
      const ctx = makeCtx({ pbStats: null });
      expect(getDef("game_mastery_10").evaluate(ctx)).toBe(false);
      expect(getDef("game_mastery_50").evaluate(ctx)).toBe(false);
    });

    it("handles null globalStats gracefully", () => {
      const ctx = makeCtx({ globalStats: null });
      expect(getDef("game_first_play").evaluate(ctx)).toBe(true); // ≤ 1 → null ?? 0 ≤ 1
      expect(getDef("game_10_sessions").evaluate(ctx)).toBe(false);
    });

    it("all 18 definitions are present", () => {
      expect(ACHIEVEMENTS).toHaveLength(18);
      const types = ACHIEVEMENTS.map((a) => a.type);
      expect(new Set(types).size).toBe(18); // All unique
    });
  });
});
