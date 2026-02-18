# Real-Time & Consistency

> Ordering guarantees, idempotency, deduplication, retries, race conditions, and performance.

---

## 1. Message Ordering

### Source of Truth

**`serverReceivedAt`** — set by `FieldValue.serverTimestamp()` in the Cloud Function `sendMessageV2`.

- File: `firebase-backend/functions/src/messaging.ts`
- Type: Firestore `Timestamp` (server-generated)
- Client displays messages sorted by `serverReceivedAt` descending (inverted FlatList).

### Why Not Client Timestamps?

`createdAt` is a client-set `Date.now()` timestamp. It's used for:

- **Intent ordering** — if two messages are sent rapidly, `createdAt` records intent.
- **Optimistic display** — outbox items use `createdAt` before server confirmation.

But `createdAt` is **not used for authoritative ordering** because:

- Client clocks can be wrong (time zone, drift, manual manipulation).
- Two clients may send at the "same" time with different clock values.

### Ordering Guarantees

| Scenario                      | Guarantee                               | Mechanism                                            |
| ----------------------------- | --------------------------------------- | ---------------------------------------------------- |
| Single user sends A then B    | A.serverReceivedAt < B.serverReceivedAt | Sequential CF calls; server timestamp monotonic      |
| Two users send simultaneously | Consistent order visible to both        | Server timestamps; users see same order after sync   |
| Optimistic message (outbox)   | May appear out of order temporarily     | Outbox uses `createdAt`; reordered on server confirm |
| Edited messages               | Don't change position                   | `editedAt` updated, but `serverReceivedAt` preserved |

### Query Pattern

```typescript
// messageList.ts :: subscribeToDMMessages()
collection(`Chats/${chatId}/Messages`)
  .orderBy("serverReceivedAt", "desc")
  .limit(initialLimit);
```

Messages ordered by `serverReceivedAt` descending. Pagination uses `startAfter(oldestMessage.serverReceivedAt)`.

---

## 2. Idempotency

### Message Send Idempotency

**Mechanism**: `idempotencyKey = ${clientId}:${messageId}`

- `clientId`: Stable per-device identifier generated once and stored (via `outbox.ts :: getClientId()`).
- `messageId`: Client-generated UUID (via `outbox.ts :: generateMessageId()`).
- Together, these form a unique key per message attempt.

**Server enforcement** (in `sendMessageV2`):

```
1. Read Messages/{messageId}:
   - If doc exists AND idempotencyKey matches → return existing (SUCCESS, no duplicate)
   - If doc exists AND idempotencyKey differs → throw CONFLICT error
   - If doc not exists → proceed with write
```

This means:

- **Retries are safe**: If the client retries the same message (same `messageId`), the server recognizes it and returns the existing doc.
- **Different devices are caught**: If two devices try to create a message with the same ID but different `clientId`, it's flagged as a conflict.

### Reaction Toggle Idempotency

`toggleReactionV2` uses a transaction to check if user is already in `uids` array:

- If present → remove (untoggle)
- If absent → add

This is inherently idempotent: toggling N times converges to a stable state.

### Edit/Delete Idempotency

- `editMessageV2`: Not idempotent for different text values (each edit creates a history entry). Same text is handled gracefully.
- `deleteMessageForAllV2`: Idempotent — if already deleted, returns success.

---

## 3. Deduplication

### Client-Side Deduplication

**File**: `src/hooks/useUnifiedMessages.ts`

When merging outbox items with Firestore messages:

```typescript
// Pseudocode from useUnifiedMessages
const serverIds = new Set(serverMessages.map((m) => m.id));
const uniqueOutbox = outboxItems.filter(
  (item) => !serverIds.has(item.messageId),
);
const merged = [...serverMessages, ...outboxToMessage(uniqueOutbox)];
```

This prevents the same message from appearing twice (once from outbox, once from Firestore).

### Server-Side Deduplication

The `idempotencyKey` check in `sendMessageV2` prevents duplicate writes to Firestore.

### Race Condition: Outbox + Subscription

