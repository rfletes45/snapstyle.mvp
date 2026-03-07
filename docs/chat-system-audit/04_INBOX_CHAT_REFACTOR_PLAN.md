# Inbox & Chat System - Refactor Plan

Last verified: 2026-03-05
Status: Phase 3 implementation complete, hardening plan active

## 1) Purpose

This document tracks the inbox/chat hardening roadmap after the Phase 3 cleanup landed.
It is intentionally operational: each stream has owners, target files, acceptance criteria, and rollback guidance.

Scope:

- DM + group inbox behavior
- runtime parity (SQLite-first and Firestore fallback)
- requests tab behavior
- notification payload normalization and dedupe
- thread lifecycle safety
- regression testing and observability

Out of scope:

- redesigning chat UX
- replacing SQLite-first architecture
- schema-breaking Firestore migrations

## 2) Baseline Already Completed

The following are now baseline contracts and should not be re-opened unless regressions are found:

1. Canonical message normalization for local + Firestore payloads.
2. Canonical message ordering and dedupe helpers.
3. Canonical inbox row normalization across fan-out and aggregated inbox.
4. Unified typed requests source for friend requests + group invites + message requests.
5. Notification payload adapter shared by push-tap and in-app handlers.
6. Thread realtime lifecycle extraction with unsubscribe guards.
7. Targeted tests for prior high-risk drift areas.

References:

- `docs/chat-system-audit/01_INBOX_CHAT_TECHNICAL_OVERVIEW.md`
- `docs/chat-system-audit/02_INBOX_CHAT_DATA_CONTRACTS.md`
- `docs/chat-system-audit/03_INBOX_CHAT_KNOWN_ISSUES_RISKS.md`

## 3) Engineering Principles

1. Preserve user behavior unless fixing a documented bug.
2. Keep fan-out and aggregated inbox semantics equivalent.
3. Keep SQLite-first and fallback runtime outputs equivalent.
4. Move drift-prone logic into shared normalization helpers.
5. Validate with deterministic tests, not call-signature tests.
6. Keep rollouts reversible through feature flags where possible.

## 4) Active Sustaining Streams

## S1 - Notification Migration Guardrails

Owner: Backend notifications
Priority: Medium

Objective:

- Prevent accidental duplicate delivery when legacy triggers coexist with in-app channels.

Primary targets:

- `firebase-backend/functions/src/notifications.ts`
- release/deploy runbooks

Actions:

1. Enforce explicit environment intent for `CHAT_LEGACY_PUSH_ENABLED`.
2. Log active mode at cold start in functions runtime.
3. Add deployment checklist item for migration flag verification.

Acceptance criteria:

- each environment has an explicit flag value in config records
- no duplicate user-visible notifications in staging smoke tests

Rollback plan:

- toggle `CHAT_LEGACY_PUSH_ENABLED` and redeploy triggers

## S2 - High-Volume Merge Stress Testing

Owner: Client messaging
Priority: Medium

Objective:

- Increase confidence under heavy realtime plus pagination overlap.

Primary targets:

- `__tests__/integration/unifiedChat.test.ts`
- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`
- `src/services/chat/unifiedMessagesLifecycle.ts`

Actions:

1. Add larger synthetic fixtures (hundreds of messages).
2. Repeat modified-snapshot merges with overlapping page windows.
3. Assert stable identity and no duplicate row IDs.

Acceptance criteria:

- deterministic tests with fixed fixtures
- no flake across repeated local runs

Rollback plan:

- keep helper-level merge semantics unchanged if test-only additions fail CI

## S3 - Inbox Parity Telemetry

Owner: Client inbox + Observability
Priority: Low

Objective:

- Detect fan-out and aggregated drift before user reports.

Primary targets:

- `src/hooks/useInboxData.ts`
- `src/hooks/useInboxAggregation.ts`

Actions:

1. Emit diagnostic counters in debug builds for row count and unread deltas.
2. Add lightweight analytics event for parity mismatches during canary windows.
3. Track pinned ordering mismatches.

Acceptance criteria:

- parity mismatch events are visible in telemetry dashboards
- canary period shows no sustained mismatch trend

Rollback plan:

- disable telemetry emission behind debug guard if noisy

## S4 - Aggregated Inbox Enrichment (Optional)

Owner: Inbox backend
Priority: Low

Objective:

- Reduce client fallback lookups for display metadata in aggregated mode.

Primary targets:

- `firebase-backend/functions/src/inboxTriggers.ts`
- `src/services/chat/normalizeInboxRow.ts`

Actions:

1. Evaluate adding richer avatar/profile snapshots to `InboxEntry`.
2. Keep normalized output backward-compatible when fields are absent.
3. Validate no write-amplification regressions from trigger updates.

Acceptance criteria:

- optional enriched fields read safely by existing clients
- no regression in unread semantics or row ordering

Rollback plan:

- remove new optional fields from trigger writes; client falls back automatically

## S5 - Thread Lifecycle Reliability Sweep

Owner: Client messaging
Priority: Medium

Objective:

- Validate repeated open/close cycles and route churn behavior.

Primary targets:

- `src/screens/chat/ThreadScreen.tsx`
- `src/screens/chat/threadLifecycle.ts`
- `__tests__/screens/threadScreen.lifecycle.test.ts`

Actions:

1. Add route churn tests for rapid thread switching.
2. Verify no callback execution after cleanup.
3. Confirm unsubscribe counts match subscribe counts.

Acceptance criteria:

- lifecycle tests pass consistently
- no post-unmount state update warnings in manual smoke runs

Rollback plan:

- revert thread lifecycle helper changes in isolation

## S6 - Documentation + Test Governance

Owner: Chat maintainers
Priority: Medium

Objective:

- Keep docs, tests, and runtime contracts synchronized in each chat PR.

Primary targets:

- `docs/chat-system-audit/*`
- `docs/features/messaging.md`
- `docs/QA_IN_APP_NOTIFICATIONS.md`
- `docs/operations/testing.md`

Actions:

1. Require path-level docs updates when contracts change.
2. Require targeted chat test evidence in PR descriptions.
3. Keep known-risks ledger current with owner and status.

Acceptance criteria:

- no contract-changing chat PR merges without doc delta or explicit exemption

Rollback plan:

- none required (process change)

## 5) Release Gates For Chat Changes

Minimum required gates:

1. Targeted test suites pass.
2. Functions build passes when backend notification or trigger code changes.
3. Manual smoke matrix passes for inbox tabs, thread lifecycle, and routing.

Targeted suites:

- `__tests__/services/normalizeMessage.test.ts`
- `__tests__/services/normalizeInboxRow.test.ts`
- `__tests__/services/normalizeNotification.test.ts`
- `__tests__/services/messageRequests.test.ts`
- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`
- `__tests__/integration/unifiedChat.test.ts`
- `__tests__/hooks/inboxPathParity.test.ts`
- `__tests__/hooks/useUnifiedInboxRequests.test.ts`
- `__tests__/components/conversationItem.unreadBadge.test.ts`
- `__tests__/screens/threadScreen.lifecycle.test.ts`

## 6) Manual Validation Matrix

1. Inbox list parity with `CHAT_INBOX_AGGREGATION` off and on.
2. Requests tab lists friend/group/message requests and refreshes all sources.
3. DM and group send path has no duplicates under realtime updates.
4. Pagination plus realtime overlap retains stable ordering.
5. Thread screen open/close does not leak listeners.
6. Push tap and in-app notification routing land on correct destinations.

## 7) Risk Escalation Rules

Escalate immediately if any of these occur:

1. unread count drift between inbox modes in the same account/session
2. duplicate message rows after merge of realtime + pagination
3. notification double-fire from legacy + in-app channel overlap
4. state updates after unmount in thread or message hooks

Escalation output should include:

- exact repro steps
- affected feature flags
- relevant file paths
- failing test or missing test coverage

## 8) Definition of Done (Sustaining Cycle)

This plan can move to maintenance mode when:

1. notification migration flag governance is codified in deployment workflow
2. high-volume merge stress tests are in CI and stable
3. inbox parity telemetry is live and monitored
4. docs and targeted tests stay in lockstep with contract changes
