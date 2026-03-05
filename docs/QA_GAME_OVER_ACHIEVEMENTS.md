# QA Test Script — GameOverV4 + Achievements + Profile Level

> Manual QA checklist for the GameOverV4 rewrite, sectioned achievements system, and profile level fix.
> Run through each section in order. Mark ✅ or ❌ per item.

---

## Prerequisites

- Two test accounts (User A, User B) in the same DM conversation
- Firebase Emulator Suite running (or staging environment)
- Both accounts have played at least 0 games (fresh state is fine)

---

## 1. Game Over Flow — Turn-Based (Tic Tac Toe)

| #    | Step                                 | Expected                                                                | ✅/❌ |
| ---- | ------------------------------------ | ----------------------------------------------------------------------- | ----- |
| 1.1  | User A creates TTT invite in DM chat | Invite card appears pinned at top                                       |       |
| 1.2  | User B joins lobby, host starts      | Both navigate to GamePlayV4                                             |       |
| 1.3  | Play to completion (win or draw)     | After terminal state, 1.5s delay, auto-navigate to GameOverV4           |       |
| 1.4  | GameOverV4 loads                     | Loading spinner shown briefly, then results appear                      |       |
| 1.5  | Hero section                         | Shows game icon + game name + "Victory!"/"Defeat!"/"Draw!" banner       |       |
| 1.6  | Scoreboard                           | Shows "MATCH RESULT" header, player names with Win/Loss/Draw labels     |       |
| 1.7  | XP section                           | Shows "+X XP" for each player, level bar, level number                  |       |
| 1.8  | Achievement unlocks (if any)         | Shows unlocked achievements with names                                  |       |
| 1.9  | Tap "Rematch" button                 | New game invite created, navigate to lobby OR new invite pinned in chat |       |
| 1.10 | Tap "Return to Chat"                 | Navigates back to DM conversation, game screens cleared from stack      |       |
| 1.11 | Press hardware back on GameOverV4    | Same as "Return to Chat" — no crash, proper navigation                  |       |

## 2. Game Over Flow — Solo (2048)

| #   | Step                                     | Expected                                                           | ✅/❌ |
| --- | ---------------------------------------- | ------------------------------------------------------------------ | ----- |
| 2.1 | Start solo 2048 from Games Hub           | Navigates to GamePlayV4                                            |       |
| 2.2 | Play until game over                     | Auto-navigate to GameOverV4                                        |       |
| 2.3 | Scoreboard                               | Shows "FINAL SCORE" header, score formatted with locale separators |       |
| 2.4 | XP section                               | Shows "+10 XP" (base only, no win bonus for solo)                  |       |
| 2.5 | Tap "Play Again"                         | Creates new solo session, navigates to GamePlayV4                  |       |
| 2.6 | Tap "Return to Games" (solo has no chat) | Navigates back to Games Hub                                        |       |

## 3. Game Over — Resign Detection

| #   | Step                                           | Expected                       | ✅/❌ |
| --- | ---------------------------------------------- | ------------------------------ | ----- |
| 3.1 | Start TTT game between A and B                 | Game active                    |       |
| 3.2 | One player resigns (via back button → confirm) | Both see GameOverV4            |       |
| 3.3 | Banner text for resigner                       | Shows "Resigned" or equivalent |       |
| 3.4 | Banner text for other player                   | Shows "Victory!"               |       |

## 4. Game Over — Loading Timeout

| #   | Step                                          | Expected                                     | ✅/❌ |
| --- | --------------------------------------------- | -------------------------------------------- | ----- |
| 4.1 | Navigate to GameOverV4 with invalid sessionId | Loading spinner appears                      |       |
| 4.2 | Wait 10 seconds                               | Timeout triggers, "Safe Exit" button visible |       |
| 4.3 | Tap "Safe Exit"                               | Navigates back, no crash                     |       |

## 5. Profile Level Bar Fix

