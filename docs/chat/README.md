# Chat System Documentation

> **Single source of truth** for the SnapStyle chat/messaging system.
> Generated from actual codebase analysis — February 2026.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MOBILE CLIENT (React Native / Expo)          │
│                                                                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ ChatScreen  │  │ GroupChat    │  │ ChatListV2   │  │ Settings   │ │
│  │ (DM)        │  │ Screen       │  │ (Inbox)      │  │ Screens    │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └────────────┘ │
│         │                │                  │                          │
│  ┌──────┴──────────────┬─┴──────────────────┘                         │
│  │    useUnifiedChatScreen  (UNI-04)                                  │
│  │    ├── useChat          (ARCH-D02)  ← messages, scroll, keyboard  │
│  │    └── useChatComposer  (ARCH-D03)  ← text, voice, mentions, send │
│  └──────┬──────────────────────────────────────────────────┐          │
│         │                                                  │          │
│  ┌──────┴──────────┐   ┌──────────────────────────────┐   │          │
│  │ useUnifiedMsgs  │   │ useLocalMessages (SQLite FF) │   │          │
│  │ (Firestore sub) │   │ (USE_LOCAL_STORAGE flag)     │   │          │
│  └──────┬──────────┘   └──────────┬───────────────────┘   │          │
│         │                         │                        │          │
│  ┌──────┴──────────────┐  ┌──────┴───────────────┐       │          │
│  │ services/           │  │ services/database/    │       │          │
│  │ messageList.ts      │  │ messageRepository.ts  │       │          │
│  │ messaging/send.ts   │  │ conversationRepo.ts   │       │          │
│  │ chatV2.ts           │  └───────────────────────┘       │          │
│  │ outbox.ts           │                                   │          │
│  └──────┬──────────────┘                                   │          │
│         │                                                  │          │
│  ┌──────┴──────────────────────────────────────────────────┘          │
│  │  Supporting hooks:                                                 │
│  │  useTypingStatus · useReadReceipts · usePresence                  │
│  │  useAttachmentPicker · useVoiceRecorder · useMentionAutocomplete  │
│  │  useOutboxProcessor · useConversationActions · useInboxData       │
│  └────────────────────────────────────────────────────────────────────┘
│                                                                        │
└───────────────────────────┬────────────────────────────────────────────┘
                            │  Firestore SDK / httpsCallable
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       FIREBASE BACKEND                                  │
│                                                                        │
│  Cloud Functions (callable):                                           │
│  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────────┐ │
│  │ sendMessageV2      │  │ editMessageV2      │  │ deleteForAllV2   │ │
│  │ (idempotent, rate  │  │ (15-min window)    │  │ (sender/admin)   │ │
│  │  limited, block    │  └────────────────────┘  └──────────────────┘ │
│  │  checks)           │  ┌────────────────────┐                       │
│  └────────────────────┘  │ toggleReactionV2   │                       │
│                          │ (10/min, 16 emoji) │                       │
│  Firestore triggers:     └────────────────────┘                       │
│  ┌────────────────────┐  ┌─────────────────────────┐                  │
│  │ onNewMessage       │  │ onNewGroupMessageV2     │                  │
│  │ (DM push + streak) │  │ (group push + mentions) │                  │
│  └────────────────────┘  └─────────────────────────┘                  │
│                                                                        │
│  Scheduled:              Callable:                                     │
│  ┌────────────────────┐  ┌────────────────────┐                       │
│  │ processScheduled   │  │ fetchLinkPreview   │                       │
│  │ Messages (1min)    │  │ (OG tag scraper)   │                       │
│  └────────────────────┘  └────────────────────┘                       │
│                                                                        │
│  Firestore · Storage · Realtime Database (presence)                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Documentation Index

