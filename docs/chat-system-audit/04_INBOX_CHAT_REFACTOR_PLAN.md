# Inbox & Chat System - Refactor Plan

Last verified: 2026-03-05  
Status: Phase 2 in progress (Steps 1-7 completed in this pass)

## Goals

- Fix correctness/reliability issues without changing intended UX.
- Reduce dead code and ambiguity in inbox/chat surfaces.
- Keep all changes incremental and reversible.

## Completed Steps

## Step 1 - Thread Realtime Lifecycle Fix

Target files:

- `src/screens/chat/ThreadScreen.tsx`
- `src/services/sync/syncEngine.ts`

Change:

- Replaced interval polling refresh loop with realtime subscription callback (`subscribeToConversation`) plus initial load.

Verification:

- Static verification and linting on touched files.
- Manual verification checklist item retained for device-level realtime behavior.

Risk:

- Low. Web path still no-op subscription by design; initial local load remains.

## Step 2 - Notification Dedupe Key Hardening

Target files:

- `src/store/InAppNotificationsContext.tsx`

Change:

- Scoped conversation timestamp tracking keys with explicit prefix (`dm:` / `group:`).

Verification:

- Code-path inspection and lint on touched files.

Risk:

- Very low; isolated keying change.

## Step 3 - Requests Tab Refresh Correctness

Target files:

- `src/screens/chat/ChatListScreenV2.tsx`

Change:

- Added request-specific refresh callback that refreshes friend requests and reloads group invites.
- Bound requests list `onRefresh` to request-specific callback.

Verification:

- Lint run on file.

Risk:

- Low; scoped to requests tab refresh wiring.

## Step 4 - Inbox Dead Code Cleanup

Target files:

- `src/screens/chat/ChatListScreenV2.tsx`

Change:

- Removed unreachable block/report modal imports, state, handlers, and JSX.

Verification:

- Lint run on file and adjacent chat files.

Risk:

- Low; no remaining callers in current menu actions.

## Step 5 - Unread Badge Count Rendering Fix

Target files:

- `src/components/chat/inbox/ConversationItem.tsx`

Change:

- Replaced hardcoded `"!"` badge with formatted unread count (`1..99+`).
- Updated accessibility label to include unread quantity.

Verification:

- Lint run on file.

Risk:

- Low visual change; intentional bug fix.

## Step 6 - Local Message Lifecycle Hardening

Target files:

- `src/hooks/useLocalMessages.ts`

Change:

- Added per-conversation state reset (`hasSyncedRef`, limit, cached rows/counters/error) to prevent stale state across thread switches.
- Applied explicit `autoRefresh` gating for subscription setup.

Verification:

- Lint run on file.

Risk:

- Low; state reset is scoped to conversation/scope/limit changes.

## Step 7 - Testability + Merge/Dedupe Unit Coverage

Target files:

- `src/services/messaging/messageMerge.ts` (new)
- `src/services/chatV2.ts`
- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts` (new)

Change:

- Extracted outbox/server merge helper into Firebase-free module.
- Added focused unit tests for dedupe, status mapping, and ordering.

Verification:

- `npx jest __tests__/services/chatV2.mergeMessagesWithOutbox.test.ts --runInBand` (pass)

Risk:

- Low; `chatV2` re-exports same helper API.

## Remaining Steps

## Step 8 - Manual QA Sweep

Manual flows:

1. Open Inbox and verify list rendering, unread badges, tab filters.
2. Open DM and group chats, send text/media/voice.
3. Open thread and verify realtime updates without polling delay.
4. Requests tab refresh behavior (friend requests + group invites).
5. Notification tap opens correct chat/group route.
6. Chat settings and inbox settings toggles still persist.

## Step 9 - Extended Test Coverage

Planned tests:

1. Thread subscription lifecycle/unsubscribe tests.
2. Inbox unread badge formatting unit tests.
3. Merge overlap tests for realtime + pagination race conditions.

## Rollback Strategy

- Each step is isolated to small files and can be reverted independently.
- No schema changes were made in this phase.