```
Timeline:
  T0: User sends message → outbox item created, shown optimistically
  T1: CF writes to Firestore → server msg exists
  T2: onSnapshot fires → server message arrives
  T3: useUnifiedMessages merges → removes outbox item, keeps server message
```

Between T0 and T2, the message is shown from the outbox. At T2, it's seamlessly replaced by the server version (matched by `messageId`). The user sees no duplication or flicker because the message content is identical.

---

## 4. Retry & Error Handling

### Outbox Retry Logic

**File**: `src/services/outbox.ts`

The outbox implements exponential backoff:

```typescript
// Retry schedule:
// Attempt 1: immediate
// Attempt 2: +2s
// Attempt 3: +4s
// After max retries: state = "failed"
```

**States**:

- `"queued"` — waiting to be processed
- `"uploading"` — attachment upload in progress
- `"sending"` — CF call in progress
- `"failed"` — max retries exhausted, user must manually retry

### Outbox Processing

**File**: `src/hooks/useOutboxProcessor.ts`

The `useOutboxProcessor` hook runs at the app root level. It periodically:

1. Checks for items with `state === "queued"` and `nextRetryAt <= now`.
2. Processes each item (upload attachments, call CF).
3. On success: removes from outbox.
4. On failure: increments `attemptCount`, sets `nextRetryAt` with backoff.

### Manual Retry

Users can tap failed messages to retry. This calls:

- `outbox.ts :: retryItem(messageId)` — resets state to `"queued"` and `attemptCount`.
- OR `chatV2.ts :: retryFailedMessage(messageId)` — same effect.

### Network Reconnection

**File**: `src/hooks/useNetworkStatus.ts`

When network reconnects:

1. `useNetworkStatus` fires a callback.
2. `useOutboxProcessor` processes pending items.
3. Firestore SDK automatically re-establishes `onSnapshot` listeners.
4. `NetworkBanner` component dismisses the offline indicator.

---

## 5. Eventual Consistency

### Real-Time Subscriptions

Firestore `onSnapshot` provides **strong eventually consistent** reads for subscribed documents. Changes propagate within milliseconds on the same region.

### Cross-Document Consistency

Some operations involve multiple document writes:

1. `sendMessageV2`: Writes message doc + updates conversation preview.
2. `toggleReactionV2`: Writes reaction doc + updates message `reactionsSummary`.

These are NOT atomic transactions across documents (the message write and conversation update are separate). This means:

| Scenario                   | Risk                                                      | Impact                                           | Frequency                    |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------ | ---------------------------- |
| Conversation preview stale | CF crashes between message write and preview update       | Inbox shows old preview until next message       | Very rare                    |
| Reaction summary stale     | Transaction succeeds on reaction doc but fails on summary | Reaction visible in detail sheet but count wrong | Very rare (full transaction) |

The reaction toggle IS a transaction, so the reaction doc and `reactionsSummary` are updated atomically.

---

## 6. Race Conditions

### 6.1. Simultaneous Sends (Same Conversation)

**Risk**: Two users send at the exact same time.
**Mitigation**: Each `sendMessageV2` call is independent. `serverReceivedAt` provides a deterministic order. Both messages will appear — no lost writes.

### 6.2. Edit While Reading

**Risk**: User A edits a message while User B is reading it.
**Mitigation**: Firestore `onSnapshot` delivers the edit. B sees the updated text. Edit history preserved.

### 6.3. Delete While Replying

**Risk**: User A deletes a message that User B is replying to.
**Mitigation**: The reply's `replyTo` metadata is a **snapshot** stored on the reply message. Even if the original is deleted, the reply still shows the snippet. The original message shows "This message was deleted."

### 6.4. Send + Block Race

**Risk**: User A sends a message to User B. Simultaneously, User B blocks User A.
**Mitigation**: The `sendMessageV2` CF checks block status at execution time. Depending on timing:

- If block processed first → send rejected.
- If send processed first → message delivered, then block takes effect for future messages.
  This is acceptable behavior — the block is prospective, not retroactive.

### 6.5. Outbox + App Kill

