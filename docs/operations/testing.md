# Testing Guide

Last verified: 2026-03-30

## Baseline Validation

Run these from the repository root for almost every meaningful change:

```bash
npm run type-check
npm run lint
npm run test
```

Backend build:

```bash
npm --prefix firebase-backend/functions run build
```

Realtime server validation:

```bash
npm --prefix colyseus-server run lint
npm --prefix colyseus-server run test
npm --prefix colyseus-server run build
```

## Change Matrix

### Messaging

Minimum:

1. root app checks
2. Functions build

Recommended targeted focus:

- chat services and hooks under `__tests__/services/`
- notification interactions if message routing changed

### Auth, social, profile, wallet, tasks, shop

Minimum:

1. root app checks
2. Functions build when contracts or rewards changed

Recommended targeted focus:

- profile widget tests
- services tests touching entitlements, wallet, or tasks

### Stream calls

Minimum:

1. root app checks
2. Functions build

Manual verification matters most here because device/build environment affects behavior.

### Games V4

Minimum:

1. root app checks
2. Functions build
3. Colyseus checks for realtime game work

Use the deeper game-specific test and runbook docs for scenario coverage:

- [GAMES_V4_RUNBOOK.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/GAMES_V4_RUNBOOK.md)
- [REALTIME_FRAMEWORK.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/REALTIME_FRAMEWORK.md)

### Rules, indexes, or query-shape changes

Minimum:

1. root app checks
2. Functions build
3. manual sanity against the affected Firestore shape

## High-Value Test Areas In This Repo

- `__tests__/services/`
- `__tests__/profile/`
- `__tests__/notifications/`
- `__tests__/gamesV4/`
- rules/index-related tests under `__tests__/`

## Manual Scenarios Worth Repeating

- DM send/read/reaction/attachment flow
- group chat send and unread behavior
- onboarding safety for returning users versus true new users
- profile board render and customization save/reload
- wallet/tasks/shop read and claim flows
- direct call and voice-channel entry on a native build

## Explicit Non-Truths From Older Docs

The following older test guidance is not valid for the current repo:

- `npm run smoke`
- `npm run verify:registry`
- `__tests__/integration/smokeTestHarness.test.ts`

If those commands or files are reintroduced later, document them when they actually land.
