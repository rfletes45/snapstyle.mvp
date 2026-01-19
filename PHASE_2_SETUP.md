# PHASE 2 SETUP & IMPLEMENTATION

**Status:** Ready to Implement  
**Date:** January 19, 2026

---

## Step 1: Update Firestore Security Rules

Before implementing Phase 2 code, you need to allow Friend and FriendRequest collections in Firestore.

### Update Your Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select **gamerapp-37e70** project
3. Go to **Firestore Database** → **Rules** tab
4. Replace ALL rules with this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users - only user can read/write their own profile
    match /Users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }

    // Usernames - all authenticated users can read/write (for availability checks)
    match /Usernames/{username} {
      allow read, write: if request.auth != null;
    }

    // Friends - users can read/write if they're part of the friendship
    match /Friends/{friendId} {
      allow read: if request.auth != null &&
                     (request.auth.uid in resource.data.users);
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null &&
                               (request.auth.uid in resource.data.users);
    }

    // FriendRequests - users can read/write their own requests
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

5. Click **Publish**
6. Wait 1-2 minutes for rules to apply

---

## Step 2: Add Friend Types to Models

The `Friend` and `FriendRequest` types are already defined in `src/types/models.ts` from the Phase 0 bootstrap, so no changes needed there.

**Verify** these types exist:

- `Friend` - Friendship with users, streak, dates
- `FriendRequest` - Request with from/to/status

Check: `src/types/models.ts` lines 20-35

---

## Step 3: Create Friends Service

Create new file: `src/services/friends.ts`

This will contain all friend operations.

---

## Step 4: Implement FriendsScreen

Update file: `src/screens/friends/FriendsScreen.tsx`

This will replace the placeholder with full UI.

---

## Step 5: Test Complete Phase 2

Once implemented, test the full flow:

- Create 2 accounts
- Add friend by username
- Accept/decline requests
- View friends list
- Verify Firestore data

---

## Implementation Order

This is the order I'll implement Phase 2:

1. **Create `src/services/friends.ts`** (service layer)
   - All friend CRUD operations
   - Username lookup
   - Streak updates
   - Request management

2. **Update `src/screens/friends/FriendsScreen.tsx`** (UI)
   - Friends list with search
   - Friend requests section
   - Add friend modal
   - Full interactivity

3. **Update Firestore Rules** (security)
   - Allow Friends collection access
   - Allow FriendRequests collection access
   - Enforce user-level permissions

4. **Testing & Verification**
   - Type check: 0 errors
   - Lint check: 0 errors
   - Manual testing with 2 accounts
   - Firestore verification

---

## Ready?

Let me know when you've updated the Firestore security rules, and I'll start implementing Phase 2 code!

The rules update should take 1-2 minutes to propagate.

**Next: I'll create `friends.ts` service and implement `FriendsScreen.tsx`**
