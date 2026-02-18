# Chat Data Model

> Complete schema documentation for all Firestore collections, SQLite tables, and TypeScript types used by the chat system.

---

## 1. Firestore Collections Overview

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

---

## 2. Collection Schemas

### 2.1. `Chats/{chatId}`

**Purpose**: Represents a 1:1 DM conversation between two users.

**Path**: `Chats/{chatId}` where `chatId` = deterministic ID from sorted UIDs (via `generateChatId()`)

**Source**: `src/services/chat.ts` → `generateChatId()`, `getOrCreateChat()`
**Type**: `Chat` in `src/types/models.ts`

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

**Security rules**: Read requires `request.auth.uid in resource.data.members`. Create requires `members.size() == 2`. Members array cannot be changed after creation.

---

### 2.2. `Chats/{chatId}/Messages/{messageId}`

**Purpose**: Individual messages within a DM conversation.

**Source**: `MessageV2` in `src/types/messaging.ts` (active), `Message` in `src/types/models.ts` (legacy)

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
| `isLocal`          | `boolean`                      | V1    | **Deprecated** — outbox handles                                                      |
| `expiresAt`        | `number`                       | V1    | **Deprecated**                                                                       |

**Note**: The Cloud Function `sendMessageV2` writes **both V1 and V2 fields** for backward compatibility (see `firebase-backend/functions/src/messaging.ts` line ~550).

---

### 2.3. `Chats/{chatId}/Messages/{messageId}/Reactions/{emoji}`

**Purpose**: Per-emoji reaction tracking on a message.

**Source**: `ReactionDoc` in `src/types/messaging.ts`

```json
{
  "emoji": "🔥",
  "uids": ["abc123", "def456"],
  "updatedAt": 1708099300000
}
```

| Field       | Type       | Description                       |
| ----------- | ---------- | --------------------------------- |
| `emoji`     | `string`   | Emoji character (doc ID)          |
| `uids`      | `string[]` | Users who reacted with this emoji |
| `updatedAt` | `number`   | Last modification timestamp       |

**Allowed emojis** (hardcoded in CF `toggleReactionV2`): `❤️`, `🔥`, `😂`, `😮`, `😢`, `👍`, `👎`, `🎉`, `💯`, `🙏`, `😍`, `🤔`, `👀`, `💀`, `🫡`, `🦆`

**Limits**: Max 12 unique emoji types per message (`MAX_REACTIONS_PER_MESSAGE`). Rate: 10 reactions/minute.

---

### 2.4. `Chats/{chatId}/Members/{uid}`

**Purpose**: Public member state visible to the other chat participant.

**Source**: `MemberStatePublic` in `src/types/messaging.ts`, managed by `src/services/chatMembers.ts`

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

---

### 2.5. `Chats/{chatId}/MembersPrivate/{uid}`

**Purpose**: Private member settings — only readable/writable by the owning user.

**Source**: `MemberStatePrivate` in `src/types/messaging.ts`, managed by `src/services/chatMembers.ts`

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
| `uid`                   | `string`                         | User ID (doc ID)                             |
| `archived`              | `boolean?`                       | Conversation archived                        |
| `mutedUntil`            | `number \| null`                 | Mute expiry (null = not muted, -1 = forever) |
| `notifyLevel`           | `"all" \| "mentions" \| "none"?` | Notification preference                      |
| `customNotifications`   | `{ push, inApp }?`               | Per-channel notification toggles             |
| `sendReadReceipts`      | `boolean?`                       | Whether to publish read receipts             |
| `lastSeenAtPrivate`     | `number`                         | Last time user viewed this chat (private)    |
| `lastMarkedUnreadAt`    | `number?`                        | Manual "mark as unread" timestamp            |
| `pinnedAt`              | `number \| null`                 | Pin timestamp (null = not pinned)            |
| `deletedAt`             | `number \| null`                 | Soft delete timestamp                        |
| `hiddenUntilNewMessage` | `boolean?`                       | Hide from inbox until new message arrives    |

---

### 2.6. `Groups/{groupId}`

**Purpose**: Group conversation metadata.

**Source**: `Group` in `src/types/models.ts`, managed by `src/services/groups.ts`

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

