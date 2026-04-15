# Git Diff Report — Unstaged Changes

> **Generated**: April 14, 2026
> **Compared to**: Last commit `f30caca` ("Refactor code structure for improved readability and maintainability")
> **Total**: 22 modified files, 3 new (untracked) files — +2,185 / −892 lines

---

## Summary of Changed Files

| #   | File                                                  | Lines Changed       | Category                         |
| --- | ----------------------------------------------------- | ------------------- | -------------------------------- |
| 1   | `firebase-backend/functions/src/calls.ts`             | +18 / −4            | Backend — Legacy deprecation     |
| 2   | `firebase-backend/functions/src/gamesV4/resolve.ts`   | +11 / −3            | Backend — Achievement names      |
| 3   | `firebase-backend/functions/src/streamCallHistory.ts` | +49 / −31           | Backend — Webhook security       |
| 4   | `src/components/stream/CallConnectionBadge.tsx`       | **NEW** (81 lines)  | Component — Connection quality   |
| 5   | `src/components/stream/FloatingVideoOverlay.tsx`      | +21 / −5            | Component — End-call button      |
| 6   | `src/components/stream/VoiceChannelCard.tsx`          | +111 / −67          | Component — Error states         |
| 7   | `src/contexts/StreamCallContext.tsx`                  | +54 / −28           | Context — Idempotency/cleanup    |
| 8   | `src/gamesV4/screens/AchievementSectionScreen.tsx`    | +793 / ~400         | Screen — Redesign                |
| 9   | `src/gamesV4/screens/AchievementsHubScreen.tsx`       | +964 / ~600         | Screen — Redesign                |
| 10  | `src/hooks/useActiveVoiceRooms.ts`                    | +108 / −35          | Hook — Error/partial failure     |
| 11  | `src/hooks/useGroupContentBrowser.ts`                 | +66 / −12           | Hook — Date search               |
| 12  | `src/hooks/useVoiceRoomOccupancy.ts`                  | +79 / −14           | Hook — Error/loading states      |
| 13  | `src/screens/calls/CallSettingsScreen.tsx`            | +242 / −48          | Screen — DND picker, error UI    |
| 14  | `src/screens/calls/CallsScreen.tsx`                   | +93 / −11           | Screen — Room error states       |
| 15  | `src/screens/groups/GroupChatInfoScreen.tsx`          | +48 / −4            | Screen — Auto-scroll, aspect     |
| 16  | `src/screens/groups/GroupChatScreen.tsx`              | +16 / −8            | Screen — Voice error label       |
| 17  | `src/screens/stream/DirectCallScreen.tsx`             | +78 / −23           | Screen — Connection badge, fixes |
| 18  | `src/screens/stream/VoiceChannelScreen.tsx`           | +99 / −27           | Screen — Connection badge, fixes |
| 19  | `src/services/calls/callSettingsService.ts`           | +35 / −10           | Service — Timestamp drift fix    |
| 20  | `src/services/stream/callRuntime.ts`                  | **NEW** (91 lines)  | Service — Call runtime helpers   |
| 21  | `src/services/stream/directCallService.ts`            | +67 / −18           | Service — Retry, reconnect       |
| 22  | `src/services/stream/streamTokenProvider.ts`          | +29 / −11           | Service — Inflight lock          |
| 23  | `src/services/stream/voiceChannelService.ts`          | +68 / −28           | Service — Typed results          |
| 24  | `src/store/InAppNotificationsContext.tsx`             | +28 / −2            | Store — Achievement names        |
| 25  | `src/utils/dateSearchParser.ts`                       | **NEW** (206 lines) | Utility — Date query parsing     |

---

## Changes by File

---

### 1. `firebase-backend/functions/src/calls.ts`

**Category**: Legacy deprecation marker

Added a `@deprecated` block comment explaining that this file contains pre-Stream WebRTC signaling functions that are **not exported from `index.ts`** and therefore never deployed. Points readers to the active call system files (`streamToken.ts`, `streamCallHistory.ts`, client-side services).

