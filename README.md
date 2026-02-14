# Tropical Island Fishing - Phase 5

Phase 5 adds polish, QoL, and performance controls while keeping all locked gameplay rules unchanged.

## Core Status

- Active zones in current reimplementation: Beach and River
- Beach now has two signature fishing POIs (Pier Edge + Reef Shore), both water-adjacent
- 17 fish per zone with locked rarity split
- Per-player local progression in online rooms
- Multiplayer sync remains minimal:
  - transform + fishing state icons + celebration ping
  - no syncing of gold/inventory/bestiary/rods/quests
- Spectate join rejected server-side at handshake
- Party bonus still applied at sell stands only:
  - `goldMult = 1 + 0.05 * (players - 1)`

## In-App Integration (Invite System)

- `TropicalFishingGame` now runs embedded inside the app via `WebView` (no external browser handoff).
- Existing invite route params are preserved:
  - `matchId` -> forwarded as fishing `inviteCode`
  - `spectatorMode` -> forwarded as `mode=spectate` (server rejects handshake as required)
- Embedded bridge posts room status back to the native shell for in-app session visibility.
- Fishing multiplayer room is registered in the shared Colyseus server:
  - room name: `island_room`
  - room matching key: `firestoreGameId` (same invite-session pattern as other Colyseus games)
  - room cap: `10`
  - `mode: "spectate"` rejected during handshake.

## Phase 5 Additions

- Zone visual presets (lighting, fog, water tint/pulse) applied by zone
- Audio manager:
  - user-gesture unlock
  - SFX set + zone ambience
  - master/SFX/music/mute controls
- Particle/VFX manager:
  - bite/catch/fail effects
  - legendary/mythic celebration bursts
- Mesh audit debug toggle:
  - wireframe + double-side debug view
  - warnings for plane geometry / front-side-only materials
- Inventory QoL:
  - sort: rarity, sell value, zone, newest
  - filter: zone and Rare+
  - quick sell: commons, commons+uncommons, keep rares+
- Sell safety:
  - confirmation prompt when selling includes Rare+
- Diagnostics overlay (optional):
  - FPS, player count, draw calls, zone
- Performance pass:
  - static instancing pass for repeated world props
  - distance culling for instance-candidate objects
  - particle budget + render settings from quality presets
- Stability:
  - save schema v5 with settings + migration report
  - online join failure now falls back to solo mode cleanly
  - reset save requires confirmation

## Project Layout

- `client/` - three.js + Vite + TypeScript
- `server/` - Colyseus + TypeScript

## Run Server (Shared Colyseus + Embedded Fishing Host)

```bash
cd client
npm install
npm run build

cd colyseus-server
npm install
npm run dev
```

Server default: `http://localhost:2567`  
Health: `http://localhost:2567/health`
Fishing host (embedded): `http://localhost:2567/fishing`

## Run Client

```bash
npm start
```

Optional env var:

- `EXPO_PUBLIC_FISHING_GAME_URL` (override embedded host when needed)

## Build Validation

```bash
cd client
npm run typecheck
npm run build

cd ../colyseus-server
npm run build
```

## Debug / Perf Toggles

In the fishing client runtime:

- `G` key: grant `+200` gold (dev economy test)
- `M` key: toggle mesh audit mode (wireframe + closed-mesh warnings)
- `C` key: toggle culling debug markers (green visible / red culled groups)
- `P` key: toggle POI markers (interactable rings/bases)
- `Z` key: toggle zone volume markers (Beach/River bounds)

Settings panel toggles still available for:

- graphics quality (`low` / `medium` / `high`)
- diagnostics overlay (FPS / draw calls / zone)
- mesh audit
- decay grace

## Multiplayer Quick Test (2 tabs/devices)

1. Start server + client.
2. On client A click `Play Online`.
3. Use `Copy Invite Link`.
4. Open link on client B (`?roomId=<ID>&mode=join`).
5. Confirm room/player panel updates on both clients.
6. Move and fish on one client; verify remote avatar smoothing + fishing state icon updates.
7. Sell fish and confirm party bonus changes payout only at sell stands.

Invite mode behavior:

- `?roomId=<id>&mode=join` -> join as player
- `?roomId=<id>&mode=game` -> join as player
- `?roomId=<id>&mode=spectate` -> rejected by server; client falls back gracefully

## Embedded Client Timeout Troubleshooting

If the in-app fishing screen shows "Failed to load embedded fishing client" or "No reachable fishing host":

1. Build the fishing bundle once:
   - `cd client`
   - `npm run build`
2. Start Colyseus:
   - `cd colyseus-server`
   - `npm run dev`
3. Validate host directly in browser:
   - `http://localhost:2567/fishing/health` should return `ok: true`
   - `http://localhost:2567/fishing` should load the game shell
