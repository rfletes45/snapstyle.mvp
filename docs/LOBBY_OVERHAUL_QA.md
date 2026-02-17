# Lobby System Overhaul — QA Checklist & Root-Cause Writeup

## Root-Cause Analysis

### Bug A: Chess duplicate joins / double navigation

**Root cause:** `UniversalInviteCard` had an auto-navigate effect that fired after 300ms AND `handleStartEarly` in `ChatGameInvites` also navigated. Both called `onNavigateToGame`, causing two navigation events to the same game screen.

**Fix (prior session):**

- Removed navigation from `handleStartEarly` — it now only calls `startGameEarly()`.
- Updated `onPlay` callback signature to `(gameId, gameType, inviteId?)` so the auto-navigate passes `invite.id`.
- All Play buttons on `UniversalInviteCard` now forward `inviteId`.

### Bug B: Games NOT auto-navigating host from chat

**Root cause:** `GamePickerModal` creates an invite via `sendUniversalInvite()` then calls `onInviteCreated?.(invite)` then `onDismiss()`. But in `ChatScreen`, `handleInviteCreated` was literally `() => {}` (a no-op). The host stayed in chat after creating an invite — they never navigated to the game lobby.

**Fix (this session):**

- `ChatScreen.handleInviteCreated` now calls `handleNavigateToGame(invite.gameId || "", invite.gameType, { inviteId: invite.id })`, which navigates the host into the game lobby.
- Same fix applied to `GroupChatScreen`.

### Bug B2: Joiner not navigating to game lobby

**Root cause:** `ChatGameInvites.handleJoin` only navigated when `roomKey || invite.gameId` existed. For turn-based invites freshly created from chat (no `colyseusRoomKey`, no `gameId` yet), the join succeeded silently but the user stayed in the chat screen.

**Fix (this session):**

- `handleJoin` now ALWAYS navigates on successful join: `onNavigateToGame(matchId, invite.gameType, { inviteId: invite.id })` where `matchId = invite.settings?.colyseusRoomKey || invite.gameId || ""`.

### Bug C: DotMatch multiplayer broken

**Root cause (3 issues):**

1. `GameMode` type was `"ai" | "local"` — missing `"online"`, so `isMultiplayer = gameMode === "online"` was always `false`.
2. `onGameReady` callback never called `setGameMode("online")`.
3. Auto-join effect didn't pass `firestoreGameId` to `startMultiplayer()`.

**Fix (this session):**

- GameMode type → `"ai" | "local" | "online"`.
- `onGameReady` sets `gameMode("online")` and passes `{ firestoreGameId: gameId }` to `startMultiplayer`.
- Auto-join effect also passes `firestoreGameId` and sets game mode.
- `useMultiplayerGame.startMultiplayer` updated to accept `firestoreGameId` in options.

### Bug D: Duplicate invite creation (rapid taps / network retries)

**Root cause:** `sendUniversalInvite` always created a new Firestore doc. Two rapid taps = two invite docs.

**Fix:** Added idempotency query at top of `sendUniversalInvite` — checks for existing `pending/filling/ready` invite with same `(senderId, gameType, conversationId)`. Returns existing if found.

### Bug E: "You have already joined" error on re-join

**Root cause:** `claimInviteSlot` returned `{ success: false, error: "You have already joined" }` when the user was already in the claimed slots. This could happen on network retry or double-tap of Join button.

**Fix:** Now returns `{ success: true, invite }` when player is already in claimed slots — idempotent join.

---

## QA Checklist

### Test 1: Chat → Invite → Host Auto-Navigate (DM)

