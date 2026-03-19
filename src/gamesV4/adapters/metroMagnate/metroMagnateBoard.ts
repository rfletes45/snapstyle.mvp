/**
 * Games V4 — Metro Magnate Board Definitions
 *
 * Static board data for the 36-space Metro Magnate board.
 * 6 sectors × 3 districts = 18 districts, plus special spaces.
 *
 * Board layout (indices 0–35, clockwise):
 *   0  Central Terminal
 *   1  District (Arts Quarter #1)
 *   2  City Brief
 *   3  District (Arts Quarter #2)
 *   4  Civic Fee
 *   5  Transit Line 1
 *   6  District (Arts Quarter #3)
 *   7  Market Shift
 *   8  District (Harbor Ward #1)
 *   9  District (Harbor Ward #2)
 *  10  Inspection Hold
 *  11  District (Harbor Ward #3)
 *  12  Service Node 1
 *  13  District (Market Row #1)
 *  14  City Brief
 *  15  District (Market Row #2)
 *  16  Transit Line 2
 *  17  District (Market Row #3)
 *  18  Plaza
 *  19  District (Foundry Belt #1)
 *  20  Market Shift
 *  21  District (Foundry Belt #2)
 *  22  Civic Fee
 *  23  District (Foundry Belt #3)
 *  24  Transit Line 3
 *  25  District (Tech Heights #1)
 *  26  District (Tech Heights #2)
 *  27  Service Node 2
 *  28  District (Tech Heights #3)
 *  29  Market Shift
 *  30  City Brief
 *  31  District (Civic Square #1)
 *  32  District (Civic Square #2)
 *  33  Detour to Inspection
 *  34  District (Civic Square #3)
 *  35  Transit Line 4
 *
 * @module gamesV4/adapters/metroMagnate/metroMagnateBoard
 */

import type {
  BoardSpace,
  CityBriefCard,
  DistrictCard,
  MarketShiftCard,
  SectorDef,
  SectorId,
  ServiceNodeCard,
  TransitLineCard,
} from "./metroMagnateTypes";

// =============================================================================
// Board Spaces (36)
// =============================================================================

export const BOARD_SPACES: readonly BoardSpace[] = [
  { index: 0, type: "central_terminal", name: "Central Terminal" },
  {
    index: 1,
    type: "district",
    name: "Gallery Row",
    sectorId: "arts_quarter",
    sectorPosition: 0,
  },
  { index: 2, type: "city_brief", name: "City Brief" },
  {
    index: 3,
    type: "district",
    name: "Studio Lane",
    sectorId: "arts_quarter",
    sectorPosition: 1,
  },
  { index: 4, type: "civic_fee", name: "Civic Fee" },
  { index: 5, type: "transit_line", name: "Northbound Line", transitGroup: 0 },
  {
    index: 6,
    type: "district",
    name: "Mural Square",
    sectorId: "arts_quarter",
    sectorPosition: 2,
  },
  { index: 7, type: "market_shift", name: "Market Shift" },
  {
    index: 8,
    type: "district",
    name: "Pier Walk",
    sectorId: "harbor_ward",
    sectorPosition: 0,
  },
  {
    index: 9,
    type: "district",
    name: "Anchor Quay",
    sectorId: "harbor_ward",
    sectorPosition: 1,
  },
  { index: 10, type: "inspection_hold", name: "Inspection Hold" },
  {
    index: 11,
    type: "district",
    name: "Lighthouse Way",
    sectorId: "harbor_ward",
    sectorPosition: 2,
  },
  { index: 12, type: "service_node", name: "Metro Power Co.", serviceGroup: 0 },
  {
    index: 13,
    type: "district",
    name: "Bazaar Alley",
    sectorId: "market_row",
    sectorPosition: 0,
  },
  { index: 14, type: "city_brief", name: "City Brief" },
  {
    index: 15,
    type: "district",
    name: "Vendor Court",
    sectorId: "market_row",
    sectorPosition: 1,
  },
  { index: 16, type: "transit_line", name: "Crosstown Line", transitGroup: 1 },
  {
    index: 17,
    type: "district",
    name: "Trade Hall",
    sectorId: "market_row",
    sectorPosition: 2,
  },
  { index: 18, type: "plaza", name: "Grand Plaza" },
  {
    index: 19,
    type: "district",
    name: "Smelter Road",
    sectorId: "foundry_belt",
    sectorPosition: 0,
  },
  { index: 20, type: "market_shift", name: "Market Shift" },
  {
    index: 21,
    type: "district",
    name: "Iron Works",
    sectorId: "foundry_belt",
    sectorPosition: 1,
  },
  { index: 22, type: "civic_fee", name: "Civic Fee" },
  {
    index: 23,
    type: "district",
    name: "Forge Yard",
    sectorId: "foundry_belt",
    sectorPosition: 2,
  },
  { index: 24, type: "transit_line", name: "Southbound Line", transitGroup: 2 },
  {
    index: 25,
    type: "district",
    name: "Data Drive",
    sectorId: "tech_heights",
    sectorPosition: 0,
  },
  {
    index: 26,
    type: "district",
    name: "Circuit Park",
    sectorId: "tech_heights",
    sectorPosition: 1,
  },
  {
    index: 27,
    type: "service_node",
    name: "Metro Water Works",
    serviceGroup: 1,
  },
  {
    index: 28,
    type: "district",
    name: "Signal Tower",
    sectorId: "tech_heights",
    sectorPosition: 2,
  },
  { index: 29, type: "market_shift", name: "Market Shift" },
  { index: 30, type: "city_brief", name: "City Brief" },
  {
    index: 31,
    type: "district",
    name: "Council Block",
    sectorId: "civic_square",
    sectorPosition: 0,
  },
  {
    index: 32,
    type: "district",
    name: "Embassy Row",
    sectorId: "civic_square",
    sectorPosition: 1,
  },
  { index: 33, type: "detour_to_inspection", name: "Detour to Inspection" },
  {
    index: 34,
    type: "district",
    name: "Capitol Heights",
    sectorId: "civic_square",
    sectorPosition: 2,
  },
  { index: 35, type: "transit_line", name: "Express Line", transitGroup: 3 },
] as const;

