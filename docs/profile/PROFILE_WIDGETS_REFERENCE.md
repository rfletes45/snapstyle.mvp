# Profile Widgets Reference

Last verified: 2026-03-27

← Back to [Profile System Overview](PROFILE_SYSTEM_OVERVIEW.md)

This document is the canonical inventory of every widget available on the profile widget board. For the widget board architecture itself, see [Widget Board Architecture](WIDGET_BOARD_ARCHITECTURE.md).

## Widget Registry

All widgets are defined in `src/components/profile/WidgetBoard/WidgetRegistry.ts`. Content renderers are in `src/components/profile/WidgetBoard/adapters.tsx`.

### Summary Table

| Widget                                       | Type ID           | Category | Default Size | Supported Sizes     | Removable | Max |
| -------------------------------------------- | ----------------- | -------- | ------------ | ------------------- | :-------: | :-: |
| [Profile Hero Card](#profile-hero-card)      | `profile-header`  | Profile  | hero         | wide, large, hero   |    No     |  1  |
| [Streak Widget](#streak-widget-social-proof) | `social-proof`    | Activity | wide         | wide, large         |    Yes    |  1  |
| [Friends Card](#friends-card)                | `friends`         | Social   | medium       | small, medium, wide |    Yes    |  1  |
| [Badges Card](#badges-card)                  | `badges`          | Gaming   | medium       | small, medium, wide |    Yes    |  1  |
| [Achievements Card](#achievements-card)      | `achievements`    | Gaming   | medium       | small, medium, wide |    Yes    |  1  |
| [Mutual Friends](#mutual-friends)            | `mutual-friends`  | Social   | medium       | small, medium, wide |    Yes    |  1  |
| [Favorite Game](#favorite-game)              | `favorite-game`   | Gaming   | medium       | small, medium, wide |    Yes    |  1  |
| [Profile Stats](#profile-stats)              | `profile-stats`   | Gaming   | wide         | medium, wide        |    Yes    |  1  |
| [Recent Activity](#recent-activity)          | `recent-activity` | Activity | wide         | wide, large         |    Yes    |  1  |

### Widget Gallery Categories

Widgets are grouped by category in the Widget Gallery sheet:

1. **Profile** — profile-header (excluded from gallery since non-removable)
2. **Social** — friends, mutual-friends
3. **Gaming** — badges, achievements, favorite-game, profile-stats
4. **Activity** — social-proof, recent-activity

---

## Profile Hero Card

> **Detailed documentation:** [PROFILE_HERO_CARD.md](PROFILE_HERO_CARD.md)

| Property    | Value                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| Type ID     | `profile-header`                                                                 |
| Sizes       | wide (4×1), large (4×2), hero (4×4)                                              |
| Removable   | **No**                                                                           |
| Data source | `useProfileData`, `useFullProfileData`, `useProfilePicture`, `usePendingRewards` |

The main identity widget. Shows avatar, name, username, status, bio, level/progression, and action buttons. Content scales with size. The only non-removable widget.

---

## Streak Widget (Social Proof)

| Property    | Value                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| Type ID     | `social-proof`                                                                  |
| Sizes       | wide (4×1), large (4×2)                                                         |
| Removable   | Yes                                                                             |
| Data source | `useTopStreaks` hook (real-time Firestore subscription to `Friends` collection) |
| Privacy     | Respects `showStreaks` setting — data zeroed out if set to `"nobody"`           |
| Tap action  | Navigates to Friends screen                                                     |

> **Detailed documentation:** [Social Widgets and Streaks](SOCIAL_WIDGETS_AND_STREAKS.md)

### Wide Layout (4×1)

Displays the user's top streak: partner avatar, streak count (🔥), partner name, and a tier badge chip.

### Large Layout (4×2)

Rich display: hero streak highlight with partner avatar and milestone progress bar, plus a row of additional streak partners. Shows at-risk (⚠️) and grace-saved ("Saved") status pills.

### Tier System

Canonical tiers (from `adapters.tsx` `STREAK_TIERS`):

| Threshold | Label       | Emoji | Color  |
| --------- | ----------- | ----- | ------ |
| 3 days    | Warming Up  | ✨    | amber  |
| 7 days    | On Fire     | 🔥    | red    |
| 14 days   | Blazing     | 🌟    | orange |
| 30 days   | Unstoppable | ⚡    | yellow |
| 50 days   | Century     | 💪    | blue   |
| 100 days  | Legendary   | 💎    | purple |
| 365 days  | Eternal     | 👑    | gold   |

### States

| State              | Visual                                                |
| ------------------ | ----------------------------------------------------- |
| Loading            | Activity spinner with "Loading streaks..."            |
| Error              | Alert icon with "Couldn't load streaks"               |
| Empty (no streaks) | Encouragement CTA: "Start chatting to build streaks!" |
| Active streak      | Full display with count, tier, partner info           |
| At-risk streak     | ⚠️ yellow pill                                        |
| Grace-saved streak | "Saved" green pill                                    |

---

## Friends Card

| Property    | Value                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------ |
| Type ID     | `friends`                                                                                  |
| Sizes       | small (2×1), medium (2×2), wide (4×1)                                                      |
| Removable   | Yes                                                                                        |
| Data source | Friends list fetched async from Firestore                                                  |
| Privacy     | Respects `showFriendsList` — shows "Hidden from others" badge on own profile if `"nobody"` |
| Tap action  | Navigates to Friends screen                                                                |
| Avatar tap  | Navigates to that friend's UserProfile                                                     |

### Content

- Friend count header
- Row of friend avatar circles (max 8)
- "+N" overflow pill if more than max
- Wrapped in `OverviewCard` with `embedded` mode (widget board chrome stripped)

### Empty State

"No friends yet" placeholder.

---

## Badges Card

| Property    | Value                                          |
| ----------- | ---------------------------------------------- |
| Type ID     | `badges`                                       |
| Sizes       | small (2×1), medium (2×2), wide (4×1)          |
| Removable   | Yes                                            |
| Data source | `profile.featuredBadges` from `useProfileData` |
| Privacy     | Respects `showBadges` setting                  |
| Tap action  | Navigates to Badge Collection screen           |

### Content

- Total badges earned count
- Row of featured badge icons (max 5 preview)
- Badge name labels
- Wrapped in `OverviewCard` with `embedded` mode

### Empty State

"No badges earned yet" placeholder.

---

## Achievements Card

| Property    | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Type ID     | `achievements`                                                              |
| Sizes       | small (2×1), medium (2×2), wide (4×1)                                       |
| Removable   | Yes                                                                         |
| Data source | `fullProfile.featuredAchievements.achievementIds` from `useFullProfileData` |
| Privacy     | Respects `showAchievements` setting                                         |
| Tap action  | Navigates to Profile Achievements (trophy case) screen                      |

### Content

- Summary: "X / Y earned"
- Featured achievement chips (color-coded by difficulty)
- Recent (non-featured) achievements
- "View Trophy Case" CTA
- Wrapped in `OverviewCard` with `embedded` mode

### Empty State

"Play games to earn achievements!" placeholder.

---

## Mutual Friends

| Property              | Value                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type ID               | `mutual-friends`                                                                                                                                                      |
| Sizes                 | small (2×1), medium (2×2), wide (4×1)                                                                                                                                 |
| Removable             | Yes                                                                                                                                                                   |
| Data source           | `getMutualFriends(currentUserId, targetUserId)` from `profileService`                                                                                                 |
| Implementation status | **Partially implemented** — service exists but OwnProfileScreen passes empty array (mutual friends are meaningless for own profile). Functional on UserProfileScreen. |
| Tap action            | Navigates to Mutual Friends list                                                                                                                                      |

### Content

- Count of shared friends
- Row of mutual friend avatars
- Wrapped in `OverviewCard` with `embedded` mode

### Note

On own profile, this widget is always empty since mutual friends require a comparison user. It is available in the Widget Gallery but provides no useful data on the own-profile board. It is primarily meaningful on `UserProfileScreen` (traditional layout, not widget board).

---

## Favorite Game

| Property      | Value                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| Type ID       | `favorite-game`                                                                |
| Sizes         | small (2×1), medium (2×2), wide (4×1)                                          |
| Removable     | Yes                                                                            |
| Data source   | Derived from `useGameStatsV4()` — top game by `totalPlays` from personal bests |
| Configuration | `configurable: true` in registry (future: user-selected game)                  |

### Data Derivation

Favorite game is **computed, not user-selected**:

1. Fetch personal best records via `useGameStatsV4()`
2. Sort by `totalPlays` descending
3. Take the top game
4. Format: game name (title case from gameId), games played, win rate (%)

### Size Layouts

**Small (2×1):** Game icon + name + two inline stat pills (games played, win rate)

**Wide (4×1):** Header left + game name + stat pills right

**Medium (2×2):** Header + centered game icon circle + game name + stat cells bottom

### Empty State

"Play some games first!" or similar placeholder when no game stats exist.

---

## Profile Stats

| Property    | Value                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| Type ID     | `profile-stats`                                                        |
| Sizes       | medium (2×2), wide (4×1)                                               |
| Removable   | Yes                                                                    |
| Data source | `useGameStatsV4()` for games/wins; `useProfileData()` for friend count |

### Data Fields

| Stat         | Source                      | Notes                                             |
| ------------ | --------------------------- | ------------------------------------------------- |
| Total Games  | `globalStats.gamesPlayed`   | From game stats                                   |
| Total Wins   | `globalStats.gamesWon`      | From game stats                                   |
| Total Hours  | Hardcoded `0`               | **Not implemented** — no playtime tracking exists |
| Friend Count | `profile.stats.friendCount` | From profile data                                 |

### Size Layouts

**Wide (4×1):** Compact horizontal grid — 4 cells in a row. Each cell: icon + value (inline), label below.

**Medium (2×2):** 2×2 grid with generous vertical spacing. Each cell: icon, large value (22pt), label.

### Note

The "Total Hours" stat is always 0. Playtime tracking is not currently implemented anywhere in the codebase. This is a known placeholder.

---

## Recent Activity

| Property    | Value                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- |
| Type ID     | `recent-activity`                                                                         |
| Sizes       | wide (4×1), large (4×2)                                                                   |
| Removable   | Yes                                                                                       |
| Data source | `Users/{uid}/activity` Firestore subcollection, fetched via `fetchUserActivities(uid, 5)` |
| Privacy     | Respects `showRecentActivity` setting                                                     |

### Activity Types

| Type               | Icon | Example Text                  |
| ------------------ | ---- | ----------------------------- |
| `achievement`      | 🏆   | "Unlocked Sharp Shooter"      |
| `streak_milestone` | 🔥   | "7-day streak with Alex"      |
| `profile_update`   | 🎨   | "Updated profile picture"     |
| `new_friend`       | 👋   | "Became friends with Sam"     |
| `shop_purchase`    | 🛍   | "Purchased Galaxy Background" |
| `decoration_equip` | ✨   | "Equipped Flame Decoration"   |
| `status_change`    | 💬   | "Set status: Feeling great"   |

### Content

Each activity row: icon + activity text + relative timestamp ("3m ago", "2h ago", etc.)

### Empty State

"No recent activity" placeholder.

---

## Adding a New Widget Type

To add a new widget to the profile board:

1. **Register** in `WidgetRegistry.ts`: Add entry with type ID, display name, description, icon, category, supported sizes, default size, removable flag, max instances
2. **Create adapter** in `adapters.tsx`: Add a size-aware renderer component
3. **Prepare data** in `OwnProfileScreen.tsx`: Add entry to the `widgetData` memo with the widget's data payload
4. **Update default layout** in `BoardLayoutEngine.ts` `generateDefaultLayout()` if the widget should appear by default
5. **Update this document** with the new widget's reference entry

## See Also

- [Profile Hero Card](PROFILE_HERO_CARD.md) — deep dive on the hero card
- [Social Widgets and Streaks](SOCIAL_WIDGETS_AND_STREAKS.md) — streak system integration details
- [Data and Persistence](DATA_AND_PERSISTENCE.md) — canonical data sources per widget
- [Widget Board Architecture](WIDGET_BOARD_ARCHITECTURE.md) — grid model, sizes, layout engine
