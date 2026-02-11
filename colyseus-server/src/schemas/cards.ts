/**
 * Card Game Schemas — State definitions for card-based Colyseus games
 *
 * Card games have hidden information (hands, deck) that must NOT be
 * broadcast to all players via Colyseus state sync. Instead:
 *   - The shared state (discard pile, hand sizes, current suit) is synced
 *   - Private data (actual hand cards, deck) is sent via targeted messages
 *
 * Used by: CrazyEightsRoom, WarRoom (Phase 3)
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §6.4
 */

import { MapSchema, Schema, type } from "@colyseus/schema";
import { BaseGameState, Player } from "./common";

// =============================================================================
// Card — A single playing card (synced only for visible cards)
// =============================================================================

export class SyncCard extends Schema {
  /** Suit: hearts, diamonds, clubs, spades */
  @type("string") suit: string = "";

  /** Rank: A, 2-10, J, Q, K */
  @type("string") rank: string = "";

  /** Whether the card is face up (visible to all) */
  @type("boolean") faceUp: boolean = false;
}

// =============================================================================
// CardPlayer — Player with card-game-specific fields
// =============================================================================

export class CardPlayer extends Player {
  /** Number of cards in hand (visible to all, actual cards are private) */
  @type("uint8") handSize: number = 0;

  /** Whether this player has drawn this turn */
  @type("boolean") hasDrawnThisTurn: boolean = false;

  /** Whether this player has passed this turn */
  @type("boolean") hasPassed: boolean = false;
}

// =============================================================================
// CardGameState — Root state for card game rooms
// =============================================================================

export class CardGameState extends BaseGameState {
  /** Players with card-game extensions */
  @type({ map: CardPlayer })
  cardPlayers = new MapSchema<CardPlayer>();

  /** Top card of the discard pile (visible to all) */
  @type(SyncCard) topCard = new SyncCard();

  /** Number of cards in the discard pile */
  @type("uint16") discardSize: number = 0;

  /** Number of cards remaining in draw pile */
  @type("uint16") deckSize: number = 0;

  /** Current suit (may differ from top card if an 8 was played) */
  @type("string") currentSuit: string = "";

  /** How many cards drawn this turn */
  @type("uint8") drawCount: number = 0;

  /** Countdown seconds remaining (3, 2, 1, GO) */
  @type("uint8") countdown: number = 0;

  // ─── War-specific synced fields ─────────────────────────────────────

  /** Player 1's revealed card (for War) */
  @type(SyncCard) player1Card = new SyncCard();

  /** Player 2's revealed card (for War) */
  @type(SyncCard) player2Card = new SyncCard();

  /** Whether we're in a "war" tie-breaker */
  @type("boolean") isWar: boolean = false;

  /** Number of cards in the war pile */
  @type("uint8") warPileSize: number = 0;

  /** Player 1 deck size (War-specific, visible) */
  @type("uint8") p1DeckSize: number = 26;

  /** Player 2 deck size (War-specific, visible) */
  @type("uint8") p2DeckSize: number = 26;

  /** War round result message */
  @type("string") roundResult: string = "";
}

// =============================================================================
// Non-synced types — server-only (used in room logic, NOT in schema)
// =============================================================================

export interface ServerCard {
  suit: string;
  rank: string;
  id: string;
}

export function createStandardDeck(): ServerCard[] {
  const suits = ["hearts", "diamonds", "clubs", "spades"];
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
  const deck: ServerCard[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank, id: `${rank}-${suit}` });
    }
  }
  return deck;
}

export function shuffleDeck<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get numeric value of a card rank for comparison (War game).
 * A=14, K=13, Q=12, J=11, 10-2 = face value.
 */
export function cardRankValue(rank: string): number {
  switch (rank) {
    case "A":
      return 14;
    case "K":
      return 13;
    case "Q":
      return 12;
    case "J":
      return 11;
    default:
      return parseInt(rank, 10);
  }
}
