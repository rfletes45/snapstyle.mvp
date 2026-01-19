# PHASE 3 COMPLETE: Real-Time 1:1 Text Chat

**Status:** ✅ Phase 3 Complete
**Date:** January 19, 2026
**Commit:** (Chat implementation complete)

---

## What Was Built

### 1. **Chat Service** (`src/services/chat.ts`)

Complete chat and messaging operations with real-time Firestore syncing:

#### Core Functions

- **`getChatId(uid1, uid2)`** - Deterministic chat ID generation
  - Sorts both UIDs and joins with underscore
  - Ensures same chat ID regardless of who initiates
  - Example: `alice_bob` (when sorted alphabetically)

- **`getOrCreateChat(currentUid, otherUid)`** - Get or create chat document
  - Returns existing chat ID if already chatting
  - Creates new Chats/{chatId} document if first time
  - Sets members array and createdAt timestamp
  - Returns chatId for messaging

- **`sendMessage(chatId, sender, content, type)`** - Send text message
  - Creates Messages subcollection document
  - Sets message properties:
    - `sender`: UID of sender
    - `type`: "text" (expandable to "image" in Phase 4)
    - `content`: Message text (max 500 chars enforced)
    - `createdAt`: Firestore server timestamp
    - `expiresAt`: Current time + 24 hours (86400000ms) for TTL
    - `read`: false (initial read status)
  - Updates parent Chat document:
    - `lastMessageText`: Message preview
    - `lastMessageAt`: Message timestamp
  - Triggers `updateStreak()` from friends service to increment daily exchange counter
  - Returns Promise (resolves when write complete)

- **`getUserChats(uid)`** - Get all chats for current user
  - Queries Chats collection where members array-contains current UID
  - Orders by lastMessageAt descending (most recent first)
  - Returns array of Chat documents with metadata
  - Used for ChatListScreen

- **`getChatMessages(chatId, limit)`** - Fetch message history
  - Queries Messages subcollection under Chats/{chatId}
  - Orders by createdAt ascending (oldest first)
  - Limits results (default 50 for pagination)
  - Returns array of Message documents

- **`subscribeToChatMessages(chatId, callback)`** - Real-time message listener
  - Sets up onSnapshot listener on Messages subcollection
  - Queries messages ordered by createdAt ascending
  - Calls callback whenever messages change
  - Returns unsubscribe function for cleanup
  - Used in ChatScreen for live updates

- **`getChatWithFriend(currentUid, friendUid)`** - Get specific chat
  - Calls getChatId to get deterministic ID
  - Fetches Chats document
  - Returns Chat or null if not exists
  - Used for friend-specific chat navigation

