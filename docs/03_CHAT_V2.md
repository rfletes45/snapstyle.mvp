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
| `src/services/messageActions.ts`              | Edit, delete operations (H7)             |
| `src/services/reactions.ts`                   | Emoji reactions (H8)                     |
| `src/services/chatMembers.ts`                 | DM member state (mute, archive)          |
| `src/services/groupMembers.ts`                | Group member state                       |
| `src/services/groups.ts`                      | Group CRUD, message subscription         |
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

- DM: Sender only (within edit window)
- Group: Sender (within window) OR admin/owner (any time)
- Sets `deletedForAll: { by, at }`
- UI shows "This message was deleted" placeholder

### deleteMessageForMe (Client-Side)

**Constraints**:

- Any user can hide messages from their own view
- Uses `hiddenFor[]` array with `arrayUnion` operation
- Client-side Firestore update (no Cloud Function needed)
- Subscription filters out hidden messages

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
// DM Messages (MessageV2)
replyTo?: {
  messageId: string;
  senderId: string;
  senderName: string;
  textSnippet?: string;      // Truncated preview
  attachmentPreview?: {      // For media/voice replies
    kind: "image" | "voice";
    thumbnailUrl?: string;
  };
}

// Group Messages (GroupMessage)
replyTo?: {
  messageId: string;
  senderId: string;
  senderName: string;
  textSnippet?: string;
  attachmentKind?: "image" | "voice";  // Simplified for groups
}
```

### Supported Contexts

| Context    | Swipe-to-Reply | Actions Sheet Reply | Visual Preview |
| ---------- | -------------- | ------------------- | -------------- |
| DM Chat    | ✓              | ✓                   | ✓              |
| Group Chat | ✓              | ✓                   | ✓              |

### UI Components

- `ReplyPreviewBar.tsx` — Shows above input when composing a reply (with reply icon)
- `ReplyBubble.tsx` — Apple Messages-style reply preview above the message bubble
- `SwipeableMessage.tsx` / `SwipeableGroupMessage.tsx` — Swipe-to-reply gesture

### Apple Messages-Style Design

The reply system uses an **Apple Messages-inspired design**:

1. **Reply Bubble Above Main Message**: The replied-to message appears as a smaller, hollow outline bubble above the actual reply
2. **Outline/Border Style**: Reply bubbles use a border-only style (transparent background) for visual distinction from the main message
3. **Curved Connector**: A curved line flows from the reply bubble down to the main message, bending when the reply and message are on opposite sides
4. **Smart Alignment**: Reply bubble aligns based on the **original sender** (not who's replying), while the main message aligns based on the current sender
5. **Visual Thread**: Creates a clear visual thread connecting the reply to its context

```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│ [Outline] Original   │  ← Reply bubble (hollow/border style)
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
    │
    ╰────────────────────────╮  ← Curved connector
                             │
              ┌──────────────────────────┐
              │ [Solid] Reply Message     │  ← Main message bubble (right-aligned)
              └──────────────────────────┘