| #   | Document                                             | Contents                                                   |
| --- | ---------------------------------------------------- | ---------------------------------------------------------- |
| 1   | [architecture.md](architecture.md)                   | Components, folder map, call graph, dual-mode explanation  |
| 2   | [data-model.md](data-model.md)                       | All Firestore collections, types, JSON shapes, indexes     |
| 3   | [client-flows.md](client-flows.md)                   | Send, receive, edit, delete, react, attach, paginate flows |
| 4   | [backend-flows.md](backend-flows.md)                 | Cloud Functions, triggers, validations, auth checks        |
| 5   | [security-permissions.md](security-permissions.md)   | Firestore/Storage rules, auth, blocking, threat model      |
| 6   | [realtime-consistency.md](realtime-consistency.md)   | Ordering, idempotency, dedupe, retries, race conditions    |
| 7   | [errors-and-edge-cases.md](errors-and-edge-cases.md) | Failure modes encyclopedia with code-level mitigations     |
| 8   | [testing.md](testing.md)                             | Existing tests, gaps, proposed test matrix                 |
| 9   | [cleanup-plan.md](cleanup-plan.md)                   | Deprecated code, refactor steps, naming fixes, risk notes  |

---

## System Map

All files involved in the chat system, grouped by area.

### UI Screens

| File                                             | Responsibility                                   |
| ------------------------------------------------ | ------------------------------------------------ |
| `src/screens/chat/ChatScreen.tsx`                | 1:1 DM chat screen — uses `useUnifiedChatScreen` |
| `src/screens/chat/ChatListScreenV2.tsx`          | Inbox / conversation list (v2 rewrite)           |
| `src/screens/chat/ChatSettingsScreen.tsx`        | Per-chat settings (mute, notifications, privacy) |
| `src/screens/chat/ScheduledMessagesScreen.tsx`   | View/manage scheduled messages                   |
| `src/screens/chat/SnapViewerScreen.tsx`          | Full-screen snap/media viewer                    |
| `src/screens/chat/InboxSearchScreen.tsx`         | Search within inbox/conversations                |
| `src/screens/chat/InboxSettingsScreen.tsx`       | Global inbox settings                            |
| `src/screens/groups/GroupChatScreen.tsx`         | Group chat conversation screen                   |
| `src/screens/groups/GroupChatInfoScreen.tsx`     | Group member management / info                   |
| `src/screens/groups/GroupChatCreateScreen.tsx`   | Create new group chat                            |
| `src/screens/groups/GroupInvitesScreen.tsx`      | Pending group invites                            |
| `src/screens/settings/BlockedUsersScreen.tsx`    | Manage blocked users                             |
| `src/screens/settings/PrivacySettingsScreen.tsx` | Global privacy settings                          |

### UI Components — Chat

| File                                              | Responsibility                               |
| ------------------------------------------------- | -------------------------------------------- |
| `src/components/chat/ChatComposer.tsx`            | Message input bar (text, attachments, voice) |
| `src/components/chat/ChatMessageList.tsx`         | Virtualized FlatList wrapper for messages    |
| `src/components/chat/ChatSkeleton.tsx`            | Loading skeleton placeholder                 |
| `src/components/chat/ChatGameInvites.tsx`         | Inline game-invite cards                     |
| `src/components/chat/TypingIndicator.tsx`         | Animated "X is typing…" bubble               |
| `src/components/chat/MessageActionsSheet.tsx`     | Long-press action sheet                      |
| `src/components/chat/MessageHighlightOverlay.tsx` | Deep-link scroll-to overlay                  |
| `src/components/chat/SwipeableMessage.tsx`        | Swipe-to-reply gesture                       |
| `src/components/chat/SwipeableMessageWrapper.tsx` | Swipeable gesture context                    |
| `src/components/chat/VoiceMessagePlayer.tsx`      | Inline voice message player                  |
| `src/components/chat/VoiceRecordButton.tsx`       | Hold-to-record button                        |
| `src/components/chat/AttachmentGrid.tsx`          | Multi-image grid in messages                 |
| `src/components/chat/AttachmentTray.tsx`          | Photo/camera/file picker tray                |
| `src/components/chat/CameraLongPressButton.tsx`   | Long-press camera snap                       |
| `src/components/chat/DuckBubble.tsx`              | Special "quack" fun message                  |
| `src/components/chat/DuckIcon.tsx`                | Duck icon asset                              |
| `src/components/chat/LinkPreviewCard.tsx`         | URL link preview card                        |
| `src/components/chat/MediaViewerModal.tsx`        | Full-screen media modal                      |
| `src/components/chat/MentionAutocomplete.tsx`     | @-mention dropdown                           |
| `src/components/chat/NetworkBanner.tsx`           | Offline/reconnecting banner                  |
| `src/components/chat/ReactionBar.tsx`             | Emoji reaction bar                           |
| `src/components/chat/ReactionDetailSheet.tsx`     | "Who reacted" bottom sheet                   |
| `src/components/chat/ReplyBubbleNew.tsx`          | Inline reply quote in bubble                 |
| `src/components/chat/ReplyPreviewBar.tsx`         | Preview bar above composer                   |
| `src/components/chat/ReturnToBottomPill.tsx`      | Floating scroll-to-bottom pill               |
| `src/components/chat/ScrollReturnButton.tsx`      | Alternate scroll button                      |
| `src/components/chat/SeenBySheet.tsx`             | "Seen by" bottom sheet                       |

