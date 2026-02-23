# Testing Guide

Last verified: 2026-02-22

## Purpose

This matrix is the minimum verification bar for this repository. Use it to avoid regressions across app, backend functions, realtime server, and embedded Starforge components.

## Core App Validation

From repository root:

```bash
npm run type-check
npm run lint
npm run test
```

High-value targeted checks:

```bash
npm run verify:registry
npm run smoke
```

## Backend and Realtime Validation

Firebase functions:

```bash
npm --prefix firebase-backend/functions run build
```

Colyseus server:

```bash
npm --prefix colyseus-server run lint
npm --prefix colyseus-server run test
npm --prefix colyseus-server run build
```

Starforge packages:

```bash
npm --prefix starforge-viewer run typecheck
npm --prefix starforge-viewer run build
npm --prefix starforge-viewer/server run typecheck
```

## Required Matrix by Change Type

Messaging changes:

1. Root app checks
2. Functions build
3. Smoke test

Game/invite/runtime changes:

1. Root app checks
2. `verify:registry` + `smoke`
3. Colyseus lint/test/build

Profile/economy/shop changes:

1. Root app checks
2. Functions build
3. Any relevant integration tests under `__tests__/services/`

Rules/index/query changes:

1. Root app checks
2. Functions build
3. Manual query/write sanity in emulator or staging

## High-Value Test Areas

Use these paths as a quick guide for impact-focused validation:

- Messaging contracts and outbox behavior: `__tests__/services/` (messaging-related files)
- Colyseus error and trace propagation: `__tests__/services/colyseusErrorMap.test.ts`, `__tests__/services/traceIdPropagation.test.ts`
- Game registry completeness: `__tests__/games/registryCompleteness.test.ts`
- Smoke harness: `__tests__/integration/smokeTestHarness.test.ts`
- Colyseus room and utils tests: `colyseus-server/tests/rooms/`, `colyseus-server/tests/utils/`

## Manual Smoke Scenarios (Recommended)

1. DM send/edit/delete/reaction and unread behavior.
2. Group chat send + typing + read watermark behavior.
3. Create/accept a game invite and enter a playable match.
4. Join spectator flow (where applicable).
5. Profile update + privacy-sensitive viewed profile behavior.

## Test Placement Rules

- App tests: `__tests__/`
- Colyseus tests: `colyseus-server/tests/`
- Keep tests near the contract they protect; avoid detached generic tests with unclear ownership.
