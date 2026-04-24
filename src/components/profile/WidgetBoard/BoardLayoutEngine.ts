/**
 * Board Layout Engine
 *
 * Deterministic grid packing, occupancy tracking, placement validation,
 * and compaction for the profile widget board.
 *
 * The grid is GRID_COLUMNS wide. Rows are normalized through a packed
 * "reversed gravity" resolver so empty vertical space collapses upward.
 * Each cell is either empty (null) or occupied by a widget instanceId.
 *
 * @module components/profile/WidgetBoard/BoardLayoutEngine
 */

import {
  CELL_HEIGHT,
  GRID_COLUMNS,
  GRID_GUTTER,
  SIZE_PRESETS,
  type CollisionDisplacementHint,
  type DragHoverProbe,
  type GridRect,
  type OccupancyCell,
  type WidgetInstance,
  type WidgetSizeKey,
  type WidgetSpan,
} from "./types";

/**
 * Temporary drag targets are allowed to move a little beyond the current
 * content so the user can express "place this near the end", but the final
 * packed layout must not grow unbounded just because the finger keeps moving.
 */
const DRAG_TARGET_ROW_BUFFER = 6;

// =============================================================================
// Occupancy Map
// =============================================================================

/**
 * Build a 2D occupancy grid from a list of visible widgets.
 * Returns a flat array indexed as [row * GRID_COLUMNS + col].
 * The array is sized to accommodate the tallest widget's bottom edge.
 */
export function buildOccupancyMap(widgets: WidgetInstance[]): OccupancyCell[] {
  const visibleWidgets = widgets.filter((w) => w.visible);
  if (visibleWidgets.length === 0) return [];

  // Determine grid height needed
  let maxRow = 0;
  for (const w of visibleWidgets) {
    const span = SIZE_PRESETS[w.size];
    const bottom = w.y + span.h;
    if (bottom > maxRow) maxRow = bottom;
  }

  // Initialize empty grid
  const grid: OccupancyCell[] = new Array(maxRow * GRID_COLUMNS).fill(null);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = { instanceId: null };
  }

  // Fill occupied cells
  for (const w of visibleWidgets) {
    const span = SIZE_PRESETS[w.size];
    for (let row = w.y; row < w.y + span.h; row++) {
      for (let col = w.x; col < w.x + span.w; col++) {
        const idx = row * GRID_COLUMNS + col;
        if (idx < grid.length) {
          grid[idx] = { instanceId: w.instanceId };
        }
      }
    }
  }

  return grid;
}

/** Get total rows in an occupancy map. */
export function getGridRows(grid: OccupancyCell[]): number {
  return Math.ceil(grid.length / GRID_COLUMNS);
}

// =============================================================================
// Placement Validation
// =============================================================================

/**
 * Check whether a rectangle fits at (x, y) without overlapping any
 * widget except `ignoreId` (the widget being moved).
 */
export function canPlace(
  grid: OccupancyCell[],
  rect: GridRect,
  ignoreId?: string,
): boolean {
  const { x, y, w, h } = rect;

  // Bounds check
  if (x < 0 || y < 0 || x + w > GRID_COLUMNS) return false;

  const totalRows = getGridRows(grid);

  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      if (row >= totalRows) continue; // empty beyond current grid → OK
      const idx = row * GRID_COLUMNS + col;
      const cell = grid[idx];
      if (cell && cell.instanceId !== null && cell.instanceId !== ignoreId) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Find the nearest valid position for a widget of a given span,
 * starting from the desired (targetX, targetY) and scanning outward.
 */
export function findNearestSlot(
  grid: OccupancyCell[],
  span: WidgetSpan,
  targetX: number,
  targetY: number,
  ignoreId?: string,
): { x: number; y: number } | null {
  // Clamp target within column bounds
  const maxX = GRID_COLUMNS - span.w;
  const clampedX = Math.max(0, Math.min(targetX, maxX));
  const clampedY = Math.max(0, targetY);

  // Try exact position first
  if (
    canPlace(grid, { x: clampedX, y: clampedY, w: span.w, h: span.h }, ignoreId)
  ) {
    return { x: clampedX, y: clampedY };
  }

  // Spiral outward from the target
  const maxSearchRadius = 20;
  for (let radius = 1; radius <= maxSearchRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const cx = clampedX + dx;
        const cy = clampedY + dy;
        if (cx < 0 || cy < 0 || cx + span.w > GRID_COLUMNS) continue;
        if (canPlace(grid, { x: cx, y: cy, w: span.w, h: span.h }, ignoreId)) {
          return { x: cx, y: cy };
        }
      }
    }
  }

  // Fallback: place at the bottom of the grid
  const totalRows = getGridRows(grid);
  for (let x = 0; x <= GRID_COLUMNS - span.w; x++) {
    if (canPlace(grid, { x, y: totalRows, w: span.w, h: span.h }, ignoreId)) {
      return { x, y: totalRows };
    }
  }

  return null;
}

