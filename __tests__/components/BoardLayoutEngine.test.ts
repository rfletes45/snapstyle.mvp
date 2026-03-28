/**
 * Board Layout Engine Tests
 *
 * Unit tests for the grid packing, occupancy, compaction,
 * and widget manipulation logic.
 */

import {
  addWidget,
  buildOccupancyMap,
  canPlace,
  compactWidgets,
  findNearestSlot,
  generateDefaultLayout,
  getGridRows,
  getWidgetPixelSize,
  gridToPixel,
  hideWidget,
  moveWidget,
  pixelToGrid,
  resizeWidget,
  restoreWidget,
} from "@/components/profile/WidgetBoard/BoardLayoutEngine";
import type { WidgetInstance } from "@/components/profile/WidgetBoard/types";
import { GRID_COLUMNS } from "@/components/profile/WidgetBoard/types";

// =============================================================================
// Helpers
// =============================================================================

function makeWidget(
  overrides: Partial<WidgetInstance> &
    Pick<WidgetInstance, "instanceId" | "widgetType" | "size" | "x" | "y">,
): WidgetInstance {
  const now = new Date().toISOString();
  return {
    visible: true,
    pinned: false,
    config: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("BoardLayoutEngine", () => {
  // ── Occupancy Map ───────────────────────────────────────────────────

  describe("buildOccupancyMap", () => {
    it("returns empty array for no widgets", () => {
      const grid = buildOccupancyMap([]);
      expect(grid).toEqual([]);
    });

    it("builds correct occupancy for one widget", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
      ];
      const grid = buildOccupancyMap(widgets);
      // medium = 2x2 → should occupy (0,0), (1,0), (0,1), (1,1)
      expect(getGridRows(grid)).toBe(2);
      expect(grid[0].instanceId).toBe("w1");
      expect(grid[1].instanceId).toBe("w1");
      expect(grid[GRID_COLUMNS].instanceId).toBe("w1");
      expect(grid[GRID_COLUMNS + 1].instanceId).toBe("w1");
      // Remaining cells in row should be null
      expect(grid[2].instanceId).toBeNull();
      expect(grid[3].instanceId).toBeNull();
    });

    it("excludes hidden widgets", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "wide",
          x: 0,
          y: 0,
          visible: false,
        }),
      ];
      const grid = buildOccupancyMap(widgets);
      expect(grid).toEqual([]);
    });
  });

  // ── canPlace ────────────────────────────────────────────────────────

  describe("canPlace", () => {
    it("allows placement on an empty grid", () => {
      expect(canPlace([], { x: 0, y: 0, w: 2, h: 2 })).toBe(true);
    });

    it("rejects placement out of column bounds", () => {
      expect(canPlace([], { x: 3, y: 0, w: 2, h: 1 })).toBe(false);
    });

    it("rejects placement overlapping existing widget", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
      ];
      const grid = buildOccupancyMap(widgets);
      expect(canPlace(grid, { x: 1, y: 0, w: 2, h: 1 })).toBe(false);
    });

    it("allows placement when ignoring the occupying widget", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
      ];
      const grid = buildOccupancyMap(widgets);
      expect(canPlace(grid, { x: 0, y: 0, w: 2, h: 2 }, "w1")).toBe(true);
    });
  });

  // ── findNearestSlot ─────────────────────────────────────────────────

  describe("findNearestSlot", () => {
    it("returns exact position when available", () => {
      const result = findNearestSlot([], { w: 2, h: 1 }, 0, 0);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it("finds fallback when exact position blocked", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "wide",
          x: 0,
          y: 0,
        }),
      ];
      const grid = buildOccupancyMap(widgets);
      const result = findNearestSlot(grid, { w: 2, h: 1 }, 0, 0);
      expect(result).not.toBeNull();
      expect(result!.y).toBeGreaterThan(0);
    });
  });

  // ── compactWidgets ──────────────────────────────────────────────────

  describe("compactWidgets", () => {
    it("compacts widgets upward removing gaps", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 5,
        }),
        makeWidget({
          instanceId: "w2",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 5,
        }),
      ];
      const compacted = compactWidgets(widgets);
      const w1 = compacted.find((w) => w.instanceId === "w1")!;
      const w2 = compacted.find((w) => w.instanceId === "w2")!;
      expect(w1.y).toBe(0);
      expect(w2.y).toBe(0);
      expect(w1.x).toBe(0);
      expect(w2.x).toBe(2);
    });

    it("preserves hidden widgets without changing positions", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "w2",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 5,
          visible: false,
        }),
      ];
      const compacted = compactWidgets(widgets);
      const hidden = compacted.find((w) => w.instanceId === "w2")!;
      expect(hidden.visible).toBe(false);
    });
  });

  // ── moveWidget ──────────────────────────────────────────────────────

  describe("moveWidget", () => {
    it("moves a widget to a valid position", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
      ];
      const result = moveWidget(widgets, "w1", 2, 0);
      expect(result).not.toBeNull();
      const moved = result!.find((w) => w.instanceId === "w1")!;
      expect(moved.x).toBe(2);
    });

    it("returns null for out-of-bounds move", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
      ];
      const result = moveWidget(widgets, "w1", 5, 0);
      expect(result).toBeNull();
    });
  });

  // ── resizeWidget ────────────────────────────────────────────────────

  describe("resizeWidget", () => {
    it("resizes a widget to a larger size", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "small",
          x: 0,
          y: 0,
        }),
      ];
      const result = resizeWidget(widgets, "w1", "wide");
      expect(result).not.toBeNull();
      const resized = result!.find((w) => w.instanceId === "w1")!;
      expect(resized.size).toBe("wide");
    });
  });

  // ── hideWidget / restoreWidget ──────────────────────────────────────

  describe("hideWidget / restoreWidget", () => {
    it("hides a widget", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
      ];
      const result = hideWidget(widgets, "w1");
      expect(result).not.toBeNull();
      const hidden = result!.find((w) => w.instanceId === "w1")!;
      expect(hidden.visible).toBe(false);
    });

    it("hides any widget including previously-pinned ones", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "profile-header",
          size: "hero",
          x: 0,
          y: 0,
          pinned: true,
        }),
      ];
      const result = hideWidget(widgets, "w1");
      expect(result).not.toBeNull();
      expect(result![0].visible).toBe(false);
    });

    it("restores a hidden widget", () => {
      const widgets: WidgetInstance[] = [
        makeWidget({
          instanceId: "w1",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
          visible: false,
        }),
      ];
      const result = restoreWidget(widgets, "w1");
      expect(result).not.toBeNull();
      const restored = result!.find((w) => w.instanceId === "w1")!;
      expect(restored.visible).toBe(true);
    });
  });

  // ── addWidget ───────────────────────────────────────────────────────

  describe("addWidget", () => {
    it("adds a new widget to the board", () => {
      const widgets: WidgetInstance[] = [];
      const result = addWidget(widgets, "friends", "medium");
      expect(result.length).toBe(1);
      expect(result[0].widgetType).toBe("friends");
      expect(result[0].visible).toBe(true);
    });
  });

  // ── generateDefaultLayout ───────────────────────────────────────────

  describe("generateDefaultLayout", () => {
    it("generates a valid default layout", () => {
      const layout = generateDefaultLayout();
      expect(layout.length).toBeGreaterThan(0);
      const header = layout.find((w) => w.widgetType === "profile-header");
      expect(header).toBeDefined();
      expect(header!.pinned).toBe(false);
    });
  });

  // ── Pixel Conversion ───────────────────────────────────────────────

  describe("pixel/grid conversion", () => {
    const boardWidth = 400;

    it("gridToPixel and pixelToGrid are roughly inverse", () => {
      const pixel = gridToPixel(2, 3, boardWidth);
      const grid = pixelToGrid(pixel.x, pixel.y, boardWidth);
      expect(grid.col).toBe(2);
      expect(grid.row).toBe(3);
    });

    it("getWidgetPixelSize returns positive dimensions", () => {
      const size = getWidgetPixelSize("medium", boardWidth);
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });
  });
});
