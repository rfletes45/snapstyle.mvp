# SnapStyle Chat System — Complete Technical Documentation

> **Single source of truth** for the SnapStyle chat/messaging system.
> Generated from actual codebase analysis — February 2026.
> This is a consolidated document combining all chat system documentation into one reference.

---

# PART 1: ARCHITECTURE OVERVIEW

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

## Dual Implementation Overview

The chat system has **two parallel data paths** controlled by the feature flag `USE_LOCAL_STORAGE` in `constants/featureFlags.ts`:

| Mode                           | Flag State                  | Data path                                     | Status                               |
| ------------------------------ | --------------------------- | --------------------------------------------- | ------------------------------------ |
| **Firestore Mode** (primary)   | `USE_LOCAL_STORAGE = false` | Client → Firestore `onSnapshot` subscriptions | **Active / Production**              |
| **SQLite Mode** (experimental) | `USE_LOCAL_STORAGE = true`  | Client → SQLite → Sync Engine → Firestore     | **Feature-flagged / In development** |

Two **message schema generations** coexist:

| Version | Types file                                        | Key fields                                                       | Status                                        |
| ------- | ------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| **V1**  | `src/types/models.ts` → `Message`, `GroupMessage` | `sender`, `content`, `type`, `read`                              | **Legacy** — still used in some UI components |
| **V2**  | `src/types/messaging.ts` → `MessageV2`            | `senderId`, `text`, `kind`, `serverReceivedAt`, `idempotencyKey` | **Active** — used by all new code             |

The `src/utils/messageAdapters.ts` and `src/services/messaging/adapters/groupAdapter.ts` files bridge V1 ↔ V2 formats.

## Component Hierarchy

### Screen Layer

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

### Hook Composition

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

**Standalone hooks** (used directly by screens):

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

### Service Layer

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

## Data Flow Paths

### Firestore Mode (Production)

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

### SQLite Mode (Experimental)

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

### Receive Path

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

# PART 2: DATA MODEL

## Firestore Collections Overview

```
Firestore
├── Chats/{chatId}                          ← DM conversations
│   ├── Messages/{messageId}                ← DM messages (V1 + V2 schema)
│   │   └── Reactions/{emoji}               ← Per-emoji reaction docs
│   ├── Members/{uid}                       ← Public member state (typing, watermark)
│   └── MembersPrivate/{uid}                ← Private member state (mute, archive)
│
├── Groups/{groupId}                        ← Group conversations
│   ├── Messages/{messageId}                ← Group messages
│   │   └── Reactions/{emoji}               ← Per-emoji reaction docs
│   ├── Members/{uid}                       ← Public group member state
│   └── MembersPrivate/{uid}                ← Private group member state
│
├── GroupInvites/{inviteId}                 ← Group invitation records
├── ScheduledMessages/{messageId}           ← Scheduled (future) messages
├── Reports/{reportId}                      ← User/message reports
├── Users/{uid}/blockedUsers/{blockedUid}   ← Block list
└── Users/{uid}/settings/inboxSettings      ← Per-user inbox preferences

RTDB (Realtime Database)
└── status/{uid}                            ← Online/offline presence
```

## Collection Schemas

### `Chats/{chatId}`

Represents a 1:1 DM conversation. `chatId` = deterministic ID from sorted UIDs (via `generateChatId()`).

Source: `src/services/chat.ts`, Type: `Chat` in `src/types/models.ts`

```json
{
  "id": "abc123_def456",
  "members": ["abc123", "def456"],
  "createdAt": 1708012800000,
  "lastMessageText": "Hey, want to play?",
  "lastMessageAt": 1708099200000
}
```

| Field             | Type               | Description                   |
| ----------------- | ------------------ | ----------------------------- |
| `id`              | `string`           | Document ID (sorted UID pair) |
| `members`         | `[string, string]` | Exactly 2 member UIDs         |
| `createdAt`       | `number`           | Creation timestamp (ms)       |
| `lastMessageText` | `string?`          | Preview of last message       |
| `lastMessageAt`   | `number?`          | Timestamp of last message     |

Security rules: Read requires `request.auth.uid in resource.data.members`. Create requires `members.size() == 2`. Members array cannot be changed after creation.

### `Chats/{chatId}/Messages/{messageId}`

Individual messages within a DM conversation.

Source: `MessageV2` in `src/types/messaging.ts` (active), `Message` in `src/types/models.ts` (legacy)

**V2 schema** (current):

```json
{
  "id": "msg_a1b2c3d4",
  "scope": "dm",
  "conversationId": "abc123_def456",
  "senderId": "abc123",
  "senderName": "Alice",
  "kind": "text",
  "text": "Hey! Want to play mini golf?",
  "createdAt": 1708099200000,
  "serverReceivedAt": 1708099200123,
  "clientId": "device_xyz",
  "idempotencyKey": "device_xyz:msg_a1b2c3d4",
  "replyTo": null,
  "attachments": [],
  "mentionUids": [],
  "reactionsSummary": { "🔥": 2, "❤️": 1 },
  "hiddenFor": [],
  "deletedForAll": null,
  "content": "Hey! Want to play mini golf?",
  "type": "text",
  "sender": "abc123",
  "read": false,
  "status": "sent"
}
```

**Key fields**:

| Field              | Type                           | V1/V2 | Description                                                                          |
| ------------------ | ------------------------------ | ----- | ------------------------------------------------------------------------------------ |
| `id`               | `string`                       | V2    | Client-generated UUID (doc ID)                                                       |
| `scope`            | `"dm" \| "group"`              | V2    | Conversation type                                                                    |
| `conversationId`   | `string`                       | V2    | Parent chat/group ID                                                                 |
| `senderId`         | `string`                       | V2    | Sender's UID                                                                         |
| `senderName`       | `string?`                      | V2    | Denormalized display name                                                            |
| `kind`             | `MessageKind`                  | V2    | `"text"`, `"media"`, `"voice"`, `"file"`, `"system"`, `"scorecard"`, `"game_invite"` |
| `text`             | `string?`                      | V2    | Message text content                                                                 |
| `createdAt`        | `number`                       | Both  | Client-side timestamp (ms)                                                           |
| `serverReceivedAt` | `number`                       | V2    | **Server-authoritative** timestamp for ordering                                      |
| `clientId`         | `string`                       | V2    | Stable device ID for idempotency                                                     |
| `idempotencyKey`   | `string`                       | V2    | `${clientId}:${id}` — dedup key                                                      |
| `editedAt`         | `number?`                      | V2    | Last edit timestamp                                                                  |
| `replyTo`          | `ReplyToMetadata?`             | V2    | Reply thread metadata                                                                |
| `attachments`      | `AttachmentV2[]?`              | V2    | Media attachments                                                                    |
| `linkPreview`      | `LinkPreviewV2?`               | V2    | OG meta for URLs                                                                     |
| `mentionUids`      | `string[]?`                    | V2    | Mentioned user IDs                                                                   |
| `mentionSpans`     | `MentionSpan[]?`               | V2    | Text positions for highlighting                                                      |
| `reactionsSummary` | `Record<string, number>?`      | V2    | Denormalized reaction counts                                                         |
| `hiddenFor`        | `string[]?`                    | V2    | UIDs who "deleted for me"                                                            |
| `deletedForAll`    | `{ by, at }?`                  | V2    | Delete-for-everyone marker                                                           |
| `scorecard`        | `{ gameId, score, metadata }?` | V2    | Game scorecard data                                                                  |
| `sender`           | `string`                       | V1    | **Deprecated** — use `senderId`                                                      |
| `content`          | `string`                       | V1    | **Deprecated** — use `text`                                                          |
| `type`             | `string`                       | V1    | **Deprecated** — use `kind`                                                          |
| `read`             | `boolean`                      | V1    | **Deprecated** — use member watermarks                                               |
| `status`           | `string`                       | V1    | **Deprecated** — use outbox state                                                    |

