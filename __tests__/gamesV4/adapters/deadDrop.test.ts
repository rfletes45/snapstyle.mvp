/**
 * Tests for Dead Drop (Codenames-inspired) V4 game adapter.
 *
 * Covers: board generation, clue validation, guess resolution, turn handoff,
 * game end conditions, hidden-info safety, performance metrics.
 */

import deadDropAdapter from "@/gamesV4/adapters/deadDrop/deadDropAdapter";
import {
  computeMaxGuesses,
  generateBoard,
  resolveGuess,
  validateClue,
} from "@/gamesV4/adapters/deadDrop/deadDropEngine";
import type {
  CardAlignment,
  DeadDropPrivateState,
  DeadDropPublicState,
  PublicCard,
} from "@/gamesV4/adapters/deadDrop/deadDropTypes";
import { DEFAULT_DEAD_DROP_SETTINGS } from "@/gamesV4/adapters/deadDrop/deadDropTypes";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS_4 = [
  { uid: "p0", slotIndex: 0 },
  { uid: "p1", slotIndex: 1 },
  { uid: "p2", slotIndex: 2 },
  { uid: "p3", slotIndex: 3 },
];

function makeSettings(
  overrides: Partial<typeof DEFAULT_DEAD_DROP_SETTINGS> = {},
) {
  return { ...DEFAULT_DEAD_DROP_SETTINGS, ...overrides };
}

function makeCtx(
  uid: string,
  turnOrder: string[],
  currentTurnIndex: number,
  settings = makeSettings(),
) {
  return { uid, turnOrder, currentTurnIndex, settings };
}

function createTestGame(
  settingsOverrides?: Partial<typeof DEFAULT_DEAD_DROP_SETTINGS>,
) {
  const settings = makeSettings(settingsOverrides);
  const pub = deadDropAdapter.createInitialPublicState(
    PLAYERS_4,
    settings as unknown as Record<string, unknown>,
  );
  const priv = deadDropAdapter.createInitialPrivateState!(
    PLAYERS_4,
    settings as unknown as Record<string, unknown>,
  );
  return {
    pub: pub as unknown as DeadDropPublicState,
    priv: priv as unknown as Record<string, DeadDropPrivateState>,
  };
}

// =============================================================================
// Board Generation
// =============================================================================

describe("Dead Drop — Board Generation", () => {
  test("generates 25 cards with unique words", () => {
    const board = generateBoard("classic", "red");
    expect(board.cards).toHaveLength(25);
    const words = board.cards.map((c) => c.word);
    expect(new Set(words).size).toBe(25);
  });

  test("distribution: 9 starting team, 8 other, 7 neutral, 1 assassin", () => {
    const board = generateBoard("classic", "red");
    const counts = { red: 0, blue: 0, neutral: 0, assassin: 0 };
    for (const [, alignment] of Object.entries(board.keyMap)) {
      counts[alignment]++;
    }
    expect(counts.red).toBe(9);
    expect(counts.blue).toBe(8);
    expect(counts.neutral).toBe(7);
    expect(counts.assassin).toBe(1);
  });

  test("blue starting team flips distribution", () => {
    const board = generateBoard("classic", "blue");
    const counts = { red: 0, blue: 0, neutral: 0, assassin: 0 };
    for (const [, alignment] of Object.entries(board.keyMap)) {
      counts[alignment]++;
    }
    expect(counts.blue).toBe(9);
    expect(counts.red).toBe(8);
  });

  test("cards start unrevealed", () => {
    const board = generateBoard("classic", "red");
    for (const card of board.cards) {
      expect(card.revealed).toBe(false);
      expect(card.revealedAs).toBeNull();
    }
  });
});

// =============================================================================
// Team Assignment
// =============================================================================

