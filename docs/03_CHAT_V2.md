# Unified Messaging System

> Specification, implementation details, and troubleshooting for the unified messaging system

---

## Overview

The unified messaging system handles both DM and Group chats through a single interface. It enforces three hard rules:

1. **NO DUPLICATE SENDS** — Messages cannot be sent twice (idempotency keys)
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

### Unified Service Layer

The `services/messaging/` module provides a unified API for both DM and group messaging:

```
services/messaging/
├── adapters/
│   ├── groupAdapter.ts   # Converts GroupMessage ↔ MessageV2
│   └── index.ts          # Barrel export
├── index.ts              # Public API barrel
├── memberState.ts        # Unified member state (mute, archive, notify)
├── send.ts               # Unified message sending
└── subscribe.ts          # Unified message subscription
```

### Key Files

| File                                          | Purpose                               |
| --------------------------------------------- | ------------------------------------- |
| `src/types/messaging.ts`                      | V2 type definitions (MessageV2, etc.) |
| `src/services/messaging/subscribe.ts`         | **Unified** message subscription      |
| `src/services/messaging/send.ts`              | **Unified** message sending           |
| `src/services/messaging/memberState.ts`       | **Unified** member state management   |
| `src/services/outbox.ts`                      | Offline message queue                 |
| `src/services/chatV2.ts`                      | V2 operations (being consolidated)    |
| `src/services/groups.ts`                      | Group CRUD, legacy message functions  |
| `src/hooks/useChat.ts`                        | **Master chat hook** - main interface |
| `src/hooks/useUnifiedMessages.ts`             | Message subscription with outbox      |
| `src/hooks/useChatComposer.ts`                | Composer state (reply, reactions)     |
| `firebase-backend/functions/src/messaging.ts` | Cloud Functions                       |

### React Hooks

| Hook                 | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `useChat`            | **Master hook** - combines all chat functionality    |
| `useUnifiedMessages` | Message subscription, pagination, outbox integration |
| `useChatComposer`    | Reply state, reaction state, input focus             |
| `useChatKeyboard`    | Keyboard-aware animations                            |
| `useAtBottom`        | Scroll position tracking for "new message" indicator |

---

## Message Types

