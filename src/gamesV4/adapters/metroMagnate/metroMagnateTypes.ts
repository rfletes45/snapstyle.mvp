/**
 * Games V4 — Metro Magnate Type Definitions
 *
 * Static type contracts for the Metro Magnate board game.
 * 36-space loop board with 6 sectors of 3 districts each.
 *
 * @module gamesV4/adapters/metroMagnate/metroMagnateTypes
 */

// =============================================================================
// Board Space Types
// =============================================================================

/** All possible space types on the 36-space board. */
export type BoardSpaceType =
  | "central_terminal"
  | "district"
  | "transit_line"
  | "service_node"
  | "market_shift"
  | "city_brief"
  | "civic_fee"
  | "plaza"
  | "inspection_hold"
  | "detour_to_inspection";

/** Sector identifiers — 6 sectors of 3 districts each. */
export type SectorId =
  | "arts_quarter"
  | "harbor_ward"
  | "market_row"
  | "foundry_belt"
  | "tech_heights"
  | "civic_square";

/** A single space on the board. */
export interface BoardSpace {
  index: number;
  type: BoardSpaceType;
  name: string;
  /** Only present for district spaces. */
  sectorId?: SectorId;
  /** Only present for district spaces — position within sector (0-2). */
  sectorPosition?: number;
  /** Only present for transit_line spaces — which line group (0-3). */
  transitGroup?: number;
  /** Only present for service_node spaces — which utility pair (0-1). */
  serviceGroup?: number;
}

// =============================================================================
// Sector & District Definitions
// =============================================================================

export interface SectorDef {
  sectorId: SectorId;
  name: string;
  color: string;
  districtIndices: [number, number, number];
}

/** Lease tier within a district (equivalent to houses/hotel in classic). */
export type ImprovementLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface DistrictCard {
  /** Board space index. */
  spaceIndex: number;
  name: string;
  sectorId: SectorId;
  /** Cost to acquire via auction or purchase. */
  leaseCost: number;
  /** Rent at each improvement level [0..5]. Level 5 = "Tower". */
  rentLadder: [number, number, number, number, number, number];
  /** Cost per improvement level (levels 1-4). */
  improvementCost: number;
  /** Cost to build the Tower (level 5). */
  towerCost: number;
  /** Mortgage value (half of leaseCost). */
  mortgageValue: number;
}

export interface TransitLineCard {
  spaceIndex: number;
  name: string;
  transitGroup: number;
  leaseCost: number;
  /** Rent scales with number of lines owned: [1,2,3,4]. */
  rentByCount: [number, number, number, number];
  mortgageValue: number;
}

export interface ServiceNodeCard {
  spaceIndex: number;
  name: string;
  serviceGroup: number;
  leaseCost: number;
  /** Multiplier applied to dice roll. Scales with count owned: [1,2]. */
  multiplierByCount: [number, number];
  mortgageValue: number;
}

// =============================================================================
// Card Decks
// =============================================================================

export interface MarketShiftCard {
  id: number;
  text: string;
  effect: MarketShiftEffect;
}

export interface CityBriefCard {
  id: number;
  text: string;
  effect: CityBriefEffect;
}

export type MarketShiftEffect =
  | { type: "gain"; amount: number }
  | { type: "lose"; amount: number }
  | { type: "move_to"; spaceIndex: number }
  | { type: "move_relative"; spaces: number }
  | { type: "collect_from_each"; amount: number }
  | { type: "repair"; perImprovement: number; perTower: number }
  | { type: "go_to_inspection" };

export type CityBriefEffect =
  | { type: "gain"; amount: number }
  | { type: "lose"; amount: number }
  | { type: "move_to"; spaceIndex: number }
  | { type: "pay_each"; amount: number }
  | { type: "repair"; perImprovement: number; perTower: number }
  | { type: "go_to_inspection" }
  | { type: "get_out_of_inspection" };

// =============================================================================
// Player State
// =============================================================================

