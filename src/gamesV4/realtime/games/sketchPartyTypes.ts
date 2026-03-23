/**
 * Games V4 - Sketch Party Realtime Contracts
 *
 * Shared client-side message and state contracts for Sketch Party.
 * The generalized realtime definition and the game screen both import
 * from here so there is a single authoritative contract surface.
 *
 * @module gamesV4/realtime/games/sketchPartyTypes
 */

export type SketchPartyPhase =
  | "waiting"
  | "choosing"
  | "drawing"
  | "turn_end"
  | "match_end";

export interface SketchPartyPlayerState {
  uid: string;
  displayName: string;
  connected: boolean;
}

export interface SketchPartyEffectiveSettings {
  maxPlayers: number;
  rounds: number;
  drawTimeSec: number;
  turnChooseTimeSec: number;
  wordChoices: number;
  hints: number;
  customWordsEnabled: boolean;
  customWordsList: string;
}

export interface SketchPartyRealtimeState {
  phase: SketchPartyPhase;
  currentRound: number;
  totalRounds: number;
  currentTurnIndex: number;
  drawerId: string;
  turnOrder: string[];
  maskedWord: string;
  wordLength: number;
  secretWord: string;
  scores: Record<string, number>;
  correctGuessers: string[];
  timeRemainingSec: number;
  drawTimeSec: number;
  hintsUsed: number;
  maxHints: number;
  wordChoices: string[];
  players: SketchPartyPlayerState[];
  effectiveSettings: SketchPartyEffectiveSettings;
}

export interface StrokeBeginMsg {
  strokeId: string;
  tool: "pen" | "eraser";
  color: string;
  width: number;
  x: number;
  y: number;
  t: number;
}

export interface StrokePointsMsg {
  strokeId: string;
  points: Array<{ x: number; y: number; t: number }>;
}

export interface StrokeEndMsg {
  strokeId: string;
}

export interface GuessMsg {
  text: string;
}

export interface WordChoiceMsg {
  wordIndex: number;
}

export interface ChatEntry {
  uid: string;
  displayName: string;
  text: string;
  isCorrect: boolean;
  isSystem: boolean;
  timestamp: number;
}

export interface StrokeData {
  strokeId: string;
  tool: "pen" | "eraser";
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

export type ReactionKind = "thumbsup" | "thumbsdown" | "fire" | "laugh";

export interface ReactionEvent {
  uid: string;
  displayName: string;
  kind: ReactionKind;
  ts: number;
}