/** Total number of board spaces. */
export const BOARD_SIZE = 36;

/** Index of the Central Terminal (pass/collect salary). */
export const CENTRAL_TERMINAL_INDEX = 0;

/** Index of the Inspection Hold space. */
export const INSPECTION_HOLD_INDEX = 10;

/** Index of the Detour to Inspection space. */
export const DETOUR_TO_INSPECTION_INDEX = 33;

/** Index of the Grand Plaza space. */
export const PLAZA_INDEX = 18;

// =============================================================================
// Sectors
// =============================================================================

export const SECTORS: readonly SectorDef[] = [
  {
    sectorId: "arts_quarter",
    name: "Arts Quarter",
    color: "#8B5CF6",
    districtIndices: [1, 3, 6],
  },
  {
    sectorId: "harbor_ward",
    name: "Harbor Ward",
    color: "#06B6D4",
    districtIndices: [8, 9, 11],
  },
  {
    sectorId: "market_row",
    name: "Market Row",
    color: "#F59E0B",
    districtIndices: [13, 15, 17],
  },
  {
    sectorId: "foundry_belt",
    name: "Foundry Belt",
    color: "#EF4444",
    districtIndices: [19, 21, 23],
  },
  {
    sectorId: "tech_heights",
    name: "Tech Heights",
    color: "#10B981",
    districtIndices: [25, 26, 28],
  },
  {
    sectorId: "civic_square",
    name: "Civic Square",
    color: "#3B82F6",
    districtIndices: [31, 32, 34],
  },
];

// =============================================================================
// District Cards (18)
// =============================================================================

/**
 * Lease costs and rent ladders for each district.
 * rentLadder: [base, lvl1, lvl2, lvl3, lvl4, tower]
 * Improvements 1–4 cost improvementCost each; level 5 (Tower) costs towerCost.
 */
