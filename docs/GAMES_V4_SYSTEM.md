# Games V4 System - Architecture, Lifecycle, and Operations Reference

> Source of truth: the checked-out workspace on 2026-03-10.
> This document describes the system that is implemented today, including active exceptions, duplicated metadata, dormant infrastructure, and realtime special cases.
> Companion: [GAME_INTEGRATION_GUIDE_V4.md](GAME_INTEGRATION_GUIDE_V4.md).

---

## Table of Contents

1. [Scope and Snapshot](#1-scope-and-snapshot)
2. [Terminology and Invariants](#2-terminology-and-invariants)
3. [Game Inventory and Classification](#3-game-inventory-and-classification)
4. [Architecture Families](#4-architecture-families)
5. [Client Layer Map](#5-client-layer-map)
6. [Backend Layer Map](#6-backend-layer-map)
7. [Data Model and Storage Contracts](#7-data-model-and-storage-contracts)
8. [Lifecycle Flows](#8-lifecycle-flows)
9. [Authority and Ownership Rules](#9-authority-and-ownership-rules)
10. [Progression, Rewards, and Stats](#10-progression-rewards-and-stats)
11. [Navigation, Entry Points, and Post-Game Surfaces](#11-navigation-entry-points-and-post-game-surfaces)
12. [Sketch Party / Colyseus Case Study](#12-sketch-party--colyseus-case-study)
13. [Known Inconsistencies and Sharp Edges](#13-known-inconsistencies-and-sharp-edges)
14. [Testing and Operations Surface](#14-testing-and-operations-surface)
15. [Preservation Rules for Future Contributors](#15-preservation-rules-for-future-contributors)

---

## 1. Scope and Snapshot

The current V4 game system is not one uniform framework. It is three related runtime families sharing a common product shell:

- Firebase-driven solo games
- Firebase-driven turn-based games
- Hybrid Firebase + Colyseus realtime games, currently only `sketch_party_game`

Current snapshot in this workspace:

- 23 canonical `GameId` values exist in `src/gamesV4/types/common.ts`.
- 13 games are enabled in `IMPLEMENTED_GAME_IDS` in `src/gamesV4/constants.ts`.
- 14 client adapters are registered in `src/gamesV4/adapters/index.ts`.
- 14 backend adapters are registered in `firebase-backend/functions/src/gamesV4/adapters.ts`.
- 14 gameplay screens are mapped in `src/gamesV4/screens/GamePlayDispatcherV4.tsx`. That includes disabled `minigolf_duels`.
- 16 user callables, 2 admin callables, 3 Firestore triggers, and 1 scheduled watchdog job are exported from `firebase-backend/functions/src/gamesV4/index.ts`.
- 1 standalone realtime server package exists at `colyseus-server/`, and it currently hosts exactly 1 room: `sketch_party`.
- 14 achievement sections exist in the client mirror: 13 game sections plus the shared `milestones` section.

What this document is for:

- explain the real structure of the current system
- map shared infrastructure to the actual files that own it
- document which behaviors are standardized and which are not
- show how lifecycle, result, reward, and notification flows connect
- call out the parts of the architecture future contributors must preserve

What this document is not:

- an idealized architecture spec
- a product roadmap
- a promise that every catalog game is implemented

### 1.1 Exported V4 Cloud Functions surface

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

### 1.2 High-level system shape

```text
Catalog / Hub / Chat entry points
  -> metadata + routing + picker surfaces
  -> invite or solo session creation
  -> lobby or direct gameplay
  -> active session state
  -> terminal resolution
  -> result / PB / XP / achievements / leaderboards / wallet claims

Firebase-backed games:
  Firestore session docs are live authority during play.

Sketch Party:
  Firebase owns lifecycle and rewards.
  Colyseus owns live gameplay and reconnect state.
  Firestore only re-enters at final resolution.
```

---

## 2. Terminology and Invariants

### 2.1 Core terms

| Term          | Meaning                                                             | Where defined                                             |
| ------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| `GameId`      | Canonical append-only game key                                      | `src/gamesV4/types/common.ts`                             |
| `runtimeType` | `solo`, `turnBased`, or `realtime`                                  | `src/gamesV4/types/common.ts`, `src/gamesV4/constants.ts` |
| Invite        | Chat-facing pre-game object                                         | `GameInvitesV4/{inviteId}`                                |
| Session       | Canonical lifecycle doc for an actual match or run                  | `GameSessionsV4/{sessionId}`                              |
| Public state  | Shared game state visible to all allowed readers                    | `GameSessionsV4/{sessionId}/PublicState/state`            |
| Private state | Per-player hidden state                                             | `GameSessionsV4/{sessionId}/PrivateState/{uid}`           |
| Move doc      | Append-only move ledger entry                                       | `GameSessionsV4/{sessionId}/Moves/{moveId}`               |
| Result        | Terminal result payload                                             | `GameResultsV4/{sessionId}`                               |
| PB            | Personal best plus play and win counters                            | `Users/{uid}/GamePB/{gameId}`                             |
| Achievement   | Earned or claimed achievement doc                                   | `Users/{uid}/Achievements/{type}`                         |
| Section badge | Claimed completion badge for a section                              | `Users/{uid}/AchievementSections/{sectionId}`             |
| Presence      | Lightweight foreground presence marker for notification suppression | `Users/{uid}/GamePresence/{sessionId}`                    |

### 2.2 Invariants that must remain true

These are the assumptions the current code depends on.

1. `GameId` values are append-only. Renaming or deleting an existing ID will break documents, routing, PBs, achievements, leaderboards, and history.
2. `resolveSessionV4Internal()` is the only supported reward and stats chokepoint. Any new terminal path must end there or re-enter through `resolveRealtimeSessionV4()`.
3. Firebase-driven gameplay uses server-authoritative adapters. The client can be optimistic, but the backend transaction decides legality.
4. Hidden-information games must not trust client-only validation. The client shell deliberately lacks private state.
5. Realtime gameplay must authenticate room joins against Firebase state. Sketch Party now does this explicitly in the room.
6. `GAME_METADATA`, `IMPLEMENTED_GAME_IDS`, adapter metadata, dispatcher mappings, backend invite metadata, leaderboard descriptors, and achievement sections must stay aligned.
7. Turn notifications apply only to turn-based games.
8. Solo exit means suspend, not resolve, unless the user explicitly resigns, archives, or restarts.

### 2.3 What is standardized versus game-specific

Standardized across the current system:

- top-level catalog and routing surfaces
- invite documents and pinned-chat behavior
- lobby callables and session creation entry points
- Firestore session and result collections
- the shared result pipeline for XP, PB, leaderboards, and achievements
- achievements claim flow and level reward claim flow
- hub, detail, lobby, gameplay shell, game-over, leaderboard, and stats screens

Game-specific or partially standardized:

- adapter state shape and move semantics
- lobby settings schema and validation
- scoreboard semantics and score formatting
- PB interpretation and leaderboard metric (`wins` vs `bestScore`)
- game-specific performance metrics
- realtime room protocol and reconnect rules

---

## 3. Game Inventory and Classification

`GAME_METADATA` contains all 23 catalog entries. That does not mean all 23 are playable.

### 3.1 Enabled and wired in the current workspace

| GameId               | Runtime in metadata | Architecture                        | Integration state             | Notes                                                                             |
| -------------------- | ------------------- | ----------------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| `play_2048`          | `solo`              | Firebase solo                       | Enabled, complete             | Canonical score-based solo implementation.                                        |
| `brick_breaker`      | `solo`              | Firebase solo                       | Enabled, complete             | Uses shell pause registration and replay-like move payloads.                      |
| `minesweeper`        | `solo`              | Firebase solo                       | Enabled, complete             | Score encoding is game-specific.                                                  |
| `solitaire_klondike` | `solo`              | Firebase solo                       | Enabled, complete             | Uses standard solo lifecycle; persistent mode not enabled.                        |
| `tic_tac_toe`        | `turnBased`         | Firebase turn-based                 | Enabled, complete             | Smallest reference game.                                                          |
| `connect_four`       | `turnBased`         | Firebase turn-based                 | Enabled, complete             | Same pipeline as Tic Tac Toe with larger board state.                             |
| `chess`              | `turnBased`         | Firebase turn-based                 | Enabled, complete             | Has custom engine logic and broader tests.                                        |
| `reversi`            | `turnBased`         | Firebase turn-based                 | Enabled, complete             | Standard Firebase turn pipeline.                                                  |
| `dots_and_boxes`     | `turnBased`         | Firebase turn-based                 | Enabled, complete             | Backend invite metadata drift was fixed; current runtime expects 2 players.       |
| `crazy_eights`       | `turnBased`         | Firebase turn-based + private state | Enabled, complete             | Hidden-info card game; client optimism is intentionally limited.                  |
| `battleship`         | `turnBased`         | Firebase turn-based + private state | Enabled, complete             | Backend invite metadata drift was fixed; validation remains server-authoritative. |
| `hex`                | `turnBased`         | Firebase turn-based                 | Enabled, complete             | Standard deterministic board-game pattern.                                        |
| `sketch_party_game`  | `realtime`          | Hybrid Firebase + Colyseus          | Enabled, custom realtime path | Live gameplay authority sits in Colyseus, not Firestore.                          |

### 3.2 Implemented but intentionally disabled

| GameId           | Runtime in metadata | Architecture        | Integration state     | Notes                                                                                                                 |
| ---------------- | ------------------- | ------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `minigolf_duels` | `turnBased`         | Firebase turn-based | Implemented, disabled | Adapter, screen, achievements, and leaderboard config exist, but the game is commented out in `IMPLEMENTED_GAME_IDS`. |

### 3.3 Catalog placeholders only

| GameId             | Runtime in metadata | Current state |
| ------------------ | ------------------- | ------------- |
| `bounce_blitz`     | `solo`              | Metadata only |
| `word_master`      | `solo`              | Metadata only |
| `lights_out`       | `solo`              | Metadata only |
| `checkers`         | `turnBased`         | Metadata only |
| `gomoku`           | `turnBased`         | Metadata only |
| `pong_game`        | `realtime`          | Metadata only |
| `starforge_game`   | `realtime`          | Metadata only |
| `crossword_puzzle` | `realtime`          | Metadata only |
| `dot_match`        | `realtime`          | Metadata only |

### 3.4 Important classification notes

- `sketch_party_game` is the only true Colyseus-backed realtime game in the repository.
- `battleship`, `crazy_eights`, and only those two current enabled games use `PrivateState/{uid}` for hidden information.
- `minigolf_duels` is implemented far enough to appear in multiple registries, which means audit work must distinguish implemented from enabled.
- A persistent-solo framework exists in metadata, shared types, the shell, and backend solo callables, but no currently enabled game opts into `supportsOfflineProgression` or `soloMode: "persistent"`.

---

## 4. Architecture Families

### 4.1 Firebase-driven solo

Used by:

- `play_2048`
- `brick_breaker`
- `minesweeper`
- `solitaire_klondike`

Characteristics:

- no invite doc
- no lobby screen
- `resumeOrCreateSoloSessionV4` is the normal launch path from hub and detail
- `GameScreenShell` owns suspend-on-exit behavior
- moves still use `submitTurnMoveV4`
- the result pipeline is identical to multiplayer once the run resolves

Important nuance:

- `GameOverScreenV4` rematch still uses `createSoloSessionV4`, not `resumeOrCreateSoloSessionV4`, so rematch intentionally starts fresh.

### 4.2 Firebase turn-based

Used by:

- `tic_tac_toe`
- `connect_four`
- `chess`
- `reversi`
- `dots_and_boxes`
- `crazy_eights`
- `battleship`
- `hex`
- disabled `minigolf_duels`

Characteristics:

- Firestore session docs are the live state machine
- invite and lobby pipeline is shared
- moves are submitted through `submitTurnMoveV4`
- server adapter validation is authoritative
- results, XP, leaderboards, PBs, achievements, and notifications all come from shared backend code

### 4.3 Hybrid realtime

Used by:

- `sketch_party_game`

Characteristics:

- Firebase still owns invite creation, lobby, session creation, PBs, achievements, XP, level rewards, wallet claim flows, notifications, and final results
- Colyseus owns live state, room presence, timers, scoring, drawing, chat guesses, and reconnect snapshots
- Firestore public state is bootstrap-only once the room is live
- the room hands the match back to Firebase by writing a realtime-resolution request document under the session

### 4.4 Persistent solo framework (present but dormant)

Relevant files:

- `src/gamesV4/constants.ts`
- `src/gamesV4/types/adapter.ts`
- `src/gamesV4/types/session.ts`
- `src/gamesV4/components/GameScreenShell.tsx`
- `firebase-backend/functions/src/gamesV4/solo.ts`

What exists today:

- `soloMode`
- `supportsOfflineProgression`
- `applyOfflineProgression()` adapter hook
- `archiveSoloSessionV4`
- `runStartedAt`, `lastSimulatedAt`, `lastServerSaveAt`

What does not exist today:

- any enabled production game using those hooks
- a persistent-solo reference implementation to copy

Treat this as dormant infrastructure, not a fully exercised production pattern.

---

## 5. Client Layer Map

### 5.1 Catalog and metadata

Primary file:

- `src/gamesV4/constants.ts`

Owns:

- `GAME_METADATA`
- `IMPLEMENTED_GAME_IDS`
- `GAME_DESCRIPTIONS`
- `SCOREBOARD_DESCRIPTORS`
- `LEADERBOARD_DESCRIPTORS`
- collection path helpers
- lifecycle-policy helpers such as `getGameLifecyclePolicy()` and `isPersistentSoloGame()`

Why it matters:

- the hub, picker, detail screen, game-over screen, and leaderboard UI all derive basic behavior from this file
- it is not the only source of metadata in the system; backend `invites.ts` still carries its own `GAME_META` map

### 5.2 Types and contracts

Primary files:

- `src/gamesV4/types/common.ts`
- `src/gamesV4/types/adapter.ts`
- `src/gamesV4/types/session.ts`
- `src/gamesV4/types/result.ts`
- `src/gamesV4/types/invite.ts`
- `src/gamesV4/types/notification.ts`

Important client contracts:

- `GameAdapterV4`
- `GameSessionV4`
- `GameResultV4`
- `MoveValidationResult`
- `SettingsFieldDef`

The docs must follow these types, not older conceptual interfaces.

### 5.3 Adapter registry and runner

Primary files:

- `src/gamesV4/adapters/registry.ts`
- `src/gamesV4/adapters/gameRunner.ts`
- `src/gamesV4/adapters/index.ts`

Responsibilities:

- register adapters by `gameId`
- create initial public and private state on the client side
- run optimistic move validation against public state
- expose adapter-driven summaries and outcomes where used by the shell or screens

Important nuance:

- the client runner is a convenience layer, not authority
- hidden-info games cannot be fully validated locally because the shell passes an empty private-state map

### 5.4 Shared gameplay shell

Primary file:

- `src/gamesV4/components/GameScreenShell.tsx`

This component is one of the most important pieces in the system. It does more than layout.

Responsibilities:

- subscribe to session and public state through `useGameSessionV4()`
- write and clean up `Users/{uid}/GamePresence/{sessionId}`
- provide runtime-specific chrome, exit actions, and destructive confirmations
- maintain optimistic public-state overlays for Firebase-driven games
- suppress known transient permission errors during resolution via the hook
- auto-navigate to `GameOverV4` after terminal state detection
- expose `registerSoloPause()` so solo games with timers or loops can freeze before suspend

Behavior future contributors often miss:

- back behavior is runtime-specific, not uniform
- solo exit suspends, multiplayer does not
- optimistic local move application is only for public state, not private state
- terminal navigation is delayed so the final move can be seen briefly

### 5.5 Service layer

Primary file:

- `src/gamesV4/services/gameServiceV4.ts`

Responsibilities:

- wrap all callable invocations
- subscribe to session, public state, private state, results, invites, PBs, achievements, and level rewards
- implement friends-leaderboard reads through PB docs
- expose active-solo-session discovery for hub resume affordances

Important behavior in the service layer:

- nested array deserialization is client-side because Firestore rejects native nested arrays from the backend
- some solo callables still have fallback behavior if a function is not deployed, so this layer contains compatibility behavior as well as normal runtime code
- `subscribeToActiveSoloSessions()` currently selects the freshest active solo session per game by comparing `soloSuspendedAt`, `lastServerSaveAt`, `lastSimulatedAt`, `runStartedAt`, `startedAt`, and `createdAt`

### 5.6 Hooks that matter most

| Hook                                 | File                                     | What it actually owns                                                                            |
| ------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `useGameSessionV4()`                 | `src/gamesV4/hooks/useGameSessionV4.ts`  | active session, public state, result subscription, move and resign actions                       |
| `useGameLobbyV4()`                   | `src/gamesV4/hooks/useGameLobbyV4.ts`    | invite subscription, auto-subscribe to session once invite becomes active, lobby action wrappers |
| `usePinnedInvites()`                 | `src/gamesV4/hooks/usePinnedInvites.ts`  | conversation pin subscription plus per-invite subscriptions                                      |
| `useLeaderboardV4()`                 | `src/gamesV4/hooks/useLeaderboardV4.ts`  | current week key and live leaderboard subscription                                               |
| `useAchievementsV4()`                | `src/gamesV4/hooks/useAchievementsV4.ts` | live achievements subscription                                                                   |
| `useGamePBV4()` / `useGameStatsV4()` | `src/gamesV4/hooks/useGameStatsV4.ts`    | PB and stats reads for detail and stats screens                                                  |
| `useWallet()`                        | `src/hooks/useWallet.ts`                 | wallet balance and optional transaction feed                                                     |
| `usePendingRewards()`                | `src/hooks/usePendingRewards.ts`         | aggregated count and value of unclaimed achievements and level rewards                           |

### 5.7 Screen stack and primary product surfaces

Primary game-system screens:

- `src/gamesV4/screens/GamesHubScreenV4.tsx`
- `src/gamesV4/screens/GameDetailScreenV4.tsx`
- `src/gamesV4/screens/GameLobbyScreenV4.tsx`
- `src/gamesV4/screens/GamePlayDispatcherV4.tsx`
- `src/gamesV4/screens/GameOverScreenV4.tsx`
- `src/gamesV4/screens/GameLeaderboardScreenV4.tsx`
- `src/gamesV4/screens/GameStatsScreenV4.tsx`
- `src/gamesV4/screens/AchievementsHubScreen.tsx`
- `src/gamesV4/screens/AchievementSectionScreen.tsx`
- `src/gamesV4/screens/LevelRewardsScreen.tsx`

Important entry components outside `src/gamesV4/screens/`:

- `src/gamesV4/components/GamePickerModal.tsx`
- `src/gamesV4/components/PinnedInviteBar.tsx`
- `src/gamesV4/components/ConversationPickerModal.tsx`
- `src/screens/chat/ChatScreen.tsx`
- `src/screens/groups/GroupChatScreen.tsx`
- `src/navigation/RootNavigator.tsx`

---

## 6. Backend Layer Map

### 6.1 Backend adapters and serialization

Primary file:

- `firebase-backend/functions/src/gamesV4/adapters.ts`

Responsibilities:

- register server adapters
- run authoritative move validation and outcome computation
- serialize and deserialize nested arrays for Firestore
- create initial public and private state on session creation

Important nuance:

- server adapters must stay logically aligned with client adapters, but only the server is authoritative
- nested-array serialization is a backend concern because Firestore rejects 2D arrays directly

### 6.2 Invite creation

Primary file:

- `firebase-backend/functions/src/gamesV4/invites.ts`

Responsibilities:

- validate auth and conversation membership
- enforce invite creation cooldowns
- validate the requested game against backend metadata
- create `GameInvitesV4/{inviteId}`
- pin the invite to the DM or group document
- notify conversation members

Important caveat:

- this file still contains a duplicated `GAME_META` map. It is aligned today, but it is still a second metadata registry that can drift.

### 6.3 Lobby management

Primary file:

- `firebase-backend/functions/src/gamesV4/lobby.ts`

Responsibilities:

- `joinInviteLobbyV4`
- `leaveInviteLobbyV4`
- `cancelGameInviteV4`
- `updateLobbySettingsV4`
- `startGameFromInviteV4`

Key behavior worth documenting:

- join verifies conversation membership before the transaction
- host-only start creates the session and initial state atomically
- lobby settings are adapter-validated when `validateSettings()` exists
- host cannot leave the lobby; host must cancel
- spectators are generic at the lobby level, but actual gameplay support still depends on game metadata and adapter design

### 6.4 Session actions

Primary file:

- `firebase-backend/functions/src/gamesV4/sessions.ts`

Responsibilities:

- `submitTurnMoveV4`
- `resignSessionV4`
- `resolveRealtimeSessionV4` bridge entry for Colyseus-triggered resolution

Important details:

- `submitTurnMoveV4` sanitizes large move payloads with higher limits than default because some solo games send replay-like arrays
- the session transaction reads both public state and all player private-state docs before validating a move
- turn advancement can come from adapter-provided `nextTurnPlayerId`, not only round-robin logic
- invite summaries are updated in the same transaction for Firebase games

### 6.5 Solo lifecycle

Primary file:

- `firebase-backend/functions/src/gamesV4/solo.ts`

Responsibilities:

- `createSoloSessionV4`
- `resumeOrCreateSoloSessionV4`
- `restartSoloSessionV4`
- `suspendSoloSessionV4`
- `archiveSoloSessionV4`

Important current reality:

- standard solo is live and exercised
- persistent solo is implemented as dormant infrastructure
- resume logic intentionally scans recent active sessions and filters in memory by `gameId` and `runtimeType` to avoid needing a larger composite index
- persistent offline-progression logic exists, but no enabled game uses it

### 6.6 Resolution pipeline

Primary file:

- `firebase-backend/functions/src/gamesV4/resolve.ts`

This file is the core of the ecosystem.

`resolveSessionV4Internal()` currently performs:

1. atomic session status transition to `resolved`
2. invite transition to `resolved` plus delete timestamps
3. scoreboard and metrics computation
4. result doc write
5. XP application and level reward unlocks
6. leaderboard updates
7. PB updates
8. invite unpin
9. `rewardsProcessed` finalization
10. achievement and resolved notifications

Important design implications:

- if a game ends and does not arrive here, PBs, leaderboards, XP, achievements, and wallet-claim surfaces will diverge
- even realtime games must re-enter here through `resolveRealtimeSessionV4()`

### 6.7 Notifications

Primary file:

- `firebase-backend/functions/src/gamesV4/notifications.ts`

Responsibilities:

- invite-created pushes
- lobby-join pushes to the host
- turn notifications for turn-based games only
- resolved-game pushes
- achievement in-app notifications
- in-app notification document writes to `Users/{uid}/InAppNotificationsV4/{id}`

Important gating behavior:

- mute state is respected for pushes
- self-notifications are filtered
- turn pushes are skipped when `GamePresence` is fresh
- achievement notifications are in-app only, not push

### 6.8 Triggers and watchdog

Primary files:

- `firebase-backend/functions/src/gamesV4/triggers.ts`
- `firebase-backend/functions/src/gamesV4/watchdog.ts`

Trigger responsibilities:

- defensive invite unpin on hard delete
- defensive invite-status sync on session status change
- realtime resolution bridge from Firestore document to shared resolve pipeline

Watchdog responsibilities:

- expire stale lobbies
- delete resolved invites past TTL
- retry reward processing when `rewardsProcessed` is still false
- auto-resolve stale turn-based sessions after inactivity

Important caveat:

- watchdog auto-resolution intentionally skips solo and realtime sessions

---

## 7. Data Model and Storage Contracts

### 7.1 Collections that matter most

| Path                                                    | Primary writer                            | Purpose                                                                |
| ------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `GameInvitesV4/{inviteId}`                              | Cloud Functions                           | chat-facing invite and lobby state                                     |
| `GameSessionsV4/{sessionId}`                            | Cloud Functions                           | canonical lifecycle doc                                                |
| `GameSessionsV4/{sessionId}/PublicState/state`          | Cloud Functions                           | live public state for Firebase games, bootstrap state for Sketch Party |
| `GameSessionsV4/{sessionId}/PrivateState/{uid}`         | Cloud Functions                           | hidden state for Battleship and Crazy Eights                           |
| `GameSessionsV4/{sessionId}/Moves/{moveId}`             | client create + Cloud Functions update    | move ledger                                                            |
| `GameResultsV4/{sessionId}`                             | resolution pipeline                       | terminal payload used by game-over, history, PB, and reward surfaces   |
| `LeaderboardsV4/{gameId}/Weeks/{weekKey}/Entries/{uid}` | resolution pipeline                       | weekly leaderboard entry                                               |
| `Users/{uid}/GamePB/{gameId}`                           | resolution pipeline                       | PB plus `totalPlays` and `totalWins`                                   |
| `Users/{uid}/Achievements/{type}`                       | resolution pipeline + claim callable      | achievement earn and claim state                                       |
| `Users/{uid}/AchievementSections/{sectionId}`           | section-badge claim callable              | section completion badge claim state                                   |
| `Users/{uid}/LevelRewardsV4/{level}`                    | XP pipeline + claim callable              | unlocked and claimed level rewards                                     |
| `Users/{uid}/GamePresence/{sessionId}`                  | client shell                              | in-game foreground presence                                            |
| `Users/{uid}/InAppNotificationsV4/{id}`                 | backend notification writers              | foreground banners and inbox-style notification data                   |
| `Wallets/{uid}`                                         | claim callables and economy backend       | token balance                                                          |
| `Transactions/{txId}`                                   | claim callables and other economy writers | wallet audit ledger                                                    |

### 7.2 Session document fields that drive behavior

Fields that matter most in `GameSessionV4`:

- `runtimeType`
- `status`
- `players`
- `participantUids`
- `spectatorUids`
- `turnOrder`
- `currentTurnIndex`
- `currentTurnPlayerId`
- `scoreboardSummary`
- `settings`
- `rewardsProcessed`
- `resolution`
- `soloSuspendedAt`
- persistent-solo fields such as `soloMode`, `lastSimulatedAt`, `runStartedAt`, and `lastServerSaveAt`

Two common mistakes:

- assuming `players` alone is enough for queries or rules; the backend also maintains `participantUids`
- assuming `currentTurnPlayerId` is meaningful for realtime games; for realtime it is usually `null`

### 7.3 Public versus private state

Firebase-driven public state:

- used for rendering boards or solo state in the shell
- stored under `PublicState/state`
- deserialized on the client because nested arrays are encoded by the backend

Private state:

- only exists when an adapter returns `createInitialPrivateState()` or later updates it
- read by the server transaction in `submitTurnMoveV4`
- not fed into client optimism by the shell

### 7.4 Result document shape and downstream uses

`GameResultsV4/{sessionId}` is the doc that powers:

- `GameOverScreenV4`
- game history in `GameDetailScreenV4`
- recent history in `GameStatsScreenV4`
- some achievement logic via stored metrics
- push and in-app resolved notifications

Fields that most downstream consumers care about:

- `resolutionType`
- `winnerIds`
- `scoreboard`
- `xpAwards`
- `achievementUnlocks`
- `leaderboardUpdates`
- `durationMs`
- `totalMoves`
- `performanceMetrics`

### 7.5 Data that is intentionally denormalized

Examples:

- `participantUids` and `spectatorUids` in the session doc
- `displayName`, `profilePictureUrl`, and `avatarConfig` snapshots inside result scoreboard entries
- invite `participantSummaries` and `spectatorSummaries`

Why it exists:

- Firestore rules cannot iterate lists of maps well
- UI surfaces need stable snapshots even if a profile changes later
- invite bars and lobbies need names without N extra profile reads

### 7.6 Firestore state in realtime games

This is one of the easiest places to make a wrong assumption.

For Sketch Party:

- `GameSessionsV4/{sessionId}` is still authoritative for membership, lifecycle, and final resolution eligibility
- `PublicState/state` is not live-authoritative during the match
- live phase, timer, word-choice, stroke, and chat state lives in Colyseus room memory only

Any future feature that reads only Firestore during a realtime match will see stale state.

---

## 8. Lifecycle Flows

### 8.1 Multiplayer Firebase flow

```text
ChatScreen or GroupChatScreen
  -> GamePickerModal
  -> createGameInviteV4
  -> GameInvitesV4/{inviteId}
  -> pin invite id into Chats/Groups doc
  -> PinnedInviteBar and GamesHub show active invite
  -> GameLobbyV4
  -> joinInviteLobbyV4 / updateLobbySettingsV4 / startGameFromInviteV4
  -> GameSessionsV4/{sessionId} + PublicState/state (+ PrivateState/* if needed)
  -> GamePlayV4 -> game screen inside GameScreenShell
  -> submitTurnMoveV4 / resignSessionV4
  -> resolveSessionV4Internal
  -> GameResultsV4/{sessionId}
  -> GameOverV4
```

Important screen behavior within that flow:

- `PinnedInviteBar` routes by invite status: lobby, gameplay, or game over
- `GameLobbyScreenV4` auto-replaces itself with `GamePlayV4` when the session becomes active
- `GameScreenShell` auto-replaces gameplay with `GameOverV4` after terminal detection

### 8.2 Solo flow

```text
GamesHubScreenV4 or GameDetailScreenV4
  -> resumeOrCreateSoloSessionV4
  -> GameSessionsV4/{sessionId} with no invite
  -> GamePlayV4 inside GameScreenShell
  -> submitTurnMoveV4
  -> suspendSoloSessionV4 on back
  -> restartSoloSessionV4 or resignSessionV4 from menu
  -> resolveSessionV4Internal when terminal
  -> GameResultsV4/{sessionId}
  -> GameOverV4
```

Current entry-point behavior:

- hub launch is resume-aware
- detail launch is now also resume-aware
- solo rematch from game over is intentionally fresh, not resume-aware

### 8.3 Game Detail flow

Current multiplayer detail behavior is more capable than older docs implied.

`GameDetailScreenV4` can:

- show the standard six detail sections
- open `ConversationPickerModal`
- call `createGameInvite()` directly from the detail screen
- route the user back into the selected DM or group after the invite is created

So the current system supports both:

- chat-first invite creation via the gamepad button
- detail-first invite creation via the conversation picker

### 8.4 Lobby flow

```text
Invite doc exists
  -> lobby screen subscribes to invite
  -> join as player or spectator
  -> host may edit validated lobby settings
  -> host starts game
  -> session created and invite marked active
  -> lobby auto-navigates into gameplay
```

Important lobby details:

- host cancel and admin clear are available from the overflow menu
- cancelled or hard-deleted invites force the lobby to navigate back
- read-only settings still render for non-host players and spectators when supported by the panel

### 8.5 Result and reward write flow

```text
Terminal condition detected
  -> resolveSessionV4Internal
     -> mark session resolved
     -> mark invite resolved and set TTL fields
     -> compute scoreboard and metrics
     -> write GameResultsV4
     -> apply XP and unlock level rewards
     -> write achievements earned_unclaimed docs
     -> update weekly leaderboard entry
     -> update PB totals and pbValue if needed
     -> unpin invite
     -> mark rewardsProcessed
     -> write achievement in-app notifications
     -> send resolved notifications
```

This shared flow is why a broken resolve path affects almost every downstream system at once.

### 8.6 Realtime Sketch Party flow

```text
Firebase invite and lobby flow
  -> startGameFromInviteV4 creates realtime session doc
  -> SketchPartyScreenV4 joins Colyseus room using Firebase token
  -> room verifies token and Firebase session membership
  -> room waits for full expected participant roster
  -> choosing -> drawing -> turn_end loop
  -> room computes final scoreboard
  -> room writes GameSessionsV4/{sessionId}/internal/realtimeResolution
  -> onRealtimeResolutionRequest trigger
  -> resolveRealtimeSessionV4
  -> resolveSessionV4Internal
  -> normal GameResultsV4 / XP / PB / achievements / leaderboards
```

### 8.7 Reconnect and resume flows

Solo resume:

- `resumeOrCreateSoloSessionV4` finds an existing active solo session for that `gameId`
- clears `soloSuspendedAt`
- returns `resumed: true`

Firebase multiplayer re-entry:

- user can re-enter from a pinned invite, hub active invite card, or deep link
- live state comes back from Firestore listeners

Sketch Party reconnect:

- user rejoins the room by `sessionId`
- room identifies reconnect by `uid`
- client receives personalized `state_sync`, `settings_applied`, `board_snapshot`, and pending `word_choices` if applicable

---

## 9. Authority and Ownership Rules

### 9.1 Who owns what in Firebase games

Client owns:

- local rendering
- optimistic public-state overlay
- move intent submission
- presence doc lifecycle

Backend owns:

- move legality
- authoritative public and private state updates
- turn advancement
- session resolution
- XP, PB, leaderboard, and achievement writes
- invite summary state

### 9.2 Who owns what in Sketch Party

Client owns:

- local canvas interaction and message sending
- room event handling and UI state rendering

Colyseus room owns:

- live phase state
- timers
- drawing stroke history and replay buffer
- guess validation
- round scoring
- disconnect consequences
- reconnect snapshots
- final realtime scoreboard payload

Firebase backend still owns:

- who is allowed to be in the session at all
- rewards, PBs, achievements, leaderboards, and final result persistence

### 9.3 Hidden-information authority model

Current hidden-info games:

- `battleship`
- `crazy_eights`

Design implication:

- `GameScreenShell` passes `{}` for `privateStateByPlayer` during optimistic validation
- those games cannot rely on client-only validation for correctness
- the server transaction reads real private state and decides legality

This is intentional. It is not a bug in the shell.

### 9.4 Session ownership rules

- session host is captured in `hostId`
- only the host can start a lobby-backed session
- only participants can submit moves or resign
- spectators can watch only when the invite and adapter allow it
- lobby membership comes from invite docs; active gameplay membership comes from session docs
- in Sketch Party, room membership is additionally checked against Firebase `participantUids`

---

## 10. Progression, Rewards, and Stats

### 10.1 Main score semantics

The system does not use one universal meaning for `score`.

| Game type             | What `scoreboard[].score` means                                         |
| --------------------- | ----------------------------------------------------------------------- |
| win/loss board games  | usually `1` for winner and `0` for loser, or adapter-defined equivalent |
| best-score solo games | actual numeric score                                                    |
| Sketch Party          | cumulative realtime points from drawing and guessing                    |
| some solo games       | game-specific encoded or derived numeric values                         |

Implication:

- leaderboard configuration and scoreboard formatting must be treated separately
- PB docs do not always mean high score; for wins-based games they primarily store counters

### 10.2 Leaderboards

Client descriptor source:

- `src/gamesV4/constants.ts`

Backend metric source:

- `firebase-backend/functions/src/gamesV4/types.ts`

Current metrics:

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
- `brick_breaker`
- `minesweeper`
- `solitaire_klondike`
- `sketch_party_game`
- `minigolf_duels`

How writes happen:

- during resolution only
- current week key is computed backend-side with `currentWeekKey()`
- wins-based games increment only winners
- best-score games store running max

Friends leaderboard source:

- not the weekly leaderboard collection
- instead uses PB docs through `fetchFriendsLeaderboard()`
- reads `totalWins` for wins-based games and `pbValue` for best-score games

### 10.3 Personal bests and stats cache

PB docs live at:

- `Users/{uid}/GamePB/{gameId}`

They are used for:

- detail-screen progress cards
- friends leaderboards
- total-play and total-win counters for achievements

Stats cache lives at:

- `Users/{uid}/UserStatsCache/stats`

It is used for:

- cross-game counters such as total games played and total games won
- milestone achievements

Important nuance:

- PB updates and stats increments are done in the backend result pipeline, not at move time
- achievements evaluate against pre-incremented counters so milestone unlocks fire on the correct match

### 10.4 Achievements

Client definition mirror:

- `src/gamesV4/data/achievementDefinitions.ts`

Backend evaluator:

- `firebase-backend/functions/src/gamesV4/achievements.ts`

Current section inventory includes:

- one section per currently supported implemented or implemented-disabled game
- one shared `milestones` section
- one section naming mismatch worth remembering: section ID `sketch_party` maps to game ID `sketch_party_game`

Claim model:

- new achievements are written with `schemaVersion >= 2` and `status: "earned_unclaimed"`
- tokens are not auto-credited
- `claimAchievementV4` credits wallet balance and writes a transaction record
- legacy achievements without schema version are treated as already claimed

### 10.5 XP and level rewards

XP source of truth:

- `resolve.ts` -> `computeXPAwards()` and `applyXPAwards()`

Current behavior:

- multiplayer winners get base XP plus win bonus
- draws get draw bonus
- solo games use a score-derived performance bonus capped by `MAX_PERFORMANCE_BONUS`
- level reward unlocks happen automatically when level thresholds are crossed
- claiming level rewards is manual through `claimLevelRewardV4`

### 10.6 Wallet and pending rewards surfaces

Relevant client hooks:

- `src/hooks/useWallet.ts`
- `src/hooks/usePendingRewards.ts`

Relevant UI surfaces:

- `src/screens/wallet/WalletScreen.tsx`
- `src/gamesV4/screens/AchievementsHubScreen.tsx`
- `src/gamesV4/screens/AchievementSectionScreen.tsx`
- `src/gamesV4/screens/LevelRewardsScreen.tsx`
- `src/gamesV4/screens/GameOverScreenV4.tsx`
- `src/gamesV4/screens/GamesHubScreenV4.tsx`

Why this matters to game-system work:

- a game does not directly write wallet balances
- game integration must produce correct achievements and level-reward unlock docs so the wallet and pending-reward surfaces stay accurate

---

## 11. Navigation, Entry Points, and Post-Game Surfaces

### 11.1 Route registration and deep links

Primary file:

- `src/navigation/RootNavigator.tsx`

Relevant routes:

- `GameLobbyV4`
- `GamePlayV4`
- `GameOverV4`
- `GameDetailV4`
- `GameLeaderboardV4`
- `GameStatsV4`
- `AchievementsHub`
- `AchievementSection`
- `LevelRewards`
- `Wallet`

Deep links currently registered:

- `game/lobby/:inviteId`
- `game/play/:sessionId`
- `game/over/:sessionId`
- `game/detail/:gameId`
- `game/leaderboard/:gameId`
- `game/stats`
- `wallet`

### 11.2 Chat-linked entry points

Multiplayer entry points today:

- chat gamepad button through `GamePickerModal`
- group chat equivalent through the same picker pattern
- detail-screen direct invite via `ConversationPickerModal`
- pinned invite bar in active chats
- hub active-games cards

### 11.3 Games Hub responsibilities

Primary file:

- `src/gamesV4/screens/GamesHubScreenV4.tsx`

It currently:

- shows level and rewards summary
- links to achievements hub and stats
- subscribes to active invites the user participates in
- subscribes to active solo sessions to decide which solo cards should show resume affordances
- launches solo games directly
- routes multiplayer games to detail screens
- exposes long-press actions for solo games, including archive for future persistent-solo usage

### 11.4 Game Detail responsibilities

Primary file:

- `src/gamesV4/screens/GameDetailScreenV4.tsx`

Current six-section layout:

1. overview and how-to-play
2. play actions
3. your progress
4. leaderboards
5. achievements
6. game history

Important reality checks:

- multiplayer detail no longer just tells users to go to chat; it can create invites directly
- history and friends leaderboard are client-side aggregation surfaces, not server-generated composite views

### 11.5 Game Over responsibilities

Primary file:

- `src/gamesV4/screens/GameOverScreenV4.tsx`

It currently:

- subscribes to both result and session docs
- renders formatted scoreboard and per-player stats
- shows XP and level-up actions
- lists newly unlocked achievements and routes to claim surfaces
- returns to chat or hub depending on conversation context
- creates rematches differently for solo versus chat-linked games

Rematch behavior matrix:

| Context                     | Rematch behavior                                                    |
| --------------------------- | ------------------------------------------------------------------- |
| solo                        | create a fresh solo session                                         |
| chat-linked multiplayer     | create a new invite in the same conversation and route back to chat |
| persistent solo future case | button label changes to `Start New Run`                             |

---

## 12. Sketch Party / Colyseus Case Study

Sketch Party is the most important architectural exception in the current repository.

### 12.1 Files that define the realtime path

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

Firebase bridge target:

- `firebase-backend/functions/src/gamesV4/triggers.ts`
- `firebase-backend/functions/src/gamesV4/sessions.ts`

### 12.2 What is shared with normal V4 games

Sketch Party still uses the shared system for:

- catalog metadata and dispatcher registration
- invite creation and chat pinning
- lobby membership and settings edits
- session creation in `GameSessionsV4`
- gameplay route entry through `GamePlayV4`
- presence docs and safe exit shell behavior
- result persistence, XP, PBs, leaderboards, achievements, and notifications

### 12.3 What is custom to Sketch Party

Custom live-runtime ownership sits in the room:

- room join and reconnect handling
- authenticated roster enforcement
- round order and turn progression
- word choice distribution
- hint scheduling
- drawing stroke relay and replay buffer
- guess validation and per-turn scoring
- reaction and chat relay
- disconnect handling
- final scoreboard generation

### 12.4 Room state model

The room uses a plain object state, not Colyseus Schema.

Current state shape includes:

- `phase`
- `currentRound`
- `totalRounds`
- `currentTurnIndex`
- `drawerId`
- `turnOrder`
- `maskedWord`
- `wordLength`
- `scores`
- `correctGuessers`
- `timeRemainingSec`
- `drawTimeSec`
- `hintsUsed`
- `maxHints`
- `wordChoices`
- `players[]`
- `effectiveSettings`

Current phases:

- `waiting`
- `choosing`
- `drawing`
- `turn_end`
- `match_end`

### 12.5 Room message contract

Client-to-room messages:

- `stroke_begin`
- `stroke_points`
- `stroke_end`
- `guess`
- `word_choice`
- `undo`
- `clear`
- `reaction`

Room-to-client messages:

- `state_sync`
- `board_snapshot`
- `settings_applied`
- `turn_start`
- `word_choices`
- `word_reveal`
- `turn_scores`
- `chat`
- `reaction_event`
- `error`

Important contract detail:

- `state_sync` is personalized per recipient, not identical for every client
- only the active drawer receives `secretWord`
- only the active drawer receives `wordChoices` during the choosing phase

### 12.6 Join, auth, and roster gating

Current room join path:

1. client calls `joinSketchPartyRoom(sessionId, uid, displayName, token)`
2. room verifies the Firebase ID token
3. room checks the token UID against the claimed UID
4. room reads `GameSessionsV4/{sessionId}`
5. room confirms `gameId === "sketch_party_game"`
6. room confirms `runtimeType === "realtime"`
7. room confirms `status === "active"`
8. room confirms `participantUids` includes the caller
9. room hydrates authoritative settings from the Firebase session
10. room tracks `expectedParticipantUids` and only starts once the full authenticated roster is present

What this fixed relative to older behavior:

- room joins are no longer trust-based
- a socket cannot join the room simply by guessing a session ID and UID
- matches no longer start from partial socket count alone

### 12.7 Round lifecycle

Per-turn lifecycle:

```text
waiting
  -> startMatch()
  -> startTurn()
  -> choosing
  -> drawer receives word choices
  -> chosen word or choose timeout
  -> drawing
  -> hints reveal over time
  -> guessers submit guesses
  -> all guessers correct or timer ends
  -> turn_end
  -> reveal word and per-turn scores
  -> next drawer or next round
  -> match_end when all turns complete
```

Important timing state:

- `chooseDeadlineAt` tracks the choose window
- drawing timer drives `timeRemainingSec`
- hint schedule comes from `computeHintSchedule()` in `src/gamesV4/data/sketchPartySettings.ts`

### 12.8 Drawing, guessing, and chat synchronization

Drawing:

- room stores stroke history in memory
- reconnecting clients receive `board_snapshot`
- active drawer sends begin/points/end messages
- `undo` and `clear` are drawer-only actions

Guessing:

- guesses are only accepted during `drawing`
- correct guesses are validated in the room
- per-turn scoring updates room scores immediately
- when all non-drawers have guessed correctly, the turn ends early

Chat/social layer:

- chat events and correct guesses are broadcast as `chat`
- reactions are rebroadcast as `reaction_event`

### 12.9 Disconnect and reconnect behavior

Reconnect:

- keyed by `uid`
- room updates the stored Colyseus `sessionId`
- player is marked connected again
- personalized `state_sync` is resent
- `settings_applied` is resent
- `board_snapshot` is resent
- pending `word_choices` are resent to the drawer during the choose phase

Disconnect:

- player connection flag flips false
- presence change is rebroadcast through state
- if the drawer disconnects during `drawing`, the room ends the turn early
- if all players disconnect, the room ends the match with `disconnect`

What still does not exist:

- no spectator support
- no host migration
- no grace timer or override when one expected player never connects

### 12.10 Scoring and final result handoff

Scoring helpers live in:

- `colyseus-server/src/data/scoring.ts`

Word helpers live in:

- `colyseus-server/src/data/wordBank.ts`

Final result handoff path:

- room computes final scoreboard
- bridge writes `GameSessionsV4/{sessionId}/internal/realtimeResolution`
- trigger `onRealtimeResolutionRequest` calls `resolveRealtimeSessionV4()`
- `resolveRealtimeSessionV4()` enriches the scoreboard with profile picture URLs where possible and delegates to `resolveSessionV4Internal()`

This design is the key reason Sketch Party still benefits from the shared PB, XP, leaderboard, and achievement infrastructure.

### 12.11 What future Colyseus games should copy

Copy these patterns:

- keep lifecycle, rewards, PBs, achievements, and leaderboards in Firebase
- verify Firebase tokens at room join
- verify session membership against Firebase data
- define explicit reconnect snapshot behavior
- hand the final match result back into the shared resolve pipeline instead of duplicating rewards logic in the room
- keep room settings authoritative to session state, not only client input

Do not copy these assumptions:

- Firestore mirrors live realtime progress
- room start can be based on socket count alone
- one bespoke room already equals a generalized realtime framework
- host migration can be deferred indefinitely if a new game depends on it

---

## 13. Known Inconsistencies and Sharp Edges

### 13.1 Backend invite metadata is still duplicated

The alignment fixes are in place, but the duplication remains.

Files involved:

- `src/gamesV4/constants.ts`
- `firebase-backend/functions/src/gamesV4/invites.ts`

Impact:

- future additions can still drift if only one side is updated
- invite creation and session start trust backend invite metadata, not client constants

### 13.2 Week-key logic is aligned but duplicated

Files involved:

- `firebase-backend/functions/src/gamesV4/helpers.ts`
- `src/gamesV4/hooks/useLeaderboardV4.ts`

Impact:

- if one changes without the other, client reads and backend writes diverge again

### 13.3 Hidden-info optimism remains intentionally incomplete

File involved:

- `src/gamesV4/components/GameScreenShell.tsx`

Reality:

- hidden-info games do not get full local move validation
- this is a deliberate compromise to preserve secrecy and keep authority on the backend

### 13.4 Realtime live state is still invisible to Firestore-only readers

Files involved:

- `src/gamesV4/screens/SketchPartyScreenV4.tsx`
- `colyseus-server/src/rooms/SketchPartyRoom.ts`

Impact:

- pinned invite summaries are not room-authoritative during live play
- any future realtime feature that expects live Firestore sync will be wrong unless new synchronization is added

### 13.5 Full-roster gating can stall start indefinitely

The room now starts more safely, but it still lacks:

- join grace timeout
- host override
- automatic pruning or migration behavior when one rostered player never joins

This is safer than partial starts but still an operational sharp edge.

### 13.6 `usePinnedInvites()` still tears down all per-invite subscriptions on pin-list changes

File involved:

- `src/gamesV4/hooks/usePinnedInvites.ts`

The hook itself labels this as an accepted cosmetic risk. It can cause brief flicker when pins change.

### 13.7 The codebase no longer supports a blanket animation rule

Reality today:

- some game screens use core `Animated`
- `SketchPartyScreenV4` uses `react-native-reanimated` for parts of its UI

Future docs should not claim a universal prohibition unless the code is changed to enforce one.

---

## 14. Testing and Operations Surface

### 14.1 Current test inventory to care about first

Adapters and game logic:

- `__tests__/gamesV4/adapters/*.test.ts`
- includes `brickBreaker`, `chess`, `connectFour`, `crazyEights`, `dotsAndBoxes`, `minesweeper`, `miniGolf`, `play2048`, `sketchParty`, `sketchPartySettings`, `solitaireKlondike`, `ticTacToe`

Shell, navigation, and flows:

- `__tests__/gamesV4/gameScreenShellExit.test.ts`
- `__tests__/gamesV4/lobbyBugRegression.test.ts`
- `__tests__/gamesV4/lobbySettings.test.ts`
- `__tests__/gamesV4/presenceNavigation.test.ts`
- `__tests__/gamesV4/soloSuspendResume.test.ts`

Resolution and backend logic:

- `__tests__/gamesV4/resolve/achievementEvaluator.test.ts`
- `__tests__/gamesV4/resolve/resolvePipeline.test.ts`
- `__tests__/gamesV4/resolve/walletRewardSync.test.ts`
- `__tests__/gamesV4/validation/validation.test.ts`

### 14.2 Gaps in current automated coverage

Most important current test gap:

- there is no socket-level Colyseus integration test suite for Sketch Party room behavior

That means realtime confidence still depends on:

- room reasoning
- adapter/settings tests
- manual runtime validation

### 14.3 Operational surfaces worth knowing

Primary operations files:

- `firebase-backend/functions/src/gamesV4/watchdog.ts`
- `firebase-backend/functions/src/gamesV4/triggers.ts`
- `docs/GAMES_V4_RUNBOOK.md`

When something looks wrong in production, the first checks are usually:

- invite status and pin state
- session status and `rewardsProcessed`
- result existence
- PB and leaderboard writes
- fresh `GamePresence` docs suppressing a turn notification
- realtime-resolution bridge doc for Sketch Party

### 14.4 Useful commands

```powershell
npx jest --testPathPattern=gamesV4
npx jest --testPathPattern=gamesV4/adapters
npx jest --testPathPattern=gamesV4/resolve
npx tsc --noEmit
cd firebase-backend/functions
npm run build
cd ..\..
cd colyseus-server
npm run build
```

---

## 15. Preservation Rules for Future Contributors

1. Code beats docs, but duplicated metadata means you must update more than one file when adding a game.
2. Do not bypass `resolveSessionV4Internal()` for terminal flows.
3. Do not assume Firestore is live-authoritative for realtime gameplay.
4. Do not design hidden-info games around full client optimism.
5. Do not add lobby settings unless the actual runtime consumes them.
6. If you add another Colyseus game, treat auth, membership checks, reconnect snapshots, and result handoff as required architecture, not optional polish.
7. If you touch week keys, change both the backend helper and the client hook together or extract them to one shared implementation.
8. If you change result score semantics for a game, also re-check its scoreboard descriptor, leaderboard descriptor, PB interpretation, and achievement evaluators.
9. If you make docs cleaner than the code, call out the inconsistency explicitly instead of papering over it.
