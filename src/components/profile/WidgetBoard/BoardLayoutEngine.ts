/**
 * Board Layout Engine
 *
 * Deterministic grid packing, occupancy tracking, placement validation,
 * and compaction for the profile widget board.
 *
 * The grid is GRID_COLUMNS wide. Rows grow downward infinitely.
 * Each cell is either empty (null) or occupied by a widget instanceId.
 *
 * @module components/profile/WidgetBoard/BoardLayoutEngine
 */

import {
  CELL_HEIGHT,
  GRID_COLUMNS,
  GRID_GUTTER,
  SIZE_PRESETS,
  type CollisionDisplacementDirection,
  type CollisionDisplacementHint,
  type DragHoverProbe,
  type GridRect,
  type OccupancyCell,
  type WidgetInstance,
  type WidgetSizeKey,
  type WidgetSpan,
} from "./types";

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

function findSupportedUpwardPosition(
  grid: OccupancyCell[],
  preferredX: number,
  currentY: number,
  span: WidgetSpan,
): { x: number; y: number } | null {
  for (let row = currentY - 1; row >= 0; row--) {
    if (!canPlace(grid, { x: preferredX, y: row, w: span.w, h: span.h })) {
      continue;
    }
    if (row === 0 || isWidgetSupported(row, preferredX, span.w, grid)) {
      return { x: preferredX, y: row };
    }
  }

  return null;
}

/**
 * Find the best deterministic position for a widget.
 *
 * Search policy (in order):
 * 1. Current position — if y >= searchStart and slot is free
 * 2. When upward pressure is requested, try the nearest supported slot above
 *    in the widget's current column
 * 3. Preferred column — scan rows from searchStart downward
 * 4. Row-major scan — scan (row, col) from searchStart downward
 * 5. Absolute fallback — bottom of the grid
 *
 * Never uses spiral/radius search or Euclidean distance.
 */
function findStablePosition(
  placed: WidgetInstance[],
  preferredX: number,
  searchStart: number,
  span: WidgetSpan,
  currentY?: number,
  preferredDirection?: CollisionDisplacementDirection | null,
): { x: number; y: number } {
  const grid = buildOccupancyMap(placed);
  const maxRow = getMaxPlacedRow(placed) + 20;

  // Strategy 1: try exact current position (minimize movement)
  if (currentY !== undefined && currentY >= searchStart) {
    if (canPlace(grid, { x: preferredX, y: currentY, w: span.w, h: span.h })) {
      return { x: preferredX, y: currentY };
    }
  }

  // Strategy 2: if the user is pressing into the lower half of the obstructed
  // widget, first try a supported same-column escape above it. This keeps the
  // bias local and avoids reintroducing remote-gap compaction behavior.
  if (preferredDirection === "up" && currentY !== undefined) {
    const upwardPos = findSupportedUpwardPosition(
      grid,
      preferredX,
      currentY,
      span,
    );
    if (upwardPos) {
      return upwardPos;
    }
  }

  // Strategy 3: preferred column, scan rows from searchStart downward
  for (let row = searchStart; row <= maxRow; row++) {
    if (canPlace(grid, { x: preferredX, y: row, w: span.w, h: span.h })) {
      return { x: preferredX, y: row };
    }
  }

  // Strategy 4: deterministic row-major scan from searchStart
  for (let row = searchStart; row <= maxRow; row++) {
    for (let col = 0; col <= GRID_COLUMNS - span.w; col++) {
      if (canPlace(grid, { x: col, y: row, w: span.w, h: span.h })) {
        return { x: col, y: row };
      }
    }
  }

  // Strategy 5: absolute fallback — place at the grid bottom
  return { x: 0, y: getMaxPlacedRow(placed) };
}

/**
 * Check whether a widget at the given position has direct support above
 * its top edge. A widget is considered supported when:
 *   - it is at row 0 (top of board), OR
 *   - at least one cell in the row directly above its top edge (within its
 *     horizontal span) is occupied by another widget.
 *
 * This implements a "contact above" rule — any partial support counts.
 * Full-width support is not required.
 */
function isWidgetSupported(
  y: number,
  x: number,
  w: number,
  grid: OccupancyCell[],
): boolean {
  if (y === 0) return true;
  const checkRow = y - 1;
  const totalRows = getGridRows(grid);
  if (checkRow >= totalRows) return false;
  for (let col = x; col < x + w; col++) {
    const idx = checkRow * GRID_COLUMNS + col;
    if (idx >= 0 && idx < grid.length && grid[idx]?.instanceId !== null) {
      return true;
    }
  }
  return false;
}

/**
 * Restore support integrity after collision resolution.
 *
 * This is intentionally narrower than global compaction:
 * - every visible widget is inspected in top-to-bottom order
 * - a widget only moves if it has no direct contact above
 * - movement is vertical-only within the widget's current columns
 * - there is no cross-column search and no remote gap filling
 *
 * Scanning the full visible set is necessary because a widget that starts
 * out supported can become unsupported after a higher widget settles upward.
 */
