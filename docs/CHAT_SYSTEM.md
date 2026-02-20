# Chat System Contract

Last updated: 2026-02-19 (Polish Pass)

## Scope

This document describes the active unified DM + Group messaging path used by the app, including offline behavior and invariant guarantees.

Primary implementation files:

- `src/hooks/useChat.ts`
- `src/hooks/useUnifiedChatScreen.ts`
- `src/services/messaging/send.ts`
- `src/services/messaging/subscribe.ts`
- `src/services/chatV2.ts`
- `src/services/outbox.ts`
- `src/services/database/messageRepository.ts`
- `src/services/sync/syncEngine.ts`

## Canonical API Surface

Use these APIs for chat behavior:

- Send/retry/process outbox:
  - `sendMessage(...)`
  - `retryMessage(...)`
  - `processPendingMessages(...)`
  - from `src/services/messaging/send.ts` (or `src/services/messaging/index.ts`)
- Subscription/pagination:
  - `subscribeToMessages(...)`, `loadOlderMessages(...)`, `loadNewerMessages(...)`
  - from `src/services/messaging/subscribe.ts`
- Screen composition:
  - `useUnifiedChatScreen(...)` and `useChat(...)`

`chatV2.ts` and `outbox.ts` remain internal implementation layers backing the unified surface.

## Send Flow

### Path A: Local-first mode (`USE_LOCAL_STORAGE = true`)

```text
UI -> useUnifiedChatScreen/useChat
   -> insertMessage(...) into SQLite (pending)
   -> optimistic UI from local DB rows
   -> syncPendingMessages() background push
   -> Cloud Function sendMessageV2
   -> Firestore authoritative write
   -> mark local row synced (serverReceivedAt)
```

### Path B: Firestore fallback mode (`USE_LOCAL_STORAGE = false`)

```text
UI -> useUnifiedChatScreen/useChat
   -> services/messaging/send.sendMessage(...)
   -> chatV2.sendMessageWithOutbox(...)
   -> outbox.enqueueMessage(state=queued)
   -> Cloud Function sendMessageV2(clientId + messageId)
   -> success: remove outbox item
   -> failure: outbox state=failed + retry metadata
```

## Offline + Outbox Semantics

Outbox states are tracked in `src/types/messaging.ts` and `src/services/outbox.ts`:

- `queued`: waiting to send
- `uploading`: attachments in upload stage
- `sending`: currently attempting send
- `sent`: terminal success (represented by outbox removal)
- `failed`: failed, retry policy applied

Retry behavior:

- exponential backoff with jitter for retryable errors
- non-retryable errors are classified and parked with long retry delay
- manual retry path uses `retryMessage(...)`

## Invariants

### 1) No duplicate sends (idempotency)

- client-generated `messageId` + stable `clientId` are sent to `sendMessageV2`
- outbox dedupe blocks duplicate queued/failed copies with same payload in a conversation
- server idempotency contract is keyed by idempotency fields in message payload

### 2) Authoritative ordering

- server timestamp (`serverReceivedAt`) is the primary ordering signal for delivered messages
- optimistic messages are merged and sorted with server messages until confirmation
- UI merge path: `mergeMessagesWithOutbox(...)` in `src/services/chatV2.ts`

### 3) Watermark unread/read strategy

- read/delivery state is watermark-based (`lastSeenAtPrivate`, delivery/read/public fields)
- avoids per-message mutation fan-out
- private/public member state paths remain split (`MembersPrivate` vs `Members`)

### 4) Outbox UX contract

- optimistic state is immediately visible
- failed sends remain recoverable (`failed` + retry)
- send pipeline never silently drops errors; failures are classified and persisted

## Segment 8 hardening done

- Removed active UI bypasses to deprecated `chatV2` imports:
  - `src/screens/chat/ChatScreen.tsx` now retries via `retryMessage(...)`
  - `src/hooks/useOutboxProcessor.ts` now processes via unified `processPendingMessages(...)`
- Deprecated dead hook cleanup:
  - legacy `useSnapCapture` was removed in Segment 17 (no runtime callers)

## Failure Modes + Recovery

- network/transient failure:
  - message remains in outbox (`failed`) and retries via backoff/background processor
- permission/blocked/membership failure:
  - error classified non-retryable; item remains failed for explicit user handling
- attachment upload partial failure (local-first sync path):
  - uploaded subset is preserved; media-only messages with complete upload failure are not sent
- background/app resume:
  - `useOutboxProcessor` triggers `processPendingMessages(...)` on mount + foreground transitions
- periodic retry (long sessions):
  - `useOutboxProcessor` runs a 60-second interval retry to catch messages that failed after the last foreground event

## Known Limitations

- **Attachment retry on Path B (legacy outbox):** The AsyncStorage outbox stores `LocalAttachment[]` (pre-upload local URIs), but `sendMessageV2` expects `AttachmentV2[]` (post-upload URLs/paths). Retrying a failed message with attachments on Path B will send the message text-only. The active Path A (SQLite/syncEngine) handles attachment upload correctly via `uploadMultipleAttachments`.
- **Dual outbox systems:** Both AsyncStorage (Path B) and SQLite (Path A) outbox systems coexist. Path B is only used when `USE_LOCAL_STORAGE = false` (web). Full migration is blocked by web platform support.
- **N+1 inbox reads:** `useInboxData` fetches `MembersPrivate` per conversation on each snapshot. Optimization requires a server-side Inbox aggregation collection (gated by `CHAT_INBOX_AGGREGATION` flag, currently `false`).

## Polish Pass (2026-02-19)

Changes applied during production polish review (see `CHAT_POLISH_REVIEW.md` for full audit):

### Correctness

- **C1:** `upsertMessageFromServer` UPDATE now includes `text`, `kind`, `sender_name`, `mentions_json`, `reply_to_preview`, `hidden_for_json`, `link_preview_json` — edited messages no longer show stale text locally
- **C3:** `deletedForAll` normalized from boolean/object to consistent `{ by, at }` shape in `messageRepository.ts`

### Data Consistency

- **D1:** Typing throttle changed from module-level singleton to per-chat `Map<string, number>` in `chatMembers.ts`
- **D5:** `insertMessage` wrapped in `db.withTransactionSync()` — crash during write no longer leaves orphaned rows
- **D6:** `updateLastSeenPrivate` passes `{ sendPublicReceipt: false }` — private watermark no longer leaks public read receipts

### Performance

- **F1:** Batch attachment loading via `getAttachmentsForMessages()` — replaces N+1 per-message queries with single `WHERE message_id IN (...)` query
- **F2:** Removed redundant `getPendingMessages(1)` call in `refreshPendingCount()`

### UX

- **U1:** Added 60-second periodic outbox retry interval to `useOutboxProcessor`

### Maintainability

- **M3/D4:** Removed dead ternary `scope === "dm" ? "createdAt" : "createdAt"` in `syncEngine.ts`
- **M4:** `retryFailedMessage` and `processPendingMessages` now pass `traceId` for cross-system log correlation
- **M5:** Extracted `MAX_MESSAGE_RETRIES = 10` constant in `messageRepository.ts`, imported by `syncEngine.ts`

## Validation

Recommended checks after chat changes:

```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```
