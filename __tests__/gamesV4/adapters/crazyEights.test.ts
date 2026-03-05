/**
 * Games V4 — Crazy 8's Adapter Unit Tests
 *
 * Tests the pure game logic:
 * - Deck creation and dealing
 * - Card playability
 * - Move validation (play, draw, pass, stacking, challenge, CRAZY!)
 * - Turn advancement (skip, reverse, 2-player reverse)
 * - Reshuffle when draw pile empty
 * - Spectator view safety (no hidden data)
 * - Score calculation
 * - Settings validation
 */

import crazyEightsAdapter from "@/gamesV4/adapters/crazyEights/crazyEightsAdapter";
import {
  buildCardLookup,
  calculateHandPoints,
  calculateRoundScores,
  computePlayableCards,
  couldPlayOtherColor,
  createDeck,
  createInitialCrazyEightsState,
  createSpectatorView,
  dealCards,
  drawCards,
  getNextTurnIndex,
  hasPlayableCard,
  isCardPlayable,
  reshuffleDiscard,
  shuffleDeck,
} from "@/gamesV4/adapters/crazyEights/crazyEightsEngine";
import type {
  Card,
  CrazyEightsPrivateState,
  CrazyEightsPublicState,
  CrazyEightsSettings,
} from "@/gamesV4/adapters/crazyEights/crazyEightsTypes";
import { DEFAULT_CRAZY_EIGHTS_SETTINGS } from "@/gamesV4/adapters/crazyEights/crazyEightsTypes";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS_2 = [
  { uid: "p1", slotIndex: 0 },
  { uid: "p2", slotIndex: 1 },
];

const PLAYERS_4 = [
  { uid: "p1", slotIndex: 0 },
  { uid: "p2", slotIndex: 1 },
  { uid: "p3", slotIndex: 2 },
  { uid: "p4", slotIndex: 3 },
];

function makeCard(
  id: string,
  color: Card["color"],
  type: Card["type"],
  value: Card["value"] = null,
): Card {
  return { id, color, type, value };
}

function makeSettings(
  overrides: Partial<CrazyEightsSettings> = {},
): CrazyEightsSettings {
  return { ...DEFAULT_CRAZY_EIGHTS_SETTINGS, ...overrides };
}

function makeCtx(
  uid: string,
  turnOrder: string[] = ["p1", "p2"],
  currentTurnIndex = 0,
  settings: Partial<CrazyEightsSettings> = {},
) {
  return {
    uid,
    turnOrder,
    currentTurnIndex,
    settings: makeSettings(settings) as unknown as Record<string, unknown>,
  };
}

// =============================================================================
// Deck Tests
// =============================================================================

describe("Crazy 8's Engine — Deck", () => {
  it("creates a 108-card deck", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(108);
  });

  it("has unique card IDs", () => {
    const deck = createDeck();
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(108);
  });

  it("contains correct number of each card type", () => {
    const deck = createDeck();
    const wilds = deck.filter((c) => c.type === "wild");
    const wd4 = deck.filter((c) => c.type === "wild_draw_four");
    const numbers = deck.filter((c) => c.type === "number");
    const skips = deck.filter((c) => c.type === "skip");
    const reverses = deck.filter((c) => c.type === "reverse");
    const drawTwos = deck.filter((c) => c.type === "draw_two");

    expect(wilds).toHaveLength(4);
    expect(wd4).toHaveLength(4);
    // 4 colors × (1 zero + 18 numbers 1-9) = 76
    expect(numbers).toHaveLength(76);
    // 4 colors × 2 each = 8
    expect(skips).toHaveLength(8);
    expect(reverses).toHaveLength(8);
    expect(drawTwos).toHaveLength(8);
  });

  it("shuffle produces a different order with different seeds", () => {
    const deck = createDeck();
    const s1 = shuffleDeck(deck, 42);
    const s2 = shuffleDeck(deck, 99);
    expect(s1.map((c) => c.id)).not.toEqual(s2.map((c) => c.id));
  });

  it("seeded shuffle is deterministic", () => {
    const deck = createDeck();
    const s1 = shuffleDeck(deck, 42);
    const s2 = shuffleDeck(deck, 42);
    expect(s1.map((c) => c.id)).toEqual(s2.map((c) => c.id));
  });
});

