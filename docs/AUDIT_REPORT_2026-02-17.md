# Audit Report - 2026-02-17

## Baseline Status

| Scope | Command | Result | Notes |
| --- | --- | --- | --- |
| Root | `npm run type-check` | PASS | No TypeScript errors. |
| Root | `npm run lint` | PASS | 0 errors, 541 warnings. |
| Root | `npm run test -- --ci --watchAll=false --no-cache` | PASS | 47/47 suites, 1088 tests passed. |
| Functions | `npx --no-install tsc --noEmit` | PASS | Read-only equivalent of build check. |
| Functions | `npm run build -- --noEmit` | PASS | Build script succeeded in current baseline run. |
| Colyseus server | `npx --no-install tsc --noEmit` | PASS | Type-check passes. |
| Colyseus server | `npm run build -- --noEmit` | PASS | Build script succeeded in current baseline run. |
| Colyseus server | `npm run lint -- --no-cache` | PASS | 0 errors, 161 warnings. |
| Colyseus server | `npm run test -- --ci --watchAll=false --no-cache` | PASS | 12/12 suites, 353 tests passed. |
| Client web package | `client/package.json` lookup | N/A | `client/` package root not present. |

## Findings

- Root validation commands pass, but warning backlog is still high:
  - Root lint: 541 warnings.
  - Colyseus lint: 161 warnings.
- `client/` package root expected by docs is not present in this repository snapshot.

## Fixes

- Segment 1 updates in this run are docs-only audit scaffolding changes.

## Deleted Code

- None yet.

## Risks

- Warning volume can hide meaningful new warnings unless triaged by category.
- Documentation and repository structure diverge around `client/` package expectations.

## Follow-ups

- Segment 2: focus on deterministic tooling behavior and warning triage strategy.
- Segment 3+: continue scoped subsystem passes with invariant checks per segment.

## Segment 1

### What changed

- Updated `docs/00_INDEX.md`:
  - tightened start-here read order
  - added one-paragraph repo mental model
  - linked existing audit docs and planned audit deliverables
- Updated `docs/AUDIT_CHECKLIST.md`:
  - aligned to 18-segment execution plan
  - added per-segment exit criteria + command blocks
- Updated `docs/AUDIT_REPORT_2026-02-17.md`:
  - refreshed baseline status using current Segment 0 run
  - recorded Segment 1 changes

### Why safe

- Segment is doc-only; no runtime or build logic changed.
- Baseline validation rerun to confirm root status unchanged:
  - `npm run type-check` PASS

## Segment 2

### What broke

- Root `npm run lint` failed with 2 blocking `react-hooks/rules-of-hooks` errors in `src/components/chat/ChatDebugHUD.tsx`.
- Root `npm run type-check` and `npm run test` were not reliable due test tooling drift:
  - `__tests__/services/sendMessageV2.test.ts` depended on `firebase-admin`/`firebase-functions` at root where those packages are not installed.
  - Several service tests used literal-scope comparisons and strict object shapes that no longer matched current `InboxSettings` / `PerChatPrivacyOverrides` typing.
  - `__tests__/services/rateLimiter.test.ts` had a bucket boundary assertion that could cross windows and fail nondeterministically.
- `client/package.json` is still not present in this repo snapshot, so no client package checks run.

### What changed

- Fixed hook-order lint blocker in `src/components/chat/ChatDebugHUD.tsx` by moving hooks before the feature-flag early return.
- Removed root-only Firebase module dependency from `__tests__/services/sendMessageV2.test.ts` and kept test-local `HttpsError` behavior.
- Updated service tests to satisfy current strict typing without changing production logic:
  - `__tests__/services/resolveChatSettings.test.ts`
  - `__tests__/services/messageRequests.test.ts`
  - `__tests__/services/privacyPublish.test.ts`
- Made the flaky window assertion deterministic in `__tests__/services/rateLimiter.test.ts` by anchoring to a window boundary.

### Why this is safe

- All edits are tooling/test/hud-surface changes; no backend contracts, rules, or app business logic were modified.
- The hook-order fix preserves `ChatDebugHUD` behavior while making lint deterministic.
- Test changes align with current type contracts and remove external module assumptions from root tests.
- Validation after changes:
  - Root: `npm run type-check` PASS, `npm run lint` PASS (warnings only), `npm run test` PASS
  - Functions: `npm run build` PASS
  - Colyseus server: `npx --no-install tsc --noEmit` PASS, `npm run lint` PASS (warnings only), `npm run test` PASS

### Segment 2 verification rerun (2026-02-18)

