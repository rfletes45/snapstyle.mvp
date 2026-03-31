# Profile Widgets Reference

Last verified: 2026-03-30

This is the current widget inventory from `WidgetRegistry.ts`.

## Widget Inventory

| Widget type | Default size | Supported sizes | Visibility | Notes |
| --- | --- | --- | --- | --- |
| `profile-header` | `hero` | `wide`, `large`, `hero` | all | non-removable |
| `social-proof` | `wide` | `wide`, `large` | all | streak and activity summary |
| `friends` | `medium` | `small`, `medium`, `wide` | all | friend list preview |
| `badges` | `medium` | `small`, `medium`, `wide` | all | featured badges |
| `achievements` | `medium` | `small`, `medium`, `wide` | all | trophy-case summary |
| `mutual-friends` | `medium` | `small`, `medium`, `wide` | all | most useful on viewed profiles |
| `favorite-game` | `medium` | `small`, `medium`, `wide` | all | derived from game stats |
| `profile-stats` | `wide` | `medium`, `wide` | all | game/profile summary |
| `recent-activity` | `wide` | `wide`, `large` | all | recent activity feed |
| `viewer-actions` | `wide` | `wide`, `large` | viewed profile only | synthetic, not persisted |
| `tasks-overview` | `wide` | `wide`, `large` | owner only | quick task summary |
| `wallet-balance` | `small` | `small`, `medium`, `wide` | all | interaction is owner-only |
| `theme-mode` | `small` | `small`, `medium`, `wide` | all | interaction is owner-only |
| `chat-layout-mode` | `small` | `small`, `medium`, `wide` | all | interaction is owner-only |

## Data and Behavior Notes

### `profile-header`

- primary identity widget
- non-removable
- backed by profile, picture, level, and appearance data

### `social-proof`

- summary of streak/activity data
- used on both owner and viewed boards

### `friends`, `badges`, `achievements`

- core overview widgets that also appear in the default layout

### `mutual-friends`

- technically available in the shared registry
- meaningful mainly when comparing the current user to another profile

### `favorite-game` and `profile-stats`

- driven by Games V4 stats rather than manually curated profile content

### `recent-activity`

- backed by user activity data and privacy-sensitive summary logic

### `viewer-actions`

- added by `UserProfileScreen`
- not saved to Firestore
- holds relationship/action UI for the viewer

### `tasks-overview`, `wallet-balance`, `theme-mode`, `chat-layout-mode`

- newer profile widgets compared to the older profile docs
- these are part of why the old documentation drifted badly

## Current Truths To Keep Straight

- there are 14 registered widget types in the current codebase
- viewed profiles are board-based, so widget docs apply there too
- `viewer-actions` is the one widget that is synthetic rather than persisted
- owner-only interaction and all-user visibility are different concerns for some widgets