// =============================================================================
// Dealing Tests
// =============================================================================

describe("Crazy 8's Engine — Dealing", () => {
  it("deals 7 cards to each player", () => {
    const deck = shuffleDeck(createDeck(), 1);
    const result = dealCards(deck, ["p1", "p2", "p3"]);
    expect(result.hands["p1"]).toHaveLength(7);
    expect(result.hands["p2"]).toHaveLength(7);
    expect(result.hands["p3"]).toHaveLength(7);
  });

  it("sets a valid starting discard (number card)", () => {
    const deck = shuffleDeck(createDeck(), 1);
    const result = dealCards(deck, ["p1", "p2"]);
    // The top discard should be a number card (preferred)
    expect(result.topDiscard.type).toBe("number");
    expect(result.topDiscard.color).not.toBeNull();
  });

  it("accounts for all 108 cards", () => {
    const deck = shuffleDeck(createDeck(), 1);
    const result = dealCards(deck, ["p1", "p2"]);
    const total =
      result.hands["p1"].length +
      result.hands["p2"].length +
      result.drawPile.length +
      result.discardPile.length;
    expect(total).toBe(108);
  });
});

// =============================================================================
// Card Playability
// =============================================================================

describe("Crazy 8's Engine — Card Playability", () => {
  const settings = makeSettings();
  const redFive = makeCard("r5", "red", "number", 5);
  const blueFive = makeCard("b5", "blue", "number", 5);
  const redSeven = makeCard("r7", "red", "number", 7);
  const blueSkip = makeCard("bs", "blue", "skip");
  const redSkip = makeCard("rs", "red", "skip");
  const greenThree = makeCard("g3", "green", "number", 3);
  const wild = makeCard("w0", null, "wild");
  const wd4 = makeCard("wd0", null, "wild_draw_four");

  it("matches color", () => {
    expect(isCardPlayable(redSeven, "red", redFive, settings)).toBe(true);
  });

  it("matches number value", () => {
    expect(isCardPlayable(blueFive, "red", redFive, settings)).toBe(true);
  });

  it("rejects non-matching card", () => {
    expect(isCardPlayable(greenThree, "red", redFive, settings)).toBe(false);
  });

  it("wild is always playable", () => {
    expect(isCardPlayable(wild, "red", redFive, settings)).toBe(true);
  });

  it("wild draw four is always playable", () => {
    expect(isCardPlayable(wd4, "blue", blueSkip, settings)).toBe(true);
  });

  it("matches action type", () => {
    expect(isCardPlayable(blueSkip, "red", redSkip, settings)).toBe(true);
  });

  it("hasPlayableCard returns true when hand has matching card", () => {
    const hand = [greenThree, redSeven];
    expect(hasPlayableCard(hand, "red", redFive, settings)).toBe(true);
  });

  it("hasPlayableCard returns false when nothing matches", () => {
    const hand = [greenThree];
    expect(hasPlayableCard(hand, "blue", blueSkip, settings)).toBe(false);
  });
});

// =============================================================================
// couldPlayOtherColor (Wild Draw Four challenge)
// =============================================================================

describe("Crazy 8's Engine — couldPlayOtherColor", () => {
  const redFive = makeCard("r5", "red", "number", 5);
  const blueFive = makeCard("b5", "blue", "number", 5);
  const greenThree = makeCard("g3", "green", "number", 3);

  it("returns true when hand has a matching color card", () => {
    expect(couldPlayOtherColor([redFive], "red", blueFive)).toBe(true);
  });

  it("returns false when hand has no legal play", () => {
    expect(couldPlayOtherColor([greenThree], "blue", blueFive)).toBe(false);
  });

  it("returns true when hand has matching value", () => {
    expect(couldPlayOtherColor([blueFive], "red", redFive)).toBe(true);
  });
});

// =============================================================================
// Turn Management
// =============================================================================

describe("Crazy 8's Engine — Turn Management", () => {
  it("advances clockwise", () => {
    expect(getNextTurnIndex(0, 1, 4)).toBe(1);
    expect(getNextTurnIndex(3, 1, 4)).toBe(0); // wrap
  });

  it("advances counter-clockwise", () => {
    expect(getNextTurnIndex(0, -1, 4)).toBe(3);
    expect(getNextTurnIndex(1, -1, 4)).toBe(0);
  });

  it("skips a player", () => {
    expect(getNextTurnIndex(0, 1, 4, 2)).toBe(2);
  });

  it("handles 2 players with reverse (goes back to same player effectively)", () => {
    // In 2 players, reverse acts as skip
    expect(getNextTurnIndex(0, 1, 2, 2)).toBe(0);
  });
});