export interface MetroPlayerState {
  uid: string;
  /** Current board position (0-35). */
  position: number;
  /** Cash on hand. */
  cash: number;
  /** Owned property space indices. */
  ownedProperties: number[];
  /** Improvement levels keyed by space index. Flat array for Firestore. */
  improvements: number[];
  /** Mortgaged property space indices. */
  mortgagedProperties: number[];
  /** Number of "get out of inspection" cards held. */
  inspectionPasses: number;
  /** Whether this player is bankrupt (eliminated). */
  isBankrupt: boolean;
  /** Turn number when player went bankrupt (-1 if still active). */
  bankruptTurn: number;
  /** Total net worth for ranking (cash + property + improvements). */
  netWorth: number;
  /** Number of times passed Central Terminal this game. */
  timesPassedTerminal: number;
}

// =============================================================================
// Auction State
// =============================================================================

export type AuctionType = "english" | "sealed";

export interface AuctionState {
  /** Property space index being auctioned. */
  propertyIndex: number;
  type: AuctionType;
  /** Current highest bid (english) or null (sealed until reveal). */
  currentBid: number;
  /** UID of current highest bidder. */
  currentBidder: string | null;
  /** Sealed bids — only populated for sealed auctions. Flat for Firestore. */
  sealedBids: Array<{ uid: string; amount: number }>;
  /** UIDs of players who have passed (english). */
  passedPlayers: string[];
  /** Eligible bidders in turn order. */
  bidderOrder: string[];
  /** Index into bidderOrder for the current bidder. */
  currentBidderIndex: number;
  /** UID of the player who declined the property (turn returns to them after). */
  originatorUid: string;
  /** Whether the auction is resolved. */
  resolved: boolean;
}

// =============================================================================
// Trade State
// =============================================================================

export interface TradeOffer {
  fromUid: string;
  toUid: string;
  offeredProperties: number[];
  offeredCash: number;
  offeredInspectionPasses: number;
  requestedProperties: number[];
  requestedCash: number;
  requestedInspectionPasses: number;
  /** Phase to return to after trade resolves. */
  returnPhase: TurnPhase;
  status: "pending" | "accepted" | "rejected" | "cancelled";
}

// =============================================================================
// Debt Context
// =============================================================================

/** Tracks an unresolved debt that must be paid or trigger bankruptcy. */
export interface DebtContext {
  /** Total amount owed. */
  amount: number;
  /** UID of the creditor player, or null if owed to the bank. */
  creditorUid: string | null;
  /** Whether the player had doubles and may re-roll after debt resolution. */
  canReroll: boolean;
  /** Optional tag so pay_debt can route payments correctly (e.g. civic_fee → plazaPot). */
  debtType?: "civic_fee" | "rent" | "card" | "inspection_fine";
}

// =============================================================================
// Turn Phases
// =============================================================================

export type TurnPhase =
  | "pre_roll"
  | "rolling"
  | "post_roll"
  | "buying_decision"
  | "auction"
  | "paying_rent"
  | "card_effect"
  | "inspection"
  | "trading"
  | "managing_properties"
  | "debt_resolution"
  | "bankrupt_resolution"
  | "game_over";

// =============================================================================
// Move Payloads
// =============================================================================

export type MetroMagnateMovePayload =
  | { action: "roll_dice" }
  | { action: "buy_property" }
  | { action: "decline_property" }
  | { action: "auction_bid"; amount: number }
  | { action: "auction_pass" }
  | { action: "pay_rent" }
  | { action: "use_inspection_pass" }
  | { action: "pay_inspection_fine"; amount: number }
  | { action: "wait_in_inspection" }
  | { action: "build_improvement"; propertyIndex: number }
  | { action: "sell_improvement"; propertyIndex: number }
  | { action: "mortgage_property"; propertyIndex: number }
  | { action: "unmortgage_property"; propertyIndex: number }
  | { action: "propose_trade"; offer: TradeOffer }
  | { action: "accept_trade" }
  | { action: "reject_trade" }
  | { action: "end_turn" }
  | { action: "pay_debt" }
  | { action: "declare_bankruptcy" };

