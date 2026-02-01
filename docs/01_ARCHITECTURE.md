# Vibe App Architecture

> App structure, navigation, state management, and service layer

---

## Overview

Vibe is a React Native + Expo social app with Firebase backend and **local-first storage**. Features include real-time messaging (1:1 and groups), disappearing photos (Shots), 24-hour stories (Moments), friend streaks (Rituals), mini-games, avatar customization, and virtual economy.

### Architecture Pattern

```
User Action → SQLite (instant) → UI Update
                    ↓
         Background Sync → Firestore (eventual)
```

The app uses a **local-first architecture** where messages are stored in SQLite immediately, providing instant UI updates. Background sync ensures eventual consistency with Firebase.

---

## Folder Structure

```
snapstyle-mvp/
├── App.tsx                    # Root component with providers
├── app.config.ts              # Expo configuration
├── constants/
│   ├── theme.ts               # Catppuccin colors, spacing, typography
│   └── featureFlags.ts        # Feature toggles (USE_LOCAL_STORAGE, etc.)
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── chat/              # Chat-specific components (V2)
│   │   │   ├── inbox/         # Inbox screen components
│   │   │   │   ├── ConversationContextMenu.tsx  # Long-press menu
│   │   │   │   ├── ConversationItem.tsx         # Conversation row
│   │   │   │   ├── DeleteConfirmDialog.tsx      # Delete confirmation
│   │   │   │   ├── EmptyState.tsx               # Contextual empty states
│   │   │   │   ├── FriendRequestItem.tsx        # Pending request row
│   │   │   │   ├── InboxFAB.tsx                 # Multi-action FAB
│   │   │   │   ├── InboxHeader.tsx              # Header with avatar/search
│   │   │   │   ├── InboxTabs.tsx                # Filter tabs
│   │   │   │   ├── MuteOptionsSheet.tsx         # Mute duration picker
│   │   │   │   ├── PinnedSection.tsx            # Collapsible pinned
│   │   │   │   ├── ProfilePreviewModal.tsx      # Quick profile view
│   │   │   │   ├── SwipeableConversation.tsx    # Swipe actions wrapper
│   │   │   │   └── index.ts                     # Barrel export
│   │   │   └── ...
│   │   ├── games/             # Game-specific components
│   │   │   └── index.ts       # Barrel export
│   │   ├── ui/                # Primitives (EmptyState, LoadingState, ErrorState)
│   │   │   └── index.ts       # Barrel export
│   │   ├── Avatar.tsx         # User avatar with cosmetics
│   │   └── ...
│   ├── data/
│   │   ├── cosmetics.ts       # Static cosmetic item definitions
│   │   ├── gameAchievements.ts # Achievement definitions
│   │   └── index.ts           # Barrel export
│   ├── hooks/                 # Custom React hooks
│   │   ├── useChat.ts         # **Master chat hook** (unified DM & Group)
│   │   ├── useUnifiedMessages.ts # Message subscription + outbox integration
│   │   ├── useChatComposer.ts # Composer state management
│   │   ├── useUnifiedChatScreen.ts # Combined hook for chat screens
│   │   ├── useMessagesV2.ts   # V2 message subscription (legacy)
│   │   ├── useOutboxProcessor.ts # Offline message queue
│   │   ├── useAttachmentPicker.ts # Multi-attachment selection
│   │   ├── useVoiceRecorder.ts # Voice message recording
│   │   ├── useMentionAutocomplete.ts # @mention autocomplete
│   │   ├── useInboxData.ts    # Unified inbox data with filters
│   │   ├── useConversationActions.ts # Pin/mute/delete actions
│   │   ├── useFriendRequests.ts # Friend request subscription
│   │   ├── chat/              # Keyboard & scroll hooks
│   │   │   ├── useChatKeyboard.ts # Keyboard tracking (react-native-keyboard-controller)
│   │   │   ├── useAtBottom.ts     # Scroll position detection
│   │   │   ├── useNewMessageAutoscroll.ts # Smart autoscroll rules
│   │   │   └── index.ts       # Barrel export
│   │   └── index.ts           # Barrel export
│   ├── navigation/
│   │   └── RootNavigator.tsx  # All navigation stacks
│   ├── screens/               # Screen components by feature
│   │   ├── admin/             # Admin moderation screens
│   │   ├── auth/              # Login, signup, profile setup
│   │   ├── chat/              # DM chat screens
│   │   │   ├── ChatListScreenV2.tsx     # Main inbox screen
│   │   │   ├── InboxSearchScreen.tsx    # Full search with filters
│   │   │   ├── InboxSettingsScreen.tsx  # Inbox settings
│   │   │   └── ...
│   │   ├── friends/           # Connections management
│   │   ├── games/             # Mini-games and leaderboards
│   │   │   ├── GamesHubScreen.tsx       # Main games hub
│   │   │   └── ...
│   │   ├── groups/            # Group chat screens
│   │   ├── profile/           # User profile
│   │   ├── settings/          # App settings
│   │   ├── shop/              # Cosmetics shop
│   │   ├── stories/           # Moments (stories)
│   │   ├── tasks/             # Daily tasks
│   │   └── wallet/            # Token wallet
│   ├── services/              # Firebase/backend operations
│   │   ├── messaging/         # **Unified messaging module**
│   │   │   ├── adapters/      # Message type adapters
│   │   │   │   ├── groupAdapter.ts # GroupMessage ↔ MessageV2
│   │   │   │   └── index.ts   # Barrel export
│   │   │   ├── index.ts       # Public API barrel
│   │   │   ├── memberState.ts # Unified member state
│   │   │   ├── send.ts        # Unified message sending
│   │   │   └── subscribe.ts   # Unified subscriptions
│   │   ├── database/          # **SQLite local storage (NEW)**
│   │   │   ├── index.ts       # Database singleton, schema init
│   │   │   ├── messageRepository.ts  # Message CRUD
│   │   │   ├── conversationRepository.ts # Conversation CRUD
│   │   │   ├── maintenance.ts # Vacuum, prune, reset utilities
│   │   │   └── repositories.ts # Barrel export
│   │   ├── sync/              # **Background sync engine (NEW)**
│   │   │   ├── index.ts       # Public API
│   │   │   └── syncEngine.ts  # Firestore sync state machine
│   │   ├── mediaCache.ts      # **Local media caching (NEW)**
│   │   ├── games/             # Game logic (chess, snake, 2048, etc.)
│   │   ├── gameValidation/    # Move validators
│   │   ├── inboxSettings.ts   # Inbox settings service
│   │   ├── chatV2.ts          # DM operations (uses unified)
│   │   ├── groups.ts          # Group operations (uses unified)
│   │   ├── index.ts           # Barrel export (non-conflicting)
│   │   └── ...
│   ├── store/                 # Context providers
│   │   └── index.ts           # Barrel export
│   ├── types/
│   │   ├── models.ts          # Core TypeScript interfaces
│   │   ├── messaging.ts       # V2 messaging types
│   │   ├── database.ts        # SQLite row types (NEW)
│   │   └── index.ts           # Barrel export (non-conflicting)
│   └── utils/                 # Pure utility functions
│       ├── animations.ts      # Reusable animation utilities
│       ├── haptics.ts         # Centralized haptic feedback
│       ├── log.ts             # Logging utility
│       ├── physics/           # Game physics utilities
│       ├── performance/       # Performance optimization utils
│       ├── index.ts           # Barrel export
│       └── ...
└── firebase-backend/          # Cloud Functions, rules, indexes
```

