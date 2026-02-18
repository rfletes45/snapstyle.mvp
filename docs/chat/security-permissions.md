# Chat Security & Permissions

> AuthN/AuthZ, Firestore rules, Storage rules, blocking, and threat model notes.

---

## 1. Authentication

### Client-Side

- Firebase Auth provides the UID used throughout.
- Auth state managed by `src/store/AuthContext.tsx`, providing `currentUser.uid` to all chat hooks/screens.
- All Firestore SDK calls inherit the client's auth token automatically.

### Server-Side (Cloud Functions)

- All `onCall` functions receive `context.auth`.
- First check in every function: `if (!context.auth) throw new HttpsError("unauthenticated")`.
- UID extracted as `const uid = context.auth.uid`.

### No Anonymous Access

- Firestore rules use `isAuth()` → `request.auth != null` as a baseline.
- No chat functionality is available without authentication.

---

## 2. Authorization Model

### DM Conversations

| Action                  | Who                    | Rule Basis                                           |
| ----------------------- | ---------------------- | ---------------------------------------------------- |
| Read chat doc           | Either member          | `request.auth.uid in resource.data.members`          |
| Create chat             | Any authenticated user | `members.size() == 2 && request.auth.uid in members` |
| Read messages           | Either member          | Inherited from chat membership                       |
| Send message            | Either member          | CF membership check + Firestore rule                 |
| Edit message            | Original sender only   | CF: `message.senderId === uid`, 15-min window        |
| Delete for me           | Self only              | Rule: `request.auth.uid` added to `hiddenFor`        |
| Delete for all          | Sender only            | CF: `message.senderId === uid`, within window        |
| Read own private state  | Self only              | `MembersPrivate/{uid}` — `isOwner(uid)`              |
| Update own public state | Self only              | `Members/{uid}` — `isOwner(uid)`                     |

### Group Conversations

| Action         | Who                                  | Rule Basis                                    |
| -------------- | ------------------------------------ | --------------------------------------------- |
| Read group doc | Any member                           | `request.auth.uid in resource.data.memberIds` |
| Create group   | Any authenticated user               | `ownerId == request.auth.uid`                 |
| Update group   | Any member + invite acceptors        | Rule allows `memberIds` array modification    |
| Send message   | Any member                           | CF membership check                           |
| Edit message   | Sender only                          | Same as DM                                    |
| Delete for all | Sender OR admin/owner                | CF checks `role` in `Members/{uid}`           |
| Add member     | Self (invite accept), or owner/admin | Rule checks role                              |
| Remove member  | Self (leave), or admin/owner         | Rule checks role                              |
| Change role    | Owner only                           | Rule: `isGroupOwner()`                        |
| Delete group   | Owner only                           | Firestore rule                                |

### Group Roles

Defined in `src/types/models.ts` as `GroupRole = "owner" | "admin" | "member"`.

| Role     | Can send | Can delete others' msgs | Can add/remove members  | Can change roles | Can delete group |
| -------- | -------- | ----------------------- | ----------------------- | ---------------- | ---------------- |
| `member` | ✅       | ❌                      | ❌                      | ❌               | ❌               |
| `admin`  | ✅       | ✅                      | ✅ (add/remove members) | ❌               | ❌               |
| `owner`  | ✅       | ✅                      | ✅                      | ✅               | ✅               |

---

## 3. Firestore Security Rules — Chat Detail

**File**: `firebase-backend/firestore.rules`

### 3.1. Chats Collection

```
match /Chats/{chatId} {
  // Read: member only
  allow read: if isAuth() && request.auth.uid in resource.data.members;

  // Create: exactly 2 members, creator must be a member
  allow create: if isAuth() &&
    request.resource.data.members is list &&
    request.resource.data.members.size() == 2 &&
    request.auth.uid in request.resource.data.members;

  // Update: member only, cannot change members array
  allow update: if isAuth() &&
    request.auth.uid in resource.data.members &&
    request.resource.data.members == resource.data.members;
}
```

### 3.2. Messages Subcollection (DM)

```
match /Chats/{chatId}/Messages/{messageId} {
  allow read: if isAuth() && request.auth.uid in get(/databases/$(database)/documents/Chats/$(chatId)).data.members;

  allow create: if isAuth() && request.auth.uid in get(...).data.members;

  allow update: if isAuth() && (
    // Case 1: Delete-for-me (add self to hiddenFor)
    // Case 2: Delete-for-all (sender sets deletedForAll)
    // Case 3: Edit (sender, within 15-min, text only)
    // Case 4: Scorecard edit (sender, no time limit)
    // Case 5: Legacy V1 read mark
  );
}
```

**Key validation in edit case**:

```
// 15-minute edit window check
request.time.toMillis() - resource.data.serverReceivedAt.toMillis() < 900000
```

