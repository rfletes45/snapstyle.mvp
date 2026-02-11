# Codex Games System — Pass 2: Finish All Remaining Work

> **For**: OpenAI Codex (codex-5.3)
> **Repository**: `snapstyle-mvp` — React Native + Expo social app called "Vibe"
> **Date**: February 2026
> **Objective**: Complete every remaining gap from the first games review pass

---

## Context — What Pass 1 Already Completed ✅

Do **not** redo these — they are verified done:

| Item                                                                                          | Status         |
| --------------------------------------------------------------------------------------------- | -------------- |
| `useGameBackHandler` in all 32 game screens                                                   | ✅ 32/32       |
| `useGameHaptics` in all 32 game screens                                                       | ✅ 32/32       |
| `useGameCompletion` in all 32 game screens                                                    | ✅ 32/32       |
| `GameOverModal` in all 32 game screens                                                        | ✅ 32/32       |
| `GameErrorBoundary` wrapping all 32 game screens                                              | ✅ 32/32       |
| `PanResponder` → `GestureDetector` migration (all game screens)                               | ✅ 0 remaining |
| TODO/FIXME markers in all TS/TSX code                                                         | ✅ 0 remaining |
| `sendScorecard()` / `sendSpectatorInvite()` / `sendGroupSpectatorInvite()` → outbox migration | ✅             |
| Timeout teardown patterns in 11 targeted screens                                              | ✅             |
| Dead-export cleanup of `featureFlags.ts` (`SHOW_V2_BADGE`, `DEBUG_CHAT_KEYBOARD`)             | ✅             |
| `as any` in game screens and hooks                                                            | ✅ 0 remaining |

**Everything below is UNFINISHED and needs your attention.**

---

## Tech Stack (Ground Truth)

| Technology                       | Version                             | Purpose                                                             |
| -------------------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| **@shopify/react-native-skia**   | ^2.2.12                             | Primary 2D game renderer — all boards, pieces, particles, gradients |
| **three**                        | ^0.166.1                            | 3D visuals for Games Hub background ONLY (never for gameplay)       |
| **react-native-reanimated**      | ~4.1.1                              | 60fps UI animations, shared values, worklets                        |
| **react-native-gesture-handler** | ~2.28.0                             | Touch/pan/pinch gesture handling                                    |
| **expo-haptics**                 | ~15.0.8                             | Tactile feedback                                                    |
| React Native                     | 0.81.5                              | Mobile framework                                                    |
| Expo SDK                         | 54                                  | Build toolchain                                                     |
| React                            | 19.1.0                              | UI library                                                          |
| TypeScript                       | ~5.9.2                              | Type safety (`strict: true`)                                        |
| Firebase                         | 12.8.0                              | Auth, Firestore, Storage                                            |
| Colyseus SDK                     | 0.17.31 (client) / 0.17.35 (server) | Real-time multiplayer                                               |
| Path alias                       | `@/*` → `src/*`                     | Import paths                                                        |

### Rendering Rules

- **All game boards, pieces, balls, paddles, particles MUST use Skia** (`@shopify/react-native-skia`)
- **Reanimated shared values** should drive animations (not `requestAnimationFrame` + `setState`)
- **GestureDetector** from `react-native-gesture-handler` for all touch inputs
- Every game should provide **haptic feedback** via `useGameHaptics`

### Skia Primitives Available (`src/components/games/graphics/`)

`SkiaGameBoard`, `SkiaChessPieces`, `SkiaCheckersPiece`, `SkiaTicTacToePieces`, `SkiaDisc`, `SkiaCellHighlight`, `SkiaWinLine`, `Skia2048Tile`, `SkiaMinesweeperCell`, `SkiaParticleBurst`

### Client Logger (`src/utils/log.ts`)

```typescript
import { createLogger } from "@/utils/log";
const log = createLogger("GameScreenName");
log.info("Message", { operation: "method", data: { key: value } });
log.error("Failed", error, { operation: "method" });
```

