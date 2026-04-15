/**
 * Board Layout Engine Tests
 *
 * Unit tests for the grid packing, occupancy, compaction,
 * stable reflow engine, and widget manipulation logic.
 */

import {
  addWidget,
  buildOccupancyMap,
  canPlace,
  compactWidgets,
  findNearestSlot,
  generateDefaultLayout,
  getGridRows,
  getVisualOrder,
  getWidgetPixelSize,
  getWidgetRect,
  gridToPixel,
  hideWidget,
  inferCollisionDisplacementHint,
  moveWidget,
  pixelToGrid,
  resizeWidget,
  resolveConflicts,
  resolveResize,
  restoreWidget,
  settleBoardAfterDrop,
  stableCompact,
  stableRepack,
} from "@/components/profile/WidgetBoard/BoardLayoutEngine";
import {
  isSameDragHoverTarget,
  resolveCommittedPreviewLayout,
} from "@/components/profile/WidgetBoard/previewCommitUtils";
import type { WidgetInstance } from "@/components/profile/WidgetBoard/types";
import {
  GRID_COLUMNS,
  SIZE_PRESETS,
} from "@/components/profile/WidgetBoard/types";

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

// =============================================================================
// Stable Reflow Engine Tests
// =============================================================================

describe("Stable Reflow Engine", () => {
  // ── Helpers ─────────────────────────────────────────────────────────

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

  /** Assert that no two visible widgets overlap. */
  function assertNoOverlaps(widgets: WidgetInstance[]) {
    const visible = widgets.filter((w) => w.visible);
    for (let i = 0; i < visible.length; i++) {
      const a = visible[i];
      const aSpan = SIZE_PRESETS[a.size];
      for (let j = i + 1; j < visible.length; j++) {
        const b = visible[j];
        const bSpan = SIZE_PRESETS[b.size];
        const overlaps =
          a.x < b.x + bSpan.w &&
          a.x + aSpan.w > b.x &&
          a.y < b.y + bSpan.h &&
          a.y + aSpan.h > b.y;
        expect(overlaps).toBe(false);
      }
    }
  }

  /** Assert all visible widgets are within column bounds. */
  function assertBoundsLegal(widgets: WidgetInstance[]) {
    for (const w of widgets.filter((w) => w.visible)) {
      const span = SIZE_PRESETS[w.size];
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.y).toBeGreaterThanOrEqual(0);
      expect(w.x + span.w).toBeLessThanOrEqual(GRID_COLUMNS);
    }
  }

  /**
   * Extract the instanceIds from visible widgets in visual order.
   * This is the "truth" for verifying that order is preserved.
   */
  function getOrderedIds(widgets: WidgetInstance[]): string[] {
    return getVisualOrder(widgets).map((w) => w.instanceId);
  }

  /**
   * Assert that the relative order of a subset of IDs is preserved
   * between before and after arrays.
   */
  function assertOrderPreserved(
    before: string[],
    after: string[],
    subset: string[],
  ) {
    const beforeFiltered = before.filter((id) => subset.includes(id));
    const afterFiltered = after.filter((id) => subset.includes(id));
    expect(afterFiltered).toEqual(beforeFiltered);
  }

  // ── getVisualOrder ──────────────────────────────────────────────────

  describe("getVisualOrder", () => {
    it("sorts by y then x then instanceId", () => {
      const widgets = [
        makeWidget({
          instanceId: "c",
          widgetType: "friends",
          size: "medium",
          x: 2,
          y: 2,
        }),
        makeWidget({
          instanceId: "a",
          widgetType: "badges",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "b",
          widgetType: "achievements",
          size: "medium",
          x: 2,
          y: 0,
        }),
      ];
      const order = getVisualOrder(widgets);
      expect(order.map((w) => w.instanceId)).toEqual(["a", "b", "c"]);
    });

    it("excludes hidden widgets", () => {
      const widgets = [
        makeWidget({
          instanceId: "a",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "b",
          widgetType: "badges",
          size: "medium",
          x: 0,
          y: 2,
          visible: false,
        }),
      ];
      expect(getVisualOrder(widgets).length).toBe(1);
    });

    it("uses instanceId as tiebreaker for same position", () => {
      const widgets = [
        makeWidget({
          instanceId: "zz",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "aa",
          widgetType: "badges",
          size: "medium",
          x: 0,
          y: 0,
        }),
      ];
      const order = getVisualOrder(widgets);
      expect(order[0].instanceId).toBe("aa");
    });
  });

  // ── getWidgetRect ───────────────────────────────────────────────────

  describe("getWidgetRect", () => {
    it("returns correct rect for medium widget", () => {
      const w = makeWidget({
        instanceId: "w1",
        widgetType: "friends",
        size: "medium",
        x: 1,
        y: 3,
      });
      const rect = getWidgetRect(w);
      expect(rect).toEqual({ x: 1, y: 3, w: 2, h: 2 });
    });

    it("returns correct rect for hero widget", () => {
      const w = makeWidget({
        instanceId: "w1",
        widgetType: "profile-header",
        size: "hero",
        x: 0,
        y: 0,
      });
      const rect = getWidgetRect(w);
      expect(rect).toEqual({ x: 0, y: 0, w: 4, h: 4 });
    });
  });

  // ── stableRepack — Drag Reflow Preserves Order ──────────────────────

  describe("stableRepack — drag reflow", () => {
    it("preserves order of affected widgets when dragging downward", () => {
      // Layout:
      //   A(0,0) medium   B(2,0) medium
      //   C(0,2) wide
      //   D(0,3) wide
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
        makeWidget({
          instanceId: "D",
          widgetType: "achievements",
          size: "wide",
          x: 0,
          y: 3,
        }),
      ];
      const before = getOrderedIds(widgets);
      const affected = ["B", "C", "D"]; // A is being dragged

      // Drag A from (0,0) to (0,2) — pushes onto C's position
      const result = stableRepack(widgets, "A", 0, 2);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);

      // A must be at the target position
      const movedA = result!.find((w) => w.instanceId === "A")!;
      expect(movedA.x).toBe(0);
      expect(movedA.y).toBe(2);

      // Affected widgets must preserve relative order
      const after = getOrderedIds(result!);
      assertOrderPreserved(before, after, affected);
    });

    it("preserves order when dragging upward", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
        makeWidget({
          instanceId: "D",
          widgetType: "achievements",
          size: "wide",
          x: 0,
          y: 3,
        }),
      ];
      const before = getOrderedIds(widgets);
      const affected = ["A", "B", "C"]; // D is being dragged

      // Drag D from (0,3) to (0,0) — pushes onto A/B
      const result = stableRepack(widgets, "D", 0, 0);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);

      const movedD = result!.find((w) => w.instanceId === "D")!;
      expect(movedD.x).toBe(0);
      expect(movedD.y).toBe(0);

      const after = getOrderedIds(result!);
      assertOrderPreserved(before, after, affected);
    });

    it("preserves order when dragging across columns", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
      ];
      const before = getOrderedIds(widgets);

      // Drag A from (0,0) to (2,0) — overlaps B
      const result = stableRepack(widgets, "A", 2, 0);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);
      assertOrderPreserved(before, getOrderedIds(result!), ["B", "C"]);
    });

    it("no changes when dragged to same position", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
      ];

      const result = stableRepack(widgets, "A", 0, 0);
      expect(result).not.toBeNull();
      const a = result!.find((w) => w.instanceId === "A")!;
      const b = result!.find((w) => w.instanceId === "B")!;
      expect(a.x).toBe(0);
      expect(a.y).toBe(0);
      expect(b.x).toBe(2);
      expect(b.y).toBe(0);
    });

    it("clamps target to grid bounds", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
      ];
      // Try to drag beyond right edge (medium is 2 wide, col 3+2=5 > 4)
      const result = stableRepack(widgets, "A", 3, 0);
      expect(result).not.toBeNull();
      const a = result!.find((w) => w.instanceId === "A")!;
      expect(a.x).toBe(2); // clamped to GRID_COLUMNS - span.w
    });

    it("returns null for unknown pinnedId", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
      ];
      expect(stableRepack(widgets, "UNKNOWN", 0, 0)).toBeNull();
    });

    it("moves the primary obstructed widget upward when bottom-half hover requests it and supported space exists above", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 2,
          y: 2,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 0,
          y: 2,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 4,
        }),
      ];

      const hint = inferCollisionDisplacementHint(widgets, "A", 0, 2, {
        col: 1,
        row: 3.6,
      });

      expect(hint).toEqual({ obstructedId: "B", direction: "up" });

      const result = stableRepack(widgets, "A", 0, 2, undefined, hint);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);

      const movedB = result!.find((widget) => widget.instanceId === "B")!;
      const unaffectedC = result!.find((widget) => widget.instanceId === "C")!;

      expect(movedB.x).toBe(0);
      expect(movedB.y).toBe(0);
      expect(unaffectedC.x).toBe(0);
      expect(unaffectedC.y).toBe(4);
    });

    it("keeps downward displacement when hovering the top half of the obstructed widget", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 2,
          y: 2,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 0,
          y: 2,
        }),
      ];

      const hint = inferCollisionDisplacementHint(widgets, "A", 0, 2, {
        col: 1,
        row: 2.4,
      });

      expect(hint).toEqual({ obstructedId: "B", direction: "down" });

      const result = stableRepack(widgets, "A", 0, 2, undefined, hint);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);

      const movedB = result!.find((widget) => widget.instanceId === "B")!;
      expect(movedB.x).toBe(0);
      expect(movedB.y).toBe(4);
    });

    it("falls back to downward displacement when upward intent has no valid room above", () => {
      const widgets = [
        makeWidget({
          instanceId: "D",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "A",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 2,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "achievements",
          size: "medium",
          x: 0,
          y: 2,
        }),
      ];

      const hint = inferCollisionDisplacementHint(widgets, "A", 0, 2, {
        col: 1,
        row: 3.6,
      });

      expect(hint).toEqual({ obstructedId: "B", direction: "up" });

      const result = stableRepack(widgets, "A", 0, 2, undefined, hint);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);

      const movedB = result!.find((widget) => widget.instanceId === "B")!;
      expect(movedB.x).toBe(0);
      expect(movedB.y).toBe(4);
    });

    it("prefers the collided widget under the hover probe when multiple widgets overlap", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 2,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 2,
        }),
      ];

      const hint = inferCollisionDisplacementHint(widgets, "A", 0, 2, {
        col: 3,
        row: 3.6,
      });

      expect(hint).toEqual({ obstructedId: "C", direction: "up" });
    });
  });

  // ── stableRepack — Resize Preserves Order ───────────────────────────

  describe("stableRepack — resize", () => {
    it("resize expand pushes widgets downward in order", () => {
      // A(0,0) medium   B(2,0) medium
      // C(0,2) wide
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
      ];
      const before = getOrderedIds(widgets);

      // Resize A from medium(2x2) to wide(4x1) — now overlaps B's column
      const result = stableRepack(widgets, "A", 0, 0, "wide");
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);

      const resizedA = result!.find((w) => w.instanceId === "A")!;
      expect(resizedA.size).toBe("wide");

      assertOrderPreserved(before, getOrderedIds(result!), ["B", "C"]);
    });

    it("resize shrink allows upward compaction", () => {
      // A(0,0) wide
      // B(0,1) medium   C(2,1) medium
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 1,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 1,
        }),
      ];

      // Use resolveResize to resize A from wide to small — frees up columns 2-3
      const result = resolveResize(widgets, "A", "small");
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);
    });

    it("resize from medium to large pushes affected widgets down", () => {
      // B(0,0) medium  C(2,0) medium
      // D(0,2) wide
      const widgets = [
        makeWidget({
          instanceId: "B",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "D",
          widgetType: "achievements",
          size: "wide",
          x: 0,
          y: 2,
        }),
      ];
      const before = getOrderedIds(widgets);

      // Resize B to large(4x2) — occupies all of rows 0-1, displacing C
      const result = stableRepack(widgets, "B", 0, 0, "large");
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);

      // C and D must preserve order
      assertOrderPreserved(before, getOrderedIds(result!), ["C", "D"]);
    });
  });

  // ── Determinism ─────────────────────────────────────────────────────

  describe("determinism", () => {
    it("same input produces same output for stableRepack", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "profile-header",
          size: "hero",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 4,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 4,
        }),
        makeWidget({
          instanceId: "D",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 6,
        }),
      ];

      const result1 = stableRepack(widgets, "B", 0, 0);
      const result2 = stableRepack(widgets, "B", 0, 0);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();

      for (const w of result1!) {
        const match = result2!.find((w2) => w2.instanceId === w.instanceId)!;
        expect(w.x).toBe(match.x);
        expect(w.y).toBe(match.y);
        expect(w.size).toBe(match.size);
      }
    });

    it("same input produces same output for stableCompact", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 5,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 5,
        }),
      ];
      const r1 = stableCompact(widgets);
      const r2 = stableCompact(widgets);
      for (const w of r1) {
        const match = r2.find((w2) => w2.instanceId === w.instanceId)!;
        expect(w.x).toBe(match.x);
        expect(w.y).toBe(match.y);
      }
    });
  });

  // ── No Overlaps ─────────────────────────────────────────────────────

  describe("no overlap invariant", () => {
    it("stableRepack never produces overlapping widgets", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "profile-header",
          size: "hero",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 4,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 4,
        }),
        makeWidget({
          instanceId: "D",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 6,
        }),
        makeWidget({
          instanceId: "E",
          widgetType: "achievements",
          size: "wide",
          x: 0,
          y: 7,
        }),
      ];

      // Drag hero to overlap everything
      const r1 = stableRepack(widgets, "A", 0, 4);
      expect(r1).not.toBeNull();
      assertNoOverlaps(r1!);
      assertBoundsLegal(r1!);

      // Drag medium across
      const r2 = stableRepack(widgets, "B", 2, 4);
      expect(r2).not.toBeNull();
      assertNoOverlaps(r2!);
      assertBoundsLegal(r2!);
    });

    it("stableCompact never produces overlapping widgets", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 5,
        }),
        makeWidget({
          instanceId: "D",
          widgetType: "achievements",
          size: "wide",
          x: 0,
          y: 10,
        }),
      ];
      const result = stableCompact(widgets);
      assertNoOverlaps(result);
      assertBoundsLegal(result);
    });
  });

  // ── Save Path Does Not Reshuffle ────────────────────────────────────

  describe("save path stability", () => {
    it("compactWidgets does not change a valid compact layout", () => {
      // Already compact — no gaps
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
      ];
      const compacted = compactWidgets(widgets);
      for (const w of widgets.filter((w) => w.visible)) {
        const match = compacted.find((w2) => w2.instanceId === w.instanceId)!;
        expect(match.x).toBe(w.x);
        expect(match.y).toBe(w.y);
      }
    });

    it("preview layout is a valid non-overlapping layout (no save-time compact needed)", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
      ];

      // Simulate drag preview
      const preview = stableRepack(widgets, "A", 0, 2);
      expect(preview).not.toBeNull();

      // The preview is already a valid layout — saved as-is on Done.
      // Verify it has no overlaps and all bounds are legal.
      assertNoOverlaps(preview!);
      assertBoundsLegal(preview!);

      // Verify the pinned widget is at the target
      const a = preview!.find((w) => w.instanceId === "A")!;
      expect(a.x).toBe(0);
      expect(a.y).toBe(2);
    });
  });

  // ── Remove / Add / Restore use Stable Compaction ────────────────────

  describe("remove/add/restore use stable compaction", () => {
    it("hideWidget compacts remaining widgets stably", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
      ];
      const result = hideWidget(widgets, "A");
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);

      // B and C should maintain relative order
      const visible = result!.filter((w) => w.visible);
      const ids = getOrderedIds(visible);
      expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("C"));
    });

    it("addWidget places at bottom and compacts", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
      ];
      const result = addWidget(widgets, "social-proof", "wide");
      assertNoOverlaps(result);
      assertBoundsLegal(result);
      expect(result.find((w) => w.widgetType === "social-proof")).toBeDefined();
    });

    it("restoreWidget compacts stably", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 0,
          visible: false,
        }),
      ];
      const result = restoreWidget(widgets, "C");
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);
      const restored = result!.find((w) => w.instanceId === "C")!;
      expect(restored.visible).toBe(true);
    });
  });

  // ── Read-only Viewer Board Unaffected ───────────────────────────────

  describe("read-only viewer board", () => {
    it("stableRepack handles synthetic viewer-actions widget", () => {
      const widgets = [
        makeWidget({
          instanceId: "default-header",
          widgetType: "profile-header",
          size: "hero",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "default-friends",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 4,
        }),
        makeWidget({
          instanceId: "__viewer-actions__",
          widgetType: "viewer-actions",
          size: "large",
          x: 0,
          y: 6,
          pinned: true,
        }),
      ];
      // This is a read-only board, but stableCompact should still work
      // without breaking positions.
      const result = stableCompact(widgets);
      assertNoOverlaps(result);
      assertBoundsLegal(result);
      const viewer = result.find((w) => w.instanceId === "__viewer-actions__")!;
      expect(viewer.visible).toBe(true);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("hero widget interacting with smaller widgets", () => {
      const widgets = [
        makeWidget({
          instanceId: "H",
          widgetType: "profile-header",
          size: "hero",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 4,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 4,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 6,
        }),
      ];
      // Drag hero to row 3 — pushes everything
      const result = stableRepack(widgets, "H", 0, 3);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);

      const h = result!.find((w) => w.instanceId === "H")!;
      expect(h.y).toBe(3);

      // A, B, C must be below hero and in order
      assertOrderPreserved(getOrderedIds(widgets), getOrderedIds(result!), [
        "A",
        "B",
        "C",
      ]);
    });

    it("wide and large widgets interacting", () => {
      const widgets = [
        makeWidget({
          instanceId: "W",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "L",
          widgetType: "profile-stats",
          size: "large",
          x: 0,
          y: 1,
        }),
        makeWidget({
          instanceId: "S",
          widgetType: "friends",
          size: "small",
          x: 0,
          y: 3,
        }),
      ];
      // Resize wide to large
      const result = stableRepack(widgets, "W", 0, 0, "large");
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);
    });

    it("single widget board", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
      ];
      const result = stableRepack(widgets, "A", 2, 3);
      expect(result).not.toBeNull();
      expect(result![0].x).toBe(2);
      expect(result![0].y).toBe(3);
    });

    it("hidden widgets pass through unchanged", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "H",
          widgetType: "badges",
          size: "medium",
          x: 5,
          y: 99,
          visible: false,
        }),
      ];
      const result = stableRepack(widgets, "A", 0, 2);
      expect(result).not.toBeNull();
      const hidden = result!.find((w) => w.instanceId === "H")!;
      expect(hidden.visible).toBe(false);
      expect(hidden.x).toBe(5);
      expect(hidden.y).toBe(99);
    });

    it("repeated edits in one session stay stable", () => {
      let widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
      ];

      // Move A down
      widgets = stableRepack(widgets, "A", 0, 2)!;
      assertNoOverlaps(widgets);

      // Move A back up
      widgets = stableRepack(widgets, "A", 0, 0)!;
      assertNoOverlaps(widgets);

      // Resize B to wide
      widgets = stableRepack(widgets, "B", 0, 0, "wide")!;
      assertNoOverlaps(widgets);
      assertBoundsLegal(widgets);
    });
  });

  // ── resolveConflicts delegates to stableRepack ──────────────────────

  describe("resolveConflicts", () => {
    it("produces the same result as stableRepack", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
      ];
      const rc = resolveConflicts(widgets, "A", 0, 2);
      const sr = stableRepack(widgets, "A", 0, 2);
      expect(rc).toEqual(sr);
    });
  });

  // ── Vacancy Healing During Preview (stableRepack) ────────────────────

  describe("vacancy healing during stableRepack preview", () => {
    it("heals upward when hero is dragged away from top", () => {
      // Default-ish layout: hero(0,0), wide(0,4), medium(0,5), medium(2,5), wide(0,7)
      const widgets = [
        makeWidget({
          instanceId: "H",
          widgetType: "profile-header",
          size: "hero",
          x: 0,
          y: 0,
        }), // 4×4, rows 0-3
        makeWidget({
          instanceId: "W",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 4,
        }), // 4×1, row 4
        makeWidget({
          instanceId: "F",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 5,
        }), // 2×2, rows 5-6
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 5,
        }), // 2×2, rows 5-6
        makeWidget({
          instanceId: "A",
          widgetType: "achievements",
          size: "wide",
          x: 0,
          y: 7,
        }), // 4×1, row 7
      ];

      // Drag hero from top to row 8
      const result = stableRepack(widgets, "H", 0, 8);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);

      // The vacancy at the top must heal: W, F, B, A should all move upward
      const w = result!.find((w) => w.instanceId === "W")!;
      const f = result!.find((w) => w.instanceId === "F")!;
      const b = result!.find((w) => w.instanceId === "B")!;
      const a = result!.find((w) => w.instanceId === "A")!;

      // W (wide) should be at the top (row 0) — vacancy healed
      expect(w.y).toBe(0);
      // F and B should be tightly packed below W
      expect(f.y).toBeLessThan(4);
      expect(b.y).toBeLessThan(4);
      // A should be tightly below F/B
      expect(a.y).toBeLessThan(5);
    });

    it("heals upward when a middle widget is dragged away", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
        makeWidget({
          instanceId: "D",
          widgetType: "achievements",
          size: "wide",
          x: 0,
          y: 3,
        }),
      ];

      // Drag C from (0,2) to (0,6) — should heal the gap at row 2
      const result = stableRepack(widgets, "C", 0, 6);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);

      const d = result!.find((w) => w.instanceId === "D")!;
      // D should have moved up to fill the vacancy (row 2 instead of row 3)
      expect(d.y).toBe(2);
    });

    it("does not move widgets that are already above the affected region", () => {
      // A is above the affected region (hero at top), B and C are affected
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "profile-header",
          size: "hero",
          x: 0,
          y: 0,
        }), // rows 0-3
        makeWidget({
          instanceId: "B",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 4,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 4,
        }),
        makeWidget({
          instanceId: "D",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 6,
        }),
      ];

      // Drag D from (0,6) to (0,8) — A shouldn't move, B/C stay
      const result = stableRepack(widgets, "D", 0, 8);
      expect(result).not.toBeNull();
      const a = result!.find((w) => w.instanceId === "A")!;
      expect(a.x).toBe(0);
      expect(a.y).toBe(0); // unmoved
    });
  });

  // ── Coupled Post-Drop Settlement (settleBoardAfterDrop) ─────────────

  describe("settleBoardAfterDrop — coupled settlement", () => {
    it("keeps the active widget at the final drop target", () => {
      // A at row 0, B at row 0 — drop C at row 6
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }), // 2×2, rows 0-1
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }), // 2×2, rows 0-1
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 6,
        }), // 4×1, row 6 (dropped too low)
      ];

      const result = settleBoardAfterDrop(widgets, "C", 0, 6);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);

      const c = result!.find((w) => w.instanceId === "C")!;
      // C should stay exactly where the user dropped it.
      expect(c.y).toBe(6);
    });

    it("keeps a low drop stable without moving unrelated widgets", () => {
      // Simulate: A(0,0 medium), B(2,0 medium), then C dropped at row 5
      // with D already below C at row 7 after stableRepack
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
        makeWidget({
          instanceId: "D",
          widgetType: "achievements",
          size: "wide",
          x: 0,
          y: 3,
        }),
      ];

      // Drag D to row 8 and settle
      const result = settleBoardAfterDrop(widgets, "D", 0, 8);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);

      // D should remain at the final user-selected slot.
      const d = result!.find((w) => w.instanceId === "D")!;
      expect(d.y).toBe(8);

      // The earlier widgets remain untouched.
      const a = result!.find((w) => w.instanceId === "A")!;
      const b = result!.find((w) => w.instanceId === "B")!;
      const c = result!.find((w) => w.instanceId === "C")!;
      expect(a.y).toBe(0);
      expect(b.y).toBe(0);
      expect(c.y).toBe(2);
    });

    it("hero dragged from top: vacancy heals while hero stays at drop target", () => {
      const widgets = [
        makeWidget({
          instanceId: "H",
          widgetType: "profile-header",
          size: "hero",
          x: 0,
          y: 0,
        }), // 4×4
        makeWidget({
          instanceId: "W",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 4,
        }), // 4×1
        makeWidget({
          instanceId: "F",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 5,
        }), // 2×2
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 5,
        }), // 2×2
      ];

      // Drop hero at row 10 (way too low)
      const result = settleBoardAfterDrop(widgets, "H", 0, 10);
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);

      // W, F, B should heal upward to the top
      const w = result!.find((w) => w.instanceId === "W")!;
      expect(w.y).toBe(0); // healed to top

      // H should stay exactly where it was dropped.
      const h = result!.find((w) => w.instanceId === "H")!;
      expect(h.y).toBe(10);
    });

    it("preserves stable visual order through settlement", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
        makeWidget({
          instanceId: "D",
          widgetType: "achievements",
          size: "wide",
          x: 0,
          y: 3,
        }),
      ];

      // Drag A to row 5
      const result = settleBoardAfterDrop(widgets, "A", 0, 5);
      expect(result).not.toBeNull();

      // B, C, D should remain in their original relative order
      const before = getOrderedIds(widgets);
      const after = getOrderedIds(result!);
      assertOrderPreserved(before, after, ["B", "C", "D"]);
    });

    it("no overlaps after settlement in dense mixed-size layout", () => {
      const widgets = [
        makeWidget({
          instanceId: "H",
          widgetType: "profile-header",
          size: "hero",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "W",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 4,
        }),
        makeWidget({
          instanceId: "F",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 5,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 5,
        }),
        makeWidget({
          instanceId: "A",
          widgetType: "achievements",
          size: "wide",
          x: 0,
          y: 7,
        }),
      ];

      // Drag hero into the middle
      const r1 = settleBoardAfterDrop(widgets, "H", 0, 5);
      expect(r1).not.toBeNull();
      assertNoOverlaps(r1!);
      assertBoundsLegal(r1!);

      // Drag wide widget around
      const r2 = settleBoardAfterDrop(widgets, "W", 0, 0);
      expect(r2).not.toBeNull();
      assertNoOverlaps(r2!);
      assertBoundsLegal(r2!);

      // Drag medium through dense area
      const r3 = settleBoardAfterDrop(widgets, "F", 2, 4);
      expect(r3).not.toBeNull();
      assertNoOverlaps(r3!);
      assertBoundsLegal(r3!);
    });

    it("no settlement needed when already optimal", () => {
      // Tightly packed — settlement should not move anything
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 2,
        }),
      ];

      // Drop A at its same position
      const result = settleBoardAfterDrop(widgets, "A", 0, 0);
      expect(result).not.toBeNull();
      const a = result!.find((w) => w.instanceId === "A")!;
      const b = result!.find((w) => w.instanceId === "B")!;
      const c = result!.find((w) => w.instanceId === "C")!;
      expect(a.x).toBe(0);
      expect(a.y).toBe(0);
      expect(b.x).toBe(2);
      expect(b.y).toBe(0);
      expect(c.x).toBe(0);
      expect(c.y).toBe(2);
    });

    it("returns null for unknown droppedId", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
      ];
      expect(settleBoardAfterDrop(widgets, "NONEXISTENT", 0, 0)).toBeNull();
    });

    it("is deterministic — same input always produces same output", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 0,
          y: 5,
        }),
      ];
      const r1 = settleBoardAfterDrop(widgets, "B", 0, 5);
      const r2 = settleBoardAfterDrop(widgets, "B", 0, 5);
      expect(r1).toEqual(r2);
    });

    it("save path must not compact the exact settled result", () => {
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 0,
        }),
        makeWidget({
          instanceId: "C",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 6,
        }),
      ];

      const settled = settleBoardAfterDrop(widgets, "C", 0, 6);
      expect(settled).not.toBeNull();

      // stableCompact would rewrite the intentional low drop, which is why
      // the save path must persist the settled layout as-is.
      const recompacted = stableCompact(settled!);
      expect(recompacted).not.toEqual(settled);

      const settledC = settled!.find((w) => w.instanceId === "C")!;
      const compactedC = recompacted.find((w) => w.instanceId === "C")!;
      expect(settledC.y).toBe(6);
      expect(compactedC.y).toBe(2);
    });

    it("resize shrink allows upward compaction of suffix", () => {
      // A(wide) at row 0, B(medium) at row 1, C(medium) at row 3
      const widgets = [
        makeWidget({
          instanceId: "A",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 0,
        }), // 4×1
        makeWidget({
          instanceId: "B",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 1,
        }), // 2×2
        makeWidget({
          instanceId: "C",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 1,
        }), // 2×2
      ];

      // "Resize" A from wide to small using settleBoardAfterDrop with targetSize
      const result = settleBoardAfterDrop(widgets, "A", 0, 0, "small");
      expect(result).not.toBeNull();
      assertNoOverlaps(result!);
      assertBoundsLegal(result!);

      // A should be small (2×1), and B could move up beside it
      const a = result!.find((w) => w.instanceId === "A")!;
      expect(a.size).toBe("small");
    });

    it("heals widgets that only lose support after earlier widgets settle", () => {
      const widgets = [
        makeWidget({
          instanceId: "H",
          widgetType: "profile-header",
          size: "hero",
          x: 0,
          y: 0,
        }),
        makeWidget({
          instanceId: "W",
          widgetType: "social-proof",
          size: "wide",
          x: 0,
          y: 4,
        }),
        makeWidget({
          instanceId: "F",
          widgetType: "friends",
          size: "medium",
          x: 0,
          y: 5,
        }),
        makeWidget({
          instanceId: "B",
          widgetType: "badges",
          size: "medium",
          x: 2,
          y: 5,
        }),
        makeWidget({
          instanceId: "A",
          widgetType: "achievements",
          size: "wide",
          x: 0,
          y: 7,
        }),
      ];

      const result = settleBoardAfterDrop(widgets, "H", 0, 10);
      expect(result).not.toBeNull();

      const w = result!.find((widget) => widget.instanceId === "W")!;
      const f = result!.find((widget) => widget.instanceId === "F")!;
      const b = result!.find((widget) => widget.instanceId === "B")!;
      const a = result!.find((widget) => widget.instanceId === "A")!;

      expect(w.y).toBe(0);
      expect(f.y).toBe(1);
      expect(b.y).toBe(1);
      expect(a.y).toBe(3);
    });
  });
});

