# Game System Overhaul Reference (Condensed)

Last updated: 2026-02-19

This file is a compact compatibility reference for older game-system links.

## Canonical Docs

- Full games platform details: `docs/06_GAMES.md`
- Multiplayer lifecycle summary: `docs/GAMES_PLATFORM.md`
- Colyseus server contracts: `docs/COLYSEUS_SERVER.md`

## Key Invariants

- Preserve `GameErrorCode` taxonomy usage.
- Keep `GAME_PROTOCOL_VERSION` compatibility checks.
- Maintain trace ID propagation across invite/lobby/join/bug report flows.
- Preserve watchdog/recovery behavior and bug-report context payloads.

## Rule

Do not introduce bespoke per-game multiplayer flows unless explicitly documented and justified.
