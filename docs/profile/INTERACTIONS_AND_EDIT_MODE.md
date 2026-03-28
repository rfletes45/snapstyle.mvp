# Interactions and Edit Mode

Last verified: 2026-03-27

← Back to [Profile System Overview](PROFILE_SYSTEM_OVERVIEW.md)

This document covers all user interactions on the profile widget board, including view mode, customize mode, gesture handling, sheets/modals, and known gotchas.

## View Mode

View mode is the default state. The board displays widgets as read-only cards.

### Widget Tap Actions

Each widget has a tap action that navigates to a detail screen:

| Widget            | Tap Target                  | Navigation                  |
| ----------------- | --------------------------- | --------------------------- |
| Profile Hero Card | Level indicator/bar         | Level Rewards screen        |
| Profile Hero Card | Settings button             | Settings screen             |
| Profile Hero Card | Shop button                 | Shop screen                 |
| Profile Hero Card | Customize button            | Customization Hub           |
| Profile Hero Card | Profile picture (hero only) | Picture Editor modal        |
| Profile Hero Card | Bio area (hero only)        | Bio Editor modal            |
| Profile Hero Card | Status chip (large/hero)    | Set Status screen           |
| Profile Hero Card | Display name (hero only)    | Settings screen             |
| Friends Card      | Card body                   | Friends screen              |
| Friends Card      | Friend avatar               | That friend's User Profile  |
| Badges Card       | Card body                   | Badge Collection screen     |
| Achievements Card | Card body                   | Profile Achievements screen |
| Streak Widget     | Card body                   | Friends screen              |
| Favorite Game     | Card body                   | (no navigation currently)   |
| Profile Stats     | Card body                   | (no navigation currently)   |
| Recent Activity   | Card body                   | (no navigation currently)   |
| Mutual Friends    | Card body                   | Mutual Friends list         |

### Long-Press → Enter Customize Mode

Long-pressing **any widget** for **400ms** enters customize mode. This is the only entry point. There is no explicit "Edit Profile Layout" button.

### Pull-to-Refresh

In view mode, pulling down triggers a parallel refresh of:

- `useProfileData` (level, stats, badges)
- `useProfilePicture` (avatar URL, decoration)
- `useFullProfileData` (bio, status, privacy)
- `useGameStatsV4` (global game stats)

Pull-to-refresh is disabled during customize mode.

## Customize Mode

### Entry

Triggered by long-press (400ms) on any widget in view mode.

On entry:

1. Current layout is snapshotted for potential revert
2. Working copy of widgets is created
3. Board mode switches to `"customize"`
4. Edit overlay fades in on all widgets (remove buttons, resize handles, drag handles)
5. `CustomizeModeToolbar` appears at the top with Cancel, Done, and Add buttons
6. Board adds 6 extra rows of workspace below the last widget

### Toolbar

The `CustomizeModeToolbar` shows three actions:

| Button  | Position     | Action                                                              |
| ------- | ------------ | ------------------------------------------------------------------- |
| Cancel  | Left         | Discard all changes, revert to last saved layout, exit to view mode |
| Done    | Right        | Compact layout, save to Firestore, exit to view mode                |
| Add (+) | Center-right | Open the Widget Gallery sheet                                       |

The Done button shows a saving indicator while the Firestore write is in progress.

### Edit Controls Per Widget

Each widget shows these controls in customize mode:

| Control           | Position            | Visibility                                      | Action                                                  |
| ----------------- | ------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| Remove button (−) | Top-left corner     | Only if `canRemove` (all except profile-header) | Hides widget from board                                 |
| Drag handle       | Top-center          | Always                                          | Visual indicator (cosmetic; entire widget is draggable) |
| Resize handle     | Bottom-right corner | Only if `canResize`                             | Pan to resize widget                                    |

Control dimensions:

- Remove button: 26×26px circle, red background, minus icon
- Drag handle: 32×4px rounded bar
- Resize handle: 28×28px with 16px expanded hit area

### Drag Behavior

1. **Activate:** Long-press (200ms) on widget in customize mode activates pan gesture
2. **Visual:** Widget scales up slightly and follows finger with `translateX`/`translateY`
3. **Hover:** As widget hovers over grid positions, the **dwell timer** (500ms) prevents immediate reflow
4. **Reflow:** After 500ms of stable hover, other widgets slide out of the way via spring animation
5. **Drop:** On gesture end, widget snaps to final grid position; any pending reflow commits
6. **Haptics:** Light impact on pickup and drop

