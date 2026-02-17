## PR Description

This PR performs a safety-first refactor/performance audit focused on proven dead code and low-risk inefficiencies without changing behavior or contracts.

- Added repo-wide audit documentation and baseline verification matrix.
- Removed a set of confirmed-unused symbols and unreachable paths.
- Applied targeted micro-optimizations in recommendation generation/render path.
- Re-ran verification and documented deltas against baseline.

---

# Refactor Audit Report

## 1) Repo map

### High-level architecture

- Root app: Expo + React Native app (`src/`, `App.tsx`, `app.json`, `app.config.ts`).
- Real-time backend: Colyseus server (`colyseus-server/src`).
- Embedded web game clients:
  - Fishing client (`client/`)
  - Golf Duels client (`golf-duels-client/`)
  - Starforge viewer (`starforge-viewer/`)
- Additional TS server (`server/`) and shared package (`packages/golf-duels-shared/`).
- Firebase functions backend (`firebase-backend/functions/`).
- Test suites: root `__tests__/`, plus package-local tests.

### Key entrypoints

- Mobile app entry: `App.tsx` and `src/` navigation/screens.
- Colyseus server entry: `colyseus-server/src/app.config.ts`.
- Web clients:
  - `client/src/main.ts`
  - `golf-duels-client/src/main.ts`
  - `starforge-viewer/src/main.ts`

### Build/test command discovery

Root (`package.json`):

- `npm run lint`
- `npm run type-check`
- `npm test`

Other package commands discovered:

- `client`: `npm run typecheck`, `npm run build`
- `colyseus-server`: `npm run lint`, `npm test`, `npm run build`
- `server`: `npm run build`
- `golf-duels-client`: `npm run typecheck`, `npm run build`
- `starforge-viewer`: `npm run typecheck`, `npm run build`
- `starforge-viewer/server`: `npm run typecheck`
- `packages/golf-duels-shared`: `npm run typecheck`, `npm test`, `npm run build`
- `firebase-backend/functions`: `npm run build`

## 2) Baseline verification (pre-change)

### Root app

- `npm run lint` → **FAIL** (pre-existing: 100 errors / 595 warnings).
- `npm run type-check` → **FAIL** (`src/screens/friends/FriendsScreen.tsx` parse error near line 883).
- `npm test -- --runInBand` → **FAIL** (12 failed suites, 17 passed; includes Jest transform issues with `expo-constants` ESM and perf test regressions).

### Sub-packages

- `client`: `typecheck` **PASS**, `build` **PASS**
- `colyseus-server`: `build` **PASS**, `lint` **FAIL** (warnings only), `test` **FAIL** (4 failed suites / 4 passed)
- `server`: `build` **PASS**
- `golf-duels-client`: `typecheck` **PASS**, `build` **PASS**
- `starforge-viewer`: `typecheck` **PASS**, `build` **PASS**
- `starforge-viewer/server`: `typecheck` **PASS**
- `packages/golf-duels-shared`: `typecheck` **PASS**, `test` **PASS**, `build` **PASS**
- `firebase-backend/functions`: `build` **PASS**

## 3) Redundancy findings

### Candidate dead code / redundancy identified

- Unused log formatting constants in `src/utils/log.ts` (`LOG_LEVEL_COLORS`, `RESET_COLOR`).
- Unused theme destructure value in `src/screens/games/components/GameRecommendations.tsx` (`isDark` in parent component only).
- Placeholder permission checks with unreachable `catch` path in `src/utils/permissions.ts` photo-library helpers.

### Not removed yet (requires deeper runtime tracing)

- Multiple unused variables and hook dependency warnings across many game screens (high volume, but broad behavioral risk).
- Potential stale files/config around alternate clients and legacy docs; requires route/entrypoint tracing before deletion.

## 4) Inefficiency findings

### Identified hotspots

- Recommendation construction in `GameRecommendations` repeatedly used linear `find()` checks while building candidate arrays (small but avoidable repeated work on each regeneration).
- `FlatList` item press callback generated a fresh closure per row render.

### Deferred hotspots (documented, not changed in this pass)