| Field                 | Type       | Description                                   |
| --------------------- | ---------- | --------------------------------------------- |
| `id`                  | `string`   | Document ID                                   |
| `name`                | `string`   | Group display name (max 50 chars)             |
| `ownerId`             | `string`   | Creator/owner UID                             |
| `memberIds`           | `string[]` | All member UIDs (denormalized for fast query) |
| `memberCount`         | `number`   | Member count                                  |
| `avatarPath`          | `string?`  | Storage path for group avatar                 |
| `avatarUrl`           | `string?`  | Public URL for group avatar                   |
| `createdAt`           | `number`   | Creation timestamp                            |
| `updatedAt`           | `number`   | Last update timestamp                         |
| `lastMessageText`     | `string?`  | Preview of last message                       |
| `lastMessageAt`       | `number?`  | Timestamp of last message                     |
| `lastMessageSenderId` | `string?`  | Sender of last message                        |

**Limits**: `GROUP_LIMITS` in `src/types/models.ts`:

- Min members: 3
- Max members: 20
- Max name length: 50
- Invite expiry: 7 days

---

### 2.7. `Groups/{groupId}/Messages/{messageId}`

Same schema as DM messages (`MessageV2`), but with `scope: "group"`.

Legacy `GroupMessage` type in `src/types/models.ts` adds group-specific fields:

| Field                | Type                                        | Description                                                   |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `groupId`            | `string`                                    | Parent group ID                                               |
| `senderDisplayName`  | `string`                                    | Sender name                                                   |
| `senderAvatarConfig` | `AvatarConfig?`                             | Avatar snapshot                                               |
| `systemType`         | `string?`                                   | System message type: `"member_joined"`, `"member_left"`, etc. |
| `systemMeta`         | `object?`                                   | System message metadata                                       |
| `voiceMetadata`      | `{ durationMs, storagePath?, sizeBytes? }?` | Voice message info                                            |

The `groupAdapter.ts` converts between `GroupMessage` ↔ `MessageV2`.

---

### 2.8. `Groups/{groupId}/Members/{uid}` and `MembersPrivate/{uid}`

Same structure as DM Members/MembersPrivate, managed by `src/services/groupMembers.ts`.

Additional group-specific behavior:

- `role` field is actively used: `"owner"`, `"admin"`, `"member"`
- Owners can change roles, admins can remove members
- `GroupMember` type in `src/types/models.ts` includes `displayName`, `username`, `avatarConfig`, `profilePictureUrl`

---

### 2.9. `GroupInvites/{inviteId}`

**Purpose**: Pending group invitations.

**Source**: `GroupInvite` in `src/types/models.ts`

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

---

### 2.10. `ScheduledMessages/{messageId}`

**Purpose**: Messages scheduled for future delivery.

**Source**: `src/services/scheduledMessages.ts`

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
  "updatedAt": 1708012800000,
  "deliveredAt": null,
  "deliveredMessageId": null,
  "failureReason": null
}
```

**Statuses**: `"pending"` → `"sent"` or `"failed"` or `"cancelled"`

**Processing**: CF `processScheduledMessages` runs every 1 minute, queries pending where `scheduledFor <= now`, delivers to appropriate Messages subcollection.

---

### 2.11. `Users/{uid}/blockedUsers/{blockedUid}`

**Purpose**: Block list per user.

**Source**: `BlockedUser` in `src/types/models.ts`, managed by `src/services/blocking.ts`

```json
{
  "blockedUserId": "def456",
  "blockedAt": 1708012800000,
  "reason": "Harassment"
}
```

---

### 2.12. `Users/{uid}/settings/inboxSettings`

**Purpose**: Per-user inbox preferences.

**Source**: `InboxSettings` in `src/types/messaging.ts`, managed by `src/services/inboxSettings.ts`

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

---

### 2.13. RTDB: `status/{uid}`

**Purpose**: Online/offline presence.

**Source**: `src/services/presence.ts`

```json
{
  "online": true,
  "lastSeen": 1708099200000
}
```

Uses Firebase RTDB `onDisconnect()` to automatically set `online: false` and update `lastSeen` when client disconnects.

---

## 3. Reaction Subcollection

Each message can have reactions stored in `Messages/{messageId}/Reactions/{emoji}`:

```
Messages/
└── msg_abc/
    └── Reactions/
        ├── ❤️     → { emoji: "❤️", uids: ["user1", "user2"], updatedAt: ... }
        ├── 🔥     → { emoji: "🔥", uids: ["user1"], updatedAt: ... }
        └── 😂     → { emoji: "😂", uids: ["user3"], updatedAt: ... }
