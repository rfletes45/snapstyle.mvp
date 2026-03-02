# Unified Lobby System

Last verified: 2026-03-01

> Describes the implemented v3 session-first lobby pipeline for all 20 games.
> For the full game system reference, see `docs/GAMES_SYSTEM.md`.
> For runtime shell architecture, see `docs/GAMES_SYSTEM.md` §26.

---

## 1. Game Registry

### 1a. All 20 Games

| #   | Game ID               | Name            | Runtime     | Players | Multiplayer | Screen Route          | V3 Aware |
| --- | --------------------- | --------------- | ----------- | ------- | ----------- | --------------------- | -------- |
| 1   | `bounce_blitz`        | Bounce Blitz    | solo        | 1       | No          | BounceBlitzGame       | Deferred |
| 2   | `play_2048`           | 2048            | solo        | 1       | No          | Play2048Game          | Deferred |
| 3   | `word_master`         | Word            | solo        | 1       | No          | WordGame              | ✅       |
| 4   | `brick_breaker`       | Brick Breaker   | solo        | 1       | No          | BrickBreakerGame      | Deferred |
| 5   | `minesweeper_classic` | Minesweeper     | solo        | 1       | No          | MinesweeperGame       | ✅       |
| 6   | `lights_out`          | Lights Out      | solo        | 1       | No          | LightsOutGame         | ✅       |
| 7   | `chess`               | Chess           | turnBased   | 2       | Yes         | ChessGame             | ✅       |
| 8   | `checkers`            | Checkers        | turnBased   | 2       | Yes         | CheckersGame          | ✅       |
| 9   | `tic_tac_toe`         | Tic-Tac-Toe     | turnBased   | 2       | Yes         | TicTacToeGame         | ✅       |
| 10  | `connect_four`        | Four            | turnBased   | 1-2     | Yes         | FourGame              | ✅       |
| 11  | `dot_match`           | Dots            | turnBased\* | 1-2     | Yes         | DotsGame              | ✅       |
| 12  | `gomoku_master`       | Gomoku          | turnBased   | 1-2     | Yes         | GomokuGame            | ✅       |
| 13  | `reversi_game`        | Reversi         | turnBased   | 1-2     | Yes         | ReversiGame           | ✅       |
| 14  | `crazy_eights`        | Crazy Cards     | realtime    | 1-5     | Yes         | CrazyEightsGame       | ✅       |
| 15  | `pong_game`           | Pong            | realtime    | 2       | Yes         | PongGame              | ✅       |
| 16  | `sketch_party_game`   | Sketch Party    | realtime    | 2-10    | Yes         | SketchPartyGameScreen | ✅       |
| 17  | `starforge_game`      | Starforge       | realtime    | 1-2     | Yes         | StarforgeGame         | ✅       |
| 18  | `crossword_puzzle`    | Crossword       | realtime    | 1       | No\*\*      | CrosswordGame         | ✅       |
| 19  | `minigolf_duels`      | Mini-Golf Duels | realtime    | 2       | Yes         | MiniGolfDuelsGame     | ✅       |
| 20  | `battleship`          | Battleship      | realtime    | 2       | Yes         | BattleshipGame        | ✅       |

> \*`dot_match` is registered as `turnBased` in GAME_RUNTIME_TYPE but uses `useMultiplayerGame` (realtime hook).
> \*\*`crossword_puzzle` is registered as `realtime` with `isMultiplayer: false` — co-op mode is gated behind feature flags.

### 1b. 14 Multiplayer Games — Connection Modes

All 14 multiplayer games are v3-aware and route through `SessionLobbyScreen`.

