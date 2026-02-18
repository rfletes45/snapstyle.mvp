# Chat Backend Flows

> Cloud Functions, Firestore triggers, scheduled jobs, and their validations.

---

## 1. Cloud Functions Inventory

All chat-related Cloud Functions are in `firebase-backend/functions/src/`:

| Function                         | Type                  | File             | Purpose                                       |
| -------------------------------- | --------------------- | ---------------- | --------------------------------------------- |
| `sendMessageV2`                  | `onCall`              | `messaging.ts`   | Server-authoritative message creation         |
| `editMessageV2`                  | `onCall`              | `messaging.ts`   | Edit message text (15-min window)             |
| `deleteMessageForAllV2`          | `onCall`              | `messaging.ts`   | Delete message for all participants           |
| `toggleReactionV2`               | `onCall`              | `messaging.ts`   | Add/remove emoji reaction                     |
| `fetchLinkPreviewFunction`       | `onCall`              | `linkPreview.ts` | Server-side OG tag scraper                    |
| `onNewMessage`                   | Firestore trigger     | `legacy.ts`      | DM push notifications + streak update         |
| `onNewGroupMessageV2`            | Firestore trigger     | `legacy.ts`      | Group push notifications                      |
| `processScheduledMessages`       | Scheduled (1 min)     | `legacy.ts`      | Deliver scheduled messages                    |
| `cleanupOldScheduledMessages`    | Scheduled (daily 3AM) | `legacy.ts`      | Delete old scheduled messages                 |
| `onNewMessageEvent`              | Firestore trigger     | `legacy.ts`      | Message-related event processing              |
| `checkMessageRateLimit`          | `onCall`              | `legacy.ts`      | Client-callable rate limit check              |
| `sendFriendRequestWithRateLimit` | `onCall`              | `legacy.ts`      | Rate-limited friend request (chat dependency) |
| `updateExpiredBans`              | Scheduled             | `legacy.ts`      | Unban expired users                           |

**Entry point**: `firebase-backend/functions/src/index.ts` imports and re-exports all functions.

---

## 2. `sendMessageV2` — Detailed

**File**: `firebase-backend/functions/src/messaging.ts` (line ~268)

### Input Schema

```typescript
{
  conversationId: string;   // Chat ID or Group ID
  scope: "dm" | "group";    // Conversation type
  kind: MessageKind;         // "text" | "media" | "voice" | "file" | "game_invite" | "scorecard"
  text?: string;             // Message text (max 10,000 chars)
  messageId: string;         // Client-generated UUID
  clientId: string;          // Stable device ID
  replyTo?: ReplyToMetadata; // Reply metadata
  mentionUids?: string[];    // Mentioned user UIDs (max 5)
  attachments?: AttachmentV2[]; // Uploaded attachments (max 10)
  linkPreview?: LinkPreviewV2;  // Pre-fetched link preview
  scorecard?: object;        // Game scorecard data
}
```

### Validation Steps

1. **Auth** — `context.auth` must exist.
2. **Required fields** — `conversationId`, `scope`, `kind`, `clientId`, `messageId` must be present and valid strings.
3. **Text length** — If `text` present, must be ≤ 10,000 chars.
4. **Mentions** — If `mentionUids` present, must be array with ≤ 5 entries.
5. **Attachments** — If `attachments` present, must be array with ≤ 10 entries.
6. **Membership** (DM):
   - Read `Chats/{conversationId}`, verify `uid in members`.
   - If chat doesn't exist, throw `not-found`.
7. **Membership** (Group):
   - Read `Groups/{conversationId}`, verify `uid in memberIds`.
8. **Block check** (DM only):
   - Check `Users/{uid}/blockedUsers/{otherUid}` — sender blocked recipient?
   - Check `Users/{otherUid}/blockedUsers/{uid}` — recipient blocked sender?
   - Either direction → `permission-denied`.