```

The denormalized `reactionsSummary` on the parent message doc (`{ "❤️": 2, "🔥": 1, "😂": 1 }`) is updated transactionally by the CF `toggleReactionV2`.

---

## 4. Attachment Schema

**Source**: `AttachmentV2` in `src/types/messaging.ts`

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
  "thumbPath": "pictures/chatId/thumb_att_xyz.jpg",
  "caption": "Check out this view!",
  "viewOnce": false,
  "expiresAt": null
}
```

**Storage paths**:

- DM images: `pictures/{chatId}/{filename}`
- DM voice: `dm-voice/{chatId}/{filename}`
- Group images: `groups/{groupId}/messages/{filename}`
- Group attachments: `groups/{groupId}/attachments/{filename}`
- Group voice: `groups/{groupId}/voice/{filename}`

---

## 5. Link Preview Schema

**Source**: `LinkPreviewV2` in `src/types/messaging.ts`

```json
{
  "url": "https://example.com/article",
  "canonicalUrl": "https://example.com/article",
  "title": "Example Article",
  "description": "A fascinating read about...",
  "siteName": "Example.com",
  "imageUrl": "https://example.com/og-image.jpg",
  "fetchedAt": 1708012800000,
  "expiresAt": 1708099200000
}
```

Cached in Firestore `LinkPreviews/{urlHash}` by the CF `fetchLinkPreviewFunction` with a 24-hour TTL. Client also caches in memory via `src/services/linkPreview.ts`.

---

## 6. Reply Thread Schema

**Source**: `ReplyToMetadata` in `src/types/messaging.ts`

```json
{
  "messageId": "msg_original",
  "senderId": "def456",
  "senderName": "Bob",
  "kind": "text",
  "textSnippet": "Hey, want to play mini golf?",
  "attachmentPreview": null
}
```

Replies are **flat** — not nested threads. Each message can have at most one `replyTo` reference. The snippet is truncated to 100 chars (`REPLY_SNIPPET_MAX_LENGTH`).

---

## 7. Outbox Schema (Client-Side, AsyncStorage)

**Source**: `OutboxItem` in `src/types/messaging.ts`, managed by `src/services/outbox.ts`

```json
{
  "messageId": "msg_local_abc",
  "scope": "dm",
  "conversationId": "abc123_def456",
  "kind": "text",
  "text": "Hello!",
  "replyTo": null,
  "mentionUids": [],
  "localAttachments": [],
  "createdAt": 1708099200000,
  "attemptCount": 0,
  "nextRetryAt": 1708099200000,
  "state": "queued",
  "lastError": null
}
```

**States**: `"queued"` → `"uploading"` → `"sending"` → removed (success) or → `"failed"`

Retry logic uses exponential backoff. Max retries before marking as permanently failed is managed by `outbox.ts`.

---

## 8. Composite Indexes

**Source**: `firebase-backend/firestore.indexes.json`

Key chat-related indexes:

| Collection          | Fields                                                   | Query Pattern                                |
| ------------------- | -------------------------------------------------------- | -------------------------------------------- |
| `Chats`             | `members` (CONTAINS) + `lastMessageAt` (DESC)            | Inbox: user's conversations sorted by recent |
| `Groups`            | `memberIds` (CONTAINS) + `lastMessageAt` (DESC)          | Inbox: user's groups sorted by recent        |
| `Groups`            | `memberIds` (CONTAINS) + `updatedAt` (DESC)              | Group list sorted by activity                |
| `Messages`          | `mentionUids` (CONTAINS) + `serverReceivedAt` (DESC)     | Unread mentions query                        |
| `Members`           | `uid` (ASC) + `joinedAt` (DESC)                          | Collection group: all chats for a user       |
| `GroupInvites`      | `toUid` (ASC) + `status` (ASC) + `createdAt` (DESC)      | Pending invites for user                     |
| `GroupInvites`      | `groupId` (ASC) + `toUid` (ASC) + `status` (ASC)         | Check existing invite                        |
| `ScheduledMessages` | `senderId` (ASC) + `status` (ASC) + `scheduledFor` (ASC) | User's pending scheduled                     |
| `ScheduledMessages` | `status` (ASC) + `scheduledFor` (ASC)                    | CF: process pending messages                 |
| `Reports`           | `status` (ASC) + `createdAt` (DESC)                      | Admin: pending reports                       |

