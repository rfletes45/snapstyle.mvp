/**
 * Games V4 — Metro Magnate Deterministic Engine
 *
 * Pure functions implementing the core board-game loop.
 * No side-effects, no platform dependencies — usable on client and server.
 *
 * Implements: dice / movement / salary / landing / rent / cards / inspection /
 *   buy-decline / auctions / trading / improvements / mortgages / debt resolution /
 *   bankruptcy / express-mode terminal / classic-mode terminal.
 *
 * @module gamesV4/adapters/metroMagnate/metroMagnateEngine
 */

import {
  BOARD_SIZE,
  BOARD_SPACES,
  CENTRAL_TERMINAL_INDEX,
  CITY_BRIEF_DECK,
  CIVIC_FEE_AMOUNTS,
  getDistrictCard,
  getSector,
  getServiceNodeCard,
  getTransitLineCard,
  INSPECTION_HOLD_INDEX,
  MARKET_SHIFT_DECK,
  SERVICE_NODE_CARDS,
  TRANSIT_LINE_CARDS,
} from "./metroMagnateBoard";
import type {
  AuctionState,
  CityBriefEffect,
  MarketShiftEffect,
  MetroMagnateMovePayload,
  MetroMagnatePublicState,
  MetroPlayerState,
  TradeOffer,
  TurnPhase,
} from "./metroMagnateTypes";

// =============================================================================
// Engine Result
// =============================================================================

export interface EngineResult {
  ok: boolean;
  error?: string;
  state?: MetroMagnatePublicState;
  terminal?: {
    type: "win" | "draw";
    winnerIds?: string[];
    reason?: string;
  };
  /** Set when the turn should advance to a specific player. */
  nextTurnPlayerId?: string;
}

// =============================================================================
// Constants
// =============================================================================

const INSPECTION_FINE = 50;
const EXPRESS_TURN_CAP = 30;
const MAX_CARD_CHAIN_DEPTH = 4;
const UNMORTGAGE_FEE_RATE = 0.1;
const DEFAULT_STOREFRONT_SUPPLY = 32;
const DEFAULT_TOWER_SUPPLY = 12;

// =============================================================================
// Deterministic PRNG (Mulberry32)
// =============================================================================

function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function generateDice(seed: number): [number, number] {
  const die1 = Math.floor(mulberry32(seed * 2 + 1) * 6) + 1;
  const die2 = Math.floor(mulberry32(seed * 2 + 2) * 6) + 1;
  return [die1, die2];
}

// =============================================================================
// State Helpers
// =============================================================================

function updatePlayer(
  state: MetroMagnatePublicState,
  uid: string,
  updater: (p: MetroPlayerState) => MetroPlayerState,
): MetroMagnatePublicState {
  return {
    ...state,
    players: state.players.map((p) => (p.uid === uid ? updater(p) : p)),
  };
}

function getPlayer(
  state: MetroMagnatePublicState,
  uid: string,
): MetroPlayerState {
  return state.players.find((p) => p.uid === uid)!;
}

// =============================================================================
// Sector / Improvement Helpers
// =============================================================================

/** Check if uid owns all 3 districts in a sector. */
export function ownsSector(
  state: MetroMagnatePublicState,
  uid: string,
  sectorId: string,
): boolean {
  const sector = getSector(sectorId as Parameters<typeof getSector>[0]);
  if (!sector) return false;
  return sector.districtIndices.every(
    (idx) => getPropertyOwner(state, idx) === uid,
  );
}

/** Check if any district in a sector is mortgaged. */
function sectorHasMortgage(
  state: MetroMagnatePublicState,
  sectorId: string,
): boolean {
  const sector = getSector(sectorId as Parameters<typeof getSector>[0]);
  if (!sector) return false;
  return sector.districtIndices.some((idx) => isPropertyMortgaged(state, idx));
}

/** Get the minimum improvement level among all districts in a sector owned by uid. */
function getMinImprovementInSector(
  state: MetroMagnatePublicState,
  sectorId: string,
): number {
  const sector = getSector(sectorId as Parameters<typeof getSector>[0]);
  if (!sector) return 0;
  return Math.min(
    ...sector.districtIndices.map((idx) => getImprovementLevel(state, idx)),
  );
}

/** Get the maximum improvement level among all districts in a sector. */
function getMaxImprovementInSector(
  state: MetroMagnatePublicState,
  sectorId: string,
): number {
  const sector = getSector(sectorId as Parameters<typeof getSector>[0]);
  if (!sector) return 0;
  return Math.max(
    ...sector.districtIndices.map((idx) => getImprovementLevel(state, idx)),
  );
}

/** Count all storefronts currently on the board (levels 1-4 count as their level). */
function countStorefrontsOnBoard(state: MetroMagnatePublicState): number {
  let count = 0;
  for (const imp of state.propertyImprovements) {
    if (imp.level >= 1 && imp.level <= 4) count += imp.level;
    // Level 5 (tower) = 0 storefronts on board (they were returned)
  }
  return count;
}

/** Count all towers currently on the board. */
function countTowersOnBoard(state: MetroMagnatePublicState): number {
  return state.propertyImprovements.filter((i) => i.level >= 5).length;
}

/** Set improvement level for a property. */
function setImprovementLevel(
  state: MetroMagnatePublicState,
  spaceIndex: number,
  level: number,
): MetroMagnatePublicState {
  const existing = state.propertyImprovements.find(
    (i) => i.spaceIndex === spaceIndex,
  );
  if (existing) {
    return {
      ...state,
      propertyImprovements: state.propertyImprovements.map((i) =>
        i.spaceIndex === spaceIndex ? { ...i, level } : i,
      ),
    };
  }
  return {
    ...state,
    propertyImprovements: [
      ...state.propertyImprovements,
      { spaceIndex, level },
    ],
  };
}

export function getPropertyOwner(
  state: MetroMagnatePublicState,
  spaceIndex: number,
): string | null {
  const entry = state.propertyOwnership.find(
    (o) => o.spaceIndex === spaceIndex,
  );
  return entry ? entry.ownerUid : null;
}

export function isPropertyMortgaged(
  state: MetroMagnatePublicState,
  spaceIndex: number,
): boolean {
  const entry = state.propertyMortgages.find(
    (m) => m.spaceIndex === spaceIndex,
  );
  return entry ? entry.mortgaged : false;
}

function getImprovementLevel(
  state: MetroMagnatePublicState,
  spaceIndex: number,
): number {
  const entry = state.propertyImprovements.find(
    (i) => i.spaceIndex === spaceIndex,
  );
  return entry ? entry.level : 0;
}

// =============================================================================
// Rent Calculation
// =============================================================================

export function computeRent(
  state: MetroMagnatePublicState,
  spaceIndex: number,
  diceTotal: number,
): number {
  const owner = getPropertyOwner(state, spaceIndex);
  if (!owner) return 0;
  if (isPropertyMortgaged(state, spaceIndex)) return 0;

  const space = BOARD_SPACES[spaceIndex];

  if (space.type === "district") {
    const card = getDistrictCard(spaceIndex);
    if (!card) return 0;
    const level = getImprovementLevel(state, spaceIndex);
    let rent = card.rentLadder[level];
    // Sector monopoly bonus: double base rent when owner holds all 3 districts
    // and none in the sector are mortgaged
    if (level === 0) {
      const sector = getSector(card.sectorId);
      if (sector) {
        const ownsAll = sector.districtIndices.every(
          (idx) => getPropertyOwner(state, idx) === owner,
        );
        const noneMortgaged = !sectorHasMortgage(state, card.sectorId);
        if (ownsAll && noneMortgaged) rent *= 2;
      }
    }
    return rent;
  }

  if (space.type === "transit_line") {
    const card = getTransitLineCard(spaceIndex);
    if (!card) return 0;
    const count = TRANSIT_LINE_CARDS.filter(
      (t) => getPropertyOwner(state, t.spaceIndex) === owner,
    ).length;
    return card.rentByCount[count - 1];
  }

  if (space.type === "service_node") {
    const card = getServiceNodeCard(spaceIndex);
    if (!card) return 0;
    const count = SERVICE_NODE_CARDS.filter(
      (s) => getPropertyOwner(state, s.spaceIndex) === owner,
    ).length;
    return card.multiplierByCount[count - 1] * diceTotal;
  }

  return 0;
}

