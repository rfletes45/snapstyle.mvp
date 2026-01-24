# Chat V2 Messaging System

> Specification, implementation details, and troubleshooting for the V2 messaging system

---

## Overview

Chat V2 is the current messaging implementation for both DM and Group chats. It enforces three hard rules:

1. **NO DUPLICATE SENDS** — Messages cannot be sent twice
2. **AUTHORITATIVE ORDERING** — Server timestamps define message order
3. **READ/UNREAD WITHOUT EXPLOSIONS** — Watermark-based, not per-message flags

---

## Architecture

### Message Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User UI   │ ──▶ │   Outbox    │ ──▶ │  Cloud Fn   │ ──▶ │  Firestore  │
│ (optimistic)│     │ (persist)   │     │ (validate)  │     │  (store)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                               onSnapshot ◀────────┘
```

### Key Files

| File                                          | Purpose                                  |
| --------------------------------------------- | ---------------------------------------- |
| `src/types/messaging.ts`                      | V2 type definitions                      |
| `src/services/outbox.ts`                      | Offline message queue                    |
| `src/services/chatV2.ts`                      | V2 send/receive operations               |
| `src/services/messageList.ts`                 | Pagination, subscriptions, unread counts |
| `src/services/messageActions.ts`              | Edit, delete, copy operations            |
| `src/services/reactions.ts`                   | Emoji reactions                          |
| `src/services/chatMembers.ts`                 | DM member state (mute, archive)          |
| `src/services/groupMembers.ts`                | Group member state                       |
| `src/hooks/useMessagesV2.ts`                  | React hook for message subscription      |
| `src/hooks/useOutboxProcessor.ts`             | Background outbox processing             |
| `firebase-backend/functions/src/messaging.ts` | Cloud Functions                          |

---

## Message Types

```typescript
type MessageKind = "text" | "media" | "voice" | "scorecard" | "system";

interface MessageV2 {
  id: string;
  senderId: string;
  senderName?: string;

  // Content (one of these based on kind)
  text?: string;
  attachments?: AttachmentV2[];
  voiceMetadata?: VoiceMetadata;
  scorecardData?: ScorecardData;
  systemEvent?: SystemEvent;

  kind: MessageKind;

  // Metadata
  clientId: string; // Idempotency key
  createdAt: number; // Client timestamp (display only)
  serverReceivedAt: number; // Server timestamp (ordering)

  // Interactions
  replyTo?: ReplyToMetadata;
  reactions?: Record<string, string[]>; // emoji → uids
  mentionUids?: string[];
  linkPreview?: LinkPreviewData;

  // Deletion
  hiddenFor?: string[]; // Delete-for-me UIDs
  deletedForAll?: { by: string; at: number };
  editedAt?: number;
}
```

---

## Outbox System

### How It Works

1. **Enqueue**: `enqueueMessage()` adds message to AsyncStorage outbox
2. **Optimistic**: UI shows message immediately with `state: "sending"`
3. **Process**: `useOutboxProcessor` hook calls Cloud Function
4. **Success**: Remove from outbox, message confirmed
5. **Failure**: Mark as `failed`, show retry UI

### Outbox Item States

```typescript
type OutboxItemState = "queued" | "sending" | "sent" | "failed";
```

### Key Functions

```typescript
// src/services/outbox.ts
enqueueMessage(params: EnqueueMessageParams): Promise<OutboxItem>
getOutboxItems(conversationId): Promise<OutboxItem[]>
updateOutboxItem(messageId, updates): Promise<void>
removeOutboxItem(messageId): Promise<void>
retryFailedMessage(messageId): Promise<void>

// src/services/chatV2.ts
sendMessageWithOutbox(params): Promise<void>  // Main entry point
processPendingMessages(): Promise<void>       // Background processor
```

### When Processing Runs

- App mount (after auth) via `useOutboxProcessor`
- App returns to foreground
- Network reconnect
- Manual retry button tap

---

## Cloud Functions

### sendMessageV2

**Endpoint**: Callable function  
**Rate Limit**: 30 messages/minute per user

**Validation**:

- User authenticated
- User is member of conversation
- User not blocked by recipient (DM)
- Text within length limits
- Attachments validated

**Idempotency**:

- Uses `messageId` as document ID
- If message exists, returns existing (no duplicate)
- Stores idempotency key: `${clientId}:${messageId}`

### editMessageV2

**Constraints**:

- Sender only
- Within 15-minute window
- Can only update `text` and `editedAt`

### deleteMessageForAllV2

**Constraints**:

- DM: Sender only
- Group: Sender OR admin/owner
- Sets `deletedForAll: { by, at }`

### toggleReactionV2

**Constraints**:

- Max 12 unique emojis per message
- Toggle: add if not present, remove if present

---

## Read State (Watermarks)

### How It Works

Instead of per-message `read: boolean` flags:

1. Each user has `MembersPrivate/{uid}.lastSeenAtPrivate` timestamp
2. Messages with `serverReceivedAt > lastSeenAtPrivate` are unread
3. Single document update when viewing conversation

### Updating Watermark

```typescript
// src/services/chatMembers.ts
updateReadWatermark(chatId, uid, timestamp): Promise<void>

