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
  /**
   * Equipped profile background ID of the sole winner, if there is exactly
   * one winner. Used by `<GameScorecard />` to personalize the card with
   * the winner's profile background image. Null/undefined for draws,
   * solo losses, or any no-winner state — renderer falls back to the
   * neutral default surface.
   *
   * Optional for backward compatibility with scorecards posted before
   * this field existed (decoder treats missing as null).
   */
  winnerEquippedBackgroundId?: string | null;
  /**
   * Equipped profile background ID of the user who sent / authored the
   * scorecard. Used by `<GameScorecard />` to personalize **solo**
   * scorecards regardless of win/loss — a solo card visually represents
   * the sender, so their background is always the appropriate
   * personalization source. For multiplayer cards the renderer prefers
   * `winnerEquippedBackgroundId` and ignores this field.
   *
   * Null/undefined when the sender has no equipped background (clean
   * fallback to the neutral default surface).
   */
  senderEquippedBackgroundId?: string | null;
}
