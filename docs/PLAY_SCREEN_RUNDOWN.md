# Main Play Screen Rundown

Last updated: 2026-02-21
Last verified against code: 2026-02-21
Primary screen owner: `src/screens/games/GamesHubScreen.tsx`

---

## 1. Scope

This document explains the current Play tab main screen behavior in production code, with emphasis on:

- layout and rendering order
- active games and invites sections
- achievements and leaderboard entry flows
- press-and-hold quick actions on game cards/tiles

This is a current-state implementation rundown, not a future plan.

---

## 2. Route And Navigation Contract

Play tab stack root:

- `Play` tab -> `PlayStack` -> `GamesHub` (`src/navigation/RootNavigator.tsx`)

Key Play routes:

- `GamesHub`
- game screens (`BounceBlitzGame`, `ChessGame`, `StarforgeGame`, etc.)
- `GameDetails` (`{ gameId: string }`)
- `Leaderboard` (`{ gameId?: string } | undefined`)
- `Achievements` (`{ gameId?: string } | undefined`)
- `GameHistory`

Route params are typed in:

- `src/types/navigation/root.ts`

Tab-bar behavior:

- `Leaderboard`, `Achievements`, `GameHistory`, and `GameDetails` are in `ROUTES_WITH_HIDDEN_TAB_BAR` (`src/navigation/RootNavigator.tsx`), so Play utility screens open full-screen.

Navigation mapping from game id -> screen:

- `GAME_SCREEN_MAP` in `src/config/gameCategories.ts`

---

## 3. Main Screen Ownership And State

`GamesHubScreen` is the orchestration layer for Play home:

- loads personal bests, recent sessions, active matches, and invites
- owns search/filter state
- owns quick-action modal state for long-press actions
- dispatches navigation to games, leaderboards, achievements, and history

Main state groups in `src/screens/games/GamesHubScreen.tsx`:

- data: `personalBests`, `singlePlayerHighScores`, `recentGames`, `recentSinglePlayerGames`
- multiplayer: `activeGames`, `universalInvites`
- search: `searchQuery`, `searchFilters`, `selectedFilterChip`, `isSearchFocused`
- quick actions: `quickActionsVisible`, `selectedGameForQuickActions`
- view mode: `showExpandedActiveGames`

Quick action state drives the `GameLongPressSheet` bottom-sheet overlay.

---

## 4. Data Lifecycle On Play Screen

### 4.1 Initial/focus loading

`loadData()` fetches in parallel:

- `getAllPersonalBests`
- `getRecentGames`
- `getAllHighScores`
- `getRecentSessions`
- `getActiveMatches`

Focus listener (`navigation.addListener("focus", ...)`) reruns `loadData()` when returning to Play.

### 4.2 Realtime subscriptions

`useEffect` subscriptions keep sections live:

- `subscribeToActiveMatches` -> updates `activeGames`
- `subscribeToPlayPageInvites` -> updates `universalInvites`

### 4.3 Pull to refresh

`RefreshControl` calls `handleRefresh` -> sets `refreshing` and reruns `loadData()`.

### 4.4 Daily completion check

On focus, `isDailyGameCompleted("word_master", today)` is used to populate daily completion UI state.

---

## 5. Render Pipeline And Layout

Top-level rendering in `GamesHubScreen` is:

1. loading state (`LoadingState`)
2. error state (`ErrorState`)
3. normal content tree

Normal content tree order:

1. optional 3D background overlays (`THREE_JS_FEATURES`)
2. header (`PlayHeader`) if `PLAY_SCREEN_FEATURES.NEW_HEADER`
3. search bar (`PlaySearchBar`) if `PLAY_SCREEN_FEATURES.SEARCH_BAR`
4. content branch decision
5. search branch: `SearchResultsView` when `SEARCH_LOGIC && isSearchActive`
6. main branch: `ScrollView` sections when search is not active (active games, invites, profile header, categories, optional recent games)
7. long-press sheet (`GameLongPressSheet`) when long-press target exists

Section details:

- Active games: mini layout (`ActiveGamesMini`) by default, full layout (`GameFilterBar` + `ActiveGamesSection`) after "View All".
- Invites: compact banner (`GameInvitesBanner`) when enabled, fallback full invite cards when disabled.
- Profile: `EnhancedGamesProfileHeader` when enabled, legacy inline profile card when disabled.
- Categories: carousel mode (`GameCategoryCarousel` and `DailyChallengeCard`) when enabled, legacy vertical `CategorySection` lists when disabled.
- Recent games: hidden because `PLAY_SCREEN_FEATURES.REMOVE_RECENT_GAMES` is `true`.

---

## 6. Achievements And Leaderboards Integration

Global entry points from header:

- trophy icon -> `navigate("Leaderboard")`
- medal icon -> `navigate("Achievements")`
- history icon -> `navigate("GameHistory")`

Scoped entry points from long-press sheet:

- "View more" action -> `navigate("GameDetails", { gameId })` -> full Steam-like hub page
- "Play" action -> navigates directly to game screen

From `GameDetailsScreen`, further scoped navigation:

- "View All Achievements" -> `navigate("Achievements", { gameId })`
- "Open Full Leaderboard" -> `navigate("Leaderboard", { gameId })`
- "View Full History" -> `navigate("GameHistory")`

### 6.1 Leaderboard screen behavior

`src/screens/games/LeaderboardScreen.tsx`:

