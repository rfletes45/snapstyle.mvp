/**
 * Pre-mount width estimation for grouped stacked-message cards.
 *
 * The estimate only needs to be close enough to avoid visible first-paint
 * correction. It is later replaced by the measured inner card-content width
 * from `onLayout`.
 */

import { Dimensions } from "react-native";

import { FEED_LAYOUT } from "@/chat/displayMode";
import {
  getStackedCardTotalHorizontalPadding,
  type StackedCardVariant,
} from "@/components/chat/groupedCardMetrics";
import { normalizeGroupedCardWidth } from "@/components/chat/groupedCardLayout";

const F = FEED_LAYOUT;

const NARROW_CHAR_WIDTH = 8.2;
const WIDE_CHAR_WIDTH = 16;
const EMOJI_CHAR_WIDTH = 16;

const CJK_REGEX =
  /[\u2E80-\u2FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u31A0-\u31BF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97F\uAC00-\uD7AF\uD7B0-\uD7FF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/;
const EMOJI_REGEX =
  /[\u2600-\u27BF\u2B50\u2934-\u2935\u3030\u303D\uFE0F\u200D]|[\uD83C-\uD83E][\uDC00-\uDFFF]/;

const MIN_HEADER_WIDTH = 100;
const REPLY_PREVIEW_WIDTH_BOOST = 40;
const THREAD_INDICATOR_WIDTH = 130;
const REACTION_ROW_WIDTH = 50;

function effectiveCharWidth(text: string): number {
  if (text.length === 0) return NARROW_CHAR_WIDTH;

  let wideCount = 0;
  let emojiCount = 0;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const ch = text[i];
    if (CJK_REGEX.test(ch)) {
      wideCount++;
      continue;
    }

    if (EMOJI_REGEX.test(ch)) {
      emojiCount++;
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

  if (wideCount === 0 && emojiCount === 0) return NARROW_CHAR_WIDTH;
  if (narrowCount === 0 && emojiCount === 0) return WIDE_CHAR_WIDTH;
  if (narrowCount === 0 && wideCount === 0) return EMOJI_CHAR_WIDTH;

  const totalWeight =
    narrowCount * NARROW_CHAR_WIDTH +
    wideCount * WIDE_CHAR_WIDTH +
    emojiCount * EMOJI_CHAR_WIDTH;

  return totalWeight / len;
}

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

export interface EstimateWidthParams {
  text?: string | null;
  kind: string;
  attachments?: { kind: string; width?: number; height?: number }[];
  hasReplyPreview: boolean;
  hasThread?: boolean;
  threadPlacement?: "inline" | "external" | "none";
  hasReactions: boolean;
  isGroupStart: boolean;
  variant?: StackedCardVariant;
  screenWidth?: number;
}

export function estimateMessageWidth(params: EstimateWidthParams): number {
  const screenWidth = params.screenWidth ?? Dimensions.get("window").width;
  const variant = params.variant ?? "dm";
  const totalHorizontalPadding =
    getStackedCardTotalHorizontalPadding(variant);
  const hasInlineThreadIndicator =
    params.threadPlacement != null
      ? params.threadPlacement === "inline"
      : !!params.hasThread;

  const maxContentWidth =
    screenWidth - 2 * F.rowPaddingH - F.gutterWidth - F.gutterGap;

  let estimatedWidth: number;

  if (params.kind === "media") {
    const imageAtt = params.attachments?.find((a) => a.kind === "image");
    estimatedWidth =
      (imageAtt
        ? estimateImageWidth(imageAtt.width, imageAtt.height)
        : F.imageMaxWidth) + totalHorizontalPadding;
  } else if (params.kind === "voice") {
    estimatedWidth = Math.min(maxContentWidth, 240) + totalHorizontalPadding;
  } else if (params.kind === "animal") {
    estimatedWidth = 180;
  } else {
    const text = params.text || "";
    if (text.length === 0) {
      estimatedWidth = totalHorizontalPadding + 20;
    } else {
      const singleLineWidth = text.length * effectiveCharWidth(text);
      const maxTextWidth = maxContentWidth - totalHorizontalPadding;

      estimatedWidth =
        singleLineWidth <= maxTextWidth
          ? singleLineWidth + totalHorizontalPadding
          : maxContentWidth;
    }
  }

  if (params.isGroupStart) {
    estimatedWidth = Math.max(
      estimatedWidth,
      MIN_HEADER_WIDTH + totalHorizontalPadding,
    );
  }

  if (params.hasReplyPreview) {
    estimatedWidth = Math.max(
      estimatedWidth,
      REPLY_PREVIEW_WIDTH_BOOST + totalHorizontalPadding,
    );
  }

  if (hasInlineThreadIndicator) {
    estimatedWidth = Math.max(estimatedWidth, THREAD_INDICATOR_WIDTH);
  }

  if (params.hasReactions) {
    estimatedWidth = Math.max(
      estimatedWidth,
      REACTION_ROW_WIDTH + totalHorizontalPadding,
    );
  }

  return normalizeGroupedCardWidth(
    Math.min(estimatedWidth, maxContentWidth),
  );
}
