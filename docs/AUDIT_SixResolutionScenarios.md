# Audit: 6 Game Resolution Scenarios — Code-Path Trace

> Generated 2026-03-01. Traces actual code in the repository.

---

## Scenario 1: Normal Win/Loss (Turn-Based — Chess)

### Trigger

Player A (white) makes a checkmate move against Player B (black).

### Step-by-Step Trace

| #   | What Happens                                                                                                                                                               | File                                                                          | Lines   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| 1   | Client sends `{ type: "move", row, col, toRow, toCol, extra }` to Colyseus room                                                                                            | Client → WebSocket                                                            | —       |
| 2   | `TurnBasedRoom.messages.move` handler fires                                                                                                                                | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L359-L394) | 359–394 |
| 3   | Rate limit check via `rateLimiter.isRateLimited`                                                                                                                           | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L363)      | 363     |
| 4   | Phase guard: `this.state.phase !== "playing"`                                                                                                                              | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L365)      | 365     |
| 5   | Turn guard: `this.state.currentTurnPlayerId !== client.sessionId`                                                                                                          | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L371)      | 371     |
| 6   | `ChessRoom.validateMove()` — checks legal moves (pseudo-legal → in-check filter)                                                                                           | [ChessRoom.ts](colyseus-server/src/rooms/turnbased/ChessRoom.ts#L155-L197)    | 155–197 |
| 7   | `ChessRoom.applyMove()` — clears source, places piece at dest, handles en-passant / castling / promotion, records move in `moveHistory`                                    | [ChessRoom.ts](colyseus-server/src/rooms/turnbased/ChessRoom.ts#L200-L317)    | 200–317 |
| 8   | `state.turnNumber++`                                                                                                                                                       | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L384)      | 384     |
| 9   | `ChessRoom.checkWinCondition()` — detects checkmate: the next-to-move player has no legal moves AND is in check → returns `{ winnerId: playerA.uid, reason: "checkmate" }` | [ChessRoom.ts](colyseus-server/src/rooms/turnbased/ChessRoom.ts#L319-L374)    | 319–374 |
| 10  | Back in base handler: `state.winnerId = result.winnerId`, `state.winReason = "checkmate"`, `state.phase = "finished"`                                                      | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L387-L392) | 387–392 |
| 11  | Colyseus state patch syncs `phase: "finished"` + `winnerId` to **both** clients at next patch tick (~100ms)                                                                | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L103)      | 103     |
| 12  | Room auto-disposes when both clients disconnect (or immediately if they leave). `onDispose()` fires.                                                                       | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L697-L773) | 697–773 |

### `onDispose` — finished branch (line 716)