---

## Naming Conventions

| Type       | Convention                 | Example                                |
| ---------- | -------------------------- | -------------------------------------- |
| Components | PascalCase                 | `GameCard.tsx`                         |
| Screens    | PascalCase + Screen suffix | `ChatScreen.tsx`, `GamesHubScreen.tsx` |
| Hooks      | camelCase + use prefix     | `useGameLoop.ts`                       |
| Services   | camelCase                  | `auth.ts`, `gameInvites.ts`            |
| Types      | PascalCase (exported)      | `GameState`, `UserProfile`             |
| Constants  | SCREAMING_SNAKE_CASE       | `MAX_RETRY_COUNT`                      |
| Utilities  | camelCase                  | `formatDate.ts`                        |
| Test files | _.test.ts or _.spec.ts     | `auth.test.ts`                         |

---

## Navigation Structure

```
RootNavigator
├── AuthStack (unauthenticated)
│   ├── Welcome
│   ├── Login
│   ├── Signup
│   └── ProfileSetup
│
└── AppTabs (authenticated)
    ├── InboxStack (Chat tab)
    │   ├── ChatList
    │   ├── ChatDetail (DM)
    │   ├── ChatSettings
    │   ├── SnapViewer
    │   ├── Groups screens...
    │   └── ScheduledMessages
    │
    ├── MomentsStack (Stories tab)
    │   ├── Stories
    │   └── StoryViewer
    │
    ├── PlayStack (Games tab)
    │   ├── GamesHubScreen          # Main games hub
    │   ├── ReactionTapGame
    │   ├── TimedTapGame
    │   ├── FlappySnapGame
    │   ├── BounceBlitzGame
    │   ├── MemorySnapGame
    │   ├── WordSnapGame
    │   ├── Snap2048Game
    │   ├── SnapSnakeGame
    │   ├── TicTacToeGame
    │   ├── CheckersGame
    │   ├── ChessGame
    │   ├── CrazyEightsGame
    │   ├── Leaderboard
    │   └── Achievements
    │
    └── ProfileStack
        ├── Profile
        ├── Settings
        ├── Shop
        ├── Wallet
        ├── Tasks
        └── Admin screens...
```

