# PHASE 3: CHAT MESSAGING

**Status:** Ready to Implement  
**Date:** January 19, 2026  
**Complexity:** Medium (real-time syncing, streak integration)

---

## Overview

Phase 3 implements real-time messaging between friends. Users can send/receive messages, view chat history, and streaks update automatically when both friends exchange messages in a day.

**Key Features:**

- ✅ Send text messages to friends
- ✅ Real-time message delivery (Firestore listeners)
- ✅ Chat list showing recent conversations
- ✅ Individual chat screens with message history
- ✅ Streak updates on message exchange
- ✅ Pull-to-refresh for chat list
- ✅ Proper error handling and loading states

---

## Firestore Schema

### Message Collection Structure

```
/Chats/{chatId}
  - members: [uid1, uid2]           // Sorted UIDs for unique chat identification
  - createdAt: timestamp            // When chat was created
  - lastMessageText?: string        // Last message preview
  - lastMessageAt?: timestamp       // Last message time (for sorting)

/Messages/{messageId}
  - chatId: string                  // Reference to chat
  - sender: string                  // UID of sender
  - content: string                 // Message text (supports emoji)
  - createdAt: timestamp            // Message timestamp
  - read: boolean                   // Whether recipient read it
  - readAt?: timestamp              // When it was read
```

**Why this structure:**

- Chats collection: Fast chat list queries, sorted by lastMessageAt
- Messages sub-collection: Organized by chat, supports real-time listeners
- Members sorted: Ensures uid1 < uid2 for consistent chat ID generation

---

## Service Layer: `src/services/chat.ts`

### Functions to Implement

```typescript
// Get or create chat between two users
export async function getOrCreateChat(
  currentUid: string,
  otherUid: string,
): Promise<string>; // returns chatId

// Send a message
export async function sendMessage(
  chatId: string,
  sender: string,
  content: string,
): Promise<void>;

// Get all chats for a user (sorted by recency)
export async function getUserChats(uid: string): Promise<Chat[]>;

// Get messages for a specific chat
export async function getChatMessages(chatId: string): Promise<Message[]>;

// Subscribe to real-time messages
export async function subscribeToChat(
  chatId: string,
  callback: (messages: Message[]) => void,
): () => void; // returns unsubscribe function

// Mark message as read
export async function markMessageAsRead(
  chatId: string,
  messageId: string,
): Promise<void>;

// Get chat with a specific friend
export async function getChatWithFriend(
  currentUid: string,
  friendUid: string,
): Promise<Chat | null>;

// Delete a message (soft delete - mark deleted)
export async function deleteMessage(
  chatId: string,
  messageId: string,
): Promise<void>;
```

---

## UI Screens

### ChatListScreen

**Location:** `src/screens/chat/ChatListScreen.tsx`

**Features:**

- FlatList showing all chats sorted by last message time
- Each chat card shows:
  - Friend's avatar (with color)
  - Friend's username
  - Last message preview
  - Timestamp of last message
  - Unread indicator (badge if unread messages)
- Pull-to-refresh
- Navigation to ChatScreen on tap
- Search/filter chats
- Empty state: "No chats yet. Add friends to start chatting!"

**State:**

- chats: Chat[]
- loading: boolean
- refreshing: boolean
- searchQuery: string

### ChatScreen

**Location:** `src/screens/chat/ChatScreen.tsx`

**Features:**

- Header showing friend's name and status
- FlatList of messages (inverted to show latest at bottom)
- Message bubbles:
  - Own messages: Right-aligned, blue background
  - Friend messages: Left-aligned, gray background
  - Show timestamp and read status
- Input field to type messages
- Send button (or icon)
- Typing indicator (optional for Phase 3)
- Real-time message updates via listener
- Pull-to-refresh for older messages

**State:**

- messages: Message[]
- chatId: string
- friendProfile: User profile
- inputText: string
- loading: boolean

---

## Firestore Security Rules

Add to existing rules:

```firestore
// Chats - users can read/write chats they're in
match /Chats/{chatId} {
  allow read: if request.auth != null &&
               (request.auth.uid in resource.data.members);
  allow create, update: if request.auth != null &&
                         (request.auth.uid in request.resource.data.members);
}

// Messages - users can read/write messages in their chats
match /Messages/{messageId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null &&
                   request.auth.uid == request.resource.data.sender;
  allow update: if request.auth != null &&
                   request.auth.uid == resource.data.sender;
}
```

---

## Integration Points

### Navigation Updates

- Add `ChatStackNavigator` (ChatListScreen → ChatScreen)
- Update bottom tab to navigate to ChatListScreen
- Pass friend UID as param to start chat

### Streak Integration

- `updateStreak()` in friends.ts already exists
- Call it when first message is sent in a day
- Check date logic: use `YYYY-MM-DD` format

### User Profile

- Reuse `useUser()` context for current user
- Fetch friend profiles for chat headers

---

## Implementation Checklist

- [ ] Step 1: Update Firestore security rules
- [ ] Step 2: Create `src/services/chat.ts` service layer
- [ ] Step 3: Create `src/screens/chat/ChatListScreen.tsx`
- [ ] Step 4: Create `src/screens/chat/ChatScreen.tsx`
- [ ] Step 5: Update navigation to include Chat stack
- [ ] Step 6: Test chat functionality end-to-end
- [ ] Step 7: Verify streaks update on messages
- [ ] Step 8: Code review (0 TypeScript errors, 0 ESLint warnings)
- [ ] Step 9: Commit and push to GitHub

---

## Success Criteria

✅ Send messages between friends
✅ Receive messages in real-time
✅ View chat history in chronological order
✅ Chat list shows most recent conversations first
✅ Unread message indicators
✅ Streak counts update automatically when friends message
✅ Pull-to-refresh on both screens
✅ Proper error alerts and loading states
✅ TypeScript: 0 errors, ESLint: 0 warnings
✅ All commits pushed to GitHub

---

## Notes

**Real-time Updates:**

- Use Firestore's `onSnapshot()` listener
- Remember to unsubscribe in cleanup
- Update messages as they arrive

**Chat ID Generation:**

- Must be deterministic: `${Math.min(uid1, uid2)}_${Math.max(uid1, uid2)}`
- Ensures same chat ID regardless of who initiates

**Message Sorting:**

- Sort by `createdAt` ascending (oldest first)
- Display newest message at bottom
- Use FlatList `inverted={true}` OR manual sorting

**Streak Logic:**

- Check if sender sent message today: `lastSentDay_senderUid`
- Check if other person sent yesterday: `lastSentDay_otherUid === yesterday`
- If both true, increment streak and update date

---

## Estimated Token Usage

- Service layer: ~1,000 tokens
- UI screens: ~3,000 tokens
- Navigation integration: ~500 tokens
- Testing & debugging: ~1,500 tokens
- **Total estimate:** ~6,000 tokens

---

## Next Phase (Phase 4)

**Photo Snaps:** Capture/select photos, send as snaps, view with lifetime tracking, auto-delete after viewing.
