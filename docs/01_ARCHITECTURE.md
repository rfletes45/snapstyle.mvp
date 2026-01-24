# Vibe App Architecture

> App structure, navigation, state management, and service layer

---

## Overview

Vibe is a React Native + Expo social app with Firebase backend. Features include real-time messaging (1:1 and groups), disappearing photos (Shots), 24-hour stories (Moments), friend streaks (Rituals), mini-games, avatar customization, and virtual economy.

---

## Folder Structure

```
snapstyle-mvp/
├── App.tsx                    # Root component with providers
├── app.config.ts              # Expo configuration
├── constants/
│   └── theme.ts               # Catppuccin colors, spacing, typography
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── chat/              # Chat-specific components (V2)
│   │   ├── ui/                # Primitives (EmptyState, LoadingState, ErrorState)
│   │   ├── Avatar.tsx         # User avatar with cosmetics
│   │   └── ...
│   ├── data/
│   │   └── cosmetics.ts       # Static cosmetic item definitions
│   ├── hooks/                 # Custom React hooks
│   │   ├── useMessagesV2.ts   # V2 message subscription
│   │   ├── useOutboxProcessor.ts # Offline message queue
│   │   ├── useAttachmentPicker.ts # Multi-attachment selection
│   │   ├── useVoiceRecorder.ts # Voice message recording
│   │   └── useMentionAutocomplete.ts # @mention autocomplete
│   ├── navigation/
│   │   └── RootNavigator.tsx  # All navigation stacks
│   ├── screens/               # Screen components by feature
│   │   ├── admin/             # Admin moderation screens
│   │   ├── auth/              # Login, signup, profile setup
│   │   ├── chat/              # DM chat screens
│   │   ├── friends/           # Connections management
│   │   ├── games/             # Mini-games and leaderboards
│   │   ├── groups/            # Group chat screens
│   │   ├── profile/           # User profile
│   │   ├── settings/          # App settings
│   │   ├── shop/              # Cosmetics shop
│   │   ├── stories/           # Moments (stories)
│   │   ├── tasks/             # Daily tasks
│   │   └── wallet/            # Token wallet
│   ├── services/              # Firebase/backend operations
│   ├── store/                 # Context providers
│   ├── types/
│   │   ├── models.ts          # Core TypeScript interfaces
│   │   └── messaging.ts       # V2 messaging types
│   └── utils/                 # Pure utility functions
└── firebase-backend/          # Cloud Functions, rules, indexes
```

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
    │   ├── GamesHub
    │   ├── ReactionTapGame
    │   ├── TimedTapGame
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
│  auth.ts │ users.ts │ chat.ts │ chatV2.ts │ groups.ts │ ...     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FIREBASE BACKEND                              │
│  Firestore │ Storage │ Cloud Functions │ Auth                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Service Layer (src/services/)

| Service            | Purpose        | Key Functions                                      |
| ------------------ | -------------- | -------------------------------------------------- |
| `auth.ts`          | Authentication | `signupUser`, `loginUser`, `logoutUser`            |
| `users.ts`         | User profiles  | `createUserProfile`, `updateProfile`, `getUser`    |
| `friends.ts`       | Connections    | `sendFriendRequest`, `acceptRequest`, `unfriend`   |
| `chat.ts`          | DM messaging   | `getOrCreateChat`, `getUserChats`                  |
| `chatV2.ts`        | V2 messaging   | `sendMessageWithOutbox`, `processPendingMessages`  |
| `groups.ts`        | Group chats    | `createGroup`, `sendGroupMessage`, role management |
| `stories.ts`       | Moments        | `postStory`, `getStoriesForUser`, `markAsViewed`   |
| `games.ts`         | Mini-games     | `submitGameScore`, `sendScorecard`                 |
| `shop.ts`          | Purchases      | `purchaseItem`, `getShopCatalog`                   |
| `economy.ts`       | Wallet         | `getWallet`, `awardTokens`                         |
| `tasks.ts`         | Daily tasks    | `getTasks`, `claimReward`                          |
| `moderation.ts`    | Reports/bans   | `submitReport`, admin functions                    |
| `notifications.ts` | Push tokens    | `registerPushToken`                                |
| `storage.ts`       | File uploads   | `uploadImage`, `uploadVoiceMessage`                |

---

## Key Patterns

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
