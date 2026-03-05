# Sketch Party — Implementation Summary & QA Checklist

## Overview

Sketch Party is a real-time multiplayer drawing + guessing game (skribbl.io-style) for 2-8 players, integrated into the SnapStyle Games V4 system. Players take turns drawing while others guess the word. Scoring rewards fast guesses and effective drawings.

**GameId**: `sketch_party_game`  
**Runtime**: `realtime` (Colyseus WebSocket, not Firestore state machine)  
**Players**: 2-8

---

## Files Created

### Client

| #   | File                                          | Purpose                                                                    |
| --- | --------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | `src/gamesV4/adapters/sketchParty.ts`         | Client adapter (GameAdapterV4) — settings, initial state, outcome, metrics |
| 2   | `src/gamesV4/screens/SketchPartyScreenV4.tsx` | Main game screen — canvas, tools, chat, word choice modal                  |
| 3   | `src/gamesV4/services/sketchPartyClient.ts`   | Colyseus client service — join/leave/send messages                         |
| 4   | `src/gamesV4/data/sketchPartyWords.ts`        | Word bank (100 words), masked word, guess detection                        |
| 5   | `src/gamesV4/data/sketchPartyScoring.ts`      | Scoring functions (guesser, drawer, placements)                            |

### Colyseus Server

| #   | File                                           | Purpose                                                       |
| --- | ---------------------------------------------- | ------------------------------------------------------------- |
| 6   | `colyseus-server/package.json`                 | Server npm config (colyseus ^0.15.0, firebase-admin, express) |
| 7   | `colyseus-server/tsconfig.json`                | TypeScript config (ES2020, commonjs, strict)                  |
| 8   | `colyseus-server/src/index.ts`                 | Server entry point (express + monitor + room registration)    |
| 9   | `colyseus-server/src/rooms/SketchPartyRoom.ts` | **Authoritative game room** — full match lifecycle            |
| 10  | `colyseus-server/src/data/wordBank.ts`         | Server word bank (canonical copy)                             |
| 11  | `colyseus-server/src/data/scoring.ts`          | Server scoring functions (canonical copy)                     |
| 12  | `colyseus-server/src/bridge/firebaseBridge.ts` | Writes resolution request to Firestore for V4 pipeline        |

### Backend (Firebase Cloud Functions)

| #   | File                                                                | Purpose                                                         |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| 13  | _Modified_ `firebase-backend/functions/src/gamesV4/types.ts`        | Added `sketch_party_game: "bestScore"` to `LEADERBOARD_METRICS` |
| 14  | _Modified_ `firebase-backend/functions/src/gamesV4/adapters.ts`     | Registered `sketch_party_game` backend adapter                  |
| 15  | _Modified_ `firebase-backend/functions/src/gamesV4/achievements.ts` | Added sketch_party section (12 achievements)                    |
| 16  | _Modified_ `firebase-backend/functions/src/gamesV4/triggers.ts`     | Added `onRealtimeResolutionRequest` trigger                     |
| 17  | _Modified_ `firebase-backend/functions/src/gamesV4/index.ts`        | Exported new trigger                                            |

### Client Integration

| #   | File                                                      | Purpose                                                                     |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| 18  | _Modified_ `src/gamesV4/constants.ts`                     | IMPLEMENTED_GAME_IDS, SCOREBOARD/LEADERBOARD descriptors, GAME_DESCRIPTIONS |
| 19  | _Modified_ `src/gamesV4/adapters/index.ts`                | Side-effect import for auto-registration                                    |
| 20  | _Modified_ `src/gamesV4/screens/GamePlayDispatcherV4.tsx` | Added GAME_SCREEN_MAP entry                                                 |
| 21  | _Modified_ `src/gamesV4/data/achievementDefinitions.ts`   | Added sketch_party section + 12 achievement defs + isGameSection            |

### Tests

