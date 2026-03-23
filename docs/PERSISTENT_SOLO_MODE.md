# Persistent Solo Mode — Design & Integration Guide

> **Status**: Implemented (MVP) — No games currently use this mode (Viral Loop removed)
> **Module**: `gamesV4`

---

## Overview

Persistent Solo extends the existing `runtimeType: "solo"` with a new
`soloMode` sub-type that supports long-lived idle/incremental games.
Key difference from standard solo: the session is never implicitly ended,
surviving app-close, sleep, and extended offline periods.

The important caveat is that `soloSuspendedAt` is an in-app exit marker, not a
process-death guarantee. The shell now waits for `suspendSoloSessionV4()` on
explicit navigation away from the game, but abrupt termination can still leave
a resumable session in an active-unsuspended state until the next explicit action.

| Property              | Standard Solo              | Persistent Solo            |
| --------------------- | -------------------------- | -------------------------- |
| Session lifetime      | Minutes–hours              | Days–weeks                 |
| Exit behavior         | In-app exit suspends       | In-app exit suspends       |
| Resume                | Auto-resume existing       | Auto-resume existing       |
| Resign / Forfeit      | Allowed                    | **Disabled**               |
| Archive (end run)     | N/A                        | Player-initiated           |
| Restart               | Resolves old → creates new | Resolves old → creates new |
| Offline progression   | No                         | Yes (adapter-driven)       |
| Watchdog auto-resolve | N/A (solo exempt)          | Exempt                     |
| Game Over trigger     | Score=0 / resign / adapter | Archive only               |

---

## Architecture

The system does **not** introduce a new top-level `runtimeType`. Instead it
adds a `SoloMode` sub-type:

```typescript
type SoloMode = "standard" | "persistent";
```

Each game declares its mode in `GAME_METADATA.soloMode` (defaults to
`"standard"`). All behavior differences are derived from this single field
via the lifecycle policy abstraction.

### Lifecycle Policy

`getGameLifecyclePolicy(gameId)` returns a `SessionLifecyclePolicy` object
that controls shell, service, and backend behavior:

```typescript
interface SessionLifecyclePolicy {
  runtimeType: GameRuntimeType;
  soloMode: SoloMode;
  allowResign: boolean;
  suspendOnExit: boolean;
  resolveOnExit: boolean;
  autoResumeExisting: boolean;
  inactivityAutoResolve: boolean;
  showTerminalScreenOnSuspend: boolean;
  allowRestart: boolean;
  supportsOfflineProgression: boolean;
}
```

Helper functions:

- `getSoloMode(gameId)` — returns `SoloMode`
- `isPersistentSoloGame(gameId)` — convenience boolean
- `getGameLifecyclePolicy(gameId)` — full policy object

---

## Session Schema Extensions

`GameSessionV4` gains four optional fields (both client and backend):

| Field              | Type         | Purpose                            |
| ------------------ | ------------ | ---------------------------------- |
| `soloMode`         | `SoloMode?`  | Denormalized for queries           |
| `lastSimulatedAt`  | `Timestamp?` | Last time game state was simulated |
| `runStartedAt`     | `Timestamp?` | When the current run began         |
| `lastServerSaveAt` | `Timestamp?` | Last server-side state save        |

These fields are **undefined** for non-persistent sessions, maintaining
backward compatibility.

---

## Backend Callables

### Modified callables

| Callable                      | Changes                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `resumeOrCreateSoloSessionV4` | Applies offline progression on resume; writes persistent fields on create     |
| `restartSoloSessionV4`        | Resolves old as "win" (not "resign") for persistent; writes persistent fields |
| `suspendSoloSessionV4`        | Writes `lastSimulatedAt` / `lastServerSaveAt` for persistent                  |

### New callable

**`archiveSoloSessionV4`** — Player-initiated run termination.

