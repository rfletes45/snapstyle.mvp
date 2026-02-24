# Bounce Blitz 2.0 — Ballz Replica Spec

**Date:** 2026-02-23  
**Status:** STOP #1 — Research + Spec (no code yet)

---

## A. Ballz Behavior Spec (from research)

### Sources

1. **App Store (iOS):** https://apps.apple.com/us/app/ballz/id1139609950  
   _"Swipe your finger to throw the balls and break the bricks. Try to break as many bricks as possible before they move down to the bottom. Collect all the items to get additional balls and make an endless ball chain! The level of bricks will be increased after each round you throw the balls."_

2. **Google Play:** https://play.google.com/store/apps/details?id=com.ketchapp.ballz  
   Same description; genre tags: Puzzle, Brick Break, Casual, Single player.

3. **User reviews confirm:** games reach 500–2500+ rounds; "speed up" button needed at high rounds; restart button frustration; enormous ball chains.

### Core Mechanics

| Mechanic               | Description                                                                                                                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aim**                | Player drags/swipes from the ball cluster at the bottom of the screen. A dotted trajectory line previews the first bounce. Angle is clamped to prevent horizontal/downward shots (~10°–170° from horizontal).                                 |
| **Launch**             | On release, all balls fire sequentially (staggered ~80–100ms apart) at the chosen angle. Speed is constant.                                                                                                                                   |
| **Ball physics**       | Balls bounce off walls (left, right, top ceiling) with perfect elastic reflection (no energy loss). Gravity = 0. Balls are small circles (~radius 6–8px at phone scale).                                                                      |
| **Bricks (blocks)**    | Rectangular, grid-aligned. Each has a number (its HP). Every ball hit decrements HP by 1. When HP reaches 0, brick is destroyed. Bricks display their HP number centered.                                                                     |
| **Brick HP**           | New bricks spawn with HP equal to (or near) the current round number. Higher rounds = tougher bricks. Some variance (±20%).                                                                                                                   |
| **Brick spawn**        | After each shot, a new row spawns at the TOP of the grid. The row has a random subset of columns filled (not all columns every round — roughly 3–5 of 7 columns).                                                                             |
| **Grid advance**       | After each shot, ALL existing bricks shift DOWN by one row. The new row appears at row 0.                                                                                                                                                     |
| **Extra-ball pickups** | Small circle/ring items spawn in the new row (instead of a brick in that column). When a ball passes through it, the player's ball count increases by 1 permanently. These are pass-through (no bounce). Roughly 1 pickup per row on average. |
| **Ball return**        | When a ball hits the bottom edge, it stops and is "returned." The first ball to return sets the new launch X position for the next shot.                                                                                                      |
| **End of shot**        | When ALL balls have returned, the turn ends. Grid advances, new row spawns.                                                                                                                                                                   |
| **Game over**          | If ANY brick occupies the bottom row (row = ROWS-1) after the grid advance, the game ends.                                                                                                                                                    |
| **Score**              | Score = number of rounds survived (i.e., turns completed). Alternatively, total bricks destroyed — but Ballz uses rounds as the primary metric. We'll use rounds (level/turn count) as primary, with bricks destroyed as a secondary stat.    |
| **Speed up**           | Ballz has a 2x speed button. We'll implement this.                                                                                                                                                                                            |
| **Endless**            | No win condition. Play until game over.                                                                                                                                                                                                       |

### Visual Style (Ballz reference)

- Dark background (navy/dark blue)
- Bricks are colorful rounded rectangles with white HP numbers
- Balls are small white circles with subtle glow
- Pickups are yellow/green circles or rings
- Dotted aim line from ball cluster
- Minimal UI: score top-center, ball count near launch point

---

## B. Physics Engine Decision

### Candidates Evaluated

#### 1. Hand-rolled sub-stepping (current implementation)

- **What exists:** The current `BounceBlitzGameScreen.tsx` uses manual AABB collision with sub-stepping (`BB_MAX_SUB_STEPS = 8`).
- **Problems:**
  - Tunneling at high speeds (balls pass through bricks, especially corners)
  - Double-hit on same brick in same frame (partially mitigated by `hitThisStep` set but still occurs at brick edges)
  - Corner cases with overlapping collision responses cause jitter
  - No CCD (Continuous Collision Detection) — discrete position checks miss fast-moving small objects
- **Verdict:** ❌ Known failure mode. The user explicitly states "previous attempts failed due to tunneling and double hits."

#### 2. Matter.js (already in project)