describe("Dead Drop — Team Assignment", () => {
  test("assigns 4 players to correct roles", () => {
    const { pub } = createTestGame();
    expect(pub.teams).toHaveLength(4);
    const redSm = pub.teams.find(
      (t) => t.team === "red" && t.role === "spymaster",
    );
    const redOp = pub.teams.find(
      (t) => t.team === "red" && t.role === "operative",
    );
    const blueSm = pub.teams.find(
      (t) => t.team === "blue" && t.role === "spymaster",
    );
    const blueOp = pub.teams.find(
      (t) => t.team === "blue" && t.role === "operative",
    );
    expect(redSm?.uid).toBe("p0");
    expect(redOp?.uid).toBe("p1");
    expect(blueSm?.uid).toBe("p2");
    expect(blueOp?.uid).toBe("p3");
  });
});

// =============================================================================
// Initial State
// =============================================================================

describe("Dead Drop — Initial State", () => {
  test("public state has correct structure", () => {
    const { pub } = createTestGame();
    expect(pub.boardSize).toBe(5);
    expect(pub.cards).toHaveLength(25);
    expect(pub.phase).toBe("clue_input");
    expect(pub.turnNumber).toBe(1);
    expect(pub.clueHistory).toHaveLength(0);
    expect(pub.guessHistory).toHaveLength(0);
    expect(pub.winnerTeam).toBeNull();
    expect(pub.moveCount).toBe(0);
    expect(pub.redRemaining + pub.blueRemaining).toBe(17);
    expect(pub.revealedKeyMap).toBeNull();
  });

  test("current turn points to starting team spymaster", () => {
    const { pub } = createTestGame();
    const startSm = pub.teams.find(
      (t) => t.team === pub.startingTeam && t.role === "spymaster",
    );
    expect(pub.currentTurnPlayerId).toBe(startSm!.uid);
    expect(pub.currentTurnRole).toBe("spymaster");
  });
});

// =============================================================================
// Hidden-Info Safety
// =============================================================================

describe("Dead Drop — Hidden Info", () => {
  test("spymasters receive key map", () => {
    const { priv } = createTestGame();
    const smPriv = priv["p0"] as unknown as DeadDropPrivateState;
    expect(smPriv.role).toBe("spymaster");
    expect(smPriv.keyMap).toBeDefined();
    expect(Object.keys(smPriv.keyMap)).toHaveLength(25);
  });

  test("operatives do NOT receive key map", () => {
    const { priv } = createTestGame();
    const opPriv = priv["p1"] as unknown as Record<string, unknown>;
    expect(opPriv.role).toBe("operative");
    expect(opPriv.keyMap).toBeUndefined();
  });

  test("public state cards have no alignment info for unrevealed cards", () => {
    const { pub } = createTestGame();
    for (const card of pub.cards) {
      if (!card.revealed) {
        expect(card.revealedAs).toBeNull();
      }
    }
  });
});

// =============================================================================
// Clue Validation
// =============================================================================

describe("Dead Drop — Clue Validation", () => {
  const cards: PublicCard[] = [
    {
      id: 0,
      word: "AGENT",
      revealed: false,
      revealedAs: null,
      revealedByTeam: null,
      revealedTurn: null,
      revealedFromClueId: null,
    },
    {
      id: 1,
      word: "BERLIN",
      revealed: false,
      revealedAs: null,
      revealedByTeam: null,
      revealedTurn: null,
      revealedFromClueId: null,
    },
    {
      id: 2,
      word: "CASTLE",
      revealed: true,
      revealedAs: "red",
      revealedByTeam: "red",
      revealedTurn: 1,
      revealedFromClueId: 1,
    },
  ];

  test("rejects empty clue", () => {
    expect(validateClue("", 1, cards, "standard", "off").valid).toBe(false);
  });

  test("rejects clue matching a board word", () => {
    expect(validateClue("AGENT", 1, cards, "standard", "off").valid).toBe(
      false,
    );
  });

  test("allows clue matching a revealed word", () => {
    expect(validateClue("CASTLE", 1, cards, "standard", "off").valid).toBe(
      true,
    );
  });

  test("rejects stem match in standard mode", () => {
    expect(validateClue("AGENTS", 1, cards, "standard", "off").valid).toBe(
      false,
    );
  });

  test("allows stem match in relaxed mode", () => {
    expect(validateClue("AGENTS", 1, cards, "relaxed", "off").valid).toBe(true);
  });

  test("rejects count < 1 when advancedClues off", () => {
    expect(validateClue("WORD", 0, cards, "standard", "off").valid).toBe(false);
  });

  test("allows count 0 when advancedClues zero", () => {
    expect(validateClue("WORD", 0, cards, "standard", "zero").valid).toBe(true);
  });

  test("rejects count -1 when advancedClues zero (not zero_unlimited)", () => {
    expect(validateClue("WORD", -1, cards, "standard", "zero").valid).toBe(
      false,
    );
  });

  test("allows count -1 when advancedClues zero_unlimited", () => {
    expect(
      validateClue("WORD", -1, cards, "standard", "zero_unlimited").valid,
    ).toBe(true);
  });

  test("rejects pure number", () => {
    expect(validateClue("42", 1, cards, "standard", "off").valid).toBe(false);
  });

  test("rejects meta/positional clue in standard", () => {
    expect(validateClue("top", 1, cards, "standard", "off").valid).toBe(false);
  });
});

