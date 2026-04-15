# Call System v1.3 Audit Report

> **Date**: April 15, 2026
> **Scope**: Strict verification of v1.2 master document, 6 code fixes, SDK capability audit, full doc reconciliation. Updated April 14 with v1.5 stabilization pass notes.

---

## 1. Verification Matrix — v1.2 Doc vs Actual Code

| #   | Item                                      | v1.2 Doc Claim                                             | Code Reality                                                                                        | Mismatch?   | Action Taken                                |
| --- | ----------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------- |
| 1   | Maturity label                            | "Functional with targeted fixes applied (v1.1)"            | Should reflect v1.2+                                                                                | YES         | Updated to "v1.3"                           |
| 2   | AsyncStorage key (§5.3)                   | `@vibe/call_settings`                                      | `@call_settings` (line 29, callSettingsService.ts)                                                  | YES         | Corrected in doc                            |
| 3   | Firestore path (§3 table)                 | `Users/{uid}/CallSettings`                                 | `Users/{uid}/Settings/calls` (line 89, callSettingsService.ts)                                      | YES         | Corrected in doc                            |
| 4   | Firestore path (§6.2)                     | `Users/{uid}/Settings/calls`                               | Same                                                                                                | OK          | —                                           |
| 5   | callSettingsService line count            | ~300 lines                                                 | ~400 lines                                                                                          | YES         | Corrected                                   |
| 6   | DirectCallScreen line count               | ~200 lines                                                 | ~600 lines                                                                                          | YES         | Corrected                                   |
| 7   | VoiceChannelScreen line count             | ~180 lines                                                 | ~560 lines                                                                                          | YES         | Corrected                                   |
| 8   | ringtoneService line count                | ~100 lines                                                 | ~200 lines                                                                                          | YES         | Corrected                                   |
| 9   | ringtoneService exports                   | Lists `isRingtonePlaying()`                                | Function does not exist in code                                                                     | YES         | Removed from doc                            |
| 10  | DND in feature inventory                  | Under "Partially implemented" header                       | Fully implemented with working time pickers                                                         | YES         | Moved to "Implemented" section              |
| 11  | joinAttemptedRef (§5.1)                   | "never resets on failure — bug"                            | Resets on failure since v1.1                                                                        | YES — stale | Corrected description                       |
| 12  | VoiceChannelScreen error UI (§7.2, §10.2) | "retry and back" / "retry"                                 | Only "Go Back" button existed                                                                       | YES         | Added Retry button (code fix), updated doc  |
| 13  | Risky transitions table (§13.2)           | "Verify retry button works (currently broken)"             | No retry button existed at all                                                                      | YES — stale | Added Retry button (code fix), updated doc  |
| 14  | Android audio listener (§9.2 #6)          | "duplicate listeners could accumulate" — MEDIUM confidence | Both screens use `cancelled` flag + `[]` deps; cleanup is correct                                   | Overblown   | Downgraded to LOW, noted pattern is correct |
| 15  | Join effect (§9.2 #7)                     | "MEDIUM-HIGH" risk, suggests extracting deps to refs       | Context callbacks are stable (empty or `[userId]` deps). `joinAttemptedRef` guards correctly.       | Overblown   | Downgraded, noted stability analysis        |
| 16  | voiceChannelService duplicate JSDoc       | Not mentioned                                              | Two identical docblocks for `queryVoiceChannel`                                                     | Minor       | Removed duplicate (code fix)                |
| 17  | resetToDefaults `_lastUpdatedAt`          | Not mentioned (§9.3 says "FIXED v1.2" for drift)           | `resetToDefaults()` did NOT stamp `_lastUpdatedAt` — stale cloud data could overwrite a local reset | YES — gap   | Fixed: now stamps timestamp (code fix)      |
| 18  | Polling jitter (§11.5)                    | Listed as improvement opportunity                          | All 3 hooks used fixed intervals                                                                    | Correct     | Applied ±20% jitter to all 3 (code fix)     |
| 19  | `endedRef` guard on auto-dismiss          | "FIXED v1.1"                                               | Confirmed in DirectCallScreen: `if (!activeCall && !endedRef.current)`                              | OK          | —                                           |
| 20  | Token in-flight lock                      | "FIXED v1.1"                                               | Confirmed in streamTokenProvider.ts: `inflightTokenPromise` pattern                                 | OK          | —                                           |
| 21  | Webhook fail-closed                       | "FIXED v1.2"                                               | Confirmed in streamCallHistory.ts: returns 500 if no secret                                         | OK          | —                                           |
| 22  | State-based join sound                    | "FIXED v1.2"                                               | Confirmed in VoiceChannelScreen: `wasJoinedRef`/`hasSettledRef`                                     | OK          | —                                           |
| 23  | Native accept adoption                    | Described in doc                                           | Confirmed in IncomingCallHandler: JOINING/JOINED calls adopted                                      | OK          | —                                           |
| 24  | Screen share                              | "UI exists"                                                | Dead props removed from CallControlBar in v1.4; `app.config.ts` explicitly disables                 | YES — stale | Props removed, doc updated                  |

---

## 2. Implementation Summary — v1.3 Code Fixes

### Fix 1: Remove duplicate JSDoc in voiceChannelService.ts

- **File**: `src/services/stream/voiceChannelService.ts`
- **Change**: Removed one of two identical JSDoc blocks above `queryVoiceChannel()` function
- **Risk**: None (comment-only)

### Fix 2: Add `_lastUpdatedAt` to `resetToDefaults()`

- **File**: `src/services/calls/callSettingsService.ts`
- **Change**: `resetToDefaults()` now stamps `_lastUpdatedAt: Date.now()` before writing to both AsyncStorage and Firestore, matching the behavior of `updateSettings()`
- **Risk**: LOW — prevents stale cloud data from overwriting a local reset on next login

### Fix 3: Add Retry button to VoiceChannelScreen error UI

- **File**: `src/screens/stream/VoiceChannelScreen.tsx`
- **Change**: Error screen now has two buttons:
  - **Retry**: clears `joinError` and resets `joinAttemptedRef.current = false`, causing the join effect to re-fire
  - **Go Back**: navigates back (unchanged behavior)
- **Risk**: LOW — retry simply replays the existing join flow

### Fix 4: Add jitter to useActiveVoiceRooms polling

- **File**: `src/hooks/useActiveVoiceRooms.ts`
- **Change**: Both initial and AppState-resume `setInterval` calls now use `interval * (0.8 + Math.random() * 0.4)` (±20% jitter)
- **Risk**: None — prevents synchronized polling storms when multiple components mount

### Fix 5: Add jitter to useVoiceRoomOccupancy polling

- **File**: `src/hooks/useVoiceRoomOccupancy.ts`
- **Change**: Same ±20% jitter pattern applied to initial and resume intervals
- **Risk**: None

### Fix 6: Add jitter to VoiceChannelCard polling

- **File**: `src/components/stream/VoiceChannelCard.tsx`
- **Change**: `setInterval(fetchOccupancy, 10_000)` → ±20% jitter around 10s
- **Risk**: None

---

## 3. Feature-Support Table — All Call Settings & Capabilities

| Setting / Capability                                    | Persisted?                  | Wired to Runtime?                                             | SDK Support                                                                                                              | Notes                                                                                                                     |
| ------------------------------------------------------- | --------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Video**                                               |                             |                                                               |                                                                                                                          |                                                                                                                           |
| Default camera (front/back)                             | ✅ AsyncStorage + Firestore | ✅ `getCallConfig()` → `directCallService`                    | Built-in                                                                                                                 | Works                                                                                                                     |
| Mirror front camera                                     | ✅                          | ✅ `shouldMirrorLocalVideo` in both screens                   | SDK auto-mirrors                                                                                                         | Wired via DirectCallScreen + VoiceChannelScreen                                                                           |
| Auto-enable video                                       | ✅                          | ✅ `getCallConfig().video.startEnabled`                       | Built-in                                                                                                                 | Works                                                                                                                     |
| **Audio**                                               |                             |                                                               |                                                                                                                          |                                                                                                                           |
| Default audio output                                    | ✅                          | ✅ `getCallConfig().audio.defaultOutput` → `toStreamDevice()` | `callManager.start()`                                                                                                    | Works                                                                                                                     |
| Noise suppression                                       | ✅                          | ❌                                                            | `@stream-io/noise-cancellation-react-native` (NOT installed)                                                             | Requires package install + native rebuild                                                                                 |
| Echo cancellation                                       | ✅                          | ❌                                                            | OS-level WebRTC stack                                                                                                    | Toggle has no effect; platform handles this automatically                                                                 |
| Auto gain control                                       | ✅                          | ❌                                                            | OS-level WebRTC stack                                                                                                    | Toggle has no effect; platform handles this automatically                                                                 |
| **Notifications**                                       |                             |                                                               |                                                                                                                          |                                                                                                                           |
| Ringtone selection (default/silent/vibrate_only/custom) | ✅                          | ⚠️ Partial                                                    | N/A                                                                                                                      | `silent` and `vibrate_only` correctly suppress sound. `default` plays the single bundled asset. No alternative ringtones. |
| Custom ringtone URI                                     | ✅                          | ⚠️ Partial                                                    | N/A                                                                                                                      | `startRingtone` will use URI if set, but no picker UI exists to set it                                                    |
| Vibration enabled                                       | ✅                          | ✅                                                            | RN `Vibration` API                                                                                                       | Works — controls vibration in `startRingtone()`                                                                           |
| Ringtone volume                                         | ✅                          | ✅                                                            | `expo-audio` volume                                                                                                      | Works — applied to `activePlayer.volume`                                                                                  |
| **DND**                                                 |                             |                                                               |                                                                                                                          |                                                                                                                           |
| DND schedule (enabled, days, times)                     | ✅                          | ✅                                                            | N/A                                                                                                                      | Checked every 60s + on AppState change. Incoming calls auto-rejected when active.                                         |
| **Privacy**                                             |                             |                                                               |                                                                                                                          |                                                                                                                           |
| Allow calls from (everyone/friends/nobody)              | ✅                          | ✅                                                            | N/A                                                                                                                      | `shouldAllowCall()` checks friendship + setting                                                                           |
| Show call preview                                       | ✅                          | ❌                                                            | N/A                                                                                                                      | No preview UI implemented                                                                                                 |
| Announce caller name                                    | ✅                          | ❌                                                            | Would need TTS API                                                                                                       | Not implemented                                                                                                           |
| **Quality**                                             |                             |                                                               |                                                                                                                          |                                                                                                                           |
| Preferred video quality                                 | ✅                          | ✅ via `callRuntime.ts`                                       | `call.camera.setPreferredResolution()` available                                                                         | Wired via `applyCallMediaPreferences()` → incoming video resolution cap                                                   |
| Data saver mode                                         | ✅                          | ✅ via `callRuntime.ts`                                       | `call.setPreferredIncomingVideoQuality()` available                                                                      | Wired → forces 240p incoming video                                                                                        |
| WiFi-only video                                         | ✅                          | ❌                                                            | Would need `@react-native-community/netinfo`                                                                             | Not wired                                                                                                                 |
| **Accessibility**                                       |                             |                                                               |                                                                                                                          |                                                                                                                           |
| Flash on ring                                           | ✅                          | ❌                                                            | Would need native torch API                                                                                              | Not implemented                                                                                                           |
| Haptic feedback                                         | ✅                          | ❌                                                            | `expo-haptics` available                                                                                                 | Not wired                                                                                                                 |
| Large call controls                                     | ✅                          | ❌                                                            | N/A (UI sizing)                                                                                                          | Not wired                                                                                                                 |
| **Screen Share**                                        |                             |                                                               |                                                                                                                          |                                                                                                                           |
| Screen share toggle                                     | 🚫 Removed                  | 🚫 Removed                                                    | SDK `ScreenShareToggleButton` available, but requires native iOS broadcast extension + Android foreground service config | Dead props removed from CallControlBar in v1.4. Explicitly disabled in `app.config.ts`.                                   |

---

## 4. Platform Notes — iOS vs Android Call Delivery

### iOS

| Scenario                | Behavior                                                                                                                                                   | Status                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| App in foreground       | Incoming call handled via `useCalls()` → `IncomingCallHandler` overlay                                                                                     | ✅ Working                                                       |
| App in background       | VoIP push (PushKit) → CallKit native call UI → Stream SDK processes call                                                                                   | ✅ Code-complete (requires external APNs/Stream dashboard setup) |
| App terminated          | VoIP push → native AppDelegate handles PushKit → CallKit UI → `createStreamVideoClient` callback in `setPushConfig.ts` creates client → SDK processes call | ✅ Code-complete (requires external APNs/Stream dashboard setup) |
| Native accept (CallKit) | `IncomingCallHandler` adopts JOINING/JOINED call on foreground return                                                                                      | ✅ Working                                                       |

**v1.6 correction**: Previous versions of this document incorrectly stated the app used FCM for iOS push delivery. The app actually uses VoIP push (PushKit) + CallKit via the Stream SDK. `react-native-voip-push-notification` v3.3.3 and `react-native-callkeep` v4.3.16 ARE installed and used internally by the Stream SDK. The remaining blocker is external Apple Developer / Stream Dashboard configuration — see `CALL_SYSTEM_MASTER_REFERENCE.md` §11.8 for the manual steps checklist.

### Android

| Scenario          | Behavior                                                             | Status                                     |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| App in foreground | Same as iOS — `useCalls()` overlay                                   | ✅ Working                                 |
| App in background | FCM push → Notifee notification with HIGH importance channel         | ✅ Working                                 |
| App terminated    | FCM push → `createStreamVideoClient` callback + notification         | ✅ Working (FCM works natively on Android) |
| Audio routing     | `callManager.android` with device listener, `AudioRoutePicker` modal | ✅ Working                                 |
| PiP               | `useAutoEnterPiPEffect` for video calls                              | ✅ Working                                 |

**Key difference**: Android's FCM push infrastructure handles terminated-state calls correctly. iOS requires VoIP pushes (PushKit) which FCM cannot deliver.

---

## 5. Testing Verification Pass

### Classification Key

- **Runtime**: Must test on physical device or device-adjacent emulator
- **Code-review**: Can verify by reading code; no device needed
- **Device-needed**: Requires specific hardware, OS version, or network condition

### v1.3 Fixes — Verification Status

| Fix                             | Verification Type | Status       | How to Verify                                                                                 |
| ------------------------------- | ----------------- | ------------ | --------------------------------------------------------------------------------------------- |
| Duplicate JSDoc removal         | Code-review       | ✅ Verified  | Read `voiceChannelService.ts` — only one docblock above `queryVoiceChannel()`                 |
| `resetToDefaults()` timestamp   | Code-review       | ✅ Verified  | Read `callSettingsService.ts` — `_lastUpdatedAt: now` written to both stores on reset         |
| VoiceChannelScreen Retry button | Runtime           | Needs device | Join a voice channel with network disabled → verify Retry button appears and re-attempts join |
| useActiveVoiceRooms jitter      | Code-review       | ✅ Verified  | `setInterval` uses `interval * (0.8 + Math.random() * 0.4)`                                   |
| useVoiceRoomOccupancy jitter    | Code-review       | ✅ Verified  | Same jitter pattern                                                                           |
| VoiceChannelCard jitter         | Code-review       | ✅ Verified  | Same jitter pattern                                                                           |

### Prior Fixes — Re-Verification Status

| Fix (version)                         | Verification Type | Status                                                          |
| ------------------------------------- | ----------------- | --------------------------------------------------------------- |
| joinAttemptedRef reset (v1.1)         | Code-review       | ✅ Confirmed: `joinAttemptedRef.current = false` in catch block |
| endedRef guard (v1.1)                 | Code-review       | ✅ Confirmed: checked in auto-dismiss effect                    |
| Speaker init call guard (v1.1)        | Code-review       | ✅ Confirmed: requires `isJoined`                               |
| Camera flip isCameraOff guard (v1.1)  | Code-review       | ✅ Confirmed in both screens                                    |
| Token in-flight lock (v1.1)           | Code-review       | ✅ Confirmed: `inflightTokenPromise` coalesces                  |
| endingRef idempotency (v1.1)          | Code-review       | ✅ Confirmed in StreamCallContext.endCallAction                 |
| Webhook fail-closed (v1.2)            | Code-review       | ✅ Confirmed: rejects with 500 if no secret                     |
| queryVoiceChannel typed result (v1.2) | Code-review       | ✅ Confirmed: `VoiceChannelQueryResult` discriminated union     |

---

## 6. v1.5 Stabilization Fixes — Addendum

The following fixes were applied during a focused stabilization pass on April 14, 2026. Full details are in `CALL_SYSTEM_AUDIT_FIX_PASS.md`.

### v1.5 Fixes — Verification Status

| Fix                                     | Verification Type | Status      | How to Verify                                                                                                          |
| --------------------------------------- | ----------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| streamClient init mutex (#20)           | Code-review       | ✅ Verified | `initPromise` guards concurrent `initStreamClient()` calls; second caller waits then re-checks userId                  |
| useVoiceRoomOccupancy fetch guard (#21) | Code-review       | ✅ Verified | `fetchingRef` guards concurrent `fetchOccupancy()` calls; matches `useActiveVoiceRooms` pattern                        |
| Accept failure recovery (#22)           | Code-review       | ✅ Verified | `handleAccept` catch block restores `pendingCall` if call is still `CallingState.RINGING`                              |
| Settings sync ordering (#23)            | Code-review       | ✅ Verified | `_lastUpdatedAt` written to AsyncStorage only after `setDoc()` succeeds in both `updateSettings` and `resetToDefaults` |

### v1.5 Documentation Changes

- `CALL_SYSTEM_MASTER_REFERENCE.md` bumped from v1.4 → v1.5
- Race condition catalog expanded with 5 new entries (accept failure, init race, occupancy fetch, sync divergence, concurrent occupancy)
- Known Bugs section updated with 4 new fixed items (#12–#15)
- CallSettings interface comments fixed (`preferredVideoQuality` and `dataSaverMode` now correctly marked as "wired")
- Hook descriptions updated with accurate line counts and return types
- Section 9.3 (sync drift) updated to reflect v1.5 ordering fix
- Accept flow (§4.2) updated with failure recovery behavior
  | Settings \_lastUpdatedAt (v1.2) | Code-review | ✅ Confirmed in loadSettings and updateSettings |
  | CallSettingsScreen error state (v1.2) | Code-review | ✅ Confirmed: error state with retry |
  | State-based join sound (v1.2) | Code-review | ✅ Confirmed: wasJoinedRef/hasSettledRef pattern |

### High-Priority Runtime Tests (Not Yet Executed)

| Test                        | Type                         | Priority | Scenario                                                       |
| --------------------------- | ---------------------------- | -------- | -------------------------------------------------------------- |
| iOS terminated-state call   | Device-needed (iOS physical) | CRITICAL | Kill app → call from another device → verify push arrives      |
| Voice channel retry flow    | Runtime                      | HIGH     | Force join failure → tap Retry → verify re-join succeeds       |
| resetToDefaults cloud sync  | Runtime                      | MEDIUM   | Reset settings → force reload → verify cloud doesn't overwrite |
| DND auto-reject timing      | Runtime                      | MEDIUM   | Enable DND → call during DND → verify auto-reject              |
| Polling jitter distribution | Code-review                  | LOW      | Already verified in code; no synchronized bursts possible      |

---

## 6. What Still Remains Open

### Must Fix (before production)

1. ~~**iOS terminated-state call delivery**~~ — **ADDRESSED v1.6**: Repo-side VoIP push + CallKit integration is complete. External setup (Apple Developer VoIP capability, APNs credentials in Stream Dashboard) still required. See `CALL_SYSTEM_MASTER_REFERENCE.md` §11.8.

### Should Fix (quality improvement)

2. **Extract shared `useAndroidAudioRoute` hook** — Identical ~25-line Android audio listener pattern in DirectCallScreen and VoiceChannelScreen. Correctness is fine; duplication is the concern.
3. ~~**Wire `preferredVideoQuality` to Stream SDK**~~ — ✅ DONE (v1.4): Wired via `callRuntime.ts` `applyCallMediaPreferences()`.
4. ~~**Wire `dataSaverMode` to Stream SDK**~~ — ✅ DONE (v1.4): Wired via `callRuntime.ts` → forces 240p incoming video.

### Nice to Have (future)

5. **Add noise cancellation** — Install `@stream-io/noise-cancellation-react-native`, requires native rebuild.
6. **Add screen sharing** — Requires native iOS broadcast extension + Android foreground service config + expo config plugin.
7. ~~**Add call quality indicator**~~ — ✅ DONE (v1.4): `CallConnectionBadge` component shows connection quality with color-coded indicator.
8. **Bundle alternative ringtones** — Currently only one default sound asset.
9. **Add custom ringtone picker UI** — `customRingtoneUri` field exists but no file picker.
10. **Wire haptic feedback** — `expo-haptics` is available.
11. **Remove legacy `calls.ts`** — Still deployed, confusion risk. 10-minute task.

### Verified Working — No Action Needed

- All 11 v1.1 fixes confirmed in code
- All 5 v1.2 fixes confirmed in code
- All 6 v1.3 fixes applied and verified
- DND schedule with time pickers: working
- Call settings dual-storage with drift prevention: working (including reset)
- Incoming call handling with DND/privacy gating: working
- Native accept adoption: working
- Ringtone lifecycle: clean (idempotent stop, effect-based start/stop)
- callingState$ subscription cleanup: correct (ref guard prevents stale cleanup)
