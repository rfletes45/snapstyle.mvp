# SnapStyle Documentation

Last verified: 2026-03-05

This is the canonical documentation set for how the app currently works in code.
Historical plan/audit docs were removed and condensed; see `docs/archive/removed-docs-2026-02-22.md` if you need legacy context.

## Read Order

If you are new to the repo, read in this order:

1. `docs/architecture/system-overview.md`
2. `docs/operations/runbook.md`
3. `docs/operations/testing.md`
4. Feature/backend docs for the subsystem you are changing

## Documentation Map

- `docs/architecture/system-overview.md`
  - App bootstrap, provider stack, navigation topology, data boundaries, invariants.
- `docs/backend/firebase-and-functions.md`
  - Firestore/Storage contracts, callable + trigger topology, deploy and schema safety.
- `docs/features/messaging.md`
  - DM/group architecture, hybrid local-first migration, message pipeline contracts.
- `docs/chat-system-audit/00_INBOX_CHAT_SYSTEM_MASTER_REFERENCE.md`
  - Single-document master reference for inbox/chat architecture, contracts, risks, tests, QA, and operations.
- `docs/chat-system-audit/01_INBOX_CHAT_TECHNICAL_OVERVIEW.md`
  - Inbox/chat runtime architecture map, parity guarantees, and lifecycle flows.
- `docs/chat-system-audit/02_INBOX_CHAT_DATA_CONTRACTS.md`
  - Canonical message, inbox, unread, requests, and notification contracts.
- `docs/chat-system-audit/03_INBOX_CHAT_KNOWN_ISSUES_RISKS.md`
  - Resolved risk ledger, remaining non-blocking risks, and ownership.
- `docs/chat-system-audit/04_INBOX_CHAT_REFACTOR_PLAN.md`
  - Sustaining hardening plan with owners, gates, and escalation criteria.
- `docs/chat-system-audit/05_PHASE2_CHECKPOINTS.md`
  - Historical checkpoint log covering Phase 2 through current Phase 3+.
- `docs/features/profile-economy.md`
  - Profile data/privacy contracts, relationship/moderation flows, wallet/tasks/shop behavior.
- `docs/PROFILE_SYSTEM.md`
  - Canonical profile cosmetics architecture: data model, entitlements, equip and rendering flow.
- `docs/operations/runbook.md`
  - Local setup, startup sequence, health checks, deploy commands.
- `docs/operations/testing.md`
  - Test matrix and required verification per subsystem.
- `docs/operations/configuration-and-security.md`
  - Feature flags, env/config surfaces, security boundaries and hygiene.
- `docs/GAMES_V4_SYSTEM.md`
  - Canonical reference for the Games V4 system: adapter architecture, resolution pipeline, Firestore schemas, solo/1v1 flows.
- `docs/GAMES_V4_RUNBOOK.md`
  - Operational runbook for Games V4: deploy, rollback, watchdog, incident response.
- `docs/GAME_INTEGRATION_GUIDE_V4.md`
  - **Exhaustive AI-ready guide** for implementing a new game end-to-end: adapter contract, backend wiring, achievements, leaderboards, notifications, security, testing. Includes copy-paste templates in `docs/templates/new-game-v4/`.
- `docs/QA_GAME_DETAIL_LEADERBOARD.md`
  - QA playbook for game detail page & leaderboard subsystem.
- `docs/QA_GAME_OVER_ACHIEVEMENTS.md`
  - QA playbook for game over screen & achievement unlock flows.
- `docs/QA_IN_APP_NOTIFICATIONS.md`
  - QA playbook for in-app notification system (turn, achievement, invite).

## Critical Cross-Subsystem Invariants

These are the most important things to preserve when changing the app:

1. Messaging ordering is server-authoritative (`serverReceivedAt`), not client clock order.
2. Messaging sends are idempotent (`messageId` + `clientId`), and retries must not create duplicates.
3. Profile writes must stay aligned across:
   - `src/services/profile/profileContract.ts`
   - `src/services/profileService.ts`
   - `firebase-backend/firestore.rules`
4. Economy/shop/task writes should remain server-authoritative via Functions.
5. Feature flags must be safe both enabled and disabled, especially migration flags.

## Documentation Maintenance Rules

- Keep docs inside this structure; do not reintroduce one-off root-level plan docs.
- Update docs in the same PR/commit as behavior changes.
- Prefer contract and invariant documentation over historical implementation narrative.
- Link to source files for deep details; avoid duplicating entire code paths.
- If a subsystem materially changes and no doc changes are needed, state why in the PR notes.