```

### Key Files

| File                                            | Purpose                                         |
| ----------------------------------------------- | ----------------------------------------------- |
| `src/components/chat/ReplyBubble.tsx`           | Apple-style reply preview with curved connector |
| `src/components/chat/ReplyPreviewBar.tsx`       | Input area preview when composing reply         |
| `src/components/chat/SwipeableMessage.tsx`      | Swipe gesture for DM reply                      |
| `src/components/chat/SwipeableGroupMessage.tsx` | Swipe gesture for group reply                   |

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

## Keyboard & Composer System

> **Phase K** — Smooth keyboard-attached composer with smart autoscroll

### Overview

The chat screens use `react-native-keyboard-controller` for production-grade keyboard handling that:

- Animates the composer at 60fps, attached to the keyboard
- Tracks iOS interactive dismiss gestures smoothly
- Implements smart autoscroll rules for new messages
- Shows a "Return to bottom" pill when user is scrolled away

### Key Files

| File                                         | Purpose                                     |
| -------------------------------------------- | ------------------------------------------- |
| `src/hooks/chat/useChatKeyboard.ts`          | Keyboard height/progress tracking           |
| `src/hooks/chat/useAtBottom.ts`              | Scroll position detection for inverted list |
| `src/hooks/chat/useNewMessageAutoscroll.ts`  | Smart autoscroll rules                      |
| `src/components/chat/ReturnToBottomPill.tsx` | Floating "N new messages" button            |
| `src/components/chat/ChatComposer.tsx`       | Reusable animated composer wrapper          |
| `src/components/chat/ChatMessageList.tsx`    | Keyboard-aware inverted FlatList            |

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│  KeyboardProvider (App.tsx)                                │
│  └─ Provides keyboard events to entire app                 │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│  useChatKeyboard()                                         │
│  ├─ keyboardHeight (Reanimated SharedValue, negative)      │
│  ├─ keyboardProgress (0→1 animation progress)              │
│  ├─ isKeyboardOpen (JS boolean for conditional rendering)  │
│  ├─ finalKeyboardHeight (JS number, keyboard height)       │
│  └─ safeAreaBottom (device safe area inset)                │
└────────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         ▼                                     ▼
┌─────────────────────┐            ┌─────────────────────────┐
│  Inverted FlatList  │            │  Animated.View Composer │
│  ├─ useAtBottom()   │            │  ├─ marginBottom:       │
│  └─ Static padding  │            │  │   -keyboardHeight    │
│     (paddingTop =   │            │  ├─ paddingBottom:      │
│     visual bottom)  │            │  │   animated safe area │
└─────────────────────┘            └─────────────────────────┘
```

### Composer Animation (iOS)

The composer uses a two-part animated style for smooth keyboard tracking:

```typescript
const composerAnimatedStyle = useAnimatedStyle(() => {
  if (Platform.OS === "ios") {
    // keyboardHeight is NEGATIVE when open (e.g., -318)
    // Negating it gives positive marginBottom, pushing composer UP
    const marginBottom = -chatKeyboard.keyboardHeight.value;

    // As keyboard opens (progress 0→1), reduce paddingBottom
    // from insets.bottom to 0, eliminating safe area gap
    const paddingBottom =
      insets.bottom * (1 - chatKeyboard.keyboardProgress.value);

    return { marginBottom, paddingBottom };
  }
  return {};
}, [insets.bottom]);
```

**Why this approach?**

- `marginBottom` pushes the composer up in sync with keyboard at 60fps
- `paddingBottom` smoothly reduces safe area padding so there's no gap
- Using `keyboardProgress` (0→1) ensures the padding animates in sync

### Autoscroll Rules

| Condition                            | Behavior                                |
| ------------------------------------ | --------------------------------------- |
| Keyboard open + new message          | Always scroll to show message           |
| Keyboard closed + at bottom          | Auto-scroll to new message              |
| Keyboard closed + within 30 messages | Auto-scroll to new message              |
| Keyboard closed + >30 messages away  | Show "Return to bottom" pill, no scroll |

### Debug Logging

Enable `DEBUG_CHAT_KEYBOARD` in `constants/featureFlags.ts`:

```typescript
export const DEBUG_CHAT_KEYBOARD = true; // Shows keyboard state changes
```

Logs include:

- `[useChatKeyboard]` — Keyboard height/progress
- `[useAtBottom]` — Scroll position state
- `[useNewMessageAutoscroll]` — Autoscroll decisions

### Platform Notes

- **iOS**: Composer uses `marginBottom` + animated `paddingBottom` to track keyboard at 60fps
  - `marginBottom: -keyboardHeight.value` moves composer up
  - `paddingBottom` animates from `insets.bottom` to `0` using `keyboardProgress`
- **Android**: System handles keyboard via `windowSoftInputMode="adjustResize"` (no animation needed)
- **Web**: Falls back to standard padding (no native keyboard)

### Message List Padding

The inverted FlatList uses **static padding** (not animated):

```typescript
const listContentStyle = {
  paddingTop: 60 + insets.bottom + 16, // Visual bottom (composer space)
};
```

This avoids jank because the list doesn't need to animate with the keyboard—only the composer moves.

---

## Message Bubble Styling

### Theme-Aware Approach

Both ChatScreen (DM) and GroupChatScreen use theme-aware inline styles for proper light/dark mode support:

