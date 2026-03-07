# Inbox & Chat System - Data Contracts

Last verified: 2026-03-05
Status: Canonical contracts aligned across runtime modes

## 1) Contract Sources

Client contract authorities:

- `src/types/messaging.ts`
- `src/services/chat/normalizeMessage.ts`
- `src/services/chat/normalizeInboxRow.ts`
- `src/services/chat/unifiedInboxRequests.ts`
- `src/services/notifications/normalizeNotification.ts`

Backend contract authorities:

- `firebase-backend/functions/src/messaging.ts`
- `firebase-backend/functions/src/inboxTriggers.ts`
- `firebase-backend/functions/src/messageRequests.ts`
- `firebase-backend/functions/src/notifications.ts`

## 2) Canonical Message Contract (`MessageV2`)

Type source: `src/types/messaging.ts`

```ts
interface MessageV2 {
  id: string;
  scope: "dm" | "group";
  conversationId: string;
  senderId: string;
  senderName?: string;
  kind: "text" | "media" | "voice" | "file" | "system" | "animal";

  text?: string;
  animalId?: string;

  createdAt: number;
  serverReceivedAt: number;
  editedAt?: number;

  replyTo?: ReplyToMetadata;
  threadRootId?: string | null;
  replyCount?: number;
  lastReplyAt?: number;

  attachments?: AttachmentV2[];
  mentionUids?: string[];
  mentionSpans?: MentionSpan[];
  reactionsSummary?: Record<string, number>;

  deletedForAll?: { by: string; at: number };
  hiddenFor?: string[];
  linkPreview?: LinkPreviewV2;

  clientId: string;
  idempotencyKey: string;

  senderStyle?: {
    bubbleColorId?: string | null;
    bubbleColorHex?: string | null;
    fontId?: string | null;
    fontKey?: string | null;
    animalThemeId?: string | null;
    v: 1;
  };

  // legacy compatibility fields still present on some docs
  status?: "sending" | "sent" | "delivered" | "failed";
  isLocal?: boolean;
}
```

Normalization boundaries:

- SQLite row to `MessageV2`: `normalizeMessageFromLocalRow`
- Firestore doc to `MessageV2`: `normalizeMessageFromFirestoreDoc`

Both functions are implemented in `src/services/chat/normalizeMessage.ts`.

## 3) Message Ordering and Dedupe Contract

Canonical ordering:

1. `serverReceivedAt` descending
2. `createdAt` descending
3. `id` descending

Canonical dedupe identity:

- primary key: `message.id`

Conflict resolution:

- newer canonical timestamp wins
- if timestamps tie, non-local/server-confirmed versions win over local optimistic versions

Implementation:

- `compareMessagesCanonicalDesc`
- `dedupeAndSortMessages`
- `mergeMessageCollections`

All defined in `src/services/chat/normalizeMessage.ts`.

## 4) Message Status Lifecycle Contract

UI-visible lifecycle:

1. `sending`
- optimistic/local outbox phase
2. `failed`
- outbox write failed or callable failed
3. `sent`
- server ack or realtime authoritative snapshot

Important note:

- canonical contract is timestamp and identity based; `status` is advisory UI state and must not control ordering.

## 5) Reply/Thread Contract

Reply metadata shape (`ReplyToMetadata`):

```ts
interface ReplyToMetadata {
  messageId: string;
  senderId: string;
  senderName?: string;
  kind: MessageKind;
  textSnippet?: string;
  attachmentPreview?: {
    kind: "image" | "video" | "audio" | "file";
    thumbUrl?: string;
  };
}
```

Thread root behavior:

- `threadRootId` points to root message id for all replies in a thread
- root message carries `replyCount` and `lastReplyAt`

## 6) Canonical Inbox Row Contract (`InboxConversation`)

Type source: `src/types/messaging.ts`

```ts
interface InboxConversation {
  id: string;
  type: "dm" | "group";
  name: string;
  avatarUrl: string | null;

  avatarConfig?: AvatarConfig;
  profilePictureUrl?: string | null;
  decorationId?: string | null;
  avatarIds?: string[];

  otherUserId?: string;
  participantCount?: number;

  lastMessage: {
    text: string;
    senderName: string;
    timestamp: number;
    type: "text" | "image" | "voice" | "attachment";
  } | null;

  memberState: MemberStatePrivate;
  unreadCount: number;
  hasMentions: boolean;
  isOnline?: boolean;
  createdAt: number;
}
```

Construction paths:

- fan-out mode:
  - `normalizeFanoutDMConversation`
  - `normalizeFanoutGroupConversation`
  - file: `src/services/chat/fanoutInboxNormalization.ts`
- aggregated mode:
  - `normalizeConversationFromInboxEntry`
  - file: `src/services/chat/normalizeInboxRow.ts`

## 7) Aggregated Inbox Entry Contract (`InboxEntry`)

Type source: `src/types/messaging.ts`

Path:

- `Users/{uid}/Inbox/{threadId}`

Key fields:

```ts
interface InboxEntry {
  threadId: string;               // dm:{chatId} or group:{groupId}
  scope: "dm" | "group";
  conversationId: string;
  lastActivityAt: number;
  lastSenderId: string;
  lastMessageKind: string;
  lastMessagePreview: string;
  unreadCount: number;
  unreadSince?: number;

  pinnedAt?: number | null;
  archived: boolean;
  mutedUntil?: number | null;
  notifyLevel: "all" | "mentions" | "none";

  groupName?: string;
  avatarPath?: string;
  memberCount?: number;

  otherUserName?: string;
  otherUserId?: string;
}
```

