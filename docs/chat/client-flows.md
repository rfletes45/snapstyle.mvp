# Chat Client Flows

> Step-by-step flows for every user-facing chat interaction, with code references.

---

## 1. Open Chat (DM)

**Trigger**: User taps a conversation in the inbox.

**Screen**: `src/screens/chat/ChatScreen.tsx`

### Flow

1. **Navigation** — `RootNavigator` pushes `ChatScreen` with params `{ chatId, otherUserId }`.
2. **Hook init** — `ChatScreen` calls `useUnifiedChatScreen({ scope: "dm", conversationId: chatId })`.
   - File: `src/hooks/useUnifiedChatScreen.ts`
3. **useChat init** — Inside `useUnifiedChatScreen`, `useChat()` executes:
   - **Feature flag check** — reads `USE_LOCAL_STORAGE` from `constants/featureFlags.ts`
   - **Firestore mode** → `useUnifiedMessages()` subscribes to `Chats/{chatId}/Messages` via `messageList.ts :: subscribeToDMMessages()`. Initial query: last 50 messages ordered by `serverReceivedAt` DESC.
     - File: `src/hooks/useUnifiedMessages.ts`, `src/services/messageList.ts`
   - **SQLite mode** → `useLocalMessages()` reads from SQLite (synchronous), then starts background `syncEngine :: subscribeToConversation()`.
     - File: `src/hooks/useLocalMessages.ts`, `src/services/sync/syncEngine.ts`
4. **Outbox merge** — `useUnifiedMessages` fetches pending outbox items via `outbox.ts :: getOutboxForConversation()` and merges into messages list, deduplicating by `messageId`.
   - File: `src/services/outbox.ts`
5. **Keyboard** — `useChatKeyboard()` starts keyboard event listeners for animated height.
   - File: `src/hooks/chat/useChatKeyboard.ts`
6. **Scroll tracking** — `useAtBottom()` attaches to FlatList `onScroll`.
   - File: `src/hooks/chat/useAtBottom.ts`
7. **Auto-scroll** — `useNewMessageAutoscroll()` monitors message count changes.
   - File: `src/hooks/chat/useNewMessageAutoscroll.ts`
8. **Typing subscription** — `ChatScreen` calls `useTypingStatus({ chatId, scope: "dm" })`. Subscribes to `Chats/{chatId}/Members/{otherUid}.typingAt`.
   - File: `src/hooks/useTypingStatus.ts`, `src/services/chatMembers.ts :: subscribeToTyping()`
9. **Read receipts** — `ChatScreen` calls `useReadReceipts()`. Marks chat as read by updating `Members/{uid}.lastReadAtPublic` and `MembersPrivate/{uid}.lastSeenAtPrivate`.
   - File: `src/hooks/useReadReceipts.ts`, `src/services/chatMembers.ts`
10. **Presence** — `ChatScreen` calls `usePresence(otherUserId)`. Subscribes to RTDB `status/{otherUserId}`.
    - File: `src/hooks/usePresence.ts`, `src/services/presence.ts`
11. **Render** — `ChatMessageList` renders messages via inverted FlatList. `DMMessageItem` renders each bubble with V1+V2 compat.
    - File: `src/components/chat/ChatMessageList.tsx`, `src/components/DMMessageItem.tsx`

---

## 2. Open Chat (Group)

**Screen**: `src/screens/groups/GroupChatScreen.tsx`

### Differences from DM

- Uses `useUnifiedChatScreen({ scope: "group", conversationId: groupId })`.
- Messages subscribed from `Groups/{groupId}/Messages` via `messageList.ts :: subscribeToGroupMessages()`.
- Typing subscribes to ALL members via `chatMembers.ts :: subscribeToAllTyping()`.
- Read receipts update `Groups/{groupId}/Members/{uid}.lastReadAtPublic`.
- `enableMentions: true` by default — `useMentionAutocomplete` activates.
- `GroupChatScreen` also fetches group members for mention autocomplete and member list.

---

## 3. Send Text Message

**Trigger**: User taps send button in composer.

### Flow (Firestore Mode)