export const DISTRICT_CARDS: readonly DistrictCard[] = [
  // Arts Quarter (cheapest sector)
  {
    spaceIndex: 1,
    name: "Gallery Row",
    sectorId: "arts_quarter",
    leaseCost: 60,
    rentLadder: [2, 10, 30, 90, 160, 250],
    improvementCost: 50,
    towerCost: 50,
    mortgageValue: 30,
  },
  {
    spaceIndex: 3,
    name: "Studio Lane",
    sectorId: "arts_quarter",
    leaseCost: 60,
    rentLadder: [4, 20, 60, 180, 320, 450],
    improvementCost: 50,
    towerCost: 50,
    mortgageValue: 30,
  },
  {
    spaceIndex: 6,
    name: "Mural Square",
    sectorId: "arts_quarter",
    leaseCost: 80,
    rentLadder: [6, 30, 90, 270, 400, 550],
    improvementCost: 50,
    towerCost: 50,
    mortgageValue: 40,
  },

  // Harbor Ward
  {
    spaceIndex: 8,
    name: "Pier Walk",
    sectorId: "harbor_ward",
    leaseCost: 100,
    rentLadder: [6, 30, 90, 270, 400, 550],
    improvementCost: 50,
    towerCost: 50,
    mortgageValue: 50,
  },
  {
    spaceIndex: 9,
    name: "Anchor Quay",
    sectorId: "harbor_ward",
    leaseCost: 100,
    rentLadder: [6, 30, 90, 270, 400, 550],
    improvementCost: 50,
    towerCost: 50,
    mortgageValue: 50,
  },
  {
    spaceIndex: 11,
    name: "Lighthouse Way",
    sectorId: "harbor_ward",
    leaseCost: 120,
    rentLadder: [8, 40, 100, 300, 450, 600],
    improvementCost: 50,
    towerCost: 50,
    mortgageValue: 60,
  },

  // Market Row
  {
    spaceIndex: 13,
    name: "Bazaar Alley",
    sectorId: "market_row",
    leaseCost: 140,
    rentLadder: [10, 50, 150, 450, 625, 750],
    improvementCost: 100,
    towerCost: 100,
    mortgageValue: 70,
  },
  {
    spaceIndex: 15,
    name: "Vendor Court",
    sectorId: "market_row",
    leaseCost: 140,
    rentLadder: [10, 50, 150, 450, 625, 750],
    improvementCost: 100,
    towerCost: 100,
    mortgageValue: 70,
  },
  {
    spaceIndex: 17,
    name: "Trade Hall",
    sectorId: "market_row",
    leaseCost: 160,
    rentLadder: [12, 60, 180, 500, 700, 900],
    improvementCost: 100,
    towerCost: 100,
    mortgageValue: 80,
  },

  // Foundry Belt
  {
    spaceIndex: 19,
    name: "Smelter Road",
    sectorId: "foundry_belt",
    leaseCost: 180,
    rentLadder: [14, 70, 200, 550, 750, 950],
    improvementCost: 100,
    towerCost: 100,
    mortgageValue: 90,
  },
  {
    spaceIndex: 21,
    name: "Iron Works",
    sectorId: "foundry_belt",
    leaseCost: 180,
    rentLadder: [14, 70, 200, 550, 750, 950],
    improvementCost: 100,
    towerCost: 100,
    mortgageValue: 90,
  },
  {
    spaceIndex: 23,
    name: "Forge Yard",
    sectorId: "foundry_belt",
    leaseCost: 200,
    rentLadder: [16, 80, 220, 600, 800, 1000],
    improvementCost: 100,
    towerCost: 100,
    mortgageValue: 100,
  },

  // Tech Heights
  {
    spaceIndex: 25,
    name: "Data Drive",
    sectorId: "tech_heights",
    leaseCost: 220,
    rentLadder: [18, 90, 250, 700, 875, 1050],
    improvementCost: 150,
    towerCost: 150,
    mortgageValue: 110,
  },
  {
    spaceIndex: 26,
    name: "Circuit Park",
    sectorId: "tech_heights",
    leaseCost: 220,
    rentLadder: [18, 90, 250, 700, 875, 1050],
    improvementCost: 150,
    towerCost: 150,
    mortgageValue: 110,
  },
  {
    spaceIndex: 28,
    name: "Signal Tower",
    sectorId: "tech_heights",
    leaseCost: 240,
    rentLadder: [20, 100, 300, 750, 925, 1100],
    improvementCost: 150,
    towerCost: 150,
    mortgageValue: 120,
  },

  // Civic Square (most expensive)
  {
    spaceIndex: 31,
    name: "Council Block",
    sectorId: "civic_square",
    leaseCost: 280,
    rentLadder: [22, 110, 330, 800, 975, 1150],
    improvementCost: 200,
    towerCost: 200,
    mortgageValue: 140,
  },
  {
    spaceIndex: 32,
    name: "Embassy Row",
    sectorId: "civic_square",
    leaseCost: 300,
    rentLadder: [26, 130, 390, 900, 1100, 1275],
    improvementCost: 200,
    towerCost: 200,
    mortgageValue: 150,
  },
  {
    spaceIndex: 34,
    name: "Capitol Heights",
    sectorId: "civic_square",
    leaseCost: 350,
    rentLadder: [35, 175, 500, 1100, 1300, 1500],
    improvementCost: 200,
    towerCost: 200,
    mortgageValue: 175,
  },
];

