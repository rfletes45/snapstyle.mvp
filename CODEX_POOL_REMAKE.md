# Codex: 8-Ball Pool — Complete Remake From Scratch

> **For**: OpenAI Codex (codex-5.3)
> **Repository**: `snapstyle-mvp` — React Native + Expo social app called "Vibe"
> **Date**: February 2026
> **Objective**: Delete the entire current Pool implementation and build a completely new, polished, production-quality 8-Ball Pool game from the ground up

---

## Mission

The current Pool game is fundamentally broken in every dimension — visuals, physics, game logic, AI, multiplayer integration, and user experience. **Do not salvage anything from it.** Delete every Pool-specific file and build a brand-new implementation that would feel at home in a top-tier mobile gaming app.

This is the flagship game in a social app competing with GamePigeon. It needs to be **the most impressive game in the entire app** — smooth physics, beautiful visuals, satisfying haptics, intelligent AI, and seamless multiplayer.

---

## Step 0: Delete Everything — Clean Slate

Delete these files entirely before writing any new code:

| File                                                                 | Lines | Why                                                                                                     |
| -------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| `src/screens/games/PoolGameScreen.tsx`                               | 1,309 | Garbage screen — tangled state, broken physics, no shot animation, bad AI                               |
| `src/utils/physics/poolPhysics.ts`                                   | 526   | Over-simplified physics — no spin, no english, no friction model, broken collision response             |
| `src/types/poolGame.ts`                                              | 535   | Over-engineered types that don't match reality — animation keyframes never used, shot validation unused |
| `src/components/games/spectator-renderers/PoolSpectatorRenderer.tsx` | 39    | Placeholder — just shows a text card, no visual rendering                                               |
| `__tests__/games/pool/poolPhysics.test.ts`                           | 367   | Tests for the old physics — useless                                                                     |
| `colyseus-server/src/rooms/physics/PoolRoom.ts`                      | 533   | Broken server room — extends PhysicsRoom but pool is turn-based, not continuous physics                 |

**Do NOT delete** (these reference Pool but will be updated in-place):

- `src/config/colyseus.ts` — Pool room name mapping (update if room name changes)
- `colyseus-server/src/app.config.ts` — Room registration (update import path)
- `src/navigation/RootNavigator.tsx` — Screen registration (import path stays the same)
- `src/types/games.ts` — `"8ball_pool"` type entry stays, metadata stays

After deleting, verify the project structure is clean:

```
# These should NOT exist:
src/screens/games/PoolGameScreen.tsx     ← deleted
src/utils/physics/poolPhysics.ts         ← deleted
src/types/poolGame.ts                    ← deleted
src/components/games/spectator-renderers/PoolSpectatorRenderer.tsx ← deleted
__tests__/games/pool/poolPhysics.test.ts ← deleted
colyseus-server/src/rooms/physics/PoolRoom.ts ← deleted
```

---

## Step 1: Research & Decide — Rendering Technology

Before writing any code, **research and decide** whether to use **Skia** or **Three.js** for the Pool game's rendering. Both are available in the project.

### Option A: Skia (`@shopify/react-native-skia` ^2.2.12)

**Pros:**

- Every other game in the app uses Skia — consistency
- Excellent 2D performance on mobile
- Great gradient, shadow, and blur support
- Easier to integrate with React Native gesture handlers
- Simpler mental model (2D coordinates)

**Cons:**

- 2D only — making balls look 3D requires faking it with radial gradients
- No built-in lighting, no real perspective
- Table perspective/angle would be purely cosmetic (drawn, not modeled)

### Option B: Three.js (`three` ^0.166.1 + `expo-three` ^8.0.0 + `expo-gl` ~16.0.10)

**Pros:**

- True 3D rendering — balls are actual spheres with real lighting and reflections
- Camera can be positioned at a natural viewing angle (slight top-down perspective)
- Realistic shadows, specular highlights, environment reflections on balls
- Table felt texture, wood rails, pocket depth — all modeled in 3D
- Ball rolling animation is trivial (rotate sphere mesh)
- Professional pool game look with minimal effort

