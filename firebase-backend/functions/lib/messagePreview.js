"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORECARD_VISIBLE_TEXT = exports.SCORECARD_SENTINEL = void 0;
exports.isScorecardWireText = isScorecardWireText;
exports.sanitizeMessagePreviewText = sanitizeMessagePreviewText;
exports.buildMessagePreviewText = buildMessagePreviewText;
exports.SCORECARD_SENTINEL = "[SCORECARD_V1]";
exports.SCORECARD_VISIBLE_TEXT = "Game Scorecard";
function isScorecardWireText(text) {
    return typeof text === "string" && text.startsWith(exports.SCORECARD_SENTINEL);
}
function sanitizeMessagePreviewText(text) {
    if (typeof text !== "string" || text.length === 0)
        return undefined;
    return isScorecardWireText(text) ? exports.SCORECARD_VISIBLE_TEXT : text;
}
function buildMessagePreviewText(options) {
    const { kind, maxTextLength = 120 } = options;
    const text = sanitizeMessagePreviewText(options.text);
    if (kind === "text" && text) {
        return text.length > maxTextLength
            ? `${text.slice(0, Math.max(0, maxTextLength - 3))}...`
            : text;
    }
    if (kind === "media")
        return "Sent a photo";
    if (kind === "voice")
        return "Sent a voice message";
    if (kind === "file")
        return "Sent a file";
    if (kind === "animal")
        return "Sent an animal sticker";
    if (kind === "system")
        return text || "System message";
    return text || "New message";
}
//# sourceMappingURL=messagePreview.js.map