- Re-ran Segment 2 command set for deterministic validation without introducing code changes.
- Command outcomes:
  - Root: `npm run type-check` PASS, `npm run lint` PASS (warnings only), `npm run test -- --ci --watchAll=false` PASS.
  - Functions: `npm run build` PASS.
  - Colyseus server: `npm run build` PASS, `npm run lint` PASS (warnings only), `npm run test -- --ci --watchAll=false` PASS.
  - Additional package roots present in repo snapshot:
    - `starforge-viewer`: `npm run typecheck` PASS, `npm run build` PASS.
    - `starforge-viewer/server`: `npm run typecheck` PASS.
- No flaky failures reproduced in this rerun; no quarantine changes required.
- `client/package.json` still not present, so client package checks remain N/A.

## Segment 3

### What was done

- Created `docs/REPO_MAP.md` with:
  - major folder responsibilities
  - entry points per subsystem
  - critical execution paths (app boot, messaging, profile, multiplayer)
- Created `docs/DEPRECATION_MAP.md` with:
  - module-level deprecation candidates
  - suspected replacements
  - caller evidence and removal risk
- Ran targeted searches for:
  - `deprecated`, `legacy`, `TODO remove`, `dead code`, `remove after`, `temp`, `hack`
  - overlap zones: invites, lobby, messaging writes/subscriptions, profile updates

### Key findings

- Active + deprecated messaging layers coexist:
  - active facade: `src/services/messaging/send.ts`, `src/services/messaging/subscribe.ts`
  - deprecated underlying layers still in call path: `src/services/chatV2.ts`, `src/services/messageList.ts`, `src/services/outbox.ts`, `src/hooks/useUnifiedMessages.ts`
- Invite migration is incomplete by design:
  - universal invite APIs are active (`sendUniversalInvite`, `claimInviteSlot`, `startGameEarly`)
  - legacy invite APIs remain exported in `src/services/gameInvites.ts`
- Lobby architecture has a canonical path plus an apparently stranded wrapper:
  - canonical: `useGameLobbyController` + `MultiplayerLobbyOverlay`
  - no active caller found: `src/components/games/withGameLobby.tsx`
- Profile update ownership is split:
  - domain-specific updates in `src/services/profileService.ts`
  - generic patch path in `src/services/users.ts::updateProfile`
- Backend extraction is partial:
  - `firebase-backend/functions/src/legacy.ts` is still imported by multiple module wrappers and `functions/src/index.ts`

### Top 20 cleanup candidates (ranked by confidence)

1. `src/hooks/useSnapCapture.ts` - **High** - flagged `@deprecated DEAD CODE`; no runtime import callers found.
2. `src/components/games/withGameLobby.tsx` - **High** - no active caller found; canonical lobby path already in place.
3. `src/services/gameInvites.ts::getPendingInvites` - **High** - deprecated and no app caller found.
4. `src/services/gameInvites.ts::subscribeToPendingInvites` - **High** - deprecated and no app caller found.
5. `src/services/gameInvites.ts::sendGameInvite` - **High** - deprecated; no call site found outside defining file.
6. `src/services/gameInvites.ts::cancelGameInvite` - **High** - deprecated; no call site found outside defining file.
7. `src/services/groups.ts::subscribeToGroupMessages` - **High** - deprecated legacy API; no call site found outside defining file.
8. `src/services/messaging/subscribe.ts` facade - **Medium-High** - thin deprecated adapter over `messageList`.
9. `src/services/messageList.ts` - **Medium-High** - deprecated but still required by `messaging/subscribe`.
10. `src/hooks/useUnifiedMessages.ts` - **Medium-High** - deprecated but still required by `useChat`.
11. `src/services/chatV2.ts` - **Medium** - deprecated core send layer, but still heavily referenced.
12. `src/services/outbox.ts` - **Medium** - deprecated storage layer, but still foundational and active.
13. `src/components/profile/LegacyProfileHeader.tsx` - **Medium** - still used by legacy profile screen.
14. `src/components/profile/LegacyProfileActions.tsx` - **Medium** - still used by legacy profile screen.
15. `src/services/users.ts::updateProfile` call sites in profile/settings/cosmetics - **Medium** - duplicates profile mutation ownership.
16. `src/services/profileService.ts` vs `src/services/users.ts` split update surface - **Medium** - duplication risk, not delete-ready.
17. `firebase-backend/functions/src/legacy.ts` extraction remainder - **Low** (confidence), **Very High** (impact) - many wrappers still depend on it.
18. `firebase-backend/functions/src/*` wrappers importing `./legacy` - **Medium** - consolidation target once exports stabilize.
19. Legacy compatibility fields in `src/types/messaging.ts` - **Low-Medium** - removable only after backend/client contract cleanup.
20. Cross-domain invite fragmentation (game/group/call invite docs + services) - **Low-Medium** - architectural cleanup candidate after ownership decisions.