// =============================================================================
// Transit Line Cards (4)
// =============================================================================

export const TRANSIT_LINE_CARDS: readonly TransitLineCard[] = [
  {
    spaceIndex: 5,
    name: "Northbound Line",
    transitGroup: 0,
    leaseCost: 200,
    rentByCount: [25, 50, 100, 200],
    mortgageValue: 100,
  },
  {
    spaceIndex: 16,
    name: "Crosstown Line",
    transitGroup: 1,
    leaseCost: 200,
    rentByCount: [25, 50, 100, 200],
    mortgageValue: 100,
  },
  {
    spaceIndex: 24,
    name: "Southbound Line",
    transitGroup: 2,
    leaseCost: 200,
    rentByCount: [25, 50, 100, 200],
    mortgageValue: 100,
  },
  {
    spaceIndex: 35,
    name: "Express Line",
    transitGroup: 3,
    leaseCost: 200,
    rentByCount: [25, 50, 100, 200],
    mortgageValue: 100,
  },
];

// =============================================================================
// Service Node Cards (2)
// =============================================================================

export const SERVICE_NODE_CARDS: readonly ServiceNodeCard[] = [
  {
    spaceIndex: 12,
    name: "Metro Power Co.",
    serviceGroup: 0,
    leaseCost: 150,
    multiplierByCount: [4, 10],
    mortgageValue: 75,
  },
  {
    spaceIndex: 27,
    name: "Metro Water Works",
    serviceGroup: 1,
    leaseCost: 150,
    multiplierByCount: [4, 10],
    mortgageValue: 75,
  },
];

// =============================================================================
// Civic Fee Amounts
// =============================================================================

/** Flat tax paid when landing on a Civic Fee space. */
export const CIVIC_FEE_AMOUNTS: Record<number, number> = {
  4: 200,
  22: 100,
};

// =============================================================================
// Market Shift Deck (16 cards)
// =============================================================================

export const MARKET_SHIFT_DECK: readonly MarketShiftCard[] = [
  {
    id: 0,
    text: "Metro subsidy! Collect $200.",
    effect: { type: "gain", amount: 200 },
  },
  {
    id: 1,
    text: "Stock dividend pays $50.",
    effect: { type: "gain", amount: 50 },
  },
  {
    id: 2,
    text: "Tax refund. Collect $20.",
    effect: { type: "gain", amount: 20 },
  },
  {
    id: 3,
    text: "Board meeting bonus. Collect $150.",
    effect: { type: "gain", amount: 150 },
  },
  {
    id: 4,
    text: "Sale of surplus materials. Collect $45.",
    effect: { type: "gain", amount: 45 },
  },
  {
    id: 5,
    text: "Consultancy fee. Collect $25.",
    effect: { type: "gain", amount: 25 },
  },
  {
    id: 6,
    text: "Collect $50 from each player.",
    effect: { type: "collect_from_each", amount: 50 },
  },
  {
    id: 7,
    text: "Market downturn. Pay $50.",
    effect: { type: "lose", amount: 50 },
  },
  {
    id: 8,
    text: "Emergency repairs. Pay $40 per improvement, $115 per Tower.",
    effect: { type: "repair", perImprovement: 40, perTower: 115 },
  },
  {
    id: 9,
    text: "Regulatory fine. Pay $100.",
    effect: { type: "lose", amount: 100 },
  },
  {
    id: 10,
    text: "Advance to Central Terminal. Collect salary.",
    effect: { type: "move_to", spaceIndex: 0 },
  },
  {
    id: 11,
    text: "Advance to Bazaar Alley.",
    effect: { type: "move_to", spaceIndex: 13 },
  },
  {
    id: 12,
    text: "Advance to Data Drive.",
    effect: { type: "move_to", spaceIndex: 25 },
  },
  {
    id: 13,
    text: "Advance to Northbound Line.",
    effect: { type: "move_to", spaceIndex: 5 },
  },
  {
    id: 14,
    text: "Go back 3 spaces.",
    effect: { type: "move_relative", spaces: -3 },
  },
  {
    id: 15,
    text: "Report for inspection immediately.",
    effect: { type: "go_to_inspection" },
  },
];