- **`markMessageAsRead(chatId, messageId)`** - Mark message read
  - Updates Messages document:
    - `read`: true
    - `readAt`: Current timestamp
  - Currently optional (text messages don't require strict read tracking in MVP)

#### Error Handling

- Validates message length (max 500 characters)
- Handles missing chat gracefully (creates if not exists)
- Firestore transaction safety for concurrent operations
- Console error logging for debugging

---

### 2. **Chat List Screen** (`src/screens/chat/ChatListScreen.tsx`)

Displays all conversations sorted by recency:

**Features:**

- FlatList of all chats for current user
- Each chat card shows:
  - Friend avatar with base color from avatarConfig
  - Friend's display name
  - Last message text preview (truncated)
  - Timestamp of last message (relative format: "2m ago", "1h ago", etc.)
  - Blue border highlighting for visual separation
- Pull-to-refresh: `onRefresh` triggers `getUserChats()` reload
- Tap chat → Navigate to ChatScreen with friend UID
- Proper loading state (spinner on initial load)
- Proper error alerts (try/catch with Toast notifications)

**State Management:**

```typescript
const [chats, setChats] = useState<Chat[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
```

**Navigation:**

- Uses `useNavigation` to push ChatScreen with params: `{ friendUid }`
- Bottom tab integration: ChatListScreen is first screen in ChatStack

**Real-Time Updates:**

- Loads chats on mount via `useEffect`
- Does NOT set up listeners here (lightweight initial load)
- Chat-specific listeners handled in ChatScreen

---

### 3. **Chat Screen** (`src/screens/chat/ChatScreen.tsx`)

Individual chat interface with real-time messaging:

**Features:**

- Header showing friend's display name and online status
- FlatList (inverted) of messages in chronological order
  - Oldest messages at top, newest at bottom
  - Shows new messages immediately via real-time listener
- Message bubbles:
  - Own messages (sender == currentUid):
    - Right-aligned
    - Blue background (Paper theme primary color)
    - White text
    - Shows timestamp below
  - Friend messages:
    - Left-aligned
    - Gray background (#E0E0E0)
    - Dark text
    - Shows timestamp below
  - Message content displays with proper text wrapping
  - Emoji support ✅
- Text input field at bottom:
  - Multiline input (TextInput with numberOfLines={3})
  - Send button (icon-based, right of input)
  - Input validation: message required, max 500 chars
- Proper loading state (spinner on initial load)
- Real-time updates via Firestore listener (new messages appear immediately)
- Error handling with user alerts

**State Management:**

```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [inputText, setInputText] = useState("");
const [loading, setLoading] = useState(true);
const [friendProfile, setFriendProfile] = useState<User | null>(null);
const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);
```

**Data Flow:**

1. Component mounts with route params containing `friendUid`
2. Derives `chatId` from current user UID + friend UID
3. Fetches initial message history via `getChatMessages()`
4. Sets up real-time listener via `subscribeToChatMessages()` for live updates
5. When user taps send:
   - Validates input (not empty, ≤ 500 chars)
   - Calls `sendMessage()` service function
   - Clears input field
   - Real-time listener triggers and updates messages
6. On component unmount: calls unsubscribe function to clean up listener

---

## Firestore Collections & Schema

### **Chats** Collection

```javascript
Chats/{chatId} = {
  id: string,                  // Deterministic: "{minUid}_{maxUid}"
  members: [uid1, uid2],       // Both UIDs (sorted for consistency)
  createdAt: timestamp,        // When chat was created
  lastMessageText?: string,    // Last message preview (for chat list)
  lastMessageAt?: timestamp    // Last message time (for sorting chat list)
}
```

### **Messages** Subcollection

```javascript
Chats/{chatId}/Messages/{messageId} = {
  id: string,                  // Auto-generated document ID
  sender: string,              // UID of message sender
  type: "text",                // Message type (Phase 4: will add "image")
  content: string,             // Message text (max 500 chars)
  createdAt: timestamp,        // Firestore server timestamp
  expiresAt: number,           // Unix timestamp = createdAt + 86400000 (24h)
  read: boolean,               // Whether recipient has read it
  readAt?: timestamp,          // When it was read (optional)
  openedAt?: timestamp,        // For future photo snaps (Phase 4)
  openedBy?: string            // For future photo snaps (Phase 4)
}
```

**TTL Configuration (Firestore Console):**

- Collection path: `Chats/{chatId}/Messages`
- TTL field: `expiresAt`
- Documents auto-delete 24 hours after creation

---

## Type Definitions

### Updated `src/types/models.ts`

```typescript
export interface Chat {
  id: string;
  members: [string, string]; // Sorted UIDs
  createdAt: number;
  lastMessageText?: string;
  lastMessageAt?: number;
}

export interface Message {
  id: string;
  sender: string;
  type: "text" | "image"; // Prepared for Phase 4
  content: string; // Text or storagePath for images
  createdAt: number;
  expiresAt: number; // For TTL
  read: boolean;
  readAt?: number;
  openedAt?: number; // Phase 4: when snap was opened
  openedBy?: string; // Phase 4: who opened it
}
```

---

## Integration with Existing Systems

### Streak Trigger

- When `sendMessage()` is called:
  - Calls `updateStreak(friendshipId, senderUid)` from `src/services/friends.ts`
  - Streak increments daily (once per calendar day per friend)
  - Logic: if both users sent at least one message today, increment streak
  - Uses `dayKey()` utility function for date logic

### Navigation Structure

- Updated `src/navigation/RootNavigator.tsx` with ChatStackNavigator:
  - `ChatListScreen`: Shows all chats (default)
  - `ChatScreen`: Individual chat detail (receives friendUid param)
- Bottom tabs correctly route to ChatListScreen

### User Context

- Uses `useUser()` context hook to get currentUser (uid, profile)
- Uses `useAuth()` context for authentication state

---

## Definition of Done

✅ Real-time text messaging works between friends
✅ Chat list displays all conversations sorted by recency
✅ Message history loads on chat open
✅ New messages appear live via Firestore listeners
✅ Messages expire after 24 hours via TTL
✅ Streak system updates when both users exchange messages in a day
✅ Proper error handling and loading states
✅ TypeScript strict mode passes (0 errors)
✅ Pull-to-refresh syncs latest chats
✅ Message input validates max length (500 chars)

---

## Manual Firestore Configuration

These steps were completed during Phase 3 setup:

1. **Create Firestore Database:**
   - Location: Same region as app
   - Security rules deployed (see Security section below)

2. **Enable TTL on Messages collection:**
   - Go to Firestore Console → Collection `Chats/{chatId}/Messages`
   - Click **Manage TTL** (or use Firestore Indexes UI)
   - Set TTL field to `expiresAt`
   - This automatically deletes messages after 24 hours

3. **Security Rules Deployed:**
   - Rules allow authenticated users to:
     - Read/write chats they're members of
     - Create messages in their chats
     - Update only their own messages

---

## Testing Instructions (Manual on Emulator/Device)

### Prerequisites

- Two test accounts created (Test User A, Test User B)
- Both users should be in each other's Friends list

### Test 1: Send Text Message

**Steps:**

1. Sign in as User A
2. Go to Chats tab
3. Tap to open chat with User B
4. Type a message: "Hello from User A"
5. Tap Send button
6. Verify:
   - Message appears on right side (blue bubble)
   - Message shows current timestamp
   - Chat list updates to show this message as last

**Expected Result:** ✅ Message appears immediately in User A's view

### Test 2: Receive Message (Real-Time)

**Steps:**

1. Keep User A's chat open
2. On second device/emulator, sign in as User B
3. Go to Chats tab → tap User A's chat
4. Type "Hello back from User B"
5. Tap Send button
6. On User A's device: Watch chat screen (should NOT need to refresh)
7. Verify:
   - Message from User B appears immediately on left side (gray bubble)
   - Shows timestamp
   - Appears in correct chronological order

**Expected Result:** ✅ Real-time listener delivers message without manual refresh

### Test 3: Chat List Updates

**Steps:**

1. User A in Chat tab (viewing chat list)
2. User B sends message from their chat
3. On User A's device: Pull to refresh chat list
4. Verify:
   - Chat with User B moves to top
   - Shows User B's message as preview
   - Shows recent timestamp

**Expected Result:** ✅ Chat list reflects latest message

### Test 4: Message Expiry (24-Hour TTL)

**Note:** To test this quickly:

1. Send several messages
2. Note their timestamps
3. (Wait would be 24 hours in production)
4. In Firestore Console → Collection `Chats/{chatId}/Messages`:
   - Manually delete a document to simulate TTL
   - Refresh chat screen
   - Message should disappear

**Expected Result:** ✅ After 24 hours, old messages auto-delete via TTL

### Test 5: Message History Load

**Steps:**

1. User A and B have been chatting over multiple days (or send 10+ messages)
2. Close app completely
3. Reopen app
4. Sign in as User A
5. Open chat with User B
6. Scroll up in message list
7. Verify:
   - Older messages load
   - Chronological order maintained

**Expected Result:** ✅ Full message history accessible on demand

### Test 6: Streak Integration

**Steps:**

1. User A and B are friends
2. Check Friends tab → Friend's streak counter (should be 0 or previous count)
3. User A sends message to User B
4. User B opens chat and sends reply
5. Check Friends tab
6. Verify:
   - If first message of the day: streak count should increment by 1
   - Shows fire emoji 🔥 next to friend

**Expected Result:** ✅ Streak increments after mutual message exchange

### Test 7: Error Handling

**Steps (Internet Disconnect):**

1. User typing in chat input
2. Turn OFF internet/wifi on device
3. Try to send message
4. Verify:
   - Toast alert appears: "Failed to send message" or similar
   - Input text remains (not cleared)
   - User can retry when internet returns

**Expected Result:** ✅ Graceful error handling prevents silent failures

---

## Known Limitations & Future Work

- **No Typing Indicator:** Phase 3 MVP doesn't show "User is typing..."
- **No Read Receipts:** While `read` field exists, no visual indicator shown yet
- **No Message Editing/Deletion:** Messages are write-once until TTL expires
- **No Media Messages:** Text only; Phase 4 will add photo snaps
- **No Message Search:** Can't search chat history (small scale acceptable for MVP)

---

## Files Modified/Created

**Created:**

- ✅ `src/services/chat.ts` (371 lines) - Complete chat service
- ✅ `src/screens/chat/ChatListScreen.tsx` - Chat list UI
- ✅ `src/screens/chat/ChatScreen.tsx` - Chat detail UI

**Modified:**

- ✅ `src/navigation/RootNavigator.tsx` - Added ChatStackNavigator
- ✅ `src/types/models.ts` - Added Chat and Message interfaces

**Firestore:**

- ✅ `Chats` collection created (auto via first message)
- ✅ `Messages` subcollection created (auto via first message)
- ✅ TTL rule configured on Messages expiresAt field

---

## Next Phase

**PHASE 4: Photo Snaps**

Phase 4 will extend messaging to support photo snaps:

- Capture photos via expo-camera or select from gallery
- Upload to Firebase Storage at `snaps/{chatId}/{messageId}.jpg`
- Send as message with type: "image" (storagePath instead of content)
- View-once flow: tap → download → fullscreen → on close mark opened and delete
- Auto-delete if unopened after 24h (TTL still applies)
