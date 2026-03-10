# Game Integration Guide V4 - Implementation-Faithful Reference

> Purpose: how to add or audit a game against the V4 system that actually exists in the current workspace.
> Source of truth: code checked out on 2026-03-09.
> Companion: [GAMES_V4_SYSTEM.md](GAMES_V4_SYSTEM.md).

---

## Table of Contents

1. [What Exists Today](#1-what-exists-today)
2. [Choose the Right Architecture First](#2-choose-the-right-architecture-first)
3. [Current Game Inventory Reference](#3-current-game-inventory-reference)
4. [Common Integration Surface for Every Game](#4-common-integration-surface-for-every-game)
5. [Firebase Solo and Turn-Based Integration](#5-firebase-solo-and-turn-based-integration)
6. [Realtime / Colyseus Integration](#6-realtime--colyseus-integration)
7. [Adapter and Shell Contracts](#7-adapter-and-shell-contracts)
8. [Metadata, Leaderboards, Achievements, and Rewards](#8-metadata-leaderboards-achievements-and-rewards)
9. [Actual Runtime Flows](#9-actual-runtime-flows)
10. [Sketch Party Case Study](#10-sketch-party-case-study)
11. [QA Checklist](#11-qa-checklist)
12. [Common Mistakes and Current System Gaps](#12-common-mistakes-and-current-system-gaps)
13. [File Checklist for Future Audits](#13-file-checklist-for-future-audits)

---

## 1. What Exists Today

Before adding a new game, anchor on the real state of the system.

- 22 `GameId` values exist.
- 12 games are currently enabled in `IMPLEMENTED_GAME_IDS`.
- 13 client adapters and 13 backend adapters exist in the workspace.
- 1 realtime room exists today: `sketch_party` in `colyseus-server/`.
- Persistent solo infrastructure exists in shared types and backends, but no current adapter uses it.

The system is currently three patterns, not one:

1. Firebase-driven solo games
2. Firebase turn-based games
3. Hybrid Firebase + Colyseus realtime games

If you treat those as interchangeable, you will produce inaccurate docs and unstable implementations.

---

## 2. Choose the Right Architecture First

### 2.1 Decision matrix

| If your game is... | Use this pattern | Current references |
| --- | --- | --- |
| Single-player, deterministic, resumable through Firestore | Firebase solo | `play_2048`, `minesweeper`, `solitaire_klondike`, `brick_breaker` |
| Multiplayer, discrete turns, Firestore-friendly state | Firebase turn-based | `tic_tac_toe`, `connect_four`, `chess`, `reversi`, `dots_and_boxes` |
| Turn-based but hidden information per player | Firebase turn-based + `PrivateState/{uid}` | `crazy_eights`, `battleship` |
| Simultaneous input, timers, or high-frequency realtime state | Hybrid Firebase + Colyseus | `sketch_party_game` |

### 2.2 Anti-patterns to avoid

- Do not choose Colyseus just because a game is animated. `brick_breaker` is still a Firebase solo game.
- Do not assume all multiplayer games need private state. Most current board games do not.
- Do not assume persistent solo is production-ready just because hooks exist. No current game uses it.
- Do not assume a realtime game can skip Firebase integration. Even Sketch Party still uses Firebase for invites, lobby, session creation, achievements, PBs, XP, wallet, and final results.

---

## 3. Current Game Inventory Reference

### 3.1 Enabled games

| GameId | Runtime | Integration type | Notes |
| --- | --- | --- | --- |
| `play_2048` | `solo` | Firebase solo | Canonical score-based solo reference |
| `brick_breaker` | `solo` | Firebase solo | Physics-style solo with pause hook |
| `minesweeper` | `solo` | Firebase solo | Encoded best-score format for time plus tier |
| `solitaire_klondike` | `solo` | Firebase solo | Standard solo run model |
| `tic_tac_toe` | `turnBased` | Firebase turn-based | Smallest reference adapter |
| `connect_four` | `turnBased` | Firebase turn-based | Standard turn-based reference |
| `chess` | `turnBased` | Firebase turn-based | Most involved deterministic turn-based implementation |
| `reversi` | `turnBased` | Firebase turn-based | Enabled in current workspace |
| `dots_and_boxes` | `turnBased` | Firebase turn-based | Enabled in current workspace |
| `crazy_eights` | `turnBased` | Firebase turn-based + private state | Hidden-info card game |
| `battleship` | `turnBased` | Firebase turn-based + private state | Metadata mismatch exists in backend invite layer |
| `sketch_party_game` | `realtime` | Hybrid Firebase + Colyseus | Only current Colyseus-backed game |

### 3.2 Implemented but disabled

| GameId | Runtime | Status |
| --- | --- | --- |
| `minigolf_duels` | `turnBased` | Adapter, backend, screen, achievements, and leaderboard support exist, but it is commented out of `IMPLEMENTED_GAME_IDS` as disabled |

### 3.3 Placeholder catalog entries only

`bounce_blitz`, `word_master`, `lights_out`, `checkers`, `gomoku`, `pong_game`, `starforge_game`, `crossword_puzzle`, and `dot_match` currently have metadata only.

---
## 4. Common Integration Surface for Every Game

Every real game, regardless of runtime type, has to touch the catalog, routing, result, and progression surfaces.

### 4.1 Files you almost always need to update

| Layer | File(s) | Why it matters |
| --- | --- | --- |
| Game id and metadata | `src/gamesV4/types/common.ts`, `src/gamesV4/constants.ts` | Catalog placement, runtime classification, icons, player counts, gating |
| Client adapter registration | `src/gamesV4/adapters/`, `src/gamesV4/adapters/index.ts` | Lets the shell and runner resolve the game |
| Screen routing | `src/gamesV4/screens/GamePlayDispatcherV4.tsx` | Routes `gameId` to the actual gameplay screen |
| Gameplay UI | `src/gamesV4/screens/*ScreenV4.tsx` | Actual game surface |
| Backend adapter registration | `firebase-backend/functions/src/gamesV4/adapters.ts` | Required for server-side validation, initial state, and resolution helpers |
| Backend invite metadata | `firebase-backend/functions/src/gamesV4/invites.ts` | Current invite creation path does not read client metadata |
| Leaderboard metric mapping | `firebase-backend/functions/src/gamesV4/types.ts` | Backend score aggregation policy |
| Achievements | `firebase-backend/functions/src/gamesV4/achievements.ts`, `src/gamesV4/data/achievementDefinitions.ts` | Unlock evaluation and client mirror |
| Tests | `__tests__/gamesV4/` | Prevent regressions in adapters, lobby, resolve, and shell behavior |

### 4.2 The minimum "real integration" bar

A game is not meaningfully integrated until all of these are true:

- client metadata exists in `GAME_METADATA`
- client descriptions exist in `GAME_DESCRIPTIONS`
- scoreboard formatting exists in `SCOREBOARD_DESCRIPTORS`
- leaderboard formatting exists in `LEADERBOARD_DESCRIPTORS`
- screen is mapped in `GAME_SCREEN_MAP`
- client adapter is registered
- backend adapter is registered
- achievements exist in backend and client mirror
- backend leaderboard metric is configured if the default `bestScore` is wrong
- `IMPLEMENTED_GAME_IDS` includes the game if it should be user-visible and launchable
- backend invite metadata is aligned for multiplayer games

### 4.3 One current trap: the backend has its own metadata map

`createGameInviteV4` does not consult `GAME_METADATA`. It uses a hardcoded `GAME_META` table in `firebase-backend/functions/src/gamesV4/invites.ts`.

For multiplayer games, you must keep both sides aligned or invites and started sessions will use the wrong runtime or spectator policy.

---

## 5. Firebase Solo and Turn-Based Integration

This is the path to follow for every non-Colyseus game.

### 5.1 Client-side checklist

1. Add or confirm the `GameId` entry in `src/gamesV4/types/common.ts`.
2. Add catalog metadata in `GAME_METADATA`.
3. Add the game to `IMPLEMENTED_GAME_IDS` only after the full stack is ready.
4. Add `GAME_DESCRIPTIONS`, `SCOREBOARD_DESCRIPTORS`, and `LEADERBOARD_DESCRIPTORS`.
5. Create the client adapter in `src/gamesV4/adapters/`.
6. Register it in `src/gamesV4/adapters/index.ts`.
7. Create the screen and wrap it with `withGameV4Shell(...)`.
8. Add the screen to `GAME_SCREEN_MAP`.
9. Add achievements to the client mirror.
10. Add or extend tests.

### 5.2 Backend checklist

1. Register the backend adapter in `firebase-backend/functions/src/gamesV4/adapters.ts`.
2. Keep backend invite metadata aligned in `firebase-backend/functions/src/gamesV4/invites.ts`.
3. Add leaderboard metric config in `firebase-backend/functions/src/gamesV4/types.ts` when needed.
4. Add achievement definitions and evaluators in `firebase-backend/functions/src/gamesV4/achievements.ts`.
5. Build and deploy the Firebase functions package.

### 5.3 When to use `PrivateState/{uid}`

Use private state only if the game truly has hidden information that must not be readable by opponents.

Current examples:

- `battleship` uses private ship layouts and per-player firing state.
- `crazy_eights` uses private hands.

Important caveat:

- `GameScreenShell` does not have live private state during local optimistic validation.
- Hidden-info games should expect local validation to be partial and server validation to be authoritative.

### 5.4 Solo-specific lifecycle reality

The shared shell already implements these behaviors:

| Behavior | Current implementation |
| --- | --- |
| Back button | Calls `suspendSoloSessionV4` and leaves without resolving |
| Restart | Calls `restartSoloSessionV4` |
| Resign | Calls `resignSessionV4` |
| Pause hooks | Solo screens can register `registerSoloPause(...)` for animation loops |
| Resume hooks | Solo screens can register `registerSoloResume(...)` |

Actual launch behavior is still inconsistent:

- the hub resumes or creates
- the detail page always creates new
- solo rematch from game over always creates new

If you want a solo game to behave consistently everywhere, you must update more than the adapter.

### 5.5 Turn-based spectator support

The generic lobby and session model support spectators, but you still need to decide whether your adapter leaks sensitive information through public state.

Rules:

- set `supportsSpectate` and `spectateMode` correctly in both client and backend metadata
- implement `getSpectatorView()` if public state contains information spectators should not see
- remember that the backend invite metadata currently controls `allowSpectators` at invite creation time

---
## 6. Realtime / Colyseus Integration

A realtime V4 game still needs Firebase integration. Colyseus replaces live gameplay authority, not the surrounding product surfaces.

### 6.1 Required pieces for a new Colyseus-backed game

Client side:

- adapter for metadata, summary, settings, and outcome helpers
- shell-wrapped game screen
- dedicated realtime client service for join, leave, and message senders
- route entry in `GamePlayDispatcherV4`

Server side:

- backend adapter entry in `firebase-backend/functions/src/gamesV4/adapters.ts`
- realtime room implementation in `colyseus-server/src/rooms/`
- room registration in `colyseus-server/src/index.ts`
- bridge from room end-state back into the V4 resolution pipeline
- Firebase-side trigger or callable endpoint that resolves the session through `resolveSessionV4Internal`

Shared product surfaces:

- metadata, descriptions, descriptors, achievements, leaderboard metric config, tests

### 6.2 Realtime design rules that the current codebase implies

1. Keep invite and lobby generic.
2. Let Firebase create the canonical session record before the room starts.
3. Treat the room as the live authority during play.
4. Re-enter the shared resolution pipeline at match end instead of duplicating PB / XP / wallet logic.
5. Decide deliberately whether Firestore should mirror live room state. Sketch Party does not.

### 6.3 Realtime-specific checklist

- create a room service similar to `src/gamesV4/services/sketchPartyClient.ts`
- make the room name explicit and register it in `colyseus-server/src/index.ts`
- define the room state and message protocol up front
- verify Firebase auth and session membership on room join
- lock join rules after the roster is established
- if lobby settings exist, consume them in the room, not just in the UI
- write resolution requests under the exact Firestore path the Firebase trigger listens to
- decide whether spectators are supported before wiring the UI

---

## 7. Adapter and Shell Contracts

### 7.1 `GameAdapterV4` reality check

The current adapter surface lives in `src/gamesV4/types/adapter.ts` and includes more than the older docs described.

Current notable fields and hooks:

- identity: `gameId`, `runtimeType`, `minPlayers`, `maxPlayers`, `supportsSpectate`, `spectateMode`
- formatting helper: `scoreboardDescriptor?`
- state creation: `createInitialPublicState(...)`, optional `createInitialPrivateState(...)`
- gameplay: optional `validateMove(...)`, `computeSummary(...)`, `computeOutcome(...)`
- spectators: optional `getSpectatorView(...)`
- metrics: optional `extractPerformanceMetrics(...)`
- lobby settings: optional `validateSettings(...)`
- dormant persistent-solo hooks: `supportsOfflineProgression`, `applyOfflineProgression`, `getPersistentSoloSummary`, `canArchive`, `canRestart`, `archiveRun`

### 7.2 `GameScreenShell` behavior you must design around

`withGameV4Shell(...)` is not just a wrapper. It imposes runtime behavior.

What it does:

- subscribes to session, public state, and result docs through `useGameSessionV4`
- writes `Users/{uid}/GamePresence/{sessionId}` while mounted
- applies optimistic local validation for Firebase-driven games
- auto-navigates to `GameOverV4` when a non-persistent session becomes terminal
- handles runtime-specific exit UI and back behavior

### 7.3 Hidden-info caveat

The shell does local optimistic validation against public state and passes `{}` as `privateStateByPlayer`.

Implication:

- public-state games can feel immediate locally
- hidden-info games must assume server authority is the real validator
- do not build hidden-info games that require complete local certainty before sending a move

### 7.4 Runtime-specific shell behavior

| Runtime | Shell behavior |
| --- | --- |
| `solo` | Overlay back button, overlay menu, suspend on back, restart/resign in menu |
| `turnBased` | Back leaves non-destructively, resign is explicit, optimistic validation applies |
| `realtime` | Destructive leave confirmation, presence still tracked, screen usually ignores `submitMove()` |

### 7.5 Solo game-loop hooks

If a solo game has an internal loop, timer, or physics simulation, use the hooks already exposed by the shell:

- `registerSoloPause(...)`
- `registerSoloResume(...)`

Current reference:

- `brick_breaker` is the clearest example of why this exists.

---
## 8. Metadata, Leaderboards, Achievements, and Rewards

### 8.1 Metadata you must keep aligned

At minimum, a real game needs aligned entries in:

- `GAME_METADATA`
- `GAME_DESCRIPTIONS`
- `SCOREBOARD_DESCRIPTORS`
- `LEADERBOARD_DESCRIPTORS`
- backend invite `GAME_META` for multiplayer games
- backend `LEADERBOARD_METRICS` if the game is not the default `bestScore`

### 8.2 Achievement support is broad now

The achievement system is no longer limited to the original pilot games.

Current game sections exist for:

- `tic_tac_toe`
- `connect_four`
- `play_2048`
- `chess`
- `sketch_party`
- `battleship`
- `brick_breaker`
- `crazy_eights`
- `minigolf_duels`
- `minesweeper`
- `solitaire_klondike`
- `reversi`
- `dots_and_boxes`
- `milestones`

Important naming caveat:

- the Sketch Party achievement section id is `sketch_party`
- the game id is `sketch_party_game`

### 8.3 Reward model

The current system uses manual-claim tokens.

- achievements unlock into `earned_unclaimed` docs and require `claimAchievementV4`
- level rewards unlock into docs with `claimedAt: null` and require `claimLevelRewardV4`
- both credit `Wallets/{uid}` and append `Transactions/{txId}`

### 8.4 Leaderboard model

Two surfaces exist:

- weekly global leaderboard from `LeaderboardsV4/{gameId}/Weeks/{weekKey}/Entries/{uid}`
- friends leaderboard assembled client-side from friends' `Users/{uid}/GamePB/{gameId}` docs

Important caveat:

- client and backend week-key logic currently differ, so do not add more leaderboard code without checking both implementations.

---

## 9. Actual Runtime Flows

### 9.1 Chat invite to active game

1. `GamePickerModal` exposes launchable multiplayer games from `GAME_METADATA`.
2. `createGameInviteV4` writes the invite and pins it to the chat or group document.
3. `PinnedInviteBar` renders invite chips and routes taps by invite status.
4. `GameLobbyV4` handles join, leave, settings, and start.
5. `startGameFromInviteV4` creates the session and public/private state docs.
6. `GamePlayDispatcherV4` routes to the shell-wrapped screen.

### 9.2 Solo launch and return

Current entry points are inconsistent and you need to know that when integrating a solo game.

- Hub launch: resume or create
- Detail launch: always create new
- Game-over rematch: always create new
- Back inside gameplay: suspend and return without resolving

### 9.3 Result and rematch behavior

`GameOverScreenV4` currently behaves like this:

- multiplayer rematch creates a new chat invite if conversation context exists
- solo rematch creates a new solo session
- level reward CTA navigates to `LevelRewards`
- achievement CTA navigates to `AchievementsHub`

---

## 10. Sketch Party Case Study

If you need a model for a future realtime game, Sketch Party is the only real reference. It is useful, but it is not a clean template.

### 10.1 Shared vs custom split

Shared V4 responsibilities:

- invite creation
- lobby settings and membership
- session creation
- result persistence
- XP, PBs, achievements, leaderboard, wallet, notifications

Custom Sketch Party responsibilities:

- drawing sync
- chat / guess sync
- scoring
- timers and hint schedule
- reconnect logic
- disconnect logic
- turn and round lifecycle

### 10.2 What future Colyseus games should copy

- separate client room service module
- separate server package and room registration
- end-of-match handoff into `resolveSessionV4Internal`
- explicit room snapshot support for reconnects

### 10.3 What future Colyseus games should not copy

- unverified Firebase token on join
- no session-membership check in the room
- match start based only on connected socket count
- bridge path mismatch between Colyseus and Firebase trigger
- settings fields that the room never uses
- message senders that the room never handles
- assuming Firestore public state is live during realtime play when it is not

### 10.4 Sketch Party-specific gotchas worth documenting

- `customWordsEnabled` and `customWordsList` are present in settings but unused by the room.
- `sendToolSet(...)` exists client-side but the room does not handle `tool_set`.
- `roomState.secretWord` is typed on the client, but `state_sync` does not actually include it.
- the room has no host migration logic and no spectator mode.
- the room can currently start before the full Firebase session roster is connected.

---
## 11. QA Checklist

Use this list after any game addition or significant game refactor. The goal is not only "does the screen render" but "does the game participate correctly in the surrounding ecosystem."

### Inventory and Wiring

- [ ] `GAME_METADATA` entry matches the adapter and the backend invite metadata.
- [ ] `IMPLEMENTED_GAME_IDS` contains the game only if the game is actually safe to launch.
- [ ] Client adapter is imported in `src/gamesV4/adapters/index.ts`.
- [ ] Screen is registered in `src/gamesV4/screens/GamePlayDispatcherV4.tsx`.
- [ ] Backend adapter is registered in `firebase-backend/functions/src/gamesV4/adapters.ts`.
- [ ] `LEADERBOARD_METRICS` in `firebase-backend/functions/src/gamesV4/types.ts` matches the intended leaderboard behavior.
- [ ] Achievement section and achievement definitions exist in both backend and client mirrors.

### Solo Games

- [ ] Games Hub resumes an existing active session if the product intends resumable solo play.
- [ ] Game Detail launch behavior is intentionally chosen and documented if it differs from Hub behavior.
- [ ] Back navigation suspends or archives exactly as intended.
- [ ] Restart creates the correct result and does not leave orphaned active sessions.
- [ ] The game remains stable after app background / foreground.
- [ ] If the game uses timers or animation loops, it registers a pause callback with the shell.

### Turn-Based Games

- [ ] Invite can be created from chat and appears pinned in the conversation.
- [ ] Lobby join / leave / cancel / start all work and enforce membership rules.
- [ ] Turn order, current turn, and optimistic validation behave consistently.
- [ ] Invalid moves fail cleanly on both client and server.
- [ ] Resign resolves the game and produces a valid `GameResultV4`.
- [ ] Spectator behavior is verified if metadata says spectators are supported.
- [ ] History, PB, leaderboard, XP, achievement, and notification updates all appear after resolution.

### Realtime / Colyseus Games

- [ ] Firebase session creation and Colyseus room join use the same `sessionId` as the authoritative key.
- [ ] The room verifies player identity and membership before allowing participation.
- [ ] The room start condition is tied to the session roster, not only currently connected sockets.
- [ ] Reconnect restores the player to the correct role and does not duplicate them.
- [ ] Disconnect rules are explicit for drawer/actor disconnect, all-player disconnect, and mid-round exit.
- [ ] End-of-match writes reach the exact Firestore trigger path consumed by Cloud Functions.
- [ ] Client UI only depends on fields that the room actually emits.
- [ ] Any settings exposed in lobby or metadata are actually used by the realtime room.
- [ ] Result payloads generated by the realtime server are compatible with `resolveRealtimeSessionV4()`.

### Ecosystem Integration

- [ ] Game Detail page shows accurate description, rules, tips, achievements, leaderboard label, and history formatting.
- [ ] Game Over screen shows the correct scoreboard formatting and action routing.
- [ ] Wallet pending rewards reflect newly earned achievement and level reward docs.
- [ ] Achievement claims and level reward claims create wallet transactions.
- [ ] In-app notifications route to the correct screen.
- [ ] Deep links or push taps restore the correct lobby or gameplay destination.

### Regression Areas Worth Rechecking

- [ ] Invite metadata still matches client constants after any game metadata edit.
- [ ] Leaderboard week keys still match between client and backend if any leaderboard logic changes.
- [ ] Hidden-information games still work despite the shell's optimistic validation limitations.
- [ ] Disabled games are not accidentally re-enabled through config drift.

## 12. Common Mistakes and Current System Gaps

### Mistakes to Avoid When Adding a Game

1. Adding the adapter but forgetting the backend invite metadata. The game may appear correct in the client while invites or sessions are created with the wrong runtime or player limits.
2. Enabling a game in `IMPLEMENTED_GAME_IDS` before its backend adapter, achievements, or descriptors are ready.
3. Assuming solo launch behavior is globally consistent. It is currently entry-point dependent.
4. Treating the shell as a complete hidden-information framework. It is not; authoritative validation remains server-side.
5. Copying Sketch Party without also copying its backend room and resolution bridge.
6. Exposing settings in metadata or lobby UI that the underlying game logic never reads.
7. Assuming weekly leaderboard keys are a solved shared primitive. They are currently duplicated with different implementations.
8. Assuming the docs imply a cleaner architecture than the code actually enforces. Several integrations are conventions rather than hard guarantees.

### Current Gaps the Docs Should Not Hide

- Backend invite metadata is a second source of truth. It is not derived automatically from the adapters or client constants.
- Realtime support is not a generic framework yet. Sketch Party is a custom hybrid pipeline with reusable ideas, not a full platform abstraction.
- Some implemented games are only partially integrated from a product perspective even when technical wiring exists, as shown by `minigolf_duels` being present but disabled.
- Animation strategy is inconsistent across games. Core `Animated` is used in some screens, while Sketch Party uses `react-native-reanimated`.
- Week-key generation is inconsistent between client and backend and should be unified before leaderboard behavior is considered fully stable.
- `subscribeToActiveSoloSessions()` still queries a `"suspended"` status that does not exist in the documented session-status union.

### Recommended Future Cleanup

1. Collapse runtime metadata into a single shared source consumed by client and backend.
2. Move week-key computation to one shared implementation used everywhere.
3. Formalize a realtime session contract for Colyseus-backed games: auth, membership, reconnect, roster lock, resolution bridge, and result schema.
4. Decide whether resumable solo play should always resume or whether some entry points should intentionally create a fresh run.
5. Fix the Sketch Party resolution trigger path and room auth before using it as the template for more realtime games.
6. Either remove dead settings and unsupported message types or implement them end to end.

## 13. File Checklist for Future Audits

When auditing or integrating another game, start with these files before trusting any doc:

- `src/gamesV4/constants.ts`
- `src/gamesV4/types/common.ts`
- `src/gamesV4/adapters/index.ts`
- `src/gamesV4/screens/GamePlayDispatcherV4.tsx`
- `src/gamesV4/components/GameScreenShell.tsx`
- `src/gamesV4/services/gameServiceV4.ts`
- `firebase-backend/functions/src/gamesV4/adapters.ts`
- `firebase-backend/functions/src/gamesV4/invites.ts`
- `firebase-backend/functions/src/gamesV4/sessions.ts`
- `firebase-backend/functions/src/gamesV4/solo.ts`
- `firebase-backend/functions/src/gamesV4/resolve.ts`
- `firebase-backend/functions/src/gamesV4/achievements.ts`
- `firebase-backend/functions/src/gamesV4/types.ts`
- `firebase-backend/functions/src/gamesV4/triggers.ts`
- `colyseus-server/src/rooms/SketchPartyRoom.ts`
- `colyseus-server/src/bridge/firebaseBridge.ts`
