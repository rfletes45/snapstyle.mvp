/**
 * Sketch Party — Colyseus Client Service (LEGACY)
 *
 * Type exports (ChatEntry, StrokeData, ReactionKind, etc.) are still
 * used by SketchPartyScreenV4 and other consumers.
 *
 * Connection & send functions are DEPRECATED — use the generalized
 * realtime framework instead:
 *   import { useRealtimeRoom } from "@/gamesV4/realtime/useRealtimeRoom";
 *   import { SKETCH_PARTY_CLIENT_DEF } from "@/gamesV4/realtime/games/sketchPartyDef";
 *
 * @module gamesV4/services/sketchPartyClient
 * @deprecated Connection/send functions replaced by useRealtimeRoom hook.
 */

import { Client, Room } from "colyseus.js";
import Constants from "expo-constants";

// =============================================================================
// Server URL derivation
// =============================================================================

/**
 * Derive the Colyseus server URL.
 *
 * Priority:
 * 1. Explicit `colyseusUrl` in app.config extra
 * 2. Auto-detect from Expo dev-server host (LAN IP) — works for
 *    physical devices and emulators that can't resolve `localhost`.
 * 3. Fallback to localhost (web or CI).
 */
function getColyseusUrl(): string {
  const COLYSEUS_PORT = 2567;

  // 1. Explicit override
  const extra = Constants.expoConfig?.extra;
  if (extra?.colyseusUrl && typeof extra.colyseusUrl === "string") {
    return extra.colyseusUrl;
  }

  // 2. Derive from Expo dev-server host (e.g. "192.168.1.42:8081")
  const devHost =
    Constants.expoConfig?.hostUri ?? // SDK 49+
    ((Constants as Record<string, unknown>).debuggerHost as string | undefined); // older SDKs
  if (devHost) {
    const hostname = devHost.split(":")[0]; // strip Expo port
    if (hostname) {
      return `http://${hostname}:${COLYSEUS_PORT}`;
    }
  }

  // 3. Fallback (web / CI)
  return `http://localhost:${COLYSEUS_PORT}`;
}

// =============================================================================
// Message types (client ↔ server)
// =============================================================================

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

/** Chat message received from server. */
export interface ChatEntry {
  uid: string;
  displayName: string;
  text: string;
  isCorrect: boolean;
  isSystem: boolean;
  timestamp: number;
}

/** Stroke data for canvas rendering. */
export interface StrokeData {
  strokeId: string;
  tool: "pen" | "eraser";
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

/** Reaction kinds supported by the server. */
export type ReactionKind = "thumbsup" | "thumbsdown" | "fire" | "laugh";

/** Reaction event received from server. */
export interface ReactionEvent {
  uid: string;
  displayName: string;
  kind: ReactionKind;
  ts: number;
}

// =============================================================================
// Room state shape (message payload contract used by typed access)
// =============================================================================

export interface SketchPartyRoomState {
  phase: "waiting" | "choosing" | "drawing" | "turn_end" | "match_end";
  currentRound: number;
  totalRounds: number;
  currentTurnIndex: number;
  drawerId: string;
  turnOrder: string[];
  maskedWord: string;
  wordLength: number;
  secretWord: string; // only sent to drawer
  scores: Record<string, number>;
  correctGuessers: string[];
  timeRemainingSec: number;
  drawTimeSec: number;
  hintsUsed: number;
  maxHints: number;
  wordChoices: string[]; // only sent to drawer during choosing phase
  players: Array<{
    uid: string;
    displayName: string;
    connected: boolean;
  }>;
  effectiveSettings: {
    maxPlayers: number;
    rounds: number;
    drawTimeSec: number;
    turnChooseTimeSec: number;
    wordChoices: number;
    hints: number;
    customWordsEnabled: boolean;
    customWordsList: string;
  };
}

// =============================================================================
// Room event types
// =============================================================================

export type SketchPartyEvent =
  | { type: "state_change"; state: SketchPartyRoomState }
  | { type: "stroke_begin"; data: StrokeBeginMsg }
  | { type: "stroke_points"; data: StrokePointsMsg }
  | { type: "stroke_end"; data: StrokeEndMsg }
  | { type: "chat"; data: ChatEntry }
  | { type: "clear_canvas" }
  | { type: "undo_stroke"; strokeId: string }
  | { type: "board_snapshot"; strokes: StrokeData[] }
  | { type: "word_reveal"; word: string }
  | { type: "turn_scores"; scores: Record<string, number> }
  | {
      type: "settings_applied";
      settings: SketchPartyRoomState["effectiveSettings"];
    }
  | { type: "reaction_event"; data: ReactionEvent }
  | { type: "error"; message: string };

// =============================================================================
// Client singleton
// =============================================================================

let clientInstance: Client | null = null;

function getClient(): Client {
  if (!clientInstance) {
    clientInstance = new Client(getColyseusUrl());
  }
  return clientInstance;
}

// =============================================================================
// Join / leave
// =============================================================================

/**
 * Join or create a Sketch Party room tied to a V4 session.
 * @deprecated Use useRealtimeRoom(SKETCH_PARTY_CLIENT_DEF, opts) instead.
 */
export async function joinSketchPartyRoom(
  sessionId: string,
  uid: string,
  displayName: string,
  token: string,
): Promise<Room> {
  const client = getClient();
  console.log(
    `[SketchParty] Connecting to ${getColyseusUrl()} for session ${sessionId}`,
  );
  // joinOrCreate uses filterBy("sessionId") on the server so all players
  // in the same V4 session land in the same Colyseus room.
  const room = await client.joinOrCreate("sketch_party", {
    sessionId,
    uid,
    displayName,
    token,
  });
  console.log(
    `[SketchParty] Joined room ${room.roomId} (session ${room.sessionId})`,
  );
  return room;
}

/**
 * Leave the current room gracefully.
 * @deprecated Room lifecycle is managed by useRealtimeRoom hook.
 */
export async function leaveRoom(room: Room): Promise<void> {
  try {
    await room.leave();
  } catch {
    // Ignore — room may already be disconnected
  }
}

// =============================================================================
// Action senders
// =============================================================================

export function sendStrokeBegin(room: Room, msg: StrokeBeginMsg): void {
  room.send("stroke_begin", msg);
}

export function sendStrokePoints(room: Room, msg: StrokePointsMsg): void {
  room.send("stroke_points", msg);
}

export function sendStrokeEnd(room: Room, msg: StrokeEndMsg): void {
  room.send("stroke_end", msg);
}

export function sendGuess(room: Room, text: string): void {
  room.send("guess", { text });
}

export function sendWordChoice(room: Room, wordIndex: number): void {
  room.send("word_choice", { wordIndex });
}

export function sendUndo(room: Room): void {
  room.send("undo", {});
}

export function sendReaction(room: Room, kind: ReactionKind): void {
  room.send("reaction", { kind });
}

export function sendClearCanvas(room: Room): void {
  room.send("clear", {});
}
