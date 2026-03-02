# Battleship — Feature Specification

Last verified: 2026-02-27

## Overview

Battleship is a two-player, invite-driven, realtime strategy game running on Colyseus.
Players place ships on a 10×10 grid, then take turns firing shots to sink the opponent's fleet.
The first player to sink all 5 enemy ships wins.

Canonical source: `docs/GAMES_SYSTEM.md` (§7 Battleship section)

## Architecture

| Layer         | File                                                    | Lines    |
| ------------- | ------------------------------------------------------- | -------- |
| Colyseus room | `colyseus-server/src/rooms/turnbased/BattleshipRoom.ts` | ~1096    |
| Schemas       | `colyseus-server/src/schemas/battleship.ts`             | 231      |
| Client screen | `src/screens/games/BattleshipGameScreen.tsx`            | ~1329    |
| Client hook   | `src/hooks/useBattleshipGame.ts`                        | 523      |
| Game adapter  | `src/config/gameAdapters.ts`                            | —        |
| Room tests    | `colyseus-server/tests/rooms/BattleshipRoom.test.ts`    | 97 tests |

### V3 Session Entry Path

Battleship is a **game-managed** connection mode game. The v3 entry flow is:

```
SessionLobbyScreen → startSessionV3 (sets firestoreGameId = sessionId)
  → navigation.replace("BattleshipGame", {
      sessionId, matchId, firestoreGameId, v3Session: sessionId, entryPoint
    })
  → BattleshipGameScreen mounts → v3StartedRef reads firestoreGameId
  → startMultiplayer({ firestoreGameId }) → Colyseus joinOrCreate
  → filterBy(["firestoreGameId"]) ensures both players join same room
```

Fallback chain: `firestoreGameId → matchId → v3Session`

## Game Rules

### Fleet Configuration

| Ship       | Size | Count |
| ---------- | ---- | ----- |
| Carrier    | 5    | 1     |
| Battleship | 4    | 1     |
| Cruiser    | 3    | 1     |
| Submarine  | 3    | 1     |
| Destroyer  | 2    | 1     |

**Total ship cells:** 17 across 5 ships on a 10×10 (100 cell) grid.

### Phase Machine

```
waiting → placement → combat → finished
```

- **waiting**: Lobby phase. Players join via `SessionLobbyScreen` (v3 session flow) or legacy universal invite. Game starts when 2 players are present and the host presses "Start Game" (calls `startSessionV3`).
- **placement** (30s timer): Each player places all 5 ships. Ships cannot overlap or extend off the grid. If a player does not place in time, the server auto-fills with random valid placements.
- **combat** (30s per turn): Players alternate turns firing at the opponent's grid. On timeout, the server fires a random unshot cell. Each shot resolves as hit, miss, or sunk. The game ends when all 5 ships of one player are sunk.
- **finished**: Winner determined. Full board revealed to both players. Stats persisted.

### Fog-of-War

Ship placements are stored **server-side only** in a private `Map<string, PlayerBoard>`, NOT in the Colyseus schema. This prevents clients from reading opponent data from the synchronized state.

What each player sees:

- **Own board**: Full ship placements (via targeted `board_state` messages)
- **Opponent board**: Only shot results (hit/miss markers) and sunk ship outlines

What spectators see:

- Both boards fully revealed (no fog-of-war)

### Win Conditions

1. **Sink all ships**: First player to destroy all 17 enemy ship cells wins.
2. **Surrender**: Opponent sends `surrender` message, immediate forfeit.
3. **Disconnect**: Opponent leaves and does not reconnect within the allowed window.

## Message Protocol

### Client → Server

| Message       | Phase     | Payload                      | Description                  |
| ------------- | --------- | ---------------------------- | ---------------------------- |
| `place_ships` | placement | `{ ships: ShipPlacement[] }` | Submit fleet placements      |
| `fire`        | combat    | `{ x: number, y: number }`   | Fire a shot at opponent grid |
| `surrender`   | combat    | `{}`                         | Forfeit the match            |

### Server → Client

| Message       | Target     | Payload                             | Description                        |
| ------------- | ---------- | ----------------------------------- | ---------------------------------- |
| `board_state` | Individual | `{ placements: ShipPlacement[] }`   | Private board data for one player  |
| `shot_result` | Broadcast  | `{ x, y, result, shooterUid, ... }` | Hit/miss/sunk result of a shot     |
| `game_over`   | Broadcast  | `{ winnerId, winReason, boards }`   | End-of-game with full board reveal |

## Completion Pipeline

```
BattleshipRoom.onDispose()
  → clears firestoreGameId (forces RealtimeGameSessions path)
  → persistGameResult(state, durationMs, perPlayerStats)
    → writes RealtimeGameSessions/{sessionId} doc
      → triggers processRealtimeGameCompletion Cloud Function
        → updatePerGameStatsV2() per player
        → evaluateAchievementsV2() per player
        → awardGameXp() per player (category: "board")
        → writes GameHistory doc
  → deleteGameAndInvite() (transitions invite to terminal)
  → If v3SessionId present:
    → resolveV3Session(sessionId, outcome, scores, winner)
    → Session transitions to "resolved" phase
```