### Safety and validation

- Segment 3 changes are doc-only (`docs/REPO_MAP.md`, `docs/DEPRECATION_MAP.md`, this report section).
- Root checks rerun status:
  - `npm run type-check`: PASS
  - `npm run lint`: PASS (warnings only)
  - `npm run test`: PASS

### Segment 3 verification rerun (2026-02-18)

- Revalidated Segment 3 inventory docs in place:
  - `docs/REPO_MAP.md`
  - `docs/DEPRECATION_MAP.md`
- Re-ran root checks to confirm no behavioral regressions:
  - `npm run type-check` PASS
  - `npm run lint` PASS (warnings only)
- `npm run test -- --ci --watchAll=false --no-cache` PASS
- No additional code changes required for Segment 3 exit criteria.

## Segment 4

### What changed

- Added `docs/CONFIGURATION.md` with:
  - canonical config surfaces (feature flags, Expo config, Firebase bootstrap, env vars)
  - risk-sensitive defaults and platform differences
  - safe process for adding new config
- Updated `docs/00_INDEX.md` to link `docs/CONFIGURATION.md` in core docs.
- Updated `docs/AUDIT_CHECKLIST.md` to mark Segments 2-4 complete.

### Feature-flag audit findings

- Audited all top-level exports in `constants/featureFlags.ts` and verified each has active caller coverage in app/test/doc surfaces.
- Sub-flag scan found several no-direct-caller keys concentrated in roadmap groups (`CALL_FEATURES`, some `PROFILE_V2_FEATURES`, `THREE_JS_FEATURES`, `COLYSEUS_FEATURES`).
- No sub-flag deletions were made in Segment 4 because these are staged rollout placeholders and removing them now would reduce forward rollout controls with no runtime reliability gain.

### Why this is safe

- Segment 4 changes are docs-only.
- No runtime defaults were flipped.
- Conservative defaults remain in place for risky systems:
  - `USE_VISION_CAMERA = false`
  - `CALL_FEATURES.CALLS_ENABLED = false`
  - `COLYSEUS_FEATURES.USE_PRODUCTION_SERVER = false`
  - `USE_LOCAL_STORAGE = !IS_WEB`

### Validation

- `npm run type-check` PASS
- `npm run lint` PASS (warnings only)
- `npm run test -- --ci --watchAll=false --no-cache` PASS

## Segment 5

### What changed

- Established and documented canonical client contract locations in `docs/DATA_CONTRACT_CLIENT.md`.
- Consolidated duplicate invite status typing in `src/services/gameInvites.ts` by aliasing `InviteStatus` to `GameInviteStatus` from `src/types/turnBased.ts`.
- Added runtime boundary guards:
  - Messaging request decode/validation in `src/types/messaging.ts`
  - Message request hook validation in `src/hooks/useMessageRequests.ts`
  - Colyseus join options guard/assertion in `src/types/gameSession.ts` and `src/services/colyseusJoin.ts`
- Updated `docs/AUDIT_CHECKLIST.md` to mark Segment 5 complete.

### Why this is safe

- Changes are type-contract and validation-layer focused; no feature rollout flags were flipped.
- Runtime guards fail fast on malformed boundary payloads and preserve existing success paths.
- Contract consolidation removes duplicate literal unions without changing persisted data shape.

### Validation

- `npm run type-check` PASS
- `npm run lint` PASS (warnings only)
- `npm run test -- --ci --watchAll=false --no-cache` PASS

## Segment 6

### What changed

- Added `docs/FIRESTORE_CONTRACT.md` with:
  - canonical collection contract map
  - client write-path inventory references
  - rules alignment notes
  - index coverage and validation checklist
- Fixed an invalid Firestore query shape in `src/services/story/snapStoryService.ts`:
  - `getStoriesFromFriend()` now orders by `expiresAt` before `createdAt` to satisfy inequality-query requirements.
- Added minimal composite indexes in `firebase-backend/firestore.indexes.json` for story query shapes:
  - `Pictures`: `(senderId, storyVisible, expiresAt, createdAt asc)`
  - `Pictures`: `(senderId, storyVisible, expiresAt, createdAt desc)`
  - `Stories`: `(isSnapStory, expiresAt)`
- Removed a client-side write that violated rules in `src/services/iap.ts`:
  - eliminated mock-flow `updateDoc()` on `IAPPurchases` (updates are disallowed by rules).
- Updated `docs/00_INDEX.md` to link `docs/FIRESTORE_CONTRACT.md`.
- Updated `docs/AUDIT_CHECKLIST.md` to mark Segment 6 complete.

### Why this is safe