```diff
-/**
- * Cloud Functions for Call System
- * Handles call notifications, timeouts, and history recording
+/**
+ * ⚠️  DEPRECATED — LEGACY CALL SYSTEM (not deployed)
+ *
+ * This file contains Firestore-based WebRTC signaling functions from the
+ * pre-Stream era.  None of these functions are exported from index.ts,
+ * so they are NOT deployed to Cloud Functions.
+ * ...
+ * @deprecated Superseded by Stream Video integration (2024-Q4).
  */
```

---

### 2. `firebase-backend/functions/src/gamesV4/resolve.ts`

**Category**: Achievement human-readable names in notifications

- Imports `getAllAchievementDefs` and builds a `type→name` lookup map.
- Notification bodies now use human-readable achievement names instead of raw internal type keys.

```diff
+ const achNameMap = new Map(
+   getAllAchievementDefs().map((d) => [d.type, d.name]),
+ );
  ...
- achievementTitles: unlocks.map((u) => u.achievementType),
+ achievementTitles: unlocks.map(
+   (u) => achNameMap.get(u.achievementType) ?? u.achievementType,
+ ),
```

---

### 3. `firebase-backend/functions/src/streamCallHistory.ts`

**Category**: CRITICAL — Webhook secret fail-closed security fix

Previously, if `STREAM_API_SECRET` was not set, all webhook requests passed through **unvalidated** (fail-open). Now:

- **Missing secret** → HTTP 500 with error log
- **Missing signature header** → HTTP 401
- **Invalid signature** → HTTP 401

Also includes minor formatting fixes (`isVoiceRoomCall` boolean expression grouping, `writeSessionEndedEntries` line wrapping).

```diff
- if (apiSecret && signature) {
-   // validate...
- } else if (apiSecret && !signature) {
-   // reject...
- }
+ if (!apiSecret) {
+   // 500 — server misconfiguration
+ }
+ if (!signature) {
+   // 401 — missing header
+ }
+ // validate signature
+ if (signature !== expectedSignature) {
+   // 401 — bad signature
+ }
```

---

### 4. `src/components/stream/CallConnectionBadge.tsx` _(NEW FILE)_

**Category**: New UI component

A compact connection-quality badge displaying calling state and remote participant connection quality. Shows text labels like "Connecting…", "Reconnecting…", "Poor Connection" with color-coded backgrounds (green/yellow/red).

---

### 5. `src/components/stream/FloatingVideoOverlay.tsx`

**Category**: End-call button on minimized overlay

- `FloatingAudioBanner` now renders a red phone-hangup button next to "Return to call".
- Tapping it calls `endCall()` from `StreamCallContext`.
- `minimizedPill` style updated to `flexDirection: "row"` for horizontal layout.
- Removed `ParticipantNetworkQualityIndicator={null}` (using default now).

---

### 6. `src/components/stream/VoiceChannelCard.tsx`

**Category**: Error/loading state display, hook migration

- **Removed** inline `queryVoiceChannel` polling + `useState`/`setInterval` logic.
- **Now uses** `useVoiceRoomOccupancy(groupId)` hook (single source of truth).
- Added loading indicator ("Checking live room status...") when no occupants and still loading.
- Added error indicator with warning icon when query fails.
- Simplified occupant rendering loop variable names.

---

### 7. `src/contexts/StreamCallContext.tsx`

**Category**: Idempotency, cleanup, reconnection failure handling

- **`clearActiveState` helper**: Extracted repeated null-setting into a single callback.
- **`endingRef` guard**: Prevents concurrent `endCallAction` dispatches. Reset in `finally`.
- **Reconnection failure**: `RECONNECTING_FAILED` calling state now logs and clears active session instead of silently hanging.
- Replaced 4 instances of manual state clearing with `clearActiveState()`.

---

### 8. `src/gamesV4/screens/AchievementSectionScreen.tsx`

**Category**: Major UI redesign (~793 lines changed)

- Section info card with icon, progress counter, progress bar, and difficulty distribution.
- Smart sorting: unclaimed → claimed → locked, with sub-sort by difficulty.
- State-specific card styling (borders, backgrounds, icons).
- Fade-in animation on load completion.
- "Claim All" banner with token total.

---