4. In app, tap `Retry` on the fishing screen.
5. Check probe report in the error card:
   - app now probes integrated host candidates first (`:2567/fishing`) before standalone Vite host candidates (`:5173`).
6. Optional standalone mode (if you want rapid web iteration):
   - `cd client && npm run dev -- --host`
7. If your host is non-standard, set:
   - `EXPO_PUBLIC_FISHING_GAME_URL=http://<your-host>/fishing`

## Active Scope

- Current world build intentionally includes Beach + River only.
- Non-current zones (Cave/Volcano/Oasis) and their world assets/interactables were removed from the active map.
- Their systems remain non-visible/inactive placeholders only, to keep shared runtime hooks stable.

## Beach + River World Layout

Beach/Port now has a full tiered hub layout:

- Tier 0 shoreline + chunky pier + ocean/reef water
- Tier 1 dunes/bluff traversal band
- Tier 2 plaza with Rod Shop + Bait Shop + quest/NPC pocket
- Overlook hill landmark and jump-route style stepped depth
- Clear connectors: River Path, Cave Trail hint, Volcano direction silhouette

River is a connected valley-loop from the Beach trailhead:

- Entry corridor with biome shift and rope bridge landmark
- Raised bank trail and loop-back ridge path
- Sell stand clearing near the main circulation route
- Waterfall endcap with calm pool fishing platform
- Ranger post near bridge, plus challenge trail branch

Primary River points:

- `River Ranger`: near rope bridge (`x~36.4 z~19.4`)
- `River Sell Stand`: bright clearing on main bank trail (`x~49.2 z~21.6`)
- `River Fishing Spot`: calm pool near waterfall (`x~63.6 z~6.7`)
- `Challenge Trail`: branch below the bridge (`x~39.8 z~-2.3`)

Primary Beach points:

- `Pier Edge Fishing`: `x~2.2 z~21.8`
- `Reef Shore Fishing`: `x~13.2 z~4.2`
- `Beach Sell Stand`: `x~-6.4 z~18`
- `Rod Shop`: `x~-21.8 z~44.1`
- `Bait Shop`: `x~-12 z~44.1`

## Beach + River Verification Walkthrough

1. Spawn on the pier and confirm ocean + chunky pier posts + welcome sign are visible.
2. Walk inland to the plaza and verify clear tier transitions (shore -> dunes/bluff -> plaza).
3. Visit both Beach fishing POIs:
   - pier edge platform (`beach_fishing_spot`)
   - reef shore platform (`beach_reef_fishing_spot`)
4. Follow the River Path and confirm biome transition, rope bridge landmark, and River zone label.
5. Reach River Sell Stand then continue to the waterfall basin fishing platform.
6. Toggle debug views:
   - `C` culling markers
   - `P` POI markers
   - `Z` zone bounds
   - `M` mesh audit
7. Confirm movement stays smooth on ramps/slopes and no obvious see-through undersides appear.

## World Tuning Knobs

- Terrain heights and slope behavior:
  - `client/src/engine/world/terrain/TerrainBuilder.ts`
- Beach POIs/landmarks:
  - `client/src/engine/world/layout/BeachPortLayout.ts`
- River POIs/path/water nodes:
  - `client/src/engine/world/layout/RiverLayout.ts`
- Zone fog/light/water behavior:
  - `client/src/data/zoneVisuals.ts`
- Culling aggressiveness:
  - `client/src/engine/perf/WorldCullingController.ts`

## Phase 5 Verification Checklist

- [ ] Visual: active zones (Beach/River) have distinct fog/light/water feel and remain readable
- [ ] Visual: no visible see-through undersides on world props (use mesh audit toggle)
- [ ] Audio: SFX/ambience start after first user gesture; volume sliders and mute work
- [ ] VFX: bite/catch/fail particles trigger correctly
- [ ] VFX: legendary/mythic catches show celebration effects locally and above remote players
- [ ] QoL: inventory sort/filter works across all options
- [ ] QoL: quick sell buttons work; Rare+ confirmation appears for risky sell actions
- [ ] QoL: bait consumption reminder is visible in fishing UI
- [ ] Performance: quality settings (Low/Medium/High) reduce/increase rendering load
- [ ] Performance: world instancing/culling active; diagnostics overlay shows draw calls/FPS
- [ ] Stability: room join failures return player to solo mode without crash
- [ ] Stability: local save migrates without data loss; reset save asks for confirmation
- [ ] Multiplayer: spectate mode still rejected; progression remains local per player

## Dev Controls

- `G` key: grant `+200` gold
- `M` key: toggle mesh audit
- `C` key: toggle culling debug markers
- `P` key: toggle POI marker visibility
- `Z` key: toggle zone volume overlays
- Settings panel:
  - graphics quality
  - diagnostics toggle
  - mesh audit toggle
  - decay micro-grace toggle
  - reset save