1. Open a DM conversation in ChatScreen.
2. Tap the game picker (controller icon).
3. Select any game (e.g., Crazy Eights, Chess, Checkers).
4. **Expected:** Host is automatically navigated to the game screen's lobby. The invite appears in the chat for the other user.
5. Verify: No duplicate navigation (screen doesn't flash/re-render).

### Test 2: Chat → Invite → Host Auto-Navigate (Group)

1. Open a group conversation in GroupChatScreen.
2. Tap the game picker.
3. Select any game.
4. **Expected:** Host is automatically navigated to the game screen's lobby. The invite appears in the group chat.

### Test 3: Chat → Join → Joiner Auto-Navigate

1. User A creates a game invite from chat (Test 1 above).
2. User B sees the invite card in ChatGameInvites.
3. User B taps "Join".
4. **Expected:** User B is navigated to the game screen lobby with the invite ID.
5. Verify: Works for ALL game types (Chess, Checkers, TicTacToe, CrazyEights, ConnectFour, Reversi, DotMatch).

### Test 4: Chess — No Duplicate Navigation

1. User A creates a Chess invite from chat.
2. User B taps Join.
3. Invite becomes "active" → `UniversalInviteCard` auto-navigate fires.
4. **Expected:** Only ONE navigation event occurs. User B lands on Chess lobby, not a duplicate screen.
5. Verify: `navigatedInvitesRef` dedup prevents double navigation.

### Test 5: DotMatch Multiplayer Online Mode

1. Open DotMatch game screen via invite flow (with `inviteId`).
2. **Expected:** Game mode correctly set to `"online"`.
3. **Expected:** `isMultiplayer` is `true`, Colyseus room connects with `firestoreGameId`.
4. Verify: The dots-and-boxes game plays correctly in multiplayer mode.

### Test 6: Idempotent Invite Creation

1. User rapidly taps the game picker "send" button twice in quick succession.
2. **Expected:** Only ONE invite document created in Firestore.
3. The second call returns the existing invite without creating a duplicate.

### Test 7: Idempotent Invite Join

1. User taps "Join" on an invite, experiences network delay, taps again.
2. **Expected:** `claimInviteSlot` returns success both times without error.
3. User appears only once in the `claimedSlots` array.

### Test 8: Navigation Dedup Guard

1. `UniversalInviteCard` auto-navigate fires for an invite.
2. User also manually taps the Play button on the same card.
3. **Expected:** Only one navigation — the second is silently skipped via `navigatedInvitesRef`.

### Test 9: Leave Lobby → Return to Chat

1. Host creates invite from chat, auto-navigates to lobby.
2. Host presses Back / Leave in the lobby.
3. **Expected:** Returns to the chat screen. Invite is cancelled (host) or slot is unclaimed (joiner).

### Test 10: Play Screen → Game → Invite Friend (Within Game)

1. Navigate to a game from the Play tab (e.g., press Chess → "Invite Friend").
2. **Expected:** Enters lobby mode, sends invite, opponent can join from chat.
3. Note: Play screen currently doesn't have its own GamePickerModal — invite creation happens within individual game screens via InvitePickerModal.

---

## Files Modified (This Session)

| File                                       | Change                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `src/screens/chat/ChatScreen.tsx`          | `handleInviteCreated` navigates host to lobby; `navigatedInvitesRef` dedup guard |
| `src/screens/groups/GroupChatScreen.tsx`   | Same as ChatScreen: `handleInviteCreated` + dedup guard                          |
| `src/components/chat/ChatGameInvites.tsx`  | `handleJoin` always navigates with `inviteId`                                    |
| `src/screens/games/DotMatchGameScreen.tsx` | GameMode type fixed, `firestoreGameId` + `setGameMode("online")`                 |
| `src/services/gameInvites.ts`              | Idempotent `sendUniversalInvite` + idempotent `claimInviteSlot`                  |
| `src/hooks/useMultiplayerGame.ts`          | `startMultiplayer` accepts `firestoreGameId` option                              |

## Known Remaining Items

- **Play screen invite creation:** No GamePickerModal on the Play tab itself. Users create invites from within game screens (InvitePickerModal) or from chat. This may be acceptable since the flow is: Play tab → Game screen → "Invite Friend" → Lobby.
- **Vacancy cleanup scheduler:** Server/Cloud Function-based cleanup with `pendingDeleteAt` timers is not yet implemented.
- **Real-time games audit:** Starforge, SketchParty, MiniGolf, Crossword screens have their own invite/lobby patterns and were not modified in this session.
- **GomokuGameScreen:** `gomoku_master` exists in game metadata but no screen file exists.
