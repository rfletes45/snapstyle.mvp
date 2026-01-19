# PHASE 2 PREPARATION CHECKLIST

## Before We Start Phase 2: Friends System

This checklist ensures you understand what Phase 2 will deliver.

---

## What Phase 2 Will Build

### Overview
Phase 2 implements the **Friends System** with:
- Add friends by username
- Friend requests (send, accept, decline)
- Friends list with status
- Streak tracking (daily message exchanges)
- Two-sided friendship relationships

### Key Features

1. **Add Friend Flow**
   - Search/add by username
   - Send friend request
   - Validation (can't add yourself, etc.)

2. **Friend Requests**
   - View pending requests (from + to you)
   - Accept request → becomes friend
   - Decline request → removes request
   - Cancel sent request

3. **Friends List**
   - All your friends
   - Current streak count
   - Last message date
   - Block status (basic support)

4. **Streak System**
   - Count daily message exchanges
   - Reset if no message one day
   - Display in friends list
   - Used for gamification in later phases

---

## Firestore Collections (Phase 2)

Phase 2 will create these new Firestore collections:

### 1. **Friends Collection**
```
Friends/
├── {friendshipId1}/
│   ├── users: [uid1, uid2]                    # Both user IDs
│   ├── createdAt: timestamp                    # When friendship started
│   ├── streakCount: number                     # Current streak (0+)
│   ├── streakUpdatedDay: "YYYY-MM-DD"         # Last day streak was updated
│   ├── lastSentDay_uid1: "YYYY-MM-DD"         # Last day uid1 sent message
│   ├── lastSentDay_uid2: "YYYY-MM-DD"         # Last day uid2 sent message
│   └── blockedBy: null | uid                  # If blocked, which user blocked
├── {friendshipId2}/
│   └── ...
```

**Purpose:** Store confirmed friendships and streak data
**Key fields:** 
- Stores both UIDs so we can query "get my friends"
- Streak tracking requires daily message tracking
- blockedBy allows one-sided blocking

### 2. **FriendRequests Collection**
```
FriendRequests/
├── {requestId1}/
│   ├── from: uid                              # Who sent request
│   ├── to: uid                                # Who receives request
│   ├── status: "pending" | "accepted" | "declined"
│   ├── createdAt: timestamp                   # When request sent
│   └── respondedAt: timestamp | null          # When user responded
├── {requestId2}/
│   └── ...
```

**Purpose:** Track pending/responded friend requests
**Key fields:**
- status allows filtering (pending requests)
- respondedAt helps with notification/history

### Updated Security Rules (Phase 2)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users
    match /Users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    
    // Usernames
    match /Usernames/{username} {
      allow read, write: if request.auth != null;
    }
    
    // Friends - authenticated users can read their friends
    match /Friends/{friendId} {
      allow read: if request.auth != null && 
                     (request.auth.uid in resource.data.users);
      allow create, update, delete: if request.auth != null &&
                                       (request.auth.uid in resource.data.users);
    }
    
    // Friend Requests - users can read/write their own requests
    match /FriendRequests/{requestId} {
      allow read: if request.auth != null &&
                     (request.auth.uid == resource.data.from ||
                      request.auth.uid == resource.data.to);
      allow create: if request.auth != null &&
                       request.auth.uid == request.resource.data.from;
      allow update, delete: if request.auth != null &&
                               (request.auth.uid == resource.data.from ||
                                request.auth.uid == resource.data.to);
    }
  }
}
```

---

## Services to Create (Phase 2)

### `src/services/friends.ts`

**Functions:**
```typescript
// Get all friends for current user
export async function getFriends(uid: string): Promise<Friend[]>

// Get a specific friend relationship
export async function getFriend(uid1: string, uid2: string): Promise<Friend | null>

// Add friend (sends friend request)
export async function sendFriendRequest(
  fromUid: string,
  toUsername: string    // Find by username, then send request
): Promise<boolean>

// Get pending friend requests
export async function getPendingRequests(uid: string): Promise<FriendRequest[]>

// Accept friend request
export async function acceptFriendRequest(requestId: string): Promise<boolean>

// Decline friend request
export async function declineFriendRequest(requestId: string): Promise<boolean>

// Remove friend
export async function removeFriend(uid1: string, uid2: string): Promise<boolean>

// Block/unblock friend
export async function toggleBlockFriend(
  blockerUid: string,
  blockedUid: string,
  block: boolean
): Promise<boolean>

// Update streak (called when message sent)
export async function updateStreak(
  friendshipId: string,
  senderUid: string
): Promise<boolean>
```

---

## Screens to Create/Update (Phase 2)

### 1. **FriendsScreen** (MAIN - New Content)
Location: `src/screens/friends/FriendsScreen.tsx`

**Tabs/Sections:**
- **Friends List** (default tab)
  - Search bar to find friends
  - List of all friends with streak count
  - Tap friend → friend details (future: open chat in Phase 3)
  - Swipe/delete to remove friend (optional)

- **Requests** (tab or modal)
  - "Received" sub-tab: Pending requests to you
    - Accept / Decline buttons
  - "Sent" sub-tab: Requests you sent
    - Cancel button
  - Count badge on tab icon

- **Add Friend** (button/modal)
  - Search by username input
  - Search results showing matching users
  - "Send Request" button
  - Loading state + error handling
  - Success confirmation

**UI Components:**
- Friend list item: [Avatar Color] Username - "🔥 15 streak" (red text if active)
- Request item: Username - "Sent 2 days ago" / "New request"
- Search result: Username - "Send Request" button
- Empty states: "No friends yet", "No pending requests"

### 2. **FriendDetailsModal** (NEW - Optional for Phase 2)
Location: `src/screens/friends/FriendDetailsModal.tsx`

**Shows:**
- Friend's avatar (color)
- Username
- Display name
- Current streak
- Friendship date ("Friends since...")
- Action buttons: Message (disabled until Phase 3), Remove Friend, Block

---

## Types to Add (Phase 2)

Update `src/types/models.ts`:

```typescript
// Existing: User, Chat, Message, Story, etc.

