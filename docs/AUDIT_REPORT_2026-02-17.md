# Audit Report - 2026-02-17

## Baseline Status

| Scope | Command | Result | Notes |
| --- | --- | --- | --- |
| Root | `npm run type-check` | PASS | No TypeScript errors. |
| Root | `npm run lint` | FAIL | 2 errors, 541 warnings. Blocking errors are in `src/components/chat/ChatDebugHUD.tsx` hook ordering. |
| Root | `npm run test -- --ci --watchAll=false --no-cache` | PASS | CI-style run passed. |
| Functions | `npx --no-install tsc --noEmit` | PASS | Read-only equivalent of build check. |
| Colyseus server | `npx --no-install tsc --noEmit` | PASS | Type-check passes. |
| Colyseus server | `npm run lint -- --no-cache` | PASS | Lint passes. |
| Colyseus server | `npm run test -- --ci --watchAll=false --no-cache` | PASS | Tests pass. |
| Client web package | `client/package.json` lookup | N/A | `client/` package root not present. |

## Findings

- Root lint has blocking `react-hooks/rules-of-hooks` errors in `src/components/chat/ChatDebugHUD.tsx`.
- Root lint warning backlog is large (541 warnings across many files).
- `client/` package root expected by docs is not present in this repository snapshot.

## Fixes

- None yet. Segment 1 is documentation-only scaffolding.

## Deleted Code

- None yet.

## Risks

- Lint blocker must be fixed before relying on root lint as a merge gate.
- Warning volume can hide meaningful new warnings unless triaged by category.
- Documentation and repository structure diverge around `client/` package expectations.

## Follow-ups

- Segment 2: confirm ownership and source-of-truth contracts for touched subsystems.
- Segment 3: fix root lint blocking errors first, then reassess warning strategy.
- Segment 4+: implement scoped fixes with report updates per segment.

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

## Changelog by Segment

| Segment | Date | Summary | Files changed | Checks | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | - | - | - | - | Not started |
| 2 | 2026-02-17 | Stabilized root tooling loop by fixing lint blocker, strict test typing drift, and one flaky rate-limit test boundary. | `src/components/chat/ChatDebugHUD.tsx`, `__tests__/services/sendMessageV2.test.ts`, `__tests__/services/resolveChatSettings.test.ts`, `__tests__/services/messageRequests.test.ts`, `__tests__/services/privacyPublish.test.ts`, `__tests__/services/rateLimiter.test.ts`, `docs/AUDIT_REPORT_2026-02-17.md` | Root: type-check/lint/test PASS; Functions build PASS; Colyseus type-check/lint/test PASS | Done |
| 3 | - | - | - | - | Not started |
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
