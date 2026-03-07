/**
 * Games V4 — Solitaire Klondike Adapter Unit Tests
 *
 * Tests the pure game logic:
 * - Deck integrity (52 unique cards)
 * - Deal invariants (tableau shape, stock count, foundations empty)
 * - Move validation (all move types)
 * - Scoring mechanics
 * - Win detection
 * - Stuck/terminal detection
 * - Undo
 * - Auto-complete eligibility
 * - No card duplication or loss across moves
 * - Outcome computation
 * - Performance metrics extraction
 * - Deterministic seeded shuffle
 */

import solitaireKlondikeAdapter, {
  buildDeck,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  cardColor,
  cardRank,
  cardRankValue,
  cardSuit,
  cardSuitName,
  computeAutoCompleteEligibility,
  dealInitialKlondikeState,
  findAnyLegalMove,
  isTerminalStuckState,
  isValidAlternatingDescendingRun,
  shuffleDeck,
  type CardCode,
  type SolitaireState,
} from "@/gamesV4/adapters/solitaireKlondike";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS = [{ uid: "solo", slotIndex: 0 }];

function makeCtx() {
  return {
    uid: "solo",
    turnOrder: ["solo"],
    currentTurnIndex: 0,
    settings: {},
  };
}

/** Collect all cards from a SolitaireState into an array. */
function allCards(state: SolitaireState): CardCode[] {
  const cards: CardCode[] = [];
  // Stock
  cards.push(...state.stock);
  // Waste
  cards.push(...state.waste);
  // Foundations
  for (const suit of ["clubs", "diamonds", "hearts", "spades"] as const) {
    cards.push(...state.foundations[suit]);
  }
  // Tableau
  for (const col of state.tableau) {
    cards.push(...col.down, ...col.up);
  }
  return cards;
}

function submitMove(state: SolitaireState, move: Record<string, unknown>) {
  return solitaireKlondikeAdapter.validateMove!(
    state as unknown as Record<string, unknown>,
    {},
    move,
    makeCtx(),
  );
}

// =============================================================================
// Tests — Card Helpers
// =============================================================================

describe("Solitaire Klondike — Card Helpers", () => {
  it("cardSuit extracts the suit letter", () => {
    expect(cardSuit("AS")).toBe("S");
    expect(cardSuit("10H")).toBe("H");
    expect(cardSuit("QC")).toBe("C");
    expect(cardSuit("KD")).toBe("D");
  });

  it("cardSuitName extracts the full suit name", () => {
    expect(cardSuitName("AS")).toBe("spades");
    expect(cardSuitName("10H")).toBe("hearts");
    expect(cardSuitName("QC")).toBe("clubs");
    expect(cardSuitName("KD")).toBe("diamonds");
  });

  it("cardRank extracts the rank", () => {
    expect(cardRank("AS")).toBe("A");
    expect(cardRank("10H")).toBe("10");
    expect(cardRank("QC")).toBe("Q");
    expect(cardRank("2D")).toBe("2");
  });

  it("cardRankValue returns correct numeric values", () => {
    expect(cardRankValue("AS")).toBe(1);
    expect(cardRankValue("2H")).toBe(2);
    expect(cardRankValue("10C")).toBe(10);
    expect(cardRankValue("JD")).toBe(11);
    expect(cardRankValue("QS")).toBe(12);
    expect(cardRankValue("KH")).toBe(13);
  });

  it("cardColor identifies red/black correctly", () => {
    expect(cardColor("AS")).toBe("black");
    expect(cardColor("AC")).toBe("black");
    expect(cardColor("AH")).toBe("red");
    expect(cardColor("AD")).toBe("red");
  });

  it("canPlaceOnTableau validates alternating color + descending rank", () => {
    // Red 6 on black 7: valid
    expect(canPlaceOnTableau("6H", "7S")).toBe(true);
    expect(canPlaceOnTableau("6D", "7C")).toBe(true);
    // Same color: invalid
    expect(canPlaceOnTableau("6H", "7D")).toBe(false);
    // Not descending: invalid
    expect(canPlaceOnTableau("8H", "7S")).toBe(false);
    // King on empty: valid (null target)
    expect(canPlaceOnTableau("KH", null)).toBe(true);
    // Non-king on empty: invalid
    expect(canPlaceOnTableau("QH", null)).toBe(false);
  });

  it("canPlaceOnFoundation validates same suit + ascending rank", () => {
    // Ace on empty: valid
    expect(canPlaceOnFoundation("AS", null)).toBe(true);
    // 2 on Ace same suit: valid
    expect(canPlaceOnFoundation("2S", "AS")).toBe(true);
    // 2 on Ace different suit: invalid
    expect(canPlaceOnFoundation("2H", "AS")).toBe(false);
    // Non-ace on empty: invalid
    expect(canPlaceOnFoundation("2S", null)).toBe(false);
    // 3 on Ace: invalid (must be consecutive)
    expect(canPlaceOnFoundation("3S", "AS")).toBe(false);
  });

  it("isValidAlternatingDescendingRun checks a run of cards", () => {
    expect(isValidAlternatingDescendingRun(["8S", "7H", "6C"])).toBe(true);
    expect(isValidAlternatingDescendingRun(["8S", "7C", "6H"])).toBe(false); // 8S black, 7C black
    expect(isValidAlternatingDescendingRun(["8S"])).toBe(true); // single card
    expect(isValidAlternatingDescendingRun([])).toBe(true); // empty
  });
});

