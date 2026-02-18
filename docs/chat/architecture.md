# Chat System Architecture

> Detailed component map, responsibilities, and call graphs for the SnapStyle chat system.

---

## 1. Architectural Overview

The chat system has **two parallel data paths** controlled by the feature flag `USE_LOCAL_STORAGE` in `constants/featureFlags.ts`:

| Mode                           | Flag State                  | Data path                                     | Status                               |
| ------------------------------ | --------------------------- | --------------------------------------------- | ------------------------------------ |
| **Firestore Mode** (primary)   | `USE_LOCAL_STORAGE = false` | Client → Firestore `onSnapshot` subscriptions | **Active / Production**              |
| **SQLite Mode** (experimental) | `USE_LOCAL_STORAGE = true`  | Client → SQLite → Sync Engine → Firestore     | **Feature-flagged / In development** |

Both paths converge at the **`useChat` hook** which abstracts the data source.

Additionally, two **message schema generations** coexist:

| Version | Types file                                        | Key fields                                                       | Status                                        |
| ------- | ------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| **V1**  | `src/types/models.ts` → `Message`, `GroupMessage` | `sender`, `content`, `type`, `read`                              | **Legacy** — still used in some UI components |
| **V2**  | `src/types/messaging.ts` → `MessageV2`            | `senderId`, `text`, `kind`, `serverReceivedAt`, `idempotencyKey` | **Active** — used by all new code             |

The `src/utils/messageAdapters.ts` and `src/services/messaging/adapters/groupAdapter.ts` files bridge V1 ↔ V2 formats.

---

## 2. Component Hierarchy

### 2.1. Screen Layer

```
RootNavigator
├── InboxStack
│   ├── ChatListScreenV2          ← Inbox (conversations list)
│   │   └── useInboxData()
│   ├── ChatScreen                ← 1:1 DM chat
│   │   └── useUnifiedChatScreen({ scope: "dm" })
│   ├── ChatSettingsScreen        ← Per-chat settings
│   ├── ScheduledMessagesScreen   ← Scheduled messages list
│   ├── InboxSearchScreen         ← Conversation search
│   └── InboxSettingsScreen       ← Global inbox settings
│
├── GroupStack
│   ├── GroupChatScreen            ← Group conversation
│   │   └── useUnifiedChatScreen({ scope: "group" })
│   ├── GroupChatInfoScreen        ← Group details / members
│   ├── GroupChatCreateScreen      ← Create group
│   └── GroupInvitesScreen         ← Pending invites
│
└── SettingsStack
    ├── BlockedUsersScreen         ← Manage blocks
    └── PrivacySettingsScreen      ← Privacy controls
```

### 2.2. Hook Composition

The hook layer uses a **composition pattern** — small focused hooks are composed into larger ones:

```
useUnifiedChatScreen (UNI-04)
├── useChat (ARCH-D02)
│   ├── useUnifiedMessages          ← Firestore subscription + outbox merge
│   │   └── messageList.ts          ← Firestore onSnapshot queries
│   │   └── outbox.ts               ← AsyncStorage outbox queue
│   ├── OR useLocalMessages         ← SQLite local storage (feature-flagged)
│   │   └── messageRepository.ts    ← SQLite CRUD
│   │   └── syncEngine.ts           ← Firestore ↔ SQLite sync
│   ├── useChatKeyboard             ← Keyboard height animation
│   ├── useAtBottom                 ← Scroll position tracking
│   └── useNewMessageAutoscroll     ← Auto-scroll logic
│
└── useChatComposer (ARCH-D03)
    ├── useAttachmentPicker          ← Image/video selection
    ├── useVoiceRecorder             ← Hold-to-record
    └── useMentionAutocomplete       ← @-mention search
```

**Standalone hooks** (not composed into the above, used directly by screens):

