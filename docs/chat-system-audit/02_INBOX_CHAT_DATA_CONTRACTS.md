# Inbox & Chat System - Data Contracts

Last verified: 2026-03-05

## 1) Canonical Type Sources

Primary client contracts:

- `src/types/messaging.ts`
- `src/types/models.ts` (legacy compatibility shapes still referenced)

Primary server contract source:

- `firebase-backend/functions/src/messaging.ts` (`SendMessageV2Input`)

## 2) Message Contract (V2)

Type: `MessageV2` (`src/types/messaging.ts`)

Required core fields:

- `id: string`
- `scope: "dm" | "group"`
- `conversationId: string`
- `senderId: string`
- `kind: "text" | "media" | "voice" | "file" | "system" | "animal"`
- `createdAt: number`
- `serverReceivedAt: number`
- `clientId: string`
- `idempotencyKey: string`

Optional/feature fields:

- `text`, `animalId`
- `replyTo`, `threadRootId`, `replyCount`, `lastReplyAt`
- `attachments[]`
- `mentionUids`, `mentionSpans`
- `reactionsSummary`
- `senderStyle`
- `deletedForAll`, `hiddenFor`

Storage paths:

- DM: `Chats/{chatId}/Messages/{messageId}`
- Group: `Groups/{groupId}/Messages/{messageId}`

Ordering contract:

- Canonical ordering is `serverReceivedAt` (descending in most list queries).

## 3) Attachment Contract

Type: `AttachmentV2` (`src/types/messaging.ts`)

Fields:

- `id`, `kind`, `mime`, `url`, `path`, `sizeBytes`
- optional: `width`, `height`, `durationMs`, `thumbUrl`, `thumbPath`, `caption`, `viewOnce`

## 4) Reply/Thread Contract

Reply metadata type: `ReplyToMetadata`

Fields:

- `messageId`, `senderId`, `senderName?`, `kind`
- `textSnippet?`, `attachmentPreview?`

Threading fields:

- child replies carry `threadRootId`
- root may carry `replyCount` and `lastReplyAt`

## 5) Inbox Conversation Contract (UI)

Type: `InboxConversation`

Fields used by inbox UI:

- `id`, `type`, `name`
- avatar/profile fields (`avatarUrl`, `profilePictureUrl`, `decorationId`, etc.)
- `lastMessage` preview object (`text`, `timestamp`, `type`)
- `memberState: MemberStatePrivate`
- `unreadCount`, `hasMentions`
- `createdAt`, `participantCount?`

## 6) Member State Contracts

### Public member state (`Members`)

Type: `MemberStatePublic`

Paths:

- DM: `Chats/{chatId}/Members/{uid}`
- Group: `Groups/{groupId}/Members/{uid}`

Fields:

- `uid`, `role?`, `joinedAt`
- `lastReadAtPublic?`, `lastDeliveredAtPublic?`
- `typingAt?`

### Private member state (`MembersPrivate`)

Type: `MemberStatePrivate`

Paths:

- DM: `Chats/{chatId}/MembersPrivate/{uid}`
- Group: `Groups/{groupId}/MembersPrivate/{uid}`

Fields:

- `uid`
- `archived?`, `mutedUntil?`, `notifyLevel?`
- `sendReadReceipts?`, `privacyOverrides?`
- `lastSeenAtPrivate`
- `lastMarkedUnreadAt?`
- `pinnedAt?`, `deletedAt?`, `hiddenUntilNewMessage?`
- `showMemberChatStyles?`

## 7) Inbox Aggregation Contract (Staged)

Type: `InboxEntry`

Path:

- `Users/{uid}/Inbox/{threadId}`

Thread ID:

- DM: `dm:{chatId}`
- Group: `group:{groupId}`

Fields:

- `threadId`, `scope`, `conversationId`
- `lastActivityAt`, `lastSenderId`, `lastMessageKind`, `lastMessagePreview`
- `unreadCount`, `unreadSince?`
- `pinnedAt?`, `archived`, `mutedUntil?`, `notifyLevel`
- DM snapshot: `otherUserId`, `otherUserName`
- Group snapshot: `groupName`, `avatarPath`, `memberCount`

Writers:

- server triggers in `firebase-backend/functions/src/inboxTriggers.ts`

## 8) Message Requests Contract (Staged)

Type: `MessageRequest`

Path:

- `Users/{recipientUid}/MessageRequests/{chatId}`

Fields:

- `chatId`, `requesterId`, `requesterName`, `requesterAvatarConfig?`
- `status: "pending" | "accepted" | "declined"`
- `createdAt`, `resolvedAt?`
- `messagePreview`, `messageKind`

Callables:

- `acceptMessageRequest`
- `declineMessageRequest`

## 9) Settings Contracts

Global inbox settings:

- Path: `Users/{uid}/settings/inbox`
- Type: `InboxSettings`
- Key fields: `defaultNotifyLevel`, `showReadReceipts`, `showTypingIndicators`, `showOnlineStatus`, `showLastSeen`, `swipeActionsEnabled`, `confirmBeforeDelete`

Per-thread settings:

- stored in per-conversation `MembersPrivate` docs

## 10) Versioning / Migration Notes

- System is hybrid:
  - SQLite-first local messaging on native (`USE_LOCAL_STORAGE=true`)
  - Firestore-first fallback on web (`USE_LOCAL_STORAGE=false`)
- Legacy V1/V2 fields coexist in multiple places for compatibility (`content`/`text`, `sender`/`senderId`, etc.).
- Staged Chat V3 features are present but mostly flag-disabled:
  - message requests
  - inbox aggregation
  - global rate limiting
  - server-enforced privacy publish paths
