# Games V4 — Targeted Upgrade Deliverable

## 1. Audit Findings

| Area                  | Finding                                                                            | Severity |
| --------------------- | ---------------------------------------------------------------------------------- | -------- |
| Exit UX               | All games shared the same resign-on-back behavior regardless of `runtimeType`      | HIGH     |
| Exit UX               | Solo games (2048) had no quit/resign control — FAB was hidden                      | HIGH     |
| Lobby Settings        | `updateLobbySettingsV4` was a **complete stub** — wrote nothing to Firestore       | HIGH     |
| Lobby Settings        | Non-host participants could not see lobby settings at all                          | MEDIUM   |
| Moderation            | Zero admin/owner game-clearing tools existed (confirmed by regex scan)             | HIGH     |
| Crazy Eights          | Client adapter: 10-field `settingsSchema` + full `defaultSettings` already present | OK       |
| Sketch Party          | Client adapter: 7-field `settingsSchema` + full `defaultSettings` already present  | OK       |
| Backend Adapters      | Both CE and SP have `defaultSettings` + `validateSettings` in backend adapters.ts  | OK       |
| Navigation/Resume     | Firestore subscription-based resume is architecturally correct — no fix needed     | OK       |
| Presence              | `Users/{uid}/GamePresence/{sessionId}` write-on-mount / delete-on-unmount correct  | OK       |
| Deep Links            | `game/play/:sessionId`, `game/lobby/:inviteId`, `game/over/:sessionId` all routed  | OK       |
| Pinned Invites        | FIFO eviction at `MAX_PINNED_INVITES=5` working correctly                          | OK       |
| Pre-existing Test Bug | `lobbyBugRegression.test.ts` hardcodes `IMPLEMENTED_GAME_IDS.size === 3` — stale   | LOW      |

---

## 2. Implementation Summary

### Phase 2 — Turn-Based vs Solo/Realtime Exit Model

**File:** `src/gamesV4/components/GameScreenShell.tsx`

**What changed:**

- Derives `runtimeType` from `GAME_METADATA` at runtime — NO per-game hardcoding
- **Turn-based games:** Back arrow (top-left header), pressing it navigates back without resigning. Session is preserved. Resign FAB remains at bottom-right for intentional resign.
- **Solo / Realtime games:** Resign/Quit button (top-right header). Hardware back triggers a destructive-confirm Alert before abandoning the game. No back arrow.
- Cross-cutting invariant: every game gets exactly ONE of { back arrow, resign button } — XOR enforced

**Key additions:**

- `canNavigateBackWithoutResign`, `showBackArrow`, `showResignAction` flags
- `handleNonDestructiveLeave()` callback for turn-based back navigation
- Runtime-aware `BackHandler` with destructive confirm for solo/realtime
- New styles: `shellHeader`, `headerBtn`, `resignBtn`, `resignBtnText`

---

### Phase 3 — Admin/Owner Game Moderation

**New file:** `firebase-backend/functions/src/gamesV4/moderation.ts` (~395 lines)

**Callables:**
| Callable | Purpose |
|----------|---------|
| `adminClearGameV4` | Force-clear a single broken game (invite + session) |
| `adminClearConversationGamesV4` | Force-clear ALL games in a conversation |

**Design decisions:**

- **Soft-clear by default:** Invites → `resolved + hidden + TTL`. Sessions → `abandoned` with `resolution.type = "error"` (prevents reward corruption).
- **Permission-gated:** DM participants have equal authority. Groups require `owner` or `admin` role (checked via `Members` subcollection + top-level `createdBy`/`ownerId`).
- **Idempotent:** Safe to call repeatedly on the same target — already-terminal docs are no-ops.
- **Audit logged:** Every clear writes to `GameModerationAuditV4` (server-only Firestore collection, client read/write = false).
- **Unpin:** Clears `pinnedGameInviteIds` on the conversation doc to remove stale bubble references.

**Other modified files:**

- `firebase-backend/functions/src/gamesV4/index.ts` — exports added
- `firebase-backend/functions/src/index.ts` — exports added
- `firebase-backend/firestore.rules` — `GameModerationAuditV4/{docId}` rule (server-only)
- `src/gamesV4/services/gameServiceV4.ts` — client wrappers `adminClearGame()` and `adminClearConversationGames()`

---

### Phase 4 — Generic Lobby Settings System

**File:** `firebase-backend/functions/src/gamesV4/lobby.ts`

**`updateLobbySettingsV4` — replaced stub with real implementation:**

1. Sanitises input via `sanitisePayload()` (depth/size capping)
2. Validates against adapter's `validateSettings()` if available
3. Falls back to whitelist-merge against `defaultSettings` if no `validateSettings`
4. Persists `lobbySettings` field on invite doc inside a Firestore transaction
5. Host-only: checks `invite.hostId === uid`
6. Status-gated: only `"sent"` or `"lobby"` status allowed

**`startGameFromInviteV4` — settings fallback:**

- When `settings` param is not passed, uses `invite.lobbySettings` as fallback
- `session.settings` (which includes the fallback) feeds into `createInitialState()`

**File:** `src/gamesV4/components/LobbySettingsPanel.tsx`