1. **Composer** — `useChatComposer.send()` validates: text not empty, not already sending.
   - File: `src/hooks/useChatComposer.ts`
2. **Delegate to useChat** — Calls `chatHook.sendMessage(text, { replyTo, mentionUids, attachments })`.
   - File: `src/hooks/useChat.ts`
3. **Service call** — `messaging/send.ts :: sendMessage()` is called.
   - File: `src/services/messaging/send.ts`
4. **Outbox enqueue** — `outbox.ts :: enqueueMessage()` stores to AsyncStorage with `state: "queued"`.
   - File: `src/services/outbox.ts`
   - **Optimistic UI**: The outbox item is merged into the message list immediately via `useUnifiedMessages`.
5. **Cloud Function call** — `chatV2.ts :: sendMessageV2()` invokes `httpsCallable("sendMessageV2")`.
   - File: `src/services/chatV2.ts`
6. **Server validates** (in `firebase-backend/functions/src/messaging.ts`):
   - Auth check
   - Membership check (DM: uid in `members`; Group: uid in `memberIds`)
   - Block check (DM only: neither user has blocked the other)
   - Rate limit: 30 messages/minute per conversation (transaction counter)
   - Idempotency: if doc with `messageId` exists, return existing (no duplicate)
   - Text length ≤ 10,000 chars
   - Mentions ≤ 5
   - Attachments ≤ 10
7. **Server writes**:
   - Message doc with `serverReceivedAt = FieldValue.serverTimestamp()`
   - Updates parent conversation: `lastMessageText`, `lastMessageAt`, `lastMessageSenderId`
   - Writes both V2 fields AND legacy V1 fields for backward compat
8. **Outbox cleanup** — On success, `outbox.ts :: removeFromOutbox()` removes the item.
9. **Subscription fires** — `onSnapshot` in `messageList.ts` delivers new message.
10. **Merge** — `useUnifiedMessages` replaces outbox item with server message (matched by `messageId`).
11. **Push notification** — Firestore trigger `onNewMessage` (DM) or `onNewGroupMessageV2` (Group) fires, checks mute status, sends Expo push.
    - File: `firebase-backend/functions/src/legacy.ts`

### Flow (SQLite Mode)

Steps 1-2 same. Then:

3. **SQLite insert** — `messageRepository :: insertMessage()` with `syncStatus: "pending"`.
4. **Refresh local** — `localMessagesHook.refresh()` shows message immediately.
5. **Background sync** — `syncEngine :: syncPendingMessages()` fires asynchronously.
6. **Server call** — Same `sendMessageV2` callable as Firestore mode.
7. **Mark synced** — `messageRepository :: markMessageSynced()` on success.

---

## 4. Receive Message (Real-Time)

### Flow

1. **Firestore write** — Sender's Cloud Function writes message to `Messages/{id}`.
2. **onSnapshot fires** — `messageList.ts :: subscribeToDMMessages()` or `subscribeToGroupMessages()` callback.
   - Query: `orderBy("serverReceivedAt", "desc").limit(initialLimit)`, filtered by `serverReceivedAt`
   - File: `src/services/messageList.ts`
3. **Callback** — `useUnifiedMessages` merges with outbox, filters `hiddenFor` (removes messages hidden by current user), sorts by `serverReceivedAt`.
   - File: `src/hooks/useUnifiedMessages.ts`
4. **Auto-scroll check** — `useNewMessageAutoscroll` checks if user is at bottom:
   - **At bottom** → auto-scroll to show new message
   - **Not at bottom** → show `ReturnToBottomPill` with unread count
   - File: `src/hooks/chat/useNewMessageAutoscroll.ts`, `src/components/chat/ReturnToBottomPill.tsx`
5. **Auto-read** — If `autoMarkRead: true` (default) and user is at bottom, `useReadReceipts` updates read watermark.

---

## 5. Edit Message

**Trigger**: User long-presses own message → "Edit" in `MessageActionsSheet`.

### Preconditions (Client Check)

- `canEdit()` in `src/types/messaging.ts`: sender only, not deleted, within 15-min window (`EDIT_WINDOW_MS = 900000ms`)
- `canEditMessage()` in `src/services/messageActions.ts`: same check