// =============================================================================
// Net Worth
// =============================================================================

export function computeNetWorth(
  state: MetroMagnatePublicState,
  uid: string,
): number {
  const player = getPlayer(state, uid);
  if (!player || player.isBankrupt) return 0;
  let worth = player.cash;

  for (const propIdx of player.ownedProperties) {
    const isMortgaged = isPropertyMortgaged(state, propIdx);
    const district = getDistrictCard(propIdx);
    if (district) {
      // Mortgaged properties already contributed cash when mortgaged — don't double count
      if (!isMortgaged) {
        worth += district.mortgageValue;
      }
      const level = getImprovementLevel(state, propIdx);
      if (level >= 5) {
        // Tower = 4 storefronts + tower
        worth += 4 * district.improvementCost + district.towerCost;
      } else {
        worth += level * district.improvementCost;
      }
      continue;
    }
    const transit = getTransitLineCard(propIdx);
    if (transit) {
      if (!isMortgaged) worth += transit.mortgageValue;
      continue;
    }
    const service = getServiceNodeCard(propIdx);
    if (service) {
      if (!isMortgaged) worth += service.mortgageValue;
    }
  }
  return worth;
}

function recalcAllNetWorth(
  state: MetroMagnatePublicState,
): MetroMagnatePublicState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.isBankrupt ? p : { ...p, netWorth: computeNetWorth(state, p.uid) },
    ),
  };
}

// =============================================================================
// Turn Order Helpers
// =============================================================================

function getNextActivePlayerIndex(
  state: MetroMagnatePublicState,
  fromIndex: number,
): number {
  const n = state.turnOrder.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    const uid = state.turnOrder[idx];
    const player = state.players.find((p) => p.uid === uid);
    if (player && !player.isBankrupt) return idx;
  }
  return fromIndex;
}

// =============================================================================
// Terminal Detection
// =============================================================================

export function checkTerminal(
  state: MetroMagnatePublicState,
): { type: "win" | "draw"; winnerIds?: string[]; reason?: string } | null {
  const active = state.players.filter((p) => !p.isBankrupt);

  // Classic: last player standing
  if (active.length <= 1) {
    return {
      type: "win",
      winnerIds: active.length === 1 ? [active[0].uid] : [],
      reason: "last_standing",
    };
  }

  // Express: turn cap reached → highest net worth wins (tiebreak: cash, then property count)
  if (
    state.settings.mode === "express" &&
    state.turnNumber >= EXPRESS_TURN_CAP
  ) {
    const sorted = [...active].sort(
      (a, b) =>
        b.netWorth - a.netWorth ||
        b.cash - a.cash ||
        b.ownedProperties.length - a.ownedProperties.length,
    );
    return {
      type: "win",
      winnerIds: [sorted[0].uid],
      reason: "express_turn_cap",
    };
  }

  return null;
}

// =============================================================================
// Bankruptcy
// =============================================================================

function bankruptPlayer(
  state: MetroMagnatePublicState,
  uid: string,
  creditorUid: string | null,
): MetroMagnatePublicState {
  const bankrupt = getPlayer(state, uid);

  let s = updatePlayer(state, uid, (p) => ({
    ...p,
    isBankrupt: true,
    bankruptTurn: state.turnNumber,
    cash: 0,
    ownedProperties: [],
    improvements: [],
    mortgagedProperties: [],
    inspectionPasses: 0,
    netWorth: 0,
  }));

  // Track elimination order
  s = {
    ...s,
    eliminationOrder: [...s.eliminationOrder, uid],
  };

  if (creditorUid) {
    // Transfer properties and inspection passes to creditor
    const transferredSet = new Set(bankrupt.ownedProperties);
    s = updatePlayer(s, creditorUid, (p) => ({
      ...p,
      ownedProperties: [...p.ownedProperties, ...bankrupt.ownedProperties],
      inspectionPasses: p.inspectionPasses + bankrupt.inspectionPasses,
    }));
    // Update ownership map
    s = {
      ...s,
      propertyOwnership: s.propertyOwnership.map((o) =>
        o.ownerUid === uid ? { ...o, ownerUid: creditorUid } : o,
      ),
    };
    // Clear improvements on transferred properties (improvements are forfeited)
    s = {
      ...s,
      propertyImprovements: s.propertyImprovements.filter(
        (i) => !transferredSet.has(i.spaceIndex),
      ),
    };
    // Mortgaged properties transferred — creditor pays 10% fee per property
    let mortgageFees = 0;
    for (const propIdx of bankrupt.mortgagedProperties) {
      const d = getDistrictCard(propIdx);
      const t = getTransitLineCard(propIdx);
      const sv = getServiceNodeCard(propIdx);
      const mv = d?.mortgageValue ?? t?.mortgageValue ?? sv?.mortgageValue ?? 0;
      mortgageFees += Math.round(mv * UNMORTGAGE_FEE_RATE);
    }
    if (mortgageFees > 0) {
      s = updatePlayer(s, creditorUid, (p) => ({
        ...p,
        cash: p.cash - mortgageFees,
      }));
    }
  } else {
    // Return everything to the bank
    const ownedSet = new Set(bankrupt.ownedProperties);
    s = {
      ...s,
      propertyOwnership: s.propertyOwnership.filter((o) => o.ownerUid !== uid),
      propertyImprovements: s.propertyImprovements.filter(
        (i) => !ownedSet.has(i.spaceIndex),
      ),
      propertyMortgages: s.propertyMortgages.filter(
        (m) => !ownedSet.has(m.spaceIndex),
      ),
    };
  }

  // Remove from inspection hold
  s = {
    ...s,
    inspectionHoldTurns: s.inspectionHoldTurns.filter((h) => h.uid !== uid),
    debtContext: null,
  };

  return s;
}

// =============================================================================
// Inspection Hold
// =============================================================================

function sendToInspection(
  state: MetroMagnatePublicState,
  uid: string,
): MetroMagnatePublicState {
  let s = updatePlayer(state, uid, (p) => ({
    ...p,
    position: INSPECTION_HOLD_INDEX,
  }));

  // strict = must pay or use pass immediately (0 dice attempts)
  // standard = 3 dice attempts
  // lenient = 1 dice attempt
  const turnsAllowed =
    s.settings.inspectionSeverity === "lenient"
      ? 1
      : s.settings.inspectionSeverity === "strict"
        ? 0
        : 3;

  s = {
    ...s,
    inspectionHoldTurns: [
      ...s.inspectionHoldTurns.filter((h) => h.uid !== uid),
      { uid, turnsRemaining: turnsAllowed },
    ],
    doublesCount: 0,
  };
  return s;
}

// =============================================================================
// Debt Resolution
// =============================================================================

function enterDebtResolution(
  state: MetroMagnatePublicState,
  uid: string,
  amount: number,
  creditorUid: string | null,
  canReroll: boolean,
  debtType?: "civic_fee" | "rent" | "card" | "inspection_fine",
): MetroMagnatePublicState {
  return {
    ...state,
    phase: "debt_resolution" as TurnPhase,
    debtContext: { amount, creditorUid, canReroll, debtType },
    moveCount: state.moveCount + 1,
  };
}

// =============================================================================
// Rent Payment
// =============================================================================