### 9. `src/gamesV4/screens/AchievementsHubScreen.tsx`

**Category**: Major UI redesign (~964 lines changed)

Large-scale visual overhaul of the achievements hub screen. Redesigned section cards, progress visualization, and layout.

---

### 10. `src/hooks/useActiveVoiceRooms.ts`

**Category**: Error tracking, partial failure reporting

- Added `errorMessage`, `hasPartialFailures`, `lastUpdatedAt` state.
- Per-group query failures are tracked individually — if some groups fail but others succeed, `hasPartialFailures` is set.
- Total failure sets `errorMessage` with a user-friendly string.
- Polling interval now includes ±20% jitter to prevent synchronized polling storms.
- Return type expanded: `{ rooms, loading, error, errorMessage, hasPartialFailures, lastUpdatedAt, refresh }`.

---

### 11. `src/hooks/useGroupContentBrowser.ts`

**Category**: Date-based search support

- Imports new `parseDateQuery` utility and `DateRange` type.
- Before querying, checks if the search string is a date query (e.g., "last week", "March 2026").
- Passes `dateRange` to `queryMedia`, `queryMessages`, and `queryLinks` SQL functions.
- SQL queries extended with `dateClause` filtering on `COALESCE(m.server_received_at, m.created_at)`.
- All three query functions receive an additional `dateRange: DateRange | null` parameter.

---

### 12. `src/hooks/useVoiceRoomOccupancy.ts`

**Category**: Error/loading states, typed query consumption

- Added `loading`, `error`, `errorMessage`, `status`, `lastUpdatedAt` to return type.
- Handles new `VoiceChannelQueryResult` discriminated union from `queryVoiceChannel`:
  - `"active"` → update occupants, clear error
  - `"error"` → set error message, preserve last-known occupants
  - `"no_room"` → clear occupants
- Added unexpected-error catch with `console.warn`.
- Polling jitter (±20%) to prevent synchronized storms.
- `status` computed field: `"loading" | "active" | "idle" | "error"`.

---

### 13. `src/screens/calls/CallSettingsScreen.tsx`

**Category**: DND time picker, error state, honest descriptions

- **DND Time Picker**: Replaced `Alert.alert("Time picker would appear here")` with real `DateTimePicker` from `@react-native-community/datetimepicker`. Both start and end times are now functional.
- **Error state**: Added `loadError` state. On failure: shows "Unable to load settings" with retry button instead of infinite spinner.
- **Honest descriptions**: Settings not wired to runtime now show info rows:
  - Noise suppression, echo cancellation, auto gain → info row about device defaults
  - Show caller preview, announce caller name → info row about platform defaults
  - Wi-Fi only video, flash/haptics/large controls → info rows about unavailability
- Removed "Custom" ringtone option (not implemented).
- Added `renderInfoRow` helper for non-interactive information displays.
- Added `retryButton` style.

---

### 14. `src/screens/calls/CallsScreen.tsx`

**Category**: Active rooms error/partial failure display

- Consumes new `error`, `errorMessage`, `hasPartialFailures` from `useActiveVoiceRooms`.
- **Full error**: Shows inline warning with "Active rooms are temporarily unavailable" + Retry.
- **Partial failure**: Shows inline warning above successful room cards with "Some active room statuses could not be refreshed" + Retry.
- Updated `useMemo` dependency arrays.
- Added `inlineState`, `inlineStateText`, `inlineStateAction` styles.

---

### 15. `src/screens/groups/GroupChatInfoScreen.tsx`

**Category**: Auto-scroll, background crop aspect, voice error

- **ScrollView ref**: Added `scrollViewRef` for programmatic scrolling.
- **Auto-scroll on search**: When user types in search, scrolls content section to just below the sticky header.
- **Background crop aspect**: Changed `ImagePicker` aspect from hardcoded `[9, 16]` to `[SCREEN_WIDTH, windowHeight]` to match actual device proportions.
- **Voice room error**: Empty-state text now shows error message if `voiceRoom.error` is true.
- **Debug text**: Contains a hidden "You shouldn't see this 🗿" text (likely a development/debug marker).

---