### Flow

1. **UI** — `MessageActionsSheet` shows "Edit" option; user edits text and confirms.
   - File: `src/components/chat/MessageActionsSheet.tsx`
2. **Service call** — `messageActions.ts :: editMessage(scope, conversationId, messageId, newText)`.
   - File: `src/services/messageActions.ts`
3. **Server** — CF `editMessageV2`:
   - Validates sender, 15-min window (server-side using `serverReceivedAt`), text-only messages, not deleted.
   - Updates `text`, `editedAt = FieldValue.serverTimestamp()`, pushes to `editHistory` array.
   - Also updates legacy `content` field.
   - File: `firebase-backend/functions/src/messaging.ts`
4. **Subscription** — `onSnapshot` delivers updated message.
5. **UI update** — Edited messages show "(edited)" indicator.

**No optimistic update** — edit waits for server confirmation.

---

## 6. Delete Message

### 6.1. Delete for Me

**Trigger**: Long-press → "Delete for me"

1. **Service** — `messageActions.ts :: deleteMessageForMe(scope, conversationId, messageId, uid)`.
   - Direct Firestore write: `arrayUnion(uid)` to `hiddenFor` field.
   - **No Cloud Function** — uses Firestore rules directly.
2. **Rules validate** — `request.auth.uid` must be the value being added to `hiddenFor`.
3. **Subscription** — `useUnifiedMessages` filters out messages where `hiddenFor.includes(currentUid)`.

### 6.2. Delete for Everyone

**Trigger**: Long-press → "Delete for everyone"

**Preconditions**:

- DM: sender only, within edit window
- Group: sender within edit window, OR admin/owner (any time)

1. **Service** — `messageActions.ts :: deleteMessageForAll(scope, conversationId, messageId)`.
2. **Cloud Function** — `deleteMessageForAllV2`:
   - Sets `deletedForAll: { by: uid, at: serverTimestamp }`.
   - Clears `text` to `"[Message deleted]"`, removes `attachments`, `linkPreview`.
   - Idempotent: if already deleted, returns success.
3. **Subscription** — All participants see `deletedForAll` marker; UI shows "This message was deleted".

---

## 7. React to Message

**Trigger**: User taps emoji in `ReactionBar` or `ReactionDetailSheet`.

### Flow

1. **UI** — `ReactionBar` shows allowed emojis; user taps one.
   - File: `src/components/chat/ReactionBar.tsx`
2. **Service** — `reactions.ts :: toggleReaction(scope, conversationId, messageId, emoji)`.
   - Calls CF `toggleReactionV2`.
   - File: `src/services/reactions.ts`
3. **Cloud Function** — `toggleReactionV2`:
   - Rate limit: 10 reactions/minute.
   - Validates emoji against 16-emoji allowlist.
   - Max 12 unique emojis per message.
   - **Transaction**: toggles user in `Reactions/{emoji}.uids`, updates `reactionsSummary` on message doc.
   - File: `firebase-backend/functions/src/messaging.ts`
4. **Subscription** — `reactions.ts :: subscribeToReactions()` or `subscribeToMultipleMessageReactions()` fires.
   - Also: message doc `reactionsSummary` updates via main message subscription.

**No optimistic update** — waits for transaction to complete.

---

## 8. Attach Media

**Trigger**: User taps attachment button.

### Flow

1. **Picker** — `useAttachmentPicker :: pickFromLibrary()` or `pickFromCamera()`.
   - File: `src/hooks/useAttachmentPicker.ts`
2. **Validation** — Checks max count (10), max size (10MB), valid MIME type.
   - File: `src/services/attachments.ts`
3. **Preview** — Selected attachments shown in `AttachmentTray`.
   - File: `src/components/chat/AttachmentTray.tsx`
4. **Upload on send** — When `useChatComposer.send()` fires, if `onUploadAttachments` callback provided:
   - Uploads each attachment to Firebase Storage.
   - Tracks progress via `uploadProgress` state.
