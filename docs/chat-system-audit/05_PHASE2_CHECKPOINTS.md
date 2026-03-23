# Inbox & Chat System - Checkpoints And Verification

Last verified: 2026-03-05
Status: Phase 2 through Phase 3+ checkpoints consolidated

> Historical checkpoint document. Keep for migration history only; do not treat it as the current architecture contract.

## 1) Purpose

This document records concrete delivery checkpoints for the inbox/chat cleanup effort.
The file name is historical (`05_PHASE2_CHECKPOINTS.md`), but the content tracks all major checkpoints through the current Phase 3+ state.

Use this as an evidence log for:

- what changed
- why it changed
- where it changed
- how it was verified

## 2) Checkpoint Timeline

| Checkpoint | Date | Theme | Status |
| --- | --- | --- | --- |
| C1 | 2026-03-04 | Thread listener and notification correctness | Complete |
| C2 | 2026-03-04 | Requests tab integration and dead code cleanup | Complete |
| C3 | 2026-03-04 | Local message lifecycle reset hardening | Complete |
| C4 | 2026-03-04 | Merge and dedupe helper extraction | Complete |
| C5 | 2026-03-05 | Canonical message normalization parity | Complete |
| C6 | 2026-03-05 | Inbox normalization and unread source-of-truth parity | Complete |
| C7 | 2026-03-05 | Unified inbox requests typed hook | Complete |
| C8 | 2026-03-05 | Notification payload adapter and legacy gating | Complete |
| C9 | 2026-03-05 | Group chat runtime crash and text-node warning fixes | Complete |

## 3) Detailed Checkpoints

## C1 - Thread Listener And Notification Correctness

Problem:

- Thread lifecycle risked leaked listeners and stale callbacks.
- In-app notification dedupe needed stronger key handling.

Key changes:

- thread lifecycle helper extracted: `src/screens/chat/threadLifecycle.ts`
- thread screen moved to lifecycle-scoped subscription: `src/screens/chat/ThreadScreen.tsx`
- in-app notification handling tightened in `src/store/InAppNotificationsContext.tsx`

Verification:

- `__tests__/screens/threadScreen.lifecycle.test.ts`
- manual thread open/close and route churn checks

## C2 - Requests Tab Integration And Cleanup

Problem:

- Requests tab behavior was split across independent request sources.

Key changes:

- requests tab rendering path cleaned in `src/screens/chat/ChatListScreenV2.tsx`
- shared request utilities added in `src/screens/chat/requestsTabUtils.ts`

Verification:

- UI behavior validation for requests tab filters and pull-to-refresh

## C3 - Local Message Lifecycle Reset Hardening

Problem:

- conversation context switches could carry stale pagination/subscription state.

Key changes:

- state reset improvements in `src/hooks/useLocalMessages.ts`
- stronger lifecycle handoff in `src/hooks/useChat.ts`

Verification:

- regression checks by switching DMs/groups repeatedly during sync

## C4 - Merge And Dedupe Helper Extraction

Problem:

- merge behavior lived behind service boundaries that were difficult to test deterministically.

Key changes:

- merge helper centralized: `src/services/messaging/messageMerge.ts`
- shared canonical merge semantics reused by chat runtime helpers

Verification:

- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`

## C5 - Canonical Message Normalization Parity

Problem:

- SQLite rows and Firestore docs could drift in timestamp and status semantics.

Key changes:

- canonical normalizers introduced in `src/services/chat/normalizeMessage.ts`
- canonical ordering/dedupe helpers introduced and consumed by hooks/services
- Firestore timestamp-like parsing hardened (`toMillis` bound call + seconds fallback)

Verification:

- `__tests__/services/normalizeMessage.test.ts`
- `__tests__/integration/unifiedChat.test.ts`

## C6 - Inbox Normalization And Unread Source Of Truth

Problem:

- fan-out list and aggregated inbox could diverge on preview shape and unread semantics.

Key changes:

- canonical unread computation and row normalization in `src/services/chat/normalizeInboxRow.ts`
- fan-out adapters aligned in `src/services/chat/fanoutInboxNormalization.ts`
- aggregated hook uses `MembersPrivate` parity lookup: `src/hooks/useInboxAggregation.ts`
- mark-read hint clearing path integrated: `src/services/chat/inboxAggregation.ts`

Verification:

- `__tests__/services/normalizeInboxRow.test.ts`
- `__tests__/hooks/inboxPathParity.test.ts`
- `__tests__/components/conversationItem.unreadBadge.test.ts`

## C7 - Unified Inbox Requests Typed Hook

Problem:

- friend requests, group invites, and message requests were surfaced inconsistently.

Key changes:

- unified hook: `src/hooks/useUnifiedInboxRequests.ts`
- typed merge and dedupe helper: `src/services/chat/unifiedInboxRequests.ts`
- message request normalization/response contract: `src/services/chat/messageRequestsContract.ts`
- requests tab now consumes unified items: `src/screens/chat/ChatListScreenV2.tsx`

Verification:

- `__tests__/hooks/useUnifiedInboxRequests.test.ts`
- `__tests__/services/messageRequests.test.ts`

## C8 - Notification Adapter And Legacy Gating

Problem:

- multiple payload variants produced routing and dedupe edge cases.

Key changes:

- canonical adapter added: `src/services/notifications/normalizeNotification.ts`
- adapter integrated in push tap flow: `src/store/AuthContext.tsx`
- adapter integrated in in-app V4 listener: `src/store/InAppNotificationsContext.tsx`
- legacy backend push trigger gated by env: `firebase-backend/functions/src/notifications.ts`

Verification:

- `__tests__/services/normalizeNotification.test.ts`

## C9 - Group Chat Runtime Crash And Text Node Warning Fixes

Problem:

- entering some group chats caused runtime error when timestamp-like payload shape was unexpected.
- UI warning: primitive text under `View` in chat composition/wrapper paths.

Key changes:

- timestamp normalization hardened in `src/services/chat/normalizeMessage.ts`
- render-children guard improvements in:
  - `src/components/chat/ChatComposer.tsx`
  - `src/components/chat/SwipeableMessageWrapper.tsx`

Verification:

- `__tests__/services/normalizeMessage.test.ts`
- manual repro confirmation in group chat entry path

## 4) Consolidated Test Evidence

Primary suites now covering prior risk gaps:

- `__tests__/services/messageRequests.test.ts`
- `__tests__/integration/unifiedChat.test.ts`
- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`
- `__tests__/components/conversationItem.unreadBadge.test.ts`
- `__tests__/screens/threadScreen.lifecycle.test.ts`
- `__tests__/services/normalizeMessage.test.ts`
- `__tests__/services/normalizeInboxRow.test.ts`
- `__tests__/services/normalizeNotification.test.ts`
- `__tests__/hooks/inboxPathParity.test.ts`
- `__tests__/hooks/useUnifiedInboxRequests.test.ts`

## 5) Remaining Work (Non-Blocking)

1. Notification migration safety checks in deployment process (`CHAT_LEGACY_PUSH_ENABLED`).
2. Larger stress fixtures for repeated realtime and pagination overlap.
3. Optional inbox parity telemetry in controlled canary runs.

## 6) Maintenance Rules

For future chat changes:

1. If contracts change, update both docs and tests in the same PR.
2. If behavior changes intentionally, record the reason and migration impact.
3. If a checkpoint regresses, add a new checkpoint entry with repro and fix path.
