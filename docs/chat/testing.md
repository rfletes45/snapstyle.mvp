# Chat Testing

> Existing test coverage, identified gaps, and a proposed test matrix.

---

## 1. Existing Tests

### 1.1. Test Files Inventory

| File                                                | Type        | Target                                   | Status                 |
| --------------------------------------------------- | ----------- | ---------------------------------------- | ---------------------- |
| `__tests__/hooks/useChatComposer.test.ts`           | Unit        | `useChatComposer` hook                   | ✅ Exists (~210 lines) |
| `__tests__/hooks/useUnifiedChatScreen.test.ts`      | Unit        | `useUnifiedChatScreen` hook              | ✅ Exists              |
| `__tests__/integration/unifiedChat.test.ts`         | Integration | Unified chat flow (send, receive, merge) | ✅ Exists (~330 lines) |
| `__tests__/messaging/send.test.ts`                  | Unit        | `messaging/send.ts` pipeline             | ✅ Exists (~170 lines) |
| `__tests__/messaging/subscribe.test.ts`             | Unit        | `messaging/subscribe.ts` subscriptions   | ✅ Exists              |
| `__tests__/messaging/memberState.test.ts`           | Unit        | `messaging/memberState.ts` facade        | ✅ Exists              |
| `__tests__/messaging/adapters/groupAdapter.test.ts` | Unit        | `groupAdapter.ts` V1↔V2 conversion       | ✅ Exists              |

### 1.2. Test Categories Coverage

| Category               | Tests Exist                                | Coverage Notes                                                                                                                                                  |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hooks**              | useChatComposer, useUnifiedChatScreen      | Missing: useChat, useReadReceipts, useTypingStatus, usePresence, useOutboxProcessor, useInboxData, useConversationActions, useLocalMessages, useUnifiedMessages |
| **Services/messaging** | send, subscribe, memberState, groupAdapter | Missing: messageList, messageActions, reactions, chatV2, outbox, chatMembers, attachments                                                                       |
| **Services/core**      | None                                       | Missing: blocking, reporting, moderation, scheduledMessages, groups, groupMembers, presence, linkPreview, inboxSettings                                         |
| **Backend CFs**        | None                                       | Missing: sendMessageV2, editMessageV2, deleteMessageForAllV2, toggleReactionV2, onNewMessage, onNewGroupMessageV2, processScheduledMessages                     |
| **Integration**        | unifiedChat                                | Missing: end-to-end send/receive, outbox recovery, offline/online transitions                                                                                   |
| **Components**         | None                                       | Missing: DMMessageItem, ChatComposer, ChatMessageList, ReactionBar, etc.                                                                                        |
| **Security rules**     | None                                       | Missing: Firestore rules tests                                                                                                                                  |
| **E2E**                | None (e2e/games/ exists but no chat e2e)   | Missing: full user flow tests                                                                                                                                   |

### 1.3. Test Configuration

- **Framework**: Jest (`jest.config.js`)
- **Setup**: `jest.setup.js`
- **Pattern**: `__tests__/**/*.test.ts(x)`

---

## 2. What the Existing Tests Cover

### `useChatComposer.test.ts`

Tests the composer hook:

- Text state management (set, clear)
- Send button enablement logic (empty text = disabled, has text = enabled)
- Send callback invocation with correct parameters
- Mention handling (insert mention, extract UIDs)
- Attachment state management
- Reply state syncing with chatHook
- Reset functionality

### `send.test.ts`

Tests the send pipeline:

- Message enqueue to outbox
- CF callable invocation
- Success path (outbox removal)
- Failure path (outbox state update)
- Retry logic
- `generateMessageId` and `getClientId` utilities

### `subscribe.test.ts`

Tests subscription wrappers:

- DM subscription setup
- Group subscription setup
- Unsubscribe cleanup
- Pagination cursor management

### `memberState.test.ts`

Tests unified member state:

- Routing to DM vs Group services based on scope
- Read watermark updates
- Typing indicator publish/clear
- Mute/archive operations

### `groupAdapter.test.ts`

Tests format conversion:

- Legacy `GroupMessage` → `MessageV2` conversion
- `MessageV2` → legacy `GroupMessage` conversion
- All message types: text, media, voice, scorecard, system
- Reply metadata mapping
- Deletion marker mapping
- Batch conversion

### `unifiedChat.test.ts`

Integration test covering:

- Full send flow: compose → outbox → CF → subscription
- Message merge: outbox item + server message deduplication
- Reply flow
- Error handling in send

---

## 3. Identified Test Gaps

### Critical Gaps (High Priority)

