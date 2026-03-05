/**
 * Games V4 — Crazy 8's Engine
 *
 * Pure-function game engine for Crazy 8's (UNO-style card game).
 * All functions are deterministic and side-effect-free.
 *
 * Responsibilities:
 * - Deck creation, shuffle, dealing
 * - Card playability checks
 * - Move validation + state transitions
 * - Scoring, reshuffle, CRAZY! window logic
 *
 * @module gamesV4/adapters/crazyEights/crazyEightsEngine
 */

import type {
  Card,
  CardColor,
  CardType,
  CrazyEightsPrivateState,
  CrazyEightsPublicState,
  CrazyEightsSettings,
} from "./crazyEightsTypes";
import { ALL_COLORS, getCardPoints } from "./crazyEightsTypes";

// =============================================================================
// Deck Creation
// =============================================================================

/**
 * Create a standard 108-card deck.
 * - 4 colors × (one 0 + two 1–9 + two Skip + two Reverse + two Draw Two)
 * - 4 Wild + 4 Wild Draw Four
 */
export function createDeck(): Card[] {
  const cards: Card[] = [];
  let deckIndex = 0;

  for (const color of ALL_COLORS) {
    // One 0 per color
    cards.push({
      id: `${color}_0_0`,
      color,
      type: "number",
      value: 0,
    });
    deckIndex++;

    // Two of each 1–9
    for (let v = 1; v <= 9; v++) {
      for (let copy = 0; copy < 2; copy++) {
        cards.push({
          id: `${color}_${v}_${copy}`,
          color,
          type: "number",
          value: v,
        });
        deckIndex++;
      }
    }

    // Two of each action card per color
    const actionTypes: CardType[] = ["skip", "reverse", "draw_two"];
    for (const aType of actionTypes) {
      for (let copy = 0; copy < 2; copy++) {
        cards.push({
          id: `${color}_${aType}_${copy}`,
          color,
          type: aType,
          value: null,
        });
        deckIndex++;
      }
    }
  }

  // Wild cards (4)
  for (let i = 0; i < 4; i++) {
    cards.push({
      id: `wild_${i}`,
      color: null,
      type: "wild",
      value: null,
    });
  }

  // Wild Draw Four (4)
  for (let i = 0; i < 4; i++) {
    cards.push({
      id: `wild_draw_four_${i}`,
      color: null,
      type: "wild_draw_four",
      value: null,
    });
  }

  return cards;
}

// =============================================================================
// Shuffle (Fisher-Yates)
// =============================================================================

