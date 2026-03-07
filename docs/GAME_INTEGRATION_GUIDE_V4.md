# Game Integration Guide V4 — Exhaustive Reference for AI Agents & Developers

> **Purpose:** Everything an external AI agent or developer needs to implement a new game that integrates seamlessly into the SnapStyle Games V4 system — from adapter code to Firestore schemas to QA checklists.
>
> **Source of truth:** This document was generated from a full codebase audit (2026-03-04). When in doubt, the code wins over this doc.
>
> **Companion docs:**
>
> - [GAMES_V4_SYSTEM.md](GAMES_V4_SYSTEM.md) — Full system spec
> - [GAMES_V4_RUNBOOK.md](GAMES_V4_RUNBOOK.md) — Ops & debug guide
> - [QA_GAME_OVER_ACHIEVEMENTS.md](QA_GAME_OVER_ACHIEVEMENTS.md) — QA: game over + achievements
> - [QA_GAME_DETAIL_LEADERBOARD.md](QA_GAME_DETAIL_LEADERBOARD.md) — QA: game detail + leaderboard
> - [QA_IN_APP_NOTIFICATIONS.md](QA_IN_APP_NOTIFICATIONS.md) — QA: in-app notifications

---

## Table of Contents

1. [Purpose and Audience](#1-purpose-and-audience)
2. [System Overview](#2-system-overview)
3. [End-to-End Flows](#3-end-to-end-flows)
4. [Game Detail Page ("Steam-like") Requirements](#4-game-detail-page-steam-like-requirements)
5. [Game Adapter Contract (Client)](#5-game-adapter-contract-client)
6. [Backend Integration (Cloud Functions)](#6-backend-integration-cloud-functions)
7. [Firestore Collections and Schemas](#7-firestore-collections-and-schemas)
8. [Achievements (Per-Game Section)](#8-achievements-per-game-section)
9. [Leaderboards (Global + Friends)](#9-leaderboards-global--friends)
10. [Game History + Recent Games](#10-game-history--recent-games)
11. [In-App Notifications](#11-in-app-notifications)
12. [XP / Leveling / Level Rewards (Battlepass Track)](#12-xp--leveling--level-rewards-battlepass-track)
13. [Security (Rules) and Integrity](#13-security-rules-and-integrity)
14. [Testing and QA](#14-testing-and-qa)
15. [Copy-Paste Templates / Skeletons](#15-copy-paste-templates--skeletons)
16. [Animation Architecture (CRITICAL)](#16-animation-architecture-critical)

---

## Source Map — Key File Paths

Before reading further, familiarize yourself with the project structure:

### Client — `src/gamesV4/`

| Path                                               | Purpose                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/gamesV4/types/adapter.ts`                     | `GameAdapterV4` interface, `MoveValidationResult`, `GameOutcome`                                                                                 |
| `src/gamesV4/types/common.ts`                      | `GameId` union (20 games), `GameRuntimeType`, shared primitives                                                                                  |
| `src/gamesV4/types/session.ts`                     | `GameSessionV4`, `SessionStatus`, `MoveDoc`, `PublicStateDoc`                                                                                    |
| `src/gamesV4/types/result.ts`                      | `GameResultV4`, `FinalScoreboardEntry`, `XPAward`, `AchievementUnlock`                                                                           |
| `src/gamesV4/types/invite.ts`                      | `GameInviteV4`, status transitions                                                                                                               |
| `src/gamesV4/types/notification.ts`                | Push + in-app notification types and payloads                                                                                                    |
| `src/gamesV4/types/pb.ts`                          | `GamePBV4` personal best schema                                                                                                                  |
| `src/gamesV4/constants.ts`                         | `GAME_METADATA`, `SCOREBOARD_DESCRIPTORS`, `LEADERBOARD_DESCRIPTORS`, `GAME_DESCRIPTIONS`, `XP_CONFIG`, `IMPLEMENTED_GAME_IDS`, collection paths |
| `src/gamesV4/adapters/registry.ts`                 | `registerAdapter()`, `getAdapter()`, `requireAdapter()`                                                                                          |
| `src/gamesV4/adapters/gameRunner.ts`               | `createInitialState()`, `runMove()`, `computeOutcome()` orchestration                                                                            |
| `src/gamesV4/adapters/index.ts`                    | Barrel exports + side-effect adapter imports                                                                                                     |
| `src/gamesV4/adapters/ticTacToe.ts`                | Reference adapter: Tic-Tac-Toe (turn-based)                                                                                                      |
| `src/gamesV4/adapters/connectFour.ts`              | Reference adapter: Connect Four (turn-based)                                                                                                     |
| `src/gamesV4/adapters/play2048.ts`                 | Reference adapter: 2048 (solo)                                                                                                                   |
| `src/gamesV4/services/gameServiceV4.ts`            | All callable wrappers + Firestore subscriptions + one-shot fetches                                                                               |
| `src/gamesV4/screens/GamePlayDispatcherV4.tsx`     | `GAME_SCREEN_MAP` — routes `gameId` → screen component                                                                                           |
| `src/gamesV4/screens/GamesHubScreenV4.tsx`         | Games tab — catalog, active invites, level card                                                                                                  |
| `src/gamesV4/screens/GameDetailScreenV4.tsx`       | "Steam-like" game detail page (6 sections)                                                                                                       |
| `src/gamesV4/screens/GameLobbyScreenV4.tsx`        | Pre-game lobby                                                                                                                                   |
| `src/gamesV4/screens/GameOverScreenV4.tsx`         | Universal game-over screen                                                                                                                       |
| `src/gamesV4/screens/GameLeaderboardScreenV4.tsx`  | Weekly leaderboard                                                                                                                               |
| `src/gamesV4/screens/GameStatsScreenV4.tsx`        | Per-user stats overview                                                                                                                          |
| `src/gamesV4/screens/AchievementsHubScreen.tsx`    | All sections overview                                                                                                                            |
| `src/gamesV4/screens/AchievementSectionScreen.tsx` | Single section detail                                                                                                                            |
| `src/gamesV4/screens/LevelRewardsScreen.tsx`       | Battlepass tier track                                                                                                                            |
| `src/gamesV4/components/GameScreenShell.tsx`       | HOC `withGameV4Shell()` — wraps game UI with session management                                                                                  |
| `src/gamesV4/components/PinnedInviteBar.tsx`       | Chat pinned invite chips                                                                                                                         |
| `src/gamesV4/components/LevelRewardsTrack.tsx`     | Horizontal battlepass rail                                                                                                                       |
| `src/gamesV4/components/TierDetailsSheet.tsx`      | Bottom sheet for tier claim                                                                                                                      |
| `src/gamesV4/data/achievementDefinitions.ts`       | Client mirror of achievement/section defs                                                                                                        |
| `src/gamesV4/utils/isInGamesArea.ts`               | Route check for notification suppression                                                                                                         |
| `src/gamesV4/hooks/useGameSessionV4.ts`            | Session + public state subscription                                                                                                              |
| `src/gamesV4/hooks/useGameLobbyV4.ts`              | Lobby subscription + auto-nav                                                                                                                    |
| `src/gamesV4/hooks/useLeaderboardV4.ts`            | Weekly leaderboard subscription                                                                                                                  |
| `src/gamesV4/hooks/useAchievementsV4.ts`           | Achievements subscription                                                                                                                        |
| `src/gamesV4/hooks/useGameStatsV4.ts`              | Aggregated stats hook                                                                                                                            |
| `src/gamesV4/hooks/usePinnedInvites.ts`            | Pinned invite bar data                                                                                                                           |
| `src/data/levelRewards.ts`                         | Client mirror of 50 level rewards                                                                                                                |

### Backend — `firebase-backend/functions/src/gamesV4/`

| Path                   | Purpose                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `index.ts`             | Barrel exports (14 symbols: 11 callables, 2 triggers, 1 scheduled)                                   |
| `adapters.ts`          | Server adapter registry + 3 pilot implementations (851 lines) + serialization                        |
| `resolve.ts`           | 10-phase resolution chokepoint (757 lines)                                                           |
| `achievements.ts`      | 18 achievement definitions + evaluator (610 lines)                                                   |
| `notifications.ts`     | Push + in-app dispatch (308 lines)                                                                   |
| `sessions.ts`          | `submitTurnMoveV4`, `resignSessionV4` (277 lines)                                                    |
| `solo.ts`              | `createSoloSessionV4`, `resumeOrCreateSoloSessionV4`, `restartSoloSessionV4`, `suspendSoloSessionV4` |
| `invites.ts`           | `createGameInviteV4` (302 lines)                                                                     |
| `lobby.ts`             | 5 lobby callables (694 lines)                                                                        |
| `triggers.ts`          | 2 Firestore triggers (113 lines)                                                                     |
| `watchdog.ts`          | 4-pass scheduled cleanup (138 lines)                                                                 |
| `helpers.ts`           | Auth, membership, pins, traceId, hashing (218 lines)                                                 |
| `validation.ts`        | Sanitization, cooldowns (197 lines)                                                                  |
| `types.ts`             | Backend type definitions + constants (278 lines)                                                     |
| `levelRewardsV4.ts`    | Level rewards definitions + unlock + claim callable (346 lines)                                      |
| `claimSectionBadge.ts` | `claimAchievementSectionBadgeV4` callable (121 lines)                                                |

### Infra

| Path                                                 | Purpose                             |
| ---------------------------------------------------- | ----------------------------------- |
| `firebase-backend/firestore.rules` (lines 1722–1897) | 12+ match blocks for V4 collections |
| `firebase-backend/firestore.indexes.json`            | 14 composite indexes for V4         |
| `src/navigation/RootNavigator.tsx` (lines 663–746)   | Route registration + deep links     |

### Tests — `__tests__/gamesV4/`

| Path                                   | Purpose                 |
| -------------------------------------- | ----------------------- |
| `adapters/ticTacToe.test.ts`           | TTT adapter validation  |
| `adapters/connectFour.test.ts`         | C4 adapter validation   |
| `adapters/play2048.test.ts`            | 2048 adapter validation |
| `adapters/registry.test.ts`            | Registry unit tests     |
| `constants/constants.test.ts`          | Constants integrity     |
| `validation/validation.test.ts`        | Payload sanitization    |
| `resolve/resolvePipeline.test.ts`      | Resolution pipeline     |
| `resolve/achievementEvaluator.test.ts` | Achievement evaluation  |
| `lobbyBugRegression.test.ts`           | Lobby race conditions   |

---

## 1. Purpose and Audience

### Who this guide is for

- **External AI agents** tasked with implementing a new game from scratch
- **Developers** who need to add a game to the existing V4 system

### What "done" means

A game is **fully integrated** when all of these are true:

- [ ] Client adapter implements `GameAdapterV4` and is registered
- [ ] Server adapter mirrors client logic and is registered in `adapters.ts`
- [ ] Game screen component is created and wrapped with `withGameV4Shell`
- [ ] Dispatcher routes `gameId` to the game screen in `GAME_SCREEN_MAP`
- [ ] `IMPLEMENTED_GAME_IDS` includes the new `gameId`
- [ ] `GAME_METADATA` entry exists with correct metadata
- [ ] `GAME_DESCRIPTIONS` entry has short description, how-to-play, and tips
- [ ] `SCOREBOARD_DESCRIPTORS` entry formats scores for the GameOver screen
- [ ] `LEADERBOARD_DESCRIPTORS` entry defines the leaderboard metric and formatting
- [ ] Per-game achievements are defined (backend + client mirror)
- [ ] Achievement section exists with section badge
- [ ] Game appears in Games Hub with correct category and icon
- [ ] Game Detail page renders all 6 sections correctly
- [ ] GameOver screen displays correct scoreboard, XP, and achievements
- [ ] Leaderboard updates on resolve (global weekly + friends via PB)
- [ ] Game history entries appear with opponent names
- [ ] In-app notifications fire (turn + achievement unlock)
- [ ] Cloud Functions deployed
- [ ] Firestore rules allow reading new data (existing rules cover this generically)
- [ ] All QA checklist items pass

---

## 2. System Overview

### Terminology

| Term                      | Definition                                                                                                                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GameId**                | String literal from a union of 20 canonical IDs defined in `src/gamesV4/types/common.ts`. **Append-only — never rename or remove.**                                                                                                                                         |
| **runtimeType**           | `"solo"` (1 player, no invite), `"turnBased"` (2+ players, Firestore state machine), `"realtime"` (planned, Colyseus)                                                                                                                                                       |
| **sessionId**             | Unique ID for a `GameSessionsV4` document — the authoritative game state                                                                                                                                                                                                    |
| **inviteId**              | Unique ID for a `GameInvitesV4` document — the chat-pinned challenge. Solo games have no invite.                                                                                                                                                                            |
| **conversationId**        | DM `chatId` or `groupId` the invite is pinned to. Empty string for solo games.                                                                                                                                                                                              |
| **Adapter**               | A stateless TypeScript object implementing `GameAdapterV4`. Shared between client (optimistic) and server (authoritative).                                                                                                                                                  |
| **GameScreenShell**       | HOC `withGameV4Shell` wrapping every game UI with session management, move dispatch, overlay controls (runtime-type-specific), and auto-navigation. Solo games get a back arrow (suspend) + menu button; turn-based gets back arrow + resign; realtime gets resign overlay. |
| **Resolution chokepoint** | `resolveSessionV4Internal()` — every terminal path funnels through this single function (10 phases).                                                                                                                                                                        |
| **PB**                    | Personal Best — server-written only, with SHA-256 integrity hash.                                                                                                                                                                                                           |
| **Watchdog**              | Scheduled function (every 30 min) that expires stale lobbies, deletes TTL invites, retries rewards, auto-resolves inactive sessions.                                                                                                                                        |
| **IMPLEMENTED_GAME_IDS**  | `Set<GameId>` gating which games are playable. Currently: `tic_tac_toe`, `connect_four`, `play_2048`.                                                                                                                                                                       |

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     React Native Client                      │
│                                                              │
│  ChatScreen ──→ GamePickerModal ──→ createGameInviteV4()     │
│  GamesHubScreen ──→ resumeOrCreateSoloSessionV4() (solo)     │
│       │                                                      │
│  PinnedInviteBar ←─── onSnapshot(GameInvitesV4)             │
│       │                                                      │
│  GameLobbyScreen → joinInviteLobbyV4 / startGameFromInvite   │
│       │                                                      │
│  GamePlayDispatcher ──→ game-specific screen                 │
│       │                   (wrapped by GameScreenShell)        │
│       │                                                      │
│  GameScreenShell ──→ submitTurnMoveV4() / resignV4()         │
│       │              suspendSoloSessionV4() (solo exit)        │
│       │                                                      │
│  GameOverScreen ←─── onSnapshot(GameResultsV4)              │
└───────────┬──────────────────────────────────────────────────┘
            │ httpsCallable / Firestore listeners
            ▼
┌──────────────────────────────────────────────────────────────┐
│              Firebase Cloud Functions (Node 20)               │
│                                                              │
│  Callables (11):                                             │
│    createGameInviteV4     joinInviteLobbyV4                  │
│    leaveInviteLobbyV4     cancelGameInviteV4                 │
│    startGameFromInviteV4  updateLobbySettingsV4              │
│    createSoloSessionV4    submitTurnMoveV4                   │
│    resumeOrCreateSoloV4   suspendSoloSessionV4               │
│    restartSoloSessionV4   resignSessionV4                    │
│    claimLevelRewardV4                                        │
│    claimAchievementSectionBadgeV4                            │
│                                                              │
│  Triggers: onGameInviteV4Deleted, onSessionV4StatusChanged   │
│  Scheduled: watchdogGamesV4 (every 30 min)                   │
│  Internal: resolveSessionV4Internal (single chokepoint)      │
└───────────┬──────────────────────────────────────────────────┘
            │ reads / writes
            ▼
┌──────────────────────────────────────────────────────────────┐
│                     Cloud Firestore                           │
│                                                              │
│  GameInvitesV4/{inviteId}                                    │
│  GameSessionsV4/{sessionId}                                  │
│    └─ PublicState/state                                      │
│    └─ PrivateState/{uid}                                     │
│    └─ Moves/{moveId}                                         │
│  GameResultsV4/{sessionId}                                   │
│  LeaderboardsV4/{gameId}/Weeks/{wk}/Entries/{uid}            │
│  Users/{uid}/GamePB/{gameId}                                 │
│  Users/{uid}/Achievements/{type}                             │
│  Users/{uid}/AchievementSections/{sectionId}                 │
│  Users/{uid}/UserStatsCache/stats                            │
│  Users/{uid}/LevelRewardsV4/{level}                          │
│  Users/{uid}/InAppNotificationsV4/{notifId}                  │
│  Users/{uid}/GamePresence/{docId}                            │
│  Users/{uid}/RateLimits/{action}                             │
│  Chats/{id}.pinnedGameInviteIds []                           │
│  Groups/{id}.pinnedGameInviteIds []                          │
└──────────────────────────────────────────────────────────────┘
```

### Where games plug in

Adding a new game touches exactly four integration points:

1. **Adapter registry** — Client (`src/gamesV4/adapters/`) + Server (`firebase-backend/functions/src/gamesV4/adapters.ts`)
2. **Screen + dispatcher** — Game screen component + entry in `GAME_SCREEN_MAP`
3. **Constants/metadata** — `GAME_METADATA`, `GAME_DESCRIPTIONS`, `SCOREBOARD_DESCRIPTORS`, `LEADERBOARD_DESCRIPTORS`, `IMPLEMENTED_GAME_IDS`
4. **Achievements** — Backend definitions in `achievements.ts` + client mirror in `achievementDefinitions.ts`

Everything else (lobby, session lifecycle, resolve pipeline, leaderboards, notifications, presence, XP) is **generic** and works automatically.

---

## 3. End-to-End Flows

### 3.1 Hub → Create Session → Play → Resolve → GameOver → Return to Hub (Multiplayer)

1. **User opens Games Hub** (`GamesHubScreenV4`) → taps a multiplayer game
2. Navigates to **Game Detail** (`GameDetailScreenV4`) → user is told to challenge someone in a chat
3. In a DM/group chat, user taps **gamepad button** in `ChatComposer` → `GamePickerModal` opens
4. Picks a game → client calls `createGameInvite({ conversationId, conversationScope, gameId })`
5. **Server** (`createGameInviteV4`):
   - Auth check + conversation membership + 3s cooldown
   - Creates `GameInvitesV4/{inviteId}` doc with `status: "sent"`
   - Atomically appends to `pinnedGameInviteIds[]` (FIFO, max 5)
   - Sends push notification to conversation members
6. **Firestore created:** `GameInvitesV4/{inviteId}`
7. **Client screens:** `PinnedInviteBar` renders invite chip
8. Opponent taps chip → **Game Lobby** (`GameLobbyScreenV4`)
9. Taps "Join" → `joinInviteLobby({ inviteId })` → server adds to `participantIds`, status → `"lobby"`
10. Host taps "Start Game" → `startGameFromInvite({ inviteId })`
11. **Server** (`startGameFromInviteV4`):
    - Creates `GameSessionsV4/{sessionId}` with adapter's initial state
    - Writes `PublicState/state` subcollection
    - Transitions invite to `"active"`, sets `sessionId`
12. **Firestore created:** `GameSessionsV4/{sessionId}`, `PublicState/state`
13. Both clients auto-navigate to **Game Play** (`GamePlayDispatcherV4` → game-specific screen wrapped by `GameScreenShell`)
14. Players take turns via `submitTurnMove({ sessionId, movePayload })`
15. **Server** validates move via adapter, writes `Moves/{moveId}`, updates `PublicState/state`, advances turn
16. When adapter returns `terminal`, server calls `resolveSessionV4Internal()`
17. **Resolution pipeline** (10 phases):
    - Session `status → "resolved"`, invite `status → "resolved"` + TTL
    - Computes `GameResultV4` (scoreboard, XP, achievements, leaderboard)
    - Writes `GameResultsV4/{sessionId}`
    - Applies XP to `Users/{uid}.level`, unlocks level rewards
    - Updates `LeaderboardsV4/{gameId}/Weeks/{weekKey}/Entries/{uid}`
    - Updates `Users/{uid}/GamePB/{gameId}`
    - Unpins invite from conversation
    - Sets `rewardsProcessed: true`
    - Sends notifications (push + in-app)
18. **Firestore updated:** Session, invite, result, user levels, leaderboards, PBs, achievements, wallet, stats cache
19. `GameScreenShell` detects terminal → 1.5s delay → navigates to **Game Over** (`GameOverScreenV4`)
20. GameOver subscribes to `GameResultsV4/{sessionId}`, displays scoreboard, XP, achievements
21. User taps "Back to Chat" → `CommonActions.reset()` clears stack → returns to chat

### 3.2 Chat "Game Button" → Auto-Create Invite → Join → Play → Resolve → Return to Chat

Same as 3.1, starting from step 3. The chat gamepad button is the primary invite creation entry point for multiplayer games.

### 3.3 Solo Game: Hub → Resume or Create → Play → Suspend / Resolve

1. User opens **Games Hub** → taps a solo game (e.g., 2048)
2. Client calls `resumeOrCreateSoloSession({ gameId: "play_2048" })`
3. **Server** (`resumeOrCreateSoloSessionV4`):
   - Auth — queries for existing active solo session for this `gameId` + `uid`
   - If found: clears `soloSuspendedAt`, returns `{ sessionId, resumed: true }`
   - If not found: creates new session (same as `createSoloSessionV4`), returns `{ sessionId, resumed: false }`
   - **No invite doc. No lobby. No pin.**
4. Client navigates to **Game Play** → game screen (resumes previous state if existing)
5. Player interacts → `submitTurnMove()` sends moves
6. **Exit paths:**
   - **Back arrow / Android back:** calls `suspendSoloSession({ sessionId })` → sets `soloSuspendedAt` timestamp, navigates back. Session stays `"active"` — **no resign, no resolve.**
   - **Menu → Restart:** calls `restartSoloSession({ sessionId })` → resolves old session as resign, creates new session, replaces screen.
   - **Menu → Resign:** calls `resignSession({ sessionId })` → resolves as resign → Game Over screen.
   - **Game ends naturally:** resolve pipeline → `GameResultV4` created → auto-navigate to Game Over.

**Solo overlay controls:**

| Position  | Control         | Action                                            |
| --------- | --------------- | ------------------------------------------------- |
| Top-left  | Back arrow (←)  | Suspend + navigate back (non-destructive)         |
| Top-right | Menu button (⋮) | Opens solo menu modal (Restart / Resign / Resume) |

### 3.4 Resume Flow

- **Minimize app:** Firestore listeners survive; state is current on return
- **Navigate away (solo):** `suspendSoloSession` is called, setting `soloSuspendedAt`. Re-entering from Games Hub calls `resumeOrCreateSoloSession`, which finds the existing active session and resumes it.
- **Navigate away (multiplayer):** `useGameSessionV4` unsubscribes; re-entering via invite chip or push notification deep link re-subscribes
- **Push notification tap:** Deep link routes to `GamePlayV4({ sessionId })` (active) or `GameLobbyV4({ inviteId })` (lobby)
- **Motion/physics games (e.g., Brick Breaker):** The game registers a pause callback via `registerSoloPause`. On suspend, the shell calls this callback to freeze the game loop _before_ navigating away. On resume, the game re-enters in a paused state — the player must tap to restart the physics loop.

### 3.5 Spectate Flow (Turn-Based Only)

1. User taps "Watch" in lobby → `joinInviteLobby({ inviteId, asSpectator: true })`
2. Server adds to `spectatorIds`/`spectatorUids`
3. Spectator subscribes to `PublicState/state` — sees full public state
4. Adapter's `getSpectatorView()` can filter sensitive info (default: returns full state)
5. **Spectators cannot submit moves** — Firestore rules require `uid in participantUids`

**What you must implement:**

- If your game has hidden information, implement `getSpectatorView()` in your adapter to filter it
- Solo games do not support spectating (`supportsSpectate: false` in metadata)

---

## 4. Game Detail Page ("Steam-like") Requirements

The Game Detail screen (`GameDetailScreenV4`) is a "Steam-like" page showing everything about a game. It is **entirely data-driven** — no code changes to the screen are needed when adding a new game, only data.

### 4.1 Required Metadata Fields

**In `src/gamesV4/constants.ts`:**

```typescript
// GAME_METADATA — already has entries for all 20 games. Verify yours exists:
GAME_METADATA["your_game_id"] = {
  gameId: "your_game_id",
  displayName: "Your Game",
  runtimeType: "turnBased", // or "solo" or "realtime"
  minPlayers: 2,
  maxPlayers: 2,
  supportsSpectate: true,
  icon: "gamepad-variant", // MaterialCommunityIcons name
};

// GAME_DESCRIPTIONS — you MUST add this:
GAME_DESCRIPTIONS["your_game_id"] = {
  shortDescription: "A fun strategic board game.",
  howToPlay: "Take turns placing pieces on the board...",
  tips: "Control the center for an advantage.",
};

// SCOREBOARD_DESCRIPTORS — you MUST add this:
SCOREBOARD_DESCRIPTORS["your_game_id"] = {
  title: "MATCH RESULT", // or "FINAL SCORE"
  formatScore: (score: number) => {
    // For win/loss games: map 1→"Win", 0→"Loss", else→"Draw"
    // For score games: score.toLocaleString()
    return score === 1 ? "Win" : score === 0 ? "Loss" : "Draw";
  },
  sortDirection: "desc",
};

// LEADERBOARD_DESCRIPTORS — you MUST add this:
LEADERBOARD_DESCRIPTORS["your_game_id"] = {
  label: "Wins", // or "Best Score", "Best Time"
  metric: "wins", // or "bestScore"
  sortDirection: "desc", // "desc" for higher-is-better, "asc" for lower-is-better
  formatValue: (v: number) => `${v} win${v !== 1 ? "s" : ""}`,
};
```

### 4.2 Sections That Render on Game Detail Page

| #   | Section                    | Data Source                                                                | What Renders                                                             |
| --- | -------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | **Overview + How to Play** | `GAME_METADATA[gameId]`, `GAME_DESCRIPTIONS[gameId]`                       | Game icon, title, short description, "How to Play" expandable, tips      |
| 2   | **Play Actions**           | `IMPLEMENTED_GAME_IDS`, `createSoloSession()`                              | Solo: "Play Now" button. Multiplayer: "Challenge in chat" info text      |
| 3   | **Your Progress**          | `useGamePBV4(gameId)`, `getDefsForGame()`, `useAchievementsV4()`           | Achievement completion %, PB stats (total plays, total wins, best score) |
| 4   | **Leaderboards**           | `useLeaderboardV4(gameId)` (global), `fetchFriendsLeaderboard()` (friends) | Friends/Global toggle, ranked list with medals, current user highlighted |
| 5   | **Achievements**           | `getDefsForGame(gameId)` (static), `useAchievementsV4()` (earned)          | Difficulty badges, earned/locked state, token rewards, expand/collapse   |
| 6   | **Game History**           | `fetchGameHistoryByGame(uid, gameId, 20)`                                  | Recent matches: opponent names, outcome (Win/Loss/Draw), score, date     |

### 4.3 Where Content Lives

| Content                             | File Path                                                | How to Add                         |
| ----------------------------------- | -------------------------------------------------------- | ---------------------------------- |
| Game metadata (name, icon, players) | `src/gamesV4/constants.ts` → `GAME_METADATA`             | Already present for all 20 games   |
| Game descriptions                   | `src/gamesV4/constants.ts` → `GAME_DESCRIPTIONS`         | Add entry keyed by `gameId`        |
| Scoreboard formatting               | `src/gamesV4/constants.ts` → `SCOREBOARD_DESCRIPTORS`    | Add entry keyed by `gameId`        |
| Leaderboard formatting              | `src/gamesV4/constants.ts` → `LEADERBOARD_DESCRIPTORS`   | Add entry keyed by `gameId`        |
| Achievement definitions             | `src/gamesV4/data/achievementDefinitions.ts`             | Add section + defs                 |
| Backend achievement evaluator       | `firebase-backend/functions/src/gamesV4/achievements.ts` | Add defs with `evaluate` functions |
| Playable gate                       | `src/gamesV4/constants.ts` → `IMPLEMENTED_GAME_IDS`      | Add `gameId` to the Set            |

**What you must implement:**

- [ ] `GAME_DESCRIPTIONS` entry with `shortDescription`, `howToPlay`, and optionally `tips`
- [ ] `SCOREBOARD_DESCRIPTORS` entry with appropriate score formatting
- [ ] `LEADERBOARD_DESCRIPTORS` entry with metric type and formatting
- [ ] Add `gameId` to `IMPLEMENTED_GAME_IDS`
- [ ] Achievement definitions (see §8)

---

## 5. Game Adapter Contract (Client)

### 5.1 Interface Definition

Every game implements `GameAdapterV4` defined in `src/gamesV4/types/adapter.ts`:

```typescript
interface GameAdapterV4 {
  // Identity
  gameId: GameId;
  runtimeType: "solo" | "turnBased" | "realtime";
  maxPlayers: number;
  minPlayers: number;
  supportsSpectate: boolean;
  spectateMode: "public_only" | "post_game_only" | "full_state";
  settingsSchema: SettingsFieldDef[];
  defaultSettings: Record<string, unknown>;

  // Required — creates the starting game state
  createInitialPublicState(
    players: PlayerSlot[],
    settings: Record<string, unknown>,
  ): Record<string, unknown>;

  // Optional — per-player hidden state (e.g., cards dealt)
  createInitialPrivateState?(
    players: PlayerSlot[],
    settings: Record<string, unknown>,
  ): Record<string, Record<string, unknown>>;

  // Recommended — validates + applies a move, returns new state
  validateMove?(
    publicState: Record<string, unknown>,
    privateState: Record<string, unknown> | null,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult;

  // Optional — builds invite card summary
  computeSummary?(
    publicState: Record<string, unknown>,
    players: PlayerSlot[],
    turnPlayerId: string | null,
  ): { turnPlayerId: string | null; scoreSummary: ScoreSummaryEntry[] };

  // Optional — computes final outcome
  computeOutcome?(
    publicState: Record<string, unknown>,
    players: PlayerSlot[],
  ): GameOutcome;

  // Optional — filter state for spectators
  getSpectatorView?(
    publicState: Record<string, unknown>,
  ): Record<string, unknown>;

  // Optional — metrics stored in GameResultV4.performanceMetrics
  extractPerformanceMetrics?(
    publicState: Record<string, unknown>,
    players: PlayerSlot[],
  ): Record<string, unknown>;

  // Optional — validate lobby settings patch
  validateSettings?(patch: Record<string, unknown>): Record<string, unknown>;
}
```

### 5.2 MoveValidationResult

```typescript
interface MoveValidationResult {
  ok: boolean;
  error?: string;
  nextPublicState?: Record<string, unknown>;
  nextPrivateState?: Record<string, Record<string, unknown>>;
  scoreDelta?: Array<{ uid: string; delta: number }>;
  turnAdvance?: boolean; // true = advance to next player's turn
  terminal?: {
    type: "win" | "draw" | "timeout";
    winnerIds?: string[];
    reason?: string;
  };
}
```

### 5.3 GameOutcome

```typescript
interface GameOutcome {
  winnerIds: string[];
  finalScoreboard: Array<{
    uid: string;
    score: number;
    placement: number; // 1-indexed, ties share
    stats: Record<string, unknown>;
  }>;
}
```

### 5.4 ScoreboardDescriptor

Defined in `constants.ts`. Controls how scores display on the GameOver screen:

```typescript
interface ScoreboardDescriptor {
  title: string; // e.g., "MATCH RESULT" or "FINAL SCORE"
  formatScore?: (score: number) => string;
  sortDirection: "asc" | "desc";
}
```

**Rules:**

- Win/loss games (TTT, C4): `formatScore` maps `1 → "Win"`, `0 → "Loss"`, else `"Draw"`
- Score games (2048): `formatScore` uses `toLocaleString()` for comma formatting
- If omitted, raw score number is displayed

### 5.5 LeaderboardDescriptor

Controls how leaderboard values are computed and displayed:

```typescript
interface LeaderboardDescriptor {
  label: string; // Column header: "Wins", "Best Score"
  metric: "wins" | "bestScore";
  sortDirection: "asc" | "desc";
  formatValue: (v: number) => string;
}
```

**Metric behavior:**

- `"wins"`: Leaderboard `score` field increments by 1 on each win (cumulative per week). `GamePB.totalWins` used for friends leaderboard.
- `"bestScore"`: Leaderboard `score` = `Math.max(existing, matchScore)`. `GamePB.pbValue` used for friends leaderboard.

### 5.6 History Summary

Game history entries come from `GameResultsV4` documents. The result's `scoreboard[]` contains per-player scores, and `winnerIds` determines the outcome. No special adapter method is needed — the resolve pipeline builds results automatically.

**What is displayed in history:**

- Opponent names (from `scoreboard[].displayName`)
- Outcome: Win (green), Loss (red), Draw (orange)
- Score formatted via `SCOREBOARD_DESCRIPTORS[gameId]?.formatScore`

### 5.7 Supported Capabilities by Runtime

| Capability         | Solo                      | Turn-Based  | Realtime       |
| ------------------ | ------------------------- | ----------- | -------------- |
| `validateMove()`   | Required                  | Required    | N/A (Colyseus) |
| Spectators         | No                        | Yes         | No             |
| Turn switching     | No (`turnAdvance: false`) | Yes         | N/A            |
| Invite/Lobby       | No                        | Yes         | Yes (planned)  |
| `computeOutcome()` | Recommended               | Recommended | N/A            |

### 5.8 Registration

Client adapter self-registers at module load time:

```typescript
// src/gamesV4/adapters/myGame.ts
import { registerAdapter } from "./registry";
import type { GameAdapterV4 } from "../types";

const myGameAdapter: GameAdapterV4 = {
  /* ... */
};
registerAdapter(myGameAdapter);
export default myGameAdapter;
```

Then add a side-effect import in `src/gamesV4/adapters/index.ts`:

```typescript
import "./myGame";
```

**What you must implement:**

- [ ] Client adapter file at `src/gamesV4/adapters/{myGame}.ts`
- [ ] All required fields + `createInitialPublicState` + `validateMove` (for solo/turn-based)
- [ ] Side-effect import in `src/gamesV4/adapters/index.ts`
- [ ] Game screen component at `src/gamesV4/screens/{MyGame}ScreenV4.tsx`
- [ ] Wrap with `withGameV4Shell`: `export default withGameV4Shell(MyGameUI, "my_game_id")`
- [ ] Entry in `GAME_SCREEN_MAP` in `GamePlayDispatcherV4.tsx`

---

## 6. Backend Integration (Cloud Functions)

### 6.1 Server Adapter

The server adapter lives in `firebase-backend/functions/src/gamesV4/adapters.ts` alongside the 3 existing adapters. It mirrors the client adapter interface but runs authoritatively.

**Critical:** The server adapter's `validateMove()` must produce **identical results** to the client adapter for the same inputs. This ensures optimistic client validation matches authoritative server validation.

#### Nested Array Serialization

Firestore rejects native 2D arrays. The server has serialization helpers:

```typescript
// Applied AFTER createInitialPublicState and validateMove:
serializeStateForFirestore(state);
// Converts: [["X", null], ["O", "X"]]
// To:       { _nestedArray: true, length: 2, "0": ["X", null], "1": ["O", "X"] }

// Applied BEFORE adapter's validateMove:
deserializeStateFromFirestore(state);
// Reverses the encoding
```

Both are idempotent. The game runner (`runMove`) handles ser/deser automatically.

#### Registration

Add your adapter to the same file and call `registerAdapter()`:

```typescript
// In firebase-backend/functions/src/gamesV4/adapters.ts

const myGameAdapter: GameAdapterV4 = {
  gameId: "my_game_id",
  runtimeType: "turnBased",
  // ... full implementation
};
registerAdapter(myGameAdapter);
```

### 6.2 Session Creation / Join Endpoints

These are **generic** — no changes needed per game:

| Callable                | Purpose                        | Key Behavior                                                      |
| ----------------------- | ------------------------------ | ----------------------------------------------------------------- |
| `createGameInviteV4`    | Create invite + pin to chat    | Validates gameId, creates invite, pins atomically                 |
| `joinInviteLobbyV4`     | Join lobby as player/spectator | Conversation membership check, profile snapshot                   |
| `leaveInviteLobbyV4`    | Non-host leaves                | Idempotent, host cannot leave (must cancel)                       |
| `cancelGameInviteV4`    | Host cancels invite            | Transitions to resolved, unpins                                   |
| `startGameFromInviteV4` | Host starts game               | Creates session with adapter initial state, randomizes turn order |
| `createSoloSessionV4`   | Create solo session            | Bypasses invite/lobby, direct to active                           |

### 6.3 Turn Submission

`submitTurnMoveV4` (in `sessions.ts`):

```
1. assertAuth() + enforceCooldown(500ms)
2. Firestore transaction:
   a. Read session doc — verify active, caller == currentTurnPlayerId
   b. If adapter exists: runMove() — authoritative validation
   c. Write MoveDoc (status: "committed")
   d. Update PublicState/state
   e. Advance currentTurnIndex → next player
   f. Increment integrity.version
   g. Update invite summary (lastMoveAt, turnPlayerId, scoreSummary)
3. Post-transaction:
   a. If terminal → resolveSessionV4Internal()
   b. If not terminal → notifyTurn() to next player
```

### 6.4 Resolution Pipeline

`resolveSessionV4Internal()` in `resolve.ts` — the **single chokepoint** for all game endings:

| Phase | Action                                                            | Collections Written                               |
| ----- | ----------------------------------------------------------------- | ------------------------------------------------- |
| 1     | Atomic status transition (session → `"resolved"`)                 | `GameSessionsV4`                                  |
| 2     | Transition invite → `"resolved"`, set TTL (skipped for solo)      | `GameInvitesV4`                                   |
| 3     | Compute result: scoreboard, XP, achievements, leaderboard updates | (in-memory)                                       |
| 4     | Write `GameResultV4`                                              | `GameResultsV4`                                   |
| 5     | Apply XP, handle level-ups, unlock level rewards                  | `Users/{uid}`, `UserStatsCache`, `LevelRewardsV4` |
| 6     | Update leaderboard entries (weekly, metric-driven)                | `LeaderboardsV4`                                  |
| 7     | Update personal bests (PB only if improved)                       | `Users/{uid}/GamePB`                              |
| 8     | Unpin invite from conversation (skipped for solo)                 | `Chats`/`Groups`                                  |
| 9     | Mark `rewardsProcessed: true`                                     | `GameSessionsV4`                                  |
| 9.5   | Send achievement unlock in-app notifications                      | `InAppNotificationsV4`                            |
| 10    | Send resolved push/in-app notifications                           | Push + `InAppNotificationsV4`                     |

**Idempotency:** If session is already resolved/abandoned/expired, returns `null` (no-op).

**Reward retry:** Watchdog checks `rewardsProcessed === false` and re-runs phases 5-10 via `retryRewardsForSession()`.

### 6.5 Backend Leaderboard Metric

Defined in `firebase-backend/functions/src/gamesV4/types.ts` → `LEADERBOARD_METRICS`:

```typescript
const LEADERBOARD_METRICS: Record<string, "wins" | "bestScore"> = {
  tic_tac_toe: "wins",
  connect_four: "wins",
  play_2048: "bestScore",
  // default: "bestScore"
};
```

**You must add your game here** if the default (`"bestScore"`) doesn't apply.

### 6.6 Deploy

```powershell
cd firebase-backend/functions
npm run build
cd ../..
npx firebase deploy --only functions
```

**What you must implement:**

- [ ] Server adapter in `firebase-backend/functions/src/gamesV4/adapters.ts`
- [ ] Add leaderboard metric to `LEADERBOARD_METRICS` in `types.ts` (if not "bestScore")
- [ ] Add game-specific achievements to `achievements.ts` (see §8)
- [ ] Build + deploy Cloud Functions

---

## 7. Firestore Collections and Schemas

### 7.1 GameInvitesV4/{inviteId}

Created by `createGameInviteV4`. Represents a chat-pinned game challenge.

```json
{
  "inviteId": "abc123",
  "conversationId": "chat_dmId_or_groupId",
  "conversationScope": "dm",
  "gameId": "tic_tac_toe",
  "runtimeType": "turnBased",
  "createdBy": "uid_alice",
  "status": "sent",
  "hostId": "uid_alice",
  "participantIds": ["uid_alice"],
  "spectatorIds": [],
  "maxPlayers": 2,
  "allowSpectators": true,
  "spectateMode": "full_state",
  "sessionId": null,
  "summary": {
    "phase": "lobby",
    "turnPlayerId": null,
    "scoreSummary": [],
    "lastMoveAt": null,
    "lastActorId": null
  },
  "participantSummaries": [
    { "uid": "uid_alice", "displayName": "Alice", "profilePictureUrl": "..." }
  ],
  "spectatorSummaries": [],
  "hiddenInChat": false,
  "hiddenAt": null,
  "deleteRequestedAt": null,
  "deleteAt": null,
  "createdAt": "2026-03-04T...",
  "updatedAt": "2026-03-04T..."
}
```

**Written by:** Cloud Functions only. **Read by:** Conversation members.

### 7.2 GameSessionsV4/{sessionId}

Created by `startGameFromInviteV4`, `createSoloSessionV4`, or `resumeOrCreateSoloSessionV4`. Authoritative game state.

```json
{
  "sessionId": "sess_xyz",
  "inviteId": "abc123",
  "conversationId": "chat_dmId_or_groupId",
  "conversationScope": "dm",
  "gameId": "tic_tac_toe",
  "runtimeType": "turnBased",
  "status": "active",
  "hostId": "uid_alice",
  "players": [
    { "uid": "uid_alice", "slotIndex": 0, "displayName": "Alice" },
    { "uid": "uid_bob", "slotIndex": 1, "displayName": "Bob" }
  ],
  "spectators": [],
  "spectatorsAllowed": true,
  "spectateMode": "full_state",
  "settings": {},
  "turnOrder": ["uid_bob", "uid_alice"],
  "currentTurnIndex": 0,
  "currentTurnPlayerId": "uid_bob",
  "scoreboardSummary": [],
  "integrity": { "version": 1, "schemaVersion": 1, "traceId": "a1b2c3..." },
  "rewardsProcessed": false,
  "participantUids": ["uid_alice", "uid_bob"],
  "spectatorUids": [],
  "resolution": null,
  "createdAt": "...",
  "startedAt": "...",
  "resolvedAt": null
}
```

**Subcollections:**

| Sub                  | Doc ID             | Written By                    | Read By              |
| -------------------- | ------------------ | ----------------------------- | -------------------- |
| `PublicState/state`  | `"state"` (static) | Cloud Functions               | Conversation members |
| `PrivateState/{uid}` | Player UID         | Cloud Functions               | Owner only           |
| `Moves/{moveId}`     | Auto-ID            | Client (create) + CF (update) | Conversation members |

**Solo sessions:** `inviteId: ""`, `conversationId: ""`, `conversationScope: "dm"`, `soloSuspendedAt: null | Timestamp`. No invite doc exists. `soloSuspendedAt` is set when the player leaves via back arrow and cleared on resume.

### 7.3 GameResultsV4/{sessionId}

Created by `resolveSessionV4Internal` Phase 4.

```json
{
  "sessionId": "sess_xyz",
  "inviteId": "abc123",
  "conversationId": "chat_dmId_or_groupId",
  "gameId": "tic_tac_toe",
  "resolutionType": "win",
  "winnerIds": ["uid_alice"],
  "scoreboard": [
    {
      "uid": "uid_alice",
      "displayName": "Alice",
      "score": 1,
      "placement": 1,
      "stats": {}
    },
    {
      "uid": "uid_bob",
      "displayName": "Bob",
      "score": 0,
      "placement": 2,
      "stats": {}
    }
  ],
  "xpAwards": [
    {
      "uid": "uid_alice",
      "baseXP": 10,
      "bonusXP": 15,
      "totalXP": 25,
      "bonusReason": "win"
    },
    { "uid": "uid_bob", "baseXP": 10, "bonusXP": 0, "totalXP": 10 }
  ],
  "achievementUnlocks": [
    {
      "uid": "uid_alice",
      "achievementType": "game_first_win",
      "earnedAt": "..."
    }
  ],
  "leaderboardUpdates": [
    {
      "uid": "uid_alice",
      "gameId": "tic_tac_toe",
      "weekKey": "2026-W10",
      "newScore": 5
    }
  ],
  "durationMs": 45000,
  "totalMoves": 9,
  "participantIds": ["uid_alice", "uid_bob"],
  "performanceMetrics": { "totalMoves": 9 },
  "createdAt": "..."
}
```

**Written by:** Cloud Functions only. **Read by:** Participants.

### 7.4 Users/{uid}/GamePB/{gameId}

Personal bests — server-written with integrity hash.

```json
{
  "gameId": "tic_tac_toe",
  "pbValue": 15,
  "pbMeta": {},
  "achievedAt": "...",
  "sessionId": "sess_xyz",
  "totalPlays": 20,
  "totalWins": 15,
  "integrityHash": "sha256hex...",
  "schemaVersion": 1
}
```

**Integrity hash:** `SHA-256("uid:gameId:pbValue:sessionId")`.

### 7.5 LeaderboardsV4/{gameId}/Weeks/{weekKey}/Entries/{uid}

```json
{
  "uid": "uid_alice",
  "displayName": "Alice",
  "score": 5,
  "updatedAt": "..."
}
```

**Week key format:** `"YYYY-WNN"` (ISO-ish, computed by `currentWeekKey()` in `helpers.ts`).

### 7.6 Users/{uid}/Achievements/{type}

```json
{
  "type": "game_first_win",
  "sectionId": "getting_started",
  "difficulty": "easy",
  "tokenReward": 10,
  "earnedAt": "...",
  "sourceSessionId": "sess_xyz",
  "sourceGameId": "tic_tac_toe"
}
```

### 7.7 Users/{uid}/AchievementSections/{sectionId}

```json
{
  "sectionId": "tic_tac_toe",
  "claimedAt": "...",
  "badgeId": "section_tic_tac_toe"
}
```

### 7.8 Users/{uid}/UserStatsCache/stats

```json
{
  "gamesPlayed": 42,
  "gamesWon": 25
}
```

### 7.9 Users/{uid}/LevelRewardsV4/{level}

```json
{
  "level": 5,
  "unlockedAt": "...",
  "claimedAt": null,
  "tokenReward": 100,
  "cosmeticItemId": "bg_circling_waves",
  "schemaVersion": 1
}
```

### 7.10 Users/{uid}/GamePresence/{docId}

Client-written, used for notification gating:

```json
{
  "uid": "uid_alice",
  "sessionId": "sess_xyz",
  "gameId": "tic_tac_toe",
  "activeAt": "..."
}
```

**Written by:** `GameScreenShell` on mount. **Deleted:** on unmount. **Read by:** `notifyTurn()` backend.

### 7.11 Users/{uid}/InAppNotificationsV4/{notifId}

```json
{
  "type": "game_turn",
  "createdAt": "...",
  "deliveredAt": null,
  "readAt": null,
  "collapseKey": "sess:xyz:turn:uid_bob",
  "payload": {
    "sessionId": "sess_xyz",
    "inviteId": "abc123",
    "conversationId": "chat_dmId",
    "conversationScope": "dm",
    "gameId": "tic_tac_toe",
    "gameName": "Tic Tac Toe",
    "opponentName": "Alice"
  }
}
```

**Types:** `"game_turn"` | `"achievement_unlocked"`.

### 7.12 Existing Firestore Rules

All V4 collection rules are **already generic** — they don't reference specific game IDs. Adding a new game requires **no rule changes**. The existing rules cover:

- `GameInvitesV4` — conversation-scoped read, server-only write
- `GameSessionsV4` + subcollections — participant-scoped read, server-only write (except Moves: client create)
- `GameResultsV4` — participant read, server-only write
- `GamePB`, `Achievements`, `AchievementSections`, `UserStatsCache` — owner read, server-only write
- `LeaderboardsV4` — any auth read, server-only write
- `GamePresence` — any auth read, owner write
- `InAppNotificationsV4` — owner read, server create, owner update (limited fields)
- `RateLimits` — fully locked to server

### 7.13 Required Indexes

All 14 V4 composite indexes are **already generic** — they don't reference game IDs. No new indexes needed for a new game unless you add a custom query pattern.

---

## 8. Achievements (Per-Game Section) — Implementation Rules

### 8.1 Architecture

- Achievements are defined in `firebase-backend/functions/src/gamesV4/achievements.ts`
- Client mirror in `src/gamesV4/data/achievementDefinitions.ts`
- **One section per game** (section ID == `gameId`) plus a cross-game `"milestones"` section
- Each achievement has a `sectionId`, `difficulty`, `tokenReward`, and `evaluate()` function

### 8.2 Current Sections

| Section ID        | Title           | Achievement Count | Badge                     |
| ----------------- | --------------- | ----------------- | ------------------------- |
| `getting_started` | Getting Started | 2                 | `section_getting_started` |
| `grinder`         | Grinder         | 6                 | `section_grinder`         |
| `game_mastery`    | Game Mastery    | 3                 | `section_game_mastery`    |
| `speedster`       | Speedster       | 2                 | `section_speedster`       |
| `champion`        | Champion        | 3                 | `section_champion`        |
| `puzzle_master`   | Puzzle Master   | 2                 | `section_puzzle_master`   |

> **Note:** The client groups these into 4 display sections (tic_tac_toe, connect_four, play_2048, milestones) via `LEGACY_SECTION_MAP` and `resolveSection()`. The backend has 6 logical sections. When adding a new game, you'll add a new section.

### 8.3 Difficulty Tiers

| Difficulty  | Typical Token Range | Client Color     |
| ----------- | ------------------- | ---------------- |
| `easy`      | 5–10                | #34C759 (green)  |
| `medium`    | 15–25               | #FF9500 (orange) |
| `hard`      | 30–50               | #FF3B30 (red)    |
| `expert`    | 50                  | #AF52DE (purple) |
| `legendary` | 100                 | #FFD700 (gold)   |

### 8.4 Progress Models

| Model                | Example                | How Counted                                                       |
| -------------------- | ---------------------- | ----------------------------------------------------------------- |
| **Counter**          | "Play 10 games"        | `gamesPlayed` from `UserStatsCache` (pre-incremented before eval) |
| **Per-game counter** | "Play 10 games of TTT" | `totalPlays` from `GamePB/{gameId}` (pre-incremented)             |
| **Win counter**      | "Win 10 games"         | `gamesWon` from `UserStatsCache` (pre-incremented)                |
| **Speed**            | "Win in under 30s"     | `durationMs` from current session resolution                      |
| **Boolean**          | "Reach 2048 tile"      | Custom eval on `publicState` at resolution time                   |
| **Move count**       | "Win TTT in ≤5 moves"  | `totalMoves` from current session                                 |

### 8.5 Evaluation Flow

1. `resolveSessionV4Internal()` → Phase 3 calls `evaluateAchievementsV4()`
2. Pre-increments `totalPlays`/`totalWins` on `GamePB` and `gamesPlayed`/`gamesWon` on `UserStatsCache` **before** evaluation (so milestones fire on the correct game)
3. For each achievement definition, calls `evaluate()` with context: `{ uid, gameId, session, result, pb, statsCache }`
4. Skips already-earned achievements (reads `Users/{uid}/Achievements/{type}`)
5. For each new unlock: writes `Achievements/{type}` doc + increments `Wallets/{uid}.tokensBalance`

### 8.6 Adding Achievements for a New Game

#### Step 1: Backend — `firebase-backend/functions/src/gamesV4/achievements.ts`

Add a new section and achievement definitions:

```typescript
// Add to ACHIEVEMENT_SECTIONS array:
{
  sectionId: "my_game",
  title: "My Game",
  icon: "🎮",
  badgeId: "section_my_game",
}

// Add to GAME_ACHIEVEMENTS array:
{
  type: "my_game_first_play",
  name: "First Steps",
  description: "Play your first game of My Game",
  sectionId: "my_game",
  difficulty: "easy",
  tokenReward: 5,
  evaluate: (ctx) => ctx.gameId === "my_game" && ctx.pb.totalPlays >= 1,
},
{
  type: "my_game_10_wins",
  name: "My Game Champion",
  description: "Win 10 games of My Game",
  sectionId: "my_game",
  difficulty: "medium",
  tokenReward: 25,
  evaluate: (ctx) => ctx.gameId === "my_game"
    && ctx.result.winnerIds.includes(ctx.uid)
    && ctx.pb.totalWins >= 10,
},
// ... 8-18 more achievements across difficulty tiers
```

#### Step 2: Client Mirror — `src/gamesV4/data/achievementDefinitions.ts`

Add matching section and definitions (without `evaluate` functions):

```typescript
// Add to ACHIEVEMENT_SECTIONS:
{
  sectionId: "my_game",
  title: "My Game",
  icon: "🎮",
  description: "Master My Game",
  badgeId: "section_my_game",
}

// Add to ACHIEVEMENT_DEFS:
{
  type: "my_game_first_play",
  name: "First Steps",
  description: "Play your first game of My Game",
  sectionId: "my_game",
  difficulty: "easy",
  tokenReward: 5,
},
// ... mirror all backend defs
```

### 8.7 Completion Percentage

Computed client-side for the Game Detail page:

```
completionPct = (earned achievements in section) / (total defs in section) × 100
```

Uses `getDefsForGame(gameId)` to get the applicable achievement count and `useAchievementsV4()` for earned state.

### 8.8 Claim Badge Flow

When all achievements in a section are earned:

1. Client calls `claimAchievementSectionBadge({ sectionId })` (in `gameServiceV4.ts`)
2. **Server** (`claimAchievementSectionBadgeV4` callable):
   - Reads all `Achievements/{type}` docs for the section
   - Verifies all required achievements are earned
   - Batch writes: `AchievementSections/{sectionId}` + `Badges/{badgeId}` (tier: gold, category: achievement)
3. Idempotent: re-claiming returns `{ success: true, alreadyClaimed: true }`
4. Badge appears in user's profile customization inventory

### 8.9 Recommended Achievement Set (Per Game)

Aim for **10–20 achievements** across difficulty tiers:

| Count | Difficulty | Examples                                   |
| ----- | ---------- | ------------------------------------------ |
| 2–3   | easy       | First play, first win, 10 games            |
| 3–4   | medium     | 50 games, 10 wins, win streak              |
| 2–3   | hard       | 100 games, 50 wins, speed run              |
| 1–2   | expert     | Game-specific mastery (e.g., perfect game) |
| 0–1   | legendary  | Ultra-rare (e.g., 4096 tile in 2048)       |

**What you must implement:**

- [ ] Backend achievement definitions with `evaluate()` functions
- [ ] Client mirror of achievement definitions (no `evaluate`)
- [ ] Section entry for the new game
- [ ] Section badge ID registered

---

## 9. Leaderboards (Global + Friends) — Descriptor-Driven

### 9.1 Two Leaderboards

| Type                | Source                                                        | Scope                         |
| ------------------- | ------------------------------------------------------------- | ----------------------------- |
| **Global (weekly)** | `LeaderboardsV4/{gameId}/Weeks/{weekKey}/Entries/{uid}`       | All players, current ISO week |
| **Friends**         | `Users/{friendUid}/GamePB/{gameId}` (N+1 reads, capped at 20) | User's friends only           |

### 9.2 Metric Selection

The leaderboard metric varies by score type:

| Score Type                | Metric        | Computation                                                    | Display    |
| ------------------------- | ------------- | -------------------------------------------------------------- | ---------- |
| Points (higher better)    | `"bestScore"` | `Math.max(existing, matchScore)`                               | `"12,450"` |
| Time/Moves (lower better) | `"bestScore"` | `Math.max(existing, matchScore)` with inverted sign convention | `"0:32"`   |
| Wins (TTT-like)           | `"wins"`      | Increment by 1 on each win                                     | `"5 wins"` |

### 9.3 Backend Configuration

In `firebase-backend/functions/src/gamesV4/types.ts`:

```typescript
// Add your game's metric:
LEADERBOARD_METRICS["my_game"] = "wins"; // or "bestScore"
```

### 9.4 Client Configuration

In `src/gamesV4/constants.ts`:

```typescript
LEADERBOARD_DESCRIPTORS["my_game"] = {
  label: "Wins",
  metric: "wins",
  sortDirection: "desc",
  formatValue: (v) => `${v} win${v !== 1 ? "s" : ""}`,
};
```

### 9.5 How Global Leaderboard Works

1. `resolveSessionV4Internal()` Phase 6 computes `currentWeekKey()` (ISO week format `"YYYY-WNN"`)
2. For **wins-based** games: reads existing entry, increments `score` by 1 (only for winners)
3. For **bestScore-based** games: writes `Math.max(existingScore, matchScore)`
4. Entry path: `LeaderboardsV4/{gameId}/Weeks/{weekKey}/Entries/{uid}`

### 9.6 How Friends Leaderboard Works

Client-side N+1 query in `fetchFriendsLeaderboard()` (`gameServiceV4.ts`):

1. For each friend UID (capped at 20), reads `Users/{friendUid}/GamePB/{gameId}`
2. For **wins-based** games: uses `totalWins` field
3. For **bestScore-based** games: uses `pbValue` field
4. Sorts descending, resolves display names via profile cache

### 9.7 Existing Indexes

Leaderboard query: `Entries` subcollection, `score DESC`, `updatedAt ASC` — **already indexed**.

### 9.8 UI Requirements

- Friends/Global toggle on Game Detail page
- Ranked list with 🥇🥈🥉 medals for top 3
- Current user's row highlighted with tinted background
- Score formatted via `LeaderboardDescriptor.formatValue`
- "Be the first!" empty state

**What you must implement:**

- [ ] `LEADERBOARD_DESCRIPTORS` entry in `constants.ts`
- [ ] `LEADERBOARD_METRICS` entry in backend `types.ts` (if not "bestScore")

---

## 10. Game History + Recent Games (Opponents Visible)

### 10.1 What Gets Written on Resolve

`resolveSessionV4Internal()` writes the `GameResultsV4/{sessionId}` document containing:

- `scoreboard[]`: Array of `{ uid, displayName, avatarConfig?, profilePictureUrl?, score, placement, stats }`
- `winnerIds[]`: UIDs of winners
- `participantIds[]`: All player UIDs
- `durationMs`, `totalMoves`, `gameId`, `createdAt`

**No special action needed per game** — this is fully automatic from the resolve pipeline.

### 10.2 Denormalized Data

Opponent names/avatars are captured at resolve time from the session's `players[]` array into `scoreboard[].displayName` and `scoreboard[].profilePictureUrl`. This is a **snapshot** — if they change their name later, history shows the old name.

### 10.3 Per-Game History on Game Detail Page

`fetchGameHistoryByGame(uid, gameId, maxResults)` queries `GameResultsV4` where `participantIds` array-contains `uid` AND `gameId` equals the target, ordered by `createdAt` desc.

### 10.4 Recent Games / Game Stats

`fetchGameHistory(uid, maxResults)` queries `GameResultsV4` where `participantIds` array-contains `uid`, ordered by `createdAt` desc.

Display rules:

- **Opponent names:** All other players from `scoreboard[]` (excluding current user)
- **"+N" indicator:** When >2 players, shows first opponent name + `"+N others"`
- **Outcome color:** Win = green (#34C759), Loss = red (#FF3B30), Draw = orange (#FF9500)
- **Score:** Formatted via `SCOREBOARD_DESCRIPTORS[gameId]?.formatScore`

### 10.5 List Caps

- Game Detail page: 5 items default, "Show All" expands
- Game Stats page: 5 items default, "Show All" expands
- Max fetched: 20 per query

**What you must implement:**

- [ ] Nothing — history is fully automatic if your adapter returns valid `scoreboard` in `computeOutcome()`

---

## 11. In-App Notifications

### 11.1 Turn-Based "Your Turn" Notifications

**Trigger:** When a turn advances to the next player via `submitTurnMoveV4`.

**Backend dispatch:** `notifyTurn()` in `notifications.ts`:

1. Checks `GamePresence/{sessionId}` for the next-turn player
2. If presence doc exists and `activeAt` within 60 seconds → **skips** (player is already looking at the game)
3. Otherwise: writes `InAppNotificationsV4/{notifId}` doc AND sends push notification

**Payload:**

```typescript
{
  sessionId: string,
  inviteId?: string,
  conversationId: string,
  conversationScope: "dm" | "group",
  gameId: string,
  gameName: string,        // from GAME_DISPLAY_NAMES
  opponentName: string,    // last actor display name
}
```

**Client suppression:** `isInGamesArea(currentRouteName)` suppresses banner when user is on any Games screen. The notification doc is marked `deliveredAt` immediately (won't pop later).

**Tap routing:**

1. Primary: `GamePlayV4({ sessionId, gameId })`
2. Fallback: Navigate to chat for `conversationId`
3. Final fallback: Games Hub

**Collapse key:** `"sess:{sessionId}:turn:{uid}"` — same session+player overwrites previous undelivered turn notif.

### 11.2 Achievement Unlocked Notifications

**Trigger:** When `evaluateAchievementsV4()` unlocks new achievements during resolution.

**Backend dispatch:** `notifyAchievementUnlocked()` — in-app only (no push).

**Payload:**

```typescript
{
  achievementIds: string[],       // e.g., ["game_first_win", "game_10_sessions"]
  achievementTitles?: string[],   // human-readable names
  sectionId?: string,             // for deep-linking
  gameId?: string,
  sourceSessionId?: string,
}
```

**Tap routing:**

1. If `sectionId`: `AchievementSection({ sectionId })`
2. Otherwise: `AchievementsHub`

**Collapse key:** `"user:{uid}:achievement:{sessionId}"`.

### 11.3 Notification Gating Summary

| Check                  | Applies To         | Purpose                                                     |
| ---------------------- | ------------------ | ----------------------------------------------------------- |
| Mute check             | All push           | Muted conversations don't trigger pushes                    |
| Self-filter            | All                | Actor doesn't get their own notification                    |
| Presence gating        | Turn notifications | Skip if player is already on game screen                    |
| Games area suppression | In-app banners     | Suppress banner (mark delivered) when user is in Games area |
| 3-second debounce      | In-app             | Client-side via `shouldShowNotification()`                  |

**What you must implement:**

- [ ] Nothing for turn notifications — automatic for turn-based games
- [ ] Achievement notification titles come from your achievement definitions' `name` field

---

## 12. XP / Leveling / Level Rewards (Battlepass Track)

### 12.1 XP Sources

| Source             | XP Amount   | Condition                        |
| ------------------ | ----------- | -------------------------------- |
| Base participation | 10 XP       | Always (every game end)          |
| Win bonus          | 15 XP       | Winner only                      |
| Draw bonus         | 5 XP        | Draw result                      |
| Performance bonus  | Up to 10 XP | Reserved (not yet implemented)   |
| Achievement tokens | N/A         | Tokens, not XP (separate reward) |

Solo games: 10 XP base only (no win/draw bonus).

### 12.2 Level-Up Formula

```
xpToNextLevel(N) = floor(100 × 1.2^(N−1))
```

| Level | XP Required | Cumulative |
| ----- | ----------- | ---------- |
| 1→2   | 100         | 100        |
| 2→3   | 120         | 220        |
| 3→4   | 144         | 364        |
| 5→6   | 207         | —          |
| 10→11 | 515         | —          |
| 49→50 | 9,736       | —          |

### 12.3 Level Cap

- **Max level: 50** (enforced server-side in `applyXPAwards()`)
- `Users/{uid}.level.current` is clamped to 50
- At level 50: XP bar shows "MAX LEVEL", `xpToNextLevel` displays as full
- `totalXp` continues accumulating even at cap

### 12.4 XP Bar Display Format

- Level number: `"Level 12"` (or `"Level 50 (MAX)"`)
- XP progress: `50/250 XP`
- XP remaining: `"200 XP to next level"`
- At MAX: `250/250 XP`, no "to next" text

### 12.5 Level Rewards

Defined in `firebase-backend/functions/src/gamesV4/levelRewardsV4.ts` → `LEVEL_REWARDS_V4` and mirrored in `src/data/levelRewards.ts`.

| Level Type                      | Token Reward | Cosmetic                              |
| ------------------------------- | ------------ | ------------------------------------- |
| Non-milestone (1,2,3,4,6,7,...) | 50 tokens    | None                                  |
| Milestone 5                     | 100 tokens   | `bg_circling_waves` (Background)      |
| Milestone 10                    | 200 tokens   | `bg_aurora_borealis` (Background)     |
| Milestone 15                    | 300 tokens   | `badge_level_15` (Badge)              |
| Milestone 20                    | 400 tokens   | `bg_rune_circles` (Background)        |
| Milestone 25                    | 500 tokens   | `badge_level_25` (Badge)              |
| Milestone 30                    | 600 tokens   | `bg_synthwave` (Background)           |
| Milestone 35                    | 700 tokens   | `badge_level_35` (Badge)              |
| Milestone 40                    | 800 tokens   | `dec_golden_crown` (Decoration)       |
| Milestone 45                    | 900 tokens   | `badge_level_45` (Badge)              |
| Milestone 50                    | 1000 tokens  | `bg_synthwave_videogame` (Background) |

### 12.6 Reward Claiming

Rewards are **NOT auto-claimed**. User must manually claim each via:

- **Callable:** `claimLevelRewardV4({ level })`
- **Idempotent:** Returns `{ success: true, alreadyClaimed: true }` if already claimed
- **Batch claim:** Client "Claim All" iterates unclaimed rewards sequentially

**Claim flow:**

1. Validates auth, level range (1–50), user level ≥ requested level
2. Checks reward doc exists and `claimedAt === null`
3. Atomic batch: increment `Wallets/{uid}.tokensBalance` + create entitlement (if milestone cosmetic) + set `claimedAt`

### 12.7 UI Entry Points

- **Games Hub:** Level card with XP bar, unclaimed count badge, "View Rewards" tap
- **Game Over:** "Level up! Claim Reward" button when level-up occurred
- **Profile:** `onLevelPress` navigates to LevelRewards

### 12.8 Battlepass Track UI

`LevelRewardsScreen` (`src/gamesV4/screens/LevelRewardsScreen.tsx`):

- Horizontal scrollable track showing all 50 levels as tier nodes
- Progress rail fills to current level
- Node states: **Locked** (grey), **Unlocked** (blue + dot), **Claimed** (green checkmark)
- Milestones (every 5): larger nodes with gold border + cosmetic icon
- "Jump to current level" button
- Tap any tier → `TierDetailsSheet` bottom sheet with reward details + claim

**What you must implement:**

- [ ] Nothing — XP, leveling, and rewards are fully automatic via the resolve pipeline

---

## 13. Security (Rules) and Integrity

### 13.1 Server-Write-Only Collections

These collections **cannot** be written by clients:

| Collection                                              | Why                               |
| ------------------------------------------------------- | --------------------------------- |
| `GameInvitesV4`                                         | Prevents invite spoofing          |
| `GameSessionsV4` (doc + `PublicState` + `PrivateState`) | Prevents state manipulation       |
| `GameResultsV4`                                         | Prevents score forgery            |
| `Users/{uid}/GamePB/{gameId}`                           | PB with integrity hash            |
| `Users/{uid}/Achievements/{type}`                       | Prevents achievement forgery      |
| `Users/{uid}/AchievementSections/{sectionId}`           | Via callable only                 |
| `Users/{uid}/UserStatsCache/stats`                      | Server-computed aggregates        |
| `Users/{uid}/RateLimits/{action}`                       | Completely locked (server-only)   |
| `Users/{uid}/LevelRewardsV4/{level}`                    | Via callable only                 |
| `LeaderboardsV4/**`                                     | Prevents leaderboard manipulation |

### 13.2 Client-Writable Collections

| Collection             | What Client Can Do                   | Constraints                                                                              |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `Moves/{moveId}`       | `create` only                        | `uid == auth.uid`, `status == "pending"`, `movePayload is map`, `uid in participantUids` |
| `GamePresence/{docId}` | `create/update/delete` by owner      | `uid == auth.uid`                                                                        |
| `InAppNotificationsV4` | `update` by owner, `delete` by owner | Can only change `deliveredAt`/`readAt` (type, payload, collapseKey, createdAt immutable) |

### 13.3 Callable Verification

All callables start with `assertAuth(context)`. Conversation-scoped callables also check:

- `assertConversationMember(uid, conversationId, scope)` for invite/lobby operations

Session-scoped callables (`submitTurnMove`, `resign`) verify participant membership inside the Firestore transaction.

### 13.4 Anti-Forgery Measures

| Measure                                                      | Protects                              |
| ------------------------------------------------------------ | ------------------------------------- |
| Server-only writes to PB                                     | Can't fake high scores                |
| PB integrity hash (`SHA-256(uid:gameId:pbValue:sessionId)`)  | Detects PB document tampering         |
| Server adapter validation                                    | Moves are validated server-side       |
| Achievement evaluation server-side only                      | Can't unlock achievements client-side |
| Rate limiting (transactional)                                | Prevents spam/abuse                   |
| Payload sanitization (depth/size/prototype pollution checks) | Prevents payload bombs                |

### 13.5 Pitfalls to Avoid

- **Never trust client-supplied `winnerIds` or `resolutionType`** in your adapter — always compute outcomes authoritatively in `computeOutcome()`
- **Never write to reward/achievement/PB collections from client** — rules will block it
- **2D arrays must be serialized** for Firestore — use `serializeStateForFirestore()`
- **Rate limit violations** throw `resource-exhausted` — client must handle gracefully
- **Concurrent resolution** of two sessions for the same user may cause slightly inaccurate XP (accepted risk)

---

## 14. Testing and QA

### 14.1 New Game Integration QA Checklist

#### A. Games Hub & Game Detail

- [ ] Game appears in correct category (Solo / Turn-Based / Realtime) in Games Hub
- [ ] Game is **not** grayed out (is in `IMPLEMENTED_GAME_IDS`)
- [ ] Tapping game navigates to Game Detail screen
- [ ] Game Detail shows: icon, title, description, how-to-play, tips
- [ ] "Your Progress" shows 0/N achievements, 0 plays

#### B. Game Launch — Solo

- [ ] "Play Now" button on Game Detail creates or resumes solo session
- [ ] Navigates to game screen (no lobby)
- [ ] No invite doc created, no pin in any chat
- [ ] Game board renders correctly from initial state (or resumed state)
- [ ] Back arrow (top-left) suspends session and navigates back — does NOT resign
- [ ] Menu button (top-right) opens modal with Restart / Resign / Resume
- [ ] Restart resolves old session and starts new one
- [ ] Resign resolves session and shows Game Over
- [ ] Returning to Games Hub → tapping same solo game resumes the suspended session
- [ ] Motion games (e.g., Brick Breaker) pause on suspend and reopen paused

#### C. Game Launch — Multiplayer

- [ ] Create invite from chat → invite chip appears in `PinnedInviteBar`
- [ ] Other user sees chip → taps → navigates to lobby
- [ ] Other user taps "Join" → appears in lobby participant list
- [ ] Host taps "Start Game" → both navigate to game screen
- [ ] Invite status transitions: sent → lobby → active

#### D. Gameplay

- [ ] Moves validate correctly (invalid moves rejected with error)
- [ ] Turn advances to opponent after move
- [ ] Board state updates in real-time for both players
- [ ] Spectator can watch (if supported) and sees correct state
- [ ] Resign works → resolves game with resigner as loser
- [ ] Android back button: solo → suspends (non-destructive); multiplayer → resign confirmation

#### E. Game Over

- [ ] Game over screen shows after terminal move (1.5s delay)
- [ ] Hero section shows correct winner/draw/loss text
- [ ] Scoreboard formatted correctly via `SCOREBOARD_DESCRIPTORS`
- [ ] XP earned displays (base + bonus)
- [ ] Level-up callout shows if applicable
- [ ] Achievement unlocks display with correct names
- [ ] Action buttons work: Back to Chat / Back to Games / Rematch / Leaderboard / My Stats

#### F. Achievements

- [ ] `game_first_play` unlocks on first game
- [ ] `game_first_win` unlocks on first win
- [ ] Game-specific achievements evaluate correctly
- [ ] Token rewards credited to wallet
- [ ] Achievement section shows in Achievements Hub with progress bar
- [ ] Completing all achievements → "Claim Badge" button works
- [ ] Section badge appears in profile customization

#### G. Leaderboards

- [ ] Global weekly leaderboard updates after game
- [ ] Score metric correct (wins vs best score)
- [ ] Friends leaderboard shows correct data
- [ ] Formatting matches `LEADERBOARD_DESCRIPTORS`
- [ ] Current user highlighted in list

#### H. Game History

- [ ] History entry appears in Game Detail "Game History" section
- [ ] Shows opponent name(s) with "+N" for multi-player
- [ ] Outcome color correct (Win=green, Loss=red, Draw=orange)
- [ ] Score formatted correctly
- [ ] Appears in Game Stats "Recent Games" list

#### I. In-App Notifications

- [ ] Turn notification fires when it becomes opponent's turn
- [ ] Notification does NOT appear when user is on game screen (presence gating)
- [ ] Notification does NOT appear when user is in Games area (client suppression)
- [ ] Tapping turn notification navigates to active game
- [ ] Achievement unlock notification appears after new achievements
- [ ] Tapping achievement notification navigates to Achievements Hub/Section

#### J. XP / Level / Rewards

- [ ] XP awarded on game end (check Firestore `Users/{uid}.level`)
- [ ] Level-up computed correctly when threshold crossed
- [ ] Level rewards unlocked on level-up (`LevelRewardsV4/{level}` docs created)
- [ ] Level rewards claimable via LevelRewards screen
- [ ] Tokens credited to wallet on claim

#### K. Edge Cases

- [ ] Double-tap prevention: rapid start/join doesn't create duplicates
- [ ] Network disconnect during move: reconnect shows correct state
- [ ] App backgrounded during game: return shows current state
- [ ] Push notification deep link routes to correct screen
- [ ] Solo game has no invite artifacts in any chat
- [ ] Suspended solo session survives watchdog (not auto-resolved)
- [ ] No duplicate solo sessions created for same gameId + uid
- [ ] Watchdog expires stale invites after 24h of inactivity

### 14.2 Running Automated Tests

```powershell
# All V4 game tests
npx jest --testPathPattern=gamesV4

# Specific suites
npx jest --testPathPattern=gamesV4/adapters     # Adapter validation
npx jest --testPathPattern=gamesV4/resolve       # Resolution pipeline
npx jest --testPathPattern=gamesV4/validation    # Payload sanitization

# TypeScript compile checks
npx tsc --noEmit                                                      # Client
cd firebase-backend/functions; npm run build; cd ../..                # Backend
```

### 14.3 Troubleshooting

| Problem                         | Likely Cause                                | Where to Debug                                         |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| Game doesn't appear in Hub      | Not in `IMPLEMENTED_GAME_IDS`               | `src/gamesV4/constants.ts`                             |
| Game appears but "Coming Soon"  | Same as above                               | `src/gamesV4/constants.ts`                             |
| Tap game → error screen         | Not in `GAME_SCREEN_MAP`                    | `src/gamesV4/screens/GamePlayDispatcherV4.tsx`         |
| Move rejected server-side       | Adapter `validateMove` mismatch             | `firebase-backend/functions/src/gamesV4/adapters.ts`   |
| "resource-exhausted" error      | Rate limit cooldown                         | `firebase-backend/functions/src/gamesV4/validation.ts` |
| Game over never shows           | `terminal` not returned from `validateMove` | Check adapter returns `terminal` object                |
| No XP/achievements              | `resolveSessionV4Internal` failed           | Cloud Function logs (filter `[resolveV4]`)             |
| `rewardsProcessed: false` stuck | Reward phases errored                       | Watchdog will retry; check logs                        |
| Leaderboard empty               | Metric not configured                       | `LEADERBOARD_METRICS` in `types.ts`                    |
| Friends leaderboard wrong       | PB doc missing `totalWins`                  | Check `Users/{uid}/GamePB/{gameId}`                    |
| Notifications not appearing     | Presence doc suppressing turn, or muted     | Check `GamePresence` doc, mute state                   |
| 2D array Firestore error        | Missing serialization                       | Use `serializeStateForFirestore()`                     |
| Scoreboard shows raw numbers    | Missing `SCOREBOARD_DESCRIPTORS`            | `src/gamesV4/constants.ts`                             |

---

## 15. Copy-Paste Templates / Skeletons

### 15.1 Client Adapter Skeleton

```typescript
// src/gamesV4/adapters/{myGame}.ts
import { registerAdapter } from "./registry";
import type {
  GameAdapterV4,
  MoveValidationResult,
  GameOutcome,
} from "../types";
import type { PlayerSlot, ScoreSummaryEntry } from "../types/common";

// ─── Types ────────────────────────────────────────────────
interface MyGamePublicState {
  board: unknown[][]; // Replace with your board type
  scores: Record<string, number>;
  moveCount: number;
}

interface MyGameMovePayload {
  row: number;
  col: number;
  // Add your move fields
}

// ─── Adapter ──────────────────────────────────────────────
const myGameAdapter: GameAdapterV4 = {
  gameId: "my_game", // Must match GameId union
  runtimeType: "turnBased", // or "solo"
  maxPlayers: 2,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "full_state",
  settingsSchema: [],
  defaultSettings: {},

  createInitialPublicState(players: PlayerSlot[], _settings) {
    return {
      board: Array(8)
        .fill(null)
        .map(() => Array(8).fill(null)),
      scores: Object.fromEntries(players.map((p) => [p.uid, 0])),
      moveCount: 0,
    };
  },

  validateMove(
    publicState,
    _privateState,
    movePayload,
    ctx,
  ): MoveValidationResult {
    const state = publicState as unknown as MyGamePublicState;
    const move = movePayload as unknown as MyGameMovePayload;
    const { uid, turnOrder, currentTurnIndex } = ctx;

    // 1. Validate move is legal
    if (state.board[move.row][move.col] !== null) {
      return { ok: false, error: "Cell occupied" };
    }

    // 2. Clone state and apply move
    const nextBoard = state.board.map((r) => [...r]);
    nextBoard[move.row][move.col] = uid;

    const nextState: MyGamePublicState = {
      ...state,
      board: nextBoard,
      moveCount: state.moveCount + 1,
    };

    // 3. Check win/draw conditions
    const winner = checkWinner(nextBoard);
    if (winner) {
      nextState.scores[winner] = 1;
      return {
        ok: true,
        nextPublicState: nextState as unknown as Record<string, unknown>,
        scoreDelta: [{ uid: winner, delta: 1 }],
        turnAdvance: false,
        terminal: { type: "win", winnerIds: [winner] },
      };
    }

    if (isBoardFull(nextBoard)) {
      return {
        ok: true,
        nextPublicState: nextState as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: { type: "draw" },
      };
    }

    // 4. Not terminal — advance turn
    return {
      ok: true,
      nextPublicState: nextState as unknown as Record<string, unknown>,
      turnAdvance: true,
    };
  },

  computeSummary(publicState, players, turnPlayerId) {
    const state = publicState as unknown as MyGamePublicState;
    return {
      turnPlayerId,
      scoreSummary: players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName ?? "???",
        score: state.scores[p.uid] ?? 0,
      })),
    };
  },

  computeOutcome(publicState, players): GameOutcome {
    const state = publicState as unknown as MyGamePublicState;
    const sorted = [...players].sort(
      (a, b) => (state.scores[b.uid] ?? 0) - (state.scores[a.uid] ?? 0),
    );
    return {
      winnerIds: sorted
        .filter((p) => (state.scores[p.uid] ?? 0) > 0)
        .map((p) => p.uid),
      finalScoreboard: sorted.map((p, i) => ({
        uid: p.uid,
        score: state.scores[p.uid] ?? 0,
        placement: i + 1,
        stats: {},
      })),
    };
  },

  extractPerformanceMetrics(publicState) {
    const state = publicState as unknown as MyGamePublicState;
    return { totalMoves: state.moveCount };
  },
};

// ─── Helpers ──────────────────────────────────────────────
function checkWinner(board: unknown[][]): string | null {
  // TODO: Implement win detection for your game
  return null;
}

function isBoardFull(board: unknown[][]): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

// ─── Register ─────────────────────────────────────────────
registerAdapter(myGameAdapter);
export default myGameAdapter;
```

### 15.2 Game Screen Skeleton

```tsx
// src/gamesV4/screens/{MyGame}ScreenV4.tsx
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import {
  withGameV4Shell,
  type GameShellProps,
} from "../components/GameScreenShell";

function MyGameUI({
  publicState,
  isMyTurn,
  isTerminal,
  myUid,
  turnOrder,
  currentTurnIndex,
  submitMove,
  actionLoading,
  actionError,
  sessionId,
  registerSoloPause, // Solo games only — register a callback to freeze local game state on suspend
}: GameShellProps) {
  const state = publicState as unknown as MyGamePublicState;

  // ── Solo pause registration ─────────────────────────────
  // If your game has a local game loop, animation, or timer,
  // register a pause callback so the shell can freeze it before
  // suspending the session. This is REQUIRED for motion/physics games.
  //
  // React.useEffect(() => {
  //   registerSoloPause?.(() => { setPaused(true); });
  // }, [registerSoloPause]);

  if (!state?.board) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const handleCellPress = (row: number, col: number) => {
    if (!isMyTurn || isTerminal || actionLoading) return;
    submitMove({ row, col });
  };

  return (
    <View style={styles.container}>
      {/* Turn indicator */}
      <Text style={styles.turnText}>
        {isTerminal ? "Game Over" : isMyTurn ? "Your Turn" : "Opponent's Turn"}
      </Text>

      {/* Game board */}
      {state.board.map((row: unknown[], ri: number) => (
        <View key={ri} style={styles.row}>
          {row.map((cell: unknown, ci: number) => (
            <TouchableOpacity
              key={ci}
              style={styles.cell}
              onPress={() => handleCellPress(ri, ci)}
              disabled={!isMyTurn || cell !== null}
            >
              <Text style={styles.cellText}>{(cell as string) ?? ""}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {/* Error display */}
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  turnText: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  row: { flexDirection: "row" },
  cell: {
    width: 60,
    height: 60,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { fontSize: 24 },
  error: { color: "red", marginTop: 8 },
});

export default withGameV4Shell(MyGameUI, "my_game");
```

### 15.3 Game Detail Content Template

Add to `src/gamesV4/constants.ts`:

```typescript
GAME_DESCRIPTIONS["my_game"] = {
  shortDescription: "A strategic board game where you out-think your opponent.",
  howToPlay:
    "Take turns placing pieces on the board. The first player to form " +
    "a continuous line of 5 pieces wins. Horizontal, vertical, and diagonal " +
    "lines all count.",
  tips:
    "Control the center of the board. Watch for your opponent's three-in-a-row " +
    "setups and block them before they connect.",
};
```

### 15.4 Scoreboard Descriptor Template

```typescript
// For win/loss games:
SCOREBOARD_DESCRIPTORS["my_game"] = {
  title: "MATCH RESULT",
  formatScore: (score: number) =>
    score === 1 ? "Win" : score === 0 ? "Loss" : "Draw",
  sortDirection: "desc",
};

// For score-based games:
SCOREBOARD_DESCRIPTORS["my_game"] = {
  title: "FINAL SCORE",
  formatScore: (score: number) => score.toLocaleString(),
  sortDirection: "desc",
};

// For time-based games (lower is better):
SCOREBOARD_DESCRIPTORS["my_game"] = {
  title: "TIME",
  formatScore: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  },
  sortDirection: "asc",
};
```

### 15.5 Leaderboard Descriptor Template

```typescript
// For wins-based games:
LEADERBOARD_DESCRIPTORS["my_game"] = {
  label: "Wins",
  metric: "wins",
  sortDirection: "desc",
  formatValue: (v: number) => `${v} win${v !== 1 ? "s" : ""}`,
};

// For best-score games:
LEADERBOARD_DESCRIPTORS["my_game"] = {
  label: "Best Score",
  metric: "bestScore",
  sortDirection: "desc",
  formatValue: (v: number) => v.toLocaleString(),
};
```

### 15.6 Achievement Definitions Template

**Backend** (`firebase-backend/functions/src/gamesV4/achievements.ts`):

```typescript
// Section definition:
{ sectionId: "my_game", title: "My Game", icon: "🎮", badgeId: "section_my_game" }

// Achievement definitions (add to GAME_ACHIEVEMENTS array):
{
  type: "my_game_first_play",
  name: "The Journey Begins",
  description: "Play your first game of My Game",
  sectionId: "my_game",
  difficulty: "easy",
  tokenReward: 5,
  evaluate: (ctx) => ctx.gameId === "my_game" && ctx.pb.totalPlays >= 1,
},
{
  type: "my_game_first_win",
  name: "First Blood",
  description: "Win your first game of My Game",
  sectionId: "my_game",
  difficulty: "easy",
  tokenReward: 10,
  evaluate: (ctx) => ctx.gameId === "my_game"
    && ctx.result.winnerIds.includes(ctx.uid)
    && ctx.pb.totalWins >= 1,
},
{
  type: "my_game_10_games",
  name: "Getting Hooked",
  description: "Play 10 games of My Game",
  sectionId: "my_game",
  difficulty: "medium",
  tokenReward: 15,
  evaluate: (ctx) => ctx.gameId === "my_game" && ctx.pb.totalPlays >= 10,
},
{
  type: "my_game_10_wins",
  name: "My Game Veteran",
  description: "Win 10 games of My Game",
  sectionId: "my_game",
  difficulty: "medium",
  tokenReward: 25,
  evaluate: (ctx) => ctx.gameId === "my_game"
    && ctx.result.winnerIds.includes(ctx.uid)
    && ctx.pb.totalWins >= 10,
},
{
  type: "my_game_mastery",
  name: "My Game Master",
  description: "Achieve a specific impressive feat in My Game",
  sectionId: "my_game",
  difficulty: "hard",
  tokenReward: 40,
  evaluate: (ctx) => {
    if (ctx.gameId !== "my_game") return false;
    // Custom condition based on publicState
    return false; // TODO: implement
  },
},
```

**Client mirror** (`src/gamesV4/data/achievementDefinitions.ts`):

```typescript
// Section (add to ACHIEVEMENT_SECTIONS):
{ sectionId: "my_game", title: "My Game", icon: "🎮", description: "Master My Game", badgeId: "section_my_game" }

// Defs (add to ACHIEVEMENT_DEFS):
{ type: "my_game_first_play", name: "The Journey Begins", description: "Play your first game of My Game", sectionId: "my_game", difficulty: "easy", tokenReward: 5 },
{ type: "my_game_first_win", name: "First Blood", description: "Win your first game of My Game", sectionId: "my_game", difficulty: "easy", tokenReward: 10 },
{ type: "my_game_10_games", name: "Getting Hooked", description: "Play 10 games of My Game", sectionId: "my_game", difficulty: "medium", tokenReward: 15 },
{ type: "my_game_10_wins", name: "My Game Veteran", description: "Win 10 games of My Game", sectionId: "my_game", difficulty: "medium", tokenReward: 25 },
{ type: "my_game_mastery", name: "My Game Master", description: "Achieve a specific impressive feat in My Game", sectionId: "my_game", difficulty: "hard", tokenReward: 40 },
```

### 15.7 Backend Leaderboard Metric Entry

In `firebase-backend/functions/src/gamesV4/types.ts`:

```typescript
// Add to LEADERBOARD_METRICS:
"my_game": "wins",   // or "bestScore"
```

### 15.8 Integration Wiring Checklist (Summary)

| #   | File                                                     | Change                                                                                                  |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | `src/gamesV4/types/common.ts`                            | Check `GameId` union includes your game (already present for all 20)                                    |
| 2   | `src/gamesV4/adapters/{myGame}.ts`                       | Create client adapter                                                                                   |
| 3   | `src/gamesV4/adapters/index.ts`                          | Add `import "./{myGame}"`                                                                               |
| 4   | `src/gamesV4/screens/{MyGame}ScreenV4.tsx`               | Create game screen with `withGameV4Shell`                                                               |
| 5   | `src/gamesV4/screens/GamePlayDispatcherV4.tsx`           | Add to `GAME_SCREEN_MAP`                                                                                |
| 6   | `src/gamesV4/constants.ts`                               | Add to `IMPLEMENTED_GAME_IDS`, `GAME_DESCRIPTIONS`, `SCOREBOARD_DESCRIPTORS`, `LEADERBOARD_DESCRIPTORS` |
| 7   | `src/gamesV4/data/achievementDefinitions.ts`             | Add section + achievement defs                                                                          |
| 8   | `firebase-backend/functions/src/gamesV4/adapters.ts`     | Add server adapter                                                                                      |
| 9   | `firebase-backend/functions/src/gamesV4/types.ts`        | Add `LEADERBOARD_METRICS` entry (if needed)                                                             |
| 10  | `firebase-backend/functions/src/gamesV4/achievements.ts` | Add section + achievement defs with `evaluate()` functions                                              |
| 11  | Deploy                                                   | `npm run build` + `firebase deploy --only functions`                                                    |

---

## 16. Animation Architecture (CRITICAL)

> **DO NOT use `react-native-reanimated` for game animations.** Use React Native's built-in `Animated` API instead. This is a **hard rule** — violating it will cause animations to silently fail on iOS and Android while appearing to work on web.

### 16.1 Background

The project has `react-native-reanimated` ~4.1.1 installed (required by some navigation/UI libraries). However, in our environment (React 19.1.0 + React Native 0.81.5 + Fabric + `react-native-worklets-core/plugin`), reanimated's worklet-based animation pipeline **does not produce visible animation frames on native mobile**. Animations jump instantly to their final values.

This was discovered after three rounds of failed debugging across Tic-Tac-Toe, Connect Four, and Chess — all of which used reanimated and all of which had broken animations on mobile. The 2048 game, which uses the core `Animated` API, worked perfectly on all platforms from day one.

**Why web works but mobile doesn't:** On web, reanimated falls back to JS-thread execution (no native worklets), so animations render correctly via `requestAnimationFrame`. On native, the worklet compilation/execution pipeline fails silently.

See [ANIMATION_PIPELINE.md](ANIMATION_PIPELINE.md) for the full forensic analysis.

### 16.2 Required Pattern: Core `Animated` API

All game screen animations **must** use `Animated` from `react-native` (NOT from `react-native-reanimated`):

```tsx
// ✅ CORRECT — use this
import { Animated, Easing } from "react-native";

// ❌ WRONG — do NOT use for game animations
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
```

### 16.3 Animation Primitives Cheat Sheet

| What You Want               | How To Do It                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Store an animated value** | `const val = useRef(new Animated.Value(initial)).current`                                                                   |
| **Tween to a target**       | `Animated.timing(val, { toValue: target, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()` |
| **Spring to a target**      | `Animated.spring(val, { toValue: target, damping: 12, stiffness: 180, useNativeDriver: true }).start()`                     |
| **Sequential animations**   | `Animated.sequence([anim1, anim2]).start()`                                                                                 |
| **Parallel animations**     | `Animated.parallel([anim1, anim2]).start()`                                                                                 |
| **Looping animation**       | `Animated.loop(Animated.sequence([anim1, anim2]))`                                                                          |
| **Fade-in on mount**        | `useEffect(() => { Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start() }, [])`           |
| **Combine two values**      | `Animated.multiply(valA, valB)` — use for combined scale/opacity                                                            |
| **Interpolation**           | `val.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] })`                                                            |

### 16.4 Reference Pattern: Animated Game Piece

Copy this pattern for any game piece that needs mount-time animation:

```tsx
import React, { useRef, useEffect } from "react";
import { Animated, Easing } from "react-native";

function AnimatedPiece({ animate }: { animate: boolean }) {
  const scale = useRef(new Animated.Value(animate ? 0.5 : 1)).current;
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (animate) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          damping: 12,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, []); // mount only — key-based remount handles re-triggers

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      {/* Your piece content */}
    </Animated.View>
  );
}
```

### 16.5 Reference Pattern: Position Slide (Offset Model)

For pieces that move from one position to another (chess, checkers, etc.), use the **offset model** from 2048:

```tsx
function AnimatedPieceWrapper({
  startX,
  startY,
  targetX,
  targetY,
  shouldAnimate,
}) {
  // Offset = how far from target the piece starts
  const offsetX = useRef(
    new Animated.Value(shouldAnimate ? startX - targetX : 0),
  ).current;
  const offsetY = useRef(
    new Animated.Value(shouldAnimate ? startY - targetY : 0),
  ).current;

  useEffect(() => {
    if (shouldAnimate) {
      Animated.parallel([
        Animated.timing(offsetX, {
          toValue: 0,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(offsetY, {
          toValue: 0,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: targetX, // ← always at correct final position
        top: targetY,
        transform: [{ translateX: offsetX }, { translateY: offsetY }],
      }}
    >
      {/* Piece content */}
    </Animated.View>
  );
}
```

**Why offset model?** If the animation fails for any reason, the piece is already at its correct final position (`left`/`top`). The `translateX`/`translateY` just add a temporary offset that animates to 0.

### 16.6 Key Architectural Rules

1. **Always use `useNativeDriver: true`** — this runs the animation on the native thread, not JS. It's the whole point of using core Animated.
2. **Store values in `useRef`** — `new Animated.Value()` must be created once and stored in a ref. Never create it during render without a ref.
3. **Use key-based remount for re-triggering** — change the React `key` to force a fresh component mount with fresh `Animated.Value` instances. Don't try to reset and re-animate existing values.
4. **Fire animations in `useEffect(() => {}, [])`** — mount-only. The key-based remount strategy means you only need to animate once per mount.
5. **`useNativeDriver: true` only supports `transform` and `opacity`** — you cannot animate `width`, `height`, `backgroundColor`, `left`, `top`, etc. with the native driver. Use transforms instead.
6. **Use `Animated.View`** from `react-native`, not from `react-native-reanimated`.

### 16.7 What About `react-native-reanimated`?

`react-native-reanimated` is still installed and used by some non-game UI components (navigation transitions, modal overlays, etc.). **Do not uninstall it.** But for any animation inside a game screen (`src/gamesV4/screens/`), use only the core `Animated` API.

If a future Expo/RN/Reanimated update fixes the worklet pipeline, this restriction can be revisited — but the core `Animated` API is stable, performant, and proven, so there's no compelling reason to switch back.

---

## Appendix A: Game Catalog (20 Games)

| Category   | GameId              | Display Name   | Playable?      |
| ---------- | ------------------- | -------------- | -------------- |
| Solo       | `bounce_blitz`      | Bounce Blitz   | ❌ Coming Soon |
| Solo       | `play_2048`         | 2048           | ✅             |
| Solo       | `brick_breaker`     | Brick Breaker  | ❌ Coming Soon |
| Solo       | `word_master`       | Word Master    | ❌ Coming Soon |
| Solo       | `minesweeper`       | Minesweeper    | ❌ Coming Soon |
| Solo       | `lights_out`        | Lights Out     | ❌ Coming Soon |
| Turn-based | `tic_tac_toe`       | Tic Tac Toe    | ✅             |
| Turn-based | `chess`             | Chess          | ❌ Coming Soon |
| Turn-based | `checkers`          | Checkers       | ❌ Coming Soon |
| Turn-based | `connect_four`      | Connect Four   | ✅             |
| Turn-based | `gomoku`            | Gomoku         | ❌ Coming Soon |
| Turn-based | `reversi`           | Reversi        | ❌ Coming Soon |
| Turn-based | `dots_and_boxes`    | Dots & Boxes   | ❌ Coming Soon |
| Realtime   | `pong_game`         | Pong           | ❌ Coming Soon |
| Realtime   | `battleship`        | Battleship     | ❌ Coming Soon |
| Realtime   | `sketch_party_game` | Sketch Party   | ❌ Coming Soon |
| Realtime   | `starforge_game`    | Starforge      | ❌ Coming Soon |
| Realtime   | `crossword_puzzle`  | Crossword      | ❌ Coming Soon |
| Realtime   | `minigolf_duels`    | Minigolf Duels | ❌ Coming Soon |
| Realtime   | `dot_match`         | Dot Match      | ❌ Coming Soon |

## Appendix B: XP Table (Selected Levels)

| Level | XP to Next | Cumulative XP |
| ----- | ---------- | ------------- |
| 1     | 100        | 0             |
| 2     | 120        | 100           |
| 3     | 144        | 220           |
| 5     | 207        | 573           |
| 10    | 515        | 2,159         |
| 15    | 1,283      | 5,874         |
| 20    | 3,194      | 13,756        |
| 25    | 7,950      | 29,862        |
| 30    | 19,787     | 61,753        |
| 40    | 122,599    | 324,023       |
| 50    | (MAX)      | ~1,420,000    |

## Appendix C: Rate Limit Quick-Reference

| Action        | Cooldown Key       | Window   |
| ------------- | ------------------ | -------- |
| Create invite | `createInviteV4`   | 3,000 ms |
| Join lobby    | `joinLobbyV4`      | 2,000 ms |
| Leave lobby   | `leaveLobbyV4`     | 2,000 ms |
| Cancel invite | `cancelInviteV4`   | 2,000 ms |
| Start game    | `startGameV4`      | 2,000 ms |
| Start solo    | `startSoloV4`      | 3,000 ms |
| Submit move   | `submitTurnMoveV4` | 500 ms   |

## Appendix D: Deployed Cloud Functions (V4)

| Function                         | Type      | Trigger          |
| -------------------------------- | --------- | ---------------- |
| `createGameInviteV4`             | Callable  | Client call      |
| `joinInviteLobbyV4`              | Callable  | Client call      |
| `leaveInviteLobbyV4`             | Callable  | Client call      |
| `cancelGameInviteV4`             | Callable  | Client call      |
| `updateLobbySettingsV4`          | Callable  | Client call      |
| `startGameFromInviteV4`          | Callable  | Client call      |
| `createSoloSessionV4`            | Callable  | Client call      |
| `submitTurnMoveV4`               | Callable  | Client call      |
| `resignSessionV4`                | Callable  | Client call      |
| `claimLevelRewardV4`             | Callable  | Client call      |
| `claimAchievementSectionBadgeV4` | Callable  | Client call      |
| `onGameInviteV4Deleted`          | Trigger   | Firestore delete |
| `onSessionV4StatusChanged`       | Trigger   | Firestore update |
| `watchdogGamesV4`                | Scheduled | Every 30 minutes |
