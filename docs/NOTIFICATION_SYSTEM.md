# Notification System — Architecture & Operations

> Last updated: 2026-03-24

## Overview

The Vibe notification system is a unified push + in-app notification framework.
Every notification flows through a single server-side gateway (`notifyUser()` in
`notificationCenter.ts`) that makes a per-event routing decision:

| Recipient state                                 | Delivery channel    | Mechanism                                              |
| ----------------------------------------------- | ------------------- | ------------------------------------------------------ |
| Active in-app **and** viewing the target screen | `none` (suppressed) | Session heartbeat + surface matching                   |
| Active in-app, **not** viewing target           | `in_app`            | Firestore `Notifications` subcollection → client toast |
| Backgrounded / killed / offline                 | `push`              | Expo Push API → device notification tray               |
| Notifications globally disabled                 | `none`              | Preference check                                       |
| Category disabled                               | `none`              | Per-type preference check                              |
| Conversation muted                              | `none`              | Mute flag check                                        |

A single event **never** creates both an in-app and a push notification. The
channel decision is exclusive.

---

## Supported Notification Types (15)

| Type                      | Category    | Trigger                                            |
| ------------------------- | ----------- | -------------------------------------------------- |
| `dm_message`              | message     | `Chats/{chatId}/Messages/{messageId}` onCreate     |
| `group_message`           | message     | `Groups/{groupId}/Messages/{messageId}` onCreate   |
| `message_request`         | message     | `Users/{uid}/MessageRequests/{chatId}` onCreate    |
| `friend_request`          | social      | `FriendRequests/{id}` onCreate                     |
| `friend_request_accepted` | social      | `FriendRequests/{id}` onUpdate (status → accepted) |
| `game_invite`             | games       | `createGameInviteV4` callable                      |
| `game_lobby_ready`        | games       | Player joins lobby                                 |
| `game_turn`               | games       | Turn-based game move                               |
| `game_resolved`           | games       | Game completes (all types)                         |
| `achievement_unlocked`    | progression | Game reward pipeline phase 5                       |
| `gift_received`           | commerce    | `sendGift` callable                                |
| `gift_opened`             | commerce    | `openGift` callable                                |
| `streak_milestone`        | progression | Streak day tracked (legacy push)                   |
| `streak_reminder`         | progression | `streakReminder` scheduled (8 PM UTC)              |
| `story_view`              | social      | `onStoryViewed` trigger                            |

---

## Device ID Generation

Device IDs uniquely identify each client installation for multi-device support.

**Strategy**: `expo-crypto.randomUUID()` with `Math.random`-based fallback.

**Why not uuid v4**: The `uuid` npm package (v13+) requires
`crypto.getRandomValues()`, which is not natively available in React Native /
Expo. Using it directly causes a crash:

```
Error: crypto.getRandomValues() not supported
```

The fix uses `expo-crypto` (already a project dependency) which provides a
native `randomUUID()` implementation on both iOS and Android. A deterministic
`Math.random`-based fallback exists for edge cases where `expo-crypto` is
unavailable (e.g., certain test environments).

**Persistence**: Device IDs are stored via AsyncStorage under
`@vibe/notification_device_id` and reused across app restarts.

**Files**: [src/services/notifications.ts](../src/services/notifications.ts) (`safeUUID`, `getNotificationDeviceId`)

---

## Push Token Registration Flow

```
1. Firebase onAuthStateChanged fires with authenticated user
2. AuthContext.registerPushToken runs (native platforms only)
3. registerForPushNotifications():
   a. Skip if web platform
   b. Skip if not physical device (use dev token in __DEV__)
   c. Check existing notification permission
   d. Request permission if not granted
   e. Get Expo push token via getExpoPushTokenAsync
   f. Set up Android notification channels
4. savePushToken(uid, token):
   a. Get device ID (AsyncStorage → safeUUID if new)
   b. Write to Users/{uid}/NotificationDevices/{deviceId}
   c. Write legacy token to Users/{uid}.expoPushToken
5. Token refresh: every 7 days on app foreground return
```