**Note**: The Cloud Function `sendMessageV2` writes **both V1 and V2 fields** for backward compatibility.

### `Chats/{chatId}/Messages/{messageId}/Reactions/{emoji}`

Per-emoji reaction tracking on a message.

```json
{
  "emoji": "🔥",
  "uids": ["abc123", "def456"],
  "updatedAt": 1708099300000
}
```

**Allowed emojis** (hardcoded in CF): `❤️`, `🔥`, `😂`, `😮`, `😢`, `👍`, `👎`, `🎉`, `💯`, `🙏`, `😍`, `🤔`, `👀`, `💀`, `🫡`, `🦆`

Limits: Max 12 unique emoji types per message. Rate: 10 reactions/minute.

### `Chats/{chatId}/Members/{uid}`

Public member state visible to the other chat participant.

```json
{
  "uid": "abc123",
  "role": "member",
  "joinedAt": 1708012800000,
  "lastReadAtPublic": 1708099200000,
  "typingAt": null
}
```

| Field              | Type                              | Description                                    |
| ------------------ | --------------------------------- | ---------------------------------------------- |
| `uid`              | `string`                          | User ID (doc ID)                               |
| `role`             | `"owner" \| "admin" \| "member"?` | Role (groups only)                             |
| `joinedAt`         | `number`                          | When user joined                               |
| `lastReadAtPublic` | `number?`                         | Read receipt watermark — other user sees this  |
| `typingAt`         | `number?`                         | Typing indicator timestamp (null = not typing) |

### `Chats/{chatId}/MembersPrivate/{uid}`

Private member settings — only readable/writable by the owning user.

```json
{
  "uid": "abc123",
  "archived": false,
  "mutedUntil": null,
  "notifyLevel": "all",
  "customNotifications": { "push": true, "inApp": true },
  "sendReadReceipts": true,
  "lastSeenAtPrivate": 1708099200000,
  "lastMarkedUnreadAt": null,
  "pinnedAt": 1708012800000,
  "deletedAt": null,
  "hiddenUntilNewMessage": false
}
```

| Field                   | Type                             | Description                                  |
| ----------------------- | -------------------------------- | -------------------------------------------- |
| `archived`              | `boolean?`                       | Conversation archived                        |
| `mutedUntil`            | `number \| null`                 | Mute expiry (null = not muted, -1 = forever) |
| `notifyLevel`           | `"all" \| "mentions" \| "none"?` | Notification preference                      |
| `sendReadReceipts`      | `boolean?`                       | Whether to publish read receipts             |
| `lastSeenAtPrivate`     | `number`                         | Last time user viewed this chat (private)    |
| `lastMarkedUnreadAt`    | `number?`                        | Manual "mark as unread" timestamp            |
| `pinnedAt`              | `number \| null`                 | Pin timestamp (null = not pinned)            |
| `deletedAt`             | `number \| null`                 | Soft delete timestamp                        |
| `hiddenUntilNewMessage` | `boolean?`                       | Hide from inbox until new message arrives    |

### `Groups/{groupId}`

Group conversation metadata. Source: `Group` in `src/types/models.ts`

```json
{
  "id": "grp_xyz789",
  "name": "Mini Golf Squad",
  "ownerId": "abc123",
  "memberIds": ["abc123", "def456", "ghi789"],
  "memberCount": 3,
  "avatarPath": "groups/grp_xyz789/avatar.jpg",
  "avatarUrl": "https://firebasestorage.googleapis.com/...",
  "createdAt": 1708012800000,
  "updatedAt": 1708099200000,
  "lastMessageText": "Nice shot!",
  "lastMessageAt": 1708099200000,
  "lastMessageSenderId": "def456"
}
```

Group limits: Min members: 3, Max members: 20, Max name length: 50, Invite expiry: 7 days.

### `Groups/{groupId}/Messages/{messageId}`

Same schema as DM messages (`MessageV2`), but with `scope: "group"`. The `groupAdapter.ts` converts between `GroupMessage` ↔ `MessageV2`.

### `GroupInvites/{inviteId}`

```json
{
  "id": "inv_abc",
  "groupId": "grp_xyz789",
  "groupName": "Mini Golf Squad",
  "fromUid": "abc123",
  "fromDisplayName": "Alice",
  "toUid": "def456",
  "status": "pending",
  "createdAt": 1708012800000,
  "expiresAt": 1708617600000,
  "respondedAt": null
}
```

### `ScheduledMessages/{messageId}`

```json
{
  "id": "sched_abc",
  "senderId": "abc123",
  "chatId": "abc123_def456",
  "chatType": "dm",
  "content": "Happy birthday! 🎂",
  "messageType": "text",
  "scheduledFor": 1708099200000,
  "status": "pending",
  "createdAt": 1708012800000,
  "deliveredAt": null,
  "failureReason": null
}
```

Statuses: `"pending"` → `"sent"` or `"failed"` or `"cancelled"`. CF `processScheduledMessages` runs every 1 minute.

### `Users/{uid}/blockedUsers/{blockedUid}`

```json
{
  "blockedUserId": "def456",
  "blockedAt": 1708012800000,
  "reason": "Harassment"
}
```

### `Users/{uid}/settings/inboxSettings`

```json
{
  "defaultNotifyLevel": "all",
  "showReadReceipts": true,
  "showTypingIndicators": true,
  "showOnlineStatus": true,
  "showLastSeen": true,
  "maxPinnedConversations": 5,
  "confirmBeforeDelete": true,
  "swipeActionsEnabled": true,
  "recentSearches": ["alice", "golf squad"]
}
```

### RTDB: `status/{uid}` (Presence)

```json
{
  "online": true,
  "lastSeen": 1708099200000
}
```

Uses Firebase RTDB `onDisconnect()` to automatically set `online: false` when client disconnects.

## Attachment Schema

Source: `AttachmentV2` in `src/types/messaging.ts`

```json
{
  "id": "att_xyz",
  "kind": "image",
  "mime": "image/jpeg",
  "url": "https://firebasestorage.googleapis.com/v0/b/.../pictures/chatId/att_xyz.jpg",
  "path": "pictures/chatId/att_xyz.jpg",
  "sizeBytes": 245760,
  "width": 1920,
  "height": 1080,
  "thumbUrl": "https://firebasestorage.googleapis.com/.../thumb_att_xyz.jpg",
  "caption": "Check out this view!",
  "viewOnce": false
}
```

Storage paths: DM images: `pictures/{chatId}/{filename}`, DM voice: `dm-voice/{chatId}/{filename}`, Group images: `groups/{groupId}/messages/{filename}`, Group voice: `groups/{groupId}/voice/{filename}`

## Link Preview Schema

```json
{
  "url": "https://example.com/article",
  "title": "Example Article",
  "description": "A fascinating read about...",
  "siteName": "Example.com",
  "imageUrl": "https://example.com/og-image.jpg",
  "fetchedAt": 1708012800000,
  "expiresAt": 1708099200000
}
```

Cached in Firestore `LinkPreviews/{urlHash}` with a 24-hour TTL.

## Reply Thread Schema

```json
{
  "messageId": "msg_original",
  "senderId": "def456",
  "senderName": "Bob",
  "kind": "text",
  "textSnippet": "Hey, want to play mini golf?"
}
```

Replies are **flat** — not nested threads. Snippet truncated to 100 chars.

## Outbox Schema (Client-Side, AsyncStorage)