// =============================================================================
// Guess Resolution
// =============================================================================

describe("Dead Drop — Guess Resolution", () => {
  const keyMap: Record<number, CardAlignment> = {
    0: "red",
    1: "blue",
    2: "neutral",
    3: "assassin",
  };

  test("correct guess: own team card", () => {
    const r = resolveGuess(0, "red", keyMap, 3, 2);
    expect(r.outcome).toBe("correct");
    expect(r.turnEnds).toBe(false);
    expect(r.gameEnds).toBe(false);
  });

  test("correct guess: last team card ends game", () => {
    const r = resolveGuess(0, "red", keyMap, 1, 2);
    expect(r.outcome).toBe("correct");
    expect(r.gameEnds).toBe(true);
    expect(r.winnerTeam).toBe("red");
    expect(r.endReason).toBe("all_agents_found");
  });

  test("neutral card ends turn", () => {
    const r = resolveGuess(2, "red", keyMap, 3, 2);
    expect(r.outcome).toBe("neutral");
    expect(r.turnEnds).toBe(true);
    expect(r.gameEnds).toBe(false);
  });

  test("enemy card ends turn", () => {
    const r = resolveGuess(1, "red", keyMap, 3, 2);
    expect(r.outcome).toBe("enemy");
    expect(r.turnEnds).toBe(true);
  });

  test("enemy card: last enemy card ends game with enemy win", () => {
    const r = resolveGuess(1, "red", keyMap, 3, 1);
    expect(r.outcome).toBe("enemy");
    expect(r.gameEnds).toBe(true);
    expect(r.winnerTeam).toBe("blue");
  });

  test("assassin ends game, other team wins", () => {
    const r = resolveGuess(3, "red", keyMap, 3, 2);
    expect(r.outcome).toBe("assassin");
    expect(r.gameEnds).toBe(true);
    expect(r.winnerTeam).toBe("blue");
  });
});

// =============================================================================
// Max Guesses Computation
// =============================================================================

describe("Dead Drop — Max Guesses", () => {
  test("standard count + bonus", () => {
    expect(computeMaxGuesses(3, true)).toBe(4);
    expect(computeMaxGuesses(3, false)).toBe(3);
  });

  test("zero clue with bonus = 1", () => {
    expect(computeMaxGuesses(0, true)).toBe(1);
    expect(computeMaxGuesses(0, false)).toBe(0);
  });

  test("unlimited clue = 25", () => {
    expect(computeMaxGuesses(-1, true)).toBe(25);
  });
});

// =============================================================================
// Adapter: validateMove (submit_clue)
// =============================================================================