| #   | File                                             | Purpose                                           |
| --- | ------------------------------------------------ | ------------------------------------------------- |
| 22  | `__tests__/gamesV4/adapters/sketchParty.test.ts` | 36 unit tests (scoring, words, adapter, outcomes) |

---

## Environment / Setup

### Colyseus Server

```bash
cd colyseus-server
npm install
npm run dev    # starts on port 2567
```

### Environment Variables

- **`COLYSEUS_URL`**: Set in client config to point to the Colyseus server (e.g., `ws://localhost:2567` for dev)
- **Firebase Admin**: The Colyseus server uses Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS` env var or GCP metadata)

### Firestore Security Rules

Add rules for the `gameSessions/{sessionId}/internal/{docId}` subcollection:

```
match /gameSessions/{sessionId}/internal/{docId} {
  allow read, write: if false;  // Server-only via Admin SDK
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (React Native)                │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │SketchPartyScreen│  │SketchPartyClient (Colyseus)  │  │
│  │  Canvas + Chat   │←→│ joinRoom / sendMsg / listen  │  │
│  └─────────────────┘  └─────────────┬────────────────┘  │
└───────────────────────────────────────┼──────────────────┘
                                        │ WebSocket
┌───────────────────────────────────────┼──────────────────┐
│               Colyseus Server         │                  │
│  ┌────────────────────────────────────┴───────────────┐  │
│  │            SketchPartyRoom                         │  │
│  │  Turn lifecycle, draw relay, guess, scoring        │  │
│  └───────────────────────────┬────────────────────────┘  │
│                              │ Admin SDK write           │
└──────────────────────────────┼───────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────┐
│          Firebase Cloud Functions                        │
│  ┌───────────────────────────┴────────────────────────┐  │
│  │  onRealtimeResolutionRequest (Firestore trigger)   │  │
│  │  → resolveRealtimeSessionV4()                      │  │
│  │  → resolveSessionV4Internal() (10-phase pipeline)  │  │
│  │    Phase 1: Validate session                       │  │
│  │    Phase 2: Update session status                  │  │
│  │    Phase 3: Write GameResult                       │  │
│  │    Phase 4: PB update                              │  │
│  │    Phase 5: Achievement evaluation                 │  │
│  │    Phase 6: Leaderboard update                     │  │
│  │    Phase 7: XP award                               │  │
│  │    Phase 8: Notifications                          │  │
│  │    Phase 9: Invite status sync                     │  │
│  │    Phase 10: Audit log                             │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Achievements (12 total)

| Type                   | Name               | Difficulty | Tokens |
| ---------------------- | ------------------ | ---------- | ------ |
| sp_first_play          | Doodle Debut       | Easy       | 5      |
| sp_first_win           | Top Artist         | Easy       | 10     |
| sp_first_correct_guess | Sharp Eye          | Easy       | 5      |
| sp_play_10             | Sketch Enthusiast  | Medium     | 15     |
| sp_win_5               | Gallery Champion   | Medium     | 25     |
| sp_score_500           | Point Collector    | Medium     | 20     |
| sp_speed_guesser       | Quick Draw         | Hard       | 30     |
| sp_all_guessed         | Master Illustrator | Hard       | 40     |
| sp_score_1000          | Sketch Prodigy     | Hard       | 50     |
| sp_win_10              | Sketch Legend      | Expert     | 50     |
| sp_score_2000          | Canvas King        | Expert     | 75     |
| sp_perfect_round       | Picasso            | Legendary  | 100    |

---

## QA Checklist

### Lobby & Matchmaking

- [ ] Create a Sketch Party invite from the game selector
- [ ] Invite appears in conversation with correct metadata (icon "draw", "Sketch Party")
- [ ] 2nd player can join lobby; "Start" button appears for host when ≥ 2 players
- [ ] Host can adjust settings (rounds, draw time, hints, word choices)
- [ ] Settings are validated (clamped within ranges)
- [ ] Starting the game transitions invite from "lobby" to "active"

### Connection & State

- [ ] Both players connect to Colyseus room on game start
- [ ] Players see "waiting" state brief, then first turn begins
- [ ] Drawer sees word choice modal with N words
- [ ] Non-drawer players see "Waiting for [drawer] to choose a word…"
- [ ] Auto-pick occurs after turnChooseTimeSec timeout

### Drawing Phase

- [ ] Canvas supports finger/stylus drawing in pen mode
- [ ] Color palette (8 colors) changes stroke color
- [ ] Width selector (4 sizes) changes stroke width
- [ ] Eraser tool works
- [ ] Undo removes last stroke
- [ ] Clear removes all strokes
- [ ] Strokes appear on all other players' screens in real-time
- [ ] Non-drawer cannot draw (touch events are no-ops)
- [ ] Timer counts down from drawTimeSec

### Hints

- [ ] Hints reveal letters at scheduled intervals during drawing
- [ ] Masked word updates in real-time on non-drawer screens
- [ ] Spaces are preserved in masked word

### Guessing

- [ ] Non-drawers can type guesses in chat input
- [ ] Correct guess shows green "guessed correctly!" message
- [ ] Correct guess awards points to guesser AND drawer
- [ ] Incorrect guess shows in chat as normal message
- [ ] Drawer cannot type guesses
- [ ] Already-correct guessers cannot guess again
- [ ] When all non-drawers guess correctly, turn ends early

### Scoring

- [ ] Guesser points decrease as time passes
- [ ] Guesser points decrease with more hints used
- [ ] Drawer gets points proportional to guesser time bonus
- [ ] Scores update in real-time on player strip

### Turn & Round Flow

- [ ] Turn ends when timer reaches 0 OR all guess correctly
- [ ] Word is revealed at turn end
- [ ] Turn scores summary is broadcast
- [ ] Next player becomes drawer after delay
- [ ] After all players draw once → next round
- [ ] After all rounds → match end

### Match End & Resolution

- [ ] Match end phase shows final scoreboard
- [ ] Winner(s) determined by highest score
- [ ] Result flows through V4 resolution pipeline via Firestore trigger
- [ ] PB doc updated (totalPlays, totalWins, bestScore)
- [ ] Leaderboard doc updated (bestScore metric)
- [ ] XP awarded to all participants
- [ ] Achievements evaluated and unlocked appropriately

### Reconnection

- [ ] Reconnecting player receives board_snapshot with current strokes
- [ ] Reconnecting player rejoins correct phase
- [ ] Scores preserved on reconnect

### Disconnect

- [ ] Drawer disconnect skips turn immediately
- [ ] Non-drawer disconnect does not end the game
- [ ] All players disconnect → match ends with "disconnect" resolution
- [ ] Disconnect shows system message in chat

### Notifications

- [ ] Game resolved notification sent to all non-resolver participants
- [ ] In-app achievement notification when achievements unlock

### Achievements

- [ ] sp_first_play triggers on first Sketch Party game
- [ ] sp_first_win triggers on first win
- [ ] sp_score_500/1000/2000 trigger at correct thresholds
- [ ] sp_win_5/10 trigger at correct cumulative win counts
- [ ] Achievements are idempotent (no double-unlock)
- [ ] Token rewards credited to wallet

### Performance

- [ ] Drawing feels smooth (40ms batching, normalized coords)
- [ ] Chat messages appear instantly
- [ ] Timer sync is accurate (server-authoritative 1s ticks)
- [ ] No memory leaks (timers cleared on turn/match end)

### Edge Cases

- [ ] Game with exactly 2 players works correctly
- [ ] Game with 8 players works correctly
- [ ] Very fast guess (< 1 second) awards maximum points
- [ ] Very long word is masked correctly
- [ ] Empty guess is rejected
- [ ] Case-insensitive guess matching works
