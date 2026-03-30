# Calling Feature Production Audit — Complete

## Summary

All 7 issues (A–G) root-caused and fixed. Zero TypeScript errors across all modified files.

---

## Issue-by-Issue Root Causes & Fixes

### Issue A — Calls screen stuck on loading spinner

**Root cause:** `subscribeToStreamCallHistory()` returns a no-op when `getUserHistoryRef()` returns null (no auth). It never calls `onUpdate()`, so `isLoading` stays `true` forever. Additionally, the `onSnapshot` error callback was `() => {}` — all Firestore errors silently swallowed.

**Files modified:**

- `src/services/stream/streamCallHistoryService.ts` — `subscribeToStreamCallHistory` now accepts `onError` callback; calls `onUpdate([])` when no auth; logs subscription errors
- `src/hooks/useStreamCallHistory.ts` — Added `mountedRef` for cleanup safety; added `errorMessage` state; passes `onError` callback; ensures `loading` always resolves to `false`
- `src/screens/calls/CallsScreen.tsx` — Displays `errorMessage` from hook

---

### Issue B — Filter chips don't match Messages screen visually

**Root cause:** CallsScreen used `colors.primary` solid background + `colors.onPrimary` text for active chips. InboxTabs uses `colors.primary + "18"` (alpha) background + `colors.primary` text. Completely different visual treatment.

**Files modified:**

- `src/components/shared/FilterChips.tsx` — **NEW** shared component matching InboxTabs design tokens exactly
- `src/screens/calls/CallsScreen.tsx` — Replaced inline filter chip rendering with shared `FilterChips` component

**Design tokens (matching InboxTabs):**
| Token | Active | Inactive |
|---|---|---|
| Background | `colors.primary + "18"` | `isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"` |
| Border | `colors.primary + "40"` | transparent |
| Text color | `colors.primary` | `colors.textSecondary` |

---

### Issue C — Call settings fail to save

**Root cause:** `callSettingsService.updateSettings()` passes the full settings object (including optional `customRingtoneUri?: string`) to Firestore's `setDoc`. When `customRingtoneUri` is `undefined`, Firestore throws — it rejects `undefined` values.

**Files modified:**

- `src/services/calls/callSettingsService.ts` — `updateSettings()` and `resetToDefaults()` now strip `undefined` values via `JSON.parse(JSON.stringify(...))` before Firestore writes

---

### Issue D — Settings are decorative / don't affect runtime

**Root cause:** `directCallService.ts` and `voiceChannelService.ts` hardcoded all audio/video settings (`default_device: "speaker"`, `camera_default_on: mode === "video"`). Nothing read from `callSettingsService.getCallConfig()`.

**Files modified:**

- `src/services/stream/directCallService.ts` — `startDirectCall()` and `acceptDirectCall()` now read `callSettingsService.getCallConfig()` for `autoEnableVideo` (controls `camera_default_on`) and `defaultAudioOutput` (controls `default_device`)
- `src/services/stream/voiceChannelService.ts` — `joinVoiceChannel()` now reads `defaultAudioOutput` setting for `default_device`

**Mapping:**
| Setting | Stream SDK target | Wired? |
|---|---|---|
| `autoEnableVideo` | `video.camera_default_on` | ✅ Yes |
| `defaultAudioOutput` | `audio.default_device` | ✅ Yes (with earpiece/speaker mapping) |
| `noiseSuppression` | N/A (not in per-call settings_override) | ⚠️ Stored, not passable per-call |
| `echoCancellation` | N/A | ⚠️ Stored, not passable per-call |
| `autoGainControl` | N/A | ⚠️ Stored, not passable per-call |

Audio processing settings (noise suppression, echo cancellation, auto gain control) are WebRTC-level constraints managed by Stream's mobile SDK internally. They must be configured at the **call type level** via Stream Dashboard, not per-call override.

---

### Issue E — Calls screen not themed

**Root cause:** `CallSettingsScreen.tsx` imported static `theme` from `@/constants/theme` (always catppuccin-mocha defaults) instead of using the `useAppTheme()` hook. 34 references to `theme.colors.*` in both render methods and `StyleSheet.create` (which runs at module scope).

**Files modified:**