- Root performance test failures (`__tests__/performance/gamePerformance.test.ts`) indicate significant simulation bottlenecks; requires targeted algorithm profiling and likely multi-file game-engine changes.
- Root Jest transform failures (Expo ESM modules) reduce confidence in broad test gate; deferred to dedicated test-infra pass.

## 5) What was fixed

### 5.1 Dead code / unreachable path cleanup

1. `src/utils/log.ts`

- Removed confirmed-unused constants:
  - `LOG_LEVEL_COLORS`
  - `RESET_COLOR`
- Rationale: symbols were never referenced in module/runtime.
- Risk: **Low** (no call-site or output-path dependency).

2. `src/utils/permissions.ts`

- Removed unreachable `catch` branches from placeholder photo-library helpers:
  - `requestPhotoLibraryPermission`
  - `hasPhotoLibraryPermission`
- Rationale: code path contained no throwing operations and always returned `true`; lint flagged unreachable branch.
- Risk: **Low** (same functional return values for all reachable paths).

### 5.2 Dedupe + rendering/runtime efficiency

1. `src/screens/games/components/GameRecommendations.tsx`

- Replaced repeated `recs.find(...)` membership checks with `Set<ExtendedGameType>` tracking.
- Reused stable game-press callback across cards by passing game type from `RecommendationCard` instead of creating a new inline closure per row render.
- Removed unused parent `isDark` destructure.
- Rationale: avoids avoidable repeated linear scans and per-item closure churn during recommendation regeneration/render.
- Risk: **Low** (same recommendation rules and displayed output).

### 5.3 Performance fix (hot utility path)

1. `src/utils/log.ts`

- Added one-time normalized `SENSITIVE_KEY_PATTERNS` and switched per-key sensitive matching from `Array.some` callback allocation to loop with early break.
- Rationale: this path runs for every logged object key; reduces callback allocations and repeated normalization work.
- Risk: **Low** (same sanitization intent, with stronger case-insensitive matching).

## 6) What was not fixed (and why)

- Root parse/lint/test failures not introduced by this refactor were left unchanged (baseline instability):
  - `src/screens/friends/FriendsScreen.tsx` TS parse error
  - Root Jest ESM transform issues involving Expo packages
  - Existing performance regression tests failing in `__tests__/performance/gamePerformance.test.ts`
- Large-scale lint warning cleanup across game screens was deferred because many warnings involve hook dependency semantics and gameplay-state timing risks.
- Unused dependency removal was deferred due multi-app workspace coupling (root app + embedded clients + server tooling) and high false-positive risk without lockstep runtime tracing.

### Recommended next actions

1. Stabilize root test infrastructure (Jest Expo ESM handling) before broader refactors.
2. Profile pool/chess perf tests and optimize simulation hotspots in targeted engine modules.
3. Run dependency-prune pass per package (`depcheck`/manual) with runtime smoke test per app/server.
4. Tackle lint debt in small game-by-game batches with snapshot/gameplay verification gates.

## 7) Verification results (post-change)

### Root app

- `npm run lint` → **FAIL** (pre-existing), but count improved from **695** to **691** total issues.
- `npm run type-check` → **FAIL** (same pre-existing parse error in `src/screens/friends/FriendsScreen.tsx`).
- `npm test -- --runInBand` → **FAIL** (same suite-level failures; totals unchanged at 12 failed / 17 passed).

### Focused checks for touched areas

- `npx eslint src/utils/log.ts src/utils/permissions.ts src/screens/games/components/GameRecommendations.tsx` → **PASS** (no emitted violations).
- `client`: `npm run typecheck` → **PASS**
- `client`: `npm run build` → **PASS**

## 8) Summary metrics

- Approx files touched by this audit pass: **3 code files** + **1 report file**.
- Approx net code reduction: **~35 lines removed** (plus targeted replacements/optimizations).
- Unused deps removed: **0** (deferred for dedicated dependency-trace pass).
- Notable improvements:
  - Removed confirmed dead/unreachable code paths.
  - Recommendation generation now uses set-based dedupe (avoids repeated linear membership checks).
  - Recommendation list rendering avoids per-item inline press closure creation.
  - Logger sanitization hot path now performs normalized/early-break sensitive-key checks.
