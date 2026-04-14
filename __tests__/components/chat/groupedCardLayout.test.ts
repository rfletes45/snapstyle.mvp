import {
  buildGroupedCardRadii,
  GROUPED_CARD_CORNER_THRESHOLD,
  GROUPED_CARD_RADIUS,
} from "@/components/chat/groupedCardLayout";

describe("grouped card layout", () => {
  describe("deterministic corner rounding (no widths)", () => {
    it("rounds all corners for a solo message", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: true,
        isGroupEnd: true,
      });

      expect(radii.borderTopLeftRadius).toBe(GROUPED_CARD_RADIUS);
      expect(radii.borderTopRightRadius).toBe(GROUPED_CARD_RADIUS);
      expect(radii.borderBottomLeftRadius).toBe(GROUPED_CARD_RADIUS);
      expect(radii.borderBottomRightRadius).toBe(GROUPED_CARD_RADIUS);
    });

    it("rounds top and right for group start, flat bottom-left", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: true,
        isGroupEnd: false,
      });

      expect(radii.borderTopLeftRadius).toBe(GROUPED_CARD_RADIUS);
      expect(radii.borderTopRightRadius).toBe(GROUPED_CARD_RADIUS);
      expect(radii.borderBottomLeftRadius).toBe(0);
      expect(radii.borderBottomRightRadius).toBe(GROUPED_CARD_RADIUS);
    });

    it("flattens left edge and rounds right edge for group middle", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: false,
      });

      expect(radii.borderTopLeftRadius).toBe(0);
      expect(radii.borderTopRightRadius).toBe(GROUPED_CARD_RADIUS);
      expect(radii.borderBottomLeftRadius).toBe(0);
      expect(radii.borderBottomRightRadius).toBe(GROUPED_CARD_RADIUS);
    });

    it("rounds bottom and right for group end, flat top-left", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: true,
      });

      expect(radii.borderTopLeftRadius).toBe(0);
      expect(radii.borderTopRightRadius).toBe(GROUPED_CARD_RADIUS);
      expect(radii.borderBottomLeftRadius).toBe(GROUPED_CARD_RADIUS);
      expect(radii.borderBottomRightRadius).toBe(GROUPED_CARD_RADIUS);
    });

    it("supports a custom radius value", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: false,
        radius: 12,
      });

      expect(radii.borderTopLeftRadius).toBe(0);
      expect(radii.borderTopRightRadius).toBe(12);
      expect(radii.borderBottomLeftRadius).toBe(0);
      expect(radii.borderBottomRightRadius).toBe(12);
    });

    it("produces consistent results regardless of call order", () => {
      const first = buildGroupedCardRadii({
        isGroupStart: true,
        isGroupEnd: false,
      });
      const second = buildGroupedCardRadii({
        isGroupStart: true,
        isGroupEnd: false,
      });

      expect(first).toEqual(second);
    });
  });

  describe("width-aware right-side corners", () => {
    const T = GROUPED_CARD_CORNER_THRESHOLD;
    const R = GROUPED_CARD_RADIUS;

    it("flattens TR when prev is wider by threshold", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: false,
        currentWidth: 100,
        prevWidth: 100 + T,
      });
      expect(radii.borderTopRightRadius).toBe(0);
    });

    it("flattens BR when next is wider by threshold", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: false,
        currentWidth: 100,
        nextWidth: 100 + T,
      });
      expect(radii.borderBottomRightRadius).toBe(0);
    });

    it("stays rounded when diff is below threshold", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: false,
        currentWidth: 100,
        prevWidth: 100 + T - 1,
        nextWidth: 100 + T - 1,
      });
      expect(radii.borderTopRightRadius).toBe(R);
      expect(radii.borderBottomRightRadius).toBe(R);
    });

    it("group-start TR always rounded even with wide prev", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: true,
        isGroupEnd: false,
        currentWidth: 100,
        prevWidth: 300,
      });
      expect(radii.borderTopRightRadius).toBe(R);
    });

    it("group-end BR always rounded even with wide next", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: true,
        currentWidth: 100,
        nextWidth: 300,
      });
      expect(radii.borderBottomRightRadius).toBe(R);
    });
  });
});
