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
export declare const SCORECARD_SENTINEL = "[SCORECARD_V1]";
export declare const SCORECARD_VISIBLE_TEXT = "Game Scorecard";
export interface BuildMessagePreviewTextOptions {
    kind: string;
    text?: string | null;
    maxTextLength?: number;
}
export declare function isScorecardWireText(text: string | null | undefined): boolean;
export declare function sanitizeMessagePreviewText(text: string | null | undefined): string | undefined;
export declare function buildMessagePreviewText(options: BuildMessagePreviewTextOptions): string;
