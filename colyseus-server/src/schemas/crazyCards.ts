/**
 * Crazy Cards Schemas — UNO-inspired card game types & deck factory
 *
 * This defines the 108-card deck, card types, colors, and scoring
 * used by CrazyCardsRoom. NOT synced via Colyseus state — these are
 * server-only types passed through targeted messages to clients.
 *
 * Color palette & naming is ORIGINAL (not UNO-branded):
 *   red (#FF4D5A), yellow (#FFD24A), green (#3DE57A), blue (#4D8CFF)
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §6.4
 */

// =============================================================================
// Card Colors & Types
// =============================================================================

export type CrazyCardColor = "red" | "yellow" | "green" | "blue" | "wild";

export type CrazyCardType =
  | "number"
  | "skip"
  | "reverse"
  | "draw_two"
  | "wild"
  | "wild_draw_four";

// =============================================================================
// Server Card — used server-side (hands, deck, discard pile)
// =============================================================================

export interface CrazyCard {
  /** Unique card ID for lookup (e.g. "red_7_1", "wild_0") */
  id: string;
  /** Card color — "wild" for Wild and Wild Draw Four */
  color: CrazyCardColor;
  /** Card type */
  type: CrazyCardType;
  /** Numeric value 0–9 for number cards, null for action/wild */
  value: number | null;
}

// =============================================================================
// Constants
// =============================================================================

export const CRAZY_CARDS_INITIAL_HAND_SIZE = 7;
export const CRAZY_CARDS_MIN_PLAYERS = 1;
export const CRAZY_CARDS_MAX_PLAYERS = 5;

/** Point values for end-of-round scoring */
export const CARD_POINT_VALUES: Record<CrazyCardType, number> = {
  number: -1, // use face value instead
  skip: 20,
  reverse: 20,
  draw_two: 20,
  wild: 50,
  wild_draw_four: 50,
};

// =============================================================================
// Deck Factory — 108 cards
// =============================================================================

/**
 * Creates a standard 108-card Crazy Cards deck:
 * - 1× number 0 per color (4 total)
 * - 2× numbers 1–9 per color (72 total)
 * - 2× Skip per color (8 total)
 * - 2× Reverse per color (8 total)
 * - 2× Draw Two per color (8 total)
 * - 4× Wild (4 total)
 * - 4× Wild Draw Four (4 total)
 */
export function createCrazyCardsDeck(): CrazyCard[] {
  const colors: CrazyCardColor[] = ["red", "yellow", "green", "blue"];
  const deck: CrazyCard[] = [];
  let idCounter = 0;

  for (const color of colors) {
    // One 0 per color
    deck.push({
      id: `${color}_0_${idCounter++}`,
      color,
      type: "number",
      value: 0,
    });

    // Two each of 1–9
    for (let n = 1; n <= 9; n++) {
      for (let copy = 0; copy < 2; copy++) {
        deck.push({
          id: `${color}_${n}_${idCounter++}`,
          color,
          type: "number",
          value: n,
        });
      }
    }

    // Two Skip per color
    for (let copy = 0; copy < 2; copy++) {
      deck.push({
        id: `${color}_skip_${idCounter++}`,
        color,
        type: "skip",
        value: null,
      });
    }

    // Two Reverse per color
    for (let copy = 0; copy < 2; copy++) {
      deck.push({
        id: `${color}_reverse_${idCounter++}`,
        color,
        type: "reverse",
        value: null,
      });
    }

    // Two Draw Two per color
    for (let copy = 0; copy < 2; copy++) {
      deck.push({
        id: `${color}_draw_two_${idCounter++}`,
        color,
        type: "draw_two",
        value: null,
      });
    }
  }

  // 4 Wilds
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `wild_${idCounter++}`,
      color: "wild",
      type: "wild",
      value: null,
    });
  }

  // 4 Wild Draw Fours
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `wild_draw_four_${idCounter++}`,
      color: "wild",
      type: "wild_draw_four",
      value: null,
    });
  }

  return deck;
}

// =============================================================================
// Shuffle
// =============================================================================

export function shuffleCrazyCards(cards: CrazyCard[]): CrazyCard[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// =============================================================================
// Scoring
// =============================================================================

/**
 * Calculate the point value of a hand (for end-of-round scoring).
 * Numbers = face value, Skip/Reverse/Draw Two = 20, Wild/WD4 = 50.
 */
export function calculateCrazyCardsHandScore(hand: CrazyCard[]): number {
  let score = 0;
  for (const card of hand) {
    if (card.type === "number" && card.value !== null) {
      score += card.value;
    } else {
      score += CARD_POINT_VALUES[card.type];
    }
  }
  return score;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if a card can be played on the current discard pile.
 *
 * @param card      The card the player wants to play
 * @param topCard   The top card of the discard pile
 * @param currentColor The active color (may differ from topCard if wild was played)
 * @param hand      The player's full hand (needed for Wild Draw Four validation)
 * @returns true if the card can be legally played
 */
export function canPlayCrazyCard(
  card: CrazyCard,
  topCard: CrazyCard,
  currentColor: CrazyCardColor,
  hand: CrazyCard[],
): boolean {
  // Wild is always playable
  if (card.type === "wild") return true;

  // Wild Draw Four: only playable if player has NO cards matching current color
  if (card.type === "wild_draw_four") {
    const hasMatchingColor = hand.some(
      (c) => c.id !== card.id && c.color === currentColor,
    );
    return !hasMatchingColor;
  }

  // Match by color
  if (card.color === currentColor) return true;

  // Match by type+value (same number or same action type)
  if (card.type === "number" && topCard.type === "number") {
    return card.value === topCard.value;
  }
  if (card.type !== "number" && card.type === topCard.type) {
    return true;
  }

  return false;
}

/**
 * Check if a player has any playable card.
 */
export function hasPlayableCrazyCard(
  hand: CrazyCard[],
  topCard: CrazyCard,
  currentColor: CrazyCardColor,
): boolean {
  return hand.some((card) =>
    canPlayCrazyCard(card, topCard, currentColor, hand),
  );
}