**ALL game screens and hooks MUST use `createLogger()` — never raw `console.log/warn/error`.**

---

## Section 1: Spectator System — Wire Up All 19 Missing Games (🔴 CRITICAL)

### Current State

Only **13/32** game screens have the `useSpectator` hook, `SpectatorOverlay`, `SpectatorBanner`, and `SpectatorInviteModal` wired up.

**13 screens WITH full spectator support** (all single-player, all have `useSpectator` + `SpectatorOverlay` + `SpectatorInviteModal`):
BounceBlitz, BrickBreaker, LightsOut, MemoryMaster, Minesweeper, NumberMaster, Play2048, Pong, ReactionTap, SnakeMaster, TileSlide, TimedTap, WordMaster

**19 screens MISSING spectator support:**

| #   | Game Screen            | SP or MP?       | Has SpectatorOverlay/Banner?     | Has SpectatorInviteModal? | Has Spectator Renderer? |
| --- | ---------------------- | --------------- | -------------------------------- | ------------------------- | ----------------------- |
| 1   | AirHockeyGameScreen    | MP (physics)    | ❌                               | ❌                        | ❌                      |
| 2   | CheckersGameScreen     | MP (turn-based) | ✅ (partial — via Colyseus hook) | ❌                        | ❌                      |
| 3   | ChessGameScreen        | MP (turn-based) | ✅ (partial — via Colyseus hook) | ❌                        | ❌                      |
| 4   | ConnectFourGameScreen  | MP (turn-based) | ❌                               | ❌                        | ❌                      |
| 5   | CrazyEightsGameScreen  | MP (card)       | ✅ (partial — via Colyseus hook) | ❌                        | ❌                      |
| 6   | CrosswordGameScreen    | MP (real-time)  | ❌                               | ❌                        | ❌                      |
| 7   | DotMatchGameScreen     | MP (turn-based) | ❌                               | ❌                        | ❌                      |
| 8   | GomokuMasterGameScreen | MP (turn-based) | ❌                               | ❌                        | ❌                      |
| 9   | HexGameScreen          | MP (turn-based) | ❌                               | ❌                        | ❌                      |
| 10  | MatchGameScreen        | ??? (see §1a)   | ❌                               | ❌                        | ❌                      |
| 11  | PoolGameScreen         | MP (physics)    | ❌                               | ❌                        | ❌                      |
| 12  | RaceGameScreen         | MP (real-time)  | ❌                               | ❌                        | ❌                      |
| 13  | ReversiGameScreen      | MP (turn-based) | ❌                               | ❌                        | ❌                      |
| 14  | SliceGameScreen        | ??? (see §1a)   | ❌                               | ❌                        | ❌                      |
| 15  | TapTapGameScreen       | ??? (see §1a)   | ❌                               | ❌                        | ❌                      |
| 16  | TargetMasterGameScreen | ??? (see §1a)   | ❌                               | ❌                        | ❌                      |
| 17  | TicTacToeGameScreen    | MP (turn-based) | ✅ (partial — via Colyseus hook) | ❌                        | ❌                      |
| 18  | WarGameScreen          | MP (card)       | ❌                               | ❌                        | ❌                      |
| 19  | WordsGameScreen        | ??? (see §1a)   | ❌                               | ❌                        | ❌                      |

### §1a — Unregistered Game Types (Fix First!)

These 5 games use game type strings that are **NOT registered** in `src/types/games.ts`:

| Game Screen            | Uses gameType     | Registered in types? | Registered in GAME_METADATA? |
| ---------------------- | ----------------- | -------------------- | ---------------------------- |
| MatchGameScreen        | `"match"`         | ❌ NOT in any union  | ❌ NOT in GAME_METADATA      |
| SliceGameScreen        | `"slice"`         | ❌                   | ❌                           |
| TapTapGameScreen       | `"tap_tap"`       | ❌                   | ❌                           |
| TargetMasterGameScreen | `"target_master"` | ❌                   | ❌                           |
| WordsGameScreen        | `"words"`         | ❌                   | ❌                           |