```typescript
type MessageScope = "dm" | "group";
type MessageKind = "text" | "media" | "voice" | "scorecard" | "system";

interface MessageV2 {
  id: string;
  scope: MessageScope; // Indicates DM or group
  conversationId: string; // Chat ID or Group ID
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

## useChat Hook

The `useChat` hook is the **master interface** for chat screens. It composes multiple specialized hooks:

```typescript
const {
  // Messages
  messages, // MessageV2[] - combined server + outbox
  displayMessages, // MessageV2[] - sorted for display
  isLoading,
  error,

  // Pagination
  pagination: { hasMoreOlder, hasMoreNewer, isLoadingOlder, isLoadingNewer },
  loadOlder,
  loadNewer,

  // Sending
  sendMessage, // (text, options?) => Promise<SendResult>

  // Reply state
  replyTo, // ReplyToMetadata | null
  setReplyTo, // (metadata) => void
  clearReplyTo, // () => void

  // Reactions
  selectedReactionMessage,
  openReactionPicker,
  closeReactionPicker,
  toggleReaction,

  // Scroll tracking
  scrollY, // SharedValue<number>
  contentHeight, // SharedValue<number>

  // Auto-scroll
  shouldAutoScroll,
  dismissAutoScroll,
} = useChat({
  scope: "dm" | "group", // Required: chat type
  conversationId: string, // Required: chat/group ID
  currentUserId: string, // Required: current user's UID
  pageSize: 30, // Optional: messages per page
});
```

### Usage in ChatScreen

```tsx
function ChatScreen({ friendUid }) {
  const { uid } = useAuth();
  const [chatId, setChatId] = useState<string | null>(null);

  const unifiedChat = useChat({
    scope: "dm",
    conversationId: chatId || "",
    currentUserId: uid || "",
  });

  // Send message
  const handleSend = async () => {
    const result = await unifiedChat.sendMessage(text, {
      replyTo: unifiedChat.replyTo || undefined,
      clearReplyOnSend: true,
    });
    if (!result.success) {
      Alert.alert("Error", result.error);
    }
  };

  return (
    <FlatList
      data={unifiedChat.displayMessages}
      // ... rest of implementation
    />
  );
}
```

### Usage in GroupChatScreen

```tsx
function GroupChatScreen({ groupId }) {
  const { uid } = useAuth();

  const unifiedChat = useChat({
    scope: "group",
    conversationId: groupId,
    currentUserId: uid || "",
  });

  // Same API as DM chat
}
```

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

## Message Grouping (Group Chats)

> **Implemented**: January 2026

Group chat messages are visually grouped when they're from the same sender within a short time window. This creates a cleaner, more readable conversation view similar to iMessage and other modern messaging apps.

### Grouping Rules

| Condition                     | Grouped? | Visual Effect                            |
| ----------------------------- | -------- | ---------------------------------------- |
| Same sender, within 2 minutes | ✅ Yes   | Tight spacing, single name/avatar        |
| Same sender, >2 minutes apart | ❌ No    | Full spacing, name/avatar shown again    |
| Different sender              | ❌ No    | Full spacing, new name/avatar            |
| Message has `replyTo`         | ❌ No    | **Always standalone** - breaks the chain |
| System message                | ❌ No    | Never grouped                            |

### Visual Layout

Within a group of messages from the same sender:

```
┌───────────────────────────────────────┐
│  rfletes                              │  ← Sender name (TOP of group only)
│  ┌─────────────────────────────────┐  │
│  │ First message in group          │  │  ← 3px margin below
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ Second message                  │  │  ← 3px margin below
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │ Third message                   │  │  ← 12px margin below (last in group)
│  └─────────────────────────────────┘  │
│  👤 02:15 PM                          │  ← Avatar + timestamp (BOTTOM of group)
└───────────────────────────────────────┘
```

### Implementation (Inverted FlatList)

The chat uses an **inverted FlatList** where index 0 is the newest message (visual bottom). This affects how grouping is calculated:

| Array Direction       | Visual Direction      | Index        |
| --------------------- | --------------------- | ------------ |
| `messages[index - 1]` | Message BELOW (newer) | Lower index  |
| `messages[index + 1]` | Message ABOVE (older) | Higher index |

### Grouping Functions

```typescript
// Time threshold for grouping (2 minutes)
const MESSAGE_GROUP_THRESHOLD_MS = 2 * 60 * 1000;

// Check if two messages should be grouped
const areMessagesGrouped = (msg1, msg2) => {
  if (!msg1 || !msg2) return false;
  if (msg1.type === "system" || msg2.type === "system") return false;
  if (msg1.replyTo || msg2.replyTo) return false; // Replies break groups
  if (msg1.sender !== msg2.sender) return false;
  return Math.abs(msg1.createdAt - msg2.createdAt) < MESSAGE_GROUP_THRESHOLD_MS;
};

// Show sender name at visual TOP of group
const shouldShowSender = (index, message) => {
  const messageAbove = messages[index + 1]; // Higher index = older = above
  return !areMessagesGrouped(message, messageAbove);
};

// Show avatar/timestamp at visual BOTTOM of group
const shouldShowAvatar = (index, message) => {
  const messageBelow = messages[index - 1]; // Lower index = newer = below
  return !areMessagesGrouped(message, messageBelow);
};

// Use reduced margin when connected to message below
const isGroupedMessage = (index, message) => {
  const messageBelow = messages[index - 1];
  return areMessagesGrouped(message, messageBelow);
};
```

### Styling

```typescript
const styles = {
  messageContainer: { marginBottom: 12 },      // Default spacing
  groupedMessageContainer: { marginBottom: 3 }, // Tight spacing within group
};

// Applied conditionally
<View style={[
  styles.messageContainer,
  isGrouped && styles.groupedMessageContainer,
]}>
```

### Reply Messages as Standalone

Messages with `replyTo` are **always treated as standalone**:

- They display sender name, avatar, and timestamp regardless of surrounding messages
- They break any ongoing group chain
- The message before AND after a reply will start new groups

This ensures replies are visually distinct and their context (the replied-to message) is always clear.

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
