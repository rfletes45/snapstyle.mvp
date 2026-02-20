# Game System Reference (Condensed)

Last updated: 2026-02-19

This is the compact replacement for the previous exhaustive reference file.

## Canonical Sources

- Full platform details: `docs/06_GAMES.md`
- Lifecycle consistency notes: `docs/GAMES_PLATFORM.md`
- Colyseus server contracts: `docs/COLYSEUS_SERVER.md`
- Error taxonomy and protocol types: `src/types/gameErrors.ts`, `src/types/gameProtocol.ts`

## Core Invariants

- Use `GameErrorCode` taxonomy for user-facing/gameplay errors.
- Enforce protocol compatibility via `GAME_PROTOCOL_VERSION`.
- Carry trace IDs across invite -> lobby -> join -> room -> bug report.
- Keep watchdogs enabled for room/lobby stuck-state detection.

## Note

Historical implementation/reference detail was pruned for maintainability.
For removed long-form notes, use git history.
