# Games System

Last verified: 2026-03-01

Canonical source:

- `docs/GAMES_SYSTEM.md`

This file is intentionally kept as a short pointer to avoid duplicate architecture docs drifting out of sync.

Quick links:

- Unified lobby spec: `docs/UNIFIED_LOBBY_SPEC.md`
- Audit report: `docs/AUDIT_GameInviteAndFlow.md`
- Canonical game registry: `src/types/games.ts`
- Game adapter registry: `src/config/gameAdapters.ts`
- V3 session types: `shared/sessions/types.ts`
- V3 session hook: `src/hooks/useSessionLobby.ts`
- V3 Cloud Functions: `firebase-backend/functions/src/sessionsV3.ts`
- Invite schema: `src/types/turnBased.ts`
- Client invite service: `src/services/gameInvites.ts`
- Backend orchestration: `firebase-backend/functions/src/games.ts`

Runtime shell architecture (§26 of GAMES_SYSTEM.md):

- `MultiplayerRuntimeShell`: `src/components/games/MultiplayerRuntimeShell.tsx` — HOC for 14 MP games
- `SoloRuntimeShell`: `src/components/games/SoloRuntimeShell.tsx` — HOC for 6 solo games
- `GameResultFacts` type: `src/types/gameResultFacts.ts` — universal result envelope
- Reward processor: `processSessionRewards` in `firebase-backend/functions/src/sessionsV3.ts`
- Colyseus bridge: `resolveV3Session`, `abandonV3Session` in `colyseus-server/src/services/persistence.ts`
