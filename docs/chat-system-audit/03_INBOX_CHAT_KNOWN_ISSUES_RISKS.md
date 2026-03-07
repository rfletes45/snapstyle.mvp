# Inbox & Chat System - Known Issues / Risks / TODOs

Last verified: 2026-03-05
Status: Major Phase 3+ risk items resolved, sustaining risks tracked below

## 1) Executive Status

Resolved in this cycle:

- dual-runtime contract drift (SQLite-first vs Firestore fallback)
- inbox path drift (fan-out vs aggregated)
- requests-tab source fragmentation
- legacy/new notification payload mismatch and dedupe gaps
- targeted test coverage gaps listed in the prior audit

Remaining items are non-blocking and tracked for hardening and maintainability.

## 2) Resolved Risk Ledger

## 2.1 Dual runtime architecture drift

Status: Fixed (2026-03-05)

Primary files:

- `src/services/chat/normalizeMessage.ts`
- `src/services/chat/unifiedMessagesLifecycle.ts`
- `src/services/messaging/messageMerge.ts`
- `src/hooks/useUnifiedMessages.ts`
- `src/hooks/useChat.ts`

Resolution summary:

- one canonical message normalization layer for local rows and Firestore docs
- one ordering and dedupe rule across runtime modes
- shared realtime and pagination merge helpers
- lifecycle guards to avoid post-unmount state writes

Tests:

- `__tests__/services/normalizeMessage.test.ts`
- `__tests__/integration/unifiedChat.test.ts`
- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`

## 2.2 Multiple inbox paths drift

Status: Fixed (2026-03-05)

Primary files:

- `src/services/chat/normalizeInboxRow.ts`
- `src/services/chat/fanoutInboxNormalization.ts`
- `src/hooks/useInboxData.ts`
- `src/hooks/useInboxAggregation.ts`
- `src/hooks/useConversationActions.ts`
- `src/services/chat/inboxAggregation.ts`

Resolution summary:

- canonical row normalization shared by both inbox paths
- canonical unread computation shared by both paths
- aggregated mode now reads `MembersPrivate` for parity
- aggregated mark-read path updated to clear server unread hint

Tests:

- `__tests__/services/normalizeInboxRow.test.ts`
- `__tests__/hooks/inboxPathParity.test.ts`
- `__tests__/components/conversationItem.unreadBadge.test.ts`

## 2.3 Requests flow not surfaced consistently

Status: Fixed (2026-03-05)

Primary files:

- `src/hooks/useUnifiedInboxRequests.ts`
- `src/services/chat/unifiedInboxRequests.ts`
- `src/services/chat/messageRequestsContract.ts`
- `src/screens/chat/ChatListScreenV2.tsx`

Resolution summary:

- single typed request stream for friend/group/message requests
- stable merge sort + dedupe contract
- requests tab refresh now refreshes all request sources
- request actions wired per type (accept/decline)

Tests:

- `__tests__/hooks/useUnifiedInboxRequests.test.ts`
- `__tests__/services/messageRequests.test.ts`

## 2.4 Notification channel overlap and payload variants

Status: Fixed (2026-03-05)

Primary files:

- `src/services/notifications/normalizeNotification.ts`
- `src/store/AuthContext.tsx`
- `src/store/InAppNotificationsContext.tsx`
- `firebase-backend/functions/src/notifications.ts`

Resolution summary:

- one canonical notification adapter used before routing
- dedupe-key gating for tap handling and in-app throttling
- legacy DM/group push triggers env-gated (`CHAT_LEGACY_PUSH_ENABLED`)
- route decisions now driven from normalized payload shape

Tests:

- `__tests__/services/normalizeNotification.test.ts`

## 2.5 Group chat runtime crash and text-node warning

Status: Fixed (2026-03-05)

Primary files:

- `src/services/chat/normalizeMessage.ts`
- `src/components/chat/ChatComposer.tsx`
- `src/components/chat/SwipeableMessageWrapper.tsx`

Resolution summary:

- fixed unbound `toMillis` invocation against Firestore timestamp-like objects
- added fallback parsing for `{seconds,nanoseconds}` timestamp payloads
- guarded slot/children rendering to prevent primitive text under `View`

Tests:

- `__tests__/services/normalizeMessage.test.ts`

## 3) Current Non-Blocking Risks

## 3.1 Legacy push trigger overlap if migration flag misconfigured

Priority: Medium
Owner: Backend notifications

Risk:

- if `CHAT_LEGACY_PUSH_ENABLED` is accidentally left enabled in an environment where new in-app channels are already relied on, duplicate user-perceived notifications can return.

Mitigation in place:

- canonical payload adapter + dedupe keys reduce duplicates on client

Remaining action:

- enforce environment defaults and deployment checklist gate for this flag

## 3.2 Full repository type-check cannot be used as chat-only gate

Priority: Medium
Owner: Repo maintainers

Risk:

- unrelated TypeScript errors outside chat reduce confidence in using `npx tsc --noEmit` as a chat regression gate.

Mitigation in place:

- targeted chat unit/integration suites are green

Remaining action:

- stabilize global TS baseline to restore whole-repo compile as required gate

## 3.3 Aggregated inbox enrichments are still minimal

Priority: Low
Owner: Inbox backend

Risk:

- aggregated docs intentionally keep compact preview fields; richer avatar/profile parity still depends on client lookups in some cases.

Mitigation in place:

- client normalization preserves parity behavior and fallback defaults

Remaining action:

- optional trigger enrichment for richer row metadata

## 4) Test Coverage Status

Prior gap list and current status:

1. `__tests__/services/messageRequests.test.ts` -> fixed
2. `__tests__/integration/unifiedChat.test.ts` -> fixed
3. `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts` -> fixed
4. unread badge formatting tests -> fixed (`conversationItem.unreadBadge.test.ts`)
5. thread lifecycle/unsubscribe tests -> fixed (`threadScreen.lifecycle.test.ts`)

## 5) Follow-up TODO Backlog

## 5.1 Enforce notification migration safety in CI/CD

Owner: Backend
Priority: Medium

Action:

- add deploy-time validation that explicitly logs and verifies `CHAT_LEGACY_PUSH_ENABLED` intent per environment.

## 5.2 Add stress test for high-volume mixed realtime + pagination updates

Owner: Client messaging
Priority: Medium

Action:

- extend integration tests with larger synthetic message sets and repeated modified snapshots.

## 5.3 Add operational dashboard counters for inbox parity

Owner: Observability
Priority: Low

Action:

- instrument fan-out and aggregated path row counts/unread deltas to detect drift early.

## 6) Exit Criteria for Closing This Risk Register

This document can move to maintenance-only status when:

1. legacy push migration flag is operationally locked per environment
2. whole-repo TS compile baseline is green
3. inbox parity telemetry is in place and monitored