// =============================================================================
// Tests — Deck
// =============================================================================

describe("Solitaire Klondike — Deck", () => {
  it("buildDeck produces exactly 52 unique cards", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
  });

  it("deck contains all 4 suits × 13 ranks", () => {
    const deck = buildDeck();
    const suits = new Set(deck.map(cardSuit));
    expect(suits.size).toBe(4);

    for (const s of ["S", "H", "D", "C"]) {
      const ofSuit = deck.filter((c) => cardSuit(c) === s);
      expect(ofSuit).toHaveLength(13);
    }
  });

  it("shuffleDeck is deterministic for the same seed", () => {
    const d1 = shuffleDeck(buildDeck(), 42);
    const d2 = shuffleDeck(buildDeck(), 42);
    expect(d1).toEqual(d2);
  });

  it("shuffleDeck produces different orders for different seeds", () => {
    const d1 = shuffleDeck(buildDeck(), 42);
    const d2 = shuffleDeck(buildDeck(), 99);
    // Extremely unlikely to be equal
    expect(d1).not.toEqual(d2);
  });
});

// =============================================================================
// Tests — Deal Initial State
// =============================================================================

describe("Solitaire Klondike — dealInitialKlondikeState", () => {
  const state = dealInitialKlondikeState(12345);

  it("has 7 tableau columns with correct face-down counts", () => {
    expect(state.tableau).toHaveLength(7);
    for (let i = 0; i < 7; i++) {
      expect(state.tableau[i].down).toHaveLength(i);
      expect(state.tableau[i].up).toHaveLength(1);
    }
  });

  it("deals exactly 28 cards to tableau (7+1 pattern)", () => {
    let count = 0;
    for (const col of state.tableau) {
      count += col.down.length + col.up.length;
    }
    expect(count).toBe(28);
  });

  it("puts remaining 24 cards in stock", () => {
    expect(state.stock).toHaveLength(24);
  });

  it("starts with empty waste", () => {
    expect(state.waste).toHaveLength(0);
  });

  it("starts with empty foundations", () => {
    for (const suit of ["clubs", "diamonds", "hearts", "spades"] as const) {
      expect(state.foundations[suit]).toHaveLength(0);
    }
  });

  it("has score 0 and move count 0", () => {
    expect(state.score).toBe(0);
    expect(state.moveCount).toBe(0);
  });

  it("contains exactly 52 unique cards total", () => {
    const cards = allCards(state);
    expect(cards).toHaveLength(52);
    expect(new Set(cards).size).toBe(52);
  });

  it("is not completed", () => {
    expect(state.completed).toBe(false);
  });
});

// =============================================================================
// Tests — Adapter Metadata
// =============================================================================

describe("Solitaire Klondike Adapter — metadata", () => {
  it("has correct classification", () => {
    expect(solitaireKlondikeAdapter.gameId).toBe("solitaire_klondike");
    expect(solitaireKlondikeAdapter.runtimeType).toBe("solo");
    expect(solitaireKlondikeAdapter.maxPlayers).toBe(1);
    expect(solitaireKlondikeAdapter.minPlayers).toBe(1);
    expect(solitaireKlondikeAdapter.supportsSpectate).toBe(false);
  });
});

