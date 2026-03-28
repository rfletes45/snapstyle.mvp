# Profile System Migration Notes

Last verified: 2026-03-27

← Back to [Profile System Overview](PROFILE_SYSTEM_OVERVIEW.md)

This document records what changed from the old profile system to the new widget-board-based system, what was deprecated, and how to interpret old references.

## What Changed

### Old System (Pre-Widget Board)

The original profile screen (`OwnProfileScreen`) used a **fixed, linear layout**:

1. `OwnProfileHeader` — full-size editable profile header (always large)
2. `SocialProofSection` — streak row + activity row (fixed position below header)
3. `OverviewCard` stack — Friends, Badges, Achievements (fixed vertical order)

There was no concept of:

- Widget board or grid layout
- Drag-and-drop reorder
- Resizable components
- Customize mode
- Widget gallery
- Per-user layout persistence
- Removable/restorable cards

### New System (Widget Board)

The own-profile screen now hosts a **4-column grid widget board**:

- Every section is a **widget** with a type, size, and grid position
- Users can **drag, resize, add, remove, and reorder** widgets
- Layout is **persisted per-user** in Firestore (`Users/{uid}/ProfileLayout/board`)
- The profile header is now a **size-variant widget** supporting wide (4×1), large (4×2), and hero (4×4) sizes
- New widgets were added: Favorite Game, Profile Stats, Recent Activity, Mutual Friends
- The streak system was rebuilt from a simple display to a real-time friend-streak subscription

### UserProfileScreen — Unchanged

The other-user profile screen (`UserProfileScreen`) was **not** converted to the widget board. It still uses the traditional card layout with `UserProfileHeader` and `OverviewCard` stack.

## Deprecated Components and Patterns

### Deprecated Files

| File/Pattern                               | Status                                                                                                             | Replacement                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `SocialProofSection.tsx` (for own profile) | **Superseded** — still used on `UserProfileScreen` but no longer used on `OwnProfileScreen`                        | `SocialProofAdapter` in `adapters.tsx` with `useTopStreaks` hook                        |
| Old `SocialProofSection` streak tiers      | **Replaced** — old tiers (Warming Up at 7d, On Fire at 14d, Blazing at 30d, Unstoppable at 60d, Legendary at 100d) | New `STREAK_TIERS` in `adapters.tsx` — 7 tiers starting at 3 days, different thresholds |
| `profile.stats.currentStreak` field        | **No longer used by streak widget**                                                                                | `useTopStreaks` hook provides real per-friendship streak data                           |
| Fixed card stagger animation               | **Removed** from own profile                                                                                       | Widgets are positioned by grid engine; entrance animations are per-widget               |

### Deprecated Documentation

| Document                                                     | Status                                                                                                     | Replacement                                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `docs/AUDIT_ProfileSystem.md`                                | **Archived** to `docs/archive/AUDIT_ProfileSystem_2026-02-24.md` — historical audit predating widget board | New canonical docs in `docs/profile/`                                                        |
| Old Section 7 of `PROFILE_SYSTEM.md` (overview cards layout) | **Replaced** with redirect to new docs                                                                     | `docs/profile/PROFILE_WIDGETS_REFERENCE.md` and `docs/profile/INTERACTIONS_AND_EDIT_MODE.md` |
| Old streak tier table in `PROFILE_SYSTEM.md` Section 7.3     | **Removed**                                                                                                | `docs/profile/SOCIAL_WIDGETS_AND_STREAKS.md`                                                 |

### Deprecated Data Patterns

| Old Pattern                                                                                         | What It Was                                        | Current Status                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profile.stats.currentStreak`                                                                       | A cached, aggregated streak number on the user doc | **Orphaned** — no longer read by the streak widget. `useTopStreaks` now subscribes to `Friends` collection directly for per-friendship streaks. The field may still exist on user documents but is not the source of truth for the widget. |
| `SocialProofSection` props: `streakCount`, `showRecentActivity`, `onStreakPress`, `onActivityPress` | Old prop interface for the social proof component  | **Replaced** by widget data shape: `{streaks[], activeStreakCount, topStreakCount, loading, error, onPress}`                                                                                                                               |
| `SP_TIERS` constant (old)                                                                           | Old 5-tier streak badge system                     | **Replaced** by `STREAK_TIERS` (7 tiers, different thresholds)                                                                                                                                                                             |

## How to Interpret Old References

If you encounter references to the old profile system in code comments, commit messages, or other docs:

| Old Reference                                                      | Current Truth                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| "Profile layout is a fixed stack of cards"                         | Now a dynamic widget board with drag/resize                                          |
| "Social proof section shows streak row + activity row"             | Streak widget is now a standalone board widget; activity is a separate widget        |
| "Overview cards have a fixed order: Friends, Badges, Achievements" | Cards are now independent widgets that can be reordered, resized, or removed         |
| "Profile header is always full-size"                               | Hero card supports 3 sizes: wide, large, hero                                        |
| "Streak count comes from profile.stats.currentStreak"              | Streak data comes from `useTopStreaks` → real-time `Friends` collection subscription |
| "Settings button is in the navigation header"                      | Settings button is on the hero card itself, in all sizes                             |

## Key Architectural Decisions

1. **Widget board for own profile only.** The other-user profile retains the traditional layout because it serves a different purpose (relationship actions, privacy-evaluated content) and doesn't need customization.

2. **Profile hero card is non-removable.** Users can resize and reposition it, but it always exists. The persistence layer validates this invariant on every load.

3. **Real-time streak subscription.** The old `profile.stats.currentStreak` was a stale cached value. The new `useTopStreaks` hook subscribes real-time to the `Friends` collection for live per-friendship streak data.

4. **Dwell-before-reflow.** The 500ms dwell timer was added to prevent chaotic widget shuffling during drag. Without it, rapidly moving the finger across the board caused all widgets to jitter.

5. **Favorite game is auto-derived.** Rather than requiring the user to explicitly select a favorite game, it's computed from play history (most-played game). The widget registry has `configurable: true` as a placeholder for future user selection.

6. **SocialProofSection preserved for UserProfileScreen.** The old component wasn't deleted because it's still used on the other-user profile. It coexists with the new widget adapter.

## See Also

- [Profile System Overview](PROFILE_SYSTEM_OVERVIEW.md) — canonical entry point
- [Widget Board Architecture](WIDGET_BOARD_ARCHITECTURE.md) — how the new board works
- [docs/archive/AUDIT_ProfileSystem_2026-02-24.md](../archive/AUDIT_ProfileSystem_2026-02-24.md) — historical pre-widget-board audit