// =============================================================================
// Stable Reflow Engine
// =============================================================================

/**
 * Return visible widgets in deterministic visual order:
 * primary: y ascending, secondary: x ascending, tertiary: instanceId.
 */
function compareWidgetsInVisualOrder(
  left: WidgetInstance,
  right: WidgetInstance,
): number {
  if (left.y !== right.y) return left.y - right.y;
  if (left.x !== right.x) return left.x - right.x;
  return left.instanceId.localeCompare(right.instanceId);
}

export function getVisualOrder(widgets: WidgetInstance[]): WidgetInstance[] {
  return [...widgets]
    .filter((w) => w.visible)
    .sort(compareWidgetsInVisualOrder);
}

/** Get the grid rectangle for a widget (position + span). */
export function getWidgetRect(widget: WidgetInstance): GridRect {
  const span = SIZE_PRESETS[widget.size];
  return { x: widget.x, y: widget.y, w: span.w, h: span.h };
}

/** Check if two grid rectangles overlap. */
function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/** Check whether a fractional grid-space point lies inside a grid rect. */
function rectContainsPoint(rect: GridRect, col: number, row: number): boolean {
  return (
    col >= rect.x &&
    col < rect.x + rect.w &&
    row >= rect.y &&
    row < rect.y + rect.h
  );
}

/** Compute the overlap area between two rects in grid cells. */
function getOverlapArea(left: GridRect, right: GridRect): number {
  const overlapWidth =
    Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x);
  const overlapHeight =
    Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y);

  if (overlapWidth <= 0 || overlapHeight <= 0) return 0;
  return overlapWidth * overlapHeight;
}

/** Compute the vertical midpoint of the overlapping region between two rects. */
function getOverlapMidRow(left: GridRect, right: GridRect): number {
  const overlapTop = Math.max(left.y, right.y);
  const overlapBottom = Math.min(left.y + left.h, right.y + right.h);
  return overlapTop + (overlapBottom - overlapTop) / 2;
}

/** Get the bottom edge (max row) of placed visible widgets. */
function getMaxPlacedRow(placed: WidgetInstance[]): number {
  let max = 0;
  for (const w of placed) {
    if (!w.visible) continue;
    const span = SIZE_PRESETS[w.size];
    const bottom = w.y + span.h;
    if (bottom > max) max = bottom;
  }
  return max;
}

/**
 * Infer which obstructed widget is under the user's drag pressure and whether
 * the hover is expressing an upward or downward displacement request.
 *
 * The probe is continuous grid-space metadata captured during drag, so the
 * board can distinguish top-half vs bottom-half hover even when the snapped
 * target slot stays the same.
 */
