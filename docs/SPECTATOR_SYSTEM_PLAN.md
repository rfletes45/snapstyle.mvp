# Spectator System Reference (Condensed)

Last updated: 2026-02-19

This compact reference replaces the previous long-form spectator plan.

## Canonical Docs

- System overview: `docs/06_GAMES.md`
- Server behavior/throttling: `docs/COLYSEUS_SERVER.md`
- Embedded web integration: `docs/EMBEDDED_WEB_GAMES.md`

## Key Requirements

- Spectator mode entry must preserve trace IDs and session identifiers.
- Load shedding/throttling behavior must remain active under high spectator counts.
- Spectator UX should include graceful fallback and retry on room/network failures.

## Rule

Spectator paths should stay unified and avoid bypassing shared lobby/session contracts.