- **Version:** `^0.20.0` (in `package.json`)
- **Usage:** Only used in `colyseus-server/src/rooms/physics/MiniGolfDuelsRoom.ts` (server-side minigolf)
- **Pros:** Already installed, familiar API
- **Cons:**
  - **No CCD/TOI support.** Matter.js uses discrete collision detection only. For small fast-moving balls bouncing in tight grid corridors, this is the exact tunneling scenario that fails.
  - Matter.js is known to have tunneling issues with small+fast bodies vs thin/narrow static rectangles.
  - Matter.js collision resolution can produce "stuck" bodies and requires careful tuning of `slop`, `iterations`, etc.
- **Verdict:** ❌ Same fundamental problem. Not suitable for Ballz-style physics where many small balls move at high speed through a dense grid.

#### 3. Planck.js (Box2D port) ✅ CHOSEN

- **Version:** `1.4.3` (latest, published Feb 2026)
- **What it is:** Pure TypeScript rewrite of Box2D, the gold-standard 2D physics engine.
- **CCD/TOI:** ✅ **Built-in Continuous Collision Detection** via Box2D's sweep-based TOI (Time of Impact) solver. This is the primary reason to choose it. Setting `body.setBullet(true)` on ball bodies enables CCD, preventing tunneling even at extreme velocities.
- **Collision callbacks:** `world.on('begin-contact', ...)` provides clean contact events with fixture/body identification. One contact = one callback = no double-hits.
- **Deterministic:** Fixed timestep `world.step(dt)` is deterministic and stable.
- **Performance:** Box2D is battle-tested for mobile games. Planck.js is optimized for web/mobile. 100 balls + 50 bricks is well within its capabilities.
- **Size:** ~150KB minified (acceptable for a game screen).
- **Zero dependencies.**
- **Cons:** New dependency to install. Different API from Matter.js (but only BounceBlitz will use it).
- **Verdict:** ✅ **Best choice.** CCD solves tunneling. Contact callbacks solve double-hits. Battle-tested physics.

### Decision: **Planck.js**

Install via: `npm install planck`

Planck.js bodies will be:

- **Balls:** Dynamic circles with `bullet: true` (enables CCD)
- **Bricks:** Static rectangles (kinematic when advancing)
- **Walls:** Static edge chains (left, right, top)
- **Floor sensor:** Static edge at bottom, set as sensor (detects ball return without bouncing)
- **Pickups:** Static circle sensors (detect ball overlap, no bounce)

---

## C. Final "Bounce Blitz 2.0" Implementation Spec

### Board Layout

| Parameter           | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| Grid columns        | 7                                                       |
| Grid visible rows   | 10 (display area)                                       |
| Cell size           | `GAME_WIDTH / 7` (~50px on 375pt screen)                |
| Game width          | `min(screenWidth - 32, 380)`                            |
| Game height         | `CELL_SIZE * 12` (10 rows + launch area + header space) |
| Ball radius         | 6px (physics), 8px (visual with glow)                   |
| Brick size          | `CELL_SIZE - 6` (3px padding each side)                 |
| Brick corner radius | 4px                                                     |

### Turn Sequence

```
1. AIMING
   - Player drags to set angle
   - Dotted line previews trajectory (first bounce)
   - Release fires

2. SHOOTING
   - Balls launch sequentially (80ms stagger)
   - Physics world steps at 60Hz fixed timestep
   - On brick contact: decrement HP, destroy if 0
   - On pickup contact: increment ball count, remove pickup
   - On floor sensor contact: mark ball returned, record X of first return

3. END OF SHOT (all balls returned)
   - Advance grid: all bricks row += 1
   - Game over check: any brick at row >= ROWS
   - Spawn new row at row 0
   - Set launch X to first-returned ball's X
   - Increment level/turn counter

4. GAME OVER
   - Triggered when bricks reach bottom after advance
   - Submit score, show results
```

### Scoring

| Metric               | How computed                            | Used for             |
| -------------------- | --------------------------------------- | -------------------- |
| **Score (primary)**  | Rounds survived (level number)          | Leaderboard, display |
| **Bricks destroyed** | Counter incremented on each brick kill  | Achievement stat     |
| **Max balls**        | Peak ball count achieved                | Achievement stat     |
| **Best score**       | Highest rounds-survived across sessions | Personal best        |

### Spawn Rules

- **Bricks per row:** Random 3–5 out of 7 columns (increases slightly with level)
- **Brick HP:** `level + random(-1, +1)` (minimum 1). At level 50, bricks have ~50 HP.
- **Pickup frequency:** ~1 extra-ball pickup per new row (placed in an empty column)
- **Pickup type:** Always "+1 ball" (yellow circle with "+" icon)

### Game Over Rules

