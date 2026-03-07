/**
 * Games V4 — Solitaire Klondike (Solo) Adapter
 *
 * Pure, deterministic game logic for Klondike Solitaire (Turn 3).
 * Solo game — no multiplayer, no lobby, no spectating.
 *
 * Rules:
 * - Standard 52-card deck, 7 tableau piles (1..7 cards)
 * - Top card of each tableau pile face up, rest face down
 * - Remaining 24 cards go to stock
 * - Four foundations build by suit Ace→King
 * - Tableau builds downward alternating color
 * - Stock deals 3 cards to waste; unlimited recycles
 * - Win when all 52 cards on foundations
 *
 * Scoring:
 * - +10 foundation, +5 waste→tableau, +5 reveal face-down
 * - -15 foundation→tableau backtrack, -20 recycle stock
 * - +700 completion bonus
 *
 * @module gamesV4/adapters/solitaireKlondike
 */

import type {
  GameAdapterV4,
  GameOutcome,
  MoveValidationResult,
} from "../types/adapter";
import { registerAdapter } from "./registry";

// =============================================================================
// Card Representation
// =============================================================================

/** Compact card code: rank + suit initial. E.g. "AS", "10H", "QC", "2D" */
export type CardCode = string;

export type Suit = "S" | "H" | "D" | "C";
export type SuitName = "spades" | "hearts" | "diamonds" | "clubs";
export type Color = "red" | "black";

const SUITS: Suit[] = ["S", "H", "D", "C"];
const RANKS: string[] = [
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
const RANK_VALUES: Record<string, number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
};

const SUIT_TO_NAME: Record<Suit, SuitName> = {
  S: "spades",
  H: "hearts",
  D: "diamonds",
  C: "clubs",
};

// =============================================================================
// Card Helpers (exported for tests and UI)
// =============================================================================

export function cardSuit(card: CardCode): Suit {
  return card.slice(-1) as Suit;
}

export function cardSuitName(card: CardCode): SuitName {
  return SUIT_TO_NAME[cardSuit(card)];
}

export function cardRank(card: CardCode): string {
  return card.slice(0, -1);
}

export function cardRankValue(card: CardCode): number {
  return RANK_VALUES[cardRank(card)] ?? 0;
}

export function cardColor(card: CardCode): Color {
  const s = cardSuit(card);
  return s === "H" || s === "D" ? "red" : "black";
}

export function isNextRankUp(lower: CardCode, upper: CardCode): boolean {
  return cardRankValue(upper) === cardRankValue(lower) + 1;
}

export function isNextRankDown(higher: CardCode, lower: CardCode): boolean {
  return cardRankValue(higher) === cardRankValue(lower) + 1;
}

export function canPlaceOnTableau(
  movingBottom: CardCode,
  targetTop: CardCode | null,
): boolean {
  if (!targetTop) {
    // Empty column: only King allowed
    return cardRank(movingBottom) === "K";
  }
  return (
    cardColor(movingBottom) !== cardColor(targetTop) &&
    isNextRankDown(targetTop, movingBottom)
  );
}

export function canPlaceOnFoundation(
  card: CardCode,
  foundationTop: CardCode | null,
): boolean {
  if (!foundationTop) {
    return cardRank(card) === "A";
  }
  return (
    cardSuit(card) === cardSuit(foundationTop) &&
    isNextRankUp(foundationTop, card)
  );
}

export function isValidAlternatingDescendingRun(cards: CardCode[]): boolean {
  for (let i = 0; i < cards.length - 1; i++) {
    if (
      cardColor(cards[i]) === cardColor(cards[i + 1]) ||
      !isNextRankDown(cards[i], cards[i + 1])
    ) {
      return false;
    }
  }
  return true;
}

// =============================================================================
// Deck / Shuffle
// =============================================================================