The client does **not** call `submitGameResult` or `onGameResult`. The entire completion flow is server-driven and idempotent (Firestore `onCreate` fires exactly once per document).

### Per-Player Stats (gameSpecific)

| Stat Key             | Type   | Description                          |
| -------------------- | ------ | ------------------------------------ |
| `hits`               | number | Total hit shots                      |
| `misses`             | number | Total missed shots                   |
| `shotsFired`         | number | Total shots taken                    |
| `accuracy`           | number | Hit percentage (0-100)               |
| `shipsRemaining`     | number | Player's surviving ships at end      |
| `shipCellsRemaining` | number | Player's surviving ship cells at end |
| `shipsSunk`          | number | Opponent ships sunk by player        |
| `flawlessWin`        | 0/1    | Winner kept all 5 ships              |
| `sharpshooterWin`    | 0/1    | Winner had ≥70% accuracy             |
| `comebackWin`        | 0/1    | Winner had only 1 ship remaining     |
| `perfectGame`        | 0/1    | Winner had 0 misses                  |
| `speedrunWin`        | 0/1    | Winner fired ≤25 shots               |

## Achievements

| ID                                    | Name               | Tier     | Type           | Key/Target               |
| ------------------------------------- | ------------------ | -------- | -------------- | ------------------------ |
| `achv.rt.battleship.first_match`      | Anchors Aweigh     | bronze   | count          | 1 match                  |
| `achv.rt.battleship.first_win`        | Victorious Admiral | bronze   | count          | 1 win                    |
| `achv.rt.battleship.wins_10`          | Fleet Commander    | silver   | count          | 10 wins                  |
| `achv.rt.battleship.matches_25`       | Sea Veteran        | gold     | count          | 25 matches               |
| `achv.rt.battleship.flawless_victory` | Unsinkable         | gold     | stat_threshold | flawlessWin ≥ 1          |
| `achv.rt.battleship.sharpshooter`     | Sharpshooter       | silver   | stat_threshold | sharpshooterWin ≥ 1      |
| `achv.rt.battleship.comeback`         | Against the Tide   | gold     | stat_threshold | comebackWin ≥ 1          |
| `achv.rt.battleship.perfect_game`     | Perfect Storm      | platinum | stat_threshold | perfectGame ≥ 1 (secret) |
| `achv.rt.battleship.speedrun`         | Blitz Attack       | platinum | stat_threshold | speedrunWin ≥ 1 (secret) |

Achievements are defined in both catalogs:

- Server: `firebase-backend/functions/src/achievementsV2Evaluator.ts` → `buildCatalog()`
- Client: `src/config/achievementsCatalog.ts` → `buildRealTimeAchievements()`

The client `RT_SECTIONS` includes a `rt_battleship` section for the achievements tab UI.

## Registry Integration Points

| Registration Point               | Value                                                    | File                                                        |
| -------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| Game type union                  | `"battleship"` in `RealTimeGameType`                     | `src/types/games.ts`                                        |
| `GAME_METADATA`                  | Full entry                                               | `src/types/games.ts`                                        |
| `EXTENDED_GAME_SCORE_LIMITS`     | `{ min: 0, max: 9999, higher }`                          | `src/types/games.ts`                                        |
| `GAME_RUNTIME_TYPE`              | `battleship: "realtime"`                                 | `src/types/games.ts`                                        |
| `GAME_SCREEN_MAP`                | `battleship: "BattleshipGame"`                           | `src/config/gameCategories.ts`                              |
| Navigation type                  | `BattleshipGame` route                                   | `src/types/navigation/root.ts`                              |
| `RootNavigator`                  | `SafeBattleshipGame` screen                              | `src/navigation/RootNavigator.tsx`                          |
| `COLYSEUS_GAME_MAPPING`          | `clientKey: "battleship_game"`, `roomName: "battleship"` | `src/config/colyseus.ts`                                    |
| Server room registration         | `battleship` with `filterBy(["firestoreGameId"])`        | `colyseus-server/src/app.config.ts`                         |
| `EXTERNAL_COLYSEUS_INVITE_GAMES` | `"battleship"`                                           | `firebase-backend/functions/src/games.ts`                   |
| `GAME_XP_CATEGORY`               | `battleship: "board"`                                    | `firebase-backend/functions/src/games.ts`                   |
| `AVAILABLE_GAMES`                | `"battleship"`                                           | `firebase-backend/functions/src/achievementsV2Evaluator.ts` |
| `SCORE_LIMITS`                   | `battleship: { 0, 9999, "higher" }`                      | `firebase-backend/functions/src/achievementsV2Evaluator.ts` |
| Game invite defaults             | Entry exists                                             | `src/services/gameInvites.ts`                               |
| Back handler                     | `"battleship"` / `"battleship_game"`                     | `src/hooks/useGameBackHandler.ts`                           |
| Game result category             | `battleship: "board"`                                    | `src/types/gameResult.ts`                                   |
| Smoke tests                      | `"battleship"` in multi-game sweep                       | `__tests__/integration/smokeTestHarness.test.ts`            |