| Game                | Connection Mode | Colyseus Hook             | v3 Auto-Start Pattern | Spectator              |
| ------------------- | --------------- | ------------------------- | --------------------- | ---------------------- |
| `chess`             | lobby-managed   | `useTurnBasedGame`        | v3StartedRef          | ✅ `useSpectator`      |
| `checkers`          | lobby-managed   | `useTurnBasedGame`        | v3StartedRef          | ✅ `useSpectator`      |
| `tic_tac_toe`       | lobby-managed   | `useTurnBasedGame`        | v3StartedRef          | ✅ `useSpectator`      |
| `connect_four`      | lobby-managed   | `useTurnBasedGame`        | v3StartedRef          | ✅ `useSpectator`      |
| `dot_match`         | lobby-managed   | `useMultiplayerGame`      | v3StartedRef          | ✅ `useSpectator`      |
| `gomoku_master`     | lobby-managed   | `useTurnBasedGame`        | v3StartedRef          | ✅ `useSpectator`      |
| `reversi_game`      | lobby-managed   | `useTurnBasedGame`        | v3StartedRef          | ✅ `useSpectator`      |
| `crazy_eights`      | lobby-managed   | `useCardGame`             | v3StartedRef          | ✅ `useSpectator`      |
| `pong_game`         | lobby-managed   | `usePhysicsGame`          | v3StartedRef          | ✅ `useSpectator`      |
| `sketch_party_game` | game-managed    | `useSketchPartyGame`      | Inline init           | Custom inline          |
| `starforge_game`    | game-managed    | Indirect (WebView)        | Inline init           | Custom inline          |
| `crossword_puzzle`  | game-managed    | `useCrosswordMultiplayer` | Inline init           | ✅ `useSpectator`      |
| `minigolf_duels`    | game-managed    | `useMiniGolfDuels`        | Inline init           | Custom inline          |
| `battleship`        | game-managed    | `useBattleshipGame`       | v3StartedRef          | Custom (hook-internal) |

---

## 2. V3 Session Pipeline

### 2a. End-to-End Flow

```
Entry (GamesHub / Chat invite)
 │
 ├─ GamesHub MP tap → createSessionV3 → navigateToSessionLobby → SessionLobbyScreen
 │
 ├─ Chat invite (v3) → ChatGameInvites.handleJoin → joinSession() → navigateToSessionLobby
 │   └─ joinSession() fires BEFORE navigation (auto-join belt-and-suspenders)
 │
 └─ Solo games → direct navigate to game screen (no lobby)

SessionLobbyScreen (useSessionLobby hook):
 ├─ subscribeToSession(sessionId) — Firestore real-time listener
 ├─ Auto-join effect: canJoin=true → joinSessionV3 (idempotent)
 ├─ Shows: participant list (filtered: joined only), empty slots, phase badge
 ├─ Host presses "Start Game" → startSessionV3:
 │   ├─ Turn-based: creates TurnBasedGames doc, sets firestoreGameId = doc.id
 │   └─ Realtime: sets firestoreGameId = sessionId (Colyseus matchmaking key)
 ├─ Session phase → "active"
 │   └─ navReady fires → navigation.replace(screenName, {
 │       sessionId, matchId: colyseusRoomId, firestoreGameId,
 │       v3Session: sessionId, entryPoint
 │     })
 └─ Terminal phase → error message + Go Back

Game Screen (v3 auto-start):
 ├─ v3StartedRef pattern: const fId = firestoreGameId || matchId || v3Session
 │   └─ startMultiplayer({ firestoreGameId: fId })
 │   └─ Colyseus joinOrCreate with filterBy(["firestoreGameId"])
 │   └─ Both players get same room (fId is shared)
 ├─ Inline init pattern: useState initializer uses v3FirestoreGameId || matchId || v3Session
 └─ Game plays → game over → SessionGameOverScreen (if v3Session present)

SessionGameOverScreen:
 ├─ subscribes to session doc, derives GameOverResult
 └─ Rematch / Exit to Hub
```

### 2b. Connection Mode Strategies

**`lobby-managed`** (9 games):

```
SessionLobbyScreen → startSessionV3 → firestoreGameId set on session →
  navReady fires → game screen mounts → v3StartedRef reads firestoreGameId →
  startMultiplayer({ firestoreGameId }) → Colyseus joinOrCreate → game plays
```

