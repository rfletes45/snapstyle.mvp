# SnapStyle MVP - Comprehensive Implementation Guide

> **Purpose**: This document serves as a complete knowledge transfer for continuing development with a fresh GitHub Copilot chat. It contains all implementation details, architecture decisions, and current state of the application.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Structure](#2-project-structure)
3. [Technology Stack](#3-technology-stack)
4. [All Implemented Phases](#4-all-implemented-phases)
5. [Data Models & Firestore Collections](#5-data-models--firestore-collections)
6. [Cloud Functions](#6-cloud-functions)
7. [All Screens](#7-all-screens)
8. [All Services](#8-all-services)
9. [Authentication Flow](#9-authentication-flow)
10. [Navigation Structure](#10-navigation-structure)
11. [Security Rules](#11-security-rules)
12. [Avatar & Cosmetics System](#12-avatar--cosmetics-system)
13. [Economy System](#13-economy-system)
14. [Streak System](#14-streak-system)
15. [Games & Achievements](#15-games--achievements)
16. [Trust & Safety (Phase 21)](#16-trust--safety-phase-21)
17. [Group Chat (Phase 20)](#17-group-chat-phase-20)
18. [Special Configurations](#18-special-configurations)
19. [Firebase Project Details](#19-firebase-project-details)
20. [Key Files Reference](#20-key-files-reference)
21. [Common Patterns & Conventions](#21-common-patterns--conventions)
22. [Known Issues & Workarounds](#22-known-issues--workarounds)
23. [Future Phases](#23-future-phases)

---

## 1. Executive Summary

**SnapStyle MVP** is a full-featured React Native social networking application built with Expo and Firebase. It's a Snapchat-like app with real-time chat, photo snaps, stories, friend streaks, mini-games, virtual economy, cosmetics/avatar system, group chat, and comprehensive trust & safety features.

### Current Status

- **Development Phase**: 21 Phases Complete ✅
- **Production Ready**: Yes
- **Platforms**: iOS, Android, Web
- **Firebase Project ID**: `gamerapp-37e70`
- **Region**: `us-central1`

### Key Features

- Email/password authentication
- Real-time 1:1 and group messaging
- View-once photo snaps
- 24-hour disappearing stories
- Friend streaks with milestone rewards
- Avatar customization with unlockable cosmetics
- Two mini-games with leaderboards
- Achievement system
- Token-based economy with daily tasks
- In-app shop for cosmetics
- Scheduled/timed messages
- User reporting, blocking, bans, strikes, warnings
- Admin moderation queue

---

## 2. Project Structure

```
snapstyle-mvp/
├── App.tsx                          # Main app entry, providers setup
├── app.config.ts                    # Expo configuration
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript configuration
├── firebase.json                    # Firebase CLI configuration
│
├── assets/                          # Static assets
│   └── images/
│
├── constants/
│   └── theme.ts                     # AppColors, Spacing, BorderRadius, Fonts
│
├── src/
│   ├── types/
│   │   └── models.ts                # ALL TypeScript interfaces (~830 lines)
│   │
│   ├── store/
│   │   ├── AuthContext.tsx          # Firebase auth state + custom claims
│   │   └── UserContext.tsx          # User profile state
│   │
│   ├── components/
│   │   ├── Avatar.tsx               # Avatar display component
│   │   ├── AvatarCustomizer.tsx     # Avatar editing component
│   │   ├── AppGate.tsx              # Hydration + ban enforcement
│   │   ├── LoadingScreen.tsx        # Loading spinner
│   │   └── WarningModal.tsx         # User warning display
│   │
│   ├── navigation/
│   │   └── RootNavigator.tsx        # All navigation stacks
│   │
│   ├── screens/
│   │   ├── auth/                    # Login, Signup, Welcome, ProfileSetup
│   │   ├── chat/                    # ChatList, Chat, SnapViewer, Scheduled
│   │   ├── stories/                 # StoriesScreen, StoryViewer
│   │   ├── games/                   # GamesHub, ReactionTap, TimedTap, etc.
│   │   ├── friends/                 # FriendsScreen
│   │   ├── profile/                 # ProfileScreen
│   │   ├── settings/                # Settings, BlockedUsers
│   │   ├── wallet/                  # WalletScreen
│   │   ├── tasks/                   # TasksScreen
│   │   ├── shop/                    # ShopScreen
│   │   ├── groups/                  # GroupChat screens
│   │   ├── admin/                   # AdminReportsQueue, BannedScreen
│   │   └── debug/                   # DebugScreen
│   │
│   ├── services/
│   │   ├── firebase.ts              # Firebase initialization
│   │   ├── auth.ts                  # Authentication functions
│   │   ├── users.ts                 # User profile CRUD
│   │   ├── friends.ts               # Friend requests & relationships
│   │   ├── chat.ts                  # Messaging functions
│   │   ├── storage.ts               # File upload/download
│   │   ├── stories.ts               # Story posting & viewing
│   │   ├── streaks.ts               # Streak tracking
│   │   ├── streakCosmetics.ts       # Streak milestone rewards
│   │   ├── cosmetics.ts             # Cosmetic inventory
│   │   ├── games.ts                 # Game score saving
│   │   ├── leaderboards.ts          # Leaderboard queries
│   │   ├── achievements.ts          # Achievement system
│   │   ├── blocking.ts              # User blocking
│   │   ├── reporting.ts             # User reporting
│   │   ├── moderation.ts            # Bans, strikes, warnings, admin
│   │   ├── notifications.ts         # Push notification setup
│   │   ├── economy.ts               # Wallet & transactions
│   │   ├── tasks.ts                 # Daily tasks
│   │   ├── shop.ts                  # Shop purchases
│   │   ├── scheduledMessages.ts     # Scheduled messages
│   │   └── groups.ts                # Group chat functions
│   │
│   ├── data/
│   │   └── cosmetics.ts             # Cosmetic item definitions
│   │
│   └── utils/
│       ├── dates.ts                 # Date formatting
│       ├── ids.ts                   # ID generation
│       ├── validators.ts            # Input validation
│       └── webImagePicker.ts        # Web camera fallback
│
├── firebase-backend/
│   ├── firestore.rules              # Security rules (~710 lines)
│   ├── firestore.indexes.json       # Composite indexes (~310 lines)
│   ├── storage.rules                # Storage security (~117 lines)
│   └── functions/
│       └── src/
│           └── index.ts             # All Cloud Functions (~3100 lines)
│
└── scripts/
    ├── check-streak.js
    ├── fix-streak.js
    └── reset-project.js
```

---

## 3. Technology Stack

| Layer                  | Technology               | Version        |
| ---------------------- | ------------------------ | -------------- |
| **Mobile Framework**   | React Native + Expo      | ~54.0.31       |
| **Language**           | TypeScript               | ~5.9.2         |
| **Navigation**         | React Navigation         | 7.x            |
| **UI Components**      | React Native Paper       | 5.x            |
| **State Management**   | React Context API        | -              |
| **Backend**            | Firebase                 | 12.8.0         |
| **Authentication**     | Firebase Auth            | Email/Password |
| **Database**           | Cloud Firestore          | -              |
| **File Storage**       | Cloud Storage            | -              |
| **Functions**          | Firebase Cloud Functions | Node.js 20     |
| **Push Notifications** | Expo Push                | -              |
| **Camera**             | expo-camera              | -              |
| **Media Picker**       | expo-image-picker        | -              |

### Key Dependencies (package.json)

```json
{
  "expo": "~54.0.31",
  "react": "19.0.0",
  "react-native": "0.79.2",
  "firebase": "^12.8.0",
  "@react-navigation/native": "^7.1.6",
  "@react-navigation/native-stack": "^7.3.10",
  "@react-navigation/bottom-tabs": "^7.3.10",
  "react-native-paper": "^5.14.5",
  "react-native-safe-area-context": "5.4.0",
  "expo-camera": "~16.1.6",
  "expo-image-picker": "~16.1.4",
  "expo-notifications": "~0.31.1"
}
```

### Firebase SDK Version

- Using **Firebase 12.x modular SDK** (NOT the deprecated 8.x compat)
- All imports use `firebase/firestore`, `firebase/auth`, `firebase/storage`, `firebase/functions`
- Timestamps use JavaScript `Date.now()` (NOT `serverTimestamp()`)

---

## 4. All Implemented Phases

### Phase 0: Bootstrap & Foundation

- Project scaffold with Expo
- TypeScript configuration
- Basic navigation structure
- Type definitions in `models.ts`
- Utility functions (dates, ids, validators)

### Phase 1: Firebase + Auth + Profile

- Firebase initialization
- Email/password authentication
- User profile creation
- Username uniqueness via `Usernames` collection
- Profile setup screen with avatar

### Phase 2: Friends System

- Send friend requests
- Accept/decline requests
- Friends list display
- Remove friend functionality
- `FriendRequests` and `Friends` collections

### Phase 3: Text Chat + Messaging

- Real-time DM conversations
- Message sending with delivery status
- Read receipts
- Message expiration (optional)
- `Chats` and `Messages` collections

### Phase 4: Photo Snaps

- Camera capture (expo-camera)
- Image upload to Storage
- View-once photos with countdown
- Auto-delete after viewing
- Snap cleanup Cloud Function

### Phase 5: Stories

- 24-hour disappearing stories
- Friend visibility (recipientIds)
- View tracking (StoryViews)
- Story expiration TTL
- Cleanup Cloud Function

### Phase 6: Games + Notifications

- Mini-games infrastructure
- Expo push token registration
- Push notifications via Cloud Functions
- `GameSessions` collection

### Phase 7: Avatar + Cosmetics

- Avatar component with customization
- Cosmetic items (hats, glasses, effects, etc.)
- User inventory system
- `Cosmetics` and `UserInventory` collections

### Phase 8: Safety & Moderation

- Report users functionality
- Block/unblock users
- `Reports` and `blockedUsers` collections

### Phase 9-10: Streaks

- Daily streak tracking with friends
- Streak count in `Friends` collection
- Milestone cosmetic unlocks
- Streak reminder notifications
- Cloud Function for streak updates

### Phase 11: Chat Improvements

- Offline message queue
- Optimistic UI updates
- Better delivery status tracking

### Phase 12: Chat Reliability + Pagination

- Cursor-based message pagination
- `loadOlderMessages()` function
- Message batching (20 per load)

### Phase 13: Stories UX + Performance

- Batch queries for stories
- Image preloading
- Progress bar animations
- Caching improvements

### Phase 14: Backend Hardening

- Security rules audit
- Composite index optimization
- TTL cleanup functions
- Rate limiting foundation

### Phase 15-16: Games Enhancement

- **Reaction Tap Game**: Test reaction time
- **Timed Tap Game**: Tap as fast as possible
- Anti-cheat validation in Cloud Functions
- Score limits and validation

### Phase 17: Leaderboards + Achievements + Scheduled Messages

- Weekly leaderboards by game
- Achievement definitions and tracking
- Scheduled message delivery
- `Leaderboards`, `Achievements`, `ScheduledMessages` collections

### Phase 18: Economy + Tasks

- Token wallet system (100 starting tokens)
- Daily tasks with configurable rewards
- Task progress tracking
- `Wallets`, `Transactions`, `Tasks`, `TaskProgress` collections
- `claimTaskReward` Cloud Function

### Phase 19: Shop + Drops

- Cosmetics shop catalog
- Token-based purchases
- Limited-time items
- Purchase history
- `ShopCatalog`, `Purchases` collections
- `purchaseShopItem` Cloud Function

### Phase 20: Group Chat

- Multi-user group conversations (3-20 members)
- Group invitations system
- Admin/member roles
- Group settings and info
- `Groups`, `GroupMembers`, `GroupMessages`, `GroupInvites` collections

### Phase 21: Trust & Safety V1.5

- **Bans**: Temporary and permanent user bans
- **Strikes**: Strike system with auto-ban thresholds
- **Warnings**: User warnings with acknowledgment
- **Rate Limiting**: Friend requests, messages, reports
- **Admin Queue**: Moderation interface for admins
- **Ban Enforcement**: App-wide via `AppGate`
- `Bans`, `UserStrikes`, `UserWarnings`, `RateLimits` collections
- Multiple admin Cloud Functions

---

## 5. Data Models & Firestore Collections

### Users Collection

```typescript
interface UserProfile {
  uid: string;
  email: string;
  username: string;
  usernameLower: string; // For case-insensitive search
  displayName?: string;
  bio?: string;
  avatarConfig?: AvatarConfig;
  expoPushToken?: string;
  createdAt: number;
  updatedAt: number;
}
```

### Usernames Collection (Uniqueness Index)

```typescript
// Document ID is the lowercase username
interface UsernameDoc {
  uid: string; // Owner's UID
}
```

### FriendRequests Collection

```typescript
interface FriendRequest {
  id: string;
  from: string; // Sender UID
  to: string; // Recipient UID
  status: "pending" | "accepted" | "declined";
  createdAt: number;
  respondedAt?: number;
}
```

### Friends Collection

```typescript
interface Friendship {
  id: string;
  users: [string, string]; // Both UIDs
  createdAt: number;
  streakCount: number;
  lastStreakUpdate: number;
  lastInteractionAt: number;
}
```

### Chats Collection

```typescript
interface Chat {
  id: string;
  members: string[]; // Exactly 2 for DMs
  createdAt: number;
  lastMessageAt: number;
  lastMessagePreview?: string;
}
```

### Messages Subcollection (Chats/{chatId}/Messages)

```typescript
interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: "text" | "snap";
  content?: string; // For text messages
  mediaUrl?: string; // For snaps
  mediaPath?: string; // Storage path for cleanup
  createdAt: number;
  expiresAt?: number;
  readBy: string[];
  deliveredAt?: number;
  readAt?: number;
}
```

### stories Collection

```typescript
interface Story {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaPath: string;
  caption?: string;
  recipientIds: string[]; // Friends who can see
  viewCount: number;
  createdAt: number;
  expiresAt: number; // 24 hours from creation
}
```

### StoryViews Subcollection (stories/{storyId}/views)

```typescript
interface StoryView {
  viewerId: string;
  viewedAt: number;
}
```

### GameSessions Collection

```typescript
interface GameSession {
  id: string;
  gameId: "reaction_tap" | "timed_tap";
  playerId: string;
  score: number;
  duration: number;
  playedAt: number;
  validated: boolean;
}
```

### Leaderboards Collection

```typescript
interface Leaderboard {
  id: string; // Format: {gameId}_{weekId}
  gameId: string;
  weekId: string; // ISO week
  entries: LeaderboardEntry[];
}
```

### Achievements Subcollection (Users/{uid}/Achievements)

```typescript
interface UserAchievement {
  id: string;
  achievementId: string;
  unlockedAt: number;
  progress?: number;
}
```

### Reports Collection

```typescript
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
  details?: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: number;
  // Admin fields
  reviewedBy?: string;
  reviewedAt?: number;
  resolution?: string;
  actionTaken?: "none" | "warning" | "strike" | "ban";
}
```

### Wallets Collection

```typescript
interface Wallet {
  uid: string;
  balance: number;
  lifetimeEarned: number;
  updatedAt: number;
}
```

### Transactions Collection

```typescript
interface Transaction {
  id: string;
  uid: string;
  type: "earned" | "spent" | "bonus" | "refund";
  amount: number;
  reason: string;
  referenceId?: string;
  createdAt: number;
}
```

### Tasks Collection

```typescript
interface Task {
  id: string;
  name: string;
  description: string;
  type:
    | "daily_login"
    | "send_message"
    | "send_snap"
    | "view_story"
    | "post_story"
    | "play_game"
    | "win_game"
    | "add_friend";
  targetCount: number;
  reward: number;
  cadence: "daily" | "weekly";
  active: boolean;
  sortOrder: number;
}
```

### TaskProgress Subcollection (Users/{uid}/TaskProgress)

```typescript
interface TaskProgress {
  taskId: string;
  currentCount: number;
  completedAt?: number;
  claimedAt?: number;
  periodStart: number;
}
```

### ShopCatalog Collection

```typescript
interface ShopItem {
  id: string;
  name: string;
  description: string;
  cosmeticId: string;
  price: number;
  category: string;
  active: boolean;
  limitedTime?: boolean;
  availableUntil?: number;
  sortOrder: number;
}
```

### Purchases Collection

```typescript
interface Purchase {
  id: string;
  uid: string;
  itemId: string;
  cosmeticId: string;
  pricePaid: number;
  purchasedAt: number;
}
```

### ScheduledMessages Collection

```typescript
interface ScheduledMessage {
  id: string;
  senderId: string;
  chatId: string;
  content: string;
  type: "text" | "snap";
  mediaUrl?: string;
  mediaPath?: string;
  scheduledFor: number;
  status: "pending" | "sent" | "cancelled" | "failed";
  createdAt: number;
  sentAt?: number;
}
```

### Groups Collection

```typescript
interface Group {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  memberCount: number;
  lastMessageAt?: number;
  lastMessagePreview?: string;
}
```

### GroupMembers Subcollection (Groups/{groupId}/Members)

```typescript
interface GroupMember {
  uid: string;
  role: "owner" | "admin" | "member";
  joinedAt: number;
  addedBy: string;
}
```

### GroupMessages Subcollection (Groups/{groupId}/Messages)

```typescript
interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  type: "text" | "snap" | "system";
  content?: string;
  mediaUrl?: string;
  createdAt: number;
  readBy: string[];
}
```

### GroupInvites Collection

```typescript
interface GroupInvite {
  id: string;
  groupId: string;
  groupName: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: number;
  expiresAt: number; // 7 days
}
```

### Bans Collection

```typescript
interface Ban {
  uid: string;
  status: "active" | "expired" | "lifted";
  reason: BanReason;
  reasonDetails?: string;
  bannedBy: string;
  createdAt: number;
  expiresAt: number | null; // null = permanent
  liftedAt?: number;
  liftedBy?: string;
}

type BanReason =
  | "harassment"
  | "spam"
  | "inappropriate_content"
  | "underage"
  | "multiple_violations"
  | "fraud"
  | "other";
```

### UserStrikes Collection

```typescript
interface UserStrike {
  uid: string;
  strikeCount: number;
  lastStrikeAt: number;
  lastStrikeReason?: BanReason;
  strikeHistory: StrikeRecord[];
}

interface StrikeRecord {
  reason: BanReason;
  details?: string;
  issuedBy: string;
  issuedAt: number;
  reportId?: string;
}
```

### UserWarnings Collection

```typescript
interface UserWarning {
  id: string;
  uid: string;
  reason: BanReason;
  details?: string;
  issuedBy: string;
  issuedAt: number;
  reportId?: string;
  status: "unread" | "read" | "acknowledged";
  readAt?: number;
  acknowledgedAt?: number;
}
```

### RateLimits Collection

```typescript
interface RateLimitRecord {
  uid: string;
  actionType: string;
  actions: number[]; // Timestamps
  updatedAt: number;
}
```

---

## 6. Cloud Functions

### Firestore Triggers

| Function                    | Trigger                    | Purpose                                |
| --------------------------- | -------------------------- | -------------------------------------- |
| `onNewMessage`              | Messages onCreate          | Send push notification, update streaks |
| `onFriendRequestCreated`    | FriendRequests onCreate    | Send push notification                 |
| `onStoryViewed`             | StoryViews onCreate        | Notify story author                    |
| `onSnapDeleted`             | Messages onDelete          | Delete Storage file                    |
| `onGameSessionCreated`      | GameSessions onCreate      | Update leaderboard, check achievements |
| `onFriendshipUpdated`       | Friends onUpdate           | Check streak achievements              |
| `onUserCreated`             | Users onCreate             | Initialize wallet (100 tokens)         |
| `onMessageCreatedTask`      | Messages onCreate          | Update message tasks                   |
| `onStoryViewedTask`         | StoryViews onCreate        | Update view_story task                 |
| `onStoryCreatedTask`        | stories onCreate           | Update post_story task                 |
| `onGameSessionTask`         | GameSessions onCreate      | Update game tasks                      |
| `onFriendshipCreatedTask`   | Friends onCreate           | Update add_friend task                 |
| `onScheduledMessageCreated` | ScheduledMessages onCreate | Log event                              |
| `onNewMessageEvent`         | Messages onCreate          | Log domain event                       |
| `onNewReport`               | Reports onCreate           | Log report event                       |

### Scheduled Functions

| Function                        | Schedule         | Purpose                         |
| ------------------------------- | ---------------- | ------------------------------- |
| `sendStreakReminders`           | Daily 8 PM UTC   | Warn users with at-risk streaks |
| `cleanupExpiredSnaps`           | Daily 2 AM UTC   | Delete expired snap images      |
| `cleanupExpiredStories`         | Daily 2 AM UTC   | Delete expired stories          |
| `processScheduledMessages`      | Every 1 minute   | Deliver due scheduled messages  |
| `cleanupOldScheduledMessages`   | Daily 3 AM UTC   | Remove old processed messages   |
| `weeklyLeaderboardNotification` | Monday 00:00 UTC | Notify weekly top players       |
| `cleanupExpiredPushTokens`      | Every 24 hours   | Remove invalid tokens           |
| `updateExpiredBans`             | Every 1 hour     | Expire temporary bans           |

### Callable Functions

| Function                         | Purpose                     | Rate Limited |
| -------------------------------- | --------------------------- | ------------ |
| `claimTaskReward`                | Claim completed task reward | No           |
| `recordDailyLogin`               | Log daily login for tasks   | No           |
| `purchaseShopItem`               | Buy shop item with tokens   | No           |
| `sendFriendRequestWithRateLimit` | Send friend request         | Yes (20/hr)  |
| `checkMessageRateLimit`          | Validate message sending    | Yes (30/min) |
| `adminSetBan`                    | Ban a user (admin)          | No           |
| `adminLiftBan`                   | Remove ban (admin)          | No           |
| `adminApplyStrike`               | Issue strike (admin)        | No           |
| `adminApplyWarning`              | Issue warning (admin)       | No           |
| `adminResolveReport`             | Resolve report (admin)      | No           |
| `adminSetAdminClaim`             | Grant admin access (admin)  | No           |

### HTTP Functions

| Function               | Purpose                       | Auth Required |
| ---------------------- | ----------------------------- | ------------- |
| `seedDailyTasks`       | Seed task definitions         | No            |
| `migrateWallets`       | Add wallets to existing users | No            |
| `seedShopCatalog`      | Seed shop items               | No            |
| `initializeFirstAdmin` | Set up first admin            | Secret key    |

---

## 7. All Screens

### Auth Stack

| Screen       | File                     | Purpose                   |
| ------------ | ------------------------ | ------------------------- |
| Welcome      | `WelcomeScreen.tsx`      | Landing with login/signup |
| Login        | `LoginScreen.tsx`        | Email/password login      |
| Signup       | `SignupScreen.tsx`       | New user registration     |
| ProfileSetup | `ProfileSetupScreen.tsx` | Initial profile + avatar  |

### Chat Stack

| Screen            | File                          | Purpose                 |
| ----------------- | ----------------------------- | ----------------------- |
| ChatList          | `ChatListScreen.tsx`          | All DM and group chats  |
| Chat              | `ChatScreen.tsx`              | Individual conversation |
| SnapViewer        | `SnapViewerScreen.tsx`        | View-once photo viewer  |
| ScheduledMessages | `ScheduledMessagesScreen.tsx` | View/manage scheduled   |
| GroupChatCreate   | `GroupChatCreateScreen.tsx`   | Create group            |
| GroupChat         | `GroupChatScreen.tsx`         | Group conversation      |
| GroupChatInfo     | `GroupChatInfoScreen.tsx`     | Group settings          |
| GroupInvites      | `GroupInvitesScreen.tsx`      | Pending invites         |

### Stories Stack

| Screen      | File                    | Purpose             |
| ----------- | ----------------------- | ------------------- |
| Stories     | `StoriesScreen.tsx`     | Friend stories feed |
| StoryViewer | `StoryViewerScreen.tsx` | Full-screen viewer  |

### Games Stack

| Screen          | File                        | Purpose            |
| --------------- | --------------------------- | ------------------ |
| GamesHub        | `GamesHub.tsx`              | Game selection     |
| ReactionTapGame | `ReactionTapGameScreen.tsx` | Reaction time game |
| TimedTapGame    | `TimedTapGameScreen.tsx`    | Tapping speed game |
| Leaderboard     | `LeaderboardScreen.tsx`     | Weekly rankings    |
| Achievements    | `AchievementsScreen.tsx`    | User achievements  |

### Profile Stack

| Screen       | File                          | Purpose               |
| ------------ | ----------------------------- | --------------------- |
| Profile      | `ProfileScreen.tsx`           | User profile + avatar |
| Debug        | `DebugScreen.tsx`             | Debug info            |
| BlockedUsers | `BlockedUsersScreen.tsx`      | Manage blocks         |
| Settings     | `SettingsScreen.tsx`          | App settings          |
| Wallet       | `WalletScreen.tsx`            | Token balance         |
| Tasks        | `TasksScreen.tsx`             | Daily tasks           |
| Shop         | `ShopScreen.tsx`              | Cosmetics shop        |
| AdminReports | `AdminReportsQueueScreen.tsx` | Admin moderation      |

### Other

| Screen  | File                | Purpose                 |
| ------- | ------------------- | ----------------------- |
| Friends | `FriendsScreen.tsx` | Friends list + requests |
| Banned  | `BannedScreen.tsx`  | Shown to banned users   |

---

## 8. All Services

### firebase.ts

Firebase app initialization and instance getters:

- `getFirebaseApp()`
- `getAuthInstance()`
- `getFirestoreInstance()`
- `getStorageInstance()`
- `getFunctionsInstance()`

### auth.ts

Authentication functions:

- `signupUser(email, password)` - Create account
- `loginUser(email, password)` - Sign in
- `logoutUser()` - Sign out + remove push token
- `createUserProfile(uid, data)` - Create profile doc
- `isUsernameAvailable(username)` - Check uniqueness
- `claimUsername(uid, username)` - Reserve username

### users.ts

User profile management:

- `getUserProfile(uid)` - Get profile
- `subscribeToUserProfile(uid, callback)` - Real-time
- `updateUserProfile(uid, data)` - Update profile
- `updateAvatarConfig(uid, config)` - Update avatar
- `searchUsersByUsername(query)` - Search users

### friends.ts

Friend system:

- `sendFriendRequest(fromUid, toUid)` - Send request
- `respondToFriendRequest(requestId, accept)` - Accept/decline
- `getFriendRequests(uid)` - Get pending
- `getSentRequests(uid)` - Get sent
- `getFriends(uid)` - Get friends list
- `removeFriend(friendshipId)` - Unfriend
- `isFriend(uid1, uid2)` - Check friendship

### chat.ts

Messaging:

- `createOrGetChat(uid1, uid2)` - Get/create DM
- `sendMessage(chatId, senderId, content, type)` - Send
- `getChats(uid)` - Get all chats
- `subscribeToChat(chatId, callback)` - Real-time
- `loadOlderMessages(chatId, beforeTimestamp)` - Pagination
- `markMessageAsRead(chatId, messageId, uid)` - Read receipt

### storage.ts

File handling:

- `uploadSnapImage(chatId, file)` - Upload snap
- `downloadSnapImage(url)` - Download snap
- `deleteSnapImage(path)` - Delete snap
- `uploadStoryImage(uid, file)` - Upload story
- `uploadGroupSnapImage(groupId, file)` - Group snap
- `uploadAvatarImage(uid, file)` - Avatar image

### stories.ts

Stories system:

- `postStory(uid, mediaUrl, mediaPath, caption, friendIds)` - Post
- `getStoriesForUser(uid)` - Get visible stories
- `markStoryViewed(storyId, viewerId)` - Mark viewed
- `getBatchViewedStories(storyIds, viewerId)` - Batch check
- `preloadStoryImages(stories)` - Preload images
- `deleteStory(storyId)` - Delete story

### streaks.ts

Streak tracking:

- `getActiveStreaks(uid)` - Get all streaks
- `getStreakWithFriend(uid, friendUid)` - Single streak

### streakCosmetics.ts

Streak rewards:

- `checkAndUnlockStreakCosmetic(uid, streakCount)` - Unlock reward
- `STREAK_MILESTONES` - Milestone definitions

### cosmetics.ts

Cosmetic system:

- `getCosmetics()` - Get all definitions
- `getUserInventory(uid)` - Get owned items
- `addToInventory(uid, cosmeticId)` - Add item

### games.ts

Game management:

- `saveGameScore(gameId, playerId, score, duration)` - Save
- `getGameHistory(playerId, gameId)` - Get history
- `getBestScore(playerId, gameId)` - Get best

### leaderboards.ts

Leaderboard system:

- `getLeaderboard(gameId, weekId)` - Get rankings
- `submitScore(gameId, playerId, playerName, score)` - Submit

### achievements.ts

Achievement system:

- `getUserAchievements(uid)` - Get unlocked
- `checkAndGrantAchievement(uid, achievementId, progress)` - Grant
- `getAchievementDefinitions()` - Get all definitions
- `ACHIEVEMENT_DEFINITIONS` - Static definitions

### blocking.ts

User blocking:

- `blockUser(uid, targetUid)` - Block
- `unblockUser(uid, targetUid)` - Unblock
- `getBlockedUsers(uid)` - Get blocked list
- `isUserBlocked(uid, targetUid)` - Check

### reporting.ts

User reporting:

- `reportUser(reporterId, reportedId, reason, details)` - Report
- `getMyReports(uid)` - Get my reports

### moderation.ts

Trust & safety:

- `getUserBan(uid)` - Get ban status
- `subscribeToUserBan(uid, callback)` - Real-time ban
- `isUserBanned(uid)` - Quick check
- `getUserStrikes(uid)` - Get strikes
- `getUserWarnings(uid)` - Get warnings
- `getUnreadWarnings(uid)` - Get unread
- `subscribeToUnreadWarnings(uid, callback)` - Real-time
- `markWarningRead(warningId)` - Mark read
- `acknowledgeWarning(warningId)` - Acknowledge
- `adminSetBan(targetUid, reason, duration, details)` - Admin
- `adminLiftBan(targetUid)` - Admin
- `adminApplyStrike(targetUid, reason, details, reportId)` - Admin
- `adminApplyWarning(targetUid, reason, details, reportId)` - Admin
- `adminResolveReport(reportId, resolution, actionTaken)` - Admin
- `getPendingReports(limit)` - Admin query
- `subscribeToPendingReports(callback, limit)` - Admin real-time
- `BAN_REASON_LABELS` - Display labels

### notifications.ts

Push notifications:

- `registerForPushNotificationsAsync()` - Get token
- `savePushToken(uid, token)` - Save to profile
- `removePushToken(uid)` - Remove on logout
- Notification listeners

### economy.ts

Token economy:

- `getWallet(uid)` - Get balance
- `subscribeToWallet(uid, callback)` - Real-time
- `getTransactionHistory(uid, limit)` - Get transactions

### tasks.ts

Daily tasks:

- `getTasks()` - Get task definitions
- `getTaskProgress(uid)` - Get progress
- `claimTaskReward(taskId)` - Claim via CF
- `recordDailyLogin()` - Log login via CF

### shop.ts

In-app shop:

- `getShopItems()` - Get catalog
- `purchaseItem(itemId)` - Buy via CF
- `getMyPurchases(uid)` - Get purchases

### scheduledMessages.ts

Scheduled messages:

- `scheduleMessage(senderId, chatId, content, scheduledFor, type)` - Schedule
- `getScheduledMessages(senderId)` - Get pending
- `cancelScheduledMessage(messageId)` - Cancel
- `subscribeToScheduledMessages(senderId, callback)` - Real-time

### groups.ts

Group chat:

- `createGroup(name, creatorUid, initialMembers)` - Create
- `getMyGroups(uid)` - Get groups
- `getGroupById(groupId)` - Get single
- `getGroupMembers(groupId)` - Get members
- `sendGroupInvite(groupId, fromUid, toUid)` - Invite
- `getMyGroupInvites(uid)` - Get invites
- `acceptGroupInvite(inviteId)` - Accept
- `declineGroupInvite(inviteId)` - Decline
- `leaveGroup(groupId, uid)` - Leave
- `sendGroupMessage(groupId, senderId, content, type)` - Send
- `subscribeToGroupMessages(groupId, callback)` - Real-time
- `subscribeToGroupInvites(uid, callback)` - Real-time invites

---

## 9. Authentication Flow

```
1. App Launch
   └── AuthContext.onAuthStateChanged
       ├── No user → AuthStack (Welcome)
       └── User exists
           ├── Fetch customClaims via getIdTokenResult(true)
           └── UserContext fetches profile
               ├── No profile → ProfileSetupScreen
               └── Profile exists
                   └── AppGate checks ban
                       ├── Banned → BannedScreen
                       └── Not banned
                           └── Check warnings → WarningModal
                               └── AppTabs

2. Signup Flow
   SignupScreen
   └── Firebase Auth createUserWithEmailAndPassword
       └── Success → ProfileSetupScreen
           └── Enter username + avatar
               └── isUsernameAvailable() check
               └── claimUsername() in Usernames collection
               └── createUserProfile() in Users collection
               └── onUserCreated trigger → Create Wallet (100 tokens)
               └── Navigate to AppTabs

3. Login Flow
   LoginScreen
   └── Firebase Auth signInWithEmailAndPassword
       └── Success → AuthContext updates
           └── Profile check → AppTabs or ProfileSetup

4. Logout Flow
   ProfileScreen → logoutUser()
   └── removePushToken()
   └── Firebase Auth signOut()
   └── AuthContext clears → Welcome screen

5. Admin Access
   - Admin claim set via initializeFirstAdmin (first time)
   - Or via adminSetAdminClaim (by existing admin)
   - AuthContext fetches claims with getIdTokenResult(true)
   - SettingsScreen shows Admin section if customClaims.admin === true
```

---

## 10. Navigation Structure

```
RootNavigator
├── AppGate (hydration + ban enforcement)
│
├── AuthStack (when unauthenticated)
│   ├── Welcome
│   ├── Login
│   ├── Signup
│   └── ProfileSetup
│
└── AppTabs (when authenticated + not banned)
    │
    ├── Chats Tab (ChatStack)
    │   ├── ChatList (default)
    │   ├── Chat (with chatId param)
    │   ├── SnapViewer (modal)
    │   ├── ScheduledMessages
    │   ├── GroupChatCreate
    │   ├── GroupChat (with groupId param)
    │   ├── GroupChatInfo (with groupId param)
    │   └── GroupInvites
    │
    ├── Stories Tab (StoriesStack)
    │   ├── StoriesList (default)
    │   └── StoryViewer (with storyId param)
    │
    ├── Games Tab (GamesStack)
    │   ├── GamesHub (default)
    │   ├── ReactionTapGame
    │   ├── TimedTapGame
    │   ├── Leaderboard
    │   └── Achievements
    │
    ├── Friends Tab
    │   └── FriendsScreen
    │
    └── Profile Tab (ProfileStack)
        ├── ProfileMain (default)
        ├── Debug
        ├── BlockedUsers
        ├── Settings
        ├── Wallet
        ├── Tasks
        ├── Shop
        └── AdminReports (admin only)
```

---

## 11. Security Rules

### Firestore Rules Summary

| Collection        | Read             | Write        | Delete              |
| ----------------- | ---------------- | ------------ | ------------------- |
| Users             | Auth             | Owner        | Owner               |
| Usernames         | Auth             | Owner+unique | Never               |
| FriendRequests    | Sender/Recipient | Sender       | Sender/Recipient    |
| Friends           | Members          | Members      | Members             |
| Chats             | Members          | Members      | -                   |
| Messages          | Chat members     | Sender       | Members             |
| stories           | Recipients       | Author       | Author              |
| StoryViews        | Author           | Viewers      | -                   |
| Reports           | Reporter/Admin   | Reporter     | Admin               |
| GameSessions      | Player           | Player       | Never               |
| Cosmetics         | Auth             | Never        | Never               |
| UserInventory     | Owner            | Owner        | Never               |
| blockedUsers      | Owner            | Owner        | Owner               |
| Wallets           | Owner            | Server       | Server              |
| Transactions      | Owner            | Server       | Server              |
| Tasks             | Auth             | Admin        | Admin               |
| TaskProgress      | Owner            | Server       | Server              |
| ShopCatalog       | Auth             | Admin        | Admin               |
| Purchases         | Owner            | Server       | Server              |
| ScheduledMessages | Sender           | Sender       | Sender              |
| Groups            | Auth             | Auth         | Owner               |
| GroupMembers      | Members          | Members      | Members             |
| GroupMessages     | Members          | Members      | -                   |
| GroupInvites      | Auth             | Auth         | Sender/Recipient    |
| Bans              | Owner            | Server       | Server              |
| UserStrikes       | Owner            | Server       | Server              |
| UserWarnings      | Owner            | Server       | Owner (status only) |
| Events            | Admin            | Server       | Server              |

### Storage Rules Summary

| Path                      | Read         | Write        | Limits       |
| ------------------------- | ------------ | ------------ | ------------ |
| `/chats/{chatId}/snaps/*` | Chat members | Chat members | 10MB, images |
| `/stories/{uid}/*`        | Auth         | Author       | 10MB, images |
| `/avatars/{uid}/*`        | Auth         | Owner        | 5MB, images  |
| `/groups/{groupId}/*`     | Auth         | Auth         | 10MB, images |

---

## 12. Avatar & Cosmetics System

### Avatar Configuration

```typescript
interface AvatarConfig {
  skinTone: string; // Hex color
  hairStyle: string; // 'short' | 'medium' | 'long' | 'bald' | etc.
  hairColor: string; // Hex color
  eyeColor: string; // Hex color
  expression: string; // 'neutral' | 'happy' | 'cool' | 'wink'
  accessories?: string[]; // Cosmetic IDs
  background?: string; // Background cosmetic ID
}
```

### Cosmetic Categories

- **Hats**: Headwear items
- **Glasses**: Eyewear items
- **Effects**: Visual effects/particles
- **Backgrounds**: Avatar backgrounds
- **Expressions**: Facial expressions
- **Hair**: Hairstyles
- **Accessories**: General accessories

### Acquisition Methods

1. **Streak Milestones**: Auto-unlock at specific streak counts
2. **Shop Purchase**: Buy with tokens
3. **Achievements**: Unlock via achievements (future)
4. **Events**: Limited-time drops

### Streak Milestone Rewards

| Days | Cosmetic       | ID                      |
| ---- | -------------- | ----------------------- |
| 3    | Flame Cap      | `streak_flame_cap`      |
| 7    | Cool Shades    | `streak_shades`         |
| 14   | Gradient Glow  | `streak_gradient_glow`  |
| 30   | Golden Crown   | `streak_golden_crown`   |
| 50   | Star Glasses   | `streak_star_glasses`   |
| 100  | Rainbow Burst  | `streak_rainbow_burst`  |
| 365  | Legendary Halo | `streak_legendary_halo` |

---

## 13. Economy System

### Token Economy

- **Starting Balance**: 100 tokens on account creation
- **Currency**: "Tokens" or "Coins"
- **Earning**: Daily tasks, achievements
- **Spending**: Shop purchases

### Daily Tasks & Rewards

| Task             | Type         | Target | Reward    |
| ---------------- | ------------ | ------ | --------- |
| Daily Check-In   | daily_login  | 1      | 5 tokens  |
| Social Butterfly | send_message | 5      | 10 tokens |
| Snap Happy       | send_snap    | 3      | 15 tokens |
| Story Explorer   | view_story   | 5      | 10 tokens |
| Story Time       | post_story   | 1      | 20 tokens |
| Game On          | play_game    | 1      | 15 tokens |
| Champion         | win_game     | 1      | 25 tokens |

### Task Progress Tracking

- Progress tracked via Cloud Function triggers
- Each trigger (message sent, story viewed, etc.) increments count
- Tasks reset daily at midnight UTC
- Claims are atomic transactions (prevent double-claim)

---

## 14. Streak System

### How Streaks Work

1. Two users must message each other within 24 hours
2. Both directions required (A→B and B→A)
3. Streak increments daily if maintained
4. Streak resets to 0 if 24 hours pass without interaction

### Streak Fields (Friends collection)

```typescript
{
  streakCount: number; // Current streak days
  lastStreakUpdate: number; // Last increment timestamp
  lastInteractionAt: number; // Last message either direction
}
```

### Streak Update Logic (Cloud Function)

```
onNewMessage trigger:
1. Get Friendship document
2. Check if lastInteractionAt was > 24 hours ago
   - Yes: Reset streakCount to 1
   - No: Check if already updated today
     - No: Increment streakCount
3. Update lastInteractionAt
4. Check streak milestones, unlock cosmetics
```

### Streak Reminders

- Scheduled function runs daily at 8 PM UTC
- Identifies friendships with streaks > 0 where lastInteractionAt is 20-24 hours ago
- Sends push notification: "Your streak with X is about to expire!"

---

## 15. Games & Achievements

### Reaction Tap Game

- **Objective**: Tap when screen turns green
- **Scoring**: Reaction time in milliseconds (lower is better)
- **Valid Range**: 100ms - 2000ms (anti-cheat)
- **Leaderboard**: Weekly, sorted ascending

### Timed Tap Game

- **Objective**: Tap as many times as possible in 10 seconds
- **Scoring**: Total taps (higher is better)
- **Valid Range**: 1 - 200 taps (anti-cheat)
- **Leaderboard**: Weekly, sorted descending

### Achievement System

Achievements defined in `achievements.ts`:

| ID               | Name           | Description               | Type     |
| ---------------- | -------------- | ------------------------- | -------- |
| first_message    | First Words    | Send your first message   | one-time |
| first_snap       | Say Cheese!    | Send your first snap      | one-time |
| first_story      | Storyteller    | Post your first story     | one-time |
| streak_7         | Week Warrior   | Reach a 7-day streak      | one-time |
| streak_30        | Monthly Master | Reach a 30-day streak     | one-time |
| reaction_sub_500 | Quick Draw     | Reaction time under 500ms | one-time |
| tap_100          | Tap Champion   | 100+ taps in Timed Tap    | one-time |

### Leaderboard System

- Weekly leaderboards (reset Monday 00:00 UTC)
- Top 10 displayed per game
- `weekId` format: ISO week (e.g., "2026-W04")
- Notifications sent to top 3 weekly

---

## 16. Trust & Safety (Phase 21)

### Ban System

- **Temporary Bans**: 1 day, 3 days, 1 week, 1 month
- **Permanent Bans**: No expiration
- **Ban Enforcement**: `AppGate` component checks ban status
- **BannedScreen**: Shown to banned users, no app access

### Strike System

- Strikes accumulate on user's record
- Auto-ban thresholds:
  - 2 strikes → 1 day ban
  - 3 strikes → 1 week ban
  - 5 strikes → Permanent ban
- Strikes remain on record even after bans expire

### Warning System

- Warnings stored in `UserWarnings` collection
- User must acknowledge warning before continuing
- `WarningModal` component shows unread warnings
- Warnings don't affect access but are recorded

### Rate Limiting

| Action          | Limit | Window   |
| --------------- | ----- | -------- |
| Friend requests | 20    | 1 hour   |
| Messages        | 30    | 1 minute |
| Reports         | 10    | 1 day    |
| Group invites   | 30    | 1 hour   |

### Admin Moderation Queue

- `AdminReportsQueueScreen` (admin only)
- View all pending reports
- Actions: Dismiss, Warning, Strike, Ban
- View user's strike history
- Resolution notes

### Setting Up First Admin

```bash
# 1. Deploy functions
cd firebase-backend && npm run build && npm run deploy

# 2. Call initializeFirstAdmin
curl -X POST https://us-central1-gamerapp-37e70.cloudfunctions.net/initializeFirstAdmin \
  -H "Content-Type: application/json" \
  -d '{"uid": "USER_UID_HERE", "secretKey": "SECRET"}'
```

Note: The secret key defaults to "SECRET" if not configured via environment variable.

---

## 17. Group Chat (Phase 20)

### Group Limits

- **Minimum members**: 3 (including creator)
- **Maximum members**: 20
- **Name max length**: 50 characters
- **Invite expiry**: 7 days

### Group Roles

- **Owner**: Can delete group, remove members, change settings
- **Admin**: Can invite members, remove non-admins
- **Member**: Can send messages, leave group

### Group Invite Flow

1. Owner/Admin sends invite via `sendGroupInvite()`
2. Invite stored in `GroupInvites` collection
3. Recipient sees invite in `GroupInvitesScreen`
4. Accept → Added to `GroupMembers`, invite deleted
5. Decline → Invite marked as declined

### Group Message Types

- `text`: Regular text message
- `snap`: Photo message (view-once TBD)
- `system`: System messages (member joined, left, etc.)

---

## 18. Special Configurations

### Theme Constants (constants/theme.ts)

```typescript
export const AppColors = {
  primary: "#6200EE",
  secondary: "#03DAC6",
  success: "#4CAF50",
  warning: "#FF9800",
  error: "#F44336",
  background: "#f5f5f5",
  surface: "#ffffff",
  surfaceVariant: "#f0f0f0",
  textPrimary: "#333333",
  textSecondary: "#666666",
  border: "#e0e0e0",
  divider: "#eeeeee",
  // ... more colors
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};
```

### Firestore Indexes

All composite indexes defined in `firebase-backend/firestore.indexes.json`:

- 45+ indexes for optimized queries
- Key indexes for: Chats, Messages, Friends, Stories, Games, etc.
- New indexes added for: UserWarnings, Bans, Groups, etc.

### Expo Configuration

Key settings in `app.config.ts`:

- `scheme`: "snapstyle"
- `notification.icon`: Custom notification icon
- `android.permissions`: CAMERA, NOTIFICATIONS
- `ios.infoPlist`: Camera usage description

---

## 19. Firebase Project Details

- **Project ID**: `gamerapp-37e70`
- **Region**: `us-central1`
- **Firebase Console**: https://console.firebase.google.com/project/gamerapp-37e70

### Deployed Services

- ✅ Firebase Auth (Email/Password)
- ✅ Cloud Firestore
- ✅ Cloud Storage
- ✅ Cloud Functions (Node.js 20)
- ✅ Firebase Hosting (optional)

### Environment Variables

Cloud Functions use `process.env`:

- `ADMIN_SETUP_KEY`: Secret for first admin setup (defaults to "SECRET")

---

## 20. Key Files Reference

| File                                      | Purpose                   | Lines |
| ----------------------------------------- | ------------------------- | ----- |
| `src/types/models.ts`                     | ALL TypeScript interfaces | ~830  |
| `firebase-backend/functions/src/index.ts` | ALL Cloud Functions       | ~3100 |
| `firebase-backend/firestore.rules`        | Security rules            | ~710  |
| `firebase-backend/firestore.indexes.json` | Composite indexes         | ~310  |
| `firebase-backend/storage.rules`          | Storage security          | ~117  |
| `src/navigation/RootNavigator.tsx`        | All navigation            | ~380  |
| `src/store/AuthContext.tsx`               | Auth state + claims       | ~100  |
| `src/store/UserContext.tsx`               | User profile state        | ~80   |
| `src/components/AppGate.tsx`              | Hydration + bans          | ~195  |
| `src/data/cosmetics.ts`                   | Cosmetic definitions      | ~200  |

---

## 21. Common Patterns & Conventions

### Firebase SDK Pattern

```typescript
// Always use modular imports
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

// Get instance, then use
const db = getFirestoreInstance();
const docRef = doc(db, "Collection", "docId");
```

### Timestamps

```typescript
// Use JavaScript timestamps, NOT serverTimestamp()
const now = Date.now();
await setDoc(ref, { createdAt: now, updatedAt: now });
```

### Error Handling

```typescript
try {
  // Firebase operation
} catch (error: any) {
  console.error("[service] Error:", error);
  if (error.code === "permission-denied") {
    // Handle permission error
  }
  throw error;
}
```

### Real-time Subscriptions

```typescript
export function subscribeToX(callback: (data: X) => void): Unsubscribe {
  const db = getFirestoreInstance();
  return onSnapshot(
    query(...),
    (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as X);
      callback(data);
    },
    (error) => {
      console.error("[service] Error:", error);
    }
  );
}
```

### Cloud Function Calls

```typescript
import { httpsCallable } from "firebase/functions";
import { getFunctionsInstance } from "./firebase";

const functions = getFunctionsInstance();
const myFunction = httpsCallable(functions, "functionName");
const result = await myFunction({ param: value });
const data = result.data as ResponseType;
```

### Admin Check Pattern

```typescript
// In AuthContext
const idTokenResult = await user.getIdTokenResult(true);
setCustomClaims(idTokenResult.claims);

// In components
const { customClaims } = useAuth();
const isAdmin = customClaims?.admin === true;
```

---

## 22. Known Issues & Workarounds

### Web Platform

1. **Push Notifications**: Not fully supported on web (expected)
2. **Camera**: Falls back to `webImagePicker.ts` file input
3. **useNativeDriver**: Falls back to JS animations (warning)
4. **shadow\* styles**: Deprecated warnings (cosmetic only)

### Firestore Indexes

- New queries may require index creation
- Error message includes direct link to create index
- Indexes take 1-5 minutes to build after deployment

### Rate Limiting

- Rate limits checked via Cloud Functions
- Client should handle `rate-limited` errors gracefully
- Show user-friendly message when rate limited

### Streak Edge Cases

- Streak may not update if both users message at exactly the same time
- Timezone handling: All times are UTC

---

## 23. Future Phases

Potential future implementations:

### Phase 22: Media Pipeline

- Image compression presets
- Video support (may require ejecting from Expo)
- Thumbnail generation
- CDN optimization

### Phase 23: Enhanced Notifications

- Rich notifications with images
- Notification categories/actions
- Do Not Disturb scheduling

### Phase 24: Social Features

- User search improvements
- Suggested friends
- Profile sharing/QR codes

### Phase 25: Analytics & Insights

- User engagement metrics
- Game statistics
- Admin dashboard

---

## Quick Start for New Copilot Session

When starting a fresh Copilot chat, provide this context:

```
I'm working on SnapStyle MVP, a React Native social app with:
- Expo + Firebase (Project: gamerapp-37e70)
- 21 phases complete (see COMPREHENSIVE_APP_GUIDE.md)
- Features: Chat, Snaps, Stories, Streaks, Games, Economy, Groups, Admin
- Key files: src/types/models.ts, firebase-backend/functions/src/index.ts
- All services in src/services/
- Uses Firebase 12.x modular SDK with JavaScript timestamps
```

---

_Last Updated: January 22, 2026_
_Document Version: 1.0_