**Automatic cleanup**: When the Expo API returns `DeviceNotRegistered` for a
push target, `cleanupInvalidPushTarget()` disables that device entry.

---

## Permissions by Platform

### iOS

- Push notification permission requested via `expo-notifications`
- `UIBackgroundModes`: audio, voip, remote-notification, fetch
- APS entitlement: production
- Badge capability: supported via `expo-notifications`

### Android

- `POST_NOTIFICATIONS` permission declared (required for Android 13+ / API 33)
- `expo-notifications` plugin in app.config.ts handles manifest entries
- Notification channels created at registration time:
  - `default` — General notifications (HIGH importance)
  - `game-invites` — Game notifications (HIGH importance)
  - `vibe-incoming-calls` — Call notifications (MAX importance)
  - `vibe-group-calls` — Group call notifications (HIGH importance)

### Permission Denied Handling

- If permission is denied, `registerForPushNotifications` returns `null`
- `removePushToken` is called to clean up stale server state
- The app continues to function without push — in-app notifications still work
  when the app is active

---

## Badge Count

**Source of truth**: Real-time Firestore query on
`Users/{uid}/Notifications` where `badgeEligible == true` AND `readAt == null`.

**Client subscription**: `subscribeToUnreadBadgeCount()` in
[src/services/userNotifications.ts](../src/services/userNotifications.ts) listens
to the query and calls `Notifications.setBadgeCountAsync()` to update the native
badge.

**Retry logic**: The badge subscription retries up to 3 times with exponential
backoff (2s → 4s → 8s) if it hits a `permission-denied` error. This handles the
race condition where the Firestore SDK hasn't propagated the Firebase Auth token
yet when the subscription starts.

**Required Firestore composite index**: `badgeEligible ASC, readAt ASC` on
the `Notifications` collection (defined in `firestore.indexes.json`).

**Server-side badge in push**: When sending a push notification, the server
queries the unread count and includes it in the push payload's `badge` field.

---

## Firestore Collections & Documents

| Path                                          | Purpose                   | Client Access                                        |
| --------------------------------------------- | ------------------------- | ---------------------------------------------------- |
| `Users/{uid}/Notifications/{id}`              | Notification records      | Read, Update (readAt/presentedAt/archivedAt), Delete |
| `Users/{uid}/NotificationDevices/{deviceId}`  | Push token registry       | Read, Write (own devices)                            |
| `Users/{uid}/NotificationSessions/{deviceId}` | Active session heartbeats | Read, Write (own sessions)                           |
| `Users/{uid}/settings/inbox`                  | Notification preferences  | Read, Write (own settings)                           |

**Notification document fields** (server-created):

- `type`, `category`, `dedupeKey`, `collapseKey`
- `title`, `body`, `route`
- `channel` (`in_app` | `push`)
- `targetDeviceId` (for in_app: which device should show it)
- `badgeEligible`, `readAt`, `presentedAt`, `archivedAt`
- `createdAt`, `updatedAt`, `pushSentAt`

---

## Server Triggers & Functions

| Function                              | Type                                   | File                       |
| ------------------------------------- | -------------------------------------- | -------------------------- |
| `onNewMessage`                        | Firestore onCreate                     | `notifications.ts`         |
| `onNewGroupMessageV2`                 | Firestore onCreate                     | `notifications.ts`         |
| `onMessageRequestCreatedNotification` | Firestore onCreate                     | `notifications.ts`         |
| `onNewFriendRequest`                  | Firestore onCreate                     | `social.ts`                |
| `onFriendRequestAccepted`             | Firestore onUpdate                     | `social.ts`                |
| `streakReminder`                      | Scheduled (8 PM UTC)                   | `legacy.ts`                |
| `notifyInviteCreated`                 | Called from `createGameInviteV4`       | `gamesV4/notifications.ts` |
| `notifyTurn`                          | Called from game move logic            | `gamesV4/notifications.ts` |
| `notifyResolved`                      | Called from `resolveSessionV4Internal` | `gamesV4/notifications.ts` |
| `notifyPlayerJoinedLobby`             | Called from lobby join                 | `gamesV4/notifications.ts` |
| `notifyAchievementUnlocked`           | Called from reward pipeline            | `gamesV4/notifications.ts` |
| `sendGift` / `openGift`               | Callable functions                     | `gifting.ts`               |