describe("Widget board preview commit helpers", () => {
  it("treats matching hover targets as equal", () => {
    expect(
      isSameDragHoverTarget(
        {
          id: "A",
          x: 0,
          y: 2,
          collisionHint: { obstructedId: "B", direction: "up" },
        },
        {
          id: "A",
          x: 0,
          y: 2,
          collisionHint: { obstructedId: "B", direction: "up" },
        },
      ),
    ).toBe(true);
    expect(
      isSameDragHoverTarget(
        {
          id: "A",
          x: 0,
          y: 2,
          collisionHint: { obstructedId: "B", direction: "up" },
        },
        {
          id: "A",
          x: 0,
          y: 2,
          collisionHint: { obstructedId: "B", direction: "down" },
        },
      ),
    ).toBe(false);
    expect(
      isSameDragHoverTarget({ id: "A", x: 0, y: 2 }, { id: "A", x: 2, y: 2 }),
    ).toBe(false);
  });

  it("recomputes drag commit from the final hover target instead of an older preview branch, even when only directional intent changed", () => {
    const widgets = [
      makeWidget({
        instanceId: "A",
        widgetType: "friends",
        size: "medium",
        x: 2,
        y: 2,
      }),
      makeWidget({
        instanceId: "B",
        widgetType: "badges",
        size: "medium",
        x: 0,
        y: 2,
      }),
      makeWidget({
        instanceId: "C",
        widgetType: "social-proof",
        size: "wide",
        x: 0,
        y: 4,
      }),
    ];

    const stalePreview = stableRepack(widgets, "A", 0, 2, undefined, {
      obstructedId: "B",
      direction: "down",
    });
    const committed = resolveCommittedPreviewLayout(
      widgets,
      {
        kind: "drag",
        target: {
          id: "A",
          x: 0,
          y: 2,
          collisionHint: { obstructedId: "B", direction: "down" },
        },
      },
      stalePreview,
      {
        id: "A",
        x: 0,
        y: 2,
        collisionHint: { obstructedId: "B", direction: "up" },
      },
    );

    const expected = settleBoardAfterDrop(widgets, "A", 0, 2, undefined, {
      obstructedId: "B",
      direction: "up",
    });

    expect(committed).toEqual(expected);
    expect(committed).not.toEqual(stalePreview);
  });
});
