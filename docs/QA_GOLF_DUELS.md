# QA Checklist – Mini-Golf Duels

> Last updated: Segment 4 (physics polish & multiplayer fairness)

---

## 1 Course Data Integrity

| #   | Check                                                             | How to verify                                              |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| 1.1 | All 30 courses pass bulk validator                                | `node shared/golfDuels/validateAllCourses.js` → 30/30 pass |
| 1.2 | Obstacle `size` uses `{ width, height }` (not `{ x, y }`)         | Validator rejects `{ x, y }` format                        |
| 1.3 | Every course has `tee` inside bounds                              | Validator checks `0 < tee.x < bounds.width` etc.           |
| 1.4 | Every course has `cup` inside bounds with `cupRadius`             | Validator checks cup fits within wall polygon              |
| 1.5 | Wall polygons are closed (≥ 3 vertices)                           | Validator enforces `vertices.length >= 3` per loop         |
| 1.6 | Portals always come in pairs (targetId references valid id)       | Validator cross-checks portal graph                        |
| 1.7 | Slopes have ≥ 3 polygon vertices and valid `direction`/`strength` | Validator checks `poly.length >= 3`, `strength > 0`        |
| 1.8 | `par` ≤ `maxStrokes` for every hole                               | Validator enforces `par <= maxStrokes`                     |

---

## 2 Physics – Ball & Cup

| #   | Check                                          | Expected behaviour                                   |
| --- | ---------------------------------------------- | ---------------------------------------------------- |
| 2.1 | Ball sinks when speed ≤ `SINK_SPEED_MAX` (3.5) | Ball stops, hole flagged as scored                   |
| 2.2 | Ball lips out when speed > `SINK_SPEED_MAX`    | Radial impulse pushes ball away from cup centre      |
| 2.3 | Lip-out does not eject ball through walls      | Impulse magnitude is `LIP_OUT_IMPULSE` (2.5); capped |
| 2.4 | Both players can sink on the same hole         | Each ball tracked independently                      |

---

## 3 Physics – Surfaces & Zones

| #   | Check                                                           | Expected behaviour                                         |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| 3.1 | Sand zone increases `frictionAir` by `SAND_FRICTION_MUL` (3.5×) | Ball decelerates noticeably on sand                        |
| 3.2 | Ice zone decreases `frictionAir` by `ICE_FRICTION_MUL` (0.15×)  | Ball slides with minimal slowdown on ice                   |
| 3.3 | Leaving surface resets frictionAir to `DEFAULT_FRICTION`        | Ball resumes normal physics after exiting zone             |
| 3.4 | Slope applies continuous force while ball overlaps sensor       | Direction vector × `SLOPE_FORCE_SCALE` (0.0004) × strength |
| 3.5 | Speed-pad = strong slope; ball accelerates through pad area     | High `strength` slope in course JSON                       |
| 3.6 | Speed cap (`SPEED_CAP` = 25) enforced each physics step         | `Body.setVelocity` scales down if exceeded                 |

---

## 4 Physics – Portals

| #   | Check                                                    | Expected behaviour                            |
| --- | -------------------------------------------------------- | --------------------------------------------- |
| 4.1 | Ball enters portal → teleports to target portal position | Position set, velocity direction preserved    |
| 4.2 | Exit speed ≥ `PORTAL_EXIT_MIN_SPEED` (2.0)               | Slow balls get boosted to min exit speed      |
| 4.3 | Cooldown prevents infinite loops                         | `PORTAL_COOLDOWN_FRAMES` (15) blocks re-entry |
| 4.4 | `portal_teleport` event broadcast to all clients         | Clients can play VFX/SFX on teleport          |
| 4.5 | Multi-portal courses (H24, H29, H30) don't cause crashes | Test with shots that hit portals in sequence  |

---

## 5 Physics – Obstacles

