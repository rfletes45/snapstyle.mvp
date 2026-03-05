# QA Checklist — New Game (V4 System)

> Copy this file and fill in for each new game before release.
> Replace "My Game" / `my_game` with the actual game name/ID.

## Game Info

| Field     | Value           |
| --------- | --------------- |
| Game ID   | `my_game`       |
| Game Name | My Game         |
| Mode      | `1v1` / `solo`  |
| Adapter   | `myGameAdapter` |
| PR Link   |                 |
| Tester    |                 |
| Date      |                 |

---

## 1. Adapter & Registration

- [ ] `GameAdapterV4` interface fully implemented
- [ ] Adapter registered in `src/gamesV4/adapters/registry.ts`
- [ ] `getAdapter(gameId)` returns correct adapter for `"my_game"`
- [ ] Adapter also registered in backend `firebase-backend/functions/src/gamesV4/adapters.ts`
- [ ] `initialState()` returns valid starting state
- [ ] `applyMove()` correctly validates and applies all move types
- [ ] `applyMove()` returns `{ valid: false }` for illegal moves
- [ ] `checkTermination()` detects win / draw / loss correctly
- [ ] `getScoreboard()` returns correct scores for all players

---

## 2. Game Detail Page

- [ ] Game appears in Games Hub with correct card
- [ ] GameDetailContent entry exists in `src/gamesV4/constants.ts`
- [ ] Game title, description, icon render correctly
- [ ] "Play" / "Find Match" / "Play Solo" button works
- [ ] Rules section displays correctly
- [ ] Scoreboard descriptor shows correct columns
- [ ] Leaderboard section loads (or shows empty state)
- [ ] Recent games section loads (or shows empty state)

---

## 3. Gameplay (1v1)

- [ ] Session creation via `createGameInviteV4` + `startGameFromInviteV4` callables succeeds
- [ ] Both players see correct initial state
- [ ] Moves via `submitTurnMoveV4` callable succeed for valid moves
- [ ] Invalid moves are rejected with appropriate error
- [ ] Turn alternation works correctly
- [ ] Real-time updates via Firestore listener work (opponent sees moves)
- [ ] Game terminates correctly (win / draw / forfeit)
- [ ] Timer/watchdog triggers resolution after timeout (if applicable)
- [ ] Forfeit via `forfeitSessionV4` callable works

---

## 3b. Gameplay (Solo)

- [ ] Solo session creation works
- [ ] Solo resolution triggers correctly on completion
- [ ] Score is recorded to PB
- [ ] No opponent-related UI shows for solo games

---

## 4. Game Over

- [ ] GameOverScreenV4 displays with correct result
- [ ] Winner/loser/draw state shows correctly
- [ ] Scoreboard renders with correct per-player metrics
- [ ] XP animation plays
- [ ] Level-up animation plays (if applicable)
- [ ] Achievement unlock banner shows for newly earned achievements
- [ ] "Play Again" button works (creates new session)
- [ ] "Back to Hub" navigation works
- [ ] Token rewards display correctly

---

## 5. Resolution Pipeline (Backend)

- [ ] `resolveSessionV4Internal` completes without errors
- [ ] Session status transitions to `"completed"`
- [ ] PB subcollection updated (totalPlays, totalWins, bestScore, etc.)
- [ ] Leaderboard entry written to `Leaderboard/{gameId}/weekly/{weekKey}/entries/{uid}`
- [ ] XP awarded and UserStats updated
- [ ] Level-up detection works at XP thresholds
- [ ] Achievement evaluation runs for all section achievements
- [ ] Newly earned achievements written to `Achievements/{uid}/earned/{type}`
- [ ] Token rewards credited to `Wallets/{uid}.tokensBalance`
- [ ] Game history entry written to `GameHistory/{uid}/games/{sessionId}`

---

## 6. Achievements

- [ ] Achievement section added to `ACHIEVEMENT_SECTIONS` (backend + client)
- [ ] All achievement definitions added (backend `evaluate()` + client mirror)
- [ ] Backend and client definitions match exactly (type, name, description, difficulty, tokenReward)
- [ ] Easy achievements fire correctly (first play, first win)
- [ ] Medium achievements fire correctly (10+ plays/wins)
- [ ] Hard achievements fire correctly (50+ plays/wins)
- [ ] Expert/Legendary achievements fire correctly (game-specific conditions)
- [ ] Section badge awarded when all section achievements earned
- [ ] Achievement unlock notification sent (with presence gating)
- [ ] AchievementsHubScreen shows new section
- [ ] AchievementSectionScreen shows all achievements with progress