- Changes are contract-alignment and query/index correctness fixes; no feature flags or auth models were loosened.
- Removed a write path instead of weakening rules for `IAPPurchases`, preserving least-privilege behavior.
- Added indexes only for observed query shapes; no data mutation semantics changed.

### Validation

- `npm run type-check` PASS
- `npm run lint` PASS (warnings only)
- `npm run test -- --ci --watchAll=false --no-cache` PASS
- `cd firebase-backend/functions && npx --no-install tsc --noEmit` PASS

## Segment 7

### What changed

- Added `docs/FUNCTIONS.md` as the canonical functions contract inventory:
  - deployed function surface from `firebase-backend/functions/src/index.ts`
  - callable/trigger/scheduled/http-request grouping
  - auth/access expectations and primary data paths
  - non-deployed function candidate list with caller proof
- Hardened error logging in functions runtime paths:
  - `firebase-backend/functions/src/inboxTriggers.ts`
  - `firebase-backend/functions/src/rateLimiter.ts`
  - replaced raw `console.error(...)` with `functions.logger.error(...)` and sanitized error payloads
- Prevented accidental deployment drift by converting non-exported candidates to local consts:
  - `firebase-backend/functions/src/calls.ts`
    - `registerVoIPToken`, `sendCallNotification`, `cancelCall`
    - `onGroupCallInviteCreated`, `onGroupCallParticipantJoined`, `onGroupCallHostAction`
  - `firebase-backend/functions/src/games.ts`
    - `cleanupStaleActiveInvites`
- Updated `docs/00_INDEX.md` to move `docs/FUNCTIONS.md` from planned list to active core docs.

### Why this is safe

- Deployment surface is still controlled by `functions/src/index.ts`; no function exports were added/removed there.
- Non-deployed candidates were already not exported from `index.ts`; changing them from `export const` to `const` reduces accidental re-export risk without runtime behavior change.
- Logging changes improve operational safety (PII/error object leakage reduction) without changing control flow.
- No Firestore schema/rules/index contract changes were introduced in Segment 7.

### Validation

- `cd firebase-backend/functions && npm run build` PASS
- `npm run type-check` PASS
- `npm run lint` PASS (warnings only)
- `npm run test -- --ci --watchAll=false --no-cache` PASS

## Segment 8

### What changed

- Added `docs/CHAT_SYSTEM.md` as the canonical unified chat contract doc:
  - DM + group send flow
  - local-first and Firestore fallback paths
  - outbox states/retry behavior
  - invariant definitions (idempotency, ordering, watermark strategy)
  - failure modes and recovery paths
- Routed active UI-level legacy chat service usage to unified messaging APIs:
  - `src/screens/chat/ChatScreen.tsx`
    - retry path now uses `retryMessage(...)` from `@/services/messaging`
  - `src/hooks/useOutboxProcessor.ts`
    - background processing now uses `processPendingMessages(...)` from `@/services/messaging`
  - `src/hooks/useSnapCapture.ts` (deprecated dead hook)
    - send path now references unified `sendMessage(...)`
- Reduced additional legacy coupling in unified hook composition:
  - `src/hooks/useUnifiedMessages.ts`
    - outbox lookup now uses `getPendingForConversation(...)` from unified messaging send service
- Added explicit messaging invariant coverage:
  - `__tests__/services/messagingOutboxInvariants.test.ts`
    - duplicate enqueue prevention (idempotency guard)
    - server-authoritative merge ordering + optimistic dedupe
    - outbox success transition (`queued -> sending -> removed`)
    - non-retryable failure transition (`failed` + long retry horizon)
- Updated docs index:
  - `docs/00_INDEX.md` now links `docs/CHAT_SYSTEM.md` in active core docs.

### Why this is safe

- Changes are scoped to messaging API wiring, docs, and tests; no feature flag defaults changed.
- UI paths now consistently call the unified messaging surface, reducing direct dependencies on deprecated modules without changing backend contracts.
- Added tests target hard invariants called out in the architecture guide and verify behavior already implemented in `outbox.ts`/`chatV2.ts`.
- Validation confirms no regressions in compile/lint/test gates.

### Validation

- `npm run type-check` PASS
- `npm run lint` PASS (warnings only)
- `npm run test -- --ci --watchAll=false --no-cache` PASS

## Segment 9

### What changed

- Added canonical profile contract helpers in `src/services/profile/profileContract.ts`:
  - `hydrateProfileData(...)` for deterministic fallback hydration
  - `validateDisplayName(...)`
  - `validateAvatarConfig(...)`
  - `validateBioText(...)`
  - `validateStatusInput(...)`
  - `validateFullPrivacySettings(...)`