| Area                         | What's Missing                                                                             | Risk                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| **Backend Cloud Functions**  | No tests for `sendMessageV2`, `editMessageV2`, `deleteMessageForAllV2`, `toggleReactionV2` | Server validation bugs go undetected       |
| **Firestore Security Rules** | No rules tests                                                                             | Authorization bugs could expose data       |
| **`useChat` hook**           | No unit tests for the master hook                                                          | Core message management untested           |
| **`outbox.ts` service**      | No unit tests                                                                              | Offline reliability untested               |
| **`messageList.ts` service** | No unit tests                                                                              | Pagination and subscription logic untested |
| **`messageActions.ts`**      | No tests for edit/delete operations                                                        | Message lifecycle untested                 |
| **`reactions.ts`**           | No tests                                                                                   | Reaction toggle, validation untested       |
| **Blocking integration**     | No tests for send-blocked-user scenario                                                    | Security-critical flow untested            |

### Medium Gaps

| Area                                | What's Missing                                        | Risk                                    |
| ----------------------------------- | ----------------------------------------------------- | --------------------------------------- |
| **`chatMembers.ts`**                | No tests for typing, read receipts, member state CRUD | Real-time features untested             |
| **`presence.ts`**                   | No tests                                              | Online/offline status untested          |
| **`scheduledMessages.ts`**          | No tests                                              | Scheduled delivery reliability untested |
| **`groups.ts` / `groupMembers.ts`** | No tests                                              | Group management untested               |
| **Error handling paths**            | Not explicitly tested in existing tests               | Unknown failure behavior                |
| **Component rendering**             | No snapshot or interaction tests                      | UI correctness relies on manual QA      |

### Low Gaps (Nice to Have)

| Area                 | What's Missing                        |
| -------------------- | ------------------------------------- |
| **Link preview**     | Client-side fetching/caching          |
| **Mention parser**   | Text parsing edge cases               |
| **Message adapters** | V1↔V2 already covered by groupAdapter |
| **Inbox settings**   | Setting persistence                   |
| **Media cache**      | Cache eviction                        |

---

## 4. Proposed Test Matrix

### 4.1. Unit Tests — Services

| File to Test           | Test Cases                                                                                                                           | Priority |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `outbox.ts`            | enqueue, dequeue, retry, max retries, exponential backoff, stale cleanup, persistence across restarts                                | **P0**   |
| `messageList.ts`       | subscribe DM, subscribe group, paginate older, paginate newer, unsubscribe, error handling, cursor management                        | **P0**   |
| `messageActions.ts`    | edit success, edit expired window, edit non-text, delete-for-me, delete-for-all sender, delete-for-all admin, delete already-deleted | **P0**   |
| `reactions.ts`         | toggle add, toggle remove, max emojis, invalid emoji, rate limit, subscribe, unsubscribe                                             | **P0**   |
| `chatV2.ts`            | sendMessageV2 success, failure, retry, idempotency conflict                                                                          | **P0**   |
| `chatMembers.ts`       | set typing, clear typing, update watermark, set muted, set archived, subscribe typing, subscribe read receipt                        | **P1**   |
| `presence.ts`          | initialize, set online, subscribe, format last seen, cleanup                                                                         | **P1**   |
| `blocking.ts`          | block, unblock, isBlocked bidirectional, cancel pending requests                                                                     | **P1**   |
| `scheduledMessages.ts` | schedule, cancel, update content, update time, subscribe                                                                             | **P1**   |
| `groups.ts`            | create, invite, accept, decline, leave, remove member, change role, transfer ownership                                               | **P1**   |
| `groupMembers.ts`      | initialize, update role, remove, private state CRUD, unread count                                                                    | **P1**   |
| `reporting.ts`         | submit report, report message, report user                                                                                           | **P2**   |
| `moderation.ts`        | get ban, check banned, get warnings                                                                                                  | **P2**   |
| `inboxSettings.ts`     | get, update, reset, per-setting updates                                                                                              | **P2**   |
| `linkPreview.ts`       | extract URLs, fetch preview, cache hit, cache miss, blocked domain                                                                   | **P2**   |
| `mentionParser.ts`     | extract mentions, insert mention, edge cases (multiple @, partial match)                                                             | **P2**   |

### 4.2. Unit Tests — Hooks

| Hook to Test             | Test Cases                                                                                              | Priority |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | -------- |
| `useChat`                | init, message merge, send text, send with reply, pagination, scroll state, reply state, selection state | **P0**   |
| `useUnifiedMessages`     | merge outbox + server, dedup, filter hiddenFor, sort by serverReceivedAt                                | **P0**   |
| `useLocalMessages`       | SQLite init, load, paginate, refresh, pending count                                                     | **P1**   |
| `useReadReceipts`        | publish watermark, subscribe, privacy check                                                             | **P1**   |
| `useTypingStatus`        | publish throttled, subscribe, auto-clear                                                                | **P1**   |
| `usePresence`            | subscribe, format status                                                                                | **P1**   |
| `useOutboxProcessor`     | process pending, retry failed, skip exhausted                                                           | **P1**   |
| `useConversationActions` | pin, mute, archive, delete DM, delete group, mark read/unread                                           | **P1**   |
| `useInboxData`           | aggregate DM + group, unread counts, filter archived/deleted                                            | **P1**   |
| `useAttachmentPicker`    | pick, validate size, validate count, clear                                                              | **P2**   |
| `useVoiceRecorder`       | start, stop, cancel, max duration                                                                       | **P2**   |
| `useMentionAutocomplete` | trigger on @, filter members, select, reset                                                             | **P2**   |

