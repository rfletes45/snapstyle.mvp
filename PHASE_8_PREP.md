# Phase 8: Safety + Polish - Preparation Document

**Status:** In Progress  
**Start Date:** January 2026  
**Goal:** Add user safety features (block/report) and final polish

---

## 📋 Overview

Phase 8 adds essential safety features for a social app:

1. **Block User** - Prevent unwanted interactions
2. **Report User** - Flag inappropriate content/behavior
3. **Security Rules** - Firestore and Storage protection
4. **UI Polish** - Final touches and consistency

---

## 🎯 Features to Implement

### 1. Block User Feature

**Purpose:** Allow users to completely block another user from:

- Sending friend requests
- Sending messages
- Viewing stories

**Data Model:**

```typescript
// BlockedUser document in Users/{userId}/blockedUsers/{blockedUserId}
interface BlockedUser {
  blockedUserId: string;
  blockedAt: number;
  reason?: string;
}
```

**UI Locations:**

- Profile view (long press on friend)
- Chat screen (settings/menu)
- Friends screen (swipe action or menu)

**Behavior:**

- Blocked users cannot see the blocker's content
- Existing friendships are removed when blocking
- Blocked user is not notified
- User can unblock from settings

### 2. Report User Feature

**Purpose:** Allow users to report inappropriate behavior

**Data Model:**

```typescript
// Report document in Reports collection
interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason:
    | "spam"
    | "harassment"
    | "inappropriate_content"
    | "fake_account"
    | "other";
  description?: string;
  createdAt: number;
  status: "pending" | "reviewed" | "resolved";
  relatedContent?: {
    type: "message" | "story" | "profile";
    contentId?: string;
  };
}
```

**Report Reasons:**

1. Spam or scam
2. Harassment or bullying
3. Inappropriate content
4. Fake account/impersonation
5. Other (with text field)

**UI Flow:**

1. User taps "Report" on profile/chat
2. Modal shows reason options
3. Optional description field
4. Submit → Thank you message
5. Report saved to Firestore for review

### 3. Security Rules

**Firestore Rules:**

- Users can only read/write their own data
- Friends collection: only participants can read
- Messages: only chat members can read/write
- Reports: users can create, only admins can read all
- Block list: only owner can read/write

**Storage Rules:**

- Profile images: owner can write, friends can read
- Chat images: only chat participants can read/write
- Story images: owner writes, friends read

### 4. UI Polish

**Improvements:**

- Loading states consistency
- Error handling improvements
- Empty state designs
- Animation polish
- Color consistency
- Accessibility improvements

---

## 📁 Files to Create/Modify

### New Files

```
src/
├── services/
│   ├── blocking.ts          # Block/unblock logic
│   └── reporting.ts         # Report submission
├── components/
│   ├── BlockUserModal.tsx   # Block confirmation modal
│   └── ReportUserModal.tsx  # Report form modal
├── screens/
│   └── settings/
│       └── BlockedUsersScreen.tsx  # Manage blocked users

firebase/
├── firestore.rules          # Security rules (update)
└── storage.rules            # Storage rules (update)
```

### Modified Files

```
src/
├── services/
│   ├── friends.ts           # Check blocks before friend actions
│   └── chat.ts              # Filter blocked users
├── screens/
│   ├── friends/FriendsScreen.tsx    # Add block option
│   ├── chat/ChatScreen.tsx          # Add report/block menu
│   └── profile/ProfileScreen.tsx    # Add blocked users setting
├── types/
│   └── models.ts            # Add BlockedUser, Report types
```

---

## 🔒 Security Rules Design

### Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function isFriend(userId) {
      return exists(/databases/$(database)/documents/Friends/$(request.auth.uid + '_' + userId))
          || exists(/databases/$(database)/documents/Friends/$(userId + '_' + request.auth.uid));
    }

    function isNotBlocked(userId) {
      return !exists(/databases/$(database)/documents/Users/$(userId)/blockedUsers/$(request.auth.uid));
    }

    // Users collection
    match /Users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);

      // Inventory subcollection
      match /inventory/{itemId} {
        allow read, write: if isOwner(userId);
      }

      // Blocked users subcollection
      match /blockedUsers/{blockedId} {
        allow read, write: if isOwner(userId);
      }
    }

    // Friends collection
    match /Friends/{friendshipId} {
      allow read: if isAuthenticated() &&
                    request.auth.uid in resource.data.users;
      allow create: if isAuthenticated() &&
                      request.auth.uid in request.resource.data.users;
      allow update, delete: if isAuthenticated() &&
                              request.auth.uid in resource.data.users;
    }

    // Friend Requests
    match /FriendRequests/{requestId} {
      allow read: if isAuthenticated() &&
                    (resource.data.from == request.auth.uid ||
                     resource.data.to == request.auth.uid);
      allow create: if isAuthenticated() &&
                      request.resource.data.from == request.auth.uid &&
                      isNotBlocked(request.resource.data.to);
      allow delete: if isAuthenticated() &&
                      (resource.data.from == request.auth.uid ||
                       resource.data.to == request.auth.uid);
    }

    // Chats collection
    match /Chats/{chatId} {
      allow read, write: if isAuthenticated() &&
                           request.auth.uid in resource.data.members;

      // Messages subcollection
      match /Messages/{messageId} {
        allow read: if isAuthenticated() &&
                      request.auth.uid in get(/databases/$(database)/documents/Chats/$(chatId)).data.members;
        allow create: if isAuthenticated() &&
                        request.auth.uid in get(/databases/$(database)/documents/Chats/$(chatId)).data.members &&
                        request.resource.data.sender == request.auth.uid;
        allow update, delete: if isAuthenticated() &&
                                request.auth.uid in get(/databases/$(database)/documents/Chats/$(chatId)).data.members;
      }
    }

    // Stories collection
    match /Stories/{storyId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() &&
                      request.resource.data.userId == request.auth.uid;
      allow update, delete: if isAuthenticated() &&
                              resource.data.userId == request.auth.uid;
    }

    // Reports collection
    match /Reports/{reportId} {
      allow create: if isAuthenticated() &&
                      request.resource.data.reporterId == request.auth.uid;
      allow read: if false; // Only admin access via Cloud Functions
    }
  }
}
```

### Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // Profile images
    match /profiles/{userId}/{fileName} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);
    }

    // Chat images (snaps)
    match /chats/{chatId}/{fileName} {
      // Chat members determined by chatId format: uid1_uid2
      allow read, write: if isAuthenticated() &&
                           (chatId.matches(request.auth.uid + '_.*') ||
                            chatId.matches('.*_' + request.auth.uid));
    }

    // Story images
    match /stories/{userId}/{fileName} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);
    }
  }
}
```

---

## 🧪 Test Scenarios

### Block User Tests

1. Block a user → Friendship removed
2. Blocked user cannot send friend request
3. Blocked user doesn't see blocker's stories
4. Unblock user → Can interact again

### Report User Tests

1. Submit report with reason
2. Submit report with description
3. Report appears in Firestore
4. Success feedback shown

### Security Rule Tests

1. User cannot read other user's private data
2. Non-friends cannot send messages
3. Blocked users cannot send friend requests
4. Only chat members can read messages

---

## 📊 Success Criteria

- [ ] Block/unblock user functionality
- [ ] Report user with reason selection
- [ ] Blocked users list management
- [ ] Firestore security rules deployed
- [ ] Storage security rules deployed
- [ ] UI feedback for all safety actions
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors

---

## ⏱️ Estimated Timeline

| Task                  | Estimate     |
| --------------------- | ------------ |
| Block service + UI    | 2 hours      |
| Report service + UI   | 1.5 hours    |
| Firestore rules       | 1 hour       |
| Storage rules         | 0.5 hours    |
| Integration + testing | 1.5 hours    |
| UI polish             | 1 hour       |
| Documentation         | 0.5 hours    |
| **Total**             | **~8 hours** |

---

## 🚀 Ready to Start!

**First step:** Create blocking service and data model.
