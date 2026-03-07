# Inbox and Chat System Master Reference

Last verified: 2026-03-05
Status: Consolidated Phase 3+ reference for the entire inbox/chat system

## 1) Purpose

This document consolidates all inbox/chat findings, discoveries, contracts, architecture notes, risk tracking, tests, and QA guidance into a single reference.

Use this document when you need one place to understand:

- how inbox and chat work today
- where data is produced, transformed, and rendered
- which contracts are canonical
- what was fixed in Phase 3+
- what risks remain
- how to verify and troubleshoot changes safely

Code remains the source of truth when this document and implementation diverge.

## 2) Consolidated Sources

This file consolidates information from:

- `docs/chat-system-audit/01_INBOX_CHAT_TECHNICAL_OVERVIEW.md`
- `docs/chat-system-audit/02_INBOX_CHAT_DATA_CONTRACTS.md`
- `docs/chat-system-audit/03_INBOX_CHAT_KNOWN_ISSUES_RISKS.md`
- `docs/chat-system-audit/04_INBOX_CHAT_REFACTOR_PLAN.md`
- `docs/chat-system-audit/05_PHASE2_CHECKPOINTS.md`
- `docs/features/messaging.md`
- `docs/QA_IN_APP_NOTIFICATIONS.md`

## 3) Executive System State

Current implementation state:

1. Dual runtime architecture is active by design.
2. Parity controls now exist for message normalization, inbox row normalization, and unread semantics.
3. Requests tab now uses one typed unified source.
4. Notification routing now uses one canonical payload adapter.
5. Known crash on group entry caused by timestamp conversion and text-node rendering warnings has been fixed.
6. Prior high-risk coverage gaps now have concrete deterministic tests.

Current maturity:

- Phase 3 cleanup complete.
- System is in hardening and sustainment mode.

## 4) Scope and Boundaries

Included:

- DM and group inbox rows
- requests tab
- DM and group message lifecycle
- thread view lifecycle
- unread semantics
- notification intake and routing for chat and games
- migration flags and runtime parity

Not deeply covered:

- media/call internals
- profile/economy internals except where they intersect with chat
- game runtime internals outside notification touchpoints

## 5) High-Level Architecture

```text
ChatListScreenV2 (Inbox)
  |- Inbox rows (fan-out or aggregated)
  |- Requests tab (friend + group + message requests)
  |- Conversation actions (pin/mute/archive/delete/read)
  v
ChatScreen / GroupChatScreen
  |- useChat runtime selector
  |- Local-first or Firestore-first message path
  |- Composer, message list, outbox merge
  v
ThreadScreen
  |- root + replies
  |- lifecycle-scoped realtime subscription
  v
Firestore + Functions
  |- Chats, Groups, MembersPrivate
  |- Users/{uid}/Inbox
  |- Users/{uid}/MessageRequests
  |- InAppNotificationsV4
  |- send/message request/inbox/notification functions
```

## 6) Navigation Surfaces

Primary route contracts:

- `src/navigation/RootNavigator.tsx`
- `src/types/navigation/root.ts`

Chat-related routes:

- `InboxStack.ChatList`
- `InboxStack.InboxSearch`
- `InboxStack.InboxSettings`
- `ChatDetail`
- `GroupChat`
- `ThreadView`
- `Connections`
- `ProfileStack.BlockedUsers`

Notification-based routing is normalized before navigation.

## 7) Runtime Mode Architecture

## 7.1 Message Runtime Selector

Entry hook:

- `src/hooks/useChat.ts`

Mode A, local-first (`USE_LOCAL_STORAGE=true`):

- `src/hooks/useLocalMessages.ts`
- SQLite repositories in `src/services/database/*`
- sync bridge in `src/services/sync/syncEngine.ts`

Mode B, fallback (`USE_LOCAL_STORAGE=false`):

- `src/hooks/useUnifiedMessages.ts`
- Firestore subscription layer in `src/services/messaging/subscribe.ts`

Shared parity layer used by both:

- `src/services/chat/normalizeMessage.ts`

## 7.2 Inbox Runtime Selector

Entry hook:

- `src/hooks/useInboxData.ts`

Fan-out path (`CHAT_FEATURES.CHAT_INBOX_AGGREGATION=false`):

- subscribes to `Chats` and `Groups`
- reads `MembersPrivate`
- uses `src/services/chat/fanoutInboxNormalization.ts`

Aggregated path (`CHAT_FEATURES.CHAT_INBOX_AGGREGATION=true`):