### UI Components — Inbox

| File                                                    | Responsibility            |
| ------------------------------------------------------- | ------------------------- |
| `src/components/chat/inbox/ConversationItem.tsx`        | Conversation row in inbox |
| `src/components/chat/inbox/ConversationContextMenu.tsx` | Long-press context menu   |
| `src/components/chat/inbox/SwipeableConversation.tsx`   | Swipe actions on row      |
| `src/components/chat/inbox/DeleteConfirmDialog.tsx`     | Delete confirmation       |
| `src/components/chat/inbox/EmptyState.tsx`              | Empty inbox placeholder   |
| `src/components/chat/inbox/FriendRequestItem.tsx`       | Friend request row        |
| `src/components/chat/inbox/GroupInviteItem.tsx`         | Group invite row          |
| `src/components/chat/inbox/InboxFAB.tsx`                | New chat floating button  |
| `src/components/chat/inbox/InboxHeader.tsx`             | Inbox header              |
| `src/components/chat/inbox/InboxTabs.tsx`               | Chats / Requests tabs     |
| `src/components/chat/inbox/MuteOptionsSheet.tsx`        | Mute duration picker      |
| `src/components/chat/inbox/PinnedSection.tsx`           | Pinned conversations      |
| `src/components/chat/inbox/ProfilePreviewModal.tsx`     | Quick profile preview     |

### Other Chat-Related Components

| File                                                 | Responsibility                            |
| ---------------------------------------------------- | ----------------------------------------- |
| `src/components/DMMessageItem.tsx`                   | DM message bubble renderer (V1+V2 compat) |
| `src/components/ScheduleMessageModal.tsx`            | Schedule date/time picker                 |
| `src/components/BlockUserModal.tsx`                  | Block user confirmation                   |
| `src/components/ReportUserModal.tsx`                 | Report user modal                         |
| `src/components/customization/ChatBubblePreview.tsx` | Chat bubble skin preview                  |

### Hooks / State Management

| File                                        | Responsibility                                     |
| ------------------------------------------- | -------------------------------------------------- |
| `src/hooks/useChat.ts`                      | Master hook: messages + scroll + keyboard + send   |
| `src/hooks/useChatComposer.ts`              | Composer state: text, voice, mentions, attachments |
| `src/hooks/useUnifiedChatScreen.ts`         | Composes useChat + useChatComposer for screens     |
| `src/hooks/useConversationActions.ts`       | Inbox actions: pin, mute, archive, delete          |
| `src/hooks/useLocalMessages.ts`             | SQLite-based local message store (feature-flagged) |
| `src/hooks/useUnifiedMessages.ts`           | Merges Firestore messages + outbox items           |
| `src/hooks/useReadReceipts.ts`              | Subscribe/emit read receipt watermarks             |
| `src/hooks/useTypingStatus.ts`              | Publish/subscribe typing indicators                |
| `src/hooks/usePresence.ts`                  | Online/offline presence (RTDB)                     |
| `src/hooks/useLinkPreviews.ts`              | Fetch & cache link preview metadata                |
| `src/hooks/useAttachmentPicker.ts`          | Image/video picker state                           |
| `src/hooks/useVoiceRecorder.ts`             | Hold-to-record state machine                       |
| `src/hooks/useMentionAutocomplete.ts`       | @-mention search logic                             |
| `src/hooks/useOutboxProcessor.ts`           | Background outbox retry processor                  |
| `src/hooks/useInboxData.ts`                 | Aggregate inbox data + unread counts               |
| `src/hooks/useNetworkStatus.ts`             | Network connectivity listener                      |
| `src/hooks/chat/useChatKeyboard.ts`         | Keyboard avoidance / height tracking               |
| `src/hooks/chat/useNewMessageAutoscroll.ts` | Auto-scroll on new messages                        |
| `src/hooks/chat/useAtBottom.ts`             | "Is user scrolled to bottom" tracker               |