- Updated `src/services/profileService.ts` to use those helpers:
  - `getFullProfileData()` and `subscribeToProfile()` now share the same hydration path
  - `updateBio()` and `setStatus()` now use explicit validator helpers
  - `updateFullPrivacySettings()` now validates full privacy shape before write
  - added canonical write methods `updateDisplayName()` and `updateAvatarConfig()`
- Routed remaining profile writes off generic user patch path:
  - `src/screens/profile/ProfileScreen.tsx` now uses `updateDisplayName()`
  - `src/screens/settings/SettingsScreen.tsx` now uses `updateDisplayName()`
  - `src/services/cosmetics.ts` now persists avatar config via profile service
- Added profile contract tests:
  - `__tests__/services/profileContract.test.ts`
  - covers hydration defaults and validation alignment
- Added profile subsystem doc:
  - `docs/PROFILE_SYSTEM.md`
- Updated index/checklist:
  - `docs/00_INDEX.md`
  - `docs/AUDIT_CHECKLIST.md`

### Why this is safe

- Changes are scoped to profile write-path ownership, validation, and docs; no feature flags or backend rules were loosened.
- Client validation is equal-or-stricter than rules for touched fields (display name, bio, status, privacy).
- Hydration behavior is now centralized, reducing drift risk between one-shot fetch and realtime subscription paths.

### Validation

- `npm run type-check` PASS
- `npm run lint` PASS (warnings only)
- `npm run test -- --ci --watchAll=false --no-cache` PASS

## Segment 10

### What changed

- Standardized lobby-state decision logic into isolated selectors:
  - `src/hooks/gameLobbySelectors.ts`
    - `getConnectionBannerForState(...)`
    - `shouldShowLobbyOverlayForState(...)`
  - `src/hooks/useGameLobbyController.ts` now consumes those selectors.
- Added targeted games reliability tests:
  - `__tests__/hooks/useGameLobbyControllerSelectors.test.ts`
    - lobby phase and overlay visibility transitions
    - connection banner state precedence
  - `__tests__/services/gameRecoveryActions.test.ts`
    - retry/rejoin/reset/cancel/report-bug action handling
    - side-effect and callback dispatch expectations
- Added canonical lifecycle doc:
  - `docs/GAMES_PLATFORM.md`
    - invite -> lobby -> join -> recovery lifecycle
    - controller coverage list
    - explicit, documented exceptions for bespoke flows
- Updated docs index to include games platform contract:
  - `docs/00_INDEX.md`

### Multiplayer lifecycle findings and explicit exceptions

- Unified controller + lobby overlay path is active for core RN multiplayer screens (`Chess`, `Checkers`, `TicTacToe`, `ConnectFour`, `DotMatch`, `Gomoku`, `Reversi`, `CrazyEights`, `SketchParty`).
- Two non-controller multiplayer screens remain by design and are explicitly documented:
  - `src/screens/games/MiniGolfDuelsGameScreen.tsx` (host-room-key + invite queue handshake path)
  - `src/screens/games/StarforgeGameScreen.tsx` (embedded WebView probe/load/bridge lifecycle)
- Joiner navigation consistency is enforced in:
  - `src/components/chat/ChatGameInvites.tsx`
  - `src/screens/games/GamesHubScreen.tsx`
- Participant auto-navigation on invite activation is enforced in:
  - `src/components/games/UniversalInviteCard.tsx`

### Why this is safe

- Changes are scoped to lobby selector extraction, tests, and docs; no gameplay reducer or room protocol logic was refactored.
- `useGameLobbyController` behavior is preserved while moving decision logic into testable pure functions.
- Recovery action tests verify existing dispatch behavior without changing action semantics.
- Exceptions to the unified controller path are no longer implicit; they are now documented with rationale.

### Validation

- `npm run type-check` PASS
- `npm run lint` PASS (warnings only)
- `npm run test -- --ci --watchAll=false --no-cache` PASS

## Segment 11

### What changed

- Hardened protocol rejection + trace propagation in Colyseus room flows:
  - Base room families: `TurnBasedRoom`, `ScoreRaceRoom`, `PhysicsRoom`, `CardGameRoom`
  - Standalone families: `WordMasterRoom`, `CrosswordRoom`, `SketchPartyRoom`, `MiniGolfDuelsRoom`, `BrickBreakerRoom`, `BounceBlitzRoom`, `SpectatorRoom`
- Added room-scoped logging contexts in standalone rooms so lifecycle logs carry `roomId`, `gameType`, and `traceId`.
- Added `traceId` to server state schemas where missing:
  - `colyseus-server/src/schemas/common.ts`
  - `colyseus-server/src/schemas/physics.ts`
  - `colyseus-server/src/schemas/draw.ts`
  - `colyseus-server/src/schemas/minigolf.ts`
  - `colyseus-server/src/schemas/spectator.ts`