**Cons:**

- Only used for Games Hub background currently (ThreeCanvas, ThreeGameBackground)
- More complex architecture (scene graph, camera, lighting)
- Gesture handling needs coordinate unprojection (screen → world)
- Potential performance concerns on low-end devices

### Infrastructure Already Available

The project has a `ThreeCanvas` component (`src/components/three/ThreeCanvas.tsx`, 241 lines) that:

- Wraps `expo-gl`'s `GLView` with `expo-three`'s `Renderer`
- Creates `Scene`, `PerspectiveCamera`, `WebGLRenderer`
- Manages animation loop with `requestAnimationFrame`
- Handles cleanup on unmount
- Supports transparent backgrounds

**Your decision**: Evaluate both options and choose the one that will produce the most visually impressive, performant result. Document your choice and reasoning in a comment at the top of the new `PoolGameScreen.tsx`.

---

## Step 2: Architecture — New File Structure

Create these new files:

```
src/
  screens/games/
    PoolGameScreen.tsx              ← Main game screen (NEW)
  services/games/
    poolEngine.ts                   ← Physics engine + game rules (NEW)
  types/
    pool.ts                         ← Clean type definitions (NEW)
  components/games/
    spectator-renderers/
      PoolSpectatorRenderer.tsx     ← Real visual spectator renderer (NEW)

colyseus-server/
  src/rooms/
    PoolRoom.ts                     ← New server room at top-level rooms/ (NEW, NOT in physics/)

__tests__/games/pool/
  poolEngine.test.ts                ← Tests for the new engine (NEW)
```

**Note**: The new `PoolRoom.ts` should be at `colyseus-server/src/rooms/PoolRoom.ts` (not inside `physics/` since pool is turn-based, not continuous physics). Update the import in `colyseus-server/src/app.config.ts` accordingly.

---

## Step 3: Physics Engine — `src/services/games/poolEngine.ts`

Build a proper 2D pool physics engine. This is the core of the game — it must be accurate and satisfying.

### Requirements

1. **Ball-ball collision**: Proper elastic collision with coefficient of restitution (~0.95). Use actual vector math — project relative velocity onto collision normal, apply impulse. Separate overlapping balls after resolution.

2. **Ball-cushion collision**: Cushion bounce with ~0.7 restitution. Model cushions as line segments (not just boundary checks). Proper angle of reflection with slight randomization for realism.

3. **Pocket detection**: 6 pockets at corners and side midpoints. Use a radius check but also consider ball trajectory — a ball rolling slowly along the edge should still fall in. Corner pockets are slightly larger than side pockets (like real pool). Animate ball disappearing into pocket.

4. **Friction model**:
   - **Rolling friction**: Constant deceleration (~0.3-0.5 units/s²) applied opposite to velocity direction
   - **Sliding friction**: Higher deceleration for when ball is sliding (after hit, before pure roll)
   - **Spin decay**: Spin gradually transfers to rolling velocity, then pure rolling friction takes over
   - Stop threshold: Ball stops when speed < 0.1 units/s

5. **Cue ball english (spin)**:
   - **Top spin**: Ball rolls farther after contact (more forward velocity transfer)
   - **Back spin (draw)**: Ball reverses direction after hitting object ball
   - **Left/right english (side spin)**: Ball curves slightly during travel, and transfers spin on cushion contact causing the ball to come off the cushion at a different angle
   - Spin is specified as a 2D offset from ball center: `{ x: -1..1, y: -1..1 }`

6. **Shot power**: Normalized 0-1, mapped to initial velocity. Power affects:
   - Cue ball speed
   - Contact sound volume
   - Ball scatter on break
   - Draw/follow effectiveness

7. **Break shot**: First shot of the game. The cue ball must be behind the head string. At least 4 balls must hit a cushion or be pocketed, otherwise it's a foul.

