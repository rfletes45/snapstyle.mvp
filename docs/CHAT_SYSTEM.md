# Chat System Contract

Last updated: 2026-02-18 (Segment 8)

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

## Validation

Recommended checks after chat changes:

```bash
npm run type-check
npm run lint
npm run test -- --ci --watchAll=false --no-cache
```