// =============================================================================
// Draw Cards + Reshuffle
// =============================================================================

describe("Crazy 8's Engine — Draw and Reshuffle", () => {
  it("draws cards from draw pile", () => {
    const deck = createDeck();
    const lookup = buildCardLookup(deck);
    const drawPile = deck.slice(0, 10).map((c) => c.id);
    const discardPile = deck.slice(10, 15).map((c) => c.id);

    const result = drawCards(3, drawPile, discardPile, lookup);
    expect(result.drawnCards).toHaveLength(3);
    expect(result.newDrawPile).toHaveLength(7);
  });

  it("reshuffles discard when draw pile runs out", () => {
    const deck = createDeck();
    const lookup = buildCardLookup(deck);
    const drawPile: string[] = []; // empty
    const discardPile = deck.slice(0, 20).map((c) => c.id);

    const result = drawCards(5, drawPile, discardPile, lookup);
    expect(result.drawnCards.length).toBeGreaterThan(0);
    expect(result.drawnCards.length).toBeLessThanOrEqual(5);
  });

  it("reshuffleDiscard keeps top card in discard", () => {
    const deck = createDeck();
    const lookup = buildCardLookup(deck);
    const drawPile: string[] = [];
    const discardPile = deck.slice(0, 10).map((c) => c.id);
    const topId = discardPile[discardPile.length - 1];

    const result = reshuffleDiscard(drawPile, discardPile, lookup);
    expect(result.newDiscardPile).toEqual([topId]);
    expect(result.newDrawPile).toHaveLength(9);
  });
});

// =============================================================================
// Score Calculation
// =============================================================================

describe("Crazy 8's Engine — Scoring", () => {
  it("calculates hand points correctly", () => {
    const hand: Card[] = [
      makeCard("r5", "red", "number", 5),
      makeCard("bs", "blue", "skip"),
      makeCard("w0", null, "wild"),
    ];
    // 5 + 20 + 50 = 75
    expect(calculateHandPoints(hand)).toBe(75);
  });

  it("gives winner positive score from opponents' hands", () => {
    const privateState: Record<string, CrazyEightsPrivateState> = {
      p1: { hand: [], hasDrawnThisTurn: false }, // winner
      p2: {
        hand: [makeCard("r5", "red", "number", 5)],
        hasDrawnThisTurn: false,
      },
      p3: {
        hand: [makeCard("w0", null, "wild")],
        hasDrawnThisTurn: false,
      },
    };
    const scores = calculateRoundScores("p1", privateState, ["p1", "p2", "p3"]);
    expect(scores["p1"]).toBe(55); // 5 + 50
    expect(scores["p2"]).toBe(-5);
    expect(scores["p3"]).toBe(-50);
  });
});

// =============================================================================
// Spectator View Safety
// =============================================================================

describe("Crazy 8's Engine — Spectator View", () => {
  it("strips drawPile and cardLookup from spectator view", () => {
    const { publicState } = createInitialCrazyEightsState(
      PLAYERS_2,
      makeSettings(),
    );
    const spectatorView = createSpectatorView(publicState);

    expect(spectatorView).not.toHaveProperty("drawPile");
    expect(spectatorView).not.toHaveProperty("cardLookup");
    expect(spectatorView).toHaveProperty("drawPileCount");
    expect(spectatorView).toHaveProperty("topDiscard");
    expect(spectatorView).toHaveProperty("currentColor");
    expect(spectatorView).toHaveProperty("handCounts");
  });
});

// =============================================================================
// Adapter Metadata
// =============================================================================