All of these call `notifyUser()` from `notificationCenter.ts` as the single
dispatch point.

---

## Deduplication (3 Layers)

| Layer                    | Mechanism                                                                     | Window    | Location                        |
| ------------------------ | ----------------------------------------------------------------------------- | --------- | ------------------------------- |
| **Server**               | SHA-256 hash of `dedupeKey` → Firestore doc ID. `create()` rejects if exists. | Permanent | `notificationCenter.ts`         |
| **Client normalization** | `shouldHandleNotificationByDedupeKey()` map                                   | 1.5 s     | `normalizeNotification.ts`      |
| **Client toast**         | `recentNotificationKeys` map in context                                       | 3 s       | `InAppNotificationsContext.tsx` |

**Collapse keys**: Push notifications use `collapseId` (Expo's coalescing
parameter) so multiple messages from the same conversation collapse into one
system notification on the device.

---

## Session-Aware Suppression

The client sends heartbeats every 25 seconds via `syncNotificationSession()`:

```json
{
  "deviceId": "...",
  "appState": "active",
  "currentScreen": "ChatDetail",
  "currentChatId": "chat_abc",
  "currentConversationScope": "dm",
  "currentGameSessionId": null,
  ...
}
```

The server considers sessions stale after **90 seconds** without a heartbeat.

Surface matching (`isRecipientViewingEquivalentSurface`) checks:

- Conversation: `currentChatId` matches `conversationId` + scope match
- Game: `currentGameSessionId` matches `sessionId`
- Game invite: `currentGameInviteId` matches `inviteId`
- Friend request: `currentScreen === "Friends"`
- Achievement: `currentScreen === "AchievementsHub" | "AchievementSection"`
- Gift: `currentScreen === "Wallet" | "PurchaseHistory"`
- Message request: `currentScreen === "ChatList" | "Friends"`

---

## Client Receive & Display

### Foreground (in-app toast)

1. `subscribeToUserNotifications` receives new Firestore docs
2. Filters: `channel === "in_app"`, correct `targetDeviceId`, not yet presented
3. Stale check: >15s old on initial snapshot → silently mark presented
4. `buildToast()` → `normalizeNotificationPayload()` → `enqueueToast()`
5. Max 2 visible toasts, auto-dismiss after 5 seconds
6. Spring slide-in animation, swipe-to-dismiss gesture

### Push tap handling

1. `addNotificationResponseReceivedListener` fires
2. `normalizeNotificationPayload` extracts route from push data
3. Dedupe check (1.5s window)
4. `markUserNotificationRead` called on the Firestore doc
5. `globalNavigate(route.screen, route.params)` for deep navigation

### Cold start / killed state

- `getLastNotificationResponseAsync()` called on mount in AuthContext
- Same handler processes it with dedupe protection

---

## User Preferences

Stored at `Users/{uid}/settings/inbox`:

| Field                             | Type | Default  | Description                        |
| --------------------------------- | ---- | -------- | ---------------------------------- |
| `notificationsEnabled`            | bool | `true`   | Global kill switch                 |
| `inAppNotificationsEnabled`       | bool | `true`   | In-app toast banners               |
| `messageNotificationsEnabled`     | bool | `true`   | DM, group, request                 |
| `socialNotificationsEnabled`      | bool | `true`   | Friend requests                    |
| `gameNotificationsEnabled`        | bool | `true`   | All game types                     |
| `achievementNotificationsEnabled` | bool | `true`   | Achievement unlocks                |
| `giftNotificationsEnabled`        | bool | `true`   | Gift events                        |
| `storyNotificationsEnabled`       | bool | `true`   | Story views                        |
| `streakNotificationsEnabled`      | bool | `true`   | Streak reminders                   |
| `badgeCountEnabled`               | bool | `true`   | Badge count sync                   |
| `defaultNotifyLevel`              | enum | `"all"`  | `all` / `mentions` / `none`        |
| `notificationPreview`             | enum | `"full"` | `full` / `sender_only` / `generic` |

