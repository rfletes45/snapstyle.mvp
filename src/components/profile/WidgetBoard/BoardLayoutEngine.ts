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
// Compaction (Gravity)
// =============================================================================

/**
 * Compact all visible widgets upward (vertical gravity) while preserving
 * each widget's horizontal (x) position. Only shifts x if the widget
 * can't fit at its current column due to size/bounds constraints.
 *
 * Deterministic: same input always produces the same output.
 * Returns a new widget array with updated x,y positions.
 */
export function compactWidgets(widgets: WidgetInstance[]): WidgetInstance[] {
  // Sort by current position: top-to-bottom, then left-to-right
  const visible = widgets
    .filter((w) => w.visible)
    .sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));

  const hidden = widgets.filter((w) => !w.visible);

  // Rebuild occupancy incrementally
  const placed: WidgetInstance[] = [];
  let maxRow = 0;

  for (const widget of visible) {
    const span = SIZE_PRESETS[widget.size];
    const tempGrid = buildOccupancyMap(placed);

    // Preserve horizontal position — only compact vertically
    let targetX = widget.x;
    if (targetX + span.w > GRID_COLUMNS) {
      targetX = Math.max(0, GRID_COLUMNS - span.w);
    }

    // Scan rows top-down at the preserved x-column
    let bestPos: { x: number; y: number } | null = null;
    for (let row = 0; row <= maxRow + 1; row++) {
      const expandedGrid = ensureGridRows(tempGrid, row + span.h);
      if (
        canPlace(expandedGrid, { x: targetX, y: row, w: span.w, h: span.h })
      ) {
        bestPos = { x: targetX, y: row };
        break;
      }
    }

    // Fallback: if x-preserving placement fails, search all columns
    if (!bestPos) {
      outerLoop: for (let row = 0; row <= maxRow + 2; row++) {
        for (let col = 0; col <= GRID_COLUMNS - span.w; col++) {
          const expandedGrid = ensureGridRows(tempGrid, row + span.h);
          if (
            canPlace(expandedGrid, { x: col, y: row, w: span.w, h: span.h })
          ) {
            bestPos = { x: col, y: row };
            break outerLoop;
          }
        }
      }
    }

    if (!bestPos) {
      // Absolute fallback — put at end
      bestPos = { x: 0, y: maxRow };
    }

    const updated: WidgetInstance = {
      ...widget,
      x: bestPos.x,
      y: bestPos.y,
      updatedAt: widget.updatedAt,
    };
    placed.push(updated);

    const bottom = bestPos.y + span.h;
    if (bottom > maxRow) maxRow = bottom;
  }

  return [...placed, ...hidden];
}

/**
 * Ensure the occupancy grid has at least `rows` rows, extending with
 * empty cells if needed.
 */
function ensureGridRows(grid: OccupancyCell[], rows: number): OccupancyCell[] {
  const currentRows = getGridRows(grid);
  if (currentRows >= rows) return grid;
  const extra = (rows - currentRows) * GRID_COLUMNS;
  const extension: OccupancyCell[] = [];
  for (let i = 0; i < extra; i++) {
    extension.push({ instanceId: null });
  }
  return [...grid, ...extension];
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
  ];
}

// =============================================================================
// Live Reflow — Conflict Resolution During Drag
// =============================================================================

/**
 * Resolve a drag preview layout. The dragged widget is tentatively placed
 * at (targetX, targetY). Any conflicting widgets are relocated to their
 * nearest valid position, deterministically, and the whole layout is then
 * gravity-compacted with the dragged widget's position preserved.
 *
 * Returns a new widget array representing the preview layout, or `null`
 * if placement would be invalid (e.g. out of grid column bounds).
 *
 * This is called continuously during drag to produce live reflow.
 */
