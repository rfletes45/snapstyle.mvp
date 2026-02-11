# Spectator System — Colyseus-Native Implementation Plan

**Status:** ✅ Implemented — Reference documentation

## 1. Overview

### 1.1 Problem Statement

The previous spectator system used **Firestore direct writes** for real-time game state
synchronization. This approach suffered from:

- **High latency** — Firestore write/read roundtrips (200-500ms) vs WebSocket (~50ms)
- **High cost** — Every game state update was a Firestore write + N spectator reads
- **Disconnected architecture** — Game state lived in Colyseus rooms but spectator state
  was a separate Firestore copy, leading to desync and race conditions
- **No server authority** — Spectators read raw Firestore docs, bypassing server validation

### 1.2 New Architecture

The new system is **Colyseus-native**: spectators join the same Colyseus room as the
players. They receive the exact same state patches at the same 10fps sync rate, with
zero additional Firestore writes for state sync. Firestore is used **only** for invite
persistence and discovery (not real-time state).

### 1.3 Feature Parity

| Feature                         | Old System                     | New System                     |
| ------------------------------- | ------------------------------ | ------------------------------ |
| Watch multiplayer games         | ✅ via Firestore subcollection | ✅ via Colyseus room join      |
| Watch single-player games       | ✅ via LiveSpectatorSessions   | ✅ via new SpectatorRoom       |
| Spectator invite via chat       | ✅ SpectatorInvite collection  | ✅ Same invite, Colyseus room  |
| Join via filled game invite     | ✅ Navigate to game screen     | ✅ Same, with `spectator` flag |
| Spectator count display         | ✅ Firestore onSnapshot        | ✅ Colyseus state property     |
| Spectator list (who's watching) | ✅ Firestore subcollection     | ✅ Colyseus MapSchema          |
| Leave spectator mode            | ✅ Delete Firestore doc        | ✅ room.leave()                |
| Block spectator input           | ✅ `isSpectator` flag          | ✅ Same pattern, from room     |
| Spectator banner UI             | ✅ SpectatorBanner component   | ✅ New SpectatorBanner         |
| Max spectators cap              | ✅ Firestore check             | ✅ Server-side maxClients      |
| Real-time state sync            | ⚠️ ~300ms via Firestore        | ✅ ~50ms via WebSocket         |

---

## 2. Architecture

### 2.1 Two Spectating Paths

```
Path A: Multiplayer Game Spectating
─────────────────────────────────────
User clicks filled game invite → navigates to game screen
→ game screen detects `spectatorMode=true` in route params
→ joins the SAME Colyseus room as players (with `spectator: true` option)
→ server tracks client as spectator (no player slot consumed)
→ client receives all state patches, blocks input

Path B: Single-Player Game Spectating (Spectator Invite)
─────────────────────────────────────────────────────────
Host creates spectator invite → sends in chat/DM
→ Host starts game → creates a SpectatorRoom on Colyseus
→ Host's game screen connects to SpectatorRoom as "host"
→ Host periodically pushes game state to SpectatorRoom
→ Spectators click invite → join SpectatorRoom as "spectator"
→ Spectators see live game state updates
```

### 2.2 Server-Side Components

```
colyseus-server/src/
├── rooms/
│   ├── base/
│   │   ├── TurnBasedRoom.ts     ← ADD spectator support to onJoin/maxClients
│   │   ├── ScoreRaceRoom.ts     ← ADD spectator support to onJoin/maxClients
│   │   ├── PhysicsRoom.ts       ← ADD spectator support to onJoin/maxClients
│   │   └── CardGameRoom.ts      ← ADD spectator support to onJoin/maxClients
│   └── spectator/
│       └── SpectatorRoom.ts     ← NEW — dedicated room for single-player spectating
├── schemas/
│   └── spectator.ts             ← NEW — SpectatorState schema
└── services/
    └── spectatorAuth.ts         ← NEW — spectator join validation
```

### 2.3 Client-Side Components

```
src/
├── hooks/
│   └── useSpectator.ts          ← NEW — single unified spectator hook
├── components/games/
│   ├── SpectatorBanner.tsx      ← NEW — "Watching • N spectators" banner
│   └── SpectatorOverlay.tsx     ← NEW — floating spectator count badge
├── screens/games/
│   └── SpectatorViewScreen.tsx  ← NEW — dedicated spectator view for SP games
├── services/
│   └── spectatorInvites.ts      ← NEW — Firestore invite CRUD (invites only)
└── config/
    └── colyseus.ts              ← ADD spectator_room to room names
```

---

## 3. Server Implementation Details

### 3.1 Spectator Support in Existing Rooms (Multiplayer)

Each base room class (TurnBasedRoom, ScoreRaceRoom, PhysicsRoom, CardGameRoom) gains:

```typescript
// In onJoin:
onJoin(client: Client, options: Record<string, any>, auth: any): void {
  const isSpectator = options.spectator === true;

  if (isSpectator) {
    // Add to spectator tracking (not a player slot)
    const spectator = new SpectatorEntry();
    spectator.uid = auth.uid;
    spectator.sessionId = client.sessionId;
    spectator.displayName = auth.displayName;
    spectator.avatarUrl = auth.avatarUrl;
    spectator.joinedAt = Date.now();
    this.state.spectators.set(client.sessionId, spectator);

    console.log(`[${this.gameTypeKey}] Spectator joined: ${auth.displayName}`);
    return; // Don't create a player slot
  }

  // ... existing player join logic ...
}
```

Key changes to base rooms:

- `maxClients` raised to accommodate spectators (e.g., 2 players + 10 spectators = 12)
- Spectators tracked in `state.spectators` MapSchema (auto-synced to all clients)
- Move/action message handlers check `isSpectator()` before processing
- `onLeave` cleans up spectator entries
- `filterBy` remains `["firestoreGameId"]` — spectators join by roomId

### 3.2 SpectatorEntry Schema

```typescript
// colyseus-server/src/schemas/spectator.ts
export class SpectatorEntry extends Schema {
  @type("string") uid: string = "";
  @type("string") sessionId: string = "";
  @type("string") displayName: string = "";
  @type("string") avatarUrl: string = "";
  @type("float64") joinedAt: number = 0;
}
```

Added to each base state:

```typescript
// In BaseGameState (common.ts):
@type({ map: SpectatorEntry })
spectators = new MapSchema<SpectatorEntry>();

@type("uint8") spectatorCount: number = 0;
@type("uint8") maxSpectators: number = 10;
```

### 3.3 SpectatorRoom (for Single-Player Games)

A dedicated room where the host pushes game state and spectators receive it:

```typescript
// colyseus-server/src/rooms/spectator/SpectatorRoom.ts
export class SpectatorRoom extends Room<SpectatorRoomState> {
  maxClients = 11; // 1 host + 10 spectators
  autoDispose = true;

  // Messages:
  // - "state_update" (host → server → all spectators via state patch)
  // - "game_end" (host signals game over)
}
```

The SpectatorRoomState schema:

```typescript
export class SpectatorRoomState extends Schema {
  @type("string") gameType: string = "";
  @type("string") hostId: string = "";
  @type("string") hostName: string = "";
  @type("string") phase: string = "waiting"; // waiting | active | completed
  @type("int32") currentScore: number = 0;
  @type("string") gameStateJson: string = "{}"; // Serialized game-specific state
  @type({ map: SpectatorEntry }) spectators = new MapSchema<SpectatorEntry>();
  @type("uint8") spectatorCount: number = 0;
}
```

### 3.4 Spectator Join Validation

```typescript
// colyseus-server/src/services/spectatorAuth.ts
export function canJoinAsSpectator(
  state: BaseGameState,
  options: Record<string, any>,
): boolean {
  // Check spectator count vs max
  if (state.spectatorCount >= state.maxSpectators) return false;
  // Must be during active game (not waiting/finished)
  if (state.phase === "finished") return false;
  return true;
}
```

---

## 4. Client Implementation Details

### 4.1 useSpectator Hook

A single hook replaces both `useSpectatorMode` and `useLiveSpectatorSession`:

```typescript
// src/hooks/useSpectator.ts

interface UseSpectatorParams {
  /** Mode: 'spectator' to watch, 'host' to broadcast SP game */
  mode: "spectator" | "host";
  /** For multiplayer: the Colyseus room ID to spectate */
  roomId?: string;
  /** For multiplayer: the game type (to resolve room name) */
  gameType?: string;
  /** For single-player host: push state updates */
  gameStateJson?: string;
  currentScore?: number;
}

interface UseSpectatorReturn {
  // State
  isSpectator: boolean;
  spectatorCount: number;
  spectators: SpectatorInfo[];
  connected: boolean;
  loading: boolean;
  error: string | null;

  // For spectators watching multiplayer — state comes from game room
  // For spectators watching SP — state comes from SpectatorRoom
  gameState: Record<string, unknown> | null;
  currentScore: number;

  // Actions
  leaveSpectator: () => Promise<void>;

  // For hosts (SP only)
  startHosting: (gameType: string) => Promise<string>; // returns roomId
  updateGameState: (state: string, score: number) => void;
  endHosting: () => Promise<void>;
}
```

### 4.2 Multiplayer Spectating Flow (Game Screens)

Each game screen (Chess, Checkers, TicTacToe, CrazyEights, etc.) checks
`route.params.spectatorMode`:

```typescript
// In any multiplayer game screen:
const isSpectator = route.params?.spectatorMode === true;

// Join the Colyseus room with spectator flag
const { room, state } = useColyseus({
  gameType: "chess_game",
  roomId: route.params?.roomId,
  options: {
    spectator: isSpectator,
    firestoreGameId: route.params?.firestoreGameId,
  },
});

// Use spectator info from room state
const spectatorCount = state?.spectatorCount ?? 0;
const spectators = state?.spectators ? Object.values(state.spectators) : [];

// Block input for spectators
const handleCellPress = (row, col) => {
  if (isSpectator) return;
  // ... normal move logic
};
```

### 4.3 Spectator Invite Flow

1. **Create invite** — Host creates a Firestore `SpectatorInvite` doc (same as before,
   but without LiveSpectatorSession creation)
2. **Accept invite** — Spectator sees invite in chat, clicks "Watch"
3. **For multiplayer**: Navigate to game screen with `spectatorMode: true` + `roomId`
4. **For single-player**: Navigate to `SpectatorViewScreen` which joins the `SpectatorRoom`

### 4.4 Navigation

```typescript
// In RootNavigator.tsx — SpectatorView route params:
SpectatorView: {
  roomId: string;        // Colyseus room ID
  gameType: string;      // Game type for display
  hostName?: string;     // Host display name
};
```

### 4.5 Firestore Usage (Invites Only)

Firestore is used ONLY for:

- `SpectatorInvites` collection — persisting invite cards in chat
- `GameInvites` collection — the `spectatorOnly` flag on filled game invites
- No `LiveSpectatorSessions` collection (deleted)
- No `MatchSpectators` subcollection (deleted)

---

## 5. Implementation Order

### Phase 1: Server Foundation

1. Create `SpectatorEntry` schema
2. Add `spectators` MapSchema + `spectatorCount` to `BaseGameState`
3. Add spectator join/leave logic to all 4 base room classes
4. Create `SpectatorRoom` for single-player spectating
5. Register `spectator` room in `app.config.ts`

### Phase 2: Client Foundation

1. Create `useSpectator` hook
2. Create new `SpectatorBanner` component
3. Create new `SpectatorOverlay` component
4. Create new `SpectatorViewScreen`

### Phase 3: Integration

1. Update `colyseus.ts` config with spectator room
2. Update game screens to use `isSpectator` from route params
3. Update game invite handling for spectator join
4. Update chat screens for spectator invite actions
5. Update navigation routes

### Phase 4: Cleanup

1. Remove old spectator files (9 dedicated files)
2. Remove old spectator code from integrated files
3. Remove unused Firestore collections/rules
4. Update documentation
5. Add tests

---

## 6. Files Changed

### New Files

- `colyseus-server/src/schemas/spectator.ts`
- `colyseus-server/src/rooms/spectator/SpectatorRoom.ts`
- `src/hooks/useSpectator.ts`
- `src/components/games/SpectatorBanner.tsx` (rewrite)
- `src/components/games/SpectatorOverlay.tsx` (rewrite)
- `src/screens/games/SpectatorViewScreen.tsx` (rewrite)

### Modified Files

- `colyseus-server/src/schemas/common.ts` — add SpectatorEntry + fields
- `colyseus-server/src/rooms/base/TurnBasedRoom.ts` — spectator support
- `colyseus-server/src/rooms/base/ScoreRaceRoom.ts` — spectator support
- `colyseus-server/src/rooms/base/PhysicsRoom.ts` — spectator support
- `colyseus-server/src/rooms/base/CardGameRoom.ts` — spectator support
- `colyseus-server/src/app.config.ts` — register SpectatorRoom
- `src/config/colyseus.ts` — add spectator room name
- `src/services/colyseus.ts` — add joinAsSpectator method
- `src/navigation/RootNavigator.tsx` — update SpectatorView route
- Game screens (4 turn-based + BrickBreaker) — use new pattern
- Chat screens — simplify spectator invite actions
- `src/services/gameInvites.ts` — simplify spectator invite functions

### Deleted Files (old system)

- `src/services/liveSpectatorSession.ts`
- `src/hooks/useLiveSpectatorSession.ts`
- `src/hooks/useSpectatorMode.ts`
- `src/components/games/SpectatorInviteModal.tsx`
- `src/components/games/SpectatorInviteMessage.tsx`
- `src/components/games/SpectatorInviteCard.tsx`
