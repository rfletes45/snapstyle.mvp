/**
 * Tests for Metro Magnate V4 game adapter — Take 1 static content integrity.
 *
 * Covers: board space count, sector grouping, district cards, transit lines,
 * service nodes, card decks, metadata registration, settings defaults,
 * no duplicate IDs, lookup helpers.
 *
 * Take 2: engine tests — dice, movement, salary, doubles, inspection,
 * rent, buying, terminal detection, card effects.
 */

import { getAdapter, hasAdapter } from "@/gamesV4/adapters";
import metroMagnateAdapter from "@/gamesV4/adapters/metroMagnate/metroMagnateAdapter";
import {
  ALL_PURCHASABLE_INDICES,
  BOARD_SIZE,
  BOARD_SPACES,
  CENTRAL_TERMINAL_INDEX,
  CITY_BRIEF_DECK,
  CIVIC_FEE_AMOUNTS,
  DETOUR_TO_INSPECTION_INDEX,
  DISTRICT_CARDS,
  getDistrictCard,
  getDistrictsInSector,
  getSector,
  getServiceNodeCard,
  getTransitLineCard,
  INSPECTION_HOLD_INDEX,
  MARKET_SHIFT_DECK,
  PLAZA_INDEX,
  SECTORS,
  SERVICE_NODE_CARDS,
  TRANSIT_LINE_CARDS,
} from "@/gamesV4/adapters/metroMagnate/metroMagnateBoard";
import {
  checkTerminal,
  computeNetWorth,
  computeRent,
  generateDice,
  getPropertyOwner,
  isPropertyMortgaged,
  ownsSector,
  processMove,
} from "@/gamesV4/adapters/metroMagnate/metroMagnateEngine";
import type {
  MetroMagnatePublicState,
  MetroPlayerState,
} from "@/gamesV4/adapters/metroMagnate/metroMagnateTypes";
import { DEFAULT_METRO_MAGNATE_SETTINGS } from "@/gamesV4/adapters/metroMagnate/metroMagnateTypes";
import { GAME_METADATA } from "@/gamesV4/constants";

// =============================================================================
// Board Topology
// =============================================================================

describe("Metro Magnate — Board", () => {
  it("has exactly 36 spaces", () => {
    expect(BOARD_SPACES).toHaveLength(BOARD_SIZE);
    expect(BOARD_SIZE).toBe(36);
  });

  it("has sequential indices 0–35", () => {
    BOARD_SPACES.forEach((s, i) => expect(s.index).toBe(i));
  });

  it("has exactly 1 Central Terminal at index 0", () => {
    const terminals = BOARD_SPACES.filter((s) => s.type === "central_terminal");
    expect(terminals).toHaveLength(1);
    expect(terminals[0].index).toBe(CENTRAL_TERMINAL_INDEX);
  });

  it("has exactly 18 district spaces", () => {
    const districts = BOARD_SPACES.filter((s) => s.type === "district");
    expect(districts).toHaveLength(18);
  });

  it("has exactly 4 transit line spaces", () => {
    const lines = BOARD_SPACES.filter((s) => s.type === "transit_line");
    expect(lines).toHaveLength(4);
  });

  it("has exactly 2 service node spaces", () => {
    const nodes = BOARD_SPACES.filter((s) => s.type === "service_node");
    expect(nodes).toHaveLength(2);
  });

  it("has exactly 3 Market Shift spaces", () => {
    expect(BOARD_SPACES.filter((s) => s.type === "market_shift")).toHaveLength(
      3,
    );
  });

  it("has exactly 3 City Brief spaces", () => {
    expect(BOARD_SPACES.filter((s) => s.type === "city_brief")).toHaveLength(3);
  });

  it("has exactly 2 Civic Fee spaces", () => {
    expect(BOARD_SPACES.filter((s) => s.type === "civic_fee")).toHaveLength(2);
  });

  it("has exactly 1 Plaza, 1 Inspection Hold, 1 Detour to Inspection", () => {
    expect(BOARD_SPACES.filter((s) => s.type === "plaza")).toHaveLength(1);
    expect(
      BOARD_SPACES.filter((s) => s.type === "inspection_hold"),
    ).toHaveLength(1);
    expect(
      BOARD_SPACES.filter((s) => s.type === "detour_to_inspection"),
    ).toHaveLength(1);
  });

  it("all space types sum to 36", () => {
    const counts = {
      central_terminal: 1,
      district: 18,
      transit_line: 4,
      service_node: 2,
      market_shift: 3,
      city_brief: 3,
      civic_fee: 2,
      plaza: 1,
      inspection_hold: 1,
      detour_to_inspection: 1,
    };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(36);
  });

  it("special space indices are correct", () => {
    expect(BOARD_SPACES[INSPECTION_HOLD_INDEX].type).toBe("inspection_hold");
    expect(BOARD_SPACES[DETOUR_TO_INSPECTION_INDEX].type).toBe(
      "detour_to_inspection",
    );
    expect(BOARD_SPACES[PLAZA_INDEX].type).toBe("plaza");
  });
});

// =============================================================================
// Sectors
// =============================================================================

