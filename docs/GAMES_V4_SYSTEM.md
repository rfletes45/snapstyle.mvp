# Games V4 System - Implementation Audit and Developer Guide

> Source of truth: the checked-out workspace on 2026-03-09.
> This document describes the system that is actually implemented today, including current inconsistencies.
> Companion: [GAME_INTEGRATION_GUIDE_V4.md](GAME_INTEGRATION_GUIDE_V4.md).

---

## Table of Contents

1. [Current Snapshot](#1-current-snapshot)
2. [Game Inventory](#2-game-inventory)
3. [Architecture Families](#3-architecture-families)
4. [Key Files by Layer](#4-key-files-by-layer)
5. [Core Flows](#5-core-flows)
6. [Runtime Comparison](#6-runtime-comparison)
7. [Data Model and Authority Boundaries](#7-data-model-and-authority-boundaries)
8. [Leaderboards, Achievements, XP, and Wallet](#8-leaderboards-achievements-xp-and-wallet)
9. [Sketch Party / Colyseus Reference Architecture](#9-sketch-party--colyseus-reference-architecture)
10. [Known Inconsistencies and Sharp Edges](#10-known-inconsistencies-and-sharp-edges)
11. [Testing Surface](#11-testing-surface)
12. [Guidance for Future Changes](#12-guidance-for-future-changes)

---

## 1. Current Snapshot

The current V4 game system is not one architecture. It is three related patterns living under one product surface.

- 22 canonical `GameId` values exist in `src/gamesV4/types/common.ts`.
- 12 games are enabled in `IMPLEMENTED_GAME_IDS` in `src/gamesV4/constants.ts`.
- 13 client adapters are registered in `src/gamesV4/adapters/index.ts`.
- 13 backend adapters are registered in `firebase-backend/functions/src/gamesV4/adapters.ts`.
- 13 screens are mapped in `src/gamesV4/screens/GamePlayDispatcherV4.tsx`. That includes disabled `minigolf_duels`.
- 16 user callables, 2 admin callables, 3 Firestore triggers, and 1 scheduled watchdog job are exported from `firebase-backend/functions/src/gamesV4/index.ts`.
- 1 standalone realtime server package exists at `colyseus-server/`, and it currently hosts exactly 1 room: `sketch_party`.
- 14 achievement sections exist today: 13 game sections plus the shared `milestones` section.

### Exported V4 Cloud Functions surface

User callables:

- `createGameInviteV4`
- `cancelGameInviteV4`
- `joinInviteLobbyV4`
- `leaveInviteLobbyV4`
- `startGameFromInviteV4`
- `updateLobbySettingsV4`
- `createSoloSessionV4`
- `resumeOrCreateSoloSessionV4`
- `restartSoloSessionV4`
- `suspendSoloSessionV4`
- `archiveSoloSessionV4`
- `submitTurnMoveV4`
- `resignSessionV4`
- `claimLevelRewardV4`
- `claimAchievementV4`
- `claimAchievementSectionBadgeV4`

Admin callables:

- `adminClearGameV4`
- `adminClearConversationGamesV4`

Triggers and background jobs:

- `onGameInviteV4Deleted`
- `onSessionV4StatusChanged`
- `onRealtimeResolutionRequest`
- `watchdogGamesV4`

Internal exports used by other modules:

- `resolveRealtimeSessionV4`
- `resolveSessionV4Internal`

---

## 2. Game Inventory

This section is intentionally split by implementation state. `GAME_METADATA` contains all 22 catalog entries, but most catalog entries are placeholders only.

### 2.1 Enabled and wired in the current workspace

| GameId | Runtime in client metadata | Architecture | Status | Notes |
| --- | --- | --- | --- | --- |
| `play_2048` | `solo` | Firebase-driven solo | Enabled, fully wired | Standard solo lifecycle. Canonical score-based solo implementation. |
| `brick_breaker` | `solo` | Firebase-driven solo | Enabled, fully wired | Uses pause registration in `GameScreenShell`; move payload limits in `submitTurnMoveV4` are sized for replay-like arrays. |
| `minesweeper` | `solo` | Firebase-driven solo | Enabled, fully wired | Uses encoded score values for clear tier plus time. |
| `solitaire_klondike` | `solo` | Firebase-driven solo | Enabled, fully wired | Standard solo lifecycle, no persistent solo hooks enabled. |
| `tic_tac_toe` | `turnBased` | Firebase turn-based | Enabled, fully wired | Smallest reference game. |
| `connect_four` | `turnBased` | Firebase turn-based | Enabled, fully wired | Larger board but same general turn pipeline as Tic Tac Toe. |
| `chess` | `turnBased` | Firebase turn-based | Enabled, fully wired | Has dedicated engine logic and its own extra test coverage. |
| `reversi` | `turnBased` | Firebase turn-based | Enabled in current workspace | Uses standard turn-based pipeline. |
| `dots_and_boxes` | `turnBased` | Firebase turn-based | Enabled in current workspace | Uses standard turn-based pipeline; invite metadata disagrees on `maxPlayers`. |
| `crazy_eights` | `turnBased` | Firebase turn-based with private state | Enabled, fully wired | Hidden-info card game. Client shell cannot fully validate moves locally because it does not have private state. |
| `battleship` | `turnBased` | Firebase turn-based with private state | Enabled, but metadata mismatch exists | Client and adapters treat it as turn-based with spectators; backend invite metadata treats it as realtime and non-spectated. |
| `sketch_party_game` | `realtime` | Hybrid Firebase + Colyseus | Enabled, but realtime bridge issues exist | Live authority sits in Colyseus, not Firestore. Resolution is supposed to re-enter the V4 pipeline via a Firestore bridge. |

### 2.2 Implemented in code but intentionally disabled

| GameId | Runtime in client metadata | Architecture | Status | Notes |
| --- | --- | --- | --- | --- |
| `minigolf_duels` | `turnBased` | Firebase turn-based | Adapter-backed but disabled | Client adapter, backend adapter, screen, achievements, and leaderboard config exist. It is commented out in `IMPLEMENTED_GAME_IDS` with `disabled - not working, deferred until ready`. |

### 2.3 Catalog placeholders only

| GameId | Runtime in client metadata | Architecture status | Notes |
| --- | --- | --- | --- |
| `bounce_blitz` | `solo` | Catalog placeholder | Metadata only. No adapter or screen. |
| `word_master` | `solo` | Catalog placeholder | Metadata only. No adapter or screen. |
| `lights_out` | `solo` | Catalog placeholder | Metadata only. No adapter or screen. |
| `checkers` | `turnBased` | Catalog placeholder | Metadata only. No adapter or screen. |
| `gomoku` | `turnBased` | Catalog placeholder | Metadata only. No adapter or screen. |
| `pong_game` | `realtime` | Catalog placeholder | Metadata only. No room or screen. |
| `starforge_game` | `realtime` | Catalog placeholder | Metadata only. No room or screen. |
| `crossword_puzzle` | `realtime` | Catalog placeholder | Metadata only. No room or screen. |
| `dot_match` | `realtime` | Catalog placeholder | Metadata only. No room or screen. |

### 2.4 Important classification notes

- `sketch_party_game` is the only true Colyseus-backed realtime game in the tree.
- `battleship` and `minigolf_duels` appear under the "Realtime games" comment block in `src/gamesV4/constants.ts`, but both actually declare `runtimeType: "turnBased"` in client metadata and adapters.
- `battleship` and `crazy_eights` are the two current hidden-information games using `PrivateState/{uid}` documents.
- A persistent-solo framework exists in shared types, constants, `GameScreenShell`, and backend `solo.ts`, but no current adapter opts into `supportsOfflineProgression`. That framework should be treated as dormant infrastructure, not a production gameplay pattern.

---
## 3. Architecture Families

### 3.1 Firebase-driven solo

Used by `play_2048`, `brick_breaker`, `minesweeper`, and `solitaire_klondike`.

Characteristics:

- Session authority is Firestore plus Cloud Functions.
- There is no invite document and no lobby.
- UI launches from the Games Hub via `resumeOrCreateSoloSessionV4`.
- `GameScreenShell` handles suspend-on-exit and menu actions.
- Moves still go through `submitTurnMoveV4`; solo just keeps the same player as the acting participant.
- Restart and resign flow through backend callables and then through the shared resolution pipeline.

### 3.2 Firebase turn-based

Used by `tic_tac_toe`, `connect_four`, `chess`, `reversi`, `dots_and_boxes`, `crazy_eights`, `battleship`, and disabled `minigolf_duels`.

Characteristics:

- Firestore session documents are the live state machine.
- Invite and lobby are generic and shared.
- Client adapters and backend adapters are expected to stay deterministic and aligned.
- Hidden-information games store per-player state in `PrivateState/{uid}` and rely on server-side validation for authoritative move legality.
- `GameScreenShell` provides optimistic state for public-state games, but that optimism is intentionally incomplete for hidden-information games.

### 3.3 Hybrid realtime

Used only by `sketch_party_game` today.

Characteristics:

- Firebase still owns invite creation, lobby, session creation, rewards, PBs, leaderboards, achievements, notifications, and final results.
- Colyseus owns live game authority, socket presence, round timers, scoring, drawing relay, guess checking, and reconnect behavior.
- Firestore `PublicState/state` is created when the session starts but is not kept in sync during the live match.
- The end of the match is supposed to flow back into the shared V4 resolution pipeline through a Firestore bridge document.

### 3.4 Persistent solo framework (present but unused)

Implemented in shared abstractions but not active for any current game.

Relevant files:

- `src/gamesV4/types/adapter.ts`
- `src/gamesV4/types/session.ts`
- `src/gamesV4/constants.ts`
- `src/gamesV4/components/GameScreenShell.tsx`
- `firebase-backend/functions/src/gamesV4/solo.ts`

Current reality:

- The code supports `soloMode`, offline progression, archive-only finalization, and long-lived session policies.
- No adapter in the current workspace actually sets `supportsOfflineProgression`.
- Backend `solo.ts` explicitly comments that no current game uses persistent mode.

---

## 4. Key Files by Layer

### 4.1 Client

| Responsibility | Main files |
| --- | --- |
| Game catalog and metadata | `src/gamesV4/constants.ts` |
| Core types | `src/gamesV4/types/` |
| Adapter registry and runner | `src/gamesV4/adapters/registry.ts`, `src/gamesV4/adapters/gameRunner.ts`, `src/gamesV4/adapters/index.ts` |
| Firebase service wrappers | `src/gamesV4/services/gameServiceV4.ts` |
| Realtime client service | `src/gamesV4/services/sketchPartyClient.ts` |
| Session shell | `src/gamesV4/components/GameScreenShell.tsx` |
| Lobby and game subscriptions | `src/gamesV4/hooks/` |
| Chat-linked entry points | `src/screens/chat/ChatScreen.tsx`, `src/screens/groups/GroupChatScreen.tsx`, `src/gamesV4/components/PinnedInviteBar.tsx`, `src/gamesV4/components/GamePickerModal.tsx` |
| Route registration | `src/navigation/RootNavigator.tsx` |
| Game dispatcher | `src/gamesV4/screens/GamePlayDispatcherV4.tsx` |
| Hub, detail, over, stats, achievements | `src/gamesV4/screens/` |

### 4.2 Firebase backend

| Responsibility | Main files |
| --- | --- |
| Export surface | `firebase-backend/functions/src/gamesV4/index.ts` |
| Server adapters and serialization | `firebase-backend/functions/src/gamesV4/adapters.ts` |
| Invite creation | `firebase-backend/functions/src/gamesV4/invites.ts` |
| Lobby join/leave/start/settings | `firebase-backend/functions/src/gamesV4/lobby.ts` |
| Turn submission and resign | `firebase-backend/functions/src/gamesV4/sessions.ts` |
| Solo lifecycle | `firebase-backend/functions/src/gamesV4/solo.ts` |
| Resolution pipeline | `firebase-backend/functions/src/gamesV4/resolve.ts` |
| Achievements | `firebase-backend/functions/src/gamesV4/achievements.ts` |
| Notifications | `firebase-backend/functions/src/gamesV4/notifications.ts` |
| Level rewards | `firebase-backend/functions/src/gamesV4/levelRewardsV4.ts` |
| Achievement claiming | `firebase-backend/functions/src/gamesV4/claimAchievement.ts`, `firebase-backend/functions/src/gamesV4/claimSectionBadge.ts` |
| Triggers and watchdog | `firebase-backend/functions/src/gamesV4/triggers.ts`, `firebase-backend/functions/src/gamesV4/watchdog.ts` |

### 4.3 Colyseus server

| Responsibility | Main files |
| --- | --- |
| Server bootstrap | `colyseus-server/src/index.ts` |
| Sketch Party room authority | `colyseus-server/src/rooms/SketchPartyRoom.ts` |
| Sketch Party scoring helpers | `colyseus-server/src/data/scoring.ts` |
| Sketch Party word bank and hint helpers | `colyseus-server/src/data/wordBank.ts` |
| Firebase resolution bridge | `colyseus-server/src/bridge/firebaseBridge.ts` |

---

## 5. Core Flows

### 5.1 Multiplayer Firebase flow

1. Chat user taps the game button in `ChatScreen` or `GroupChatScreen`.
2. `GamePickerModal` lists games from `GAME_METADATA`, dimming any `gameId` not in `IMPLEMENTED_GAME_IDS`.
3. Client calls `createGameInviteV4` through `createGameInvite()`.
4. Backend writes `GameInvitesV4/{inviteId}` and pins the invite id into `Chats/{id}.pinnedGameInviteIds` or `Groups/{id}.pinnedGameInviteIds`.
5. `PinnedInviteBar` subscribes to pinned ids and per-invite documents, then routes taps to `GameLobbyV4`, `GamePlayV4`, or `GameOverV4` based on invite status.
6. Lobby uses `joinInviteLobbyV4`, `leaveInviteLobbyV4`, `updateLobbySettingsV4`, and `startGameFromInviteV4`.
7. `startGameFromInviteV4` creates `GameSessionsV4/{sessionId}`, `PublicState/state`, any initial `PrivateState/{uid}` docs, and flips the invite to `active`.
8. `GamePlayDispatcherV4` routes `gameId` to the screen, and the screen is wrapped by `withGameV4Shell(...)`.
9. For Firebase-driven games, gameplay goes through `submitTurnMoveV4` and optionally `resignSessionV4`.
10. Any terminal path calls `resolveSessionV4Internal`, which writes `GameResultsV4`, leaderboards, PBs, XP, achievements, rewards, and notifications.
11. `GameScreenShell` waits 1.5 seconds after terminal state and then replaces the screen with `GameOverV4`.

### 5.2 Solo flow

The solo launch path is not uniform across all entry points.

Current behavior:

- `GamesHubScreenV4` uses `resumeOrCreateSoloSessionV4`.
- `GameDetailScreenV4` still uses `createSoloSessionV4` directly, so it always starts a fresh run.
- `GameOverScreenV4` rematch for solo also uses `createSoloSessionV4`.

During active play:

- `GameScreenShell` writes `Users/{uid}/GamePresence/{sessionId}` for notification suppression.
- Back on solo screens calls `suspendSoloSessionV4` and navigates away without resolving the session.
- Restart uses `restartSoloSessionV4`.
- Resign uses `resignSessionV4`.
- Archive exists in the API surface for persistent solo but is not used by current adapters.

### 5.3 Realtime Sketch Party flow

1. Invite and lobby use the same Firebase pipeline as other multiplayer games.
2. `startGameFromInviteV4` creates a Firebase session with `runtimeType` copied from the invite and seeds a minimal initial public state via the `sketchParty` adapter.
3. `SketchPartyScreenV4` mounts inside `GameScreenShell` but immediately opens a Colyseus socket via `joinSketchPartyRoom(sessionId, uid, displayName, token, settings)`.
4. Live state comes from Colyseus `state_sync`, `board_snapshot`, `chat`, `reaction_event`, `word_choices`, `turn_scores`, and `word_reveal` messages.
5. The screen does not use `submitTurnMoveV4` for live gameplay.
6. At match end, `SketchPartyRoom` computes the scoreboard and calls the Firebase bridge, which is supposed to trigger backend resolution.
7. Shared V4 resolution should then write the normal `GameResultsV4`, XP, PBs, achievements, leaderboard entries, and notifications.

Important realtime caveat:

- Firestore session/public-state documents are not the live source of truth once the room starts. During a Sketch Party match, the actual round state exists only in Colyseus memory and client-local React state.

---
## 6. Runtime Comparison

| Dimension | Solo | Turn-based | Realtime (`sketch_party_game`) |
| --- | --- | --- | --- |
| Live authority | Firestore + Cloud Functions | Firestore + Cloud Functions | Colyseus room memory |
| Transport | Firestore snapshots + callables | Firestore snapshots + callables | Colyseus socket messages, plus Firebase for lifecycle and resolution |
| Live state source in UI | `useGameSessionV4().publicState` | `useGameSessionV4().publicState` | Colyseus `roomState`; Firebase public state is bootstrap-only |
| Primary action path | `submitTurnMoveV4` | `submitTurnMoveV4` | Custom room messages |
| Invite/lobby | No invite, no lobby | Shared V4 invite and lobby | Shared V4 invite and lobby |
| Resume behavior | Hub uses resume-or-create, detail page does not | Re-open via invite chip or deep link | Rejoin room by `sessionId`; reconnect behavior is room-defined |
| Exit behavior in `GameScreenShell` | Suspend on back, restart/resign in menu | Back leaves non-destructively, resign is explicit | Destructive leave confirmation |
| Spectators | No | Generic support exists; individual games opt in | Not supported in current room |
| Notifications | No turn notifications, shared result/achievement notifications | Shared turn, result, and achievement notifications | Shared result and achievement notifications; turn notifications do not apply |
| Hidden-info support | N/A in current solo set | Yes, via `PrivateState/{uid}` for Battleship and Crazy Eights | Not implemented |

---

## 7. Data Model and Authority Boundaries

### 7.1 Collections that matter to the game system

| Path | Writer | Purpose |
| --- | --- | --- |
| `GameInvitesV4/{inviteId}` | Cloud Functions | Chat-facing invite and lobby state |
| `GameSessionsV4/{sessionId}` | Cloud Functions | Canonical session lifecycle doc |
| `GameSessionsV4/{sessionId}/PublicState/state` | Cloud Functions | Public gameplay state for Firebase-driven games |
| `GameSessionsV4/{sessionId}/PrivateState/{uid}` | Cloud Functions | Private player state for hidden-information games |
| `GameSessionsV4/{sessionId}/Moves/{moveId}` | Client create + Cloud Functions update | Move ledger for Firebase-driven games |
| `GameResultsV4/{sessionId}` | `resolveSessionV4Internal` | Final result payload |
| `LeaderboardsV4/{gameId}/Weeks/{weekKey}/Entries/{uid}` | `resolveSessionV4Internal` | Weekly leaderboard entries |
| `Users/{uid}/GamePB/{gameId}` | `resolveSessionV4Internal` | Personal bests and lifetime counters |
| `Users/{uid}/Achievements/{type}` | `resolveSessionV4Internal` and claim callables | Achievement earn and claim state |
| `Users/{uid}/AchievementSections/{sectionId}` | `claimAchievementSectionBadgeV4` | Section badge claim state |
| `Users/{uid}/LevelRewardsV4/{level}` | XP pipeline and claim callables | Unclaimed and claimed level rewards |
| `Users/{uid}/InAppNotificationsV4/{id}` | Backend notification writers | Game turn and achievement notifications |
| `Users/{uid}/GamePresence/{sessionId}` | Client shell | Presence gating for notifications |
| `Wallets/{uid}` | Claim callables | Token balance |
| `Transactions/{txId}` | Claim callables and economy backend | Wallet audit ledger |

### 7.2 Authority boundaries that are easy to misunderstand

- For Firebase-driven games, `GameSessionsV4` plus `PublicState` plus `PrivateState` are the live authoritative state.
- For Sketch Party, `GameSessionsV4/PublicState/state` is only a bootstrap artifact. Live round state is not mirrored back into Firestore.
- `GameScreenShell` does local optimistic validation against public state only. It intentionally does not have access to private player state.
- `resolveSessionV4Internal` is the single reward and stats chokepoint for all completed games, including the intended realtime path.

### 7.3 Hidden-information pattern

Current hidden-information games:

- `battleship`
- `crazy_eights`

Implications:

- The client shell passes `{}` as `privateStateByPlayer` during optimistic local validation.
- Those games still submit the move even when local validation cannot fully prove legality.
- The server transaction reads `PrivateState/{uid}` and performs the authoritative validation.
- This is a deliberate architecture compromise, not a bug in those adapters.

---

## 8. Leaderboards, Achievements, XP, and Wallet

### 8.1 Leaderboard metrics currently configured in the backend

Wins-based:

- `tic_tac_toe`
- `connect_four`
- `chess`
- `battleship`
- `crazy_eights`
- `reversi`
- `dots_and_boxes`

Best-score-based:

- `play_2048`
- `sketch_party_game`
- `brick_breaker`
- `minigolf_duels`
- `minesweeper`
- `solitaire_klondike`

Files:

- `src/gamesV4/constants.ts`
- `firebase-backend/functions/src/gamesV4/types.ts`

### 8.2 Achievement sections currently present

| Section | Count of definitions in client mirror | Notes |
| --- | --- | --- |
| `tic_tac_toe` | 4 | Game-specific |
| `connect_four` | 4 | Game-specific |
| `play_2048` | 5 | Game-specific |
| `chess` | 16 | Game-specific |
| `sketch_party` | 13 | Section id does not equal the game id `sketch_party_game` |
| `battleship` | 16 | Game-specific |
| `brick_breaker` | 19 | Game-specific |
| `crazy_eights` | 17 | Game-specific |
| `minigolf_duels` | 13 | Definitions exist even though the game is disabled |
| `minesweeper` | 18 | Game-specific |
| `solitaire_klondike` | 14 | Game-specific |
| `reversi` | 14 | Game-specific |
| `dots_and_boxes` | 18 | Game-specific |
| `milestones` | 9 | Cross-game |

Files:

- `src/gamesV4/data/achievementDefinitions.ts`
- `firebase-backend/functions/src/gamesV4/achievements.ts`

### 8.3 XP and token model

- XP is applied automatically during `resolveSessionV4Internal`.
- Achievement tokens are not auto-credited. They require `claimAchievementV4`.
- Level rewards are not auto-credited. They require `claimLevelRewardV4`.
- Both claim paths update `Wallets/{uid}` and write `Transactions/{txId}` entries.
- `WalletScreen` and `usePendingRewards()` surface pending reward counts from achievement and level reward docs.

---
## 9. Sketch Party / Colyseus Reference Architecture

Sketch Party is the most important architectural exception in the V4 system.

### 9.1 Files that define the pattern

Client:

- `src/gamesV4/adapters/sketchParty.ts`
- `src/gamesV4/data/sketchPartySettings.ts`
- `src/gamesV4/services/sketchPartyClient.ts`
- `src/gamesV4/screens/SketchPartyScreenV4.tsx`

Realtime server:

- `colyseus-server/src/index.ts`
- `colyseus-server/src/rooms/SketchPartyRoom.ts`
- `colyseus-server/src/data/scoring.ts`
- `colyseus-server/src/data/wordBank.ts`
- `colyseus-server/src/bridge/firebaseBridge.ts`

Firebase side of the bridge:

- `firebase-backend/functions/src/gamesV4/triggers.ts`
- `firebase-backend/functions/src/gamesV4/sessions.ts`

### 9.2 What is shared with the rest of V4

Sketch Party still uses the normal V4 system for:

- game metadata and catalog placement
- chat invite creation
- lobby membership and settings patching
- session document creation
- game screen routing through `GamePlayDispatcherV4`
- `GameScreenShell` for presence, result navigation, and destructive realtime exit handling
- final result persistence, XP, PBs, achievements, leaderboards, and notifications

### 9.3 What is custom to Sketch Party

Colyseus owns the live match:

- room join and reconnect
- player connection tracking
- turn order and round advancement
- word choice and hint scheduling
- drawing stroke relay and replay buffer
- guess validation and scoring
- reactions and chat relay
- disconnect handling
- end-of-turn and end-of-match timing

### 9.4 Room state and lifecycle

The room uses a plain JavaScript object, not Colyseus Schema state.

Current room phases:

- `waiting`
- `choosing`
- `drawing`
- `turn_end`
- `match_end`

Current room settings:

- `maxPlayers`
- `rounds`
- `drawTimeSec`
- `turnChooseTimeSec`
- `wordChoices`
- `hints`
- `customWordsEnabled`
- `customWordsList`

Current message families:

- room state: `state_sync`, `board_snapshot`, `settings_applied`
- drawing: `stroke_begin`, `stroke_points`, `stroke_end`, `undo`, `clear`
- guessing and turn control: `guess`, `word_choice`, `word_reveal`, `turn_start`, `turn_scores`
- social layer: `chat`, `reaction`, `reaction_event`

Scoring helpers live in `colyseus-server/src/data/scoring.ts`:

- `computeGuesserPoints(...)`
- `computeTimeBonus(...)`
- `computeDrawerGainPerGuesser(...)`

Word and hint helpers live in `colyseus-server/src/data/wordBank.ts`:

- `pickRandomWords(...)`
- `computeMaskedWord(...)`
- `isCorrectGuess(...)`

### 9.5 Reconnect and disconnect behavior

What is implemented:

- Reconnect is keyed by `uid`, not by host role or Firebase session state.
- If an existing `uid` rejoins, the room updates the stored Colyseus `sessionId`, marks the player connected, and sends a `board_snapshot`.
- If the drawer disconnects during the drawing phase, the room ends the turn early.
- If all players disconnect, the room ends the match with resolution type `disconnect`.

What does not exist:

- no host migration logic inside the room
- no spectator path
- no explicit role lock once the match starts

### 9.6 Where Sketch Party differs from Firebase games in practice

- `SketchPartyScreenV4` takes `publicState` from `GameScreenShell` but then ignores it for live gameplay once Colyseus `roomState` starts arriving.
- Firestore `PublicState/state` does not carry live draw/guess/timer updates.
- Invite summary updates are not driven by room events, so chat chips do not have room-authoritative realtime progress.
- The room is expected to hand the final scoreboard back to Firebase at the end rather than writing incremental progress during play.

### 9.7 Current realtime-specific issues that future Colyseus work must not copy

1. Bridge path mismatch

   - The Colyseus bridge writes to `gameSessions/{sessionId}/internal/realtimeResolution`.
   - The Firebase trigger listens on `GameSessionsV4/{sessionId}/internal/realtimeResolution`.
   - As currently written, those paths do not match.

2. No room-side auth or membership verification

   - `joinSketchPartyRoom(...)` sends a Firebase token.
   - `SketchPartyRoom.onJoin()` does not verify the token.
   - The room also does not verify that the caller belongs to the Firebase session roster.

3. Match start is based on socket count, not session roster

   - `SketchPartyRoom` starts the match when `players.size >= 2` and phase is `waiting`.
   - It does not wait for the full set of Firebase session participants.
   - For multi-player sessions larger than two, late joiners can miss turn-order initialization.

4. Settings gap

   - `customWordsEnabled` and `customWordsList` are accepted and propagated into effective settings.
   - The room still always pulls words from `pickRandomWords(...)` and never consumes custom words.

5. Client/server message drift

   - The client service exposes `sendToolSet(...)`.
   - The room does not register a `tool_set` handler.

6. Secret-word modeling drift

   - Room comments and client types imply `secretWord` may be filtered per player.
   - `getPublicState()` omits `secretWord` entirely from `state_sync`.
   - The drawer therefore relies on word-choice UI and turn-end `word_reveal`, not room state, to know the active word.

7. Documentation drift around animation

   - Older docs claimed game animations must not use `react-native-reanimated`.
   - `SketchPartyScreenV4` currently uses `react-native-reanimated` for some UI animation work.
   - The actual codebase is mixed; do not assume one universal animation rule.

### 9.8 What future Colyseus-backed games should copy from Sketch Party

Copy these patterns:

- keep invite, lobby, session creation, PBs, achievements, XP, and rewards inside the shared V4 pipeline
- use a dedicated client room service module similar to `sketchPartyClient.ts`
- keep the room in a separate server package with a small entrypoint and explicit room registration
- return a final scoreboard into Firebase instead of duplicating reward logic in the room server
- build reconnect around explicit room snapshots rather than assuming the client can reconstruct state

Do not copy these gaps:

- token passed but not verified
- no session-membership validation
- no roster lock before match start
- Firestore bridge path mismatch
- settings accepted by UI but unused by the room

---
## 10. Known Inconsistencies and Sharp Edges

### 10.1 Client metadata vs backend invite metadata drift

The backend `GAME_META` inside `firebase-backend/functions/src/gamesV4/invites.ts` is not a mirror of client `GAME_METADATA`.

Current mismatches:

| GameId | Client-side expectation | Backend invite metadata | Why it matters |
| --- | --- | --- | --- |
| `battleship` | `runtimeType: "turnBased"`, `supportsSpectate: true` | `runtimeType: "realtime"`, `supportsSpectate: false` | Invite docs and started sessions inherit the backend value, not the client value. |
| `minigolf_duels` | `supportsSpectate: true` | `supportsSpectate: false` | Spectator capability is inconsistent across layers. |
| `dots_and_boxes` | `maxPlayers: 2` | `maxPlayers: 4` | Lobby and invite validation can disagree with adapter assumptions. |

### 10.2 Solo resume behavior is inconsistent by entry point

- Hub launch uses `resumeOrCreateSoloSessionV4`.
- Game detail launch uses `createSoloSessionV4`.
- Solo rematch from game over uses `createSoloSessionV4`.

That means "Play Now" from the hub can resume, while "Play" from detail and game over always create a new run.

### 10.3 `subscribeToActiveSoloSessions()` queries a status that does not exist

In `src/gamesV4/services/gameServiceV4.ts`, `subscribeToActiveSoloSessions()` queries:

- `status in ["active", "suspended"]`

But `SessionStatus` does not include `suspended`; actual suspend state is represented by `soloSuspendedAt` while the session status remains `active`.

### 10.4 Week-key calculations are not unified

Current week-key helpers differ between client and backend.

Files:

- `firebase-backend/functions/src/gamesV4/helpers.ts`
- `src/gamesV4/hooks/useLeaderboardV4.ts`

This can create leaderboard week mismatches near week boundaries.

### 10.5 Hidden-information optimistic validation is intentionally incomplete

`GameScreenShell` documents this directly: it passes `{}` for `privateStateByPlayer` during optimistic local validation.

Impact:

- public-state games feel instant locally
- hidden-information games still submit moves even when local validation cannot prove them
- server transaction remains authoritative

### 10.6 Realtime sessions do not feed live progress back into Firestore

This is not just a documentation omission. It affects system behavior.

- active invite summary for realtime games is not room-authoritative
- Firestore public state is stale during the match
- any future feature reading only Firestore will not see live Sketch Party state

### 10.7 Animation guidance in old docs no longer matches the codebase

- `TicTacToeScreenV4` and `ConnectFourScreenV4` use core `Animated`.
- `SketchPartyScreenV4` uses `react-native-reanimated`.
- New documentation should describe the current mixed state, not a blanket prohibition that is already violated by shipped code.

---

## 11. Testing Surface

### 11.1 Current V4 test inventory

Adapter and game tests:

- `__tests__/gamesV4/adapters/brickBreaker.test.ts`
- `__tests__/gamesV4/adapters/chess.test.ts`
- `__tests__/gamesV4/adapters/connectFour.test.ts`
- `__tests__/gamesV4/adapters/crazyEights.test.ts`
- `__tests__/gamesV4/adapters/dotsAndBoxes.test.ts`
- `__tests__/gamesV4/adapters/minesweeper.test.ts`
- `__tests__/gamesV4/adapters/miniGolf.test.ts`
- `__tests__/gamesV4/adapters/play2048.test.ts`
- `__tests__/gamesV4/adapters/registry.test.ts`
- `__tests__/gamesV4/adapters/sketchParty.test.ts`
- `__tests__/gamesV4/adapters/sketchPartySettings.test.ts`
- `__tests__/gamesV4/adapters/solitaireKlondike.test.ts`
- `__tests__/gamesV4/adapters/ticTacToe.test.ts`

Flow, shell, and integration coverage:

- `__tests__/gamesV4/gameScreenShellExit.test.ts`
- `__tests__/gamesV4/lobbyBugRegression.test.ts`
- `__tests__/gamesV4/lobbySettings.test.ts`
- `__tests__/gamesV4/moderation.test.ts`
- `__tests__/gamesV4/presenceNavigation.test.ts`
- `__tests__/gamesV4/soloSuspendResume.test.ts`
- `__tests__/gamesV4/screens/play2048Engine.test.ts`
- `__tests__/gamesV4/screens/play2048Integration.test.ts`
- `__tests__/gamesV4/chess/chessEngine.test.ts`
- `__tests__/gamesV4/chess/chessUIBugFixes.test.ts`

Backend and shared logic:

- `__tests__/gamesV4/constants/constants.test.ts`
- `__tests__/gamesV4/resolve/achievementEvaluator.test.ts`
- `__tests__/gamesV4/resolve/resolvePipeline.test.ts`
- `__tests__/gamesV4/resolve/walletRewardSync.test.ts`
- `__tests__/gamesV4/validation/validation.test.ts`

### 11.2 Useful commands

```powershell
npx jest --testPathPattern=gamesV4
npx jest --testPathPattern=gamesV4/adapters
npx jest --testPathPattern=gamesV4/resolve
npx tsc --noEmit
cd firebase-backend/functions
npm run build
```

Realtime note:

- There is no dedicated Colyseus integration test suite in `colyseus-server/` for end-to-end room behavior.
- Sketch Party room correctness is currently covered mostly through adapter/settings tests and manual reasoning, not full socket-level integration tests.

---

## 12. Guidance for Future Changes

When auditing or extending the current system, assume these rules:

1. Code beats docs.
2. `GAME_METADATA`, `IMPLEMENTED_GAME_IDS`, backend invite metadata, adapter metadata, dispatcher mapping, and achievement sections must stay aligned.
3. Realtime games are not just another adapter. They need an explicit split between Firebase lifecycle and room authority.
4. If a game has private state, design around server authority first and client optimism second.
5. If you add another Colyseus game, fix auth, roster validation, and the Firebase bridge path before copying Sketch Party wholesale.
6. If you touch leaderboards, unify week-key calculation across client and backend first.
7. If you expose a settings field in the lobby, verify that the actual game runtime consumes it.
