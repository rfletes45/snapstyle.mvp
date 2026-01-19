# PHASE 3 SETUP & IMPLEMENTATION

**Status:** Ready to Implement  
**Date:** January 19, 2026

---

## Step 1: Update Firestore Security Rules

Before implementing Phase 3 code, update your Firestore security rules to allow messaging.

### Update Your Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select **gamerapp-37e70** project
3. Go to **Firestore Database** → **Rules** tab
4. Replace your current rules with this complete version:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users - authenticated users can READ all (for search), but only WRITE own
    match /Users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }

    // Usernames - all authenticated users can read/write
    match /Usernames/{username} {
      allow read, write: if request.auth != null;
    }

    // Friends - users can read/write if they're part of the friendship
    match /Friends/{document=**} {
      allow read, write: if request.auth != null;
    }

    // FriendRequests - users can read/write their own requests
    match /FriendRequests/{document=**} {
      allow read, write: if request.auth != null;
    }

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
  }
}
```

5. Click **Publish**
6. Wait 1-2 minutes for rules to apply

---

## Step 2: Create Chat Service Layer

Create `src/services/chat.ts` with all messaging functions.

**Key points:**

- Chat ID generation: `${Math.min(uid1, uid2)}_${Math.max(uid1, uid2)}`
- Real-time updates: Use Firestore `onSnapshot()` listeners
- Message sorting: By `createdAt` timestamp
- Streak integration: Call `updateStreak()` from friends service

**Functions to implement:**

- getOrCreateChat()
- sendMessage()
- getUserChats()
- getChatMessages()
- subscribeToChat() with cleanup
- markMessageAsRead()
- getChatWithFriend()
- deleteMessage()

See PHASE_3_PREP.md for full specifications.

---

## Step 3: Create ChatListScreen

Create `src/screens/chat/ChatListScreen.tsx` showing all chats.

**Features:**

- FlatList of chats sorted by `lastMessageAt` (newest first)
- Chat card showing friend avatar, name, last message preview
- Unread badge for chats with unread messages
- Pull-to-refresh
- Navigation to ChatScreen
- Empty state message

**State management:**

- useState for chats, loading, refreshing
- useEffect to load chats on mount
- useCallback for loadData

---

## Step 4: Create ChatScreen

Create `src/screens/chat/ChatScreen.tsx` for individual conversations.

**Features:**

- FlatList of messages (inverted, newest at bottom)
- Message bubbles (own vs. friend)
- Timestamp on each message
- Read status indicator
- TextInput + Send button
- Real-time message listener (onSnapshot)
- Pull-to-refresh for older messages

**Route params:**

- `friendUid`: The friend's user ID (passed from ChatListScreen or FriendsScreen)

---

## Step 5: Update Navigation

Update navigation structure to include Chat screens:

1. Create `ChatStackNavigator` in navigation
2. Update bottom tab to navigate to ChatListScreen
3. Add route params for starting chats from FriendsScreen
4. Make ChatScreen accessible from both ChatListScreen and FriendsScreen

**Routes needed:**

- `Chat` (ChatListScreen)
- `ChatDetail` (ChatScreen with friendUid param)

---

## Step 6: Test Everything

Before committing, test:

1. **Send message** - send a message to a friend
2. **Receive message** - open chat and see real-time update
3. **Chat list** - verify sorted by recency
4. **Streak update** - confirm streak increments when messaging
5. **Unread badges** - verify unread messages show badge
6. **Pull-to-refresh** - test on both screens
7. **Navigation** - test all navigation paths

---

## Implementation Order

1. ✅ Update Firestore rules (manual step)
2. 🔄 Create `src/services/chat.ts`
3. 🔄 Create `src/screens/chat/ChatListScreen.tsx`
4. 🔄 Create `src/screens/chat/ChatScreen.tsx`
5. 🔄 Update navigation
6. 🔄 Test end-to-end
7. ✅ Verify code quality (0 errors, 0 warnings)
8. ✅ Commit and push

---

## Common Issues & Solutions

**Issue:** "Missing or insufficient permissions" on sendMessage

- **Solution:** Verify Firestore rules are published and chat members include sender

**Issue:** Messages don't update in real-time

- **Solution:** Check listener is properly subscribed and not unsubscribed too early

**Issue:** Chat list not sorted correctly

- **Solution:** Verify sorting by `lastMessageAt` descending

**Issue:** Streak doesn't update

- **Solution:** Check `updateStreak()` is called with correct date format (YYYY-MM-DD)

---

## Ready to Implement?

Once you've:

1. ✅ Updated Firestore security rules
2. ✅ Verified rules are published

Tell me, and I'll start implementing the code!
