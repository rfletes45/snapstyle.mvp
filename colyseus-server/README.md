# SnapStyle Colyseus Game Server

Real-time multiplayer game server for SnapStyle, powered by [Colyseus v0.17](https://colyseus.io/).

## Architecture

```
colyseus-server/
├── src/
│   ├── app.config.ts          # Server entry point (defineServer)
│   ├── schemas/
│   │   ├── common.ts          # Shared schemas: Player, Vec2, BaseGameState
│   │   ├── quickplay.ts       # ScoreRacePlayer, ScoreRaceState
│   │   └── index.ts           # Barrel exports
│   ├── rooms/
│   │   ├── base/
│   │   │   └── ScoreRaceRoom.ts  # Abstract base for quick-play games
│   │   └── quickplay/
│   │       ├── ReactionRoom.ts   # Reaction Time (round-based, custom)
│   │       ├── TimedTapRoom.ts   # Timed Tap game
│   │       ├── DotMatchRoom.ts   # Dot Match game
│   └── services/
│       ├── firebase.ts        # Firebase Admin auth bridge
│       ├── persistence.ts     # Firestore game state persistence
│       └── validation.ts      # Anti-cheat score validation
├── tests/
│   ├── rooms/
│   │   ├── ScoreRaceRoom.test.ts
│   │   └── ReactionRoom.test.ts
│   └── services/
│       └── validation.test.ts
├── Dockerfile                 # Production container
├── docker-compose.yml         # Local Docker setup
└── nginx.conf                 # Reverse proxy config
```

## Quick Start

### Prerequisites

- Node.js >= 18
- Firebase service account key (for auth)

### Setup

```bash
cd colyseus-server
cp .env.example .env
# Edit .env with your Firebase service account path
npm install --legacy-peer-deps
```

### Development

```bash
npm run dev      # Start with hot-reload (nodemon + ts-node)
```

Server runs on `ws://localhost:2567` by default.

### Testing

```bash
npm test         # Run all 39 tests
```

### Production Build

```bash
npm run build    # Compile TypeScript → dist/
npm start        # Run compiled server
```

### Docker

```bash
docker compose up --build
```

## Game Rooms

### Quick-Play (Score Race Pattern)

All quick-play games extend `ScoreRaceRoom` and follow the same lifecycle:

1. **Waiting** → Both players join
2. **Countdown** → 3-2-1-GO!
3. **Playing** → Score race with timer
4. **Finished** → Winner determined, rematch offered

| Room         | Key         | Duration | Description             |
| ------------ | ----------- | -------- | ----------------------- |
| TimedTapRoom | `timed_tap` | 15s      | Timed precision tapping |
| DotMatchRoom | `dot_match` | 30s      | Match dot patterns      |

### Reaction Room (Custom)

The `ReactionRoom` has its own round-based mechanics:

- Best of 5 rounds (configurable)
- Server controls stimulus timing (1.5–5s random delay)
- Players tap when stimulus appears
- Fastest reaction wins each round
- Tiebreaker: average reaction time

## Client Integration

On the React Native side:

```tsx
import { useMultiplayerGame } from "@/hooks/useMultiplayerGame";

function MyGameScreen() {
  const mp = useMultiplayerGame("timed_tap_game");

  // Check if multiplayer available
  if (mp.isAvailable) {
    // Show "Multiplayer" button
  }

  // Start a match
  await mp.startMultiplayer();

  // Report scores during gameplay
  mp.reportScore(newScore);

  // Report when game ends
  mp.reportFinished();
}
```

## Feature Flags

All multiplayer features are gated behind feature flags in `constants/featureFlags.ts`:

```ts
COLYSEUS_FEATURES = {
  COLYSEUS_ENABLED: false, // Master switch
  QUICKPLAY_ENABLED: false, // This phase
  // ...
};
```

Set `COLYSEUS_ENABLED` and `QUICKPLAY_ENABLED` to `true` to activate.

## Message Protocol

### Client → Server

| Message          | Payload             | Description           |
| ---------------- | ------------------- | --------------------- |
| `ready`          | `{}`                | Player ready to start |
| `score_update`   | `{ score: number }` | Score changed         |
| `combo_update`   | `{ combo: number }` | Combo changed         |
| `lose_life`      | `{}`                | Lost a life           |
| `finished`       | `{}`                | Player finished       |
| `rematch`        | `{}`                | Request rematch       |
| `rematch_accept` | `{}`                | Accept rematch        |
| `tap`            | `{}`                | Reaction game: tapped |

### Server → Client

| Message           | Payload                              | Description                      |
| ----------------- | ------------------------------------ | -------------------------------- |
| `welcome`         | `{ sessionId, playerIndex }`         | Connection confirmed             |
| `too_early`       | `{}`                                 | Reaction: tapped before stimulus |
| `stimulus`        | `{ round }`                          | Reaction: stimulus appeared      |
| `round_result`    | `{ round, results[] }`               | Reaction: round finished         |
| `game_over`       | `{ winnerId, winReason, results[] }` | Game ended                       |
| `rematch_request` | `{ fromSessionId }`                  | Opponent wants rematch           |

## Score Validation

Anti-cheat validation with per-game bounds:

| Game      | Max/sec | Max Total |
| --------- | ------- | --------- |
| reaction  | 1       | 10        |
| timed_tap | 20      | 999       |
| dot_match | 5       | 999       |

Scores exceeding 1.5× the max rate are flagged and rejected.