- `src/hooks/useInboxAggregation.ts`
- reads `Users/{uid}/Inbox/*`
- still reads `MembersPrivate` for unread/settings parity

Shared row and unread normalization for both:

- `src/services/chat/normalizeInboxRow.ts`

## 7.3 Requests Runtime

Unified requests hook:

- `src/hooks/useUnifiedInboxRequests.ts`

Merged sources:

- friend requests (`useFriendRequests`)
- group invites (`subscribeToPendingInvites`)
- message requests (`useMessageRequests`)

Merge contract helper:

- `src/services/chat/unifiedInboxRequests.ts`

Requests tab consumer:

- `src/screens/chat/ChatListScreenV2.tsx`

## 7.4 Notification Runtime

Push tap intake:

- `src/store/AuthContext.tsx`

Foreground in-app intake:

- `src/store/InAppNotificationsContext.tsx`

Canonical adapter used by both:

- `src/services/notifications/normalizeNotification.ts`

Legacy backend triggers gating:

- `firebase-backend/functions/src/notifications.ts`
- env flag: `CHAT_LEGACY_PUSH_ENABLED`

## 8) End-to-End Flows

## 8.1 Inbox Load (Fan-out Mode)

1. `useInboxData` subscribes to `Chats` and `Groups` for the current user.
2. Private member state is loaded from `MembersPrivate` docs.
3. Fan-out normalizers build canonical rows via shared row helper.
4. Rows are sorted with pinned-first and latest-activity ordering.

## 8.2 Inbox Load (Aggregated Mode)

1. `useInboxAggregation` subscribes to `Users/{uid}/Inbox`.
2. Each inbox entry is enriched with authoritative `MembersPrivate` state.
3. Entries are normalized through `normalizeConversationFromInboxEntry`.
4. Shared sort rules are applied.

## 8.3 Send Message Flow

1. UI calls `chat.sendMessage(...)` from `useChat`.
2. Local-first path inserts optimistic local row and starts sync.
3. Fallback path sends through service/callable and consumes realtime snapshots.
4. Server `sendMessageV2` validates auth, membership, block, rate limits, and message requests gating.
5. Message merges through canonical dedupe/ordering helpers.

## 8.4 Mark Read Flow

1. UI optimistically sets local unread to zero.
2. DM/group read watermark updates private member state.
3. If aggregated inbox is enabled, `markInboxRead` callable resets server unread hint.

## 8.5 Requests Flow

1. Unified hook merges friend/group/message requests into one list.
2. Requests tab renders by item `kind` with stable key `${kind}:${id}`.
3. Refresh triggers all request sources.
4. Accept/decline dispatches to source-specific handlers/callables.

## 8.6 Thread Lifecycle Flow

1. Thread screen creates lifecycle-scoped subscription.
2. Callback reloads thread content while mounted.
3. Cleanup marks lifecycle inactive and unsubscribes.
4. No callback executes after cleanup.

## 8.7 Notification Flow

1. Raw payload arrives from push or in-app collection.
2. `normalizeNotificationPayload` maps raw variants to canonical route and dedupe key.
3. Dedupe checks prevent duplicate handling in short windows.
4. Route navigation executes from canonical notification model.

## 9) Canonical Data Contracts

Contract type source:

- `src/types/messaging.ts`

## 9.1 Message Contract (`MessageV2`)

Core fields used by UI and merge logic:

- identity: `id`, `scope`, `conversationId`
- sender: `senderId`, `senderName`, `senderAvatarConfig`
- content: `kind`, `text`, `animalId`, `attachments`
- ordering: `createdAt`, `serverReceivedAt`, `editedAt`
- thread/reply: `replyTo`, `threadRootId`, `replyCount`, `lastReplyAt`
- lifecycle/deletion: `deletedForAll`, `hiddenFor`
- mentions/reactions: `mentionUids`, `mentionSpans`, `reactionsSummary`
- idempotency: `clientId`, `idempotencyKey`
- compatibility: `status`, `isLocal` (advisory)

## 9.2 Reply Contract (`ReplyToMetadata`)

- `messageId`
- `senderId`
- `senderName`
- `kind`
- `textSnippet`
- `attachmentPreview`

## 9.3 Inbox Aggregated Contract (`InboxEntry`)

Path:

- `Users/{uid}/Inbox/{threadId}`

Important fields:

- `threadId`, `scope`, `conversationId`
- `lastActivityAt`, `lastSenderId`, `lastMessageKind`, `lastMessagePreview`
- `unreadCount`, `unreadSince`
- `pinnedAt`, `archived`, `mutedUntil`, `notifyLevel`
- group snapshots: `groupName`, `avatarPath`, `memberCount`
- DM snapshots: `otherUserName`, `otherUserId`

Server write source:

- `firebase-backend/functions/src/inboxTriggers.ts`

## 9.4 Inbox UI Contract (`InboxConversation`)

Fields rendered by inbox UI:

- conversation metadata: `id`, `type`, `name`, avatar fields
- preview: `lastMessage.{text,senderName,timestamp,type}`
- private state: `memberState`
- computed: `unreadCount`, `hasMentions`
- supplemental: `isOnline`, `createdAt`, `participantCount`

## 9.5 Member State Contract (`MemberStatePrivate`)

Authoritative unread and user-specific behavior fields:

- `lastSeenAtPrivate`
- `lastMarkedUnreadAt`
- `archived`, `mutedUntil`, `notifyLevel`
- `pinnedAt`, `deletedAt`, `hiddenUntilNewMessage`
- `showMemberChatStyles`

## 9.6 Message Request Contract

`MessageRequest`:

- `chatId`
- `requesterId`, `requesterName`, `requesterAvatarConfig`
- `status` (`pending`, `accepted`, `declined`)
- `createdAt`, `resolvedAt`
- `messagePreview`, `messageKind`

Callable response contract:

- `MessageRequestResponse { success: boolean }`

## 9.7 Unified Requests Union Contract

`UnifiedInboxRequestItem` variants:

1. `kind="friend_request"`
2. `kind="group_invite"`
3. `kind="message_request"`

Merge semantics:

- dedupe key `${kind}:${id}`
- sort by `createdAt desc`, then `id asc`

## 9.8 Canonical Notification Contract

`CanonicalNotification` output fields:

- `type`: `message`, `group_message`, `friend_request`, `game_turn`, `achievement_unlocked`
- `dedupeKey`
- `route { screen, params }`

## 10) Canonical Normalization Layers

## 10.1 Message Normalization

Shared helper file:

- `src/services/chat/normalizeMessage.ts`

Boundary functions:

- `normalizeMessageFromLocalRow`
- `normalizeMessageFromFirestoreDoc`

Critical fix included:

- Firestore Timestamp-like conversion now safely handles bound `toMillis` and `{seconds,nanoseconds}` fallback.

## 10.2 Inbox Row Normalization

Shared helper file:

- `src/services/chat/normalizeInboxRow.ts`

Functions:

- `normalizeConversationRow`
- `normalizeConversationFromInboxEntry`
- `sortInboxConversations`

Fan-out wrappers:

- `src/services/chat/fanoutInboxNormalization.ts`

## 10.3 Requests Normalization

Files:

- `src/services/chat/unifiedInboxRequests.ts`
- `src/services/chat/messageRequestsContract.ts`

Functions:

- `mergeUnifiedInboxRequests`
- `normalizePendingMessageRequests`
- `callAcceptMessageRequest`
- `callDeclineMessageRequest`

## 10.4 Notification Normalization

File:

- `src/services/notifications/normalizeNotification.ts`

Functions:

- `normalizeNotificationPayload`
- `shouldHandleNotificationByDedupeKey`

## 11) Canonical Ordering and Dedupe Invariants

Message ordering precedence everywhere:

1. `serverReceivedAt` descending
2. `createdAt` descending
3. `id` descending

Canonical dedupe identity:

- `message.id`

Conflict resolution:

- newer canonical timestamp wins
- if tied, prefer server-confirmed/non-local over local optimistic variant

Core functions:

- `compareMessagesCanonicalDesc`
- `dedupeAndSortMessages`
- `mergeMessageCollections`

## 12) Unread Source of Truth (Exact Rules)

Canonical function:

- `computeUnreadCount` in `src/services/chat/normalizeInboxRow.ts`

Constants:

- `UNREAD_TOLERANCE_MS = 5000`
- `RECENTLY_READ_TTL_MS = 30000`

Inputs:

- `lastActivityAt`
- `memberState.lastSeenAtPrivate`
- `memberState.lastMarkedUnreadAt`
- optional `recentlyReadAt`
- optional `unreadHintCount`

Rules in strict order:

1. If `recentlyReadAt` is still in TTL window, unread is `0`.
2. If `lastMarkedUnreadAt > lastSeenAtPrivate`, unread is `1`.
3. If `lastActivityAt > lastSeenAtPrivate + tolerance`, unread is `1`.
4. If no private watermark exists and unread hint is present, unread is `1`.
5. Otherwise unread is `0`.