export function inferCollisionDisplacementHint(
  widgets: WidgetInstance[],
  draggedId: string,
  targetX: number,
  targetY: number,
  hoverProbe: DragHoverProbe,
  targetSize?: WidgetSizeKey,
): CollisionDisplacementHint | null {
  const visible = widgets.filter((widget) => widget.visible);
  const dragged = visible.find((widget) => widget.instanceId === draggedId);
  if (!dragged) return null;

  const newSize = targetSize ?? dragged.size;
  const newSpan = SIZE_PRESETS[newSize];
  const pinnedRect: GridRect = {
    x: Math.max(0, Math.min(targetX, GRID_COLUMNS - newSpan.w)),
    y: Math.max(0, targetY),
    w: newSpan.w,
    h: newSpan.h,
  };

  const fallbackProbeCol = pinnedRect.x + pinnedRect.w / 2;
  const fallbackProbeRow = pinnedRect.y + pinnedRect.h / 2;
  const probeCol = Number.isFinite(hoverProbe.col)
    ? hoverProbe.col
    : fallbackProbeCol;
  const probeRow = Number.isFinite(hoverProbe.row)
    ? hoverProbe.row
    : fallbackProbeRow;

  const collisions = visible
    .filter((widget) => widget.instanceId !== draggedId)
    .map((widget) => {
      const rect = getWidgetRect(widget);
      return {
        widget,
        rect,
        overlapArea: getOverlapArea(pinnedRect, rect),
        containsProbe: rectContainsPoint(rect, probeCol, probeRow),
      };
    })
    .filter((candidate) => candidate.overlapArea > 0)
    .sort((left, right) => {
      if (left.containsProbe !== right.containsProbe) {
        return left.containsProbe ? -1 : 1;
      }
      if (left.overlapArea !== right.overlapArea) {
        return right.overlapArea - left.overlapArea;
      }
      return compareWidgetsInVisualOrder(left.widget, right.widget);
    });

  const primaryCollision = collisions[0];
  if (!primaryCollision) return null;

  const obstructedSpan = SIZE_PRESETS[primaryCollision.widget.size];
  const obstructedMidRow = primaryCollision.widget.y + obstructedSpan.h / 2;
  const referenceRow = primaryCollision.containsProbe
    ? probeRow
    : getOverlapMidRow(pinnedRect, primaryCollision.rect);

  return {
    obstructedId: primaryCollision.widget.instanceId,
    direction: referenceRow > obstructedMidRow ? "up" : "down",
  };
}

/**
 * Find the topmost valid packed position for a widget.
 *
 * This is row-first: for each row it tries the preferred column, then every
 * other legal column. This is what makes lateral swaps/reflows possible. A
 * widget will choose an open same-row side slot before falling to a lower row
 * in its original column.
 */
function findPackedPosition(
  placed: WidgetInstance[],
  preferredX: number,
  span: WidgetSpan,
): { x: number; y: number } {
  const grid = buildOccupancyMap(placed);
  const maxX = GRID_COLUMNS - span.w;
  const clampedPreferredX = Math.max(0, Math.min(preferredX, maxX));
  const maxRow = getMaxPlacedRow(placed) + DRAG_TARGET_ROW_BUFFER + 20;

  for (let row = 0; row <= maxRow; row++) {
    if (
      canPlace(grid, {
        x: clampedPreferredX,
        y: row,
        w: span.w,
        h: span.h,
      })
    ) {
      return { x: clampedPreferredX, y: row };
    }

    for (let col = 0; col <= maxX; col++) {
      if (col === clampedPreferredX) continue;
      if (canPlace(grid, { x: col, y: row, w: span.w, h: span.h })) {
        return { x: col, y: row };
      }
    }
  }

  return { x: 0, y: getMaxPlacedRow(placed) };
}

function packOrderedWidgets(
  orderedVisible: WidgetInstance[],
  hidden: WidgetInstance[],
): WidgetInstance[] {
  const placed: WidgetInstance[] = [];

  for (const widget of orderedVisible) {
    const span = SIZE_PRESETS[widget.size];
    let preferredX = widget.x;
    if (preferredX + span.w > GRID_COLUMNS) {
      preferredX = Math.max(0, GRID_COLUMNS - span.w);
    }

    const pos = findPackedPosition(placed, preferredX, span);
    placed.push({ ...widget, x: pos.x, y: pos.y });
  }

  return [...placed, ...hidden];
}