9. **Rate limit** — Transaction on conversation doc:
   - Counter field tracks messages per minute.
   - Limit: **30 messages/minute** per conversation.
   - If exceeded, throw `resource-exhausted`.

### Idempotency

```
Read Messages/{messageId}:
  - If exists AND idempotencyKey matches → return existing doc (no duplicate)
  - If exists AND idempotencyKey differs → throw "conflict"
  - If not exists → proceed with write
```

### Write

```typescript
const messageDoc = {
  // V2 fields
  id: messageId,
  scope,
  conversationId,
  senderId: uid,
  senderName: userDoc.displayName,
  senderAvatarConfig: userDoc.avatarConfig,
  kind,
  text: text || "",
  createdAt: data.createdAt || Date.now(),
  serverReceivedAt: FieldValue.serverTimestamp(),
  clientId,
  idempotencyKey: `${clientId}:${messageId}`,
  replyTo: replyTo || null,
  mentionUids: mentionUids || [],
  attachments: attachments || [],
  linkPreview: linkPreview || null,
  reactionsSummary: {},
  hiddenFor: [],
  deletedForAll: null,

  // V1 legacy fields (backward compat)
  sender: uid,
  content: text || "",
  type: kind === "media" ? "image" : kind === "text" ? "text" : kind,
  read: false,
  status: "sent",
};
```

### Post-Write Updates

1. **Conversation preview** — Update parent doc (`Chats` or `Groups`):
   - `lastMessageText`, `lastMessageAt`, `lastMessageSenderId`
2. **Return** — `{ success: true, messageId, serverReceivedAt }`

---

## 3. `editMessageV2` — Detailed

**File**: `firebase-backend/functions/src/messaging.ts` (line ~649)

### Validations

1. Auth required.
2. Read existing message.
3. **Sender only** — `message.senderId === uid`.
4. **Not deleted** — `!message.deletedForAll`.
5. **15-min window** — `serverTimestamp - message.serverReceivedAt < 900000ms`.
6. **Text messages only** — `message.kind === "text"`.

### Write

```typescript
update({
  text: newText,
  editedAt: FieldValue.serverTimestamp(),
  editHistory: FieldValue.arrayUnion({
    text: originalText,
    editedAt: FieldValue.serverTimestamp(),
  }),
  // Legacy compat
  content: newText,
});
```

---

## 4. `deleteMessageForAllV2` — Detailed

**File**: `firebase-backend/functions/src/messaging.ts` (line ~811)

### Authorization

| Scenario      | Who can delete | Time constraint             |
| ------------- | -------------- | --------------------------- |
| DM message    | Sender only    | Within edit window (15 min) |
| Group message | Sender         | Within edit window          |
| Group message | Admin / Owner  | Any time                    |

### Write

```typescript
update({
  deletedForAll: { by: uid, at: FieldValue.serverTimestamp() },
  text: "[Message deleted]",
  attachments: FieldValue.delete(),
  linkPreview: FieldValue.delete(),
  // Legacy compat
  content: "[Message deleted]",
});
```

**Idempotent**: If `deletedForAll` already set, returns success without re-writing.

---

## 5. `toggleReactionV2` — Detailed

**File**: `firebase-backend/functions/src/messaging.ts` (line ~1024)

### Rate Limit

10 reactions per minute per user per conversation.

### Allowed Emojis

```typescript
const ALLOWED_EMOJIS = [
  "❤️",
  "🔥",
  "😂",
  "😮",
  "😢",
  "👍",
  "👎",
  "🎉",
  "💯",
  "🙏",
  "😍",
  "🤔",
  "👀",
  "💀",
  "🫡",
  "🦆",
];
```

### Transaction Logic

```
Read: Reactions/{emoji} doc
  - If user in uids → REMOVE (untoggle)
  - If user not in uids → ADD
    - Check: total unique emojis on message ≤ 12

Write:
  1. Reactions/{emoji}: arrayUnion/arrayRemove user uid
  2. Messages/{messageId}: update reactionsSummary
     - reactionsSummary[emoji] = new count
     - If count === 0, delete the key
```