export interface FriendRequest {
  id: string;
  from: string;              // Sender UID
  to: string;                // Receiver UID
  status: "pending" | "accepted" | "declined";
  createdAt: number;
  respondedAt?: number;
}

export interface Friend {
  id: string;                // Friendship document ID
  users: [string, string];   // [uid1, uid2]
  createdAt: number;
  streakCount: number;
  streakUpdatedDay: string;  // "YYYY-MM-DD"
  lastSentDay_uid1?: string;
  lastSentDay_uid2?: string;
  blockedBy?: string | null;
}
```

---

## Expected User Flow (Phase 2)

### Adding a Friend
```
Friends Screen
  ↓ (tap "Add Friend")
Add Friend Modal
  ↓ (type username)
Search Results
  ↓ (tap "Send Request")
Request Sent ✓
  ↓
Friend sees notification (Phase 6) or visits Friends screen
  ↓ (tap "Accept")
Friendship Created!
  ↓ Both users see each other in Friends List
```

### Accepting Friend Request
```
Friends Screen → Requests Tab
  ↓ (shows pending requests)
"john_doe" - New request
  ↓ (tap "Accept")
Request Accepted!
  ↓
john_doe appears in Friends List
  ↓ Streak counter starts at 0
```

### Friends List
```
Friends List shows:

🟨 john_doe         [🔥 12 Streak]  [Remove]
🟦 jane_smith       [🔥 5 Streak]   [Remove]
🟥 bob_jones        [🔥 0 Streak]   [Remove]

Tap friend → Opens Friend Details (or chat in Phase 3)
```

---

## Testing Checklist (Phase 2)

- [ ] Create 2 test accounts (test1@, test2@)
- [ ] Log in as User 1
- [ ] Search for User 2 by username
- [ ] Send friend request
- [ ] Log out, log in as User 2
- [ ] View pending requests
- [ ] Accept request
- [ ] Both users see each other in friends list
- [ ] Streak count shows as 0
- [ ] Decline a request (test different flow)
- [ ] Remove a friend
- [ ] Try adding yourself (should fail gracefully)
- [ ] Verify Firestore collections created correctly
- [ ] Check security rules allow/deny correctly

---

## What NOT to Do in Phase 2

- ❌ Don't build Chat/Messaging yet (Phase 3)
- ❌ Don't add notifications (Phase 6)
- ❌ Don't build stories (Phase 5)
- ❌ Don't build games (Phase 6)
- ❌ Don't implement cosmetics/avatars fully (Phase 7)

---

## Dependency Check

**Phase 2 depends on Phase 1:**
- ✅ Firebase Authentication working
- ✅ User profiles created
- ✅ Usernames reserved in Firestore
- ✅ Navigation structure
- ✅ UserContext with profile loading

**Phase 2 does NOT need:**
- ❌ Chat/Messages
- ❌ Stories
- ❌ Photos/Camera
- ❌ Games/Leaderboards
- ❌ Push Notifications

---

## Phase 2 Deliverables

**Code Files (New):**
- `src/services/friends.ts` - All friend operations
- `src/screens/friends/FriendsScreen.tsx` - Main friends screen
- `src/screens/friends/FriendDetailsModal.tsx` (optional) - Friend details

**Code Updates:**
- `src/types/models.ts` - Add FriendRequest, Friend types
- `src/screens/profile/ProfileScreen.tsx` (optional) - Add "View Profile" button for others
- Firestore security rules - Add Friends + FriendRequests rules

**Documentation:**
- `PHASE_2_COMPLETE.md` - Phase 2 summary

---

## Phase 2 Success Criteria

✅ Can add friends by username  
✅ Friend requests show pending state  
✅ Can accept/decline requests  
✅ Friends list shows all friends  
✅ Streak counter visible  
✅ Firestore saves all relationships  
✅ Security rules protect data  
✅ TypeScript: 0 errors  
✅ ESLint: 0 errors, 0 warnings  
✅ All features tested manually  

---

## Ready for Phase 2?

When all Phase 1 features work:
- ✅ Create account
- ✅ Customize profile (username, display name, avatar)
- ✅ Log in with existing account
- ✅ Edit profile
- ✅ Sign out

**You're ready! Let's build Phase 2 now.**

---

**Next:** I'll implement Phase 2 with:
1. Firestore collections + security rules
2. `friends.ts` service with all logic
3. `FriendsScreen.tsx` with full UI
4. Type definitions
5. Complete testing

Ready to start? 🚀