---

## 9. SQLite Schema (Feature-Flagged)

When `USE_LOCAL_STORAGE` is enabled, the SQLite database mirrors Firestore.

**Source**: `src/services/database/messageRepository.ts`, `src/services/database/conversationRepository.ts`

### conversations table

| Column            | Type    | Description            |
| ----------------- | ------- | ---------------------- |
| `id`              | TEXT PK | Conversation ID        |
| `scope`           | TEXT    | "dm" or "group"        |
| `name`            | TEXT    | Display name           |
| `lastMessageAt`   | INTEGER | Last message timestamp |
| `lastMessageText` | TEXT    | Preview text           |
| `unreadCount`     | INTEGER | Unread message count   |
| `syncVersion`     | INTEGER | Last sync version      |
| `archived`        | INTEGER | Boolean flag           |
| `muted`           | INTEGER | Boolean flag           |
| `pinnedAt`        | INTEGER | Pin timestamp          |
| `deletedAt`       | INTEGER | Soft delete timestamp  |
| `createdAt`       | INTEGER | Creation timestamp     |

### messages table

| Column                 | Type        | Description                     |
| ---------------------- | ----------- | ------------------------------- |
| `id`                   | TEXT PK     | Message ID                      |
| `conversationId`       | TEXT FK     | Parent conversation             |
| `scope`                | TEXT        | "dm" or "group"                 |
| `senderId`             | TEXT        | Sender UID                      |
| `senderName`           | TEXT        | Denormalized name               |
| `kind`                 | TEXT        | Message type                    |
| `text`                 | TEXT        | Message content                 |
| `createdAt`            | INTEGER     | Client timestamp                |
| `serverReceivedAt`     | INTEGER     | Server timestamp                |
| `editedAt`             | INTEGER     | Edit timestamp                  |
| `replyToJson`          | TEXT        | JSON-serialized ReplyToMetadata |
| `mentionUidsJson`      | TEXT        | JSON array of UIDs              |
| `reactionsSummaryJson` | TEXT        | JSON object                     |
| `hiddenForJson`        | TEXT        | JSON array                      |
| `deletedForAllJson`    | TEXT        | JSON object                     |
| `linkPreviewJson`      | TEXT        | JSON object                     |
| `clientId`             | TEXT        | Device ID                       |
| `idempotencyKey`       | TEXT UNIQUE | Dedup key                       |
| `syncStatus`           | TEXT        | "pending", "synced", "failed"   |
| `syncError`            | TEXT        | Last sync error                 |
| `attemptCount`         | INTEGER     | Retry count                     |

### attachments table

| Column           | Type    | Description                         |
| ---------------- | ------- | ----------------------------------- |
| `id`             | TEXT PK | Attachment ID                       |
| `messageId`      | TEXT FK | Parent message                      |
| `kind`           | TEXT    | "image", "video", etc.              |
| `mime`           | TEXT    | MIME type                           |
| `url`            | TEXT    | Remote URL                          |
| `path`           | TEXT    | Storage path                        |
| `localUri`       | TEXT    | Local file URI                      |
| `sizeBytes`      | INTEGER | File size                           |
| `width`          | INTEGER | Image width                         |
| `height`         | INTEGER | Image height                        |
| `durationMs`     | INTEGER | Audio/video duration                |
| `thumbUrl`       | TEXT    | Thumbnail URL                       |
| `uploadStatus`   | TEXT    | "pending", "uploaded", "failed"     |
| `downloadStatus` | TEXT    | "none", "downloading", "downloaded" |
