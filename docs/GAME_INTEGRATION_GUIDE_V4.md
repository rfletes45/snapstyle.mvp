# Game Integration Guide V4 - Implementation Manual for New Games

> Source of truth: the checked-out workspace on 2026-03-18.
> This guide is for adding or auditing a game against the current V4 implementation, not an idealized design.
> Companion: [GAMES_V4_SYSTEM.md](GAMES_V4_SYSTEM.md).

---

## Table of Contents

1. [Purpose, Audience, and Philosophy](#1-purpose-audience-and-philosophy)
2. [Choose the Right Architecture First](#2-choose-the-right-architecture-first)
3. [Current Reference Inventory](#3-current-reference-inventory)
4. [Shared Integration Surface by Layer](#4-shared-integration-surface-by-layer)
5. [Adding a Firebase Solo or Turn-Based Game](#5-adding-a-firebase-solo-or-turn-based-game)
6. [Adding a Realtime / Colyseus Game](#6-adding-a-realtime--colyseus-game)
7. [Shared Contracts You Must Design Around](#7-shared-contracts-you-must-design-around)
8. [Metadata, Leaderboards, PBs, Achievements, XP, and Wallet Links](#8-metadata-leaderboards-pbs-achievements-xp-and-wallet-links)
9. [Runtime Flows You Must Fit Into](#9-runtime-flows-you-must-fit-into)
10. [UI and UX Expectations](#10-ui-and-ux-expectations)
11. [Debugging, Common Mistakes, and Failure Modes](#11-debugging-common-mistakes-and-failure-modes)
12. [QA and Release Readiness Checklists](#12-qa-and-release-readiness-checklists)
13. [File Checklist by Runtime](#13-file-checklist-by-runtime)

---

## 1. Purpose, Audience, and Philosophy

This guide is written for:

- developers adding a new game to the current V4 system
- developers auditing an existing game for drift or incomplete integration
- future AI agents making code changes inside this repository

What this guide assumes:

- the codebase is the source of truth
- the current architecture is partly standardized and partly bespoke
- a game is not integrated just because it has an adapter or screen
- new work must fit the real lifecycle, reward, and navigation surfaces that already exist

### 1.1 Integration philosophy

Treat integration as a cross-layer contract, not a single feature file.

A game is only truly integrated when all of these line up:

- catalog metadata
- enabled/disabled gating
- client adapter registration
- backend adapter registration when applicable
- gameplay screen and dispatcher mapping
- lobby/session/runtime behavior
- result semantics
- leaderboard and PB interpretation
- achievement definitions and section wiring
- game-over formatting and post-game actions
- history, stats, and wallet-adjacent claim surfaces

### 1.2 What "done" means in this repository

A game is fully integrated only when it:

- appears correctly in the Games Hub and Game Detail screen
- launches through the correct entry path for its runtime family
- resolves through the shared result pipeline or a proper realtime bridge into it
- writes PB, leaderboard, and achievement data correctly for its score model
- renders correctly on Game Over and in history surfaces
- has descriptors, achievements, and tests that match its runtime semantics

### 1.3 What this guide is intentionally skeptical about

This codebase already contains examples of drift and partial standardization. Do not assume these are impossible:

- client and backend metadata disagreeing
- lobby settings existing in UI but not being consumed at runtime
- a game being implemented but intentionally disabled
- a realtime screen looking integrated while bypassing most Firebase gameplay paths
- hidden-information games being impossible to validate locally with the same confidence as public-state games

---

## 2. Choose the Right Architecture First

Do not start by writing a screen. Start by deciding which runtime family the game actually belongs to.

### 2.1 Decision matrix

| Question                                                                     | If yes                                            | If no                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------- |
| Is the game single-player only?                                              | Start with Firebase solo                          | Continue                                |
| Is live simultaneous input required?                                         | Consider realtime / Colyseus                      | Continue                                |
| Can turns be serialized through Firestore state updates?                     | Use Firebase turn-based                           | Re-evaluate requirements                |
| Does the game contain hidden information per player?                         | Use Firebase turn-based plus `PrivateState/{uid}` | Public-state Firebase pattern is enough |
| Does the game require room timers, socket presence, or stroke/guess streams? | Use realtime / Colyseus                           | Firebase path is probably enough        |

### 2.2 Runtime-family responsibilities

Firebase solo:

- no invite
- no lobby
- direct session creation or resume
- suspend on back
- result pipeline is shared with all other games

Firebase turn-based:

- invite and lobby are generic
- session doc is live authority
- move submission uses `submitTurnMoveV4`
- spectators are supported generically if metadata and adapter allow it

Realtime / Colyseus:

- invite and lobby are still generic Firebase surfaces
- active gameplay authority moves into a room server
- you must authenticate room joins against Firebase session membership
- you must hand the final result back into the shared resolve pipeline

### 2.3 Anti-patterns to avoid

Do not do these:

- build a realtime game on top of `submitTurnMoveV4` if the gameplay is actually simultaneous
- build a hidden-information game assuming the client shell will have full private state
- create a new reward or result write path that bypasses `resolveSessionV4Internal()`
- add lobby settings without runtime code that consumes them
- mark a game enabled in `IMPLEMENTED_GAME_IDS` before the screen, adapters, descriptors, and backend support actually exist

### 2.4 Which current games are the best reference points

Use these as reference anchors:

- simplest Firebase turn-based: `tic_tac_toe`
- bigger public-state turn-based: `connect_four`
- hidden-info turn-based: `battleship`, `crazy_eights`, `dead_drop`
- score-based solo: `play_2048`
- loop/timer solo using pause integration: `brick_breaker`
- hybrid realtime (drawing/guessing): `sketch_party_game`
- hybrid realtime (physics): `pong_game`, `knockout_game`

---

## 3. Current Reference Inventory

### 3.1 Enabled games to learn from

| GameId               | Runtime                     | Why it is useful as a reference                               |
| -------------------- | --------------------------- | ------------------------------------------------------------- |
| `play_2048`          | `solo`                      | straightforward solo score game                               |
| `brick_breaker`      | `solo`                      | pause-registration and larger move payload handling           |
| `minesweeper`        | `solo`                      | game-specific score semantics                                 |
| `solitaire_klondike` | `solo`                      | standard solo path with richer board state                    |
| `tic_tac_toe`        | `turnBased`                 | smallest complete multiplayer reference                       |
| `connect_four`       | `turnBased`                 | same flow with bigger grid state                              |
| `chess`              | `turnBased`                 | more complex deterministic rules and richer tests             |
| `reversi`            | `turnBased`                 | standard turn-based pipeline with score stats                 |
| `dots_and_boxes`     | `turnBased`                 | standard turn-based flow with custom scoring                  |
| `crazy_eights`       | `turnBased` + private state | hidden-information card pattern                               |
| `battleship`         | `turnBased` + private state | hidden-information board pattern                              |
| `hex`                | `turnBased`                 | deterministic board game wired through the same shared system |
| `pong_game`          | `realtime`                  | 1v1 paddle game, hybrid Firebase + Colyseus with physics      |
| `knockout_game`      | `realtime`                  | physics-based multiplayer combat, 2–8 players with spectate   |
| `dead_drop`          | `turnBased` + private state | hidden-info deduction game, 4-player with team assignments    |
| `sketch_party_game`  | `realtime`                  | current realtime hybrid pattern                               |

### 3.2 Implemented but disabled

- `minigolf_duels`

Why this matters:

- it proves that adapter presence and screen presence are not enough to classify a game as launch-ready
- you must still check `IMPLEMENTED_GAME_IDS`

### 3.3 Catalog-only placeholders

These have metadata only and should not be used as proof of an implemented pattern:

- `bounce_blitz`
- `word_master`
- `lights_out`
- `checkers`
- `gomoku`
- `starforge_game`
- `crossword_puzzle`
- `dot_match`

---

## 4. Shared Integration Surface by Layer

### 4.1 Client touchpoints you almost always need to update

| Area                         | Primary files                                                     | Why it matters                                          |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| Game ID and metadata         | `src/gamesV4/types/common.ts`, `src/gamesV4/constants.ts`         | catalog presence, routing, labels, icons, runtime type  |
| Client adapter               | `src/gamesV4/adapters/{game}.ts`, `src/gamesV4/adapters/index.ts` | initial state, move validation, summaries, outcomes     |
| Gameplay screen              | `src/gamesV4/screens/{Game}ScreenV4.tsx`                          | actual UX and shell integration                         |
| Dispatcher mapping           | `src/gamesV4/screens/GamePlayDispatcherV4.tsx`                    | route-to-screen resolution                              |
| Descriptions and descriptors | `src/gamesV4/constants.ts`                                        | detail screen, game-over formatting, leaderboard labels |
| Achievements mirror          | `src/gamesV4/data/achievementDefinitions.ts`                      | achievements UI and section grouping                    |
| Tests                        | `__tests__/gamesV4/**`                                            | regression protection                                   |

### 4.2 Backend touchpoints for Firebase-driven games

| Area                    | Primary files                                            | Why it matters                           |
| ----------------------- | -------------------------------------------------------- | ---------------------------------------- |
| Backend adapter         | `firebase-backend/functions/src/gamesV4/adapters.ts`     | authoritative validation and outcomes    |
| Invite metadata map     | `firebase-backend/functions/src/gamesV4/invites.ts`      | invite creation and runtime gating       |
| Leaderboard metric      | `firebase-backend/functions/src/gamesV4/types.ts`        | PB and weekly leaderboard interpretation |
| Achievement definitions | `firebase-backend/functions/src/gamesV4/achievements.ts` | server-side unlock evaluation            |

### 4.3 Additional touchpoints for realtime games

| Area                    | Primary files                                        | Why it matters                           |
| ----------------------- | ---------------------------------------------------- | ---------------------------------------- |
| Realtime client contract | `src/gamesV4/realtime/games/{game}Def.ts` and `src/gamesV4/realtime/useRealtimeRoom.ts` | room join, event handling, senders |
| Settings helpers        | `src/gamesV4/data/{game}Settings.ts`                 | merged runtime settings and helper logic |
| Room server             | `colyseus-server/src/games/{game}/Room.ts`           | live authority                           |
| Realtime bridge         | `colyseus-server/src/bridge/firebaseBridge.ts`       | handoff into Firebase result pipeline    |
| Trigger target          | `firebase-backend/functions/src/gamesV4/triggers.ts` | Firestore trigger into shared resolution |

### 4.4 Shared UI surfaces your game must cooperate with

Even if you do not edit these files, your game must fit them:

- `src/gamesV4/screens/GamesHubScreenV4.tsx`
- `src/gamesV4/screens/GameDetailScreenV4.tsx`
- `src/gamesV4/screens/GameLobbyScreenV4.tsx`
- `src/gamesV4/screens/GameOverScreenV4.tsx`
- `src/gamesV4/screens/GameLeaderboardScreenV4.tsx`
- `src/gamesV4/screens/GameStatsScreenV4.tsx`
- `src/gamesV4/screens/AchievementsHubScreen.tsx`
- `src/gamesV4/screens/AchievementSectionScreen.tsx`
- `src/gamesV4/screens/LevelRewardsScreen.tsx`

### 4.5 Shared hooks and services your game will indirectly depend on

Key client files:

- `src/gamesV4/components/GameScreenShell.tsx`
- `src/gamesV4/hooks/useGameSessionV4.ts`
- `src/gamesV4/hooks/useGameLobbyV4.ts`
- `src/gamesV4/hooks/usePinnedInvites.ts`
- `src/gamesV4/hooks/useLeaderboardV4.ts`
- `src/gamesV4/hooks/useAchievementsV4.ts`
- `src/gamesV4/services/gameServiceV4.ts`
- `src/hooks/useWallet.ts`
- `src/hooks/usePendingRewards.ts`

The important consequence is that a new game is entering an existing ecosystem. It must produce the data these surfaces expect.

---

## 5. Adding a Firebase Solo or Turn-Based Game

This section covers the normal integration path for games whose live authority remains in Firestore and Cloud Functions.

### 5.1 Step 0: Confirm whether the `GameId` already exists

Check:

- `src/gamesV4/types/common.ts`
- `src/gamesV4/constants.ts`

Many future games already have placeholder IDs in the catalog. If the ID already exists, do not rename it or invent a near-duplicate.

### 5.2 Step 1: Add or confirm client metadata

Required client metadata lives in `src/gamesV4/constants.ts`.

You must keep these aligned:

- `GAME_METADATA`
- `GAME_DESCRIPTIONS`
- `SCOREBOARD_DESCRIPTORS`
- `LEADERBOARD_DESCRIPTORS`
- `IMPLEMENTED_GAME_IDS` once the game is truly ready

What each one does:

- `GAME_METADATA`: catalog grouping, icon, player counts, runtime type, spectating support, and optional solo lifecycle policy
- `GAME_DESCRIPTIONS`: detail-screen overview, how-to-play, and tips
- `SCOREBOARD_DESCRIPTORS`: game-over formatting and some history formatting
- `LEADERBOARD_DESCRIPTORS`: leaderboard label, metric type, and formatting
- `IMPLEMENTED_GAME_IDS`: whether the UI treats the game as playable instead of coming soon

### 5.3 Step 2: Add the client adapter

File:

- `src/gamesV4/adapters/{game}.ts`

Then register it in:

- `src/gamesV4/adapters/index.ts`

What the client adapter should own for Firebase games:

- identity fields: `gameId`, `runtimeType`, player counts, spectate support
- `createInitialPublicState()`
- `validateMove()` for any Firebase-driven game where local public-state validation is meaningful
- `computeSummary()` if the game wants better invite summaries than the default shell behavior
- `computeOutcome()` so results are not forced through the generic fallback scoreboard
- `extractPerformanceMetrics()` if achievements or result stats need anything beyond plain score and move count
- `validateSettings()` when the lobby exposes configurable settings

### 5.4 Step 3: Add the gameplay screen

File:

- `src/gamesV4/screens/{Game}ScreenV4.tsx`

Then wire it into:

- `src/gamesV4/screens/GamePlayDispatcherV4.tsx`

Expected pattern:

- the screen exports `withGameV4Shell(Component, gameId)`
- the screen uses shell props such as `publicState`, `submitMove`, `isMyTurn`, `isTerminal`, `actionLoading`, and `actionError`
- solo games with loops or timers should use `registerSoloPause()`

### 5.5 Step 4: Add the backend adapter

File:

- `firebase-backend/functions/src/gamesV4/adapters.ts`

This is not optional for a proper Firebase-driven game.

What the backend adapter is responsible for:

- authoritative move validation
- public and private state changes
- terminal detection
- scoreboard semantics
- performance metrics used by achievements or post-game surfaces

Important rule:

- the client and backend adapters must be logically aligned, but you should treat the backend as the canonical version

### 5.6 Step 5: Update backend invite metadata

File:

- `firebase-backend/functions/src/gamesV4/invites.ts`

Why you must do this even though it is duplicated:

- `createGameInviteV4` validates game IDs and properties against backend metadata
- session start and spectator settings still depend on this map

If you skip this file, the UI and backend can disagree about runtime type, player limits, or spectating.

### 5.7 Step 6: Configure leaderboard interpretation

Client file:

- `src/gamesV4/constants.ts`

Backend file:

- `firebase-backend/functions/src/gamesV4/types.ts`

You must decide whether the game is:

- `wins`-based
- `bestScore`-based

That choice affects:

- weekly leaderboard writes
- friends leaderboard reads
- PB interpretation
- what users think the "main score" means on the detail page and leaderboard page

### 5.8 Step 7: Add achievements in both places

Client mirror:

- `src/gamesV4/data/achievementDefinitions.ts`

Backend evaluator:

- `firebase-backend/functions/src/gamesV4/achievements.ts`

Do not stop at adding definitions to the client mirror. If the backend evaluator does not know about the achievement, it will never unlock.

### 5.9 Step 8: Add tests

At minimum, add or extend:

- adapter tests under `__tests__/gamesV4/adapters/`
- any settings helper tests if the game has non-trivial settings
- result or resolve tests if the game adds unusual scoring or metrics semantics

### 5.10 Step 9: Only then enable the game

Do this last:

- add the `gameId` to `IMPLEMENTED_GAME_IDS`

Do not enable early. Otherwise the game can surface in the UI while still missing runtime or backend support.

### 5.11 Hidden-information games need extra care

If your turn-based game has private information:

- implement `createInitialPrivateState()`
- expect server validation to read `PrivateState/{uid}` docs in `submitTurnMoveV4`
- do not assume the client shell can fully validate moves
- implement `getSpectatorView()` if public state could leak hidden information through derived fields

Current references:

- `battleship`
- `crazy_eights`
- `dead_drop`

### 5.12 Solo-specific lifecycle decisions you must make explicitly

Questions to answer before writing the solo adapter:

- should the hub resume the last active session or always create a new one?
- does back mean suspend or game over?
- does the game need `registerSoloPause()`?
- does the game use standard solo or dormant persistent-solo infrastructure?
- should rematch intentionally start fresh even if a resumable session exists? The current answer is yes for existing games.

---

## 6. Adding a Realtime / Colyseus Game

> **UPDATE**: A generalized realtime framework now exists. See
> [`docs/REALTIME_FRAMEWORK.md`](REALTIME_FRAMEWORK.md) for the complete
> architecture guide, step-by-step checklist, and code examples.
>
> The framework provides `BaseRealtimeRoom` (server) and `useRealtimeRoom` (client)
> so that new realtime games can be added by implementing a `RealtimeGameDefinition`
> contract and a thin room subclass — no more bespoke auth, reconnect, or
> resolution bridge code.

Use this path only if the game truly needs simultaneous live input, room timers, or socket-native state.

### 6.1 What a realtime integration actually requires

A realtime game in this repository still needs all of these:

Client side:

- `GAME_METADATA` and related descriptors in `src/gamesV4/constants.ts`
- a client adapter, usually minimal, in `src/gamesV4/adapters/{game}.ts`
- a gameplay screen in `src/gamesV4/screens/{Game}ScreenV4.tsx`
- **NEW**: a `RealtimeClientDefinition` in `src/gamesV4/realtime/games/{game}Def.ts`
- optional shared realtime payload/state contracts in `src/gamesV4/realtime/games/{game}Types.ts`
- dispatcher registration in `src/gamesV4/screens/GamePlayDispatcherV4.tsx`
- client achievement definitions in `src/gamesV4/data/achievementDefinitions.ts`

Firebase backend side:

- backend invite metadata in `firebase-backend/functions/src/gamesV4/invites.ts`
- backend achievements in `firebase-backend/functions/src/gamesV4/achievements.ts`
- backend leaderboard metric in `firebase-backend/functions/src/gamesV4/types.ts`
- a valid path back into `resolveRealtimeSessionV4()` or `resolveSessionV4Internal()`

Realtime server side:

- **NEW**: a `RealtimeGameDefinition` in `colyseus-server/src/games/{game}/Definition.ts`
- **NEW**: a room extending `BaseRealtimeRoom` in `colyseus-server/src/games/{game}/Room.ts`
- **NEW**: auto-registration module in `colyseus-server/src/games/{game}/index.ts`
- import in `colyseus-server/src/index.ts`
- ~~room registration in `colyseus-server/src/index.ts`~~ → handled via `GameRegistry`
- ~~bridge logic~~ → handled by `ResolutionBridge` in `BaseRealtimeRoom`

### 6.2 Do not treat the adapter as the live gameplay engine

For realtime games, the adapter is usually minimal.

Its job is still useful, but limited:

- advertise identity and settings schema
- produce a bootstrap public state for session creation
- provide summary and score formatting hooks where helpful
- sometimes provide a fallback `computeOutcome()` if the Firebase state carries enough info

It does not replace room authority.

### 6.3 Required realtime design rules implied by the current codebase

> **Framework note**: Rules 1–7 below are now **enforced by the framework**.
> `BaseRealtimeRoom` handles auth verification (rules 2–3), state isolation
> (rules 4, 7 via `visibilityScope`), resolution bridging (rule 5), and
> reconnect policy (rule 6). You no longer need to implement these manually.

If you add another Colyseus-backed game, preserve these rules:

1. Firebase lifecycle and room gameplay are separate concerns.
2. Room joins must verify Firebase auth.
3. Room joins must verify Firebase session membership.
4. The room must not assume Firestore mirrors live gameplay during play.
5. Final scoring must re-enter the shared resolve pipeline.
6. Reconnect behavior must be explicit and tested, not left as implicit room memory.
7. If the game has hidden information, do not broadcast it in a generic room state payload.

### 6.4 Required room-join contract

> **Framework note**: `FirebaseSessionGuard.verifyJoin()` in `BaseRealtimeRoom`
> performs all of these checks automatically. No manual implementation needed.

Sketch Party is the current pattern to copy.

The room join path should verify:

- Firebase token validity
- token UID matches claimed UID
- referenced session exists
- session is the correct `gameId`
- session has `runtimeType: "realtime"`
- session is in a joinable status, currently `active`
- caller exists in `participantUids`

If you skip any of those, you are creating a hole that the Firebase side will not patch for you.

### 6.5 Required room lifecycle decisions

> **Framework note**: These decisions are now **declared in the
> `RealtimeGameDefinition`** contract rather than coded imperatively.
> Each game specifies `matchStartPolicy`, `disconnectPolicy`,
> `lateJoinPolicy`, `spectatorMode`, `reconnectGraceMs`, etc.

Before implementation, define all of these in writing:

- when the room becomes joinable
- what constitutes the required starting roster
- whether spectators exist
- whether the match can start with a partial roster
- what happens if a player disconnects mid-turn
- what happens if everyone disconnects
- what data a reconnecting client receives immediately
- what condition ends the room and what payload is handed back to Firebase

### 6.6 Required result handoff

> **Framework note**: `ResolutionBridge.writeResolutionRequest()` handles this
> automatically when `BaseRealtimeRoom` enters the `match_end` phase. The
> `onMatchEnd()` callback returns the resolution payload data; the framework
> writes it to Firestore and the existing trigger pipeline processes it.

Sketch Party currently uses:

- `GameSessionsV4/{sessionId}/internal/realtimeResolution`
- Firestore trigger `onRealtimeResolutionRequest`
- bridge into `resolveRealtimeSessionV4()`

Your realtime game needs an equally explicit path.

Do not:

- write PBs directly from the room
- write achievements directly from the room
- update wallet balances directly from the room
- invent a parallel leaderboard system outside the current V4 pipeline

### 6.7 Realtime-specific checklist

Before marking a realtime game playable, confirm all of these:

- room join is Firebase-authenticated
- room join validates session membership
- room receives authoritative settings from Firebase session state, not only the client
- live messages are documented and typed client-side
- reconnect behavior is explicit
- disconnect behavior is explicit
- final resolution writes a bridge payload that the Firebase trigger understands
- the result produced by the room gives the shared pipeline enough data for scoreboards, PBs, leaderboards, and achievements
- client calls `leave()` on receiving `match_end` (see §6.8 item 1)
- visual element sizes are derived from server physics constants (see §6.8 item 3)
- `stateBroadcastHz` is tuned for the game (see §6.8 item 5)
- client-side extrapolation exists for any continuous-motion elements (see §6.8 item 6)

### 6.8 Realtime patterns learned from Pong integration

These patterns were discovered and validated during the Pong game integration. They apply to any future realtime game built on the framework.

#### 1. Client must `leave()` on match end to prevent reconnect loops

When a Colyseus room reaches `match_end`, the server disposes the room shortly after writing the resolution bridge doc. If the client does not explicitly call `leave()` when it receives the `match_end` message, the Colyseus client SDK interprets the server-initiated disconnect as unexpected and enters a reconnect loop. This prevents the shell from detecting the terminal Firestore session status and navigating to Game Over.

Pattern:

```typescript
room.onMessage("match_end", () => {
  haptics.success();
  leave(); // from useRealtimeRoom — prevents reconnect loop
});
```

The `leave` function is returned by `useRealtimeRoom`. Destructure it alongside `room`, `send`, etc.

#### 2. Server physics and client display orientation are independent concerns

If the game's natural server coordinate system does not match the desired client display orientation, implement coordinate mapping functions on the client only. Never change the server physics to match a display preference.

For example, Pong's server uses a horizontal coordinate system (left/right goals, top/bottom walls) but the client displays vertically (top/bottom goals, left/right paddle movement). The client implements `mapSX()` (server X → screen Y) and `mapSY()` (server Y → screen X) and a per-player perspective flip so both players see their paddle at the bottom.

This pattern keeps the server simple and authoritative while allowing arbitrary client display orientations — including per-player perspective flips for symmetry.

#### 3. Visual element sizes must derive from server physics constants

If the server defines collision radii, paddle widths, or hitbox sizes as normalized constants, the client must map those same constants to pixel values. Hardcoding visual sizes independently from server constants causes visual-collision mismatches — the ball appears to pass through a paddle, or bounces before visually reaching it.

Pattern:

```typescript
// Server constants: BALL_RADIUS = 0.012, PADDLE_WIDTH = 0.012
const BALL_R = Math.max(7, Math.round(0.012 * ARENA_H));
const PADDLE_THICK = Math.max(12, Math.round(0.024 * ARENA_H));
function paddleWidthPx(preset: string | undefined): number {
  return Math.round((preset === "large" ? 0.22 : 0.16) * ARENA_W);
}
```

This ensures that visual rendering always matches server collision geometry, even when arena dimensions change across devices.

#### 4. Allow player input during non-live phases to prevent snap-back

In games with distinct phases (countdown, serve, live, point_scored, match_end), restricting player input to only the `live` phase causes paddles or controlled elements to snap back to default positions between rounds. Both the server and client must allow input during transitional phases.

Server fix: process input updates (e.g., `updatePaddles(dt)`) before the phase gate in `onTick()`, not inside it.

Client fix: accept touch/pointer events during all phases except explicitly terminal ones (`waiting`, `match_end`, `aborted`).

#### 5. Tune `stateBroadcastHz` per game

The framework's `stateBroadcastHz` setting in the game definition controls how often the server broadcasts state to clients. The right value depends on the game's motion characteristics:

- Turn-based or slow games: default (6–10 Hz) is fine
- Fast continuous motion like Pong: 20 Hz prevents visible teleporting
- Higher than 20 Hz is rarely needed and wastes bandwidth

Declare this in the game's `RealtimeGameDefinition`:

```typescript
export const PONG_GAME_DEF: RealtimeGameDefinition = {
  // ...
  stateBroadcastHz: 20,
};
```

#### 6. Implement client-side extrapolation for continuous motion

When the server broadcasts at < 60 fps (e.g., 20 Hz), fast-moving objects like balls will appear to teleport between positions. Implement client-side extrapolation using `requestAnimationFrame` and `Animated.Value` to maintain 60 fps visual smoothness.

Pattern:

- Store the last authoritative state (position + velocity + timestamp) from the server
- Each RAF tick: compute `elapsed = now - lastTimestamp`, extrapolate `position + velocity * elapsed`, clamp to bounds, and set the `Animated.Value`
- On new server state: compare extrapolated position to new authoritative position. If close, let the extrapolation smoothly converge. If far (teleport threshold), snap immediately.

This gives the illusion of smooth 60 fps movement while keeping the server fully authoritative.

#### 7. Consider match-progression difficulty escalation

For competitive games where stalemates are possible, implement server-side difficulty escalation tied to match progress. This keeps matches from dragging on indefinitely.

Pong example: ball speed increases 3% per scored point, capped at +60%. This is implemented in a single server-side helper:

```typescript
private getMatchSpeedMultiplier(): number {
  const totalPoints = /* sum of all player scores */;
  return 1 + Math.min(totalPoints * 0.03, 0.6);
}
```

Apply the multiplier wherever the server sets velocity (ball launch, paddle hit). Keep the escalation server-authoritative so clients cannot manipulate it.

---

## 7. Shared Contracts You Must Design Around

### 7.1 `GameAdapterV4` reality check

Primary file:

- `src/gamesV4/types/adapter.ts`

The current adapter contract includes more than the old minimal shape. Important fields and hooks include:

- identity: `gameId`, `runtimeType`, player counts, spectate mode
- settings: `settingsSchema`, `defaultSettings`, optional `validateSettings()`
- state creation: `createInitialPublicState()`, optional `createInitialPrivateState()`
- move validation: `validateMove()`
- summaries and outcomes: `computeSummary()`, `computeOutcome()`
- metrics: `extractPerformanceMetrics()`
- spectator filtering: `getSpectatorView()`
- dormant persistent-solo hooks: `supportsOfflineProgression`, `applyOfflineProgression()`, `archiveRun()`, and others

### 7.2 What `validateMove()` must and must not assume

For Firebase-driven games, `validateMove()` should:

- be deterministic
- only depend on provided state and context
- produce the same logical result on client and server for public-state games
- return terminal info when the game ends naturally
- return `nextTurnPlayerId` when turn order is not simple round-robin

It must not assume:

- access to client-local UI state
- access to hidden state when running in the client shell
- that the caller can be trusted to supply `winnerIds`

### 7.3 `GameScreenShell` behavior your game must tolerate

Primary file:

- `src/gamesV4/components/GameScreenShell.tsx`

What it will do around your screen:

- create and clean up `GamePresence` docs
- manage optimistic overlay state for Firebase-driven public state
- handle action-loading and action-error display plumbing
- navigate to game over after terminal state
- apply runtime-specific back/exit behavior
- expose `registerSoloPause()` for solo games

What this means for screen authors:

- do not duplicate presence writes inside the game screen
- do not build your own terminal navigation if the game is Firebase-driven
- if the game has a loop or timer, register a pause callback instead of assuming unmount timing is enough

### 7.4 `useGameSessionV4()` and `useGameLobbyV4()` assumptions

`useGameSessionV4()`:

- subscribes to session, public state, and eventually result
- computes `isMyTurn` differently by runtime family
- suppresses some transient permission errors during resolution
- assumes Firebase sessions are authoritative for solo and turn-based gameplay

`useGameLobbyV4()`:

- subscribes to the invite first
- subscribes to the session only once the invite is active or resolved with a session ID
- expects the lobby screen to auto-navigate when the active session becomes ready

### 7.5 Main-score semantics must be coherent across four places

When you decide what a game's primary score means, you must keep it coherent in:

- adapter outcome / scoreboard generation
- scoreboard descriptor formatting
- leaderboard metric and descriptor
- PB interpretation and achievement logic

If these disagree, the user will see inconsistent numbers across Game Over, Game Detail, leaderboards, friends leaderboards, and stats.

---

## 8. Metadata, Leaderboards, PBs, Achievements, XP, and Wallet Links

### 8.1 Metadata fields that matter operationally

From `src/gamesV4/constants.ts`, `GAME_METADATA` controls more than labels.

Important fields:

- `runtimeType`
- `minPlayers`
- `maxPlayers`
- `supportsSpectate`
- `icon`
- optional solo lifecycle fields such as `soloMode`, `allowResign`, `allowRestart`, `autoResumeExisting`, `supportsOfflineProgression`, and `longLivedSession`

Do not treat metadata as cosmetic only.

### 8.2 The backend metadata duplication trap

There is still a separate backend map in:

- `firebase-backend/functions/src/gamesV4/invites.ts`

If you add a game and forget that file, the backend can still reject or misclassify the invite even though the client looks correct.

### 8.3 Scoreboard descriptors

Defined in:

- `src/gamesV4/constants.ts`

Used by:

- `GameOverScreenV4`
- some history and detail-screen score displays

Typical patterns:

- win/loss games: `1 -> Win`, `0 -> Loss`
- score games: `score.toLocaleString()`
- encoded score games: formatter decodes or prettifies the internal numeric value

### 8.4 Leaderboard descriptors and metrics

Client side:

- `LEADERBOARD_DESCRIPTORS` in `src/gamesV4/constants.ts`

Backend side:

- `LEADERBOARD_METRICS` in `firebase-backend/functions/src/gamesV4/types.ts`

They must agree on whether the leaderboard is based on:

- cumulative wins
- best score

### 8.5 PB and stats write behavior

PB writes happen in `resolve.ts` only.

Behavior to remember:

- wins-based games mostly use `totalWins` and `totalPlays`
- best-score games update `pbValue` only when improved, but still increment play count even when no new PB is set
- PB docs are also the source for friends leaderboards

### 8.6 Achievement integration requirements

A game-specific achievement section is not just a UI grouping. It needs:

- client section definition
- client achievement defs
- backend section definition
- backend evaluator defs
- a coherent `sectionId`
- optionally a badge claim path via `claimAchievementSectionBadgeV4`

### 8.7 Reward model you must fit into

Game integration affects wallet surfaces indirectly.

Current reward model:

- XP is auto-awarded on resolution
- achievement tokens are manual-claim only
- level reward tokens and cosmetics are manual-claim only
- wallet balance is updated by claim callables, not by game adapters or room servers

Practical implication:

- your game must produce correct resolution data and achievements docs
- it should not write wallet or transactions data directly

---

## 9. Runtime Flows You Must Fit Into

### 9.1 Chat invite to active Firebase game

```text
Chat or group screen
  -> GamePickerModal
  -> createGameInvite()
  -> invite appears in PinnedInviteBar
  -> user taps chip
  -> GameLobbyV4
  -> join/start
  -> GamePlayV4
  -> submitTurnMoveV4
  -> resolveSessionV4Internal
  -> GameOverV4
```

### 9.2 Detail-first invite flow

This now exists and must be documented correctly.

```text
GamesHubScreenV4
  -> GameDetailV4
  -> Invite a Friend
  -> ConversationPickerModal
  -> createGameInvite()
  -> navigate into DM or group where invite was sent
```

If you write docs or features assuming multiplayer invites only start from chat, you will be wrong.

### 9.3 Solo launch, suspend, resume, and rematch

```text
GamesHub or GameDetail
  -> resumeOrCreateSoloSession()
  -> GamePlayV4
  -> suspend on back
  -> resume from hub/detail later
  -> resolve on natural end, resign, or restart
  -> GameOverV4
  -> Play Again creates a fresh solo session
```

### 9.4 Firebase turn-based post-game flow

```text
terminal move or resign
  -> resolveSessionV4Internal
  -> result doc
  -> XP
  -> PB
  -> leaderboard
  -> achievements earned_unclaimed
  -> game-over screen
  -> achievement and reward claim surfaces later
```

### 9.5 Realtime resolution flow

```text
room reaches match end
  -> compute final scoreboard in room
  -> write realtime resolution bridge doc
  -> Firestore trigger fires
  -> resolveRealtimeSessionV4()
  -> resolveSessionV4Internal()
  -> normal result and reward surfaces
```

### 9.6 Re-entry and deep-link expectations

Current navigation stack supports re-entry through:

- pinned invite chips
- Games Hub active-invite cards
- deep links registered in `RootNavigator.tsx`
- result-screen navigation from a resolved invite with `sessionId`

---

## 10. UI and UX Expectations

### 10.1 Games Hub expectations

Your game should appear correctly in:

- section grouping by `runtimeType`
- implemented vs coming-soon state
- solo direct-launch behavior or multiplayer detail routing
- active-invite surfaces when relevant

### 10.2 Game Detail expectations

Your game must supply enough data to populate:

- icon and display name
- short description
- how-to-play text
- tips
- progress card
- leaderboard label and value formatting
- achievement rows
- history rows

### 10.3 Lobby expectations

If the game uses the Firebase lobby pipeline, it should support:

- readable player counts and spectator state
- validated host settings if the game exposes settings
- auto-navigation into gameplay after start
- sensible handling of cancel and leave flows

### 10.4 Gameplay screen expectations

For Firebase-driven games:

- rely on the shell for lifecycle and result navigation
- use shell props consistently
- keep the gameplay screen focused on rendering and move intent, not backend orchestration

For realtime games:

- still use the shell for route-level lifecycle, presence, and exit behavior
- but own the room connection and live event handling in the screen or a dedicated service

### 10.5 Game Over expectations

The result your game produces must support:

- winner or draw messaging
- formatted scoreboard
- per-player stats when useful
- XP row and optional level-up button
- achievement unlock rows
- rematch behavior that makes sense for the runtime family

---

## 11. Debugging, Common Mistakes, and Failure Modes

### 11.1 Common mistakes when adding a game

1. Updating client metadata but forgetting backend invite metadata.
2. Adding a client adapter and screen but not a backend adapter.
3. Enabling the game in `IMPLEMENTED_GAME_IDS` before the result pipeline can interpret its score.
4. Adding achievements only in the client mirror.
5. Adding a lobby setting that the runtime never reads.
6. Treating hidden-information games like public-state games in the client shell.
7. Building a realtime game without a proper Firebase-authenticated room join.
8. Writing docs that imply one uniform V4 architecture when the game is actually a Colyseus exception.
9. Not calling `leave()` on `match_end` in a realtime game, causing a reconnect loop that blocks Game Over navigation.
10. Hardcoding visual element sizes instead of deriving them from server physics constants, causing hitbox-visual mismatches.
11. Restricting player input to only the `live` phase, causing controlled elements to snap to default positions between rounds.
12. Using the default broadcast rate for fast-motion realtime games, causing visible teleporting of moving objects.
13. Not implementing client-side extrapolation when server broadcast rate is below 60 Hz.

### 11.2 Debugging map by symptom

If the game does not appear as playable:

- check `IMPLEMENTED_GAME_IDS`
- check dispatcher mapping
- check client adapter registration in `src/gamesV4/adapters/index.ts`

If the invite cannot be created or has wrong limits:

- check backend metadata in `firebase-backend/functions/src/gamesV4/invites.ts`

If the lobby settings show but do nothing:

- check the adapter `validateSettings()`
- check whether runtime code actually reads `session.settings`

If the game resolves but no PB, XP, or achievements appear:

- check whether the terminal path reaches `resolveSessionV4Internal()`
- inspect `GameResultsV4/{sessionId}` and `GameSessionsV4/{sessionId}.rewardsProcessed`

If the friends leaderboard is wrong:

- inspect `Users/{uid}/GamePB/{gameId}`
- confirm the game's leaderboard metric matches the client descriptor and backend metric table

If the realtime game seems live but nothing shows on Game Over:

- inspect the realtime bridge doc path
- inspect trigger execution in `onRealtimeResolutionRequest`
- confirm `resolveRealtimeSessionV4()` receives a usable scoreboard

### 11.3 Special debugging notes for hidden-info games

Remember:

- local optimism is intentionally incomplete
- not all invalid moves can be rejected before the backend transaction runs
- if a move fails server-side, that may be expected because the shell does not know private state

### 11.4 Special debugging notes for Sketch Party

First things to verify:

- room join includes a Firebase token
- room verifies membership against the session doc
- room reaches full expected roster before start
- personalized `state_sync` delivers `secretWord` only to the drawer
- final room result writes the Firestore bridge doc at the correct path

### 11.5 Current system gaps the docs should not hide

These are known limitations, not reasons to misdocument the system:

- backend invite metadata is still duplicated
- week-key logic is still duplicated across client and backend
- hidden-info client optimism is intentionally incomplete
- realtime live progress is not mirrored back into Firestore
- full-roster realtime gating still has no grace timeout or host override
- there is still no socket-level Colyseus integration test suite

---

## 12. QA and Release Readiness Checklists

### 12.1 Core integration checklist

- [ ] `GAME_METADATA` entry exists and is correct
- [ ] `GAME_DESCRIPTIONS` entry exists and is useful
- [ ] `SCOREBOARD_DESCRIPTORS` entry matches the game's score semantics
- [ ] `LEADERBOARD_DESCRIPTORS` entry matches the backend metric
- [ ] Client adapter exists and is registered
- [ ] Gameplay screen exists and is in `GamePlayDispatcherV4.tsx`
- [ ] Backend adapter exists for Firebase-driven games
- [ ] Backend invite metadata entry exists and matches the client
- [ ] Achievement definitions exist in client and backend
- [ ] Tests exist or were extended for adapter and key runtime behaviors
- [ ] Only after all of that, the game is added to `IMPLEMENTED_GAME_IDS`

### 12.2 Solo checklist

- [ ] Hub launch resumes or creates correctly
- [ ] Detail launch resumes or creates correctly
- [ ] No invite doc is created for solo launch
- [ ] Back suspends instead of resolving
- [ ] Restart works
- [ ] Resign works
- [ ] Natural game over resolves into Game Over and result docs
- [ ] Rematch intentionally starts fresh
- [ ] If the game has a loop or timer, suspend pauses it cleanly

### 12.3 Turn-based checklist

- [ ] Invite creation works from chat surfaces
- [ ] Invite creation works from Game Detail if multiplayer
- [ ] Lobby join, leave, cancel, and start work correctly
- [ ] Spectating works only if actually supported
- [ ] Turn order is correct
- [ ] Invalid moves are rejected
- [ ] Terminal moves produce correct winner and score semantics
- [ ] Turn notifications go only to the correct next player
- [ ] History and leaderboard entries match the game's main score meaning

### 12.4 Hidden-information checklist

- [ ] Private state docs are created correctly
- [ ] Server validation uses that private state correctly
- [ ] Local optimism does not leak or corrupt hidden state
- [ ] Spectator view does not reveal private information

### 12.5 Realtime / Colyseus checklist

- [ ] Room join verifies Firebase auth
- [ ] Room join verifies Firebase session membership
- [ ] Room waits for the intended roster before starting
- [ ] Room settings come from Firebase session state
- [ ] Room messages are typed and documented client-side
- [ ] Reconnect delivers the right state snapshot
- [ ] Disconnect behavior is explicit and reasonable
- [ ] Match end writes a realtime bridge doc that Firebase triggers understand
- [ ] Shared resolve pipeline writes result, XP, PB, achievements, and leaderboards after the room ends
- [ ] Client calls `leave()` on `match_end` to prevent reconnect loop after room disposal
- [ ] Visual sizes (ball, paddle, hitboxes) are derived from server physics constants, not hardcoded
- [ ] Player input is allowed during transitional phases (countdown, serve, etc.) to prevent snap-back
- [ ] `stateBroadcastHz` is tuned for the game's motion requirements (e.g., 20 Hz for fast movement)
- [ ] Client-side extrapolation (RAF + Animated.Value) exists for any continuously moving element
- [ ] Match-progression escalation is implemented server-side if stalemates are a risk

### 12.6 Release readiness checklist

- [ ] run `npx jest --testPathPattern=gamesV4`
- [ ] run any new adapter or settings tests you added
- [ ] run `cd firebase-backend/functions && npm run build`
- [ ] if a realtime server was touched, run `cd colyseus-server && npm run build`
- [ ] manually verify hub, detail, lobby, gameplay, game over, leaderboard, and achievements flows
- [ ] manually verify at least one failure case: invalid move, leave/cancel, or reconnect

---

## 13. File Checklist by Runtime

### 13.1 Firebase solo game

Usually required:

- `src/gamesV4/constants.ts`
- `src/gamesV4/adapters/{game}.ts`
- `src/gamesV4/adapters/index.ts`
- `src/gamesV4/screens/{Game}ScreenV4.tsx`
- `src/gamesV4/screens/GamePlayDispatcherV4.tsx`
- `src/gamesV4/data/achievementDefinitions.ts`
- `firebase-backend/functions/src/gamesV4/adapters.ts`
- `firebase-backend/functions/src/gamesV4/invites.ts` only if the game also appears in multiplayer invite metadata surfaces? For pure solo, backend invite metadata is usually not exercised, but keeping metadata aligned is still safer if the ID is cataloged broadly.
- `firebase-backend/functions/src/gamesV4/types.ts`
- `firebase-backend/functions/src/gamesV4/achievements.ts`
- `__tests__/gamesV4/adapters/{game}.test.ts`

### 13.2 Firebase turn-based game

Usually required:

- `src/gamesV4/constants.ts`
- `src/gamesV4/adapters/{game}.ts`
- `src/gamesV4/adapters/index.ts`
- `src/gamesV4/screens/{Game}ScreenV4.tsx`
- `src/gamesV4/screens/GamePlayDispatcherV4.tsx`
- `src/gamesV4/data/achievementDefinitions.ts`
- `firebase-backend/functions/src/gamesV4/adapters.ts`
- `firebase-backend/functions/src/gamesV4/invites.ts`
- `firebase-backend/functions/src/gamesV4/types.ts`
- `firebase-backend/functions/src/gamesV4/achievements.ts`
- adapter and integration tests

### 13.3 Hidden-information turn-based game

All of the turn-based list, plus explicit work on:

- `createInitialPrivateState()`
- server-side move validation using private state
- optional `getSpectatorView()` if public state could leak hidden info

### 13.4 Realtime / Colyseus game

Usually required:

- `src/gamesV4/constants.ts`
- `src/gamesV4/adapters/{game}.ts`
- `src/gamesV4/adapters/index.ts`
- `src/gamesV4/data/{game}Settings.ts`
- `src/gamesV4/realtime/games/{game}Def.ts`
- `src/gamesV4/realtime/useRealtimeRoom.ts`
- `src/gamesV4/screens/{Game}ScreenV4.tsx`
- `src/gamesV4/screens/GamePlayDispatcherV4.tsx`
- `src/gamesV4/data/achievementDefinitions.ts`
- `firebase-backend/functions/src/gamesV4/invites.ts`
- `firebase-backend/functions/src/gamesV4/types.ts`
- `firebase-backend/functions/src/gamesV4/achievements.ts`
- `firebase-backend/functions/src/gamesV4/triggers.ts` if a new bridge path is needed
- `colyseus-server/src/index.ts`
- `colyseus-server/src/games/{game}/Room.ts`
- `colyseus-server/src/bridge/firebaseBridge.ts` or equivalent bridge logic
- client settings tests and any realtime integration tests you can add

### 13.5 Final reminder

If you are uncertain whether a game is really integrated, walk through this sequence and verify each artifact exists and agrees with the rest of the system:

```text
catalog metadata
  -> enabled gate
  -> adapter registration
  -> dispatcher mapping
  -> launch path
  -> active gameplay authority
  -> terminal result path
  -> descriptors
  -> PB / leaderboard / achievement integration
  -> game-over rendering
  -> tests
```

If any link is missing, the game is not fully integrated yet.