**`game-managed`** (5 games):

```
SessionLobbyScreen → startSessionV3 → firestoreGameId = sessionId →
  navReady fires → game screen mounts → reads firestoreGameId (or v3Session fallback) →
  game screen creates/joins Colyseus room using firestoreGameId as filterBy key
```

### 2c. V3GameScreenParams (Navigation)

All 14 multiplayer game screens accept `V3GameScreenParams`:

```typescript
interface V3GameScreenParams {
  sessionId?: string; // v3 session document ID
  v3Session?: string; // session ID string (truthy = v3 flow)
  matchId?: string; // Colyseus room ID (lobby-managed only)
  inviteId?: string; // Legacy invite doc ID (dual-write)
  firestoreGameId?: string; // Matchmaking key: TurnBasedGames ID or sessionId
  entryPoint?: "play" | "chat";
  spectatorMode?: boolean;
}
```

Defined in `src/types/navigation/root.ts`.

---

## 3. Cloud Functions

File: `firebase-backend/functions/src/sessionsV3.ts`

| Callable             | Purpose                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `createSessionV3`    | Host creates session (lobby phase). Fetches profile, sets TTL, optional dual-write invite.                         |
| `inviteToSessionV3`  | Add participant stub (`status: "invited"`), stamp `conversationId`, create `GameInvites` doc.                      |
| `joinSessionV3`      | Player joins. Replaces invited stub with full profile. Capacity check, idempotent re-join.                         |
| `leaveSessionV3`     | Participant leaves. Host leaving → session abandoned.                                                              |
| `startSessionV3`     | Host starts. Turn-based: creates `TurnBasedGames` doc. Realtime: sets `firestoreGameId=sessionId`. Phase → active. |
| `resolveSessionV3`   | Idempotent resolution with outcome/scores/winner. Calls `processSessionRewards` (XP, stats, achievements).         |
| `watchdogSessionsV3` | Scheduled (15 min): expire stale lobbies, abandon stuck active sessions.                                           |

---

## 4. useSessionLobby Hook

File: `src/hooks/useSessionLobby.ts`

### Derived State

| Property      | Type    | Description                                            |
| ------------- | ------- | ------------------------------------------------------ |
| `session`     | object  | Raw Firestore session document                         |
| `isHost`      | boolean | Current user is the host                               |
| `isInSession` | boolean | Current user has `status: "joined"` (not invited/left) |
| `isInvited`   | boolean | Current user has `status: "invited"` (stub only)       |
| `canJoin`     | boolean | Invited but not yet joined and session is in lobby     |
| `canStart`    | boolean | Is host, enough joined players, session in lobby       |
| `lobbyFull`   | boolean | All participant slots filled                           |
| `lobbyPhase`  | enum    | loading / waiting / starting / terminal / error        |
| `navReady`    | object  | Screen name + params when game is ready to navigate    |
| `error`       | string  | Human-readable error if any                            |

### Actions

| Action        | Description                             |
| ------------- | --------------------------------------- |
| `handleJoin`  | Calls `joinSessionV3` (idempotent)      |
| `handleStart` | Calls `startSessionV3` (host only)      |
| `handleLeave` | Calls `leaveSessionV3` + navigates back |
| `handleBack`  | Navigate back without leaving session   |

### Auto-behaviours

- **Auto-join:** When `canJoin=true`, fires `joinSessionV3` once via `autoJoinAttempted` ref
- **Auto-navigate:** When session phase becomes "active", emits `navReady` signal

---

## 5. Game Adapter Registry

File: `src/config/gameAdapters.ts`

See `docs/GAMES_SYSTEM.md` §23 for the full registry table and helpers.

Key helpers:

- `getGameAdapter(gameId)` — adapter or `undefined`
- `isLobbyGame(gameId)` — `true` for multiplayer
- `shouldUseLobby(gameId)` — `true` when session exists
- `canPlaySolo(gameId)` — `true` for solo/AI games

---

## 6. V3 Auto-Start Patterns in Game Screens