function payRent(
  state: MetroMagnatePublicState,
  payerUid: string,
  ownerUid: string,
  amount: number,
  canReroll: boolean,
): MetroMagnatePublicState {
  const payer = getPlayer(state, payerUid);
  if (payer.cash >= amount) {
    let s = updatePlayer(state, payerUid, (p) => ({
      ...p,
      cash: p.cash - amount,
    }));
    s = updatePlayer(s, ownerUid, (p) => ({
      ...p,
      cash: p.cash + amount,
    }));
    return s;
  }
  // Can't afford — enter debt resolution (don't transfer yet)
  return enterDebtResolution(state, payerUid, amount, ownerUid, canReroll);
}

// =============================================================================
// Card Drawing
// =============================================================================

function drawMarketShiftCard(state: MetroMagnatePublicState): {
  state: MetroMagnatePublicState;
  cardId: number;
} {
  let index = state.marketShiftDeckIndex;
  if (index >= state.marketShiftOrder.length) index = 0;
  const cardId = state.marketShiftOrder[index];
  return {
    state: { ...state, marketShiftDeckIndex: index + 1 },
    cardId,
  };
}

function drawCityBriefCard(state: MetroMagnatePublicState): {
  state: MetroMagnatePublicState;
  cardId: number;
} {
  let index = state.cityBriefDeckIndex;
  if (index >= state.cityBriefOrder.length) index = 0;
  const cardId = state.cityBriefOrder[index];
  return {
    state: { ...state, cityBriefDeckIndex: index + 1 },
    cardId,
  };
}

// =============================================================================
// Card Effect Application
// =============================================================================

function applyCardEffect(
  state: MetroMagnatePublicState,
  uid: string,
  effect: MarketShiftEffect | CityBriefEffect,
  canReroll: boolean,
): MetroMagnatePublicState {
  switch (effect.type) {
    case "gain":
      return updatePlayer(state, uid, (p) => ({
        ...p,
        cash: p.cash + effect.amount,
      }));

    case "lose": {
      const player = getPlayer(state, uid);
      if (player.cash >= effect.amount) {
        return updatePlayer(state, uid, (p) => ({
          ...p,
          cash: p.cash - effect.amount,
        }));
      }
      // Can't afford — enter debt resolution
      return enterDebtResolution(state, uid, effect.amount, null, canReroll);
    }

    case "collect_from_each": {
      const others = state.players.filter(
        (p) => p.uid !== uid && !p.isBankrupt,
      );
      let s = state;
      let total = 0;
      for (const other of others) {
        const payment = Math.min(getPlayer(s, other.uid).cash, effect.amount);
        s = updatePlayer(s, other.uid, (p) => ({
          ...p,
          cash: p.cash - payment,
        }));
        total += payment;
      }
      s = updatePlayer(s, uid, (p) => ({ ...p, cash: p.cash + total }));
      return s;
    }

    case "pay_each": {
      const others = state.players.filter(
        (p) => p.uid !== uid && !p.isBankrupt,
      );
      const totalOwed = others.length * effect.amount;
      const player = getPlayer(state, uid);
      if (player.cash < totalOwed) {
        return enterDebtResolution(state, uid, totalOwed, null, canReroll);
      }
      let s = updatePlayer(state, uid, (p) => ({
        ...p,
        cash: p.cash - totalOwed,
      }));
      for (const other of others) {
        s = updatePlayer(s, other.uid, (p) => ({
          ...p,
          cash: p.cash + effect.amount,
        }));
      }
      return s;
    }

    case "repair": {
      const player = getPlayer(state, uid);
      let totalCost = 0;
      for (const propIdx of player.ownedProperties) {
        const level = getImprovementLevel(state, propIdx);
        if (level >= 5) totalCost += effect.perTower;
        else if (level > 0) totalCost += level * effect.perImprovement;
      }
      if (player.cash < totalCost) {
        return enterDebtResolution(state, uid, totalCost, null, canReroll);
      }
      return updatePlayer(state, uid, (p) => ({
        ...p,
        cash: p.cash - totalCost,
      }));
    }

    case "move_to": {
      const player = getPlayer(state, uid);
      const oldPos = player.position;
      const newPos = effect.spaceIndex;
      // "Advance to" is always forward. Collect salary if passing/landing on terminal.
      let collectSalary = false;
      if (newPos === CENTRAL_TERMINAL_INDEX) {
        collectSalary = true;
      } else if (newPos < oldPos) {
        collectSalary = true; // wrapped around the board
      }
      const cashBonus = collectSalary ? state.settings.passSalary : 0;
      return updatePlayer(state, uid, (p) => ({
        ...p,
        position: newPos,
        cash: p.cash + cashBonus,
        timesPassedTerminal: p.timesPassedTerminal + (collectSalary ? 1 : 0),
      }));
    }

    case "move_relative": {
      const player = getPlayer(state, uid);
      const newPos =
        (((player.position + effect.spaces) % BOARD_SIZE) + BOARD_SIZE) %
        BOARD_SIZE;
      // Backward movement does not collect salary
      return updatePlayer(state, uid, (p) => ({ ...p, position: newPos }));
    }

    case "go_to_inspection":
      return sendToInspection(state, uid);

    case "get_out_of_inspection":
      return updatePlayer(state, uid, (p) => ({
        ...p,
        inspectionPasses: p.inspectionPasses + 1,
      }));

    default:
      return state;
  }
}

// =============================================================================
// Post-Landing Resolution
// =============================================================================

/**
 * After landing effects are resolved, determine the next phase:
 * - doubles remaining → pre_roll (roll again)
 * - otherwise → post_roll (must end_turn)
 */
function postLanding(
  state: MetroMagnatePublicState,
  uid: string,
  canReroll: boolean,
): EngineResult {
  let s = recalcAllNetWorth(state);

  const terminal = checkTerminal(s);
  if (terminal) {
    s = {
      ...s,
      phase: "game_over" as TurnPhase,
      winnerUid: terminal.winnerIds?.[0] ?? null,
      endReason: terminal.reason ?? null,
    };
    return { ok: true, state: s, terminal };
  }

  if (canReroll && s.doublesCount > 0) {
    return { ok: true, state: { ...s, phase: "pre_roll" as TurnPhase } };
  }

  return { ok: true, state: { ...s, phase: "post_roll" as TurnPhase } };
}

// =============================================================================
// Landing Resolution
// =============================================================================

/**
 * Resolve the effect of standing on the player's current space.
 * Recursive for card-triggered movement (depth-bounded).
 */