---

## State Management

### Context Providers (src/store/)

| Context                     | Purpose        | Key State                     |
| --------------------------- | -------------- | ----------------------------- |
| `AuthContext`               | Firebase auth  | `user`, `loading`, `isAdmin`  |
| `UserContext`               | User profile   | `profile`, `refreshProfile()` |
| `ThemeContext`              | Theme mode     | `isDark`, `toggleTheme()`     |
| `SnackbarContext`           | Toast messages | `showSnackbar()`              |
| `InAppNotificationsContext` | In-app banners | Real-time notifications       |

### Provider Hierarchy (App.tsx)

```tsx
<AuthProvider>
  <ThemeProvider>
    <UserProvider>
      <SnackbarProvider>
        <InAppNotificationsProvider>
          <RootNavigator />
        </InAppNotificationsProvider>
      </SnackbarProvider>
    </UserProvider>
  </ThemeProvider>
</AuthProvider>
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION                             │
│  Screens → Components → Navigation                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ useAuth, useUser, useAppTheme
┌─────────────────────────────────────────────────────────────────┐
│                          STATE (Context)                         │
│  AuthContext │ UserContext │ ThemeContext │ SnackbarContext     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVICES (src/services/)                  │
│  auth.ts │ users.ts │ database/ │ sync/ │ mediaCache.ts │ ...   │
└─────────────────────────────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                              ▼
┌─────────────────────────────┐  ┌─────────────────────────────────┐
│    LOCAL STORAGE            │  │    FIREBASE BACKEND             │
│  SQLite (expo-sqlite)       │  │  Firestore │ Storage │ Auth    │
│  File System (expo-file)    │  │  Cloud Functions                │
└─────────────────────────────┘  └─────────────────────────────────┘
```

---

## Local Storage Layer (NEW)

The app uses a **local-first architecture** for messaging. Messages are stored in SQLite immediately, then synced to Firebase in the background.

### SQLite Database (`services/database/`)

| File                        | Purpose              | Key Functions                                                |
| --------------------------- | -------------------- | ------------------------------------------------------------ |
| `index.ts`                  | Database singleton   | `getDatabase()`, schema initialization                       |
| `messageRepository.ts`      | Message CRUD         | `insertMessage()`, `getMessagesForConversation()`            |
| `conversationRepository.ts` | Conversation CRUD    | `getOrCreateDMConversation()`, `getConversations()`          |
| `maintenance.ts`            | Database maintenance | `vacuumDatabase()`, `pruneOldMessages()`, `resetLocalData()` |

### Database Schema

```sql
-- Core tables
conversations (id, scope, name, last_message_*, is_archived, is_muted, ...)
messages (id, conversation_id, sender_id, kind, text, sync_status, ...)
attachments (id, message_id, kind, local_uri, remote_url, upload_status, ...)
reactions (id, message_id, user_id, emoji, sync_status)
sync_cursors (conversation_id, last_synced_at, sync_token)
```

### Sync Engine (`services/sync/`)

| File            | Purpose          | Key Functions                                    |
| --------------- | ---------------- | ------------------------------------------------ |
| `syncEngine.ts` | Background sync  | `syncPendingMessages()`, `pullMessages()`        |
|                 | State management | `getSyncState()`, `subscribeSyncState()`         |
|                 | Online/offline   | `setOnlineStatus()`, `isBackgroundSyncRunning()` |

### Media Cache (`services/mediaCache.ts`)

| Function                 | Purpose                  |
| ------------------------ | ------------------------ |
| `initializeMediaCache()` | Create cache directories |
| `cacheMediaFile()`       | Download and cache media |
| `getCachedMediaPath()`   | Get local path for media |
| `getCacheStats()`        | Get cache size/counts    |
| `clearMediaCache()`      | Remove all cached files  |

### Feature Flag

Toggle local storage on/off via `constants/featureFlags.ts`:

```typescript
export const USE_LOCAL_STORAGE = true; // Set false to rollback
```

### Sync States

Messages have a `sync_status` field:

| Status     | Meaning                                  |
| ---------- | ---------------------------------------- |
| `pending`  | Awaiting sync to server                  |
| `synced`   | Successfully synced                      |
| `failed`   | Sync failed (will retry)                 |
| `conflict` | Server/local conflict (needs resolution) |

