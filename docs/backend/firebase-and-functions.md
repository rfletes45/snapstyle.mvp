# Firebase and Functions

Last verified: 2026-03-30

## Backend Topology

`firebase.json` currently configures:

- Functions source: `firebase-backend/functions`
- Firestore rules: `firebase-backend/firestore.rules`
- Firestore indexes: `firebase-backend/firestore.indexes.json`
- Realtime Database rules: `firebase-backend/database.rules.json`
- Storage rules: `firebase-backend/storage.rules`

Client Firebase bootstrap lives in:

- [firebase.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/firebase.ts)
- [firebaseConfig.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/firebaseConfig.ts)
- [firebaseConfig.local.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/firebaseConfig.local.ts)

Important current-state note:

- the client Firebase config is checked into the repo
- `firebaseConfig.ts` and `firebaseConfig.local.ts` currently contain the same public client config
- docs should not describe client Firebase bootstrapping as environment-variable-driven

## Functions Entry Surface

The deployed Functions entrypoint is [index.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/index.ts).

Major exported domains:

- messaging, reactions, message requests, inbox triggers, privacy publish APIs
- notifications and notification cleanup
- social and friend request notifications
- economy, tasks, gifts, shop, cosmetic entitlements, IAP validation
- profile views
- Stream token issuance and call history webhook
- Games V4 callables, triggers, and watchdog
- contacts matching callable
- admin/moderation helpers

Notable non-exported / legacy detail:

- `firebase-backend/functions/src/calls.ts` still exists in the repo, but it is not exported by the active Functions entrypoint and is not the current call runtime

## Authoritative Write Areas

These areas are intentionally server-authoritative and should not be moved into client-owned writes:

- canonical DM/group message writes
- notification routing and delivery choice
- wallet balances and transactions
- task reward claims
- purchases, entitlements, and grants
- Games V4 resolution, XP, achievements, PBs, and leaderboards
- Stream token issuance and call history persistence

## Key Firestore Families

### Users and app settings

- `Users/{uid}`
- `Users/{uid}/Notifications/{notificationId}`
- `Users/{uid}/NotificationDevices/{deviceId}`
- `Users/{uid}/NotificationSessions/{deviceId}`
- `Users/{uid}/MessageRequests/{chatId}`
- `Users/{uid}/Inbox/{threadId}`
- `Users/{uid}/Entitlements/{cosmeticId}`
- `Users/{uid}/ProfileLayout/board`
- `Users/{uid}/TaskProgress/{taskId}`
- `Users/{uid}/StreamCallHistory/{entryId}`
- `Users/{uid}/GamePB/{gameId}`
- `Users/{uid}/Achievements/{achievementId}`
- `Users/{uid}/AchievementSections/{sectionId}`

### Social

- `FriendRequests/{requestId}`
- `Friends/{friendshipId}`

### Messaging

- `Chats/{chatId}`
- `Chats/{chatId}/Messages/{messageId}`
- `Chats/{chatId}/Members/{uid}`
- `Chats/{chatId}/MembersPrivate/{uid}`
- `Groups/{groupId}`
- `Groups/{groupId}/Messages/{messageId}`
- `Groups/{groupId}/Members/{uid}`
- `Groups/{groupId}/MembersPrivate/{uid}`

### Economy and shop

- `Wallets/{uid}`
- `Transactions/{transactionId}`
- `Tasks/{taskId}`
- `ShopCatalog/{itemId}` and purchase-history collections used by shop services

### Games V4

- `GameInvitesV4/{inviteId}`
- `GameSessionsV4/{sessionId}`
- `GameResultsV4/{sessionId}`
- `LeaderboardsV4/*`

Use the rules file as the final statement of client access. These lists are a navigation aid, not a replacement for rules.

## Messaging Functions

Main messaging-related files:

- [messaging.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/messaging.ts)
- [messageRequests.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/messageRequests.ts)
- [inboxTriggers.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/inboxTriggers.ts)
- [privacyPublish.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/privacyPublish.ts)
- [chatMedia.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/chatMedia.ts)
- [notificationCenter.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/notificationCenter.ts)

Important behavior:

- `sendMessageV2` is the canonical DM/group write path
- message requests are enforced server-side
- `markInboxRead` only updates aggregated inbox hints; `MembersPrivate` watermarks remain the canonical unread/read authority
- backend aggregation writes to `Users/{uid}/Inbox/*` are live even though the client still defaults to fan-out inbox reads

## Notifications

The current notification center is the single routing authority:

- [notificationCenter.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/notificationCenter.ts)

It:

1. reads per-user notification preferences
2. checks mute and active-session state
3. chooses exactly one delivery channel: `in_app`, `push`, or `none`
4. writes the canonical notification document
5. sends Expo push only when `push` wins

There is no active `CHAT_LEGACY_PUSH_ENABLED` environment contract in the current repo.

## Stream Boundaries

Stream-specific backend files:

- [streamToken.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/streamToken.ts)
- [streamCallHistory.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/streamCallHistory.ts)

Current responsibilities:

- mint Stream video tokens via `getStreamVideoToken`
- best-effort Stream user upserts via `ensureStreamUsers`
- verify Stream webhook signatures with `STREAM_API_SECRET`
- write call history entries to `Users/{uid}/StreamCallHistory/{entryId}`
- handle `call.session_ended`, `call.rejected`, and `call.missed` webhook events for canonical call history

## Colyseus Boundaries

Realtime game server code lives outside Firebase in `colyseus-server/`.

Current room registration:

- `knockout_game`
- `sketch_party`
- `pong_game`

The client resolves the Colyseus URL in this order:

1. `extra.colyseusUrl` from `app.config.ts`
2. Expo dev-host auto-detection
3. localhost fallback for dev

Firebase still owns invite/session docs, resolution, XP, achievements, and leaderboards.

## Environment and Secret Surfaces

### App / EAS

- `COLYSEUS_URL`
  - consumed by `app.config.ts`
  - populated for `preview` and `production` in `eas.json`

### Firebase Functions

Variables referenced in current source:

- `STREAM_API_KEY`
- `STREAM_API_SECRET`
- `APPLE_SHARED_SECRET`
- `ANDROID_PACKAGE_NAME`
- `ADMIN_SETUP_KEY`
- `FUNCTIONS_EMULATOR` (behavior flag in some flows)

### Colyseus server

Variables referenced in current source:

- `FIREBASE_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `FIREBASE_SERVICE_ACCOUNT_BASE64`
- `COLYSEUS_DEV_BYPASS`
- `HOST`
- `PORT`

## Build and Deploy Commands

```bash
# Functions build
npm --prefix firebase-backend/functions run build

# Functions deploy
firebase deploy --only functions

# Rules and indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

## Change Checklist

1. Keep client types, function payloads, rules, and indexes aligned.
2. When query shapes change, update indexes and the relevant docs together.
3. Do not document dormant or non-exported backend files as live runtime.
4. When changing Stream or Games V4 integrations, verify both the Firebase and non-Firebase boundaries in the same change.
