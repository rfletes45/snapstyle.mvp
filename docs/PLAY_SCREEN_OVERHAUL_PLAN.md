# Play Screen Reference (Condensed)

Last updated: 2026-02-19

This compact file preserves old `@see` links used in play-screen components.

## Canonical Docs

- Main games platform: `docs/06_GAMES.md`
- Lifecycle consistency and lobby behavior: `docs/GAMES_PLATFORM.md`
- App-level navigation and feature flags: `src/navigation/RootNavigator.tsx`, `constants/featureFlags.ts`

## Play Screen Areas

- Header/search UX
- Game card variants and category carousels
- Invites and active-games sections
- Recommendation/stats widgets
- 3D visual overlays gated by flags

## Rule

Play-screen UI changes must keep multiplayer invite/lobby invariants and feature-flag gating intact.