- Validates session ownership and non-terminal status
- Delegates to `resolveSessionV4Internal` with `resolutionType: "win"`
- Awards XP and achievements through the standard reward pipeline
- Cannot be double-called (idempotent via resolve's status check)

### Offline Progression Flow

On `resumeOrCreateSoloSession` for an existing persistent session:

1. Read current `PublicState/state`
2. Compute elapsed time since `lastSimulatedAt`
3. Clamp to `MAX_OFFLINE_WINDOW_MS` (24 hours)
4. Skip if elapsed < 60 seconds
5. Call `adapter.applyOfflineProgression(pubState, elapsedMs)`
6. Write updated state + `lastSimulatedAt` back to Firestore

---

## Adapter Contract Extensions

`GameAdapterV4` gains 6 optional hooks:

```typescript
// Offline progression
supportsOfflineProgression?: boolean;
applyOfflineProgression?(state: Record<string, unknown>, elapsedMs: number):
  Record<string, unknown>;

// Persistent solo summaries
getPersistentSoloSummary?(state: Record<string, unknown>):
  { label: string; value: string }[];

// Lifecycle control
canArchive?(state: Record<string, unknown>): boolean;
canRestart?(state: Record<string, unknown>): boolean;
archiveRun?(state: Record<string, unknown>):
  { scoreboard: FinalScoreboardEntry[]; performanceMetrics?: Record<string, unknown> };
```

All hooks are optional and have sensible defaults. Adapters for standard
solo games are completely unaffected.

---

## Frontend Changes

### Game Screen Shell (`GameScreenShell.tsx`)

- Resign button hidden for persistent solo
- Menu shows "Session Menu" / "Archive Run" / "Restart Run" / "Save & Return"
- Auto-navigate to GameOver is skipped for persistent (stays in-game)

### Game Over Screen (`GameOverScreenV4.tsx`)

- Persistent archive shows "Run Archived" (neutral color, not red)
- Rematch button shows "Start New Run" instead of "Play Again"
- Resign text shows "Game Over" for solo (not "You Resigned")

### Games Hub (`GamesHubScreenV4.tsx`)

- Subscribes to active solo sessions via `subscribeToActiveSoloSessions`
- Card badge shows "Resume" (instead of "Play Now") when active session exists
- Long-press action sheet includes "Archive Run" option for persistent games

---

## Firestore Index

A new composite index is required for the active-solo-sessions query:

```
GameSessionsV4:
  participantUids (array-contains) + runtimeType (ASC) + status (ASC)
```

Added to `firebase-backend/firestore.indexes.json`.

---

## Integration Checklist — Adding a New Persistent Solo Game

1. Add `GameId` variant to `src/gamesV4/types/common.ts`
2. Add metadata entry to `GAME_METADATA` in `src/gamesV4/constants.ts`:
   - Set `soloMode: "persistent"`
   - Set `supportsOfflineProgression: true` if applicable
   - Set `allowResign: false`, `allowRestart: true`, `autoResumeExisting: true`
3. Add the same `GameId` to `firebase-backend/functions/src/gamesV4/types.ts`
4. Implement adapter (both client and backend):
   - Required: `computeOutcome`, `serializeState`, `deserializeState`
   - Optional: `applyOfflineProgression`, `getPersistentSoloSummary`,
     `canArchive`, `canRestart`, `archiveRun`
5. Add game screen component
6. Register in `GamePlayDispatcherV4.tsx` screen map
7. Add to `IMPLEMENTED_GAME_IDS` when ready
8. Run `npx jest persistentSolo` to verify policy contracts

---

## Testing

| Test file                                       | Coverage                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `__tests__/gamesV4/persistentSolo.test.ts`      | Lifecycle policy, menu labels, hub affordances, watchdog exemption |
| `__tests__/gamesV4/constants/constants.test.ts` | Game count, metadata integrity, policy shape validation            |
| `__tests__/gamesV4/soloSuspendResume.test.ts`   | Existing solo suspend/resume (no regressions)                      |

All tests: `npx jest --no-coverage __tests__/gamesV4/`

---

## Files Modified

### Client

- `src/gamesV4/types/common.ts` — `SoloMode` type
- `src/gamesV4/types/index.ts` — Barrel export
- `src/gamesV4/types/session.ts` — Persistent session fields
- `src/gamesV4/types/adapter.ts` — Optional adapter hooks
- `src/gamesV4/constants.ts` — Metadata extension, lifecycle policy, helpers
- `src/gamesV4/components/GameScreenShell.tsx` — Policy-aware shell
- `src/gamesV4/screens/GameOverScreenV4.tsx` — Persistent-aware labels
- `src/gamesV4/screens/GamesHubScreenV4.tsx` — Resume affordances
- `src/gamesV4/services/gameServiceV4.ts` — Archive callable, active session query

### Backend

- `firebase-backend/functions/src/gamesV4/types.ts` — Mirror of client types
- `firebase-backend/functions/src/gamesV4/adapters.ts` — Adapter hooks
- `firebase-backend/functions/src/gamesV4/solo.ts` — All solo callables + archive
- `firebase-backend/functions/src/gamesV4/index.ts` — Archive export
- `firebase-backend/functions/src/gamesV4/watchdog.ts` — Exemption comments

### Infrastructure

- `firebase-backend/firestore.indexes.json` — Composite index for active solo query

### Tests

- `__tests__/gamesV4/constants/constants.test.ts` — Updated counts + lifecycle tests
- `__tests__/gamesV4/persistentSolo.test.ts` — New comprehensive test suite