### Services / API Layer

| File                                      | Responsibility                                          |
| ----------------------------------------- | ------------------------------------------------------- |
| `src/services/chat.ts`                    | Legacy V1: `generateChatId()`, `getOrCreateChat()`      |
| `src/services/chatV2.ts`                  | V2 send pipeline: `sendMessageV2()`, outbox integration |
| `src/services/chatMembers.ts`             | DM member state (public + private), typing, watermarks  |
| `src/services/messageList.ts`             | Paginated Firestore message subscription                |
| `src/services/messageActions.ts`          | Edit, delete-for-all, delete-for-me actions             |
| `src/services/outbox.ts`                  | Offline-first outbox queue (AsyncStorage)               |
| `src/services/reactions.ts`               | Add/remove/subscribe emoji reactions                    |
| `src/services/presence.ts`                | RTDB presence system                                    |
| `src/services/attachments.ts`             | Upload/validate media attachments                       |
| `src/services/storage.ts`                 | Firebase Storage wrapper                                |
| `src/services/mediaCache.ts`              | Local disk media cache                                  |
| `src/services/linkPreview.ts`             | Client-side link preview fetcher + cache                |
| `src/services/mentionParser.ts`           | Parse @-mentions from text                              |
| `src/services/notifications.ts`           | Push notification registration                          |
| `src/services/blocking.ts`                | Block/unblock user operations                           |
| `src/services/reporting.ts`               | Report message / report user                            |
| `src/services/moderation.ts`              | Content moderation & admin tools                        |
| `src/services/inboxSettings.ts`           | Per-user inbox preferences                              |
| `src/services/scheduledMessages.ts`       | Scheduled message CRUD                                  |
| `src/services/groups.ts`                  | Group CRUD + invites + messaging                        |
| `src/services/groupMembers.ts`            | Group member state (public + private)                   |
| `src/services/friends.ts`                 | Friend requests + list (chat depends on friendship)     |
| `src/services/snaps.ts`                   | Snap (ephemeral) media                                  |
| `src/services/chat/snapMessageService.ts` | Snap-style ephemeral messages                           |
| `src/services/chat/quackService.ts`       | "Quack" / duck special messages                         |

### Unified Messaging Module

| File                                              | Responsibility                    |
| ------------------------------------------------- | --------------------------------- |
| `src/services/messaging/send.ts`                  | Unified send: outbox → callable   |
| `src/services/messaging/subscribe.ts`             | Unified real-time subscription    |
| `src/services/messaging/memberState.ts`           | Unified member state (DM + Group) |
| `src/services/messaging/adapters/groupAdapter.ts` | Legacy GroupMessage ↔ MessageV2   |

### Local Database (SQLite, feature-flagged)

| File                                              | Responsibility                        |
| ------------------------------------------------- | ------------------------------------- |
| `src/services/database/conversationRepository.ts` | SQLite conversation CRUD              |
| `src/services/database/messageRepository.ts`      | SQLite message CRUD + attachment ops  |
| `src/services/database/maintenance.ts`            | DB cleanup utilities                  |
| `src/services/sync/syncEngine.ts`                 | Firestore ↔ SQLite bidirectional sync |

### Types

| File                     | Responsibility                                                  |
| ------------------------ | --------------------------------------------------------------- |
| `src/types/messaging.ts` | V2 types: MessageV2, MemberState, OutboxItem, InboxConversation |
| `src/types/models.ts`    | V1 types: Chat, Message, Group, GroupMessage, BlockedUser       |

### Utilities

