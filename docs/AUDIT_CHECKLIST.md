# Audit Checklist (18 Segments)

Use this checklist to track each audit segment consistently. Mark a segment complete only when its exit criteria and checks pass.

## Segment 1 - Audit framework docs
- [ ] Complete
Exit criteria:
- `docs/00_INDEX.md`, `docs/AUDIT_CHECKLIST.md`, and `docs/AUDIT_REPORT_2026-02-17.md` are updated.
- No non-doc files are changed in this segment.
- Root type-check result is unchanged from baseline.
Commands:
```bash
npm run type-check
```

## Segment 2 - Repo contract map
- [ ] Complete
Exit criteria:
- Source-of-truth services, types, and contracts are documented for touched areas.
- Proposed work is scoped to minimal files.
Commands:
```bash
npm run type-check
npm run lint
```

## Segment 3 - Root lint blocker fixes
- [ ] Complete
Exit criteria:
- Root lint has zero blocking errors.
- No new lint errors are introduced in touched files.
Commands:
```bash
npm run lint
npm run type-check
```

## Segment 4 - Messaging invariants
- [ ] Complete
Exit criteria:
- Messaging changes preserve idempotency, ordering, and outbox semantics.
- Relevant chat tests pass.
Commands:
```bash
npm run type-check
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 5 - Profile and moderation safety
- [ ] Complete
Exit criteria:
- Profile field changes are type-safe and backward compatible.
- Related permission and moderation paths are validated.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 6 - Games client stability
- [ ] Complete
Exit criteria:
- Game client changes preserve invite/lobby/session flows.
- No regressions in multiplayer entry points.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 7 - Colyseus server health
- [ ] Complete
Exit criteria:
- Room/server changes compile and pass lint/tests.
- No protocol compatibility regressions.
Commands:
```bash
cd colyseus-server && npm run build
cd colyseus-server && npm run lint
cd colyseus-server && npm run test -- --ci --watchAll=false --no-cache
```

## Segment 8 - Cloud Functions health
- [ ] Complete
Exit criteria:
- Functions code compiles cleanly.
- Export surface and deployment contract are intact.
Commands:
```bash
cd firebase-backend/functions && npm run build
```

## Segment 9 - Firestore rules and indexes
- [ ] Complete
Exit criteria:
- New/changed writes are allowed by rules.
- New query shapes are covered by indexes.
Commands:
```bash
npm run type-check
cd firebase-backend/functions && npm run build
```

## Segment 10 - Navigation and route typing
- [ ] Complete
Exit criteria:
- Navigator routes and params are aligned with screens.
- Full-screen/tab-hidden behavior remains intentional.
Commands:
```bash
npm run type-check
npm run lint
```

## Segment 11 - Feature-flag compliance
- [ ] Complete
Exit criteria:
- Risky or incomplete behavior is gated.
- Flags are applied in service and UI layers where needed.
Commands:
```bash
npm run type-check
npm run lint
```

## Segment 12 - Local-first and sync reliability
- [ ] Complete
Exit criteria:
- Outbox, sync, and local persistence paths remain consistent.
- No duplicate send or read-state regressions.
Commands:
```bash
npm run type-check
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 13 - Performance and watchdogs
- [ ] Complete
Exit criteria:
- Watchdog and recovery logic remains consistent.
- No obvious performance regressions in touched paths.
Commands:
```bash
npm run type-check
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 14 - Deprecated and dead code cleanup
- [ ] Complete
Exit criteria:
- Removed paths have no production callers.
- References, exports, and imports remain coherent.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

## Segment 15 - Documentation sync
- [ ] Complete
Exit criteria:
- Behavior/contract changes are reflected in `docs/`.
- New operational steps are documented.
Commands:
```bash
npm run type-check
```

## Segment 16 - Regression test hardening
- [ ] Complete
Exit criteria:
- Failing or flaky tests in touched areas are resolved.
- CI-targeted test run is stable.
Commands:
```bash
npm run test -- --ci --watchAll=false --no-cache
cd colyseus-server && npm run test -- --ci --watchAll=false --no-cache
```

## Segment 17 - Release candidate verification
- [ ] Complete
Exit criteria:
- Root + server + functions checks pass for touched areas.
- No blocker issues remain open.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
cd colyseus-server && npm run build && npm run lint && npm run test -- --ci --watchAll=false --no-cache
cd firebase-backend/functions && npm run build
```

## Segment 18 - Final audit sign-off
- [ ] Complete
Exit criteria:
- Audit report is complete and linked from docs index.
- Final risk and follow-up list is documented.
Commands:
```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```