/**
 * Stable repack with an active widget.
 *
 * Used for drag preview, drag commit, resize preview, and resize commit.
 *
 * Phase 1 builds a staged layout where the active widget's target expresses
 * intended order and preferred column. If the active widget collides with a
 * peer that can fit in the active widget's vacated slot, that peer is staged
 * there so side-by-side widgets swap laterally instead of cascading downward.
 *
 * Phase 2 packs every visible widget in staged visual order. The active widget
 * is not exempt from compaction: it settles into the highest valid position
 * available for its order/preferred column.
 *
 * Deterministic: same input always produces the same output.
 */
export function stableRepack(
  widgets: WidgetInstance[],
  pinnedId: string,
  targetX: number,
  targetY: number,
  targetSize?: WidgetSizeKey,
  collisionHint?: CollisionDisplacementHint | null,
): WidgetInstance[] | null {
  const visible = widgets.filter((w) => w.visible);
  const hidden = widgets.filter((w) => !w.visible);

  const pinned = visible.find((w) => w.instanceId === pinnedId);
  if (!pinned) return null;

  const oldPinnedSpan = SIZE_PRESETS[pinned.size];
  const oldPinnedRect: GridRect = {
    x: pinned.x,
    y: pinned.y,
    w: oldPinnedSpan.w,
    h: oldPinnedSpan.h,
  };

  // Compute the active widget's staged rect. The row is bounded as a drag
  // target, but the final packed row is decided by packOrderedWidgets().
  const newSize = targetSize ?? pinned.size;
  const newSpan = SIZE_PRESETS[newSize];
  const maxTargetY =
    getMaxPlacedRow(visible.filter((widget) => widget.instanceId !== pinnedId)) +
    DRAG_TARGET_ROW_BUFFER;
  const cx = Math.max(0, Math.min(targetX, GRID_COLUMNS - newSpan.w));
  const cy = Math.max(0, Math.min(targetY, maxTargetY));
  const pinnedPlaced: WidgetInstance = {
    ...pinned,
    x: cx,
    y: cy,
    size: newSize,
  };

  const newPinnedRect = getWidgetRect(pinnedPlaced);
  const colliding = visible
    .filter((widget) => widget.instanceId !== pinnedId)
    .map((widget) => ({
      widget,
      overlapArea: getOverlapArea(newPinnedRect, getWidgetRect(widget)),
    }))
    .filter((candidate) => candidate.overlapArea > 0)
    .sort((left, right) => {
      if (left.widget.instanceId === collisionHint?.obstructedId) return -1;
      if (right.widget.instanceId === collisionHint?.obstructedId) return 1;
      if (left.overlapArea !== right.overlapArea) {
        return right.overlapArea - left.overlapArea;
      }
      return compareWidgetsInVisualOrder(left.widget, right.widget);
    });

  const primaryCollision = colliding[0]?.widget ?? null;
  const staged = visible.map((widget) => {
    if (widget.instanceId === pinnedId) return pinnedPlaced;

    if (primaryCollision?.instanceId === widget.instanceId) {
      const span = SIZE_PRESETS[widget.size];
      const othersForVacatedSlot = visible.filter(
        (candidate) =>
          candidate.instanceId !== pinnedId &&
          candidate.instanceId !== widget.instanceId,
      );
      const grid = buildOccupancyMap(othersForVacatedSlot);
      const canUseVacatedSlot =
        oldPinnedRect.w >= span.w &&
        oldPinnedRect.x + span.w <= GRID_COLUMNS &&
        canPlace(grid, {
          x: oldPinnedRect.x,
          y: oldPinnedRect.y,
          w: span.w,
          h: span.h,
        });

      if (canUseVacatedSlot) {
        return { ...widget, x: oldPinnedRect.x, y: oldPinnedRect.y };
      }

      if (collisionHint?.obstructedId === widget.instanceId) {
        return {
          ...widget,
          y:
            collisionHint.direction === "up"
              ? Math.max(0, cy - span.h)
              : cy + newSpan.h,
        };
      }
    }

    return widget;
  });

  const ordered = [...staged].sort((left, right) => {
    if (
      primaryCollision &&
      ((left.instanceId === pinnedId &&
        right.instanceId === primaryCollision.instanceId) ||
        (right.instanceId === pinnedId &&
          left.instanceId === primaryCollision.instanceId))
    ) {
      const primaryFirst =
        collisionHint?.obstructedId === primaryCollision.instanceId &&
        collisionHint.direction === "up";
      if (left.instanceId === primaryCollision.instanceId) {
        return primaryFirst ? -1 : 1;
      }
      if (right.instanceId === primaryCollision.instanceId) {
        return primaryFirst ? 1 : -1;
      }
    }

    return compareWidgetsInVisualOrder(left, right);
  });

  return packOrderedWidgets(ordered, hidden);
}