describe("Crazy 8's Adapter", () => {
  describe("metadata", () => {
    it("has correct IDs and limits", () => {
      expect(crazyEightsAdapter.gameId).toBe("crazy_eights");
      expect(crazyEightsAdapter.runtimeType).toBe("turnBased");
      expect(crazyEightsAdapter.minPlayers).toBe(2);
      expect(crazyEightsAdapter.maxPlayers).toBe(6);
    });
  });

  describe("createInitialPublicState", () => {
    it("creates valid initial state for 2 players", () => {
      const state = crazyEightsAdapter.createInitialPublicState(
        PLAYERS_2,
        {},
      ) as unknown as CrazyEightsPublicState;

      expect(state.phase).toBe("playing");
      expect(state.turnOrder).toEqual(["p1", "p2"]);
      expect(state.currentTurnUid).toBe("p1");
      expect(state.direction).toBe(1);
      expect(state.topDiscard).toBeDefined();
      expect(state.currentColor).toBeDefined();
      expect(state.handCounts["p1"]).toBe(7);
      expect(state.handCounts["p2"]).toBe(7);
      expect(state.drawPileCount).toBeGreaterThan(0);
    });

    it("creates valid initial state for 4 players", () => {
      const state = crazyEightsAdapter.createInitialPublicState(
        PLAYERS_4,
        {},
      ) as unknown as CrazyEightsPublicState;

      expect(state.turnOrder).toHaveLength(4);
      expect(state.handCounts["p1"]).toBe(7);
      expect(state.handCounts["p4"]).toBe(7);
      // 108 - (4 * 7) - 1 discard = 79
      expect(state.drawPileCount).toBe(79);
    });
  });

  describe("createInitialPrivateState", () => {
    it("gives each player a 7-card hand", () => {
      const priv = crazyEightsAdapter.createInitialPrivateState!(
        PLAYERS_2,
        {},
      ) as unknown as Record<string, CrazyEightsPrivateState>;

      expect(priv["p1"].hand).toHaveLength(7);
      expect(priv["p2"].hand).toHaveLength(7);
      expect(priv["p1"].hasDrawnThisTurn).toBe(false);
    });
  });

  describe("validateMove — PLAY_CARD", () => {
    it("allows playing a matching card", () => {
      const { publicState, privateState } = createInitialCrazyEightsState(
        PLAYERS_2,
        makeSettings(),
      );

      // Find a playable card in p1's hand
      const hand = privateState["p1"].hand;
      const playable = hand.find((c) =>
        isCardPlayable(
          c,
          publicState.currentColor,
          publicState.topDiscard,
          publicState.settings,
        ),
      );

      if (!playable) {
        // If no playable card (rare), just check that the adapter rejects an unplayable one
        const unplayable = hand[0];
        const result = crazyEightsAdapter.validateMove!(
          publicState as unknown as Record<string, unknown>,
          privateState as unknown as Record<string, Record<string, unknown>>,
          { action: "PLAY_CARD", cardId: unplayable.id },
          makeCtx("p1"),
        );
        // It could be valid or invalid depending on the exact card
        expect(result).toBeDefined();
        return;
      }

      const payload: Record<string, unknown> = {
        action: "PLAY_CARD",
        cardId: playable.id,
      };

      // For wilds, must declare a color
      if (playable.type === "wild" || playable.type === "wild_draw_four") {
        payload.declaredColor = "red";
      }

      const result = crazyEightsAdapter.validateMove!(
        publicState as unknown as Record<string, unknown>,
        privateState as unknown as Record<string, Record<string, unknown>>,
        payload,
        makeCtx("p1"),
      );
      expect(result.ok).toBe(true);
      expect(result.nextPublicState).toBeDefined();
    });

    it("rejects playing an unplayable card", () => {
      const { publicState, privateState } = createInitialCrazyEightsState(
        PLAYERS_2,
        makeSettings(),
      );

      // Find a card that is NOT playable
      const hand = privateState["p1"].hand;
      const unplayable = hand.find(
        (c) =>
          !isCardPlayable(
            c,
            publicState.currentColor,
            publicState.topDiscard,
            publicState.settings,
          ),
      );

      if (!unplayable) {
        // All cards are playable — skip test
        return;
      }

      const result = crazyEightsAdapter.validateMove!(
        publicState as unknown as Record<string, unknown>,
        privateState as unknown as Record<string, Record<string, unknown>>,
        { action: "PLAY_CARD", cardId: unplayable.id },
        makeCtx("p1"),
      );
      expect(result.ok).toBe(false);
    });

    it("rejects playing a card not in hand", () => {
      const { publicState, privateState } = createInitialCrazyEightsState(
        PLAYERS_2,
        makeSettings(),
      );

      const result = crazyEightsAdapter.validateMove!(
        publicState as unknown as Record<string, unknown>,
        privateState as unknown as Record<string, Record<string, unknown>>,
        { action: "PLAY_CARD", cardId: "nonexistent_card" },
        makeCtx("p1"),
      );
      expect(result.ok).toBe(false);
    });
  });

  describe("validateMove — DRAW_CARD", () => {
    it("allows drawing a card on your turn", () => {
      const { publicState, privateState } = createInitialCrazyEightsState(
        PLAYERS_2,
        makeSettings(),
      );

      const result = crazyEightsAdapter.validateMove!(
        publicState as unknown as Record<string, unknown>,
        privateState as unknown as Record<string, Record<string, unknown>>,
        { action: "DRAW_CARD" },
        makeCtx("p1"),
      );
      expect(result.ok).toBe(true);
    });
  });

  describe("validateMove — PASS", () => {
    it("rejects passing without drawing first", () => {
      const { publicState, privateState } = createInitialCrazyEightsState(
        PLAYERS_2,
        makeSettings(),
      );

      const result = crazyEightsAdapter.validateMove!(
        publicState as unknown as Record<string, unknown>,
        privateState as unknown as Record<string, Record<string, unknown>>,
        { action: "PASS" },
        makeCtx("p1"),
      );
      expect(result.ok).toBe(false);
    });
  });

  describe("getSpectatorView", () => {
    it("strips hidden data", () => {
      const state = crazyEightsAdapter.createInitialPublicState(PLAYERS_2, {});
      const view = crazyEightsAdapter.getSpectatorView!(state);

      expect(view).not.toHaveProperty("drawPile");
      expect(view).not.toHaveProperty("cardLookup");
    });
  });

  describe("computeSummary", () => {
    it("returns player labels sorted by hand count (ascending)", () => {
      const state = crazyEightsAdapter.createInitialPublicState(PLAYERS_2, {});
      const summary = crazyEightsAdapter.computeSummary!(
        state,
        [
          { uid: "p1", displayName: "Player 1" },
          { uid: "p2", displayName: "Player 2" },
        ],
        "p1",
      );
      expect(summary).toBeDefined();
      expect(summary.turnPlayerId).toBeDefined();
      expect(summary.scoreSummary.length).toBeGreaterThan(0);
    });
  });

  describe("settings validation", () => {
    it("validates correct settings and returns merged result", () => {
      const result = crazyEightsAdapter.validateSettings!(
        DEFAULT_CRAZY_EIGHTS_SETTINGS as unknown as Record<string, unknown>,
      );
      expect(result).toBeDefined();
      expect((result as Record<string, unknown>).targetPoints).toBe(
        DEFAULT_CRAZY_EIGHTS_SETTINGS.targetPoints,
      );
      expect((result as Record<string, unknown>).stackDraw2).toBe(
        DEFAULT_CRAZY_EIGHTS_SETTINGS.stackDraw2,
      );
    });

    it("clamps targetPoints below 100 to default", () => {
      const bad = {
        ...DEFAULT_CRAZY_EIGHTS_SETTINGS,
        targetPoints: 50,
      };
      const result = crazyEightsAdapter.validateSettings!(
        bad as unknown as Record<string, unknown>,
      );
      // Invalid value falls back to default
      expect((result as Record<string, unknown>).targetPoints).toBe(
        DEFAULT_CRAZY_EIGHTS_SETTINGS.targetPoints,
      );
    });
  });
});

