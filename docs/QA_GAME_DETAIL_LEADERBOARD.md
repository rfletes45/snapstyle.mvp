# QA Script — Game Detail, Leaderboards, History & Achievements Refactor

> Covers all changes from the follow-up refinement pass.
> Prerequisites: Two test accounts (Alice, Bob) who are friends. At least one game played.

---

## 1. Achievement Section Restructure

| #   | Action                                                        | Expected                                                                                                            |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Navigate to Games Hub → tap "Achievements & Progress" card    | AchievementsHub opens showing **4 sections**: Tic Tac Toe, Connect Four, 2048 Mastery, Milestones                   |
| 1.2 | Tap "Tic Tac Toe" section                                     | Section detail loads with 3 achievements (ttt_perfect_game + 2 general). Each shows difficulty badge + token reward |
| 1.3 | Verify "Connect Four" section                                 | Shows 3 achievements including c4_quick_connect                                                                     |
| 1.4 | Verify "2048 Mastery" section                                 | Shows 4 achievements (2048_reached_2048, 2048_reached_4096, game_mastery_10, game_mastery_50)                       |
| 1.5 | Verify "Milestones" section                                   | Shows 8 general achievements (first play, first win, session/win counts)                                            |
| 1.6 | Verify total count                                            | Top progress bar shows `earned / 18` total                                                                          |
| 1.7 | If any section is complete, verify "Claim Badge" button works | Badge claimed alert appears, checkmark icon shows                                                                   |

---

## 2. Profile Achievements Card

| #   | Action                          | Expected                                                                                       |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| 2.1 | Navigate to Profile tab         | GamesAchievementsCard visible in OverviewCards section                                         |
| 2.2 | Verify card content             | Shows trophy icon, earned/total count, up to 5 recent achievement chips with difficulty colors |
| 2.3 | Tap "View in Games" or the card | Navigates to Games tab (not to AchievementsHub directly)                                       |
| 2.4 | With 0 achievements             | Card shows "Start playing games to earn achievements!"                                         |

---

## 3. Games Hub Updates

| #   | Action                                 | Expected                                                                             |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| 3.1 | Open Games tab                         | "Achievements & Progress" card visible between active games and how-to-play sections |
| 3.2 | Card shows trophy icon + progress text | "X / 18 achievements earned"                                                         |
| 3.3 | Tap the achievements card              | Navigates to AchievementsHub                                                         |
| 3.4 | Tap a multiplayer game (TTT or C4)     | Navigates to **GameDetailV4** (NOT GameLeaderboardV4)                                |
| 3.5 | Tap a solo game (2048)                 | Still starts solo session directly (no change)                                       |

---

## 4. Game Detail Page ("Steam-like")

### 4.1 Overview Section

| #     | Action                              | Expected                                                                         |
| ----- | ----------------------------------- | -------------------------------------------------------------------------------- |
| 4.1.1 | Navigate to Tic Tac Toe detail page | Shows game icon (64px), "Tic Tac Toe" title, "Turn-Based · 2–2 players" subtitle |
| 4.1.2 | Verify description                  | Short description visible + "How to Play" section                                |
| 4.1.3 | Verify tips                         | Yellow lightbulb tip box visible                                                 |

### 4.2 Play Actions

| #     | Action                              | Expected                                                 |
| ----- | ----------------------------------- | -------------------------------------------------------- |
| 4.2.1 | On solo game (2048) detail          | "Play Now" button visible. Tapping launches solo session |
| 4.2.2 | On multiplayer game (TTT/C4) detail | Info box says "Challenge a friend from any chat..."      |

### 4.3 Your Progress Section

| #     | Action                 | Expected                                                                  |
| ----- | ---------------------- | ------------------------------------------------------------------------- |
| 4.3.1 | With games played      | Shows achievement progress bar (X/N), Plays count, Wins count, Best score |
| 4.3.2 | With no games played   | Shows "Play your first match to start tracking progress!"                 |
| 4.3.3 | Verify stat formatting | PB value uses SCOREBOARD_DESCRIPTORS format                               |