/**
 * Stable compact (gravity) without an active drag/resize target.
 *
 * Used after remove, restore, add, and as the general compaction.
 * Processes all visible widgets in visual order and packs each one
 * at the topmost valid position, preferring the widget's current column.
 *
 * Deterministic: same input always produces the same output.
 */
export function stableCompact(widgets: WidgetInstance[]): WidgetInstance[] {
  const ordered = getVisualOrder(widgets);
  const hidden = widgets.filter((w) => !w.visible);
  return packOrderedWidgets(ordered, hidden);
}

// =============================================================================
// Compaction (public API — delegates to stableCompact)
// =============================================================================

/**
 * Compact all visible widgets upward (vertical gravity) while preserving
 * each widget's horizontal (x) position when possible.
 *
 * Deterministic: same input always produces the same output.
 * Returns a new widget array with updated x,y positions.
 */
export function compactWidgets(widgets: WidgetInstance[]): WidgetInstance[] {
  return stableCompact(widgets);
}

// =============================================================================
// Coupled Post-Drop Settlement
// =============================================================================

/**
 * Settle the board after a drag-drop or resize commit.
 *
 * Delegates to stableRepack, which resolves local drag intent and then
 * globally packs every visible widget upward. The dropped widget settles
 * with the rest of the board instead of preserving an arbitrary low row.
 *
 * Deterministic: same input always produces the same output.
 */
export function settleBoardAfterDrop(
  widgets: WidgetInstance[],
  droppedId: string,
  targetX: number,
  targetY: number,
  targetSize?: WidgetSizeKey,
  collisionHint?: CollisionDisplacementHint | null,
): WidgetInstance[] | null {
  return stableRepack(
    widgets,
    droppedId,
    targetX,
    targetY,
    targetSize,
    collisionHint,
  );
}

// =============================================================================
// Drag Target Calculation
// =============================================================================

/**
 * Given pixel offset of a drag gesture, convert to grid slot coordinates.
 * `boardWidth` is the available pixel width of the board.
 */
export function pixelToGrid(
  pixelX: number,
  pixelY: number,
  boardWidth: number,
): { col: number; row: number } {
  const cellWidth =
    (boardWidth - (GRID_COLUMNS - 1) * GRID_GUTTER) / GRID_COLUMNS;
  const col = Math.round(pixelX / (cellWidth + GRID_GUTTER));
  const row = Math.round(pixelY / (CELL_HEIGHT + GRID_GUTTER));
  return {
    col: Math.max(0, Math.min(col, GRID_COLUMNS - 1)),
    row: Math.max(0, row),
  };
}

/**
 * Convert grid coordinates to pixel position for layout.
 */
export function gridToPixel(
  col: number,
  row: number,
  boardWidth: number,
): { x: number; y: number } {
  const cellWidth =
    (boardWidth - (GRID_COLUMNS - 1) * GRID_GUTTER) / GRID_COLUMNS;
  return {
    x: col * (cellWidth + GRID_GUTTER),
    y: row * (CELL_HEIGHT + GRID_GUTTER),
  };
}

/**
 * Get the pixel dimensions for a widget given its size key and board width.
 */