function handleLanding(
  state: MetroMagnatePublicState,
  uid: string,
  diceTotal: number,
  isDoubles: boolean,
  depth: number = 0,
): EngineResult {
  if (depth > MAX_CARD_CHAIN_DEPTH) {
    return postLanding(state, uid, isDoubles);
  }

  const player = getPlayer(state, uid);
  const space = BOARD_SPACES[player.position];

  switch (space.type) {
    case "central_terminal":
      return postLanding(state, uid, isDoubles);

    case "district":
    case "transit_line":
    case "service_node": {
      const owner = getPropertyOwner(state, space.index);
      if (!owner) {
        // Unowned — player must buy or decline
        return {
          ok: true,
          state: { ...state, phase: "buying_decision" as TurnPhase },
        };
      }
      if (owner === uid || isPropertyMortgaged(state, space.index)) {
        return postLanding(state, uid, isDoubles);
      }
      // Pay rent to owner
      const rent = computeRent(state, space.index, diceTotal);
      const canReroll = isDoubles && state.doublesCount > 0;
      let s = payRent(state, uid, owner, rent, canReroll);
      // Check if debt resolution was triggered
      if (s.debtContext) {
        return { ok: true, state: s };
      }
      if (getPlayer(s, uid).isBankrupt) {
        const terminal = checkTerminal(s);
        if (terminal) {
          s = {
            ...s,
            phase: "game_over" as TurnPhase,
            winnerUid: terminal.winnerIds?.[0] ?? null,
            endReason: terminal.reason ?? null,
          };
          return { ok: true, state: s, terminal };
        }
        return postLanding(s, uid, false);
      }
      return postLanding(s, uid, isDoubles);
    }

    case "market_shift": {
      const { state: s1, cardId } = drawMarketShiftCard(state);
      const card = MARKET_SHIFT_DECK[cardId];
      const canReroll = isDoubles && state.doublesCount > 0;
      const s2 = applyCardEffect(s1, uid, card.effect, canReroll);
      // Check if debt resolution was triggered
      if (s2.debtContext) {
        return { ok: true, state: s2 };
      }
      if (getPlayer(s2, uid).isBankrupt) {
        const terminal = checkTerminal(s2);
        if (terminal) {
          return {
            ok: true,
            state: {
              ...s2,
              phase: "game_over" as TurnPhase,
              winnerUid: terminal.winnerIds?.[0] ?? null,
              endReason: terminal.reason ?? null,
            },
            terminal,
          };
        }
        return postLanding(s2, uid, false);
      }
      // Card moved the player → resolve new landing
      if (
        card.effect.type === "move_to" ||
        card.effect.type === "move_relative"
      ) {
        return handleLanding(s2, uid, diceTotal, isDoubles, depth + 1);
      }
      if (card.effect.type === "go_to_inspection") {
        return postLanding(s2, uid, false);
      }
      return postLanding(s2, uid, isDoubles);
    }

    case "city_brief": {
      const { state: s1, cardId } = drawCityBriefCard(state);
      const card = CITY_BRIEF_DECK[cardId];
      const canReroll = isDoubles && state.doublesCount > 0;
      const s2 = applyCardEffect(s1, uid, card.effect, canReroll);
      // Check if debt resolution was triggered
      if (s2.debtContext) {
        return { ok: true, state: s2 };
      }
      if (getPlayer(s2, uid).isBankrupt) {
        const terminal = checkTerminal(s2);
        if (terminal) {
          return {
            ok: true,
            state: {
              ...s2,
              phase: "game_over" as TurnPhase,
              winnerUid: terminal.winnerIds?.[0] ?? null,
              endReason: terminal.reason ?? null,
            },
            terminal,
          };
        }
        return postLanding(s2, uid, false);
      }
      if (card.effect.type === "move_to") {
        return handleLanding(s2, uid, diceTotal, isDoubles, depth + 1);
      }
      if (card.effect.type === "go_to_inspection") {
        return postLanding(s2, uid, false);
      }
      return postLanding(s2, uid, isDoubles);
    }

    case "civic_fee": {
      const fee = CIVIC_FEE_AMOUNTS[space.index] ?? 200;
      const player = getPlayer(state, uid);
      const canReroll = isDoubles && state.doublesCount > 0;
      if (player.cash < fee) {
        // Can't afford civic fee — enter debt resolution, tag as civic_fee
        const s = enterDebtResolution(
          state,
          uid,
          fee,
          null,
          canReroll,
          "civic_fee",
        );
        return { ok: true, state: s };
      }
      let s = updatePlayer(state, uid, (p) => ({
        ...p,
        cash: p.cash - fee,
      }));
      s = { ...s, plazaPot: s.plazaPot + fee };
      return postLanding(s, uid, isDoubles);
    }

    case "plaza": {
      if (state.settings.plazaBonus && state.plazaPot > 0) {
        let s = updatePlayer(state, uid, (p) => ({
          ...p,
          cash: p.cash + state.plazaPot,
        }));
        s = { ...s, plazaPot: 0 };
        return postLanding(s, uid, isDoubles);
      }
      return postLanding(state, uid, isDoubles);
    }

    case "inspection_hold":
      // Just visiting
      return postLanding(state, uid, isDoubles);

    case "detour_to_inspection": {
      const s = sendToInspection(state, uid);
      return postLanding(s, uid, false);
    }

    default:
      return postLanding(state, uid, isDoubles);
  }
}

// =============================================================================
// Movement Helper (dice-based)
// =============================================================================

function moveByDice(
  state: MetroMagnatePublicState,
  uid: string,
  diceTotal: number,
): MetroMagnatePublicState {
  const player = getPlayer(state, uid);
  const oldPos = player.position;
  const newPos = (oldPos + diceTotal) % BOARD_SIZE;
  const passedTerminal =
    oldPos + diceTotal >= BOARD_SIZE && newPos !== CENTRAL_TERMINAL_INDEX;
  const landedOnTerminal = newPos === CENTRAL_TERMINAL_INDEX;

  let cashBonus = 0;
  if (passedTerminal || landedOnTerminal) {
    cashBonus = state.settings.passSalary;
    if (landedOnTerminal && state.settings.terminalExactBonus) {
      cashBonus *= 2;
    }
  }

  return updatePlayer(state, uid, (p) => ({
    ...p,
    position: newPos,
    cash: p.cash + cashBonus,
    timesPassedTerminal:
      p.timesPassedTerminal + (passedTerminal || landedOnTerminal ? 1 : 0),
  }));
}

// =============================================================================
// Action Processors
// =============================================================================

function processRollDice(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (state.phase !== "pre_roll") {
    return { ok: false, error: "Cannot roll dice in current phase." };
  }

  const dice = generateDice(state.moveCount);
  const diceTotal = dice[0] + dice[1];
  const isDoubles = dice[0] === dice[1];

  let s: MetroMagnatePublicState = {
    ...state,
    lastDice: dice,
    moveCount: state.moveCount + 1,
    doublesCount: isDoubles ? state.doublesCount + 1 : 0,
  };

  // Three consecutive doubles → sent to inspection
  if (s.doublesCount >= 3) {
    s = sendToInspection(s, uid);
    return postLanding(s, uid, false);
  }

  // Move player
  s = moveByDice(s, uid, diceTotal);

  // Resolve landing
  return handleLanding(s, uid, diceTotal, isDoubles);
}

function processBuyProperty(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (state.phase !== "buying_decision") {
    return { ok: false, error: "Not in buying decision phase." };
  }

  const player = getPlayer(state, uid);
  const space = BOARD_SPACES[player.position];

  let cost = 0;
  if (space.type === "district") {
    cost = getDistrictCard(space.index)?.leaseCost ?? 0;
  } else if (space.type === "transit_line") {
    cost = getTransitLineCard(space.index)?.leaseCost ?? 0;
  } else if (space.type === "service_node") {
    cost = getServiceNodeCard(space.index)?.leaseCost ?? 0;
  }

  if (player.cash < cost) {
    return { ok: false, error: "Not enough cash to purchase this property." };
  }

  let s = updatePlayer(state, uid, (p) => ({
    ...p,
    cash: p.cash - cost,
    ownedProperties: [...p.ownedProperties, space.index],
  }));

  s = {
    ...s,
    propertyOwnership: [
      ...s.propertyOwnership,
      { spaceIndex: space.index, ownerUid: uid },
    ],
    moveCount: s.moveCount + 1,
  };

  // Check doubles for re-roll
  const isDoubles = s.lastDice ? s.lastDice[0] === s.lastDice[1] : false;
  return postLanding(s, uid, isDoubles && s.doublesCount > 0);
}

function processDeclineProperty(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (state.phase !== "buying_decision") {
    return { ok: false, error: "Not in buying decision phase." };
  }

  const player = getPlayer(state, uid);
  const spaceIndex = player.position;

  // Build bidder order: all non-bankrupt players starting after the decliner
  const decIdx = state.turnOrder.indexOf(uid);
  const bidderOrder: string[] = [];
  for (let i = 1; i <= state.turnOrder.length; i++) {
    const idx = (decIdx + i) % state.turnOrder.length;
    const pUid = state.turnOrder[idx];
    const p = getPlayer(state, pUid);
    if (!p.isBankrupt) bidderOrder.push(pUid);
  }

  // No eligible bidders → skip auction
  if (bidderOrder.length === 0) {
    const s = { ...state, moveCount: state.moveCount + 1 };
    const isDoubles = s.lastDice ? s.lastDice[0] === s.lastDice[1] : false;
    return postLanding(s, uid, isDoubles && s.doublesCount > 0);
  }

  const firstBidder = bidderOrder[0];
  const auction: AuctionState = {
    propertyIndex: spaceIndex,
    type: state.settings.auctionType as AuctionState["type"],
    currentBid: 0,
    currentBidder: null,
    sealedBids: [],
    passedPlayers: [],
    bidderOrder,
    currentBidderIndex: 0,
    originatorUid: uid,
    resolved: false,
  };

  const s: MetroMagnatePublicState = {
    ...state,
    activeAuction: auction,
    currentTurnUid: firstBidder,
    phase: "auction" as TurnPhase,
    moveCount: state.moveCount + 1,
  };

  return { ok: true, state: s, nextTurnPlayerId: firstBidder };
}

