# Audit Checklist

Use this checklist to execute the deep-clean plan one segment at a time. Mark a segment complete only when its exit criteria are met and required checks are rerun.

## Segment 0 - Safety + Baseline Health Check (reference)

Status: Completed in current run (read-only).

## Segment 1 - Create Audit Framework Docs

- [x] Complete
Exit criteria:
- `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, `docs/AUDIT_REPORT_2026-02-17.md` updated.
- Doc-only changes.
- Root type-check status unchanged.
Commands:
```bash
npm run type-check
```

## Segment 2 - Tooling Baseline (Typecheck/Lint/Test Reliable)

- [x] Complete
Exit criteria:
- Root `type-check` + `lint` pass.
- Root tests pass or explicitly quarantined with justification.
- Functions/server/client package checks run where package roots exist.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
cd firebase-backend/functions && npx --no-install tsc --noEmit
cd colyseus-server && npx --no-install tsc --noEmit && npm run lint -- --no-cache && npm run test -- --ci --watchAll=false --no-cache
```

## Segment 3 - Repo Inventory + Deprecation Map

- [x] Complete
Exit criteria:
- `docs/REPO_MAP.md` and `docs/DEPRECATION_MAP.md` created/updated.
- Segment 3 findings + top 20 cleanup candidates in audit report.
- Checks unchanged.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 4 - Config + Feature Flags Audit

- [x] Complete
Exit criteria:
- `constants/featureFlags.ts` audited with proof-based cleanup only.
- Config paths audited and documented in `docs/CONFIGURATION.md`.
- No risky default flips without explicit rationale.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 5 - Types + Data Contract Baseline

- [x] Complete
Exit criteria:
- Canonical type locations identified and duplicate types consolidated safely.
- High-risk boundary runtime guards added where needed.
- `docs/DATA_CONTRACT_CLIENT.md` added/updated.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 6 - Firestore Rules + Indexes Contract Audit

- [x] Complete
Exit criteria:
- Client writes mapped to rules and query/index requirements.
- `docs/FIRESTORE_CONTRACT.md` added/updated.
- Rules/index updates are minimal and safe when needed.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
cd firebase-backend/functions && npx --no-install tsc --noEmit
```

## Segment 7 - Cloud Functions Deep Clean

- [ ] Complete
Exit criteria:
- Functions inventory with contracts and auth expectations.
- Input validation/error handling/logging hardened.
- `docs/FUNCTIONS.md` added/updated.
Commands:
```bash
cd firebase-backend/functions && npm run build
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 8 - Messaging System Deep Clean

- [ ] Complete
Exit criteria:
- Messaging invariants preserved (idempotency, ordering, watermark semantics, outbox states).
- Direct-write bypasses removed where proven safe.
- `docs/CHAT_SYSTEM.md` added/updated.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 9 - Profile System Deep Clean

- [ ] Complete
Exit criteria:
- Profile writes/reads stabilized via canonical service paths.
- Theme/default hydration behavior preserved.
- `docs/PROFILE_SYSTEM.md` added/updated.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 10 - Games Platform Consistency + Error Handling

- [ ] Complete
Exit criteria:
- Unified invite/lobby lifecycle across multiplayer games.
- Trace IDs, watchdogs, and error taxonomy preserved.
- `docs/GAMES_PLATFORM.md` or equivalent `docs/06_GAMES.md` updates.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 11 - Colyseus Server Audit + Protocol Safety

- [ ] Complete
Exit criteria:
- Protocol/version and trace propagation validated.
- Room contracts and reconnection/debugging documented in `docs/COLYSEUS_SERVER.md`.
Commands:
```bash
cd colyseus-server && npx --no-install tsc --noEmit
cd colyseus-server && npm run lint -- --no-cache
cd colyseus-server && npm run test -- --ci --watchAll=false --no-cache
```

## Segment 12 - Embedded Web Game Client + WebView Integration

- [ ] Complete
Exit criteria:
- URL/param contract and fallback UX audited.
- `docs/EMBEDDED_WEB_GAMES.md` added/updated.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 13 - Calls + Camera Subsystem Audit

- [ ] Complete
Exit criteria:
- UI/service-layer gating validated.
- Risky flags unchanged unless explicitly justified.
- `docs/CALLS_CAMERA.md` added/updated.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 14 - Performance + Startup Cleanup

- [ ] Complete
Exit criteria:
- Safe startup/render/sync hotpath optimizations only.
- `docs/PERFORMANCE.md` added/updated.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 15 - Security + Privacy Review

- [ ] Complete
Exit criteria:
- Secrets/logging/auth/rules hardening completed.
- `docs/SECURITY_PRIVACY.md` added/updated.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
cd firebase-backend/functions && npm run build
```

## Segment 16 - Test Coverage Uplift

- [ ] Complete
Exit criteria:
- Invariant-focused tests added (messaging/games/profile priorities).
- `docs/TESTING.md` added/updated.
Commands:
```bash
npm run test -- --ci --watchAll=false --no-cache
cd colyseus-server && npm run test -- --ci --watchAll=false --no-cache
```

## Segment 17 - Final Deprecation Removal + Doc Consolidation

- [ ] Complete
Exit criteria:
- Every deletion has no-caller proof + validation reruns.
- Deletion ledger complete in audit report.
- Index links/doc references consolidated.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
cd colyseus-server && npx --no-install tsc --noEmit && npm run lint -- --no-cache && npm run test -- --ci --watchAll=false --no-cache
cd firebase-backend/functions && npx --no-install tsc --noEmit
```

## Segment 18 - Release-Quality Wrap-Up

- [ ] Complete
Exit criteria:
- Final audit report and checklist fully updated.
- Full checks rerun across package roots.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
cd colyseus-server && npx --no-install tsc --noEmit && npm run lint -- --no-cache && npm run test -- --ci --watchAll=false --no-cache
cd firebase-backend/functions && npx --no-install tsc --noEmit
```