export function resolveConflicts(
  widgets: WidgetInstance[],
  draggedId: string,
  targetX: number,
  targetY: number,
): WidgetInstance[] | null {
  const draggedIdx = widgets.findIndex((w) => w.instanceId === draggedId);
  if (draggedIdx === -1) return null;

  const dragged = widgets[draggedIdx];
  const span = SIZE_PRESETS[dragged.size];

  // Clamp to grid bounds
  const clampedX = Math.max(0, Math.min(targetX, GRID_COLUMNS - span.w));
  const clampedY = Math.max(0, targetY);

  // Start with the dragged widget in its preview position
  const preview: WidgetInstance[] = widgets.map((w) =>
    w.instanceId === draggedId ? { ...w, x: clampedX, y: clampedY } : { ...w },
  );

  // Build occupancy excluding the dragged widget to find conflicts
  const draggedRect: GridRect = {
    x: clampedX,
    y: clampedY,
    w: span.w,
    h: span.h,
  };

  // Identify conflicting widgets (those whose footprint overlaps the dragged rect)
  const conflicting: string[] = [];
  for (const w of preview) {
    if (w.instanceId === draggedId || !w.visible) continue;
    const ws = SIZE_PRESETS[w.size];
    if (rectsOverlap(draggedRect, { x: w.x, y: w.y, w: ws.w, h: ws.h })) {
      conflicting.push(w.instanceId);
    }
  }

  if (conflicting.length === 0) {
    // No conflicts — just compact while preserving dragged position
    return compactWithPinned(preview, draggedId);
  }

  // Resolve conflicts: relocate each conflicting widget to nearest valid slot.
  // Process by proximity to the dragged widget (closest first) for stability.
  conflicting.sort((a, b) => {
    const wa = preview.find((w) => w.instanceId === a)!;
    const wb = preview.find((w) => w.instanceId === b)!;
    const distA = Math.abs(wa.x - clampedX) + Math.abs(wa.y - clampedY);
    const distB = Math.abs(wb.x - clampedX) + Math.abs(wb.y - clampedY);
    return distA - distB;
  });

  // Build an occupancy grid that includes the dragged widget and all
  // non-conflicting widgets (these are "fixed" for the purpose of relocation).
  const fixedWidgets = preview.filter(
    (w) => w.visible && !conflicting.includes(w.instanceId),
  );

  for (const conflictId of conflicting) {
    const cIdx = preview.findIndex((w) => w.instanceId === conflictId);
    if (cIdx === -1) continue;
    const cWidget = preview[cIdx];
    const cSpan = SIZE_PRESETS[cWidget.size];

    // Build occupancy from all currently-fixed widgets
    const currentFixed = preview.filter(
      (w) =>
        (w.visible && !conflicting.includes(w.instanceId)) ||
        w.instanceId === draggedId ||
        // Include already-relocated conflicting widgets
        (conflicting.includes(w.instanceId) &&
          conflicting.indexOf(w.instanceId) < conflicting.indexOf(conflictId)),
    );
    // Rebuild: include dragged + non-conflicting + already-resolved
    const resolved = preview.filter(
      (w) =>
        w.visible &&
        w.instanceId !== conflictId &&
        (w.instanceId === draggedId ||
          !conflicting.includes(w.instanceId) ||
          conflicting.indexOf(w.instanceId) < conflicting.indexOf(conflictId)),
    );
    const grid = buildOccupancyMap(resolved);

    // Try original position first (it may have cleared if another widget moved)
    const slot = findNearestSlot(grid, cSpan, cWidget.x, cWidget.y, conflictId);

    if (slot) {
      preview[cIdx] = { ...cWidget, x: slot.x, y: slot.y };
    } else {
      // Absolute fallback: place at the bottom of the grid
      const totalRows = getGridRows(grid);
      preview[cIdx] = { ...cWidget, x: 0, y: totalRows };
    }
  }

  return compactWithPinned(preview, draggedId);
}

/**
 * Check if two grid rectangles overlap.
 */
function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/**
 * Compact widgets with gravity while preserving the position of a specific
 * widget (the dragged widget). This ensures the dragged widget stays where
 * the user placed it while other widgets compact around it.
 */