function processPayInspectionFine(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (state.phase !== "inspection") {
    return { ok: false, error: "Not in inspection phase." };
  }
  const player = getPlayer(state, uid);
  if (player.cash < INSPECTION_FINE) {
    return { ok: false, error: "Not enough cash to pay the inspection fine." };
  }

  let s = updatePlayer(state, uid, (p) => ({
    ...p,
    cash: p.cash - INSPECTION_FINE,
  }));
  s = {
    ...s,
    inspectionHoldTurns: s.inspectionHoldTurns.filter((h) => h.uid !== uid),
    phase: "pre_roll" as TurnPhase,
    moveCount: s.moveCount + 1,
  };
  return { ok: true, state: s };
}

function processUseInspectionPass(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (state.phase !== "inspection") {
    return { ok: false, error: "Not in inspection phase." };
  }
  const player = getPlayer(state, uid);
  if (player.inspectionPasses <= 0) {
    return { ok: false, error: "No inspection passes available." };
  }

  let s = updatePlayer(state, uid, (p) => ({
    ...p,
    inspectionPasses: p.inspectionPasses - 1,
  }));
  s = {
    ...s,
    inspectionHoldTurns: s.inspectionHoldTurns.filter((h) => h.uid !== uid),
    phase: "pre_roll" as TurnPhase,
    moveCount: s.moveCount + 1,
  };
  return { ok: true, state: s };
}

function processWaitInInspection(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (state.phase !== "inspection") {
    return { ok: false, error: "Not in inspection phase." };
  }
  const hold = state.inspectionHoldTurns.find((h) => h.uid === uid);
  if (!hold) {
    return { ok: false, error: "Not in inspection hold." };
  }
  // Strict severity: no dice attempts allowed — must pay fine or use pass
  if (hold.turnsRemaining <= 0) {
    return {
      ok: false,
      error: "You must pay the fine or use an inspection pass.",
    };
  }

  // Roll dice attempting to get doubles
  const dice = generateDice(state.moveCount);
  const diceTotal = dice[0] + dice[1];
  const isDoubles = dice[0] === dice[1];

  let s: MetroMagnatePublicState = {
    ...state,
    lastDice: dice,
    moveCount: state.moveCount + 1,
  };

  if (isDoubles) {
    // Released! Move by dice total, but NO extra roll from these doubles
    s = {
      ...s,
      inspectionHoldTurns: s.inspectionHoldTurns.filter((h) => h.uid !== uid),
      doublesCount: 0,
    };
    s = moveByDice(s, uid, diceTotal);
    return handleLanding(s, uid, diceTotal, false);
  }

  // Not doubles
  const newTurns = hold.turnsRemaining - 1;

  if (newTurns <= 0) {
    // Last attempt failed — must pay fine and move
    s = {
      ...s,
      inspectionHoldTurns: s.inspectionHoldTurns.filter((h) => h.uid !== uid),
    };

    const player = getPlayer(s, uid);
    if (player.cash < INSPECTION_FINE) {
      // Can't afford fine — enter debt resolution so player can sell/mortgage
      s = enterDebtResolution(s, uid, INSPECTION_FINE, null, false);
      return { ok: true, state: s };
    }

    // Can afford — pay fine and move
    s = updatePlayer(s, uid, (p) => ({
      ...p,
      cash: p.cash - INSPECTION_FINE,
    }));

    // Move by dice after forced fine payment
    s = moveByDice(s, uid, diceTotal);
    return handleLanding(s, uid, diceTotal, false);
  }

  // Still in inspection, turn over
  s = {
    ...s,
    inspectionHoldTurns: s.inspectionHoldTurns.map((h) =>
      h.uid === uid ? { ...h, turnsRemaining: newTurns } : h,
    ),
    phase: "post_roll" as TurnPhase,
  };
  return { ok: true, state: s };
}

// =============================================================================
// Auction Processors
// =============================================================================

function advanceAuction(state: MetroMagnatePublicState): EngineResult {
  const auction = state.activeAuction!;

  if (auction.type === "english") {
    // Find remaining (non-passed) bidders
    const remaining = auction.bidderOrder.filter(
      (b) => !auction.passedPlayers.includes(b),
    );

    if (remaining.length <= 1) {
      return resolveAuction(state);
    }

    // Advance to next non-passed bidder
    let nextIdx = auction.currentBidderIndex;
    do {
      nextIdx = (nextIdx + 1) % auction.bidderOrder.length;
    } while (auction.passedPlayers.includes(auction.bidderOrder[nextIdx]));

    const nextBidder = auction.bidderOrder[nextIdx];
    const s: MetroMagnatePublicState = {
      ...state,
      activeAuction: { ...auction, currentBidderIndex: nextIdx },
      currentTurnUid: nextBidder,
    };
    return { ok: true, state: s, nextTurnPlayerId: nextBidder };
  }

  // Sealed: check if all bidders have submitted
  if (auction.sealedBids.length >= auction.bidderOrder.length) {
    return resolveAuction(state);
  }

  // Advance to next bidder
  const nextIdx = auction.currentBidderIndex + 1;
  const nextBidder = auction.bidderOrder[nextIdx];
  const s: MetroMagnatePublicState = {
    ...state,
    activeAuction: { ...auction, currentBidderIndex: nextIdx },
    currentTurnUid: nextBidder,
  };
  return { ok: true, state: s, nextTurnPlayerId: nextBidder };
}

function resolveAuction(state: MetroMagnatePublicState): EngineResult {
  const auction = state.activeAuction!;
  let winnerUid: string | null = null;
  let winningBid = 0;

  if (auction.type === "english") {
    winnerUid = auction.currentBidder;
    winningBid = auction.currentBid;
  } else {
    // Sealed: highest bid wins, turn-order tiebreak (first in bidderOrder)
    for (const bid of auction.sealedBids) {
      if (bid.amount > winningBid) {
        winningBid = bid.amount;
        winnerUid = bid.uid;
      }
    }
  }

  const originatorUid = auction.originatorUid;
  let s: MetroMagnatePublicState = {
    ...state,
    activeAuction: null,
    currentTurnUid: originatorUid,
    moveCount: state.moveCount + 1,
  };

  if (winnerUid && winningBid > 0) {
    const propIdx = auction.propertyIndex;
    s = updatePlayer(s, winnerUid, (p) => ({
      ...p,
      cash: p.cash - winningBid,
      ownedProperties: [...p.ownedProperties, propIdx],
    }));
    s = {
      ...s,
      propertyOwnership: [
        ...s.propertyOwnership,
        { spaceIndex: propIdx, ownerUid: winnerUid },
      ],
    };
  }

  s = recalcAllNetWorth(s);

  const terminal = checkTerminal(s);
  if (terminal) {
    s = {
      ...s,
      phase: "game_over" as TurnPhase,
      winnerUid: terminal.winnerIds?.[0] ?? null,
      endReason: terminal.reason ?? null,
    };
    return { ok: true, state: s, terminal, nextTurnPlayerId: originatorUid };
  }

  const isDoubles = s.lastDice ? s.lastDice[0] === s.lastDice[1] : false;
  const canReroll = isDoubles && s.doublesCount > 0;
  s = {
    ...s,
    phase: (canReroll ? "pre_roll" : "post_roll") as TurnPhase,
  };

  return { ok: true, state: s, nextTurnPlayerId: originatorUid };
}

