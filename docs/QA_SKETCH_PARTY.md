# Sketch Party - Current Implementation Summary and QA Checklist

## Overview

Sketch Party is a realtime multiplayer drawing and guessing game integrated into the Games V4 shell.

- `gameId`: `sketch_party_game`
- runtime: `realtime`
- transport: Colyseus WebSocket room plus Firebase-backed invite/session/result lifecycle
- players: 2-8

The current implementation no longer uses a bespoke client service or legacy room path. The canonical client path is `useRealtimeRoom(SKETCH_PARTY_CLIENT_DEF, ...)`, and the canonical server room is `colyseus-server/src/games/sketch_party/Room.ts`.

## Canonical Files

### Client

| File | Purpose |
| --- | --- |
| `src/gamesV4/adapters/sketchParty.ts` | V4 adapter metadata, settings schema, summaries, outcome helpers |
| `src/gamesV4/realtime/games/sketchPartyDef.ts` | Realtime client definition for room name, initial state, reconnect policy |
| `src/gamesV4/realtime/games/sketchPartyTypes.ts` | Shared Sketch Party state and message contracts used by the screen and tests |
| `src/gamesV4/realtime/useRealtimeRoom.ts` | Shared room lifecycle hook used by realtime games |
| `src/gamesV4/screens/SketchPartyScreenV4.tsx` | Gameplay UI: canvas, chat, word choice, reactions, room event handling |

### Realtime server

| File | Purpose |
| --- | --- |
| `colyseus-server/src/index.ts` | Active room registration and `/health` endpoint |
| `colyseus-server/src/core/BaseRealtimeRoom.ts` | Shared realtime lifecycle, auth, reconnect, resolution bridge plumbing |
| `colyseus-server/src/games/sketch_party/Room.ts` | Authoritative Sketch Party room implementation |
| `colyseus-server/src/data/wordBank.ts` | Server-side word selection |
| `colyseus-server/src/data/scoring.ts` | Server-side scoring helpers |
| `colyseus-server/src/bridge/firebaseBridge.ts` | Firebase Admin initialization and bridge helpers |

### Firebase backend

| File | Purpose |
| --- | --- |
| `firebase-backend/functions/src/gamesV4/triggers.ts` | Realtime resolution trigger handoff |
| `firebase-backend/functions/src/gamesV4/sessions.ts` | Shared session writes and resolution integration |
| `firebase-backend/functions/src/gamesV4/adapters.ts` | Backend adapter registration for post-match surfaces |
| `firebase-backend/functions/src/gamesV4/achievements.ts` | Achievement evaluation after resolution |
| `firebase-backend/functions/src/gamesV4/types.ts` | Leaderboard metric and shared backend constants |

## Runtime Ownership

### Firebase owns

- invite creation, pinning, lobby membership, and lobby settings
- session creation in `GameSessionsV4`
- result writes, rewards, XP, achievements, PBs, leaderboards, and notifications
- Game Over navigation surfaces through the normal V4 pipeline

### Colyseus owns

- room join and reconnect handling
- authenticated roster enforcement
- round and drawer progression
- word choice, hint timing, guess validation, and stroke relay
- live score accumulation during the match
- match-end scoreboard payload before handing off to Firebase

### Source of truth

- live room state: Colyseus room state/messages
- invite and session lifecycle state: Firebase
- terminal results and rewards: Firebase resolution pipeline

## Critical Flow Summary

1. Lobby is created and managed through Games V4 Firebase callables.
2. Starting the invite creates an active realtime session in `GameSessionsV4`.
3. `SketchPartyScreenV4` joins the `sketch_party` room using `useRealtimeRoom`.
4. The room authenticates membership against Firebase session data.
5. Live gameplay runs entirely through room messages and room-owned timers.
6. Match end writes a resolution request that the Firebase trigger pipeline consumes.
7. Standard V4 result/reward surfaces take over after the session resolves.

## QA Checklist

### Lobby and start

- [ ] Create a Sketch Party invite from the game selector.
- [ ] Invite appears in the conversation with `sketch_party_game` metadata.
- [ ] A second player can join the lobby.
- [ ] Host settings edits are reflected in the eventual room settings.
- [ ] Starting the lobby creates an active session and routes both players into gameplay.

### Room connection and auth

- [ ] Both players connect to the `sketch_party` room successfully.
- [ ] A non-participant cannot join the room for the same `sessionId`.
- [ ] Reconnect uses the same session and returns the player to the current phase.
- [ ] A reconnecting player receives the current board snapshot and scores.

### Turn flow

- [ ] Drawer receives word choices during the `choosing` phase.
- [ ] Auto-pick occurs if the drawer does not choose in time.
- [ ] Only the current drawer can draw.
- [ ] Non-drawers can guess during the drawing phase.
- [ ] Correct guesses award points to the guesser and drawer.
- [ ] Turn ends on timeout or when all eligible guessers answer correctly.
- [ ] Word reveal and turn score broadcast happen at turn end.

### Match end and resolution

- [ ] Final scoreboard is produced when all rounds complete.
- [ ] Disconnect-end matches resolve with the expected resolution reason.
- [ ] Firebase trigger processing creates a `GameResultsV4/{sessionId}` document.
- [ ] PB, leaderboard, XP, and achievements are updated through the shared V4 pipeline.
- [ ] Game Over surfaces reflect the resolved match correctly.

### Stability and regression checks

- [ ] Match end does not trigger a reconnect loop on the client.
- [ ] Disconnecting the drawer advances or terminates the match per room logic.
- [ ] All timers are cleared on room disposal.
- [ ] Room state changes remain invisible to Firestore-only readers during live play; no UI assumes otherwise.

## Known Constraints

- Live room progress is not mirrored into Firestore in realtime.
- Full-roster start gating can still stall if the expected roster never fully connects.
- Realtime games still require per-title QA even though the client/server framework is now shared.
