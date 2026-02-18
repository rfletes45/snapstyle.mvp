# Testing Guide

Last updated: 2026-02-18 (Segment 16)

## Package Commands

### Root app (`snapstyle-mvp`)

```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```

### Firebase functions (`firebase-backend/functions`)

```bash
npm run build
```

If needed for local strict check:

```bash
npx --no-install tsc --noEmit
```

### Colyseus server (`colyseus-server`)

```bash
npm run build
npm run lint -- --no-cache
npm run test -- --ci --watchAll=false --no-cache
```

### Embedded web client (`starforge-viewer`)

```bash
npm run typecheck
npm run build
```

## High-Value Invariant Tests

Priority areas for regression prevention:

1. Messaging
   - idempotent enqueue/no duplicates
   - server-authoritative ordering in merged timelines
   - outbox state transitions (`queued -> sending -> sent/failed`)
2. Games
   - join option contract includes `protocolVersion`, build metadata, and `traceId`
   - protocol mismatch maps to `GameErrorCode.PROTOCOL_VERSION_MISMATCH`
   - lobby/recovery phase transitions
3. Profile
   - hydration defaults via `hydrateProfileData`
   - privacy filtering matrix via `applyPrivacyFilters`

## Where to Add Tests

- Root Jest suite: `__tests__/`
- Messaging-focused tests: `__tests__/services/`
- Hook/controller tests: `__tests__/hooks/`
- Integration smoke/flow tests: `__tests__/integration/`
- Colyseus server tests: `colyseus-server/tests/`

## Test Design Patterns

- Prefer pure-function unit tests for mapping/validation/selectors.
- Keep flaky-time dependencies controlled (mock timers or deterministic boundaries).
- Avoid brittle snapshots for dynamic game/chat state.
- For error mapping and retry logic, assert on canonical error codes and transition outcomes.
- Include trace IDs in relevant game test fixtures so debugging remains end-to-end.