**Fix**: Add these 5 to the `SinglePlayerGameType` union in `src/types/games.ts` and add their `GAME_METADATA` entries. They are all single-player games:

- `"match"` → Match (memory/card matching variant), category: `"puzzle"`, single-player
- `"slice"` → Slice (fruit-ninja style), category: `"quick_play"`, single-player
- `"tap_tap"` → Tap Tap (tap game variant), category: `"quick_play"`, single-player
- `"target_master"` → Target Master (target shooting), category: `"quick_play"`, single-player
- `"words"` → Words (word grid), category: `"daily"`, single-player

After adding these 5, the `SinglePlayerGameType` union should have **18 types** total.

### §1b — For All 5 Newly-Registered Single-Player Games + Any Others That Are SP

These are single-player and need **SP host** spectator wiring:

1. **Add `useSpectator({ mode: "sp-host", gameType: "GAME_TYPE" })`** to each screen
2. **Call `spectator.startHosting()`** when the game begins
3. **Call `spectator.updateGameState(JSON.stringify(state), score, level, lives)`** on every meaningful state change
4. **Call `spectator.endHosting(finalScore)`** when the game ends
5. **Render `<SpectatorOverlay>`** for viewer count
6. **Render `<SpectatorInviteModal>`** with "Invite to Watch" button
7. **Create a spectator renderer** in `src/components/games/spectator-renderers/`

**Follow the exact pattern used by the 13 existing screens** (e.g., `BrickBreakerGameScreen.tsx` for a good SP example).

### §1c — For All Multiplayer Games Missing Spectator

For multiplayer games, spectators join the Colyseus room with `{ spectator: true }`. The base rooms already track spectators in `state.spectators`.

For each MP game screen missing spectator:

1. **Read the `isSpectator` flag** from the multiplayer hook (e.g., `useTurnBasedGame`, `useCardGame`, `usePhysicsGame` — they should already provide this or can be derived from the room state)
2. **Add `useSpectator({ mode: "multiplayer-spectator", room, state })`** to get spectator count and list
3. **Render `<SpectatorBanner>`** when `isSpectator === true` ("You are spectating")
4. **Disable all interactive controls** when spectating (tap/gesture handlers should be no-ops)
5. **Render `<SpectatorOverlay>`** showing viewer count badge
6. **Create a spectator renderer** (for when this game is being watched via SpectatorViewScreen)

**4 screens (Checkers, Chess, CrazyEights, TicTacToe) already have partial spectator UI** via their Colyseus multiplayer hooks — they render `SpectatorBanner`/`SpectatorOverlay` but DON'T call `useSpectator` and DON'T have `SpectatorInviteModal`. Complete their wiring.

### §1d — Create 19 Missing Spectator Renderers

**Current spectator renderers** (13 exist in `src/components/games/spectator-renderers/`):
BounceBlitz, BrickBreaker, LightsOut, MemoryMaster, Minesweeper, NumberMaster, Play2048, Pong, ReactionTap, Snake, TileSlide, TimedTap, WordMaster

**Create renderers for ALL 19 missing games:**

Each renderer must:

- Export a named component: `XxxSpectatorRenderer`
- Accept `SpectatorRendererProps` from `./types.ts`: `{ gameState, width, score, level, lives }`
- Render a **read-only Skia view** of the game (same rendering as game screen, but no interactive controls)
- Use the same board/piece rendering logic as the game screen (import from shared logic files where possible)
- Follow the pattern in `BrickBreakerSpectatorRenderer.tsx` (303 lines — it's a good reference)

After creating each renderer, **register it** in `src/components/games/spectator-renderers/index.tsx`:

- Add the import
- Add the entry to the `RENDERERS` map with the correct game type key

**Game type keys for the RENDERERS map** (must match `ExtendedGameType` strings):

| Game         | Key for RENDERERS map               |
| ------------ | ----------------------------------- |
| AirHockey    | `"air_hockey"`                      |
| Checkers     | `"checkers"`                        |
| Chess        | `"chess"`                           |
| ConnectFour  | `"connect_four"`                    |
| CrazyEights  | `"crazy_eights"`                    |
| Crossword    | `"crossword_puzzle"`                |
| DotMatch     | `"dot_match"`                       |
| Gomoku       | `"gomoku_master"`                   |
| Hex          | `"hex"` ← verify actual type string |
| Match        | `"match"`                           |
| Pool         | `"8ball_pool"`                      |
| Race         | `"race_game"`                       |
| Reversi      | `"reversi_game"`                    |
| Slice        | `"slice"`                           |
| TapTap       | `"tap_tap"`                         |
| TargetMaster | `"target_master"`                   |
| TicTacToe    | `"tic_tac_toe"`                     |
| War          | `"war_game"`                        |
| Words        | `"words"`                           |

### §1e — Verify SpectatorViewScreen

After wiring all 32 screens and creating all 32 renderers:

- Read `src/screens/games/SpectatorViewScreen.tsx`
- Verify it uses `SpectatorGameRenderer` which maps to the `RENDERERS` object
- Verify all 32 game type keys are present in the `RENDERERS` map
- Verify the stats bar (score, level, lives) works for all game types

---

## Section 2: Migrate Legacy `Animated.Value` → Reanimated (🟡 MEDIUM)

### Current State

**22 instances of `new Animated.Value` or `new Animated.ValueXY`** across **12 game screens**:

| Screen                 | Count | Usage                                     |
| ---------------------- | ----- | ----------------------------------------- |
| PongGameScreen         | 3     | ball position (ValueXY), paddle positions |
| WordMasterGameScreen   | 5     | shake anim, cell flip animations          |
| TargetMasterGameScreen | 2     | target appear/hit animations              |
| TicTacToeGameScreen    | 3     | scale, bounce, fade                       |
| TimedTapGameScreen     | 2     | scale + button color                      |
| ReactionTapGameScreen  | 1     | pulse animation                           |
| CrazyEightsGameScreen  | 1     | scale animation                           |
| CheckersGameScreen     | 1     | scale animation                           |
| LightsOutGameScreen    | 1     | scale animation                           |
| MemoryMasterGameScreen | 1     | card flip animation                       |
| WarGameScreen          | 1     | card flip animation                       |
| ChessGameScreen        | 1     | scale animation                           |

### Task

For each screen:

1. **Replace `new Animated.Value()`** with `useSharedValue()` from `react-native-reanimated`
2. **Replace `Animated.timing()` / `Animated.spring()`** with `withTiming()` / `withSpring()` from Reanimated
3. **Replace `Animated.View`** with `Animated` from Reanimated (it's a different import)
4. **Use `useAnimatedStyle()`** instead of `style={{ transform: [{ scale: animValue }] }}`
5. **Remove `import { Animated } from "react-native"`** when no longer needed

### Migration Pattern

```typescript
// BEFORE (legacy RN Animated):
import { Animated } from "react-native";
const scaleAnim = useRef(new Animated.Value(0)).current;
Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
<Animated.View style={{ transform: [{ scale: scaleAnim }] }}>

// AFTER (Reanimated):
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
const scale = useSharedValue(0);
scale.value = withSpring(1);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
}));
<Animated.View style={animatedStyle}>
```

**Important**: For `Animated.ValueXY` (used in PongGameScreen for ball position), replace with two separate `useSharedValue` calls (one for x, one for y).

---

## Section 3: Migrate 6 View-Only Game Boards to Skia (🟡 MEDIUM)

### Current State

**6 game screens render their boards using plain `<View>` with `backgroundColor` instead of Skia Canvas:**

1. **CheckersGameScreen** — Board grid + pieces use `<View>` with colored backgrounds
2. **ChessGameScreen** — Board grid + pieces use `<View>` with colored backgrounds
3. **ConnectFourGameScreen** — Board grid + discs use `<View>` with colored backgrounds
4. **MinesweeperGameScreen** — Cell grid uses `<View>` with colored backgrounds
5. **Play2048GameScreen** — Tile grid uses `<View>` with colored backgrounds
6. **TicTacToeGameScreen** — Grid + X/O pieces use `<View>` with colored backgrounds

### Task

For each of these 6 screens:

1. **Replace the `<View>`-based board rendering** with Skia `<Canvas>` using the existing Skia primitives:
   - Chess → `SkiaGameBoard` + `SkiaChessPieces` (already exist in `src/components/games/graphics/`)
   - Checkers → `SkiaGameBoard` + `SkiaCheckersPiece` (already exist)
   - TicTacToe → `SkiaGameBoard` + `SkiaTicTacToePieces` (already exist)
   - ConnectFour → `SkiaGameBoard` + `SkiaDisc` (already exist)
   - Minesweeper → `SkiaGameBoard` + `SkiaMinesweeperCell` (already exist)
   - Play2048 → `Skia2048Tile` (already exists)

2. **Add visual polish** during the migration:
   - Subtle gradients on board surfaces
   - Drop shadows on pieces
   - Glow effects on selected/highlighted cells using `SkiaCellHighlight`
   - Animated winning line using `SkiaWinLine` (for TicTacToe, ConnectFour, Gomoku)

3. **Keep touch handling working** — the `GestureDetector` layer sits above the `<Canvas>`, so gesture handlers should continue to work. The Skia Canvas is for rendering only.

### Reference

Read `BrickBreakerGameScreen.tsx` for a good example of Skia Canvas rendering with gradients, shadows, and physics objects. Read the Skia primitives in `src/components/games/graphics/` to understand their interfaces before using them.

---

## Section 4: Add `SkiaParticleBurst` Celebration Effects (🟡 MEDIUM)

### Current State

**0/32 game screens** use `SkiaParticleBurst` despite it being available at `src/components/games/graphics/SkiaParticleBurst`.

### Task

For **every game screen** (all 32):

1. **Read `SkiaParticleBurst`** to understand its interface (it takes position, colors, and a trigger)
2. **Add particle burst on key celebration moments:**
   - **Win / game complete** — Large burst at center of screen
   - **Personal best beaten** — Extra-large burst with gold colors
   - **Score milestone** (e.g., every 100 points, or clearing a level) — Medium burst at score location
   - **Piece capture** (Chess, Checkers) — Small burst at captured piece location
   - **Line clear** (Connect Four, Gomoku) — Burst along the winning line
   - **Brick destroyed** (Brick Breaker) — Small burst at brick location (may already be partially implemented)
   - **Card match** (Memory Master, Match) — Burst at matched card pair
   - **Word found** (Word Master, Crossword, Words) — Burst at word location

3. **Choose appropriate colors:**
   - Win: gold (`#FFD700`), white, game's accent color
   - Lose: skip (no celebration)
   - Score: game's accent color, white
   - Capture: opponent's piece color

---

## Section 5: Colyseus Server — Structured Logging (🟡 MEDIUM)

### Current State

The Colyseus server (`colyseus-server/src/`) has **125 raw `console.log` / `console.warn` calls** and **zero structured logging**. No `createLogger` utility exists in the server codebase.

### Task

1. **Create `colyseus-server/src/utils/logger.ts`** — a minimal structured logger for the server:

```typescript
/**
 * Simple structured logger for Colyseus server.
 * Wraps console with source tags and JSON context.
 */
export function createServerLogger(source: string) {
  const tag = `[${source}]`;
  return {
    info: (msg: string, ctx?: Record<string, unknown>) =>
      console.log(tag, msg, ctx ? JSON.stringify(ctx) : ""),
    warn: (msg: string, ctx?: Record<string, unknown>) =>
      console.warn(tag, msg, ctx ? JSON.stringify(ctx) : ""),
    error: (msg: string, err?: unknown, ctx?: Record<string, unknown>) =>
      console.error(tag, msg, err, ctx ? JSON.stringify(ctx) : ""),
    debug: (msg: string, ctx?: Record<string, unknown>) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(tag, "[DEBUG]", msg, ctx ? JSON.stringify(ctx) : "");
      }
    },
  };
}
```

2. **Replace all 125 `console.log/warn/error` calls** across all Colyseus server files with `createServerLogger`:

| File                          | console calls | Logger source tag    |
| ----------------------------- | ------------- | -------------------- |
| `rooms/base/TurnBasedRoom.ts` | 19            | `"TurnBasedRoom"`    |
| `rooms/base/ScoreRaceRoom.ts` | 14            | `"ScoreRaceRoom"`    |
| `rooms/base/PhysicsRoom.ts`   | 14            | `"PhysicsRoom"`      |
| `rooms/SpectatorRoom.ts`      | 11            | `"SpectatorRoom"`    |
| `rooms/CrosswordRoom.ts`      | 9             | `"CrosswordRoom"`    |
| `rooms/WordMasterRoom.ts`     | 9             | `"WordMasterRoom"`   |
| `rooms/SnakeRoom.ts`          | 7             | `"SnakeRoom"`        |
| `rooms/BounceBlitzRoom.ts`    | 4             | `"BounceBlitzRoom"`  |
| `rooms/BrickBreakerRoom.ts`   | 4             | `"BrickBreakerRoom"` |
| `rooms/RaceRoom.ts`           | 4             | `"RaceRoom"`         |
| `rooms/base/CardGameRoom.ts`  | 3             | `"CardGameRoom"`     |
| `services/firebase.ts`        | ~8            | `"Firebase"`         |
| `services/persistence.ts`     | ~10           | `"Persistence"`      |
| `services/validation.ts`      | ~8            | `"Validation"`       |
| Other rooms (smaller counts)  | ~remainder    | Room name as tag     |

3. **Pattern**: For each file:
   - Add `import { createServerLogger } from "../utils/logger";` (adjust path)
   - Add `const log = createServerLogger("RoomName");` at file top
   - Replace `console.log(...)` → `log.info(...)` with structured context
   - Replace `console.warn(...)` → `log.warn(...)`
   - Replace `console.error(...)` → `log.error(...)`

---

## Section 6: Client-Side Console Cleanup (🟢 LOW)

### Current State

**3 remaining `console.error` calls** in game screens, **3 in hooks**:

| File                         | Line  | Call                    |
| ---------------------------- | ----- | ----------------------- |
| `MemoryMasterGameScreen.tsx` | L423  | `.catch(console.error)` |
| `WordMasterGameScreen.tsx`   | L1107 | `.catch(console.error)` |
| `WordMasterGameScreen.tsx`   | L1151 | `.catch(console.error)` |
| `useProfileData.ts`          | L151  | `console.log`           |
| `useProfileData.ts`          | L168  | `console.log`           |
| `useProfileData.ts`          | L279  | `console.log`           |

### Task

1. Replace all `.catch(console.error)` with `.catch((err) => log.error("Description", err))`
2. Replace all `console.log` in `useProfileData.ts` with `createLogger("useProfileData")` calls
3. After fixing, verify zero `console.` calls remain in `src/screens/games/` and `src/hooks/`

---

## Section 7: Accessibility — All 32 Game Screens (🟡 MEDIUM)

### Current State

Only **7/32 game screens** have ANY accessibility attributes:
ConnectFour (2), DotMatch (3), GomokuMaster (2), LightsOut (4), Minesweeper (5), NumberMaster (2), ReactionTap (1)

**25/32 screens have ZERO accessibility attributes.**

### Task

For **every game screen** (all 32):

1. **Add `accessibilityLabel`** to all interactive elements:
   - Board cells: `accessibilityLabel={`Row ${row}, Column ${col}`}`
   - Game pieces: `accessibilityLabel={`${pieceType} at ${position}`}`
   - Buttons: `accessibilityLabel="Start Game"`, `"Pause"`, `"Resume"`, etc.
   - Score display: `accessibilityLabel={`Score: ${score}`}`
   - Timer display: `accessibilityLabel={`Time remaining: ${time} seconds`}`

2. **Add `accessibilityRole`**:
   - Tappable cells/buttons: `accessibilityRole="button"`
   - Score/timer text: `accessibilityRole="text"`
   - Game board container: `accessibilityRole="none"` (to group child elements)

3. **Add `accessibilityHint`** for non-obvious controls:
   - Board cells: `accessibilityHint="Double tap to place piece"`
   - Swipeable areas: `accessibilityHint="Swipe to move tiles"`

4. **Announce state changes**:
   - Use `AccessibilityInfo.announceForAccessibility()` for:
     - Turn changes ("Your turn" / "Opponent's turn")
     - Game over ("Game over. You won!" / "Game over. You lost.")
     - Score changes (announce new score)

5. **Ensure game-over state is announced** to screen readers via the `GameOverModal`

---

## Section 8: Dark/Light Theme Audit (🟢 LOW)

### Current State

All 32 screens import theme hooks (`useTheme`, `useColors`, or ThemeContext). However, many games may have **hardcoded hex colors** that look wrong in one theme.

### Task

For each game screen:

1. **Search for hardcoded hex colors** (e.g., `"#FFFFFF"`, `"#000000"`, `"rgba(..."`)
2. **Determine if each is game-specific or should be theme-aware:**
   - ✅ Game-specific (OK to hardcode): chess piece black/white, pool ball colors, card suit colors
   - ❌ Should be theme-aware: backgrounds, borders, text, overlays, status bars
3. **Replace theme-violating hardcoded colors** with theme tokens:
   - Background: `theme.colors.surface` or `theme.colors.background`
   - Text: `theme.colors.onSurface`
   - Borders: `theme.colors.outlineVariant`
   - Board surface: `theme.colors.surfaceVariant`
   - Active/selected: `theme.colors.primary`
4. **Test mentally in both themes** — no invisible elements in either dark or light mode

---

## Section 9: Dead Game-Related Export Cleanup (🟢 LOW)

### Current State

`ts-prune` reports **~132 potentially unused game-related exports** across `src/types/games.ts`, `src/hooks/`, and `src/services/`. Not all are truly dead (some may be used dynamically or in tests).

### Task

1. **Run `npx ts-prune --project tsconfig.json 2>&1`** and filter for game-related files
2. **For each flagged export**, verify it's truly unused:
   - Search for the export name across the entire codebase (including tests, Colyseus server)
   - If used nowhere → remove the export
   - If used only in tests → keep it
   - If used dynamically (string interpolation, `Record<>` lookup) → keep it
3. **Focus on high-confidence removals** — don't remove anything you're unsure about
4. **Notable candidates** (from ts-prune):
   - `usePointsShop` — verify if used in any screen
   - `usePremiumShop` — verify if used in any screen
   - `useGameOverAchievements` — verify if used
   - `useMultiplayerAchievements` — verify if used
   - `PhysicsPlayerInfo`, `RacePlayerInfo` — verify if used by Colyseus schemas
   - `getGameDescription` — verify if used in UI
   - `PlayerGameStatsDocument`, `RecordGameResultInput`, `LeaderboardEntry` — verify usage

---

## Section 10: Visual Polish Pass (🟡 MEDIUM)

This section covers visual improvements BEYOND the Skia migration in Section 3.

### Task

For **every game screen** (all 32):

1. **Board/surface rendering:**
   - Replace flat `backgroundColor` surfaces with Skia gradients
   - Add subtle shadow/elevation to the game board container
   - Rounded corners on all game UI containers

2. **Piece/element rendering:**
   - Smooth entrance animations (scale from 0 → 1 with spring) when pieces appear
   - Subtle bounce animation on piece placement
   - Glow effect on selected/highlighted elements

3. **Score/status displays:**
   - Animated score counters (Reanimated `withTiming` on text scale)
   - Pulse animation on score change
   - Timer with color change: green → yellow → red as time runs low

4. **Game transitions:**
   - Smooth fade between menu → playing → game over states
   - Countdown animation (3... 2... 1... GO!) for timed/multiplayer games
   - Board entrance animation on game start (fade in + scale up)

5. **Specific games that likely need the most visual attention** (verify by reading them):
   - `AirHockeyGameScreen` — puck/paddles should have radial gradients for 3D look, ice surface pattern
   - `PoolGameScreen` — felt-green gradient table, balls with Skia radial gradients for sphere look, number rendering on balls
   - `ConnectFourGameScreen` — board should look like physical Connect Four with depth/holes
   - `DotMatchGameScreen` — polished dot rendering, animated line drawing
   - `WarGameScreen` — proper playing card rendering with suits, face cards, shadows
   - `HexGameScreen` — polished hexagonal grid with proper fills
   - `RaceGameScreen` — racing-themed UI with progress bars
   - `WordsGameScreen` — Scrabble-style tile rendering with letter scores

---

## Execution Rules

1. **Work through Sections 1-10 in order** (Section 1 is the largest and most critical)
2. **After each section**, run:
   - `npx tsc --noEmit` (client — zero errors)
   - `cd colyseus-server && npx tsc --noEmit` (server — zero errors, if server files changed)
3. **Never break existing gameplay** — all changes must be behavior-preserving unless fixing a bug
4. **Be thorough** — if a section says "every game", check every single one of the 32 games
5. **Follow existing patterns** — read the existing implementations before creating new ones
6. **Section 1 is the largest** — it requires creating 19 spectator renderers (each ~100-300 lines of Skia rendering), wiring `useSpectator` into 19 screens, and adding SpectatorInviteModal to 19 screens. Budget most of your time here.

---

## Verification Checklist

After completing all sections:

- [ ] `npx tsc --noEmit` — zero errors (client)
- [ ] `cd colyseus-server && npx tsc --noEmit` — zero errors (server)
- [ ] All 5 unregistered game types added to `SinglePlayerGameType` union and `GAME_METADATA`
- [ ] `useSpectator` in all 32 game screens (13 existing + 19 new)
- [ ] `SpectatorOverlay` rendered in all 32 game screens
- [ ] `SpectatorInviteModal` rendered in all 32 game screens (SP games: invite to watch; MP games: invite to spectate)
- [ ] Spectator renderers exist for all 32 game types in `src/components/games/spectator-renderers/`
- [ ] All 32 game type keys registered in `spectator-renderers/index.tsx` RENDERERS map
- [ ] Zero `new Animated.Value` in game screens — all migrated to Reanimated `useSharedValue`
- [ ] All 6 View-only boards migrated to Skia Canvas using existing Skia primitives
- [ ] `SkiaParticleBurst` used in all 32 game screens for celebration effects
- [ ] Zero `console.log/warn/error` in `src/screens/games/`, `src/hooks/`, and `colyseus-server/src/`
- [ ] `createServerLogger` utility created and used in all Colyseus server files
- [ ] Accessibility attributes (`accessibilityLabel`, `accessibilityRole`) on all interactive game elements in all 32 screens
- [ ] No hardcoded theme-violating colors — all backgrounds/text/borders use theme tokens
- [ ] Dead game-related exports removed (high-confidence only)
- [ ] Visual polish applied — gradients, shadows, entrance animations, score animations across all 32 screens
