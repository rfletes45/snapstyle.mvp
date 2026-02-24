/**
 * CrazyCardsTypes — UI-layer types for the Crazy Cards game
 *
 * Separates render concerns from the shared game types in turnBased.ts.
 */

import type { CrazyCard, CrazyCardColor } from "@/types/turnBased";

// =============================================================================
// Card Render State
// =============================================================================

export type CardRenderState =
  | "playable" // glow outline, full saturation
  | "not_playable" // saturation 35%, opacity 0.55
  | "selected" // lift translateY, scale 1.02
  | "pressed"; // scale 0.97

export interface CardFaceProps {
  /** The card data to render. Null = face-down (card back). */
  card: CrazyCard | null;
  /** Render state controlling visual appearance */
  renderState?: CardRenderState;
  /** Width override (defaults to CrazyCardsConfig.CARD_WIDTH) */
  width?: number;
  /** Height override (defaults to CrazyCardsConfig.CARD_HEIGHT) */
  height?: number;
  /** Whether this card is face-down (shows card back) */
  faceDown?: boolean;
  /** Called when card is tapped */
  onPress?: (card: CrazyCard) => void;
  /** Scale for animation (0–1) */
  animatedScale?: number;
}

// =============================================================================
// Hand
// =============================================================================

export interface CardHandProps {
  /** Cards in the player's hand */
  hand: CrazyCard[];
  /** Currently selected card ID (null = none) */
  selectedCardId: string | null;
  /** IDs of cards that are playable this turn */
  playableCardIds: Set<string>;
  /** Whether it's the player's turn */
  isMyTurn: boolean;
  /** Called when a card is tapped */
  onCardSelect: (card: CrazyCard) => void;
  /** Called when the selected card is tapped again (confirm play) */
  onCardPlay: (card: CrazyCard) => void;
}

// =============================================================================
// Draw / Discard Piles
// =============================================================================

export interface DrawDiscardPilesProps {
  /** The top card on the discard pile */
  topCard: CrazyCard | null;
  /** Number of cards remaining in the draw pile */
  deckSize: number;
  /** Current active color (may differ from topCard color after wild) */
  currentColor: CrazyCardColor;
  /** Whether the player can draw */
  canDraw: boolean;
  /** Called when draw pile is tapped */
  onDraw: () => void;
  /** Called when discard pile is tapped (play selected card) */
  onPlaySelected?: () => void;
  /** Whether it's the local player's turn */
  isMyTurn?: boolean;
  /** Whether a valid card is selected and ready to play */
  hasPlayableSelection?: boolean;
  /** Whether an action is currently in flight */
  actionInFlight?: boolean;
  /** Number of pending draws (from +2/+4 stacking) */
  pendingDrawCount?: number;
}

// =============================================================================
// Color Picker (Wild Overlay)
// =============================================================================

export interface ColorPickerProps {
  /** Whether the picker is visible */
  visible: boolean;
  /** Called when a color is chosen */
  onColorChosen: (color: CrazyCardColor) => void;
  /** Called when picker is cancelled */
  onCancel: () => void;
}

// =============================================================================
// UNO Call Button
// =============================================================================

export interface UnoCallButtonProps {
  /** Whether the UNO call button is visible */
  visible: boolean;
  /** Called when the button is pressed */
  onCall: () => void;
  /** Timeout in ms before auto-penalty */
  timeoutMs?: number;
}

// =============================================================================
// Opponent Bar
// =============================================================================

export interface OpponentBarProps {
  /** Opponent display name */
  name: string;
  /** Opponent avatar URL */
  avatarUrl: string;
  /** Number of cards in opponent's hand */
  handSize: number;
  /** Whether it's the opponent's turn */
  isTheirTurn: boolean;
  /** Whether the opponent can be challenged for not calling UNO */
  canChallenge: boolean;
  /** Called when challenge button is pressed */
  onChallenge: () => void;
}

/** Info for a single opponent chip in the multi-opponent strip */
export interface OpponentChipData {
  sessionId: string;
  displayName: string;
  avatarUrl: string;
  handSize: number;
  isTheirTurn: boolean;
  connected: boolean;
  canChallenge: boolean;
}

export interface OpponentStripProps {
  /** Array of opponent data to display */
  opponents: OpponentChipData[];
  /** Called when a challenge button is pressed */
  onChallenge: (sessionId: string) => void;
}

// =============================================================================
// Direction Indicator
// =============================================================================

export interface DirectionIndicatorProps {
  /** 1 = clockwise, -1 = counter-clockwise */
  direction: 1 | -1;
}

// =============================================================================
// Game Screen
// =============================================================================

export type CrazyCardsGameMode =
  | "menu"
  | "lobby"
  | "local"
  | "online"
  | "colyseus"
  | "waiting";

export interface CrazyCardsScreenParams {
  matchId?: string;
  inviteId?: string;
  entryPoint?: string;
  spectatorMode?: boolean;
}