Write source:

- server triggers in `firebase-backend/functions/src/inboxTriggers.ts`

## 8) Member State Contract

Private state (`MembersPrivate/{uid}`) is authoritative for inbox behavior:

```ts
interface MemberStatePrivate {
  uid: string;
  archived?: boolean;
  mutedUntil?: number | null;
  notifyLevel?: "all" | "mentions" | "none";

  sendReadReceipts?: boolean;
  lastSeenAtPrivate: number;
  lastMarkedUnreadAt?: number;

  pinnedAt?: number | null;
  deletedAt?: number | null;
  hiddenUntilNewMessage?: boolean;

  showMemberChatStyles?: boolean;
}
```

Public state (`Members/{uid}`) publishes read/delivery/typing markers if enabled.

## 9) Unread State Contract

Canonical unread function:

- `computeUnreadCount` in `src/services/chat/normalizeInboxRow.ts`

Inputs:

- `lastActivityAt`
- `memberState.lastSeenAtPrivate`
- `memberState.lastMarkedUnreadAt`
- optional `recentlyReadAt` (local optimistic read cache)
- optional `unreadHintCount` (aggregated fallback)

Rules (in order):

1. If `recentlyReadAt` is within TTL, unread is `0`.
2. If `lastMarkedUnreadAt > lastSeenAtPrivate`, unread is `1`.
3. If `lastActivityAt > lastSeenAtPrivate + tolerance`, unread is `1`.
4. If no private watermark and hint count exists, unread is `1`.
5. Otherwise unread is `0`.

## 10) Unified Requests Contract

Unified item type:

```ts
type UnifiedInboxRequestItem =
  | {
      id: string;
      kind: "friend_request";
      createdAt: number;
      friendRequest: FriendRequestWithUser;
    }
  | {
      id: string;
      kind: "group_invite";
      createdAt: number;
      groupInvite: GroupInvite;
    }
  | {
      id: string;
      kind: "message_request";
      createdAt: number;
      messageRequest: MessageRequest;
    };
```

Merge semantics (`mergeUnifiedInboxRequests`):

- dedupe key: `${kind}:${id}`
- sort: `createdAt desc`, then `id asc`

## 11) Message Request Contract

Type source: `src/types/messaging.ts`

```ts
interface MessageRequest {
  chatId: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarConfig?: unknown;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
  resolvedAt?: number;
  messagePreview: string;
  messageKind: string;
}
```

Callable response contract:

```ts
interface MessageRequestResponse {
  success: boolean;
}
```

Validation helpers:

- `decodeMessageRequest`
- `isMessageRequestResponse`
- `callAcceptMessageRequest`
- `callDeclineMessageRequest`

## 12) Canonical Notification Contract

Adapter output type (`src/services/notifications/normalizeNotification.ts`):

```ts
interface CanonicalNotification {
  type:
    | "message"
    | "group_message"
    | "friend_request"
    | "game_turn"
    | "achievement_unlocked";
  dedupeKey: string;
  route: {
    screen:
      | "ChatDetail"
      | "GroupChat"
      | "Connections"
      | "GamePlayV4"
      | "AchievementSection"
      | "AchievementsHub";
    params?: Record<string, unknown>;
  };
}
```

Dedupe helper contract:

- `shouldHandleNotificationByDedupeKey(map, dedupeKey, now, windowMs)`
- default window: `NOTIFICATION_DEDUPE_WINDOW_MS = 1500`

## 13) JSON Examples

## 13.1 Canonical text message

```json
{
  "id": "msg_01",
  "scope": "dm",
  "conversationId": "chat_abc",
  "senderId": "uid_b",
  "kind": "text",
  "text": "hello",
  "createdAt": 1741170000000,
  "serverReceivedAt": 1741170001200,
  "clientId": "device_1",
  "idempotencyKey": "device_1:msg_01"
}
```

## 13.2 Canonical inbox row

```json
{
  "id": "chat_abc",
  "type": "dm",
  "name": "Taylor",
  "avatarUrl": null,
  "otherUserId": "uid_taylor",
  "lastMessage": {
    "text": "See you soon",
    "senderName": "",
    "timestamp": 1741171000000,
    "type": "text"
  },
  "memberState": {
    "uid": "uid_me",
    "archived": false,
    "notifyLevel": "all",
    "lastSeenAtPrivate": 1741170500000
  },
  "unreadCount": 1,
  "hasMentions": false,
  "createdAt": 1741171000000
}
```

## 13.3 Canonical normalized notification

```json
{
  "type": "group_message",
  "dedupeKey": "group_message:group_42",
  "route": {
    "screen": "GroupChat",
    "params": {
      "groupId": "group_42",
      "groupName": "Project Team"
    }
  }
}
```

## 14) Versioning and Migration Notes

- Dual runtime (SQLite-first + Firestore fallback) remains intentional.
- Parity is enforced by shared normalizers and merge helpers, not by removing fallback paths.
- Aggregated inbox remains feature-flagged but now uses `MembersPrivate` to avoid unread drift.
- Legacy payload formats are tolerated at adapter boundaries only; internal code should use canonical types.