### Dwell-Before-Reflow Timing

| Constant   | Value | Purpose                                                    |
| ---------- | ----- | ---------------------------------------------------------- |
| `DWELL_MS` | 500ms | Time widget must hover over same slot before board reflows |
| Throttle   | ~50ms | Minimum time between drag preview updates                  |

Rationale: Without the dwell, rapid mouse/finger movement would cause chaotic shuffling. The 500ms dwell ensures the user has **intentionally paused** at a position before other widgets rearrange.

### Resize Behavior

1. Pan the bottom-right resize handle
2. Pixel delta is mapped to grid column/row changes
3. System snaps to the nearest **supported size** for the widget type
4. Haptic feedback on each size change
5. Other widgets reflow to accommodate the new size
6. Unsupported sizes are rejected

### Widget Removal

1. Tap the red (−) button on a removable widget
2. Widget is hidden from the board (not deleted — can be restored)
3. Layout compacts to fill the gap
4. Widget appears in the "Restore" section of the Widget Gallery

Profile Hero Card has no remove button — it is non-removable.

### Widget Restoration

1. Open Widget Gallery via the Add (+) button in toolbar
2. If hidden widgets exist, a "Restore" section appears at the top
3. Tap "Restore" on a hidden widget to return it to the board
4. Widget is placed at the nearest valid position (typically bottom of board)

### Adding New Widgets

1. Open Widget Gallery via the Add (+) button
2. Browse by category: Profile, Social, Gaming, Activity
3. Tap (+) on an available widget
4. Widget is added to the board at the nearest valid position
5. Widget starts at its default size
6. Already-placed widgets show a checkmark (cannot add duplicates; max 1 instance each)

## Widget Gallery Sheet

**File:** `src/components/profile/WidgetBoard/WidgetGallery.tsx`

| Property  | Value                                                            |
| --------- | ---------------------------------------------------------------- |
| Height    | 92% of screen height                                             |
| Animation | `SlideInDown.duration(350).springify()` + `FadeIn.duration(150)` |
| Safe area | Bottom padding respects device safe area insets                  |

### Content Organization

1. **Restore Section** (conditional) — Shows all currently hidden widget instances with a "Restore" action button
2. **Available Widgets** — Grouped by category in order: Profile, Social, Gaming, Activity
   - Each widget card shows: icon, name, description (2-line truncate), supported size badges (S/M/W/L/XL)
   - Action button: (+) to add, or checkmark if already on board
   - Non-removable widgets (profile-header) are excluded from the gallery

## Sheets and Modals

### Accessible from Hero Card (View Mode)

| Sheet/Modal    | Trigger                       | Description                                                      |
| -------------- | ----------------------------- | ---------------------------------------------------------------- |
| Picture Editor | Tap avatar (hero size only)   | Modal to change profile picture or navigate to decoration picker |
| Bio Editor     | Tap bio area (hero size only) | Modal to edit profile bio text                                   |
| Set Status     | Tap status chip (large/hero)  | Navigates to Set Status screen                                   |

### Accessible from Hero Card Buttons

| Action        | Button                    | Navigation                                     |
| ------------- | ------------------------- | ---------------------------------------------- |
| Shop          | 🛍 Shop (large/hero)      | `Shop` screen — purchase cosmetics             |
| Customize     | 🎨 Customize (large/hero) | `Customization` screen — equip owned cosmetics |
| Settings      | ⚙️ (all sizes)            | `Settings` screen                              |
| Level Rewards | Tap level section         | `LevelRewards` screen                          |

### Globally Accessible Actions

Even when the hero card is in `wide` size (hiding Shop/Customize buttons), these actions remain accessible:

- **Settings** — always visible on hero card in all sizes
- **Level Rewards** — level indicator is tappable in all sizes
- **Shop and Customize** — accessible via navigation/tabs even if buttons aren't visible on the small card

### Customize Mode Sheets

