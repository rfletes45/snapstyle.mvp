# Documentation Index

Last updated: 2026-02-17

## Start Here

Read in this order for the fastest orientation:

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

snapstyle-mvp is an Expo React Native client backed by Firebase (Auth, Firestore, Storage, Functions) with Colyseus for real-time multiplayer sessions. The app favors service-driven flows, strict feature-flag gating, and local-first message UX on native with background sync to Firestore. Safe implementation work starts at types and service contracts, then validates rules and indexes for backend writes, and finally confirms navigation and tests before expanding UI surface area.

## Subsystem Docs

- Core architecture: [01_ARCHITECTURE.md](01_ARCHITECTURE.md)
- Firebase data model and security: [02_FIREBASE.md](02_FIREBASE.md)
- Messaging architecture: [03_CHAT_V2.md](03_CHAT_V2.md)
- Chat deep docs: [chat/CHAT_SYSTEM_COMPLETE.md](chat/CHAT_SYSTEM_COMPLETE.md), [chat/architecture.md](chat/architecture.md), [chat/client-flows.md](chat/client-flows.md), [chat/security-permissions.md](chat/security-permissions.md)
- Games architecture: [06_GAMES.md](06_GAMES.md), [GAME_SYSTEM_REFERENCE.md](GAME_SYSTEM_REFERENCE.md), [LOBBY_OVERHAUL_QA.md](LOBBY_OVERHAUL_QA.md)
- Testing and runbook: [04_TESTING.md](04_TESTING.md), [05_RUNBOOK.md](05_RUNBOOK.md)
- AI handoff guide: [AI_PROJECT_GUIDE.md](AI_PROJECT_GUIDE.md)

## Audit Docs

- Segment checklist: [AUDIT_CHECKLIST.md](AUDIT_CHECKLIST.md)
- Rolling report: [AUDIT_REPORT_2026-02-17.md](AUDIT_REPORT_2026-02-17.md)
