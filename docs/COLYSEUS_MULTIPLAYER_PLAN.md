# Colyseus Multiplayer Reference (Condensed)

Last updated: 2026-02-19

This file intentionally replaces the former long-form implementation plan.

## Canonical Docs

- Architecture and invariants: `docs/06_GAMES.md`
- Server contracts and room lifecycle: `docs/COLYSEUS_SERVER.md`
- Feature flags and rollout constraints: `constants/featureFlags.ts`

## Current Rules

- `GAME_PROTOCOL_VERSION` must match client/server.
- Multiplayer flows use trace IDs end-to-end.
- Unified lobby controller and watchdog/recovery logic are required paths.
- Protocol mismatch and join failures map to `GameErrorCode`.

## Package Roots

- Server: `colyseus-server/`
- Client integration: `src/services/colyseus.ts`, `src/hooks/use*Game*.ts`
- Embedded web viewer: `starforge-viewer/`

## Note

Detailed historical planning steps were removed to reduce documentation sprawl.
Use git history if you need prior design-phase detail.
