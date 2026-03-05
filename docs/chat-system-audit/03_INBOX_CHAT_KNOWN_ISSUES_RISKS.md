# Inbox & Chat System - Known Issues / Risks / TODOs

Last verified: 2026-03-05

## 1) Resolved in Phase 2

1. Thread screen used polling instead of realtime subscription  
   Files:
   - `src/screens/chat/ThreadScreen.tsx`  
   - `src/services/sync/syncEngine.ts`  
   Symptom:
   - 3-second `setInterval(loadThread, 3000)` loop performed repeated DB reads even when no updates.
   Resolution:
   - Polling loop removed; screen now subscribes to conversation updates and reloads from local DB on change.

2. Notification timestamp dedupe key collision risk between DM and group IDs  
   Files:
   - `src/store/InAppNotificationsContext.tsx`  
   Symptom:
   - `lastMessageTimestamps` map keys were raw conversation IDs; DM/group IDs could collide.
   Resolution:
   - Keys are now scope-qualified (`dm:{id}` / `group:{id}`).

3. Inbox requests tab refresh path missed request sources  
   Files:
   - `src/screens/chat/ChatListScreenV2.tsx`  
   Symptom:
   - Pull-to-refresh in requests tab refreshed inbox conversations only.
   Resolution:
   - Requests refresh now triggers both `useFriendRequests().refresh()` and group invite reload.

4. Unread badge rendering did not display count  
   Files:
   - `src/components/chat/inbox/ConversationItem.tsx`  
   Symptom:
   - Badge content was hardcoded `"!"` even when `unreadCount` existed.
   Resolution:
   - Badge now renders count (`1..99+`) with updated accessibility text.

5. Inbox screen retained dead block/report state and handlers  
   Files:
   - `src/screens/chat/ChatListScreenV2.tsx`  
   Symptom:
   - Block/report modal state and handlers were declared but unreachable from current menu actions.
   Resolution:
   - Unreachable modal imports/state/handlers removed.

6. Local message hook state could bleed across conversation switches  
   Files:
   - `src/hooks/useLocalMessages.ts`  
   Symptom:
   - Sync bootstrap/pagination state was not reset per conversation, risking stale rows and skipped initial sync after route changes.
   Resolution:
   - Added per-conversation state reset and explicit bootstrap guard usage.

## 2) Architectural / Migration Risks

1. Dual runtime architecture (SQLite-first + Firestore fallback)  
   Files:
   - `src/hooks/useChat.ts`
   - `src/hooks/useLocalMessages.ts`
   - `src/hooks/useUnifiedMessages.ts`  
   Risk:
   - Contract drift risk between local-first and fallback modes, especially around ordering and status fields.

2. Multiple inbox paths (fan-out list vs. aggregated inbox)  
   Files:
   - `src/hooks/useInboxData.ts`
   - `src/hooks/useInboxAggregation.ts`
   - `firebase-backend/functions/src/inboxTriggers.ts`  
   Risk:
   - Feature-flag toggle can expose mismatches in unread count semantics, preview shape, and pinned/archive behavior.

3. Staged message requests flow not surfaced in inbox UI  
   Files:
   - `src/hooks/useMessageRequests.ts`
   - `src/screens/chat/ChatListScreenV2.tsx`
   - `firebase-backend/functions/src/messageRequests.ts`  
   Risk:
   - Server support exists; UI integration is partial/flag-dependent and may create behavior gaps when feature is enabled.

4. Legacy notification triggers still active alongside in-app listeners  
   Files:
   - `firebase-backend/functions/src/legacy.ts`
   - `src/store/InAppNotificationsContext.tsx`
   - `src/store/AuthContext.tsx`  
   Risk:
   - Multiple channels and payload variants increase edge-case routing complexity.

## 3) Test Coverage Gaps

1. Message request tests are mostly assertion stubs, not behavior mocks  
   Files:
   - `__tests__/services/messageRequests.test.ts`

2. Chat integration tests validate call signatures only (lightweight mocks), not listener lifecycle under race conditions  
   Files:
   - `__tests__/integration/unifiedChat.test.ts`

3. Merge/dedupe unit tests now exist for outbox+server helper, but pagination overlap and subscription race cases remain uncovered  
   Files:
   - `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`

4. No focused tests for inbox row unread badge formatting behavior  
   Files:
   - `src/components/chat/inbox/ConversationItem.tsx`

5. No focused tests for thread realtime lifecycle/unsubscribe behavior  
   Files:
   - `src/screens/chat/ThreadScreen.tsx`

## 4) Follow-up TODOs (Post-Phase)

1. Consolidate inbox request sources (friend requests, group invites, message requests) into one typed hook.
2. Extend merge/dedupe tests to cover pagination + realtime overlap and duplicate `modified` snapshots.
3. Normalize notification payload contracts and migrate legacy trigger payload handling to one adapter.
4. Define and document source of truth for unread counts when aggregated inbox mode is enabled.