| File                           | Responsibility                   |
| ------------------------------ | -------------------------------- |
| `src/utils/messagePreview.ts`  | Inbox preview text generation    |
| `src/utils/messageAdapters.ts` | V1 ↔ V2 message format adapters  |
| `src/data/chatBubbles.ts`      | Chat bubble cosmetic definitions |

### Backend (Cloud Functions)

| File                                                  | Responsibility                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `firebase-backend/functions/src/index.ts`             | Functions entry point                                                   |
| `firebase-backend/functions/src/messaging.ts`         | sendMessageV2, editV2, deleteV2, toggleReactionV2                       |
| `firebase-backend/functions/src/legacy.ts`            | onNewMessage, onNewGroupMessageV2, processScheduledMessages, moderation |
| `firebase-backend/functions/src/notifications.ts`     | Re-exports push notification triggers                                   |
| `firebase-backend/functions/src/scheduledMessages.ts` | Re-exports scheduled message handlers                                   |
| `firebase-backend/functions/src/linkPreview.ts`       | Server-side OG tag scraper                                              |
| `firebase-backend/functions/src/utils.ts`             | Push notification helpers, mute checks                                  |

### Security Rules

| File                                      | Responsibility               |
| ----------------------------------------- | ---------------------------- |
| `firebase-backend/firestore.rules`        | All Firestore access control |
| `firebase-backend/storage.rules`          | Media upload access control  |
| `firebase-backend/firestore.indexes.json` | Composite index definitions  |

### Tests

| File                                                | Responsibility                     |
| --------------------------------------------------- | ---------------------------------- |
| `__tests__/hooks/useChatComposer.test.ts`           | useChatComposer unit tests         |
| `__tests__/hooks/useUnifiedChatScreen.test.ts`      | useUnifiedChatScreen unit tests    |
| `__tests__/integration/unifiedChat.test.ts`         | Integration tests for unified chat |
| `__tests__/messaging/send.test.ts`                  | Send pipeline unit tests           |
| `__tests__/messaging/subscribe.test.ts`             | Subscription unit tests            |
| `__tests__/messaging/memberState.test.ts`           | Member state unit tests            |
| `__tests__/messaging/adapters/groupAdapter.test.ts` | Group adapter unit tests           |

### Feature Flags

| File                        | Responsibility                                                 |
| --------------------------- | -------------------------------------------------------------- |
| `constants/featureFlags.ts` | `USE_LOCAL_STORAGE` (SQLite mode), `USE_CHAT_V2` (V2 pipeline) |

---

## Truth Table: Key Behaviors

