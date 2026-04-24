/**
 * Shared backend message preview helpers.
 *
 * Centralizes preview generation for:
 * - conversation `lastMessageText`
 * - inbox aggregation previews
 * - DM/group push notification copy
 *
 * Scorecards store a sentinel-prefixed JSON payload in `text`. Rich
 * scorecard rendering is driven by trusted message metadata, not by the
 * plaintext preview, so every summary surface must substitute a generic
 * label instead of leaking the raw wire payload.
 */

export const SCORECARD_SENTINEL = "[SCORECARD_V1]";
export const SCORECARD_VISIBLE_TEXT = "Game Scorecard";

export interface BuildMessagePreviewTextOptions {
  kind: string;
  text?: string | null;
  maxTextLength?: number;
}

export function isScorecardWireText(text: string | null | undefined): boolean {
  return typeof text === "string" && text.startsWith(SCORECARD_SENTINEL);
}

export function sanitizeMessagePreviewText(
  text: string | null | undefined,
): string | undefined {
  if (typeof text !== "string" || text.length === 0) return undefined;
  return isScorecardWireText(text) ? SCORECARD_VISIBLE_TEXT : text;
}

export function buildMessagePreviewText(
  options: BuildMessagePreviewTextOptions,
): string {
  const { kind, maxTextLength = 120 } = options;
  const text = sanitizeMessagePreviewText(options.text);

  if (kind === "text" && text) {
    return text.length > maxTextLength
      ? `${text.slice(0, Math.max(0, maxTextLength - 3))}...`
      : text;
  }
  if (kind === "media") return "Sent a photo";
  if (kind === "voice") return "Sent a voice message";
  if (kind === "file") return "Sent a file";
  if (kind === "animal") return "Sent an animal sticker";
  if (kind === "system") return text || "System message";
  return text || "New message";
}