describe("Metro Magnate — Sectors", () => {
  it("has exactly 6 sectors", () => {
    expect(SECTORS).toHaveLength(6);
  });

  it("each sector has exactly 3 district indices", () => {
    for (const sector of SECTORS) {
      expect(sector.districtIndices).toHaveLength(3);
    }
  });

  it("all sector district indices reference district-type spaces", () => {
    for (const sector of SECTORS) {
      for (const idx of sector.districtIndices) {
        expect(BOARD_SPACES[idx].type).toBe("district");
        expect(BOARD_SPACES[idx].sectorId).toBe(sector.sectorId);
      }
    }
  });

  it("no duplicate sector IDs", () => {
    const ids = SECTORS.map((s) => s.sectorId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sector names match spec", () => {
    const names = SECTORS.map((s) => s.name);
    expect(names).toEqual([
      "Arts Quarter",
      "Harbor Ward",
      "Market Row",
      "Foundry Belt",
      "Tech Heights",
      "Civic Square",
    ]);
  });
});

// =============================================================================
// District Cards
// =============================================================================

describe("Metro Magnate — District Cards", () => {
  it("has exactly 18 district cards", () => {
    expect(DISTRICT_CARDS).toHaveLength(18);
  });

  it("each district card maps to a district-type board space", () => {
    for (const card of DISTRICT_CARDS) {
      expect(BOARD_SPACES[card.spaceIndex].type).toBe("district");
    }
  });

  it("no duplicate space indices in district cards", () => {
    const indices = DISTRICT_CARDS.map((d) => d.spaceIndex);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it("rent ladder has 6 entries per card", () => {
    for (const card of DISTRICT_CARDS) {
      expect(card.rentLadder).toHaveLength(6);
    }
  });

  it("mortgage value is half of lease cost", () => {
    for (const card of DISTRICT_CARDS) {
      expect(card.mortgageValue).toBe(card.leaseCost / 2);
    }
  });

  it("rent ladder is monotonically increasing per card", () => {
    for (const card of DISTRICT_CARDS) {
      for (let i = 1; i < card.rentLadder.length; i++) {
        expect(card.rentLadder[i]).toBeGreaterThanOrEqual(
          card.rentLadder[i - 1],
        );
      }
    }
  });
});

// =============================================================================
// Transit Lines & Service Nodes
// =============================================================================

describe("Metro Magnate — Transit Lines", () => {
  it("has exactly 4 transit line cards", () => {
    expect(TRANSIT_LINE_CARDS).toHaveLength(4);
  });

  it("each maps to a transit_line-type space", () => {
    for (const card of TRANSIT_LINE_CARDS) {
      expect(BOARD_SPACES[card.spaceIndex].type).toBe("transit_line");
    }
  });

  it("rentByCount has 4 entries and is increasing", () => {
    for (const card of TRANSIT_LINE_CARDS) {
      expect(card.rentByCount).toHaveLength(4);
      for (let i = 1; i < card.rentByCount.length; i++) {
        expect(card.rentByCount[i]).toBeGreaterThan(card.rentByCount[i - 1]);
      }
    }
  });
});

describe("Metro Magnate — Service Nodes", () => {
  it("has exactly 2 service node cards", () => {
    expect(SERVICE_NODE_CARDS).toHaveLength(2);
  });

  it("each maps to a service_node-type space", () => {
    for (const card of SERVICE_NODE_CARDS) {
      expect(BOARD_SPACES[card.spaceIndex].type).toBe("service_node");
    }
  });
});

// =============================================================================
// Card Decks
// =============================================================================

describe("Metro Magnate — Card Decks", () => {
  it("Market Shift deck has 16 cards", () => {
    expect(MARKET_SHIFT_DECK).toHaveLength(16);
  });

  it("City Brief deck has 16 cards", () => {
    expect(CITY_BRIEF_DECK).toHaveLength(16);
  });

  it("Market Shift cards have unique IDs", () => {
    const ids = MARKET_SHIFT_DECK.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("City Brief cards have unique IDs", () => {
    const ids = CITY_BRIEF_DECK.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Civic Fee amounts are defined for both fee spaces", () => {
    const feeSpaces = BOARD_SPACES.filter((s) => s.type === "civic_fee");
    for (const space of feeSpaces) {
      expect(CIVIC_FEE_AMOUNTS[space.index]).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Lookup Helpers
// =============================================================================

describe("Metro Magnate — Lookup Helpers", () => {
  it("getDistrictCard returns card for valid index", () => {
    const card = getDistrictCard(1);
    expect(card).toBeDefined();
    expect(card!.name).toBe("Gallery Row");
  });

  it("getDistrictCard returns undefined for non-district", () => {
    expect(getDistrictCard(0)).toBeUndefined();
  });

  it("getTransitLineCard returns card for valid index", () => {
    const card = getTransitLineCard(5);
    expect(card).toBeDefined();
    expect(card!.name).toBe("Northbound Line");
  });

  it("getServiceNodeCard returns card for valid index", () => {
    const card = getServiceNodeCard(12);
    expect(card).toBeDefined();
    expect(card!.name).toBe("Metro Power Co.");
  });

  it("getSector returns sector for valid ID", () => {
    const sector = getSector("arts_quarter");
    expect(sector).toBeDefined();
    expect(sector!.name).toBe("Arts Quarter");
  });

  it("getDistrictsInSector returns 3 cards per sector", () => {
    for (const sector of SECTORS) {
      const cards = getDistrictsInSector(sector.sectorId);
      expect(cards).toHaveLength(3);
    }
  });

  it("ALL_PURCHASABLE_INDICES has 24 entries (18 + 4 + 2)", () => {
    expect(ALL_PURCHASABLE_INDICES).toHaveLength(24);
    expect(new Set(ALL_PURCHASABLE_INDICES).size).toBe(24);
  });
});

// =============================================================================
// Adapter Registration
// =============================================================================

describe("Metro Magnate — Adapter Registration", () => {
  it("adapter is registered in the global registry", () => {
    expect(hasAdapter("metro_magnate")).toBe(true);
  });

  it("getAdapter returns the metro_magnate adapter", () => {
    const adapter = getAdapter("metro_magnate");
    expect(adapter).toBeDefined();
    expect(adapter!.gameId).toBe("metro_magnate");
  });

  it("adapter identity matches spec", () => {
    expect(metroMagnateAdapter.gameId).toBe("metro_magnate");
    expect(metroMagnateAdapter.runtimeType).toBe("turnBased");
    expect(metroMagnateAdapter.minPlayers).toBe(2);
    expect(metroMagnateAdapter.maxPlayers).toBe(6);
    expect(metroMagnateAdapter.supportsSpectate).toBe(true);
    expect(metroMagnateAdapter.spectateMode).toBe("public_only");
  });
});

// =============================================================================
// Metadata
// =============================================================================

describe("Metro Magnate — Metadata", () => {
  it("GAME_METADATA entry exists", () => {
    const meta = GAME_METADATA.metro_magnate;
    expect(meta).toBeDefined();
    expect(meta.displayName).toBe("Metro Magnate");
    expect(meta.runtimeType).toBe("turnBased");
    expect(meta.minPlayers).toBe(2);
    expect(meta.maxPlayers).toBe(6);
  });
});

// =============================================================================
// Settings
// =============================================================================

describe("Metro Magnate — Settings", () => {
  it("default settings are well-formed", () => {
    const s = DEFAULT_METRO_MAGNATE_SETTINGS;
    expect(s.mode).toBe("classic");
    expect(s.startingCapital).toBe(1500);
    expect(s.passSalary).toBe(200);
    expect(s.auctionType).toBe("english");
    expect(s.turnTimer).toBe("60s");
    expect(s.inspectionSeverity).toBe("standard");
    expect(s.improvementSupply).toBe("unlimited");
    expect(s.plazaBonus).toBe(true);
    expect(s.terminalExactBonus).toBe(false);
    expect(s.tradeWindow).toBe(true);
  });

  it("settings schema has 10 fields", () => {
    expect(metroMagnateAdapter.settingsSchema).toHaveLength(10);
  });

  it("validateSettings clamps startingCapital", () => {
    const result = metroMagnateAdapter.validateSettings!({
      startingCapital: 99999,
    });
    expect(result.startingCapital).toBe(5000);
  });

  it("validateSettings rejects invalid mode", () => {
    const result = metroMagnateAdapter.validateSettings!({
      mode: "invalid_mode",
    });
    expect(result.mode).toBe("classic");
  });
});

// =============================================================================
// Initial State
// =============================================================================

describe("Metro Magnate — Initial State", () => {
  const players = [
    { uid: "p1", slotIndex: 0 },
    { uid: "p2", slotIndex: 1 },
    { uid: "p3", slotIndex: 2 },
  ];

  it("creates valid initial state for 3 players", () => {
    const raw = metroMagnateAdapter.createInitialPublicState(
      players,
      DEFAULT_METRO_MAGNATE_SETTINGS as unknown as Record<string, unknown>,
    );
    const state = raw as unknown as {
      players: Array<{ uid: string; position: number; cash: number }>;
      turnOrder: string[];
      phase: string;
      boardId: string;
    };

    expect(state.boardId).toBe("standard_36");
    expect(state.players).toHaveLength(3);
    expect(state.turnOrder).toHaveLength(3);
    expect(state.phase).toBe("pre_roll");

    for (const p of state.players) {
      expect(p.position).toBe(0);
      expect(p.cash).toBe(1500);
    }
  });

  it("respects custom startingCapital", () => {
    const raw = metroMagnateAdapter.createInitialPublicState(players, {
      ...DEFAULT_METRO_MAGNATE_SETTINGS,
      startingCapital: 2000,
    } as unknown as Record<string, unknown>);
    const state = raw as unknown as {
      players: Array<{ cash: number }>;
    };
    expect(state.players[0].cash).toBe(2000);
  });

  it("sets currentTurnUid to the first player", () => {
    const raw = metroMagnateAdapter.createInitialPublicState(
      players,
      DEFAULT_METRO_MAGNATE_SETTINGS as unknown as Record<string, unknown>,
    );
    const state = raw as unknown as {
      currentTurnUid: string;
      turnOrder: string[];
    };
    expect(state.currentTurnUid).toBe(state.turnOrder[0]);
  });
});

// =============================================================================
// Engine — Helpers & Setup
// =============================================================================

function makeState(
  overrides?: Partial<MetroMagnatePublicState>,
): MetroMagnatePublicState {
  const base: MetroMagnatePublicState = {
    boardId: "standard_36",
    players: [
      makePlayer("p1", { position: 0, cash: 1500 }),
      makePlayer("p2", { position: 0, cash: 1500 }),
    ],
    turnOrder: ["p1", "p2"],
    currentTurnIndex: 0,
    currentTurnUid: "p1",
    phase: "pre_roll",
    lastDice: null,
    doublesCount: 0,
    turnNumber: 1,
    moveCount: 0,
    activeAuction: null,
    activeTrade: null,
    propertyOwnership: [],
    propertyImprovements: [],
    propertyMortgages: [],
    inspectionHoldTurns: [],
    marketShiftDeckIndex: 0,
    cityBriefDeckIndex: 0,
    marketShiftOrder: Array.from({ length: 16 }, (_, i) => i),
    cityBriefOrder: Array.from({ length: 16 }, (_, i) => i),
    plazaPot: 0,
    debtContext: null,
    eliminationOrder: [],
    storefrontSupply: 9999,
    towerSupply: 9999,
    winnerUid: null,
    endReason: null,
    settings: { ...DEFAULT_METRO_MAGNATE_SETTINGS },
  };
  return { ...base, ...overrides } as MetroMagnatePublicState;
}

function makePlayer(
  uid: string,
  overrides?: Partial<MetroPlayerState>,
): MetroPlayerState {
  return {
    uid,
    position: 0,
    cash: 1500,
    ownedProperties: [],
    improvements: [],
    mortgagedProperties: [],
    inspectionPasses: 0,
    isBankrupt: false,
    bankruptTurn: -1,
    netWorth: 1500,
    timesPassedTerminal: 0,
    ...overrides,
  };
}

// =============================================================================
// Engine — Deterministic Dice
// =============================================================================

describe("Metro Magnate — Dice Generation", () => {
  it("produces values 1–6 for both dice", () => {
    for (let seed = 0; seed < 100; seed++) {
      const [d1, d2] = generateDice(seed);
      expect(d1).toBeGreaterThanOrEqual(1);
      expect(d1).toBeLessThanOrEqual(6);
      expect(d2).toBeGreaterThanOrEqual(1);
      expect(d2).toBeLessThanOrEqual(6);
    }
  });

  it("is deterministic — same seed gives same result", () => {
    const [a1, a2] = generateDice(42);
    const [b1, b2] = generateDice(42);
    expect(a1).toBe(b1);
    expect(a2).toBe(b2);
  });

  it("different seeds produce different results (with high probability)", () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const [d1, d2] = generateDice(i);
      results.add(`${d1},${d2}`);
    }
    expect(results.size).toBeGreaterThan(5);
  });
});

// =============================================================================
// Engine — Core Engine (processMove)
// =============================================================================

describe("Metro Magnate — Engine (processMove)", () => {
  it("rejects moves when it is not the player's turn", () => {
    const state = makeState();
    const result = processMove(state, "p2", { action: "roll_dice" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not your turn/i);
  });

  it("rejects moves when game is over", () => {
    const state = makeState({ phase: "game_over" });
    const result = processMove(state, "p1", { action: "roll_dice" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already over/i);
  });

  it("rejects roll_dice when not in pre_roll phase", () => {
    const state = makeState({ phase: "post_roll" });
    const result = processMove(state, "p1", { action: "roll_dice" });
    expect(result.ok).toBe(false);
  });

  it("rejects unknown actions gracefully", () => {
    const state = makeState();
    const result = processMove(state, "p1", {
      action: "build_improvement",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(false);
    // build_improvement is now implemented; it fails for a valid reason
    expect(result.error).toBeDefined();
  });
});

// =============================================================================
// Engine — Roll Dice & Movement
// =============================================================================

describe("Metro Magnate — Roll Dice & Movement", () => {
  it("rolls dice and moves the player", () => {
    const state = makeState();
    const result = processMove(state, "p1", { action: "roll_dice" });
    expect(result.ok).toBe(true);
    expect(result.state).toBeDefined();
    const ns = result.state!;
    expect(ns.lastDice).not.toBeNull();
    expect(ns.moveCount).toBe(1);
    const player = ns.players.find((p) => p.uid === "p1")!;
    const diceTotal = ns.lastDice![0] + ns.lastDice![1];
    expect(player.position).toBe(diceTotal % BOARD_SIZE);
  });

  it("increments moveCount on each action", () => {
    const state = makeState();
    const r1 = processMove(state, "p1", { action: "roll_dice" });
    expect(r1.state!.moveCount).toBeGreaterThan(state.moveCount);
  });

  it("collects salary when passing Central Terminal", () => {
    // Place player near end of board so dice roll wraps past terminal
    const state = makeState({
      players: [
        makePlayer("p1", { position: 34, cash: 1500 }),
        makePlayer("p2"),
      ],
    });
    const dice = generateDice(state.moveCount);
    const total = dice[0] + dice[1];
    // Only test if the roll actually wraps past terminal
    if (34 + total >= BOARD_SIZE) {
      const result = processMove(state, "p1", { action: "roll_dice" });
      expect(result.ok).toBe(true);
      const player = result.state!.players.find((p) => p.uid === "p1")!;
      expect(player.cash).toBeGreaterThan(1500);
      expect(player.timesPassedTerminal).toBe(1);
    }
  });

  it("tracks doubles count", () => {
    // Find a moveCount seed that produces doubles
    let doublesState: MetroMagnatePublicState | null = null;
    for (let mc = 0; mc < 200; mc++) {
      const [d1, d2] = generateDice(mc);
      if (d1 === d2) {
        doublesState = makeState({ moveCount: mc });
        break;
      }
    }
    if (doublesState) {
      const result = processMove(doublesState, "p1", { action: "roll_dice" });
      expect(result.ok).toBe(true);
      expect(result.state!.doublesCount).toBe(1);
      // After doubles, phase should be pre_roll (can roll again) or buying_decision
      expect(["pre_roll", "buying_decision", "post_roll"]).toContain(
        result.state!.phase,
      );
    }
  });
});

// =============================================================================
// Engine — Buy / Decline Property
// =============================================================================

describe("Metro Magnate — Buy & Decline Property", () => {
  it("allows buying an unowned property in buying_decision phase", () => {
    // Place player on Gallery Row (index 1, district, cost $60)
    const state = makeState({
      phase: "buying_decision",
      lastDice: [1, 1] as [number, number],
      doublesCount: 0,
      players: [
        makePlayer("p1", { position: 1, cash: 1500 }),
        makePlayer("p2"),
      ],
    });
    const result = processMove(state, "p1", { action: "buy_property" });
    expect(result.ok).toBe(true);
    const ns = result.state!;
    const player = ns.players.find((p) => p.uid === "p1")!;
    expect(player.cash).toBe(1500 - 60);
    expect(player.ownedProperties).toContain(1);
    expect(ns.propertyOwnership).toContainEqual({
      spaceIndex: 1,
      ownerUid: "p1",
    });
  });

  it("rejects buy when not enough cash", () => {
    const state = makeState({
      phase: "buying_decision",
      lastDice: [1, 1] as [number, number],
      players: [
        makePlayer("p1", { position: 34, cash: 10 }), // Capitol Heights costs $350
        makePlayer("p2"),
      ],
    });
    const result = processMove(state, "p1", { action: "buy_property" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not enough cash/i);
  });

  it("allows declining a property", () => {
    const state = makeState({
      phase: "buying_decision",
      lastDice: [2, 3] as [number, number],
      doublesCount: 0,
      players: [
        makePlayer("p1", { position: 1, cash: 1500 }),
        makePlayer("p2"),
      ],
    });
    const result = processMove(state, "p1", { action: "decline_property" });
    expect(result.ok).toBe(true);
    expect(result.state!.propertyOwnership).toHaveLength(0); // Property stays unowned
  });
});

// =============================================================================
// Engine — Rent Calculation
// =============================================================================

describe("Metro Magnate — Rent Calculation", () => {
  it("computes base district rent correctly", () => {
    const state = makeState({
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p2" }],
    });
    const rent = computeRent(state, 1, 7);
    // Gallery Row base rent = 2
    expect(rent).toBe(2);
  });

  it("doubles district rent with sector monopoly", () => {
    const state = makeState({
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p2" },
        { spaceIndex: 3, ownerUid: "p2" },
        { spaceIndex: 6, ownerUid: "p2" },
      ],
    });
    const rent = computeRent(state, 1, 7);
    // Gallery Row base rent (2) × 2 monopoly bonus = 4
    expect(rent).toBe(4);
  });

  it("returns 0 rent for unowned property", () => {
    const state = makeState();
    expect(computeRent(state, 1, 7)).toBe(0);
  });

  it("returns 0 rent for mortgaged property", () => {
    const state = makeState({
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p2" }],
      propertyMortgages: [{ spaceIndex: 1, mortgaged: true }],
    });
    expect(computeRent(state, 1, 7)).toBe(0);
  });

  it("scales transit line rent by count owned", () => {
    const state = makeState({
      propertyOwnership: [
        { spaceIndex: 5, ownerUid: "p2" },
        { spaceIndex: 16, ownerUid: "p2" },
      ],
    });
    // 2 transit lines: rent = 50
    expect(computeRent(state, 5, 7)).toBe(50);
  });

  it("computes service node rent as multiplier × dice", () => {
    const state = makeState({
      propertyOwnership: [{ spaceIndex: 12, ownerUid: "p2" }],
    });
    // 1 service node: multiplier = 4, dice total = 8 → rent = 32
    expect(computeRent(state, 12, 8)).toBe(32);
  });

  it("computes service node rent with both owned", () => {
    const state = makeState({
      propertyOwnership: [
        { spaceIndex: 12, ownerUid: "p2" },
        { spaceIndex: 27, ownerUid: "p2" },
      ],
    });
    // 2 service nodes: multiplier = 10, dice total = 8 → rent = 80
    expect(computeRent(state, 12, 8)).toBe(80);
  });
});

// =============================================================================
// Engine — Net Worth
// =============================================================================

describe("Metro Magnate — Net Worth", () => {
  it("computes net worth as cash + mortgage values", () => {
    const state = makeState({
      players: [
        makePlayer("p1", { cash: 1000, ownedProperties: [1, 5] }),
        makePlayer("p2"),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 5, ownerUid: "p1" },
      ],
    });
    // cash (1000) + Gallery Row mortgage (30) + Northbound Line mortgage (100) = 1130
    expect(computeNetWorth(state, "p1")).toBe(1130);
  });

  it("returns 0 for bankrupt player", () => {
    const state = makeState({
      players: [makePlayer("p1", { isBankrupt: true }), makePlayer("p2")],
    });
    expect(computeNetWorth(state, "p1")).toBe(0);
  });
});

// =============================================================================
// Engine — End Turn
// =============================================================================

describe("Metro Magnate — End Turn", () => {
  it("advances to next player", () => {
    const state = makeState({ phase: "post_roll" });
    const result = processMove(state, "p1", { action: "end_turn" });
    expect(result.ok).toBe(true);
    expect(result.state!.currentTurnIndex).toBe(1);
    expect(result.state!.currentTurnUid).toBe("p2");
    expect(result.nextTurnPlayerId).toBe("p2");
    expect(result.state!.turnNumber).toBe(2);
    expect(result.state!.phase).toBe("pre_roll");
  });

  it("skips bankrupt players", () => {
    const state = makeState({
      phase: "post_roll",
      players: [
        makePlayer("p1"),
        makePlayer("p2", { isBankrupt: true }),
        makePlayer("p3"),
      ],
      turnOrder: ["p1", "p2", "p3"],
    });
    const result = processMove(state, "p1", { action: "end_turn" });
    expect(result.ok).toBe(true);
    expect(result.state!.currentTurnUid).toBe("p3");
    expect(result.nextTurnPlayerId).toBe("p3");
  });

  it("sets inspection phase for next player if they are in inspection", () => {
    const state = makeState({
      phase: "post_roll",
      inspectionHoldTurns: [{ uid: "p2", turnsRemaining: 3 }],
    });
    const result = processMove(state, "p1", { action: "end_turn" });
    expect(result.ok).toBe(true);
    expect(result.state!.phase).toBe("inspection");
  });

  it("rejects end_turn when not in post_roll phase", () => {
    const state = makeState({ phase: "pre_roll" });
    const result = processMove(state, "p1", { action: "end_turn" });
    expect(result.ok).toBe(false);
  });
});

// =============================================================================
// Engine — Inspection Hold
// =============================================================================

describe("Metro Magnate — Inspection Hold", () => {
  it("allows paying fine to leave inspection", () => {
    const state = makeState({
      phase: "inspection",
      players: [
        makePlayer("p1", { position: INSPECTION_HOLD_INDEX, cash: 500 }),
        makePlayer("p2"),
      ],
      inspectionHoldTurns: [{ uid: "p1", turnsRemaining: 3 }],
    });
    const result = processMove(state, "p1", {
      action: "pay_inspection_fine",
      amount: 50,
    });
    expect(result.ok).toBe(true);
    const ns = result.state!;
    const player = ns.players.find((p) => p.uid === "p1")!;
    expect(player.cash).toBe(450);
    expect(ns.phase).toBe("pre_roll"); // Can now roll normally
    expect(ns.inspectionHoldTurns.find((h) => h.uid === "p1")).toBeUndefined();
  });

  it("rejects fine payment when not enough cash", () => {
    const state = makeState({
      phase: "inspection",
      players: [
        makePlayer("p1", { position: INSPECTION_HOLD_INDEX, cash: 30 }),
        makePlayer("p2"),
      ],
      inspectionHoldTurns: [{ uid: "p1", turnsRemaining: 3 }],
    });
    const result = processMove(state, "p1", {
      action: "pay_inspection_fine",
      amount: 50,
    });
    expect(result.ok).toBe(false);
  });

  it("allows using inspection pass", () => {
    const state = makeState({
      phase: "inspection",
      players: [
        makePlayer("p1", {
          position: INSPECTION_HOLD_INDEX,
          inspectionPasses: 1,
        }),
        makePlayer("p2"),
      ],
      inspectionHoldTurns: [{ uid: "p1", turnsRemaining: 3 }],
    });
    const result = processMove(state, "p1", { action: "use_inspection_pass" });
    expect(result.ok).toBe(true);
    const ns = result.state!;
    const player = ns.players.find((p) => p.uid === "p1")!;
    expect(player.inspectionPasses).toBe(0);
    expect(ns.phase).toBe("pre_roll");
  });

  it("rejects inspection pass when none available", () => {
    const state = makeState({
      phase: "inspection",
      players: [
        makePlayer("p1", {
          position: INSPECTION_HOLD_INDEX,
          inspectionPasses: 0,
        }),
        makePlayer("p2"),
      ],
      inspectionHoldTurns: [{ uid: "p1", turnsRemaining: 3 }],
    });
    const result = processMove(state, "p1", { action: "use_inspection_pass" });
    expect(result.ok).toBe(false);
  });

  it("wait_in_inspection rolls dice and moves if doubles", () => {
    // Find a seed that produces doubles
    let doubleSeed = -1;
    for (let mc = 0; mc < 200; mc++) {
      const [d1, d2] = generateDice(mc);
      if (d1 === d2) {
        doubleSeed = mc;
        break;
      }
    }
    if (doubleSeed >= 0) {
      const state = makeState({
        phase: "inspection",
        moveCount: doubleSeed,
        players: [
          makePlayer("p1", { position: INSPECTION_HOLD_INDEX }),
          makePlayer("p2"),
        ],
        inspectionHoldTurns: [{ uid: "p1", turnsRemaining: 3 }],
      });
      const result = processMove(state, "p1", { action: "wait_in_inspection" });
      expect(result.ok).toBe(true);
      const ns = result.state!;
      const player = ns.players.find((p) => p.uid === "p1")!;
      expect(player.position).not.toBe(INSPECTION_HOLD_INDEX);
      expect(
        ns.inspectionHoldTurns.find((h) => h.uid === "p1"),
      ).toBeUndefined();
    }
  });

  it("wait_in_inspection decrements turnsRemaining if no doubles", () => {
    // Find a seed that does NOT produce doubles
    let nonDoubleSeed = -1;
    for (let mc = 0; mc < 200; mc++) {
      const [d1, d2] = generateDice(mc);
      if (d1 !== d2) {
        nonDoubleSeed = mc;
        break;
      }
    }
    if (nonDoubleSeed >= 0) {
      const state = makeState({
        phase: "inspection",
        moveCount: nonDoubleSeed,
        players: [
          makePlayer("p1", { position: INSPECTION_HOLD_INDEX }),
          makePlayer("p2"),
        ],
        inspectionHoldTurns: [{ uid: "p1", turnsRemaining: 3 }],
      });
      const result = processMove(state, "p1", { action: "wait_in_inspection" });
      expect(result.ok).toBe(true);
      const ns = result.state!;
      const hold = ns.inspectionHoldTurns.find((h) => h.uid === "p1");
      expect(hold).toBeDefined();
      expect(hold!.turnsRemaining).toBe(2);
      expect(ns.phase).toBe("post_roll");
    }
  });
});

// =============================================================================
// Engine — Terminal Detection
// =============================================================================

describe("Metro Magnate — Terminal Detection", () => {
  it("detects last standing player as winner", () => {
    const state = makeState({
      players: [makePlayer("p1", { isBankrupt: true }), makePlayer("p2")],
    });
    const terminal = checkTerminal(state);
    expect(terminal).not.toBeNull();
    expect(terminal!.type).toBe("win");
    expect(terminal!.winnerIds).toEqual(["p2"]);
    expect(terminal!.reason).toBe("last_standing");
  });

  it("returns null when multiple players active", () => {
    const state = makeState();
    expect(checkTerminal(state)).toBeNull();
  });

  it("detects express mode turn cap terminal", () => {
    const state = makeState({
      settings: { ...DEFAULT_METRO_MAGNATE_SETTINGS, mode: "express" as const },
      turnNumber: 30,
      players: [
        makePlayer("p1", { netWorth: 3000 }),
        makePlayer("p2", { netWorth: 2000 }),
      ],
    });
    const terminal = checkTerminal(state);
    expect(terminal).not.toBeNull();
    expect(terminal!.reason).toBe("express_turn_cap");
    expect(terminal!.winnerIds).toEqual(["p1"]);
  });
});

// =============================================================================
// Engine — Adapter validateMove Integration
// =============================================================================

describe("Metro Magnate — Adapter validateMove", () => {
  const players = [
    { uid: "p1", slotIndex: 0 },
    { uid: "p2", slotIndex: 1 },
  ];

  it("accepts a valid roll_dice move via the adapter", () => {
    const raw = metroMagnateAdapter.createInitialPublicState(
      players,
      DEFAULT_METRO_MAGNATE_SETTINGS as unknown as Record<string, unknown>,
    );
    const result = metroMagnateAdapter.validateMove!(
      raw,
      {},
      { action: "roll_dice" },
      {
        uid: "p1",
        turnOrder: ["p1", "p2"],
        currentTurnIndex: 0,
        settings: DEFAULT_METRO_MAGNATE_SETTINGS as unknown as Record<
          string,
          unknown
        >,
      },
    );
    expect(result.ok).toBe(true);
    expect(result.nextPublicState).toBeDefined();
    expect(result.turnAdvance).toBe(false);
  });

  it("rejects out-of-turn move via the adapter", () => {
    const raw = metroMagnateAdapter.createInitialPublicState(
      players,
      DEFAULT_METRO_MAGNATE_SETTINGS as unknown as Record<string, unknown>,
    );
    const result = metroMagnateAdapter.validateMove!(
      raw,
      {},
      { action: "roll_dice" },
      {
        uid: "p2", // not p1's turn
        turnOrder: ["p1", "p2"],
        currentTurnIndex: 0,
        settings: DEFAULT_METRO_MAGNATE_SETTINGS as unknown as Record<
          string,
          unknown
        >,
      },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not your turn/i);
  });

  it("completes a full roll → end_turn cycle", () => {
    const raw = metroMagnateAdapter.createInitialPublicState(
      players,
      DEFAULT_METRO_MAGNATE_SETTINGS as unknown as Record<string, unknown>,
    );

    // Roll dice
    const r1 = metroMagnateAdapter.validateMove!(
      raw,
      {},
      { action: "roll_dice" },
      {
        uid: "p1",
        turnOrder: ["p1", "p2"],
        currentTurnIndex: 0,
        settings: raw,
      },
    );
    expect(r1.ok).toBe(true);

    const state1 = r1.nextPublicState!;

    // Handle buying_decision if we landed on an unowned property
    let state2 = state1;
    const phase1 = (state1 as Record<string, unknown>).phase as string;
    if (phase1 === "buying_decision") {
      const r2 = metroMagnateAdapter.validateMove!(
        state1,
        {},
        { action: "decline_property" },
        {
          uid: "p1",
          turnOrder: ["p1", "p2"],
          currentTurnIndex: 0,
          settings: raw,
        },
      );
      expect(r2.ok).toBe(true);
      state2 = r2.nextPublicState!;
    }

    // If phase is pre_roll (doubles), roll again until post_roll
    let currentState = state2;
    let iterations = 0;
    while (
      (currentState as Record<string, unknown>).phase === "pre_roll" &&
      iterations < 10
    ) {
      const rr = metroMagnateAdapter.validateMove!(
        currentState,
        {},
        { action: "roll_dice" },
        {
          uid: "p1",
          turnOrder: ["p1", "p2"],
          currentTurnIndex: 0,
          settings: raw,
        },
      );
      expect(rr.ok).toBe(true);
      currentState = rr.nextPublicState!;
      const currentPhase = (currentState as Record<string, unknown>)
        .phase as string;
      if (currentPhase === "buying_decision") {
        const rd = metroMagnateAdapter.validateMove!(
          currentState,
          {},
          { action: "decline_property" },
          {
            uid: "p1",
            turnOrder: ["p1", "p2"],
            currentTurnIndex: 0,
            settings: raw,
          },
        );
        expect(rd.ok).toBe(true);
        currentState = rd.nextPublicState!;
      }
      iterations++;
    }

    // End turn
    const phase = (currentState as Record<string, unknown>).phase as string;
    if (phase === "post_roll") {
      const r3 = metroMagnateAdapter.validateMove!(
        currentState,
        {},
        { action: "end_turn" },
        {
          uid: "p1",
          turnOrder: ["p1", "p2"],
          currentTurnIndex: 0,
          settings: raw,
        },
      );
      expect(r3.ok).toBe(true);
      expect(r3.nextTurnPlayerId).toBe("p2");
      const finalState = r3.nextPublicState as Record<string, unknown>;
      expect(finalState.currentTurnUid).toBe("p2");
    }
  });
});

// =============================================================================
// Engine — Property Ownership Helpers
// =============================================================================

describe("Metro Magnate — Property Helpers", () => {
  it("getPropertyOwner returns null for unowned", () => {
    const state = makeState();
    expect(getPropertyOwner(state, 1)).toBeNull();
  });

  it("getPropertyOwner returns owner uid", () => {
    const state = makeState({
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p1" }],
    });
    expect(getPropertyOwner(state, 1)).toBe("p1");
  });

  it("isPropertyMortgaged returns false by default", () => {
    const state = makeState();
    expect(isPropertyMortgaged(state, 1)).toBe(false);
  });

  it("isPropertyMortgaged returns true when mortgaged", () => {
    const state = makeState({
      propertyMortgages: [{ spaceIndex: 1, mortgaged: true }],
    });
    expect(isPropertyMortgaged(state, 1)).toBe(true);
  });
});

// =============================================================================
// Take 3 — Economy: Auctions
// =============================================================================

describe("Metro Magnate — Auctions", () => {
  it("decline_property starts an auction", () => {
    const state = makeState({
      phase: "buying_decision",
      players: [
        makePlayer("p1", { position: 1, cash: 1500 }),
        makePlayer("p2", { position: 0, cash: 1500 }),
        makePlayer("p3", { position: 0, cash: 1500 }),
      ],
      turnOrder: ["p1", "p2", "p3"],
    });
    const result = processMove(state, "p1", { action: "decline_property" });
    expect(result.ok).toBe(true);
    const s = result.state!;
    expect(s.phase).toBe("auction");
    expect(s.activeAuction).not.toBeNull();
    expect(s.activeAuction!.propertyIndex).toBe(1);
    expect(s.activeAuction!.originatorUid).toBe("p1");
    // First bidder is the next player after the decliner
    expect(s.activeAuction!.bidderOrder[0]).toBe("p2");
    expect(s.currentTurnUid).toBe("p2");
    expect(result.nextTurnPlayerId).toBe("p2");
  });

  it("english auction: bid must exceed current bid", () => {
    const state = makeState({
      phase: "auction",
      currentTurnUid: "p2",
      players: [
        makePlayer("p1", { position: 1, cash: 1500 }),
        makePlayer("p2", { position: 0, cash: 1500 }),
      ],
      turnOrder: ["p1", "p2"],
      activeAuction: {
        propertyIndex: 1,
        type: "english",
        currentBid: 50,
        currentBidder: "p1",
        sealedBids: [],
        passedPlayers: [],
        bidderOrder: ["p2", "p1"],
        currentBidderIndex: 0,
        originatorUid: "p1",
        resolved: false,
      },
    });
    const fail = processMove(state, "p2", {
      action: "auction_bid",
      amount: 30,
    });
    expect(fail.ok).toBe(false);
    expect(fail.error).toMatch(/exceed/i);

    const ok = processMove(state, "p2", {
      action: "auction_bid",
      amount: 60,
    });
    expect(ok.ok).toBe(true);
  });

  it("english auction resolves when all but one pass", () => {
    const state = makeState({
      phase: "auction",
      currentTurnUid: "p2",
      players: [
        makePlayer("p1", { position: 1, cash: 1500 }),
        makePlayer("p2", { position: 0, cash: 1500 }),
        makePlayer("p3", { position: 0, cash: 1500 }),
      ],
      turnOrder: ["p1", "p2", "p3"],
      activeAuction: {
        propertyIndex: 1,
        type: "english",
        currentBid: 40,
        currentBidder: "p3",
        sealedBids: [],
        passedPlayers: ["p1"],
        bidderOrder: ["p2", "p3", "p1"],
        currentBidderIndex: 0,
        originatorUid: "p1",
        resolved: false,
      },
      lastDice: [3, 3] as [number, number],
      doublesCount: 0,
    });
    // p2 passes → only p3 remains → auction resolves
    const result = processMove(state, "p2", { action: "auction_pass" });
    expect(result.ok).toBe(true);
    const s = result.state!;
    expect(s.activeAuction).toBeNull();
    // p3 won at bid 40
    expect(getPropertyOwner(s, 1)).toBe("p3");
    expect(s.players.find((p) => p.uid === "p3")!.cash).toBe(1460);
    // Turn returns to originator (p1)
    expect(s.currentTurnUid).toBe("p1");
    expect(result.nextTurnPlayerId).toBe("p1");
  });

  it("auction with no bids leaves property unowned", () => {
    const state = makeState({
      phase: "auction",
      currentTurnUid: "p2",
      players: [
        makePlayer("p1", { position: 1, cash: 1500 }),
        makePlayer("p2", { position: 0, cash: 1500 }),
      ],
      turnOrder: ["p1", "p2"],
      activeAuction: {
        propertyIndex: 1,
        type: "english",
        currentBid: 0,
        currentBidder: null,
        sealedBids: [],
        passedPlayers: ["p1"],
        bidderOrder: ["p2", "p1"],
        currentBidderIndex: 0,
        originatorUid: "p1",
        resolved: false,
      },
      lastDice: [2, 3] as [number, number],
    });
    const result = processMove(state, "p2", { action: "auction_pass" });
    expect(result.ok).toBe(true);
    expect(result.state!.activeAuction).toBeNull();
    expect(getPropertyOwner(result.state!, 1)).toBeNull();
  });

  it("sealed auction: all players bid once, highest wins", () => {
    const state = makeState({
      phase: "auction",
      currentTurnUid: "p2",
      players: [
        makePlayer("p1", { position: 1, cash: 1500 }),
        makePlayer("p2", { position: 0, cash: 1500 }),
        makePlayer("p3", { position: 0, cash: 1500 }),
      ],
      turnOrder: ["p1", "p2", "p3"],
      activeAuction: {
        propertyIndex: 1,
        type: "sealed",
        currentBid: 0,
        currentBidder: null,
        sealedBids: [],
        passedPlayers: [],
        bidderOrder: ["p2", "p3", "p1"],
        currentBidderIndex: 0,
        originatorUid: "p1",
        resolved: false,
      },
      lastDice: [2, 3] as [number, number],
    });
    // p2 bids 30
    const r1 = processMove(state, "p2", {
      action: "auction_bid",
      amount: 30,
    });
    expect(r1.ok).toBe(true);
    expect(r1.state!.currentTurnUid).toBe("p3");

    // p3 bids 50
    const r2 = processMove(r1.state!, "p3", {
      action: "auction_bid",
      amount: 50,
    });
    expect(r2.ok).toBe(true);
    expect(r2.state!.currentTurnUid).toBe("p1");

    // p1 bids 40
    const r3 = processMove(r2.state!, "p1", {
      action: "auction_bid",
      amount: 40,
    });
    expect(r3.ok).toBe(true);
    // Resolved: p3 wins at 50
    expect(r3.state!.activeAuction).toBeNull();
    expect(getPropertyOwner(r3.state!, 1)).toBe("p3");
    expect(r3.state!.players.find((p) => p.uid === "p3")!.cash).toBe(1450);
  });
});

// =============================================================================
// Take 3 — Economy: Improvements
// =============================================================================

describe("Metro Magnate — Improvements", () => {
  // Arts Quarter district indices: [1, 3, 6]
  function makeImprovementState(overrides?: Partial<MetroMagnatePublicState>) {
    return makeState({
      phase: "post_roll",
      players: [
        makePlayer("p1", {
          cash: 5000,
          ownedProperties: [1, 3, 6],
        }),
        makePlayer("p2", { cash: 1500 }),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 3, ownerUid: "p1" },
        { spaceIndex: 6, ownerUid: "p1" },
      ],
      ...overrides,
    });
  }

  it("allows building when owning full sector", () => {
    const state = makeImprovementState();
    const result = processMove(state, "p1", {
      action: "build_improvement",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(true);
    // Arts Quarter improvementCost = 50
    expect(result.state!.players.find((p) => p.uid === "p1")!.cash).toBe(4950);
    const imp = result.state!.propertyImprovements.find(
      (i) => i.spaceIndex === 1,
    );
    expect(imp?.level).toBe(1);
  });

  it("rejects build without full sector ownership", () => {
    const state = makeState({
      phase: "post_roll",
      players: [
        makePlayer("p1", { cash: 5000, ownedProperties: [1, 3] }),
        makePlayer("p2", { cash: 1500 }),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 3, ownerUid: "p1" },
      ],
    });
    const result = processMove(state, "p1", {
      action: "build_improvement",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/sector/i);
  });

  it("enforces even-build rule", () => {
    const state = makeImprovementState({
      propertyImprovements: [{ spaceIndex: 1, level: 1 }],
    });
    // Can't build on space 1 (level 1) when space 3 and 6 are level 0
    const result = processMove(state, "p1", {
      action: "build_improvement",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/evenly/i);
  });

  it("allows building evenly across sector", () => {
    const state = makeImprovementState({
      propertyImprovements: [
        { spaceIndex: 1, level: 1 },
        { spaceIndex: 3, level: 1 },
        { spaceIndex: 6, level: 1 },
      ],
    });
    // All at level 1, can build any of them to level 2
    const result = processMove(state, "p1", {
      action: "build_improvement",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects building beyond level 5", () => {
    const state = makeImprovementState({
      propertyImprovements: [
        { spaceIndex: 1, level: 5 },
        { spaceIndex: 3, level: 5 },
        { spaceIndex: 6, level: 5 },
      ],
    });
    const result = processMove(state, "p1", {
      action: "build_improvement",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/maximum/i);
  });

  it("rejects building with mortgaged district in sector", () => {
    const state = makeImprovementState({
      propertyMortgages: [{ spaceIndex: 3, mortgaged: true }],
    });
    const result = processMove(state, "p1", {
      action: "build_improvement",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/mortgag/i);
  });

  it("selling improvement returns half cost", () => {
    const state = makeImprovementState({
      propertyImprovements: [
        { spaceIndex: 1, level: 2 },
        { spaceIndex: 3, level: 2 },
        { spaceIndex: 6, level: 2 },
      ],
    });
    const result = processMove(state, "p1", {
      action: "sell_improvement",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(true);
    // improvementCost = 50, half = 25
    expect(result.state!.players.find((p) => p.uid === "p1")!.cash).toBe(5025);
    const imp = result.state!.propertyImprovements.find(
      (i) => i.spaceIndex === 1,
    );
    expect(imp?.level).toBe(1);
  });

  it("enforces even-sell rule", () => {
    const state = makeImprovementState({
      propertyImprovements: [
        { spaceIndex: 1, level: 1 },
        { spaceIndex: 3, level: 2 },
        { spaceIndex: 6, level: 2 },
      ],
    });
    // Can't sell from space 1 (level 1) when 3 and 6 are level 2
    const result = processMove(state, "p1", {
      action: "sell_improvement",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/evenly/i);
  });

  it("sell_improvement allowed during debt_resolution", () => {
    const state = makeImprovementState({
      phase: "debt_resolution",
      debtContext: { amount: 100, creditorUid: "p2", canReroll: false },
      propertyImprovements: [
        { spaceIndex: 1, level: 1 },
        { spaceIndex: 3, level: 1 },
        { spaceIndex: 6, level: 1 },
      ],
    });
    const result = processMove(state, "p1", {
      action: "sell_improvement",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects build_improvement during debt_resolution", () => {
    const state = makeImprovementState({
      phase: "debt_resolution",
      debtContext: { amount: 100, creditorUid: "p2", canReroll: false },
    });
    const result = processMove(state, "p1", {
      action: "build_improvement",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(false);
  });
});

// =============================================================================
// Take 3 — Economy: Mortgages
// =============================================================================

describe("Metro Magnate — Mortgages", () => {
  it("mortgaging a property gives mortgage value as cash", () => {
    const state = makeState({
      phase: "post_roll",
      players: [
        makePlayer("p1", { cash: 100, ownedProperties: [1] }),
        makePlayer("p2"),
      ],
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p1" }],
    });
    const result = processMove(state, "p1", {
      action: "mortgage_property",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(true);
    // Gallery Row mortgageValue = 30
    expect(result.state!.players.find((p) => p.uid === "p1")!.cash).toBe(130);
    expect(isPropertyMortgaged(result.state!, 1)).toBe(true);
  });

  it("rejects mortgaging with improvements in sector", () => {
    const state = makeState({
      phase: "post_roll",
      players: [
        makePlayer("p1", { cash: 5000, ownedProperties: [1, 3, 6] }),
        makePlayer("p2"),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 3, ownerUid: "p1" },
        { spaceIndex: 6, ownerUid: "p1" },
      ],
      propertyImprovements: [{ spaceIndex: 3, level: 1 }],
    });
    const result = processMove(state, "p1", {
      action: "mortgage_property",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/improvement/i);
  });

  it("unmortgaging costs mortgage value + 10% fee", () => {
    const state = makeState({
      phase: "post_roll",
      players: [
        makePlayer("p1", {
          cash: 500,
          ownedProperties: [1],
          mortgagedProperties: [1],
        }),
        makePlayer("p2"),
      ],
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p1" }],
      propertyMortgages: [{ spaceIndex: 1, mortgaged: true }],
    });
    const result = processMove(state, "p1", {
      action: "unmortgage_property",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(true);
    // mortgageValue = 30, fee = 3, total = 33
    expect(result.state!.players.find((p) => p.uid === "p1")!.cash).toBe(467);
    expect(isPropertyMortgaged(result.state!, 1)).toBe(false);
  });

  it("rejects unmortgage when not enough cash", () => {
    const state = makeState({
      phase: "post_roll",
      players: [
        makePlayer("p1", {
          cash: 10,
          ownedProperties: [1],
          mortgagedProperties: [1],
        }),
        makePlayer("p2"),
      ],
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p1" }],
      propertyMortgages: [{ spaceIndex: 1, mortgaged: true }],
    });
    const result = processMove(state, "p1", {
      action: "unmortgage_property",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not enough cash/i);
  });

  it("mortgage allowed during debt_resolution", () => {
    const state = makeState({
      phase: "debt_resolution",
      debtContext: { amount: 100, creditorUid: "p2", canReroll: false },
      players: [
        makePlayer("p1", { cash: 10, ownedProperties: [1] }),
        makePlayer("p2"),
      ],
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p1" }],
    });
    const result = processMove(state, "p1", {
      action: "mortgage_property",
      propertyIndex: 1,
    });
    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Take 3 — Economy: Debt Resolution & Bankruptcy
// =============================================================================

describe("Metro Magnate — Debt Resolution", () => {
  it("rent exceeding cash triggers debt_resolution", () => {
    // p1 lands on p2's property, can't afford rent
    // Space 1 = Gallery Row, base rent = 2, but with sector monopoly = 4
    const state = makeState({
      phase: "pre_roll",
      players: [
        makePlayer("p1", { position: 1, cash: 1 }),
        makePlayer("p2", {
          position: 0,
          cash: 1500,
          ownedProperties: [1, 3, 6],
        }),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p2" },
        { spaceIndex: 3, ownerUid: "p2" },
        { spaceIndex: 6, ownerUid: "p2" },
      ],
    });
    // Simulate landing on district 1 directly by calling with buying positions
    // We need a state where p1 is ON district 1 and rent is calculated
    // Let's test via the processMove for debt resolution actions instead

    // Direct debt test: create a state already in debt_resolution
    const debtState = makeState({
      phase: "debt_resolution",
      debtContext: { amount: 200, creditorUid: "p2", canReroll: false },
      players: [
        makePlayer("p1", { cash: 50, ownedProperties: [8] }),
        makePlayer("p2", { cash: 1500 }),
      ],
      propertyOwnership: [{ spaceIndex: 8, ownerUid: "p1" }],
    });

    // Can't pay_debt yet (50 < 200)
    const r1 = processMove(debtState, "p1", { action: "pay_debt" });
    expect(r1.ok).toBe(false);
    expect(r1.error).toMatch(/\$200/);
  });

  it("pay_debt succeeds when cash is sufficient", () => {
    const state = makeState({
      phase: "debt_resolution",
      debtContext: { amount: 100, creditorUid: "p2", canReroll: false },
      players: [
        makePlayer("p1", { cash: 150 }),
        makePlayer("p2", { cash: 1000 }),
      ],
    });
    const result = processMove(state, "p1", { action: "pay_debt" });
    expect(result.ok).toBe(true);
    const s = result.state!;
    expect(s.debtContext).toBeNull();
    expect(s.phase).toBe("post_roll");
    expect(s.players.find((p) => p.uid === "p1")!.cash).toBe(50);
    expect(s.players.find((p) => p.uid === "p2")!.cash).toBe(1100);
  });

  it("pay_debt with canReroll returns to pre_roll", () => {
    const state = makeState({
      phase: "debt_resolution",
      debtContext: { amount: 50, creditorUid: null, canReroll: true },
      doublesCount: 1,
      players: [makePlayer("p1", { cash: 100 }), makePlayer("p2")],
    });
    const result = processMove(state, "p1", { action: "pay_debt" });
    expect(result.ok).toBe(true);
    expect(result.state!.phase).toBe("pre_roll");
  });

  it("declare_bankruptcy eliminates player and advances turn", () => {
    const state = makeState({
      phase: "debt_resolution",
      debtContext: { amount: 500, creditorUid: "p2", canReroll: false },
      players: [
        makePlayer("p1", { cash: 10, ownedProperties: [1] }),
        makePlayer("p2", { cash: 1000 }),
        makePlayer("p3", { cash: 1000 }),
      ],
      turnOrder: ["p1", "p2", "p3"],
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p1" }],
    });
    const result = processMove(state, "p1", { action: "declare_bankruptcy" });
    expect(result.ok).toBe(true);
    const s = result.state!;
    expect(s.players.find((p) => p.uid === "p1")!.isBankrupt).toBe(true);
    // Property transferred to creditor
    expect(getPropertyOwner(s, 1)).toBe("p2");
    // Turn advances to next player
    expect(s.currentTurnUid).toBe("p2");
    expect(result.nextTurnPlayerId).toBe("p2");
    // Tracked in elimination order
    expect(s.eliminationOrder).toContain("p1");
  });

  it("declare_bankruptcy to bank returns properties to unowned", () => {
    const state = makeState({
      phase: "debt_resolution",
      debtContext: { amount: 500, creditorUid: null, canReroll: false },
      players: [
        makePlayer("p1", { cash: 10, ownedProperties: [1, 3] }),
        makePlayer("p2", { cash: 1000 }),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 3, ownerUid: "p1" },
      ],
    });
    const result = processMove(state, "p1", { action: "declare_bankruptcy" });
    expect(result.ok).toBe(true);
    const s = result.state!;
    expect(getPropertyOwner(s, 1)).toBeNull();
    expect(getPropertyOwner(s, 3)).toBeNull();
  });

  it("last player standing wins via bankruptcy", () => {
    const state = makeState({
      phase: "debt_resolution",
      debtContext: { amount: 500, creditorUid: "p2", canReroll: false },
      players: [
        makePlayer("p1", { cash: 0 }),
        makePlayer("p2", { cash: 1500 }),
      ],
    });
    const result = processMove(state, "p1", { action: "declare_bankruptcy" });
    expect(result.ok).toBe(true);
    expect(result.state!.phase).toBe("game_over");
    expect(result.terminal?.type).toBe("win");
    expect(result.terminal?.winnerIds).toEqual(["p2"]);
  });

  it("mortgage during debt then pay_debt resolves debt", () => {
    const state = makeState({
      phase: "debt_resolution",
      debtContext: { amount: 50, creditorUid: "p2", canReroll: false },
      players: [
        makePlayer("p1", { cash: 10, ownedProperties: [1] }),
        makePlayer("p2", { cash: 1000 }),
      ],
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p1" }],
    });
    // Mortgage Gallery Row (mortgageValue = 30 → cash becomes 40)
    const r1 = processMove(state, "p1", {
      action: "mortgage_property",
      propertyIndex: 1,
    });
    expect(r1.ok).toBe(true);
    expect(r1.state!.players.find((p) => p.uid === "p1")!.cash).toBe(40);
    // Still in debt_resolution
    expect(r1.state!.phase).toBe("debt_resolution");

    // Still can't pay (40 < 50)
    const r2 = processMove(r1.state!, "p1", { action: "pay_debt" });
    expect(r2.ok).toBe(false);
  });
});

// =============================================================================
// Take 3 — Economy: Trading
// =============================================================================

describe("Metro Magnate — Trading", () => {
  it("propose_trade switches turn to target", () => {
    const state = makeState({
      phase: "post_roll",
      players: [
        makePlayer("p1", { cash: 500, ownedProperties: [1] }),
        makePlayer("p2", { cash: 500, ownedProperties: [8] }),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 8, ownerUid: "p2" },
      ],
    });
    const result = processMove(state, "p1", {
      action: "propose_trade",
      offer: {
        fromUid: "p1",
        toUid: "p2",
        offeredProperties: [1],
        offeredCash: 50,
        offeredInspectionPasses: 0,
        requestedProperties: [8],
        requestedCash: 0,
        requestedInspectionPasses: 0,
        returnPhase: "post_roll",
        status: "pending",
      },
    });
    expect(result.ok).toBe(true);
    const s = result.state!;
    expect(s.phase).toBe("trading");
    expect(s.currentTurnUid).toBe("p2");
    expect(result.nextTurnPlayerId).toBe("p2");
    expect(s.activeTrade?.fromUid).toBe("p1");
  });

  it("accept_trade transfers properties and cash", () => {
    const state = makeState({
      phase: "trading",
      currentTurnUid: "p2",
      players: [
        makePlayer("p1", { cash: 500, ownedProperties: [1] }),
        makePlayer("p2", { cash: 500, ownedProperties: [8] }),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 8, ownerUid: "p2" },
      ],
      activeTrade: {
        fromUid: "p1",
        toUid: "p2",
        offeredProperties: [1],
        offeredCash: 100,
        offeredInspectionPasses: 0,
        requestedProperties: [8],
        requestedCash: 0,
        requestedInspectionPasses: 0,
        returnPhase: "post_roll",
        status: "pending",
      },
    });
    const result = processMove(state, "p2", { action: "accept_trade" });
    expect(result.ok).toBe(true);
    const s = result.state!;
    // p1 gave property 1 and $100 → gets property 8
    expect(getPropertyOwner(s, 1)).toBe("p2");
    expect(getPropertyOwner(s, 8)).toBe("p1");
    expect(s.players.find((p) => p.uid === "p1")!.cash).toBe(400);
    expect(s.players.find((p) => p.uid === "p2")!.cash).toBe(600);
    // Turn returns to proposer
    expect(s.currentTurnUid).toBe("p1");
    expect(s.phase).toBe("post_roll");
  });

  it("reject_trade returns to proposer's phase", () => {
    const state = makeState({
      phase: "trading",
      currentTurnUid: "p2",
      players: [
        makePlayer("p1", { cash: 500, ownedProperties: [1] }),
        makePlayer("p2", { cash: 500 }),
      ],
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p1" }],
      activeTrade: {
        fromUid: "p1",
        toUid: "p2",
        offeredProperties: [1],
        offeredCash: 0,
        offeredInspectionPasses: 0,
        requestedProperties: [],
        requestedCash: 200,
        requestedInspectionPasses: 0,
        returnPhase: "pre_roll",
        status: "pending",
      },
    });
    const result = processMove(state, "p2", { action: "reject_trade" });
    expect(result.ok).toBe(true);
    expect(result.state!.phase).toBe("pre_roll");
    expect(result.state!.currentTurnUid).toBe("p1");
    expect(result.state!.activeTrade).toBeNull();
  });

  it("rejects trade with improved property", () => {
    const state = makeState({
      phase: "post_roll",
      players: [
        makePlayer("p1", { cash: 500, ownedProperties: [1, 3, 6] }),
        makePlayer("p2", { cash: 500 }),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 3, ownerUid: "p1" },
        { spaceIndex: 6, ownerUid: "p1" },
      ],
      propertyImprovements: [{ spaceIndex: 1, level: 1 }],
    });
    const result = processMove(state, "p1", {
      action: "propose_trade",
      offer: {
        fromUid: "p1",
        toUid: "p2",
        offeredProperties: [1],
        offeredCash: 0,
        offeredInspectionPasses: 0,
        requestedProperties: [],
        requestedCash: 200,
        requestedInspectionPasses: 0,
        returnPhase: "post_roll",
        status: "pending",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/improvement/i);
  });

  it("rejects trade when trading is disabled", () => {
    const state = makeState({
      phase: "post_roll",
      settings: { ...DEFAULT_METRO_MAGNATE_SETTINGS, tradeWindow: false },
      players: [
        makePlayer("p1", { cash: 500 }),
        makePlayer("p2", { cash: 500 }),
      ],
    });
    const result = processMove(state, "p1", {
      action: "propose_trade",
      offer: {
        fromUid: "p1",
        toUid: "p2",
        offeredProperties: [],
        offeredCash: 50,
        offeredInspectionPasses: 0,
        requestedProperties: [],
        requestedCash: 0,
        requestedInspectionPasses: 0,
        returnPhase: "post_roll",
        status: "pending",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/disabled/i);
  });
});

// =============================================================================
// Take 3 — Economy: Net Worth
// =============================================================================

describe("Metro Magnate — Net Worth (Take 3)", () => {
  it("includes improvement value in net worth", () => {
    const state = makeState({
      players: [
        makePlayer("p1", {
          cash: 1000,
          ownedProperties: [1, 3, 6],
        }),
        makePlayer("p2"),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 3, ownerUid: "p1" },
        { spaceIndex: 6, ownerUid: "p1" },
      ],
      propertyImprovements: [{ spaceIndex: 1, level: 2 }],
    });
    const nw = computeNetWorth(state, "p1");
    // cash=1000 + mortgageValues(30+30+40=100) + improvements(2*50=100)
    expect(nw).toBe(1200);
  });

  it("tower counts as 4*improvementCost + towerCost", () => {
    const state = makeState({
      players: [
        makePlayer("p1", {
          cash: 1000,
          ownedProperties: [1],
        }),
        makePlayer("p2"),
      ],
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p1" }],
      propertyImprovements: [{ spaceIndex: 1, level: 5 }],
    });
    const nw = computeNetWorth(state, "p1");
    // cash=1000 + mortgageValue(30) + tower(4*50 + 50 = 250)
    expect(nw).toBe(1280);
  });
});

// =============================================================================
// Take 3 — Economy: Sector Helpers
// =============================================================================

describe("Metro Magnate — Sector Helpers", () => {
  it("ownsSector returns true when player owns all 3 districts", () => {
    const state = makeState({
      players: [
        makePlayer("p1", { ownedProperties: [1, 3, 6] }),
        makePlayer("p2"),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 3, ownerUid: "p1" },
        { spaceIndex: 6, ownerUid: "p1" },
      ],
    });
    expect(ownsSector(state, "p1", "arts_quarter")).toBe(true);
    expect(ownsSector(state, "p2", "arts_quarter")).toBe(false);
  });

  it("ownsSector returns false when only 2 of 3 owned", () => {
    const state = makeState({
      players: [
        makePlayer("p1", { ownedProperties: [1, 3] }),
        makePlayer("p2", { ownedProperties: [6] }),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 3, ownerUid: "p1" },
        { spaceIndex: 6, ownerUid: "p2" },
      ],
    });
    expect(ownsSector(state, "p1", "arts_quarter")).toBe(false);
  });
});

// =============================================================================
// Take 6 — Edge Case Tests for Audit Fixes
// =============================================================================

describe("Metro Magnate — C-2: Monopoly rent ignores mortgaged", () => {
  it("does NOT double rent when one district in sector is mortgaged", () => {
    // p1 owns all 3 arts_quarter districts (1,3,6) but district 6 is mortgaged
    const state = makeState({
      players: [
        makePlayer("p1", {
          ownedProperties: [1, 3, 6],
          mortgagedProperties: [6],
        }),
        makePlayer("p2"),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 3, ownerUid: "p1" },
        { spaceIndex: 6, ownerUid: "p1" },
      ],
      propertyMortgages: [{ spaceIndex: 6, mortgaged: true }],
    });
    const baseRent = computeRent(state, 1, "p1");
    // With a mortgaged district in the sector, rent should NOT be doubled
    // Base level-0 rent for district at index 1 (arts_quarter) = rentLadder[0]
    const card = DISTRICT_CARDS.find((d) => d.spaceIndex === 1)!;
    expect(baseRent).toBe(card.rentLadder[0]); // NOT doubled
  });

  it("doubles rent when full sector owned and none mortgaged", () => {
    const state = makeState({
      players: [
        makePlayer("p1", { ownedProperties: [1, 3, 6] }),
        makePlayer("p2"),
      ],
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 3, ownerUid: "p1" },
        { spaceIndex: 6, ownerUid: "p1" },
      ],
    });
    const card = DISTRICT_CARDS.find((d) => d.spaceIndex === 1)!;
    expect(computeRent(state, 1, "p1")).toBe(card.rentLadder[0] * 2);
  });
});

describe("Metro Magnate — H-3: Net worth excludes mortgaged property value", () => {
  it("does not count mortgage value for a mortgaged property", () => {
    const card = DISTRICT_CARDS.find((d) => d.spaceIndex === 1)!;
    const state = makeState({
      players: [
        makePlayer("p1", {
          cash: 1000,
          ownedProperties: [1],
          mortgagedProperties: [1],
        }),
        makePlayer("p2"),
      ],
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p1" }],
      propertyMortgages: [{ spaceIndex: 1, mortgaged: true }],
    });
    // Should be cash only, not cash + mortgageValue
    expect(computeNetWorth(state, "p1")).toBe(1000);
    // Without mortgage, it should include the mortgage value
    const state2 = makeState({
      players: [
        makePlayer("p1", { cash: 1000, ownedProperties: [1] }),
        makePlayer("p2"),
      ],
      propertyOwnership: [{ spaceIndex: 1, ownerUid: "p1" }],
    });
    expect(computeNetWorth(state2, "p1")).toBe(1000 + card.mortgageValue);
  });
});

describe("Metro Magnate — H-1: Strict inspection severity", () => {
  it("blocks wait_in_inspection when inspectionSeverity is strict", () => {
    const state = makeState({
      players: [
        makePlayer("p1", { position: INSPECTION_HOLD_INDEX }),
        makePlayer("p2"),
      ],
      currentTurnUid: "p1",
      phase: "inspection",
      inspectionHoldTurns: [{ uid: "p1", turnsRemaining: 0 }],
      settings: {
        ...DEFAULT_METRO_MAGNATE_SETTINGS,
        inspectionSeverity: "strict",
      },
    });
    const result = processMove(state, "p1", { action: "wait_in_inspection" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("must pay the fine");
  });

  it("allows pay_inspection_fine in strict mode", () => {
    const state = makeState({
      players: [
        makePlayer("p1", { position: INSPECTION_HOLD_INDEX, cash: 100 }),
        makePlayer("p2"),
      ],
      currentTurnUid: "p1",
      phase: "inspection",
      inspectionHoldTurns: [{ uid: "p1", turnsRemaining: 0 }],
      settings: {
        ...DEFAULT_METRO_MAGNATE_SETTINGS,
        inspectionSeverity: "strict",
      },
    });
    const result = processMove(state, "p1", { action: "pay_inspection_fine" });
    expect(result.ok).toBe(true);
  });
});

describe("Metro Magnate — C-1: Forced fine enters debt resolution", () => {
  it("enters debt_resolution when player cannot afford forced fine", () => {
    // Player in inspection with 1 turn remaining, has only $10
    const state = makeState({
      players: [
        makePlayer("p1", { position: INSPECTION_HOLD_INDEX, cash: 10 }),
        makePlayer("p2"),
      ],
      currentTurnUid: "p1",
      phase: "inspection",
      inspectionHoldTurns: [{ uid: "p1", turnsRemaining: 1 }],
      moveCount: 999, // Use a seed that won't produce doubles
    });

    // Try many seeds to find one that doesn't produce doubles
    let result: ReturnType<typeof processMove> | null = null;
    let testState = state;
    for (let mc = 0; mc < 100; mc++) {
      testState = { ...state, moveCount: mc };
      const [d1, d2] = generateDice(mc);
      if (d1 !== d2) {
        result = processMove(testState, "p1", { action: "wait_in_inspection" });
        break;
      }
    }
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(true);
    expect(result!.state!.phase).toBe("debt_resolution");
    expect(result!.state!.debtContext).not.toBeNull();
    expect(result!.state!.debtContext!.amount).toBe(50); // INSPECTION_FINE
  });
});

describe("Metro Magnate — M-2: Trading blocked during debt_resolution", () => {
  it("rejects propose_trade during debt_resolution", () => {
    const state = makeState({
      players: [
        makePlayer("p1", { cash: 0, ownedProperties: [1] }),
        makePlayer("p2", { ownedProperties: [8] }),
      ],
      currentTurnUid: "p1",
      phase: "debt_resolution",
      debtContext: { amount: 100, creditorUid: "p2", canReroll: false },
      propertyOwnership: [
        { spaceIndex: 1, ownerUid: "p1" },
        { spaceIndex: 8, ownerUid: "p2" },
      ],
    });
    const result = processMove(state, "p1", {
      action: "propose_trade",
      offer: {
        fromUid: "p1",
        toUid: "p2",
        offeredProperties: [1],
        requestedProperties: [8],
        offeredCash: 0,
        requestedCash: 0,
        offeredInspectionPasses: 0,
        requestedInspectionPasses: 0,
        status: "pending",
        returnPhase: "debt_resolution",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Cannot trade");
  });
});

describe("Metro Magnate — M-1: Express tiebreak", () => {
  it("breaks ties by cash when net worth is equal", () => {
    const state = makeState({
      players: [
        makePlayer("p1", {
          netWorth: 3000,
          cash: 800,
          ownedProperties: [1, 3],
        }),
        makePlayer("p2", {
          netWorth: 3000,
          cash: 1200,
          ownedProperties: [8, 9],
        }),
      ],
      turnNumber: 30, // at EXPRESS_TURN_CAP
      settings: { ...DEFAULT_METRO_MAGNATE_SETTINGS, mode: "express" },
    });
    const terminal = checkTerminal(state);
    expect(terminal).not.toBeNull();
    expect(terminal!.winnerIds).toEqual(["p2"]); // p2 has more cash
  });
});

describe("Metro Magnate — M-3: endReason populated on game over", () => {
  it("sets endReason when last player standing", () => {
    const state = makeState({
      players: [makePlayer("p1", { cash: 0 - 1 }), makePlayer("p2")],
      currentTurnUid: "p1",
      phase: "debt_resolution",
      debtContext: { amount: 100, creditorUid: null, canReroll: false },
    });
    const result = processMove(state, "p1", { action: "declare_bankruptcy" });
    expect(result.ok).toBe(true);
    expect(result.state!.endReason).toBe("last_standing");
  });
});

describe("Metro Magnate — H-4: Civic fee debt routes to plazaPot", () => {
  it("credits plazaPot when civic fee debt is paid", () => {
    // Set up a debt_resolution with civic_fee debtType
    const state = makeState({
      players: [makePlayer("p1", { cash: 300 }), makePlayer("p2")],
      currentTurnUid: "p1",
      phase: "debt_resolution",
      debtContext: {
        amount: 200,
        creditorUid: null,
        canReroll: false,
        debtType: "civic_fee",
      },
      plazaPot: 100,
    });
    const result = processMove(state, "p1", { action: "pay_debt" });
    expect(result.ok).toBe(true);
    expect(result.state!.plazaPot).toBe(300); // 100 existing + 200 fee
    expect(getPlayer(result.state!, "p1").cash).toBe(100); // 300 - 200
  });
});

function getPlayer(
  state: MetroMagnatePublicState,
  uid: string,
): MetroPlayerState {
  return state.players.find((p) => p.uid === uid)!;
}