- Aligned spectator client join options with server protocol gate:
  - `src/services/colyseus.ts`
  - `src/hooks/useSpectator.ts`
  - now always provides `protocolVersion`, `buildInfo`, and `traceId` on spectator joins.
- Mapped protocol mismatch join failures to canonical game taxonomy:
  - `src/services/colyseus.ts::mapJoinError(...)` now returns `GameErrorCode.PROTOCOL_VERSION_MISMATCH`.
- Added canonical server subsystem doc:
  - `docs/COLYSEUS_SERVER.md`
- Updated docs/checklist:
  - `docs/00_INDEX.md`
  - `docs/AUDIT_CHECKLIST.md`

### Why this is safe

- Protocol checks were tightened by adding trace context and consistent spectator join metadata, not by loosening auth or room validation.
- Schema changes are additive (`traceId` fields) and do not alter existing gameplay fields.
- Logging updates are non-functional behavior changes that improve observability for stuck/protocol issues.
- Client-side mapping change only normalizes error classification into existing `GameErrorCode` flow.

### Validation

- `cd colyseus-server && npm run build` PASS
- `cd colyseus-server && npm run lint -- --no-cache` PASS (warnings only; 0 errors)
- `cd colyseus-server && npm run test -- --ci --watchAll=false --no-cache` PASS (12/12 suites, 353 tests)
- `npm run type-check` PASS (root, to verify spectator-client edits)

## Segment 12

### What changed

- Hardened RN WebView launch and route-param translation in:
  - `src/screens/games/StarforgeGameScreen.tsx`
  - `src/config/starforgeGame.ts`
- Added explicit embedded-web param propagation for invite/session tracing:
  - URL builder now supports `inviteId` and `traceId`.
  - Starforge launch now passes `matchId|roomId`, `inviteId`, and `traceId`.
- Fixed web client join-option translation so invite/session context is not dropped:
  - `starforge-viewer/src/game/gameMain.ts`
  - `starforge-viewer/src/game/net/messageTypes.ts`
  - `starforge-viewer/src/game/net/roomAdapter.ts`
  - `firestoreGameId`, `inviteId`, `traceId` now flow from URL -> Colyseus join options -> session bridge payload.
- Hardened failure and exit UX in embedded screen:
  - offline detection during host probe (`expo-network`)
  - clearer unreachable/offline error messaging with retry path
  - safe back fallback when no navigation stack (`MainTabs -> Play -> GamesHub`)
  - dev-only session info banner for bridge/param verification
- Added canonical embedded contract doc:
  - `docs/EMBEDDED_WEB_GAMES.md`
- Updated docs/checklist:
  - `docs/00_INDEX.md`
  - `docs/AUDIT_CHECKLIST.md`

### Why this is safe

- Changes are integration-surface only (URL/query/bridge handling, failure UX, docs).
- No game simulation logic or Firestore contract behavior was changed.
- Param additions are backward-compatible (optional query fields).
- WebView host probe and exit fallback reduce user-facing dead-ends without changing multiplayer invariants.

### Validation

- `npm run type-check` PASS
- `npm run lint` PASS (warnings only)
- `npm run test -- --ci --watchAll=false --no-cache` PASS
- `cd starforge-viewer && npm run typecheck` PASS
- `cd starforge-viewer && npm run build` PASS

## Segment 13

### What changed

- Added canonical calls/camera subsystem doc:
  - `docs/CALLS_CAMERA.md`
  - includes provider/service inventory, gating matrix, staged-rollout constraints, and safe enablement checklist
- Tightened service-layer call gating to honor feature flags (not just platform checks):
  - `src/contexts/CallContext.tsx`
  - `src/services/calls/index.ts`
  - call runtime/bootstrap now short-circuits when `CALL_FEATURES.CALLS_ENABLED` is `false`
- Closed a UI entrypoint gap for profile calls:
  - `src/screens/profile/UserProfileScreen.tsx`
  - `src/components/profile/ProfileActions/ProfileActionsBar.tsx`
  - call action only shown/wired when calls are feature-enabled and native runtime is available
- Performed one proven-safe cleanup:
  - `src/components/calls/index.ts` removed unused exported `areNativeCallsAvailable`
  - no callers found via repo-wide search
- Updated docs/checklist:
  - `docs/00_INDEX.md`
  - `docs/AUDIT_CHECKLIST.md`

### Why this is safe