### 4.3. Backend Tests — Cloud Functions

| Function                   | Test Cases                                                                                                                                                | Priority |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `sendMessageV2`            | Valid send, missing auth, not member, blocked user, rate limited, idempotent retry, text too long, too many mentions, too many attachments, invalid scope | **P0**   |
| `editMessageV2`            | Valid edit, not sender, window expired, non-text kind, already deleted                                                                                    | **P0**   |
| `deleteMessageForAllV2`    | Valid (sender), valid (admin), not authorized, already deleted, within/outside window                                                                     | **P0**   |
| `toggleReactionV2`         | Add, remove, rate limited, invalid emoji, max emojis, concurrent toggle                                                                                   | **P0**   |
| `onNewMessage`             | Push sent, muted skipped, blocked skipped, missing token skipped                                                                                          | **P1**   |
| `onNewGroupMessageV2`      | Push to all, muted skipped, mentions-only, notify-none                                                                                                    | **P1**   |
| `processScheduledMessages` | Deliver pending, skip future, mark failed, mark sent                                                                                                      | **P1**   |
| `fetchLinkPreviewFunction` | Valid URL, blocked domain, timeout, cached                                                                                                                | **P2**   |

### 4.4. Security Rules Tests

Using `@firebase/rules-unit-testing`:

| Collection             | Test Cases                                                                                                                                                      | Priority |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `Chats`                | Read as member, read as non-member, create valid, create invalid members count                                                                                  | **P0**   |
| `Chats/Messages`       | Read as member, create as member, create as non-member, edit as sender within window, edit as non-sender, edit expired, delete-for-me self, delete-for-me other | **P0**   |
| `Chats/Members`        | Read as member, write as self, write as other                                                                                                                   | **P0**   |
| `Chats/MembersPrivate` | Read as self, read as other (denied), write as self                                                                                                             | **P0**   |
| `Groups`               | Read as member, read as non-member, create as owner, update as member                                                                                           | **P1**   |
| `Groups/Messages`      | Same as DM + admin delete for all                                                                                                                               | **P1**   |
| `GroupInvites`         | Create as sender, accept as recipient, access denied for others                                                                                                 | **P1**   |
| `ScheduledMessages`    | CRUD as sender, denied as other                                                                                                                                 | **P2**   |

### 4.5. Integration Tests

| Scenario                      | Steps                                                                               | Priority |
| ----------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Full DM send/receive cycle    | Create chat → send → verify subscription fires → verify outbox cleared              | **P0**   |
| Outbox recovery after offline | Enqueue while offline → go online → verify delivery                                 | **P0**   |
| Edit + subscription update    | Send → edit → verify updated text in subscription                                   | **P1**   |
| Delete + subscription update  | Send → delete-for-all → verify deleted marker                                       | **P1**   |
| Block prevents send           | User A blocks B → B tries send → verify rejection                                   | **P1**   |
| Group mention notification    | Send with mentions → verify push sent to mentioned only (when notifyLevel=mentions) | **P1**   |

### 4.6. E2E Tests

| Scenario                                                      | Priority |
| ------------------------------------------------------------- | -------- |
| Open inbox → tap conversation → send text → see in chat       | **P0**   |
| Send message → other user sees it → tap reply → reply appears | **P1**   |
| Long-press message → delete for everyone → shows "deleted"    | **P1**   |
| Schedule message → verify delivery at scheduled time          | **P2**   |
| Block user → verify cannot send → unblock → verify can send   | **P2**   |

---

## 5. Testing Recommendations

1. **Start with backend CF tests** — These have the highest impact since they validate server-side logic including rate limiting, idempotency, and authorization.

2. **Add Firestore rules tests** — Critical for security. Use `@firebase/rules-unit-testing` with the local emulator.

3. **Add `outbox.ts` unit tests** — This is the reliability backbone of offline-first messaging.

4. **Build component snapshot tests** — For `DMMessageItem`, `ChatComposer`, `ChatMessageList` to catch rendering regressions.

5. **Set up CI** — Run Jest tests on every PR. Add Firestore emulator to CI for rules and CF tests.

6. **Mock strategy** — Use jest mocks for:
   - Firestore SDK (`firebase/firestore`)
   - AsyncStorage (for outbox)
   - RTDB (for presence)
   - Expo push notifications
   - Image/audio pickers