---

## 6. `onNewMessage` — DM Push Notification Trigger

**File**: `firebase-backend/functions/src/legacy.ts` (line ~156)

**Trigger**: `Chats/{chatId}/Messages/{messageId}` — `onCreate`

### Flow

1. Read chat doc to get `members`.
2. Determine recipient (the member who isn't the sender).
3. **Mute check** — `isDmChatMuted(chatId, recipientUid)`:
   - Reads `Chats/{chatId}/MembersPrivate/{recipientUid}`.
   - If `mutedUntil === -1` (forever) or `mutedUntil > now` → skip notification.
   - File: `firebase-backend/functions/src/utils.ts`
4. **Block check** — Skip if sender is blocked by recipient.
5. **Get push token** — Read `Users/{recipientUid}.expoPushToken`.
6. **Send push** — `sendExpoPushNotification()` via Expo Push API.
   - Title: sender's display name
   - Body: message preview
   - Data: `{ chatId, messageId, type: "dm_message" }`
7. **Update streaks** — If enabled, increment `Friends/{friendId}.streakCount`.

---

## 7. `onNewGroupMessageV2` — Group Push Notification Trigger

**File**: `firebase-backend/functions/src/legacy.ts` (line ~326)

**Trigger**: `Groups/{groupId}/Messages/{messageId}` — `onCreate`

### Flow

1. Read group doc to get `memberIds`.
2. For **each member** (except sender):
   a. **Mute check** — `isGroupMuted(groupId, memberId)`:
   - Reads `Groups/{groupId}/MembersPrivate/{memberId}`.
   - Check `mutedUntil`.
     b. **Notify level check**:
   - `"none"` → skip
   - `"mentions"` → only notify if `mentionUids.includes(memberId)`
   - `"all"` → notify
     c. **Get push token** and send.
3. **Differentiated push body**:
   - Regular: `"{senderName}: {messagePreview}"`
   - Mention: `"{senderName} mentioned you: {messagePreview}"`

---

## 8. `processScheduledMessages` — Cron Job

**File**: `firebase-backend/functions/src/legacy.ts` (line ~1082)

**Schedule**: Every 1 minute (`schedule("every 1 minutes")`)

### Flow

1. Query `ScheduledMessages` where `status == "pending"` AND `scheduledFor <= now`.
2. For each scheduled message:
   a. Determine target collection (`Chats/{chatId}/Messages` or `Groups/{chatId}/Messages`).
   b. Create message doc with standard fields + `serverReceivedAt`.
   c. Update conversation preview.
   d. Mark scheduled message as `status: "sent"`, set `deliveredAt`, `deliveredMessageId`.
   e. On error: set `status: "failed"`, `failureReason`.

### Cleanup

`cleanupOldScheduledMessages` runs daily at 3 AM UTC. Deletes `sent`, `cancelled`, or `failed` scheduled messages older than 30 days.

---

## 9. `fetchLinkPreviewFunction` — Link Preview

**File**: `firebase-backend/functions/src/linkPreview.ts`

### Flow

1. Validate URL (not blocked domain).
2. Check Firestore cache (`LinkPreviews/{urlHash}`):
   - If exists and `expiresAt > now` → return cached.
3. Fetch URL with timeout (5s).
4. Parse HTML for OG tags: `og:title`, `og:description`, `og:image`, `og:site_name`.
5. Store in cache with 24-hour TTL.
6. Return preview data.

### Blocked Domains

Maintained in `BLOCKED_DOMAINS` constant in `linkPreview.ts`. Prevents fetching from known malicious/adult domains.

---

## 10. Auth & Authorization Summary

### Cloud Function Auth

All callable functions require `context.auth` (Firebase Auth). Anonymous calls are rejected.

### Firestore Rules — Chat Paths

| Path                                          | Read                           | Write                                                                    | Notes            |
| --------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------ | ---------------- |
| `Chats/{id}`                                  | Member only (`uid in members`) | Create: `members.size()==2`; Update: member only, can't change `members` |                  |
| `Chats/{id}/Messages/{mid}`                   | Member only                    | Create: member; Update: complex (see below)                              |                  |
| `Chats/{id}/Members/{uid}`                    | Any chat member                | Owner only (`uid == auth.uid`)                                           |                  |
| `Chats/{id}/MembersPrivate/{uid}`             | Owner only                     | Owner only                                                               | Privacy enforced |
| `Chats/{id}/Messages/{mid}/Reactions/{emoji}` | Member                         | Create: `uid == auth.uid`; Delete: owner only                            |                  |
| `Groups/{id}`                                 | Member only                    | Create: `ownerId == auth.uid`; Update: member or invite acceptor         |                  |
| `Groups/{id}/Messages/{mid}`                  | Member                         | Create: member; Update: same as DM + admin delete                        |                  |
| `Groups/{id}/Members/{uid}`                   | Member                         | Self-create, admin-add, self-leave, admin-remove                         |                  |
| `Groups/{id}/MembersPrivate/{uid}`            | Owner only                     | Owner only                                                               |                  |
| `GroupInvites/{id}`                           | Sender or recipient            | Create: `fromUid == auth.uid`; Update: `toUid` for accept/decline        |                  |
| `ScheduledMessages/{id}`                      | Sender only                    | Full CRUD by sender only                                                 |                  |

### Message Update Rules (Firestore)

The message update rule supports 5 distinct cases:

1. **Delete-for-me** — Any member can add self to `hiddenFor[]`
2. **Delete-for-all** — Sender only (DM), or sender/admin/owner (Group)
3. **Edit** — Sender only, within 15-min window, text messages only
4. **Scorecard edit** — Sender only, no time limit (for game score updates)
5. **Legacy read mark** — Set `read: true` (V1 compatibility)

---

## 11. Rate Limiting

| Function                | Limit                                      | Implementation                          |
| ----------------------- | ------------------------------------------ | --------------------------------------- |
| `sendMessageV2`         | 30 msgs/min per conversation               | Transaction counter on conversation doc |
| `toggleReactionV2`      | 10 reactions/min per user per conversation | Transaction counter                     |
| `checkMessageRateLimit` | Callable to pre-check before send          | Same counter read                       |

**Implementation pattern** (in `messaging.ts`):

```typescript
// Transaction on conversation doc
const counter = conversationDoc.rateLimitCounter || {};
const minuteKey = Math.floor(Date.now() / 60000).toString();
const currentCount = counter[minuteKey] || 0;
if (currentCount >= RATE_LIMIT) {
  throw new HttpsError("resource-exhausted", "Rate limit exceeded");
}
counter[minuteKey] = currentCount + 1;
// Clean old counters in same transaction
```

---

## 12. Backend Data Flow Diagram

```
Client sends message:
  httpsCallable("sendMessageV2")
    │
    ▼
  Cloud Function: sendMessageV2
    ├── 1. Auth check
    ├── 2. Field validation
    ├── 3. Membership check (read Chats/Groups doc)
    ├── 4. Block check (DM: read blockedUsers subcollections)
    ├── 5. Rate limit (transaction on conversation doc)
    ├── 6. Idempotency check (read Messages/{id})
    ├── 7. Write message doc (Messages/{id})
    ├── 8. Update conversation preview (Chats/Groups doc)
    └── 9. Return { success, messageId, serverReceivedAt }
              │
              ▼
  Firestore trigger: onNewMessage / onNewGroupMessageV2
    ├── 1. Read conversation doc (members)
    ├── 2. For each recipient:
    │     ├── Mute check (MembersPrivate)
    │     ├── Block check (blockedUsers)
    │     ├── Notify level check (group only)
    │     └── Send push notification (Expo)
    └── 3. Update streaks (DM only)
```