- No call defaults were flipped; `CALL_FEATURES.CALLS_ENABLED` remains `false`.
- Changes reduce accidental side effects by preventing disabled-call bootstrap/runtime initialization.
- Profile call CTA now aligns with actual route/runtime availability, preventing invalid navigation paths when calls are disabled.
- Cleanup was constrained to a no-caller export removal only.

### Validation

- `npm run type-check` PASS
- `npm run lint` PASS (warnings only)
- `npm run test -- --ci --watchAll=false --no-cache` PASS

## Segment 14

### What changed

- Added performance guidance doc:
  - `docs/PERFORMANCE.md`
  - includes startup hotspots, render hotpaths, sync behavior, profiling tips, and anti-patterns
- Deferred optional call bootstrap side effects from module-eval to post-render:
  - `App.tsx`
  - call bootstrap now runs in `useEffect` after first render and only when `CALL_FEATURES.CALLS_ENABLED` is true
- Reduced outbox resume churn:
  - `src/hooks/useOutboxProcessor.ts`
  - app-state handler now processes only on real `background|inactive -> active` transitions
- Updated docs/checklist:
  - `docs/00_INDEX.md`
  - `docs/AUDIT_CHECKLIST.md`

### Why this is safe

- No behavioral rewrites to messaging, game, or profile contracts.
- Startup change only defers optional call bootstrap work and keeps existing service APIs intact.
- Outbox change preserves existing throttle/locking logic while avoiding redundant active-state triggers.

### Validation

- `npm run type-check` PASS
- `npm run lint` PASS (warnings only)
- `npm run test -- --ci --watchAll=false --no-cache` PASS

## Changelog by Segment