8. **Simulation loop**: Run physics at 120Hz internally (8.33ms timestep), sub-stepped for accuracy. Output keyframes at 60Hz for rendering interpolation. The simulation runs to completion (all balls stopped) before returning results.

### API Design

```typescript
// poolEngine.ts

export interface PoolBall {
  id: number; // 0=cue, 1-7=solids, 8=eight, 9-15=stripes
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: { x: number; y: number }; // Current spin state
  pocketed: boolean;
}

export interface ShotParams {
  angle: number; // Radians
  power: number; // 0-1 normalized
  english: { x: number; y: number }; // Cue tip offset from center
}

export interface ShotResult {
  frames: PoolBall[][]; // Array of snapshots (60fps) for animation
  pocketed: number[]; // Ball IDs pocketed this shot
  firstContact: number | null; // First ball the cue ball touched
  railContacts: number; // Number of balls that touched a rail
  cueScratch: boolean; // Cue ball pocketed
  duration: number; // Total animation duration in ms
}

export interface TableConfig {
  width: number;
  height: number;
  pockets: Pocket[];
  cushions: Cushion[];
}

// Pure function — no side effects
export function simulateShot(
  balls: PoolBall[],
  shot: ShotParams,
  table: TableConfig,
): ShotResult;

export function createInitialBalls(table: TableConfig): PoolBall[];
export function createTable(): TableConfig;
```

The physics engine must be a **pure function** — given balls + shot, returns the complete simulation result with animation frames. No mutable state. This allows it to run identically on client (for AI preview) and server (for multiplayer authority).

---

## Step 4: Game Rules — Inside `poolEngine.ts` or `pool.ts`

Implement complete 8-ball rules:

### Turn Flow

1. Player aims and shoots
2. Physics simulation runs to completion
3. Rules engine evaluates the result:
   - **Legal pocket of own ball** → same player shoots again
   - **No ball pocketed or wrong ball pocketed** → turn passes to opponent
   - **Foul** → opponent gets ball-in-hand (can place cue ball anywhere)
   - **8-ball pocketed legally** → shooter wins
   - **8-ball pocketed illegally** → shooter loses

### Foul Types (implement all)

- **Scratch**: Cue ball pocketed
- **No contact**: Cue ball didn't hit any object ball
- **Wrong ball first**: First ball contacted was opponent's (after assignment)
- **No rail after contact**: After cue ball contacts an object ball, at least one ball must hit a rail or be pocketed
- **Early 8-ball**: Pocketed the 8-ball before clearing all own balls

### Ball Assignment

- **Open table** after break: First legally pocketed ball determines assignment
- If a player pockets a solid AND a stripe on the same shot (from open table), the assignment is the type they pocketed MORE of. If tied, it's the type of the first ball pocketed.

### Ball-in-Hand

- After any foul, opponent places the cue ball **anywhere on the table**
- After a break foul, cue ball is placed **behind the head string** only

### Win Conditions

- Pocket all 7 of your assigned balls, then legally pocket the 8-ball
- Opponent commits a foul while shooting the 8-ball (scratch, wrong pocket)

### Loss Conditions

- Pocket the 8-ball before clearing your group
- Scratch while pocketing the 8-ball
- Knock the 8-ball off the table

---

## Step 5: Type Definitions — `src/types/pool.ts`

Keep types **lean and practical** — only define what's actually used:

```typescript
export type BallType = "cue" | "solid" | "stripe" | "eight";
export type BallGroup = "solids" | "stripes";
export type GamePhase =
  | "menu"
  | "break"
  | "playing"
  | "ball-in-hand"
  | "shooting-eight"
  | "animating"
  | "game-over";
export type FoulType =
  | "scratch"
  | "no_contact"
  | "wrong_ball_first"
  | "no_rail"
  | "early_eight";

export interface PlayerState {
  group: BallGroup | null; // null until assignment
  remaining: number; // Balls left to pocket
  fouls: number; // Consecutive foul count
}

export function getBallType(id: number): BallType;
export function getBallColor(id: number): string;
export function getBallNumber(id: number): number;
```