```json
{
  "messageId": "msg_local_abc",
  "scope": "dm",
  "conversationId": "abc123_def456",
  "kind": "text",
  "text": "Hello!",
  "createdAt": 1708099200000,
  "attemptCount": 0,
  "nextRetryAt": 1708099200000,
  "state": "queued",
  "lastError": null
}
```

States: `"queued"` → `"uploading"` → `"sending"` → removed (success) or → `"failed"`

## Composite Indexes

Key chat-related indexes from `firebase-backend/firestore.indexes.json`:

| Collection          | Fields                                               | Query Pattern                                |
| ------------------- | ---------------------------------------------------- | -------------------------------------------- |
| `Chats`             | `members` (CONTAINS) + `lastMessageAt` (DESC)        | Inbox: user's conversations sorted by recent |
| `Groups`            | `memberIds` (CONTAINS) + `lastMessageAt` (DESC)      | Inbox: user's groups sorted by recent        |
| `Messages`          | `mentionUids` (CONTAINS) + `serverReceivedAt` (DESC) | Unread mentions query                        |
| `GroupInvites`      | `toUid` (ASC) + `status` (ASC) + `createdAt` (DESC)  | Pending invites for user                     |
| `ScheduledMessages` | `status` (ASC) + `scheduledFor` (ASC)                | CF: process pending messages                 |

## SQLite Schema (Feature-Flagged)

When `USE_LOCAL_STORAGE` is enabled:

### conversations table

| Column          | Type    | Description            |
| --------------- | ------- | ---------------------- |
| `id`            | TEXT PK | Conversation ID        |
| `scope`         | TEXT    | "dm" or "group"        |
| `lastMessageAt` | INTEGER | Last message timestamp |
| `unreadCount`   | INTEGER | Unread message count   |
| `syncVersion`   | INTEGER | Last sync version      |
| `archived`      | INTEGER | Boolean flag           |
| `pinnedAt`      | INTEGER | Pin timestamp          |

### messages table

| Column             | Type        | Description                   |
| ------------------ | ----------- | ----------------------------- |
| `id`               | TEXT PK     | Message ID                    |
| `conversationId`   | TEXT FK     | Parent conversation           |
| `senderId`         | TEXT        | Sender UID                    |
| `kind`             | TEXT        | Message type                  |
| `text`             | TEXT        | Message content               |
| `serverReceivedAt` | INTEGER     | Server timestamp              |
| `idempotencyKey`   | TEXT UNIQUE | Dedup key                     |
| `syncStatus`       | TEXT        | "pending", "synced", "failed" |

---

# PART 3: CLIENT FLOWS

## 1. Open Chat (DM)

Screen: `src/screens/chat/ChatScreen.tsx`

1. **Navigation** — pushes `ChatScreen` with `{ chatId, otherUserId }`.
2. **Hook init** — `useUnifiedChatScreen({ scope: "dm", conversationId: chatId })`.
3. **useChat init**:
   - Feature flag check → `USE_LOCAL_STORAGE`
   - **Firestore mode** → `useUnifiedMessages()` subscribes to `Chats/{chatId}/Messages` via `messageList.ts`. Initial query: last 50 messages ordered by `serverReceivedAt` DESC.
   - **SQLite mode** → `useLocalMessages()` reads from SQLite, then starts background sync.
4. **Outbox merge** — fetches pending outbox items, merges into messages, deduplicates by `messageId`.
5. **Keyboard** — `useChatKeyboard()` starts keyboard event listeners.
6. **Scroll tracking** — `useAtBottom()` attaches to FlatList `onScroll`.
7. **Auto-scroll** — `useNewMessageAutoscroll()` monitors message count changes.
8. **Typing subscription** — subscribes to `Members/{otherUid}.typingAt`.
9. **Read receipts** — updates `Members/{uid}.lastReadAtPublic` and `MembersPrivate/{uid}.lastSeenAtPrivate`.
10. **Presence** — subscribes to RTDB `status/{otherUserId}`.
11. **Render** — `ChatMessageList` renders via inverted FlatList. `DMMessageItem` renders each bubble.

## 2. Open Chat (Group)

Screen: `src/screens/groups/GroupChatScreen.tsx`

Differences from DM: uses `scope: "group"`, messages from `Groups/{groupId}/Messages`, typing subscribes to ALL members, `enableMentions: true` by default.

## 3. Send Text Message

### Firestore Mode Flow

1. `useChatComposer.send()` validates: text not empty, not already sending.
2. Delegates to `useChat.sendMessage()` → `messaging/send.ts :: sendMessage()`.
3. **Outbox enqueue** — `outbox.ts :: enqueueMessage()` stores to AsyncStorage with `state: "queued"`. **Optimistic UI**: outbox item merged into message list immediately.
4. **Cloud Function call** — `chatV2.ts :: sendMessageV2()` invokes `httpsCallable("sendMessageV2")`.
5. **Server validates**: Auth, membership, block check (DM), rate limit (30/min), idempotency, text ≤ 10K chars, mentions ≤ 5, attachments ≤ 10.
6. **Server writes**: Message doc with `serverReceivedAt = FieldValue.serverTimestamp()`, updates conversation preview, writes both V2 and V1 fields.
7. **Outbox cleanup** — on success, removes item.
8. **Subscription fires** — `onSnapshot` delivers new message. `useUnifiedMessages` replaces outbox item with server message.
9. **Push notification** — Firestore trigger sends Expo push (checks mute/block).

## 4. Receive Message (Real-Time)

1. Firestore write → `onSnapshot` fires.
2. `useUnifiedMessages` merges with outbox, filters `hiddenFor`, sorts by `serverReceivedAt`.
3. Auto-scroll check: at bottom → auto-scroll; not at bottom → show `ReturnToBottomPill`.
4. If `autoMarkRead: true` and at bottom, updates read watermark.

## 5. Edit Message

Preconditions: sender only, not deleted, within 15-min window (`EDIT_WINDOW_MS = 900000ms`), text messages only.

1. User selects "Edit" from `MessageActionsSheet`.
2. `messageActions.ts :: editMessage()` calls CF `editMessageV2`.
3. Server validates sender, window, kind, not-deleted. Updates `text`, `editedAt`, pushes to `editHistory`.
4. Subscription delivers updated message. Shows "(edited)" indicator.
5. **No optimistic update** — waits for server confirmation.

## 6. Delete Message

### Delete for Me

- Direct Firestore write: `arrayUnion(uid)` to `hiddenFor` field. No Cloud Function.
- Rules validate `request.auth.uid` is the value added.
- `useUnifiedMessages` filters `hiddenFor.includes(currentUid)`.

### Delete for Everyone

- DM: sender only, within edit window. Group: sender (within window) OR admin/owner (any time).
- CF sets `deletedForAll: { by, at }`, clears `text` to `"[Message deleted]"`, removes attachments.
- Idempotent: if already deleted, returns success.

## 7. React to Message

1. User taps emoji in `ReactionBar`.
2. `reactions.ts :: toggleReaction()` calls CF `toggleReactionV2`.
3. CF: rate limit 10/min, validates against 16-emoji allowlist, max 12 unique emojis per message.
4. Transaction: toggles user in `Reactions/{emoji}.uids`, updates `reactionsSummary` on message doc.
5. **No optimistic update** — waits for transaction.

## 8. Attach Media

1. `useAttachmentPicker :: pickFromLibrary()` or `pickFromCamera()`.
2. Validates: max 10 attachments, 10MB each, valid MIME type.
3. Previewed in `AttachmentTray`. Uploaded on send. Metadata included in message payload.

## 9. Voice Message

