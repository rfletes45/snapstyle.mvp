/**
 * estimateMessageWidth — Pre-mount width estimation for grouped card rows.
 *
 * Called BEFORE rows mount to pre-seed the CardWidthTracker with estimated
 * widths, so cold-cache rows start with approximate corner rounding and
 * snap minWidth instead of the flat-everywhere default.
 *
 * The estimate is intentionally conservative: it aims to be in the same
 * snap-cluster bucket (within GROUPED_CARD_SNAP_THRESHOLD = 24px) as the
 * true measured width, NOT pixel-perfect. This ensures the first visible
 * paint uses approximately correct right-edge radii, and the post-onLayout
 * refinement pass mostly confirms what's already rendered rather than
 * producing a visible change.
 *
 * Width formula:
 *   cardContent.width ≈ textWidth + 2 * paddingH
 *
 * Where textWidth is derived from:
 *   - Character count × average character width (at font size 16)
 *   - Clamped to available content-column width (for line wrapping)
 *   - Minimum widths for author header, reaction pills, etc.
 *
 * For media messages: determined by image attachment dimensions and the
 * same getImageSize() constraints used in the renderer.
 *
 * @module components/chat/estimateMessageWidth
 */

import { Dimensions } from "react-native";

import { FEED_LAYOUT } from "@/chat/displayMode";
import { normalizeGroupedCardWidth } from "@/components/chat/groupedCardLayout";

const F = FEED_LAYOUT;

// ── Character-width constants ───────────────────────────────────────────────
// React Native at fontSize=16 on both platforms renders:
//   Latin/Cyrillic: ~8.2 px per character
//   CJK ideographs: ~16 px (full em-width)
//   Emoji:          ~16 px (rendered at font size, sometimes wider with ZWJ)
//
// Rather than a single AVG_CHAR_WIDTH we classify characters into three
// buckets and compute a weighted average for each message.

/** Width per Latin/Cyrillic/Arabic/Hebrew/other narrow glyph at fontSize=16. */
const NARROW_CHAR_WIDTH = 8.2;

/** Width per CJK ideograph, Hangul syllable, or full-width punctuation. */
const WIDE_CHAR_WIDTH = 16;

/**
 * Width per emoji sequence.  Emoji are rendered at roughly 1em but ZWJ
 * family sequences still occupy ~1 glyph slot visually.
 */
const EMOJI_CHAR_WIDTH = 16;

// ── Regex matchers for character classification ─────────────────────────────
// These are intentionally simple — we only need rough bucketing, not a
// full Unicode text shaping engine.

/**
 * Matches CJK Unified Ideographs, CJK Extensions, Hangul Syllables,
 * Hiragana, Katakana, Bopomofo, CJK Compatibility, and full-width
 * forms. Covers Chinese, Japanese, and Korean text.
 */
const CJK_REGEX =
  /[\u2E80-\u2FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u31A0-\u31BF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97F\uAC00-\uD7AF\uD7B0-\uD7FF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/;

/**
 * Matches common emoji ranges.  Covers most emoji in BMP + some surrogate
 * pair ranges.  Not exhaustive but catches the majority.
 */
const EMOJI_REGEX =
  /[\u2600-\u27BF\u2B50\u2934-\u2935\u3030\u303D\uFE0F\u200D]|[\uD83C-\uD83E][\uDC00-\uDFFF]/;

/**
 * Compute effective average character width for a text string by
 * classifying characters into narrow (Latin), wide (CJK), or emoji
 * buckets and returning a weighted average.
 *
 * For short texts (< 4 chars) or texts dominated by one class, returns
 * the class-specific constant directly.  For mixed texts, returns a
 * weighted mean.
 */
function effectiveCharWidth(text: string): number {
  if (text.length === 0) return NARROW_CHAR_WIDTH;

  let wideCount = 0;
  let emojiCount = 0;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const ch = text[i];
    if (CJK_REGEX.test(ch)) {
      wideCount++;
    } else if (EMOJI_REGEX.test(ch)) {
      emojiCount++;
      // Skip low surrogate of surrogate pair
      if (
        i + 1 < len &&
        text.charCodeAt(i + 1) >= 0xdc00 &&
        text.charCodeAt(i + 1) <= 0xdfff
      ) {
        i++;
      }
    }
  }

  const narrowCount = len - wideCount - emojiCount;

  // Fast path: entirely one category
  if (wideCount === 0 && emojiCount === 0) return NARROW_CHAR_WIDTH;
  if (narrowCount === 0 && emojiCount === 0) return WIDE_CHAR_WIDTH;
  if (narrowCount === 0 && wideCount === 0) return EMOJI_CHAR_WIDTH;

  // Weighted average
  const totalWeight =
    narrowCount * NARROW_CHAR_WIDTH +
    wideCount * WIDE_CHAR_WIDTH +
    emojiCount * EMOJI_CHAR_WIDTH;
  return totalWeight / len;
}

/** Inner card horizontal padding (both sides): rowPaddingH + 4 = 12, × 2. */
const CARD_PADDING_H = (F.rowPaddingH + 4) * 2; // 24px total