### 6a. v3StartedRef Pattern (10 screens)

Used by: Battleship, Chess, Checkers, TicTacToe, ConnectFour, Gomoku, Reversi, Pong, DotMatch, CrazyCards

```typescript
const v3StartedRef = useRef(false);
useEffect(() => {
  if (!isV3 || v3StartedRef.current) return;
  const fId =
    route.params?.firestoreGameId ||
    route.params?.matchId ||
    route.params?.v3Session;
  if (fId) {
    v3StartedRef.current = true;
    // set game mode if applicable
    mp.startMultiplayer({ firestoreGameId: fId, spectator: isSpectator });
  }
}, [
  isV3,
  route.params?.firestoreGameId,
  route.params?.matchId,
  route.params?.v3Session,
  isSpectator,
]);
```

### 6b. Inline Init Pattern (4 screens)

Used by: SketchParty, MiniGolf, Crossword, Starforge

```typescript
// SketchParty / MiniGolf: useState initializer
const [gameId] = useState(
  isV3 ? v3FirestoreGameId || routeMatchId || v3Session : routeMatchId,
);

// Crossword: inline resolution
const inviteMatchId =
  route?.params?.firestoreGameId ||
  route?.params?.matchId ||
  route?.params?.v3Session;

// Starforge: chained nullish coalescing
const effectiveGameId =
  params.firestoreGameId ?? params.matchId ?? params.roomId ?? params.v3Session;
```

### 6c. Fallback Chain

All screens resolve the Colyseus matchmaking key via:

```
firestoreGameId → matchId → v3Session
```

- `firestoreGameId`: Set by `startSessionV3` (always present for v3 flows)
- `matchId`: Colyseus room ID (may be undefined for game-managed games)
- `v3Session`: Session ID string (belt-and-suspenders fallback, always present)

---

## 7. Resolved Issues

These issues from the original audit are all fixed and deployed:

| #    | Issue                                          | Resolution                                                                                     |
| ---- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| C1   | No game screen accepts `sessionId` route param | All 14 screens accept `V3GameScreenParams` which includes `sessionId` and `v3Session`          |
| C2   | `v3Session: true` was boolean, not session ID  | `v3Session` is now always the session ID string                                                |
| C3   | Game-over resolution never fires               | `resolveSessionV3` callable exists; Colyseus bridge calls it on room dispose                   |
| C4   | Session phase never transitions to "active"    | `startSessionV3` now transitions directly to `active`                                          |
| C5   | Dual pipelines during gameplay                 | Colyseus bridge (`resolveV3Session`/`abandonV3Session`) syncs room lifecycle with session doc  |
| N1   | `navigation.goBack()` inconsistency            | All game exits route to GamesHub via `exitGameSession({ type: "playHub" })`                    |
| B-A  | Invite not rendering in chat                   | `inviteToSessionV3` stamps `conversationId` on session doc                                     |
| B-B  | Phantom nameless participant                   | Lobby filters to `status !== "invited" && status !== "left"`                                   |
| B-B₂ | No Join button for invited users               | `handleJoin` + `isInvited` flag + "Join Game" button in lobby UI                               |
| B-C  | Auto-join doesn't happen                       | `ChatGameInvites.handleJoin` pre-joins + `useSessionLobby` auto-join effect                    |
| B-D  | Game screen doesn't recognize players          | `startSessionV3` sets `firestoreGameId` for all runtimes + `v3Session` fallback in all screens |

---

## 8. Session ↔ Colyseus Bridge

The bridge synchronizes v3 session phase with Colyseus room lifecycle.

### Active Bridge Functions

File: `colyseus-server/src/services/persistence.ts`

| Function           | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| `linkColyseusRoom` | Writes `colyseusRoomId` to session doc on room creation     |
| `resolveV3Session` | Transitions session → "resolved" with outcome/scores/winner |
| `abandonV3Session` | Transitions session → "abandoned" (game suspended/vacant)   |

### Phase Mapping