// =============================================================================
// Public Game State
// =============================================================================

export interface MetroMagnatePublicState {
  /** Board definition reference (always "standard_36"). */
  boardId: string;
  /** All player states — flat array for Firestore. */
  players: MetroPlayerState[];
  /** Turn order — array of UIDs. */
  turnOrder: string[];
  /** Index into turnOrder for the current player. */
  currentTurnIndex: number;
  /** UID of the current turn player (derived from turnOrder[currentTurnIndex]). */
  currentTurnUid: string;
  /** Current turn phase. */
  phase: TurnPhase;
  /** Last dice roll result [die1, die2]. */
  lastDice: [number, number] | null;
  /** Number of consecutive doubles rolled this turn. */
  doublesCount: number;
  /** Current turn number. */
  turnNumber: number;
  /** Total move count (across all players). */
  moveCount: number;
  /** Active auction (null if none). */
  activeAuction: AuctionState | null;
  /** Active trade offer (null if none). */
  activeTrade: TradeOffer | null;
  /** Ownership map: spaceIndex → ownerUid (flat for Firestore). */
  propertyOwnership: Array<{ spaceIndex: number; ownerUid: string }>;
  /** Improvement levels: spaceIndex → level (flat for Firestore). */
  propertyImprovements: Array<{ spaceIndex: number; level: number }>;
  /** Mortgage status: spaceIndex → isMortgaged (flat for Firestore). */
  propertyMortgages: Array<{ spaceIndex: number; mortgaged: boolean }>;
  /** Players in inspection hold. */
  inspectionHoldTurns: Array<{ uid: string; turnsRemaining: number }>;
  /** Market Shift deck — index of next card to draw. */
  marketShiftDeckIndex: number;
  /** City Brief deck — index of next card to draw. */
  cityBriefDeckIndex: number;
  /** Shuffled deck order indices (seeded). */
  marketShiftOrder: number[];
  /** Shuffled deck order indices (seeded). */
  cityBriefOrder: number[];
  /** Plaza pot — accumulated from Civic Fee payments. */
  plazaPot: number;
  /** Active debt that must be resolved before play continues. */
  debtContext: DebtContext | null;
  /** UIDs in elimination order (first = eliminated first). */
  eliminationOrder: string[];
  /** Remaining storefront improvements available (limited supply mode). */
  storefrontSupply: number;
  /** Remaining tower improvements available (limited supply mode). */
  towerSupply: number;
  /** Winner UID (null until game end). */
  winnerUid: string | null;
  /** End reason. */
  endReason: string | null;
  /** Resolved settings for this session. */
  settings: MetroMagnateSettings;
}

// =============================================================================
// Settings
// =============================================================================

export type GameMode = "classic" | "express";
export type AuctionTypeSetting = "english" | "sealed";
export type TurnTimerSetting = "off" | "30s" | "60s" | "90s" | "unlimited";
export type InspectionSeverity = "lenient" | "standard" | "strict";
export type ImprovementSupply = "unlimited" | "limited";

export interface MetroMagnateSettings {
  mode: GameMode;
  startingCapital: number;
  passSalary: number;
  auctionType: AuctionTypeSetting;
  turnTimer: TurnTimerSetting;
  inspectionSeverity: InspectionSeverity;
  improvementSupply: ImprovementSupply;
  plazaBonus: boolean;
  terminalExactBonus: boolean;
  tradeWindow: boolean;
}

export const DEFAULT_METRO_MAGNATE_SETTINGS: MetroMagnateSettings = {
  mode: "classic",
  startingCapital: 1500,
  passSalary: 200,
  auctionType: "english",
  turnTimer: "60s",
  inspectionSeverity: "standard",
  improvementSupply: "unlimited",
  plazaBonus: true,
  terminalExactBonus: false,
  tradeWindow: true,
};
