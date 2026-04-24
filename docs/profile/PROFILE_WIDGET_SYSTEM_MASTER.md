# Profile Widget System — Master Reference

Last verified against codebase: 2026-04-24

This is the single authoritative document for the profile screen's widget-based customization system. It supersedes and consolidates all prior profile-widget documentation.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [File and Ownership Map](#2-file-and-ownership-map)
3. [Architecture](#3-architecture)
4. [Widget Model](#4-widget-model)
5. [Layout System](#5-layout-system)
6. [State Management](#6-state-management)
7. [Persistence and Backend Model](#7-persistence-and-backend-model)
8. [Rendering Flow](#8-rendering-flow)
9. [Editing and Customization UX Logic](#9-editing-and-customization-ux-logic)
10. [Theming, Styling, and Visual Behavior](#10-theming-styling-and-visual-behavior)
11. [Known Risks, Fragile Areas, and Likely Bug Zones](#11-known-risks-fragile-areas-and-likely-bug-zones)
12. [Error Diagnosis Guide](#12-error-diagnosis-guide)
13. [Change Safety Guide](#13-change-safety-guide)
14. [Extension Guide](#14-extension-guide)
15. [Source-of-Truth Notes](#15-source-of-truth-notes)

---

## 1. System Overview

### What it is

The profile widget system is a **4-column grid-based board** that powers both the owner's profile screen (`OwnProfileScreen`) and viewed-user profile screens (`UserProfileScreen`). Users can customize their profile layout by arranging, resizing, adding, hiding, and repositioning modular widget cards.

### Why it exists

It replaced a static card-stack profile layout. The board gives users control over which sections appear, how large they are, and in what order, creating a personalized profile experience.

### How it differs from a static layout

- Widgets have configurable sizes (small/medium/wide/large/hero/mega)
- Users can drag to reorder, resize, hide, and restore widgets
- Layout is persisted per-user in Firestore
- Default layouts are auto-generated for new users
- Viewed profiles render the target user's saved layout in read-only mode

### Current customization capabilities

- Drag and reorder any widget on the grid
- Resize widgets within their supported size range
- Hide removable widgets from the board
- Restore hidden widgets from a gallery
- Add new widget types from the gallery
- All changes persist to Firestore on "Done"

---

## 2. File and Ownership Map

### Core Widget Board System

All in `src/components/profile/WidgetBoard/`:

| File                       | Responsibility                                                                                           | Category     |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------ |
| `types.ts`                 | All type definitions, grid constants, size presets, schema version                                       | Types/Config |
| `WidgetRegistry.ts`        | Widget type definitions, metadata, helper functions                                                      | Config       |
| `BoardLayoutEngine.ts`     | Grid packing, occupancy, placement, compaction, reflow, default layout generation, coordinate conversion | Layout Logic |
| `useBoardPersistence.ts`   | Firestore load/save/subscribe, validation, migration, default generation                                 | Persistence  |
| `useBoardState.ts`         | Central state management hook — mode, working/preview state, all board actions                           | State        |
| `WidgetBoardContainer.tsx` | Root board component — grid rendering, widget mapping, gallery/size-selector coordination                | UI Container |
| `WidgetWrapper.tsx`        | Individual widget chrome — drag, resize, remove affordances, animated positioning                        | UI Component |
| `CustomizeModeToolbar.tsx` | Floating overlay toolbar (Cancel/Done/Add) during customize mode                                         | UI Component |
| `WidgetGallery.tsx`        | Bottom sheet for adding/restoring widgets, category-grouped                                              | UI Component |
| `WidgetSizeSelector.tsx`   | Bottom sheet for choosing widget size                                                                    | UI Component |
| `adapters.tsx`             | Content adapters — bridge existing profile components into widget wrappers                               | UI/Adapters  |
| `index.ts`                 | Barrel exports                                                                                           | Module       |

### Profile Screens

| File                                        | Responsibility                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/screens/profile/OwnProfileScreen.tsx`  | Owner profile — editable board, customize toolbar, refresh, widget data assembly       |
| `src/screens/profile/UserProfileScreen.tsx` | Viewed profile — read-only board, viewer-actions injection, relationship/moderation UI |

### Supporting Files

| File                                          | Responsibility                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/components/profile/ProfileAnimations.ts` | Shared animation constants and presets used by widget wrappers                                               |
| `src/components/profile/ProfilePicture/`      | Avatar with decoration rendering                                                                             |
| `src/components/profile/OverviewCards/`       | Legacy card components (`FriendsCard`, `BadgesCard`, `AchievementsTrophyCaseCard`) reused by widget adapters |
| `src/components/profile/ProfileActions/`      | `ProfileActionsBar`, `MoreOptionsMenu` — used in viewer-actions adapter                                      |
| `src/components/profile/ProfileBio/`          | Bio editor — triggered from profile-header widget                                                            |
| `src/cosmetics/assetRegistry.ts`              | Asset resolution for backgrounds, decorations                                                                |
| `src/store/ThemeContext.ts`                   | Theme provider (`useColors`, `useAppTheme`) consumed by all widget rendering                                 |
| `src/store/ConversationDisplayModeContext.ts` | Chat layout mode context used by `chat-layout-mode` adapter                                                  |
| `constants/featureFlags.ts`                   | `PROFILE_V2_FEATURES` — all flags are `true`; no widget-board-specific flags exist                           |
| `constants/theme.ts`                          | `Spacing`, `BorderRadius`, `FontSizes` constants                                                             |

### Backend/Firestore

| Path                                    | Purpose                                                |
| --------------------------------------- | ------------------------------------------------------ |
| `Users/{uid}/ProfileLayout/board`       | Persisted board layout document                        |
| `Users/{uid}`                           | Profile identity, equipped cosmetics, privacy settings |
| `Users/{uid}/Entitlements/{cosmeticId}` | Canonical cosmetic ownership                           |
| `Friends/{friendshipId}`                | Streak data source                                     |
| `Wallets/{uid}`                         | Wallet balance                                         |
| `Tasks` + `Users/{uid}/TaskProgress`    | Task definitions and progress                          |

---

## 3. Architecture

### Component Hierarchy

```
OwnProfileScreen / UserProfileScreen
├── ScrollView (with RefreshControl on owner)
│   └── WidgetBoardContainer
│       └── GestureHandlerRootView
│           └── Board Surface (absolute-positioned children)
│               └── WidgetWrapper (per visible widget)
│                   ├── GestureDetector (drag + long-press)
│                   ├── Animated.View (transform-driven positioning)
│                   │   ├── Widget Content (via adapter)
│                   │   └── Edit Overlay (remove, drag handle, resize handle)
│                   └── Resize Gesture (when customizing)
│       ├── WidgetSizeSelector (modal, suppressed in readOnly)
│       └── WidgetGallery (modal, suppressed in readOnly)
├── CustomizeModeToolbar (absolute overlay, OwnProfileScreen only)
├── ProfilePictureEditor (modal)
├── ProfileBioEditor (modal)
└── Moderation modals (UserProfileScreen only)
```

### Data Flow

```
Firestore (Users/{uid}/ProfileLayout/board)
    ↓ onSnapshot / getDoc
useBoardPersistence (validate → migrate → setWidgets)
    ↓
useBoardState (persisted → working → preview layers)
    ↓
Screen (assembles widgetData from hooks/services)
    ↓
WidgetBoardContainer (maps widgets to WidgetWrappers)
    ↓
WidgetWrapper (animated positioning + gesture handling)
    ↓
Adapter (renders widget-specific content)
```

### Provider/Context Dependencies

The widget board itself has **no custom context/provider**. State is managed by the `useBoardState` hook called in the screen component and passed as props down through `WidgetBoardContainer` → `WidgetWrapper`.

External contexts consumed by adapters:

- `ThemeContext` (`useColors`, `useAppTheme`) — used in every visual component
- `ConversationDisplayModeContext` — used by `ChatLayoutModeAdapter`
- `AuthContext` — used by screens to get `currentFirebaseUser.uid`
- `UserContext` — used by `OwnProfileScreen` for base profile data
- `StreamCallContext` — used by `UserProfileScreen` for call actions

---

## 4. Widget Model

### What a Widget Is

A widget is a self-contained UI module with:

- A **type** (from the registry) defining its metadata and constraints
- An **instance** (persisted per user) defining its position, size, visibility, and configuration
- An **adapter** (React component) that renders its content

### Widget Type Definition (`WidgetTypeDefinition`)

Every widget type declares this metadata in `WidgetRegistry.ts`:

```ts
interface WidgetTypeDefinition {
  widgetType: WidgetTypeId; // unique identifier
  displayName: string; // human-readable name
  description: string; // gallery description
  icon: string; // MaterialCommunityIcons name
  category: "profile" | "social" | "gaming" | "activity" | "appearance";
  defaultSize: WidgetSizeKey; // size used when first placed
  supportedSizes: WidgetSizeKey[]; // all valid sizes
  minSize: WidgetSizeKey; // smallest allowed
  maxSize: WidgetSizeKey; // largest allowed
  canRemove: boolean; // false = non-removable (pinned to board)
  canResize: boolean; // whether size selector is available
  canConfigure: boolean; // whether settings are available
  defaultPlacementHint?: "top" | "middle" | "bottom";
  maxInstances?: number; // default 1
  visibilityMode?: "all" | "owner-only";
  interactiveForOwnerOnly?: boolean;
}
```

### Widget Instance (`WidgetInstance`)

Each placed widget is persisted as:

```ts
interface WidgetInstance {
  instanceId: string; // unique ID (e.g., "default-header")
  widgetType: WidgetTypeId; // references registry
  size: WidgetSizeKey; // current active size
  x: number; // grid column (0-based)
  y: number; // grid row (0-based)
  visible: boolean; // false = hidden (removable widgets only)
  pinned: boolean; // currently always false in default layout
  config: WidgetConfig; // type-specific config (currently {} for all)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
```

### Complete Widget Inventory (14 types)

| Widget Type        | Default Size | Supported Sizes                 | Category   | Can Remove | Can Resize | Visibility  | Interactive Owner-Only | Notes                                                            |
| ------------------ | ------------ | ------------------------------- | ---------- | ---------- | ---------- | ----------- | ---------------------- | ---------------------------------------------------------------- |
| `profile-header`   | `hero`       | `wide`, `large`, `hero`, `mega` | profile    | **No**     | Yes        | all         | —                      | Non-removable anchor; size-variant rendering (4 visual variants) |
| `social-proof`     | `wide`       | `wide`, `large`                 | activity   | Yes        | Yes        | all         | —                      | Streak tiers and activity summary                                |
| `friends`          | `medium`     | `small`, `medium`, `wide`       | social     | Yes        | Yes        | all         | —                      | Friend count and preview list                                    |
| `badges`           | `medium`     | `small`, `medium`, `wide`       | gaming     | Yes        | Yes        | all         | —                      | Featured badges collection                                       |
| `achievements`     | `medium`     | `small`, `medium`, `wide`       | gaming     | Yes        | Yes        | all         | —                      | Trophy-case summary                                              |
| `mutual-friends`   | `medium`     | `small`, `medium`, `wide`       | social     | Yes        | Yes        | all         | —                      | Meaningful mainly on viewed profiles                             |
| `favorite-game`    | `medium`     | `small`, `medium`, `wide`       | gaming     | Yes        | Yes        | all         | —                      | Derived from game stats; configurable                            |
| `profile-stats`    | `wide`       | `medium`, `wide`                | gaming     | Yes        | Yes        | all         | —                      | Games/Wins/Hours/Friends summary                                 |
| `recent-activity`  | `wide`       | `wide`, `large`                 | activity   | Yes        | Yes        | all         | —                      | Activity feed list                                               |
| `viewer-actions`   | `wide`       | `wide`, `large`                 | social     | **No**     | **No**     | viewed only | —                      | **Synthetic** — injected by `UserProfileScreen`, never persisted |
| `tasks-overview`   | `wide`       | `wide`, `large`                 | activity   | Yes        | Yes        | all         | —                      | Daily/monthly task progress                                      |
| `wallet-balance`   | `small`      | `small`, `medium`, `wide`       | profile    | Yes        | Yes        | all         | **Yes**                | Balance visible to all; controls owner-only                      |
| `theme-mode`       | `small`      | `small`, `wide`                 | appearance | Yes        | Yes        | all         | **Yes**                | Light/Dark/Auto toggle owner-only                                |
| `chat-layout-mode` | `small`      | `small`, `wide`                 | appearance | Yes        | Yes        | all         | **Yes**                | Bubbles/Stacked toggle owner-only                                |

### Size Presets

```
small:  2 columns × 1 row  (half-width, short)
medium: 2 columns × 2 rows (half-width, standard)
wide:   4 columns × 1 row  (full-width, short)
large:  4 columns × 2 rows (full-width, tall)
hero:   4 columns × 4 rows (full-width, very tall — profile-header)
mega:   4 columns × 6 rows (full-width, maximum — profile-header only)
```

Pixel dimensions: width = `columns * cellWidth + (columns-1) * GRID_GUTTER`, height = `rows * CELL_HEIGHT + (rows-1) * GRID_GUTTER`.

Cell width is computed from board width: `cellWidth = (boardWidth - (GRID_COLUMNS - 1) * GRID_GUTTER) / GRID_COLUMNS`.

### Default Layout (New Users)

Generated by `generateDefaultLayout()` in `BoardLayoutEngine.ts`:

| Order | instanceId               | widgetType       | size     | Position (x,y) |
| ----- | ------------------------ | ---------------- | -------- | -------------- |
| 1     | `default-header`         | `profile-header` | `hero`   | (0, 0)         |
| 2     | `default-social-proof`   | `social-proof`   | `wide`   | (0, 4)         |
| 3     | `default-friends`        | `friends`        | `medium` | (0, 5)         |
| 4     | `default-badges`         | `badges`         | `medium` | (2, 5)         |
| 5     | `default-achievements`   | `achievements`   | `wide`   | (0, 7)         |
| 6     | `default-tasks-overview` | `tasks-overview` | `wide`   | (0, 8)         |
| 7     | `default-wallet-balance` | `wallet-balance` | `small`  | (0, 9)         |

Not placed by default (available in gallery): `mutual-friends`, `favorite-game`, `profile-stats`, `recent-activity`, `theme-mode`, `chat-layout-mode`.

---

## 5. Layout System

### Grid Model

- **4 columns** wide (`GRID_COLUMNS = 4`)
- Rows are normalized through reversed-gravity packing: widgets settle as high as possible and empty vertical space collapses upward
- **Gutter**: 0px — widgets sit flush against each other (`GRID_GUTTER = 0`). Visual separation is provided by hairline seam lines rendered as overlays at grid boundaries.
- **Cell height**: 88px (`CELL_HEIGHT = 88`)
- Widget sizes span multiple columns and rows per `SIZE_PRESETS`

### Occupancy Map

`buildOccupancyMap()` creates a flat `OccupancyCell[]` array indexed as `[row * GRID_COLUMNS + col]`. Each cell tracks which `instanceId` occupies it, or `null` if empty.

### Placement Validation

`canPlace(grid, rect, ignoreId?)` checks that a `GridRect` fits within column bounds and doesn't overlap any occupied cell (ignoring the widget being moved).

### Slot Finding

`findNearestSlot(grid, span, targetX, targetY, ignoreId?)`:

1. Tries exact clamped position first
2. Spirals outward up to radius 20
3. Fallback: bottom of grid

### Stable Reflow Engine

The reflow engine is **deterministic** — same input always produces same output.

**Visual order**: widgets sorted by `y` ascending, then `x` ascending, then `instanceId` for tie-breaking.

**`stableRepack(widgets, pinnedId, targetX, targetY, targetSize?)`** — staged-intent + full packed resolution:

1. Stage the active widget at the current drag/resize target. The target row is bounded by the existing board height plus a small buffer, so a user can express "near the end" but cannot push the layout downward forever.
2. Detect the primary obstructed widget under the active drag pressure using overlap area and the continuous hover probe.
3. If the primary obstructed widget can fit in the active widget's vacated slot, stage it there. This is the key lateral swap path: two same-size neighboring widgets can trade slots sideways instead of cascading downward.
4. If the vacated slot cannot be used, the local directional hint can still stage the obstructed widget above or below the active target to preserve drag intent before packing.
5. Sort the staged widgets by visual order, then pack **all visible widgets** through the same row-first resolver. The active widget is not exempt from compaction.

This replaces the previous collision-only / support-integrity approach, which pinned the dragged widget at an arbitrary low target and only healed some secondary widgets.

**Directional hover intent capture:**

- During drag, the board records both the snapped hover slot **and** a continuous center probe in grid space
- The probe is resolved against the canonical `workingWidgets` layout to identify the **primary obstructed widget** under the current drag pressure
- That primary obstruction gets a transient `collisionHint` of either `up` or `down`
- The hint is local to the current drag target; it is not persisted and is not used for resize
- If the snapped slot stays the same but the drag shifts from the obstructed widget's top half to bottom half (or vice versa), that counts as a new hover target and preview is recomputed from the canonical working layout

**Packed placement search:**

- `findPackedPosition()` is row-first: for each row, it tries the widget's preferred column first, then every other legal column on that row
- This means lateral movement is considered before a lower-row fallback
- Every visible widget participates in the same packed pass, including widgets that were not directly dragged
- Mixed-size widgets use their real footprint from `SIZE_PRESETS`; a larger widget only lands where its full rectangle fits

**`stableCompact(widgets)`**: Reversed-gravity compaction — processes all visible widgets in visual order and packs each at the topmost valid position, preferring its current column. Used by hide, restore, add, migration, and general layout normalization.

**`settleBoardAfterDrop(widgets, pinnedId, targetX, targetY, targetSize?)`**: Delegates to `stableRepack`. Drag and resize commits resolve local intent, then globally pack to a compact stable layout.

### Drag Reflow During Interaction

When dragging, the board uses **grid-target-based** reflow:

- Preview reflow runs immediately when the meaningful hover target changes
- Reflow is not recomputed for every raw gesture frame; repeated events inside the same target are ignored
- Hover targets are recorded immediately on every grid-slot change
- Hover capture now also tracks a continuous center probe so directional intent can change even when the snapped slot does not
- Each preview is recomputed from the current **working layout + current hover target**; preview never chains from an older preview branch
- The latest hover target is tracked separately so that on drop, the final commit is recomputed from the true final target
- Both preview and commit use the same `stableRepack`/`settleBoardAfterDrop` path, including the same local directional collision hint, so drop results stay predictable

**Directional drag meaning:**

- Hovering the **top half** of an obstructed widget expresses a below-target displacement request when a lateral vacated-slot swap is not available
- Hovering the **bottom half** expresses an above-target displacement request when a lateral vacated-slot swap is not available
- The hint affects staged order only; the final packed layout still obeys full overlap checks and reversed gravity

### Collision Handling

Widgets cannot overlap. When moving or resizing causes overlap, the engine stages the active target, applies a local lateral-swap/displacement hint for the primary obstruction, then repacks the full visible layout.

For drag interactions, the engine now distinguishes the **primary obstructed widget** under the active hover pressure from secondary cascade widgets:

- The primary obstructed widget first tries the active widget's vacated slot when it fits, producing natural sideways swaps
- If that is not valid, the `up`/`down` hint changes staged order around the active target
- Secondary widgets are not handled by a separate cascade algorithm; they settle through the same packed pass as every other widget

After staging, global packing clears transient floating created when the dragged widget moves away or when another widget is displaced. Empty vertical gaps collapse upward across the whole layout.

### Responsive Behavior

Cell width is computed dynamically from the measured `boardWidth`. The board measures itself via `onLayout` and recalculates pixel sizes. All pixel positions flow from `gridToPixel()` and `getWidgetPixelSize()`. The grid column count is fixed at 4 regardless of device size.

### Malformed Layout Fallback

If persisted data is invalid (bad schema, unknown types, missing required widgets):

1. `validateAndMigrate()` strips invalid entries
2. Missing `profile-header` is auto-repaired
3. If recovery fails entirely, `generateDefaultLayout()` produces defaults
4. Defaults are persisted (best-effort) for owners; skipped for read-only viewers

---

## 6. State Management

### State Layers

The board has four cascading state layers, resolved in priority order:

```
Preview Widgets  (transient drag/resize preview)
    ↓ fallback
Working Widgets  (editable copy during customize mode)
    ↓ fallback
Persisted Widgets  (from useBoardPersistence)
```

Active render state = `previewWidgets ?? workingWidgets ?? persistence.widgets`

### `useBoardState` Hook

Central state management hook. Takes `userId` and optional `{ readOnly }` options.

**Return value:**

```ts
interface BoardState {
  mode: "view" | "customize";
  widgets: WidgetInstance[]; // all (visible + hidden)
  visibleWidgets: WidgetInstance[]; // visible only, position-sorted
  hiddenWidgets: WidgetInstance[]; // hidden (for gallery restore)
  occupancy: OccupancyCell[];
  loaded: boolean;
  saving: boolean;
  dragActiveId: string | null;
  actions: BoardStateActions;
}
```

**Actions (12 total):**

| Action                                    | When Used                | Effect                                                                                          |
| ----------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `enterCustomize()`                        | Long-press in view mode  | Snapshots persisted state → working copy; sets mode to `customize`                              |
| `exitCustomize()`                         | "Done" button            | Saves working widgets to Firestore; clears working/preview state; returns to `view`             |
| `cancelCustomize()`                       | "Cancel" button          | Discards working + preview state; returns to `view` (no save)                                   |
| `moveWidget(id, x, y)`                    | Drag commit              | Validates inputs; calls `moveWidget()` from engine; updates working state                       |
| `resizeWidget(id, size)`                  | Size selector            | Validates against registry; calls `resizeWidget()` from engine                                  |
| `hideWidget(id)`                          | Remove button            | Checks `canRemove` from registry; calls `hideWidget()` from engine                              |
| `restoreWidget(id)`                       | Gallery restore          | Calls `restoreWidget()` from engine; places at bottom                                           |
| `addWidget(type, size?)`                  | Gallery add              | Checks `maxInstances`; calls `addWidget()` from engine                                          |
| `updateDragPreview(id, x, y, hoverProbe)` | Continuous during drag   | Resolves preview once per meaningful hover-target change; stores latest hover target plus directional collision intent |
| `updateResizePreview(id, size)`           | Continuous during resize | 50ms throttle; calls `resolveResize()` for preview                                              |
| `commitPreview()`                         | Drag/resize end          | Commits normalized packed preview as working state; clears preview                              |
| `clearPreview()`                          | Drag/resize cancel       | Discards preview                                                                                |

### Edit State Lifecycle

```
VIEW mode
  ↓ long-press (400ms)
CUSTOMIZE mode (snapshot saved, working copy created)
  ↓ interact (drag/resize/add/hide/restore)
  ↓ each operation modifies working copy through engine
  ↓                     ↓
  Done                  Cancel
  ↓                     ↓
  Save to Firestore     Discard working copy
  ↓                     ↓
VIEW mode              VIEW mode (original layout restored)
```

### Drag Interaction State

During a drag:

1. `dragActiveId` is set to the dragged widget's instanceId
2. `latestHoverRef` always tracks the most recent hover target
3. `previewWidgets` only reflects the resolved preview branch for the **current** hover target; when the target changes, stale preview state is cleared immediately
4. `previewDescriptorRef` records which drag/resize input produced the visible preview so commit logic can ignore stale branches
5. On drop: drag commit is recomputed from scratch using the current working layout plus `latestHoverRef`; resize commit is recomputed from the working layout plus the previewed size. The committed layout does not reuse stale drag preview state, and the final board is normalized through reversed-gravity packing.

### Preview Recompute Rules

- Drag preview is always built from `workingWidgets`, never from `previewWidgets`
- A previous preview branch is never used as the source for a new hover branch
- Leaving a hovered collision zone removes the old preview immediately, so transient displacement disappears unless the new target reintroduces it
- Final drag commit prefers the true latest hover target over any older preview branch
- Resize preview still uses throttled live recomputation, but its committed result is also recomputed from the canonical working layout

### Memoization

- `visibleWidgets`: derived via `useMemo`, filtered and sorted from `activeWidgets`
- `hiddenWidgets`: derived via `useMemo`
- `occupancy`: derived via `useMemo` from `buildOccupancyMap`
- `widgetData` (in screens): large `useMemo` block assembling data for all 14 widget types
- Board actions: `useMemo` wrapping a stable `BoardStateActions` object

---

## 7. Persistence and Backend Model

### Firestore Path

`Users/{uid}/ProfileLayout/board`

### Persisted Document Shape

```ts
interface PersistedBoardLayout {
  schemaVersion: number; // currently 1 (LAYOUT_SCHEMA_VERSION)
  widgets: WidgetInstance[]; // full array of all instances
  updatedAt: string; // ISO timestamp
}
```

### Loading Lifecycle

1. `useBoardPersistence(userId, options?)` called with the target user's ID
2. Runs `getDoc()` to fetch the document
3. `validateAndMigrate()` processes the data:
   - Rejects future schema versions
   - Filters out unknown widget types
   - Normalizes missing fields (timestamps, config, pinned, visible)
   - Migrates widgets whose persisted size is no longer in `supportedSizes`
   - Ensures `profile-header` exists (auto-repairs if missing)
   - Returns `null` if unrecoverable
4. If valid data: sets widgets from validated result
5. If no data or invalid: generates defaults via `generateDefaultLayout()`
6. For **owners**: persists defaults to Firestore (best-effort)
7. For **read-only viewers**: does **not** persist defaults

### Real-Time Listener

After initial load, `onSnapshot` subscribes to the document. External changes (e.g., from another device) update local state unless a save is currently in flight (echo-guard).

**Echo-guard mechanism:** When saving, `savingRef` is set to `true`, suppressing onSnapshot updates. After `setDoc` completes, a 500ms timeout allows the echo to pass before re-enabling the listener.

### Save Flow

1. Local state is always updated immediately (optimistic)
2. If Firestore is unavailable (`firestoreAvailableRef = false`), succeeds locally only
3. Otherwise: `setDoc()` with `{ schemaVersion, widgets, updatedAt }`
4. On error: disables Firestore flag, logs warning — user doesn't lose local state

### Validation Details

| Check                           | Action                              |
| ------------------------------- | ----------------------------------- |
| Non-object data                 | Return null (fall back to defaults) |
| Missing/invalid `schemaVersion` | Return null                         |
| Future schema version           | Log warning, return null            |
| Missing `widgets` array         | Return null                         |
| Unknown `widgetType`            | Skip that widget (filter out)       |
| Invalid `instanceId`, `size`    | Skip that widget                    |
| Size not in supported sizes     | Migrate to `defaultSize`            |
| Missing `profile-header`        | Auto-insert from default layout     |
| Empty valid array               | Return null (fall back to defaults) |

### Read-Only Mode

When `readOnly: true`:

- `save()` is a no-op
- Default layout is NOT persisted to Firestore for the viewed user
- Snapshot listener still runs (to show live updates if the viewed user changes their layout)

### No Offline Cache

There is no explicit offline persistence layer (e.g., AsyncStorage backup for board layout). If Firestore is unavailable on first load, a fresh default layout is generated locally. This means **layout changes made without connectivity can be lost if the app restarts before Firestore becomes reachable**.

---

## 8. Rendering Flow

### Profile Screen Load Sequence

**OwnProfileScreen:**

1. `useAuth()` → `currentFirebaseUser.uid`
2. `useBoardState(uid)` → triggers `useBoardPersistence` → loads/subscribes to Firestore
3. Several hooks load widget data: `useProfileData`, `useFullProfileData`, `useProfilePicture`, `useGameStatsV4`, `useTopStreaks`, `useTasksSummary`, `useWallet`, `useBadges`
4. `widgetData` memo assembles a `Record<WidgetTypeId, Record<string, any>>` containing all data and callbacks
5. Once `baseProfile && !profileDataLoading && board.loaded` → renders `WidgetBoardContainer`
6. Before that: renders `<LoadingState>`

**UserProfileScreen:**

1. Extracts `userId` from route params
2. `useBoardState(userId, { readOnly: true })`
3. Loads profile, relationship, friendship details, mutual friends, game stats, activities, badges
4. Assembles `widgetData` — similar to owner but no edit callbacks, privacy-aware filtering
5. Creates `augmentedVisibleWidgets` — filters out `owner-only` widgets + appends synthetic `viewer-actions`
6. Once loaded: renders `WidgetBoardContainer` with `readOnly` and `mode="view"`

### Widget Rendering Pipeline

```
WidgetBoardContainer receives visibleWidgets[] + widgetData
    ↓
For each widget in visibleWidgets:
    1. Look up adapter: WIDGET_ADAPTERS[widget.widgetType]
    2. Look up data: widgetData[widget.widgetType]
    3. Render WidgetWrapper:
        ├── Widget receives WidgetAdapterProps: { size, data }
        ├── WidgetWrapper positions via shared values (translateX/Y)
        └── Edit overlay conditionally shown
```

### Board Height Calculation

`boardHeight` is computed from `visibleWidgets`:

- Finds the maximum bottom edge of all widgets
- In customize mode: adds `6 * (CELL_HEIGHT + GRID_GUTTER)` buffer rows for workspace
- In view mode: tight fit around content

### Widget Positioning (Animated)

All widget positions are driven by **shared values** using `react-native-reanimated`:

- `animLeft`, `animTop`: base position from grid coordinates
- `animWidth`, `animHeight`: dimensions from size preset
- `translateX`, `translateY`: gesture offset during drag
- `scale`, `zIndex`, `shadowOpacity`: visual feedback during drag
- Positions are NEVER set via static `left`/`top` layout props — always via `transform: [{ translateX }, { translateY }]`

This architecture prevents the "teleport bug" where layout recalculation causes widgets to snap to their committed position during a drag.

### Spring Animations

Two board-specific spring configs with `ReduceMotion.Never`:

- **Reflow spring** (damping: 20, stiffness: 90): passive widgets sliding out of the way
- **Snap spring** (damping: 15, stiffness: 150): dragged widget snapping to committed position after drop

`ReduceMotion.Never` is intentionally used because widget position springs are functional feedback, not decorative animation. Resolving instantly causes visual teleporting.

### Loading States

- **OwnProfileScreen**: `<LoadingState>` spinner until profile + board loaded
- **UserProfileScreen**: `<ActivityIndicator>` with back button during load; error view with "Go Back" on failure; "This profile is not available" for blocked users

### Empty/Fallback States

- If `boardWidth === 0` (pre-measurement): renders nothing
- If `visibleWidgets.length === 0`: board height is 0 (empty board)
- Gallery shows empty state when all widget types are already placed

---

## 9. Editing and Customization UX Logic

### Entering Customize Mode

- **Owner only** (OwnProfileScreen)
- Trigger: **long-press any widget** for **400ms** while in view mode
- This uses a `Gesture.LongPress(400)` on each `WidgetWrapper`
- Calls `onEnterCustomize()` → `board.actions.enterCustomize()`
- Transition: snapshots persisted widgets, creates working copy, sets mode to `"customize"`
- No navigation or screen swap — transition is in-place
- Scroll position is preserved

### Customize Mode UI

- **CustomizeModeToolbar** appears as an absolute overlay (top: 0, zIndex: 100) above the ScrollView
- Does NOT push content down — overlays on top
- Contains: Cancel, Done/Save, Add Widget
- Each WidgetWrapper shows:
  - **Remove button** (top-left minus icon) — if `canRemove === true`
  - **Drag handle** (center grip icon) — for visual cue
  - **Resize handle** (bottom-right diagonal arrows) — if `canResize === true`
- Board adds **6 extra rows** of workspace padding below content
- `RefreshControl` is disabled during customize mode

### Dragging

1. Activation: **long-press** 200ms on widget while in customize mode
2. Haptic feedback on activation (`ImpactFeedbackStyle.Heavy`)
3. Widget lifts: scale → 1.04, zIndex → 100, shadowOpacity → 0.25
4. Translation is driven by pan gesture on the UI thread (worklet)
5. Auto-scroll when near viewport edges:
   - Edge zone: 80px from top/bottom
   - Speed scales with proximity (max 12px per 16ms tick)
   - `scrollDeltaSV` shared value tracks cumulative scroll offset change
   - Pan gesture compensates `translateY` by adding scroll delta
6. Hover slot is computed from gesture translation (accounting for scroll)
7. A continuous center probe is also captured so the board can infer whether the drag is pressing the obstructed widget's top half or bottom half
8. Preview reflow runs immediately when the meaningful hover target changes; repeated raw gesture events inside the same target are ignored
9. If the hover target changes before drop, the old preview branch is cleared immediately and a new preview is computed from the canonical working layout. A change in directional intent for the same snapped slot also counts as a target change.
10. On drop: the board recomputes from the current working layout plus the latest hover target and latest local directional hint. It does **not** commit an older preview branch just because one is visible. Local collision intent plus global packing ensures transient preview pressure cannot leave stranded secondary widgets behind.
11. When the primary obstructed widget fits in the dragged widget's vacated slot, it swaps laterally before the engine considers lower-row fallback positions
12. Widget snaps to committed position with spring animation
13. Haptic success feedback

### Resizing

1. Activated by dragging the bottom-right resize handle
2. Uses a dedicated pan gesture (not the drag gesture)
3. Captures initial size at gesture start — prevents threshold compression
4. Calculates target size from vertical drag delta using midpoint thresholds between adjacent supported sizes
5. Preview updates as user drags (via `updateResizePreview`)
6. On release: commits preview — local conflict resolution + global reversed-gravity packing (same as drag drop)
7. Haptic feedback on size changes

### Hiding Widgets

1. Tap the remove button (top-left minus icon)
2. Haptic warning feedback
3. Widget set to `visible: false`
4. Board compacts remaining widgets upward
5. Widget moves to "hidden" list, available for restore in gallery

### Adding/Restoring Widgets

**Gallery opened** via "Add" button in toolbar.

Gallery features:

- Near-full-height bottom sheet (92% of screen)
- Category-grouped sections (Profile, Social, Gaming, Activity, Appearance)
- Shows only widgets NOT currently placed
- Hides non-removable widgets (can't be added because they're always present)
- Shows hidden widgets in a "Restore" section
- Each card shows icon, name, description, size badges
- Add: calls `addWidget()` → places at bottom of board → compacts
- Restore: calls `restoreWidget()` → places at bottom → compacts
- Gallery closes after add/restore

### Saving (Done)

1. Tap "Done" → haptic success
2. Calls `exitCustomize()`
3. Working widgets are saved to Firestore in their already-normalized packed arrangement
4. Working + preview state cleared
5. Mode returns to `"view"`

### Canceling

1. Tap "Cancel" → haptic light
2. Calls `cancelCustomize()`
3. Working + preview state discarded
4. Persisted state (snapshot from before customize) is restored
5. Mode returns to `"view"`

### Read-Only Viewer Restrictions

All of these are suppressed for `readOnly` boards:

- No long-press to customize
- No CustomizeModeToolbar
- No WidgetGallery
- No WidgetSizeSelector
- No remove/resize handles
- No drag gestures
- No persisted edits

---

## 10. Theming, Styling, and Visual Behavior

### Theme Integration

All widgets use `useColors()` from `ThemeContext` for surface/text/accent colors. The theme is not widget-specific — it's app-global from the user's equipped theme.

### Widget Card Styling

Each `WidgetWrapper` renders a card with:

- Background: `colors.background` with sharp corners
- Border radius: **0** — fully sharp corners for a tight modular grid appearance
- **No border in view mode** — the seam line system at the board level provides all visual separation. This eliminates the gray outline that previously competed with seams.
- In customize mode: a subtle `colors.primary + "40"` border (1.5px) is shown on the **editOverlay** element, not the content View, so it doesn’t affect content sizing.
- Shadow/elevation: animated during drag (shadow opacity 0 → 0.25)
- The wrapper provides consistent chrome; the adapter inside controls content styling

### Seam Line System (Edge-Aligned Dividers)

When two widgets share a grid boundary, a hairline-width black seam line is rendered as an overlay at the exact pixel where their edges meet. This creates a tightly packed modular dashboard aesthetic.

**Rendering strategy:**

- `computeSeamLines()` in `WidgetBoardContainer.tsx` computes all seam lines from widget adjacency
- Seam thickness: `StyleSheet.hairlineWidth` (~0.33px on iOS 3x, ~0.5px on iOS 2x, ~1px on Android) — the thinnest reliably renderable line on each platform
- Seams are absolute-positioned `View` elements with `pointerEvents="none"` and `zIndex: 2`
- zIndex 2 keeps seams above normal widgets (zIndex 1) but below the actively-dragged widget (zIndex 100)
- During active drag, the dragged widget is excluded from seam computation

**Edge alignment (not gutter-centered):**

With `GRID_GUTTER = 0`, widgets sit flush. Seam lines are placed at the exact pixel boundary where two widgets meet — not floating in empty gutter space. This means:

- No visible air gap between the seam and widget surfaces
- The seam reads as the true boundary/contact line between modules

**Intersection connectivity:**

Because all seam coordinates derive from the same `colStep` / `rowStep` grid math:

- Adjacent horizontal segments on the same row share column endpoints → visually continuous
- Adjacent vertical segments on the same column share row endpoints → visually continuous
- Crossing horizontal and vertical seams overlap at intersection pixels → clean T-junctions and + crossings
- No special junction logic needed — coordinate alignment is automatic

**Scenarios handled:**

| Layout                                 | Seam behavior                                         |
| -------------------------------------- | ----------------------------------------------------- |
| Two half-width side by side            | One vertical seam                                     |
| Full-width over full-width             | One horizontal seam across full width                 |
| Two halves under one full (T-junction) | Vertical seam + horizontal seams connect cleanly      |
| 2×2 grid (+ cross)                     | Vertical and horizontal seams form a continuous cross |
| Mixed-size partial overlap             | Seam covers only the shared boundary extent           |

### Profile Header Backgrounds

The `profile-header` widget (in `large`/`hero`/`mega` sizes) supports background images:

- Resolved via `getCosmeticAsset("background", backgroundId)`
- Rendered with `CosmeticImage` (image fills the widget)
- A gradient overlay (`LinearGradient`) darkens the bottom for text legibility
- Text uses white color + text shadow when background is present
- Text uses normal theme colors without a background

### Spacing

- Grid gutter between widgets: 0px (flush layout; seam lines provide separation)
- Board horizontal padding: `Spacing.sm` (8px)
- Internal widget padding varies by adapter

### Edit Mode Visual Feedback

- Remove button: 26px red minus circle, top-left offset
- Drag handle: gray grip dots icon, centered
- Resize handle: 28px diagonal arrow icon, bottom-right corner with 16px extra hit area
- Lifted widget: 1.04× scale, elevated zIndex (100), animated shadow
- Edit controls: opacity animated from 0 (view) to 1 (customize)
- Edit border: subtle `colors.primary + "40"` 1.5px border on the editOverlay element (only visible in customize mode; does not affect content sizing)

---

## 11. Known Risks, Fragile Areas, and Likely Bug Zones

### Critical Risk: No Offline Persistence

There is no AsyncStorage or MMKV backup for board layout state. If a user customizes their board without network connectivity:

- The optimistic local state works during the session
- `firestoreAvailableRef` is set to `false`
- If the app is killed before Firestore reconnects, changes are lost
- Upon restart with connectivity, the old persisted layout is loaded

**Impact**: Users could lose layout customizations without knowing.

### Critical Risk: Echo-Guard Race Condition

The save echo-guard uses a fixed 500ms timeout to suppress onSnapshot echoes. If:

- Network round-trip exceeds 500ms: the echo arrives after the guard lifts → duplicate state update (usually harmless but could cause a UI flash)
- Multiple rapid saves: the echo timeout is re-cleared but `savingRef` is truth-gated, not timestamp-gated

### Risk: Viewer-Actions Injection Timing

In `UserProfileScreen`, `augmentedVisibleWidgets` is computed via `useMemo` that depends on `board.visibleWidgets`. The synthetic `viewer-actions` widget is appended at `y = maxBottom` (the bottom of the last widget). If the target user adds a very long board, the viewer-actions widget could be far below the fold. There's no clamping or minimum-visibility guarantee.

### Risk: `widgetData` Stale Closures

The `widgetData` memo in both screens captures many callbacks and data values. If hook dependencies aren't correctly listed, adapters could render with stale data. The current implementation looks correct but the memo dependency array is very large and error-prone during maintenance.

### Risk: Drag Gesture + Auto-Scroll Coordination

The auto-scroll system has multiple moving parts:

- JS-thread interval timer for scrolling
- UI-thread pan gesture worklet for translation
- Shared value (`scrollDeltaSV`) bridging the two threads
- `scrollOffsetRef` tracking current scroll position

Race between JS scroll interval and gesture worklet can theoretically cause a frame of mismatch. In practice, the 16ms tick rate aligns with frame rate, but edge cases exist when the system is under load.

### Risk: `ReduceMotion.Never` on Accessibility

Board springs intentionally use `ReduceMotion.Never` to prevent teleporting. This means users with "Reduce Motion" system settings will still see widget position animations. This is a conscious accessibility trade-off documented in the code comments.

### Risk: Schema Version Forward Compatibility

If a user downgrades the app to a version with `LAYOUT_SCHEMA_VERSION < n`, their customized layout is discarded and defaults are regenerated. There's no graceful downgrade path.

### Risk: `maxInstances` Enforcement

`maxInstances` is checked in `getAvailableWidgetTypes()` and used by the gallery to filter available types. However, `addWidget()` in `BoardLayoutEngine.ts` also guards against duplicates independently. If these two checks diverge, it's possible to end up with duplicate widget instances.

### Risk: Resize Threshold Compression

The resize gesture captures the initial size at gesture start (`capturedInitialSize`) specifically to prevent threshold compression — where updating the widget size mid-gesture changes the distance-to-next-size calculation. If this capture is lost (e.g., component remount during resize), thresholds could behave erratically.

### Risk: `tasks-overview` Visibility Mode

`tasks-overview` has `visibilityMode: "all"` in the registry but is conceptually owner-centric. The `UserProfileScreen` filters out widgets with `visibilityMode: "owner-only"`, and `tasks-overview` is NOT in that category, meaning viewers **can** see the task widget on viewed profiles. Whether this is intentional or a drift from the design intent is unclear. Currently, the adapter renders task data for the viewed user anyway.

### Risk: Missing Privacy Gate on Some Widgets

`OwnProfileScreen` applies privacy-based zeroing for `friends`, `badges`, `achievements`, `social-proof`, and `recent-activity` when the corresponding privacy setting is `"nobody"`. However, `favorite-game` and `profile-stats` do not have explicit privacy gates — they render whatever data is available. If these should be privacy-gated, it's a gap.

### Fragile Area: Drag Preview Source-of-Truth

Preview correctness depends on recomputing from `workingWidgets`, not from the currently visible preview branch. Key nuances:

- Hover targets must be recorded immediately; repeated raw gesture events inside the same target are ignored, but entering a new target must resolve promptly
- Directional hover intent is part of the drag target. If the snapped slot stays the same but the drag crosses from the obstructed widget's top half to its bottom half, the target must still be treated as changed so the old preview branch is discarded
- Drag preview branches must be cleared as soon as the hover target changes; otherwise the UI can keep showing a stale displacement pattern while the user is already hovering somewhere else
- Final drag commit must prefer the latest hover target over any older preview branch. If this regresses, stale preview displacement can be saved on drop.

### Fragile Area: Stable Reflow Engine

The `stableRepack` function uses staged drag intent followed by global packed resolution. Key nuances:

- **Intent vs final position**: The drag target affects staged order and preferred column, but final rows are decided by the packed resolver. The active widget can settle upward like every other widget.
- **Lateral swap priority**: The primary obstructed widget tries the active widget's vacated slot before falling into lower rows. This is what makes same-size neighbors swap sideways naturally.
- **Preferred-column packing**: For each widget, `findPackedPosition()` scans rows from the top. On each row it tries the preferred column first, then every legal column. This preserves familiar column intent while still allowing same-row lateral reflow.
- **Target row ceiling**: Drag targets are clamped to the current content height plus a small buffer. The board can still place near the end, but raw finger movement cannot grow rows indefinitely.
- **Mixed-size safety**: Every candidate uses the widget's actual span from `SIZE_PRESETS`; no widget is placed unless the full rectangle is valid.
- **Global compaction**: All visible widgets participate in the same packed pass, so displaced widgets cannot remain lower than necessary.

### Fragile Area: Board Width 0

The board renders nothing when `boardWidth === 0` (pre-measurement). If the `onLayout` event never fires or fires with 0 width (e.g., in background navigation), the board is permanently blank. There's no timeout or fallback measurement.

### Docs-to-Code Mismatches Found During Audit

1. **PROFILE_WIDGETS_REFERENCE.md** listed `tasks-overview` as "owner only" visibility, but the registry has `visibilityMode: "all"` and `UserProfileScreen` does NOT filter it. Either the doc or the code is wrong.
2. **Earlier docs** stated `hero` is `4×3`. The actual code has `hero` as `4×4` (which is correct). The `4×3` claim in old docs was from a pre-implementation plan.
3. **WIDGET_BOARD_ARCHITECTURE.md**'s default layout table matched the code, but the doc didn't mention that `tasks-overview` is `visibilityMode: "all"` and would appear on viewed profiles.

---

## 12. Error Diagnosis Guide

### Symptom: Board is blank / shows loading spinner forever

**Likely causes:**

- `useBoardPersistence` failed to load and `loaded` is stuck at `false`
- `boardWidth` is 0 (layout event didn't fire)
- `currentFirebaseUser?.uid` is undefined (auth not loaded)

**Where to check:**

- `useBoardPersistence.ts`: check `loadLayout()` for errors and whether `setLoaded(true)` is reached
- `WidgetBoardContainer.tsx`: check `handleLayout` and `boardWidth` state
- Screen component: check the `!board.loaded` guard

**Useful logs:**

- `WidgetBoard/persistence` logger — covers load/migration errors

### Symptom: Widget positions are wrong after drag

**Likely causes:**

- The actual hovered slot was not captured or compared correctly
- Directional hover intent was not refreshed when the drag crossed from the obstructed widget's top half to bottom half within the same snapped slot
- A stale preview branch stayed visible after the hover target changed
- `commitPreview` used an older preview branch instead of recomputing from the latest hover target
- Reflow engine placed widgets at unexpected positions

**Where to check:**

- `WidgetWrapper.tsx`: `handleDragUpdate()` → verify the continuous hover probe is being computed from the dragged widget center
- `useBoardState.ts`: `updateDragPreview()` → `inferCollisionDisplacementHint()` → `resolveConflicts()` call
- `useBoardState.ts`: `commitPreview()` → verify drag commit recomputes from `workingWidgets + latestHoverRef` including `collisionHint`
- `BoardLayoutEngine.ts`: `inferCollisionDisplacementHint()` and `stableRepack()` → check primary obstruction selection, vacated-slot staging, top-half/bottom-half direction resolution, and the packed result

### Symptom: Widget teleports during drag

**Likely causes:**

- Animated shared values are being reset mid-drag
- `WidgetWrapper` received new props while dragging (component remount)
- `ReduceMotion` is unexpectedly resolving springs instantly

**Where to check:**

- `WidgetWrapper.tsx`: `useEffect` that syncs shared values — check `isDragActive` guard
- `WidgetWrapper.tsx`: ensure `BOARD_SPRINGS` use `ReduceMotion.Never`
- Verify memo comparator is preventing unnecessary re-renders

### Symptom: Changes lost after Done / layout reverts

**Likely causes:**

- Save to Firestore failed and `firestoreAvailableRef` was set to `false`
- onSnapshot echoed the old layout after save-guard timeout expired
- Working widgets were not correctly passed to `persistence.save()`

**Where to check:**

- `useBoardPersistence.ts`: `save()` function — check error path
- `useBoardPersistence.ts`: echo-guard timeout logic (500ms)
- `useBoardState.ts`: `exitCustomize()` — verify `workingWidgets` is passed to save

### Symptom: Viewed profile shows owner-only widgets

**Likely causes:**

- `visibilityMode: "owner-only"` not set on the widget in `WidgetRegistry.ts`
- `UserProfileScreen` filter in `augmentedVisibleWidgets` not checking correctly

**Where to check:**

- `WidgetRegistry.ts`: each widget's `visibilityMode` field
- `UserProfileScreen.tsx`: the `useMemo` that creates `augmentedVisibleWidgets`

### Symptom: Can't add/remove widgets — gallery empty, no remove button

**Likely causes:**

- Board is in `readOnly` mode (used for viewed profiles)
- Board mode is `"view"` not `"customize"` — enter customize first
- Gallery is showing "all placed" empty state because `maxInstances` reached for all types
- Widget has `canRemove: false` (e.g., `profile-header`)

**Where to check:**

- `WidgetBoardContainer.tsx`: `readOnly` prop suppressing gallery
- `WidgetGallery.tsx`: `categorizedWidgets` computation (filters placed types)
- `WidgetWrapper.tsx`: `canRemove` check from definition

### Symptom: Auto-scroll during drag is jittery or stuck

**Likely causes:**

- `scrollRef` not connected properly
- `scrollOffsetRef` not tracking current offset
- `scrollDeltaSV` not being read by the pan gesture worklet

**Where to check:**

- `OwnProfileScreen.tsx`: verify `scrollViewRef` passed to `WidgetBoardContainer`
- `OwnProfileScreen.tsx`: `handleScroll` → `scrollOffsetRef.current = e.nativeEvent.contentOffset.y`
- `WidgetWrapper.tsx`: auto-scroll interval → `scrollRef.current.scrollTo()`

### Symptom: Widget size reverts or won't change

**Likely causes:**

- Size not in `supportedSizes` for that widget type → `isValidSize` returns false
- `doResizeWidget` guard fails silently
- Resize preview committed but `stableRepack` moved the widget due to overlap

**Where to check:**

- `WidgetRegistry.ts`: verify `supportedSizes` for the widget type
- `useBoardState.ts`: `doResizeWidget()` — `isValidSize()` check
- `BoardLayoutEngine.ts`: `resolveResize()` → may clamp x position if wider size doesn't fit

### Symptom: Widget remains floating after temporary preview displacement

**Likely causes:**

- A stale drag preview branch was committed after the hover target changed
- The packed resolution pass did not rerun from the final working-layout + hover-target combination
- Persisted or migrated layout was loaded without `stableCompact()`

**Where to check:**

- `useBoardState.ts`: `updateDragPreview()` → confirm old preview is cleared when target changes
- `useBoardState.ts`: `commitPreview()` → confirm drag commit recomputes from `latestHoverRef`, not from `previewWidgets`
- `BoardLayoutEngine.ts`: `stableRepack()` / `stableCompact()` → confirm all visible widgets pass through row-first packing

---

## 13. Change Safety Guide

### High-Risk Shared Abstractions

| Abstraction                                  | Used By                            | Risk if Changed                                                          |
| -------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| `WidgetInstance` type                        | Every file                         | Adding/removing fields requires migration logic in `useBoardPersistence` |
| `SIZE_PRESETS`                               | Engine, wrapper, adapters, gallery | Changing values affects pixel calculations everywhere                    |
| `GRID_COLUMNS`, `CELL_HEIGHT`, `GRID_GUTTER` | Engine, wrapper, container         | Layout constant changes affect all positioning                           |
| `WidgetTypeId` union                         | Types, registry, adapters, screens | Adding a type requires updates in 4+ locations                           |
| `BoardLayoutEngine` functions                | useBoardState, WidgetWrapper       | Reflow logic changes can cascade to all drag/resize behavior             |
| `WIDGET_ADAPTERS` map                        | WidgetBoardContainer               | Missing adapter → widget renders as null                                 |
| `useBoardPersistence` read-only behavior     | UserProfileScreen                  | Accidental writes to another user's profile document                     |

### Side-Effect Chains

1. Changing `stableRepack` → affects drag preview, resize preview, commit, and settle
2. Changing `stableCompact` → affects hide, restore, add, and commit flows
3. Changing `WidgetWrapper` memo comparator → can cause excess re-renders or stale renders
4. Changing `generateDefaultLayout` → affects all new users and recovery paths
5. Changing `validateAndMigrate` → affects existing users' layout loading

### Safe Extension Points

- Adding a new widget type (see Extension Guide)
- Adding new adapter sizes within existing supported sizes
- Adding new widget data fields (in screen's `widgetData` memo)
- Adding new toolbar actions (in `CustomizeModeToolbar`)

### Dangerous Patterns to Avoid

- Never use `left`/`top` CSS for widget positioning — use animated transform
- Never mutate `workingWidgets` in place — always create new arrays
- Never call `setDoc` in read-only mode
- Never add `ReduceMotion.System` to board springs — causes teleport bug
- Never remove the `profile-header` from the default layout — validation depends on it

---

## 14. Extension Guide

### Adding a New Widget Type

1. **Add to `WidgetTypeId` union** in `types.ts`:

   ```ts
   export type WidgetTypeId = ... | "my-new-widget";
   ```

2. **Add definition to `WIDGET_DEFINITIONS`** in `WidgetRegistry.ts`:

   ```ts
   {
     widgetType: "my-new-widget",
     displayName: "My Widget",
     description: "What it does",
     icon: "icon-name",
     category: "activity",
     defaultSize: "wide",
     supportedSizes: ["wide", "large"],
     minSize: "wide",
     maxSize: "large",
     canRemove: true,
     canResize: true,
     canConfigure: false,
     defaultPlacementHint: "bottom",
     maxInstances: 1,
     visibilityMode: "all",           // or "owner-only"
     interactiveForOwnerOnly: false,
   }
   ```

3. **Create adapter component** in `adapters.tsx`:

   ```tsx
   const MyNewWidgetAdapter = memo(function MyNewWidgetAdapter({
     size,
     data,
   }: WidgetAdapterProps) {
     // render widget content based on size
   });
   ```

4. **Register adapter** in the `WIDGET_ADAPTERS` map at the bottom of `adapters.tsx`:

   ```ts
   "my-new-widget": MyNewWidgetAdapter,
   ```

5. **Add widget data** in both screens:
   - `OwnProfileScreen.tsx`: add `"my-new-widget": { ...data, ...callbacks }` to `widgetData` memo
   - `UserProfileScreen.tsx`: add `"my-new-widget": { ...data }` to `widgetData` memo (privacy-aware, no edit callbacks)

6. **Optionally add to default layout** in `generateDefaultLayout()` in `BoardLayoutEngine.ts` (only for new users; existing users won't see it unless they add it from the gallery)

7. **No schema migration needed** for adding new types — existing users' layouts are unaffected; the new type is available in the gallery

### Adding a New Size Preset

1. Add to `WidgetSizeKey` union in `types.ts`
2. Add to `SIZE_PRESETS` in `types.ts`
3. Add to `SIZE_LABELS` and `SIZE_DESCRIPTIONS` in `WidgetSizeSelector.tsx`
4. Add to `SIZE_LABELS` in `WidgetGallery.tsx`
5. Update any widget definitions' `supportedSizes` arrays
6. Bump `LAYOUT_SCHEMA_VERSION` if existing layouts could contain the new size

### Changing Persistence Schema

If the `WidgetInstance` shape changes:

1. Bump `LAYOUT_SCHEMA_VERSION` in `types.ts`
2. Update `validateAndMigrate()` in `useBoardPersistence.ts` to handle migration from older versions
3. Ensure `generateDefaultLayout()` produces the new schema
4. Test with both fresh (no saved layout) and existing (old schema) users

---

## 15. Source-of-Truth Notes

### Widget Type Definitions

**Source of truth**: `WidgetRegistry.ts` → `WIDGET_DEFINITIONS` array.
All other docs (including this one) are snapshots. When in doubt, check the registry code.

### Layout State

**Source of truth**: `Users/{uid}/ProfileLayout/board` in Firestore.
Local state is a cached/working copy. The persisted document is the durable truth.

### Widget Rendering

**Source of truth**: `WIDGET_ADAPTERS` map in `adapters.tsx`.
If a widget type has no adapter entry, it will not render (returns `null`).

### Rendered Order on Screen

**Source of truth**: The `visibleWidgets` array (sorted by `y` then `x`) determines visual order.
For viewed profiles: `augmentedVisibleWidgets` in `UserProfileScreen` (with viewer-actions appended).

### Widget Data

**Source of truth**: The `widgetData` memo in each screen (`OwnProfileScreen` / `UserProfileScreen`).
Adapters receive whatever the screen passes — they do not fetch their own data.

### Profile Identity and Visuals

**Source of truth**: `Users/{uid}` Firestore document.

### Streak Data

**Source of truth**: `Friends/{friendshipId}` documents (server-authored).

### Cosmetic Ownership

**Source of truth**: `Users/{uid}/Entitlements/{cosmeticId}` (canonical).
Legacy fields (`ownedDecorations`, `ownedThemes`) exist for back-compat only.

### Earlier Docs That Were Inaccurate

| Old Claim                                               | Reality                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| "UserProfileScreen uses a traditional card layout"      | Both screens use the board system        |
| "Social proof is a standalone section below the header" | Social proof is a board widget           |
| "Profile overview cards are fixed in order"             | Widget order is user-customizable        |
| "The default board ends at achievements"                | Default layout includes tasks and wallet |
| "hero size is 4×3"                                      | Hero is 4×4 (352px + gutters)            |
| "`tasks-overview` is owner only"                        | Registry says `visibilityMode: "all"`    |

---

## Appendix A: Timing Constants Reference

| Constant                | Value     | Location                 | Purpose                           |
| ----------------------- | --------- | ------------------------ | --------------------------------- |
| `GRID_COLUMNS`          | 4         | types.ts                 | Grid width                        |
| `GRID_GUTTER`           | 0px       | types.ts                 | No gap — seams provide separation |
| `CELL_HEIGHT`           | 88px      | types.ts                 | Base row height                   |
| `LAYOUT_SCHEMA_VERSION` | 1         | types.ts                 | Persistence version               |
| Long-press to customize | 400ms     | WidgetWrapper.tsx        | Enter customize from view         |
| Long-press to drag      | 200ms     | WidgetWrapper.tsx        | Activate drag in customize        |
| Drag target reflow      | immediate | useBoardState.ts         | Reflow once per meaningful target |
| Resize preview throttle | 50ms      | useBoardState.ts         | Minimum update interval           |
| Extra workspace rows    | 6         | WidgetBoardContainer.tsx | Customize-mode buffer             |
| Auto-scroll edge        | 80px      | WidgetWrapper.tsx        | Viewport edge trigger zone        |
| Auto-scroll max speed   | 12px/tick | WidgetWrapper.tsx        | Maximum scroll rate               |
| Auto-scroll interval    | 16ms      | WidgetWrapper.tsx        | ~60fps tick rate                  |
| Save echo-guard         | 500ms     | useBoardPersistence.ts   | Suppress onSnapshot echo          |
| Gallery sheet height    | 92%       | WidgetGallery.tsx        | Bottom sheet size                 |
| Drag scale              | 1.04      | WidgetWrapper.tsx        | Lifted widget scale               |
| Remove button size      | 26px      | WidgetWrapper.tsx        | Minus button diameter             |
| Resize handle size      | 28px      | WidgetWrapper.tsx        | Handle icon area                  |
| Resize handle hit       | 16px      | WidgetWrapper.tsx        | Extra touch target                |

## Appendix B: Adapter Visual Variants

### `profile-header` Size Variants

| Size          | Height | Avatar | Name Font | Content                                                                                                            |
| ------------- | ------ | ------ | --------- | ------------------------------------------------------------------------------------------------------------------ |
| `wide` (4×1)  | 88px   | 56px   | default   | Compact bar: PFP + name + level + action icons                                                                     |
| `large` (4×2) | 184px  | 76px   | 21px      | Medium card: PFP + name + username + status chip + level bar. Optional background image                            |
| `hero` (4×4)  | 376px  | 96px   | 26px      | Full: PFP + name + username + status + bio (2 lines) + action row + level bar. Optional background + gradient      |
| `mega` (4×6)  | 568px  | 128px  | 30px      | Expanded: PFP + name (18px username) + status + bio (5 lines) + action row + rich level bar. Background + gradient |

### Other Adapter Notes

- `social-proof`: Wide renders inline streak cards; Large adds second row with milestone progress
- `friends`/`badges`/`achievements`: Delegate to existing `FriendsCard`/`BadgesCard`/`AchievementsTrophyCaseCard` components
- `wallet-balance`: Small shows compact balance; Medium/Wide add token icon and description
- `theme-mode`/`chat-layout-mode`: Render segmented controls; non-interactive for viewers
- `viewer-actions`: Shows muted badge, last active, friendship duration, `ProfileActionsBar` with relationship actions

---

_This document was refreshed from a full codebase audit on 2026-04-24 and supersedes all prior profile-widget documentation files._