| Segment | Date | Summary | Files changed | Checks | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-02-18 | Added/normalized audit framework docs and refreshed baseline to current Segment 0 command results. | `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check PASS (unchanged) | Done |
| 2 | 2026-02-17 | Stabilized root tooling loop by fixing lint blocker, strict test typing drift, and one flaky rate-limit test boundary. | `src/components/chat/ChatDebugHUD.tsx`, `__tests__/services/sendMessageV2.test.ts`, `__tests__/services/resolveChatSettings.test.ts`, `__tests__/services/messageRequests.test.ts`, `__tests__/services/privacyPublish.test.ts`, `__tests__/services/rateLimiter.test.ts`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check/lint/test PASS; Functions build PASS; Colyseus type-check/lint/test PASS | Done |
| 3 | 2026-02-18 | Added repo inventory and deprecation mapping docs with evidence-backed caller/risk analysis and ranked cleanup candidates. | `docs/REPO_MAP.md`, `docs/DEPRECATION_MAP.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check/lint/test PASS (unchanged behavior) | Done |
| 4 | 2026-02-18 | Audited feature flags/config surfaces, added configuration guide, and confirmed conservative defaults without risky flips. | `docs/CONFIGURATION.md`, `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check/lint/test PASS | Done |
| 5 | 2026-02-18 | Consolidated client contract typing and added runtime guards at Firestore/callable/game-join boundaries; documented canonical type sources. | `src/services/gameInvites.ts`, `src/types/messaging.ts`, `src/hooks/useMessageRequests.ts`, `src/types/gameSession.ts`, `src/services/colyseusJoin.ts`, `docs/DATA_CONTRACT_CLIENT.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check/lint/test PASS | Done |
| 6 | 2026-02-18 | Audited write/query contract against rules and indexes, fixed one invalid story query shape, removed one rules-violating client write, and documented the Firestore contract. | `docs/FIRESTORE_CONTRACT.md`, `src/services/story/snapStoryService.ts`, `src/services/iap.ts`, `firebase-backend/firestore.indexes.json`, `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check/lint/test PASS; Functions tsc PASS | Done |
| 7 | 2026-02-18 | Audited deployed Cloud Functions contracts, hardened sanitized logging paths, and reduced accidental-deployment risk for non-exported function candidates. | `docs/FUNCTIONS.md`, `firebase-backend/functions/src/inboxTriggers.ts`, `firebase-backend/functions/src/rateLimiter.ts`, `firebase-backend/functions/src/calls.ts`, `firebase-backend/functions/src/games.ts`, `docs/00_INDEX.md`, `docs/AUDIT_REPORT_2026-02-17.md`, `docs/AUDIT_CHECKLIST.md` | Functions build PASS; Root type-check/lint/test PASS | Done |
| 8 | 2026-02-18 | Unified active chat UI service usage under `services/messaging`, added invariant-focused outbox/ordering/idempotency tests, and documented chat contracts. | `src/screens/chat/ChatScreen.tsx`, `src/hooks/useOutboxProcessor.ts`, `src/hooks/useSnapCapture.ts`, `src/hooks/useUnifiedMessages.ts`, `__tests__/services/messagingOutboxInvariants.test.ts`, `docs/CHAT_SYSTEM.md`, `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check/lint/test PASS | Done |
| 9 | 2026-02-18 | Consolidated profile write ownership under `profileService`, centralized hydration/validators, added profile contract tests, and documented profile system behavior/contracts. | `src/services/profile/profileContract.ts`, `src/services/profileService.ts`, `src/screens/profile/ProfileScreen.tsx`, `src/screens/settings/SettingsScreen.tsx`, `src/services/cosmetics.ts`, `__tests__/services/profileContract.test.ts`, `docs/PROFILE_SYSTEM.md`, `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check/lint/test PASS | Done |
| 10 | 2026-02-18 | Extracted and tested lobby-state selectors, added recovery-action tests, and documented canonical games lifecycle with explicit exceptions for bespoke multiplayer screens. | `src/hooks/gameLobbySelectors.ts`, `src/hooks/useGameLobbyController.ts`, `__tests__/hooks/useGameLobbyControllerSelectors.test.ts`, `__tests__/services/gameRecoveryActions.test.ts`, `docs/GAMES_PLATFORM.md`, `docs/00_INDEX.md`, `docs/AUDIT_REPORT_2026-02-17.md`, `docs/AUDIT_CHECKLIST.md` | Root: type-check/lint/test PASS | Done |
| 11 | 2026-02-18 | Hardened Colyseus protocol gate + trace propagation across room families, aligned spectator join metadata, mapped protocol mismatch errors, and documented room contracts/reconnection/load-shedding behavior. | `colyseus-server/src/rooms/base/TurnBasedRoom.ts`, `colyseus-server/src/rooms/base/ScoreRaceRoom.ts`, `colyseus-server/src/rooms/base/PhysicsRoom.ts`, `colyseus-server/src/rooms/base/CardGameRoom.ts`, `colyseus-server/src/rooms/coop/WordMasterRoom.ts`, `colyseus-server/src/rooms/coop/CrosswordRoom.ts`, `colyseus-server/src/rooms/party/SketchPartyRoom.ts`, `colyseus-server/src/rooms/physics/MiniGolfDuelsRoom.ts`, `colyseus-server/src/rooms/physics/BrickBreakerRoom.ts`, `colyseus-server/src/rooms/physics/BounceBlitzRoom.ts`, `colyseus-server/src/rooms/spectator/SpectatorRoom.ts`, `colyseus-server/src/rooms/incremental/IncrementalRoom.ts`, `colyseus-server/src/rooms/incremental/StarforgeRoom.ts`, `colyseus-server/src/schemas/common.ts`, `colyseus-server/src/schemas/physics.ts`, `colyseus-server/src/schemas/draw.ts`, `colyseus-server/src/schemas/minigolf.ts`, `colyseus-server/src/schemas/spectator.ts`, `src/services/colyseus.ts`, `src/hooks/useSpectator.ts`, `docs/COLYSEUS_SERVER.md`, `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Colyseus build/lint/test PASS; Root type-check PASS | Done |
| 12 | 2026-02-18 | Audited embedded web game integration, fixed URL/join param translation (`firestoreGameId`, `inviteId`, `traceId`), hardened WebView offline/error/back handling, and documented the end-to-end embedded contract. | `src/config/starforgeGame.ts`, `src/screens/games/StarforgeGameScreen.tsx`, `starforge-viewer/src/game/gameMain.ts`, `starforge-viewer/src/game/net/messageTypes.ts`, `starforge-viewer/src/game/net/roomAdapter.ts`, `docs/EMBEDDED_WEB_GAMES.md`, `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root type-check/lint/test PASS; starforge-viewer typecheck/build PASS | Done |
| 13 | 2026-02-18 | Audited calls/camera subsystem gating, added contract doc, enforced feature-aware call runtime/bootstrap no-op behavior, and gated profile call entrypoint by feature/platform availability. | `docs/CALLS_CAMERA.md`, `src/contexts/CallContext.tsx`, `src/services/calls/index.ts`, `src/screens/profile/UserProfileScreen.tsx`, `src/components/profile/ProfileActions/ProfileActionsBar.tsx`, `src/components/calls/index.ts`, `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root type-check/lint/test PASS | Done |
| 14 | 2026-02-18 | Added performance guidance, deferred optional call bootstrap until post-render, and tightened outbox resume processing to real foreground transitions only. | `docs/PERFORMANCE.md`, `App.tsx`, `src/hooks/useOutboxProcessor.ts`, `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root type-check/lint/test PASS | Done |
| 15 | - | - | - | - | Not started |
| 16 | - | - | - | - | Not started |
| 17 | - | - | - | - | Not started |
| 18 | - | - | - | - | Not started |