/** Minimum width for a group-start row with author name + timestamp. */
const MIN_HEADER_WIDTH = 100;

/** Width added by a reply preview block (approximate StackedReplyReference). */
const REPLY_PREVIEW_WIDTH_BOOST = 40;

/** Width added by a thread indicator (approximate ThreadIndicator). */
const THREAD_INDICATOR_WIDTH = 130;

/** Width added by a reaction pill row (approximate). */
const REACTION_ROW_WIDTH = 50;

// ── Image size estimation (mirrors GroupStackedMessageRenderer.getImageSize) ─

function estimateImageWidth(w?: number, h?: number): number {
  if (!w || !h) return F.imageMaxWidth;
  const aspect = w / h;
  let bw = Math.min(w, F.imageMaxWidth);
  let bh = bw / aspect;
  if (bh > F.imageMaxHeight) {
    bh = F.imageMaxHeight;
    bw = bh * aspect;
  }
  if (bw < F.imageMinWidth) {
    bw = F.imageMinWidth;
  }
  return Math.round(bw);
}

// ── Main estimator ──────────────────────────────────────────────────────────

export interface EstimateWidthParams {
  text?: string | null;
  kind: string;
  attachments?: { kind: string; width?: number; height?: number }[];
  hasReplyPreview: boolean;
  hasThread: boolean;
  hasReactions: boolean;
  isGroupStart: boolean;
  /**
   * Current screen width in pixels.  When provided, the estimator uses this
   * instead of `Dimensions.get("window").width`, allowing the caller to pass
   * a reactive value (e.g. from `useWindowDimensions()`) that stays current
   * after rotation or split-screen changes.
   */
  screenWidth?: number;
}

/**
 * Estimate the normalized card-content width for a message.
 *
 * Returns a value on the same 2px grid as measured widths, suitable for
 * pre-seeding into CardWidthTracker before the row mounts.
 */
export function estimateMessageWidth(params: EstimateWidthParams): number {
  const screenWidth = params.screenWidth ?? Dimensions.get("window").width;
  // Maximum content-column width available (after gutter + padding)
  const maxContentWidth =
    screenWidth - 2 * F.rowPaddingH - F.gutterWidth - F.gutterGap;

  let estimatedWidth: number;

  // ── Media messages: use image sizing formula ──────────────────────
  if (params.kind === "media") {
    const imageAtt = params.attachments?.find((a) => a.kind === "image");
    if (imageAtt) {
      estimatedWidth = estimateImageWidth(imageAtt.width, imageAtt.height);
    } else {
      estimatedWidth = F.imageMaxWidth;
    }
    // Add padding
    estimatedWidth += CARD_PADDING_H;
  }
  // ── Voice messages: fixed container width ─────────────────────────
  else if (params.kind === "voice") {
    estimatedWidth = Math.min(maxContentWidth, 240) + CARD_PADDING_H;
  }
  // ── Animal messages: fixed bubble size ────────────────────────────
  else if (params.kind === "animal") {
    estimatedWidth = 180;
  }
  // ── Text messages: estimate from text length ──────────────────────
  else {
    const text = params.text || "";
    const charCount = text.length;

    if (charCount === 0) {
      estimatedWidth = CARD_PADDING_H + 20;
    } else {
      // Compute per-character width accounting for CJK and emoji
      const avgCharWidth = effectiveCharWidth(text);
      // Estimate single-line text width
      const singleLineWidth = charCount * avgCharWidth;
      // Available width for text inside card
      const maxTextWidth = maxContentWidth - CARD_PADDING_H;

      if (singleLineWidth <= maxTextWidth) {
        // Fits on one line — width is the text width + padding
        estimatedWidth = singleLineWidth + CARD_PADDING_H;
      } else {
        // Multi-line: text fills the available width
        estimatedWidth = maxContentWidth;
      }
    }
  }

  // ── Boost for sub-elements that widen the card ────────────────────
  // Group-start rows have an author name + timestamp header
  if (params.isGroupStart) {
    estimatedWidth = Math.max(
      estimatedWidth,
      MIN_HEADER_WIDTH + CARD_PADDING_H,
    );
  }

  // Reply preview typically pushes width to at least this much
  if (params.hasReplyPreview) {
    estimatedWidth = Math.max(
      estimatedWidth,
      REPLY_PREVIEW_WIDTH_BOOST + CARD_PADDING_H,
    );
  }

  // Thread indicator
  if (params.hasThread) {
    estimatedWidth = Math.max(estimatedWidth, THREAD_INDICATOR_WIDTH);
  }

  // Reaction pills
  if (params.hasReactions) {
    estimatedWidth = Math.max(
      estimatedWidth,
      REACTION_ROW_WIDTH + CARD_PADDING_H,
    );
  }

  // Clamp to content column
  estimatedWidth = Math.min(estimatedWidth, maxContentWidth);

  // Normalize to the same 2px grid as measured widths
  return normalizeGroupedCardWidth(estimatedWidth);
}
