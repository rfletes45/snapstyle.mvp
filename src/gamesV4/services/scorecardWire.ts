/**
 * Games V4 — scorecard wire format.
 *
 * Scorecards travel through chat as trusted `kind: "text"` messages whose
 * rich payload is encoded inside the normal `text` field with a sentinel
 * prefix. This keeps scorecards compatible with the existing message sync
 * path (Firestore → local SQLite → renderer) without introducing a
 * separate message schema just for game cards:
 *
 * ```
 * [SCORECARD_V1]{"v":1,"sessionId":"…", …}
 * Game Scorecard
 * ```
 *
 * - Line 1 is machine-parsable; trusted clients decode it and draw a rich
 *   `<GameScorecard />` card.
 * - Line 2 is the generic human-readable fallback surfaced to paths that
 *   do not render the card directly (preview text, copy surfaces, legacy
 *   clients).
 *
 * Keeping the format text-based means nothing in the messaging
 * pipeline (rate limiter, attachments, replication, search, etc.) needs
 * a schema change to carry scorecards.
 *
 * @module gamesV4/services/scorecardWire
 */

import type { GameScorecardPayload } from "@/gamesV4/types";
import type { MessageV2 } from "@/types/messaging";

/** Sentinel prefix marking the start of the JSON payload line. */
export const SCORECARD_SENTINEL = "[SCORECARD_V1]";

/**
 * Human-readable label substituted for scorecard messages in every
 * visible surface that is NOT the rich `<GameScorecard>` card: inbox
 * preview, clipboard copy, reply snippet, search results, notifications,
 * and any text-based fallback.
 *
 * Scorecards carry personally-identifying content (avatars, usernames,
 * scores) inside their JSON payload. Leaking that raw text into
 * surfaces that users can see or copy is a privacy hazard, so every
 * non-card surface is labelled generically instead.
 */
export const SCORECARD_VISIBLE_TEXT = "Game Scorecard";

/**
 * Trust gate — a message is rendered as a rich scorecard ONLY if it
 * was authored by the server (direct write from the resolve pipeline)
 * or by the `sendMessageV2` scorecard-share path, which stamps a
 * `server-share:*` clientId on verified payloads.
 *
 * Any user-authored message — including one whose `text` starts with
 * the sentinel prefix — is deliberately NOT trusted. This closes the
 * spoofing vector where a user could paste scorecard text verbatim and
 * fake a game result.
 */
function isTrustedScorecardClientId(clientId: string | undefined): boolean {
  if (!clientId) return false;
  return clientId === "server" || clientId.startsWith("server-share:");
}

/**
 * Return the scorecard payload for a message IF and ONLY IF the
 * message is trusted. Returns `null` for untrusted messages even when
 * their text happens to start with the sentinel.
 */
export function getTrustedScorecardPayload(
  message: Pick<MessageV2, "text" | "clientId"> | null | undefined,
): GameScorecardPayload | null {
  if (!message) return null;
  if (!isTrustedScorecardClientId(message.clientId)) return null;
  return decodeScorecardText(message.text);
}

/**
 * True when a message should be treated as a scorecard for purposes of
 * visible-text sanitization (copy, reply-snippet, preview, etc.).
 *
 * This is broader than `getTrustedScorecardPayload` on purpose: legacy
 * or in-flight messages whose text starts with the sentinel but have
 * not yet been trust-verified should still be sanitized rather than
 * leaking their raw JSON into preview surfaces.
 */
export function isScorecardMessage(
  message: Pick<MessageV2, "text" | "clientId"> | null | undefined,
): boolean {
  if (!message) return false;
  if (isTrustedScorecardClientId(message.clientId)) return true;
  return !!message.text && message.text.startsWith(SCORECARD_SENTINEL);
}

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
 * corrupted messages simply render as plain text.
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
