# Firebase Backend Reference

> Firestore schema, security rules, Cloud Functions, and indexes

---

## Project Configuration

| Field         | Value                                     |
| ------------- | ----------------------------------------- |
| Project ID    | `gamerapp-37e70`                          |
| Region        | `us-central1`                             |
| Config File   | `firebase.json`                           |
| Rules         | `firebase-backend/firestore.rules`        |
| Storage Rules | `firebase-backend/storage.rules`          |
| Indexes       | `firebase-backend/firestore.indexes.json` |
| Functions     | `firebase-backend/functions/src/`         |

---

## Firestore Data Model

### Users Collection

```
Users/{uid}
├── uid: string
├── email: string
├── username: string (unique, lowercase)
├── usernameLower: string
├── displayName: string
├── avatarConfig: { hat, glasses, background, color }
├── profilePictureUrl?: string
├── decorationId?: string
├── expoPushToken?: string
├── coins: number (wallet balance)
├── isAdmin?: boolean
├── createdAt: Timestamp
├── updatedAt: Timestamp
│
├── /inventory/{itemId}        # Owned cosmetics
├── /blockedUsers/{blockedUid} # Block list
├── /Achievements/{id}         # Earned achievements
├── /TaskProgress/{taskId}     # Daily task progress
├── /GameStats/{gameType}      # Per-game statistics
├── /ActiveGames/{gameId}      # Active games index
└── /settings/inbox            # Inbox privacy/notification prefs
    ├── showReadReceipts, showOnlineStatus, showTypingIndicators
    └── defaultNotifyLevel, swipeActionsEnabled, confirmBeforeDelete
```

### Chats Collection (DM)

```
Chats/{chatId}
├── members: string[] (exactly 2 UIDs)
├── lastMessageAt: Timestamp
│
├── /Messages/{messageId}
│   ├── senderId: string
│   ├── text?: string
│   ├── kind: "text" | "media" | "voice" | "scorecard" | "system" | "game_invite"
│   ├── attachments?: AttachmentV2[]
│   ├── voiceMetadata?: { durationMs, storagePath, sizeBytes }
│   ├── replyTo?: { messageId, senderId, senderName, previewText }
│   ├── reactions?: { [emoji]: string[] } # uid arrays
│   ├── mentionUids?: string[]
│   ├── hiddenFor?: string[] # delete-for-me
│   ├── deletedForAll?: { by, at }
│   ├── editedAt?: number
│   ├── clientId: string # idempotency key
│   ├── createdAt: number
│   └── serverReceivedAt: Timestamp # authoritative ordering
│
├── /Members/{uid}              # Public state (typing)
│   └── isTyping: boolean
│
└── /MembersPrivate/{uid}       # Private preferences
    ├── lastSeenAtPrivate: number # read watermark
    ├── archived?: boolean
    ├── mutedUntil?: number | -1  # -1 = forever
    ├── notifyLevel?: "all" | "mentions" | "none"
    └── sendReadReceipts?: boolean
```

### Groups Collection

```
Groups/{groupId}
├── name: string
├── ownerId: string
├── memberIds: string[] (for queries)
├── memberCount: number
├── avatarPath?: string
├── avatarUrl?: string
├── lastMessageAt: Timestamp
├── lastMessageText?: string
├── lastMessageSenderId?: string
├── createdAt: Timestamp
│
├── /Messages/{messageId}
│   ├── sender: string
│   ├── senderDisplayName: string
│   ├── type: "text" | "image" | "voice" | "scorecard" | "system"
│   ├── content: string
│   ├── createdAt: number
│   ├── imagePath?: string
│   ├── voiceMetadata?: { durationMs, storagePath?, sizeBytes? }
│   ├── scorecard?: { gameId, score, playerName }
│   ├── systemType?: string
│   ├── systemMeta?: object
│   ├── replyTo?: { messageId, senderId, senderName, textSnippet?, attachmentKind? }
│   ├── hiddenFor?: string[]       # delete-for-me UIDs
│   ├── deletedForAll?: { by, at } # delete-for-all
│   └── mentionUids?: string[]
│
├── /Members/{uid}
│   ├── uid: string
│   ├── role: "owner" | "admin" | "member"
│   ├── joinedAt: Timestamp
│   └── displayName: string
│
├── /MembersPrivate/{uid}       # Same as DM
└── /Reactions/{messageId}_{emoji}_{uid}
```