5. **Message send** — Attachment metadata (URLs, dimensions, etc.) included in message payload.
6. **Display** — `AttachmentGrid` renders image grid. Tap opens `MediaViewerModal`.
   - File: `src/components/chat/AttachmentGrid.tsx`, `src/components/chat/MediaViewerModal.tsx`

---

## 9. Voice Message

**Trigger**: User holds voice record button.

### Flow

1. **Record** — `useVoiceRecorder :: startRecording()`. Records audio with max duration (60s default).
   - File: `src/hooks/useVoiceRecorder.ts`
2. **State machine**: `idle` → `recording` → `stopped` → (upload)
3. **Cancel** — Release outside button area calls `cancelRecording()`.
4. **Complete** — Release inside calls `stopRecording()`, triggers `onRecordingComplete` callback.
5. **Upload** — `snapMessageService.ts :: sendVoiceMessage()` uploads to Storage (`dm-voice/` or `groups/{id}/voice/`).
   - File: `src/services/chat/snapMessageService.ts`
6. **Display** — `VoiceMessagePlayer` renders inline audio player with waveform and duration.

---

## 10. Reply to Message

**Trigger**: Swipe right on a message, or tap "Reply" in action sheet.

### Flow

1. **Set reply state** — `useChat.setReplyTo({ messageId, senderId, senderName, kind, textSnippet })`.
   - Creates `ReplyToMetadata` from the original message.
   - File: `src/hooks/useChat.ts`
2. **Preview** — `ReplyPreviewBar` appears above composer showing snippet.
   - File: `src/components/chat/ReplyPreviewBar.tsx`
3. **Send** — `useChatComposer.send()` includes `replyTo` in options.
4. **Server** — `sendMessageV2` stores `replyTo` on message doc.
5. **Display** — `ReplyBubbleNew` shows quoted original above the reply.
   - File: `src/components/chat/ReplyBubbleNew.tsx`
6. **Auto-clear** — Reply state auto-clears after successful send (`clearReplyOnSend: true` default).

---

## 11. @Mention

**Trigger**: User types `@` in group chat composer.

### Flow

1. **Detection** — `useMentionAutocomplete.onTextChange()` detects `@` trigger.
   - File: `src/hooks/useMentionAutocomplete.ts`
2. **Autocomplete** — `MentionAutocomplete` dropdown shows matching group members.
   - File: `src/components/chat/MentionAutocomplete.tsx`
3. **Insert** — `useChatComposer.insertMention(member)` replaces `@query` with `@DisplayName `.
   - `mentionParser.ts :: extractMentionsExact()` tracks mention UIDs.
   - File: `src/services/mentionParser.ts`
4. **Send** — `mentionUids[]` and `mentionSpans[]` included in message.
5. **Server** — Stored on message doc; used by `onNewGroupMessageV2` for differentiated push (mention-specific notifications).
6. **Display** — Mention spans highlighted in message text.

**Limits**: Max 5 mentions per message (`MAX_MENTIONS_PER_MESSAGE`).

---

## 12. Pagination (Load Older Messages)

### Flow

1. **Scroll trigger** — User scrolls to top of message list. FlatList's `onEndReached` fires (inverted list, so "end" = oldest).
2. **Load more** — `useChat.loadOlder()` calls `messageList.ts :: loadOlderMessages()`.
   - File: `src/services/messageList.ts`
3. **Query** — Firestore query: `orderBy("serverReceivedAt", "desc").startAfter(oldestTimestamp).limit(50)`.
4. **Merge** — New messages prepended to existing list. Cursor updated for next page.
5. **End state** — `hasMoreOlder` becomes `false` when query returns fewer than `limit` results.

---

## 13. Typing Indicator

### Publish Flow

1. **Text change** — `useTypingStatus` watches composer text changes.
   - File: `src/hooks/useTypingStatus.ts`
2. **Throttled write** — `chatMembers.ts :: updateTypingIndicator(chatId, uid, timestamp)`.
   - Throttled to once per `TYPING_THROTTLE_MS` (2000ms).
   - Writes to `Members/{uid}.typingAt`.
   - File: `src/services/chatMembers.ts`