// =============================================================================
// Tests — createInitialPublicState
// =============================================================================

describe("Solitaire Klondike Adapter — createInitialPublicState", () => {
  it("returns a valid solitaire state", () => {
    const state = solitaireKlondikeAdapter.createInitialPublicState(
      PLAYERS,
      {},
    ) as unknown as SolitaireState;

    expect(state.tableau).toHaveLength(7);
    expect(state.stock.length + state.waste.length).toBe(24);
    expect(state.score).toBe(0);

    const cards = allCards(state);
    expect(cards).toHaveLength(52);
    expect(new Set(cards).size).toBe(52);
  });
});

// =============================================================================
// Tests — Move Validation
// =============================================================================

describe("Solitaire Klondike Adapter — validateMove", () => {
  let state: SolitaireState;

  beforeEach(() => {
    state = dealInitialKlondikeState(42);
  });

  describe("deal_stock", () => {
    it("deals 3 cards from stock to waste", () => {
      const result = submitMove(state, { type: "deal_stock" });
      expect(result.ok).toBe(true);
      const next = result.nextPublicState as unknown as SolitaireState;
      expect(next.waste.length).toBe(3);
      expect(next.stock.length).toBe(21);
      expect(next.moveCount).toBe(1);
    });

    it("deals fewer cards when stock has < 3", () => {
      // Manually set stock to 2 cards to simulate a partial-deal scenario
      const twoCards = state.stock.slice(0, 2);
      state.stock = twoCards;
      const result = submitMove(state, { type: "deal_stock" });
      expect(result.ok).toBe(true);
      const next = result.nextPublicState as unknown as SolitaireState;
      expect(next.stock).toHaveLength(0);
      expect(next.waste.length).toBe(2);
    });

    it("fails when stock is empty", () => {
      // Empty the stock completely
      while (state.stock.length > 0) {
        const r = submitMove(state, { type: "deal_stock" });
        if (r.ok && r.nextPublicState) {
          state = r.nextPublicState as unknown as SolitaireState;
        }
      }
      const result = submitMove(state, { type: "deal_stock" });
      expect(result.ok).toBe(false);
    });

    it("preserves all 52 cards after dealing", () => {
      const result = submitMove(state, { type: "deal_stock" });
      expect(result.ok).toBe(true);
      const next = result.nextPublicState as unknown as SolitaireState;
      const cards = allCards(next);
      expect(cards).toHaveLength(52);
      expect(new Set(cards).size).toBe(52);
    });
  });

  describe("recycle_stock", () => {
    it("fails when waste is empty", () => {
      const result = submitMove(state, { type: "recycle_stock" });
      expect(result.ok).toBe(false);
    });

    it("moves waste back to stock (reversed)", () => {
      // Deal some cards first
      let s = state;
      const r1 = submitMove(s, { type: "deal_stock" });
      s = r1.nextPublicState as unknown as SolitaireState;

      // Empty stock completely
      while (s.stock.length > 0) {
        const r = submitMove(s, { type: "deal_stock" });
        if (r.ok && r.nextPublicState) {
          s = r.nextPublicState as unknown as SolitaireState;
        }
      }

      const wasteLen = s.waste.length;
      expect(wasteLen).toBeGreaterThan(0);

      const result = submitMove(s, { type: "recycle_stock" });
      expect(result.ok).toBe(true);
      const next = result.nextPublicState as unknown as SolitaireState;
      expect(next.stock).toHaveLength(wasteLen);
      expect(next.waste).toHaveLength(0);
      expect(next.recycleCount).toBeGreaterThan(s.recycleCount);
    });

    it("applies -20 score penalty on recycle", () => {
      let s = state;
      // Deal all from stock
      while (s.stock.length > 0) {
        const r = submitMove(s, { type: "deal_stock" });
        if (r.ok && r.nextPublicState) {
          s = r.nextPublicState as unknown as SolitaireState;
        }
      }
      const scoreBefore = s.score;
      const result = submitMove(s, { type: "recycle_stock" });
      expect(result.ok).toBe(true);
      const next = result.nextPublicState as unknown as SolitaireState;
      expect(next.score).toBe(scoreBefore - 20);
    });

    it("preserves all 52 cards after recycling", () => {
      let s = state;
      while (s.stock.length > 0) {
        const r = submitMove(s, { type: "deal_stock" });
        if (r.ok && r.nextPublicState) {
          s = r.nextPublicState as unknown as SolitaireState;
        }
      }
      const result = submitMove(s, { type: "recycle_stock" });
      expect(result.ok).toBe(true);
      const next = result.nextPublicState as unknown as SolitaireState;
      const cards = allCards(next);
      expect(cards).toHaveLength(52);
      expect(new Set(cards).size).toBe(52);
    });
  });

  describe("unknown move type", () => {
    it("rejects unknown move type", () => {
      const result = submitMove(state, { type: "fly_away" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Unknown");
    });
  });

  describe("completed game", () => {
    it("rejects moves when game is completed", () => {
      const s = { ...state, completed: true };
      const result = submitMove(s as SolitaireState, { type: "deal_stock" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("completed");
    });
  });

  describe("undo", () => {
    it("fails when undo stack is empty", () => {
      const result = submitMove(state, { type: "undo" });
      expect(result.ok).toBe(false);
    });

    it("reverts the previous move", () => {
      // Do a deal
      const r1 = submitMove(state, { type: "deal_stock" });
      expect(r1.ok).toBe(true);
      const after = r1.nextPublicState as unknown as SolitaireState;
      expect(after.waste.length).toBeGreaterThan(0);

      // Undo
      const r2 = submitMove(after, { type: "undo" });
      expect(r2.ok).toBe(true);
      const reverted = r2.nextPublicState as unknown as SolitaireState;
      expect(reverted.waste).toHaveLength(0);
      expect(reverted.stock).toHaveLength(state.stock.length);
    });

    it("preserves all 52 cards after undo", () => {
      const r1 = submitMove(state, { type: "deal_stock" });
      const after = r1.nextPublicState as unknown as SolitaireState;
      const r2 = submitMove(after, { type: "undo" });
      expect(r2.ok).toBe(true);
      const reverted = r2.nextPublicState as unknown as SolitaireState;
      const cards = allCards(reverted);
      expect(cards).toHaveLength(52);
      expect(new Set(cards).size).toBe(52);
    });
  });

  describe("turnAdvance is always false", () => {
    it("deal_stock returns turnAdvance: false", () => {
      const result = submitMove(state, { type: "deal_stock" });
      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(false);
    });
  });
});

// =============================================================================
// Tests — Auto Complete Eligibility
// =============================================================================

describe("Solitaire Klondike — computeAutoCompleteEligibility", () => {
  it("returns false when face-down cards remain", () => {
    const state = dealInitialKlondikeState(42);
    expect(computeAutoCompleteEligibility(state)).toBe(false);
  });

  it("returns true when all face-down cards are revealed and stock/waste are empty", () => {
    // Construct a state with no face-down cards, empty stock/waste
    const state = dealInitialKlondikeState(42);
    state.stock = [];
    state.waste = [];
    for (const col of state.tableau) {
      // Move down cards to up cards
      col.up = [...col.down, ...col.up];
      col.down = [];
    }
    expect(computeAutoCompleteEligibility(state)).toBe(true);
  });
});

// =============================================================================
// Tests — findAnyLegalMove
// =============================================================================

describe("Solitaire Klondike — findAnyLegalMove", () => {
  it("finds a move from a fresh deal (deal_stock is always available)", () => {
    const state = dealInitialKlondikeState(42);
    const move = findAnyLegalMove(state);
    expect(move).not.toBeNull();
  });
});

// =============================================================================
// Tests — isTerminalStuckState
// =============================================================================

describe("Solitaire Klondike — isTerminalStuckState", () => {
  it("returns false for a fresh deal (stock has cards)", () => {
    const state = dealInitialKlondikeState(42);
    expect(isTerminalStuckState(state)).toBe(false);
  });
});

// =============================================================================
// Tests — computeOutcome
// =============================================================================

describe("Solitaire Klondike Adapter — computeOutcome", () => {
  it("returns winner when completed", () => {
    const state = dealInitialKlondikeState(42);
    state.completed = true;
    state.score = 850;

    const outcome = solitaireKlondikeAdapter.computeOutcome!(
      state as unknown as Record<string, unknown>,
      PLAYERS,
    );
    expect(outcome.winnerIds).toEqual(["solo"]);
    expect(outcome.finalScoreboard[0].score).toBe(850);
  });

  it("returns no winners when not completed", () => {
    const state = dealInitialKlondikeState(42);
    state.completed = false;
    state.score = 100;

    const outcome = solitaireKlondikeAdapter.computeOutcome!(
      state as unknown as Record<string, unknown>,
      PLAYERS,
    );
    expect(outcome.winnerIds).toEqual([]);
    expect(outcome.finalScoreboard[0].score).toBe(100);
  });
});

// =============================================================================
// Tests — extractPerformanceMetrics
// =============================================================================

describe("Solitaire Klondike Adapter — extractPerformanceMetrics", () => {
  it("extracts all relevant metrics", () => {
    const state = dealInitialKlondikeState(42);
    state.score = 150;
    state.moveCount = 30;
    state.recycleCount = 2;
    state.faceDownRevealedCount = 10;

    const metrics = solitaireKlondikeAdapter.extractPerformanceMetrics!(
      state as unknown as Record<string, unknown>,
      [{ uid: "solo" }],
    );

    expect(metrics.finalScore).toBe(150);
    expect(metrics.moveCount).toBe(30);
    expect(metrics.recycleCount).toBe(2);
    expect(metrics.faceDownRevealedCount).toBe(10);
    expect(metrics.completed).toBe(false);
    expect(metrics.foundationCount).toBe(0);
    expect(metrics.cardsRemainingOutsideFoundation).toBe(52);
  });
});

// =============================================================================
// Tests — Win Detection Integration
// =============================================================================

describe("Solitaire Klondike — win detection via validateMove", () => {
  it("returns terminal: win when all 52 cards are on foundations after auto_complete_step", () => {
    // Construct a near-win state: 51 cards on foundations, 1 king on tableau
    const state = dealInitialKlondikeState(42);
    state.stock = [];
    state.waste = [];
    state.foundations = {
      clubs: buildSuit("C", 13),
      diamonds: buildSuit("D", 13),
      hearts: buildSuit("H", 13),
      spades: buildSuit("S", 12), // A through Q
    };
    // Put KS as the only remaining card
    state.tableau = Array.from({ length: 7 }, (_, i) =>
      i === 0 ? { down: [], up: ["KS" as CardCode] } : { down: [], up: [] },
    );
    state.canAutoComplete = true;
    state.completed = false;

    const result = submitMove(state, { type: "auto_complete_step" });
    expect(result.ok).toBe(true);
    expect(result.terminal).toBeDefined();
    expect(result.terminal!.type).toBe("win");
    expect(result.terminal!.winnerIds).toEqual(["solo"]);

    const next = result.nextPublicState as unknown as SolitaireState;
    expect(next.completed).toBe(true);
    // 700 bonus added
    expect(next.score).toBeGreaterThanOrEqual(700);
  });
});

// Helper to build a foundation pile up to a certain count
function buildSuit(suit: string, count: number): CardCode[] {
  const ranks = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  return ranks.slice(0, count).map((r) => `${r}${suit}` as CardCode);
}

// =============================================================================
// Tests — Card Integrity Across Multiple Moves
// =============================================================================

describe("Solitaire Klondike — card integrity across many moves", () => {
  it("never duplicates or loses cards across 20 deal/recycle cycles", () => {
    let state = dealInitialKlondikeState(42);

    for (let i = 0; i < 20; i++) {
      if (state.stock.length > 0) {
        const r = submitMove(state, { type: "deal_stock" });
        if (r.ok && r.nextPublicState) {
          state = r.nextPublicState as unknown as SolitaireState;
        }
      } else if (state.waste.length > 0) {
        const r = submitMove(state, { type: "recycle_stock" });
        if (r.ok && r.nextPublicState) {
          state = r.nextPublicState as unknown as SolitaireState;
        }
      }

      const cards = allCards(state);
      expect(cards).toHaveLength(52);
      expect(new Set(cards).size).toBe(52);
    }
  });
});