---

## Step 6: Game Screen — `src/screens/games/PoolGameScreen.tsx`

### Integration Requirements (MUST HAVE — matches all other games in the app)

The screen **must** wire up all standard game system hooks and components:

```typescript
// Standard hooks (every game has these):
import { useGameBackHandler } from "@/hooks/useGameBackHandler";
import { useGameHaptics } from "@/hooks/useGameHaptics";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { useGameConnection } from "@/hooks/useGameConnection";
import { useSpectator } from "@/hooks/useSpectator";
import { createLogger } from "@/utils/log";

// Standard components:
import { GameOverModal } from "@/components/games/GameOverModal";
import { withGameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { SpectatorBanner } from "@/components/games/SpectatorBanner";
import { SpectatorOverlay } from "@/components/games/SpectatorOverlay";
import FriendPickerModal from "@/components/FriendPickerModal";

// For multiplayer:
import { usePhysicsGame } from "@/hooks/usePhysicsGame"; // or create a new usePoolGame hook if needed

// Auth/theme/user:
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import { useColors } from "@/store/ThemeContext";
import { useSnackbar } from "@/store/SnackbarContext";
```

**Hook wiring**:

- `useGameBackHandler({ gameType: "8ball_pool", isGameOver })` — handle Android back button
- `useGameHaptics()` — call `haptics.light()` on aim, `haptics.medium()` on shot, `haptics.heavy()` on pocket, `haptics.error()` on foul/scratch
- `useGameCompletion({ gameType: "8ball_pool", ... })` — achievement tracking on game end
- `useGameConnection(GAME_TYPE, route?.params?.matchId)` — resolve invite to Colyseus
- `useSpectator({ mode: "multiplayer-spectator", room, state })` — spectator count/list for MP mode
- `createLogger("PoolGame")` — **NO `console.log/warn/error`** anywhere

**Component wiring**:

- `<GameOverModal>` — shown on game end with win/loss, stats, play again, share
- `withGameErrorBoundary(PoolGameScreen, "8ball_pool")` — crash recovery wrapper (default export)
- `<SpectatorBanner>` — shown when user is spectating
- `<SpectatorOverlay>` — shows viewer count badge
- `<FriendPickerModal>` — for "Challenge Friend" and "Send Score" flows

### Screen States

```
menu → break → [animating] → playing ↔ ball-in-hand → [animating] → shooting-eight ↔ [animating] → game-over
```

### Menu Screen

- Game title with pool ball emoji 🎱
- "Play vs AI" button (starts single-player)
- "Challenge Friend" button (opens FriendPickerModal → sends invite)
- Personal best display
- Win/loss record

### Gameplay Screen

#### Table Rendering

The table should look **stunning**:

- **Felt surface**: Rich green with subtle texture/noise (not flat color)
- **Wood rails**: Warm brown with wood grain gradient, inner cushion lip
- **Pockets**: Dark holes with depth shadow, slightly larger at corners
- **Diamonds/sights**: Small dots on the rails (3 per side, like real tables)
- **Head string**: Faint dotted line
- **Foot spot**: Small dot where balls are racked

#### Ball Rendering

Balls must look **3D and realistic**:

- **Radial gradient** with highlight (specular) at top-left, shadow at bottom-right
- **Proper colors** for each ball (Yellow 1, Blue 2, Red 3, Purple 4, Orange 5, Green 6, Maroon 7, Black 8, Yellow stripe 9, Blue stripe 10, Red stripe 11, Purple stripe 12, Orange stripe 13, Green stripe 14, Maroon stripe 15)
- **Stripe rendering**: White body with colored band across the middle
- **Number circle**: Small white circle with ball number in center
- **Ball shadow** on the felt beneath each ball
- **Rolling animation**: If using Three.js, actual sphere rotation. If Skia, highlight position shifts during movement

