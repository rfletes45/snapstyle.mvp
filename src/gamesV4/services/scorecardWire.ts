/**
 * Games V4 — scorecard wire format.
 *
 * The resolve pipeline auto-posts multiplayer group game results as a
 * `kind: "system"` chat message. To keep the post compatible with the
 * existing message sync path (Firestore → local SQLite → renderer) we
 * encode the structured payload **inside the `text` field** using a
 * sentinel prefix:
 *
 * ```
 * [SCORECARD_V1]{"v":1,"sessionId":"…", …}
 * 🎮 Minesweeper — Bob won!
 * ```
 *
 * - Line 1 is machine-parsable; the renderer strips it and draws a rich
 *   `<GameScorecard />` card.
 * - Line 2 is the human-readable fallback surfaced to any path that
 *   doesn't know about scorecards yet (inbox preview ignores the
 *   message text in favour of `lastMessageText` on the group doc; search
 *   and pinned-message sheets will still read the plain sentence).
 *
 * Keeping the format text-based means nothing in the messaging
 * pipeline (rate limiter, attachments, replication, search, etc.) needs
 * a schema change to carry scorecards.
 *
 * @module gamesV4/services/scorecardWire
 */

import type { GameScorecardPayload } from "@/gamesV4/types";

/** Sentinel prefix marking the start of the JSON payload line. */
export const SCORECARD_SENTINEL = "[SCORECARD_V1]";

/**
 * Wrap a scorecard payload and a human-readable fallback line into the
 * on-wire `text` body. The fallback is displayed when a client does not
 * yet know about scorecards.
 */
export function encodeScorecardText(
  payload: GameScorecardPayload,
  fallback: string,
): string {
  return `${SCORECARD_SENTINEL}${JSON.stringify(payload)}\n${fallback}`;
}

/**
 * Parse a message text body and return the scorecard payload if one is
 * embedded, otherwise null. Tolerant of malformed JSON so historical /
 * corrupted messages simply render as plain system text.
 */
export function decodeScorecardText(
  text: string | null | undefined,
): GameScorecardPayload | null {
  if (!text || !text.startsWith(SCORECARD_SENTINEL)) return null;
  const lineEnd = text.indexOf("\n");
  const jsonSlice =
    lineEnd === -1
      ? text.slice(SCORECARD_SENTINEL.length)
      : text.slice(SCORECARD_SENTINEL.length, lineEnd);

  try {
    const parsed = JSON.parse(jsonSlice) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<GameScorecardPayload>;
    if (candidate.v !== 1) return null;
    if (
      typeof candidate.sessionId !== "string" ||
      typeof candidate.gameId !== "string" ||
      typeof candidate.gameTitle !== "string" ||
      !Array.isArray(candidate.scoreboard) ||
      !Array.isArray(candidate.winnerIds)
    ) {
      return null;
    }
    return candidate as GameScorecardPayload;
  } catch {
    return null;
  }
}

/**
 * Return the human-readable fallback text embedded in a scorecard
 * message, suitable for inbox previews and search snippets.
 */
export function readScorecardFallbackText(
  text: string | null | undefined,
): string | null {
  if (!text || !text.startsWith(SCORECARD_SENTINEL)) return null;
  const lineEnd = text.indexOf("\n");
  if (lineEnd === -1) return null;
  return text.slice(lineEnd + 1);
}
