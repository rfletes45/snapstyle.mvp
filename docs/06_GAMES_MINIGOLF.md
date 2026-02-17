# Mini-Golf Duels — Course Authoring Guide

> Reference doc for designing, validating, and deploying hole JSON for the Mini-Golf Duels game.

---

## 1. Coordinate System

- **Origin**: top-left corner `(0, 0)`.
- **X axis**: increases rightward.
- **Y axis**: increases downward.
- **Units**: abstract world units (not pixels). The client renderer applies a world→screen transform to fit the hole into the device viewport with padding.
- **Bounds**: every hole declares `bounds: { width, height }`. All geometry must fit within `(0,0)→(width, height)`.

---

## 2. Hole JSON Schema (v1)

Each hole is a single JSON file with these fields:

| Field        | Type                | Required | Description                                                                                                                              |
| ------------ | ------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `string`            | ✅       | Unique hole identifier, e.g. `"neon_3"`                                                                                                  |
| `packId`     | `string`            | ✅       | Pack this hole belongs to: `"tutorial"`, `"neon"`, `"garden"`, `"toybox"`                                                                |
| `name`       | `string`            | —        | Human-readable hole name                                                                                                                 |
| `par`        | `number`            | ✅       | Expected number of strokes (1–5 typical)                                                                                                 |
| `maxStrokes` | `number`            | ✅       | Maximum allowed strokes before forced finish                                                                                             |
| `bounds`     | `{ width, height }` | ✅       | World area — positive integers                                                                                                           |
| `tee`        | `{ x, y }`          | ✅       | Starting position. Must be inside bounds.                                                                                                |
| `cup`        | `{ x, y }`          | ✅       | Hole target position. Must be inside bounds.                                                                                             |
| `cupRadius`  | `number`            | ✅       | Cup detection radius (world units, typically 18–20)                                                                                      |
| `walls`      | `Point[][]`         | ✅       | Array of closed polygons defining fairway boundaries. Each polygon needs ≥3 vertices. The first wall usually defines the outer boundary. |
| `surfaces`   | `SurfaceDef[]`      | ✅       | Special ground areas (`[]` if none)                                                                                                      |
| `hazards`    | `HazardDef[]`       | ✅       | Water/OOB penalty zones (`[]` if none)                                                                                                   |
| `obstacles`  | `ObstacleDef[]`     | ✅       | Dynamic obstacles (`[]` if none)                                                                                                         |

### SurfaceDef

```jsonc
{
  "id": "sand_1",
  "type": "sand",        // "sand" (high friction) | "ice" (low friction)
  "frictionMul": 3.0,    // multiplier vs default friction
  "poly": [{ "x": 0, "y": 0 }, ...]  // ≥3 vertices, inside bounds
}
```

### HazardDef

```jsonc
{
  "id": "water_1",
  "type": "water",    // "water" | "oob"
  "penalty": 1,       // stroke penalty on reset
  "poly": [{ "x": 0, "y": 0 }, ...]  // ≥3 vertices, inside bounds
}
```

### ObstacleDef

```jsonc
{
  "id": "bumper_1",
  "type": "bumper", // "bumper" | "spinner" | "moving_gate"
  "position": { "x": 200, "y": 400 },
  "size": { "width": 30, "height": 30 },

  // bumper-specific
  "radius": 20,
  "restitution": 1.5,

  // spinner-specific
  "speed": 1.5, // radians/sec

  // moving_gate-specific
  "speed": 0.8,
  "pointA": { "x": 100, "y": 400 },
  "pointB": { "x": 300, "y": 400 },
}
```

---

## 3. Directory Structure

```
shared/games/minigolf/courses/
  tutorial/
    hole_01.json   (individual hole files)
    hole_02.json
    hole_03.json
  neon/
    hole_01.json .. hole_09.json
  garden/
    hole_01.json .. hole_09.json
  toybox/
    hole_01.json .. hole_09.json
```

The **sync script** bundles each pack folder into a single JSON file for server and client:

```
src/games/minigolf/courses/<pack>.json           (client bundle)
colyseus-server/src/games/minigolf/courses/<pack>.json  (server bundle)
```

---

## 4. Adding a New Hole

1. **Create the JSON file** in `shared/games/minigolf/courses/<pack>/hole_NN.json`.
2. **Follow the schema** above — include all required fields.
3. **Run validation**:
   ```bash
   npm run validate:minigolf
   ```
4. **Run sync** to bundle into client/server:
   ```bash
   npm run sync:minigolf
   ```
5. **Update the client courseLoader** if adding a new pack (not needed for new holes in existing packs):
   - Edit `src/games/minigolf/courseLoader.ts` — add a `require()` for the new pack JSON.
6. **Update the server courseLoader** if adding a new pack.

### Design Tips

- Keep holes **simple** — 1-2 mechanics per hole makes for better gameplay.
- Ensure the **tee** is reachable from all angles (not boxed in by walls).
- Place the **cup** in an area the ball can actually reach.
- Don't place **obstacles** directly on the tee or cup.
- **Sand** surfaces (high `frictionMul`) slow the ball dramatically.
- **Ice** surfaces (low `frictionMul`, e.g. 0.1–0.2) make the ball slide much farther.
- **Bumpers** bounce the ball off with `restitution` > 1.0 meaning the ball gains speed.
- **Spinners** rotate around their center, blocking the path periodically.
- **Moving gates** slide between `pointA` and `pointB`.

---

## 5. Running Validation

```bash
npm run validate:minigolf
```

The validator checks:

- All required keys present with correct types
- Bounds are positive
- Tee and cup are inside bounds
- Wall polygons are closed (≥3 vertices) and non-self-intersecting
- Cup is not trapped inside a wall polygon
- Obstacles don't overlap tee or cup positions
- Hazard and surface polygons are inside bounds

Errors are reported as `[packId/holeId] message` and the script exits with code 1 on failure.

---

## 6. Syncing Courses

```bash
npm run sync:minigolf
```

This reads individual hole JSON files from `shared/games/minigolf/courses/` and writes bundled pack JSON to both `src/games/minigolf/courses/` (client) and `colyseus-server/src/games/minigolf/courses/` (server).

---

## 7. Smoke Test — Playing Through Tutorial

1. **Start the Colyseus server**:

   ```bash
   cd colyseus-server && npm run dev
   ```

2. **Start two Expo clients** (two terminals or two devices):

   ```bash
   npm run start
   ```

3. **Player 1**: Navigate to Play → Mini-Golf Duels → tap **Invite** → select Player 2.

4. **Player 2**: Accept the invite notification or navigate via the invite link.

5. **Both players**: tap **Ready**. The countdown starts.

6. **Play through** the 3-hole tutorial pack:
   - Player whose turn it is drags on the canvas to aim and release to shoot.
   - Observe: ball rolls, surfaces affect speed, the turn alternates.
   - After hole 3, game-over modal shows winner by total strokes.

7. **Spectator test**: A third user can join via a spectator invite and should see:
   - "👁 Watching as spectator" banner
   - All ball movements in real-time
   - No ability to aim or shoot

---

## 8. Pack Overview

| Pack     | Holes | Theme         | Key Mechanics                                         |
| -------- | ----- | ------------- | ----------------------------------------------------- |
| tutorial | 3     | Beginner      | Straight shot, gentle bend, sand intro                |
| neon     | 9     | Neon/sci-fi   | Bumpers, spinners, gates, ice, water, sand            |
| garden   | 9     | Garden/nature | Hedge walls, water, sand, ice, windmill spinner, gate |
| toybox   | 9     | Toy/playful   | Bumpers, ice, water, sand, spinner, gate, maze walls  |