#### Cue Stick Rendering

- Rendered during aiming phase
- Positioned behind the cue ball, pointing in shot direction
- Length represents power (pulled back farther = more power)
- Subtle taper from thick end to thin tip
- Wood texture gradient (maple/dark wood)

#### Aiming System

- **Drag from cue ball** to aim (pull back = direction + power)
- **Guide line**: Dotted line from cue ball in shot direction showing path
- **Ghost ball**: Semi-transparent circle showing where the cue ball will make first contact
- **Projected path**: Show the estimated path of the first contacted ball after collision
- **Power meter**: Visual indicator (green → yellow → red) showing shot strength
- **English selector**: Small circular overlay on cue ball showing spin offset. User can tap to set spin before shooting. Default is center (no spin).

#### Ball-in-Hand

- After a foul, cue ball follows finger/pan position
- Valid placement area highlighted (full table, or behind head string for break fouls)
- Tap to confirm placement
- Invalid placements (overlapping another ball) show error feedback

#### Shot Animation

- **Smooth 60fps animation** of all ball movements from the simulation frames
- During animation, controls are disabled
- **Sound effects** (if expo-av is available): ball-ball click, ball-cushion thud, pocket drop
- **Haptic feedback**: On ball-ball collision (light), on pocket (medium), on scratch (error)
- Camera shake on powerful shots (subtle, via Reanimated)

#### HUD (Heads-Up Display)

- **Player info bar** at top: avatar, name, ball group indicator (solid/stripe icon), remaining count
- **Opponent info bar**: Same layout for AI or online opponent
- **Turn indicator**: Clear "Your Shot" / "Opponent's Shot" text with animated transition
- **Foul banner**: Red banner slides in when foul occurs, showing foul type
- **Pocketed balls tray**: Two rows (one per player) showing small ball icons that have been pocketed

#### Game Over

- Use `<GameOverModal>` with:
  - Win/loss result
  - Stats: balls pocketed, fouls committed, longest run (consecutive pockets)
  - "Play Again" button
  - "Share Score" button (opens FriendPickerModal → `sendScorecard()`)
  - "Menu" button

### AI Opponent (Single-Player)

Build a **competent AI** with difficulty levels:

#### AI Decision Making

1. **Target selection**: AI evaluates all legal target balls and finds the best shot
2. **Shot evaluation**: For each potential shot, score based on:
   - Pocket probability (angle, distance, obstacles)
   - Cue ball position after shot (leave for next shot)
   - Safety value (if no good pocket, play safe — leave cue ball in a difficult position for opponent)
3. **Shot execution**: Add controlled randomness based on difficulty:
   - **Easy**: ±15° angle error, ±30% power error, no english
   - **Medium**: ±7° angle error, ±15% power error, basic english
   - **Hard**: ±3° angle error, ±8% power error, strategic english and position play

#### AI Flow

1. AI "thinks" for 0.8-1.5 seconds (random delay for realism)
2. Evaluate all possible shots
3. Choose best shot (with difficulty-based randomness)
4. Animate the cue stick aiming at the chosen angle
5. Execute the shot
6. Wait for simulation to complete

### Multiplayer (Colyseus)

#### Client-Side

- Use `useGameConnection` to resolve invite → Colyseus room
- Use `usePhysicsGame` or create a new `usePoolGame` hook if `usePhysicsGame` doesn't fit pool's turn-based model
- **Pool is turn-based, NOT continuous physics** — the server runs simulation, client animates results
- On your turn: aim and shoot locally, send `{ action: "shoot", angle, power, english }` to server
- Receive `shot_result` message with animation frames → play animation
- Receive `turn` message to know whose turn it is
- Ball-in-hand: send `{ action: "place_cue", x, y }` to server
- Rematch flow: use standard `sendRematch` / `acceptRematch` from hook

