# Interactions and Edit Mode

Last verified: 2026-03-30

## View Mode

View mode is the default board state.

Current behavior:

- widget taps perform their normal actions
- scrolling is enabled
- no edit controls are visible

For the owner, view mode can transition into customize mode.

For viewed profiles, the board stays read-only.

## Entering Customize Mode

Current owner-only entry path:

- long-press any widget in view mode for `400ms`

There is not a separate required “edit layout” route before board editing begins.

## Customize Mode

When customize mode starts:

- the board snapshots the saved layout
- working state becomes editable
- remove and resize controls appear where allowed
- the customize toolbar appears
- the board adds `6` extra workspace rows below the current content

Current toolbar actions:

- cancel
- done
- add/open gallery

## Dragging

Current drag behavior:

- drag activation requires a long press of `200ms` while already in customize mode
- preview reflow is dwell-based instead of instant
- dwell threshold is `500ms`

This dwell timing is important because it keeps the board from rapidly shuffling while the user moves across the grid.

## Resize

Current resize behavior:

- uses the bottom-right resize handle
- snaps to the nearest supported size for that widget type
- uses the same stable reflow engine as drag settlement

## Hide and Restore

Current removal model:

- removable widgets are hidden, not hard-deleted
- hidden widgets can be restored from the gallery
- `profile-header` cannot be removed

## Read-Only Mode

Viewed profiles pass `readOnly` through the board stack.

Current read-only effects:

- no long-press-to-customize
- no toolbar
- no gallery
- no resize UI
- no persisted edits

This is the main reason older docs that described `UserProfileScreen` as a totally separate static page are now misleading.

## Important Timing and Layout Constants

- enter customize: `400ms`
- activate drag in customize mode: `200ms`
- dwell before reflow: `500ms`
- extra workspace rows while customizing: `6`

## Current Truths To Preserve

1. Read-only viewer boards must stay non-editable.
2. Owner edits work against a working layout first, then save to Firestore.
3. Drag and resize settlement depend on the stable board engine, not ad hoc per-widget logic.
