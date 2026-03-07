# Messaging System

Last verified: 2026-03-05

## Scope

This is the canonical feature-level reference for DM and group messaging in the app.
It covers:

- message send/read/subscribe lifecycle
- inbox row composition (fan-out and aggregated)
- requests tab behavior
- runtime mode parity (SQLite-first and Firestore fallback)
- unread count source-of-truth
- notification routing contracts

For exhaustive contract definitions, see:

- `docs/chat-system-audit/02_INBOX_CHAT_DATA_CONTRACTS.md`

## 1) Runtime Architecture

Primary orchestration hook:

- `src/hooks/useChat.ts`

Runtime selection:

- `USE_LOCAL_STORAGE=true`:
  - `src/hooks/useLocalMessages.ts`
  - SQLite repositories under `src/services/database/*`
  - sync bridge: `src/services/sync/syncEngine.ts`
- `USE_LOCAL_STORAGE=false`:
  - `src/hooks/useUnifiedMessages.ts`
  - Firestore-first subscriptions via `src/services/messaging/subscribe.ts`

Shared parity layer:

- `src/services/chat/normalizeMessage.ts`

The parity layer ensures both runtime paths produce stable `MessageV2` output and ordering.

## 2) Canonical Service Surfaces

Messaging services:

- `src/services/messaging/send.ts`
- `src/services/messaging/subscribe.ts`
- `src/services/messaging/messageMerge.ts`
- `src/services/messaging/memberState.ts`

Shared chat normalization helpers:

- `src/services/chat/normalizeMessage.ts`
- `src/services/chat/normalizeInboxRow.ts`
- `src/services/chat/fanoutInboxNormalization.ts`
- `src/services/chat/unifiedInboxRequests.ts`
- `src/services/chat/messageRequestsContract.ts`

Notification normalization:

- `src/services/notifications/normalizeNotification.ts`

## 3) Core Data Contracts

Primary type file:

- `src/types/messaging.ts`

Important contracts:

- `MessageV2`
- `InboxConversation`
- `InboxEntry`
- `MemberStatePrivate`
- `MessageRequest`
- `MessageRequestResponse`

Backend contract producers:

- `firebase-backend/functions/src/messaging.ts`
- `firebase-backend/functions/src/inboxTriggers.ts`
- `firebase-backend/functions/src/messageRequests.ts`

## 4) Send Pipeline (DM + Group)

Client send flow:

1. UI calls `chat.sendMessage(...)` from `useChat`.
2. Runtime path:
   - SQLite-first inserts locally and syncs pending writes.
   - fallback path uses Firestore callable/subscription flow.
3. Server callable `sendMessageV2` validates auth, membership, block/rate-limit, and request gating.
4. Server writes message with authoritative timestamps and updates conversation summary fields.
5. Realtime subscription and merge helpers reconcile optimistic and authoritative states.

Server file:

- `firebase-backend/functions/src/messaging.ts`

Idempotency invariants:

- `messageId` and `idempotencyKey` prevent duplicate committed sends.
- retried sends must resolve to one canonical message row.

## 5) Ordering, Dedupe, and Reconciliation

Canonical ordering (newest first):

1. `serverReceivedAt`
2. `createdAt`
3. `id` (lexicographic tie-break)

Canonical helpers:

- `compareMessagesCanonicalDesc`
- `dedupeAndSortMessages`
- `mergeMessageCollections`

All defined in `src/services/chat/normalizeMessage.ts`.

Outbox merge behavior:

- `src/services/messaging/messageMerge.ts`
- optimistic rows are removed when server row with same `id` appears
- failed outbox rows stay visible with `status="failed"`

Realtime lifecycle helper:

- `src/services/chat/unifiedMessagesLifecycle.ts`

## 6) Inbox Data Paths

Primary inbox hook:

- `src/hooks/useInboxData.ts`

Fan-out mode (`CHAT_FEATURES.CHAT_INBOX_AGGREGATION=false`):

- reads from `Chats` and `Groups`
- merges with member private state
- uses fan-out normalizers in `src/services/chat/fanoutInboxNormalization.ts`

Aggregated mode (`CHAT_FEATURES.CHAT_INBOX_AGGREGATION=true`):

- `src/hooks/useInboxAggregation.ts`
- reads `Users/{uid}/Inbox/*`
- still fetches `MembersPrivate` to preserve unread and settings parity

Canonical row helper for both modes:

- `src/services/chat/normalizeInboxRow.ts`

Server writer for aggregated docs:

- `firebase-backend/functions/src/inboxTriggers.ts`

## 7) Unread Count Source Of Truth

Authoritative unread inputs:

- `MembersPrivate.lastSeenAtPrivate`
- `MembersPrivate.lastMarkedUnreadAt`
- conversation `lastActivityAt`

Fallback input only if private watermark is missing:

- aggregated inbox `unreadCount` hint

Canonical function:

- `computeUnreadCount` in `src/services/chat/normalizeInboxRow.ts`

Rule order:

1. recent optimistic read override (`recentlyReadAt`) returns unread `0`
2. if `lastMarkedUnreadAt > lastSeenAtPrivate`, unread is `1`
3. if `lastActivityAt > lastSeenAtPrivate + tolerance`, unread is `1`
4. if no private watermark and unread hint exists, unread is `1`
5. otherwise unread is `0`

