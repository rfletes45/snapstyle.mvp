# Widget Board Architecture

Last verified: 2026-03-27

← Back to [Profile System Overview](PROFILE_SYSTEM_OVERVIEW.md)

This document describes the grid layout engine, drag/reorder/reflow behavior, resize system, animation model, and persistence layer of the profile widget board.

## Grid Model

The widget board is a 4-column grid with fixed cell dimensions.

**Constants** (defined in `src/components/profile/WidgetBoard/types.ts`):

| Constant       | Value | Purpose                                         |
| -------------- | ----- | ----------------------------------------------- |
| `GRID_COLUMNS` | 4     | Number of columns in portrait mode              |
| `GRID_GUTTER`  | 8px   | Horizontal and vertical spacing between widgets |
| `CELL_HEIGHT`  | 88px  | Height of one grid row                          |

**Size Presets:**

| Size Key | Grid Span | Pixel Width | Pixel Height | Notes                                          |
| -------- | --------- | ----------- | ------------ | ---------------------------------------------- |
| `small`  | 2×1       | ~176px      | 88px         | Half-width, single row                         |
| `medium` | 2×2       | ~176px      | 184px        | Half-width, two rows                           |
| `wide`   | 4×1       | ~388px      | 88px         | Full-width, single row                         |
| `large`  | 4×2       | ~388px      | 184px        | Full-width, two rows                           |
| `hero`   | 4×4       | ~388px      | 376px        | Full-width, four rows. Profile hero card only. |

> Pixel heights: `rows × CELL_HEIGHT + (rows − 1) × GRID_GUTTER` → 1 row = 88, 2 rows = 184, 4 rows = 376.

Widget pixel widths depend on the measured board width: `(boardWidth - (GRID_COLUMNS - 1) × GRID_GUTTER) / GRID_COLUMNS × colSpan + (colSpan - 1) × GRID_GUTTER`.

## Board Container

**File:** `src/components/profile/WidgetBoard/WidgetBoardContainer.tsx`

The container:

1. Measures available width on layout
2. Calculates board height from the maximum bottom edge of all visible widgets
3. In customize mode, adds `CUSTOMIZE_EXTRA_ROWS = 6` extra rows of workspace below the last widget (provides breathing room for dragging)
4. Renders widgets as absolutely-positioned `WidgetWrapper` components
5. Renders the `CustomizeModeToolbar` and `WidgetGallery` when in customize mode

Board height is dynamic — it grows/shrinks as widgets are added, removed, or rearranged.

## Occupancy Map

**File:** `src/components/profile/WidgetBoard/BoardLayoutEngine.ts`

The layout engine maintains a 2D occupancy grid:

- Stored as a 1D array indexed by `row × GRID_COLUMNS + col`
- Each cell records the `instanceId` of the widget occupying it, or `null`
- Built only from visible widgets (hidden widgets are excluded)
- Used for placement validation and conflict detection

**Placement validation** (`canPlace()`): Checks that a rectangle fits within grid bounds and does not overlap any occupied cell (optionally ignoring a specific widget).

## Widget Positioning

Widgets are positioned on the board using their `(x, y)` grid coordinates:

- `x` = column (0 to `GRID_COLUMNS - 1`)
- `y` = row (0-based, unbounded downward)

Pixel position is computed as:

- `left = x × (cellWidth + GRID_GUTTER)`
- `top = y × (CELL_HEIGHT + GRID_GUTTER)`

