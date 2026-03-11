/**
 * Games V4 — Dead Drop Types
 *
 * Type definitions for the Dead Drop (Codenames-inspired) team word game.
 * Hidden-information safety: CardAlignment values NEVER appear in public state
 * for unrevealed cards. Spymasters receive the full key map via PrivateState.
 *
 * @module gamesV4/adapters/deadDrop/deadDropTypes
 */

// =============================================================================
// Teams & Roles
// =============================================================================

export type TeamColor = "red" | "blue";
export type PlayerRole = "spymaster" | "operative";

export interface TeamAssignment {
  uid: string;
  team: TeamColor;
  role: PlayerRole;
}

// =============================================================================
// Card & Board
// =============================================================================

/** Hidden alignment — only visible to spymasters via PrivateState. */
export type CardAlignment = "red" | "blue" | "neutral" | "assassin";

/** Public card state — safe for all players and spectators. */
export interface PublicCard {
  id: number;
  word: string;
  revealed: boolean;
  /** Only set after reveal — safe because the card is already public. */
  revealedAs: CardAlignment | null;
  revealedByTeam: TeamColor | null;
  revealedTurn: number | null;
  revealedFromClueId: number | null;
}

// =============================================================================
// Clue & Guess History
// =============================================================================

export interface ClueEntry {
  clueId: number;
  team: TeamColor;
  spymasterUid: string;
  word: string;
  count: number; // 0 = zero clue, -1 = unlimited
  turnNumber: number;
  timestamp: number;
}

export interface GuessEntry {
  cardId: number;
  word: string;
  guessedBy: string;
  result: "correct" | "neutral" | "enemy" | "assassin";
  team: TeamColor;
  turnNumber: number;
  clueId: number;
  timestamp: number;
}

// =============================================================================
// Settings
// =============================================================================

export type ClueLegalityMode = "relaxed" | "standard" | "tournament";
export type AdvancedClueMode = "off" | "zero" | "zero_unlimited";
export type TurnTimerOption = "off" | "1h" | "6h" | "24h" | "48h";
export type RematchSeatMode = "keep" | "shuffle";
export type WordPackOption = "classic" | "easy" | "hard";

export interface DeadDropSettings {
  clueLegality: ClueLegalityMode;
  advancedClues: AdvancedClueMode;
  turnTimer: TurnTimerOption;
  allowSpectators: boolean;
  rematchSeats: RematchSeatMode;
  wordPack: WordPackOption;
}

export const DEFAULT_DEAD_DROP_SETTINGS: DeadDropSettings = {
  clueLegality: "standard",
  advancedClues: "off",
  turnTimer: "off",
  allowSpectators: true,
  rematchSeats: "keep",
  wordPack: "classic",
};

// =============================================================================
// Phase Model
// =============================================================================

export type GamePhase =
  | "pregame_reveal"
  | "clue_input"
  | "guessing"
  | "turn_resolution"
  | "game_over";

// =============================================================================
// Public State
// =============================================================================

export type EndReason =
  | "all_agents_found"
  | "assassin"
  | "resign"
  | "timeout"
  | "abandon";

export interface DeadDropPublicState {
  boardSize: number; // always 5
  cards: PublicCard[];
  startingTeam: TeamColor;
  phase: GamePhase;
  turnTeam: TeamColor;
  currentTurnPlayerId: string;
  currentTurnRole: PlayerRole;
  turnNumber: number;
  redRemaining: number;
  blueRemaining: number;
  currentClue: ClueEntry | null;
  clueHistory: ClueEntry[];
  guessHistory: GuessEntry[];
  guessesUsedThisTurn: number;
  maxGuessesThisTurn: number;
  bonusGuessAllowed: boolean;
  winnerTeam: TeamColor | null;
  endReason: EndReason | null;
  teams: TeamAssignment[];
  /** When turn timer is enabled, deadline as epoch ms. */
  turnDeadlineAt: number | null;
  /** Move counter for version tracking. */
  moveCount: number;
  /** Clue ID sequence counter. */
  nextClueId: number;
  /** Settings snapshot for UI rendering. */
  settings: DeadDropSettings;
}

// =============================================================================
// Private State (Spymaster Only)
// =============================================================================

export interface DeadDropPrivateState {
  role: PlayerRole;
  team: TeamColor;
  /** Full key map: cardId → alignment. 25 entries. */
  keyMap: Record<number, CardAlignment>;
  /** Integrity version to prevent mismatch. */
  keyVersion: number;
}

// =============================================================================
// Move Payloads
// =============================================================================

export interface SubmitCluePayload {
  action: "submit_clue";
  word: string;
  count: number; // positive int, 0 for zero, -1 for unlimited
}

export interface GuessWordPayload {
  action: "guess_word";
  cardId: number;
}

export interface StopGuessingPayload {
  action: "stop_guessing";
}

export type DeadDropMovePayload =
  | SubmitCluePayload
  | GuessWordPayload
  | StopGuessingPayload;
