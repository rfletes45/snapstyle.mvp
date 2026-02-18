# Embedded Web Games Contract

Last updated: 2026-02-18

## Scope

This repo currently uses a Starforge embedded-web pattern (RN `WebView` + web client bundle + Colyseus room), not the older `client/` package shape referenced in some historical docs.

Primary runtime pieces:

- RN wrapper: `src/screens/games/StarforgeGameScreen.tsx`
- URL + host resolution: `src/config/starforgeGame.ts`
- Embedded web app: `starforge-viewer/src/main.ts`, `starforge-viewer/src/game/gameMain.ts`
- Web join adapter: `starforge-viewer/src/game/net/roomAdapter.ts`
- Co-located hosting on Colyseus server: `colyseus-server/src/services/starforgeClientHost.ts`

## End-to-End Flow

1. RN screen resolves reachable base host from `getStarforgeBaseUrlCandidates()`.
2. RN probes host availability (`/?embed_probe=1`) and selects first reachable candidate.
3. RN builds launch URL with query params and loads WebView.
4. Web app parses query params, initializes game, and joins Colyseus when `server` is provided.
5. Web app posts bridge events (`session_info`, `error`, `back`, `spectator_count`) to RN.
6. RN handles error/retry/back and keeps game embedded in-app.

## URL Param Contract

`buildStarforgeGameUrl(...)` in `src/config/starforgeGame.ts` is the canonical source for launch params.

| Param | Source | Used by |
| --- | --- | --- |
| `server` | RN base URL -> derived WS endpoint | `starforge-viewer/src/game/gameMain.ts` |
| `room` | RN (`starforge`) | `starforge-viewer/src/game/gameMain.ts` |
| `firestoreGameId` | RN route `matchId`/`roomId` | `starforge-viewer/src/game/gameMain.ts` -> join options |
| `inviteId` | RN route `inviteId` | `starforge-viewer/src/game/gameMain.ts` -> join/session metadata |
| `traceId` | RN route `traceId` or generated `createTraceId("gs")` | `starforge-viewer/src/game/gameMain.ts` -> join/session metadata |
| `role` | RN `spectatorMode` mapping | web HUD + join role (`player`/`spectator`) |
| `mode` | RN launch mode (`game`/`join`/`spectate`) | web app mode handling |
| `source` | RN entry point | web analytics/debug context |
| `embedded=1` | RN WebView launch | web bridge/back behavior |

## Bridge Contract (Web -> RN)

Current bridge source: `starforge-viewer/src/main.ts` and `starforge-viewer/src/game/net/roomAdapter.ts`.

| `type` | Payload | RN handling |
| --- | --- | --- |
| `error` | `{ source, type, message }` | sets load error state and retry UI |
| `back` | `{ source, type }` | exits WebView screen (safe back fallback) |
| `session_info` | `{ source, type, sessionId, mode, firestoreGameId, inviteId, traceId }` | session/debug info display in dev |
| `spectator_count` | `{ source, type, count }` | available for spectator UI/telemetry |

## Hosting Assumptions

- Preferred production/dev co-location path: Colyseus Express mounts `starforge-viewer/dist` at `/starforge` via `attachStarforgeClientRoutes(...)`.
- Build command for bundle:
  - `cd starforge-viewer && npm run build`
- If bundle is missing, `/starforge*` returns `503` with remediation guidance.
- Host override is supported via `EXPO_PUBLIC_STARFORGE_GAME_URL`.

## Failure + Recovery Behavior

In `src/screens/games/StarforgeGameScreen.tsx`:

- host probe timeout uses `AbortController` (`PROBE_TIMEOUT_MS`).
- offline classification is explicit (`expo-network` check on probe failure).
- non-reachable hosts produce actionable error card (dev + co-located instructions).
- retry remounts WebView by incrementing key.
- external links are blocked by origin check.

## Navigation / Unmount Safety

- Back from web HUD posts `type: "back"` and RN exits screen.
- RN exit path now safely falls back to `MainTabs -> Play -> GamesHub` when no navigation back stack exists.
- Probe effect uses cancellation guard to avoid stale state updates after unmount.
- Status bar immersion state is restored on unmount.

## Related Docs

- `docs/GAMES_PLATFORM.md`
- `docs/COLYSEUS_SERVER.md`
- `docs/CONFIGURATION.md`