### 3.3. Group Messages

Same pattern as DM, plus:

- Admin/owner can `deleteForAll` any message (via `isAdminOrOwner()` helper).
- Helper function reads `Groups/{groupId}/Members/{uid}` to check `role`.

### 3.4. Reactions

```
match /.../Reactions/{reactionId} {
  allow read: if isAuth();  // Any member can read
  allow create: if isAuth() && request.resource.data.uid == request.auth.uid;
  allow delete: if isAuth() && resource.data.uid == request.auth.uid;
  // No update allowed — toggle is handled by CF
}
```

**Note**: The Firestore rules for reactions exist as a fallback. In practice, reactions are managed by the `toggleReactionV2` Cloud Function which uses admin SDK (bypasses rules). The client-facing rules prevent direct manipulation.

### 3.5. Members / MembersPrivate

```
// Public: any chat member can read, only self can write
match /Members/{uid} {
  allow read: if isAuth() && isChatMember();
  allow write: if isAuth() && isOwner(uid);
}

// Private: only self can read/write
match /MembersPrivate/{uid} {
  allow read, write: if isAuth() && isOwner(uid);
}
```

---

## 4. Storage Security Rules

**File**: `firebase-backend/storage.rules`

### Paths and Access

| Path                              | Read          | Write         | Constraints        |
| --------------------------------- | ------------- | ------------- | ------------------ |
| `pictures/{chatId}/**`            | Authenticated | Authenticated | Images only, ≤10MB |
| `dm-voice/{chatId}/**`            | Authenticated | Authenticated | Audio only, ≤5MB   |
| `groups/{groupId}/messages/**`    | Authenticated | Authenticated | Images only, ≤10MB |
| `groups/{groupId}/attachments/**` | Authenticated | Authenticated | Any type, ≤10MB    |
| `groups/{groupId}/voice/**`       | Authenticated | Authenticated | Audio only, ≤5MB   |
| `avatars/{userId}/**`             | Authenticated | Owner only    | Images, ≤5MB       |
| `users/{userId}/profile/**`       | Authenticated | Owner only    | Images, ≤5MB       |
| All other paths                   | Denied        | Denied        | Catch-all          |

### Validation Helpers

```
function isAuth() { return request.auth != null; }
function validFileSize(maxBytes) { return request.resource.size <= maxBytes; }
function isImage() { return request.resource.contentType.matches('image/.*'); }
function isValidImageType() {
  return request.resource.contentType in ['image/jpeg','image/png','image/gif','image/webp'];
}
```

### Known Gaps

- **Chat media reads are not scoped to members** — any authenticated user with the URL can read chat images. This relies on URL unguessability (Firebase Storage URLs contain a token). This is a common pattern but not zero-trust.
- **No per-member write scoping** — any authenticated user can write to `pictures/{chatId}/`, not just members. The CF `sendMessageV2` handles membership validation, but a user could upload to a chat's storage without being a member (the file would be orphaned).

---

## 5. Blocking System

**File**: `src/services/blocking.ts`

### Data Model

- `Users/{uid}/blockedUsers/{blockedUid}` — stores `{ blockedUserId, blockedAt, reason? }`
- Bidirectional: the system checks both directions.

### Enforcement Points

| Point                  | Check                                              | File                                     |
| ---------------------- | -------------------------------------------------- | ---------------------------------------- |
| `sendMessageV2` CF     | Reads both users' `blockedUsers` subcollections    | `messaging.ts`                           |
| `onNewMessage` trigger | Checks block before sending push                   | `legacy.ts`                              |
| Client send pipeline   | `blocking.ts :: hasBlockBetweenUsers()` (advisory) | `blocking.ts`                            |
| Friend requests        | `blockUser()` cancels pending requests             | `blocking.ts :: cancelPendingRequests()` |

### What Happens When User A Blocks User B

1. `blockedUsers/{B}` doc created under `Users/{A}`.
2. Pending friend requests between A and B are cancelled.
3. A can no longer send messages to B (CF rejects).
4. B can no longer send messages to A (CF rejects).
5. Push notifications from B to A are suppressed.
6. **Existing messages are NOT deleted** — conversation persists but new messages are blocked.
7. **Inbox still shows conversation** — user must delete it manually.
8. **Group chat unaffected** — blocking does not affect shared group conversations.

### Unblock

Deletes the `blockedUsers/{B}` doc. Communication can resume immediately.

---

## 6. Content Moderation

**File**: `src/services/moderation.ts`, `src/services/reporting.ts`

### Report System

Users can report:

- Messages: `reporting.ts :: reportMessage()`
- Users: `reporting.ts :: reportUserProfile()`
- Stories: `reporting.ts :: reportStory()`