Unread badge rendering rule:

- helper: `src/components/chat/inbox/unreadBadge.ts`
- values: empty for `<=0`, numeric `1..99`, cap `99+`

## 13) Backend Integration Map

## 13.1 Messaging Function Layer

Primary server file:

- `firebase-backend/functions/src/messaging.ts`

Responsibilities:

- auth and membership checks
- block checks
- rate limiting checks
- message request gating integration
- idempotent message write semantics

## 13.2 Inbox Trigger Layer

File:

- `firebase-backend/functions/src/inboxTriggers.ts`

Responsibilities:

- update per-user aggregated inbox docs on DM/group message creation
- reset sender unread, increment recipients unread
- maintain preview and snapshot fields
- expose `markInboxRead` callable to clear unread hints

## 13.3 Message Request Layer

File:

- `firebase-backend/functions/src/messageRequests.ts`

Responsibilities:

- enforce recipient DM acceptance policy
- create pending requests for non-friend DM attempts when configured
- accept and decline callables
- optional requester block on decline

## 13.4 Notification Trigger Layer

File:

- `firebase-backend/functions/src/notifications.ts`

Responsibilities:

- keep deployed trigger names stable
- gate legacy push triggers using `CHAT_LEGACY_PUSH_ENABLED`

## 14) Feature Flags and Runtime Toggles

Client/runtime flags:

- `USE_LOCAL_STORAGE`
- `CHAT_FEATURES.CHAT_INBOX_AGGREGATION`
- `CHAT_FEATURES.CHAT_MESSAGE_REQUESTS`
- `CHAT_FEATURES.CHAT_DELIVERY_ACKS`

Backend/env flag:

- `CHAT_LEGACY_PUSH_ENABLED`

Guidance:

1. Any contract-affecting change must be tested in both relevant flag states.
2. Toggle flips must not change unread semantics or row shape unexpectedly.
3. Notification migrations must explicitly set legacy flag intent per environment.

## 15) Findings and Discoveries (Consolidated)

## 15.1 Major Risk Areas Identified

1. Dual runtime contract drift risk between SQLite-first and fallback.
2. Inbox path drift risk between fan-out and aggregated modes.
3. Request source fragmentation in requests tab.
4. Notification payload/channel overlap and routing mismatch risk.
5. Missing deterministic tests in critical merge and lifecycle paths.

## 15.2 Concrete Discoveries and Resolutions

Dual runtime drift:

- discovery: local and Firestore payloads could diverge on ordering/status semantics.
- resolution: one canonical normalization + merge layer.

Inbox path drift:

- discovery: aggregated hints and fan-out member state could produce unread inconsistencies.
- resolution: both paths normalized through shared helper; aggregated path now consults `MembersPrivate`.

Requests fragmentation:

- discovery: friend/group/message requests had partially separate UI and refresh behavior.
- resolution: single typed hook and merged list contract.

Notification overlap:

- discovery: payload variants and legacy/new channel overlap caused dedupe and routing edge risks.
- resolution: canonical adapter plus dedupe-key gating; legacy triggers env-gated.

Group entry crash and warning:

- discovery: unbound `toMillis` usage caused runtime failure on timestamp-like objects; primitive text rendering under `View` caused warnings.
- resolution: robust timestamp conversion and child rendering guards.

## 16) Risk Ledger (Current)

## 16.1 Resolved Risks

Resolved on 2026-03-05:

1. Dual runtime contract drift.
2. Multiple inbox paths drift.
3. Requests tab source fragmentation.
4. Notification payload overlap and routing mismatch.
5. Group chat runtime crash and text-node warning.

## 16.2 Remaining Non-Blocking Risks

1. Legacy push overlap if `CHAT_LEGACY_PUSH_ENABLED` is misconfigured.
2. Whole-repo TypeScript baseline instability limits chat-only gate confidence.
3. Aggregated inbox enrichments remain intentionally minimal.

## 16.3 Remaining Backlog Actions

1. Add deploy-time safeguards and explicit logging for notification migration flag.
2. Expand high-volume realtime plus pagination overlap stress tests.
3. Add inbox parity telemetry for canary drift detection.

## 17) Runtime Mode Parity Guarantees

Guaranteed and test-backed:

1. Same canonical message shape from local rows and Firestore docs.
2. Same ordering and dedupe behavior in both runtimes.
3. Same no-duplicate guarantees for pagination and realtime overlap.
4. Same normalized inbox row semantics for fan-out and aggregated paths.
5. Same unread computation rules for both inbox modes.
6. Same requests-tab semantics regardless of source provider.

