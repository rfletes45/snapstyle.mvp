# In-App Notifications QA Script

> Feature: In-App (Foreground) Notifications for Turn-Based Turns + Achievement Unlocks
> Prerequisite: Two test accounts (Alice = Account A, Bob = Account B) in a shared DM or group chat.

---

## Prerequisites

- App running in dev/preview on two devices (or one device + emulator)
- Both accounts logged in
- Firestore console access for verification
- Both accounts have NOT muted the conversation

---

## Part 1: Turn In-App Notifications

### Test 1.1 — Banner appears outside Games area

| Step | Action                                                                                                | Expected                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1    | On **Alice's** device, navigate to **Inbox** (Chat List) or **Profile** — anywhere outside Games area | Alice is NOT on any Games screen                                                         |
| 2    | On **Bob's** device, open the shared chat, start a Tic-Tac-Toe game                                   | Game starts, Alice auto-joins (or manually accept)                                       |
| 3    | Play until it's Alice's turn (Bob makes the first move)                                               | Turn advances to Alice                                                                   |
| 4    | **On Alice's device**, observe the top of the screen                                                  | ✅ An in-app banner appears: **"Your turn"** with subtitle like _"Tic Tac Toe • vs Bob"_ |
| 5    | Verify the banner auto-dismisses after ~5 seconds                                                     | ✅ Banner slides away                                                                    |

**Firestore check:** `Users/{alice-uid}/InAppNotificationsV4` — a doc exists with `type: "game_turn"`, `deliveredAt` set.

### Test 1.2 — Tapping banner navigates to game

| Step | Action                                        | Expected                                                            |
| ---- | --------------------------------------------- | ------------------------------------------------------------------- |
| 1    | Repeat Test 1.1 steps 1–3                     | Banner appears on Alice's device                                    |
| 2    | **Tap** the banner before it auto-dismisses   | ✅ Alice navigates to `GamePlayV4` showing the correct game session |
| 3    | Verify the game board shows the correct state | ✅ Board matches where Bob left off                                 |

### Test 1.3 — Banner suppressed inside Games area

| Step | Action                                                       | Expected                   |
| ---- | ------------------------------------------------------------ | -------------------------- |
| 1    | On **Alice's** device, navigate to **Games Hub** (Games tab) | Alice is inside Games area |
| 2    | On **Bob's** device, make a move so it's Alice's turn        | Turn advances to Alice     |
| 3    | **On Alice's device**, observe the top of the screen         | ✅ **NO banner appears**   |
| 4    | Wait 10 seconds                                              | ✅ Still no banner         |

**Firestore check:** The `InAppNotificationsV4` doc should exist with `deliveredAt` set (marked delivered but not shown).

### Test 1.4 — Banner suppressed inside game screen

| Step | Action                                                                  | Expected                                          |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------- |
| 1    | Alice is viewing **a different game** in `GamePlayV4` or `GameOverV4`   | Still Games area                                  |
| 2    | Bob makes a move in **another** game session that makes it Alice's turn | Turn advances in 2nd game                         |
| 3    | **On Alice's device**, observe                                          | ✅ **NO banner appears** (Alice is in Games area) |

### Test 1.5 — Banner suppressed inside Achievements

| Step | Action                                            | Expected         |
| ---- | ------------------------------------------------- | ---------------- |
| 1    | Alice navigates to `AchievementsHub` inside Games | Games area       |
| 2    | Bob triggers a turn for Alice                     | Turn advances    |
| 3    | Observe Alice's screen                            | ✅ **NO banner** |

---

## Part 2: Achievement Unlocked In-App Notifications

### Test 2.1 — Achievement banner appears outside Games area

| Step | Action                                                                                                                                                                     | Expected                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1    | On **Alice's** device, navigate to **Inbox** or **Profile**                                                                                                                | Outside Games area                                                                           |
| 2    | Trigger an achievement for Alice: have her play and complete a game that earns "First Steps" (game_first_play) if not already earned, or any other unevaluated achievement | Achievement evaluates in resolve pipeline                                                    |
| 3    | **On Alice's device**, observe the top of the screen                                                                                                                       | ✅ Banner appears: **"Achievement unlocked! 🏆"** with subtitle showing the achievement name |
| 4    | Banner auto-dismisses after ~5 seconds                                                                                                                                     | ✅ Banner slides away                                                                        |

**Firestore check:** `Users/{alice-uid}/InAppNotificationsV4` — a doc with `type: "achievement_unlocked"` and `achievementIds` populated.

### Test 2.2 — Tapping achievement banner navigates to Achievements

| Step | Action             | Expected                                                                               |
| ---- | ------------------ | -------------------------------------------------------------------------------------- |
| 1    | Repeat Test 2.1    | Banner appears                                                                         |
| 2    | **Tap** the banner | ✅ Alice navigates to `AchievementsHub` (or `AchievementSection` if sectionId was set) |

### Test 2.3 — Achievement banner suppressed inside Games area