### 16. `src/screens/groups/GroupChatScreen.tsx`

**Category**: Voice room error accessibility

- Call button accessibility label adds "Voice room status unavailable. Tap to try joining." when `voiceRoom.error` and not active.
- Call button icon color uses `colors.warning` when error state.
- Added `colors.warning` and `voiceRoom.error` to dependency arrays.

---

### 17. `src/screens/stream/DirectCallScreen.tsx`

**Category**: Connection badge, double-dismiss fix, camera mirror, speaker init

- **Imports**: Added `CallConnectionBadge`, `callSettingsService`.
- **`dismissedRef` + `dismissScreen`**: Prevents double `goBack()` race between `handleEndCall` and auto-dismiss effect.
- **Auto-dismiss**: Now checks `endedRef.current` before navigating; reduced delay 500ms → 350ms.
- **Camera direction**: Reads `direction` from `useCameraState()` to determine mirror behavior via `callSettingsService.getSettingsSync().mirrorFrontCamera`.
- **Speaker init**: Now requires `isJoined === true` before `setForceSpeakerphoneOn`.
- **Ringtone cleanup**: Added `useEffect` that calls `ringtoneService?.stopRingtone()` on unmount; also stops on `handleEndCall`.
- **Connection badge**: Shows `CallConnectionBadge` in both video and audio layouts with remote participant's connection quality.
- **Network quality indicator**: Removed `ParticipantNetworkQualityIndicator={null}` (uses default).
- **Mirror prop**: Changed from hardcoded `mirror` to `mirror={shouldMirrorLocalVideo}`.
- Added `videoHeaderCenter`, `connectionBadgeRow` styles.

---

### 18. `src/screens/stream/VoiceChannelScreen.tsx`

**Category**: Connection badge, join retry, camera flip guard, state-based join sound

- **Imports**: Added `CallConnectionBadge`, `callSettingsService`, `SfuModels`.
- **`dismissedRef` + `dismissScreen`**: Same double-dismiss prevention as DirectCallScreen.
- **`joinAttemptIdRef`**: Prevents stale join error from overwriting state if user retried.
- **`joinAttemptedRef` reset**: Reset to `false` in `.catch()` so user can retry on failure.
- **Retry button**: Error screen now has both "Retry" (re-attempts join) and "Go Back" buttons.
- **Camera mirror**: Reads `direction` + `mirrorFrontCamera` setting for local video mirror.
- **Room connection quality**: Aggregates all participant connection quality; shows `POOR` badge if any participant has poor connection.
- **Join sound**: Replaced `setTimeout(2000)` timing hack with state-based detection:
  - Tracks `wasJoinedRef` for local user's JOINED transition.
  - First participant snapshot after join is recorded as baseline (`hasSettledRef`).
  - Only subsequent count increases trigger `room_join` sound.
- **Camera flip guard**: Added `isCameraOff` check to prevent flip when camera is off.
- **Connection badge**: Shown in header center alongside status text.
- Removed screen share comment block (was already disabled).
- Added `gap: 6` to `headerCenter` style.

---

### 19. `src/services/calls/callSettingsService.ts`

**Category**: Settings timestamp drift prevention

- **`_lastUpdatedAt` timestamp**: Every `updateSettings` and `resetToDefaults` call stamps `Date.now()`.
- **Load reconciliation**: On load, cloud data only overwrites local when cloud timestamp ≥ local timestamp. Prevents stale Firestore data from clobbering newer offline changes.
- Applied to `updateSettings()`, `resetToDefaults()`, and `loadSettings()`.

---

### 20. `src/services/stream/callRuntime.ts` _(NEW FILE)_

**Category**: Call runtime helpers (91 lines)

New module with shared call infrastructure:

- `applyCallReconnectPolicy(call, context)` — sets reconnection behavior.
- `applyCallMediaPreferences(call, context)` — applies user media settings after join.
- `applyPreferredCameraDirection(call, context)` — sets front/back camera per user preference.
- `joinCallWithRetry(call, opts, context)` — wraps `call.join()` with retry logic.

---

### 21. `src/services/stream/directCallService.ts`

**Category**: Retry, reconnect, better error handling