---

## 7. Leaderboards

- [ ] Leaderboard descriptor defined in GameDetailContent
- [ ] Global weekly leaderboard populates after resolution
- [ ] Friends leaderboard filters correctly
- [ ] Leaderboard renders on GameDetailScreenV4 and GameLeaderboardScreenV4
- [ ] Correct metric shown (wins / score / time)
- [ ] Sort order is correct (desc for wins/score, asc for time)
- [ ] Weekly reset occurs (new week key appears)

---

## 8. Notifications

- [ ] Turn notification sent when opponent moves (app backgrounded)
- [ ] Turn notification NOT sent when opponent is online (presence gating)
- [ ] Achievement notification sent on unlock
- [ ] Game over notification sent to backgrounded players
- [ ] Invite notification sent via `sendInviteV4`
- [ ] Tapping each notification navigates to correct screen
- [ ] In-app banner/toast shows for real-time notifications

---

## 9. Invites & Lobby

- [ ] Invite can be sent from game detail page
- [ ] Invite appears in recipient's PinnedInviteBar
- [ ] Accepting invite joins the session correctly
- [ ] Declining invite removes it from the bar
- [ ] Expired/cancelled invites are cleaned up
- [ ] Lobby matchmaking finds opponent (if applicable)
- [ ] Lobby timeout handles gracefully

---

## 10. Game History & Stats

- [ ] Game history entry saves after resolution
- [ ] GameStatsScreenV4 shows correct lifetime stats
- [ ] Win/loss/draw counts are accurate
- [ ] Best score / best time tracked correctly
- [ ] Game history list shows recent games with correct outcomes

---

## 11. Level Rewards & XP

- [ ] XP awarded after game completion
- [ ] XP amount is correct per game type
- [ ] Level-up triggers at correct thresholds
- [ ] Level rewards claimed correctly at milestone levels
- [ ] LevelRewardsScreen shows progress bar and rewards

---

## 12. Security Rules

- [ ] Players can only read own sessions (or sessions they're in)
- [ ] Players cannot write directly to session docs (callable only)
- [ ] PB docs readable by owner only
- [ ] Achievement docs readable by owner only
- [ ] Leaderboard entries readable by all authenticated users
- [ ] No permission errors in normal gameplay flow

---

## 13. Edge Cases & Error Handling

- [ ] Double-tap on "Play" doesn't create duplicate sessions
- [ ] Submitting move on wrong turn returns error
- [ ] Submitting move to completed session returns error
- [ ] Network disconnect during move → retry works
- [ ] Closing app mid-game → can resume from session listener
- [ ] Forfeiting already-completed game returns graceful error
- [ ] Empty/malformed move payloads are rejected

---

## 14. UI/UX Polish

- [ ] Loading states show correctly (skeletons/spinners)
- [ ] Empty states show correctly (no games, no leaderboard, etc.)
- [ ] Animations play smoothly (move, capture, game over, XP)
- [ ] Haptic feedback on move (if applicable)
- [ ] Sound effects play (if applicable)
- [ ] Dark mode renders correctly
- [ ] Responsive layout on different screen sizes
- [ ] Accessibility: screen reader labels on interactive elements

---

## 15. Testing

- [ ] Unit tests for adapter: `initialState`, `applyMove`, `checkTermination`, `getScoreboard`
- [ ] Integration test: full game flow (create session → moves → resolution)
- [ ] Backend test: `resolveSessionV4Internal` with mock session data
- [ ] Achievement test: each `evaluate()` function with positive/negative ctx
- [ ] Leaderboard test: metric extraction and sorting
- [ ] Snapshot test: game detail page renders correctly
- [ ] All tests pass: `npm test`

---

## Sign-Off

| Role      | Name | Date | Status |
| --------- | ---- | ---- | ------ |
| Developer |      |      | ☐      |
| QA Tester |      |      | ☐      |
| Reviewer  |      |      | ☐      |

---

_Generated from `docs/templates/new-game-v4/qa_checklist.md`_
