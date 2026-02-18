# Calls + Camera Audit

Last updated: 2026-02-18

## Scope

This document captures the current calls/camera subsystem reality, gating, and safe enablement constraints.

## Calls: What Exists

- Provider/runtime state:
  - `src/contexts/CallContext.tsx`
- App bootstrap integration:
  - `App.tsx` (`CallProvider`, background init helpers, incoming overlay)
- Service entry surface:
  - `src/services/calls/index.ts`
- Native/background call handling:
  - `src/services/calls/backgroundCallHandler.ts`
  - `src/services/calls/callKeepService.ts`
  - `src/services/calls/voipPushService.ts`
- UI components/screens:
  - `src/components/calls/*`
  - `src/screens/calls/*`
  - call entrypoints in chat/profile/group screens

## Camera: What Exists

- Provider/state:
  - `src/store/CameraContext.tsx`
- Primary screen:
  - `src/screens/camera/CameraScreen.tsx`
- Backend service routing:
  - `src/services/camera/cameraService.ts`
- Permission utility:
  - `src/utils/permissions.ts`

## Gating Matrix

### Calls (feature + platform)

- Feature gate:
  - `constants/featureFlags.ts` -> `CALL_FEATURES.CALLS_ENABLED` (default `false`)
- Platform gate:
  - native calls require not web and not Expo Go
  - see `src/utils/platform.ts` and repeated runtime checks in calls modules

### Calls UI entrypoints

- Root call routes are only registered when calls are enabled:
  - `src/navigation/RootNavigator.tsx` (`CALL_FEATURES.CALLS_ENABLED`)
- DM header call buttons are hidden when calls are disabled:
  - `src/components/calls/CallButton.tsx` (`CallButtonGroup`)
- Group chat call actions are gated before start:
  - `src/screens/groups/GroupChatScreen.tsx`
- Profile call action is now gated by feature + native availability:
  - `src/screens/profile/UserProfileScreen.tsx`
  - `src/components/profile/ProfileActions/ProfileActionsBar.tsx`

### Calls service/background listeners

- App-level call bootstrap helpers are always invoked in `App.tsx`, but service entry now short-circuits when calls are disabled:
  - `src/services/calls/index.ts`
  - `initializeBackgroundCallHandler()`
  - `initializeAppStateListener()`
  - `createCallNotificationChannel()`
- `CallProvider` now returns no-op context unless both are true:
  - native runtime available
  - `CALL_FEATURES.CALLS_ENABLED`
  - file: `src/contexts/CallContext.tsx`

### Camera backend gating

- Backend gate:
  - `constants/featureFlags.ts` -> `USE_VISION_CAMERA` (default `false`)
- Camera screen and service dynamically choose backend:
  - `src/screens/camera/CameraScreen.tsx`
  - `src/services/camera/cameraService.ts`
- Permission code mirrors the same backend switch:
  - `src/utils/permissions.ts`

## Partially Integrated / Risk Notes

- Calls remain intentionally staged off by default (`CALL_FEATURES.*` mostly `false`).
- App-level call bootstrap calls still execute from `App.tsx`, but are now no-ops when feature-disabled via service-layer checks.
- Camera uses an Expo-compatible path by default (`USE_VISION_CAMERA=false`) for Expo Go compatibility.

## Segment 13 Safe Cleanup Performed

- Removed unused export with no callers:
  - `src/components/calls/index.ts` -> removed exported `areNativeCallsAvailable`
  - proof: repo-wide search for `areNativeCallsAvailable` showed no import usage from this barrel export

## Safe Enablement Checklist

1. Enable `CALL_FEATURES.CALLS_ENABLED` in a controlled environment (dev build only, not Expo Go).
2. Validate native runtime constraints:
   - CallKeep/WebRTC modules load correctly
   - incoming/outgoing call flows work across app foreground/background
3. Enable subordinate call flags incrementally (`AUDIO_CALLS_ENABLED`, `VIDEO_CALLS_ENABLED`, `GROUP_CALLS_ENABLED`).
4. Keep `USE_VISION_CAMERA=false` unless running dev-client/production builds that include VisionCamera native modules.
5. After any flag flips, rerun:
   - `npm run type-check`
   - `npm run lint`
   - `npm run test -- --ci --watchAll=false --no-cache`