| #   | Check                                                       | Expected behaviour                        |
| --- | ----------------------------------------------------------- | ----------------------------------------- |
| 5.1 | Bumpers give restitution boost (`BUMPER_RESTITUTION` = 1.5) | Ball bounces off bumper harder than walls |
| 5.2 | Spinners rotate each tick, collision is active              | Ball deflects off rotating bar            |
| 5.3 | Moving gates oscillate between positions                    | Ball must time shots through gates        |
| 5.4 | All obstacles use collision category `WORLD` (0x0001)       | Both balls collide with all obstacles     |

---

## 6 Anti-Stuck & Stop Detection

| #   | Check                                                           | Expected behaviour                                |
| --- | --------------------------------------------------------------- | ------------------------------------------------- |
| 6.1 | Ball stops when speed < `STOP_EPS` (0.15) for `STOP_FRAMES` (8) | Turn ends cleanly, last-safe-pos saved            |
| 6.2 | Anti-stuck fires after `ANTI_STUCK_MAX_FRAMES` (600 ≈ 10 s)     | Ball force-stopped to prevent infinite motion     |
| 6.3 | `motionFrames` reset on each new shot                           | Fresh count per stroke                            |
| 6.4 | Ball in hazard resets to last safe position                     | Water/OOB → ball repositioned, stroke incremented |

---

## 7 Multiplayer Fairness

| #   | Check                                                          | Expected behaviour                                          |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| 7.1 | Ball-ball collision **disabled**                               | Category A (0x0002) and B (0x0004) mask only WORLD (0x0001) |
| 7.2 | Both players can putt simultaneously                           | No turn-order lock; each ball independent                   |
| 7.3 | Server-authoritative physics; no client prediction of opponent | Only server resolves positions                              |
| 7.4 | `firestoreGameId` links invite → room correctly                | `joinOrCreate` with matching `firestoreGameId` → same room  |
| 7.5 | Spectators cannot send `shot` or `rematch` messages            | `isSpectator()` guard on all player-only handlers           |

---

## 8 Reconnection & Disconnect

| #   | Check                                        | Expected behaviour                                 |
| --- | -------------------------------------------- | -------------------------------------------------- |
| 8.1 | `onDrop` marks player `connected = false`    | Broadcasts `opponent_reconnecting` to other player |
| 8.2 | `allowReconnection` grants 15 s window       | Env: `RECONNECTION_TIMEOUT_PHYSICS` default 15     |
| 8.3 | `onReconnect` restores `connected = true`    | Broadcasts `opponent_reconnected`                  |
| 8.4 | If reconnection fails → opponent awarded win | `endMatch(opponentUid, "opponent_left")`           |
| 8.5 | Spectator drop/reconnect doesn't affect game | Spectator sessions excluded from game logic        |

---

## 9 Spectator System

| #   | Check                                                | Expected behaviour                        |
| --- | ---------------------------------------------------- | ----------------------------------------- |
| 9.1 | Spectator joins with `{ spectator: true }`           | SpectatorEntry created, count incremented |
| 9.2 | maxClients = 12 allows players + multiple spectators | Room doesn't lock until 2 players joined  |
| 9.3 | Spectator leave decrements count, cleans up state    | `spectators.delete()`, count updated      |
| 9.4 | Spectators receive game state via schema sync        | Same Colyseus state broadcast; read-only  |

---

## 10 Rematch Flow

| #    | Check                                                | Expected behaviour                               |
| ---- | ---------------------------------------------------- | ------------------------------------------------ |
| 10.1 | Player sends `rematch` → `rematch_request` broadcast | Both clients see rematch prompt                  |
| 10.2 | `rematch_accept` triggers `resetForRematch()`        | Scores reset, new hole sequence, physics rebuilt |
| 10.3 | Spectators cannot trigger rematch                    | `isSpectator()` guard on both handlers           |
| 10.4 | Rematch preserves room (no new `joinOrCreate`)       | Same Colyseus room instance reused               |

---

## 11 Scoring & Match End