1. `useVoiceRecorder :: startRecording()`. Max 60s.
2. State machine: `idle` → `recording` → `stopped` → upload.
3. `snapMessageService.ts :: sendVoiceMessage()` uploads to Storage.
4. `VoiceMessagePlayer` renders inline audio player.

## 10. Reply to Message

1. Swipe right or tap "Reply". Sets `replyTo` metadata on `useChat`.
2. `ReplyPreviewBar` appears above composer.
3. On send, `replyTo` stored on message doc. `ReplyBubbleNew` renders quoted original.
4. Reply state auto-clears after send.

## 11. @Mention

1. `useMentionAutocomplete` detects `@` trigger.
2. `MentionAutocomplete` dropdown shows matching group members.
3. `mentionParser.ts` tracks mention UIDs. Max 5 per message.
4. `onNewGroupMessageV2` uses `mentionUids` for differentiated push.

## 12. Pagination

FlatList `onEndReached` triggers `messageList.ts :: loadOlderMessages()`. Query: `startAfter(oldestTimestamp).limit(50)`. `hasMoreOlder` = false when query returns fewer than limit.

## 13. Typing Indicator

- **Publish**: Throttled to once per 2s. Writes `Members/{uid}.typingAt`. Auto-clears after 8s.
- **Subscribe**: `subscribeToTyping()` for DM, `subscribeToAllTyping()` for group. `TypingIndicator` shows animated dots.

## 14. Read Receipts

- `useReadReceipts` updates `Members/{uid}.lastReadAtPublic` (public) and `MembersPrivate/{uid}.lastSeenAtPrivate` (private).
- Other user subscribes to see read status.
- Respects `sendReadReceipts` privacy setting.

## 15. Message Lifecycle State Machine

```
COMPOSE → QUEUED (outbox) → UPLOADING/SENDING → SENT → DELIVERED → READ
                                                    ↓
                                                  FAILED → retry → QUEUED
```

States: `MessageStatusV2`: `"sending"` | `"sent"` | `"delivered"` | `"read"` | `"failed"`

## 16. Conversation Actions (Inbox)

| Action      | DM Service                      | Group Service                           | Stored In                                           |
| ----------- | ------------------------------- | --------------------------------------- | --------------------------------------------------- |
| Pin/Unpin   | `chatMembers :: setDMPinned()`  | `groupMembers :: setGroupPinned()`      | `MembersPrivate/{uid}.pinnedAt`                     |
| Archive     | `chatMembers :: setArchived()`  | `groupMembers :: setGroupArchived()`    | `MembersPrivate/{uid}.archived`                     |
| Mute        | `chatMembers :: setMuted()`     | `groupMembers :: setGroupMuted()`       | `MembersPrivate/{uid}.mutedUntil`                   |
| Delete      | `chatMembers :: softDeleteDM()` | `groupMembers :: leaveAndDeleteGroup()` | `MembersPrivate/{uid}.deletedAt` (DM) / leave group |
| Mark unread | `chatMembers :: markAsUnread()` | `groupMembers :: markGroupAsUnread()`   | `MembersPrivate/{uid}.lastMarkedUnreadAt`           |

---

# PART 4: BACKEND FLOWS

## Cloud Functions Inventory

| Function                      | Type                  | File             | Purpose                               |
| ----------------------------- | --------------------- | ---------------- | ------------------------------------- |
| `sendMessageV2`               | `onCall`              | `messaging.ts`   | Server-authoritative message creation |
| `editMessageV2`               | `onCall`              | `messaging.ts`   | Edit message text (15-min window)     |
| `deleteMessageForAllV2`       | `onCall`              | `messaging.ts`   | Delete message for all participants   |
| `toggleReactionV2`            | `onCall`              | `messaging.ts`   | Add/remove emoji reaction             |
| `fetchLinkPreviewFunction`    | `onCall`              | `linkPreview.ts` | Server-side OG tag scraper            |
| `onNewMessage`                | Firestore trigger     | `legacy.ts`      | DM push notifications + streak update |
| `onNewGroupMessageV2`         | Firestore trigger     | `legacy.ts`      | Group push notifications              |
| `processScheduledMessages`    | Scheduled (1 min)     | `legacy.ts`      | Deliver scheduled messages            |
| `cleanupOldScheduledMessages` | Scheduled (daily 3AM) | `legacy.ts`      | Delete old scheduled messages         |
| `onNewMessageEvent`           | Firestore trigger     | `legacy.ts`      | Message-related event processing      |
| `checkMessageRateLimit`       | `onCall`              | `legacy.ts`      | Client-callable rate limit check      |
| `updateExpiredBans`           | Scheduled             | `legacy.ts`      | Unban expired users                   |

## `sendMessageV2` — Detailed

File: `firebase-backend/functions/src/messaging.ts`

### Input Schema

```typescript
{
  conversationId: string;
  scope: "dm" | "group";
  kind: MessageKind;
  text?: string;             // max 10,000 chars
  messageId: string;         // Client-generated UUID
  clientId: string;          // Stable device ID
  replyTo?: ReplyToMetadata;
  mentionUids?: string[];    // max 5
  attachments?: AttachmentV2[]; // max 10
  linkPreview?: LinkPreviewV2;
  scorecard?: object;
}
```

### Validation Steps

1. Auth — `context.auth` must exist.
2. Required fields validated.
3. Text length ≤ 10,000 chars.
4. Mentions ≤ 5.
5. Attachments ≤ 10.
6. Membership (DM: uid in `members`; Group: uid in `memberIds`).
7. Block check (DM only): bidirectional.
8. Rate limit: 30 messages/minute per conversation (transaction counter).

### Idempotency

```
Read Messages/{messageId}:
  - If exists AND idempotencyKey matches → return existing (no duplicate)
  - If exists AND idempotencyKey differs → throw "conflict"
  - If not exists → proceed with write
```

### Write

Writes message doc with both V2 and V1 legacy fields, sets `serverReceivedAt = FieldValue.serverTimestamp()`, updates conversation preview.

## `editMessageV2`

Validations: Auth, sender only, not deleted, 15-min window, text messages only. Updates `text`, `editedAt`, pushes to `editHistory`. Also updates legacy `content` field.

## `deleteMessageForAllV2`

Authorization: DM = sender only (within window); Group = sender (within window) or admin/owner (any time). Sets `deletedForAll`, clears `text` to `"[Message deleted]"`, removes `attachments` and `linkPreview`. Idempotent.

## `toggleReactionV2`

Rate limit: 10/min. 16-emoji allowlist. Max 12 unique emojis per message. Transaction toggles user in `Reactions/{emoji}.uids` and updates `reactionsSummary`.

## `onNewMessage` — DM Push Trigger

Trigger: `Chats/{chatId}/Messages/{messageId}` onCreate.
Flow: Get recipient → mute check → block check → get push token → send Expo push → update streaks.

## `onNewGroupMessageV2` — Group Push Trigger

Trigger: `Groups/{groupId}/Messages/{messageId}` onCreate.
For each member (except sender): mute check → notify level check (`"none"` skip, `"mentions"` only if mentioned, `"all"` notify) → send push. Differentiates mention vs regular push body.

## `processScheduledMessages` — Cron

Every 1 minute. Queries pending where `scheduledFor <= now`. Creates message doc, updates conversation preview, marks `status: "sent"`. On error: marks `"failed"`. Cleanup runs daily at 3 AM, deletes 30+ day old completed messages.

## `fetchLinkPreviewFunction`

Validates URL, checks Firestore cache, fetches with 5s timeout, parses OG tags, caches with 24h TTL.

## Rate Limiting

| Function           | Limit                                      | Implementation                          |
| ------------------ | ------------------------------------------ | --------------------------------------- |
| `sendMessageV2`    | 30 msgs/min per conversation               | Transaction counter on conversation doc |
| `toggleReactionV2` | 10 reactions/min per user per conversation | Transaction counter                     |