describe("Dead Drop Adapter — Submit Clue", () => {
  test("spymaster can submit a valid clue", () => {
    const { pub, priv } = createTestGame();

    // Determine whose turn it is (starting team spymaster)
    const state = pub;
    const uid = state.currentTurnPlayerId;
    const privMap = priv as unknown as Record<string, Record<string, unknown>>;
    const ctx = makeCtx(uid, [uid], 0);

    const result = deadDropAdapter.validateMove!(
      state as unknown as Record<string, unknown>,
      privMap,
      { action: "submit_clue", word: "FORTRESS", count: 2 },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const next = result.nextPublicState as unknown as DeadDropPublicState;
      expect(next.phase).toBe("guessing");
      expect(next.currentClue).toBeDefined();
      expect(next.currentClue!.word).toBe("FORTRESS");
      expect(next.currentClue!.count).toBe(2);
      expect(next.maxGuessesThisTurn).toBe(3); // 2 + 1 bonus
    }
  });

  test("operative cannot submit a clue", () => {
    const { pub, priv } = createTestGame();
    const state = pub;
    const op = state.teams.find(
      (t) => t.team === state.turnTeam && t.role === "operative",
    )!;
    const privMap = priv as unknown as Record<string, Record<string, unknown>>;
    const ctx = makeCtx(op.uid, [op.uid], 0);

    const result = deadDropAdapter.validateMove!(
      state as unknown as Record<string, unknown>,
      privMap,
      { action: "submit_clue", word: "TEST", count: 1 },
      ctx,
    );

    expect(result.ok).toBe(false);
  });
});

// =============================================================================
// Adapter: validateMove (guess_word)
// =============================================================================

describe("Dead Drop Adapter — Guess Word", () => {
  function setupGuessingPhase() {
    const { pub, priv } = createTestGame();
    const state = pub;
    const sm = state.teams.find(
      (t) => t.team === state.turnTeam && t.role === "spymaster",
    )!;
    const privMap = priv as unknown as Record<string, Record<string, unknown>>;

    // Submit a clue first
    const clueResult = deadDropAdapter.validateMove!(
      state as unknown as Record<string, unknown>,
      privMap,
      { action: "submit_clue", word: "FORTRESS", count: 2 },
      makeCtx(sm.uid, [sm.uid], 0),
    );

    expect(clueResult.ok).toBe(true);
    const guessingState = (
      clueResult as { ok: true; nextPublicState: Record<string, unknown> }
    ).nextPublicState as unknown as DeadDropPublicState;

    return { state: guessingState, priv: privMap, sm };
  }

  test("operative can guess an unrevealed card", () => {
    const { state, priv } = setupGuessingPhase();
    const op = state.teams.find(
      (t) => t.team === state.turnTeam && t.role === "operative",
    )!;

    const result = deadDropAdapter.validateMove!(
      state as unknown as Record<string, unknown>,
      priv,
      { action: "guess_word", cardId: 0 },
      makeCtx(op.uid, [op.uid], 0),
    );

    expect(result.ok).toBe(true);
  });

  test("cannot guess already revealed card", () => {
    const { state, priv } = setupGuessingPhase();
    const op = state.teams.find(
      (t) => t.team === state.turnTeam && t.role === "operative",
    )!;

    // Manually reveal a card
    const modState = {
      ...state,
      cards: state.cards.map((c, i) =>
        i === 0 ? { ...c, revealed: true } : c,
      ),
    };

    const result = deadDropAdapter.validateMove!(
      modState as unknown as Record<string, unknown>,
      priv,
      { action: "guess_word", cardId: 0 },
      makeCtx(op.uid, [op.uid], 0),
    );

    expect(result.ok).toBe(false);
  });
});

// =============================================================================
// Adapter: validateMove (stop_guessing)
// =============================================================================