Unread badge formatting:

- helper: `src/components/chat/inbox/unreadBadge.ts`
- display: `""` for `<=0`, `1..99` exact, `99+` cap

## 8) Runtime Mode Parity Guarantees

The chat stack guarantees the following parity between runtime paths:

1. Local and Firestore messages normalize to the same canonical `MessageV2` shape.
2. Message ordering and dedupe are identical across runtime modes.
3. Realtime and pagination overlap cannot create duplicate message IDs.
4. Fan-out and aggregated inbox produce the same `InboxConversation` semantics.
5. Unread computation is centralized and consistent across inbox modes.

These guarantees are implemented by shared helpers, not by removing fallback paths.

## 9) Requests Tab (Unified Source)

Unified hook:

- `src/hooks/useUnifiedInboxRequests.ts`

Merged sources:

- friend requests (`useFriendRequests`)
- group invites (`subscribeToPendingInvites`)
- message requests (`useMessageRequests`)

Merge contract helper:

- `src/services/chat/unifiedInboxRequests.ts`

Screen integration:

- `src/screens/chat/ChatListScreenV2.tsx`

Message request callable contracts:

- `acceptMessageRequest`
- `declineMessageRequest`
- server implementation: `firebase-backend/functions/src/messageRequests.ts`

## 10) Notification Routing And Dedupe

Canonical payload adapter:

- `src/services/notifications/normalizeNotification.ts`

Consumers:

- push tap handler: `src/store/AuthContext.tsx`
- in-app listeners: `src/store/InAppNotificationsContext.tsx`

Legacy trigger overlap handling:

- `firebase-backend/functions/src/notifications.ts`
- env flag: `CHAT_LEGACY_PUSH_ENABLED` (legacy triggers enabled unless explicitly set to `false`)

Dedupe helper:

- `shouldHandleNotificationByDedupeKey(...)`

## 11) Feature Flags That Affect Messaging

Primary flags and toggles:

- `USE_LOCAL_STORAGE`
- `CHAT_FEATURES.CHAT_INBOX_AGGREGATION`
- `CHAT_FEATURES.CHAT_MESSAGE_REQUESTS`
- `CHAT_FEATURES.CHAT_DELIVERY_ACKS`
- backend env: `CHAT_LEGACY_PUSH_ENABLED`

Guidance:

- Any behavior change behind these flags must be tested with both enabled and disabled states where applicable.

## 12) Testing Matrix

Primary behavior suites:

- `__tests__/services/normalizeMessage.test.ts`
- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`
- `__tests__/integration/unifiedChat.test.ts`
- `__tests__/services/normalizeInboxRow.test.ts`
- `__tests__/hooks/inboxPathParity.test.ts`
- `__tests__/hooks/useUnifiedInboxRequests.test.ts`
- `__tests__/services/messageRequests.test.ts`
- `__tests__/services/normalizeNotification.test.ts`
- `__tests__/components/conversationItem.unreadBadge.test.ts`
- `__tests__/screens/threadScreen.lifecycle.test.ts`

Recommended commands:

```bash
npx jest __tests__/services/normalizeMessage.test.ts --runInBand
npx jest __tests__/services/chatV2.mergeMessagesWithOutbox.test.ts --runInBand
npx jest __tests__/integration/unifiedChat.test.ts --runInBand
npx jest __tests__/hooks/inboxPathParity.test.ts --runInBand
npx jest __tests__/hooks/useUnifiedInboxRequests.test.ts --runInBand
npx jest __tests__/services/messageRequests.test.ts --runInBand
npx jest __tests__/services/normalizeNotification.test.ts --runInBand
npx jest __tests__/components/conversationItem.unreadBadge.test.ts --runInBand
npx jest __tests__/screens/threadScreen.lifecycle.test.ts --runInBand
```

If backend notification or inbox trigger code changes:

```bash
npm --prefix firebase-backend/functions run build
```

## 13) Manual Smoke Checklist

1. Inbox tab switching works (`all`, `unread`, `groups`, `dms`, `requests`).
2. Requests tab shows friend/group/message requests and refreshes all sources.
3. DM and group sends reconcile optimistic and server state without duplicates.
4. Pagination and realtime overlap does not duplicate or reorder unexpectedly.
5. Opening/closing thread screens does not leak listeners.
6. Notification tap routes to the correct chat/group/game/achievement screen.

## 14) Troubleshooting

Symptom: duplicate messages after pagination/realtime overlap

- Check `src/services/chat/normalizeMessage.ts`
- Check `src/services/messaging/messageMerge.ts`
- run merge-related test suites

Symptom: unread mismatch between inbox modes

- Check `src/services/chat/normalizeInboxRow.ts`
- Check `src/hooks/useInboxData.ts` and `src/hooks/useInboxAggregation.ts`
- verify `MembersPrivate` watermarks

Symptom: requests tab missing one source

- Check `src/hooks/useUnifiedInboxRequests.ts`
- Check source hooks (`useFriendRequests`, `useMessageRequests`, group invites)

Symptom: notification routes to wrong destination or duplicates

- Check `src/services/notifications/normalizeNotification.ts`
- Check `src/store/AuthContext.tsx`
- Check `src/store/InAppNotificationsContext.tsx`
- verify `CHAT_LEGACY_PUSH_ENABLED` deployment intent