export function shuffleDeck(cards: Card[], seed?: number): Card[] {
  const arr = [...cards];
  // Simple seeded PRNG for determinism in tests
  let rng: () => number;
  if (seed !== undefined) {
    let s = seed;
    rng = () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  } else {
    rng = Math.random;
  }

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =============================================================================
// Card Lookup Builder
// =============================================================================

export function buildCardLookup(cards: Card[]): Record<string, Card> {
  const lookup: Record<string, Card> = {};
  for (const card of cards) {
    lookup[card.id] = card;
  }
  return lookup;
}

// =============================================================================
// Dealing
// =============================================================================

const HAND_SIZE = 7;

export interface DealResult {
  hands: Record<string, Card[]>;
  drawPile: Card[];
  topDiscard: Card;
  discardPile: Card[];
}

/**
 * Deal initial hands and set up draw/discard piles.
 * Ensures the first discard is a playable non-wild card.
 */
export function dealCards(deck: Card[], playerUids: string[]): DealResult {
  const remaining = [...deck];
  const hands: Record<string, Card[]> = {};

  for (const uid of playerUids) {
    hands[uid] = remaining.splice(0, HAND_SIZE);
  }

  // Find first valid starting card (non-wild, non-action preferred)
  let topDiscardIndex = remaining.findIndex((c) => c.type === "number");
  if (topDiscardIndex === -1) {
    // Fallback: use first non-wild
    topDiscardIndex = remaining.findIndex(
      (c) => c.type !== "wild" && c.type !== "wild_draw_four",
    );
  }
  if (topDiscardIndex === -1) topDiscardIndex = 0;

  const topDiscard = remaining.splice(topDiscardIndex, 1)[0];

  return {
    hands,
    drawPile: remaining,
    topDiscard,
    discardPile: [topDiscard],
  };
}

// =============================================================================
// Card Playability
// =============================================================================

/**
 * Check if a card can be played on the current discard/color.
 */
export function isCardPlayable(
  card: Card,
  currentColor: CardColor,
  topDiscard: Card,
  _settings: CrazyEightsSettings,
): boolean {
  // Wilds are always playable
  if (card.type === "wild" || card.type === "wild_draw_four") return true;

  // Match color
  if (card.color === currentColor) return true;

  // Match value/type
  if (card.type === "number" && topDiscard.type === "number") {
    if (card.value === topDiscard.value) return true;
  }

  // Match action type
  if (card.type !== "number" && card.type === topDiscard.type) return true;

  return false;
}

/**
 * Check if any card in a hand is playable.
 */
export function hasPlayableCard(
  hand: Card[],
  currentColor: CardColor,
  topDiscard: Card,
  settings: CrazyEightsSettings,
): boolean {
  return hand.some((c) =>
    isCardPlayable(c, currentColor, topDiscard, settings),
  );
}

// =============================================================================
// Playable Card Computation (shared between client UI and tests)
// =============================================================================

export interface PlayableResult {
  /** Set of card IDs that are playable. */
  playableIds: Set<string>;
  /** Reason string per card ID (for debugging / logging). */
  reasonById: Record<string, string>;
}

/**
 * Compute which cards in a hand are playable given the current game state.
 *
 * Rules applied:
 *  1. If pendingDraw > 0: only stackable cards are playable (draw_two on D2,
 *     wild_draw_four on D4, cross-stacking if settings allow).
 *  2. Otherwise: standard playability — match color, match value/type, or wild.
 *
 * @returns { playableIds: Set<string>, reasonById: Record<string, string> }
 */
export function computePlayableCards(
  hand: Card[],
  currentColor: CardColor,
  topDiscard: Card,
  settings: CrazyEightsSettings,
  pendingDraw: { count: number; source: string | null },
): PlayableResult {
  const playableIds = new Set<string>();
  const reasonById: Record<string, string> = {};

  for (const card of hand) {
    if (pendingDraw.count > 0) {
      // Stacking mode: only stackable cards count as playable
      const canStack = checkCanStackPure(card, pendingDraw, settings);
      if (canStack) {
        playableIds.add(card.id);
        reasonById[card.id] = "stackable";
      } else {
        reasonById[card.id] = `pending_draw:${pendingDraw.count}`;
      }
    } else {
      if (isCardPlayable(card, currentColor, topDiscard, settings)) {
        playableIds.add(card.id);
        reasonById[card.id] = "playable";
      } else {
        // Build a short reason
        const colorMatch = card.color === currentColor;
        const typeMatch =
          card.type !== "number" && card.type === topDiscard.type;
        const valueMatch =
          card.type === "number" &&
          topDiscard.type === "number" &&
          card.value === topDiscard.value;
        reasonById[card.id] =
          `no_match(color=${colorMatch},type=${typeMatch},value=${valueMatch})`;
      }
    }
  }

  return { playableIds, reasonById };
}

/**
 * Pure version of checkCanStack that doesn't require the full CrazyEightsPublicState.
 */
function checkCanStackPure(
  card: Card,
  pendingDraw: { count: number; source: string | null },
  settings: CrazyEightsSettings,
): boolean {
  if (pendingDraw.source === "D2") {
    if (card.type === "draw_two" && settings.stackDraw2) return true;
    if (
      card.type === "wild_draw_four" &&
      settings.stackingMode === "draws_mix" &&
      settings.stackDraw4
    )
      return true;
  }
  if (pendingDraw.source === "D4") {
    if (card.type === "wild_draw_four" && settings.stackDraw4) return true;
    if (
      card.type === "draw_two" &&
      settings.stackingMode === "draws_mix" &&
      settings.stackDraw2
    )
      return true;
  }
  return false;
}

/**
 * Check if a player could have played a non-wild card of a different color.
 * Used for Wild Draw Four challenge resolution.
 */
export function couldPlayOtherColor(
  hand: Card[],
  currentColor: CardColor,
  topDiscard: Card,
): boolean {
  return hand.some(
    (c) =>
      c.type !== "wild" &&
      c.type !== "wild_draw_four" &&
      (c.color === currentColor ||
        (c.type === "number" &&
          topDiscard.type === "number" &&
          c.value === topDiscard.value) ||
        (c.type !== "number" && c.type === topDiscard.type)),
  );
}

// =============================================================================
// Reshuffle
// =============================================================================

/**
 * Reshuffle the discard pile (minus top card) back into the draw pile.
 */
export function reshuffleDiscard(
  drawPile: string[],
  discardPile: string[],
  cardLookup: Record<string, Card>,
): { newDrawPile: string[]; newDiscardPile: string[] } {
  if (discardPile.length <= 1) {
    return { newDrawPile: drawPile, newDiscardPile: discardPile };
  }

  // Keep the top card, shuffle the rest back
  const topId = discardPile[discardPile.length - 1];
  const reshuffled = [...discardPile.slice(0, -1)];

  // Shuffle
  for (let i = reshuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [reshuffled[i], reshuffled[j]] = [reshuffled[j], reshuffled[i]];
  }

  return {
    newDrawPile: [...drawPile, ...reshuffled],
    newDiscardPile: [topId],
  };
}

// =============================================================================
// Turn Management
// =============================================================================

/**
 * Get the next turn index based on direction.
 */
export function getNextTurnIndex(
  currentIndex: number,
  direction: 1 | -1,
  playerCount: number,
  skip: number = 1,
): number {
  return (
    (((currentIndex + direction * skip) % playerCount) + playerCount) %
    playerCount
  );
}

/**
 * Apply the Seven-Zero rule swap logic.
 * - Playing a 7: swap hands with a chosen opponent
 * - Playing a 0: rotate all hands in play direction
 */
export function applySevenZeroSwap(
  privateStateByPlayer: Record<string, CrazyEightsPrivateState>,
  turnOrder: string[],
  direction: 1 | -1,
  playedCard: Card,
  swapTargetUid?: string,
  actorUid?: string,
): Record<string, CrazyEightsPrivateState> {
  const newState = { ...privateStateByPlayer };

  if (
    playedCard.type === "number" &&
    playedCard.value === 7 &&
    swapTargetUid &&
    actorUid
  ) {
    // Swap hands between actor and target
    const actorHand = [...(newState[actorUid]?.hand ?? [])];
    const targetHand = [...(newState[swapTargetUid]?.hand ?? [])];
    newState[actorUid] = { ...newState[actorUid], hand: targetHand };
    newState[swapTargetUid] = { ...newState[swapTargetUid], hand: actorHand };
  } else if (playedCard.type === "number" && playedCard.value === 0) {
    // Rotate all hands in play direction
    const count = turnOrder.length;
    const handsCopy: Record<string, Card[]> = {};
    for (const uid of turnOrder) {
      handsCopy[uid] = [...(newState[uid]?.hand ?? [])];
    }

    for (let i = 0; i < count; i++) {
      const fromIdx = (((i - direction) % count) + count) % count;
      const toUid = turnOrder[i];
      const fromUid = turnOrder[fromIdx];
      newState[toUid] = {
        ...newState[toUid],
        hand: handsCopy[fromUid],
      };
    }
  }

  return newState;
}

// =============================================================================
// Draw Cards
// =============================================================================

/**
 * Draw N cards from the draw pile. Reshuffles if needed.
 * Returns the drawn cards and updated piles.
 */
export function drawCards(
  count: number,
  drawPile: string[],
  discardPile: string[],
  cardLookup: Record<string, Card>,
): {
  drawnCards: Card[];
  newDrawPile: string[];
  newDiscardPile: string[];
} {
  let currentDraw = [...drawPile];
  let currentDiscard = [...discardPile];
  const drawnCards: Card[] = [];

  for (let i = 0; i < count; i++) {
    if (currentDraw.length === 0) {
      const result = reshuffleDiscard(currentDraw, currentDiscard, cardLookup);
      currentDraw = result.newDrawPile;
      currentDiscard = result.newDiscardPile;

      if (currentDraw.length === 0) break; // No more cards available
    }

    const cardId = currentDraw.pop()!;
    const card = cardLookup[cardId];
    if (card) drawnCards.push(card);
  }

  return {
    drawnCards,
    newDrawPile: currentDraw,
    newDiscardPile: currentDiscard,
  };
}

// =============================================================================
// Score Calculation
// =============================================================================

/**
 * Calculate points remaining in a player's hand.
 */
export function calculateHandPoints(hand: Card[]): number {
  return hand.reduce((sum, card) => sum + getCardPoints(card), 0);
}

/**
 * Calculate round scores: winner gets points from all opponents' hands.
 */
export function calculateRoundScores(
  winnerUid: string,
  privateStateByPlayer: Record<string, CrazyEightsPrivateState>,
  turnOrder: string[],
): Record<string, number> {
  const scores: Record<string, number> = {};
  let totalOpponentPoints = 0;

  for (const uid of turnOrder) {
    const hand = privateStateByPlayer[uid]?.hand ?? [];
    const points = calculateHandPoints(hand);
    scores[uid] = -points; // Negative for losers
    if (uid !== winnerUid) {
      totalOpponentPoints += points;
    }
  }

  scores[winnerUid] = totalOpponentPoints; // Winner scores positively
  return scores;
}

// =============================================================================
// Initial State Creation
// =============================================================================

export function createInitialCrazyEightsState(
  players: Array<{ uid: string; slotIndex: number }>,
  settings: CrazyEightsSettings,
): {
  publicState: CrazyEightsPublicState;
  privateState: Record<string, CrazyEightsPrivateState>;
} {
  const turnOrder = players
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((p) => p.uid);

  const deck = shuffleDeck(createDeck());
  const cardLookup = buildCardLookup(deck);
  const { hands, drawPile, topDiscard, discardPile } = dealCards(
    deck,
    turnOrder,
  );

  const handCounts: Record<string, number> = {};
  const scores: Record<string, number> = {};
  const calledCrazy: Record<string, boolean> = {};

  for (const uid of turnOrder) {
    handCounts[uid] = hands[uid].length;
    scores[uid] = 0;
    calledCrazy[uid] = false;
  }

  const publicState: CrazyEightsPublicState = {
    phase: "playing",
    turnOrder,
    currentTurnIndex: 0,
    currentTurnUid: turnOrder[0],
    direction: 1,
    topDiscard,
    currentColor: topDiscard.color!,
    drawPileCount: drawPile.length,
    discardCount: discardPile.length,
    handCounts,
    pendingDraw: { count: 0, source: null },
    callEligibleUid: null,
    calledCrazy,
    turnCounter: 0,
    moveCount: 0,
    lastMove: null,
    challengeWindow: null,
    scores,
    roundNumber: 1,
    settings,
    resolved: null,
    drawPile: drawPile.map((c) => c.id),
    discardPile: discardPile.map((c) => c.id),
    cardLookup,
  };

  const privateState: Record<string, CrazyEightsPrivateState> = {};
  for (const uid of turnOrder) {
    privateState[uid] = {
      hand: hands[uid],
      hasDrawnThisTurn: false,
    };
  }

  return { publicState, privateState };
}

// =============================================================================
// Spectator View
// =============================================================================

/**
 * Strip private/server-only data from public state for spectator view.
 */
export function createSpectatorView(
  state: CrazyEightsPublicState,
): Record<string, unknown> {
  const { drawPile: _drawPile, cardLookup: _cardLookup, ...safeState } = state;

  return {
    ...safeState,
    // Replace draw pile and card lookup with safe versions
    drawPileCount: state.drawPileCount,
  } as unknown as Record<string, unknown>;
}