### 4.4 Leaderboard Section

| #     | Action                              | Expected                                                                              |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| 4.4.1 | Global tab (default)                | Shows top 10 entries with rank, name, score. Current user highlighted                 |
| 4.4.2 | Medals for top 3                    | 🥇🥈🥉 emojis instead of #1 #2 #3                                                     |
| 4.4.3 | Score formatting                    | Uses LEADERBOARD_DESCRIPTORS formatValue (e.g., "5 wins" for TTT, raw score for 2048) |
| 4.4.4 | Switch to Friends tab               | Loads friends leaderboard (lazy load). Shows friend display names                     |
| 4.4.5 | Friends tab with no friends playing | Shows empty state message                                                             |
| 4.4.6 | Switch back to Global               | Shows global data without re-fetching                                                 |

### 4.5 Achievements Section

| #     | Action                     | Expected                                                                            |
| ----- | -------------------------- | ----------------------------------------------------------------------------------- |
| 4.5.1 | View per-game achievements | Shows game-specific achievements only (not all 18)                                  |
| 4.5.2 | Earned achievements        | Green check-circle icon, full opacity                                               |
| 4.5.3 | Locked achievements        | Lock icon, reduced opacity                                                          |
| 4.5.4 | Difficulty badges          | Colored badges (Easy=green, Medium=blue, Hard=orange, Expert=red, Legendary=purple) |
| 4.5.5 | More than 5 achievements   | "Show All (N)" button appears. Tap expands list. "Show Less" collapses              |

### 4.6 Game History Section

| #     | Action              | Expected                                                           |
| ----- | ------------------- | ------------------------------------------------------------------ |
| 4.6.1 | With matches played | Shows "vs. OpponentName" + date + duration + Win/Loss/Draw         |
| 4.6.2 | Solo game history   | Shows "vs. Solo"                                                   |
| 4.6.3 | Multi-opponent      | Shows "vs. Player1 +N"                                             |
| 4.6.4 | Outcome colors      | Win=green, Loss=red, Draw=orange                                   |
| 4.6.5 | More than 5 entries | "View More (N)" button appears. Tap expands. "Show Less" collapses |
| 4.6.6 | No history          | Shows "No games played yet. Play your first match!"                |

---

## 5. Game Stats Screen Updates

| #   | Action                       | Expected                                                           |
| --- | ---------------------------- | ------------------------------------------------------------------ |
| 5.1 | Navigate to My Stats         | Recent Games shows opponent names: "Tic Tac Toe vs. Bob"           |
| 5.2 | Win/Loss/Draw colors         | Win=green, Loss=red, Draw=orange (was: green/red only)             |
| 5.3 | Win detection                | Uses `winnerIds.includes(uid)` (fixed: was `winnerIds.length > 0`) |
| 5.4 | Achievements with >5 earned  | "Show All (N)" button appears. Tap expands                         |
| 5.5 | Game history with >5 entries | "View More (N)" button appears. Tap expands                        |

---

## 6. Navigation + Deep Links

| #   | Action                                     | Expected                        |
| --- | ------------------------------------------ | ------------------------------- |
| 6.1 | Deep link `vibe://game/detail/tic_tac_toe` | Opens Tic Tac Toe detail page   |
| 6.2 | Back button from Game Detail               | Returns to Games Hub            |
| 6.3 | Game not found                             | Shows "Game not found." message |

---

## 7. Regression Checks

| #   | Action                              | Expected                                                           |
| --- | ----------------------------------- | ------------------------------------------------------------------ |
| 7.1 | Full multiplayer game flow (TTT)    | Create invite → join → play → game over → all works                |
| 7.2 | Solo game flow (2048)               | Start from hub → play → game over → stats recorded                 |
| 7.3 | Achievement unlocking               | New achievement appears in both Hub and Profile card               |
| 7.4 | Existing achievements still visible | Previously earned achievements show up under new section structure |
| 7.5 | GameLeaderboardV4 still accessible  | Direct navigation to `GameLeaderboardV4` route still works         |