## Backend Data Flow

```
Client → httpsCallable("sendMessageV2")
  → CF: Auth → Validate → Membership → Block → Rate Limit → Idempotency → Write → Update preview
  → Return { success, messageId, serverReceivedAt }
  → Firestore trigger: onNewMessage/onNewGroupMessageV2
    → For each recipient: Mute check → Block check → Notify level → Send push
```

---

# PART 5: SECURITY & PERMISSIONS

## Authentication

- Firebase Auth provides UID. All `onCall` functions check `context.auth`.
- Firestore rules use `isAuth()` → `request.auth != null` as baseline.
- No anonymous access to any chat functionality.

## Authorization Model

### DM Conversations

| Action                 | Who                    | Rule Basis                                           |
| ---------------------- | ---------------------- | ---------------------------------------------------- |
| Read chat doc          | Either member          | `request.auth.uid in resource.data.members`          |
| Create chat            | Any authenticated user | `members.size() == 2 && request.auth.uid in members` |
| Send message           | Either member          | CF membership check + Firestore rule                 |
| Edit message           | Original sender only   | CF: `message.senderId === uid`, 15-min window        |
| Delete for me          | Self only              | Rule: `request.auth.uid` added to `hiddenFor`        |
| Delete for all         | Sender only            | CF: `message.senderId === uid`, within window        |
| Read own private state | Self only              | `MembersPrivate/{uid}` — `isOwner(uid)`              |

### Group Conversations

| Action         | Who                                  | Rule Basis                                    |
| -------------- | ------------------------------------ | --------------------------------------------- |
| Read group doc | Any member                           | `request.auth.uid in resource.data.memberIds` |
| Send message   | Any member                           | CF membership check                           |
| Delete for all | Sender OR admin/owner                | CF checks `role` in `Members/{uid}`           |
| Add member     | Self (invite accept), or owner/admin | Rule checks role                              |
| Remove member  | Self (leave), or admin/owner         | Rule checks role                              |
| Change role    | Owner only                           | `isGroupOwner()`                              |

### Group Roles

| Role     | Can send | Can delete others' msgs | Can add/remove members | Can change roles | Can delete group |
| -------- | -------- | ----------------------- | ---------------------- | ---------------- | ---------------- |
| `member` | ✅       | ❌                      | ❌                     | ❌               | ❌               |
| `admin`  | ✅       | ✅                      | ✅                     | ❌               | ❌               |
| `owner`  | ✅       | ✅                      | ✅                     | ✅               | ✅               |

## Firestore Rules — Key Points

File: `firebase-backend/firestore.rules`

- **Chats**: Read = member only. Create = exactly 2 members, creator must be member. Update = member, can't change members array.
- **Messages**: Read/create = member. Update supports 5 cases: delete-for-me, delete-for-all, edit (15-min window check via `request.time.toMillis() - resource.data.serverReceivedAt.toMillis() < 900000`), scorecard edit, legacy read mark.
- **Members**: Any chat member can read, only self can write.
- **MembersPrivate**: Only self can read/write.
- **Reactions**: Rules exist as fallback; in practice managed by CF using admin SDK.

## Storage Rules

File: `firebase-backend/storage.rules`

| Path                   | Read          | Write         | Constraints         |
| ---------------------- | ------------- | ------------- | ------------------- |
| `pictures/{chatId}/**` | Authenticated | Authenticated | Images only, ≤10MB  |
| `dm-voice/{chatId}/**` | Authenticated | Authenticated | Audio only, ≤5MB    |
| `groups/{groupId}/**`  | Authenticated | Authenticated | Varies by subfolder |
| `avatars/{userId}/**`  | Authenticated | Owner only    | Images, ≤5MB        |

Known gaps: Chat media reads not scoped to members (relies on URL unguessability). No per-member write scoping for uploads.

## Blocking System

File: `src/services/blocking.ts`

Data: `Users/{uid}/blockedUsers/{blockedUid}`. Bidirectional check.

Enforcement points: `sendMessageV2` CF, `onNewMessage` trigger, client send pipeline (advisory), friend request cancellation.

When User A blocks User B: A can't message B, B can't message A, push notifications suppressed, existing messages NOT deleted, inbox still shows conversation, group chat unaffected.

## Privacy Controls

| Setting                | Default | Effect                                       |
| ---------------------- | ------- | -------------------------------------------- |
| `showReadReceipts`     | `true`  | Controls whether read watermark is published |
| `showTypingIndicators` | `true`  | Controls whether typing status is published  |
| `showOnlineStatus`     | `true`  | Controls whether presence is visible         |
| `showLastSeen`         | `true`  | Controls whether "last seen" time is visible |

These are checked **client-side** before publishing state.

## Threat Model

| Threat                    | Severity | Current Mitigation                           | Gap                                                 |
| ------------------------- | -------- | -------------------------------------------- | --------------------------------------------------- |
| Spam flooding             | Medium   | 30 msgs/min per-conversation                 | Per-conversation only; no global per-user limit     |
| Message spoofing          | Low      | CF uses `context.auth.uid`                   | Server is authoritative                             |
| Read receipt tracking     | Low      | Privacy settings disable publishing          | Client-side enforcement only                        |
| Unauthorized message read | Medium   | Firestore rules require membership           | Correctly enforced                                  |
| Media URL enumeration     | Low      | Storage URLs include unguessable tokens      | Not signed/expired — once known, accessible forever |
| Replay attacks            | Low      | Idempotency key in CF                        | Properly deduplicated                               |
| Clock skew attacks        | Low      | `serverReceivedAt` is server-authoritative   | Client `createdAt` for intent only                  |
| Rate limit bypass         | Low      | Transaction-based counter                    | Counter resets every minute                         |
| Large payload abuse       | Low      | Text: 10K, attachments: 10MB×10, mentions: 5 | Validated in CF                                     |

Recommendations not yet implemented: Signed/expiring media URLs, server-side privacy enforcement, global rate limiting, automated content moderation, audit logging.

---

# PART 6: REAL-TIME & CONSISTENCY

## Message Ordering

`serverReceivedAt` (set by `FieldValue.serverTimestamp()` in CF) is the source of truth for ordering. Client `createdAt` used only for intent and optimistic display.

| Scenario                      | Guarantee                           | Mechanism                                           |
| ----------------------------- | ----------------------------------- | --------------------------------------------------- |
| Single user sends A then B    | A < B                               | Sequential CF calls; server timestamp monotonic     |
| Two users send simultaneously | Consistent order for both           | Server timestamps                                   |
| Optimistic message (outbox)   | May appear out of order temporarily | Reordered on server confirm                         |
| Edited messages               | Don't change position               | `editedAt` updated but `serverReceivedAt` preserved |

Query: `orderBy("serverReceivedAt", "desc").limit(50)`. Pagination uses `startAfter(oldestTimestamp)`.

## Idempotency

- **Message send**: `idempotencyKey = ${clientId}:${messageId}`. Server checks: exists + key matches → return existing; exists + key differs → conflict; not exists → write.
- **Reaction toggle**: Transaction checks `uids` array — present → remove, absent → add. Inherently idempotent.
- **Delete**: If already deleted, returns success.

## Deduplication

Client-side: `useUnifiedMessages` filters outbox items whose `messageId` exists in server messages.

Server-side: `idempotencyKey` check prevents duplicate writes.

Race condition handling:

```
T0: User sends → outbox item shown optimistically
T1: CF writes to Firestore
T2: onSnapshot fires → server message arrives
T3: useUnifiedMessages merges → removes outbox item, keeps server message
```