export function getWidgetPixelSize(
  sizeKey: WidgetSizeKey,
  boardWidth: number,
): { width: number; height: number } {
  const span = SIZE_PRESETS[sizeKey];
  const cellWidth =
    (boardWidth - (GRID_COLUMNS - 1) * GRID_GUTTER) / GRID_COLUMNS;
  return {
    width: span.w * cellWidth + (span.w - 1) * GRID_GUTTER,
    height: span.h * CELL_HEIGHT + (span.h - 1) * GRID_GUTTER,
  };
}

// =============================================================================
// Default Layout
// =============================================================================

/**
 * Generate the default board layout for a new user.
 * Places all mandatory and default-visible widgets in a sensible arrangement.
 */
export function generateDefaultLayout(): WidgetInstance[] {
  const now = new Date().toISOString();
  return [
    {
      instanceId: "default-header",
      widgetType: "profile-header",
      size: "hero",
      x: 0,
      y: 0,
      visible: true,
      pinned: false,
      config: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      instanceId: "default-social-proof",
      widgetType: "social-proof",
      size: "wide",
      x: 0,
      y: 4,
      visible: true,
      pinned: false,
      config: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      instanceId: "default-friends",
      widgetType: "friends",
      size: "medium",
      x: 0,
      y: 5,
      visible: true,
      pinned: false,
      config: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      instanceId: "default-badges",
      widgetType: "badges",
      size: "medium",
      x: 2,
      y: 5,
      visible: true,
      pinned: false,
      config: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      instanceId: "default-achievements",
      widgetType: "achievements",
      size: "wide",
      x: 0,
      y: 7,
      visible: true,
      pinned: false,
      config: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      instanceId: "default-tasks-overview",
      widgetType: "tasks-overview",
      size: "wide",
      x: 0,
      y: 8,
      visible: true,
      pinned: false,
      config: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      instanceId: "default-wallet-balance",
      widgetType: "wallet-balance",
      size: "small",
      x: 0,
      y: 9,
      visible: true,
      pinned: false,
      config: {},
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// =============================================================================
// Live Reflow — Stable Conflict Resolution During Drag
// =============================================================================

/**
 * Resolve a drag preview layout using the stable repack engine.
 *
 * The dragged widget's target is used as an ordering/preferred-column signal.
 * The full visible layout is then packed upward into a stable non-overlapping
 * arrangement.
 *
 * Returns a new widget array representing the preview layout, or `null`
 * if the dragged widget is not found.
 */
export function resolveConflicts(
  widgets: WidgetInstance[],
  draggedId: string,
  targetX: number,
  targetY: number,
  collisionHint?: CollisionDisplacementHint | null,
): WidgetInstance[] | null {
  return stableRepack(
    widgets,
    draggedId,
    targetX,
    targetY,
    undefined,
    collisionHint,
  );
}

/**
 * Resolve a resize preview using the stable repack engine.
 *
 * The widget is given `newSize` and stays anchored at its current top-left
 * (clamped if the new span exceeds grid bounds). All other visible widgets
 * are repacked in stable visual order.
 */
export function resolveResize(
  widgets: WidgetInstance[],
  instanceId: string,
  newSize: WidgetSizeKey,
): WidgetInstance[] | null {
  const idx = widgets.findIndex((w) => w.instanceId === instanceId);
  if (idx === -1) return null;

  const widget = widgets[idx];
  const newSpan = SIZE_PRESETS[newSize];

  // Clamp x if the new size exceeds grid bounds
  let newX = widget.x;
  if (newX + newSpan.w > GRID_COLUMNS) {
    newX = Math.max(0, GRID_COLUMNS - newSpan.w);
  }

  return stableRepack(widgets, instanceId, newX, widget.y, newSize);
}

// =============================================================================
// Move Widget
// =============================================================================

/**
 * Move a widget to a new position, resolving any conflicts with
 * neighboring widgets and compacting afterward.
 * Returns the updated widgets array, or null if the move is invalid.
 */
export function moveWidget(
  widgets: WidgetInstance[],
  instanceId: string,
  newX: number,
  newY: number,
): WidgetInstance[] | null {
  const idx = widgets.findIndex((w) => w.instanceId === instanceId);
  if (idx === -1) return null;

  const widget = widgets[idx];
  const span = SIZE_PRESETS[widget.size];

  // Bounds check
  if (newX < 0 || newX + span.w > GRID_COLUMNS || newY < 0) return null;

  // Use conflict resolution to handle overlaps instead of failing
  const result = resolveConflicts(widgets, instanceId, newX, newY);
  if (!result) return null;

  // Update timestamps on the moved widget
  return result.map((w) =>
    w.instanceId === instanceId
      ? { ...w, updatedAt: new Date().toISOString() }
      : w,
  );
}

// =============================================================================
// Resize Widget
// =============================================================================

/**
 * Resize a widget to a new size, resolving conflicts and compacting.
 * Returns updated widgets array, or null if the resize is invalid.
 */
export function resizeWidget(
  widgets: WidgetInstance[],
  instanceId: string,
  newSize: WidgetSizeKey,
): WidgetInstance[] | null {
  const result = resolveResize(widgets, instanceId, newSize);
  if (!result) return null;

  // Update timestamps on the resized widget
  return result.map((w) =>
    w.instanceId === instanceId
      ? { ...w, updatedAt: new Date().toISOString() }
      : w,
  );
}

// =============================================================================
// Remove / Restore Widget
// =============================================================================

/** Hide a widget (set visible=false) and compact. */
export function hideWidget(
  widgets: WidgetInstance[],
  instanceId: string,
): WidgetInstance[] | null {
  const idx = widgets.findIndex((w) => w.instanceId === instanceId);
  if (idx === -1) return null;

  const updated = [...widgets];
  updated[idx] = {
    ...widgets[idx],
    visible: false,
    updatedAt: new Date().toISOString(),
  };

  return compactWidgets(updated);
}

/** Restore a hidden widget and compact using stable reflow. */
export function restoreWidget(
  widgets: WidgetInstance[],
  instanceId: string,
): WidgetInstance[] | null {
  const idx = widgets.findIndex((w) => w.instanceId === instanceId);
  if (idx === -1) return null;

  const widget = widgets[idx];

  // Make the widget visible with a provisional position at the grid bottom
  // so that stableCompact places it in the best gap.
  const visibleOnly = widgets.filter((w) => w.visible);
  const bottomRow = getMaxPlacedRow(visibleOnly);

  const updated = [...widgets];
  updated[idx] = {
    ...widget,
    visible: true,
    x: widget.x,
    y: bottomRow,
    updatedAt: new Date().toISOString(),
  };

  return stableCompact(updated);
}

// =============================================================================
// Add New Widget
// =============================================================================

/** Add a new widget instance to the board using stable compaction. */
export function addWidget(
  widgets: WidgetInstance[],
  widgetType: WidgetInstance["widgetType"],
  size: WidgetSizeKey,
  config: WidgetInstance["config"] = {},
): WidgetInstance[] {
  // If a hidden instance of this type exists, restore it instead of creating
  // a duplicate. This makes "add from normal section" behave identically to
  // "Restore Hidden".
  const existingHidden = widgets.find(
    (w) => w.widgetType === widgetType && !w.visible,
  );
  if (existingHidden) {
    return restoreWidget(widgets, existingHidden.instanceId) ?? widgets;
  }

  // Guard: don't add duplicate if a visible instance already exists
  const existingVisible = widgets.find(
    (w) => w.widgetType === widgetType && w.visible,
  );
  if (existingVisible) return widgets;

  const bottomRow = getMaxPlacedRow(widgets.filter((w) => w.visible));

  const now = new Date().toISOString();
  const newWidget: WidgetInstance = {
    instanceId: `${widgetType}-${Date.now()}`,
    widgetType,
    size,
    x: 0,
    y: bottomRow,
    visible: true,
    pinned: false,
    config,
    createdAt: now,
    updatedAt: now,
  };

  return stableCompact([...widgets, newWidget]);
}