- `src/screens/calls/CallSettingsScreen.tsx` — Removed `import { theme }`, added `useAppTheme()` hook, stripped all color properties from `StyleSheet.create` (moved to inline styles since StyleSheet runs at module scope and can't use hook values), replaced all 34 `theme.colors.*` references with dynamic `colors.*`

---

### Issue F — Group call join fails with invalid `target_resolution`

**Root cause:** `voiceChannelService.joinVoiceChannel()` passed `video: { camera_default_on: false }` in `settings_override` for an `audio_room` call type. Stream validates all fields in `settings_override.video`, including `target_resolution`, which defaults to `{width: 0, height: 0}` and fails validation (must be ≥240).

**Files modified:**

- `src/services/stream/voiceChannelService.ts` — Removed `video` key from `settings_override` entirely for audio rooms

---

### Issue G — DM call fails because user doesn't exist in Stream

**Root cause:** `getStreamVideoToken` only generates JWT tokens — it never calls `client.upsertUsers()`. Stream requires users to exist server-side before they can be referenced as call members. The callee may never have initialized their own Stream client.

**Files modified:**

- `firebase-backend/functions/src/streamToken.ts` — `getStreamVideoToken` now upserts the authenticated caller; added new `ensureStreamUsers` callable for batch provisioning
- `firebase-backend/functions/src/index.ts` — Exports `ensureStreamUsers`
- `src/services/stream/streamUserProvisioning.ts` — **NEW** client-side utility `ensureStreamUsersExist()` that calls the Cloud Function
- `src/services/stream/directCallService.ts` — Calls `ensureStreamUsersExist([callerId, calleeId])` before `getOrCreate`
- `src/services/stream/index.ts` — Exports `ensureStreamUsersExist`

---

## Settings Truth Table

| UI Label                | Type Key                | Storage                  | Default      | Runtime Consumer                                               | Actual Effect                                                   |
| ----------------------- | ----------------------- | ------------------------ | ------------ | -------------------------------------------------------------- | --------------------------------------------------------------- |
| Default Camera          | `defaultCamera`         | AsyncStorage + Firestore | `"front"`    | `getCallConfig().video.facingMode`                             | ⚠️ Stored in config but not yet applied to SDK camera selection |
| Mirror Front Camera     | `mirrorFrontCamera`     | AsyncStorage + Firestore | `true`       | `getCallConfig().video.mirror`                                 | ⚠️ Stored in config but not yet consumed by UI                  |
| Auto-enable Video       | `autoEnableVideo`       | AsyncStorage + Firestore | `false`      | `directCallService` → `camera_default_on`                      | ✅ Controls camera on/off at call join                          |
| Default Audio Output    | `defaultAudioOutput`    | AsyncStorage + Firestore | `"earpiece"` | `directCallService` / `voiceChannelService` → `default_device` | ✅ Controls speaker vs earpiece                                 |
| Noise Suppression       | `noiseSuppression`      | AsyncStorage + Firestore | `true`       | —                                                              | ⚠️ Stream SDK manages internally; configure via Dashboard       |
| Echo Cancellation       | `echoCancellation`      | AsyncStorage + Firestore | `true`       | —                                                              | ⚠️ Stream SDK manages internally                                |
| Auto Gain Control       | `autoGainControl`       | AsyncStorage + Firestore | `true`       | —                                                              | ⚠️ Stream SDK manages internally                                |
| Ringtone                | `ringtone`              | AsyncStorage + Firestore | `"default"`  | `getCallConfig().notifications.ringtone`                       | ⚠️ Stored in config, needs ringtoneService integration          |
| Vibration               | `vibrationEnabled`      | AsyncStorage + Firestore | `true`       | `getCallConfig().notifications.vibration`                      | ⚠️ Stored in config, needs ringtoneService integration          |
| Do Not Disturb          | `dndSchedule`           | AsyncStorage + Firestore | disabled     | `shouldAllowCall()`                                            | ✅ DND logic fully implemented                                  |
| Allow Calls From        | `allowCallsFrom`        | AsyncStorage + Firestore | `"everyone"` | `shouldAllowCall()`                                            | ✅ Permission check implemented                                 |
| Show Caller Preview     | `showCallPreview`       | AsyncStorage + Firestore | `true`       | —                                                              | ⚠️ Needs OS notification integration                            |
| Announce Caller Name    | `announceCallerName`    | AsyncStorage + Firestore | `false`      | —                                                              | ⚠️ Needs TTS integration                                        |
| Preferred Video Quality | `preferredVideoQuality` | AsyncStorage + Firestore | `"auto"`     | `getCallConfig().video.preferredQuality`                       | ⚠️ Stored; Stream auto-adjusts quality                          |
| Data Saver Mode         | `dataSaverMode`         | AsyncStorage + Firestore | `false`      | —                                                              | ⚠️ Needs network condition logic                                |
| Wi-Fi Only Video        | `wifiOnlyVideo`         | AsyncStorage + Firestore | `false`      | —                                                              | ⚠️ Needs NetInfo integration                                    |
| Flash on Ring           | `flashOnRing`           | AsyncStorage + Firestore | `false`      | —                                                              | ⚠️ Needs native module                                          |
| Haptic Feedback         | `hapticFeedback`        | AsyncStorage + Firestore | `true`       | —                                                              | ⚠️ Needs Haptics integration                                    |
| Large Call Controls     | `largeCallControls`     | AsyncStorage + Firestore | `false`      | —                                                              | ⚠️ Needs call UI layout variant                                 |

**Legend:** ✅ = fully wired, ⚠️ = stored but needs further integration

---

## Test Plan

### Issue A — Loading state

1. Sign out → navigate to Calls tab → should show empty state (not spinner)
2. Sign in with account that has no call history → should show empty state with "No call history yet"
3. Sign in with call history → should load and display entries
4. Airplane mode → navigate to Calls → should show error message, not infinite spinner

### Issue B — Filter chips

1. Open Messages tab → screenshot filter chips
2. Open Calls tab → screenshot filter chips
3. Compare: background color, border, text color, border radius, pill shape should be identical
4. Switch theme → verify both tabs update to new theme colors

### Issue C — Settings persistence

1. Open Call Settings → toggle any setting → wait for spinner to stop → kill app → reopen → verify setting persisted
2. Sign out → open Call Settings → toggle → verify saves to AsyncStorage (no Firestore crash)
3. Toggle setting on device A → open on device B → verify Firestore sync

### Issue D — Settings runtime effect

1. Set `defaultAudioOutput` to "speaker" → make a call → verify audio routes to speaker
2. Set `autoEnableVideo` to false → start a "video" call → verify camera starts OFF
3. Set `autoEnableVideo` to true → start a video call → verify camera starts ON
4. Set DND schedule to current time → have another user call → verify call is blocked

### Issue E — Theme

1. Set theme to Neo Tokyo → open Call Settings → verify all colors match Neo Tokyo palette
2. Set theme to AMOLED → open Call Settings → verify black background, correct accent colors
3. Set theme to Catppuccin Latte (light) → verify light mode rendering
4. Check DND day buttons: active days should use `colors.primary` bg + `colors.onPrimary` text

### Issue F — Voice channel join

1. Join a voice channel → should succeed without `target_resolution` error
2. Verify audio works in voice channel
3. Check server logs: no 400 errors from Stream

### Issue G — DM calling

1. User A calls User B (who has never opened the app's call feature) → should connect
2. Check Firebase function logs: `upsertUsers` should appear for both caller and callee
3. User B should appear in Stream with their display name from Firestore profile

---

## Files Modified (Complete List)

| File                                              | Action                                                   |
| ------------------------------------------------- | -------------------------------------------------------- |
| `firebase-backend/functions/src/streamToken.ts`   | Modified — user upsert + new ensureStreamUsers function  |
| `firebase-backend/functions/src/index.ts`         | Modified — export ensureStreamUsers                      |
| `src/services/stream/streamUserProvisioning.ts`   | **Created** — client-side Cloud Function caller          |
| `src/services/stream/directCallService.ts`        | Modified — user provisioning + settings integration      |
| `src/services/stream/voiceChannelService.ts`      | Modified — removed video override + settings integration |
| `src/services/stream/index.ts`                    | Modified — export ensureStreamUsersExist                 |
| `src/services/stream/streamCallHistoryService.ts` | Modified — error callback + auth handling                |
| `src/services/calls/callSettingsService.ts`       | Modified — undefined stripping for Firestore             |
| `src/hooks/useStreamCallHistory.ts`               | Modified — error state + cleanup safety                  |
| `src/screens/calls/CallsScreen.tsx`               | Modified — shared FilterChips + error display            |
| `src/screens/calls/CallSettingsScreen.tsx`        | Modified — full dynamic theme migration                  |
| `src/components/shared/FilterChips.tsx`           | **Created** — shared filter chip component               |