// Called automatically by useMessagesV2 when messages are viewed
```

### Respecting Privacy

If `sendReadReceipts: false` in MembersPrivate:

- Private watermark still updates (for unread count)
- Public watermark NOT broadcast to other users

---

## Reactions

### Data Model

```typescript
// On message document
reactions?: {
  "👍": ["uid1", "uid2"],
  "❤️": ["uid3"]
}
```

### UI Components

- `ReactionBar.tsx` — Display reactions on message
- `ReactionPicker.tsx` — Emoji selection modal
- Long-press on message to add reaction

---

## Reply/Threading

### Data Model

```typescript
replyTo?: {
  messageId: string;
  senderId: string;
  senderName: string;
  previewText: string;  // Truncated preview
}
```

### UI Components

- `ReplyPreviewBar.tsx` — Shows above input when replying
- `ReplyBubble.tsx` — Shows in message bubble
- `SwipeableMessage.tsx` — Swipe-to-reply gesture

---

## Mentions (@username)

### Parsing

```typescript
// src/services/mentionParser.ts
extractMentions(text, members): string[]  // Returns UIDs
renderMentionedText(text): ReactNode      // Styled @mentions
```

### UI Components

- `MentionAutocomplete.tsx` — Dropdown when typing @
- `useMentionAutocomplete.ts` — State management hook

### Push Notifications

Group messages with mentions trigger notifications to mentioned users regardless of `notifyLevel` setting (unless muted).

---

## Attachments

### Multi-Attachment Support

```typescript
interface AttachmentV2 {
  id: string;
  kind: "image" | "video" | "voice" | "file";
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  mime: string;
  caption?: string;
  viewOnce?: boolean;
}
```

### Components

- `useAttachmentPicker.ts` — Selection and upload management
- `AttachmentTray.tsx` — Preview before sending
- `AttachmentGrid.tsx` — Display in message
- `MediaViewerModal.tsx` — Fullscreen gallery

---

## Voice Messages

### Recording

```typescript
// src/hooks/useVoiceRecorder.ts
const {
  isRecording,
  duration,
  startRecording,
  stopRecording,
  cancelRecording,
  recording, // VoiceRecording data
} = useVoiceRecorder({ maxDuration: 60 });
```

### Components

- `VoiceRecordButton.tsx` — Hold-to-record with slide-to-cancel
- `VoiceMessagePlayer.tsx` — Inline playback with waveform

---

## Link Previews

### Flow

1. Detect URLs in message text
2. Call `fetchLinkPreview` Cloud Function
3. Store preview data with message
4. Display `LinkPreviewCard` component

---

## Chat Settings

### Per-Chat Preferences (MembersPrivate)

| Setting            | Values              | Effect                      |
| ------------------ | ------------------- | --------------------------- |
| `mutedUntil`       | timestamp, -1, null | Suppress push notifications |
| `archived`         | boolean             | Hide from main chat list    |
| `notifyLevel`      | all, mentions, none | Notification filtering      |
| `sendReadReceipts` | boolean             | Share read status           |

### Accessing Settings

- DM: Chat header menu → Settings
- Group: Info screen → Notifications & Settings

---

## Troubleshooting

### Messages Not Sending

1. Check outbox: `AsyncStorage.getItem("@snapstyle/message_outbox_v2")`
2. Check Cloud Function logs in Firebase Console
3. Verify user is member of conversation
4. Check rate limit (30/min)

### Messages Out of Order

- Always use `serverReceivedAt` for ordering, not `createdAt`
- Client timestamps can be wrong due to device clock skew

### Duplicates Appearing

- Check `clientId` uniqueness
- Verify outbox deduplication is working
- Cloud Function returns existing on duplicate messageId

### Read State Not Updating

- Check `MembersPrivate` document exists
- Verify Firestore rules allow update
- Check `sendReadReceipts` setting

### Reactions Not Working

- Max 12 emojis per message
- User must be conversation member
- Check Cloud Function logs

---

## Migration Notes

### V1 → V2 Differences

| Aspect            | V1                          | V2                          |
| ----------------- | --------------------------- | --------------------------- |
| Field for sender  | `sender`                    | `senderId`                  |
| Field for content | `content`                   | `text`                      |
| Message type      | `type`                      | `kind`                      |
| Ordering          | `createdAt` (client)        | `serverReceivedAt` (server) |
| Read state        | Per-message `read: boolean` | Watermark timestamp         |
| Idempotency       | Client-side only            | Server-enforced             |

### Legacy Conversion

```typescript
// src/types/messaging.ts
convertLegacyMessage(legacy: LegacyMessage): MessageV2
```