| #    | Check                                          | Expected behaviour                                 |
| ---- | ---------------------------------------------- | -------------------------------------------------- |
| 11.1 | Stroke count increments on each `shot` message | `strokesHoleByUid` and `strokesTotalByUid` updated |
| 11.2 | `MAX_STROKE_CAP` (14) enforced per hole        | Player auto-scores max if exceeded                 |
| 11.3 | After all holes, lowest total strokes wins     | `endMatch()` called with winner UID                |
| 11.4 | Match result written to Firestore              | Game doc updated with scores + winner              |

---

## 12 Physics Constants Reference

All tunable values live in **`shared/golfDuels/physicsConstants.ts`**.

| Constant                    | Value    | Purpose                                     |
| --------------------------- | -------- | ------------------------------------------- |
| `PHYSICS_DT`                | 16.67 ms | Fixed timestep (60 Hz)                      |
| `BALL_RADIUS`               | 8        | Ball collision radius                       |
| `DEFAULT_FRICTION`          | 0.02     | Base `frictionAir`                          |
| `MAX_POWER`                 | 20       | Shot power cap                              |
| `SPEED_CAP`                 | 25       | Max ball velocity per tick                  |
| `SINK_SPEED_MAX`            | 3.5      | Cup entry threshold                         |
| `LIP_OUT_IMPULSE`           | 2.5      | Lip-out push-back force                     |
| `STOP_EPS`                  | 0.15     | Stop detection velocity threshold           |
| `STOP_FRAMES`               | 8        | Consecutive frames below `STOP_EPS` to stop |
| `ANTI_STUCK_MAX_FRAMES`     | 600      | Force-stop after ~10 s of motion            |
| `SAND_FRICTION_MUL`         | 3.5      | Sand friction multiplier                    |
| `ICE_FRICTION_MUL`          | 0.15     | Ice friction multiplier                     |
| `SLOPE_FORCE_SCALE`         | 0.0004   | Per-tick slope force coefficient            |
| `PORTAL_EXIT_MIN_SPEED`     | 2.0      | Minimum exit speed from portal              |
| `PORTAL_COOLDOWN_FRAMES`    | 15       | Re-entry cooldown after teleport            |
| `BUMPER_RESTITUTION`        | 1.5      | Bumper bounce coefficient                   |
| `WALL_RESTITUTION`          | 0.6      | Wall bounce coefficient                     |
| `COUNTDOWN_SECONDS`         | 3        | Pre-round countdown                         |
| `SCORECARD_DELAY_MS`        | 1500     | Delay before showing scorecard              |
| `TEE_OFFSET`                | 14       | Lateral offset between two tee positions    |
| `MAX_STROKE_CAP`            | 14       | Max strokes per hole before auto-score      |
| `COLLISION_CATEGORY_WORLD`  | 0x0001   | Walls, obstacles, cup                       |
| `COLLISION_CATEGORY_BALL_A` | 0x0002   | Player A ball                               |
| `COLLISION_CATEGORY_BALL_B` | 0x0004   | Player B ball                               |
| `COLLISION_MASK_BALL`       | 0x0001   | Balls collide with WORLD only               |

---

## 13 Regression Smoke Tests

Run these after any physics or course change:

```bash
# 1. Validate all courses
node shared/golfDuels/validateAllCourses.js

# 2. TypeScript compilation (server)
cd colyseus-server && npx tsc --noEmit

# 3. Existing unit tests
cd colyseus-server && npm test

# 4. Client-side type check
npx tsc --noEmit
```

---

## 14 Known Limitations

- **No client-side prediction** for opponent ball (latency visible).
- **Slopes with complex concave polygons** may produce unexpected Matter.js decomposition — prefer convex polys.
- **Portal VFX** depends on client handling `portal_teleport` message (not yet implemented on client).
- **Anti-stuck force-stop** may feel abrupt — consider adding a warning at ~8 s in a future UX pass.
