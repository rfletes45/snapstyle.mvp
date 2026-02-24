/**
 * CrazyCardsEngine — Pure game logic for Crazy Cards (UNO-inspired)
 *
 * This engine handles:
 * - Deck creation (108 cards), shuffling, dealing
 * - Move validation (color/type match, wild rules, WD4 legality)
 * - Hand scoring (for end-of-round)
 * - Playable card detection
 *
 * Used by both:
 * - Client-side for local/pass-and-play mode
 * - Imported by the screen for card validation helpers
 *
 * The Colyseus server has its own authoritative copy of this logic
 * in colyseus-server/src/schemas/crazyCards.ts
 *
 * gameId remains "crazy_eights" for routing stability.
 */

import type {
  CrazyCard,
  CrazyCardColor,
  CrazyCardType,
} from "@/types/turnBased";

// =============================================================================
// Deck Factory — 108 cards
// =============================================================================

/**
 * Create a full 108-card Crazy Cards deck.
 *
 * - 1× 0 per color (4)
 * - 2× 1–9 per color (72)
 * - 2× Skip per color (8)
 * - 2× Reverse per color (8)
 * - 2× Draw Two per color (8)
 * - 4× Wild (4)
 * - 4× Wild Draw Four (4)
 */
export function createCrazyCardsDeck(): CrazyCard[] {
  const colors: CrazyCardColor[] = ["red", "yellow", "green", "blue"];
  const deck: CrazyCard[] = [];
  let idCounter = 0;

  for (const color of colors) {
    // 1× zero
    deck.push({
      id: `${color}_0_${idCounter++}`,
      color,
      type: "number",
      value: 0,
    });

    // 2× each of 1–9
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

    // 2× Skip
    for (let copy = 0; copy < 2; copy++) {
      deck.push({
        id: `${color}_skip_${idCounter++}`,
        color,
        type: "skip",
        value: null,
      });
    }

    // 2× Reverse
    for (let copy = 0; copy < 2; copy++) {
      deck.push({
        id: `${color}_reverse_${idCounter++}`,
        color,
        type: "reverse",
        value: null,
      });
    }

    // 2× Draw Two
    for (let copy = 0; copy < 2; copy++) {
      deck.push({
        id: `${color}_draw_two_${idCounter++}`,
        color,
        type: "draw_two",
        value: null,
      });
    }
  }

  // 4× Wild
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `wild_${idCounter++}`,
      color: "wild",
      type: "wild",
      value: null,
    });
  }

  // 4× Wild Draw Four
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

export function shuffleDeck(cards: CrazyCard[]): CrazyCard[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Check if a card can be legally played on the current discard.
 *
 * Rules:
 * - Wild is always playable
 * - Wild Draw Four only if player has NO cards matching currentColor
 * - Match by color OR by type+value (same number, or same action type)
 */
export function canPlayCard(
  card: CrazyCard,
  topCard: CrazyCard,
  currentColor: CrazyCardColor,
  hand: CrazyCard[],
): boolean {
  if (card.type === "wild") return true;

  if (card.type === "wild_draw_four") {
    const hasMatchingColor = hand.some(
      (c) => c.id !== card.id && c.color === currentColor,
    );
    return !hasMatchingColor;
  }

  // Color match
  if (card.color === currentColor) return true;

  // Number match
  if (card.type === "number" && topCard.type === "number") {
    return card.value === topCard.value;
  }

  // Action type match (skip on skip, reverse on reverse, draw_two on draw_two)
  if (card.type !== "number" && card.type === topCard.type) {
    return true;
  }

  return false;
}

/**
 * Get all playable cards in a hand.
 */
export function getPlayableCards(
  hand: CrazyCard[],
  topCard: CrazyCard,
  currentColor: CrazyCardColor,
): CrazyCard[] {
  return hand.filter((card) => canPlayCard(card, topCard, currentColor, hand));
}

/**
 * Check if a player has any playable card.
 */
export function hasPlayableCard(
  hand: CrazyCard[],
  topCard: CrazyCard,
  currentColor: CrazyCardColor,
): boolean {
  return hand.some((card) => canPlayCard(card, topCard, currentColor, hand));
}

// =============================================================================
// Scoring
// =============================================================================

/** Point values for each card type */
const POINT_MAP: Record<CrazyCardType, number> = {
  number: -1, // use face value
  skip: 20,
  reverse: 20,
  draw_two: 20,
  wild: 50,
  wild_draw_four: 50,
};

/**
 * Calculate the total point value of a hand.
 * Numbers = face value, Skip/Reverse/Draw Two = 20, Wild/WD4 = 50.
 */
export function calculateHandScore(hand: CrazyCard[]): number {
  let score = 0;
  for (const card of hand) {
    if (card.type === "number" && card.value !== null) {
      score += card.value;
    } else {
      score += POINT_MAP[card.type];
    }
  }
  return score;
}

// =============================================================================
// Display Helpers
// =============================================================================

/** Get a human-readable label for a card color */
export function getColorLabel(color: CrazyCardColor): string {
  switch (color) {
    case "red":
      return "Red";
    case "yellow":
      return "Yellow";
    case "green":
      return "Green";
    case "blue":
      return "Blue";
    case "wild":
      return "Wild";
  }
}

/** Get the display symbol for an action card */
export function getActionSymbol(type: CrazyCardType): string {
  switch (type) {
    case "skip":
      return "⊘";
    case "reverse":
      return "⇄";
    case "draw_two":
      return "+2";
    case "wild":
      return "★";
    case "wild_draw_four":
      return "+4";
    default:
      return "";
  }
}

/** Get the display text for a card (number or action symbol) */
export function getCardDisplayText(card: CrazyCard): string {
  if (card.type === "number" && card.value !== null) {
    return String(card.value);
  }
  return getActionSymbol(card.type);
}

// =============================================================================
// Sort Helpers
// =============================================================================

const COLOR_ORDER: Record<CrazyCardColor, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  blue: 3,
  wild: 4,
};

const TYPE_ORDER: Record<CrazyCardType, number> = {
  number: 0,
  skip: 1,
  reverse: 2,
  draw_two: 3,
  wild: 4,
  wild_draw_four: 5,
};

/**
 * Sort a hand by color then by type/value.
 * Returns a new sorted array (does not mutate).
 */
export function sortHand(hand: CrazyCard[]): CrazyCard[] {
  return [...hand].sort((a, b) => {
    // Sort by color first
    const colorDiff = COLOR_ORDER[a.color] - COLOR_ORDER[b.color];
    if (colorDiff !== 0) return colorDiff;

    // Then by type
    const typeDiff = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    if (typeDiff !== 0) return typeDiff;

    // Then by value (numbers)
    if (a.value !== null && b.value !== null) {
      return a.value - b.value;
    }

    return 0;
  });
}

// =============================================================================
// Parse top card from Colyseus sync
// =============================================================================

/**
 * Parse a CrazyCard from the Colyseus SyncCard format.
 * SyncCard uses suit = "color|type|value" and rank = card.id
 */
export function parseSyncCard(suit: string, rank: string): CrazyCard | null {
  if (!suit || typeof suit !== "string") return null;
  const parts = suit.split("|");
  if (parts.length < 2) return null;

  const [color, type, valueStr] = parts;
  return {
    id: rank,
    color: color as CrazyCardColor,
    type: type as CrazyCardType,
    value: valueStr !== "" && valueStr !== undefined ? Number(valueStr) : null,
  };
}
