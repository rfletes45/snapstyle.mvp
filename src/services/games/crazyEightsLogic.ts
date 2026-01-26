/**
 * Crazy Eights Game Logic
 *
 * Complete Crazy Eights rules:
 * - Play cards matching rank or suit of top discard
 * - 8s are wild - can be played anytime, player declares next suit
 * - Draw from deck if no playable cards
 * - First to empty hand wins
 *
 * @see src/types/turnBased.ts for type definitions
 */

import {
  Card,
  CardRank,
  CardSuit,
  CrazyEightsGameState,
  CrazyEightsMove,
  createDeck,
  shuffleArray,
} from "@/types/turnBased";

// =============================================================================
// Constants
// =============================================================================

const INITIAL_HAND_SIZE = 7;

// =============================================================================
// Initial State
// =============================================================================

/**
 * Create initial Crazy Eights game state
 * Supports 2-7 players
 */
export function createInitialCrazyEightsState(...playerIds: string[]): {
  gameState: CrazyEightsGameState;
  hands: Record<string, Card[]>;
  deck: Card[];
} {
  if (playerIds.length < 2 || playerIds.length > 7) {
    throw new Error("Crazy Eights requires 2-7 players");
  }

  // Create and shuffle deck
  let deck = shuffleArray(createDeck());

  // For 5+ players, use two decks
  if (playerIds.length >= 5) {
    deck = shuffleArray([...deck, ...createDeck()]);
  }

  // Deal hands - 7 cards for 2 players, 5 cards for 3+ players
  const cardsPerPlayer = playerIds.length === 2 ? INITIAL_HAND_SIZE : 5;

  const hands: Record<string, Card[]> = {};
  for (const playerId of playerIds) {
    hands[playerId] = [];
  }

  // Deal cards round-robin style
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (const playerId of playerIds) {
      hands[playerId].push(deck.pop()!);
    }
  }

  // Draw first card for discard pile (redraw if it's an 8)
  let topCard = deck.pop()!;
  while (topCard.rank === "8") {
    // Put 8 back and reshuffle
    deck.unshift(topCard);
    deck = shuffleArray(deck);
    topCard = deck.pop()!;
  }

  const gameState: CrazyEightsGameState = {
    discardPile: [topCard],
    deckSize: deck.length,
    topCard,
    currentSuit: topCard.suit,
    currentTurn: playerIds[0],
    direction: 1,
    drawCount: 0,
    mustDraw: false,
    hasDrawnThisTurn: false,
    // Store player order for turn management
    playerOrder: playerIds,
  };

  return { gameState, hands, deck };
}

// =============================================================================
// Move Validation
// =============================================================================

export interface CrazyEightsValidationResult {
  valid: boolean;
  error?: string;
  newState?: CrazyEightsGameState;
  newHands?: Record<string, Card[]>;
  newDeck?: Card[];
  winner?: string;
}

/**
 * Validate a Crazy Eights move
 */
export function validateCrazyEightsMove(
  state: CrazyEightsGameState,
  hands: Record<string, Card[]>,
  deck: Card[],
  move: CrazyEightsMove,
  playerId: string,
): CrazyEightsValidationResult {
  // Check if it's player's turn
  if (state.currentTurn !== playerId) {
    return { valid: false, error: "Not your turn" };
  }

  switch (move.type) {
    case "play":
      return validatePlayCard(state, hands, deck, move, playerId);
    case "draw":
      return validateDrawCard(state, hands, deck, playerId);
    case "pass":
      return validatePass(state, hands, deck, playerId);
    default:
      return { valid: false, error: "Invalid move type" };
  }
}

/**
 * Validate playing a card
 */
function validatePlayCard(
  state: CrazyEightsGameState,
  hands: Record<string, Card[]>,
  deck: Card[],
  move: CrazyEightsMove,
  playerId: string,
): CrazyEightsValidationResult {
  if (!move.card) {
    return { valid: false, error: "No card specified" };
  }

  const playerHand = hands[playerId];
  const cardIndex = playerHand.findIndex(
    (c) => c.suit === move.card!.suit && c.rank === move.card!.rank,
  );

  if (cardIndex === -1) {
    return { valid: false, error: "Card not in hand" };
  }

  // Check if card can be played
  if (!canPlayCard(move.card, state)) {
    return { valid: false, error: "Card cannot be played on current pile" };
  }

  // If playing an 8, must declare suit
  if (move.card.rank === "8" && !move.declaredSuit) {
    return { valid: false, error: "Must declare suit when playing an 8" };
  }

  // Apply the move
  return applyPlayCard(state, hands, deck, move, playerId, cardIndex);
}