| Step | Action                                                        | Expected              |
| ---- | ------------------------------------------------------------- | --------------------- |
| 1    | Alice is on **Games Hub** or any Games screen                 | Inside Games area     |
| 2    | Trigger an achievement unlock for Alice (via game completion) | Achievement evaluates |
| 3    | Observe Alice's screen                                        | ✅ **NO banner**      |

**Firestore check:** Doc `deliveredAt` is set (silently marked delivered).

---

## Part 3: Dedupe / Collapse

### Test 3.1 — Repeated turn events don't spam

| Step | Action                                                                                                                           | Expected                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | Alice is outside Games area                                                                                                      | Ready for banner                                        |
| 2    | Bob makes a move. Alice sees the "Your turn" banner                                                                              | ✅ Banner #1                                            |
| 3    | Alice dismisses or waits for auto-dismiss                                                                                        | Banner gone                                             |
| 4    | Within 3 seconds, somehow another turn event fires for the same session (e.g., undo+redo or duplicate Cloud Function invocation) | NOTE: This is hard to trigger manually                  |
| 5    | Observe                                                                                                                          | ✅ **NO second banner** within 3-second debounce window |

**Alternative verification:** The in-app doc uses a deterministic ID based on collapseKey. Writing a second doc with the same collapseKey overwrites the first (Firestore `set`), not creating a duplicate.

### Test 3.2 — Different games produce separate banners

| Step | Action                                                       | Expected                                                                       |
| ---- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1    | Alice has two active games (Game A and Game B)               | Both in progress                                                               |
| 2    | Bob makes moves in both games making it Alice's turn in each | Two turn events                                                                |
| 3    | Observe Alice's banners (with some time between them)        | ✅ Two separate banners appear (different sessionIds = different collapseKeys) |

---

## Part 4: Security Verification (Firestore Rules)

### Test 4.1 — Client cannot modify payload/type

| Step | Action                                                                                                                  | Expected                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1    | In Firestore console or via a test script, attempt to update `type` field on an `InAppNotificationsV4` doc as the owner | ✅ **DENIED** — rules require `request.resource.data.type == resource.data.type` |
| 2    | Attempt to modify `payload` field                                                                                       | ✅ **DENIED**                                                                    |
| 3    | Attempt to modify `collapseKey` or `createdAt`                                                                          | ✅ **DENIED**                                                                    |

### Test 4.2 — Client can update deliveredAt and readAt

| Step | Action                                            | Expected       |
| ---- | ------------------------------------------------- | -------------- |
| 1    | As the owner, update `deliveredAt` to a timestamp | ✅ **ALLOWED** |
| 2    | Update `readAt` to a timestamp                    | ✅ **ALLOWED** |

### Test 4.3 — Non-owner cannot read

| Step | Action                                                      | Expected      |
| ---- | ----------------------------------------------------------- | ------------- |
| 1    | As Bob, attempt to read Alice's `InAppNotificationsV4` docs | ✅ **DENIED** |

### Test 4.4 — Client cannot create

| Step | Action                                                                  | Expected                               |
| ---- | ----------------------------------------------------------------------- | -------------------------------------- |
| 1    | As Alice, attempt to create a new doc in her own `InAppNotificationsV4` | ✅ **DENIED** — only server can create |

---

## Part 5: Edge Cases

### Test 5.1 — Banner while app is backgrounded

| Step | Action                                  | Expected                                                                                     |
| ---- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1    | Background Alice's app                  | App goes to background                                                                       |
| 2    | Bob triggers a turn for Alice           | Push notification + in-app doc written                                                       |
| 3    | Foreground Alice's app (she's on Inbox) | ✅ In-app banner may briefly appear when Firestore listener reconnects (doc was undelivered) |

### Test 5.2 — Old notifications don't pop

| Step | Action                                                 | Expected                                                        |
| ---- | ------------------------------------------------------ | --------------------------------------------------------------- |
| 1    | Trigger a turn while Alice is offline for > 30 seconds | In-app doc written but not delivered                            |
| 2    | Alice comes online                                     | ✅ Old doc (> 30s) is marked delivered silently — **NO banner** |

### Test 5.3 — Notification appears for correct user only

| Step | Action                               | Expected                                      |
| ---- | ------------------------------------ | --------------------------------------------- |
| 1    | Bob makes a move (it's Alice's turn) | Only Alice gets the in-app notification       |
| 2    | Check Bob's `InAppNotificationsV4`   | ✅ **No doc** for this event on Bob's account |

---

## Verification Checklist

- [ ] Turn banner shows outside Games area
- [ ] Turn banner taps navigate to correct game
- [ ] Turn banner suppressed inside Games area
- [ ] Achievement banner shows outside Games area
- [ ] Achievement banner taps navigate to Achievements
- [ ] Achievement banner suppressed inside Games area
- [ ] Dedupe works (same collapseKey → no duplicate banners)
- [ ] Firestore rules prevent client from modifying protected fields
- [ ] Firestore rules allow owner to update deliveredAt/readAt
- [ ] Non-owner cannot read notifications
- [ ] Old notifications don't produce banners
- [ ] Existing push notifications still work normally
