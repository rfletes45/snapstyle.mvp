/**
 * Games V4 — Crazy 8's Types
 *
 * Type definitions for the Crazy 8's card game.
 * Covers settings, public state, private state, and move payloads.
 *
 * Hidden-information model:
 *   - Player hands live in PrivateState (per-player, owner-only read).
 *   - PublicState contains hand counts, top discard, current color — safe for spectators.
 *   - Spectators never see any player's hand.
 *
 * @module gamesV4/adapters/crazyEights/crazyEightsTypes
 */

// =============================================================================
// Card Types
// =============================================================================

export type CardColor = "red" | "blue" | "green" | "yellow";

export type CardType =
  | "number"
  | "skip"
  | "reverse"
  | "draw_two"
  | "wild"
  | "wild_draw_four";

export interface Card {
  /** Unique card ID within the deck (e.g., "red_7_1"). */
  id: string;
  /** Card color, null for wilds. */
  color: CardColor | null;
  /** Card type. */
  type: CardType;
  /** Face value for number cards (0–9). */
  value: number | null;
}

export const ALL_COLORS: CardColor[] = ["red", "blue", "green", "yellow"];

// =============================================================================
// Points Values
// =============================================================================

export const CARD_POINTS: Record<CardType, number> = {
  number: 0, // face value used instead
  skip: 20,
  reverse: 20,
  draw_two: 20,
  wild: 50,
  wild_draw_four: 50,
};

export function getCardPoints(card: Card): number {
  if (card.type === "number") return card.value ?? 0;
  return CARD_POINTS[card.type];
}

// =============================================================================
// Settings
// =============================================================================

export type StackingMode = "same_only" | "draws_mix";
export type DrawMode = "draw_one_then_pass" | "draw_until_playable";
export type TurnTimerOption = "off" | "20s" | "30s" | "45s";
export type RoundModel = "single_hand" | "match_points";

export interface CrazyEightsSettings {
  stackDraw2: boolean;
  stackDraw4: boolean;
  stackingMode: StackingMode;
  forcePlay: boolean;
  drawMode: DrawMode;
  sevenZeroRule: boolean;
  jumpIn: boolean;
  wildDraw4Challenge: boolean;
  turnTimer: TurnTimerOption;
  roundModel: RoundModel;
  targetPoints: number;
}

export const DEFAULT_CRAZY_EIGHTS_SETTINGS: CrazyEightsSettings = {
  stackDraw2: false,
  stackDraw4: false,
  stackingMode: "same_only",
  forcePlay: true,
  drawMode: "draw_one_then_pass",
  sevenZeroRule: false,
  jumpIn: false,
  wildDraw4Challenge: false,
  turnTimer: "off",
  roundModel: "single_hand",
  targetPoints: 500,
};

// =============================================================================
// Move Payloads
// =============================================================================

export type CrazyEightsMoveAction =
  | "PLAY_CARD"
  | "DRAW_CARD"
  | "PASS"
  | "CALL_CRAZY"
  | "CATCH_NO_CRAZY"
  | "CHALLENGE_WILD4";

export interface CrazyEightsMovePayload {
  action: CrazyEightsMoveAction;
  /** For PLAY_CARD: the card ID from the player's hand. */
  cardId?: string;
  /** For PLAY_CARD with wild: declared color. */
  declaredColor?: CardColor;
  /** For PLAY_CARD: whether the player also calls CRAZY! (1 card left). */
  callCrazy?: boolean;
  /** For CATCH_NO_CRAZY: the uid of the player who forgot to call. */
  targetUid?: string;
  /** For CHALLENGE_WILD4: accept or challenge the draw. */
  challengeAction?: "challenge" | "accept";
  /** For sevenZeroRule PLAY_CARD with 7: target uid to swap hands with. */
  swapTargetUid?: string;
}

// =============================================================================
// Game Phase
// =============================================================================

export type CrazyEightsPhase = "playing" | "round_over" | "match_over";

// =============================================================================
// Pending Draw
// =============================================================================

export interface PendingDraw {
  count: number;
  source: "D2" | "D4" | null;
}

// =============================================================================
// Last Move (for micro-log)
// =============================================================================

export interface LastMove {
  actor: string;
  action: string;
  detail?: string;
}

// =============================================================================
// Challenge Window
// =============================================================================

export interface ChallengeWindow {
  active: boolean;
  /** The player who played Wild Draw Four. */
  wild4PlayerUid: string;
  /** The player who must accept/challenge (current turn player). */
  targetUid: string;
  /** Snapshot of the W+4 player's hand (minus the card played) for resolution. */
  couldHavePlayedOtherColor: boolean;
}

// =============================================================================
// Public State
// =============================================================================

export interface CrazyEightsPublicState {
  phase: CrazyEightsPhase;
  turnOrder: string[];
  currentTurnIndex: number;
  currentTurnUid: string;
  direction: 1 | -1;
  topDiscard: Card;
  currentColor: CardColor;
  drawPileCount: number;
  discardCount: number;
  handCounts: Record<string, number>;
  pendingDraw: PendingDraw;
  /** Who just became eligible to call CRAZY! (played to 1 card). */
  callEligibleUid: string | null;
  /** Whether the eligible player has called CRAZY!. */
  calledCrazy: Record<string, boolean>;
  turnCounter: number;
  moveCount: number;
  lastMove: LastMove | null;
  challengeWindow: ChallengeWindow | null;
  scores: Record<string, number>;
  roundNumber: number;
  settings: CrazyEightsSettings;
  resolved: {
    winnerUid: string;
    reason: string;
    roundScores: Record<string, number>;
    matchWinner?: string;
  } | null;
  /** Draw pile card IDs — server only (stripped from spectator view). */
  drawPile: string[];
  /** Discard pile card IDs (full log for reshuffle). */
  discardPile: string[];
  /** Card lookup table — maps card ID to Card. */
  cardLookup: Record<string, Card>;
}

// =============================================================================
// Private State (per player)
// =============================================================================

export interface CrazyEightsPrivateState {
  hand: Card[];
  hasDrawnThisTurn: boolean;
  /** Hand snapshot at time of W+4 play (for challenge resolution). */
  handAtWild4Play?: Card[];
}