/**
 * Check if a card can be played
 */
export function canPlayCard(card: Card, state: CrazyEightsGameState): boolean {
  // 8s can always be played
  if (card.rank === "8") return true;

  // Must match current suit or rank of top card
  return card.suit === state.currentSuit || card.rank === state.topCard.rank;
}

/**
 * Apply playing a card and return new state
 */
function applyPlayCard(
  state: CrazyEightsGameState,
  hands: Record<string, Card[]>,
  deck: Card[],
  move: CrazyEightsMove,
  playerId: string,
  cardIndex: number,
): CrazyEightsValidationResult {
  const card = move.card!;
  const newHands = { ...hands };
  newHands[playerId] = [...hands[playerId]];
  newHands[playerId].splice(cardIndex, 1);

  // Check for winner
  if (newHands[playerId].length === 0) {
    return {
      valid: true,
      newState: {
        ...state,
        discardPile: [...state.discardPile, card],
        topCard: card,
        currentSuit: move.declaredSuit || card.suit,
        hasDrawnThisTurn: false, // Reset for next turn
      },
      newHands,
      newDeck: deck,
      winner: playerId,
    };
  }

  // Get next player - use playerOrder if available, otherwise fallback to hands keys
  const playerIds = state.playerOrder || Object.keys(hands);
  const currentIndex = playerIds.indexOf(playerId);
  const nextIndex =
    (currentIndex + state.direction + playerIds.length) % playerIds.length;
  const nextPlayer = playerIds[nextIndex];

  const newState: CrazyEightsGameState = {
    ...state,
    discardPile: [...state.discardPile, card],
    topCard: card,
    currentSuit: card.rank === "8" ? move.declaredSuit! : card.suit,
    currentTurn: nextPlayer,
    drawCount: 0,
    mustDraw: false,
    hasDrawnThisTurn: false, // Reset for next player's turn
  };

  return {
    valid: true,
    newState,
    newHands,
    newDeck: deck,
  };
}

/**
 * Validate drawing a card
 */
function validateDrawCard(
  state: CrazyEightsGameState,
  hands: Record<string, Card[]>,
  deck: Card[],
  playerId: string,
): CrazyEightsValidationResult {
  // CRITICAL: Check if player has already drawn this turn
  if (state.hasDrawnThisTurn) {
    return {
      valid: false,
      error: "You can only draw once per turn. Play a card or pass.",
    };
  }

  // Check if deck is empty
  if (deck.length === 0) {
    // Try to reshuffle discard pile
    if (state.discardPile.length <= 1) {
      return { valid: false, error: "No cards to draw - pass instead" };
    }
    // Will reshuffle in apply
  }

  // Check if player has playable cards (optional rule - can always choose to draw)
  // We allow drawing even with playable cards for strategy

  return applyDrawCard(state, hands, deck, playerId);
}

/**
 * Apply drawing a card
 */
function applyDrawCard(
  state: CrazyEightsGameState,
  hands: Record<string, Card[]>,
  deck: Card[],
  playerId: string,
): CrazyEightsValidationResult {
  let newDeck = [...deck];
  const discardPile = [...state.discardPile];

  // Reshuffle if needed
  if (newDeck.length === 0 && discardPile.length > 1) {
    const topCard = discardPile.pop()!;
    newDeck = shuffleArray(discardPile);
    discardPile.length = 0;
    discardPile.push(topCard);
  }

  if (newDeck.length === 0) {
    // No cards to draw, player must pass
    return { valid: false, error: "No cards to draw - must pass" };
  }

  // Draw a card
  const drawnCard = newDeck.pop()!;
  const newHands = { ...hands };
  newHands[playerId] = [...hands[playerId], drawnCard];

  const newState: CrazyEightsGameState = {
    ...state,
    discardPile,
    deckSize: newDeck.length,
    drawCount: state.drawCount + 1,
    hasDrawnThisTurn: true, // CRITICAL: Mark that player has drawn
    mustDraw: false,
  };

  // After drawing once, player must play a card or pass - no more draws allowed

  return {
    valid: true,
    newState,
    newHands,
    newDeck,
  };
}

