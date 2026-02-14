# Codex Games System — Full Review, Polish & Integration

> **For**: OpenAI Codex (codex-5.3)
> **Repository**: `snapstyle-mvp` — React Native + Expo social app called "Vibe"
> **Date**: February 2026
> **Objective**: Exhaustive review, visual polish, logic debugging, and seamless integration of every game with the invite/spectator/multiplayer systems

---

## Mission

You are performing a **complete, exhaustive audit and rewrite** of the games system in a production React Native + Expo social app. There are **21 game screens**, **22 Colyseus server rooms**, **4 game logic services**, **15 game hooks**, and **10 spectator renderers**. Many games were added rapidly and have:

- **Visual roughness** — inconsistent styling, missing animations, poor color usage
- **Logical bugs** — game loops that don't clean up, physics edge cases, incorrect win detection
- **Inconsistent integration** — some games wire up invites/spectator/haptics/back-handler, others don't
- **Missing shared patterns** — not all games use the standard hooks, shared components, or error boundaries

Your job is to **review every single game**, fix every bug, polish every visual, and ensure every game is **seamlessly integrated** with the invite system, spectator system, multiplayer hooks, and shared UI components. **Rewrite entire game screens if needed** — don't be afraid to restructure a 1,500-line file from scratch if the logic is tangled.

**You must**:

1. Read and understand every game screen, every hook, every Colyseus room, and every logic file before modifying
2. Run `npx tsc --noEmit` after each batch of changes to verify zero TypeScript errors
3. Never break existing game functionality unless you're fixing a bug
4. Work systematically through each section below
5. **Make games look beautiful** — this is a consumer social app, games should feel polished and delightful

---

## Tech Stack (Ground Truth — Rendering)

| Technology                       | Version    | Purpose                                                                                                |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| **@shopify/react-native-skia**   | ^2.2.12    | **Primary game renderer** — all 2D game graphics, boards, pieces, particles, gradients, glows, shadows |
| **three**                        | ^0.166.1   | 3D visuals for Games Hub background and decorative elements (NOT used for gameplay)                    |
| **expo-three**                   | ^8.0.0     | Three.js bridge for Expo                                                                               |
| **expo-gl**                      | ~16.0.10   | OpenGL context for Three.js                                                                            |
| **react-native-reanimated**      | ~4.1.1     | 60fps UI animations, shared values, worklets                                                           |
| **react-native-gesture-handler** | ~2.28.0    | Touch/pan/pinch gesture handling for game inputs                                                       |
| **expo-haptics**                 | ~15.0.8    | Tactile feedback on game events                                                                        |
| **React Native Animated**        | (built-in) | Legacy animation API (some games still use this — migrate to Reanimated where possible)                |

### Rendering Rules

