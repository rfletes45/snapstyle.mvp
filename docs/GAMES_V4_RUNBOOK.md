# Games V4 Runbook — Ops / Debug / Test Guide

> Companion to [GAMES_V4_SYSTEM.md](GAMES_V4_SYSTEM.md).
> Last updated: 2026-03-10
> Status note: this runbook is operational guidance only. Current architecture, counts, and runtime classification live in [GAMES_V4_SYSTEM.md](GAMES_V4_SYSTEM.md).

---

## Table of Contents

1. [Quick Smoke Test Checklist](#1-quick-smoke-test-checklist)
2. [Emulator / Dev Setup Notes](#2-emulator--dev-setup-notes)
3. [Debugging Guide](#3-debugging-guide)
4. [Common Failure Modes + Fix Playbook](#4-common-failure-modes--fix-playbook)
5. [Reconciliation / Watchdog Behavior](#5-reconciliation--watchdog-behavior)
6. [Performance Watchlist](#6-performance-watchlist)
7. [Regression Test Plan](#7-regression-test-plan)
8. [Release Readiness Checklist](#8-release-readiness-checklist)
9. [Error Code Quick-Reference](#9-error-code-quick-reference)

---

## 1. Quick Smoke Test Checklist

Run in order. All steps assume two test accounts (Alice, Bob) in a shared group chat.

| #   | Action                                 | Expected                                              | Firestore check                                                                              |
| --- | -------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Alice taps gamepad → picks Tic-Tac-Toe | Invite chip appears in PinnedInviteBar for both users | `GameInvitesV4/{id}` exists, `status: "sent"`, group `pinnedGameInviteIds` contains inviteId |
| 2   | Bob taps invite chip → Lobby screen    | Shows game name, Alice as host, "Join" button         |                                                                                              |
| 3   | Bob taps "Join"                        | Participant count → 2. Bob sees "Waiting for host"    | `invite.participantIds` has both UIDs, `status: "lobby"`                                     |
| 4   | Alice taps "Start Game"                | Both users auto-navigate to TicTacToeScreenV4         | `GameSessionsV4/{id}` created, `status: "active"`, `PublicState/state` exists                |
| 5   | Alice (X) taps center cell             | Board shows X at (1,1). Turn indicator → Bob          | `Moves/{id}` with `status: "committed"`, session `currentTurnPlayerId` → Bob                 |
| 6   | Alternate moves until win or draw      | Game resolves. Both auto-navigate to GameOverScreenV4 | Session `status: "resolved"`, `GameResultsV4/{id}` exists                                    |
| 7   | Verify end screen                      | Shows winner/draw, scoreboard, XP awarded             | Check `Users/{uid}.level.totalXp` incremented                                                |
| 8   | Navigate to Leaderboard                | Entries appear for both players                       | `LeaderboardsV4/tic_tac_toe/Weeks/{wk}/Entries/{uid}` exists                                 |
| 9   | Navigate to My Stats                   | Shows PB, achievements, history                       | `Users/{uid}/GamePB/tic_tac_toe` exists with `integrityHash`                                 |
| 10  | Return to chat                         | Invite chip should be gone or show "resolved"         | `pinnedGameInviteIds` no longer contains inviteId (unpinned)                                 |
| 11  | Wait ~1 hour (or trigger watchdog)     | Invite hard-deleted                                   | `GameInvitesV4/{id}` should not exist                                                        |

**Solo smoke test (2048):**

Solo games bypass the invite/lobby/pin system entirely (see SYSTEM doc §6.7).

| #   | Action                               | Expected                                                          | Firestore check                                                                         |
| --- | ------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Alice opens Games Hub → taps 2048    | Client calls `resumeOrCreateSoloSession({ gameId: "play_2048" })` | `GameSessionsV4/{id}` created, `status: "active"`, `inviteId: ""`, `conversationId: ""` |
| 2   | (auto-navigates to Play2048ScreenV4) | Board appears with 2 tiles. **No invite, no lobby, no pin**       | No `GameInvitesV4` doc. No `pinnedGameInviteIds` change                                 |
| 3   | Swipe in all 4 directions            | Tiles slide + merge. Score updates. `GamePresence` doc written    | `Users/{uid}/GamePresence/{sessionId}` exists with `activeAt`                           |
| 4   | Play until game over (or resign)     | Auto-navigates to GameOverScreenV4 with score + XP                | `GameResultsV4/{id}` exists, session `status: "resolved"`, `rewardsProcessed: true`     |
| 5   | Check My Stats screen                | PB recorded, `game_first_play` achievement unlocked               | `Users/{uid}/GamePB/play_2048` exists with `integrityHash`                              |

**Connect Four smoke test (2-player):**

| #   | Action                                | Expected                                           | Firestore check                                    |
| --- | ------------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| 1   | Alice creates C4 invite in group chat | Invite chip appears for both users                 | `GameInvitesV4/{id}` with `gameId: "connect_four"` |
| 2   | Bob joins → Alice starts              | Both navigate to ConnectFourScreenV4               | `PublicState/state` has 6×7 board of nulls         |
| 3   | Alice drops disc in column 0          | Red disc drops with gravity. Turn → Bob            | `Moves/{id}` with `movePayload.column: 0`          |
| 4   | Alternate until 4-in-a-row            | Winner announced. Both auto-navigate to GameOverV4 | `resolution.type: "win"`, `winnerIds` has 1 UID    |

---

## 2. Emulator / Dev Setup Notes

### Current setup (production-connected)

The app currently connects **directly to production Firebase** (`gamerapp-37e70`). There is no emulator configuration.

- `start.ps1` launches only Expo (`npx expo start`)
- `firebase.json` has no `emulators` block
- `src/services/firebase.ts` has no `connectFunctionsEmulator()` call
- Java is required for Firestore emulator but may not be installed

### Deploying Cloud Functions

```powershell
cd firebase-backend/functions
npm run build
cd ../..
npx firebase deploy --only functions
```

Key: `firebase-backend/functions/src/adminInit.ts` must be imported FIRST in `index.ts` to avoid `FirebaseAppError: The default Firebase app does not exist` caused by eager `admin.firestore()` calls at module scope.

### Deploying Firestore rules + indexes

```powershell
npx firebase deploy --only firestore:rules
npx firebase deploy --only firestore:indexes
```

### Future: Emulator setup (not yet configured)

To add emulator support:

1. Add to `firebase.json`:

   ```json
   "emulators": {
     "functions": { "port": 5001 },
     "firestore": { "port": 8080 },
     "ui": { "enabled": true, "port": 4000 }
   }
   ```

2. Add to `src/services/firebase.ts` (conditionally):

   ```typescript
   if (__DEV__) {
     connectFunctionsEmulator(functions, "localhost", 5001);
     connectFirestoreEmulator(db, "localhost", 8080);
   }
   ```

3. Update `start.ps1` to launch emulators alongside Expo

4. **Requires Java** for the Firestore emulator

### Running Tests

```powershell
# All V4 game tests
npx jest --testPathPattern=gamesV4

# Specific test suites
npx jest --testPathPattern=gamesV4/adapters          # Adapter validation
npx jest --testPathPattern=gamesV4/resolve            # Resolution pipeline
npx jest --testPathPattern=gamesV4/validation         # Payload sanitization
npx jest --testPathPattern=lobbyBugRegression         # Lobby race conditions

# TypeScript compile check (client)
npx tsc --noEmit

# TypeScript compile check (functions)
cd firebase-backend/functions && npm run build && cd ../..
```

### Available Scripts

The `scripts/` directory contains utility scripts. **None are V4-game-specific** — there are no admin scripts for session cleanup, lobby management, or game data repair. All game lifecycle management is handled by the watchdog and Cloud Functions.

| Script                   | Purpose                                | Relevance to V4                       |
| ------------------------ | -------------------------------------- | ------------------------------------- |
| `seed-firestore.js`      | Seeds Firestore with initial test data | Low — no V4 data                      |
| `seed-firestore-rest.js` | REST-based seed variant                | Low                                   |
| `migrate-profiles.ts`    | Profile migration (game score display) | Low — profile fields, not V4 sessions |

### Useful Firebase Console Paths

| What                    | Firebase Console path                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| V4 invites              | Firestore > `GameInvitesV4`                                                                                                                 |
| V4 sessions             | Firestore > `GameSessionsV4`                                                                                                                |
| V4 results              | Firestore > `GameResultsV4`                                                                                                                 |
| User PBs                | Firestore > `Users/{uid}` > `GamePB` subcollection                                                                                          |
| User achievements       | Firestore > `Users/{uid}` > `Achievements` subcollection                                                                                    |
| User rate limits        | Firestore > `Users/{uid}` > `RateLimits` subcollection                                                                                      |
| User game presence      | Firestore > `Users/{uid}` > `GamePresence` subcollection                                                                                    |
| Cloud Function logs     | Functions > Logs (filter by `[gamesV4]` or `[watchdogV4]`)                                                                                  |
| Watchdog schedule       | Cloud Scheduler > `watchdogGamesV4`                                                                                                         |
| Deployed functions list | Functions > Dashboard (should show 16 user callables, 2 admin callables, 3 triggers, 1 scheduled job, plus internal helper exports in code) |

---

## 3. Debugging Guide

### 3.1 Log prefixes

All V4 game logs use structured prefixes. Search Firebase Cloud Function logs or Expo console for:

| Prefix         | Module                                  | Location                                                    |
| -------------- | --------------------------------------- | ----------------------------------------------------------- |
| `[gamesV4]`    | Invites, lobby, sessions, notifications | `invites.ts`, `lobby.ts`, `sessions.ts`, `notifications.ts` |
| `[resolveV4]`  | Resolution pipeline + rewards           | `resolve.ts`                                                |
| `[watchdogV4]` | Scheduled cleanup passes                | `watchdog.ts`                                               |

### 3.2 traceId

Every game session carries a `traceId` in `session.integrity.traceId`:

- **Format:** 32-char hex string (`crypto.randomBytes(16).toString("hex")`)
- **Generated:** In `startGameFromInviteV4` when the session doc is created
- **Location:** `firebase-backend/functions/src/gamesV4/helpers.ts` → `generateTraceId()`
- **Usage:** Not yet wired into all log lines (future improvement). Currently stored in the session doc for post-mortem correlation.

**To trace a game end-to-end:**

```
1. Get inviteId from chat or push notification
2. Read GameInvitesV4/{inviteId} → get sessionId
3. Read GameSessionsV4/{sessionId} → get integrity.traceId
4. Search Cloud Function logs for the sessionId string
```

### 3.3 Key Firestore docs to inspect for a given game

Given an `inviteId`:

| Document         | Path                                                                  | Key fields to check                                                                    |
| ---------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Invite           | `GameInvitesV4/{inviteId}`                                            | `status`, `sessionId`, `summary`, `pinnedGameInviteIds` on parent                      |
| Session          | `GameSessionsV4/{sessionId}`                                          | `status`, `currentTurnPlayerId`, `integrity.version`, `rewardsProcessed`, `resolution` |
| Public state     | `GameSessionsV4/{sessionId}/PublicState/state`                        | Game-specific (e.g., `board`, `score`)                                                 |
| Moves            | `GameSessionsV4/{sessionId}/Moves/*`                                  | `status` (all should be `committed`), count                                            |
| Result           | `GameResultsV4/{sessionId}`                                           | `resolutionType`, `winnerIds`, `xpAwards`, `achievementUnlocks`                        |
| User PB          | `Users/{uid}/GamePB/{gameId}`                                         | `pbValue`, `integrityHash`, `totalPlays`                                               |
| User stats       | `Users/{uid}/UserStatsCache/stats`                                    | `gamesPlayed`, `gamesWon`                                                              |
| Leaderboard      | `LeaderboardsV4/{gameId}/Weeks/{weekKey}/Entries/{uid}`               | `score`                                                                                |
| Rate limit       | `Users/{uid}/RateLimits/{action}`                                     | `lastAtMs` (stale entries may block re-tries)                                          |
| Conversation pin | `Groups/{id}.pinnedGameInviteIds` or `Chats/{id}.pinnedGameInviteIds` | Should/shouldn't contain inviteId                                                      |

### 3.4 Client-side debugging

- Expo console shows all `console.log`/`error` output from hooks and services
- `useGameSessionV4` logs errors from `subscribeToSession` / `subscribeToPublicState`
- `usePinnedInvites` logs errors from `subscribeToPinnedInviteIds` / `subscribeToInvite`
- `GameScreenShell` logs `actionError` inline — visible in the game UI
- Firestore permission errors appear as `@firebase/firestore: Uncaught Error in snapshot listener: FirebaseError: [code=permission-denied]`

### 3.5 Achievement Debugging

If an achievement didn't unlock when expected:

```
1. Check GameResultsV4/{sessionId}.achievementUnlocks — was it evaluated?
2. Check Users/{uid}/Achievements/{type} — does the doc already exist? (idempotent skip)
3. Check Users/{uid}/GamePB/{gameId}.totalPlays — is the counter correct?
   Counters are PRE-INCREMENTED before evaluation so milestones fire on the correct game.
4. Check Users/{uid}/UserStatsCache/stats.gamesPlayed + gamesWon
5. If the achievement is game-specific (e.g., 2048_reached_2048), check the
   performanceMetrics in the result doc — adapter must populate the relevant metric.
```

**18 achievement definitions** in `achievements.ts`. Evaluation context includes: `pbStats.totalPlays`, `pbStats.totalWins`, `globalStats.gamesPlayed`, `globalStats.gamesWon`, `durationMs`, `totalMoves`, `resolutionType`, `myEntry.score`, `performanceMetrics`.

### 3.6 Presence Document Debugging

Presence docs control whether turn notifications are suppressed:

```
1. Check Users/{uid}/GamePresence/{sessionId}
   - Exists + activeAt within 60s → push notification SKIPPED
   - Missing or stale → push notification SENT
2. Written by: GameScreenShell on mount (componentDidMount / useEffect)
3. Deleted by: GameScreenShell on unmount
4. If orphaned (app crashed without unmount): doc becomes stale after 60s,
   push notifications resume. No cleanup needed.
```

### 3.7 Firestore Query Recipes (Firebase Console)

Quick queries to run in the Firebase Console > Firestore > Query builder:

| What                         | Collection               | Filter                                                              |
| ---------------------------- | ------------------------ | ------------------------------------------------------------------- |
| All active invites           | `GameInvitesV4`          | `status` == `active`                                                |
| Stuck lobbies (>24h)         | `GameInvitesV4`          | `status` in `[sent, lobby]` AND `createdAt` < 24h ago               |
| Invites pending deletion     | `GameInvitesV4`          | `status` == `resolved` AND `deleteAt` <= now                        |
| Active sessions              | `GameSessionsV4`         | `status` == `active`                                                |
| Sessions with failed rewards | `GameSessionsV4`         | `status` == `resolved` AND `rewardsProcessed` == `false`            |
| Inactive sessions (>7d)      | `GameSessionsV4`         | `status` == `active` AND `createdAt` < 7 days ago                   |
| Player's game history        | `GameResultsV4`          | `participantIds` array-contains `{uid}` (order by `createdAt` desc) |
| Rate limit blocking a user   | `Users/{uid}/RateLimits` | Read all docs — check `lastAtMs` for recent timestamps              |

---

## 4. Common Failure Modes + Fix Playbook

### F1: Stuck invite pinned (resolved but still shows in PinnedInviteBar)

**Symptoms:** Invite chip shows in chat bar with status "resolved" indefinitely, or chip for a deleted invite remains.

**Root cause:** Unpin failed during resolution, AND watchdog hasn't run, AND `onGameInviteV4Deleted` trigger hasn't fired.

**Diagnosis:**

```
1. Check Groups/{id}.pinnedGameInviteIds — does it still contain the inviteId?
2. Check GameInvitesV4/{inviteId} — does it exist? What's its status?
3. Check Cloud Function logs for "[resolveV4] Failed to unpin invite"
```

**Fix:**

- **Manual:** Remove inviteId from `pinnedGameInviteIds` array in Firebase console
- **Automatic:** Wait for watchdog (runs every 30 min) to hard-delete the invite → `onGameInviteV4Deleted` trigger unpins
- **Prevention:** The system has three layers of defense: (1) `resolveSessionV4Internal` unpins, (2) `onSessionV4StatusChanged` trigger forces invite → resolved, (3) `onGameInviteV4Deleted` trigger unpins on hard delete

---

### F2: Wrong turn displayed (UI shows "Your Turn" but server disagrees)

**Symptoms:** Player tries to submit a move → gets `not-your-turn` error. Or invite chip shows "Your Turn" incorrectly.

**Root cause:** `currentTurnPlayerId` in the session doc doesn't match what the client shows. Could be a stale snapshot or a race between two near-simultaneous moves.

**Diagnosis:**

```
1. Read GameSessionsV4/{sessionId}.currentTurnPlayerId → who does the server think it is?
2. Check integrity.version — did it advance past what the client has?
3. Check last few Moves docs — was the turn advanced correctly?
```

**Fix:**

- **Client:** Force-refresh by navigating away and back (re-subscribes)
- **Server:** If `currentTurnPlayerId` points to a non-existent player, or `currentTurnIndex` is out of bounds, fix manually or let the 7-day watchdog timeout resolve the session

---

### F3: Soft-locked "waiting" (lobby screen stuck, can't start)

**Symptoms:** Host taps "Start Game" → error or nothing happens. Players stuck on lobby screen.

**Root cause options:**

1. Not enough players (min 2 for multiplayer)
2. Rate limit hit (2s cooldown on `startGameV4`)
3. Invite already transitioned to `active` but client didn't auto-navigate

**Diagnosis:**

```
1. Check GameInvitesV4/{inviteId}.status — is it still "lobby" or already "active"?
2. If "active", check invite.sessionId → session exists?
3. Check Cloud Function logs for "[gamesV4]" errors around startGameFromInviteV4
4. Check Users/{hostUid}/RateLimits/startGameV4.lastAtMs
```

**Fix:**

- If already active: client should auto-navigate. If not, deep-link to `game/play/{sessionId}`
- If rate-limited: wait 2 seconds and retry
- If no session created but invite is "active": data inconsistency — manually set invite back to "lobby" or "resolved"

---

### F4: Invite deleted but still pinned (stale reference)

**Symptoms:** `PinnedInviteBar` tries to render an invite that no longer exists → shows empty chip or errors.

**Root cause:** The invite was hard-deleted (by watchdog or manual) but `pinnedGameInviteIds` wasn't cleaned up.

**Diagnosis:**

```
1. Read pinnedGameInviteIds from conversation doc
2. For each ID, check if GameInvitesV4/{id} exists
3. Orphan IDs = those pointing to non-existent docs
```

**Fix:**

- `usePinnedInvites` handles this gracefully — invites that don't resolve are filtered out (null checks)
- `onGameInviteV4Deleted` trigger should have cleaned this up. Check if it ran (Cloud Function logs for `onGameInviteV4Deleted`)
- **Manual:** Remove orphan IDs from `pinnedGameInviteIds` array

---

### F5: Session resolved but invite not resolved

**Symptoms:** Session shows "resolved" but invite still shows "active" in the pinned bar.

**Root cause:** Phase 2 of `resolveSessionV4Internal` failed (invite update error), AND `onSessionV4StatusChanged` trigger didn't catch it.

**Diagnosis:**

```
1. GameSessionsV4/{id}.status === "resolved" ✓
2. GameInvitesV4/{id}.status !== "resolved" ✗
3. Cloud Function logs: "[resolveV4] Failed to transition invite"
```

**Fix:**

- **Automatic:** `onSessionV4StatusChanged` trigger detects `active → resolved` and forces invite to resolved
- **Manual:** Update invite: `status: "resolved"`, `summary.phase: "resolved"`, set `deleteAt`
- **Watchdog:** Pass 1 will eventually expire the invite (if status is still "sent"/"lobby") or the invite will just remain as "active" — edge case

---

### F6: Notification spam / missing notifications

**Symptoms:** Player gets duplicate push notifications for the same turn, OR never receives turn notifications.

**Spam diagnosis:**

```
1. Check collapse keys — same turn should have key "sess:{sessionId}:turn:{uid}"
2. Check if the callable is being retried (Cloud Functions can retry on timeout)
3. Expo push API may deliver duplicates if the device token changed
```

**Missing diagnosis:**

```
1. Check if user has a push token: Users/{uid}.pushToken
2. Check if conversation is muted: isDmChatMuted / isGroupChatMuted
3. Check Cloud Function logs for "[gamesV4] Failed to send push to {uid}"
4. Check if notifyTurn was called (log: "[gamesV4]" around session move)
5. Check presence gating: Users/{uid}/GamePresence/{sessionId} — if exists, push is SKIPPED
```

**Fix:**

- Spam: Verify collapse key is being set. Expo's push API should replace notifications with same collapse key
- Missing: Ensure push token is registered. Check mute settings
- Presence-gating aware: `notifyTurn()` checks `Users/{turnPlayerUid}/GamePresence/{sessionId}`. If the doc exists and `activeAt` is within 60 seconds, the push is **skipped** (the player is already on the game screen). If the presence check itself errors, the push sends anyway (non-fatal fallthrough). See SYSTEM doc §10.3

---

### F7: Deep link routes to wrong screen

**Symptoms:** Tapping push notification navigates to wrong screen or shows blank.

**Diagnosis:**

```
1. Check push data payload: { type, inviteId, sessionId }
2. Route mapping:
   - game_invite → GameLobbyV4 (inviteId param)
   - game_turn → GamePlayV4 (sessionId param)
   - game_resolved → GameOverV4 (sessionId param)
3. Check RootNavigator linking config matches expected deep link path
```

**Fix:**

- Verify `data.type` matches expected routing
- `GamePlayDispatcherV4` handles missing `gameId` by fetching from session on mount — should self-heal
- If session doesn't exist: dispatcher shows error fallback with back button

---

### F7.5: In-App Notification Banner Not Showing / Showing When It Shouldn't

**Symptoms:** Turn or achievement banners don't appear; or they appear while inside Games area.

**Diagnosis (banner NOT showing):**

```
1. Check `Users/{uid}/Notifications` — does a matching doc exist with `channel == "in_app"` and `presentedAt == null`?
2. If doc missing: check Cloud Function logs for "[gamesV4] In-app notification written"
3. If doc exists but deliveredAt is set: the client already processed it. Was user in Games area?
   - Check console logs for "[InAppNotifications] User in Games area"
4. Is the in-app notification listener active? User must be logged in + notifications enabled
5. Check if shouldShowNotification() debounced it (3-second window per entityId)
```

**Diagnosis (banner SHOWING inside Games area):**

```
1. Confirm setCurrentScreen is firing: check console for route name changes
2. RootNavigator onStateChange must track the focused route — verify it's wired
3. Check isInGamesArea() — does the current route name match the GAMES_AREA_ROUTES set?
4. If using a nested navigator the focused leaf route may differ from expected — check
```

**Debug tips:**

```
- Force a turn event: play TTT/C4 as Account B, make a move so it's Account A's turn
- Force an achievement event: play enough games to trigger "game_first_play" or similar
- Check presence gating: if GamePresence doc exists, push AND in-app doc may be skipped
  (but in-app doc is written AFTER presence check passes)
- Route tracking: add a temporary log in RootNavigator.handleStateChange to verify route names
```

---

### F8: Spectator sees private state (privacy leak)

**Symptoms:** A spectator can see per-player private information (hand cards, etc.).

**Diagnosis:**

```
1. PrivateState/{uid} — Firestore rules restrict to owner only (request.auth.uid == uid)
2. PublicState/state — visible to all conversation members
3. Check if the game adapter's getSpectatorView() filters sensitive data
```

**Current state:** All 3 pilot adapters (TTT, C4, 2048) have full public state with no sensitive information. `getSpectatorView()` is not customized — returns the full public state.

**Risk:** Future games with hidden information (e.g., card games) MUST implement `getSpectatorView()` to filter private data from public state. Private state is already protected by Firestore rules, but any data leaked into `PublicState` is visible.

**Prevention for new games:**

- Always put sensitive per-player data in `PrivateState/{uid}` (Firestore rules: owner-only read)
- Implement `getSpectatorView()` in the adapter to strip any sensitive fields from public state
- Never put hand-specific data in `PublicState/state`

---

### F9: Solo session creation fails

**Symptoms:** User taps a solo game in Games Hub → error or nothing happens.

**Error codes from `createSoloSessionV4`:**

| Error Code            | Meaning                                                                               |
| --------------------- | ------------------------------------------------------------------------------------- |
| `invalid-argument`    | `gameId` missing/empty, OR game is not a solo game ("Use createGameInviteV4 instead") |
| `failed-precondition` | No adapter registered for this `gameId` ("… is not yet playable. Coming soon!")       |
| `resource-exhausted`  | Rate limit hit (3s cooldown on `startSoloV4`)                                         |
| `internal`            | Unexpected server error (includes `traceId` in error data)                            |

**Diagnosis:**

```
1. Check Cloud Function logs for "[gamesV4] createSoloSessionV4 called by {uid}" — did the call arrive?
2. If "failed-precondition": game is in GAME_METADATA but NOT in IMPLEMENTED_GAME_IDS
3. If "resource-exhausted": Check Users/{uid}/RateLimits/startSoloV4.lastAtMs
4. If "internal": Search logs for the traceId in the error response
```

**Fix:**

- Rate limit: wait 3 seconds and retry
- Not playable: verify `IMPLEMENTED_GAME_IDS` in `src/gamesV4/constants.ts` includes the `gameId`
- Not solo: check `GAME_METADATA[gameId].runtimeType === "solo"` in constants

---

### F10: Rate limit lockout (user can't perform any action)

**Symptoms:** User gets "Too many requests" error on every action.

**Root cause:** `RateLimits/{action}.lastAtMs` is set to a recent timestamp. With 500ms–3s cooldowns, this normally resolves within seconds. A lockout suggests either:

- Client is retrying in a tight loop (code bug)
- Clock skew between client and server
- Stale `lastAtMs` from a future timestamp (manual data edit)

**Diagnosis:**

```
1. Read Users/{uid}/RateLimits/ (all docs)
2. For each doc, check lastAtMs vs current server time
3. If lastAtMs is in the future, that’s the problem
```

**All rate limit keys and cooldowns:**

| Action          | Firestore Doc Key | Cooldown |
| --------------- | ----------------- | -------- |
| `CREATE_INVITE` | `createInviteV4`  | 3,000 ms |
| `JOIN_LOBBY`    | `joinLobbyV4`     | 2,000 ms |
| `LEAVE_LOBBY`   | `leaveLobbyV4`    | 2,000 ms |
| `CANCEL_INVITE` | `cancelInviteV4`  | 2,000 ms |
| `START_GAME`    | `startGameV4`     | 2,000 ms |
| `START_SOLO`    | `startSoloV4`     | 3,000 ms |
| `SUBMIT_MOVE`   | `submitMoveV4`    | 500 ms   |

**Fix:**

- **Wait it out:** Cooldowns are at most 3 seconds; user just needs to slow down
- **Manual reset:** Delete the specific `RateLimits/{action}` doc in Firebase Console
- **Client fix:** Ensure the client isn't retrying on `resource-exhausted` — surface the error to the user instead

---

### F11: Rewards not processed after game resolution

**Symptoms:** Game resolved, but XP not awarded, leaderboard not updated, or PB not written.

**Root cause:** Phases 5–7 of `resolveSessionV4Internal` failed after the session was already marked resolved.

**Diagnosis:**

```
1. Check GameSessionsV4/{sessionId}.rewardsProcessed — if false, rewards failed
2. Check GameResultsV4/{sessionId} — does it exist? (Phase 4 may have succeeded)
3. Check Cloud Function logs for "[resolveV4]" errors around the sessionId
4. Check Users/{uid}/GamePB/{gameId} — was PB updated?
5. Check Users/{uid}/UserStatsCache/stats — was gamesPlayed incremented?
```

**Fix:**

- **Automatic:** Watchdog Pass 3 retries failed rewards every 30 minutes via `retryRewardsForSession()`
- `retryRewardsForSession` re-runs Phases 5–7 + 9 only (XP, leaderboards, PBs, `rewardsProcessed` flag)
- All reward operations are **idempotent**: `FieldValue.increment` for counters, `Math.max` for PB scores
- **Manual:** If watchdog keeps failing, check the result doc for correct `xpAwards`/`scoreboard` data, then investigate why the write is failing (permissions, missing user doc, etc.)

---

## 5. Reconciliation / Watchdog Behavior

### Schedule

`watchdogGamesV4` runs **every 30 minutes** via Cloud Scheduler (Pub/Sub).

**Source:** `firebase-backend/functions/src/gamesV4/watchdog.ts`

### Four passes

| Pass                        | What it does                               | Query                                                 | Limit | Action                                                                      |
| --------------------------- | ------------------------------------------ | ----------------------------------------------------- | ----- | --------------------------------------------------------------------------- |
| **1** Expire stale lobbies  | Finds `sent/lobby` invites older than 24h  | `status IN [sent, lobby] AND createdAt < (now - 24h)` | 100   | Batch update → `resolved` + set `deleteAt`                                  |
| **2** Hard-delete expired   | Finds `resolved` invites past deletion TTL | `status == resolved AND deleteAt <= now`              | 100   | Batch delete docs                                                           |
| **3** Retry failed rewards  | Finds resolved sessions without rewards    | `status == resolved AND rewardsProcessed == false`    | 20    | Calls `retryRewardsForSession()` for each                                   |
| **4** Auto-resolve inactive | Finds active sessions inactive for 7 days  | `status == active AND createdAt < (now - 7d)`         | 20    | Calls `resolveSessionV4Internal(timeout)`. **Skips non-turnBased** sessions |

### TTL Constants

Defined in `firebase-backend/functions/src/gamesV4/types.ts`:

| Variable                 | Value    | Used by                                           |
| ------------------------ | -------- | ------------------------------------------------- |
| `LOBBY_EXPIRY_MS`        | 24 hours | Pass 1 — stale lobby threshold                    |
| `RESOLVED_INVITE_TTL_MS` | 1 hour   | Pass 2 — `deleteAt` on resolved invites           |
| `TURN_INACTIVITY_MS`     | 7 days   | Pass 4 — inactive session threshold (local const) |
| `PRESENCE_STALE_MS`      | 60 sec   | Not watchdog — turn notification presence check   |

### Log format

All watchdog logs use prefix `[watchdogV4]`.

**Start:** `"[watchdogV4] Starting watchdog run..."`

**Completion summary:**

```
[watchdogV4] Complete. Pass1(expired lobbies):N Pass2(deleted invites):N Pass3(retried rewards):N Pass4(auto-resolved):N
```

**Per-pass errors:** `"[watchdogV4] Pass N (description) failed:"` + error

**Per-item errors (Pass 3/4):** `"[watchdogV4] Pass N retry/auto-resolve failed for {sessionId}:"` + error

### Manual watchdog trigger

You cannot directly invoke a scheduled function from the Firebase Console. Options:

1. **Pub/Sub message:** Send a message to the `firebase-schedule-watchdogGamesV4-...` topic from Google Cloud Console → Pub/Sub → Publish Message
2. **Temporary HTTP wrapper:** Add a callable that invokes the watchdog logic, deploy, trigger, then remove
3. **Wait 30 minutes:** The next scheduled run will pick up anything pending

### Crash recovery behavior

- **Client crash during active game:** Firestore listeners reconnect on app restart. Session state is intact in Firestore. Player taps invite chip to resume.
- **Server crash during resolution:** If `resolveSessionV4Internal` crashes mid-pipeline:
  - Phase 1 (session → resolved) is atomic (transaction). Either it happened or it didn't.
  - If phases 5–7 (XP/leaderboards/PBs) fail, `rewardsProcessed` stays `false` → watchdog Pass 3 retries
  - `retryRewardsForSession()` is safe to re-run: uses `FieldValue.increment` (idempotent for totals) and `Math.max` (idempotent for PBs)
- **Watchdog crash:** Runs again in 30 minutes. All operations are idempotent.

### Verifying watchdog runs

```
1. Check Cloud Scheduler in Firebase Console > Functions > watchdogGamesV4
2. Search Cloud Function logs for "[watchdogV4] Complete."
3. Output format: "Pass1(expired lobbies):N Pass2(deleted invites):N Pass3(retried rewards):N Pass4(auto-resolved):N"
```

### Deletion coverage

Invite hard deletion is covered by three redundant mechanisms, but it is eventual rather than instantaneous:

1. **Primary:** `deleteAt` TTL field + watchdog Pass 2 hard-deletes every 30 minutes
2. **Backup:** Firestore-native TTL field override on `GameInvitesV4.deleteAt` (configured in `firestore.indexes.json` — see SYSTEM doc §14.5). Firestore will auto-delete docs where `deleteAt` has passed, even if the watchdog is down
3. **Safety net:** `onGameInviteV4Deleted` trigger unpins from conversation after hard delete (by either mechanism)

Expired invite docs can therefore persist briefly between `deleteAt` elapsing
and the next watchdog or TTL deletion. Treat expiry as a business-state change
first and a hard-delete later.

---

## 6. Performance Watchlist

### 6.1 Listener counts

| Listener                      | Component           | Multiplied by                       | Risk |
| ----------------------------- | ------------------- | ----------------------------------- | ---- |
| Invite IDs (conversation doc) | `usePinnedInvites`  | 1 per open chat                     | Low  |
| Individual invite docs        | `usePinnedInvites`  | Up to 5 per chat (max pins)         | Low  |
| My active invites             | `GamesHubScreenV4`  | 1 per hub visit                     | Low  |
| Session doc                   | `useGameSessionV4`  | 1 per active game                   | Low  |
| PublicState/state             | `useGameSessionV4`  | 1 per active game                   | Low  |
| Result doc                    | `useGameSessionV4`  | 1 (conditional, only when resolved) | Low  |
| Leaderboard entries           | `useLeaderboardV4`  | 1 per leaderboard view              | Low  |
| Achievements                  | `useAchievementsV4` | 1 per stats view                    | Low  |

**Total worst case** (user in chat with 5 pinned invites + playing a game + viewing leaderboard): ~10 concurrent listeners. Acceptable.

### 6.2 N+1 risks

| Location                 | Pattern                                             | Mitigation                                             |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------ |
| `usePinnedInvites`       | 1 query for IDs + N queries for invite docs         | N ≤ 5 (MAX_PINNED_INVITES). Acceptable                 |
| `startGameFromInviteV4`  | Profile fetch for each participant                  | Batch-fetched outside transaction. N ≤ 8 (MAX_PLAYERS) |
| `evaluateAchievementsV4` | Reads PB + stats + existing achievements per player | Bounded by player count (≤ 8). Acceptable              |
| `updatePersonalBests`    | Read existing PB per player per game                | Bounded by scoreboard size (≤ 8)                       |
| `updateLeaderboards`     | Read existing entry per player                      | Bounded by scoreboard size (≤ 8)                       |

### 6.3 Write storm risks

| Scenario                       | Risk                                              | Mitigation                                               |
| ------------------------------ | ------------------------------------------------- | -------------------------------------------------------- |
| Rapid move submission          | Multiple writes to session + invite summary       | 500ms server-side cooldown (`enforceCooldown`)           |
| Multiple players joining lobby | Parallel writes to invite doc                     | 2s cooldown + transaction guards                         |
| Watchdog batch operations      | Up to 100 invite updates + 20 resolutions per run | Batched writes. Limit caps ensure bounded cost           |
| Achievement evaluation         | Up to 18 achievement checks × 8 players           | Reads are cheap; writes only for new achievements (rare) |

### 6.4 Firestore rule `get()` costs

The PublicState, PrivateState, and Moves subcollection rules use `get()` to read the parent session doc for membership checks. Each `get()` counts as a Firestore read and adds latency.

- PublicState read: 1 `get()` per snapshot
- Moves read: 1 `get()` per snapshot
- Moves create: 1 `get()` per move submission

**Optimization (future):** Cache membership in subcollection docs or use collection group queries with uid-based security.

### 6.5 Document Size Estimates

| Document                  | Typical Size | Max Size | Growth Factor                              |
| ------------------------- | ------------ | -------- | ------------------------------------------ |
| `GameInvitesV4/{id}`      | 1–2 KB       | ~5 KB    | +participants/spectators (up to 8+8)       |
| `GameSessionsV4/{id}`     | 2–4 KB       | ~10 KB   | +players/settings/scoreboardSummary        |
| `PublicState/state`       | 0.5–2 KB     | ~50 KB   | Game-dependent (2048 board < chess board)  |
| `Moves/{moveId}`          | 0.3–1 KB     | ~2 KB    | Fixed per move; grows by count (unbounded) |
| `GameResultsV4/{id}`      | 2–5 KB       | ~15 KB   | +scoreboard + achievements + XP awards     |
| `Users/{uid}/GamePB/{id}` | 0.3 KB       | ~0.5 KB  | Fixed                                      |
| `RateLimits/{action}`     | ~0.1 KB      | ~0.1 KB  | Fixed; 7 docs max per user                 |

**Firestore limit:** 1 MB/doc. No V4 doc approaches this. The largest potential doc is `PublicState/state` for games with complex board state, but serialization keeps this well under limits.

### 6.6 Resolution Write Budget

A single `resolveSessionV4Internal` call performs the following writes (worst case, 2-player game):

| Phase     | Writes                          | Count     |
| --------- | ------------------------------- | --------- |
| 1         | Session status update           | 1         |
| 2         | Invite status update            | 1         |
| 4         | GameResultV4 doc create         | 1         |
| 5         | User XP updates                 | 2         |
| 5         | UserStatsCache updates          | 2         |
| 5         | Achievement doc creates         | 0–18×2    |
| 6         | Leaderboard entry upserts       | 2         |
| 7         | PB doc updates                  | 2         |
| 8         | Conversation unpin              | 1         |
| 9         | Session `rewardsProcessed` flag | 1         |
| **Total** |                                 | **13–49** |

All writes except Phase 1 are **outside** the transaction, so they don't contend with move submissions. At 2 games/minute peak, this is well within Firestore’s per-document write rate (1 write/second).

---

## 7. Regression Test Plan

### 7.1 Navigation regression cases

| Test                              | Steps                                   | Expected                                          |
| --------------------------------- | --------------------------------------- | ------------------------------------------------- |
| Hub → Lobby → Play → Over → Back  | Full flow                               | Returns to chat, no orphan screens in stack       |
| Deep link to active game          | Open `game/play/{sessionId}`            | Dispatcher fetches gameId, renders correct screen |
| Deep link to resolved game        | Open `game/over/{sessionId}`            | GameOverScreen shows results                      |
| Deep link to non-existent session | Open `game/play/invalid`                | Error fallback with back button                   |
| Android back during game          | Press hardware back in active game      | Alert dialog; does NOT navigate back silently     |
| Android back in lobby             | Press hardware back                     | Normal navigation back to chat                    |
| Tab switch during game            | Switch to Profile tab and back to Games | Game state preserved on return                    |

### 7.2 Resign / disconnect / crash scenarios

| Test                               | Steps                             | Expected                                                                      |
| ---------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Resign during game                 | Tap resign FAB → confirm          | Session resolved with `resolutionType: "resign"`, opponent wins               |
| Resign when already resolved       | Tap resign after natural game end | `{ alreadyResolved: true }` — no error, no double-resolution                  |
| Kill app during game               | Force-close app, reopen           | Session still active in Firestore. Resume via invite chip                     |
| Network disconnect                 | Toggle airplane mode during game  | Queued writes retry on reconnect. Turn notification sent when move commits    |
| Both players resign simultaneously | Two resign calls at once          | Transaction serializes; first resign resolves, second is idempotent           |
| Solo game resign                   | Tap resign in 2048                | Session resolved (resign FAB hidden for solo, but if triggered via code path) |

### 7.3 PB anti-forgery scenarios

| Test                           | Steps                                              | Expected                                                                |
| ------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------- |
| Normal PB update               | Win with score > existing PB                       | PB updated, `integrityHash` = SHA-256(`uid:gameId:score:sessionId`)     |
| Score ≤ existing PB            | Win but with lower score                           | PB NOT updated, `totalPlays` still incremented                          |
| Client attempts PB write       | Direct Firestore write to `GamePB`                 | **Rejected** by rules (`allow write: if false`)                         |
| Tampered move payload          | Client sends `{ winner: "me" }` for adaptored game | Adapter validates server-side, rejects invalid move                     |
| Non-adaptored game spoofing    | Client claims win for non-adaptored game           | **ACCEPTED-RISK N2** — currently accepted, adapter needed to fix        |
| PB integrity hash verification | Read PB doc, verify hash                           | Hash = SHA-256(`uid:gameId:pbValue:sessionId`). Can be verified offline |

### 7.4 Spectator scenarios

| Test                           | Expected                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Join as spectator (turn-based) | Added to `spectatorUids`, can read PublicState                                       |
| Spectator submits move         | **Rejected** — Firestore rules require `uid in participantUids`                      |
| Spectator reads PrivateState   | **Rejected** — rules require `request.auth.uid == uid`                               |
| Join as spectator (solo game)  | **Rejected** — `allowSpectators: false` in invite                                    |
| Spectator view after game ends | Can read GameResultsV4 if in `participantIds` (spectators are NOT in participantIds) |

### 7.5 Concurrency scenarios

| Test                                  | Expected                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| Two moves submitted simultaneously    | Transaction serializes; one succeeds, other gets "not-your-turn"                       |
| Two players join lobby simultaneously | Both succeed (transaction); participantIds has both                                    |
| Host starts while player joining      | Transaction serializes; either start succeeds (player in) or start sees pre-join state |
| Watchdog runs during active game      | Pass 4 only resolves sessions older than 7 days; active recent games untouched         |

### 7.6 Solo game scenarios

| Test                             | Steps                                     | Expected                                                                         |
| -------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| Solo game launch from Hub        | Tap 2048 in Games Hub                     | Session created directly (no invite, no pin). Navigate to Play2048ScreenV4       |
| Solo game: no invite doc created | After launch, check Firestore             | No `GameInvitesV4` doc. `inviteId: ""` and `conversationId: ""` in session       |
| Solo game: no lobby              | After launch, check flow                  | Went straight from Hub to game screen, no lobby screen shown                     |
| Solo game resolution             | Play until game over                      | Session resolved, result doc created, PB + XP + achievement evaluated            |
| Solo game: no unpin on resolve   | After resolution, check conversation      | No `pinnedGameInviteIds` mutation (nothing was pinned)                           |
| Solo game: "Coming Soon" game    | Tap unimplemented solo game               | Client shows "Coming Soon" badge. Server returns `failed-precondition` if called |
| Solo game rate limit             | Create two solo sessions within 3 seconds | Second call gets `resource-exhausted` with retry guidance                        |
| Solo game: non-solo game ID      | Call `createSoloSession("tic_tac_toe")`   | Server returns `invalid-argument`: "not a solo game. Use createGameInviteV4"     |

### 7.7 Cancel / leave lobby scenarios

| Test                         | Steps                                                    | Expected                                                             |
| ---------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| Host cancels sent invite     | Host taps Cancel when invite is `sent`                   | Invite → `resolved`, `deleteAt` set, unpin from conversation         |
| Host cancels lobby invite    | Host taps Cancel when invite is `lobby` (players joined) | Invite → `resolved`, all lobby subscribers see cancellation          |
| Non-host tries to cancel     | Non-host calls `cancelGameInviteV4`                      | **Rejected** — only host can cancel                                  |
| Non-host leaves lobby        | Non-host taps "Leave" in lobby                           | UID removed from `participantIds`, lobby updates for remaining users |
| Host tries to leave lobby    | Host calls `leaveInviteLobbyV4`                          | **Rejected** — host must cancel instead                              |
| Leave when not in lobby      | User calls leave without having joined                   | Returns silently (idempotent no-op)                                  |
| Cancel already-active invite | Host calls cancel after game started                     | **Rejected** — invite must be `sent` or `lobby`                      |
| Cancel rate limit            | Cancel twice within 2 seconds                            | Second call gets `resource-exhausted`                                |

### 7.8 Notification / presence scenarios

| Test                                             | Expected                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Invite created → push sent                       | All conversation members except creator receive `game_invite` push            |
| Turn advances → push sent (player away)          | Next turn player receives `game_turn` push (not on game screen)               |
| Turn advances → push **skipped** (player active) | If `GamePresence/{sessionId}` exists and `activeAt` < 60s ago, push NOT sent  |
| Presence doc stale (>60s)                        | Push sent despite presence doc existing (stale = player left without cleanup) |
| Presence check errors                            | Push sent anyway (non-fatal fallthrough). Warning logged                      |
| Game resolved → push sent                        | All participants except resolver receive `game_resolved` push                 |
| Muted conversation                               | No push sent (checked via `isMuted()`)                                        |
| Self-notification suppressed                     | Creator/resolver/actor never receives their own notification                  |
| Collapse key dedup                               | Multiple turn notifications for same session/player replace each other        |
| Lobby join → host notified                       | Host receives lobby join notification. Non-host participants do NOT           |

### 7.9 Watchdog scenarios

| Test                                        | Expected                                                      |
| ------------------------------------------- | ------------------------------------------------------------- |
| Stale lobby (>24h, status "sent")           | Pass 1: invite → `resolved`, `deleteAt` set                   |
| Stale lobby (>24h, status "lobby")          | Pass 1: invite → `resolved`, `deleteAt` set                   |
| Resolved invite past TTL (>1h)              | Pass 2: invite hard-deleted                                   |
| Resolved session, `rewardsProcessed: false` | Pass 3: `retryRewardsForSession()` called — XP/LB/PB written  |
| Inactive session (>7d, turnBased)           | Pass 4: session auto-resolved as `timeout`                    |
| Inactive session (>7d, solo)                | Pass 4: **skipped** — only processes `turnBased` runtime type |
| Inactive session (>7d, realtime)            | Pass 4: **skipped** — only processes `turnBased` runtime type |
| Recent active session (<7d)                 | Pass 4: untouched                                             |
| Watchdog crash and re-run                   | All operations idempotent. Re-run produces same result        |

---

## 8. Release Readiness Checklist

### Pre-deploy

- [ ] All 520+ existing tests pass: `npx jest --ci`
- [ ] V4-specific tests pass: `npx jest --testPathPattern=gamesV4`
- [ ] TypeScript compiles clean: `npx tsc --noEmit` (client) + `npm run build` (functions)
- [ ] Cloud Functions build succeeds: `cd firebase-backend/functions && npm run build`
- [ ] No new Firestore rule errors: `npx firebase deploy --only firestore:rules --dry-run` (if supported)
- [ ] Verify all 13 composite indexes defined in `firestore.indexes.json` (see SYSTEM doc §14)

### Deploy sequence

```
1. Deploy Firestore indexes FIRST (may take 5–15 minutes to build):
   npx firebase deploy --only firestore:indexes
   ⚠️  Queries that depend on new indexes will fail until indexes are ACTIVE.
   Check Firebase Console > Firestore > Indexes to confirm all are "Enabled".

2. Deploy Firestore rules:
   npx firebase deploy --only firestore:rules

3. Deploy Cloud Functions:
   npx firebase deploy --only functions

4. Verify in Firebase Console:
   - Functions tab shows the current V4 surface:
     User callables (16): createGameInviteV4, cancelGameInviteV4, joinInviteLobbyV4, leaveInviteLobbyV4, startGameFromInviteV4, updateLobbySettingsV4, createSoloSessionV4, resumeOrCreateSoloSessionV4, restartSoloSessionV4, suspendSoloSessionV4, archiveSoloSessionV4, submitTurnMoveV4, resignSessionV4, claimLevelRewardV4, claimAchievementV4, claimAchievementSectionBadgeV4
     Admin callables (2): adminClearGameV4, adminClearConversationGamesV4
     Triggers (3): onGameInviteV4Deleted, onSessionV4StatusChanged, onRealtimeResolutionRequest
     Scheduled (1): watchdogGamesV4
     Internal code exports: resolveRealtimeSessionV4, resolveSessionV4Internal
   - Firestore Rules tab shows V4 collection rules (12 match blocks)
   - Cloud Scheduler shows watchdogGamesV4 running every 30 min

5. Publish app update via EAS:
   eas build / eas update
```

### Post-deploy verification

- [ ] Run smoke test (§1) with two real devices
- [ ] Verify push notifications arrive for invite + turn + resolved
- [ ] Verify leaderboard populates after first game
- [ ] Verify achievement unlocks (`game_first_play`, `game_first_win`)
- [ ] Verify PB doc created with valid `integrityHash`
- [ ] Check Cloud Function logs for any errors in first 30 minutes
- [ ] Verify watchdog runs at next scheduled interval (check logs for `[watchdogV4] Complete.`)

### Rollback plan

Cloud Functions support traffic splitting. If V4 functions cause issues:

```powershell
# Delete only V4 callable + trigger + scheduled functions (preserves all existing functions)
npx firebase functions:delete createGameInviteV4 cancelGameInviteV4 joinInviteLobbyV4 leaveInviteLobbyV4 startGameFromInviteV4 updateLobbySettingsV4 createSoloSessionV4 resumeOrCreateSoloSessionV4 restartSoloSessionV4 suspendSoloSessionV4 archiveSoloSessionV4 submitTurnMoveV4 resignSessionV4 claimLevelRewardV4 claimAchievementV4 claimAchievementSectionBadgeV4 adminClearGameV4 adminClearConversationGamesV4 onGameInviteV4Deleted onSessionV4StatusChanged onRealtimeResolutionRequest watchdogGamesV4
```

Client-side: Games tab will show "Game service is not available" errors (handled gracefully). The tab and pinned bar degrade to empty/error states — no crash.

### Known limitations at launch

| Limitation                             | Impact                                                                                                                 | Tracking                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 17 of 25 catalog games enabled         | Remaining catalog entries still show `Coming Soon`                                                                     | See current inventory in SYSTEM doc     |
| Realtime framework still evolving      | Shared client/server abstractions exist, but docs and gameplay QA still need per-game verification for realtime titles | See `docs/REALTIME_FRAMEWORK.md`        |
| No emulator setup                      | All dev testing hits production                                                                                        | §2 above                                |
| No performance bonus XP                | Up to 10 bonus XP unused                                                                                               | Gap G5                                  |
| Metadata duplication remains           | Client and backend game metadata can still drift if both are not updated                                               | See SYSTEM doc known inconsistencies    |
| Hidden-info client optimism is partial | Server reads private state correctly, but local shell validation remains intentionally incomplete                      | See SYSTEM doc hidden-information notes |
| Game-started notif                     | No push when lobby → active                                                                                            | Gap G11                                 |

---

## 9. Error Code Quick-Reference

All V4 Cloud Functions throw structured errors with `functions.https.HttpsError(code, message, details?)`. This table maps error codes to likely causes and callables that throw them.

| Error Code            | Meaning                                                | Thrown by                                                                           |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `unauthenticated`     | No auth context (user not logged in)                   | All callables (`assertAuth`)                                                        |
| `permission-denied`   | Not a conversation member                              | `createGameInviteV4`, `joinInviteLobbyV4`, `startGameFromInviteV4`                  |
| `invalid-argument`    | Missing/invalid field, wrong runtime type              | All callables (input validation), `createSoloSessionV4` (non-solo gameId)           |
| `not-found`           | Invite or session doc doesn't exist                    | `joinInviteLobbyV4`, `startGameFromInviteV4`, `submitTurnMoveV4`, `resignSessionV4` |
| `failed-precondition` | Wrong status for this operation, no adapter registered | `startGameFromInviteV4` (invite not in lobby), `createSoloSessionV4` (no adapter)   |
| `resource-exhausted`  | Rate limit hit                                         | All callables with cooldowns (see full table in F10 above)                          |
| `already-exists`      | Player already in lobby                                | `joinInviteLobbyV4` (returns `{ alreadyJoined: true }`, does NOT throw)             |
| `internal`            | Unexpected server error                                | Any callable; includes `traceId` in error details for debugging                     |

### Log Prefix Cheat Sheet

| Prefix             | Where to find it    | Module                                        |
| ------------------ | ------------------- | --------------------------------------------- |
| `[gamesV4]`        | Cloud Function logs | Invites, lobby, sessions, solo, notifications |
| `[resolveV4]`      | Cloud Function logs | Resolution pipeline + rewards                 |
| `[watchdogV4]`     | Cloud Function logs | Scheduled cleanup passes                      |
| `[levelRewardsV4]` | Cloud Function logs | Level reward unlock + claim                   |

---

## 10. Level Rewards V4 — Ops Guide

### 10.1 Overview

Level rewards grant tokens + cosmetics as players level up (1–50). Rewards are **unlocked** automatically on level-up but must be **claimed** manually by the user.

**UI:** Battlepass-style horizontal tier track (not a vertical list). All 50 tiers are visible.

### 10.2 Key Paths

| Data                 | Firestore Path                                            |
| -------------------- | --------------------------------------------------------- |
| Reward state         | `Users/{uid}/LevelRewardsV4/{level}`                      |
| Wallet (tokens)      | `Wallets/{uid}.tokensBalance`                             |
| Cosmetic entitlement | `Users/{uid}/Entitlements/{cosmeticId}`                   |
| Level data           | `Users/{uid}.level.{current, xp, totalXp, xpToNextLevel}` |

| UI Component            | File                                           |
| ----------------------- | ---------------------------------------------- |
| Level Rewards screen    | `src/gamesV4/screens/LevelRewardsScreen.tsx`   |
| Tier track (horizontal) | `src/gamesV4/components/LevelRewardsTrack.tsx` |
| Tier details sheet      | `src/gamesV4/components/TierDetailsSheet.tsx`  |
| Games Hub progress card | `src/gamesV4/screens/GamesHubScreenV4.tsx`     |
| XP/Level bar            | `src/components/profile/LevelProgress.tsx`     |

### 10.3 Debugging Level Rewards

| Issue                               | Check                                                                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reward not appearing after level-up | Check `LevelRewardsV4/{level}` doc exists. Verify `level.current` in user doc. Check Cloud Function logs for `[levelRewardsV4] Unlocked rewards`.  |
| Claim fails                         | Check `claimedAt` is null (not already claimed). Verify `level.current >= level`. Check Cloud Function logs for `[levelRewardsV4] Reward claimed`. |
| Tokens not incrementing             | Check `Wallets/{uid}.tokensBalance`. The claim writes `FieldValue.increment()`.                                                                    |
| Cosmetic not in inventory           | Check `Entitlements/{cosmeticId}` doc exists. The claim creates it if missing.                                                                     |
| Level stuck above 50                | Level cap is enforced at resolve time. Pre-existing users above 50 are clamped on next game.                                                       |
| Tiers not all visible               | All 50 tiers should render in the horizontal track; scroll left/right. Check `LEVEL_REWARDS` length === 50 in client catalog.                      |
| Missing intermediate tiers          | Backend `unlockLevelRewards()` creates docs for ALL levels `previousLevel+1..newLevel`. Verify docs exist in Firestore for every reached level.    |

### 10.4 How to Verify All Tiers Are Visible

1. Open the LevelRewards screen (via Games Hub "Level & Rewards" card or Game Over "Claim Reward")
2. Scroll the horizontal track all the way left (level 1) → right (level 50)
3. Verify 50 tier nodes are present (including non-milestone tiers like 7, 8, 9, etc.)
4. Milestone tiers (5, 10, 15, 20, 25, 30, 35, 40, 45, 50) should be visually larger with gold accents
5. Tap any tier → Tier Details Sheet opens showing token reward (+ cosmetic for milestones)
6. Current level has gold ring highlight; rail fills to current position

### 10.5 XP Display Format

The level bar shows: **Level N** + **currentXP/xpToNextLevel XP** + **N XP to next level**

- Example: "Level 12" | "50/250 XP" | "200 XP to next level"
- At MAX: "Level 50 (MAX)" | "250/250 XP" | no "to next" text

### 10.6 Manual Fix: Force Unlock Rewards

If rewards are missing (e.g. user leveled up before this feature shipped), run in Firestore:

```
For each level L from 1 to user.level.current:
  If LevelRewardsV4/{L} doesn't exist:
    Create { level: L, unlockedAt: now, claimedAt: null, tokenReward: <from defs>, cosmeticItemId: <from defs>, schemaVersion: 1 }
```

### 10.7 Testing Claim Behavior

1. Ensure unclaimed reward doc exists (`claimedAt: null`)
2. Tap "Claim" in Tier Details Sheet
3. Verify: `claimedAt` set to timestamp, `tokensBalance` incremented, `Entitlements/{cosmeticId}` created (milestones)
4. Tap "Claim" again → shows "Already Claimed" (idempotent)
5. Try claiming a locked tier → rejected by server

### 10.8 Games Hub Entry Point

The Games Hub (`GamesHubScreenV4`) shows a "Level & Rewards" card:

- Level badge (circular, current level number)
- XP progress bar with `currentXP/xpToNextLevel XP` text
- Unclaimed reward count (red pill with gift icon)
- Tapping navigates to `LevelRewards` screen

---

## 11. TTT / Connect Four — Wins-Based Leaderboard Scoring

### 11.1 How It Works

For wins-based games (Tic-Tac-Toe, Connect Four):

- Leaderboard `score` is **cumulative wins** (incremented by 1 per win)
- Losers and draws do not increment the leaderboard score
- The metric is configured in `LEADERBOARD_METRICS` in `firebase-backend/functions/src/gamesV4/types.ts`

For bestScore-based games (2048):

- Leaderboard `score` is **running max** of match scores

### 11.2 Friends Leaderboard

The friends leaderboard reads from `GamePB/{gameId}`:

- For wins-based games: reads `totalWins`
- For bestScore-based games: reads `pbValue`

The field selection is driven by `LEADERBOARD_DESCRIPTORS[gameId].metric` in `src/gamesV4/constants.ts`.

### 11.3 Troubleshooting

| Issue                                  | Cause                                                           | Fix                                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| TTT leaderboard shows 0 or 1           | Old data from before the fix (score was binary)                 | Old entries will self-correct as users play more games within the week. Historical weeks are frozen.                |
| Friends shows 0, Global shows correct  | PB doc has `totalWins: 0` but leaderboard entry has accumulated | User has not won any games yet. `totalWins` only increments on wins.                                                |
| All players show same score on friends | All PB docs have `pbValue` = 1 (old binary metric)              | After the fix, friends LB reads `totalWins` for wins-based games, which should be correct. Force-reload the screen. |
