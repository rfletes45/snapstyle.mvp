# AI Project Guide — snapstyle-mvp

> Deep technical handoff for AI agents that need to understand this repo quickly and safely ship features.
>
> Audience: coding agents and developers performing implementation work.
>
> Last verified against repository state: February 2026.

---

## 1) What This Repo Is

`snapstyle-mvp` is a multi-surface social app with real-time and async systems:

- **Client app (Expo / React Native)**: chats, friends, profile, stories, games, shop, wallet, tasks, camera/calls.
- **Firebase backend**: Auth + Firestore + Storage + Cloud Functions.
- **Colyseus server**: real-time multiplayer rooms for several games.
- **Embedded web game clients**: e.g. Tropical Fishing in `client/` embedded in RN via `WebView`.

Primary architectural theme:

```text
Client action -> local-first write (SQLite where enabled) -> immediate UI -> background sync -> Firestore
```

---

## 2) Monorepo Map (High-Value Folders)

- `src/` — main RN app code.
- `firebase-backend/` — rules, indexes, storage rules, cloud functions.
- `colyseus-server/` — Node + Colyseus room server.
- `client/` — web client used for embedded game flows.
- `docs/` — architecture + subsystem references.
- `constants/` — global theme and feature flags.
- `__tests__/` + `e2e/` — test suites.

For orientation, start with:

1. `App.tsx`
2. `src/navigation/RootNavigator.tsx`
3. `constants/featureFlags.ts`
4. `docs/01_ARCHITECTURE.md`
5. `docs/02_FIREBASE.md`
6. `docs/03_CHAT_V2.md`
7. `docs/06_GAMES.md`

---

## 3) Runtime & Toolchain Snapshot

From `package.json` and app config:

- **Expo SDK**: `~54`
- **React Native**: `0.81.5`
- **React**: `19.1.0`
- **TypeScript**: `~5.9.2`
- **Firebase JS SDK**: `^12.8.0`
- **Colyseus client SDK**: `^0.17.31`
- **Skia**: `^2.2.12`
- **Three.js**: `^0.166.1`
- **Matter.js**: `^0.20.0`
- **VisionCamera** present but currently gated by flag

Important scripts:

- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run lint`
- `npm run type-check`
- `npm run test`

---

## 4) App Bootstrap & Global Providers

`App.tsx` does several side-effectful boot actions **before UI**:

- Firebase initialization via `initializeFirebase(firebaseConfig)`.
- Orientation lock to portrait by default.
- Call background handler + app-state listener + notification channel setup.

High-level provider stack:

```tsx
<KeyboardProvider>
  <ErrorBoundary>
    <ThemeProvider>
      <GestureHandlerRootView>
        <PaperProvider>
          <SnackbarProvider>
            <AuthProvider>
              <UserProvider>
                <CallProvider>
                  <InAppNotificationsProvider>
                    <CameraProvider>
                      <OutboxProcessorProvider />
                      <RootNavigator />
                      <InAppToast />
                      <IncomingCallOverlay />
