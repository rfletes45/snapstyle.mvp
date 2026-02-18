# Documentation Index

Last updated: 2026-02-18

## Start Here

Read in this order for fastest orientation:

1. [App.tsx](../App.tsx)
2. [src/navigation/RootNavigator.tsx](../src/navigation/RootNavigator.tsx)
3. [constants/featureFlags.ts](../constants/featureFlags.ts)
4. [AI_PROJECT_GUIDE.md](AI_PROJECT_GUIDE.md)
5. [01_ARCHITECTURE.md](01_ARCHITECTURE.md)
6. [02_FIREBASE.md](02_FIREBASE.md)
7. [03_CHAT_V2.md](03_CHAT_V2.md)
8. [06_GAMES.md](06_GAMES.md)
9. [04_TESTING.md](04_TESTING.md)

## Repo Mental Model

`snapstyle-mvp` is an Expo React Native app with provider-driven client state, feature-flagged behavior, and service-layer orchestration, backed by Firebase (Auth, Firestore, Storage, Cloud Functions) and Colyseus for real-time multiplayer. Safe changes start at types/contracts and service paths, then validate Firestore rules/indexes and protocol invariants, and finally verify navigation and tests so no user-visible flow regresses.

## Core Docs

- AI project handoff: [AI_PROJECT_GUIDE.md](AI_PROJECT_GUIDE.md)
- Architecture: [01_ARCHITECTURE.md](01_ARCHITECTURE.md)
- Firebase and data plane: [02_FIREBASE.md](02_FIREBASE.md)
- Configuration and feature flags: [CONFIGURATION.md](CONFIGURATION.md)
- Messaging: [03_CHAT_V2.md](03_CHAT_V2.md), [03_CHAT_V3.md](03_CHAT_V3.md)
- Games: [06_GAMES.md](06_GAMES.md), [GAME_SYSTEM_REFERENCE.md](GAME_SYSTEM_REFERENCE.md)
- Testing and ops: [04_TESTING.md](04_TESTING.md), [05_RUNBOOK.md](05_RUNBOOK.md)

## Deep-Dive Subsystem Docs

- Chat architecture set: [chat/README.md](chat/README.md), [chat/CHAT_SYSTEM_COMPLETE.md](chat/CHAT_SYSTEM_COMPLETE.md), [chat/architecture.md](chat/architecture.md), [chat/client-flows.md](chat/client-flows.md), [chat/security-permissions.md](chat/security-permissions.md)
- Games planning and QA: [GAME_SYSTEM_OVERHAUL_PLAN.md](GAME_SYSTEM_OVERHAUL_PLAN.md), [LOBBY_OVERHAUL_QA.md](LOBBY_OVERHAUL_QA.md), [SPECTATOR_SYSTEM_PLAN.md](SPECTATOR_SYSTEM_PLAN.md)

## Audit Docs

- Checklist: [AUDIT_CHECKLIST.md](AUDIT_CHECKLIST.md)
- Rolling report: [AUDIT_REPORT_2026-02-17.md](AUDIT_REPORT_2026-02-17.md)
- Repo map: [REPO_MAP.md](REPO_MAP.md)
- Deprecation map: [DEPRECATION_MAP.md](DEPRECATION_MAP.md)

## Planned Audit Deliverables

These are linked early so later segments can fill them in without index churn:

- `docs/DATA_CONTRACT_CLIENT.md`
- `docs/FIRESTORE_CONTRACT.md`
- `docs/FUNCTIONS.md`
- `docs/CHAT_SYSTEM.md`
- `docs/PROFILE_SYSTEM.md`
- `docs/GAMES_PLATFORM.md` (or equivalent updates in `docs/06_GAMES.md`)
- `docs/COLYSEUS_SERVER.md`
- `docs/EMBEDDED_WEB_GAMES.md`
- `docs/CALLS_CAMERA.md`
- `docs/PERFORMANCE.md`
- `docs/SECURITY_PRIVACY.md`
- `docs/TESTING.md`