## 18) Test Coverage Matrix

Core contract tests:

- `__tests__/services/normalizeMessage.test.ts`
- `__tests__/services/normalizeInboxRow.test.ts`
- `__tests__/services/normalizeNotification.test.ts`
- `__tests__/services/messageRequests.test.ts`

Merge and integration tests:

- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`
- `__tests__/integration/unifiedChat.test.ts`

Hook parity tests:

- `__tests__/hooks/inboxPathParity.test.ts`
- `__tests__/hooks/useUnifiedInboxRequests.test.ts`

UI and lifecycle tests:

- `__tests__/components/conversationItem.unreadBadge.test.ts`
- `__tests__/screens/threadScreen.lifecycle.test.ts`

Original gap list closure status:

1. `messageRequests.test.ts` coverage gap: closed.
2. `unifiedChat.test.ts` call-signature-only gap: closed with lifecycle and race assertions.
3. `mergeMessagesWithOutbox` pagination/realtime overlap gap: closed.
4. unread badge focused tests gap: closed.
5. ThreadScreen realtime lifecycle/unsubscribe gap: closed.

## 19) Verification Commands

Targeted test commands:

```bash
npx jest __tests__/services/normalizeMessage.test.ts --runInBand
npx jest __tests__/services/chatV2.mergeMessagesWithOutbox.test.ts --runInBand
npx jest __tests__/integration/unifiedChat.test.ts --runInBand
npx jest __tests__/services/normalizeInboxRow.test.ts --runInBand
npx jest __tests__/hooks/inboxPathParity.test.ts --runInBand
npx jest __tests__/hooks/useUnifiedInboxRequests.test.ts --runInBand
npx jest __tests__/services/messageRequests.test.ts --runInBand
npx jest __tests__/services/normalizeNotification.test.ts --runInBand
npx jest __tests__/components/conversationItem.unreadBadge.test.ts --runInBand
npx jest __tests__/screens/threadScreen.lifecycle.test.ts --runInBand
```

Backend build when trigger/callable layer changes:

```bash
npm --prefix firebase-backend/functions run build
```

## 20) Manual QA Checklist

## 20.1 Inbox and Requests

1. Inbox loads and tab switching works (`all`, `unread`, `groups`, `dms`, `requests`).
2. Requests tab shows friend/group/message requests in one list.
3. Pull-to-refresh updates all request sources.

## 20.2 Messaging Lifecycle

1. Open DM and group threads, send messages, verify no duplication.
2. Trigger pagination and realtime updates simultaneously, verify stable ordering.
3. Background/foreground app and re-open threads, verify no duplicate merges.

## 20.3 Runtime Parity

1. Flip `CHAT_INBOX_AGGREGATION` on and off.
2. Confirm unread and preview semantics stay consistent.

## 20.4 Notifications

1. Validate in-app banners show/suppress correctly by context.
2. Validate dedupe behavior within debounce windows.
3. Validate tap routing to correct destination.
4. Validate no user-visible duplicate events when migration flag is configured correctly.

## 21) Troubleshooting Playbook

Symptom: duplicate messages after realtime plus pagination

1. Inspect `src/services/chat/normalizeMessage.ts`.
2. Inspect `src/services/messaging/messageMerge.ts`.
3. Run merge and integration test suites.

Symptom: unread mismatch across inbox modes

1. Inspect `src/services/chat/normalizeInboxRow.ts`.
2. Compare `useInboxData` and `useInboxAggregation` inputs.
3. Validate `MembersPrivate.lastSeenAtPrivate` and `lastMarkedUnreadAt`.

Symptom: requests tab missing source

1. Inspect `src/hooks/useUnifiedInboxRequests.ts`.
2. Validate each source hook/provider status.
3. Validate merge helper output and sort.

Symptom: notification routes wrong or duplicates

1. Inspect `src/services/notifications/normalizeNotification.ts`.
2. Validate dedupe key behavior in both Auth and InApp contexts.
3. Confirm `CHAT_LEGACY_PUSH_ENABLED` intent for environment.

Symptom: group chat entry crash related to timestamps

1. Validate `normalizeMessageFromFirestoreDoc` timestamp conversion path.
2. Check for payloads containing `{seconds,nanoseconds}` without bound `toMillis` context.

## 22) Checkpoint Timeline (Consolidated)

| Checkpoint | Date | Theme | Status |
| --- | --- | --- | --- |
| C1 | 2026-03-04 | Thread listener and notification correctness | Complete |
| C2 | 2026-03-04 | Requests tab integration and dead code cleanup | Complete |
| C3 | 2026-03-04 | Local message lifecycle reset hardening | Complete |
| C4 | 2026-03-04 | Merge and dedupe extraction | Complete |
| C5 | 2026-03-05 | Canonical message normalization parity | Complete |
| C6 | 2026-03-05 | Inbox normalization and unread parity | Complete |
| C7 | 2026-03-05 | Unified inbox requests typed hook | Complete |
| C8 | 2026-03-05 | Notification adapter and legacy gating | Complete |
| C9 | 2026-03-05 | Timestamp crash and text-node warning fixes | Complete |

## 23) Release and Change Governance

Minimum release gates for chat-affecting changes:

1. Targeted suites pass for affected contracts.
2. Manual smoke matrix passes.
3. Backend build passes when functions changed.
4. Docs are updated in same PR when contract or behavior changes.

Escalation triggers:

1. Unread drift between fan-out and aggregated modes.
2. Duplicate rows after merge of pagination and realtime streams.
3. Notification duplicate handling across channels.
4. State updates after unmount in message or thread lifecycle.

Escalation package should include:

- repro steps
- active flags
- affected paths
- failing or missing tests

## 24) Complete File Index

## 24.1 Core UI Screens

- `src/screens/chat/ChatListScreenV2.tsx`
- `src/screens/chat/ChatScreen.tsx`
- `src/screens/groups/GroupChatScreen.tsx`
- `src/screens/chat/ThreadScreen.tsx`

## 24.2 Hooks

- `src/hooks/useChat.ts`
- `src/hooks/useLocalMessages.ts`
- `src/hooks/useUnifiedMessages.ts`
- `src/hooks/useInboxData.ts`
- `src/hooks/useInboxAggregation.ts`
- `src/hooks/useConversationActions.ts`
- `src/hooks/useMessageRequests.ts`
- `src/hooks/useUnifiedInboxRequests.ts`

## 24.3 Chat Services and Helpers

- `src/services/chat/normalizeMessage.ts`
- `src/services/chat/normalizeInboxRow.ts`
- `src/services/chat/fanoutInboxNormalization.ts`
- `src/services/chat/unifiedInboxRequests.ts`
- `src/services/chat/messageRequestsContract.ts`
- `src/services/chat/inboxAggregation.ts`
- `src/services/chat/unifiedMessagesLifecycle.ts`
- `src/services/messaging/send.ts`
- `src/services/messaging/subscribe.ts`
- `src/services/messaging/messageMerge.ts`

## 24.4 State and Notification Contexts

- `src/store/AuthContext.tsx`
- `src/store/InAppNotificationsContext.tsx`

## 24.5 UI Components

- `src/components/chat/inbox/ConversationItem.tsx`
- `src/components/chat/inbox/unreadBadge.ts`
- `src/components/chat/ChatComposer.tsx`
- `src/components/chat/SwipeableMessageWrapper.tsx`

## 24.6 Backend Functions

- `firebase-backend/functions/src/messaging.ts`
- `firebase-backend/functions/src/inboxTriggers.ts`
- `firebase-backend/functions/src/messageRequests.ts`
- `firebase-backend/functions/src/notifications.ts`

## 24.7 Contracts and Types

- `src/types/messaging.ts`

## 24.8 Test Suites

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

## 24.9 Related Documentation

- `docs/features/messaging.md`
- `docs/QA_IN_APP_NOTIFICATIONS.md`
- `docs/chat-system-audit/01_INBOX_CHAT_TECHNICAL_OVERVIEW.md`
- `docs/chat-system-audit/02_INBOX_CHAT_DATA_CONTRACTS.md`
- `docs/chat-system-audit/03_INBOX_CHAT_KNOWN_ISSUES_RISKS.md`
- `docs/chat-system-audit/04_INBOX_CHAT_REFACTOR_PLAN.md`
- `docs/chat-system-audit/05_PHASE2_CHECKPOINTS.md`

## 25) Single-Document Usage Guidance

If you are new to inbox/chat and only want one place to start:

1. Read Sections 3 through 8 for architecture and flows.
2. Read Sections 9 through 13 for contracts and invariants.
3. Read Sections 15 through 18 for findings, risks, and test confidence.
4. Use Sections 19 through 21 for verification and troubleshooting.
5. Use Section 24 to jump directly to implementation files.