### Other Collections

```
Usernames/{username}            # Username reservation
├── uid: string

FriendRequests/{requestId}
├── from, to: string
├── status: "pending" | "accepted" | "declined"
├── createdAt: Timestamp

Friends/{friendId}              # Active friendships
├── users: string[2]
├── streakCount: number
├── lastSentAt: { [uid]: dayKey }
├── createdAt: Timestamp

stories/{storyId}               # 24-hour moments
├── authorId: string
├── imageUrl: string
├── recipientIds: string[]
├── viewedBy: string[]
├── expiresAt: Timestamp (TTL)

GameSessions/{sessionId}        # Single-player game scores
Leaderboards/{gameId}_{weekKey}/Entries/{uid}

turnBasedMatches/{matchId}      # Turn-based multiplayer games
├── gameType, status, players, currentTurn, boardState
├── createdAt, updatedAt, lastMoveAt
└── /moves/{moveId}             # Move history

GameInvites/{inviteId}          # Universal game invitations
├── gameType, fromUid, toUid, status
├── requiredPlayers, maxPlayers, claimedSlots
├── targeting: { type, eligibleUserIds }
├── spectators: { enabled, maxCount, current }
├── createdAt, expiresAt

matchmakingQueue/{queueId}      # Players waiting for match

Users/{uid}/GameStats/{gameType} # Per-game statistics
Users/{uid}/ActiveGames/{gameId} # Active games index

Wallets/{uid}                   # Token balance
Transactions/{transactionId}    # Economy audit trail
Tasks/{taskId}                  # Daily task definitions
ShopCatalog/{itemId}            # Shop items
Purchases/{purchaseId}          # Purchase records

Reports/{reportId}              # User reports
Bans/{banId}                    # Active bans
UserWarnings/{warningId}        # User warnings
GroupInvites/{inviteId}         # Group invitations
ScheduledMessages/{messageId}   # Scheduled messages
```

---

## Cloud Functions

### Callable Functions (HTTPS)

| Function                                                                                                                            | Purpose                          | Called From         |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------- |
| `sendMessageV2`                                                                                                                     | Send message with idempotency    | `chatV2.ts`         |
| `editMessageV2`                                                                                                                     | Edit message within 15min window | `messageActions.ts` |
| `deleteMessageForAllV2`                                                                                                             | Delete for everyone              | `messageActions.ts` |
| `toggleReactionV2`                                                                                                                  | Add/remove emoji reaction        | `reactions.ts`      |
| `claimTaskReward`                                                                                                                   | Claim daily task reward          | `tasks.ts`          |
| `purchaseWithTokens`                                                                                                                | Buy shop item                    | `shop.ts`           |
| `recordDailyLogin`                                                                                                                  | Track login streak               | `tasks.ts`          |
| `fetchLinkPreview`                                                                                                                  | Get OpenGraph metadata           | `linkPreview.ts`    |
| `checkMessageRateLimit`                                                                                                             | Rate limit check                 | `chat.ts`           |
| `sendFriendRequestWithRateLimit`                                                                                                    | Rate-limited friend request      | `friends.ts`        |
| Admin functions: `adminSetBan`, `adminLiftBan`, `adminApplyStrike`, `adminApplyWarning`, `adminResolveReport`, `adminSetAdminClaim` |

### Firestore Triggers

| Function                                                                               | Trigger                                          | Purpose                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| `onNewMessage`                                                                         | `Chats/{chatId}/Messages/{messageId}` onCreate   | Push notification + streak update      |
| `onNewGroupMessageV2`                                                                  | `Groups/{groupId}/Messages/{messageId}` onCreate | Push notification with mention support |
| `onDeleteMessage`                                                                      | Messages onDelete                                | Clean up Storage files                 |
| `onNewFriendRequest`                                                                   | FriendRequests onCreate                          | Push notification                      |
| `onStoryViewed`                                                                        | stories onUpdate                                 | View tracking                          |
| `onUserCreated`                                                                        | Users onCreate                                   | Initialize wallet                      |
| `onGameSessionCreated`                                                                 | GameSessions onCreate                            | Update leaderboard                     |
| `onStreakAchievementCheck`                                                             | Friends onUpdate                                 | Check streak achievements              |
| `onScheduledMessageCreated`                                                            | ScheduledMessages onCreate                       | Log creation                           |
| `onNewReport`                                                                          | Reports onCreate                                 | Admin notification                     |
| Task progress triggers: `onMessageSentTaskProgress`, `onStoryViewedTaskProgress`, etc. |

