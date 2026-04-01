# Widget Board Architecture

Last verified: 2026-04-01

## Board Model

The profile board is a fixed 4-column grid.

Current layout constants:

- `GRID_COLUMNS = 4`
- `GRID_GUTTER = 8`
- `CELL_HEIGHT = 88`

Defined in `src/components/profile/WidgetBoard/types.ts`.

## Size Presets

Current size keys:

- `small` = 2x1
- `medium` = 2x2
- `wide` = 4x1
- `large` = 4x2
- `hero` = 4x4
- `mega` = 4x6 (expanded hero — profile header only)

Not every widget supports every size. The registry is the source of truth for supported sizes.

## Registry Snapshot

Registry metadata lives in `WidgetRegistry.ts`.

Categories currently in use:

- `profile`
- `social`
- `gaming`
- `activity`
- `appearance`

Important widget-specific visibility rules:

- `viewer-actions` is synthetic and not persisted
- `tasks-overview` is owner-only
- `wallet-balance`, `theme-mode`, and `chat-layout-mode` exist on both own and viewed boards, but interaction remains owner-only

## Default Layout

`generateDefaultLayout()` currently creates:

| Widget           | Size     | Position |
| ---------------- | -------- | -------- |
| `profile-header` | `hero`   | `(0, 0)` |
| `social-proof`   | `wide`   | `(0, 4)` |
| `friends`        | `medium` | `(0, 5)` |
| `badges`         | `medium` | `(2, 5)` |
| `achievements`   | `wide`   | `(0, 7)` |
| `tasks-overview` | `wide`   | `(0, 8)` |
| `wallet-balance` | `small`  | `(0, 9)` |

Widgets such as `favorite-game`, `profile-stats`, `recent-activity`, `theme-mode`, and `chat-layout-mode` are available through the gallery but not placed by default.

## Persistence

Board persistence lives at:

- `Users/{uid}/ProfileLayout/board`

The saved document currently stores:

- `schemaVersion`
- `widgets`
- `updatedAt`

`useBoardPersistence.ts` is responsible for:

- validating saved layouts
- migrating or repairing invalid widget entries
- inserting the profile header if it is somehow missing
- writing defaults for owners
- suppressing persistence for read-only viewers

## Working-State Layers

The board has several state layers:

- persisted layout from Firestore
- working layout during customize mode
- preview layout during drag/resize dwell
- active render layout, derived from preview or working state

This split is why older docs that describe the board as a single mutable array are incomplete.

## Read-Only Viewer Mode

Viewed profiles use:

- `useBoardState(userId, { readOnly: true })`
- `useBoardPersistence(userId, { readOnly: true })`

Current read-only behavior:

- loads and subscribes to the target user’s board
- does not persist defaults
- hides customize toolbar, gallery, and size controls
- disables long-press entry into customization

## Layout Engine

`BoardLayoutEngine.ts` owns:

- occupancy map construction
- placement checks
- stable repack during drag/resize
- upward compaction
- default layout generation

The current engine is deterministic and preserves visual order while healing gaps after moves or size changes.

## Key Interaction Timing

The most important board timing constants are:

- enter customize from view mode: long press `400ms`
- activate drag in customize mode: long press `200ms`
- dwell before preview reflow: `500ms`
- extra workspace rows in customize mode: `6`
- auto-scroll edge threshold: `80px` from viewport edge
- auto-scroll tick rate: `16ms` (~60fps)
- auto-scroll max speed: `12px` per tick (scales with edge proximity)

The board docs used to drift here. These values now match the checked-in code.

## Files To Read Together

- `WidgetBoardContainer.tsx`
- `WidgetWrapper.tsx`
- `useBoardState.ts`
- `useBoardPersistence.ts`
- `BoardLayoutEngine.ts`
- `WidgetRegistry.ts`

## Current Rough Edges

- some widgets are meaningful mainly in owner mode even when their definitions exist in the shared registry
- older docs may still imply that the viewer profile bypasses this board system; it does not
