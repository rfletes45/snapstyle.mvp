# Games Platform

Last updated: 2026-02-18 (Segment 10)

## Canonical Multiplayer Lifecycle

For RN-native multiplayer screens, the canonical path is:

1. Invite created/claimed through universal invite APIs in `src/services/gameInvites.ts`.
2. Navigation passes `inviteId` (+ optional `matchId`) into game screen.
3. Screen composes `useGameLobbyController(...)`.
4. UI renders `MultiplayerLobbyOverlay` until ready.
5. Room join/start transitions from lobby to `playing`.
6. Recovery actions route through `executeRecoveryAction(...)`.
7. Bug reports include `traceId`, invite, room, and phase context.

Primary contracts:

- Lobby controller: `src/hooks/useGameLobbyController.ts`
- Lobby overlay UI: `src/components/games/MultiplayerLobbyOverlay.tsx`
- Recovery executor: `src/services/gameRecoveryActions.ts`
- Error taxonomy: `src/types/gameErrors.ts`
- Protocol guard: `src/types/gameProtocol.ts`

## Coverage By Game Screen

Controller + unified lobby overlay is active in:

- `src/screens/games/ChessGameScreen.tsx`
- `src/screens/games/CheckersGameScreen.tsx`
- `src/screens/games/TicTacToeGameScreen.tsx`
- `src/screens/games/ConnectFourGameScreen.tsx`
- `src/screens/games/DotMatchGameScreen.tsx`
- `src/screens/games/GomokuMasterGameScreen.tsx`
- `src/screens/games/ReversiGameScreen.tsx`
- `src/screens/games/CrazyEightsGameScreen.tsx`
- `src/screens/games/SketchPartyGameScreen.tsx`

## Explicit Exceptions (Bespoke By Design)

The following multiplayer screens do not use `useGameLobbyController` and are intentionally exempt for now:

- `src/screens/games/MiniGolfDuelsGameScreen.tsx`
Reason: host-first room key flow and invite queue handshake (`subscribeToUniversalInvite`) require waiting for `colyseusRoomKey`/`gameId` resolution before join.
- `src/screens/games/StarforgeGameScreen.tsx`
Reason: embedded WebView client lifecycle (probe -> load -> bridge messages) is governed by host URL reachability and web-session params, not RN lobby overlay state.

These are not anonymous bespoke flows; they are documented exceptions and should remain explicit until a common adapter is introduced.

## Navigation Consistency

- Joiners are navigated into game screens with `inviteId` after successful `claimInviteSlot(...)` in:
  - `src/components/chat/ChatGameInvites.tsx`
  - `src/screens/games/GamesHubScreen.tsx`
- Participants auto-navigate when invite transitions to `active` in:
  - `src/components/games/UniversalInviteCard.tsx`

## Segment 10 Test Additions

- Lobby phase/overlay state selectors:
  - `__tests__/hooks/useGameLobbyControllerSelectors.test.ts`
- Recovery action dispatch and side-effect handling:
  - `__tests__/services/gameRecoveryActions.test.ts`

## Related Docs

- Detailed system reference: `docs/06_GAMES.md`
- Audit report ledger: `docs/AUDIT_REPORT_2026-02-17.md`