### Scheduled Functions (PubSub)

| Function                      | Schedule        | Purpose                            |
| ----------------------------- | --------------- | ---------------------------------- |
| `cleanupExpiredSnaps`         | Every 1 hour    | Delete expired snap images         |
| `cleanupExpiredStories`       | Daily 2 AM UTC  | Delete expired moments             |
| `processScheduledMessages`    | Every 1 minute  | Send scheduled messages            |
| `cleanupOldScheduledMessages` | Daily 3 AM UTC  | Clean up old scheduled             |
| `streakReminder`              | Daily           | Send streak reminder notifications |
| `weeklyLeaderboardReset`      | Monday midnight | Reset weekly leaderboards          |
| `cleanupExpiredPushTokens`    | Daily           | Remove stale push tokens           |
| `updateExpiredBans`           | Hourly          | Lift expired bans                  |

---

## Security Rules Summary

### Access Patterns

| Collection     | Read             | Create          | Update      | Delete |
| -------------- | ---------------- | --------------- | ----------- | ------ |
| Users          | Auth'd           | Owner           | Owner       | Owner  |
| Usernames      | Auth'd           | Owner           | ❌          | ❌     |
| FriendRequests | Sender/Recipient | Sender          | Recipient   | Either |
| Friends        | Members          | Member          | Members     | Member |
| Chats          | Members          | Member          | Member      | -      |
| Chats/Messages | Members          | Sender (member) | Limited     | -      |
| Groups         | Members          | Creator         | Admin/Owner | -      |
| stories        | Recipients       | Author          | Author      | Author |

### Key Rules

1. **Username immutability**: Cannot change after creation
2. **Chat membership**: Only members can read/write messages
3. **Message sender**: `senderId` must match authenticated user
4. **Edit window**: 15 minutes from creation
5. **hiddenFor**: User can only add self, cannot remove
6. **deletedForAll**: Sender (DM) or sender/admin (Group)
7. **Reactions**: User can only create/delete own reactions

---

## Composite Indexes

All indexes are defined in `firebase-backend/firestore.indexes.json`.

| Collection        | Fields                                              | Purpose          |
| ----------------- | --------------------------------------------------- | ---------------- |
| Chats             | members (array-contains), lastMessageAt DESC        | Chat list query  |
| Messages          | serverReceivedAt DESC                               | Message ordering |
| Messages          | mentionUids (array-contains), serverReceivedAt DESC | Mention queries  |
| Groups            | memberIds (array-contains), lastMessageAt DESC      | Group list query |
| GroupInvites      | toUid, status, createdAt DESC                       | Pending invites  |
| FriendRequests    | from/to + status                                    | Request queries  |
| stories           | recipientIds (array-contains), expiresAt ASC        | Story feed       |
| GameSessions      | playerId, playedAt DESC                             | Player history   |
| ScheduledMessages | senderId, status, scheduledFor                      | Scheduled list   |
| Reports           | status, createdAt DESC                              | Admin queue      |

---

## Storage Paths

```
/snaps/{chatId}/{messageId}.jpg          # DM snap images
/stories/{authorId}/{storyId}.jpg        # Moments
/groups/{groupId}/messages/{messageId}/  # Group attachments
/groups/{groupId}/voice/{messageId}.m4a  # Voice messages
/users/{uid}/avatar.jpg                  # Profile avatars
```

---

## Deployment Commands

```bash
# Deploy Cloud Functions
cd firebase-backend
npm run build
firebase deploy --only functions

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage

# Deploy indexes
firebase deploy --only firestore:indexes

# Deploy everything
firebase deploy
```