```typescript
// Message bubble colors
<View
  style={[
    styles.messageBubble,
    isOwnMessage
      ? [styles.ownMessage, { backgroundColor: theme.colors.primary }]
      : [
          styles.otherMessage,
          { backgroundColor: theme.dark ? "#1A1A1A" : "#e8e8e8" },
        ],
  ]}
>
  <Text
    style={[
      styles.messageText,
      {
        color: isOwnMessage
          ? theme.colors.onPrimary
          : theme.colors.onSurface,
      },
    ]}
  >
    {content}
  </Text>
</View>
```

### Style Pattern

- **Own messages**: Use `theme.colors.primary` for background, `theme.colors.onPrimary` for text
- **Other messages**: Use `theme.dark ? "#1A1A1A" : "#e8e8e8"` for background, `theme.colors.onSurface` for text
- **Timestamps**: Use `theme.dark ? "#666" : "#888"` for muted appearance
- **System messages**: Use theme-aware background with muted text colors

### Key Styling Rules

1. **No hardcoded colors in StyleSheet** — Apply colors inline with `theme`
2. **Use `TouchableOpacity` with `View`** — Not Paper's `Card` component (avoids extra padding/elevation)
3. **Consistent border radius** — 16px with 4px on tail corner
4. **Max width 80%** — Bubbles don't span full width

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

---

## Inbox Overhaul

> **Completed: January 2026**
>
> See [INBOX_OVERHAUL_PLAN.md](./INBOX_OVERHAUL_PLAN.md) for implementation summary.

### Overview

The inbox screen was completely redesigned with modern UX features:

- **Filter tabs**: All, Unread, Groups, DMs, Requests
- **Swipe actions**: Pin, Mute, Delete
- **Long-press context menu**: All conversation actions
- **Profile quick view**: Modal preview from avatar tap
- **Integrated friend requests**: Requests tab with accept/decline
- **Advanced search**: Filter by type, search message content

### New Components (`src/components/chat/inbox/`)

| Component                 | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| `ConversationItem`        | Conversation row with avatars and status  |
| `SwipeableConversation`   | Swipe gesture wrapper (pin/mute/delete)   |
| `ConversationContextMenu` | Long-press action menu                    |
| `InboxHeader`             | Header with user avatar, search, settings |
| `InboxTabs`               | Horizontal filter tabs                    |
| `PinnedSection`           | Collapsible pinned conversations          |
| `FriendRequestItem`       | Pending request with accept/decline       |
| `InboxFAB`                | Multi-action floating button              |
| `ProfilePreviewModal`     | Quick profile view bottom sheet           |
| `MuteOptionsSheet`        | Mute duration picker                      |
| `DeleteConfirmDialog`     | Delete confirmation modal                 |
| `EmptyState`              | Contextual empty states                   |

### New Hooks

| Hook                     | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `useInboxData`           | Unified conversation data with filtering |
| `useConversationActions` | Pin, mute, delete, archive operations    |
| `useFriendRequests`      | Real-time friend request subscription    |

### New Services

| Service            | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `inboxSettings.ts` | User inbox preferences (Firestore: `Users/{uid}/settings/inbox`) |

### New Screens

| Screen                | Purpose                                 |
| --------------------- | --------------------------------------- |
| `ChatListScreenV2`    | Main inbox screen (overhauled)          |
| `InboxSearchScreen`   | Full search with filters                |
| `InboxSettingsScreen` | Inbox notification and privacy settings |

### Utilities

| Utility         | Purpose                                                     |
| --------------- | ----------------------------------------------------------- |
| `animations.ts` | Reusable animation patterns (fade, slide, scale, bounce)    |
| `haptics.ts`    | Centralized haptic feedback (light, medium, heavy, warning) |

### Data Model Extensions

```typescript
// MembersPrivate (DM) & Members (Group) - New fields
{
  pinnedAt?: number;         // Pin timestamp (null = unpinned)
  deletedAt?: number;        // Soft delete timestamp
  mutedUntil?: number | -1;  // -1 = indefinite, timestamp = until date
  archived?: boolean;        // Archive state
}

// Inbox Settings (Users/{uid}/settings/inbox)
{
  defaultNotifyLevel: "all" | "mentions" | "none";
  showReadReceipts: boolean;
  showOnlineStatus: boolean;
  showTypingIndicators: boolean;
  swipeActionsEnabled: boolean;
  confirmBeforeDelete: boolean;
}
```