/**
 * Validate passing
 */
function validatePass(
  state: CrazyEightsGameState,
  hands: Record<string, Card[]>,
  deck: Card[],
  playerId: string,
): CrazyEightsValidationResult {
  const playerHand = hands[playerId];

  // Can only pass if:
  // 1. Deck is empty, or
  // 2. Player has drawn at least once this turn
  if (deck.length > 0 && state.drawCount === 0) {
    return { valid: false, error: "Must draw first if deck has cards" };
  }

  // Check if player has any playable cards
  const hasPlayableCard = playerHand.some((card) => canPlayCard(card, state));
  if (hasPlayableCard && state.drawCount > 0) {
    // Player drew and still has playable cards - maybe still allow pass?
    // Some variants require playing if possible
  }

  return applyPass(state, hands, deck, playerId);
}

/**
 * Apply passing turn
 */
function applyPass(
  state: CrazyEightsGameState,
  hands: Record<string, Card[]>,
  deck: Card[],
  playerId: string,
): CrazyEightsValidationResult {
  // Use playerOrder if available, otherwise fallback to hands keys
  const playerIds = state.playerOrder || Object.keys(hands);
  const currentIndex = playerIds.indexOf(playerId);
  const nextIndex =
    (currentIndex + state.direction + playerIds.length) % playerIds.length;
  const nextPlayer = playerIds[nextIndex];

  const newState: CrazyEightsGameState = {
    ...state,
    currentTurn: nextPlayer,
    drawCount: 0,
    mustDraw: false,
    hasDrawnThisTurn: false, // Reset for next player's turn
  };

  return {
    valid: true,
    newState,
    newHands: hands,
    newDeck: deck,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get all playable cards in hand
 */
export function getPlayableCards(
  hand: Card[],
  state: CrazyEightsGameState,
): Card[] {
  return hand.filter((card) => canPlayCard(card, state));
}

/**
 * Check if player has any playable cards
 */
export function hasPlayableCard(
  hand: Card[],
  state: CrazyEightsGameState,
): boolean {
  return hand.some((card) => canPlayCard(card, state));
}

/**
 * Get card display string
 */
export function getCardDisplay(card: Card): string {
  const suitSymbols: Record<CardSuit, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };
  return `${card.rank}${suitSymbols[card.suit]}`;
}

/**
 * Get suit color
 */
export function getSuitColor(suit: CardSuit): string {
  return suit === "hearts" || suit === "diamonds" ? "#e74c3c" : "#2c3e50";
}

/**
 * Get suit symbol
 */
export function getSuitSymbol(suit: CardSuit): string {
  const symbols: Record<CardSuit, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };
  return symbols[suit];
}

/**
 * Sort cards by suit then rank
 */
export function sortHand(hand: Card[]): Card[] {
  const suitOrder: CardSuit[] = ["spades", "hearts", "diamonds", "clubs"];
  const rankOrder: CardRank[] = [
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

  return [...hand].sort((a, b) => {
    const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
  });
}

/**
 * Calculate score for remaining cards (for scoring variant)
 */
export function calculateHandScore(hand: Card[]): number {
  let score = 0;
  for (const card of hand) {
    if (card.rank === "8") {
      score += 50; // 8s are worth 50 points
    } else if (["J", "Q", "K"].includes(card.rank)) {
      score += 10; // Face cards worth 10
    } else if (card.rank === "A") {
      score += 1; // Aces worth 1
    } else {
      score += parseInt(card.rank, 10); // Number cards worth face value
    }
  }
  return score;
}

/**
 * Get opponent's hand size (what you can see)
 */
export function getOpponentHandSize(
  hands: Record<string, Card[]>,
  playerId: string,
  opponentId: string,
): number {
  return hands[opponentId]?.length || 0;
}
