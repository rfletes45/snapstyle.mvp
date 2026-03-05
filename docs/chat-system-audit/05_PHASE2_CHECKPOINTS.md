# Inbox & Chat System - Phase 2 Checkpoints

Last verified: 2026-03-05

## Checkpoint 1 - Listener/Notification Correctness

1. What changed:
   - Thread screen moved from polling to subscription-driven reload.
   - Sync engine subscription registry updated to support multiple callbacks per scoped conversation key.
   - In-app notification timestamp dedupe keys now include scope prefix.
2. Files touched:
   - `src/screens/chat/ThreadScreen.tsx`
   - `src/services/sync/syncEngine.ts`
   - `src/store/InAppNotificationsContext.tsx`
3. Verification:
   - ESLint on changed chat files passed (warnings only in unrelated pre-existing rules).
4. Remaining risks:
   - No dedicated automated lifecycle test yet for thread subscription attach/detach.

## Checkpoint 2 - Inbox Requests + Dead Code Cleanup

1. What changed:
   - Requests tab pull-to-refresh now refreshes friend requests and group invites.
   - Removed unreachable block/report modal code from inbox screen.
2. Files touched:
   - `src/screens/chat/ChatListScreenV2.tsx`
3. Verification:
   - ESLint on changed file passed (no errors).
4. Remaining risks:
   - Group invites still use focused reload approach (not continuous listener on this screen).

## Checkpoint 3 - Local Message Lifecycle Hardening

1. What changed:
   - `useLocalMessages` now resets sync/bootstrap/pagination state when conversation context changes.
   - Subscription setup now respects `autoRefresh`.
2. Files touched:
   - `src/hooks/useLocalMessages.ts`
3. Verification:
   - ESLint on changed file passed.
4. Remaining risks:
   - No dedicated test yet for rapid conversation switching edge cases.

## Checkpoint 4 - Merge/Dedupe Testability + Coverage

1. What changed:
   - Extracted merge logic into Firebase-free helper module.
   - Added unit tests covering dedupe, status mapping, and newest-first ordering.
2. Files touched:
   - `src/services/messaging/messageMerge.ts`
   - `src/services/chatV2.ts`
   - `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`
3. Verification:
   - `npx jest __tests__/services/chatV2.mergeMessagesWithOutbox.test.ts --runInBand` passed (3/3 tests).
4. Remaining risks:
   - Merge overlap across pagination + realtime updates still needs explicit tests.
