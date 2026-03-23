# Firebase and Functions

Last verified: 2026-03-18

## Backend Topology

Configured by `firebase.json`:

- Functions source: `firebase-backend/functions`
- Firestore rules: `firebase-backend/firestore.rules`
- Firestore indexes: `firebase-backend/firestore.indexes.json`
- Realtime DB rules: `firebase-backend/database.rules.json`
- Storage rules: `firebase-backend/storage.rules`

Client bootstrap:

- `src/services/firebase.ts`
- `src/services/firebaseConfig.local.ts`

## Functions Entry And Build

- entry: `firebase-backend/functions/src/index.ts`
- runtime target: Node 20
- build command:

```bash
npm --prefix firebase-backend/functions run build
```

## Messaging Functions

Primary callable and trigger files:

- `firebase-backend/functions/src/messaging.ts`
- `firebase-backend/functions/src/messageRequests.ts`
- `firebase-backend/functions/src/inboxTriggers.ts`
- `firebase-backend/functions/src/notifications.ts`
- `firebase-backend/functions/src/notificationCenter.ts`
- `firebase-backend/functions/src/privacyPublish.ts`
- `firebase-backend/functions/src/rateLimiter.ts`
- `firebase-backend/functions/src/chatMedia.ts`

Important callables:

- `sendMessageV2`
- `editMessageV2`
- `deleteMessageForAllV2`
- `toggleReactionV2`
- `markInboxRead`
- `publishTypingIndicator`
- `publishReadReceipt`
- `publishDeliveryReceipt`
- `acceptMessageRequest`
- `declineMessageRequest`
- `getRateLimitStatus`

`markInboxRead` only updates the derived `Users/{uid}/Inbox/{threadId}` unread hint. It does not replace `MembersPrivate.lastSeenAtPrivate` as the canonical unread/read source of truth.

## Server Guarantees For Messaging

`sendMessageV2` is the authoritative write path for DM and group messages.

It enforces:

1. authenticated sender
2. DM/group membership validation
3. DM block checks
4. DM request gating through `checkDmAcceptance`
5. rate limiting
6. idempotent writes using `messageId` and `clientId:messageId`
7. canonical timestamps and conversation summary updates
8. attachment staging/finalization when the staged media flow is used

Message requests are always enforced server-side. They are not rollout-gated by a client flag anymore.

## Notification Topology

All modern app notifications route through the shared notification center:

- selector and writer: `firebase-backend/functions/src/notificationCenter.ts`
- chat event producers: `firebase-backend/functions/src/notifications.ts`
- game event producers: `firebase-backend/functions/src/gamesV4/notifications.ts`
- social, gifting, and other producers call the same `notifyUser(...)` surface

Canonical notification collections:

- `Users/{uid}/Notifications`
- `Users/{uid}/NotificationDevices`
- `Users/{uid}/NotificationSessions`

Routing rules:

1. read user inbox preferences
2. suppress muted conversations where applicable
3. inspect fresh active sessions
4. suppress when the user is already viewing the target surface
5. choose exactly one channel: `in_app`, `push`, or `none`
6. persist a canonical notification document
7. send Expo push only when the chosen channel is `push`

Chat notification records carry both `conversationId` and `conversationScope`. Client read-marking should use both fields together rather than assuming `conversationId` alone is sufficient.

There is no backend `CHAT_LEGACY_PUSH_ENABLED` contract in the current code.

## Firestore Contract Summary

Use `firebase-backend/firestore.rules` as the final client-access contract.

Important messaging families:

- `Chats/{chatId}`
- `Chats/{chatId}/Messages/{messageId}`
- `Chats/{chatId}/Members/{uid}`
- `Chats/{chatId}/MembersPrivate/{uid}`
- `Groups/{groupId}`
- `Groups/{groupId}/Messages/{messageId}`
- `Groups/{groupId}/Members/{uid}`
- `Groups/{groupId}/MembersPrivate/{uid}`
- `Users/{uid}/Inbox/{threadId}`
- `Users/{uid}/MessageRequests/{chatId}`
- `Users/{uid}/Notifications/{notificationId}`
- `Users/{uid}/NotificationDevices/{deviceId}`
- `Users/{uid}/NotificationSessions/{deviceId}`

Legacy note:

- `deleteAccount.ts` still cleans up old `Conversations`, root `Notifications`, and `InAppNotificationsV4` data via the Admin SDK so older stored data can still be removed safely.

## Storage Contract Summary

Defined by `firebase-backend/storage.rules`.

Messaging-relevant path families:

- DM media: `pictures/{chatId}/...`, `dm-voice/{chatId}/...`
- group media: `groups/{groupId}/messages|attachments|voice/...`
- staged uploads: `chat-staging/...`
- finalized server-managed media: `chat-media/...`

## Rules And Deployment Safety

When query or write shapes change:

1. update the client service layer
2. update `firestore.rules` if client access changed
3. update indexes for new compound queries
4. build functions before deploy
5. update docs in the same change

## Deployment Commands

```bash
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
firebase deploy
```
