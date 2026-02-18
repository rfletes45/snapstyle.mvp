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

## Changelog by Segment

| Segment | Date | Summary | Files changed | Checks | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-02-18 | Added/normalized audit framework docs and refreshed baseline to current Segment 0 command results. | `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check PASS (unchanged) | Done |
| 2 | 2026-02-17 | Stabilized root tooling loop by fixing lint blocker, strict test typing drift, and one flaky rate-limit test boundary. | `src/components/chat/ChatDebugHUD.tsx`, `__tests__/services/sendMessageV2.test.ts`, `__tests__/services/resolveChatSettings.test.ts`, `__tests__/services/messageRequests.test.ts`, `__tests__/services/privacyPublish.test.ts`, `__tests__/services/rateLimiter.test.ts`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check/lint/test PASS; Functions build PASS; Colyseus type-check/lint/test PASS | Done |
| 3 | 2026-02-18 | Added repo inventory and deprecation mapping docs with evidence-backed caller/risk analysis and ranked cleanup candidates. | `docs/REPO_MAP.md`, `docs/DEPRECATION_MAP.md`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check/lint/test PASS (unchanged behavior) | Done |
| 4 | - | - | - | - | Not started |
| 5 | - | - | - | - | Not started |
| 6 | - | - | - | - | Not started |
| 7 | - | - | - | - | Not started |
| 8 | - | - | - | - | Not started |
| 9 | - | - | - | - | Not started |
| 10 | - | - | - | - | Not started |
| 11 | - | - | - | - | Not started |
| 12 | - | - | - | - | Not started |
| 13 | - | - | - | - | Not started |
| 14 | - | - | - | - | Not started |
| 15 | - | - | - | - | Not started |
| 16 | - | - | - | - | Not started |
| 17 | - | - | - | - | Not started |
| 18 | - | - | - | - | Not started |