| #   | What Happens                                                                                                                                                                                                                                                                                                                                                                        | File                                                                    | Lines   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| 13  | `persistGameResult(state, gameDurationMs, undefined, { inviteId, firestoreGameId, v3SessionId })` → writes to `RealtimeGameSessions` (or updates `TurnBasedGames`), deletes `ColyseusGameState` snapshot if any                                                                                                                                                                     | [persistence.ts](colyseus-server/src/services/persistence.ts#L208-L303) | 208–303 |
| 14  | `deleteGameAndInvite(firestoreGameId, inviteId)` — BATCH: deletes `ColyseusGameState/{id}`, `TurnBasedGames/{id}`, `RealtimeGameSessions/{id}`; marks `GameInvites/{inviteId}` → `{ status: "completed", chatVisibility: "hidden", deleteAt: now+6h }`                                                                                                                              | [persistence.ts](colyseus-server/src/services/persistence.ts#L438-L535) | 438–535 |
| 15  | `resolveV3Session(v3SessionId, "win", { winnerUid, scores, firestoreGameId, … })` — updates `GameSessions/{v3SessionId}` → `{ phase: "resolved", resolution: { outcome: "win", winnerUid, scores, … }, participants[].status: "finished" }`. Also finalizes the linked v2 invite (belt-and-suspenders). Triggers `resolveSessionV3` Cloud Function HTTP call for reward processing. | [persistence.ts](colyseus-server/src/services/persistence.ts#L651-L821) | 651–821 |

### What the Clients See

| Player | Client Behavior                                                                                                                                                                     | File                                                                                   | Lines   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------- |
| Both   | `MultiplayerRuntimeShell` (or `SessionRuntimeShell`) subscribes to `GameSessions/{sessionId}` via `subscribeToSession`                                                              | [MultiplayerRuntimeShell.tsx](src/screens/games/MultiplayerRuntimeShell.tsx#L134-L143) | 134–143 |
| Both   | When `session.phase === "resolved"` detected by the `useEffect`, sets `navigatedRef.current = true`, after 400ms calls `navigation.replace("SessionGameOverScreen", { sessionId })` | [MultiplayerRuntimeShell.tsx](src/screens/games/MultiplayerRuntimeShell.tsx#L156-L172) | 156–172 |
| Both   | `SessionGameOverScreen` mounts → `useSessionGameOver(sessionId, uid)` subscribes to session doc, derives `result: "win"` for winner, `result: "loss"` for loser                     | [useSessionGameOver.ts](src/hooks/useSessionGameOver.ts#L73-L130)                      | 73–130  |
| Winner | Sees "VICTORY! 🏆" header, winner crown badge, scoreboard, XP earned, haptic success                                                                                                | [SessionGameOverScreen.tsx](src/screens/games/SessionGameOverScreen.tsx#L82-L95)       | 82–95   |
| Loser  | Sees "DEFEAT 💔" header, scoreboard                                                                                                                                                 | [SessionGameOverScreen.tsx](src/screens/games/SessionGameOverScreen.tsx#L86)           | 86      |

### Firestore Writes Summary

| Collection             | Doc ID          | Fields Written                                                                                                                     | When                                                                      |
| ---------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `RealtimeGameSessions` | auto-ID         | `gameType, players, winnerId, winReason, turnCount, isRated, completedAt, source:"colyseus"`                                       | `persistGameResult` (step 13)                                             |
| `ColyseusGameState`    | gameId          | DELETED (if existed)                                                                                                               | `persistGameResult` cleanup (step 13)                                     |
| `TurnBasedGames`       | firestoreGameId | DELETED                                                                                                                            | `deleteGameAndInvite` (step 14)                                           |
| `GameInvites`          | inviteId        | `status:"completed", chatVisibility:"hidden", chatHiddenAt, resolvedAt, resolvedBy:"room", deleteAt:now+6h`                        | `deleteGameAndInvite` (step 14)                                           |
| `GameSessions`         | v3SessionId     | `phase:"resolved", resolution:{outcome:"win",winnerUid,scores,resolvedAt,resolvedBy:"colyseus"}, participants[].status:"finished"` | `resolveV3Session` (step 15)                                              |
| `GameSessions`         | v3SessionId     | `resolution.rewardsProcessed:true, resolution.xpAwarded, resolution.achievementsUnlocked`                                          | `processSessionRewards` via `resolveSessionV3` callable (step 15 trigger) |

### Invite Doc Cleanup: ✅ Properly hidden

- `deleteGameAndInvite` marks `chatVisibility: "hidden"`, `status: "completed"`, `deleteAt: now + 6h`
- `resolveV3Session` also finalizes the linked v2 invite as belt-and-suspenders

### AsyncStorage Bookmark Cleanup: ⚠️ **NOT explicitly cleared**

- `clearActiveSession()` from [gameRecovery.ts](src/services/gameRecovery.ts#L138-L143) is **never called** from `SessionGameOverScreen`, `MultiplayerRuntimeShell`, or `SessionRuntimeShell`
- The bookmark persists until the next `recoverActiveSession()` call checks Firestore and finds the session/invite is terminal, then clears it
- **This is a lazy-cleanup pattern**, not a bug per se, but introduces a window where a stale "Resume game" banner could flash on app restart before the Firestore check completes

### Bugs / Gaps

1. **AsyncStorage bookmark not eagerly cleared on game end.** The `clearActiveSession()` function exists but is not called when navigating to `SessionGameOverScreen`. Recovery depends on the `recoverActiveSession()` Firestore round-trip.
2. **No explicit `clearActiveSession` in game-over flow.** If the user kills the app on the game-over screen and reopens, `recoverActiveSession` will see a terminal invite and self-clear — correct but suboptimal.

---

## Scenario 2: Draw (Turn-Based — Tic-Tac-Toe)

### Trigger

The 9th move fills the last cell; no three-in-a-row exists.

### Step-by-Step Trace

| #   | What Happens                                                                                                                                                                                     | File                                                                               | Lines   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------- |
| 1   | Player sends `{ type: "move", row, col }` for the final empty cell                                                                                                                               | Client → WebSocket                                                                 | —       |
| 2   | `TurnBasedRoom.messages.move` handler fires (same as Scenario 1 steps 2–5)                                                                                                                       | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L359-L384)      | 359–384 |
| 3   | `TicTacToeRoom.validateMove()` — bounds check + cell must be empty (`getCell(row, col) === 0`)                                                                                                   | [TicTacToeRoom.ts](colyseus-server/src/rooms/turnbased/TicTacToeRoom.ts#L75-L83)   | 75–83   |
| 4   | `TicTacToeRoom.applyMove()` — sets cell to `playerIndex + 1`, records move                                                                                                                       | [TicTacToeRoom.ts](colyseus-server/src/rooms/turnbased/TicTacToeRoom.ts#L91-L103)  | 91–103  |
| 5   | `state.turnNumber++`                                                                                                                                                                             | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L384)           | 384     |
| 6   | `TicTacToeRoom.checkWinCondition()` — first checks all 8 winning lines (none match), then checks `allFilled = true` → returns `{ winnerId: "", winnerSessionId: "", reason: "draw_board_full" }` | [TicTacToeRoom.ts](colyseus-server/src/rooms/turnbased/TicTacToeRoom.ts#L111-L143) | 111–143 |
| 7   | Back in base: `state.winnerId = ""` (empty = draw), `state.winReason = "draw_board_full"`, `state.phase = "finished"`                                                                            | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L387-L392)      | 387–392 |
| 8   | Colyseus state patch syncs to both clients                                                                                                                                                       | —                                                                                  | —       |

### `onDispose` — finished branch

| #   | What Happens                                                                                                                  | File                                                                                                                                               | Lines        |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 9   | `persistGameResult(...)` — same as Scenario 1, but `winnerId: ""`                                                             | [persistence.ts](colyseus-server/src/services/persistence.ts#L208-L303)                                                                            | 208–303      |
| 10  | `deleteGameAndInvite(...)` — same cleanup                                                                                     | [persistence.ts](colyseus-server/src/services/persistence.ts#L438-L535)                                                                            | 438–535      |
| 11  | `resolveV3Session(v3SessionId, "draw", { winnerUid: undefined, scores, … })` — since `winnerId` is empty, outcome is `"draw"` | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L745) + [persistence.ts](colyseus-server/src/services/persistence.ts#L651-L821) | 745, 651–821 |

### What the Clients See

Both players are navigated to `SessionGameOverScreen`. The `useSessionGameOver` hook detects `resolution.outcome === "draw"` → both see:

- **"DRAW 🤝"** header with warning haptic
- Scoreboard (likely 0-0)
- XP for draw

### Firestore Writes: Same structure as Scenario 1, with `outcome: "draw"`, `winnerId: ""`.

### Invite Doc Cleanup: ✅ Same as Scenario 1

### AsyncStorage Bookmark: ⚠️ Same lazy-cleanup gap as Scenario 1

### Bugs / Gaps

1. Same AsyncStorage gap as Scenario 1.
2. No additional draw-specific bugs found. The draw path is clean.

---

## Scenario 3: Player Resigns Mid-Game

### Trigger

Player B taps the resign FAB button during an active game.

### Two Parallel Resign Paths Exist

There are **two independent resign mechanisms**, which is notable:

#### Path A: Colyseus `"resign"` message (server-side)

| #   | What Happens                                                                                        | File                                                                          | Lines   |
| --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| 1   | Client sends `{ type: "resign" }` to Colyseus room                                                  | Client → WebSocket                                                            | —       |
| 2   | `TurnBasedRoom.messages.resign` handler fires                                                       | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L404-L414) | 404–414 |
| 3   | Guard: must be `phase === "playing"`                                                                | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L406)      | 406     |
| 4   | Gets opponent via `getOpponent(client.sessionId)`                                                   | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L408)      | 408     |
| 5   | Sets `state.winnerId = opponent.uid`, `state.winReason = "resignation"`, `state.phase = "finished"` | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L410-L413) | 410–413 |
| 6   | Normal `onDispose` → finished branch (same as Scenario 1, steps 13-15)                              | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L716-L753) | 716–753 |

#### Path B: Client-side resign via Cloud Function (V3 session flow)

This is the **primary resign path** for V3 sessions, triggered by the resign FAB in `MultiplayerRuntimeShell`:

| #   | What Happens                                                                                                                               | File                                                                                   | Lines     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------- |
| 1   | User taps resign FAB → `setShowResignConfirm(true)`                                                                                        | [MultiplayerRuntimeShell.tsx](src/screens/games/MultiplayerRuntimeShell.tsx#L295-L302) | 295–302   |
| 2   | Modal shows "Resign Game? This will count as a loss."                                                                                      | [MultiplayerRuntimeShell.tsx](src/screens/games/MultiplayerRuntimeShell.tsx#L337-L376) | 337–376   |
| 3   | User confirms → `handleConfirmResign()` fires                                                                                              | [MultiplayerRuntimeShell.tsx](src/screens/games/MultiplayerRuntimeShell.tsx#L224-L271) | 224–271   |
| 4   | Determines winner: `others = session.participants.filter(p => p.uid !== uid && p.status !== "left")`                                       | [MultiplayerRuntimeShell.tsx](src/screens/games/MultiplayerRuntimeShell.tsx#L234-L237) | 234–237   |
| 5   | Tears down Firestore listener (`unsubRef.current()`) to avoid permission flash                                                             | [MultiplayerRuntimeShell.tsx](src/screens/games/MultiplayerRuntimeShell.tsx#L240-L243) | 240–243   |
| 6   | Calls `resolveSession({ sessionId, outcome: "forfeit", winnerUid, resolvedBy: "${uid}:resign" })`                                          | [MultiplayerRuntimeShell.tsx](src/screens/games/MultiplayerRuntimeShell.tsx#L246-L250) | 246–250   |
| 7   | `resolveSession()` calls `resolveSessionV3` Cloud Function callable                                                                        | [gameSessions.ts](src/services/gameSessions.ts#L358-L388)                              | 358–388   |
| 8   | Cloud Function: transaction sets `phase: "resolved"`, `resolution: { outcome: "forfeit", winnerUid }`, all players to `status: "finished"` | [sessionsV3.ts](firebase-backend/functions/src/sessionsV3.ts#L1395-L1444)              | 1395–1444 |
| 9   | Cloud Function: finalizes v2 invite doc (same as Scenario 1)                                                                               | [sessionsV3.ts](firebase-backend/functions/src/sessionsV3.ts#L1451-L1530)              | 1451–1530 |
| 10  | Cloud Function: `processSessionRewards(...)`                                                                                               | [sessionsV3.ts](firebase-backend/functions/src/sessionsV3.ts#L1545-L1560)              | 1545–1560 |
| 11  | On success, client navigates: `navigation.replace("SessionGameOverScreen", { sessionId })`                                                 | [MultiplayerRuntimeShell.tsx](src/screens/games/MultiplayerRuntimeShell.tsx#L253-L257) | 253–257   |

### What the Clients See

| Player              | Behavior                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player B (resigner) | FAB → confirm modal → "Ending match…" overlay → navigated to SessionGameOverScreen showing "FORFEIT 🏳️"                                                                     |
| Player A (opponent) | Firestore listener fires with `phase: "resolved"` → `MultiplayerRuntimeShell` auto-navigates to SessionGameOverScreen → sees "VICTORY! 🏆" (since they are the `winnerUid`) |

### Invite Doc Cleanup: ✅ Handled in `resolveSessionV3` post-transaction

### AsyncStorage Bookmark: ⚠️ Same lazy-cleanup issue

### Bugs / Gaps

1. **Dual resign paths can race.** If Player B sends a Colyseus `"resign"` message AND the client simultaneously calls `resolveSessionV3`, the V3 session could be resolved twice. Both paths are individually **idempotent** (the V3 bridge checks for terminal phase, and `resolveSessionV3` also checks), so this is not a data corruption risk, but it's a redundant write.
2. **The Colyseus resign path does NOT call `resolveSessionV3` directly** — it relies on `onDispose` to call `resolveV3Session()`. If the client resign via Cloud Function happens first, by the time `onDispose` runs the session is already terminal — handled correctly (idempotent).
3. **AsyncStorage not eagerly cleared.** Same as Scenario 1.

---

## Scenario 4: Player Disconnects During Realtime Game (Pong)

### Trigger

Player A's WebSocket connection drops (e.g., network loss, app kill).

### Step-by-Step Trace

| #   | What Happens                                                                                                                                                                 | File                                                                      | Lines   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------- |
| 1   | Colyseus detects WebSocket close → `PhysicsRoom.onDrop(client, code)` fires                                                                                                  | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L335-L352) | 335–352 |
| 2   | Marks player as disconnected: `player.connected = false`                                                                                                                     | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L337)      | 337     |
| 3   | Broadcasts `"opponent_reconnecting"` message to the other player                                                                                                             | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L338-L342) | 338–342 |
| 4   | Calls `this.allowReconnection(client, timeout)` with `timeout = parseInt(process.env.RECONNECTION_TIMEOUT_PHYSICS \|\| "15", 10)` → **15 seconds by default**                | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L345-L347) | 345–347 |
| 5a  | **If reconnection succeeds** within 15s → `onReconnect(client)` fires → `player.connected = true`, broadcasts `"opponent_reconnected"`, game continues                       | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L354-L362) | 354–362 |
| 5b  | **If reconnection times out** → `allowReconnection` throws → Colyseus then calls `onLeave`                                                                                   | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L349-L352) | 349–352 |
| 6   | `PhysicsRoom.onLeave(client, code)` fires                                                                                                                                    | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L364-L388) | 364–388 |
| 7   | Since `phase === "playing"` AND the player exists: gets `remaining = getOpponent(client.sessionId)`                                                                          | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L375-L384) | 375–384 |
| 8   | If remaining player is still connected → `endGame(remaining.uid, "opponent_left")`                                                                                           | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L379)      | 379     |
| 9   | `endGame` sets `phase: "finished"`, `winnerId: remaining.uid`, `winReason: "opponent_left"`, broadcasts `"game_over"` to all clients                                         | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L519-L541) | 519–541 |
| 10  | Both players disconnect → `onDispose()` fires → finished branch: `persistGameResult`, `deleteGameAndInvite`, `resolveV3Session("win", { winnerUid: remaining.uid, scores })` | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L395-L432) | 395–432 |

**Contrast: TurnBasedRoom disconnect behavior**

For turn-based games (Chess, TicTacToe), the disconnect path is in `TurnBasedRoom.onLeave`:

| #   | What Happens                                                                                                                                          | File                                                                          | Lines   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| 1   | `player.connected = false`                                                                                                                            | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L643)      | 643     |
| 2   | If unconsentful disconnect (`code < 4000`) during playing phase → `allowReconnection(client, 30)` — **30 seconds** reconnection window                | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L650-L660) | 650–660 |
| 3   | If timeout: checks if opponent is still connected → auto-forfeit: `winnerId = opponent.uid`, `winReason = "disconnect_forfeit"`, `phase = "finished"` | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L664-L675) | 664–675 |
| 4   | If BOTH players disconnect → `allPlayersLeft = true` → room saves state to Firestore for async restoration                                            | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L685-L691) | 685–691 |

### Reconnection Windows Summary

| Room Type             | Reconnection Timeout | Env Variable                   |
| --------------------- | -------------------- | ------------------------------ |
| PhysicsRoom (Pong)    | **15 seconds**       | `RECONNECTION_TIMEOUT_PHYSICS` |
| TurnBasedRoom (Chess) | **30 seconds**       | Hardcoded                      |

### What Resolves the Session Eventually

- **If one player remains:** Auto-forfeit / opponent_left → game ends immediately
- **If both disconnect (turn-based only):** State saved to `ColyseusGameState`, marked as `vacant`. Vacancy TTL cleanup: 2-day window for turn-based. V3 session marked `abandoned`.
- **If both disconnect (realtime):** State NOT saved (no persistence for physics state). Marked `vacant` with 10-minute cleanup TTL. V3 session marked `abandoned`.

### Invite Doc Cleanup: ✅ Handled by `deleteGameAndInvite` in `onDispose` (finished path) or watchdog (abandoned path)

### AsyncStorage Bookmark: ⚠️ Same lazy-cleanup issue. Additionally, the disconnected client may not get a navigation event at all (app was killed), so the bookmark persists until recovery checks it.

### Bugs / Gaps

1. **PhysicsRoom uses `onDrop` + `onLeave` split**, while TurnBasedRoom handles everything in `onLeave` with `allowReconnection` inline. These are consistent with Colyseus patterns but use different API styles.
2. **If both Pong players disconnect:** `onLeave` fires for the first player → since `remaining.connected = true` initially, it calls `endGame(remaining.uid, "opponent_left")`. Then the second player leaves → already `phase === "finished"`, so `endGame` is a no-op (guard at line 520). This is **correct** — the first disconnector loses.
3. **If both Pong players disconnect simultaneously:** If neither is connected when `onLeave` processes, `remaining.connected` would be false → calls `endGame("", "mutual_disconnect")`. This results in no winner, which is correctly persisted as a draw/no-winner game.
4. **No explicit notification to the disconnected player.** When the disconnected player reopens the app, they rely on recovery service to discover the game ended.

---

## Scenario 5: Host Abandons Lobby (Leaves Before Game Starts)

### Trigger

Host creates a V3 session, 1 player joins the lobby, host navigates away / presses back.

### Step-by-Step Trace — Client Side

| #   | What Happens                                                                         | File                                            | Lines |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------- | ----- |
| 1   | Host navigates away from lobby screen (back button / swipe)                          | Client                                          | —     |
| 2   | Client calls `leaveSession({ sessionId })` → invokes `leaveSessionV3` Cloud Function | [gameSessions.ts](src/services/gameSessions.ts) | —     |

### Step-by-Step Trace — Cloud Function `leaveSessionV3`

| #   | What Happens                                                                                         | File                                                                    | Lines   |
| --- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| 3   | Transaction reads session doc                                                                        | [sessionsV3.ts](firebase-backend/functions/src/sessionsV3.ts#L577-L583) | 577–583 |
| 4   | Already terminal? → idempotent success                                                               | [sessionsV3.ts](firebase-backend/functions/src/sessionsV3.ts#L591-L600) | 591–600 |
| 5   | Finds participant by UID                                                                             | [sessionsV3.ts](firebase-backend/functions/src/sessionsV3.ts#L603-L611) | 603–611 |
| 6   | **Host leaving in lobby phase** detected: `participant.role === "host" && session.phase === "lobby"` | [sessionsV3.ts](firebase-backend/functions/src/sessionsV3.ts#L616-L617) | 616–617 |
| 7   | Validates transition: `canTransitionPhase("lobby", "abandoned")` → ✅ allowed                        | [sessionsV3.ts](firebase-backend/functions/src/sessionsV3.ts#L618-L623) | 618–623 |
| 8   | Updates host's participant status to `"left"`                                                        | [sessionsV3.ts](firebase-backend/functions/src/sessionsV3.ts#L625-L627) | 625–627 |
| 9   | Sets `phase: "abandoned"`, preserves `participantUids` so remaining player can see the update        | [sessionsV3.ts](firebase-backend/functions/src/sessionsV3.ts#L629-L633) | 629–633 |

### What Happens to the Remaining Player

| #   | What Happens                                                                                                                            | File                                                                                   | Lines   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------- |
| 10  | The remaining player's Firestore subscription fires with `phase: "abandoned"`                                                           | —                                                                                      | —       |
| 11  | If they're in `SessionLobbyScreen` → the lobby screen should detect the abandoned phase and navigate away                               | Lobby screen                                                                           | —       |
| 12  | If wrapped in `MultiplayerRuntimeShell` → the shell detects `session.phase === "abandoned"` → navigates to `GamesHub` after 200ms delay | [MultiplayerRuntimeShell.tsx](src/screens/games/MultiplayerRuntimeShell.tsx#L176-L186) | 176–186 |
| 13  | If wrapped in `SessionRuntimeShell` → same behavior: navigates to `GamesHub`                                                            | [SessionRuntimeShell.tsx](src/screens/games/SessionRuntimeShell.tsx#L102-L113)         | 102–113 |

### Firestore Writes

| Collection     | Doc ID    | Fields Written                                                              |
| -------------- | --------- | --------------------------------------------------------------------------- |
| `GameSessions` | sessionId | `phase: "abandoned"`, `participants[host].status: "left"`, `updatedAt: now` |

### What About the Colyseus Room?

If the game had a Colyseus room created (e.g., `startSessionV3` was called), the room's `onDispose` handles cleanup:

- **But in the lobby phase**, `startSessionV3` hasn't been called yet, so there's no Colyseus room. The session-level cleanup is sufficient.
- If for some reason a Colyseus room existed (pre-start), `TurnBasedRoom.onDispose` at [line 840](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L840-L849) detects `phase === "waiting"` → calls `deleteGameAndInvite(...)` and `abandonV3Session(...)`.

### What About the Dual-Written v2 Invite?

- `leaveSessionV3` does **NOT** finalize the v2 `GameInvites` doc. The v2 invite remains with whatever status it had (`pending`).
- The `watchdogSessionsV3` (scheduled function) will eventually discover this orphaned invite and clean it up.
- **Gap:** The remaining player may still see the invite pill in chat until the watchdog runs.

### Session Cleanup: ⚠️ Partial

- Session doc transitions to `abandoned` ✅
- v2 invite doc **NOT immediately finalized** ⚠️ (watchdog handles eventually)
- No `ColyseusGameState` to clean up (lobby phase, no room)

### AsyncStorage Bookmark

- Bookmark may have been saved when the lobby loaded, but with `isTurnBased: true` and no Colyseus connection
- `recoverActiveSession()` will check the session phase → `abandoned` → clear the bookmark
- Same lazy-cleanup pattern

### Bugs / Gaps

1. **v2 invite not finalized when host abandons lobby.** The `leaveSessionV3` function only updates the `GameSessions` doc — it does NOT touch `GameInvites`. The remaining player's chat may show a stale invite pill until the watchdog runs (up to 15 minutes).
2. **No toast/notification to remaining player.** They're redirected to `GamesHub` silently. No "Host left the game" message is shown (the abandoned detection just navigates away).
3. **Host leaving during `starting`/`active` phase** also → `abandoned` (lines 637-652). This correctly handles edge cases.

---

## Scenario 6: Spectator Viewing a Game That Ends

### Overview: Two Spectator Systems Exist

The codebase has **two separate spectator systems**:

#### System A: Multiplayer Game Spectators (built into `TurnBasedRoom` / `PhysicsRoom`)

- Spectators join the same Colyseus room with `options.spectator = true`
- Tracked via `spectatorSessionIds` Set and `state.spectators` MapSchema
- Spectators see the real-time state patches but cannot send moves

#### System B: Solo-Game SpectatorRoom (dedicated room)

- A separate `SpectatorRoom` class for watching single-player games
- Host broadcasts game state; spectators receive it
- Has its own `SpectatorSessions` Firestore collection

### Scenario: Spectator Watching a Multiplayer Game That Ends

#### Trigger

Spectator is connected to a Chess/Pong room. The game reaches `phase: "finished"`.

#### Step-by-Step Trace

| #   | What Happens                                                                                                                                                                                                        | File                                                                                   | Lines   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------- |
| 1   | Game ends normally (checkmate, score limit, etc.) → `state.phase = "finished"`, `state.winnerId = ...`                                                                                                              | Various                                                                                | —       |
| 2   | Colyseus state patch syncs `phase: "finished"` to ALL connected clients — including spectators                                                                                                                      | Colyseus framework                                                                     | —       |
| 3   | Spectator client receives the state update with `phase === "finished"`                                                                                                                                              | Client                                                                                 | —       |
| 4   | **If the spectator joined a V3 session as a spectator**, `MultiplayerRuntimeShell` listens on `GameSessions/{sessionId}`. When session transitions to `"resolved"`, the shell navigates to `SessionGameOverScreen`. | [MultiplayerRuntimeShell.tsx](src/screens/games/MultiplayerRuntimeShell.tsx#L156-L172) | 156–172 |
| 5   | On `SessionGameOverScreen`, `useSessionGameOver` derives the result. For a spectator: since their UID is NOT the `winnerUid`, they'd see `"loss"` — **this is wrong for spectators**                                | [useSessionGameOver.ts](src/hooks/useSessionGameOver.ts#L98-L108)                      | 98–108  |

#### What Happens When Spectator Leaves

| #   | What Happens                                                                                               | File                                                                          | Lines   |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| 1   | `TurnBasedRoom.onLeave` checks `spectatorSessionIds.has(client.sessionId)` → spectator branch              | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L633-L640) | 633–640 |
| 2   | Deletes spectator from `state.spectators`, decrements `spectatorCount`, removes from `spectatorSessionIds` | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L634-L638) | 634–638 |
| 3   | Returns early — does NOT trigger any forfeit/vacancy logic                                                 | [TurnBasedRoom.ts](colyseus-server/src/rooms/base/TurnBasedRoom.ts#L639)      | 639     |
| 4   | Same pattern in `PhysicsRoom.onLeave`                                                                      | [PhysicsRoom.ts](colyseus-server/src/rooms/base/PhysicsRoom.ts#L366-L373)     | 366–373 |

### Spectator Room (Solo Games) — Game End

| #   | What Happens                                                                                                                                 | File                                                                               | Lines   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------- |
| 1   | Host sends `"game_end"` message with `{ finalScore }`                                                                                        | [SpectatorRoom.ts](colyseus-server/src/rooms/spectator/SpectatorRoom.ts#L314-L327) | 314–327 |
| 2   | `state.phase = "finished"`, `state.currentScore = finalScore`                                                                                | [SpectatorRoom.ts](colyseus-server/src/rooms/spectator/SpectatorRoom.ts#L322-L324) | 322–324 |
| 3   | State patch syncs to all spectators — they see `phase: "finished"`                                                                           | Colyseus framework                                                                 | —       |
| 4   | Host client calls `finishSpectatorSession(roomId, finalScore)` to update `SpectatorSessions/{roomId}` → `{ status: "finished", finalScore }` | [spectatorSessions.ts](src/services/spectatorSessions.ts#L84-L97)                  | 84–97   |
| 5   | Chat bubbles subscribed via `subscribeToSpectatorSession` see `status: "finished"` → show "Game Ended" instead of "Watch Live"               | [spectatorSessions.ts](src/services/spectatorSessions.ts#L131-L165)                | 131–165 |

### Bugs / Gaps

1. **Spectator sees "DEFEAT" on game-over screen (multiplayer).** In [useSessionGameOver.ts](src/hooks/useSessionGameOver.ts#L98-L108), the result derivation logic does:

   ```typescript
   } else if (resolution.winnerUid === currentUid) {
     result = "win";
   } else {
     result = "loss";
   }
   ```

   A spectator's UID will never match `winnerUid`, so they always see "DEFEAT" or "LOSS". **There is no spectator-specific result handling.** The hook should check if the current user's role is `"spectator"` and show a neutral result (e.g., just show the scoreboard without win/loss framing).

2. **Spectators are included in `participantUids` ACL.** When a spectator joins via `joinSessionV3`, they're added to `participants` array and `participantUids`. This is correct for access control but means the `SessionGameOverScreen` participant list includes spectators. The screen does filter `p.role !== "spectator"` for the scoreboard at [SessionGameOverScreen.tsx](src/screens/games/SessionGameOverScreen.tsx#L459), so the display is correct — but the result header text is wrong per point #1.

3. **SpectatorRoom `phase: "finished"` doesn't auto-kick spectators.** The room stays open until all clients leave naturally. There's no auto-navigate for spectators when the game ends — they just see the final state and can leave manually.

4. **SpectatorSessions cleanup:** The `SpectatorSessions/{roomId}` doc is set to `"finished"` but never deleted. Over time, orphaned docs accumulate. No TTL or cleanup mechanism exists.

---

## Summary Table

| Scenario               | Invite Cleanup               | Session Cleanup             | AsyncStorage Cleared            | Spectator Handling               | Bugs Found                                         |
| ---------------------- | ---------------------------- | --------------------------- | ------------------------------- | -------------------------------- | -------------------------------------------------- |
| 1. Win/Loss (Chess)    | ✅ Hidden + completed        | ✅ Resolved                 | ⚠️ Lazy only                    | N/A                              | AsyncStorage not eagerly cleared                   |
| 2. Draw (TicTacToe)    | ✅ Hidden + completed        | ✅ Resolved                 | ⚠️ Lazy only                    | N/A                              | Same                                               |
| 3. Player Resigns      | ✅ Hidden via CF             | ✅ Resolved (forfeit)       | ⚠️ Lazy only                    | N/A                              | Dual resign paths (harmless; idempotent)           |
| 4. Disconnect (Pong)   | ✅ Hidden on dispose         | ✅ Resolved (opponent_left) | ⚠️ Lazy only                    | N/A                              | 15s window; no notification to disconnected player |
| 5. Host Abandons Lobby | ⚠️ NOT immediately finalized | ✅ Abandoned                | ⚠️ Lazy only                    | N/A                              | v2 invite stale until watchdog; no user toast      |
| 6. Spectator Game End  | ✅ (same as game resolution) | ✅ (same)                   | N/A (spectators don't bookmark) | ⚠️ Shows "DEFEAT" for spectators | Wrong result display for spectators                |

---

## Cross-Cutting Findings

### 1. AsyncStorage Bookmark — Lazy Cleanup (All Scenarios)

**Impact:** Low-medium. The `clearActiveSession()` function exists ([gameRecovery.ts](src/services/gameRecovery.ts#L138-L143)) but is never called on the game-over or resolve path. Cleanup only occurs when `recoverActiveSession()` runs and hits Firestore. This means if a user kills the app immediately after a game ends and reopens, they'll briefly see a "Resume game" banner that self-clears after a network round-trip.

**Fix:** Call `clearActiveSession()` in `MultiplayerRuntimeShell` when session phase becomes terminal, and in `SessionGameOverScreen` on mount.

### 2. v2 Invite Not Finalized on Lobby Abandon (Scenario 5)

**Impact:** Medium. The invite pill persists in chat for up to 15 minutes (watchdog cycle) after the host abandons the lobby. Players can still tap it and get a confusing error.

**Fix:** Add invite finalization to `leaveSessionV3` when the phase transitions to `abandoned`.

### 3. Spectator Result Display Bug (Scenario 6)

**Impact:** Low. Spectators see "DEFEAT" instead of a neutral game-over view.

**Fix:** Check `session.participants.find(p => p.uid === currentUid)?.role === "spectator"` in `useSessionGameOver` and return a neutral result type (e.g., `"spectated"`).

### 4. SpectatorSessions Doc TTL (Scenario 6)

**Impact:** Very low. `SpectatorSessions` docs accumulate indefinitely. Add a `deleteAt` field or a scheduled cleanup Cloud Function.

### 5. Reconnection Windows Are Adequate

- TurnBasedRoom: 30s reconnect → auto-forfeit on timeout ✅
- PhysicsRoom: 15s reconnect → opponent wins on timeout ✅
- Both rooms save state when both players leave (turn-based only for restoration) ✅
