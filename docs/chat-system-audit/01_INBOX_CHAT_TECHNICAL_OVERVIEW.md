# Inbox & Chat System - Technical Overview

Last verified: 2026-03-05
Status: Phase 3+ complete (contract parity fixes landed, tests expanded, docs consolidated)

> Historical checkpoint document. Use `docs/features/messaging.md` and the current code as the source of truth.

## 1) Scope

This document is the architecture reference for the production Inbox and Chat stack:

- inbox list (DM + group rows)
- requests tab (friend requests + group invites + message requests)
- DM and group thread rendering and send pipeline
- thread reply view and realtime lifecycle
- notification entry points into chat and games
- dual runtime behavior (SQLite-first native and Firestore-first fallback)

This document does not cover call/media infrastructure in depth, profile/economy systems, or games internals beyond chat entry points.

## 2) System Map

```text
InboxScreen (ChatListScreenV2)
  |- Inbox rows (fan-out or aggregated source)
  |- Requests tab (unified typed source)
  |- Conversation actions (pin/mute/archive/delete)
  v
ChatScreen / GroupChatScreen
  |- useUnifiedChatScreen
  |- useChat (runtime selector)
  |- ChatComposer + ChatMessageList
  |- send/edit/delete/reaction/message request flows
  v
ThreadScreen
  |- root message + replies
  |- realtime lifecycle helper
  v
Firestore + Functions
  |- Chats/*, Groups/*, MembersPrivate/*
  |- Users/{uid}/Inbox/* (aggregated mode)
  |- Users/{uid}/MessageRequests/*
  |- Messaging callables + inbox triggers + notification triggers
```

## 3) Navigation Surfaces

Primary route contracts:

- `src/navigation/RootNavigator.tsx`
- `src/types/navigation/root.ts`

Chat-relevant routes:

- `InboxStack.ChatList` -> `src/screens/chat/ChatListScreenV2.tsx`
- `InboxStack.InboxSearch` -> `src/screens/chat/InboxSearchScreen.tsx`
- `InboxStack.InboxSettings` -> `src/screens/chat/InboxSettingsScreen.tsx`
- `ChatDetail` -> `src/screens/chat/ChatScreen.tsx`
- `GroupChat` -> `src/screens/groups/GroupChatScreen.tsx`
- `ThreadView` -> `src/screens/chat/ThreadScreen.tsx`
- `Connections` -> `src/screens/friends/FriendsScreen.tsx`
- `ProfileStack.BlockedUsers` -> `src/screens/settings/BlockedUsersScreen.tsx`

Notification routes into this area are normalized through `src/services/notifications/normalizeNotification.ts` and consumed by `src/store/AuthContext.tsx` and `src/store/InAppNotificationsContext.tsx`.

## 4) Runtime Architecture

## 4.1 Message runtime selector

Entry hook: `src/hooks/useChat.ts`

- Native default (`USE_LOCAL_STORAGE=true`):
  - `useLocalMessages` (`src/hooks/useLocalMessages.ts`)
  - SQLite repositories under `src/services/database/*`
  - sync bridge: `src/services/sync/syncEngine.ts`
- Fallback (`USE_LOCAL_STORAGE=false`, web path and fallback scenarios):
  - `useUnifiedMessages` (`src/hooks/useUnifiedMessages.ts`)
  - Firestore realtime via `src/services/messaging/subscribe.ts`

Both paths normalize into canonical `MessageV2` with shared comparison and dedupe logic from `src/services/chat/normalizeMessage.ts`.

## 4.2 Inbox runtime selector

Entry hook: `src/hooks/useInboxData.ts`

- Fan-out mode (`CHAT_FEATURES.CHAT_INBOX_AGGREGATION=false`):
  - subscribes to `Chats` and `Groups`
  - joins member private state from `MembersPrivate`
  - uses shared fan-out normalizers in `src/services/chat/fanoutInboxNormalization.ts`
- Aggregated mode (`CHAT_FEATURES.CHAT_INBOX_AGGREGATION=true`):
  - `useInboxAggregation` (`src/hooks/useInboxAggregation.ts`)
  - reads `Users/{uid}/Inbox/*`
  - still pulls `MembersPrivate` for authoritative unread and settings parity

Both modes produce the same `InboxConversation` shape via `src/services/chat/normalizeInboxRow.ts`.

## 4.3 Requests runtime

Unified requests source:

- `src/hooks/useUnifiedInboxRequests.ts`
- merge and sort contract: `src/services/chat/unifiedInboxRequests.ts`

Merged sources:

- friend requests (`useFriendRequests`)
- group invites (`subscribeToPendingInvites`)
- message requests (`useMessageRequests`)

The requests tab in `ChatListScreenV2` now renders this single typed stream.

## 4.4 Notification runtime

- Push tap normalization and navigation:
  - `src/store/AuthContext.tsx`
  - adapter: `src/services/notifications/normalizeNotification.ts`
- Foreground in-app notifications:
  - `src/store/InAppNotificationsContext.tsx`
  - listeners for friend requests, chat updates, group updates, and `Users/{uid}/InAppNotificationsV4`
- Legacy DM/group push triggers are environment-gated:
  - `firebase-backend/functions/src/notifications.ts`
  - flag: `CHAT_LEGACY_PUSH_ENABLED`

## 5) Message Flow

## 5.1 Send pipeline (high level)