describe("Dead Drop Adapter — Stop Guessing", () => {
  test("operative can stop guessing", () => {
    const { pub, priv } = createTestGame();
    const state = pub;
    const sm = state.teams.find(
      (t) => t.team === state.turnTeam && t.role === "spymaster",
    )!;
    const op = state.teams.find(
      (t) => t.team === state.turnTeam && t.role === "operative",
    )!;
    const privMap = priv as unknown as Record<string, Record<string, unknown>>;

    // Submit clue
    const clueResult = deadDropAdapter.validateMove!(
      state as unknown as Record<string, unknown>,
      privMap,
      { action: "submit_clue", word: "FORTRESS", count: 2 },
      makeCtx(sm.uid, [sm.uid], 0),
    );
    expect(clueResult.ok).toBe(true);
    const guessingState = (
      clueResult as { ok: true; nextPublicState: Record<string, unknown> }
    ).nextPublicState as unknown as DeadDropPublicState;

    // Stop guessing
    const stopResult = deadDropAdapter.validateMove!(
      guessingState as unknown as Record<string, unknown>,
      privMap,
      { action: "stop_guessing" },
      makeCtx(op.uid, [op.uid], 0),
    );

    expect(stopResult.ok).toBe(true);
    if (stopResult.ok) {
      const next = stopResult.nextPublicState as unknown as DeadDropPublicState;
      expect(next.phase).toBe("clue_input");
      expect(next.turnTeam).not.toBe(state.turnTeam);
      expect(next.turnNumber).toBe(2);
    }
  });
});

// =============================================================================
// Adapter: computeOutcome
// =============================================================================

describe("Dead Drop Adapter — Compute Outcome", () => {
  test("produces correct winners and placements", () => {
    const pub: Partial<DeadDropPublicState> = {
      winnerTeam: "red",
      endReason: "all_agents_found",
      teams: [
        { uid: "p0", team: "red", role: "spymaster" },
        { uid: "p1", team: "red", role: "operative" },
        { uid: "p2", team: "blue", role: "spymaster" },
        { uid: "p3", team: "blue", role: "operative" },
      ],
    };
    const outcome = deadDropAdapter.computeOutcome!(
      pub as unknown as Record<string, unknown>,
      PLAYERS_4,
    );

    expect(outcome.winnerIds).toContain("p0");
    expect(outcome.winnerIds).toContain("p1");
    expect(outcome.winnerIds).not.toContain("p2");
    expect(outcome.finalScoreboard).toHaveLength(4);
    const p0Entry = outcome.finalScoreboard.find(
      (e: { uid: string }) => e.uid === "p0",
    )!;
    expect(p0Entry.placement).toBe(1);
    const p2Entry = outcome.finalScoreboard.find(
      (e: { uid: string }) => e.uid === "p2",
    )!;
    expect(p2Entry.placement).toBe(2);
  });
});

// =============================================================================
// Defensive Guards
// =============================================================================

describe("Dead Drop — Defensive Guards", () => {
  test("resolveGuess returns neutral for undefined keyMap entry", () => {
    const keyMap: Record<number, CardAlignment> = { 0: "red" };
    const r = resolveGuess(99, "red", keyMap, 3, 2);
    expect(r.outcome).toBe("neutral");
    expect(r.alignment).toBe("neutral");
    expect(r.turnEnds).toBe(true);
    expect(r.gameEnds).toBe(false);
  });

  test("assignTeams throws for fewer than 4 players", () => {
    const twoPlayers = [
      { uid: "p0", slotIndex: 0 },
      { uid: "p1", slotIndex: 1 },
    ];
    expect(() =>
      deadDropAdapter.createInitialPublicState(
        twoPlayers,
        makeSettings() as unknown as Record<string, unknown>,
      ),
    ).toThrow("requires exactly 4 players");
  });
});

// =============================================================================
// Game Over: revealedKeyMap + board reveal
// =============================================================================