function compactWithPinned(
  widgets: WidgetInstance[],
  pinnedId: string,
): WidgetInstance[] {
  const pinnedWidget = widgets.find((w) => w.instanceId === pinnedId);
  if (!pinnedWidget) return compactWidgets(widgets);

  // Sort visible widgets by position (top-to-bottom, left-to-right),
  // but process the pinned widget first so it claims its spot.
  const visible = widgets
    .filter((w) => w.visible)
    .sort((a, b) => {
      if (a.instanceId === pinnedId) return -1;
      if (b.instanceId === pinnedId) return 1;
      return a.y !== b.y ? a.y - b.y : a.x - b.x;
    });

  const hidden = widgets.filter((w) => !w.visible);
  const placed: WidgetInstance[] = [];
  let maxRow = 0;

  for (const widget of visible) {
    const span = SIZE_PRESETS[widget.size];

    if (widget.instanceId === pinnedId) {
      // Keep pinned widget exactly where it is
      placed.push(widget);
      const bottom = widget.y + span.h;
      if (bottom > maxRow) maxRow = bottom;
      continue;
    }

    // Compact other widgets upward, respecting the pinned widget
    const tempGrid = buildOccupancyMap(placed);
    let targetX = widget.x;
    if (targetX + span.w > GRID_COLUMNS) {
      targetX = Math.max(0, GRID_COLUMNS - span.w);
    }

    let bestPos: { x: number; y: number } | null = null;
    for (let row = 0; row <= maxRow + 1; row++) {
      const expandedGrid = ensureGridRows(tempGrid, row + span.h);
      if (
        canPlace(expandedGrid, { x: targetX, y: row, w: span.w, h: span.h })
      ) {
        bestPos = { x: targetX, y: row };
        break;
      }
    }

    if (!bestPos) {
      outerSearch: for (let row = 0; row <= maxRow + 2; row++) {
        for (let col = 0; col <= GRID_COLUMNS - span.w; col++) {
          const expandedGrid = ensureGridRows(tempGrid, row + span.h);
          if (
            canPlace(expandedGrid, { x: col, y: row, w: span.w, h: span.h })
          ) {
            bestPos = { x: col, y: row };
            break outerSearch;
          }
        }
      }
    }

    if (!bestPos) {
      bestPos = { x: 0, y: maxRow };
    }

    placed.push({ ...widget, x: bestPos.x, y: bestPos.y });
    const bottom = bestPos.y + span.h;
    if (bottom > maxRow) maxRow = bottom;
  }

  return [...placed, ...hidden];
}

/**
 * Resolve a resize preview. The widget is tentatively given `newSize`
 * while staying anchored at its current top-left. Any conflicts are
 * resolved using the same nearest-slot algorithm.
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

  // Clamp x if needed
  let newX = widget.x;
  if (newX + newSpan.w > GRID_COLUMNS) {
    newX = Math.max(0, GRID_COLUMNS - newSpan.w);
  }

  // Build a temporary widgets array with the new size applied
  const temp = widgets.map((w) =>
    w.instanceId === instanceId ? { ...w, size: newSize, x: newX } : { ...w },
  );

  // Use resolveConflicts to handle any overlaps
  return resolveConflicts(temp, instanceId, newX, widget.y);
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

/** Restore a hidden widget and place it at the best available slot. */
export function restoreWidget(
  widgets: WidgetInstance[],
  instanceId: string,
): WidgetInstance[] | null {
  const idx = widgets.findIndex((w) => w.instanceId === instanceId);
  if (idx === -1) return null;

  const widget = widgets[idx];
  const span = SIZE_PRESETS[widget.size];

  // Find a spot for the restored widget
  const visibleOnly = widgets.filter(
    (w) => w.visible && w.instanceId !== instanceId,
  );
  const grid = buildOccupancyMap(visibleOnly);
  const slot = findNearestSlot(grid, span, 0, getGridRows(grid));
  if (!slot) return null;

  const updated = [...widgets];
  updated[idx] = {
    ...widget,
    visible: true,
    x: slot.x,
    y: slot.y,
    updatedAt: new Date().toISOString(),
  };

  return compactWidgets(updated);
}

// =============================================================================
// Add New Widget
// =============================================================================

/** Add a new widget instance to the board at the best available slot. */
export function addWidget(
  widgets: WidgetInstance[],
  widgetType: WidgetInstance["widgetType"],
  size: WidgetSizeKey,
  config: WidgetInstance["config"] = {},
): WidgetInstance[] {
  // Guard: don't add duplicate if an instance of this type already exists
  const existing = widgets.find((w) => w.widgetType === widgetType);
  if (existing) return widgets;

  const span = SIZE_PRESETS[size];
  const grid = buildOccupancyMap(widgets.filter((w) => w.visible));
  const totalRows = getGridRows(grid);
  const slot = findNearestSlot(grid, span, 0, totalRows) ?? {
    x: 0,
    y: totalRows,
  };

  const now = new Date().toISOString();
  const newWidget: WidgetInstance = {
    instanceId: `${widgetType}-${Date.now()}`,
    widgetType,
    size,
    x: slot.x,
    y: slot.y,
    visible: true,
    pinned: false,
    config,
    createdAt: now,
    updatedAt: now,
  };

  return compactWidgets([...widgets, newWidget]);
}