function settleUnsupportedWidgetsUpward(
  placed: WidgetInstance[],
  fixedIds: ReadonlySet<string> = new Set(),
): WidgetInstance[] {
  const settleOrder = getVisualOrder(placed).map((widget) => widget.instanceId);

  for (const instanceId of settleOrder) {
    if (fixedIds.has(instanceId)) continue;

    const idx = placed.findIndex((widget) => widget.instanceId === instanceId);
    if (idx === -1) continue;

    const span = SIZE_PRESETS[placed[idx].size];
    const othersForSettle = placed.filter(
      (widget) => widget.instanceId !== instanceId,
    );
    const grid = buildOccupancyMap(othersForSettle);

    let currentY = placed[idx].y;
    while (currentY > 0) {
      if (isWidgetSupported(currentY, placed[idx].x, span.w, grid)) break;

      const newY = currentY - 1;
      if (
        !canPlace(grid, {
          x: placed[idx].x,
          y: newY,
          w: span.w,
          h: span.h,
        })
      ) {
        break;
      }

      currentY = newY;
      placed[idx] = { ...placed[idx], y: currentY };
    }
  }

  return placed;
}

/**
 * Stable repack with a pinned (active) widget.
 *
 * Used for drag preview, drag commit, resize preview, and resize commit.
 *
 * Phase 1 — Collision-only resolution:
 *   The pinned widget is placed at its target position first. All other
 *   visible widgets are checked in visual order: if a widget's current
 *   position is still valid (no overlap with already-placed widgets), it
 *   stays exactly in place. Only widgets with actual collisions are
 *   relocated to a nearby valid position. This avoids the previous
 *   broad affected-region partition that could unnecessarily shift
 *   higher widgets downward.
 *
 * Phase 2 — Support-seeking upward settle:
 *   The post-collision layout then runs a support-integrity pass from
 *   top-to-bottom. Any non-pinned widget that has lost direct contact above
 *   may climb upward one row at a time until it reaches row 0, regains
 *   support, or is blocked. The pinned widget stays at the user-selected
 *   target so preview and final commit remain predictable. This heals
 *   temporary vacancy/floating artifacts without doing full-board gravity
 *   compaction or cross-column gap filling.
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

  // Compute visual order of non-pinned widgets BEFORE the move
  const others = getVisualOrder(
    visible.filter((w) => w.instanceId !== pinnedId),
  );

  // Compute pinned widget's new rect
  const newSize = targetSize ?? pinned.size;
  const newSpan = SIZE_PRESETS[newSize];
  const cx = Math.max(0, Math.min(targetX, GRID_COLUMNS - newSpan.w));
  const cy = Math.max(0, targetY);
  const pinnedPlaced: WidgetInstance = {
    ...pinned,
    x: cx,
    y: cy,
    size: newSize,
  };

  // ── Phase 1: Collision-only resolution ──────────────────────────────
  // Place pinned widget first. For each remaining widget in visual order,
  // check if its current position is still valid against already-placed
  // widgets. Keep it exactly in place if valid; otherwise relocate to the
  // nearest valid position near its current location.
  const placed: WidgetInstance[] = [pinnedPlaced];

  for (const widget of others) {
    const span = SIZE_PRESETS[widget.size];
    const currentRect: GridRect = {
      x: widget.x,
      y: widget.y,
      w: span.w,
      h: span.h,
    };
    const grid = buildOccupancyMap(placed);

    if (canPlace(grid, currentRect)) {
      // No collision — keep widget exactly where it is
      placed.push(widget);
    } else {
      // Actual collision — find nearest valid position near current spot
      // Only the primary obstructed widget gets the drag-direction bias.
      // Cascading collisions still use the normal local downward search.
      let preferredX = widget.x;
      if (preferredX + span.w > GRID_COLUMNS) {
        preferredX = Math.max(0, GRID_COLUMNS - span.w);
      }
      const preferredDirection =
        collisionHint?.obstructedId === widget.instanceId
          ? collisionHint.direction
          : null;
      // Search from the widget's current row to keep it nearby.
      // The settle-upward pass (phase 2) will reclaim any excess
      // downward displacement afterward.
      const pos = findStablePosition(
        placed,
        preferredX,
        widget.y,
        span,
        widget.y,
        preferredDirection,
      );
      placed.push({ ...widget, x: pos.x, y: pos.y });
    }
  }

  // ── Phase 2: Support-seeking upward settle ──────────────────────────
  // This pass always recomputes from the collision-only layout. That lets
  // widgets that were merely supported by a transient preview branch settle
  // back into place when the active widget moves elsewhere.
  const settled = settleUnsupportedWidgetsUpward(placed, new Set([pinnedId]));

  return [...settled, ...hidden];
}

/**
 * Stable compact (gravity) without a pinned widget.
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

  const placed: WidgetInstance[] = [];

  for (const widget of ordered) {
    const span = SIZE_PRESETS[widget.size];
    let targetX = widget.x;
    if (targetX + span.w > GRID_COLUMNS) {
      targetX = Math.max(0, GRID_COLUMNS - span.w);
    }

    // Compact always searches from row 0 (pull upward)
    const pos = findStablePosition(placed, targetX, 0, span);
    placed.push({ ...widget, x: pos.x, y: pos.y });
  }

  return [...placed, ...hidden];
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
 * Delegates to stableRepack which:
 *   1. Resolves actual collisions (only truly overlapping widgets move)
 *   2. Applies support-seeking upward settle (pinned + displaced widgets
 *      climb upward until supported by contact above, or at row 0)
 *
 * Does NOT run global compaction. Unaffected widgets stay exactly in
 * place. No remote gap filling.
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
 * The dragged widget is placed at (targetX, targetY). All other visible
 * widgets are repacked in their original visual order, preserving relative
 * positions. No spiral search, no nearest-slot relocation.
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