## Spectator Support

- `maxSpectators`: 10
- Spectators join with `{ spectator: true }` in join options
- Spectators see both boards fully revealed (no fog-of-war restriction)
- Spectators tracked in `MapSchema<string>` on room state
- Spectators cannot send `place_ships`, `fire`, or `surrender` messages

## Ship Placement Preview (Ghost Cells)

During the `placement` phase, the client provides a **ghost preview** so
players see exactly where a ship will land before committing:

| Interaction             | Behaviour                                                  |
| ----------------------- | ---------------------------------------------------------- |
| Tap a ship in the list  | Selects it; shows info bar with name, length & orientation |
| Tap a grid cell         | Shows ghost overlay anchored at that cell                  |
| Tap same cell again     | Commits the placement (sends `placeShips` to server)       |
| Tap a different cell    | Moves ghost to the new cell                                |
| Press **Rotate** button | Cycles orientation (H ↔ V); ghost updates in-place         |

**Ghost validity** — cells are coloured green (valid) or red (invalid).
Invalid means the ship extends out-of-bounds or overlaps an already-placed
ship. Haptic feedback (`lightTap` on preview, `errorBuzz` on invalid commit
attempt) reinforces the state.

### Helper module

Pure utility: `src/utils/battleshipPlacement.ts`

| Export             | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `computeShipCells` | Anchor + length + orientation → cell array           |
| `areCellsInBounds` | Bounds check against grid size                       |
| `hasOverlap`       | Checks cells against an occupied-cell set            |
| `buildOccupiedSet` | Aggregates placed-ship cells (with optional exclude) |
| `computeGhost`     | Integrates the above → `GhostResult`                 |

Unit tests: `__tests__/games/battleshipPlacement.test.ts` (37 tests).

## Reconnection

- Players have a reconnection window during `placement` and `combat` phases
- On disconnect during active game: opponent wins by forfeit if disconnected player does not return
- Room handles `onLeave(client, consented)` — only forfeits on consented leave or expired reconnection

## Manual Test Checklist (Placement Preview)

Use this checklist when manually verifying ship placement preview on-device:

- [ ] **Select ship** — tap a ship in the fleet list; info bar appears with
      name, length, and current orientation
- [ ] **Preview (green)** — tap an empty grid cell; green ghost cells appear
      for the ship length in the current orientation
- [ ] **Preview (red — OOB)** — tap a cell near the edge so the ship extends
      beyond the grid; ghost cells turn red
- [ ] **Preview (red — overlap)** — tap a cell that overlaps an already-placed
      ship; ghost cells turn red
- [ ] **Commit** — tap the _same_ cell again while ghost is green; ship is
      placed, ghost disappears, ship is removed from unplaced list
- [ ] **Reject invalid commit** — tap the same cell again while ghost is red;
      error haptic fires, ship is NOT placed
- [ ] **Move preview** — tap a different cell while ghost is visible; ghost
      moves to the new cell
- [ ] **Rotate** — press the Rotate button; orientation toggles H↔V and ghost
      updates immediately
- [ ] **Randomise** — press the Randomise button; all unplaced ships are
      placed randomly; ghost/cursor state is cleared
- [ ] **Clear board** — press the Clear button; all ships return to unplaced
      list; ghost/cursor state is cleared
- [ ] **Ready** — place all 5 ships, press Ready; `placeShips` message is
      sent, phase advances to combat (or waiting for opponent)
- [ ] **Fog-of-war** — during combat, opponent's ship positions are hidden;
      only hits/misses are shown
- [ ] **Spectator** — join as spectator; ship positions are hidden per
      fog-of-war rules
- [ ] **No action spam** — rapidly tapping grid cells or buttons does not
      cause duplicate placements or crashes

## Test Coverage

97 unit tests in `colyseus-server/tests/rooms/BattleshipRoom.test.ts`:

- Schema/state defaults and fleet configuration
- Placement validation (overlap, boundaries, all-or-none)
- Combat logic (hit, miss, sunk detection, turn alternation)
- Fog-of-war (server-only boards, shot-only shared state)
- Spectator support (maxSpectators, tracking, multi-join)
- Edge cases (duplicate shots, division by zero, random cell selection)
- Full game simulation (placement through win, surrender, disconnect)
- End-game payload format (perPlayerStats, game_over broadcast)

37 unit tests in `__tests__/games/battleshipPlacement.test.ts`:

- `computeShipCells` — horizontal, vertical, edge cells, length-1
- `areCellsInBounds` — in-bounds, out-of-bounds row/col, negative, custom grid
- `hasOverlap` — no conflict, partial overlap, empty sets
- `buildOccupiedSet` — full set, excludeShipId, empty ships
- `computeGhost` — valid, OOB, overlap, combined, re-placement, boundary, custom grid

Integration coverage: smoke test harness validates full invite → claim → start → complete lifecycle for battleship.