| Hook                     | Used by                                   | Purpose                             |
| ------------------------ | ----------------------------------------- | ----------------------------------- |
| `useTypingStatus`        | ChatScreen, GroupChatScreen               | Pub/sub typing indicators           |
| `useReadReceipts`        | ChatScreen                                | Update/subscribe read watermarks    |
| `usePresence`            | ChatScreen, ConversationItem              | Online/offline status               |
| `useOutboxProcessor`     | App root                                  | Background retry of failed sends    |
| `useConversationActions` | ChatListScreenV2, ConversationContextMenu | Pin/mute/archive/delete             |
| `useInboxData`           | ChatListScreenV2                          | Aggregated inbox with unread counts |
| `useLinkPreviews`        | DMMessageItem, ChatComposer               | Fetch/display link previews         |
| `useNetworkStatus`       | NetworkBanner                             | Connectivity detection              |

### 2.3. Service Layer

```
services/
├── messaging/                     ← Unified messaging module
│   ├── send.ts                   ← Entry point: enqueue → outbox → callable
│   ├── subscribe.ts              ← Entry point: Firestore onSnapshot wrappers
│   ├── memberState.ts            ← Unified DM/Group member state
│   └── adapters/
│       └── groupAdapter.ts       ← Legacy GroupMessage ↔ MessageV2 adapter
│
├── chatV2.ts                     ← V2 send pipeline (sendMessageV2 callable)
├── chat.ts                       ← V1 legacy (generateChatId, getOrCreateChat)
├── chatMembers.ts                ← DM Members/MembersPrivate subcollection ops
├── messageList.ts                ← Paginated Firestore message queries
├── messageActions.ts             ← Edit/delete/pin message actions
├── outbox.ts                     ← AsyncStorage-based offline queue
├── reactions.ts                  ← Emoji reaction CRUD + subscriptions
├── presence.ts                   ← RTDB presence (online/offline/lastSeen)
├── attachments.ts                ← Upload/validate media attachments
├── storage.ts                    ← Firebase Storage wrapper
├── mediaCache.ts                 ← Local disk cache for media
├── linkPreview.ts                ← Client-side link preview fetcher
├── mentionParser.ts              ← @-mention text parsing
├── blocking.ts                   ← Block/unblock user Firestore ops
├── reporting.ts                  ← Report message/user to Firestore
├── moderation.ts                 ← Content moderation (bans/warnings/strikes)
├── inboxSettings.ts              ← Per-user inbox preferences
├── scheduledMessages.ts          ← Scheduled message CRUD
├── groups.ts                     ← Group CRUD, invites, legacy group messaging
├── groupMembers.ts               ← Group Members/MembersPrivate ops
├── notifications.ts              ← Push notification registration (Expo)
│
├── chat/
│   ├── snapMessageService.ts     ← Ephemeral snap messages
│   └── quackService.ts           ← "Quack" / duck feature
│
├── database/                     ← SQLite layer (feature-flagged)
│   ├── conversationRepository.ts
│   ├── messageRepository.ts
│   └── maintenance.ts
│
└── sync/
    └── syncEngine.ts             ← Bidirectional Firestore ↔ SQLite sync
```

---

## 3. Data Flow Paths

### 3.1. Firestore Mode (Production)

```
User types → useChatComposer.send()
  → useChat.sendMessage()
    → messaging/send.ts :: sendMessage()
      → outbox.ts :: enqueueMessage()          [AsyncStorage: state="queued"]
      → chatV2.ts :: sendMessageV2()           [httpsCallable → CF]
        → Cloud Function validates + writes
      → outbox.ts :: removeFromOutbox()         [on success]
      → caller gets { success: true }

Firestore write triggers:
  → onSnapshot in messageList.ts fires
  → useUnifiedMessages merges server msgs + outbox
  → FlatList re-renders
```

### 3.2. SQLite Mode (Experimental)

```
User types → useChatComposer.send()
  → useChat.sendMessage()
    → conversationRepository :: getOrCreateDMConversation()
    → messageRepository :: insertMessage()      [SQLite: status="pending"]
    → localMessagesHook.refresh()               [UI shows optimistic message]
    → syncEngine :: syncPendingMessages()       [background]
      → httpsCallable sendMessageV2
      → messageRepository :: markMessageSynced()
```

### 3.3. Receive Path

```
Cloud writes message doc to Firestore
  → onSnapshot listener in messageList.ts fires
  → useUnifiedMessages callback merges with outbox
  → deduplicates (outbox item removed if server msg matches messageId)
  → sorted by serverReceivedAt (desc for inverted FlatList)
  → ChatMessageList re-renders
  → if at bottom: auto-scroll via useNewMessageAutoscroll
  → if not at bottom: ReturnToBottomPill shows unread count

Firestore trigger (backend):
  → onNewMessage / onNewGroupMessageV2
  → checks mute, block, notifyLevel
  → sends Expo push notification to recipient(s)
```