**Risk**: User sends a message (enters outbox), then kills the app.
**Mitigation**: Outbox is persisted to AsyncStorage. On next app launch, `useOutboxProcessor` picks up pending items and retries.

### 6.6. Concurrent Typing Indicators

**Risk**: Multiple users type simultaneously in a group.
**Mitigation**: Each user writes to their own `Members/{uid}.typingAt` doc. No conflict — each user's typing state is independent.

### 6.7. Rate Limit Counter Race

**Risk**: Two rapid sends in same conversation hit rate limit counter simultaneously.
**Mitigation**: The rate limit uses a Firestore **transaction** on the conversation doc. Transactions serialize concurrent updates, so the counter is accurate.

---

## 7. Performance Considerations

### Active Listeners

Each open chat screen maintains:

- 1 message subscription (`onSnapshot` on Messages subcollection)
- 1 typing subscription (`onSnapshot` on Members/{otherUid} for DM, or all Members for group)
- 1 presence subscription (RTDB listener on `status/{otherUid}`)
- 1 read receipt subscription (`onSnapshot` on Members/{otherUid} for DM)

**For the inbox**, `useInboxData` maintains:

- 1 subscription per conversation type (DM conversations, Group conversations)
- Individual member state listeners per visible conversation

**Risk**: If many conversations are open or the inbox is very long, listener count grows.
**Mitigation**: Conversations are subscribed lazily (only when visible). Chat screen listeners are cleaned up on unmount.

### Query Patterns

| Query                   | Index Required                                             | Frequency           |
| ----------------------- | ---------------------------------------------------------- | ------------------- |
| User's DM conversations | `Chats: members(CONTAINS) + lastMessageAt(DESC)`           | On inbox open       |
| User's groups           | `Groups: memberIds(CONTAINS) + lastMessageAt(DESC)`        | On inbox open       |
| Messages for a chat     | `orderBy(serverReceivedAt, DESC).limit(50)`                | On chat open        |
| Unread mentions         | `Messages: mentionUids(CONTAINS) + serverReceivedAt(DESC)` | On inbox open       |
| Pending group invites   | `GroupInvites: toUid + status + createdAt(DESC)`           | On invites screen   |
| Pending scheduled msgs  | `ScheduledMessages: senderId + status + scheduledFor(ASC)` | On scheduled screen |

All required indexes are defined in `firebase-backend/firestore.indexes.json`.

### Pagination

Messages are loaded in pages of 50 (configurable via `initialLimit`).

- `loadOlderMessages()` uses `startAfter(oldestTimestamp)`.
- `loadNewerMessages()` uses `endBefore(newestTimestamp)`.
- Pagination cursors reset when switching conversations.

### Message List Performance

- `ChatMessageList` uses React Native's `FlatList` in **inverted** mode.
- `windowSize` and `maxToRenderPerBatch` tuned for performance.
- `DMMessageItem` uses `React.memo` for re-render prevention.
- Reactions are denormalized on the message doc (`reactionsSummary`) to avoid N+1 subcollection reads.

---

## 8. Offline Behavior

### Firestore Offline Persistence

Firestore SDK has built-in offline persistence (enabled by default in React Native). Reads return cached data when offline.

### Outbox for Writes

When offline:

1. `sendMessage()` enqueues to outbox (AsyncStorage).
2. CF call fails → outbox retries when online.
3. Message appears in UI immediately (optimistic from outbox).
4. `NetworkBanner` shows "No connection" overlay.

### Reconnection

When connection restored:

1. Firestore SDK re-establishes listeners; pending writes flush.
2. `useOutboxProcessor` processes pending outbox items.
3. `NetworkBanner` dismisses.
4. Any writes made while offline are reconciled with server state.

### SQLite Mode (Feature-Flagged)

When `USE_LOCAL_STORAGE` is enabled:

1. Messages are read from SQLite immediately (zero-latency).
2. `syncEngine` manages bidirectional sync with Firestore.
3. This provides faster cold-start times (no waiting for Firestore).
4. Conflict resolution: server wins (server `serverReceivedAt` is authoritative).