function processAuctionBid(
  state: MetroMagnatePublicState,
  uid: string,
  amount: number,
): EngineResult {
  if (state.phase !== "auction" || !state.activeAuction) {
    return { ok: false, error: "No active auction." };
  }
  const auction = state.activeAuction;
  if (auction.bidderOrder[auction.currentBidderIndex] !== uid) {
    return { ok: false, error: "Not your turn to bid." };
  }
  const player = getPlayer(state, uid);
  if (amount <= 0 || amount > player.cash) {
    return { ok: false, error: "Invalid bid amount." };
  }

  if (auction.type === "english") {
    if (amount <= auction.currentBid) {
      return { ok: false, error: "Bid must exceed current highest bid." };
    }
    const newAuction: AuctionState = {
      ...auction,
      currentBid: amount,
      currentBidder: uid,
    };
    return advanceAuction({
      ...state,
      activeAuction: newAuction,
      moveCount: state.moveCount + 1,
    });
  }

  // Sealed: record the bid
  const newAuction: AuctionState = {
    ...auction,
    sealedBids: [...auction.sealedBids, { uid, amount }],
  };
  return advanceAuction({
    ...state,
    activeAuction: newAuction,
    moveCount: state.moveCount + 1,
  });
}

function processAuctionPass(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (state.phase !== "auction" || !state.activeAuction) {
    return { ok: false, error: "No active auction." };
  }
  const auction = state.activeAuction;
  if (auction.bidderOrder[auction.currentBidderIndex] !== uid) {
    return { ok: false, error: "Not your turn to bid." };
  }

  if (auction.type === "english") {
    const newAuction: AuctionState = {
      ...auction,
      passedPlayers: [...auction.passedPlayers, uid],
    };
    return advanceAuction({
      ...state,
      activeAuction: newAuction,
      moveCount: state.moveCount + 1,
    });
  }

  // Sealed pass = bid of 0
  const newAuction: AuctionState = {
    ...auction,
    sealedBids: [...auction.sealedBids, { uid, amount: 0 }],
  };
  return advanceAuction({
    ...state,
    activeAuction: newAuction,
    moveCount: state.moveCount + 1,
  });
}

// =============================================================================
// Improvement Processors
// =============================================================================

function processBuildImprovement(
  state: MetroMagnatePublicState,
  uid: string,
  propertyIndex: number,
): EngineResult {
  if (state.phase !== "pre_roll" && state.phase !== "post_roll") {
    return { ok: false, error: "Cannot build improvements in current phase." };
  }

  const district = getDistrictCard(propertyIndex);
  if (!district) {
    return { ok: false, error: "Not a district property." };
  }
  if (getPropertyOwner(state, propertyIndex) !== uid) {
    return { ok: false, error: "You do not own this property." };
  }
  if (!ownsSector(state, uid, district.sectorId)) {
    return {
      ok: false,
      error: "You must own all districts in this sector to build.",
    };
  }
  if (sectorHasMortgage(state, district.sectorId)) {
    return {
      ok: false,
      error: "Cannot build while any district in the sector is mortgaged.",
    };
  }

  const currentLevel = getImprovementLevel(state, propertyIndex);
  if (currentLevel >= 5) {
    return { ok: false, error: "Maximum improvement level reached." };
  }

  // Even-build rule
  const minLevel = getMinImprovementInSector(state, district.sectorId);
  if (currentLevel > minLevel) {
    return {
      ok: false,
      error: "Must build evenly — choose the district with the lowest level.",
    };
  }

  const cost =
    currentLevel === 4 ? district.towerCost : district.improvementCost;
  const player = getPlayer(state, uid);
  if (player.cash < cost) {
    return { ok: false, error: "Not enough cash to build." };
  }

  // Supply check for limited mode
  if (state.settings.improvementSupply === "limited") {
    if (currentLevel === 4) {
      if (countTowersOnBoard(state) >= state.towerSupply) {
        return { ok: false, error: "No towers available in supply." };
      }
    } else {
      if (countStorefrontsOnBoard(state) >= state.storefrontSupply) {
        return { ok: false, error: "No storefronts available in supply." };
      }
    }
  }

  let s = updatePlayer(state, uid, (p) => ({ ...p, cash: p.cash - cost }));
  s = setImprovementLevel(s, propertyIndex, currentLevel + 1);
  s = recalcAllNetWorth(s);
  s = { ...s, moveCount: s.moveCount + 1 };

  return { ok: true, state: s };
}

function processSellImprovement(
  state: MetroMagnatePublicState,
  uid: string,
  propertyIndex: number,
): EngineResult {
  if (
    state.phase !== "pre_roll" &&
    state.phase !== "post_roll" &&
    state.phase !== "debt_resolution"
  ) {
    return { ok: false, error: "Cannot sell improvements in current phase." };
  }

  const district = getDistrictCard(propertyIndex);
  if (!district) {
    return { ok: false, error: "Not a district property." };
  }
  if (getPropertyOwner(state, propertyIndex) !== uid) {
    return { ok: false, error: "You do not own this property." };
  }

  const currentLevel = getImprovementLevel(state, propertyIndex);
  if (currentLevel <= 0) {
    return { ok: false, error: "No improvements to sell." };
  }

  // Even-sell rule
  const maxLevel = getMaxImprovementInSector(state, district.sectorId);
  if (currentLevel < maxLevel) {
    return {
      ok: false,
      error: "Must sell evenly — choose the district with the highest level.",
    };
  }

  // Selling tower → need storefronts in supply for downgrade (limited mode)
  if (currentLevel === 5 && state.settings.improvementSupply === "limited") {
    if (countStorefrontsOnBoard(state) + 4 > state.storefrontSupply) {
      return {
        ok: false,
        error: "Not enough storefronts in supply to downgrade tower.",
      };
    }
  }

  const salePrice =
    currentLevel === 5
      ? Math.floor(district.towerCost / 2)
      : Math.floor(district.improvementCost / 2);

  let s = updatePlayer(state, uid, (p) => ({
    ...p,
    cash: p.cash + salePrice,
  }));
  s = setImprovementLevel(s, propertyIndex, currentLevel - 1);
  s = recalcAllNetWorth(s);
  s = { ...s, moveCount: s.moveCount + 1 };

  return { ok: true, state: s };
}

// =============================================================================
// Mortgage Processors
// =============================================================================

function processMortgageProperty(
  state: MetroMagnatePublicState,
  uid: string,
  propertyIndex: number,
): EngineResult {
  if (
    state.phase !== "pre_roll" &&
    state.phase !== "post_roll" &&
    state.phase !== "debt_resolution"
  ) {
    return { ok: false, error: "Cannot mortgage in current phase." };
  }

  if (getPropertyOwner(state, propertyIndex) !== uid) {
    return { ok: false, error: "You do not own this property." };
  }
  if (isPropertyMortgaged(state, propertyIndex)) {
    return { ok: false, error: "Property is already mortgaged." };
  }

  // Districts: must sell all improvements in the sector first
  const district = getDistrictCard(propertyIndex);
  if (district) {
    const sector = getSector(district.sectorId);
    if (sector) {
      for (const idx of sector.districtIndices) {
        if (getImprovementLevel(state, idx) > 0) {
          return {
            ok: false,
            error:
              "Must sell all improvements in the sector before mortgaging.",
          };
        }
      }
    }
  }

  const transit = getTransitLineCard(propertyIndex);
  const service = getServiceNodeCard(propertyIndex);
  const mv =
    district?.mortgageValue ??
    transit?.mortgageValue ??
    service?.mortgageValue ??
    0;
  if (mv <= 0) {
    return { ok: false, error: "Property has no mortgage value." };
  }

  let s = updatePlayer(state, uid, (p) => ({
    ...p,
    cash: p.cash + mv,
    mortgagedProperties: [...p.mortgagedProperties, propertyIndex],
  }));

  const existing = s.propertyMortgages.find(
    (m) => m.spaceIndex === propertyIndex,
  );
  if (existing) {
    s = {
      ...s,
      propertyMortgages: s.propertyMortgages.map((m) =>
        m.spaceIndex === propertyIndex ? { ...m, mortgaged: true } : m,
      ),
    };
  } else {
    s = {
      ...s,
      propertyMortgages: [
        ...s.propertyMortgages,
        { spaceIndex: propertyIndex, mortgaged: true },
      ],
    };
  }

  s = recalcAllNetWorth(s);
  s = { ...s, moveCount: s.moveCount + 1 };

  return { ok: true, state: s };
}

