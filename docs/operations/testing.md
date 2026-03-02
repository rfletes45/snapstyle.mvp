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
npm run smoke
```

## Backend Validation

Firebase functions:

```bash
npm --prefix firebase-backend/functions run build
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
- Smoke harness: `__tests__/integration/smokeTestHarness.test.ts`

## Manual Smoke Scenarios (Recommended)

1. DM send/edit/delete/reaction and unread behavior.
2. Group chat send + typing + read watermark behavior.
3. Profile update + privacy-sensitive viewed profile behavior.

## Test Placement Rules

- App tests: `__tests__/`
- Keep tests near the contract they protect; avoid detached generic tests with unclear ownership.
