# Performance Notes

Last updated: 2026-02-18

## Scope

This is a practical performance guide for `snapstyle-mvp` focused on startup work, render hotpaths, and local-first sync behavior.

## Startup Hotspots

- `App.tsx` pre-UI side effects:
  - Firebase init and orientation lock are intentionally early.
  - Call bootstrap hooks (`initializeBackgroundCallHandler`, `initializeAppStateListener`, `createCallNotificationChannel`) are now deferred until after first render and only when `CALL_FEATURES.CALLS_ENABLED` is enabled.
- Provider stack depth:
  - App mounts multiple global providers; avoid adding heavy sync work in provider constructors/effects.

## Render Hotpaths

- Chat and game screens render frequently and process large lists/state.
- Avoid introducing unstable inline objects/functions into deeply nested list items.
- Keep expensive derived state in memoized selectors/hooks instead of render-time transforms.

## Local-First Sync Behavior

- Outbox processing entrypoint:
  - `src/hooks/useOutboxProcessor.ts`
- Existing safeguards:
  - auth guard
  - concurrent-processing guard
  - throttle window (`MIN_PROCESS_INTERVAL = 5000ms`)
- Segment 14 hardening:
  - outbox processing now only triggers on true `background|inactive -> active` transitions (not every `active` event), reducing resume churn.

## Profiling Tips

1. Use React Native performance tools/flipper while exercising:
   - chat list scrolling
   - camera capture/editor transitions
   - multiplayer lobby transitions
2. Add temporary timing logs around:
   - first navigation after app launch
   - outbox processing cycle duration
   - game screen mount + first interaction
3. Track before/after for any optimization with the same user path and device class.

## Anti-Patterns To Avoid

- Running optional subsystem bootstrap (calls/camera extras) at module-eval time.
- Triggering sync work on every app-state event without transition checks.
- Adding new provider-level side effects that block first paint.
- Premature memoization everywhere; only memoize measured hotpaths.