| #   | Step                             | Expected                                                    | ✅/❌ |
| --- | -------------------------------- | ----------------------------------------------------------- | ----- |
| 5.1 | Open own profile                 | Level bar shows real level from Firestore (NOT always Lv 1) |       |
| 5.2 | Complete a game that awards XP   | Profile level bar updates (may need to re-open profile)     |       |
| 5.3 | Level up (if close to threshold) | Level number increments, XP bar resets to partial fill      |       |

## 6. Achievements Hub

| #   | Step                                     | Expected                                                                                       | ✅/❌ |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- |
| 6.1 | Open own profile → tap Achievements card | Navigates to AchievementsHub                                                                   |       |
| 6.2 | Overall progress header                  | Shows "X / 18 Achievements" with overall progress bar                                          |       |
| 6.3 | Section cards visible                    | 6 section cards: Getting Started, The Grind, Game Master, Speed Demon, Champion, Puzzle Master |       |
| 6.4 | Each card shows                          | Icon, name, description, progress bar "X / N", difficulty range text                           |       |
| 6.5 | Tap a section card                       | Navigates to AchievementSection screen for that section                                        |       |
| 6.6 | Locked section badge                     | "Claim Badge" button disabled or hidden when section incomplete                                |       |

## 7. Achievement Section Screen

| #   | Step                | Expected                                                                                     | ✅/❌ |
| --- | ------------------- | -------------------------------------------------------------------------------------------- | ----- |
| 7.1 | View section detail | Header shows section name + progress bar                                                     |       |
| 7.2 | Achievement rows    | Each row shows: check/lock icon, name, description, difficulty badge (colored), token reward |       |
| 7.3 | Earned achievements | Show green check icon, full opacity                                                          |       |
| 7.4 | Locked achievements | Show lock icon, reduced opacity (0.5)                                                        |       |
| 7.5 | Difficulty badges   | Correct colors: green (easy), blue (medium), purple (hard), orange (expert), red (legendary) |       |

## 8. Section Badge Claiming

| #   | Step                                                   | Expected                                     | ✅/❌ |
| --- | ------------------------------------------------------ | -------------------------------------------- | ----- |
| 8.1 | Complete all achievements in "Getting Started" section | Section card shows full progress             |       |
| 8.2 | "Claim Badge" button appears/enables                   | Button visible and tappable                  |       |
| 8.3 | Tap "Claim Badge"                                      | Success alert, button changes to "Claimed ✓" |       |
| 8.4 | Check Badges list                                      | New section badge appears in user's badges   |       |
| 8.5 | Re-tap "Claim Badge"                                   | No error, idempotent (already claimed)       |       |

## 9. Achievement Token Rewards

| #   | Step                                          | Expected                         | ✅/❌ |
| --- | --------------------------------------------- | -------------------------------- | ----- |
| 9.1 | Note token balance before earning achievement | Record current `tokensBalance`   |       |
| 9.2 | Earn an "easy" achievement                    | `tokensBalance` increments by 5  |       |
| 9.3 | Earn a "medium" achievement                   | `tokensBalance` increments by 15 |       |

## 10. Navigation Integrity

| #    | Step                                                                | Expected                                        | ✅/❌ |
| ---- | ------------------------------------------------------------------- | ----------------------------------------------- | ----- |
| 10.1 | GameOverV4 → Return to Chat → verify no stale game screens in stack | Back button from chat doesn't go to game screen |       |
| 10.2 | AchievementsHub → back                                              | Returns to profile                              |       |
| 10.3 | AchievementSection → back                                           | Returns to AchievementsHub                      |       |
| 10.4 | Rapid nav: GameOver → Rematch → play → GameOver → Return            | No crashes, no double-navigation                |       |

## 11. Firestore Security Rules

| #    | Step                                          | Expected         | ✅/❌ |
| ---- | --------------------------------------------- | ---------------- | ----- |
| 11.1 | User reads own `AchievementSections`          | Allowed          |       |
| 11.2 | User reads other user's `AchievementSections` | Denied           |       |
| 11.3 | User writes to own `AchievementSections`      | Denied (CF-only) |       |

---

## Sign-off

| Tester | Date | Result | Notes |
| ------ | ---- | ------ | ----- |
|        |      |        |       |