Position changes are animated using Reanimated shared values (see [Animation Model](#animation-model)).

## Layout Engine: Compaction & Conflict Resolution

### Compaction (Gravity)

**Function:** `compactWidgets()` in `BoardLayoutEngine.ts`

After any layout change, widgets compact upward (gravity pulls everything to the top):

1. Sort visible widgets by position: top-to-bottom, then left-to-right
2. For each widget: scan rows upward from current Y to find the first valid position at the widget's current X
3. If X-preserving placement fails: search all columns
4. Absolute fallback: place at grid bottom
5. Deterministic: same input always produces same output

**Pinned variant:** `compactWithPinned(widgets, pinnedId)` preserves one widget's exact position. The pinned widget gets first claim on space; all others compact around it. Used during drag previews.

### Conflict Resolution

**Function:** `resolveConflicts()` in `BoardLayoutEngine.ts`

When a widget is dragged or resized into a position that overlaps other widgets:

1. Clamp the moved widget to grid bounds
2. Identify all overlapping widgets via rectangle intersection (`rectsOverlap()`)
3. Sort conflicts by distance to the moved widget (closest first, for visual stability)
4. Iteratively relocate each conflicted widget to the nearest valid slot via spiral search
5. Call `compactWithPinned()` to finalize the layout with the moved widget pinned

**Nearest slot search:** Starts at the widget's original position and spirals outward (up to radius 20). If no slot is found within the spiral, falls back to placing at the grid bottom.

### Resize Resolution

**Function:** `resolveResize()` in `BoardLayoutEngine.ts`

When a widget is resized:

1. Apply the new size
2. Clamp X position if the widget now exceeds grid width
3. Delegate to `resolveConflicts()` to handle any overlaps
4. Returns updated layout or `null` if the resize is invalid

## Drag-and-Drop System

### Architecture Overview

**File:** `src/components/profile/WidgetBoard/WidgetWrapper.tsx`

The drag system uses a **teleport-proof** design:

- Widget visual position is driven by `transform: [{translateX}, {translateY}]` (GPU-composited)
- Base position (`animLeft`, `animTop`) is frozen at pickup time
- Gesture translation is added as a delta
- This prevents React Native layout system from interfering during drag

### Drag Flow

1. **Pickup:** User long-presses (200ms) a widget in customize mode → capture stable origin coordinates, trigger haptic (`ImpactFeedbackStyle.Light`)
2. **Move:** Continuous pan updates compute the hover target grid cell from `origin + rawTranslation`. Calls `onDragUpdate(col, row)` on each change.
3. **Drop:** Gesture ends → call `commitPreview()`, which animates the widget to its final grid position via spring animation

### Dwell-Before-Reflow

**Constant:** `DWELL_MS = 500` (in `useBoardState.ts`)

To prevent jittery repositioning during rapid drag movement, the board uses a **dwell timer**:

1. As the user drags, `updateDragPreview()` is called continuously (~50ms throttle)
2. If the hover target cell changes, the dwell timer resets
3. Only after the widget hovers over the **same candidate slot for 500ms** does the board reflow (other widgets slide out of the way)
4. On drop: if a dwell-based reflow already fired, commit that preview. Otherwise, compute final layout from the latest hover position.

This ensures smooth, intentional reflows rather than chaotic shuffling during fast drags.

### Passive Widget Sliding

When a dwell fires and the board reflows, displaced widgets **spring-animate** to their new positions using the `reflow` spring config. This creates a fluid "sliding into place" effect while the dragged widget is still held.

## Resize System

### Gesture

**File:** `src/components/profile/WidgetBoard/WidgetWrapper.tsx`

Resize is driven by a pan gesture from the bottom-right corner handle:

- Handle size: `RESIZE_HANDLE_SIZE = 28px` (visual), `RESIZE_HANDLE_HIT = 16px` (expanded hit area)
- Pan delta is mapped to grid delta (column/row changes)
- The system finds the best matching supported size using a distance metric
- Haptic feedback fires on each size change (`ImpactFeedbackStyle.Medium`)

### Size Constraints

Each widget type declares:

- `supportedSizes[]` — array of valid size keys
- The resize gesture snaps to the nearest supported size
- Invalid sizes are rejected

On resize commit, `resolveResize()` in the layout engine handles any resulting conflicts.

## Animation Model

**Spring Configs** (defined in `WidgetWrapper.tsx`):

| Config   | Damping | Stiffness | Mass | Used For                                             |
| -------- | ------- | --------- | ---- | ---------------------------------------------------- |
| `reflow` | 20      | 90        | 1.0  | Displaced widgets sliding to new positions           |
| `snap`   | 15      | 150       | 0.5  | Dragged widget snapping to final position after drop |

Both configs use `ReduceMotion.Never` to ensure animations always run on the native compositor, even if the user has enabled reduced motion system-wide. This is required for layout correctness (positions must animate to their final values).

### Position Sync

- **During drag:** `animLeft`/`animTop` are frozen; gesture drives `translateX`/`translateY`
- **After drop:** Base position springs to committed grid coordinates via `snap` config; translation resets to 0
- **Normal updates (reflow):** Widgets spring to new positions via `reflow` config
- **Resize:** Width/height spring to new pixel dimensions

### Edit Controls Visibility

Edit overlays (remove button, resize handle, drag handle) fade in/out with opacity animation (`DURATIONS.normal`, typically ~200ms). Pointer events are disabled when opacity < 0.5.

### Haptic Feedback

| Action             | Feedback Type                      |
| ------------------ | ---------------------------------- |
| Drag start         | `ImpactFeedbackStyle.Light`        |
| Drag end           | `ImpactFeedbackStyle.Light`        |
| Resize size change | `ImpactFeedbackStyle.Medium`       |
| Done (save)        | `NotificationFeedbackType.Success` |
| Cancel             | `ImpactFeedbackStyle.Light`        |

## State Management

### Hook Hierarchy

```
OwnProfileScreen
  └─ useBoardState(userId)
       └─ useBoardPersistence(userId)
            └─ Firestore: Users/{userId}/ProfileLayout/board
```

### State Layers

| Layer         | Source                 | Lifetime           | Purpose                                                |
| ------------- | ---------------------- | ------------------ | ------------------------------------------------------ |
| **Persisted** | Firestore `onSnapshot` | Permanent          | Canonical saved layout                                 |
| **Working**   | Local state            | Customize session  | In-progress edits (before Done/Cancel)                 |
| **Preview**   | Local state            | During drag/resize | Live reflow preview                                    |
| **Active**    | Computed               | Render frame       | `preview ?? working ?? persisted` — what the user sees |

### Mode Transitions

**Enter customize:**

1. Snapshot current persisted widgets → `snapshotRef`
2. Create working copy
3. Set mode to `"customize"`

**Done (save):**

1. Compact working widgets
2. Persist to Firestore
3. Clear working/preview state
4. Set mode to `"view"`

**Cancel (discard):**

1. Clear working/preview state (reverts to persisted)
2. Set mode to `"view"`

## Default Layout

Generated when no saved layout exists (first profile load):

| Widget         | Size         | Position (x, y) |
| -------------- | ------------ | --------------- |
| profile-header | hero (4×4)   | (0, 0)          |
| social-proof   | wide (4×1)   | (0, 4)          |
| friends        | medium (2×2) | (0, 5)          |
| badges         | medium (2×2) | (2, 5)          |
| achievements   | wide (4×1)   | (0, 7)          |

Additional widgets (favorite-game, profile-stats, recent-activity, mutual-friends) are available in the Widget Gallery but not placed by default.

## Key Files

| File                       | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `WidgetBoardContainer.tsx` | Root board rendering, toolbar/gallery coordination       |
| `WidgetWrapper.tsx`        | Per-widget drag/resize gestures, edit controls           |
| `BoardLayoutEngine.ts`     | Grid packing, occupancy, conflict resolution, compaction |
| `useBoardState.ts`         | Mode management, dwell logic, layout actions             |
| `useBoardPersistence.ts`   | Firestore load/save/sync, validation, migration          |
| `WidgetRegistry.ts`        | Widget type definitions and metadata                     |
| `WidgetGallery.tsx`        | Add/restore widget bottom sheet                          |
| `CustomizeModeToolbar.tsx` | Top toolbar: Cancel, Done, Add buttons                   |
| `WidgetSizeSelector.tsx`   | Resize size preset selection UI                          |
| `adapters.tsx`             | Widget content renderers per type and size               |
| `types.ts`                 | Types, constants, size presets, schema version           |

## See Also

- [Profile System Overview](PROFILE_SYSTEM_OVERVIEW.md) — entry point and terminology
- [Profile Hero Card](PROFILE_HERO_CARD.md) — hero card size variants
- [Interactions and Edit Mode](INTERACTIONS_AND_EDIT_MODE.md) — user-facing interaction details
- [Data and Persistence](DATA_AND_PERSISTENCE.md) — Firestore storage and data sources