No duplication or flicker — content is identical.

## Retry & Error Handling

Outbox implements exponential backoff: attempt 1 immediate, attempt 2 +2s, attempt 3 +4s. After max retries: `state = "failed"`.

`useOutboxProcessor` runs at app root: checks `state === "queued"` and `nextRetryAt <= now`, processes each item. Users can tap failed messages to retry.

On network reconnection: `useNetworkStatus` fires callback → `useOutboxProcessor` processes pending → Firestore SDK re-establishes listeners → `NetworkBanner` dismisses.

## Race Conditions

| Race Condition          | Mitigation                                                            |
| ----------------------- | --------------------------------------------------------------------- |
| Simultaneous sends      | Independent CF calls; `serverReceivedAt` provides deterministic order |
| Edit while reading      | `onSnapshot` delivers edit                                            |
| Delete while replying   | Reply's `replyTo` is a snapshot; original shows "deleted"             |
| Send + block            | Depends on timing; block is prospective, not retroactive              |
| Outbox + app kill       | Outbox persisted to AsyncStorage; resumed on next launch              |
| Concurrent typing       | Each user writes to own `Members/{uid}.typingAt` — no conflict        |
| Rate limit counter race | Firestore transaction serializes concurrent updates                   |

## Performance

Each open chat maintains: 1 message subscription, 1 typing subscription, 1 presence subscription (RTDB), 1 read receipt subscription. Cleaned up on unmount.

- Messages loaded in pages of 50.
- `ChatMessageList` uses inverted `FlatList` with tuned `windowSize` and `maxToRenderPerBatch`.
- `DMMessageItem` uses `React.memo`.
- Reactions denormalized on message doc to avoid N+1 reads.

## Offline Behavior

- Firestore SDK has built-in offline persistence (enabled by default in RN).
- Outbox persists to AsyncStorage for write durability.
- `NetworkBanner` shows offline indicator.
- On reconnect: Firestore flushes pending writes, outbox processes pending items.
- SQLite mode (feature-flagged): zero-latency reads, bidirectional sync, server wins on conflict.

---

# PART 7: ERRORS & EDGE CASES

## Send Failures