function processUnmortgageProperty(
  state: MetroMagnatePublicState,
  uid: string,
  propertyIndex: number,
): EngineResult {
  if (state.phase !== "pre_roll" && state.phase !== "post_roll") {
    return { ok: false, error: "Cannot unmortgage in current phase." };
  }

  if (getPropertyOwner(state, propertyIndex) !== uid) {
    return { ok: false, error: "You do not own this property." };
  }
  if (!isPropertyMortgaged(state, propertyIndex)) {
    return { ok: false, error: "Property is not mortgaged." };
  }

  const district = getDistrictCard(propertyIndex);
  const transit = getTransitLineCard(propertyIndex);
  const service = getServiceNodeCard(propertyIndex);
  const mv =
    district?.mortgageValue ??
    transit?.mortgageValue ??
    service?.mortgageValue ??
    0;
  const fee = Math.round(mv * UNMORTGAGE_FEE_RATE);
  const totalCost = mv + fee;

  const player = getPlayer(state, uid);
  if (player.cash < totalCost) {
    return { ok: false, error: "Not enough cash to unmortgage." };
  }

  let s = updatePlayer(state, uid, (p) => ({
    ...p,
    cash: p.cash - totalCost,
    mortgagedProperties: p.mortgagedProperties.filter(
      (idx) => idx !== propertyIndex,
    ),
  }));

  s = {
    ...s,
    propertyMortgages: s.propertyMortgages.map((m) =>
      m.spaceIndex === propertyIndex ? { ...m, mortgaged: false } : m,
    ),
  };

  s = recalcAllNetWorth(s);
  s = { ...s, moveCount: s.moveCount + 1 };

  return { ok: true, state: s };
}

// =============================================================================
// Trade Processors
// =============================================================================

function processProposeTrade(
  state: MetroMagnatePublicState,
  uid: string,
  offer: TradeOffer,
): EngineResult {
  if (state.phase !== "pre_roll" && state.phase !== "post_roll") {
    return { ok: false, error: "Cannot trade in current phase." };
  }
  if (!state.settings.tradeWindow) {
    return { ok: false, error: "Trading is disabled." };
  }
  if (state.activeTrade) {
    return { ok: false, error: "A trade is already pending." };
  }
  if (state.activeAuction) {
    return { ok: false, error: "Cannot trade during an auction." };
  }

  const target = getPlayer(state, offer.toUid);
  if (!target || target.isBankrupt) {
    return { ok: false, error: "Invalid trade target." };
  }
  if (offer.toUid === uid) {
    return { ok: false, error: "Cannot trade with yourself." };
  }

  // Validate offered properties
  for (const propIdx of offer.offeredProperties) {
    if (getPropertyOwner(state, propIdx) !== uid) {
      return {
        ok: false,
        error: "You don't own one of the offered properties.",
      };
    }
    if (getImprovementLevel(state, propIdx) > 0) {
      return {
        ok: false,
        error: "Must sell improvements before trading a property.",
      };
    }
  }

  // Validate requested properties
  for (const propIdx of offer.requestedProperties) {
    if (getPropertyOwner(state, propIdx) !== offer.toUid) {
      return {
        ok: false,
        error: "Target doesn't own one of the requested properties.",
      };
    }
    if (getImprovementLevel(state, propIdx) > 0) {
      return {
        ok: false,
        error: "Target must sell improvements before trading a property.",
      };
    }
  }

  // Validate cash & passes
  const proposer = getPlayer(state, uid);
  if (offer.offeredCash > proposer.cash) {
    return { ok: false, error: "You don't have enough cash." };
  }
  if (offer.requestedCash > target.cash) {
    return { ok: false, error: "Target doesn't have enough cash." };
  }
  if (offer.offeredInspectionPasses > proposer.inspectionPasses) {
    return { ok: false, error: "You don't have enough inspection passes." };
  }
  if (offer.requestedInspectionPasses > target.inspectionPasses) {
    return {
      ok: false,
      error: "Target doesn't have enough inspection passes.",
    };
  }

  const trade: TradeOffer = {
    ...offer,
    fromUid: uid,
    status: "pending",
    returnPhase: state.phase,
  };

  const s: MetroMagnatePublicState = {
    ...state,
    activeTrade: trade,
    currentTurnUid: offer.toUid,
    phase: "trading" as TurnPhase,
    moveCount: state.moveCount + 1,
  };

  return { ok: true, state: s, nextTurnPlayerId: offer.toUid };
}

function processAcceptTrade(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (!state.activeTrade || state.activeTrade.status !== "pending") {
    return { ok: false, error: "No pending trade." };
  }
  const trade = state.activeTrade;
  if (uid !== trade.toUid) {
    return { ok: false, error: "Only the trade target can accept." };
  }

  let s: MetroMagnatePublicState = { ...state };

  // Transfer offered properties (proposer → target)
  for (const propIdx of trade.offeredProperties) {
    s = updatePlayer(s, trade.fromUid, (p) => ({
      ...p,
      ownedProperties: p.ownedProperties.filter((i) => i !== propIdx),
    }));
    s = updatePlayer(s, trade.toUid, (p) => ({
      ...p,
      ownedProperties: [...p.ownedProperties, propIdx],
    }));
    s = {
      ...s,
      propertyOwnership: s.propertyOwnership.map((o) =>
        o.spaceIndex === propIdx ? { ...o, ownerUid: trade.toUid } : o,
      ),
    };
    if (isPropertyMortgaged(s, propIdx)) {
      s = updatePlayer(s, trade.fromUid, (p) => ({
        ...p,
        mortgagedProperties: p.mortgagedProperties.filter((i) => i !== propIdx),
      }));
      s = updatePlayer(s, trade.toUid, (p) => ({
        ...p,
        mortgagedProperties: [...p.mortgagedProperties, propIdx],
      }));
    }
  }

  // Transfer requested properties (target → proposer)
  for (const propIdx of trade.requestedProperties) {
    s = updatePlayer(s, trade.toUid, (p) => ({
      ...p,
      ownedProperties: p.ownedProperties.filter((i) => i !== propIdx),
    }));
    s = updatePlayer(s, trade.fromUid, (p) => ({
      ...p,
      ownedProperties: [...p.ownedProperties, propIdx],
    }));
    s = {
      ...s,
      propertyOwnership: s.propertyOwnership.map((o) =>
        o.spaceIndex === propIdx ? { ...o, ownerUid: trade.fromUid } : o,
      ),
    };
    if (isPropertyMortgaged(s, propIdx)) {
      s = updatePlayer(s, trade.toUid, (p) => ({
        ...p,
        mortgagedProperties: p.mortgagedProperties.filter((i) => i !== propIdx),
      }));
      s = updatePlayer(s, trade.fromUid, (p) => ({
        ...p,
        mortgagedProperties: [...p.mortgagedProperties, propIdx],
      }));
    }
  }

  // Transfer cash
  if (trade.offeredCash > 0) {
    s = updatePlayer(s, trade.fromUid, (p) => ({
      ...p,
      cash: p.cash - trade.offeredCash,
    }));
    s = updatePlayer(s, trade.toUid, (p) => ({
      ...p,
      cash: p.cash + trade.offeredCash,
    }));
  }
  if (trade.requestedCash > 0) {
    s = updatePlayer(s, trade.toUid, (p) => ({
      ...p,
      cash: p.cash - trade.requestedCash,
    }));
    s = updatePlayer(s, trade.fromUid, (p) => ({
      ...p,
      cash: p.cash + trade.requestedCash,
    }));
  }

  // Transfer inspection passes
  if (trade.offeredInspectionPasses > 0) {
    s = updatePlayer(s, trade.fromUid, (p) => ({
      ...p,
      inspectionPasses: p.inspectionPasses - trade.offeredInspectionPasses,
    }));
    s = updatePlayer(s, trade.toUid, (p) => ({
      ...p,
      inspectionPasses: p.inspectionPasses + trade.offeredInspectionPasses,
    }));
  }
  if (trade.requestedInspectionPasses > 0) {
    s = updatePlayer(s, trade.toUid, (p) => ({
      ...p,
      inspectionPasses: p.inspectionPasses - trade.requestedInspectionPasses,
    }));
    s = updatePlayer(s, trade.fromUid, (p) => ({
      ...p,
      inspectionPasses: p.inspectionPasses + trade.requestedInspectionPasses,
    }));
  }

  const returnPhase = trade.returnPhase;
  s = {
    ...s,
    activeTrade: null,
    currentTurnUid: trade.fromUid,
    phase: returnPhase,
    moveCount: s.moveCount + 1,
  };
  s = recalcAllNetWorth(s);

  return { ok: true, state: s, nextTurnPlayerId: trade.fromUid };
}