---

## Service Layer (src/services/)

### Unified Messaging (`services/messaging/`)

The messaging module provides a unified API for both DM and group chats:

| File                       | Purpose                 | Key Functions                               |
| -------------------------- | ----------------------- | ------------------------------------------- |
| `send.ts`                  | Unified message sending | `sendMessage({ scope, conversationId })`    |
| `subscribe.ts`             | Unified subscriptions   | `subscribeToMessages(scope, id)`            |
| `memberState.ts`           | Unified member state    | `setMuted`, `setArchived`, `setNotifyLevel` |
| `adapters/groupAdapter.ts` | Type conversion         | `fromGroupMessage`, `toGroupMessage`        |

### Core Services

| Service             | Purpose            | Key Functions                                       |
| ------------------- | ------------------ | --------------------------------------------------- |
| `auth.ts`           | Authentication     | `signupUser`, `loginUser`, `logoutUser`             |
| `users.ts`          | User profiles      | `createUserProfile`, `updateProfile`, `getUser`     |
| `friends.ts`        | Connections        | `sendFriendRequest`, `acceptRequest`, `unfriend`    |
| `chat.ts`           | DM chat CRUD       | `getOrCreateChat`, `getUserChats`                   |
| `chatV2.ts`         | DM messaging       | `sendMessageWithOutbox`, `processPendingMessages`   |
| `messageList.ts`    | Subscriptions      | `subscribeToDMMessages`, `subscribeToGroupMessages` |
| `messageActions.ts` | Edit/Delete        | `editMessage`, `deleteMessageForAll/Me`             |
| `reactions.ts`      | Reactions          | `toggleReaction`, `subscribeToReactions`            |
| `groups.ts`         | Group chats        | `createGroup`, `sendGroupMessage`, role management  |
| `chatMembers.ts`    | DM member state    | `updateReadWatermark`, `setMuted`, `setArchived`    |
| `groupMembers.ts`   | Group member state | `updateGroupReadWatermark`, `setGroupMuted`         |
| `outbox.ts`         | Offline queue      | `enqueueMessage`, `processOutbox`, `retryItem`      |
| `stories.ts`        | Moments            | `postStory`, `getStoriesForUser`, `markAsViewed`    |
| `games.ts`          | Mini-games         | `submitGameScore`, `sendScorecard`                  |
| `turnBasedGames.ts` | Multiplayer games  | `createGame`, `makeMove`, `resignGame`              |
| `shop.ts`           | Purchases          | `purchaseItem`, `getShopCatalog`                    |
| `economy.ts`        | Wallet             | `getWallet`, `awardTokens`                          |
| `tasks.ts`          | Daily tasks        | `getTasks`, `claimReward`                           |
| `moderation.ts`     | Reports/bans       | `submitReport`, admin functions                     |
| `notifications.ts`  | Push tokens        | `registerPushToken`                                 |
| `storage.ts`        | File uploads       | `uploadImage`, `uploadVoiceMessage`                 |
| `inboxSettings.ts`  | Inbox preferences  | `getInboxSettings`, `updateInboxSettings`           |

---

## Key Patterns

### Unified Chat Hooks

Chat screens use a layered hook architecture:

```typescript
// Master hook - composes all chat functionality
const chat = useChat({
  scope: "dm" | "group",
  conversationId: string,
  currentUserId: string,
});

// Provides:
// - messages, displayMessages (with outbox merge)
// - sendMessage, loadOlder, loadNewer
// - replyTo state management
// - reaction handling
// - scroll position tracking
// - auto-scroll behavior
```

### Optimistic Updates + Outbox

Chat messages use an outbox pattern for offline support:

1. Message added to local outbox (AsyncStorage)
2. Optimistic UI update shows message immediately
3. Background processor sends to Cloud Function
4. On success: remove from outbox
5. On failure: mark for retry

### Real-time Subscriptions

Use Firestore `onSnapshot` for real-time data:

- Chat messages: `subscribeToDMMessages()`, `subscribeToGroupMessages()`
- Chat list: Real-time unread counts
- Group members: Live role updates

### Watermark-based Read State

Read/unread tracking uses watermarks instead of per-message flags:

- `MembersPrivate/{uid}.lastSeenAtPrivate` stores last read timestamp
- Messages after watermark are unread
- Single document update per conversation view

---

## Terminology (Vibe Branding)

| Internal | User-Facing     |
| -------- | --------------- |
| Stories  | **Moments**     |
| Snaps    | **Shots**       |
| Friends  | **Connections** |
| Streaks  | **Rituals**     |
| Games    | **Play**        |
| Chat     | **Inbox**       |