```

Implication for new features:

- If a feature needs global state or app-wide listeners, put it in an existing provider or add one carefully near this tree.
- If a feature depends on auth/user state, place hooks/components under `AuthProvider` + `UserProvider`.

---

## 5) Navigation Topology (Where Screens Actually Live)

Main navigation is in `src/navigation/RootNavigator.tsx`.

- Auth flow uses `AuthStack`.
- Authenticated shell uses tab stacks (`Shop`, `Play`, `Inbox`, `Moments`, `Profile`).
- Many full-screen routes (chat details, overlays, game screens) are intentionally elevated to root stack behavior.
- Some routes hide the tab bar via `ROUTES_WITH_HIDDEN_TAB_BAR`.

Practical rule when adding screens:

- If a screen must overlay tabs or run immersive full-screen (game/call/media), add at root-level or tab-hidden route.
- If it is regular section content, attach to the nearest feature stack.

---

## 6) Feature Flags Are First-Class (Do Not Bypass)

`constants/featureFlags.ts` controls staged rollout across systems.

Notable current behavior:

- `USE_LOCAL_STORAGE = !IS_WEB` (SQLite local-first enabled on native, disabled on web).
- `USE_VISION_CAMERA = false` (Expo camera path active for Expo Go compatibility).
- Profile/play subsystems have large grouped feature objects set mostly to `true`.
- Calls are present but gated by dedicated call feature flags.

Feature work checklist:

1. Decide if feature is launch-safe or experimental.
2. Add or reuse a flag in the appropriate group.
3. Gate UI and service-layer behavior (not just UI).
4. Default conservatively if risky.

---

## 7) Data & Backend Contract (Firestore + Functions)

Project references in docs/config:

- Firebase Project ID: `gamerapp-37e70`
- Region: `us-central1`
- Rules: `firebase-backend/firestore.rules`
- Storage rules: `firebase-backend/storage.rules`
- Indexes: `firebase-backend/firestore.indexes.json`
- Functions source: `firebase-backend/functions/src/`

### Core collections to know before edits

- `Users/{uid}` (+ subcollections like `inventory`, `blockedUsers`, `Achievements`, `GameStats`, settings docs)
- `Chats/{chatId}/Messages/{messageId}`
- `Groups/{groupId}/Messages/{messageId}` + `Members` / `MembersPrivate`
- `FriendRequests`, `Friends`
- `stories`
- `GameInvites`, `turnBasedMatches`, `GameSessions`, `Leaderboards`
- economy/moderation/task/shop collections

### Rules discipline

`firestore.rules` contains strict validation and ownership constraints, including profile system validations (`bio`, `status`, `privacy`, theme/decorations), chat constraints, and moderation-sensitive areas.

**If you add/rename a Firestore field that writes from client code, you must verify rules permit it.**

Typical safe workflow:

1. Update TypeScript model(s).
2. Update service write path.
3. Update `firestore.rules` validation if needed.
4. Update indexes if query patterns changed.
5. Re-run type-check/tests.
6. Deploy rules/indexes with functions only when validated.

---

## 8) Messaging System (Unified DM + Group)

Messaging architecture is documented in `docs/03_CHAT_V2.md` and implemented primarily under:

- `src/services/messaging/` (unified API)
- `src/hooks/useChat.ts` (master interface)
- `src/hooks/useUnifiedChatScreen.ts` (screen composition)
- `src/services/database/` + `src/services/sync/` (local-first persistence and sync)
- `src/services/outbox.ts` (offline queue)

Three hard invariants called out in docs and code design:

1. No duplicate sends (idempotency keys / `clientId`).
2. Authoritative ordering from server timestamps.
3. Watermark-style unread/read, avoiding per-message mutation explosion.

When editing chat:

- Prefer unified service interfaces over bypassing with direct Firestore writes.
- Keep DM/group behavior parity unless explicitly divergent by product requirement.
- Preserve outbox states (`queued/sending/sent/failed`) and optimistic UX semantics.
- Keep migration-aware: there is still legacy overlap in `chatV2.ts` and group codepaths.

---

## 9) Profile System (Current Reality)

Profile domain is broad and active. Key file:

- `src/services/profileService.ts`

It includes operations for:

- full profile fetch + realtime subscription
- privacy filtering + relationship detection
- decorations/themes/status/bio
- sharing, block/report/mute, friendship metadata

Recent behavior to preserve:

- Default profile theme baseline is darkened (`default` theme values in `src/data/profileThemes.ts`).
- Profile screens consume equipped/effective theme paths and use themed section dividers/sign-out styling.
- Firestore rules include profile field validators; invalid shape or unsupported fields can hard-fail updates.

Profile change checklist:

1. Update `types` definitions first.
2. Update service reads/writes with fallback defaults.
3. Validate both own and viewed-profile screens.
4. Confirm rules allow new/changed fields.
5. Verify no regression in default-theme or fallback rendering.

---

## 10) Games System (Hybrid Runtime)

The games platform combines multiple execution models:

- **Single-player local loops**
- **Turn-based Firestore-backed gameplay**
- **Real-time Colyseus room-based gameplay**

Primary references:

- `docs/06_GAMES.md`
- `src/screens/games/`
- `src/hooks/useGameConnection.ts`, `useMultiplayerGame.ts`, `useTurnBasedGame.ts`, etc.
- `colyseus-server/src/rooms/`

The Play tab and metadata system are extensive; game definitions route through shared typing/metadata and screen registration in navigation.

When adding a game:

1. Add metadata/type entry (`src/types/games.ts` + registry).
2. Add screen + route registration in `RootNavigator.tsx`.
3. Choose runtime model (single/turn-based/colyseus).
4. Add stats/leaderboard/achievement hooks if needed.
5. Gate via feature flags if incomplete.
6. Add tests for reducers/logic/services where possible.

---

## 11) Embedded Web Game Pattern (Tropical Fishing Example)

The app contains an embedded web game flow (`client/`) hosted through Colyseus server endpoints and loaded into RN via `WebView`.

Design implications:

- Invite params are forwarded into web session mode.
- Multiplayer room resolution often keys off shared invite/session identifiers.
- There is graceful fallback handling when host/room is not reachable.

If you modify embedded game integration, verify:

- host URL resolution paths
- invite parameter translation
- fallback UX on connection failure
- no breakage to standard app navigation lifecycle

---

## 11b) Games Platform: Lobby Overlay, Recovery, Trace IDs & Debugging

> Added 2026-02-17 during Segments 1-9 of the Game System Overhaul.

The games platform underwent a 12-segment infrastructure overhaul. Key subsystems to be aware of:

**Error Taxonomy**: All game errors use `GameErrorCode` (28 codes) from `src/types/gameErrors.ts`. Each code has a severity, category, user-facing message, and optional recovery actions. See `docs/06_GAMES.md § Error Taxonomy`.

**Protocol Version**: `GAME_PROTOCOL_VERSION` in `src/types/gameProtocol.ts` must match between client and server. Bump on breaking schema changes. Server rejects mismatched clients.

**Trace IDs**: Every game session and invite carries a `traceId` (format `inv-xxxx` or `gs-xxxx`) from `src/utils/trace.ts`. Trace IDs flow through invite → lobby → join → server room → bug reports, enabling end-to-end debugging.

**Unified Lobby**: `MultiplayerLobbyOverlay` + `useGameLobbyController` provide a single lobby UX for all multiplayer games. Legacy per-game lobby components have been removed.

**Invite System**: Universal invite API (`sendUniversalInvite`, `claimInviteSlot`, `startGameEarly`, etc.) replaced the legacy 1:1 invite system. `InvitePickerModal` (unified Friends + Groups tabs) replaced separate pickers on all multiplayer screens. Legacy invite functions are deprecated with zero production callers.

**Game Debug HUD**: `GameDebugHUD` (dev-mode only) shows room state, trace IDs, lobby phase, and watchdog status. Enabled via press-and-hold on game chrome.

**Bug Reports**: `submitBugReport()` writes to Firestore `BugReports` collection with full game context, trace IDs, and state snapshots.

**Watchdogs**: Three watchdog layers detect stuck states — client room health (15s), lobby stuck (30s), server stuck room (60s). See `docs/06_GAMES.md § Watchdog Thresholds`.

**Spectator System**: Unified entry via `SpectatorViewScreen` (route param `spectatorMode: "sp" | "multiplayer"`). SpectatorRoom has adaptive throttling (4-tier load shedding) and `SpectatorSessions` Firestore docs replace message mutation.

**Debugging workflow**:

1. Get `traceId` from Debug HUD or bug report
2. Search Firestore `BugReports` by `context.traceId`
3. Check `GameInvites` doc for `traceId` field
4. Check server logs for matching `traceId`

---

## 12) Calls & Camera Caveats

Calls and camera have native complexity and feature-gating:

- `react-native-webrtc`, `react-native-callkeep`, and call providers/services are wired but gated.
- `react-native-vision-camera` is installed, but runtime flag currently prefers Expo camera fallback.
- `app.config.ts` includes camera/mic/call/notification permissions and plugins.

Do not flip camera backend flags casually. Verify dev-client/build-mode constraints first.

---

## 13) Testing & Verification Strategy

Baseline commands:

```bash
npm run type-check
npm run lint
npm run test
```

For backend-side edits:

- run function build/tests in `firebase-backend/functions/` if changed
- validate rules/index assumptions against changed query/write paths

For gameplay or real-time edits:

- run focused client tests for changed modules
- smoke test room join/reconnect/invite flows

For profile/messaging edits:

- test with at least two users where relationship/permissions matter
- verify blocked/hidden/private edge cases

---

## 14) AI-Safe Implementation Playbook

Use this order whenever possible:

1. **Locate source of truth**
   - Types, services, rules, and feature flags before touching UI.
2. **Patch minimal surface area**
   - Avoid broad refactors while shipping feature logic.
3. **Preserve invariants**
   - Messaging idempotency/order, rules safety, feature-flag behavior.
4. **Validate locally**
   - type-check + lint + targeted tests/smoke checks.
5. **Document non-obvious behavior**
   - update `docs/` if architecture/contract changed.

---

## 15) Common Pitfalls (Read Before Editing)

- Updating Firestore writes without corresponding rules updates.
- Adding query filters that require composite indexes but not updating `firestore.indexes.json`.
- Bypassing unified messaging with direct writes and breaking outbox/order assumptions.
- Changing profile field shapes without updating fallback/default hydration.
- Forgetting web/native branch behavior when `USE_LOCAL_STORAGE` is platform-dependent.
- Treating docs as always current; some docs are historical plans and can drift from implementation.

---

## 16) Fast Feature Entry Points

Pick the section by work type:

- New screen flow: `src/navigation/RootNavigator.tsx` + `src/screens/...` + typed nav params.
- Chat/message behavior: `src/hooks/useChat.ts` + `src/services/messaging/*` + functions/rules.
- Profile behavior: `src/services/profileService.ts` + `src/screens/profile/*` + profile types/rules.
- Play tab/game cards: `src/screens/games/GamesHubScreen.tsx` + games components.
- Multiplayer room logic: `colyseus-server/src/rooms/*` + client game hooks/services.
- Economy/shop/task changes: corresponding service + Firebase callable/trigger + rules.

---

## 17) Minimum PR/Change Quality Bar for AI Agents

Before considering a change complete, ensure:

- Type check passes for touched code.
- No obvious lint regressions in touched files.
- Feature flag strategy exists for risky/incomplete behavior.
- Firestore rules/indexes reviewed for any new write/query shape.
- Navigation routes/types remain in sync.
- Relevant docs updated when behavior/contracts changed.

---

## 18) Suggested Read Order for New AI Sessions

1. `docs/00_INDEX.md`
2. `docs/AI_PROJECT_GUIDE.md` (this file)
3. `docs/01_ARCHITECTURE.md`
4. `docs/02_FIREBASE.md`
5. `docs/03_CHAT_V2.md`
6. `docs/06_GAMES.md`
7. `constants/featureFlags.ts`
8. `App.tsx`
9. `src/navigation/RootNavigator.tsx`

Then move into subsystem-specific services and screens.

---

## 19) One-Page Mental Model

- **App shell**: Expo RN app with many feature modules.
- **State core**: context providers + feature hooks.
- **Data plane**: local-first for messaging (native), Firebase as persistent authority.
- **Realtime**: Colyseus for active multiplayer sessions.
- **Safety rails**: feature flags + Firestore rules + typed models.
- **Delivery quality**: small focused changes, invariant-preserving edits, targeted validation.

If you keep those six points true, most feature additions can ship without collateral regressions.