- **Imports**: Added `applyCallMediaPreferences`, `applyCallReconnectPolicy`, `applyPreferredCameraDirection`, `joinCallWithRetry` from new `callRuntime`.
- **Permission errors**: `requestCallPermissions` wrapped in try/catch with re-throw (both `startDirectCall` and `acceptDirectCall`).
- **Reconnect policy**: Applied after call creation and before accept/join.
- **Join with retry**: `acceptDirectCall` uses `joinCallWithRetry` instead of bare `call.join()`.
- **Media preferences**: Applied after device setup on join.
- **Preferred camera**: `applyPreferredCameraDirection` called in `ensureLocalDevices`.
- **Error classification**: Added "Microphone permission is required" pass-through; differentiated network error messages between create and join phases.
- **`watchLocalDeviceSetupOnJoin`**: Now passes `context` string and applies media preferences after device setup.

---

### 22. `src/services/stream/streamTokenProvider.ts`

**Category**: In-flight promise lock for token fetch

- Added `inflightTokenPromise` module-scoped variable.
- `fetchStreamToken()`: If an in-flight request exists, returns the same promise (deduplication). Promise is cleared in `finally` block.
- `clearTokenCache()`: Also nulls `inflightTokenPromise`.

```diff
+ let inflightTokenPromise: Promise<TokenResponse> | null = null;
+
  export async function fetchStreamToken(): Promise<TokenResponse> {
+   if (inflightTokenPromise) return inflightTokenPromise;
+   inflightTokenPromise = (async () => { ... })();
+   try { return await inflightTokenPromise; }
+   finally { inflightTokenPromise = null; }
  }
```

---

### 23. `src/services/stream/voiceChannelService.ts`

**Category**: Typed query results, retry, reconnect

- **Imports**: Added `applyCallMediaPreferences`, `applyCallReconnectPolicy`, `joinCallWithRetry`.
- **Permission errors**: `requestCallPermissions` wrapped in try/catch.
- **Reconnect policy**: Applied after call creation.
- **Join with retry**: Uses `joinCallWithRetry` instead of bare `call.join()`.
- **Media preferences**: Applied after successful join.
- **Microphone error passthrough**: If error message contains "Microphone permission is required", throws raw message instead of wrapping.
- **`VoiceChannelQueryResult` type**: New exported discriminated union:
  - `{ status: "active", state: { participants } }`
  - `{ status: "no_room" }`
  - `{ status: "error", message: string }`
- **`queryVoiceChannel`**: Returns typed result instead of `object | null`. Network/auth failures are now distinguishable from "no active room."

---

### 24. `src/store/InAppNotificationsContext.tsx`

**Category**: Achievement name resolution in toast notifications

- Imports `ACHIEVEMENT_BY_TYPE` lookup map.
- For `achievement_unlocked` notifications, resolves raw type keys to human-readable names.
- Handles both single-achievement and multi-achievement notification bodies.
- Falls back to raw type key if definition not found.

---

### 25. `src/utils/dateSearchParser.ts` _(NEW FILE)_

**Category**: Date query parsing utility (206 lines)

Parses natural-language date strings (e.g., "last week", "March 2026", "yesterday") into `{ startMs, endMs }` ranges for SQL filtering. Used by `useGroupContentBrowser` for date-based content search.

---

## New Untracked Files (not in git)

| File                                            | Lines | Description                                          |
| ----------------------------------------------- | ----- | ---------------------------------------------------- |
| `docs/CALL_SYSTEM_AUDIT_FIX_PASS.md`            | —     | Audit documentation                                  |
| `docs/CALL_SYSTEM_MASTER_REFERENCE.md`          | —     | Master reference documentation                       |
| `docs/CALL_SYSTEM_V1.3_AUDIT.md`                | —     | V1.3 audit documentation                             |
| `src/components/stream/CallConnectionBadge.tsx` | 81    | Connection quality badge component                   |
| `src/services/stream/callRuntime.ts`            | 91    | Call runtime helpers (retry, reconnect, media prefs) |
| `src/utils/dateSearchParser.ts`                 | 206   | Natural-language date parsing utility                |
