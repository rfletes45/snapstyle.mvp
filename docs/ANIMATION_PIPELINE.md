# Animation Pipeline — Technical Reference

> **Status: RESOLVED.** Root cause identified and fixed. All three games (Tic-Tac-Toe, Connect Four, Chess) have been ported from `react-native-reanimated` to React Native's core `Animated` API with `useNativeDriver: true`, matching the architecture of the working 2048 game. See [Root Cause & Fix](#10-root-cause--fix-applied) below.

---

## Table of Contents

1. [Environment & Dependencies](#1-environment--dependencies)
2. [Architecture Overview](#2-architecture-overview)
3. [Tic-Tac-Toe Animations](#3-tic-tac-toe-animations)
4. [Connect Four Animations](#4-connect-four-animations)
5. [Chess Animations](#5-chess-animations)
6. [Shared Animation Components](#6-shared-animation-components)
7. [Summary of Animation Patterns Used](#7-summary-of-animation-patterns-used)
8. [What Has Been Tried](#8-what-has-been-tried)
9. [Symptom Description](#9-symptom-description)
10. [Root Cause & Fix Applied](#10-root-cause--fix-applied)

---

## 1. Environment & Dependencies

| Package                   | Version             |
| ------------------------- | ------------------- |
| `expo`                    | `~54.0.31`          |
| `react`                   | `19.1.0`            |
| `react-native`            | `0.81.5`            |
| `react-native-reanimated` | `~4.1.1`            |
| `react-native-svg`        | `15.12.1`           |
| `@expo/vector-icons`      | (bundled with Expo) |

### Babel Config

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      ["react-native-worklets-core/plugin"],
      // Reanimated must always be last
      "react-native-reanimated/plugin",
    ],
  };
};
```

The `react-native-reanimated/plugin` Babel plugin is present and positioned last, as required by the library.

---

## 2. Architecture Overview

All three games use a **Higher-Order Component** called `withGameV4Shell` that:

1. Subscribes to Firestore for the live game state.
2. Passes a `GameShellProps` object to the wrapped inner component.
3. Key props include: `publicState` (the game's Firestore document), `isMyTurn`, `isTerminal`, `myUid`, `turnOrder`, `players`, `submitMove`, `actionLoading`.

The inner component (e.g. `TicTacToeUI`) reads `publicState.board` and `publicState.moveCount` (or `publicState.plyCount` for chess) to derive the current board and detect new moves.

### Data Flow

```
Firestore document update
  → withGameV4Shell HOC receives new publicState
    → Inner component re-renders
      → "New move" detection happens (during render, synchronously)
        → Animated component receives animate=true / isNewDrop=true / justLanded=true
          → useEffect inside animated component fires withTiming / withSpring
            → Reanimated drives animation on UI thread
```

---

## 3. Tic-Tac-Toe Animations

**File:** `src/gamesV4/screens/TicTacToeScreenV4.tsx` (692 lines)

### 3.1 New-Move Detection (Synchronous / Ref-Based)

Detection happens **during the render function** (not inside a `useEffect`) via refs:

```tsx
const knownBoardRef = useRef<Board | null>(null);
const knownMoveCountRef = useRef<number | null>(null);
const lastMoveRef = useRef<{ row: number; col: number } | null>(null);

// First render: snapshot current board — existing cells are not "new"
if (knownBoardRef.current === null) {
  knownBoardRef.current = board.map((r) => [...r]);
  knownMoveCountRef.current = moveCount;
}

// Detect newly placed cell by diffing board against known snapshot
let newCellKey: string | null = null;
if (moveCount > knownMoveCountRef.current!) {
  const known = knownBoardRef.current!;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (known[r][c] === null && board[r][c] !== null) {
        newCellKey = `${r}-${c}`;
        lastMoveRef.current = { row: r, col: c };
      }
    }
  }
  knownBoardRef.current = board.map((r) => [...r]);
  knownMoveCountRef.current = moveCount;
}
```

The resulting `newCellKey` (e.g. `"1-2"`) is compared against each cell's `cellId` when rendering, and passed as `isNewMove` to the cell:

```tsx
<TicTacToeCell
  key={cellId} // stable key e.g. "0-0", "1-2", etc.
  isNewMove={newCellKey === cellId}
  // ... other props
/>
```

**Key strategy:** Cell keys are always stable (`"${r}-${c}"`). The cell is **not remounted** when its value changes — it is the same component instance that conditionally renders `AnimatedX` or `AnimatedO` inside it.

### 3.2 AnimatedX Component

```tsx
function AnimatedX({
  size,
  color,
  animate,
}: {
  size: number;
  color: string;
  animate: boolean;
}) {
  const progress = useSharedValue(animate ? 0 : 1);
  const pad = size * 0.15;
  const sw = Math.max(3, size * 0.08);

  useEffect(() => {
    if (animate) {
      progress.value = withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [animate, progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.8 + progress.value * 0.2 }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, animStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Line
          x1={pad}
          y1={pad}
          x2={size - pad}
          y2={size - pad}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
        <Line
          x1={size - pad}
          y1={pad}
          x2={pad}
          y2={size - pad}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}
```

**How it works:**

- `useSharedValue` is initialized to `0` when `animate=true` (new move), or `1` when `animate=false` (existing mark).
- A `useEffect` fires on mount (and when `animate` changes) and drives `progress` from 0 → 1 via `withTiming` (250ms, easeOutCubic).
- `useAnimatedStyle` maps `progress` to opacity (0→1) and scale (0.8→1.0).
- The animated view wraps an SVG with two `<Line>` elements drawing the X.

### 3.3 AnimatedO Component

```tsx
function AnimatedO({
  size,
  color,
  animate,
}: {
  size: number;
  color: string;
  animate: boolean;
}) {
  const progress = useSharedValue(animate ? 0 : 1);
  const radius = size * 0.35;
  const sw = Math.max(3, size * 0.08);

  useEffect(() => {
    if (animate) {
      progress.value = withSpring(1, { damping: 12, stiffness: 180 });
    }
  }, [animate, progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.4 + progress.value * 0.6 }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, animStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={sw}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}
```

**How it works:**

- Same pattern as AnimatedX but uses `withSpring` instead of `withTiming`.
- Scale ranges from 0.4 → 1.0 (more dramatic spring pop).

### 3.4 Pulse Animation on Last-Move Cell

Inside `TicTacToeCell`:

```tsx
const pulseScale = useSharedValue(1);
useEffect(() => {
  if (isLastMove && isNewMove) {
    pulseScale.value = withSequence(
      withSpring(1.08, { damping: 6, stiffness: 200 }),
      withSpring(1, { damping: 10, stiffness: 150 }),
    );
  }
}, [isLastMove, isNewMove, pulseScale]);

const pulseStyle = useAnimatedStyle(() => ({
  transform: [{ scale: pulseScale.value }],
}));
```

The entire cell content is wrapped in `<Animated.View style={pulseStyle}>`.

### 3.5 Win Line & Draw Overlays

- `WinLineOverlay` uses `entering={FadeIn.delay(150).duration(350)}` — a Reanimated entering animation on an `Animated.View` that wraps an SVG `<Line>`.
- Draw overlay uses `entering={FadeIn.delay(200).duration(400)}`.

---

## 4. Connect Four Animations

**File:** `src/gamesV4/screens/ConnectFourScreenV4.tsx` (705 lines)

### 4.1 New-Drop Detection (Synchronous / Ref-Based)

```tsx
const knownMoveCountRef = useRef<number | null>(null);
const lastDropCellRef = useRef<{ row: number; col: number } | null>(null);

// First render: snapshot
if (knownMoveCountRef.current === null) {
  knownMoveCountRef.current = moveCount;
}

// Detect new drop
let isNewDropThisRender = false;
if (moveCount > knownMoveCountRef.current && serverLastMove) {
  lastDropCellRef.current = serverLastMove;
  isNewDropThisRender = true;
  knownMoveCountRef.current = moveCount;
} else if (moveCount > knownMoveCountRef.current) {
  knownMoveCountRef.current = moveCount;
}
```

Only the specific cell matching `lastDropCell` gets `isNewDrop=true`:

```tsx
const isCellNewDrop = isNewDropThisRender && isLast;
```

### 4.2 Disc Key Strategy (Remount on Value Change)

```tsx
<Disc
  key={cell === 0 ? `e-${r}-${c}` : `d-${r}-${c}`}
  value={cell}
  isNewDrop={isCellNewDrop}
  // ... other props
/>
```

**Critical:** The `key` changes from `e-${r}-${c}` (empty) to `d-${r}-${c}` (disc) when a disc is placed. This causes React to **unmount the old component and mount a new one**, which means the `Disc` component's `useSharedValue` and `useEffect` run fresh.

### 4.3 Disc Animation Component

```tsx
function Disc({ value, isLastMove, isWinCell, isNewDrop, isDark }: DiscProps) {
  const scale = useSharedValue(isNewDrop ? 0.6 : 1);

  useEffect(() => {
    if (isNewDrop) {
      scale.value = withSequence(
        withTiming(1.08, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 8, stiffness: 200 }),
      );
    }
  }, [isNewDrop, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (value === 0) {
    return (
      <View
        style={[
          styles.emptySlot,
          {
            /* ... */
          },
        ]}
      />
    );
  }

  return (
    <Animated.View style={animStyle}>
      <View style={[styles.disc, { backgroundColor: discColor /* ... */ }]}>
        <View
          style={[
            styles.discHighlight,
            {
              /* ... */
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}
```

**How it works:**

- `useSharedValue(0.6)` when `isNewDrop=true` — disc starts at 60% scale.
- `useEffect` triggers `withSequence`: overshoot to 1.08 via `withTiming` (150ms), then settle to 1.0 via `withSpring`.
- `useAnimatedStyle` maps `scale` to a transform.
- When `value === 0`, a plain (non-animated) `View` is returned.

### 4.4 Ghost Disc Preview

```tsx
function GhostDisc({ color, size }: { color: string; size: number }) {
  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      style={[styles.ghostDisc, { backgroundColor: color, opacity: 0.35 }]}
    />
  );
}
```

Uses Reanimated's `entering` prop for a simple 120ms fade-in.

---

## 5. Chess Animations

**Files:**

- `src/gamesV4/screens/chess/ChessBoard.tsx` (338 lines) — board layout + animated piece wrapper
- `src/gamesV4/screens/chess/ChessPiece.tsx` (146 lines) — individual piece render with entrance/capture animations
- `src/gamesV4/screens/chess/constants.ts` — timing constants

### 5.1 New-Move Detection

Inside `ChessBoard`:

```tsx
const prevPlyRef = useRef(state.plyCount);

// Detect new move for animation
const isNewMove = state.plyCount !== prevPlyRef.current;
useEffect(() => {
  prevPlyRef.current = state.plyCount;
}, [state.plyCount]);
```

`isNewMove` is computed synchronously during render (ref compared to current state). The `useEffect` updates the ref **after** render so it's only true for one render cycle.

### 5.2 Piece Layer Key Strategy

```tsx
const pieces = useMemo(() => {
  const els: React.ReactElement[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece) continue;
      const sq = indicesToSquare(r, c);
      const justLanded = isNewMove && state.lastMove?.to === sq;

      els.push(
        <AnimatedPieceWrapper
          key={`${piece}-${sq}-${state.plyCount}`}
          piece={piece}
          visualRow={vr}
          visualCol={vc}
          justLanded={justLanded}
          lastMove={state.lastMove}
          flipped={flipped}
          reducedMotion={settings.reducedMotion}
          boardTheme={boardTheme}
        />,
      );
    }
  }
  return els;
}, [state, boardTheme, flipped, isNewMove, settings.reducedMotion]);
```

**Critical:** The `key` includes `state.plyCount`, which means **every piece on the board remounts on every move**. This guarantees fresh `useSharedValue` initialization.

### 5.3 AnimatedPieceWrapper Component

```tsx
const AnimatedPieceWrapper = React.memo(function AnimatedPieceWrapper({
  piece,
  visualRow,
  visualCol,
  boardTheme,
  justLanded,
  lastMove,
  flipped,
  reducedMotion,
}: AnimatedPieceWrapperProps) {
  const targetX = visualCol * SQUARE_SIZE;
  const targetY = visualRow * SQUARE_SIZE;

  // Calculate starting position if this piece just moved
  let startX = targetX;
  let startY = targetY;

  if (justLanded && lastMove && !reducedMotion) {
    const [fromR, fromC] = squareToIndices(lastMove.from);
    const fromVR = flipped ? 7 - fromR : fromR;
    const fromVC = flipped ? 7 - fromC : fromC;
    startX = fromVC * SQUARE_SIZE;
    startY = fromVR * SQUARE_SIZE;
  }

  const x = useSharedValue(startX);
  const y = useSharedValue(startY);

  useEffect(() => {
    if (
      justLanded &&
      !reducedMotion &&
      (startX !== targetX || startY !== targetY)
    ) {
      x.value = startX;
      y.value = startY;
      x.value = withTiming(targetX, {
        duration: MOVE_ANIM_DURATION, // 150ms
        easing: Easing.out(Easing.cubic),
      });
      y.value = withTiming(targetY, {
        duration: MOVE_ANIM_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      x.value = targetX;
      y.value = targetY;
    }
  }, [targetX, targetY, justLanded, reducedMotion, startX, startY, x, y]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <Animated.View style={[styles.pieceAbsolute, animStyle]}>
      <ChessPiece
        piece={piece}
        boardTheme={boardTheme}
        reducedMotion={reducedMotion}
      />
    </Animated.View>
  );
});
```

**How it works:**

- On mount, `x` and `y` `useSharedValue`s are initialized to the piece's **origin** position (where it was before the move).
- The `useEffect` fires and drives `x` and `y` to the **target** position via `withTiming` (150ms, easeOutCubic).
- Because the key includes `plyCount`, the component remounts on every move, so `useSharedValue(startX)` reliably gets the start position.
- Note the double assignment: `x.value = startX;` followed immediately by `x.value = withTiming(targetX, ...)`. The intent is to reset the shared value before starting the animation, since the shared value was just created with `startX` anyway. This may or may not be redundant.

### 5.4 ChessPiece Component (Entrance & Capture Animations)

```tsx
export const ChessPiece = React.memo(function ChessPiece({
  piece,
  boardTheme,
  isCaptured = false,
  animateEntrance = false,
  reducedMotion = false,
}: ChessPieceProps) {
  // Capture animation
  const captureScale = useSharedValue(isCaptured ? 0 : 1);
  const captureOpacity = useSharedValue(isCaptured ? 0 : 1);

  // Entrance animation
  const entranceScale = useSharedValue(
    animateEntrance && !reducedMotion ? 0.5 : 1,
  );
  const entranceOpacity = useSharedValue(
    animateEntrance && !reducedMotion ? 0 : 1,
  );

  useEffect(() => {
    if (isCaptured && !reducedMotion) {
      captureScale.value = withTiming(0, {
        duration: 120,
        easing: Easing.in(Easing.cubic),
      });
      captureOpacity.value = withTiming(0, {
        duration: 100,
        easing: Easing.out(Easing.linear),
      });
    }
  }, [isCaptured, reducedMotion, captureScale, captureOpacity]);

  useEffect(() => {
    if (animateEntrance && !reducedMotion) {
      entranceScale.value = withTiming(1, {
        duration: MOVE_ANIM_DURATION, // 150ms
        easing: Easing.out(Easing.cubic),
      });
      entranceOpacity.value = withTiming(1, {
        duration: MOVE_ANIM_DURATION * 0.8,
        easing: Easing.out(Easing.linear),
      });
    }
  }, [animateEntrance, reducedMotion, entranceScale, entranceOpacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: captureScale.value * entranceScale.value }],
    opacity: captureOpacity.value * entranceOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons
          name={iconName}
          size={iconSize}
          color={fillColor}
        />
      </View>
    </Animated.View>
  );
});
```

**Note:** In the current codebase, `ChessPiece` is called from `AnimatedPieceWrapper` **without** passing `isCaptured` or `animateEntrance` — so these props default to `false` and the entrance/capture sub-animations inside `ChessPiece` are effectively **dormant**. The only active animation is the slide (`translateX`/`translateY`) in `AnimatedPieceWrapper`.

### 5.5 Timing Constants

```typescript
export const MOVE_ANIM_DURATION = 150; // piece slide
export const CAPTURE_ANIM_DURATION = 120; // captured piece shrink
export const CHECK_PULSE_DURATION = 600; // check ring pulse
export const HIGHLIGHT_FADE_DURATION = 200; // last-move highlight
```

---

## 6. Shared Animation Components

### 6.1 TurnStatusCard

**File:** `src/gamesV4/components/turnBased/TurnStatusCard.tsx`

Previously used `Layout.springify()` on the card container which caused layout shifts. That was removed. The subtitle is always rendered (with transparent color when empty) to avoid layout jumps from conditional mounting. No entering/exiting animations on the card itself currently.

### 6.2 PlayerChip

**File:** `src/gamesV4/components/turnBased/PlayerChip.tsx`

No Reanimated animations. Uses a static avatar `Image` and a mark-color pip. No animation concerns here.

---

## 7. Summary of Animation Patterns Used

| Game      | Animation       | Trigger                                            | Reanimated API                                                          | Duration                           | What Animates                           |
| --------- | --------------- | -------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------- | --------------------------------------- |
| **TTT**   | X mark entrance | `animate=true` on mount                            | `useSharedValue` + `useEffect` + `withTiming`                           | 250ms                              | opacity 0→1, scale 0.8→1.0              |
| **TTT**   | O mark entrance | `animate=true` on mount                            | `useSharedValue` + `useEffect` + `withSpring`                           | spring (damping:12, stiffness:180) | opacity 0→1, scale 0.4→1.0              |
| **TTT**   | Last-move pulse | `isLastMove && isNewMove`                          | `useSharedValue` + `useEffect` + `withSequence(withSpring, withSpring)` | two springs                        | scale 1→1.08→1.0                        |
| **TTT**   | Win line        | Component mount                                    | `entering={FadeIn.delay(150).duration(350)}`                            | 350ms                              | opacity 0→1                             |
| **C4**    | Disc drop       | `isNewDrop=true` on mount (key changes)            | `useSharedValue` + `useEffect` + `withSequence(withTiming, withSpring)` | 150ms + spring                     | scale 0.6→1.08→1.0                      |
| **C4**    | Ghost disc      | Component mount                                    | `entering={FadeIn.duration(120)}`                                       | 120ms                              | opacity 0→1                             |
| **Chess** | Piece slide     | `justLanded=true` on mount (key includes plyCount) | `useSharedValue` + `useEffect` + `withTiming`                           | 150ms                              | translateX/Y from origin to destination |
| **Chess** | Piece entrance  | Not currently wired up                             | `useSharedValue` + `useEffect` + `withTiming`                           | 150ms                              | scale 0.5→1, opacity 0→1                |
| **Chess** | Piece capture   | Not currently wired up                             | `useSharedValue` + `useEffect` + `withTiming`                           | 120ms                              | scale 1→0, opacity 1→0                  |

### Common Pattern

All three games follow the same structure:

1. **`useSharedValue(initialValue)`** — initial value is set based on whether this is a "new" item (0 or start position) or existing (1 or final position).
2. **`useEffect(() => { if (shouldAnimate) sharedValue.value = withTiming/withSpring(...) }, [deps])`** — triggers the animation after the component mounts or the trigger prop changes.
3. **`useAnimatedStyle(() => ({ ... }))`** — reads the shared value and maps it to CSS transform/opacity properties.
4. **`<Animated.View style={animStyle}>`** — applies the animated style.

### Additional Pattern: `entering` Prop

Some components use Reanimated's `entering` prop (`FadeIn`, etc.) on `<Animated.View entering={...}>`. This is a declarative entering animation that runs when the component first mounts.

---

## 8. What Has Been Tried

### Attempt 1: animEpoch Keys

- **Hypothesis:** `useEffect`-based detection with `newMoves`/`newDrops` `Set` state was stale.
- **Fix:** Replaced with an `animEpoch` counter and dynamic keys that included the epoch, forcing remount.
- **Result:** Still did not work on mobile.

### Attempt 2: Synchronous Ref-Based Detection + Rewrite AnimatedO

- **Hypothesis:** `useEffect`-based move detection fires **after** React commits, causing a one-frame lag where the mark appears at full size before the animation starts. On native, each commit is a painted frame, making this intermediate state visible. Additionally, `AnimatedO` was using `entering={ZoomIn}` which is fragile on native when the component re-renders.
- **Fix:**
  - Replaced `useEffect`-based move detection with synchronous ref-based detection during the render function (the code shown in this document).
  - Rewrote `AnimatedO` from `entering={ZoomIn}` to `useSharedValue` + `useEffect` + `withSpring` (manual animation, same pattern as `AnimatedX`).
  - Changed Connect Four `Disc` keys to cell-value-based (`e-r-c` vs `d-r-c`) to force remount on value change.
- **Result:** Compiles with zero errors. Still does not animate on mobile.

### Attempt 3: Layout Shift Fix (TurnStatusCard)

- Removed `Layout.springify()` from `TurnStatusCard`.
- Made subtitle always render (with transparent color when empty).
- Fixed chip ordering (local always on the left).
- **Result:** Layout shift fixed, but this was a separate issue from the missing animations.

---

## 9. Symptom Description

### What works:

- **Web (Expo Web):** All animations play correctly — X/O marks scale in, discs bounce, chess pieces slide.
- **Compilation:** Zero TypeScript/ESLint errors across all files.
- **Non-animation UI:** Board rendering, game logic, player identification, haptic feedback, win detection, and all interactive elements work correctly on mobile.

### What does NOT work:

- **iOS and Android (Expo Go / development build):** No visible animation plays for any of the three games. Marks, discs, and pieces appear **instantly at their final position/size** with no transition.

### Specific observations on mobile:

- TTT: X and O marks appear at full size and full opacity immediately — no scale-in or fade-in.
- Connect Four: Discs appear at full scale immediately — no bounce/drop animation.
- Chess: Pieces jump to their destination square immediately — no slide from origin.
- The `entering={FadeIn}` animations on overlays (win line, ghost disc, draw overlay) have not been specifically tested/reported as broken, but may also be affected.

### What this suggests:

The `useSharedValue` → `useEffect` → `withTiming`/`withSpring` → `useAnimatedStyle` pipeline that works on web does **not** produce visible animation frames on native. Possible areas to investigate:

1. **React 19.1.0 + Reanimated 4.1.1 compatibility** — React 19 changed the commit/effect lifecycle significantly. The `useEffect` that drives the animation may fire at a different time or with different batching behavior.
2. **`useSharedValue` initialization vs. `useEffect` timing** — If the shared value starts at 0 and the `useEffect` runs `withTiming(1, ...)`, but native Fabric batches the initial render and the effect's first animation frame together, the animation might appear to jump to completion.
3. **`react-native-worklets-core/plugin` interaction** — This Babel plugin is loaded before the Reanimated plugin. It may affect how worklets are compiled.
4. **Expo SDK 54 + RN 0.81 + Fabric** — The new architecture (Fabric) may have timing differences for native view commits that affect when animated style updates become visible.
5. **SVG inside Animated.View** — For TTT specifically, the `AnimatedX` and `AnimatedO` components wrap SVG content inside an `Animated.View`. If Reanimated's native driver doesn't properly propagate `opacity` and `transform` through to SVG host views, the SVG content might render but the animation container might not update visually.
6. **`useMemo` wrapping the piece layer (Chess)** — The `useMemo` around the pieces array in `ChessBoard` means the JSX elements are created during memo evaluation but rendered by React later. If Reanimated's `entering` or mount-time animation relies on specific mount timing that `useMemo` disrupts, this could be a factor.

---

## 10. Root Cause & Fix Applied

### Root Cause

The three broken games (TTT, Connect Four, Chess) all used **`react-native-reanimated`** (`useSharedValue`, `useAnimatedStyle`, `withTiming`, `withSpring`) for their board/piece animations. The one working game (2048) used **React Native's built-in `Animated` API** (`new Animated.Value()`, `Animated.timing()`, `Animated.spring()` with `useNativeDriver: true`).

In this specific environment combination:

- React 19.1.0
- React Native 0.81.5 (New Architecture / Fabric)
- react-native-reanimated ~4.1.1
- react-native-worklets-core/plugin (loaded before reanimated plugin)

…reanimated's `useSharedValue` → `useEffect` → `withTiming`/`withSpring` → `useAnimatedStyle` pipeline does not produce visible animation frames on iOS/Android native. The worklet-based animations either get batched with the initial commit (so the transition from initial→final is never visible) or the `useAnimatedStyle` worklets fail to execute on the UI thread due to compilation interference from the worklets-core plugin.

The core `Animated` API bypasses all worklet compilation, runs directly on the native animation driver, and works flawlessly in the same environment.

### Why Web Worked

On web, reanimated falls back to JavaScript-thread animation execution (no native worklets). React's JS reconciliation + requestAnimationFrame loop makes the animations visible because the intermediate frames between initial and final values are naturally rendered. On native, the worklet-based pipeline skips directly to the final value.

### Why 2048 Worked on Mobile

2048 was accidentally immune because it was built using `Animated` from `react-native` (not `react-native-reanimated`). Its animation pattern:

1. `useRef(new Animated.Value(startValue)).current`
2. `useEffect(() => { Animated.timing(value, { ..., useNativeDriver: true }).start() }, [])`
3. Direct `Animated.Value` in style: `{ transform: [{ translateX: animValue }] }`

This uses the iOS/Android native animation driver directly, with no worklet compilation step.

### Fix Applied

All three games were ported from `react-native-reanimated` to the core `Animated` API, following 2048's proven pattern:

| Before (broken)                                  | After (fixed)                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `import Animated from 'react-native-reanimated'` | `import { Animated } from 'react-native'`                                                     |
| `useSharedValue(x)`                              | `useRef(new Animated.Value(x)).current`                                                       |
| `useAnimatedStyle(() => ({ ... }))`              | Direct animated values in style prop                                                          |
| `sharedValue.value = withTiming(target, config)` | `Animated.timing(value, { toValue: target, ...config, useNativeDriver: true }).start()`       |
| `withSpring(target, springConfig)`               | `Animated.spring(value, { toValue: target, ...springConfig, useNativeDriver: true }).start()` |
| `withSequence(a, b)`                             | `Animated.sequence([a, b]).start()`                                                           |
| `withRepeat(anim, -1, true)`                     | `Animated.loop(anim)`                                                                         |
| `entering={FadeIn.duration(ms)}`                 | Manual `Animated.timing` opacity from 0→1 on mount                                            |

### Files Changed

| File                      | What Changed                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `TicTacToeScreenV4.tsx`   | Removed reanimated import; rewrote AnimatedX, AnimatedO, pulse animation, WinLineOverlay, draw overlay to use core Animated      |
| `ConnectFourScreenV4.tsx` | Removed reanimated import; rewrote Disc drop animation, GhostDisc fade-in, C4WinOverlay to use core Animated                     |
| `chess/ChessBoard.tsx`    | Removed reanimated import; rewrote AnimatedPieceWrapper to use offset-model translate animation (matching 2048's approach)       |
| `chess/ChessPiece.tsx`    | Removed reanimated import; rewrote capture/entrance animations to use core Animated with `Animated.multiply` for combined values |
| `chess/ChessSquare.tsx`   | Removed reanimated import; rewrote check pulse to use `Animated.loop` + `Animated.sequence`                                      |

### Key Architectural Principles (from 2048)

1. **Use `useRef(new Animated.Value(x)).current`** — not `useSharedValue`
2. **Start animations in `useEffect(() => {}, [])` (mount only)** — not effect-with-deps
3. **Use `useNativeDriver: true`** on every animation call
4. **Use offset model for position animations** — set `left`/`top` to target, animate `translateX`/`translateY` as offsets from 0. If animation fails, piece is already at correct position.
5. **Key-based remount ensures fresh `Animated.Value` instances** per animation cycle — no need to manage re-triggers

---

## Appendix: File Locations

| File                                                  | Lines | Description                           |
| ----------------------------------------------------- | ----- | ------------------------------------- |
| `src/gamesV4/screens/TicTacToeScreenV4.tsx`           | ~710  | Full TTT game screen                  |
| `src/gamesV4/screens/ConnectFourScreenV4.tsx`         | ~710  | Full C4 game screen                   |
| `src/gamesV4/screens/chess/ChessScreenV4.tsx`         | 829   | Full chess game screen                |
| `src/gamesV4/screens/chess/ChessBoard.tsx`            | ~335  | Board + AnimatedPieceWrapper          |
| `src/gamesV4/screens/chess/ChessPiece.tsx`            | ~155  | Individual piece (entrance/capture)   |
| `src/gamesV4/screens/chess/constants.ts`              | 99    | Dimensions & timing                   |
| `src/gamesV4/screens/chess/chessThemes.tsx`           | —     | Board color themes                    |
| `src/gamesV4/components/turnBased/TurnStatusCard.tsx` | ~137  | Turn status header                    |
| `src/gamesV4/components/turnBased/PlayerChip.tsx`     | ~143  | Player identity chip                  |
| `src/gamesV4/screens/play2048/AnimatedTile.tsx`       | 211   | 2048 animated tile (control specimen) |
| `babel.config.js`                                     | 13    | Babel plugins (reanimated last)       |
| `package.json`                                        | —     | All dependency versions               |