export function buildDeck(): CardCode[] {
  const deck: CardCode[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

/**
 * Deterministic seeded shuffle using a simple LCG.
 * Seed is derived from players array to ensure client/server parity.
 */
export function shuffleDeck(deck: CardCode[], seed: number = 42): CardCode[] {
  const arr = [...deck];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = (s >>> 0) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =============================================================================
// State Types
// =============================================================================

export interface TableauColumn {
  down: CardCode[];
  up: CardCode[];
}

export interface SolitaireFoundations {
  spades: CardCode[];
  hearts: CardCode[];
  diamonds: CardCode[];
  clubs: CardCode[];
}

export interface SolitaireState {
  tableau: TableauColumn[];
  stock: CardCode[];
  waste: CardCode[];
  foundations: SolitaireFoundations;
  score: number;
  moveCount: number;
  recycleCount: number;
  faceDownRevealedCount: number;
  tableauMoveCount: number;
  wasteToTableauCount: number;
  foundationBacktrackCount: number;
  canAutoComplete: boolean;
  completed: boolean;
  lastMoveSummary: string | null;
  /** Bounded undo stack — stores up to MAX_UNDO previous states */
  undoStack: SolitaireUndoEntry[];
  /** Seed used for deck generation (for restart parity) */
  seed: number;
  /** Start time for duration tracking */
  startedAt: number;
}

export interface SolitaireUndoEntry {
  tableau: TableauColumn[];
  stock: CardCode[];
  waste: CardCode[];
  foundations: SolitaireFoundations;
  score: number;
  moveCount: number;
  recycleCount: number;
  faceDownRevealedCount: number;
  tableauMoveCount: number;
  wasteToTableauCount: number;
  foundationBacktrackCount: number;
  lastMoveSummary: string | null;
}

// Maximum undo states to store
const MAX_UNDO = 30;

// =============================================================================
// Move Types
// =============================================================================

export type SolitaireMoveType =
  | "deal_stock"
  | "recycle_stock"
  | "move_waste_to_foundation"
  | "move_waste_to_tableau"
  | "move_tableau_to_foundation"
  | "move_tableau_to_tableau"
  | "move_foundation_to_tableau"
  | "undo"
  | "auto_complete_step";

export interface SolitaireMove {
  type: SolitaireMoveType;
  /** Source tableau column index (0-6) */
  sourceCol?: number;
  /** Destination tableau column index (0-6) */
  destCol?: number;
  /** Index within the `up` array where the run starts (for tableau-to-tableau) */
  startIndex?: number;
  /** Number of cards in the run (for tableau-to-tableau) */
  count?: number;
  /** Source foundation suit (for foundation-to-tableau) */
  sourceSuit?: SuitName;
}

// =============================================================================
// State Initialization
// =============================================================================

export function dealInitialKlondikeState(seed: number): SolitaireState {
  const deck = shuffleDeck(buildDeck(), seed);

  const tableau: TableauColumn[] = [];
  let idx = 0;

  // Deal tableau: pile i has i+1 cards, top card face up
  for (let i = 0; i < 7; i++) {
    const down: CardCode[] = [];
    for (let j = 0; j < i; j++) {
      down.push(deck[idx++]);
    }
    const up: CardCode[] = [deck[idx++]];
    tableau.push({ down, up });
  }

  // Remaining 24 cards go to stock
  const stock = deck.slice(idx);

  return {
    tableau,
    stock,
    waste: [],
    foundations: { spades: [], hearts: [], diamonds: [], clubs: [] },
    score: 0,
    moveCount: 0,
    recycleCount: 0,
    faceDownRevealedCount: 0,
    tableauMoveCount: 0,
    wasteToTableauCount: 0,
    foundationBacktrackCount: 0,
    canAutoComplete: false,
    completed: false,
    lastMoveSummary: null,
    undoStack: [],
    seed,
    startedAt: Date.now(),
  };
}

// =============================================================================
// Deep Clone Helper
// =============================================================================

function cloneState(state: SolitaireState): SolitaireState {
  return {
    tableau: state.tableau.map((col) => ({
      down: [...col.down],
      up: [...col.up],
    })),
    stock: [...state.stock],
    waste: [...state.waste],
    foundations: {
      spades: [...state.foundations.spades],
      hearts: [...state.foundations.hearts],
      diamonds: [...state.foundations.diamonds],
      clubs: [...state.foundations.clubs],
    },
    score: state.score,
    moveCount: state.moveCount,
    recycleCount: state.recycleCount,
    faceDownRevealedCount: state.faceDownRevealedCount,
    tableauMoveCount: state.tableauMoveCount,
    wasteToTableauCount: state.wasteToTableauCount,
    foundationBacktrackCount: state.foundationBacktrackCount,
    canAutoComplete: state.canAutoComplete,
    completed: state.completed,
    lastMoveSummary: state.lastMoveSummary,
    undoStack: state.undoStack.map((e) => ({
      tableau: e.tableau.map((col) => ({
        down: [...col.down],
        up: [...col.up],
      })),
      stock: [...e.stock],
      waste: [...e.waste],
      foundations: {
        spades: [...e.foundations.spades],
        hearts: [...e.foundations.hearts],
        diamonds: [...e.foundations.diamonds],
        clubs: [...e.foundations.clubs],
      },
      score: e.score,
      moveCount: e.moveCount,
      recycleCount: e.recycleCount,
      faceDownRevealedCount: e.faceDownRevealedCount,
      tableauMoveCount: e.tableauMoveCount,
      wasteToTableauCount: e.wasteToTableauCount,
      foundationBacktrackCount: e.foundationBacktrackCount,
      lastMoveSummary: e.lastMoveSummary,
    })),
    seed: state.seed,
    startedAt: state.startedAt,
  };
}

function makeUndoEntry(state: SolitaireState): SolitaireUndoEntry {
  return {
    tableau: state.tableau.map((col) => ({
      down: [...col.down],
      up: [...col.up],
    })),
    stock: [...state.stock],
    waste: [...state.waste],
    foundations: {
      spades: [...state.foundations.spades],
      hearts: [...state.foundations.hearts],
      diamonds: [...state.foundations.diamonds],
      clubs: [...state.foundations.clubs],
    },
    score: state.score,
    moveCount: state.moveCount,
    recycleCount: state.recycleCount,
    faceDownRevealedCount: state.faceDownRevealedCount,
    tableauMoveCount: state.tableauMoveCount,
    wasteToTableauCount: state.wasteToTableauCount,
    foundationBacktrackCount: state.foundationBacktrackCount,
    lastMoveSummary: state.lastMoveSummary,
  };
}

function pushUndo(state: SolitaireState): void {
  const entry = makeUndoEntry(state);
  state.undoStack = [...state.undoStack.slice(-(MAX_UNDO - 1)), entry];
}

// =============================================================================
// Foundation Helpers
// =============================================================================

function foundationForSuit(
  foundations: SolitaireFoundations,
  suit: SuitName,
): CardCode[] {
  return foundations[suit];
}

function totalFoundationCards(foundations: SolitaireFoundations): number {
  return (
    foundations.spades.length +
    foundations.hearts.length +
    foundations.diamonds.length +
    foundations.clubs.length
  );
}

// =============================================================================
// Reveal Helper — flip face-down card when tableau up pile is emptied
// =============================================================================

function revealIfNeeded(col: TableauColumn): { revealed: boolean } {
  if (col.up.length === 0 && col.down.length > 0) {
    col.up.push(col.down.pop()!);
    return { revealed: true };
  }
  return { revealed: false };
}

// =============================================================================
// Auto-Complete Eligibility
// =============================================================================

/**
 * Auto-complete is eligible when all face-down cards are revealed
 * (no hidden cards remain in any tableau column) and the stock/waste
 * are empty or all remaining cards can be trivially placed.
 */
export function computeAutoCompleteEligibility(state: SolitaireState): boolean {
  // All face-down cards must be revealed
  for (const col of state.tableau) {
    if (col.down.length > 0) return false;
  }
  // Stock and waste must be empty
  if (state.stock.length > 0 || state.waste.length > 0) return false;
  return true;
}

// =============================================================================
// Legal Move Detection
// =============================================================================

/**
 * Find any legal move in the current state.
 * Returns a move payload or null if no legal moves exist.
 * Priority:
 * 1. Move to foundation if clearly beneficial
 * 2. Reveal a face-down tableau card
 * 3. King to empty tableau
 * 4. Useful waste-to-tableau
 * 5. Stock tap
 */
export function findAnyLegalMove(state: SolitaireState): SolitaireMove | null {
  // 1. Tableau top → foundation
  for (let i = 0; i < 7; i++) {
    const col = state.tableau[i];
    if (col.up.length === 0) continue;
    const topCard = col.up[col.up.length - 1];
    const suitName = cardSuitName(topCard);
    const fPile = foundationForSuit(state.foundations, suitName);
    const fTop = fPile.length > 0 ? fPile[fPile.length - 1] : null;
    if (canPlaceOnFoundation(topCard, fTop)) {
      return { type: "move_tableau_to_foundation", sourceCol: i };
    }
  }

  // Waste top → foundation
  if (state.waste.length > 0) {
    const wasteTop = state.waste[state.waste.length - 1];
    const suitName = cardSuitName(wasteTop);
    const fPile = foundationForSuit(state.foundations, suitName);
    const fTop = fPile.length > 0 ? fPile[fPile.length - 1] : null;
    if (canPlaceOnFoundation(wasteTop, fTop)) {
      return { type: "move_waste_to_foundation" };
    }
  }

  // 2. Tableau-to-tableau that reveals a face-down card
  for (let i = 0; i < 7; i++) {
    const srcCol = state.tableau[i];
    if (srcCol.up.length === 0) continue;
    // Try moving the entire up pile to reveal a down card
    if (srcCol.down.length > 0) {
      const bottomCard = srcCol.up[0];
      for (let j = 0; j < 7; j++) {
        if (i === j) continue;
        const destCol = state.tableau[j];
        const destTop =
          destCol.up.length > 0 ? destCol.up[destCol.up.length - 1] : null;
        if (canPlaceOnTableau(bottomCard, destTop)) {
          return {
            type: "move_tableau_to_tableau",
            sourceCol: i,
            destCol: j,
            startIndex: 0,
            count: srcCol.up.length,
          };
        }
      }
    }
  }

  // 3. King run to empty tableau (only if it has down cards behind it)
  for (let i = 0; i < 7; i++) {
    const srcCol = state.tableau[i];
    if (srcCol.up.length === 0) continue;
    if (cardRank(srcCol.up[0]) === "K" && srcCol.down.length > 0) {
      for (let j = 0; j < 7; j++) {
        if (i === j) continue;
        const destCol = state.tableau[j];
        if (destCol.up.length === 0 && destCol.down.length === 0) {
          return {
            type: "move_tableau_to_tableau",
            sourceCol: i,
            destCol: j,
            startIndex: 0,
            count: srcCol.up.length,
          };
        }
      }
    }
  }

  // 4. Waste → tableau
  if (state.waste.length > 0) {
    const wasteTop = state.waste[state.waste.length - 1];
    for (let j = 0; j < 7; j++) {
      const destCol = state.tableau[j];
      const destTop =
        destCol.up.length > 0 ? destCol.up[destCol.up.length - 1] : null;
      if (canPlaceOnTableau(wasteTop, destTop)) {
        return { type: "move_waste_to_tableau", destCol: j };
      }
    }
  }

  // 5. Tableau-to-tableau general (any partial run move that is legal)
  for (let i = 0; i < 7; i++) {
    const srcCol = state.tableau[i];
    if (srcCol.up.length === 0) continue;
    for (let si = 0; si < srcCol.up.length; si++) {
      const run = srcCol.up.slice(si);
      if (!isValidAlternatingDescendingRun(run)) continue;
      for (let j = 0; j < 7; j++) {
        if (i === j) continue;
        const destCol = state.tableau[j];
        const destTop =
          destCol.up.length > 0 ? destCol.up[destCol.up.length - 1] : null;
        if (canPlaceOnTableau(run[0], destTop)) {
          return {
            type: "move_tableau_to_tableau",
            sourceCol: i,
            destCol: j,
            startIndex: si,
            count: run.length,
          };
        }
      }
    }
  }

  // 6. Deal from stock
  if (state.stock.length > 0) {
    return { type: "deal_stock" };
  }

  // 7. Recycle stock
  if (state.waste.length > 0) {
    return { type: "recycle_stock" };
  }

  return null;
}

// =============================================================================
// Terminal Stuck Detection
// =============================================================================

/**
 * Detect a terminal stuck state: no legal moves exist whatsoever.
 * This is only true when stock is empty, waste has no playable card,
 * and no tableau/foundation moves are possible.
 *
 * For unlimited redeals, we only declare stuck if:
 * - stock empty AND waste empty, OR
 * - stock empty AND recycling yields no new progress (checked by findAnyLegalMove)
 */
export function isTerminalStuckState(state: SolitaireState): boolean {
  return findAnyLegalMove(state) === null;
}

// =============================================================================
// Move Application Helpers
// =============================================================================

function applyDealStock(state: SolitaireState): MoveValidationResult {
  if (state.stock.length === 0) {
    return { ok: false, error: "Stock is empty. Recycle first." };
  }

  pushUndo(state);

  // Deal up to 3 cards from stock to waste
  const count = Math.min(3, state.stock.length);
  const dealt = state.stock.splice(-count, count);
  // Cards are dealt so the last dealt card is on top of waste
  state.waste.push(...dealt);
  state.moveCount++;
  state.lastMoveSummary = `Dealt ${count} from stock`;

  return { ok: true };
}

function applyRecycleStock(state: SolitaireState): MoveValidationResult {
  if (state.stock.length > 0) {
    return { ok: false, error: "Stock is not empty." };
  }
  if (state.waste.length === 0) {
    return { ok: false, error: "Nothing to recycle." };
  }

  pushUndo(state);

  // Flip waste back to stock (reverse to maintain order)
  state.stock = state.waste.reverse();
  state.waste = [];
  state.recycleCount++;
  state.score -= 20;
  state.moveCount++;
  state.lastMoveSummary = "Recycled waste to stock";

  return { ok: true };
}

function applyWasteToFoundation(state: SolitaireState): MoveValidationResult {
  if (state.waste.length === 0) {
    return { ok: false, error: "Waste is empty." };
  }

  const card = state.waste[state.waste.length - 1];
  const suitName = cardSuitName(card);
  const fPile = foundationForSuit(state.foundations, suitName);
  const fTop = fPile.length > 0 ? fPile[fPile.length - 1] : null;

  if (!canPlaceOnFoundation(card, fTop)) {
    return {
      ok: false,
      error: `Cannot place ${card} on ${suitName} foundation.`,
    };
  }

  pushUndo(state);

  state.waste.pop();
  fPile.push(card);
  state.score += 10;
  state.moveCount++;
  state.lastMoveSummary = `${card} → ${suitName} foundation`;

  return { ok: true };
}

function applyWasteToTableau(
  state: SolitaireState,
  destCol: number,
): MoveValidationResult {
  if (state.waste.length === 0) {
    return { ok: false, error: "Waste is empty." };
  }
  if (destCol < 0 || destCol > 6) {
    return { ok: false, error: "Invalid column." };
  }

  const card = state.waste[state.waste.length - 1];
  const col = state.tableau[destCol];
  const colTop = col.up.length > 0 ? col.up[col.up.length - 1] : null;

  if (!canPlaceOnTableau(card, colTop)) {
    return {
      ok: false,
      error: `Cannot place ${card} on tableau column ${destCol}.`,
    };
  }

  pushUndo(state);

  state.waste.pop();
  col.up.push(card);
  state.score += 5;
  state.wasteToTableauCount++;
  state.moveCount++;
  state.lastMoveSummary = `${card} → tableau ${destCol}`;

  return { ok: true };
}

function applyTableauToFoundation(
  state: SolitaireState,
  sourceCol: number,
): MoveValidationResult {
  if (sourceCol < 0 || sourceCol > 6) {
    return { ok: false, error: "Invalid column." };
  }

  const col = state.tableau[sourceCol];
  if (col.up.length === 0) {
    return { ok: false, error: "No face-up cards in source column." };
  }

  const card = col.up[col.up.length - 1];
  const suitName = cardSuitName(card);
  const fPile = foundationForSuit(state.foundations, suitName);
  const fTop = fPile.length > 0 ? fPile[fPile.length - 1] : null;

  if (!canPlaceOnFoundation(card, fTop)) {
    return {
      ok: false,
      error: `Cannot place ${card} on ${suitName} foundation.`,
    };
  }

  pushUndo(state);

  col.up.pop();
  fPile.push(card);
  state.score += 10;
  state.moveCount++;
  state.lastMoveSummary = `${card} → ${suitName} foundation`;

  // Reveal next card
  const { revealed } = revealIfNeeded(col);
  if (revealed) {
    state.faceDownRevealedCount++;
    state.score += 5;
  }

  return { ok: true };
}

function applyTableauToTableau(
  state: SolitaireState,
  sourceCol: number,
  destCol: number,
  startIndex: number,
  count: number,
): MoveValidationResult {
  if (sourceCol < 0 || sourceCol > 6 || destCol < 0 || destCol > 6) {
    return { ok: false, error: "Invalid column index." };
  }
  if (sourceCol === destCol) {
    return { ok: false, error: "Source and destination are the same." };
  }

  const src = state.tableau[sourceCol];
  if (startIndex < 0 || startIndex >= src.up.length) {
    return { ok: false, error: "Invalid start index." };
  }

  const run = src.up.slice(startIndex, startIndex + count);
  if (run.length !== count || count === 0) {
    return { ok: false, error: "Invalid run count." };
  }

  // Validate the run is a valid alternating-color descending sequence
  if (!isValidAlternatingDescendingRun(run)) {
    return { ok: false, error: "Cards do not form a valid run." };
  }

  const dest = state.tableau[destCol];
  const destTop = dest.up.length > 0 ? dest.up[dest.up.length - 1] : null;

  if (!canPlaceOnTableau(run[0], destTop)) {
    return {
      ok: false,
      error: `Cannot place ${run[0]} on tableau column ${destCol}.`,
    };
  }

  pushUndo(state);

  // Remove the run from source
  src.up.splice(startIndex, count);
  // Add to destination
  dest.up.push(...run);

  state.tableauMoveCount++;
  state.moveCount++;
  state.lastMoveSummary = `Moved ${count} card${count > 1 ? "s" : ""} from col ${sourceCol} → col ${destCol}`;

  // Reveal next card in source column
  const { revealed } = revealIfNeeded(src);
  if (revealed) {
    state.faceDownRevealedCount++;
    state.score += 5;
  }

  return { ok: true };
}

function applyFoundationToTableau(
  state: SolitaireState,
  sourceSuit: SuitName,
  destCol: number,
): MoveValidationResult {
  if (destCol < 0 || destCol > 6) {
    return { ok: false, error: "Invalid column." };
  }

  const fPile = foundationForSuit(state.foundations, sourceSuit);
  if (fPile.length === 0) {
    return { ok: false, error: `${sourceSuit} foundation is empty.` };
  }

  const card = fPile[fPile.length - 1];
  const dest = state.tableau[destCol];
  const destTop = dest.up.length > 0 ? dest.up[dest.up.length - 1] : null;

  if (!canPlaceOnTableau(card, destTop)) {
    return {
      ok: false,
      error: `Cannot place ${card} on tableau column ${destCol}.`,
    };
  }

  pushUndo(state);

  fPile.pop();
  dest.up.push(card);
  state.score -= 15;
  state.foundationBacktrackCount++;
  state.moveCount++;
  state.lastMoveSummary = `${card} ← ${sourceSuit} foundation → tableau ${destCol}`;

  return { ok: true };
}

function applyUndo(state: SolitaireState): MoveValidationResult {
  if (state.undoStack.length === 0) {
    return { ok: false, error: "Nothing to undo." };
  }

  const prev = state.undoStack.pop()!;

  state.tableau = prev.tableau.map((col) => ({
    down: [...col.down],
    up: [...col.up],
  }));
  state.stock = [...prev.stock];
  state.waste = [...prev.waste];
  state.foundations = {
    spades: [...prev.foundations.spades],
    hearts: [...prev.foundations.hearts],
    diamonds: [...prev.foundations.diamonds],
    clubs: [...prev.foundations.clubs],
  };
  state.score = prev.score;
  state.moveCount = prev.moveCount;
  state.recycleCount = prev.recycleCount;
  state.faceDownRevealedCount = prev.faceDownRevealedCount;
  state.tableauMoveCount = prev.tableauMoveCount;
  state.wasteToTableauCount = prev.wasteToTableauCount;
  state.foundationBacktrackCount = prev.foundationBacktrackCount;
  state.lastMoveSummary = "Undo";

  return { ok: true };
}

function applyAutoCompleteStep(state: SolitaireState): MoveValidationResult {
  if (!computeAutoCompleteEligibility(state)) {
    return { ok: false, error: "Auto-complete not available." };
  }

  // Find any card that can go to foundation
  for (let i = 0; i < 7; i++) {
    const col = state.tableau[i];
    if (col.up.length === 0) continue;
    const topCard = col.up[col.up.length - 1];
    const suitName = cardSuitName(topCard);
    const fPile = foundationForSuit(state.foundations, suitName);
    const fTop = fPile.length > 0 ? fPile[fPile.length - 1] : null;
    if (canPlaceOnFoundation(topCard, fTop)) {
      // Don't push undo for auto-complete steps (they're irreversible progress)
      col.up.pop();
      fPile.push(topCard);
      state.score += 10;
      state.moveCount++;
      state.lastMoveSummary = `Auto: ${topCard} → ${suitName} foundation`;
      return { ok: true };
    }
  }

  return { ok: false, error: "No auto-complete moves available." };
}

// =============================================================================
// Extract Performance Metrics
// =============================================================================

export function extractMetrics(state: SolitaireState): Record<string, unknown> {
  const fc = totalFoundationCards(state.foundations);
  return {
    completed: state.completed,
    finalScore: state.score,
    foundationCount: fc,
    moveCount: state.moveCount,
    recycleCount: state.recycleCount,
    faceDownRevealedCount: state.faceDownRevealedCount,
    durationMs: Date.now() - state.startedAt,
    maxFoundationDepthBySuit: {
      spades: state.foundations.spades.length,
      hearts: state.foundations.hearts.length,
      diamonds: state.foundations.diamonds.length,
      clubs: state.foundations.clubs.length,
    },
    cardsRemainingOutsideFoundation: 52 - fc,
    tableauMoveCount: state.tableauMoveCount,
    wasteToTableauCount: state.wasteToTableauCount,
    foundationBacktrackCount: state.foundationBacktrackCount,
  };
}

// =============================================================================
// Adapter
// =============================================================================

const solitaireKlondikeAdapter: GameAdapterV4 = {
  gameId: "solitaire_klondike",
  runtimeType: "solo",
  maxPlayers: 1,
  minPlayers: 1,
  supportsSpectate: false,
  spectateMode: "public_only",

  scoreboardDescriptor: {
    title: "FINAL SCORE",
    formatScore: (s) => s.toLocaleString(),
    sortDirection: "desc",
  },

  settingsSchema: [],
  defaultSettings: {},

  // ── State Creation ──────────────────────────────────────────────────

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    _settings: Record<string, unknown>,
  ): Record<string, unknown> {
    // Use a deterministic seed from the player uid for reproducibility
    const uid = players[0]?.uid ?? "default";
    let seed = 0;
    for (let i = 0; i < uid.length; i++) {
      seed = (seed * 31 + uid.charCodeAt(i)) & 0xffffffff;
    }
    // Mix in a timestamp component so each new game is different
    seed = (seed ^ (Date.now() & 0xffffffff)) & 0xffffffff;

    const state = dealInitialKlondikeState(seed);
    return state as unknown as Record<string, unknown>;
  },

  // ── Move Validation ─────────────────────────────────────────────────

  validateMove(
    publicState: Record<string, unknown>,
    _privateStateByPlayer: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult {
    const state = cloneState(publicState as unknown as SolitaireState);
    const move = movePayload as unknown as SolitaireMove;

    if (state.completed) {
      return { ok: false, error: "Game is already completed." };
    }

    let result: MoveValidationResult;

    switch (move.type) {
      case "deal_stock":
        result = applyDealStock(state);
        break;
      case "recycle_stock":
        result = applyRecycleStock(state);
        break;
      case "move_waste_to_foundation":
        result = applyWasteToFoundation(state);
        break;
      case "move_waste_to_tableau":
        result = applyWasteToTableau(state, move.destCol ?? -1);
        break;
      case "move_tableau_to_foundation":
        result = applyTableauToFoundation(state, move.sourceCol ?? -1);
        break;
      case "move_tableau_to_tableau":
        result = applyTableauToTableau(
          state,
          move.sourceCol ?? -1,
          move.destCol ?? -1,
          move.startIndex ?? 0,
          move.count ?? 0,
        );
        break;
      case "move_foundation_to_tableau":
        result = applyFoundationToTableau(
          state,
          move.sourceSuit ?? "spades",
          move.destCol ?? -1,
        );
        break;
      case "undo":
        result = applyUndo(state);
        break;
      case "auto_complete_step":
        result = applyAutoCompleteStep(state);
        break;
      default:
        return {
          ok: false,
          error: `Unknown move type: ${(move as { type: string }).type}`,
        };
    }

    if (!result.ok) {
      return result;
    }

    // Update auto-complete eligibility
    state.canAutoComplete = computeAutoCompleteEligibility(state);

    // Check win condition
    const fc = totalFoundationCards(state.foundations);
    if (fc === 52) {
      state.completed = true;
      state.score += 700; // Completion bonus
      state.lastMoveSummary = "Game Complete! 🎉";

      return {
        ok: true,
        nextPublicState: state as unknown as Record<string, unknown>,
        scoreDelta: [{ uid: ctx.uid, delta: state.score }],
        turnAdvance: false,
        terminal: {
          type: "win",
          winnerIds: [ctx.uid],
          reason: "All cards moved to foundations!",
        },
      };
    }

    // Check stuck state (only for non-undo moves)
    if (move.type !== "undo" && isTerminalStuckState(state)) {
      return {
        ok: true,
        nextPublicState: state as unknown as Record<string, unknown>,
        scoreDelta: [{ uid: ctx.uid, delta: state.score }],
        turnAdvance: false,
        terminal: {
          type: "timeout",
          winnerIds: [],
          reason: "No more legal moves available",
        },
      };
    }

    // Game continues
    return {
      ok: true,
      nextPublicState: state as unknown as Record<string, unknown>,
      scoreDelta: [{ uid: ctx.uid, delta: 0 }],
      turnAdvance: false,
    };
  },

  // ── Summary ─────────────────────────────────────────────────────────

  computeSummary(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; displayName: string }>,
    _currentTurnPlayerId: string | null,
  ) {
    const state = publicState as unknown as SolitaireState;
    const fc = totalFoundationCards(state.foundations);
    return {
      turnPlayerId: players[0]?.uid ?? null,
      scoreSummary: [
        {
          uid: players[0]?.uid ?? "",
          displayName: players[0]?.displayName ?? "Player",
          score: state.score,
        },
      ],
    };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = publicState as unknown as SolitaireState;
    const uid = players[0]?.uid ?? "";
    const fc = totalFoundationCards(state.foundations);

    return {
      winnerIds: state.completed ? [uid] : [],
      finalScoreboard: [
        {
          uid,
          score: state.score,
          placement: 1,
          stats: {
            completed: state.completed,
            foundationCount: fc,
            moveCount: state.moveCount,
            recycleCount: state.recycleCount,
          },
        },
      ],
    };
  },

  // ── Performance Metrics ─────────────────────────────────────────────

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    _players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as SolitaireState;
    return extractMetrics(state);
  },
};

// Auto-register on import
registerAdapter(solitaireKlondikeAdapter);

export default solitaireKlondikeAdapter;