| Sheet          | Trigger                          | Description                                |
| -------------- | -------------------------------- | ------------------------------------------ |
| Widget Gallery | Add (+) button in toolbar        | Browse and add/restore widgets             |
| Size Selector  | (integrated into resize gesture) | Snaps to supported sizes during resize pan |

## Gesture Architecture

### Gesture Disambiguation

The board uses `Gesture.Exclusive()` to prevent conflicts between:

- **Long-press gesture** (400ms → enter customize mode from view mode)
- **Pan gesture** (200ms activate → drag in customize mode)

These are mutually exclusive — only one can activate per touch sequence.

### Tap Through in Customize Mode

Widget taps (navigation actions) are **disabled** during customize mode. The edit overlay intercepts all touches. Only edit actions (drag, resize, remove) are active.

### Scroll vs Drag Conflict

In customize mode, the ScrollView must not steal touches from the drag gesture:

- `WidgetWrapper` uses a `GestureDetector` that takes priority
- The parent `ScrollView` scrolling is managed to not interfere with active drags

## Troubleshooting / Gotchas

### Gesture wrappers swallowing taps

If widgets stop responding to taps in view mode, check that the edit overlay's `pointerEvents` logic is correct. The overlay uses `pointerEvents: editOpacity > 0.5 ? "auto" : "none"` — if opacity transitions are stuck, taps may be swallowed.

### Drag position teleporting

The drag system uses a **teleport-proof** architecture: position is driven by `transform` not by `left/top` properties. If a widget visually teleports during drag, check that `pickupOriginRef` is being captured correctly at drag start and that `translateX`/`translateY` are being reset on drop.

### Slide animation breaking mid-reflow

Displaced widgets use `reflow` spring config (`damping: 20, stiffness: 90, mass: 1`). If animations appear jerky or incomplete, verify:

- `ReduceMotion.Never` is set on both spring configs
- Widget keys/instanceIds are stable (key changes cause remounts, losing animation state)
- The working/preview state hierarchy is correct (`preview ?? working ?? persisted`)

### Hero card missing after data corruption

The persistence layer validates that `profile-header` exists on every load. If it's somehow absent, `validateAndMigrate()` inserts it at `(0, 0)` with `hero` size. This is a safety net — if the hero card disappears, check Firestore data for corruption.

### Dwell logic not firing

If reflow never happens during drag:

- Verify `DWELL_MS` is set (500ms)
- Check `dwellTimerRef` and `dwellTargetRef` in `useBoardState.ts`
- Ensure the throttle (~50ms) isn't preventing `updateDragPreview` calls

### Customize mode vs view mode interaction confusion

```
View mode:
  - Widget taps → navigation
  - Long-press → enter customize
  - Scroll → normal scroll
  - No edit controls visible

Customize mode:
  - Widget taps → disabled (intercepted by overlay)
  - Drag → reorder widgets
  - Resize handle → resize
  - Remove button → hide widget
  - Toolbar: Cancel/Done/Add
  - Scroll → normal (except during active drag)
```

### Widget data assumptions

Future developers must not break these data-source contracts:

| Widget          | Required Data                            | Hook                                                        |
| --------------- | ---------------------------------------- | ----------------------------------------------------------- |
| profile-header  | displayName, username, level, pictureUrl | `useProfileData`, `useFullProfileData`, `useProfilePicture` |
| social-proof    | streaks array, activeStreakCount         | `useTopStreaks`                                             |
| friends         | userId, isOwnProfile                     | Friends list fetched internally                             |
| badges          | featuredBadges array                     | `useProfileData`                                            |
| achievements    | featuredAchievementIds                   | `useFullProfileData`                                        |
| favorite-game   | gameName, gamesPlayed, winRate           | `useGameStatsV4`                                            |
| profile-stats   | totalGames, totalWins, friendCount       | `useGameStatsV4`, `useProfileData`                          |
| recent-activity | activities array                         | `fetchUserActivities`                                       |

## See Also

- [Widget Board Architecture](WIDGET_BOARD_ARCHITECTURE.md) — grid model, layout engine, springs
- [Profile Hero Card](PROFILE_HERO_CARD.md) — hero card size variants and content
- [Profile Widgets Reference](PROFILE_WIDGETS_REFERENCE.md) — all widget types
- [Data and Persistence](DATA_AND_PERSISTENCE.md) — Firestore paths, data sources
