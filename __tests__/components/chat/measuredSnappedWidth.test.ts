/**
 * Tests for the grouped-card corner rounding system.
 *
 * Left-side corners: pure group position (start/middle/end).
 * Right-side corners: group position + width-aware neighbor comparison.
 * Width arguments are optional — missing widths default to rounded.
 */
import {
  buildGroupedCardRadii,
  GROUPED_CARD_CORNER_THRESHOLD,
  GROUPED_CARD_RADIUS,
  normalizeGroupedCardWidth,
} from "@/components/chat/groupedCardLayout";
import { createCardCornerWidthStore } from "@/components/chat/useGroupedCardLayout";

const R = GROUPED_CARD_RADIUS;
const T = GROUPED_CARD_CORNER_THRESHOLD;

describe("grouped-card corner rounding", () => {
  describe("without widths (default rounded right side)", () => {
    it("solo message has all corners rounded", () => {
      expect(
        buildGroupedCardRadii({ isGroupStart: true, isGroupEnd: true }),
      ).toEqual({
        borderTopLeftRadius: R,
        borderTopRightRadius: R,
        borderBottomLeftRadius: R,
        borderBottomRightRadius: R,
      });
    });

    it("group start: rounded top + right, flat BL", () => {
      expect(
        buildGroupedCardRadii({ isGroupStart: true, isGroupEnd: false }),
      ).toEqual({
        borderTopLeftRadius: R,
        borderTopRightRadius: R,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: R,
      });
    });

    it("group middle: flat left, rounded right", () => {
      expect(
        buildGroupedCardRadii({ isGroupStart: false, isGroupEnd: false }),
      ).toEqual({
        borderTopLeftRadius: 0,
        borderTopRightRadius: R,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: R,
      });
    });

    it("group end: flat TL, rounded everywhere else", () => {
      expect(
        buildGroupedCardRadii({ isGroupStart: false, isGroupEnd: true }),
      ).toEqual({
        borderTopLeftRadius: 0,
        borderTopRightRadius: R,
        borderBottomLeftRadius: R,
        borderBottomRightRadius: R,
      });
    });
  });

  describe("width-aware right-side corners", () => {
    it("flattens TR when prev neighbor is wider by >= threshold", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: false,
        currentWidth: 100,
        prevWidth: 100 + T,
        nextWidth: 100,
      });
      expect(radii.borderTopRightRadius).toBe(0);
      expect(radii.borderBottomRightRadius).toBe(R);
    });

    it("flattens BR when next neighbor is wider by >= threshold", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: false,
        currentWidth: 100,
        prevWidth: 100,
        nextWidth: 100 + T,
      });
      expect(radii.borderTopRightRadius).toBe(R);
      expect(radii.borderBottomRightRadius).toBe(0);
    });

    it("keeps right rounded when width diff is below threshold", () => {
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

    it("keeps right rounded when current is wider than neighbor", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: false,
        currentWidth: 200,
        prevWidth: 100,
        nextWidth: 100,
      });
      expect(radii.borderTopRightRadius).toBe(R);
      expect(radii.borderBottomRightRadius).toBe(R);
    });

    it("unknown neighbor width defaults to rounded", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: false,
        currentWidth: 100,
        prevWidth: undefined,
        nextWidth: undefined,
      });
      expect(radii.borderTopRightRadius).toBe(R);
      expect(radii.borderBottomRightRadius).toBe(R);
    });

    it("group-start TR is always rounded regardless of width", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: true,
        isGroupEnd: false,
        currentWidth: 100,
        prevWidth: 300,
      });
      expect(radii.borderTopRightRadius).toBe(R);
    });

    it("group-end BR is always rounded regardless of width", () => {
      const radii = buildGroupedCardRadii({
        isGroupStart: false,
        isGroupEnd: true,
        currentWidth: 100,
        nextWidth: 300,
      });
      expect(radii.borderBottomRightRadius).toBe(R);
    });
  });

  describe("normalizeGroupedCardWidth", () => {
    it("snaps to 2px grid (ceiling)", () => {
      expect(normalizeGroupedCardWidth(101)).toBe(102);
      expect(normalizeGroupedCardWidth(100)).toBe(100);
      expect(normalizeGroupedCardWidth(99)).toBe(100);
    });

    it("clamps to 0 minimum", () => {
      expect(normalizeGroupedCardWidth(-5)).toBe(0);
    });
  });

  describe("CardCornerWidthStore", () => {
    it("stores and retrieves widths", () => {
      const store = createCardCornerWidthStore();
      expect(store.get("a")).toBeUndefined();
      store.set("a", 100);
      expect(store.get("a")).toBe(100);
    });

    it("notifies subscribers on width change", () => {
      const store = createCardCornerWidthStore();
      const calls: string[] = [];
      store.subscribe((id) => calls.push(id));
      store.set("a", 100);
      store.set("b", 200);
      expect(calls).toEqual(["a", "b"]);
    });

    it("does not notify when width is unchanged", () => {
      const store = createCardCornerWidthStore();
      const calls: string[] = [];
      store.set("a", 100);
      store.subscribe((id) => calls.push(id));
      store.set("a", 100); // same value
      expect(calls).toEqual([]);
    });

    it("unsubscribes cleanly", () => {
      const store = createCardCornerWidthStore();
      const calls: string[] = [];
      const unsub = store.subscribe((id) => calls.push(id));
      store.set("a", 100);
      unsub();
      store.set("b", 200);
      expect(calls).toEqual(["a"]);
    });
  });
});
