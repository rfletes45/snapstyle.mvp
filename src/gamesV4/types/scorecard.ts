/**
 * Games V4 — shared scorecard payload.
 *
 * This is the minimal, self-contained bundle of data required to render a
 * `<GameScorecard />` anywhere in the app:
 *
 *  • The share card on `GameOverScreenV4` (captured via ViewShot).
 *  • The auto-posted inline card in group chats (`MessageV2.gameScorecard`).
 *
 * The payload must stay JSON-serializable and free of Firestore-specific
 * types so the backend can write it inside a standard `MessageV2` doc.
 *
 * @module gamesV4/types/scorecard
 */

import type { GameId, GameRuntimeType, ResolutionType } from "./index";

export interface GameScorecardScoreboardEntry {
  uid: string;
  displayName: string;
  profilePictureUrl?: string | null;
  score: number;
  placement: number;
}

export interface GameScorecardPayload {
  /** Payload schema version. Bump whenever fields change. */
  v: 1;
  sessionId: string;
  gameId: GameId;
  /** Human-readable game name (pre-resolved server-side). */
  gameTitle: string;
  runtimeType: GameRuntimeType;
  resolutionType: ResolutionType;
  winnerIds: string[];
  scoreboard: GameScorecardScoreboardEntry[];
  /** Match duration in milliseconds, or 0 when unknown. */
  durationMs: number;
  /** Posting timestamp (epoch ms). */
  createdAt: number;
}