#### Server-Side (`colyseus-server/src/rooms/PoolRoom.ts`)

- **Extend `Room` directly** (not PhysicsRoom — pool is turn-based)
- Import the same physics engine logic (copy pure functions or create a shared package)
- Server receives shot → runs `simulateShot()` → broadcasts result to both players
- Server validates:
  - It's the shooting player's turn
  - Cue ball placement is legal (during ball-in-hand)
  - Power and angle are within bounds
- Server determines fouls, turn changes, win/loss
- Uses `allowReconnection(client, 300)` for 5-minute reconnect window
- Persists game result via `services/persistence.ts`

**Server Room Registration**: Update `colyseus-server/src/app.config.ts`:

```typescript
// Change import from:
import { PoolRoom } from "./rooms/physics/PoolRoom";
// To:
import { PoolRoom } from "./rooms/PoolRoom";
```

The room name `"pool"` and the `filterBy(["firestoreGameId"])` stay the same.

---

## Step 7: Spectator Renderer — `src/components/games/spectator-renderers/PoolSpectatorRenderer.tsx`

Build a **real visual spectator renderer** (not the current text-only placeholder):

- Accept `SpectatorRendererProps`: `{ gameState, width, score, level, lives }`
- Parse `gameState` to extract ball positions, pocketed state, table dimensions
- Render a scaled-down version of the pool table with all balls in their current positions
- Use the same rendering approach (Skia or Three.js) as the main game screen
- No interactive controls — read-only view
- Show turn indicator and player info

Register in `src/components/games/spectator-renderers/index.tsx`:

```typescript
import { PoolSpectatorRenderer } from "./PoolSpectatorRenderer";
// In RENDERERS map:
"8ball_pool": PoolSpectatorRenderer,
```

---

## Step 8: Tests — `__tests__/games/pool/poolEngine.test.ts`

Write comprehensive tests for the physics engine:

1. **Ball-ball collision**: Two balls head-on, angled collision, glancing blow
2. **Cushion bounce**: Ball hitting each wall, corner bounce
3. **Pocket detection**: Ball entering each of the 6 pockets, near-miss
4. **Friction**: Ball slowing down and stopping
5. **Break shot**: All 15 balls scatter, at least some hit rails
6. **English**: Top spin makes ball continue forward after contact, back spin reverses
7. **Foul detection**: Scratch, no contact, wrong ball first, no rail
8. **Win detection**: 8-ball pocketed after clearing group = win
9. **Loss detection**: 8-ball pocketed early = loss
10. **Ball-in-hand placement**: Can't overlap other balls
11. **Full game simulation**: Simulate a complete game to verify no crashes or infinite loops

---

## Tech Stack Reference

| Technology                     | Version                             | Relevant to Pool                                                                                           |
| ------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `@shopify/react-native-skia`   | ^2.2.12                             | 2D rendering option — Canvas, Circle, RoundedRect, LinearGradient, RadialGradient, Shadow, Line, Path, vec |
| `three`                        | ^0.166.1                            | 3D rendering option — Scene, Mesh, SphereGeometry, MeshStandardMaterial, lights                            |
| `expo-three`                   | ^8.0.0                              | Three.js bridge for Expo                                                                                   |
| `expo-gl`                      | ~16.0.10                            | OpenGL context for Three.js                                                                                |
| `react-native-reanimated`      | ~4.1.1                              | Animation — useSharedValue, useAnimatedStyle, withTiming, withSpring                                       |
| `react-native-gesture-handler` | ~2.28.0                             | Input — Gesture.Pan(), Gesture.Tap(), GestureDetector                                                      |
| `expo-haptics`                 | ~15.0.8                             | Haptics — ImpactFeedbackStyle.Light/Medium/Heavy, NotificationFeedbackType                                 |
| Colyseus SDK                   | 0.17.31 (client) / 0.17.35 (server) | Multiplayer rooms                                                                                          |
| React Native                   | 0.81.5                              |                                                                                                            |
| Expo SDK                       | 54                                  |                                                                                                            |
| TypeScript                     | ~5.9.2                              | strict: true                                                                                               |
| Path alias                     | `@/*` → `src/*`                     |                                                                                                            |