```
v3 Session Phase    Colyseus Room Phase    Bridge Action
────────────────    ──────────────────    ─────────────────
lobby               (not created yet)      —
active              "waiting"/"placement"  startSessionV3 sets firestoreGameId
active              "playing"/"combat"     Room active, game in progress
active              "finished"             Room finishes → resolveV3Session
resolved            (disposed)             Session closed, room gone
abandoned           (disposed)             Room abandoned (early leave/disconnect)
```

### Base Room Integration

All four base room classes capture `options.v3SessionId` in `onCreate`:

| Room Class      | Games Using It                            |
| --------------- | ----------------------------------------- |
| `TurnBasedRoom` | chess, checkers, ttt, c4, gomoku, reversi |
| `ScoreRaceRoom` | dot_match                                 |
| `PhysicsRoom`   | pong                                      |
| `CardGameRoom`  | crazy_eights                              |

Game-managed rooms (battleship, sketch_party, starforge, crossword, minigolf) handle
v3 session lifecycle in their own `onDispose` handlers.

---

## 9. Feature Flags

All v3 flags are **enabled** in production:

```typescript
export const GAME_SESSIONS_V3 = {
  ENABLED: true,
  COMPACT_CHAT_PILLS: true,
  SESSION_LOBBY: true,
  DUAL_WRITE: true,
  UNIVERSAL_GAME_OVER: true,
  DEBUG_SESSION_LIFECYCLE: __DEV__,
};
```

File: `constants/featureFlags.ts`

---

## 10. Design Principles

1. **SessionLobbyScreen is the sole gateway to multiplayer** — no game screen renders its own lobby overlay.
2. **Chat and Play flows converge** — whether from a chat pill or GamesHub, the path is: SessionLobbyScreen → game screen.
3. **"Return to Hub" always goes to GamesHub** — deterministic, no stale screens.
4. **Role correctness** — host can start; guests wait. Spectators see a "Watch" button.
5. **No soft-locks** — every phase has an escape hatch (Leave, Back, watchdog timeout).
6. **v3 session is the source of truth** — Colyseus room is the transport layer; session doc owns the lifecycle.
7. **Idempotent joins** — `joinSessionV3` is safe to call multiple times (belt-and-suspenders).
8. **Runtime shells intercept completion** — all 20 game screens are wrapped with `MultiplayerRuntimeShell` or `SoloRuntimeShell` HOCs that emit `GameResultFacts` and manage session resolution/navigation.

---

## 11. Lobby State Machine

```
                          ┌─────────────┐
                          │   CREATED    │  (v3 session doc created)
                          │  phase:lobby │
                          └──────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │             │
                    ▼            ▼             ▼
            ┌──────────┐  ┌──────────┐  ┌──────────┐
            │ JOINING   │  │ WAITING  │  │ INVITED  │
            │ (joiner)  │  │ (host)   │  │ (remote) │
            └────┬──────┘  └────┬─────┘  └────┬─────┘
                 │              │              │
                 └──────────────┼──────────────┘
                                │
                                ▼
                       ┌────────────────┐
                       │  LOBBY_READY   │  All required participants joined
                       │  canStart=true │
                       └────────┬───────┘
                                │ Host presses "Start"
                                ▼
                       ┌────────────────┐
                       │    ACTIVE      │  startSessionV3 called
                       │  phase:active  │  firestoreGameId set
                       └────────┬───────┘
                                │ navReady fires → game screen
                                │ Game completes
                                ▼
                       ┌────────────────┐
                       │   RESOLVED     │  resolveSessionV3 called
                       │  phase:resolved│  Scores + results written
                       └────────┬───────┘
                                │
                                ▼
                       ┌────────────────┐
                       │  GAME_OVER     │  SessionGameOverScreen
                       │  (UI terminal) │  Rematch / Exit
                       └────────────────┘

     Error paths:
       Any → ABANDONED  (host leaves, timeout, or watchdog)
       Any → EXPIRED    (watchdog timeout during lobby)
```

---

## Appendix A: Hook Usage Matrix