- New props: `readOnly?: boolean`, `externalValues?: Record<string, unknown>`
- `handleChange` respects readOnly flag
- External values sync for live host updates (non-host sees changes in real-time)
- Header shows "(View Only)" badge when readOnly
- All controls (`<Switch>`, stepper buttons, select radio buttons) accept `disabled` prop with reduced opacity

**File:** `src/gamesV4/screens/GameLobbyScreenV4.tsx`

- Settings panel now rendered for ALL participants (host + non-host + spectators)
- Host changes persist via `updateLobbySettings()` callable
- Non-hosts see `readOnly` panel with `externalValues` from `invite.lobbySettings`

---

### Phase 5 — Crazy Eights + Sketch Party Settings

**Finding:** Both games already have complete settings implementations — no recovery needed.

| Game         | Client Schema Fields                                                     | Backend `defaultSettings` | `validateSettings` |
| ------------ | ------------------------------------------------------------------------ | ------------------------- | ------------------ |
| Crazy Eights | 10 fields (stack, draw, timer, round, target points)                     | ✅ Full match             | ✅ Present         |
| Sketch Party | 7 fields (players, rounds, draw time, choose time, words, hints, custom) | ✅ Full match             | ✅ Present         |

The only gap: settings were never persisted because `updateLobbySettingsV4` was a stub. **Fixed in Phase 4.**

---

### Phase 6 — Navigation / Resume Hardening

**Finding:** The existing architecture is already correct. No changes needed.

- **Resume:** `useGameSessionV4` subscribes via `onSnapshot` to `GameSessionsV4/{sessionId}`. On app resume / re-mount, the subscription re-establishes and Firestore delivers latest state automatically.
- **Presence:** `GameScreenShell` writes presence on mount, deletes on unmount via `useEffect` cleanup.
- **Deep links:** All three patterns (`play/:sessionId`, `lobby/:inviteId`, `over/:sessionId`) are handled by the navigation stack.

---

## 3. Test Files

| Test File                                       | Tests   | Coverage                                                                                                                                               |
| ----------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `__tests__/gamesV4/gameScreenShellExit.test.ts` | 17      | Exit behavior invariants: turn-based ↔ back arrow, solo/realtime ↔ resign, XOR guarantee, specific game assertions, presence shape, terminal detection |
| `__tests__/gamesV4/lobbySettings.test.ts`       | 42      | Schema invariants (all adapters), CE-specific (10 fields), SP-specific (7 fields), host/non-host access, merge/fallback logic, settings propagation    |
| `__tests__/gamesV4/moderation.test.ts`          | 22      | Permission gating (DM/group owner/admin/member), soft-clear invite, soft-clear session, bulk clear, audit log shape, idempotent edge cases             |
| `__tests__/gamesV4/presenceNavigation.test.ts`  | 45      | Presence shape, terminal detection, deep link routes, resume flow, notification gating, GAME_METADATA completeness, pinned invite FIFO                 |
| **Total**                                       | **126** | All passing ✅                                                                                                                                         |

---

## 4. Verification Notes

### Implemented (production-ready)

- ✅ Runtime-aware exit UX in `GameScreenShell` (back arrow vs resign)
- ✅ `updateLobbySettingsV4` backend callable (validated, persisted, transactional)
- ✅ `LobbySettingsPanel` readOnly mode for non-host participants
- ✅ `adminClearGameV4` and `adminClearConversationGamesV4` callables
- ✅ `GameModerationAuditV4` Firestore rules (server-only)
- ✅ Client service wrappers for moderation callables
- ✅ `startGameFromInviteV4` lobbySettings fallback
- ✅ 126 regression tests across 4 test suites

### Scaffolded (requires UI integration)

- ⬜ Admin clear UI (buttons/menu in chat or group settings) — service wrappers ready, needs UI trigger
- ⬜ Moderation confirmation dialogs — callables are idempotent but UX should confirm before calling

### Pre-existing issues (not introduced by this work)

- `lobbyBugRegression.test.ts` has 2 stale assertions that hardcode `IMPLEMENTED_GAME_IDS.size === 3` and expect `chess` to be unimplemented — needs update to reflect current 9-game roster

---

## 5. Files Changed

| File                                                   | Action   | Lines    |
| ------------------------------------------------------ | -------- | -------- |
| `src/gamesV4/components/GameScreenShell.tsx`           | Modified | ~614     |
| `src/gamesV4/components/LobbySettingsPanel.tsx`        | Modified | ~378     |
| `src/gamesV4/screens/GameLobbyScreenV4.tsx`            | Modified | ~736     |
| `src/gamesV4/services/gameServiceV4.ts`                | Modified | ~820     |
| `firebase-backend/functions/src/gamesV4/moderation.ts` | **New**  | ~395     |
| `firebase-backend/functions/src/gamesV4/lobby.ts`      | Modified | ~728     |
| `firebase-backend/functions/src/gamesV4/index.ts`      | Modified | ~45      |
| `firebase-backend/functions/src/index.ts`              | Modified | ~245     |
| `firebase-backend/firestore.rules`                     | Modified | +3 lines |
| `__tests__/gamesV4/gameScreenShellExit.test.ts`        | **New**  | ~160     |
| `__tests__/gamesV4/lobbySettings.test.ts`              | **New**  | ~310     |
| `__tests__/gamesV4/moderation.test.ts`                 | **New**  | ~330     |
| `__tests__/gamesV4/presenceNavigation.test.ts`         | **New**  | ~215     |
