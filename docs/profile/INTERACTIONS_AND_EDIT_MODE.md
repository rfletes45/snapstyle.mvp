# Interactions and Edit Mode

Last verified: 2026-04-01

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
- the customize toolbar appears as an overlay above the scroll content
- the board adds `6` extra workspace rows below the current content
- scroll position is preserved (no reset to top)
- the transition is in-place with no flicker or screen swap

Current toolbar behavior:

- the customize toolbar is rendered as a fixed overlay above the scroll content in `OwnProfileScreen`
- it does not push content down and stays visible regardless of scroll position
- it includes cancel, done, and add/gallery actions
- the gallery visible state is lifted to `OwnProfileScreen` so the overlay toolbar can trigger it

Current toolbar actions:

- cancel
- done
- add/open gallery

## Dragging

Current drag behavior:

- drag activation requires a long press of `200ms` while already in customize mode
- preview reflow is dwell-based instead of instant
- dwell threshold is `500ms`
- auto-scroll activates when the dragged widget approaches the top or bottom viewport edge
- auto-scroll trigger zone is `80px` from each viewport edge
- scroll speed scales with proximity to the edge (closer = faster, max `12px` per 16ms tick)
- auto-scroll stops when the finger moves away from the edge or the drag ends
- during auto-scroll, the dragged widget stays visually locked under the finger
- a `scrollDeltaSV` shared value tracks the cumulative scroll offset change since drag start
- the pan gesture worklet compensates `translateY` by adding the scroll delta each frame
- the hover/reorder calculation also uses the scroll-compensated translation
- this prevents drift, lag, or jumps when auto-scroll starts, runs, or stops

This dwell timing is important because it keeps the board from rapidly shuffling while the user moves across the grid.

## Resize

Current resize behavior:

- uses the bottom-right resize handle
- snaps to the nearest supported size for that widget type
- uses the same stable reflow engine as drag settlement
- the resize base size is captured at gesture start and stays fixed for the entire gesture
- this prevents threshold compression when the preview updates the widget size mid-gesture
- thresholds are determined by the midpoint between adjacent supported size heights
- each size occupies a consistent range of drag distance from the initial size

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
- auto-scroll edge zone: `80px`
- auto-scroll max speed: `12px` per tick
- auto-scroll tick rate: `16ms`

## Current Truths To Preserve

1. Read-only viewer boards must stay non-editable.
2. Owner edits work against a working layout first, then save to Firestore.
3. Drag and resize settlement depend on the stable board engine, not ad hoc per-widget logic.
4. The customize toolbar is an overlay and must not push scroll content.
5. Entering edit mode must preserve the user's scroll position.
6. Auto-scroll during drag must feel smooth and controlled, not jittery.