Per-conversation overrides: `notifyLevel` on `MembersPrivate` subcollection.

---

## Deployment Checklist

When notification system changes are deployed, ensure:

1. **Firestore indexes** — Deploy `firestore.indexes.json`:

   ```bash
   firebase deploy --only firestore:indexes
   ```

   Required indexes for Notifications subcollection:
   - `badgeEligible ASC, readAt ASC` (badge count query)
   - `conversationId ASC, readAt ASC` (mark conversation read)
   - `conversationId ASC, conversationScope ASC, readAt ASC`
   - `type ASC, readAt ASC` (mark by type)
   - Several game-specific compound indexes (see `firestore.indexes.json`)

2. **Firestore rules** — Deploy `firestore.rules`:

   ```bash
   firebase deploy --only firestore:rules
   ```

   Key rules covers: Notifications (read/update/delete owner-only),
   NotificationDevices, NotificationSessions, settings/inbox

3. **Cloud Functions** — Deploy notification functions:

   ```bash
   firebase deploy --only functions
   ```

4. **Expo config** — Rebuild native app when `app.config.ts` changes:
   - `expo-notifications` plugin
   - Android `POST_NOTIFICATIONS` permission
   - iOS background modes / APS entitlement

   ```bash
   eas build --platform all
   ```

5. **Environment variables** — EAS project ID must be set in `app.config.ts`
   extra.eas.projectId. Currently: `a57e6af7-ac18-4751-90ee-3b9cda7ea645`

---

## Troubleshooting

### "crypto.getRandomValues() not supported"

**Cause**: The `uuid` npm package (v13+) calls `crypto.getRandomValues()` which
is not available in React Native.

**Fix applied**: Replaced `uuid.v4()` with `expo-crypto.randomUUID()` + fallback
in all client-side files. See `safeUUID()` in `src/services/notifications.ts`.

**Affected files**: `notifications.ts`, `StreamCallContext.tsx`,
`callService.ts`, `groupCallService.ts`, `webRTCService.ts`,
`backgroundCallHandler.ts`.

### "Missing or insufficient permissions" on badge subscription

**Cause**: Firestore Auth token may not be propagated to the Firestore SDK
immediately when `onAuthStateChanged` fires. The badge subscription starts
immediately on `uid` availability, hitting a brief auth race.

**Fix applied**: Added retry logic (3 attempts, 2s/4s/8s backoff) in
`subscribeToUnreadBadgeCount()`. Also added required composite index
`(badgeEligible, readAt)` to `firestore.indexes.json`.

**Verification**: After deploying indexes and rules, the subscription should
succeed on first attempt in normal conditions, and recover via retry on slow
auth propagation.

### Push notifications not received

Check in order:

1. Device is physical (not simulator/emulator without Google Play)
2. Notification permission granted (`registerForPushNotifications` logged)
3. Push token saved in `Users/{uid}/NotificationDevices/{deviceId}`
4. User's notification preferences not disabled
5. Conversation not muted
6. No active session blocking push (check `NotificationSessions` subcollection)
7. Cloud Function logs for `[notificationCenter] Decision` entries

### In-app toast not appearing

Check in order:

1. `inAppNotificationsEnabled` is `true` in settings
2. App is in foreground (`appState === "active"`)
3. Not viewing the target screen (session surface match would suppress)
4. Notification `channel` is `"in_app"` in Firestore doc
5. `targetDeviceId` matches current device
6. Not already presented (`presentedAtMs` is null)
7. Within staleness window (< 15s on first snapshot)

---

## Testing Checklist

See [QA_IN_APP_NOTIFICATIONS.md](QA_IN_APP_NOTIFICATIONS.md) for the full
manual QA script covering:

- DM/group/friend request/game notification flows
- Suppression when viewing target screen
- Tap-to-navigate routing
- Dedupe/debounce behavior
- Firestore rule enforcement
- Cross-channel integrity (no duplicate push + in-app)
