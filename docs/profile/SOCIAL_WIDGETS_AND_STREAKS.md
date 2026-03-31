# Social Widgets and Streaks

Last verified: 2026-03-30

## Scope

This doc covers the social/profile widgets and the streak data that feeds them:

- `social-proof`
- `friends`
- `mutual-friends`
- `recent-activity`
- `viewer-actions`

## Streak Authority

Current streak authority is the `Friends` collection.

Important rule:

- streak data is server-authored friendship data
- it is not owned by a cached field on the user profile document

This is one of the biggest places older profile docs drifted.

## Social Widget Roles

### `social-proof`

Purpose:

- summarize streak and social activity information

Current notes:

- used on both owner and viewed boards
- fed by streak/social data rather than a fixed legacy card component

### `friends`

Purpose:

- show friend count and a preview of the friend graph

### `mutual-friends`

Purpose:

- show overlap between the viewer and the viewed profile

Current note:

- this widget is inherently more useful on viewed profiles than on your own board

### `recent-activity`

Purpose:

- show recent profile/game/social activity summaries

### `viewer-actions`

Purpose:

- carry viewer-side relationship and action UI

Current note:

- it is synthetic
- it is appended by `UserProfileScreen`
- it is not stored in the target user’s board document

## Legacy Component Note

`SocialProofSection.tsx` still exists in the codebase, but it is no longer the canonical surface for the current board-driven profile runtime.

## Current Truths To Preserve

1. Social widgets are board widgets now, not a fixed section under a legacy header.
2. Streaks come from friendship data, not a single summary field on `Users/{uid}`.
3. `viewer-actions` is synthetic and should stay out of persisted layouts.