- reads optional `route.params.gameId` as initial selected game
- supports game-specific modes by category: multiplayer, legacy, and single-player
- multiplayer: global/friends + timeframe (`all-time`/`monthly`/`weekly`)
- legacy: global/friends + week navigation
- single-player: weekly single-player leaderboard API
- highlights current user and shows rank summary card

### 6.2 Achievements screen behavior

`AchievementsScreen` is a thin wrapper to `AchievementsV2Screen`.

`src/screens/games/AchievementsV2Screen.tsx`:

- reads optional `route.params.gameId` to scope to one game
- no gameId: shows tabs (`global`, `single_player`, `turn_based`, `real_time`)
- uses `useAchievementsV2` realtime hook
- groups achievements into collapsible sections with per-section progress
- summary card shows unlocked/available, completion percent, XP, and tier counts

---

## 7. Press-And-Hold Features On Game Surfaces

Long-press gesture delay is consistently `400ms` on primary game browse components:

- `ModernGameCard`
- `CarouselGameTile`
- `DailyChallengeCard`

Long-press behavior:

1. heavy haptic feedback
2. set selected game id in `GamesHubScreen`
3. open `GameLongPressSheet`
4. user sees game icon, name, tagline
5. user chooses "View more" (-> `GameDetails` screen) or "Play" (-> game screen)

Sheet behavior (`src/screens/games/components/GameLongPressSheet.tsx`):

- animated slide-up bottom sheet with backdrop
- medium haptic on action press
- light haptic on backdrop close
- safe-area-aware padding

Search results cards in `SearchResultsView` also support `onLongPress`, providing full parity with browse surfaces.

---

## 7.1 GameDetails Screen

`src/screens/games/GameDetailsScreen.tsx`:

- Route: `GameDetails({ gameId: string })`
- Steam-like hub page showing everything about one game in one place
- Sections: Hero header (icon, name, tagline, quick stat chips, tags, Play button), About (long description + how-to-play), Achievements preview (progress bar + top 6 items + "View All"), Leaderboard preview (top 10 table with medal emojis + "Open Full"), Your Stats (2x2 stat tile grid), Recent Games (last 5 sessions, single-player only)
- Data sources: `useAchievementsV2` (realtime), `getPersonalBest`, `getAllHighScores`, `getSinglePlayerLeaderboard`/`getMultiplayerGlobalLeaderboard`, `getRecentSessions`
- Each section fetches independently with per-section loading spinners
- Auto-detects single-player vs multiplayer to select correct leaderboard API
- Navigates to Achievements, Leaderboard, and GameHistory screens scoped by gameId

---

## 8. Current Play Feature Flag Snapshot

From `constants/featureFlags.ts`:

- `NEW_HEADER: true`
- `SEARCH_BAR: true`
- `SEARCH_LOGIC: true`
- `CATEGORY_MODERN_CARDS: true`
- `CARD_PERSONAL_BEST: true`
- `CARD_PLAY_BUTTON: true`
- `COMPACT_BROWSE_CARDS: false`
- `CATEGORY_CAROUSELS: true`
- `INVITES_BANNER: true`
- `ACTIVE_GAMES_MINI: true`
- `REMOVE_RECENT_GAMES: true`
- `ENHANCED_PROFILE_HEADER: true`

Effective result:

- modern Play home is fully enabled except compact browse cards
- recent games section is intentionally removed from current UI path

---

## 9. Layout/Behavior Notes That Matter During Changes

- `showExpandedActiveGames` only toggles to `true` from mini mode ("View All"); there is no in-screen toggle back to mini until remount.
- `PlayHeader` accepts `inviteCount`, but the current UI does not render invite badge from that prop.
- `PlaySearchBar` accepts `isFocused`, but current component logic does not use that prop internally.
- `handleClearSearch` exists in `GamesHubScreen` but is not currently wired to `PlaySearchBar`.
- Daily completion check on focus currently targets `word_master`.

---

## 10. Source File Map

Primary:

- `src/screens/games/GamesHubScreen.tsx`
- `src/navigation/RootNavigator.tsx`
- `src/types/navigation/root.ts`
- `constants/featureFlags.ts`

Play components:

- `src/screens/games/components/PlayHeader.tsx`
- `src/screens/games/components/PlaySearchBar.tsx`
- `src/screens/games/components/SearchResultsView.tsx`
- `src/screens/games/components/GameCategoryCarousel.tsx`
- `src/screens/games/components/ModernGameCard.tsx`
- `src/screens/games/components/CarouselGameTile.tsx`
- `src/screens/games/components/DailyChallengeCard.tsx`
- `src/screens/games/components/GameLongPressSheet.tsx`
- `src/screens/games/GameDetailsScreen.tsx`
- `src/screens/games/components/ActiveGamesMini.tsx`
- `src/screens/games/components/ActiveGamesSection.tsx`
- `src/screens/games/components/GameInvitesBanner.tsx`
- `src/components/games/EnhancedGamesProfileHeader.tsx`

Achievements and leaderboards:

- `src/screens/games/LeaderboardScreen.tsx`
- `src/screens/games/AchievementsScreen.tsx`
- `src/screens/games/AchievementsV2Screen.tsx`
- `src/hooks/useAchievementsV2.ts`

Supporting config/types:

- `src/types/playScreen.ts`
- `src/utils/gameSearch.ts`
- `src/config/gameCategories.ts`