| Feature                   | Implemented In                                                             | Source of Truth                                    | Consistency Model                           | Failure Behavior                                              | Known Issues                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Send text message**     | `useChat.ts` → `messaging/send.ts` → `chatV2.ts` → CF `sendMessageV2`      | Server (`serverReceivedAt`)                        | Optimistic UI + outbox retry                | Shows "sending" then retries; marks "failed" after 3 attempts | Dual pipeline (V1 `chat.ts` / V2 `chatV2.ts`) both exist                                                           |
| **Receive message**       | `useUnifiedMessages.ts` → `messageList.ts` → Firestore `onSnapshot`        | Server (Firestore)                                 | Real-time subscription                      | Shows stale list; `NetworkBanner` displays offline state      | Listener count unbounded if many conversations opened                                                              |
| **Edit message**          | `messageActions.ts` → CF `editMessageV2`                                   | Server (CF validates 15-min window)                | Confirmed (no optimistic)                   | Error toast; original text preserved                          | Client `canEdit()` uses `Date.now()` vs server uses `FieldValue.serverTimestamp()` — possible 15-min edge mismatch |
| **Delete for all**        | `messageActions.ts` → CF `deleteMessageForAllV2`                           | Server (sets `deletedForAll` marker)               | Confirmed                                   | Error toast                                                   | Group admins can delete any message; DM only sender can                                                            |
| **Delete for me**         | `messageActions.ts` → client-side Firestore write                          | Client (adds uid to `hiddenFor[]`)                 | Optimistic                                  | Firestore rules validate `request.auth.uid` in array          | No server-side — direct Firestore write                                                                            |
| **Reactions**             | `reactions.ts` → CF `toggleReactionV2`                                     | Server (transaction on `Reactions/` subcollection) | Confirmed (denormalized `reactionsSummary`) | Error; stale count shown briefly                              | 16-emoji allowlist hardcoded in CF; client has `getAllowedEmojis()`                                                |
| **Read receipts**         | `useReadReceipts.ts` → `chatMembers.ts` → `Members/{uid}.lastReadAtPublic` | Server (member subcollection)                      | Eventually consistent                       | Receipts may be delayed by seconds                            | Respects `sendReadReceipts` privacy setting per-user                                                               |
| **Typing indicators**     | `useTypingStatus.ts` → `chatMembers.ts` → `Members/{uid}.typingAt`         | Server (member subcollection)                      | Eventually consistent (8s timeout)          | Typing auto-clears after `TYPING_TIMEOUT_MS` (8s)             | 2s throttle prevents spam; client-only auto-clear                                                                  |
| **Presence**              | `usePresence.ts` → `presence.ts` → RTDB `/status/{uid}`                    | RTDB (with `onDisconnect`)                         | Real-time; offline auto-detected            | Shows "last seen" time when offline                           | Respects `showOnlineStatus` privacy setting                                                                        |
| **Attachments**           | `useAttachmentPicker.ts` → `attachments.ts` → Firebase Storage             | Server (Storage URLs)                              | Upload then send (not optimistic)           | Upload failure blocks send; retry needed                      | Max 10 attachments, 10MB each; `attachments.ts` has stubs marked "H10"                                             |
| **Voice messages**        | `useVoiceRecorder.ts` → `snapMessageService.ts`                            | Server (Storage URL)                               | Upload then send                            | Recording lost on cancel/error                                | Max 60s default; separate service from main send pipeline                                                          |
| **Link previews**         | `useLinkPreviews.ts` → `linkPreview.ts` (client) or CF `fetchLinkPreview`  | Cached in Firestore (24h TTL)                      | Eventually consistent                       | Falls back to URL-only display                                | Client attempts first; CF used as fallback                                                                         |
| **@Mentions**             | `useMentionAutocomplete.ts` → `mentionParser.ts`                           | Client (parsed from text)                          | Sent with message to server                 | Mentions in `mentionUids[]`; push uses this for notify        | Max 5 per message                                                                                                  |
| **Scheduled messages**    | `scheduledMessages.ts` → CF `processScheduledMessages` (cron 1min)         | Server (ScheduledMessages collection)              | Confirmed (server delivers)                 | Up to 1-min late delivery; marks "failed" on error            | 30-day auto-cleanup of old scheduled messages                                                                      |
| **Pinning conversations** | `useConversationActions.ts` → `chatMembers.ts` / `groupMembers.ts`         | Member subcollection (`pinnedAt`)                  | Optimistic                                  | Error toast + revert                                          | Max 5 pinned (configurable via `InboxSettings`)                                                                    |
| **Muting**                | `useConversationActions.ts` → member private state                         | Member subcollection (`mutedUntil`)                | Optimistic                                  | Error toast                                                   | Backend checks mute before sending push notification                                                               |
| **Blocking**              | `blocking.ts` → `Users/{uid}/blockedUsers` subcollection                   | Firestore (both users checked)                     | Confirmed                                   | CF `sendMessageV2` rejects if blocked                         | Auto-cancels pending friend requests; bidirectional check                                                          |
| **Group invites**         | `groups.ts` → `GroupInvites` collection                                    | Firestore                                          | Confirmed                                   | Invite expires after 7 days                                   | `INVITE_EXPIRY_DAYS = 7`                                                                                           |
| **Game invites in chat**  | `ChatGameInvites.tsx` / `kind: "game_invite"`                              | Message with `kind: "game_invite"`                 | Part of message send flow                   | Displayed as card in chat                                     | Inline rendering; acceptance handled by game system                                                                |
| **Quack/Duck**            | `quackService.ts` → `DuckBubble.tsx`                                       | Client (special message rendering)                 | Standard message send                       | Regular message if rendering fails                            | Fun feature; no server-side special handling                                                                       |