describe("Dead Drop — Game Over Board Reveal", () => {
  test("game-ending guess populates revealedKeyMap", () => {
    const { pub, priv } = createTestGame();
    const state = pub;
    const privMap = priv as unknown as Record<string, Record<string, unknown>>;
    const sm = state.teams.find(
      (t) => t.team === state.turnTeam && t.role === "spymaster",
    )!;
    const op = state.teams.find(
      (t) => t.team === state.turnTeam && t.role === "operative",
    )!;

    // Submit clue
    const clueResult = deadDropAdapter.validateMove!(
      state as unknown as Record<string, unknown>,
      privMap,
      { action: "submit_clue", word: "FORTRESS", count: 9 },
      makeCtx(sm.uid, [sm.uid], 0),
    );
    expect(clueResult.ok).toBe(true);
    let currentState = (
      clueResult as { ok: true; nextPublicState: Record<string, unknown> }
    ).nextPublicState as unknown as DeadDropPublicState;

    // Get the spymaster's key map to find our team's cards
    const smPriv = privMap[sm.uid] as unknown as DeadDropPrivateState;
    const teamCards = currentState.cards.filter(
      (c) => smPriv.keyMap[c.id] === state.turnTeam && !c.revealed,
    );

    // Guess all team cards to trigger game end
    for (let i = 0; i < teamCards.length; i++) {
      const guessResult = deadDropAdapter.validateMove!(
        currentState as unknown as Record<string, unknown>,
        privMap,
        { action: "guess_word", cardId: teamCards[i].id },
        makeCtx(op.uid, [op.uid], 0),
      );
      expect(guessResult.ok).toBe(true);
      if (guessResult.ok && guessResult.nextPublicState) {
        currentState =
          guessResult.nextPublicState as unknown as DeadDropPublicState;
      }
    }

    expect(currentState.phase).toBe("game_over");
    expect(currentState.revealedKeyMap).toBeDefined();
    expect(currentState.revealedKeyMap).not.toBeNull();
    expect(Object.keys(currentState.revealedKeyMap!)).toHaveLength(25);
  });
});

// =============================================================================
// Multi-Guess Exhaustion
// =============================================================================

describe("Dead Drop — Guess Exhaustion", () => {
  test("turn auto-ends when all guesses used", () => {
    const { pub, priv } = createTestGame();
    const state = pub;
    const privMap = priv as unknown as Record<string, Record<string, unknown>>;
    const sm = state.teams.find(
      (t) => t.team === state.turnTeam && t.role === "spymaster",
    )!;
    const op = state.teams.find(
      (t) => t.team === state.turnTeam && t.role === "operative",
    )!;
    const smPriv = privMap[sm.uid] as unknown as DeadDropPrivateState;

    // Submit clue with count=1 (maxGuesses = 2 with bonus)
    const clueResult = deadDropAdapter.validateMove!(
      state as unknown as Record<string, unknown>,
      privMap,
      { action: "submit_clue", word: "FORTRESS", count: 1 },
      makeCtx(sm.uid, [sm.uid], 0),
    );
    expect(clueResult.ok).toBe(true);
    let currentState = (
      clueResult as { ok: true; nextPublicState: Record<string, unknown> }
    ).nextPublicState as unknown as DeadDropPublicState;

    expect(currentState.maxGuessesThisTurn).toBe(2); // 1 + 1 bonus

    // Find 2 correct team cards
    const teamCards = currentState.cards.filter(
      (c) => smPriv.keyMap[c.id] === state.turnTeam && !c.revealed,
    );

    // Guess first (should continue)
    const g1 = deadDropAdapter.validateMove!(
      currentState as unknown as Record<string, unknown>,
      privMap,
      { action: "guess_word", cardId: teamCards[0].id },
      makeCtx(op.uid, [op.uid], 0),
    );
    expect(g1.ok).toBe(true);
    if (g1.ok && g1.nextPublicState) {
      currentState = g1.nextPublicState as unknown as DeadDropPublicState;
    }
    // After 1 correct guess, phase should still be guessing
    expect(currentState.phase).toBe("guessing");

    // Guess second (should auto-end turn since maxGuesses=2 reached)
    const g2 = deadDropAdapter.validateMove!(
      currentState as unknown as Record<string, unknown>,
      privMap,
      { action: "guess_word", cardId: teamCards[1].id },
      makeCtx(op.uid, [op.uid], 0),
    );
    expect(g2.ok).toBe(true);
    if (g2.ok && g2.nextPublicState) {
      currentState = g2.nextPublicState as unknown as DeadDropPublicState;
    }
    // Turn should have auto-ended — either switched teams or game still going
    // (could be game_over if those were the last cards)
    if (currentState.phase !== "game_over") {
      expect(currentState.phase).toBe("clue_input");
      expect(currentState.turnTeam).not.toBe(state.turnTeam);
    }
  });
});