- **All game boards, pieces, balls, paddles, particles, and visual effects MUST use Skia** (`@shopify/react-native-skia`). Skia gives hardware-accelerated 2D rendering with gradients, shadows, blur, rounded rects, circles, paths, and text.
- **Three.js is ONLY for the Games Hub 3D background** (`ThreeGameBackground`, `ThreeFloatingIcons`) — never for gameplay.
- **Reanimated shared values** should drive animations (not `requestAnimationFrame` + `setState` — that causes jank).
- **GestureDetector** from `react-native-gesture-handler` for all touch inputs (not PanResponder — that's legacy).
- Every game should provide **haptic feedback** via `useGameHaptics` on key events (score, win, lose, move, tap).

### Skia Primitives Available

The project already has a Skia graphics library at `src/components/games/graphics/`:

- `SkiaGameBoard` — Grid board renderer (Chess, Checkers, TicTacToe, ConnectFour, Gomoku, Reversi, Minesweeper)
- `SkiaChessPieces` — Chess piece rendering with shadows
- `SkiaCheckersPiece` — Checkers disc with king crown
- `SkiaTicTacToePieces` — X and O with animation
- `SkiaDisc` — Connect Four disc with gradients
- `SkiaCellHighlight` — Cell selection/valid-move highlight
- `SkiaWinLine` — Animated winning line overlay
- `Skia2048Tile` — 2048 tile with number and color
- `SkiaMinesweeperCell` — Minesweeper cell with flag/mine/number
- `SkiaParticleBurst` — Particle explosion effect for celebrations

**If a game is rendering with plain `<View>` and `backgroundColor` instead of Skia, REWRITE IT to use Skia.**

---

## App Stack (Non-Rendering)

| Technology       | Version                             | Purpose                      |
| ---------------- | ----------------------------------- | ---------------------------- |
| React Native     | 0.81.5                              | Mobile framework             |
| Expo SDK         | 54                                  | Build toolchain              |
| React            | 19.1.0                              | UI library                   |
| TypeScript       | ~5.9.2                              | Type safety (`strict: true`) |
| Firebase         | 12.8.0                              | Auth, Firestore, Storage     |
| Colyseus SDK     | 0.17.31 (client) / 0.17.35 (server) | Real-time multiplayer        |
| React Navigation | 7.x                                 | Screen navigation            |
| Path alias       | `@/*` → `src/*`                     | Import paths                 |

---

## Current Game Inventory

### 21 Game Screens (`src/screens/games/`)

**Single-Player — Quick Play:**
| Game | File | Lines | Rendering | Has BackHandler | Has Haptics | Has Spectator | Has Cleanup |
|---|---|---|---|---|---|---|---|
| Reaction Tap | ReactionTapGameScreen.tsx | 739 | Skia | ❌ | ❌ | ✅ | ✅ |
| Timed Tap | TimedTapGameScreen.tsx | 840 | Skia | ❌ | ❌ | ✅ | ✅ |
| Bounce Blitz | BounceBlitzGameScreen.tsx | 1438 | Skia | ✅ | ❌ | ✅ | ✅ |
| Pong (vs AI) | PongGameScreen.tsx | 989 | Skia | ✅ | ❌ | ✅ | ✅ |
| Brick Breaker | BrickBreakerGameScreen.tsx | 1340 | Skia | ✅ | ✅ | ✅ | ✅ |

**Single-Player — Puzzle:**
| Game | File | Lines | Rendering | Has BackHandler | Has Haptics | Has Spectator | Has Cleanup |
|---|---|---|---|---|---|---|---|
| 2048 | Play2048GameScreen.tsx | 1170 | Skia | ✅ | ✅ | ✅ | ❌ |
| Minesweeper | MinesweeperGameScreen.tsx | 1183 | Skia | ✅ | ❌ | ✅ | ✅ |
| Lights Out | LightsOutGameScreen.tsx | 826 | Skia | ✅ | ❌ | ✅ | ❌ |

**Single-Player — Daily:**
| Game | File | Lines | Rendering | Has BackHandler | Has Haptics | Has Spectator | Has Cleanup |
|---|---|---|---|---|---|---|---|
| Word Master | WordMasterGameScreen.tsx | 2112 | Skia | ✅ | ❌ | ✅ | ✅ |
| Crossword | CrosswordGameScreen.tsx | 1143 | Skia | ❌ | ❌ | ❌ | ✅ |

**Multiplayer — Turn-Based:**
| Game | File | Lines | Rendering | Has BackHandler | Has Haptics | Has GameCompletion | Has Cleanup |
|---|---|---|---|---|---|---|---|
| Chess | ChessGameScreen.tsx | 1605 | Skia | ❌ | ✅ | ✅ | ✅ |
| Checkers | CheckersGameScreen.tsx | 1474 | Skia | ❌ | ❌ | ✅ | ❌ |
| Tic-Tac-Toe | TicTacToeGameScreen.tsx | 1177 | Skia | ❌ | ❌ | ✅ | ❌ |
| Connect Four | ConnectFourGameScreen.tsx | 881 | Skia | ❌ | ❌ | ❌ | ❌ |
| Crazy Eights | CrazyEightsGameScreen.tsx | 1965 | Skia | ❌ | ✅ | ✅ | ✅ |
| Gomoku | GomokuMasterGameScreen.tsx | 1037 | Skia | ❌ | ❌ | ❌ | ❌ |
| Reversi | ReversiGameScreen.tsx | 845 | Skia | ❌ | ❌ | ❌ | ✅ |
| Dot Match | DotMatchGameScreen.tsx | 1165 | Skia | ❌ | ❌ | ❌ | ❌ |
| Hex | HexGameScreen.tsx | 722 | Skia | ❌ | ❌ | ❌ | ❌ |

**Multiplayer — Real-Time / Physics:**
| Game | File | Lines | Rendering | Has BackHandler | Has Haptics | Has Spectator | Has Cleanup |
|---|---|---|---|---|---|---|---|
| 8-Ball Pool | PoolGameScreen.tsx | 1217 | Skia | ❌ | ❌ | ❌ | ✅ |
| Air Hockey | AirHockeyGameScreen.tsx | 917 | Skia | ❌ | ❌ | ❌ | ✅ |

---

### 22 Colyseus Server Rooms (`colyseus-server/src/rooms/`)

**Base rooms** (abstract, extended by game rooms):

- `TurnBasedRoom.ts` (822 lines) — board sync, turn management, draw/resign, reconnection
- `ScoreRaceRoom.ts` (447 lines) — score race scoring, countdown, lives
- `PhysicsRoom.ts` (395 lines) — physics simulation loop, ball/paddle sync
- `CardGameRoom.ts` (356 lines) — private hands via targeted messages, draw pile

**Game rooms:**
| Room | Base | Lines | Game |
|---|---|---|---|
| TicTacToeRoom | TurnBasedRoom | 142 | Tic-Tac-Toe |
| ConnectFourRoom | TurnBasedRoom | 159 | Connect Four |
| GomokuRoom | TurnBasedRoom | 131 | Gomoku |
| ReversiRoom | TurnBasedRoom | 280 | Reversi |
| CheckersRoom | TurnBasedRoom | 336 | Checkers |
| ChessRoom | TurnBasedRoom | 795 | Chess |
| CrazyEightsRoom | CardGameRoom | 236 | Crazy Eights |
| ReactionRoom | ScoreRaceRoom | 309 | Reaction Tap |
| TimedTapRoom | ScoreRaceRoom | 13 | Timed Tap |
| DotMatchRoom | ScoreRaceRoom | 13 | Dot Match |
| PongRoom | PhysicsRoom | 170 | Pong |
| AirHockeyRoom | PhysicsRoom | 187 | Air Hockey |
| PoolRoom | PhysicsRoom | 459 | Pool |
| BounceBlitzRoom | PhysicsRoom | 257 | Bounce Blitz |
| BrickBreakerRoom | PhysicsRoom | 289 | Brick Breaker |
| CrosswordRoom | (custom) | 568 | Crossword |
| WordMasterRoom | (custom) | 926 | Word Master |
| SpectatorRoom | (custom) | 203 | SP spectating |

---

### Game Hooks (`src/hooks/`)

| Hook                       | Purpose                                               | Used By                                                  |
| -------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `useMultiplayerGame`       | Score race multiplayer (quick-play games)             | BounceBlitz, Pong, ReactionTap, TimedTap, etc.           |
| `useTurnBasedGame`         | Turn-based multiplayer                                | Chess, Checkers, TicTacToe, ConnectFour, Gomoku, Reversi |
| `useCardGame`              | Card game multiplayer (hidden hands)                  | CrazyEights                                              |
| `usePhysicsGame`           | Physics-based multiplayer (server-authoritative)      | Pong, AirHockey                                          |
| `useScoreRace`             | Core score race logic (wrapped by useMultiplayerGame) | Internal                                                 |
| `useGameConnection`        | Invite → transport resolver (Colyseus vs Firestore)   | All multiplayer games                                    |
| `useGameBackHandler`       | Android back button in-game                           | Only 7/21 games ❌                                       |
| `useGameHaptics`           | Haptic feedback helpers                               | Only 4/21 games ❌                                       |
| `useGameCompletion`        | Achievement + navigation on game end                  | Only 4/21 games ❌                                       |
| `useGameNavigation`        | Smart back navigation (respects entry point)          | Via useGameCompletion                                    |
| `useSpectator`             | SP host / SP spectator / MP spectator modes           | Only 10/21 games ❌                                      |
| `useColyseus`              | Raw Colyseus room connection                          | Internal                                                 |
| `useColyseusAppState`      | Reconnect on app foreground                           | Internal                                                 |
| `useCrosswordMultiplayer`  | Crossword-specific multiplayer                        | Crossword                                                |
| `useWordMasterMultiplayer` | WordMaster-specific multiplayer                       | WordMaster                                               |

---

### Shared Game Components (`src/components/games/`)

| Component                | Purpose                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------- | ----------------------- |
| `GameOverModal`          | Universal game-over dialog with stats, rematch, share                                 | Only used by 8/21 games |
| `GamePickerModal`        | Game selection from chat (creates invites)                                            |
| `GameErrorBoundary`      | Crash recovery wrapper                                                                |
| `MultiplayerOverlay`     | Score race HUD (scores, timer, countdown)                                             |
| `TurnBasedOverlay`       | Turn-based HUD (turn indicator, draw offer, resign, waiting, reconnecting, game over) |
| `SpectatorOverlay`       | Spectator count badge + viewer list                                                   |
| `SpectatorBanner`        | "You are spectating" banner                                                           |
| `PlayerBar`              | Player name/avatar/score display                                                      |
| `PlayerSlots`            | Waiting room player slots                                                             |
| `UniversalInviteCard`    | In-chat invite card rendering                                                         |
| `GameInviteBadge`        | Pending invite notification badge                                                     |
| `MatchmakingModal`       | Matchmaking queue UI                                                                  |
| `OfflineIndicator`       | Connection lost indicator                                                             |
| `GamePerformanceMonitor` | FPS counter / debug overlay                                                           |

---

### Spectator Renderers (`src/components/games/spectator-renderers/`)

10 renderers exist for: BounceBlitz, BrickBreaker, LightsOut, Minesweeper, Play2048, Pong, ReactionTap, TimedTap, WordMaster.

**Missing spectator renderers** for: Crossword, AirHockey, Pool, Chess, Checkers, CrazyEights, ConnectFour, TicTacToe, Gomoku, Reversi, Hex, DotMatch.

---

## Section 1: Standardize Every Game Screen Structure

### Problem

Game screens vary wildly in structure. Some are well-organized, others are 2,000-line monoliths with inline physics, rendering, state management, and UI all tangled together.

### Required Standard Structure

Every game screen MUST follow this template:

```typescript
// 1. Imports (organized: components, hooks, services, types, constants)
// 2. Constants (screen dimensions, game config)
// 3. Types (local interfaces/types)
// 4. Component
export default function XxxGameScreen({ navigation, route }) {
  // a. Auth/theme/user context
  // b. Route params extraction
  // c. Game connection (useGameConnection for multiplayer transport)
  // d. Core game state (useState/useRef for game-specific state)
  // e. Standard hooks:
  //    - useGameBackHandler(navigation, handleConfirmExit)
  //    - useGameHaptics()
  //    - useGameCompletion({ gameType, ... })
  //    - useSpectator({ mode: "sp-host", gameType }) // for single-player
  //    - useMultiplayerGame / useTurnBasedGame / useCardGame / usePhysicsGame
  // f. Game logic (useCallback handlers, useEffect loops)
  // g. Cleanup useEffect (return () => { cancelAnimationFrame, clearInterval, etc. })
  // h. Render:
  //    - Loading state
  //    - Error boundary
  //    - Game UI (Skia Canvas for gameplay)
  //    - Overlays (MultiplayerOverlay / TurnBasedOverlay)
  //    - SpectatorOverlay
  //    - GameOverModal
  //    - FriendPickerModal + SpectatorInviteModal (for invites from game)
  //    - ScoreRaceOverlay (for multiplayer games)
}
```

### Task

For **every single game screen** (all 21):

1. **Read the entire file** — understand its game logic, rendering, and integration points
2. **Restructure to match the template** — move game logic into proper sections
3. **Add missing standard hooks**:
   - `useGameBackHandler` — MISSING from 14 games. Add it to ALL 21.
   - `useGameHaptics` — MISSING from 17 games. Add appropriate haptic events to ALL 21:
     - `haptics.light()` on piece placement / valid move
     - `haptics.medium()` on score increment / level up
     - `haptics.heavy()` on game over / win
     - `haptics.error()` on invalid move / lose life
   - `useGameCompletion` — MISSING from 17 games. Add to ALL multiplayer games (turn-based) and consider for single-player games.
4. **Add error boundary wrapping** — every game screen export should be wrapped with `GameErrorBoundary`
5. **Verify cleanup**: Every `useEffect` with `requestAnimationFrame`, `setInterval`, `setTimeout`, or subscription MUST return a cleanup function. Games with **NO CLEANUP** that need it:
   - CheckersGameScreen, ConnectFourGameScreen, DotMatchGameScreen, GomokuMasterGameScreen, HexGameScreen, LightsOutGameScreen, Play2048GameScreen, TicTacToeGameScreen

---

## Section 2: Visual Polish — Make Every Game Beautiful

### Problem

Many games look "programmer art" — flat colors, no gradients, no shadows, no animations on state transitions. This is a consumer social app competing with GamePigeon; games must feel premium.

### Task

For **every game screen**:

1. **Board rendering** — Must use Skia with:
   - Subtle gradients on game surfaces (not flat `backgroundColor`)
   - Drop shadows on interactive elements (pieces, cards, tiles)
   - Rounded corners on all game UI elements
   - Consistent color palette that respects the app's dark/light theme

2. **Piece/element rendering** — Must have:
   - Smooth entrance animations (fade in, scale up) when pieces appear
   - Subtle bounce/spring animations on placement
   - Glow effects on selected/highlighted elements
   - Particle burst (`SkiaParticleBurst`) on important events (capture, clear line, score)

3. **Score/status displays** — Must have:
   - Animated score counters (numbers roll up, not just jump)
   - Pulse animation on score change
   - Timer displays with color change as time runs low (green → yellow → red)
   - Lives display with heart icons and shake animation on life loss

4. **Game over** — Must have:
   - Use `GameOverModal` consistently across ALL games (currently only 8/21 use it)
   - Confetti/particle celebration on win
   - Sad/shake animation on lose
   - Stats display (moves, time, score, personal best comparison)

5. **Transitions** — Must have:
   - Smooth fade between menu → playing → game over states
   - Countdown animation (3... 2... 1... GO!) for timed/multiplayer games
   - Board entrance animation on game start

6. **Theme consistency**:
   - All games must properly support dark mode AND light mode
   - Use `useTheme()` from react-native-paper for color tokens
   - Game-specific colors should derive from theme (e.g., board color = theme.colors.surfaceVariant)

### Specific Games Needing Visual Overhaul

Check each of these closely and rewrite their rendering if they look rough:

- **AirHockeyGameScreen** — Ensure puck and paddles have gradients, ice surface has subtle texture pattern
- **PoolGameScreen** — Pool table needs felt-green gradient, balls need 3D-looking sphere rendering with Skia radial gradients, number rendering on balls
- **ConnectFourGameScreen** — Board should look like physical Connect Four with depth/shadows on holes
- **DotMatchGameScreen** — Grid should have polished dot rendering, line drawing should be animated
- **HexGameScreen** — Hexagonal grid needs polished hex rendering with proper fills

---

## Section 3: Game Logic Debugging

### Problem

Many games have known logical issues — incorrect win detection, physics glitches, AI bugs, edge cases in game state machines.

### Task

For **every game**, verify the correctness of:

1. **State machine transitions**: menu → playing → paused → result. No impossible transitions. Pausing must stop all timers/loops. Resuming must restart them.

2. **Win/lose detection**: Every win condition must be correctly detected. Test mentally:
   - Chess: checkmate, stalemate, draw by repetition, draw by 50-move rule, draw by insufficient material
   - Checkers: no valid moves = loss, all pieces captured = loss
   - Connect Four: horizontal, vertical, diagonal (both directions) win detection
   - Gomoku: exactly 5 in a row (not 6+)
   - Reversi: game ends when neither player can move, most discs wins
   - Minesweeper: first click must never be a mine, flood-fill on zero cells, flag count tracking
   - 2048: game over only when no moves possible (no adjacent equal tiles AND no empty tiles)
   - Brick Breaker: level complete when all destructible bricks destroyed, ball stuck detection

3. **Physics correctness** (for physics games):
   - Pong: ball-paddle collision must use paddle contact point for angle, ball speed increases over time
   - Air Hockey: puck must respect table boundaries, goals must be properly detected
   - Pool: ball-ball and ball-cushion collisions, pocketing, cue ball scratch handling
   - Bounce Blitz: ball splitting, block damage, gravity

4. **Timer correctness**:
   - All timers must pause when app goes to background (`AppState` listener)
   - All timers must stop when game ends
   - Per-turn timers in multiplayer must count down correctly and trigger timeout

5. **Multiplayer state sync**:
   - Turn-based games: verify the Colyseus room validates moves server-side (not just client-side)
   - Card games: verify hands are truly private (only sent via targeted messages, not in room state)
   - Physics games: verify the server is authoritative (client sends input, server sends state)
   - Score race games: verify score updates are received from opponent in real-time

6. **Game Logic Files** (`src/services/games/`):
   - `chessLogic.ts` — Verify castling, en passant, promotion, check/checkmate/stalemate all work correctly
   - `crazyEightsLogic.ts` — Verify crazy eight wildcard suit selection, draw pile reshuffling, UNO-like rules
   - `brickBreakerLogic.ts` — Verify level generation, power-up spawning, ball physics, brick destruction
   - `snap2048Logic.ts` — Verify merge logic, scoring, move validation

---

## Section 4: Invite System Integration

### Problem

The game invite system (`src/services/gameInvites.ts`, 1,737 lines) supports creating, sending, accepting, and declining game invites. The `GamePickerModal` lets users start games from chat. But not all games properly handle being launched from an invite.

### Task

1. **Verify every multiplayer game screen** handles the invite flow:
   - Route params include `matchId` from invite acceptance
   - `useGameConnection(GAME_TYPE, route.params?.matchId)` resolves transport
   - Based on `resolvedMode`:
     - `"colyseus"` → connect to Colyseus room with `firestoreGameId`
     - `"online"` → use Firestore match subscription
   - If no `matchId` → show game menu (solo play or create invite)

2. **Verify the `GamePickerModal`** (`src/components/games/GamePickerModal.tsx`):
   - Lists all multiplayer games with correct metadata
   - Creates invites via `sendUniversalInvite()` from `src/services/gameInvites.ts`
   - For single-player games, navigates directly to game screen
   - Handles DM vs Group context correctly

3. **Verify invite card rendering** (`UniversalInviteCard`):
   - Shows game name, icon, sender, status
   - Accept/decline buttons work
   - Expired invites show as expired
   - Accepted invites navigate to the correct game screen with correct params

4. **Verify `FriendPickerModal`** integration:
   - Every multiplayer game has a "Challenge Friend" button in its menu
   - The friend picker launches with correct game type
   - Selected friend triggers invite creation
   - Success feedback (snackbar or navigation to waiting screen)

5. **Verify `SpectatorInviteModal`** integration:
   - Every single-player game has "Invite to Watch" option
   - Creates spectator room via `useSpectator({ mode: "sp-host" })`
   - Sends spectator invite message to selected chat
   - Spectator link works — recipient taps → navigates to SpectatorViewScreen

6. **Missing games that should support invites but might not**:
   - Crossword — verify it has invite integration or is properly marked as single-player-only

---

## Section 5: Spectator System Integration

### Problem

The spectator system has two modes:

1. **Single-player spectating** — Host creates a SpectatorRoom, pushes state; spectators view via SpectatorViewScreen
2. **Multiplayer spectating** — Spectator joins the game room with `{ spectator: true }`

Only 10/21 games currently integrate with the spectator system.

### Task

1. **For every single-player game** (all 10 single-player games):
   - Add `useSpectator({ mode: "sp-host", gameType })` hook
   - Call `spectator.updateGameState(serializedState)` on every state change
   - Call `spectator.startHosting()` when game starts
   - Call `spectator.endHosting()` when game ends
   - Render `<SpectatorOverlay>` showing viewer count
   - Wire up the "Invite to Watch" flow

2. **For every multiplayer game** (all 11 multiplayer games):
   - The Colyseus base rooms already support spectators (join with `{ spectator: true }`)
   - Ensure the game screen renders `<SpectatorBanner>` when `isSpectator` is true
   - Ensure game controls are disabled for spectators
   - Show spectator count badge via `<SpectatorOverlay>`

3. **SpectatorViewScreen** (`src/screens/games/SpectatorViewScreen.tsx`):
   - Verify it correctly connects to SpectatorRoom
   - Verify it renders the correct `SpectatorGameRenderer` for each game type
   - Verify the stats bar (score, level, lives) displays correctly

4. **Missing spectator renderers** — Create renderers for these games:
   - Each renderer takes `{ gameState, width, score, level, lives }` and renders a read-only view
   - Use the same Skia rendering as the game screen but without interactive controls
   - Follow the pattern in existing renderers like `BrickBreakerSpectatorRenderer.tsx`

---

## Section 6: Multiplayer Hook Consistency

### Problem

There are 4 multiplayer hook families. They should all follow identical patterns for connection, reconnection, phase management, and error handling.

### Task

1. **Audit `useMultiplayerGame`** (score race):
   - Connection lifecycle: idle → connecting → waiting → countdown → playing → finished
   - Reconnection on app foreground via `useColyseusAppState`
   - Score reporting via `reportScore(n)` / `reportFinished()`
   - Rematch flow
   - Error handling with logger (not console.error)

2. **Audit `useTurnBasedGame`**:
   - Connection lifecycle: idle → connecting → waiting → countdown → playing → finished
   - Board state sync from Colyseus state
   - Turn management: `isMyTurn`, `sendMove(move)`
   - Draw offer / resignation flow
   - Move history sync
   - Reconnection (5-min window)
   - Firestore fallback for Colyseus-down scenarios

3. **Audit `useCardGame`**:
   - Private hand management (received via targeted message, NOT in room state)
   - Actions: playCard, drawCard, pass, resign
   - Suit selection for wild cards (Crazy Eights)

4. **Audit `usePhysicsGame`**:
   - Server-authoritative physics — client sends input, server sends ball/paddle state
   - Input normalization (0-1 coordinates)
   - Smooth interpolation of server state updates
   - Score tracking

5. **Ensure all 4 hooks**:
   - Use `createLogger()` (not console.\*)
   - Handle the `AppState` change (background → reconnect)
   - Clean up room subscription on unmount
   - Provide consistent loading/error/phase states to game screens
   - Have consistent return type shapes

6. **Game-specific multiplayer hooks** (`useCrosswordMultiplayer`, `useWordMasterMultiplayer`):
   - Verify they properly extend or wrap the generic hooks
   - Check for duplicated logic that should be in the base hooks

---

## Section 7: Colyseus Server Room Consistency

### Task

1. **For every room** in `colyseus-server/src/rooms/`:
   - Verify it extends the correct base room
   - Verify `onCreate`, `onJoin`, `onLeave`, `onDispose` are all implemented
   - Verify reconnection handling is consistent (use `allowReconnection`)
   - Verify move validation is SERVER-SIDE (not trusting client)
   - Verify score/result submission to Firebase uses the persistence service consistently
   - Fix all `as any` casts

2. **Base rooms** (`colyseus-server/src/rooms/base/`):
   - `TurnBasedRoom.ts` — Verify draw offer/accept/decline, resign, timeout, reconnection
   - `ScoreRaceRoom.ts` — Verify countdown, score reporting, winner determination, lives system
   - `PhysicsRoom.ts` — Verify physics loop, input handling, score tracking
   - `CardGameRoom.ts` — Verify hand distribution, card play validation, turn management

3. **Schemas** (`colyseus-server/src/schemas/`):
   - Verify all schema fields are properly decorated with `@type()`
   - Verify schemas match what the client hooks expect
   - Check for unused schema fields (dead code)

4. **Services** (`colyseus-server/src/services/`):
   - `firebase.ts` — Firebase Admin initialization
   - `persistence.ts` — Game result persistence to Firestore
   - `validation.ts` — Input validation utilities
   - Verify all rooms use these services consistently

---

## Section 8: Game-Over & Results Flow

### Problem

Only 8/21 games use the shared `GameOverModal`. Others have ad-hoc game-over UIs or `Alert.alert()` calls. The game-over experience should be consistent and polished.

### Task

1. **Replace ALL custom game-over UIs** with `GameOverModal`:
   - Read `src/components/games/GameOverModal.tsx` to understand its interface
   - It accepts: `visible`, `result` (GameResult), `onPlayAgain`, `onExit`, `onShare`, `personalBest`
   - Wire it up in every game screen

2. **Ensure every game records its session**:
   - Single-player: call `recordSinglePlayerSession()` from `src/services/singlePlayerSessions.ts`
   - Multiplayer: the Colyseus server handles this via persistence service
   - Verify the session includes: gameType, score, duration, won/lost/draw, moves count

3. **Ensure every game sends a scorecard**:
   - After game completion, offer to send a scorecard message to chat
   - Use `sendScorecard()` from `src/services/games.ts`
   - The scorecard should show: game name, score, personal best indicator, invite to play

4. **Personal best tracking**:
   - Every game should check and display personal best on game over
   - Use `getPersonalBest()` from `src/services/games.ts`
   - Show "🏆 New Personal Best!" celebration when beaten

---

## Section 9: Input Handling Consistency

### Problem

Some games use legacy `PanResponder` (from RN Animated), others use modern `GestureDetector` (from react-native-gesture-handler). Input handling should be consistent.

### Task

1. **Migrate all PanResponder usage to GestureDetector**:
   - Pong, Pool, Air Hockey likely use PanResponder for paddle/cue control
   - Brick Breaker likely uses PanResponder for paddle
   - Replace with `Gesture.Pan()` from react-native-gesture-handler
   - This gives smoother gesture recognition and works better with Reanimated

2. **Standardize touch input patterns**:
   - Board games (Chess, Checkers, etc.): Tap to select, tap to place. Use `Gesture.Tap()`
   - Swipe games (2048): Use `Gesture.Fling()` with directional detection
   - Drag games (Pong, AirHockey, Pool): Use `Gesture.Pan()` with `onUpdate`
   - Tap games (Reaction, Timed, Minesweeper): Use `Pressable` or `Gesture.Tap()`

3. **Gesture conflict resolution**:
   - Games inside `ScrollView` need `simultaneousHandlers` to prevent scroll/game conflicts
   - Games with multiple gesture zones need `Gesture.Exclusive()` or `Gesture.Simultaneous()`

---

## Section 10: Performance Audit

### Task

1. **Animation frame management**:
   - Games using `requestAnimationFrame` + `setState` are causing full re-renders at 60fps
   - Migrate game loops to use Reanimated shared values where possible
   - For complex physics (Pong, AirHockey, Pool), keep rAF but ensure state updates are batched

2. **Skia Canvas optimization**:
   - Verify each Skia `<Canvas>` has a fixed size (not flex-based resizing)
   - Use `<Picture>` for static elements that don't change frame-to-frame
   - Avoid re-creating Skia Paint objects on every render

3. **Memoization**:
   - Game board rendering should use `useMemo` for expensive computations
   - `useCallback` for all handlers passed to child components
   - Event handlers in game loops should NOT be recreated on every render

4. **Memory leaks**:
   - Verify no game accumulates state infinitely (e.g., move history growing without bound)
   - Verify all subscriptions and listeners are cleaned up
   - Verify Colyseus room `.leave()` is called on unmount

---

## Section 11: Dark/Light Theme Compliance

### Task

1. For every game screen:
   - Verify ALL colors come from `useTheme()` or `useColors()` — no hardcoded hex colors
   - Exception: game-specific colors (chess piece colors, pool ball colors) can be hardcoded but should use theme-aware variants for backgrounds/surfaces
   - Board backgrounds should use `theme.colors.surfaceVariant`
   - Text should use `theme.colors.onSurface` or `theme.colors.onBackground`
   - Borders should use `theme.colors.outlineVariant`

2. Test rendering mentally in both themes:
   - Dark mode: game elements visible against dark backgrounds
   - Light mode: game elements visible against light backgrounds
   - No "invisible" elements in either theme

---

## Section 12: Accessibility

### Task

1. Add `accessibilityLabel` to all interactive game elements
2. Add `accessibilityRole="button"` to tappable areas
3. Add `accessibilityHint` for non-obvious controls
4. Ensure game-over state is announced to screen readers
5. Ensure haptic feedback accompanies all visual-only state changes

---

## Execution Rules

1. **Work through Sections 1-12 in order**
2. **Batch changes per section**, then verify: `npx tsc --noEmit`
3. **For the Colyseus server**: `cd colyseus-server && npx tsc --noEmit`
4. **Never break types** — zero TypeScript errors after every section
5. **Never break gameplay** — all changes must be behavior-preserving unless fixing a bug
6. **Be thorough** — if a section says "every game", check every single one of the 21 games
7. **Make it beautiful** — when in doubt, add a gradient, a shadow, or a spring animation
8. **Run until done** — complete all 12 sections before stopping

---

## Verification Checklist

After completing all sections:

- [ ] `npx tsc --noEmit` — zero errors (client)
- [ ] `cd colyseus-server && npx tsc --noEmit` — zero errors (server)
- [ ] All 21 game screens use `useGameBackHandler`
- [ ] All 21 game screens use `useGameHaptics` with appropriate events
- [ ] All 21 game screens use `GameOverModal` for game-over
- [ ] All 21 game screens have cleanup in every `useEffect` that creates timers/subscriptions
- [ ] All 21 game screens have `GameErrorBoundary` wrapping
- [ ] All 21 game screens properly support dark AND light theme
- [ ] All 11 multiplayer games handle invite flow via `useGameConnection`
- [ ] All 10 single-player games have spectator hosting via `useSpectator`
- [ ] All 11 multiplayer games have spectator viewing support
- [ ] No `PanResponder` usage remains — all migrated to `GestureDetector`
- [ ] No `console.log/warn/error` — all use `createLogger()`
- [ ] No `as any` in game screens or hooks
- [ ] All game logic files have correct win/lose detection
- [ ] All Colyseus rooms validate moves server-side
- [ ] All games record sessions and offer scorecard sending
- [ ] Spectator renderers exist for all game types
- [ ] Every Skia Canvas renders with gradients, shadows, and polish — no flat/ugly game UIs
