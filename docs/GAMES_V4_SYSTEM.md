# Games V4 System — Spec & Developer Guide

> **Single source of truth** for the GamePigeon-style in-chat game system.
> Companion: [GAMES_V4_RUNBOOK.md](GAMES_V4_RUNBOOK.md) (ops / debug / test guide).
> Last updated: 2026-03-03 (expanded audit pass)

---

## Table of Contents

1. [Purpose & Product Goals](#1-purpose--product-goals)
2. [High-level Architecture](#2-high-level-architecture)
3. [Core Concepts & Glossary](#3-core-concepts--glossary)
4. [Data Model](#4-data-model)
5. [State Machines](#5-state-machines)
6. [End-to-End Flows](#6-end-to-end-flows)
7. [Runtime Types](#7-runtime-types)
8. [Real-time Invite Card Updates](#8-real-time-invite-card-updates)
9. [Rewards & Integrity](#9-rewards--integrity)
10. [Notifications](#10-notifications)
11. [Security & Permissions](#11-security--permissions)
12. [Navigation Contract](#12-navigation-contract)
13. [Extending: How to Add a New Game](#13-extending-how-to-add-a-new-game)
14. [Firestore Composite Indexes](#14-firestore-composite-indexes)
15. [Test Inventory](#15-test-inventory)
16. [Known Gaps / TODOs](#16-known-gaps--todos)

---

## 1. Purpose & Product Goals

Ship a **GamePigeon-style** game system embedded inside chat conversations:

- Players tap a gamepad button in the chat composer → pick a game → invite is **pinned** at the top of the chat
- Other members see the invite card **in real time**, join the lobby, and play
- Turn-based games use Firestore as the state machine; solo games run locally with server validation; realtime games are planned via Colyseus
- Games award **XP, achievements, leaderboard entries, and personal bests** on completion
- The system is **adapter-driven** — adding a new game means implementing one TypeScript interface, no infra changes

---

## 2. High-level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     React Native Client                  │
│                                                          │
│  ChatScreen ─→ GamePickerModal ─→ createGameInviteV4()   │
│  GamesHubScreen ─→ createSoloSessionV4() (solo games)    │
│       │                                                  │
│  PinnedInviteBar ←──── onSnapshot(GameInvitesV4)         │
│       │                                                  │
│  GameLobbyScreen → joinInviteLobbyV4/startGameFromInvite │
│       │                                                  │
│  GamePlayDispatcher ──→ game-specific screen             │
│       │                  (wrapped by GameScreenShell)     │
│       │                                                  │
│  GameScreenShell ──→ submitTurnMoveV4() / resignV4()     │
│       │                                                  │
│  GameOverScreen ←──── onSnapshot(GameResultsV4)          │
└──────────┬───────────────────────────────────────────────┘
           │ httpsCallable / Firestore listeners
           ▼
┌──────────────────────────────────────────────────────────┐
│              Firebase Cloud Functions (Node 20)           │
│                                                          │
│  Callables (10):                                         │
│    createGameInviteV4    joinInviteLobbyV4               │
│    leaveInviteLobbyV4    cancelGameInviteV4              │
│    startGameFromInviteV4 updateLobbySettingsV4           │
│    createSoloSessionV4   submitTurnMoveV4                │
│    resignSessionV4       resolveRealtimeSessionV4        │
│                                                          │
│  Triggers:                                               │
│    onGameInviteV4Deleted  onSessionV4StatusChanged        │
│                                                          │
│  Scheduled:                                              │
│    watchdogGamesV4 (every 30 min)                        │
│                                                          │
│  Internal (not a deployed function):                     │
│    resolveSessionV4Internal (single chokepoint)          │
└──────────┬───────────────────────────────────────────────┘
           │ reads / writes
           ▼
┌──────────────────────────────────────────────────────────┐
│                    Cloud Firestore                        │
│                                                          │
│  GameInvitesV4/{inviteId}                                │
│  GameSessionsV4/{sessionId}                              │
│    └─ PublicState/state                                  │
│    └─ PrivateState/{uid}                                 │
│    └─ Moves/{moveId}                                     │
│  GameResultsV4/{sessionId}                               │
│  LeaderboardsV4/{gameId}/Weeks/{wk}/Entries/{uid}        │
│  Users/{uid}/GamePB/{gameId}                             │
│  Users/{uid}/Achievements/{type}                         │
│  Users/{uid}/UserStatsCache/stats                        │
│  Users/{uid}/RateLimits/{action}                         │
│  Users/{uid}/GamePresence/{docId}                        │
│  Chats/{id}.pinnedGameInviteIds  []                      │
│  Groups/{id}.pinnedGameInviteIds []                      │
└──────────────────────────────────────────────────────────┘
```

### Key file map

| Layer                 | Module                                                             | Path                                                                      |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Client service        | Callable wrappers + subscriptions                                  | `src/gamesV4/services/gameServiceV4.ts`                                   |
| Client hooks          | Lobby, session, pinned, stats, leaderboard, achievements           | `src/gamesV4/hooks/`                                                      |
| Client screens        | Hub, lobby, dispatcher, game-over, game-detail, leaderboard, stats | `src/gamesV4/screens/`                                                    |
| Client components     | PinnedInviteBar, GamePickerModal, GameScreenShell                  | `src/gamesV4/components/`                                                 |
| Client adapters       | Registry, runner, TTT, C4, 2048                                    | `src/gamesV4/adapters/`                                                   |
| Client types          | 7 type files                                                       | `src/gamesV4/types/`                                                      |
| Client constants      | Collections, metadata, limits, XP config                           | `src/gamesV4/constants.ts`                                                |
| Backend callables     | Invite, lobby, session, solo                                       | `firebase-backend/functions/src/gamesV4/{invites,lobby,sessions,solo}.ts` |
| Backend resolution    | Single chokepoint + reward retry                                   | `firebase-backend/functions/src/gamesV4/resolve.ts`                       |
| Backend adapters      | Registry + 3 pilots (851 lines)                                    | `firebase-backend/functions/src/gamesV4/adapters.ts`                      |
| Backend triggers      | Invite delete, session status                                      | `firebase-backend/functions/src/gamesV4/triggers.ts`                      |
| Backend watchdog      | 4-pass scheduled cleanup                                           | `firebase-backend/functions/src/gamesV4/watchdog.ts`                      |
| Backend notifications | Push dispatch for invite/turn/resolved/lobby-join                  | `firebase-backend/functions/src/gamesV4/notifications.ts`                 |
| Backend achievements  | 18-def evaluator                                                   | `firebase-backend/functions/src/gamesV4/achievements.ts`                  |
| Backend helpers       | Auth, membership, pins, traceId, hash                              | `firebase-backend/functions/src/gamesV4/helpers.ts`                       |
| Backend validation    | Sanitization, rate limits                                          | `firebase-backend/functions/src/gamesV4/validation.ts`                    |
| Firestore rules       | V4 game collections (12 match blocks)                              | `firebase-backend/firestore.rules` (lines 1710–1920)                      |
| Firestore indexes     | 13 V4 composite indexes                                            | `firebase-backend/firestore.indexes.json`                                 |
| Navigation            | Screen registration + deep links                                   | `src/navigation/RootNavigator.tsx` (lines 663–746)                        |
| Tests                 | 9 test files: adapters, resolve, validation, regression            | `__tests__/gamesV4/`                                                      |

---

## 3. Core Concepts & Glossary

| Term                      | Definition                                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invite**                | A chat-pinned document (`GameInvitesV4`) representing a game challenge. Visible to all conversation members.                                                                                                                      |
| **Session**               | The server-authoritative game state (`GameSessionsV4`). Created when the host starts the game.                                                                                                                                    |
| **Adapter**               | A pure, stateless TypeScript object implementing `GameAdapterV4`. Defines initial state, move validation, outcome computation. Shared between client (optimistic) and server (authoritative).                                     |
| **GameScreenShell**       | HOC (`withGameV4Shell`) that wraps every game UI with session management, move dispatch, overlay controls, and auto-navigation. Solo games get overlay back arrow + menu; turn-based get header row; realtime get overlay resign. |
| **Resolution chokepoint** | `resolveSessionV4Internal()` — every terminal path (win/draw/resign/timeout/error) funnels through this single function.                                                                                                          |
| **PB**                    | Personal Best — server-written only, with integrity hash. Never derived from client data.                                                                                                                                         |
| **Summary**               | `InviteSummary` embedded in invite doc — phase, turnPlayerId, scoreSummary, lastMoveAt, lastActorId. Powers real-time card updates.                                                                                               |
| **Pin**                   | Invite IDs stored in `pinnedGameInviteIds[]` on `Chats` or `Groups` docs. Max 5 (FIFO eviction).                                                                                                                                  |
| **Watchdog**              | `watchdogGamesV4` — scheduled function (every 30 min) that expires stale lobbies, deletes TTL invites, retries rewards, and auto-resolves inactive sessions.                                                                      |
| **traceId**               | 32-char hex string (`crypto.randomBytes(16)`) stored in `session.integrity.traceId` for end-to-end debugging.                                                                                                                     |
| **GameId**                | String union of all 20 canonical game identifiers. Defined in `src/gamesV4/types/common.ts`. **Never rename or remove an existing ID — only append.**                                                                             |
| **IMPLEMENTED_GAME_IDS**  | `Set<GameId>` gating which games are playable. Currently 3: `tic_tac_toe`, `connect_four`, `play_2048`. Unimplemented games show "Coming Soon" in the Games Hub.                                                                  |
| **Serialization**         | Firestore rejects native 2D arrays. Game boards are serialized to `{ _nestedArray: true, length: N, "0": [...] }` maps by `serializeStateForFirestore()` and deserialized on read.                                                |
| **GameRunner**            | Orchestration layer (`gameRunner.ts`) that delegates to the correct adapter. Entry points: `createInitialState()`, `runMove()`, `computeOutcome()`.                                                                               |
| **Cooldown**              | Firestore-backed per-user rate limit. Transactional check-and-set on `Users/{uid}/RateLimits/{action}`. Throws `resource-exhausted` if within window.                                                                             |

### Game Catalog (20 Games)

| Category           | Games                                                                                                               | Playable Today?               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Solo (6)**       | `bounce_blitz`, `play_2048`, `brick_breaker`, `word_master`, `minesweeper`, `lights_out`                            | `play_2048` only              |
| **Turn-based (7)** | `tic_tac_toe`, `chess`, `checkers`, `connect_four`, `gomoku`, `reversi`, `dots_and_boxes`                           | `tic_tac_toe`, `connect_four` |
| **Realtime (7)**   | `pong_game`, `battleship`, `sketch_party_game`, `starforge_game`, `crossword_puzzle`, `minigolf_duels`, `dot_match` | None (Coming Soon)            |

---

## 4. Data Model

### 4.1 GameInvitesV4/{inviteId}

| Field                     | Type                                          | Description                                         |
| ------------------------- | --------------------------------------------- | --------------------------------------------------- |
| `inviteId`                | string                                        | Same as doc ID                                      |
| `conversationId`          | string                                        | DM chatId or groupId                                |
| `conversationScope`       | `"dm" \| "group"`                             |                                                     |
| `gameId`                  | GameId                                        | One of 20 canonical IDs                             |
| `runtimeType`             | `"solo" \| "turnBased" \| "realtime"`         |                                                     |
| `createdBy`               | string (uid)                                  |                                                     |
| `status`                  | `"sent" \| "lobby" \| "active" \| "resolved"` | Monotonic                                           |
| `hostId`                  | string (uid)                                  |                                                     |
| `participantIds`          | string[]                                      | Player UIDs (incl. host)                            |
| `spectatorIds`            | string[]                                      |                                                     |
| `maxPlayers`              | number                                        |                                                     |
| `allowSpectators`         | boolean                                       |                                                     |
| `spectateMode`            | SpectateMode                                  | `"public_only" \| "post_game_only" \| "full_state"` |
| `sessionId`               | string \| null                                | Set when game starts                                |
| `summary`                 | InviteSummary                                 | Real-time card data                                 |
| `hiddenInChat`            | boolean                                       | Advisory hide flag                                  |
| `hiddenAt`                | Timestamp \| null                             |                                                     |
| `deleteRequestedAt`       | Timestamp \| null                             |                                                     |
| `deleteAt`                | Timestamp \| null                             | TTL for watchdog deletion                           |
| `participantSummaries`    | ParticipantSummary[]                          | `{ uid, displayName, profilePictureUrl }`           |
| `spectatorSummaries`      | ParticipantSummary[]                          | Same shape as participant summaries                 |
| `createdAt` / `updatedAt` | Timestamp                                     |                                                     |

**Written by:** Cloud Functions only. **Read by:** conversation members (Firestore rules).

### 4.2 GameSessionsV4/{sessionId}

| Field                                    | Type                                                                 | Description                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `sessionId`                              | string                                                               | Same as doc ID                                                                                                |
| `inviteId`                               | string                                                               | Back-reference                                                                                                |
| `conversationId` / `conversationScope`   | string                                                               | For rules/queries                                                                                             |
| `gameId` / `runtimeType`                 |                                                                      |                                                                                                               |
| `status`                                 | `"lobby_open" \| "active" \| "resolved" \| "abandoned" \| "expired"` |                                                                                                               |
| `hostId`                                 | string                                                               |                                                                                                               |
| `players`                                | PlayerSlot[]                                                         | `{ uid, slotIndex, teamId?, displayName?, avatarConfig?, profilePictureUrl? }`                                |
| `spectators`                             | SpectatorSlot[]                                                      | `{ uid, joinedAt }`                                                                                           |
| `spectatorsAllowed` / `spectateMode`     |                                                                      |                                                                                                               |
| `settings`                               | Record                                                               | Game-specific, immutable after start                                                                          |
| `turnOrder`                              | string[]                                                             | UIDs (turn-based only)                                                                                        |
| `currentTurnIndex`                       | number                                                               |                                                                                                               |
| `currentTurnPlayerId`                    | string \| null                                                       |                                                                                                               |
| `scoreboardSummary`                      | ScoreSummaryEntry[]                                                  |                                                                                                               |
| `integrity`                              | IntegrityEnvelope                                                    | `{ version, schemaVersion, traceId }`                                                                         |
| `rewardsProcessed`                       | boolean                                                              |                                                                                                               |
| `participantUids`                        | string[]                                                             | Flat array for rules/queries                                                                                  |
| `spectatorUids`                          | string[]                                                             |                                                                                                               |
| `soloSuspendedAt`                        | Timestamp \| null                                                    | Solo-only. Set when player suspends via back arrow; cleared on resume. `null` = actively playing or not solo. |
| `resolution`                             | SessionResolution \| null                                            | `{ type, winnerIds, reason? }`                                                                                |
| `createdAt` / `startedAt` / `resolvedAt` | Timestamp                                                            |                                                                                                               |

**Subcollections:**

| Sub                  | Doc ID           | Written by                    | Read by              |
| -------------------- | ---------------- | ----------------------------- | -------------------- |
| `PublicState/state`  | Static `"state"` | Cloud Fns                     | Conversation members |
| `PrivateState/{uid}` | Player UID       | Cloud Fns                     | Owner uid only       |
| `Moves/{moveId}`     | Auto-ID          | Client (create) + CF (update) | Conversation members |

### 4.3 GameResultsV4/{sessionId}

| Field                                               | Type                   |
| --------------------------------------------------- | ---------------------- |
| `sessionId`, `inviteId`, `conversationId`, `gameId` | string                 |
| `resolutionType`                                    | ResolutionType         |
| `winnerIds`                                         | string[]               |
| `scoreboard`                                        | FinalScoreboardEntry[] |
| `xpAwards`                                          | XPAward[]              |
| `achievementUnlocks`                                | AchievementUnlock[]    |
| `leaderboardUpdates`                                | LeaderboardUpdate[]    |
| `durationMs`                                        | number                 |
| `totalMoves`                                        | number                 |
| `participantIds`                                    | string[]               |
| `performanceMetrics`                                | Record                 |
| `createdAt`                                         | Timestamp              |

**Written by:** `resolveSessionV4Internal` only. **Read by:** participants.

### 4.4 Users/{uid}/GamePB/{gameId}

| Field                      | Type   | Notes                                   |
| -------------------------- | ------ | --------------------------------------- |
| `pbValue`                  | number | Best score ever                         |
| `pbMeta`                   | Record | Game-specific context                   |
| `integrityHash`            | string | SHA-256(`uid:gameId:pbValue:sessionId`) |
| `sessionId`                | string | Session that produced this PB           |
| `totalPlays` / `totalWins` | number | Lifetime counters                       |
| `schemaVersion`            | 1      |                                         |

**Written by:** Cloud Functions only. **Read by:** owner only.

### 4.5 LeaderboardsV4/{gameId}/Weeks/{weekKey}/Entries/{uid}

| Field                | Type               |
| -------------------- | ------------------ |
| `uid`, `displayName` | string             |
| `score`              | number (max-merge) |
| `updatedAt`          | Timestamp          |

**Written by:** Cloud Functions. **Read by:** any authenticated user.

### 4.6 Other subcollections

| Collection                                    | Purpose                                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `Users/{uid}/Achievements/{type}`             | Earned achievements (18 types)                                                                                                               |
| `Users/{uid}/AchievementSections/{sectionId}` | Claimed section badges (4 sections: tic_tac_toe, connect_four, play_2048, milestones). Written by `claimAchievementSectionBadgeV4` callable. |
| `Users/{uid}/UserStatsCache/stats`            | `{ gamesPlayed, gamesWon }`                                                                                                                  |
| `Users/{uid}/RateLimits/{action}`             | Transactional cooldown timestamps                                                                                                            |
| `Users/{uid}/GamePresence/{docId}`            | Client-written active session presence                                                                                                       |

### 4.7 Nested Array Serialization

Firestore does not support nested arrays (e.g. a 3×3 board `[["X",null,"O"],[...],...]`). All game state with 2D arrays passes through a serialization layer:

**Server** (`firebase-backend/functions/src/gamesV4/adapters.ts`):

- `serializeStateForFirestore(state)` — converts 2D arrays to `{ _nestedArray: true, length: N, "0": [...], "1": [...] }`
- `deserializeStateFromFirestore(state)` — reverses the encoding

**Client** (`src/gamesV4/services/gameServiceV4.ts`):

- `deserializeStateFromFirestore()` — same inverse function, applied when reading `PublicState/state` via `subscribeToPublicState()`

Both functions are idempotent — applying them to already-serialized/deserialized data is a no-op.

### 4.8 Solo Session Special Case

Solo games bypass the invite system entirely. When `createSoloSessionV4` is called:

- `inviteId` is set to `""` (empty string)
- `conversationId` is set to `""`
- No invite doc is created, no pin is written
- The session goes directly to `status: "active"`

### 4.9 Query Patterns

| Query                         | Collection                 | Filters                                                               | Index Required? |
| ----------------------------- | -------------------------- | --------------------------------------------------------------------- | --------------- |
| Invites for a conversation    | `GameInvitesV4`            | `conversationId` + `status in [sent,lobby,active]`                    | Yes (composite) |
| My active invites (Games Hub) | `GameInvitesV4`            | `participantIds array-contains uid` + `status in [sent,lobby,active]` | Yes (composite) |
| Watchdog: stale lobbies       | `GameInvitesV4`            | `status in [sent,lobby]` + `createdAt < threshold`                    | Yes (composite) |
| Watchdog: resolved past TTL   | `GameInvitesV4`            | `status == "resolved"` + `deleteAt <= now`                            | Yes (composite) |
| Watchdog: reward retry        | `GameSessionsV4`           | `status == "resolved"` + `rewardsProcessed == false`                  | Yes (composite) |
| Watchdog: inactive sessions   | `GameSessionsV4`           | `status == "active"` + `createdAt < threshold`                        | Yes (composite) |
| Player game history           | `GameResultsV4`            | `participantIds array-contains uid`, orderBy `createdAt desc`         | Yes (composite) |
| Weekly leaderboard            | `LeaderboardsV4/…/Entries` | orderBy `score desc`, limit 50                                        | Yes (composite) |

---

## 5. State Machines

### 5.1 Invite Lifecycle

```
          ┌────────────────────────────────────────┐
          │            createGameInviteV4           │
          └──────────────┬─────────────────────────┘
                         ▼
                    ┌─────────┐
                    │  sent   │ (pinned to chat)
                    └────┬────┘
           player joins  │  host cancels (cancelGameInviteV4)
            (joinLobby)  │  OR no joins within 24h (watchdog)
                 │       │
                 ▼       │
            ┌─────────┐│
     ┌──── │  lobby  │ ◀─── more players join / spectators join
     │      └────┬────┘     non-host can leaveInviteLobbyV4
     │           │ host calls startGameFromInviteV4
     │           ▼
     │      ┌──────────┐
     │      │  active  │ (session running)
     │      └────┬─────┘
     │           │ game ends (win/draw/resign/timeout)
     ▼           ▼
  ┌──────────────────┐
  │     resolved     │ (terminal)
  └────────┬─────────┘
           │ deleteAt TTL (1 hour)
           ▼
  ┌──────────────────┐
  │   hard-deleted   │ (by watchdog Pass 2 OR Firestore TTL)
  └──────────────────┘
```

**Permitted transitions:** `sent → [lobby, resolved]`, `lobby → [active, resolved]`, `active → [resolved]`, `resolved → []` (terminal).

**Forbidden transitions:** `resolved → *`, `active → sent`, `active → lobby`, `lobby → sent`. All enforced by `canTransitionInviteStatus()` in `src/gamesV4/types/invite.ts`.

### 5.2 Session Lifecycle

```
                    Multiplayer                              Solo
          startGameFromInviteV4                  createSoloSessionV4
                  │                                       │
                  ▼                                       │
           ┌─────────────┐                                │
           │  lobby_open  │ (NOT used by solo)             │
           └──────┬───────┘                                │
                  │ game started                            │
                  ▼                                       ▼
           ┌─────────────┐
           │    active    │ ◀── moves applied here
           └──────┬───────┘
                  │
        ┌─────────┼─────────────┐
        ▼         ▼             ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ resolved │ │ abandoned│ │ expired  │
   └──────────┘ └──────────┘ └──────────┘
   (normal end)  (all left)   (watchdog 7d)
```

**Terminal statuses:** `resolved`, `abandoned`, `expired`. Once terminal, no further writes except `rewardsProcessed` flag.

### 5.3 Turn Lifecycle (turn-based games)

```
  1. Client calls submitTurnMoveV4(sessionId, movePayload)
  2. Server rate-limit check (500ms cooldown)
  3. Transaction:
     a. Verify: session active, caller == currentTurnPlayerId
     b. If adapter exists: runMove() — authoritative validation
     c. If no adapter: accept move, use client hints for terminal
     d. Write MoveDoc (status: "committed")
     e. Update PublicState/state
     f. Advance currentTurnIndex, update currentTurnPlayerId
     g. Increment integrity.version
     h. Update invite summary
  4. If terminal → resolveSessionV4Internal()
  5. If not terminal → notifyTurn() to next player
```

### 5.4 Deletion Lifecycle

```
  resolveSessionV4Internal:
    invite.status → "resolved"
    invite.deleteRequestedAt → now
    invite.deleteAt → now + RESOLVED_INVITE_TTL_MS (1 hr)
    unpins invite from conversation

  watchdogGamesV4 (every 30 min):
    Pass 2: WHERE status=="resolved" AND deleteAt <= now → hard delete

  onGameInviteV4Deleted trigger:
    arrayRemove(pinnedGameInviteIds, inviteId) — safety net
```

---

## 6. End-to-End Flows

### 6.1 Create Invite in Chat

1. User taps gamepad button in `ChatComposer` → `GamePickerModal` opens
2. User picks a game → `handleGameSelected(gameId)` in `GroupChatScreen` / `ChatScreen`
3. Client calls `createGameInvite({ conversationId, conversationScope, gameId })`
4. **Server** (`createGameInviteV4`):
   - `assertAuth()` + `assertConversationMember()` + `enforceCooldown(3s)`
   - Creates `GameInvitesV4/{inviteId}` doc
   - Atomically appends `inviteId` to conversation's `pinnedGameInviteIds[]` (FIFO, max 5)
   - Fires `notifyInviteCreated()` to all conversation members (except creator)
5. `PinnedInviteBar` receives the new invite via `usePinnedInvites()` → renders chip

### 6.2 Lobby Join & Start

1. User taps invite chip → navigates to `GameLobbyV4` with `{ inviteId }`
2. `useGameLobbyV4(inviteId)` subscribes to invite doc
3. User taps "Join" → `joinInviteLobby({ inviteId })` → server transitions `sent → lobby`, adds UID to `participantIds`
4. Host taps "Start Game" → `startGameFromInvite({ inviteId })`:
   - Server creates `GameSessionsV4/{sessionId}` with initial state from adapter
   - Writes `PublicState/state` + `PrivateState/{uid}` subcollections
   - Transitions invite `sent|lobby → active`
   - Sets `invite.sessionId`
5. `useGameLobbyV4` detects `navReady` (session exists + active) → auto-navigates to `GamePlayV4`

### 6.3 Turn-based Move Apply

1. Game UI (e.g., `TicTacToeScreenV4`) calls `submitMove(payload)` from `GameShellProps`
2. `GameScreenShell.handleSubmitMove()`:
   - **Optimistic:** calls `getAdapter(gameId).validateMove()` locally for instant UI feedback
   - Calls `submitTurnMove({ sessionId, movePayload })` to server
3. Server validates authoritatively (see §5.3 Turn Lifecycle)
4. Firestore listeners update all clients in real time

### 6.4 Leave / Minimize / Resume

- **Minimize (app background):** Firestore listeners survive; state is current on return
- **Leave screen (navigate away):** `useGameSessionV4` unsubs; re-entering via invite chip or deep link re-subscribes
- **Android back button behavior by runtime type:**
  - **Turn-based:** Non-destructive leave — navigates back, session stays active. User can rejoin via invite chip, deep link, or notification.
  - **Solo:** Non-destructive suspend — calls the game's registered pause callback (if any), marks the session as suspended (`soloSuspendedAt`), and navigates away. The session remains `status: "active"` and is **not resigned**. The game can be resumed later from the Games Hub.
  - **Realtime:** Destructive — shows resign confirmation alert, does NOT navigate back without confirmation.
- **Solo suspend/resume model:**
  - The solo back arrow (overlay, top-left) triggers suspend: pauses local game loops, calls `suspendSoloSessionV4` to set `soloSuspendedAt`, then navigates away
  - The solo game's `PublicState/state` persists the full game state in Firestore — no separate save file
  - Reopening from Games Hub calls `resumeOrCreateSoloSessionV4`, which finds the existing active session and clears `soloSuspendedAt`
  - Games with continuous animation loops (e.g. Brick Breaker) register a pause callback via `registerSoloPause` and must reopen in a paused state when resuming
  - Games that are purely input-driven (e.g. 2048, Minesweeper) require no special pause handling — their state is already fully persisted
- **Solo overlay controls:**
  - Top-left: overlay back arrow (suspend & leave)
  - Top-right: overlay menu button (options: Restart Game, Resign)
  - Both are absolutely positioned with high z-index, safe-area-aware, and do NOT cause layout shift
  - The old solo "Quit" button is removed; resign is now inside the menu
- **Resume (multiplayer):** Tapping a pinned invite chip or push notification deep link routes to `GamePlayV4` (active) or `GameLobbyV4` (lobby)
- **Resume (solo):** Tapping the same solo game in the Games Hub detects the existing unresolved session and reopens it

### 6.5 Spectator Join (Turn-based)

1. User taps "Watch" in lobby → `joinInviteLobby({ inviteId, asSpectator: true })`
2. Server adds UID to `spectatorIds` / `spectatorUids`
3. Spectator subscribes to `PublicState/state` — sees full public state
4. Adapter's `getSpectatorView()` can filter sensitive info (default: returns full public state)
5. **Spectators cannot submit moves** — Firestore rules require `uid in participantUids` for Move creation

### 6.6 Resolve → End Screen → Invite Deletion

1. Terminal move detected → `resolveSessionV4Internal()` executes 10 phases:
   - **Phase 1:** Transaction — session status → `"resolved"`, writes `resolvedAt` and `resolution`
   - **Phase 2:** Invite → `"resolved"` (sets `deleteRequestedAt`, `deleteAt` = now + 1h TTL). Skipped for solo sessions
   - **Phase 3:** Computes: `durationMs`, `totalMoves`, `scoreboard`, `xpAwards`, `achievementUnlocks` (via `evaluateAchievementsV4`), `leaderboardUpdates`
   - **Phase 4:** Writes `GameResultV4` doc
   - **Phase 5:** Applies XP to `Users/{uid}` — reads current level, computes level-ups. Increments `UserStatsCache/stats`
   - **Phase 6:** Leaderboard updates — `Math.max(existing, new)` score merge
   - **Phase 7:** Personal bests — only updates if `newScore > currentPB`; always increments `totalPlays`/`totalWins`
   - **Phase 8:** Unpins invite from conversation (skipped for solo)
   - **Phase 9:** Sets `rewardsProcessed: true` on session
   - **Phase 10:** Sends resolved notifications (best-effort)
2. `GameScreenShell` detects `isTerminal` → waits 1500ms → navigates to `GameOverV4`
3. `GameOverScreenV4` subscribes to `GameResultsV4/{sessionId}`:
   - Shows winner/draw announcement, ranked scoreboard with medals (🥇🥈🥉)
   - Shows XP earned, achievements unlocked
   - Actions: "Back to Chat" / "Back to Games" (solo) / "Leaderboard" / "My Stats"
4. Invite `deleteAt` set to `now + 1 hour`; watchdog hard-deletes after TTL
5. `onGameInviteV4Deleted` trigger unpins from conversation (safety net)

### 6.7 Solo Game Launch (from Games Hub)

Solo games bypass the invite/lobby system entirely:

1. User taps a solo game (e.g., 2048) in `GamesHubScreenV4`
2. Client calls `resumeOrCreateSoloSession({ gameId: "play_2048" })`
3. **Server** (`resumeOrCreateSoloSessionV4`):
   - `assertAuth()`
   - Queries for an existing active solo session for this user + gameId
   - **If found:** clears `soloSuspendedAt`, returns `{ sessionId, resumed: true }`
   - **If not found:** enforces cooldown, validates adapter, creates new session (same as `createSoloSessionV4`), returns `{ sessionId, resumed: false }`
4. Returns `{ sessionId, resumed }` → client navigates to `GamePlayV4` with `{ sessionId, gameId }`
5. `GameScreenShell` opens → writes `GamePresence` doc → game begins (or resumes from saved state)

**Solo restart flow:**

1. Player taps menu button (top-right overlay) → taps "Restart Game" → confirms
2. Client calls `restartSoloSession({ sessionId })`
3. **Server** (`restartSoloSessionV4`):
   - Resolves old session via `resolveSessionV4Internal` (resign)
   - Creates a fresh solo session for the same game
4. Client replaces the current GamePlayV4 screen with the new session

**Solo suspend flow:**

1. Player taps back arrow (top-left overlay) or presses Android back
2. Shell calls registered pause callback (freezes animation loops for motion games)
3. Client calls `suspendSoloSession({ sessionId })` (fire-and-forget)
4. Server sets `soloSuspendedAt` timestamp on the session doc
5. Client navigates away — session remains `status: "active"`, state is preserved

### 6.8 Cancel Invite (Host Only)

1. Host taps "Cancel" in `GameLobbyScreenV4` → `cancelGameInvite({ inviteId })`
2. **Server** (`cancelGameInviteV4`):
   - `assertAuth()` + `enforceCooldown(2s)` + verifies host
   - Transaction: invite must be `"sent"` or `"lobby"` → status `"resolved"`, sets `deleteRequestedAt` + `deleteAt` (now + 1h)
   - Post-transaction: `unpinInviteFromConversation()` (best-effort)
3. All lobby subscribers see status → `"resolved"` → lobby screen shows "Invite Cancelled" alert → `navigation.goBack()`
4. Watchdog Pass 2 hard-deletes the invite doc after TTL

### 6.9 Leave Lobby (Non-host)

1. Non-host player/spectator taps "Leave" → `leaveInviteLobby({ inviteId })`
2. **Server** (`leaveInviteLobbyV4`):
   - `assertAuth()` + `enforceCooldown(2s)`
   - Verifies invite is `"sent"` or `"lobby"` and caller is NOT the host (host must cancel instead)
   - Transaction: removes UID from `participantIds`/`spectatorIds` and corresponding summaries
3. If caller was not in the lobby, returns silently (idempotent)

---

## 7. Runtime Types

### 7.1 Solo

| Property         | Value                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| Players          | 1                                                                                   |
| State authority  | Server (adapter validates each move)                                                |
| Turn switching   | N/A (`turnAdvance: false` always)                                                   |
| Spectating       | **Not supported** (`supportsSpectate: false`)                                       |
| Invite system    | **Bypassed** — uses `resumeOrCreateSoloSessionV4` (no invite/lobby/pin)             |
| Suspend/resume   | **Supported** — back arrow suspends without resigning, hub resumes existing session |
| Overlay controls | Back arrow (top-left) + menu button (top-right), both absolute-positioned overlays  |
| Menu actions     | Restart Game, Resign                                                                |
| Example          | `play_2048`, `brick_breaker`, `minesweeper`                                         |

**Flow:** User taps solo game in Games Hub → `resumeOrCreateSoloSessionV4` finds existing or creates new → player interacts → `submitTurnMoveV4` → adapter validates → terminal when game ends.

**Exit model:**

- Back arrow (top-left overlay): suspends session, navigates away without resigning. Session stays active and resumable.
- Menu button (top-right overlay): opens modal with "Restart Game" and "Resign" options.
- Android back button: same as back arrow — suspend and leave.
- Games with animation loops (Brick Breaker) must register a pause callback via `registerSoloPause` in `GameShellProps` and reopen paused when resumed.
- Input-driven games (2048, Minesweeper) need no special pause handling.

**Important:** Solo games do NOT create invites and do NOT appear in the pinned invite bar. They are launched exclusively from `GamesHubScreenV4` via `createSoloSession()` in `gameServiceV4.ts`, which calls the `createSoloSessionV4` Cloud Function (`firebase-backend/functions/src/gamesV4/solo.ts`).

The 2048 adapter uses **deterministic "randomness"** — new tile position = `moveCount % emptyCells.length`, value = 4 when `moveCount % 10 === 7`, else 2. This ensures client and server produce identical state without true randomness.

### 7.2 Turn-based (Firestore)

| Property        | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Players         | 2–8                                                                   |
| State authority | Server (adapter validates moves in transaction)                       |
| Turn switching  | `currentTurnIndex` cycles through `turnOrder[]`                       |
| Spectating      | **Supported** (reads `PublicState`, filtered by `getSpectatorView()`) |
| Examples        | `tic_tac_toe`, `connect_four`                                         |

**Flow:** Player submits move → server validates via adapter → writes new public state → advances turn → notifies next player.

### 7.3 Realtime (Colyseus) — Planned

| Property           | Value                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Players            | 2–8                                                                                                    |
| State authority    | Colyseus room (not yet implemented)                                                                    |
| Turn switching     | N/A (continuous)                                                                                       |
| Spectating         | **Not supported** — realtime physics games cannot meaningfully spectate without full state replication |
| Examples (planned) | `pong_game`, `battleship`, `sketch_party_game`, `starforge_game`                                       |

**Current state:** The `resolveRealtimeSessionV4` bridge function exists in `sessions.ts` as a stub. The `colyseus-server/` directory does **not exist** yet. Realtime games are listed in metadata but show "Coming Soon" in the Games Hub.

**Spectating enforcement:**

- `GAME_METADATA` in `constants.ts` sets `supportsSpectate: false` for all realtime games
- `createGameInviteV4` copies `supportsSpectate` into `invite.allowSpectators`
- `joinInviteLobbyV4` rejects `asSpectator: true` when `allowSpectators === false`

---

## 8. Real-time Invite Card Updates

### Summary fields on invite doc

```typescript
interface InviteSummary {
  phase: "lobby" | "active" | "resolved";
  turnPlayerId: string | null;
  scoreSummary: ScoreSummaryEntry[]; // { uid, displayName, score }
  lastMoveAt: TimestampLike | null;
  lastActorId: string | null;
}
```

### When summaries are updated

| Event               | Who writes                 | Fields changed                                                                              |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| Player joins lobby  | `joinInviteLobbyV4`        | `participantIds`, `updatedAt`                                                               |
| Game starts         | `startGameFromInviteV4`    | `summary.phase → "active"`, `sessionId`                                                     |
| Turn move committed | `submitTurnMoveV4`         | `summary.turnPlayerId`, `summary.scoreSummary`, `summary.lastMoveAt`, `summary.lastActorId` |
| Game resolved       | `resolveSessionV4Internal` | `summary.phase → "resolved"`, `status → "resolved"`                                         |

### Throttling / write-storm prevention

- **Rate limits per action:** `submitTurnMoveV4` has a 500ms cooldown enforced via `enforceCooldown()` (transactional check-and-set on `Users/{uid}/RateLimits/submitMoveV4`)
- **Summary updates are piggy-backed** on the move transaction — no separate write
- **No client writes to invites** — all summary updates happen inside server transactions
- **Lobby join:** 2s cooldown. **Start game:** 2s cooldown. **Create invite:** 3s cooldown

### Client rendering

`PinnedInviteBar` in `src/gamesV4/components/PinnedInviteBar.tsx`:

- Subscribes via `usePinnedInvites()` → first to `pinnedGameInviteIds[]`, then individual invite docs
- Displays: game icon + name + status chip (`waiting` / `your_turn` / `active` / `resolved`)
- "Your Turn" chip gets orange border highlight
- Tap routes to appropriate screen based on `invite.status`

---

## 9. Rewards & Integrity

### 9.1 XP Calculation

Defined in `XP_CONFIG` (`src/gamesV4/constants.ts` and `firebase-backend/functions/src/gamesV4/types.ts`):

| Component          | Value           | Condition                      |
| ------------------ | --------------- | ------------------------------ |
| Base participation | 10 XP           | Always awarded                 |
| Win bonus          | 15 XP           | `winnerIds.includes(uid)`      |
| Draw bonus         | 5 XP            | `resolutionType === "draw"`    |
| Performance bonus  | Up to 10 XP     | Reserved (not yet implemented) |
| Solo games         | 10 XP base only | No win/draw bonus              |

**Level-up formula:** `levelXpThreshold(N) = floor(100 × 1.2^(N−1))`

XP is applied via `FieldValue.increment` on `Users/{uid}.level.{xp, totalXp}`. Level-up is computed server-side by reading current level, iterating thresholds, and writing new level + xpToNextLevel.

**ACCEPTED-RISK N3:** Concurrent resolution of two games for the same user could produce slightly inaccurate XP (increment is last-write-wins). Impact is negligible for MVP.

### 9.1b Level Cap & Level Rewards V4

#### Level Cap

- Max level: **50** (enforced server-side in `applyXPAwards()` in `resolve.ts`)
- `Users/{uid}.level.current` is clamped to 50
- At level 50: XP bar shows "MAX LEVEL", `xpToNextLevel` equals threshold for display
- `totalXp` continues to accumulate even at level cap

#### Level Rewards — Static Definitions

Defined in `firebase-backend/functions/src/gamesV4/levelRewardsV4.ts` → `LEVEL_REWARDS_V4` array (levels 1–50).

| Level Range                     | Token Reward | Cosmetic                 | Type       |
| ------------------------------- | ------------ | ------------------------ | ---------- |
| Non-milestone (1,2,3,4,6,7,...) | 50 tokens    | None                     | `tokens`   |
| Milestone 5                     | 100 tokens   | `bg_circling_waves`      | Background |
| Milestone 10                    | 200 tokens   | `bg_aurora_borealis`     | Background |
| Milestone 15                    | 300 tokens   | `badge_level_15`         | Badge      |
| Milestone 20                    | 400 tokens   | `bg_rune_circles`        | Background |
| Milestone 25                    | 500 tokens   | `badge_level_25`         | Badge      |
| Milestone 30                    | 600 tokens   | `bg_synthwave`           | Background |
| Milestone 35                    | 700 tokens   | `badge_level_35`         | Badge      |
| Milestone 40                    | 800 tokens   | `dec_golden_crown`       | Decoration |
| Milestone 45                    | 900 tokens   | `badge_level_45`         | Badge      |
| Milestone 50                    | 1000 tokens  | `bg_synthwave_videogame` | Background |

Client catalog mirror: `src/data/levelRewards.ts` → `LEVEL_REWARDS`.

#### Level Rewards — Dynamic State

Path: `Users/{uid}/LevelRewardsV4/{level}`

| Field            | Type                | Description                     |
| ---------------- | ------------------- | ------------------------------- |
| `level`          | `number`            | 1-based level                   |
| `unlockedAt`     | `Timestamp`         | When the reward was unlocked    |
| `claimedAt`      | `Timestamp \| null` | When claimed (null = unclaimed) |
| `tokenReward`    | `number`            | Tokens to grant on claim        |
| `cosmeticItemId` | `string \| null`    | Cosmetic ID for milestones      |
| `schemaVersion`  | `number`            | Always 1                        |

**Firestore rules:** Owner can read. All writes are Cloud Function–only (`allow create, update, delete: if false`).

#### Unlock Flow

1. `resolveSessionV4Internal()` → `applyXPAwards()` computes new level (capped at 50)
2. After XP batch commit, if `award.levelUp` exists → `unlockLevelRewards(db, uid, oldLevel, newLevel)`
3. For each level `L` in `(oldLevel+1)..newLevel`: creates `LevelRewardsV4/{L}` doc with `claimedAt: null`
4. Idempotent: skips levels that already have docs

#### Claim Flow

Callable: `claimLevelRewardV4({ level })` in `firebase-backend/functions/src/gamesV4/levelRewardsV4.ts`

1. Validates auth, level range (1–50), user level ≥ requested level
2. Checks reward doc exists and `claimedAt == null`
3. Atomically in a batch:
   - Increments `Wallets/{uid}.tokensBalance` by `tokenReward`
   - Creates `Users/{uid}/Entitlements/{cosmeticItemId}` (if milestone)
   - Sets `claimedAt = now` on the reward doc
4. Idempotent: if already claimed, returns `{ success: true, alreadyClaimed: true }`

#### LevelRewardsScreen UI — Battlepass Tier Track

Route: `LevelRewards` (no params). Entry points:

- **Games Hub** → "Level & Rewards" card with level badge, XP bar (`50/250`), unclaimed count, "View Rewards" tap
- `GameOverScreenV4` → "Claim Reward" button on level-up callout
- `OwnProfileScreen` → `onLevelPress` navigates to `"LevelRewards"`

**Components:**

| Component            | File                                           | Purpose                                    |
| -------------------- | ---------------------------------------------- | ------------------------------------------ |
| `LevelRewardsScreen` | `src/gamesV4/screens/LevelRewardsScreen.tsx`   | Full-screen: header + track + stats        |
| `LevelRewardsTrack`  | `src/gamesV4/components/LevelRewardsTrack.tsx` | Horizontal battlepass rail with tier nodes |
| `TierDetailsSheet`   | `src/gamesV4/components/TierDetailsSheet.tsx`  | Bottom sheet for tier details + claim      |

**Battlepass Track features:**

- Horizontal scrollable `FlatList` showing **all 50 levels** as tier nodes on a progress rail
- Progress rail fills up to current level, partial fill between current and next based on XP ratio
- Tier node states: **Locked** (grey), **Unlocked** (blue, unclaimed dot), **Claimed** (green checkmark)
- Milestone tiers (every 5 levels) are larger with gold border/glow and cosmetic icon
- Current level highlighted with gold ring
- "Jump to current level" button scrolls track to user's position
- Tapping any tier opens `TierDetailsSheet` with reward breakdown and claim button

**Tier Details Sheet:**

- Modal bottom sheet showing: Level title, status, rewards (tokens + cosmetic if milestone)
- Claim button for unlocked/unclaimed tiers (calls `claimLevelRewardV4`)
- "Claimed" confirmation for already-claimed tiers
- "Locked" message with required level for future tiers

**XP Display format:**

- Level number: "Level 12" (or "Level 50 (MAX)")
- XP progress: `50/250 XP` (currentXP / xpToNextLevel)
- XP remaining: "200 XP to next level"
- Percentage: "20%"
- At MAX: `250/250 XP`, no "to next" text

**Claim All:** Banner with unclaimed count + "Claim All" button (sequential server calls, continues on individual failure)

**Stats summary:** Claimed, Unclaimed, Remaining, Level progress

### 9.2 Achievements

18 achievement definitions in `firebase-backend/functions/src/gamesV4/achievements.ts`, organized into **6 sections** with **difficulty ranks** and **token rewards**:

#### Achievement Sections

| Section ID        | Title           | Achievements count | Badge awarded on completion                |
| ----------------- | --------------- | ------------------ | ------------------------------------------ |
| `getting_started` | Getting Started | 2                  | Yes (via `claimAchievementSectionBadgeV4`) |
| `grinder`         | Grinder         | 6                  | Yes                                        |
| `game_mastery`    | Game Mastery    | 3                  | Yes                                        |
| `speedster`       | Speedster       | 2                  | Yes                                        |
| `champion`        | Champion        | 3                  | Yes                                        |
| `puzzle_master`   | Puzzle Master   | 2                  | Yes                                        |

#### Difficulty Ranks & Token Rewards

Token rewards vary per achievement (not fixed by difficulty). Typical ranges shown below.

| Difficulty  | Typical Range | UI Color (client) |
| ----------- | ------------- | ----------------- |
| `easy`      | 5–10 tokens   | #34C759 (green)   |
| `medium`    | 15–25 tokens  | #FF9500 (orange)  |
| `hard`      | 30–50 tokens  | #FF3B30 (red)     |
| `expert`    | 50 tokens     | #AF52DE (purple)  |
| `legendary` | 100 tokens    | #FFD700 (gold)    |

#### Achievement Catalog

| Category              | Achievements                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Milestone — Plays** | `game_first_play` (1), `game_10_sessions` (10), `game_50_sessions` (50), `game_100_sessions` (100), `game_250_sessions` (250) |
| **Milestone — Wins**  | `game_first_win` (1), `game_10_wins` (10), `game_50_wins` (50)                                                                |
| **Per-game mastery**  | `game_mastery_10` (10 plays of one game), `game_mastery_50`, `game_mastery_win_streak_5`                                      |
| **Performance**       | `game_speed_demon` (<30s win), `game_lightning_round` (<60s win), `game_flawless_victory` (opponent scores 0)                 |
| **Game-specific**     | `ttt_perfect_game` (TTT ≤5 moves), `c4_quick_connect` (C4 ≤7 moves), `2048_reached_2048`, `2048_reached_4096`                 |

**Evaluation:** Called by `resolveSessionV4Internal` → `evaluateAchievementsV4()`. Counters are pre-incremented by +1 before evaluation so milestones fire on the correct game. Idempotent — skips already-earned achievements. **Token rewards** are applied via `FieldValue.increment` on `Wallets/{uid}.tokensBalance`.

#### Section Badge Claiming

When a player earns all achievements in a section, they can claim the section badge via `claimAchievementSectionBadgeV4` callable:

1. Server reads all `Achievements/{type}` docs for the section
2. Verifies all required achievements are earned
3. Writes `AchievementSections/{sectionId}` (with `claimedAt` timestamp) and `Badges/{badgeId}` in a single batch
4. Idempotent — re-claiming an already-claimed section returns success with no side effects

**Client wrappers:** `claimAchievementSectionBadge()`, `subscribeToAchievements()`, `subscribeToAchievementSections()` in `src/gamesV4/services/gameServiceV4.ts`.

**Client definitions:** `src/gamesV4/data/achievementDefinitions.ts` mirrors backend section/achievement metadata for UI rendering (sections, difficulties, display names, colors).

### 9.3 Leaderboards

- **Scope:** Per-game, per-ISO-week (`"YYYY-WNN"`)
- **Path:** `LeaderboardsV4/{gameId}/Weeks/{weekKey}/Entries/{uid}`
- **Client:** `useLeaderboardV4(gameId)` → live subscription sorted by score desc

#### Metric-Driven Scoring (Backend)

Leaderboard score computation is **descriptor-driven** per game, defined in `firebase-backend/functions/src/gamesV4/types.ts` → `LEADERBOARD_METRICS`:

| Game           | Metric        | Score Computation                                    |
| -------------- | ------------- | ---------------------------------------------------- |
| `tic_tac_toe`  | `"wins"`      | Increments by 1 on each win (cumulative)             |
| `connect_four` | `"wins"`      | Increments by 1 on each win (cumulative)             |
| `play_2048`    | `"bestScore"` | `Math.max(existingScore, matchScore)` — running best |
| Default        | `"bestScore"` | `Math.max(existingScore, matchScore)`                |

For **wins-based** games, the leaderboard `score` field accumulates total wins per week. Losers/draws do not increment.

For **bestScore-based** games, the leaderboard `score` field is a running max of match scores.

#### Client Descriptors

Defined in `src/gamesV4/constants.ts` → `LEADERBOARD_DESCRIPTORS`:

| Game           | Label        | Format               | Sort |
| -------------- | ------------ | -------------------- | ---- |
| `tic_tac_toe`  | "Wins"       | `"X win(s)"`         | desc |
| `connect_four` | "Wins"       | `"X win(s)"`         | desc |
| `play_2048`    | "Best Score" | `X.toLocaleString()` | desc |

#### Friends Leaderboard

Implemented in `src/gamesV4/services/gameServiceV4.ts` → `fetchFriendsLeaderboard()`.

**Client-side** N+1 query (capped at 20 friends):

1. Reads each friend's `Users/{fuid}/GamePB/{gameId}`
2. For **wins-based** games: reads `totalWins` field
3. For **bestScore-based** games: reads `pbValue` field
4. Sorts descending, resolves display names via profile cache

The metric selection is driven by `LEADERBOARD_DESCRIPTORS[gameId].metric`.

**Troubleshooting:**

- If friends scores show 0: check `GamePB/{gameId}` doc exists and has `totalWins` > 0 (for wins games)
- If global shows correct but friends wrong: might be a stale PB doc vs fresh leaderboard entry
- Indexes: no composite index needed (single-doc reads per friend)

### 9.4 PB vs Non-PB Anti-forgery

| Aspect              | Personal Best (PB)                                                                     | Game History                |
| ------------------- | -------------------------------------------------------------------------------------- | --------------------------- |
| Storage             | `Users/{uid}/GamePB/{gameId}`                                                          | `GameResultsV4/{sessionId}` |
| Who writes          | **Cloud Functions only**                                                               | **Cloud Functions only**    |
| Client writable     | **Never** (Firestore rules: `allow write: if false`)                                   | **Never**                   |
| Integrity           | SHA-256 hash: `uid:gameId:pbValue:sessionId`                                           | N/A                         |
| Source of truth     | Server session resolution                                                              | Server session resolution   |
| References history? | **Never** — PB is computed solely from the current session's scoreboard vs existing PB | N/A                         |
| Local storage       | **None**                                                                               | **None**                    |

There is **no local history storage module**. All game history lives in `GameResultsV4` (server-only). The client reads history via `fetchGameHistory(uid)`.

PBs are written in `resolve.ts → updatePersonalBests()`:

```
if (newScore > existingPB) {
  hash = SHA256("uid:gameId:score:sessionId")
  write { pbValue, integrityHash, ... }
}
// Always increment totalPlays (and totalWins if placement === 1)
```

---

## 10. Notifications

### 10.1 Notification Types & Payloads

Defined in `src/gamesV4/types/notification.ts` and dispatched in `firebase-backend/functions/src/gamesV4/notifications.ts`.

| Type                  | Trigger            | Recipients                        | Push data.type  |
| --------------------- | ------------------ | --------------------------------- | --------------- |
| `GAME_INVITE_CREATED` | Invite created     | All conv members except creator   | `game_invite`   |
| `GAME_TURN`           | Turn advances      | Next turn player (if not in-game) | `game_turn`     |
| `GAME_RESOLVED`       | Game ends          | All participants except resolver  | `game_resolved` |
| `GAME_LOBBY_JOIN`     | Player joins lobby | Host only (not joiner)            | (lobby update)  |

### 10.2 Dedupe / Collapse Keys

```typescript
GAME_INVITE_CREATED → "conv:{conversationId}:invites"
GAME_TURN           → "sess:{sessionId}:turn:{uid}"
GAME_RESOLVED       → "sess:{sessionId}:resolved"
GAME_LOBBY_JOIN     → (no collapse key — sent to host only)
```

### 10.3 Mute / Presence Gating

- **Mute check:** `isMuted(uid, conversationId, scope)` → delegates to `isDmChatMuted` / `isGroupChatMuted`. Muted users don't receive pushes.
- **Self-filter:** Creator/resolver/actor excluded from their own notifications.
- **Presence gating (implemented):**
  - **Client writes:** `GameScreenShell` (`src/gamesV4/components/GameScreenShell.tsx` line 123) writes a `GamePresence/{sessionId}` doc on mount with `{ uid, sessionId, gameId, activeAt: serverTimestamp() }` and deletes it on unmount.
  - **Server reads:** `notifyTurn()` in `notifications.ts` checks `Users/{turnPlayerUid}/GamePresence/{sessionId}` — if the doc exists and `activeAt` is within `PRESENCE_STALE_MS` (60 seconds), the turn push notification is **skipped** (the player is already looking at the game screen).
  - **Fallthrough:** If the presence check fails (network error, etc.), the notification is sent anyway (non-fatal).

### 10.4 Deep Link Routing

Push data includes `inviteId`, `sessionId`, and `type`. The client's linking config in `RootNavigator.tsx`:

```
GameLobbyV4:      "game/lobby/:inviteId"
GamePlayV4:       "game/play/:sessionId"
GameOverV4:       "game/over/:sessionId"
```

### 10.5 In-App Foreground Notifications

In-app (foreground) banners complement push notifications. They are shown while the app is active and the user is NOT inside the Games area.

**Delivery mechanism:** Firestore subcollection `Users/{uid}/InAppNotificationsV4/{notifId}`. Backend writes docs alongside push notifications; client subscribes and shows banners.

#### 10.5.1 Supported In-App Notification Types

| Type                   | Trigger                              | Banner title           | Tap action                                    |
| ---------------------- | ------------------------------------ | ---------------------- | --------------------------------------------- |
| `game_turn`            | Turn advances (same trigger as push) | "Your turn"            | Navigate to `GamePlayV4` (fallback: chat)     |
| `achievement_unlocked` | Achievement evaluated in resolve     | "Achievement unlocked" | Navigate to `AchievementsHub` or section page |

#### 10.5.2 Games Area Gating (Client-Side)

The in-app notification system uses `isInGamesArea(currentRouteName)` (`src/gamesV4/utils/isInGamesArea.ts`) to suppress game/achievement banners when the user is on any Games-related screen:

- `Games` (tab root), `GameLobbyV4`, `GamePlayV4`, `GameOverV4`
- `GameDetailV4`, `GameLeaderboardV4`, `GameStatsV4`
- `AchievementsHub`, `AchievementSection`, `LevelRewards`

**Behavior when suppressed:** Notification doc is marked `deliveredAt` immediately (so it won't pop later) but no banner is shown.

Route tracking is automatic via `onStateChange` on `NavigationContainer` in `RootNavigator.tsx`, which calls `setCurrentScreen()` on every navigation transition.

#### 10.5.3 Payload Additions for GAME_TURN

`notifyTurn()` now writes an in-app doc alongside the push with extended payload:

```typescript
{
  sessionId: string;
  inviteId?: string;
  conversationId: string;     // NEW — for fallback navigation to chat
  conversationScope: string;  // NEW — "dm" | "group"
  gameId: string;
  gameName: string;            // NEW — human-readable game name
  opponentName: string;        // NEW — last actor display name
}
```

#### 10.5.4 ACHIEVEMENT_UNLOCKED Type

New notification type added in `src/gamesV4/types/notification.ts`. Server emission in `resolve.ts` Phase 9.5 (after `evaluateAchievementsV4`). Collapse key: `user:{uid}:achievement:{sessionId}`.

Payload:

```typescript
{
  achievementIds: string[];       // achievement type IDs
  achievementTitles?: string[];   // human-readable names
  sectionId?: string;             // for deep-linking to section page
  gameId?: string;
  sourceSessionId?: string;
}
```

#### 10.5.5 Tap Routing

**Turn notifications:**

1. Primary: navigate to `GamePlayV4({ sessionId, gameId })`
2. Fallback: navigate to chat for `conversationId` + `conversationScope`
3. Final fallback: navigate to Games hub

**Achievement notifications:**

1. If `sectionId` available: navigate to `AchievementSection({ sectionId })`
2. Otherwise: navigate to `AchievementsHub`

#### 10.5.6 Dedupe / Collapse

- In-app doc uses `collapseKey` as deterministic doc ID (base64url-encoded)
- Same collapseKey overwrites existing undelivered doc (natural Firestore set)
- Client-side debounce window (3 seconds) via existing `shouldShowNotification()` in `InAppNotificationsContext`

#### 10.5.7 Firestore Schema

Collection: `Users/{uid}/InAppNotificationsV4/{notifId}`

| Field         | Type                                    | Description                                  |
| ------------- | --------------------------------------- | -------------------------------------------- |
| `type`        | `"game_turn" \| "achievement_unlocked"` | Notification type                            |
| `createdAt`   | Timestamp (serverTimestamp)             | When the event occurred                      |
| `deliveredAt` | Timestamp \| null                       | Set by client when processed                 |
| `readAt`      | Timestamp \| null                       | Set when user taps or dismisses              |
| `collapseKey` | string                                  | Dedup key                                    |
| `payload`     | object                                  | Type-specific payload (see §10.5.3, §10.5.4) |

**Security rules:** Read = owner only. Create = server only. Update = owner can only set `deliveredAt`/`readAt` (type, collapseKey, createdAt, payload immutable). Delete = owner.

---

## 11. Security & Permissions

### 11.1 Firestore Rules Summary

Rules file: `firebase-backend/firestore.rules` (lines 1733–1897).

| Collection                              | Read                                                  | Write                                                                                          |
| --------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GameInvitesV4/{id}`                    | Authed + conversation member                          | **Cloud Functions only** (`allow write: if false`)                                             |
| `GameSessionsV4/{id}`                   | Authed + conversation member OR participantUids       | **Cloud Functions only**                                                                       |
| `PublicState/{doc}`                     | Authed + conversation member (via parent session get) | **Cloud Functions only**                                                                       |
| `PrivateState/{uid}`                    | Authed + `request.auth.uid == uid`                    | **Cloud Functions only**                                                                       |
| `Moves/{moveId}`                        | Authed + conversation member                          | **Create only:** authed + `uid == auth.uid` + `status == "pending"` + `uid in participantUids` |
| `GameResultsV4/{id}`                    | Authed + `uid in participantIds`                      | **Cloud Functions only**                                                                       |
| `Users/{uid}/GamePB/{id}`               | Authed + owner                                        | **Cloud Functions only**                                                                       |
| `LeaderboardsV4/**`                     | Authed (any user)                                     | **Cloud Functions only**                                                                       |
| `Users/{uid}/GamePresence/{id}`         | Authed (any user)                                     | Owner only (create/update/delete); must set `uid == auth.uid`                                  |
| `Users/{uid}/Achievements/{id}`         | Authed + owner                                        | **Cloud Functions only**                                                                       |
| `Users/{uid}/InAppNotificationsV4/{id}` | Authed + owner                                        | Create: server only. Update: owner (deliveredAt/readAt only). Delete: owner.                   |
| `Users/{uid}/UserStatsCache/{id}`       | Authed + owner                                        | **Cloud Functions only**                                                                       |
| `Users/{uid}/RateLimits/{action}`       | **Denied** (server-only)                              | **Cloud Functions only** (completely locked)                                                   |

### 11.2 Callable Auth Checks

All callables start with:

1. `assertAuth(context)` — rejects unauthenticated

Callables that operate on conversation-scoped invites also check:

2. `assertConversationMember(uid, conversationId, scope)` — verifies DM or group membership

**Exception:** `createSoloSessionV4`, `submitTurnMoveV4`, and `resignSessionV4` do NOT check conversation membership. Solo has no conversation; move/resign validate via `participantUids` inside the Firestore transaction.

### 11.3 Rate Limiting

Transactional cooldown via `enforceCooldown()` in `validation.ts`:

| Action          | Key              | Cooldown |
| --------------- | ---------------- | -------- |
| `CREATE_INVITE` | `createInviteV4` | 3000ms   |
| `JOIN_LOBBY`    | `joinLobbyV4`    | 2000ms   |
| `LEAVE_LOBBY`   | `leaveLobbyV4`   | 2000ms   |
| `CANCEL_INVITE` | `cancelInviteV4` | 2000ms   |
| `START_GAME`    | `startGameV4`    | 2000ms   |
| `START_SOLO`    | `startSoloV4`    | 3000ms   |
| `SUBMIT_MOVE`   | `submitMoveV4`   | 500ms    |

Mechanism: Firestore transaction reads `Users/{uid}/RateLimits/{action}.lastAtMs`, rejects if within cooldown, writes new timestamp. Throws `resource-exhausted`.

### 11.4 Payload Sanitization

`sanitisePayload()` in `validation.ts` — applied to all move payloads:

- Max depth: 5
- Max array length: 100
- Max total keys: 200
- Max key length: 64 chars
- Max string length: 512 chars
- Blocks `__proto__`, `constructor` (prototype pollution)
- Strips functions and symbols
- Passes through `Date` and Firestore `Timestamp` objects

### 11.5 Idempotency Strategy

| Operation              | Guard                                                     |
| ---------------------- | --------------------------------------------------------- |
| Resolve session        | Checks `status in [resolved, abandoned, expired]` → no-op |
| Resign                 | Returns `{ alreadyResolved: true }`                       |
| Join lobby             | Returns `{ alreadyJoined: true }`                         |
| Achievement evaluation | Skips if achievement doc already exists                   |
| Section badge claim    | Returns `{ alreadyClaimed: true }` if section doc exists  |
| Invite pinning         | Transaction checks `current.includes(inviteId)`           |
| Invite unpinning       | `arrayRemove` is inherently idempotent                    |
| Reward retry           | `rewardsProcessed` flag + idempotent increments           |

---

## 12. Navigation Contract

### 12.1 Registered Routes

Defined in `src/navigation/RootNavigator.tsx`:

| Route Name           | Component                  | Params                                   | Deep Link                  |
| -------------------- | -------------------------- | ---------------------------------------- | -------------------------- |
| `GameLobbyV4`        | `GameLobbyScreenV4`        | `{ inviteId: string }`                   | `game/lobby/:inviteId`     |
| `GamePlayV4`         | `GamePlayDispatcherV4`     | `{ sessionId: string; gameId?: string }` | `game/play/:sessionId`     |
| `GameOverV4`         | `GameOverScreenV4`         | `{ sessionId: string }`                  | `game/over/:sessionId`     |
| `GameDetailV4`       | `GameDetailScreenV4`       | `{ gameId: string }`                     | `game/detail/:gameId`      |
| `GameLeaderboardV4`  | `GameLeaderboardScreenV4`  | `{ gameId: string }`                     | `game/leaderboard/:gameId` |
| `GameStatsV4`        | `GameStatsScreenV4`        | `{}`                                     | `game/stats`               |
| `AchievementsHub`    | `AchievementsHubScreen`    | `undefined`                              | N/A                        |
| `AchievementSection` | `AchievementSectionScreen` | `{ sectionId: string }`                  | N/A                        |
| Games tab            | `GamesHubScreenV4`         | N/A                                      | `games`                    |

### 12.2 Navigation Invariants

1. **Return to Hub always goes to Play root** — The Games tab (`GamesHubScreenV4`) is the tab root; `goBack()` from any game screen returns to the previous screen in the stack (chat or hub), never to a random mid-game state
2. **Back never resigns** — Android `BackHandler` in `GameScreenShell` intercepts hardware back during active gameplay, shows an Alert ("Are you sure? This will count as a resign."). iOS swipe-back is prevented by `headerShown: false` + no gesture handler
3. **Deep links route correctly** — `GamePlayDispatcherV4` handles missing `gameId` param by fetching it from the session doc (needed for push notification deep links which only carry `sessionId`)
4. **Auto-navigation on state transitions:**
   - Lobby → Play: `useGameLobbyV4.navReady` triggers `navigation.replace("GamePlayV4")`
   - Play → Over: `GameScreenShell` detects `isTerminal` → 1500ms delay → `navigation.replace("GameOverV4")`
   - Lobby → Over: If invite resolves while in lobby, auto-navigates to `GameOverV4`
5. **Double-nav prevention:** `hasNavigatedToResult` ref in `GameScreenShell` prevents multiple navigations

---

## 13. Extending: How to Add a New Game

### 13.1 Checklist

- [ ] **Client adapter** — Create `src/gamesV4/adapters/{myGame}.ts` implementing `GameAdapterV4`
- [ ] **Server adapter** — Add game logic to `firebase-backend/functions/src/gamesV4/adapters.ts` (same interface)
- [ ] **Client screen** — Create `src/gamesV4/screens/{MyGame}ScreenV4.tsx`, wrap with `withGameV4Shell(MyGameUI, "my_game_id")`
- [ ] **Register in dispatcher** — Add entry to `GAME_SCREEN_MAP` in `GamePlayDispatcherV4.tsx`
- [ ] **Register in IMPLEMENTED_GAMES** — Add ID to the `IMPLEMENTED_GAMES` set in `GamesHubScreenV4.tsx`
- [ ] **Update metadata** — Ensure entry exists in `GAME_METADATA` in `constants.ts` (already present for all 20 games)
- [ ] **Deploy** — Rebuild + deploy Cloud Functions

### 13.2 Adapter Interface

```typescript
interface GameAdapterV4 {
  gameId: GameId; // Must match constants
  runtimeType: "solo" | "turnBased" | "realtime";
  maxPlayers: number;
  minPlayers: number;
  supportsSpectate: boolean;
  spectateMode: SpectateMode;
  settingsSchema: SettingsFieldDef[]; // For lobby settings UI
  defaultSettings: Record<string, unknown>;

  // Required:
  createInitialPublicState(players, settings): Record<string, unknown>;

  // Optional but recommended:
  createInitialPrivateState?(
    players,
    settings,
  ): Record<string, Record<string, unknown>>;
  validateMove?(
    publicState,
    privateState,
    movePayload,
    ctx,
  ): MoveValidationResult;
  computeSummary?(
    publicState,
    players,
    turnPlayerId,
  ): { turnPlayerId; scoreSummary };
  computeOutcome?(publicState, players): GameOutcome;
  getSpectatorView?(publicState): Record<string, unknown>;
  extractPerformanceMetrics?(publicState, players): Record<string, unknown>;
  validateSettings?(patch): Record<string, unknown>;
}
```

### 13.3 MoveValidationResult

```typescript
interface MoveValidationResult {
  ok: boolean;
  error?: string;
  nextPublicState?: Record<string, unknown>;
  nextPrivateState?: Record<string, Record<string, unknown>>;
  scoreDelta?: Array<{ uid: string; delta: number }>;
  turnAdvance?: boolean; // true = next player's turn
  terminal?: {
    type: "win" | "draw" | "timeout";
    winnerIds?: string[];
    reason?: string;
  };
}
```

### 13.4 End-screen Stats

The `GameOverScreenV4` reads from `GameResultsV4`:

- `scoreboard[].score` and `scoreboard[].stats` are game-specific
- `performanceMetrics` from `extractPerformanceMetrics()` is stored but not yet displayed in UI
- Achievements: add game-specific defs to `GAME_ACHIEVEMENTS` array in `achievements.ts`

### 13.5 Server Adapter Registration

In `firebase-backend/functions/src/gamesV4/adapters.ts`, add your adapter implementation and call `registerAdapter(myAdapter)` at module scope. The adapter auto-registers on import.

### 13.6 Client Adapter Registration

In `src/gamesV4/adapters/`, create your adapter file and import it in `src/gamesV4/adapters/index.ts` as a side-effect import (e.g., `import "./myGame";`). This triggers auto-registration at bundle load time.

### 13.7 Example: Minimal Turn-based Game Adapter

```typescript
// src/gamesV4/adapters/myGame.ts
import { GameAdapterV4, MoveValidationResult } from "../types";
import { registerAdapter } from "./registry";

const myGameAdapter: GameAdapterV4 = {
  gameId: "my_game",
  runtimeType: "turnBased",
  maxPlayers: 2,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "full_state",
  settingsSchema: [],
  defaultSettings: {},

  createInitialPublicState(players, settings) {
    return { board: Array(9).fill(null), moveCount: 0 };
  },

  validateMove(publicState, _privateState, movePayload, ctx) {
    // Validate and return { ok: true, nextPublicState, terminal?, turnAdvance }
    return { ok: true, nextPublicState: { ...publicState }, turnAdvance: true };
  },

  computeOutcome(publicState, players) {
    return { winnerIds: [], finalScoreboard: [] };
  },
};

registerAdapter(myGameAdapter);
export default myGameAdapter;
```

---

## 14. Firestore Composite Indexes

All V4 indexes are defined in `firebase-backend/firestore.indexes.json`. **13 composite indexes** are required:

### 14.1 GameInvitesV4 (5 indexes)

| #   | Fields                                                            | Purpose                             |
| --- | ----------------------------------------------------------------- | ----------------------------------- |
| 1   | `conversationId` ASC → `status` ASC → `createdAt` DESC            | Per-conversation invite list        |
| 2   | `conversationId` ASC → `hiddenInChat` ASC → `createdAt` DESC      | Visible (non-hidden) invites        |
| 3   | `participantIds` ARRAY_CONTAINS → `status` ASC → `updatedAt` DESC | "My invites" in Games Hub           |
| 4   | `status` ASC → `deleteAt` ASC                                     | Watchdog Pass 2: TTL cleanup        |
| 5   | `status` ASC → `createdAt` ASC                                    | Watchdog Pass 1: stale lobby expiry |

### 14.2 GameSessionsV4 (4 indexes)

| #   | Fields                                                             | Purpose                                |
| --- | ------------------------------------------------------------------ | -------------------------------------- |
| 1   | `conversationId` ASC → `status` ASC → `createdAt` DESC             | Sessions per conversation              |
| 2   | `status` ASC → `rewardsProcessed` ASC                              | Watchdog Pass 3: reward retry          |
| 3   | `participantUids` ARRAY_CONTAINS → `status` ASC → `createdAt` DESC | "My sessions" query                    |
| 4   | `status` ASC → `createdAt` ASC                                     | Watchdog Pass 4: inactive auto-resolve |

### 14.3 GameResultsV4 (2 indexes)

| #   | Fields                                             | Purpose              |
| --- | -------------------------------------------------- | -------------------- |
| 1   | `participantIds` ARRAY_CONTAINS → `createdAt` DESC | Player history feed  |
| 2   | `gameId` ASC → `createdAt` DESC                    | Per-game result list |

### 14.4 Subcollection Indexes

| Collection     | Fields                         | Purpose                 |
| -------------- | ------------------------------ | ----------------------- |
| `Moves`        | `uid` ASC → `createdAt` ASC    | Per-player move history |
| `Entries` (LB) | `score` DESC → `updatedAt` ASC | Leaderboard ranking     |

### 14.5 Field Overrides

| Collection      | Field      | Override | Notes                                                  |
| --------------- | ---------- | -------- | ------------------------------------------------------ |
| `GameInvitesV4` | `deleteAt` | TTL      | Firestore-native TTL field (backup to watchdog Pass 2) |

---

## 15. Test Inventory

All game V4 tests live in `__tests__/gamesV4/`. Run with `npx jest --testPathPattern=gamesV4`.

> **See also:** [RUNBOOK §2](GAMES_V4_RUNBOOK.md#2-emulator--dev-setup-notes) for full test commands, and [RUNBOOK §7](GAMES_V4_RUNBOOK.md#7-regression-test-plan) for the manual regression test plan.

| Test File                              | Coverage Area               | Key Scenarios                                            |
| -------------------------------------- | --------------------------- | -------------------------------------------------------- |
| `adapters/ticTacToe.test.ts`           | TTT adapter move validation | Win detection, draw, invalid moves, initial state        |
| `adapters/connectFour.test.ts`         | C4 adapter move validation  | Gravity drop, 4-in-a-row (all directions), column full   |
| `adapters/play2048.test.ts`            | 2048 adapter slide/merge    | Deterministic tile spawn, merge scoring, game-over/win   |
| `adapters/registry.test.ts`            | Adapter registry            | Register, duplicate rejection, lookup, requireAdapter    |
| `constants/constants.test.ts`          | Constants integrity         | GAME_METADATA ↔ GameId sync, path helpers, XP formula    |
| `validation/validation.test.ts`        | Payload sanitization        | Depth limit, prototype pollution, key/array limits       |
| `resolve/resolvePipeline.test.ts`      | Resolution pipeline         | Phase ordering, XP calculation, PB updates, reward retry |
| `resolve/achievementEvaluator.test.ts` | Achievement evaluation      | Milestone thresholds, idempotency, pre-increment logic   |
| `lobbyBugRegression.test.ts`           | Lobby regression scenarios  | Join/leave race conditions, host start gating            |

---

## 16. Known Gaps / TODOs

| ID      | Gap                                                                                                 | Files                                                             | Severity  | Suggested Fix                                                                  |
| ------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------ |
| **G1**  | **No Colyseus server** — realtime games are metadata-only                                           | `colyseus-server/` doesn't exist; `sessions.ts` has unused bridge | Medium    | Build Colyseus rooms + deploy; connect via `resolveRealtimeSessionV4`          |
| **G2**  | **17 of 20 games unimplemented**                                                                    | `IMPLEMENTED_GAME_IDS` in `constants.ts`                          | Expected  | Add adapters + screens per §13 checklist                                       |
| **G3**  | **ACCEPTED-RISK N2** — non-adaptored games use client hints for winner                              | `sessions.ts` L109, `resolve.ts` L76                              | Medium    | Add server adapters for all games (eliminates risk)                            |
| **G4**  | **ACCEPTED-RISK N3** — XP increment is last-write-wins under concurrent resolution                  | `resolve.ts` L78                                                  | Low       | Use transactions or distributed counter for XP                                 |
| **G5**  | **Performance bonus not implemented**                                                               | `XP_CONFIG.MAX_PERFORMANCE_BONUS = 10` but never applied          | Low       | Wire `extractPerformanceMetrics()` results into `computeXPAwards()`            |
| **G6**  | **No local game history** — all history is `GameResultsV4` (server)                                 | N/A                                                               | Non-issue | Current design is actually **better** for integrity; no action needed          |
| **G7**  | **usePinnedInvites flicker** — brief UI flash when pin array changes (ACCEPTED-RISK N5)             | `src/gamesV4/hooks/usePinnedInvites.ts`                           | Low       | Batch subscription updates with `startTransition` or debounce                  |
| **G8**  | **Spectator view not customized** — all 3 pilot adapters return full public state                   | `adapters/*.ts`                                                   | Low       | Implement `getSpectatorView()` to hide sensitive state if needed               |
| **G9**  | **Settings UI not wired** — `updateLobbySettingsV4` is a stub; lobby doesn't show settings controls | `lobby.ts`, `GameLobbyScreenV4.tsx`                               | Low       | Wire adapter `settingsSchema` to lobby UI; validate in `updateLobbySettingsV4` |
| **G10** | **Private state not passed to adapter during move validation** — TODO in code                       | `sessions.ts` L127 (`// TODO: read private state if needed`)      | Medium    | Read `PrivateState/{uid}` in `submitTurnMoveV4` and pass to `runMove()`        |
| **G11** | **"Game started" notification not implemented** — no push when lobby transitions to active          | `triggers.ts` (TODO comment on lobby_open → active)               | Low       | Add `notifyGameStarted()` call in `onSessionV4StatusChanged` trigger           |
| **G12** | **Scoreboard descriptors only for 3 games** — remaining 17 games need custom descriptors            | `constants.ts` `SCOREBOARD_DESCRIPTORS`                           | Low       | Add descriptors as each adapter is implemented                                 |
| **G13** | **Achievement definitions client mirror not auto-synced** — manual parity required                  | `src/gamesV4/data/achievementDefinitions.ts` vs backend           | Low       | Generate client defs from backend at build time or share via common package    |

> **See also:** [RUNBOOK §4](GAMES_V4_RUNBOOK.md#4-common-failure-modes--fix-playbook) for debugging and fix playbooks related to these gaps.

---

## Appendix: Accuracy Audit Log (2026-03-03)

The following corrections were made based on a code-level audit of the entire V4 implementation:

| #   | Finding                                                                                                             | Action Taken                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Architecture diagram listed only 6 callables; actual = 10                                                           | Added `cancelGameInviteV4`, `leaveInviteLobbyV4`, `createSoloSessionV4`, noted all 10                                 |
| 2   | Key file map missing `solo.ts`; adapters line count said 780 (actual 851)                                           | Added row, fixed count                                                                                                |
| 3   | Solo flow described as going through invite system                                                                  | Corrected: `createSoloSessionV4` bypasses invites entirely                                                            |
| 4   | §10.3 claimed "no client code writes presence" (Known Gap G3)                                                       | **Incorrect** — `GameScreenShell` writes + deletes `GamePresence` docs; `notifyTurn` reads them. Removed G3 from gaps |
| 5   | Rate limits table listed 4 cooldowns; actual = 7                                                                    | Added `LEAVE_LOBBY`, `CANCEL_INVITE`, `START_SOLO`                                                                    |
| 6   | Firestore rules table missing 3 collections                                                                         | Added `Achievements`, `UserStatsCache`, `RateLimits` match blocks                                                     |
| 7   | `GAME_LOBBY_JOIN` recipients said "all participants"                                                                | Corrected: host only                                                                                                  |
| 8   | No mention of Firestore composite indexes or test files                                                             | Added §14 (13 indexes) and §15 (9 test files)                                                                         |
| 9   | PB integrity hash format correct in §9.4 but comment in `types/pb.ts` uses wrong order + nonexistent `serverSecret` | Doc is correct; `types/pb.ts` comment needs code fix                                                                  |
| 10  | Missing new gaps: private state not read in move validation, game-started notification not wired                    | Added G10, G11                                                                                                        |
| 11  | Architecture diagram listed `resolveRealtimeSessionV4` under Internal; it is a deployed callable                    | Moved to Callables section (STOP 3 polish)                                                                            |
| 12  | §11.2 said "every callable" checks conversation membership; solo + session callables do not                         | Corrected: only invite/lobby callables check membership (STOP 3 polish)                                               |
| 13  | §11.4 missing `MAX_STRING_LENGTH` (512) and Date/Timestamp passthrough                                              | Added (STOP 3 polish)                                                                                                 |

---

## Appendix: Implementation Pass Log (GameOverV4 + Achievements)

The following features were implemented in a single pass:

| #   | Feature                              | Files Modified / Created                                                                                                              |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Fix "game over text" stuck bug**   | `GameScreenShell.tsx` — removed `result` dependency gate from terminal→GameOverV4 navigation                                          |
| 2   | **Universal GameOverV4 screen**      | `GameOverScreenV4.tsx` — full rewrite: scoreboard, XP, achievements, rematch (solo + chat), return-to-chat with `CommonActions.reset` |
| 3   | **Scoreboard descriptors**           | `constants.ts` — added `ScoreboardDescriptor` + `SCOREBOARD_DESCRIPTORS`; `adapter.ts` interface; 3 adapters updated                  |
| 4   | **Fix profile level bar (Lv 1 bug)** | `useProfileData.ts` — `computedLevel` now reads `baseProfile.level` from Firestore instead of always defaulting                       |
| 5   | **Sectioned achievements + rewards** | `achievements.ts` (backend) — 6 sections, 5 difficulty ranks, token rewards per achievement                                           |
| 6   | **Section badge claim callable**     | `claimSectionBadge.ts` (new) — `claimAchievementSectionBadgeV4` callable; registered in `index.ts`                                    |
| 7   | **Client service wrappers**          | `gameServiceV4.ts` — `claimAchievementSectionBadge()`, `subscribeToAchievements()`, `subscribeToAchievementSections()`                |
| 8   | **Client achievement definitions**   | `achievementDefinitions.ts` (new) — sections, defs, difficulty meta, lookup helpers                                                   |
| 9   | **AchievementsHub screen**           | `AchievementsHubScreen.tsx` (new) — section cards, progress bars, claim badge button                                                  |
| 10  | **AchievementSection screen**        | `AchievementSectionScreen.tsx` (new) — per-achievement rows with difficulty badges, token rewards                                     |
| 11  | **Navigation registration**          | `root.ts` — added `AchievementsHub`, `AchievementSection` to `MainStackParamList`; `RootNavigator.tsx` — registered screens           |
| 12  | **Profile achievements card**        | `OwnProfileScreen.tsx` — trophy card linking to AchievementsHub                                                                       |
| 13  | **Firestore security rules**         | `firestore.rules` — added `AchievementSections` subcollection rules (owner read, CF-only writes)                                      |
| 14  | **Docs updated**                     | This file — §4.6 (AchievementSections), §9.2 (sections/difficulty/rewards), §12 (new routes), §16 (G12, G13), this appendix           |

---

## Appendix: Audit Pass Log (2026-03-04)

Post-implementation audit of the GameOverV4 + Achievements system:

| #   | Finding                                                  | Severity | Fix Applied                                                                        |
| --- | -------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| 1   | **Solo rematch broken** — `res?.data?.sessionId` wrong   | P0       | Changed to `res?.sessionId` (createSoloSession already unwraps result.data)        |
| 2   | **Achievement names show raw type** on game over screen  | P1       | Added `ACHIEVEMENT_BY_TYPE` lookup to resolve human-readable names                 |
| 3   | `AchievementEntryV4` type missing backend fields         | P2       | Added `sectionId`, `difficulty`, `tokenReward` to client type                      |
| 4   | Achievement+wallet writes not atomic                     | P2       | Batched `achievementRef.set()` + `walletRef.set()` into single `batch.commit()`    |
| 5   | Android hardware back on GameOverV4 unhandled            | P2       | Added `BackHandler` interceptor routing through `handleSafeExit()`                 |
| 6   | `FlatList` inside `ScrollView` (VirtualizedList warning) | P3       | Replaced scoreboard `FlatList` with `.map()` in `View`                             |
| 7   | Docs: section names/counts wrong                         | P3       | Fixed "The Grind"→"Grinder", counts: getting_started=2, grinder=6, puzzle_master=2 |
| 8   | Docs: difficulty color table stale                       | P3       | Updated to match actual `DIFFICULTY_META` client colors + variable token ranges    |
| 9   | Docs: missing section badge claim in idempotency table   | P3       | Added row to §11.5 idempotency table                                               |
| 10  | Unused `FlatList` import in GameOverScreenV4             | P4       | Removed                                                                            |

---

## Appendix: Game Detail + Leaderboard + History Pass (Follow-up Refine)

The following features were implemented in the follow-up refinement pass:

| #   | Feature                                              | Files Modified / Created                                                                                                                                                                            |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Per-game achievement sections**                    | `achievementDefinitions.ts` — restructured 6 sections → 4 (tic_tac_toe, connect_four, play_2048, milestones). Added `LEGACY_SECTION_MAP`, `getDefsForGame()`, `resolveSection()`, `isGameSection()` |
| 2   | **Leaderboard + game descriptors**                   | `constants.ts` — added `LeaderboardDescriptor`, `LEADERBOARD_DESCRIPTORS`, `GameDescription`, `GAME_DESCRIPTIONS`                                                                                   |
| 3   | **Game history + friends leaderboard services**      | `gameServiceV4.ts` — added `fetchGameHistoryByGame()`, `fetchFriendsLeaderboard()`                                                                                                                  |
| 4   | **Profile achievements card (OverviewCard pattern)** | `GamesAchievementsCard.tsx` (new) — owned-only achievements display, "View in Games" CTA                                                                                                            |
| 5   | **Profile screen update**                            | `OwnProfileScreen.tsx` — replaced old TouchableOpacity achievements card with `GamesAchievementsCard`                                                                                               |
| 6   | **Games Hub achievements entry + Game Detail nav**   | `GamesHubScreenV4.tsx` — added "Achievements & Progress" card, changed multiplayer tap from `GameLeaderboardV4` to `GameDetailV4`                                                                   |
| 7   | **Game Detail Screen ("Steam-like")**                | `GameDetailScreenV4.tsx` (new) — Overview, Play Actions, Your Progress, Leaderboards (Friends/Global toggle), Achievements, Game History with opponents                                             |
| 8   | **Route registration**                               | `root.ts` — added `GameDetailV4: { gameId: string }`; `RootNavigator.tsx` — registered screen + deep link                                                                                           |
| 9   | **Friends leaderboard wiring**                       | `GameDetailScreenV4.tsx` — lazy-loads friends via `getFriends()` + `fetchFriendsLeaderboard()` + `getCachedProfile()` for display names                                                             |
| 10  | **Opponent display in game history**                 | `GameStatsScreenV4.tsx` — shows opponent names from `scoreboard[]`, fixed win/loss logic (was `winnerIds.length > 0`, now `winnerIds.includes(uid)`), draws show orange                             |
| 11  | **Expand/collapse lists**                            | `GameDetailScreenV4.tsx`, `GameStatsScreenV4.tsx` — "Show All / Show Less" toggle with LIST_CAP=5 for achievements and game history                                                                 |
| 12  | **Docs updated**                                     | `GAMES_V4_SYSTEM.md` — §12 navigation contract (added GameDetailV4), §4.6 section count (4 sections), this appendix                                                                                 |