// =============================================================================
// City Brief Deck (16 cards)
// =============================================================================

export const CITY_BRIEF_DECK: readonly CityBriefCard[] = [
  {
    id: 0,
    text: "Transit authority award. Collect $100.",
    effect: { type: "gain", amount: 100 },
  },
  {
    id: 1,
    text: "Community grant. Collect $25.",
    effect: { type: "gain", amount: 25 },
  },
  {
    id: 2,
    text: "Heritage trust pays out. Collect $150.",
    effect: { type: "gain", amount: 150 },
  },
  {
    id: 3,
    text: "Art auction proceeds. Collect $10.",
    effect: { type: "gain", amount: 10 },
  },
  {
    id: 4,
    text: "Festival revenue. Collect $20.",
    effect: { type: "gain", amount: 20 },
  },
  {
    id: 5,
    text: "Receive inspection clearance card.",
    effect: { type: "get_out_of_inspection" },
  },
  {
    id: 6,
    text: "City assessment. Pay $50 per improvement, $150 per Tower.",
    effect: { type: "repair", perImprovement: 50, perTower: 150 },
  },
  {
    id: 7,
    text: "Hospital bill. Pay $100.",
    effect: { type: "lose", amount: 100 },
  },
  {
    id: 8,
    text: "School levy. Pay $150.",
    effect: { type: "lose", amount: 150 },
  },
  {
    id: 9,
    text: "Pay each player $50.",
    effect: { type: "pay_each", amount: 50 },
  },
  {
    id: 10,
    text: "Advance to Central Terminal.",
    effect: { type: "move_to", spaceIndex: 0 },
  },
  {
    id: 11,
    text: "Advance to Grand Plaza.",
    effect: { type: "move_to", spaceIndex: 18 },
  },
  {
    id: 12,
    text: "Advance to Gallery Row.",
    effect: { type: "move_to", spaceIndex: 1 },
  },
  {
    id: 13,
    text: "Report to Inspection Hold.",
    effect: { type: "go_to_inspection" },
  },
  {
    id: 14,
    text: "Advance to Pier Walk.",
    effect: { type: "move_to", spaceIndex: 8 },
  },
  {
    id: 15,
    text: "Infrastructure fine. Pay $200.",
    effect: { type: "lose", amount: 200 },
  },
];

// =============================================================================
// Lookup Helpers
// =============================================================================

/** Get district card by space index. */
export function getDistrictCard(spaceIndex: number): DistrictCard | undefined {
  return DISTRICT_CARDS.find((d) => d.spaceIndex === spaceIndex);
}

/** Get transit line card by space index. */
export function getTransitLineCard(
  spaceIndex: number,
): TransitLineCard | undefined {
  return TRANSIT_LINE_CARDS.find((t) => t.spaceIndex === spaceIndex);
}

/** Get service node card by space index. */
export function getServiceNodeCard(
  spaceIndex: number,
): ServiceNodeCard | undefined {
  return SERVICE_NODE_CARDS.find((s) => s.spaceIndex === spaceIndex);
}

/** Get sector definition by sectorId. */
export function getSector(sectorId: SectorId): SectorDef | undefined {
  return SECTORS.find((s) => s.sectorId === sectorId);
}

/** Get all district cards in a sector. */
export function getDistrictsInSector(sectorId: SectorId): DistrictCard[] {
  return DISTRICT_CARDS.filter((d) => d.sectorId === sectorId);
}

/** All purchasable space indices (districts + transit lines + service nodes). */
export const ALL_PURCHASABLE_INDICES: readonly number[] = [
  ...DISTRICT_CARDS.map((d) => d.spaceIndex),
  ...TRANSIT_LINE_CARDS.map((t) => t.spaceIndex),
  ...SERVICE_NODE_CARDS.map((s) => s.spaceIndex),
];