function processRejectTrade(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (!state.activeTrade || state.activeTrade.status !== "pending") {
    return { ok: false, error: "No pending trade." };
  }
  const trade = state.activeTrade;
  if (uid !== trade.toUid) {
    return { ok: false, error: "Only the trade target can reject." };
  }

  const s: MetroMagnatePublicState = {
    ...state,
    activeTrade: null,
    currentTurnUid: trade.fromUid,
    phase: trade.returnPhase,
    moveCount: state.moveCount + 1,
  };
  return { ok: true, state: s, nextTurnPlayerId: trade.fromUid };
}

// =============================================================================
// Debt / Bankruptcy Processors
// =============================================================================

function processPayDebt(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (state.phase !== "debt_resolution" || !state.debtContext) {
    return { ok: false, error: "No active debt to pay." };
  }

  const player = getPlayer(state, uid);
  const { amount, creditorUid, canReroll, debtType } = state.debtContext;
  if (player.cash < amount) {
    return {
      ok: false,
      error: `Need $${amount} but only have $${player.cash}. Sell improvements, mortgage properties, or declare bankruptcy.`,
    };
  }

  let s = updatePlayer(state, uid, (p) => ({
    ...p,
    cash: p.cash - amount,
  }));
  if (creditorUid) {
    s = updatePlayer(s, creditorUid, (p) => ({
      ...p,
      cash: p.cash + amount,
    }));
  }
  // Civic fee debt → route payment to plaza pot
  if (debtType === "civic_fee") {
    s = { ...s, plazaPot: s.plazaPot + amount };
  }
  s = { ...s, debtContext: null, moveCount: s.moveCount + 1 };
  s = recalcAllNetWorth(s);

  if (canReroll && s.doublesCount > 0) {
    return { ok: true, state: { ...s, phase: "pre_roll" as TurnPhase } };
  }
  return { ok: true, state: { ...s, phase: "post_roll" as TurnPhase } };
}

function processDeclareBankruptcy(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (state.phase !== "debt_resolution" || !state.debtContext) {
    return { ok: false, error: "No active debt." };
  }

  const { creditorUid } = state.debtContext;
  let s = bankruptPlayer(state, uid, creditorUid);
  s = recalcAllNetWorth(s);

  const terminal = checkTerminal(s);
  if (terminal) {
    s = {
      ...s,
      phase: "game_over" as TurnPhase,
      winnerUid: terminal.winnerIds?.[0] ?? null,
      endReason: terminal.reason ?? null,
    };
    return { ok: true, state: s, terminal };
  }

  // Bankrupt player's turn is over — advance
  const nextIdx = getNextActivePlayerIndex(s, state.currentTurnIndex);
  const nextUid = state.turnOrder[nextIdx];
  const inInspection = s.inspectionHoldTurns.some((h) => h.uid === nextUid);
  s = {
    ...s,
    currentTurnIndex: nextIdx,
    currentTurnUid: nextUid,
    turnNumber: s.turnNumber + 1,
    phase: (inInspection ? "inspection" : "pre_roll") as TurnPhase,
  };
  return { ok: true, state: s, nextTurnPlayerId: nextUid };
}

// =============================================================================
// End Turn
// =============================================================================

function processEndTurn(
  state: MetroMagnatePublicState,
  uid: string,
): EngineResult {
  if (state.phase !== "post_roll") {
    return { ok: false, error: "Cannot end turn in current phase." };
  }

  const nextIdx = getNextActivePlayerIndex(state, state.currentTurnIndex);
  const nextUid = state.turnOrder[nextIdx];

  // Check if the next player is in inspection
  const inInspection = state.inspectionHoldTurns.some((h) => h.uid === nextUid);

  let s: MetroMagnatePublicState = {
    ...state,
    currentTurnIndex: nextIdx,
    currentTurnUid: nextUid,
    turnNumber: state.turnNumber + 1,
    moveCount: state.moveCount + 1,
    doublesCount: 0,
    lastDice: null,
    phase: (inInspection ? "inspection" : "pre_roll") as TurnPhase,
  };

  s = recalcAllNetWorth(s);

  const terminal = checkTerminal(s);
  if (terminal) {
    s = {
      ...s,
      phase: "game_over" as TurnPhase,
      winnerUid: terminal.winnerIds?.[0] ?? null,
      endReason: terminal.reason ?? null,
    };
    return { ok: true, state: s, terminal, nextTurnPlayerId: nextUid };
  }

  return { ok: true, state: s, nextTurnPlayerId: nextUid };
}

// =============================================================================
// Main Dispatch
// =============================================================================

export function processMove(
  state: MetroMagnatePublicState,
  uid: string,
  payload: MetroMagnateMovePayload,
): EngineResult {
  // Validate turn ownership — use currentTurnUid for auction/trade support
  if (uid !== state.currentTurnUid) {
    return { ok: false, error: "It is not your turn." };
  }

  if (state.phase === "game_over") {
    return { ok: false, error: "Game is already over." };
  }

  switch (payload.action) {
    case "roll_dice":
      return processRollDice(state, uid);
    case "buy_property":
      return processBuyProperty(state, uid);
    case "decline_property":
      return processDeclineProperty(state, uid);
    case "auction_bid":
      return processAuctionBid(state, uid, payload.amount);
    case "auction_pass":
      return processAuctionPass(state, uid);
    case "build_improvement":
      return processBuildImprovement(state, uid, payload.propertyIndex);
    case "sell_improvement":
      return processSellImprovement(state, uid, payload.propertyIndex);
    case "mortgage_property":
      return processMortgageProperty(state, uid, payload.propertyIndex);
    case "unmortgage_property":
      return processUnmortgageProperty(state, uid, payload.propertyIndex);
    case "propose_trade":
      return processProposeTrade(state, uid, payload.offer);
    case "accept_trade":
      return processAcceptTrade(state, uid);
    case "reject_trade":
      return processRejectTrade(state, uid);
    case "pay_debt":
      return processPayDebt(state, uid);
    case "declare_bankruptcy":
      return processDeclareBankruptcy(state, uid);
    case "pay_inspection_fine":
      return processPayInspectionFine(state, uid);
    case "use_inspection_pass":
      return processUseInspectionPass(state, uid);
    case "wait_in_inspection":
      return processWaitInInspection(state, uid);
    case "end_turn":
      return processEndTurn(state, uid);
    default:
      return {
        ok: false,
        error: `Action "${(payload as { action: string }).action}" is not recognized.`,
      };
  }
}