1. UI calls `chat.sendMessage(...)` from `useChat`.
2. Runtime path:
- local-first inserts to SQLite and syncs pending writes.
- fallback path invokes messaging service and callable.
3. Cloud Function `sendMessageV2` validates auth, membership, block/rate-limit, and message request gating.
4. Server writes message with authoritative timestamp and updates conversation preview fields.
5. Realtime subscription merges server snapshot with optimistic state.

Core files:

- `src/hooks/useChat.ts`
- `src/services/messaging/send.ts`
- `src/services/messaging/messageMerge.ts`
- `firebase-backend/functions/src/messaging.ts`

## 5.2 Ordering and dedupe

Canonical sort precedence (every runtime path):

1. `serverReceivedAt` descending
2. `createdAt` descending
3. `id` descending

Canonical helpers:

- `compareMessagesCanonicalDesc`
- `dedupeAndSortMessages`
- `mergeMessageCollections`

All in `src/services/chat/normalizeMessage.ts`.

## 5.3 Realtime + pagination merge

Realtime and pagination overlap (including modified snapshots) is unified through:

- `src/services/chat/unifiedMessagesLifecycle.ts`
- `src/services/messaging/messageMerge.ts`

Goal: no duplicate rows and stable identity when optimistic messages are reconciled by server snapshots.

## 6) Inbox and Unread Behavior

## 6.1 Unread source of truth

Authoritative inputs:

- `MembersPrivate.lastSeenAtPrivate`
- `MembersPrivate.lastMarkedUnreadAt`
- last activity timestamp from conversation/inbox entry

Fallback input only when private watermark is missing:

- aggregated `unreadCount` hint from `Users/{uid}/Inbox/{threadId}`

Canonical unread computation lives in `computeUnreadCount` inside `src/services/chat/normalizeInboxRow.ts`.

## 6.2 Mark-read behavior

- UI optimistically sets local unread to `0`.
- Conversation open updates private watermark through DM/group member services.
- When aggregated inbox mode is enabled, mark-read also calls `markInboxRead` callable to clear inbox hint count.

## 6.3 Sort behavior

Inbox ordering is shared across both modes:

1. pinned rows first (`pinnedAt` descending among pinned)
2. then most recent activity (`lastMessage.timestamp` or `createdAt`)
3. stable tie-breaker by `id`

## 7) Requests Tab Behavior

Requests tab rendering in `ChatListScreenV2`:

- consumes `useUnifiedInboxRequests`
- stable item key format: `{kind}:{id}`
- pull-to-refresh calls unified refresh
- per-kind action handlers:
  - friend: accept/decline
  - group invite: accept/decline + navigate to group on accept
  - message request: accept/decline callable wrappers

## 8) Thread Realtime Lifecycle

Thread subscriptions are lifecycle-scoped via:

- `src/screens/chat/threadLifecycle.ts`

Guarantees:

- subscribe once for active thread context
- cleanup unsubscribes on screen unmount/route change
- no callback execution after cleanup

## 9) Runtime Mode Parity Guarantees

The following parity guarantees are now explicit and test-backed:

1. Same canonical message shape from SQLite rows and Firestore docs.
2. Same ordering rules in all runtime paths.
3. Same dedupe semantics for pagination and realtime overlap.
4. Same inbox row shape across fan-out and aggregated modes.
5. Same unread computation function across inbox data sources.
6. Same request tab semantics regardless of source-specific backend behavior.

## 10) Recent Fixes (2026-03-05)

1. Timestamp normalization crash fix:
- path: `src/services/chat/normalizeMessage.ts`
- issue: unbound `toMillis` call against Firestore Timestamp-like objects
- fix: bound method call + `{seconds,nanoseconds}` fallback

2. Text-node rendering guard:
- paths:
  - `src/components/chat/ChatComposer.tsx`
  - `src/components/chat/SwipeableMessageWrapper.tsx`
- issue: raw primitive child content under `View` caused runtime warning
- fix: normalize primitive children before rendering in `View` slots

## 11) Test Coverage Map (Chat/Inbox)

Contract and merge tests:

- `__tests__/services/normalizeMessage.test.ts`
- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`
- `__tests__/services/normalizeInboxRow.test.ts`
- `__tests__/services/normalizeNotification.test.ts`
- `__tests__/services/messageRequests.test.ts`

Hook and integration behavior:

- `__tests__/hooks/inboxPathParity.test.ts`
- `__tests__/hooks/useUnifiedInboxRequests.test.ts`
- `__tests__/integration/unifiedChat.test.ts`
- `__tests__/screens/threadScreen.lifecycle.test.ts`

UI behavior:

- `__tests__/components/conversationItem.unreadBadge.test.ts`

## 12) Manual Verification Checklist

1. Inbox loads with identical semantics in fan-out and aggregated modes.
2. Requests tab shows friend/group/message requests and refreshes all sources.
3. Open DM and group threads, send messages, no duplicates on realtime updates.
4. Scroll pagination and receive realtime updates concurrently, ordering remains stable.
5. Open thread view and navigate away/back, no leaked listeners.
6. Notification tap routes to correct destination without duplicate navigation.

## 13) Related Docs

- Data contracts: `docs/chat-system-audit/02_INBOX_CHAT_DATA_CONTRACTS.md`
- Risks and follow-ups: `docs/chat-system-audit/03_INBOX_CHAT_KNOWN_ISSUES_RISKS.md`
- Sustaining plan: `docs/chat-system-audit/04_INBOX_CHAT_REFACTOR_PLAN.md`
- Implementation checkpoints: `docs/chat-system-audit/05_PHASE2_CHECKPOINTS.md`
- Feature-level messaging reference: `docs/features/messaging.md`