| Error                      | Symptom                         | Mitigation                                                 |
| -------------------------- | ------------------------------- | ---------------------------------------------------------- |
| Network offline            | "sending" state indefinitely    | Outbox retries on reconnect; `NetworkBanner` shows offline |
| Rate limit (30/min)        | CF returns `resource-exhausted` | Error toast; outbox marks failed                           |
| Blocked by recipient       | CF returns `permission-denied`  | Generic error (doesn't reveal block)                       |
| Not a member               | CF returns `permission-denied`  | User removed from group or chat deleted                    |
| Text too long (>10K)       | CF returns `invalid-argument`   | Composer should prevent; CF validates                      |
| Too many attachments (>10) | CF returns `invalid-argument`   | `useAttachmentPicker` enforces limit                       |
| Idempotency conflict       | CF returns `already-exists`     | Extremely rare (UUID collision); regenerate ID             |

## Edit Failures

| Error                   | Detail                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Window expired (15 min) | Client check uses `Date.now()`, server uses `serverTimestamp` — possible edge mismatch |
| Non-text message        | Only `kind: "text"` can be edited; UI should hide "Edit" for others                    |
| Already deleted         | CF checks `deletedForAll`; returns error                                               |

## Delete Failures

| Error                             | Detail                                                     |
| --------------------------------- | ---------------------------------------------------------- |
| Delete-for-all without permission | DM: sender + window; Group: sender + window OR admin/owner |
| Delete-for-me fails               | Rules reject if `request.auth.uid` doesn't match           |

## Reaction Failures

| Error                       | Detail                                        |
| --------------------------- | --------------------------------------------- |
| Rate limited (10/min)       | Error; reaction not applied                   |
| Max emojis (12 per message) | CF returns `failed-precondition`              |
| Invalid emoji               | 16-emoji allowlist validated in CF and client |

## Subscription Failures

| Error                      | Detail                                                                        |
| -------------------------- | ----------------------------------------------------------------------------- |
| Permission denied          | User removed from group / chat deleted / token expired → `onSnapshot` error   |
| Listener detach failure    | `useEffect` cleanup returns `unsubscribe()`                                   |
| Stale data after reconnect | Firestore handles automatically; code doesn't use `metadata.hasPendingWrites` |

## Presence Edge Cases

- **RTDB disconnect not firing**: Network cut abruptly → user shows "online" for up to 60s. `onDisconnect()` handler eventually fires.
- **Multiple devices**: Single `status/{uid}` entry; last writer wins. No device-level presence.

## Typing Indicator Edge Cases

- **Stuck "on"**: App crash without clearing → `TYPING_TIMEOUT_MS = 8000` auto-clears on subscriber side.
- **Throttle delay**: `TYPING_THROTTLE_MS = 2000` limits updates. Up to 2s delay for indicator.

## Group Edge Cases

- **Owner leaves**: Must transfer ownership first; error if attempted.
- **Removed while chatting**: `onSnapshot` fires `permission-denied`; should navigate to inbox. No "you were removed" system message currently.
- **Group full**: 20 member limit checked before invite/add.
- **Invite expired**: 7-day expiry. Expired invites persist until accepted/declined.

## Scheduled Message Edge Cases

- **Delivery delay**: Up to 59 seconds past `scheduledFor` (cron-based).
- **Conversation deleted**: CF marks `status: "failed"`; user not proactively notified.
- **Blocked before delivery**: May not be checked by `processScheduledMessages`.

## Media Edge Cases

- **Upload fails mid-send**: Error; message not sent; attachments preserved in composer.
- **Orphaned files**: Upload succeeds but message send fails → file persists with no message. No cleanup job.
- **`attachments.ts` stubs**: File contains "H10" stub comments; some validation may be incomplete.

## V1/V2 Compatibility

- **Mixed schema**: Firestore has both V1-only (old) and V2 messages. `DMMessageItem.tsx` reads both field sets. `messageAdapters.ts` converts.
- **Legacy read field**: V1 `message.read: boolean` is per-message; V2 uses watermark-based read receipts. V2 ignores `read` field.

## Debugging Guide

| Issue                      | How to Debug                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Messages not appearing     | Check `onSnapshot` subscription (logger: `messageList`). Verify rules. Check `hiddenFor`. |
| Message stuck "sending"    | Check outbox via `getOutboxStats()`. Check network. Check CF logs.                        |
| Typing indicator stuck     | Check `Members/{uid}.typingAt` in Firestore. Wait 8s for auto-clear.                      |
| Read receipts not updating | Check `Members/{uid}.lastReadAtPublic`. Verify `sendReadReceipts` setting.                |
| Push notifications missing | Check `mutedUntil`. Check `expoPushToken`. Check CF logs for `onNewMessage`.              |
| Reactions not showing      | Check `Reactions/{emoji}` subcollection. Verify `reactionsSummary`. Check CF logs.        |

Logger tags: `useChat`, `useChatComposer`, `useUnifiedChatScreen`, `messageList`, `outbox`, `syncEngine`, `chatV2`, `presence`, `hooks/useLocalMessages`.

---

# PART 8: TESTING

## Existing Tests

| File                                                | Type        | Target                              |
| --------------------------------------------------- | ----------- | ----------------------------------- |
| `__tests__/hooks/useChatComposer.test.ts`           | Unit        | `useChatComposer` hook (~210 lines) |
| `__tests__/hooks/useUnifiedChatScreen.test.ts`      | Unit        | `useUnifiedChatScreen` hook         |
| `__tests__/integration/unifiedChat.test.ts`         | Integration | Unified chat flow (~330 lines)      |
| `__tests__/messaging/send.test.ts`                  | Unit        | `messaging/send.ts` (~170 lines)    |
| `__tests__/messaging/subscribe.test.ts`             | Unit        | `messaging/subscribe.ts`            |
| `__tests__/messaging/memberState.test.ts`           | Unit        | `messaging/memberState.ts`          |
| `__tests__/messaging/adapters/groupAdapter.test.ts` | Unit        | `groupAdapter.ts` V1↔V2 conversion  |

### What's Covered

- **useChatComposer**: text state, send enablement, mention handling, attachment state, reply sync, reset.
- **send.ts**: outbox enqueue, CF invocation, success/failure paths, retry, ID generation.
- **subscribe.ts**: DM/group subscription setup, unsubscribe cleanup, pagination cursors.
- **memberState.ts**: DM vs group routing, watermarks, typing, mute/archive.
- **groupAdapter.ts**: Legacy ↔ V2 conversion for all message types.
- **unifiedChat.test.ts**: Full send flow, message merge dedup, reply flow, error handling.

## Critical Test Gaps

| Area                     | Risk                                 |
| ------------------------ | ------------------------------------ |
| Backend Cloud Functions  | Server validation bugs undetected    |
| Firestore Security Rules | Authorization bugs could expose data |
| `useChat` hook           | Core message management untested     |
| `outbox.ts` service      | Offline reliability untested         |
| `messageList.ts`         | Pagination/subscription untested     |
| `messageActions.ts`      | Edit/delete untested                 |
| `reactions.ts`           | Reaction toggle untested             |
| Blocking integration     | Security-critical flow untested      |
| Components               | No snapshot or interaction tests     |

## Proposed Test Matrix (Priority Order)

### P0 — Services

- `outbox.ts`: enqueue, dequeue, retry, max retries, exponential backoff, persistence
- `messageList.ts`: subscribe, paginate, unsubscribe, error handling
- `messageActions.ts`: edit success/expired/non-text, delete-for-me, delete-for-all
- `reactions.ts`: toggle, max emojis, invalid emoji, rate limit

### P0 — Hooks

- `useChat`: init, message merge, send, pagination, reply state
- `useUnifiedMessages`: outbox merge, dedup, hiddenFor filter, sorting

### P0 — Backend CFs

- `sendMessageV2`: all validation paths, idempotency, rate limit
- `editMessageV2`: sender, window, kind, deleted checks
- `deleteMessageForAllV2`: sender, admin, window checks
- `toggleReactionV2`: toggle, rate limit, allowlist, max emojis

### P0 — Security Rules

- `Chats`: read member/non-member, create valid/invalid
- `Chats/Messages`: read, create, edit cases, delete-for-me
- `Chats/Members` & `MembersPrivate`: access control

### P1 — Integration

- Full DM send/receive cycle
- Outbox recovery after offline
- Edit + subscription update
- Block prevents send

---

# PART 9: CLEANUP PLAN

## Overview

The chat system carries debt from V1→V2 migration and experimental SQLite mode. 5 phases, ordered by risk.

## Phase 0 — Add Missing Tests (1–2 weeks)

Add backend CF tests, Firestore rules tests, `outbox.ts`/`messageList.ts`/`messageActions.ts`/`reactions.ts` unit tests, `useChat`/`useUnifiedMessages` hook tests.
Risk: Low (purely additive).

## Phase 1 — Remove V1 Dual Writes (1 week + 2 weeks monitor)

1. Add `LEGACY_WRITE_ENABLED` flag to `messaging.ts` guarding V1 writes.
2. Deploy with flag on. Confirm no V1 reads via Firestore audit logs.
3. Flip off, monitor 2 weeks. Remove V1 write code.
4. Deprecate `legacy.ts` (3261 lines): move needed helpers, delete rest.

**Risk: HIGH** — Must verify zero V1 reads before removing writes.

## Phase 2 — Remove V1 Client Types (1 week)

1. Replace all `Message`/`GroupMessage` imports with `MessageV2`.
2. Remove V1 chat types from `src/types/models.ts`.
3. Delete `groupAdapter.ts` and its tests.

**Risk: Medium** — Many files to update.

## Phase 3 — Remove SQLite Mode (2–3 days)

Remove: `messageRepository.ts`, `conversationRepository.ts`, `attachmentRepository.ts`, `database/models/`, `syncEngine.ts`, `useLocalMessages.ts`. Remove `USE_LOCAL_STORAGE` flag and `expo-sqlite` dependency.

**Risk: Low** — Flag already off, no production impact.

## Phase 4 — Service Layer Consolidation (3–5 days)

1. Finish `attachments.ts` stubs (H10 markers).
2. Merge `chatV2.ts` into `messaging/` module. Delete `chat.ts`.
3. Make `memberState.ts` the sole public API for member ops.

**Risk: Medium** — Import path changes.

## Phase 5 — Rename V2 Suffixes (1 week + staged deploy)

| Current                | Proposed         |
| ---------------------- | ---------------- |
| `MessageV2`            | `Message`        |
| `sendMessageV2` (CF)   | `sendMessage`    |
| `editMessageV2` (CF)   | `editMessage`    |
| `ChatListScreenV2`     | `ChatListScreen` |
| `useUnifiedChatScreen` | `useChatScreen`  |
| `useUnifiedMessages`   | `useMessages`    |

CF rename strategy: Deploy with both old and new names → ship client update → wait for adoption → delete old name.

**Risk: Medium** — CF callable mismatch requires coordinated deploy.

## Files to Delete (All Phases Complete)

| File                                              | Reason                 |
| ------------------------------------------------- | ---------------------- |
| `src/services/chat.ts`                            | V1 service replaced    |
| `src/services/chatV2.ts`                          | Merged into messaging/ |
| `src/services/messaging/adapters/groupAdapter.ts` | V1↔V2 adapter          |
| `src/services/database/repositories/*`            | SQLite mode            |
| `src/services/sync/syncEngine.ts`                 | SQLite mode            |
| `src/hooks/useLocalMessages.ts`                   | SQLite mode            |
| `firebase-backend/functions/src/legacy.ts`        | V1 triggers            |

**Est. lines removed**: ~4,000–5,000.

**Total estimated time**: 6–8 weeks with monitoring windows.

## Metrics to Track

| Metric                          | Target                    |
| ------------------------------- | ------------------------- |
| V1 collection read count        | 0 for 14 consecutive days |
| CF error rate post-deploy       | ≤ baseline                |
| Message delivery latency        | ≤ baseline                |
| Push notification delivery rate | ≥ baseline                |
| TypeScript compile errors       | 0                         |
| Test pass rate                  | 100%                      |

---

# PART 10: SYSTEM MAP

## All Files Involved

### UI Screens

| File                                             | Responsibility                 |
| ------------------------------------------------ | ------------------------------ |
| `src/screens/chat/ChatScreen.tsx`                | 1:1 DM chat screen             |
| `src/screens/chat/ChatListScreenV2.tsx`          | Inbox / conversation list      |
| `src/screens/chat/ChatSettingsScreen.tsx`        | Per-chat settings              |
| `src/screens/chat/ScheduledMessagesScreen.tsx`   | View/manage scheduled messages |
| `src/screens/chat/SnapViewerScreen.tsx`          | Full-screen snap/media viewer  |
| `src/screens/chat/InboxSearchScreen.tsx`         | Search within inbox            |
| `src/screens/chat/InboxSettingsScreen.tsx`       | Global inbox settings          |
| `src/screens/groups/GroupChatScreen.tsx`         | Group chat conversation        |
| `src/screens/groups/GroupChatInfoScreen.tsx`     | Group member management        |
| `src/screens/groups/GroupChatCreateScreen.tsx`   | Create new group               |
| `src/screens/groups/GroupInvitesScreen.tsx`      | Pending group invites          |
| `src/screens/settings/BlockedUsersScreen.tsx`    | Manage blocked users           |
| `src/screens/settings/PrivacySettingsScreen.tsx` | Global privacy settings        |

### Chat Components (27)

`ChatComposer.tsx`, `ChatMessageList.tsx`, `ChatSkeleton.tsx`, `ChatGameInvites.tsx`, `TypingIndicator.tsx`, `MessageActionsSheet.tsx`, `MessageHighlightOverlay.tsx`, `SwipeableMessage.tsx`, `SwipeableMessageWrapper.tsx`, `VoiceMessagePlayer.tsx`, `VoiceRecordButton.tsx`, `AttachmentGrid.tsx`, `AttachmentTray.tsx`, `CameraLongPressButton.tsx`, `DuckBubble.tsx`, `DuckIcon.tsx`, `LinkPreviewCard.tsx`, `MediaViewerModal.tsx`, `MentionAutocomplete.tsx`, `NetworkBanner.tsx`, `ReactionBar.tsx`, `ReactionDetailSheet.tsx`, `ReplyBubbleNew.tsx`, `ReplyPreviewBar.tsx`, `ReturnToBottomPill.tsx`, `ScrollReturnButton.tsx`, `SeenBySheet.tsx`

### Inbox Components (14)

`ConversationItem.tsx`, `ConversationContextMenu.tsx`, `SwipeableConversation.tsx`, `DeleteConfirmDialog.tsx`, `EmptyState.tsx`, `FriendRequestItem.tsx`, `GroupInviteItem.tsx`, `InboxFAB.tsx`, `InboxHeader.tsx`, `InboxTabs.tsx`, `MuteOptionsSheet.tsx`, `PinnedSection.tsx`, `ProfilePreviewModal.tsx`

### Other Components

`DMMessageItem.tsx`, `ScheduleMessageModal.tsx`, `BlockUserModal.tsx`, `ReportUserModal.tsx`, `ChatBubblePreview.tsx`

### Hooks (19)

`useChat.ts` (632 lines), `useChatComposer.ts` (771 lines), `useUnifiedChatScreen.ts` (365 lines), `useConversationActions.ts`, `useLocalMessages.ts`, `useUnifiedMessages.ts`, `useReadReceipts.ts`, `useTypingStatus.ts`, `usePresence.ts`, `useLinkPreviews.ts`, `useAttachmentPicker.ts`, `useVoiceRecorder.ts`, `useMentionAutocomplete.ts`, `useOutboxProcessor.ts`, `useInboxData.ts`, `useNetworkStatus.ts`, `useChatKeyboard.ts`, `useNewMessageAutoscroll.ts`, `useAtBottom.ts`

### Services (24+)

`chat.ts`, `chatV2.ts`, `chatMembers.ts`, `messageList.ts`, `messageActions.ts`, `outbox.ts`, `reactions.ts`, `presence.ts`, `attachments.ts`, `storage.ts`, `mediaCache.ts`, `linkPreview.ts`, `mentionParser.ts`, `blocking.ts`, `reporting.ts`, `moderation.ts`, `inboxSettings.ts`, `scheduledMessages.ts`, `groups.ts`, `groupMembers.ts`, `notifications.ts`, `messaging/send.ts`, `messaging/subscribe.ts`, `messaging/memberState.ts`, `messaging/adapters/groupAdapter.ts`

### Types

`src/types/messaging.ts` (V2, 742 lines), `src/types/models.ts` (V1, 992 lines)

### Backend

`firebase-backend/functions/src/messaging.ts` (1236 lines, 4 CFs), `firebase-backend/functions/src/legacy.ts` (3261 lines, triggers + crons), `firebase-backend/functions/src/linkPreview.ts`, `firebase-backend/functions/src/utils.ts`, `firebase-backend/firestore.rules` (2249 lines), `firebase-backend/storage.rules` (208 lines), `firebase-backend/firestore.indexes.json` (679 lines)

### Feature Flags

`constants/featureFlags.ts`: `USE_LOCAL_STORAGE` (SQLite mode), `USE_CHAT_V2` (V2 pipeline, currently `true`)

---

# TRUTH TABLE

| Feature         | Implemented In                                   | Source of Truth                 | Consistency Model          | Failure Behavior                       | Known Issues                             |
| --------------- | ------------------------------------------------ | ------------------------------- | -------------------------- | -------------------------------------- | ---------------------------------------- |
| Send text       | `useChat` → `messaging/send` → `chatV2` → CF     | Server (`serverReceivedAt`)     | Optimistic + outbox retry  | "sending" → retries → "failed" after 3 | Dual V1/V2 pipeline exists               |
| Receive message | `useUnifiedMessages` → `messageList` → Firestore | Server (Firestore)              | Real-time subscription     | Stale list; NetworkBanner offline      | Listener count unbounded                 |
| Edit message    | `messageActions` → CF `editMessageV2`            | Server (15-min window)          | Confirmed (no optimistic)  | Error toast; original preserved        | Client/server clock mismatch at boundary |
| Delete for all  | `messageActions` → CF                            | Server (`deletedForAll` marker) | Confirmed                  | Error toast                            | Group admins can delete any msg          |
| Delete for me   | `messageActions` → client Firestore write        | Client (`hiddenFor[]`)          | Optimistic                 | Rules validate auth.uid                | Direct write, no CF                      |
| Reactions       | `reactions` → CF `toggleReactionV2`              | Server (transaction)            | Confirmed + denormalized   | Error; stale count briefly             | 16-emoji allowlist hardcoded             |
| Read receipts   | `useReadReceipts` → `chatMembers`                | Member subcollection            | Eventually consistent      | Delayed by seconds                     | Respects privacy setting                 |
| Typing          | `useTypingStatus` → `chatMembers`                | Member subcollection            | Eventually consistent (8s) | Auto-clears                            | 2s throttle                              |
| Presence        | `usePresence` → RTDB                             | RTDB + `onDisconnect`           | Real-time                  | "last seen" fallback                   | Respects privacy setting                 |
| Attachments     | `useAttachmentPicker` → Storage                  | Storage URLs                    | Upload then send           | Upload failure blocks send             | Stubs in attachments.ts                  |
| Voice           | `useVoiceRecorder` → `snapMessageService`        | Storage URL                     | Upload then send           | Recording lost on error                | Separate from main pipeline              |
| Link previews   | `useLinkPreviews` → client/CF                    | Firestore cache (24h TTL)       | Eventually consistent      | URL-only display fallback              |                                          |
| @Mentions       | `useMentionAutocomplete` → `mentionParser`       | Client (in message)             | Sent with message          | Used for push notify                   | Max 5 per message                        |
| Scheduled msgs  | `scheduledMessages` → CF cron (1min)             | ScheduledMessages collection    | Server delivers            | Up to 59s late; marks failed           | 30-day cleanup                           |
| Pinning         | `useConversationActions` → members               | `pinnedAt` in MembersPrivate    | Optimistic                 | Error toast + revert                   | Max 5 pinned                             |
| Muting          | `useConversationActions` → members               | `mutedUntil` in MembersPrivate  | Optimistic                 | Error toast                            | Backend checks before push               |
| Blocking        | `blocking.ts` → Firestore                        | `blockedUsers` subcollection    | Confirmed                  | CF rejects sends                       | Auto-cancels friend requests             |
| Group invites   | `groups.ts` → GroupInvites                       | Firestore                       | Confirmed                  | Expires after 7 days                   |                                          |
