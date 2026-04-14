import { FEED_LAYOUT } from "@/chat/displayMode";

export type StackedCardVariant = "dm" | "group";

export const GROUP_STACKED_CARD_PADDING_H = FEED_LAYOUT.rowPaddingH - 4;
export const DM_STACKED_CARD_PADDING_H = GROUP_STACKED_CARD_PADDING_H;

export function getStackedCardPaddingHorizontal(
  variant: StackedCardVariant,
): number {
  return variant === "group"
    ? GROUP_STACKED_CARD_PADDING_H
    : DM_STACKED_CARD_PADDING_H;
}

export function getStackedCardTotalHorizontalPadding(
  variant: StackedCardVariant,
): number {
  return getStackedCardPaddingHorizontal(variant) * 2;
}