- After grid advance, if any brick's `row >= VISIBLE_ROWS` → game over
- No lives, no continues (matching Ballz behavior)
- Score = level reached

### Speed Control

- Default: 1x speed (normal ball velocity)
- Tap speed button during shooting: 2x speed (double physics timestep rate, or halve render interval)
- Speed resets each turn

### Meta Stats for Achievements

Emitted via `recordSinglePlayerSession`:

```typescript
interface BounceBlitzStats {
  gameType: "bounce_blitz";
  levelReached: number; // rounds survived
  blocksDestroyed: number; // total bricks killed this game
  ballsLaunched: number; // peak ball count
  totalBounces: number; // wall+brick bounces (nice-to-have)
}
```

Achievement ideas (to be wired in STOP #4):

- "First Strike" — reach level 5
- "Ball Hoarder" — have 20+ balls at once
- "Brick Buster" — destroy 100 bricks in one game
- "Marathon" — reach level 50
- "Century" — reach level 100

---

## D. Implementation Plan — Files to Touch

### New files (to create)

| File                                            | Purpose                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/games/bounceBlitz/BounceBlitzEngine.ts`    | Core game engine: Planck.js world setup, step loop, collision handlers, state management |
| `src/games/bounceBlitz/BounceBlitzTypes.ts`     | TypeScript types for game state, bricks, balls, config                                   |
| `src/games/bounceBlitz/BounceBlitzRenderer.tsx` | Pure rendering component (Skia Canvas or RN Views) — reads engine state, draws frame     |
| `src/games/bounceBlitz/BounceBlitzConfig.ts`    | Constants: grid size, speeds, spawn rules, colors                                        |
| `src/games/bounceBlitz/useBounceBlitzGame.ts`   | React hook: orchestrates engine lifecycle, exposes state+actions to screen               |

### Existing files to modify

| File                                                                        | Change                                                                                                                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/games/BounceBlitzGameScreen.tsx`                               | **Major rewrite.** Replace hand-rolled physics with new engine hook. Keep all SnapStyle integration (Colyseus, spectator, score race, game over modal, share, haptics). |
| `src/types/singlePlayerGames.ts`                                            | Update `BounceBlitzState` interface to match new engine. Keep `BounceBlitzStats` compatible.                                                                            |
| `src/types/games.ts`                                                        | Keep `bounce_blitz` entry in `GAME_METADATA` — no changes needed (description already matches).                                                                         |
| `package.json`                                                              | Add `"planck": "^1.4.3"` dependency                                                                                                                                     |
| `src/config/masterBadges.ts`                                                | May update achievement definitions (STOP #4)                                                                                                                            |
| `src/components/games/spectator-renderers/BounceBlitzSpectatorRenderer.tsx` | Update to render new state shape                                                                                                                                        |

### Files NOT touched (verified compatible)

| File                                                   | Why safe                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| `src/navigation/RootNavigator.tsx`                     | Screen name `BounceBlitzGame` stays the same                   |
| `src/services/gameHistory.ts`                          | Uses `bounce_blitz` gameType — no changes                      |
| `src/services/singlePlayerSessions.ts`                 | Generic — accepts `BounceBlitzStats`                           |
| `src/services/leaderboards.ts`                         | Generic — works with any gameType score                        |
| `src/components/games/GameOverModal.tsx`               | Generic — accepts `GameOverStats`                              |
| `src/types/gameResult.ts`                              | `bounce_blitz: "arcade"` mapping stays                         |
| `colyseus-server/src/rooms/physics/BounceBlitzRoom.ts` | Server-side — separate concern; can be updated later if needed |

### Dependency Changes

```
npm install planck
```

No other new dependencies required. Planck.js has zero runtime dependencies.

---

## E. Risk Assessment

| Risk                                   | Mitigation                                        |
| -------------------------------------- | ------------------------------------------------- |
| Planck.js bundle size (~150KB)         | Acceptable for a game screen; can be lazy-loaded  |
| Performance with 100+ balls            | Box2D handles this easily; will pool body objects |
| React Native compatibility             | Planck.js is pure JS/TS, no DOM dependency        |
| Spectator state shape change           | Update spectator renderer in STOP #3              |
| Existing tests referencing old physics | Will update/replace in STOP #5                    |

---

## STOP #1 COMPLETE

**Deliverables:**

1. ✅ Ballz behavior spec (Section A)
2. ✅ Physics choice: Planck.js + rationale (Section B)
3. ✅ Implementation plan with file paths (Section D)

**Ready for STOP #2:** Core game engine + Planck.js physics implementation.

Awaiting approval to proceed.