---

## 4. Folder Structure Quick Reference

```
src/
├── components/
│   ├── chat/                   (27 components, 1 barrel)
│   │   └── inbox/              (14 components, 1 barrel)
│   ├── DMMessageItem.tsx       (V1+V2 message bubble)
│   ├── ScheduleMessageModal.tsx
│   ├── BlockUserModal.tsx
│   └── ReportUserModal.tsx
├── hooks/
│   ├── chat/                   (3 hooks, 1 barrel)
│   ├── useChat.ts              (632 lines, master hook)
│   ├── useChatComposer.ts      (771 lines)
│   ├── useUnifiedChatScreen.ts (365 lines)
│   └── ... (15 more hooks)
├── screens/
│   ├── chat/                   (7 screens)
│   └── groups/                 (4 screens)
├── services/
│   ├── messaging/              (4 files + adapters)
│   ├── database/               (4 files, SQLite)
│   ├── sync/                   (2 files)
│   ├── chat/                   (2 files)
│   └── ... (18 individual service files)
├── types/
│   ├── messaging.ts            (V2 types, 742 lines)
│   └── models.ts               (V1 types, 992 lines)
└── utils/
    ├── messagePreview.ts
    └── messageAdapters.ts

firebase-backend/
├── functions/src/
│   ├── messaging.ts            (1236 lines, 4 Cloud Functions)
│   ├── legacy.ts               (3261 lines, triggers + crons)
│   ├── linkPreview.ts          (261 lines)
│   └── utils.ts                (148 lines)
├── firestore.rules             (2249 lines)
├── storage.rules               (208 lines)
└── firestore.indexes.json      (679 lines)
```

---

## 5. Key Patterns and Conventions

### 5.1. Hook Architecture IDs

Hooks use architecture reference IDs in their JSDoc headers:

- **ARCH-D02**: `useChat` — master chat hook
- **ARCH-D03**: `useChatComposer` — composer state
- **UNI-04**: `useUnifiedChatScreen` — screen-level composition

### 5.2. Logging

All services and hooks use `createLogger(tag)` from `src/utils/log.ts`:

```typescript
const log = createLogger("useChat");
log.debug("message", { operation: "send", data: { ... } });
log.error("message", error);
```

### 5.3. Feature Flags

Key flags in `constants/featureFlags.ts`:

- `USE_LOCAL_STORAGE` — enables SQLite mode for messages
- `USE_CHAT_V2` — enables V2 message types/pipeline (currently `true` in production)

### 5.4. Module Barrel Exports

Each service/hook subdirectory has an `index.ts` barrel export. The `src/services/messaging/` module is the recommended entry point for new code.

---

## 6. Dual Implementation Summary

| Area          | Active Implementation                                  | Legacy Implementation                              | Bridge                                    |
| ------------- | ------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------- |
| Message types | `MessageV2` (`types/messaging.ts`)                     | `Message`, `GroupMessage` (`types/models.ts`)      | `messageAdapters.ts`, `groupAdapter.ts`   |
| Send pipeline | `messaging/send.ts` → `chatV2.ts` → CF `sendMessageV2` | `chat.ts` (V1, not used for sending)               | —                                         |
| Subscriptions | `messaging/subscribe.ts` → `messageList.ts`            | `groups.ts :: subscribeToGroupMessages()` (legacy) | `groupAdapter.ts` converts on the fly     |
| Member state  | `messaging/memberState.ts` (unified facade)            | `chatMembers.ts` (DM), `groupMembers.ts` (Group)   | `memberState.ts` delegates based on scope |
| Data storage  | Firestore (primary), SQLite (feature-flagged)          | —                                                  | `syncEngine.ts`                           |
| Chat creation | `chatV2.ts` + `chat.ts :: getOrCreateChat()`           | `chat.ts` standalone                               | Both called                               |
| Inbox         | `ChatListScreenV2.tsx` + `useInboxData.ts`             | — (V1 inbox removed)                               | —                                         |