3. **Auto-clear** — After `TYPING_TIMEOUT_MS` (8000ms) of no text changes, clears indicator.

### Subscribe Flow

1. **Listener** — `chatMembers.ts :: subscribeToTyping(chatId, otherUid)` for DM, `subscribeToAllTyping(groupId, excludeUid)` for Group.
2. **Display** — `TypingIndicator` component shows animated dots.
   - File: `src/components/chat/TypingIndicator.tsx`

---

## 14. Read Receipts

### Flow

1. **Mark read** — When chat is opened/focused, `useReadReceipts` calls:
   - `chatMembers.ts :: updateReadWatermark(chatId, uid, timestamp)` — public watermark
   - `chatMembers.ts :: updateLastSeen(chatId, uid, timestamp)` — private timestamp
2. **Subscribe** — Other user's `useReadReceipts` subscribes to `Members/{uid}.lastReadAtPublic`.
3. **Display** — `DMMessageItem` shows read/delivered status based on comparison with other user's watermark.

**Privacy**: Respects `sendReadReceipts` in `MembersPrivate` and global `showReadReceipts` in `InboxSettings`.

---

## 15. Message Lifecycle State Machine

```
                         ┌──────────┐
                         │  COMPOSE  │ (user typing)
                         └────┬─────┘
                              │ tap send
                              ▼
                         ┌──────────┐
                         │  QUEUED   │ (outbox, AsyncStorage)
                         └────┬─────┘
                              │ outbox processes
                              ▼
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
              ┌──────────┐       ┌──────────┐
              │ UPLOADING│       │ SENDING  │ (no attachments)
              │ (media)  │       │ (callable)│
              └────┬─────┘       └────┬─────┘
                   │                  │
                   └──────┬───────────┘
                          │ CF returns
                ┌─────────┴─────────┐
                │                   │
                ▼                   ▼
          ┌──────────┐       ┌──────────┐
          │   SENT   │       │  FAILED  │
          │ (server  │       │ (retry   │
          │  confirms│       │  later)  │
          └────┬─────┘       └────┬─────┘
               │                  │ retry
               │                  └──→ QUEUED
               ▼
          ┌──────────┐
          │ DELIVERED│ (onSnapshot has msg)
          └────┬─────┘
               │ other user reads
               ▼
          ┌──────────┐
          │   READ   │ (watermark ≥ serverReceivedAt)
          └──────────┘
```

**States defined**: `MessageStatusV2` type: `"sending"` | `"sent"` | `"delivered"` | `"read"` | `"failed"`

**Outbox states**: `OutboxState` type: `"queued"` | `"uploading"` | `"sending"` | `"failed"`

---

## 16. Conversation Actions (Inbox)

**Source**: `src/hooks/useConversationActions.ts`

| Action      | DM Service                      | Group Service                           | Stored In                                           |
| ----------- | ------------------------------- | --------------------------------------- | --------------------------------------------------- |
| Pin / Unpin | `chatMembers :: setDMPinned()`  | `groupMembers :: setGroupPinned()`      | `MembersPrivate/{uid}.pinnedAt`                     |
| Archive     | `chatMembers :: setArchived()`  | `groupMembers :: setGroupArchived()`    | `MembersPrivate/{uid}.archived`                     |
| Mute        | `chatMembers :: setMuted()`     | `groupMembers :: setGroupMuted()`       | `MembersPrivate/{uid}.mutedUntil`                   |
| Delete      | `chatMembers :: softDeleteDM()` | `groupMembers :: leaveAndDeleteGroup()` | `MembersPrivate/{uid}.deletedAt` (DM) / leave group |
| Mark unread | `chatMembers :: markAsUnread()` | `groupMembers :: markGroupAsUnread()`   | `MembersPrivate/{uid}.lastMarkedUnreadAt`           |
| Mark read   | `chatMembers :: markDMAsRead()` | `groupMembers :: markGroupAsRead()`     | `Members/{uid}.lastReadAtPublic`                    |

All actions are dispatched through the unified `useConversationActions` hook and route to DM or Group services based on `conversation.type`.