Reports stored in `Reports/{reportId}` with:

- `reason`: `"spam"`, `"harassment"`, `"inappropriate_content"`, `"fake_account"`, `"other"`
- `status`: `"pending"` → `"reviewed"` → `"resolved"` or `"dismissed"`

### Trust & Safety

Moderation infrastructure in `moderation.ts`:

- **Bans**: `Bans/{uid}` collection — time-based or permanent
- **Warnings**: `UserWarnings/{uid}` — read/unread warnings
- **Strikes**: `UserStrikes/{uid}` — escalation ladder
- Admin functions: `adminSetBan`, `adminLiftBan`, `adminApplyWarning`, `adminApplyStrike`

### Rate Limiting as Anti-Spam

- Send: 30 msgs/min per conversation
- Reactions: 10/min per user per conversation
- These serve as basic anti-spam measures.

**No automated content scanning** — there is no profanity filter or ML-based content moderation in the code. The `moderation.ts` client service is about admin tools, not automated detection.

---

## 7. Privacy Controls

### User-Level Settings

**Source**: `InboxSettings` in `src/types/messaging.ts`, `src/services/inboxSettings.ts`

| Setting                | Default | Effect                                       |
| ---------------------- | ------- | -------------------------------------------- |
| `showReadReceipts`     | `true`  | Controls whether read watermark is published |
| `showTypingIndicators` | `true`  | Controls whether typing status is published  |
| `showOnlineStatus`     | `true`  | Controls whether presence is visible         |
| `showLastSeen`         | `true`  | Controls whether "last seen" time is visible |

These are checked **client-side** before publishing state. Hooks like `useTypingStatus` and `useReadReceipts` check InboxSettings before writing to Firestore.

### Per-Conversation Settings

**Source**: `MemberStatePrivate` in `src/types/messaging.ts`

| Setting            | Effect                                                        |
| ------------------ | ------------------------------------------------------------- |
| `sendReadReceipts` | Per-chat override of global setting                           |
| `notifyLevel`      | `"all"`, `"mentions"`, `"none"` — controls push notifications |
| `mutedUntil`       | Silences notifications until timestamp                        |
| `archived`         | Hides from main inbox view                                    |

---

## 8. Threat Model Notes

### Risks and Mitigations

| Threat                                  | Severity | Current Mitigation                                 | Gap                                                           |
| --------------------------------------- | -------- | -------------------------------------------------- | ------------------------------------------------------------- |
| **Spam flooding**                       | Medium   | Rate limit: 30 msgs/min                            | Per-conversation only; user could spam across conversations   |
| **Message spoofing**                    | Low      | CF always uses `context.auth.uid` as sender        | Server is authoritative                                       |
| **Read receipt tracking**               | Low      | Privacy settings disable publishing                | Client-side enforcement only — a modified client could ignore |
| **Unauthorized message read**           | Medium   | Firestore rules require membership                 | Rules correctly enforced                                      |
| **Media URL enumeration**               | Low      | Storage URLs include unguessable tokens            | Not signed/expired URLs — once known, accessible forever      |
| **Message injection (XSS)**             | Low      | React Native renders text, not HTML                | No HTML rendering; link previews use metadata only            |
| **Replay attacks (duplicate messages)** | Low      | Idempotency key in CF                              | Properly deduplicated                                         |
| **Clock skew attacks (ordering)**       | Low      | `serverReceivedAt` is server-authoritative         | Client `createdAt` used for intent only                       |
| **Blocked user escalation**             | Medium   | CF checks blocks on send                           | Admin SDK (CF) bypasses Firestore rules — correct behavior    |
| **Group role escalation**               | Medium   | Firestore rules + CF checks                        | Role changes restricted to owner                              |
| **Rate limit bypass**                   | Low      | Transaction-based counter                          | Counter lives on conversation doc; reset every minute         |
| **Large payload abuse**                 | Low      | Text: 10K chars, attachments: 10MB×10, mentions: 5 | Validated in CF                                               |
| **Scheduled message abuse**             | Low      | Sender-only CRUD, pending status required          | CF validates `scheduledFor > now`                             |

### Recommendations (Not Yet Implemented)

1. **Signed/expiring media URLs** — Current Storage URLs don't expire. Consider using `getSignedUrl()` with TTL.
2. **Server-side privacy enforcement** — Read receipt/typing privacy is client-enforced. A modified client could bypass.
3. **Global rate limiting** — Current rate limits are per-conversation. Add per-user global limits.
4. **Automated content moderation** — No automated scanning exists. Consider integrating Cloud Vision API or a profanity filter.
5. **Audit logging** — No admin audit trail for moderation actions.
6. **IP-based rate limiting** — Not possible with Firebase callable functions alone; would need middleware.
