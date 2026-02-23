# SnapStyle Documentation

Last verified: 2026-02-22

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
- `docs/backend/colyseus.md`
  - Realtime server room registry, join payload contract, spectator/Starforge host behavior.
- `docs/features/messaging.md`
  - DM/group architecture, hybrid local-first migration, message pipeline contracts.
- `docs/features/games.md`
  - Game catalog, invite lifecycle, multiplayer runtime split, spectator/leaderboard wiring.
- `docs/features/profile-economy.md`
  - Profile data/privacy contracts, relationship/moderation flows, wallet/tasks/shop behavior.
- `docs/operations/runbook.md`
  - Local setup, startup sequence, health checks, deploy commands.
- `docs/operations/testing.md`
  - Test matrix and required verification per subsystem.
- `docs/operations/configuration-and-security.md`
  - Feature flags, env/config surfaces, security boundaries and hygiene.

## Critical Cross-Subsystem Invariants

These are the most important things to preserve when changing the app:

1. Messaging ordering is server-authoritative (`serverReceivedAt`), not client clock order.
2. Messaging sends are idempotent (`messageId` + `clientId`), and retries must not create duplicates.
3. Colyseus join payloads must include protocol/build/trace metadata (`buildJoinOptions`).
4. Colyseus room registry and client room mapping must stay in sync.
5. Profile writes must stay aligned across:
   - `src/services/profile/profileContract.ts`
   - `src/services/profileService.ts`
   - `firebase-backend/firestore.rules`
6. Economy/shop/task writes should remain server-authoritative via Functions.
7. Feature flags must be safe both enabled and disabled, especially migration flags.
8. Embedded Starforge assumes co-hosting at `/starforge` unless explicitly overridden.

## Documentation Maintenance Rules

- Keep docs inside this structure; do not reintroduce one-off root-level plan docs.
- Update docs in the same PR/commit as behavior changes.
- Prefer contract and invariant documentation over historical implementation narrative.
- Link to source files for deep details; avoid duplicating entire code paths.
- If a subsystem materially changes and no doc changes are needed, state why in the PR notes.