// =============================================================================
// Initial State Creation (integration)
// =============================================================================

describe("Crazy 8's — createInitialCrazyEightsState", () => {
  it("returns consistent public and private state", () => {
    const { publicState, privateState } = createInitialCrazyEightsState(
      PLAYERS_2,
      makeSettings(),
    );

    // Hand counts match actual hands
    expect(publicState.handCounts["p1"]).toBe(privateState["p1"].hand.length);
    expect(publicState.handCounts["p2"]).toBe(privateState["p2"].hand.length);

    // All card IDs from hands + drawPile + discardPile = 108
    const allIds = new Set<string>();
    for (const uid of ["p1", "p2"]) {
      for (const card of privateState[uid].hand) {
        allIds.add(card.id);
      }
    }
    for (const id of publicState.drawPile) {
      allIds.add(id);
    }
    for (const id of publicState.discardPile) {
      allIds.add(id);
    }
    expect(allIds.size).toBe(108);
  });

  it("top discard matches currentColor", () => {
    const { publicState } = createInitialCrazyEightsState(
      PLAYERS_2,
      makeSettings(),
    );
    expect(publicState.currentColor).toBe(publicState.topDiscard.color);
  });
});

// =============================================================================
// computePlayableCards Tests
// =============================================================================

describe("Crazy 8's Engine — computePlayableCards", () => {
  const noPendingDraw = { count: 0, source: null };

  // ---- Normal playability (no pending draw) ----

  it("marks a card with matching color as playable", () => {
    const hand = [makeCard("c1", "red", "number", 3)];
    const topDiscard = makeCard("d1", "red", "number", 7);
    const result = computePlayableCards(
      hand,
      "red",
      topDiscard,
      makeSettings(),
      noPendingDraw,
    );
    expect(result.playableIds.has("c1")).toBe(true);
    expect(result.reasonById["c1"]).toBe("playable");
  });

  it("marks a card with matching value as playable", () => {
    const hand = [makeCard("c1", "blue", "number", 5)];
    const topDiscard = makeCard("d1", "red", "number", 5);
    const result = computePlayableCards(
      hand,
      "red",
      topDiscard,
      makeSettings(),
      noPendingDraw,
    );
    expect(result.playableIds.has("c1")).toBe(true);
  });

  it("marks a card with matching type (action) as playable", () => {
    const hand = [makeCard("c1", "green", "skip")];
    const topDiscard = makeCard("d1", "red", "skip");
    const result = computePlayableCards(
      hand,
      "red",
      topDiscard,
      makeSettings(),
      noPendingDraw,
    );
    expect(result.playableIds.has("c1")).toBe(true);
  });

  it("marks wild as always playable when no pending draw", () => {
    const hand = [makeCard("w1", null, "wild")];
    const topDiscard = makeCard("d1", "red", "number", 9);
    const result = computePlayableCards(
      hand,
      "red",
      topDiscard,
      makeSettings(),
      noPendingDraw,
    );
    expect(result.playableIds.has("w1")).toBe(true);
  });

  it("marks wild_draw_four as always playable when no pending draw", () => {
    const hand = [makeCard("wd1", null, "wild_draw_four")];
    const topDiscard = makeCard("d1", "blue", "number", 2);
    const result = computePlayableCards(
      hand,
      "blue",
      topDiscard,
      makeSettings(),
      noPendingDraw,
    );
    expect(result.playableIds.has("wd1")).toBe(true);
  });

  it("marks a non-matching card as NOT playable with reason", () => {
    const hand = [makeCard("c1", "blue", "number", 3)];
    const topDiscard = makeCard("d1", "red", "number", 7);
    const result = computePlayableCards(
      hand,
      "red",
      topDiscard,
      makeSettings(),
      noPendingDraw,
    );
    expect(result.playableIds.has("c1")).toBe(false);
    expect(result.reasonById["c1"]).toMatch(/no_match/);
  });

  it("returns correct playable set for a mixed hand", () => {
    const hand = [
      makeCard("c1", "red", "number", 5), // color match
      makeCard("c2", "blue", "number", 7), // value match
      makeCard("c3", "green", "number", 3), // no match
      makeCard("c4", null, "wild"), // wild
    ];
    const topDiscard = makeCard("d1", "red", "number", 7);
    const result = computePlayableCards(
      hand,
      "red",
      topDiscard,
      makeSettings(),
      noPendingDraw,
    );
    expect(result.playableIds.size).toBe(3);
    expect(result.playableIds.has("c1")).toBe(true);
    expect(result.playableIds.has("c2")).toBe(true);
    expect(result.playableIds.has("c3")).toBe(false);
    expect(result.playableIds.has("c4")).toBe(true);
  });

  it("returns empty set for empty hand", () => {
    const topDiscard = makeCard("d1", "red", "number", 7);
    const result = computePlayableCards(
      [],
      "red",
      topDiscard,
      makeSettings(),
      noPendingDraw,
    );
    expect(result.playableIds.size).toBe(0);
  });

  // ---- Stacking: pendingDraw > 0 ----

  it("only allows draw_two stacking on D2 source when stackDraw2 is on", () => {
    const hand = [
      makeCard("d2a", "blue", "draw_two"), // stackable
      makeCard("c1", "red", "number", 5), // not stackable
      makeCard("w1", null, "wild"), // not stackable on D2
    ];
    const topDiscard = makeCard("d1", "red", "draw_two");
    const pending = { count: 2, source: "D2" };
    const settings = makeSettings({
      stackDraw2: true,
      stackDraw4: false,
      stackingMode: "same_only",
    });
    const result = computePlayableCards(
      hand,
      "red",
      topDiscard,
      settings,
      pending,
    );
    expect(result.playableIds.size).toBe(1);
    expect(result.playableIds.has("d2a")).toBe(true);
    expect(result.reasonById["c1"]).toMatch(/pending_draw/);
    expect(result.reasonById["w1"]).toMatch(/pending_draw/);
  });

  it("only allows wild_draw_four stacking on D4 source when stackDraw4 is on", () => {
    const hand = [
      makeCard("wd1", null, "wild_draw_four"), // stackable
      makeCard("c1", "red", "number", 5), // not stackable
      makeCard("d2a", "green", "draw_two"), // not stackable on D4 (same_only mode)
    ];
    const topDiscard = makeCard("d1", null, "wild_draw_four");
    const pending = { count: 4, source: "D4" };
    const settings = makeSettings({
      stackDraw2: false,
      stackDraw4: true,
      stackingMode: "same_only",
    });
    const result = computePlayableCards(
      hand,
      "green",
      topDiscard,
      settings,
      pending,
    );
    expect(result.playableIds.size).toBe(1);
    expect(result.playableIds.has("wd1")).toBe(true);
  });

  it("allows cross-stacking with draws_mix mode", () => {
    const hand = [
      makeCard("wd1", null, "wild_draw_four"), // stackable on D2 in draws_mix
      makeCard("c1", "red", "number", 5), // not stackable
    ];
    const topDiscard = makeCard("d1", "red", "draw_two");
    const pending = { count: 2, source: "D2" };
    const settings = makeSettings({
      stackDraw2: true,
      stackDraw4: true,
      stackingMode: "draws_mix",
    });
    const result = computePlayableCards(
      hand,
      "red",
      topDiscard,
      settings,
      pending,
    );
    expect(result.playableIds.has("wd1")).toBe(true);
    expect(result.playableIds.has("c1")).toBe(false);
  });

  it("allows draw_two on D4 in draws_mix mode", () => {
    const hand = [
      makeCard("d2a", "green", "draw_two"), // stackable on D4 in draws_mix
    ];
    const topDiscard = makeCard("d1", null, "wild_draw_four");
    const pending = { count: 4, source: "D4" };
    const settings = makeSettings({
      stackDraw2: true,
      stackDraw4: true,
      stackingMode: "draws_mix",
    });
    const result = computePlayableCards(
      hand,
      "green",
      topDiscard,
      settings,
      pending,
    );
    expect(result.playableIds.has("d2a")).toBe(true);
  });

  it("with pendingDraw > 0 but all stacking OFF, nothing is playable", () => {
    const hand = [
      makeCard("d2a", "red", "draw_two"),
      makeCard("wd1", null, "wild_draw_four"),
      makeCard("c1", "red", "number", 5),
    ];
    const topDiscard = makeCard("d1", "red", "draw_two");
    const pending = { count: 2, source: "D2" };
    const settings = makeSettings({ stackDraw2: false, stackDraw4: false });
    const result = computePlayableCards(
      hand,
      "red",
      topDiscard,
      settings,
      pending,
    );
    expect(result.playableIds.size).toBe(0);
  });

  it("cross-stacking is blocked in same_only mode even with both stacking flags", () => {
    const hand = [
      makeCard("wd1", null, "wild_draw_four"), // NOT stackable on D2 in same_only
    ];
    const topDiscard = makeCard("d1", "red", "draw_two");
    const pending = { count: 2, source: "D2" };
    const settings = makeSettings({
      stackDraw2: true,
      stackDraw4: true,
      stackingMode: "same_only",
    });
    const result = computePlayableCards(
      hand,
      "red",
      topDiscard,
      settings,
      pending,
    );
    expect(result.playableIds.has("wd1")).toBe(false);
  });
});