// =============================================================================
// Performance Metrics Extraction
// =============================================================================

describe("Dead Drop — Performance Metrics", () => {
  test("extractPerformanceMetrics returns per-player data", () => {
    const pub: Partial<DeadDropPublicState> = {
      startingTeam: "red",
      turnNumber: 5,
      winnerTeam: "red",
      endReason: "all_agents_found",
      clueHistory: [
        {
          clueId: 1,
          team: "red",
          spymasterUid: "p0",
          word: "TEST",
          count: 2,
          turnNumber: 1,
          timestamp: 0,
        },
      ],
      guessHistory: [
        {
          cardId: 0,
          word: "WORD",
          guessedBy: "p1",
          result: "correct",
          team: "red",
          turnNumber: 1,
          clueId: 1,
          timestamp: 0,
        },
      ],
      teams: [
        { uid: "p0", team: "red", role: "spymaster" },
        { uid: "p1", team: "red", role: "operative" },
        { uid: "p2", team: "blue", role: "spymaster" },
        { uid: "p3", team: "blue", role: "operative" },
      ],
    };

    const result = deadDropAdapter.extractPerformanceMetrics!(
      pub as unknown as Record<string, unknown>,
      PLAYERS_4,
    );

    expect(result.endReason).toBe("all_agents_found");
    expect(result.winnerTeam).toBe("red");
    expect(result.turnsElapsed).toBe(5);
    const perPlayer = result.perPlayer as Record<
      string,
      Record<string, unknown>
    >;
    expect(perPlayer["p0"].won).toBe(true);
    expect(perPlayer["p0"].wonAsSpymaster).toBe(true);
    expect(perPlayer["p0"].cluesGiven).toBe(1);
    expect(perPlayer["p1"].won).toBe(true);
    expect(perPlayer["p1"].wonAsOperative).toBe(true);
    expect(perPlayer["p1"].correctGuesses).toBe(1);
    expect(perPlayer["p2"].won).toBe(false);
    expect(perPlayer["p3"].won).toBe(false);
  });
});

// =============================================================================
// Settings Validation
// =============================================================================

describe("Dead Drop — Settings Validation", () => {
  test("validates known settings", () => {
    const result = deadDropAdapter.validateSettings!({
      clueLegality: "tournament",
      wordPack: "hard",
      turnTimer: "24h",
      rematchSeats: "shuffle",
      allowSpectators: false,
    });
    expect(result.clueLegality).toBe("tournament");
    expect(result.wordPack).toBe("hard");
    expect(result.turnTimer).toBe("24h");
    expect(result.rematchSeats).toBe("shuffle");
    expect(result.allowSpectators).toBe(false);
  });

  test("rejects invalid setting values", () => {
    const result = deadDropAdapter.validateSettings!({
      clueLegality: "invalid",
      wordPack: "xxx",
      turnTimer: "5min",
    });
    expect(result.clueLegality).toBeUndefined();
    expect(result.wordPack).toBeUndefined();
    expect(result.turnTimer).toBeUndefined();
  });
});

// =============================================================================
// Spectator View
// =============================================================================

describe("Dead Drop — Spectator View", () => {
  test("spectator view returns public state without key info", () => {
    const { pub } = createTestGame();
    const spectatorView = deadDropAdapter.getSpectatorView!(
      pub as unknown as Record<string, unknown>,
    ) as unknown as DeadDropPublicState;
    // Spectator view should be the public state (no keyMap in public)
    expect(spectatorView.cards).toHaveLength(25);
    for (const card of spectatorView.cards) {
      if (!card.revealed) {
        expect(card.revealedAs).toBeNull();
      }
    }
    // Confirm no revealedKeyMap leak before game over
    expect(spectatorView.revealedKeyMap).toBeNull();
  });
});
