# Colyseus × Game Invite Integration Plan

**Status:** ✅ Implemented — Reference documentation

> **Goal:** Wire the existing game invite system to activate Colyseus for multiplayer games that benefit from real-time state sync — physics, quick-play, and cooperative games. Turn-based games stay on Firestore-only unless the Colyseus feature flags are toggled on.

---

## Table of Contents

1. [Current State (What's Broken)](#1-current-state)
2. [Game Categorization](#2-game-categorization)
3. [Architecture Decision](#3-architecture-decision)
4. [Integration Design](#4-integration-design)
5. [Implementation Phases](#5-implementation-phases)
6. [File Change Matrix](#6-file-change-matrix)
7. [Risks & Mitigations](#7-risks--mitigations)

---

## 1. Current State

### What works

- ✅ 27 Colyseus rooms registered with `filterBy(["firestoreGameId"])`
- ✅ All game hooks (`useTurnBasedGame`, `usePhysicsGame`, `useMultiplayerGame`, etc.) have `startMultiplayer(roomId?)` and/or `restoreGame(firestoreGameId)`
- ✅ All game screens have a `"colyseus"` game mode branch with full rendering/overlays
- ✅ ColyseusService singleton with `joinOrCreate`, `joinById`, `restoreGame` methods
- ✅ Universal invite system creates Firestore matches via `createMatch()` → returns `gameId`
- ✅ `UniversalInviteCard` auto-navigates all players when invite status → `"active"`
- ✅ Feature flags all enabled (`COLYSEUS_ENABLED`, `PHYSICS_ENABLED`, etc.)

### What's broken (the single gap)

- ❌ **No game screen transitions to `"colyseus"` mode from invite params**
- Every game screen receives `{ matchId, entryPoint: "play" }` from the invite
- Every game screen reads `matchId` → sets `gameMode = "online"` → subscribes to Firestore
- The `"colyseus"` mode exists but is **never activated**

### The fix in one sentence

> When a game screen opens with a `matchId` from an invite, it should check if the game type is Colyseus-eligible and — if so — set `gameMode = "colyseus"` instead of `"online"`, then call `startMultiplayer()` with the `firestoreGameId`.

---

## 2. Game Categorization

### 🔴 Tier 1 — REQUIRE Colyseus (Physics/Real-Time) — 6 games

Server-authoritative physics at 60fps. **Cannot work** with Firestore polling.

| Game          | Screen                   | Hook                  | Room            |
| ------------- | ------------------------ | --------------------- | --------------- |
| Pong          | `PongGameScreen`         | `usePhysicsGame`      | `pong`          |
| Air Hockey    | `AirHockeyGameScreen`    | `usePhysicsGame`      | `air_hockey`    |
| Bounce Blitz  | `BounceBlitzGameScreen`  | `usePhysicsGame`      | `bounce_blitz`  |
| Brick Breaker | `BrickBreakerGameScreen` | `useMultiplayerGame`  | `brick_breaker` |
| Snake         | `SnakeGameScreen`        | `useSnakeMultiplayer` | `snake`         |
| Race          | `RaceGameScreen`         | `usePhysicsGame`      | `race`          |

### 🟡 Tier 2 — Strongly Benefit (Quick-Play Score Race) — 3 games

Simultaneous play, real-time score sync. Firestore would work but degrade the experience.

| Game         | Screen                  | Hook                 | Room           |
| ------------ | ----------------------- | -------------------- | -------------- |
| Reaction Tap | `ReactionTapGameScreen` | `useMultiplayerGame` | `reaction_tap` |
| Timed Tap    | `TimedTapGameScreen`    | `useMultiplayerGame` | `timed_tap`    |
| Dot Match    | `DotMatchGameScreen`    | `useMultiplayerGame` | `dot_match`    |

### 🟢 Tier 3 — Optional (Turn-Based) — 8 games

Firestore `onSnapshot` is fine. Colyseus adds anti-cheat and private-hand management for card games.

| Game         | Screen                  | Hook               | Room           |
| ------------ | ----------------------- | ------------------ | -------------- |
| Tic-Tac-Toe  | `TicTacToeGameScreen`   | `useTurnBasedGame` | `tic_tac_toe`  |
| Connect Four | `ConnectFourGameScreen` | `useTurnBasedGame` | `connect_four` |
| Gomoku       | `GomokuGameScreen`      | `useTurnBasedGame` | `gomoku`       |
| Reversi      | `ReversiGameScreen`     | `useTurnBasedGame` | `reversi`      |
| Chess        | `ChessGameScreen`       | `useTurnBasedGame` | `chess`        |
| Checkers     | `CheckersGameScreen`    | `useTurnBasedGame` | `checkers`     |
| Crazy Eights | `CrazyEightsGameScreen` | `useCardGame`      | `crazy_eights` |
| War          | `WarGameScreen`         | `useCardGame`      | `war`          |

### 🔵 Tier 4 — Benefit (Cooperative) — 2 games

Real-time collaboration.

| Game        | Screen                 | Hook            | Room          |
| ----------- | ---------------------- | --------------- | ------------- |
| Word Master | `WordMasterGameScreen` | `useWordMaster` | `word_master` |
| Crossword   | `CrosswordGameScreen`  | `useCrossword`  | `crossword`   |

---

## 3. Architecture Decision

### Option A: "Smart Switch" (Recommended ✅)

The game screen decides its mode based on the game type + feature flags:

```
Game opens with matchId from invite
  → Is this game Colyseus-eligible? (check COLYSEUS_ROOM_NAMES + feature flags)
    → YES: gameMode = "colyseus", call startMultiplayer() with firestoreGameId
    → NO:  gameMode = "online", subscribe to Firestore (existing behavior)
```

**Why this approach:**

1. **Zero invite system changes** — `startGameEarly`, `createMatch`, `UniversalInviteCard` all stay exactly as-is
2. **`firestoreGameId` is the bridge** — both players call `joinOrCreate` with the same `firestoreGameId`, `filterBy` ensures they land in the same room
3. **Graceful fallback** — if Colyseus server is unreachable, games fall back to Firestore-only
4. **Per-tier feature flags** — each category can be toggled independently

### Why NOT change the invite system

- The invite system creates a Firestore match doc that serves as a **persistent record** of the game regardless of transport
- Both legacy and universal invites produce a `matchId` (Firestore doc ID) — this is the perfect `firestoreGameId` to pass to Colyseus
- No need for a pre-created `colyseusRoomId` — the `filterBy` pattern handles player matching

---

## 4. Integration Design

### 4.1 New Helper: `shouldUseColyseus(gameType)`

**File:** `src/config/colyseus.ts`

```typescript
import { COLYSEUS_FEATURES } from "@/constants/featureFlags";

/**
 * Determines if a game type should use Colyseus when opened from an invite.
 * Only returns true if:
 * 1. The game type has a registered Colyseus room
 * 2. The master COLYSEUS_ENABLED flag is on
 * 3. The category-specific feature flag is on
 */
export function shouldUseColyseus(gameType: string): boolean {
  if (!COLYSEUS_FEATURES.COLYSEUS_ENABLED) return false;
  if (!isColyseusEnabled(gameType)) return false;

  // Check category-specific flags
  const category = getGameCategory(gameType);
  switch (category) {
    case "physics":
      return !!COLYSEUS_FEATURES.PHYSICS_ENABLED;
    case "quickplay":
      return !!COLYSEUS_FEATURES.QUICKPLAY_ENABLED;
    case "turnbased":
      return !!COLYSEUS_FEATURES.TURNBASED_ENABLED;
    case "complex":
      return !!COLYSEUS_FEATURES.COMPLEX_TURNBASED_ENABLED;
    case "coop":
      return !!COLYSEUS_FEATURES.COOP_ENABLED;
    default:
      return false;
  }
}
```

This also requires a `getGameCategory()` helper that maps game types to their tier. This can be a simple lookup object.

### 4.2 New Custom Hook: `useGameConnection(gameType, matchId?)`

**File:** `src/hooks/useGameConnection.ts`

This is the **key new abstraction** — a hook that every game screen calls instead of directly checking `matchId`:

```typescript
/**
 * Determines how a game should connect for multiplayer.
 * Returns the appropriate gameMode and connection parameters.
 *
 * Usage in game screens:
 *   const { resolvedMode, firestoreGameId } = useGameConnection(GAME_TYPE, route.params?.matchId);
 *
 *   useEffect(() => {
 *     if (resolvedMode === "colyseus") {
 *       setGameMode("colyseus");
 *       mp.startMultiplayer();           // hook will use firestoreGameId internally
 *     } else if (resolvedMode === "online") {
 *       setGameMode("online");
 *       setMatchId(firestoreGameId);     // existing Firestore subscription
 *     }
 *   }, [resolvedMode]);
 */
export function useGameConnection(gameType: string, matchId?: string) {
  const resolvedMode = useMemo(() => {
    if (!matchId) return null; // No invite → stay in menu
    if (shouldUseColyseus(gameType)) return "colyseus";
    return "online"; // Firestore fallback
  }, [gameType, matchId]);

  return {
    resolvedMode, // "colyseus" | "online" | null
    firestoreGameId: matchId ?? null, // The Firestore match ID (used by both paths)
  };
}
```

### 4.3 Game Screen Integration Pattern

Every game screen changes from:

```typescript
// BEFORE (current)
useEffect(() => {
  if (route.params?.matchId) {
    setGameMode("online");
    setMatchId(route.params.matchId);
  }
}, [route.params?.matchId]);
```

To:

```typescript
// AFTER (with Colyseus integration)
const { resolvedMode, firestoreGameId } = useGameConnection(
  GAME_TYPE,
  route.params?.matchId,
);

useEffect(() => {
  if (resolvedMode === "colyseus" && firestoreGameId) {
    setGameMode("colyseus");
    mp.startMultiplayer(); // The hook uses firestoreGameId from its own params
  } else if (resolvedMode === "online" && firestoreGameId) {
    setGameMode("online");
    setMatchId(firestoreGameId);
  }
}, [resolvedMode, firestoreGameId]);
```

### 4.4 Hook Wiring (firestoreGameId passthrough)

The category hooks need to receive `firestoreGameId` so their internal `startMultiplayer()` calls can pass it to `joinOrCreate`. Here's how each hook type works:

#### Physics Games (`usePhysicsGame`)

Currently accepts `{ gameType, autoJoin, roomId }`. Change:

- Add `firestoreGameId` to options
- Pass it through to `useColyseus({ gameType, firestoreGameId, autoJoin: false })`
- `startMultiplayer()` no longer needs a roomId param — it just triggers the join

#### Quick-Play / Multiplayer Games (`useMultiplayerGame`)

Currently dynamically imports ColyseusService. Change:

- Accept `firestoreGameId` in hook params
- In internal `joinRoom()`, call `colyseusService.joinOrCreate(gameType, { firestoreGameId })` instead of branching on roomId

#### Turn-Based Games (`useTurnBasedGame`)

Already has `restoreGame(firestoreGameId)` which calls `colyseusService.restoreGame()`. This path works correctly. The game screen just needs to call it.

#### Snake / Card / Words / Coop Games

Same pattern — accept `firestoreGameId`, pass to service.

### 4.5 Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│ INVITE FLOW (unchanged)                                              │
│                                                                      │
│ Host: sendUniversalInvite() → invite doc (status: pending)           │
│ Guest: claimInviteSlot()    → invite doc (status: filling → ready)   │
│ Host: startGameEarly()      → createMatch() → gameId (Firestore ID) │
│                                                → invite.status: active│
│                                                                      │
│ UniversalInviteCard: detects status → "active"                       │
│   → onPlay(gameId, gameType) after 300ms                             │
│   → handlePlayUniversalInvite(gameId, gameType)                      │
│   → navigation.navigate(screen, { matchId: gameId })                 │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│ GAME SCREEN (modified)                                               │
│                                                                      │
│ const { resolvedMode, firestoreGameId } =                            │
│   useGameConnection(GAME_TYPE, route.params?.matchId);               │
│                                                                      │
│ if (resolvedMode === "colyseus") {                                   │
│   setGameMode("colyseus")                                            │
│   mp.startMultiplayer()  ──────────────────────────┐                 │
│                                                    │                 │
│ } else if (resolvedMode === "online") {            │                 │
│   setGameMode("online")                            │                 │
│   subscribeToMatch(firestoreGameId)  // existing   │                 │
│ }                                                  │                 │
└────────────────────────────────────────────────────┼─────────────────┘
                                                     │
                            ┌────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│ COLYSEUS PATH                                                        │
│                                                                      │
│ Hook.startMultiplayer()                                               │
│   → colyseusService.joinOrCreate(gameType, { firestoreGameId })      │
│   → client.joinOrCreate("pong", { firestoreGameId, token })          │
│                                                                      │
│ Server: filterBy(["firestoreGameId"])                                 │
│   → Player 1 calls joinOrCreate → room created                      │
│   → Player 2 calls joinOrCreate → matched to same room              │
│   → onCreate: loadGameState(firestoreGameId) → restoreFromSaved()   │
│   → Both connected, game begins                                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Phases

### Phase 1: Foundation (2 files)

**Create the smart-switch helpers.**

| File                             | Change                                                              |
| -------------------------------- | ------------------------------------------------------------------- |
| `src/config/colyseus.ts`         | Add `GAME_CATEGORY_MAP`, `getGameCategory()`, `shouldUseColyseus()` |
| `src/hooks/useGameConnection.ts` | New file — `useGameConnection(gameType, matchId?)` hook             |

### Phase 2: Hook Wiring (6 hooks)

**Thread `firestoreGameId` through every multiplayer hook.**

| Hook                               | Change                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/hooks/usePhysicsGame.ts`      | Accept `firestoreGameId` option, pass to `useColyseus`                                        |
| `src/hooks/useMultiplayerGame.ts`  | Accept `firestoreGameId`, use in `joinRoom()`                                                 |
| `src/hooks/useSnakeMultiplayer.ts` | Accept `firestoreGameId`, pass to `useColyseus`                                               |
| `src/hooks/useTurnBasedGame.ts`    | Already has `restoreGame()` — just ensure `startMultiplayer()` also accepts `firestoreGameId` |
| `src/hooks/useCardGame.ts`         | Accept `firestoreGameId`, use in join call                                                    |

### Phase 3: Physics Game Screens (6 screens)

**Wire `useGameConnection` into physics games — these benefit most.**

| Screen                       | Key Changes                                                       |
| ---------------------------- | ----------------------------------------------------------------- |
| `PongGameScreen.tsx`         | Add `useGameConnection`, replace matchId→online with smart switch |
| `AirHockeyGameScreen.tsx`    | Same pattern                                                      |
| `BounceBlitzGameScreen.tsx`  | Same pattern                                                      |
| `BrickBreakerGameScreen.tsx` | Same pattern                                                      |
| `SnakeGameScreen.tsx`        | Same pattern                                                      |
| `RaceGameScreen.tsx`         | Same pattern                                                      |

### Phase 4: Quick-Play Game Screens (3 screens)

**Wire `useGameConnection` into score-race games.**

| Screen                      | Key Changes                           |
| --------------------------- | ------------------------------------- |
| `ReactionTapGameScreen.tsx` | Add `useGameConnection`, smart switch |
| `TimedTapGameScreen.tsx`    | Same                                  |
| `DotMatchGameScreen.tsx`    | Same                                  |

### Phase 5: Turn-Based + Card + Coop Game Screens (10 screens)

**Wire remaining games. These can use the same pattern — `shouldUseColyseus` + feature flags control whether Colyseus or Firestore is used.**

| Screen                      | Key Changes                           |
| --------------------------- | ------------------------------------- |
| `CheckersGameScreen.tsx`    | Add `useGameConnection`, smart switch |
| `ChessGameScreen.tsx`       | Same                                  |
| `TicTacToeGameScreen.tsx`   | Same                                  |
| `ConnectFourGameScreen.tsx` | Same                                  |
| `GomokuGameScreen.tsx`      | Same                                  |
| `ReversiGameScreen.tsx`     | Same                                  |
| `CrazyEightsGameScreen.tsx` | Same                                  |
| `WarGameScreen.tsx`         | Same                                  |
| `WordMasterGameScreen.tsx`  | Same                                  |
| `CrosswordGameScreen.tsx`   | Same                                  |

### Phase 6: Fallback & Error Handling

**Add resilience for when the Colyseus server is unreachable.**

| File                             | Change                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `src/hooks/useGameConnection.ts` | Add `colyseusAvailable` check via latency ping                                          |
| All game screens                 | On Colyseus connection error → fall back to `"online"` (Firestore) mode with user toast |
| `src/components/InAppToast.tsx`  | Toast message: "Real-time server unavailable, using standard connection"                |

### Phase 7: Testing

| Test File                                       | Coverage                                            |
| ----------------------------------------------- | --------------------------------------------------- |
| `__tests__/hooks/useGameConnection.test.ts`     | Smart switch logic, feature flag gating             |
| `__tests__/integration/colyseusInvites.test.ts` | End-to-end: invite → auto-nav → Colyseus connection |
| Update existing game tests                      | Verify Colyseus mode activation                     |

---

## 6. File Change Matrix

### New Files (2)

| File                                        | Purpose                                              |
| ------------------------------------------- | ---------------------------------------------------- |
| `src/hooks/useGameConnection.ts`            | Smart switch hook: matchId + gameType → resolvedMode |
| `__tests__/hooks/useGameConnection.test.ts` | Tests for the smart switch                           |

### Modified Files (30)

| File                               | Change Type                                | Complexity |
| ---------------------------------- | ------------------------------------------ | ---------- |
| `src/config/colyseus.ts`           | Add helpers                                | Low        |
| `src/hooks/usePhysicsGame.ts`      | Accept firestoreGameId                     | Low        |
| `src/hooks/useMultiplayerGame.ts`  | Accept firestoreGameId                     | Low        |
| `src/hooks/useSnakeMultiplayer.ts` | Accept firestoreGameId                     | Low        |
| `src/hooks/useTurnBasedGame.ts`    | Ensure firestoreGameId in startMultiplayer | Low        |
| `src/hooks/useCardGame.ts`         | Accept firestoreGameId                     | Low        |
| 6× Physics game screens            | useGameConnection integration              | Medium     |
| 3× Quick-play game screens         | useGameConnection integration              | Medium     |
| 6× Turn-based game screens         | useGameConnection integration              | Medium     |
| 2× Card game screens               | useGameConnection integration              | Medium     |
| 2× Coop game screens               | useGameConnection integration              | Medium     |

### Unchanged Files (0 invite system changes!)

| File                                           | Why Unchanged                                          |
| ---------------------------------------------- | ------------------------------------------------------ |
| `src/services/gameInvites.ts`                  | Invite flow stays exactly as-is                        |
| `src/services/turnBasedGames.ts`               | Match creation stays as-is                             |
| `src/components/games/UniversalInviteCard.tsx` | Auto-navigation stays as-is                            |
| `src/screens/games/GamesHubScreen.tsx`         | Navigation params stay as-is (`matchId`, `entryPoint`) |
| `colyseus-server/src/app.config.ts`            | Room registration stays as-is                          |
| `colyseus-server/src/rooms/base/*.ts`          | Server rooms stay as-is                                |
| `src/services/colyseus.ts`                     | Service methods stay as-is                             |

---

## 7. Risks & Mitigations

### Risk 1: Colyseus Server Unreachable

**Impact:** Game won't start if server is down.
**Mitigation:** `useGameConnection` pings server health before recommending Colyseus mode. On failure, falls back to Firestore `"online"` mode. User sees a brief toast. Turn-based and quick-play games degrade gracefully; physics games show "Multiplayer unavailable" since they can't function without real-time sync.

### Risk 2: Race Condition — Player 2 Arrives Before Room Exists

**Impact:** `joinOrCreate` with `firestoreGameId` — if Player 2 calls this before Player 1's room is created, a second room could be created.
**Mitigation:** `filterBy(["firestoreGameId"])` prevents this — Colyseus will create the room on the first call and match the second call to the same room, as long as both pass the same `firestoreGameId`. This is exactly what `filterBy` is designed for.

### Risk 3: Stale Firestore Subscription + Colyseus

**Impact:** If a game screen subscribes to both Firestore AND Colyseus, state could conflict.
**Mitigation:** The smart switch is **exclusive** — `"colyseus"` mode does NOT subscribe to Firestore. Only one transport is active at a time.

### Risk 4: Room Auto-Dispose Before Player 2 Joins

**Impact:** `autoDispose = true` means if Player 1 disconnects before Player 2 joins, the room is destroyed.
**Mitigation:** Both players auto-navigate within 300ms of each other (triggered by the same invite status change). The window for this race condition is very small. For extra safety, rooms can set a `autoDisposeTimeout` (e.g., 30 seconds) to give Player 2 time to connect.

### Risk 5: `createMatch` Game State vs Colyseus Game State

**Impact:** `startGameEarly()` calls `createMatch()` which generates initial game state in Firestore. When the Colyseus room starts, `TurnBasedRoom.onCreate` calls `loadGameState(firestoreGameId)` and restores from it. These must be compatible.
**Mitigation:** This already works by design — the room's `restoreFromSaved()` reads the Firestore game state format. No changes needed.

---

## Summary

The integration is **minimal in scope but wide in surface area**: one new helper function, one new hook, and a 3-line change in each of ~27 game screens. The invite system, server rooms, and ColyseusService all remain unchanged. The `firestoreGameId` created by `createMatch()` is the bridge — both players pass it to `joinOrCreate`, and `filterBy` ensures they land in the same room.

**Estimated effort:** ~2-3 hours of implementation, ~1 hour of testing.