### ThreeCanvas API (if using Three.js)

```typescript
import { ThreeCanvas, ThreeContext } from "@/components/three/ThreeCanvas";

<ThreeCanvas
  style={{ width, height }}
  backgroundColor="#1a4a2e"
  onSceneReady={(ctx: ThreeContext) => {
    // ctx.scene, ctx.camera, ctx.renderer available
    // Add meshes, lights, etc.
  }}
  onFrame={(ctx: ThreeContext, delta: number) => {
    // Called every frame — update animations
  }}
/>
```

### Logging (REQUIRED)

```typescript
import { createLogger } from "@/utils/log";
const log = createLogger("PoolGame");
// Use log.info(), log.warn(), log.error() — NEVER console.*
```

---

## Execution Rules

1. **Delete first** — remove all 6 old files before writing anything new
2. **Build the physics engine first** (`poolEngine.ts`) — it's the foundation
3. **Write tests for the engine** — verify physics correctness before building the UI
4. **Build the game screen** — wire up all standard hooks, implement rendering
5. **Build the AI** — from simple to sophisticated
6. **Build the server room** — port physics engine logic, add validation
7. **Build the spectator renderer** — scaled-down visual view
8. **Update registrations** — `app.config.ts` import path
9. **Run `npx tsc --noEmit`** after each major step — zero errors
10. **Run `cd colyseus-server && npx tsc --noEmit`** — zero errors on server

---

## Verification Checklist

After completing the remake:

- [ ] All 6 old files deleted
- [ ] `npx tsc --noEmit` — zero errors (client)
- [ ] `cd colyseus-server && npx tsc --noEmit` — zero errors (server)
- [ ] Physics engine: ball-ball collision, cushion bounce, pocket detection, friction, english/spin all working
- [ ] Full 8-ball rules: fouls (scratch, no contact, wrong ball, no rail, early 8), assignment, ball-in-hand, win/loss
- [ ] AI opponent: target selection, difficulty-based accuracy, safety play
- [ ] Visual quality: table looks realistic (felt, wood rails, pockets with depth), balls look 3D (gradients, highlights, shadows, numbers, stripes)
- [ ] Cue stick rendering with power indication
- [ ] Aiming system: guide line, ghost ball, projected path, power meter, english selector
- [ ] Shot animation: smooth 60fps playback of simulation frames
- [ ] Haptic feedback on all key events
- [ ] `useGameBackHandler` wired
- [ ] `useGameHaptics` wired with appropriate events
- [ ] `useGameCompletion` wired
- [ ] `GameOverModal` with stats (balls pocketed, fouls, longest run)
- [ ] `withGameErrorBoundary` wrapping export
- [ ] `createLogger` — zero `console.*` calls
- [ ] Dark/light theme: background, text, HUD all use theme tokens
- [ ] `useSpectator` wired for multiplayer spectating
- [ ] `SpectatorBanner` + `SpectatorOverlay` rendered
- [ ] FriendPickerModal for "Challenge Friend" and "Share Score"
- [ ] Multiplayer: Colyseus room sends/receives shots, validates turns, detects fouls
- [ ] Server room registered in `app.config.ts` with correct import
- [ ] Spectator renderer shows actual table + ball positions (not text placeholder)
- [ ] Spectator renderer registered in `spectator-renderers/index.tsx`
- [ ] Tests pass: `npx jest __tests__/games/pool/`
- [ ] Navigation still works: `PoolGame` screen accessible from game picker and invites
- [ ] Ball-in-hand UI: drag cue ball, validate placement, confirm
- [ ] Break shot rules enforced
- [ ] Accessibility: `accessibilityLabel` on interactive elements