| Hook / Feature             | chess | checkers | ttt | c4  | dots | gomoku | reversi | crazy8        | pong             | sketch               | starforge | xword            | golf               | battle              |
| -------------------------- | ----- | -------- | --- | --- | ---- | ------ | ------- | ------------- | ---------------- | -------------------- | --------- | ---------------- | ------------------ | ------------------- |
| `withMultiplayerRuntime`   | ✅    | ✅       | ✅  | ✅  | ✅   | ✅     | ✅      | ✅            | ✅               | ✅                   | ✅        | ✅               | ✅                 | ✅                  |
| `useGameLobbyController`   | ✅    | ✅       | ✅  | ✅  | ✅   | ✅     | ✅      | ✅            | ✅               | ✅                   | ❌        | ❌               | ❌                 | ✅                  |
| `useGameBackHandler`       | ✅    | ✅       | ✅  | ✅  | ✅   | ✅     | ✅      | ✅            | ✅               | ✅                   | ❌        | ✅               | ✅                 | ✅                  |
| `useSpectator`             | ✅    | ✅       | ✅  | ✅  | ✅   | ✅     | ✅      | ✅            | ✅               | ❌                   | ❌        | ✅               | ❌                 | ❌                  |
| `useGameCompletion`        | ✅    | ✅       | ❌  | ✅  | ❌   | ✅     | ✅      | ❌            | ❌               | ❌                   | ❌        | ❌               | ❌                 | ❌                  |
| Custom Colyseus hook       | —     | —        | —   | —   | ✅   | —      | —       | `useCardGame` | `usePhysicsGame` | `useSketchPartyGame` | (WebView) | `useCrosswordMP` | `useMiniGolfDuels` | `useBattleshipGame` |
| v3StartedRef               | ✅    | ✅       | ✅  | ✅  | ✅   | ✅     | ✅      | ✅            | ✅               | ❌                   | ❌        | ❌               | ❌                 | ✅                  |
| Inline v3 init             | ❌    | ❌       | ❌  | ❌  | ❌   | ❌     | ❌      | ❌            | ❌               | ✅                   | ✅        | ✅               | ✅                 | ❌                  |
| `v3Session` route param    | ✅    | ✅       | ✅  | ✅  | ✅   | ✅     | ✅      | ✅            | ✅               | ✅                   | ✅        | ✅               | ✅                 | ✅                  |
| `firestoreGameId` fallback | ✅    | ✅       | ✅  | ✅  | ✅   | ✅     | ✅      | ✅            | ✅               | ✅                   | ✅        | ✅               | ✅                 | ✅                  |

> **Runtime shell note:** All 14 multiplayer screens are wrapped with `withMultiplayerRuntime` HOC.
> All 6 solo screens are wrapped with `withSoloRuntime` HOC (not shown in this matrix as it covers MP only).
> `useGameCompletion` was removed from 8 files during STOP 5 dead-code cleanup.
> It remains in Chess, Checkers, ConnectFour, Gomoku, Reversi for the `exitGame` action — consolidation into runtime shell is planned.

---

## Appendix B: Invite → Lobby Invariants

These invariants are enforced in code and tests:

1. **Invite creation MUST NOT produce a "joined" participant** — `inviteToSessionV3` creates stubs with `status: "invited"` only.
2. **Only `joinSessionV3` may produce a "joined" participant** — it replaces the invited stub with full profile data.
3. **`isInSession` excludes invited and left statuses** — prevents phantom participants in the lobby UI.
4. **`canStart` counts only joined players** — host cannot start until enough players have explicitly pressed "Join Game".
5. **`inviteToSessionV3` stamps `conversationId`** — ensures the v3 chat subscription can discover the session.
6. **`startSessionV3` always sets `firestoreGameId`** — turn-based gets TurnBasedGames doc ID; realtime gets sessionId.
7. **All 14 screens use the `firestoreGameId → matchId → v3Session` fallback chain** — guarantees a matchmaking key is always available.
